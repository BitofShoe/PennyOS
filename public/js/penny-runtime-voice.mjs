function text(value = '') {
  return String(value || '').trim();
}

function updateText(el, value = '') {
  if (el) el.textContent = value;
}

function setDisabled(el, disabled) {
  if (el) el.disabled = disabled === true;
}

function uniqueTexts(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => text(value))
    .filter(Boolean))];
}

function escapeAttr(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function readConfigFromEls(els = {}) {
  return {
    baseUrl: text(els.voiceBaseUrl?.value),
    model: text(els.voiceModel?.value),
    voice: text(els.voiceName?.value),
    speed: readSpeedFromEls(els),
  };
}

function readGainFromEls(els = {}) {
  const gain = Number(els.voiceGain?.value || 1);
  if (!Number.isFinite(gain)) return 1;
  return Math.max(0.25, Math.min(4, gain));
}

function readSpeedFromEls(els = {}) {
  const speed = Number(els.voiceSpeed?.value || 1);
  if (!Number.isFinite(speed)) return 1;
  return Math.max(0.25, Math.min(4, speed));
}

function describeStatus(status = {}) {
  if (status.ready) return 'Speaches voice ready';
  if (status.reachable) return status.error || 'Speaches is reachable, but the configured voice model is not ready';
  return status.error || 'Speaches is not reachable';
}

function describeSetupNote(status = {}, { speaking = false, statusMessage = '' } = {}) {
  const cfg = status.config || {};
  const voice = text(cfg.voice) || 'the configured voice';
  const model = text(cfg.model) || 'the configured model';
  const baseUrl = text(cfg.baseUrl) || 'the configured Speaches URL';
  if (speaking) return 'Generating local voice audio through Speaches.';
  if (statusMessage) return statusMessage;
  if (status.ready) return `Speaches is connected. Penny will speak completed replies with ${voice} on ${model}.`;
  if (status.reachable) return `Speaches is reachable at ${baseUrl}, but ${model} is not ready. Check the model and voice, then refresh.`;
  return `Speaches is not bundled with PennyOS. Start it locally, set this URL/model/voice, then refresh.`;
}

export function createRuntimeVoiceController({
  els = {},
  apiFetch = globalThis.fetch,
  AudioCtor = globalThis.Audio,
  URLApi = globalThis.URL,
  logger = console,
} = {}) {
  let enabled = false;
  let status = { ready: false, reachable: false, config: {} };
  let activeAudio = null;
  let activeUrl = '';
  let lastAudioUrl = '';
  let lastVoice = '';
  let speaking = false;
  let statusMessage = '';

  function populateVoiceOptions(voices = []) {
    if (!els.voiceOptions) return;
    const options = uniqueTexts(voices);
    els.voiceOptions.innerHTML = options
      .map((voice) => `<option value="${escapeAttr(voice)}"></option>`)
      .join('');
  }

  function updateControls() {
    const ready = status.ready === true;
    setDisabled(els.voiceToggle, !ready);
    if (els.voiceToggle && !ready) els.voiceToggle.checked = false;
    setDisabled(els.voiceTest, !ready || speaking);
    setDisabled(els.voiceStop, !activeAudio);
    setDisabled(els.voiceReplay, !lastAudioUrl);
    updateText(els.voiceStatus, speaking ? 'Generating voice...' : (statusMessage || describeStatus(status)));
    updateText(els.voiceSetupNote, describeSetupNote(status, { speaking, statusMessage }));
    if (els.voiceStatus?.dataset) {
      els.voiceStatus.dataset.ready = ready ? 'true' : 'false';
      els.voiceStatus.dataset.reachable = status.reachable === true ? 'true' : 'false';
    }
    if (els.voiceSetupNote?.dataset) {
      els.voiceSetupNote.dataset.ready = ready ? 'true' : 'false';
      els.voiceSetupNote.dataset.reachable = status.reachable === true ? 'true' : 'false';
    }
  }

  function populateConfigFields(config = {}) {
    if (els.voiceBaseUrl && !text(els.voiceBaseUrl.value)) els.voiceBaseUrl.value = text(config.baseUrl);
    if (els.voiceModel && !text(els.voiceModel.value)) els.voiceModel.value = text(config.model);
    if (els.voiceName && !text(els.voiceName.value)) els.voiceName.value = text(config.voice);
    if (els.voiceSpeed && config.speed !== undefined && config.speed !== null) els.voiceSpeed.value = text(config.speed);
  }

  function setStatus(nextStatus = {}) {
    status = {
      ok: nextStatus.ok !== false,
      provider: nextStatus.provider || 'speaches',
      reachable: nextStatus.reachable === true,
      ready: nextStatus.ready === true,
      config: nextStatus.config || status.config || {},
      availableModels: uniqueTexts(nextStatus.availableModels),
      availableVoices: uniqueTexts(nextStatus.availableVoices),
      error: text(nextStatus.error),
    };
    statusMessage = '';
    populateConfigFields(status.config);
    populateVoiceOptions(status.availableVoices);
    lastVoice = text(status.config?.voice) || lastVoice;
    updateControls();
    return status;
  }

  function setEnabled(nextEnabled = false) {
    enabled = nextEnabled === true && status.ready === true;
    if (els.voiceToggle) els.voiceToggle.checked = enabled;
    if (!enabled) stop();
    updateControls();
    return enabled;
  }

  function revokeUrl(url = '') {
    if (!url || typeof URLApi?.revokeObjectURL !== 'function') return;
    try {
      URLApi.revokeObjectURL(url);
    } catch {}
  }

  function stop({ revoke = false } = {}) {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}
    }
    const stoppedUrl = activeUrl;
    activeAudio = null;
    activeUrl = '';
    speaking = false;
    if (!revoke) statusMessage = stoppedUrl ? 'Voice stopped' : statusMessage;
    if (revoke && stoppedUrl) {
      revokeUrl(stoppedUrl);
      if (lastAudioUrl === stoppedUrl) lastAudioUrl = '';
    }
    updateControls();
  }

  function attachAudio(url) {
    if (typeof AudioCtor !== 'function') {
      throw new Error('Browser audio playback is not available.');
    }
    const audio = new AudioCtor(url);
    audio.volume = 1;
    audio.addEventListener?.('ended', () => {
      if (activeAudio === audio) {
        activeAudio = null;
        activeUrl = '';
        speaking = false;
        updateControls();
      }
    });
    audio.addEventListener?.('error', () => {
      if (activeAudio === audio) {
        activeAudio = null;
        activeUrl = '';
        speaking = false;
        statusMessage = 'Voice playback failed';
        updateControls();
      }
    });
    activeAudio = audio;
    activeUrl = url;
    return audio;
  }

  async function refreshStatus() {
    try {
      const res = await apiFetch('/api/penny/voice/status');
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || `Voice status failed: ${res.status}`);
      return setStatus(data);
    } catch (error) {
      setStatus({
        ok: false,
        reachable: false,
        ready: false,
        config: status.config || {},
        error: error?.message || 'Speaches is not reachable',
      });
      return status;
    }
  }

  async function saveConfig() {
    const payload = readConfigFromEls(els);
    const res = await apiFetch('/api/penny/voice/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || `Voice config failed: ${res.status}`);
    return setStatus(data.status || data);
  }

  function currentVoice() {
    return text(els.voiceName?.value) || text(status.config?.voice) || lastVoice;
  }

  async function speak(value = '', { force = false, test = false } = {}) {
    const phrase = text(value);
    if (!phrase || (!enabled && !force) || status.ready !== true) return { ok: false, skipped: true };
    stop({ revoke: true });
    speaking = true;
    statusMessage = test ? 'Generating test voice...' : 'Generating voice...';
    updateControls();
    try {
      const res = await apiFetch('/api/penny/voice/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: phrase,
          voice: currentVoice(),
          gain: readGainFromEls(els),
          speed: readSpeedFromEls(els),
        }),
      });
      if (!res.ok) {
        let detail = '';
        try {
          const payload = await res.json();
          detail = payload?.error || '';
        } catch {}
        throw new Error(detail || `Voice request failed: ${res.status}`);
      }
      const blob = await res.blob();
      if (typeof URLApi?.createObjectURL !== 'function') {
        throw new Error('Browser object URL support is not available.');
      }
      const url = URLApi.createObjectURL(blob);
      lastAudioUrl = url;
      const audio = attachAudio(url);
      await audio.play();
      speaking = false;
      statusMessage = test ? 'Playing test voice' : 'Playing voice';
      updateControls();
      return { ok: true };
    } catch (error) {
      speaking = false;
      statusMessage = error?.message || 'Voice failed';
      logger?.warn?.(`[penny voice] ${error?.message || error}`);
      updateControls();
      return { ok: false, error };
    }
  }

  function testSpeak(value = 'Testing the selected Penny voice.') {
    return speak(value, { force: true, test: true });
  }

  async function replay() {
    if (!lastAudioUrl) return { ok: false, skipped: true };
    stop();
    try {
      const audio = attachAudio(lastAudioUrl);
      await audio.play();
      statusMessage = 'Replaying voice';
      updateControls();
      return { ok: true };
    } catch (error) {
      statusMessage = error?.message || 'Voice replay failed';
      updateControls();
      return { ok: false, error };
    }
  }

  updateControls();

  return {
    refreshStatus,
    saveConfig,
    setStatus,
    setEnabled,
    speak,
    testSpeak,
    stop,
    replay,
    getStatus: () => ({ ...status }),
    isEnabled: () => enabled,
  };
}
