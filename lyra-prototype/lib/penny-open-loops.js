const OPEN_LOOP_SCHEMA = 'penny-open-loop-state.v1';
const OPEN_LOOP_PROMPT_BRIDGE_SCHEMA = 'penny-open-loop-prompt-bridge.v1';
const {
  FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS,
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  buildFrameBudgetSidecarReceipt,
} = require('./penny-frame-budget');

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
const OPEN_LOOP_RELEVANCE_BUDGET_MS = FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.OPEN_LOOP_RELEVANCE;
const OPEN_LOOP_LIFECYCLE_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  COMPLETE: 'complete',
  DISMISS: 'dismiss',
  DEFER: 'defer',
  EXPIRE: 'expire',
});
const OPEN_LOOP_COMPLETION_BASES = Object.freeze({
  EXPLICIT_USER_STATEMENT: 'explicit-user-statement',
  DETERMINISTIC_ARTIFACT: 'deterministic-artifact',
  TEST_RECEIPT: 'test-receipt',
  SOURCE_RECEIPT: 'source-receipt',
  MANUAL_COMMAND: 'manual-command',
});

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
const LIFECYCLE_ACTION_VALUES = new Set(Object.values(OPEN_LOOP_LIFECYCLE_ACTIONS));
const COMPLETION_BASIS_VALUES = new Set(Object.values(OPEN_LOOP_COMPLETION_BASES));
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
const DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS = 110;

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

function normalizeLifecycleAction(value = '') {
  const action = cleanToken(value);
  const aliases = {
    add: OPEN_LOOP_LIFECYCLE_ACTIONS.CREATE,
    created: OPEN_LOOP_LIFECYCLE_ACTIONS.CREATE,
    write: OPEN_LOOP_LIFECYCLE_ACTIONS.UPDATE,
    updated: OPEN_LOOP_LIFECYCLE_ACTIONS.UPDATE,
    completed: OPEN_LOOP_LIFECYCLE_ACTIONS.COMPLETE,
    resolve: OPEN_LOOP_LIFECYCLE_ACTIONS.COMPLETE,
    resolved: OPEN_LOOP_LIFECYCLE_ACTIONS.COMPLETE,
    dismiss: OPEN_LOOP_LIFECYCLE_ACTIONS.DISMISS,
    dismissed: OPEN_LOOP_LIFECYCLE_ACTIONS.DISMISS,
    hide: OPEN_LOOP_LIFECYCLE_ACTIONS.DISMISS,
    hidden: OPEN_LOOP_LIFECYCLE_ACTIONS.DISMISS,
    deferred: OPEN_LOOP_LIFECYCLE_ACTIONS.DEFER,
    park: OPEN_LOOP_LIFECYCLE_ACTIONS.DEFER,
    parked: OPEN_LOOP_LIFECYCLE_ACTIONS.DEFER,
    expired: OPEN_LOOP_LIFECYCLE_ACTIONS.EXPIRE,
  };
  const normalized = aliases[action] || action;
  return LIFECYCLE_ACTION_VALUES.has(normalized) ? normalized : '';
}

function normalizeCompletionBasis(value = '') {
  const basis = cleanToken(value);
  const aliases = {
    explicit: OPEN_LOOP_COMPLETION_BASES.EXPLICIT_USER_STATEMENT,
    user: OPEN_LOOP_COMPLETION_BASES.EXPLICIT_USER_STATEMENT,
    'user-statement': OPEN_LOOP_COMPLETION_BASES.EXPLICIT_USER_STATEMENT,
    artifact: OPEN_LOOP_COMPLETION_BASES.DETERMINISTIC_ARTIFACT,
    deterministic: OPEN_LOOP_COMPLETION_BASES.DETERMINISTIC_ARTIFACT,
    'deterministic-receipt': OPEN_LOOP_COMPLETION_BASES.DETERMINISTIC_ARTIFACT,
    test: OPEN_LOOP_COMPLETION_BASES.TEST_RECEIPT,
    tests: OPEN_LOOP_COMPLETION_BASES.TEST_RECEIPT,
    source: OPEN_LOOP_COMPLETION_BASES.SOURCE_RECEIPT,
    'source-artifact': OPEN_LOOP_COMPLETION_BASES.SOURCE_RECEIPT,
    manual: OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
    command: OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
  };
  const normalized = aliases[basis] || basis;
  return COMPLETION_BASIS_VALUES.has(normalized) ? normalized : '';
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
    turnState.activeProjectThread,
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
    loop.title,
    loop.sourceRefs?.map((ref) => ref.id || ref.label || ref.path || ''),
  ]).map(cleanToken).filter(Boolean);
}

function turnOpenLoopTouchIds(turnState = null) {
  if (!isPlainObject(turnState)) return [];
  return uniqueStrings([
    listValue(turnState.openLoopsTouched),
    listValue(turnState.openLoopIds),
    listValue(turnState.touchedOpenLoopIds),
  ]).map(cleanToken).filter(Boolean);
}

function turnOpenLoopTouchSignal({ turnState = null, loop = {}, loopTokens = [] } = {}) {
  const touchedIds = turnOpenLoopTouchIds(turnState);
  if (!touchedIds.length) return { score: 0, related: false, direct: false };
  const loopId = cleanToken(loop.id);
  if (loopId && touchedIds.includes(loopId)) {
    return { score: 4.25, related: true, direct: true };
  }
  const touchTokens = tokenizeRelevanceText(touchedIds.map((item) => item.replace(/-/g, ' ')));
  const matched = overlapTokens(loopTokens, touchTokens);
  if (matched.length >= 2) {
    return { score: 2.75, related: true, direct: false };
  }
  return { score: 0, related: false, direct: false };
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

function countWords(text = '') {
  return (String(text || '').trim().match(/\S+/g) || []).length;
}

function trimWords(text = '', maxWords = DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS) {
  const limit = clampInteger(maxWords, DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS, 1, 160);
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ').replace(/[;:,.!?-]+$/g, '')}...`;
}

function trimSnippetWithGuardrail(prefix = '', guardrail = '', maxWords = DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS) {
  const limit = clampInteger(maxWords, DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS, 40, 120);
  const tail = cleanString(guardrail, 500);
  const tailWords = countWords(tail);
  const prefixLimit = Math.max(1, limit - tailWords);
  return cleanString(`${trimWords(prefix, prefixLimit)} ${tail}`, 1200);
}

function formatSourceRefSummary(sourceRefs = []) {
  const refs = normalizeSourceRefs(sourceRefs);
  const ref = refs[0];
  if (!ref) return '';
  const type = cleanString(ref.type || 'source', 40);
  const value = cleanString(ref.path || ref.url || ref.id || ref.label || ref.note || '', 120);
  if (!type && !value) return '';
  return cleanString(`${type}${value ? ` ${value}` : ''}`, 180);
}

function formatOpenLoopPromptBridgeSnippet({
  loop = {},
  selection = {},
  maxWords = DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS,
} = {}) {
  const normalized = normalizeOpenLoop(loop) || normalizeOpenLoop(selection);
  if (!normalized) return '';
  const selected = isPlainObject(selection) ? selection : {};
  const status = cleanString(classifyOpenLoopStatus(normalized), 80).replace(/-/g, ' ');
  const title = cleanString(normalized.title, 180);
  const nextStep = cleanString(normalized.nextLikelyStep, 180).replace(/[.?!]+$/g, '');
  const source = formatSourceRefSummary(normalized.sourceRefs);
  const relevance = cleanString(selected.surfaceReason || 'selected-open-loop', 160);
  const prefix = [
    `Open loop candidate, advisory: ${title}${status ? ` is ${status}` : ''}.`,
    nextStep ? `Likely next step: ${nextStep}.` : '',
    `Relevance: ${relevance}.`,
    source ? `Source: ${source}.` : 'Source: open-loop state.',
  ].filter(Boolean).join(' ');
  const guardrail = "Surface only if directly relevant to the user's current turn. Do not treat this as canonical memory or overclaim its status.";
  return trimSnippetWithGuardrail(prefix, guardrail, maxWords);
}

function normalizedLoopMap(loops = []) {
  const byId = new Map();
  for (const rawLoop of rawLoopList(loops)) {
    const loop = normalizeOpenLoop(rawLoop);
    if (loop && !byId.has(loop.id)) byId.set(loop.id, loop);
  }
  return byId;
}

function buildOpenLoopPromptBridge({
  loops = [],
  userText = '',
  staticCandidates = [],
  turnState = null,
  maxLoops = 1,
  maxSnippetWords = DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS,
  now = new Date(),
  measurementMode = 'fixture-only',
  enabled = true,
  disabledReason = '',
} = {}) {
  const renderedCap = clampInteger(maxLoops, 1, 0, 1);
  const wordCap = clampInteger(maxSnippetWords, DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS, 40, 120);
  const liveEnabled = enabled === true && renderedCap > 0;
  const selection = liveEnabled
    ? selectRelevantOpenLoops({
        loops,
        userText,
        staticCandidates,
        turnState,
        maxLoops: renderedCap,
        now,
      })
    : {
        selected: [],
        heldBack: renderedCap <= 0 && rawLoopList(loops).length
          ? rawLoopList(loops)
            .map((rawLoop) => normalizeOpenLoop(rawLoop))
            .filter(Boolean)
            .map((loop) => ({ id: loop.id, reason: 'max-loop-cap' }))
          : [],
      };
  const loopsById = normalizedLoopMap(loops);
  const snippets = selection.selected.map((selectedLoop) => {
    const loop = loopsById.get(selectedLoop.id) || normalizeOpenLoop(selectedLoop);
    const text = formatOpenLoopPromptBridgeSnippet({
      loop,
      selection: selectedLoop,
      maxWords: wordCap,
    });
    if (!text || !loop) return null;
    return {
      id: loop.id,
      title: loop.title,
      status: classifyOpenLoopStatus(loop, now),
      authority: OPEN_LOOP_AUTHORITY,
      confidence: selectedLoop.confidence || loop.confidence,
      surfaceReason: selectedLoop.surfaceReason || 'selected-open-loop',
      sourceRefs: loop.sourceRefs,
      wordCount: countWords(text),
      text,
    };
  }).filter(Boolean);
  const promptText = snippets.map((snippet) => snippet.text).join('\n');
  const mode = cleanString(measurementMode, 80) || 'fixture-only';
  const bridgeRendered = liveEnabled && snippets.length > 0;

  return {
    schema: OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
    generatedAt: normalizeIso(now) || new Date(normalizeNowMs(now)).toISOString(),
    measurementMode: mode,
    enabled: liveEnabled,
    disabledReason: liveEnabled ? '' : cleanString(disabledReason || (renderedCap <= 0 ? 'max-rendered-0' : 'disabled'), 160),
    livePromptBridge: mode === 'live-advisory' && bridgeRendered,
    liveChatTouched: mode === 'live-advisory' && bridgeRendered,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    maxRenderedLoops: renderedCap,
    maxSnippetWords: wordCap,
    selected: snippets,
    heldBack: selection.heldBack,
    selection,
    promptBridge: {
      renderedCount: snippets.length,
      promptText,
      snippets,
    },
    limits: [
      'Open loops are advisory continuity, not canonical memory.',
      'This fixture bridge does not touch live chat or PromptTruth.',
      'Surface only if directly relevant; do not overclaim weak evidence.',
    ],
  };
}

function buildOpenLoopPromptBridgeFixture(options = {}) {
  return buildOpenLoopPromptBridge({
    ...options,
    measurementMode: 'fixture-only',
    enabled: true,
  });
}

function buildLiveOpenLoopPromptBridge({
  state = null,
  loops = [],
  userText = '',
  staticCandidates = [],
  turnState = null,
  maxRendered = 1,
  maxTokens = DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS,
  maxSnippetWords = null,
  now = new Date(),
  enabled = false,
  disabledReason = '',
  budgetMs = OPEN_LOOP_RELEVANCE_BUDGET_MS,
  clockMs = () => Date.now(),
} = {}) {
  const startedMs = typeof clockMs === 'function' ? clockMs() : Date.now();
  const rawLoops = rawLoopList(state).length ? rawLoopList(state) : loops;
  const cap = clampInteger(maxRendered, 1, 0, 1);
  const wordCap = clampInteger(
    maxSnippetWords ?? maxTokens,
    DEFAULT_OPEN_LOOP_BRIDGE_MAX_WORDS,
    40,
    120,
  );
  const bridge = buildOpenLoopPromptBridge({
    loops: rawLoops,
    userText,
    staticCandidates,
    turnState,
    maxLoops: cap,
    maxSnippetWords: wordCap,
    now,
    measurementMode: 'live-advisory',
    enabled: enabled === true,
    disabledReason,
  });
  const finishedMs = typeof clockMs === 'function' ? clockMs() : Date.now();
  const actualMs = Math.max(0, Number(finishedMs || 0) - Number(startedMs || 0));
  const selection = bridge.selection && typeof bridge.selection === 'object' ? bridge.selection : {};
  const inspectedCount = selection.inspectedCount ?? rawLoopList(rawLoops).length;
  return {
    ...bridge,
    frameBudgetSidecar: buildFrameBudgetSidecarReceipt({
      id: 'open-loop-relevance',
      label: 'Open-loop relevance',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RELEVANCE,
      budgetMs,
      actualMs,
      enabled: bridge.enabled === true,
      skipped: bridge.enabled !== true,
      openLoopCount: inspectedCount,
      candidateCount: inspectedCount,
      selectedCount: bridge.selected?.length || 0,
      renderedCount: bridge.promptBridge?.renderedCount || 0,
      sourceAuthority: OPEN_LOOP_AUTHORITY,
      reason: bridge.enabled === true ? '' : bridge.disabledReason,
      fallback: bridge.enabled === true ? '' : 'Hold back open-loop prompt context for this frame.',
    }),
  };
}

function mergeOpenLoopPromptBridgeIntoArchiveContext({
  archiveContext = null,
  bridge = null,
} = {}) {
  const base = archiveContext && typeof archiveContext === 'object' ? archiveContext : {};
  const snippets = Array.isArray(bridge?.promptBridge?.snippets)
    ? bridge.promptBridge.snippets
    : [];
  if (bridge?.enabled !== true) return base;
  const openLoops = snippets.slice(0, 1).map((snippet) => ({
    id: snippet.id,
    text: snippet.text,
    status: snippet.status || 'open',
    authority: OPEN_LOOP_AUTHORITY,
    source: 'penny-open-loop-state',
    surfaceReason: snippet.surfaceReason || 'selected-open-loop',
    confidence: snippet.confidence || 'medium',
  }));
  return {
    ...base,
    openLoops,
    openLoopPromptBridge: {
      schema: bridge.schema || OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
      measurementMode: bridge.measurementMode || 'live-advisory',
      enabled: bridge.enabled === true,
      renderedCount: openLoops.length,
      selectedIds: snippets.slice(0, 1).map((snippet) => snippet.id).filter(Boolean),
      heldBack: Array.isArray(bridge.heldBack) ? bridge.heldBack.slice(0, 8) : [],
      promptTruthExpanded: false,
      promptTruthChannelAdded: false,
    },
  };
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
  const turnStateSignal = turnOpenLoopTouchSignal({ turnState, loop, loopTokens });
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
    turnStateOpenLoop: turnStateSignal.score,
    staticCandidate: staticSignal.score,
    lexicalOverlap: lexicalScore,
    recent: recent.score,
    priority: priorityScore,
  };
  const score = Object.values(components).reduce((total, value) => total + Number(value || 0), 0);
  const central = explicitAnchor
    || exactAnchor
    || projectThreadMatch
    || turnStateSignal.related
    || staticSignal.related
    || matchedTokens.length >= 3;
  const reasonParts = [];
  if (explicitAnchor) reasonParts.push('explicit-anchor');
  else if (exactAnchor) reasonParts.push('exact-anchor');
  else if (projectThreadMatch) reasonParts.push('project-thread');
  else if (turnStateSignal.related) {
    reasonParts.push(turnStateSignal.direct ? 'turn-state-open-loop' : 'turn-state-open-loop-related');
  }
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
  let inspectedCount = 0;

  for (const rawLoop of rawLoopList(loops)) {
    const loop = normalizeOpenLoop(rawLoop);
    if (!loop) continue;
    inspectedCount += 1;
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
      selected: true,
      central: item.relevance.central,
      authority: OPEN_LOOP_AUTHORITY,
      nextLikelyStep: item.loop.nextLikelyStep,
      sourceRefs: item.loop.sourceRefs,
      score: item.relevance.score,
      surfaceReason: item.relevance.surfaceReason,
      confidence: item.relevance.confidence,
      matchedTokens: item.relevance.matchedTokens,
      promptSnippet: formatPromptSnippet(item.loop),
    });
  }

  return {
    selected,
    heldBack,
    inspectedCount,
    scoredCount: scored.length,
    selectedCount: selected.length,
    heldBackCount: heldBack.length,
  };
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

function mergeSourceRefs(...refGroups) {
  return normalizeSourceRefs(refGroups.flat(Infinity));
}

function normalizeOpenLoopHistoryEntry(entryLike = {}) {
  const raw = isPlainObject(entryLike) ? entryLike : {};
  const action = normalizeLifecycleAction(raw.action || raw.operation || raw.type);
  const at = normalizeIso(raw.at || raw.timestamp || raw.updatedAt || raw.createdAt);
  if (!action || !at) return null;
  const status = normalizeStatus(raw.status);
  const basis = normalizeCompletionBasis(raw.basis || raw.receiptBasis || raw.completionBasis);
  const reason = cleanString(raw.reason || raw.note || raw.summary || '', 360);
  const sourceRefs = normalizeSourceRefs(raw.sourceRefs || raw.sources || []);
  return {
    action,
    at,
    authority: OPEN_LOOP_AUTHORITY,
    ...(status ? { status } : {}),
    ...(basis ? { basis } : {}),
    ...(reason ? { reason } : {}),
    ...(sourceRefs.length ? { sourceRefs } : {}),
  };
}

function normalizeOpenLoopHistory(value = []) {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map(normalizeOpenLoopHistoryEntry)
    .filter(Boolean)
    .slice(-30);
}

function lifecycleTimestamp({ now = new Date(), at = '' } = {}) {
  return normalizeIso(at || now) || new Date(normalizeNowMs(now)).toISOString();
}

function buildLifecycleHistoryEntry({
  action = '',
  status = '',
  basis = '',
  reason = '',
  sourceRefs = [],
  now = new Date(),
  at = '',
} = {}) {
  return normalizeOpenLoopHistoryEntry({
    action,
    status,
    basis,
    reason,
    sourceRefs,
    at: lifecycleTimestamp({ now, at }),
  });
}

function appendOpenLoopHistory(loopLike = {}, entryLike = {}) {
  const loop = normalizeOpenLoop(loopLike);
  const entry = normalizeOpenLoopHistoryEntry(entryLike);
  if (!loop || !entry) return loop;
  return {
    ...loop,
    history: normalizeOpenLoopHistory([
      ...(Array.isArray(loop.history) ? loop.history : []),
      entry,
    ]),
  };
}

function assertNoTerminalStatusUpdate(updates = {}) {
  const raw = isPlainObject(updates) ? updates : {};
  const status = normalizeStatus(raw.status || '');
  if (!status) return;
  if ([
    OPEN_LOOP_STATUSES.COMPLETED,
    OPEN_LOOP_STATUSES.DISMISSED,
    OPEN_LOOP_STATUSES.EXPIRED,
  ].includes(status)) {
    throw new TypeError('updateOpenLoop cannot set terminal lifecycle status; use completeOpenLoop, dismissOpenLoop, or expireOpenLoops.');
  }
}

function buildLifecycleReason(options = {}, fallback = '') {
  return cleanString(options.reason || options.note || fallback, 360);
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
    history: normalizeOpenLoopHistory(raw.history || raw.lifecycleHistory || []),
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

function createOpenLoop(loopLike = {}, options = {}) {
  const at = lifecycleTimestamp(options);
  const raw = isPlainObject(loopLike) ? loopLike : {};
  const requestedStatus = normalizeStatus(raw.status || OPEN_LOOP_STATUSES.OPEN);
  if ([
    OPEN_LOOP_STATUSES.COMPLETED,
    OPEN_LOOP_STATUSES.DISMISSED,
    OPEN_LOOP_STATUSES.EXPIRED,
  ].includes(requestedStatus)) {
    throw new TypeError('createOpenLoop cannot create terminal lifecycle status; use completeOpenLoop, dismissOpenLoop, or expireOpenLoops.');
  }
  const loop = normalizeOpenLoop({
    ...raw,
    status: requestedStatus || OPEN_LOOP_STATUSES.OPEN,
    lastTouchedAt: raw.lastTouchedAt || raw.updatedAt || raw.createdAt || at,
    sourceRefs: mergeSourceRefs(raw.sourceRefs || raw.sources || [], options.sourceRefs || options.sources || []),
  });
  if (!loop) return null;
  return appendOpenLoopHistory(loop, buildLifecycleHistoryEntry({
    action: OPEN_LOOP_LIFECYCLE_ACTIONS.CREATE,
    status: loop.status,
    basis: options.basis || OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
    reason: buildLifecycleReason(options, 'created-open-loop'),
    sourceRefs: mergeSourceRefs(options.sourceRefs || options.sources || [], loop.sourceRefs),
    at,
  }));
}

function updateOpenLoop(loopLike = {}, updates = {}, options = {}) {
  assertNoTerminalStatusUpdate(updates);
  const loop = normalizeOpenLoop(loopLike);
  const rawUpdates = isPlainObject(updates) ? updates : {};
  if (!loop) return null;
  const at = lifecycleTimestamp(options);
  const next = {
    ...loop,
    lastTouchedAt: at,
  };
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'title')) {
    next.title = cleanString(rawUpdates.title, 220);
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'summary')) {
    next.title = cleanString(rawUpdates.summary, 220);
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'status')) {
    const status = normalizeStatus(rawUpdates.status);
    if (status) next.status = status;
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'priority')) {
    next.priority = normalizePriority(rawUpdates.priority);
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'confidence')) {
    next.confidence = normalizeConfidence(rawUpdates.confidence);
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'nextLikelyStep')
    || Object.prototype.hasOwnProperty.call(rawUpdates, 'nextStep')) {
    next.nextLikelyStep = cleanString(rawUpdates.nextLikelyStep || rawUpdates.nextStep || '', 500);
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'surfacePolicy')
    || Object.prototype.hasOwnProperty.call(rawUpdates, 'surfaceMode')
    || Object.prototype.hasOwnProperty.call(rawUpdates, 'maxSurfaceCount')
    || Object.prototype.hasOwnProperty.call(rawUpdates, 'expiresAt')) {
    next.surfacePolicy = normalizeSurfacePolicy({
      ...(loop.surfacePolicy || {}),
      ...(isPlainObject(rawUpdates.surfacePolicy) ? rawUpdates.surfacePolicy : {}),
      ...(Object.prototype.hasOwnProperty.call(rawUpdates, 'surfaceMode') ? { mode: rawUpdates.surfaceMode } : {}),
      ...(Object.prototype.hasOwnProperty.call(rawUpdates, 'maxSurfaceCount') ? { maxSurfaceCount: rawUpdates.maxSurfaceCount } : {}),
      ...(Object.prototype.hasOwnProperty.call(rawUpdates, 'expiresAt') ? { expiresAt: rawUpdates.expiresAt } : {}),
    });
  }
  const sourceRefs = mergeSourceRefs(
    loop.sourceRefs,
    rawUpdates.sourceRefs || rawUpdates.sources || [],
    options.sourceRefs || options.sources || [],
  );
  next.sourceRefs = sourceRefs;
  const normalized = normalizeOpenLoop(next);
  if (!normalized) return null;
  return appendOpenLoopHistory(normalized, buildLifecycleHistoryEntry({
    action: OPEN_LOOP_LIFECYCLE_ACTIONS.UPDATE,
    status: normalized.status,
    basis: options.basis || OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
    reason: buildLifecycleReason(options, 'updated-open-loop'),
    sourceRefs: mergeSourceRefs(rawUpdates.sourceRefs || rawUpdates.sources || [], options.sourceRefs || options.sources || []),
    at,
  }));
}

function assertCompletionBasis(options = {}) {
  const basis = normalizeCompletionBasis(options.basis || options.receiptBasis || options.completionBasis);
  if (!basis) {
    throw new TypeError('completeOpenLoop requires explicit user statement, deterministic artifact/test/source receipt, or manual command basis.');
  }
  return basis;
}

function completeOpenLoop(loopLike = {}, options = {}) {
  const basis = assertCompletionBasis(options);
  const loop = normalizeOpenLoop(loopLike);
  if (!loop) return null;
  const at = lifecycleTimestamp(options);
  const completed = normalizeOpenLoop({
    ...loop,
    status: OPEN_LOOP_STATUSES.COMPLETED,
    dismissed: false,
    completedAt: at,
    lastTouchedAt: at,
    sourceRefs: mergeSourceRefs(loop.sourceRefs, options.sourceRefs || options.sources || []),
  });
  return appendOpenLoopHistory(completed, buildLifecycleHistoryEntry({
    action: OPEN_LOOP_LIFECYCLE_ACTIONS.COMPLETE,
    status: OPEN_LOOP_STATUSES.COMPLETED,
    basis,
    reason: buildLifecycleReason(options, 'completed-open-loop'),
    sourceRefs: options.sourceRefs || options.sources || [],
    at,
  }));
}

function dismissOpenLoop(loopLike = {}, options = {}) {
  const loop = normalizeOpenLoop(loopLike);
  if (!loop) return null;
  const at = lifecycleTimestamp(options);
  const dismissed = normalizeOpenLoop({
    ...loop,
    status: OPEN_LOOP_STATUSES.DISMISSED,
    dismissed: true,
    completedAt: null,
    lastTouchedAt: at,
    sourceRefs: mergeSourceRefs(loop.sourceRefs, options.sourceRefs || options.sources || []),
  });
  return appendOpenLoopHistory(dismissed, buildLifecycleHistoryEntry({
    action: OPEN_LOOP_LIFECYCLE_ACTIONS.DISMISS,
    status: OPEN_LOOP_STATUSES.DISMISSED,
    basis: options.basis || OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
    reason: buildLifecycleReason(options, 'dismissed-open-loop'),
    sourceRefs: options.sourceRefs || options.sources || [],
    at,
  }));
}

function deferOpenLoop(loopLike = {}, options = {}) {
  const loop = normalizeOpenLoop(loopLike);
  if (!loop) return null;
  const at = lifecycleTimestamp(options);
  const currentStatus = classifyOpenLoopStatus(loop, options.now || at);
  if ([
    OPEN_LOOP_STATUSES.COMPLETED,
    OPEN_LOOP_STATUSES.DISMISSED,
    OPEN_LOOP_STATUSES.EXPIRED,
  ].includes(currentStatus)) {
    throw new TypeError('deferOpenLoop cannot reactivate completed, dismissed, or expired loops.');
  }
  const surfacePolicy = options.expiresAt
    ? normalizeSurfacePolicy({ ...(loop.surfacePolicy || {}), expiresAt: options.expiresAt })
    : loop.surfacePolicy;
  const deferred = normalizeOpenLoop({
    ...loop,
    status: OPEN_LOOP_STATUSES.DEFERRED,
    dismissed: false,
    completedAt: null,
    lastTouchedAt: at,
    nextLikelyStep: Object.prototype.hasOwnProperty.call(options, 'nextLikelyStep') || Object.prototype.hasOwnProperty.call(options, 'nextStep')
      ? cleanString(options.nextLikelyStep || options.nextStep || '', 500)
      : loop.nextLikelyStep,
    surfacePolicy,
    sourceRefs: mergeSourceRefs(loop.sourceRefs, options.sourceRefs || options.sources || []),
  });
  return appendOpenLoopHistory(deferred, buildLifecycleHistoryEntry({
    action: OPEN_LOOP_LIFECYCLE_ACTIONS.DEFER,
    status: OPEN_LOOP_STATUSES.DEFERRED,
    basis: options.basis || OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
    reason: buildLifecycleReason(options, 'deferred-open-loop'),
    sourceRefs: options.sourceRefs || options.sources || [],
    at,
  }));
}

function expireOpenLoops(stateLike = {}, options = {}) {
  const at = lifecycleTimestamp(options);
  const normalized = normalizeOpenLoopState(stateLike);
  const expiredLoopIds = [];
  const loops = normalized.loops.map((loop) => {
    if (loop.status === OPEN_LOOP_STATUSES.COMPLETED || loop.status === OPEN_LOOP_STATUSES.DISMISSED) {
      return loop;
    }
    if (classifyOpenLoopStatus(loop, options.now || at) !== OPEN_LOOP_STATUSES.EXPIRED) {
      return loop;
    }
    if (loop.status === OPEN_LOOP_STATUSES.EXPIRED) return loop;
    expiredLoopIds.push(loop.id);
    const expired = normalizeOpenLoop({
      ...loop,
      status: OPEN_LOOP_STATUSES.EXPIRED,
      lastTouchedAt: at,
    });
    return appendOpenLoopHistory(expired, buildLifecycleHistoryEntry({
      action: OPEN_LOOP_LIFECYCLE_ACTIONS.EXPIRE,
      status: OPEN_LOOP_STATUSES.EXPIRED,
      basis: OPEN_LOOP_COMPLETION_BASES.DETERMINISTIC_ARTIFACT,
      reason: buildLifecycleReason(options, 'surface-policy-expired'),
      sourceRefs: options.sourceRefs || options.sources || [],
      at,
    }));
  });

  return {
    state: {
      schema: OPEN_LOOP_SCHEMA,
      updatedAt: expiredLoopIds.length ? at : normalized.updatedAt,
      loops,
    },
    expiredLoopIds,
  };
}

function applyOpenLoopDismissals(stateLike = {}, options = {}) {
  const normalized = normalizeOpenLoopState(stateLike);
  const at = lifecycleTimestamp(options);
  const targetIds = new Set(uniqueStrings(options.dismissedOpenLoopIds || options.loopIds || [], 20)
    .map((id) => cleanString(id, 140))
    .filter(Boolean));
  const dismissedLoopIds = [];
  const heldBack = [];
  const seen = new Set();

  if (!targetIds.size) {
    return {
      schema: OPEN_LOOP_SCHEMA,
      state: normalized,
      dismissedLoopIds,
      heldBack,
      authority: OPEN_LOOP_AUTHORITY,
      memoryWrites: false,
      autonomousActions: false,
    };
  }

  const loops = normalized.loops.map((loop) => {
    if (!targetIds.has(loop.id)) return loop;
    seen.add(loop.id);
    const status = classifyOpenLoopStatus(loop, options.now || at);
    if ([
      OPEN_LOOP_STATUSES.COMPLETED,
      OPEN_LOOP_STATUSES.DISMISSED,
      OPEN_LOOP_STATUSES.EXPIRED,
    ].includes(status)) {
      heldBack.push({ id: loop.id, reason: `${status}-not-dismissed` });
      return loop;
    }
    const dismissed = dismissOpenLoop(loop, {
      ...options,
      at,
      basis: options.basis || OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
      reason: buildLifecycleReason(options, 'user-dismissed-reminder'),
    });
    if (!dismissed) {
      heldBack.push({ id: loop.id, reason: 'invalid-loop' });
      return loop;
    }
    dismissedLoopIds.push(loop.id);
    return dismissed;
  });

  for (const id of targetIds) {
    if (!seen.has(id)) heldBack.push({ id, reason: 'loop-not-found' });
  }

  return {
    schema: OPEN_LOOP_SCHEMA,
    state: {
      ...normalized,
      updatedAt: dismissedLoopIds.length ? at : normalized.updatedAt,
      loops,
    },
    dismissedLoopIds,
    heldBack,
    authority: OPEN_LOOP_AUTHORITY,
    memoryWrites: false,
    autonomousActions: false,
  };
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
  OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
  OPEN_LOOP_STATUSES,
  OPEN_LOOP_COMPLETION_BASES,
  OPEN_LOOP_LIFECYCLE_ACTIONS,
  applyOpenLoopDismissals,
  buildLiveOpenLoopPromptBridge,
  buildOpenLoopPromptBridgeFixture,
  completeOpenLoop,
  createOpenLoop,
  deferOpenLoop,
  dismissOpenLoop,
  expireOpenLoops,
  formatOpenLoopPromptBridgeSnippet,
  mergeOpenLoopPromptBridgeIntoArchiveContext,
  normalizeOpenLoop,
  normalizeOpenLoopState,
  summarizeOpenLoopState,
  classifyOpenLoopStatus,
  selectRelevantOpenLoops,
  updateOpenLoop,
};
