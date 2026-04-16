const LATENCY_CLASSES = Object.freeze({
  CASUAL_COMPANION: 'casual-companion',
  MEMORY_HEAVY_RECALL: 'memory-heavy-recall',
  TOOL_HEAVY: 'tool-heavy',
  IMAGE_HEAVY: 'image-heavy',
});

const LATENCY_BUDGETS = Object.freeze({
  [LATENCY_CLASSES.CASUAL_COMPANION]: Object.freeze({
    latencyClass: LATENCY_CLASSES.CASUAL_COMPANION,
    label: 'Casual companion turn',
    recentHistoryCount: 6,
    memoryPromptLimit: 8,
    archiveSessionLimit: 1,
    archiveGlobalLimit: 1,
    allowSemanticQuery: false,
    allowArchiveCompression: false,
    includeExamples: false,
    allowSemanticRender: false,
    maxOutputTokens: 900,
  }),
  [LATENCY_CLASSES.MEMORY_HEAVY_RECALL]: Object.freeze({
    latencyClass: LATENCY_CLASSES.MEMORY_HEAVY_RECALL,
    label: 'Memory-heavy recall turn',
    recentHistoryCount: 10,
    memoryPromptLimit: 12,
    archiveSessionLimit: 2,
    archiveGlobalLimit: 2,
    allowSemanticQuery: true,
    allowArchiveCompression: true,
    includeExamples: true,
    allowSemanticRender: false,
    maxOutputTokens: 1200,
  }),
  [LATENCY_CLASSES.TOOL_HEAVY]: Object.freeze({
    latencyClass: LATENCY_CLASSES.TOOL_HEAVY,
    label: 'Tool-heavy turn',
    recentHistoryCount: 4,
    memoryPromptLimit: 8,
    archiveSessionLimit: 0,
    archiveGlobalLimit: 0,
    allowSemanticQuery: false,
    allowArchiveCompression: false,
    includeExamples: false,
    allowSemanticRender: true,
    maxOutputTokens: 1400,
  }),
  [LATENCY_CLASSES.IMAGE_HEAVY]: Object.freeze({
    latencyClass: LATENCY_CLASSES.IMAGE_HEAVY,
    label: 'Image-heavy turn',
    recentHistoryCount: 4,
    memoryPromptLimit: 6,
    archiveSessionLimit: 1,
    archiveGlobalLimit: 0,
    allowSemanticQuery: false,
    allowArchiveCompression: false,
    includeExamples: false,
    allowSemanticRender: false,
    maxOutputTokens: 900,
  }),
});

const MEMORY_HEAVY_PATTERNS = [
  /\bremember\b/i,
  /\bwhat (?:did|do) (?:i|we|you) (?:say|tell|mention|remember)\b/i,
  /\b(?:earlier|before|last time|now|still)\b/i,
  /\b(?:favorite|favourite|prefer|preference)\b/i,
  /\b(?:used to|not anymore|replace(?:d)?|correction)\b/i,
  /\b(?:my|our) (?:tea|drink|pet|mascot|name|birthday|pronouns?)\b/i,
];

function cloneBudget(budget = LATENCY_BUDGETS[LATENCY_CLASSES.CASUAL_COMPANION]) {
  return {
    latencyClass: budget.latencyClass,
    label: budget.label,
    recentHistoryCount: budget.recentHistoryCount,
    memoryPromptLimit: budget.memoryPromptLimit,
    archiveSessionLimit: budget.archiveSessionLimit,
    archiveGlobalLimit: budget.archiveGlobalLimit,
    allowSemanticQuery: budget.allowSemanticQuery,
    allowArchiveCompression: budget.allowArchiveCompression,
    includeExamples: budget.includeExamples,
    allowSemanticRender: budget.allowSemanticRender,
    maxOutputTokens: budget.maxOutputTokens,
  };
}

function looksMemoryHeavy(userText = '') {
  const text = String(userText || '').trim();
  if (!text) return false;
  return MEMORY_HEAVY_PATTERNS.some((pattern) => pattern.test(text));
}

function classifyLatencyTurn({
  userText = '',
  lane = 'chat',
  image = null,
  file = null,
  attachmentType = 'none',
} = {}) {
  const normalizedLane = String(lane || 'chat').trim().toLowerCase() || 'chat';
  const normalizedAttachmentType = String(attachmentType || 'none').trim().toLowerCase() || 'none';
  if (image || normalizedAttachmentType === 'image') return LATENCY_CLASSES.IMAGE_HEAVY;
  if (file || normalizedAttachmentType === 'file' || normalizedLane === 'tool') return LATENCY_CLASSES.TOOL_HEAVY;
  if (looksMemoryHeavy(userText)) return LATENCY_CLASSES.MEMORY_HEAVY_RECALL;
  return LATENCY_CLASSES.CASUAL_COMPANION;
}

function getLatencyBudget(latencyClass = LATENCY_CLASSES.CASUAL_COMPANION) {
  return cloneBudget(LATENCY_BUDGETS[latencyClass] || LATENCY_BUDGETS[LATENCY_CLASSES.CASUAL_COMPANION]);
}

function resolveLatencyBudget(options = {}) {
  const latencyClass = classifyLatencyTurn(options);
  return getLatencyBudget(latencyClass);
}

module.exports = {
  LATENCY_CLASSES,
  LATENCY_BUDGETS,
  classifyLatencyTurn,
  getLatencyBudget,
  resolveLatencyBudget,
};
