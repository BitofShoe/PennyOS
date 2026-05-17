/**
 * @typedef {Object} ChatResponseMeta
 * @property {string} mood
 * @property {number} turns
 * @property {string} backend
 * @property {boolean} durableMemory
 * @property {'local' | 'shadow'} requestedMode
 * @property {boolean} usedFallback
 * @property {boolean} shadowEnabled
 * @property {string} [localLane]
 * @property {string} [requestedModel]
 * @property {string} [resolvedModel]
 * @property {string} [executionPath]
 * @property {boolean} [laneFallback]
 * @property {boolean} [semanticMemoryReady]
 * @property {string} [semanticMemoryMode]
 * @property {boolean} [researchLedgerRendered] Canonical field; true only when research-ledger context actually rendered into prompt context.
 * @property {boolean} [researchLedgerPromptInjected] Compatibility alias; true only when research-ledger context actually rendered into prompt context.
 * @property {Object|null} [researchLedgerUpdate]
 * @property {Object|null} [promptTruth]
 * @property {Array<Object>} [toolsUsed]
 * @property {Object|null} [toolOutcome]
 * @property {Object|null} [repair]
 * @property {Object} [artifact]
 * @property {Object} [performance]
 * @property {Object} [readiness]
 * @property {string} [shadowError]
 */

const {
  normalizePerformance,
  normalizeReadiness,
  buildRuntimeReadiness,
  buildRuntimeStatusPerformance,
} = require('./penny-runtime-artifacts');
const {
  deriveResearchLedgerRendered,
  preferRenderedCompatibilityBoolean,
  projectAuditRetrievalFromPromptTruth,
} = require('./penny-prompttruth');

function isoNow(ms = Date.now()) {
  return new Date(ms).toISOString();
}

function createPerformanceTracker(latencyClass = 'casual-companion') {
  const startedAt = isoNow();
  return {
    latencyClass,
    request: {
      startedAt,
      available: true,
      source: 'chat-route',
      note: 'Penny chat route accepted the request.',
    },
    promptAssembly: {},
    archiveRetrieval: {},
    semanticRender: {
      attempted: false,
      used: false,
    },
    modelResolution: {},
    semanticProbe: {},
    firstToken: {
      available: false,
    },
    modelRoundTrip: {},
  };
}

function recordPerformanceStage(tracker = {}, key = 'request', patch = {}) {
  tracker[key] = {
    ...(tracker[key] && typeof tracker[key] === 'object' ? tracker[key] : {}),
    ...(patch && typeof patch === 'object' ? patch : {}),
  };
  return tracker;
}

function recordMeasuredStage(tracker = {}, key = 'request', startedMs = Date.now(), patch = {}) {
  const finishedMs = Date.now();
  return recordPerformanceStage(tracker, key, {
    startedAt: isoNow(startedMs),
    finishedAt: isoNow(finishedMs),
    durationMs: Math.max(0, finishedMs - startedMs),
    available: true,
    ...(patch && typeof patch === 'object' ? patch : {}),
  });
}

function finalizePerformanceTracker(tracker = {}) {
  const request = tracker.request && typeof tracker.request === 'object' ? tracker.request : {};
  if (!request.finishedAt) {
    recordMeasuredStage(tracker, 'request', Date.parse(request.startedAt || isoNow()) || Date.now(), {
      source: request.source || 'chat-route',
      note: request.note || 'Penny chat route completed.',
    });
  }
  return normalizePerformance(tracker);
}

function mergePerformanceTracker(tracker = {}, extra = null) {
  if (!extra || typeof extra !== 'object') return tracker;
  if (extra.latencyClass) tracker.latencyClass = extra.latencyClass;
  for (const key of ['request', 'promptAssembly', 'archiveRetrieval', 'semanticRender', 'modelResolution', 'semanticProbe', 'firstToken', 'modelRoundTrip']) {
    if (!extra[key] || typeof extra[key] !== 'object') continue;
    tracker[key] = {
      ...(tracker[key] && typeof tracker[key] === 'object' ? tracker[key] : {}),
      ...extra[key],
    };
  }
  return tracker;
}

function bindClientDisconnectAbort(req, res, controller) {
  if (!controller || typeof controller.abort !== 'function') {
    return {
      isClosed: () => false,
      cleanup: () => {},
    };
  }

  let clientClosed = false;
  const markClosed = () => {
    clientClosed = true;
    try {
      controller.abort();
    } catch {}
  };

  req?.on?.('aborted', markClosed);
  req?.on?.('close', markClosed);
  res?.on?.('close', markClosed);

  return {
    isClosed: () => clientClosed,
    cleanup: () => {
      req?.removeListener?.('aborted', markClosed);
      req?.removeListener?.('close', markClosed);
      res?.removeListener?.('close', markClosed);
    },
  };
}

function buildTurnReadiness({
  requestedMode = 'local',
  selectedLane = 'chat',
  resolvedModel = '',
  semanticMemoryReady = false,
  semanticMemoryMode = 'disabled',
  usedFallback = false,
  modelUsed = true,
} = {}) {
  const normalizedModelUsage = modelUsed === false ? 'not-used' : 'used';
  const hasResolvedModel = !!String(resolvedModel || '').trim();
  if (requestedMode === 'shadow') {
    return normalizeReadiness({
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: semanticMemoryReady === true,
      fallbackActive: usedFallback === true,
      modelUsage: 'used',
      warmState: usedFallback === true ? 'degraded' : 'warm',
      checkedAt: isoNow(),
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    });
  }
  if (modelUsed === false) {
    return normalizeReadiness({
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: semanticMemoryReady === true,
      fallbackActive: usedFallback === true,
      modelUsage: normalizedModelUsage,
      warmState: usedFallback === true ? 'degraded' : 'warm',
      checkedAt: isoNow(),
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    });
  }
  const chatModelReady = selectedLane === 'tool' ? true : hasResolvedModel;
  const toolModelReady = selectedLane === 'chat' ? true : hasResolvedModel;
  const fallbackActive = usedFallback === true;
  const warmState = hasResolvedModel && !fallbackActive ? 'warm' : 'degraded';
  return normalizeReadiness({
    chatModelReady,
    toolModelReady,
    embeddingReady: semanticMemoryReady === true,
    fallbackActive,
    modelUsage: normalizedModelUsage,
    warmState,
    checkedAt: isoNow(),
    cacheAgeMs: 0,
    cacheExpiresAt: '',
    cacheHit: false,
  });
}

function createPennyRouteHandlers(deps = {}) {
  const {
    sendJson,
    safeReadBody,
    buildCombinedMemoryInspector,
    getStoredMemory,
    saveStoredMemory,
    mergeMemoryItems,
    mergeMemoryState,
    reviewPromotion,
    purgeArchiveMemory,
    purgeResearchLedger,
    buildChatMemoryState,
    sanitizeChatMessages,
    sanitizeImageDataUrl,
    sanitizeFileAttachment,
    appendAttachmentContext,
    buildRuntimeMemoryContext,
    scheduleResearchLedgerUpdate,
    selectLocalLane,
    runLmStudioLocalSmart,
    streamLmStudioLocalSmart,
    buildPennyReply,
    scheduleArchiveConsolidation,
    buildLastRouteInfo,
    runOpenClawShadow,
    retagAssistantReply,
    extractReplyMoodTag,
    pickMood,
    stripReplyMoodTags,
    beginEventStream,
    sendEventStream,
    startEventStreamKeepAlive,
    describeLocalBrainFailure,
    getLmStudioConnectionStatus,
    getSemanticMemoryStatus,
    getStaticEmbeddingStatus = null,
    setRuntimePreferredChatModel,
    getRuntimePreferredChatModel,
    listPendingWorkspaceWrites = null,
    approvePendingWorkspaceWrite = null,
    denyPendingWorkspaceWrite = null,
    sessionState,
    constants,
  } = deps;

  const {
    OPENCLAW_ENABLED,
    OPENCLAW_TIMEOUT_MS,
    PENNY_LMSTUDIO_EMBED_MODEL,
    LMSTUDIO_BASE,
    LMSTUDIO_NATIVE_BASE,
    LMSTUDIO_MODEL,
    LOCAL_LLM_TRANSPORT,
    RESPONSES_THEN_CHAT_FALLBACK,
    LMSTUDIO_MAX_OUTPUT_TOKENS,
    MEMORY_FILE,
    MEMORY_ARCHIVE_FILE,
    MEMORY_EMBEDDINGS_FILE,
    WEB_SEARCH_ENABLED,
  } = constants || {};

  async function parseJsonBody(req) {
    const rawBody = await safeReadBody(req);
    return rawBody ? JSON.parse(rawBody) : {};
  }

  function buildResponseMeta({
    mood,
    turns,
    backend,
    requestedMode,
    usedFallback = false,
    localLane = '',
    requestedModel = '',
    resolvedModel = '',
    executionPath = '',
    laneFallback = false,
    semanticMemoryReady = false,
    semanticMemoryMode = 'disabled',
    researchLedgerRendered = false,
    researchLedgerPromptInjected = false,
    researchLedgerUpdate = null,
    toolsUsed = [],
    toolOutcome = null,
    repair = null,
    artifact = null,
    performance = null,
    readiness = null,
    promptTruth = null,
    shadowError = '',
  }) {
    const researchLedgerRenderedFallback = preferRenderedCompatibilityBoolean(
      researchLedgerRendered,
      researchLedgerPromptInjected,
      preferRenderedCompatibilityBoolean(
        artifact?.researchLedgerRendered,
        artifact?.researchLedgerPromptInjected,
        false,
      ),
    );
    const effectiveResearchLedgerRendered = deriveResearchLedgerRendered(
      promptTruth || artifact?.promptTruth || artifact?.modelAdvisory?.promptTruth || null,
      researchLedgerRenderedFallback,
    );
    /** @type {ChatResponseMeta} */
    const meta = {
      mood,
      turns,
      backend,
      durableMemory: true,
      requestedMode,
      usedFallback,
      shadowEnabled: OPENCLAW_ENABLED === true,
      localLane,
      requestedModel,
      resolvedModel,
      executionPath,
      laneFallback,
      semanticMemoryReady,
      semanticMemoryMode,
      researchLedgerRendered: effectiveResearchLedgerRendered,
      researchLedgerPromptInjected: effectiveResearchLedgerRendered,
      researchLedgerUpdate,
      promptTruth,
      toolsUsed,
      toolOutcome,
    };
    if (repair && typeof repair === 'object') meta.repair = repair;
    if (artifact && typeof artifact === 'object') meta.artifact = artifact;
    if (performance && typeof performance === 'object') meta.performance = normalizePerformance(performance);
    if (readiness && typeof readiness === 'object') meta.readiness = normalizeReadiness(readiness);
    if (shadowError) meta.shadowError = shadowError;
    return meta;
  }

  function buildRouteArtifact(options = {}) {
    const lastRoute = buildLastRouteInfo(options);
    return lastRoute?.artifact || null;
  }

  function persistRoutedMemory({
    sessionId,
    memories,
    selectedLane,
    requestedMode,
    reason,
    backend,
    usedFallback = false,
    laneFallback = false,
    requestedModel = '',
    resolvedModel = '',
    executionPath = '',
    semanticMemoryReady = false,
    semanticMemoryMode = 'disabled',
    toolsUsed = [],
    toolOutcome = null,
    toolRecords = [],
    toolEvidenceFacts = [],
    retrieval = null,
    archiveContext = null,
    researchLedgerContext = null,
    matchedBooks = [],
    cleanup = null,
    cleanupTransform = null,
    canonicalFactsPresent = false,
    canonicalOverrideActive = false,
    repair = null,
    mood = '',
    shadowError = '',
    routePath = '/api/penny/chat',
    archiveEligible = false,
    artifact = null,
    epistemics = null,
    synthesis = null,
    performance = null,
    readiness = null,
    promptComposition = null,
    promptTruth = null,
    openLoopPromptBridge = null,
    initiativePromptBridge = null,
    turnStatePromptBridge = null,
    latencyBudget = null,
    researchLedgerRendered = false,
    researchLedgerPromptInjected = false,
    researchLedgerUpdate = null,
  }) {
    return saveStoredMemory(sessionId, {
      ...memories,
      lastRoute: buildLastRouteInfo({
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
        toolOutcome,
        toolRecords,
        toolEvidenceFacts,
        retrieval,
        archiveContext,
        researchLedgerContext,
        matchedBooks,
        cleanup,
        cleanupTransform,
        canonicalFactsPresent,
        canonicalOverrideActive,
        repair,
        mood,
        shadowError,
        routePath,
        archiveEligible,
        artifact,
        epistemics,
        synthesis,
        performance,
        readiness,
        promptComposition,
        promptTruth,
        openLoopPromptBridge,
        initiativePromptBridge,
        turnStatePromptBridge,
        latencyBudget,
        researchLedgerRendered,
        researchLedgerPromptInjected,
        researchLedgerUpdate,
      }),
    });
  }

  function trimAuditText(value = '', limit = 220) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
  }

  function buildArchiveAuditSnapshot({
    sessionId = 'default',
    selectedLane = 'chat',
    requestedMode = 'local',
    executionPath = 'llm-chat',
    userText = '',
    retrieval = null,
    promptTruth = null,
    artifact = null,
    researchLedgerUpdate = null,
  } = {}) {
    const usedAt = String(artifact?.timestamps?.usedAt || retrieval?.usedAt || '').trim() || isoNow();
    const mode = String(retrieval?.mode || '').trim() || 'keyword';
    const promptTruthAuditProjection = projectAuditRetrievalFromPromptTruth(promptTruth);
    const researchLedgerRendered = deriveResearchLedgerRendered(
      promptTruth || artifact?.promptTruth || artifact?.modelAdvisory?.promptTruth || null,
      preferRenderedCompatibilityBoolean(
        artifact?.researchLedgerRendered,
        artifact?.researchLedgerPromptInjected,
        false,
      ),
    );
    // `selected*Ids` are candidate-selection summaries for audit continuity, not rendered-only prompt receipts.
    return {
      turnId: `${String(sessionId || 'default').trim() || 'default'}:${usedAt}`,
      usedAt,
      userTextExcerpt: trimAuditText(userText, 220),
      selectedLane: String(selectedLane || '').trim() || 'chat',
      requestedMode: String(requestedMode || '').trim() || 'local',
      executionPath: String(executionPath || '').trim() || 'llm-chat',
      retrieval: {
        mode,
        reasonCode: String(retrieval?.reasonCode || '').trim()
          || (mode === 'semantic' ? 'semantic_query' : 'keyword_fallback'),
        ...promptTruthAuditProjection,
        compression: {
          used: retrieval?.compression?.used === true,
        },
        semanticReady: retrieval?.semanticReady === true,
        semanticDowngrade: retrieval?.semanticDowngrade === true,
      },
      promptTruth,
      artifactSummary: {
        kind: artifact?.kind || '',
        authority: {
          reply: artifact?.authority?.reply || '',
        },
        approximatePath: {
          status: artifact?.modelAdvisory?.approximatePath?.status || '',
        },
        researchLedgerRendered,
        researchLedgerPromptInjected: researchLedgerRendered,
      },
      researchLedger: {
        updateStatus: researchLedgerUpdate?.status || 'skipped',
        topicId: researchLedgerUpdate?.topicId || researchLedgerUpdate?.topic?.topicId || '',
        topicLabel: researchLedgerUpdate?.topicLabel || researchLedgerUpdate?.topic?.topicLabel || '',
      },
    };
  }

  function archiveIfEligible({
    sessionId,
    requestedMode,
    localLane,
    selectedLane,
    executionPath,
    userText,
    assistantText,
    retrieval,
    promptTruth,
    artifact,
    researchLedgerUpdate,
    provenance,
    reviewCandidates,
  }) {
    if (requestedMode === 'shadow' || localLane === 'chat') {
      scheduleArchiveConsolidation({
        sessionId,
        userText,
        assistantText,
        retrieval,
        audit: buildArchiveAuditSnapshot({
          sessionId,
          selectedLane,
          requestedMode,
          executionPath,
          userText,
          retrieval,
          promptTruth,
          artifact,
          researchLedgerUpdate,
        }),
        provenance,
        reviewCandidates,
      });
    }
  }

  function ledgerIfEligible({
    sessionId,
    requestedMode,
    localLane,
    userText,
    assistantText,
    toolOutcome = null,
    toolRecords,
    provenance,
    backend,
  }) {
    if (requestedMode === 'shadow') {
      return {
        status: 'skipped',
        reason: 'shadow-mode',
        context: null,
        topic: null,
      };
    }
    if (toolOutcome?.writeIntentRequired === true && toolOutcome?.writeIntentSatisfied === false) {
      return {
        status: 'skipped',
        reason: String(toolOutcome.failureReason || 'write-required-unmet').trim() || 'write-required-unmet',
        context: null,
        topic: null,
      };
    }
    return scheduleResearchLedgerUpdate?.({
      sessionId,
      userText,
      assistantText,
      selectedLane: localLane,
      backend,
      toolOutcome,
      toolRecords,
      provenance,
    }) || {
      status: 'skipped',
      reason: 'ledger-update-unavailable',
      context: null,
      topic: null,
    };
  }

  function finalizeLedgerState({
    runtimeMemoryContext = null,
    sessionId = 'default',
    requestedMode = 'local',
    localLane = 'chat',
    userText = '',
    assistantText = '',
    toolOutcome = null,
    toolRecords = [],
    provenance = [],
    backend = '',
  } = {}) {
    const researchLedgerUpdate = ledgerIfEligible({
      sessionId,
      requestedMode,
      localLane,
      userText,
      assistantText,
      toolOutcome,
      toolRecords,
      provenance,
      backend,
    });
    return {
      researchLedgerUpdate,
      researchLedgerContext: runtimeMemoryContext?.researchLedger || null,
    };
  }

  function recordAssistantTurn(text) {
    sessionState.lastMood = pickMood(text);
    sessionState.memory.push({ role: 'assistant', content: stripReplyMoodTags(text), ts: Date.now() });
    if (sessionState.memory.length > 12) sessionState.memory = sessionState.memory.slice(-12);
  }

  async function handleMemoryRoutes({ req, res, url }) {
    if (req.method === 'GET' && url.pathname === '/api/penny/memory') {
      const sessionId = url.searchParams.get('sessionId') || 'default';
      const { memory } = getStoredMemory(sessionId);
      sendJson(res, 200, { ok: true, memory });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/memory') {
      try {
        const payload = await parseJsonBody(req);
        const sessionId = payload.sessionId || 'default';
        const existing = getStoredMemory(sessionId).memory;
        const merged = mergeMemoryState(existing, payload.memory || {});
        const saved = saveStoredMemory(sessionId, merged);
        sendJson(res, 200, { ok: true, memory: saved });
      } catch (error) {
        sendJson(res, error?.statusCode || 500, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/penny/memory') {
      try {
        const payload = await parseJsonBody(req);
        const sessionId = payload.sessionId || 'default';
        const existing = getStoredMemory(sessionId).memory;
        const merged = mergeMemoryState(existing, payload.patch || {});
        const saved = saveStoredMemory(sessionId, merged);
        sendJson(res, 200, { ok: true, memory: saved });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/penny/memory/inspector') {
      try {
        const sessionId = url.searchParams.get('sessionId') || 'default';
        const explicitMemory = getStoredMemory(sessionId).memory;
        const inspector = await buildCombinedMemoryInspector(sessionId, explicitMemory);
        sendJson(res, 200, { ok: true, memory: explicitMemory, inspector });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/memory/review') {
      try {
        const payload = await parseJsonBody(req);
        const sessionId = payload.sessionId || 'default';
        const review = reviewPromotion({
          queueId: payload.queueId || payload.id || '',
          action: payload.action === 'reject' ? 'reject' : 'approve',
        });
        if (!review) {
          sendJson(res, 404, { ok: false, error: 'Memory review item not found.' });
          return true;
        }
        let memory = getStoredMemory(sessionId).memory;
        if (review.promotedMemory) {
          memory = saveStoredMemory(sessionId, {
            ...memory,
            memories: mergeMemoryItems([review.promotedMemory, ...(memory.memories || [])]),
          });
        }
        const inspector = await buildCombinedMemoryInspector(sessionId, memory);
        sendJson(res, 200, {
          ok: true,
          action: review.action,
          memory,
          inspector,
          reviewed: review.item,
        });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/memory/purge') {
      try {
        const payload = await parseJsonBody(req);
        const sessionId = payload.sessionId || 'default';
        let memory = getStoredMemory(sessionId).memory;
        if (payload.clearExplicit === true) {
          memory = saveStoredMemory(sessionId, {
            ...memory,
            memories: [],
          });
        }
        const archive = await purgeArchiveMemory({
          sessionId,
          clearSessionArchive: payload.clearSessionArchive === true,
          clearGlobalArchive: payload.clearGlobalArchive === true,
          clearEmbeddings: payload.clearEmbeddings === true,
        });
        await purgeResearchLedger?.({
          sessionId,
          clearSessionLedger: payload.clearSessionArchive === true,
          clearGlobalLedger: payload.clearGlobalArchive === true,
        });
        const inspector = await buildCombinedMemoryInspector(sessionId, memory);
        sendJson(res, 200, { ok: true, memory, inspector, archive });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/consolidate') {
      try {
        const payload = await parseJsonBody(req);
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const sessionId = payload.sessionId || 'default';
        const prepared = buildChatMemoryState(sessionId, payload.memories || {}, messages);
        const saved = saveStoredMemory(sessionId, prepared.memory);
        sendJson(res, 200, { ok: true, memory: saved, patch: prepared.patch });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
      return true;
    }

    return false;
  }

  async function handleShadowRoutes({ req, res, url }) {
    if (req.method === 'GET' && url.pathname === '/api/penny/shadow-status') {
      sendJson(res, 200, {
        ok: true,
        enabled: OPENCLAW_ENABLED,
        timeoutMs: OPENCLAW_TIMEOUT_MS,
        modelPath: 'openclaw agent --agent main',
        fallback: 'legacy /api/penny/chat/shadow falls back locally; main /api/penny/chat blocks on shadow failure',
        warning: 'Shadow is an optional experimental lane. It is not Penny\'s main chat brain, and the main chat route should surface failures instead of silently faking a reply.',
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/chat/shadow') {
      try {
        const payload = await parseJsonBody(req);
        const messages = sanitizeChatMessages(payload.messages);
        const sessionId = payload.sessionId || 'default';
        const prepared = buildChatMemoryState(sessionId, payload.memories || {}, messages);
        const memories = prepared.memory;
        const turnProvenance = Array.isArray(prepared.patch?.provenance) ? prepared.patch.provenance : [];
        const turnReviewCandidates = Array.isArray(prepared.patch?.reviewCandidates) ? prepared.patch.reviewCandidates : [];
        const lastUserMessage = [...messages].reverse().find((msg) => msg && msg.role === 'user');
        const userText = String(lastUserMessage?.content || '').trim();
        if (!userText) {
          sendJson(res, 400, { error: 'Missing user message content.' });
          return true;
        }

        const fileAttachment = sanitizeFileAttachment(payload.file || null);
        const promptUserText = appendAttachmentContext(userText, fileAttachment);
        const runtimeMemoryContext = await buildRuntimeMemoryContext({
          sessionId,
          memories,
          userText,
          messages,
          lane: 'shadow',
          attachmentType: fileAttachment ? 'file' : 'none',
        });
        const semanticMemoryReady = runtimeMemoryContext.semanticMemory?.ready === true;
        const semanticMemoryMode = runtimeMemoryContext.semanticMemory?.mode || 'disabled';
        const promptMemories = runtimeMemoryContext.memories;
        const matchedBooks = Array.isArray(runtimeMemoryContext.retrieval?.books) ? runtimeMemoryContext.retrieval.books : [];
        const epistemics = runtimeMemoryContext.epistemics || null;
        const synthesis = runtimeMemoryContext.synthesis || null;
        saveStoredMemory(sessionId, memories);

        if (!OPENCLAW_ENABLED) {
          const fallbackText = buildPennyReply({ userText, memories: promptMemories });
          scheduleArchiveConsolidation({
            sessionId,
            userText,
            assistantText: fallbackText,
            retrieval: runtimeMemoryContext.retrieval,
            provenance: turnProvenance,
            reviewCandidates: turnReviewCandidates,
          });
          const artifact = buildRouteArtifact({
            sessionId,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'local-stable',
            usedFallback: true,
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
          });
          const routedMemory = persistRoutedMemory({
            sessionId,
            memories,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'local-stable',
            usedFallback: true,
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
            artifact,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
          });
          sendJson(res, 200, {
            ok: true,
            enabled: false,
            usedFallback: true,
            text: fallbackText,
            memory: routedMemory,
            meta: {
              ...buildResponseMeta({
                mood: pickMood(fallbackText),
                turns: sessionState.turns,
                backend: 'local-stable',
                requestedMode: 'shadow',
                usedFallback: true,
                localLane: 'shadow',
                semanticMemoryReady,
                semanticMemoryMode,
                artifact,
              }),
              shadowAvailable: false,
            },
          });
          return true;
        }

        try {
          const text = await runOpenClawShadow({ sessionId, userText: promptUserText, messages, memories: promptMemories });
          scheduleArchiveConsolidation({
            sessionId,
            userText,
            assistantText: text,
            retrieval: runtimeMemoryContext.retrieval,
            provenance: turnProvenance,
            reviewCandidates: turnReviewCandidates,
          });
          const artifact = buildRouteArtifact({
            sessionId,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'openclaw-shadow',
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
          });
          const routedMemory = persistRoutedMemory({
            sessionId,
            memories,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'openclaw-shadow',
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
            artifact,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
          });
          sendJson(res, 200, {
            ok: true,
            enabled: true,
            usedFallback: false,
            text,
            memory: routedMemory,
            meta: {
              ...buildResponseMeta({
                mood: pickMood(text),
                turns: sessionState.turns,
                backend: 'openclaw-shadow',
                requestedMode: 'shadow',
                usedFallback: false,
                localLane: 'shadow',
                semanticMemoryReady,
                semanticMemoryMode,
                artifact,
              }),
              shadowAvailable: true,
            },
          });
          return true;
        } catch (error) {
          const fallbackText = buildPennyReply({ userText, memories: promptMemories });
          scheduleArchiveConsolidation({
            sessionId,
            userText,
            assistantText: fallbackText,
            retrieval: runtimeMemoryContext.retrieval,
            provenance: turnProvenance,
            reviewCandidates: turnReviewCandidates,
          });
          const artifact = buildRouteArtifact({
            sessionId,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'local-stable',
            usedFallback: true,
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            shadowError: error.message,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
          });
          const routedMemory = persistRoutedMemory({
            sessionId,
            memories,
            selectedLane: 'shadow',
            requestedMode: 'shadow',
            reason: 'shadow-mode-requested',
            backend: 'local-stable',
            usedFallback: true,
            semanticMemoryReady,
            semanticMemoryMode,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            shadowError: error.message,
            routePath: '/api/penny/chat/shadow',
            archiveEligible: true,
            artifact,
            epistemics,
            synthesis,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
          });
          sendJson(res, 200, {
            ok: true,
            enabled: true,
            usedFallback: true,
            text: fallbackText,
            memory: routedMemory,
            meta: {
              ...buildResponseMeta({
                mood: pickMood(fallbackText),
                turns: sessionState.turns,
                backend: 'local-stable',
                requestedMode: 'shadow',
                usedFallback: true,
                localLane: 'shadow',
                semanticMemoryReady,
                semanticMemoryMode,
                artifact,
                shadowError: error.message,
              }),
              shadowAvailable: true,
            },
          });
          return true;
        }
      } catch (error) {
        sendJson(res, error?.statusCode || 500, { ok: false, error: error.message });
        return true;
      }
    }

    return false;
  }

  async function handleLmStudioRoutes({ req, res, url }) {
    if (req.method === 'GET' && url.pathname === '/api/penny/lmstudio/status') {
      const force = url.searchParams.get('refresh') === '1';
      const lmStudio = await getLmStudioConnectionStatus({ force });
      const semanticMemory = await getSemanticMemoryStatus({ force, lmStatus: lmStudio });
      const readiness = buildRuntimeReadiness({ lmStudio, semanticMemory });
      const performance = buildRuntimeStatusPerformance({ lmStudio, semanticMemory });
      sendJson(res, 200, {
        ...lmStudio,
        embedPreferredModel: PENNY_LMSTUDIO_EMBED_MODEL,
        semanticMemory,
        readiness,
        performance,
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/penny/lmstudio/model') {
      try {
        const payload = await parseJsonBody(req);
        const model = String(payload.model || '').trim();
        setRuntimePreferredChatModel(model);
        const lmStudio = await getLmStudioConnectionStatus({ force: true });
        sendJson(res, 200, {
          ok: true,
          runtimePreferredModel: getRuntimePreferredChatModel() || null,
          chatPreferredModel: lmStudio.chatPreferredModel || null,
          toolPreferredModel: lmStudio.toolPreferredModel || null,
          resolvedModel: lmStudio.resolvedModel,
          routingMode: lmStudio.routingMode || 'auto',
        });
      } catch (error) {
        sendJson(res, error?.statusCode || 500, { ok: false, error: error.message });
      }
      return true;
    }

    return false;
  }

  async function handleChatRoutes({ req, res, url }) {
    if (!(req.method === 'POST' && (url.pathname === '/api/penny/chat' || url.pathname === '/api/companion/chat'))) {
      return false;
    }

    const requestStartedAt = Date.now();
    const performanceTracker = createPerformanceTracker();
    try {
      const promptAssemblyStartedAt = Date.now();
      const payload = await parseJsonBody(req);
      const messages = sanitizeChatMessages(payload.messages);
      const sessionId = payload.sessionId || 'default';
      const prepared = buildChatMemoryState(sessionId, payload.memories || {}, messages);
      const memories = prepared.memory;
      const turnProvenance = Array.isArray(prepared.patch?.provenance) ? prepared.patch.provenance : [];
      const turnReviewCandidates = Array.isArray(prepared.patch?.reviewCandidates) ? prepared.patch.reviewCandidates : [];
      const lastUserMessage = [...messages].reverse().find((msg) => msg && msg.role === 'user');
      const userText = String(lastUserMessage?.content || '').trim();
      if (!userText) {
        sendJson(res, 400, { error: 'Missing user message content.' });
        return true;
      }
      const imageAttachment = sanitizeImageDataUrl(payload.image || null);
      const image = imageAttachment?.dataUrl || null;
      const fileAttachment = sanitizeFileAttachment(payload.file || null);
      const promptUserText = appendAttachmentContext(userText, fileAttachment);
      const wantsStream = payload.stream === true || url.searchParams.get('stream') === '1';
      const requestedMode = memories?.brainMode === 'shadow' ? 'shadow' : 'local';
      const laneSelection = requestedMode === 'local'
        ? selectLocalLane({ userText, image, file: fileAttachment })
        : { localLane: 'chat', directIntent: null, needsTools: false, reason: 'shadow-mode-requested' };
      recordMeasuredStage(performanceTracker, 'promptAssembly', promptAssemblyStartedAt, {
        source: 'route-prep',
        note: 'Prompt inputs and lane selection prepared.',
      });
      const archiveRetrievalStartedAt = Date.now();
      const runtimeMemoryContext = await buildRuntimeMemoryContext({
        sessionId,
        memories,
        userText,
        messages,
        lane: requestedMode === 'shadow' ? 'shadow' : laneSelection.localLane,
        attachmentType: image ? 'image' : (fileAttachment ? 'file' : 'none'),
      });
      performanceTracker.latencyClass = String(runtimeMemoryContext?.latencyBudget?.latencyClass || performanceTracker.latencyClass || 'casual-companion');
      recordMeasuredStage(performanceTracker, 'archiveRetrieval', archiveRetrievalStartedAt, {
        source: 'archive-memory',
        note: 'Archive retrieval and runtime memory context prepared.',
        sessionItems: Array.isArray(runtimeMemoryContext?.retrieval?.session) ? runtimeMemoryContext.retrieval.session.length : 0,
        globalItems: Array.isArray(runtimeMemoryContext?.retrieval?.global) ? runtimeMemoryContext.retrieval.global.length : 0,
        semanticReady: runtimeMemoryContext?.semanticMemory?.ready === true,
        reasonCode: String(runtimeMemoryContext?.retrieval?.reasonCode || '').trim(),
      });
      if (runtimeMemoryContext?.semanticMemory?.probe) {
        recordPerformanceStage(performanceTracker, 'semanticProbe', {
          ...runtimeMemoryContext.semanticMemory.probe,
          available: true,
          source: 'semantic-memory-status',
          note: String(runtimeMemoryContext.semanticMemory.reason || '').trim(),
        });
      }
      const promptMemories = runtimeMemoryContext.memories;
      const matchedBooks = Array.isArray(runtimeMemoryContext.retrieval?.books) ? runtimeMemoryContext.retrieval.books : [];
      const researchLedgerRendered = deriveResearchLedgerRendered(
        runtimeMemoryContext.promptTruth,
        preferRenderedCompatibilityBoolean(
          runtimeMemoryContext.researchLedgerRendered,
          runtimeMemoryContext.researchLedgerPromptInjected,
          false,
        ),
      );
      let epistemics = runtimeMemoryContext.epistemics || null;
      let synthesis = runtimeMemoryContext.synthesis || null;
      saveStoredMemory(sessionId, memories);
      sessionState.turns += 1;
      sessionState.memory.push({ role: 'user', content: userText, ts: Date.now() });
      if (sessionState.memory.length > 12) sessionState.memory = sessionState.memory.slice(-12);

      let text;
      let backend = 'local-lmstudio';
      let usedFallback = false;
      let shadowError = '';
      let toolsUsed = [];
      let toolRecords = [];
      let toolOutcome = null;
      let toolEvidenceFacts = [];
      let repair = null;
      let cleanup = null;
      let cleanupTransform = null;
      let localLane = 'chat';
      let requestedModel = '';
      let resolvedModel = '';
      let executionPath = requestedMode === 'shadow' ? 'shadow' : 'llm-chat';
      let laneFallback = false;
      let modelUsed = requestedMode === 'shadow';
      let canonicalFactsPresent = false;
      let canonicalOverrideActive = false;
      const semanticMemoryReady = runtimeMemoryContext.semanticMemory?.ready === true;
      const semanticMemoryMode = runtimeMemoryContext.semanticMemory?.mode || 'disabled';

      if (wantsStream) {
        beginEventStream(res);
        if (typeof req.setTimeout === 'function') req.setTimeout(0);
        if (typeof res.setTimeout === 'function') res.setTimeout(0);
        if (req.socket && typeof req.socket.setTimeout === 'function') req.socket.setTimeout(0);
        const keepAlive = startEventStreamKeepAlive(res);
        const clientAbortController = new AbortController();
        const clientDisconnect = bindClientDisconnectAbort(req, res, clientAbortController);

        try {
          sendEventStream(res, 'status', { stage: 'accepted', label: 'link open' });
          if (requestedMode === 'local') {
            const modelRoundTripStartedAt = Date.now();
            const firstTokenStartedAt = Date.now();
            let firstTokenSeen = false;
            const result = image
              ? await runLmStudioLocalSmart({
                  userText,
                  messages,
                  memories: promptMemories,
                  image,
                  file: fileAttachment,
                  abortSignal: clientAbortController.signal,
                  laneSelection,
                  latencyBudget: runtimeMemoryContext.latencyBudget,
                })
              : await streamLmStudioLocalSmart({
                  userText,
                  messages,
                  memories: promptMemories,
                  image,
                  file: fileAttachment,
                  abortSignal: clientAbortController.signal,
                  laneSelection,
                  latencyBudget: runtimeMemoryContext.latencyBudget,
                  onEvent: (evt) => {
                    if (clientDisconnect.isClosed()) return;
                    if (evt?.type === 'message.delta') {
                      if (!firstTokenSeen) {
                        firstTokenSeen = true;
                        recordMeasuredStage(performanceTracker, 'firstToken', firstTokenStartedAt, {
                          source: 'stream-event',
                          note: 'First streamed token reached the browser.',
                          available: true,
                        });
                      }
                      sendEventStream(res, 'message.delta', { content: evt.content || '', text: evt.text || '' });
                    } else if (evt?.type === 'status') {
                      sendEventStream(res, 'status', { stage: evt.stage || '', label: evt.label || '' });
                    } else if (evt?.type === 'tool') {
                      sendEventStream(res, 'tool', evt);
                    }
                  },
                });
            mergePerformanceTracker(performanceTracker, result?.performance);
            text = result.text;
            toolsUsed = Array.isArray(result.toolsUsed) ? result.toolsUsed : [];
            toolRecords = Array.isArray(result.toolRecords) ? result.toolRecords : [];
            toolOutcome = result.toolOutcome && typeof result.toolOutcome === 'object' ? result.toolOutcome : null;
            toolEvidenceFacts = Array.isArray(result.toolEvidenceFacts) ? result.toolEvidenceFacts : [];
            repair = result.repair && typeof result.repair === 'object' ? result.repair : null;
            cleanup = result.cleanup && typeof result.cleanup === 'object' ? result.cleanup : null;
            cleanupTransform = result.cleanupTransform && typeof result.cleanupTransform === 'object' ? result.cleanupTransform : null;
            epistemics = result.epistemics || epistemics;
            synthesis = result.synthesis || synthesis;
            backend = toolsUsed.length ? 'local-lmstudio-tools' : 'local-lmstudio';
            localLane = result.localLane || 'chat';
            requestedModel = result.requestedModel || '';
            resolvedModel = result.resolvedModel || '';
            executionPath = result.executionPath || (localLane === 'tool' ? 'deterministic-tool' : 'llm-chat');
            laneFallback = result.laneFallback === true;
            modelUsed = result.modelUsed !== false;
            canonicalFactsPresent = result.canonicalFactsPresent === true;
            canonicalOverrideActive = result.canonicalOverrideActive === true;
            if (modelUsed) {
              recordMeasuredStage(performanceTracker, 'modelRoundTrip', modelRoundTripStartedAt, {
                source: 'lmstudio-route',
                transport: String(backend || 'local-lmstudio').trim(),
                note: 'LM Studio completed the turn.',
              });
            } else {
              recordPerformanceStage(performanceTracker, 'modelRoundTrip', {
                available: false,
                source: executionPath,
                note: 'Turn completed without invoking the model.',
                transport: '',
              });
            }
          } else if (!OPENCLAW_ENABLED) {
            sendEventStream(res, 'error', {
              error: 'Shadow brain requested but not enabled on the server.',
              meta: {
                requestedMode,
                backend: 'shadow-unavailable',
                shadowEnabled: false,
                usedFallback: false,
              },
            });
            res.end();
            return true;
          } else {
            const modelRoundTripStartedAt = Date.now();
            text = await runOpenClawShadow({
              sessionId,
              userText: promptUserText,
              messages,
              memories: promptMemories,
              abortSignal: clientAbortController.signal,
            });
            recordMeasuredStage(performanceTracker, 'modelRoundTrip', modelRoundTripStartedAt, {
              source: 'shadow-route',
              transport: 'openclaw-shadow',
              note: 'Shadow runtime completed the turn.',
            });
            backend = 'openclaw-shadow';
            executionPath = 'shadow';
            modelUsed = true;
          }

          text = retagAssistantReply(text, extractReplyMoodTag(text) || sessionState.lastMood);
          if (requestedMode === 'local' && image && !clientDisconnect.isClosed()) {
            sendEventStream(res, 'status', { stage: 'image.reply.ready', label: 'replying' });
            sendEventStream(res, 'message.delta', { content: text, text });
          }
          if (requestedMode === 'shadow' && !clientDisconnect.isClosed()) {
            sendEventStream(res, 'message.delta', { content: text, text });
          }

          recordAssistantTurn(text);
          const archiveEligible = requestedMode === 'shadow' || localLane === 'chat';
          const ledgerState = finalizeLedgerState({
            runtimeMemoryContext,
            sessionId,
            requestedMode,
            localLane,
            userText,
            assistantText: text,
            toolOutcome,
            toolRecords,
            provenance: turnProvenance,
            backend,
          });
          const readiness = buildTurnReadiness({
            requestedMode,
            selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
            resolvedModel,
            semanticMemoryReady,
            semanticMemoryMode,
            usedFallback,
            modelUsed,
          });
          const performance = finalizePerformanceTracker(performanceTracker);
          const artifact = buildRouteArtifact({
            sessionId,
            selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
            requestedMode,
            reason: requestedMode === 'shadow' ? 'shadow-mode-requested' : String(laneSelection.reason || ''),
            backend,
            executionPath,
            usedFallback,
            laneFallback,
            requestedModel,
            resolvedModel,
            semanticMemoryReady,
            semanticMemoryMode,
            toolsUsed,
            toolOutcome,
            toolRecords,
            toolEvidenceFacts,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            cleanup,
            cleanupTransform,
            canonicalFactsPresent,
            canonicalOverrideActive,
            repair,
            epistemics,
            synthesis,
            performance,
            readiness,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
            researchLedgerRendered,
            researchLedgerPromptInjected: researchLedgerRendered,
            researchLedgerUpdate: ledgerState.researchLedgerUpdate,
            shadowEnabled: OPENCLAW_ENABLED === true,
            shadowError,
            mood: sessionState.lastMood,
            archiveEligible,
          });
          const routedMemory = persistRoutedMemory({
            sessionId,
            memories,
            selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
            requestedMode,
            reason: requestedMode === 'shadow' ? 'shadow-mode-requested' : String(laneSelection.reason || ''),
            backend,
            executionPath,
            usedFallback,
            laneFallback,
            requestedModel,
            resolvedModel,
            semanticMemoryReady,
            semanticMemoryMode,
            toolsUsed,
            toolOutcome,
            toolRecords,
            toolEvidenceFacts,
            retrieval: runtimeMemoryContext.retrieval,
            archiveContext: runtimeMemoryContext.archiveContext,
            researchLedgerContext: runtimeMemoryContext.researchLedger,
            matchedBooks,
            cleanup,
            cleanupTransform,
            canonicalFactsPresent,
            canonicalOverrideActive,
            repair,
            mood: sessionState.lastMood,
            shadowError,
            archiveEligible,
            artifact,
            epistemics,
            synthesis,
            performance,
            readiness,
            promptComposition: runtimeMemoryContext.promptComposition,
            promptTruth: runtimeMemoryContext.promptTruth,
            openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
            initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
            turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
            latencyBudget: runtimeMemoryContext.latencyBudget,
            researchLedgerRendered,
            researchLedgerPromptInjected: researchLedgerRendered,
            researchLedgerUpdate: ledgerState.researchLedgerUpdate,
          });
          archiveIfEligible({
            sessionId,
            requestedMode,
            localLane,
            selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
            executionPath,
            userText,
            assistantText: text,
            retrieval: runtimeMemoryContext.retrieval,
            promptTruth: runtimeMemoryContext.promptTruth,
            artifact,
            researchLedgerUpdate: ledgerState.researchLedgerUpdate,
            provenance: turnProvenance,
            reviewCandidates: turnReviewCandidates,
          });
          if (!clientDisconnect.isClosed()) {
            sendEventStream(res, 'done', {
              text,
              memory: routedMemory,
              meta: buildResponseMeta({
                mood: sessionState.lastMood,
                turns: sessionState.turns,
                backend,
                requestedMode,
                usedFallback,
                localLane,
                requestedModel,
                resolvedModel,
                executionPath,
                laneFallback,
                semanticMemoryReady,
                semanticMemoryMode,
                researchLedgerRendered,
                researchLedgerPromptInjected: researchLedgerRendered,
                researchLedgerUpdate: ledgerState.researchLedgerUpdate,
                toolsUsed,
                toolOutcome,
                repair,
                artifact,
                performance,
                readiness,
                shadowError,
              }),
            });
          }
          res.end();
          return true;
        } catch (error) {
          if (!clientDisconnect.isClosed()) {
            sendEventStream(res, 'error', {
              error: requestedMode === 'local' ? 'Local LM Studio brain failed.' : 'Penny chat route failed.',
              detail: requestedMode === 'local'
                ? describeLocalBrainFailure(error, { hasImage: !!image })
                : error.message,
              meta: {
                requestedMode,
                backend: requestedMode === 'local' ? 'local-lmstudio-failed' : backend,
                shadowEnabled: OPENCLAW_ENABLED,
                usedFallback: false,
                localLane,
                requestedModel,
                resolvedModel,
                laneFallback,
                toolsUsed,
                ...(shadowError ? { shadowError } : {}),
              },
            });
            res.end();
          }
          return true;
        } finally {
          clearInterval(keepAlive);
          clientDisconnect.cleanup();
        }
      }

      const clientAbortController = new AbortController();
      const clientDisconnect = bindClientDisconnectAbort(req, res, clientAbortController);
      try {
        if (requestedMode === 'local') {
          try {
            const modelRoundTripStartedAt = Date.now();
            const result = await runLmStudioLocalSmart({
              userText,
              messages,
              memories: promptMemories,
              image,
              file: fileAttachment,
              abortSignal: clientAbortController.signal,
              laneSelection,
              latencyBudget: runtimeMemoryContext.latencyBudget,
            });
            mergePerformanceTracker(performanceTracker, result?.performance);
            if (clientDisconnect.isClosed()) return true;
            text = result.text;
            toolsUsed = Array.isArray(result.toolsUsed) ? result.toolsUsed : [];
            toolRecords = Array.isArray(result.toolRecords) ? result.toolRecords : [];
            toolOutcome = result.toolOutcome && typeof result.toolOutcome === 'object' ? result.toolOutcome : null;
            toolEvidenceFacts = Array.isArray(result.toolEvidenceFacts) ? result.toolEvidenceFacts : [];
            repair = result.repair && typeof result.repair === 'object' ? result.repair : null;
            cleanup = result.cleanup && typeof result.cleanup === 'object' ? result.cleanup : null;
            cleanupTransform = result.cleanupTransform && typeof result.cleanupTransform === 'object' ? result.cleanupTransform : null;
            epistemics = result.epistemics || epistemics;
            synthesis = result.synthesis || synthesis;
            backend = toolsUsed.length ? 'local-lmstudio-tools' : 'local-lmstudio';
            localLane = result.localLane || 'chat';
            requestedModel = result.requestedModel || '';
            resolvedModel = result.resolvedModel || '';
            executionPath = result.executionPath || (localLane === 'tool' ? 'deterministic-tool' : 'llm-chat');
            laneFallback = result.laneFallback === true;
            modelUsed = result.modelUsed !== false;
            canonicalFactsPresent = result.canonicalFactsPresent === true;
            canonicalOverrideActive = result.canonicalOverrideActive === true;
            if (modelUsed) {
              recordMeasuredStage(performanceTracker, 'modelRoundTrip', modelRoundTripStartedAt, {
                source: 'lmstudio-route',
                transport: 'local-lmstudio',
                note: 'LM Studio completed the turn.',
              });
            } else {
              recordPerformanceStage(performanceTracker, 'modelRoundTrip', {
                available: false,
                source: executionPath,
                note: 'Turn completed without invoking the model.',
                transport: '',
              });
            }
          } catch (error) {
            if (clientDisconnect.isClosed()) return true;
            sendJson(res, 503, {
              error: 'Local LM Studio brain failed.',
              detail: describeLocalBrainFailure(error, { hasImage: !!image }),
              meta: {
                requestedMode,
                backend: 'local-lmstudio-failed',
                shadowEnabled: OPENCLAW_ENABLED,
                usedFallback: false,
                localLane,
                requestedModel,
                resolvedModel,
                laneFallback,
                toolsUsed,
                shadowError: error.message,
              },
            });
            return true;
          }
        } else if (!OPENCLAW_ENABLED) {
          if (clientDisconnect.isClosed()) return true;
          sendJson(res, 503, {
            error: 'Shadow brain requested but not enabled on the server.',
            meta: {
              requestedMode,
              backend: 'shadow-unavailable',
              shadowEnabled: false,
              usedFallback: false,
            },
          });
          return true;
        } else {
          try {
            const modelRoundTripStartedAt = Date.now();
            text = await runOpenClawShadow({
              sessionId,
              userText: promptUserText,
              messages,
              memories: promptMemories,
              abortSignal: clientAbortController.signal,
            });
            recordMeasuredStage(performanceTracker, 'modelRoundTrip', modelRoundTripStartedAt, {
              source: 'shadow-route',
              transport: 'openclaw-shadow',
              note: 'Shadow runtime completed the turn.',
            });
            if (clientDisconnect.isClosed()) return true;
            backend = 'openclaw-shadow';
            executionPath = 'shadow';
            modelUsed = true;
          } catch (error) {
            if (clientDisconnect.isClosed()) return true;
            sendJson(res, 503, {
              error: 'Shadow brain failed, so the reply was blocked instead of silently degrading.',
              detail: error.message,
              meta: {
                requestedMode,
                backend: 'shadow-failed',
                shadowEnabled: true,
                usedFallback: false,
                shadowError: error.message,
              },
            });
            return true;
          }
        }
      } finally {
        clientDisconnect.cleanup();
      }

      text = retagAssistantReply(text, extractReplyMoodTag(text) || sessionState.lastMood);
      recordAssistantTurn(text);
      const archiveEligible = requestedMode === 'shadow' || localLane === 'chat';
      const ledgerState = finalizeLedgerState({
        runtimeMemoryContext,
        sessionId,
        requestedMode,
        localLane,
        userText,
        assistantText: text,
        toolOutcome,
        toolRecords,
        provenance: turnProvenance,
        backend,
      });
      const readiness = buildTurnReadiness({
        requestedMode,
        selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
        resolvedModel,
        semanticMemoryReady,
        semanticMemoryMode,
        usedFallback,
        modelUsed,
      });
      const performance = finalizePerformanceTracker(performanceTracker);
      const artifact = buildRouteArtifact({
        sessionId,
        selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
        requestedMode,
        reason: requestedMode === 'shadow' ? 'shadow-mode-requested' : String(laneSelection.reason || ''),
        backend,
        executionPath,
        usedFallback,
        laneFallback,
        requestedModel,
        resolvedModel,
        semanticMemoryReady,
        semanticMemoryMode,
        toolsUsed,
        toolOutcome,
        toolRecords,
        toolEvidenceFacts,
        retrieval: runtimeMemoryContext.retrieval,
        archiveContext: runtimeMemoryContext.archiveContext,
        researchLedgerContext: runtimeMemoryContext.researchLedger,
        matchedBooks,
        cleanup,
        cleanupTransform,
        canonicalFactsPresent,
        canonicalOverrideActive,
        repair,
        epistemics,
        synthesis,
        performance,
        readiness,
        promptComposition: runtimeMemoryContext.promptComposition,
        promptTruth: runtimeMemoryContext.promptTruth,
        openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
        initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
        turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
        latencyBudget: runtimeMemoryContext.latencyBudget,
        researchLedgerRendered,
        researchLedgerPromptInjected: researchLedgerRendered,
        researchLedgerUpdate: ledgerState.researchLedgerUpdate,
        shadowEnabled: OPENCLAW_ENABLED === true,
        shadowError,
        mood: sessionState.lastMood,
        archiveEligible,
      });

      const savedMemory = persistRoutedMemory({
        sessionId,
        memories,
        selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
        requestedMode,
        reason: requestedMode === 'shadow' ? 'shadow-mode-requested' : String(laneSelection.reason || ''),
        backend,
        executionPath,
        usedFallback,
        laneFallback,
        requestedModel,
        resolvedModel,
        semanticMemoryReady,
        semanticMemoryMode,
        toolsUsed,
        toolOutcome,
        toolRecords,
        toolEvidenceFacts,
        retrieval: runtimeMemoryContext.retrieval,
        archiveContext: runtimeMemoryContext.archiveContext,
        researchLedgerContext: runtimeMemoryContext.researchLedger,
        matchedBooks,
        cleanup,
        cleanupTransform,
        canonicalFactsPresent,
        canonicalOverrideActive,
        repair,
        mood: sessionState.lastMood,
        shadowError,
        archiveEligible,
        artifact,
        epistemics,
        synthesis,
        performance,
        readiness,
        promptComposition: runtimeMemoryContext.promptComposition,
        promptTruth: runtimeMemoryContext.promptTruth,
        openLoopPromptBridge: runtimeMemoryContext.openLoopPromptBridge,
        initiativePromptBridge: runtimeMemoryContext.initiativePromptBridge,
        turnStatePromptBridge: runtimeMemoryContext.turnStatePromptBridge,
        latencyBudget: runtimeMemoryContext.latencyBudget,
        researchLedgerRendered,
        researchLedgerPromptInjected: researchLedgerRendered,
        researchLedgerUpdate: ledgerState.researchLedgerUpdate,
      });
      archiveIfEligible({
        sessionId,
        requestedMode,
        localLane,
        selectedLane: requestedMode === 'shadow' ? 'shadow' : localLane,
        executionPath,
        userText,
        assistantText: text,
        retrieval: runtimeMemoryContext.retrieval,
        promptTruth: runtimeMemoryContext.promptTruth,
        artifact,
        researchLedgerUpdate: ledgerState.researchLedgerUpdate,
        provenance: turnProvenance,
        reviewCandidates: turnReviewCandidates,
      });
      sendJson(res, 200, {
        text,
        memory: savedMemory,
        meta: buildResponseMeta({
          mood: sessionState.lastMood,
          turns: sessionState.turns,
          backend,
          requestedMode,
          usedFallback,
          localLane,
          requestedModel,
          resolvedModel,
          executionPath,
          laneFallback,
          semanticMemoryReady,
          semanticMemoryMode,
          researchLedgerRendered,
          researchLedgerPromptInjected: researchLedgerRendered,
          researchLedgerUpdate: ledgerState.researchLedgerUpdate,
          toolsUsed,
          toolOutcome,
          repair,
          artifact,
          performance,
          readiness,
          shadowError,
        }),
      });
      return true;
    } catch (error) {
      sendJson(res, error?.statusCode || 500, { error: 'Penny chat route failed.', detail: error.message });
      return true;
    }
  }

  async function handleStatusRoutes({ req, res, url }) {
    if (!(req.method === 'GET' && (url.pathname === '/api/penny/status' || url.pathname === '/api/companion/status'))) {
      return false;
    }
    const force = url.searchParams.get('refresh') === '1';
    const lmStudio = await getLmStudioConnectionStatus({ force });
    const semanticMemory = await getSemanticMemoryStatus({ force, lmStatus: lmStudio });
    const staticEmbedding = typeof getStaticEmbeddingStatus === 'function'
      ? getStaticEmbeddingStatus()
      : null;
    const readiness = buildRuntimeReadiness({ lmStudio, semanticMemory });
    const performance = buildRuntimeStatusPerformance({ lmStudio, semanticMemory });
    sendJson(res, 200, {
      ok: true,
      name: 'Penny',
      turns: sessionState.turns,
      mood: sessionState.lastMood,
      backend: 'local-lmstudio',
      memoryEntries: sessionState.memory.length,
      durableMemoryConfigured: Boolean(MEMORY_FILE),
      memoryArchiveConfigured: Boolean(MEMORY_ARCHIVE_FILE),
      memoryEmbeddingsConfigured: Boolean(MEMORY_EMBEDDINGS_FILE),
      localPathsRedacted: true,
      shadowEnabled: OPENCLAW_ENABLED,
      webSearchEnabled: WEB_SEARCH_ENABLED,
      lmStudioBase: LMSTUDIO_BASE,
      lmStudioNativeBase: LMSTUDIO_NATIVE_BASE,
      lmStudioModel: LMSTUDIO_MODEL,
      localLlmTransport: LOCAL_LLM_TRANSPORT,
      responsesChatFallback: RESPONSES_THEN_CHAT_FALLBACK,
      maxOutputTokens: LMSTUDIO_MAX_OUTPUT_TOKENS,
      semanticMemory,
      lmStudio,
      staticEmbedding,
      readiness,
      performance,
    });
    return true;
  }

  async function handleWorkspaceWriteRoutes({ req, res, url }) {
    if (!url.pathname.startsWith('/api/penny/workspace-writes')) return false;
    if (
      typeof listPendingWorkspaceWrites !== 'function'
      || typeof approvePendingWorkspaceWrite !== 'function'
      || typeof denyPendingWorkspaceWrite !== 'function'
    ) {
      sendJson(res, 503, { ok: false, error: 'Workspace write approval is not available.' });
      return true;
    }
    try {
      if (req.method === 'GET' && url.pathname === '/api/penny/workspace-writes') {
        sendJson(res, 200, { ok: true, ...listPendingWorkspaceWrites() });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/penny/workspace-writes/approve') {
        const body = await parseJsonBody(req);
        sendJson(res, 200, { ok: true, write: approvePendingWorkspaceWrite(body) });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/penny/workspace-writes/deny') {
        const body = await parseJsonBody(req);
        sendJson(res, 200, { ok: true, write: denyPendingWorkspaceWrite(body) });
        return true;
      }
      sendJson(res, 405, { ok: false, error: 'Unsupported workspace write approval route.' });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: String(error?.message || error).trim() });
      return true;
    }
  }

  async function handleApiRoute(context) {
    if (await handleMemoryRoutes(context)) return true;
    if (await handleShadowRoutes(context)) return true;
    if (await handleLmStudioRoutes(context)) return true;
    if (await handleWorkspaceWriteRoutes(context)) return true;
    if (await handleChatRoutes(context)) return true;
    if (await handleStatusRoutes(context)) return true;
    return false;
  }

  return {
    handleApiRoute,
  };
}

module.exports = {
  bindClientDisconnectAbort,
  createPennyRouteHandlers,
};
