const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const {
  isLowSignalMessage,
  chunkConversationThread,
  ingestConversationThreads,
} = require('../lib/penny-knowledge-ingestion');
const { normalizeSourceArtifact } = require('../lib/penny-knowledge-contracts');

test('source artifacts normalize to local-private non-authoritative receipts', () => {
  const rawText = '{"threads":[]}';
  const artifact = normalizeSourceArtifact({
    sourceType: 'conversation-export',
    originalPath: 'fixture\\exports\\penny.json',
    originalName: 'penny.json',
    rawSourceText: rawText,
    importedAt: '2026-05-25T12:00:00.000Z',
    processingStatus: 'parsed',
  });
  const second = normalizeSourceArtifact({
    sourceType: 'conversation-export',
    rawSourceText: rawText,
    importedAt: '2026-05-25T12:05:00.000Z',
  });

  assert.equal(artifact.schema, 'penny-source-artifact.v1');
  assert.equal(artifact.sourceType, 'conversation-export');
  assert.equal(artifact.sourceId, second.sourceId);
  assert.match(artifact.sourceId, /^source:conversation-export:[a-f0-9]{16}$/);
  assert.match(artifact.checksumSha256, /^[a-f0-9]{64}$/);
  assert.equal(artifact.bytes, Buffer.byteLength(rawText, 'utf8'));
  assert.equal(artifact.processingStatus, 'parsed');
  assert.equal(artifact.privacyClass, 'local-private');
  assert.equal(artifact.memoryAuthority, 'none');
  assert.equal(artifact.capabilityState.reviewGated, true);
  assert.equal(artifact.capabilityState.explicitMemoryWrite, false);
  assert.equal(artifact.capabilityState.promptTruthInjection, false);
});

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

test('offline ingestion attaches source artifacts to chunks and review packets', () => {
  const rawSourceText = JSON.stringify({
    threads: [
      {
        id: 'source-thread',
        source: 'chat-export',
        participants: ['user'],
        messages: [
          { id: 's1', speakerId: 'user', text: 'My favorite tea is lapsang souchong.', createdAt: '2024-02-03T10:00:00.000Z' },
        ],
      },
    ],
  });
  const result = ingestConversationThreads([
    {
      id: 'source-thread',
      source: 'chat-export',
      participants: ['user'],
      messages: [
        { id: 's1', speakerId: 'user', text: 'My favorite tea is lapsang souchong.', createdAt: '2024-02-03T10:00:00.000Z' },
      ],
    },
  ], {
    sourceArtifact: {
      sourceType: 'conversation-export',
      originalPath: '/tmp/penny-export.json',
      originalName: 'penny-export.json',
      rawSourceText,
      importedAt: '2026-05-25T12:00:00.000Z',
    },
  });

  assert.equal(result.summary.sourceArtifactCount, 1);
  assert.equal(result.summary.duplicateSourceArtifactCount, 0);
  assert.equal(result.sourceArtifacts.length, 1);
  const artifact = result.sourceArtifacts[0];
  assert.equal(artifact.schema, 'penny-source-artifact.v1');
  assert.equal(artifact.memoryAuthority, 'none');
  assert.ok(result.chunks.length >= 1);
  assert.ok(result.chunks.every((item) => item.sourceArtifactId === artifact.sourceId));
  assert.ok(result.promotionPackets.length >= 1);
  assert.ok(result.promotionPackets.every((item) => item.sourceArtifactId === artifact.sourceId));
  assert.ok(result.promotionPackets.every((packet) => packet.sourceObservations.every((item) => item.sourceArtifactId === artifact.sourceId)));
});

test('source artifact dedupe is checksum and source-type scoped', () => {
  const rawSourceText = '{"threads":[{"messages":[{"text":"My favorite tea is lapsang souchong."}]}]}';
  const result = ingestConversationThreads([], {
    sourceArtifacts: [
      { sourceType: 'conversation-export', rawSourceText },
      { sourceType: 'conversation-export', rawSourceText },
      { sourceType: 'markdown', rawSourceText },
    ],
  });

  assert.equal(result.sourceArtifacts.length, 2);
  assert.equal(result.summary.sourceArtifactCount, 2);
  assert.equal(result.summary.duplicateSourceArtifactCount, 1);
  assert.notEqual(result.sourceArtifacts[0].sourceId, result.sourceArtifacts[1].sourceId);
  assert.deepEqual(result.sourceArtifacts.map((item) => item.sourceType).sort(), ['conversation-export', 'markdown']);
});

test('conversation import CLI records checksum from the original raw file text', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-conversation-import-'));
  const inputPath = path.join(root, 'conversation-export.json');
  const outputPath = path.join(root, 'ingested.json');
  const rawText = JSON.stringify({
    threads: [
      {
        id: 'cli-thread',
        source: 'cli-fixture',
        participants: ['user'],
        messages: [
          { id: 'c1', speakerId: 'user', text: 'My favorite tea is lapsang souchong.', createdAt: '2024-02-03T10:00:00.000Z' },
        ],
      },
    ],
  }, null, 2);
  fs.writeFileSync(inputPath, rawText, 'utf8');

  try {
    execFileSync(process.execPath, ['scripts/import-penny-conversations.js', inputPath, outputPath], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const expectedChecksum = crypto.createHash('sha256').update(rawText).digest('hex');
    assert.equal(artifact.sourceArtifacts.length, 1);
    assert.equal(artifact.sourceArtifacts[0].checksumSha256, expectedChecksum);
    assert.equal(artifact.sourceArtifacts[0].originalName, 'conversation-export.json');
    assert.equal(artifact.sourceArtifacts[0].bytes, Buffer.byteLength(rawText, 'utf8'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
