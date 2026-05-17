const {
  buildGemmaRuntimeWatchArtifact,
} = require('./penny-gemma-runtime-watch');

function createLmStudioStatusApi({
  fetch,
  fs,
  execFileText,
  URL,
  LMSTUDIO_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_SETTINGS_FILE,
  LMSTUDIO_STATUS_CACHE_MS,
  LMSTUDIO_STATUS_ERROR_CACHE_MS,
  LMSTUDIO_MODELS_PROBE_MS,
  LOCAL_LLM_TRANSPORT,
  PENNY_LMSTUDIO_CHAT_MODEL,
  PENNY_LMSTUDIO_TOOL_MODEL,
  PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL = '',
  PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK = false,
} = {}) {
  if (typeof fetch !== 'function') throw new TypeError('createLmStudioStatusApi requires fetch');
  if (!fs || typeof fs.existsSync !== 'function' || typeof fs.readFileSync !== 'function') {
    throw new TypeError('createLmStudioStatusApi requires fs');
  }
  if (typeof execFileText !== 'function') throw new TypeError('createLmStudioStatusApi requires execFileText');
  if (!URL) throw new TypeError('createLmStudioStatusApi requires URL');

  const CHAT_FALLBACK_MODEL = 'google/gemma-4-31b';
  const TOOL_FALLBACK_MODEL = 'google/gemma-4-e4b';
  const chatConfiguredModel = String(PENNY_LMSTUDIO_CHAT_MODEL || '').trim() || CHAT_FALLBACK_MODEL;
  const toolConfiguredModel = String(PENNY_LMSTUDIO_TOOL_MODEL || '').trim() || TOOL_FALLBACK_MODEL;
  const modelFallbackDisabled = PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK === true
    || ['1', 'true', 'yes', 'on'].includes(String(PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK || '').trim().toLowerCase());

  let lmStudioStatusCache = { expiresAt: 0, value: null };
  let runtimePreferredChatModel = String(PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL || '').trim();

  function readLmStudioDesktopSettings() {
    try {
      if (!LMSTUDIO_SETTINGS_FILE || !fs.existsSync(LMSTUDIO_SETTINGS_FILE)) return null;
      const parsed = JSON.parse(fs.readFileSync(LMSTUDIO_SETTINGS_FILE, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function normalizeLmStudioModelEntries(parsed) {
    if (!parsed || typeof parsed !== 'object') return [];
    let rows = parsed.data;
    if (!Array.isArray(rows) && Array.isArray(parsed.models)) rows = parsed.models;
    if (!Array.isArray(rows)) return [];
    const seen = new Set();
    const out = [];
    for (const item of rows) {
      let id = '';
      if (typeof item === 'string') id = item.trim();
      else if (item && typeof item === 'object') {
        const raw = item.id ?? item.model ?? item.name;
        id = typeof raw === 'string' ? raw.trim() : '';
      }
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id });
    }
    return out;
  }

  function normalizeModelKey(value = '') {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function isEmbeddingLikeModelId(value = '') {
    return /\b(embed|embedding|rerank)\b/i.test(String(value || '').trim());
  }

  function tokenizeModelAlias(value = '') {
    const raw = String(value || '').trim().toLowerCase().replace(/embeddinggemma/g, 'embedding-gemma');
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
      ? tokenizeModelAlias(raw.slice(slashIndex + 1)).full
      : full.slice();
    return { full, short };
  }

  function isQuantizationToken(token = '') {
    return /^(ud|xs|s|m|l|xl|q\d+[a-z0-9]*|fp\d+|bf\d+|f\d+|gguf|mlx|int\d+|qat)$/.test(String(token || '').toLowerCase());
  }

  function modelTokenArraysEquivalent(leftTokens = [], rightTokens = []) {
    if (!leftTokens.length || !rightTokens.length) return false;
    if (leftTokens.length === rightTokens.length) {
      return leftTokens.every((token, index) => token === rightTokens[index]);
    }
    const longer = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;
    const shorter = longer === leftTokens ? rightTokens : leftTokens;
    if (!shorter.every((token, index) => token === longer[index])) return false;
    const extra = longer.slice(shorter.length);
    return extra.length > 0 && extra.every(isQuantizationToken);
  }

  function modelsLookEquivalent(a = '', b = '') {
    const left = tokenizeModelAlias(a);
    const right = tokenizeModelAlias(b);
    const aliasPairs = [
      [left.full, right.full],
      [left.full, right.short],
      [left.short, right.full],
      [left.short, right.short],
    ];
    for (const [leftTokens, rightTokens] of aliasPairs) {
      if (modelTokenArraysEquivalent(leftTokens, rightTokens)) return true;
    }
    return false;
  }

  function mergeUniqueModelIds(...lists) {
    const out = [];
    const seen = new Set();
    for (const list of lists) {
      for (const rawId of list || []) {
        const id = String(rawId || '').trim();
        if (!id) continue;
        const key = normalizeModelKey(id);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(id);
      }
    }
    return out;
  }

  function getPreferredModelForLane(lane = 'chat') {
    if (lane === 'tool') {
      return modelFallbackDisabled && runtimePreferredChatModel
        ? runtimePreferredChatModel
        : toolConfiguredModel;
    }
    return runtimePreferredChatModel || chatConfiguredModel;
  }

  function rankLmStudioModel(model = {}, preferredKey = '', runtimeKey = '') {
    const id = String(model?.id || '');
    if (!id) return -1000;

    const key = normalizeModelKey(id);
    let score = 0;
    if (runtimeKey && (key === runtimeKey || key.includes(runtimeKey) || runtimeKey.includes(key))) score += 1000;
    if (preferredKey && key === preferredKey) score += id.includes('/') ? 320 : 420;
    else if (preferredKey && (key.includes(preferredKey) || preferredKey.includes(key))) score += 260;
    if (id.includes('@')) score += 40;
    if (!id.includes('/')) score += 60;
    if (/\b(instruct|chat|assistant|it)\b/i.test(id)) score += 40;
    if (/\b(embed|embedding|rerank)\b/i.test(id)) score -= 400;
    return score;
  }

  function sortLmStudioModelCandidates(models = [], { preferredModel = '', runtimeModel = '' } = {}) {
    const preferredKey = normalizeModelKey(preferredModel);
    const runtimeKey = normalizeModelKey(runtimeModel);
    return models
      .filter(model => typeof model?.id === 'string' && model.id.trim())
      .slice()
      .sort(
        (a, b) => rankLmStudioModel(b, preferredKey, runtimeKey) - rankLmStudioModel(a, preferredKey, runtimeKey)
          || String(a.id).localeCompare(String(b.id)),
      );
  }

  function normalizeLmStudioInstalledModelEntries(parsed) {
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    const pushId = (rawId) => {
      const id = String(rawId || '').trim();
      if (!id) return;
      const key = normalizeModelKey(id);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ id });
    };
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const type = String(item.type || '').toLowerCase().trim();
      if (type && !/^(llm|embedding|rerank)$/.test(type)) continue;
      const selectedVariant = typeof item.selectedVariant === 'string' ? item.selectedVariant.trim() : '';
      const modelKey = typeof item.modelKey === 'string' ? item.modelKey.trim() : '';
      const variants = Array.isArray(item.variants)
        ? item.variants.map((variant) => String(variant || '').trim()).filter(Boolean)
        : [];
      if (selectedVariant) pushId(selectedVariant);
      for (const variant of variants) pushId(variant);
      if (!variants.length && modelKey) pushId(modelKey);
    }
    return out;
  }

  function normalizeLmStudioLoadedModelEntries(parsed) {
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const state = String(item.state || item.status || '').toLowerCase();
      if (state && !/\bloaded|ready|running|active|idle\b/i.test(state)) continue;
      const rawId = item.modelKey || item.model || item.identifier || item.id || item.name || item.path;
      const id = String(rawId || '').trim();
      if (!id) continue;
      const key = normalizeModelKey(id);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ id });
    }
    return out;
  }

  async function getInstalledLmStudioModels() {
    try {
      const { stdout } = await execFileText('lms', ['ls', '--json'], { timeout: 15000 });
      const parsed = stdout ? JSON.parse(stdout) : [];
      return normalizeLmStudioInstalledModelEntries(parsed).map(item => item.id);
    } catch {
      return [];
    }
  }

  async function getLoadedLmStudioModels() {
    try {
      const { stdout } = await execFileText('lms', ['ps', '--json'], { timeout: 15000 });
      const parsed = stdout ? JSON.parse(stdout) : [];
      return normalizeLmStudioLoadedModelEntries(parsed).map(item => item.id);
    } catch {
      return [];
    }
  }

  function buildLmStudioLaunchHint() {
    const settings = readLmStudioDesktopSettings();
    const parts = [];
    if (settings?.enableLocalService === false) {
      parts.push('LM Studio local server is disabled in the desktop app.');
    }
    parts.push(`Expected the OpenAI-compatible API at ${LMSTUDIO_BASE}.`);
    parts.push('In LM Studio, start the local server and keep at least one chat model loaded.');
    return parts.join(' ');
  }

  function buildLaneCandidates(models = [], preferredModel = '', runtimeModel = '') {
    return sortLmStudioModelCandidates(models, { preferredModel, runtimeModel }).map(item => item.id);
  }

  function buildStrictLaneCandidates(models = [], preferredModel = '', runtimeModel = '') {
    const preferred = String(preferredModel || '').trim();
    if (!preferred) return [];
    return buildLaneCandidates(
      models.filter(item => modelsLookEquivalent(item?.id, preferred)),
      preferred,
      runtimeModel,
    );
  }

  function trimIso(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  }

  function buildProbeState({
    startedAt = '',
    finishedAt = '',
    durationMs = 0,
    cacheHit = false,
    expiresAt = 0,
    note = '',
  } = {}) {
    const safeStartedAt = trimIso(startedAt);
    const safeFinishedAt = trimIso(finishedAt || startedAt);
    const checkedAt = safeFinishedAt || safeStartedAt;
    const checkedAtMs = checkedAt ? Date.parse(checkedAt) : 0;
    return {
      startedAt: safeStartedAt,
      finishedAt: safeFinishedAt,
      checkedAt,
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      cacheHit: cacheHit === true,
      cacheAgeMs: checkedAtMs ? Math.max(0, Date.now() - checkedAtMs) : 0,
      cacheExpiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? new Date(expiresAt).toISOString() : '',
      note: String(note || '').trim(),
    };
  }

  function decorateStatusWithProbe(value = {}, {
    startedAt = '',
    finishedAt = '',
    durationMs = 0,
    cacheHit = false,
    expiresAt = 0,
    note = '',
  } = {}) {
    return {
      ...(value && typeof value === 'object' ? value : {}),
      probe: buildProbeState({
        startedAt,
        finishedAt,
        durationMs,
        cacheHit,
        expiresAt,
        note: note || value?.error || value?.hint || '',
      }),
    };
  }

  async function getLmStudioConnectionStatus({ force = false } = {}) {
    const now = Date.now();
    if (!force && lmStudioStatusCache.value && now < lmStudioStatusCache.expiresAt) {
      return decorateStatusWithProbe(lmStudioStatusCache.value, {
        ...(lmStudioStatusCache.value?.probe || {}),
        cacheHit: true,
        expiresAt: lmStudioStatusCache.expiresAt,
      });
    }

    const probeStartedAt = new Date(now).toISOString();
    const settings = readLmStudioDesktopSettings();
    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(LMSTUDIO_MODELS_PROBE_MS, 2000), 120000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let value;
    const installedModels = await getInstalledLmStudioModels();
    const loadedModels = await getLoadedLmStudioModels();

    try {
      const response = await fetch(`${LMSTUDIO_BASE}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
        },
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const err = new Error(`LM Studio models error ${response.status}: ${bodyText}`);
        err.statusCode = response.status;
        throw err;
      }

      let parsed;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        throw new Error(`LM Studio models: invalid JSON: ${bodyText.slice(0, 400)}`);
      }

      const runtimeModels = normalizeLmStudioModelEntries(parsed);
      const runtimeModelIds = runtimeModels.map(item => item.id);
      const loadedModelEntries = loadedModels.map(id => ({ id }));
      const runtimeLaneModels = runtimeModels.filter(item => !isEmbeddingLikeModelId(item?.id));
      const loadedLaneModelEntries = loadedModelEntries.filter(item => !isEmbeddingLikeModelId(item?.id));
      const chatPreferredModel = getPreferredModelForLane('chat');
      const toolPreferredModel = getPreferredModelForLane('tool');
      const fallbackModels = [];
      if (!modelFallbackDisabled) {
        for (const fallbackId of [chatPreferredModel, toolPreferredModel]) {
          const id = String(fallbackId || '').trim();
          if (!id) continue;
          if (loadedLaneModelEntries.some(item => modelsLookEquivalent(item.id, id))) continue;
          if (runtimeLaneModels.some(item => modelsLookEquivalent(item.id, id))) continue;
          if (fallbackModels.some(item => modelsLookEquivalent(item.id, id))) continue;
          fallbackModels.push({ id });
        }
      }

      const selectableLoadedModels = buildLaneCandidates(loadedLaneModelEntries, chatPreferredModel, runtimePreferredChatModel);
      const selectableRuntimeModels = runtimeLaneModels.map(item => item.id);
      const availableModels = mergeUniqueModelIds(selectableLoadedModels, selectableRuntimeModels);

      let candidateModels;
      let toolCandidateModels;
      if (modelFallbackDisabled) {
        candidateModels = buildStrictLaneCandidates(
          [...loadedLaneModelEntries, ...runtimeLaneModels],
          chatPreferredModel,
          runtimePreferredChatModel,
        );
        toolCandidateModels = buildStrictLaneCandidates(
          [...loadedLaneModelEntries, ...runtimeLaneModels],
          toolPreferredModel,
          '',
        );
      } else {
        const loadedChatCandidates = buildLaneCandidates(loadedLaneModelEntries, chatPreferredModel, runtimePreferredChatModel);
        const runtimeChatCandidates = buildLaneCandidates(runtimeLaneModels, chatPreferredModel, runtimePreferredChatModel);
        const loadedToolCandidates = buildLaneCandidates(loadedLaneModelEntries, toolPreferredModel, '');
        const runtimeToolCandidates = buildLaneCandidates(runtimeLaneModels, toolPreferredModel, '');
        candidateModels = loadedChatCandidates.length
          ? loadedChatCandidates
          : runtimeChatCandidates;
        toolCandidateModels = loadedToolCandidates.length
          ? loadedToolCandidates
          : runtimeToolCandidates;
      }

      const resolvedChatModel = candidateModels[0] || '';
      const resolvedToolModel = toolCandidateModels[0] || '';
      const strictChatHint = modelFallbackDisabled && chatPreferredModel && !resolvedChatModel
        ? `Chat model ${chatPreferredModel} is not currently exposed by ${LMSTUDIO_BASE}; model fallback is disabled.`
        : '';

      value = {
        ok: true,
        reachable: true,
        base: LMSTUDIO_BASE,
        configuredModel: chatConfiguredModel,
        configuredChatModel: chatConfiguredModel,
        configuredToolModel: toolConfiguredModel,
        chatPreferredModel,
        toolPreferredModel,
        runtimePreferredModel: runtimePreferredChatModel || null,
        resolvedModel: resolvedChatModel,
        resolvedChatModel,
        resolvedToolModel,
        candidateModels,
        toolCandidateModels,
        availableModels,
        loadedModels,
        nativeAvailableModels: runtimeModelIds,
        installedModels: mergeUniqueModelIds(availableModels, installedModels, runtimeModelIds),
        desktopLocalServiceEnabled: settings?.enableLocalService ?? null,
        hint: resolvedChatModel ? '' : (strictChatHint || 'LM Studio is reachable, but no usable chat model is currently loaded.'),
        error: '',
        localTransport: LOCAL_LLM_TRANSPORT,
        routingMode: modelFallbackDisabled ? 'strict' : 'auto',
        modelFallbackDisabled,
      };
    } catch (error) {
      const rawMsg = String(error?.message || 'LM Studio is unreachable.');
      let detail = error?.name === 'AbortError'
        ? `LM Studio models request timed out after ${timeoutMs}ms`
        : rawMsg;
      if (settings?.enableLocalService === false) {
        detail = 'LM Studio local server is off in the desktop app. Open LM Studio, turn on the local API / dev server, then refresh Settings here.';
      } else {
        const code = error?.cause?.code || error?.code;
        if (code === 'ECONNREFUSED' || /\bfetch failed\b/i.test(rawMsg)) {
          detail = `Cannot reach ${LMSTUDIO_BASE} (${rawMsg}). Start LM Studio's local server and load a chat model, or set PENNY_LMSTUDIO_BASE if the port changed.`;
        }
      }
      value = {
        ok: false,
        reachable: false,
        base: LMSTUDIO_BASE,
        configuredModel: chatConfiguredModel,
        configuredChatModel: chatConfiguredModel,
        configuredToolModel: toolConfiguredModel,
        chatPreferredModel: getPreferredModelForLane('chat'),
        toolPreferredModel: getPreferredModelForLane('tool'),
        runtimePreferredModel: runtimePreferredChatModel || null,
        resolvedModel: '',
        resolvedChatModel: '',
        resolvedToolModel: '',
        candidateModels: [],
        toolCandidateModels: [],
        availableModels: [],
        loadedModels,
        nativeAvailableModels: [],
        installedModels,
        desktopLocalServiceEnabled: settings?.enableLocalService ?? null,
        hint: buildLmStudioLaunchHint(),
        error: detail,
        localTransport: LOCAL_LLM_TRANSPORT,
        routingMode: modelFallbackDisabled ? 'strict' : 'auto',
        modelFallbackDisabled,
      };
    } finally {
      clearTimeout(timer);
    }

    value.gemmaRuntimeWatch = buildStatusGemmaRuntimeWatch(value);

    const cacheMs = value.reachable && (value.resolvedChatModel || value.resolvedToolModel)
      ? LMSTUDIO_STATUS_CACHE_MS
      : LMSTUDIO_STATUS_ERROR_CACHE_MS;
    const probeFinishedAt = new Date().toISOString();
    const cachedValue = decorateStatusWithProbe(value, {
      startedAt: probeStartedAt,
      finishedAt: probeFinishedAt,
      durationMs: Date.parse(probeFinishedAt) - now,
      cacheHit: false,
      expiresAt: now + cacheMs,
    });

    lmStudioStatusCache = {
      expiresAt: now + cacheMs,
      value: cachedValue,
    };
    return cachedValue;
  }

  function isMissingLmStudioModelError(error) {
    const message = String(error?.message || '');
    return /\b(model does not exist|model .*not found|unknown model|no such model)\b/i.test(message);
  }

  function resolveLaneCandidates(status = {}, lane = 'chat') {
    if (lane === 'tool') {
      const candidates = Array.isArray(status.toolCandidateModels) ? status.toolCandidateModels : [];
      if (candidates.length) return candidates;
      if (modelFallbackDisabled) return [];
      return [getPreferredModelForLane('tool')].filter(Boolean);
    }
    const candidates = Array.isArray(status.candidateModels) ? status.candidateModels : [];
    if (candidates.length) return candidates;
    if (modelFallbackDisabled) return [];
    return [getPreferredModelForLane('chat')].filter(Boolean);
  }

  function shouldRefreshCachedLaneStatus(status = {}, lane = 'chat', preferredModel = '') {
    if (status?.probe?.cacheHit !== true) return false;
    const preferred = String(preferredModel || '').trim();
    if (!preferred) return false;
    const candidates = resolveLaneCandidates(status, lane);
    if (!candidates.length) return true;
    return !candidates.some(candidate => modelsLookEquivalent(candidate, preferred));
  }

  async function withLmStudioLaneModel(lane = 'chat', runForModel, runtime = null) {
    let resolutionStartedAt = Date.now();
    let status = await getLmStudioConnectionStatus();
    let refreshedAfterMissingModel = false;
    let refreshedAfterCachedLaneMiss = false;

    if (runtime && typeof runtime === 'object') {
      runtime.performance = runtime.performance && typeof runtime.performance === 'object'
        ? runtime.performance
        : {};
      runtime.performance.modelResolution = {
        startedAt: new Date(resolutionStartedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - resolutionStartedAt),
        available: true,
        cacheHit: status?.probe?.cacheHit === true,
        source: 'lmstudio-status',
        note: String(status?.error || status?.hint || '').trim(),
      };
    }

    while (true) {
      if (!status.reachable) {
        throw new Error(`${status.error} ${status.hint}`.trim());
      }

      const preferredModel = getPreferredModelForLane(lane);
      if (!refreshedAfterCachedLaneMiss && shouldRefreshCachedLaneStatus(status, lane, preferredModel)) {
        resolutionStartedAt = Date.now();
        status = await getLmStudioConnectionStatus({ force: true });
        refreshedAfterCachedLaneMiss = true;
        if (runtime && typeof runtime === 'object') {
          runtime.performance = runtime.performance && typeof runtime.performance === 'object'
            ? runtime.performance
            : {};
          runtime.performance.modelResolution = {
            startedAt: new Date(resolutionStartedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Math.max(0, Date.now() - resolutionStartedAt),
            available: true,
            cacheHit: status?.probe?.cacheHit === true,
            source: 'lmstudio-status',
            note: String(status?.error || status?.hint || '').trim(),
          };
        }
        continue;
      }
      const candidates = resolveLaneCandidates(status, lane);
      let lastMissingModelError = null;

      if (!candidates.length) {
        const preferredModel = getPreferredModelForLane(lane);
        if (modelFallbackDisabled && preferredModel) {
          throw new Error(`${lane} lane model ${preferredModel} is not available from ${LMSTUDIO_BASE}; model fallback is disabled.`);
        }
      }

      for (const model of candidates) {
        const meta = {
          localLane: lane,
          requestedModel: preferredModel || model,
          resolvedModel: model,
          laneFallback: !!(preferredModel && !modelsLookEquivalent(model, preferredModel)),
          preferredModel,
          status,
        };
        if (runtime && typeof runtime === 'object') {
          runtime.localLane = lane;
          runtime.requestedModel = meta.requestedModel;
          runtime.resolvedModel = meta.resolvedModel;
          runtime.laneFallback = meta.laneFallback;
        }
        try {
          return await runForModel(model, status, meta);
        } catch (error) {
          if (isMissingLmStudioModelError(error)) {
            lastMissingModelError = error;
            continue;
          }
          throw error;
        }
      }

      if (lastMissingModelError && !refreshedAfterMissingModel) {
        resolutionStartedAt = Date.now();
        status = await getLmStudioConnectionStatus({ force: true });
        refreshedAfterMissingModel = true;
        if (runtime && typeof runtime === 'object') {
          runtime.performance = runtime.performance && typeof runtime.performance === 'object'
            ? runtime.performance
            : {};
          runtime.performance.modelResolution = {
            startedAt: new Date(resolutionStartedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Math.max(0, Date.now() - resolutionStartedAt),
            available: true,
            cacheHit: status?.probe?.cacheHit === true,
            source: 'lmstudio-status',
            note: String(status?.error || status?.hint || '').trim(),
          };
        }
        continue;
      }

      if (lastMissingModelError) {
        throw new Error(`LM Studio rejected all ${lane} lane model ids (${candidates.join(', ')}). Last error: ${lastMissingModelError.message}`);
      }

      throw new Error(status.hint || 'LM Studio did not report a usable model.');
    }
  }

  function pickLmStudioNativeModelId(preferredModel = '', status = {}) {
    const target = String(preferredModel || '').trim();
    if (!target) return '';
    const nativeModels = Array.isArray(status?.nativeAvailableModels)
      ? status.nativeAvailableModels.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    if (!nativeModels.length) return target;
    const direct = nativeModels.find((id) => id === target);
    if (direct) return direct;
    const alias = nativeModels.find((id) => modelsLookEquivalent(id, target));
    return alias || target;
  }

  function shouldPreferLmStudioChatCompletions(model = '', status = {}) {
    const target = String(model || '').trim();
    if (!target) return false;
    const nativeModel = pickLmStudioNativeModelId(target, status);
    if (!nativeModel) return false;
    return normalizeModelKey(nativeModel) !== normalizeModelKey(target);
  }

  function resetLmStudioStatusCache() {
    lmStudioStatusCache = { expiresAt: 0, value: null };
  }

  function setRuntimePreferredChatModel(model = '') {
    runtimePreferredChatModel = String(model || '').trim();
    resetLmStudioStatusCache();
    return runtimePreferredChatModel;
  }

  function getRuntimePreferredChatModel() {
    return runtimePreferredChatModel;
  }

  function buildStatusGemmaRuntimeWatch(status = {}) {
    const value = status && typeof status === 'object' ? status : {};
    return buildGemmaRuntimeWatchArtifact({
      generatedAt: new Date().toISOString(),
      measurementMode: 'status-only',
      status: value,
      visionBudget: {
        exposed: false,
        adoptionStatus: 'not-adopted',
        knobNames: [],
        notes: 'LM Studio status does not expose max_soft_tokens or a separate Gemma vision-budget knob.',
      },
      imagePolicy: {
        currentTurnImageOnly: true,
        imagePartBeforeText: true,
      },
      thinkingControls: {
        exposed: null,
        notes: 'Status only records the companion-chat default; explicit thinking eval remains separate.',
      },
      promptCacheRamRisk: {
        contextLength: null,
        notes: 'Status probe does not measure prompt-cache RAM pressure.',
      },
    });
  }

  return {
    getLmStudioConnectionStatus,
    withLmStudioLaneModel,
    getPreferredModelForLane,
    getRuntimePreferredChatModel,
    setRuntimePreferredChatModel,
    resetLmStudioStatusCache,
    pickLmStudioNativeModelId,
    shouldPreferLmStudioChatCompletions,
    buildStatusGemmaRuntimeWatch,
    modelsLookEquivalent,
    normalizeModelKey,
  };
}

module.exports = {
  createLmStudioStatusApi,
};
