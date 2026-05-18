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

export function formatLastLane(meta = null) {
  if (!meta || !meta.localLane) return 'pending';
  const lane = meta.localLane === 'tool' ? 'tool lane' : 'chat lane';
  const suffix = meta.laneFallback ? ' (fallback)' : '';
  return `${lane}${suffix}`;
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
