const MEMORY_ENTRY_LIMIT = 30;
const MEMORY_PROMPT_LIMIT = 12;
const MEMORY_RELEVANT_LIMIT = 6;
const MEMORY_BOOK_PROMPT_LIMIT = 2;

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

function normalizeMemorySource(value = '', fallback = 'explicit') {
  const source = String(value || '').trim().toLowerCase();
  if (['explicit', 'archive-session', 'archive-global', 'review-candidate', 'book', 'correction'].includes(source)) {
    return source;
  }
  return fallback;
}

function normalizeMemoryEvidence(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = normalizeText(value || '');
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= 4) break;
  }
  return output;
}

function normalizeMemoryOrigin(value = null) {
  if (!value || typeof value !== 'object') return null;
  const sourceType = normalizeText(value.sourceType || value.type || '');
  const scope = normalizeText(value.scope || '');
  const queueId = normalizeText(value.queueId || value.id || '');
  const sourceId = normalizeText(value.sourceId || '');
  const evidenceSnippet = normalizeText(value.evidenceSnippet || value.snippet || '');
  const sourceThreadId = normalizeText(value.sourceThreadId || value.threadId || '');
  const sourceChunkId = normalizeText(value.sourceChunkId || value.chunkId || '');
  const sourceTurnIds = Array.isArray(value.sourceTurnIds)
    ? value.sourceTurnIds.map((item) => normalizeText(item || '')).filter(Boolean).slice(0, 12)
    : [];
  const temporalScope = value.temporalScope && typeof value.temporalScope === 'object'
    ? {
        label: normalizeText(value.temporalScope.label || ''),
        observedAt: normalizeText(value.temporalScope.observedAt || ''),
        startAt: normalizeText(value.temporalScope.startAt || ''),
        endAt: normalizeText(value.temporalScope.endAt || ''),
      }
    : null;
  if (!sourceType && !scope && !queueId && !sourceId && !evidenceSnippet && !sourceThreadId && !sourceChunkId && !sourceTurnIds.length && !temporalScope) return null;
  return {
    sourceType,
    scope,
    queueId,
    sourceId,
    evidenceSnippet,
    sourceThreadId,
    sourceChunkId,
    sourceTurnIds,
    temporalScope,
  };
}

function normalizeMemoryItem(item, now = Date.now()) {
  if (!item?.text) return null;
  const text = normalizeText(item.text);
  if (!text || text.length < 3 || text.length > 220) return null;
  const ts = Number(item.ts);
  const source = normalizeMemorySource(item.source, 'explicit');
  return {
    text,
    kind: normalizeMemoryKind(item.kind),
    ts: Number.isFinite(ts) ? ts : now,
    source,
    evidence: normalizeMemoryEvidence(item.evidence || []),
    origin: normalizeMemoryOrigin(item.origin),
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

function selectMemoryBooksForPrompt(memories = {}, limit = MEMORY_BOOK_PROMPT_LIMIT) {
  const matches = Array.isArray(memories?.memoryBookContext?.matches)
    ? memories.memoryBookContext.matches
    : [];
  const seen = new Set();
  return matches
    .map((item, index) => ({
      index,
      id: String(item?.id || '').trim(),
      text: normalizeText(item?.text || ''),
      priority: Number(item?.priority || 0),
      score: Number(item?.score || 0),
    }))
    .filter((item) => item.text)
    .sort((left, right) => right.score - left.score || right.priority - left.priority || left.index - right.index)
    .filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function formatPromptSection(label, lines = []) {
  const items = (Array.isArray(lines) ? lines : [])
    .map((line) => normalizeText(line || ''))
    .filter(Boolean);
  if (!items.length) return '';
  return `${label}:\n${items.map((line) => `- ${line}`).join('\n')}`;
}

function formatPromptMemories(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, fallback = '', now = Date.now()) {
  const selected = selectMemoriesForPrompt(memories, userText, limit, now);
  const memoryBooks = selectMemoryBooksForPrompt(memories, MEMORY_BOOK_PROMPT_LIMIT);
  const archiveContext = memories?.archiveContext && typeof memories.archiveContext === 'object'
    ? memories.archiveContext
    : null;
  const activeContradictions = Array.isArray(archiveContext?.activeContradictions)
    ? archiveContext.activeContradictions
      .map((item) => ({
        oldText: normalizeText(item?.oldText || ''),
        newText: normalizeText(item?.newText || ''),
      }))
      .filter((item) => item.oldText && item.newText && item.oldText.toLowerCase() !== item.newText.toLowerCase())
      .slice(0, 2)
    : [];
  const provenance = Array.isArray(archiveContext?.provenance)
    ? archiveContext.provenance
      .map((item) => ({
        oldText: normalizeText(item?.oldText || ''),
        newText: normalizeText(item?.newText || ''),
      }))
      .filter((item) => item.oldText && item.newText && item.oldText.toLowerCase() !== item.newText.toLowerCase())
      .slice(0, 2)
    : [];
  const correctionItems = activeContradictions.length ? activeContradictions : provenance;
  const openLoops = Array.isArray(archiveContext?.openLoops)
    ? archiveContext.openLoops
      .map((item) => normalizeText(item?.text || ''))
      .filter(Boolean)
      .slice(0, 2)
    : [];
  const sessionArchive = Array.isArray(archiveContext?.session) ? archiveContext.session.slice(0, 2) : [];
  const globalArchive = Array.isArray(archiveContext?.global) ? archiveContext.global.slice(0, 2) : [];
  const archiveSynthesis = memories?.archiveSynthesis && typeof memories.archiveSynthesis === 'object'
    ? memories.archiveSynthesis
    : null;
  const researchLedgerContext = memories?.researchLedgerContext && typeof memories.researchLedgerContext === 'object'
    ? memories.researchLedgerContext
    : null;
  const researchLedgerPromptEnabled = memories?.researchLedgerPromptEnabled !== false;
  const retrievalHints = [];
  const retrievalReason = normalizeText(archiveContext?.reasonCode || '');
  const compressionUsed = archiveContext?.compression?.used === true;
  const semanticReady = archiveContext?.semanticReady === true;
  const archiveAdvisoryContentPresent = Boolean(
    (archiveSynthesis?.generated && archiveSynthesis.summary)
    || globalArchive.some((item) => normalizeText(item?.text || '')),
  );
  if (
    archiveContext
    && archiveAdvisoryContentPresent
    && (!semanticReady || retrievalReason === 'keyword_fallback' || compressionUsed)
  ) {
    const fallbackBits = [];
    if (!semanticReady) fallbackBits.push('semantic recall is unavailable');
    if (retrievalReason === 'keyword_fallback') fallbackBits.push('archive recall is running in keyword fallback');
    if (compressionUsed) fallbackBits.push('chapter compression is standing in for richer recall');
    retrievalHints.push(`retrieval caution: ${fallbackBits.join(', ')}. treat archive hints as weaker than canon.`);
  }
  if (archiveSynthesis?.generated && archiveSynthesis.summary) {
    retrievalHints.push(`archive advisory: ${archiveSynthesis.summary}`);
  }
  for (const item of globalArchive) {
    const sourceLabel = normalizeText(item?.sourceLabel || item?.source || 'archive');
    const text = normalizeText(item?.text || '');
    if (!text) continue;
    retrievalHints.push(`${sourceLabel}: ${text}`);
  }

  const sections = [];
  const stableFacts = [];
  stableFacts.push(...selected.map((item) => item.text));
  stableFacts.push(...memoryBooks.map((item) => `memory book: ${item.text}`));
  const sessionContext = sessionArchive
    .map((item) => normalizeText(item?.text || ''))
    .filter(Boolean);
  const contradictionAndLoopLines = [
    ...correctionItems.map((item) => `correction: ${item.newText} (replaces: ${item.oldText})`),
    ...openLoops.map((item) => `open question: ${item}`),
  ];
  const ongoingInvestigations = researchLedgerPromptEnabled && Array.isArray(researchLedgerContext?.topics)
    ? researchLedgerContext.topics
      .map((item) => {
        const topicLabel = normalizeText(item?.topicLabel || '');
        const summary = normalizeText(item?.summary || item?.conclusion || item?.question || '');
        const status = normalizeText(item?.status || 'advisory');
        if (!topicLabel && !summary) return '';
        if (summary) return `${topicLabel || 'investigation'} (${status}): ${summary}`;
        return `${topicLabel} (${status})`;
      })
      .filter(Boolean)
      .slice(0, 2)
    : [];

  const stableFactsSection = formatPromptSection('Wake state - stable facts', stableFacts);
  const sessionContextSection = formatPromptSection('Wake state - active session context', sessionContext);
  const contradictionSection = formatPromptSection('Wake state - contradictions/open questions', contradictionAndLoopLines);
  const investigationsSection = formatPromptSection('Wake state - ongoing investigations (advisory)', ongoingInvestigations);
  const retrievalHintsSection = formatPromptSection('Wake state - retrieval hints (advisory)', retrievalHints);

  if (stableFactsSection) sections.push(stableFactsSection);
  if (sessionContextSection) sections.push(sessionContextSection);
  if (contradictionSection) sections.push(contradictionSection);
  if (investigationsSection) sections.push(investigationsSection);
  if (retrievalHintsSection) sections.push(retrievalHintsSection);
  if (!sections.length) return fallback;
  return sections.join('\n');
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
  MEMORY_BOOK_PROMPT_LIMIT,
  normalizeText,
  mergeMemoryItems,
  formatPromptMemories,
  injectRelevantMemoryContext,
  selectMemoriesForPrompt,
  selectMemoryBooksForPrompt,
  formatPromptSection,
  tokenizeMemoryText,
  scoreMemoryForPrompt,
};
