const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  ALIVENESS_VERDICTS,
  classifyAlivenessCaseDelta,
  computeAlivenessVerdict,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

test('classifies a human-observable continuity win as pass-eligible', () => {
  const classified = classifyAlivenessCaseDelta({
    id: 'project-continuity',
    deltas: {
      humanObservableWin: true,
      continuityWin: true,
      promptTokenDelta: 36,
      totalLatencyDeltaMs: 120,
    },
  });

  assert.deepEqual(classified.outcomes, [
    ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    ALIVENESS_OUTCOMES.CONTINUITY_WIN,
  ]);
  assert.equal(classified.primaryOutcome, ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN);
  assert.equal(classified.passEligible, true);
  assert.equal(classified.metrics.promptTokenDelta, 36);
});

test('trust failures dominate wins in case classification and summary verdict', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'wins-but-overclaims',
      deltas: {
        humanObservableWin: true,
        continuityWin: true,
        overclaimRegression: true,
      },
    },
    {
      id: 'stale-correction',
      deltas: {
        humanObservableWin: true,
        correctionSafe: false,
      },
    },
  ]);

  assert.equal(summary.schema, ALIVENESS_COMPARE_SCHEMA);
  assert.equal(summary.humanObservableWins, 2);
  assert.equal(summary.continuityWins, 1);
  assert.equal(summary.overclaimRegressions, 1);
  assert.equal(summary.correctionFailures, 1);
  assert.equal(summary.trustFailureCount, 2);
  assert.equal(summary.pass, false);
  assert.equal(summary.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
  assert.deepEqual(summary.blockedOutcomes, [
    ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
    ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
  ]);
});

test('source-boundary failure blocks candidate-only aliveness claims', () => {
  const classified = classifyAlivenessCaseDelta({
    id: 'candidate-only-truth',
    deltas: {
      humanObservableWin: true,
      candidateOnlyTruthLaundered: true,
    },
  });

  assert.equal(classified.passEligible, false);
  assert.ok(classified.trustFailures.includes(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE));

  const verdict = computeAlivenessVerdict(summarizeAlivenessCompare([classified]));
  assert.equal(verdict.pass, false);
  assert.equal(verdict.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
});

test('no meaningful change does not pass without positive aliveness outcomes', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'baseline-tie',
      deltas: {
        promptTokenDelta: 0,
        totalLatencyDeltaMs: 0,
      },
    },
  ]);

  assert.equal(summary.noMeaningfulChanges, 1);
  assert.equal(summary.positiveOutcomeCount, 0);
  assert.equal(summary.pass, false);
  assert.equal(summary.verdict, ALIVENESS_VERDICTS.NO_MEANINGFUL_CHANGE);
});

test('annoyance, prompt bloat, and latency regressions block non-trust pass verdicts', () => {
  const promptBloatSummary = summarizeAlivenessCompare([
    {
      id: 'prompt-bloat',
      deltas: {
        humanObservableWin: true,
        promptTokenDelta: 900,
      },
      thresholds: {
        maxPromptTokenDelta: 300,
      },
    },
  ]);

  assert.equal(promptBloatSummary.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(promptBloatSummary.blockedOutcomes, [ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION]);

  const latencyVerdict = computeAlivenessVerdict(
    summarizeAlivenessCompare([
      {
        id: 'slow-but-nice',
        deltas: {
          humanObservableWin: true,
          totalLatencyDeltaMs: 1500,
        },
      },
    ]),
    { maxTotalLatencyDeltaMs: 1000 },
  );

  assert.equal(latencyVerdict.pass, false);
  assert.equal(latencyVerdict.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(latencyVerdict.blockedOutcomes, [ALIVENESS_OUTCOMES.LATENCY_REGRESSION]);

  const annoyanceSummary = summarizeAlivenessCompare([
    {
      id: 'naggy-open-loop',
      deltas: {
        humanObservableWin: true,
        annoyanceRegression: true,
      },
    },
  ]);

  assert.equal(annoyanceSummary.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(annoyanceSummary.blockedOutcomes, [ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION]);
});

test('custom thresholds can require multiple visible wins before pass', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'one-helpful-move',
      deltas: { humanObservableWin: true },
    },
  ]);

  assert.equal(summary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);

  const stricter = computeAlivenessVerdict(summary, { minPositiveOutcomes: 2 });
  assert.equal(stricter.pass, false);
  assert.equal(stricter.verdict, ALIVENESS_VERDICTS.NO_MEANINGFUL_CHANGE);
  assert.deepEqual(stricter.blockedOutcomes, [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE]);
});
