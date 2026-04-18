const {
  normalizeEpistemicCaution,
  normalizeArchiveSynthesis,
} = require('./penny-epistemics');
const {
  normalizeConsolidationPacket,
  normalizeProbationState,
} = require('./penny-knowledge-contracts');
const {
  normalizePromptSlotSummary,
} = require('./penny-prompt-stack');
const {
  LATENCY_CLASSES,
} = require('./penny-latency-budget');

const RUNTIME_ARTIFACT_VERSION = 'penny-runtime-artifact.v1';

function trimText(value = '', limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, Math.max(limit - 4, 0))).trimEnd()}...`;
}

function trimIso(value = '', fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function uniqueStrings(values = [], limit = 12) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, Number(fallback) || 0);
  return Math.round(parsed);
}

function latestIso(values = []) {
  let latest = '';
  let latestMs = -1;
  for (const value of values) {
    const iso = trimIso(value, '');
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = iso;
    }
  }
  return latest;
}

function normalizePerformanceStage(raw = {}, defaults = {}) {
  const source = {
    ...(defaults && typeof defaults === 'object' ? defaults : {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
  return {
    startedAt: trimIso(source.startedAt, ''),
    finishedAt: trimIso(source.finishedAt, ''),
    durationMs: normalizeNonNegativeNumber(source.durationMs, 0),
    available: source.available === true,
    cacheHit: source.cacheHit === true,
    source: String(source.source || '').trim(),
    note: trimText(source.note || '', 160),
  };
}

function normalizeLatencyClass(value = '') {
  const text = String(value || '').trim();
  if (!text) return LATENCY_CLASSES.CASUAL_COMPANION;
  if (Object.values(LATENCY_CLASSES).includes(text)) return text;
  return LATENCY_CLASSES.CASUAL_COMPANION;
}

function normalizeExecutionPath(value = '', fallback = 'llm-chat') {
  const text = String(value || fallback || '').trim();
  if (['deterministic-tool', 'llm-chat', 'llm-tool-loop', 'shadow'].includes(text)) return text;
  return fallback || 'llm-chat';
}

function normalizeModelUsage(value = '', fallback = 'used') {
  const text = String(value || fallback || '').trim();
  return text === 'not-used' ? 'not-used' : 'used';
}

function normalizeResearchLedgerUpdate(raw = {}, defaults = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const requestedStatus = String(value.status || fallback.status || '').trim();
  const status = ['skipped', 'applied', 'failed'].includes(requestedStatus) ? requestedStatus : 'skipped';
  return {
    status,
    reason: trimText(value.reason || fallback.reason || '', 180),
    topicId: trimText(value.topicId || value?.topic?.topicId || fallback.topicId || fallback?.topic?.topicId || '', 140),
    topicLabel: trimText(value.topicLabel || value?.topic?.topicLabel || fallback.topicLabel || fallback?.topic?.topicLabel || '', 180),
  };
}

function normalizePerformance(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const archiveRaw = { ...(fallback.archiveRetrieval || {}), ...(raw.archiveRetrieval || {}) };
  const semanticRenderRaw = { ...(fallback.semanticRender || {}), ...(raw.semanticRender || {}) };
  const modelRoundTripRaw = { ...(fallback.modelRoundTrip || {}), ...(raw.modelRoundTrip || {}) };
  return {
    latencyClass: normalizeLatencyClass(raw.latencyClass || fallback.latencyClass),
    request: normalizePerformanceStage(raw.request, fallback.request),
    promptAssembly: normalizePerformanceStage(raw.promptAssembly, fallback.promptAssembly),
    archiveRetrieval: {
      ...normalizePerformanceStage(archiveRaw, fallback.archiveRetrieval),
      sessionItems: normalizeNonNegativeNumber(archiveRaw.sessionItems, 0),
      globalItems: normalizeNonNegativeNumber(archiveRaw.globalItems, 0),
      semanticReady: archiveRaw.semanticReady === true,
      reasonCode: String(archiveRaw.reasonCode || '').trim(),
    },
    semanticRender: {
      ...normalizePerformanceStage(semanticRenderRaw, fallback.semanticRender),
      attempted: semanticRenderRaw.attempted === true,
      used: semanticRenderRaw.used === true,
    },
    modelResolution: normalizePerformanceStage(raw.modelResolution, fallback.modelResolution),
    semanticProbe: normalizePerformanceStage(raw.semanticProbe, fallback.semanticProbe),
    firstToken: {
      ...normalizePerformanceStage(raw.firstToken, fallback.firstToken),
      available: raw?.firstToken?.available === true
        || fallback?.firstToken?.available === true
        || Number.isFinite(Number(raw?.firstToken?.durationMs))
        || Number.isFinite(Number(fallback?.firstToken?.durationMs)),
    },
    modelRoundTrip: {
      ...normalizePerformanceStage(modelRoundTripRaw, fallback.modelRoundTrip),
      transport: String(modelRoundTripRaw.transport || '').trim(),
    },
  };
}

function normalizeReadiness(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const checkedAt = trimIso(raw.checkedAt || fallback.checkedAt, '');
  const cacheExpiresAt = trimIso(raw.cacheExpiresAt || fallback.cacheExpiresAt, '');
  const cacheHit = raw.cacheHit === true || fallback.cacheHit === true;
  const fallbackActive = raw.fallbackActive === true || fallback.fallbackActive === true;
  const requestedWarmState = String(raw.warmState || fallback.warmState || '').trim();
  const warmState = ['warm', 'cold', 'degraded'].includes(requestedWarmState)
    ? requestedWarmState
    : (fallbackActive ? 'degraded' : (cacheHit ? 'warm' : 'cold'));
  return {
    chatModelReady: raw.chatModelReady === true || fallback.chatModelReady === true,
    toolModelReady: raw.toolModelReady === true || fallback.toolModelReady === true,
    embeddingReady: raw.embeddingReady === true || fallback.embeddingReady === true,
    fallbackActive,
    modelUsage: normalizeModelUsage(raw.modelUsage, fallback.modelUsage),
    warmState,
    checkedAt,
    cacheAgeMs: normalizeNonNegativeNumber(raw.cacheAgeMs, fallback.cacheAgeMs || 0),
    cacheExpiresAt,
    cacheHit,
  };
}

function buildRuntimeReadiness({ lmStudio = {}, semanticMemory = {} } = {}) {
  const chatModelReady = lmStudio?.reachable === true
    && !!String(lmStudio?.resolvedChatModel || lmStudio?.resolvedModel || '').trim();
  const toolModelReady = lmStudio?.reachable === true
    && !!String(lmStudio?.resolvedToolModel || '').trim();
  const embeddingReady = semanticMemory?.ready === true;
  const fallbackActive = !chatModelReady || !toolModelReady || semanticMemory?.fallback === true;
  const checkedAt = latestIso([
    lmStudio?.probe?.checkedAt,
    semanticMemory?.probe?.checkedAt,
  ]);
  const cacheExpiresAt = latestIso([
    lmStudio?.probe?.cacheExpiresAt,
    semanticMemory?.probe?.cacheExpiresAt,
  ]);
  const cacheAgeMs = Math.max(
    normalizeNonNegativeNumber(lmStudio?.probe?.cacheAgeMs, 0),
    normalizeNonNegativeNumber(semanticMemory?.probe?.cacheAgeMs, 0),
  );
  const cacheHit = lmStudio?.probe?.cacheHit === true || semanticMemory?.probe?.cacheHit === true;
  return normalizeReadiness({
    chatModelReady,
    toolModelReady,
    embeddingReady,
    fallbackActive,
    modelUsage: 'used',
    warmState: fallbackActive ? 'degraded' : (cacheHit ? 'warm' : 'cold'),
    checkedAt,
    cacheAgeMs,
    cacheExpiresAt,
    cacheHit,
  });
}

function buildRuntimeStatusPerformance({ lmStudio = {}, semanticMemory = {} } = {}) {
  return normalizePerformance({
    latencyClass: LATENCY_CLASSES.CASUAL_COMPANION,
    request: {
      startedAt: latestIso([lmStudio?.probe?.startedAt, semanticMemory?.probe?.startedAt]),
      finishedAt: latestIso([lmStudio?.probe?.finishedAt, semanticMemory?.probe?.finishedAt]),
      durationMs: Math.max(
        normalizeNonNegativeNumber(lmStudio?.probe?.durationMs, 0),
        normalizeNonNegativeNumber(semanticMemory?.probe?.durationMs, 0),
      ),
      available: true,
      note: 'Status probe summary.',
    },
    modelResolution: {
      ...lmStudio?.probe,
      available: true,
      source: 'lmstudio-status',
      note: String(lmStudio?.error || lmStudio?.hint || '').trim(),
    },
    semanticProbe: {
      ...semanticMemory?.probe,
      available: true,
      source: 'semantic-memory-status',
      note: String(semanticMemory?.reason || '').trim(),
    },
  });
}

function normalizeEvidenceEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() || 'note';
  const source = String(raw.source || '').trim() || '';
  const label = trimText(raw.label || '', 140);
  const text = trimText(raw.text || raw.preview || raw.value || '', 220);
  const target = trimText(raw.target || raw.path || raw.url || '', 220);
  if (!label && !text && !target) return null;
  return {
    type,
    source,
    label,
    text,
    target,
  };
}

function normalizeArtifactEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() || 'note';
  const value = trimText(raw.value || raw.path || raw.url || raw.label || '', 220);
  if (!value) return null;
  return {
    type,
    value,
  };
}

function normalizeSideEffectEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() || 'note';
  const target = trimText(raw.target || raw.path || raw.label || '', 220);
  const status = String(raw.status || '').trim() || 'observed';
  if (!target) return null;
  return {
    type,
    target,
    status,
  };
}

function normalizeEvidenceRefSummary(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() || 'evidence';
  const tool = trimText(raw.tool || '', 80);
  const ref = trimText(raw.ref || raw.target || raw.path || raw.url || raw.query || '', 220);
  const label = trimText(raw.label || '', 160);
  const note = trimText(raw.note || '', 220);
  const status = String(raw.status || '').trim() || 'verified';
  if (!ref && !label && !note) return null;
  return {
    type,
    tool,
    ref,
    label,
    note,
    status,
  };
}

function normalizeRetrievalTraceEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const channel = String(raw.channel || '').trim() || 'archive';
  const sourceId = trimText(raw.sourceId || raw.id || '', 140);
  const sourceLabel = trimText(raw.sourceLabel || raw.source || channel, 140);
  const reason = trimText(raw.reason || '', 140);
  const contradictionState = trimText(raw.contradictionState || 'none', 80) || 'none';
  const injected = raw.injected !== false;
  const score = Number.isFinite(Number(raw.score)) ? Math.round(Number(raw.score) * 1000) / 1000 : 0;
  const sourceType = trimText(raw.sourceType || '', 80);
  const scope = trimText(raw.scope || raw.sourceScope || '', 80);
  const createdAt = trimIso(raw.createdAt, '');
  const snippet = trimText(raw.snippet || raw.evidenceSnippet || raw.detail || raw.text || '', 220);
  const sourceEpisodeIds = uniqueStrings(raw.sourceEpisodeIds || raw.evidenceIds || [], 8);
  const sourceSessionIds = uniqueStrings(
    raw.sourceSessionIds
      || (raw.sourceSessionId ? [raw.sourceSessionId] : []),
    8,
  );
  const sourceTurnIds = uniqueStrings(raw.sourceTurnIds || [], 12);
  const matchedTokens = uniqueStrings(raw.matchedTokens || [], 6);
  const evidenceRefs = (Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : [])
    .map(normalizeEvidenceRefSummary)
    .filter(Boolean)
    .slice(0, 4);
  const consolidationPacket = normalizeConsolidationPacket(raw.consolidation || raw.mergeProvenance || {}, {
    lossy: raw?.consolidation?.lossy === true,
    freshnessLabel: raw?.consolidation?.freshnessLabel || 'unknown',
  });
  const probation = raw.probation || raw.reviewStatus || raw.reviewedAt
    ? normalizeProbationState(raw.probation || {}, {
        reviewStatus: raw.reviewStatus || '',
        reviewedAt: raw.reviewedAt || '',
        reviewerDecision: raw.reviewerDecision || '',
        canonical: false,
        scope: 'archive-advisory',
      })
    : null;
  if (!sourceId && !sourceLabel) return null;
  return {
    channel,
    sourceId,
    sourceLabel,
    score,
    reason,
    contradictionState,
    injected,
    sourceType,
    scope,
    createdAt,
    snippet,
    sourceEpisodeIds,
    sourceSessionIds,
    sourceTurnIds,
    matchedTokens,
    evidenceRefs,
    reviewStatus: probation?.reviewStatus || '',
    probationary: probation?.probationary === true,
    consolidation: {
      lossy: consolidationPacket.lossy === true,
      mergeKind: consolidationPacket.mergeKind,
      mergeReason: consolidationPacket.mergeReason,
      mergeBasis: consolidationPacket.mergeBasis,
      discardedDetailSummary: consolidationPacket.discardedDetailSummary,
      sourceScope: consolidationPacket.sourceScope,
      freshnessLabel: consolidationPacket.freshnessLabel,
    },
  };
}

function normalizeTraceStateEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const layer = String(raw.layer || raw.type || '').trim() || 'note';
  const label = trimText(raw.label || raw.title || layer, 140);
  const detail = trimText(raw.detail || raw.text || '', 220);
  const status = String(raw.status || '').trim() || 'noted';
  const count = Number.isFinite(Number(raw.count)) ? Math.max(0, Math.round(Number(raw.count))) : 0;
  if (!label && !detail) return null;
  return {
    layer,
    label,
    detail,
    status,
    count,
  };
}

function normalizeTraceEvidenceEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() || 'note';
  const channel = String(raw.channel || '').trim() || 'runtime';
  const label = trimText(raw.label || raw.title || '', 140);
  const detail = trimText(raw.detail || raw.text || '', 220);
  const status = String(raw.status || '').trim() || 'recorded';
  if (!label && !detail) return null;
  return {
    type,
    channel,
    label,
    detail,
    status,
  };
}

function normalizeQaValiditySummary(raw = {}) {
  if (!raw || typeof raw !== 'object' || raw.active !== true) {
    return {
      active: false,
      verdict: 'n/a',
      reasons: [],
    };
  }
  return {
    active: true,
    verdict: String(raw.verdict || '').trim() || 'unknown',
    reasons: uniqueStrings(raw.reasons || [], 6),
  };
}

function normalizeArtifactProvenance(raw = {}, defaults = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    retrieval: (Array.isArray(value.retrieval) ? value.retrieval : fallback.retrieval || [])
      .map(normalizeRetrievalTraceEntry)
      .filter(Boolean)
      .slice(0, 12),
    contradictions: (Array.isArray(value.contradictions) ? value.contradictions : fallback.contradictions || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    openQuestions: (Array.isArray(value.openQuestions) ? value.openQuestions : fallback.openQuestions || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    ongoingInvestigations: (Array.isArray(value.ongoingInvestigations) ? value.ongoingInvestigations : fallback.ongoingInvestigations || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    acceptedEvidence: (Array.isArray(value.acceptedEvidence) ? value.acceptedEvidence : fallback.acceptedEvidence || [])
      .map(normalizeTraceEvidenceEntry)
      .filter(Boolean)
      .slice(0, 8),
    rejectedEvidence: (Array.isArray(value.rejectedEvidence) ? value.rejectedEvidence : fallback.rejectedEvidence || [])
      .map(normalizeTraceEvidenceEntry)
      .filter(Boolean)
      .slice(0, 8),
  };
}

function normalizeTraceState(raw = {}, defaults = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const laneChoiceRaw = { ...(fallback.laneChoice || {}), ...(value.laneChoice || {}) };
  return {
    laneChoice: {
      requestedMode: String(laneChoiceRaw.requestedMode || '').trim() || 'local',
      selectedLane: String(laneChoiceRaw.selectedLane || '').trim() || 'chat',
      backend: String(laneChoiceRaw.backend || '').trim(),
      route: String(laneChoiceRaw.route || '').trim() || '/api/penny/chat',
      requestedModel: String(laneChoiceRaw.requestedModel || '').trim(),
      resolvedModel: String(laneChoiceRaw.resolvedModel || '').trim(),
      executionPath: normalizeExecutionPath(laneChoiceRaw.executionPath, 'llm-chat'),
      usedFallback: laneChoiceRaw.usedFallback === true,
      laneFallback: laneChoiceRaw.laneFallback === true,
      researchLedgerPromptInjected: laneChoiceRaw.researchLedgerPromptInjected === true,
      researchLedgerUpdateStatus: String(laneChoiceRaw.researchLedgerUpdateStatus || '').trim() || 'skipped',
    },
    wakeHierarchy: (Array.isArray(value.wakeHierarchy) ? value.wakeHierarchy : fallback.wakeHierarchy || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 8),
    retrievalChannels: (Array.isArray(value.retrievalChannels) ? value.retrievalChannels : fallback.retrievalChannels || [])
      .map(normalizeRetrievalTraceEntry)
      .filter(Boolean)
      .slice(0, 12),
    contradictions: (Array.isArray(value.contradictions) ? value.contradictions : fallback.contradictions || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    openQuestions: (Array.isArray(value.openQuestions) ? value.openQuestions : fallback.openQuestions || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    ongoingInvestigations: (Array.isArray(value.ongoingInvestigations) ? value.ongoingInvestigations : fallback.ongoingInvestigations || [])
      .map(normalizeTraceStateEntry)
      .filter(Boolean)
      .slice(0, 6),
    evidenceAccepted: (Array.isArray(value.evidenceAccepted) ? value.evidenceAccepted : fallback.evidenceAccepted || [])
      .map(normalizeTraceEvidenceEntry)
      .filter(Boolean)
      .slice(0, 8),
    evidenceRejected: (Array.isArray(value.evidenceRejected) ? value.evidenceRejected : fallback.evidenceRejected || [])
      .map(normalizeTraceEvidenceEntry)
      .filter(Boolean)
      .slice(0, 8),
    qaValidity: normalizeQaValiditySummary(value.qaValidity || fallback.qaValidity),
  };
}

function normalizeRepairInfo(value) {
  if (!value || typeof value !== 'object') return null;
  const firstPassGuardCodes = uniqueStrings(value.firstPassGuardCodes || [], 6);
  const repairAttempted = value.repairAttempted === true;
  const repairAccepted = value.repairAccepted === true;
  const repairRejectedReason = String(value.repairRejectedReason || '').trim();
  const finalCandidateSource = String(value.finalCandidateSource || '').trim() || 'first-pass';
  const scope = String(value.scope || '').trim() || 'semantic-render';
  if (!firstPassGuardCodes.length && !repairAttempted && !repairAccepted && !repairRejectedReason && finalCandidateSource === 'first-pass') {
    return null;
  }
  return {
    firstPassGuardCodes,
    repairAttempted,
    repairAccepted,
    repairRejectedReason,
    finalCandidateSource,
    scope,
  };
}

function normalizeCleanupInfo(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    reasonCode: String(raw.reasonCode || fallback.reasonCode || '').trim() || 'none',
    cleanupApplied: raw.cleanupApplied === true || fallback.cleanupApplied === true,
    materialChange: raw.materialChange === true || fallback.materialChange === true,
    reconstructedReply: raw.reconstructedReply === true || fallback.reconstructedReply === true,
    usedReasoningFallback: raw.usedReasoningFallback === true || fallback.usedReasoningFallback === true,
  };
}

function normalizeCleanupTransformInfo(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    class: String(raw.class || fallback.class || '').trim() || 'pass-through',
    scope: String(raw.scope || fallback.scope || '').trim() || 'presentation-only',
    semanticRepair: raw.semanticRepair === true || fallback.semanticRepair === true,
    materiality: String(raw.materiality || fallback.materiality || '').trim() || 'none',
    idempotent: raw.idempotent !== false && fallback.idempotent !== false,
    expectedIdempotence: String(raw.expectedIdempotence || fallback.expectedIdempotence || '').trim() || 'stable-once-cleaned',
    operations: uniqueStrings(
      Array.isArray(raw.operations) ? raw.operations : (fallback.operations || []),
      12,
    ),
  };
}

function deriveCleanupTransformInfoFromCleanup(cleanup = null) {
  const normalizedCleanup = normalizeCleanupInfo(cleanup);
  const reasonCode = String(normalizedCleanup.reasonCode || 'none').trim() || 'none';
  let transformClass = 'pass-through';
  if (reasonCode === 'raw_reasoning_fallback') transformClass = 'reasoning-fallback';
  else if (['salvaged_draft_candidate', 'salvaged_quote_candidate'].includes(reasonCode)) transformClass = 'salvage-reconstruction';
  else if (reasonCode === 'tagged_visible_reply') transformClass = 'tag-extract';
  else if (normalizedCleanup.cleanupApplied === true) transformClass = 'presentation-cleanup';
  const operations = [];
  if (reasonCode === 'salvaged_draft_candidate') operations.push('salvage-draft-candidate');
  if (reasonCode === 'salvaged_quote_candidate') operations.push('salvage-quoted-reply');
  if (normalizedCleanup.usedReasoningFallback === true) operations.push('fallback-to-reasoning');
  if (transformClass === 'presentation-cleanup') operations.push('presentation-cleanup');
  if (transformClass === 'tag-extract') operations.push('extract-visible-tag');
  return {
    class: transformClass,
    scope: 'presentation-only',
    semanticRepair: false,
    materiality: normalizedCleanup.reconstructedReply
      ? 'reconstructed'
      : (normalizedCleanup.cleanupApplied
        ? (normalizedCleanup.materialChange ? 'material' : 'surface')
        : 'none'),
    idempotent: true,
    expectedIdempotence: 'stable-once-cleaned',
    operations,
  };
}

function normalizePromptComposition(value = {}, defaults = {}) {
  return normalizePromptSlotSummary(
    value && typeof value === 'object' ? value : {},
    defaults && typeof defaults === 'object' ? defaults : {},
  );
}

function normalizeApproximatePath(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    status: String(raw.status || fallback.status || '').trim() || 'exact',
    degraded: raw.degraded === true || fallback.degraded === true,
    approximateByPolicy: raw.approximateByPolicy === true || fallback.approximateByPolicy === true,
    latencyClass: String(raw.latencyClass || fallback.latencyClass || '').trim() || LATENCY_CLASSES.CASUAL_COMPANION,
    policyMode: String(raw.policyMode || fallback.policyMode || '').trim() || 'bounded-approximate',
    policyNote: trimText(raw.policyNote || fallback.policyNote || '', 220),
    semanticQueryAllowed: raw.semanticQueryAllowed === true || fallback.semanticQueryAllowed === true,
    archiveCompressionAllowed: raw.archiveCompressionAllowed === true || fallback.archiveCompressionAllowed === true,
    semanticRenderAllowed: raw.semanticRenderAllowed === true || fallback.semanticRenderAllowed === true,
    compressionUsed: raw.compressionUsed === true || fallback.compressionUsed === true,
    semanticDowngrade: raw.semanticDowngrade === true || fallback.semanticDowngrade === true,
    usedFallback: raw.usedFallback === true || fallback.usedFallback === true,
    laneFallback: raw.laneFallback === true || fallback.laneFallback === true,
    reasons: uniqueStrings(
      Array.isArray(raw.reasons) ? raw.reasons : (fallback.reasons || []),
      10,
    ),
  };
}

function normalizeAdvisoryMergeSummary(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    advisoryItems: normalizeNonNegativeNumber(raw.advisoryItems, fallback.advisoryItems || 0),
    lossyItems: normalizeNonNegativeNumber(raw.lossyItems, fallback.lossyItems || 0),
    reviewGatedItems: normalizeNonNegativeNumber(raw.reviewGatedItems, fallback.reviewGatedItems || 0),
    sameSessionItems: normalizeNonNegativeNumber(raw.sameSessionItems, fallback.sameSessionItems || 0),
    crossSessionItems: normalizeNonNegativeNumber(raw.crossSessionItems, fallback.crossSessionItems || 0),
    mergeBasis: uniqueStrings(Array.isArray(raw.mergeBasis) ? raw.mergeBasis : fallback.mergeBasis || [], 10),
    discardedDetailSummary: uniqueStrings(
      Array.isArray(raw.discardedDetailSummary) ? raw.discardedDetailSummary : fallback.discardedDetailSummary || [],
      10,
    ),
    sourceScopes: uniqueStrings(Array.isArray(raw.sourceScopes) ? raw.sourceScopes : fallback.sourceScopes || [], 6),
    freshnessLabels: uniqueStrings(Array.isArray(raw.freshnessLabels) ? raw.freshnessLabels : fallback.freshnessLabels || [], 6),
  };
}

function normalizeAuthorityPressure(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    canonicalFactsPresent: raw.canonicalFactsPresent === true || fallback.canonicalFactsPresent === true,
    canonicalOverrideActive: raw.canonicalOverrideActive === true || fallback.canonicalOverrideActive === true,
    advisoryChannelsInjected: normalizeNonNegativeNumber(raw.advisoryChannelsInjected, fallback.advisoryChannelsInjected || 0),
    advisoryItemsInjected: normalizeNonNegativeNumber(raw.advisoryItemsInjected, fallback.advisoryItemsInjected || 0),
    sameSessionAdvisoryItems: normalizeNonNegativeNumber(raw.sameSessionAdvisoryItems, fallback.sameSessionAdvisoryItems || 0),
    crossSessionAdvisoryItems: normalizeNonNegativeNumber(raw.crossSessionAdvisoryItems, fallback.crossSessionAdvisoryItems || 0),
  };
}

function buildAuthorityPressure({
  sessionId = 'default',
  retrievalTrace = [],
  canonicalFactsPresent = false,
  canonicalOverrideActive = false,
} = {}) {
  const advisoryItems = (Array.isArray(retrievalTrace) ? retrievalTrace : [])
    .filter((item) => item?.injected !== false)
    .filter((item) => ['archive-session', 'archive-global', 'archive-chapter', 'memory-book', 'research-ledger'].includes(String(item?.channel || '').trim()));
  const advisoryChannelsInjected = new Set(
    advisoryItems
      .map((item) => String(item?.channel || '').trim())
      .filter(Boolean),
  ).size;
  let sameSessionAdvisoryItems = 0;
  let crossSessionAdvisoryItems = 0;
  const normalizedSessionId = String(sessionId || '').trim() || 'default';
  for (const item of advisoryItems) {
    const channel = String(item?.channel || '').trim();
    if (!channel || channel === 'memory-book') continue;
    if (channel === 'archive-session') {
      sameSessionAdvisoryItems += 1;
      continue;
    }
    const sourceSessionIds = Array.isArray(item?.sourceSessionIds)
      ? item.sourceSessionIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (sourceSessionIds.length) {
      if (sourceSessionIds.includes(normalizedSessionId)) sameSessionAdvisoryItems += 1;
      else crossSessionAdvisoryItems += 1;
      continue;
    }
    if (channel === 'archive-global' || channel === 'archive-chapter' || channel === 'research-ledger') {
      crossSessionAdvisoryItems += 1;
    }
  }
  return normalizeAuthorityPressure({
    canonicalFactsPresent,
    canonicalOverrideActive,
    advisoryChannelsInjected,
    advisoryItemsInjected: advisoryItems.length,
    sameSessionAdvisoryItems,
    crossSessionAdvisoryItems,
  });
}

function buildApproximatePath({
  latencyBudget = null,
  retrieval = null,
  readiness = null,
  usedFallback = false,
  laneFallback = false,
} = {}) {
  const budget = latencyBudget && typeof latencyBudget === 'object' ? latencyBudget : {};
  const semanticDowngrade = retrieval?.semanticDowngrade === true;
  const compressionUsed = retrieval?.compression?.used === true;
  const degraded = usedFallback === true || laneFallback === true || readiness?.fallbackActive === true || semanticDowngrade;
  const approximateByPolicy = budget.approximateByPolicy === true;
  const reasons = [];
  if (budget.approximateByPolicy === true) reasons.push('bounded-latency-policy');
  if (budget.allowSemanticQuery === false) reasons.push('semantic-query-held-back');
  if (budget.allowArchiveCompression === false) reasons.push('chapter-compression-held-back');
  if (budget.allowSemanticRender === false) reasons.push('semantic-render-held-back');
  if (compressionUsed) reasons.push('chapter-compression-used');
  if (semanticDowngrade) reasons.push(String(retrieval?.semanticDowngradeReason || 'semantic-downgrade').trim() || 'semantic-downgrade');
  if (laneFallback) reasons.push('lane-fallback');
  if (usedFallback === true || readiness?.fallbackActive === true) reasons.push('runtime-fallback');
  return normalizeApproximatePath({
    status: degraded ? 'degraded' : ((approximateByPolicy || compressionUsed) ? 'bounded-approximate' : 'exact'),
    degraded,
    approximateByPolicy,
    latencyClass: budget.latencyClass || LATENCY_CLASSES.CASUAL_COMPANION,
    policyMode: budget.policyMode || 'bounded-approximate',
    policyNote: budget.policyNote || '',
    semanticQueryAllowed: budget.allowSemanticQuery === true,
    archiveCompressionAllowed: budget.allowArchiveCompression === true,
    semanticRenderAllowed: budget.allowSemanticRender === true,
    compressionUsed,
    semanticDowngrade,
    usedFallback,
    laneFallback,
    reasons,
  });
}

function buildAdvisoryMergeSummary({ sessionId = 'default', retrievalTrace = [] } = {}) {
  const normalizedSessionId = String(sessionId || '').trim() || 'default';
  const advisoryItems = (Array.isArray(retrievalTrace) ? retrievalTrace : [])
    .filter((item) => item?.injected !== false)
    .filter((item) => ['archive-session', 'archive-global', 'archive-chapter', 'research-ledger'].includes(String(item?.channel || '').trim()));
  const mergeBasis = [];
  const discardedDetailSummary = [];
  const sourceScopes = [];
  const freshnessLabels = [];
  let lossyItems = 0;
  let reviewGatedItems = 0;
  let sameSessionItems = 0;
  let crossSessionItems = 0;
  for (const item of advisoryItems) {
    const consolidation = item?.consolidation && typeof item.consolidation === 'object' ? item.consolidation : {};
    if (consolidation.lossy === true) lossyItems += 1;
    if (item?.probationary === true || item?.reviewStatus === 'pending') reviewGatedItems += 1;
    mergeBasis.push(...(Array.isArray(consolidation.mergeBasis) ? consolidation.mergeBasis : []));
    discardedDetailSummary.push(...(Array.isArray(consolidation.discardedDetailSummary) ? consolidation.discardedDetailSummary : []));
    if (consolidation.sourceScope) sourceScopes.push(consolidation.sourceScope);
    if (consolidation.freshnessLabel) freshnessLabels.push(consolidation.freshnessLabel);
    const sourceSessionIds = Array.isArray(item?.sourceSessionIds)
      ? item.sourceSessionIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (sourceSessionIds.length) {
      if (sourceSessionIds.includes(normalizedSessionId)) sameSessionItems += 1;
      else crossSessionItems += 1;
    } else if (item?.channel === 'archive-session') {
      sameSessionItems += 1;
    } else {
      crossSessionItems += 1;
    }
  }
  return normalizeAdvisoryMergeSummary({
    advisoryItems: advisoryItems.length,
    lossyItems,
    reviewGatedItems,
    sameSessionItems,
    crossSessionItems,
    mergeBasis,
    discardedDetailSummary,
    sourceScopes,
    freshnessLabels,
  });
}

function sourceLabelForRetrievalItem(item = {}) {
  const sourceLabel = String(item.sourceLabel || '').trim();
  if (sourceLabel) return sourceLabel;
  const source = String(item.source || '').trim();
  if (source) return source;
  const scope = String(item.scope || '').trim();
  if (scope === 'session') return 'archive-session';
  if (scope === 'global') return 'archive-global';
  return 'archive';
}

function buildRetrievalTraceState(
  retrieval = null,
  matchedBooks = [],
  researchLedgerContext = null,
  researchLedgerPromptInjected = true,
) {
  const entries = [];
  const contradictionState = Array.isArray(retrieval?.provenance) && retrieval.provenance.length
    ? 'tracked'
    : 'none';
  const reason = String(retrieval?.reasonCode || '').trim();
  for (const item of Array.isArray(retrieval?.session) ? retrieval.session : []) {
    entries.push({
      channel: 'archive-session',
      sourceId: item?.id || '',
      sourceLabel: sourceLabelForRetrievalItem(item),
      score: item?.score,
      reason: reason || 'archive-session',
      contradictionState,
      injected: true,
      sourceType: item?.sourceType || 'archive',
      scope: item?.scope || 'session',
      createdAt: item?.createdAt || '',
      snippet: item?.evidenceSnippet || item?.text || '',
      sourceEpisodeIds: item?.sourceEpisodeIds || [],
      sourceSessionIds: item?.sourceSessionIds || (item?.sessionId ? [item.sessionId] : []),
      sourceTurnIds: item?.sourceTurnIds || [],
      matchedTokens: item?.matchedTokens || [],
      consolidation: item?.consolidation || null,
      probation: item?.probation || null,
      reviewStatus: item?.reviewStatus || item?.probation?.reviewStatus || '',
    });
  }
  for (const item of Array.isArray(retrieval?.global) ? retrieval.global : []) {
    entries.push({
      channel: 'archive-global',
      sourceId: item?.id || '',
      sourceLabel: sourceLabelForRetrievalItem(item),
      score: item?.score,
      reason: reason || 'archive-global',
      contradictionState,
      injected: true,
      sourceType: item?.sourceType || 'archive',
      scope: item?.scope || 'global',
      createdAt: item?.createdAt || '',
      snippet: item?.evidenceSnippet || item?.text || '',
      sourceEpisodeIds: item?.sourceEpisodeIds || [],
      sourceSessionIds: item?.sourceSessionIds || (item?.sessionId ? [item.sessionId] : []),
      sourceTurnIds: item?.sourceTurnIds || [],
      matchedTokens: item?.matchedTokens || [],
      consolidation: item?.consolidation || null,
      probation: item?.probation || null,
      reviewStatus: item?.reviewStatus || item?.probation?.reviewStatus || '',
    });
  }
  for (const item of Array.isArray(retrieval?.compression?.chapters) ? retrieval.compression.chapters : []) {
    entries.push({
      channel: 'archive-chapter',
      sourceId: item?.id || '',
      sourceLabel: String(item?.sourceType || 'chapter').trim() || 'chapter',
      score: item?.confidence,
      reason: String(retrieval?.compression?.reasonCode || '').trim() || 'chapter-compression',
      contradictionState,
      injected: retrieval?.compression?.used === true,
      sourceType: item?.sourceType || 'chapter',
      scope: 'chapter',
      createdAt: item?.createdAt || '',
      snippet: item?.evidenceSnippet || item?.text || '',
      sourceEpisodeIds: item?.sourceEpisodeIds || [],
      sourceSessionIds: item?.sourceSessionIds || [],
      sourceTurnIds: item?.sourceTurnIds || [],
      matchedTokens: item?.matchedTokens || [],
      consolidation: item?.consolidation || retrieval?.compression?.consolidation || {
        lossy: retrieval?.compression?.used === true,
        mergeKind: retrieval?.compression?.used === true ? 'compression-fallback' : 'compression-idle',
        mergeReason: retrieval?.compression?.reasonCode || retrieval?.compression?.reason || '',
        mergeBasis: retrieval?.compression?.explanation?.selectedSignals
          || (Array.isArray(retrieval?.provenance) && retrieval.provenance.length ? ['active-contradiction'] : []),
        discardedDetailSummary: retrieval?.compression?.explanation?.penalties || [],
        freshnessLabel: retrieval?.compression?.used === true ? 'rolling' : 'unknown',
        sourceScope: 'chapter',
      },
      probation: item?.probation || null,
      reviewStatus: item?.reviewStatus || item?.probation?.reviewStatus || '',
    });
  }
  for (const item of Array.isArray(matchedBooks) ? matchedBooks : []) {
    entries.push({
      channel: 'memory-book',
      sourceId: item?.id || '',
      sourceLabel: String(item?.sourceLabel || item?.source || 'book').trim() || 'book',
      score: item?.score,
      reason: 'memory-book-match',
      contradictionState: 'none',
      injected: true,
      sourceType: 'memory-book',
      scope: item?.placement || 'memory',
      snippet: item?.evidenceSnippet || item?.text || '',
      matchedTokens: item?.matchedPhrases || [],
    });
  }
  for (const item of Array.isArray(researchLedgerContext?.topics) ? researchLedgerContext.topics : []) {
    entries.push({
      channel: 'research-ledger',
      sourceId: item?.topicId || '',
      sourceLabel: trimText(item?.topicLabel || item?.summary || 'ongoing-investigation', 140),
      score: item?.status === 'open' ? 1 : item?.status === 'provisional' ? 0.75 : 0.5,
      reason: 'research-continuity-ledger',
      contradictionState: Array.isArray(item?.contradictions) && item.contradictions.length ? 'tracked' : 'none',
      injected: researchLedgerPromptInjected === true,
      sourceType: 'research-ledger',
      scope: 'research-ledger',
      createdAt: item?.lastTouchedAt || '',
      snippet: item?.summary || item?.conclusion || item?.question || '',
      sourceSessionIds: item?.sourceSessionIds || [],
      sourceTurnIds: item?.sourceTurnIds || [],
      evidenceRefs: item?.evidenceRefs || [],
    });
  }
  return entries
    .map(normalizeRetrievalTraceEntry)
    .filter(Boolean)
    .slice(0, 12);
}

function buildArtifactProvenance({ retrievalTrace = [], trace = null } = {}) {
  const traceState = trace && typeof trace === 'object' ? trace : {};
  return normalizeArtifactProvenance({
    retrieval: retrievalTrace,
    contradictions: traceState.contradictions || [],
    openQuestions: traceState.openQuestions || [],
    ongoingInvestigations: traceState.ongoingInvestigations || [],
    acceptedEvidence: traceState.evidenceAccepted || [],
    rejectedEvidence: traceState.evidenceRejected || [],
  });
}

function buildToolArtifactState(toolRecords = [], toolsUsed = []) {
  const evidence = [];
  const artifacts = [];
  const sideEffects = [];
  const seenToolPaths = new Set();
  const labelByName = new Map();
  for (const entry of Array.isArray(toolsUsed) ? toolsUsed : []) {
    const name = String(entry?.name || '').trim();
    const label = String(entry?.label || '').trim();
    if (name && label) labelByName.set(name, label);
  }

  for (const record of Array.isArray(toolRecords) ? toolRecords : []) {
    const name = String(record?.name || '').trim();
    if (!name) continue;
    const result = record?.result && typeof record.result === 'object' ? record.result : {};
    const data = result?.data && typeof result.data === 'object' ? result.data : {};
    const label = trimText(result.label || labelByName.get(name) || name, 140);
    const pathValue = trimText(data.path || '', 220);
    const urlValue = trimText(data.url || data.requestedUrl || '', 220);
    const queryValue = trimText(data.query || '', 160);
    const preview = trimText(data.textPreview || data.title || queryValue || pathValue || urlValue || label, 220);
    evidence.push({
      type: 'tool',
      source: 'verified-tool',
      label,
      text: preview,
      target: pathValue || urlValue || '',
    });
    if (pathValue && !seenToolPaths.has(pathValue.toLowerCase())) {
      seenToolPaths.add(pathValue.toLowerCase());
      artifacts.push({ type: 'project-path', value: pathValue });
    }
    if (urlValue) artifacts.push({ type: 'web-url', value: urlValue });
    if (result.ok && ['write_project_file', 'replace_in_project_file', 'insert_in_project_file'].includes(name) && pathValue) {
      sideEffects.push({ type: 'file-write', target: pathValue, status: 'verified' });
    }
    if (result.ok && name === 'run_node_check' && pathValue) {
      sideEffects.push({ type: 'syntax-check', target: pathValue, status: 'verified' });
    }
    if (result.ok && name === 'get_git_status') {
      sideEffects.push({ type: 'git-status-read', target: 'repo', status: 'verified' });
    }
  }

  return {
    evidence: evidence.map(normalizeEvidenceEntry).filter(Boolean),
    artifacts: artifacts.map(normalizeArtifactEntry).filter(Boolean),
    sideEffects: sideEffects.map(normalizeSideEffectEntry).filter(Boolean),
  };
}

function buildRetrievalArtifactState(retrieval = null, matchedBooks = []) {
  const evidence = [];
  const artifacts = [];
  const sourceItems = [];
  if (retrieval && typeof retrieval === 'object') {
    sourceItems.push(...(Array.isArray(retrieval.session) ? retrieval.session : []));
    sourceItems.push(...(Array.isArray(retrieval.global) ? retrieval.global : []));
  }
  for (const item of sourceItems.slice(0, 4)) {
    evidence.push({
      type: 'memory-hit',
      source: sourceLabelForRetrievalItem(item),
      label: trimText(item.sourceType || item.type || 'memory', 80),
      text: trimText(item.evidenceSnippet || item.text || item.excerpt || '', 220),
      target: trimText((item.matchedTokens || []).join(', '), 140),
    });
  }
  for (const book of Array.isArray(matchedBooks) ? matchedBooks.slice(0, 2) : []) {
    evidence.push({
      type: 'memory-hit',
      source: String(book.sourceLabel || book.source || 'book').trim(),
      label: trimText(book.id || 'book', 80),
      text: trimText(book.evidenceSnippet || book.text || '', 220),
      target: trimText((book.matchedPhrases || []).join(', '), 140),
    });
    artifacts.push({
      type: 'memory-book',
      value: trimText(book.id || book.text || '', 220),
    });
  }
  return {
    evidence: evidence.map(normalizeEvidenceEntry).filter(Boolean),
    artifacts: artifacts.map(normalizeArtifactEntry).filter(Boolean),
  };
}

function buildRuntimeTraceState({
  requestedMode = 'local',
  selectedLane = 'chat',
  backend = '',
  routePath = '/api/penny/chat',
  requestedModel = '',
  resolvedModel = '',
  executionPath = '',
  usedFallback = false,
  laneFallback = false,
  researchLedgerPromptInjected = false,
  researchLedgerUpdate = null,
  retrievalTrace = [],
  toolState = null,
  retrieval = null,
  archiveContext = null,
  researchLedgerContext = null,
} = {}) {
  const toolEvidence = Array.isArray(toolState?.evidence) ? toolState.evidence : [];
  const activeContradictions = Array.isArray(archiveContext?.activeContradictions)
    ? archiveContext.activeContradictions
    : (Array.isArray(retrieval?.provenance) ? retrieval.provenance : []);
  const openQuestions = Array.isArray(archiveContext?.openLoops) ? archiveContext.openLoops : [];
  const ongoingInvestigations = Array.isArray(researchLedgerContext?.topics) ? researchLedgerContext.topics : [];
  const sessionCount = Array.isArray(retrieval?.session) ? retrieval.session.length : 0;
  const injectedCount = retrievalTrace.filter((item) => item?.injected !== false).length;
  const rejectedCount = retrievalTrace.filter((item) => item?.injected === false).length;
  const channelCount = new Set(retrievalTrace.map((item) => String(item?.channel || '').trim()).filter(Boolean)).size;
  const evidenceAccepted = [
    {
      type: 'route',
      channel: 'runtime',
      label: `${requestedMode}/${selectedLane}`,
      detail: trimText(backend || routePath, 220),
      status: laneFallback ? 'fallback-selected' : 'selected',
    },
    ...toolEvidence.map((item) => ({
      type: 'tool',
      channel: String(item?.source || 'verified-tool').trim() || 'verified-tool',
      label: trimText(item?.label || item?.type || 'tool', 140),
      detail: trimText(item?.text || item?.target || '', 220),
      status: 'verified',
    })),
    ...retrievalTrace
      .filter((item) => item?.injected !== false)
      .map((item) => ({
        type: 'retrieval',
        channel: item.channel,
        label: trimText(item.sourceLabel || item.sourceId || item.channel, 140),
        detail: trimText(item.reason || item.sourceId || '', 220),
        status: item.contradictionState === 'tracked' ? 'correction-aware' : 'injected',
      })),
  ].map(normalizeTraceEvidenceEntry).filter(Boolean).slice(0, 8);
  const evidenceRejected = retrievalTrace
    .filter((item) => item?.injected === false)
    .map((item) => ({
      type: 'retrieval',
      channel: item.channel,
      label: trimText(item.sourceLabel || item.sourceId || item.channel, 140),
      detail: trimText(item.reason || 'held back from prompt context', 220),
      status: 'held-back',
    }))
    .map(normalizeTraceEvidenceEntry)
    .filter(Boolean)
    .slice(0, 8);
  return normalizeTraceState({
    laneChoice: {
      requestedMode,
      selectedLane,
      backend,
      route: routePath,
      requestedModel,
      resolvedModel,
      executionPath: normalizeExecutionPath(executionPath, requestedMode === 'shadow' ? 'shadow' : (selectedLane === 'tool' ? 'deterministic-tool' : 'llm-chat')),
      usedFallback,
      laneFallback,
      researchLedgerPromptInjected: researchLedgerPromptInjected === true,
      researchLedgerUpdateStatus: normalizeResearchLedgerUpdate(researchLedgerUpdate).status,
    },
    wakeHierarchy: [
      {
        layer: 'stable-facts',
        label: 'Explicit facts stay canonical',
        detail: 'Explicit memory remains Penny\'s authoritative truth source for this turn.',
        status: 'authoritative',
        count: 1,
      },
      {
        layer: 'active-session',
        label: 'Active session context',
        detail: sessionCount
          ? `${sessionCount} session recall hit(s) were available to support the reply.`
          : 'No session archive hits were selected for this turn.',
        status: sessionCount ? 'present' : 'empty',
        count: sessionCount,
      },
      {
        layer: 'contradictions',
        label: 'Contradictions / corrections',
        detail: activeContradictions.length
          ? `${activeContradictions.length} tracked contradiction(s) could override stale memory.`
          : 'No tracked contradictions were active for this turn.',
        status: activeContradictions.length ? 'active' : 'clear',
        count: activeContradictions.length,
      },
      {
        layer: 'open-questions',
        label: 'Open questions / loops',
        detail: openQuestions.length
          ? `${openQuestions.length} open loop(s) stayed live for continuity.`
          : 'No open loops were active for this turn.',
        status: openQuestions.length ? 'open' : 'clear',
        count: openQuestions.length,
      },
      {
        layer: 'ongoing-investigations',
        label: 'Ongoing investigations',
        detail: ongoingInvestigations.length
          ? `${ongoingInvestigations.length} research continuity topic(s) were available as advisory wake context.`
          : 'No ongoing investigation topics were active for this turn.',
        status: ongoingInvestigations.length ? 'present' : 'clear',
        count: ongoingInvestigations.length,
      },
      {
        layer: 'advisory-retrieval',
        label: 'Advisory retrieval hints',
        detail: retrievalTrace.length
          ? `${injectedCount} injected / ${rejectedCount} held back across ${channelCount} retrieval channel(s).`
          : 'No retrieval channels were recorded for this turn.',
        status: retrievalTrace.length ? 'present' : 'empty',
        count: retrievalTrace.length,
      },
    ],
    retrievalChannels: retrievalTrace,
    contradictions: activeContradictions.map((item) => ({
      layer: 'contradiction',
      label: trimText(item?.conflictKey || 'correction', 140),
      detail: trimText(item?.newText || item?.oldText || '', 220),
      status: 'active',
      count: 1,
    })),
    openQuestions: openQuestions.map((item) => ({
      layer: 'open-question',
      label: trimText(item?.status || 'open', 140),
      detail: trimText(item?.text || '', 220),
      status: String(item?.status || 'open').trim() || 'open',
      count: 1,
    })),
    ongoingInvestigations: ongoingInvestigations.map((item) => ({
      layer: 'research-ledger',
      label: trimText(item?.topicLabel || item?.topicId || 'investigation', 140),
      detail: trimText(item?.summary || item?.conclusion || item?.question || '', 220),
      status: String(item?.status || 'advisory').trim() || 'advisory',
      count: Array.isArray(item?.openFollowUps) ? item.openFollowUps.length : 0,
    })),
    evidenceAccepted,
    evidenceRejected,
  });
}

function buildRuntimeArtifact({
  sessionId = 'default',
  requestedMode = 'local',
  selectedLane = 'chat',
  reason = '',
  backend = '',
  executionPath = '',
  usedFallback = false,
  laneFallback = false,
  requestedModel = '',
  resolvedModel = '',
  semanticMemoryReady = false,
  semanticMemoryMode = 'disabled',
  toolsUsed = [],
  toolRecords = [],
  retrieval = null,
  archiveContext = null,
  researchLedgerContext = null,
  matchedBooks = [],
  cleanup = null,
  cleanupTransform = null,
  canonicalFactsPresent = false,
  canonicalOverrideActive = false,
  repair = null,
  shadowEnabled = false,
  shadowError = '',
  mood = '',
  routePath = '/api/penny/chat',
  usedAt = '',
  archiveEligible = false,
  epistemics = null,
  synthesis = null,
  performance = null,
  readiness = null,
  promptComposition = null,
  latencyBudget = null,
  researchLedgerPromptInjected = false,
  researchLedgerUpdate = null,
} = {}) {
  const safeUsedAt = trimIso(usedAt, new Date().toISOString());
  const normalizedExecutionPath = normalizeExecutionPath(
    executionPath,
    requestedMode === 'shadow'
      ? 'shadow'
      : (selectedLane === 'tool' ? 'deterministic-tool' : 'llm-chat'),
  );
  const normalizedLedgerUpdate = normalizeResearchLedgerUpdate(researchLedgerUpdate);
  const normalizedCleanup = normalizeCleanupInfo(cleanup);
  const normalizedCleanupTransform = normalizeCleanupTransformInfo(
    cleanupTransform || cleanup?.cleanupTransform || deriveCleanupTransformInfoFromCleanup(cleanup),
  );
  const normalizedRepair = normalizeRepairInfo(repair);
  const normalizedEpistemics = normalizeEpistemicCaution(epistemics);
  const normalizedSynthesis = normalizeArchiveSynthesis(synthesis);
  const toolState = buildToolArtifactState(toolRecords, toolsUsed);
  const retrievalState = buildRetrievalArtifactState(retrieval, matchedBooks);
  const retrievalTrace = buildRetrievalTraceState(
    retrieval,
    matchedBooks,
    researchLedgerContext,
    researchLedgerPromptInjected === true,
  );
  const authorityPressure = buildAuthorityPressure({
    sessionId,
    retrievalTrace,
    canonicalFactsPresent,
    canonicalOverrideActive,
  });
  const approximatePath = buildApproximatePath({
    latencyBudget,
    retrieval,
    readiness,
    usedFallback,
    laneFallback,
  });
  const advisoryMerge = buildAdvisoryMergeSummary({
    sessionId,
    retrievalTrace,
  });
  const reasonCodes = uniqueStrings([
    reason,
    retrieval?.reasonCode,
    retrieval?.compression?.reasonCode,
    ...(normalizedRepair?.firstPassGuardCodes || []),
  ], 12);
  const kind = selectedLane === 'tool'
    ? 'tool-turn'
    : requestedMode === 'shadow'
      ? 'shadow-turn'
      : 'chat-turn';
  const authorityReply = toolState.evidence.length
    ? 'verified-tool-evidence'
    : requestedMode === 'shadow'
      ? 'shadow-runtime'
      : 'model-advisory';
  const evidence = [
    {
      type: 'route',
      source: 'runtime',
      label: trimText(reason || 'runtime-route', 80),
      text: trimText(backend || `${requestedMode}:${selectedLane}`, 180),
      target: trimText(routePath, 140),
    },
    ...toolState.evidence,
    ...retrievalState.evidence,
  ].map(normalizeEvidenceEntry).filter(Boolean).slice(0, 12);
  const sideEffects = [
    { type: 'memory-persist', target: 'lastRoute', status: 'verified' },
    ...(archiveEligible ? [{ type: 'archive-schedule', target: 'archive-session', status: 'queued' }] : []),
    ...(normalizedLedgerUpdate.status !== 'skipped'
      ? [{
          type: 'research-ledger-update',
          target: normalizedLedgerUpdate.topicLabel || normalizedLedgerUpdate.topicId || 'research-ledger',
          status: normalizedLedgerUpdate.status,
        }]
      : []),
    ...(normalizedRepair?.repairAttempted
      ? [{
          type: 'reply-repair',
          target: normalizedRepair.finalCandidateSource || 'first-pass',
          status: normalizedRepair.repairAccepted ? 'accepted' : 'rejected',
        }]
      : []),
    ...toolState.sideEffects,
  ].map(normalizeSideEffectEntry).filter(Boolean).slice(0, 10);
  const artifacts = [
    ...toolState.artifacts,
    ...retrievalState.artifacts,
  ].map(normalizeArtifactEntry).filter(Boolean).slice(0, 10);
  const trace = buildRuntimeTraceState({
    requestedMode,
    selectedLane,
    backend,
    routePath,
    requestedModel,
    resolvedModel,
    executionPath: normalizedExecutionPath,
    usedFallback,
    laneFallback,
    researchLedgerPromptInjected,
    researchLedgerUpdate: normalizedLedgerUpdate,
    retrievalTrace,
    toolState,
    retrieval,
    archiveContext,
    researchLedgerContext,
  });
  const provenance = buildArtifactProvenance({
    retrievalTrace,
    trace,
  });

  return normalizeRuntimeArtifact({
    version: RUNTIME_ARTIFACT_VERSION,
    kind,
    executionPath: normalizedExecutionPath,
    researchLedgerPromptInjected: researchLedgerPromptInjected === true,
    researchLedgerUpdate: normalizedLedgerUpdate,
    scope: {
      sessionId,
      route: routePath,
      requestedMode,
      selectedLane,
    },
    authority: {
      reply: authorityReply,
      memory: 'explicit-canonical',
      archive: 'advisory',
      toolClaims: selectedLane === 'tool' ? 'verified-required' : 'n/a',
    },
    summary: {
      label: kind,
      text: toolState.evidence.length
        ? `Tool lane reply with ${toolState.evidence.length} verified evidence item${toolState.evidence.length === 1 ? '' : 's'}.`
        : requestedMode === 'shadow'
          ? 'Shadow lane reply with additive archive context.'
          : 'Chat lane reply with additive archive context.',
      backend,
    },
    context: {
      backend,
      requestedModel,
      resolvedModel,
      executionPath: normalizedExecutionPath,
      semanticMemoryReady,
      semanticMemoryMode,
      usedFallback,
      laneFallback,
      shadowEnabled,
    },
    evidence,
    artifacts,
    retrievalTrace,
    trace,
    provenance,
    sideEffects,
    reasonCodes,
    epistemics: normalizedEpistemics,
    synthesis: normalizedSynthesis,
    performance,
    readiness,
    modelAdvisory: {
      mood: String(mood || '').trim(),
      cleanup: normalizedCleanup,
      cleanupTransform: normalizedCleanupTransform,
      authorityPressure,
      promptComposition: normalizePromptComposition(promptComposition),
      approximatePath,
      advisoryMerge,
      repair: normalizedRepair,
      shadowError: String(shadowError || '').trim(),
      toolsUsed: Array.isArray(toolsUsed)
        ? toolsUsed.map((item) => ({
            name: String(item?.name || '').trim(),
            label: trimText(item?.label || '', 140),
            ok: item?.ok === true,
          })).slice(0, 8)
        : [],
    },
    timestamps: {
      usedAt: safeUsedAt,
      archivedAt: trimIso(retrieval?.usedAt, ''),
      persistedAt: safeUsedAt,
    },
  });
}

function normalizeRuntimeArtifact(value = {}, defaults = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const scopeRaw = { ...(fallback.scope || {}), ...(raw.scope || {}) };
  const authorityRaw = { ...(fallback.authority || {}), ...(raw.authority || {}) };
  const summaryRaw = { ...(fallback.summary || {}), ...(raw.summary || {}) };
  const contextRaw = { ...(fallback.context || {}), ...(raw.context || {}) };
  const advisoryRaw = { ...(fallback.modelAdvisory || {}), ...(raw.modelAdvisory || {}) };
  const timestampsRaw = { ...(fallback.timestamps || {}), ...(raw.timestamps || {}) };
  const performance = normalizePerformance(raw.performance, fallback.performance);
  const readiness = normalizeReadiness(raw.readiness, fallback.readiness);
  const version = String(raw.version || fallback.version || RUNTIME_ARTIFACT_VERSION).trim() || RUNTIME_ARTIFACT_VERSION;
  const kind = String(raw.kind || fallback.kind || 'chat-turn').trim() || 'chat-turn';
  const executionPath = normalizeExecutionPath(
    raw.executionPath || fallback.executionPath,
    kind === 'shadow-turn' ? 'shadow' : (kind === 'tool-turn' ? 'deterministic-tool' : 'llm-chat'),
  );
  const researchLedgerPromptInjected = raw.researchLedgerPromptInjected === true || fallback.researchLedgerPromptInjected === true;
  const researchLedgerUpdate = normalizeResearchLedgerUpdate(raw.researchLedgerUpdate, fallback.researchLedgerUpdate);
  const epistemics = normalizeEpistemicCaution(raw.epistemics || fallback.epistemics);
  const synthesis = normalizeArchiveSynthesis(raw.synthesis || fallback.synthesis);
  return {
    version,
    kind,
    executionPath,
    researchLedgerPromptInjected,
    researchLedgerUpdate,
    scope: {
      sessionId: String(scopeRaw.sessionId || '').trim() || 'default',
      route: String(scopeRaw.route || '').trim() || '/api/penny/chat',
      requestedMode: String(scopeRaw.requestedMode || '').trim() || 'local',
      selectedLane: String(scopeRaw.selectedLane || '').trim() || 'chat',
    },
    authority: {
      reply: String(authorityRaw.reply || '').trim() || 'model-advisory',
      memory: String(authorityRaw.memory || '').trim() || 'explicit-canonical',
      archive: String(authorityRaw.archive || '').trim() || 'advisory',
      toolClaims: String(authorityRaw.toolClaims || '').trim() || 'n/a',
    },
    summary: {
      label: String(summaryRaw.label || '').trim() || kind,
      text: trimText(summaryRaw.text || '', 220),
      backend: String(summaryRaw.backend || '').trim() || String(contextRaw.backend || '').trim(),
    },
    context: {
      backend: String(contextRaw.backend || '').trim(),
      requestedModel: String(contextRaw.requestedModel || '').trim(),
      resolvedModel: String(contextRaw.resolvedModel || '').trim(),
      executionPath,
      semanticMemoryReady: contextRaw.semanticMemoryReady === true,
      semanticMemoryMode: String(contextRaw.semanticMemoryMode || '').trim() || 'disabled',
      usedFallback: contextRaw.usedFallback === true,
      laneFallback: contextRaw.laneFallback === true,
      shadowEnabled: contextRaw.shadowEnabled === true,
    },
    evidence: (Array.isArray(raw.evidence) ? raw.evidence : fallback.evidence || [])
      .map(normalizeEvidenceEntry)
      .filter(Boolean)
      .slice(0, 12),
    artifacts: (Array.isArray(raw.artifacts) ? raw.artifacts : fallback.artifacts || [])
      .map(normalizeArtifactEntry)
      .filter(Boolean)
      .slice(0, 10),
    retrievalTrace: (Array.isArray(raw.retrievalTrace) ? raw.retrievalTrace : fallback.retrievalTrace || [])
      .map(normalizeRetrievalTraceEntry)
      .filter(Boolean)
      .slice(0, 12),
    trace: normalizeTraceState(raw.trace || fallback.trace, fallback.trace),
    provenance: normalizeArtifactProvenance(raw.provenance || fallback.provenance, fallback.provenance),
    sideEffects: (Array.isArray(raw.sideEffects) ? raw.sideEffects : fallback.sideEffects || [])
      .map(normalizeSideEffectEntry)
      .filter(Boolean)
      .slice(0, 10),
    reasonCodes: uniqueStrings(Array.isArray(raw.reasonCodes) ? raw.reasonCodes : fallback.reasonCodes || [], 12),
    epistemics,
    synthesis,
    performance,
    readiness,
    modelAdvisory: {
      mood: String(advisoryRaw.mood || '').trim(),
      cleanup: normalizeCleanupInfo(advisoryRaw.cleanup, fallback.modelAdvisory?.cleanup),
      cleanupTransform: normalizeCleanupTransformInfo(advisoryRaw.cleanupTransform, fallback.modelAdvisory?.cleanupTransform),
      authorityPressure: normalizeAuthorityPressure(advisoryRaw.authorityPressure, fallback.modelAdvisory?.authorityPressure),
      promptComposition: normalizePromptComposition(advisoryRaw.promptComposition, fallback.modelAdvisory?.promptComposition),
      approximatePath: normalizeApproximatePath(advisoryRaw.approximatePath, fallback.modelAdvisory?.approximatePath),
      advisoryMerge: normalizeAdvisoryMergeSummary(advisoryRaw.advisoryMerge, fallback.modelAdvisory?.advisoryMerge),
      repair: normalizeRepairInfo(advisoryRaw.repair),
      shadowError: String(advisoryRaw.shadowError || '').trim(),
      toolsUsed: Array.isArray(advisoryRaw.toolsUsed)
        ? advisoryRaw.toolsUsed.map((item) => ({
            name: String(item?.name || '').trim(),
            label: trimText(item?.label || '', 140),
            ok: item?.ok === true,
          })).slice(0, 8)
        : [],
    },
    timestamps: {
      usedAt: trimIso(timestampsRaw.usedAt, new Date().toISOString()),
      archivedAt: trimIso(timestampsRaw.archivedAt, ''),
      persistedAt: trimIso(timestampsRaw.persistedAt, trimIso(timestampsRaw.usedAt, new Date().toISOString())),
    },
  };
}

function normalizeLastRouteInfo(value) {
  if (!value || typeof value !== 'object') return null;
  const selectedLane = String(value.selectedLane || value.localLane || '').trim() || 'chat';
  const requestedMode = String(value.requestedMode || '').trim() || 'local';
  const backend = String(value.backend || '').trim();
  const executionPath = normalizeExecutionPath(
    value.executionPath,
    requestedMode === 'shadow' ? 'shadow' : (selectedLane === 'tool' ? 'deterministic-tool' : 'llm-chat'),
  );
  const researchLedgerPromptInjected = value.researchLedgerPromptInjected === true;
  const researchLedgerUpdate = normalizeResearchLedgerUpdate(value.researchLedgerUpdate);
  const repair = normalizeRepairInfo(value.repair);
  const epistemics = normalizeEpistemicCaution(value.epistemics);
  const synthesis = normalizeArchiveSynthesis(value.synthesis);
  const performance = normalizePerformance(value.performance);
  const readiness = normalizeReadiness(value.readiness);
  const artifact = normalizeRuntimeArtifact(
    value.artifact,
    buildRuntimeArtifact({
      sessionId: value.sessionId || 'default',
      requestedMode,
      selectedLane,
      reason: String(value.reason || '').trim(),
      backend,
      executionPath,
      usedFallback: value.usedFallback === true,
      laneFallback: value.laneFallback === true,
      requestedModel: String(value.requestedModel || '').trim(),
      resolvedModel: String(value.resolvedModel || '').trim(),
      semanticMemoryReady: value.semanticMemoryReady === true,
      semanticMemoryMode: String(value.semanticMemoryMode || '').trim() || 'disabled',
      researchLedgerContext: value.researchLedgerContext || null,
      cleanup: value.cleanup || null,
      cleanupTransform: value.cleanupTransform || null,
      canonicalFactsPresent: value.canonicalFactsPresent === true,
      canonicalOverrideActive: value.canonicalOverrideActive === true,
      repair,
      epistemics,
      synthesis,
      performance,
      readiness,
      promptComposition: value.promptComposition || null,
      latencyBudget: value.latencyBudget || null,
      researchLedgerPromptInjected,
      researchLedgerUpdate,
      usedAt: String(value.usedAt || '').trim() || new Date().toISOString(),
    }),
  );
  return {
    selectedLane,
    requestedMode,
    reason: String(value.reason || '').trim(),
    backend,
    executionPath,
    usedFallback: value.usedFallback === true,
    laneFallback: value.laneFallback === true,
    requestedModel: String(value.requestedModel || '').trim(),
    resolvedModel: String(value.resolvedModel || '').trim(),
    semanticMemoryReady: value.semanticMemoryReady === true,
    semanticMemoryMode: String(value.semanticMemoryMode || '').trim() || 'disabled',
    repair,
    epistemics,
    synthesis,
    performance,
    readiness,
    researchLedgerPromptInjected,
    researchLedgerUpdate,
    artifact,
    usedAt: trimIso(value.usedAt, new Date().toISOString()),
  };
}

function buildLastRouteInfo({
  sessionId = 'default',
  selectedLane = 'chat',
  requestedMode = 'local',
  reason = '',
  backend = '',
  executionPath = '',
  usedFallback = false,
  laneFallback = false,
  requestedModel = '',
  resolvedModel = '',
  semanticMemoryReady = false,
  semanticMemoryMode = 'disabled',
  toolsUsed = [],
  toolRecords = [],
  retrieval = null,
  archiveContext = null,
  researchLedgerContext = null,
  matchedBooks = [],
  cleanup = null,
  cleanupTransform = null,
  canonicalFactsPresent = false,
  canonicalOverrideActive = false,
  repair = null,
  shadowEnabled = false,
  shadowError = '',
  mood = '',
  routePath = '/api/penny/chat',
  usedAt = new Date().toISOString(),
  archiveEligible = false,
  artifact = null,
  epistemics = null,
  synthesis = null,
  performance = null,
  readiness = null,
  promptComposition = null,
  latencyBudget = null,
  researchLedgerPromptInjected = false,
  researchLedgerUpdate = null,
} = {}) {
  return normalizeLastRouteInfo({
    sessionId,
    selectedLane,
    requestedMode,
    reason,
    backend,
    executionPath,
    usedFallback,
    laneFallback,
    requestedModel,
    resolvedModel,
    semanticMemoryReady,
    semanticMemoryMode,
    toolsUsed,
    toolRecords,
    retrieval,
    matchedBooks,
    cleanup,
    cleanupTransform,
    canonicalFactsPresent,
    canonicalOverrideActive,
    repair,
    shadowEnabled,
    shadowError,
    mood,
    routePath,
    usedAt,
    archiveEligible,
    epistemics,
    synthesis,
    performance,
    readiness,
    promptComposition,
    latencyBudget,
    researchLedgerPromptInjected,
    researchLedgerUpdate,
    artifact: artifact || buildRuntimeArtifact({
      sessionId,
      requestedMode,
      selectedLane,
      reason,
      backend,
      executionPath,
      usedFallback,
      laneFallback,
      requestedModel,
      resolvedModel,
      semanticMemoryReady,
      semanticMemoryMode,
      toolsUsed,
      toolRecords,
      retrieval,
      archiveContext,
      researchLedgerContext,
      matchedBooks,
      cleanup,
      cleanupTransform,
      canonicalFactsPresent,
      canonicalOverrideActive,
      repair,
      shadowEnabled,
      shadowError,
      mood,
      routePath,
      usedAt,
      archiveEligible,
      epistemics,
      synthesis,
      performance,
      readiness,
      promptComposition,
      latencyBudget,
      researchLedgerPromptInjected,
      researchLedgerUpdate,
    }),
  });
}

function buildCombinedMemoryInspector({
  sessionId = 'default',
  explicitMemory = {},
  inspector = {},
  ledger = {},
  books = {},
  lmStudio = {},
  shadowEnabled = false,
} = {}) {
  const matchedBooks = Array.isArray(inspector?.archive?.session?.lastRetrieval?.books)
    ? inspector.archive.session.lastRetrieval.books
    : [];
  const compression = inspector?.archive?.session?.lastRetrieval?.compression || { used: false, reason: '', chapters: [] };
  const inspectorArchiveContext = {
    session: inspector?.archive?.session?.lastRetrieval?.session || [],
    global: inspector?.archive?.session?.lastRetrieval?.global || [],
    activeContradictions: inspector?.archive?.session?.activeContradictions || [],
    openLoops: inspector?.archive?.session?.openLoops || [],
    compression: inspector?.archive?.session?.lastRetrieval?.compression || null,
  };
  const routingBase = explicitMemory?.lastRoute || {
    sessionId,
    selectedLane: explicitMemory?.brainMode === 'shadow' ? 'shadow' : 'chat',
    requestedMode: explicitMemory?.brainMode === 'shadow' ? 'shadow' : 'local',
    reason: '',
    backend: '',
    executionPath: explicitMemory?.brainMode === 'shadow' ? 'shadow' : 'llm-chat',
    usedFallback: false,
    laneFallback: false,
    requestedModel: '',
    resolvedModel: '',
    semanticMemoryReady: inspector?.embeddings?.semanticMemory?.ready === true,
    semanticMemoryMode: inspector?.embeddings?.semanticMemory?.mode || 'disabled',
    usedAt: '',
  };
  const routing = normalizeLastRouteInfo({
    ...routingBase,
    sessionId,
    semanticMemoryReady: routingBase.semanticMemoryReady === true || inspector?.embeddings?.semanticMemory?.ready === true,
    semanticMemoryMode: String(routingBase.semanticMemoryMode || inspector?.embeddings?.semanticMemory?.mode || 'disabled').trim() || 'disabled',
    artifact: routingBase?.artifact || buildRuntimeArtifact({
      sessionId,
      requestedMode: routingBase.requestedMode,
      selectedLane: routingBase.selectedLane,
      reason: routingBase.reason,
      backend: routingBase.backend,
      executionPath: routingBase.executionPath,
      usedFallback: routingBase.usedFallback === true,
      laneFallback: routingBase.laneFallback === true,
      requestedModel: routingBase.requestedModel,
      resolvedModel: routingBase.resolvedModel,
      semanticMemoryReady: routingBase.semanticMemoryReady === true || inspector?.embeddings?.semanticMemory?.ready === true,
      semanticMemoryMode: routingBase.semanticMemoryMode || inspector?.embeddings?.semanticMemory?.mode || 'disabled',
      retrieval: inspector?.archive?.session?.lastRetrieval || null,
      archiveContext: inspectorArchiveContext,
      researchLedgerContext: ledger?.context || null,
      matchedBooks,
      repair: routingBase.repair,
      epistemics: routingBase.epistemics,
      synthesis: routingBase.synthesis,
      researchLedgerPromptInjected: routingBase.researchLedgerPromptInjected === true,
      researchLedgerUpdate: routingBase.researchLedgerUpdate || null,
      shadowEnabled,
      usedAt: routingBase.usedAt,
      routePath: '/api/penny/memory/inspector',
    }),
  });
  const artifact = normalizeRuntimeArtifact(routing.artifact, buildRuntimeArtifact({
    sessionId,
    requestedMode: routing.requestedMode,
    selectedLane: routing.selectedLane,
    reason: routing.reason,
    backend: routing.backend,
    executionPath: routing.executionPath,
    usedFallback: routing.usedFallback === true,
    laneFallback: routing.laneFallback === true,
    requestedModel: routing.requestedModel,
    resolvedModel: routing.resolvedModel,
    semanticMemoryReady: routing.semanticMemoryReady === true,
    semanticMemoryMode: routing.semanticMemoryMode,
    retrieval: inspector?.archive?.session?.lastRetrieval || null,
    archiveContext: inspectorArchiveContext,
    researchLedgerContext: ledger?.context || null,
    matchedBooks,
    repair: routing.repair,
    epistemics: routing.epistemics,
    synthesis: routing.synthesis,
    researchLedgerPromptInjected: routing.researchLedgerPromptInjected === true,
    researchLedgerUpdate: routing.researchLedgerUpdate || null,
    shadowEnabled,
    usedAt: routing.usedAt,
    routePath: '/api/penny/memory/inspector',
  }));
  const runtime = {
    readiness: buildRuntimeReadiness({
      lmStudio,
      semanticMemory: inspector?.embeddings?.semanticMemory || {},
    }),
    performance: buildRuntimeStatusPerformance({
      lmStudio,
      semanticMemory: inspector?.embeddings?.semanticMemory || {},
    }),
  };

  return {
    ...inspector,
    ledger,
    memoryBooks: {
      ...books,
      matchedBooks,
    },
    compression,
    routing: {
      ...routing,
      artifact,
      chatPreferredModel: lmStudio.chatPreferredModel || null,
      toolPreferredModel: lmStudio.toolPreferredModel || null,
      resolvedChatModel: lmStudio.resolvedChatModel || lmStudio.resolvedModel || null,
      resolvedToolModel: lmStudio.resolvedToolModel || null,
      routingMode: lmStudio.routingMode || 'auto',
      shadowEnabled,
    },
    artifact,
    runtime,
  };
}

module.exports = {
  RUNTIME_ARTIFACT_VERSION,
  normalizeRepairInfo,
  normalizePerformance,
  normalizeReadiness,
  buildRuntimeReadiness,
  buildRuntimeStatusPerformance,
  normalizeRuntimeArtifact,
  normalizeLastRouteInfo,
  buildRuntimeArtifact,
  buildLastRouteInfo,
  buildCombinedMemoryInspector,
};
