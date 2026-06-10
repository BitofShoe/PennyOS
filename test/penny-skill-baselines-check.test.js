const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeSkillBaselineArtifact,
  checkSkillBaselineFile,
} = require('../scripts/check-penny-skill-baselines');

function completeArtifact(overrides = {}) {
  return {
    schema: 'penny-skill-baseline.v1',
    measurementMode: 'fixture-only',
    generatedAt: '2026-06-10T12:00:00.000Z',
    guardrails: {
      liveLmStudioTouched: false,
      liveUserMemoryTouched: false,
      promptTruthChanged: false,
      toolEvidenceReceiptChanged: false,
      runtimeVoiceChanged: false,
      cleanupRequired: false,
    },
    cases: [
      {
        taskId: 'source-review-required-buckets',
        skillName: 'penny-link-review',
        noSkill: {
          verdict: 'fail',
          durationMs: 1200,
          eventCount: 4,
          cleanupOk: true,
          artifactPath: 'fixtures/skill-baselines/no-skill-source-review.json',
        },
        withSkill: {
          verdict: 'pass',
          durationMs: 1400,
          eventCount: 5,
          cleanupOk: true,
          artifactPath: 'fixtures/skill-baselines/with-skill-source-review.json',
        },
        comparison: {
          decision: 'skill_helped',
          passDelta: 1,
          notes: ['with-skill output included required risk buckets'],
        },
      },
    ],
    limits: [
      'fixture-only artifact; does not prove live agent quality',
      'does not touch live LM Studio or user memory',
    ],
    ...overrides,
  };
}

test('skill baseline checker accepts fixture-only no-skill versus with-skill artifacts', () => {
  const result = analyzeSkillBaselineArtifact(completeArtifact(), {
    filePath: 'fixtures/penny-skill-baselines/example.json',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('skill baseline checker rejects missing paired variants', () => {
  const artifact = completeArtifact();
  delete artifact.cases[0].noSkill;

  const result = analyzeSkillBaselineArtifact(artifact, {
    filePath: 'fixtures/penny-skill-baselines/missing.json',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'case-missing:noSkill'));
});

test('skill baseline checker rejects inconsistent helped decisions', () => {
  const artifact = completeArtifact();
  artifact.cases[0].noSkill.verdict = 'pass';
  artifact.cases[0].withSkill.verdict = 'fail';

  const result = analyzeSkillBaselineArtifact(artifact, {
    filePath: 'fixtures/penny-skill-baselines/inconsistent.json',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'comparison-inconsistent:skill_helped'));
});

test('skill baseline checker rejects live side effects in baseline artifacts', () => {
  const result = analyzeSkillBaselineArtifact(completeArtifact({
    guardrails: {
      liveLmStudioTouched: true,
      liveUserMemoryTouched: false,
      promptTruthChanged: false,
      toolEvidenceReceiptChanged: false,
      runtimeVoiceChanged: false,
      cleanupRequired: false,
    },
  }), {
    filePath: 'fixtures/penny-skill-baselines/live.json',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'guardrail-live-side-effect:liveLmStudioTouched'));
});

test('skill baseline checker reads JSON files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-skill-baseline-'));
  const artifactPath = path.join(dir, 'baseline.json');
  fs.writeFileSync(artifactPath, JSON.stringify(completeArtifact(), null, 2), 'utf8');

  const result = checkSkillBaselineFile(artifactPath);

  assert.equal(result.ok, true);
  assert.equal(result.filePath, artifactPath);
  assert.deepEqual(result.failures, []);
});
