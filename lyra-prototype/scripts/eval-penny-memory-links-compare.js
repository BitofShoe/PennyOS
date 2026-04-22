const fs = require('fs');
const path = require('path');

const {
  PENNY_MEMORY_LINKS_SCHEMA,
  DEFAULT_MEMORY_LINK_LIMITS,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_MEASUREMENT_MODES,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  buildMemoryLinkTraceForItem,
  normalizeMemoryLinkSet,
  summarizeMemoryLinks,
} = require('../lib/penny-memory-links');
const {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
  PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA,
  PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA,
  MEMORY_LINK_SCORING_MODES,
  buildCorrectionLinks,
  scoreMemoryLinkCorrectionActiveForCandidate,
  scoreMemoryLinkShadowForCandidate,
} = require('../lib/penny-memory-link-policy');
const {
  ALIVENESS_OUTCOMES,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

const MEMORY_LINKS_COMPARE_SCHEMA = 'penny-memory-links-compare.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `memory-links-compare-${STAMP}.json`);
const MODE_ORDER = Object.freeze([
  'links-off',
  'links-trace-only',
  'links-shadow',
  'correction-links-active',
  'project-links-shadow',
]);
const MODE_CONFIGS = Object.freeze({
  'links-off': Object.freeze({
    key: 'links-off',
    label: 'Links off',
    linkSource: 'none',
    includeTrace: false,
    includeShadow: false,
    scoringMode: MEMORY_LINK_SCORING_MODES.OFF,
    activeCorrectionScoring: false,
    projectResearchOpenLoopScoringActive: false,
  }),
  'links-trace-only': Object.freeze({
    key: 'links-trace-only',
    label: 'Link traces only',
    linkSource: 'all',
    includeTrace: true,
    includeShadow: false,
    scoringMode: MEMORY_LINK_SCORING_MODES.OFF,
    activeCorrectionScoring: false,
    projectResearchOpenLoopScoringActive: false,
  }),
  'links-shadow': Object.freeze({
    key: 'links-shadow',
    label: 'All links shadow-scored',
    linkSource: 'all',
    includeTrace: true,
    includeShadow: true,
    scoringMode: MEMORY_LINK_SCORING_MODES.SHADOW,
    activeCorrectionScoring: false,
    projectResearchOpenLoopScoringActive: false,
  }),
  'correction-links-active': Object.freeze({
    key: 'correction-links-active',
    label: 'Correction links active behind gate',
    linkSource: 'all',
    includeTrace: true,
    includeShadow: true,
    scoringMode: MEMORY_LINK_SCORING_MODES.CORRECTION_V1,
    activeCorrectionScoring: true,
    projectResearchOpenLoopScoringActive: false,
  }),
  'project-links-shadow': Object.freeze({
    key: 'project-links-shadow',
    label: 'Project, open-loop, and research links shadow only',
    linkSource: 'broad-only',
    includeTrace: true,
    includeShadow: true,
    scoringMode: MEMORY_LINK_SCORING_MODES.SHADOW,
    activeCorrectionScoring: false,
    projectResearchOpenLoopScoringActive: false,
  }),
});

const CORRECTION_RELATIONS = new Set([
  MEMORY_LINK_RELATIONS.CORRECTION_OF,
  MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
  MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
]);

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 2) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function list(value = []) {
  return Array.isArray(value) ? value : [];
}

function estimateTokens(text = '') {
  const source = String(text || '').trim();
  if (!source) return 0;
  const words = (source.match(/\S+/g) || []).length;
  return Math.max(words, Math.ceil(source.length / 4));
}

function rankByScore(rows = [], scoreKey = 'activeAdjustedScore') {
  return list(rows)
    .slice()
    .sort((left, right) => (
      Number(right[scoreKey] || 0) - Number(left[scoreKey] || 0)
        || String(left.id || '').localeCompare(String(right.id || ''))
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildCorrectionLinkSet({
  generatedAt,
  subject,
  staleItem,
  currentItem,
  staleObject,
  currentObject,
  staleAuthorityEffect,
} = {}) {
  return buildCorrectionLinks({
    generatedAt,
    measurementMode: MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    subject,
    staleItem,
    currentItem,
    staleObject,
    currentObject,
    staleAuthorityEffect,
    supportState: 'explicit',
    sourceReceipts: [
      {
        type: 'fixture-correction',
        id: `${subject || 'correction'}-explicit`,
        excerpt: `Explicit correction from ${staleObject || 'stale'} to ${currentObject || 'current'}.`,
      },
    ],
  }, { now: generatedAt });
}

function buildCandidateOnlyCorrectionLinkSet(generatedAt) {
  return buildCorrectionLinks({
    generatedAt,
    measurementMode: MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    subject: 'laundromat dryer object',
    staleItem: { id: 'static:dryer-three-silver-thermos', object: 'silver thermos' },
    currentItem: { id: 'semantic:dryer-three-blue-bottle', object: 'blue bottle' },
    staleObject: 'silver thermos',
    currentObject: 'blue bottle',
    supportState: 'semantic-candidate',
    sourceReceipts: [
      { type: 'semantic-fixture', id: 'candidate-only-dryer-similarity' },
    ],
  }, { now: generatedAt });
}

function buildBroadProjectLinkSet(generatedAt) {
  return normalizeMemoryLinkSet({
    generatedAt,
    measurementMode: MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    links: [
      {
        id: 'static-live-frame-budget-thread',
        sourceId: 'plan:static-live-advisory',
        targetId: 'principle:frame-budget',
        relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
        confidence: 'medium',
        support: {
          state: 'research',
          sourceReceipts: [
            { type: 'plan', path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/01-static-memory-reflex-plan.md' },
            { type: 'doc', path: 'README.md', excerpt: 'Penny Frame Budget Principle' },
          ],
          explanation: 'Both discuss bounded advisory memory retrieval under a frame budget.',
        },
        directionality: 'bidirectional',
        createdBy: 'fixture',
      },
      {
        id: 'open-loop-correction-guardrail-about-frame-budget',
        sourceId: 'open-loop:correction-guardrails',
        targetId: 'principle:frame-budget',
        relation: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
        confidence: 'medium',
        support: {
          state: 'unknown',
          sourceReceipts: [
            { type: 'fixture-open-loop', id: 'correction-guardrails' },
          ],
          explanation: 'The open loop points toward measuring correction guardrails before broad memory activation.',
        },
        createdBy: 'fixture',
      },
      {
        id: 'ledger-bridge-pattern-for-frame-budget',
        sourceId: 'research:ledger-bridge-lesson',
        targetId: 'principle:frame-budget',
        relation: MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
        confidence: 'medium',
        support: {
          state: 'research',
          sourceReceipts: [
            { type: 'doc', path: 'docs/penny-ledger-prompt-compare-note-2026-04-17.md' },
          ],
          explanation: 'Both favor measured continuity over broad prompt stuffing.',
        },
        createdBy: 'fixture',
      },
    ],
  }, { now: generatedAt });
}

function buildWeakLinkSet(generatedAt) {
  return normalizeMemoryLinkSet({
    generatedAt,
    measurementMode: MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    links: [
      {
        id: 'weak-rain-semantic-candidate',
        sourceId: 'semantic:midnight-rain-window',
        targetId: 'memory:midnight-rain-safety',
        relation: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
        confidence: 'low',
        support: {
          state: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
          sourceReceipts: [
            { type: 'semantic-fixture', id: 'candidate-only-rain-similarity' },
          ],
          explanation: 'Lexically similar but authority-unrelated memory candidates.',
        },
        authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
        createdBy: 'fixture',
      },
    ],
  }, { now: generatedAt });
}

function buildCompareCases(generatedAt = '2026-04-22T19:00:00.000Z') {
  return [
    {
      id: 'correction-current-truth-mascot',
      title: 'Correction current truth',
      relationClass: 'correction-chain',
      expectedCurrentId: 'memory:copper-rabbit',
      expectedStaleId: 'archive:brass-fox',
      humanVisibleWin: true,
      query: 'What is the coding mascot now?',
      linkSet: buildCorrectionLinkSet({
        generatedAt,
        subject: 'coding mascot',
        staleItem: { id: 'archive:brass-fox', text: 'The coding mascot was a brass fox.' },
        currentItem: { id: 'memory:copper-rabbit', text: 'The coding mascot is a copper rabbit now.' },
        staleObject: 'brass fox',
        currentObject: 'copper rabbit',
      }),
      candidates: [
        {
          id: 'archive:brass-fox',
          text: 'The coding mascot was a brass fox.',
          baseScore: 8.4,
          sourceAuthority: 'advisory',
          role: 'stale',
        },
        {
          id: 'memory:copper-rabbit',
          text: 'Correction: the coding mascot is a copper rabbit now, not a brass fox.',
          baseScore: 6.2,
          sourceAuthority: 'explicit',
          role: 'current',
        },
      ],
    },
    {
      id: 'correction-stale-suppression-watch',
      title: 'Stale correction suppression',
      relationClass: 'correction-chain',
      expectedCurrentId: 'memory:gold-watch',
      expectedStaleId: 'archive:silver-watch',
      humanVisibleWin: true,
      query: 'What watch did the arcade cashier wear?',
      linkSet: buildCorrectionLinkSet({
        generatedAt,
        subject: 'arcade cashier watch',
        staleItem: { id: 'archive:silver-watch', text: 'The arcade cashier wore a silver watch.' },
        currentItem: { id: 'memory:gold-watch', text: 'Correction: the arcade cashier watch is gold now.' },
        staleObject: 'silver watch',
        currentObject: 'gold watch',
        staleAuthorityEffect: 'do-not-render-as-current',
      }),
      candidates: [
        {
          id: 'archive:silver-watch',
          text: 'The arcade cashier wore a silver watch.',
          baseScore: 8.8,
          sourceAuthority: 'advisory',
          role: 'stale',
        },
        {
          id: 'memory:gold-watch',
          text: 'Correction: the arcade cashier watch is gold now, not silver.',
          baseScore: 6.4,
          sourceAuthority: 'explicit',
          role: 'current',
        },
      ],
    },
    {
      id: 'candidate-only-correction-boundary',
      title: 'Candidate-only correction boundary',
      relationClass: 'candidate-only-boundary',
      expectedCurrentId: 'semantic:dryer-three-blue-bottle',
      expectedStaleId: 'static:dryer-three-silver-thermos',
      expectNoActiveChange: true,
      query: 'What was on dryer three?',
      linkSet: buildCandidateOnlyCorrectionLinkSet(generatedAt),
      candidates: [
        {
          id: 'static:dryer-three-silver-thermos',
          text: 'A silver thermos was on dryer three.',
          baseScore: 7.6,
          sourceAuthority: 'advisory',
          role: 'stale-candidate',
        },
        {
          id: 'semantic:dryer-three-blue-bottle',
          text: 'A blue bottle may be related to dryer three.',
          baseScore: 6.8,
          sourceAuthority: 'semantic-candidate',
          role: 'candidate-only-current',
        },
      ],
    },
    {
      id: 'project-thread-shadow-continuity',
      title: 'Project thread shadow continuity',
      relationClass: 'project-research-open-loop-shadow',
      expectedContinuityId: 'principle:frame-budget',
      expectActiveUnchanged: true,
      query: 'Which prior principle should static live-advisory compare against?',
      linkSet: buildBroadProjectLinkSet(generatedAt),
      candidates: [
        {
          id: 'plan:static-live-advisory',
          text: 'Static live-advisory plan can query live static memory sidecars.',
          baseScore: 5.15,
          sourceAuthority: 'research',
          role: 'adjacent-project',
        },
        {
          id: 'principle:frame-budget',
          text: 'Penny Frame Budget Principle: spend frame on relevance, authority, and candidate selection first.',
          baseScore: 4.85,
          sourceAuthority: 'research',
          role: 'continuity-target',
        },
        {
          id: 'research:ledger-bridge-lesson',
          text: 'Ledger bridge lesson: measured bounded continuity beats broad prompt stuffing.',
          baseScore: 4.4,
          sourceAuthority: 'research',
          role: 'pattern-reference',
        },
      ],
    },
    {
      id: 'weak-semantic-link-boundary',
      title: 'Weak semantic boundary',
      relationClass: 'related-but-weak',
      expectedCurrentId: 'memory:midnight-rain-safety',
      expectNoActiveChange: true,
      query: 'Is the midnight rain memory verified support?',
      linkSet: buildWeakLinkSet(generatedAt),
      candidates: [
        {
          id: 'memory:midnight-rain-safety',
          text: 'Verified note: midnight rain is a relaxation cue, not safety proof.',
          baseScore: 8.9,
          sourceAuthority: 'verified',
          role: 'verified',
        },
        {
          id: 'semantic:midnight-rain-window',
          text: 'Candidate-only rain memory from a window scene.',
          baseScore: 7.1,
          sourceAuthority: 'semantic-candidate',
          role: 'candidate-only',
        },
      ],
    },
  ];
}

function filterLinksForMode(linkSet = {}, modeConfig = MODE_CONFIGS['links-off']) {
  if (modeConfig.linkSource === 'none') return [];
  const links = list(linkSet.links);
  if (modeConfig.linkSource === 'broad-only') {
    return links.filter((link) => !CORRECTION_RELATIONS.has(link.relation));
  }
  return links;
}

function rankCaseCandidates(caseSpec = {}, modeConfig = MODE_CONFIGS['links-off']) {
  const baseRows = rankByScore(
    list(caseSpec.candidates).map((candidate) => ({
      ...candidate,
      activeAdjustedScore: Number(candidate.baseScore || 0),
    })),
    'activeAdjustedScore',
  );
  const baseRankById = new Map(baseRows.map((row) => [row.id, row.rank]));
  const links = filterLinksForMode(caseSpec.linkSet, modeConfig);
  const shadowDrafts = baseRows.map((candidate) => {
    if (!modeConfig.includeShadow) {
      return {
        candidate,
        shadowAdjustedScore: Number(candidate.baseScore || 0),
        linkShadowScore: null,
      };
    }
    const linkShadowScore = scoreMemoryLinkShadowForCandidate(candidate, {
      memoryLinks: links,
      activeScore: Number(candidate.baseScore || 0),
      activeRank: baseRankById.get(candidate.id),
    });
    return {
      candidate,
      shadowAdjustedScore: linkShadowScore.shadowAdjustedScore,
      linkShadowScore,
    };
  });
  const shadowRanks = new Map(rankByScore(shadowDrafts.map((item) => ({
    id: item.candidate.id,
    activeAdjustedScore: item.shadowAdjustedScore,
  })), 'activeAdjustedScore').map((row) => [row.id, row.rank]));

  const rows = baseRows.map((candidate) => {
    const shadowRank = shadowRanks.get(candidate.id) || baseRankById.get(candidate.id);
    const linkShadowScore = modeConfig.includeShadow
      ? scoreMemoryLinkShadowForCandidate(candidate, {
        memoryLinks: links,
        activeScore: Number(candidate.baseScore || 0),
        activeRank: baseRankById.get(candidate.id),
        shadowRank,
      })
      : null;
    const linkActiveScore = scoreMemoryLinkCorrectionActiveForCandidate(candidate, {
      memoryLinks: links,
      memoryLinkScoring: modeConfig.scoringMode,
      activeScore: Number(candidate.baseScore || 0),
      activeRank: baseRankById.get(candidate.id),
      shadowRank,
      linkShadowScore: linkShadowScore || undefined,
    });
    const activeAdjustedScore = round(Number(candidate.baseScore || 0) + Number(linkActiveScore.score || 0), 3);
    const memoryLinkTrace = modeConfig.includeTrace
      ? buildMemoryLinkTraceForItem(links, candidate.id, { linkTraceLimit: 6 })
      : null;
    return {
      id: candidate.id,
      text: candidate.text,
      role: candidate.role || '',
      sourceAuthority: candidate.sourceAuthority || '',
      baseScore: Number(candidate.baseScore || 0),
      baseRank: baseRankById.get(candidate.id),
      shadowAdjustedScore: linkShadowScore ? linkShadowScore.shadowAdjustedScore : Number(candidate.baseScore || 0),
      shadowRank,
      activeAdjustedScore,
      linkShadowScore,
      linkActiveScore,
      memoryLinkTrace,
    };
  });
  const activeRanks = new Map(rankByScore(rows, 'activeAdjustedScore').map((row) => [row.id, row.rank]));
  return rows.map((row) => ({
    ...row,
    activeRank: activeRanks.get(row.id),
  })).sort((left, right) => left.activeRank - right.activeRank);
}

function buildMockReply(caseSpec = {}, selected = {}, analysis = {}) {
  if (caseSpec.relationClass === 'correction-chain') {
    if (analysis.correctionCurrentTruthWin) {
      return `Selected current correction candidate ${selected.id}; the link is a retrieval hint, while explicit correction support remains the authority.`;
    }
    return `Selected stale candidate ${selected.id}; this is a stale-memory risk, not proof the old value is true.`;
  }
  if (caseSpec.relationClass === 'candidate-only-boundary') {
    return 'Candidate-only correction links stay advisory and do not become verified support.';
  }
  if (caseSpec.relationClass === 'project-research-open-loop-shadow') {
    if (analysis.continuityWin) {
      return 'Project/open-loop/research links would improve navigation in shadow, but they remain inactive advisory links.';
    }
    return 'No active project-link behavior changed.';
  }
  return 'Weak semantic links remain navigation hints, not support.';
}

function analyzeRankedCase(caseSpec = {}, rows = [], modeConfig = MODE_CONFIGS['links-off']) {
  const selected = rows.find((row) => row.activeRank === 1) || rows[0] || {};
  const shadowTop = rows.slice().sort((left, right) => left.shadowRank - right.shadowRank)[0] || {};
  const expectedCurrent = caseSpec.expectedCurrentId || '';
  const expectedStale = caseSpec.expectedStaleId || '';
  const expectedContinuity = caseSpec.expectedContinuityId || '';
  const expectedCurrentRow = rows.find((row) => row.id === expectedCurrent) || null;
  const expectedStaleRow = rows.find((row) => row.id === expectedStale) || null;
  const correctionCurrentTruthWin = !!expectedCurrent
    && caseSpec.relationClass === 'correction-chain'
    && selected.id === expectedCurrent;
  const staleMemoryRegression = !!expectedStale
    && caseSpec.relationClass === 'correction-chain'
    && selected.id === expectedStale
    && modeConfig.activeCorrectionScoring === true;
  const candidateOnlyActiveScore = rows.some((row) => (
    caseSpec.relationClass === 'candidate-only-boundary'
    && Number(row.linkActiveScore?.score || 0) !== 0
  ));
  const candidateOnlyVerifiedSupport = rows.some((row) => (
    row.linkActiveScore?.candidateOnlyVerifiedSupport === true
    || row.linkShadowScore?.candidateOnlyVerifiedSupport === true
  ));
  const broadActiveScore = rows.some((row) => {
    const activeReasons = list(row.linkActiveScore?.reasons);
    return modeConfig.projectResearchOpenLoopScoringActive === true
      || activeReasons.some((reason) => (
        /^active-(?:same-project-thread|open-loop-about|research-pattern):/.test(String(reason || ''))
      ));
  });
  const sourceAuthorityFailure = candidateOnlyActiveScore || candidateOnlyVerifiedSupport;
  const overclaimRegression = sourceAuthorityFailure || broadActiveScore;
  const continuityWin = !!expectedContinuity
    && modeConfig.includeShadow === true
    && shadowTop.id === expectedContinuity
    && modeConfig.projectResearchOpenLoopScoringActive === false;
  const promptText = '';

  return {
    selectedCandidateId: selected.id || '',
    shadowTopCandidateId: shadowTop.id || '',
    expectedCurrentCandidateId: expectedCurrent,
    expectedStaleCandidateId: expectedStale,
    expectedContinuityCandidateId: expectedContinuity,
    correctionCurrentTruthWin,
    staleMemoryRegression,
    sourceAuthorityFailure,
    continuityWin,
    overclaimRegression,
    broadProjectResearchOpenLoopScoringActive: modeConfig.projectResearchOpenLoopScoringActive === true,
    candidateOnlyVerifiedSupport,
    candidateOnlyActiveScore,
    promptTokenEstimate: estimateTokens(promptText),
    firstTokenMs: null,
    totalLatencyMs: null,
    candidateSurvivalRankDelta: {
      expectedCurrent: expectedCurrentRow
        ? Number(expectedCurrentRow.baseRank || 0) - Number(expectedCurrentRow.activeRank || 0)
        : null,
      expectedCurrentShadow: expectedCurrentRow
        ? Number(expectedCurrentRow.baseRank || 0) - Number(expectedCurrentRow.shadowRank || 0)
        : null,
      expectedStale: expectedStaleRow
        ? Number(expectedStaleRow.baseRank || 0) - Number(expectedStaleRow.activeRank || 0)
        : null,
      expectedStaleShadow: expectedStaleRow
        ? Number(expectedStaleRow.baseRank || 0) - Number(expectedStaleRow.shadowRank || 0)
        : null,
    },
  };
}

function runCaseInMode(caseSpec = {}, modeConfig = MODE_CONFIGS['links-off']) {
  const rows = rankCaseCandidates(caseSpec, modeConfig);
  const analysis = analyzeRankedCase(caseSpec, rows, modeConfig);
  const selected = rows.find((row) => row.id === analysis.selectedCandidateId) || rows[0] || {};
  return {
    id: caseSpec.id,
    title: caseSpec.title,
    relationClass: caseSpec.relationClass,
    query: caseSpec.query,
    selectedCandidateId: analysis.selectedCandidateId,
    shadowTopCandidateId: analysis.shadowTopCandidateId,
    mockReply: buildMockReply(caseSpec, selected, analysis),
    candidates: rows,
    linkSummary: summarizeMemoryLinks(filterLinksForMode(caseSpec.linkSet, modeConfig)),
    analysis,
  };
}

function runMode(modeConfig, { cases = buildCompareCases() } = {}) {
  const modeCases = cases.map((caseSpec) => runCaseInMode(caseSpec, modeConfig));
  const links = cases.flatMap((caseSpec) => filterLinksForMode(caseSpec.linkSet, modeConfig));
  return {
    mode: modeConfig.key,
    label: modeConfig.label,
    environment: {
      valid: true,
      reasons: [],
    },
    scoringMode: modeConfig.scoringMode,
    activeCorrectionScoring: modeConfig.activeCorrectionScoring,
    projectResearchOpenLoopScoringActive: modeConfig.projectResearchOpenLoopScoringActive,
    behaviorChanged: false,
    liveModelCalls: false,
    serverSpawned: false,
    linkSummary: summarizeMemoryLinks(links),
    cases: modeCases,
    metrics: summarizeModeMetrics(modeCases),
  };
}

function summarizeModeMetrics(modeCases = []) {
  const cases = list(modeCases);
  return {
    caseCount: cases.length,
    correctionCurrentTruthWins: cases.filter((item) => item.analysis.correctionCurrentTruthWin).length,
    staleMemoryRegressions: cases.filter((item) => item.analysis.staleMemoryRegression).length,
    sourceAuthorityFailures: cases.filter((item) => item.analysis.sourceAuthorityFailure).length,
    continuityWins: cases.filter((item) => item.analysis.continuityWin).length,
    overclaimRegressions: cases.filter((item) => item.analysis.overclaimRegression).length,
    promptTokenEstimate: cases.reduce((sum, item) => sum + Number(item.analysis.promptTokenEstimate || 0), 0),
    averageFirstTokenMs: null,
    averageTotalLatencyMs: null,
    activeCorrectionScoreCount: cases.reduce((sum, item) => (
      sum + item.candidates.filter((candidate) => candidate.linkActiveScore?.active === true && Number(candidate.linkActiveScore?.score || 0) !== 0).length
    ), 0),
    broadActiveScoreCount: cases.filter((item) => item.analysis.broadProjectResearchOpenLoopScoringActive).length,
    traceCandidateCount: cases.reduce((sum, item) => (
      sum + item.candidates.filter((candidate) => candidate.memoryLinkTrace).length
    ), 0),
    candidateOnlyVerifiedSupportCount: cases.filter((item) => item.analysis.candidateOnlyVerifiedSupport).length,
    maxExpectedCurrentRankGain: cases.reduce((max, item) => {
      const value = Number(item.analysis.candidateSurvivalRankDelta.expectedCurrent || 0);
      return Math.max(max, value);
    }, 0),
    maxExpectedCurrentShadowRankGain: cases.reduce((max, item) => {
      const value = Number(item.analysis.candidateSurvivalRankDelta.expectedCurrentShadow || 0);
      return Math.max(max, value);
    }, 0),
  };
}

function metricDelta(leftValue, rightValue) {
  if (leftValue === null || rightValue === null || leftValue === undefined || rightValue === undefined) return null;
  return round(Number(rightValue) - Number(leftValue), 2);
}

function buildCaseDiffs(left = null, right = null) {
  const leftById = new Map(list(left?.cases).map((item) => [item.id, item]));
  return list(right?.cases).map((item) => {
    const base = leftById.get(item.id) || null;
    const correctionCurrentTruthGain = item.analysis.correctionCurrentTruthWin === true
      && base?.analysis?.correctionCurrentTruthWin !== true;
    const continuityGain = item.analysis.continuityWin === true
      && base?.analysis?.continuityWin !== true;
    const staleMemoryRegression = item.analysis.staleMemoryRegression === true
      && base?.analysis?.staleMemoryRegression !== true;
    const sourceAuthorityFailure = item.analysis.sourceAuthorityFailure === true
      && base?.analysis?.sourceAuthorityFailure !== true;
    const overclaimRegression = item.analysis.overclaimRegression === true
      && base?.analysis?.overclaimRegression !== true;
    const promptTokenDelta = Number(item.analysis.promptTokenEstimate || 0)
      - Number(base?.analysis?.promptTokenEstimate || 0);
    return {
      id: item.id,
      relationClass: item.relationClass,
      leftSelectedCandidateId: base?.analysis?.selectedCandidateId || '',
      rightSelectedCandidateId: item.analysis.selectedCandidateId,
      correctionCurrentTruthGain,
      continuityGain,
      staleMemoryRegression,
      sourceAuthorityFailure,
      overclaimRegression,
      promptTokenDelta,
      firstTokenLatencyDelta: metricDelta(base?.analysis?.firstTokenMs, item.analysis.firstTokenMs),
      totalLatencyDelta: metricDelta(base?.analysis?.totalLatencyMs, item.analysis.totalLatencyMs),
      candidateSurvivalRankDelta: item.analysis.candidateSurvivalRankDelta,
      humanObservable: (correctionCurrentTruthGain || continuityGain)
        && !staleMemoryRegression
        && !sourceAuthorityFailure
        && !overclaimRegression,
    };
  });
}

function buildAlivenessCaseSummaries(caseDiffs = []) {
  return list(caseDiffs).map((item) => ({
    id: item.id,
    deltas: {
      humanObservableWin: item.humanObservable,
      continuityWin: item.continuityGain,
      correctionSafe: !item.staleMemoryRegression,
      sourceBoundaryFailure: item.sourceAuthorityFailure,
      overclaimRegression: item.overclaimRegression,
      promptTokenDelta: item.promptTokenDelta,
      firstTokenLatencyDeltaMs: item.firstTokenLatencyDelta,
      totalLatencyDeltaMs: item.totalLatencyDelta,
    },
  }));
}

function buildCompareSummary(modes = []) {
  const byMode = new Map(list(modes).map((mode) => [mode.mode, mode]));
  const off = byMode.get('links-off') || null;
  const active = byMode.get('correction-links-active') || null;
  const projectShadow = byMode.get('project-links-shadow') || null;
  const primaryDiffs = buildCaseDiffs(off, active);
  const projectDiffs = buildCaseDiffs(off, projectShadow);
  const activeMetrics = active?.metrics || {};
  const offMetrics = off?.metrics || {};
  const projectMetrics = projectShadow?.metrics || {};
  const correctionCurrentTruthWins = Number(activeMetrics.correctionCurrentTruthWins || 0);
  const staleMemoryRegressions = Number(activeMetrics.staleMemoryRegressions || 0);
  const sourceAuthorityFailures = Number(activeMetrics.sourceAuthorityFailures || 0);
  const overclaimRegressions = Number(activeMetrics.overclaimRegressions || 0);
  const promptTokenDelta = Number(activeMetrics.promptTokenEstimate || 0) - Number(offMetrics.promptTokenEstimate || 0);
  const projectContinuityWins = Number(projectMetrics.continuityWins || 0);
  const environmentValid = modes.every((mode) => mode.environment?.valid !== false);
  const correctionEligible = environmentValid
    && correctionCurrentTruthWins >= 2
    && staleMemoryRegressions === 0
    && sourceAuthorityFailures === 0
    && overclaimRegressions === 0
    && Number(activeMetrics.candidateOnlyVerifiedSupportCount || 0) === 0
    && Number(activeMetrics.broadActiveScoreCount || 0) === 0
    && promptTokenDelta === 0;
  const alivenessSummary = summarizeAlivenessCompare(buildAlivenessCaseSummaries(primaryDiffs));

  return {
    primaryModes: ['links-off', 'correction-links-active'],
    comparedModes: MODE_ORDER,
    pairedVerdict: correctionEligible ? 'correction-links-active' : 'links-shadow',
    enablementRecommendation: correctionEligible
      ? 'eligible-for-gated-correction-v1-review'
      : 'keep-shadow-only',
    defaultScoringRecommendation: 'keep-default-shadow',
    projectResearchOpenLoopRecommendation: 'shadow-only-until-separately-measured',
    correctionCurrentTruthWins,
    staleMemoryRegressions,
    sourceAuthorityFailures,
    continuityWins: projectContinuityWins,
    overclaimRegressions,
    promptTokenDelta,
    firstTokenLatencyDelta: metricDelta(offMetrics.averageFirstTokenMs, activeMetrics.averageFirstTokenMs),
    totalLatencyDelta: metricDelta(offMetrics.averageTotalLatencyMs, activeMetrics.averageTotalLatencyMs),
    candidateSurvivalRankDelta: {
      maxExpectedCurrentRankGain: Number(activeMetrics.maxExpectedCurrentRankGain || 0),
      maxExpectedCurrentShadowRankGain: Number(activeMetrics.maxExpectedCurrentShadowRankGain || 0),
      projectShadowExpectedCurrentShadowRankGain: Number(projectMetrics.maxExpectedCurrentShadowRankGain || 0),
    },
    runtimeMetrics: {
      measurementStatus: 'not-run',
      promptTokenDelta,
      firstTokenLatencyDelta: null,
      totalLatencyDelta: null,
    },
    trustVerdict: environmentValid ? (correctionEligible ? 'pass' : 'ambiguous') : 'invalid',
    primaryCaseDiffs: primaryDiffs,
    projectShadowCaseDiffs: projectDiffs,
    perMode: Object.fromEntries(modes.map((mode) => [mode.mode, mode.metrics])),
    alivenessSummary,
    acceptance: {
      correctionLinksClearWins: correctionCurrentTruthWins >= 2,
      staleMemoryRegressionsZero: staleMemoryRegressions === 0,
      sourceAuthorityFailuresZero: sourceAuthorityFailures === 0,
      overclaimRegressionsZero: overclaimRegressions === 0,
      promptTokenDeltaZero: promptTokenDelta === 0,
      candidateOnlyVerifiedSupportZero: Number(activeMetrics.candidateOnlyVerifiedSupportCount || 0) === 0,
      broadProjectResearchOpenLoopScoringInactive: Number(activeMetrics.broadActiveScoreCount || 0) === 0,
      projectLinksRemainShadow: true,
      noPromptTruthExpansion: true,
      noToolEvidenceReceiptMerge: true,
      noRuntimeVoiceChange: true,
      noCanonicalMemoryWrites: true,
    },
    blockedOutcomes: correctionEligible
      ? []
      : [
        ...(overclaimRegressions ? [ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION] : []),
        ...(sourceAuthorityFailures ? [ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE] : []),
        ...(staleMemoryRegressions ? [ALIVENESS_OUTCOMES.CORRECTION_FAILURE] : []),
      ],
  };
}

function buildMemoryLinksCompareArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildCompareCases(generatedAt),
} = {}) {
  const modes = MODE_ORDER.map((mode) => runMode(MODE_CONFIGS[mode], { cases }));
  const summary = buildCompareSummary(modes);
  const allLinks = cases.flatMap((caseSpec) => list(caseSpec.linkSet?.links));

  return {
    schema: MEMORY_LINKS_COMPARE_SCHEMA,
    memoryLinksSchema: PENNY_MEMORY_LINKS_SCHEMA,
    correctionBuilderSchema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
    linkShadowScoreSchema: PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA,
    linkActiveScoreSchema: PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA,
    artifactKind: 'dynamic-memory-links-compare',
    generatedAt,
    measurementMode: 'fixture-compare',
    runnerMode: 'fixture-only',
    behaviorChanged: false,
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    livePromptBridge: false,
    liveUserMemoryTouched: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    advisoryMemoryPromotion: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    toolEvidenceReceiptMerged: false,
    runtimeVoiceChanged: false,
    graphDbMigration: false,
    universalMemoryIndexBuilt: false,
    broadProjectResearchOpenLoopScoringActivated: false,
    candidateOnlyVerifiedSupport: false,
    modes,
    cases: cases.map((caseSpec) => ({
      id: caseSpec.id,
      title: caseSpec.title,
      relationClass: caseSpec.relationClass,
      query: caseSpec.query,
      candidateIds: list(caseSpec.candidates).map((candidate) => candidate.id),
      linkSummary: summarizeMemoryLinks(list(caseSpec.linkSet?.links)),
    })),
    linkSummary: summarizeMemoryLinks(allLinks),
    summary,
    limits: [
      ...DEFAULT_MEMORY_LINK_LIMITS,
      'This compare is fixture-only: no server spawn, no LM Studio calls, and no live prompt bridge.',
      'Correction links may be measured for gated correction-v1 use; they still do not prove either endpoint true.',
      'Project-thread, open-loop, and research-pattern links remain advisory/shadow until separately measured.',
      'Candidate-only/static/semantic links do not become verified support.',
      'PromptTruth, toolEvidenceReceipt, runtime voice, prompt limits, graph storage, and memory promotion remain unchanged.',
    ],
  };
}

function writeMemoryLinksCompareArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildMemoryLinksCompareArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const generatedAt = parseArgValue('generated-at', argv) || new Date().toISOString();
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const artifact = buildMemoryLinksCompareArtifact({ generatedAt });
  const written = writeMemoryLinksCompareArtifact({ outputPath, artifact });
  console.log(`Memory links compare complete: ${written.outputPath}`);
  console.log(JSON.stringify({
    pairedVerdict: artifact.summary.pairedVerdict,
    enablementRecommendation: artifact.summary.enablementRecommendation,
    defaultScoringRecommendation: artifact.summary.defaultScoringRecommendation,
    correctionCurrentTruthWins: artifact.summary.correctionCurrentTruthWins,
    staleMemoryRegressions: artifact.summary.staleMemoryRegressions,
    sourceAuthorityFailures: artifact.summary.sourceAuthorityFailures,
    continuityWins: artifact.summary.continuityWins,
    overclaimRegressions: artifact.summary.overclaimRegressions,
    promptTokenDelta: artifact.summary.promptTokenDelta,
    trustVerdict: artifact.summary.trustVerdict,
  }, null, 2));
  return artifact;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  MEMORY_LINKS_COMPARE_SCHEMA,
  MODE_CONFIGS,
  MODE_ORDER,
  analyzeRankedCase,
  buildCaseDiffs,
  buildCompareCases,
  buildCompareSummary,
  buildMemoryLinksCompareArtifact,
  main,
  parseArgValue,
  rankCaseCandidates,
  runCaseInMode,
  runMode,
  summarizeModeMetrics,
  writeMemoryLinksCompareArtifact,
};
