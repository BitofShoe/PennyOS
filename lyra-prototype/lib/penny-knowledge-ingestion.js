const {
  normalizeConversationThread,
  normalizeThreadChunk,
  normalizeExtractedFact,
  normalizeTemporalPreference,
  normalizeLifeEvent,
  normalizeKnowledgeNode,
  normalizePromotionPacket,
} = require('./penny-knowledge-contracts');

const LOW_SIGNAL_PATTERNS = [
  /^(ha|haha|lol|lmao|lmfao|ok|okay|kk|k|yep|yeah|yup|sure)[!. ]*$/i,
  /^[\p{Emoji}\p{Extended_Pictographic}\s!?.-]+$/u,
  /^\[(sticker|gif|voice note|image|photo)\]$/i,
];

const TEMPORAL_MARKERS = [
  /\b(201\d|202\d)\b/,
  /\b(now|today|these days|lately|back then|used to|before|after|earlier)\b/i,
];

function normalizeText(value = '', limit = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function isLowSignalMessage(message = {}) {
  const text = normalizeText(message.text || '', 220);
  if (!text) return true;
  return LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function chunkConversationThread(thread = {}, {
  maxMessagesPerChunk = 12,
  gapMinutes = 180,
} = {}) {
  const normalizedThread = normalizeConversationThread(thread);
  const messages = normalizedThread.messages.filter((item) => !isLowSignalMessage(item));
  if (!messages.length) return [];

  const chunks = [];
  let current = [];
  let ordinal = 0;

  function flushChunk() {
    if (!current.length) return;
    ordinal += 1;
    chunks.push(normalizeThreadChunk({
      id: `${normalizedThread.id}:chunk:${ordinal}`,
      threadId: normalizedThread.id,
      ordinal,
      startedAt: current[0]?.createdAt || '',
      endedAt: current[current.length - 1]?.createdAt || '',
      participantIds: current.map((item) => item.speakerId),
      excerpt: current.map((item) => item.text).join(' '),
      messages: current,
    }));
    current = [];
  }

  for (const message of messages) {
    const last = current[current.length - 1];
    const lastTime = Date.parse(last?.createdAt || '');
    const currentTime = Date.parse(message.createdAt || '');
    const gapExceeded = Number.isFinite(lastTime)
      && Number.isFinite(currentTime)
      && ((currentTime - lastTime) / (1000 * 60)) > gapMinutes;
    if (current.length && (current.length >= maxMessagesPerChunk || gapExceeded)) {
      flushChunk();
    }
    current.push(message);
  }
  flushChunk();

  return chunks.filter(Boolean);
}

function deriveTemporalScope(message = {}, text = '') {
  const source = String(text || message.text || '').trim();
  const yearMatch = source.match(/\b(201\d|202\d)\b/);
  if (yearMatch) {
    return {
      label: yearMatch[1],
      observedAt: message.createdAt || '',
      startAt: `${yearMatch[1]}-01-01T00:00:00.000Z`,
      endAt: `${yearMatch[1]}-12-31T23:59:59.999Z`,
    };
  }
  if (/\bused to\b/i.test(source)) {
    return {
      label: 'historical',
      observedAt: message.createdAt || '',
    };
  }
  if (/\b(now|today|these days|lately)\b/i.test(source)) {
    return {
      label: 'current',
      observedAt: message.createdAt || '',
    };
  }
  return {
    label: TEMPORAL_MARKERS.some((pattern) => pattern.test(source)) ? 'time-marked' : 'implicit',
    observedAt: message.createdAt || '',
  };
}

function extractChunkKnowledge(chunk = {}) {
  const extractedFacts = [];
  const temporalPreferences = [];
  const lifeEvents = [];

  for (const message of Array.isArray(chunk.messages) ? chunk.messages : []) {
    const text = normalizeText(message.text || '', 420);
    if (!text) continue;
    const temporalScope = deriveTemporalScope(message, text);

    const preferenceMatch = text.match(/\b(i like|i love|i'm into|i am into|my favorite(?: thing)? is|i've been obsessed with|i am obsessed with)\b(.+)/i);
    if (preferenceMatch) {
      temporalPreferences.push(normalizeTemporalPreference({
        id: `${chunk.id}:pref:${temporalPreferences.length + 1}`,
        threadId: chunk.threadId,
        chunkId: chunk.id,
        turnIds: [message.id],
        category: 'preference',
        value: normalizeText(preferenceMatch[2], 180).replace(/[.!?]+$/g, ''),
        sourceExcerpt: text,
        observedAt: message.createdAt || '',
        temporalScope,
        language: message.language || '',
      }));
    }

    const propertyMatch = text.match(/\bmy ([a-z][a-z0-9' -]{2,60}?) is\b(.+)/i);
    if (propertyMatch) {
      extractedFacts.push(normalizeExtractedFact({
        id: `${chunk.id}:fact:${extractedFacts.length + 1}`,
        threadId: chunk.threadId,
        chunkId: chunk.id,
        turnIds: [message.id],
        subject: 'user',
        predicate: normalizeText(propertyMatch[1], 120),
        objectText: normalizeText(propertyMatch[2], 180).replace(/[.!?]+$/g, ''),
        text: `${normalizeText(propertyMatch[1], 120)} is ${normalizeText(propertyMatch[2], 180).replace(/[.!?]+$/g, '')}`,
        sourceExcerpt: text,
        observedAt: message.createdAt || '',
        temporalScope,
      }));
    }

    const lifeEventPatterns = [
      { pattern: /\b(i moved to|i moved back to)\b(.+)/i, type: 'move' },
      { pattern: /\b(i got promoted|i started a new job|i quit my job)\b(.+)/i, type: 'career-change' },
      { pattern: /\b(i got diagnosed with|i was diagnosed with)\b(.+)/i, type: 'health' },
    ];
    for (const entry of lifeEventPatterns) {
      const match = text.match(entry.pattern);
      if (!match) continue;
      lifeEvents.push(normalizeLifeEvent({
        id: `${chunk.id}:event:${lifeEvents.length + 1}`,
        threadId: chunk.threadId,
        chunkId: chunk.id,
        turnIds: [message.id],
        eventType: entry.type,
        description: normalizeText(text, 220),
        sourceExcerpt: text,
        observedAt: message.createdAt || '',
        temporalScope,
      }));
      break;
    }
  }

  return {
    extractedFacts: extractedFacts.filter(Boolean),
    temporalPreferences: temporalPreferences.filter(Boolean),
    lifeEvents: lifeEvents.filter(Boolean),
  };
}

function buildKnowledgeNodes({ extractedFacts = [], temporalPreferences = [], lifeEvents = [] } = {}) {
  const nodeMap = new Map();

  function appendNode(nodeType, key, label, value, item) {
    const normalizedKey = normalizeText(key, 160).toLowerCase();
    if (!normalizedKey || !value) return;
    const existing = nodeMap.get(normalizedKey) || {
      id: `node:${normalizedKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'memory'}`,
      nodeType,
      key: normalizedKey,
      label,
      currentValue: '',
      history: [],
      temporalSummary: {},
    };
    existing.history.push({
      observedAt: item.observedAt || '',
      value,
      sourceExcerpt: item.sourceExcerpt || '',
      threadId: item.threadId || '',
      chunkId: item.chunkId || '',
      turnIds: item.turnIds || [],
    });
    existing.history.sort((left, right) => String(left.observedAt || '').localeCompare(String(right.observedAt || '')));
    existing.currentValue = existing.history[existing.history.length - 1]?.value || value;
    existing.temporalSummary = item.temporalScope || existing.temporalSummary;
    nodeMap.set(normalizedKey, existing);
  }

  for (const fact of extractedFacts) {
    appendNode('fact', `${fact.subject}:${fact.predicate}`, fact.predicate || fact.text, fact.objectText || fact.text, fact);
  }
  for (const pref of temporalPreferences) {
    appendNode('preference', `${pref.subject}:${pref.category}`, `${pref.subject} ${pref.category}`, pref.value, pref);
  }
  for (const event of lifeEvents) {
    appendNode('life-event', `${event.eventType}:${event.description}`, event.eventType, event.description, event);
  }

  return [...nodeMap.values()]
    .map((item) => normalizeKnowledgeNode(item))
    .filter(Boolean);
}

function buildPromotionPackets(knowledgeNodes = []) {
  const packets = [];
  for (const node of Array.isArray(knowledgeNodes) ? knowledgeNodes : []) {
    if (!Array.isArray(node.history) || !node.history.length) continue;
    const latest = node.history[node.history.length - 1];
    packets.push(normalizePromotionPacket({
      id: `packet:${node.id}`,
      kind: node.nodeType === 'preference' ? 'preference' : 'observation',
      proposedMemoryText: node.nodeType === 'fact'
        ? `${node.label} is ${node.currentValue}`
        : node.currentValue,
      sourceType: 'offline-ingestion',
      originSource: node.nodeType,
      sourceThreadId: latest.threadId,
      sourceChunkId: latest.chunkId,
      sourceTurnIds: latest.turnIds,
      archiveExcerpt: latest.sourceExcerpt || latest.value,
      evidenceSnippet: latest.sourceExcerpt || latest.value,
      temporalScope: node.temporalSummary,
      reviewStatus: 'pending',
      createdAt: latest.observedAt || '',
    }));
  }
  return packets.filter(Boolean);
}

function ingestConversationThreads(rawThreads = [], options = {}) {
  const threads = (Array.isArray(rawThreads) ? rawThreads : [])
    .map((item) => normalizeConversationThread(item))
    .filter((item) => Array.isArray(item.messages) && item.messages.length);
  const chunks = threads.flatMap((thread) => chunkConversationThread(thread, options));

  const extractedFacts = [];
  const temporalPreferences = [];
  const lifeEvents = [];
  for (const chunk of chunks) {
    const extracted = extractChunkKnowledge(chunk);
    extractedFacts.push(...extracted.extractedFacts);
    temporalPreferences.push(...extracted.temporalPreferences);
    lifeEvents.push(...extracted.lifeEvents);
  }

  const knowledgeNodes = buildKnowledgeNodes({ extractedFacts, temporalPreferences, lifeEvents });
  const promotionPackets = buildPromotionPackets(knowledgeNodes);

  return {
    version: 'penny-knowledge-ingestion.v1',
    threads,
    chunks,
    extractedFacts,
    temporalPreferences,
    lifeEvents,
    knowledgeNodes,
    promotionPackets,
    summary: {
      threadCount: threads.length,
      chunkCount: chunks.length,
      extractedFactCount: extractedFacts.length,
      temporalPreferenceCount: temporalPreferences.length,
      lifeEventCount: lifeEvents.length,
      knowledgeNodeCount: knowledgeNodes.length,
      promotionPacketCount: promotionPackets.length,
    },
  };
}

module.exports = {
  isLowSignalMessage,
  chunkConversationThread,
  extractChunkKnowledge,
  buildKnowledgeNodes,
  buildPromotionPackets,
  ingestConversationThreads,
};
