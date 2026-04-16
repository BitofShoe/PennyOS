const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isLowSignalMessage,
  chunkConversationThread,
  ingestConversationThreads,
} = require('../lib/penny-knowledge-ingestion');

test('ingestion filters low-signal chat and chunks by conversational gaps', () => {
  assert.equal(isLowSignalMessage({ text: 'lol' }), true);
  assert.equal(isLowSignalMessage({ text: 'I love lapsang souchong lately.' }), false);

  const chunks = chunkConversationThread({
    id: 'thread-demo',
    messages: [
      { id: 'm1', speakerId: 'user', text: 'lol', createdAt: '2024-03-01T10:00:00.000Z' },
      { id: 'm2', speakerId: 'user', text: 'In 2019 I loved matcha.', createdAt: '2024-03-01T10:01:00.000Z' },
      { id: 'm3', speakerId: 'user', text: 'Now I love lapsang souchong.', createdAt: '2024-03-01T10:02:00.000Z' },
      { id: 'm4', speakerId: 'user', text: 'I moved to Seattle last year.', createdAt: '2024-03-01T16:45:00.000Z' },
    ],
  }, { gapMinutes: 120, maxMessagesPerChunk: 4 });

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].messageCount, 2);
  assert.equal(chunks[1].messageCount, 1);
});

test('offline ingestion keeps temporal preference changes distinct and emits review packets', () => {
  const result = ingestConversationThreads([
    {
      id: 'whatsapp-thread',
      source: 'whatsapp',
      participants: ['user', 'friend'],
      messages: [
        { id: 'a1', speakerId: 'user', text: 'In 2019 I like matcha.', createdAt: '2019-06-02T10:00:00.000Z' },
        { id: 'a2', speakerId: 'friend', text: 'haha', createdAt: '2019-06-02T10:01:00.000Z' },
        { id: 'a3', speakerId: 'user', text: 'Ahora, I am into oolong these days.', createdAt: '2024-06-02T10:00:00.000Z', language: 'es' },
        { id: 'a4', speakerId: 'user', text: 'I moved to Seattle last year.', createdAt: '2024-06-02T10:03:00.000Z' },
      ],
    },
  ], { gapMinutes: 90, maxMessagesPerChunk: 3 });

  assert.equal(result.summary.threadCount, 1);
  assert.ok(result.summary.chunkCount >= 2);
  assert.ok(result.temporalPreferences.length >= 2);
  assert.ok(result.lifeEvents.some((item) => item.eventType === 'move'));

  const preferenceNode = result.knowledgeNodes.find((item) => item.nodeType === 'preference');
  assert.ok(preferenceNode);
  assert.ok(preferenceNode.history.length >= 2);
  assert.notEqual(preferenceNode.history[0].value, preferenceNode.history[preferenceNode.history.length - 1].value);

  const packet = result.promotionPackets[0];
  assert.ok(packet);
  assert.equal(packet.contract, 'PromotionPacket');
  assert.equal(packet.sourceType, 'offline-ingestion');
  assert.ok(packet.sourceThreadId);
  assert.ok(packet.sourceTurnIds.length >= 1);
});
