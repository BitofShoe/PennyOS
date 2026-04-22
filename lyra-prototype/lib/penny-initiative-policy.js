const INITIATIVE_DECISION_SCHEMA = 'penny-initiative-decision.v1';

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

const FORBIDDEN_ACTIONS = Object.freeze([
  'take-action',
  'save-memory',
  'claim-unchecked-source',
]);

const INITIATIVE_TYPE_VALUES = new Set(Object.values(INITIATIVE_TYPES));
const CONFIDENCE_VALUES = new Set(Object.values(INITIATIVE_CONFIDENCE));

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

const INITIATIVE_STOP_PATTERNS = [
  /\b(?:stop|quit|disable|pause|suppress)\b.{0,60}\b(?:suggest|suggesting|suggestion|initiative|proactive|nudge|nudges|remind|reminders|next steps?)\b/i,
  /\b(?:do not|don't|dont|no more)\b.{0,60}\b(?:suggest|suggesting|suggestion|initiative|proactive|nudge|nudges|remind|reminders|next steps?)\b/i,
  /\bturn\s+off\b.{0,60}\b(?:suggest|suggesting|suggestion|initiative|proactive|nudge|nudges|remind|reminders|next steps?)\b/i,
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

function normalizeConfidence(value = '', fallback = INITIATIVE_CONFIDENCE.UNKNOWN) {
  const confidence = cleanToken(value);
  if (confidence === 'certain') return INITIATIVE_CONFIDENCE.HIGH;
  if (confidence === 'normal') return INITIATIVE_CONFIDENCE.MEDIUM;
  if (confidence === 'none' || confidence === 'unclear') return INITIATIVE_CONFIDENCE.UNKNOWN;
  return CONFIDENCE_VALUES.has(confidence) ? confidence : fallback;
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

function hasInitiativeOptOutText(userText = '') {
  return INITIATIVE_STOP_PATTERNS.some((pattern) => pattern.test(userText));
}

function preferencesDisableInitiative(userPreferences = {}) {
  if (!isPlainObject(userPreferences)) return false;
  const explicitEnabled = normalizeBoolean(
    userPreferences.initiativeEnabled
      ?? userPreferences.allowInitiative
      ?? userPreferences.boundedInitiative
      ?? userPreferences.proactiveSuggestions
      ?? userPreferences.suggestions,
  );
  return explicitEnabled === false
    || userPreferences.disableInitiative === true
    || userPreferences.stopSuggesting === true
    || userPreferences.stopSuggestions === true;
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
    const riskClass = cleanToken(riskContext.riskClass || riskContext.level || riskContext.sensitivity || '');
    if (['sensitive', 'high', 'blocked'].includes(riskClass)) return true;
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

function buildHeldBack(reason, extras = {}) {
  return {
    reason: cleanToken(reason) || 'held-back',
    ...extras,
  };
}

function baseDecision({ reason = 'no initiative candidate', heldBack = [] } = {}) {
  return {
    schema: INITIATIVE_DECISION_SCHEMA,
    initiativeAllowed: false,
    initiativeType: INITIATIVE_TYPES.NONE,
    reason: cleanString(reason, 220),
    confidence: INITIATIVE_CONFIDENCE.UNKNOWN,
    maxSuggestions: 0,
    requiresUserApproval: true,
    suggestionText: '',
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack,
  };
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

  return {
    initiativeType: normalizeInitiativeType(
      raw.initiativeType || raw.type || raw.kind || '',
      INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
    ),
    suggestionText,
    confidence,
    reason: cleanString(raw.reason || raw.surfaceReason || 'current project has one high-confidence next step', 220),
    source: cleanString(raw.source || raw.sourceLabel || raw.path || raw.url || '', 220),
    id: cleanString(raw.id || raw.openLoopId || '', 120),
  };
}

function findInitiativeCandidate({
  turnState = {},
  relevantOpenLoops = [],
  retrievalSignals = [],
} = {}) {
  if (isPlainObject(turnState)) {
    const turnCandidate = normalizeCandidate({
      ...turnState,
      suggestionText: turnState.initiativeSuggestion || turnState.nextStepSuggestion || turnState.nextStep,
      confidence: turnState.initiativeConfidence || turnState.confidence,
    });
    if (turnCandidate) return turnCandidate;
  }

  for (const loop of rawOpenLoopList(relevantOpenLoops)) {
    const candidate = normalizeCandidate({
      ...loop,
      initiativeType: loop.initiativeType || INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      reason: loop.reason || 'current project has one high-confidence next step',
    });
    if (candidate) return candidate;
  }

  for (const signal of rawRetrievalSignalList(retrievalSignals)) {
    const candidate = normalizeCandidate(signal);
    if (candidate) return candidate;
  }

  return null;
}

function recentInitiativeStillApplies(candidate = {}, recent = []) {
  const candidateType = normalizeInitiativeType(candidate.initiativeType, INITIATIVE_TYPES.NONE);
  const candidateText = cleanString(candidate.suggestionText || '', 260).toLowerCase();
  for (const item of listValue(recent)) {
    if (!isPlainObject(item)) continue;
    const turnsAgo = Number(item.turnsAgo ?? item.ageTurns ?? item.turnOffset);
    const hasTurnDistance = Number.isFinite(turnsAgo);
    const isRecent = hasTurnDistance ? turnsAgo <= 3 : true;
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
  toolState = null,
  userPreferences = {},
  recentInitiatives = [],
  riskContext = null,
} = {}) {
  const cleanUserText = cleanString(userText, 2000);
  void toolState;

  if (preferencesDisableInitiative(userPreferences) || hasInitiativeOptOutText(cleanUserText)) {
    return baseDecision({
      reason: 'initiative disabled by user preference',
      heldBack: [buildHeldBack('user-opt-out', { initiativeType: INITIATIVE_TYPES.NONE })],
    });
  }

  if (isDirectCommand({ userText: cleanUserText, turnState })) {
    return baseDecision({
      reason: 'direct command should not get extra initiative',
      heldBack: [buildHeldBack('direct-command', { initiativeType: INITIATIVE_TYPES.NONE })],
    });
  }

  if (isSensitiveTopic({ userText: cleanUserText, turnState, riskContext })) {
    return baseDecision({
      reason: 'sensitive topic requires explicit user direction',
      heldBack: [buildHeldBack('sensitive-topic', { initiativeType: INITIATIVE_TYPES.NONE })],
    });
  }

  const candidate = findInitiativeCandidate({ turnState, relevantOpenLoops, retrievalSignals });
  if (!candidate) {
    return baseDecision({
      reason: 'no high-confidence initiative candidate',
      heldBack: [],
    });
  }

  if (recentInitiativeStillApplies(candidate, recentInitiatives)) {
    return baseDecision({
      reason: 'recent initiative cooldown suppresses repeated suggestion',
      heldBack: [
        buildHeldBack('recent-initiative-cooldown', {
          initiativeType: candidate.initiativeType,
          suggestionText: candidate.suggestionText,
        }),
      ],
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
    maxSuggestions: 1,
    requiresUserApproval: true,
    suggestionText: candidate.suggestionText,
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack: [],
  };
}

module.exports = {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_TYPES,
  decideInitiative,
};
