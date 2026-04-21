const CANDIDATE_SURVIVAL_QA_SCHEMA = 'penny-candidate-survival-memory-qa.v1';

const CANDIDATE_SURVIVAL_OUTCOMES = Object.freeze({
  RENDERED: 'rendered',
  SELECTED_HELD_BACK: 'selected-held-back',
  RANKED_NOT_SELECTED: 'ranked-not-selected',
  RAW_ONLY: 'raw-only',
  MISSING: 'missing',
  FORBIDDEN_SELECTED: 'forbidden-selected',
  FORBIDDEN_RENDERED: 'forbidden-rendered',
  NOT_APPLICABLE: 'not-applicable',
});

const CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS = Object.freeze({
  [CANDIDATE_SURVIVAL_OUTCOMES.RENDERED]: 'Expected candidate reached prompt-visible support.',
  [CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK]: 'Expected candidate was selected by retrieval but held back before prompt rendering or by authority/policy.',
  [CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED]: 'Expected candidate entered ranking but lost before selection/rendering.',
  [CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY]: 'Expected candidate existed in the raw candidate pool but failed eligibility/gating/scoring before ranking or selection.',
  [CANDIDATE_SURVIVAL_OUTCOMES.MISSING]: 'Expected memory/source never entered the candidate pool.',
  [CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_SELECTED]: 'Stale/forbidden candidate was selected.',
  [CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_RENDERED]: 'Stale/forbidden candidate reached prompt-visible support.',
  [CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE]: 'Case is not owned by archive/candidate retrieval.',
});

const CANDIDATE_SURVIVAL_FIXTURE_CASES = Object.freeze([
  {
    id: 'explicit-current-preference',
    query: 'Since my favorite tea is oolong, remind me what tea I like now.',
    expected: {
      subject: 'favorite tea',
      relation: 'current preference',
      object: 'lapsang souchong',
      objectVariants: ['lapsang souchong'],
      supportOwner: 'explicit-memory',
      sourceAuthority: 'canonical',
    },
    forbidden: [
      {
        object: 'oolong',
        reason: 'False premise or stale advisory preference.',
      },
    ],
    support: {
      owner: 'explicit-memory',
      authority: 'canonical',
      supportState: 'verified',
      label: 'data/penny-memory.json memories[]',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE,
    notes: [
      'Explicit memory is canonical; archive candidate survival is not the owner for this case.',
      'The false premise should be repaired by canonical memory, not by treating stale archive hits as truth.',
    ],
  },
  {
    id: 'archive-rendered-episodic-detail',
    query: 'What kind of mug was near the arcade register?',
    expected: {
      subject: 'arcade register',
      relation: 'object near register',
      object: 'chipped moon mug',
      objectVariants: ['chipped moon mug', 'moon mug'],
      supportOwner: 'session-archive',
      sourceAuthority: 'advisory',
    },
    forbidden: [
      {
        object: 'orange backup mug',
        reason: 'Unrelated mug distractor.',
      },
    ],
    support: {
      owner: 'archive-candidate',
      authority: 'advisory',
      supportState: 'rendered',
      label: 'rendered session archive episode',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RENDERED,
    notes: [
      'Archive retrieval owns this diagnostic case because the expected support is episodic.',
    ],
  },
  {
    id: 'semantic-candidate-not-canonical',
    query: 'What was sitting on dryer three at the laundromat?',
    expected: {
      subject: 'laundromat dryer three',
      relation: 'object sitting on top',
      object: 'silver thermos',
      objectVariants: ['silver thermos'],
      supportOwner: 'semantic-recall-candidate',
      sourceAuthority: 'candidate-only/advisory',
    },
    forbidden: [
      {
        object: 'sunflower bandana',
        reason: 'Nearby laundromat distractor.',
      },
    ],
    support: {
      owner: 'semantic-candidate',
      authority: 'candidate-only/advisory',
      supportState: 'candidate-only',
      label: 'embedding or keyword retrieval candidate before verified support',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED,
    notes: [
      'Candidate survival is a retrieval-path diagnostic. It does not equal verified answer support.',
      'Semantic candidates remain advisory discovery unless they are rendered or canonized elsewhere.',
    ],
  },
  {
    id: 'fabricated-absent-tail-fact',
    query: 'What was my constellation password again?',
    expected: {
      subject: 'constellation password',
      relation: 'claimed value',
      object: 'aurora-17',
      objectVariants: ['aurora-17'],
      supportOwner: 'absent-memory',
      sourceAuthority: 'none',
    },
    forbidden: [],
    support: {
      owner: 'absent-memory',
      authority: 'none',
      supportState: 'absent',
      label: 'no explicit, archive, ledger, or source support',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.MISSING,
    notes: [
      'Missing is the desired retrieval-path class for an absent memory.',
    ],
  },
]);

const RELATION_MATCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'object',
]);

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

function normalizeKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function asArray(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function uniqueStrings(values = [], limit = 16) {
  const seen = new Set();
  const output = [];
  for (const value of asArray(values)) {
    const text = trimText(value, 200);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (Array.isArray(item)) return item.length > 0;
    return item !== undefined && item !== null && item !== '';
  }));
}

function normalizeOutcome(value = '', fallback = '') {
  const text = normalizeKey(value);
  return Object.values(CANDIDATE_SURVIVAL_OUTCOMES).includes(text) ? text : fallback;
}

function buildOutcomeDefinitionList() {
  return Object.values(CANDIDATE_SURVIVAL_OUTCOMES).map((outcome) => ({
    outcome,
    definition: CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS[outcome],
  }));
}

function normalizeCandidateExpectation(expectedLike = {}) {
  const source = typeof expectedLike === 'object' && expectedLike !== null
    ? expectedLike
    : { object: String(expectedLike || '') };
  const ids = [
    source.id,
    source.candidateId,
    source.sourceId,
    ...asArray(source.ids),
    ...asArray(source.candidateIds),
    ...asArray(source.sourceIds),
  ].filter(Boolean);
  const objectVariants = uniqueStrings([
    source.object,
    ...asArray(source.objectVariants),
    ...asArray(source.expectedObjects),
  ], 12);
  const textNeedles = uniqueStrings([
    ...asArray(source.textNeedles),
    ...asArray(source.needles),
  ], 12);

  return compactObject({
    id: trimText(source.id || source.candidateId || source.sourceId || '', 120),
    ids: uniqueStrings(ids, 16),
    subject: trimText(source.subject || '', 120),
    relation: trimText(source.relation || '', 120),
    object: trimText(source.object || objectVariants[0] || '', 160),
    objectVariants,
    textNeedles,
    supportOwner: trimText(source.supportOwner || source.owner || '', 120),
    sourceType: trimText(source.sourceType || source.type || source.channel || '', 120),
    sourceAuthority: trimText(source.sourceAuthority || source.authority || '', 120),
  });
}

function normalizeForbiddenCandidate(forbiddenLike = {}) {
  const source = typeof forbiddenLike === 'object' && forbiddenLike !== null
    ? forbiddenLike
    : { object: String(forbiddenLike || '') };
  return compactObject({
    ...normalizeCandidateExpectation(source),
    reason: trimText(source.reason || '', 200),
  });
}

function normalizeSupport(supportLike = {}, expected = {}) {
  const support = supportLike && typeof supportLike === 'object' ? supportLike : {};
  return compactObject({
    owner: trimText(support.owner || support.supportOwner || expected.supportOwner || '', 120),
    authority: trimText(support.authority || expected.sourceAuthority || '', 120),
    supportState: trimText(support.supportState || support.state || '', 120),
    type: trimText(support.type || expected.sourceType || '', 120),
    label: trimText(support.label || '', 200),
    note: trimText(support.note || '', 240),
  });
}

function inferDefaultSurvivalOutcome({ support = {}, expected = {} } = {}) {
  const supportState = normalizeKey(support.supportState || '');
  const supportOwner = normalizeForComparison([
    support.owner,
    support.type,
    expected.supportOwner,
    expected.sourceType,
  ].filter(Boolean).join(' '));

  if (supportState === 'absent' || supportOwner.includes('absent memory')) {
    return CANDIDATE_SURVIVAL_OUTCOMES.MISSING;
  }
  if (supportOwner.includes('explicit memory')) {
    return CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE;
  }
  return '';
}

function normalizeCandidateSurvivalCase(caseLike = {}) {
  const source = caseLike && typeof caseLike === 'object' ? caseLike : {};
  const expected = normalizeCandidateExpectation(source.expected || source.oracle || source);
  const forbidden = [
    ...asArray(source.forbidden),
    ...asArray(source.forbiddenCandidates),
    ...asArray(source.forbiddenObjects),
  ].map((item) => normalizeForbiddenCandidate(item)).filter((item) => (
    item.id || item.ids || item.object || item.objectVariants || item.textNeedles
  ));
  const support = normalizeSupport(source.support || source.source || {}, expected);
  const expectedSurvival = normalizeOutcome(
    source.expectedSurvival || source.expectedSurvivalOutcome || source.survivalOutcome,
    inferDefaultSurvivalOutcome({ support, expected }),
  );

  return {
    id: trimText(source.id || '', 120),
    query: trimText(source.query || source.prompt || '', 360),
    expected,
    forbidden,
    support,
    expectedSurvival,
    notes: uniqueStrings(source.notes || [], 12),
  };
}

function stageMatches(stage = '', values = []) {
  const normalized = normalizeKey(stage);
  return values.includes(normalized);
}

function normalizeRank(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCandidateTraceItem(itemLike = {}) {
  const source = itemLike && typeof itemLike === 'object' ? itemLike : { text: String(itemLike || '') };
  const stage = normalizeKey(source.stage || source.status || source.outcome || source.state || '');
  const rank = normalizeRank(source.rank ?? source.rankIndex ?? source.position ?? source.scoreRank);
  const rendered = source.rendered === true
    || source.promptVisible === true
    || source.inPrompt === true
    || stageMatches(stage, ['rendered', 'forbidden-rendered']);
  const selected = rendered
    || source.selected === true
    || source.heldBack === true
    || source.promptSelected === true
    || stageMatches(stage, ['selected', 'selected-held-back', 'held-back', 'forbidden-selected']);
  const ranked = selected
    || source.ranked === true
    || rank !== null
    || stageMatches(stage, ['ranked', 'ranked-not-selected']);
  const hasCandidateContent = Boolean(
    source.id || source.candidateId || source.sourceId || source.text || source.textPreview || source.summary || source.object,
  );
  const raw = source.inCandidatePool === false || source.inRawPool === false
    ? false
    : (ranked || selected || rendered || source.raw === true || source.inCandidatePool === true
      || source.inRawPool === true || source.candidate === true || hasCandidateContent
      || stageMatches(stage, ['raw', 'raw-only', 'candidate', 'filtered', 'ineligible']));
  const eligible = source.eligible === false
    || source.filtered === true
    || stageMatches(stage, ['raw-only', 'filtered', 'ineligible'])
    ? false
    : (source.eligible === true ? true : null);

  return compactObject({
    id: trimText(source.id || source.candidateId || source.sourceId || '', 160),
    sourceId: trimText(source.sourceId || source.id || source.candidateId || '', 160),
    stage,
    raw,
    ranked,
    selected,
    rendered,
    eligible,
    rank,
    score: Number.isFinite(Number(source.score)) ? Number(source.score) : null,
    subject: trimText(source.subject || '', 120),
    relation: trimText(source.relation || '', 120),
    object: trimText(source.object || '', 160),
    sourceType: trimText(source.sourceType || source.type || source.channel || source.source?.type || '', 120),
    supportOwner: trimText(source.supportOwner || source.owner || source.source?.owner || '', 120),
    sourceAuthority: trimText(source.sourceAuthority || source.authority || source.source?.authority || '', 120),
    text: trimText(source.text || source.textPreview || source.summary || source.content || source.label || '', 500),
    heldBackReason: trimText(source.heldBackReason || source.holdbackReason || source.reason || '', 200),
  });
}

function normalizeTraceArray(traceLike = []) {
  const keepTraceItem = (item) => item.raw !== false || item.ranked || item.selected || item.rendered;
  if (Array.isArray(traceLike)) {
    return traceLike.map((item) => normalizeCandidateTraceItem(item)).filter(keepTraceItem);
  }
  if (!traceLike || typeof traceLike !== 'object') return [];
  const explicitItems = [
    ...asArray(traceLike.trace),
    ...asArray(traceLike.items),
    ...asArray(traceLike.candidates),
  ];
  const stagedItems = [
    ...asArray(traceLike.rawCandidates).map((item) => ({ ...item, stage: item.stage || 'raw-only' })),
    ...asArray(traceLike.rankedCandidates).map((item) => ({ ...item, stage: item.stage || 'ranked-not-selected' })),
    ...asArray(traceLike.selectedCandidates).map((item) => ({ ...item, stage: item.stage || 'selected-held-back' })),
    ...asArray(traceLike.renderedCandidates).map((item) => ({ ...item, stage: item.stage || 'rendered' })),
  ];
  return [...explicitItems, ...stagedItems]
    .map((item) => normalizeCandidateTraceItem(item))
    .filter(keepTraceItem);
}

function hasNormalizedNeedle(haystack = '', needle = '') {
  const hay = normalizeForComparison(haystack);
  const value = normalizeForComparison(needle);
  if (!hay || !value) return false;
  return ` ${hay} `.includes(` ${value} `);
}

function idMatches(candidate = {}, expected = {}) {
  const candidateIds = uniqueStrings([
    candidate.id,
    candidate.sourceId,
    candidate.candidateId,
    ...asArray(candidate.ids),
    ...asArray(candidate.sourceIds),
  ], 20).map((item) => normalizeKey(item));
  const expectedIds = uniqueStrings([
    expected.id,
    ...asArray(expected.ids),
    ...asArray(expected.candidateIds),
    ...asArray(expected.sourceIds),
  ], 20).map((item) => normalizeKey(item));
  return candidateIds.some((id) => expectedIds.includes(id));
}

function textForCandidate(candidate = {}) {
  return [
    candidate.id,
    candidate.sourceId,
    candidate.subject,
    candidate.relation,
    candidate.object,
    candidate.sourceType,
    candidate.supportOwner,
    candidate.text,
  ].filter(Boolean).join(' ');
}

function normalizedWords(value = '') {
  return normalizeForComparison(value).split(/\s+/).filter(Boolean);
}

function relationMatchesCandidate(haystack = '', relation = '', {
  subject = '',
  objectNeedles = [],
} = {}) {
  if (!relation) return true;
  if (hasNormalizedNeedle(haystack, relation)) return true;

  const subjectWords = new Set(normalizedWords(subject));
  const objectWords = new Set(asArray(objectNeedles).flatMap((item) => normalizedWords(item)));
  const relationWords = normalizedWords(relation).filter((word) => (
    word.length >= 3
      && !RELATION_MATCH_STOPWORDS.has(word)
      && !subjectWords.has(word)
      && !objectWords.has(word)
  ));
  if (!relationWords.length) return false;
  return relationWords.some((word) => hasNormalizedNeedle(haystack, word));
}

function matchCandidateAgainstOracle(candidateLike = {}, expectedLike = {}) {
  const candidate = normalizeCandidateTraceItem(candidateLike);
  const expected = normalizeCandidateExpectation(expectedLike);
  if (!expected.id && !expected.ids && !expected.object && !expected.objectVariants && !expected.textNeedles) {
    return false;
  }
  if (idMatches(candidate, expected)) return true;

  const haystack = textForCandidate(candidate);
  const objectNeedles = expected.objectVariants && expected.objectVariants.length
    ? expected.objectVariants
    : asArray(expected.object);
  const objectHit = objectNeedles.some((needle) => hasNormalizedNeedle(haystack, needle));
  const textNeedleHit = asArray(expected.textNeedles).some((needle) => hasNormalizedNeedle(haystack, needle));
  const subjectRequired = Boolean(expected.subject);
  const relationRequired = Boolean(expected.relation);
  const subjectHit = !subjectRequired || hasNormalizedNeedle(haystack, expected.subject);
  const relationHit = !relationRequired || relationMatchesCandidate(haystack, expected.relation, {
    subject: expected.subject,
    objectNeedles,
  });

  if (objectHit && subjectHit && relationHit) return true;
  return textNeedleHit && subjectHit && relationHit;
}

function matchCandidateAgainstForbidden(candidateLike = {}, forbiddenLike = []) {
  return asArray(forbiddenLike).some((forbidden) => (
    matchCandidateAgainstOracle(candidateLike, forbidden)
  ));
}

function summarizeTraceItem(item = null) {
  if (!item) return null;
  return compactObject({
    id: item.id || item.sourceId || '',
    sourceType: item.sourceType || '',
    supportOwner: item.supportOwner || '',
    stage: item.stage || '',
    rank: item.rank,
    raw: item.raw,
    ranked: item.ranked,
    selected: item.selected,
    rendered: item.rendered,
    eligible: item.eligible,
    object: item.object || '',
    textPreview: trimText(item.text || '', 180),
    heldBackReason: item.heldBackReason || '',
  });
}

function buildClassificationResult({ normalizedCase, outcome, matchedExpected = null, matchedForbidden = null, traceCount = 0 } = {}) {
  return {
    schema: CANDIDATE_SURVIVAL_QA_SCHEMA,
    caseId: normalizedCase?.id || '',
    outcome,
    outcomeDefinition: CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS[outcome],
    expected: normalizedCase?.expected || {},
    support: normalizedCase?.support || {},
    matchedExpectedCandidate: summarizeTraceItem(matchedExpected),
    matchedForbiddenCandidate: summarizeTraceItem(matchedForbidden),
    traceCount,
  };
}

function classifyCandidateSurvival(caseLike = {}, traceLike = []) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const trace = normalizeTraceArray(traceLike);
  const forbiddenRendered = trace.find((item) => item.rendered && matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  if (forbiddenRendered) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_RENDERED,
      matchedForbidden: forbiddenRendered,
      traceCount: trace.length,
    });
  }
  const forbiddenSelected = trace.find((item) => item.selected && matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  if (forbiddenSelected) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_SELECTED,
      matchedForbidden: forbiddenSelected,
      traceCount: trace.length,
    });
  }
  if (normalizedCase.expectedSurvival === CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE,
      traceCount: trace.length,
    });
  }

  const expectedMatches = trace.filter((item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const rendered = expectedMatches.find((item) => item.rendered);
  if (rendered) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.RENDERED,
      matchedExpected: rendered,
      traceCount: trace.length,
    });
  }
  const selected = expectedMatches.find((item) => item.selected);
  if (selected) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK,
      matchedExpected: selected,
      traceCount: trace.length,
    });
  }
  const ranked = expectedMatches.find((item) => item.ranked);
  if (ranked) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED,
      matchedExpected: ranked,
      traceCount: trace.length,
    });
  }
  const raw = expectedMatches.find((item) => item.raw);
  if (raw) {
    return buildClassificationResult({
      normalizedCase,
      outcome: CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY,
      matchedExpected: raw,
      traceCount: trace.length,
    });
  }
  return buildClassificationResult({
    normalizedCase,
    outcome: CANDIDATE_SURVIVAL_OUTCOMES.MISSING,
    traceCount: trace.length,
  });
}

function summarizeCandidateSurvivalCases(cases = []) {
  const byOutcome = Object.fromEntries(Object.values(CANDIDATE_SURVIVAL_OUTCOMES).map((outcome) => [outcome, 0]));
  const caseIdsByOutcome = Object.fromEntries(Object.values(CANDIDATE_SURVIVAL_OUTCOMES).map((outcome) => [outcome, []]));
  const normalizedCases = asArray(cases).map((item) => {
    const outcome = normalizeOutcome(item?.outcome || item?.expectedSurvival || item?.survivalOutcome, '');
    return {
      id: trimText(item?.id || item?.caseId || '', 120),
      outcome,
    };
  }).filter((item) => item.outcome);

  for (const item of normalizedCases) {
    byOutcome[item.outcome] += 1;
    if (item.id) caseIdsByOutcome[item.outcome].push(item.id);
  }

  return {
    totalCases: normalizedCases.length,
    byOutcome,
    caseIdsByOutcome,
  };
}

function buildCandidateSurvivalQaFixture({
  generatedAt = new Date().toISOString(),
  cases = null,
} = {}) {
  const normalizedCases = (Array.isArray(cases) && cases.length ? cases : CANDIDATE_SURVIVAL_FIXTURE_CASES)
    .map((item) => normalizeCandidateSurvivalCase(item));
  return {
    schema: CANDIDATE_SURVIVAL_QA_SCHEMA,
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    outcomeDefinitions: buildOutcomeDefinitionList(),
    cases: normalizedCases,
    summary: summarizeCandidateSurvivalCases(normalizedCases),
    limits: [
      'Candidate survival is retrieval evidence, not answer-quality evidence.',
      'PromptTruth remains prompt-context receipt only.',
      'Semantic candidates remain discovery-only unless rendered or canonized elsewhere.',
      'This artifact does not change default rendered context limits.',
    ],
  };
}

module.exports = {
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS,
  CANDIDATE_SURVIVAL_FIXTURE_CASES,
  buildCandidateSurvivalQaFixture,
  classifyCandidateSurvival,
  matchCandidateAgainstForbidden,
  matchCandidateAgainstOracle,
  normalizeCandidateSurvivalCase,
  normalizeCandidateTraceItem,
  summarizeCandidateSurvivalCases,
};
