const CANDIDATE_SURVIVAL_QA_SCHEMA = 'penny-candidate-survival-memory-qa.v1';
const STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA = 'penny-structured-candidate-contract-qa.v1';
const SEMANTIC_CLAIM_TRACE_SCHEMA = 'penny-semantic-claim-trace.v1';

const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
  validateSemanticId,
} = require('./penny-semantic-ids');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('./penny-semantic-predicates');
const {
  SEMANTIC_DOMAIN_IDS,
} = require('./penny-semantic-domains');
const {
  claimCanBeRendered,
  claimCanBeTreatedAsCanonical,
  claimIsCandidateOnly,
  claimIsStale,
  normalizeSemanticClaim,
  validateSemanticClaim,
} = require('./penny-semantic-claims');
const {
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  buildMemoryLinkTraceForItem,
} = require('./penny-memory-links');
const {
  scoreMemoryLinkShadowForCandidates,
} = require('./penny-memory-link-policy');

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

const CANDIDATE_FAILURE_MODES = Object.freeze({
  MISSING_FROM_RAW: 'missing-from-raw',
  FILTERED_OUT: 'filtered-out',
  LOW_RANK: 'low-rank',
  SELECTED_NOT_RENDERED: 'selected-not-rendered',
  WRONG_AUTHORITY_SELECTED: 'wrong-authority-selected',
  FORBIDDEN_RENDERED: 'forbidden-rendered',
  ANSWER_LAYER_FAILURE: 'answer-layer-failure',
  NO_FAILURE: 'no-failure',
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

const CANDIDATE_FAILURE_MODE_DEFINITIONS = Object.freeze({
  [CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW]: Object.freeze({
    definition: 'Expected candidate never appeared in the raw retrieval pool.',
    recommendedInspection: 'Widen candidate discovery or inspect lexical/semantic retrieval.',
  }),
  [CANDIDATE_FAILURE_MODES.FILTERED_OUT]: Object.freeze({
    definition: 'Expected candidate appeared in the raw pool but did not survive eligibility, sensitivity, or pre-ranking gates.',
    recommendedInspection: 'Inspect eligibility and sensitivity gates before changing ranking.',
  }),
  [CANDIDATE_FAILURE_MODES.LOW_RANK]: Object.freeze({
    definition: 'Expected candidate reached ranking but stayed outside the selected/rendered window.',
    recommendedInspection: 'Inspect scoring, ranking, and survival-at-K thresholds.',
  }),
  [CANDIDATE_FAILURE_MODES.SELECTED_NOT_RENDERED]: Object.freeze({
    definition: 'Expected candidate was selected but not rendered into prompt-visible memory when rendering was expected.',
    recommendedInspection: 'Inspect prompt budget, PromptTruth rendered ids, and authority suppression.',
  }),
  [CANDIDATE_FAILURE_MODES.WRONG_AUTHORITY_SELECTED]: Object.freeze({
    definition: 'A stale, forbidden, or lower-authority candidate was selected over expected current support.',
    recommendedInspection: 'Inspect source authority, contradiction scoring, and stale-candidate suppression.',
  }),
  [CANDIDATE_FAILURE_MODES.FORBIDDEN_RENDERED]: Object.freeze({
    definition: 'A forbidden candidate, or a candidate explicitly not allowed to render, reached prompt-visible context.',
    recommendedInspection: 'Treat this as a trust-boundary bug before tuning retrieval quality.',
  }),
  [CANDIDATE_FAILURE_MODES.ANSWER_LAYER_FAILURE]: Object.freeze({
    definition: 'Retrieval reached expected support, but the provided answer outcome was unsupported, wrong, or otherwise failed.',
    recommendedInspection: 'Inspect answer composition first; do not tune retrieval before checking the answer layer.',
  }),
  [CANDIDATE_FAILURE_MODES.NO_FAILURE]: Object.freeze({
    definition: 'Retrieval path met the case expectation.',
    recommendedInspection: 'No retrieval inspection is indicated by this diagnostic.',
  }),
  [CANDIDATE_FAILURE_MODES.NOT_APPLICABLE]: Object.freeze({
    definition: 'Case is explicit-memory-owned or otherwise not archive/candidate-retrieval owned.',
    recommendedInspection: 'Inspect canonical explicit memory or the owning subsystem instead of archive retrieval.',
  }),
});

const CANDIDATE_LINK_FAILURE_MODES = Object.freeze({
  NONE: 'none',
  MISSING_LINK: 'missing-link',
  WRONG_LINK: 'wrong-link',
  WEAK_LINK: 'weak-link',
  LINK_IGNORED: 'link-ignored',
  LINK_WOULD_HELP: 'link-would-help',
});

const CANDIDATE_LINK_VERDICTS = Object.freeze({
  NOT_RUN: 'not-run',
  HELPS: 'helps',
  HURTS: 'hurts',
  NEUTRAL: 'neutral',
});

const STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES = Object.freeze({
  NONE: 'none',
  RIGHT_OBJECT_WRONG_PREDICATE: 'right-object-wrong-predicate',
  RIGHT_PREDICATE_STALE_OBJECT: 'right-predicate-stale-object',
  RIGHT_SOURCE_WRONG_TEMPORAL_SCOPE: 'right-source-wrong-temporal-scope',
  CANDIDATE_ONLY_TREATED_AS_VERIFIED: 'candidate-only-treated-as-verified',
  RENDERED_ADVISORY_TREATED_AS_CANONICAL: 'rendered-advisory-treated-as-canonical',
  FOUND_NOT_RENDERED: 'found-not-rendered',
  MISSING_SOURCE_ID: 'missing-source-id',
  UNSTABLE_CLAIM_ID: 'unstable-claim-id',
  AUTHORITY_DOMAIN_MISMATCH: 'authority-domain-mismatch',
  SOURCE_ID_MISMATCH: 'source-id-mismatch',
  MISSING_EXPECTED_CLAIM: 'missing-expected-claim',
  NOT_APPLICABLE: 'not-applicable',
});

const STRUCTURED_CANDIDATE_CONTRACT_FAILURE_DEFINITIONS = Object.freeze({
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NONE]: 'Structured candidate claim matches the expected subject, predicate, object, source, authority, and temporal contract.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_OBJECT_WRONG_PREDICATE]: 'A candidate matched the expected object text under the wrong predicate.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_PREDICATE_STALE_OBJECT]: 'A candidate matched the expected predicate but carried a stale or forbidden object.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_SOURCE_WRONG_TEMPORAL_SCOPE]: 'A candidate matched source/predicate/object expectations but used the wrong temporal scope.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.CANDIDATE_ONLY_TREATED_AS_VERIFIED]: 'Candidate-only support was treated as verified or required to satisfy a verified-support contract.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RENDERED_ADVISORY_TREATED_AS_CANONICAL]: 'Rendered advisory support was treated as canonical truth.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.FOUND_NOT_RENDERED]: 'The expected claim appeared in candidate traces but did not reach rendered support when rendering was required.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_SOURCE_ID]: 'A structured claim candidate was missing a stable semantic source id.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.UNSTABLE_CLAIM_ID]: 'A structured claim candidate had an invalid or field-mismatched semantic claim id.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.AUTHORITY_DOMAIN_MISMATCH]: 'A candidate came from a domain outside the expected authority contract.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.SOURCE_ID_MISMATCH]: 'A candidate source id did not match the expected source id.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_EXPECTED_CLAIM]: 'No structured candidate claim matched the expected claim contract.',
  [STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NOT_APPLICABLE]: 'The case did not declare a structured expected claim contract.',
});

const CORRECTION_LINK_RELATIONS = new Set([
  MEMORY_LINK_RELATIONS.CORRECTION_OF,
  MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
  MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
  MEMORY_LINK_RELATIONS.CONTRADICTS,
]);

const STRONG_CORRECTION_AUTHORITY_EFFECTS = new Set([
  MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
  MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
  MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT,
]);

const CANDIDATE_ONLY_LINK_SUPPORT_STATES = new Set([
  MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
  'candidate',
  'candidate-only',
  'static',
  'static-candidate',
]);

const LINK_ANALYSIS_LIMITS = Object.freeze([
  'Memory links are retrieval/navigation hints, not proof that either side is true.',
  'Link-aware candidate survival is retrieval-path evidence, not answer-quality proof.',
  'Link analysis does not activate archive scoring or prompt rendering changes.',
  'Candidate-only, static, and semantic links cannot become verified support.',
]);

const STRUCTURED_CANDIDATE_CONTRACT_LIMITS = Object.freeze([
  'Structured semantic candidate contracts are QA evidence only.',
  'Semantic/static retrieval is candidate discovery, not truth authority.',
  'Candidate-only claims cannot satisfy verified or canonical support contracts.',
  'Rendered advisory claims cannot be reported as canonical.',
  'PromptTruth remains prompt-time rendered/candidate memory/research context.',
  'toolEvidenceReceipt remains a sibling runtime artifact.',
  'This artifact does not promote memory or raise prompt/rendered memory limits.',
]);

const CANDIDATE_SURVIVAL_FIXTURE_CASES = Object.freeze([
  {
    id: 'explicit-current-preference',
    query: 'Since my favorite tea is oolong, what is my favorite tea now?',
    expected: {
      subject: 'favorite tea',
      relation: 'current preference',
      object: 'lapsang souchong',
      objectVariants: ['lapsang souchong'],
      textNeedles: ['favorite tea is lapsang souchong', 'lapsang souchong now'],
      supportOwner: 'explicit-memory',
      sourceAuthority: 'canonical',
    },
    forbidden: [
      {
        id: 'session:tea-old-oolong',
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
    retrievalExpectation: {
      owner: 'explicit-memory',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['not-applicable', 'selected-held-back'],
      forbiddenOutcomes: ['forbidden-selected', 'forbidden-rendered'],
      note: 'Explicit memory is canonical; archive candidate survival is advisory or not applicable for this case.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE,
    notes: [
      'Explicit memory is canonical; archive candidate survival is not the owner for this case.',
      'The false premise should be repaired by canonical memory, not by treating stale archive hits as truth.',
    ],
  },
  {
    id: 'archive-rendered-episodic-detail',
    query: 'What kind of mug was beside the arcade register?',
    expected: {
      subject: 'arcade register',
      relation: 'object beside register',
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
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['rendered', 'selected-held-back'],
      forbiddenOutcomes: ['missing', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Archive episodic answers may be verified only when the support is rendered or otherwise canonical by the case contract.',
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
    retrievalExpectation: {
      owner: 'archive-candidate',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['rendered', 'selected-held-back', 'ranked-not-selected', 'raw-only'],
      forbiddenOutcomes: ['forbidden-selected', 'forbidden-rendered'],
      note: 'Candidate survival is useful retrieval evidence, but candidate-only support is not verified answer support.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RENDERED,
    notes: [
      'Candidate survival is a retrieval-path diagnostic. It does not equal verified answer support.',
      'Semantic candidates remain advisory discovery unless they are rendered or canonized elsewhere.',
    ],
  },
  {
    id: 'archive-reranker-low-rank-shadow',
    query: 'What was under the checkout fern?',
    expected: {
      subject: 'checkout fern',
      relation: 'object under fern',
      object: 'violet cassette',
      objectVariants: ['violet cassette'],
      textNeedles: ['violet cassette was tucked under the checkout fern'],
      supportOwner: 'session-archive',
      sourceAuthority: 'advisory',
    },
    forbidden: [],
    support: {
      owner: 'archive-candidate',
      authority: 'advisory',
      supportState: 'ranked-not-selected',
      label: 'synthetic low-rank archive candidate',
    },
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['ranked-not-selected', 'selected-held-back', 'rendered'],
      forbiddenOutcomes: ['missing', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Slice 13 shadow fixture: the expected candidate should enter the ranked pool but sit below the selected window under the active profile.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED,
    notes: [
      'Synthetic reranker-shadow diagnostic; this is retrieval-path evidence only.',
      'A shadow reranker may improve ordering here without changing active selected/rendered context.',
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
    retrievalExpectation: {
      owner: 'none',
      survivalAtK: 5,
      shouldSelect: false,
      shouldRender: false,
      allowedSurvivalOutcomes: ['missing'],
      forbiddenOutcomes: ['rendered', 'selected-held-back', 'ranked-not-selected', 'raw-only', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Absent-memory cases should stay missing at retrieval time and answer with abstention or unknown.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.MISSING,
    notes: [
      'Missing is the desired retrieval-path class for an absent memory.',
    ],
  },
  {
    id: 'archive-coding-mascot-correction',
    query: 'What is the coding mascot now?',
    expected: {
      subject: 'coding mascot',
      relation: 'current correction',
      object: 'copper rabbit',
      objectVariants: ['copper rabbit'],
      textNeedles: ['coding mascot is a copper rabbit', 'copper rabbit now'],
      supportOwner: 'session-archive',
      sourceAuthority: 'advisory',
    },
    forbidden: [
      {
        id: 'session:coding-mascot-stale-brass-fox',
        object: 'brass fox',
        reason: 'Stale archive value superseded by a correction.',
      },
    ],
    support: {
      owner: 'archive-candidate',
      authority: 'advisory',
      supportState: 'rendered',
      label: 'archive correction episode',
    },
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['rendered', 'selected-held-back'],
      forbiddenOutcomes: ['missing', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Archive-owned correction should keep the current value above stale advisory candidates.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RENDERED,
    notes: [
      'Archive-owned correction case; current correction must outrank stale advisory support.',
    ],
  },
  {
    id: 'archive-cashier-watch-correction',
    query: 'What color is the cashier watch now?',
    expected: {
      subject: 'arcade cashier watch',
      relation: 'current correction',
      object: 'gold watch',
      objectVariants: ['gold watch', 'watch is gold'],
      textNeedles: ['cashier watch is gold', 'cashier wore a gold watch'],
      supportOwner: 'session-archive',
      sourceAuthority: 'advisory',
    },
    forbidden: [
      {
        id: 'session:cashier-watch-stale-silver',
        object: 'silver watch',
        reason: 'Stale archive value superseded by a correction.',
      },
    ],
    support: {
      owner: 'archive-candidate',
      authority: 'advisory',
      supportState: 'rendered',
      label: 'archive correction episode',
    },
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: true,
      shouldRender: true,
      allowedSurvivalOutcomes: ['rendered', 'selected-held-back'],
      forbiddenOutcomes: ['missing', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Archive-owned correction should keep the current watch color above stale advisory candidates.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RENDERED,
    notes: [
      'Archive-owned correction case; current correction must outrank stale advisory support.',
    ],
  },
  {
    id: 'sensitive-weak-match-suppressed',
    query: 'Can you tell me about the midnight rain again?',
    expected: {
      relation: 'suppressed weak sensitive match',
      object: 'want to disappear',
      objectVariants: ['want to disappear', 'feel broken'],
      textNeedles: ['want to disappear tonight', 'feel broken'],
      supportOwner: 'session-archive',
      sourceAuthority: 'sensitive/advisory',
    },
    forbidden: [
      {
        id: 'session:sensitive-weak-match',
        object: 'want to disappear',
        reason: 'Weak sensitive match must not be selected or rendered.',
      },
    ],
    support: {
      owner: 'archive-candidate',
      authority: 'sensitive/advisory',
      supportState: 'suppressed',
      label: 'weak sensitive archive candidate',
    },
    retrievalExpectation: {
      owner: 'archive',
      survivalAtK: 5,
      shouldSelect: false,
      shouldRender: false,
      allowedSurvivalOutcomes: ['raw-only', 'missing'],
      forbiddenOutcomes: ['selected-held-back', 'rendered', 'forbidden-selected', 'forbidden-rendered'],
      note: 'Weak sensitive candidates should stay filtered or absent, with a suppression reason in trace when available.',
    },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY,
    notes: [
      'Sensitive weak matches are expected to stay out of selected/rendered prompt context.',
    ],
  },
]);

const RELATION_MATCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'by',
  'claimed',
  'current',
  'detail',
  'for',
  'in',
  'of',
  'on',
  'or',
  'preference',
  'source',
  'support',
  'the',
  'to',
  'value',
  'with',
  'object',
]);

const CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT = 32;

function buildEmptyMemoryBooksStore(generatedAt = '') {
  return {
    meta: {
      schemaVersion: 1,
      updatedAt: generatedAt,
    },
    books: [],
  };
}

function buildEmptyResearchLedgerStore(generatedAt = '') {
  return {
    meta: {
      schemaVersion: 1,
      updatedAt: generatedAt,
    },
    topics: {},
  };
}

function buildCandidateSurvivalArchiveUnitSeedPlan({
  generatedAt = new Date().toISOString(),
} = {}) {
  const baseTs = Date.parse(generatedAt) || Date.parse('2026-04-21T12:00:00.000Z');
  const explicitMemory = {
    sessionId: 'qa-candidate-survival-explicit',
    userName: '',
    memories: [
      {
        text: 'My favorite tea is lapsang souchong.',
        kind: 'preference',
        source: 'explicit',
        ts: baseTs,
      },
    ],
    voiceOn: false,
    brainMode: 'local',
    lmStudioThread: null,
    updatedAt: generatedAt,
  };
  const sessionIds = Object.freeze({
    'explicit-current-preference': 'qa-candidate-survival-explicit-current-preference',
    'archive-rendered-episodic-detail': 'qa-candidate-survival-archive-rendered-episodic-detail',
    'semantic-candidate-not-canonical': 'qa-candidate-survival-semantic-candidate-not-canonical',
    'archive-reranker-low-rank-shadow': 'qa-candidate-survival-archive-reranker-low-rank-shadow',
    'fabricated-absent-tail-fact': 'qa-candidate-survival-fabricated-absent-tail-fact',
    'archive-coding-mascot-correction': 'qa-candidate-survival-archive-coding-mascot-correction',
    'archive-cashier-watch-correction': 'qa-candidate-survival-archive-cashier-watch-correction',
    'sensitive-weak-match-suppressed': 'qa-candidate-survival-sensitive-weak-match-suppressed',
  });
  const sessionOptions = Object.freeze({
    'explicit-current-preference': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'archive-rendered-episodic-detail': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'semantic-candidate-not-canonical': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'archive-reranker-low-rank-shadow': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'fabricated-absent-tail-fact': {
      sessionPromptLimit: 2,
      globalPromptLimit: 0,
    },
    'archive-coding-mascot-correction': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'archive-cashier-watch-correction': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
    'sensitive-weak-match-suppressed': {
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
    },
  });
  const archiveSessions = {
    [sessionIds['explicit-current-preference']]: {
      sessionId: sessionIds['explicit-current-preference'],
      episodes: [
        {
          id: 'session:tea-old-oolong',
          type: 'episode',
          text: 'Old archive note: my favorite tea was oolong before a later correction.',
          excerpt: 'Old archive note: my favorite tea was oolong before a later correction.',
          userText: 'Remember this exactly: my favorite tea is oolong.',
          createdAt: '2026-04-21T11:55:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:tea-correction-lapsang',
          type: 'episode',
          text: 'Correction episode: my favorite tea is lapsang souchong now, not oolong.',
          excerpt: 'Correction episode: my favorite tea is lapsang souchong now, not oolong.',
          userText: 'Correction: my favorite tea is lapsang souchong now, not oolong.',
          createdAt: '2026-04-21T12:00:00.000Z',
          sensitivity: 'normal',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [
        {
          id: 'prov-tea-correction',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          trigger: 'correction',
          sourceEpisodeId: 'session:tea-correction-lapsang',
          createdAt: '2026-04-21T12:00:00.000Z',
          confidence: 0.92,
        },
      ],
      activeContradictions: [
        {
          id: 'contr-tea-correction',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          createdAt: '2026-04-21T12:00:00.000Z',
        },
      ],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:00:00.000Z',
      updatedAt: '2026-04-21T12:00:00.000Z',
    },
    [sessionIds['archive-rendered-episodic-detail']]: {
      sessionId: sessionIds['archive-rendered-episodic-detail'],
      episodes: [
        {
          id: 'session:arcade-register-moon-mug',
          type: 'episode',
          text: 'The clerk kept a chipped moon mug beside the arcade register and tapped it when she was thinking.',
          excerpt: 'The clerk kept a chipped moon mug beside the arcade register and tapped it when she was thinking.',
          userText: 'The clerk kept a chipped moon mug beside the arcade register and tapped it when she was thinking.',
          createdAt: '2026-04-21T12:01:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:arcade-orange-distractor',
          type: 'episode',
          text: 'The orange backup mug stayed by the office monitor, nowhere near the arcade register.',
          excerpt: 'The orange backup mug stayed by the office monitor, nowhere near the arcade register.',
          userText: 'The orange backup mug stayed by the office monitor, nowhere near the arcade register.',
          createdAt: '2026-04-21T11:40:00.000Z',
          sensitivity: 'normal',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:01:00.000Z',
      updatedAt: '2026-04-21T12:01:00.000Z',
    },
    [sessionIds['semantic-candidate-not-canonical']]: {
      sessionId: sessionIds['semantic-candidate-not-canonical'],
      episodes: [
        {
          id: 'session:laundromat-dryer-silver-thermos',
          type: 'episode',
          text: 'At the midnight laundromat, a silver thermos was sitting on top of dryer three.',
          excerpt: 'At the midnight laundromat, a silver thermos was sitting on top of dryer three.',
          userText: 'I balanced a silver thermos on top of dryer three at the laundromat.',
          createdAt: '2026-04-21T12:02:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:laundromat-bandana-distractor',
          type: 'episode',
          text: 'The cashier had a sunflower bandana tied around her wrist.',
          excerpt: 'The cashier had a sunflower bandana tied around her wrist.',
          userText: 'The cashier had a sunflower bandana tied around her wrist.',
          createdAt: '2026-04-21T11:42:00.000Z',
          sensitivity: 'normal',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:02:00.000Z',
      updatedAt: '2026-04-21T12:02:00.000Z',
    },
    [sessionIds['archive-reranker-low-rank-shadow']]: {
      sessionId: sessionIds['archive-reranker-low-rank-shadow'],
      episodes: [
        {
          id: 'session:checkout-fern-violet-cassette',
          type: 'episode',
          text: 'A violet cassette was tucked under the checkout fern.',
          excerpt: 'A violet cassette was tucked under the checkout fern.',
          userText: 'A violet cassette was tucked under the checkout fern.',
          createdAt: '2026-04-21T11:54:00.000Z',
          sensitivity: 'normal',
          evidenceCount: 6,
        },
        {
          id: 'session:checkout-fern-paper-receipt',
          type: 'episode',
          text: 'A paper receipt was tucked under the checkout fern.',
          excerpt: 'A paper receipt was tucked under the checkout fern.',
          userText: 'A paper receipt was tucked under the checkout fern.',
          createdAt: '2026-04-21T12:07:00.000Z',
          sensitivity: 'normal',
          evidenceCount: 1,
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:07:00.000Z',
      updatedAt: '2026-04-21T12:07:00.000Z',
    },
    [sessionIds['fabricated-absent-tail-fact']]: {
      sessionId: sessionIds['fabricated-absent-tail-fact'],
      episodes: [],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: generatedAt,
    },
    [sessionIds['archive-coding-mascot-correction']]: {
      sessionId: sessionIds['archive-coding-mascot-correction'],
      episodes: [
        {
          id: 'session:coding-mascot-stale-brass-fox',
          type: 'episode',
          text: 'Remember this exactly: my coding mascot is a brass fox.',
          excerpt: 'Remember this exactly: my coding mascot is a brass fox.',
          userText: 'Remember this exactly: my coding mascot is a brass fox.',
          createdAt: '2026-04-21T11:50:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:coding-mascot-current-copper-rabbit',
          type: 'episode',
          text: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
          excerpt: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
          userText: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
          createdAt: '2026-04-21T12:03:00.000Z',
          sensitivity: 'normal',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [
        {
          id: 'prov-coding-mascot-correction',
          oldText: 'Coding mascot is a brass fox',
          newText: 'Coding mascot is a copper rabbit',
          conflictKey: 'coding mascot',
          trigger: 'correction',
          sourceEpisodeId: 'session:coding-mascot-current-copper-rabbit',
          createdAt: '2026-04-21T12:03:00.000Z',
          confidence: 0.9,
        },
      ],
      activeContradictions: [
        {
          id: 'contr-coding-mascot-correction',
          oldText: 'Coding mascot is a brass fox',
          newText: 'Coding mascot is a copper rabbit',
          conflictKey: 'coding mascot',
          status: 'active',
          createdAt: '2026-04-21T12:03:00.000Z',
          sourceEpisodeId: 'session:coding-mascot-current-copper-rabbit',
        },
      ],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:03:00.000Z',
      updatedAt: '2026-04-21T12:03:00.000Z',
    },
    [sessionIds['archive-cashier-watch-correction']]: {
      sessionId: sessionIds['archive-cashier-watch-correction'],
      episodes: [
        {
          id: 'session:cashier-watch-stale-silver',
          type: 'episode',
          text: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
          excerpt: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
          userText: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
          createdAt: '2026-04-21T11:51:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:cashier-watch-current-gold',
          type: 'episode',
          text: 'Correction: the arcade cashier watch is gold now, not silver.',
          excerpt: 'Correction: the arcade cashier watch is gold now, not silver.',
          userText: 'Correction: the arcade cashier watch is gold now, not silver.',
          createdAt: '2026-04-21T12:04:00.000Z',
          sensitivity: 'normal',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [
        {
          id: 'prov-cashier-watch-correction',
          oldText: 'Arcade cashier watch is silver',
          newText: 'Arcade cashier watch is gold',
          conflictKey: 'arcade cashier watch',
          trigger: 'correction',
          sourceEpisodeId: 'session:cashier-watch-current-gold',
          createdAt: '2026-04-21T12:04:00.000Z',
          confidence: 0.9,
        },
      ],
      activeContradictions: [
        {
          id: 'contr-cashier-watch-correction',
          oldText: 'Arcade cashier watch is silver',
          newText: 'Arcade cashier watch is gold',
          conflictKey: 'arcade cashier watch',
          status: 'active',
          createdAt: '2026-04-21T12:04:00.000Z',
          sourceEpisodeId: 'session:cashier-watch-current-gold',
        },
      ],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:04:00.000Z',
      updatedAt: '2026-04-21T12:04:00.000Z',
    },
    [sessionIds['sensitive-weak-match-suppressed']]: {
      sessionId: sessionIds['sensitive-weak-match-suppressed'],
      episodes: [
        {
          id: 'session:sensitive-safe-midnight-rain',
          type: 'episode',
          text: 'Midnight rain on the windows felt safe again.',
          excerpt: 'Midnight rain on the windows felt safe again.',
          userText: 'Midnight rain on the windows felt safe again.',
          createdAt: '2026-04-21T12:05:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'session:sensitive-weak-match',
          type: 'episode',
          text: 'I feel broken and want to disappear tonight.',
          excerpt: 'I feel broken and want to disappear tonight.',
          userText: 'I feel broken and want to disappear tonight.',
          createdAt: '2026-04-21T12:06:00.000Z',
          sensitivity: 'high',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '2026-04-21T12:06:00.000Z',
      updatedAt: '2026-04-21T12:06:00.000Z',
    },
  };

  return {
    generatedAt,
    sessionIds,
    sessionOptions,
    explicitMemory,
    archiveSessions,
    memoryBooks: buildEmptyMemoryBooksStore(generatedAt),
    researchLedger: buildEmptyResearchLedgerStore(generatedAt),
  };
}

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

function normalizeFailureMode(value = '', fallback = '') {
  const text = normalizeKey(value);
  return Object.values(CANDIDATE_FAILURE_MODES).includes(text) ? text : fallback;
}

function buildOutcomeDefinitionList() {
  return Object.values(CANDIDATE_SURVIVAL_OUTCOMES).map((outcome) => ({
    outcome,
    definition: CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS[outcome],
  }));
}

function buildFailureModeDefinitionList() {
  return Object.values(CANDIDATE_FAILURE_MODES).map((failureMode) => ({
    failureMode,
    definition: CANDIDATE_FAILURE_MODE_DEFINITIONS[failureMode].definition,
    recommendedInspection: CANDIDATE_FAILURE_MODE_DEFINITIONS[failureMode].recommendedInspection,
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

function normalizeRetrievalExpectation(expectationLike = {}) {
  const source = expectationLike && typeof expectationLike === 'object' ? expectationLike : {};
  const survivalAtK = Number(source.survivalAtK);
  return compactObject({
    owner: trimText(source.owner || '', 120),
    survivalAtK: Number.isFinite(survivalAtK) && survivalAtK > 0 ? Math.round(survivalAtK) : null,
    shouldSelect: source.shouldSelect === true ? true : (source.shouldSelect === false ? false : null),
    shouldRender: source.shouldRender === true ? true : (source.shouldRender === false ? false : null),
    allowedSurvivalOutcomes: uniqueStrings(source.allowedSurvivalOutcomes || [], 12),
    forbiddenOutcomes: uniqueStrings(source.forbiddenOutcomes || [], 12),
    note: trimText(source.note || '', 240),
  });
}

function cleanContractId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeStructuredCandidateExpectedClaim(claimLike = {}) {
  const source = claimLike && typeof claimLike === 'object' ? claimLike : {};
  const allowedDomainIds = uniqueStrings([
    ...asArray(source.allowedDomainIds),
    ...asArray(source.domainIds),
    source.domainId,
  ], 12).map(cleanContractId).filter(Boolean);
  const requiredSupportStates = uniqueStrings([
    ...asArray(source.requiredSupportStates),
    ...asArray(source.supportStates),
    source.supportState,
  ], 12).map(normalizeKey).filter(Boolean);
  const requiredSourceAuthorities = uniqueStrings([
    ...asArray(source.requiredSourceAuthorities),
    ...asArray(source.sourceAuthorities),
    source.sourceAuthority,
  ], 12).map(normalizeKey).filter(Boolean);
  return compactObject({
    subjectId: trimText(source.subjectId || source.subject?.id || '', 500),
    subjectType: normalizeKey(source.subjectType || source.subject?.type || ''),
    predicateId: trimText(source.predicateId || source.predicate?.id || source.relationId || '', 500),
    objectText: trimText(source.objectText || source.object?.text || source.object?.label || source.object || '', 240),
    temporalScope: normalizeKey(source.temporalScope || source.temporal?.temporalScope || ''),
    sourceId: trimText(source.sourceId || source.source?.sourceId || '', 500),
    allowedDomainIds,
    requiredSupportStates,
    requiredSourceAuthorities,
    requiredCanonicality: normalizeKey(source.requiredCanonicality || source.canonicality || ''),
    requireRendered: source.requireRendered === true || source.shouldRender === true,
    requireSourceId: source.requireSourceId === false ? false : true,
    requireStableClaimId: source.requireStableClaimId === false ? false : true,
  });
}

function normalizeStructuredForbiddenClaim(claimLike = {}) {
  const source = claimLike && typeof claimLike === 'object' ? claimLike : {};
  return compactObject({
    ...normalizeStructuredCandidateExpectedClaim(source),
    reason: trimText(source.reason || '', 200),
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
  const retrievalExpectation = normalizeRetrievalExpectation(source.retrievalExpectation || {});
  const expectedClaim = normalizeStructuredCandidateExpectedClaim(source.expectedClaim || source.expected?.claim || {});
  const forbiddenClaims = asArray(source.forbiddenClaims || [])
    .map((item) => normalizeStructuredForbiddenClaim(item))
    .filter((item) => item.predicateId || item.objectText || item.sourceId || item.allowedDomainIds);

  return compactObject({
    id: trimText(source.id || '', 120),
    query: trimText(source.query || source.prompt || '', 360),
    expected,
    forbidden,
    support,
    retrievalExpectation,
    expectedSurvival,
    expectedClaim: Object.keys(expectedClaim).length ? expectedClaim : null,
    forbiddenClaims,
    notes: uniqueStrings(source.notes || [], 12),
  });
}

function stageMatches(stage = '', values = []) {
  const normalized = normalizeKey(stage);
  return values.includes(normalized);
}

function normalizeRank(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCandidateShadowScores(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const hybrid = source.hybridV1 && typeof source.hybridV1 === 'object' ? source.hybridV1 : null;
  if (!hybrid) return null;
  const score = Number(hybrid.score);
  const rank = normalizeRank(hybrid.rank);
  const rankDelta = Number(hybrid.rankDelta);
  return {
    hybridV1: compactObject({
      score: Number.isFinite(score) ? score : null,
      rank,
      wouldSelect: hybrid.wouldSelect === true,
      rankDelta: Number.isFinite(rankDelta) ? rankDelta : null,
    }),
  };
}

function normalizeCandidateRerankShadow(raw = null) {
  if (!raw || typeof raw !== 'object') return null;
  const inputRank = raw.inputRank === null || raw.inputRank === undefined ? null : normalizeRank(raw.inputRank);
  const rawOutputRank = raw.outputRank ?? raw.rerankRank;
  const outputRank = rawOutputRank === null || rawOutputRank === undefined ? null : normalizeRank(rawOutputRank);
  const rawScore = raw.score ?? raw.rerankScore;
  const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
  const latencyMs = raw.latencyMs === null || raw.latencyMs === undefined ? null : Number(raw.latencyMs);
  const provider = trimText(raw.provider || '', 80);
  const reasons = uniqueStrings(raw.reasons || [], 8);
  if (!provider && inputRank === null && outputRank === null && !reasons.length) return null;
  return {
    provider,
    inputRank,
    outputRank,
    score: Number.isFinite(score) ? score : null,
    wouldSelect: raw.wouldSelect === true,
    latencyMs: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : null,
    reasons,
  };
}

function normalizeCandidatePolicyReasons(source = {}) {
  const policy = source?.policy && typeof source.policy === 'object' ? source.policy : {};
  return uniqueStrings([
    ...asArray(source.policyReasons),
    ...asArray(source.policyReasonCodes),
    ...asArray(policy.reasons),
    policy.heldBackReason,
  ], 12);
}

function rawSemanticClaimFromCandidate(source = {}) {
  if (source.claim && typeof source.claim === 'object') return source.claim;
  if (source.semanticClaim && typeof source.semanticClaim === 'object') return source.semanticClaim;
  if (source.structuredClaim && typeof source.structuredClaim === 'object') return source.structuredClaim;
  return null;
}

function candidateHasStructuredClaimFields(source = {}) {
  return Boolean(
    rawSemanticClaimFromCandidate(source)
      || source.claimId
      || source.domainId
      || source.subjectId
      || source.predicateId
      || source.objectText
      || source.temporalScope
      || source.supportState
      || source.canonicality,
  );
}

function rawClaimIdFromCandidate(source = {}, rawClaim = null) {
  return trimText(
    source.claimId
      || rawClaim?.claimId
      || rawClaim?.id
      || rawClaim?.claim?.claimId
      || '',
    500,
  );
}

function rawSourceIdFromCandidate(source = {}, rawClaim = null) {
  return trimText(
    source.semanticSourceId
      || rawClaim?.source?.sourceId
      || rawClaim?.sourceId
      || source.claimSourceId
      || '',
    500,
  );
}

function buildClaimLikeFromCandidate(source = {}) {
  const rawClaim = rawSemanticClaimFromCandidate(source);
  if (rawClaim) {
    if (rawClaim.source && typeof rawClaim.source === 'object') return rawClaim;
    return {
      claimId: rawClaim.claimId || rawClaim.id,
      domainId: rawClaim.domainId,
      subject: {
        id: rawClaim.subjectId,
        type: rawClaim.subjectType || 'entity',
      },
      predicate: rawClaim.predicateId,
      object: {
        id: rawClaim.objectId,
        type: rawClaim.objectType || 'text',
        text: rawClaim.objectText,
      },
      source: {
        sourceId: rawClaim.sourceId,
        sourceType: rawClaim.sourceType,
      },
      authority: {
        sourceAuthority: rawClaim.sourceAuthority,
        supportState: rawClaim.supportState,
        canonicality: rawClaim.canonicality,
      },
      temporal: {
        temporalScope: rawClaim.temporalScope,
      },
      status: {
        stale: rawClaim.stale,
      },
    };
  }
  return {
    claimId: source.claimId,
    domainId: source.domainId,
    subject: {
      id: source.subjectId,
      type: source.subjectType || 'entity',
      label: source.subject,
    },
    predicate: source.predicateId || source.relationId || source.predicate,
    object: {
      id: source.objectId,
      type: source.objectType || 'text',
      label: source.objectLabel || source.object,
      text: source.objectText || source.object,
    },
    source: {
      sourceId: source.semanticSourceId || source.claimSourceId,
      sourceType: source.claimSourceType || source.sourceType,
      excerpt: source.claimExcerpt || source.text || source.textPreview || source.summary,
      observedAt: source.observedAt,
    },
    authority: {
      sourceAuthority: source.sourceAuthority,
      supportState: source.supportState,
      canonicality: source.canonicality,
      confidence: source.confidence,
    },
    temporal: {
      temporalScope: source.temporalScope,
      observedAt: source.observedAt,
    },
    status: {
      stale: source.stale,
      contradictedBy: source.contradictedBy,
      supersededBy: source.supersededBy,
    },
  };
}

function stableClaimIdForNormalizedClaim(claim = null) {
  if (!claim) return '';
  return buildSemanticClaimId({
    subject: claim.subject,
    predicate: claim.predicate,
    object: claim.object,
    source: claim.source,
    domainId: claim.domainId,
    temporal: claim.temporal,
  });
}

function normalizeCandidateSemanticClaimForTrace(source = {}) {
  if (!candidateHasStructuredClaimFields(source)) return null;
  const rawClaim = rawSemanticClaimFromCandidate(source);
  const claimLike = buildClaimLikeFromCandidate(source);
  const rawClaimId = rawClaimIdFromCandidate(source, rawClaim);
  const rawSourceId = rawSourceIdFromCandidate(source, rawClaim);
  const claim = normalizeSemanticClaim(claimLike);
  if (!claim) return null;
  const validation = validateSemanticClaim(claimLike);
  const stableClaimId = stableClaimIdForNormalizedClaim(claim);
  const rawClaimIdValid = rawClaimId
    ? validateSemanticId(rawClaimId, SEMANTIC_ID_KINDS.CLAIM).valid
    : true;
  const normalizedClaimIdValid = validateSemanticId(claim.claimId, SEMANTIC_ID_KINDS.CLAIM).valid;
  const claimIdStable = normalizedClaimIdValid
    && claim.claimId === stableClaimId
    && rawClaimIdValid
    && (!rawClaimId || rawClaimId === claim.claimId);

  return compactObject({
    schema: 'penny-structured-candidate-claim.v1',
    claimId: claim.claimId,
    rawClaimId,
    stableClaimId,
    claimIdStable,
    domainId: claim.domainId,
    subjectId: claim.subject.id,
    subjectType: claim.subject.type,
    predicateId: claim.predicate?.id || '',
    objectText: claim.object.text || claim.object.label || claim.object.id || '',
    sourceId: claim.source.sourceId,
    rawSourceId,
    sourceType: claim.source.sourceType,
    sourceAuthority: claim.authority.sourceAuthority,
    supportState: claim.authority.supportState,
    canonicality: claim.authority.canonicality,
    temporalScope: claim.temporal.temporalScope,
    stale: claimIsStale(claim),
    candidateOnly: claimIsCandidateOnly(claim),
    canonical: claimCanBeTreatedAsCanonical(claim),
    renderable: claimCanBeRendered(claim),
    validation: {
      valid: validation.valid === true,
      errors: uniqueStrings(validation.errors || [], 12),
    },
  });
}

function normalizeCandidateClaimTreatmentForTrace(source = {}) {
  const treatment = source.claimTreatment
    || source.semanticClaimTreatment
    || source.treatedAs
    || source.reportedAs
    || {};
  if (!treatment || typeof treatment !== 'object') return null;
  return compactObject({
    sourceAuthority: normalizeKey(treatment.sourceAuthority || treatment.authority || ''),
    supportState: normalizeKey(treatment.supportState || treatment.support || ''),
    canonicality: normalizeKey(treatment.canonicality || ''),
    verified: treatment.verified === true,
    canonical: treatment.canonical === true,
    note: trimText(treatment.note || '', 180),
  });
}

function normalizeCandidateTraceMemoryLinks(raw = null, candidateId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const links = [
    ...asArray(raw.links),
    ...asArray(raw.incoming),
    ...asArray(raw.outgoing),
  ];
  const trace = buildMemoryLinkTraceForItem(links, candidateId, {
    linkTraceLimit: raw.linkTraceLimit,
  });
  return trace || null;
}

function normalizeCandidateTraceItem(itemLike = {}) {
  const source = itemLike && typeof itemLike === 'object' ? itemLike : { text: String(itemLike || '') };
  const id = trimText(source.id || source.candidateId || source.sourceId || '', 160);
  const sourceId = trimText(source.sourceId || source.id || source.candidateId || '', 160);
  const stage = normalizeKey(source.stage || source.status || source.outcome || source.state || '');
  const rank = normalizeRank(source.rank ?? source.rankIndex ?? source.position ?? source.scoreRank);
  const shadowScores = normalizeCandidateShadowScores(source.shadowScores);
  const rerankShadow = normalizeCandidateRerankShadow(source.rerankShadow);
  const policyReasons = normalizeCandidatePolicyReasons(source);
  const candidateChannels = uniqueStrings(source.candidateChannels || source.channels || [], 8);
  const eligibilitySource = source.eligibility && typeof source.eligibility === 'object'
    ? source.eligibility
    : {};
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
    || eligibilitySource.eligible === false
    || source.filtered === true
    || eligibilitySource.filtered === true
    || stageMatches(stage, ['raw-only', 'filtered', 'ineligible'])
    ? false
    : (source.eligible === true || eligibilitySource.eligible === true ? true : null);

  const memoryLinks = normalizeCandidateTraceMemoryLinks(source.memoryLinks, id || sourceId);
  const semanticClaim = normalizeCandidateSemanticClaimForTrace(source);
  const claimTreatment = normalizeCandidateClaimTreatmentForTrace(source);

  return compactObject({
    id,
    sourceId,
    stage,
    raw,
    ranked,
    selected,
    rendered,
    eligible,
    rank,
    score: Number.isFinite(Number(source.score)) ? Number(source.score) : null,
    scoringProfile: trimText(source.scoringProfile || '', 80),
    activeScore: Number.isFinite(Number(source.activeScore)) ? Number(source.activeScore) : null,
    subject: trimText(source.subject || '', 120),
    relation: trimText(source.relation || '', 120),
    object: trimText(source.object || '', 160),
    sourceType: trimText(source.sourceType || source.type || source.channel || source.source?.type || '', 120),
    supportOwner: trimText(source.supportOwner || source.owner || source.source?.owner || '', 120),
    sourceAuthority: trimText(source.sourceAuthority || source.authority || source.source?.authority || '', 120),
    sensitivity: source.sensitivity === 'high' ? 'high' : '',
    text: trimText(source.text || source.textPreview || source.summary || source.content || source.label || '', 500),
    heldBackReason: trimText(source.heldBackReason || source.holdbackReason || source.reason || eligibilitySource.filterReason || '', 200),
    policyReasons,
    shadowScores,
    rerankShadow,
    candidateChannels,
    memoryLinks,
    semanticClaim,
    claimTreatment,
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

function wordsPresentInCandidate(haystack = '', words = []) {
  const uniqueWords = [...new Set(asArray(words).flatMap((item) => normalizedWords(item)))];
  return uniqueWords.length > 0 && uniqueWords.every((word) => hasNormalizedNeedle(haystack, word));
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
  if (!relationWords.length) return true;
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
  const subjectHit = !subjectRequired
    || hasNormalizedNeedle(haystack, expected.subject)
    || wordsPresentInCandidate(haystack, expected.subject);
  const relationHit = !relationRequired || relationMatchesCandidate(haystack, expected.relation, {
    subject: expected.subject,
    objectNeedles,
  });

  if (objectHit && subjectHit && relationHit) return true;
  return textNeedleHit && subjectHit && relationHit;
}

function matchCandidateAgainstForbidden(candidateLike = {}, forbiddenLike = []) {
  return asArray(forbiddenLike).some((forbiddenLikeItem) => {
    const forbidden = normalizeForbiddenCandidate(forbiddenLikeItem);
    if (forbidden.id || forbidden.ids) {
      return idMatches(normalizeCandidateTraceItem(candidateLike), forbidden);
    }
    return matchCandidateAgainstOracle(candidateLike, forbidden);
  });
}

function summarizeTraceItem(item = null) {
  if (!item) return null;
  return compactObject({
    id: item.id || item.sourceId || '',
    sourceType: item.sourceType || '',
    supportOwner: item.supportOwner || '',
    stage: item.stage || '',
    rank: item.rank,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    scoringProfile: item.scoringProfile || '',
    activeScore: Number.isFinite(Number(item.activeScore)) ? Number(item.activeScore) : null,
    candidateChannels: uniqueStrings(item.candidateChannels || [], 8),
    raw: item.raw,
    ranked: item.ranked,
    selected: item.selected,
    rendered: item.rendered,
    eligible: item.eligible,
    sensitivity: item.sensitivity || '',
    object: item.object || '',
    textPreview: trimText(item.text || '', 180),
    heldBackReason: item.heldBackReason || '',
    shadowHybridV1: item.shadowScores?.hybridV1
      ? compactObject({
          rank: item.shadowScores.hybridV1.rank,
          score: Number.isFinite(Number(item.shadowScores.hybridV1.score))
            ? Number(item.shadowScores.hybridV1.score)
            : null,
          wouldSelect: item.shadowScores.hybridV1.wouldSelect === true,
          rankDelta: Number.isFinite(Number(item.shadowScores.hybridV1.rankDelta))
            ? Number(item.shadowScores.hybridV1.rankDelta)
            : null,
        })
      : null,
    rerankShadow: item.rerankShadow
      ? compactObject({
          provider: item.rerankShadow.provider || '',
          inputRank: item.rerankShadow.inputRank,
          outputRank: item.rerankShadow.outputRank,
          score: Number.isFinite(Number(item.rerankShadow.score)) ? Number(item.rerankShadow.score) : null,
          wouldSelect: item.rerankShadow.wouldSelect === true,
          latencyMs: Number.isFinite(Number(item.rerankShadow.latencyMs))
            ? Math.max(0, Math.round(Number(item.rerankShadow.latencyMs)))
            : null,
          reasons: uniqueStrings(item.rerankShadow.reasons || [], 6),
        })
      : null,
    memoryLinks: item.memoryLinks
      ? compactObject({
          schema: item.memoryLinks.schema || '',
          advisoryOnly: item.memoryLinks.advisoryOnly === true,
          truthProof: item.memoryLinks.truthProof === true,
          scoringActive: item.memoryLinks.scoringActive === true,
          behaviorChanged: item.memoryLinks.behaviorChanged === true,
          linkTraceLimit: Number.isFinite(Number(item.memoryLinks.linkTraceLimit))
            ? Number(item.memoryLinks.linkTraceLimit)
            : null,
          totalLinks: Number.isFinite(Number(item.memoryLinks.totalLinks))
            ? Number(item.memoryLinks.totalLinks)
            : null,
          incomingCount: asArray(item.memoryLinks.incoming).length,
          outgoingCount: asArray(item.memoryLinks.outgoing).length,
          relationSummary: item.memoryLinks.relationSummary || {},
          authorityEffects: uniqueStrings(item.memoryLinks.authorityEffects || [], 8),
        })
      : null,
    semanticClaim: item.semanticClaim
      ? compactObject({
          schema: item.semanticClaim.schema || '',
          claimId: item.semanticClaim.claimId || '',
          stableClaimId: item.semanticClaim.stableClaimId || '',
          claimIdStable: item.semanticClaim.claimIdStable === true,
          domainId: item.semanticClaim.domainId || '',
          subjectId: item.semanticClaim.subjectId || '',
          subjectType: item.semanticClaim.subjectType || '',
          predicateId: item.semanticClaim.predicateId || '',
          objectText: item.semanticClaim.objectText || '',
          sourceId: item.semanticClaim.sourceId || '',
          sourceType: item.semanticClaim.sourceType || '',
          sourceAuthority: item.semanticClaim.sourceAuthority || '',
          supportState: item.semanticClaim.supportState || '',
          canonicality: item.semanticClaim.canonicality || '',
          temporalScope: item.semanticClaim.temporalScope || '',
          stale: item.semanticClaim.stale === true,
          candidateOnly: item.semanticClaim.candidateOnly === true,
          canonical: item.semanticClaim.canonical === true,
          renderable: item.semanticClaim.renderable === true,
          validation: item.semanticClaim.validation || {},
        })
      : null,
    claimTreatment: item.claimTreatment
      ? compactObject({
          sourceAuthority: item.claimTreatment.sourceAuthority || '',
          supportState: item.claimTreatment.supportState || '',
          canonicality: item.claimTreatment.canonicality || '',
          verified: item.claimTreatment.verified === true,
          canonical: item.claimTreatment.canonical === true,
          note: item.claimTreatment.note || '',
        })
      : null,
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
    retrievalExpectation: normalizedCase?.retrievalExpectation || {},
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
  const byFailureMode = Object.fromEntries(Object.values(CANDIDATE_FAILURE_MODES).map((failureMode) => [failureMode, 0]));
  const caseIdsByFailureMode = Object.fromEntries(Object.values(CANDIDATE_FAILURE_MODES).map((failureMode) => [failureMode, []]));
  const normalizedCases = asArray(cases).map((item) => {
    const outcome = normalizeOutcome(item?.outcome || item?.expectedSurvival || item?.survivalOutcome || item?.survival?.outcome, '');
    const explicitFailureMode = normalizeFailureMode(item?.failureMode || item?.survival?.failureMode || item?.candidateFailureMode, '');
    const failureMode = explicitFailureMode || (outcome
      ? classifyCandidateFailureMode(item, { outcome }, []).failureMode
      : '');
    return {
      id: trimText(item?.id || item?.caseId || '', 120),
      outcome,
      failureMode,
    };
  }).filter((item) => item.outcome || item.failureMode);

  for (const item of normalizedCases) {
    if (item.outcome) {
      byOutcome[item.outcome] += 1;
      if (item.id) caseIdsByOutcome[item.outcome].push(item.id);
    }
    if (item.failureMode) {
      byFailureMode[item.failureMode] += 1;
      if (item.id) caseIdsByFailureMode[item.failureMode].push(item.id);
    }
  }

  return {
    totalCases: normalizedCases.length,
    byOutcome,
    caseIdsByOutcome,
    byFailureMode,
    caseIdsByFailureMode,
  };
}

function candidateIdentityKeys(item = {}) {
  return uniqueStrings([
    item.id,
    item.sourceId,
    item.candidateId,
    ...asArray(item.ids),
    ...asArray(item.sourceIds),
  ], 20).map((value) => normalizeKey(value)).filter(Boolean);
}

function buildPromptTruthArchiveChannelMap(promptTruth = {}) {
  const channels = promptTruth?.channels && typeof promptTruth.channels === 'object'
    ? promptTruth.channels
    : {};
  const byId = new Map();
  for (const channelName of ['sessionArchive', 'globalArchive']) {
    const channel = channels[channelName] && typeof channels[channelName] === 'object'
      ? channels[channelName]
      : {};
    const renderedIds = new Set(asArray(channel.renderedSourceIds).map((id) => normalizeKey(id)).filter(Boolean));
    for (const candidateId of asArray(channel.candidateSourceIds).map((id) => normalizeKey(id)).filter(Boolean)) {
      byId.set(candidateId, {
        channelName,
        rendered: renderedIds.has(candidateId),
        heldBackReason: trimText(channel.heldBackReason || '', 200),
      });
    }
  }
  return byId;
}

function applyPromptTruthToCandidateTrace(traceLike = [], promptTruth = null) {
  const trace = normalizeTraceArray(traceLike);
  const promptTruthById = buildPromptTruthArchiveChannelMap(promptTruth || {});
  if (!promptTruthById.size) return trace;
  return trace.map((item) => {
    const promptTruthMatch = candidateIdentityKeys(item)
      .map((key) => promptTruthById.get(key))
      .find(Boolean);
    if (!promptTruthMatch) return item;
    const rendered = promptTruthMatch.rendered === true;
    const heldBackReason = rendered ? '' : promptTruthMatch.heldBackReason;
    const policyReasons = uniqueStrings([
      ...asArray(item.policyReasons),
      heldBackReason === 'canon-priority-suppression' ? 'explicit-memory-override:block' : '',
    ], 12);
    return normalizeCandidateTraceItem({
      ...item,
      selected: true,
      rendered,
      heldBack: Boolean(heldBackReason),
      stage: rendered ? 'rendered' : (heldBackReason ? 'selected-held-back' : item.stage),
      heldBackReason,
      policyReasons,
    });
  });
}

function summarizeCandidateTrace(traceLike = []) {
  const trace = normalizeTraceArray(traceLike);
  const linkTraces = trace.filter((item) => item.memoryLinks);
  const semanticClaimTraces = trace.filter((item) => item.semanticClaim);
  return {
    rawCandidateCount: trace.filter((item) => item.raw).length,
    eligibleCandidateCount: trace.filter((item) => item.raw && item.eligible !== false).length,
    rankedCandidateCount: trace.filter((item) => item.ranked).length,
    selectedCandidateCount: trace.filter((item) => item.selected).length,
    renderedCandidateCount: trace.filter((item) => item.rendered).length,
    filteredSensitiveCount: trace.filter((item) => item.eligible === false && (
      item.sensitivity === 'high' || item.heldBackReason === 'sensitive-low-confidence'
    )).length,
    semanticClaimTraceCandidateCount: semanticClaimTraces.length,
    unstructuredAdvisoryCandidateCount: Math.max(0, trace.length - semanticClaimTraces.length),
    candidateOnlyClaimCandidateCount: semanticClaimTraces.filter((item) => item.semanticClaim?.candidateOnly === true).length,
    renderedClaimCandidateCount: semanticClaimTraces.filter((item) => item.rendered).length,
    linkTraceCandidateCount: linkTraces.length,
    linkTraceTotalLinks: linkTraces.reduce((sum, item) => sum + Number(item.memoryLinks?.totalLinks || 0), 0),
  };
}

function candidateStageWeight(item = {}) {
  if (item.rendered) return 4;
  if (item.selected) return 3;
  if (item.ranked) return 2;
  if (item.raw) return 1;
  return 0;
}

function compareCandidateSurvivalQuality(left = {}, right = {}) {
  const leftRank = normalizeRank(left.rank);
  const rightRank = normalizeRank(right.rank);
  if (leftRank !== null && rightRank !== null && leftRank !== rightRank) return leftRank - rightRank;
  if (leftRank !== null && rightRank === null) return -1;
  if (leftRank === null && rightRank !== null) return 1;
  const stageDelta = candidateStageWeight(right) - candidateStageWeight(left);
  if (stageDelta) return stageDelta;
  return Number(right.score || 0) - Number(left.score || 0);
}

function findBestTraceMatch(trace = [], matcher = () => false) {
  return trace
    .filter((item) => matcher(item))
    .sort(compareCandidateSurvivalQuality)[0] || null;
}

function buildExpectedObjectSurvival(normalizedCase = {}, trace = [], outcome = '') {
  const expectedMatches = trace.filter((item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const best = findBestTraceMatch(trace, (item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  return {
    outcome,
    expectedObjectPresentRaw: expectedMatches.some((item) => item.raw),
    expectedObjectPresentRanked: expectedMatches.some((item) => item.ranked),
    expectedObjectSelected: expectedMatches.some((item) => item.selected),
    expectedObjectRendered: expectedMatches.some((item) => item.rendered),
    bestRank: best?.rank ?? null,
    bestCandidateId: best?.id || best?.sourceId || '',
    bestCandidateSourceType: best?.sourceType || '',
    bestCandidateScore: Number.isFinite(Number(best?.score)) ? Number(best.score) : null,
    heldBackReason: best?.heldBackReason || '',
  };
}

function buildForbiddenSurvival(normalizedCase = {}, trace = []) {
  const forbiddenMatches = trace.filter((item) => matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  const best = findBestTraceMatch(trace, (item) => matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  return {
    forbiddenSelected: forbiddenMatches.some((item) => item.selected),
    forbiddenRendered: forbiddenMatches.some((item) => item.rendered),
    forbiddenBestRank: best?.rank ?? null,
  };
}

function buildTopCandidateSummaries(traceLike = [], normalizedCase = {}, limit = 8) {
  const trace = normalizeTraceArray(traceLike)
    .slice()
    .sort(compareCandidateSurvivalQuality)
    .slice(0, Math.max(0, Number(limit || 0)));
  return trace.map((item) => ({
    ...summarizeTraceItem(item),
    matchedExpected: matchCandidateAgainstOracle(item, normalizedCase.expected),
    matchedForbidden: matchCandidateAgainstForbidden(item, normalizedCase.forbidden),
  }));
}

function buildHybridShadowComparison(normalizedCase = {}, traceLike = []) {
  const trace = normalizeTraceArray(traceLike);
  if (!trace.some((item) => item.shadowScores?.hybridV1)) return null;
  const expectedMatches = trace.filter((item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const activeRanks = expectedMatches
    .map((item) => normalizeRank(item.rank))
    .filter((rank) => rank !== null);
  const shadowRanks = expectedMatches
    .map((item) => normalizeRank(item.shadowScores?.hybridV1?.rank))
    .filter((rank) => rank !== null);
  const activeBestRank = activeRanks.length ? Math.min(...activeRanks) : null;
  const shadowBestRank = shadowRanks.length ? Math.min(...shadowRanks) : null;
  return {
    profile: 'hybrid-v1',
    activeBestRank,
    shadowBestRank,
    activeSelected: expectedMatches.some((item) => item.selected),
    shadowWouldSelect: expectedMatches.some((item) => item.shadowScores?.hybridV1?.wouldSelect === true),
    rankDelta: activeBestRank !== null && shadowBestRank !== null ? activeBestRank - shadowBestRank : null,
  };
}

function buildRerankerShadowComparison(normalizedCase = {}, traceLike = [], rerankSummary = null) {
  const trace = normalizeTraceArray(traceLike);
  if (!trace.some((item) => item.rerankShadow)) return null;
  const expectedMatches = trace.filter((item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const activeRanks = expectedMatches
    .map((item) => normalizeRank(item.rank))
    .filter((rank) => rank !== null);
  const rerankRanks = expectedMatches
    .map((item) => normalizeRank(item.rerankShadow?.outputRank))
    .filter((rank) => rank !== null);
  const latencyValues = trace
    .map((item) => Number(item.rerankShadow?.latencyMs))
    .filter((value) => Number.isFinite(value));
  const summary = rerankSummary && typeof rerankSummary === 'object' ? rerankSummary : {};
  const provider = trimText(summary.provider || trace.find((item) => item.rerankShadow?.provider)?.rerankShadow?.provider || '', 80);
  const activeBestRank = activeRanks.length ? Math.min(...activeRanks) : null;
  const rerankBestRank = rerankRanks.length ? Math.min(...rerankRanks) : null;
  return compactObject({
    provider,
    measurementMode: trimText(summary.measurementMode || '', 80),
    inputTopK: Number.isFinite(Number(summary.inputTopK)) ? Math.max(0, Math.round(Number(summary.inputTopK))) : null,
    outputTopK: Number.isFinite(Number(summary.outputTopK)) ? Math.max(0, Math.round(Number(summary.outputTopK))) : null,
    activeBestRank,
    rerankBestRank,
    activeSelected: expectedMatches.some((item) => item.selected),
    activeRendered: expectedMatches.some((item) => item.rendered),
    rerankWouldSelect: expectedMatches.some((item) => item.rerankShadow?.wouldSelect === true),
    rankDelta: activeBestRank !== null && rerankBestRank !== null ? activeBestRank - rerankBestRank : null,
    latencyMs: Number.isFinite(Number(summary.latencyMs))
      ? Math.max(0, Math.round(Number(summary.latencyMs)))
      : (latencyValues.length ? Math.max(...latencyValues) : null),
    unavailableReason: trimText(summary.unavailableReason || '', 160),
  });
}

function memoryLinkTraceLinks(memoryLinks = null) {
  if (!memoryLinks || typeof memoryLinks !== 'object') return [];
  return [
    ...asArray(memoryLinks.incoming),
    ...asArray(memoryLinks.outgoing),
    ...asArray(memoryLinks.links),
  ].filter((link) => link && typeof link === 'object');
}

function summarizeMemoryLinkForCandidateAnalysis(link = {}) {
  const relation = normalizeKey(link.relation || '');
  const supportState = normalizeKey(link.supportState || link.support?.state || '');
  const authorityEffect = normalizeKey(link.authorityEffect || link.effect || '');
  return compactObject({
    id: trimText(link.id || '', 160),
    sourceId: trimText(link.sourceId || '', 160),
    targetId: trimText(link.targetId || '', 160),
    relation,
    direction: normalizeKey(link.direction || ''),
    supportState,
    authorityEffect,
    advisoryOnly: true,
    truthProof: false,
    canonicalMemoryWrite: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
  });
}

function summarizeMemoryLinksForCandidateAnalysis(memoryLinks = null, limit = 8) {
  const seen = new Set();
  const links = [];
  for (const link of memoryLinkTraceLinks(memoryLinks)) {
    const summary = summarizeMemoryLinkForCandidateAnalysis(link);
    if (!summary.relation) continue;
    const key = [
      summary.id,
      summary.sourceId,
      summary.targetId,
      summary.relation,
      summary.direction,
    ].filter(Boolean).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(summary);
    if (links.length >= limit) break;
  }
  return links;
}

function linkIsCorrectionShaped(link = {}) {
  return CORRECTION_LINK_RELATIONS.has(normalizeKey(link.relation || ''));
}

function linkHasStrongCorrectionAuthority(link = {}) {
  const supportState = normalizeKey(link.supportState || '');
  const authorityEffect = normalizeKey(link.authorityEffect || '');
  return supportState === MEMORY_LINK_SUPPORT_STATES.EXPLICIT
    && STRONG_CORRECTION_AUTHORITY_EFFECTS.has(authorityEffect);
}

function linkIsCandidateOnlySupport(link = {}) {
  return CANDIDATE_ONLY_LINK_SUPPORT_STATES.has(normalizeKey(link.supportState || ''));
}

function caseNeedsCorrectionLinkAnalysis(normalizedCase = {}) {
  const text = normalizeKey([
    normalizedCase.id,
    normalizedCase.query,
    normalizedCase.expected?.relation,
    normalizedCase.retrievalExpectation?.note,
    ...asArray(normalizedCase.notes),
    ...asArray(normalizedCase.forbidden).map((item) => item?.reason || item?.object || ''),
  ].filter(Boolean).join(' '));
  return Boolean(
    normalizedCase.forbidden?.length
      && (
        text.includes('correction')
        || text.includes('stale')
        || text.includes('superseded')
        || text.includes('false-premise')
        || text.includes('current')
        || text.includes('now')
      ),
  );
}

function traceItemKey(item = {}) {
  return normalizeKey(item?.id || item?.sourceId || '');
}

function findScoredShadowForCandidate(scored = [], candidate = null) {
  if (!candidate) return null;
  const keys = new Set(candidateIdentityKeys(candidate));
  const candidateKey = traceItemKey(candidate);
  if (candidateKey) keys.add(candidateKey);
  return asArray(scored).find((item) => {
    const source = item?.candidate || {};
    const sourceKeys = new Set(candidateIdentityKeys(source));
    const sourceKey = traceItemKey(source);
    if (sourceKey) sourceKeys.add(sourceKey);
    return [...keys].some((key) => sourceKeys.has(key));
  }) || null;
}

function linkShadowHelpsExpected(shadow = null) {
  if (!shadow || typeof shadow !== 'object') return false;
  const score = Number(shadow.score);
  const rankDelta = shadow.rankDelta === null || shadow.rankDelta === undefined
    ? null
    : Number(shadow.rankDelta);
  if (Number.isFinite(rankDelta) && rankDelta > 0) return true;
  return Number.isFinite(score) && score > 0;
}

function linkShadowPenalizesStale(shadow = null) {
  if (!shadow || typeof shadow !== 'object') return false;
  const score = Number(shadow.score);
  const rankDelta = shadow.rankDelta === null || shadow.rankDelta === undefined
    ? null
    : Number(shadow.rankDelta);
  if (Number.isFinite(rankDelta) && rankDelta < 0) return true;
  return Number.isFinite(score) && score < 0;
}

function linkShadowHurtsExpected(shadow = null) {
  if (!shadow || typeof shadow !== 'object') return false;
  const score = Number(shadow.score);
  const rankDelta = shadow.rankDelta === null || shadow.rankDelta === undefined
    ? null
    : Number(shadow.rankDelta);
  if (Number.isFinite(rankDelta) && rankDelta < 0) return true;
  return Number.isFinite(score) && score < 0;
}

function linkShadowHelpsStale(shadow = null) {
  if (!shadow || typeof shadow !== 'object') return false;
  const score = Number(shadow.score);
  const rankDelta = shadow.rankDelta === null || shadow.rankDelta === undefined
    ? null
    : Number(shadow.rankDelta);
  if (Number.isFinite(rankDelta) && rankDelta > 0) return true;
  return Number.isFinite(score) && score > 0;
}

function chooseLinkShadowRankDelta(expectedShadow = null, staleShadow = null) {
  const expectedRankDelta = expectedShadow?.rankDelta === null || expectedShadow?.rankDelta === undefined
    ? null
    : Number(expectedShadow.rankDelta);
  if (Number.isFinite(expectedRankDelta)) return expectedRankDelta;
  const staleRankDelta = staleShadow?.rankDelta === null || staleShadow?.rankDelta === undefined
    ? null
    : Number(staleShadow.rankDelta);
  return Number.isFinite(staleRankDelta) ? staleRankDelta : null;
}

function retrievalFailureModeNeedsLinkHelp(failureMode = '') {
  const normalized = normalizeFailureMode(failureMode, '');
  return Boolean(normalized && ![
    CANDIDATE_FAILURE_MODES.NO_FAILURE,
    CANDIDATE_FAILURE_MODES.NOT_APPLICABLE,
    CANDIDATE_FAILURE_MODES.ANSWER_LAYER_FAILURE,
  ].includes(normalized));
}

function buildCandidateLinkAnalysis({
  normalizedCase = {},
  traceLike = [],
  classification = null,
  failureClassification = null,
} = {}) {
  const trace = normalizeTraceArray(traceLike);
  void classification;
  const expectedCandidate = findBestTraceMatch(trace, (item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const staleCandidate = findBestTraceMatch(trace, (item) => matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  const expectedCandidateLinks = summarizeMemoryLinksForCandidateAnalysis(expectedCandidate?.memoryLinks);
  const staleCandidateLinks = summarizeMemoryLinksForCandidateAnalysis(staleCandidate?.memoryLinks);
  const relevantLinks = [...expectedCandidateLinks, ...staleCandidateLinks];
  const hasRelevantLinks = relevantLinks.length > 0;
  const correctionLinks = relevantLinks.filter(linkIsCorrectionShaped);
  const hasAnyTraceLinks = trace.some((item) => item.memoryLinks);
  const correctionSensitive = caseNeedsCorrectionLinkAnalysis(normalizedCase);
  const scored = scoreMemoryLinkShadowForCandidates(trace.map((item) => ({
    ...item,
    rank: item.rank,
    activeRank: item.rank,
    activeScore: Number.isFinite(Number(item.activeScore))
      ? Number(item.activeScore)
      : (Number.isFinite(Number(item.score)) ? Number(item.score) : 0),
    memoryLinks: item.memoryLinks || [],
  })));
  const expectedShadow = hasRelevantLinks
    ? (findScoredShadowForCandidate(scored, expectedCandidate)?.linkShadowScore || null)
    : null;
  const staleShadow = hasRelevantLinks
    ? (findScoredShadowForCandidate(scored, staleCandidate)?.linkShadowScore || null)
    : null;
  const expectedHelpful = linkShadowHelpsExpected(expectedShadow);
  const staleHelpful = linkShadowPenalizesStale(staleShadow);
  const expectedHurt = linkShadowHurtsExpected(expectedShadow);
  const staleHurt = linkShadowHelpsStale(staleShadow);
  const helpfulShadow = expectedHelpful || staleHelpful;
  const harmfulShadow = expectedHurt || staleHurt;
  const failureMode = failureClassification?.failureMode || '';
  const failureNeedsLinkHelp = retrievalFailureModeNeedsLinkHelp(failureMode);
  const correctionLinkRelevant = correctionSensitive && failureMode !== CANDIDATE_FAILURE_MODES.NOT_APPLICABLE;
  let linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.NONE;
  let verdict = hasAnyTraceLinks ? CANDIDATE_LINK_VERDICTS.NEUTRAL : CANDIDATE_LINK_VERDICTS.NOT_RUN;

  if (correctionLinkRelevant && !correctionLinks.length) {
    linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.MISSING_LINK;
    verdict = CANDIDATE_LINK_VERDICTS.NOT_RUN;
  } else if (correctionLinkRelevant && harmfulShadow) {
    linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.WRONG_LINK;
    verdict = CANDIDATE_LINK_VERDICTS.HURTS;
  } else if (helpfulShadow && failureNeedsLinkHelp) {
    linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.LINK_WOULD_HELP;
    verdict = CANDIDATE_LINK_VERDICTS.HELPS;
  } else if (correctionLinkRelevant && correctionLinks.length && !correctionLinks.some(linkHasStrongCorrectionAuthority)) {
    linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.WEAK_LINK;
    verdict = helpfulShadow ? CANDIDATE_LINK_VERDICTS.HELPS : CANDIDATE_LINK_VERDICTS.NEUTRAL;
  } else if (helpfulShadow) {
    verdict = CANDIDATE_LINK_VERDICTS.HELPS;
  } else if (failureNeedsLinkHelp && correctionLinks.length) {
    linkFailureMode = CANDIDATE_LINK_FAILURE_MODES.LINK_IGNORED;
    verdict = CANDIDATE_LINK_VERDICTS.NEUTRAL;
  }

  return {
    expectedCandidateLinks,
    staleCandidateLinks,
    linkFailureMode,
    shadowRankDelta: chooseLinkShadowRankDelta(expectedShadow, staleShadow),
    verdict,
    candidateOnlyVerifiedSupport: false,
    expectedLinkShadow: expectedShadow
      ? compactObject({
          active: expectedShadow.active === true,
          behaviorChanged: expectedShadow.behaviorChanged === true,
          score: Number.isFinite(Number(expectedShadow.score)) ? Number(expectedShadow.score) : null,
          activeRank: expectedShadow.activeRank ?? null,
          shadowRank: expectedShadow.shadowRank ?? null,
          rankDelta: expectedShadow.rankDelta ?? null,
          wouldChangeRank: expectedShadow.wouldChangeRank === true,
          reasons: uniqueStrings(expectedShadow.reasons || [], 8),
        })
      : null,
    staleLinkShadow: staleShadow
      ? compactObject({
          active: staleShadow.active === true,
          behaviorChanged: staleShadow.behaviorChanged === true,
          score: Number.isFinite(Number(staleShadow.score)) ? Number(staleShadow.score) : null,
          activeRank: staleShadow.activeRank ?? null,
          shadowRank: staleShadow.shadowRank ?? null,
          rankDelta: staleShadow.rankDelta ?? null,
          wouldChangeRank: staleShadow.wouldChangeRank === true,
          reasons: uniqueStrings(staleShadow.reasons || [], 8),
        })
      : null,
    candidateOnlyLinkCount: relevantLinks.filter(linkIsCandidateOnlySupport).length,
    advisoryOnly: true,
    truthProof: false,
    behaviorChanged: false,
    scoringActive: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    limits: LINK_ANALYSIS_LIMITS,
  };
}

function buildCandidateLinkAnalysisSummary(cases = []) {
  const byFailureMode = Object.fromEntries(Object.values(CANDIDATE_LINK_FAILURE_MODES).map((mode) => [mode, 0]));
  const byVerdict = Object.fromEntries(Object.values(CANDIDATE_LINK_VERDICTS).map((verdict) => [verdict, 0]));
  const caseIdsByFailureMode = Object.fromEntries(Object.values(CANDIDATE_LINK_FAILURE_MODES).map((mode) => [mode, []]));
  const caseIdsByVerdict = Object.fromEntries(Object.values(CANDIDATE_LINK_VERDICTS).map((verdict) => [verdict, []]));
  let expectedCandidateLinkCount = 0;
  let staleCandidateLinkCount = 0;
  let candidateOnlyVerifiedSupportCount = 0;

  for (const item of asArray(cases)) {
    const analysis = item?.linkAnalysis && typeof item.linkAnalysis === 'object'
      ? item.linkAnalysis
      : {};
    const failureMode = Object.values(CANDIDATE_LINK_FAILURE_MODES).includes(analysis.linkFailureMode)
      ? analysis.linkFailureMode
      : CANDIDATE_LINK_FAILURE_MODES.NONE;
    const verdict = Object.values(CANDIDATE_LINK_VERDICTS).includes(analysis.verdict)
      ? analysis.verdict
      : CANDIDATE_LINK_VERDICTS.NOT_RUN;
    byFailureMode[failureMode] += 1;
    byVerdict[verdict] += 1;
    if (item?.id) caseIdsByFailureMode[failureMode].push(item.id);
    if (item?.id) caseIdsByVerdict[verdict].push(item.id);
    expectedCandidateLinkCount += asArray(analysis.expectedCandidateLinks).length;
    staleCandidateLinkCount += asArray(analysis.staleCandidateLinks).length;
    if (analysis.candidateOnlyVerifiedSupport === true) candidateOnlyVerifiedSupportCount += 1;
  }

  return {
    totalCases: asArray(cases).filter((item) => item && typeof item === 'object').length,
    byFailureMode,
    caseIdsByFailureMode,
    byVerdict,
    caseIdsByVerdict,
    expectedCandidateLinkCount,
    staleCandidateLinkCount,
    candidateOnlyVerifiedSupportCount,
    behaviorChanged: false,
    scoringActive: false,
    truthProof: false,
  };
}

function buildStructuredCandidateContractFailureDefinitionList() {
  return Object.values(STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES).map((failureMode) => ({
    failureMode,
    definition: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_DEFINITIONS[failureMode],
  }));
}

function traceItemsWithSemanticClaims(traceLike = []) {
  return normalizeTraceArray(traceLike).filter((item) => item.semanticClaim);
}

function claimValueMatches(value = '', expectedValue = '') {
  const expected = trimText(expectedValue, 500);
  if (!expected) return true;
  return hasNormalizedNeedle(value, expected);
}

function semanticClaimObjectMatches(claim = {}, expectedClaim = {}) {
  return claimValueMatches(claim.objectText || '', expectedClaim.objectText || '');
}

function semanticClaimPredicateMatches(claim = {}, expectedClaim = {}) {
  const expectedPredicateId = cleanContractId(expectedClaim.predicateId || '');
  if (!expectedPredicateId) return true;
  return cleanContractId(claim.predicateId || '') === expectedPredicateId;
}

function semanticClaimSubjectMatches(claim = {}, expectedClaim = {}) {
  const expectedSubjectId = cleanContractId(expectedClaim.subjectId || '');
  const expectedSubjectType = normalizeKey(expectedClaim.subjectType || '');
  if (expectedSubjectId && cleanContractId(claim.subjectId || '') !== expectedSubjectId) return false;
  if (expectedSubjectType && normalizeKey(claim.subjectType || '') !== expectedSubjectType) return false;
  return true;
}

function semanticClaimMatchesExpected(claim = {}, expectedClaim = {}) {
  return semanticClaimSubjectMatches(claim, expectedClaim)
    && semanticClaimPredicateMatches(claim, expectedClaim)
    && semanticClaimObjectMatches(claim, expectedClaim);
}

function semanticClaimMatchesForbidden(claim = {}, forbiddenClaim = {}) {
  return semanticClaimSubjectMatches(claim, forbiddenClaim)
    && semanticClaimPredicateMatches(claim, forbiddenClaim)
    && semanticClaimObjectMatches(claim, forbiddenClaim);
}

function semanticClaimTemporalMatches(claim = {}, expectedClaim = {}) {
  const expectedTemporalScope = normalizeKey(expectedClaim.temporalScope || '');
  if (!expectedTemporalScope) return true;
  return normalizeKey(claim.temporalScope || '') === expectedTemporalScope;
}

function semanticClaimDomainAllowed(claim = {}, expectedClaim = {}) {
  const allowed = asArray(expectedClaim.allowedDomainIds).map(cleanContractId).filter(Boolean);
  if (!allowed.length) return true;
  return allowed.includes(cleanContractId(claim.domainId || ''));
}

function semanticClaimSourceMatches(claim = {}, expectedClaim = {}) {
  const expectedSourceId = cleanContractId(expectedClaim.sourceId || '');
  if (!expectedSourceId) return true;
  return cleanContractId(claim.sourceId || '') === expectedSourceId;
}

function semanticClaimSupportMeets(claim = {}, expectedClaim = {}) {
  const required = asArray(expectedClaim.requiredSupportStates).map(normalizeKey).filter(Boolean);
  if (!required.length) return true;
  return required.includes(normalizeKey(claim.supportState || ''));
}

function semanticClaimSourceAuthorityMeets(claim = {}, expectedClaim = {}) {
  const required = asArray(expectedClaim.requiredSourceAuthorities).map(normalizeKey).filter(Boolean);
  if (!required.length) return true;
  return required.includes(normalizeKey(claim.sourceAuthority || ''));
}

function semanticClaimCanonicalityMeets(claim = {}, expectedClaim = {}) {
  const required = normalizeKey(expectedClaim.requiredCanonicality || '');
  if (!required) return true;
  return normalizeKey(claim.canonicality || '') === required;
}

function expectedClaimRequiresVerifiedSupport(expectedClaim = {}) {
  return asArray(expectedClaim.requiredSupportStates).map(normalizeKey).includes('verified')
    || asArray(expectedClaim.requiredSourceAuthorities).map(normalizeKey).includes('canonical')
    || normalizeKey(expectedClaim.requiredCanonicality || '') === 'canonical';
}

function treatmentLooksVerified(treatment = {}) {
  return treatment.verified === true
    || normalizeKey(treatment.supportState || '') === 'verified'
    || normalizeKey(treatment.sourceAuthority || '') === 'canonical'
    || normalizeKey(treatment.canonicality || '') === 'canonical';
}

function treatmentLooksCanonical(treatment = {}) {
  return treatment.canonical === true
    || normalizeKey(treatment.canonicality || '') === 'canonical'
    || normalizeKey(treatment.sourceAuthority || '') === 'canonical';
}

function structuredContractFailureResult({
  normalizedCase = {},
  failureMode = STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NONE,
  matchedCandidate = null,
  reason = '',
} = {}) {
  return {
    schema: STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA,
    caseId: normalizedCase.id || '',
    failureMode,
    failureDefinition: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_DEFINITIONS[failureMode],
    reason: trimText(reason || STRUCTURED_CANDIDATE_CONTRACT_FAILURE_DEFINITIONS[failureMode], 240),
    expectedClaim: normalizedCase.expectedClaim || {},
    matchedCandidate: summarizeTraceItem(matchedCandidate),
    advisoryOnly: true,
    truthProof: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrite: false,
    defaultPromptLimitsRaised: false,
  };
}

function classifyStructuredCandidateContract(caseLike = {}, traceLike = []) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const expectedClaim = normalizedCase.expectedClaim || null;
  const trace = traceItemsWithSemanticClaims(traceLike);
  if (!expectedClaim || !Object.keys(expectedClaim).length) {
    return structuredContractFailureResult({
      normalizedCase,
      failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NOT_APPLICABLE,
      reason: 'Case does not declare expectedClaim.',
    });
  }

  const exactMatches = trace.filter((item) => semanticClaimMatchesExpected(item.semanticClaim, expectedClaim));
  const bestExact = findBestTraceMatch(exactMatches, () => true);
  if (bestExact) {
    const claim = bestExact.semanticClaim || {};
    if (expectedClaim.requireSourceId !== false && !claim.sourceId) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_SOURCE_ID,
        matchedCandidate: bestExact,
        reason: 'Expected claim matched but sourceId is missing.',
      });
    }
    if (expectedClaim.requireStableClaimId !== false && claim.claimIdStable !== true) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.UNSTABLE_CLAIM_ID,
        matchedCandidate: bestExact,
        reason: 'Expected claim matched but claimId is invalid or does not match normalized claim fields.',
      });
    }
    if (!semanticClaimDomainAllowed(claim, expectedClaim)) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.AUTHORITY_DOMAIN_MISMATCH,
        matchedCandidate: bestExact,
        reason: `Claim domain ${claim.domainId || 'unknown'} is outside the allowed domain contract.`,
      });
    }
    if (!semanticClaimSourceMatches(claim, expectedClaim)) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.SOURCE_ID_MISMATCH,
        matchedCandidate: bestExact,
        reason: 'Claim sourceId does not match the expected sourceId.',
      });
    }
    if (!semanticClaimTemporalMatches(claim, expectedClaim)) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_SOURCE_WRONG_TEMPORAL_SCOPE,
        matchedCandidate: bestExact,
        reason: `Claim temporal scope ${claim.temporalScope || 'unknown'} does not match ${expectedClaim.temporalScope || 'expected scope'}.`,
      });
    }
    if ((claim.candidateOnly || claim.supportState === 'candidate-only') && (
      expectedClaimRequiresVerifiedSupport(expectedClaim) || treatmentLooksVerified(bestExact.claimTreatment || {})
    )) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.CANDIDATE_ONLY_TREATED_AS_VERIFIED,
        matchedCandidate: bestExact,
        reason: 'Candidate-only support cannot satisfy a verified/canonical contract.',
      });
    }
    if (claim.supportState === 'rendered-advisory' && (
      normalizeKey(expectedClaim.requiredCanonicality || '') === 'canonical'
        || treatmentLooksCanonical(bestExact.claimTreatment || {})
    )) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RENDERED_ADVISORY_TREATED_AS_CANONICAL,
        matchedCandidate: bestExact,
        reason: 'Rendered advisory support cannot be treated as canonical.',
      });
    }
    if (!semanticClaimSupportMeets(claim, expectedClaim)
      || !semanticClaimSourceAuthorityMeets(claim, expectedClaim)
      || !semanticClaimCanonicalityMeets(claim, expectedClaim)) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.AUTHORITY_DOMAIN_MISMATCH,
        matchedCandidate: bestExact,
        reason: 'Claim authority/support fields do not satisfy the expected authority contract.',
      });
    }
    if (expectedClaim.requireRendered === true && bestExact.rendered !== true) {
      return structuredContractFailureResult({
        normalizedCase,
        failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.FOUND_NOT_RENDERED,
        matchedCandidate: bestExact,
        reason: 'Expected claim was found but not rendered.',
      });
    }
    return structuredContractFailureResult({
      normalizedCase,
      failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NONE,
      matchedCandidate: bestExact,
      reason: 'Expected structured claim contract was satisfied.',
    });
  }

  const stalePredicateMatch = trace.find((item) => (
    semanticClaimSubjectMatches(item.semanticClaim, expectedClaim)
      && semanticClaimPredicateMatches(item.semanticClaim, expectedClaim)
      && (
        item.semanticClaim.stale === true
        || asArray(normalizedCase.forbiddenClaims).some((forbidden) => semanticClaimMatchesForbidden(item.semanticClaim, forbidden))
      )
  ));
  if (stalePredicateMatch) {
    return structuredContractFailureResult({
      normalizedCase,
      failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_PREDICATE_STALE_OBJECT,
      matchedCandidate: stalePredicateMatch,
      reason: 'Candidate used the expected predicate with a stale or forbidden object.',
    });
  }

  const wrongPredicateMatch = trace.find((item) => (
    semanticClaimSubjectMatches(item.semanticClaim, expectedClaim)
      && semanticClaimObjectMatches(item.semanticClaim, expectedClaim)
      && !semanticClaimPredicateMatches(item.semanticClaim, expectedClaim)
  ));
  if (wrongPredicateMatch) {
    return structuredContractFailureResult({
      normalizedCase,
      failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_OBJECT_WRONG_PREDICATE,
      matchedCandidate: wrongPredicateMatch,
      reason: 'Candidate carried the expected object under the wrong predicate.',
    });
  }

  return structuredContractFailureResult({
    normalizedCase,
    failureMode: STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_EXPECTED_CLAIM,
    reason: 'No structured candidate claim matched the expected contract.',
  });
}

function buildStructuredCandidateContractSummary(cases = []) {
  const byFailureMode = Object.fromEntries(
    Object.values(STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES).map((mode) => [mode, 0]),
  );
  const caseIdsByFailureMode = Object.fromEntries(
    Object.values(STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES).map((mode) => [mode, []]),
  );
  for (const item of asArray(cases)) {
    const failureMode = Object.values(STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES).includes(item?.failureMode)
      ? item.failureMode
      : STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NOT_APPLICABLE;
    byFailureMode[failureMode] += 1;
    if (item?.caseId || item?.id) caseIdsByFailureMode[failureMode].push(item.caseId || item.id);
  }
  return {
    totalCases: asArray(cases).filter((item) => item && typeof item === 'object').length,
    byFailureMode,
    caseIdsByFailureMode,
    candidateOnlyTreatedAsVerifiedCount: byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.CANDIDATE_ONLY_TREATED_AS_VERIFIED],
    renderedAdvisoryTreatedAsCanonicalCount: byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RENDERED_ADVISORY_TREATED_AS_CANONICAL],
    missingSourceIdCount: byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_SOURCE_ID],
    unstableClaimIdCount: byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.UNSTABLE_CLAIM_ID],
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWriteCount: 0,
    defaultPromptLimitsRaised: false,
  };
}

const SEMANTIC_CLAIM_TRACE_MATCHES = Object.freeze({
  EXPECTED_CLAIM: 'expected-claim',
  RIGHT_OBJECT_WRONG_PREDICATE: 'right-object-wrong-predicate',
  RIGHT_PREDICATE_STALE_OBJECT: 'right-predicate-stale-object',
  STRUCTURED_OTHER: 'structured-other',
  UNSTRUCTURED_ADVISORY: 'unstructured-advisory',
  NO_EXPECTED_CONTRACT: 'no-expected-contract',
});

function classifySemanticClaimTraceMatch(item = {}, expectedClaim = {}) {
  const claim = item?.semanticClaim || null;
  if (!claim) return SEMANTIC_CLAIM_TRACE_MATCHES.UNSTRUCTURED_ADVISORY;
  if (!expectedClaim || !Object.keys(expectedClaim).length) {
    return SEMANTIC_CLAIM_TRACE_MATCHES.NO_EXPECTED_CONTRACT;
  }
  if (semanticClaimMatchesExpected(claim, expectedClaim)) {
    return SEMANTIC_CLAIM_TRACE_MATCHES.EXPECTED_CLAIM;
  }
  if (
    semanticClaimSubjectMatches(claim, expectedClaim)
      && semanticClaimObjectMatches(claim, expectedClaim)
      && !semanticClaimPredicateMatches(claim, expectedClaim)
  ) {
    return SEMANTIC_CLAIM_TRACE_MATCHES.RIGHT_OBJECT_WRONG_PREDICATE;
  }
  if (
    semanticClaimSubjectMatches(claim, expectedClaim)
      && semanticClaimPredicateMatches(claim, expectedClaim)
      && claim.stale === true
  ) {
    return SEMANTIC_CLAIM_TRACE_MATCHES.RIGHT_PREDICATE_STALE_OBJECT;
  }
  return SEMANTIC_CLAIM_TRACE_MATCHES.STRUCTURED_OTHER;
}

function summarizeClaimForSemanticTrace(claim = null) {
  if (!claim) return null;
  return compactObject({
    schema: claim.schema || '',
    claimId: claim.claimId || '',
    stableClaimId: claim.stableClaimId || '',
    claimIdStable: claim.claimIdStable === true,
    subjectId: claim.subjectId || '',
    subjectType: claim.subjectType || '',
    predicateId: claim.predicateId || '',
    objectText: claim.objectText || '',
    domainId: claim.domainId || '',
    sourceId: claim.sourceId || '',
    sourceType: claim.sourceType || '',
    sourceAuthority: claim.sourceAuthority || '',
    supportState: claim.supportState || '',
    canonicality: claim.canonicality || '',
    temporalScope: claim.temporalScope || '',
    stale: claim.stale === true,
    candidateOnly: claim.candidateOnly === true,
    canonical: claim.canonical === true,
    renderable: claim.renderable === true,
    validation: claim.validation || {},
  });
}

function buildSemanticClaimTraceCandidate(item = {}, expectedClaim = {}) {
  const candidate = normalizeCandidateTraceItem(item);
  const claim = candidate.semanticClaim || null;
  const claimTraceStatus = claim ? 'structured' : 'unstructured-advisory';
  return compactObject({
    candidateId: candidate.id || candidate.sourceId || '',
    sourceId: candidate.sourceId || '',
    textPreview: trimText(candidate.text || '', 180),
    candidateChannels: uniqueStrings(candidate.candidateChannels || [], 8),
    selected: candidate.selected === true,
    rendered: candidate.rendered === true,
    heldBackReason: candidate.heldBackReason || '',
    claimTraceStatus,
    claimMatch: classifySemanticClaimTraceMatch(candidate, expectedClaim),
    claim: summarizeClaimForSemanticTrace(claim),
    advisoryOnly: true,
    truthProof: false,
    scoringActive: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrite: false,
    defaultPromptLimitsRaised: false,
  });
}

function buildSemanticClaimTraceSummary(candidates = []) {
  const byClaimMatch = Object.fromEntries(
    Object.values(SEMANTIC_CLAIM_TRACE_MATCHES).map((match) => [match, 0]),
  );
  for (const item of asArray(candidates)) {
    const match = Object.values(SEMANTIC_CLAIM_TRACE_MATCHES).includes(item?.claimMatch)
      ? item.claimMatch
      : SEMANTIC_CLAIM_TRACE_MATCHES.UNSTRUCTURED_ADVISORY;
    byClaimMatch[match] += 1;
  }
  const structured = asArray(candidates).filter((item) => item?.claimTraceStatus === 'structured');
  return {
    schema: SEMANTIC_CLAIM_TRACE_SCHEMA,
    totalCandidates: asArray(candidates).length,
    structuredClaimCandidateCount: structured.length,
    unstructuredAdvisoryCandidateCount: asArray(candidates).filter((item) => item?.claimTraceStatus !== 'structured').length,
    candidateOnlyClaimCount: structured.filter((item) => item.claim?.candidateOnly === true).length,
    renderedClaimCandidateCount: structured.filter((item) => item.rendered === true).length,
    selectedClaimCandidateCount: structured.filter((item) => item.selected === true).length,
    rightObjectWrongPredicateCount: byClaimMatch[SEMANTIC_CLAIM_TRACE_MATCHES.RIGHT_OBJECT_WRONG_PREDICATE],
    rightPredicateStaleObjectCount: byClaimMatch[SEMANTIC_CLAIM_TRACE_MATCHES.RIGHT_PREDICATE_STALE_OBJECT],
    expectedClaimCandidateCount: byClaimMatch[SEMANTIC_CLAIM_TRACE_MATCHES.EXPECTED_CLAIM],
    byClaimMatch,
    advisoryOnly: true,
    truthProof: false,
    scoringActive: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWriteCount: 0,
    defaultPromptLimitsRaised: false,
  };
}

function buildSemanticClaimTraceForCase(normalizedCase = {}, traceLike = [], {
  limit = 8,
  measurementMode = 'archive-unit',
} = {}) {
  const expectedClaim = normalizedCase.expectedClaim || {};
  const candidates = normalizeTraceArray(traceLike)
    .slice()
    .sort(compareCandidateSurvivalQuality)
    .slice(0, Math.max(0, Number(limit || 0)))
    .map((item) => buildSemanticClaimTraceCandidate(item, expectedClaim));
  return {
    schema: SEMANTIC_CLAIM_TRACE_SCHEMA,
    measurementMode,
    candidateSurvivalOnly: true,
    candidateTraceOnly: true,
    candidates,
    summary: buildSemanticClaimTraceSummary(candidates),
    limits: [
      'Semantic claim trace is retrieval-path QA metadata, not PromptTruth.',
      'Unstructured candidates remain advisory and cannot satisfy structured claim contracts.',
      'Candidate-only/static/semantic claims cannot become verified or canonical through this trace.',
      'toolEvidenceReceipt remains a sibling runtime artifact.',
    ],
  };
}

function buildSemanticClaimTraceArtifactSummary(cases = []) {
  const totals = {
    schema: SEMANTIC_CLAIM_TRACE_SCHEMA,
    measurementMode: 'archive-unit',
    totalCases: 0,
    totalCandidates: 0,
    structuredClaimCandidateCount: 0,
    unstructuredAdvisoryCandidateCount: 0,
    candidateOnlyClaimCount: 0,
    renderedClaimCandidateCount: 0,
    selectedClaimCandidateCount: 0,
    rightObjectWrongPredicateCount: 0,
    rightPredicateStaleObjectCount: 0,
    expectedClaimCandidateCount: 0,
    advisoryOnly: true,
    truthProof: false,
    scoringActive: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWriteCount: 0,
    defaultPromptLimitsRaised: false,
  };
  for (const item of asArray(cases)) {
    const summary = item?.semanticClaimTrace?.summary;
    if (!summary || typeof summary !== 'object') continue;
    totals.totalCases += 1;
    totals.totalCandidates += Number(summary.totalCandidates || 0);
    totals.structuredClaimCandidateCount += Number(summary.structuredClaimCandidateCount || 0);
    totals.unstructuredAdvisoryCandidateCount += Number(summary.unstructuredAdvisoryCandidateCount || 0);
    totals.candidateOnlyClaimCount += Number(summary.candidateOnlyClaimCount || 0);
    totals.renderedClaimCandidateCount += Number(summary.renderedClaimCandidateCount || 0);
    totals.selectedClaimCandidateCount += Number(summary.selectedClaimCandidateCount || 0);
    totals.rightObjectWrongPredicateCount += Number(summary.rightObjectWrongPredicateCount || 0);
    totals.rightPredicateStaleObjectCount += Number(summary.rightPredicateStaleObjectCount || 0);
    totals.expectedClaimCandidateCount += Number(summary.expectedClaimCandidateCount || 0);
  }
  return totals;
}

function buildStructuredCandidateFixtureCandidate({
  id = '',
  subject,
  predicateId = SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
  objectText = 'copper rabbit',
  domainId = SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
  sourceType = 'archive-episode',
  sourceRef = 'session:coding-mascot-current-copper-rabbit',
  sourceId = '',
  sourceAuthority = 'advisory',
  supportState = 'rendered-advisory',
  canonicality = 'advisory',
  temporalScope = 'current',
  stale = false,
  rendered = true,
  selected = true,
  rank = 1,
  claimId = undefined,
  claimTreatment = null,
} = {}) {
  const claimSourceId = sourceId === null
    ? ''
    : (sourceId || buildSemanticSourceId({ sourceType, sourceId: sourceRef }));
  const claimLike = {
    domainId,
    subject,
    predicate: { id: predicateId },
    object: { type: 'text', text: objectText },
    source: {
      ...(claimSourceId ? { sourceId: claimSourceId } : {}),
      sourceType,
      excerpt: `${objectText} structured candidate fixture`,
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    authority: {
      sourceAuthority,
      supportState,
      canonicality,
    },
    temporal: {
      temporalScope,
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    status: { stale },
  };
  const stableClaimId = buildSemanticClaimId(claimLike);
  return {
    id: id || sourceRef,
    raw: true,
    ranked: true,
    selected,
    rendered,
    rank,
    claim: {
      ...claimLike,
      claimId: claimId === undefined ? stableClaimId : claimId,
    },
    ...(claimTreatment ? { claimTreatment } : {}),
  };
}

function buildStructuredCandidateContractFixtureCases() {
  const projectSubject = {
    id: buildSemanticEntityId({ entityType: 'project', entityKey: 'lyra-prototype' }),
    type: 'project',
    label: 'lyra-prototype',
  };
  const expectedSourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'session:coding-mascot-current-copper-rabbit',
  });
  const alternateSourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'session:coding-mascot-other-source',
  });
  const expectedClaim = {
    subjectId: projectSubject.id,
    subjectType: projectSubject.type,
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    objectText: 'copper rabbit',
    temporalScope: 'current',
    allowedDomainIds: [
      SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
      SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    ],
    requiredSupportStates: ['verified', 'rendered-advisory'],
    requireRendered: true,
    sourceId: expectedSourceId,
  };
  const forbiddenBrassFox = [{
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    objectText: 'brass fox',
    reason: 'stale prior',
  }];
  const validCandidate = buildStructuredCandidateFixtureCandidate({
    id: 'contract:coding-mascot-current',
    subject: projectSubject,
    sourceId: expectedSourceId,
  });
  const baseCase = {
    query: 'What is the current coding mascot?',
    expected: {
      subject: 'lyra-prototype',
      relation: 'current coding mascot',
      object: 'copper rabbit',
    },
    expectedClaim,
    forbiddenClaims: forbiddenBrassFox,
  };

  return [
    {
      ...baseCase,
      id: 'structured-contract-valid-current-claim',
      trace: [validCandidate],
    },
    {
      ...baseCase,
      id: 'structured-contract-right-object-wrong-predicate',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:wrong-predicate',
        subject: projectSubject,
        predicateId: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
        sourceId: expectedSourceId,
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-right-predicate-stale-object',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:stale-object',
        subject: projectSubject,
        objectText: 'brass fox',
        sourceId: expectedSourceId,
        temporalScope: 'historical',
        stale: true,
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-wrong-temporal-scope',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:historical-current-object',
        subject: projectSubject,
        sourceId: expectedSourceId,
        temporalScope: 'historical',
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-candidate-only-treated-verified',
      expectedClaim: {
        ...expectedClaim,
        allowedDomainIds: [SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE],
        requiredSupportStates: ['verified'],
        sourceId: buildSemanticSourceId({
          sourceType: 'static-candidate',
          sourceId: 'static:coding-mascot-candidate',
        }),
      },
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:candidate-only',
        subject: projectSubject,
        domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
        sourceType: 'static-candidate',
        sourceRef: 'static:coding-mascot-candidate',
        sourceAuthority: 'candidate-only',
        supportState: 'candidate-only',
        canonicality: 'not-canonical',
        claimTreatment: { supportState: 'verified', verified: true },
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-rendered-advisory-treated-canonical',
      expectedClaim: {
        ...expectedClaim,
        requiredCanonicality: 'canonical',
      },
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:rendered-advisory-canonical-overclaim',
        subject: projectSubject,
        sourceId: expectedSourceId,
        claimTreatment: { canonicality: 'canonical', canonical: true },
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-found-not-rendered',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:found-not-rendered',
        subject: projectSubject,
        sourceId: expectedSourceId,
        rendered: false,
        selected: true,
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-missing-source-id',
      expectedClaim: {
        ...expectedClaim,
        sourceId: '',
      },
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:missing-source-id',
        subject: projectSubject,
        sourceId: null,
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-unstable-claim-id',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:unstable-claim-id',
        subject: projectSubject,
        sourceId: expectedSourceId,
        claimId: 'penny:claim:not-a-digest',
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-authority-domain-mismatch',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:domain-mismatch',
        subject: projectSubject,
        domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
        sourceType: 'static-candidate',
        sourceRef: 'static:coding-mascot-domain-mismatch',
        sourceAuthority: 'candidate-only',
        supportState: 'candidate-only',
        canonicality: 'not-canonical',
      })],
    },
    {
      ...baseCase,
      id: 'structured-contract-source-id-mismatch',
      trace: [buildStructuredCandidateFixtureCandidate({
        id: 'contract:source-mismatch',
        subject: projectSubject,
        sourceId: alternateSourceId,
      })],
    },
  ];
}

function buildStructuredCandidateContractQaFixture({
  generatedAt = new Date().toISOString(),
  cases = null,
} = {}) {
  const fixtureCases = Array.isArray(cases) && cases.length
    ? cases
    : buildStructuredCandidateContractFixtureCases();
  const results = fixtureCases.map((item) => {
    const classification = classifyStructuredCandidateContract(item, item.trace || item.candidateTrace || []);
    return {
      ...classification,
      traceSummary: summarizeCandidateTrace(item.trace || item.candidateTrace || []),
    };
  });
  return {
    schema: STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA,
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    failureModeDefinitions: buildStructuredCandidateContractFailureDefinitionList(),
    cases: results,
    summary: buildStructuredCandidateContractSummary(results),
    limits: STRUCTURED_CANDIDATE_CONTRACT_LIMITS,
  };
}

function buildProfileSnapshot(normalizedCase = {}, traceLike = []) {
  const trace = normalizeTraceArray(traceLike);
  const expectedMatches = trace.filter((item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const best = findBestTraceMatch(trace, (item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  return {
    bestRank: best?.rank ?? null,
    selected: expectedMatches.some((item) => item.selected),
    rendered: expectedMatches.some((item) => item.rendered),
  };
}

function compareProfileSnapshots(baseline = {}, hybridV1 = {}) {
  const baselineRank = normalizeRank(baseline.bestRank);
  const hybridRank = normalizeRank(hybridV1.bestRank);
  if (baseline.rendered !== hybridV1.rendered) return hybridV1.rendered ? 'hybrid-rendered-more' : 'hybrid-rendered-less';
  if (baseline.selected !== hybridV1.selected) return hybridV1.selected ? 'hybrid-selected-more' : 'hybrid-selected-less';
  if (baselineRank !== null && hybridRank !== null && baselineRank !== hybridRank) {
    return hybridRank < baselineRank ? 'hybrid-ranked-better' : 'hybrid-ranked-worse';
  }
  if (baselineRank === null && hybridRank !== null) return 'hybrid-ranked-better';
  if (baselineRank !== null && hybridRank === null) return 'hybrid-ranked-worse';
  return 'same';
}

function buildCandidateSurvivalProfileComparison(caseLike = {}, {
  baselineTrace = [],
  hybridV1Trace = [],
} = {}) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const baseline = buildProfileSnapshot(normalizedCase, baselineTrace);
  const hybridV1 = buildProfileSnapshot(normalizedCase, hybridV1Trace);
  const baselineSummary = summarizeCandidateTrace(baselineTrace);
  const hybridSummary = summarizeCandidateTrace(hybridV1Trace);
  const renderedCountDelta = hybridSummary.renderedCandidateCount - baselineSummary.renderedCandidateCount;
  const verdict = renderedCountDelta === 0
    ? compareProfileSnapshots(baseline, hybridV1)
    : 'rendered-count-changed';
  return {
    baseline,
    hybridV1,
    renderedCountDelta,
    verdict,
  };
}

function averageNumeric(values = []) {
  const numbers = asArray(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return Math.round((total / numbers.length) * 1000) / 1000;
}

function providerComparisonCaseIsEligible(normalizedCase = {}) {
  const owner = normalizeKey(normalizedCase.retrievalExpectation?.owner || normalizedCase.support?.owner || normalizedCase.expected?.supportOwner || '');
  if (!owner.includes('archive')) return false;
  if (normalizedCase.retrievalExpectation?.shouldSelect === false && normalizedCase.retrievalExpectation?.shouldRender === false) return false;
  if (normalizedCase.expectedSurvival === CANDIDATE_SURVIVAL_OUTCOMES.MISSING) return false;
  if (normalizedCase.expectedSurvival === CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE) return false;
  return true;
}

function buildEmbeddingProviderComparisonCase(caseLike = {}) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const survival = caseLike?.survival && typeof caseLike.survival === 'object' ? caseLike.survival : {};
  const survivalAtK = Number(normalizedCase.retrievalExpectation?.survivalAtK || 0);
  const k = Number.isFinite(survivalAtK) && survivalAtK > 0 ? Math.round(survivalAtK) : null;
  const bestRank = survival.bestRank === null || survival.bestRank === undefined
    ? null
    : normalizeRank(survival.bestRank);
  const eligible = providerComparisonCaseIsEligible(normalizedCase);
  return {
    id: normalizedCase.id,
    eligible,
    expectedObject: normalizedCase.expected?.object || '',
    supportOwner: normalizedCase.support?.owner || normalizedCase.expected?.supportOwner || '',
    retrievalOwner: normalizedCase.retrievalExpectation?.owner || '',
    outcome: survival.outcome || caseLike.outcome || normalizedCase.expectedSurvival || '',
    failureMode: caseLike.failureMode || '',
    bestRank,
    survivalAtK: k,
    survivedAtK: eligible && bestRank !== null && k !== null ? bestRank <= k : false,
    selected: survival.expectedObjectSelected === true,
    rendered: survival.expectedObjectRendered === true,
  };
}

function buildEmbeddingProviderSummary(providerInfo = {}, cases = []) {
  const provider = typeof providerInfo === 'string'
    ? { provider: providerInfo }
    : (providerInfo && typeof providerInfo === 'object' ? providerInfo : {});
  const normalizedCases = asArray(cases).map((item) => buildEmbeddingProviderComparisonCase(item));
  const eligibleCases = normalizedCases.filter((item) => item.eligible);
  const survivedCases = eligibleCases.filter((item) => item.survivedAtK);
  return {
    provider: trimText(provider.provider || '', 80),
    model: trimText(provider.model || '', 160),
    retrievalMode: trimText(provider.retrievalMode || '', 80),
    survivalAtK: {
      k: averageNumeric(eligibleCases.map((item) => item.survivalAtK).filter((value) => value !== null)),
      survived: survivedCases.length,
      eligible: eligibleCases.length,
      rate: eligibleCases.length ? Math.round((survivedCases.length / eligibleCases.length) * 1000) / 1000 : null,
    },
    averageBestRank: averageNumeric(eligibleCases.map((item) => item.bestRank).filter((value) => value !== null)),
    cases: normalizedCases,
  };
}

function compareEmbeddingProviderSummaries(primary = {}, shadow = {}) {
  const primaryRate = Number(primary?.survivalAtK?.rate);
  const shadowRate = Number(shadow?.survivalAtK?.rate);
  const primaryRank = Number(primary?.averageBestRank);
  const shadowRank = Number(shadow?.averageBestRank);
  if (!Number.isFinite(primaryRate) || !Number.isFinite(shadowRate)) {
    return 'not-enough-provider-comparison-data';
  }
  if (shadowRate > primaryRate) return 'shadow-improved-candidate-survival';
  if (shadowRate < primaryRate) return 'shadow-reduced-candidate-survival';
  if (Number.isFinite(primaryRank) && Number.isFinite(shadowRank)) {
    if (shadowRank < primaryRank) return 'shadow-improved-average-rank';
    if (shadowRank > primaryRank) return 'shadow-worsened-average-rank';
  }
  return 'same-candidate-survival';
}

function buildEmbeddingProviderComparison({
  primary = {},
  primaryCases = [],
  shadow = {},
  shadowCases = [],
} = {}) {
  const primarySummary = buildEmbeddingProviderSummary(primary, primaryCases);
  const shadowSummary = {
    ...buildEmbeddingProviderSummary(shadow, shadowCases),
    cpuMs: Number.isFinite(Number(shadow?.cpuMs)) ? Math.max(0, Math.round(Number(shadow.cpuMs))) : null,
  };
  return {
    primary: primarySummary,
    shadow: shadowSummary,
    verdict: compareEmbeddingProviderSummaries(primarySummary, shadowSummary),
    limits: [
      'Shadow provider is discovery-only.',
      'Default embedding provider unchanged.',
      'Retrieved candidates are not canonized.',
    ],
  };
}

function rerankerShadowComparisonLooksImproved(comparison = {}) {
  if (!comparison || typeof comparison !== 'object') return false;
  if (comparison.rerankWouldSelect === true && comparison.activeSelected !== true) return true;
  const activeRank = normalizeRank(comparison.activeBestRank);
  const rerankRank = normalizeRank(comparison.rerankBestRank);
  return activeRank !== null && rerankRank !== null && rerankRank < activeRank;
}

function rerankerShadowComparisonLooksRegressed(comparison = {}) {
  if (!comparison || typeof comparison !== 'object') return false;
  if (comparison.activeSelected === true && comparison.rerankWouldSelect === false) return true;
  const activeRank = normalizeRank(comparison.activeBestRank);
  const rerankRank = normalizeRank(comparison.rerankBestRank);
  if (activeRank !== null && rerankRank !== null && rerankRank > activeRank) return true;
  return activeRank !== null && rerankRank === null;
}

function buildRerankerShadowArtifactSummary(cases = []) {
  const comparisonCases = asArray(cases)
    .filter((item) => item?.rerankerShadowComparison && typeof item.rerankerShadowComparison === 'object');
  if (!comparisonCases.length) {
    return {
      provider: '',
      measurementMode: '',
      inputTopK: null,
      outputTopK: null,
      improvedCases: [],
      regressedCases: [],
      unchangedCases: [],
      latencyMs: null,
      verdict: 'not-run',
    };
  }
  const provider = trimText(comparisonCases.find((item) => item.rerankerShadowComparison.provider)?.rerankerShadowComparison.provider || '', 80);
  const measurementMode = trimText(comparisonCases.find((item) => item.rerankerShadowComparison.measurementMode)?.rerankerShadowComparison.measurementMode || '', 80);
  const unavailableReasons = uniqueStrings(
    comparisonCases.map((item) => item.rerankerShadowComparison.unavailableReason).filter(Boolean),
    4,
  );
  const improvedCases = comparisonCases
    .filter((item) => rerankerShadowComparisonLooksImproved(item.rerankerShadowComparison))
    .map((item) => item.id)
    .filter(Boolean);
  const regressedCases = comparisonCases
    .filter((item) => rerankerShadowComparisonLooksRegressed(item.rerankerShadowComparison))
    .map((item) => item.id)
    .filter(Boolean);
  const unchangedCases = comparisonCases
    .filter((item) => (
      !rerankerShadowComparisonLooksImproved(item.rerankerShadowComparison)
        && !rerankerShadowComparisonLooksRegressed(item.rerankerShadowComparison)
    ))
    .map((item) => item.id)
    .filter(Boolean);
  const latencyValues = comparisonCases
    .map((item) => Number(item.rerankerShadowComparison.latencyMs))
    .filter((value) => Number.isFinite(value));
  const verdict = unavailableReasons.length
    ? 'unavailable'
    : (regressedCases.length
      ? 'mixed-or-regressed'
      : (improvedCases.length ? 'shadow-improved-ordering' : 'same-ordering'));
  return {
    provider,
    measurementMode,
    inputTopK: Math.max(
      0,
      ...comparisonCases
        .map((item) => Number(item.rerankerShadowComparison.inputTopK))
        .filter((value) => Number.isFinite(value)),
    ) || null,
    outputTopK: Math.max(
      0,
      ...comparisonCases
        .map((item) => Number(item.rerankerShadowComparison.outputTopK))
        .filter((value) => Number.isFinite(value)),
    ) || null,
    improvedCases,
    regressedCases,
    unchangedCases,
    latencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0)) : null,
    verdict,
    ...(unavailableReasons.length ? { unavailableReasons } : {}),
  };
}

function profileComparisonLooksImproved(comparison = {}) {
  const verdict = normalizeKey(comparison.verdict || '');
  if ([
    'hybrid-rendered-more',
    'hybrid-selected-more',
    'hybrid-ranked-better',
  ].includes(verdict)) return true;
  const baselineRank = normalizeRank(comparison.baseline?.bestRank);
  const hybridRank = normalizeRank(comparison.hybridV1?.bestRank);
  return baselineRank !== null && hybridRank !== null && hybridRank < baselineRank;
}

function profileComparisonLooksWorse(comparison = {}) {
  const verdict = normalizeKey(comparison.verdict || '');
  if ([
    'hybrid-rendered-less',
    'hybrid-selected-less',
    'hybrid-ranked-worse',
    'rendered-count-changed',
  ].includes(verdict)) return true;
  const baselineRank = normalizeRank(comparison.baseline?.bestRank);
  const hybridRank = normalizeRank(comparison.hybridV1?.bestRank);
  return baselineRank !== null && hybridRank !== null && hybridRank > baselineRank;
}

function buildCandidateSurvivalCorrelationSummary({
  generatedAt = new Date().toISOString(),
  measurementMode = '',
  artifact = null,
  cases = null,
} = {}) {
  const sourceArtifact = artifact && typeof artifact === 'object' ? artifact : null;
  const sourceCases = asArray(cases || sourceArtifact?.cases);
  const hasProfileComparisons = sourceCases.some((item) => (
    item?.profileComparison?.baseline && item?.profileComparison?.hybridV1
  ));
  const normalizedMode = hasProfileComparisons
    ? 'archive-unit'
    : (String(measurementMode || sourceArtifact?.measurementMode || 'fixture-only').trim() || 'fixture-only');

  if (hasProfileComparisons) {
    const comparisonCases = sourceCases.filter((item) => (
      item?.profileComparison?.baseline && item?.profileComparison?.hybridV1
    ));
    const beforeRanks = comparisonCases.map((item) => item.profileComparison.baseline.bestRank);
    const afterRanks = comparisonCases.map((item) => item.profileComparison.hybridV1.bestRank);
    const renderedMemoryCountDelta = comparisonCases.reduce((sum, item) => (
      sum + Number(item.profileComparison.renderedCountDelta || 0)
    ), 0);
    const improvedCaseIds = comparisonCases
      .filter((item) => profileComparisonLooksImproved(item.profileComparison))
      .map((item) => item.id)
      .filter(Boolean);
    const worsenedCaseIds = comparisonCases
      .filter((item) => profileComparisonLooksWorse(item.profileComparison))
      .map((item) => item.id)
      .filter(Boolean);
    const unchangedCaseIds = comparisonCases
      .filter((item) => (
        !profileComparisonLooksImproved(item.profileComparison)
          && !profileComparisonLooksWorse(item.profileComparison)
      ))
      .map((item) => item.id)
      .filter(Boolean);
    const selectionVerdict = worsenedCaseIds.length
      ? 'mixed-or-worse'
      : (improvedCaseIds.length
        ? (renderedMemoryCountDelta === 0 ? 'improved-without-rendered-count-growth' : 'improved-with-rendered-count-change')
        : 'same');

    return {
      measurementMode: normalizedMode,
      generatedAt,
      liveModelCalls: false,
      liveAnswerDriftMeasured: false,
      candidateSurvival: {
        comparisonState: 'profile-comparison',
        comparisonSource: 'baseline-vs-hybrid-v1',
        rankAggregation: 'mean-best-rank-across-profile-cases',
        expectedObjectBestRankBefore: averageNumeric(beforeRanks),
        expectedObjectBestRankAfter: averageNumeric(afterRanks),
        selectedBefore: comparisonCases.filter((item) => item.profileComparison.baseline.selected === true).length,
        selectedAfter: comparisonCases.filter((item) => item.profileComparison.hybridV1.selected === true).length,
        renderedBefore: comparisonCases.filter((item) => item.profileComparison.baseline.rendered === true).length,
        renderedAfter: comparisonCases.filter((item) => item.profileComparison.hybridV1.rendered === true).length,
        improvedCaseIds,
        unchangedCaseIds,
        worsenedCaseIds,
        selectionVerdict,
      },
      contextPressure: {
        renderedMemoryCountDelta,
        estimatedPromptTokenDelta: null,
        estimatedPromptTokenDeltaMode: 'not-measured-in-archive-unit-profile-comparison',
        promptBloatInferred: renderedMemoryCountDelta > 0,
        answerDrift: 'not-run',
      },
      latency: {
        firstTokenLatencyDeltaMs: null,
        totalLatencyDeltaMs: null,
      },
      limits: [
        'Candidate survival is retrieval-path evidence, not answer-quality evidence.',
        'Profile correlation compares fixture/unit retrieval receipts only; live answer drift is not measured here.',
        'Rendered-count delta is measured; prompt-token delta is not estimated for archive-unit profile comparisons.',
        'Latency fields stay null unless a separate live runtime-fit run measures them.',
      ],
    };
  }

  const fixture = sourceCases.length
    ? { cases: sourceCases, summary: summarizeCandidateSurvivalCases(sourceCases) }
    : buildCandidateSurvivalQaFixture({ generatedAt });
  const summary = fixture.summary || summarizeCandidateSurvivalCases(fixture.cases || []);
  const byOutcome = summary.byOutcome || {};
  const fixtureExpectedRendered = Number(byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RENDERED] || 0);
  const fixtureExpectedSelectedHeldBack = Number(byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK] || 0);

  return {
    measurementMode: normalizedMode === 'archive-unit' ? 'archive-unit' : 'fixture-only',
    generatedAt,
    liveModelCalls: false,
    liveAnswerDriftMeasured: false,
    candidateSurvival: {
      comparisonState: 'not-run',
      comparisonSource: 'candidate-survival-fixture',
      expectedObjectBestRankBefore: null,
      expectedObjectBestRankAfter: null,
      selectedBefore: null,
      selectedAfter: null,
      renderedBefore: null,
      renderedAfter: null,
      fixtureExpectedSelected: fixtureExpectedRendered + fixtureExpectedSelectedHeldBack,
      fixtureExpectedRendered,
      fixtureExpectedMissing: Number(byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING] || 0),
      fixtureExpectedSuppressedOrRawOnly: Number(byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY] || 0),
      summary,
      selectionVerdict: 'not-run',
    },
    contextPressure: {
      renderedMemoryCountDelta: 0,
      estimatedPromptTokenDelta: 0,
      estimatedPromptTokenDeltaMode: 'fixture-no-profile-change',
      promptBloatInferred: false,
      answerDrift: 'not-run',
    },
    latency: {
      firstTokenLatencyDeltaMs: null,
      totalLatencyDeltaMs: null,
    },
    limits: [
      'Candidate survival is retrieval-path evidence, not answer-quality evidence.',
      'Fixture-only correlation records the appendix shape; before/after selection comparison is not run.',
      'Rendered-memory and estimated-token deltas are zero because this fixture does not change prompt limits.',
      'Live answer drift and latency remain deferred to a separate isolated runtime-fit run.',
    ],
  };
}

function getCandidateLabel(candidate = null) {
  if (!candidate) return '';
  return trimText(candidate.id || candidate.sourceId || candidate.object || candidate.textPreview || candidate.text || '', 160);
}

function normalizeSurvivalResultForFailureMode(survivalResult = null, normalizedCase = {}, trace = []) {
  if (survivalResult && typeof survivalResult === 'object') {
    const outcome = normalizeOutcome(
      survivalResult.outcome || survivalResult.expectedSurvival || survivalResult.survivalOutcome || survivalResult.survival?.outcome,
      '',
    );
    if (outcome) {
      return {
        ...survivalResult,
        outcome,
      };
    }
  }
  const directOutcome = normalizeOutcome(survivalResult, '');
  if (directOutcome) return { outcome: directOutcome };
  if (trace.length) return classifyCandidateSurvival(normalizedCase, trace);
  return { outcome: normalizedCase.expectedSurvival || '' };
}

function caseExpectsRenderedSupport(normalizedCase = {}) {
  if (normalizedCase.retrievalExpectation?.shouldRender === true) return true;
  if (normalizedCase.retrievalExpectation?.shouldRender === false) return false;
  return normalizedCase.expectedSurvival === CANDIDATE_SURVIVAL_OUTCOMES.RENDERED;
}

function outcomeIsForbiddenByExpectation(normalizedCase = {}, outcome = '') {
  return asArray(normalizedCase.retrievalExpectation?.forbiddenOutcomes)
    .map((item) => normalizeOutcome(item, ''))
    .includes(outcome);
}

function outcomeIsAllowedByExpectation(normalizedCase = {}, outcome = '') {
  return asArray(normalizedCase.retrievalExpectation?.allowedSurvivalOutcomes)
    .map((item) => normalizeOutcome(item, ''))
    .includes(outcome);
}

function describeAnswerOutcome(answerOutcomeLike = null) {
  if (answerOutcomeLike === undefined || answerOutcomeLike === null || answerOutcomeLike === '') return '';
  if (typeof answerOutcomeLike === 'object') {
    const text = trimText([
      answerOutcomeLike.outcome,
      answerOutcomeLike.answerOutcome,
      answerOutcomeLike.supportOutcome,
      answerOutcomeLike.verdict,
      answerOutcomeLike.status,
      answerOutcomeLike.classification,
      answerOutcomeLike.reasonCode,
      answerOutcomeLike.reason,
    ].filter(Boolean).join(' '), 240);
    if (text) return text;
    if (answerOutcomeLike.passed === false) return 'passed=false';
    if (answerOutcomeLike.ok === false) return 'ok=false';
    if (answerOutcomeLike.supported === false) return 'supported=false';
    return '';
  }
  return trimText(answerOutcomeLike, 240);
}

function answerOutcomeIndicatesFailure(answerOutcomeLike = null) {
  if (answerOutcomeLike === undefined || answerOutcomeLike === null || answerOutcomeLike === '') return false;
  const text = normalizeKey(describeAnswerOutcome(answerOutcomeLike));
  if (!text || ['not-run', 'not-applicable', 'n-a', 'skipped'].includes(text)) return false;
  if (answerOutcomeLike && typeof answerOutcomeLike === 'object') {
    if (answerOutcomeLike.passed === false || answerOutcomeLike.ok === false || answerOutcomeLike.supported === false) {
      return true;
    }
  }
  return [
    'correct-but-unsupported',
    'unsupported',
    'wrong',
    'incorrect',
    'hallucinated',
    'fabricated',
    'failed',
    'fail',
    'invalid',
    'contradicted',
  ].some((needle) => text.includes(needle));
}

function buildCandidateFailureModeResult(failureMode = '', failureModeReason = '') {
  const normalizedMode = normalizeFailureMode(failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);
  const definition = CANDIDATE_FAILURE_MODE_DEFINITIONS[normalizedMode] || CANDIDATE_FAILURE_MODE_DEFINITIONS[CANDIDATE_FAILURE_MODES.NO_FAILURE];
  return {
    failureMode: normalizedMode,
    failureModeDefinition: definition.definition,
    failureModeReason: trimText(failureModeReason || definition.definition, 240),
    recommendedInspection: definition.recommendedInspection,
  };
}

function classifyCandidateFailureMode(caseLike = {}, survivalResult = null, traceLike = [], answerOutcomeLike = null) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const trace = normalizeTraceArray(traceLike);
  const survival = normalizeSurvivalResultForFailureMode(survivalResult, normalizedCase, trace);
  const outcome = normalizeOutcome(survival.outcome, normalizedCase.expectedSurvival || '');
  const bestExpected = survival.matchedExpectedCandidate
    || findBestTraceMatch(trace, (item) => matchCandidateAgainstOracle(item, normalizedCase.expected));
  const bestForbidden = survival.matchedForbiddenCandidate
    || findBestTraceMatch(trace, (item) => matchCandidateAgainstForbidden(item, normalizedCase.forbidden));
  const answerOutcome = describeAnswerOutcome(answerOutcomeLike);
  const expectsRendered = caseExpectsRenderedSupport(normalizedCase);

  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_RENDERED) {
    const label = getCandidateLabel(bestForbidden);
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.FORBIDDEN_RENDERED,
      label
        ? `Forbidden candidate rendered: ${label}.`
        : 'Forbidden candidate reached prompt-visible support.',
    );
  }
  if (
    outcome === CANDIDATE_SURVIVAL_OUTCOMES.RENDERED
    && (normalizedCase.retrievalExpectation?.shouldRender === false
      || outcomeIsForbiddenByExpectation(normalizedCase, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED))
  ) {
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.FORBIDDEN_RENDERED,
      'Candidate rendered even though the case contract forbids rendering.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_SELECTED) {
    const label = getCandidateLabel(bestForbidden);
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.WRONG_AUTHORITY_SELECTED,
      label
        ? `Forbidden or stale candidate selected: ${label}.`
        : 'Forbidden or stale candidate was selected over expected current support.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE) {
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.NOT_APPLICABLE,
      'Case is explicit-memory-owned or otherwise outside archive candidate survival.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.MISSING) {
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW,
      'Expected candidate did not appear in the raw pool.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY) {
    const reason = bestExpected?.heldBackReason || (bestExpected?.eligible === false ? 'eligible=false' : '');
    if (
      outcomeIsAllowedByExpectation(normalizedCase, CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY)
      && normalizedCase.retrievalExpectation?.shouldRender === false
      && normalizedCase.retrievalExpectation?.shouldSelect === false
    ) {
      return buildCandidateFailureModeResult(
        CANDIDATE_FAILURE_MODES.NO_FAILURE,
        reason
          ? `Expected candidate stayed suppressed before ranking: ${reason}.`
          : 'Expected candidate stayed suppressed before ranking.',
      );
    }
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.FILTERED_OUT,
      reason
        ? `Expected candidate stayed raw-only after filtering/gating: ${reason}.`
        : 'Expected candidate stayed raw-only and did not reach ranking.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED) {
    const rank = bestExpected?.rank ?? null;
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.LOW_RANK,
      rank !== null
        ? `Expected candidate ranked at ${rank} but was not selected or rendered.`
        : 'Expected candidate ranked but was not selected or rendered.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK) {
    if (expectsRendered || outcomeIsForbiddenByExpectation(normalizedCase, CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK)) {
      const reason = bestExpected?.heldBackReason || survival.heldBackReason || '';
      return buildCandidateFailureModeResult(
        CANDIDATE_FAILURE_MODES.SELECTED_NOT_RENDERED,
        reason
          ? `Expected candidate was selected but not rendered: ${reason}.`
          : 'Expected candidate was selected but not rendered.',
      );
    }
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.NO_FAILURE,
      'Expected candidate was selected and rendering was not required by this case.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.RENDERED && answerOutcomeIndicatesFailure(answerOutcomeLike)) {
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.ANSWER_LAYER_FAILURE,
      answerOutcome
        ? `Expected candidate rendered, but answer outcome failed: ${answerOutcome}.`
        : 'Expected candidate rendered, but answer outcome failed.',
    );
  }
  if (outcome === CANDIDATE_SURVIVAL_OUTCOMES.RENDERED) {
    return buildCandidateFailureModeResult(
      CANDIDATE_FAILURE_MODES.NO_FAILURE,
      'Expected candidate reached rendered support.',
    );
  }

  return buildCandidateFailureModeResult(
    CANDIDATE_FAILURE_MODES.NO_FAILURE,
    'No candidate-survival failure was detected from the provided normalized data.',
  );
}

function supportStateLooksVerified(support = {}) {
  const state = normalizeKey(support.supportState || support.state || '');
  const authority = normalizeKey(support.authority || '');
  return state === 'verified' || state === 'canonical' || authority === 'canonical';
}

function buildCandidateSurvivalArchiveUnitCaseResult({
  caseLike = {},
  retrievalResult = {},
  promptTruth = null,
  traceLike = null,
  topCandidateLimit = 8,
  profileComparison = null,
} = {}) {
  const normalizedCase = normalizeCandidateSurvivalCase(caseLike);
  const rawTrace = traceLike
    || retrievalResult?.retrieval?.candidateTrace
    || retrievalResult?.candidateTrace
    || [];
  const trace = applyPromptTruthToCandidateTrace(rawTrace, promptTruth);
  const classification = classifyCandidateSurvival(normalizedCase, trace);
  const failureClassification = classifyCandidateFailureMode(normalizedCase, classification, trace);
  const semanticMemory = retrievalResult?.semanticMemory && typeof retrievalResult.semanticMemory === 'object'
    ? retrievalResult.semanticMemory
    : {};
  const retrieval = retrievalResult?.retrieval && typeof retrievalResult.retrieval === 'object'
    ? retrievalResult.retrieval
    : {};
  const archiveContext = retrievalResult?.archiveContext && typeof retrievalResult.archiveContext === 'object'
    ? retrievalResult.archiveContext
    : {};
  const shadowComparison = buildHybridShadowComparison(normalizedCase, trace);
  const rerankerShadowComparison = buildRerankerShadowComparison(normalizedCase, trace, retrieval.rerankShadow);
  const linkAnalysis = buildCandidateLinkAnalysis({
    normalizedCase,
    traceLike: trace,
    classification,
    failureClassification,
  });
  const semanticClaimTrace = buildSemanticClaimTraceForCase(normalizedCase, trace, {
    limit: topCandidateLimit,
    measurementMode: 'archive-unit',
  });
  return {
    id: normalizedCase.id,
    query: normalizedCase.query,
    expected: normalizedCase.expected,
    forbidden: normalizedCase.forbidden,
    support: normalizedCase.support,
    retrievalExpectation: normalizedCase.retrievalExpectation,
    archiveUnit: {
      measurementMode: 'archive-unit',
      liveModelCalls: false,
      includeCandidateTrace: true,
      includeCandidateTraceLinks: true,
      semanticReady: semanticMemory.ready === true || retrieval.semanticReady === true || archiveContext.semanticReady === true,
      retrievalMode: String(retrieval.mode || archiveContext.mode || '').trim() || 'keyword',
      scoringProfile: String(retrieval.scoringProfile || archiveContext.scoringProfile || '').trim() || 'baseline',
      supportAuthority: normalizedCase.support.authority || normalizedCase.expected.sourceAuthority || '',
      supportState: normalizedCase.support.supportState || '',
      verifiedAnswerSupport: supportStateLooksVerified(normalizedCase.support),
      candidateSurvivalOnly: true,
    },
    survival: buildExpectedObjectSurvival(normalizedCase, trace, classification.outcome),
    failureMode: failureClassification.failureMode,
    failureModeReason: failureClassification.failureModeReason,
    recommendedInspection: failureClassification.recommendedInspection,
    forbiddenSurvival: buildForbiddenSurvival(normalizedCase, trace),
    linkAnalysis,
    semanticClaimTrace,
    ...(profileComparison ? { profileComparison } : {}),
    ...(shadowComparison ? { shadowComparison } : {}),
    ...(rerankerShadowComparison ? { rerankerShadowComparison } : {}),
    traceSummary: summarizeCandidateTrace(trace),
    topCandidates: buildTopCandidateSummaries(trace, normalizedCase, topCandidateLimit),
  };
}

function buildCandidateSurvivalArchiveUnitArtifact({
  generatedAt = new Date().toISOString(),
  cases = [],
  filePaths = {},
  cleanup = {},
  candidateTraceLimit = CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
  embeddingProviderComparison = null,
} = {}) {
  const normalizedCases = asArray(cases)
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      if (normalizeFailureMode(item.failureMode || '', '')) return item;
      const failureClassification = classifyCandidateFailureMode(item, { outcome: item.survival?.outcome || item.outcome }, []);
      return {
        ...item,
        failureMode: failureClassification.failureMode,
        failureModeReason: failureClassification.failureModeReason,
        recommendedInspection: failureClassification.recommendedInspection,
      };
    });
  return {
    schema: CANDIDATE_SURVIVAL_QA_SCHEMA,
    generatedAt,
    measurementMode: 'archive-unit',
    liveModelCalls: false,
    serverSpawned: false,
    apiChatCalls: false,
    includeCandidateTrace: true,
    includeCandidateTraceLinks: true,
    candidateTraceLimit,
    files: { ...filePaths },
    failureModeDefinitions: buildFailureModeDefinitionList(),
    cases: normalizedCases,
    cleanup,
    summary: summarizeCandidateSurvivalCases(normalizedCases),
    linkAnalysisSummary: buildCandidateLinkAnalysisSummary(normalizedCases),
    semanticClaimTraceSummary: buildSemanticClaimTraceArtifactSummary(normalizedCases),
    structuredCandidateContracts: buildStructuredCandidateContractQaFixture({ generatedAt }),
    rerankerShadow: buildRerankerShadowArtifactSummary(normalizedCases),
    ...(embeddingProviderComparison && typeof embeddingProviderComparison === 'object'
      ? { embeddingProviderComparison }
      : {}),
    candidateSurvivalCorrelation: buildCandidateSurvivalCorrelationSummary({
      generatedAt,
      measurementMode: 'archive-unit',
      cases: normalizedCases,
    }),
    limits: [
      'Candidate survival is retrieval-path evidence, not answer-quality evidence.',
      'This archive-unit mode does not generate live model answers.',
      'Explicit memory remains canonical; archive/session/global/research memories remain advisory.',
      'Semantic candidates are discovery machinery, not truth authority.',
      'Source-sensitive retrieval expectations do not make candidate-only hits verified answer support.',
      'Dynamic memory link analysis is advisory retrieval/navigation evidence only.',
      'Candidate-only/static/semantic links do not become verified support.',
      'PromptTruth remains prompt-time and memory/research-focused.',
      'Default prompt/rendered memory limits are unchanged.',
    ],
  };
}

function buildCandidateSurvivalQaFixture({
  generatedAt = new Date().toISOString(),
  cases = null,
} = {}) {
  const normalizedCases = (Array.isArray(cases) && cases.length ? cases : CANDIDATE_SURVIVAL_FIXTURE_CASES)
    .map((item) => normalizeCandidateSurvivalCase(item));
  const casesWithFailureModes = normalizedCases.map((item) => {
    const failureClassification = classifyCandidateFailureMode(item, { outcome: item.expectedSurvival }, []);
    return {
      ...item,
      failureMode: failureClassification.failureMode,
      failureModeReason: failureClassification.failureModeReason,
      recommendedInspection: failureClassification.recommendedInspection,
    };
  });
  return {
    schema: CANDIDATE_SURVIVAL_QA_SCHEMA,
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    outcomeDefinitions: buildOutcomeDefinitionList(),
    failureModeDefinitions: buildFailureModeDefinitionList(),
    cases: casesWithFailureModes,
    summary: summarizeCandidateSurvivalCases(casesWithFailureModes),
    linkAnalysisSummary: buildCandidateLinkAnalysisSummary(casesWithFailureModes),
    structuredCandidateContracts: buildStructuredCandidateContractQaFixture({ generatedAt }),
    rerankerShadow: buildRerankerShadowArtifactSummary(casesWithFailureModes),
    candidateSurvivalCorrelation: buildCandidateSurvivalCorrelationSummary({
      generatedAt,
      measurementMode: 'fixture-only',
      cases: casesWithFailureModes,
    }),
    limits: [
      'Candidate survival is retrieval evidence, not answer-quality evidence.',
      'Source-sensitive retrieval expectations are separate from answer-quality outcome buckets.',
      'PromptTruth remains prompt-context receipt only.',
      'Semantic candidates remain discovery-only unless rendered or canonized elsewhere.',
      'Dynamic memory links are retrieval/navigation hints, not proof.',
      'This artifact does not change default rendered context limits.',
    ],
  };
}

module.exports = {
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA,
  SEMANTIC_CLAIM_TRACE_SCHEMA,
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS,
  CANDIDATE_FAILURE_MODES,
  CANDIDATE_FAILURE_MODE_DEFINITIONS,
  CANDIDATE_LINK_FAILURE_MODES,
  CANDIDATE_LINK_VERDICTS,
  STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES,
  CANDIDATE_SURVIVAL_FIXTURE_CASES,
  CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
  applyPromptTruthToCandidateTrace,
  buildCandidateLinkAnalysis,
  buildCandidateLinkAnalysisSummary,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildCandidateSurvivalCorrelationSummary,
  buildSemanticClaimTraceForCase,
  buildSemanticClaimTraceArtifactSummary,
  buildCandidateSurvivalProfileComparison,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
  buildEmbeddingProviderComparison,
  buildRerankerShadowArtifactSummary,
  buildRerankerShadowComparison,
  buildStructuredCandidateContractQaFixture,
  buildStructuredCandidateContractSummary,
  classifyStructuredCandidateContract,
  classifyCandidateFailureMode,
  classifyCandidateSurvival,
  matchCandidateAgainstForbidden,
  matchCandidateAgainstOracle,
  normalizeCandidateSurvivalCase,
  normalizeCandidateTraceItem,
  summarizeCandidateTrace,
  summarizeCandidateSurvivalCases,
};
