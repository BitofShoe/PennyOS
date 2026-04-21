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
  assert.ok(packet.sourceChunkId);
  assert.ok(packet.sourceTurnIds.length >= 1);
  assert.ok(packet.sourceObservations.length >= 2);
  assert.ok(packet.sourceObservations.every((item) => item.sourceExcerpt && item.observedAt));
  assert.ok(packet.sourceObservations.every((item) => item.threadId === packet.sourceThreadId));
  assert.ok(packet.sourceObservations.every((item) => item.chunkId));
  assert.equal(result.summary.invalidPromotionPacketCount, 0);
  assert.equal(result.summary.skippedCandidateCount, 0);
  assert.equal(result.validation.promotionPacketCount, result.promotionPackets.length);
});

test('offline ingestion uses stable fallback ids and fails closed on weak candidates', () => {
  const rawThreads = [
    {
      source: 'chat-export',
      title: 'stable import',
      participants: ['user'],
      messages: [
        { speakerId: 'user', text: 'My favorite tea is lapsang souchong.', createdAt: '2024-02-03T10:00:00.000Z' },
        { speakerId: 'user', text: 'My favorite color is teal.' },
        { speakerId: 'user', text: '   ', createdAt: '2024-02-03T10:01:00.000Z' },
        { speakerId: 'user', text: 'lol', createdAt: '2024-02-03T10:02:00.000Z' },
      ],
    },
  ];

  const first = ingestConversationThreads(rawThreads);
  const second = ingestConversationThreads(rawThreads);

  assert.equal(first.threads[0].id, second.threads[0].id);
  assert.equal(first.chunks[0].messages[0].id, second.chunks[0].messages[0].id);
  assert.match(first.threads[0].id, /^thread:/);
  assert.match(first.chunks[0].messages[0].id, /^turn:/);

  assert.equal(first.summary.rawThreadCount, 1);
  assert.equal(first.summary.importedThreadCount, 1);
  assert.equal(first.summary.rawMessageCount, 4);
  assert.equal(first.summary.importedMessageCount, 3);
  assert.equal(first.summary.malformedMessageCount, 1);
  assert.equal(first.summary.skippedLowSignalMessageCount, 1);
  assert.equal(first.summary.candidateCount, 2);
  assert.equal(first.summary.validCandidateCount, 1);
  assert.equal(first.summary.invalidCandidateCount, 1);
  assert.equal(first.summary.invalidPromotionPacketCount, 0);
  assert.equal(first.summary.skippedCandidateCount, 1);
  assert.equal(first.promotionPackets.length, 1);

  const packet = first.promotionPackets[0];
  const sourceMessage = first.chunks[0].messages.find((item) => /favorite tea/i.test(item.text));
  assert.ok(sourceMessage);
  assert.equal(packet.sourceThreadId, first.threads[0].id);
  assert.equal(packet.sourceChunkId, first.chunks[0].id);
  assert.deepEqual(packet.sourceTurnIds, [sourceMessage.id]);
  assert.equal(packet.createdAt, '2024-02-03T10:00:00.000Z');
  assert.equal(packet.sourceObservations.length, 1);
  assert.match(packet.sourceObservations[0].sourceExcerpt, /favorite tea/i);
  assert.equal(packet.sourceObservations[0].observedAt, '2024-02-03T10:00:00.000Z');
  assert.ok(first.validation.warnings.some((item) => item.code === 'message-missing-text'));
  assert.ok(first.validation.warnings.some((item) => item.code === 'candidate-missing-provenance'));
});
