const crypto = require('crypto');

const PROMOTION_PACKET_VERSION = 'penny-promotion-packet.v1';
const CONSOLIDATION_PACKET_VERSION = 'penny-consolidation-packet.v1';
const SOURCE_ARTIFACT_VERSION = 'penny-source-artifact.v1';

function createId(prefix = 'pkb') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function trimText(value = '', limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function trimIso(value = '', fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function normalizeStringArray(values = [], limit = 24, itemLimit = 120) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = trimText(value, itemLimit);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeTemporalScope(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    label: trimText(raw.label || '', 120),
    observedAt: trimIso(raw.observedAt || raw.pointInTime || '', ''),
    startAt: trimIso(raw.startAt || '', ''),
    endAt: trimIso(raw.endAt || '', ''),
  };
}

function normalizeFreshnessLabel(value = '', fallback = 'unknown') {
  const text = trimText(value || fallback, 40).toLowerCase();
  if (!text) return fallback;
  if (['live', 'current', 'fresh', 'recent', 'stale', 'rolling', 'archived', 'unknown'].includes(text)) {
    return text;
  }
  return fallback;
}

function normalizeSourceScope(value = '', fallback = 'unknown') {
  const text = trimText(value || fallback, 40).toLowerCase();
  if (!text) return 'unknown';
  if (['session', 'cross-session', 'global', 'chapter', 'promotion-review', 'unknown'].includes(text)) {
    return text;
  }
  return 'unknown';
}

function sha256Hex(value = '') {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeSourceArtifactType(value = '') {
  const text = trimText(value || 'unknown-source', 80).toLowerCase();
  return text.replace(/[^a-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-source';
}

function normalizeCapabilityState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    localOnly: source.localOnly !== false,
    reviewGated: source.reviewGated !== false,
    explicitMemoryWrite: false,
    promptTruthInjection: false,
    defaultContextInjection: false,
  };
}

function normalizeSourceArtifact(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sourceType = normalizeSourceArtifactType(source.sourceType || source.type || 'unknown-source');
  const rawSource = Buffer.isBuffer(source.rawSourceBytes)
    ? source.rawSourceBytes
    : (source.rawSourceText ?? source.rawText ?? source.text ?? '');
  const suppliedChecksum = String(source.checksumSha256 || source.sha256 || '').trim().toLowerCase();
  const checksumSha256 = /^[a-f0-9]{64}$/.test(suppliedChecksum)
    ? suppliedChecksum
    : sha256Hex(rawSource);
  const suppliedBytes = Number(source.bytes || source.byteLength);
  const bytes = Number.isFinite(suppliedBytes) && suppliedBytes >= 0
    ? Math.floor(suppliedBytes)
    : (Buffer.isBuffer(rawSource) ? rawSource.length : Buffer.byteLength(String(rawSource || ''), 'utf8'));
  const sourceId = trimText(
    source.sourceId || `source:${sourceType}:${checksumSha256.slice(0, 16)}`,
    180,
  );
  return {
    schema: SOURCE_ARTIFACT_VERSION,
    sourceId,
    sourceType,
    originalPath: trimText(source.originalPath || source.path || '', 300),
    originalName: trimText(source.originalName || source.name || '', 160),
    checksumSha256,
    bytes,
    importedAt: trimIso(source.importedAt || source.createdAt || '', new Date().toISOString()),
    processingStatus: trimText(source.processingStatus || source.status || 'imported', 80) || 'imported',
    capabilityState: normalizeCapabilityState(source.capabilityState),
    privacyClass: 'local-private',
    memoryAuthority: 'none',
  };
}

function normalizeProbationState(raw = {}, defaults = {}) {
  const source = {
    ...(defaults && typeof defaults === 'object' ? defaults : {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
  const reviewStatus = trimText(source.reviewStatus || source.status || 'pending', 40) || 'pending';
  const reviewerDecision = trimText(source.reviewerDecision || '', 40);
  const pending = reviewStatus === 'pending';
  const probationary = source.probationary === true
    || (source.probationary !== false && !['approved', 'rejected'].includes(reviewStatus));
  return {
    reviewStatus,
    reviewerDecision,
    reviewedAt: trimIso(source.reviewedAt || '', ''),
    canonical: source.canonical === true && reviewStatus === 'approved',
    scope: trimText(source.scope || 'review-gated', 80) || 'review-gated',
    pending,
    probationary,
    queueReason: trimText(source.queueReason || source.reason || '', 140),
  };
}

function normalizeConsolidationPacket(raw = {}, defaults = {}) {
  const source = {
    ...(defaults && typeof defaults === 'object' ? defaults : {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
  const mergeBasis = normalizeStringArray(
    source.mergeBasis || source.selectedSignals || source.reasons || [],
    8,
    100,
  );
  const discardedDetailSummary = normalizeStringArray(
    source.discardedDetailSummary || source.penalties || source.discarded || [],
    8,
    140,
  );
  const sourceSessionIds = normalizeStringArray(
    source.sourceSessionIds || (source.sourceSessionId ? [source.sourceSessionId] : []),
    8,
    120,
  );
  const sourceTurnIds = normalizeStringArray(source.sourceTurnIds || source.turnIds || [], 16, 120);
  const sourceEpisodeIds = normalizeStringArray(source.sourceEpisodeIds || source.evidenceIds || [], 16, 120);
  const observedAt = trimIso(source.observedAt || source.createdAt || '', '');
  const lastTouchedAt = trimIso(source.lastTouchedAt || source.updatedAt || source.createdAt || '', '');
  const freshnessLabel = normalizeFreshnessLabel(source.freshnessLabel, source.lossy === true ? 'rolling' : 'unknown');
  const reviewStatus = trimText(source.reviewStatus || source.status || '', 40);
  return {
    contract: 'ConsolidationPacket',
    version: CONSOLIDATION_PACKET_VERSION,
    lossy: source.lossy === true,
    mergeKind: trimText(source.mergeKind || source.kind || (source.lossy === true ? 'lossy-merge' : 'carryover'), 60)
      || (source.lossy === true ? 'lossy-merge' : 'carryover'),
    mergeReason: trimText(source.mergeReason || source.reason || '', 140),
    mergeBasis,
    discardedDetailSummary,
    sourceScope: normalizeSourceScope(
      source.sourceScope || source.scope || '',
      sourceSessionIds.length > 1 ? 'cross-session' : (sourceSessionIds.length === 1 ? 'session' : 'unknown'),
    ),
    sourceSessionIds,
    sourceTurnIds,
    sourceEpisodeIds,
    sourceCount: Math.max(
      0,
      Number(
        source.sourceCount
        || sourceEpisodeIds.length
        || sourceTurnIds.length
        || sourceSessionIds.length,
      ),
    ),
    observedAt,
    lastTouchedAt,
    freshnessLabel,
    timing: {
      observedAt,
      lastTouchedAt,
      freshnessLabel,
    },
    reviewStatus,
    probationary: source.probationary === true || reviewStatus === 'pending',
  };
}

function normalizeConversationMessage(raw = {}, threadId = '') {
  const text = trimText(raw.text || raw.content || raw.message || '', 1200);
  if (!text) return null;
  return {
    id: trimText(raw.id || createId('msg'), 120),
    threadId: trimText(raw.threadId || threadId, 120),
    speakerId: trimText(raw.speakerId || raw.author || raw.role || 'unknown', 80),
    speakerName: trimText(raw.speakerName || raw.name || '', 120),
    text,
    createdAt: trimIso(raw.createdAt || raw.timestamp || raw.sentAt || '', ''),
    language: trimText(raw.language || '', 40),
  };
}

function normalizeConversationThread(raw = {}) {
  const id = trimText(raw.id || raw.threadId || createId('thread'), 120);
  const messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .map((item) => normalizeConversationMessage(item, id))
    .filter(Boolean)
    .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')));
  return {
    contract: 'ConversationThread',
    id,
    source: trimText(raw.source || 'import', 80),
    sourceArtifactId: trimText(raw.sourceArtifactId || '', 180),
    title: trimText(raw.title || raw.name || '', 160),
    participants: normalizeStringArray(raw.participants || [], 12, 80),
    startedAt: trimIso(raw.startedAt || messages[0]?.createdAt || '', ''),
    endedAt: trimIso(raw.endedAt || messages[messages.length - 1]?.createdAt || '', ''),
    messages,
    languages: normalizeStringArray(raw.languages || messages.map((item) => item.language).filter(Boolean), 8, 40),
  };
}

function normalizeThreadChunk(raw = {}) {
  const messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .map((item) => normalizeConversationMessage(item, raw.threadId || ''))
    .filter(Boolean);
  return {
    contract: 'ThreadChunk',
    id: trimText(raw.id || createId('chunk'), 120),
    threadId: trimText(raw.threadId || '', 120),
    sourceArtifactId: trimText(raw.sourceArtifactId || '', 180),
    ordinal: Math.max(0, Number(raw.ordinal || 0)),
    startedAt: trimIso(raw.startedAt || messages[0]?.createdAt || '', ''),
    endedAt: trimIso(raw.endedAt || messages[messages.length - 1]?.createdAt || '', ''),
    messageCount: messages.length,
    participantIds: normalizeStringArray(raw.participantIds || messages.map((item) => item.speakerId), 12, 80),
    excerpt: trimText(raw.excerpt || messages.map((item) => item.text).join(' '), 220),
    messages,
  };
}

function normalizeExtractedFact(raw = {}) {
  const text = trimText(raw.text || '', 220);
  if (!text) return null;
  return {
    contract: 'ExtractedFact',
    id: trimText(raw.id || createId('fact'), 120),
    threadId: trimText(raw.threadId || '', 120),
    chunkId: trimText(raw.chunkId || '', 120),
    sourceArtifactId: trimText(raw.sourceArtifactId || '', 180),
    turnIds: normalizeStringArray(raw.turnIds || raw.sourceTurnIds || [], 12, 120),
    subject: trimText(raw.subject || '', 120),
    predicate: trimText(raw.predicate || '', 120),
    objectText: trimText(raw.objectText || '', 160),
    text,
    sourceExcerpt: trimText(raw.sourceExcerpt || '', 220),
    observedAt: trimIso(raw.observedAt || '', ''),
    temporalScope: normalizeTemporalScope(raw.temporalScope),
  };
}

function normalizeTemporalPreference(raw = {}) {
  const value = trimText(raw.value || '', 160);
  if (!value) return null;
  return {
    contract: 'TemporalPreference',
    id: trimText(raw.id || createId('pref'), 120),
    threadId: trimText(raw.threadId || '', 120),
    chunkId: trimText(raw.chunkId || '', 120),
    sourceArtifactId: trimText(raw.sourceArtifactId || '', 180),
    turnIds: normalizeStringArray(raw.turnIds || raw.sourceTurnIds || [], 12, 120),
    subject: trimText(raw.subject || 'user', 120),
    category: trimText(raw.category || 'preference', 120),
    value,
    sourceExcerpt: trimText(raw.sourceExcerpt || '', 220),
    observedAt: trimIso(raw.observedAt || '', ''),
    temporalScope: normalizeTemporalScope(raw.temporalScope),
    language: trimText(raw.language || '', 40),
  };
}

function normalizeLifeEvent(raw = {}) {
  const description = trimText(raw.description || raw.text || '', 220);
  if (!description) return null;
  return {
    contract: 'LifeEvent',
    id: trimText(raw.id || createId('event'), 120),
    threadId: trimText(raw.threadId || '', 120),
    chunkId: trimText(raw.chunkId || '', 120),
    sourceArtifactId: trimText(raw.sourceArtifactId || '', 180),
    turnIds: normalizeStringArray(raw.turnIds || raw.sourceTurnIds || [], 12, 120),
    eventType: trimText(raw.eventType || 'life-event', 120),
    description,
    sourceExcerpt: trimText(raw.sourceExcerpt || '', 220),
    observedAt: trimIso(raw.observedAt || '', ''),
    temporalScope: normalizeTemporalScope(raw.temporalScope),
  };
}

function normalizeKnowledgeNode(raw = {}) {
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    contract: 'KnowledgeNode',
    id: trimText(raw.id || createId('node'), 120),
    nodeType: trimText(raw.nodeType || 'fact', 120),
    key: trimText(raw.key || '', 160),
    label: trimText(raw.label || raw.key || '', 220),
    currentValue: trimText(raw.currentValue || '', 220),
    history: history.map((item) => ({
      observedAt: trimIso(item?.observedAt || '', ''),
      value: trimText(item?.value || '', 220),
      sourceExcerpt: trimText(item?.sourceExcerpt || '', 220),
      threadId: trimText(item?.threadId || '', 120),
      chunkId: trimText(item?.chunkId || '', 120),
      sourceArtifactId: trimText(item?.sourceArtifactId || '', 180),
      turnIds: normalizeStringArray(item?.turnIds || [], 12, 120),
      temporalScope: normalizeTemporalScope(item?.temporalScope),
    })).filter((item) => item.value),
    temporalSummary: normalizeTemporalScope(raw.temporalSummary),
  };
}

function normalizeSourceObservation(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const value = trimText(source.value || source.text || source.proposedMemoryText || '', 220);
  const sourceExcerpt = trimText(source.sourceExcerpt || source.archiveExcerpt || source.evidenceSnippet || '', 220);
  const threadId = trimText(source.threadId || source.sourceThreadId || source.sessionId || '', 120);
  const chunkId = trimText(source.chunkId || source.sourceChunkId || '', 120);
  const sourceArtifactId = trimText(source.sourceArtifactId || '', 180);
  const turnIds = normalizeStringArray(source.turnIds || source.sourceTurnIds || source.evidenceIds || [], 12, 120);
  const observedAt = trimIso(source.observedAt || source.createdAt || source.timestamp || '', '');
  if (!value && !sourceExcerpt) return null;
  return {
    threadId,
    chunkId,
    sourceArtifactId,
    turnIds,
    observedAt,
    value,
    sourceExcerpt,
    temporalScope: normalizeTemporalScope(source.temporalScope),
  };
}

function normalizePromotionPacket(raw = {}) {
  const proposedMemoryText = trimText(raw.proposedMemoryText || raw.text || '', 220);
  if (!proposedMemoryText) return null;
  const sourceThreadId = trimText(raw.sourceThreadId || raw.threadId || raw.sessionId || '', 120);
  const sourceChunkId = trimText(raw.sourceChunkId || raw.chunkId || '', 120);
  const sourceArtifactId = trimText(raw.sourceArtifactId || '', 180);
  const sourceTurnIds = normalizeStringArray(raw.sourceTurnIds || raw.turnIds || raw.evidenceIds || [], 16, 120);
  const sourceObservations = [];
  for (const item of Array.isArray(raw.sourceObservations) ? raw.sourceObservations : []) {
    const normalized = normalizeSourceObservation(item);
    if (normalized) sourceObservations.push(normalized);
    if (sourceObservations.length >= 12) break;
  }
  return {
    contract: 'PromotionPacket',
    version: PROMOTION_PACKET_VERSION,
    id: trimText(raw.id || createId('promotion'), 120),
    kind: trimText(raw.kind || raw.originKind || 'observation', 80),
    proposedMemoryText,
    sourceType: trimText(raw.sourceType || 'promotion', 80),
    originSource: trimText(raw.originSource || '', 120),
    sourceArtifactId,
    sourceThreadId,
    sourceChunkId,
    sourceTurnIds,
    archiveExcerpt: trimText(raw.archiveExcerpt || raw.evidenceSnippet || proposedMemoryText, 220),
    evidenceSnippet: trimText(raw.evidenceSnippet || raw.archiveExcerpt || proposedMemoryText, 220),
    sourceObservations,
    temporalScope: normalizeTemporalScope(raw.temporalScope),
    probation: normalizeProbationState(raw.probation || raw, {
      reviewStatus: raw.reviewStatus || 'pending',
      reviewerDecision: raw.reviewerDecision || '',
      reviewedAt: raw.reviewedAt || '',
      canonical: false,
      scope: 'promotion-review',
    }),
    reviewStatus: trimText(raw.reviewStatus || 'pending', 40) || 'pending',
    reviewerDecision: trimText(raw.reviewerDecision || '', 40),
    consolidation: normalizeConsolidationPacket(raw.consolidation || raw.mergeProvenance || {}, {
      lossy: true,
      sourceSessionIds: sourceThreadId ? [sourceThreadId] : [],
      sourceTurnIds,
      observedAt: raw.createdAt || '',
      lastTouchedAt: raw.reviewedAt || raw.createdAt || '',
      freshnessLabel: raw.reviewStatus === 'approved' ? 'archived' : 'current',
    }),
    createdAt: trimIso(raw.createdAt || '', ''),
    reviewedAt: trimIso(raw.reviewedAt || '', ''),
  };
}

function validatePromotionPacket(packet = {}, options = {}) {
  const strictSource = options && typeof options === 'object' ? options : {};
  const normalized = normalizePromotionPacket(packet);
  if (!normalized) {
    throw new Error('Promotion packet is missing proposedMemoryText.');
  }
  if (!normalized.sourceType) {
    throw new Error(`Promotion packet ${normalized.id} is missing sourceType.`);
  }
  if (!normalized.sourceThreadId) {
    throw new Error(`Promotion packet ${normalized.id} is missing sourceThreadId.`);
  }
  if (strictSource.requireSourceChunkId && !normalized.sourceChunkId) {
    throw new Error(`Promotion packet ${normalized.id} is missing sourceChunkId.`);
  }
  if (!normalized.sourceTurnIds.length) {
    throw new Error(`Promotion packet ${normalized.id} is missing sourceTurnIds.`);
  }
  if (!normalized.archiveExcerpt) {
    throw new Error(`Promotion packet ${normalized.id} is missing archiveExcerpt.`);
  }
  if (!normalized.createdAt) {
    throw new Error(`Promotion packet ${normalized.id} is missing createdAt.`);
  }
  if (strictSource.requireSourceObservations) {
    if (!normalized.sourceObservations.length) {
      throw new Error(`Promotion packet ${normalized.id} is missing sourceObservations.`);
    }
    for (const observation of normalized.sourceObservations) {
      if (!observation.threadId || !observation.chunkId || !observation.turnIds.length) {
        throw new Error(`Promotion packet ${normalized.id} has an incomplete source observation.`);
      }
      if (!observation.observedAt || !observation.sourceExcerpt) {
        throw new Error(`Promotion packet ${normalized.id} has a source observation missing timing or excerpt.`);
      }
    }
  }
  return normalized;
}

module.exports = {
  PROMOTION_PACKET_VERSION,
  CONSOLIDATION_PACKET_VERSION,
  SOURCE_ARTIFACT_VERSION,
  normalizeSourceArtifact,
  normalizeConversationMessage,
  normalizeConversationThread,
  normalizeThreadChunk,
  normalizeExtractedFact,
  normalizeTemporalPreference,
  normalizeLifeEvent,
  normalizeKnowledgeNode,
  normalizeSourceObservation,
  normalizeProbationState,
  normalizeConsolidationPacket,
  normalizePromotionPacket,
  validatePromotionPacket,
};
