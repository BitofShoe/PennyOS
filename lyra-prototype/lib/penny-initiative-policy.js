const INITIATIVE_DECISION_SCHEMA = 'penny-initiative-decision.v1';
const INITIATIVE_PROMPT_SCAFFOLD_SCHEMA = 'penny-initiative-prompt-scaffold.v1';
const INITIATIVE_PROMPT_BRIDGE_SCHEMA = 'penny-initiative-prompt-bridge.v1';
const INITIATIVE_USER_CONTROLS_SCHEMA = 'penny-initiative-user-controls.v1';
const INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA = 'penny-memory-suggestion-review-gate.v1';

const INITIATIVE_TYPES = Object.freeze({
  NONE: 'none',
  CLARIFYING_QUESTION: 'clarifying-question',
  TINY_WARNING: 'tiny-warning',
  NEXT_STEP_SUGGESTION: 'next-step-suggestion',
  OPEN_LOOP_REMINDER: 'open-loop-reminder',
  MEMORY_SUGGESTION: 'memory-suggestion',
  SOURCE_CHECK_SUGGESTION: 'source-check-suggestion',
  CELEBRATORY_REFLECTION: 'celebratory-reflection',
});

const INITIATIVE_CONFIDENCE = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  UNKNOWN: 'unknown',
});

const INITIATIVE_RISK_CLASSES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  BLOCKED: 'blocked',
});

const FORBIDDEN_ACTIONS = Object.freeze([
  'take-action',
  'save-memory',
  'claim-unchecked-source',
]);

const INITIATIVE_TYPE_VALUES = new Set(Object.values(INITIATIVE_TYPES));
const CONFIDENCE_VALUES = new Set(Object.values(INITIATIVE_CONFIDENCE));
const RISK_CLASS_VALUES = new Set(Object.values(INITIATIVE_RISK_CLASSES));

const DIRECT_COMMAND_INTENTS = new Set([
  'direct-command',
  'direct_action',
  'execute',
  'implementation',
  'implement',
  'edit',
  'write',
  'commit',
  'test',
  'run-tests',
]);

const BRAINSTORM_TOKENS = new Set([
  'brainstorm',
  'brainstorming',
  'ideation',
  'explore',
  'exploratory',
]);

const EXACT_REVIEW_TOKENS = new Set([
  'exact-review',
  'source-backed-review',
  'code-review',
  'review',
  'audit',
]);

const URGENCY_TOKENS = new Set([
  'urgent',
  'urgency',
  'rushed',
  'rush',
  'time-pressure',
  'high-pressure',
  'deadline',
]);

const REVIEW_ELIGIBLE_MEMORY_SUPPORT_CLASSES = new Set([
  'explicit-user-statement',
  'explicit-user-preference',
  'repeated-explicit-user-preference',
  'promotion-review-candidate',
  'archive-review-candidate',
  'archive-pattern-review',
]);

const BLOCKED_MEMORY_SUPPORT_CLASSES = new Set([
  'candidate-only',
  'weak-evidence',
  'unverified',
  'inferred',
  'private-inference',
  'sensitive-inference',
]);

const INITIATIVE_GLOBAL_OPT_OUT_PATTERNS = [
  /\b(?:stop|quit|disable|pause|suppress)\b.{0,60}\b(?:suggest|suggesting|suggestions|initiative|proactive|nudge|nudges|next steps?)\b/i,
  /\b(?:do not|don't|dont|no more)\b.{0,60}\b(?:suggest|suggesting|suggestions|initiative|proactive|nudge|nudges|next steps?)\b/i,
  /\bturn\s+off\b.{0,60}\b(?:suggest|suggesting|suggestions|initiative|proactive|nudge|nudges|reminders|next steps?)\b/i,
  /\b(?:stop|disable|pause|no more)\b.{0,60}\b(?:all\s+)?(?:reminders|proactive reminders)\b/i,
];

const INITIATIVE_OPT_IN_PATTERNS = [
  /\b(?:you can|feel free to|it's okay to|it is okay to|okay to|go ahead and)\b.{0,80}\b(?:be proactive|take initiative|suggest|suggestions?|nudge|nudges|remind|reminders|next steps?)\b/i,
  /\b(?:be proactive|take initiative|suggest next steps?|nudge me|remind me)\b.{0,80}\b(?:here|on this|for this|when relevant|if relevant|in this thread)\b/i,
];

const INITIATIVE_THREAD_WATCH_PATTERNS = [
  /\bkeep\s+an\s+eye\s+on\b.{0,60}\b(?:this|the)\s+(?:thread|project|topic|loop|slice)\b/i,
  /\bfollow\b.{0,40}\b(?:this|the)\s+(?:thread|project|topic|loop|slice)\b/i,
];

const INITIATIVE_DISMISSAL_PATTERNS = [
  /\b(?:do not|don't|dont|stop)\b.{0,50}\bremind(?:ing)?\s+me\b.{0,60}\b(?:about|of)?\s*(?:that|this|it)\b/i,
  /\b(?:do not|don't|dont|stop)\b.{0,50}\b(?:bring|surface|mention|nudge)\b.{0,60}\b(?:that|this|it)\b/i,
  /\b(?:dismiss|drop|hide|park)\b.{0,50}\b(?:that|this|the)?\s*(?:reminder|open loop|loop|thread|topic|slice)\b/i,
];

const INITIATIVE_DURABLE_SCOPE_PATTERNS = [
  /\b(?:from now on|going forward|in general|always|by default)\b/i,
  /\bfor\s+(?:this|the)\s+(?:project|thread|topic|slice)\b/i,
];

const DIRECT_COMMAND_PATTERNS = [
  /^\s*(?:please\s+)?(?:do|make|implement|fix|change|update|edit|write|commit|push|run|test|review|read|search|start|stop|delete|create|add)\b/i,
  /\bwhen\s+(?:you(?:'re| are)?|ur)?\s*done\b/i,
];

const SENSITIVE_TOPIC_PATTERNS = [
  /\b(?:kill myself|suicide|suicidal|self[-\s]?harm|want to die|hurt myself)\b/i,
  /\b(?:password|api key|secret key|ssn|social security|bank account|credit card)\b/i,
  /\b(?:medical diagnosis|diagnose me|medication dosage|legal advice|lawsuit|tax fraud)\b/i,
  /\b(?:stalk|blackmail|doxx|doxxing|abuse evidence)\b/i,
];

const SENSITIVE_MEMORY_PATTERNS = [
  /\b(?:password|api key|secret key|ssn|social security|bank account|credit card)\b/i,
  /\b(?:medical diagnosis|diagnose me|medication dosage|medication|therapy|therapist|self[-\s]?harm|suicid(?:e|al))\b/i,
  /\b(?:legal advice|lawsuit|tax fraud|bankruptcy|debt|financial hardship)\b/i,
  /\b(?:private inference|personal inference|infer(?:red)? their|infer(?:red)? your)\b/i,
];

const HIGH_RISK_DOMAIN_PATTERNS = [
  /\b(?:edit|change|update|write|delete|remove|overwrite|commit|push|merge|rename)\b.{0,80}\b(?:file|files|repo|branch|code|doc|docs|document|config)\b/i,
  /\b(?:file edit|file write|write file|delete file|commit|push|git)\b/i,
  /\b(?:email|e-mail|send message|dm|text them|reply to|post this|tweet)\b/i,
  /\b(?:calendar|schedule|meeting invite|appointment|reminder alarm)\b/i,
  /\b(?:diagnose|medical|legal|tax|financial)\b/i,
  /\b(?:private inference|personal inference|infer their)\b/i,
];

const SIDE_EFFECT_DONE_PATTERNS = [
  /\b(?:i|penny|she|we)\s+(?:already\s+)?(?:edited|changed|updated|wrote|deleted|removed|sent|emailed|scheduled|committed|pushed|posted|saved|remembered)\b/i,
  /\b(?:has been|have been|is now|are now)\s+(?:edited|changed|updated|written|deleted|removed|sent|emailed|scheduled|committed|pushed|posted|saved|remembered)\b/i,
];

const UNAPPROVED_MEMORY_WRITE_PATTERNS = [
  /\b(?:i(?:'ll| will)|i am going to|i'm going to|let me|penny will|she will)\s+(?:remember|save|store|record)\b/i,
  /\b(?:saved|stored|recorded|remembered)\s+(?:that|this)\s+(?:for|in)\s+(?:memory|later)\b/i,
];

const EXACT_REVIEW_PATTERNS = [
  /\bexact\s+review\b/i,
  /\bsource[-\s]?backed\s+review\b/i,
  /\bcareful\s+review\b/i,
  /\bstrict\s+review\b/i,
];

const URGENCY_PATTERNS = [
  /\burgent(?:ly)?\b/i,
  /\btime[-\s]?pressure\b/i,
  /\bunder\s+pressure\b/i,
  /\bdeadline\b/i,
];

const CONFIRMATION_PRESSURE_PATTERNS = [
  /\bjust\s+confirm\b/i,
  /\bjust\s+say\s+(?:yes|it'?s\s+fine|it's\s+fine|that\s+is\s+fine)\b/i,
  /\bdo\s+not\s+(?:explain|add|suggest|caveat|hedge)\b/i,
  /\bdon't\s+(?:explain|add|suggest|caveat|hedge)\b/i,
  /\bno\s+(?:extra\s+)?(?:suggestions?|nudges?|next\s+steps?|caveats?|hedging)\b/i,
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

function cleanPromptFragment(value = '', limit = 180) {
  return cleanString(value, limit)
    .replace(/[.!?]+$/g, '')
    .replace(/[.!?]\s+/g, '; ');
}

function countWords(value = '') {
  const text = cleanString(value, 2000);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function cleanToken(value = '') {
  return cleanString(value, 120).toLowerCase().replace(/[_\s]+/g, '-');
}

function normalizeConfidence(value = '', fallback = INITIATIVE_CONFIDENCE.UNKNOWN) {
  const confidence = cleanToken(value);
  if (confidence === 'certain') return INITIATIVE_CONFIDENCE.HIGH;
  if (confidence === 'normal') return INITIATIVE_CONFIDENCE.MEDIUM;
  if (confidence === 'none' || confidence === 'unclear') return INITIATIVE_CONFIDENCE.UNKNOWN;
  return CONFIDENCE_VALUES.has(confidence) ? confidence : fallback;
}

function normalizeRiskClass(value = '', fallback = null) {
  const riskClass = cleanToken(value);
  const aliases = {
    none: INITIATIVE_RISK_CLASSES.LOW,
    safe: INITIATIVE_RISK_CLASSES.LOW,
    advisory: INITIATIVE_RISK_CLASSES.LOW,
    normal: INITIATIVE_RISK_CLASSES.MEDIUM,
    sensitive: INITIATIVE_RISK_CLASSES.HIGH,
    danger: INITIATIVE_RISK_CLASSES.HIGH,
    forbidden: INITIATIVE_RISK_CLASSES.BLOCKED,
    disallowed: INITIATIVE_RISK_CLASSES.BLOCKED,
  };
  const normalized = aliases[riskClass] || riskClass;
  return RISK_CLASS_VALUES.has(normalized) ? normalized : fallback;
}

function riskRank(riskClass = '') {
  switch (normalizeRiskClass(riskClass, null)) {
    case INITIATIVE_RISK_CLASSES.BLOCKED:
      return 4;
    case INITIATIVE_RISK_CLASSES.HIGH:
      return 3;
    case INITIATIVE_RISK_CLASSES.MEDIUM:
      return 2;
    case INITIATIVE_RISK_CLASSES.LOW:
      return 1;
    default:
      return 0;
  }
}

function strongestRiskClass(...values) {
  let strongest = null;
  for (const value of values) {
    const riskClass = normalizeRiskClass(value, null);
    if (!riskClass) continue;
    if (!strongest || riskRank(riskClass) > riskRank(strongest)) {
      strongest = riskClass;
    }
  }
  return strongest;
}

function normalizeInitiativeType(value = '', fallback = INITIATIVE_TYPES.NONE) {
  const type = cleanToken(value);
  const aliases = {
    clarify: INITIATIVE_TYPES.CLARIFYING_QUESTION,
    warning: INITIATIVE_TYPES.TINY_WARNING,
    next: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
    'next-step': INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
    reminder: INITIATIVE_TYPES.OPEN_LOOP_REMINDER,
    memory: INITIATIVE_TYPES.MEMORY_SUGGESTION,
    'source-check': INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION,
    celebration: INITIATIVE_TYPES.CELEBRATORY_REFLECTION,
  };
  const normalized = aliases[type] || type;
  return INITIATIVE_TYPE_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  const token = cleanToken(value);
  if (['true', 'yes', 'on', 'enabled'].includes(token)) return true;
  if (['false', 'no', 'off', 'disabled'].includes(token)) return false;
  return null;
}

function clampInteger(value, fallback = 1, min = 0, max = 20) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeIso(value = '') {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : '';
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function hasGlobalInitiativeOptOutText(userText = '') {
  return INITIATIVE_GLOBAL_OPT_OUT_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasInitiativeOptInText(userText = '') {
  return INITIATIVE_OPT_IN_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasThreadWatchText(userText = '') {
  return INITIATIVE_THREAD_WATCH_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasReminderDismissalText(userText = '') {
  return INITIATIVE_DISMISSAL_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasDurableScopeText(userText = '') {
  return INITIATIVE_DURABLE_SCOPE_PATTERNS.some((pattern) => pattern.test(userText));
}

function initiativePreferenceSetting(userPreferences = {}) {
  if (!isPlainObject(userPreferences)) {
    return { value: null, source: '' };
  }
  const explicitEnabled = normalizeBoolean(
    userPreferences.initiativeEnabled
      ?? userPreferences.allowInitiative
      ?? userPreferences.boundedInitiative
      ?? userPreferences.proactiveSuggestions
      ?? userPreferences.suggestions,
  );
  if (explicitEnabled !== null) {
    return { value: explicitEnabled, source: 'user-preferences' };
  }
  if (
    userPreferences.disableInitiative === true
    || userPreferences.stopSuggesting === true
    || userPreferences.stopSuggestions === true
  ) {
    return { value: false, source: 'user-preferences' };
  }
  if (
    userPreferences.enableInitiative === true
    || userPreferences.allowProactive === true
    || userPreferences.proactiveHere === true
  ) {
    return { value: true, source: 'user-preferences' };
  }
  return { value: null, source: '' };
}

function isDirectCommand({ userText = '', turnState = {} } = {}) {
  if (isPlainObject(turnState)) {
    if (turnState.directCommand === true || turnState.directAction === true) return true;
    const intent = cleanToken(turnState.userIntent || turnState.intent || turnState.commandIntent || '');
    if (DIRECT_COMMAND_INTENTS.has(intent)) return true;
  }
  return DIRECT_COMMAND_PATTERNS.some((pattern) => pattern.test(userText));
}

function isSensitiveTopic({ userText = '', turnState = {}, riskContext = null } = {}) {
  if (isPlainObject(riskContext)) {
    const sensitivity = cleanToken(riskContext.sensitivity || riskContext.safetyClass || '');
    if (['sensitive', 'high', 'blocked'].includes(sensitivity)) return true;
    if (riskContext.sensitive === true || riskContext.privateInference === true) return true;
  }
  if (isPlainObject(turnState)) {
    const sensitivity = cleanToken(turnState.sensitivity || turnState.sensitiveTopic || '');
    if (['sensitive', 'high', 'blocked'].includes(sensitivity)) return true;
  }
  return SENSITIVE_TOPIC_PATTERNS.some((pattern) => pattern.test(userText));
}

function listValue(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function rawOpenLoopList(value = []) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  if (isPlainObject(value.selected)) return [value.selected];
  if (Array.isArray(value.selected)) return value.selected;
  if (Array.isArray(value.loops)) return value.loops;
  if (Array.isArray(value.openLoops)) return value.openLoops;
  if (Array.isArray(value.items)) return value.items;
  return [];
}

function rawRetrievalSignalList(value = []) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return [];
  if (Array.isArray(value.signals)) return value.signals;
  if (Array.isArray(value.candidates)) return value.candidates;
  if (Array.isArray(value.items)) return value.items;
  return [];
}

function rawStaticMemoryCandidateList(value = null) {
  if (!isPlainObject(value)) return [];
  const candidates = [];
  if (isPlainObject(value.topCandidate)) candidates.push(value.topCandidate);
  if (isPlainObject(value.topStaticCandidate)) candidates.push(value.topStaticCandidate);
  if (Array.isArray(value.topCandidates)) candidates.push(...value.topCandidates);
  if (Array.isArray(value.candidates)) candidates.push(...value.candidates);
  if (Array.isArray(value.selected)) candidates.push(...value.selected);
  return candidates;
}

function normalizeControlPhrase(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueControlIds(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const id = cleanString(value, 140);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function controlLoopId(raw = {}) {
  if (!isPlainObject(raw)) return '';
  return cleanString(raw.id || raw.openLoopId || raw.loopId || raw.candidateId || '', 140);
}

function controlLoopTitle(raw = {}) {
  if (!isPlainObject(raw)) return '';
  return cleanString(raw.title || raw.summary || raw.label || '', 220);
}

function userTextMentionsControlLoop(userText = '', rawLoop = {}) {
  const text = normalizeControlPhrase(userText);
  if (!text || !isPlainObject(rawLoop)) return false;
  const phrases = [
    controlLoopId(rawLoop),
    controlLoopId(rawLoop).replace(/[-_]+/g, ' '),
    controlLoopTitle(rawLoop),
  ]
    .map(normalizeControlPhrase)
    .filter((phrase) => phrase && phrase.length >= 3);
  return phrases.some((phrase) => ` ${text} `.includes(` ${phrase} `));
}

function inferControlLoopTargets({
  userText = '',
  relevantOpenLoops = [],
  dismissalRequested = false,
} = {}) {
  const loops = rawOpenLoopList(relevantOpenLoops)
    .filter(isPlainObject)
    .filter((loop) => controlLoopId(loop));
  if (!loops.length) return [];
  const explicitTargets = loops
    .filter((loop) => userTextMentionsControlLoop(userText, loop))
    .map(controlLoopId);
  if (explicitTargets.length) return uniqueControlIds(explicitTargets);
  if (dismissalRequested
    && loops.length === 1
    && /\b(?:that|this|it)\b/i.test(userText)) {
    return [controlLoopId(loops[0])];
  }
  return [];
}

function extractInitiativeUserControls({
  userText = '',
  userPreferences = {},
  relevantOpenLoops = [],
} = {}) {
  const cleanUserText = cleanString(userText, 2000);
  const dismissalRequested = hasReminderDismissalText(cleanUserText);
  const threadWatchRequested = hasThreadWatchText(cleanUserText);
  const optOutRequested = hasGlobalInitiativeOptOutText(cleanUserText) && !dismissalRequested;
  const optInRequested = hasInitiativeOptInText(cleanUserText) || threadWatchRequested;
  const durableScopeRequested = hasDurableScopeText(cleanUserText);
  const preference = initiativePreferenceSetting(userPreferences);
  const dismissedOpenLoopIds = inferControlLoopTargets({
    userText: cleanUserText,
    relevantOpenLoops,
    dismissalRequested,
  });
  const reasons = [];
  let initiativePreference = 'unchanged';
  let preferenceScope = 'none';
  let source = 'none';
  let allowInitiativeThisTurn = false;
  let durablePreferenceRequested = false;

  if (preference.value === false) {
    initiativePreference = 'disabled';
    preferenceScope = 'stored';
    source = preference.source || 'user-preferences';
    durablePreferenceRequested = true;
    reasons.push('stored-opt-out');
  } else if (preference.value === true) {
    initiativePreference = 'enabled';
    preferenceScope = 'stored';
    source = preference.source || 'user-preferences';
    reasons.push('stored-opt-in');
  }

  if (optOutRequested) {
    initiativePreference = 'disabled';
    preferenceScope = durableScopeRequested ? 'global' : 'session';
    source = 'user-text';
    durablePreferenceRequested = durableScopeRequested;
    allowInitiativeThisTurn = false;
    reasons.push('explicit-opt-out');
  } else if (optInRequested) {
    initiativePreference = 'enabled';
    preferenceScope = threadWatchRequested
      ? 'thread'
      : (durableScopeRequested ? 'global' : 'current-turn');
    source = 'user-text';
    durablePreferenceRequested = durableScopeRequested || threadWatchRequested;
    allowInitiativeThisTurn = true;
    reasons.push(threadWatchRequested ? 'thread-watch-consent' : 'explicit-opt-in');
  }

  if (dismissalRequested) reasons.push('dismissal-request');

  return {
    schema: INITIATIVE_USER_CONTROLS_SCHEMA,
    initiativePreference,
    preferenceScope,
    source,
    explicitUserControl: optOutRequested || optInRequested || dismissalRequested,
    allowInitiativeThisTurn,
    durablePreferenceRequested,
    dismissalRequested,
    dismissedOpenLoopIds,
    threadWatchRequested,
    keepEyeOnThread: threadWatchRequested,
    reasons,
    memoryWrites: false,
    autonomousActions: false,
  };
}

function tokenMatchesAny(value = '', matches = new Set()) {
  const token = cleanToken(value);
  if (!token) return false;
  if (matches.has(token)) return true;
  const parts = new Set(token.split('-').filter(Boolean));
  return [...matches].some((match) => parts.has(match));
}

function turnStateEnergyLabel(turnState = {}) {
  if (!isPlainObject(turnState)) return '';
  const energy = turnState.energy;
  if (isPlainObject(energy)) {
    return cleanToken(energy.label || energy.mode || energy.state || '');
  }
  return cleanToken(energy || turnState.energyLabel || '');
}

function objectHasAnyFlag(raw = {}, names = []) {
  if (!isPlainObject(raw)) return false;
  if (hasAnyFlag(raw, names)) return true;
  return [
    raw.sourceState,
    raw.sourceFlags,
    raw.trustState,
    raw.trustFlags,
    raw.source,
    raw.trust,
  ].some((nested) => isPlainObject(nested) && hasAnyFlag(nested, names));
}

function objectStringValue(raw = {}, names = []) {
  if (!isPlainObject(raw)) return '';
  for (const name of names) {
    const value = cleanString(raw[name] || '', 260);
    if (value) return value;
  }
  for (const nested of [
    raw.sourceState,
    raw.sourceFlags,
    raw.trustState,
    raw.trustFlags,
    raw.source,
    raw.trust,
  ]) {
    if (!isPlainObject(nested)) continue;
    for (const name of names) {
      const value = cleanString(nested[name] || '', 260);
      if (value) return value;
    }
  }
  return '';
}

function isBrainstormMode({ userText = '', turnState = {} } = {}) {
  if (isPlainObject(turnState)) {
    const responseMode = turnState.responseMode || turnState.mode || turnState.suggestedResponseMode || '';
    const userIntent = turnState.userIntent || turnState.intent || '';
    if (tokenMatchesAny(responseMode, BRAINSTORM_TOKENS)
      || tokenMatchesAny(userIntent, BRAINSTORM_TOKENS)) {
      return true;
    }
  }
  return /\bbrainstorm(?:ing)?\b/i.test(userText);
}

function isExactReviewMode({ userText = '', turnState = {} } = {}) {
  if (isPlainObject(turnState)) {
    const responseMode = turnState.responseMode || turnState.mode || turnState.suggestedResponseMode || '';
    const userIntent = turnState.userIntent || turnState.intent || '';
    if (tokenMatchesAny(responseMode, EXACT_REVIEW_TOKENS)
      || tokenMatchesAny(userIntent, EXACT_REVIEW_TOKENS)) {
      return true;
    }
  }
  return EXACT_REVIEW_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasUrgencyPressure({
  userText = '',
  turnState = {},
  riskContext = null,
  toolState = null,
} = {}) {
  if (objectHasAnyFlag(turnState, ['urgencyPressure', 'underUrgencyPressure', 'timePressure'])) return true;
  if (objectHasAnyFlag(riskContext, ['urgencyPressure', 'underUrgencyPressure', 'timePressure'])) return true;
  if (objectHasAnyFlag(toolState, ['urgencyPressure', 'underUrgencyPressure', 'timePressure'])) return true;
  if (tokenMatchesAny(turnStateEnergyLabel(turnState), URGENCY_TOKENS)) return true;
  return URGENCY_PATTERNS.some((pattern) => pattern.test(userText));
}

function hasConfirmationPressure({
  userText = '',
  turnState = {},
  riskContext = null,
  toolState = null,
} = {}) {
  const names = [
    'confirmationPressure',
    'justConfirmPressure',
    'sourceFreeConfirmationPressure',
  ];
  if (objectHasAnyFlag(turnState, names)) return true;
  if (objectHasAnyFlag(riskContext, names)) return true;
  if (objectHasAnyFlag(toolState, names)) return true;
  return CONFIRMATION_PRESSURE_PATTERNS.some((pattern) => pattern.test(userText));
}

function sourceCheckNeeded({
  turnState = {},
  riskContext = null,
  toolState = null,
  sourceTrustFlags = null,
} = {}) {
  const names = [
    'sourceCheckNeeded',
    'needsSourceCheck',
    'sourceUnverified',
    'unverifiedSource',
    'candidateOnlySupport',
    'weakEvidence',
    'needsVerification',
  ];
  return objectHasAnyFlag(turnState, names)
    || objectHasAnyFlag(riskContext, names)
    || objectHasAnyFlag(toolState, names)
    || objectHasAnyFlag(sourceTrustFlags, names);
}

function sourceCheckSuggestionText({
  turnState = {},
  riskContext = null,
  toolState = null,
  sourceTrustFlags = null,
  staticMemoryReflex = null,
} = {}) {
  const names = [
    'sourceCheckSuggestion',
    'verificationSuggestion',
    'warningText',
    'suggestionText',
  ];
  return objectStringValue(turnState, names)
    || objectStringValue(riskContext, names)
    || objectStringValue(toolState, names)
    || objectStringValue(sourceTrustFlags, names)
    || objectStringValue(staticMemoryReflex, names)
    || 'Do one quick source check before treating this as settled.';
}

function collectTurnSignals({
  userText = '',
  turnState = {},
  riskContext = null,
  toolState = null,
  sourceTrustFlags = null,
} = {}) {
  return {
    brainstormMode: isBrainstormMode({ userText, turnState }),
    exactReviewMode: isExactReviewMode({ userText, turnState }),
    urgencyPressure: hasUrgencyPressure({ userText, turnState, riskContext, toolState }),
    confirmationPressure: hasConfirmationPressure({ userText, turnState, riskContext, toolState }),
    sourceCheckNeeded: sourceCheckNeeded({ turnState, riskContext, toolState, sourceTrustFlags }),
  };
}

function buildHeldBack(reason, extras = {}) {
  return {
    reason: cleanToken(reason) || 'held-back',
    ...extras,
  };
}

function baseDecision({
  reason = 'no initiative candidate',
  heldBack = [],
  riskClass = null,
  userControls = null,
} = {}) {
  return {
    schema: INITIATIVE_DECISION_SCHEMA,
    initiativeAllowed: false,
    initiativeType: INITIATIVE_TYPES.NONE,
    reason: cleanString(reason, 220),
    confidence: INITIATIVE_CONFIDENCE.UNKNOWN,
    riskClass,
    maxSuggestions: 0,
    requiresUserApproval: true,
    autoWrite: false,
    actionPermission: 'not-allowed',
    suggestionText: '',
    source: '',
    candidateId: '',
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack,
    ...(userControls ? { userControls } : {}),
  };
}

function hasAnyFlag(raw = {}, names = []) {
  return names.some((name) => raw[name] === true);
}

function looksLikeHighRiskDomain(text = '') {
  return HIGH_RISK_DOMAIN_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeSideEffectDone(text = '') {
  return SIDE_EFFECT_DONE_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeUnapprovedMemoryWrite(text = '') {
  return UNAPPROVED_MEMORY_WRITE_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeMemorySupportClass(value = '', supportText = '') {
  const token = cleanToken(value);
  const aliases = {
    explicit: 'explicit-user-statement',
    'user-explicit': 'explicit-user-statement',
    'user-stated': 'explicit-user-statement',
    'user-statement': 'explicit-user-statement',
    preference: 'explicit-user-preference',
    'explicit-preference': 'explicit-user-preference',
    'user-preference': 'explicit-user-preference',
    'user-stated-preference': 'explicit-user-preference',
    'repeated-preference': 'repeated-explicit-user-preference',
    'repeated-explicit': 'repeated-explicit-user-preference',
    pattern: 'archive-pattern-review',
    'archive-pattern': 'archive-pattern-review',
    promotion: 'promotion-review-candidate',
    'promotion-review': 'promotion-review-candidate',
    'review-candidate': 'promotion-review-candidate',
    'archive-review': 'archive-review-candidate',
    inferred: 'inferred',
    inference: 'inferred',
    guess: 'inferred',
    guessed: 'inferred',
    'candidate-only': 'candidate-only',
    candidate: 'candidate-only',
    weak: 'weak-evidence',
    weakly: 'weak-evidence',
    unverified: 'unverified',
  };
  const normalized = aliases[token] || token;
  if (REVIEW_ELIGIBLE_MEMORY_SUPPORT_CLASSES.has(normalized)
    || BLOCKED_MEMORY_SUPPORT_CLASSES.has(normalized)) {
    return normalized;
  }

  const support = cleanString(supportText, 400).toLowerCase();
  if (!support) return '';
  if (/\b(?:infer|inferred|guess|guessed|assume|assumed|seems like|probably)\b/.test(support)) {
    return 'inferred';
  }
  if (/\b(?:candidate-only|weak evidence|unverified)\b/.test(support)) {
    return support.includes('unverified') ? 'unverified' : 'candidate-only';
  }
  if (/\b(?:repeated|multiple|several)\b/.test(support)
    && /\b(?:explicit|user said|user stated|preference|prefers?)\b/.test(support)) {
    return 'repeated-explicit-user-preference';
  }
  if (/\b(?:explicit user|user said|user stated|user told|the user said)\b/.test(support)
    && /\b(?:preference|prefers?|likes?|wants?)\b/.test(support)) {
    return 'explicit-user-preference';
  }
  if (/\b(?:explicit user|user said|user stated|user told|the user said)\b/.test(support)) {
    return 'explicit-user-statement';
  }
  if (/\b(?:promotion review|review candidate|queued for review|promotion queue)\b/.test(support)) {
    return 'promotion-review-candidate';
  }
  return '';
}

function inferMemorySupportClass(raw = {}, supportText = '') {
  if (!isPlainObject(raw)) return normalizeMemorySupportClass('', supportText);
  if (raw.repeatedExplicitUserPreference === true || raw.repeatedUserPreference === true) {
    return 'repeated-explicit-user-preference';
  }
  if (raw.explicitUserPreference === true || raw.userStatedPreference === true) {
    return 'explicit-user-preference';
  }
  if (raw.explicitUserStatement === true || raw.userStated === true) {
    return 'explicit-user-statement';
  }
  return normalizeMemorySupportClass(
    raw.supportClass
      || raw.supportType
      || raw.supportKind
      || raw.memorySupportClass
      || raw.memorySupportType
      || raw.evidenceClass
      || raw.evidenceType
      || raw.sourceType
      || raw.promotionPacket?.sourceType
      || '',
    supportText,
  );
}

function inferMemorySensitivity({ raw = {}, suggestionText = '', support = '' } = {}) {
  if (isPlainObject(raw)) {
    const explicit = cleanToken(raw.memorySensitivity || raw.sensitivity || raw.sensitivityClass || raw.safetyClass || '');
    if (['sensitive', 'high', 'private', 'secret', 'medical', 'legal', 'financial', 'safety'].includes(explicit)) {
      return 'sensitive';
    }
    if (raw.sensitiveMemory === true || raw.sensitive === true || raw.privateMemory === true) {
      return 'sensitive';
    }
  }
  const text = `${suggestionText || ''}\n${support || ''}`;
  return SENSITIVE_MEMORY_PATTERNS.some((pattern) => pattern.test(text)) ? 'sensitive' : 'low';
}

function inferMemorySuggestionIsInferred({
  raw = {},
  suggestionText = '',
  support = '',
  supportClass = '',
} = {}) {
  if (isPlainObject(raw)
    && (raw.inferredMemory === true
      || raw.inferred === true
      || raw.privateInference === true
      || raw.personalInference === true
      || raw.generatedInference === true)) {
    return true;
  }
  if (['inferred', 'private-inference', 'sensitive-inference'].includes(supportClass)) {
    return true;
  }
  return /\b(?:infer|inferred|guess|guessed|assume|assumed|seems like|probably)\b/i.test(`${support || ''}\n${suggestionText || ''}`);
}

function buildMemorySuggestionReviewGate(candidate = {}, {
  decision = 'held-back',
  reason = '',
} = {}) {
  return {
    schema: INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA,
    reviewRequired: true,
    reviewStatus: decision === 'eligible-for-user-review' ? 'pending-user-approval' : 'held-back',
    decision,
    reason: cleanToken(reason) || 'review-gated-memory-suggestion',
    requiresUserApproval: true,
    autoWrite: false,
    autoPromote: false,
    canonicalWriteAllowed: false,
    promotionQueueWriteAllowed: false,
    support: cleanString(candidate.support || '', 220),
    supportClass: cleanString(candidate.supportClass || '', 80),
    memorySensitivity: cleanString(candidate.memorySensitivity || 'unknown', 80),
    inferredMemory: candidate.inferredMemory === true,
    source: cleanString(candidate.source || '', 220),
    candidateId: cleanString(candidate.id || '', 120),
  };
}

function evaluateMemorySuggestionReview(candidate = {}) {
  if (candidate.initiativeType !== INITIATIVE_TYPES.MEMORY_SUGGESTION) {
    return { allowed: true };
  }
  if (candidate.memorySensitivity === 'sensitive') {
    const memoryReviewGate = buildMemorySuggestionReviewGate(candidate, {
      decision: 'held-back',
      reason: 'sensitive-memory-suggestion',
    });
    candidate.memoryReviewGate = memoryReviewGate;
    return {
      allowed: false,
      reason: 'sensitive memory suggestions are blocked',
      heldBack: buildHeldBack('sensitive-memory-suggestion', {
        initiativeType: candidate.initiativeType,
        suggestionText: candidate.suggestionText,
        riskClass: candidate.riskClass,
        support: candidate.support,
        supportClass: candidate.supportClass,
        memorySensitivity: candidate.memorySensitivity,
        memoryReviewGate,
      }),
    };
  }
  if (candidate.inferredMemory === true) {
    const memoryReviewGate = buildMemorySuggestionReviewGate(candidate, {
      decision: 'held-back',
      reason: 'inferred-memory-suggestion',
    });
    candidate.memoryReviewGate = memoryReviewGate;
    return {
      allowed: false,
      reason: 'inferred memory suggestions are blocked',
      heldBack: buildHeldBack('inferred-memory-suggestion', {
        initiativeType: candidate.initiativeType,
        suggestionText: candidate.suggestionText,
        riskClass: candidate.riskClass,
        support: candidate.support,
        supportClass: candidate.supportClass,
        memorySensitivity: candidate.memorySensitivity,
        memoryReviewGate,
      }),
    };
  }
  if (!REVIEW_ELIGIBLE_MEMORY_SUPPORT_CLASSES.has(candidate.supportClass)) {
    const reason = BLOCKED_MEMORY_SUPPORT_CLASSES.has(candidate.supportClass)
      ? 'weak-memory-support'
      : 'memory-suggestion-lacks-review-support';
    const memoryReviewGate = buildMemorySuggestionReviewGate(candidate, {
      decision: 'held-back',
      reason,
    });
    candidate.memoryReviewGate = memoryReviewGate;
    return {
      allowed: false,
      reason: 'memory suggestion requires explicit review support',
      heldBack: buildHeldBack(reason, {
        initiativeType: candidate.initiativeType,
        suggestionText: candidate.suggestionText,
        riskClass: candidate.riskClass,
        support: candidate.support,
        supportClass: candidate.supportClass,
        memorySensitivity: candidate.memorySensitivity,
        memoryReviewGate,
      }),
    };
  }
  candidate.memoryReviewGate = buildMemorySuggestionReviewGate(candidate, {
    decision: 'eligible-for-user-review',
    reason: 'review-gated-memory-suggestion',
  });
  return { allowed: true, memoryReviewGate: candidate.memoryReviewGate };
}

function inferRiskClass({ raw = {}, initiativeType = INITIATIVE_TYPES.NONE, suggestionText = '' } = {}) {
  const explicitRisk = normalizeRiskClass(
    raw.riskClass
      || raw.risk
      || raw.permissionRisk
      || raw.permissionClass
      || raw.initiativeRisk
      || '',
    null,
  );
  if (explicitRisk) return explicitRisk;

  const rawKind = cleanToken(raw.kind || raw.type || raw.intent || raw.action || '');
  if (
    hasAnyFlag(raw, [
      'blocked',
      'secretMonitoring',
      'unsupportedSourceClaim',
      'unsupportedSourceClaims',
      'pressureDrivenAgreement',
      'claimsUncheckedSource',
    ])
  ) {
    return INITIATIVE_RISK_CLASSES.BLOCKED;
  }

  if (initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    || initiativeType === INITIATIVE_TYPES.OPEN_LOOP_REMINDER
    || rawKind === 'plan-branch'
    || rawKind === 'branch'
  ) {
    return INITIATIVE_RISK_CLASSES.MEDIUM;
  }

  if (
    hasAnyFlag(raw, [
      'sideEffect',
      'fileEdit',
      'emailAction',
      'calendarAction',
      'personalInference',
      'privateInference',
    ])
    || looksLikeSideEffectDone(suggestionText)
    || looksLikeHighRiskDomain(suggestionText)
  ) {
    return INITIATIVE_RISK_CLASSES.HIGH;
  }

  return INITIATIVE_RISK_CLASSES.LOW;
}

function userDirectlyRequestedRiskDomain({
  userText = '',
  turnState = {},
  riskContext = null,
  candidate = {},
} = {}) {
  if (candidate.userRequestedDomain === true || candidate.directlyRequestedDomain === true) return true;
  if (isPlainObject(riskContext)) {
    if (riskContext.userRequestedDomain === true || riskContext.directlyRequestedDomain === true) return true;
    const requested = cleanToken(riskContext.requestedRiskDomain || riskContext.requestedDomain || '');
    if (requested && requested !== 'none') return true;
  }
  if (isPlainObject(turnState)) {
    if (turnState.userRequestedRiskDomain === true || turnState.userRequestedDomain === true) return true;
    const requestedDomains = listValue(turnState.requestedDomains || turnState.domains || []);
    if (requestedDomains.some((value) => cleanToken(value))) return true;
  }
  return looksLikeHighRiskDomain(userText);
}

function evaluateCandidateRisk({
  candidate = {},
  userText = '',
  turnState = {},
  riskContext = null,
} = {}) {
  const contextRiskClass = isPlainObject(riskContext)
    ? strongestRiskClass(
      riskContext.riskClass,
      riskContext.risk,
      riskContext.permissionRisk,
      riskContext.permissionClass,
      riskContext.initiativeRisk,
    )
    : null;
  const turnRiskClass = isPlainObject(turnState)
    ? strongestRiskClass(
      turnState.riskClass,
      turnState.risk,
      turnState.permissionRisk,
      turnState.permissionClass,
      turnState.initiativeRisk,
    )
    : null;
  const riskClass = strongestRiskClass(candidate.riskClass, contextRiskClass, turnRiskClass)
    || INITIATIVE_RISK_CLASSES.LOW;
  candidate.riskClass = riskClass;

  if (
    (isPlainObject(riskContext)
      && hasAnyFlag(riskContext, [
        'blocked',
        'secretMonitoring',
        'unsupportedSourceClaim',
        'unsupportedSourceClaims',
        'pressureDrivenAgreement',
        'claimsUncheckedSource',
      ]))
    || (isPlainObject(turnState)
      && hasAnyFlag(turnState, [
        'blocked',
        'secretMonitoring',
        'unsupportedSourceClaim',
        'unsupportedSourceClaims',
        'pressureDrivenAgreement',
        'claimsUncheckedSource',
      ]))
  ) {
    candidate.riskClass = INITIATIVE_RISK_CLASSES.BLOCKED;
  }

  const heldBackBase = {
    initiativeType: candidate.initiativeType,
    suggestionText: candidate.suggestionText,
    riskClass: candidate.riskClass,
  };

  if (candidate.riskClass === INITIATIVE_RISK_CLASSES.BLOCKED) {
    return {
      allowed: false,
      reason: 'blocked initiative risk never surfaces',
      heldBack: buildHeldBack('blocked-risk', heldBackBase),
    };
  }

  if (looksLikeSideEffectDone(candidate.suggestionText)) {
    return {
      allowed: false,
      reason: 'initiative cannot claim side-effect actions as completed',
      heldBack: buildHeldBack('side-effect-completion-claim', heldBackBase),
    };
  }

  if (
    candidate.initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    && (candidate.autoWrite === true
      || candidate.requiresUserApproval === false
      || looksLikeUnapprovedMemoryWrite(candidate.suggestionText))
  ) {
    const memoryReviewGate = buildMemorySuggestionReviewGate(candidate, {
      decision: 'held-back',
      reason: 'memory-write-needs-approval',
    });
    candidate.memoryReviewGate = memoryReviewGate;
    return {
      allowed: false,
      reason: 'memory initiative requires explicit approval before saving',
      heldBack: buildHeldBack('memory-write-needs-approval', {
        ...heldBackBase,
        support: candidate.support || '',
        supportClass: candidate.supportClass || '',
        memorySensitivity: candidate.memorySensitivity || '',
        memoryReviewGate,
      }),
    };
  }

  const memoryReviewDecision = evaluateMemorySuggestionReview(candidate);
  if (!memoryReviewDecision.allowed) {
    return memoryReviewDecision;
  }

  if (
    candidate.riskClass === INITIATIVE_RISK_CLASSES.HIGH
    && !userDirectlyRequestedRiskDomain({ userText, turnState, riskContext, candidate })
  ) {
    return {
      allowed: false,
      reason: 'high-risk initiative requires direct user request for that domain',
      heldBack: buildHeldBack('high-risk-not-requested', heldBackBase),
    };
  }

  return { allowed: true, riskClass: candidate.riskClass };
}

function normalizeCandidate(raw = {}) {
  if (!isPlainObject(raw)) return null;
  const suggestionText = cleanString(
    raw.suggestionText
      || raw.suggestion
      || raw.nextLikelyStep
      || raw.nextStep
      || raw.text
      || raw.summary
      || '',
    260,
  );
  if (!suggestionText) return null;

  const confidence = normalizeConfidence(
    raw.confidence
      || raw.supportConfidence
      || raw.selectionConfidence
      || raw.relevanceConfidence
      || '',
    INITIATIVE_CONFIDENCE.UNKNOWN,
  );
  const explicitHighConfidence = raw.highConfidence === true
    || confidence === INITIATIVE_CONFIDENCE.HIGH;
  if (!explicitHighConfidence) return null;

  const initiativeType = normalizeInitiativeType(
    raw.initiativeType || raw.type || raw.kind || '',
    INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
  );
  const riskClass = inferRiskClass({ raw, initiativeType, suggestionText });
  const support = initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    ? cleanString(
        raw.support
          || raw.supportBasis
          || raw.evidenceSupport
          || raw.memorySupport
          || raw.reviewSupport
          || raw.reviewBasis
          || raw.promotionPacket?.evidenceSnippet
          || raw.evidenceSnippet
          || '',
        220,
      )
    : '';
  const supportClass = initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    ? inferMemorySupportClass(raw, support)
    : '';
  const memorySensitivity = initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    ? inferMemorySensitivity({ raw, suggestionText, support })
    : '';
  const inferredMemory = initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
    ? inferMemorySuggestionIsInferred({ raw, suggestionText, support, supportClass })
    : false;

  return {
    initiativeType,
    suggestionText,
    confidence,
    riskClass,
    reason: cleanString(raw.reason || raw.surfaceReason || 'current project has one high-confidence next step', 220),
    source: cleanString(
      raw.source
        || raw.sourceLabel
        || raw.path
        || raw.url
        || raw.promotionPacket?.originSource
        || raw.sourceType
        || '',
      220,
    ),
    id: cleanString(raw.id || raw.openLoopId || raw.queueId || raw.promotionPacket?.id || '', 120),
    requiresUserApproval: raw.requiresUserApproval !== false,
    autoWrite: raw.autoWrite === true || raw.saveMemory === true || raw.memoryWrite === true,
    userRequestedDomain: raw.userRequestedDomain === true || raw.directlyRequestedDomain === true,
    support,
    supportClass,
    memorySensitivity,
    inferredMemory,
    reviewStatus: cleanString(raw.reviewStatus || raw.promotionPacket?.reviewStatus || '', 80),
  };
}

function buildSourceCheckCandidate({
  turnState = {},
  riskContext = null,
  toolState = null,
  sourceTrustFlags = null,
  staticMemoryReflex = null,
  turnSignals = {},
} = {}) {
  if (!turnSignals.sourceCheckNeeded) return null;
  return {
    initiativeType: INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION,
    suggestionText: sourceCheckSuggestionText({
      turnState,
      riskContext,
      toolState,
      sourceTrustFlags,
      staticMemoryReflex,
    }),
    confidence: INITIATIVE_CONFIDENCE.HIGH,
    riskClass: INITIATIVE_RISK_CLASSES.LOW,
    reason: turnSignals.urgencyPressure
      ? 'urgency pressure needs a source-check warning'
      : 'source/trust flags indicate verification is needed',
    source: '',
    id: '',
    requiresUserApproval: true,
    autoWrite: false,
    userRequestedDomain: false,
  };
}

function normalizeStaticMemoryCandidate(raw = {}) {
  if (!isPlainObject(raw)) return null;
  const supportState = cleanToken(raw.supportState || raw.support || raw.truthState || '');
  const candidateOnly = raw.candidateOnlySupport === true
    || raw.unverifiedSource === true
    || ['candidate', 'candidate-only', 'unverified', 'weak-evidence'].includes(supportState);
  if (candidateOnly) {
    return normalizeCandidate({
      initiativeType: INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION,
      confidence: raw.confidence || raw.relevanceConfidence || INITIATIVE_CONFIDENCE.HIGH,
      suggestionText: raw.sourceCheckSuggestion
        || raw.verificationSuggestion
        || 'Verify the top static memory candidate before treating it as settled.',
      reason: raw.reason || 'static memory top candidate is candidate-only support',
      riskClass: INITIATIVE_RISK_CLASSES.LOW,
      source: raw.source || raw.sourceLabel || raw.path || '',
      id: raw.id || raw.candidateId || '',
    });
  }

  const explicitSuggestion = raw.initiativeSuggestion
    || raw.nextStepSuggestion
    || raw.sourceCheckSuggestion
    || raw.suggestionText
    || raw.suggestion
    || raw.nextLikelyStep
    || raw.nextStep
    || '';
  if (!explicitSuggestion) return null;
  return normalizeCandidate({
    ...raw,
    suggestionText: explicitSuggestion,
    reason: raw.reason || 'static memory top candidate supplied an explicit initiative cue',
  });
}

function findInitiativeCandidate({
  turnState = {},
  relevantOpenLoops = [],
  retrievalSignals = [],
  staticMemoryReflex = null,
  sourceTrustFlags = null,
  riskContext = null,
  toolState = null,
  turnSignals = {},
} = {}) {
  const sourceCheckCandidate = buildSourceCheckCandidate({
    turnState,
    riskContext,
    toolState,
    sourceTrustFlags,
    staticMemoryReflex,
    turnSignals,
  });
  if (sourceCheckCandidate) return sourceCheckCandidate;

  if (isPlainObject(turnState)) {
    const turnCandidate = normalizeCandidate({
      ...turnState,
      suggestionText: turnState.initiativeSuggestion || turnState.nextStepSuggestion || turnState.nextStep,
      confidence: turnState.initiativeConfidence || turnState.confidence,
    });
    if (turnCandidate) return turnCandidate;
  }

  for (const loop of rawOpenLoopList(relevantOpenLoops)) {
    if (!isPlainObject(loop)) continue;
    const surfaceReason = cleanString(loop.surfaceReason || loop.reason || '', 220);
    const centralLoop = loop.selected === true
      || loop.central === true
      || /\b(?:central|explicit-anchor|directly-relevant)\b/i.test(surfaceReason);
    const candidate = normalizeCandidate({
      ...loop,
      initiativeType: loop.initiativeType || INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      confidence: loop.confidence
        || loop.relevanceConfidence
        || (turnSignals.brainstormMode && centralLoop ? INITIATIVE_CONFIDENCE.HIGH : ''),
      reason: loop.reason
        || surfaceReason
        || (turnSignals.brainstormMode && centralLoop
          ? 'brainstorm turn has one central open loop'
          : 'current project has one high-confidence next step'),
    });
    if (candidate) return candidate;
  }

  for (const staticCandidate of rawStaticMemoryCandidateList(staticMemoryReflex)) {
    const candidate = normalizeStaticMemoryCandidate(staticCandidate);
    if (candidate) return candidate;
  }

  for (const signal of rawRetrievalSignalList(retrievalSignals)) {
    const candidate = normalizeCandidate(signal);
    if (candidate) return candidate;
  }

  return null;
}

function recentInitiativeStillApplies(candidate = {}, recent = [], cooldownTurns = 3) {
  const cooldownLimit = clampInteger(cooldownTurns, 3, 0, 20);
  if (cooldownLimit <= 0) return false;
  const candidateType = normalizeInitiativeType(candidate.initiativeType, INITIATIVE_TYPES.NONE);
  const candidateText = cleanString(candidate.suggestionText || '', 260).toLowerCase();
  for (const item of listValue(recent)) {
    if (!isPlainObject(item)) continue;
    const turnsAgo = Number(item.turnsAgo ?? item.ageTurns ?? item.turnOffset);
    const hasTurnDistance = Number.isFinite(turnsAgo);
    const isRecent = hasTurnDistance ? turnsAgo <= cooldownLimit : true;
    if (!isRecent) continue;

    const recentType = normalizeInitiativeType(item.initiativeType || item.type || '', INITIATIVE_TYPES.NONE);
    const recentText = cleanString(item.suggestionText || item.suggestion || item.text || '', 260).toLowerCase();
    if (recentType === candidateType) return true;
    if (recentText && candidateText && recentText === candidateText) return true;
  }
  return false;
}

function decideInitiative({
  userText = '',
  turnState = {},
  relevantOpenLoops = [],
  retrievalSignals = [],
  staticMemoryReflex = null,
  sourceTrustFlags = null,
  toolState = null,
  userPreferences = {},
  recentInitiatives = [],
  riskContext = null,
  cooldownTurns = 3,
} = {}) {
  const cleanUserText = cleanString(userText, 2000);
  const userControls = extractInitiativeUserControls({
    userText: cleanUserText,
    userPreferences,
    relevantOpenLoops,
  });
  const turnSignals = collectTurnSignals({
    userText: cleanUserText,
    turnState,
    riskContext,
    toolState,
    sourceTrustFlags,
  });

  if (userControls.initiativePreference === 'disabled') {
    return baseDecision({
      reason: 'initiative disabled by user preference',
      heldBack: [buildHeldBack('user-opt-out', { initiativeType: INITIATIVE_TYPES.NONE })],
      userControls,
    });
  }

  if (isSensitiveTopic({ userText: cleanUserText, turnState, riskContext })) {
    return baseDecision({
      reason: 'sensitive topic requires explicit user direction',
      heldBack: [buildHeldBack('sensitive-topic', { initiativeType: INITIATIVE_TYPES.NONE })],
      userControls,
    });
  }

  const directCommand = isDirectCommand({ userText: cleanUserText, turnState });
  const candidate = findInitiativeCandidate({
    turnState,
    relevantOpenLoops,
    retrievalSignals,
    staticMemoryReflex,
    sourceTrustFlags,
    riskContext,
    toolState,
    turnSignals,
  });

  if (userControls.dismissalRequested && userControls.allowInitiativeThisTurn !== true) {
    return baseDecision({
      reason: 'user dismissed reminder or open-loop initiative',
      riskClass: candidate?.riskClass || null,
      heldBack: [
        buildHeldBack('user-dismissed-reminder', {
          initiativeType: candidate?.initiativeType || INITIATIVE_TYPES.NONE,
          suggestionText: candidate?.suggestionText || '',
          candidateId: candidate?.id || '',
          dismissedOpenLoopIds: userControls.dismissedOpenLoopIds,
        }),
      ],
      userControls,
    });
  }

  if (
    turnSignals.confirmationPressure
    && candidate
    && candidate.initiativeType !== INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION
    && userControls.allowInitiativeThisTurn !== true
  ) {
    return baseDecision({
      reason: 'confirmation pressure suppresses source-free initiative',
      riskClass: candidate.riskClass,
      heldBack: [
        buildHeldBack('just-confirm-pressure', {
          initiativeType: candidate.initiativeType,
          suggestionText: candidate.suggestionText,
          riskClass: candidate.riskClass,
        }),
      ],
      userControls,
    });
  }

  if (
    turnSignals.exactReviewMode
    && candidate
    && candidate.initiativeType !== INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION
    && userControls.allowInitiativeThisTurn !== true
  ) {
    return baseDecision({
      reason: 'exact review suppresses extra initiative unless a source-check warning is needed',
      riskClass: candidate.riskClass,
      heldBack: [
        buildHeldBack('exact-review-mode', {
          initiativeType: candidate.initiativeType,
          suggestionText: candidate.suggestionText,
          riskClass: candidate.riskClass,
        }),
      ],
      userControls,
    });
  }

  if (
    directCommand
    && userControls.allowInitiativeThisTurn !== true
    && (!candidate
      || candidate.initiativeType !== INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION
      || (!turnSignals.exactReviewMode && !turnSignals.urgencyPressure))
  ) {
    return baseDecision({
      reason: 'direct command should not get extra initiative',
      heldBack: [buildHeldBack('direct-command', { initiativeType: INITIATIVE_TYPES.NONE })],
      userControls,
    });
  }

  if (!candidate) {
    return baseDecision({
      reason: 'no high-confidence initiative candidate',
      heldBack: [],
      userControls,
    });
  }

  const riskDecision = evaluateCandidateRisk({
    candidate,
    userText: cleanUserText,
    turnState,
    riskContext,
  });
  if (!riskDecision.allowed) {
    return baseDecision({
      reason: riskDecision.reason,
      riskClass: candidate.riskClass,
      heldBack: [riskDecision.heldBack],
      userControls,
    });
  }

  if (recentInitiativeStillApplies(candidate, recentInitiatives, cooldownTurns)) {
    return baseDecision({
      reason: 'recent initiative cooldown suppresses repeated suggestion',
      riskClass: candidate.riskClass,
      heldBack: [
        buildHeldBack('recent-initiative-cooldown', {
          initiativeType: candidate.initiativeType,
          suggestionText: candidate.suggestionText,
          riskClass: candidate.riskClass,
        }),
      ],
      userControls,
    });
  }

  return {
    schema: INITIATIVE_DECISION_SCHEMA,
    initiativeAllowed: true,
    initiativeType: candidate.initiativeType,
    reason: candidate.reason || 'current project has one high-confidence next step',
    confidence: candidate.confidence === INITIATIVE_CONFIDENCE.HIGH
      ? INITIATIVE_CONFIDENCE.HIGH
      : INITIATIVE_CONFIDENCE.MEDIUM,
    riskClass: candidate.riskClass,
    maxSuggestions: 1,
    requiresUserApproval: true,
    autoWrite: false,
    actionPermission: 'suggest-only-requires-explicit-user-approval',
    suggestionText: candidate.suggestionText,
    source: candidate.source || '',
    candidateId: candidate.id || '',
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack: [],
    userControls,
    ...(candidate.initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION
      ? {
          support: candidate.support || '',
          supportClass: candidate.supportClass || '',
          memoryReviewGate: candidate.memoryReviewGate || buildMemorySuggestionReviewGate(candidate, {
            decision: 'eligible-for-user-review',
            reason: 'review-gated-memory-suggestion',
          }),
        }
      : {}),
  };
}

function inferInitiativeTypeFromAssistantText(text = '') {
  const source = cleanString(text, 2000).toLowerCase();
  if (!source) return INITIATIVE_TYPES.NONE;
  if (/\b(?:tiny|small|optional|one)\b.{0,40}\b(?:next[-\s]?step|suggestion|nudge)\b/i.test(source)) {
    return INITIATIVE_TYPES.NEXT_STEP_SUGGESTION;
  }
  if (/\bsource[-\s]?check\b|\bverify\b.{0,40}\bbefore\b/i.test(source)) {
    return INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION;
  }
  if (/\bwant me to remember\b|\bshould i remember\b/i.test(source)) {
    return INITIATIVE_TYPES.MEMORY_SUGGESTION;
  }
  if (/\bopen loop\b|\bremind(?:er)?\b.{0,40}\b(?:thread|loop|next step)\b/i.test(source)) {
    return INITIATIVE_TYPES.OPEN_LOOP_REMINDER;
  }
  return INITIATIVE_TYPES.NONE;
}

function extractRecentInitiativesFromMessages(messages = [], { cooldownTurns = 3 } = {}) {
  const cooldownLimit = clampInteger(cooldownTurns, 3, 0, 20);
  if (cooldownLimit <= 0) return [];
  const out = [];
  let userTurnsSeen = 0;
  for (const msg of [...(Array.isArray(messages) ? messages : [])].reverse()) {
    const role = String(msg?.role || '').trim().toLowerCase();
    if (role === 'user') {
      userTurnsSeen += 1;
      if (userTurnsSeen > cooldownLimit) break;
      continue;
    }
    if (role !== 'assistant') continue;
    const initiativeType = inferInitiativeTypeFromAssistantText(msg?.content || msg?.text || '');
    if (initiativeType === INITIATIVE_TYPES.NONE) continue;
    out.push({
      initiativeType,
      suggestionText: cleanString(msg?.content || msg?.text || '', 260),
      turnsAgo: userTurnsSeen,
    });
  }
  return out;
}

function initiativeScaffoldLabel(initiativeType = INITIATIVE_TYPES.NONE) {
  switch (normalizeInitiativeType(initiativeType, INITIATIVE_TYPES.NONE)) {
    case INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION:
      return 'source-check suggestion';
    case INITIATIVE_TYPES.OPEN_LOOP_REMINDER:
      return 'open-loop reminder';
    case INITIATIVE_TYPES.MEMORY_SUGGESTION:
      return 'memory suggestion';
    case INITIATIVE_TYPES.TINY_WARNING:
      return 'tiny warning';
    case INITIATIVE_TYPES.CLARIFYING_QUESTION:
      return 'clarifying question';
    case INITIATIVE_TYPES.CELEBRATORY_REFLECTION:
      return 'celebratory reflection';
    case INITIATIVE_TYPES.NEXT_STEP_SUGGESTION:
    default:
      return 'next-step suggestion';
  }
}

function buildInitiativePromptScaffold({
  decision = null,
  maxSuggestionChars = 180,
  maxSourceChars = 120,
} = {}) {
  const base = {
    schema: INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
    rendered: false,
    renderedCount: 0,
    promptText: '',
    wordCount: 0,
    initiativeType: INITIATIVE_TYPES.NONE,
    sourceLabel: '',
    supportLabel: '',
    maxSuggestions: 0,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    memoryWriteAllowed: false,
    actionAllowed: false,
    heldBack: [],
  };

  if (!isPlainObject(decision)) {
    return {
      ...base,
      heldBack: [buildHeldBack('missing-decision', { initiativeType: INITIATIVE_TYPES.NONE })],
    };
  }

  const initiativeType = normalizeInitiativeType(decision.initiativeType, INITIATIVE_TYPES.NONE);
  if (decision.initiativeAllowed !== true) {
    return {
      ...base,
      initiativeType,
      heldBack: [
        buildHeldBack('initiative-not-allowed', {
          initiativeType,
          sourceReason: cleanString(decision.reason || '', 220),
        }),
      ],
    };
  }

  if (Number(decision.maxSuggestions || 0) < 1) {
    return {
      ...base,
      initiativeType,
      heldBack: [buildHeldBack('max-suggestions-zero', { initiativeType })],
    };
  }

  const suggestion = cleanPromptFragment(decision.suggestionText || '', maxSuggestionChars);
  if (!suggestion) {
    return {
      ...base,
      initiativeType,
      maxSuggestions: 1,
      heldBack: [buildHeldBack('missing-suggestion-text', { initiativeType })],
    };
  }

  const sourceLabel = cleanPromptFragment(
    decision.source
      || decision.supportRef
      || decision.sourceLabel
      || decision.sourcePath
      || '',
    maxSourceChars,
  );
  const supportLabel = cleanPromptFragment(
    decision.support
      || decision.memoryReviewGate?.support
      || decision.supportLabel
      || '',
    maxSourceChars,
  );
  const sourceClause = initiativeType === INITIATIVE_TYPES.MEMORY_SUGGESTION && supportLabel
    ? `supported by ${supportLabel}`
    : (sourceLabel
      ? `grounded in ${sourceLabel}`
      : 'without claiming extra source verification');
  const promptText = `Optional initiative, max one sentence: Suggest as an ignorable ${initiativeScaffoldLabel(initiativeType)}, ${sourceClause}: ${suggestion}; do not take action; do not save memory; make it easy to ignore.`;

  return {
    ...base,
    rendered: true,
    renderedCount: 1,
    promptText,
    wordCount: countWords(promptText),
    initiativeType,
    sourceLabel,
    supportLabel,
    maxSuggestions: 1,
    requiresUserApproval: decision.requiresUserApproval !== false,
    actionPermission: decision.actionPermission || 'suggest-only-requires-explicit-user-approval',
    ...(decision.memoryReviewGate ? { memoryReviewGate: decision.memoryReviewGate } : {}),
  };
}

function buildLiveInitiativePromptBridge({
  enabled = false,
  disabledReason = '',
  userText = '',
  turnState = {},
  relevantOpenLoops = [],
  retrievalSignals = [],
  staticMemoryReflex = null,
  sourceTrustFlags = null,
  toolState = null,
  userPreferences = {},
  recentInitiatives = [],
  riskContext = null,
  maxPerTurn = 1,
  cooldownTurns = 3,
  now = new Date(),
} = {}) {
  const maxSuggestions = clampInteger(maxPerTurn, 1, 0, 1);
  const cooldownLimit = clampInteger(cooldownTurns, 3, 0, 20);
  const liveEnabled = enabled === true && maxSuggestions > 0;
  const decision = liveEnabled
    ? decideInitiative({
        userText,
        turnState,
        relevantOpenLoops,
        retrievalSignals,
        staticMemoryReflex,
        sourceTrustFlags,
        toolState,
        userPreferences,
        recentInitiatives,
        riskContext,
        cooldownTurns: cooldownLimit,
      })
    : baseDecision({
        reason: disabledReason || (maxSuggestions <= 0 ? 'max-per-turn-0' : 'bounded initiative disabled'),
        heldBack: [buildHeldBack(maxSuggestions <= 0 ? 'max-per-turn-0' : (disabledReason || 'env-disabled'), {
          initiativeType: INITIATIVE_TYPES.NONE,
        })],
      });
  const scaffold = buildInitiativePromptScaffold({ decision });
  const rendered = liveEnabled && scaffold.rendered === true;
  const selected = rendered
    ? [{
        initiativeType: scaffold.initiativeType,
        suggestionText: cleanString(decision.suggestionText || '', 260),
        sourceLabel: scaffold.sourceLabel || '',
        support: cleanString(decision.support || '', 220),
        supportClass: cleanString(decision.supportClass || '', 80),
        memoryReviewGate: decision.memoryReviewGate || null,
        candidateId: cleanString(decision.candidateId || '', 120),
        riskClass: cleanString(decision.riskClass || '', 80),
        confidence: cleanString(decision.confidence || '', 80),
      }]
    : [];
  const heldBack = rendered
    ? []
    : (Array.isArray(scaffold.heldBack) && scaffold.heldBack.length
      ? scaffold.heldBack
      : (Array.isArray(decision.heldBack) ? decision.heldBack : []));

  return {
    schema: INITIATIVE_PROMPT_BRIDGE_SCHEMA,
    scaffoldSchema: INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
    generatedAt: normalizeIso(now) || new Date().toISOString(),
    enabled: liveEnabled,
    disabledReason: liveEnabled ? '' : cleanString(disabledReason || (maxSuggestions <= 0 ? 'max-per-turn-0' : 'env-disabled'), 160),
    livePromptBridge: rendered,
    liveChatTouched: rendered,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    memoryWriteAllowed: false,
    actionAllowed: false,
    maxPerTurn: maxSuggestions,
    cooldownTurns: cooldownLimit,
    decision,
    userControls: decision.userControls || null,
    scaffold: {
      ...scaffold,
      livePromptBridge: rendered,
      liveChatTouched: rendered,
    },
    selected,
    heldBack,
    promptBridge: {
      renderedCount: rendered ? 1 : 0,
      promptText: rendered ? scaffold.promptText : '',
      snippets: rendered
        ? [{
            initiativeType: scaffold.initiativeType,
            sourceLabel: scaffold.sourceLabel || '',
            supportLabel: scaffold.supportLabel || '',
            wordCount: scaffold.wordCount || 0,
            text: scaffold.promptText,
          }]
        : [],
    },
    limits: [
      'Bounded initiative is suggest-only and capped at one prompt snippet.',
      'This bridge does not take actions, write memory, or expand PromptTruth.',
      'Source-check suggestions must not claim verification that did not happen.',
    ],
  };
}

module.exports = {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA,
  INITIATIVE_PROMPT_BRIDGE_SCHEMA,
  INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
  INITIATIVE_RISK_CLASSES,
  INITIATIVE_TYPES,
  INITIATIVE_USER_CONTROLS_SCHEMA,
  buildLiveInitiativePromptBridge,
  buildInitiativePromptScaffold,
  decideInitiative,
  extractInitiativeUserControls,
  extractRecentInitiativesFromMessages,
};
