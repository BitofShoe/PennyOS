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
};
