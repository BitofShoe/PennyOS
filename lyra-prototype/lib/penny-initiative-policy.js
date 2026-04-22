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

function baseDecision({ reason = 'no initiative candidate', heldBack = [], riskClass = null } = {}) {
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
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack,
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
    return {
      allowed: false,
      reason: 'memory initiative requires explicit approval before saving',
      heldBack: buildHeldBack('memory-write-needs-approval', heldBackBase),
    };
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

  return {
    initiativeType,
    suggestionText,
    confidence,
    riskClass,
    reason: cleanString(raw.reason || raw.surfaceReason || 'current project has one high-confidence next step', 220),
    source: cleanString(raw.source || raw.sourceLabel || raw.path || raw.url || '', 220),
    id: cleanString(raw.id || raw.openLoopId || '', 120),
    requiresUserApproval: raw.requiresUserApproval !== false,
    autoWrite: raw.autoWrite === true || raw.saveMemory === true || raw.memoryWrite === true,
    userRequestedDomain: raw.userRequestedDomain === true || raw.directlyRequestedDomain === true,
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
    });
  }

  if (recentInitiativeStillApplies(candidate, recentInitiatives)) {
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
    forbiddenActions: FORBIDDEN_ACTIONS.slice(),
    heldBack: [],
  };
}

module.exports = {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_RISK_CLASSES,
  INITIATIVE_TYPES,
  decideInitiative,
};
