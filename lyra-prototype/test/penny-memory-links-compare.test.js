const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const {
  PENNY_MEMORY_LINKS_SCHEMA,
  MEMORY_LINK_RELATIONS,
} = require('../lib/penny-memory-links');
const {
  PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA,
  PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA,
  MEMORY_LINK_SCORING_MODES,
} = require('../lib/penny-memory-link-policy');
const {
  MEMORY_LINKS_COMPARE_SCHEMA,
  MODE_CONFIGS,
  MODE_ORDER,
  buildCompareCases,
  buildMemoryLinksCompareArtifact,
  parseArgValue,
  rankCaseCandidates,
  runMode,
  writeMemoryLinksCompareArtifact,
} = require('../scripts/eval-penny-memory-links-compare');

const GENERATED_AT = '2026-04-22T19:00:00.000Z';

test('dynamic memory link compare exposes the planned L9 modes and npm command', () => {
  assert.deepEqual(MODE_ORDER, [
    'links-off',
    'links-trace-only',
    'links-shadow',
    'correction-links-active',
    'project-links-shadow',
  ]);
  assert.equal(MODE_CONFIGS['links-off'].linkSource, 'none');
  assert.equal(MODE_CONFIGS['links-trace-only'].includeTrace, true);
  assert.equal(MODE_CONFIGS['links-shadow'].scoringMode, MEMORY_LINK_SCORING_MODES.SHADOW);
  assert.equal(MODE_CONFIGS['correction-links-active'].scoringMode, MEMORY_LINK_SCORING_MODES.CORRECTION_V1);
  assert.equal(MODE_CONFIGS['project-links-shadow'].projectResearchOpenLoopScoringActive, false);
  assert.equal(
    packageJson.scripts['eval:memory-links'],
    'node scripts/eval-penny-memory-links-compare.js',
  );
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
});

test('compare fixtures cover correction, project, candidate-only, and weak-link boundaries', () => {
  const cases = buildCompareCases(GENERATED_AT);

  assert.deepEqual(cases.map((item) => item.id), [
    'correction-current-truth-mascot',
    'correction-stale-suppression-watch',
    'candidate-only-correction-boundary',
    'project-thread-shadow-continuity',
    'weak-semantic-link-boundary',
  ]);
  assert.equal(cases[0].linkSet.summary.byRelation[MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR], 1);
  assert.equal(cases[3].linkSet.summary.byRelation[MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD], 1);
  assert.equal(cases[3].linkSet.summary.byRelation[MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT], 1);
  assert.equal(cases[3].linkSet.summary.byRelation[MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR], 1);
  assert.equal(cases[4].linkSet.summary.byRelation[MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK], 1);
});

test('correction-v1 changes only explicit correction ranking', () => {
  const cases = buildCompareCases(GENERATED_AT);
  const correction = cases.find((item) => item.id === 'correction-current-truth-mascot');
  const candidateOnly = cases.find((item) => item.id === 'candidate-only-correction-boundary');
  const offRows = rankCaseCandidates(correction, MODE_CONFIGS['links-off']);
  const activeRows = rankCaseCandidates(correction, MODE_CONFIGS['correction-links-active']);
  const current = activeRows.find((row) => row.id === 'memory:copper-rabbit');
  const stale = activeRows.find((row) => row.id === 'archive:brass-fox');
  const candidateOnlyActiveRows = rankCaseCandidates(candidateOnly, MODE_CONFIGS['correction-links-active']);

  assert.equal(offRows[0].id, 'archive:brass-fox');
  assert.equal(activeRows[0].id, 'memory:copper-rabbit');
  assert.equal(current.linkActiveScore.schema, PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA);
  assert.equal(current.linkActiveScore.active, true);
  assert.equal(current.linkActiveScore.score, 1.5);
  assert.equal(stale.linkActiveScore.active, true);
  assert.ok(stale.linkActiveScore.score < 0);
  assert.equal(
    candidateOnlyActiveRows.some((row) => Number(row.linkActiveScore.score || 0) !== 0),
    false,
  );
  assert.equal(
    candidateOnlyActiveRows.some((row) => row.linkActiveScore.candidateOnlyVerifiedSupport === true),
    false,
  );
});

test('project/open-loop/research links remain shadow-only continuity evidence', () => {
  const cases = buildCompareCases(GENERATED_AT);
  const project = cases.find((item) => item.id === 'project-thread-shadow-continuity');
  const offRows = rankCaseCandidates(project, MODE_CONFIGS['links-off']);
  const shadowRows = rankCaseCandidates(project, MODE_CONFIGS['project-links-shadow']);
  const frameBudget = shadowRows.find((row) => row.id === 'principle:frame-budget');

  assert.equal(offRows[0].id, 'plan:static-live-advisory');
  assert.equal(shadowRows[0].id, 'plan:static-live-advisory');
  assert.equal(frameBudget.shadowRank, 1);
  assert.equal(frameBudget.activeRank, 2);
  assert.equal(frameBudget.linkShadowScore.schema, PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA);
  assert.equal(frameBudget.linkShadowScore.active, false);
  assert.equal(frameBudget.linkActiveScore.active, false);
  assert.equal(frameBudget.linkActiveScore.score, 0);
});

test('memory link compare artifact preserves fixture-only guardrails and acceptance summary', () => {
  const artifact = buildMemoryLinksCompareArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, MEMORY_LINKS_COMPARE_SCHEMA);
  assert.equal(artifact.memoryLinksSchema, PENNY_MEMORY_LINKS_SCHEMA);
  assert.equal(artifact.artifactKind, 'dynamic-memory-links-compare');
  assert.equal(artifact.measurementMode, 'fixture-compare');
  assert.equal(artifact.runnerMode, 'fixture-only');
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.liveUserMemoryTouched, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.canonicalMemoryWrites, false);
  assert.equal(artifact.advisoryMemoryPromotion, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.toolEvidenceReceiptMerged, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.graphDbMigration, false);
  assert.equal(artifact.universalMemoryIndexBuilt, false);
  assert.equal(artifact.broadProjectResearchOpenLoopScoringActivated, false);
  assert.equal(artifact.candidateOnlyVerifiedSupport, false);
  assert.equal(artifact.summary.pairedVerdict, 'correction-links-active');
  assert.equal(artifact.summary.enablementRecommendation, 'eligible-for-gated-correction-v1-review');
  assert.equal(artifact.summary.defaultScoringRecommendation, 'keep-default-shadow');
  assert.equal(artifact.summary.projectResearchOpenLoopRecommendation, 'shadow-only-until-separately-measured');
  assert.equal(artifact.summary.correctionCurrentTruthWins, 2);
  assert.equal(artifact.summary.staleMemoryRegressions, 0);
  assert.equal(artifact.summary.sourceAuthorityFailures, 0);
  assert.equal(artifact.summary.continuityWins, 1);
  assert.equal(artifact.summary.overclaimRegressions, 0);
  assert.equal(artifact.summary.promptTokenDelta, 0);
  assert.equal(artifact.summary.firstTokenLatencyDelta, null);
  assert.equal(artifact.summary.acceptance.projectLinksRemainShadow, true);
  assert.equal(artifact.summary.acceptance.candidateOnlyVerifiedSupportZero, true);
  assert.equal(artifact.summary.alivenessSummary.pass, true);
  assert.match(artifact.limits.join('\n'), /Project-thread, open-loop, and research-pattern links remain advisory\/shadow/);
});

test('compare writer emits an ignored artifact shape with all modes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-memory-links-compare-'));
  const outputPath = path.join(dir, 'artifact.json');
  const artifact = buildMemoryLinksCompareArtifact({ generatedAt: GENERATED_AT });
  const result = writeMemoryLinksCompareArtifact({ outputPath, artifact });
  const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(parsed.schema, MEMORY_LINKS_COMPARE_SCHEMA);
  assert.deepEqual(parsed.modes.map((item) => item.mode), MODE_ORDER);
  assert.equal(parsed.modes.find((item) => item.mode === 'correction-links-active').metrics.activeCorrectionScoreCount, 4);
});

test('mode runner reports trace-only without active scoring', () => {
  const cases = buildCompareCases(GENERATED_AT);
  const traceOnly = runMode(MODE_CONFIGS['links-trace-only'], { cases });

  assert.equal(traceOnly.mode, 'links-trace-only');
  assert.equal(traceOnly.metrics.traceCandidateCount, 11);
  assert.equal(traceOnly.metrics.activeCorrectionScoreCount, 0);
  assert.equal(traceOnly.metrics.broadActiveScoreCount, 0);
  assert.equal(traceOnly.cases.every((item) => item.candidates.every((candidate) => candidate.linkShadowScore === null)), true);
  assert.equal(traceOnly.cases.some((item) => item.candidates.some((candidate) => candidate.memoryLinkTrace)), true);
});
