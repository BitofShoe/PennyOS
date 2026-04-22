const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_SUGGESTION_QUEUE_STATUSES,
  PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA,
  PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA,
  addMemorySuggestionToQueue,
  approveMemorySuggestionQueueItem,
  approveMemorySuggestionQueueItemForExplicitMemory,
  createMemorySuggestionQueue,
  queueMemorySuggestionsFromReflection,
  rejectMemorySuggestionQueueItem,
  serializeMemorySuggestionQueue,
  updateMemorySuggestionQueueItemStatus,
} = require('../lib/penny-memory-suggestion-queue');

const { PENNY_EXPLICIT_MEMORY_APPROVAL_WRITE_SCHEMA } = require('../lib/penny-memory');
const { SUPPORT_STATES } = require('../lib/penny-session-reflection');

const CREATED_AT = '2026-04-22T14:00:00.000Z';
const REVIEWED_AT = '2026-04-22T14:05:00.000Z';

function supportedPreference(overrides = {}) {
  return {
    id: 'pref-detailed-slices',
    text: 'User prefers detailed slice-by-slice implementation plans with verification notes.',
    kind: 'user-preference',
    support: 'repeated explicit user preference',
    confidence: 'high',
    sourceReceipts: [
      { type: 'turn', id: 'turn-1', excerpt: 'Please keep this slice-by-slice and detailed.' },
      { type: 'turn', id: 'turn-3', excerpt: 'Long detailed implementation plans help me follow the work.' },
    ],
    ...overrides,
  };
}

test('adds a pending review item without explicit memory writes', () => {
  const start = createMemorySuggestionQueue({ createdAt: CREATED_AT });
  const result = addMemorySuggestionToQueue(start, supportedPreference(), {
    sourceReflectionId: 'reflection-r5-a',
    createdAt: CREATED_AT,
  });

  assert.equal(result.action, 'queued');
  assert.equal(result.queue.schema, PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA);
  assert.equal(result.item.schema, PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA);
  assert.equal(result.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  assert.equal(result.item.reviewedAt, null);
  assert.equal(result.item.explicitMemoryWrite, null);
  assert.equal(result.item.sourceReflectionId, 'reflection-r5-a');
  assert.equal(result.item.suggestion.supportState, SUPPORT_STATES.REPEATED_EXPLICIT);
  assert.equal(result.item.suggestion.sensitivity, 'low');
  assert.equal(result.item.suggestion.requiresApproval, true);
  assert.equal(result.item.suggestion.autoPromoted, false);
  assert.equal(result.item.memoryWrites, false);
  assert.equal(result.item.canonicalMemoryWrites, false);
  assert.equal(result.queue.summary.pendingCount, 1);
  assert.equal(result.queue.summary.explicitMemoryWriteCount, 0);
  assert.equal(result.queue.promptTruthExpanded, false);
  assert.equal(result.queue.toolEvidenceReceiptChanged, false);
});

test('duplicates are rejected and newer same-key suggestions supersede older pending items', () => {
  const first = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), supportedPreference(), {
    sourceReflectionId: 'reflection-r5-a',
    createdAt: CREATED_AT,
  });
  const duplicate = addMemorySuggestionToQueue(first.queue, supportedPreference(), {
    sourceReflectionId: 'reflection-r5-a',
    createdAt: '2026-04-22T14:01:00.000Z',
  });
  const newer = addMemorySuggestionToQueue(duplicate.queue, supportedPreference({
    id: 'pref-detailed-slices-newer',
  }), {
    sourceReflectionId: 'reflection-r5-b',
    createdAt: '2026-04-22T14:02:00.000Z',
  });

  assert.equal(duplicate.action, 'duplicate');
  assert.equal(duplicate.reason, 'duplicate-memory-suggestion');
  assert.equal(duplicate.queue.items.length, 1);
  assert.equal(newer.action, 'queued');
  assert.equal(newer.reason, 'queued-and-superseded-older-suggestion');
  assert.equal(newer.queue.items.length, 2);
  assert.equal(newer.queue.items[0].status, MEMORY_SUGGESTION_QUEUE_STATUSES.SUPERSEDED);
  assert.equal(newer.queue.items[1].status, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  assert.equal(newer.queue.summary.supersededCount, 1);
  assert.equal(newer.queue.summary.pendingCount, 1);
});

test('approval status requires an explicit review call and still writes no memory', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), supportedPreference(), {
    sourceReflectionId: 'reflection-r5-a',
    createdAt: CREATED_AT,
  });
  const held = updateMemorySuggestionQueueItemStatus(
    queued.queue,
    queued.item.id,
    MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED,
    { reviewedAt: REVIEWED_AT },
  );
  const approved = approveMemorySuggestionQueueItem(held.queue, queued.item.id, {
    reviewedAt: REVIEWED_AT,
  });

  assert.equal(held.action, 'held');
  assert.equal(held.reason, 'explicit-review-required');
  assert.equal(held.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  assert.equal(approved.action, 'updated');
  assert.equal(approved.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED);
  assert.equal(approved.item.reviewedAt, REVIEWED_AT);
  assert.equal(approved.item.explicitMemoryWrite, null);
  assert.equal(approved.item.memoryWrites, false);
  assert.equal(approved.item.canonicalMemoryWrites, false);
  assert.equal(approved.queue.summary.approvedCount, 1);
  assert.equal(approved.queue.summary.explicitMemoryWriteCount, 0);
  assert.match(approved.item.warnings.join('\n'), /without explicit-memory write/i);
});

test('explicit approval path writes stable preference through explicit memory APIs', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), supportedPreference(), {
    sourceReflectionId: 'reflection-r6-a',
    createdAt: CREATED_AT,
  });
  const approved = approveMemorySuggestionQueueItemForExplicitMemory(queued.queue, queued.item.id, {
    explicitApproval: true,
    reviewedAt: REVIEWED_AT,
    nowMs: Date.parse(REVIEWED_AT),
    memory: {
      sessionId: 'r6-demo',
      memories: [],
    },
  });

  assert.equal(approved.action, 'updated');
  assert.equal(approved.reason, 'approved-explicit-memory-write');
  assert.equal(approved.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED);
  assert.equal(approved.item.reviewedAt, REVIEWED_AT);
  assert.equal(approved.item.suggestion.requiresApproval, true);
  assert.equal(approved.item.suggestion.autoPromoted, false);
  assert.equal(approved.item.explicitMemoryWrite.schema, PENNY_EXPLICIT_MEMORY_APPROVAL_WRITE_SCHEMA);
  assert.equal(approved.item.explicitMemoryWrite.explicitMemoryPath, 'mergeMemoryItems');
  assert.equal(approved.item.explicitMemoryWrite.autoPromoted, false);
  assert.equal(approved.queue.summary.explicitMemoryWriteCount, 1);
  assert.equal(approved.queue.summary.explicitMemoryWrites, true);
  assert.equal(approved.queue.summary.canonicalMemoryWrites, true);
  assert.equal(approved.queue.promptTruthExpanded, false);
  assert.equal(approved.queue.toolEvidenceReceiptChanged, false);
  assert.equal(approved.memory.memories.length, 1);
  assert.equal(
    approved.memory.memories[0].text,
    'User prefers detailed slice-by-slice implementation plans with verification notes',
  );
  assert.equal(approved.memory.memories[0].kind, 'preference');
  assert.equal(approved.memory.memories[0].source, 'review-candidate');
  assert.equal(approved.memory.memories[0].origin.sourceType, 'session-reflection');
  assert.equal(approved.memory.memories[0].origin.scope, 'explicit-approval');
  assert.equal(approved.memory.memories[0].origin.queueId, queued.item.id);
  assert.equal(approved.memory.memories[0].origin.approval.reviewerDecision, 'approve');
  assert.equal(approved.memory.memories[0].origin.approval.manualOverride, false);
});

test('rejected suggestion cannot be written through explicit approval path', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), supportedPreference(), {
    sourceReflectionId: 'reflection-r6-rejected',
    createdAt: CREATED_AT,
  });
  const rejected = rejectMemorySuggestionQueueItem(queued.queue, queued.item.id, {
    reviewedAt: REVIEWED_AT,
  });
  const attempted = approveMemorySuggestionQueueItemForExplicitMemory(rejected.queue, queued.item.id, {
    explicitApproval: true,
    reviewedAt: '2026-04-22T14:06:00.000Z',
    memory: {
      sessionId: 'r6-demo',
      memories: [],
    },
  });

  assert.equal(rejected.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.REJECTED);
  assert.equal(attempted.action, 'held');
  assert.equal(attempted.reason, 'memory-suggestion-not-pending-or-approved');
  assert.equal(attempted.memory.memories.length, 0);
  assert.equal(attempted.queue.summary.explicitMemoryWriteCount, 0);
});

test('candidate-only suggestion needs additional support or a manual override marker before approval writes', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), {
    id: 'candidate-short-summaries',
    text: 'User prefers short implementation summaries.',
    kind: 'user-preference',
    supportState: 'candidate-only',
    sourceReceipts: [
      { type: 'archive-candidate', id: 'archive-1', excerpt: 'Weak archive candidate only.' },
    ],
  }, {
    sourceReflectionId: 'reflection-r6-candidate',
    createdAt: CREATED_AT,
  });
  const held = approveMemorySuggestionQueueItemForExplicitMemory(queued.queue, queued.item.id, {
    explicitApproval: true,
    reviewedAt: REVIEWED_AT,
    memory: {
      sessionId: 'r6-demo',
      memories: [],
    },
  });
  const overridden = approveMemorySuggestionQueueItemForExplicitMemory(held.queue, queued.item.id, {
    explicitApproval: true,
    manualOverride: true,
    manualOverrideReason: 'Reviewer confirmed this preference outside the reflection summary.',
    reviewedAt: '2026-04-22T14:07:00.000Z',
    nowMs: Date.parse('2026-04-22T14:07:00.000Z'),
    memory: {
      sessionId: 'r6-demo',
      memories: [],
    },
  });

  assert.equal(queued.item.suggestion.supportState, SUPPORT_STATES.CANDIDATE_ONLY);
  assert.equal(held.action, 'held');
  assert.equal(held.reason, 'candidate-only-support-needs-additional-support-or-manual-override');
  assert.equal(held.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  assert.equal(held.memory.memories.length, 0);
  assert.equal(overridden.action, 'updated');
  assert.equal(overridden.item.explicitMemoryWrite.manualOverride, true);
  assert.equal(overridden.memory.memories.length, 1);
});

test('explicit approval path preserves correction stale-current relation', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), {
    id: 'mascot-correction',
    text: 'The current mascot is copper rabbit.',
    kind: 'correction',
    supportState: 'existing-explicit-correction',
    existingMemoryId: 'mascot-memory',
    oldText: 'The mascot is brass fox.',
    newText: 'The mascot is copper rabbit.',
    sourceReceipts: [
      { type: 'turn', id: 'turn-correction', excerpt: 'the old mascot was brass fox, but the current mascot is copper rabbit' },
    ],
  }, {
    sourceReflectionId: 'reflection-r6-correction',
    createdAt: CREATED_AT,
  });
  const approved = approveMemorySuggestionQueueItemForExplicitMemory(queued.queue, queued.item.id, {
    explicitApproval: true,
    reviewedAt: REVIEWED_AT,
    nowMs: Date.parse(REVIEWED_AT),
    memory: {
      sessionId: 'r6-demo',
      memories: [
        { text: 'The mascot is brass fox.', kind: 'explicit', ts: 1 },
        { text: 'Backup mug is orange.', kind: 'explicit', ts: 2 },
      ],
    },
  });
  const texts = approved.memory.memories.map((item) => item.text);

  assert.equal(queued.item.suggestion.oldText, 'The mascot is brass fox.');
  assert.equal(queued.item.suggestion.newText, 'The mascot is copper rabbit.');
  assert.equal(approved.action, 'updated');
  assert.equal(approved.removedOldMemoryCount, 1);
  assert.ok(texts.includes('The mascot is copper rabbit'));
  assert.ok(texts.includes('Backup mug is orange'));
  assert.equal(texts.includes('The mascot is brass fox'), false);
  assert.equal(approved.item.explicitMemoryWrite.correction.oldText, 'The mascot is brass fox');
  assert.equal(approved.item.explicitMemoryWrite.correction.newText, 'The mascot is copper rabbit');
  assert.equal(approved.promotedMemory.origin.correction.oldText, 'The mascot is brass fox');
  assert.equal(approved.promotedMemory.origin.correction.newText, 'The mascot is copper rabbit');
});

test('sensitive suggestions can stay pending only as high-caution review items', () => {
  const result = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), {
    id: 'legal-name-review',
    text: 'User legal name appears in a source document and needs careful review.',
    kind: 'stable-user-fact',
    support: 'explicit user statement with source receipt',
    sensitivity: 'high',
    sourceReceipts: [
      { type: 'fixture-document', id: 'doc-legal-name', excerpt: 'legal name field present' },
    ],
  }, {
    sourceReflectionId: 'reflection-r5-sensitive',
    createdAt: CREATED_AT,
  });

  assert.equal(result.action, 'queued');
  assert.equal(result.item.status, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  assert.equal(result.item.suggestion.sensitivity, 'high');
  assert.equal(result.item.suggestion.requiresApproval, true);
  assert.equal(result.item.suggestion.autoPromoted, false);
  assert.equal(result.item.explicitMemoryWrite, null);
  assert.equal(result.queue.summary.highSensitivityPendingCount, 1);
  assert.match(result.item.warnings.join('\n'), /high-sensitivity/i);
});

test('inferred emotions and temporary states are not stored as memory queue items', () => {
  const queue = createMemorySuggestionQueue({ createdAt: CREATED_AT });
  const inferred = addMemorySuggestionToQueue(queue, {
    id: 'inferred-anxious',
    text: 'User seems anxious about PromptTruth.',
    kind: 'user-preference',
    support: 'assistant inference from tone',
  }, {
    sourceReflectionId: 'reflection-r5-rejects',
    createdAt: CREATED_AT,
  });
  const temporary = addMemorySuggestionToQueue(inferred.queue, {
    id: 'currently-excited',
    text: 'User is excited right now.',
    kind: 'user-preference',
    support: 'explicit user statement during this session',
  }, {
    sourceReflectionId: 'reflection-r5-rejects',
    createdAt: CREATED_AT,
  });

  assert.equal(inferred.action, 'rejected');
  assert.equal(inferred.reason, 'inferred-emotion-not-queued');
  assert.equal(temporary.action, 'rejected');
  assert.equal(temporary.reason, 'temporary-state-not-queued');
  assert.equal(temporary.queue.items.length, 0);
  assert.equal(temporary.rejectedSuggestion.requiresApproval, true);
  assert.equal(temporary.rejectedSuggestion.autoPromoted, false);
});

test('reflection suggestions can be queued with stable source reflection identity', () => {
  const result = queueMemorySuggestionsFromReflection(
    createMemorySuggestionQueue({ createdAt: CREATED_AT }),
    {
      generatedAt: CREATED_AT,
      sessionId: 'session-r5',
      memorySuggestions: [supportedPreference()],
    },
    { createdAt: CREATED_AT },
  );

  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].action, 'queued');
  assert.equal(result.queue.items[0].sourceReflectionId, `session-r5:${CREATED_AT}`);
  assert.equal(result.summary.pendingCount, 1);
});

test('queue serialization is stable and keeps authority guardrails explicit', () => {
  const queued = addMemorySuggestionToQueue(createMemorySuggestionQueue({ createdAt: CREATED_AT }), supportedPreference(), {
    sourceReflectionId: 'reflection-r5-a',
    createdAt: CREATED_AT,
  });
  const first = serializeMemorySuggestionQueue(queued.queue);
  const second = serializeMemorySuggestionQueue(JSON.parse(first));
  const parsed = JSON.parse(first);

  assert.equal(first, second);
  assert.equal(parsed.schema, PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA);
  assert.equal(parsed.items[0].explicitMemoryWrite, null);
  assert.equal(parsed.guardrails.reviewOnly, true);
  assert.equal(parsed.guardrails.promptTruthExpanded, false);
  assert.equal(parsed.guardrails.toolEvidenceReceiptChanged, false);
  assert.equal(parsed.guardrails.runtimeVoiceChanged, false);
  assert.match(parsed.limits.join('\n'), /not canonical memory/i);
});
