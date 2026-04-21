const READINESS_SUMMARY_VERSION = 'penny-local-readiness-summary.v1';

const READINESS_STATES = Object.freeze({
  HEALTHY: 'healthy',
  READY_WITH_OPTIONAL_FALLBACK: 'ready_with_optional_fallback',
  FALLBACK: 'fallback',
  DEGRADED: 'degraded',
  INVALID: 'invalid',
});

function trimText(value = '', limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function uniqueStrings(values = [], limit = 24) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = trimText(value, 220);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeModelKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tokenizeModelAlias(value = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/embeddinggemma/g, 'embedding-gemma');
  if (!raw) return [];
  const splitTokens = raw
    .replace(/@/g, '-')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tokens = [];
  for (let i = 0; i < splitTokens.length; i += 1) {
    const token = splitTokens[i];
    const next = splitTokens[i + 1] || '';
    if (/^q\d+$/.test(token) && /^[a-z0-9]{1,2}$/.test(next)) {
      tokens.push(`${token}${next}`);
      i += 1;
      continue;
    }
    tokens.push(token);
  }
  return tokens.filter((token) => token !== 'gguf');
}

function modelsLookCompatible(left = '', right = '') {
  const leftKey = normalizeModelKey(left);
  const rightKey = normalizeModelKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey)) return true;

  const leftTokens = tokenizeModelAlias(left);
  const rightTokens = tokenizeModelAlias(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const rightContained = rightTokens.every((token) => leftSet.has(token));
  const leftContained = leftTokens.every((token) => rightSet.has(token));
  return rightContained || leftContained;
}

function findCompatibleModel(models = [], target = '') {
  const clean = String(target || '').trim();
  if (!clean) return '';
  return (Array.isArray(models) ? models : []).find((model) => modelsLookCompatible(model, clean)) || '';
}

function friendlyModelLabel(value = '') {
  const text = String(value || '').trim();
  if (!text) return '(none)';
  const key = normalizeModelKey(text);
  if (key.includes('e4b')) return 'E4B';
  if (key.includes('nomic') || key.includes('embedtextv15')) return 'Nomic embed';
  if (key.includes('embeddinggemma')) return 'EmbeddingGemma';
  if (key.includes('31b') || key.includes('431b')) {
    if (key.includes('q6') || key.includes('unsloth')) return 'Q6';
    if (key.includes('q8')) return 'Q8';
    return '31B chat';
  }
  return text;
}

function buildLaneSummary({
  lane = 'chat',
  requestedModel = '',
  resolvedModel = '',
  loadedModels = [],
  required = true,
  fallback = false,
  mismatches = [],
  strictLanePolicy = false,
} = {}) {
  const requested = String(requestedModel || '').trim();
  const resolved = String(resolvedModel || '').trim();
  const loadedMatch = findCompatibleModel(loadedModels, requested);
  const resolvedMatches = !requested || (!!resolved && modelsLookCompatible(resolved, requested));
  const mismatchList = uniqueStrings(mismatches, 8);
  const fallbackActive = fallback === true || mismatchList.length > 0 || (!!requested && !!resolved && !resolvedMatches);
  const requiredReady = !required
    || (
      (!!resolved || !!loadedMatch)
      && (!strictLanePolicy || !fallbackActive)
    );
  const label = friendlyModelLabel(resolved || loadedMatch || requested);
  const expectedLabel = friendlyModelLabel(requested);
  const route = `${lane} -> ${expectedLabel}`;
  let message = required
    ? `${route}; resolved ${label}`
    : `${route}; not required for this run`;

  if (required && !resolved && !loadedMatch) {
    message = `${route}; no matching loaded or resolved model was observed`;
  } else if (fallbackActive) {
    message = `${route}; resolved ${label} instead`;
  }

  return {
    lane,
    expectedModel: requested,
    expectedLabel,
    resolvedModel: resolved,
    resolvedLabel: label,
    loadedMatch,
    loaded: !!loadedMatch,
    required: required === true,
    ready: requiredReady === true,
    fallback: fallbackActive,
    mismatches: mismatchList,
    message,
  };
}

function buildSemanticSummary({
  requestedEmbedModel = '',
  semanticReady = null,
  semanticKnown = null,
  requireSemantic = false,
  semanticReason = '',
} = {}) {
  const requested = String(requestedEmbedModel || '').trim();
  const known = typeof semanticKnown === 'boolean' ? semanticKnown : typeof semanticReady === 'boolean';
  const ready = semanticReady === true;
  const required = requireSemantic === true;
  const label = friendlyModelLabel(requested);
  let mode = requested ? 'unknown' : 'not_configured';
  let message = requested
    ? `semantic memory -> ${label}; readiness unknown`
    : 'semantic memory is not configured';

  if (ready) {
    mode = 'ready';
    message = `semantic memory -> ${label}; ready`;
  } else if (required) {
    mode = known ? 'missing_required' : 'unknown_required';
    message = `semantic memory -> ${label}; required but not ready`;
  } else if (requested && known) {
    mode = 'optional_fallback';
    message = `semantic memory -> ${label}; optional fallback to keyword/archive retrieval`;
  }
  const reason = trimText(semanticReason, 160);
  if (reason) message = `${message} (${reason})`;

  return {
    requestedModel: requested,
    label,
    ready,
    known,
    required,
    optional: !required,
    mode,
    message,
  };
}

function buildLocalReadinessSummary({
  requestedChatModel = '',
  requestedToolModel = '',
  requestedEmbedModel = '',
  resolvedChatModel = '',
  resolvedToolModel = '',
  loadedModels = [],
  semanticReady = null,
  semanticKnown = null,
  semanticReason = '',
  requireChat = true,
  requireTool = true,
  requireSemantic = false,
  strictLanePolicy = false,
  laneFallback = {},
  laneMismatches = {},
  blockers = [],
  warnings = [],
  degradedArtifacts = 0,
  laneFallbackArtifacts = 0,
  usedFallbackArtifacts = 0,
  semanticMismatchArtifacts = 0,
  duplicateLoadedModels = [],
  serverMode = '',
  strictNoModelOps = null,
  manageModels = null,
  loadStrategy = '',
} = {}) {
  const loaded = uniqueStrings(loadedModels, 32);
  const normalizedBlockers = uniqueStrings(blockers, 16);
  const normalizedWarnings = uniqueStrings(warnings, 16);
  const duplicateProblems = uniqueStrings(duplicateLoadedModels, 8);
  const chat = buildLaneSummary({
    lane: 'chat',
    requestedModel: requestedChatModel,
    resolvedModel: resolvedChatModel,
    loadedModels: loaded,
    required: requireChat === true,
    fallback: laneFallback?.chat === true,
    mismatches: laneMismatches?.chat || [],
    strictLanePolicy,
  });
  const tool = buildLaneSummary({
    lane: 'tool',
    requestedModel: requestedToolModel,
    resolvedModel: resolvedToolModel,
    loadedModels: loaded,
    required: requireTool === true,
    fallback: laneFallback?.tool === true,
    mismatches: laneMismatches?.tool || [],
    strictLanePolicy,
  });
  const semanticMemory = buildSemanticSummary({
    requestedEmbedModel,
    semanticReady,
    semanticKnown,
    requireSemantic,
    semanticReason,
  });

  const coLoadedChatTool = !!(
    chat.loaded
    && tool.loaded
    && !chat.mismatches.length
    && !tool.mismatches.length
  );
  const degradedCount = Math.max(0, Number(degradedArtifacts || 0));
  const fallbackCount = Math.max(0, Number(laneFallbackArtifacts || 0) + Number(usedFallbackArtifacts || 0));
  const semanticMismatchCount = Math.max(0, Number(semanticMismatchArtifacts || 0));
  const requiredLaneMissing = (chat.required && !chat.ready) || (tool.required && !tool.ready);
  const laneMismatch = chat.mismatches.length > 0 || tool.mismatches.length > 0;
  const semanticRequiredMissing = semanticMemory.required && semanticMemory.ready !== true;
  const hasBlockingProblem = normalizedBlockers.length > 0
    || duplicateProblems.length > 0
    || requiredLaneMissing
    || laneMismatch
    || semanticRequiredMissing
    || semanticMismatchCount > 0;

  let state = READINESS_STATES.HEALTHY;
  if (hasBlockingProblem) state = READINESS_STATES.INVALID;
  else if (degradedCount > 0) state = READINESS_STATES.DEGRADED;
  else if (fallbackCount > 0 || chat.fallback || tool.fallback) state = READINESS_STATES.FALLBACK;
  else if (semanticMemory.mode === 'optional_fallback') state = READINESS_STATES.READY_WITH_OPTIONAL_FALLBACK;

  const policySummary = [
    chat.message,
    tool.required || requestedToolModel || resolvedToolModel ? tool.message : '',
  ].filter(Boolean).join('; ');
  const stateLabels = {
    [READINESS_STATES.HEALTHY]: 'Healthy',
    [READINESS_STATES.READY_WITH_OPTIONAL_FALLBACK]: 'Ready with optional semantic fallback',
    [READINESS_STATES.FALLBACK]: 'Fallbacking',
    [READINESS_STATES.DEGRADED]: 'Degraded',
    [READINESS_STATES.INVALID]: 'Needs attention',
  };
  const headline = `${stateLabels[state]}: ${policySummary || 'local readiness facts are available'}.`;
  const details = [
    chat.message,
    tool.required || requestedToolModel || resolvedToolModel ? tool.message : '',
    semanticMemory.message,
    coLoadedChatTool ? `${chat.expectedLabel} and ${tool.expectedLabel} are both loaded; co-loading is expected when chat resolves to ${chat.expectedLabel} and tool resolves to ${tool.expectedLabel}.` : '',
    degradedCount > 0 ? `runtime artifacts reported degraded readiness on ${degradedCount} turn(s)` : '',
    fallbackCount > 0 ? `runtime artifacts reported fallback on ${fallbackCount} turn(s)` : '',
    semanticMismatchCount > 0 ? `semantic-required turns reported missing semantic readiness on ${semanticMismatchCount} artifact(s)` : '',
    duplicateProblems.length ? `duplicate loaded models: ${duplicateProblems.join(', ')}` : '',
    normalizedBlockers.length ? `blockers: ${normalizedBlockers.join(' ')}` : '',
  ].filter(Boolean);

  return {
    version: READINESS_SUMMARY_VERSION,
    state,
    label: stateLabels[state],
    headline,
    details: uniqueStrings(details, 16),
    policy: {
      chat: `chat -> ${chat.expectedLabel}`,
      tool: tool.required ? `tool -> ${tool.expectedLabel}` : 'tool lane not required for this run',
      coLoading: coLoadedChatTool
        ? `${chat.expectedLabel} + ${tool.expectedLabel} co-loading is okay when lane routing stays correct.`
        : '',
    },
    modelRouting: { chat, tool },
    semanticMemory,
    loadedModels: loaded,
    coLoadedChatTool,
    strictNoModelOps: strictNoModelOps === true,
    manageModels: manageModels === true ? true : (manageModels === false ? false : null),
    loadStrategy: trimText(loadStrategy, 80),
    serverMode: trimText(serverMode, 80),
    degradedArtifacts: degradedCount,
    fallbackArtifacts: fallbackCount,
    semanticMismatchArtifacts: semanticMismatchCount,
    duplicateLoadedModels: duplicateProblems,
    blockers: normalizedBlockers,
    warnings: normalizedWarnings,
  };
}

function buildPreparationReadinessSummary(report = {}, options = {}) {
  const status = report?.statusAfter || report?.statusBefore || {};
  return buildLocalReadinessSummary({
    requestedChatModel: report?.requestedChatModel,
    requestedToolModel: report?.requestedToolModel,
    requestedEmbedModel: report?.requestedEmbedModel,
    resolvedChatModel: status?.resolvedChatModel || status?.resolvedModel || '',
    resolvedToolModel: status?.resolvedToolModel || '',
    loadedModels: [
      ...(Array.isArray(report?.loadedModels) ? report.loadedModels : []),
      ...(Array.isArray(status?.loadedModels) ? status.loadedModels : []),
      ...(Array.isArray(status?.availableModels) ? status.availableModels : []),
    ],
    semanticReady: report?.semanticMemoryReady,
    semanticKnown: typeof report?.semanticMemoryReady === 'boolean',
    semanticReason: status?.semanticMemory?.reason || '',
    requireChat: options.requireChat !== false,
    requireTool: options.requireTool !== false,
    requireSemantic: options.requireSemantic === true,
    strictLanePolicy: options.strictLanePolicy === true,
    laneFallback: report?.laneFallback || {},
    blockers: report?.blockers || [],
    warnings: report?.warnings || [],
    serverMode: options.serverMode || '',
    strictNoModelOps: report?.strictNoModelOps ?? options.strictNoModelOps,
    manageModels: options.manageModels,
    loadStrategy: report?.loadStrategy || options.loadStrategy || '',
  });
}

function formatLocalReadinessSummary(summary = {}, { includeLoaded = false } = {}) {
  const parts = [
    summary.headline,
    ...(Array.isArray(summary.details) ? summary.details : []),
  ].filter(Boolean);
  if (includeLoaded && Array.isArray(summary.loadedModels) && summary.loadedModels.length) {
    parts.push(`loaded=${summary.loadedModels.join(', ')}`);
  }
  return uniqueStrings(parts, 12).join(' ');
}

module.exports = {
  READINESS_SUMMARY_VERSION,
  READINESS_STATES,
  normalizeModelKey,
  modelsLookCompatible,
  friendlyModelLabel,
  buildLocalReadinessSummary,
  buildPreparationReadinessSummary,
  formatLocalReadinessSummary,
};
