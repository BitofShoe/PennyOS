const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_SUGGESTION_ACTIONS,
} = require('../lib/penny-memory-suggestions');

const { SUPPORT_STATES } = require('../lib/penny-session-reflection');

const {
  SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA,
  SESSION_REFLECTION_FIXTURE_SCHEMA,
  buildExplicitApprovalPathFixture,
  buildFixtureCases,
  buildSessionReflectionFixtureArtifact,
  parseSessionReflectionArgs,
  writeSessionReflectionFixtureArtifact,
} = require('../scripts/qa-penny-session-reflection');

const GENERATED_AT = '2026-04-22T12:30:00.000Z';

function caseById(artifact, id) {
  const found = artifact.cases.find((item) => item.id === id);
  assert.ok(found, `missing fixture case ${id}`);
  return found;
}

test('session reflection fixture artifact is fixture-only and keeps authority guardrails explicit', () => {
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, SESSION_REFLECTION_FIXTURE_SCHEMA);
  assert.equal(artifact.artifactKind, 'session-reflection-fixture');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.canonicalMemoryWrites, false);
  assert.equal(artifact.explicitMemoryWrites, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.hiddenChainOfThoughtStored, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.summary.caseCount, 5);
  assert.equal(artifact.summary.passingCaseCount, 5);
  assert.equal(artifact.summary.allRequireApproval, true);
  assert.equal(artifact.summary.autoPromotedCount, 0);
  assert.equal(artifact.summary.highSensitivityHeldBack, true);
  assert.equal(artifact.summary.correctionRelationshipPreserved, true);
  assert.equal(artifact.summary.projectDecisionOpenLoopOnly, true);
  assert.equal(artifact.explicitApprovalPath.schema, SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA);
  assert.equal(artifact.explicitApprovalPath.diskMemoryWrites, false);
  assert.equal(artifact.summary.explicitApprovalPath.passingCaseCount, 4);
  assert.equal(artifact.summary.explicitApprovalPath.approvedExplicitMemoryWriteCount, 2);
  assert.equal(artifact.summary.explicitApprovalPath.candidateOnlyHeldWithoutOverride, true);
  assert.equal(artifact.summary.explicitApprovalPath.correctionRelationshipPreserved, true);
  assert.match(artifact.limits.join('\n'), /Reflection can suggest but cannot canonize/i);
  assert.match(artifact.limits.join('\n'), /PromptTruth and toolEvidenceReceipt remain unchanged/i);
});

test('explicit approval path fixture routes approved suggestions through explicit memory only after approval', () => {
  const fixture = buildExplicitApprovalPathFixture({ generatedAt: GENERATED_AT });
  const byId = new Map(fixture.results.map((item) => [item.id, item]));

  assert.equal(fixture.schema, SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA);
  assert.equal(fixture.measurementMode, 'fixture-only');
  assert.equal(fixture.diskMemoryWrites, false);
  assert.equal(fixture.promptTruthExpanded, false);
  assert.equal(fixture.toolEvidenceReceiptChanged, false);
  assert.equal(fixture.hiddenChainOfThoughtStored, false);
  assert.equal(fixture.runtimeVoiceChanged, false);
  assert.equal(fixture.summary.passingCaseCount, 4);
  assert.equal(fixture.summary.approvedExplicitMemoryWriteCount, 2);
  assert.equal(byId.get('approved-stable-preference').explicitMemoryWrite.explicitMemoryPath, 'mergeMemoryItems');
  assert.equal(byId.get('approved-stable-preference').explicitMemoryWrite.autoPromoted, false);
  assert.equal(byId.get('rejected-suggestion-no-write').reason, 'memory-suggestion-not-pending-or-approved');
  assert.equal(byId.get('candidate-only-held-without-override').reason, 'candidate-only-support-needs-additional-support-or-manual-override');
  assert.equal(byId.get('approved-correction-preserves-relation').explicitMemoryWrite.correction.oldText, 'The mascot is brass fox');
  assert.equal(byId.get('approved-correction-preserves-relation').explicitMemoryWrite.correction.newText, 'The mascot is copper rabbit');
});

test('fixture cases cover preference project decision temporary affect correction and sensitive document field', () => {
  const cases = buildFixtureCases();
  const ids = cases.map((item) => item.id);

  assert.deepEqual(ids, [
    'stable-user-preference',
    'project-decision-open-loop-only',
    'temporary-affect-do-not-save',
    'correction-preserves-old-new',
    'sensitive-document-field-held-back',
  ]);
});

test('stable preference case creates a review-gated suggestion with support state and non-promotion defaults', () => {
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });
  const preference = caseById(artifact, 'stable-user-preference');
  const result = preference.policy.results[0];

  assert.equal(preference.pass, true);
  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.SUGGEST);
  assert.equal(result.supportState, SUPPORT_STATES.REPEATED_EXPLICIT);
  assert.equal(result.sensitivity, 'low');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.requiresApproval, true);
  assert.equal(result.suggestedExplicitMemory.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.canonicalWriteAllowed, false);
  assert.equal(preference.reflection.memorySuggestions[0].requiresApproval, true);
  assert.equal(preference.reflection.memorySuggestions[0].autoPromoted, false);
});

test('project decisions are open-loop only and not user explicit memory candidates', () => {
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });
  const project = caseById(artifact, 'project-decision-open-loop-only');
  const result = project.policy.results[0];

  assert.equal(project.pass, true);
  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY);
  assert.equal(result.suggestedExplicitMemory, null);
  assert.equal(result.canonicalMemoryWrites, false);
  assert.equal(project.reflection.memorySuggestions.length, 0);
  assert.equal(project.reflection.decisions[0].memoryAuthority, 'advisory');
  assert.equal(project.reflection.openLoopUpdates.length, 1);
  assert.equal(project.reflection.openLoopUpdates[0].requiresReview, true);
});

test('temporary affect and sensitive document fields are held back without auto-save', () => {
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });
  const temporary = caseById(artifact, 'temporary-affect-do-not-save');
  const sensitive = caseById(artifact, 'sensitive-document-field-held-back');

  assert.equal(temporary.pass, true);
  assert.equal(temporary.policy.results[0].action, MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE);
  assert.equal(temporary.policy.results[0].reason, 'temporary-session-state');
  assert.equal(temporary.reflection.doNotSave[0].reason, 'temporary');
  assert.equal(temporary.policy.results[0].requiresApproval, true);
  assert.equal(temporary.policy.results[0].autoPromoted, false);

  assert.equal(sensitive.pass, true);
  assert.equal(sensitive.policy.results[0].action, MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE);
  assert.equal(sensitive.policy.results[0].sensitivity, 'high');
  assert.equal(sensitive.policy.results[0].suggestedExplicitMemory, null);
  assert.equal(sensitive.policy.results[0].requiresApproval, true);
  assert.equal(sensitive.policy.results[0].autoPromoted, false);
});

test('correction fixture preserves stale prior and current value for explicit review only', () => {
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });
  const correction = caseById(artifact, 'correction-preserves-old-new');
  const result = correction.policy.results[0];

  assert.equal(correction.pass, true);
  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.SUGGEST);
  assert.equal(result.supportState, SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.kind, 'correction');
  assert.equal(result.suggestedExplicitMemory.oldText, 'The mascot is brass fox.');
  assert.equal(result.suggestedExplicitMemory.newText, 'The mascot is copper rabbit.');
  assert.equal(result.suggestedExplicitMemory.canonicalWriteAllowed, false);
});

test('session reflection fixture writer writes requested artifact path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-session-reflection-fixture-'));
  const outputPath = path.join(dir, 'fixture.json');
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt: GENERATED_AT });
  const result = writeSessionReflectionFixtureArtifact({ outputPath, artifact });
  const readBack = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(readBack.schema, SESSION_REFLECTION_FIXTURE_SCHEMA);
  assert.equal(readBack.generatedAt, GENERATED_AT);
  assert.equal(readBack.summary.passingCaseCount, 5);
});

test('session reflection fixture arg parser supports --fixture and --output forms', () => {
  assert.deepEqual(parseSessionReflectionArgs(['--fixture', '--output', 'tmp/a.json']), {
    fixture: true,
    outputPath: 'tmp/a.json',
    generatedAt: '',
  });
  assert.deepEqual(parseSessionReflectionArgs(['--mode=fixture', '--output=tmp/b.json', '--generated-at=2026-04-22T00:00:00.000Z']), {
    fixture: true,
    outputPath: 'tmp/b.json',
    generatedAt: '2026-04-22T00:00:00.000Z',
  });
});
