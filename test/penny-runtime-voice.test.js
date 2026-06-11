const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RuntimeVoiceError,
  createRuntimeVoiceApi,
} = require('../lib/penny-runtime-voice');
const {
  createPennyRouteHandlers,
} = require('../lib/penny-route-handlers');

function makeJsonResponse(body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-type'
          ? (options.contentType || 'application/json')
          : null;
      },
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function makeAudioResponse(bytes, options = {}) {
  const buffer = Buffer.from(bytes);
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-type'
          ? (options.contentType || 'audio/wav')
          : null;
      },
    },
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
    async text() {
      return 'upstream error';
    },
  };
}

function createBinaryResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test('runtime voice status reports Speaches readiness from the configured model list', async () => {
  const calls = [];
  const voice = createRuntimeVoiceApi({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return makeJsonResponse({
        data: [
          { id: 'speaches-ai/Kokoro-82M-v1.0-ONNX' },
          { id: 'other-model' },
        ],
      });
    },
    config: {
      baseUrl: 'http://127.0.0.1:8000',
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      voice: 'af_heart',
    },
  });

  const status = await voice.getStatus();

  assert.equal(status.ok, true);
  assert.equal(status.provider, 'speaches');
  assert.equal(status.reachable, true);
  assert.equal(status.ready, true);
  assert.equal(status.config.baseUrl, 'http://127.0.0.1:8000');
  assert.equal(status.config.model, 'speaches-ai/Kokoro-82M-v1.0-ONNX');
  assert.equal(status.config.voice, 'af_heart');
  assert.deepEqual(status.availableModels, [
    'speaches-ai/Kokoro-82M-v1.0-ONNX',
    'other-model',
  ]);
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/v1/models');
});

test('runtime voice config accepts scheme-less loopback Speaches addresses', () => {
  const voice = createRuntimeVoiceApi({
    fetchImpl: async () => makeJsonResponse({ data: [] }),
    config: {
      baseUrl: '127.0.0.1:8000',
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      voice: 'af_heart',
    },
  });

  assert.equal(voice.getConfig().baseUrl, 'http://127.0.0.1:8000');
});

test('runtime voice synthesis posts Speaches speech payload and returns audio bytes', async () => {
  const calls = [];
  const voice = createRuntimeVoiceApi({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return makeAudioResponse([82, 73, 70, 70], { contentType: 'audio/wav' });
    },
    config: {
      baseUrl: 'http://127.0.0.1:8000/',
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      voice: 'af_heart',
      responseFormat: 'wav',
    },
  });

  const result = await voice.synthesizeSpeech({ text: 'Hello from Penny.' });

  assert.equal(result.ok, true);
  assert.equal(result.contentType, 'audio/wav');
  assert.deepEqual([...result.audioBuffer], [82, 73, 70, 70]);
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/v1/audio/speech');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
    voice: 'af_heart',
    input: 'Hello from Penny.',
    response_format: 'wav',
  });
});

test('runtime voice synthesis rejects empty text and zero-byte upstream audio honestly', async () => {
  const voice = createRuntimeVoiceApi({
    fetchImpl: async () => makeAudioResponse([], { contentType: 'audio/wav' }),
    config: {
      baseUrl: 'http://127.0.0.1:8000',
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      voice: 'af_heart',
    },
  });

  await assert.rejects(
    () => voice.synthesizeSpeech({ text: '   ' }),
    (error) => error instanceof RuntimeVoiceError
      && error.statusCode === 400
      && error.code === 'empty_text',
  );
  await assert.rejects(
    () => voice.synthesizeSpeech({ text: 'not empty' }),
    (error) => error instanceof RuntimeVoiceError
      && error.statusCode === 502
      && error.code === 'empty_audio',
  );
});

test('runtime voice route returns binary audio and does not call review sidecars', async () => {
  let runnerCalled = false;
  let speechPayload = null;
  const handlers = createPennyRouteHandlers({
    sendJson() {
      throw new Error('voice speech route should not JSON-serialize audio');
    },
    async safeReadBody() {
      return JSON.stringify({ text: 'Say the line.', voice: 'af_heart' });
    },
    runSidecarWorkflow() {
      runnerCalled = true;
    },
    runtimeVoice: {
      async synthesizeSpeech(payload) {
        speechPayload = payload;
        return {
          ok: true,
          contentType: 'audio/wav',
          audioBuffer: Buffer.from([82, 73, 70, 70]),
        };
      },
    },
  });
  const res = createBinaryResponseRecorder();

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res,
    url: new URL('http://localhost/api/penny/voice/speech'),
  });

  assert.equal(handled, true);
  assert.equal(runnerCalled, false);
  assert.deepEqual(speechPayload, { text: 'Say the line.', voice: 'af_heart' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'audio/wav');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['X-Penny-Voice-Provider'], 'speaches');
  assert.equal(res.headers['Content-Length'], 4);
  assert.deepEqual([...res.body], [82, 73, 70, 70]);
});

test('runtime voice routes expose status and config without the review sidecar gate', async () => {
  const responses = [];
  let configured = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      responses.push({ statusCode, json });
    },
    async safeReadBody() {
      return JSON.stringify({
        baseUrl: 'http://127.0.0.1:8001',
        model: 'kokoro',
        voice: 'af_bella',
      });
    },
    runtimeVoice: {
      getConfig() {
        return {
          provider: 'speaches',
          baseUrl: 'http://127.0.0.1:8000',
          model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
          voice: 'af_heart',
          responseFormat: 'wav',
        };
      },
      async getStatus() {
        return { ok: true, provider: 'speaches', reachable: true, ready: true };
      },
      async setConfig(nextConfig) {
        configured = nextConfig;
        return { ok: true, config: nextConfig };
      },
    },
  });

  assert.equal(await handlers.handleApiRoute({
    req: { method: 'GET' },
    res: {},
    url: new URL('http://localhost/api/penny/voice/status'),
  }), true);
  assert.equal(await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/voice/config'),
  }), true);

  assert.equal(responses[0].statusCode, 200);
  assert.equal(responses[0].json.ready, true);
  assert.equal(responses[1].statusCode, 200);
  assert.deepEqual(configured, {
    baseUrl: 'http://127.0.0.1:8001',
    model: 'kokoro',
    voice: 'af_bella',
  });
});
