const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVoiceQaTrace,
  buildPromptPlan,
  resolvePromptSet,
} = require('../scripts/qa-penny-voice-redo');

test('resolvePromptSet keeps supported prompt-set names and falls back safely', () => {
  assert.equal(resolvePromptSet('tiebreak'), 'tiebreak');
  assert.equal(resolvePromptSet('full'), 'full');
  assert.equal(resolvePromptSet('not-a-real-set'), 'core');
});

test('buildPromptPlan keeps the tiebreak slice focused on voice plus honesty pressure', () => {
  const plan = buildPromptPlan('tiebreak');
  assert.deepEqual(plan.map((item) => item.name), [
    'casual_banter',
    'softness',
    'agentic_inspect_honesty',
    'bad_premise_resistance',
    'uncertainty_calibration',
  ]);
  assert.equal(plan.some((item) => item.name === 'flirty_charge'), false);
  assert.equal(plan.some((item) => item.kind === 'memory'), false);
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
