const TURN_STATE_SCHEMA = 'penny-turn-state.v1';

const MEASUREMENT_MODE = 'ephemeral';

const DESIRED_DEPTHS = Object.freeze({
  UNKNOWN: 'unknown',
  CONCISE: 'concise',
  STANDARD: 'standard',
  DETAILED: 'detailed',
  EXTENSIVE: 'extensive',
});

const RESPONSE_MODES = Object.freeze({
  UNKNOWN: 'unknown',
  CONCISE_ANSWER: 'concise-answer',
  TECHNICAL_ROADMAP: 'technical-roadmap',
  CODE_REVIEW: 'code-review',
  AGENT_PROMPT: 'agent-prompt',
  SOURCE_BACKED_REVIEW: 'source-backed-review',
  BRAINSTORM: 'brainstorm',
  CAREFUL_UNCERTAINTY: 'careful-uncertainty',
  SUPPORTIVE_CHECK_IN: 'supportive-check-in',
});

const ENERGY_LABELS = new Set([
  'unknown',
  'calm',
  'focused',
  'excited',
  'urgent',
  'frustrated',
  'playful',
  'tender',
  'intense',
]);

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown']);
const DESIRED_DEPTH_VALUES = new Set(Object.values(DESIRED_DEPTHS));
const RESPONSE_MODE_VALUES = new Set(Object.values(RESPONSE_MODES));

const HIDDEN_COT_FIELD_KEYS = new Set([
  'activations',
  'chainofthought',
  'cot',
  'hiddencot',
  'hiddenreasoning',
  'hiddenthoughts',
  'internalmonologue',
  'latentstate',
  'mindstate',
  'neuralstate',
  'privateinference',
  'psychologicalprofile',
  'reasoningtrace',
  'scratchpad',
  'thoughttrace',
]);

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

function normalizeFieldKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function boolValue(value) {
  const token = cleanToken(value);
  return value === true || token === 'true' || token === 'yes' || token === '1';
}

function uniqueStrings(values = [], limit = 20, stringLimit = 220) {
  const out = [];
  const seen = new Set();
  const source = Array.isArray(values) ? values.flat(Infinity) : [values];
  for (const value of source) {
    const text = cleanString(value, stringLimit);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function collectHiddenCotFields(value, path = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectHiddenCotFields(item, `${path}[${index}]`, out));
    return out;
  }
  if (!isPlainObject(value)) return out;
  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (HIDDEN_COT_FIELD_KEYS.has(normalizeFieldKey(key))) {
      out.push(fieldPath);
      continue;
    }
    collectHiddenCotFields(nested, fieldPath, out);
  }
  return out;
}

function normalizeDesiredDepth(value = '') {
  const token = cleanToken(value);
  const aliases = {
    brief: DESIRED_DEPTHS.CONCISE,
    quick: DESIRED_DEPTHS.CONCISE,
    short: DESIRED_DEPTHS.CONCISE,
    compact: DESIRED_DEPTHS.CONCISE,
    normal: DESIRED_DEPTHS.STANDARD,
    medium: DESIRED_DEPTHS.STANDARD,
    default: DESIRED_DEPTHS.STANDARD,
    thorough: DESIRED_DEPTHS.DETAILED,
    deep: DESIRED_DEPTHS.DETAILED,
    long: DESIRED_DEPTHS.EXTENSIVE,
    exhaustive: DESIRED_DEPTHS.EXTENSIVE,
    full: DESIRED_DEPTHS.EXTENSIVE,
  };
  const normalized = aliases[token] || token;
  return DESIRED_DEPTH_VALUES.has(normalized) ? normalized : DESIRED_DEPTHS.UNKNOWN;
}

function normalizeResponseMode(value = '') {
  const token = cleanToken(value);
  const aliases = {
    brief: RESPONSE_MODES.CONCISE_ANSWER,
    concise: RESPONSE_MODES.CONCISE_ANSWER,
    answer: RESPONSE_MODES.CONCISE_ANSWER,
    'quick-answer': RESPONSE_MODES.CONCISE_ANSWER,
    technical: RESPONSE_MODES.TECHNICAL_ROADMAP,
    roadmap: RESPONSE_MODES.TECHNICAL_ROADMAP,
    'technical-plan': RESPONSE_MODES.TECHNICAL_ROADMAP,
    plan: RESPONSE_MODES.TECHNICAL_ROADMAP,
    implementation: RESPONSE_MODES.TECHNICAL_ROADMAP,
    review: RESPONSE_MODES.CODE_REVIEW,
    audit: RESPONSE_MODES.CODE_REVIEW,
    'strict-review': RESPONSE_MODES.CODE_REVIEW,
    prompt: RESPONSE_MODES.AGENT_PROMPT,
    handoff: RESPONSE_MODES.AGENT_PROMPT,
    source: RESPONSE_MODES.SOURCE_BACKED_REVIEW,
    'source-review': RESPONSE_MODES.SOURCE_BACKED_REVIEW,
    'source-backed': RESPONSE_MODES.SOURCE_BACKED_REVIEW,
    ideation: RESPONSE_MODES.BRAINSTORM,
    explore: RESPONSE_MODES.BRAINSTORM,
    uncertainty: RESPONSE_MODES.CAREFUL_UNCERTAINTY,
    careful: RESPONSE_MODES.CAREFUL_UNCERTAINTY,
    support: RESPONSE_MODES.SUPPORTIVE_CHECK_IN,
    supportive: RESPONSE_MODES.SUPPORTIVE_CHECK_IN,
    'check-in': RESPONSE_MODES.SUPPORTIVE_CHECK_IN,
  };
  const normalized = aliases[token] || token;
  return RESPONSE_MODE_VALUES.has(normalized) ? normalized : RESPONSE_MODES.UNKNOWN;
}

function normalizeConfidence(value = '') {
  const token = cleanToken(value);
  if (token === 'unclear' || token === 'none') return 'unknown';
  return CONFIDENCE_VALUES.has(token) ? token : 'unknown';
}

function normalizeEnergyLabel(value = '') {
  const token = cleanToken(value);
  if (!token || token === 'unclear') return 'unknown';
  return ENERGY_LABELS.has(token) ? token : 'unknown';
}

function normalizeEnergy(value = {}) {
  const raw = isPlainObject(value) ? value : {};
  return {
    label: normalizeEnergyLabel(raw.label || raw.tone || raw.energy),
    confidence: normalizeConfidence(raw.confidence),
    evidence: uniqueStrings(raw.evidence || raw.reasons || [], 8, 160),
  };
}

function sourceLabelFromRef(refLike = '') {
  if (typeof refLike === 'string') return cleanString(refLike, 160);
  if (!isPlainObject(refLike)) return '';
  const type = cleanString(refLike.type || refLike.kind || '', 40);
  const identity = cleanString(
    refLike.path || refLike.url || refLike.id || refLike.label || refLike.note || '',
    140,
  );
  if (type && identity) return `${type} ${identity}`;
  return identity || type;
}

function normalizeConstraint(value = {}) {
  if (typeof value === 'string') return cleanString(value, 240);
  if (!isPlainObject(value)) return '';
  const text = cleanString(
    value.text || value.label || value.constraint || value.summary || value.value || '',
    180,
  );
  const source = sourceLabelFromRef(
    value.sourceLabel || value.source || value.sourceRef || value.ref || value.doc || value.path || '',
  );
  if (source && text) return `${source}: ${text}`;
  return text || source;
}

function normalizeConstraints(value = []) {
  const source = Array.isArray(value) ? value : [value];
  return uniqueStrings(source.map(normalizeConstraint), 24, 260);
}

function normalizeOpenLoopsTouched(value = []) {
  const source = Array.isArray(value) ? value : [value];
  return uniqueStrings(source.map((item) => {
    if (typeof item === 'string') return item;
    if (!isPlainObject(item)) return '';
    return item.id || item.title || item.label || item.name || '';
  }), 12, 120);
}

function normalizeWarnings(rawWarnings = [], hiddenFields = [], raw = {}) {
  const warnings = uniqueStrings(rawWarnings, 20, 220);
  if (hiddenFields.length > 0) {
    warnings.push(`hidden-CoT fields rejected: ${hiddenFields.join(', ')}`);
  }
  if (boolValue(raw.persist)) {
    warnings.push('persist request rejected: turn state is ephemeral');
  }
  const measurementMode = cleanToken(raw.measurementMode || '');
  if (measurementMode && measurementMode !== MEASUREMENT_MODE) {
    warnings.push(`measurement mode normalized to ${MEASUREMENT_MODE}`);
  }
  return uniqueStrings(warnings, 24, 240);
}

function normalizeTurnState(stateLike = {}) {
  const raw = isPlainObject(stateLike) ? stateLike : {};
  const hiddenFields = collectHiddenCotFields(raw);
  const warnings = normalizeWarnings(raw.warnings || raw.warning || [], hiddenFields, raw);

  return {
    schema: TURN_STATE_SCHEMA,
    measurementMode: MEASUREMENT_MODE,
    persist: false,
    userIntent: cleanString(raw.userIntent || raw.intent || raw.goal || '', 260),
    desiredDepth: normalizeDesiredDepth(raw.desiredDepth || raw.depth),
    responseMode: normalizeResponseMode(raw.responseMode || raw.mode || raw.responseShape),
    energy: normalizeEnergy(raw.energy),
    activeProjectThread: cleanString(raw.activeProjectThread || raw.projectThread || raw.thread || '', 180),
    activeConstraints: normalizeConstraints(raw.activeConstraints || raw.constraints || []),
    sourcePosture: cleanToken(raw.sourcePosture || raw.sourceMode || raw.evidencePosture || ''),
    openLoopsTouched: normalizeOpenLoopsTouched(raw.openLoopsTouched || raw.openLoopIds || raw.openLoops || []),
    suggestedResponseShape: cleanString(raw.suggestedResponseShape || raw.responseShape || '', 220),
    warnings,
    rejectedFields: uniqueStrings(hiddenFields, 20, 160),
  };
}

function buildTurnState(input = {}) {
  if (isPlainObject(input?.turnState)) return normalizeTurnState(input.turnState);
  if (isPlainObject(input?.state)) return normalizeTurnState(input.state);
  return normalizeTurnState(input);
}

function summarizeTurnState(stateLike = {}) {
  const state = normalizeTurnState(stateLike);
  return {
    schema: state.schema,
    measurementMode: state.measurementMode,
    persist: state.persist,
    userIntent: state.userIntent,
    desiredDepth: state.desiredDepth,
    responseMode: state.responseMode,
    energyLabel: state.energy.label,
    energyConfidence: state.energy.confidence,
    activeProjectThread: state.activeProjectThread,
    activeConstraintCount: state.activeConstraints.length,
    openLoopsTouchedCount: state.openLoopsTouched.length,
    warningCount: state.warnings.length,
    rejectedFieldCount: state.rejectedFields.length,
  };
}

module.exports = {
  DESIRED_DEPTHS,
  RESPONSE_MODES,
  TURN_STATE_SCHEMA,
  buildTurnState,
  normalizeTurnState,
  summarizeTurnState,
};
