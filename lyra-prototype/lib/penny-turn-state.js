const TURN_STATE_SCHEMA = 'penny-turn-state.v1';
const TURN_STATE_PROMPT_BRIDGE_SCHEMA = 'penny-turn-state-prompt-bridge.v1';
const TURN_STATE_RETENTION_SCHEMA = 'penny-turn-state-retention.v1';

const MEASUREMENT_MODE = 'ephemeral';
const DEFAULT_TURN_STATE_PROMPT_MAX_WORDS = 90;

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

const CURRENT_LAW_CONSTRAINTS = Object.freeze({
  EXPLICIT_MEMORY_CANONICAL: 'Explicit memory is canonical; advisory recall must not be treated as stronger truth.',
  ADVISORY_CONTEXT: 'Archive, research-ledger, semantic, static, and open-loop signals are advisory context, not proof by confidence.',
  PROMPTTRUTH_UNCHANGED: 'PromptTruth stays limited to prompt-time rendered/candidate memory and research context; do not add new channels here.',
  TOOL_EVIDENCE_SIBLING: 'toolEvidenceReceipt stays a sibling runtime artifact; do not merge it into PromptTruth.',
  STATIC_CANDIDATE_ONLY: 'Static embeddings are candidate discovery only; candidate hits are not truth, memory writes, or prompt-limit permission.',
  OPEN_LOOPS_ADVISORY: 'Open loops are advisory, dismissible continuity; they are not explicit memory or autonomous task permission.',
  DETERMINISTIC_EXTRACTION_NO_AUTO_MEMORY: 'Deterministic extraction/source receipts do not create automatic memory writes or promotion.',
  TOOL_ACTION_RECEIPTS: 'Tool/action completion claims require successful deterministic in-turn receipts before being stated as done.',
});

const AUTHORITY_TOPIC_PATTERNS = Object.freeze({
  memory: [
    /\b(explicit memory|canonical memory|memory authority|remember|recall|archive memory|research ledger|semantic memory|memory writes?)\b/i,
  ],
  static: [
    /\b(static embeddings?|static memory reflex|static candidates?|PENNY_STATIC_EMBED_MODE|live-advisory|live-shadow)\b/i,
  ],
  promptTruth: [
    /\b(prompttruth|prompt truth|prompt[- ]?time|prompt bridge|rendered context|rendered memory|candidate context)\b/i,
  ],
  toolAction: [
    /\b(toolEvidenceReceipt|tool evidence|receipt|deterministic receipt|run tests?|npm test|commit|push|edit files?|write files?|delete files?|shell command|git|deploy|publish|post|tweet|email|action claim)\b/i,
  ],
  openLoop: [
    /\b(open[- ]loops?|open loop tracker|unresolved threads?|follow[- ]?ups?|continuity thread)\b/i,
  ],
  extraction: [
    /\b(deterministic extraction|extract(?:ion)?|ocr|pdf|document extraction|spreadsheet|table extraction|invoice|tax form|numeric fields?)\b/i,
  ],
});

const SENSITIVE_PROMPT_PATTERNS = [
  /\bchain[- ]?of[- ]?thought\b/i,
  /\bhidden (?:reasoning|thoughts?)\b/i,
  /\bprivate inference\b/i,
  /\bpsychological profile\b/i,
  /\binternal monologue\b/i,
  /\bscratchpad\b/i,
  /\bactivation(?:s)?\b/i,
  /\blatent state\b/i,
  /\bmental state diagnosis\b/i,
];

const TURN_STATE_PRIVATE_RETENTION_FIELDS = Object.freeze([
  'turnState',
  'state',
  'userIntent',
  'intent',
  'energy',
  'energy.evidence',
  'explicitInstructions',
  'instructions',
  'riskFlags',
  'warnings',
  'rejectedFields',
  'chainOfThought',
  'hiddenReasoning',
  'privateInference',
  'psychologicalProfile',
]);

const TURN_STATE_RETAINED_SUMMARY_FIELDS = Object.freeze([
  'schema',
  'measurementMode',
  'persist',
  'desiredDepth',
  'responseMode',
  'activeProjectThread',
  'explicitInstructionCount',
  'activeConstraintCount',
  'riskFlagCount',
  'sourceCheckNeeded',
  'openLoopsTouchedCount',
  'warningCount',
  'rejectedFieldCount',
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

function countWords(text = '') {
  return cleanString(text, 4000).split(/\s+/).filter(Boolean).length;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function truncateWords(text = '', maxWords = DEFAULT_TURN_STATE_PROMPT_MAX_WORDS) {
  const limit = clampInteger(maxWords, DEFAULT_TURN_STATE_PROMPT_MAX_WORDS, 20, 180);
  const words = cleanString(text, 4000).split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ')}...`;
}

function containsSensitivePromptInference(text = '') {
  return SENSITIVE_PROMPT_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function sanitizeTurnStatePromptTextForRetention(text = '') {
  const cleaned = cleanString(text, 700);
  if (!cleaned || containsSensitivePromptInference(cleaned)) return '';
  return cleaned;
}

function buildTurnStateRetentionPolicy({
  promptText = '',
  summary = null,
  omittedFields = [],
  promptTextRetained = null,
  promptTextRedacted = false,
} = {}) {
  const retainedPromptText = sanitizeTurnStatePromptTextForRetention(promptText);
  const hasSummary = isPlainObject(summary);
  const retainedFields = hasSummary ? Array.from(TURN_STATE_RETAINED_SUMMARY_FIELDS) : [];
  const normalizedOmitted = uniqueStrings([
    ...TURN_STATE_PRIVATE_RETENTION_FIELDS,
    ...(Array.isArray(omittedFields) ? omittedFields : [omittedFields]),
  ], 32, 100);

  return {
    schema: TURN_STATE_RETENTION_SCHEMA,
    persist: false,
    retentionMode: 'redacted-summary-only',
    fullStateStored: false,
    promptTextStored: promptTextRetained == null ? !!retainedPromptText : promptTextRetained === true,
    promptTextRedacted: promptTextRedacted === true || (!!cleanString(promptText, 700) && !retainedPromptText),
    summaryStored: hasSummary,
    retainedSummaryFields: retainedFields,
    omittedFields: normalizedOmitted,
    sensitiveFieldsOmitted: true,
    energyLabelsEphemeral: true,
  };
}

function safePromptValue(value = '', limit = 160) {
  const cleaned = cleanString(value, limit);
  if (!cleaned || containsSensitivePromptInference(cleaned)) return '';
  return cleaned;
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
  if (/\b(remember this|save this to memory|write memory|store this|update explicit memory|add .* to memory|save .* explicit memory)\b/i.test(text)) {
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

function authorityContextText(rawInput = {}, context = {}) {
  const values = [
    ...arrayFromContext(rawInput, 'authorityTopics', 'currentLawTopics', 'topics', 'subsystems'),
    ...arrayFromContext(context, 'authorityTopics', 'currentLawTopics', 'topics', 'subsystems'),
  ];
  return uniqueStrings(values.map((item) => {
    if (typeof item === 'string') return item;
    if (!isPlainObject(item)) return '';
    return item.id || item.key || item.label || item.title || item.name || item.type || '';
  }), 20, 120).join(' ');
}

function currentLawConstraint(text = '') {
  return {
    sourceLabel: 'current law',
    text,
  };
}

function inferCurrentLawConstraints(text = '', rawInput = {}, context = {}) {
  const authorityText = `${cleanString(text, 4000)} ${authorityContextText(rawInput, context)}`;
  const constraints = [];
  const add = (constraint) => {
    if (constraint) constraints.push(currentLawConstraint(constraint));
  };

  const memoryRelated = matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.memory);
  const staticRelated = matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.static);
  const openLoopRelated = matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.openLoop);

  if (memoryRelated) {
    add(CURRENT_LAW_CONSTRAINTS.EXPLICIT_MEMORY_CANONICAL);
    add(CURRENT_LAW_CONSTRAINTS.ADVISORY_CONTEXT);
  }
  if (staticRelated) {
    add(CURRENT_LAW_CONSTRAINTS.STATIC_CANDIDATE_ONLY);
    add(CURRENT_LAW_CONSTRAINTS.ADVISORY_CONTEXT);
  }
  if (openLoopRelated) {
    add(CURRENT_LAW_CONSTRAINTS.OPEN_LOOPS_ADVISORY);
    add(CURRENT_LAW_CONSTRAINTS.ADVISORY_CONTEXT);
  }
  if (matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.promptTruth)) {
    add(CURRENT_LAW_CONSTRAINTS.PROMPTTRUTH_UNCHANGED);
  }
  if (matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.toolAction)) {
    add(CURRENT_LAW_CONSTRAINTS.TOOL_ACTION_RECEIPTS);
    add(CURRENT_LAW_CONSTRAINTS.TOOL_EVIDENCE_SIBLING);
  }
  if (matchesAny(authorityText, AUTHORITY_TOPIC_PATTERNS.extraction)) {
    add(CURRENT_LAW_CONSTRAINTS.DETERMINISTIC_EXTRACTION_NO_AUTO_MEMORY);
  }

  return normalizeConstraints(constraints);
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
      ...inferCurrentLawConstraints(text, rawInput, context),
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

function humanizePromptToken(value = '') {
  return cleanToken(value).replace(/-/g, ' ');
}

function depthModePhrase(state = {}) {
  const desiredDepth = normalizeDesiredDepth(state.desiredDepth);
  const responseMode = normalizeResponseMode(state.responseMode);
  const parts = [];
  if (desiredDepth && desiredDepth !== DESIRED_DEPTHS.UNKNOWN) parts.push(humanizePromptToken(desiredDepth));
  if (responseMode && responseMode !== RESPONSE_MODES.UNKNOWN) parts.push(humanizePromptToken(responseMode));
  if (!parts.length) return 'use current-turn signals only';
  const phrase = parts.join(' ');
  const article = /^[aeiou]/i.test(phrase) ? 'an' : 'a';
  return `aim for ${article} ${phrase} response`;
}

function constraintPromptCues(constraints = []) {
  const joined = normalizeConstraints(constraints).join(' ');
  const cues = [];
  if (/explicit memory is canonical/i.test(joined)) cues.push('explicit memory stays canonical');
  if (/advisory context|signals are advisory|open loops are advisory|candidate discovery only/i.test(joined)) {
    cues.push('advisory signals stay advisory');
  }
  if (/PromptTruth/i.test(joined)) cues.push('PromptTruth unchanged');
  if (/toolEvidenceReceipt/i.test(joined)) cues.push('toolEvidenceReceipt sibling');
  if (/completion claims require|successful deterministic in-turn receipts/i.test(joined)) {
    cues.push('tool/action claims need receipts');
  }
  if (/runtime voice/i.test(joined)) cues.push('runtime voice unchanged');
  if (!cues.length && joined) cues.push('current-turn constraints in force');
  return uniqueStrings(cues, 6, 80);
}

function summarizeTurnStateForPrompt(stateLike = {}, renderedProjectThread = '') {
  const summary = summarizeTurnState(stateLike);
  return {
    schema: summary.schema,
    measurementMode: summary.measurementMode,
    persist: summary.persist,
    desiredDepth: summary.desiredDepth,
    responseMode: summary.responseMode,
    activeProjectThread: safePromptValue(renderedProjectThread || '', 120),
    explicitInstructionCount: summary.explicitInstructionCount,
    activeConstraintCount: summary.activeConstraintCount,
    riskFlagCount: summary.riskFlagCount,
    sourceCheckNeeded: summary.sourceCheckNeeded,
    openLoopsTouchedCount: summary.openLoopsTouchedCount,
    warningCount: summary.warningCount,
    rejectedFieldCount: summary.rejectedFieldCount,
  };
}

function renderTurnStatePromptSnippet(stateLike = {}, {
  maxWords = DEFAULT_TURN_STATE_PROMPT_MAX_WORDS,
  measurementMode = 'fixture-only',
  livePromptBridge = false,
  liveChatTouched = false,
} = {}) {
  const state = normalizeTurnState(stateLike);
  const renderedFields = ['measurementMode', 'persist'];
  const parts = [
    `Turn state, ephemeral (persist=${state.persist}): ${depthModePhrase(state)}.`,
  ];

  const activeProjectThread = safePromptValue(state.activeProjectThread, 120);
  if (activeProjectThread) {
    parts.push(`Active project thread: ${activeProjectThread}.`);
    renderedFields.push('activeProjectThread');
  }

  const responseShape = safePromptValue(state.suggestedResponseShape, 140);
  if (responseShape) {
    parts.push(`Shape: ${responseShape}.`);
    renderedFields.push('suggestedResponseShape');
  }

  if (state.sourceCheckNeeded || state.sourcePosture === 'source-check-needed' || state.responseMode === RESPONSE_MODES.SOURCE_BACKED_REVIEW) {
    parts.push('Keep source-sensitive claims source-aware and uncertain until verified.');
    renderedFields.push('sourcePosture');
  }

  const constraintCues = constraintPromptCues(state.activeConstraints);
  if (constraintCues.length) {
    parts.push(`Keep ${constraintCues.join(', ')}.`);
    renderedFields.push('activeConstraints');
  }

  parts.push('Do not change runtime voice, memory authority, prompt limits, or persistence.');

  const promptText = truncateWords(parts.join(' '), maxWords);
  const omittedFields = [
    'userIntent',
    'energy',
    'energy.evidence',
    'explicitInstructions',
    'riskFlags',
    'rejectedFields',
    'warnings',
  ];
  const turnStateSummary = summarizeTurnStateForPrompt(state, activeProjectThread);
  const retentionPolicy = buildTurnStateRetentionPolicy({
    promptText,
    summary: turnStateSummary,
    omittedFields,
  });
  return {
    schema: TURN_STATE_PROMPT_BRIDGE_SCHEMA,
    turnStateSchema: state.schema,
    measurementMode: cleanString(measurementMode, 80) || 'fixture-only',
    turnStateMeasurementMode: state.measurementMode,
    persist: state.persist,
    livePromptBridge: livePromptBridge === true,
    liveChatTouched: liveChatTouched === true,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    promptText,
    wordCount: countWords(promptText),
    maxWords: clampInteger(maxWords, DEFAULT_TURN_STATE_PROMPT_MAX_WORDS, 20, 180),
    renderedFields: uniqueStrings(renderedFields, 12, 80),
    omittedFields,
    sensitiveInferenceExcluded: retentionPolicy.sensitiveFieldsOmitted,
    retentionPolicy,
    guardrails: [
      livePromptBridge === true
        ? 'Live prompt scaffold is enabled by flag only; no default behavior change.'
        : 'Fixture-only prompt scaffold; no live chat injection.',
      'Turn state remains ephemeral and persist=false.',
      'PromptTruth is not expanded and no new prompt-truth channel is added.',
      'No memory writes, autonomous actions, hidden reasoning, or sensitive private inference.',
    ],
    turnStateSummary,
  };
}

function buildDisabledTurnStatePromptBridge(disabledReason = 'env-disabled', maxTokens = DEFAULT_TURN_STATE_PROMPT_MAX_WORDS) {
  const safeMaxTokens = clampInteger(maxTokens, DEFAULT_TURN_STATE_PROMPT_MAX_WORDS, 20, 180);
  const omittedFields = [
    'userIntent',
    'energy',
    'energy.evidence',
    'explicitInstructions',
    'riskFlags',
    'rejectedFields',
    'warnings',
  ];
  return {
    schema: TURN_STATE_PROMPT_BRIDGE_SCHEMA,
    enabled: false,
    disabledReason: cleanString(disabledReason || 'env-disabled', 160),
    measurementMode: 'disabled',
    turnStateMeasurementMode: MEASUREMENT_MODE,
    persist: false,
    livePromptBridge: false,
    liveChatTouched: false,
    renderedCount: 0,
    maxTokens: safeMaxTokens,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    sensitiveInferenceExcluded: true,
    renderedFields: [],
    omittedFields,
    promptBridge: {
      renderedCount: 0,
      promptText: '',
      wordCount: 0,
      maxTokens: safeMaxTokens,
    },
    retentionPolicy: buildTurnStateRetentionPolicy({
      promptText: '',
      summary: null,
      omittedFields,
      promptTextRetained: false,
    }),
    turnStateSummary: null,
  };
}

function buildLiveTurnStatePromptBridge({
  enabled = false,
  disabledReason = '',
  userText = '',
  context = {},
  turnState = null,
  maxTokens = 120,
} = {}) {
  const safeMaxTokens = clampInteger(maxTokens, 120, 20, 180);
  if (enabled !== true) {
    return buildDisabledTurnStatePromptBridge(disabledReason || 'env-disabled', safeMaxTokens);
  }

  const state = turnState
    ? normalizeTurnState(turnState)
    : extractTurnStateSignals({ userText, context });
  const snippet = renderTurnStatePromptSnippet(state, {
    maxWords: safeMaxTokens,
    measurementMode: 'live-prompt',
    livePromptBridge: true,
    liveChatTouched: true,
  });
  const renderedCount = snippet.promptText ? 1 : 0;
  return {
    schema: TURN_STATE_PROMPT_BRIDGE_SCHEMA,
    enabled: true,
    disabledReason: '',
    measurementMode: snippet.measurementMode,
    turnStateMeasurementMode: snippet.turnStateMeasurementMode,
    persist: false,
    livePromptBridge: true,
    liveChatTouched: renderedCount > 0,
    renderedCount,
    maxTokens: safeMaxTokens,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    sensitiveInferenceExcluded: snippet.sensitiveInferenceExcluded === true,
    renderedFields: snippet.renderedFields,
    omittedFields: snippet.omittedFields,
    promptBridge: {
      renderedCount,
      promptText: snippet.promptText,
      wordCount: snippet.wordCount,
      maxTokens: safeMaxTokens,
    },
    retentionPolicy: snippet.retentionPolicy,
    turnStateSummary: snippet.turnStateSummary,
  };
}

module.exports = {
  DEFAULT_TURN_STATE_PROMPT_MAX_WORDS,
  DESIRED_DEPTHS,
  RESPONSE_MODES,
  TURN_STATE_PROMPT_BRIDGE_SCHEMA,
  TURN_STATE_RETENTION_SCHEMA,
  TURN_STATE_SCHEMA,
  buildLiveTurnStatePromptBridge,
  buildTurnStateRetentionPolicy,
  containsSensitivePromptInference,
  buildTurnState,
  extractTurnStateSignals,
  normalizeTurnState,
  renderTurnStatePromptSnippet,
  sanitizeTurnStatePromptTextForRetention,
  summarizeTurnState,
};
