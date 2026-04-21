const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConstellationRubric,
  buildOverComplianceAudit,
  buildVoiceQaTrace,
  buildPromptPlan,
  classifyLatencyBucket,
  classifyPremiseCaveatPosition,
  evaluateExactRecall,
  evaluateSpiritFirstRecall,
  resolveModelManagementMode,
  resolvePromptSet,
} = require('../scripts/qa-penny-voice-redo');

test('resolvePromptSet keeps supported prompt-set names and falls back safely', () => {
  assert.equal(resolvePromptSet('tiebreak'), 'tiebreak');
  assert.equal(resolvePromptSet('constellation'), 'constellation');
  assert.equal(resolvePromptSet('full'), 'full');
  assert.equal(resolvePromptSet('not-a-real-set'), 'core');
});

test('resolveModelManagementMode can verify preloaded models without unload/load actions', () => {
  const managed = resolveModelManagementMode({});
  assert.equal(managed.manageModels, true);
  assert.equal(managed.loadChatModel, true);
  assert.equal(managed.loadEmbedModel, true);
  assert.equal(managed.prepareReportOnly, false);
  assert.equal(managed.loadStrategy, 'sequential-lane-switch');

  const preloaded = resolveModelManagementMode({
    PENNY_QA_MANAGE_MODELS: '0',
    PENNY_QA_LOAD_CHAT_MODEL: '1',
    PENNY_QA_LOAD_EMBED_MODEL: '1',
  });
  assert.equal(preloaded.manageModels, false);
  assert.equal(preloaded.loadChatModel, false);
  assert.equal(preloaded.loadEmbedModel, false);
  assert.equal(preloaded.prepareReportOnly, true);
  assert.equal(preloaded.repairPreset, false);
  assert.equal(preloaded.loadStrategy, 'preloaded-no-model-management');
});

test('buildPromptPlan keeps the tiebreak slice chat-only and focused on recall behavior', () => {
  const plan = buildPromptPlan('tiebreak');
  assert.deepEqual(plan.map((item) => item.name), [
    'casual_banter',
    'sharp_bite',
    'delight_weirdness',
    'repair_after_bite',
    'softness',
    'practical_momentum',
    'spirit_first_recall',
    'exact_memory_recall',
  ]);
  assert.equal(plan.some((item) => item.name === 'agentic_inspect_honesty'), false);
  assert.equal(plan.some((item) => item.kind === 'scenario'), true);
  assert.equal(plan.some((item) => item.kind === 'memory'), true);
  assert.equal(plan.every((item) => item.lane === 'chat'), true);
  assert.equal(plan.some((item) => item.name.includes('protect')), false);
});

test('buildPromptPlan keeps the constellation slice chat-only with rubric axes', () => {
  const plan = buildPromptPlan('constellation');
  assert.deepEqual(plan.map((item) => item.name), [
    'exact_detail_pounce',
    'survival_bite',
    'joy_voltage',
    'warmth_backbone',
    'precision_cut',
    'chaos_plan',
    'attachment_return',
    'repair_after_bite',
    'charged_not_explicit',
    'boundary_refusal',
  ]);
  assert.equal(plan.every((item) => item.kind === 'turn'), true);
  assert.equal(plan.every((item) => item.lane === 'chat'), true);
  assert.equal(plan.every((item) => Array.isArray(item.rubricAxes) && item.rubricAxes.length > 0), true);
  assert.ok(plan.find((item) => item.name === 'charged_not_explicit').rubricAxes.includes('charged_appetite'));
});

test('buildConstellationRubric emits manual score metadata for the prompt plan', () => {
  const plan = buildPromptPlan('constellation');
  const rubric = buildConstellationRubric(plan);

  assert.equal(rubric.version, 'penny-constellation-rubric.v1');
  assert.equal(rubric.mode, 'manual-metadata');
  assert.deepEqual(Object.keys(rubric.scoringScale), ['1', '3', '5']);
  assert.ok(rubric.axes.penny_cohesion);
  assert.ok(rubric.antiScores.honestly_opener);
  assert.deepEqual(rubric.prompts.map((item) => item.name), plan.map((item) => item.name));
  assert.deepEqual(
    rubric.prompts.find((item) => item.name === 'boundary_refusal').intendedAxes,
    ['charged_appetite', 'warmth_with_backbone', 'penny_cohesion'],
  );
  assert.equal(rubric.prompts[0].manualScores.axes.joy_voltage, null);
  assert.equal(rubric.prompts[0].manualScores.antiScores.honestly_opener, null);
  assert.match(rubric.guardrails.join(' '), /influence clusters/i);
});

test('buildOverComplianceAudit flags honestly openers without using repetition watchlist', () => {
  const audit = buildOverComplianceAudit([
    {
      name: 'constellation_reply',
      ok: true,
      seconds: 1,
      text: 'Honestly? that is the tiny gremlin problem.',
    },
  ]);
  const honestly = audit.checks.find((item) => item.name === 'honestly_opener');

  assert.equal(audit.passed, false);
  assert.equal(honestly.passed, false);
  assert.deepEqual(honestly.flagged, ['constellation_reply']);
});

test('buildOverComplianceAudit does not flag honestly in the middle of a reply', () => {
  const audit = buildOverComplianceAudit([
    {
      name: 'constellation_reply',
      ok: true,
      seconds: 1,
      text: 'That is honestly the tiny gremlin problem.',
    },
  ]);
  const honestly = audit.checks.find((item) => item.name === 'honestly_opener');

  assert.equal(audit.passed, true);
  assert.equal(honestly.passed, true);
  assert.deepEqual(honestly.flagged, []);
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
