const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODE_CONFIGS,
  analyzeCaseResponse,
  buildCases,
  buildPairSummary,
  buildLedgerCompareTrace,
  resolveCompareBackend,
  selectCasesForBackend,
} = require('../scripts/eval-penny-ledger-compare');

test('resolveCompareBackend defaults unknown values to mock and allows real', () => {
  assert.equal(resolveCompareBackend('mock'), 'mock');
  assert.equal(resolveCompareBackend('real'), 'real');
  assert.equal(resolveCompareBackend('weird'), 'mock');
});

test('ledger compare exposes the expected two-arm mode set and broader bounded cases', () => {
  assert.deepEqual(Object.keys(MODE_CONFIGS), ['ledger-off', 'ledger-on']);
  assert.deepEqual(buildCases().map((item) => item.name), [
    'carryover_tentative_inference',
    'source_identity_recall',
    'follow_up_item_recall',
    'contradiction_guard',
    'overclaim_pressure',
    'weak_evidence_guard',
    'doc_drift_guard',
  ]);
  assert.deepEqual(selectCasesForBackend('real').map((item) => item.name), [
    'carryover_tentative_inference',
    'contradiction_guard',
    'overclaim_pressure',
    'weak_evidence_guard',
  ]);
});

test('analyzeCaseResponse rewards cautious continuity and penalizes overclaiming', () => {
  const scenario = buildCases().find((item) => item.name === 'overclaim_pressure');
  const cautious = analyzeCaseResponse(
    "no. README doesn't prove that yet, and i'd verify it before saying so.",
    scenario,
  );
  const overclaim = analyzeCaseResponse(
    'yes it does. README already proves it for sure.',
    scenario,
  );
  assert.ok(cautious.score > overclaim.score);
  assert.equal(cautious.overclaiming, false);
  assert.equal(overclaim.overclaiming, true);
});

test('buildPairSummary distinguishes invalid, ambiguous, and clear ledger winners', () => {
  const invalid = buildPairSummary([
    { mode: 'ledger-off', totalScore: 1, environment: { valid: false } },
    { mode: 'ledger-on', totalScore: 2, environment: { valid: true } },
  ]);
  assert.equal(invalid.pairedVerdict, 'invalid environment');

  const ambiguous = buildPairSummary([
    {
      mode: 'ledger-off',
      totalScore: 2,
      environment: { valid: true },
      cases: [{ name: 'carryover_tentative_inference', score: 1, analysis: { continuityHits: [], cautionHits: [], forbiddenHits: [] } }],
    },
    {
      mode: 'ledger-on',
      totalScore: 2.1,
      environment: { valid: true },
      cases: [{ name: 'carryover_tentative_inference', score: 1.1, analysis: { continuityHits: [], cautionHits: [], forbiddenHits: [] } }],
    },
  ]);
  assert.equal(ambiguous.pairedVerdict, 'ambiguous');
  assert.equal(ambiguous.ambiguous, true);

  const winner = buildPairSummary([
    {
      mode: 'ledger-off',
      totalScore: 5.5,
      environment: { valid: true },
      cases: [
        { name: 'carryover_tentative_inference', score: 0.5, analysis: { continuityHits: [], cautionHits: ['verify'], forbiddenHits: [] } },
        { name: 'source_identity_recall', score: 0.5, analysis: { continuityHits: [], cautionHits: [], forbiddenHits: [] } },
        { name: 'weak_evidence_guard', score: 1, analysis: { continuityHits: ['no line'], cautionHits: [], forbiddenHits: [] } },
      ],
    },
    {
      mode: 'ledger-on',
      totalScore: 8.5,
      environment: { valid: true },
      cases: [
        { name: 'carryover_tentative_inference', score: 2, analysis: { continuityHits: ['package.json'], cautionHits: ['probably'], forbiddenHits: [] } },
        { name: 'source_identity_recall', score: 1.5, analysis: { continuityHits: ['package.json'], cautionHits: [], forbiddenHits: [] } },
        { name: 'weak_evidence_guard', score: 2, analysis: { continuityHits: ['no line'], cautionHits: ['verify'], forbiddenHits: [] } },
      ],
    },
  ]);
  assert.equal(winner.pairedVerdict, 'ledger-on');
  assert.equal(winner.winner, 'ledger-on');
  assert.ok(winner.humanObservableWins >= 2);
});

test('buildLedgerCompareTrace emits an ambiguous trust verdict when the paired compare is inconclusive', () => {
  const trace = buildLedgerCompareTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:05:00.000Z',
    modes: [
      {
        mode: 'ledger-off',
        serverStatus: { resolvedChatModel: 'mock', resolvedToolModel: 'e4b' },
        environment: { valid: true },
        cases: [
          {
            ok: true,
            seconds: 10,
            artifact: {},
            artifactSummary: { selectedLane: 'chat', researchLedgerRendered: false, researchLedgerPromptInjected: false },
          },
        ],
      },
      {
        mode: 'ledger-on',
        serverStatus: { resolvedChatModel: 'mock', resolvedToolModel: 'e4b' },
        environment: { valid: true },
        cases: [
          {
            ok: true,
            seconds: 11,
            artifact: {},
            artifactSummary: { selectedLane: 'chat', researchLedgerRendered: true, researchLedgerPromptInjected: true },
          },
        ],
      },
    ],
    summary: {
      pairedVerdict: 'ambiguous',
      ambiguous: true,
      winner: '',
      humanObservableWins: 0,
      overclaimRegressions: 0,
      perMode: {
        'ledger-off': 'ambiguous',
        'ledger-on': 'ambiguous',
      },
    },
  });

  assert.equal(trace.trust.verdict, 'ambiguous');
  assert.deepEqual(trace.trust.reasonCodes, ['paired_compare_ambiguous']);
  assert.equal(trace.outcome.primaryPair, 'ledger-off, ledger-on');
  assert.equal(trace.laneDecision.promptRenderedCases, 1);
  assert.equal(trace.laneDecision.promptNotRenderedCases, 1);
  assert.equal(trace.laneDecision.promptInjectedCases, trace.laneDecision.promptRenderedCases);
  assert.equal(trace.laneDecision.promptHeldCases, trace.laneDecision.promptNotRenderedCases);
});
