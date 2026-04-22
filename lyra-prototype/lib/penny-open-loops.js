const OPEN_LOOP_SCHEMA = 'penny-open-loop-state.v1';

const OPEN_LOOP_STATUSES = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  BLOCKED: 'blocked',
  DEFERRED: 'deferred',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
});

const OPEN_LOOP_AUTHORITY = 'advisory';

const STATUS_VALUES = new Set(Object.values(OPEN_LOOP_STATUSES));
const ACTIVE_STATUSES = new Set([
  OPEN_LOOP_STATUSES.OPEN,
  OPEN_LOOP_STATUSES.IN_PROGRESS,
  OPEN_LOOP_STATUSES.BLOCKED,
  OPEN_LOOP_STATUSES.DEFERRED,
]);
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown']);
const SURFACE_MODES = new Set(['relevant-only', 'manual-only', 'always', 'never']);
const RELEVANCE_STOPWORDS = new Set([
  'a', 'about', 'again', 'an', 'and', 'any', 'are', 'around', 'as', 'at',
  'be', 'been', 'but', 'by', 'can', 'check', 'continue', 'could', 'do',
  'does', 'doing', 'done', 'for', 'from', 'get', 'give', 'go', 'going',
  'got', 'had', 'has', 'have', 'help', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'let', 'look', 'make', 'me', 'my', 'next', 'now',
  'of', 'on', 'one', 'open', 'or', 'our', 'please', 'plan', 'review',
  'run', 'see', 'slice', 'so', 'state', 'step', 'take', 'that', 'the',
  'then', 'there', 'this', 'through', 'to', 'turn', 'up', 'us', 'want',
  'was', 'we', 'what', 'when', 'where', 'which', 'with', 'work', 'you',
  'your',
]);
const PRIORITY_RELEVANCE_SCORES = Object.freeze({
  critical: 1.4,
  high: 1,
  medium: 0.35,
  low: 0,
});
const OPEN_LOOP_SELECTION_THRESHOLD = 4;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', limit = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '') {
  return cleanString(value, 120).toLowerCase().replace(/[_\s]+/g, '-');
}

function normalizeStatus(value = '') {
  const status = cleanToken(value);
  if (!status) return '';
  const aliases = {
    active: OPEN_LOOP_STATUSES.IN_PROGRESS,
    done: OPEN_LOOP_STATUSES.COMPLETED,
    complete: OPEN_LOOP_STATUSES.COMPLETED,
    resolved: OPEN_LOOP_STATUSES.COMPLETED,
    parked: OPEN_LOOP_STATUSES.DEFERRED,
    paused: OPEN_LOOP_STATUSES.DEFERRED,
    dismissed: OPEN_LOOP_STATUSES.DISMISSED,
    hidden: OPEN_LOOP_STATUSES.DISMISSED,
    stale: OPEN_LOOP_STATUSES.EXPIRED,
  };
  const normalized = aliases[status] || status;
  return STATUS_VALUES.has(normalized) ? normalized : '';
}

function normalizePriority(value = '') {
  const priority = cleanToken(value);
  if (priority === 'urgent') return 'critical';
  if (priority === 'normal') return 'medium';
  return PRIORITIES.has(priority) ? priority : 'medium';
}

function normalizeConfidence(value = '') {
  const confidence = cleanToken(value);
  if (confidence === 'none' || confidence === 'unclear') return 'unknown';
  return CONFIDENCE_VALUES.has(confidence) ? confidence : 'medium';
}

function normalizeSurfaceMode(value = '') {
  const mode = cleanToken(value);
  if (!mode) return 'relevant-only';
  if (mode === 'relevant') return 'relevant-only';
  if (mode === 'manual') return 'manual-only';
  if (mode === 'off' || mode === 'disabled' || mode === 'hidden') return 'never';
  return SURFACE_MODES.has(mode) ? mode : 'relevant-only';
}

function boolValue(value) {
  return value === true || cleanToken(value) === 'true' || cleanToken(value) === 'yes';
}

function clampInteger(value, fallback = 1, min = 0, max = 20) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeIso(value = '') {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : '';
  }
  const text = String(value).trim();
  if (!text) return '';
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString();
}

function normalizeNowMs(now = new Date()) {
  if (now instanceof Date) {
    const time = now.getTime();
    return Number.isFinite(time) ? time : Date.now();
  }
  const parsed = Date.parse(String(now || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function tokenizeRelevanceText(...values) {
  return values
    .flat(Infinity)
    .map((value) => String(value || ''))
    .join(' ')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 2 && !RELEVANCE_STOPWORDS.has(token)) || [];
}

function uniqueStrings(values = [], limit = 30) {
  const out = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const text = cleanString(value, 220);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizedPhrase(value = '') {
  return tokenizeRelevanceText(value).join(' ');
}

function textIncludesPhrase(userPhrase = '', phrase = '') {
  if (!userPhrase || !phrase) return false;
  return ` ${userPhrase} `.includes(` ${phrase} `);
}

function sourceRefText(ref = {}) {
  if (!isPlainObject(ref)) return '';
  return [
    ref.id,
    ref.path,
    ref.url,
    ref.label,
    ref.note,
  ].filter(Boolean).join(' ');
}

function listValue(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function rawLoopList(value = []) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  if (Array.isArray(value.loops)) return value.loops;
  if (Array.isArray(value.openLoops)) return value.openLoops;
  if (Array.isArray(value.items)) return value.items;
  return [];
}

function loopRelevanceTexts(rawLoop = {}, loop = {}) {
  const refs = normalizeSourceRefs(loop.sourceRefs || rawLoop.sourceRefs || rawLoop.sources || []);
  return uniqueStrings([
    loop.id,
    String(loop.id || '').replace(/[-_]+/g, ' '),
    loop.title,
    loop.nextLikelyStep,
    refs.map(sourceRefText),
    listValue(rawLoop.anchors || rawLoop.anchorTerms || rawLoop.keywords || rawLoop.tags),
    rawLoop.project,
    rawLoop.projectId,
    rawLoop.projectThread,
    rawLoop.thread,
    rawLoop.threadId,
    rawLoop.scope,
    rawLoop.scopeKey,
  ]);
}

function loopExplicitAliases(rawLoop = {}, loop = {}) {
  return uniqueStrings([
    loop.id,
    String(loop.id || '').replace(/[-_]+/g, ' '),
    loop.title,
    listValue(rawLoop.anchors || rawLoop.anchorTerms || rawLoop.tags),
  ], 12)
    .map(normalizedPhrase)
    .filter((phrase) => phrase.split(' ').length >= 2);
}

function overlapTokens(leftTokens = [], rightTokens = []) {
  const right = new Set(rightTokens);
  return [...new Set(leftTokens)].filter((token) => right.has(token));
}

function recencySignal(loop = {}, nowMs = Date.now()) {
  const touchedMs = Date.parse(loop.lastTouchedAt || '');
  if (!Number.isFinite(touchedMs)) return { score: 0, recent: false, ageDays: null };
  const ageDays = Math.max(0, (nowMs - touchedMs) / (1000 * 60 * 60 * 24));
  if (ageDays <= 2) return { score: 1.5, recent: true, ageDays };
  if (ageDays <= 7) return { score: 1, recent: true, ageDays };
  if (ageDays <= 30) return { score: 0.35, recent: false, ageDays };
  return { score: 0, recent: false, ageDays };
}

function turnThreadKeys(turnState = null) {
  if (!isPlainObject(turnState)) return [];
  return uniqueStrings([
    turnState.project,
    turnState.projectId,
    turnState.projectThread,
    turnState.thread,
    turnState.threadId,
    turnState.scope,
    turnState.scopeKey,
    turnState.activeProject,
    turnState.activeThread,
  ]).map(cleanToken).filter(Boolean);
}

function loopThreadKeys(rawLoop = {}, loop = {}) {
  return uniqueStrings([
    rawLoop.project,
    rawLoop.projectId,
    rawLoop.projectThread,
    rawLoop.thread,
    rawLoop.threadId,
    rawLoop.scope,
    rawLoop.scopeKey,
    loop.sourceRefs?.map((ref) => ref.id || ref.label || ref.path || ''),
  ]).map(cleanToken).filter(Boolean);
}

function candidateText(candidate = {}) {
  if (typeof candidate === 'string') return candidate;
  if (!isPlainObject(candidate)) return '';
  return [
    candidate.id,
    candidate.sourceId,
    candidate.candidateId,
    candidate.loopId,
    candidate.openLoopId,
    candidate.title,
    candidate.summary,
    candidate.text,
    candidate.excerpt,
    candidate.evidenceSnippet,
    candidate.path,
    candidate.label,
  ].filter(Boolean).join(' ');
}

function candidateLoopIds(candidate = {}) {
  if (!isPlainObject(candidate)) return [];
  return uniqueStrings([
    candidate.loopId,
    candidate.openLoopId,
    listValue(candidate.loopIds),
    listValue(candidate.openLoopIds),
  ]).map(cleanToken).filter(Boolean);
}

function staticCandidateSignal({
  staticCandidates = [],
  loop = {},
  loopTokens = [],
  queryTokens = [],
}) {
  for (const candidate of Array.isArray(staticCandidates) ? staticCandidates : []) {
    const ids = candidateLoopIds(candidate);
    if (ids.includes(cleanToken(loop.id))) {
      return { score: 3.75, related: true, direct: true };
    }
    const text = candidateText(candidate);
    const candidateTokens = tokenizeRelevanceText(text);
    const loopOverlap = overlapTokens(loopTokens, candidateTokens);
    const queryOverlap = overlapTokens(queryTokens, candidateTokens);
    if (loopOverlap.length >= 2 && (queryOverlap.length > 0 || !queryTokens.length)) {
      return { score: 2.75, related: true, direct: false };
    }
  }
  return { score: 0, related: false, direct: false };
}

function suppressionReason(loop = {}, now = new Date()) {
  const status = classifyOpenLoopStatus(loop, now);
  if (status === OPEN_LOOP_STATUSES.COMPLETED) return 'completed-suppressed';
  if (status === OPEN_LOOP_STATUSES.DISMISSED) return 'dismissed-suppressed';
  if (status === OPEN_LOOP_STATUSES.EXPIRED) return 'expired-suppressed';
  if (!ACTIVE_STATUSES.has(status)) return 'inactive-suppressed';
  const normalized = normalizeOpenLoop(loop);
  if (!normalized) return 'invalid-loop';
  if (normalized.surfacePolicy.mode === 'never') return 'surface-policy:never';
  if (normalized.surfacePolicy.mode === 'manual-only') return 'surface-policy:manual-only';
  if (normalized.surfacePolicy.maxSurfaceCount <= 0) return 'surface-policy:max-surface-count-0';
  return '';
}

function selectionConfidence({ score = 0, hasExplicitAnchor = false, loopConfidence = 'medium' } = {}) {
  if ((hasExplicitAnchor || score >= 7) && loopConfidence !== 'low' && loopConfidence !== 'unknown') return 'high';
  if (score >= OPEN_LOOP_SELECTION_THRESHOLD) return 'medium';
  return 'low';
}

function formatPromptSnippet(loop = {}) {
  const title = cleanString(loop.title, 180);
  const status = cleanString(loop.status, 80);
  const nextStep = cleanString(loop.nextLikelyStep, 260).replace(/[.?!]+$/, '');
  const statusPart = status ? ` is ${status}` : '';
  const nextPart = nextStep ? `; next step: ${nextStep}` : '';
  return cleanString(`Open loop: ${title}${statusPart}${nextPart}. Authority: ${OPEN_LOOP_AUTHORITY}.`, 480);
}

function scoreOpenLoopForTurn({
  rawLoop = {},
  loop = {},
  userText = '',
  staticCandidates = [],
  turnState = null,
  now = new Date(),
}) {
  const queryTokens = tokenizeRelevanceText(userText);
  const userPhrase = queryTokens.join(' ');
  const relevanceTexts = loopRelevanceTexts(rawLoop, loop);
  const loopTokens = tokenizeRelevanceText(relevanceTexts);
  const aliases = loopExplicitAliases(rawLoop, loop);
  const explicitAnchor = aliases.some((phrase) => textIncludesPhrase(userPhrase, phrase));
  const matchedTokens = overlapTokens(queryTokens, loopTokens);
  const exactAnchor = !explicitAnchor && matchedTokens.length >= 2;
  const turnKeys = turnThreadKeys(turnState);
  const threadKeys = loopThreadKeys(rawLoop, loop);
  const projectThreadMatch = turnKeys.length > 0 && threadKeys.some((key) => turnKeys.includes(key));
  const staticSignal = staticCandidateSignal({
    staticCandidates,
    loop,
    loopTokens,
    queryTokens,
  });
  const recent = recencySignal(loop, normalizeNowMs(now));
  const priorityScore = PRIORITY_RELEVANCE_SCORES[loop.priority] || 0;
  const lexicalScore = Math.min(2.4, matchedTokens.length * 0.8);
  const components = {
    explicitAnchor: explicitAnchor ? 6 : 0,
    exactAnchor: exactAnchor ? 3 : 0,
    projectThread: projectThreadMatch ? 3 : 0,
    staticCandidate: staticSignal.score,
    lexicalOverlap: lexicalScore,
    recent: recent.score,
    priority: priorityScore,
  };
  const score = Object.values(components).reduce((total, value) => total + Number(value || 0), 0);
  const central = explicitAnchor || exactAnchor || projectThreadMatch || staticSignal.related || matchedTokens.length >= 3;
  const reasonParts = [];
  if (explicitAnchor) reasonParts.push('explicit-anchor');
  else if (exactAnchor) reasonParts.push('exact-anchor');
  else if (projectThreadMatch) reasonParts.push('project-thread');
  else if (staticSignal.related) reasonParts.push(staticSignal.direct ? 'static-candidate-direct' : 'static-candidate-related');
  else if (matchedTokens.length >= 3) reasonParts.push('anchor-overlap');
  if (recent.recent) reasonParts.push('recent-open-loop');
  if (!reasonParts.length && priorityScore > 0) reasonParts.push(`priority-${loop.priority}`);

  return {
    score: Math.round(score * 1000) / 1000,
    central,
    surfaceReason: reasonParts.join('+') || 'low-relevance',
    confidence: selectionConfidence({
      score,
      hasExplicitAnchor: explicitAnchor,
      loopConfidence: loop.confidence,
    }),
    matchedTokens: matchedTokens.slice(0, 8),
    components,
  };
}

function selectRelevantOpenLoops({
  loops = [],
  userText = '',
  staticCandidates = [],
  turnState = null,
  maxLoops = 1,
  now = new Date(),
} = {}) {
  const cap = clampInteger(maxLoops, 1, 0, 3);
  const selected = [];
  const heldBack = [];
  const scored = [];

  for (const rawLoop of rawLoopList(loops)) {
    const loop = normalizeOpenLoop(rawLoop);
    if (!loop) continue;
    const suppressed = suppressionReason(loop, now);
    if (suppressed) {
      heldBack.push({ id: loop.id, reason: suppressed });
      continue;
    }
    const relevance = scoreOpenLoopForTurn({
      rawLoop,
      loop,
      userText,
      staticCandidates,
      turnState,
      now,
    });
    if (!relevance.central) {
      heldBack.push({ id: loop.id, reason: 'adjacent-not-central', score: relevance.score });
      continue;
    }
    if (relevance.score < OPEN_LOOP_SELECTION_THRESHOLD) {
      heldBack.push({ id: loop.id, reason: 'low-relevance', score: relevance.score });
      continue;
    }
    scored.push({ loop, relevance });
  }

  scored.sort((left, right) => (
    right.relevance.score - left.relevance.score
    || String(right.loop.lastTouchedAt || '').localeCompare(String(left.loop.lastTouchedAt || ''))
    || left.loop.id.localeCompare(right.loop.id)
  ));

  for (const item of scored) {
    if (selected.length >= cap) {
      heldBack.push({ id: item.loop.id, reason: 'max-loop-cap', score: item.relevance.score });
      continue;
    }
    selected.push({
      id: item.loop.id,
      title: item.loop.title,
      status: classifyOpenLoopStatus(item.loop, now),
      score: item.relevance.score,
      surfaceReason: item.relevance.surfaceReason,
      confidence: item.relevance.confidence,
      matchedTokens: item.relevance.matchedTokens,
      promptSnippet: formatPromptSnippet(item.loop),
    });
  }

  return { selected, heldBack };
}

function normalizeSourceRef(refLike = {}) {
  const ref = isPlainObject(refLike) ? refLike : {};
  const type = cleanToken(ref.type || ref.sourceType || 'source') || 'source';
  const id = cleanString(ref.id || ref.ref || ref.sourceId || '', 180);
  const path = cleanString(ref.path || ref.file || '', 500);
  const url = cleanString(ref.url || '', 500);
  const label = cleanString(ref.label || ref.title || '', 180);
  const note = cleanString(ref.note || ref.reason || '', 260);
  if (!id && !path && !url && !label && !note) return null;
  return {
    type,
    ...(id ? { id } : {}),
    ...(path ? { path } : {}),
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
    ...(note ? { note } : {}),
  };
}

function normalizeSourceRefs(value = []) {
  const refs = Array.isArray(value) ? value : [value];
  const out = [];
  const seen = new Set();
  for (const raw of refs) {
    const ref = normalizeSourceRef(raw);
    if (!ref) continue;
    const key = [
      ref.type,
      ref.id || '',
      ref.path || '',
      ref.url || '',
      ref.label || '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out.slice(0, 12);
}

function normalizeSurfacePolicy(surfacePolicy = {}, loopLike = {}) {
  const raw = isPlainObject(surfacePolicy) ? surfacePolicy : {};
  const fallback = isPlainObject(loopLike) ? loopLike : {};
  return {
    mode: normalizeSurfaceMode(raw.mode || fallback.surfaceMode),
    maxSurfaceCount: clampInteger(raw.maxSurfaceCount ?? fallback.maxSurfaceCount, 1, 0, 3),
    expiresAt: normalizeIso(raw.expiresAt || fallback.expiresAt),
  };
}

function normalizeOpenLoop(loopLike = {}) {
  const raw = isPlainObject(loopLike) ? loopLike : {};
  const id = cleanString(raw.id || raw.loopId || '', 140);
  const title = cleanString(raw.title || raw.summary || '', 220);
  const rawStatus = normalizeStatus(raw.status);
  if (!id || !title || !rawStatus) return null;

  const dismissed = boolValue(raw.dismissed) || rawStatus === OPEN_LOOP_STATUSES.DISMISSED;
  const status = dismissed ? OPEN_LOOP_STATUSES.DISMISSED : rawStatus;
  const completedAt = normalizeIso(raw.completedAt || raw.resolvedAt);
  return {
    id,
    title,
    status,
    priority: normalizePriority(raw.priority),
    lastTouchedAt: normalizeIso(raw.lastTouchedAt || raw.updatedAt || raw.createdAt),
    nextLikelyStep: cleanString(raw.nextLikelyStep || raw.nextStep || '', 500),
    sourceRefs: normalizeSourceRefs(raw.sourceRefs || raw.sources || []),
    authority: OPEN_LOOP_AUTHORITY,
    confidence: normalizeConfidence(raw.confidence),
    surfacePolicy: normalizeSurfacePolicy(raw.surfacePolicy, raw),
    dismissed,
    completedAt: completedAt || null,
  };
}

function normalizeOpenLoopState(stateLike = {}) {
  const raw = Array.isArray(stateLike)
    ? { loops: stateLike }
    : (isPlainObject(stateLike) ? stateLike : {});
  const rawLoops = Array.isArray(raw.loops)
    ? raw.loops
    : (Array.isArray(raw.openLoops) ? raw.openLoops : raw.items);
  const loops = [];
  const seenIds = new Set();
  for (const rawLoop of Array.isArray(rawLoops) ? rawLoops : []) {
    const loop = normalizeOpenLoop(rawLoop);
    if (!loop || seenIds.has(loop.id)) continue;
    seenIds.add(loop.id);
    loops.push(loop);
  }
  return {
    schema: OPEN_LOOP_SCHEMA,
    updatedAt: normalizeIso(raw.updatedAt),
    loops,
  };
}

function classifyOpenLoopStatus(loop, now = new Date()) {
  const normalized = normalizeOpenLoop(loop);
  if (!normalized) return '';
  if (normalized.status === OPEN_LOOP_STATUSES.COMPLETED || normalized.completedAt) {
    return OPEN_LOOP_STATUSES.COMPLETED;
  }
  if (normalized.status === OPEN_LOOP_STATUSES.DISMISSED || normalized.dismissed) {
    return OPEN_LOOP_STATUSES.DISMISSED;
  }
  if (normalized.status === OPEN_LOOP_STATUSES.EXPIRED) {
    return OPEN_LOOP_STATUSES.EXPIRED;
  }
  const expiresAtMs = Date.parse(normalized.surfacePolicy.expiresAt || '');
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= normalizeNowMs(now)) {
    return OPEN_LOOP_STATUSES.EXPIRED;
  }
  return normalized.status;
}

function isSurfaceable(loop, now = new Date()) {
  const status = classifyOpenLoopStatus(loop, now);
  if (!ACTIVE_STATUSES.has(status)) return false;
  const normalized = normalizeOpenLoop(loop);
  if (!normalized) return false;
  if (normalized.surfacePolicy.mode === 'never' || normalized.surfacePolicy.mode === 'manual-only') return false;
  return normalized.surfacePolicy.maxSurfaceCount > 0;
}

function summarizeOpenLoopState(state, { now = new Date() } = {}) {
  const normalized = normalizeOpenLoopState(state);
  const statusCounts = Object.fromEntries(Object.values(OPEN_LOOP_STATUSES).map((status) => [status, 0]));
  const activeLoopIds = [];
  const surfaceableLoopIds = [];
  const nextLikelySteps = [];

  for (const loop of normalized.loops) {
    const status = classifyOpenLoopStatus(loop, now);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;
    if (ACTIVE_STATUSES.has(status)) activeLoopIds.push(loop.id);
    if (isSurfaceable(loop, now)) {
      surfaceableLoopIds.push(loop.id);
      if (loop.nextLikelyStep) {
        nextLikelySteps.push({
          id: loop.id,
          title: loop.title,
          status,
          priority: loop.priority,
          authority: loop.authority,
          confidence: loop.confidence,
          nextLikelyStep: loop.nextLikelyStep,
          expiresAt: loop.surfacePolicy.expiresAt,
        });
      }
    }
  }

  return {
    schema: OPEN_LOOP_SCHEMA,
    totalCount: normalized.loops.length,
    statusCounts,
    activeCount: activeLoopIds.length,
    activeLoopIds,
    surfaceableCount: surfaceableLoopIds.length,
    surfaceableLoopIds,
    heldBackCount: normalized.loops.length - surfaceableLoopIds.length,
    nextLikelySteps,
  };
}

module.exports = {
  OPEN_LOOP_SCHEMA,
  OPEN_LOOP_STATUSES,
  normalizeOpenLoop,
  normalizeOpenLoopState,
  summarizeOpenLoopState,
  classifyOpenLoopStatus,
  selectRelevantOpenLoops,
};
