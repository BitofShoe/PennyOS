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
    policyMode: 'bounded-approximate',
    approximateByPolicy: true,
    policyNote: 'Keep advisory recall narrow and skip semantic retrieval unless the turn explicitly becomes memory-heavy.',
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
    policyMode: 'recall-heavy',
    approximateByPolicy: false,
    policyNote: 'Spend more budget on explicit recall, semantic retrieval, and chapter fallback when ambiguity or correction pressure is high.',
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
    policyMode: 'deterministic-priority',
    approximateByPolicy: true,
    policyNote: 'Prefer verified tool execution over broad advisory recall and only use extra rendering passes when they directly support the tool result.',
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
    policyMode: 'attachment-bounded',
    approximateByPolicy: true,
    policyNote: 'Keep the prompt compact so image context and attachment handling stay responsive.',
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

const MEMORY_HEAVY_RECALL_PATTERNS = [
  /\bremember\b/i,
  /\brecall\b/i,
  /\bwhat should you remember\b/i,
  /\bwhat do you remember\b/i,
  /\bwhat should still be true\b/i,
  /\bwhat am i trusting you to remember\b/i,
  /\btell me what you remember about\b/i,
  /\bdo you remember where\b/i,
  /\bwhat do you know about my\b/i,
  /\bwhat (?:did|do) (?:i|we|you) (?:say|tell|mention|remember)\b/i,
];

const MEMORY_HEAVY_UPDATE_PATTERNS = [
  /\b(?:actually|correction)\b/i,
  /\b(?:used to|not anymore|replace(?:d)?|correction)\b/i,
  /\bi (?:changed|switched|replaced)\b/i,
];

const MEMORY_CANONICAL_QUESTION_PATTERNS = [
  /\bwhere is my\b/i,
  /\bwhat (?:is|are|was|were)\s+my\b/i,
  /\bwhat\b.*\bdo i\b.*\blike\b/i,
  /\bwhat do you know about my\b/i,
];

const MEMORY_CANONICAL_ANCHOR_PATTERN = /\b(?:tea|drink|pet|mascot|name|birthday|pronouns?|notebook|setup)\b/i;
const QUESTION_LIKE_PATTERN = /\?|\b(what|which|who|where|when|why|how|do you|did you|did i|tell me)\b/i;

function isQuestionLike(userText = '') {
  return QUESTION_LIKE_PATTERN.test(String(userText || '').trim());
}

function looksCanonicalMemoryQuestion(userText = '') {
  const text = String(userText || '').trim();
  if (!text || !isQuestionLike(text)) return false;
  if (!MEMORY_CANONICAL_ANCHOR_PATTERN.test(text)) return false;
  return MEMORY_CANONICAL_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function cloneBudget(budget = LATENCY_BUDGETS[LATENCY_CLASSES.CASUAL_COMPANION]) {
  return {
    latencyClass: budget.latencyClass,
    label: budget.label,
    policyMode: budget.policyMode,
    approximateByPolicy: budget.approximateByPolicy === true,
    policyNote: budget.policyNote,
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
  return MEMORY_HEAVY_RECALL_PATTERNS.some((pattern) => pattern.test(text))
    || MEMORY_HEAVY_UPDATE_PATTERNS.some((pattern) => pattern.test(text))
    || looksCanonicalMemoryQuestion(text);
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
  looksMemoryHeavy,
  classifyLatencyTurn,
  getLatencyBudget,
  resolveLatencyBudget,
};
