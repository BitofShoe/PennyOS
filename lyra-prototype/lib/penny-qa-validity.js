function normalizeModelKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function modelsLookCompatible(left = '', right = '') {
  const leftKey = normalizeModelKey(left);
  const rightKey = normalizeModelKey(right);
  if (!leftKey || !rightKey) return false;
  return leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey);
}

function uniqueStrings(values = [], limit = 16) {
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

function normalizeLoadedModelEntry(value = null) {
  if (!value) return '';
  if (typeof value === 'string') return String(value || '').trim();
  if (typeof value === 'object') {
    return String(
      value.modelKey
      || value.model
      || value.identifier
      || value.id
      || value.path
      || value.name
      || '',
    ).trim();
  }
  return '';
}

function collectDuplicateLoadedModels(entries = []) {
  const counts = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const text = normalizeLoadedModelEntry(entry);
    if (!text) continue;
    const key = normalizeModelKey(text);
    if (!key) continue;
    const bucket = counts.get(key) || { label: text, count: 0 };
    bucket.count += 1;
    counts.set(key, bucket);
  }
  return [...counts.values()]
    .filter((item) => item.count > 1)
    .map((item) => `${item.label} x${item.count}`);
}

function walkNodes(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) walkNodes(item, visit, seen);
    return;
  }
  visit(value);
  for (const item of Object.values(value)) {
    walkNodes(item, visit, seen);
  }
}

function collectRuntimeArtifacts(results = []) {
  const artifacts = [];
  walkNodes(results, (item) => {
    if (item?.version === 'penny-runtime-artifact.v1' && item?.readiness && item?.performance) {
      artifacts.push(item);
    }
  });
  return artifacts;
}

function collectArtifactResolvedModels(artifacts = []) {
  const models = {
    chat: [],
    tool: [],
  };
  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    const lane = String(
      artifact?.scope?.selectedLane
      || artifact?.trace?.laneChoice?.selectedLane
      || artifact?.context?.selectedLane
      || '',
    ).trim();
    const resolvedModel = String(
      artifact?.context?.resolvedModel
      || artifact?.trace?.laneChoice?.resolvedModel
      || '',
    ).trim();
    if (!lane || !resolvedModel || !models[lane]) continue;
    models[lane].push(resolvedModel);
  }
  return {
    chat: uniqueStrings(models.chat, 8),
    tool: uniqueStrings(models.tool, 8),
  };
}

function buildQaEnvironmentValidity({
  serverMode = '',
  preparation = null,
  serverStatus = null,
  loadedModelEntries = [],
  results = [],
  requireDisposable = true,
  requireChat = true,
  requireTool = false,
  requireSemantic = false,
  expectedChatModel = '',
  expectedToolModel = '',
} = {}) {
  const artifacts = collectRuntimeArtifacts(results);
  const artifactResolvedModels = collectArtifactResolvedModels(artifacts);
  const availableModels = uniqueStrings([
    ...artifactResolvedModels.chat,
    ...artifactResolvedModels.tool,
    ...(Array.isArray(serverStatus?.availableModels) ? serverStatus.availableModels : []),
    ...(Array.isArray(preparation?.loadedModels) ? preparation.loadedModels : []),
  ], 24);
  const observedChatModel = String(
    artifactResolvedModels.chat[0]
    || serverStatus?.resolvedChatModel
    || serverStatus?.resolvedModel
    || '',
  ).trim();
  const observedToolModel = String(
    artifactResolvedModels.tool[0]
    || serverStatus?.resolvedToolModel
    || serverStatus?.toolPreferredModel
    || '',
  ).trim();
  const duplicateLoadedModels = collectDuplicateLoadedModels(
    (Array.isArray(loadedModelEntries) && loadedModelEntries.length)
      ? loadedModelEntries
      : (Array.isArray(preparation?.loadedModelEntries) ? preparation.loadedModelEntries : []),
  );
  const semanticReady = serverStatus?.semanticMemory?.ready === true
    || serverStatus?.semanticReady === true
    || preparation?.semanticMemoryReady === true;
  const degradedArtifacts = artifacts.filter((item) => String(item?.readiness?.warmState || '').trim() === 'degraded').length;
  const laneFallbackArtifacts = artifacts.filter((item) => item?.context?.laneFallback === true).length;
  const usedFallbackArtifacts = artifacts.filter((item) => item?.context?.usedFallback === true).length;
  const semanticMismatchArtifacts = requireSemantic
    ? artifacts.filter((item) => item?.context?.semanticMemoryReady !== true).length
    : 0;
  const trustedServer = !requireDisposable || serverMode === 'spawned-disposable' || serverMode === 'restart-gated';
  const preparationOk = preparation?.ok !== false && !(Array.isArray(preparation?.blockers) && preparation.blockers.length);
  const chatReady = !requireChat
    || modelsLookCompatible(observedChatModel, expectedChatModel)
    || artifactResolvedModels.chat.some((item) => modelsLookCompatible(item, expectedChatModel))
    || availableModels.some((item) => modelsLookCompatible(item, expectedChatModel));
  const toolReady = !requireTool
    || modelsLookCompatible(observedToolModel, expectedToolModel)
    || artifactResolvedModels.tool.some((item) => modelsLookCompatible(item, expectedToolModel))
    || availableModels.some((item) => modelsLookCompatible(item, expectedToolModel));
  const semanticReadyOk = !requireSemantic || semanticReady === true;
  const reasons = [];
  if (!trustedServer) reasons.push('release-style verdicts require a disposable or restart-gated server target');
  if (!preparationOk) reasons.push('LM Studio preparation reported blockers before the suite started');
  if (!chatReady) reasons.push(`resolved chat model did not cleanly match ${expectedChatModel || 'the requested chat model'}`);
  if (!toolReady) reasons.push(`resolved tool model did not cleanly match ${expectedToolModel || 'the requested tool model'}`);
  if (!semanticReadyOk) reasons.push('semantic memory was not ready for a semantic-required suite');
  if (degradedArtifacts > 0) reasons.push(`runtime artifacts reported degraded readiness on ${degradedArtifacts} turn(s)`);
  if (laneFallbackArtifacts > 0) reasons.push(`runtime artifacts reported lane fallback on ${laneFallbackArtifacts} turn(s)`);
  if (usedFallbackArtifacts > 0) reasons.push(`runtime artifacts reported fallback on ${usedFallbackArtifacts} turn(s)`);
  if (semanticMismatchArtifacts > 0) reasons.push(`semantic-required turns reported missing semantic readiness on ${semanticMismatchArtifacts} artifact(s)`);
  if (duplicateLoadedModels.length > 0) reasons.push(`LM Studio reported duplicate loaded models: ${duplicateLoadedModels.join(', ')}`);
  return {
    valid: reasons.length === 0,
    trustedServer,
    preparationOk,
    chatReady,
    toolReady,
    semanticReady: semanticReady === true,
    degradedArtifacts,
    laneFallbackArtifacts,
    usedFallbackArtifacts,
    semanticMismatchArtifacts,
    duplicateLoadedModels,
    artifactsInspected: artifacts.length,
    reasons,
    expected: {
      chatModel: String(expectedChatModel || '').trim(),
      toolModel: String(expectedToolModel || '').trim(),
      requireChat: requireChat === true,
      requireTool: requireTool === true,
      requireSemantic: requireSemantic === true,
      requireDisposable: requireDisposable === true,
    },
    observed: {
      serverMode: String(serverMode || '').trim(),
      chatModel: observedChatModel,
      toolModel: observedToolModel,
      semanticReady: semanticReady === true,
      availableModels,
      artifactResolvedModels,
      loadedModelEntries: uniqueStrings((Array.isArray(loadedModelEntries) ? loadedModelEntries : []).map(normalizeLoadedModelEntry).filter(Boolean), 24),
    },
  };
}

module.exports = {
  normalizeModelKey,
  modelsLookCompatible,
  collectDuplicateLoadedModels,
  collectRuntimeArtifacts,
  collectArtifactResolvedModels,
  buildQaEnvironmentValidity,
};
