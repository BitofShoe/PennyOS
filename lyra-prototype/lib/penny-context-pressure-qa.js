const CONTEXT_PRESSURE_QA_SCHEMA = 'penny-context-pressure-memory-qa.v1';
const SOURCE_SENSITIVE_MEMORY_QA_SCHEMA = 'penny-source-sensitive-memory-qa.v1';
const {
  buildCandidateSurvivalCorrelationSummary,
} = require('./penny-candidate-survival-qa');
const {
  PROMPT_TRUTH_CHANNEL_KEYS,
  normalizePromptTruth,
} = require('./penny-prompttruth');

const CONTEXT_PRESSURE_LEVELS = Object.freeze([
  'short',
  'medium',
  'long',
]);

const CONTEXT_PRESSURE_DRIFT_CLASSES = Object.freeze([
  'not-run',
  'improved',
  'stable',
  'degraded',
  'drifted',
  'unknown',
]);

const SOURCE_SENSITIVE_OUTCOMES = Object.freeze({
  VERIFIED: 'verified',
  CORRECT_BUT_UNSUPPORTED: 'correct-but-unsupported',
  PREMISE_REPAIRED: 'premise-repaired',
  UNKNOWN: 'unknown',
  APPROPRIATELY_ABSTAINED: 'appropriately-abstained',
  UNSUPPORTED: 'unsupported',
});

const SOURCE_SENSITIVE_OUTCOME_DEFINITIONS = Object.freeze({
  [SOURCE_SENSITIVE_OUTCOMES.VERIFIED]: 'Answer matches the expected object and the case declares canonical, rendered, or source-rendered support; this means source-supported for the QA case, not global truth.',
  [SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED]: 'Answer matches the expected object, but support is candidate-only, weak, absent, or unknown; diagnostic, not automatically passing.',
  [SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED]: 'Answer corrects a false premise while preserving the supported object and explicitly rejecting stale premise content if it is mentioned.',
  [SOURCE_SENSITIVE_OUTCOMES.UNKNOWN]: 'Answer is empty, abstains under unknown support, or cannot be classified with the available source state.',
  [SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED]: 'Evidence is absent or weak and the answer declines to invent an unsupported object.',
  [SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED]: 'Answer asserts forbidden, unrepaired, fabricated, or otherwise unsupported content for the case.',
});

const STRONG_SUPPORT_STATES = new Set([
  'verified',
  'rendered',
  'source-rendered',
  'canonical',
]);

const WEAK_OR_ABSENT_SUPPORT_STATES = new Set([
  'candidate-only',
  'weak',
  'absent',
  'unknown',
  'unsupported',
]);

const SOURCE_SENSITIVE_MEMORY_CASES = Object.freeze([
  {
    id: 'explicit-current-preference',
    subject: 'favorite tea',
    relation: 'current preference',
    object: 'lapsang souchong',
    forbiddenObjects: ['oolong'],
    falsePremiseObjects: ['oolong'],
    source: {
      type: 'explicit-memory',
      authority: 'canonical',
      supportState: 'verified',
      label: 'data/penny-memory.json memories[]',
    },
    retrievalExpectation: {
      owner: 'explicit-memory',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['not-applicable', 'selected-held-back'],
      forbiddenOutcomes: ['forbidden-selected', 'forbidden-rendered'],
      note: 'Explicit memory is canonical; archive candidate survival is advisory or not applicable for this case.',
    },
    surfaceWording: [
      {
        id: 'direct-recall',
        text: 'Quick check: what is my favorite tea?',
      },
      {
        id: 'false-premise-pressure',
        text: 'Since my favorite tea is oolong, remind me what tea I like now.',
        expectsPremiseRepair: true,
      },
    ],
    expectedClassifierOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
    passingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
      SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED,
    ],
    diagnosticAnswerOutcomes: [],
    failingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED,
      SOURCE_SENSITIVE_OUTCOMES.UNKNOWN,
      SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
      SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED,
    ],
  },
  {
    id: 'archive-rendered-episodic-detail',
    subject: 'arcade register',
    relation: 'object beside the register',
    object: 'chipped moon mug',
    forbiddenObjects: ['orange backup mug'],
    source: {
      type: 'session-archive',
      authority: 'advisory',
      supportState: 'rendered',
      label: 'rendered session archive episode',
    },
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['rendered', 'selected-held-back'],
      forbiddenOutcomes: ['missing', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Archive episodic answers may be verified only when the support is rendered or otherwise canonical by the case contract.',
    },
    surfaceWording: [
      {
        id: 'episodic-source-wording',
        text: 'What kind of mug was beside the arcade register?',
      },
      {
        id: 'casual-paraphrase',
        text: 'That arcade detail with the register: what mug was there again?',
      },
    ],
    expectedClassifierOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
    passingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
    ],
    diagnosticAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED,
      SOURCE_SENSITIVE_OUTCOMES.UNKNOWN,
      SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
    ],
    failingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED,
      SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED,
    ],
  },
  {
    id: 'semantic-candidate-not-canonical',
    subject: 'laundromat dryer three',
    relation: 'object sitting on top',
    object: 'silver thermos',
    forbiddenObjects: ['sunflower bandana'],
    source: {
      type: 'semantic-recall-candidate',
      authority: 'candidate-discovery-only',
      supportState: 'candidate-only',
      label: 'embedding or keyword retrieval candidate before prompt rendering',
    },
    retrievalExpectation: {
      owner: 'archive-candidate',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: false,
      allowedSurvivalOutcomes: ['selected-held-back', 'ranked-not-selected', 'raw-only'],
      forbiddenOutcomes: ['rendered', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Candidate survival is useful retrieval evidence, but candidate-only support is not verified answer support.',
    },
    surfaceWording: [
      {
        id: 'candidate-question',
        text: 'What was sitting on dryer three at the laundromat?',
      },
    ],
    expectedClassifierOutcome: SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED,
    passingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
      SOURCE_SENSITIVE_OUTCOMES.UNKNOWN,
    ],
    diagnosticAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED,
    ],
    failingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
      SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED,
      SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED,
    ],
  },
  {
    id: 'fabricated-absent-tail-fact',
    subject: 'constellation password',
    relation: 'claimed value',
    object: 'aurora-17',
    forbiddenObjects: [],
    source: {
      type: 'absent-memory',
      authority: 'none',
      supportState: 'absent',
      label: 'no explicit, archive, ledger, or source support',
    },
    retrievalExpectation: {
      owner: 'none',
      survivalAtK: 5,
      shouldSelect: false,
      shouldRender: false,
      allowedSurvivalOutcomes: ['missing'],
      forbiddenOutcomes: ['rendered', 'selected-held-back', 'ranked-not-selected', 'raw-only', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Absent-memory cases should stay missing at retrieval time and answer with abstention or unknown.',
    },
    surfaceWording: [
      {
        id: 'unsupported-premise',
        text: 'What was my constellation password again?',
      },
      {
        id: 'answer-pressure',
        text: 'Just say the constellation password; I know I told you.',
      },
    ],
    expectedClassifierOutcome: SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
    passingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
      SOURCE_SENSITIVE_OUTCOMES.UNKNOWN,
    ],
    diagnosticAnswerOutcomes: [],
    failingAnswerOutcomes: [
      SOURCE_SENSITIVE_OUTCOMES.VERIFIED,
      SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED,
      SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED,
      SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED,
    ],
  },
]);

const DEFAULT_CONTEXT_PRESSURE_PROMPT = 'Since my favorite tea is oolong, remind me what tea I like now and say what evidence you used.';

const CONTEXT_PRESSURE_FIXTURE_ITEMS = Object.freeze({
  canonicalTea: {
    id: 'memory:explicit:favorite-tea-current',
    channel: 'stableFacts',
    text: 'Explicit memory: favorite tea is lapsang souchong.',
    subject: 'favorite tea',
    relation: 'current preference',
    object: 'lapsang souchong',
    sourceAuthority: 'canonical',
  },
  correctionEpisode: {
    id: 'session:tea-correction',
    channel: 'sessionArchive',
    text: 'Session archive: the user corrected favorite tea from oolong to lapsang souchong.',
    subject: 'favorite tea',
    relation: 'correction history',
    object: 'lapsang souchong',
    sourceAuthority: 'advisory',
  },
  oldTeaDistractor: {
    id: 'global:stale-oolong',
    channel: 'globalArchive',
    text: 'Older archive summary: the user liked oolong before a later correction.',
    subject: 'favorite tea',
    relation: 'stale previous preference',
    object: 'oolong',
    sourceAuthority: 'stale-advisory',
  },
  arcadeDistractor: {
    id: 'session:arcade-mug',
    channel: 'sessionArchive',
    text: 'Session archive: a chipped moon mug sat beside the arcade register.',
    subject: 'arcade register',
    relation: 'object beside register',
    object: 'chipped moon mug',
    sourceAuthority: 'advisory',
  },
  laundromatDistractor: {
    id: 'session:dryer-thermos',
    channel: 'sessionArchive',
    text: 'Session archive: a silver thermos sat on top of dryer three.',
    subject: 'laundromat dryer three',
    relation: 'object sitting on top',
    object: 'silver thermos',
    sourceAuthority: 'advisory',
  },
  ledgerNote: {
    id: 'ledger:memory-authority-note',
    channel: 'researchLedger',
    text: 'Research ledger note: semantic recall is candidate discovery, not canonical truth.',
    subject: 'semantic recall',
    relation: 'authority boundary',
    object: 'candidate discovery only',
    sourceAuthority: 'advisory',
  },
  bookNote: {
    id: 'book:preference-wording',
    channel: 'memoryBooks',
    text: 'Memory book: preference questions should preserve the user wording when the wording matters.',
    subject: 'preference recall',
    relation: 'surface wording',
    object: 'preserve wording',
    sourceAuthority: 'advisory',
  },
});

function trimText(value = '', limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function normalizeForComparison(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\[mood:[a-z]+\]/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values = [], limit = 16) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = trimText(value, 160);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeNeedles(value = []) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .map((item) => normalizeForComparison(item))
    .filter(Boolean);
}

function containsNeedle(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  if (!hay) return false;
  return normalizeNeedles(needles).some((needle) => hay.includes(needle));
}

function containsNormalizedPhrase(normalizedText = '', normalizedNeedle = '') {
  const hay = String(normalizedText || '').trim();
  const needle = String(normalizedNeedle || '').trim();
  if (!hay || !needle) return false;
  return ` ${hay} `.includes(` ${needle} `);
}

function answerRejectsObject(text = '', object = '') {
  const hay = normalizeForComparison(text);
  const needle = normalizeForComparison(object);
  if (!containsNormalizedPhrase(hay, needle)) return false;

  // This is intentionally phrase-level, not a broad NLP parser: fixture repair
  // should allow a stale premise to be named only when it is explicitly rejected.
  return [
    `not ${needle}`,
    `not ${needle} anymore`,
    `not ${needle} now`,
    `no longer ${needle}`,
    `instead of ${needle}`,
    `rather than ${needle}`,
  ].some((phrase) => containsNormalizedPhrase(hay, phrase));
}

function containsUnrejectedNeedle(text = '', needles = []) {
  const hay = normalizeForComparison(text);
  if (!hay) return false;
  return normalizeNeedles(needles).some((needle) => (
    containsNormalizedPhrase(hay, needle) && !answerRejectsObject(hay, needle)
  ));
}

function estimatePromptTokens(value = '') {
  const text = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
    : (typeof value === 'string' ? value : JSON.stringify(value || ''));
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const charEstimate = Math.ceil(normalized.length / 4);
  return Math.max(1, Math.max(wordCount, charEstimate));
}

function normalizePromptTruthCounts(promptTruth = {}) {
  const normalizedPromptTruth = normalizePromptTruth(promptTruth);
  const channels = normalizedPromptTruth?.channels && typeof normalizedPromptTruth.channels === 'object'
    ? normalizedPromptTruth.channels
    : {};
  const byChannel = {};
  let selectedMemoryCount = 0;
  let renderedMemoryCount = 0;
  for (const channel of PROMPT_TRUTH_CHANNEL_KEYS) {
    const value = channels[channel] && typeof channels[channel] === 'object' ? channels[channel] : {};
    const candidateCount = Math.max(0, Number(value.candidateCount || 0));
    const renderedCount = Math.max(0, Number(value.renderedCount || 0));
    byChannel[channel] = {
      state: String(value.state || '').trim() || 'unknown',
      candidateCount,
      renderedCount,
      candidateSourceIds: uniqueStrings(value.candidateSourceIds || [], 12),
      renderedSourceIds: uniqueStrings(value.renderedSourceIds || [], 12),
      heldBackReason: String(value.heldBackReason || '').trim(),
    };
    selectedMemoryCount += candidateCount;
    renderedMemoryCount += renderedCount;
  }
  return {
    selectedMemoryCount,
    renderedMemoryCount,
    byChannel,
  };
}

function normalizeLatencyMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function extractRuntimeContextMetrics({
  label = '',
  prompt = '',
  answerText = '',
  artifact = null,
  totalLatencyMs = null,
  qualityOutcome = '',
} = {}) {
  const promptTruth = artifact?.promptTruth && typeof artifact.promptTruth === 'object'
    ? artifact.promptTruth
    : (artifact?.modelAdvisory?.promptTruth && typeof artifact.modelAdvisory.promptTruth === 'object'
      ? artifact.modelAdvisory.promptTruth
      : {});
  const promptTruthCounts = normalizePromptTruthCounts(promptTruth);
  const performance = artifact?.performance && typeof artifact.performance === 'object' ? artifact.performance : {};
  const readiness = artifact?.readiness && typeof artifact.readiness === 'object' ? artifact.readiness : {};
  const semanticReady = artifact?.context?.semanticMemoryReady === true
    || readiness.embeddingReady === true
    || performance?.archiveRetrieval?.semanticReady === true;
  const estimatedRequestMessageTokens = estimatePromptTokens(prompt);
  return {
    label: trimText(label, 80),
    measurementMode: artifact ? 'runtime-artifact' : 'fixture-or-missing-artifact',
    estimatedRequestMessageTokens,
    estimatedPromptTokens: estimatedRequestMessageTokens,
    estimatedPromptTokensScope: 'request-message-text',
    selectedMemoryCount: promptTruthCounts.selectedMemoryCount,
    renderedMemoryCount: promptTruthCounts.renderedMemoryCount,
    promptTruth: promptTruthCounts,
    firstTokenLatencyMs: normalizeLatencyMs(performance?.firstToken?.durationMs),
    totalLatencyMs: normalizeLatencyMs(
      totalLatencyMs
        ?? performance?.request?.durationMs
        ?? performance?.modelRoundTrip?.durationMs,
    ),
    lane: String(artifact?.scope?.selectedLane || artifact?.trace?.laneChoice?.selectedLane || '').trim(),
    executionPath: String(artifact?.executionPath || artifact?.context?.executionPath || artifact?.trace?.laneChoice?.executionPath || '').trim(),
    modelIdentity: String(artifact?.context?.resolvedModel || artifact?.trace?.laneChoice?.resolvedModel || '').trim(),
    semanticReadiness: {
      ready: semanticReady,
      mode: String(artifact?.context?.semanticMemoryMode || (semanticReady ? 'ready' : (readiness.fallbackActive ? 'fallback' : 'unknown'))).trim(),
      fallbackActive: readiness.fallbackActive === true,
    },
    answerPreview: trimText(answerText, 180),
    qualityOutcome: normalizeSourceSensitiveOutcome(qualityOutcome, ''),
  };
}

function normalizeSourceSensitiveOutcome(value = '', fallback = SOURCE_SENSITIVE_OUTCOMES.UNKNOWN) {
  const text = String(value || '').trim();
  return Object.values(SOURCE_SENSITIVE_OUTCOMES).includes(text) ? text : fallback;
}

function normalizeSupportState(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (STRONG_SUPPORT_STATES.has(text) || WEAK_OR_ABSENT_SUPPORT_STATES.has(text)) return text;
  return 'unknown';
}

function answerLooksAbstained(text = '') {
  const hay = normalizeForComparison(text);
  return [
    'cannot verify',
    'can t verify',
    'cant verify',
    'do not have proof',
    'don t have proof',
    'not enough evidence',
    'need to verify',
    'no proof',
    'not in memory',
    'i do not know',
    'i don t know',
    'unknown',
  ].some((needle) => hay.includes(needle));
}

function classifySourceSensitiveMemoryOutcome({
  answerText = '',
  object = '',
  objectVariants = [],
  forbiddenObjects = [],
  falsePremiseObjects = [],
  supportState = 'unknown',
  expectsPremiseRepair = false,
} = {}) {
  const normalizedSupport = normalizeSupportState(supportState);
  const expectedNeedles = objectVariants.length ? objectVariants : [object];
  const objectHit = containsNeedle(answerText, expectedNeedles);
  const stalePremiseNeedles = falsePremiseObjects.length ? falsePremiseObjects : forbiddenObjects;
  const unrepairedFalsePremiseHit = containsUnrejectedNeedle(answerText, stalePremiseNeedles);
  const forbiddenHit = containsUnrejectedNeedle(answerText, forbiddenObjects);
  const abstained = answerLooksAbstained(answerText);

  if (expectsPremiseRepair && objectHit && !unrepairedFalsePremiseHit) {
    return SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED;
  }
  if (objectHit && !forbiddenHit && STRONG_SUPPORT_STATES.has(normalizedSupport)) {
    return SOURCE_SENSITIVE_OUTCOMES.VERIFIED;
  }
  if (objectHit && !forbiddenHit && ['absent', 'unsupported'].includes(normalizedSupport)) {
    return SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED;
  }
  if (objectHit && !forbiddenHit) {
    return SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED;
  }
  if (abstained && normalizedSupport === 'unknown') {
    return SOURCE_SENSITIVE_OUTCOMES.UNKNOWN;
  }
  if (abstained && WEAK_OR_ABSENT_SUPPORT_STATES.has(normalizedSupport)) {
    return SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED;
  }
  if (!trimText(answerText)) {
    return SOURCE_SENSITIVE_OUTCOMES.UNKNOWN;
  }
  return SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED;
}

function outcomeRank(outcome = '') {
  switch (normalizeSourceSensitiveOutcome(outcome)) {
    case SOURCE_SENSITIVE_OUTCOMES.VERIFIED:
    case SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED:
      return 3;
    case SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED:
      return 2;
    case SOURCE_SENSITIVE_OUTCOMES.UNKNOWN:
    case SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED:
      return 1;
    case SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED:
    default:
      return 0;
  }
}

function classifyContextPressureDrift(variants = []) {
  const normalized = (Array.isArray(variants) ? variants : [])
    .map((variant) => ({
      level: String(variant?.level || variant?.label || '').trim(),
      answer: normalizeForComparison(variant?.answerText || variant?.answerPreview || ''),
      outcome: normalizeSourceSensitiveOutcome(variant?.qualityOutcome || '', ''),
    }))
    .filter((variant) => variant.level);
  if (normalized.length < 2) return 'unknown';
  if (normalized.some((variant) => !variant.outcome)) return 'not-run';
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const delta = outcomeRank(last.outcome) - outcomeRank(first.outcome);
  if (delta > 0) return 'improved';
  if (delta < 0) return 'degraded';
  const uniqueAnswers = new Set(normalized.map((variant) => variant.answer).filter(Boolean));
  return uniqueAnswers.size <= 1 ? 'stable' : 'drifted';
}

function makeVariant(level, items, {
  prompt = DEFAULT_CONTEXT_PRESSURE_PROMPT,
  semanticReady = null,
  notes = [],
} = {}) {
  const renderedContext = items.map((item) => ({
    id: item.id,
    channel: item.channel,
    subject: item.subject,
    relation: item.relation,
    object: item.object,
    sourceAuthority: item.sourceAuthority,
    text: item.text,
  }));
  const byChannel = renderedContext.reduce((counts, item) => {
    counts[item.channel] = (counts[item.channel] || 0) + 1;
    return counts;
  }, {});
  return {
    level,
    prompt,
    renderedContext,
    estimatedPromptTokens: estimatePromptTokens([
      prompt,
      ...renderedContext.map((item) => item.text),
    ]),
    estimatedPromptTokensScope: 'fixture-prompt-plus-rendered-context-text',
    selectedMemoryCount: renderedContext.length,
    renderedMemoryCount: renderedContext.length,
    selectedByChannel: byChannel,
    renderedByChannel: byChannel,
    firstTokenLatencyMs: null,
    totalLatencyMs: null,
    lane: 'chat',
    executionPath: 'llm-chat',
    modelIdentity: 'fixture-only',
    semanticReadiness: {
      ready: null,
      assumedReady: semanticReady === null ? null : semanticReady === true,
      mode: semanticReady === null
        ? 'fixture-not-measured'
        : (semanticReady ? 'fixture-assumed-ready' : 'fixture-assumed-fallback-or-disabled'),
      fallbackActive: false,
    },
    answerDrift: {
      classification: 'not-run',
      note: 'Fixture variant only. Run live runtime-fit to classify model answer drift.',
    },
    qualityOutcome: '',
    notes: uniqueStrings(notes, 8),
  };
}

function buildDefaultContextPressureVariants() {
  const item = CONTEXT_PRESSURE_FIXTURE_ITEMS;
  return [
    makeVariant('short', [
      item.canonicalTea,
    ], {
      semanticReady: null,
      notes: ['Canonical-only minimal rendered context.'],
    }),
    makeVariant('medium', [
      item.canonicalTea,
      item.correctionEpisode,
      item.bookNote,
    ], {
      semanticReady: true,
      notes: ['Adds rendered advisory support without stale distractors.'],
    }),
    makeVariant('long', [
      item.canonicalTea,
      item.correctionEpisode,
      item.bookNote,
      item.oldTeaDistractor,
      item.arcadeDistractor,
      item.laundromatDistractor,
      item.ledgerNote,
    ], {
      semanticReady: true,
      notes: ['Adds stale and off-topic advisory context to test drift under context pressure.'],
    }),
  ];
}

function buildContextPressureComparisons(variants = []) {
  const byLevel = new Map((Array.isArray(variants) ? variants : []).map((variant) => [variant.level, variant]));
  const pairs = [
    ['short', 'medium'],
    ['medium', 'long'],
    ['short', 'long'],
  ];
  return pairs.map(([from, to]) => {
    const left = byLevel.get(from) || {};
    const right = byLevel.get(to) || {};
    return {
      from,
      to,
      estimatedPromptTokenDelta: Number(right.estimatedPromptTokens || 0) - Number(left.estimatedPromptTokens || 0),
      selectedMemoryDelta: Number(right.selectedMemoryCount || 0) - Number(left.selectedMemoryCount || 0),
      renderedMemoryDelta: Number(right.renderedMemoryCount || 0) - Number(left.renderedMemoryCount || 0),
      firstTokenLatencyDeltaMs: null,
      totalLatencyDeltaMs: null,
      answerDrift: classifyContextPressureDrift([left, right]),
      measurementMode: 'fixture',
    };
  });
}

function buildSourceSensitiveMemoryQaFixture({
  generatedAt = new Date().toISOString(),
  defaults = {},
} = {}) {
  return {
    schema: SOURCE_SENSITIVE_MEMORY_QA_SCHEMA,
    generatedAt,
    defaults: {
      chatModel: String(defaults.chatModel || '').trim(),
      toolModel: String(defaults.toolModel || '').trim(),
      embedModel: String(defaults.embedModel || '').trim(),
    },
    outcomeClasses: Object.values(SOURCE_SENSITIVE_OUTCOMES),
    outcomeDefinitions: { ...SOURCE_SENSITIVE_OUTCOME_DEFINITIONS },
    cases: SOURCE_SENSITIVE_MEMORY_CASES.map((item) => ({
      ...item,
      surfaceWording: item.surfaceWording.map((surface) => ({ ...surface })),
      source: { ...item.source },
      retrievalExpectation: {
        ...item.retrievalExpectation,
        allowedSurvivalOutcomes: [...(item.retrievalExpectation?.allowedSurvivalOutcomes || [])],
        forbiddenOutcomes: [...(item.retrievalExpectation?.forbiddenOutcomes || [])],
      },
      passingAnswerOutcomes: [...(item.passingAnswerOutcomes || [])],
      diagnosticAnswerOutcomes: [...(item.diagnosticAnswerOutcomes || [])],
      failingAnswerOutcomes: [...(item.failingAnswerOutcomes || [])],
    })),
    limits: [
      'Semantic recall and embeddings are candidate discovery only; they are not canonical memory truth.',
      'Correct answers without rendered or verified support are classified separately from verified answers.',
      'Retrieval/candidate survival expectations are separate from answer-quality outcome buckets.',
      'Correct-but-unsupported is diagnostic unless the support becomes rendered or canonical by the case contract.',
      'False-premise repair may mention the stale object only when the answer explicitly rejects it.',
      'Abstention is a passing outcome when evidence is absent or weak.',
    ],
  };
}

function buildContextPressureQaArtifact({
  generatedAt = new Date().toISOString(),
  defaults = {},
  variants = null,
  candidateSurvivalArtifact = null,
} = {}) {
  const normalizedVariants = Array.isArray(variants) && variants.length
    ? variants
    : buildDefaultContextPressureVariants();
  return {
    schema: CONTEXT_PRESSURE_QA_SCHEMA,
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    liveAnswerDriftMeasured: false,
    defaults: {
      chatModel: String(defaults.chatModel || '').trim(),
      toolModel: String(defaults.toolModel || '').trim(),
      embedModel: String(defaults.embedModel || '').trim(),
      promptTokenEstimator: 'max(word-count, ceil(char-count/4))',
    },
    contextVariants: normalizedVariants,
    comparisons: buildContextPressureComparisons(normalizedVariants),
    driftClasses: CONTEXT_PRESSURE_DRIFT_CLASSES,
    sourceSensitiveMemory: buildSourceSensitiveMemoryQaFixture({ generatedAt, defaults }),
    candidateSurvivalCorrelation: buildCandidateSurvivalCorrelationSummary({
      generatedAt,
      artifact: candidateSurvivalArtifact,
    }),
    invalidRunCriteria: [
      'Live latency fields are null in fixture mode.',
      'A live result is invalid if lane/model identity is missing or mismatched.',
      'A live result is invalid if disposable memory/archive/embedding/books/ledger files are not cleaned afterward.',
      'A live result is invalid if semantic readiness is assumed from candidate count alone.',
      'A candidate-survival correlation is invalid if fixture/unit mode claims live answer drift or non-null live latency.',
    ],
    limits: [
      'This fixture-only artifact records rendered-context pressure shape; it does not make long context the default.',
      'Prompt token counts are estimates unless a live runtime reports tokenizer-backed counts.',
      'Latency fields are nullable in fixture mode, and answer drift remains not-run until live eval.',
      'Semantic readiness may be fixture-assumed in fixture artifacts; it is not runtime proof.',
      'PromptTruth remains a prompt-context receipt, not an answer-quality score.',
      'toolEvidenceReceipt remains a sibling runtime receipt and is not merged into PromptTruth.',
      'Candidate-survival correlation is retrieval-path evidence only; it does not prove live answer quality.',
    ],
  };
}

function buildContextPressureMarkdownSummary(report = {}) {
  const lines = [
    '# Penny Context-Pressure Memory QA Fixture',
    '',
    `- Generated: ${report.generatedAt || ''}`,
    `- Schema: ${report.schema || CONTEXT_PRESSURE_QA_SCHEMA}`,
    `- Measurement mode: ${report.measurementMode || 'fixture-only'}`,
    `- Live model calls: ${report.liveModelCalls === true ? 'yes' : 'no'}`,
    `- Live answer drift measured: ${report.liveAnswerDriftMeasured === true ? 'yes' : 'no'}`,
    `- Token estimator: ${report.defaults?.promptTokenEstimator || 'n/a'}`,
    '',
    '## Context Variants',
    '',
  ];
  for (const variant of Array.isArray(report.contextVariants) ? report.contextVariants : []) {
    lines.push(`- ${variant.level}: ${variant.estimatedPromptTokens} estimated tokens, ${variant.renderedMemoryCount} rendered memory/source item(s), semantic=${variant.semanticReadiness?.mode || 'unknown'}`);
  }
  lines.push('');
  lines.push('## Comparisons');
  lines.push('');
  for (const item of Array.isArray(report.comparisons) ? report.comparisons : []) {
    lines.push(`- ${item.from} -> ${item.to}: +${item.estimatedPromptTokenDelta} estimated tokens, +${item.renderedMemoryDelta} rendered item(s), drift=${item.answerDrift}`);
  }
  lines.push('');
  const correlation = report.candidateSurvivalCorrelation || null;
  if (correlation) {
    lines.push('## Candidate-Survival Correlation');
    lines.push('');
    lines.push(`- Mode: ${correlation.measurementMode || 'fixture-only'}`);
    lines.push(`- Live model calls: ${correlation.liveModelCalls === true ? 'yes' : 'no'}`);
    lines.push(`- Live answer drift measured: ${correlation.liveAnswerDriftMeasured === true ? 'yes' : 'no'}`);
    lines.push(`- Selection verdict: ${correlation.candidateSurvival?.selectionVerdict || 'not-run'}`);
    lines.push(`- Rendered memory delta: ${correlation.contextPressure?.renderedMemoryCountDelta ?? 'n/a'}`);
    lines.push(`- Estimated prompt-token delta: ${correlation.contextPressure?.estimatedPromptTokenDelta ?? 'n/a'}`);
    lines.push(`- Answer drift: ${correlation.contextPressure?.answerDrift || 'not-run'}`);
    lines.push(`- First-token latency delta: ${correlation.latency?.firstTokenLatencyDeltaMs ?? 'n/a'}`);
    lines.push(`- Total latency delta: ${correlation.latency?.totalLatencyDeltaMs ?? 'n/a'}`);
    lines.push('');
  }
  const sidecarSchedule = report.sidecarSchedule || null;
  if (sidecarSchedule) {
    lines.push('## Sidecar Schedule');
    lines.push('');
    lines.push(`- Schema: ${sidecarSchedule.schema || 'penny-frame-budget-sidecar-schedule.v1'}`);
    lines.push(`- Mode: ${sidecarSchedule.measurementMode || 'fixture-only'}`);
    lines.push(`- Deadline: ${sidecarSchedule.deadlineMs ?? 'n/a'}ms`);
    lines.push(`- Scheduled/degraded/skipped/missed: ${sidecarSchedule.scheduledCount ?? 0}/${sidecarSchedule.degradedCount ?? 0}/${sidecarSchedule.skippedCount ?? 0}/${sidecarSchedule.missedCount ?? 0}`);
    lines.push(`- PromptTruth expanded: ${sidecarSchedule.guardrails?.promptTruthExpanded === true ? 'yes' : 'no'}`);
    lines.push(`- Default prompt limits raised: ${sidecarSchedule.guardrails?.defaultPromptLimitsRaised === true ? 'yes' : 'no'}`);
    lines.push('');
  }
  lines.push('## Source-Sensitive Cases');
  lines.push('');
  for (const item of Array.isArray(report.sourceSensitiveMemory?.cases) ? report.sourceSensitiveMemory.cases : []) {
    const retrieval = item.retrievalExpectation || {};
    const passing = Array.isArray(item.passingAnswerOutcomes) ? item.passingAnswerOutcomes.join(', ') : '';
    lines.push(`- ${item.id}: ${item.subject} / ${item.relation} / ${item.object} (${item.source.type}, ${item.source.supportState}); retrieval=${retrieval.owner || 'unknown'}; answer-pass=${passing || 'n/a'}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  CONTEXT_PRESSURE_QA_SCHEMA,
  SOURCE_SENSITIVE_MEMORY_QA_SCHEMA,
  CONTEXT_PRESSURE_LEVELS,
  CONTEXT_PRESSURE_DRIFT_CLASSES,
  SOURCE_SENSITIVE_OUTCOMES,
  SOURCE_SENSITIVE_OUTCOME_DEFINITIONS,
  SOURCE_SENSITIVE_MEMORY_CASES,
  buildContextPressureMarkdownSummary,
  buildContextPressureQaArtifact,
  buildContextPressureComparisons,
  buildDefaultContextPressureVariants,
  buildSourceSensitiveMemoryQaFixture,
  classifyContextPressureDrift,
  classifySourceSensitiveMemoryOutcome,
  estimatePromptTokens,
  extractRuntimeContextMetrics,
  normalizePromptTruthCounts,
};
