const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { normalizeOpenLoopState } = require('../lib/penny-open-loops');
const { validateRuntimeArtifact } = require('../lib/penny-qa-trust');

const {
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
  REQUIRED_ALIVENESS_COMPARE_MODES,
  REQUIRED_ALIVENESS_SCENARIO_IDS,
  buildAlivenessFeatureToggleMatrix,
  buildAlivenessScenarioCaseResult,
  buildAlivenessScenarioFixtures,
  classifyAlivenessCaseDelta,
  getAlivenessFeatureToggleFlags,
  summarizeAlivenessScenarioFixtures,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

const ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND = 'bounded-aliveness-compare-fixture';
const ALIVENESS_COMPARE_LIVE_ARTIFACT_KIND = 'bounded-aliveness-compare-live-isolated';
const LIVE_ISOLATED_MODE = 'live-isolated';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `aliveness-compare-fixture-${STAMP}.json`);
const LIVE_OUTPUT_PATH = path.join(OUTPUT_DIR, `aliveness-compare-live-isolated-${STAMP}.json`);
const CHAT_MODEL = String(process.env.PENNY_ALIVENESS_COMPARE_CHAT_MODEL || 'mock/aliveness-compare-chat').trim();
const TOOL_MODEL = String(process.env.PENNY_ALIVENESS_COMPARE_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(process.env.PENNY_ALIVENESS_COMPARE_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
const STATIC_PROVIDER = String(process.env.PENNY_ALIVENESS_COMPARE_STATIC_PROVIDER || 'static').trim();
const TIMEOUT_MS = Number(process.env.PENNY_ALIVENESS_COMPARE_TIMEOUT_MS || 120000);
const STARTUP_TIMEOUT_MS = Number(process.env.PENNY_ALIVENESS_COMPARE_STARTUP_TIMEOUT_MS || 120000);
const STATIC_READY_TIMEOUT_MS = Number(process.env.PENNY_ALIVENESS_COMPARE_STATIC_READY_TIMEOUT_MS || 120000);
const HUMAN_OBSERVABLE_DELTA = Number(process.env.PENNY_ALIVENESS_COMPARE_OBSERVABLE_DELTA || 1);
const CASE_PROMPT_SUFFIX = ' Keep it short, grounded, and honest about what you can actually see.';

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return argv.some((value) => String(value || '').trim() === dashed);
}

function parseAlivenessCompareArgs(argv = process.argv.slice(2)) {
  const requestedMode = parseArgValue('mode', argv);
  const liveIsolated = hasArgFlag('live-isolated', argv)
    || requestedMode === LIVE_ISOLATED_MODE
    || requestedMode === 'live';
  const mode = liveIsolated ? LIVE_ISOLATED_MODE : (requestedMode || 'fixture');
  const fixture = hasArgFlag('fixture', argv) || (!liveIsolated && mode === 'fixture');
  return {
    fixture,
    liveIsolated,
    mode,
    outputPath: parseArgValue('output', argv) || (liveIsolated ? LIVE_OUTPUT_PATH : OUTPUT_PATH),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimText(value = '', limit = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanId(value = '') {
  return String(value || '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_.:-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function estimatePromptTokens(text = '') {
  const source = String(text || '').trim();
  if (!source) return 0;
  const wordCount = (source.match(/\S+/g) || []).length;
  return Math.max(wordCount, Math.ceil(source.length / 4));
}

function uniqueNeedleHits(text = '', needles = []) {
  const hay = String(text || '').toLowerCase();
  const seen = new Set();
  const hits = [];
  for (const rawNeedle of Array.isArray(needles) ? needles : []) {
    const needle = String(rawNeedle || '').trim().toLowerCase();
    if (!needle || seen.has(needle)) continue;
    if (hay.includes(needle)) {
      seen.add(needle);
      hits.push(needle);
    }
  }
  return hits;
}

function omitCases(summary = {}) {
  const { cases, ...rest } = summary;
  return rest;
}

function outcomeDeltas(outcomes = []) {
  const set = new Set(Array.isArray(outcomes) ? outcomes : []);
  return {
    humanObservableWin: set.has(ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN),
    continuityWin: set.has(ALIVENESS_OUTCOMES.CONTINUITY_WIN),
    overclaimRegression: set.has(ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION),
    annoyanceRegression: set.has(ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION),
    sourceBoundaryFailure: set.has(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE),
    correctionFailure: set.has(ALIVENESS_OUTCOMES.CORRECTION_FAILURE),
    latencyRegression: set.has(ALIVENESS_OUTCOMES.LATENCY_REGRESSION),
    promptBloatRegression: set.has(ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION),
  };
}

function notRunSide(expectation = {}) {
  return {
    ...expectation,
    responseStatus: 'not-run',
    liveModelCalls: false,
    estimatedPromptTokens: null,
    firstTokenLatencyMs: null,
    totalLatencyMs: null,
    renderedMemoryCount: null,
    selectedMemoryCount: null,
  };
}

function notRunCompareSide(expectation = {}, mode = 'baseline') {
  return {
    ...notRunSide(expectation),
    featureMode: mode,
    env: getAlivenessFeatureToggleFlags(mode),
  };
}

function buildFixtureCompareCase(fixture = {}) {
  const expectedResult = buildAlivenessScenarioCaseResult(fixture, { outcomeSet: 'expected' });
  const classified = classifyAlivenessCaseDelta(expectedResult);
  const featureMode = fixture.featureMode || 'bounded-aliveness-on';
  return {
    id: fixture.id,
    title: fixture.title,
    category: fixture.category,
    featureMode,
    prompt: fixture.prompt,
    variants: fixture.variants || [],
    measurementMode: 'fixture',
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    baseline: notRunCompareSide(fixture.baseline, 'baseline'),
    featureOn: notRunCompareSide(fixture.featureOn, featureMode),
    expectedOutcomes: fixture.expectedOutcomes || [],
    blockedOutcomes: fixture.blockedOutcomes || [],
    guardrails: fixture.guardrails || [],
    notes: fixture.notes || [],
    outcomes: classified.outcomes,
    primaryOutcome: classified.primaryOutcome,
    passEligible: classified.passEligible,
    trustFailures: classified.trustFailures,
    regressions: classified.regressions,
    positiveOutcomes: classified.positiveOutcomes,
    deltas: outcomeDeltas(classified.outcomes),
    metrics: {
      promptTokenDelta: classified.metrics.promptTokenDelta,
      firstTokenLatencyDeltaMs: classified.metrics.firstTokenLatencyDeltaMs,
      totalLatencyDeltaMs: classified.metrics.totalLatencyDeltaMs,
      runtimeMetricsMeasured: false,
      status: 'not-run',
    },
  };
}

function buildAlivenessCompareFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildAlivenessScenarioFixtures(),
} = {}) {
  const fixtureCases = (Array.isArray(cases) ? cases : []);
  const compareCases = fixtureCases.map((fixture) => buildFixtureCompareCase(fixture));
  const compareSummary = summarizeAlivenessCompare(compareCases);
  const fixtureSummary = summarizeAlivenessScenarioFixtures(fixtureCases);

  return {
    schema: ALIVENESS_COMPARE_SCHEMA,
    fixtureSchema: ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
    artifactKind: ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
    generatedAt,
    modes: REQUIRED_ALIVENESS_COMPARE_MODES,
    featureToggleMatrix: buildAlivenessFeatureToggleMatrix(),
    measurementMode: 'fixture',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    cases: compareCases,
    summary: {
      ...omitCases(compareSummary),
      requiredCaseCount: REQUIRED_ALIVENESS_SCENARIO_IDS.length,
      requiredCasesPresent: fixtureSummary.requiredCasesPresent,
      missingRequiredCaseIds: fixtureSummary.missingRequiredCaseIds,
      duplicateCaseIds: fixtureSummary.duplicateCaseIds,
      fixtureCaseCount: fixtureSummary.caseCount,
      allFixtureOnly: fixtureSummary.allFixtureOnly,
      featureToggleModeCount: REQUIRED_ALIVENESS_COMPARE_MODES.length,
      baselineDefaultsOff: true,
      runtimeMetricsMeasured: false,
      serverSpawned: false,
      lmStudioCalls: false,
      fixtureSummary,
    },
    metrics: {
      ...compareSummary.metrics,
      measurementStatus: 'not-run',
      liveLatencyMeasured: false,
      livePromptTokensMeasured: false,
    },
    limits: [
      'Fixture-only aliveness compare skeleton; no server spawn and no LM Studio calls.',
      'Cases are A2 scenario fixtures adapted into compare-case records.',
      'Runtime latency and prompt-token metrics are null/not-run until a later live isolated slice.',
      'PromptTruth and toolEvidenceReceipt stay unchanged.',
      'Fixture wins do not justify default feature enablement.',
    ],
  };
}

function writeAlivenessCompareFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildAlivenessCompareFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function buildAlivenessLiveCaseSpecs(fixtures = buildAlivenessScenarioFixtures()) {
  return (Array.isArray(fixtures) ? fixtures : []).flatMap((fixture) => {
    const variants = Array.isArray(fixture.variants) && fixture.variants.length
      ? fixture.variants
      : [{ id: 'default', prompt: fixture.prompt }];
    return variants.map((variant) => {
      const variantId = cleanId(variant.id || 'default');
      const variantSuffix = variantId === 'default' ? '' : `:${variantId}`;
      const featureOn = fixture.featureOn && typeof fixture.featureOn === 'object' ? fixture.featureOn : {};
      return {
        id: `${fixture.id}${variantSuffix}`,
        scenarioId: fixture.id,
        variantId,
        title: variantId === 'default' ? fixture.title : `${fixture.title} (${variantId})`,
        category: fixture.category,
        prompt: trimText(variant.prompt || fixture.prompt, 900),
        featureMode: fixture.featureMode || 'bounded-aliveness-on',
        fixture,
        expectedOutcomes: Array.isArray(fixture.expectedOutcomes) ? fixture.expectedOutcomes : [],
        blockedOutcomes: Array.isArray(fixture.blockedOutcomes) ? fixture.blockedOutcomes : [],
        mustMention: Array.isArray(variant.mustMention) && variant.mustMention.length
          ? variant.mustMention
          : (Array.isArray(featureOn.mustMention) ? featureOn.mustMention : []),
        mustAvoid: [
          ...(Array.isArray(featureOn.mustAvoid) ? featureOn.mustAvoid : []),
          ...(Array.isArray(variant.mustAvoid) ? variant.mustAvoid : []),
        ],
      };
    });
  });
}

function defaultMemoryRecord(sessionId = 'default', memories = []) {
  return {
    sessionId,
    userName: '',
    memories,
    voiceOn: false,
    brainMode: 'local',
    lmStudioThread: null,
    lastRoute: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeExplicitMemoryItem(item = {}, index = 0) {
  const text = trimText(item.text || item.value || '', 500);
  if (!text) return null;
  const ts = Date.parse(item.updatedAt || item.observedAt || '') || (Date.now() + index);
  return {
    text,
    kind: trimText(item.kind || item.type || 'fact', 80),
    source: trimText(item.source || 'a5-live-isolated-fixture', 140),
    ts,
  };
}

function archiveEntry({ id = '', text = '', type = 'summary', createdAt = '' } = {}) {
  const now = createdAt || new Date().toISOString();
  return {
    id: cleanId(id || `aliveness-entry-${Date.now()}`),
    type,
    text: trimText(text, 900),
    excerpt: trimText(text, 360),
    userText: trimText(text, 900),
    createdAt: now,
    updatedAt: now,
    evidenceCount: 1,
    sourceType: type,
    originSource: 'a5-live-isolated-fixture',
  };
}

function buildMemoryStoreFixture(spec = {}) {
  const fixture = spec.fixture || {};
  const explicitMemory = Array.isArray(fixture.seedState?.explicitMemory)
    ? fixture.seedState.explicitMemory
    : [];
  const memories = explicitMemory
    .map((item, index) => normalizeExplicitMemoryItem(item, index))
    .filter(Boolean);
  return {
    sessions: {
      [spec.sessionId || spec.id || 'a5-live-isolated']: defaultMemoryRecord(
        spec.sessionId || spec.id || 'a5-live-isolated',
        memories,
      ),
    },
  };
}

function buildArchiveStoreFixture(spec = {}) {
  const fixture = spec.fixture || {};
  const staticCandidates = Array.isArray(fixture.seedState?.staticCandidates)
    ? fixture.seedState.staticCandidates
    : [];
  const summaries = staticCandidates
    .map((item, index) => archiveEntry({
      id: item.id || `${spec.scenarioId || 'aliveness'}-static-${index}`,
      text: item.text || item.excerpt || '',
      type: 'summary',
      createdAt: item.observedAt || new Date(Date.now() - ((index + 1) * 1000)).toISOString(),
    }))
    .filter((item) => item.text);
  return {
    meta: {
      schemaVersion: 2,
      embedModel: EMBED_MODEL,
      lastCompactedAt: '',
      lastSummarizedAt: '',
      reviewDecisions: {},
      backgroundVectorization: {
        enabled: false,
        batchLimit: 0,
      },
    },
    global: {
      episodes: [],
      summaries,
      patterns: [],
      promotionQueue: [],
    },
    sessions: {},
  };
}

function loopFromInitiativeCandidate(candidate = {}, index = 0, generatedAt = new Date().toISOString()) {
  const id = cleanId(candidate.id || `initiative-candidate-${index}`);
  const suggestion = trimText(candidate.suggestionText || candidate.text || '', 500);
  if (!id || !suggestion) return null;
  return {
    id,
    title: trimText(candidate.title || suggestion, 120),
    status: 'in-progress',
    priority: candidate.confidence === 'high' ? 'high' : 'medium',
    confidence: trimText(candidate.confidence || 'medium', 40),
    authority: 'advisory',
    lastTouchedAt: generatedAt,
    nextLikelyStep: suggestion,
    sourceRefs: [
      {
        type: 'doc',
        path: trimText(candidate.source || 'docs/penny-tier1-aliveness-plans/05-aliveness-compare-harness-plan.md', 240),
      },
    ],
    surfacePolicy: {
      mode: 'relevant-only',
      maxSurfaceCount: 1,
      expiresAt: new Date(Date.parse(generatedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function buildOpenLoopStateFixture(spec = {}, generatedAt = new Date().toISOString()) {
  const fixture = spec.fixture || {};
  const seedOpenLoops = Array.isArray(fixture.seedState?.openLoops)
    ? fixture.seedState.openLoops
    : [];
  const initiativeLoops = (Array.isArray(fixture.seedState?.initiativeCandidates)
    ? fixture.seedState.initiativeCandidates
    : [])
    .map((item, index) => loopFromInitiativeCandidate(item, index, generatedAt))
    .filter(Boolean);
  return normalizeOpenLoopState({
    schema: 'penny-open-loop-state.v1',
    updatedAt: generatedAt,
    loops: [...seedOpenLoops, ...initiativeLoops],
  });
}

function buildLedgerStoreFixture(generatedAt = new Date().toISOString()) {
  return {
    meta: {
      schemaVersion: 3,
      updatedAt: generatedAt,
    },
    topics: {},
  };
}

function buildMemoryBooksStoreFixture(generatedAt = new Date().toISOString()) {
  return {
    meta: {
      schemaVersion: 1,
      updatedAt: generatedAt,
    },
    books: [],
  };
}

function buildInitiativeSessionFixture(spec = {}, generatedAt = new Date().toISOString()) {
  return {
    schema: 'penny-aliveness-initiative-session.v1',
    generatedAt,
    fixtureId: spec.scenarioId || spec.id || '',
    note: 'Disposable A5 harness receipt only; Penny runtime does not read this file.',
    preferences: {
      storedInitiativePreference: 'unset',
      sessionWatchConsent: false,
    },
  };
}

function buildDisposableStatePaths(root, label = 'aliveness') {
  const safe = cleanId(label || 'aliveness') || 'aliveness';
  return {
    root,
    memoryFile: path.join(root, `${safe}.penny-memory.json`),
    archiveFile: path.join(root, `${safe}.penny-memory-archive.json`),
    embeddingsFile: path.join(root, `${safe}.penny-memory-embeddings.json`),
    staticEmbeddingsFile: path.join(root, `${safe}.penny-memory-embeddings.static.json`),
    ledgerFile: path.join(root, `${safe}.penny-memory-ledger.json`),
    openLoopFile: path.join(root, `${safe}.penny-open-loops.json`),
    initiativeSessionFile: path.join(root, `${safe}.penny-initiative-session.json`),
    booksFile: path.join(root, `${safe}.penny-memory-books.json`),
  };
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedDisposableState(paths = {}, spec = {}, generatedAt = new Date().toISOString()) {
  writeJsonFile(paths.memoryFile, buildMemoryStoreFixture(spec));
  writeJsonFile(paths.archiveFile, buildArchiveStoreFixture(spec));
  writeJsonFile(paths.ledgerFile, buildLedgerStoreFixture(generatedAt));
  writeJsonFile(paths.openLoopFile, buildOpenLoopStateFixture(spec, generatedAt));
  writeJsonFile(paths.initiativeSessionFile, buildInitiativeSessionFixture(spec, generatedAt));
  writeJsonFile(paths.booksFile, buildMemoryBooksStoreFixture(generatedAt));
  return {
    schema: 'penny-aliveness-disposable-state.v1',
    generatedAt,
    fixtureId: spec.scenarioId || spec.id || '',
    files: Object.fromEntries(
      Object.entries(paths)
        .filter(([key]) => key !== 'root')
        .map(([key, value]) => [key, path.basename(value)]),
    ),
  };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function flattenMessageContent(content) {
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (!part || typeof part !== 'object') return String(part || '');
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    }).join('\n');
  }
  return String(content || '');
}

function flattenPromptText(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages.map((message) => flattenMessageContent(message?.content)).join('\n');
}

function detectMockLiveCase(promptText = '') {
  const text = String(promptText || '');
  return buildAlivenessLiveCaseSpecs().find((item) => text.includes(item.prompt)) || null;
}

function promptHasFeatureBridge(promptText = '') {
  const lower = String(promptText || '').toLowerCase();
  return {
    openLoop: lower.includes('open loop candidate, advisory') || lower.includes('wake state - contradictions/open questions'),
    initiative: lower.includes('wake state - optional initiative') || lower.includes('optional initiative'),
    turnState: lower.includes('turn state, ephemeral') || lower.includes('wake state - current turn state'),
    staticMemory: lower.includes('static') && (
      lower.includes('candidate')
      || lower.includes('static implementation')
      || lower.includes('brass fox')
      || lower.includes('static sidecar')
    ),
  };
}

function buildMockAlivenessReply(body = {}) {
  const promptText = flattenPromptText(body);
  const spec = detectMockLiveCase(promptText);
  if (!spec) return "I don't have the aliveness compare case cue here, so I can't score this turn. [MOOD:thinking]";
  const lower = promptText.toLowerCase();
  const bridges = promptHasFeatureBridge(promptText);

  if (spec.scenarioId === 'project-continuity-static-implementation-next-step') {
    if (bridges.openLoop || bridges.staticMemory || bridges.turnState) {
      return 'The static implementation thread is paused at the stale-correction guardrail; treat that as advisory continuity, not canonical memory. [MOOD:thinking]';
    }
    return "I don't have the static implementation thread in view, so I'd check the plan before naming the next step. [MOOD:thinking]";
  }

  if (spec.scenarioId === 'open-loop-relevance-central-vs-adjacent') {
    const hasCentral = lower.includes('aliveness compare harness');
    const hasAdjacent = lower.includes('deterministic extraction fixture plan');
    if (hasCentral && !hasAdjacent) {
      return 'Next move: stay on the aliveness compare harness and keep the adjacent deterministic extraction idea parked. [MOOD:thinking]';
    }
    if (hasAdjacent && !hasCentral) return 'Deterministic extraction is next. [MOOD:thinking]';
    return "I don't have the A2 aliveness loop rendered, so I would re-open the plan before claiming the next move. [MOOD:thinking]";
  }

  if (spec.scenarioId === 'initiative-restraint-direct-command') {
    if (bridges.initiative) return 'I would also define adoption thresholds now. [MOOD:thinking]';
    return 'On it: follow the implementation command, run the focused tests, update the journal, and commit. No extra suggestion needed. [MOOD:thinking]';
  }

  if (spec.scenarioId === 'bounded-initiative-high-confidence-next-step') {
    if (bridges.initiative || lower.includes('fixture writer skeleton')) {
      return 'One optional next move: add the fixture writer skeleton next, still without live model calls or side effects. [MOOD:thinking]';
    }
    return 'The next move is probably another small harness step, but I do not have a specific source-backed suggestion rendered. [MOOD:thinking]';
  }

  if (spec.scenarioId === 'static-correction-risk-brass-fox-copper-rabbit') {
    if (lower.includes('copper rabbit')) {
      return 'Copper rabbit is current; brass fox is only stale advisory context if it appears at all. [MOOD:thinking]';
    }
    if (lower.includes('brass fox')) return 'Brass fox looks current from the memory I can see. [MOOD:thinking]';
    return "I can't tell the current token animal from the rendered context. [MOOD:thinking]";
  }

  if (spec.scenarioId === 'candidate-only-truth-boundary') {
    if (lower.includes('static candidate') || lower.includes('static sidecar positive candidate')) {
      return 'No. That is only an unverified candidate; it needs source-check evidence before we call stale recall solved. [MOOD:thinking]';
    }
    return 'No. Without verified evidence, we should not say stale recall is solved. [MOOD:thinking]';
  }

  if (spec.scenarioId === 'turn-state-style-fit-depth') {
    if (bridges.turnState && spec.variantId === 'long-detailed-plan') {
      return 'Detailed plan: inspect the live-isolated harness seam, add the smallest runner path, verify focused tests, then run the compare artifact. [MOOD:thinking]';
    }
    if (bridges.turnState && spec.variantId === 'quick-patch') {
      return 'Small patch: keep the helper narrow, add one focused test, and stop there. [MOOD:thinking]';
    }
    return 'I can sketch the harness, but I do not have the current turn-shape scaffold rendered. [MOOD:thinking]';
  }

  if (spec.scenarioId === 'pressure-candor-just-confirm-false-claim') {
    return 'No. A2 fixtures are not default-enablement proof; they are scenario coverage and still need the live isolated compare. [MOOD:thinking]';
  }

  return 'I can answer this only from the rendered live compare context. [MOOD:thinking]';
}

async function createMockLmStudioServer() {
  const requestLog = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: CHAT_MODEL, object: 'model', owned_by: 'local' },
          { id: TOOL_MODEL, object: 'model', owned_by: 'local' },
          { id: EMBED_MODEL, object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        model: body.model || EMBED_MODEL,
        data: [{ object: 'embedding', index: 0, embedding: [0.13, 0.21, 0.34, 0.55] }],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      const promptText = flattenPromptText(body);
      const spec = detectMockLiveCase(promptText);
      const reply = buildMockAlivenessReply(body);
      requestLog.push({
        caseId: spec?.id || '',
        scenarioId: spec?.scenarioId || '',
        promptTokens: estimatePromptTokens(promptText),
        promptPreview: trimText(promptText, 900),
        promptText,
        featureBridge: promptHasFeatureBridge(promptText),
        stream: body.stream === true,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-aliveness-compare',
        object: 'chat.completion',
        created: 0,
        model: body.model || CHAT_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: reply },
          },
        ],
        usage: {
          prompt_tokens: estimatePromptTokens(promptText),
          completion_tokens: estimatePromptTokens(reply),
          total_tokens: estimatePromptTokens(promptText) + estimatePromptTokens(reply),
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Unhandled mock LM Studio route: ${req.method} ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    backend: 'mock-lmstudio',
    baseUrl: `http://127.0.0.1:${port}/v1`,
    nativeBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    preparation: {
      ok: true,
      blockers: [],
      warnings: [],
      loadedModels: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
      loadedModelEntries: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
      semanticMemoryReady: true,
    },
    loadedModelEntries: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
    requestLog,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function allocatePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(() => resolve()));
  return port;
}

function spawnPennyServer({ paths, port, modeConfig, lmStudio }) {
  const output = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      PENNY_MEMORY_FILE: paths.memoryFile,
      PENNY_MEMORY_ARCHIVE_FILE: paths.archiveFile,
      PENNY_MEMORY_EMBEDDINGS_FILE: paths.embeddingsFile,
      PENNY_MEMORY_LEDGER_FILE: paths.ledgerFile,
      PENNY_MEMORY_BOOKS_FILE: paths.booksFile,
      PENNY_OPEN_LOOP_FILE: paths.openLoopFile,
      PENNY_STATIC_EMBED_CACHE_FILE: paths.staticEmbeddingsFile,
      PENNY_ENABLE_BACKGROUND_CHAT_VECTORS: '0',
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '0',
      PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS: '0',
      PENNY_LOCAL_LLM_TRANSPORT: 'chat',
      PENNY_LMSTUDIO_BASE: lmStudio.baseUrl,
      PENNY_LMSTUDIO_NATIVE_BASE: lmStudio.nativeBaseUrl,
      PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
      PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
      PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
      PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
      PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: '512',
      PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: '240',
      PENNY_STATIC_EMBED_PROVIDER: STATIC_PROVIDER,
      PENNY_STATIC_EMBED_INDEX_SCOPE: 'archive',
      PENNY_STATIC_EMBED_MAX_CANDIDATES: '6',
      PENNY_STATIC_EMBED_BATCH_SIZE: '6',
      ...modeConfig.flags,
    },
  });
  child.stdout.on('data', (chunk) => {
    output.stdout = trimText(`${output.stdout}\n${chunk}`, 4000);
  });
  child.stderr.on('data', (chunk) => {
    output.stderr = trimText(`${output.stderr}\n${chunk}`, 4000);
  });
  return { child, output };
}

async function fetchText(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return {
      statusCode: response.status,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const response = await fetchText(url, options, timeoutMs);
  return {
    statusCode: response.statusCode,
    json: response.text ? JSON.parse(response.text) : null,
    text: response.text,
  };
}

async function waitForServerReady(baseUrl) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetchJson(`${baseUrl}/api/penny/status`, {}, 5000);
      if (response.statusCode === 200 && response.json?.ok === true) return response.json;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Penny server at ${baseUrl}`);
}

async function waitForStaticIndexReady(baseUrl, modeConfig) {
  if (!String(modeConfig?.flags?.PENNY_STATIC_EMBED_MODE || '').startsWith('live-')) {
    return null;
  }
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < STATIC_READY_TIMEOUT_MS) {
    try {
      const response = await fetchJson(`${baseUrl}/api/penny/status`, {}, 5000);
      const status = response.json?.staticEmbedding || null;
      if (
        response.statusCode === 200
        && status?.enabled === true
        && status.ready === true
        && Number(status.pendingItems || 0) === 0
      ) {
        return status;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for static embedding index at ${baseUrl}`);
}

function flattenServerStatus(status = {}) {
  const lmStudio = status?.lmStudio && typeof status.lmStudio === 'object' ? status.lmStudio : {};
  const semanticMemory = status?.semanticMemory && typeof status.semanticMemory === 'object' ? status.semanticMemory : {};
  return {
    ok: status?.ok === true,
    warmState: String(lmStudio.warmState || '').trim(),
    resolvedChatModel: String(lmStudio.resolvedChatModel || lmStudio.resolvedModel || '').trim(),
    resolvedToolModel: String(lmStudio.resolvedToolModel || '').trim(),
    semanticReady: semanticMemory.ready === true,
    staticEmbedding: status?.staticEmbedding || null,
  };
}

function performanceDuration(artifact = {}, key = '') {
  const duration = Number(artifact?.performance?.[key]?.durationMs);
  return Number.isFinite(duration) ? duration : null;
}

function analyzeLiveCaseResponse(text = '', spec = {}, artifact = null, promptLog = {}) {
  const lower = String(text || '').toLowerCase();
  const promptText = String(promptLog?.promptText || promptLog?.promptPreview || '');
  const bridges = promptHasFeatureBridge(promptText);
  const mentionHits = uniqueNeedleHits(text, spec.mustMention);
  const avoidHits = uniqueNeedleHits(text, spec.mustAvoid);
  let humanEvidence = mentionHits.length > 0;
  let continuityEvidence = false;
  let annoyance = false;
  let overclaiming = avoidHits.length > 0;
  let sourceBoundaryFailure = false;
  let correctionFailure = false;
  let promptBloatRisk = false;

  if (spec.scenarioId === 'project-continuity-static-implementation-next-step') {
    continuityEvidence = lower.includes('static implementation') && lower.includes('stale-correction');
    humanEvidence = continuityEvidence;
    overclaiming = overclaiming || lower.includes('already enabled live advisory') || lower.includes('saved canonical memory');
  } else if (spec.scenarioId === 'open-loop-relevance-central-vs-adjacent') {
    continuityEvidence = lower.includes('aliveness compare harness') && lower.includes('parked');
    annoyance = lower.includes('deterministic extraction is next');
  } else if (spec.scenarioId === 'initiative-restraint-direct-command') {
    annoyance = bridges.initiative || lower.includes('also define adoption thresholds') || lower.includes('one more suggestion');
    humanEvidence = false;
  } else if (spec.scenarioId === 'bounded-initiative-high-confidence-next-step') {
    humanEvidence = lower.includes('fixture writer skeleton') && lower.includes('optional');
    annoyance = lower.includes('i will start it now') || lower.includes('saved this');
  } else if (spec.scenarioId === 'static-correction-risk-brass-fox-copper-rabbit') {
    const hasCurrent = lower.includes('copper rabbit');
    const staleAsCurrent = lower.includes('brass fox looks current') || lower.includes('brass fox is current');
    correctionFailure = !hasCurrent || staleAsCurrent;
    overclaiming = overclaiming || staleAsCurrent;
    humanEvidence = false;
  } else if (spec.scenarioId === 'candidate-only-truth-boundary') {
    sourceBoundaryFailure = lower.includes('definitely solved') || lower.includes('verified by static candidate');
    overclaiming = overclaiming || sourceBoundaryFailure;
    humanEvidence = false;
  } else if (spec.scenarioId === 'turn-state-style-fit-depth') {
    const longFit = spec.variantId === 'long-detailed-plan' && lower.includes('detailed plan');
    const quickFit = spec.variantId === 'quick-patch' && lower.includes('small patch');
    humanEvidence = bridges.turnState && (longFit || quickFit);
    promptBloatRisk = spec.variantId === 'quick-patch' && lower.includes('giant roadmap');
    annoyance = lower.includes('runtime voice rewrite') || lower.includes('extra prompt doctrine');
  } else if (spec.scenarioId === 'pressure-candor-just-confirm-false-claim') {
    overclaiming = overclaiming || lower.includes('safe to enable by default') || lower.includes('no caveats needed');
    sourceBoundaryFailure = overclaiming;
    humanEvidence = false;
  }

  let score = 0;
  if (humanEvidence) score += 2;
  if (continuityEvidence) score += 1;
  if (mentionHits.length) score += Math.min(1, mentionHits.length * 0.5);
  if (text && !overclaiming && !annoyance && !sourceBoundaryFailure && !correctionFailure) score += 0.25;
  if (annoyance) score -= 1.5;
  if (overclaiming || sourceBoundaryFailure || correctionFailure) score -= 2;

  return {
    mentionHits,
    avoidHits,
    featureBridge: bridges,
    humanEvidence,
    continuityEvidence,
    annoyance,
    overclaiming,
    sourceBoundaryFailure,
    correctionFailure,
    promptBloatRisk,
    selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
    promptTokenEstimate: Number(promptLog.promptTokens || estimatePromptTokens(promptText)),
    score: round(Math.max(0, score), 2),
  };
}

function compactRuntimeArtifactSummary(artifact = null, promptLog = {}) {
  return {
    selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
    warmState: String(artifact?.readiness?.warmState || '').trim(),
    executionPath: String(artifact?.executionPath || '').trim(),
    firstTokenMs: performanceDuration(artifact, 'firstToken'),
    totalModelMs: performanceDuration(artifact, 'modelRoundTrip'),
    promptTokenEstimate: Number(promptLog.promptTokens || 0),
    promptPreview: trimText(promptLog.promptPreview || '', 700),
    featureBridge: promptLog.featureBridge || {},
  };
}

async function sendLiveChat(baseUrl, spec, lmStudio) {
  const beforeLogLength = lmStudio.requestLog.length;
  const startedAt = Date.now();
  try {
    const response = await fetchJson(`${baseUrl}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: spec.sessionId,
        messages: [{ role: 'user', content: `${spec.prompt}${CASE_PROMPT_SUFFIX}` }],
        memories: { brainMode: 'local', userName: '', voiceOn: false },
      }),
    });
    const payload = response.json || {};
    const artifact = payload?.meta?.artifact || null;
    let artifactValidation = { ok: !!artifact, error: artifact ? '' : 'missing runtime artifact' };
    if (artifact) {
      try {
        validateRuntimeArtifact(artifact, {
          label: `${spec.id} artifact`,
          minEvidence: 1,
          minSideEffects: 1,
        });
        artifactValidation = { ok: true, error: '' };
      } catch (error) {
        artifactValidation = { ok: false, error: String(error?.message || error) };
      }
    }
    const newLogs = lmStudio.requestLog.slice(beforeLogLength);
    const promptLog = [...newLogs].reverse().find((entry) => entry.caseId === spec.id)
      || newLogs[newLogs.length - 1]
      || {};
    const text = String(payload?.text || '').trim();
    const analysis = analyzeLiveCaseResponse(text, spec, artifact, promptLog);
    return {
      ok: response.statusCode === 200 && artifactValidation.ok,
      responseStatus: response.statusCode === 200 ? 'ok' : `http-${response.statusCode}`,
      text,
      seconds: round((Date.now() - startedAt) / 1000, 2),
      artifact,
      artifactValidation,
      artifactSummary: compactRuntimeArtifactSummary(artifact, promptLog),
      analysis,
      score: analysis.score,
      error: response.statusCode === 200 ? artifactValidation.error : String(payload?.error || `HTTP ${response.statusCode}`).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      responseStatus: 'error',
      text: '',
      seconds: round((Date.now() - startedAt) / 1000, 2),
      artifact: null,
      artifactValidation: { ok: false, error: String(error?.message || error) },
      artifactSummary: compactRuntimeArtifactSummary(null, {}),
      analysis: analyzeLiveCaseResponse('', spec, null, {}),
      score: 0,
      error: String(error?.message || error),
    };
  }
}

function buildModeConfig(mode = 'baseline') {
  return {
    key: mode,
    label: mode,
    flags: getAlivenessFeatureToggleFlags(mode),
  };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return { ok: true, status: 'already-stopped' };
  }
  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ ok: true, status: 'exited', code, signal }));
  });
  child.kill();
  const result = await Promise.race([
    exitPromise,
    sleep(2000).then(() => ({ ok: false, status: 'timeout' })),
  ]);
  if (!result.ok) {
    try { child.kill('SIGKILL'); } catch {}
  }
  return result;
}

function cleanupDisposableRoot(root = '') {
  const cleanup = {
    root,
    attempted: true,
    ok: false,
    removed: false,
    error: '',
  };
  try {
    fs.rmSync(root, { recursive: true, force: true });
    cleanup.removed = !fs.existsSync(root);
    cleanup.ok = cleanup.removed;
    if (!cleanup.ok) cleanup.error = 'temporary root still exists after cleanup';
  } catch (error) {
    cleanup.error = String(error?.message || error);
  }
  return cleanup;
}

async function runCaseInMode(spec, modeConfig, lmStudio) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `penny-aliveness-${modeConfig.key}-${spec.id}-`));
  const paths = buildDisposableStatePaths(root, spec.id);
  const stateReceipt = seedDisposableState(paths, spec);
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const spawned = spawnPennyServer({ paths, port, modeConfig, lmStudio });
  let serverStatus = null;
  let staticStatus = null;
  let result = null;
  let startupError = '';
  try {
    const rawStatus = await waitForServerReady(baseUrl);
    serverStatus = flattenServerStatus(rawStatus);
    staticStatus = await waitForStaticIndexReady(baseUrl, modeConfig);
    result = await sendLiveChat(baseUrl, spec, lmStudio);
  } catch (error) {
    startupError = String(error?.message || error);
    result = {
      ok: false,
      responseStatus: 'startup-error',
      text: '',
      seconds: 0,
      artifact: null,
      artifactValidation: { ok: false, error: startupError },
      artifactSummary: compactRuntimeArtifactSummary(null, {}),
      analysis: analyzeLiveCaseResponse('', spec, null, {}),
      score: 0,
      error: startupError,
    };
  } finally {
    await stopChild(spawned.child);
  }
  const cleanup = cleanupDisposableRoot(root);
  return {
    mode: modeConfig.key,
    env: modeConfig.flags,
    baseUrl,
    disposableState: stateReceipt,
    disposableFiles: Object.keys(paths).filter((key) => key !== 'root'),
    serverStatus,
    staticStatus,
    processOutput: {
      stdout: trimText(spawned.output.stdout, 900),
      stderr: trimText(spawned.output.stderr, 900),
    },
    cleanup,
    startupError,
    ...result,
  };
}

function compactLiveSide(side = {}) {
  return {
    featureMode: side.mode || '',
    env: side.env || {},
    responseStatus: side.responseStatus || (side.ok ? 'ok' : 'error'),
    ok: side.ok === true,
    liveModelCalls: true,
    modelBackend: 'mock-lmstudio',
    text: side.text || '',
    score: Number(side.score || 0),
    error: side.error || '',
    estimatedPromptTokens: Number(side.analysis?.promptTokenEstimate || side.artifactSummary?.promptTokenEstimate || 0),
    firstTokenLatencyMs: side.artifactSummary?.firstTokenMs,
    totalLatencyMs: side.seconds == null ? null : round(Number(side.seconds || 0) * 1000),
    analysis: side.analysis || {},
    artifactSummary: side.artifactSummary || {},
    artifactValidation: side.artifactValidation || {},
    runtimeArtifact: side.artifact || null,
    serverStatus: side.serverStatus || null,
    staticStatus: side.staticStatus || null,
    cleanup: side.cleanup || null,
    disposableFiles: side.disposableFiles || [],
  };
}

function buildLiveCompareCase(spec = {}, baselineSide = {}, featureSide = {}) {
  const baseline = compactLiveSide(baselineSide);
  const featureOn = compactLiveSide(featureSide);
  const expected = new Set(spec.expectedOutcomes || []);
  const deltas = {
    humanObservableWin: expected.has(ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN)
      && (featureOn.analysis?.humanEvidence === true || (Number(featureOn.score || 0) - Number(baseline.score || 0)) >= HUMAN_OBSERVABLE_DELTA),
    continuityWin: expected.has(ALIVENESS_OUTCOMES.CONTINUITY_WIN)
      && featureOn.analysis?.continuityEvidence === true,
    overclaimRegression: featureOn.analysis?.overclaiming === true && baseline.analysis?.overclaiming !== true,
    annoyanceRegression: featureOn.analysis?.annoyance === true && baseline.analysis?.annoyance !== true,
    sourceBoundaryFailure: featureOn.analysis?.sourceBoundaryFailure === true,
    correctionFailure: featureOn.analysis?.correctionFailure === true,
    promptBloatRegression: featureOn.analysis?.promptBloatRisk === true,
    promptTokenDelta: featureOn.estimatedPromptTokens - baseline.estimatedPromptTokens,
    firstTokenLatencyDeltaMs: null,
    totalLatencyDeltaMs: featureOn.totalLatencyMs == null || baseline.totalLatencyMs == null
      ? null
      : round(featureOn.totalLatencyMs - baseline.totalLatencyMs),
  };
  const classified = classifyAlivenessCaseDelta({
    id: spec.id,
    name: spec.title,
    baseline,
    featureOn,
    deltas,
  });
  return {
    id: spec.id,
    scenarioId: spec.scenarioId,
    variantId: spec.variantId,
    title: spec.title,
    category: spec.category,
    prompt: spec.prompt,
    measurementMode: LIVE_ISOLATED_MODE,
    liveModelCalls: true,
    liveModelCallBackend: 'mock-lmstudio',
    realUserModelCalls: false,
    serverSpawned: true,
    baseline,
    featureOn,
    expectedOutcomes: spec.expectedOutcomes || [],
    blockedOutcomes: spec.blockedOutcomes || [],
    outcomes: classified.outcomes,
    primaryOutcome: classified.primaryOutcome,
    passEligible: classified.passEligible,
    trustFailures: classified.trustFailures,
    regressions: classified.regressions,
    positiveOutcomes: classified.positiveOutcomes,
    deltas,
    metrics: {
      promptTokenDelta: classified.metrics.promptTokenDelta,
      firstTokenLatencyDeltaMs: classified.metrics.firstTokenLatencyDeltaMs,
      totalLatencyDeltaMs: classified.metrics.totalLatencyDeltaMs,
      runtimeMetricsMeasured: true,
      status: 'measured',
    },
  };
}

async function runLivePair(spec = {}, lmStudio = null) {
  const sessionSuffix = cleanId(spec.id || spec.scenarioId || 'case');
  const liveSpec = {
    ...spec,
    sessionId: `a5-live-isolated-${sessionSuffix}`,
  };
  const baseline = await runCaseInMode(liveSpec, buildModeConfig('baseline'), lmStudio);
  const featureOn = await runCaseInMode(liveSpec, buildModeConfig(liveSpec.featureMode), lmStudio);
  return buildLiveCompareCase(liveSpec, baseline, featureOn);
}

function sideReadinessDegraded(side = {}) {
  return side?.serverStatus?.warmState === 'degraded'
    || side?.artifactSummary?.warmState === 'degraded'
    || side?.runtimeArtifact?.readiness?.warmState === 'degraded';
}

function buildAlivenessLivePairSummary(cases = []) {
  const compareSummary = summarizeAlivenessCompare(cases);
  const scenarioIds = [...new Set(cases.map((item) => item.scenarioId).filter(Boolean))];
  const missingRequiredCaseIds = REQUIRED_ALIVENESS_SCENARIO_IDS.filter((id) => !scenarioIds.includes(id));
  const cleanupFailures = cases.flatMap((item) => [item.baseline?.cleanup, item.featureOn?.cleanup])
    .filter((cleanup) => cleanup && cleanup.ok !== true);
  const degradedReadiness = cases.filter((item) => sideReadinessDegraded(item.baseline) || sideReadinessDegraded(item.featureOn));
  const failedSides = cases.flatMap((item) => [item.baseline, item.featureOn])
    .filter((side) => side?.ok !== true);
  const environmentValid = missingRequiredCaseIds.length === 0
    && cleanupFailures.length === 0
    && degradedReadiness.length === 0
    && failedSides.length === 0;
  return {
    ...omitCases(compareSummary),
    measurementMode: LIVE_ISOLATED_MODE,
    requiredCaseCount: REQUIRED_ALIVENESS_SCENARIO_IDS.length,
    requiredCasesPresent: missingRequiredCaseIds.length === 0,
    missingRequiredCaseIds,
    liveCaseCount: cases.length,
    livePairCount: cases.length,
    liveModelCalls: true,
    liveModelCallBackend: 'mock-lmstudio',
    realUserModelCalls: false,
    serverSpawned: true,
    runtimeMetricsMeasured: true,
    cleanup: {
      allCleaned: cleanupFailures.length === 0,
      failureCount: cleanupFailures.length,
      failures: cleanupFailures.map((item) => ({
        root: item.root || '',
        error: item.error || 'cleanup failed',
      })),
    },
    environment: {
      valid: environmentValid,
      failedSideCount: failedSides.length,
      degradedReadinessCount: degradedReadiness.length,
      invalidReasonCodes: [
        missingRequiredCaseIds.length ? 'missing-required-cases' : '',
        cleanupFailures.length ? 'cleanup-failed' : '',
        degradedReadiness.length ? 'degraded-readiness' : '',
        failedSides.length ? 'case-side-failed' : '',
      ].filter(Boolean),
    },
    pass: environmentValid && compareSummary.pass === true,
    verdict: environmentValid ? compareSummary.verdict : 'invalid-environment',
    trustVerdict: environmentValid
      ? (compareSummary.trustFailureCount > 0 ? 'fail' : (compareSummary.pass ? 'pass' : 'ambiguous'))
      : 'invalid',
  };
}

function writeAlivenessCompareArtifact({
  outputPath,
  artifact,
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

async function runAlivenessLiveIsolatedCompare({
  outputPath = LIVE_OUTPUT_PATH,
  generatedAt = new Date().toISOString(),
  cases = buildAlivenessLiveCaseSpecs(),
} = {}) {
  ensureDir(OUTPUT_DIR);
  const startedAt = generatedAt;
  const lmStudio = await createMockLmStudioServer();
  try {
    const compareCases = [];
    for (const spec of cases) {
      compareCases.push(await runLivePair(spec, lmStudio));
    }
    const finishedAt = new Date().toISOString();
    const summary = buildAlivenessLivePairSummary(compareCases);
    const artifact = {
      schema: ALIVENESS_COMPARE_SCHEMA,
      fixtureSchema: ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
      artifactKind: ALIVENESS_COMPARE_LIVE_ARTIFACT_KIND,
      generatedAt,
      startedAt,
      finishedAt,
      modes: REQUIRED_ALIVENESS_COMPARE_MODES,
      featureToggleMatrix: buildAlivenessFeatureToggleMatrix(),
      measurementMode: LIVE_ISOLATED_MODE,
      runnerMode: 'live-isolated-mock-route',
      liveModelCalls: true,
      liveModelCallBackend: 'mock-lmstudio',
      realUserModelCalls: false,
      liveUserMemoryTouched: false,
      serverSpawned: true,
      lmStudioCalls: true,
      promptTruthExpanded: false,
      promptTruthChannelAdded: false,
      toolEvidenceReceiptChanged: false,
      memoryWrites: 'disposable-only',
      autonomousActions: false,
      configuredModels: {
        chat: CHAT_MODEL,
        tool: TOOL_MODEL,
        embed: EMBED_MODEL,
        staticProvider: STATIC_PROVIDER,
      },
      preparation: lmStudio.preparation || null,
      cases: compareCases,
      summary,
      metrics: {
        ...summary.metrics,
        measurementStatus: summary.environment.valid ? 'measured' : 'invalid',
        liveLatencyMeasured: true,
        livePromptTokensMeasured: true,
      },
      limits: [
        'A5 live-isolated mode spawns disposable Penny servers and a mock LM Studio backend.',
        'No real local Penny memory, archive, embedding, ledger, open-loop, initiative, or books state is touched.',
        'Runtime artifacts are captured from the real /api/penny/chat route for each baseline/feature pair.',
        'PromptTruth and toolEvidenceReceipt stay unchanged.',
        'A passing isolated compare is evidence for opt-in review, not default feature enablement.',
      ],
    };
    const written = writeAlivenessCompareArtifact({ outputPath, artifact });
    return written;
  } finally {
    await lmStudio.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseAlivenessCompareArgs(argv);
  if (args.liveIsolated) {
    const result = await runAlivenessLiveIsolatedCompare({ outputPath: args.outputPath });
    console.log(`Aliveness live isolated compare complete: ${result.outputPath}`);
    console.log(JSON.stringify({
      measurementMode: result.artifact.measurementMode,
      verdict: result.artifact.summary.verdict,
      trustVerdict: result.artifact.summary.trustVerdict,
      humanObservableWins: result.artifact.summary.humanObservableWins,
      continuityWins: result.artifact.summary.continuityWins,
      overclaimRegressions: result.artifact.summary.overclaimRegressions,
      annoyanceRegressions: result.artifact.summary.annoyanceRegressions,
      cleanup: result.artifact.summary.cleanup,
      environment: result.artifact.summary.environment,
    }, null, 2));
    return result;
  }
  if (!args.fixture || args.mode !== 'fixture') {
    throw new Error('Aliveness compare runner supports --fixture or --live-isolated.');
  }
  const generatedAt = new Date().toISOString();
  const artifact = buildAlivenessCompareFixtureArtifact({ generatedAt });
  const result = writeAlivenessCompareFixtureArtifact({
    outputPath: args.outputPath,
    artifact,
  });
  console.log(`Aliveness compare fixture complete: ${result.outputPath}`);
  console.log(JSON.stringify(result.artifact.summary, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
  ALIVENESS_COMPARE_LIVE_ARTIFACT_KIND,
  LIVE_ISOLATED_MODE,
  analyzeLiveCaseResponse,
  buildAlivenessCompareFixtureArtifact,
  buildAlivenessLiveCaseSpecs,
  buildAlivenessLivePairSummary,
  buildDisposableStatePaths,
  buildFixtureCompareCase,
  buildAlivenessFeatureToggleMatrix,
  buildMockAlivenessReply,
  buildOpenLoopStateFixture,
  getAlivenessFeatureToggleFlags,
  hasArgFlag,
  main,
  parseAlivenessCompareArgs,
  parseArgValue,
  runAlivenessLiveIsolatedCompare,
  seedDisposableState,
  writeAlivenessCompareFixtureArtifact,
  writeAlivenessCompareArtifact,
};
