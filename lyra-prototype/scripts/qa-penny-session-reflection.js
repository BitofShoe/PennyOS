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

const {
  addMemorySuggestionToQueue,
  approveMemorySuggestionQueueItemForExplicitMemory,
  createMemorySuggestionQueue,
  rejectMemorySuggestionQueueItem,
} = require('../lib/penny-memory-suggestion-queue');

const SESSION_REFLECTION_FIXTURE_SCHEMA = 'penny-session-reflection-fixture.v1';
const SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA = 'penny-session-reflection-explicit-approval-path-fixture.v1';
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
          memoryLinkTargets: ['plan:static-embedding-live-advisory'],
          sourceReceipts: [
            { type: 'plan', path: 'docs/plans/penny-static-embedding-live-advisory-plan-2026-04-22.md' },
          ],
        },
      ],
      memoryLinkSuggestions: [
        {
          id: 'static-plan-frame-budget-thread',
          sourceId: 'plan:static-embedding-live-advisory',
          targetId: 'principle:frame-budget',
          relation: 'same-project-thread',
          confidence: 'high',
          supportState: 'repo-source',
          sourceReceipts: [
            { type: 'plan', path: 'docs/plans/penny-static-embedding-live-advisory-plan-2026-04-22.md' },
            { type: 'plan', path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/01-frame-budget-runtime-plan.md' },
          ],
        },
        {
          id: 'static-plan-frame-budget-pattern',
          sourceId: 'plan:static-embedding-live-advisory',
          targetId: 'principle:frame-budget',
          relation: 'research-pattern-for',
          confidence: 'medium',
          supportState: 'repo-source',
          sourceReceipts: [
            { type: 'doc', path: 'docs/README.md', excerpt: 'Spend the per-turn runtime/context budget first on relevance.' },
          ],
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
        memoryLinkSuggestionCount: 3,
        memoryLinkSuggestionHeldBackCount: 0,
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
    memoryLinkSuggestions: caseSpec.memoryLinkSuggestions || caseSpec.linkSuggestions || [],
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
  const memoryLinkCountPass = expected.memoryLinkSuggestionCount === undefined
    || reflection.memoryLinkSuggestions.links.length === expected.memoryLinkSuggestionCount;
  const memoryLinkHeldBackPass = expected.memoryLinkSuggestionHeldBackCount === undefined
    || reflection.memoryLinkSuggestions.heldBack.length === expected.memoryLinkSuggestionHeldBackCount;
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
    && reflection.runtimeVoiceChanged === false
    && reflection.memoryLinkSuggestions.scoringActive === false
    && reflection.memoryLinkSuggestions.truthProof === false
    && reflection.memoryLinkSuggestions.behaviorChanged === false
    && reflection.memoryLinkSuggestions.links.every((link) => link.reviewState === 'needs-review');

  const pass = actionPass
    && reflectionCountPass
    && openLoopCountPass
    && memoryLinkCountPass
    && memoryLinkHeldBackPass
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
    memoryLinkCountPass,
    memoryLinkHeldBackPass,
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
  const reflectionLinkSets = results.map((item) => item.reflection?.memoryLinkSuggestions).filter(Boolean);
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
    reflectionMemoryLinkSuggestionCount: reflectionLinkSets.reduce((sum, item) => sum + item.links.length, 0),
    reflectionMemoryLinkHeldBackCount: reflectionLinkSets.reduce((sum, item) => sum + item.heldBack.length, 0),
    reflectionMemoryLinkNeedsReviewCount: reflectionLinkSets.reduce((sum, item) => sum + item.summary.needsReview, 0),
    reflectionMemoryLinkScoringActive: false,
    reflectionMemoryLinkTruthProof: false,
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
    reflectionProjectLinksReviewGated: reflectionLinkSets.some((item) => (
      item.links.some((link) => link.relation === 'same-project-thread')
      && item.links.some((link) => link.relation === 'research-pattern-for')
      && item.links.every((link) => link.reviewState === 'needs-review')
    )),
    reflectionOpenLoopLinksReviewGated: reflectionLinkSets.some((item) => (
      item.links.some((link) => link.relation === 'open-loop-about')
      && item.links.every((link) => link.reviewState === 'needs-review')
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

function buildExplicitApprovalPathFixture({ generatedAt = new Date().toISOString() } = {}) {
  const nowMs = Date.parse(generatedAt);
  const queue = createMemorySuggestionQueue({ createdAt: generatedAt });
  const stable = addMemorySuggestionToQueue(queue, {
    id: 'approval-pref-detailed-slices',
    text: 'User prefers detailed, slice-by-slice implementation plans with verification notes.',
    kind: 'user-preference',
    support: 'repeated explicit user preference',
    sourceReceipts: [
      turnReceipt('explicit-approval-stable-preference', 'turn-1', 'Please keep this slice-by-slice and detailed.'),
      turnReceipt('explicit-approval-stable-preference', 'turn-3', 'Long detailed implementation plans help me follow the work.'),
    ],
  }, {
    sourceReflectionId: 'r6-explicit-approval-fixture',
    createdAt: generatedAt,
  });
  const stableApproved = approveMemorySuggestionQueueItemForExplicitMemory(stable.queue, stable.item.id, {
    explicitApproval: true,
    reviewedAt: generatedAt,
    nowMs,
    memory: {
      sessionId: 'r6-explicit-approval-fixture',
      memories: [],
    },
  });

  const rejectedQueued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: generatedAt }), {
    id: 'approval-rejected-pref',
    text: 'User prefers broad daily-journal scans.',
    kind: 'user-preference',
    support: 'explicit user statement',
    sourceReceipts: [
      turnReceipt('explicit-approval-rejected', 'turn-1', 'Do not save this preference.'),
    ],
  }, {
    sourceReflectionId: 'r6-explicit-approval-rejected',
    createdAt: generatedAt,
  });
  const rejected = rejectMemorySuggestionQueueItem(rejectedQueued.queue, rejectedQueued.item.id, {
    reviewedAt: generatedAt,
  });
  const rejectedAttempt = approveMemorySuggestionQueueItemForExplicitMemory(rejected.queue, rejectedQueued.item.id, {
    explicitApproval: true,
    reviewedAt: generatedAt,
    memory: {
      sessionId: 'r6-explicit-approval-fixture',
      memories: [],
    },
  });

  const candidateQueued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: generatedAt }), {
    id: 'approval-candidate-only',
    text: 'User prefers short implementation summaries.',
    kind: 'user-preference',
    supportState: 'candidate-only',
    sourceReceipts: [
      { type: 'archive-candidate', id: 'candidate-only-1', excerpt: 'Archive-only weak candidate.' },
    ],
  }, {
    sourceReflectionId: 'r6-explicit-approval-candidate',
    createdAt: generatedAt,
  });
  const candidateHeld = approveMemorySuggestionQueueItemForExplicitMemory(candidateQueued.queue, candidateQueued.item.id, {
    explicitApproval: true,
    reviewedAt: generatedAt,
    memory: {
      sessionId: 'r6-explicit-approval-fixture',
      memories: [],
    },
  });

  const correctionQueued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: generatedAt }), {
    id: 'approval-mascot-correction',
    text: 'The current mascot is copper rabbit.',
    kind: 'correction',
    supportState: 'existing-explicit-correction',
    existingMemoryId: 'mascot-memory',
    oldText: 'The mascot is brass fox.',
    newText: 'The mascot is copper rabbit.',
    sourceReceipts: [
      turnReceipt('explicit-approval-correction', 'turn-1', 'the old mascot was brass fox, but the current mascot is copper rabbit'),
    ],
  }, {
    sourceReflectionId: 'r6-explicit-approval-correction',
    createdAt: generatedAt,
  });
  const correctionApproved = approveMemorySuggestionQueueItemForExplicitMemory(correctionQueued.queue, correctionQueued.item.id, {
    explicitApproval: true,
    reviewedAt: generatedAt,
    nowMs,
    memory: {
      sessionId: 'r6-explicit-approval-fixture',
      memories: [
        { text: 'The mascot is brass fox.', kind: 'explicit', ts: 1 },
        { text: 'Backup mug is orange.', kind: 'explicit', ts: 2 },
      ],
    },
  });

  const results = [
    {
      id: 'approved-stable-preference',
      pass: stableApproved.action === 'updated'
        && stableApproved.item.explicitMemoryWrite?.explicitMemoryPath === 'mergeMemoryItems'
        && stableApproved.memory.memories.some((item) => /slice-by-slice/i.test(item.text)),
      action: stableApproved.action,
      reason: stableApproved.reason,
      explicitMemoryWrite: stableApproved.item.explicitMemoryWrite || null,
      memoryPreview: stableApproved.memory.memories,
    },
    {
      id: 'rejected-suggestion-no-write',
      pass: rejectedAttempt.action === 'held'
        && rejectedAttempt.reason === 'memory-suggestion-not-pending-or-approved'
        && rejectedAttempt.memory.memories.length === 0,
      action: rejectedAttempt.action,
      reason: rejectedAttempt.reason,
      explicitMemoryWrite: null,
    },
    {
      id: 'candidate-only-held-without-override',
      pass: candidateHeld.action === 'held'
        && candidateHeld.reason === 'candidate-only-support-needs-additional-support-or-manual-override'
        && candidateHeld.memory.memories.length === 0,
      action: candidateHeld.action,
      reason: candidateHeld.reason,
      explicitMemoryWrite: null,
    },
    {
      id: 'approved-correction-preserves-relation',
      pass: correctionApproved.action === 'updated'
        && correctionApproved.removedOldMemoryCount === 1
        && correctionApproved.item.explicitMemoryWrite?.correction?.oldText === 'The mascot is brass fox'
        && correctionApproved.item.explicitMemoryWrite?.correction?.newText === 'The mascot is copper rabbit'
        && correctionApproved.memory.memories.some((item) => item.text === 'The mascot is copper rabbit')
        && !correctionApproved.memory.memories.some((item) => item.text === 'The mascot is brass fox'),
      action: correctionApproved.action,
      reason: correctionApproved.reason,
      explicitMemoryWrite: correctionApproved.item.explicitMemoryWrite || null,
      memoryPreview: correctionApproved.memory.memories,
      removedOldMemoryCount: correctionApproved.removedOldMemoryCount,
    },
  ];

  return {
    schema: SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA,
    generatedAt,
    measurementMode: 'fixture-only',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    serverSpawned: false,
    livePromptBridge: false,
    diskMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    explicitMemoryPath: 'mergeMemoryItems',
    results,
    summary: {
      caseCount: results.length,
      passingCaseCount: results.filter((item) => item.pass).length,
      failingCaseIds: results.filter((item) => !item.pass).map((item) => item.id),
      approvedExplicitMemoryWriteCount: results.filter((item) => item.explicitMemoryWrite).length,
      rejectedSuggestionNoWrite: results.some((item) => item.id === 'rejected-suggestion-no-write' && item.pass),
      candidateOnlyHeldWithoutOverride: results.some((item) => item.id === 'candidate-only-held-without-override' && item.pass),
      correctionRelationshipPreserved: results.some((item) => item.id === 'approved-correction-preserves-relation' && item.pass),
      explicitMemoryPath: 'mergeMemoryItems',
      diskMemoryWrites: false,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      hiddenChainOfThoughtStored: false,
      runtimeVoiceChanged: false,
    },
  };
}

function buildSessionReflectionFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const explicitApprovalPath = buildExplicitApprovalPathFixture({ generatedAt });
  const summary = {
    ...summarizeFixtureResults(results),
    explicitApprovalPath: explicitApprovalPath.summary,
  };
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
    explicitApprovalPath,
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
  SESSION_REFLECTION_EXPLICIT_APPROVAL_FIXTURE_SCHEMA,
  buildFixtureCases,
  buildReflectionForCase,
  buildCaseResult,
  buildExplicitApprovalPathFixture,
  buildSessionReflectionFixtureArtifact,
  writeSessionReflectionFixtureArtifact,
  parseSessionReflectionArgs,
  runSessionReflectionFixture,
};
