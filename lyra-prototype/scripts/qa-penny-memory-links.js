const fs = require('fs');
const path = require('path');

const {
  PENNY_MEMORY_LINKS_SCHEMA,
  DEFAULT_MEMORY_LINK_LIMITS,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  buildMemoryLinkTraceForItem,
  normalizeMemoryLinkSet,
  summarizeMemoryLinks,
} = require('../lib/penny-memory-links');
const {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
  buildCorrectionLinks,
} = require('../lib/penny-memory-link-policy');

const MEMORY_LINKS_FIXTURE_SCHEMA = 'penny-memory-links-fixture.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `memory-links-fixture-${STAMP}.json`);

const CORRECTION_RELATIONS = new Set([
  MEMORY_LINK_RELATIONS.CORRECTION_OF,
  MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
  MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
]);

const AUTHORITY_AFFECTING_EFFECTS = new Set([
  MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
  MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
  MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT,
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

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return argv.some((arg) => String(arg || '').trim() === dashed);
}

function parseMemoryLinksFixtureArgs(argv = process.argv.slice(2)) {
  const requestedMode = parseArgValue('mode', argv);
  const fixture = hasArgFlag('fixture', argv) || !requestedMode || requestedMode === 'fixture';
  if (!fixture) {
    throw new Error('Memory links QA currently supports --fixture only.');
  }
  return {
    fixture: true,
    mode: 'fixture',
    outputPath: parseArgValue('output', argv),
    generatedAt: parseArgValue('generated-at', argv),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function asArray(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function sameValues(actual = [], expected = []) {
  return JSON.stringify(asArray(actual).slice().sort()) === JSON.stringify(asArray(expected).slice().sort());
}

function countLinks(links = [], predicate = () => true) {
  return asArray(links).filter(predicate).length;
}

function buildFixtureCases() {
  return [
    {
      id: 'correction-chain-brass-fox-copper-rabbit',
      title: 'Correction chain',
      description: 'A stale brass fox archive note points to the current copper rabbit correction without making the link proof.',
      relationClass: 'correction-chain',
      kind: 'correction',
      traceItemIds: ['memory:copper-rabbit', 'archive:brass-fox'],
      correction: {
        subject: 'coding mascot',
        staleItem: {
          id: 'archive:brass-fox',
          text: 'The coding mascot was a brass fox.',
        },
        currentItem: {
          id: 'memory:copper-rabbit',
          text: 'The coding mascot is a copper rabbit now.',
        },
        staleObject: 'brass fox',
        currentObject: 'copper rabbit',
        supportState: 'explicit',
        sourceReceipts: [
          { type: 'fixture-turn', id: 'mascot-correction', excerpt: 'Correction: the coding mascot is a copper rabbit now, not a brass fox.' },
        ],
      },
      expectedRelations: [
        MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
        MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
        MEMORY_LINK_RELATIONS.CORRECTION_OF,
      ],
      expectedAuthorityEffects: [
        MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
        MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
        MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
      ],
      expectedSupportStates: [MEMORY_LINK_SUPPORT_STATES.EXPLICIT],
      expectedTraceRelations: [
        MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
        MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
      ],
      allowedUse: 'Future gated correction scoring may inspect these hints after shadow QA.',
    },
    {
      id: 'same-project-static-frame-budget',
      title: 'Same project thread',
      description: 'Static embeddings live-advisory planning is linked to the frame budget principle as a project-thread hint only.',
      relationClass: 'same-project-thread',
      kind: 'link-set',
      traceItemIds: ['plan:static-embeddings-live-advisory', 'principle:frame-budget'],
      links: [
        {
          id: 'static-live-advisory-frame-budget-thread',
          sourceId: 'plan:static-embeddings-live-advisory',
          targetId: 'principle:frame-budget',
          relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
          confidence: 'medium',
          support: {
            state: 'research',
            sourceReceipts: [
              { type: 'plan', path: 'docs/plans/penny-post-tier1-bounded-aliveness-plans/01-static-memory-reflex-plan.md' },
              { type: 'doc', path: 'README.md', excerpt: 'Penny Frame Budget Principle' },
            ],
            explanation: 'Both notes discuss bounded advisory memory retrieval under a frame budget.',
          },
          directionality: 'bidirectional',
          createdBy: 'fixture',
        },
      ],
      expectedRelations: [MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD],
      expectedAuthorityEffects: [MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY],
      expectedSupportStates: [MEMORY_LINK_SUPPORT_STATES.RESEARCH],
      expectedTraceRelations: [MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD],
      allowedUse: 'Advisory navigation only; not active project-thread scoring.',
    },
    {
      id: 'open-loop-correction-guardrails-static-live',
      title: 'Open-loop relation',
      description: 'A correction-guardrails open loop points at static live-advisory work without enabling open-loop scoring.',
      relationClass: 'open-loop-about',
      kind: 'link-set',
      traceItemIds: ['open-loop:correction-guardrails', 'feature:static-live-advisory'],
      links: [
        {
          id: 'correction-guardrails-open-loop-about-static-live',
          sourceId: 'open-loop:correction-guardrails',
          targetId: 'feature:static-live-advisory',
          relation: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
          confidence: 'medium',
          support: {
            state: 'unknown',
            sourceReceipts: [
              { type: 'fixture-open-loop', id: 'correction-guardrails' },
            ],
            explanation: 'The loop is about verifying stale/current correction guardrails before static live-advisory behavior.',
          },
          createdBy: 'fixture',
        },
      ],
      expectedRelations: [MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT],
      expectedAuthorityEffects: [MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY],
      expectedSupportStates: [MEMORY_LINK_SUPPORT_STATES.UNKNOWN],
      expectedTraceRelations: [MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT],
      allowedUse: 'Advisory open-loop navigation only; no live resurfacing or scoring activation.',
    },
    {
      id: 'research-pattern-ledger-bridge-bounded-aliveness',
      title: 'Research-pattern relation',
      description: 'The ledger bridge lesson is linked to bounded-aliveness design as a pattern reference only.',
      relationClass: 'research-pattern-for',
      kind: 'link-set',
      traceItemIds: ['research:ledger-bridge-lesson', 'design:bounded-aliveness'],
      links: [
        {
          id: 'ledger-bridge-pattern-for-bounded-aliveness',
          sourceId: 'research:ledger-bridge-lesson',
          targetId: 'design:bounded-aliveness',
          relation: MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
          confidence: 'medium',
          support: {
            state: 'research',
            sourceReceipts: [
              { type: 'doc', path: 'docs/penny-ledger-prompt-compare-note-2026-04-17.md' },
              { type: 'artifact-family', id: 'bounded-aliveness-compare' },
            ],
            explanation: 'Both favor measured, bounded continuity over broad prompt stuffing.',
          },
          createdBy: 'fixture',
        },
      ],
      expectedRelations: [MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR],
      expectedAuthorityEffects: [MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY],
      expectedSupportStates: [MEMORY_LINK_SUPPORT_STATES.RESEARCH],
      expectedTraceRelations: [MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR],
      allowedUse: 'Advisory research navigation only; no broad research-pattern scoring.',
    },
    {
      id: 'weak-semantic-authority-unrelated',
      title: 'Weak relation',
      description: 'Two semantically similar rain memories are linked as related-but-weak only, with no authority effect.',
      relationClass: 'related-but-weak',
      kind: 'link-set',
      traceItemIds: ['semantic:midnight-rain-safe', 'archive:midnight-rain-window'],
      links: [
        {
          id: 'midnight-rain-related-but-weak',
          sourceId: 'semantic:midnight-rain-safe',
          targetId: 'archive:midnight-rain-window',
          relation: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
          confidence: 'low',
          support: {
            state: 'semantic-candidate',
            sourceReceipts: [
              { type: 'semantic-fixture', id: 'candidate-only-rain-similarity' },
            ],
            explanation: 'Lexically similar but authority-unrelated memory candidates.',
          },
          authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
          createdBy: 'fixture',
        },
      ],
      expectedRelations: [MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK],
      expectedAuthorityEffects: [MEMORY_LINK_AUTHORITY_EFFECTS.NONE],
      expectedSupportStates: [MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE],
      expectedTraceRelations: [MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK],
      allowedUse: 'Candidate-only weak relation for navigation; not verified support.',
    },
  ];
}

function buildLinkSetForCase(caseSpec = {}, generatedAt = new Date().toISOString()) {
  if (caseSpec.kind === 'correction') {
    return buildCorrectionLinks({
      generatedAt,
      measurementMode: 'fixture',
      ...(caseSpec.correction || {}),
    }, { now: generatedAt });
  }
  return {
    ...normalizeMemoryLinkSet({
      generatedAt,
      measurementMode: 'fixture',
      links: caseSpec.links || [],
    }, { now: generatedAt }),
    scoringActive: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrite: false,
  };
}

function buildTraceMap(links = [], traceItemIds = []) {
  return asArray(traceItemIds).map((itemId) => ({
    itemId,
    trace: buildMemoryLinkTraceForItem(links, itemId, { linkTraceLimit: 6 }),
  }));
}

function summarizeInterpretation(linkSet = {}, caseSpec = {}) {
  const links = asArray(linkSet.links);
  const nonCorrectionAuthorityAffectingLinks = countLinks(links, (link) => (
    !CORRECTION_RELATIONS.has(link.relation)
    && AUTHORITY_AFFECTING_EFFECTS.has(link.authorityEffect)
  ));
  const candidateOnlyVerifiedSupportLinks = countLinks(links, (link) => (
    link.support?.state === MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE
    && AUTHORITY_AFFECTING_EFFECTS.has(link.authorityEffect)
  ));
  const truthProofLinks = countLinks(links, (link) => link.truthProof === true);
  const canonicalMemoryWriteLinks = countLinks(links, (link) => link.canonicalMemoryWrite === true);
  const promptTruthExpandedLinks = countLinks(links, (link) => link.promptTruthExpanded === true);
  const toolEvidenceChangedLinks = countLinks(links, (link) => link.toolEvidenceReceiptChanged === true);

  return {
    allowedUse: caseSpec.allowedUse || 'Advisory navigation only.',
    disallowedUse: 'Do not treat this link as proof, canonical memory, PromptTruth, tool evidence, or active scoring.',
    scoringActive: linkSet.scoringActive === true,
    behaviorChanged: linkSet.behaviorChanged === true,
    advisoryOnly: links.every((link) => link.advisoryOnly === true),
    truthProofLinks,
    canonicalMemoryWriteLinks,
    promptTruthExpandedLinks,
    toolEvidenceChangedLinks,
    nonCorrectionAuthorityAffectingLinks,
    candidateOnlyVerifiedSupportLinks,
    broadScoringActivated: false,
  };
}

function buildCaseResult(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const linkSet = buildLinkSetForCase(caseSpec, generatedAt);
  const links = asArray(linkSet.links);
  const summary = summarizeMemoryLinks(links);
  const traces = buildTraceMap(links, caseSpec.traceItemIds || []);
  const interpretation = summarizeInterpretation(linkSet, caseSpec);
  const actualRelations = Object.keys(summary.byRelation || {});
  const actualAuthorityEffects = Object.keys(summary.byAuthorityEffect || {});
  const actualSupportStates = Object.keys(summary.bySupportState || {});
  const traceRelations = new Set();
  for (const entry of traces) {
    for (const link of [
      ...asArray(entry.trace?.incoming),
      ...asArray(entry.trace?.outgoing),
    ]) {
      if (link.relation) traceRelations.add(link.relation);
    }
  }

  const expectedRelations = asArray(caseSpec.expectedRelations);
  const expectedAuthorityEffects = asArray(caseSpec.expectedAuthorityEffects);
  const expectedSupportStates = asArray(caseSpec.expectedSupportStates);
  const expectedTraceRelations = asArray(caseSpec.expectedTraceRelations);
  const pass = sameValues(actualRelations, expectedRelations)
    && sameValues(actualAuthorityEffects, expectedAuthorityEffects)
    && expectedSupportStates.every((state) => actualSupportStates.includes(state))
    && expectedTraceRelations.every((relation) => traceRelations.has(relation))
    && traces.every((entry) => entry.trace && entry.trace.advisoryOnly === true && entry.trace.scoringActive === false)
    && interpretation.scoringActive === false
    && interpretation.behaviorChanged === false
    && interpretation.advisoryOnly === true
    && interpretation.truthProofLinks === 0
    && interpretation.canonicalMemoryWriteLinks === 0
    && interpretation.promptTruthExpandedLinks === 0
    && interpretation.toolEvidenceChangedLinks === 0
    && interpretation.nonCorrectionAuthorityAffectingLinks === 0
    && interpretation.candidateOnlyVerifiedSupportLinks === 0;

  return {
    id: String(caseSpec.id || '').trim(),
    title: String(caseSpec.title || '').trim(),
    description: String(caseSpec.description || '').trim(),
    relationClass: String(caseSpec.relationClass || '').trim(),
    measurementMode: 'fixture-only',
    pass,
    expected: {
      relations: expectedRelations,
      authorityEffects: expectedAuthorityEffects,
      supportStates: expectedSupportStates,
      traceRelations: expectedTraceRelations,
    },
    actual: {
      relations: actualRelations,
      authorityEffects: actualAuthorityEffects,
      supportStates: actualSupportStates,
      linkCount: links.length,
    },
    linkSet,
    traces,
    interpretation,
  };
}

function summarizeFixtureResults(results = []) {
  const links = results.flatMap((result) => asArray(result.linkSet?.links));
  const linkSummary = summarizeMemoryLinks(links);
  const broadRelationLinkCount = countLinks(links, (link) => !CORRECTION_RELATIONS.has(link.relation));
  const broadAuthorityAffectingLinks = countLinks(links, (link) => (
    !CORRECTION_RELATIONS.has(link.relation)
    && AUTHORITY_AFFECTING_EFFECTS.has(link.authorityEffect)
  ));
  const candidateOnlyVerifiedSupportLinks = countLinks(links, (link) => (
    link.support?.state === MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE
    && AUTHORITY_AFFECTING_EFFECTS.has(link.authorityEffect)
  ));

  return {
    caseCount: results.length,
    passingCaseCount: results.filter((result) => result.pass).length,
    totalLinks: links.length,
    correctionLinkCount: countLinks(links, (link) => CORRECTION_RELATIONS.has(link.relation)),
    broadRelationLinkCount,
    broadAuthorityAffectingLinks,
    authorityAffectingLinks: linkSummary.authorityAffectingLinks,
    candidateOnlyVerifiedSupportLinks,
    advisoryOnly: links.every((link) => link.advisoryOnly === true),
    truthProofLinks: countLinks(links, (link) => link.truthProof === true),
    canonicalMemoryWriteLinks: countLinks(links, (link) => link.canonicalMemoryWrite === true),
    promptTruthExpandedLinks: countLinks(links, (link) => link.promptTruthExpanded === true),
    toolEvidenceChangedLinks: countLinks(links, (link) => link.toolEvidenceReceiptChanged === true),
    scoringActive: false,
    correctionScoringActivated: false,
    broadScoringActivated: false,
  };
}

function buildMemoryLinksFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const links = results.flatMap((result) => asArray(result.linkSet?.links));

  return {
    schema: MEMORY_LINKS_FIXTURE_SCHEMA,
    linkSetSchema: PENNY_MEMORY_LINKS_SCHEMA,
    correctionBuilderSchema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
    artifactKind: 'dynamic-memory-links-fixture',
    generatedAt,
    measurementMode: 'fixture-only',
    runnerMode: 'fixture-only',
    behaviorChanged: false,
    liveModelCalls: false,
    livePromptBridge: false,
    liveChatTouched: false,
    runtimeVoiceChanged: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrites: false,
    graphDbMigration: false,
    universalMemoryIndexBuilt: false,
    broadProjectResearchOpenLoopScoringActivated: false,
    correctionScoringActivated: false,
    candidateOnlyVerifiedSupport: false,
    linkSummary: summarizeMemoryLinks(links),
    summary: summarizeFixtureResults(results),
    cases: results,
    limits: [
      ...DEFAULT_MEMORY_LINK_LIMITS,
      'Fixture links are QA inspection artifacts, not live runtime behavior.',
      'Project-thread, open-loop, research-pattern, weak, static, and semantic links remain advisory/shadow here.',
      'Candidate-only, static, and semantic links do not become verified support.',
      'This runner does not expand PromptTruth, toolEvidenceReceipt, runtime voice, or prompt limits.',
    ],
  };
}

function writeMemoryLinksFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildMemoryLinksFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const args = parseMemoryLinksFixtureArgs(argv);
  const generatedAt = args.generatedAt || new Date().toISOString();
  const outputPath = args.outputPath || OUTPUT_PATH;
  const artifact = buildMemoryLinksFixtureArtifact({ generatedAt });
  const result = writeMemoryLinksFixtureArtifact({ outputPath, artifact });
  console.log(`Memory links fixture complete: ${result.outputPath}`);
  console.log(JSON.stringify(result.artifact.summary, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  MEMORY_LINKS_FIXTURE_SCHEMA,
  buildCaseResult,
  buildFixtureCases,
  buildMemoryLinksFixtureArtifact,
  main,
  parseArgValue,
  parseMemoryLinksFixtureArgs,
  writeMemoryLinksFixtureArtifact,
};
