const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildCloudProviderStatus,
  buildOpenAiCloudEnvPatch,
  probeOpenAiCloudProvider,
  redactApiKey,
  upsertPennyEnvFile,
} = require('../lib/penny-cloud-provider-config');

test('OpenAI cloud patch uses explicit cloud labels and compatible Penny env keys', () => {
  const patch = buildOpenAiCloudEnvPatch({
    apiKey: 'sk-test-secret',
    chatModel: 'gpt-5.5',
  });

  assert.equal(patch.PENNY_LOCAL_LLM_BACKEND, 'openai_compatible');
  assert.equal(patch.PENNY_LOCAL_RUNTIME_LABEL, 'OpenAI API (cloud)');
  assert.equal(patch.PENNY_LMSTUDIO_BASE, 'https://api.openai.com/v1');
  assert.equal(patch.PENNY_LMSTUDIO_EMBED_BASE, 'https://api.openai.com/v1');
  assert.equal(patch.PENNY_LOCAL_LLM_TRANSPORT, 'chat');
  assert.equal(patch.PENNY_SKIP_LMSTUDIO_PREP, '1');
  assert.equal(patch.PENNY_LMSTUDIO_CHAT_MODEL, 'gpt-5.5');
  assert.equal(patch.PENNY_LMSTUDIO_TOOL_MODEL, 'gpt-5.5');
  assert.equal(patch.PENNY_LMSTUDIO_EMBED_MODEL, 'text-embedding-3-small');
  assert.equal(patch.PENNY_LMSTUDIO_API_KEY, 'sk-test-secret');
});

test('OpenAI cloud env writer preserves unrelated values and never returns the API key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-cloud-env-'));
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, [
    '# existing Penny env',
    'PENNY_ENABLE_OPEN_LOOP_PROMPT=1',
    'PENNY_LMSTUDIO_BASE=http://127.0.0.1:1234/v1',
    'PENNY_LMSTUDIO_API_KEY=old-secret',
    '',
  ].join('\n'));

  const result = upsertPennyEnvFile({
    envFile,
    patch: buildOpenAiCloudEnvPatch({
      apiKey: 'sk-live-secret',
      chatModel: 'gpt-5.5',
      embedModel: 'text-embedding-3-small',
    }),
  });
  const text = fs.readFileSync(envFile, 'utf8');

  assert.equal(result.ok, true);
  assert.equal(result.apiKeyConfigured, true);
  assert.equal(result.apiKeyPreview, redactApiKey('sk-live-secret'));
  assert.equal(JSON.stringify(result).includes('sk-live-secret'), false);
  assert.match(text, /PENNY_ENABLE_OPEN_LOOP_PROMPT=1/);
  assert.match(text, /PENNY_LOCAL_RUNTIME_LABEL="OpenAI API \(cloud\)"/);
  assert.match(text, /PENNY_LMSTUDIO_API_KEY="sk-live-secret"/);
  assert.equal((text.match(/PENNY_LMSTUDIO_BASE=/g) || []).length, 1);
});

test('cloud provider status is explicit about privacy and active provider', () => {
  const status = buildCloudProviderStatus({
    env: {
      PENNY_LOCAL_LLM_BACKEND: 'openai_compatible',
      PENNY_LOCAL_RUNTIME_LABEL: 'OpenAI API (cloud)',
      PENNY_LMSTUDIO_BASE: 'https://api.openai.com/v1',
      PENNY_LMSTUDIO_CHAT_MODEL: 'gpt-5.5',
      PENNY_LMSTUDIO_TOOL_MODEL: 'gpt-5.5',
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-3-small',
      PENNY_LMSTUDIO_API_KEY: 'sk-test-secret',
    },
  });

  assert.equal(status.activeProvider, 'openai-cloud');
  assert.equal(status.openAiCloudConfigured, true);
  assert.equal(status.apiKeyConfigured, true);
  assert.equal(status.apiKeyPreview, redactApiKey('sk-test-secret'));
  assert.equal(JSON.stringify(status).includes('sk-test-secret'), false);
  assert.equal(status.privacy.localFirstDefault, true);
  assert.equal(status.privacy.sendsPromptsOffDevice, true);
  assert.equal(status.privacy.warningRequired, true);
});

test('OpenAI cloud probe sends bearer auth and returns only model summary', async () => {
  let request = null;
  const result = await probeOpenAiCloudProvider({
    apiKey: 'sk-test-secret',
    baseUrl: 'https://api.openai.com/v1',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            data: [
              { id: 'gpt-5.5' },
              { id: 'text-embedding-3-small' },
            ],
          });
        },
      };
    },
  });

  assert.equal(request.url, 'https://api.openai.com/v1/models');
  assert.equal(request.options.headers.Authorization, 'Bearer sk-test-secret');
  assert.deepEqual(result.sampleModels, ['gpt-5.5', 'text-embedding-3-small']);
  assert.equal(JSON.stringify(result).includes('sk-test-secret'), false);
});
