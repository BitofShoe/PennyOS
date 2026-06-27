const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeContractReceipt,
  renderRuntimeContractReceiptMarkdown,
} = require('../lib/penny-runtime-contract-receipt');
const {
  analyzeRuntimeContractMarkdown,
  analyzeRuntimeContractReceipt,
  checkRuntimeContractReceiptFile,
} = require('../scripts/check-penny-runtime-contract-receipts');

function completeReceipt(patch = {}) {
  const receipt = buildRuntimeContractReceipt({
    generatedAt: '2026-06-19T20:00:00.000Z',
    endpoint: 'http://127.0.0.1:1234/v1',
    backend: 'lm_studio',
    requestedModelId: 'unknown',
    modelId: 'unknown',
    fileFormat: 'unknown',
    quant: 'unknown',
    contextLength: null,
    chatTemplate: 'unknown',
    promptTemplate: 'unknown',
    samplingDefaults: {
      temperature: 1,
      top_p: 0.95,
      top_k: 64,
    },
    capabilities: {
      tool_function_support: 'unknown',
      structured_output: 'unknown',
      streaming: 'unknown',
    },
    memoryLaneStatus: {
      status: 'keyword-fallback',
      privacyFlag: 'local-only',
      reviewStatus: 'runtime-status-only',
    },
    privacyWarningState: 'local-first',
    smokePrompt: {
      status: 'not_run',
      reason: 'Static checker fixture; no live model call.',
    },
    statePreservation: {
      model_state_preserved: true,
    },
  });
  return {
    ...receipt,
    ...patch,
  };
}

test('runtime contract receipt checker accepts complete status-only JSON receipts with explicit unknowns', () => {
  const result = analyzeRuntimeContractReceipt(completeReceipt(), {
    filePath: 'output/runtime-contract.json',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('runtime contract receipt checker fails closed when required proof fields are missing', () => {
  const thin = completeReceipt();
  delete thin.runtime.endpoint;
  delete thin.prompt_contract.chat_template;
  delete thin.prompt_contract.prompt_template;
  delete thin.sampling_defaults;

  const result = analyzeRuntimeContractReceipt(thin, {
    filePath: 'output/thin-runtime-contract.json',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'missing-field:runtime.endpoint'));
  assert(result.failures.some((failure) => failure.code === 'missing-field:prompt_contract.chat_template'));
  assert(result.failures.some((failure) => failure.code === 'missing-field:sampling_defaults'));
});

test('runtime contract receipt checker rejects model-state mutation overclaims', () => {
  const receipt = completeReceipt({
    state_preservation: {
      model_state_preserved: false,
      loaded_models: true,
      receipt_note: 'Fixture claims a model was loaded.',
    },
  });

  const result = analyzeRuntimeContractReceipt(receipt, {
    filePath: 'output/mutating-runtime-contract.json',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'state-mutation:model_state_preserved'));
  assert(result.failures.some((failure) => failure.code === 'state-mutation:loaded_models'));
});

test('runtime contract receipt checker accepts rendered markdown but rejects missing preservation receipt', () => {
  const markdown = renderRuntimeContractReceiptMarkdown(completeReceipt());
  const accepted = analyzeRuntimeContractMarkdown(markdown, {
    filePath: 'docs/runtime-contract.md',
  });
  const rejected = analyzeRuntimeContractMarkdown(
    markdown.replace('Model state preserved: true', 'Model state preserved: false'),
    { filePath: 'docs/runtime-contract-overclaim.md' },
  );

  assert.equal(accepted.ok, true);
  assert.equal(rejected.ok, false);
  assert(rejected.failures.some((failure) => failure.code === 'state-mutation:model_state_preserved'));
});

test('runtime contract receipt checker reads nested model-watch receipts from disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-runtime-contract-'));
  const filePath = path.join(dir, 'watch.json');
  const payload = {
    schema: 'penny-model-runtime-watch.v1',
    runtime_contract: completeReceipt(),
  };

  try {
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const result = checkRuntimeContractReceiptFile(filePath);

    assert.equal(result.ok, true);
    assert.equal(result.filePath, filePath);
    assert.deepEqual(result.failures, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
