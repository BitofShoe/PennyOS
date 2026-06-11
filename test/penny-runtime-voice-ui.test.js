const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-runtime-voice.mjs');

function buildEls() {
  return {
    voiceToggle: { checked: false, disabled: true },
    voiceStatus: { textContent: '', dataset: {} },
    voiceBaseUrl: { value: '' },
    voiceModel: { value: '' },
    voiceName: { value: '' },
    voiceStop: { disabled: true },
    voiceReplay: { disabled: true },
  };
}

function createAudioHarness() {
  const instances = [];
  class FakeAudio {
    constructor(url) {
      this.url = url;
      this.paused = true;
      this.currentTime = 0;
      this.events = {};
      this.playCalls = 0;
      this.pauseCalls = 0;
      instances.push(this);
    }

    addEventListener(event, listener) {
      this.events[event] = listener;
    }

    async play() {
      this.playCalls += 1;
      this.paused = false;
    }

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
  }
  return { FakeAudio, instances };
}

test('runtime voice controller enables the toggle only when Speaches is ready', async () => {
  const { createRuntimeVoiceController } = await helpersPromise;
  const els = buildEls();
  const calls = [];
  const controller = createRuntimeVoiceController({
    els,
    apiFetch: async (path) => {
      calls.push(path);
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            provider: 'speaches',
            reachable: true,
            ready: true,
            config: {
              baseUrl: 'http://127.0.0.1:8000',
              model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
              voice: 'af_heart',
            },
          };
        },
      };
    },
  });

  const status = await controller.refreshStatus();

  assert.equal(status.ready, true);
  assert.deepEqual(calls, ['/api/penny/voice/status']);
  assert.equal(els.voiceToggle.disabled, false);
  assert.equal(els.voiceBaseUrl.value, 'http://127.0.0.1:8000');
  assert.equal(els.voiceModel.value, 'speaches-ai/Kokoro-82M-v1.0-ONNX');
  assert.equal(els.voiceName.value, 'af_heart');
  assert.match(els.voiceStatus.textContent, /ready/i);
});

test('runtime voice controller fetches audio for enabled assistant replies and cancels previous playback', async () => {
  const { createRuntimeVoiceController } = await helpersPromise;
  const els = buildEls();
  const audio = createAudioHarness();
  const objectUrls = [];
  const revokedUrls = [];
  const fetchCalls = [];
  let objectCounter = 0;
  const controller = createRuntimeVoiceController({
    els,
    AudioCtor: audio.FakeAudio,
    URLApi: {
      createObjectURL(blob) {
        objectUrls.push(blob);
        objectCounter += 1;
        return `blob:voice-${objectCounter}`;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
    apiFetch: async (path, options = {}) => {
      fetchCalls.push({ path, options });
      return {
        ok: true,
        status: 200,
        async blob() {
          return { type: 'audio/wav', bytes: [82, 73, 70, 70] };
        },
      };
    },
  });

  controller.setStatus({ ready: true, reachable: true, config: { voice: 'af_heart' } });
  controller.setEnabled(true);
  await controller.speak('First assistant reply.');
  await controller.speak('Second assistant reply.');

  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].path, '/api/penny/voice/speech');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
    text: 'First assistant reply.',
    voice: 'af_heart',
  });
  assert.equal(audio.instances.length, 2);
  assert.equal(audio.instances[0].pauseCalls, 1);
  assert.equal(audio.instances[1].playCalls, 1);
  assert.deepEqual(revokedUrls, ['blob:voice-1']);
  assert.equal(els.voiceStop.disabled, false);
  assert.equal(els.voiceReplay.disabled, false);
});

test('runtime voice controller stops and replays the last generated audio', async () => {
  const { createRuntimeVoiceController } = await helpersPromise;
  const els = buildEls();
  const audio = createAudioHarness();
  const controller = createRuntimeVoiceController({
    els,
    AudioCtor: audio.FakeAudio,
    URLApi: {
      createObjectURL() {
        return 'blob:last-audio';
      },
      revokeObjectURL() {},
    },
    apiFetch: async () => ({
      ok: true,
      status: 200,
      async blob() {
        return { type: 'audio/wav' };
      },
    }),
  });

  controller.setStatus({ ready: true, reachable: true, config: { voice: 'af_heart' } });
  controller.setEnabled(true);
  await controller.speak('Replay me.');
  controller.stop();
  await controller.replay();

  assert.equal(audio.instances[0].pauseCalls, 1);
  assert.equal(audio.instances.length, 2);
  assert.equal(audio.instances[1].url, 'blob:last-audio');
  assert.equal(audio.instances[1].playCalls, 1);
});

test('runtime voice controller saves provider config through the runtime route', async () => {
  const { createRuntimeVoiceController } = await helpersPromise;
  const els = buildEls();
  els.voiceBaseUrl.value = 'http://127.0.0.1:8001';
  els.voiceModel.value = 'kokoro';
  els.voiceName.value = 'af_bella';
  const calls = [];
  const controller = createRuntimeVoiceController({
    els,
    apiFetch: async (path, options = {}) => {
      calls.push({ path, options });
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            status: {
              ok: true,
              ready: true,
              config: {
                baseUrl: 'http://127.0.0.1:8001',
                model: 'kokoro',
                voice: 'af_bella',
              },
            },
          };
        },
      };
    },
  });

  await controller.saveConfig();

  assert.equal(calls[0].path, '/api/penny/voice/config');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    baseUrl: 'http://127.0.0.1:8001',
    model: 'kokoro',
    voice: 'af_bella',
  });
  assert.equal(els.voiceToggle.disabled, false);
});
