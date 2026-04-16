function createLmStudioAutomationApi({
  fs,
  path,
  fetch,
  execFileText,
  lmStudioStatusApi,
  LMSTUDIO_BASE = '',
  LMSTUDIO_API_KEY = 'lm-studio-local',
  APPDATA = '',
  USER_HOME = '',
  LMSTUDIO_SETTINGS_FILE = '',
  PENNY_LMSTUDIO_CHAT_MODEL = '',
  PENNY_LMSTUDIO_TOOL_MODEL = '',
  PENNY_LMSTUDIO_EMBED_MODEL = '',
  PENNY_LMSTUDIO_PRESET_IDENTIFIER = '',
} = {}) {
  if (!fs || typeof fs.existsSync !== 'function' || typeof fs.readFileSync !== 'function' || typeof fs.writeFileSync !== 'function') {
    throw new TypeError('createLmStudioAutomationApi requires fs');
  }
  if (!path || typeof path.join !== 'function' || typeof path.resolve !== 'function') {
    throw new TypeError('createLmStudioAutomationApi requires path');
  }
  if (typeof fetch !== 'function') throw new TypeError('createLmStudioAutomationApi requires fetch');
  if (typeof execFileText !== 'function') throw new TypeError('createLmStudioAutomationApi requires execFileText');
  if (!lmStudioStatusApi || typeof lmStudioStatusApi.getLmStudioConnectionStatus !== 'function') {
    throw new TypeError('createLmStudioAutomationApi requires lmStudioStatusApi');
  }

  function normalizeEmbedModelId(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/nomic-embed-text-v1\.5/i.test(text)) return 'text-embedding-nomic-embed-text-v1.5';
    return text;
  }

  const PRESET_IDENTIFIER = String(PENNY_LMSTUDIO_PRESET_IDENTIFIER || '').trim() || '@local:penny';
  const SETTINGS_PATH = LMSTUDIO_SETTINGS_FILE
    ? path.resolve(LMSTUDIO_SETTINGS_FILE)
    : path.join(APPDATA || '', 'LM Studio', 'settings.json');
  const CONVERSATION_CONFIG_PATH = path.join(USER_HOME || '', '.lmstudio', '.internal', 'conversation-config.json');
  const CONVERSATIONS_DIR = path.join(USER_HOME || '', '.lmstudio', 'conversations');
  const MODEL_DEFAULTS_ROOT = path.join(USER_HOME || '', '.lmstudio', '.internal', 'user-concrete-model-default-config');

  function normalizeModelKey(value = '') {
    if (typeof lmStudioStatusApi.normalizeModelKey === 'function') {
      return lmStudioStatusApi.normalizeModelKey(value);
    }
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function modelsLookEquivalent(left = '', right = '') {
    if (typeof lmStudioStatusApi.modelsLookEquivalent === 'function') {
      return lmStudioStatusApi.modelsLookEquivalent(left, right);
    }
    const a = normalizeModelKey(left);
    const b = normalizeModelKey(right);
    return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
  }

  function uniqueStrings(values = []) {
    const out = [];
    const seen = new Set();
    for (const value of values || []) {
      const text = String(value || '').trim();
      if (!text) continue;
      const key = normalizeModelKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  function tokenizeForPathMatch(value = '') {
    return String(value || '')
      .toLowerCase()
      .replace(/@/g, '-')
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  function normalizePathText(filePath = '') {
    return String(filePath || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function pathMatchesTokens(filePath = '', tokens = []) {
    if (!tokens.length) return false;
    const normalizedPath = normalizePathText(filePath);
    return tokens.every(token => normalizedPath.includes(String(token || '').toLowerCase()));
  }

  function listJsonFilesRecursive(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return [];
    const out = [];
    const pending = [dirPath];
    while (pending.length) {
      const current = pending.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          pending.push(fullPath);
          continue;
        }
        if (entry.isFile() && /\.json$/i.test(entry.name)) {
          out.push(fullPath);
        }
      }
    }
    return out;
  }

  async function checkLmsCli() {
    try {
      await execFileText('lms', ['--help'], { timeout: 5000 });
      return { ok: true, detail: 'LM Studio CLI is available.' };
    } catch (error) {
      return {
        ok: false,
        detail: `LM Studio CLI is not available: ${String(error?.message || error).trim()}`,
      };
    }
  }

  async function listInstalledModelsDetailed() {
    try {
      const { stdout } = await execFileText('lms', ['ls', '--json'], { timeout: 15000 });
      const parsed = stdout ? JSON.parse(stdout) : [];
      return Array.isArray(parsed)
        ? parsed.filter(item => item && typeof item === 'object' && ['llm', 'embedding'].includes(String(item.type || '').toLowerCase()))
        : [];
    } catch {
      return [];
    }
  }

  async function listInstalledModels() {
    const rows = await listInstalledModelsDetailed();
    const ids = [];
    for (const item of rows) {
      ids.push(item.modelKey, item.selectedVariant, ...(Array.isArray(item.variants) ? item.variants : []));
    }
    return uniqueStrings(ids);
  }

  async function listLoadedModels() {
    try {
      const { stdout } = await execFileText('lms', ['ps', '--json'], { timeout: 15000 });
      const parsed = stdout ? JSON.parse(stdout) : [];
      if (!Array.isArray(parsed)) return [];
      const ids = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const state = String(item.state || item.status || '').toLowerCase();
        if (state && !/\bloaded|ready|running|active|idle\b/i.test(state)) continue;
        ids.push(item.modelKey, item.identifier, item.id, item.model, item.name, item.path);
      }
      return uniqueStrings(ids);
    } catch {
      return [];
    }
  }

  function buildRequestedModels({ chatModel = '', toolModel = '', embedModel = '' } = {}) {
    const requestedChatModel = String(chatModel || '').trim()
      || String(PENNY_LMSTUDIO_CHAT_MODEL || '').trim()
      || (typeof lmStudioStatusApi.getPreferredModelForLane === 'function' ? lmStudioStatusApi.getPreferredModelForLane('chat') : 'google/gemma-4-31b');
    const requestedToolModel = String(toolModel || '').trim()
      || String(PENNY_LMSTUDIO_TOOL_MODEL || '').trim()
      || (typeof lmStudioStatusApi.getPreferredModelForLane === 'function' ? lmStudioStatusApi.getPreferredModelForLane('tool') : 'google/gemma-4-e4b');
    const requestedEmbedModel = normalizeEmbedModelId(
      String(embedModel || '').trim()
      || String(PENNY_LMSTUDIO_EMBED_MODEL || '').trim()
      || 'text-embedding-nomic-embed-text-v1.5',
    );
    return {
      requestedChatModel,
      requestedToolModel,
      requestedEmbedModel,
    };
  }

  function buildInstalledEntryAliases(entry = {}) {
    return uniqueStrings([
      entry.modelKey,
      entry.selectedVariant,
      entry.path,
      entry.indexedModelIdentifier,
      ...(Array.isArray(entry.variants) ? entry.variants : []),
    ]);
  }

  function entryMatchesRequestedModel(entry = {}, requestedModel = '') {
    const aliases = buildInstalledEntryAliases(entry);
    return aliases.some(alias => modelsLookEquivalent(alias, requestedModel));
  }

  function buildInstalledLoadTargets(entry = {}) {
    return uniqueStrings([
      entry.modelKey,
      entry.selectedVariant,
      ...(Array.isArray(entry.variants) ? entry.variants : []),
      entry.path,
      entry.indexedModelIdentifier,
    ]);
  }

  async function resolveLoadableModelIds(requestedModel = '') {
    const clean = String(requestedModel || '').trim();
    if (!clean) return [];
    const installedEntries = await listInstalledModelsDetailed();
    const match = installedEntries.find(entry => entryMatchesRequestedModel(entry, clean));
    const candidates = match ? buildInstalledLoadTargets(match) : [];
    return uniqueStrings([...candidates, clean]);
  }

  function looksLikeConflictingHeavyChatModel(candidate = '', target = '') {
    const candidateKey = normalizeModelKey(candidate);
    const targetKey = normalizeModelKey(target);
    if (!candidateKey || !targetKey) return false;
    if (modelsLookEquivalent(candidate, target)) return false;
    const candidateLooks31B = candidateKey.includes('31b') || candidateKey.includes('431b');
    const targetLooks31B = targetKey.includes('31b') || targetKey.includes('431b');
    if (!candidateLooks31B || !targetLooks31B) return false;
    if (candidateKey.includes('e4b') || candidateKey.includes('embed')) return false;
    return true;
  }

  async function assertNoConflictingLoadedChatModels(targetModel = '') {
    const clean = String(targetModel || '').trim();
    if (!clean) return [];
    const loaded = await listLoadedModels();
    const conflicts = loaded.filter(model => looksLikeConflictingHeavyChatModel(model, clean));
    if (conflicts.length) {
      throw new Error(
        `Refusing to load ${clean} while conflicting 31B chat model(s) are already loaded: ${conflicts.join(', ')}. Unload them first.`,
      );
    }
    return loaded;
  }

  function buildExactConfigPath(modelId = '') {
    const clean = String(modelId || '').trim();
    if (!clean) return '';
    const segments = clean.split('/').filter(Boolean);
    if (!segments.length) return '';
    return path.join(MODEL_DEFAULTS_ROOT, ...segments.slice(0, -1), `${segments[segments.length - 1]}.json`);
  }

  function inspectConfigFile(filePath = '') {
    const result = {
      path: filePath,
      exists: !!filePath && fs.existsSync(filePath),
      preset: '',
      presetOk: false,
      needsRepair: false,
    };
    if (!result.exists) return result;
    try {
      const parsed = readJson(filePath);
      result.preset = String(parsed?.preset || '').trim();
      result.presetOk = result.preset === PRESET_IDENTIFIER;
      result.needsRepair = !result.presetOk;
    } catch {
      result.parseError = true;
      result.needsRepair = true;
    }
    return result;
  }

  function discoverConcreteModelConfigTargets(requestedModel = '', installedEntries = [], allConfigFiles = []) {
    const files = Array.isArray(allConfigFiles) && allConfigFiles.length
      ? allConfigFiles
      : listJsonFilesRecursive(MODEL_DEFAULTS_ROOT);
    const byPath = new Map();

    const exactTopLevel = buildExactConfigPath(requestedModel);
    if (exactTopLevel) {
      byPath.set(exactTopLevel, inspectConfigFile(exactTopLevel));
    }

    const relevantEntries = installedEntries.filter(entry => entryMatchesRequestedModel(entry, requestedModel));
    for (const entry of relevantEntries) {
      const aliases = buildInstalledEntryAliases(entry);
      for (const alias of aliases) {
        const tokens = tokenizeForPathMatch(alias);
        if (!tokens.length) continue;
        for (const filePath of files) {
          if (!pathMatchesTokens(filePath, tokens)) continue;
          if (!byPath.has(filePath)) byPath.set(filePath, inspectConfigFile(filePath));
        }
      }
    }

    if (!byPath.size) {
      const requestedTokens = tokenizeForPathMatch(requestedModel);
      for (const filePath of files) {
        if (!pathMatchesTokens(filePath, requestedTokens)) continue;
        if (!byPath.has(filePath)) byPath.set(filePath, inspectConfigFile(filePath));
      }
    }

    return [...byPath.values()].sort((left, right) => String(left.path).localeCompare(String(right.path)));
  }

  function inspectSettingsFile() {
    const result = {
      path: SETTINGS_PATH,
      exists: !!SETTINGS_PATH && fs.existsSync(SETTINGS_PATH),
      experimentalLoadPresets: false,
      needsRepair: false,
    };
    if (!result.exists) return result;
    try {
      const settings = readJson(SETTINGS_PATH);
      result.experimentalLoadPresets = settings?.developer?.experimentalLoadPresets === true;
      result.needsRepair = !result.experimentalLoadPresets;
    } catch {
      result.parseError = true;
      result.needsRepair = true;
    }
    return result;
  }

  function inspectSelectedConversation() {
    const result = {
      configPath: CONVERSATION_CONFIG_PATH,
      configExists: !!CONVERSATION_CONFIG_PATH && fs.existsSync(CONVERSATION_CONFIG_PATH),
      selectedConversation: '',
      path: '',
      exists: false,
      preset: '',
      presetOk: false,
      needsRepair: false,
    };
    if (!result.configExists) return result;
    try {
      const config = readJson(CONVERSATION_CONFIG_PATH);
      result.selectedConversation = String(config?.selectedConversation || '').trim();
      if (!result.selectedConversation) {
        result.needsRepair = true;
        return result;
      }
      result.path = path.join(CONVERSATIONS_DIR, result.selectedConversation);
      result.exists = fs.existsSync(result.path);
      if (!result.exists) {
        result.needsRepair = true;
        return result;
      }
      const conversation = readJson(result.path);
      result.preset = String(conversation?.preset || '').trim();
      result.presetOk = result.preset === PRESET_IDENTIFIER;
      result.needsRepair = !result.presetOk;
      return result;
    } catch {
      result.parseError = true;
      result.needsRepair = true;
      return result;
    }
  }

  async function inspectPresetWiring({ chatModel = '', toolModel = '' } = {}) {
    const { requestedChatModel, requestedToolModel } = buildRequestedModels({ chatModel, toolModel });
    const installedEntries = await listInstalledModelsDetailed();
    const allConfigFiles = listJsonFilesRecursive(MODEL_DEFAULTS_ROOT);
    const settings = inspectSettingsFile();
    const selectedConversation = inspectSelectedConversation();
    const chatConfigs = discoverConcreteModelConfigTargets(requestedChatModel, installedEntries, allConfigFiles);
    const toolConfigs = discoverConcreteModelConfigTargets(requestedToolModel, installedEntries, allConfigFiles);
    const missingTargets = [];

    if (!chatConfigs.length) {
      missingTargets.push(`No LM Studio concrete default config files were found for chat model ${requestedChatModel}.`);
    }
    if (!toolConfigs.length) {
      missingTargets.push(`No LM Studio concrete default config files were found for tool model ${requestedToolModel}.`);
    }

    return {
      presetIdentifier: PRESET_IDENTIFIER,
      requestedChatModel,
      requestedToolModel,
      settings,
      selectedConversation,
      chatConfigs,
      toolConfigs,
      missingTargets,
      repairedPaths: [],
    };
  }

  async function ensurePresetWiring({ chatModel = '', toolModel = '' } = {}) {
    const inspection = await inspectPresetWiring({ chatModel, toolModel });
    const repairedPaths = [];

    if (inspection.settings.exists && inspection.settings.needsRepair) {
      try {
        const settings = readJson(inspection.settings.path);
        settings.developer = settings.developer || {};
        settings.developer.experimentalLoadPresets = true;
        writeJson(inspection.settings.path, settings);
        inspection.settings.experimentalLoadPresets = true;
        inspection.settings.needsRepair = false;
        repairedPaths.push(inspection.settings.path);
      } catch {
        inspection.settings.repairFailed = true;
      }
    }

    if (inspection.selectedConversation.exists && inspection.selectedConversation.needsRepair && inspection.selectedConversation.path) {
      try {
        const conversation = readJson(inspection.selectedConversation.path);
        conversation.preset = PRESET_IDENTIFIER;
        writeJson(inspection.selectedConversation.path, conversation);
        inspection.selectedConversation.preset = PRESET_IDENTIFIER;
        inspection.selectedConversation.presetOk = true;
        inspection.selectedConversation.needsRepair = false;
        repairedPaths.push(inspection.selectedConversation.path);
      } catch {
        inspection.selectedConversation.repairFailed = true;
      }
    }

    for (const bucket of [inspection.chatConfigs, inspection.toolConfigs]) {
      for (const config of bucket) {
        if (!config.exists || !config.needsRepair) continue;
        try {
          const parsed = readJson(config.path);
          parsed.preset = PRESET_IDENTIFIER;
          parsed.operation = parsed.operation || { fields: [] };
          parsed.load = parsed.load || { fields: [] };
          writeJson(config.path, parsed);
          config.preset = PRESET_IDENTIFIER;
          config.presetOk = true;
          config.needsRepair = false;
          repairedPaths.push(config.path);
        } catch {
          config.repairFailed = true;
        }
      }
    }

    inspection.repairedPaths = uniqueStrings(repairedPaths);
    return inspection;
  }

  async function loadModel(modelId = '', label = 'model', options = {}) {
    const clean = String(modelId || '').trim();
    if (!clean) throw new Error(`No ${label} id was provided for lmstudio:prepare.`);
    const contextLength = Number(options?.contextLength || 0);
    const ttlSeconds = Number(options?.ttlSeconds || 0);
    const candidates = await resolveLoadableModelIds(clean);
    let lastError = null;

    for (const candidate of candidates) {
      await assertNoConflictingLoadedChatModels(candidate);
      const args = ['load', candidate, '-y'];
      if (Number.isFinite(contextLength) && contextLength > 0) {
        args.push('-c', String(contextLength));
      }
      if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
        args.push('--ttl', String(ttlSeconds));
      }
      try {
        return await execFileText('lms', args, { timeout: 20 * 60 * 1000 });
      } catch (error) {
        lastError = error;
        const text = `${error?.stderr || ''}\n${error?.stdout || ''}`;
        if (!/model not found/i.test(text)) throw error;
      }
    }

    throw lastError || new Error(`Failed to load ${label} ${clean}.`);
  }

  async function probeEmbeddingModel(modelId = '') {
    const clean = normalizeEmbedModelId(modelId);
    if (!clean) return { ok: false, error: 'No embedding model id was provided.' };
    try {
      const response = await fetch(`${LMSTUDIO_BASE}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
        },
        body: JSON.stringify({
          model: clean,
          input: 'penny semantic memory probe',
        }),
      });
      const bodyText = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          error: `LM Studio embeddings error ${response.status}: ${bodyText}`.trim(),
        };
      }
      let parsed = {};
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        parsed = {};
      }
      const vector = parsed?.data?.[0]?.embedding;
      return { ok: Array.isArray(vector) && vector.length > 0, error: '' };
    } catch (error) {
      return { ok: false, error: String(error?.message || error).trim() };
    }
  }

  function buildLaneFallbackFlags({
    requestedChatModel = '',
    requestedToolModel = '',
    resolvedChatModel = '',
    resolvedToolModel = '',
  } = {}) {
    return {
      chat: !!requestedChatModel && !!resolvedChatModel && !modelsLookEquivalent(resolvedChatModel, requestedChatModel),
      tool: !!requestedToolModel && !!resolvedToolModel && !modelsLookEquivalent(resolvedToolModel, requestedToolModel),
    };
  }

  async function prepareLmStudio({
    reportOnly = false,
    repairPreset = !reportOnly,
    loadChatModel: shouldLoadChatModel = !reportOnly,
    loadEmbedModel: shouldLoadEmbedModel = !reportOnly,
    chatModel = '',
    toolModel = '',
    embedModel = '',
  } = {}) {
    const { requestedChatModel, requestedToolModel, requestedEmbedModel } = buildRequestedModels({ chatModel, toolModel, embedModel });
    const cliCheck = await checkLmsCli();
    const blockers = [];
    const warnings = [];
    const actions = [];

    let installedModels = [];
    let loadedModels = [];
    let statusBefore = null;
    let statusAfter = null;
    let preset = null;
    let chatLoadAttempted = false;
    let chatLoadSucceeded = false;
    let chatLoadError = '';
    let embedLoadAttempted = false;
    let embedLoadSucceeded = false;
    let embedLoadError = '';
    let embedProbe = { ok: false, error: '' };

    if (!cliCheck.ok) {
      blockers.push(cliCheck.detail);
      return {
        ok: false,
        reportOnly,
        requestedChatModel,
        requestedToolModel,
        requestedEmbedModel,
        cliCheck,
        blockers,
        warnings,
        actions,
        installedModels,
        loadedModels,
        preset,
        statusBefore,
        statusAfter,
        laneFallback: { chat: false, tool: false },
      };
    }

    installedModels = await listInstalledModels();
    loadedModels = await listLoadedModels();
    statusBefore = await lmStudioStatusApi.getLmStudioConnectionStatus({ force: true });
    installedModels = uniqueStrings([
      ...installedModels,
      ...(Array.isArray(statusBefore?.installedModels) ? statusBefore.installedModels : []),
      ...loadedModels,
    ]);
    preset = repairPreset
      ? await ensurePresetWiring({ chatModel: requestedChatModel, toolModel: requestedToolModel })
      : await inspectPresetWiring({ chatModel: requestedChatModel, toolModel: requestedToolModel });

    if (preset.repairedPaths.length) {
      warnings.push(`Repaired LM Studio preset wiring for ${preset.repairedPaths.length} target${preset.repairedPaths.length === 1 ? '' : 's'}.`);
      actions.push(...preset.repairedPaths.map(filePath => `preset-repaired:${filePath}`));
    }
    for (const message of preset.missingTargets) warnings.push(message);
    if (!preset.settings.exists) warnings.push(`LM Studio settings file was not found at ${preset.settings.path}.`);
    else if (preset.settings.needsRepair) warnings.push(`LM Studio settings do not currently enable experimental preset loading.`);
    if (!preset.selectedConversation.configExists) warnings.push(`LM Studio conversation config was not found at ${preset.selectedConversation.configPath}.`);
    else if (!preset.selectedConversation.selectedConversation) warnings.push('LM Studio does not currently report a selected conversation.');
    else if (!preset.selectedConversation.exists) warnings.push(`Selected LM Studio conversation file is missing: ${preset.selectedConversation.path}`);
    else if (preset.selectedConversation.needsRepair) warnings.push(`Selected LM Studio conversation is not using ${PRESET_IDENTIFIER}.`);

    const exactChatInstalled = installedModels.some(model => modelsLookEquivalent(model, requestedChatModel));
    const exactToolInstalled = installedModels.some(model => modelsLookEquivalent(model, requestedToolModel));
    const exactEmbedInstalled = requestedEmbedModel
      ? installedModels.some(model => modelsLookEquivalent(model, requestedEmbedModel))
      : false;
    const exactChatLoadedBefore = loadedModels.some(model => modelsLookEquivalent(model, requestedChatModel));

    if (shouldLoadChatModel && !reportOnly && exactChatInstalled && !exactChatLoadedBefore) {
      chatLoadAttempted = true;
      try {
        await loadModel(requestedChatModel, 'chat model');
        chatLoadSucceeded = true;
        actions.push(`chat-model-loaded:${requestedChatModel}`);
      } catch (error) {
        chatLoadError = String(error?.message || error).trim();
        blockers.push(`Failed to load requested chat model ${requestedChatModel}: ${chatLoadError}`);
      }
    }

    if (requestedEmbedModel && exactEmbedInstalled) {
      embedProbe = await probeEmbeddingModel(requestedEmbedModel);
      if (!embedProbe.ok && shouldLoadEmbedModel && !reportOnly) {
        embedLoadAttempted = true;
        try {
          await loadModel(requestedEmbedModel, 'embedding model');
          embedLoadSucceeded = true;
          actions.push(`embed-model-loaded:${requestedEmbedModel}`);
        } catch (error) {
          embedLoadError = String(error?.message || error).trim();
          warnings.push(`Failed to load embedding model ${requestedEmbedModel}: ${embedLoadError}`);
        }
        embedProbe = await probeEmbeddingModel(requestedEmbedModel);
      }
    }

    loadedModels = await listLoadedModels();
    statusAfter = await lmStudioStatusApi.getLmStudioConnectionStatus({ force: true });
    loadedModels = uniqueStrings([
      ...loadedModels,
      ...(Array.isArray(statusAfter?.nativeAvailableModels) ? statusAfter.nativeAvailableModels : []),
    ]);
    installedModels = uniqueStrings([
      ...installedModels,
      ...(Array.isArray(statusAfter?.installedModels) ? statusAfter.installedModels : []),
      ...loadedModels,
    ]);

    if (!statusAfter?.reachable) {
      blockers.push(statusAfter?.error || 'LM Studio API is unreachable.');
    }

    if (!loadedModels.length) {
      blockers.push(`LM Studio is reachable, but no usable models are currently loaded. Load Penny's chat/tool models before running QA.`);
    }

    if (!exactToolInstalled) {
      blockers.push(`Requested tool model ${requestedToolModel} is not installed in LM Studio.`);
    }

    const hasChatFamilyFallback = !!statusAfter?.resolvedChatModel
      && !modelsLookEquivalent(statusAfter.resolvedChatModel, requestedToolModel);

    if (!exactChatInstalled && !hasChatFamilyFallback) {
      blockers.push(`Requested chat model ${requestedChatModel} is not installed, and no compatible chat fallback is currently loaded.`);
    } else if (!exactChatInstalled && hasChatFamilyFallback) {
      warnings.push(`Requested chat model ${requestedChatModel} is not installed; Penny will use ${statusAfter.resolvedChatModel} as the chat-lane fallback.`);
    }

    const exactToolLoaded = loadedModels.some(model => modelsLookEquivalent(model, requestedToolModel));
    const exactEmbedLoaded = requestedEmbedModel ? embedProbe.ok : false;
    if (exactToolInstalled && !exactToolLoaded) {
      warnings.push(`Tool model ${requestedToolModel} is installed but not currently loaded, so the tool lane may fall back.`);
    }
    if (requestedEmbedModel && !exactEmbedInstalled) {
      warnings.push(`Embedding model ${requestedEmbedModel} is not installed, so semantic memory will fall back to keyword retrieval.`);
    } else if (requestedEmbedModel && !exactEmbedLoaded) {
      warnings.push(`Embedding model ${requestedEmbedModel} is installed but not currently ready, so semantic memory is in graceful fallback mode.${embedProbe.error ? ` ${embedProbe.error}` : ''}`);
    }

    const laneFallback = buildLaneFallbackFlags({
      requestedChatModel,
      requestedToolModel,
      resolvedChatModel: statusAfter?.resolvedChatModel || '',
      resolvedToolModel: statusAfter?.resolvedToolModel || '',
    });

    if (laneFallback.chat) {
      warnings.push(`Chat lane will resolve to ${statusAfter?.resolvedChatModel || '(none)'} instead of ${requestedChatModel}.`);
    }
    if (laneFallback.tool) {
      warnings.push(`Tool lane will resolve to ${statusAfter?.resolvedToolModel || '(none)'} instead of ${requestedToolModel}.`);
    }

    return {
      ok: blockers.length === 0,
      reportOnly,
      requestedChatModel,
      requestedToolModel,
      requestedEmbedModel,
      cliCheck,
      blockers: uniqueStrings(blockers),
      warnings: uniqueStrings(warnings),
      actions: uniqueStrings(actions),
      installedModels,
      loadedModels,
      preset,
      statusBefore,
      statusAfter,
      chatLoadAttempted,
      chatLoadSucceeded,
      chatLoadError,
      embedLoadAttempted,
      embedLoadSucceeded,
      embedLoadError,
      embedInstalled: exactEmbedInstalled,
      embedLoaded: exactEmbedLoaded,
      semanticMemoryReady: !!requestedEmbedModel && exactEmbedInstalled && exactEmbedLoaded,
      laneFallback,
      dualLaneReady: !laneFallback.chat && !laneFallback.tool && exactToolLoaded && !!statusAfter?.resolvedChatModel,
    };
  }

  return {
    PRESET_IDENTIFIER,
    SETTINGS_PATH,
    CONVERSATION_CONFIG_PATH,
    CONVERSATIONS_DIR,
    MODEL_DEFAULTS_ROOT,
    buildRequestedModels,
    listInstalledModels,
    listInstalledModelsDetailed,
    listLoadedModels,
    resolveLoadableModelIds,
    assertNoConflictingLoadedChatModels,
    loadModel,
    inspectPresetWiring,
    ensurePresetWiring,
    prepareLmStudio,
  };
}

module.exports = {
  createLmStudioAutomationApi,
};
