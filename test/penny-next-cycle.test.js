const test = require('node:test');
const assert = require('node:assert/strict');

const { buildNextCycleSteps } = require('../scripts/qa-penny-next-cycle');

test('buildNextCycleSteps keeps the planned fixed order including segmented memory and browser smoke', () => {
  const steps = buildNextCycleSteps();
  assert.deepEqual(steps.map((step) => step.id), [
    'tests',
    'runtime-fit',
    'probes',
    'voice-redo',
    'memory-semantic',
    'memory-chapter',
    'memory-contradictions',
    'memory-mixed',
    'epistemic-compare',
    'browser-smoke',
  ]);
});
