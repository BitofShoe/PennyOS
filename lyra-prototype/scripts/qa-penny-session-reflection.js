const fs = require('fs');
const path = require('path');

const {
  PENNY_SESSION_REFLECTION_SCHEMA,
  normalizeSessionReflection,
  summarizeSessionReflection,
  validateSessionReflection,
} = require('../lib/penny-session-reflection');

const {
  MEMORY_SUGGESTION_ACTIONS,
  PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
  classifyMemorySuggestions,
  summarizeMemorySuggestionPolicy,
} = require('../lib/penny-memory-suggestions');

const SESSION_REFLECTION_FIXTURE_SCHEMA = 'penny-session-reflection-fixture.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `session-reflection-fixture-${STAMP}.json`);

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

function parseSessionReflectionArgs(argv = process.argv.slice(2)) {
  return {
    fixture: hasArgFlag('fixture', argv) || parseArgValue('mode', argv) === 'fixture',
    outputPath: parseArgValue('output', argv) || OUTPUT_PATH,
    generatedAt: parseArgValue('generated-at', argv) || '',
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function includesAction(results = [], action = '') {
  return !action || results.some((item) => item.action === action);
}

function everyPolicyResult(results = [], predicate = () => true) {
  return results.every((item) => item && predicate(item));
}

function turnReceipt(caseId, turnId, excerpt) {
  return {
    type: 'turn',
    id: `${caseId}:${turnId}`,
    excerpt,
  };
}

function buildFixtureCases() {
  return [
    {
      id: 'stable-user-preference',
      description: 'Repeated explicit requests for detailed slice-by-slice plans become review-gated preference suggestions.',
      conversation: [
        { id: 'turn-1', role: 'user', text: 'Please keep this slice-by-slice and detailed.' },
        { id: 'turn-3', role: 'user', text: 'Long detailed implementation plans help me follow the work.' },
        { id: 'turn-5', role: 'user', text: 'Do the next slice the same way: detailed, with verification.' },
      ],
      summary: {
        short: 'The user repeatedly asked for detailed slice-by-slice implementation work.',
        confidence: 'high',
      },
      memoryCandidates: [
        {
          id: 'pref-detailed-slice-plans',
          text: 'User prefers detailed, slice-by-slice implementation plans with verification notes.',
          kind: 'user-preference',
          support: 'repeated explicit user preference',
          mentionCount: 3,
          confidence: 'high',
          sourceReceipts: [
            turnReceipt('stable-user-preference', 'turn-1', 'Please keep this slice-by-slice and detailed.'),
            turnReceipt('stable-user-preference', 'turn-3', 'Long detailed implementation plans help me follow the work.'),
          ],
        },
      ],
      expected: {
        action: MEMORY_SUGGESTION_ACTIONS.SUGGEST,
        reflectionMemorySuggestionCount: 1,
      },
    },
    {
      id: 'project-decision-open-loop-only',
      description: 'Project decisions route to decisions/open-loop updates, not user explicit memory.',
      conversation: [
        { id: 'turn-1', role: 'user', text: 'Static embeddings should become live-advisory, not authority.' },
        { id: 'turn-2', role: 'assistant', text: 'I will keep static embeddings advisory and source-aware.' },
      ],
      summary: {
        short: 'Static embeddings were framed as live-advisory discovery, not truth authority.',
        confidence: 'high',
      },
      decisions: [
        {
          id: 'static-embeddings-live-advisory',
          text: 'Static embeddings should become live-advisory discovery, not authority.',
          status: 'decided',
          support: 'repo-source',
          sourceReceipts: [
            { type: 'plan', path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md' },
          ],
        },
      ],
      openLoopUpdates: [
        {
          loopId: 'static-embedding-live-advisory-review',
          action: 'update',
          title: 'Static embeddings live-advisory review',
          nextLikelyStep: 'Keep static candidates advisory until a later measured slice proves live prompt value.',
          support: 'repo-source',
        },
      ],
      reflectionMemorySuggestions: [],
      memoryCandidates: [
        {
          id: 'project-static-embedding-decision',
          text: 'Static embeddings should become live-advisory, not authority.',
          kind: 'project-decision',
          support: 'repo source decision',
          sourceReceipts: [
            { type: 'plan', path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md' },
          ],
        },
      ],
      expected: {
        action: MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY,
        reflectionMemorySuggestionCount: 0,
        openLoopUpdateCount: 1,
      },
    },
    {
      id: 'temporary-affect-do-not-save',
      description: 'A temporary affect statement is do-not-save, not memory.',
      conversation: [
        { id: 'turn-1', role: 'user', text: "I'm hyped right now." },
      ],
      summary: {
        short: 'The user expressed a temporary current-session affect state.',
        confidence: 'medium',
      },
      memoryCandidates: [
        {
          id: 'temporary-hyped-state',
          text: "User is hyped right now.",
          kind: 'user-preference',
          support: 'explicit user statement during this session',
          sourceReceipts: [
            turnReceipt('temporary-affect-do-not-save', 'turn-1', "I'm hyped right now."),
          ],
        },
      ],
      expected: {
        action: MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE,
        reflectionDoNotSaveReason: 'temporary',
        policyReason: 'temporary-session-state',
      },
    },
    {
      id: 'correction-preserves-old-new',
      description: 'A correction suggestion preserves stale prior and current value for review.',
      conversation: [
        { id: 'turn-1', role: 'user', text: 'Correction: the old mascot was brass fox, but the current mascot is copper rabbit.' },
      ],
      summary: {
        short: 'The user supplied an explicit correction from a stale mascot value to a current one.',
        confidence: 'high',
      },
      memoryCandidates: [
        {
          id: 'mascot-copper-rabbit-correction',
          text: 'The current mascot is copper rabbit.',
          kind: 'correction',
          supportState: 'existing-explicit-correction',
          existingMemoryId: 'mascot-memory',
          oldText: 'The mascot is brass fox.',
          newText: 'The mascot is copper rabbit.',
          confidence: 'high',
          sourceReceipts: [
            turnReceipt('correction-preserves-old-new', 'turn-1', 'the old mascot was brass fox, but the current mascot is copper rabbit'),
          ],
        },
      ],
      expected: {
        action: MEMORY_SUGGESTION_ACTIONS.SUGGEST,
        correctionOldText: 'The mascot is brass fox.',
        correctionNewText: 'The mascot is copper rabbit.',
      },
    },
    {
      id: 'sensitive-document-field-held-back',
      description: 'Sensitive document fields are high sensitivity and never auto-saved.',
      conversation: [
        { id: 'turn-1', role: 'user', text: 'This document has a home address field; do not just save it as memory.' },
      ],
      summary: {
        short: 'A document field contained sensitive address-like personal data.',
        confidence: 'high',
      },
      memoryCandidates: [
        {
          id: 'document-address-field',
          text: 'A source document includes a home address field for the user.',
          kind: 'stable-fact',
          support: 'source-backed document field',
          sensitivity: 'high',
          sourceReceipts: [
            { type: 'fixture-document', id: 'doc-address-field', excerpt: 'home address field present' },
          ],
        },
      ],
      expected: {
        action: MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE,
        sensitivity: 'high',
        policyReason: 'sensitive-personal-data-requires-explicit-review',
      },
    },
  ];
}

function buildReflectionForCase(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const turnIds = (Array.isArray(caseSpec.conversation) ? caseSpec.conversation : [])
    .map((turn) => String(turn?.id || '').trim())
    .filter(Boolean);
  const reflectionMemorySuggestions = Object.prototype.hasOwnProperty.call(caseSpec, 'reflectionMemorySuggestions')
    ? caseSpec.reflectionMemorySuggestions
    : caseSpec.memoryCandidates;

  return normalizeSessionReflection({
    generatedAt,
    sessionId: `r3-${caseSpec.id || 'fixture'}`,
    measurementMode: 'artifact-only',
    liveModelCalls: false,
    behaviorChanged: false,
    sourceWindow: {
      turnIds,
      includedArtifacts: [
        {
          type: 'fixture-conversation',
          id: caseSpec.id,
          label: caseSpec.description,
        },
      ],
    },
    summary: caseSpec.summary,
    decisions: caseSpec.decisions || [],
    openLoopUpdates: caseSpec.openLoopUpdates || [],
    memorySuggestions: reflectionMemorySuggestions || [],
    doNotSave: caseSpec.doNotSave || [],
  });
}

function buildCaseResult(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const reflection = buildReflectionForCase(caseSpec, generatedAt);
  const validation = validateSessionReflection(reflection);
  const policy = classifyMemorySuggestions(caseSpec.memoryCandidates || []);
  const expected = caseSpec.expected || {};
  const policyResults = policy.results || [];
  const suggestedExplicitMemory = policyResults
    .map((item) => item.suggestedExplicitMemory)
    .find(Boolean) || null;

  const actionPass = includesAction(policyResults, expected.action);
  const reflectionCountPass = expected.reflectionMemorySuggestionCount === undefined
    || reflection.memorySuggestions.length === expected.reflectionMemorySuggestionCount;
  const openLoopCountPass = expected.openLoopUpdateCount === undefined
    || reflection.openLoopUpdates.length === expected.openLoopUpdateCount;
  const doNotSaveReasonPass = !expected.reflectionDoNotSaveReason
    || reflection.doNotSave.some((item) => item.reason === expected.reflectionDoNotSaveReason);
  const policyReasonPass = !expected.policyReason
    || policyResults.some((item) => item.reason === expected.policyReason);
  const sensitivityPass = !expected.sensitivity
    || policyResults.some((item) => item.sensitivity === expected.sensitivity);
  const correctionPass = !expected.correctionOldText
    || (
      suggestedExplicitMemory
      && suggestedExplicitMemory.oldText === expected.correctionOldText
      && suggestedExplicitMemory.newText === expected.correctionNewText
    );

  const policyDefaultsPass = everyPolicyResult(policyResults, (item) => (
    item.requiresApproval === true
    && item.autoPromoted === false
    && !!item.supportState
    && !!item.sensitivity
    && item.memoryWrites === false
    && item.canonicalMemoryWrites === false
    && item.promptTruthExpanded === false
    && item.toolEvidenceReceiptChanged === false
    && item.hiddenChainOfThoughtStored === false
    && item.runtimeVoiceChanged === false
  ));
  const reflectionDefaultsPass = reflection.memorySuggestions.every((item) => (
    item.requiresApproval === true
    && item.autoPromoted === false
    && !!item.supportState
    && !!item.sensitivity
  ));
  const guardrailsPass = validation.valid
    && reflection.liveModelCalls === false
    && reflection.behaviorChanged === false
    && reflection.memoryWrites === false
    && reflection.canonicalMemoryWrites === false
    && reflection.promptTruthExpanded === false
    && reflection.toolEvidenceReceiptChanged === false
    && reflection.hiddenChainOfThoughtStored === false
    && reflection.runtimeVoiceChanged === false;

  const pass = actionPass
    && reflectionCountPass
    && openLoopCountPass
    && doNotSaveReasonPass
    && policyReasonPass
    && sensitivityPass
    && correctionPass
    && policyDefaultsPass
    && reflectionDefaultsPass
    && guardrailsPass;

  return {
    id: String(caseSpec.id || '').trim(),
    description: String(caseSpec.description || '').trim(),
    generatedAt,
    pass,
    actionPass,
    reflectionCountPass,
    openLoopCountPass,
    doNotSaveReasonPass,
    policyReasonPass,
    sensitivityPass,
    correctionPass,
    policyDefaultsPass,
    reflectionDefaultsPass,
    guardrailsPass,
    expected,
    conversation: caseSpec.conversation || [],
    reflection,
    reflectionSummary: summarizeSessionReflection(reflection),
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    policy,
  };
}

function summarizeFixtureResults(results = []) {
  const policyResults = results.flatMap((item) => item.policy?.results || []);
  const policySummary = summarizeMemorySuggestionPolicy(policyResults);
  const actionCounts = policySummary.actionCounts || {};
  return {
    schema: SESSION_REFLECTION_FIXTURE_SCHEMA,
    caseCount: results.length,
    passingCaseCount: results.filter((item) => item.pass).length,
    failingCaseIds: results.filter((item) => !item.pass).map((item) => item.id),
    reflectionSchema: PENNY_SESSION_REFLECTION_SCHEMA,
    policySchema: PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
    policyCandidateCount: policySummary.candidateCount,
    suggestionCount: policySummary.suggestionCount,
    heldBackCount: policySummary.heldBackCount,
    doNotSaveCount: actionCounts[MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE] || 0,
    openLoopOnlyCount: actionCounts[MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY] || 0,
    needsMoreEvidenceCount: actionCounts[MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE] || 0,
    reflectionDoNotSaveCount: results.reduce((sum, item) => sum + item.reflection.doNotSave.length, 0),
    reflectionMemorySuggestionCount: results.reduce((sum, item) => sum + item.reflection.memorySuggestions.length, 0),
    allRequireApproval: policySummary.allRequireApproval === true
      && results.every((item) => item.reflectionDefaultsPass === true),
    autoPromotedCount: policySummary.autoPromotedCount,
    highSensitivityHeldBack: policyResults.some((item) => (
      item.sensitivity === 'high' && item.action === MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE
    )),
    correctionRelationshipPreserved: policyResults.some((item) => (
      item.suggestedExplicitMemory
      && item.suggestedExplicitMemory.kind === 'correction'
      && item.suggestedExplicitMemory.oldText
      && item.suggestedExplicitMemory.newText
    )),
    projectDecisionOpenLoopOnly: policyResults.some((item) => (
      item.action === MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY
      && item.reason === 'project-or-open-loop-note-not-user-memory'
    )),
    liveModelCalls: false,
    serverSpawned: false,
    livePromptBridge: false,
    memoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
}

function buildSessionReflectionFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const summary = summarizeFixtureResults(results);
  return {
    schema: SESSION_REFLECTION_FIXTURE_SCHEMA,
    reflectionSchema: PENNY_SESSION_REFLECTION_SCHEMA,
    policySchema: PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
    artifactKind: 'session-reflection-fixture',
    generatedAt,
    measurementMode: 'fixture-only',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    serverSpawned: false,
    livePromptBridge: false,
    memoryWrites: false,
    canonicalMemoryWrites: false,
    explicitMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    cases: results,
    summary,
    limits: [
      'Fixture-only reflection builder; no server spawn and no LM Studio calls.',
      'Reflection can suggest but cannot canonize.',
      'Memory suggestions require approval and autoPromoted=false.',
      'Reflection summaries are not truth proof.',
      'PromptTruth and toolEvidenceReceipt remain unchanged.',
      'Hidden chain-of-thought and runtime voice are not stored or changed.',
    ],
  };
}

function writeSessionReflectionFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildSessionReflectionFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function runSessionReflectionFixture(argv = process.argv.slice(2)) {
  const args = parseSessionReflectionArgs(argv);
  if (!args.fixture) {
    throw new Error('Session reflection QA currently supports --fixture only.');
  }
  const generatedAt = args.generatedAt || new Date().toISOString();
  const artifact = buildSessionReflectionFixtureArtifact({ generatedAt });
  return writeSessionReflectionFixtureArtifact({
    outputPath: args.outputPath,
    artifact,
  });
}

if (require.main === module) {
  try {
    const result = runSessionReflectionFixture();
    console.log(`Session reflection fixture complete: ${result.outputPath}`);
    console.log(JSON.stringify(result.artifact.summary, null, 2));
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  SESSION_REFLECTION_FIXTURE_SCHEMA,
  buildFixtureCases,
  buildReflectionForCase,
  buildCaseResult,
  buildSessionReflectionFixtureArtifact,
  writeSessionReflectionFixtureArtifact,
  parseSessionReflectionArgs,
  runSessionReflectionFixture,
};
