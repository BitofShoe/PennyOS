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

  return {
    id: trimText(source.id || '', 120),
    query: trimText(source.query || source.prompt || '', 360),
    expected,
    forbidden,
    support,
    retrievalExpectation,
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

function normalizeCandidateTraceItem(itemLike = {}) {
  const source = itemLike && typeof itemLike === 'object' ? itemLike : { text: String(itemLike || '') };
  const stage = normalizeKey(source.stage || source.status || source.outcome || source.state || '');
  const rank = normalizeRank(source.rank ?? source.rankIndex ?? source.position ?? source.scoreRank);
  const shadowScores = normalizeCandidateShadowScores(source.shadowScores);
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
    shadowScores,
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
    return normalizeCandidateTraceItem({
      ...item,
      selected: true,
      rendered,
      heldBack: Boolean(heldBackReason),
      stage: rendered ? 'rendered' : (heldBackReason ? 'selected-held-back' : item.stage),
      heldBackReason,
    });
  });
}

function summarizeCandidateTrace(traceLike = []) {
  const trace = normalizeTraceArray(traceLike);
  return {
    rawCandidateCount: trace.filter((item) => item.raw).length,
    eligibleCandidateCount: trace.filter((item) => item.raw && item.eligible !== false).length,
    rankedCandidateCount: trace.filter((item) => item.ranked).length,
    selectedCandidateCount: trace.filter((item) => item.selected).length,
    renderedCandidateCount: trace.filter((item) => item.rendered).length,
    filteredSensitiveCount: trace.filter((item) => item.eligible === false && (
      item.sensitivity === 'high' || item.heldBackReason === 'sensitive-low-confidence'
    )).length,
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
    ...(profileComparison ? { profileComparison } : {}),
    ...(shadowComparison ? { shadowComparison } : {}),
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
    candidateTraceLimit,
    files: { ...filePaths },
    failureModeDefinitions: buildFailureModeDefinitionList(),
    cases: normalizedCases,
    cleanup,
    summary: summarizeCandidateSurvivalCases(normalizedCases),
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
      'This artifact does not change default rendered context limits.',
    ],
  };
}

module.exports = {
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_OUTCOME_DEFINITIONS,
  CANDIDATE_FAILURE_MODES,
  CANDIDATE_FAILURE_MODE_DEFINITIONS,
  CANDIDATE_SURVIVAL_FIXTURE_CASES,
  CANDIDATE_SURVIVAL_ARCHIVE_UNIT_TRACE_LIMIT,
  applyPromptTruthToCandidateTrace,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildCandidateSurvivalCorrelationSummary,
  buildCandidateSurvivalProfileComparison,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
  classifyCandidateFailureMode,
  classifyCandidateSurvival,
  matchCandidateAgainstForbidden,
  matchCandidateAgainstOracle,
  normalizeCandidateSurvivalCase,
  normalizeCandidateTraceItem,
  summarizeCandidateTrace,
  summarizeCandidateSurvivalCases,
};
