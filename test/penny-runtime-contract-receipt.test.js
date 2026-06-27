const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeContractReceipt,
  renderRuntimeContractReceiptMarkdown,
} = require('../lib/penny-runtime-contract-receipt');
const {
  buildModelRuntimeWatchArtifact,
} = require('../lib/penny-model-runtime-watch');
const {
  buildCombinedMemoryInspector,
} = require('../lib/penny-runtime-artifacts');

test('runtime contract receipt records status-only local runtime truth without mutating model state', () => {
  const receipt = buildRuntimeContractReceipt({
    generatedAt: '2026-06-19T18:30:00.000Z',
    endpointCompatibility: {
      endpoint: 'http://127.0.0.1:18080/v1',
      read_only: true,
      model_calls: false,
      backend_family: 'llama_cpp',
      loaded_models: ['unsloth/gemma-4-31b-it@q6_k'],
      resolved_model_id: 'unsloth/gemma-4-31b-it@q6_k',
      capabilities: {
        models_endpoint: 'supported',
        tool_calls: 'unknown',
        structured_output: 'unknown',
        streaming: 'unknown',
      },
      template_or_chat_format: 'unknown',
      kv_prompt_cache_visibility: 'unknown',
      max_context_advertised: null,
      warnings: ['status-only fixture'],
    },
    requestedModelId: 'unsloth/gemma-4-31b-it@q6_k',
    samplingDefaults: {
      temperature: 1,
      top_p: 0.95,
      top_k: 64,
    },
    memoryLaneStatus: {
      status: 'optional_fallback',
      semanticReady: false,
      requestedEmbeddingModel: 'zz/embedding-gemma-300m',
    },
    privacyWarningState: 'local-first',
  });

  assert.equal(receipt.schema, 'penny-runtime-contract-receipt.v1');
  assert.equal(receipt.measurement_mode, 'status-only');
  assert.equal(receipt.runtime.endpoint, 'http://127.0.0.1:18080/v1');
  assert.equal(receipt.runtime.backend, 'llama_cpp');
  assert.equal(receipt.runtime.local_cloud_mode, 'local');
  assert.equal(receipt.model.id_or_path, 'unsloth/gemma-4-31b-it@q6_k');
  assert.equal(receipt.model.context_length, null);
  assert.equal(receipt.prompt_contract.chat_template, 'unknown');
  assert.equal(receipt.capabilities.tool_function_support, 'unknown');
  assert.equal(receipt.memory_lane.status, 'optional_fallback');
  assert.equal(receipt.memory_lane.semantic_ready, false);
  assert.equal(receipt.privacy.warning_state, 'local-first');
  assert.equal(receipt.smoke.status, 'not_run');
  assert.equal(receipt.smoke.model_call, false);
  assert.equal(receipt.state_preservation.model_state_preserved, true);
  assert.equal(receipt.state_preservation.started_models, false);
  assert.equal(receipt.state_preservation.stopped_models, false);
  assert.equal(receipt.state_preservation.loaded_models, false);
  assert.equal(receipt.state_preservation.unloaded_models, false);
  assert.equal(receipt.state_preservation.swapped_models, false);
  assert.equal(receipt.state_preservation.downloaded_models, false);
  assert.equal(receipt.state_preservation.memory_changed, false);
  assert.equal(receipt.state_preservation.runtime_voice_changed, false);
  assert.deepEqual(receipt.loaded_models, ['unsloth/gemma-4-31b-it@q6_k']);
  assert.match(receipt.warnings.join('\n'), /status-only fixture/);
});

test('runtime contract receipt distinguishes explicit smoke output from model-state mutation', () => {
  const receipt = buildRuntimeContractReceipt({
    generatedAt: '2026-06-19T18:35:00.000Z',
    endpointCompatibility: {
      endpoint: 'https://api.openai.com/v1',
      read_only: true,
      model_calls: true,
      backend_family: 'openai_compatible_unknown',
      loaded_models: ['gpt-5.5'],
      resolved_model_id: 'gpt-5.5',
      capabilities: {
        chat_completions: 'supported',
        responses: 'supported',
        streaming: 'supported',
        tool_calls: 'supported',
        structured_output: 'supported',
        system_role: 'supported',
      },
      max_context_advertised: 128000,
    },
    smokePrompt: {
      prompt: 'Reply with OK.',
      output: 'OK.',
      status: 'passed',
    },
    privacyWarningState: 'cloud-warning-confirmed',
    samplingDefaults: {
      temperature: 0,
      top_p: 1,
      seed: 7,
    },
  });

  assert.equal(receipt.measurement_mode, 'explicit-model-probe');
  assert.equal(receipt.runtime.local_cloud_mode, 'cloud');
  assert.equal(receipt.capabilities.tool_function_support, 'supported');
  assert.equal(receipt.capabilities.structured_output, 'supported');
  assert.equal(receipt.model.context_length, 128000);
  assert.equal(receipt.smoke.status, 'passed');
  assert.equal(receipt.smoke.prompt, 'Reply with OK.');
  assert.equal(receipt.smoke.output, 'OK.');
  assert.equal(receipt.smoke.model_call, true);
  assert.equal(receipt.privacy.cloud_warning_required, true);
  assert.equal(receipt.privacy.warning_state, 'cloud-warning-confirmed');
  assert.equal(receipt.state_preservation.model_state_preserved, true);
});

test('runtime contract receipt markdown keeps model-state preservation visible', () => {
  const receipt = buildRuntimeContractReceipt({
    endpointCompatibility: {
      endpoint: 'http://127.0.0.1:1234/v1',
      backend_family: 'lm_studio',
      read_only: true,
      model_calls: false,
      loaded_models: [],
      capabilities: {},
    },
  });
  const markdown = renderRuntimeContractReceiptMarkdown(receipt);

  assert.match(markdown, /# Penny Runtime Contract Receipt/);
  assert.match(markdown, /Model state preserved: true/);
  assert.match(markdown, /Smoke status: not_run/);
  assert.match(markdown, /Local\/cloud mode: local/);
});

test('model runtime watch embeds a runtime contract receipt for model readiness surfaces', () => {
  const watch = buildModelRuntimeWatchArtifact({
    generatedAt: '2026-06-19T18:40:00.000Z',
    profile: 'gemma',
    endpointCompatibility: {
      endpoint: 'http://127.0.0.1:1234/v1',
      read_only: true,
      model_calls: false,
      backend_family: 'lm_studio',
      loaded_models: ['google/gemma-4-31b'],
      capabilities: {
        tool_calls: 'unknown',
        structured_output: 'unknown',
      },
    },
    chat_template: 'ChatML-like fixture',
    context_length: 32768,
  });

  assert.equal(watch.runtime_contract.schema, 'penny-runtime-contract-receipt.v1');
  assert.equal(watch.runtime_contract.model.id_or_path, 'google/gemma-4-31b');
  assert.equal(watch.runtime_contract.prompt_contract.chat_template, 'ChatML-like fixture');
  assert.equal(watch.runtime_contract.model.context_length, 32768);
  assert.equal(watch.runtime_contract.state_preservation.model_state_preserved, true);
});

test('combined memory inspector exposes a status-only runtime contract receipt', () => {
  const inspector = buildCombinedMemoryInspector({
    sessionId: 'runtime-contract-inspector',
    explicitMemory: { brainMode: 'local' },
    inspector: {
      embeddings: {
        semanticMemory: {
          ready: false,
          mode: 'keyword',
          configuredModel: 'text-embedding-nomic-embed-text-v1.5',
        },
      },
    },
    lmStudio: {
      reachable: true,
      localLlmBackend: 'llama_cpp',
      localRuntimeLabel: 'llama.cpp',
      localEndpointBase: 'http://127.0.0.1:18080/v1',
      loadedModels: ['unknown'],
      resolvedChatModel: 'unknown',
      resolvedToolModel: 'unknown',
      capabilities: {
        tool_calls: 'unknown',
        structured_output: 'unknown',
      },
    },
  });

  assert.equal(inspector.runtime.runtimeContract.schema, 'penny-runtime-contract-receipt.v1');
  assert.equal(inspector.runtime.runtimeContract.measurement_mode, 'status-only');
  assert.equal(inspector.runtime.runtimeContract.runtime.backend, 'llama_cpp');
  assert.equal(inspector.runtime.runtimeContract.runtime.local_cloud_mode, 'local');
  assert.equal(inspector.runtime.runtimeContract.model.id_or_path, 'unknown');
  assert.equal(inspector.runtime.runtimeContract.smoke.status, 'not_run');
  assert.equal(inspector.runtime.runtimeContract.smoke.model_call, false);
  assert.equal(inspector.runtime.runtimeContract.state_preservation.model_state_preserved, true);
  assert.equal(inspector.runtime.runtimeContract.memory_lane.status, 'keyword');
});
