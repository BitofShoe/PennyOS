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
const SOURCE_CHECK_POSTURES = new Set([
  '',
  'unspecified',
  'user-provided-context',
  'source-check-needed',
  'source-backed-request',
]);

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

const DEPTH_PATTERNS = Object.freeze({
  extensive: [
    /\blong detailed answers are heaven\b/i,
    /\bas detailed as possible\b/i,
    /\bexhaustive\b/i,
    /\bextensive\b/i,
    /\bdeep dive\b/i,
    /\bgo deep\b/i,
    /\bfull detail\b/i,
    /\bthoroughly\b/i,
  ],
  detailed: [
    /\bdetailed\b/i,
    /\bthorough\b/i,
    /\bin depth\b/i,
    /\bwalk me through\b/i,
    /\blookover\b/i,
  ],
  concise: [
    /\bquick patch\b/i,
    /\bquick fix\b/i,
    /\bbrief\b/i,
    /\bshort\b/i,
    /\bconcise\b/i,
    /\bone[- ]?liner\b/i,
    /\btldr\b/i,
    /\btl;dr\b/i,
    /\bkeep (it )?(small|short|tight)\b/i,
  ],
});

const HIGH_STAKES_PATTERNS = [
  /\blegal\b/i,
  /\blaw\b/i,
  /\bmedical\b/i,
  /\bhealth\b/i,
  /\bdoctor\b/i,
  /\btax\b/i,
  /\bfinancial\b/i,
  /\binvestment\b/i,
  /\bsecurity\b/i,
  /\bsafety\b/i,
  /\bregulation\b/i,
];

const SOURCE_REQUEST_PATTERNS = [
  /\bsource-backed\b/i,
  /\bwith sources?\b/i,
  /\bcitations?\b/i,
  /\bcite\b/i,
  /\bverify\b/i,
  /\bverified\b/i,
  /\bevidence-backed\b/i,
  /\blook up\b/i,
  /\bresearch\b/i,
  /\blatest\b/i,
  /\bcurrent (law|rules?|guidance|status|price|schedule|version)\b/i,
];

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

function matchesAny(text = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
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

function normalizeSignalFlags(value = []) {
  const source = Array.isArray(value) ? value : [value];
  return uniqueStrings(source.map(cleanToken), 20, 80);
}

function normalizeExplicitInstructions(value = []) {
  const source = Array.isArray(value) ? value : [value];
  return uniqueStrings(source, 14, 220);
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

function normalizeSourcePosture(value = '') {
  const token = cleanToken(value);
  if (!token) return '';
  return SOURCE_CHECK_POSTURES.has(token) ? token : token;
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
    explicitInstructions: normalizeExplicitInstructions(
      raw.explicitInstructions || raw.instructions || raw.userInstructions || [],
    ),
    activeConstraints: normalizeConstraints(raw.activeConstraints || raw.constraints || []),
    riskFlags: normalizeSignalFlags(raw.riskFlags || raw.risks || raw.risk || []),
    sourceCheckNeeded: boolValue(
      raw.sourceCheckNeeded || raw.sourceCheckNeed || raw.needsSourceCheck || raw.sourceCheck,
    ),
    sourcePosture: normalizeSourcePosture(raw.sourcePosture || raw.sourceMode || raw.evidencePosture || ''),
    openLoopsTouched: normalizeOpenLoopsTouched(raw.openLoopsTouched || raw.openLoopIds || raw.openLoops || []),
    suggestedResponseShape: cleanString(raw.suggestedResponseShape || raw.responseShape || '', 220),
    warnings,
    rejectedFields: uniqueStrings(hiddenFields, 20, 160),
  };
}

function latestUserTextFromMessages(messages = []) {
  if (!Array.isArray(messages)) return '';
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!isPlainObject(item)) continue;
    const role = cleanToken(item.role || item.sender || '');
    if (role && role !== 'user' && role !== 'human') continue;
    const text = cleanString(item.content || item.text || item.message || '', 4000);
    if (text) return text;
  }
  return '';
}

function userTextFromSignalInput(input = {}) {
  if (typeof input === 'string') return cleanString(input, 4000);
  if (!isPlainObject(input)) return '';
  return cleanString(
    input.userText
      || input.userMessage
      || input.message
      || input.prompt
      || input.text
      || input.query
      || latestUserTextFromMessages(input.messages),
    4000,
  );
}

function splitInstructionFragments(text = '') {
  return cleanString(text, 4000)
    .replace(/([.!?])\s+/g, '$1\n')
    .split(/\n+/)
    .map((item) => cleanString(item, 260))
    .filter(Boolean);
}

function inferUserIntent(text = '') {
  const cleaned = cleanString(text, 260);
  if (!cleaned) return '';
  return cleaned
    .replace(/^(please\s+|plz\s+|can you\s+|could you\s+|would you\s+)/i, '')
    .trim();
}

function inferDesiredDepth(text = '') {
  if (matchesAny(text, DEPTH_PATTERNS.concise)) return DESIRED_DEPTHS.CONCISE;
  if (matchesAny(text, DEPTH_PATTERNS.extensive)) return DESIRED_DEPTHS.EXTENSIVE;
  if (matchesAny(text, DEPTH_PATTERNS.detailed)) return DESIRED_DEPTHS.DETAILED;
  return DESIRED_DEPTHS.UNKNOWN;
}

function inferSourceCheckNeeded(text = '') {
  return matchesAny(text, SOURCE_REQUEST_PATTERNS) || matchesAny(text, HIGH_STAKES_PATTERNS);
}

function inferResponseMode(text = '', desiredDepth = DESIRED_DEPTHS.UNKNOWN, sourceCheckNeeded = false) {
  if (sourceCheckNeeded) return RESPONSE_MODES.SOURCE_BACKED_REVIEW;
  if (/\b(code review|review this diff|review the diff|find bugs|regression|audit)\b/i.test(text)) {
    return RESPONSE_MODES.CODE_REVIEW;
  }
  if (/\b(agent prompt|kickoff prompt|handoff|write a prompt|next agent)\b/i.test(text)) {
    return RESPONSE_MODES.AGENT_PROMPT;
  }
  if (/\b(brainstorm|ideas|ideate|what if|explore options)\b/i.test(text)) {
    return RESPONSE_MODES.BRAINSTORM;
  }
  if (/\b(comfort me|check in|supportive|gentle answer|gentle response)\b/i.test(text)) {
    return RESPONSE_MODES.SUPPORTIVE_CHECK_IN;
  }
  if (/\b(uncertain|not sure|unsure|maybe wrong|sanity check|double-check)\b/i.test(text)) {
    return RESPONSE_MODES.CAREFUL_UNCERTAINTY;
  }
  if (/\b(plan|roadmap|slice|implementation|implement|patch|fix|commit|helper|test|repo|module|code)\b/i.test(text)) {
    return RESPONSE_MODES.TECHNICAL_ROADMAP;
  }
  if (desiredDepth === DESIRED_DEPTHS.CONCISE) return RESPONSE_MODES.CONCISE_ANSWER;
  return RESPONSE_MODES.UNKNOWN;
}

function inferEnergy(text = '') {
  if (/\b(urgent|asap|immediately|right now)\b/i.test(text)) {
    return { label: 'urgent', confidence: 'medium', evidence: ['urgency wording'] };
  }
  if (/\b(i'?m excited|excited|love this|heaven|hell yes|let'?s go)\b/i.test(text) || /!!/.test(text)) {
    return { label: 'excited', confidence: 'low', evidence: ['enthusiastic wording'] };
  }
  if (/\b(frustrated|annoyed|ugh|broken again|keeps failing)\b/i.test(text)) {
    return { label: 'frustrated', confidence: 'low', evidence: ['frustration wording'] };
  }
  if (/\b(lol|haha|lmao)\b/i.test(text)) {
    return { label: 'playful', confidence: 'low', evidence: ['playful marker'] };
  }
  if (/\b(slice|commit|tests?|implementation|patch|helper)\b/i.test(text)) {
    return { label: 'focused', confidence: 'low', evidence: ['task-focused wording'] };
  }
  return { label: 'unknown', confidence: 'unknown', evidence: [] };
}

function inferActiveProjectThread(text = '', context = {}) {
  const contextThread = cleanString(context.activeProjectThread || context.projectThread || context.thread || '', 180);
  if (contextThread) return contextThread;
  if (/\bephemeral turn-state\b|\bturn-state card\b/i.test(text)) return 'ephemeral turn-state card';
  if (/\bbounded aliveness\b|\btier ?1 aliveness\b/i.test(text)) return 'bounded aliveness Tier 1';
  if (/\bopen-loop tracker\b|\bopen loops?\b/i.test(text)) return 'open-loop tracker';
  if (/\bbounded initiative\b|\binitiative policy\b/i.test(text)) return 'bounded initiative policy';
  if (/\bstatic memory reflex\b|\bstatic embeddings?\b/i.test(text)) return 'live static memory reflex';
  return '';
}

function inferExplicitInstructions(text = '') {
  const instructionPattern = /\b(please|must|do not|don't|dont|never|only|keep|avoid|when done|when you are done|read|start with|commit|one slice at a time|no proactive|don't be proactive|do not be proactive)\b/i;
  return normalizeExplicitInstructions(splitInstructionFragments(text).filter((fragment) => instructionPattern.test(fragment)));
}

function inferActiveConstraints(text = '', explicitInstructions = []) {
  const constraintPattern = /\b(do not|don't|dont|never|only|keep|avoid|no proactive|don't be proactive|do not be proactive)\b/i;
  return normalizeConstraints(explicitInstructions
    .filter((instruction) => constraintPattern.test(instruction))
    .map((instruction) => `user instruction: ${instruction}`));
}

function inferRiskFlags(text = '', sourceCheckNeeded = false) {
  const flags = [];
  if (sourceCheckNeeded) flags.push('source-check-needed');
  if (matchesAny(text, HIGH_STAKES_PATTERNS)) flags.push('high-stakes-domain');
  if (/\b(don't be proactive|do not be proactive|no proactive|stop suggesting|just answer)\b/i.test(text)) {
    flags.push('user-proactive-opt-out');
  }
  if (/\b(remember this|save this to memory|write memory|store this)\b/i.test(text)) {
    flags.push('memory-write-sensitive');
  }
  if (/\b(send|email|tweet|post|publish|delete|remove|reset --hard|rm -rf)\b/i.test(text)) {
    flags.push('external-or-destructive-action-risk');
  }
  if (/\b(quick patch|quick fix|keep it small|small local|narrow slice)\b/i.test(text)) {
    flags.push('quick-patch-scope');
  }
  return normalizeSignalFlags(flags);
}

function inferSuggestedResponseShape(responseMode, desiredDepth, riskFlags = []) {
  if (responseMode === RESPONSE_MODES.SOURCE_BACKED_REVIEW) {
    return 'source-aware review with uncertainty kept explicit';
  }
  if (responseMode === RESPONSE_MODES.CODE_REVIEW) return 'findings-first code review';
  if (responseMode === RESPONSE_MODES.AGENT_PROMPT) return 'ready-to-paste agent prompt';
  if (responseMode === RESPONSE_MODES.BRAINSTORM) return 'bounded brainstorm with clear next slice';
  if (responseMode === RESPONSE_MODES.SUPPORTIVE_CHECK_IN) return 'warm supportive check-in';
  if (responseMode === RESPONSE_MODES.CAREFUL_UNCERTAINTY) return 'careful answer with assumptions named';
  if (riskFlags.includes('quick-patch-scope')) return 'concise code patch with focused verification';
  if (responseMode === RESPONSE_MODES.TECHNICAL_ROADMAP && desiredDepth === DESIRED_DEPTHS.CONCISE) {
    return 'concise implementation path';
  }
  if (responseMode === RESPONSE_MODES.TECHNICAL_ROADMAP) return 'implementation-focused technical roadmap';
  if (desiredDepth === DESIRED_DEPTHS.CONCISE) return 'concise answer';
  return '';
}

function arrayFromContext(context = {}, ...keys) {
  for (const key of keys) {
    if (Array.isArray(context[key])) return context[key];
    if (context[key]) return [context[key]];
  }
  return [];
}

function extractTurnStateSignals(input = {}) {
  const rawInput = isPlainObject(input) ? input : { userText: input };
  const context = isPlainObject(rawInput.context) ? rawInput.context : {};
  const text = userTextFromSignalInput(rawInput);
  const explicitInstructions = inferExplicitInstructions(text);
  const desiredDepth = inferDesiredDepth(text);
  const sourceCheckNeeded = inferSourceCheckNeeded(text);
  const responseMode = inferResponseMode(text, desiredDepth, sourceCheckNeeded);
  const riskFlags = inferRiskFlags(text, sourceCheckNeeded);
  const inferred = {
    userIntent: inferUserIntent(text),
    desiredDepth,
    responseMode,
    energy: inferEnergy(text),
    activeProjectThread: inferActiveProjectThread(text, context),
    explicitInstructions,
    activeConstraints: [
      ...arrayFromContext(rawInput, 'activeConstraints', 'constraints'),
      ...arrayFromContext(context, 'activeConstraints', 'constraints'),
      ...inferActiveConstraints(text, explicitInstructions),
    ],
    riskFlags: [
      ...arrayFromContext(rawInput, 'riskFlags', 'risks'),
      ...arrayFromContext(context, 'riskFlags', 'risks'),
      ...riskFlags,
    ],
    sourceCheckNeeded,
    sourcePosture: sourceCheckNeeded ? 'source-check-needed' : '',
    openLoopsTouched: [
      ...arrayFromContext(rawInput, 'openLoopsTouched', 'openLoops', 'openLoopIds'),
      ...arrayFromContext(context, 'openLoopsTouched', 'openLoops', 'openLoopIds'),
    ],
    suggestedResponseShape: inferSuggestedResponseShape(responseMode, desiredDepth, riskFlags),
  };

  const explicitState = isPlainObject(rawInput.turnState)
    ? rawInput.turnState
    : (isPlainObject(rawInput.state) ? rawInput.state : {});

  return normalizeTurnState({
    ...inferred,
    ...explicitState,
    activeConstraints: [
      ...inferred.activeConstraints,
      ...normalizeConstraints(explicitState.activeConstraints || explicitState.constraints || []),
    ],
    explicitInstructions: [
      ...inferred.explicitInstructions,
      ...normalizeExplicitInstructions(
        explicitState.explicitInstructions || explicitState.instructions || explicitState.userInstructions || [],
      ),
    ],
    riskFlags: [
      ...inferred.riskFlags,
      ...normalizeSignalFlags(explicitState.riskFlags || explicitState.risks || explicitState.risk || []),
    ],
    openLoopsTouched: [
      ...inferred.openLoopsTouched,
      ...normalizeOpenLoopsTouched(
        explicitState.openLoopsTouched || explicitState.openLoopIds || explicitState.openLoops || [],
      ),
    ],
    sourceCheckNeeded: explicitState.sourceCheckNeeded ?? inferred.sourceCheckNeeded,
    sourcePosture: explicitState.sourcePosture || inferred.sourcePosture,
  });
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
    explicitInstructionCount: state.explicitInstructions.length,
    activeConstraintCount: state.activeConstraints.length,
    riskFlagCount: state.riskFlags.length,
    sourceCheckNeeded: state.sourceCheckNeeded,
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
  extractTurnStateSignals,
  normalizeTurnState,
  summarizeTurnState,
};
