const MEMORY_ENTRY_LIMIT = 30;
const MEMORY_PROMPT_LIMIT = 12;
const MEMORY_RELEVANT_LIMIT = 6;

const MEMORY_KIND_SCORES = {
  explicit: 8,
  personal: 6,
  preference: 5,
  observation: 4,
};

const MEMORY_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'been', 'being', 'came', 'come', 'dont', 'from', 'have', 'just',
  'know', 'like', 'maybe', 'more', 'really', 'said', 'some', 'that', 'their', 'them', 'then', 'there',
  'they', 'this', 'very', 'want', 'with', 'would', 'your',
]);

function normalizeText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim().replace(/[.!?;,\s]+$/g, '');
}

function normalizeMemoryKind(value = '') {
  const kind = String(value || '').trim().toLowerCase();
  return kind || 'memory';
}

function normalizeMemoryItem(item, now = Date.now()) {
  if (!item?.text) return null;
  const text = normalizeText(item.text);
  if (!text || text.length < 3 || text.length > 220) return null;
  const ts = Number(item.ts);
  return {
    text,
    kind: normalizeMemoryKind(item.kind),
    ts: Number.isFinite(ts) ? ts : now,
  };
}

function mergeMemoryItems(items = [], limit = MEMORY_ENTRY_LIMIT, now = Date.now()) {
  const seen = new Set();
  const merged = [];
  for (const raw of items) {
    const item = normalizeMemoryItem(raw, now);
    if (!item) continue;
    const key = normalizeText(item.text).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

function tokenizeMemoryText(text = '') {
  const matches = String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  return [...new Set(matches.filter((token) => !MEMORY_STOPWORDS.has(token)))];
}

function scoreMemoryForPrompt(item, queryTokens = new Set(), now = Date.now()) {
  const baseScore = MEMORY_KIND_SCORES[item?.kind] || 2;
  const itemTokens = tokenizeMemoryText(item?.text || '');
  let score = baseScore;
  if (queryTokens.size && itemTokens.length) {
    let overlap = 0;
    for (const token of itemTokens) {
      if (queryTokens.has(token)) overlap += 1;
    }
    score += overlap * 6;
    if (overlap) score += overlap / itemTokens.length;
  }
  const ts = Number(item?.ts);
  if (Number.isFinite(ts)) {
    const ageDays = Math.max(0, now - ts) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 2 - Math.min(2, ageDays / 7));
  }
  return score;
}

function selectMemoriesForPrompt(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, now = Date.now()) {
  const items = mergeMemoryItems(memories?.memories || [], MEMORY_ENTRY_LIMIT, now);
  if (!items.length) return [];
  const queryTokens = new Set(tokenizeMemoryText(userText));
  return items
    .map((item, index) => ({ item, index, score: scoreMemoryForPrompt(item, queryTokens, now) }))
    .sort((left, right) => right.score - left.score || (right.item.ts || 0) - (left.item.ts || 0) || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function formatPromptMemories(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, fallback = '', now = Date.now()) {
  const selected = selectMemoriesForPrompt(memories, userText, limit, now);
  if (!selected.length) return fallback;
  return selected.map((item) => `- ${item.text}`).join('\n');
}

function injectRelevantMemoryContext(text = '', memories = {}, userText = '', limit = MEMORY_RELEVANT_LIMIT, now = Date.now()) {
  const relevant = formatPromptMemories(memories, userText, limit, '', now);
  if (!relevant) return text;
  return `Relevant memory for this reply:\n${relevant}\n\nCurrent user message:\n${text}`;
}

module.exports = {
  MEMORY_ENTRY_LIMIT,
  MEMORY_PROMPT_LIMIT,
  MEMORY_RELEVANT_LIMIT,
  normalizeText,
  mergeMemoryItems,
  formatPromptMemories,
  injectRelevantMemoryContext,
  selectMemoriesForPrompt,
  tokenizeMemoryText,
  scoreMemoryForPrompt,
};
