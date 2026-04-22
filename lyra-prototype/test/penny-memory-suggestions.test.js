const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_SUGGESTION_ACTIONS,
  MEMORY_SUGGESTION_CLASSES,
  PENNY_EXPLICIT_MEMORY_REVIEW_CANDIDATE_SCHEMA,
  PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
  classifyMemorySuggestion,
  classifyMemorySuggestions,
  summarizeMemorySuggestionPolicy,
} = require('../lib/penny-memory-suggestions');

const { SUPPORT_STATES } = require('../lib/penny-session-reflection');

test('explicit user-stated stable preferences become review-gated suggestions', () => {
  const result = classifyMemorySuggestion({
    text: 'I love long detailed answers.',
    class: 'user-preference',
    support: 'explicit user statement',
    sourceReceipts: [
      { type: 'turn', id: 'turn-1', excerpt: 'I love long detailed answers.' },
    ],
  });

  assert.equal(result.schema, PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA);
  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.SUGGEST);
  assert.equal(result.class, MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE);
  assert.equal(result.supportState, SUPPORT_STATES.EXPLICIT_USER);
  assert.equal(result.supportLevel, 2);
  assert.equal(result.sensitivity, 'low');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.autoPromoted, false);
  assert.equal(result.memoryWrites, false);
  assert.equal(result.canonicalMemoryWrites, false);
  assert.equal(result.promptTruthExpanded, false);
  assert.equal(result.toolEvidenceReceiptChanged, false);
  assert.equal(result.suggestedExplicitMemory.schema, PENNY_EXPLICIT_MEMORY_REVIEW_CANDIDATE_SCHEMA);
  assert.equal(result.suggestedExplicitMemory.requiresApproval, true);
  assert.equal(result.suggestedExplicitMemory.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.canonicalWriteAllowed, false);
  assert.equal(result.suggestedExplicitMemory.kind, 'user-preference');
});

test('repeated explicit preferences may be suggested but never auto-promoted', () => {
  const result = classifyMemorySuggestion({
    text: 'Slice-by-slice plans help me keep track.',
    kind: 'user-preference',
    support: 'repeated explicit user preference',
    mentionCount: 3,
    confidence: 'high',
  });

  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.SUGGEST);
  assert.equal(result.supportState, SUPPORT_STATES.REPEATED_EXPLICIT);
  assert.equal(result.supportLevel, 1);
  assert.equal(result.confidence, 'high');
  assert.equal(result.reviewStatus, 'pending-user-approval');
  assert.equal(result.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory.promotionQueueWriteAllowed, false);
});

test('temporary emotions are do-not-save rather than memory suggestions', () => {
  const result = classifyMemorySuggestion({
    text: "I'm excited right now.",
    kind: 'user-preference',
    support: 'explicit user statement during this session',
  });

  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE);
  assert.equal(result.reason, 'temporary-session-state');
  assert.equal(result.class, MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory, null);
});

test('project decisions route to open-loop/project notes, not user explicit memory', () => {
  const result = classifyMemorySuggestion({
    text: 'Static embeddings should be advisory, not authority.',
    kind: 'project-decision',
    support: 'repo source decision',
    sourceReceipts: [
      { type: 'doc', path: 'docs/plans/example.md', excerpt: 'static embeddings should be advisory' },
    ],
  });

  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY);
  assert.equal(result.reason, 'project-or-open-loop-note-not-user-memory');
  assert.equal(result.suggestedExplicitMemory, null);
  assert.equal(result.supportState, SUPPORT_STATES.REPO_SOURCE);
  assert.equal(result.supportLevel, 3);
  assert.equal(result.canonicalMemoryWrites, false);
});

test('sensitive personal data is held for explicit review and never auto-saved', () => {
  const result = classifyMemorySuggestion({
    text: 'My address appears on a bill.',
    kind: 'stable-user-fact',
    support: 'explicit user statement',
  });

  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE);
  assert.equal(result.class, MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA);
  assert.equal(result.reason, 'sensitive-personal-data-requires-explicit-review');
  assert.equal(result.sensitivity, 'high');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.autoPromoted, false);
  assert.equal(result.suggestedExplicitMemory, null);
});

test('archive-only candidates need more evidence before explicit memory review', () => {
  const result = classifyMemorySuggestion({
    text: 'User prefers short implementation summaries.',
    kind: 'user-preference',
    supportState: 'archive-candidate',
    source: 'archive memory candidate',
  });

  assert.equal(result.action, MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE);
  assert.equal(result.reason, 'candidate-only-support');
  assert.equal(result.supportState, SUPPORT_STATES.CANDIDATE_ONLY);
  assert.equal(result.supportLevel, 0);
  assert.equal(result.suggestedExplicitMemory, null);
});

test('corrections must preserve old-vs-new explicit memory relationship', () => {
  const incomplete = classifyMemorySuggestion({
    text: 'The mascot is copper rabbit now.',
    kind: 'correction',
    supportState: 'existing-explicit-correction',
  });

  assert.equal(incomplete.action, MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE);
  assert.equal(incomplete.reason, 'correction-needs-old-and-new-memory-relationship');
  assert.equal(incomplete.suggestedExplicitMemory, null);

  const complete = classifyMemorySuggestion({
    text: 'The mascot is copper rabbit now.',
    kind: 'correction',
    supportState: 'existing-explicit-correction',
    existingMemoryId: 'mascot-memory',
    oldText: 'The mascot is brass fox.',
    newText: 'The mascot is copper rabbit.',
  });

  assert.equal(complete.action, MEMORY_SUGGESTION_ACTIONS.SUGGEST);
  assert.equal(complete.reason, 'existing-explicit-memory-correction-review');
  assert.equal(complete.supportLevel, 4);
  assert.equal(complete.suggestedExplicitMemory.kind, 'correction');
  assert.equal(complete.suggestedExplicitMemory.existingMemoryId, 'mascot-memory');
  assert.equal(complete.suggestedExplicitMemory.oldText, 'The mascot is brass fox.');
  assert.equal(complete.suggestedExplicitMemory.newText, 'The mascot is copper rabbit.');
  assert.equal(complete.suggestedExplicitMemory.autoPromoted, false);
});

test('batch policy summaries keep approval and non-authority receipts explicit', () => {
  const artifact = classifyMemorySuggestions([
    {
      text: 'I prefer detailed implementation plans.',
      kind: 'user-preference',
      support: 'explicit user statement',
    },
    {
      text: 'User seems anxious about PromptTruth.',
      kind: 'inferred-emotion',
      support: 'assistant inference',
    },
    {
      text: 'PromptTruth should stay narrow.',
      kind: 'project-decision',
      support: 'repo source decision',
    },
  ]);
  const summary = summarizeMemorySuggestionPolicy(artifact.results);

  assert.equal(artifact.schema, PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA);
  assert.equal(artifact.results.length, 3);
  assert.equal(summary.candidateCount, 3);
  assert.equal(summary.suggestionCount, 1);
  assert.equal(summary.heldBackCount, 2);
  assert.equal(summary.actionCounts[MEMORY_SUGGESTION_ACTIONS.SUGGEST], 1);
  assert.equal(summary.actionCounts[MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE], 1);
  assert.equal(summary.actionCounts[MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY], 1);
  assert.equal(summary.allRequireApproval, true);
  assert.equal(summary.autoPromotedCount, 0);
  assert.equal(summary.canonicalMemoryWrites, false);
  assert.equal(summary.promptTruthExpanded, false);
  assert.equal(summary.toolEvidenceReceiptChanged, false);
});
