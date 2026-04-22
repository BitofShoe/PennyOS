const crypto = require('node:crypto');
const {
  normalizePromptTruth,
  PROMPT_TRUTH_SCHEMA,
  PROMPT_TRUTH_HOLDBACK_REASONS,
} = require('./penny-prompttruth');

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

const QUESTION_LIKE_PATTERN = /\?|\b(what|which|who|where|when|why|how|do you|did you|did i|tell me)\b/i;
const PROJECT_SURFACE_PATTERN = /\b(?:package\.json|readme(?:\.md)?|server\.js|codebase\.md|architecture\.md|repo(?:sitory)?|branch|commit|git|file|path|url|folder|directory)\b/i;
const DIRECT_MEMORY_AUTHORITY_PATTERNS = [
  /\bwhat should you remember\b/,
  /\bwhat do you remember\b/,
  /\bwhat(?:'s| is| are| was| were)\s+my\b/,
  /\bwhat should still be true\b/,
  /\bwhat am i trusting you to remember\b/,
  /\btell me what you remember about\b/,
  /\bdo you remember where\b/,
  /\bwhere is my\b/,
  /\bwhat do you know about my\b/,
  /\bwhat\s+(?:color|colour|kind|type)\s+(?:is|was|were)\s+my\b/,
];
const CANONICAL_MEMORY_QUESTION_PATTERNS = [
  /\bwhat\b.*\bdo i\b.*\blike\b(?:.*\bagain\b)?/,
  /\bwhat\s+(?:color|colour|kind|type)\s+(?:is|was|were)\s+my\b/,
  /\bwhat(?:'s| is| are| was| were)\s+my\b.+\bagain\b/,
  /\bwhat(?:'s| is| are| was| were)\s+my\b.+\bnow\b/,
];
const WORDING_RECALL_PATTERNS = [
  /\bwhat(?:\s+exact(?:ly)?)?\s+(?:phrase|wording|words?)\s+did\s+(?:i|we|you)\s+use\b/,
  /\bwhat\s+did\s+(?:i|we|you)\s+call\b/,
  /\bwhat\s+was\s+the\s+(?:phrase|wording)\b/,
  /\banswer\s+the\s+phrase\s+first\b/,
];
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

function hasExplicitMemoryOverlap(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, now = Date.now()) {
  const queryTokens = new Set(tokenizeMemoryText(userText));
  if (!queryTokens.size) return false;
  const selected = selectMemoriesForPrompt(memories, userText, limit, now);
  return selected.some((item) => tokenizeMemoryText(item?.text || '').some((token) => queryTokens.has(token)));
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

function isQuestionLike(userText = '') {
  return QUESTION_LIKE_PATTERN.test(String(userText || '').trim());
}

function isCanonicalMemoryQuestion(userText = '', memories = null, limit = MEMORY_PROMPT_LIMIT, now = Date.now()) {
  const normalized = normalizeText(userText || '').toLowerCase();
  if (!normalized) return false;
  const directAuthorityMatch = DIRECT_MEMORY_AUTHORITY_PATTERNS.some((pattern) => pattern.test(normalized));
  const naturalRecallMatch = isQuestionLike(normalized)
    && CANONICAL_MEMORY_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!directAuthorityMatch && !naturalRecallMatch) return false;
  const explicitOverlap = memories && typeof memories === 'object'
    ? hasExplicitMemoryOverlap(memories, userText, limit, now)
    : false;
  if (PROJECT_SURFACE_PATTERN.test(normalized) && !explicitOverlap) return false;
  if (!memories || typeof memories !== 'object') return true;
  if (directAuthorityMatch) return explicitOverlap || naturalRecallMatch;
  return naturalRecallMatch && explicitOverlap;
}

function isWordingRecallQuestion(userText = '') {
  const normalized = normalizeText(userText || '').toLowerCase();
  if (!normalized) return false;
  if (PROJECT_SURFACE_PATTERN.test(normalized)) return false;
  if (!isQuestionLike(normalized) && !/\banswer\s+the\s+phrase\s+first\b/.test(normalized)) return false;
  return WORDING_RECALL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isDirectMemoryAuthorityQuestion(userText = '', memories = null, limit = MEMORY_PROMPT_LIMIT, now = Date.now()) {
  return isCanonicalMemoryQuestion(userText, memories, limit, now);
}

function shouldPrioritizeCanonicalMemoryOverHistory(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, now = Date.now()) {
  return isCanonicalMemoryQuestion(userText, memories, limit, now);
}

function stablePromptTruthSourceId(prefix = 'source', text = '') {
  const normalized = normalizeText(text || '').toLowerCase();
  if (!normalized) return '';
  return `${prefix}:${crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12)}`;
}

function memoryPromptTruthSourceId(item = {}) {
  return stablePromptTruthSourceId('memory', item?.text || '');
}

function memoryBookPromptTruthSourceId(item = {}) {
  return String(item?.id || '').trim() || stablePromptTruthSourceId('memory-book', item?.text || '');
}

function archivePromptTruthSourceId(item = {}, prefix = 'archive') {
  return String(item?.id || '').trim() || stablePromptTruthSourceId(prefix, item?.text || item?.evidenceSnippet || '');
}

function researchLedgerPromptTruthSourceId(item = {}) {
  return String(item?.topicId || '').trim() || stablePromptTruthSourceId('research-ledger', item?.topicLabel || item?.summary || item?.question || '');
}

function normalizePromptTruthHints(raw = null) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    archiveEligible: value.archiveEligible === true
      ? true
      : (value.archiveEligible === false ? false : null),
  };
}

function determinePromptTruthChannelState({
  renderedCount = 0,
  candidateCount = 0,
  heldBackReason = '',
  noCandidateKnown = false,
  ineligible = false,
  disabled = false,
} = {}) {
  const safeRenderedCount = Math.max(0, Number(renderedCount || 0));
  const safeCandidateCount = Math.max(0, Number(candidateCount || 0));
  const reason = String(heldBackReason || '').trim();
  if (safeRenderedCount > 0) return 'rendered';
  if (disabled === true || reason === PROMPT_TRUTH_HOLDBACK_REASONS.LEDGER_DISABLED) return 'disabled';
  if (safeCandidateCount > 0 && reason) return 'held_back';
  if (safeCandidateCount > 0) return 'candidate';
  if (ineligible === true) return 'ineligible';
  if (noCandidateKnown === true) return 'no_candidate';
  return 'unknown';
}

function buildPromptMemoryContext(
  memories = {},
  userText = '',
  limit = MEMORY_PROMPT_LIMIT,
  fallback = '',
  now = Date.now(),
  promptTruthHints = null,
) {
  const normalizedPromptTruthHints = normalizePromptTruthHints(promptTruthHints);
  const selected = selectMemoriesForPrompt(memories, userText, limit, now);
  const memoryBooks = selectMemoryBooksForPrompt(memories, MEMORY_BOOK_PROMPT_LIMIT);
  const memoryBookContextAvailable = !!(memories?.memoryBookContext && typeof memories.memoryBookContext === 'object');
  const archiveContext = memories?.archiveContext && typeof memories.archiveContext === 'object'
    ? memories.archiveContext
    : null;
  const archiveContextAvailable = !!(archiveContext && typeof archiveContext === 'object');
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
      .map((item) => {
        const text = normalizeText(item?.text || '');
        if (!text) return '';
        if (item?.source === 'penny-open-loop-state') return text;
        return `open question: ${text}`;
      })
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
  const initiativePromptBridge = memories?.initiativePromptBridge && typeof memories.initiativePromptBridge === 'object'
    ? memories.initiativePromptBridge
    : null;
  const turnStatePromptBridge = memories?.turnStatePromptBridge && typeof memories.turnStatePromptBridge === 'object'
    ? memories.turnStatePromptBridge
    : null;
  const researchLedgerContextAvailable = !!(researchLedgerContext && typeof researchLedgerContext === 'object');
  const researchLedgerPromptEnabled = memories?.researchLedgerPromptEnabled !== false;
  const retrievalHints = [];
  const retrievalReason = normalizeText(archiveContext?.reasonCode || '');
  const compressionUsed = archiveContext?.compression?.used === true;
  const semanticReady = archiveContext?.semanticReady === true;
  const semanticDowngrade = archiveContext?.semanticDowngrade === true;
  const semanticDowngradeReason = normalizeText(archiveContext?.semanticDowngradeReason || '').replace(/-/g, ' ');
  const directMemoryAuthorityQuestion = shouldPrioritizeCanonicalMemoryOverHistory(memories, userText, limit, now);
  const archiveAdvisoryContentPresent = Boolean(
    (archiveSynthesis?.generated && archiveSynthesis.summary)
    || globalArchive.some((item) => normalizeText(item?.text || '')),
  );
  if (
    archiveContext
    && archiveAdvisoryContentPresent
    && (!semanticReady || retrievalReason === 'keyword_fallback' || compressionUsed || semanticDowngrade)
  ) {
    const fallbackBits = [];
    if (!semanticReady) fallbackBits.push('semantic recall is unavailable');
    if (semanticDowngrade) {
      fallbackBits.push(`semantic query downgraded${semanticDowngradeReason ? ` (${semanticDowngradeReason})` : ''}`);
    }
    if (retrievalReason === 'keyword_fallback') fallbackBits.push('archive recall is running in keyword fallback');
    if (compressionUsed) fallbackBits.push('chapter compression is standing in for richer recall');
    retrievalHints.push(`retrieval caution: ${fallbackBits.join(', ')}. treat archive hints as weaker than canon.`);
  }
  if (archiveSynthesis?.generated && archiveSynthesis.summary) {
    retrievalHints.push(`archive advisory: ${archiveSynthesis.summary}`);
  }

  const sections = [];
  const stableFactLines = selected.map((item) => item.text);
  const memoryBookLines = memoryBooks.map((item) => `memory book: ${item.text}`);
  const stableFacts = [...stableFactLines, ...memoryBookLines];
  const suppressArchiveForDirectAuthority = directMemoryAuthorityQuestion && selected.length > 0;
  if (suppressArchiveForDirectAuthority) {
    stableFacts.unshift('canon priority: answer direct memory questions from these stable facts first. use archive hints only if canon is silent.');
  }
  const sessionContextEntries = sessionArchive
    .map((item) => ({
      sourceId: archivePromptTruthSourceId(item, 'archive-session'),
      text: normalizeText(item?.text || ''),
    }))
    .filter((item) => item.text);
  const sessionContext = sessionContextEntries.map((item) => item.text);
  const contradictionAndLoopLines = [
    ...correctionItems.map((item) => `correction: ${item.newText} (replaces: ${item.oldText})`),
    ...openLoops,
  ];
  const globalArchiveEntries = globalArchive
    .map((item) => ({
      sourceId: archivePromptTruthSourceId(item, 'archive-global'),
      sourceLabel: normalizeText(item?.sourceLabel || item?.source || 'archive'),
      text: normalizeText(item?.text || ''),
    }))
    .filter((item) => item.text)
    .slice(0, 2);
  for (const item of globalArchiveEntries) {
    retrievalHints.push(`${item.sourceLabel}: ${item.text}`);
  }
  const researchLedgerEntries = Array.isArray(researchLedgerContext?.topics)
    ? researchLedgerContext.topics
      .map((item) => {
        const topicLabel = normalizeText(item?.topicLabel || '');
        const summary = normalizeText(item?.summary || item?.conclusion || item?.question || '');
        const status = normalizeText(item?.status || 'advisory');
        if (!topicLabel && !summary) return null;
        return {
          sourceId: researchLedgerPromptTruthSourceId(item),
          text: summary ? `${topicLabel || 'investigation'} (${status}): ${summary}` : `${topicLabel} (${status})`,
        };
      })
      .filter(Boolean)
      .slice(0, 2)
    : [];
  const ongoingInvestigations = researchLedgerPromptEnabled
    ? researchLedgerEntries.map((item) => item.text)
    : [];
  const initiativeLines = initiativePromptBridge?.enabled === true
    && Number(initiativePromptBridge?.promptBridge?.renderedCount || 0) > 0
    && initiativePromptBridge?.promptBridge?.promptText
    ? [normalizeText(initiativePromptBridge.promptBridge.promptText)]
    : [];
  const turnStateLines = turnStatePromptBridge?.enabled === true
    && Number(turnStatePromptBridge?.promptBridge?.renderedCount || 0) > 0
    && turnStatePromptBridge?.promptBridge?.promptText
    ? [normalizeText(turnStatePromptBridge.promptBridge.promptText)]
    : [];

  const stableFactsSection = formatPromptSection('Wake state - stable facts', stableFacts);
  const turnStateSection = formatPromptSection('Wake state - current turn state (ephemeral)', turnStateLines);
  const sessionContextSection = formatPromptSection('Wake state - active session context', sessionContext);
  const contradictionSection = formatPromptSection('Wake state - contradictions/open questions', contradictionAndLoopLines);
  const investigationsSection = formatPromptSection('Wake state - ongoing investigations (advisory)', ongoingInvestigations);
  const retrievalHintsSection = formatPromptSection('Wake state - retrieval hints (advisory)', retrievalHints);
  const initiativeSection = formatPromptSection('Wake state - optional initiative (advisory)', initiativeLines);

  if (stableFactsSection) sections.push(stableFactsSection);
  if (turnStateSection) sections.push(turnStateSection);
  if (!suppressArchiveForDirectAuthority && sessionContextSection) sections.push(sessionContextSection);
  if (contradictionSection) sections.push(contradictionSection);
  if (!suppressArchiveForDirectAuthority && investigationsSection) sections.push(investigationsSection);
  if (!suppressArchiveForDirectAuthority && retrievalHintsSection) sections.push(retrievalHintsSection);
  if (!suppressArchiveForDirectAuthority && initiativeSection) sections.push(initiativeSection);

  const sessionArchiveHeldBackReason = suppressArchiveForDirectAuthority && sessionContextEntries.length
    ? PROMPT_TRUTH_HOLDBACK_REASONS.CANON_PRIORITY
    : '';
  const globalArchiveHeldBackReason = suppressArchiveForDirectAuthority && globalArchiveEntries.length
    ? PROMPT_TRUTH_HOLDBACK_REASONS.CANON_PRIORITY
    : '';
  const researchLedgerHeldBackReason = researchLedgerEntries.length
    ? (!researchLedgerPromptEnabled
      ? PROMPT_TRUTH_HOLDBACK_REASONS.LEDGER_DISABLED
      : (suppressArchiveForDirectAuthority ? PROMPT_TRUTH_HOLDBACK_REASONS.CANON_PRIORITY : ''))
    : '';
  const archivePromptIneligible = normalizedPromptTruthHints.archiveEligible === false && !archiveContextAvailable;

  return {
    text: sections.length ? sections.join('\n') : fallback,
    promptTruth: normalizePromptTruth({
      schema: PROMPT_TRUTH_SCHEMA,
      canonicalFactsPresent: selected.length > 0,
      canonicalOverrideActive: suppressArchiveForDirectAuthority,
      channels: {
        stableFacts: {
          state: determinePromptTruthChannelState({
            candidateCount: stableFactLines.length,
            renderedCount: stableFactLines.length,
            noCandidateKnown: true,
          }),
          candidateCount: stableFactLines.length,
          renderedCount: stableFactLines.length,
          candidateSourceIds: selected.map(memoryPromptTruthSourceId),
          renderedSourceIds: selected.map(memoryPromptTruthSourceId),
        },
        memoryBooks: {
          state: determinePromptTruthChannelState({
            candidateCount: memoryBooks.length,
            renderedCount: memoryBooks.length,
            noCandidateKnown: memoryBookContextAvailable,
          }),
          candidateCount: memoryBooks.length,
          renderedCount: memoryBooks.length,
          candidateSourceIds: memoryBooks.map(memoryBookPromptTruthSourceId),
          renderedSourceIds: memoryBooks.map(memoryBookPromptTruthSourceId),
        },
        sessionArchive: {
          state: determinePromptTruthChannelState({
            candidateCount: sessionContextEntries.length,
            renderedCount: suppressArchiveForDirectAuthority ? 0 : sessionContextEntries.length,
            heldBackReason: sessionArchiveHeldBackReason,
            noCandidateKnown: archiveContextAvailable,
            ineligible: archivePromptIneligible,
          }),
          candidateCount: sessionContextEntries.length,
          renderedCount: suppressArchiveForDirectAuthority ? 0 : sessionContextEntries.length,
          candidateSourceIds: sessionContextEntries.map((item) => item.sourceId),
          renderedSourceIds: suppressArchiveForDirectAuthority ? [] : sessionContextEntries.map((item) => item.sourceId),
          heldBackReason: sessionArchiveHeldBackReason,
        },
        globalArchive: {
          state: determinePromptTruthChannelState({
            candidateCount: globalArchiveEntries.length,
            renderedCount: suppressArchiveForDirectAuthority ? 0 : globalArchiveEntries.length,
            heldBackReason: globalArchiveHeldBackReason,
            noCandidateKnown: archiveContextAvailable,
            ineligible: archivePromptIneligible,
          }),
          candidateCount: globalArchiveEntries.length,
          renderedCount: suppressArchiveForDirectAuthority ? 0 : globalArchiveEntries.length,
          candidateSourceIds: globalArchiveEntries.map((item) => item.sourceId),
          renderedSourceIds: suppressArchiveForDirectAuthority ? [] : globalArchiveEntries.map((item) => item.sourceId),
          heldBackReason: globalArchiveHeldBackReason,
        },
        researchLedger: {
          state: determinePromptTruthChannelState({
            candidateCount: researchLedgerEntries.length,
            renderedCount: (!researchLedgerPromptEnabled || suppressArchiveForDirectAuthority) ? 0 : researchLedgerEntries.length,
            heldBackReason: researchLedgerHeldBackReason,
            noCandidateKnown: researchLedgerPromptEnabled && researchLedgerContextAvailable,
            disabled: !researchLedgerPromptEnabled,
          }),
          candidateCount: researchLedgerEntries.length,
          renderedCount: (!researchLedgerPromptEnabled || suppressArchiveForDirectAuthority) ? 0 : researchLedgerEntries.length,
          candidateSourceIds: researchLedgerEntries.map((item) => item.sourceId),
          renderedSourceIds: (!researchLedgerPromptEnabled || suppressArchiveForDirectAuthority)
            ? []
            : researchLedgerEntries.map((item) => item.sourceId),
          heldBackReason: researchLedgerHeldBackReason,
        },
      },
    }),
  };
}

function buildPromptTruth(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, fallback = '', now = Date.now(), promptTruthHints = null) {
  return buildPromptMemoryContext(memories, userText, limit, fallback, now, promptTruthHints).promptTruth;
}

function formatPromptMemories(memories = {}, userText = '', limit = MEMORY_PROMPT_LIMIT, fallback = '', now = Date.now(), promptTruthHints = null) {
  return buildPromptMemoryContext(memories, userText, limit, fallback, now, promptTruthHints).text;
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
  buildPromptMemoryContext,
  formatPromptMemories,
  injectRelevantMemoryContext,
  selectMemoriesForPrompt,
  buildPromptTruth,
  normalizePromptTruth,
  isCanonicalMemoryQuestion,
  isWordingRecallQuestion,
  isDirectMemoryAuthorityQuestion,
  shouldPrioritizeCanonicalMemoryOverHistory,
  selectMemoryBooksForPrompt,
  formatPromptSection,
  tokenizeMemoryText,
  scoreMemoryForPrompt,
  PROMPT_TRUTH_HOLDBACK_REASONS,
  PROMPT_TRUTH_SCHEMA,
};
