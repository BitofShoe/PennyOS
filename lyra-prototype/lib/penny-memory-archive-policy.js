function createMemoryArchivePolicyApi({
  sessionActiveContradictionLimit = 12,
  sessionChapterLimit = 6,
  sessionChapterTriggerCount = 10,
  sessionRecencyProtectedEpisodeCount = 6,
  compressionRetrievalConfidence = 0.48,
  sessionPromptLimit = 2,
  archiveCompressionReasonCodes = {},
  chapterScaffoldingPatterns = [],
  chapterDetailBonusPatterns = [],
  normalizeContradictionList = (items = []) => (Array.isArray(items) ? items : []),
  isActiveContradiction = () => true,
  textMentionsNeedle = (text = '', needle = '') => String(text || '').toLowerCase().includes(String(needle || '').toLowerCase()),
  trimText = (value = '', limit = 1600) => String(value || '').slice(0, limit),
  findRelevantContradictionsForChunk = () => [],
  formatContradictionForChapter = () => '',
  buildRollingSummaryText = () => '',
  normalizeRetrievalItem = (item) => item,
  tokenizeMemoryText = () => [],
  cosineSimilarity = () => 0,
  trimIso = (value = '') => String(value || '').trim(),
  normalizeEvidenceIds = (items = []) => (Array.isArray(items) ? items : []),
} = {}) {
  function buildArchiveCandidate(entry = {}, scope = 'global', sourceType = 'archive') {
    return {
      id: String(entry.id || '').trim(),
      text: trimText(entry.text || entry.excerpt || entry.userText || '', 220),
      sourceType,
      scope,
      createdAt: trimIso(entry.createdAt),
      sensitivity: entry.sensitivity === 'high' ? 'high' : 'normal',
      sourceEpisodeIds: normalizeEvidenceIds(entry.sourceEpisodeIds || entry.evidenceIds || []),
    };
  }

  function scoreArchiveCandidate(candidate = {}, queryTokens = new Set(), now = Date.now(), queryVector = null, vector = null) {
    const tokens = tokenizeMemoryText(candidate.text || '');
    const overlapTokens = tokens.filter((token) => queryTokens.has(token)).slice(0, 6);
    let score = candidate.sourceType === 'pattern' ? 3.5 : candidate.sourceType === 'summary' ? 3 : 2.5;
    score += overlapTokens.length * 2.25;
    if (queryVector && vector) score += Math.max(0, cosineSimilarity(queryVector, vector)) * 8;
    const createdAtMs = Date.parse(candidate.createdAt || '');
    if (Number.isFinite(createdAtMs)) {
      const ageDays = Math.max(0, now - createdAtMs) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 1.5 - Math.min(1.5, ageDays / 14));
    }
    if (candidate.scope === 'session') score += 0.75;
    if (candidate.sensitivity === 'high') score -= 1.5;
    return {
      score,
      overlapTokens,
      evidenceSnippet: trimText(candidate.text || '', 160),
    };
  }

  function looksLikeScaffoldingText(text = '') {
    const source = trimText(text, 220);
    if (!source) return true;
    return chapterScaffoldingPatterns.some((pattern) => pattern.test(source));
  }

  function scoreChapterDetailText(text = '', activeContradictions = []) {
    const source = trimText(text, 220);
    if (!source) return -100;
    if (looksLikeScaffoldingText(source)) return -20;
    const words = source.split(/\s+/).length;
    let score = 0;
    if (words >= 5 && words <= 18) score += 3;
    else if (words <= 24) score += 1.5;
    for (const pattern of chapterDetailBonusPatterns) {
      if (pattern.test(source)) score += 2;
    }
    if (/\b(i|my)\b/i.test(source)) score += 0.5;
    if (/[,:;]/.test(source)) score += 0.5;
    for (const contradiction of normalizeContradictionList(activeContradictions, sessionActiveContradictionLimit)) {
      if (!isActiveContradiction(contradiction)) continue;
      if (textMentionsNeedle(source, contradiction.newText)) score += 5;
      if (textMentionsNeedle(source, contradiction.oldText) && !textMentionsNeedle(source, contradiction.newText)) score -= 6;
    }
    return score;
  }

  function buildSessionChapterText(texts = [], activeContradictions = [], sourceEpisodeIds = []) {
    const candidates = [];
    const seen = new Set();
    for (const raw of texts) {
      const text = trimText(raw, 220);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        text,
        score: scoreChapterDetailText(text, activeContradictions),
      });
    }
    for (const contradiction of findRelevantContradictionsForChunk(activeContradictions, sourceEpisodeIds, texts)) {
      const text = formatContradictionForChapter(contradiction);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        text,
        score: 12,
      });
    }
    const selected = candidates
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
      .slice(0, 4)
      .map((item) => item.text.replace(/[.!?]+$/g, ''));
    if (!selected.length) return '';
    return trimText(`Session chapter: ${selected.join('; ')}.`, 220);
  }

  function buildSessionChapters(session = {}) {
    const allEpisodes = Array.isArray(session.episodes) ? session.episodes.slice(-30) : [];
    if (allEpisodes.length < sessionChapterTriggerCount) return [];
    const protectedRecentCount = Math.min(
      sessionRecencyProtectedEpisodeCount,
      Math.max(0, allEpisodes.length - 4),
    );
    const episodes = protectedRecentCount ? allEpisodes.slice(0, -protectedRecentCount) : allEpisodes;
    if (episodes.length < 4) return [];
    const chapters = [];
    const activeContradictions = normalizeContradictionList(session.activeContradictions, sessionActiveContradictionLimit)
      .filter(isActiveContradiction);
    for (let start = 0; start < episodes.length; start += 6) {
      const chunk = episodes.slice(start, start + 8);
      if (chunk.length < 4) continue;
      const texts = chunk.map((item) => item.userText || item.text || '');
      const sourceEpisodeIds = chunk.map((item) => item.id).filter(Boolean);
      const chunkContradictions = findRelevantContradictionsForChunk(activeContradictions, sourceEpisodeIds, texts);
      const contradictionFallback = chunkContradictions.length
        ? trimText(`Session chapter: ${chunkContradictions.map((item) => formatContradictionForChapter(item)).filter(Boolean).slice(0, 2).join('; ')}.`, 220)
        : '';
      const summary = buildSessionChapterText(texts, chunkContradictions, sourceEpisodeIds)
        || contradictionFallback
        || buildRollingSummaryText('Session chapter', texts, 2);
      if (!summary) continue;
      chapters.push({
        summary,
        sourceEpisodeIds,
        confidence: Math.max(0.4, Math.min(0.88, 0.38 + (chunk.length * 0.05))),
        createdAt: chunk[chunk.length - 1]?.createdAt || '',
      });
    }
    return chapters.slice(-sessionChapterLimit);
  }

  function buildCompressionExplanation({
    chapterItems = [],
    session = {},
    carriedContradictions = [],
  } = {}) {
    const chapterText = chapterItems.map((item) => item?.text || '').join('\n');
    const selectedSignals = [];
    if (carriedContradictions.length) selectedSignals.push('active-contradiction');
    if (chapterDetailBonusPatterns[0]?.test(chapterText)) selectedSignals.push('color-anchor');
    if (chapterDetailBonusPatterns[1]?.test(chapterText)) selectedSignals.push('numeric-anchor');
    if (chapterDetailBonusPatterns[2]?.test(chapterText)) selectedSignals.push('named-object-anchor');
    const penalties = [];
    const recentEpisodeTexts = Array.isArray(session?.episodes)
      ? session.episodes.slice(-30).map((item) => item?.userText || item?.text || '')
      : [];
    if (recentEpisodeTexts.some((text) => looksLikeScaffoldingText(text))) penalties.push('scaffolding-filter');
    if (carriedContradictions.some((item) => recentEpisodeTexts.some((text) => textMentionsNeedle(text, item.oldText)))) {
      penalties.push('superseded-fact-filter');
    }
    return {
      selectedSignals,
      penalties,
      omittedEpisodeCount: Math.max(0, (Array.isArray(session?.episodes) ? session.episodes.length : 0) - chapterItems.length),
      carriedContradictions: carriedContradictions.map((item) => ({
        ...item,
        status: 'active',
      })),
    };
  }

  async function buildCompressionState({
    candidateGroups = {},
    session = {},
    semanticMemory = {},
    strongestConfidence = 0,
    activeContradictions = [],
    sessionItems = [],
    rankGroup = async () => [],
  } = {}) {
    const shouldUseCompression = Array.isArray(candidateGroups.chapters)
      && candidateGroups.chapters.length > 0
      && Array.isArray(session.episodes)
      && session.episodes.length >= sessionChapterTriggerCount
      && (!semanticMemory.ready || strongestConfidence < compressionRetrievalConfidence);
    const chapterItems = shouldUseCompression
      ? await rankGroup(candidateGroups.chapters, 1)
      : [];
    const carriedMap = new Map();
    for (const chapter of chapterItems) {
      for (const contradiction of findRelevantContradictionsForChunk(activeContradictions, chapter?.sourceEpisodeIds || [], [chapter?.text || ''])) {
        if (contradiction?.id) carriedMap.set(contradiction.id, contradiction);
      }
    }
    const carriedContradictions = [...carriedMap.values()];
    const combinedSessionItems = chapterItems.length
      ? uniqueCandidateList([...sessionItems, ...chapterItems], sessionPromptLimit)
      : sessionItems;
    const compression = {
      used: chapterItems.length > 0,
      reason: chapterItems.length
        ? (!semanticMemory.ready ? 'semantic-unavailable' : 'low-retrieval-confidence')
        : '',
      reasonCode: chapterItems.length
        ? (!semanticMemory.ready
          ? archiveCompressionReasonCodes.SEMANTIC_UNAVAILABLE
          : archiveCompressionReasonCodes.LOW_RETRIEVAL_CONFIDENCE)
        : archiveCompressionReasonCodes.NOT_NEEDED,
      chapters: chapterItems.map(normalizeRetrievalItem).filter(Boolean),
      explanation: buildCompressionExplanation({
        chapterItems,
        session,
        carriedContradictions,
      }),
    };
    return {
      chapterItems,
      carriedContradictions,
      combinedSessionItems,
      compression,
    };
  }

  function uniqueCandidateList(items = [], limit = 2) {
    const seen = new Set();
    const output = [];
    for (const item of items) {
      const key = String(item?.id || item?.text || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(item);
      if (output.length >= limit) break;
    }
    return output;
  }

  return {
    buildArchiveCandidate,
    buildCompressionExplanation,
    buildCompressionState,
    scoreArchiveCandidate,
    buildSessionChapterText,
    buildSessionChapters,
    looksLikeScaffoldingText,
    scoreChapterDetailText,
  };
}

module.exports = {
  createMemoryArchivePolicyApi,
};
