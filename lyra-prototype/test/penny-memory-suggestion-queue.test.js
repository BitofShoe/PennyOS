const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_SUGGESTION_QUEUE_STATUSES,
  PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA,
  PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA,
  addMemorySuggestionToQueue,
  approveMemorySuggestionQueueItem,
  createMemorySuggestionQueue,
  queueMemorySuggestionsFromReflection,
  serializeMemorySuggestionQueue,
  updateMemorySuggestionQueueItemStatus,
} = require('../lib/penny-memory-suggestion-queue');

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
