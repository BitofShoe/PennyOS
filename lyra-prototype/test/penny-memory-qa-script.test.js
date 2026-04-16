const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseMemoryQaArgs,
  MEMORY_QA_SEGMENT_IDS,
  MEMORY_QA_SEGMENT_ORDER,
} = require('../scripts/qa-penny-memory');

test('parseMemoryQaArgs defaults to combined mode when no flags are supplied', () => {
  const parsed = parseMemoryQaArgs([]);
  assert.equal(parsed.runMode, 'combined');
  assert.equal(parsed.runLabel, 'combined');
  assert.equal(parsed.segmentId, '');
  assert.equal(parsed.combinedMode, true);
});

test('parseMemoryQaArgs accepts known segment ids and smoke mode', () => {
  const segment = parseMemoryQaArgs(['--segment', MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT]);
  assert.equal(segment.runMode, 'segment');
  assert.equal(segment.segmentId, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);
  assert.equal(segment.runLabel, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);

  const smoke = parseMemoryQaArgs(['--smoke']);
  assert.equal(smoke.runMode, 'smoke');
  assert.equal(smoke.runLabel, 'smoke');
});

test('parseMemoryQaArgs rejects invalid segment combinations', () => {
  assert.throws(() => parseMemoryQaArgs(['--smoke', '--segment', MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE]), /cannot combine --smoke with --segment/i);
  assert.throws(() => parseMemoryQaArgs(['--segment', 'bogus']), /Unknown memory QA segment/i);
  assert.deepEqual(MEMORY_QA_SEGMENT_ORDER, [
    'semantic-archive',
    'chapter-fallback',
    'contradiction-premise',
    'mixed-drift',
  ]);
});
