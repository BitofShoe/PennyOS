const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LATENCY_BUDGETS,
  LATENCY_CLASSES,
} = require('../lib/penny-latency-budget');
const {
  HISTORY_CAPABILITY_REASON_CODE,
  isHistoryCapabilityQuestion,
  buildHistoryBudgetSnapshot,
  buildHistoryCapabilityReply,
  resolveHistoryCapabilityIntent,
} = require('../lib/penny-history-capability');

const POSITIVE_FIXTURES = Object.freeze([
  'How many recent turns do you remember?',
  'Do you always remember the last five turns?',
  'How many messages from our conversation do you include in your prompt?',
  'What is your conversation history window?',
  'Do you retain our whole chat?',
  'Explain how your memory architecture works.',
  'How does Penny’s recent-message history work?',
]);

const NEGATIVE_FIXTURES = Object.freeze([
  'What do you remember about the copper rabbit?',
  'Do you remember where I left my notebook?',
  'Explain the architecture in ARCHITECTURE.md.',
  'Keep the last paragraph and rewrite the first one.',
  'Always keep the last five messages in the audit log.',
  'How many messages did I send yesterday?',
]);

test('history capability classifier covers architecture and numeric-boundary paraphrases', () => {
  for (const prompt of POSITIVE_FIXTURES) {
    assert.equal(isHistoryCapabilityQuestion(prompt), true, prompt);
  }
  for (const prompt of NEGATIVE_FIXTURES) {
    assert.equal(isHistoryCapabilityQuestion(prompt), false, prompt);
  }
});

test('history budget snapshot derives current message-entry limits from runtime policy', () => {
  const snapshot = buildHistoryBudgetSnapshot();
  assert.deepEqual(snapshot.map((item) => item.recentMessageEntries), [
    LATENCY_BUDGETS[LATENCY_CLASSES.CASUAL_COMPANION].recentHistoryCount,
    LATENCY_BUDGETS[LATENCY_CLASSES.MEMORY_HEAVY_RECALL].recentHistoryCount,
    LATENCY_BUDGETS[LATENCY_CLASSES.TOOL_HEAVY].recentHistoryCount,
    LATENCY_BUDGETS[LATENCY_CLASSES.IMAGE_HEAVY].recentHistoryCount,
  ]);
  assert.deepEqual(snapshot.map((item) => item.recentMessageEntries), [6, 10, 4, 4]);
});

test('history capability reply states variable message budgets and authority boundaries', () => {
  const reply = buildHistoryCapabilityReply();
  assert.match(reply, /do not have one fixed .*last N turns.* rule/i);
  assert.match(reply, /message entries, not conversational turns/i);
  assert.match(reply, /casual chat 6/i);
  assert.match(reply, /memory-heavy recall 10/i);
  assert.match(reply, /tool-heavy work 4/i);
  assert.match(reply, /image-heavy work 4/i);
  assert.match(reply, /canonical-memory question can suppress recent chat entirely/i);
  assert.match(reply, /Explicit remembered facts are a separate canonical layer/i);
  assert.match(reply, /archive\/session retrieval is advisory/i);
  assert.match(reply, /current configuration—not a promise/i);
  assert.doesNotMatch(reply, /\blast five turns\b/i);
});

test('history capability intent is deterministic and stable over repeated fixtures', () => {
  for (let repetition = 0; repetition < 12; repetition += 1) {
    for (const prompt of POSITIVE_FIXTURES) {
      const intent = resolveHistoryCapabilityIntent(prompt);
      assert.ok(intent, `${repetition}: ${prompt}`);
      assert.equal(intent.kind, 'deterministic_reply');
      assert.equal(intent.name, 'answer_history_capability');
      assert.equal(intent.reasonCode, HISTORY_CAPABILITY_REASON_CODE);
      assert.equal(intent.text, buildHistoryCapabilityReply());
      assert.doesNotMatch(intent.text, /\blast five turns\b/i);
    }
  }
});
