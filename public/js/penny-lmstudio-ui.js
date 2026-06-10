export function fillModelSelectOptions(selectEl, modelIds, selectedId) {
  selectEl.innerHTML = '';
  for (const id of modelIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (id === selectedId) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function isEmbeddingLikeModelId(value = '') {
  return /\b(embed|embedding|rerank)\b/i.test(String(value || '').trim());
}

function selectableModelIdsFromStatus(lmStudio = {}, {
  lane = 'chat',
} = {}) {
  const preferredKey = lane === 'tool' ? 'toolPreferredModel' : 'chatPreferredModel';
  const runtimeKey = lane === 'tool' ? 'runtimePreferredToolModel' : 'runtimePreferredChatModel';
  const resolvedKey = lane === 'tool' ? 'resolvedToolModel' : 'resolvedChatModel';
  const candidateKey = lane === 'tool' ? 'toolCandidateModels' : 'candidateModels';
  return mergeDistinctModelIds(
    (lmStudio.availableModels || []).filter(id => !isEmbeddingLikeModelId(id)),
    (lmStudio.installedModels || []).filter(id => !isEmbeddingLikeModelId(id)),
    (lmStudio[candidateKey] || []).filter(id => !isEmbeddingLikeModelId(id)),
    [lmStudio[runtimeKey], lmStudio[resolvedKey], lmStudio[preferredKey], lmStudio.configuredModel, lmStudio.configuredChatModel, lmStudio.configuredToolModel]
      .filter(id => id && !isEmbeddingLikeModelId(id)),
  );
}

function normalizeModelPickKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tokenizeModelPickId(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return { full: [], short: [] };
  const splitTokens = raw
    .replace(/@/g, '-')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const full = [];
  for (let i = 0; i < splitTokens.length; i += 1) {
    const token = splitTokens[i];
    const next = splitTokens[i + 1] || '';
    if (/^q\d+$/.test(token) && /^[a-z0-9]{1,2}$/.test(next)) {
      full.push(`${token}${next}`);
      i += 1;
      continue;
    }
    full.push(token);
  }
  const slashIndex = raw.indexOf('/');
  const short = slashIndex >= 0
    ? tokenizeModelPickId(raw.slice(slashIndex + 1)).full
    : full.slice();
  return { full, short };
}

function isQuantizationPickToken(token = '') {
  return /^(ud|xs|s|m|l|xl|q\d+[a-z0-9]*|fp\d+|bf\d+|f\d+|gguf|mlx|int\d+|qat)$/.test(String(token || '').toLowerCase());
}

function modelPickTokensEquivalent(leftTokens = [], rightTokens = []) {
  if (!leftTokens.length || !rightTokens.length) return false;
  if (leftTokens.length === rightTokens.length) {
    return leftTokens.every((token, index) => token === rightTokens[index]);
  }
  const longer = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;
  const shorter = longer === leftTokens ? rightTokens : leftTokens;
  if (!shorter.every((token, index) => token === longer[index])) return false;
  const extra = longer.slice(shorter.length);
  return extra.length > 0 && extra.every(isQuantizationPickToken);
}

function modelIdsLookEquivalent(a = '', b = '') {
  const left = tokenizeModelPickId(a);
  const right = tokenizeModelPickId(b);
  const pairs = [
    [left.full, right.full],
    [left.full, right.short],
    [left.short, right.full],
    [left.short, right.short],
  ];
  return pairs.some(([leftTokens, rightTokens]) => modelPickTokensEquivalent(leftTokens, rightTokens));
}

export function mergeDistinctModelIds(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const rawId of list || []) {
      const id = String(rawId || '').trim();
      const key = normalizeModelPickKey(id);
      if (!id || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(id);
    }
  }
  return out;
}

export function findBestModelMatch(modelIds, ...preferredIds) {
  for (const preferredId of preferredIds) {
    const target = String(preferredId || '').trim();
    if (!target) continue;
    const direct = modelIds.find(id => id === target);
    if (direct) return direct;
    const alias = modelIds.find(id => modelIdsLookEquivalent(id, target));
    if (alias) return alias;
  }
  return '';
}

function localRuntimeLabelFromStatus(status = null, lmStudio = {}) {
  const explicit = String(status?.localRuntimeLabel || lmStudio?.localRuntimeLabel || '').trim();
  if (explicit) return explicit;
  const backend = String(status?.localLlmBackend || lmStudio?.localLlmBackend || '').trim().toLowerCase();
  if (backend === 'llama_cpp' || backend === 'llamacpp') return 'llama.cpp';
  if (backend === 'openai_compatible' || backend === 'generic_openai') return 'OpenAI-compatible local runtime';
  return 'LM Studio';
}

export function formatLastLane(meta = null) {
  if (!meta || !meta.localLane) return 'pending';
  const lane = meta.localLane === 'tool' ? 'tool lane' : 'chat lane';
  const suffix = meta.laneFallback ? ' (fallback)' : '';
  return `${lane}${suffix}`;
}

export function buildFirstRunModelSetupViewModel(status = null) {
  const lmStudio = status?.lmStudio || status || {};
  const localRuntimeLabel = localRuntimeLabelFromStatus(status, lmStudio);
  const localLlmBackend = String(status?.localLlmBackend || lmStudio.localLlmBackend || 'lm_studio').trim() || 'lm_studio';
  const localEndpointBase = String(status?.localEndpointBase || lmStudio.localEndpointBase || lmStudio.base || '').trim();
  const readiness = status?.readiness || lmStudio.readiness || {};
  const semantic = status?.semanticMemory || lmStudio.semanticMemory || {};
  const reachable = lmStudio.reachable === true;
  const chatReady = reachable && !!String(lmStudio.resolvedChatModel || lmStudio.resolvedModel || '').trim();
  const toolReady = reachable && !!String(lmStudio.resolvedToolModel || '').trim();
  const fallbackEnabled = lmStudio.modelFallbackDisabled !== true;
  const chatModels = selectableModelIdsFromStatus(lmStudio, { lane: 'chat' });
  const toolModels = selectableModelIdsFromStatus(lmStudio, { lane: 'tool' });
  const configuredEmbed = String(semantic.configuredModel || lmStudio.embedPreferredModel || '').trim();
  const semanticReady = semantic.ready === true;
  const severity = !reachable
    ? 'offline'
    : (chatReady && toolReady ? 'ready' : 'needs-setup');
  const visible = severity !== 'ready';
  const statusText = !reachable
    ? `${localRuntimeLabel} is offline or not serving Penny yet.`
    : (chatReady && toolReady
      ? 'Local brain ready. Chat and tool lanes have models.'
      : `${localRuntimeLabel} is reachable; Penny needs model lanes picked or loaded.`);
  const laneHints = [];
  if (!chatReady) laneHints.push(`load one in ${localRuntimeLabel}, then pick a chat model here`);
  if (!toolReady) laneHints.push('pick a tool model for file/project work');
  const rawHint = String(lmStudio.error || lmStudio.hint || '').trim();
  const hintText = laneHints.length
    ? `${rawHint ? `${rawHint} ` : ''}${laneHints.join('; ')}.`
    : (rawHint || 'You can swap lanes here without editing .env.');
  const embeddingText = semanticReady
    ? `Semantic memory ready${configuredEmbed ? ` on ${configuredEmbed}` : ''}${semantic.mode ? ` (${semantic.mode})` : ''}.`
    : `Embeddings are optional; Penny can run with keyword fallback${configuredEmbed ? ` while ${configuredEmbed} is missing or unloaded` : ''}.`;

  return {
    visible,
    severity,
    reachable,
    chatReady,
    toolReady,
    fallbackEnabled,
    localLlmBackend,
    localRuntimeLabel,
    localEndpointBase,
    statusText,
    hintText,
    embeddingText,
    chatModels,
    toolModels,
    selectedChatModel: findBestModelMatch(chatModels, lmStudio.resolvedChatModel, lmStudio.resolvedModel, lmStudio.runtimePreferredChatModel, lmStudio.runtimePreferredModel, lmStudio.chatPreferredModel, lmStudio.configuredChatModel, lmStudio.configuredModel)
      || chatModels[0]
      || '',
    selectedToolModel: findBestModelMatch(toolModels, lmStudio.resolvedToolModel, lmStudio.runtimePreferredToolModel, lmStudio.toolPreferredModel, lmStudio.configuredToolModel)
      || toolModels[0]
      || '',
  };
}

export function updateModelSetupUi({ els, status = null } = {}) {
  const viewModel = buildFirstRunModelSetupViewModel(status);
  if (els?.modelSetupPanel) {
    els.modelSetupPanel.hidden = false;
    els.modelSetupPanel.dataset.severity = viewModel.severity;
    els.modelSetupPanel.className = `setup-card setup-${viewModel.severity}`;
  }
  if (els?.modelSetupStatus) els.modelSetupStatus.textContent = viewModel.statusText;
  if (els?.modelSetupHint) els.modelSetupHint.textContent = viewModel.hintText;
  if (els?.modelSetupEmbedding) els.modelSetupEmbedding.textContent = viewModel.embeddingText;
  if (els?.modelSetupFallback) els.modelSetupFallback.checked = viewModel.fallbackEnabled;
  return viewModel;
}

function formatCacheAge(cacheAgeMs = 0) {
  const seconds = Math.max(0, Math.round(Number(cacheAgeMs || 0) / 1000));
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m old`;
}

export function updateBackendStatusUi({ els, state, status = null } = {}) {
  if (state) state.backendStatus = status;
  if (!els?.backendReachability || !els?.backendModel) return;

  const lmStudio = status?.lmStudio || status;
  if (!lmStudio) {
    els.backendReachability.textContent = 'unknown';
    els.backendModel.textContent = 'pending';
    if (els.backendToolModel) els.backendToolModel.textContent = 'pending';
    if (els.backendWebReading) els.backendWebReading.textContent = 'pending';
    return;
  }

  if (els.backendWebReading) {
    els.backendWebReading.textContent = status?.webSearchEnabled === true ? 'on' : 'off';
  }

  if (lmStudio.reachable) {
    const readiness = status?.readiness || lmStudio.readiness || null;
    const warmBits = [];
    if (status?.localLlmTransport) warmBits.push(status.localLlmTransport);
    if (readiness?.warmState) warmBits.push(readiness.warmState);
    if (Number.isFinite(Number(readiness?.cacheAgeMs))) warmBits.push(formatCacheAge(readiness.cacheAgeMs));
    els.backendReachability.textContent = warmBits.length
      ? `ready / ${warmBits.join(' / ')}`
      : 'ready';
    const chatPick = lmStudio.resolvedChatModel || lmStudio.resolvedModel || lmStudio.chatPreferredModel || lmStudio.configuredModel || 'available';
    const toolPick = lmStudio.resolvedToolModel || lmStudio.toolPreferredModel || lmStudio.configuredToolModel || 'available';
    const chatHint = !lmStudio.resolvedChatModel && lmStudio.chatPreferredModel ? ' (preferred)' : '';
    const toolHint = !lmStudio.resolvedToolModel && lmStudio.toolPreferredModel ? ' (preferred)' : '';
    els.backendModel.textContent = `${chatPick}${chatHint}`;
    if (els.backendToolModel) els.backendToolModel.textContent = `${toolPick}${toolHint}`;
    return;
  }

  const readiness = status?.readiness || lmStudio.readiness || null;
  els.backendReachability.textContent = readiness?.warmState === 'cold' ? 'offline / cold' : 'offline';
  els.backendModel.textContent = lmStudio.error || lmStudio.hint || 'not detected';
  if (els.backendToolModel) els.backendToolModel.textContent = lmStudio.toolPreferredModel || 'pending';
}
