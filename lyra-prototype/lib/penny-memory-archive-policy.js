const {
  scoreMemoryLinkShadowForCandidate,
} = require('./penny-memory-link-policy');

const ARCHIVE_SCORING_PROFILES = Object.freeze({
  BASELINE: 'baseline',
  HYBRID_V1: 'hybrid-v1',
});

const RERANK_SHADOW_PROVIDERS = Object.freeze({
  FIXTURE: 'fixture-reranker',
});

const RERANK_SHADOW_MEASUREMENT_MODES = Object.freeze({
  FIXTURE: 'shadow-fixture',
  UNAVAILABLE: 'unavailable',
});

function normalizeArchiveScoringProfile(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === ARCHIVE_SCORING_PROFILES.HYBRID_V1) return ARCHIVE_SCORING_PROFILES.HYBRID_V1;
  return ARCHIVE_SCORING_PROFILES.BASELINE;
}

function normalizeRerankShadowProvider(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === '0' || text === 'off' || text === 'none' || text === 'disabled') return '';
  if (text === 'fixture' || text === RERANK_SHADOW_PROVIDERS.FIXTURE) return RERANK_SHADOW_PROVIDERS.FIXTURE;
  return text.replace(/\s+/g, '-');
}

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
  function formatScoreComponent(value = 0) {
    const number = Number(value || 0);
    const prefix = number >= 0 ? '+' : '';
    return `${prefix}${number.toFixed(2)}`;
  }

  function formatSimilarity(value = 0) {
    return Number(value || 0).toFixed(2);
  }

  function roundShadowScore(value = 0) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * 1000) / 1000;
  }

  function normalizeStaticSimilarity(candidate = {}) {
    const raw = candidate?.staticEmbedding && typeof candidate.staticEmbedding === 'object'
      ? candidate.staticEmbedding.similarity
      : candidate.staticSimilarity;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.max(0, Math.min(1, value));
  }

  const exactAnchorStopwords = new Set([
    'a', 'an', 'and', 'are', 'at', 'be', 'can', 'could', 'did', 'do', 'does',
    'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
    'our', 'please', 'remember', 'tell', 'that', 'the', 'this', 'to', 'was',
    'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'would',
    'you', 'your',
  ]);

  function tokenizeAnchorText(value = '') {
    return String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }

  function normalizeAnchorQueryTokens(queryText = '', queryTokens = new Set()) {
    const rawTokens = tokenizeAnchorText(queryText);
    const sourceTokens = rawTokens.length
      ? rawTokens
      : [...(queryTokens instanceof Set ? queryTokens : new Set(queryTokens || []))];
    return sourceTokens
      .map((token) => String(token || '').trim().toLowerCase())
      .filter((token) => token && !exactAnchorStopwords.has(token));
  }

  function buildExactAnchorPhrases(queryText = '', queryTokens = new Set()) {
    const tokens = normalizeAnchorQueryTokens(queryText, queryTokens);
    const phrases = [];
    const seen = new Set();
    for (const size of [3, 2]) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phraseTokens = tokens.slice(index, index + size);
        if (phraseTokens.some((token) => token.length < 2)) continue;
        const phrase = phraseTokens.join(' ');
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        phrases.push(phraseTokens);
        if (phrases.length >= 6) return phrases;
      }
    }
    return phrases;
  }

  function tokenSequenceIncludes(haystackTokens = [], phraseTokens = []) {
    if (!haystackTokens.length || !phraseTokens.length || phraseTokens.length > haystackTokens.length) return false;
    for (let index = 0; index <= haystackTokens.length - phraseTokens.length; index += 1) {
      let matched = true;
      for (let offset = 0; offset < phraseTokens.length; offset += 1) {
        if (haystackTokens[index + offset] !== phraseTokens[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
    return false;
  }

  function scoreExactAnchorShadow(candidate = {}, queryText = '', queryTokens = new Set()) {
    const candidateTokens = tokenizeAnchorText(candidate.text || candidate.excerpt || candidate.evidenceSnippet || '');
    const matchedPhrases = buildExactAnchorPhrases(queryText, queryTokens)
      .filter((phraseTokens) => tokenSequenceIncludes(candidateTokens, phraseTokens))
      .map((phraseTokens) => phraseTokens.join(' '))
      .slice(0, 3);
    return {
      score: roundShadowScore(Math.min(3.5, matchedPhrases.length * 1.75)),
      matchedPhrases,
    };
  }

  function textMentionsContradictionSide(text = '', sideText = '', conflictKey = '') {
    if (!text || !sideText) return false;
    if (textMentionsNeedle(text, sideText)) return true;
    const sourceTokens = new Set(tokenizeAnchorText(text));
    const conflictTokens = new Set(tokenizeAnchorText(conflictKey));
    const sideTokens = tokenizeAnchorText(sideText)
      .filter((token) => !exactAnchorStopwords.has(token));
    const distinctiveTokens = sideTokens
      .filter((token) => !conflictTokens.has(token));
    const conflictMentioned = !conflictTokens.size
      || [...conflictTokens].every((token) => sourceTokens.has(token));
    if (!conflictMentioned || !distinctiveTokens.length) return false;
    const matchedDistinctive = distinctiveTokens.filter((token) => sourceTokens.has(token));
    return matchedDistinctive.length >= Math.min(2, distinctiveTokens.length);
  }

  function scoreContradictionRepairShadow(candidate = {}, activeContradictions = []) {
    const text = candidate.text || candidate.excerpt || candidate.evidenceSnippet || '';
    const candidateIds = new Set(normalizeEvidenceIds([
      candidate.id,
      ...(Array.isArray(candidate.sourceEpisodeIds) ? candidate.sourceEpisodeIds : []),
      ...(Array.isArray(candidate.evidenceIds) ? candidate.evidenceIds : []),
    ]));
    let score = 0;
    const repairs = [];
    const stale = [];
    for (const contradiction of normalizeContradictionList(activeContradictions, sessionActiveContradictionLimit)) {
      if (!isActiveContradiction(contradiction)) continue;
      const conflictKey = trimText(contradiction.conflictKey || contradiction.topicKey || '', 80);
      const mentionsNew = textMentionsContradictionSide(text, contradiction.newText, conflictKey);
      const mentionsOld = textMentionsContradictionSide(text, contradiction.oldText, conflictKey);
      const touchesCorrectionEpisode = candidateIds.has(String(contradiction.sourceEpisodeId || '').trim());
      if (mentionsNew || (candidate.contradictionLinked === true && touchesCorrectionEpisode)) {
        score += 2.4;
        repairs.push(conflictKey || 'current-correction');
      }
      if (mentionsOld && !mentionsNew) {
        score -= 3.2;
        stale.push(conflictKey || 'stale-correction');
      }
    }
    return {
      score: roundShadowScore(score),
      repairs: repairs.slice(0, 3),
      stale: stale.slice(0, 3),
    };
  }

  function scoreSourceAuthorityShadow(candidate = {}) {
    const authority = String(candidate.sourceAuthority || candidate.authority || '').trim().toLowerCase();
    const sourceType = String(candidate.sourceType || 'archive').trim().toLowerCase();
    if (authority === 'canonical' || authority === 'verified') return { score: 1.4, label: authority };
    if (authority === 'advisory') return { score: 0.35, label: 'advisory' };
    const sourceScores = {
      episode: 0.7,
      pattern: 0.65,
      summary: 0.55,
      chapter: 0.45,
      promotion: 0.35,
      'review-candidate': 0.35,
    };
    return {
      score: roundShadowScore(sourceScores[sourceType] || 0),
      label: sourceScores[sourceType] ? sourceType : '',
    };
  }

  function scoreEvidenceCountShadow(candidate = {}) {
    const evidenceCount = Number(candidate.evidenceCount);
    if (!Number.isFinite(evidenceCount) || evidenceCount <= 1) {
      return { score: 0, evidenceCount: Number.isFinite(evidenceCount) ? Math.max(0, evidenceCount) : null };
    }
    return {
      score: roundShadowScore(Math.min(1.2, Math.log2(Math.max(1, evidenceCount)) * 0.35)),
      evidenceCount: Math.max(1, Math.round(evidenceCount)),
    };
  }

  function scoreOpenLoopShadow(candidate = {}, openLoops = []) {
    const text = candidate.text || candidate.excerpt || candidate.evidenceSnippet || '';
    const linked = candidate.openLoopLinked === true
      || (Array.isArray(openLoops) && openLoops.some((item) => {
        const loopText = item?.text || item?.query || item?.summary || '';
        return loopText && textMentionsNeedle(text, loopText);
      }));
    return {
      score: linked ? 1.1 : 0,
      linked,
    };
  }

  function openLoopPriorityRank(loop = {}) {
    const raw = String(loop?.priority || loop?.urgency || '').trim().toLowerCase();
    if (['critical', 'urgent', 'high'].includes(raw)) return 3;
    if (['medium', 'normal'].includes(raw)) return 2;
    if (['low', 'later', 'background'].includes(raw)) return 1;
    const numeric = Number(loop?.priorityScore ?? loop?.score ?? loop?.confidenceScore);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0.75) return 3;
      if (numeric >= 0.4) return 2;
      return 1;
    }
    return 2;
  }

  function selectOpenLoopsForCandidateMergeBudget(openLoops = [], {
    skipLowPriority = false,
  } = {}) {
    const loops = Array.isArray(openLoops)
      ? openLoops.filter((item) => item && typeof item === 'object')
      : [];
    if (!skipLowPriority) {
      return {
        openLoops: loops,
        totalCount: loops.length,
        scoredCount: loops.length,
        skippedLowPriorityCount: 0,
        skippedLowPriority: false,
      };
    }
    const selected = loops.filter((loop) => openLoopPriorityRank(loop) >= 3);
    return {
      openLoops: selected,
      totalCount: loops.length,
      scoredCount: selected.length,
      skippedLowPriorityCount: Math.max(0, loops.length - selected.length),
      skippedLowPriority: true,
    };
  }

  function scoreArchiveUtilityCandidate(candidate = {}, now = Date.now()) {
    const createdAtMs = Date.parse(candidate.createdAt || '');
    const ageDays = Number.isFinite(createdAtMs)
      ? Math.max(0, now - createdAtMs) / (1000 * 60 * 60 * 24)
      : null;
    const evidenceCount = Math.max(1, Number(candidate.evidenceCount || 1));
    const contradictionLinked = candidate.contradictionLinked === true;
    const openLoopLinked = candidate.openLoopLinked === true;
    const recentlyRetrieved = candidate.recentlyRetrieved === true;
    const sourceType = String(candidate.sourceType || 'archive').trim().toLowerCase();
    let score = 0;

    if (sourceType === 'pattern') score += 3.6;
    else if (sourceType === 'summary') score += 3.1;
    else if (sourceType === 'chapter') score += 2.8;
    else if (sourceType === 'episode') score += 2.2;
    else score += 1.4;

    score += Math.min(2.2, evidenceCount * 0.45);
    if (contradictionLinked) score += 2.8;
    if (openLoopLinked) score += 1.7;
    if (recentlyRetrieved) score += 2.1;

    if (ageDays == null) score += 0.4;
    else score += Math.max(0, 2.4 - Math.min(2.4, ageDays / 5));

    if (candidate.sensitivity === 'high') score -= 1.2;

    return {
      score: Math.round(score * 100) / 100,
      sourceType,
      evidenceCount,
      ageDays: ageDays == null ? null : Math.round(ageDays * 100) / 100,
      contradictionLinked,
      openLoopLinked,
      recentlyRetrieved,
    };
  }

  function buildArchiveCandidate(entry = {}, scope = 'global', sourceType = 'archive') {
    return {
      id: String(entry.id || '').trim(),
      text: trimText(entry.text || entry.excerpt || entry.userText || '', 220),
      sourceType,
      scope,
      createdAt: trimIso(entry.createdAt),
      sensitivity: entry.sensitivity === 'high' ? 'high' : 'normal',
      evidenceCount: Math.max(1, Number(entry.evidenceCount || 1)),
      contradictionLinked: entry.contradictionLinked === true,
      openLoopLinked: entry.openLoopLinked === true,
      recentlyRetrieved: entry.recentlyRetrieved === true,
      sourceEpisodeIds: normalizeEvidenceIds(entry.sourceEpisodeIds || entry.evidenceIds || []),
    };
  }

  function scoreArchiveCandidate(candidate = {}, queryTokens = new Set(), now = Date.now(), queryVector = null, vector = null) {
    const tokens = tokenizeMemoryText(candidate.text || '');
    const overlapTokens = tokens.filter((token) => queryTokens.has(token)).slice(0, 6);
    const components = {
      sourceTypeBase: candidate.sourceType === 'pattern' ? 3.5 : candidate.sourceType === 'summary' ? 3 : 2.5,
      lexicalOverlap: overlapTokens.length * 2.25,
      semanticSimilarity: null,
      semanticSimilarityScore: 0,
      staticSimilarityScore: 0,
      recency: 0,
      sessionScope: 0,
      sensitivityPenalty: 0,
    };
    const reasons = [
      `source:${String(candidate.sourceType || 'archive').trim().toLowerCase() || 'archive'}`,
    ];
    if (overlapTokens.length) {
      reasons.push(`lexical-overlap:${overlapTokens.join(',')}`);
    }
    let score = components.sourceTypeBase;
    score += components.lexicalOverlap;
    if (queryVector && vector) {
      components.semanticSimilarity = cosineSimilarity(queryVector, vector);
      components.semanticSimilarityScore = Math.max(0, components.semanticSimilarity) * 8;
      score += components.semanticSimilarityScore;
      reasons.push(`semantic-similarity:${formatSimilarity(components.semanticSimilarity)}`);
    }
    const staticSimilarity = normalizeStaticSimilarity(candidate);
    if (staticSimilarity != null) {
      components.staticSimilarityScore = staticSimilarity * 5;
      score += components.staticSimilarityScore;
      reasons.push(`static-similarity:${formatScoreComponent(components.staticSimilarityScore)}`);
      reasons.push(`static-similarity-raw:${formatSimilarity(staticSimilarity)}`);
    }
    const createdAtMs = Date.parse(candidate.createdAt || '');
    if (Number.isFinite(createdAtMs)) {
      const ageDays = Math.max(0, now - createdAtMs) / (1000 * 60 * 60 * 24);
      components.recency = Math.max(0, 1.5 - Math.min(1.5, ageDays / 14));
      score += components.recency;
      if (components.recency) reasons.push(`recency:${formatScoreComponent(components.recency)}`);
    }
    if (candidate.scope === 'session') {
      components.sessionScope = 0.75;
      score += components.sessionScope;
      reasons.push(`session-scope:${formatScoreComponent(components.sessionScope)}`);
    }
    if (candidate.sensitivity === 'high') {
      components.sensitivityPenalty = -1.5;
      score += components.sensitivityPenalty;
      reasons.push(`sensitivity-penalty:${formatScoreComponent(components.sensitivityPenalty)}`);
    }
    return {
      score,
      confidence: Math.max(0, Math.min(1, score / 12)),
      overlapTokens,
      evidenceSnippet: trimText(candidate.text || '', 160),
      components,
      reasons,
    };
  }

  function scoreArchiveCandidateHybridShadow(candidate = {}, {
    queryText = '',
    queryTokens = new Set(),
    now = Date.now(),
    baselineScore = null,
    activeContradictions = [],
    openLoops = [],
  } = {}) {
    const activeScore = Number.isFinite(Number(baselineScore))
      ? Number(baselineScore)
      : scoreArchiveCandidate(candidate, queryTokens, now).score;
    const exactAnchor = scoreExactAnchorShadow(candidate, queryText, queryTokens);
    const contradictionRepair = scoreContradictionRepairShadow(candidate, activeContradictions);
    const sourceAuthority = scoreSourceAuthorityShadow(candidate);
    const evidenceCount = scoreEvidenceCountShadow(candidate);
    const openLoop = scoreOpenLoopShadow(candidate, openLoops);
    const components = {
      baselineScore: activeScore,
      exactAnchorScore: exactAnchor.score,
      contradictionRepairScore: contradictionRepair.score,
      sourceAuthorityScore: sourceAuthority.score,
      evidenceCountScore: evidenceCount.score,
      openLoopRelevanceScore: openLoop.score,
    };
    const reasons = [];
    if (exactAnchor.matchedPhrases.length) {
      reasons.push(`exact-anchor:${exactAnchor.matchedPhrases.join(',')}`);
    }
    for (const label of contradictionRepair.repairs) {
      reasons.push(`current-correction-boost:${label}:+2.40`);
      reasons.push(`contradiction-repair:${label}:+2.40`);
    }
    for (const label of contradictionRepair.stale) {
      reasons.push(`stale-contradiction-penalty:${label}:-3.20`);
      reasons.push(`stale-contradiction:${label}:-3.20`);
    }
    if (sourceAuthority.score > 0 && sourceAuthority.label) {
      reasons.push(`source-strength:${sourceAuthority.label}:${formatScoreComponent(sourceAuthority.score)}`);
    }
    if (evidenceCount.score > 0) {
      reasons.push(`evidence-count:${evidenceCount.evidenceCount}:${formatScoreComponent(evidenceCount.score)}`);
    }
    if (openLoop.linked) {
      reasons.push(`open-loop:linked:${formatScoreComponent(openLoop.score)}`);
    }
    return {
      score: roundShadowScore(Object.values(components).reduce((total, value) => total + Number(value || 0), 0)),
      components,
      reasons,
      rank: null,
      wouldSelect: false,
      rankDelta: null,
    };
  }

  function scoreArchiveCandidateWithProfile(candidate = {}, {
    scoringProfile = ARCHIVE_SCORING_PROFILES.BASELINE,
    queryText = '',
    queryTokens = new Set(),
    now = Date.now(),
    queryVector = null,
    vector = null,
    activeContradictions = [],
    openLoops = [],
    memoryLinks = null,
    activeRank = null,
    shadowRank = null,
  } = {}) {
    const profile = normalizeArchiveScoringProfile(scoringProfile);
    const baseline = scoreArchiveCandidate(candidate, queryTokens, now, queryVector, vector);
    const baselineScore = Number.isFinite(Number(baseline?.score)) ? Number(baseline.score) : 0;
    const hybridV1 = scoreArchiveCandidateHybridShadow(candidate, {
      queryText,
      queryTokens,
      now,
      baselineScore,
      activeContradictions,
      openLoops,
    });
    const hybridV1Score = Number.isFinite(Number(hybridV1?.score)) ? Number(hybridV1.score) : 0;
    const active = profile === ARCHIVE_SCORING_PROFILES.HYBRID_V1 ? hybridV1 : baseline;
    const activeScore = Number.isFinite(Number(active?.score)) ? Number(active.score) : 0;
    const linkShadowScore = scoreMemoryLinkShadowForCandidate(candidate, {
      memoryLinks: memoryLinks || candidate.memoryLinks || [],
      activeScore,
      activeRank,
      shadowRank,
    });

    return {
      scoringProfile: profile,
      activeScore,
      activeConfidence: Math.max(0, Math.min(1, activeScore / 12)),
      activeScoreComponents: active?.components && typeof active.components === 'object' ? active.components : {},
      activeScoreReasons: Array.isArray(active?.reasons) ? active.reasons : [],
      baselineScore,
      baselineScoreComponents: baseline?.components && typeof baseline.components === 'object' ? baseline.components : {},
      baselineScoreReasons: Array.isArray(baseline?.reasons) ? baseline.reasons : [],
      baselineOverlapTokens: Array.isArray(baseline?.overlapTokens) ? baseline.overlapTokens : [],
      baselineEvidenceSnippet: trimText(baseline?.evidenceSnippet || candidate.text || '', 160),
      hybridV1Score,
      hybridV1Components: hybridV1?.components && typeof hybridV1.components === 'object' ? hybridV1.components : {},
      hybridV1Reasons: Array.isArray(hybridV1?.reasons) ? hybridV1.reasons : [],
      hybridV1,
      linkShadowScore,
    };
  }

  function scoreFixtureRerankCandidate(candidate = {}, {
    queryText = '',
    queryTokens = new Set(),
    activeContradictions = [],
    openLoops = [],
    activeRank = null,
  } = {}) {
    const candidateTokens = tokenizeMemoryText(candidate.text || candidate.excerpt || candidate.evidenceSnippet || '');
    const normalizedQueryTokens = queryTokens instanceof Set
      ? queryTokens
      : new Set(queryTokens || []);
    const overlapTokens = candidateTokens.filter((token) => normalizedQueryTokens.has(token)).slice(0, 8);
    const exactAnchor = scoreExactAnchorShadow(candidate, queryText, normalizedQueryTokens);
    const contradictionRepair = scoreContradictionRepairShadow(candidate, activeContradictions);
    const sourceAuthority = scoreSourceAuthorityShadow(candidate);
    const evidenceCount = scoreEvidenceCountShadow(candidate);
    const openLoop = scoreOpenLoopShadow(candidate, openLoops);
    const activeScore = Number.isFinite(Number(candidate.activeScore ?? candidate.score))
      ? Number(candidate.activeScore ?? candidate.score)
      : 0;
    const activeRankBonus = Number.isFinite(Number(activeRank)) && Number(activeRank) > 0
      ? Math.max(0, 0.8 - (Number(activeRank) * 0.08))
      : 0;
    const sensitivityPenalty = candidate.sensitivity === 'high' ? -8 : 0;
    const components = {
      activeScorePrior: Math.max(0, activeScore) * 0.2,
      lexicalOverlapScore: overlapTokens.length * 0.6,
      exactAnchorScore: exactAnchor.score * 1.4,
      contradictionRepairScore: contradictionRepair.score * 1.6,
      sourceAuthorityScore: sourceAuthority.score,
      evidenceCountScore: evidenceCount.score * 2.4,
      openLoopRelevanceScore: openLoop.score,
      activeRankBonus,
      sensitivityPenalty,
    };
    const reasons = [];
    if (overlapTokens.length) reasons.push(`lexical-overlap:${overlapTokens.join(',')}`);
    if (exactAnchor.matchedPhrases.length) {
      reasons.push(`exact-anchor:${exactAnchor.matchedPhrases.join(',')}`);
    }
    for (const label of contradictionRepair.repairs) {
      reasons.push(`contradiction-repair:${label}:+${formatSimilarity(2.4 * 1.6)}`);
    }
    for (const label of contradictionRepair.stale) {
      reasons.push(`stale-contradiction:${label}:${formatSimilarity(-3.2 * 1.6)}`);
    }
    if (sourceAuthority.score > 0 && sourceAuthority.label) {
      reasons.push(`source-strength:${sourceAuthority.label}:${formatScoreComponent(sourceAuthority.score)}`);
    }
    if (evidenceCount.score > 0) {
      reasons.push(`evidence-count:${evidenceCount.evidenceCount}:${formatScoreComponent(evidenceCount.score * 2.4)}`);
    }
    if (openLoop.linked) reasons.push(`open-loop:linked:${formatScoreComponent(openLoop.score)}`);
    if (activeRankBonus > 0) reasons.push(`active-rank-prior:${formatScoreComponent(activeRankBonus)}`);
    if (sensitivityPenalty) reasons.push(`sensitivity-guard:${formatScoreComponent(sensitivityPenalty)}`);
    return {
      score: roundShadowScore(Object.values(components).reduce((total, value) => total + Number(value || 0), 0)),
      components,
      reasons: reasons.slice(0, 8),
    };
  }

  function rerankShadowCandidates(candidates = [], queryText = '', {
    provider = RERANK_SHADOW_PROVIDERS.FIXTURE,
    inputTopK = null,
    selectedLimit = 0,
    activeContradictions = [],
    openLoops = [],
    now = Date.now(),
  } = {}) {
    const normalizedProvider = normalizeRerankShadowProvider(provider);
    const inputCount = Array.isArray(candidates) ? candidates.length : 0;
    const startedAt = Date.now();
    if (!normalizedProvider) {
      return {
        provider: '',
        measurementMode: '',
        inputCount,
        output: [],
        latencyMs: null,
        unavailableReason: 'reranker-shadow-disabled',
      };
    }
    if (normalizedProvider !== RERANK_SHADOW_PROVIDERS.FIXTURE) {
      return {
        provider: normalizedProvider,
        measurementMode: RERANK_SHADOW_MEASUREMENT_MODES.UNAVAILABLE,
        inputCount,
        output: [],
        latencyMs: null,
        unavailableReason: `unsupported-reranker-provider:${normalizedProvider}`,
      };
    }
    const queryTokens = new Set(tokenizeMemoryText(queryText));
    const limit = Number.isFinite(Number(inputTopK)) && Number(inputTopK) > 0
      ? Math.min(inputCount, Math.floor(Number(inputTopK)))
      : inputCount;
    const selectedCount = Number.isFinite(Number(selectedLimit)) && Number(selectedLimit) > 0
      ? Math.floor(Number(selectedLimit))
      : 0;
    const scored = candidates
      .slice(0, limit)
      .map((candidate, index) => {
        const activeRank = index + 1;
        const reranked = scoreFixtureRerankCandidate(candidate, {
          queryText,
          queryTokens,
          activeContradictions,
          openLoops,
          now,
          activeRank,
        });
        return {
          candidate,
          activeRank,
          score: reranked.score,
          reasons: reranked.reasons,
        };
      })
      .sort((left, right) => (
        right.score - left.score
          || left.activeRank - right.activeRank
          || String(right.candidate?.createdAt || '').localeCompare(String(left.candidate?.createdAt || ''))
      ));
    const latencyMs = Math.max(0, Math.round(Date.now() - startedAt));
    return {
      provider: normalizedProvider,
      measurementMode: RERANK_SHADOW_MEASUREMENT_MODES.FIXTURE,
      inputCount,
      output: scored.map((item, index) => ({
        candidateId: String(item.candidate?.id || item.candidate?.sourceId || item.candidate?.text || '').trim(),
        rerankScore: item.score,
        rerankRank: index + 1,
        wouldSelect: selectedCount > 0 ? index < selectedCount : false,
        reasons: item.reasons,
      })),
      latencyMs,
      unavailableReason: '',
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
      const explanation = buildCompressionExplanation({
        chapterItems: [{ text: summary }],
        session: { episodes: chunk },
        carriedContradictions: chunkContradictions,
      });
      chapters.push({
        summary,
        sourceEpisodeIds,
        confidence: Math.max(0.4, Math.min(0.88, 0.38 + (chunk.length * 0.05))),
        createdAt: chunk[chunk.length - 1]?.createdAt || '',
        mergeBasis: explanation.selectedSignals,
        discardedDetailSummary: explanation.penalties,
        omittedEpisodeCount: explanation.omittedEpisodeCount,
        carriedContradictions: explanation.carriedContradictions,
        mergeReason: chunkContradictions.length ? 'chapter-contradiction-merge' : 'chapter-detail-merge',
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
    scoreArchiveUtilityCandidate,
    scoreArchiveCandidate,
    scoreArchiveCandidateHybridShadow,
    scoreArchiveCandidateWithProfile,
    selectOpenLoopsForCandidateMergeBudget,
    rerankShadowCandidates,
    buildSessionChapterText,
    buildSessionChapters,
    looksLikeScaffoldingText,
    scoreChapterDetailText,
  };
}

module.exports = {
  ARCHIVE_SCORING_PROFILES,
  RERANK_SHADOW_MEASUREMENT_MODES,
  RERANK_SHADOW_PROVIDERS,
  createMemoryArchivePolicyApi,
  normalizeArchiveScoringProfile,
  normalizeRerankShadowProvider,
};
