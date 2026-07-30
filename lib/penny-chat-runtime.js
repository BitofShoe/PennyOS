const {
  buildStatusReasoningContract,
} = require('./penny-reasoning-contract');

function normalizeLane(value = 'chat') {
  return String(value || 'chat').trim().toLowerCase() || 'chat';
}

function resolveLastUserMessage(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (message && String(message.role || '').toLowerCase() === 'user') return message;
  }
  return null;
}

function normalizeLaneSelection(laneSelection = null, {
  userText = '',
  image = null,
  file = null,
  selectLocalLane = null,
} = {}) {
  if (laneSelection && typeof laneSelection === 'object' && laneSelection.localLane) {
    return {
      localLane: normalizeLane(laneSelection.localLane),
      directIntent: laneSelection.directIntent || null,
      forceToolLoop: !!laneSelection.forceToolLoop,
      needsTools: !!laneSelection.needsTools,
      reason: String(laneSelection.reason || '').trim(),
      requestedMode: String(laneSelection.requestedMode || '').trim(),
      requestedModel: String(laneSelection.requestedModel || '').trim(),
      resolvedModel: String(laneSelection.resolvedModel || '').trim(),
      laneFallback: !!laneSelection.laneFallback,
    };
  }

  if (typeof selectLocalLane === 'function') {
    return normalizeLaneSelection(selectLocalLane({ userText, image, file }), {
      userText,
      image,
      file,
    });
  }

  return {
    localLane: image ? 'chat' : (file ? 'tool' : 'chat'),
    directIntent: null,
    forceToolLoop: false,
    needsTools: !!file,
    reason: image ? 'image-chat' : (file ? 'attached-file' : 'companion-chat'),
    requestedMode: '',
    requestedModel: '',
    resolvedModel: '',
    laneFallback: false,
  };
}

function resolveLaneSelection({
  laneSelection = null,
  userText = '',
  image = null,
  file = null,
  selectLocalLane = null,
} = {}) {
  return normalizeLaneSelection(laneSelection, {
    userText,
    image,
    file,
    selectLocalLane,
  });
}

function createLaneRuntime(localLane = 'chat', getPreferredModelForLane = () => '') {
  const requestedModel = String(getPreferredModelForLane(localLane) || '').trim();
  return {
    localLane: normalizeLane(localLane),
    requestedModel,
    resolvedModel: '',
    laneFallback: false,
    modelUsed: false,
    executionPath: '',
    canonicalFactsPresent: false,
    canonicalOverrideActive: false,
    reasoningContract: buildStatusReasoningContract(),
    cleanup: {
      reasonCode: 'none',
      cleanupApplied: false,
      materialChange: false,
      reconstructedReply: false,
      usedReasoningFallback: false,
    },
    cleanupTransform: null,
  };
}

function buildChatTurnContext({
  userText = '',
  messages = [],
  image = null,
  file = null,
  laneSelection = null,
  selectLocalLane = null,
  buildToolUserText = null,
} = {}) {
  const resolvedLaneSelection = resolveLaneSelection({
    laneSelection,
    userText,
    image,
    file,
    selectLocalLane,
  });
  const lastUserMessage = resolveLastUserMessage(messages);
  const trimmedText = String(userText || '').trim();
  const toolUserText = typeof buildToolUserText === 'function'
    ? String(buildToolUserText(trimmedText, file) || '').trim()
    : trimmedText;

  return {
    userText: trimmedText,
    toolUserText,
    lastUserMessage,
    hasImage: !!image,
    hasFile: !!file,
    laneSelection: resolvedLaneSelection,
  };
}

function buildChatRouteMeta({
  requestedMode = 'local',
  laneSelection = null,
  semanticMemoryReady = false,
  semanticMemoryMode = 'disabled',
  backend = 'local-lmstudio',
  usedFallback = false,
  laneFallback = false,
  requestedModel = '',
  resolvedModel = '',
  shadowEnabled = false,
  routingMode = 'auto',
  chatPreferredModel = null,
  toolPreferredModel = null,
  resolvedChatModel = null,
  resolvedToolModel = null,
  usedAt = '',
  now = () => Date.now(),
} = {}) {
  const resolvedLaneSelection = normalizeLaneSelection(laneSelection, {});
  return {
    selectedLane: resolvedLaneSelection.localLane,
    requestedMode,
    reason: String(resolvedLaneSelection.reason || ''),
    backend,
    usedFallback: !!usedFallback,
    laneFallback: !!(laneFallback || resolvedLaneSelection.laneFallback),
    requestedModel: String(requestedModel || resolvedLaneSelection.requestedModel || ''),
    resolvedModel: String(resolvedModel || resolvedLaneSelection.resolvedModel || ''),
    semanticMemoryReady: !!semanticMemoryReady,
    semanticMemoryMode: String(semanticMemoryMode || 'disabled'),
    usedAt: usedAt || new Date(typeof now === 'function' ? now() : Date.now()).toISOString(),
    chatPreferredModel: chatPreferredModel || null,
    toolPreferredModel: toolPreferredModel || null,
    resolvedChatModel: resolvedChatModel || null,
    resolvedToolModel: resolvedToolModel || null,
    routingMode,
    shadowEnabled: !!shadowEnabled,
  };
}

function buildStreamingRouteMeta(options = {}) {
  return buildChatRouteMeta(options);
}

function createPennyChatRuntimeApi({
  selectLocalLane = null,
  buildToolUserText = null,
  getPreferredModelForLane = null,
  now = null,
} = {}) {
  return {
    normalizeLaneSelection: (laneSelection, context) => normalizeLaneSelection(laneSelection, context),
    resolveLaneSelection: (options) => resolveLaneSelection({
      ...options,
      selectLocalLane,
    }),
    resolveLastUserMessage,
    createLaneRuntime: (localLane = 'chat') => createLaneRuntime(localLane, getPreferredModelForLane || (() => '')),
    buildChatTurnContext: (options) => buildChatTurnContext({
      ...options,
      selectLocalLane,
      buildToolUserText,
    }),
    buildChatRouteMeta: (options) => buildChatRouteMeta({
      ...options,
      now: now || (() => Date.now()),
    }),
    buildStreamingRouteMeta: (options) => buildStreamingRouteMeta({
      ...options,
      now: now || (() => Date.now()),
    }),
  };
}

module.exports = {
  normalizeLane,
  resolveLastUserMessage,
  normalizeLaneSelection,
  resolveLaneSelection,
  createLaneRuntime,
  buildChatTurnContext,
  buildChatRouteMeta,
  buildStreamingRouteMeta,
  createPennyChatRuntimeApi,
};
