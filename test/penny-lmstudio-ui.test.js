const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-lmstudio-ui.js');

function buildEls() {
  return {
    backendReachability: { textContent: '' },
    backendModel: { textContent: '' },
    backendToolModel: { textContent: '' },
    modelSetupPanel: { hidden: false, dataset: {}, className: '' },
    modelSetupStatus: { textContent: '' },
    modelSetupHint: { textContent: '' },
    modelSetupEmbedding: { textContent: '' },
    modelSetupFallback: { checked: false },
  };
}

test('updateBackendStatusUi renders warm cached readiness from primary status payload', async () => {
  const { updateBackendStatusUi } = await helpersPromise;
  const els = buildEls();
  const state = {};

  updateBackendStatusUi({
    els,
    state,
    status: {
      localLlmTransport: 'chat',
      readiness: {
        chatModelReady: true,
        toolModelReady: true,
        embeddingReady: true,
        fallbackActive: false,
        warmState: 'warm',
        cacheAgeMs: 12000,
        cacheHit: true,
      },
      lmStudio: {
        reachable: true,
        resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
        resolvedToolModel: 'google/gemma-4-e4b',
      },
    },
  });

  assert.match(els.backendReachability.textContent, /ready \/ chat \/ warm \/ 12s old/i);
  assert.equal(els.backendModel.textContent, 'unsloth/gemma-4-31b-it@q6_k');
  assert.equal(els.backendToolModel.textContent, 'google/gemma-4-e4b');
  assert.equal(state.backendStatus.lmStudio.reachable, true);
});

test('updateBackendStatusUi keeps offline cold states explicit', async () => {
  const { updateBackendStatusUi } = await helpersPromise;
  const els = buildEls();

  updateBackendStatusUi({
    els,
    status: {
      readiness: {
        warmState: 'cold',
      },
      lmStudio: {
        reachable: false,
        error: 'not detected',
        toolPreferredModel: 'google/gemma-4-e4b',
      },
    },
  });

  assert.equal(els.backendReachability.textContent, 'offline / cold');
  assert.equal(els.backendModel.textContent, 'not detected');
  assert.equal(els.backendToolModel.textContent, 'google/gemma-4-e4b');
});

test('findBestModelMatch treats UD quant suffixes as model-family aliases', async () => {
  const { findBestModelMatch } = await helpersPromise;

  const match = findBestModelMatch(
    ['unsloth/qwen3.6-35b-a3b@ud-q4_k_xl'],
    'qwen3.6-35b-a3b',
  );

  assert.equal(match, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
});

test('buildFirstRunModelSetupViewModel turns missing loaded models into a clear setup checklist', async () => {
  const { buildFirstRunModelSetupViewModel } = await helpersPromise;

  const viewModel = buildFirstRunModelSetupViewModel({
    lmStudio: {
      reachable: true,
      installedModels: ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b', 'text-embedding-nomic-embed-text-v1.5'],
      availableModels: [],
      resolvedChatModel: '',
      resolvedToolModel: '',
      chatPreferredModel: 'google/gemma-4-31b',
      toolPreferredModel: 'google/gemma-4-e4b',
      hint: 'LM Studio is reachable, but no usable chat model is currently loaded.',
      modelFallbackDisabled: false,
    },
    semanticMemory: {
      ready: false,
      mode: 'keyword',
      configuredModel: 'text-embedding-nomic-embed-text-v1.5',
    },
    readiness: {
      fallbackActive: true,
      warmState: 'degraded',
    },
  });

  assert.equal(viewModel.visible, true);
  assert.equal(viewModel.severity, 'needs-setup');
  assert.match(viewModel.statusText, /LM Studio is reachable/i);
  assert.match(viewModel.hintText, /load one in LM Studio/i);
  assert.match(viewModel.embeddingText, /optional/i);
  assert.equal(viewModel.fallbackEnabled, true);
  assert.deepEqual(viewModel.chatModels, ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b', 'google/gemma-4-31b']);
  assert.deepEqual(viewModel.toolModels, ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b']);
});

test('updateModelSetupUi renders fallback and embedding status without hiding successful setup', async () => {
  const { updateModelSetupUi } = await helpersPromise;
  const els = buildEls();

  const viewModel = updateModelSetupUi({
    els,
    status: {
      lmStudio: {
        reachable: true,
        resolvedChatModel: 'unsloth/gemma-4-31b-it',
        resolvedToolModel: 'google/gemma-4-e4b',
        modelFallbackDisabled: true,
      },
      semanticMemory: {
        ready: true,
        mode: 'semantic',
        configuredModel: 'text-embedding-nomic-embed-text-v1.5',
      },
      readiness: {
        warmState: 'warm',
        fallbackActive: false,
      },
    },
  });

  assert.equal(viewModel.visible, false);
  assert.equal(els.modelSetupPanel.dataset.severity, 'ready');
  assert.match(els.modelSetupStatus.textContent, /ready/i);
  assert.match(els.modelSetupEmbedding.textContent, /semantic memory ready/i);
  assert.equal(els.modelSetupFallback.checked, false);
});
