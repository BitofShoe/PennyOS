const fs = require('fs');
const path = require('path');

const {
  FRAME_BUDGET_COMPARE_MODES,
  FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS,
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  PENNY_FRAME_BUDGET_COMPARE_SCHEMA,
  PENNY_FRAME_BUDGET_SCHEMA,
  REQUIRED_FRAME_BUDGET_COMPARE_MODES,
  buildDeadlineAwareSidecarSchedule,
  createFrameBudgetReceipt,
  normalizeFrameBudgetCompareMode,
  summarizeFrameBudget,
} = require('../lib/penny-frame-budget');

const {
  ALIVENESS_COMPARE_MODES,
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  buildAlivenessFeatureToggleMatrix,
  buildAlivenessScenarioCaseResult,
  buildAlivenessScenarioFixtures,
  getAlivenessFeatureToggleFlags,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

const FRAME_BUDGET_COMPARE_ARTIFACT_KIND = 'frame-budget-compare-fixture';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `frame-budget-compare-${STAMP}.json`);

const FRAME_BUDGET_MODE_CONFIGS = Object.freeze({
  [FRAME_BUDGET_COMPARE_MODES.BASELINE]: Object.freeze({
    id: FRAME_BUDGET_COMPARE_MODES.BASELINE,
    label: 'Baseline',
    alivenessMode: ALIVENESS_COMPARE_MODES.BASELINE,
    includesStatic: false,
    rendersStatic: false,
    includesOpenLoops: false,
    includesTurnState: false,
    includesInitiative: false,
    prePromptBudgetMs: 30,
  }),
  [FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_SHADOW]: Object.freeze({
    id: FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_SHADOW,
    label: 'Static live shadow',
    alivenessMode: ALIVENESS_COMPARE_MODES.STATIC_LIVE_SHADOW,
    includesStatic: true,
    rendersStatic: false,
    includesOpenLoops: false,
    includesTurnState: false,
    includesInitiative: false,
    prePromptBudgetMs: 70,
  }),
  [FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_ADVISORY]: Object.freeze({
    id: FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_ADVISORY,
    label: 'Static live advisory',
    alivenessMode: ALIVENESS_COMPARE_MODES.STATIC_LIVE_ADVISORY,
    includesStatic: true,
    rendersStatic: true,
    includesOpenLoops: false,
    includesTurnState: false,
    includesInitiative: false,
    prePromptBudgetMs: 70,
  }),
  [FRAME_BUDGET_COMPARE_MODES.STATIC_OPEN_LOOPS]: Object.freeze({
    id: FRAME_BUDGET_COMPARE_MODES.STATIC_OPEN_LOOPS,
    label: 'Static plus open loops',
    alivenessMode: 'static+open-loops',
    includesStatic: true,
    rendersStatic: true,
    includesOpenLoops: true,
    includesTurnState: false,
    includesInitiative: false,
    prePromptBudgetMs: 90,
  }),
  [FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS]: Object.freeze({
    id: FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS,
    label: 'Bounded aliveness',
    alivenessMode: ALIVENESS_COMPARE_MODES.BOUNDED_ALIVENESS_ON,
    includesStatic: true,
    rendersStatic: true,
    includesOpenLoops: true,
    includesTurnState: true,
    includesInitiative: true,
    prePromptBudgetMs: 115,
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

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return argv.some((value) => String(value || '').trim() === dashed);
}

function parseFrameBudgetCompareArgs(argv = process.argv.slice(2)) {
  const requestedMode = parseArgValue('mode', argv);
  return {
    fixture: hasArgFlag('fixture', argv) || !requestedMode || requestedMode === 'fixture',
    mode: requestedMode || 'fixture',
    outputPath: parseArgValue('output', argv) || OUTPUT_PATH,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function estimateTokens(text = '') {
  const source = String(text || '').trim();
  if (!source) return 0;
  const words = (source.match(/\S+/g) || []).length;
  return Math.max(words, Math.ceil(source.length / 4));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function seedState(fixture = {}) {
  return fixture.seedState && typeof fixture.seedState === 'object' ? fixture.seedState : {};
}

function countFixtureItems(fixture = {}, key = '') {
  return list(seedState(fixture)[key]).length;
}

function textForStaticCandidate(candidate = {}) {
  return candidate.text || candidate.excerpt || candidate.summary || '';
}

function textForOpenLoop(loop = {}) {
  return [
    loop.title || '',
    loop.nextLikelyStep || '',
  ].filter(Boolean).join(' ');
}

function textForInitiativeCandidate(candidate = {}) {
  return candidate.suggestionText || candidate.text || candidate.nextLikelyStep || '';
}

function modeFeatureFlags(mode = FRAME_BUDGET_COMPARE_MODES.BASELINE) {
  const normalized = normalizeFrameBudgetCompareMode(mode);
  const config = FRAME_BUDGET_MODE_CONFIGS[normalized] || FRAME_BUDGET_MODE_CONFIGS.baseline;
  if (normalized === FRAME_BUDGET_COMPARE_MODES.STATIC_OPEN_LOOPS) {
    return {
      ...getAlivenessFeatureToggleFlags(ALIVENESS_COMPARE_MODES.STATIC_LIVE_ADVISORY),
      PENNY_ENABLE_OPEN_LOOP_PROMPT: '1',
      PENNY_OPEN_LOOP_MAX_RENDERED: '1',
      PENNY_OPEN_LOOP_MAX_TOKENS: '90',
      PENNY_ENABLE_TURN_STATE_PROMPT: '0',
      PENNY_ENABLE_BOUNDED_INITIATIVE: '0',
    };
  }
  if (normalized === FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS) {
    return getAlivenessFeatureToggleFlags(ALIVENESS_COMPARE_MODES.BOUNDED_ALIVENESS_ON);
  }
  return getAlivenessFeatureToggleFlags(config.alivenessMode);
}

function buildFrameBudgetFeatureToggleMatrix() {
  return Object.fromEntries(REQUIRED_FRAME_BUDGET_COMPARE_MODES.map((mode) => [mode, modeFeatureFlags(mode)]));
}

function buildSidecarTasksForMode(config = FRAME_BUDGET_MODE_CONFIGS.baseline) {
  const tasks = [
    {
      id: 'exact-anchors',
      label: 'Exact anchors and source authority',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.SOURCE_AUTHORITY,
      required: true,
      estimatedMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.EXACT_ANCHORS,
      budgetMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.EXACT_ANCHORS,
    },
    {
      id: 'candidate-merge',
      label: 'Candidate merge',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
      required: true,
      estimatedMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.CANDIDATE_MERGE,
      budgetMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.CANDIDATE_MERGE,
    },
  ];
  if (config.includesTurnState) {
    tasks.push({
      id: 'turn-state',
      label: 'Turn-state card',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RELEVANCE,
      estimatedMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.TURN_STATE,
      budgetMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.TURN_STATE,
    });
  }
  if (config.includesStatic) {
    tasks.push({
      id: 'static-memory-query',
      label: 'Static memory query',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
      estimatedMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY,
      budgetMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY,
    });
  }
  if (config.includesOpenLoops) {
    tasks.push({
      id: 'open-loop-relevance',
      label: 'Open-loop relevance',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RELEVANCE,
      estimatedMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.OPEN_LOOP_RELEVANCE,
      budgetMs: FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.OPEN_LOOP_RELEVANCE,
    });
  }
  if (config.includesInitiative) {
    tasks.push({
      id: 'bounded-initiative',
      label: 'Bounded initiative selection',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
      estimatedMs: 15,
      budgetMs: 15,
    });
  }
  return tasks;
}

function relevantFixtureForMode(fixture = {}, mode = FRAME_BUDGET_COMPARE_MODES.BASELINE) {
  const normalized = normalizeFrameBudgetCompareMode(mode);
  if (normalized === FRAME_BUDGET_COMPARE_MODES.BASELINE) return true;
  if (normalized === FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS) return true;
  const featureMode = String(fixture.featureMode || '').trim();
  if (normalized === FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_SHADOW) {
    return countFixtureItems(fixture, 'staticCandidates') > 0;
  }
  if (normalized === FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_ADVISORY) {
    return featureMode === ALIVENESS_COMPARE_MODES.STATIC_LIVE_ADVISORY;
  }
  if (normalized === FRAME_BUDGET_COMPARE_MODES.STATIC_OPEN_LOOPS) {
    return featureMode === ALIVENESS_COMPARE_MODES.STATIC_LIVE_ADVISORY
      || featureMode === ALIVENESS_COMPARE_MODES.OPEN_LOOP_ON;
  }
  return false;
}

function outcomesForMode(fixture = {}, mode = FRAME_BUDGET_COMPARE_MODES.BASELINE) {
  const normalized = normalizeFrameBudgetCompareMode(mode);
  if (normalized === FRAME_BUDGET_COMPARE_MODES.BASELINE
    || normalized === FRAME_BUDGET_COMPARE_MODES.STATIC_LIVE_SHADOW) {
    return [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE];
  }
  if (!relevantFixtureForMode(fixture, normalized)) return [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE];
  return list(fixture.expectedOutcomes).length
    ? fixture.expectedOutcomes
    : [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE];
}

function buildModeAlivenessCases(fixtures = [], mode = FRAME_BUDGET_COMPARE_MODES.BASELINE) {
  return (Array.isArray(fixtures) ? fixtures : [])
    .filter((fixture) => relevantFixtureForMode(fixture, mode))
    .map((fixture) => ({
      ...buildAlivenessScenarioCaseResult(fixture),
      outcomes: outcomesForMode(fixture, mode),
      featureOn: {
        ...fixture.featureOn,
        featureMode: mode,
      },
      measurementMode: 'fixture',
    }));
}

function renderedStaticCountForFixture(fixture = {}, config = {}) {
  if (!config.rendersStatic) return 0;
  return Math.min(1, countFixtureItems(fixture, 'staticCandidates'));
}

function renderedOpenLoopCountForFixture(fixture = {}, config = {}) {
  if (!config.includesOpenLoops) return 0;
  return Math.min(1, countFixtureItems(fixture, 'openLoops'));
}

function renderedInitiativeCountForFixture(fixture = {}, config = {}) {
  if (!config.includesInitiative) return 0;
  const expected = Number(fixture?.featureOn?.expectedSuggestionCount);
  if (Number.isFinite(expected)) return Math.max(0, Math.min(1, Math.floor(expected)));
  return Math.min(1, countFixtureItems(fixture, 'initiativeCandidates'));
}

function renderedTurnStateCountForFixture(fixture = {}, config = {}) {
  if (!config.includesTurnState) return 0;
  return seedState(fixture).turnState ? 1 : 0;
}

function promptTokenDeltaForFixture(fixture = {}, config = {}) {
  const state = seedState(fixture);
  let total = 0;
  if (config.rendersStatic) {
    for (const candidate of list(state.staticCandidates).slice(0, 1)) {
      total += estimateTokens(textForStaticCandidate(candidate));
    }
  }
  if (config.includesOpenLoops) {
    for (const loop of list(state.openLoops).slice(0, 1)) {
      total += estimateTokens(textForOpenLoop(loop));
    }
  }
  if (config.includesInitiative && renderedInitiativeCountForFixture(fixture, config) > 0) {
    for (const candidate of list(state.initiativeCandidates).slice(0, 1)) {
      total += estimateTokens(textForInitiativeCandidate(candidate));
    }
  }
  if (config.includesTurnState && state.turnState) {
    total += estimateTokens(Object.values(state.turnState).join(' '));
  }
  return total;
}

function collectModeWork(fixtures = [], config = FRAME_BUDGET_MODE_CONFIGS.baseline) {
  const relevantFixtures = fixtures.filter((fixture) => relevantFixtureForMode(fixture, config.id));
  const totals = {
    rawCandidatesInspected: 0,
    staticCandidatesInspected: 0,
    openLoopsScored: 0,
    candidatesSelected: 0,
    candidatesRendered: 0,
    staticOnlyRendered: 0,
    staleCandidatesBlocked: 0,
    sourceChecksRun: 0,
    estimatedPromptTokens: 0,
  };

  for (const fixture of relevantFixtures) {
    const explicitMemoryCount = countFixtureItems(fixture, 'explicitMemory');
    const staticCandidateCount = config.includesStatic ? countFixtureItems(fixture, 'staticCandidates') : 0;
    const openLoopCount = config.includesOpenLoops ? countFixtureItems(fixture, 'openLoops') : 0;
    const initiativeCount = config.includesInitiative ? countFixtureItems(fixture, 'initiativeCandidates') : 0;
    const turnStateCount = config.includesTurnState && seedState(fixture).turnState ? 1 : 0;
    const staticRendered = renderedStaticCountForFixture(fixture, config);
    const openLoopRendered = renderedOpenLoopCountForFixture(fixture, config);
    const initiativeRendered = renderedInitiativeCountForFixture(fixture, config);
    const turnStateRendered = renderedTurnStateCountForFixture(fixture, config);
    const renderedTotal = staticRendered + openLoopRendered + initiativeRendered + turnStateRendered;
    const inspected = explicitMemoryCount + staticCandidateCount + openLoopCount + initiativeCount + turnStateCount;

    totals.rawCandidatesInspected += inspected;
    totals.staticCandidatesInspected += staticCandidateCount;
    totals.openLoopsScored += openLoopCount;
    totals.candidatesRendered += renderedTotal;
    totals.candidatesSelected += Math.max(renderedTotal, explicitMemoryCount);
    totals.staticOnlyRendered += staticRendered;
    totals.staleCandidatesBlocked += list(fixture.blockedOutcomes).includes(ALIVENESS_OUTCOMES.CORRECTION_FAILURE) ? 1 : 0;
    totals.sourceChecksRun += list(fixture.blockedOutcomes).filter((outcome) => (
      outcome === ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE
      || outcome === ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION
      || outcome === ALIVENESS_OUTCOMES.CORRECTION_FAILURE
    )).length;
    totals.estimatedPromptTokens += promptTokenDeltaForFixture(fixture, config);
  }

  return {
    relevantFixtures,
    workDone: totals,
  };
}

function buildModeFrameBudgetReceipt({
  generatedAt = new Date().toISOString(),
  mode,
  config = FRAME_BUDGET_MODE_CONFIGS.baseline,
  workDone = {},
  alivenessSummary = {},
  caseCount = 0,
} = {}) {
  const schedule = buildDeadlineAwareSidecarSchedule({
    generatedAt,
    measurementMode: 'fixture',
    deadlineMs: config.prePromptBudgetMs,
    sidecars: buildSidecarTasksForMode(config),
  });
  return {
    frameBudget: createFrameBudgetReceipt({
      generatedAt,
      turnId: `frame-budget-compare-${mode}`,
      lane: 'chat',
      mode,
      measurementMode: 'fixture',
      targets: {
        prePromptBudgetMs: config.prePromptBudgetMs,
        staticMemoryBudgetMs: config.includesStatic
          ? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY
          : null,
        openLoopBudgetMs: config.includesOpenLoops
          ? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.OPEN_LOOP_RELEVANCE
          : null,
        turnStateBudgetMs: config.includesTurnState
          ? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.TURN_STATE
          : null,
        maxStaticOnlyRendered: Number(modeFeatureFlags(mode).PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED || 0)
          * Math.max(1, caseCount),
      },
      timings: {
        totalPrePromptMs: null,
        lmStudioFirstTokenMs: null,
        totalTurnMs: null,
      },
      workDone,
      budgetEvents: schedule.budgetEvents,
      quality: {
        sourceAuthorityPreserved: Number(alivenessSummary.sourceBoundaryFailures || 0) === 0,
        staleCorrectionBlocked: Number(alivenessSummary.correctionFailures || 0) === 0,
        overclaimRegression: Number(alivenessSummary.overclaimRegressions || 0) > 0,
        promptTokenDelta: workDone.estimatedPromptTokens || 0,
      },
    }),
    sidecarSchedule: schedule,
  };
}

function buildModeSummary({
  generatedAt = new Date().toISOString(),
  mode = FRAME_BUDGET_COMPARE_MODES.BASELINE,
  fixtures = buildAlivenessScenarioFixtures(),
} = {}) {
  const normalizedMode = normalizeFrameBudgetCompareMode(mode);
  const config = FRAME_BUDGET_MODE_CONFIGS[normalizedMode] || FRAME_BUDGET_MODE_CONFIGS.baseline;
  const { relevantFixtures, workDone } = collectModeWork(fixtures, config);
  const alivenessCases = buildModeAlivenessCases(fixtures, normalizedMode);
  const alivenessSummary = summarizeAlivenessCompare(alivenessCases);
  const { frameBudget, sidecarSchedule } = buildModeFrameBudgetReceipt({
    generatedAt,
    mode: normalizedMode,
    config,
    workDone,
    alivenessSummary,
    caseCount: relevantFixtures.length,
  });
  const metrics = {
    firstTokenLatencyMs: frameBudget.timings.lmStudioFirstTokenMs,
    totalLatencyMs: frameBudget.timings.totalTurnMs,
    prePromptBudgetMs: config.prePromptBudgetMs,
    candidatesInspected: frameBudget.workDone.rawCandidatesInspected,
    candidatesRendered: frameBudget.workDone.candidatesRendered,
    staticOnlyRenderedCount: frameBudget.workDone.staticOnlyRendered,
    openLoopsScored: frameBudget.workDone.openLoopsScored,
    openLoopsRendered: relevantFixtures.reduce((sum, fixture) => (
      sum + renderedOpenLoopCountForFixture(fixture, config)
    ), 0),
    promptTokenDelta: frameBudget.quality.promptTokenDelta,
    staleCorrectionFailures: alivenessSummary.correctionFailures,
    overclaimRegressions: alivenessSummary.overclaimRegressions,
    humanObservableWins: alivenessSummary.humanObservableWins,
    annoyanceRegressions: alivenessSummary.annoyanceRegressions,
    runtimeMetricsMeasured: false,
  };
  return {
    id: normalizedMode,
    label: config.label,
    alivenessMode: config.alivenessMode,
    measurementMode: 'fixture',
    featureFlags: modeFeatureFlags(normalizedMode),
    caseCount: relevantFixtures.length,
    caseIds: relevantFixtures.map((fixture) => fixture.id),
    frameBudget,
    frameBudgetSummary: summarizeFrameBudget([frameBudget]),
    sidecarSchedule,
    alivenessSummary: {
      schema: ALIVENESS_COMPARE_SCHEMA,
      caseCount: alivenessSummary.caseCount,
      pass: alivenessSummary.pass,
      verdict: alivenessSummary.verdict,
      humanObservableWins: alivenessSummary.humanObservableWins,
      continuityWins: alivenessSummary.continuityWins,
      overclaimRegressions: alivenessSummary.overclaimRegressions,
      annoyanceRegressions: alivenessSummary.annoyanceRegressions,
      sourceBoundaryFailures: alivenessSummary.sourceBoundaryFailures,
      correctionFailures: alivenessSummary.correctionFailures,
      promptBloatRegressions: alivenessSummary.promptBloatRegressions,
      latencyRegressions: alivenessSummary.latencyRegressions,
    },
    metrics,
    limits: [
      'Fixture mode records budget shape and scenario expectations only; live latency remains null/not-run.',
      'Mode wins and regressions come from aliveness fixtures and do not prove answer quality by themselves.',
    ],
  };
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function delta(featureValue, baselineValue) {
  const feature = numericOrNull(featureValue);
  const baseline = numericOrNull(baselineValue);
  if (feature === null || baseline === null) return null;
  return feature - baseline;
}

function buildModeDeltas(modes = []) {
  const baseline = modes.find((mode) => mode.id === FRAME_BUDGET_COMPARE_MODES.BASELINE) || null;
  const baselineMetrics = baseline?.metrics || {};
  const out = {};
  for (const mode of modes) {
    if (mode.id === FRAME_BUDGET_COMPARE_MODES.BASELINE) continue;
    const metrics = mode.metrics || {};
    out[mode.id] = {
      firstTokenLatencyDeltaMs: delta(metrics.firstTokenLatencyMs, baselineMetrics.firstTokenLatencyMs),
      totalLatencyDeltaMs: delta(metrics.totalLatencyMs, baselineMetrics.totalLatencyMs),
      prePromptBudgetDeltaMs: delta(metrics.prePromptBudgetMs, baselineMetrics.prePromptBudgetMs),
      candidatesInspectedDelta: delta(metrics.candidatesInspected, baselineMetrics.candidatesInspected),
      candidatesRenderedDelta: delta(metrics.candidatesRendered, baselineMetrics.candidatesRendered),
      staticOnlyRenderedDelta: delta(metrics.staticOnlyRenderedCount, baselineMetrics.staticOnlyRenderedCount),
      openLoopsRenderedDelta: delta(metrics.openLoopsRendered, baselineMetrics.openLoopsRendered),
      promptTokenDelta: delta(metrics.promptTokenDelta, baselineMetrics.promptTokenDelta),
      humanObservableWinDelta: delta(metrics.humanObservableWins, baselineMetrics.humanObservableWins),
      annoyanceRegressionDelta: delta(metrics.annoyanceRegressions, baselineMetrics.annoyanceRegressions),
      overclaimRegressionDelta: delta(metrics.overclaimRegressions, baselineMetrics.overclaimRegressions),
    };
  }
  return out;
}

function buildFrameBudgetCompareSummary(modes = []) {
  const receipts = modes.map((mode) => mode.frameBudget).filter(Boolean);
  const deltas = buildModeDeltas(modes);
  const bounded = modes.find((mode) => mode.id === FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS) || {};
  const metrics = bounded.metrics || {};
  const hasBlockingRegression = Number(metrics.overclaimRegressions || 0) > 0
    || Number(metrics.annoyanceRegressions || 0) > 0
    || Number(metrics.staleCorrectionFailures || 0) > 0;
  return {
    schema: PENNY_FRAME_BUDGET_COMPARE_SCHEMA,
    frameBudgetSchema: PENNY_FRAME_BUDGET_SCHEMA,
    measurementMode: 'fixture',
    modeCount: modes.length,
    comparedModeCount: Math.max(0, modes.length - 1),
    baselineMode: FRAME_BUDGET_COMPARE_MODES.BASELINE,
    requiredModesPresent: REQUIRED_FRAME_BUDGET_COMPARE_MODES.every((mode) => modes.some((item) => item.id === mode)),
    frameBudgetSummary: summarizeFrameBudget(receipts),
    deltas,
    humanObservableWins: modes.reduce((sum, mode) => sum + Number(mode.metrics?.humanObservableWins || 0), 0),
    annoyanceRegressions: modes.reduce((sum, mode) => sum + Number(mode.metrics?.annoyanceRegressions || 0), 0),
    overclaimRegressions: modes.reduce((sum, mode) => sum + Number(mode.metrics?.overclaimRegressions || 0), 0),
    staleCorrectionFailures: modes.reduce((sum, mode) => sum + Number(mode.metrics?.staleCorrectionFailures || 0), 0),
    runtimeMetricsMeasured: false,
    liveLatencyMeasured: false,
    livePromptTokensMeasured: false,
    boundedAliveness: {
      humanObservableWins: Number(metrics.humanObservableWins || 0),
      annoyanceRegressions: Number(metrics.annoyanceRegressions || 0),
      overclaimRegressions: Number(metrics.overclaimRegressions || 0),
      staleCorrectionFailures: Number(metrics.staleCorrectionFailures || 0),
      promptTokenDelta: Number(metrics.promptTokenDelta || 0),
      candidatesInspected: Number(metrics.candidatesInspected || 0),
      candidatesRendered: Number(metrics.candidatesRendered || 0),
    },
    recommendation: hasBlockingRegression
      ? 'blocked-by-fixture-regression'
      : 'eligible-for-live-frame-budget-measurement',
    verdict: hasBlockingRegression
      ? 'blocked-fixture-regression'
      : 'fixture-ready-for-live-measurement',
    guardrails: {
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      runtimeVoiceChanged: false,
      defaultPromptLimitsRaised: false,
      defaultRenderedMemoryLimitsRaised: false,
      answerQualityProof: false,
    },
  };
}

function buildFrameBudgetCompareArtifact({
  generatedAt = new Date().toISOString(),
  fixtures = buildAlivenessScenarioFixtures(),
} = {}) {
  const modes = REQUIRED_FRAME_BUDGET_COMPARE_MODES.map((mode) => buildModeSummary({
    generatedAt,
    mode,
    fixtures,
  }));
  return {
    schema: PENNY_FRAME_BUDGET_COMPARE_SCHEMA,
    frameBudgetSchema: PENNY_FRAME_BUDGET_SCHEMA,
    alivenessSchema: ALIVENESS_COMPARE_SCHEMA,
    artifactKind: FRAME_BUDGET_COMPARE_ARTIFACT_KIND,
    generatedAt,
    measurementMode: 'fixture',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    liveUserMemoryTouched: false,
    serverSpawned: false,
    lmStudioCalls: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    runtimeVoiceChanged: false,
    defaultPromptLimitsRaised: false,
    defaultRenderedMemoryLimitsRaised: false,
    memoryWrites: false,
    autonomousActions: false,
    modes,
    featureToggleMatrix: buildFrameBudgetFeatureToggleMatrix(),
    alivenessFeatureToggleMatrix: buildAlivenessFeatureToggleMatrix(),
    summary: buildFrameBudgetCompareSummary(modes),
    limits: [
      'Frame-budget compare fixture measures runtime-shape expectations, not answer quality.',
      'Fixture mode does not measure first-token or total live latency; those fields stay null.',
      'Spend budget first on relevance, source authority, and candidate selection before rendered context.',
      'No PromptTruth expansion, toolEvidenceReceipt merge, runtime voice change, or prompt/rendered-memory limit increase.',
      'A passing fixture can only recommend live frame-budget measurement, not default enablement.',
    ],
  };
}

function writeFrameBudgetCompareArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildFrameBudgetCompareArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseFrameBudgetCompareArgs(argv);
  if (!args.fixture || args.mode !== 'fixture') {
    throw new Error('Frame budget compare runner currently supports fixture mode only.');
  }
  const artifact = buildFrameBudgetCompareArtifact({ generatedAt: new Date().toISOString() });
  const written = writeFrameBudgetCompareArtifact({
    outputPath: args.outputPath,
    artifact,
  });
  console.log(`Frame budget compare fixture complete: ${written.outputPath}`);
  console.log(JSON.stringify({
    measurementMode: artifact.measurementMode,
    verdict: artifact.summary.verdict,
    recommendation: artifact.summary.recommendation,
    modeCount: artifact.summary.modeCount,
    boundedAliveness: artifact.summary.boundedAliveness,
  }, null, 2));
  return written;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  FRAME_BUDGET_COMPARE_ARTIFACT_KIND,
  FRAME_BUDGET_MODE_CONFIGS,
  OUTPUT_PATH,
  buildFrameBudgetCompareArtifact,
  buildFrameBudgetCompareSummary,
  buildFrameBudgetFeatureToggleMatrix,
  buildModeDeltas,
  buildModeSummary,
  collectModeWork,
  main,
  modeFeatureFlags,
  parseArgValue,
  parseFrameBudgetCompareArgs,
  writeFrameBudgetCompareArtifact,
};
