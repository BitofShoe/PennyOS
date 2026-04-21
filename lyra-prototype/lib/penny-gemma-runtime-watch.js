const GEMMA_RUNTIME_WATCH_SCHEMA = 'penny-gemma-runtime-watch.v1';

const GEMMA_RUNTIME_WATCH_LIMITS = Object.freeze([
  'This watch artifact does not change LM Studio defaults.',
  'Thinking remains off for normal companion chat.',
  'Image payload policy remains current-turn-only.',
  'Large context and high vision budgets require explicit eval.',
]);

const MEASUREMENT_MODES = new Set([
  'fixture-only',
  'status-only',
  'runtime-fit',
]);

const SERVING_TRANSPORTS = new Set([
  'stateful-chat',
  'chat-completions',
  'responses',
  'unknown',
]);

const ADOPTION_STATUSES = new Set([
  'adopted',
  'not-adopted',
  'unknown',
]);

function cleanString(value = '') {
  return String(value ?? '').trim();
}

function finiteNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function boolOrNull(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function cleanStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const value = cleanString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizeMeasurementMode(value = '') {
  const mode = cleanString(value);
  return MEASUREMENT_MODES.has(mode) ? mode : 'fixture-only';
}

function normalizeServingTransport(value = '') {
  const transport = cleanString(value).toLowerCase();
  if (SERVING_TRANSPORTS.has(transport)) return transport;
  if (/^(stateful|native|native-chat)$/i.test(transport)) return 'stateful-chat';
  if (/^(chat|chat-completion|chat-completions)$/i.test(transport)) return 'chat-completions';
  if (transport === 'responses') return 'responses';
  return 'unknown';
}

function normalizeExposed(value, knobNames = [], { knownMissing = false } = {}) {
  const explicit = boolOrNull(value);
  if (explicit !== null) return explicit;
  if (knobNames.length > 0) return true;
  return knownMissing ? false : null;
}

function normalizeAdoptionStatus(value = '', fallback = 'not-adopted') {
  const status = cleanString(value).toLowerCase();
  if (ADOPTION_STATUSES.has(status)) return status;
  return ADOPTION_STATUSES.has(fallback) ? fallback : 'not-adopted';
}

function normalizeGemmaModelAlias(value = '') {
  const raw = cleanString(value).toLowerCase();
  if (!raw) return '';
  const withoutProvider = raw.split(/[\\/]/).filter(Boolean).pop() || raw;
  const withoutSuffix = withoutProvider
    .replace(/\.(?:gguf|safetensors|bin)$/i, '')
    .replace(/@.*$/i, '');
  const tokens = withoutSuffix
    .replace(/embeddinggemma/g, 'embedding-gemma')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const ignored = new Set([
    'it',
    'instruct',
    'chat',
    'gguf',
    'mlx',
    'lmstudio',
    'community',
    'q',
    'k',
    's',
    'm',
    'l',
  ]);
  return tokens
    .filter((token) => {
      if (ignored.has(token)) return false;
      if (/^q\d+[a-z0-9]*$/.test(token)) return false;
      if (/^(?:fp|bf|f|int)\d+$/.test(token)) return false;
      if (/^\d+$/.test(token) && tokens.some((candidate) => /^q\d+/i.test(candidate))) return false;
      return true;
    })
    .join('-');
}

function gemmaModelsCompatible(a = '', b = '') {
  const left = normalizeGemmaModelAlias(a);
  const right = normalizeGemmaModelAlias(b);
  return !!(left && right && left === right);
}

function buildLoadedModelIdentity({ requested = '', resolved = '', exactMatch = null, compatibleMatch = null } = {}) {
  const requestedModel = cleanString(requested);
  const resolvedModel = cleanString(resolved);
  const exact = boolOrNull(exactMatch);
  const compatible = boolOrNull(compatibleMatch);
  const computedExact = !!(requestedModel && resolvedModel && requestedModel === resolvedModel);
  const computedCompatible = computedExact || gemmaModelsCompatible(requestedModel, resolvedModel);
  return {
    requested: requestedModel,
    resolved: resolvedModel,
    exactMatch: exact ?? computedExact,
    compatibleMatch: compatible ?? computedCompatible,
  };
}

function normalizeChatSampling(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    temperature: finiteNumberOrNull(raw.temperature),
    topP: finiteNumberOrNull(raw.topP ?? raw.top_p),
    topK: finiteNumberOrNull(raw.topK ?? raw.top_k),
  };
}

function buildGemmaRuntimeWatchArtifact({
  generatedAt = new Date().toISOString(),
  measurementMode = 'fixture-only',
  servingPath = {},
  transport = '',
  status = {},
  requestedModel = '',
  resolvedModel = '',
  watchItems = {},
  visionBudget = {},
  imagePolicy = {},
  thinkingControls = {},
  promptCacheRamRisk = {},
  loadedModelIdentity = {},
  chatSampling = null,
} = {}) {
  const safeStatus = status && typeof status === 'object' ? status : {};
  const safeServingPath = servingPath && typeof servingPath === 'object' ? servingPath : {};
  const safeWatchItems = watchItems && typeof watchItems === 'object' ? watchItems : {};
  const visionInput = {
    ...(safeWatchItems.visionBudget && typeof safeWatchItems.visionBudget === 'object' ? safeWatchItems.visionBudget : {}),
    ...(visionBudget && typeof visionBudget === 'object' ? visionBudget : {}),
  };
  const imageInput = {
    ...(safeWatchItems.currentTurnImageOnly && typeof safeWatchItems.currentTurnImageOnly === 'object'
      ? { currentTurnImageOnly: safeWatchItems.currentTurnImageOnly.observed }
      : {}),
    ...(safeWatchItems.imagePartBeforeText && typeof safeWatchItems.imagePartBeforeText === 'object'
      ? { imagePartBeforeText: safeWatchItems.imagePartBeforeText.observed }
      : {}),
    ...(imagePolicy && typeof imagePolicy === 'object' ? imagePolicy : {}),
  };
  const thinkingInput = {
    ...(safeWatchItems.thinkingControls && typeof safeWatchItems.thinkingControls === 'object' ? safeWatchItems.thinkingControls : {}),
    ...(thinkingControls && typeof thinkingControls === 'object' ? thinkingControls : {}),
  };
  const promptCacheInput = {
    ...(safeWatchItems.promptCacheRamRisk && typeof safeWatchItems.promptCacheRamRisk === 'object' ? safeWatchItems.promptCacheRamRisk : {}),
    ...(promptCacheRamRisk && typeof promptCacheRamRisk === 'object' ? promptCacheRamRisk : {}),
  };
  const identityInput = {
    requested: cleanString(loadedModelIdentity?.requested)
      || cleanString(requestedModel)
      || cleanString(safeStatus.chatPreferredModel)
      || cleanString(safeStatus.configuredChatModel)
      || cleanString(safeStatus.configuredModel),
    resolved: cleanString(loadedModelIdentity?.resolved)
      || cleanString(resolvedModel)
      || cleanString(safeStatus.resolvedChatModel)
      || cleanString(safeStatus.resolvedModel),
    exactMatch: loadedModelIdentity?.exactMatch,
    compatibleMatch: loadedModelIdentity?.compatibleMatch,
  };
  const visionKnobNames = cleanStringArray(visionInput.knobNames);
  const visionKnownMissing = Object.prototype.hasOwnProperty.call(visionInput, 'knobNames') && visionKnobNames.length === 0;
  const contextLength = finiteNumberOrNull(promptCacheInput.contextLength);
  const normalizedWatchItems = {
    visionBudget: {
      exposed: normalizeExposed(visionInput.exposed, visionKnobNames, { knownMissing: visionKnownMissing }),
      adoptionStatus: normalizeAdoptionStatus(visionInput.adoptionStatus),
      knobNames: visionKnobNames,
      notes: cleanString(visionInput.notes),
    },
    currentTurnImageOnly: {
      expected: true,
      observed: boolOrNull(imageInput.currentTurnImageOnly ?? imageInput.observed),
    },
    imagePartBeforeText: {
      expected: true,
      observed: boolOrNull(imageInput.imagePartBeforeText),
    },
    thinkingControls: {
      exposed: boolOrNull(thinkingInput.exposed),
      defaultForCompanionChat: 'off',
      notes: cleanString(thinkingInput.notes),
    },
    promptCacheRamRisk: {
      status: 'watch',
      contextLength: contextLength === null ? null : Math.max(0, Math.round(contextLength)),
      notes: cleanString(promptCacheInput.notes),
    },
    loadedModelIdentity: buildLoadedModelIdentity(identityInput),
    chatSampling: normalizeChatSampling(chatSampling || safeWatchItems.chatSampling || {}),
  };

  return {
    schema: GEMMA_RUNTIME_WATCH_SCHEMA,
    generatedAt: cleanString(generatedAt) || new Date().toISOString(),
    measurementMode: normalizeMeasurementMode(measurementMode),
    liveModelCalls: false,
    behaviorChanged: false,

    modelFamily: 'gemma-4',
    servingPath: {
      provider: 'lmstudio',
      transport: normalizeServingTransport(transport || safeServingPath.transport || safeStatus.localTransport),
      openAiCompatible: true,
    },

    knownRuntimeWatchItems: Object.keys(normalizedWatchItems),
    defaultsUnchanged: {
      lmStudioDefaults: true,
      companionThinkingDefault: 'off',
      imagePayloadPolicy: 'current-turn-only',
      contextLengthChanged: false,
      chatSamplingChanged: false,
      memoryFilesTouched: false,
    },
    watchItems: normalizedWatchItems,

    limits: GEMMA_RUNTIME_WATCH_LIMITS.slice(),
  };
}

module.exports = {
  GEMMA_RUNTIME_WATCH_SCHEMA,
  GEMMA_RUNTIME_WATCH_LIMITS,
  buildGemmaRuntimeWatchArtifact,
  gemmaModelsCompatible,
  normalizeGemmaModelAlias,
  normalizeServingTransport,
};
