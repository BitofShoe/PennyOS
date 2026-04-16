const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-lmstudio-ui.js');

function buildEls() {
  return {
    backendReachability: { textContent: '' },
    backendModel: { textContent: '' },
    backendToolModel: { textContent: '' },
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
