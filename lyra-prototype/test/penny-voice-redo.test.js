const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVoiceQaTrace,
  buildPromptPlan,
  classifyLatencyBucket,
  classifyPremiseCaveatPosition,
  evaluateExactRecall,
  evaluateSpiritFirstRecall,
  resolvePromptSet,
} = require('../scripts/qa-penny-voice-redo');

test('resolvePromptSet keeps supported prompt-set names and falls back safely', () => {
  assert.equal(resolvePromptSet('tiebreak'), 'tiebreak');
  assert.equal(resolvePromptSet('full'), 'full');
  assert.equal(resolvePromptSet('not-a-real-set'), 'core');
});

test('buildPromptPlan keeps the tiebreak slice chat-only and focused on recall behavior', () => {
  const plan = buildPromptPlan('tiebreak');
  assert.deepEqual(plan.map((item) => item.name), [
    'casual_banter',
    'softness',
    'spirit_first_recall',
    'exact_memory_recall',
  ]);
  assert.equal(plan.some((item) => item.name === 'agentic_inspect_honesty'), false);
  assert.equal(plan.some((item) => item.kind === 'scenario'), true);
  assert.equal(plan.some((item) => item.kind === 'memory'), true);
});

test('evaluateSpiritFirstRecall distinguishes answer-first from caveat-first recall', () => {
  const strong = evaluateSpiritFirstRecall('flirting with me all night. yes, technically you framed it as hypothetical, but that was the phrase.');
  const weak = evaluateSpiritFirstRecall("technically, you framed it as hypothetical. you said she'd been flirting with me all night.");

  assert.equal(strong.recallSpiritFirst, true);
  assert.equal(strong.premiseCaveatPosition, 'after-answer');
  assert.equal(weak.recallSpiritFirst, false);
  assert.equal(weak.premiseCaveatPosition, 'before-answer');
});

test('evaluateExactRecall accepts bounded direct location synonyms without caveat-first hedging', () => {
  const exact = evaluateExactRecall('brass, and you keep it beside your keyboard.');
  const synonym = evaluateExactRecall("Brass, and it's sitting right there by your keyboard.");
  const missing = evaluateExactRecall("you didn't actually say enough for me to know where it is.");

  assert.equal(exact.exactRecallDirect, true);
  assert.equal(synonym.exactRecallDirect, true);
  assert.equal(missing.exactRecallDirect, false);
  assert.equal(missing.premiseCaveatPosition, 'missing-answer');
});

test('classify helpers bucket latency and caveat order predictably', () => {
  assert.equal(classifyLatencyBucket(90), 'strong');
  assert.equal(classifyLatencyBucket(180), 'acceptable');
  assert.equal(classifyLatencyBucket(300), 'weak');
  assert.equal(classifyLatencyBucket(420), 'fail');
  assert.equal(
    classifyPremiseCaveatPosition('you said if some other girl had been flirting with me all night.', ['flirting with me all night']),
    'before-answer',
  );
});

test('buildVoiceQaTrace emits a normalized trust summary for degraded voice reruns', () => {
  const trace = buildVoiceQaTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:05:00.000Z',
    promptSet: 'tiebreak',
    prompts: [
      {
        ok: true,
        seconds: 12,
        localLane: 'chat',
        artifact: {
          scope: { selectedLane: 'chat' },
          readiness: { warmState: 'degraded' },
          performance: { archiveRetrieval: { sessionItems: 1, globalItems: 0 } },
        },
      },
    ],
    summary: {
      completed: 1,
      failed: 0,
      invalid: 0,
      totalSuccessfulSeconds: 12,
      averageSecondsSuccessful: 12,
    },
    repetitionAudit: { passed: true },
    overComplianceAudit: { passed: false },
    environment: {
      valid: false,
      degradedArtifacts: 1,
      reasons: ['runtime artifacts reported degraded readiness on 1 turn(s)'],
    },
  });

  assert.equal(trace.trust.verdict, 'degraded');
  assert.match(trace.trust.reasonCodes.join(','), /runtime_degraded/);
  assert.equal(trace.trust.environmentValid, false);
});
