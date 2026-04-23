const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { URL } = require('url');
const { createAutomationApi } = require('./penny-lmstudio-prepare');
const {
  SOURCE_SENSITIVE_MEMORY_CASES,
  SOURCE_SENSITIVE_OUTCOMES,
  buildSourceSensitiveMemoryQaFixture,
  classifySourceSensitiveMemoryOutcome,
} = require('../lib/penny-context-pressure-qa');
const {
  CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
  CANDIDATE_SURVIVAL_FIXTURE_CASES,
  applyPromptTruthToCandidateTrace,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildEmbeddingProviderComparison,
  buildCandidateSurvivalProfileComparison,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
} = require('../lib/penny-candidate-survival-qa');
const {
  STATIC_SHADOW_EMBED_PROVIDER,
  createStaticShadowEmbeddingProvider,
  normalizeShadowEmbedProvider,
} = require('../lib/penny-static-shadow-embeddings');
const {
  createMemoryArchiveApi,
  normalizeArchiveScoringProfile,
  normalizeRerankShadowProvider,
} = require('../lib/penny-memory-archive');
const { buildPromptMemoryContext } = require('../lib/penny-memory');
const { buildQaTrace, validateQaTrace } = require('../lib/penny-qa-trace');
const { buildQaTrust, validateRuntimeArtifact } = require('../lib/penny-qa-trust');
const { buildQaEnvironmentValidity } = require('../lib/penny-qa-validity');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const SPAWN_SERVER = process.env.PENNY_QA_SPAWN_SERVER !== '0';
const PORT = Number(process.env.PENNY_QA_MEMORY_PORT || (SPAWN_SERVER ? 4348 : 4317));
const BASE_URL = process.env.PENNY_QA_MEMORY_BASE_URL || `http://127.0.0.1:${PORT}`;
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_QA_GENERAL_TIMEOUT_MS || 420000);
const SMOKE_CHAT_TIMEOUT_MS = Number(process.env.PENNY_QA_SMOKE_CHAT_TIMEOUT_MS || 120000);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_QA_MEMORY_MAX_OUTPUT_TOKENS || process.env.PENNY_QA_MAX_OUTPUT_TOKENS || 320);
const QA_CHAT_CONTEXT_LENGTH = Number(process.env.PENNY_QA_CHAT_CONTEXT_LENGTH || 6144);
const QA_MODEL_TTL_SECONDS = Number(process.env.PENNY_QA_MODEL_TTL_SECONDS || 1800);
const DEFAULT_QA_STATIC_EMBED_PROVIDER = 'model2vec-potion-8m';
const DEFAULT_QA_STATIC_EMBED_INDEX_SCOPE = 'session,archive,research-ledger';
const DEFAULT_QA_STATIC_EMBED_MAX_CANDIDATES = 12;
const DEFAULT_QA_STATIC_EMBED_BATCH_SIZE = 16;
const DEFAULT_QA_CHAT_MODEL = 'unsloth/gemma-4-31b-it@q6_k';
const DEFAULT_QA_TOOL_MODEL = 'google/gemma-4-e4b';
const CHAT_MODEL = String(process.env.PENNY_QA_CHAT_MODEL || DEFAULT_QA_CHAT_MODEL).trim();
const TOOL_MODEL = String(process.env.PENNY_QA_TOOL_MODEL || process.env.PENNY_LMSTUDIO_TOOL_MODEL || DEFAULT_QA_TOOL_MODEL).trim();
const EMBED_MODEL = String(process.env.PENNY_QA_EMBED_MODEL || process.env.PENNY_LMSTUDIO_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return (Array.isArray(argv) ? argv : []).some((value) => String(value || '').trim() === dashed);
}

function resolveMemoryQaModelManagementMode(env = process.env, argv = process.argv.slice(2)) {
  const envText = (name, fallback = '') => String(env[name] ?? fallback).trim();
  const strictNoModelOps = envText('PENNY_QA_STRICT_NO_MODEL_OPS') === '1'
    || hasArgFlag('strict-no-model-ops', argv)
    || hasArgFlag('no-model-ops', argv);
  const manageModels = !strictNoModelOps && envText('PENNY_QA_MANAGE_MODELS', '1') !== '0';
  return {
    strictNoModelOps,
    manageModels,
    loadChatModel: manageModels && envText('PENNY_QA_LOAD_CHAT_MODEL', '1') !== '0',
    loadEmbedModel: manageModels && envText('PENNY_QA_LOAD_EMBED_MODEL', '1') !== '0',
    prepareReportOnly: !manageModels,
    repairPreset: manageModels,
    loadStrategy: strictNoModelOps
      ? 'strict-no-model-ops'
      : (manageModels ? 'sequential-lane-switch' : 'preloaded-no-model-management'),
  };
}

const QA_MODEL_MANAGEMENT = resolveMemoryQaModelManagementMode(process.env);
const QA_LOAD_CHAT_MODEL = QA_MODEL_MANAGEMENT.loadChatModel;
const QA_LOAD_EMBED_MODEL = QA_MODEL_MANAGEMENT.loadEmbedModel;
const MEMORY_QA_SEGMENT_IDS = Object.freeze({
  SEMANTIC_ARCHIVE: 'semantic-archive',
  CHAPTER_FALLBACK: 'chapter-fallback',
  CONTRADICTION_PREMISE: 'contradiction-premise',
  MIXED_DRIFT: 'mixed-drift',
});
const MEMORY_QA_SEGMENT_ORDER = Object.freeze([
  MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE,
  MEMORY_QA_SEGMENT_IDS.CHAPTER_FALLBACK,
  MEMORY_QA_SEGMENT_IDS.CONTRADICTION_PREMISE,
  MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT,
]);

function parseMemoryQaArgs(argv = process.argv.slice(2)) {
  let smokeMode = process.env.PENNY_QA_MEMORY_SMOKE === '1';
  let segmentId = '';
  let combinedMode = false;
  let judgedMode = false;
  let sourceSensitiveFixtureMode = process.env.PENNY_QA_MEMORY_SOURCE_SENSITIVE_FIXTURE === '1';
  let candidateSurvivalFixtureMode = process.env.PENNY_QA_MEMORY_CANDIDATE_SURVIVAL_FIXTURE === '1';
  let candidateSurvivalArchiveUnitMode = process.env.PENNY_QA_MEMORY_CANDIDATE_SURVIVAL_ARCHIVE_UNIT === '1';
  let shadowEmbedProvider = normalizeShadowEmbedProvider(process.env.PENNY_EMBED_SHADOW_PROVIDER || '');
  let rerankShadowProvider = normalizeRerankShadowProvider(process.env.PENNY_RERANK_SHADOW_PROVIDER || 'fixture-reranker');

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) continue;
    if (arg === '--candidate-survival-fixture') {
      candidateSurvivalFixtureMode = true;
      continue;
    }
    if (arg === '--candidate-survival-archive-unit') {
      candidateSurvivalArchiveUnitMode = true;
      continue;
    }
    if (arg === '--shadow-embed-provider') {
      const normalizedProvider = normalizeShadowEmbedProvider(argv[index + 1] || '');
      if (!normalizedProvider) {
        throw new Error('Unknown shadow embed provider. Expected: static');
      }
      shadowEmbedProvider = normalizedProvider;
      index += 1;
      continue;
    }
    if (arg.startsWith('--shadow-embed-provider=')) {
      const normalizedProvider = normalizeShadowEmbedProvider(arg.slice('--shadow-embed-provider='.length));
      if (!normalizedProvider) {
        throw new Error('Unknown shadow embed provider. Expected: static');
      }
      shadowEmbedProvider = normalizedProvider;
      continue;
    }
    if (arg === '--rerank-shadow-provider') {
      rerankShadowProvider = normalizeRerankShadowProvider(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--rerank-shadow-provider=')) {
      rerankShadowProvider = normalizeRerankShadowProvider(arg.slice('--rerank-shadow-provider='.length));
      continue;
    }
    if (arg === '--source-sensitive-fixture' || arg === '--source-sensitive') {
      sourceSensitiveFixtureMode = true;
      continue;
    }
    if (arg === '--smoke') {
      smokeMode = true;
      continue;
    }
    if (arg === '--combined') {
      combinedMode = true;
      continue;
    }
    if (arg === '--judged') {
      judgedMode = true;
      continue;
    }
    if (arg === '--segment') {
      segmentId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg.startsWith('--segment=')) {
      segmentId = arg.slice('--segment='.length).trim();
    }
  }

  if (smokeMode && segmentId) {
    throw new Error('Memory QA cannot combine --smoke with --segment.');
  }
  if (smokeMode && combinedMode) {
    throw new Error('Memory QA cannot combine --smoke with --combined.');
  }
  if (judgedMode && smokeMode) {
    throw new Error('Memory QA cannot combine --judged with --smoke.');
  }
  if (judgedMode && segmentId) {
    throw new Error('Memory QA cannot combine --judged with --segment.');
  }
  if (judgedMode && combinedMode) {
    throw new Error('Memory QA cannot combine --judged with --combined.');
  }
  if (sourceSensitiveFixtureMode && (smokeMode || segmentId || combinedMode || judgedMode)) {
    throw new Error('Memory QA cannot combine --source-sensitive-fixture with live QA modes.');
  }
  if (candidateSurvivalFixtureMode && candidateSurvivalArchiveUnitMode) {
    throw new Error('Memory QA cannot combine --candidate-survival-fixture with --candidate-survival-archive-unit.');
  }
  if (candidateSurvivalFixtureMode && (smokeMode || segmentId || combinedMode || judgedMode || sourceSensitiveFixtureMode)) {
    throw new Error('Memory QA cannot combine --candidate-survival-fixture with other memory QA modes.');
  }
  if (candidateSurvivalArchiveUnitMode && (smokeMode || segmentId || combinedMode || judgedMode || sourceSensitiveFixtureMode)) {
    throw new Error('Memory QA cannot combine --candidate-survival-archive-unit with live or fixture memory QA modes.');
  }
  if (segmentId && !MEMORY_QA_SEGMENT_ORDER.includes(segmentId)) {
    throw new Error(`Unknown memory QA segment "${segmentId}". Expected one of: ${MEMORY_QA_SEGMENT_ORDER.join(', ')}`);
  }
  if (!smokeMode && !segmentId && !judgedMode && !sourceSensitiveFixtureMode && !candidateSurvivalFixtureMode && !candidateSurvivalArchiveUnitMode) {
    combinedMode = true;
  }

  let runMode = 'combined';
  let runLabel = segmentId || 'combined';
  if (candidateSurvivalArchiveUnitMode) {
    runMode = 'candidate-survival-archive-unit';
    runLabel = 'candidate-survival-archive-unit';
  } else if (candidateSurvivalFixtureMode) {
    runMode = 'candidate-survival-fixture';
    runLabel = 'candidate-survival-fixture';
  } else if (sourceSensitiveFixtureMode) {
    runMode = 'source-sensitive-fixture';
    runLabel = 'source-sensitive';
  } else if (smokeMode) {
    runMode = 'smoke';
    runLabel = 'smoke';
  } else if (judgedMode) {
    runMode = 'judged';
    runLabel = 'judged';
  } else if (segmentId) {
    runMode = 'segment';
    runLabel = segmentId;
  }

  return {
    smokeMode,
    segmentId,
    combinedMode,
    judgedMode,
    sourceSensitiveFixtureMode,
    candidateSurvivalFixtureMode,
    candidateSurvivalArchiveUnitMode,
    shadowEmbedProvider,
    rerankShadowProvider,
    runMode,
    runLabel,
  };
}

const MEMORY_QA_ARGS = parseMemoryQaArgs(process.argv.slice(2));
const SMOKE_MODE = MEMORY_QA_ARGS.smokeMode;
const OUTPUT_PATH = path.join(OUTPUT_DIR, `memory-qa-${MEMORY_QA_ARGS.runLabel}-${STAMP}.json`);

const SEMANTIC_TURNS = [
  'At the neighborhood arcade, the busted prize counter still smelled like lemon cleaner.',
  'The clerk kept a chipped moon mug beside the register and tapped it when she was thinking.',
  'I dropped a red glove under the skee-ball lane and pretended not to notice.',
  'The old jackpot board kept flickering the number 72.',
  'My change got stuffed into a blue ticket envelope.',
  'Somebody had scratched ORBIT into the metal token tray.',
  'The photo booth curtain was missing two silver hooks.',
  'The pinball corner still hummed louder than the rest of the room.',
  'I left with lemon-cleaner smell on my jacket cuff.',
  'The claw machine nearest the exit was full of fake strawberries.',
];

const CONTRADICTION_TURNS = [
  'Remember this exactly: my coding mascot is a brass fox, and the notebook beside it is teal.',
  'One short sentence only: the coffee shop behind the office smells like cinnamon and rain.',
  'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
  'One short sentence only: the printer just made a sound like a tiny accordion.',
];

const OBFUSCATED_PROMPT_TURNS = [
  'Remember this exactly: my desk mascot when I am coding is a brass fox.',
  'Correction: my desk mascot when I am coding is a copper rabbit now, not a brass fox.',
  'One short sentence only: the backup mug near the monitor is orange.',
];

const PREMISE_DRIFT_TURNS = [
  'Remember this exactly: my favorite tea is oolong.',
  'One short sentence only: the laundromat fan rattled like a loose vent.',
  'Correction: my favorite tea is lapsang souchong now, not oolong.',
  'One short sentence only: the cashier tapped the register with two rings on.',
];

const EARLY_ROUTING_FAILURE_TELLS = [
  'decode',
  'decoding',
  'cipher',
  'puzzle',
  'step by step',
];

const MIXED_DRIFT_TURNS = [
  'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
  'My second anchor detail: I kept a green cassette case in my coat pocket.',
  'My third anchor detail: the blue ticket envelope stayed on the kitchen table.',
  'My fourth anchor detail: the red glove was still under the skee-ball lane.',
  'Correction: the cashier\'s watch is gold now, not silver.',
  'The laundromat fan rattled every few seconds like a loose vent.',
  'The back wall speaker in the arcade kept hissing between songs.',
  'The receipt from earlier was tucked into the green cassette case.',
  'A neon sticker on the prize counter said ORBIT in block letters.',
  'The floor near dryer three smelled faintly like mint detergent.',
  'A cracked moon mug sat beside the register for the whole hour.',
  'The coin changer kept blinking the number 14 like it was stuck.',
  'The photo booth curtain was missing two silver hooks.',
  'The comic books were stacked under a folding chair near the wall.',
  'The cashier tapped the gold watch when thinking about the total.',
  'The paper cup with lipstick on the rim moved to the sink.',
  'The brass fox sketch was now a copper rabbit on my notes page.',
  'The claw machine near the exit was full of fake strawberries.',
  'The shoe rack by the door had one missing red lace.',
  'The change envelope with blue edges ended up in my jacket.',
];

const FALLBACK_TURNS = [
  'At the midnight laundromat, table five was piled with comic books.',
  'I balanced a silver thermos on top of dryer three.',
  'The cashier had a sunflower bandana tied around her wrist.',
  'Somebody had taped a crooked cat sticker onto the soap machine.',
  'One sock with neon green stripes got stranded behind a plastic chair.',
  'The coin changer kept blinking the number 14.',
  'A paper cup with lipstick on the rim was sitting near the folding table.',
  'The back wall fan rattled every few seconds like a loose vent.',
  'I used the cracked blue basket with one bent handle.',
  'The floor near dryer three smelled faintly like mint detergent.',
];

const SMOKE_FALLBACK_TURNS = FALLBACK_TURNS.slice(0, 6);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundSeconds(ms) {
  return Math.round((ms / 1000) * 100) / 100;
}

function stripMoodTag(text = '') {
  return String(text || '').replace(/\s*\[MOOD:[a-z]+\]\s*$/i, '').trim();
}

function lower(text = '') {
  return String(text || '').toLowerCase();
}

function normalizeNeedleVariants(needle) {
  const variants = Array.isArray(needle) ? needle : [needle];
  return variants
    .map((value) => normalizeForComparison(value))
    .filter(Boolean);
}

function countNeedleHits(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  return needles.filter((needle) => {
    const variants = normalizeNeedleVariants(needle);
    return variants.some((variant) => hay.includes(variant));
  }).length;
}

function scoreNeedles(text = '', needles = []) {
  if (!needles.length) return 0;
  return countNeedleHits(text, needles) / needles.length;
}

function findFirstNeedleIndex(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  let best = -1;
  for (const needle of needles) {
    for (const variant of normalizeNeedleVariants(needle)) {
      const index = hay.indexOf(variant);
      if (index >= 0 && (best < 0 || index < best)) best = index;
    }
  }
  return best;
}

function findNeedleIndexes(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  const indexes = [];
  for (const needle of needles) {
    for (const variant of normalizeNeedleVariants(needle)) {
      const index = hay.indexOf(variant);
      if (index >= 0) indexes.push({ index, variant });
    }
  }
  return indexes;
}

function normalizeForComparison(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/\[mood:[a-z]+\]/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  return needles.some((needle) => hay.includes(normalizeForComparison(needle)));
}

function isHistoricalContrastMention(hay = '', expectedIndex = -1, forbiddenIndex = -1) {
  if (expectedIndex < 0 || forbiddenIndex < 0 || expectedIndex >= forbiddenIndex) return false;
  const before = hay.slice(Math.max(0, forbiddenIndex - 80), forbiddenIndex);
  const after = hay.slice(forbiddenIndex, Math.min(hay.length, forbiddenIndex + 80));
  const bridge = hay.slice(expectedIndex, forbiddenIndex);
  return /\b(not|no longer|old|former|previous|used to|instead|rather than|replaced|sneak|back|upgraded)\b/.test(before)
    || /\b(not|no longer|old|former|previous|used to|instead|rather than|replaced|sneak|back|upgraded)\b/.test(bridge)
    || /\b(old|former|previous|back|replaced|upgraded)\b/.test(after);
}

function scoreTruthReplacement(text = '', expectedNeedles = [], forbiddenNeedles = []) {
  const expectedScore = scoreNeedles(text, expectedNeedles);
  if (expectedScore < 1) return 0;
  const forbiddenIndexes = findNeedleIndexes(text, forbiddenNeedles);
  if (!forbiddenIndexes.length) return 1;
  const expectedIndex = findFirstNeedleIndex(text, expectedNeedles);
  const hay = normalizeForComparison(text);
  const allForbiddenMentionsAreContrast = forbiddenIndexes.every((item) => (
    isHistoricalContrastMention(hay, expectedIndex, item.index)
  ));
  return allForbiddenMentionsAreContrast ? 1 : 0;
}

function canonicalAuthorityPressureSatisfied(artifact = null) {
  const authorityPressure = artifact?.modelAdvisory?.authorityPressure && typeof artifact.modelAdvisory.authorityPressure === 'object'
    ? artifact.modelAdvisory.authorityPressure
    : {};
  const promptTruth = artifact?.promptTruth && typeof artifact.promptTruth === 'object'
    ? artifact.promptTruth
    : (artifact?.modelAdvisory?.promptTruth && typeof artifact.modelAdvisory.promptTruth === 'object'
      ? artifact.modelAdvisory.promptTruth
      : {});
  const sessionArchive = promptTruth?.channels?.sessionArchive && typeof promptTruth.channels.sessionArchive === 'object'
    ? promptTruth.channels.sessionArchive
    : {};
  const globalArchive = promptTruth?.channels?.globalArchive && typeof promptTruth.channels.globalArchive === 'object'
    ? promptTruth.channels.globalArchive
    : {};
  const researchLedger = promptTruth?.channels?.researchLedger && typeof promptTruth.channels.researchLedger === 'object'
    ? promptTruth.channels.researchLedger
    : {};
  const advisoryCandidates = Number(sessionArchive.candidateCount || 0)
    + Number(globalArchive.candidateCount || 0)
    + Number(researchLedger.candidateCount || 0);
  return authorityPressure.canonicalFactsPresent === true
    && authorityPressure.canonicalOverrideActive === true
    && Number(sessionArchive.candidateCount || 0) >= 1
    && advisoryCandidates >= 1
    && [sessionArchive, globalArchive, researchLedger]
      .some((channel) => String(channel.heldBackReason || '').trim() === 'canon-priority-suppression');
}

function artifactReasoningMode(artifact = null) {
  const mode = String(artifact?.modelAdvisory?.reasoningPolicy?.mode || '').trim();
  if (mode) return mode;
  const executionPath = String(artifact?.executionPath || artifact?.context?.executionPath || artifact?.trace?.laneChoice?.executionPath || '').trim();
  if (executionPath === 'deterministic-tool') return 'verifier-first';
  const latencyClass = String(artifact?.performance?.latencyClass || artifact?.modelAdvisory?.approximatePath?.latencyClass || '').trim();
  if (latencyClass === 'memory-heavy-recall') return 'deliberate';
  if (latencyClass === 'tool-heavy') return 'verifier-first';
  if (latencyClass === 'image-heavy') return 'attachment-bounded';
  return 'minimal';
}

function artifactDriftReason(artifact = null) {
  const approximatePath = artifact?.modelAdvisory?.approximatePath && typeof artifact.modelAdvisory.approximatePath === 'object'
    ? artifact.modelAdvisory.approximatePath
    : {};
  const reasons = Array.isArray(approximatePath.reasons) ? approximatePath.reasons.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const reasoningMode = artifactReasoningMode(artifact);
  const retrievalReason = String(artifact?.performance?.archiveRetrieval?.reasonCode || '').trim();
  if (reasons.includes('lane-fallback')) return 'lane-fallback';
  if (reasons.includes('runtime-fallback')) return 'runtime-fallback';
  if (approximatePath.semanticDowngrade === true) {
    return reasons.find((item) => /semantic/i.test(item)) || 'semantic-downgrade';
  }
  if (reasoningMode === 'deliberate' && reasons.includes('semantic-query-held-back')) return 'semantic-query-held-back';
  if (reasoningMode === 'deliberate' && retrievalReason === 'keyword_fallback' && artifact?.context?.semanticMemoryReady === true) {
    return 'keyword_fallback';
  }
  return '';
}

function buildArtifactDriftCanary(artifact = null, turnLabel = 'current-turn') {
  const firstDriftReason = artifactDriftReason(artifact);
  return {
    firstDriftReason,
    firstDriftTurn: firstDriftReason ? String(turnLabel || 'current-turn').trim() || 'current-turn' : '',
    fixationDetected: false,
    fixationRepeatCount: 0,
    recoveredAfterDrift: false,
  };
}

function collectScenarioArtifactTimeline(value, pathLabel = '', results = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return results;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectScenarioArtifactTimeline(item, `${pathLabel}[${index}]`, results, seen);
    });
    return results;
  }
  if (value?.meta?.artifact && typeof value.meta.artifact === 'object') {
    results.push({
      label: pathLabel || 'turn',
      artifact: value.meta.artifact,
    });
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'meta') continue;
    const nextLabel = pathLabel ? `${pathLabel}.${key}` : key;
    collectScenarioArtifactTimeline(item, nextLabel, results, seen);
  }
  return results;
}

function buildScenarioDriftCanary(scenario = {}) {
  const timeline = collectScenarioArtifactTimeline(scenario);
  const driftReasons = timeline.map((entry) => artifactDriftReason(entry.artifact));
  const firstIndex = driftReasons.findIndex(Boolean);
  if (firstIndex === -1) {
    return {
      firstDriftReason: '',
      firstDriftTurn: '',
      fixationDetected: false,
      fixationRepeatCount: 0,
      recoveredAfterDrift: false,
    };
  }
  const firstDriftReason = driftReasons[firstIndex];
  let fixationRepeatCount = 0;
  for (let index = firstIndex + 1; index < driftReasons.length; index += 1) {
    if (driftReasons[index] !== firstDriftReason) break;
    fixationRepeatCount += 1;
  }
  const recoveredAfterDrift = driftReasons.slice(firstIndex + fixationRepeatCount + 1).some((reason) => !reason);
  return {
    firstDriftReason,
    firstDriftTurn: timeline[firstIndex]?.label || 'turn',
    fixationDetected: fixationRepeatCount > 0,
    fixationRepeatCount,
    recoveredAfterDrift,
  };
}

function buildArtifactWitnessTrace(artifact = null, inspector = null) {
  const modelAdvisory = artifact?.modelAdvisory && typeof artifact.modelAdvisory === 'object'
    ? artifact.modelAdvisory
    : {};
  const cleanup = modelAdvisory.cleanup && typeof modelAdvisory.cleanup === 'object'
    ? modelAdvisory.cleanup
    : {};
  const cleanupTransform = modelAdvisory.cleanupTransform && typeof modelAdvisory.cleanupTransform === 'object'
    ? modelAdvisory.cleanupTransform
    : {};
  const approximatePath = modelAdvisory.approximatePath && typeof modelAdvisory.approximatePath === 'object'
    ? modelAdvisory.approximatePath
    : {};
  const promptComposition = modelAdvisory.promptComposition && typeof modelAdvisory.promptComposition === 'object'
    ? modelAdvisory.promptComposition
    : {};
  const advisoryMerge = modelAdvisory.advisoryMerge && typeof modelAdvisory.advisoryMerge === 'object'
    ? modelAdvisory.advisoryMerge
    : {};
  const reasoningPolicy = modelAdvisory.reasoningPolicy && typeof modelAdvisory.reasoningPolicy === 'object'
    ? modelAdvisory.reasoningPolicy
    : {};
  const promptTruth = artifact?.promptTruth && typeof artifact.promptTruth === 'object'
    ? artifact.promptTruth
    : (modelAdvisory.promptTruth && typeof modelAdvisory.promptTruth === 'object' ? modelAdvisory.promptTruth : {});
  const backgroundVectorization = inspector?.embeddings?.backgroundVectorization && typeof inspector.embeddings.backgroundVectorization === 'object'
    ? inspector.embeddings.backgroundVectorization
    : {};
  return {
    cleanup: {
      reasonCode: String(cleanup.reasonCode || 'none').trim() || 'none',
      cleanupApplied: cleanup.cleanupApplied === true,
      reconstructedReply: cleanup.reconstructedReply === true,
      transformClass: String(cleanupTransform.class || 'pass-through').trim() || 'pass-through',
      transformMateriality: String(cleanupTransform.materiality || 'none').trim() || 'none',
      operations: Array.isArray(cleanupTransform.operations) ? cleanupTransform.operations.slice(0, 6) : [],
    },
    approximatePath: {
      status: String(approximatePath.status || 'exact').trim() || 'exact',
      policyMode: String(approximatePath.policyMode || '').trim(),
      degraded: approximatePath.degraded === true,
      reasons: Array.isArray(approximatePath.reasons) ? approximatePath.reasons.slice(0, 6) : [],
    },
    reasoningPolicy: {
      mode: String(reasoningPolicy.mode || artifactReasoningMode(artifact)).trim() || 'minimal',
      sourceLatencyClass: String(reasoningPolicy.sourceLatencyClass || artifact?.performance?.latencyClass || '').trim(),
      executionPreference: String(reasoningPolicy.executionPreference || '').trim(),
      verifierUsed: reasoningPolicy.verifierUsed === true,
      shortCircuitApplied: reasoningPolicy.shortCircuitApplied === true,
      shortCircuitReason: String(reasoningPolicy.shortCircuitReason || '').trim(),
      reasonCodes: Array.isArray(reasoningPolicy.reasonCodes) ? reasoningPolicy.reasonCodes.slice(0, 6) : [],
    },
    driftCanaries: buildArtifactDriftCanary(artifact),
    promptComposition: {
      lane: String(promptComposition.lane || '').trim(),
      mode: String(promptComposition.mode || '').trim(),
      filledSlotCount: Number(promptComposition.filledSlotCount || 0),
      heldBackSlotCount: Number(promptComposition.heldBackSlotCount || 0),
      noOpSlotCount: Number(promptComposition.noOpSlotCount || 0),
      slots: Array.isArray(promptComposition.slots)
        ? promptComposition.slots
            .filter((slot) => slot && slot.eligible)
            .slice(0, 6)
            .map((slot) => `${slot.id}:${slot.state}`)
        : [],
    },
    promptTruth: {
      canonicalFactsPresent: promptTruth.canonicalFactsPresent === true,
      canonicalOverrideActive: promptTruth.canonicalOverrideActive === true,
      sessionArchive: {
        candidateCount: Number(promptTruth?.channels?.sessionArchive?.candidateCount || 0),
        renderedCount: Number(promptTruth?.channels?.sessionArchive?.renderedCount || 0),
        heldBackReason: String(promptTruth?.channels?.sessionArchive?.heldBackReason || '').trim(),
      },
      globalArchive: {
        candidateCount: Number(promptTruth?.channels?.globalArchive?.candidateCount || 0),
        renderedCount: Number(promptTruth?.channels?.globalArchive?.renderedCount || 0),
        heldBackReason: String(promptTruth?.channels?.globalArchive?.heldBackReason || '').trim(),
      },
      researchLedger: {
        candidateCount: Number(promptTruth?.channels?.researchLedger?.candidateCount || 0),
        renderedCount: Number(promptTruth?.channels?.researchLedger?.renderedCount || 0),
        heldBackReason: String(promptTruth?.channels?.researchLedger?.heldBackReason || '').trim(),
      },
    },
    advisoryMerge: {
      advisoryItems: Number(advisoryMerge.advisoryItems || 0),
      lossyItems: Number(advisoryMerge.lossyItems || 0),
      reviewGatedItems: Number(advisoryMerge.reviewGatedItems || 0),
      mergeBasis: Array.isArray(advisoryMerge.mergeBasis) ? advisoryMerge.mergeBasis.slice(0, 6) : [],
      discardedDetailSummary: Array.isArray(advisoryMerge.discardedDetailSummary) ? advisoryMerge.discardedDetailSummary.slice(0, 4) : [],
    },
    backgroundVectorization: {
      status: String(backgroundVectorization.status || '').trim() || 'disabled',
      eagerCreatedCount: Number(backgroundVectorization.eagerCreatedCount || 0),
      backgroundCandidateCount: Number(backgroundVectorization.backgroundCandidateCount ?? backgroundVectorization.selectedCount ?? 0),
      backgroundCreatedCount: Number(backgroundVectorization.backgroundCreatedCount ?? backgroundVectorization.createdCount ?? 0),
    },
  };
}

function collectSeconds(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + collectSeconds(item), 0);
  }
  if (value && typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds;
  }
  return 0;
}

function removeFileIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function hasEnvValue(env = {}, name = '') {
  return Object.prototype.hasOwnProperty.call(env || {}, name)
    && String(env[name] ?? '').trim() !== '';
}

function pickQaEnvValue(env = {}, qaName = '', runtimeName = '', fallback = '') {
  if (qaName && hasEnvValue(env, qaName)) return String(env[qaName]).trim();
  if (runtimeName && hasEnvValue(env, runtimeName)) return String(env[runtimeName]).trim();
  return String(fallback ?? '').trim();
}

function normalizeQaStaticEmbedMode(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'advisory', 'live-advisory'].includes(text)) return 'live-advisory';
  if (['shadow', 'live-shadow'].includes(text)) return 'live-shadow';
  return 'off';
}

function normalizePositiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number <= 0) return Math.max(1, Math.round(Number(fallback) || 1));
  return number;
}

function normalizeNonNegativeInteger(value, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 0) return Math.max(0, Math.round(Number(fallback) || 0));
  return number;
}

function resolveMemoryQaStaticEmbeddingConfig(env = process.env, {
  rootDir = ROOT_DIR,
  stamp = STAMP,
  defaultCacheFile = '',
} = {}) {
  const mode = normalizeQaStaticEmbedMode(pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_MODE', 'PENNY_STATIC_EMBED_MODE', 'off'));
  const enabled = mode !== 'off';
  const maxStaticOnlyRenderedFallback = mode === 'live-advisory' ? 1 : 0;
  const rawCacheFile = hasEnvValue(env, 'PENNY_QA_STATIC_EMBED_CACHE_FILE')
    ? String(env.PENNY_QA_STATIC_EMBED_CACHE_FILE).trim()
    : '';
  const cacheFile = enabled
    ? path.resolve(rootDir, rawCacheFile || defaultCacheFile || `data/penny-memory-embeddings.static.memory-qa-${stamp}.json`)
    : '';
  return {
    schema: 'penny-memory-qa-static-embedding-config.v1',
    enabled,
    mode,
    provider: pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_PROVIDER', 'PENNY_STATIC_EMBED_PROVIDER', DEFAULT_QA_STATIC_EMBED_PROVIDER),
    indexScope: pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_INDEX_SCOPE', 'PENNY_STATIC_EMBED_INDEX_SCOPE', DEFAULT_QA_STATIC_EMBED_INDEX_SCOPE),
    maxCandidates: normalizePositiveInteger(
      pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_MAX_CANDIDATES', 'PENNY_STATIC_EMBED_MAX_CANDIDATES', DEFAULT_QA_STATIC_EMBED_MAX_CANDIDATES),
      DEFAULT_QA_STATIC_EMBED_MAX_CANDIDATES,
    ),
    maxStaticOnlyRendered: normalizeNonNegativeInteger(
      pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED', 'PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED', maxStaticOnlyRenderedFallback),
      maxStaticOnlyRenderedFallback,
    ),
    batchSize: normalizePositiveInteger(
      pickQaEnvValue(env, 'PENNY_QA_STATIC_EMBED_BATCH_SIZE', 'PENNY_STATIC_EMBED_BATCH_SIZE', DEFAULT_QA_STATIC_EMBED_BATCH_SIZE),
      DEFAULT_QA_STATIC_EMBED_BATCH_SIZE,
    ),
    cacheFile,
    ownsCacheFile: enabled && !rawCacheFile,
  };
}

function buildStaticEmbeddingServerEnv(config = {}) {
  const enabled = config?.enabled === true;
  return {
    PENNY_STATIC_EMBED_MODE: enabled ? String(config.mode || 'off') : 'off',
    PENNY_STATIC_EMBED_PROVIDER: String(config.provider || DEFAULT_QA_STATIC_EMBED_PROVIDER),
    PENNY_STATIC_EMBED_INDEX_SCOPE: String(config.indexScope || DEFAULT_QA_STATIC_EMBED_INDEX_SCOPE),
    PENNY_STATIC_EMBED_MAX_CANDIDATES: String(config.maxCandidates || DEFAULT_QA_STATIC_EMBED_MAX_CANDIDATES),
    PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: String(enabled ? config.maxStaticOnlyRendered || 0 : 0),
    PENNY_STATIC_EMBED_BATCH_SIZE: String(config.batchSize || DEFAULT_QA_STATIC_EMBED_BATCH_SIZE),
    PENNY_STATIC_EMBED_CACHE_FILE: enabled ? String(config.cacheFile || '') : '',
  };
}

function buildSuitePaths(slug) {
  return {
    memoryFile: path.join(ROOT_DIR, 'data', `penny-memory.${slug}.${STAMP}.json`),
    archiveFile: path.join(ROOT_DIR, 'data', `penny-memory-archive.${slug}.${STAMP}.json`),
    embeddingsFile: path.join(ROOT_DIR, 'data', `penny-memory-embeddings.${slug}.${STAMP}.json`),
    staticEmbeddingsFile: path.join(ROOT_DIR, 'data', `penny-memory-embeddings.static.${slug}.${STAMP}.json`),
    ledgerFile: path.join(ROOT_DIR, 'data', `penny-memory-ledger.${slug}.${STAMP}.json`),
    openLoopFile: path.join(ROOT_DIR, 'data', `penny-open-loops.${slug}.${STAMP}.json`),
    stdoutPath: path.join(OUTPUT_DIR, `memory-qa-${slug}-${STAMP}.server.out.log`),
    stderrPath: path.join(OUTPUT_DIR, `memory-qa-${slug}-${STAMP}.server.err.log`),
  };
}

function writeJsonFile(filePath, value, fsImpl = fs) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  fsImpl.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildCandidateSurvivalArchiveUnitPaths({
  outputDir = OUTPUT_DIR,
  stamp = STAMP,
} = {}) {
  const disposableRoot = path.join(outputDir, `memory-qa-candidate-survival-archive-unit-${stamp}-state`);
  return {
    disposableRoot,
    outputPath: path.join(outputDir, `memory-qa-candidate-survival-archive-unit-${stamp}.json`),
    memoryFile: path.join(disposableRoot, 'penny-memory.json'),
    archiveFile: path.join(disposableRoot, 'penny-memory-archive.json'),
    embeddingsFile: path.join(disposableRoot, 'penny-memory-embeddings.json'),
    shadowEmbeddingsFile: path.join(disposableRoot, 'penny-memory-embeddings.static-shadow.json'),
    booksFile: path.join(disposableRoot, 'penny-memory-books.json'),
    ledgerFile: path.join(disposableRoot, 'penny-memory-ledger.json'),
    openLoopFile: path.join(disposableRoot, 'penny-open-loops.json'),
  };
}

function cleanupCandidateSurvivalArchiveUnitFiles(paths = {}, fsImpl = fs) {
  const fileEntries = [
    ['explicitMemoryFile', paths.memoryFile],
    ['archiveFile', paths.archiveFile],
    ['embeddingsFile', paths.embeddingsFile],
    ['shadowEmbeddingsFile', paths.shadowEmbeddingsFile],
    ['booksFile', paths.booksFile],
    ['ledgerFile', paths.ledgerFile],
    ['openLoopFile', paths.openLoopFile],
  ].map(([label, filePath]) => {
    const existedBeforeCleanup = Boolean(filePath && fsImpl.existsSync(filePath));
    if (existedBeforeCleanup) {
      try {
        fsImpl.unlinkSync(filePath);
      } catch {}
    }
    return {
      label,
      path: filePath || '',
      existedBeforeCleanup,
      existsAfterCleanup: Boolean(filePath && fsImpl.existsSync(filePath)),
    };
  });
  if (paths.disposableRoot && fsImpl.existsSync(paths.disposableRoot) && typeof fsImpl.rmSync === 'function') {
    try {
      fsImpl.rmSync(paths.disposableRoot, { recursive: true, force: true });
    } catch {}
  }
  const disposableRootExistsAfterCleanup = Boolean(paths.disposableRoot && fsImpl.existsSync(paths.disposableRoot));
  return {
    attempted: true,
    disposableRoot: paths.disposableRoot || '',
    disposableRootExistsAfterCleanup,
    allRemoved: fileEntries.every((item) => item.existsAfterCleanup === false) && !disposableRootExistsAfterCleanup,
    files: fileEntries,
  };
}

function seedCandidateSurvivalArchiveUnitStores({
  api,
  paths,
  seedPlan,
  fsImpl = fs,
} = {}) {
  if (!api || typeof api.buildArchiveStore !== 'function') {
    throw new TypeError('seedCandidateSurvivalArchiveUnitStores requires archive api.');
  }
  const archive = api.buildArchiveStore();
  archive.sessions = { ...seedPlan.archiveSessions };
  writeJsonFile(paths.memoryFile, seedPlan.explicitMemory, fsImpl);
  writeJsonFile(paths.booksFile, seedPlan.memoryBooks, fsImpl);
  writeJsonFile(paths.ledgerFile, seedPlan.researchLedger, fsImpl);
  api.writeArchiveStore(archive);
  api.writeEmbeddingsStore(api.buildEmbeddingsStore(), { replace: true });
}

async function runCandidateSurvivalArchiveUnitQa({
  outputDir = OUTPUT_DIR,
  outputPath = '',
  stamp = STAMP,
  generatedAt = new Date().toISOString(),
  fsImpl = fs,
  pathImpl = path,
  fetchImpl = null,
  nowMs = null,
  archiveScoringProfile = process.env.PENNY_ARCHIVE_SCORING_PROFILE || 'baseline',
  primaryEmbedModel = EMBED_MODEL,
  shadowEmbedProvider = normalizeShadowEmbedProvider(process.env.PENNY_EMBED_SHADOW_PROVIDER || ''),
  rerankShadowProvider = normalizeRerankShadowProvider(process.env.PENNY_RERANK_SHADOW_PROVIDER || 'fixture-reranker'),
} = {}) {
  fsImpl.mkdirSync(outputDir, { recursive: true });
  const paths = buildCandidateSurvivalArchiveUnitPaths({ outputDir, stamp });
  const artifactPath = outputPath || paths.outputPath;
  const fixedNowMs = Number.isFinite(Number(nowMs))
    ? () => Number(nowMs)
    : (() => {
        const parsed = Date.parse(generatedAt);
        return () => (Number.isFinite(parsed) ? parsed : Date.now());
      })();
  const seedPlan = buildCandidateSurvivalArchiveUnitSeedPlan({ generatedAt });
  const activeScoringProfile = normalizeArchiveScoringProfile(archiveScoringProfile);
  const activeShadowProvider = normalizeShadowEmbedProvider(shadowEmbedProvider);
  const activeRerankShadowProvider = normalizeRerankShadowProvider(rerankShadowProvider);
  const api = createMemoryArchiveApi({
    fs: fsImpl,
    path: pathImpl,
    fetch: typeof fetchImpl === 'function'
      ? fetchImpl
      : (async () => {
          throw new Error('Archive-unit candidate survival must not call LM Studio embeddings.');
        }),
    ARCHIVE_FILE: paths.archiveFile,
    EMBEDDINGS_FILE: paths.embeddingsFile,
    LMSTUDIO_BASE: 'http://127.0.0.1:0/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    PENNY_LMSTUDIO_EMBED_MODEL: primaryEmbedModel,
    PENNY_ARCHIVE_SCORING_PROFILE: activeScoringProfile,
    PENNY_RERANK_SHADOW_PROVIDER: activeRerankShadowProvider,
    ENABLE_BACKGROUND_CHAT_VECTORS: false,
    BACKGROUND_CHAT_VECTOR_BATCH_LIMIT: 0,
    nowMs: fixedNowMs,
  });

  let cleanup = {
    attempted: false,
    disposableRoot: paths.disposableRoot,
    disposableRootExistsAfterCleanup: null,
    allRemoved: false,
    files: [],
  };
  const caseResults = [];
  let embeddingProviderComparison = null;
  async function buildArchiveUnitProfileResult({
    archiveApi,
    caseLike,
    sessionId,
    sessionOptions,
    profile,
  }) {
    const retrievalResult = await archiveApi.buildArchiveContext({
      sessionId,
      userText: caseLike.query,
      lane: 'chat',
      now: fixedNowMs(),
      allowSemanticQuery: true,
      allowArchiveCompression: true,
      includeCandidateTrace: true,
      includeCandidateTraceLinks: true,
      candidateTraceLimit: CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
      candidateTraceLinkLimit: 6,
      scoringProfile: profile,
      includeRerankShadow: true,
      rerankShadowProvider: activeRerankShadowProvider,
      rerankShadowInputTopK: CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
      ...sessionOptions,
    });
    const promptMemoryContext = buildPromptMemoryContext({
      memories: seedPlan.explicitMemory.memories,
      archiveContext: retrievalResult.archiveContext,
      memoryBookContext: { matches: [] },
      researchLedgerContext: { topics: [] },
      researchLedgerPromptEnabled: false,
    }, caseLike.query);
    return {
      retrievalResult,
      promptTruth: promptMemoryContext.promptTruth,
      trace: applyPromptTruthToCandidateTrace(
        retrievalResult?.retrieval?.candidateTrace || [],
        promptMemoryContext.promptTruth,
      ),
    };
  }
  try {
    seedCandidateSurvivalArchiveUnitStores({ api, paths, seedPlan, fsImpl });
    for (const caseLike of CANDIDATE_SURVIVAL_FIXTURE_CASES) {
      const sessionId = seedPlan.sessionIds[caseLike.id] || `qa-candidate-survival-${caseLike.id}`;
      const sessionOptions = seedPlan.sessionOptions[caseLike.id] || {};
      const baselineResult = await buildArchiveUnitProfileResult({
        archiveApi: api,
        caseLike,
        sessionId,
        sessionOptions,
        profile: 'baseline',
      });
      const hybridResult = await buildArchiveUnitProfileResult({
        archiveApi: api,
        caseLike,
        sessionId,
        sessionOptions,
        profile: 'hybrid-v1',
      });
      const activeResult = activeScoringProfile === 'hybrid-v1' ? hybridResult : baselineResult;
      const profileComparison = buildCandidateSurvivalProfileComparison(caseLike, {
        baselineTrace: baselineResult.trace,
        hybridV1Trace: hybridResult.trace,
      });
      caseResults.push(buildCandidateSurvivalArchiveUnitCaseResult({
        caseLike,
        retrievalResult: activeResult.retrievalResult,
        promptTruth: activeResult.promptTruth,
        profileComparison,
      }));
    }
    if (activeShadowProvider === STATIC_SHADOW_EMBED_PROVIDER) {
      const staticProvider = createStaticShadowEmbeddingProvider();
      const shadowApi = createMemoryArchiveApi({
        fs: fsImpl,
        path: pathImpl,
        fetch: staticProvider.fetch,
        ARCHIVE_FILE: paths.archiveFile,
        EMBEDDINGS_FILE: paths.shadowEmbeddingsFile,
        LMSTUDIO_BASE: 'http://127.0.0.1:0/v1',
        LMSTUDIO_API_KEY: 'static-shadow-local',
        PENNY_LMSTUDIO_EMBED_MODEL: staticProvider.model,
        PENNY_ARCHIVE_SCORING_PROFILE: activeScoringProfile,
        PENNY_RERANK_SHADOW_PROVIDER: activeRerankShadowProvider,
        ENABLE_BACKGROUND_CHAT_VECTORS: false,
        BACKGROUND_CHAT_VECTOR_BATCH_LIMIT: 0,
        getLmStudioConnectionStatus: staticProvider.getLmStudioConnectionStatus,
        nowMs: fixedNowMs,
      });
      shadowApi.writeEmbeddingsStore(shadowApi.buildEmbeddingsStore(staticProvider.model), { replace: true });
      const shadowCaseResults = [];
      const started = process.hrtime.bigint();
      for (const caseLike of CANDIDATE_SURVIVAL_FIXTURE_CASES) {
        const sessionId = seedPlan.sessionIds[caseLike.id] || `qa-candidate-survival-${caseLike.id}`;
        const sessionOptions = seedPlan.sessionOptions[caseLike.id] || {};
        const shadowResult = await buildArchiveUnitProfileResult({
          archiveApi: shadowApi,
          caseLike,
          sessionId,
          sessionOptions,
          profile: activeScoringProfile,
        });
        shadowCaseResults.push(buildCandidateSurvivalArchiveUnitCaseResult({
          caseLike,
          retrievalResult: shadowResult.retrievalResult,
          promptTruth: shadowResult.promptTruth,
          traceLike: shadowResult.trace,
        }));
      }
      const cpuMs = Number(process.hrtime.bigint() - started) / 1000000;
      embeddingProviderComparison = buildEmbeddingProviderComparison({
        primary: {
          provider: 'primary',
          model: api.configuredEmbedModel,
          retrievalMode: 'keyword',
        },
        primaryCases: caseResults,
        shadow: {
          provider: staticProvider.provider,
          model: staticProvider.model,
          retrievalMode: 'semantic-shadow',
          cpuMs,
        },
        shadowCases: shadowCaseResults,
      });
    }
  } finally {
    cleanup = cleanupCandidateSurvivalArchiveUnitFiles(paths, fsImpl);
  }

  const filePaths = {
    explicitMemoryFile: paths.memoryFile,
    archiveFile: paths.archiveFile,
    embeddingsFile: paths.embeddingsFile,
    ...(activeShadowProvider ? { shadowEmbeddingsFile: paths.shadowEmbeddingsFile } : {}),
    booksFile: paths.booksFile,
    ledgerFile: paths.ledgerFile,
    openLoopFile: paths.openLoopFile,
    disposableRoot: paths.disposableRoot,
  };
  const artifact = buildCandidateSurvivalArchiveUnitArtifact({
    generatedAt,
    cases: caseResults,
    filePaths,
    cleanup,
    candidateTraceLimit: CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
    embeddingProviderComparison,
  });
  writeJsonFile(artifactPath, artifact, fsImpl);
  return {
    outputPath: artifactPath,
    artifact,
    paths,
  };
}

function fetchJson(url, options = {}, timeoutMs = GENERAL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const body = typeof options.body === 'string' ? options.body : '';
    const headers = {
      ...(options.headers || {}),
    };
    if (body && !headers['Content-Length'] && !headers['content-length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${raw.slice(0, 400)}`));
            return;
          }
        }
        if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
          const error = new Error(data?.detail || data?.error || `HTTP ${res.statusCode}`);
          error.status = res.statusCode;
          error.data = data;
          reject(error);
          return;
        }
        resolve(data);
      });
      res.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Client timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServerReady(baseUrl, timeoutMs = 120000) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    try {
      const status = await fetchJson(`${baseUrl}/api/penny/status`, {}, 15000);
      if (status?.ok) return status;
    } catch {}
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for Penny server at ${baseUrl}`);
}

function resolveChatRequestTimeoutMs(timeoutMs = null, { smokeMode = SMOKE_MODE } = {}) {
  if (Number.isFinite(timeoutMs) && Number(timeoutMs) > 0) return Number(timeoutMs);
  return smokeMode ? SMOKE_CHAT_TIMEOUT_MS : GENERAL_TIMEOUT_MS;
}

function buildMemoryPayload() {
  return { userName: '', voiceOn: false, brainMode: 'local' };
}

async function chatRequest(baseUrl, sessionId, prompt, timeoutMs = null) {
  const started = Date.now();
  try {
    const effectiveTimeoutMs = resolveChatRequestTimeoutMs(timeoutMs);
    const data = await fetchJson(`${baseUrl}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages: [{ role: 'user', content: prompt }],
        memories: buildMemoryPayload(),
      }),
    }, effectiveTimeoutMs);
    validateRuntimeArtifact(data?.meta?.artifact, {
      label: 'chat response artifact',
      minEvidence: 1,
      minSideEffects: 1,
    });
    return {
      ok: true,
      seconds: roundSeconds(Date.now() - started),
      prompt,
      text: data.text || '',
      bareText: stripMoodTag(data.text || ''),
      memory: data.memory || null,
      meta: data.meta || {},
    };
  } catch (error) {
    return {
      ok: false,
      seconds: roundSeconds(Date.now() - started),
      prompt,
      error: error?.message || 'Unknown error',
      meta: error?.data?.meta || {},
    };
  }
}

async function getInspector(baseUrl, sessionId) {
  const data = await fetchJson(`${baseUrl}/api/penny/memory/inspector?sessionId=${encodeURIComponent(sessionId)}`, {}, 30000);
  validateRuntimeArtifact(data?.inspector?.artifact, {
    label: 'inspector artifact',
    minEvidence: 1,
    minSideEffects: 1,
  });
  return data;
}

async function getMemory(baseUrl, sessionId) {
  return fetchJson(`${baseUrl}/api/penny/memory?sessionId=${encodeURIComponent(sessionId)}`, {}, 30000);
}

async function patchMemory(baseUrl, sessionId, patch) {
  return fetchJson(`${baseUrl}/api/penny/memory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, patch }),
  }, 30000);
}

async function purgeMemory(baseUrl, sessionId, options = {}) {
  return fetchJson(`${baseUrl}/api/penny/memory/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...options }),
  }, 30000);
}

async function execFileText(command, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT_DIR, timeout: timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function createServerProcess({ suiteSlug, suitePaths, embedModel }) {
  ensureDir(OUTPUT_DIR);
  ensureDir(path.dirname(suitePaths.memoryFile));
  removeFileIfExists(suitePaths.memoryFile);
  removeFileIfExists(suitePaths.archiveFile);
  removeFileIfExists(suitePaths.embeddingsFile);
  removeFileIfExists(suitePaths.staticEmbeddingsFile);
  removeFileIfExists(suitePaths.ledgerFile);
  removeFileIfExists(suitePaths.openLoopFile);
  const outStream = fs.createWriteStream(suitePaths.stdoutPath, { flags: 'w' });
  const errStream = fs.createWriteStream(suitePaths.stderrPath, { flags: 'w' });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: buildQaServerEnv({ suiteSlug, suitePaths, embedModel }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);
  child.once('exit', () => {
    outStream.end();
    errStream.end();
  });
  return child;
}

function buildQaServerEnv({ suiteSlug, suitePaths, embedModel, env = process.env }) {
  const staticEmbedding = resolveMemoryQaStaticEmbeddingConfig(env, {
    rootDir: ROOT_DIR,
    stamp: STAMP,
    defaultCacheFile: suitePaths.staticEmbeddingsFile,
  });
  return {
    ...env,
    PORT: String(PORT),
    PENNY_MEMORY_FILE: suitePaths.memoryFile,
    PENNY_MEMORY_ARCHIVE_FILE: suitePaths.archiveFile,
    PENNY_MEMORY_EMBEDDINGS_FILE: suitePaths.embeddingsFile,
    PENNY_MEMORY_LEDGER_FILE: suitePaths.ledgerFile,
    PENNY_OPEN_LOOP_FILE: suitePaths.openLoopFile,
    PENNY_OPENCLAW_ENABLED: '0',
    // Keep judged memory QA stateless so long suites do not inherit hidden LM Studio thread state.
    PENNY_LOCAL_LLM_TRANSPORT: 'chat',
    PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
    PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
    PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: embedModel,
    PENNY_ARCHIVE_SCORING_PROFILE: env.PENNY_ARCHIVE_SCORING_PROFILE || 'baseline',
    ...buildStaticEmbeddingServerEnv(staticEmbedding),
    PENNY_QA_SUITE: suiteSlug,
  };
}

async function stopServerProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill();
  const started = Date.now();
  while (child.exitCode === null && (Date.now() - started) < 5000) {
    await sleep(200);
  }
  if (child.exitCode === null) {
    try {
      await execFileText('taskkill', ['/PID', String(child.pid), '/T', '/F'], 15000);
    } catch {}
  }
}

async function runShortTermExplicit(baseUrl) {
  const sessionId = 'qa-memory-short-explicit';
  const capture = await chatRequest(baseUrl, sessionId, 'Remember this exactly for later: when I am coding, the tiny brass fox sits to the left of my keyboard and the backup mug is orange.');
  const filler = await chatRequest(baseUrl, sessionId, 'One short sentence only: I am stalling because I do not want to answer email.');
  const recall = await chatRequest(baseUrl, sessionId, 'Quick check: what sits to the left of my keyboard when I am coding, and what color is the backup mug?');
  const savedMemoryTexts = Array.isArray(recall.memory?.memories) ? recall.memory.memories.map((item) => item.text) : [];
  const recallScore = scoreNeedles(recall.text, ['brass fox', 'orange']);
  return {
    name: 'short_term_explicit_pair',
    sessionId,
    ok: capture.ok && filler.ok && recall.ok && recallScore >= 1,
    capture,
    filler,
    recall,
    recallScore,
    savedMemoryTexts,
  };
}

async function runShortTermConversational(baseUrl) {
  const sessionId = 'qa-memory-short-live';
  const first = await chatRequest(baseUrl, sessionId, 'Keep your reply to one sentence: I tucked the repair-shop receipt into a green cassette case so I would not lose it.');
  const second = await chatRequest(baseUrl, sessionId, 'Keep your reply to one sentence: the vending machine still owes me two quarters and I am petty about it.');
  const memoryBeforeRecall = await getMemory(baseUrl, sessionId);
  const recall = await chatRequest(baseUrl, sessionId, 'Quick, what did I tuck the repair-shop receipt into?');
  const recallScore = scoreNeedles(recall.text, ['green cassette case']);
  return {
    name: 'short_term_conversational_live',
    sessionId,
    ok: first.ok && second.ok && recall.ok && recallScore >= 1,
    first,
    second,
    recall,
    recallScore,
    lmStudioThreadPresent: Boolean(memoryBeforeRecall?.memory?.lmStudioThread),
  };
}

async function runContradictionScenario(baseUrl) {
  const sessionId = 'qa-memory-contradiction';
  const capture = await chatRequest(baseUrl, sessionId, CONTRADICTION_TURNS[0]);
  const filler = await chatRequest(baseUrl, sessionId, CONTRADICTION_TURNS[1]);
  const correction = await chatRequest(baseUrl, sessionId, CONTRADICTION_TURNS[2]);
  const aftershock = await chatRequest(baseUrl, sessionId, CONTRADICTION_TURNS[3]);
  const memoryAfterCorrection = await getMemory(baseUrl, sessionId);
  const savedMemoryTexts = memoryItemTexts(memoryAfterCorrection);
  const currentTruth = await chatRequest(baseUrl, sessionId, 'Now answer exactly: what is my coding mascot now?');
  const priorTruth = await chatRequest(baseUrl, sessionId, 'Before I corrected you, what was my coding mascot?');
  const currentTruthScore = scoreTruthReplacement(currentTruth.text, ['copper rabbit'], ['brass fox']);
  const priorTruthScore = scoreNeedles(priorTruth.text, ['brass fox']);
  const correctionSeen = containsAny(correction.text, ['copper rabbit', 'bunny']) && containsAny(currentTruth.text, ['copper rabbit']);
  const correctionPersisted = savedMemoryTexts.some((text) => /coding mascot is a copper rabbit now, not a brass fox/i.test(text))
    && !savedMemoryTexts.some((text) => /coding mascot is a brass fox\b/i.test(text));
  return {
    name: 'contradiction_recall_flip',
    sessionId,
    ok: capture.ok
      && filler.ok
      && correction.ok
      && aftershock.ok
      && currentTruth.ok
      && priorTruth.ok
      && currentTruthScore >= 1
      && priorTruthScore >= 0.5
      && correctionPersisted,
    capture,
    filler,
    correction,
    aftershock,
    memoryAfterCorrection,
    savedMemoryTexts,
    currentTruth,
    priorTruth,
    currentTruthScore,
    priorTruthScore,
    correctionSeen,
    correctionPersisted,
  };
}

async function runObfuscatedPromptScenario(baseUrl) {
  const sessionId = 'qa-memory-obfuscated-routing';
  const capture = await chatRequest(baseUrl, sessionId, OBFUSCATED_PROMPT_TURNS[0]);
  const correction = await chatRequest(baseUrl, sessionId, OBFUSCATED_PROMPT_TURNS[1]);
  const filler = await chatRequest(baseUrl, sessionId, OBFUSCATED_PROMPT_TURNS[2]);
  const obfuscatedRecall = await chatRequest(
    baseUrl,
    sessionId,
    'Not a puzzle and not a cipher game. Read this ugly shorthand as a normal recall question and answer directly in one sentence: d3sk-m4sc0t n0w? old=brass-fox ; corrected=?',
  );
  const truthScore = scoreTruthReplacement(obfuscatedRecall.text, ['copper rabbit'], ['brass fox']);
  const routeStayedGrounded = !containsAny(obfuscatedRecall.text, EARLY_ROUTING_FAILURE_TELLS);
  return {
    name: 'obfuscated_prompt_route_stability',
    sessionId,
    ok: capture.ok && correction.ok && filler.ok && obfuscatedRecall.ok && truthScore >= 1 && routeStayedGrounded,
    capture,
    correction,
    filler,
    obfuscatedRecall,
    truthScore,
    routeStayedGrounded,
    forbiddenRoutingTells: EARLY_ROUTING_FAILURE_TELLS,
  };
}

async function runPremiseDriftScenario(baseUrl) {
  const sessionId = 'qa-memory-premise-drift';
  const seedTurns = [];
  for (const turn of PREMISE_DRIFT_TURNS) {
    const result = await chatRequest(baseUrl, sessionId, turn);
    seedTurns.push(result);
    if (!result.ok) {
      return {
        name: 'session_level_premise_drift',
        sessionId,
        ok: false,
        seedTurns,
        recall: { ok: false, error: 'Seed turn failed.' },
        truthScore: 0,
        correctedPremise: false,
      };
    }
  }
  const recall = await chatRequest(baseUrl, sessionId, 'Since my favorite tea is oolong, tell me what tea I like now.');
  const inspector = await getInspector(baseUrl, sessionId);
  const truthScore = scoreTruthReplacement(
    recall.text,
    [[
      'lapsang souchong',
      'like lapsang souchong',
      'tea is lapsang souchong',
      'pivoted to lapsang souchong',
      'switched to lapsang souchong',
    ]],
    [[
      'favorite tea is oolong',
      'tea is oolong now',
      'you like oolong now',
      'oolong now',
    ]],
  );
  const correctedPremise = truthScore >= 1;
  const artifact = recall?.meta?.artifact || {};
  const witnessTrace = buildArtifactWitnessTrace(recall?.meta?.artifact, inspector?.inspector);
  return {
    name: 'session_level_premise_drift',
    sessionId,
    ok: seedTurns.every((item) => item.ok) && recall.ok && truthScore >= 1 && correctedPremise,
    seedTurns,
    recall,
    inspector,
    truthScore,
    correctedPremise,
    witnessTrace,
    epistemicSignals: Array.isArray(artifact?.epistemics?.signals) ? artifact.epistemics.signals : [],
  };
}

async function runMixedTopicDriftScenario(baseUrl) {
  const sessionId = 'qa-memory-mixed-drift';
  const seedTurns = [];
  const intro = await chatRequest(baseUrl, sessionId, 'Keep your replies to one sentence max while I feed you a long run of mixed memories.');
  seedTurns.push(intro);
  for (const turn of MIXED_DRIFT_TURNS.slice(0, 10)) {
    const result = await chatRequest(baseUrl, sessionId, turn);
    seedTurns.push(result);
    if (!result.ok) break;
  }
  const checkpointOne = await chatRequest(baseUrl, sessionId, 'Checkpoint: what color was the watch after I corrected it, and where did I keep the green cassette case?');
  for (const turn of MIXED_DRIFT_TURNS.slice(10)) {
    const result = await chatRequest(baseUrl, sessionId, turn);
    seedTurns.push(result);
    if (!result.ok) break;
  }
  const checkpointTwo = await chatRequest(baseUrl, sessionId, 'Final check: what number was blinking on the coin changer, and what was the thing on my desk that replaced the brass fox?');
  const checkpointOneScore = scoreNeedles(checkpointOne.text, ['gold watch', 'green cassette case']);
  const checkpointTwoScore = scoreNeedles(checkpointTwo.text, ['14', 'copper rabbit']);
  return {
    name: 'mixed_topic_drift_long_session',
    sessionId,
    ok: seedTurns.every((item) => item.ok) && checkpointOne.ok && checkpointTwo.ok && checkpointOneScore >= 0.5 && checkpointTwoScore >= 0.5,
    seedTurns,
    checkpointOne,
    checkpointTwo,
    checkpointOneScore,
    checkpointTwoScore,
    turnCount: seedTurns.length,
  };
}

async function runLongArchiveScenario(baseUrl, {
  name,
  sessionId,
  turns,
  recallPrompt,
  expectedNeedles,
  expectSemanticReady,
  expectCompression,
}) {
  const seedTurns = [];
  const intro = await chatRequest(baseUrl, sessionId, 'Tiny format request: for the next few messages, keep your replies to one sentence max while I ramble.');
  seedTurns.push(intro);
  if (!intro.ok) {
    return {
      name,
      sessionId,
      ok: false,
      seedTurns,
      recall: { ok: false, error: 'Intro turn failed.' },
      recallScore: 0,
      expectedNeedles,
    };
  }
  for (const turn of turns) {
    const result = await chatRequest(baseUrl, sessionId, turn);
    seedTurns.push(result);
    if (!result.ok) break;
  }
  const inspectorBefore = await getInspector(baseUrl, sessionId);
  const memoryBeforeClear = await getMemory(baseUrl, sessionId);
  await patchMemory(baseUrl, sessionId, { lmStudioThread: null });
  const memoryAfterClear = await getMemory(baseUrl, sessionId);
  const recall = await chatRequest(baseUrl, sessionId, recallPrompt);
  const inspectorAfter = await getInspector(baseUrl, sessionId);
  const archiveInspector = inspectorAfter?.inspector?.archive || {};
  const sessionArchive = archiveInspector?.session || {};
  const retrieval = sessionArchive?.lastRetrieval || {};
  const recallScore = scoreNeedles(recall.text, expectedNeedles);
  const chapterCount = Number(sessionArchive?.chapterCount || 0);
  const usedCompression = retrieval?.compression?.used === true;
  const semanticReady = inspectorAfter?.inspector?.embeddings?.semanticMemory?.ready === true;
  const usedRetrieval = (Array.isArray(retrieval?.session) && retrieval.session.length > 0)
    || (Array.isArray(retrieval?.global) && retrieval.global.length > 0)
    || usedCompression;
  const semanticExpectationMet = expectSemanticReady ? semanticReady : !semanticReady;
  const compressionExpectationMet = expectCompression ? usedCompression : true;
  const witnessTrace = buildArtifactWitnessTrace(recall?.meta?.artifact, inspectorAfter?.inspector);
  return {
    name,
    sessionId,
    ok: seedTurns.every((item) => item.ok) && recall.ok && recallScore >= 0.5 && chapterCount >= 1 && usedRetrieval && semanticExpectationMet && compressionExpectationMet,
    seedTurns,
    recall,
    recallScore,
    expectedNeedles,
    inspectorBefore,
    inspectorAfter,
    chapterCount,
    retrievalMode: retrieval?.mode || '',
    usedCompression,
    semanticReady,
    witnessTrace,
    memoryThreadBeforeClear: Boolean(memoryBeforeClear?.memory?.lmStudioThread),
    memoryThreadCleared: !memoryAfterClear?.memory?.lmStudioThread,
  };
}

function buildScenarioGroupSummary(scenarios = []) {
  const groups = {};
  for (const scenario of Array.isArray(scenarios) ? scenarios : []) {
    const group = String(scenario?.group || '').trim() || 'ungrouped';
    if (!groups[group]) {
      groups[group] = {
        total: 0,
        completed: 0,
        failed: 0,
        invalid: 0,
        seconds: 0,
      };
    }
    const bucket = groups[group];
    bucket.total += 1;
    if (scenario?.ok === true) {
      bucket.completed += 1;
    } else if (scenario?.ok === false) {
      bucket.failed += 1;
    } else {
      bucket.invalid += 1;
    }
    bucket.seconds = Math.round((bucket.seconds + collectSeconds(scenario)) * 100) / 100;
  }
  return groups;
}

function memoryItemTexts(memoryResponse = null) {
  const memory = memoryResponse?.memory || memoryResponse?.inspector?.memory || memoryResponse || {};
  if (!Array.isArray(memory?.memories)) return [];
  return memory.memories.map((item) => String(item?.text || '').trim()).filter(Boolean);
}

async function runJudgedWriteExplicitScenario(baseUrl) {
  return {
    ...(await runShortTermExplicit(baseUrl)),
    group: 'write',
    name: 'judged_write_explicit',
  };
}

async function runJudgedWriteCorrectionScenario(baseUrl) {
  return {
    ...(await runContradictionScenario(baseUrl)),
    group: 'write',
    name: 'judged_write_correction',
  };
}

async function runJudgedWriteReviewCandidateScenario(baseUrl) {
  const sessionId = 'qa-memory-judged-review-candidate';
  const capture = await chatRequest(baseUrl, sessionId, 'I am into rainy cyberpunk vibes.');
  const filler = await chatRequest(baseUrl, sessionId, 'One short sentence only: the kettle rattled twice before it boiled.');
  const memoryAfterCapture = await getMemory(baseUrl, sessionId);
  const inspectorAfter = await getInspector(baseUrl, sessionId);
  const storedTexts = memoryItemTexts(memoryAfterCapture);
  const queueItems = Array.isArray(inspectorAfter?.inspector?.archive?.global?.promotionQueue)
    ? inspectorAfter.inspector.archive.global.promotionQueue
    : [];
  const queueMatch = queueItems.some((item) => String(item?.sourceType || '').trim() === 'review-candidate'
    || /rainy cyberpunk vibes/i.test(String(item?.text || ''))
    || /rainy cyberpunk vibes/i.test(String(item?.evidenceSnippet || '')));
  const explicitStayedClean = !storedTexts.some((text) => /rainy cyberpunk vibes/i.test(text));
  return {
    name: 'judged_write_review_candidate',
    sessionId,
    group: 'write',
    ok: capture.ok && filler.ok && queueMatch && explicitStayedClean,
    capture,
    filler,
    memoryAfterCapture,
    inspectorAfter,
    queueMatch,
    explicitStayedClean,
  };
}

async function runJudgedRetrieveSemanticArchiveScenario(baseUrl) {
  return {
    ...(await runLongArchiveScenario(baseUrl, {
      name: 'judged_retrieve_semantic_archive',
      sessionId: 'qa-memory-judged-semantic',
      turns: SEMANTIC_TURNS,
      recallPrompt: 'Long-memory check: what color glove did I drop under the skee-ball lane, and what kind of mug sat beside the register?',
      expectedNeedles: ['red glove', 'moon mug'],
      expectSemanticReady: true,
      expectCompression: false,
    })),
    group: 'retrieve',
  };
}

async function runJudgedRetrieveChapterFallbackScenario(baseUrl) {
  return {
    ...(await runLongArchiveScenario(baseUrl, {
      name: 'judged_retrieve_chapter_fallback',
      sessionId: 'qa-memory-judged-fallback',
      turns: FALLBACK_TURNS,
      recallPrompt: 'Tell me what you remember about the laundromat: what was sitting on dryer three, and what was tied around the cashier\'s wrist?',
      expectedNeedles: ['silver thermos', 'sunflower bandana'],
      expectSemanticReady: false,
      expectCompression: true,
    })),
    group: 'retrieve',
  };
}

async function runJudgedRetrieveCanonOverAdvisoryScenario(baseUrl) {
  const sessionId = 'qa-memory-judged-canon-over-advisory';
  const staleCapture = await chatRequest(baseUrl, sessionId, 'Remember this exactly for later: my coding notebook stays on the right side of the keyboard.');
  const filler = await chatRequest(baseUrl, sessionId, 'One short sentence only: the desk lamp keeps buzzing like a trapped bee.');
  const canonicalMemory = {
    text: 'My coding notebook stays left of the keyboard.',
    kind: 'personal',
    ts: Date.now(),
  };
  const explicitPatch = await patchMemory(baseUrl, sessionId, {
    memories: [canonicalMemory],
  });
  const memoryAfterPatch = await getMemory(baseUrl, sessionId);
  const inspectorBeforeRecall = await getInspector(baseUrl, sessionId);
  const recall = await chatRequest(baseUrl, sessionId, 'Tell me what you remember about my coding notebook.');
  const recallTruthScore = scoreTruthReplacement(
    recall.text,
    [['left of the keyboard', 'left of your keyboard']],
    ['right side of the keyboard'],
  );
  const explicitTexts = memoryItemTexts(memoryAfterPatch);
  const recentEpisodes = Array.isArray(inspectorBeforeRecall?.inspector?.archive?.session?.recentEpisodes)
    ? inspectorBeforeRecall.inspector.archive.session.recentEpisodes
    : [];
  const archiveHasStaleCue = recentEpisodes.some((item) => /right side of the keyboard/i.test(String(item?.text || item?.userText || '')));
  const explicitStayedCanonical = explicitTexts.some((text) => /coding notebook stays left of the keyboard/i.test(text));
  const staleCueStayedAdvisory = !containsAny(recall.text, ['right side of the keyboard']);
  const authorityPressure = recall?.meta?.artifact?.modelAdvisory?.authorityPressure || {};
  const authorityPressureOk = canonicalAuthorityPressureSatisfied(recall?.meta?.artifact);
  const witnessTrace = buildArtifactWitnessTrace(recall?.meta?.artifact, inspectorBeforeRecall?.inspector);
  return {
    name: 'judged_retrieve_canon_over_advisory',
    sessionId,
    group: 'retrieve',
    ok: staleCapture.ok
      && filler.ok
      && explicitPatch.ok !== false
      && explicitStayedCanonical
      && archiveHasStaleCue
      && recall.ok
      && recallTruthScore >= 1
      && staleCueStayedAdvisory
      && authorityPressureOk,
    staleCapture,
    filler,
    explicitPatch,
    memoryAfterPatch,
    inspectorBeforeRecall,
    recall,
    recallTruthScore,
    archiveHasStaleCue,
    explicitStayedCanonical,
    staleCueStayedAdvisory,
    authorityPressure,
    authorityPressureOk,
    witnessTrace,
  };
}

async function runJudgedForgetScenario(baseUrl) {
  const sessionId = 'qa-memory-judged-forget';
  const anchorMemory = {
    text: 'My coding notebook stays left of the keyboard.',
    kind: 'personal',
    ts: Date.now() - 2000,
  };
  const disposableMemory = {
    text: 'My disposable detail is a mint-green calculator.',
    kind: 'observation',
    ts: Date.now() - 1000,
  };
  const seeded = await patchMemory(baseUrl, sessionId, {
    memories: [anchorMemory, disposableMemory],
  });
  const seededTexts = memoryItemTexts(seeded);
  const beforeRecall = await chatRequest(baseUrl, sessionId, 'What should you remember about my coding setup?');
  const beforeRecallScore = scoreNeedles(beforeRecall.text, [
    ['left of the keyboard', 'left of your keyboard'],
    'mint-green calculator',
  ]);
  const forgetPatch = await patchMemory(baseUrl, sessionId, {
    memories: [anchorMemory],
  });
  const archivePrune = await purgeMemory(baseUrl, sessionId, {
    clearSessionArchive: true,
  });
  const afterMemory = archivePrune?.memory || await getMemory(baseUrl, sessionId);
  const afterTexts = memoryItemTexts(afterMemory);
  const anchorRecall = await chatRequest(baseUrl, sessionId, 'Tell me what you remember about my coding notebook now.');
  const anchorRecallScore = scoreNeedles(anchorRecall.text, [[
    'left of the keyboard',
    'left of your keyboard',
    'to the left of your keyboard',
  ]]);
  const disposableRecall = await chatRequest(baseUrl, sessionId, 'What disposable detail did I mention?');
  const disposableRecallScore = scoreNeedles(disposableRecall.text, ['mint-green calculator']);
  const anchorRetained = afterTexts.some((text) => /coding notebook stays left of the keyboard/i.test(text));
  const disposableRemoved = !afterTexts.some((text) => /mint-green calculator/i.test(text));
  const sessionArchiveCleared = Number(archivePrune?.inspector?.archive?.session?.episodeCount || 0) === 0;
  const witnessTrace = buildArtifactWitnessTrace(anchorRecall?.meta?.artifact, archivePrune?.inspector);
  return {
    name: 'judged_forget_prune',
    sessionId,
    group: 'forget',
    ok: seeded.ok !== false
      && forgetPatch.ok !== false
      && archivePrune.ok !== false
      && anchorRetained
      && disposableRemoved
      && sessionArchiveCleared
      && beforeRecall.ok
      && beforeRecallScore >= 1
      && anchorRecall.ok
      && anchorRecallScore >= 1
      && disposableRecall.ok
      && disposableRecallScore === 0,
    seeded,
    seededTexts,
    beforeRecall,
    beforeRecallScore,
    forgetPatch,
    archivePrune,
    afterMemory,
    afterTexts,
    anchorRecall,
    anchorRecallScore,
    disposableRecall,
    disposableRecallScore,
    anchorRetained,
    disposableRemoved,
    sessionArchiveCleared,
    witnessTrace,
  };
}

function buildMemoryQaSegmentConfig(segmentId) {
  switch (segmentId) {
    case MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE:
      return {
        segmentId,
        runLabel: 'semantic-archive',
        memoryStrategy: 'short-term explicit + short-term live + long-term semantic archive',
        embedModel: EMBED_MODEL,
        expectSemanticReady: true,
        expectCompressionFallback: false,
        scenarioFactories: [
          (baseUrl) => runShortTermExplicit(baseUrl),
          (baseUrl) => runShortTermConversational(baseUrl),
          (baseUrl) => runLongArchiveScenario(baseUrl, {
            name: 'long_term_semantic_archive',
            sessionId: 'qa-memory-long-semantic',
            turns: SEMANTIC_TURNS,
            recallPrompt: 'Long-memory check: what color glove did I drop under the skee-ball lane, and what kind of mug sat beside the register?',
            expectedNeedles: ['red glove', 'moon mug'],
            expectSemanticReady: true,
            expectCompression: false,
          }),
        ],
      };
    case MEMORY_QA_SEGMENT_IDS.CHAPTER_FALLBACK:
      return {
        segmentId,
        runLabel: 'chapter-fallback',
        memoryStrategy: 'long-term chapter fallback only',
        embedModel: 'qa-missing-embed-model',
        expectSemanticReady: false,
        expectCompressionFallback: true,
        scenarioFactories: [
          (baseUrl) => runLongArchiveScenario(baseUrl, {
            name: 'long_term_chapter_fallback',
            sessionId: 'qa-memory-long-fallback',
            turns: FALLBACK_TURNS,
            recallPrompt: 'Tell me what you remember about the laundromat: what was sitting on dryer three, and what was tied around the cashier\'s wrist?',
            expectedNeedles: ['silver thermos', 'sunflower bandana'],
            expectSemanticReady: false,
            expectCompression: true,
          }),
        ],
      };
    case MEMORY_QA_SEGMENT_IDS.CONTRADICTION_PREMISE:
      return {
        segmentId,
        runLabel: 'contradiction-premise',
        memoryStrategy: 'contradiction flip + premise drift + obfuscated prompt stability',
        embedModel: EMBED_MODEL,
        expectSemanticReady: true,
        expectCompressionFallback: false,
        scenarioFactories: [
          (baseUrl) => runContradictionScenario(baseUrl),
          (baseUrl) => runPremiseDriftScenario(baseUrl),
          (baseUrl) => runObfuscatedPromptScenario(baseUrl),
        ],
      };
    case MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT:
      return {
        segmentId,
        runLabel: 'mixed-drift',
        memoryStrategy: 'long mixed-session drift only',
        embedModel: EMBED_MODEL,
        expectSemanticReady: true,
        expectCompressionFallback: false,
        scenarioFactories: [
          (baseUrl) => runMixedTopicDriftScenario(baseUrl),
        ],
      };
    default:
      throw new Error(`Unknown memory QA segment "${segmentId}".`);
  }
}

function buildSmokeScenarioSpecs() {
  return [
    {
      id: 'short-term-explicit',
      run: (baseUrl) => runShortTermExplicit(baseUrl),
    },
    {
      id: 'contradiction',
      run: (baseUrl) => runContradictionScenario(baseUrl),
    },
    {
      id: 'premise-drift',
      run: (baseUrl) => runPremiseDriftScenario(baseUrl),
    },
    {
      id: 'chapter-fallback-smoke',
      run: (baseUrl) => runLongArchiveScenario(baseUrl, {
        name: 'long_term_chapter_fallback_smoke',
        sessionId: 'qa-memory-smoke-fallback',
        turns: SMOKE_FALLBACK_TURNS,
        recallPrompt: 'Tell me what you remember about the laundromat: what was sitting on dryer three, and what was tied around the cashier\'s wrist?',
        expectedNeedles: ['silver thermos', 'sunflower bandana'],
        expectSemanticReady: false,
        expectCompression: true,
      }),
    },
  ];
}

async function runSmokeSuite({ embedModel }) {
  const suitePaths = buildSuitePaths('smoke');
  const baseUrl = BASE_URL;
  const suite = {
    name: 'smoke',
    baseUrl,
    files: {
      memoryFile: suitePaths.memoryFile,
      archiveFile: suitePaths.archiveFile,
      embeddingsFile: suitePaths.embeddingsFile,
      staticEmbeddingsFile: suitePaths.staticEmbeddingsFile,
      ledgerFile: suitePaths.ledgerFile,
      openLoopFile: suitePaths.openLoopFile,
      stdout: suitePaths.stdoutPath,
      stderr: suitePaths.stderrPath,
    },
    scenarios: [],
    cleanedFiles: [],
  };
  const server = SPAWN_SERVER ? createServerProcess({ suiteSlug: 'smoke', suitePaths, embedModel }) : null;
  try {
    const status = await waitForServerReady(baseUrl);
    const lmStudio = await fetchJson(`${baseUrl}/api/penny/lmstudio/status`, {}, 20000);
    suite.serverStatus = {
      localTransport: status.localLlmTransport,
      maxOutputTokens: status.maxOutputTokens,
      chatPreferredModel: lmStudio.chatPreferredModel || '',
      toolPreferredModel: lmStudio.toolPreferredModel || '',
      embedPreferredModel: lmStudio.embedPreferredModel || '',
      resolvedModel: lmStudio.resolvedModel || '',
      resolvedChatModel: lmStudio.resolvedChatModel || '',
      semanticMemory: lmStudio.semanticMemory || null,
      availableModels: lmStudio.availableModels || [],
    };

    // Keep smoke bounded and product-shaped; the obfuscated routing probe stays in the dedicated contradiction-premise segment.
    for (const spec of buildSmokeScenarioSpecs()) {
      suite.scenarios.push(await spec.run(baseUrl));
    }
    suite.environment = buildQaEnvironmentValidity({
      serverMode: SPAWN_SERVER ? 'spawned-disposable' : 'existing-main-server',
      serverStatus: suite.serverStatus,
      results: suite.scenarios,
      requireDisposable: true,
      requireChat: true,
      requireTool: false,
      requireSemantic: false,
      expectedChatModel: CHAT_MODEL,
      expectedToolModel: TOOL_MODEL,
    });
  } finally {
    await stopServerProcess(server);
    if (SPAWN_SERVER) {
      for (const filePath of [suitePaths.memoryFile, suitePaths.archiveFile, suitePaths.embeddingsFile, suitePaths.staticEmbeddingsFile, suitePaths.ledgerFile, suitePaths.openLoopFile]) {
        if (fs.existsSync(filePath)) {
          removeFileIfExists(filePath);
          suite.cleanedFiles.push(filePath);
        }
      }
    }
  }
  return suite;
}

function summarizeSuites(suites = []) {
  const scenarios = suites.flatMap((suite) => suite.scenarios || []);
  const invalid = suites
    .filter((suite) => suite?.environment?.valid === false)
    .flatMap((suite) => suite.scenarios || []);
  const completed = scenarios.filter((scenario) => scenario.ok && !invalid.includes(scenario));
  const failed = scenarios.filter((scenario) => scenario.ok === false && !invalid.includes(scenario));
  const groups = buildScenarioGroupSummary(scenarios);
  const totalSeconds = scenarios.reduce((sum, scenario) => {
    const turnSeconds = Object.values(scenario || {}).reduce((inner, value) => inner + collectSeconds(value), 0);
    return sum + turnSeconds;
  }, 0);
  return {
    completed: completed.length,
    failed: failed.length,
    invalid: invalid.length,
    averageScenarioSeconds: scenarios.length ? Math.round((totalSeconds / scenarios.length) * 100) / 100 : null,
    totalScenarioSeconds: Math.round(totalSeconds * 100) / 100,
    groups,
  };
}

function walkTraceNodes(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) walkTraceNodes(item, visit, seen);
    return;
  }
  visit(value);
  for (const item of Object.values(value)) {
    walkTraceNodes(item, visit, seen);
  }
}

function collectTraceResults(suites = []) {
  const results = [];
  walkTraceNodes(suites, (item) => {
    if (typeof item?.ok === 'boolean' && typeof item?.seconds === 'number') {
      results.push(item);
    }
  });
  return results;
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function buildMemoryQaTrace(payload = {}) {
  const suites = Array.isArray(payload.suites) ? payload.suites : [];
  const scenarios = suites.flatMap((suite) => Array.isArray(suite?.scenarios) ? suite.scenarios : []);
  const scenarioDriftCanaries = scenarios.map((scenario) => buildScenarioDriftCanary(scenario));
  const firstScenarioDrift = scenarioDriftCanaries.find((item) => item.firstDriftReason) || {
    firstDriftReason: '',
    firstDriftTurn: '',
    fixationDetected: false,
    fixationRepeatCount: 0,
    recoveredAfterDrift: false,
  };
  const suiteStatuses = suites.map((suite) => suite?.serverStatus || {});
  const primaryStatus = suiteStatuses[0] || {};
  const judgedGroups = payload?.summary?.groups && typeof payload.summary.groups === 'object'
    ? payload.summary.groups
    : {};
  const judgedWriteGroup = judgedGroups.write || {};
  const judgedRetrieveGroup = judgedGroups.retrieve || {};
  const judgedForgetGroup = judgedGroups.forget || {};
  const judgedGroupNames = Object.keys(judgedGroups);
  const results = collectTraceResults(suites);
  const artifacts = results
    .map((item) => item?.meta?.artifact)
    .filter((item) => item && typeof item === 'object');
  const laneCounts = results.reduce((counts, item) => {
    const lane = String(item?.meta?.localLane || item?.meta?.artifact?.scope?.selectedLane || '').trim() || 'unknown';
    counts[lane] = (counts[lane] || 0) + 1;
    if (item?.meta?.laneFallback === true) counts.fallback = (counts.fallback || 0) + 1;
    return counts;
  }, {});
  const archiveReadItems = artifacts.reduce((sum, item) => sum
    + Number(item?.performance?.archiveRetrieval?.sessionItems || 0)
    + Number(item?.performance?.archiveRetrieval?.globalItems || 0), 0);
  const semanticReadyArtifacts = artifacts.filter((item) => item?.context?.semanticMemoryReady === true).length;
  const degradedArtifacts = artifacts.filter((item) => String(item?.readiness?.warmState || '') === 'degraded').length;
  const executionPaths = uniqueStrings(artifacts.map((item) => item?.executionPath || item?.context?.executionPath || item?.trace?.laneChoice?.executionPath || ''));
  const modelUsageFacts = uniqueStrings(artifacts.map((item) => item?.readiness?.modelUsage || ''));
  const artifactVersions = uniqueStrings(artifacts.map((item) => item?.version || ''));
  const explicitSnapshots = results.filter((item) => Array.isArray(item?.memory?.memories)).length;
  const threadClears = scenarios.filter((scenario) => scenario?.memoryThreadCleared === true).length;
  const queueItemsSeen = scenarios.reduce((sum, scenario) => sum + Number(scenario?.inspectorAfter?.inspector?.archive?.global?.promotionQueue?.length || 0), 0);
  const averageSeconds = results.length
    ? Math.round((results.reduce((sum, item) => sum + Number(item?.seconds || 0), 0) / results.length) * 100) / 100
    : 0;
  const loadedModels = uniqueStrings([
    ...(payload?.preparation?.loadedModels || []),
    ...suiteStatuses.flatMap((status) => Array.isArray(status?.availableModels) ? status.availableModels : []),
  ]);
  const trust = buildQaTrust({
    environment: Array.isArray(payload?.suites) && payload.suites.length === 1
      ? payload.suites[0]?.environment || null
      : {
          valid: Array.isArray(payload?.suites)
            ? payload.suites.every((suite) => suite?.environment?.valid !== false)
            : true,
          reasons: Array.isArray(payload?.suites)
            ? payload.suites.flatMap((suite) => Array.isArray(suite?.environment?.reasons) ? suite.environment.reasons : [])
            : [],
          degradedArtifacts,
          laneFallbackArtifacts: laneCounts.fallback || 0,
          usedFallbackArtifacts: 0,
        },
    artifactValidatedCount: artifacts.length,
    expectedArtifactCount: results.length,
    degradedArtifacts,
    fallbackArtifacts: laneCounts.fallback || 0,
    invalidResultCount: Number(payload?.summary?.invalid || 0),
    failedResultCount: Number(payload?.summary?.failed || 0),
  });

  return validateQaTrace(buildQaTrace({
    runId: `memory-qa-${payload.startedAt || STAMP}`,
    startedAt: payload.startedAt,
    finishedAt: payload.finishedAt,
    promptVersion: payload.runMode === 'smoke'
      ? 'qa-penny-memory.smoke.v1'
      : (payload.runMode === 'judged'
        ? 'qa-penny-memory.judged.v1'
      : (payload.runMode === 'segment'
        ? `qa-penny-memory.${payload.segmentId || 'segment'}.v1`
        : 'qa-penny-memory.combined.v1')),
    runIdentity: {
      runMode: payload.runMode || 'combined',
      segmentId: payload.segmentId || '',
      runLabel: payload.runLabel || '',
      resolvedChatModel: primaryStatus?.resolvedChatModel || primaryStatus?.resolvedModel || '',
      resolvedToolModel: primaryStatus?.toolPreferredModel || '',
      resolvedEmbedModel: uniqueStrings(suiteStatuses.map((status) => status?.embedPreferredModel || '')).join(', '),
      loadedModels: loadedModels.join(', '),
      executionPaths: executionPaths.join(', '),
      modelUsage: modelUsageFacts.join(', '),
      runtimeArtifactVersion: artifactVersions.join(', '),
      semanticReadyArtifacts,
      artifactCount: artifacts.length,
      maxOutputTokens: Number(primaryStatus?.maxOutputTokens || 0),
      degradedArtifacts,
      fallbackArtifacts: laneCounts.fallback || 0,
    },
    driftCanaries: {
      firstDriftReason: firstScenarioDrift.firstDriftReason,
      firstDriftTurn: firstScenarioDrift.firstDriftTurn,
      fixationDetected: scenarioDriftCanaries.some((item) => item.fixationDetected === true),
      fixationRepeatCount: scenarioDriftCanaries.reduce((max, item) => Math.max(max, Number(item.fixationRepeatCount || 0)), 0),
      recoveredAfterDrift: firstScenarioDrift.recoveredAfterDrift === true,
    },
    laneDecision: {
      chatLaneTurns: laneCounts.chat || 0,
      toolLaneTurns: laneCounts.tool || 0,
      unknownLaneTurns: laneCounts.unknown || 0,
      laneFallbackTurns: laneCounts.fallback || 0,
      degradedArtifacts,
    },
    configuredModels: {
      chat: payload?.qaModelPolicy?.chat || CHAT_MODEL,
      tool: payload?.qaModelPolicy?.tool || TOOL_MODEL,
      embed: payload?.qaModelPolicy?.embed || EMBED_MODEL,
    },
    resolvedModels: {
      chat: primaryStatus?.resolvedChatModel || primaryStatus?.resolvedModel || '',
      tool: primaryStatus?.toolPreferredModel || '',
      embed: uniqueStrings(suiteStatuses.map((status) => status?.embedPreferredModel)).join(', '),
    },
    loadedModels,
    contextLength: {
      smokeMode: payload.runMode === 'smoke',
      judgedMode: payload.runMode === 'judged',
      runMode: payload.runMode || 'combined',
      segmentCount: suites.length,
      runLabel: payload.runLabel || '',
      suiteCount: suites.length,
      scenarioCount: scenarios.length,
      maxOutputTokens: Number(primaryStatus?.maxOutputTokens || 0),
      semanticSeedTurns: SEMANTIC_TURNS.length,
      fallbackSeedTurns: FALLBACK_TURNS.length,
      judgedGroupCount: judgedGroupNames.length,
    },
    memoryReads: {
      archiveItemsRetrieved: archiveReadItems,
      semanticReadyArtifacts,
      inspectorLoads: scenarios.filter((scenario) => scenario?.inspectorAfter || scenario?.inspectorBefore).length,
      explicitMemorySnapshots: explicitSnapshots,
      judgedRetrieveScenarios: Number(judgedRetrieveGroup.total || 0),
      judgedRetrievePasses: Number(judgedRetrieveGroup.completed || 0),
    },
    memoryWrites: {
      successfulTurns: results.filter((item) => item?.ok).length,
      threadClears,
      queueItemsSeen,
      judgedWriteScenarios: Number(judgedWriteGroup.total || 0),
      judgedWritePasses: Number(judgedWriteGroup.completed || 0),
      judgedForgetScenarios: Number(judgedForgetGroup.total || 0),
      judgedForgetPasses: Number(judgedForgetGroup.completed || 0),
    },
    toolCalls: {
      recordedTools: results.reduce((sum, item) => sum + Number(Array.isArray(item?.meta?.toolsUsed) ? item.meta.toolsUsed.length : 0), 0),
    },
    latency: {
      averageTurnSeconds: averageSeconds,
      totalScenarioSeconds: Number(payload?.summary?.totalScenarioSeconds || 0),
      averageScenarioSeconds: Number(payload?.summary?.averageScenarioSeconds || 0),
    },
    trust,
    validation: {
      artifactValidatedTurns: artifacts.length,
      completedScenarios: Number(payload?.summary?.completed || 0),
      failedScenarios: Number(payload?.summary?.failed || 0),
      invalidScenarios: Number(payload?.summary?.invalid || 0),
      runtimeArtifactsRequired: true,
      validEnvironment: Array.isArray(payload?.suites)
        ? payload.suites.every((suite) => suite?.environment?.valid !== false)
        : true,
      judgedGroupCount: judgedGroupNames.length,
      judgedWriteScenarios: Number(judgedWriteGroup.total || 0),
      judgedRetrieveScenarios: Number(judgedRetrieveGroup.total || 0),
      judgedForgetScenarios: Number(judgedForgetGroup.total || 0),
    },
    outcome: {
      completedScenarios: Number(payload?.summary?.completed || 0),
      failedScenarios: Number(payload?.summary?.failed || 0),
      invalidScenarios: Number(payload?.summary?.invalid || 0),
      segmentIds: suites.map((suite) => suite.segmentId || suite.name).filter(Boolean).join(', '),
      releaseReady: Number(payload?.summary?.failed || 0) === 0
        && Number(payload?.summary?.invalid || 0) === 0
        && suites.every((suite) => suite?.environment?.valid !== false),
      judgedMode: payload.runMode === 'judged',
      judgedGroupNames: judgedGroupNames.join(', '),
      judgedCompletedScenarios: Number(judgedWriteGroup.completed || 0)
        + Number(judgedRetrieveGroup.completed || 0)
        + Number(judgedForgetGroup.completed || 0),
      judgedFailedScenarios: Number(judgedWriteGroup.failed || 0)
        + Number(judgedRetrieveGroup.failed || 0)
        + Number(judgedForgetGroup.failed || 0),
    },
  }));
}

async function runMemoryQaSegment(segmentId) {
  const config = buildMemoryQaSegmentConfig(segmentId);
  const suitePaths = buildSuitePaths(config.runLabel);
  const baseUrl = BASE_URL;
  const suite = {
    name: config.runLabel,
    segmentId: config.segmentId,
    runLabel: config.runLabel,
    baseUrl,
    memoryStrategy: config.memoryStrategy,
    files: {
      memoryFile: suitePaths.memoryFile,
      archiveFile: suitePaths.archiveFile,
      embeddingsFile: suitePaths.embeddingsFile,
      staticEmbeddingsFile: suitePaths.staticEmbeddingsFile,
      ledgerFile: suitePaths.ledgerFile,
      openLoopFile: suitePaths.openLoopFile,
      stdout: suitePaths.stdoutPath,
      stderr: suitePaths.stderrPath,
    },
    scenarios: [],
    cleanedFiles: [],
  };
  const server = SPAWN_SERVER ? createServerProcess({ suiteSlug: config.runLabel, suitePaths, embedModel: config.embedModel }) : null;
  try {
    const status = await waitForServerReady(baseUrl);
    const lmStudio = await fetchJson(`${baseUrl}/api/penny/lmstudio/status`, {}, 20000);
    suite.serverStatus = {
      localTransport: status.localLlmTransport,
      maxOutputTokens: status.maxOutputTokens,
      chatPreferredModel: lmStudio.chatPreferredModel || '',
      toolPreferredModel: lmStudio.toolPreferredModel || '',
      embedPreferredModel: lmStudio.embedPreferredModel || '',
      resolvedModel: lmStudio.resolvedModel || '',
      resolvedChatModel: lmStudio.resolvedChatModel || '',
      resolvedToolModel: lmStudio.resolvedToolModel || '',
      semanticMemory: lmStudio.semanticMemory || null,
      availableModels: lmStudio.availableModels || [],
    };
    for (const scenarioFactory of config.scenarioFactories) {
      suite.scenarios.push(await scenarioFactory(baseUrl));
    }
    suite.environment = buildQaEnvironmentValidity({
      serverMode: SPAWN_SERVER ? 'spawned-disposable' : 'existing-main-server',
      serverStatus: suite.serverStatus,
      results: suite.scenarios,
      requireDisposable: true,
      requireChat: true,
      requireTool: false,
      requireSemantic: config.expectSemanticReady === true,
      expectedChatModel: CHAT_MODEL,
      expectedToolModel: TOOL_MODEL,
    });
  } finally {
    await stopServerProcess(server);
    if (SPAWN_SERVER) {
      for (const filePath of [suitePaths.memoryFile, suitePaths.archiveFile, suitePaths.embeddingsFile, suitePaths.staticEmbeddingsFile, suitePaths.ledgerFile, suitePaths.openLoopFile]) {
        if (fs.existsSync(filePath)) {
          removeFileIfExists(filePath);
          suite.cleanedFiles.push(filePath);
        }
      }
    }
  }
  return suite;
}

async function runMemoryQaCombined() {
  const suites = [];
  for (const segmentId of MEMORY_QA_SEGMENT_ORDER) {
    suites.push(await runMemoryQaSegment(segmentId));
  }
  return suites;
}

async function runMemoryQaJudgedSuite({
  suiteSlug,
  runLabel,
  memoryStrategy,
  embedModel,
  scenarioFactories,
  expectSemanticReady,
}) {
  const suitePaths = buildSuitePaths(suiteSlug);
  const baseUrl = BASE_URL;
  const suite = {
    name: runLabel,
    segmentId: 'judged',
    runLabel,
    baseUrl,
    memoryStrategy,
    files: {
      memoryFile: suitePaths.memoryFile,
      archiveFile: suitePaths.archiveFile,
      embeddingsFile: suitePaths.embeddingsFile,
      staticEmbeddingsFile: suitePaths.staticEmbeddingsFile,
      ledgerFile: suitePaths.ledgerFile,
      openLoopFile: suitePaths.openLoopFile,
      stdout: suitePaths.stdoutPath,
      stderr: suitePaths.stderrPath,
    },
    scenarios: [],
    cleanedFiles: [],
  };
  const server = SPAWN_SERVER ? createServerProcess({ suiteSlug, suitePaths, embedModel }) : null;
  try {
    const status = await waitForServerReady(baseUrl);
    const lmStudio = await fetchJson(`${baseUrl}/api/penny/lmstudio/status`, {}, 20000);
    suite.serverStatus = {
      localTransport: status.localLlmTransport,
      maxOutputTokens: status.maxOutputTokens,
      chatPreferredModel: lmStudio.chatPreferredModel || '',
      toolPreferredModel: lmStudio.toolPreferredModel || '',
      embedPreferredModel: lmStudio.embedPreferredModel || '',
      resolvedModel: lmStudio.resolvedModel || '',
      resolvedChatModel: lmStudio.resolvedChatModel || '',
      resolvedToolModel: lmStudio.resolvedToolModel || '',
      semanticMemory: lmStudio.semanticMemory || null,
      availableModels: lmStudio.availableModels || [],
    };
    for (const scenarioFactory of scenarioFactories) {
      suite.scenarios.push(await scenarioFactory(baseUrl));
    }
    suite.environment = buildQaEnvironmentValidity({
      serverMode: SPAWN_SERVER ? 'spawned-disposable' : 'existing-main-server',
      serverStatus: suite.serverStatus,
      results: suite.scenarios,
      requireDisposable: true,
      requireChat: true,
      requireTool: false,
      requireSemantic: expectSemanticReady === true,
      expectedChatModel: CHAT_MODEL,
      expectedToolModel: TOOL_MODEL,
    });
  } finally {
    await stopServerProcess(server);
    if (SPAWN_SERVER) {
      for (const filePath of [suitePaths.memoryFile, suitePaths.archiveFile, suitePaths.embeddingsFile, suitePaths.staticEmbeddingsFile, suitePaths.ledgerFile, suitePaths.openLoopFile]) {
        if (fs.existsSync(filePath)) {
          removeFileIfExists(filePath);
          suite.cleanedFiles.push(filePath);
        }
      }
    }
  }
  return suite;
}

async function runMemoryQaJudged() {
  const suites = [];
  suites.push(await runMemoryQaJudgedSuite({
    suiteSlug: 'judged-semantic',
    runLabel: 'judged',
    memoryStrategy: 'judged write/retrieve/forget on semantic memory',
    embedModel: EMBED_MODEL,
    expectSemanticReady: true,
    scenarioFactories: [
      (baseUrl) => runJudgedWriteExplicitScenario(baseUrl),
      (baseUrl) => runJudgedWriteCorrectionScenario(baseUrl),
      (baseUrl) => runJudgedWriteReviewCandidateScenario(baseUrl),
      (baseUrl) => runJudgedRetrieveSemanticArchiveScenario(baseUrl),
      (baseUrl) => runJudgedRetrieveCanonOverAdvisoryScenario(baseUrl),
      (baseUrl) => runJudgedForgetScenario(baseUrl),
    ],
  }));
  suites.push(await runMemoryQaJudgedSuite({
    suiteSlug: 'judged-fallback',
    runLabel: 'judged-fallback',
    memoryStrategy: 'judged chapter fallback retrieval',
    embedModel: 'qa-missing-embed-model',
    expectSemanticReady: false,
    scenarioFactories: [
      (baseUrl) => runJudgedRetrieveChapterFallbackScenario(baseUrl),
    ],
  }));
  return suites;
}

async function main() {
  ensureDir(OUTPUT_DIR);
  if (MEMORY_QA_ARGS.sourceSensitiveFixtureMode) {
    const fixture = buildSourceSensitiveMemoryQaFixture({
      generatedAt: new Date().toISOString(),
      defaults: {
        chatModel: CHAT_MODEL,
        toolModel: TOOL_MODEL,
        embedModel: EMBED_MODEL,
      },
    });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`Saved source-sensitive memory QA fixture to ${OUTPUT_PATH}`);
    return;
  }
  if (MEMORY_QA_ARGS.candidateSurvivalFixtureMode) {
    const fixture = buildCandidateSurvivalQaFixture({
      generatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`Saved candidate-survival memory QA fixture to ${OUTPUT_PATH}`);
    return;
  }
  if (MEMORY_QA_ARGS.candidateSurvivalArchiveUnitMode) {
    const result = await runCandidateSurvivalArchiveUnitQa({
      outputPath: OUTPUT_PATH,
      outputDir: OUTPUT_DIR,
      stamp: STAMP,
      shadowEmbedProvider: MEMORY_QA_ARGS.shadowEmbedProvider,
      rerankShadowProvider: MEMORY_QA_ARGS.rerankShadowProvider,
    });
    console.log(`Saved candidate-survival archive-unit memory QA to ${result.outputPath}`);
    return;
  }
  const automationApi = createAutomationApi({
    chatModel: CHAT_MODEL,
    toolModel: TOOL_MODEL,
  });
  const preparation = await automationApi.prepareLmStudio({
    reportOnly: QA_MODEL_MANAGEMENT.prepareReportOnly,
    repairPreset: QA_MODEL_MANAGEMENT.repairPreset,
    loadChatModel: false,
    loadEmbedModel: false,
    chatModel: CHAT_MODEL,
    toolModel: TOOL_MODEL,
  });
  if (!preparation.ok) {
    throw new Error(`LM Studio is not ready for memory QA: ${preparation.blockers.join(' ')}`);
  }
  if (QA_LOAD_CHAT_MODEL) {
    await automationApi.loadModel(CHAT_MODEL, 'memory qa chat model', {
      contextLength: QA_CHAT_CONTEXT_LENGTH,
      ttlSeconds: QA_MODEL_TTL_SECONDS,
    });
  }
  if (QA_LOAD_EMBED_MODEL && EMBED_MODEL) {
    try {
      await automationApi.loadModel(EMBED_MODEL, 'memory qa embed model', {
        ttlSeconds: QA_MODEL_TTL_SECONDS,
      });
    } catch {}
  }

  const payload = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runMode: MEMORY_QA_ARGS.runMode,
    runLabel: MEMORY_QA_ARGS.runLabel,
    segmentId: MEMORY_QA_ARGS.segmentId || '',
    serverMode: SPAWN_SERVER ? 'spawned-disposable' : 'existing-main-server',
    memoryStrategy: SMOKE_MODE
      ? 'smoke: short-term explicit + contradiction flip + premise drift + long-term compression fallback'
      : (MEMORY_QA_ARGS.runMode === 'judged'
        ? 'judged: grouped write/retrieve/forget memory QA with review-queue and prune checks'
      : (MEMORY_QA_ARGS.segmentId
        ? buildMemoryQaSegmentConfig(MEMORY_QA_ARGS.segmentId).memoryStrategy
        : 'combined: semantic archive + chapter fallback + contradiction/premise drift + long mixed-session drift')),
    preparation: {
      ok: preparation.ok,
      requestedChatModel: preparation.requestedChatModel,
      requestedToolModel: preparation.requestedToolModel,
      loadedModels: preparation.loadedModels,
      warnings: preparation.warnings,
      blockers: preparation.blockers,
    },
    qaModelPolicy: {
      chat: CHAT_MODEL,
      tool: TOOL_MODEL,
      embed: EMBED_MODEL,
      chatContextLength: QA_CHAT_CONTEXT_LENGTH,
      strictNoModelOps: QA_MODEL_MANAGEMENT.strictNoModelOps,
      manageModels: QA_MODEL_MANAGEMENT.manageModels,
      loadStrategy: QA_MODEL_MANAGEMENT.loadStrategy,
      autoLoadChatModel: QA_LOAD_CHAT_MODEL,
      autoLoadEmbedModel: QA_LOAD_EMBED_MODEL,
      freshServerRequired: true,
      q8RequiresExplicitRequest: true,
      dualLaneStressTest: false,
    },
    suites: [],
  };

  if (SMOKE_MODE) {
    payload.suites.push(await runSmokeSuite({
      embedModel: 'qa-missing-embed-model',
    }));
  } else if (MEMORY_QA_ARGS.runMode === 'judged') {
    payload.suites.push(...(await runMemoryQaJudged()));
  } else if (MEMORY_QA_ARGS.segmentId) {
    payload.suites.push(await runMemoryQaSegment(MEMORY_QA_ARGS.segmentId));
  } else {
    payload.suites.push(...(await runMemoryQaCombined()));
  }

  payload.segments = payload.suites;
  payload.summary = summarizeSuites(payload.suites);
  payload.finishedAt = new Date().toISOString();
  payload.trace = buildMemoryQaTrace(payload);
  payload.trust = payload.trace.trust;
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved memory QA to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  buildStaticEmbeddingServerEnv,
  buildQaServerEnv,
  buildSuitePaths,
  buildCandidateSurvivalArchiveUnitPaths,
  buildSmokeScenarioSpecs,
  buildSourceSensitiveMemoryQaFixture,
  canonicalAuthorityPressureSatisfied,
  classifySourceSensitiveMemoryOutcome,
  cleanupCandidateSurvivalArchiveUnitFiles,
  countNeedleHits,
  main,
  normalizeQaStaticEmbedMode,
  parseMemoryQaArgs,
  resolveMemoryQaModelManagementMode,
  resolveMemoryQaStaticEmbeddingConfig,
  resolveChatRequestTimeoutMs,
  runCandidateSurvivalArchiveUnitQa,
  runMemoryQaSegment,
  runMemoryQaCombined,
  runMemoryQaJudged,
  scoreTruthReplacement,
  summarizeSuites,
  buildMemoryQaTrace,
  runSmokeSuite,
  SOURCE_SENSITIVE_MEMORY_CASES,
  SOURCE_SENSITIVE_OUTCOMES,
  MEMORY_QA_SEGMENT_IDS,
  MEMORY_QA_SEGMENT_ORDER,
};
