const STORAGE_KEY = 'penny:v3';

const MOODS = {
  calm: { primary: '#7dd3fc', secondary: '#0ea5e9', glow: 'rgba(125,211,252,0.24)', ring: 'rgba(125,211,252,0.14)', label: 'calm' },
  happy: { primary: '#86efac', secondary: '#22c55e', glow: 'rgba(134,239,172,0.24)', ring: 'rgba(134,239,172,0.14)', label: 'happy' },
  excited: { primary: '#fcd34d', secondary: '#f59e0b', glow: 'rgba(252,211,77,0.26)', ring: 'rgba(252,211,77,0.16)', label: 'excited' },
  thinking: { primary: '#d8b4fe', secondary: '#8b5cf6', glow: 'rgba(216,180,254,0.25)', ring: 'rgba(216,180,254,0.14)', label: 'thinking' },
  surprised: { primary: '#f9a8d4', secondary: '#ec4899', glow: 'rgba(249,168,212,0.25)', ring: 'rgba(249,168,212,0.14)', label: 'surprised' },
};

const DEFAULT_MEMORY = {
  memories: [],
  userName: '',
  voiceOn: false,
  brainMode: 'local',
  sessionId: `penny-local-${Math.random().toString(36).slice(2, 10)}`,
};

const state = {
  panel: 'chat',
  messages: [],
  mood: 'calm',
  presence: 'idle',
  loading: false,
  consolidating: false,
  syncingMemory: false,
  turns: 0,
  backendStatus: null,
  memory: structuredClone(DEFAULT_MEMORY),
};

const els = {
  chat: document.getElementById('chat'),
  composer: document.getElementById('composer'),
  send: document.getElementById('send'),
  moodPill: document.getElementById('moodPill'),
  presenceValue: document.getElementById('presenceValue'),
  turnsValue: document.getElementById('turnsValue'),
  statusValue: document.getElementById('statusValue'),
  statusValueTop: document.getElementById('statusValueTop'),
  coreFace: document.getElementById('coreFace'),
  shell: document.getElementById('shell'),
  intro: document.getElementById('intro'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  views: Array.from(document.querySelectorAll('.view')),
  memoryList: document.getElementById('memoryList'),
  nameInput: document.getElementById('nameInput'),
  voiceToggle: document.getElementById('voiceToggle'),
  brainModeShadow: document.getElementById('brainModeShadow'),
  brainModeLocal: document.getElementById('brainModeLocal'),
  brainModeNote: document.getElementById('brainModeNote'),
  backendReachability: document.getElementById('backendReachability'),
  backendModel: document.getElementById('backendModel'),
  newChat: document.getElementById('newChat'),
  clearMemory: document.getElementById('clearMemory'),
  refreshMemory: document.getElementById('refreshMemory'),
  clearAllMemories: document.getElementById('clearAllMemories'),
  modelSelect: document.getElementById('modelSelect'),
};

function parseMood(text) {
  const str = String(text || '');
  const all = [...str.matchAll(/\[MOOD:(\w+)\]/g)];
  const lastTag = all.length ? all[all.length - 1][1] : null;
  const mood = lastTag && MOODS[lastTag] ? lastTag : 'calm';
  return { mood, text: str.replace(/\s*\[MOOD:\w+\]\s*/g, '').trim() };
}

function escapeHtml(text) {
  return String(text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const MOOD_SPRITES = {
  calm: [
    { src: '/sprites/penny-mood-calm.png', label: 'ONLINE', pos: '62% 14%' },
    { src: '/sprites/penny-mood-calm-2.png', label: 'READING YOU', pos: '58% 12%' },
  ],
  happy: [
    { src: '/sprites/penny-mood-happy.png', label: 'CHARM MODE', pos: '52% 10%' },
    { src: '/sprites/penny-mood-happy-2.png', label: 'SOFT SPOT', pos: '62% 10%' },
  ],
  excited: [
    { src: '/sprites/penny-mood-excited.png', label: 'MAX HYPE', pos: '50% 12%' },
    { src: '/sprites/penny-mood-excited-2.png', label: 'GOTCHA', pos: '52% 8%' },
  ],
  thinking: [
    { src: '/sprites/penny-mood-thinking.png', label: 'LOCKED IN', pos: '52% 12%' },
    { src: '/sprites/penny-mood-thinking-2.png', label: 'PROCESSING', pos: '64% 10%' },
  ],
  surprised: [
    { src: '/sprites/penny-mood-surprised.png', label: 'FLUSTERED', pos: '66% 14%' },
    { src: '/sprites/penny-mood-surprised-2.png', label: 'CAUGHT OFF GUARD', pos: '52% 8%' },
  ],
};

function pickSprite(mood) {
  const variants = MOOD_SPRITES[mood] || MOOD_SPRITES.calm;
  return variants[Math.floor(Math.random() * variants.length)];
}

function companionFaceHtml(mood) {
  const sprite = pickSprite(mood);
  return `
    <div class="penny-display penny-${mood}">
      <img src="${sprite.src}" class="penny-art" alt="Penny" draggable="false"
           style="object-position: ${sprite.pos}" />
      <div class="penny-hud">
        <span class="penny-hud-left">PENNY.EXE</span>
        <span class="penny-hud-right">${sprite.label}</span>
      </div>
      <div class="penny-hud-bottom">${mood.toUpperCase()}</div>
    </div>
  `;
}


function updateBrainModeUi(meta = null) {
  const mode = state.memory.brainMode === 'local' ? 'local' : 'shadow';
  if (els.brainModeShadow) els.brainModeShadow.checked = mode === 'shadow';
  if (els.brainModeLocal) els.brainModeLocal.checked = mode === 'local';
  if (!els.brainModeNote) return;
  if (!meta) {
    els.brainModeNote.textContent = mode === 'shadow'
      ? 'Shadow brain uses the OpenClaw lane. It is still experimental.'
      : 'Local brain mode now talks directly to LM Studio.';
    return;
  }
  if (meta.requestedMode === 'shadow' && meta.usedFallback) {
    const reason = meta.shadowError ? ` ${meta.shadowError}` : '';
    els.brainModeNote.textContent = `Shadow failed, so this reply used the local placeholder fallback.${reason}`;
    return;
  }
  if (meta.backend === 'openclaw-shadow') {
    els.brainModeNote.textContent = 'Shadow brain handled the last reply.';
    return;
  }
  els.brainModeNote.textContent = mode === 'local'
    ? 'Local LM Studio brain handled the last reply.'
    : 'Shadow brain is selected; if it fails, Penny will block the reply instead of silently faking it.';
}

let _lastSpriteKey = '';
let _spriteTimer = null;

function renderSprite(mood, palette) {
  const container = els.coreFace;
  if (mood === _lastSpriteKey) return;

  const html = companionFaceHtml(mood);

  if (!container.querySelector('.penny-display')) {
    container.innerHTML = html;
    _lastSpriteKey = mood;
    return;
  }

  if (_spriteTimer) { clearTimeout(_spriteTimer); _spriteTimer = null; }

  container.style.transition = 'opacity 100ms ease-out';
  container.style.opacity = '0.04';

  _spriteTimer = setTimeout(() => {
    container.innerHTML = html;
    container.style.transition = 'opacity 180ms ease-in';
    container.style.opacity = '1';
    _spriteTimer = setTimeout(() => {
      container.style.transition = '';
      _spriteTimer = null;
    }, 200);
    _lastSpriteKey = mood;
  }, 110);
}

function updateTheme() {
  const palette = MOODS[state.mood] || MOODS.calm;
  document.documentElement.style.setProperty('--primary', palette.primary);
  document.documentElement.style.setProperty('--secondary', palette.secondary);
  document.documentElement.style.setProperty('--glow', palette.glow);
  document.documentElement.style.setProperty('--ring', palette.ring);
  els.moodPill.textContent = state.loading ? 'thinking' : palette.label;
  els.presenceValue.textContent = state.presence;
  els.turnsValue.textContent = String(state.turns);
  const statusText = state.loading ? 'processing' : state.consolidating ? 'saving memory' : state.syncingMemory ? 'syncing memory' : 'live';
  els.statusValue.textContent = statusText;
  els.statusValueTop.textContent = statusText;
  renderSprite(state.mood, palette);
  els.shell.dataset.mood = state.mood;
}

function updateBackendStatusUi(status = null) {
  state.backendStatus = status;
  if (!els.backendReachability || !els.backendModel) return;

  const lmStudio = status?.lmStudio || status;
  if (!lmStudio) {
    els.backendReachability.textContent = 'unknown';
    els.backendModel.textContent = 'pending';
    return;
  }

  if (lmStudio.reachable) {
    els.backendReachability.textContent = status?.localLlmTransport
      ? `ready / ${status.localLlmTransport}`
      : 'ready';
    els.backendModel.textContent = lmStudio.resolvedModel || lmStudio.configuredModel || 'available';
    return;
  }

  els.backendReachability.textContent = 'offline';
  els.backendModel.textContent = lmStudio.error || lmStudio.hint || 'not detected';
}

function renderMessages() {
  els.chat.innerHTML = '';
  els.intro.hidden = state.messages.length !== 0;
  for (const msg of state.messages) {
    const item = document.createElement('div');
    item.className = `msg-row ${msg.role}`;
    if (msg.role === 'assistant') {
      const label = document.createElement('div');
      label.className = 'msg-label';
      label.textContent = 'PENNY';
      item.appendChild(label);
    }
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role}`;
    bubble.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');
    item.appendChild(bubble);
    els.chat.appendChild(item);
  }
  if (state.loading) {
    const loading = document.createElement('div');
    loading.className = 'msg-row assistant';
    loading.innerHTML = `<div class="msg-label">PENNY</div><div class="bubble assistant loading-bubble"><span></span><span></span><span></span></div>`;
    els.chat.appendChild(loading);
  }
  els.chat.parentElement.scrollTop = els.chat.parentElement.scrollHeight;
}

function renderMemory() {
  const memories = state.memory.memories || [];
  if (els.memoryList) {
    els.memoryList.className = `list-block${memories.length ? '' : ' empty'}`;
    els.memoryList.innerHTML = memories.length
      ? memories.map((item, index) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtml(item.text)}<small>${escapeHtml(item.kind || 'memory')}</small></div><button class="memory-remove" data-kind="memory" data-index="${index}" type="button">x</button></div>`).join('')
      : 'Nothing stored yet. Penny will start picking things up as you talk.';
  }
  if (els.nameInput) els.nameInput.value = state.memory.userName || '';
  if (els.voiceToggle) els.voiceToggle.checked = !!state.memory.voiceOn;
  updateBrainModeUi();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ memory: state.memory, messages: state.messages.slice(-16), mood: state.mood, turns: state.turns }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.memory = { ...structuredClone(DEFAULT_MEMORY), ...(parsed.memory || {}) };
    if (state.memory.brainMode !== 'local' && state.memory.brainMode !== 'shadow') state.memory.brainMode = 'shadow';
    state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    state.mood = parsed.mood && MOODS[parsed.mood] ? parsed.mood : 'calm';
    state.turns = Number(parsed.turns || state.messages.filter(m => m.role === 'assistant').length || 0);
    state.presence = state.messages.length ? 'present' : 'idle';
  } catch {}
}

function applyDebugSpriteOverrides() {
  try {
    const params = new URLSearchParams(window.location.search);
    const debugMood = params.get('debugMood');
    const debugTurns = params.get('debugTurns');
    if (debugMood && MOODS[debugMood]) state.mood = debugMood;
    if (debugTurns !== null && debugTurns !== '') state.turns = Number(debugTurns) || 0;
    if (params.get('debugIdle') === '1') {
      state.messages = [];
      state.presence = 'idle';
    }
  } catch {}
}

function switchPanel(panel) {
  state.panel = panel;
  for (const tab of els.tabs) tab.classList.toggle('active', tab.dataset.panel === panel);
  for (const view of els.views) view.classList.toggle('active', view.dataset.view === panel);
}

function maybeSpeak(text) {
  if (!state.memory.voiceOn || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.03;
  utterance.pitch = 1.08;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function applyMemory(memory) {
  if (!memory) return;
  state.memory = {
    ...state.memory,
    ...memory,
    memories: Array.isArray(memory.memories) ? memory.memories : state.memory.memories,
  };
  if (state.memory.brainMode !== 'local' && state.memory.brainMode !== 'shadow') state.memory.brainMode = 'shadow';
}

async function memoryRequest(method, body, query = '') {
  const res = await fetch(`/api/penny/memory${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Memory request failed: ${res.status}`);
  return res.json();
}

async function syncMemoryToDisk() {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('POST', { sessionId: state.memory.sessionId, memory: state.memory });
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function loadDurableMemory() {
  state.syncingMemory = true; updateTheme();
  try {
    const res = await fetch(`/api/penny/memory?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function patchMemory(patch) {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('PATCH', { sessionId: state.memory.sessionId, patch });
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function loadBackendStatus() {
  try {
    const res = await fetch('/api/penny/status');
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    const data = await res.json();
    updateBackendStatusUi(data);
    if (!data.shadowEnabled && state.memory.brainMode === 'shadow') {
      state.memory.brainMode = 'local';
      renderMemory();
      saveState();
      if (!state.syncingMemory) {
        await syncMemoryToDisk();
      }
    }
  } catch {
    updateBackendStatusUi({ reachable: false, error: 'Unable to reach Penny status route.' });
  }
}

async function loadAvailableModels() {
  if (!els.modelSelect) return;
  try {
    const res = await fetch('/api/penny/lmstudio/status');
    if (!res.ok) return;
    const data = await res.json();
    const models = (data.availableModels || []).filter(id => !/\b(embed|embedding|rerank)\b/i.test(id));
    if (!models.length) {
      els.modelSelect.innerHTML = '<option value="">no models loaded</option>';
      return;
    }
    const resolved = data.resolvedModel || '';
    const runtime = data.runtimePreferredModel || '';
    const selected = runtime || resolved || models[0];
    els.modelSelect.innerHTML = models.map(id =>
      `<option value="${id}"${id === selected ? ' selected' : ''}>${id}</option>`
    ).join('');
  } catch {}
}

els.modelSelect?.addEventListener('change', async () => {
  const model = els.modelSelect.value;
  if (!model) return;
  try {
    const res = await fetch('/api/penny/lmstudio/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const data = await res.json();
    if (data.resolvedModel && els.backendModel) {
      els.backendModel.textContent = data.resolvedModel;
    }
  } catch {}
});

async function consolidateMemory() {
  if (state.consolidating) return;
  state.consolidating = true; updateTheme();
  try {
    const res = await fetch('/api/penny/consolidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: state.messages.slice(-8), memories: state.memory }) });
    if (!res.ok) throw new Error('Consolidation failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.consolidating = false; updateTheme(); }
}

async function sendMessage() {
  const userText = els.composer.value.trim();
  if (!userText || state.loading) return;
  state.messages.push({ role: 'user', content: userText });
  els.composer.value = ''; state.loading = true; state.presence = 'thinking'; renderMessages(); updateTheme(); saveState();
  try {
    const res = await fetch('/api/penny/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: state.messages, memories: state.memory }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      updateBrainModeUi(data.meta || { requestedMode: state.memory.brainMode, usedFallback: false, shadowError: data.detail || data.error || `Request failed: ${res.status}` });
      throw new Error(data.detail || data.error || `Request failed: ${res.status}`);
    }
    const parsed = parseMood(data.text || 'Something glitched.');
    state.messages.push({ role: 'assistant', content: parsed.text });
    state.mood = parsed.mood; state.presence = 'present'; state.turns = data.meta?.turns || state.turns + 1; applyMemory(data.memory); maybeSpeak(parsed.text); updateBrainModeUi(data.meta || null);
  } catch (error) {
    const prefix = state.memory.brainMode === 'shadow'
      ? 'Shadow brain did not return a reply.'
      : 'Local LLM did not return a reply.';
    state.messages.push({ role: 'assistant', content: `${prefix} ${error?.message || 'Try again in a moment.'}` });
    state.mood = 'thinking'; state.presence = 'error';
  } finally {
    state.loading = false; renderMessages(); renderMemory(); updateTheme(); saveState(); els.composer.focus();
    loadBackendStatus();
    if (state.messages.length >= 2) setTimeout(() => consolidateMemory(), 120);
  }
}

for (const tab of els.tabs) tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
els.send.addEventListener('click', sendMessage);

const EMOJI_SET = [
  '😊','😂','🥺','😍','🥰','😘','😏','🤭','😳','🫠',
  '🔥','💀','✨','💖','❤️','💕','🫶','👀','🙄','😤',
  '🤔','😴','🥲','😈','👑','🎮','🎵','💫','⚡','🌸',
  '👍','👎','✌️','🤝','💪','🫡','🙈','🐱','🦊','🍑',
];
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
if (emojiGrid) {
  emojiGrid.innerHTML = EMOJI_SET.map(e => `<button type="button" class="emoji-item">${e}</button>`).join('');
  emojiGrid.addEventListener('click', (event) => {
    const item = event.target.closest('.emoji-item');
    if (!item) return;
    const pos = els.composer.selectionStart ?? els.composer.value.length;
    const val = els.composer.value;
    els.composer.value = val.slice(0, pos) + item.textContent + val.slice(pos);
    els.composer.focus();
    els.composer.selectionStart = els.composer.selectionEnd = pos + item.textContent.length;
    emojiPicker.hidden = true;
  });
}
emojiBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  emojiPicker.hidden = !emojiPicker.hidden;
});
document.addEventListener('click', () => { if (emojiPicker) emojiPicker.hidden = true; });
emojiPicker?.addEventListener('click', (event) => event.stopPropagation());
els.composer.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
els.nameInput.addEventListener('change', async () => { state.memory.userName = els.nameInput.value.trim(); saveState(); renderMemory(); await syncMemoryToDisk(); });
els.voiceToggle.addEventListener('change', async () => { state.memory.voiceOn = els.voiceToggle.checked; saveState(); await syncMemoryToDisk(); });
els.brainModeShadow?.addEventListener('change', async () => {
  if (!els.brainModeShadow.checked) return;
  state.memory.brainMode = 'shadow';
  saveState();
  renderMemory();
  await syncMemoryToDisk();
});
els.brainModeLocal?.addEventListener('change', async () => {
  if (!els.brainModeLocal.checked) return;
  state.memory.brainMode = 'local';
  saveState();
  renderMemory();
  await syncMemoryToDisk();
});
els.refreshMemory.addEventListener('click', loadDurableMemory);
els.clearAllMemories?.addEventListener('click', async () => { await patchMemory({ memories: [] }); });
els.memoryList?.addEventListener('click', async (event) => {
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'memory') return;
  const index = Number(button.dataset.index); const memories = [...(state.memory.memories || [])]; memories.splice(index, 1); await patchMemory({ memories });
});
els.newChat?.addEventListener('click', async () => {
  const freshSessionId = `penny-local-${Math.random().toString(36).slice(2, 10)}`;
  state.memory = { ...state.memory, sessionId: freshSessionId };
  state.messages = [];
  state.turns = 0;
  state.mood = 'calm';
  state.presence = 'idle';
  renderMessages();
  renderMemory();
  updateTheme();
  saveState();
  await syncMemoryToDisk();
});
els.clearMemory?.addEventListener('click', async () => {
  localStorage.removeItem(STORAGE_KEY);
  const freshSessionId = `penny-local-${Math.random().toString(36).slice(2, 10)}`;
  state.memory = { ...structuredClone(DEFAULT_MEMORY), sessionId: freshSessionId };
  state.messages = []; state.turns = 0; state.mood = 'calm'; state.presence = 'idle';
  renderMessages(); renderMemory(); updateTheme(); saveState(); await syncMemoryToDisk();
});

loadState();
applyDebugSpriteOverrides();
renderMessages();
renderMemory();
updateTheme();
updateBrainModeUi();
loadDurableMemory();
loadBackendStatus();
loadAvailableModels();

const _debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
if (!_debugMode) {
  const memTab = document.querySelector('.tab[data-panel="memory"]');
  if (memTab) memTab.style.display = 'none';
}

window.__pennyDebug = (mood) => {
  if (mood && MOODS[mood]) state.mood = mood;
  _lastSpriteKey = '';
  updateTheme();
};
