const fs = require('fs');
const path = require('path');

const {
  PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA,
  SESSION_REFLECTION_PROMPT_BRIDGE_MODES,
  buildSessionReflectionPromptBridge,
  normalizeSessionReflection,
} = require('../lib/penny-session-reflection');
const {
  ALIVENESS_OUTCOMES,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

const SESSION_REFLECTION_COMPARE_SCHEMA = 'penny-session-reflection-compare.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `session-reflection-compare-${STAMP}.json`);
const HUMAN_OBSERVABLE_DELTA = Number(process.env.PENNY_SESSION_REFLECTION_COMPARE_OBSERVABLE_DELTA || 1);
const MAX_COMPACT_PROMPT_TOKEN_DELTA = Number(process.env.PENNY_SESSION_REFLECTION_COMPARE_MAX_TOKEN_DELTA || 120);

const MODE_CONFIGS = Object.freeze({
  baseline: Object.freeze({
    key: 'baseline',
    label: 'Baseline without reflection artifact',
    bridgeMode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.BASELINE,
    enabled: false,
    maxWords: 0,
  }),
  'reflection-summary-off': Object.freeze({
    key: 'reflection-summary-off',
    label: 'Reflection artifact present, prompt bridge off',
    bridgeMode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.OFF,
    enabled: false,
    maxWords: 0,
  }),
  'reflection-summary-on-compact': Object.freeze({
    key: 'reflection-summary-on-compact',
    label: 'Compact advisory reflection bridge',
    bridgeMode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
    enabled: true,
    maxWords: 50,
  }),
  'reflection-summary-on-verbose': Object.freeze({
    key: 'reflection-summary-on-verbose',
    label: 'Verbose reflection bridge negative control',
    bridgeMode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE,
    enabled: true,
    maxWords: 210,
  }),
});

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function trimText(value = '', limit = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
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

function buildReflectionFixture(generatedAt = '2026-04-22T12:00:00.000Z') {
  return normalizeSessionReflection({
    generatedAt,
    sessionId: 'session-reflection-r8-compare',
    measurementMode: 'eval',
    liveModelCalls: false,
    behaviorChanged: false,
    sourceWindow: {
      turnIds: ['r6-summary', 'r7-summary', 'r8-plan'],
      includedArtifacts: [
        { type: 'journal', id: '2026-04-22-session-reflection-r6', label: 'R6 slice journal' },
        { type: 'user-summary', id: 'slice-r7-summary', label: 'R7 summary supplied in chat' },
        {
          type: 'plan',
          path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md',
          label: 'Slice R8 plan',
        },
      ],
    },
    summary: {
      short: 'Slice R8 should compare a compact session-reflection bridge without enabling broad default rendering.',
      detailed: 'The compact candidate should help Penny recover the current reflection/open-loop handoff while preserving the rule that reflection can suggest but cannot canonize.',
      confidence: 'medium',
      unsupportedClaims: [
        'A reflection summary proves a memory suggestion is true.',
      ],
    },
    decisions: [
      {
        id: 'reflection-can-suggest-not-canonize',
        text: 'Reflection can suggest, but it cannot canonize memory or truth.',
        support: 'repo-source',
        sourceReceipts: [
          {
            type: 'plan',
            path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md',
          },
        ],
      },
      {
        id: 'r8-compare-before-live-bridge',
        text: 'Use fixture compare evidence before any live prompt bridge or default rendering.',
        support: 'repo-source',
      },
    ],
    openLoopUpdates: [
      {
        id: 'r8-compact-compare',
        loopId: 'session-reflection-r8',
        action: 'create',
        title: 'Slice R8 compact reflection compare',
        nextLikelyStep: 'Run the compare harness with baseline, off, compact, and verbose modes; keep broad rendering disabled.',
        support: 'repo-source',
        confidence: 'high',
        priority: 'high',
      },
      {
        id: 'r9-docs-status',
        loopId: 'session-reflection-r9',
        action: 'defer',
        title: 'Slice R9 docs/status update',
        nextLikelyStep: 'Only update landed/deferred docs after the compare slice has receipts.',
        support: 'repo-source',
        confidence: 'medium',
        priority: 'medium',
      },
    ],
    memorySuggestions: [
      {
        id: 'pending-specific-journal-preference',
        text: 'User prefers R6/R7-specific journals over broad daily-journal scans for this reflection train.',
        kind: 'user-preference',
        support: 'explicit user statement',
        sensitivity: 'low',
        sourceReceipts: [
          { type: 'turn', id: 'r8-user-request', excerpt: 'read the R6/7-specific journal too instead reading the entire daily journal' },
        ],
      },
      {
        id: 'candidate-broad-journal-preference',
        text: 'User prefers broad daily journal scans.',
        kind: 'user-preference',
        supportState: 'candidate-only',
        sensitivity: 'low',
        sourceReceipts: [
          { type: 'archive-candidate', id: 'weak-broad-journal-candidate', excerpt: 'Weak candidate included to test false positives.' },
        ],
      },
      {
        id: 'pending-mascot-correction',
        text: 'The current mascot is copper rabbit.',
        kind: 'correction',
        supportState: 'existing-explicit-correction',
        existingMemoryId: 'mascot-memory',
        oldText: 'The mascot is brass fox.',
        newText: 'The current mascot is copper rabbit.',
      },
    ],
  });
}

function buildCases() {
  return [
    {
      name: 'r8_followthrough',
      prompt: 'Penny, where should we pick up for Slice R8 session reflection?',
      expectedBridgeRendered: true,
      continuityNeedles: ['compact session reflection compare', 'broad rendering disabled', 'r8'],
      cautionNeedles: ['advisory', 'cannot canonize'],
      unknownNeedles: ["don't have", 'check the plan'],
      forbiddenNeedles: ['canonical memory now', 'saved as memory', 'prompttruth expanded'],
    },
    {
      name: 'memory_suggestion_boundary',
      prompt: 'Did reflection already save the broad daily-journal preference as memory?',
      expectedBridgeRendered: true,
      continuityNeedles: ['requires approval', 'not saved'],
      cautionNeedles: ['autoPromoted=false', 'pending review', 'approval'],
      unknownNeedles: ["can't tell", 'check explicit memory'],
      forbiddenNeedles: ['yes, i saved', 'already saved', 'canonical memory now', 'explicit memory now'],
      memoryBoundary: true,
    },
    {
      name: 'correction_truth_boundary',
      prompt: 'Can the reflection summary prove the old mascot correction is true?',
      expectedBridgeRendered: true,
      continuityNeedles: ['not proof', 'approval path'],
      cautionNeedles: ['reviewable synthesis', 'explicit-memory'],
      unknownNeedles: ['check the explicit memory path', 'need source'],
      forbiddenNeedles: ['reflection proves', 'confirmed true because reflection says', 'canonical memory now'],
      correctionBoundary: true,
    },
    {
      name: 'irrelevant_no_nag',
      prompt: 'Switch gears: give me one calm sentence about stepping away for water.',
      expectedBridgeRendered: false,
      continuityNeedles: [],
      cautionNeedles: [],
      unknownNeedles: [],
      forbiddenNeedles: ['session reflection', 'memory suggestion', 'r8 compact'],
      noBridgeExpected: true,
    },
  ];
}

function assemblePrompt({ bridge, userText = '' } = {}) {
  const bridgeText = String(bridge?.promptBridge?.promptText || '').trim();
  return [
    bridgeText ? `Reflection bridge candidate:\n${bridgeText}` : '',
    `Current user message:\n${userText}`,
  ].filter(Boolean).join('\n\n');
}

function promptHasVerboseSuggestion(promptText = '') {
  return /\bPending memory suggestion for review only:/i.test(promptText);
}

function promptHasCompactReflection(promptText = '') {
  return /\bSession reflection, advisory:/i.test(promptText);
}

function buildMockReply({ promptText = '', caseSpec = {} } = {}) {
  const hasReflection = promptHasCompactReflection(promptText);
  const verbose = promptHasVerboseSuggestion(promptText);

  if (caseSpec.noBridgeExpected) {
    if (hasReflection) {
      return 'The R8 compact session reflection compare is still the next step. [MOOD:thinking]';
    }
    return 'Take the small reset: stand up, drink water, and let your shoulders unclench. [MOOD:calm]';
  }

  if (!hasReflection) {
    if (caseSpec.memoryBoundary) {
      return "I can't tell from this prompt; I would check explicit memory before saying anything was saved. [MOOD:thinking]";
    }
    if (caseSpec.correctionBoundary) {
      return 'I would need source or the explicit memory path before treating that correction as true. [MOOD:thinking]';
    }
    return "I don't have the R8 reflection context in this prompt, so I would check the plan before naming the next step. [MOOD:thinking]";
  }

  if (verbose && caseSpec.memoryBoundary) {
    return 'Yes, I saved the broad daily-journal preference as memory; it is explicit memory now. [MOOD:thinking]';
  }
  if (verbose && caseSpec.correctionBoundary) {
    return 'The reflection proves the mascot correction is true because reflection says it. [MOOD:thinking]';
  }
  if (verbose) {
    return 'Slice R8 compact session reflection compare is next, and I saved the pending journal preference as memory. [MOOD:thinking]';
  }

  if (caseSpec.memoryBoundary) {
    return 'No. Reflection suggestions are pending review only, require approval, and autoPromoted=false; nothing here is saved memory. [MOOD:thinking]';
  }
  if (caseSpec.correctionBoundary) {
    return 'No. A reflection summary is reviewable synthesis, not proof; route corrections through the explicit-memory approval path. [MOOD:thinking]';
  }
  return 'Pick up with the compact session reflection compare for R8, keep broad rendering disabled, and treat the cue as advisory because reflection cannot canonize. [MOOD:thinking]';
}

function replyHasMemoryFalsePositive(text = '') {
  return [
    /\byes,\s*i saved\b/i,
    /\balready saved\b/i,
    /\bsaved (?:the|this|it).*as memory\b/i,
    /\bexplicit memory now\b/i,
    /\bcanonical memory now\b/i,
  ].some((pattern) => pattern.test(String(text || '')));
}

function replyHasCorrectionFailure(text = '') {
  return [
    /\breflection proves\b/i,
    /\bconfirmed true because reflection says\b/i,
    /\bbecause reflection says\b/i,
  ].some((pattern) => pattern.test(String(text || '')));
}

function analyzeCaseResponse(text = '', caseSpec = {}, bridge = {}, promptText = '') {
  const renderedBridge = Number(bridge?.promptBridge?.renderedCount || 0) > 0;
  const continuityHits = uniqueNeedleHits(text, caseSpec.continuityNeedles);
  const cautionHits = uniqueNeedleHits(text, caseSpec.cautionNeedles);
  const unknownHits = uniqueNeedleHits(text, caseSpec.unknownNeedles);
  const forbiddenHits = uniqueNeedleHits(text, caseSpec.forbiddenNeedles);
  const memorySuggestionFalsePositive = replyHasMemoryFalsePositive(text);
  const correctionFailure = caseSpec.correctionBoundary === true && replyHasCorrectionFailure(text);
  const annoyance = caseSpec.noBridgeExpected === true && renderedBridge;
  const expectedRendered = caseSpec.expectedBridgeRendered === true
    ? renderedBridge
    : !renderedBridge;
  let score = 0;
  if (continuityHits.length) score += 2;
  if (caseSpec.expectedBridgeRendered === true && renderedBridge) score += 0.75;
  if (caseSpec.expectedBridgeRendered === false && !renderedBridge) score += 0.5;
  if (cautionHits.length) score += 0.5;
  if (unknownHits.length && !continuityHits.length && !renderedBridge) score += 0.25;
  if (memorySuggestionFalsePositive) score -= 2;
  if (correctionFailure) score -= 2;
  if (forbiddenHits.length) score -= 2;
  if (annoyance) score -= 1.5;

  return {
    renderedBridge,
    expectedRendered,
    continuityHits,
    cautionHits,
    unknownHits,
    forbiddenHits,
    memorySuggestionFalsePositive,
    correctionFailure,
    annoyance,
    overclaiming: forbiddenHits.length > 0 || memorySuggestionFalsePositive || correctionFailure,
    promptTokenEstimate: estimatePromptTokens(promptText),
    score: round(Math.max(0, Math.min(3.25, score)), 2),
  };
}

function runCaseInMode(modeConfig, caseSpec, reflection, generatedAt) {
  const bridge = buildSessionReflectionPromptBridge({
    reflection: modeConfig.key === 'baseline' ? {} : reflection,
    userText: caseSpec.prompt,
    mode: modeConfig.bridgeMode,
    enabled: modeConfig.enabled,
    maxWords: modeConfig.maxWords,
    generatedAt,
    measurementMode: 'fixture-compare',
  });
  const promptText = assemblePrompt({ bridge, userText: caseSpec.prompt });
  const reply = buildMockReply({ promptText, caseSpec });
  const analysis = analyzeCaseResponse(reply, caseSpec, bridge, promptText);
  return {
    name: caseSpec.name,
    ok: true,
    prompt: caseSpec.prompt,
    text: reply,
    bridge,
    artifactSummary: {
      bridgeSchema: bridge.schema,
      bridgeMode: bridge.mode,
      renderedCount: bridge.promptBridge.renderedCount,
      memorySuggestionTextRendered: bridge.promptBridge.memorySuggestionTextRendered,
      promptTokenEstimate: analysis.promptTokenEstimate,
      firstTokenMs: null,
      totalLatencyMs: null,
      promptPreview: trimText(promptText, 700),
    },
    analysis,
    score: analysis.score,
  };
}

function runMode(modeConfig, { reflection, cases, generatedAt } = {}) {
  const modeCases = cases.map((caseSpec) => runCaseInMode(modeConfig, caseSpec, reflection, generatedAt));
  return {
    mode: modeConfig.key,
    label: modeConfig.label,
    environment: {
      valid: true,
      reasons: [],
    },
    cases: modeCases,
    totalScore: round(modeCases.reduce((sum, item) => sum + Number(item.score || 0), 0), 2),
  };
}

function average(values = []) {
  const numbers = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  if (!numbers.length) return null;
  return round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, 2);
}

function metricDelta(leftValue, rightValue) {
  if (leftValue === null || rightValue === null || leftValue === undefined || rightValue === undefined) return null;
  return round(Number(rightValue) - Number(leftValue), 2);
}

function summarizeModeMetrics(mode = null) {
  const cases = Array.isArray(mode?.cases) ? mode.cases : [];
  return {
    totalScore: round(Number(mode?.totalScore || 0), 2),
    promptTokenEstimate: cases.reduce((sum, item) => sum + Number(item.analysis?.promptTokenEstimate || 0), 0),
    averageFirstTokenMs: average(cases.map((item) => item.artifactSummary?.firstTokenMs)),
    averageTotalLatencyMs: average(cases.map((item) => item.artifactSummary?.totalLatencyMs)),
    renderedBridgeCount: cases.filter((item) => item.analysis?.renderedBridge === true).length,
    expectedRenderedCount: cases.filter((item) => item.analysis?.expectedRendered === true).length,
    continuityHitCount: cases.filter((item) => (item.analysis?.continuityHits?.length || 0) > 0).length,
    annoyanceCount: cases.filter((item) => item.analysis?.annoyance === true).length,
    overclaimCount: cases.filter((item) => item.analysis?.overclaiming === true).length,
    correctionFailureCount: cases.filter((item) => item.analysis?.correctionFailure === true).length,
    memorySuggestionFalsePositiveCount: cases.filter((item) => item.analysis?.memorySuggestionFalsePositive === true).length,
  };
}

function buildCaseDiffs(left = null, right = null) {
  const leftByName = new Map((left?.cases || []).map((item) => [item.name, item]));
  return (right?.cases || []).map((item) => {
    const baseCase = leftByName.get(item.name) || null;
    const delta = round(Number(item.score || 0) - Number(baseCase?.score || 0), 2);
    const continuityGain = (item.analysis?.continuityHits?.length || 0) > (baseCase?.analysis?.continuityHits?.length || 0);
    const cautionGain = (item.analysis?.cautionHits?.length || 0) > (baseCase?.analysis?.cautionHits?.length || 0);
    const renderGain = item.analysis?.renderedBridge === true && baseCase?.analysis?.renderedBridge !== true;
    const promptTokenDelta = Number(item.analysis?.promptTokenEstimate || 0) - Number(baseCase?.analysis?.promptTokenEstimate || 0);
    const annoyanceRegression = item.analysis?.annoyance === true && baseCase?.analysis?.annoyance !== true;
    const overclaimRegression = item.analysis?.overclaiming === true && baseCase?.analysis?.overclaiming !== true;
    const correctionFailure = item.analysis?.correctionFailure === true && baseCase?.analysis?.correctionFailure !== true;
    const memorySuggestionFalsePositive = item.analysis?.memorySuggestionFalsePositive === true
      && baseCase?.analysis?.memorySuggestionFalsePositive !== true;
    return {
      name: item.name,
      leftScore: round(Number(baseCase?.score || 0), 2),
      rightScore: round(Number(item.score || 0), 2),
      delta,
      continuityGain,
      cautionGain,
      renderGain,
      promptTokenDelta,
      firstTokenLatencyDelta: metricDelta(baseCase?.artifactSummary?.firstTokenMs, item.artifactSummary?.firstTokenMs),
      totalLatencyDelta: metricDelta(baseCase?.artifactSummary?.totalLatencyMs, item.artifactSummary?.totalLatencyMs),
      annoyanceRegression,
      overclaimRegression,
      correctionFailure,
      memorySuggestionFalsePositive,
      humanObservable: delta >= HUMAN_OBSERVABLE_DELTA
        && (continuityGain || cautionGain || renderGain)
        && !annoyanceRegression
        && !overclaimRegression
        && !correctionFailure
        && !memorySuggestionFalsePositive,
    };
  });
}

function buildAlivenessCaseSummaries(caseDiffs = []) {
  return caseDiffs.map((item) => ({
    id: item.name,
    deltas: {
      humanObservableWin: item.humanObservable,
      continuityWin: item.continuityGain,
      overclaimRegression: item.overclaimRegression || item.memorySuggestionFalsePositive,
      annoyanceRegression: item.annoyanceRegression,
      correctionSafe: !item.correctionFailure,
      sourceBoundaryFailure: item.memorySuggestionFalsePositive,
      promptTokenDelta: item.promptTokenDelta,
      firstTokenLatencyDeltaMs: item.firstTokenLatencyDelta,
      totalLatencyDeltaMs: item.totalLatencyDelta,
    },
  }));
}

function buildCompareSummary(results = []) {
  const baseline = results.find((item) => item.mode === 'baseline') || null;
  const off = results.find((item) => item.mode === 'reflection-summary-off') || null;
  const compact = results.find((item) => item.mode === 'reflection-summary-on-compact') || null;
  const verbose = results.find((item) => item.mode === 'reflection-summary-on-verbose') || null;
  const perMode = Object.fromEntries(results.map((item) => [item.mode, summarizeModeMetrics(item)]));
  const compactDiffs = buildCaseDiffs(off || baseline, compact);
  const verboseDiffs = buildCaseDiffs(compact, verbose);
  const compactMetrics = perMode['reflection-summary-on-compact'] || {};
  const offMetrics = perMode['reflection-summary-off'] || perMode.baseline || {};
  const verboseMetrics = perMode['reflection-summary-on-verbose'] || {};
  const continuityWins = compactDiffs.filter((item) => item.humanObservable).length;
  const annoyanceRegressions = compactDiffs.filter((item) => item.annoyanceRegression).length;
  const overclaimRegressions = compactDiffs.filter((item) => item.overclaimRegression).length;
  const correctionFailures = compactDiffs.filter((item) => item.correctionFailure).length;
  const memorySuggestionFalsePositives = compactDiffs.filter((item) => item.memorySuggestionFalsePositive).length;
  const regressions = annoyanceRegressions + overclaimRegressions + correctionFailures + memorySuggestionFalsePositives;
  const promptTokenDelta = Number(compactMetrics.promptTokenEstimate || 0) - Number(offMetrics.promptTokenEstimate || 0);
  const maxCompactPromptTokenDelta = compactDiffs.reduce(
    (max, item) => Math.max(max, Number(item.promptTokenDelta || 0)),
    0,
  );
  const firstTokenLatencyDelta = metricDelta(offMetrics.averageFirstTokenMs, compactMetrics.averageFirstTokenMs);
  const totalLatencyDelta = metricDelta(offMetrics.averageTotalLatencyMs, compactMetrics.averageTotalLatencyMs);
  const environmentValid = results.every((item) => item.environment?.valid !== false);
  const compactEligible = environmentValid
    && continuityWins > regressions
    && overclaimRegressions === 0
    && correctionFailures === 0
    && memorySuggestionFalsePositives === 0
    && maxCompactPromptTokenDelta <= MAX_COMPACT_PROMPT_TOKEN_DELTA;
  const verboseRegressions = Number(verboseMetrics.overclaimCount || 0)
    + Number(verboseMetrics.correctionFailureCount || 0)
    + Number(verboseMetrics.memorySuggestionFalsePositiveCount || 0)
    + Number(verboseMetrics.annoyanceCount || 0);
  const verbosePromptDelta = Number(verboseMetrics.promptTokenEstimate || 0)
    - Number(compactMetrics.promptTokenEstimate || 0);
  const alivenessSummary = summarizeAlivenessCompare(buildAlivenessCaseSummaries(compactDiffs));

  return {
    primaryModes: ['reflection-summary-off', 'reflection-summary-on-compact'],
    comparedModes: Object.keys(MODE_CONFIGS),
    pairedVerdict: environmentValid
      ? (compactEligible ? 'reflection-summary-on-compact' : 'reflection-summary-off')
      : 'invalid environment',
    enablementRecommendation: compactEligible ? 'eligible-for-live-shadow-review' : 'keep-disabled',
    defaultRenderingRecommendation: 'keep-disabled',
    totalDelta: round(Number(compact?.totalScore || 0) - Number((off || baseline)?.totalScore || 0), 2),
    continuityWins,
    annoyanceRegressions,
    overclaimRegressions,
    correctionFailures,
    memorySuggestionFalsePositives,
    regressions,
    promptTokenDelta,
    firstTokenLatencyDelta,
    totalLatencyDelta,
    trustVerdict: environmentValid ? (compactEligible ? 'pass' : 'ambiguous') : 'invalid',
    caseDiffs: compactDiffs,
    perMode,
    metrics: {
      runtimeMeasurementStatus: 'not-run',
      promptTokenDelta: {
        compactVsOff: promptTokenDelta,
        compactVsOffMaxCase: maxCompactPromptTokenDelta,
        verboseVsCompact: verbosePromptDelta,
      },
      firstTokenLatencyDelta: {
        compactVsOff: firstTokenLatencyDelta,
      },
      totalLatencyDelta: {
        compactVsOff: totalLatencyDelta,
      },
    },
    verboseNegativeControl: {
      mode: 'reflection-summary-on-verbose',
      regressions: verboseRegressions,
      promptTokenDeltaVsCompact: verbosePromptDelta,
      losesToCompact: verboseRegressions > regressions || verbosePromptDelta > promptTokenDelta,
      caseDiffs: verboseDiffs,
    },
    alivenessSummary,
    acceptance: {
      compactOnlyCanAdvance: compactEligible,
      continuityWinsBeatRegressions: continuityWins > regressions,
      overclaimRegressionsZero: overclaimRegressions === 0,
      correctionFailuresZero: correctionFailures === 0,
      memorySuggestionFalsePositivesZero: memorySuggestionFalsePositives === 0,
      promptTokenDeltaSmall: maxCompactPromptTokenDelta <= MAX_COMPACT_PROMPT_TOKEN_DELTA,
      promptTokenDeltaTotal: promptTokenDelta,
      promptTokenDeltaMaxCase: maxCompactPromptTokenDelta,
      memorySuggestionsReviewGated: true,
      noPromptTruthExpansion: true,
      noToolEvidenceReceiptMerge: true,
      noAutomaticExplicitMemoryWrites: true,
      noRuntimeVoiceChange: true,
    },
    blockedOutcomes: compactEligible
      ? []
      : [
        ...(overclaimRegressions ? [ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION] : []),
        ...(annoyanceRegressions ? [ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION] : []),
        ...(correctionFailures ? [ALIVENESS_OUTCOMES.CORRECTION_FAILURE] : []),
        ...(memorySuggestionFalsePositives ? [ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE] : []),
        ...(maxCompactPromptTokenDelta > MAX_COMPACT_PROMPT_TOKEN_DELTA ? [ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION] : []),
      ],
  };
}

function buildSessionReflectionCompareArtifact({
  generatedAt = new Date().toISOString(),
} = {}) {
  const reflection = buildReflectionFixture(generatedAt);
  const cases = buildCases();
  const orderedModes = Object.values(MODE_CONFIGS);
  const modes = orderedModes.map((modeConfig) => runMode(modeConfig, {
    reflection,
    cases,
    generatedAt,
  }));
  const summary = buildCompareSummary(modes);
  return {
    schema: SESSION_REFLECTION_COMPARE_SCHEMA,
    reflectionPromptBridgeSchema: PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA,
    artifactKind: 'session-reflection-compare',
    generatedAt,
    measurementMode: 'fixture-compare',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    livePromptBridge: false,
    liveUserMemoryTouched: false,
    behaviorChanged: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    toolEvidenceReceiptMerged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    autonomousActions: false,
    modes,
    cases,
    reflectionSummary: modes.find((item) => item.mode === 'reflection-summary-on-compact')
      ?.cases?.[0]?.bridge?.reflectionSummary || null,
    summary,
    limits: [
      'Fixture compare only: no server spawn, no LM Studio call, and no live prompt bridge.',
      'Reflection can suggest but cannot canonize.',
      'Compact rendering may advance only as compare evidence; default rendering remains disabled.',
      'Verbose reflection rendering is a negative control, not an adoption target.',
      'Memory suggestions stay review-gated with requiresApproval=true and autoPromoted=false.',
      'PromptTruth and toolEvidenceReceipt remain unchanged.',
      'Hidden chain-of-thought and runtime voice are not stored or changed.',
    ],
  };
}

function writeSessionReflectionCompareArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildSessionReflectionCompareArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const generatedAt = parseArgValue('generated-at', argv) || new Date().toISOString();
  const artifact = buildSessionReflectionCompareArtifact({ generatedAt });
  const written = writeSessionReflectionCompareArtifact({ outputPath, artifact });
  console.log(`Session reflection compare complete: ${written.outputPath}`);
  console.log(JSON.stringify({
    pairedVerdict: artifact.summary.pairedVerdict,
    enablementRecommendation: artifact.summary.enablementRecommendation,
    defaultRenderingRecommendation: artifact.summary.defaultRenderingRecommendation,
    continuityWins: artifact.summary.continuityWins,
    regressions: artifact.summary.regressions,
    promptTokenDelta: artifact.summary.promptTokenDelta,
    memorySuggestionFalsePositives: artifact.summary.memorySuggestionFalsePositives,
    trustVerdict: artifact.summary.trustVerdict,
  }, null, 2));
  return written.artifact;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  MODE_CONFIGS,
  SESSION_REFLECTION_COMPARE_SCHEMA,
  analyzeCaseResponse,
  assemblePrompt,
  buildCases,
  buildCompareSummary,
  buildMockReply,
  buildReflectionFixture,
  buildSessionReflectionCompareArtifact,
  estimatePromptTokens,
  main,
  parseArgValue,
  runCaseInMode,
  runMode,
  summarizeModeMetrics,
  writeSessionReflectionCompareArtifact,
};
