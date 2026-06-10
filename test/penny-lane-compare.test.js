const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const packageJson = require('../package.json');
const {
  PENNY_LANE_COMPARE_SCHEMA,
  buildLaneCompareArtifact,
  parseLaneCompareArgs,
  writeLaneCompareArtifact,
} = require('../scripts/qa-penny-lane-compare');

const GENERATED_AT = '2026-05-25T12:00:00.000Z';

test('lane compare artifact is fixture-only by default and preserves planned profiles', () => {
  const artifact = buildLaneCompareArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, PENNY_LANE_COMPARE_SCHEMA);
  assert.equal(artifact.environment, 'fixture');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.deepEqual(artifact.profiles, ['split-q6-e4b', 'single-qwen']);
  assert.equal(artifact.profileDetails[0].env.PENNY_QA_CHAT_MODEL, 'unsloth/gemma-4-31b-it@q6_k');
  assert.equal(artifact.profileDetails[0].env.PENNY_QA_TOOL_MODEL, 'google/gemma-4-e4b');
  assert.equal(artifact.profileDetails[1].env.PENNY_QA_CHAT_MODEL, 'qwen/qwen3.6-35b-a3b');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.lmStudioCalls, false);
  assert.deepEqual(artifact.cleanup, {
    disposableMemoryRemoved: true,
    playgroundFilesRemoved: true,
  });
  assert.equal(artifact.verdict, 'fixture-only');
});

test('lane compare matrix keeps rows 1-4 external and implements rows 5-9 as fixture checks', () => {
  const artifact = buildLaneCompareArtifact({ generatedAt: GENERATED_AT });
  const externalRows = artifact.externalHarnessRows.map((row) => row.row);
  const scenarioRows = artifact.scenarios.map((row) => row.row);
  const byRow = new Map(artifact.scenarios.map((row) => [row.row, row]));

  assert.deepEqual(externalRows, [1, 2, 3, 4]);
  assert.equal(artifact.externalHarnessRows.every((row) => row.implementedInFixtureRunner === false), true);
  assert.deepEqual(scenarioRows, [5, 6, 7, 8, 9]);

  assert.equal(byRow.get(5).directIntent.name, 'read_attached_file');
  assert.equal(byRow.get(6).directIntent.name, 'read_project_file_around_match');
  assert.equal(byRow.get(6).directIntent.args.path, 'package.json');
  assert.equal(byRow.get(7).directIntent, null);
  assert.equal(byRow.get(7).toolLoopExpected, true);
  assert.equal(byRow.get(8).directIntent.name, 'search_web');
  assert.equal(byRow.get(8).directIntent.args.query, 'digitalfoundry.com top stories today');
  assert.equal(byRow.get(9).contextDependent, true);
});

test('lane compare writer and package script stay fixture-safe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-lane-compare-'));
  const outputPath = path.join(dir, 'lane-compare.json');
  const artifact = buildLaneCompareArtifact({ generatedAt: GENERATED_AT });

  try {
    const result = writeLaneCompareArtifact({ outputPath, artifact });
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    assert.equal(result.outputPath, outputPath);
    assert.equal(written.schema, PENNY_LANE_COMPARE_SCHEMA);
    assert.equal(written.liveModelCalls, false);
    assert.equal(packageJson.scripts['qa:lane-compare'], 'node scripts/qa-penny-lane-compare.js --fixture');
    assert.equal(parseLaneCompareArgs([]).fixture, true);
    assert.equal(parseLaneCompareArgs([]).mode, 'fixture');
    assert.match(parseLaneCompareArgs([]).outputPath, /lane-compare-/);
    assert.deepEqual(parseLaneCompareArgs(['--fixture', '--output', outputPath]), {
      fixture: true,
      mode: 'fixture',
      allowLiveIsolated: false,
      outputPath,
    });
    const blocked = buildLaneCompareArtifact({ mode: 'live-isolated' });
    assert.equal(blocked.verdict, 'blocked');
    assert.equal(blocked.liveModelCalls, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
