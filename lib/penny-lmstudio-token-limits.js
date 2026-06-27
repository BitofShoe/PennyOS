const DEFAULT_LMSTUDIO_TOKEN_LIMITS = Object.freeze({
  maxOutputTokens: 16384,
  chatMaxOutputTokens: 8192,
  toolMaxOutputTokens: 8192,
  toolSummaryMaxOutputTokens: 4096,
  toolPlannerMaxOutputTokens: 2048,
  semanticRenderMaxOutputTokens: 4096,
});

function positiveIntegerFromEnv(env = {}, key = '', fallback = 0) {
  const raw = env?.[key];
  if (raw == null || raw === '') return fallback;
  const value = Math.trunc(Number(raw));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveLmStudioTokenLimits(env = process.env) {
  return {
    maxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.maxOutputTokens),
    chatMaxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.chatMaxOutputTokens),
    toolMaxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.toolMaxOutputTokens),
    toolSummaryMaxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.toolSummaryMaxOutputTokens),
    toolPlannerMaxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.toolPlannerMaxOutputTokens),
    semanticRenderMaxOutputTokens: positiveIntegerFromEnv(env, 'PENNY_LMSTUDIO_SEMANTIC_RENDER_MAX_OUTPUT_TOKENS', DEFAULT_LMSTUDIO_TOKEN_LIMITS.semanticRenderMaxOutputTokens),
  };
}

module.exports = {
  DEFAULT_LMSTUDIO_TOKEN_LIMITS,
  resolveLmStudioTokenLimits,
};
