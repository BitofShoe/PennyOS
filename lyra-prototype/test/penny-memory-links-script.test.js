const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_LINKS_FIXTURE_SCHEMA,
  buildCaseResult,
  buildFixtureCases,
  buildMemoryLinksFixtureArtifact,
  parseArgValue,
  parseMemoryLinksFixtureArgs,
  writeMemoryLinksFixtureArtifact,
} = require('../scripts/qa-penny-memory-links');
const {
  PENNY_MEMORY_LINKS_SCHEMA,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
} = require('../lib/penny-memory-links');
const {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
} = require('../lib/penny-memory-link-policy');

const GENERATED_AT = '2026-04-22T18:00:00.000Z';

test('memory links fixture exposes all L4 cases without runtime behavior changes', () => {
  const artifact = buildMemoryLinksFixtureArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, MEMORY_LINKS_FIXTURE_SCHEMA);
  assert.equal(artifact.linkSetSchema, PENNY_MEMORY_LINKS_SCHEMA);
  assert.equal(artifact.correctionBuilderSchema, PENNY_CORRECTION_LINK_BUILDER_SCHEMA);
  assert.equal(artifact.artifactKind, 'dynamic-memory-links-fixture');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.runnerMode, 'fixture-only');
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.liveChatTouched, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.canonicalMemoryWrites, false);
  assert.equal(artifact.graphDbMigration, false);
  assert.equal(artifact.universalMemoryIndexBuilt, false);
  assert.equal(artifact.broadProjectResearchOpenLoopScoringActivated, false);
  assert.equal(artifact.correctionScoringActivated, false);
  assert.equal(artifact.candidateOnlyVerifiedSupport, false);
  assert.equal(artifact.summary.caseCount, 5);
  assert.equal(artifact.summary.passingCaseCount, 5);
  assert.equal(artifact.summary.totalLinks, 7);
  assert.equal(artifact.summary.correctionLinkCount, 3);
  assert.equal(artifact.summary.broadRelationLinkCount, 4);
  assert.equal(artifact.summary.broadAuthorityAffectingLinks, 0);
  assert.equal(artifact.summary.candidateOnlyVerifiedSupportLinks, 0);
  assert.equal(artifact.summary.truthProofLinks, 0);
  assert.equal(artifact.summary.canonicalMemoryWriteLinks, 0);
  assert.equal(artifact.summary.promptTruthExpandedLinks, 0);
  assert.equal(artifact.summary.toolEvidenceChangedLinks, 0);
  assert.equal(artifact.summary.scoringActive, false);
  assert.equal(artifact.summary.broadScoringActivated, false);
  assert.equal(artifact.linkSummary.byRelation[MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD], 1);
  assert.equal(artifact.linkSummary.byRelation[MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT], 1);
  assert.equal(artifact.linkSummary.byRelation[MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR], 1);
  assert.equal(artifact.linkSummary.byRelation[MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK], 1);
  assert.match(artifact.limits.join('\n'), /Fixture links are QA inspection artifacts/);
  assert.match(artifact.limits.join('\n'), /do not become verified support/);
});

test('memory links fixture keeps correction authority hints separate from broad advisory links', () => {
  const artifact = buildMemoryLinksFixtureArtifact({ generatedAt: GENERATED_AT });
  const byId = new Map(artifact.cases.map((item) => [item.id, item]));
  const correction = byId.get('correction-chain-brass-fox-copper-rabbit');
  const project = byId.get('same-project-static-frame-budget');
  const openLoop = byId.get('open-loop-correction-guardrails-static-live');
  const research = byId.get('research-pattern-ledger-bridge-bounded-aliveness');
  const weak = byId.get('weak-semantic-authority-unrelated');

  assert.equal(correction.pass, true);
  assert.equal(correction.linkSet.builderSchema, PENNY_CORRECTION_LINK_BUILDER_SCHEMA);
  assert.equal(correction.linkSet.scoringActive, false);
  assert.equal(correction.linkSet.correctionTrace.strongSupport, true);
  assert.equal(correction.actual.authorityEffects.includes(MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST), true);
  assert.equal(correction.actual.authorityEffects.includes(MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY), true);
  assert.equal(correction.traces.every((entry) => entry.trace.scoringActive === false), true);
  assert.equal(correction.interpretation.truthProofLinks, 0);

  for (const broadCase of [project, openLoop, research]) {
    assert.equal(broadCase.pass, true);
    assert.deepEqual(broadCase.actual.authorityEffects, [MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY]);
    assert.equal(broadCase.interpretation.nonCorrectionAuthorityAffectingLinks, 0);
    assert.equal(broadCase.interpretation.broadScoringActivated, false);
    assert.equal(broadCase.interpretation.scoringActive, false);
  }

  assert.equal(weak.pass, true);
  assert.deepEqual(weak.actual.relations, [MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK]);
  assert.deepEqual(weak.actual.authorityEffects, [MEMORY_LINK_AUTHORITY_EFFECTS.NONE]);
  assert.deepEqual(weak.actual.supportStates, [MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE]);
  assert.equal(weak.interpretation.candidateOnlyVerifiedSupportLinks, 0);
  assert.match(weak.interpretation.allowedUse, /not verified support/);
});

test('memory links fixture helpers keep case order and writer deterministic', () => {
  const cases = buildFixtureCases();
  assert.deepEqual(cases.map((item) => item.id), [
    'correction-chain-brass-fox-copper-rabbit',
    'same-project-static-frame-budget',
    'open-loop-correction-guardrails-static-live',
    'research-pattern-ledger-bridge-bounded-aliveness',
    'weak-semantic-authority-unrelated',
  ]);

  const weak = buildCaseResult(
    cases.find((item) => item.id === 'weak-semantic-authority-unrelated'),
    GENERATED_AT,
  );
  assert.equal(weak.pass, true);
  assert.equal(weak.linkSet.summary.bySupportState[MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE], 1);
  assert.equal(weak.traces[0].trace.relationSummary.relatedButWeak, 1);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-memory-links-fixture-'));
  const outputPath = path.join(dir, 'fixture.json');
  const artifact = buildMemoryLinksFixtureArtifact({ generatedAt: GENERATED_AT });
  const result = writeMemoryLinksFixtureArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, MEMORY_LINKS_FIXTURE_SCHEMA);
  assert.equal(written.summary.passingCaseCount, 5);
});

test('memory links fixture arg parser supports fixture-only output forms', () => {
  assert.deepEqual(parseMemoryLinksFixtureArgs([]), {
    fixture: true,
    mode: 'fixture',
    outputPath: '',
    generatedAt: '',
  });
  assert.deepEqual(parseMemoryLinksFixtureArgs(['--fixture', '--output', 'tmp/out.json', '--generated-at=2026-04-22T18:00:00.000Z']), {
    fixture: true,
    mode: 'fixture',
    outputPath: 'tmp/out.json',
    generatedAt: '2026-04-22T18:00:00.000Z',
  });
  assert.equal(parseArgValue('output', ['--output=tmp/out.json']), 'tmp/out.json');
  assert.throws(() => parseMemoryLinksFixtureArgs(['--mode=live-shadow']), /supports --fixture only/i);
});
