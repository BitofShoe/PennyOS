import {
  fillModelSelectOptions as fillModelSelectOptionsUi,
  mergeDistinctModelIds as mergeDistinctModelIdsUi,
  findBestModelMatch as findBestModelMatchUi,
  updateBackendStatusUi as updateBackendStatusUiHelper,
  updateModelSetupUi as updateModelSetupUiHelper,
  formatLastLane,
} from './penny-lmstudio-ui.js';
import {
  createAttachmentUi,
  formatBytes,
  prepareFileAttachment,
  prepareImageAttachment,
} from './penny-attachments.js';
import {
  DEFAULT_MEMORY,
  STORAGE_KEY,
  buildChatMemoryPayload,
  createSessionId,
  loadStateSnapshot,
  saveStateSnapshot,
} from './penny-storage.js';
import {
  createChatRequestGuard,
  isAbortError,
} from './penny-chat-request-guard.mjs';
import {
  MOOD_THEMES as MOODS,
  CHAT_DECOR_CHIBI as CHAT_DECOR_CHIBI_RUNTIME,
  CHAT_DECOR_TECH as CHAT_DECOR_TECH_RUNTIME,
  DEFAULT_EXPRESSION_PACK_URL as DEFAULT_EXPRESSION_PACK_URL_RUNTIME,
  createDefaultExpressionPack as createDefaultExpressionPackRuntime,
  createExpressionPackRuntime,
  createIdleDecorRuntime,
  parseMood as parseMoodRuntime,
  normalizeMoodTag as normalizeMoodTagRuntime,
  buildExpressionDecisionRecord,
  stripDraftMood as stripDraftMoodRuntime,
  escapeHtml as escapeHtmlRuntime,
  getMoodAvatarSrc as getMoodAvatarSrcRuntime,
  getMoodSpriteVariant as getMoodSpriteVariantRuntime,
  getMoodSpriteVariants as getMoodSpriteVariantsRuntime,
  getMoodPresentationProfile as getMoodPresentationProfileRuntime,
  chatDecorSrcs as chatDecorSrcsRuntime,
  buildCompanionFaceHtml as buildCompanionFaceHtmlRuntime,
  applyMoodCssVariables,
} from './penny-expression-runtime.mjs';
import {
  renderTranscriptMessages as renderTranscriptMessagesUi,
  updateStreamingAssistantBubble as updateStreamingAssistantBubbleUi,
  readPennyEventStream as readPennyEventStreamUi,
} from './penny-transcript-ui.mjs';
import {
  createAmbientChromeRuntime,
} from './penny-ambient-chrome.mjs';
import {
  ensureMemoryInspectorUi as ensureMemoryInspectorUiModule,
  renderMemoryList as renderMemoryListModule,
  renderMemoryInspector as renderMemoryInspectorUi,
  buildBrainModeNote,
} from './penny-memory-panel.mjs';

const state = {
  panel: 'chat',
  messages: [],
  mood: 'calm',
  lastAutoMood: 'calm',
  expressionOverrideMood: '',
  expressionDecision: null,
  presence: 'idle',
  loading: false,
  consolidating: false,
  syncingMemory: false,
  turns: 0,
  backendStatus: null,
  memory: structuredClone(DEFAULT_MEMORY),
  memoryInspector: null,
};

const API_TOKEN_STORAGE_KEY = 'penny:api-token';

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
  mobileCoreFace: document.getElementById('mobileCoreFace'),
  shell: document.getElementById('shell'),
  chatWrap: document.getElementById('chatWrap'),
  cyberDecor: document.querySelector('.cyber-decor'),
  intro: document.getElementById('intro'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  views: Array.from(document.querySelectorAll('.view')),
  memoryList: document.getElementById('memoryList'),
  nameInput: document.getElementById('nameInput'),
  voiceToggle: document.getElementById('voiceToggle'),
  expressionOverrideSelect: document.getElementById('expressionOverrideSelect'),
  expressionDecisionNote: document.getElementById('expressionDecisionNote'),
  brainModeShadow: document.getElementById('brainModeShadow'),
  brainModeLocal: document.getElementById('brainModeLocal'),
  brainModeNote: document.getElementById('brainModeNote'),
  backendReachability: document.getElementById('backendReachability'),
  backendModel: document.getElementById('backendModel'),
  backendToolModel: document.getElementById('backendToolModel'),
  backendWebReading: document.getElementById('backendWebReading'),
  backendLastLane: document.getElementById('backendLastLane'),
  modelSetupPanel: document.getElementById('modelSetupPanel'),
  modelSetupStatus: document.getElementById('modelSetupStatus'),
  modelSetupHint: document.getElementById('modelSetupHint'),
  modelSetupEmbedding: document.getElementById('modelSetupEmbedding'),
  modelSetupFallback: document.getElementById('modelSetupFallback'),
  toolModelSelect: document.getElementById('toolModelSelect'),
  saveModelSetup: document.getElementById('saveModelSetup'),
  refreshModelSetup: document.getElementById('refreshModelSetup'),
  newChat: document.getElementById('newChat'),
  clearMemory: document.getElementById('clearMemory'),
  refreshMemory: document.getElementById('refreshMemory'),
  clearAllMemories: document.getElementById('clearAllMemories'),
  modelSelect: document.getElementById('modelSelect'),
  apiTokenInput: document.getElementById('apiTokenInput'),
  saveApiToken: document.getElementById('saveApiToken'),
  clearApiToken: document.getElementById('clearApiToken'),
  apiTokenStatus: document.getElementById('apiTokenStatus'),
  imageInput: document.getElementById('imageInput'),
  imageBtn: document.getElementById('imageBtn'),
  imagePreview: document.getElementById('imagePreview'),
  imagePreviewImg: document.getElementById('imagePreviewImg'),
  imagePreviewRemove: document.getElementById('imagePreviewRemove'),
  fileInput: document.getElementById('fileInput'),
  fileBtn: document.getElementById('fileBtn'),
  filePreview: document.getElementById('filePreview'),
  filePreviewName: document.getElementById('filePreviewName'),
  filePreviewMeta: document.getElementById('filePreviewMeta'),
  filePreviewRemove: document.getElementById('filePreviewRemove'),
  composerNotice: document.getElementById('composerNotice'),
};

function ensureMemoryInspectorUi() {
  return ensureMemoryInspectorUiModule(els);
}
function setComposerNotice(text = '', tone = 'muted') {
  if (!els.composerNotice) return;
  els.composerNotice.textContent = text;
  els.composerNotice.dataset.tone = tone;
  els.composerNotice.hidden = !text;
}

function getApiAccessToken() {
  try {
    return String(localStorage.getItem(API_TOKEN_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function setApiAccessToken(token = '') {
  try {
    const value = String(token || '').trim();
    if (value) localStorage.setItem(API_TOKEN_STORAGE_KEY, value);
    else localStorage.removeItem(API_TOKEN_STORAGE_KEY);
  } catch {}
}

function apiHeaders(headers = {}) {
  const merged = { ...headers };
  const token = getApiAccessToken();
  if (token) merged['X-Penny-Access-Token'] = token;
  return merged;
}

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: apiHeaders(options.headers || {}),
  });
}

function renderApiTokenControls() {
  const token = getApiAccessToken();
  if (els.apiTokenInput && els.apiTokenInput.value !== token) els.apiTokenInput.value = token;
  if (els.apiTokenStatus) {
    els.apiTokenStatus.textContent = token
      ? 'Access token saved for this browser.'
      : 'Local browsers receive a loopback session cookie automatically.';
  }
}
const attachmentUi = createAttachmentUi({ els, setComposerNotice });
const chatRequestGuard = createChatRequestGuard();

function removeTrailingStreamingAssistantDraft() {
  const last = state.messages[state.messages.length - 1];
  if (last?.role === 'assistant' && last?.streaming) {
    state.messages.pop();
  }
}

function cancelActiveChatRequest({ removeStreamingDraft = false, clearLoading = true } = {}) {
  const canceledRequestId = chatRequestGuard.cancel();
  if (removeStreamingDraft) removeTrailingStreamingAssistantDraft();
  if (clearLoading) state.loading = false;
  return canceledRequestId !== null;
}

function parseMood(text, fallbackMood = '') {
  return parseMoodRuntime(text, fallbackMood);
}

function normalizeMoodTag(value = '') {
  return normalizeMoodTagRuntime(value, MOODS);
}

function stripDraftMood(text) {
  return stripDraftMoodRuntime(text);
}

function escapeHtml(text) {
  return escapeHtmlRuntime(text);
}

function inferExpressionSource(rawText = '', metaMood = '') {
  if (normalizeMoodTag(metaMood)) return 'artifact-meta';
  return /\[MOOD:(\w+)\]/i.test(String(rawText || '')) ? 'reply-tag' : 'state-fallback';
}

function renderExpressionDecisionUi() {
  if (els.expressionOverrideSelect) {
    els.expressionOverrideSelect.value = normalizeMoodTag(state.expressionOverrideMood) || '';
  }
  if (!els.expressionDecisionNote) return;
  const decision = state.expressionDecision && typeof state.expressionDecision === 'object'
    ? state.expressionDecision
    : buildExpressionDecisionRecord({
        mood: state.mood,
        decisionSource: 'state-fallback',
        decisionReason: 'No expression decision has been recorded yet.',
        manualOverride: normalizeMoodTag(state.expressionOverrideMood),
        persistedMood: state.mood,
      });
  const sourceLabelMap = {
    'artifact-meta': 'artifact meta',
    'reply-tag': 'reply mood tag',
    'state-fallback': 'state fallback',
    'manual-override': 'manual lock',
    'manual-clear': 'manual clear',
    'error-fallback': 'error fallback',
    'session-reset': 'session reset',
    'restored-state': 'restored state',
  };
  const sourceLabel = sourceLabelMap[decision.decisionSource] || decision.decisionSource || 'state fallback';
  const autoMood = normalizeMoodTag(state.lastAutoMood) || 'calm';
  const overrideText = decision.manualOverride
    ? ` Locked to ${decision.manualOverride}; auto mood was ${autoMood}.`
    : '';
  els.expressionDecisionNote.textContent = `Current expression: ${decision.mood} via ${sourceLabel}. ${decision.decisionReason}${overrideText}`.trim();
}

function applyExpressionDecision({
  autoMood = '',
  decisionSource = 'state-fallback',
  decisionReason = '',
} = {}) {
  const normalizedAutoMood = normalizeMoodTag(autoMood) || 'calm';
  const manualOverride = normalizeMoodTag(state.expressionOverrideMood);
  const finalMood = manualOverride || normalizedAutoMood;
  const finalSource = manualOverride ? 'manual-override' : decisionSource;
  const finalReason = manualOverride
    ? `Manual override pinned Penny to ${manualOverride}.`
    : (decisionReason || `Auto mood resolved to ${normalizedAutoMood}.`);
  state.lastAutoMood = normalizedAutoMood;
  state.mood = finalMood;
  state.expressionDecision = buildExpressionDecisionRecord({
    mood: finalMood,
    decisionSource: finalSource,
    decisionReason: finalReason,
    manualOverride,
    persistedMood: finalMood,
  });
  renderExpressionDecisionUi();
}

let activeExpressionPack = createDefaultExpressionPackRuntime();
const expressionPackRuntime = createExpressionPackRuntime({
  fetchImpl: (...args) => fetch(...args),
  manifestUrl: DEFAULT_EXPRESSION_PACK_URL_RUNTIME,
  defaultPack: activeExpressionPack,
});
const idleDecorRuntime = createIdleDecorRuntime({
  windowRef: window,
  container: els.cyberDecor,
  chatWrap: els.chatWrap,
});

async function loadExpressionPackManifest() {
  activeExpressionPack = await expressionPackRuntime.load();
  return activeExpressionPack;
}

function appendMessageDecor(item, index, role) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-decor';
  wrap.setAttribute('aria-hidden', 'true');
  for (const src of chatDecorSrcsRuntime(index, role, CHAT_DECOR_CHIBI_RUNTIME, CHAT_DECOR_TECH_RUNTIME)) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'msg-decor-img';
    img.draggable = false;
    wrap.appendChild(img);
  }
  item.appendChild(wrap);
}

function syncIdleDecorBounds() {
  return idleDecorRuntime.syncBounds();
}

function startIdleDecorScreensaver() {
  idleDecorRuntime.start();
}

window.addEventListener('resize', () => {
  idleDecorRuntime.handleResize();
});

function getCurrentMoodPresentationProfile(mood) {
  const variantCount = getMoodSpriteVariantsRuntime(activeExpressionPack, mood).length;
  return getMoodPresentationProfileRuntime({
    mood,
    intensity: getIntensity(),
    previousMood: _lastRenderedMood,
    variantCount,
    cycleSeed: state.turns,
  });
}

function companionFaceHtml(mood, profile = null) {
  const presentationProfile = profile || getCurrentMoodPresentationProfile(mood);
  return buildCompanionFaceHtmlRuntime({
    pack: activeExpressionPack,
    mood,
    variantIndex: presentationProfile.variantIndex,
    presentationProfile,
    escapeHtmlFn: escapeHtml,
  });
}

const ambientChrome = createAmbientChromeRuntime({
  windowRef: window,
  documentRef: document,
  composerEl: els.composer,
  emojiBtnEl: document.getElementById('emojiBtn'),
  emojiPickerEl: document.getElementById('emojiPicker'),
  emojiGridEl: document.getElementById('emojiGrid'),
  bootOverlayEl: document.getElementById('bootOverlay'),
  coreEl: document.querySelector('.core'),
  particleCanvasEl: document.getElementById('particleCanvas'),
  randomFn: () => Math.random(),
  scaleFn: () => (INTENSITY_SCALES[getIntensity()] || 1) * (_lastPresentationProfile?.scaleBoost || 1),
  moodPaletteFn: () => MOODS[state.mood] || MOODS.calm,
});

function updateBrainModeUi(meta = null) {
  const mode = state.memory.brainMode === 'local' ? 'local' : 'shadow';
  if (els.brainModeShadow) els.brainModeShadow.checked = mode === 'shadow';
  if (els.brainModeLocal) els.brainModeLocal.checked = mode === 'local';
  if (els.backendLastLane) els.backendLastLane.textContent = formatLastLane(meta);
  if (!els.brainModeNote) return;
  els.brainModeNote.textContent = buildBrainModeNote({ mode, meta });
}
let _lastSpriteKey = '';
let _spriteTimer = null;
let _lastRenderedMood = '';
let _lastPresentationProfile = null;

const INTENSITY_SCALES = [1, 1.3, 1.6];

function getIntensity() {
  return Math.min(2, Math.floor(state.turns / 4));
}

function applyIntensityClass() {
  const core = document.querySelector('.core');
  if (!core) return;
  const level = getIntensity();
  core.classList.remove('intensity-0', 'intensity-1', 'intensity-2');
  core.classList.add(`intensity-${level}`);
}

function triggerGlitch(profile = null) {
  const core = document.querySelector('.core');
  if (!core) return;
  core.classList.add('mood-glitch');
  if (ambientChrome.particleBurst) ambientChrome.particleBurst(profile?.burstCount || 20);
  setTimeout(() => core.classList.remove('mood-glitch'), Number(profile?.glitchMs || 320));
}

function renderSprite(mood, palette) {
  const containers = [els.coreFace, els.mobileCoreFace].filter(Boolean);
  if (!containers.length) return;
  const intensity = getIntensity();
  const profile = getCurrentMoodPresentationProfile(mood);
  const variant = getMoodSpriteVariantRuntime(activeExpressionPack, mood, profile.variantIndex);
  const spriteKey = `${mood}:${intensity}:${profile.variantIndex}:${profile.closeUp ? 'close' : 'wide'}:${variant?.src || 'default'}`;
  const hasMissingSprite = containers.some((container) => !container.querySelector('.penny-display'));
  if (spriteKey === _lastSpriteKey && !hasMissingSprite) return;

  const html = companionFaceHtml(mood, profile);
  const isFirstRender = hasMissingSprite;

  if (isFirstRender) {
    for (const container of containers) {
      container.innerHTML = html;
      container.style.transition = '';
      container.style.opacity = '1';
    }
    _lastSpriteKey = spriteKey;
    _lastRenderedMood = mood;
    _lastPresentationProfile = profile;
    applyIntensityClass();
    return;
  }

  triggerGlitch(profile);

  if (_spriteTimer) { clearTimeout(_spriteTimer); _spriteTimer = null; }

  for (const container of containers) {
    container.style.transition = `opacity ${Number(profile.fadeOutMs || 100)}ms ease-out`;
    container.style.opacity = '0.04';
  }

  _spriteTimer = setTimeout(() => {
    for (const container of containers) {
      container.innerHTML = html;
    }
    applyIntensityClass();
    for (const container of containers) {
      container.style.transition = `opacity ${Number(profile.fadeInMs || 180)}ms ease-in`;
      container.style.opacity = '1';
    }
    _lastPresentationProfile = profile;
    _spriteTimer = setTimeout(() => {
      for (const container of containers) {
        container.style.transition = '';
      }
      _spriteTimer = null;
    }, Number(profile.settleMs || 200));
    _lastSpriteKey = spriteKey;
    _lastRenderedMood = mood;
  }, Number(profile.swapDelayMs || 110));
}

function updateTheme() {
  const palette = applyMoodCssVariables(document.documentElement, state.mood, MOODS);
  els.moodPill.textContent = state.loading ? 'thinking' : palette.label;
  els.presenceValue.textContent = state.presence;
  els.turnsValue.textContent = String(state.turns);
  const statusText = state.loading ? 'processing' : state.consolidating ? 'saving memory' : state.syncingMemory ? 'syncing memory' : 'live';
  els.statusValue.textContent = statusText;
  els.statusValueTop.textContent = statusText;
  renderSprite(state.mood, palette);
  els.shell.dataset.mood = state.mood;
  els.shell.dataset.expressionPack = activeExpressionPack.id || 'default';
  renderExpressionDecisionUi();
}

function updateBackendStatusUi(status = null) {
  updateBackendStatusUiHelper({ els, state, status });
}

function updateModelSetupUi(status = null) {
  return updateModelSetupUiHelper({ els, status });
}

function pennyAvatarSrc(mood = state.mood) {
  return getMoodAvatarSrcRuntime(activeExpressionPack, mood);
}

function renderMessages() {
  renderTranscriptMessagesUi({
    chatEl: els.chat,
    introEl: els.intro,
    cyberDecorEl: els.cyberDecor,
    chatWrapEl: els.chatWrap || els.chat?.parentElement,
    messages: state.messages,
    loading: state.loading,
    stateMood: state.mood,
    avatarSrcForMood: pennyAvatarSrc,
    appendMessageDecor,
    formatBytesFn: formatBytes,
    escapeHtmlFn: escapeHtml,
  });
  syncIdleDecorBounds();
}

function updateStreamingAssistantBubble(text = '') {
  updateStreamingAssistantBubbleUi({
    chatEl: els.chat,
    text,
    chatWrapEl: els.chatWrap || els.chat?.parentElement,
    stripDraftMoodFn: stripDraftMood,
    escapeHtmlFn: escapeHtml,
  });
  syncIdleDecorBounds();
}

async function readPennyEventStream(response, handlers = {}) {
  return readPennyEventStreamUi(response, handlers);
}

function renderMemory() {
  ensureMemoryInspectorUi();
  renderMemoryListModule({ els, memory: state.memory, escapeHtmlFn: escapeHtml });
  renderMemoryInspector();
  updateBrainModeUi();
}

function renderMemoryInspector() {
  renderMemoryInspectorUi({ els, inspector: state.memoryInspector, escapeHtmlFn: escapeHtml });
}

function saveState() {
  saveStateSnapshot(state);
}

function loadState() {
  const snapshot = loadStateSnapshot();
  if (!snapshot) return;
  state.memory = snapshot.memory;
  state.messages = snapshot.messages;
  state.lastAutoMood = normalizeMoodTag(snapshot.lastAutoMood) || normalizeMoodTag(snapshot.mood) || 'calm';
  state.expressionOverrideMood = normalizeMoodTag(snapshot.expressionOverrideMood) || '';
  state.mood = state.expressionOverrideMood || normalizeMoodTag(snapshot.mood) || 'calm';
  state.expressionDecision = snapshot.expressionDecision && typeof snapshot.expressionDecision === 'object'
    ? buildExpressionDecisionRecord(snapshot.expressionDecision)
    : buildExpressionDecisionRecord({
        mood: state.mood,
        decisionSource: state.expressionOverrideMood ? 'manual-override' : 'restored-state',
        decisionReason: state.expressionOverrideMood
          ? `Restored manual override ${state.expressionOverrideMood} from local state.`
          : `Restored ${state.mood} from local state.`,
        manualOverride: state.expressionOverrideMood,
        persistedMood: state.mood,
      });
  state.turns = Number(snapshot.turns || state.messages.filter(m => m.role === 'assistant').length || 0);
  state.presence = state.messages.length ? 'present' : 'idle';
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
  if (panel === 'memory') {
    loadMemoryInspector({ quiet: true });
  }
  if (panel === 'settings') {
    loadBackendStatus();
  }
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
  if (state.memory.brainMode !== 'local' && state.memory.brainMode !== 'shadow') state.memory.brainMode = 'local';
}
function reportMemoryIssue(action, error) {
  const detail = error?.message || String(error || 'unknown memory error');
  console.warn(`[penny memory] ${action}: ${detail}`);
}

async function memoryRequest(method, body, query = '') {
  const res = await apiFetch(`/api/penny/memory${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Memory request failed: ${res.status}`);
  return res.json();
}

async function memoryInspectorRequest(pathname, method = 'GET', body = null) {
  const res = await apiFetch(pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Memory inspector request failed: ${res.status}`);
  return res.json();
}

async function loadMemoryInspector(options = {}) {
  ensureMemoryInspectorUi();
  try {
    const data = await memoryInspectorRequest(`/api/penny/memory/inspector?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
    state.memoryInspector = data.inspector || null;
    renderMemoryInspector();
  } catch (error) {
    if (!options.quiet) reportMemoryIssue('inspector load failed', error);
  }
}

async function reviewMemoryPromotion(queueId, action) {
  const data = await memoryInspectorRequest('/api/penny/memory/review', 'POST', {
    sessionId: state.memory.sessionId,
    queueId,
    action,
  });
  applyMemory(data.memory);
  state.memoryInspector = data.inspector || state.memoryInspector;
  renderMemory();
  saveState();
}

async function purgeMemoryScopes(payload = {}) {
  const data = await memoryInspectorRequest('/api/penny/memory/purge', 'POST', {
    sessionId: state.memory.sessionId,
    ...payload,
  });
  applyMemory(data.memory);
  state.memoryInspector = data.inspector || state.memoryInspector;
  renderMemory();
  saveState();
}

async function syncMemoryToDisk() {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('POST', { sessionId: state.memory.sessionId, memory: buildChatMemoryPayload(state.memory) });
    applyMemory(data.memory); renderMemory(); saveState();
    await loadMemoryInspector({ quiet: true });
  } catch (error) {
    reportMemoryIssue('sync failed', error);
  } finally { state.syncingMemory = false; updateTheme(); }
}

async function loadDurableMemory() {
  state.syncingMemory = true; updateTheme();
  try {
    const res = await apiFetch(`/api/penny/memory?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
    await loadMemoryInspector({ quiet: true });
  } catch (error) {
    reportMemoryIssue('load failed', error);
  } finally { state.syncingMemory = false; updateTheme(); }
}

async function patchMemory(patch) {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('PATCH', { sessionId: state.memory.sessionId, patch });
    applyMemory(data.memory); renderMemory(); saveState();
    await loadMemoryInspector({ quiet: true });
  } catch (error) {
    reportMemoryIssue('patch failed', error);
  } finally { state.syncingMemory = false; updateTheme(); }
}

async function loadBackendStatus() {
  try {
    const res = await apiFetch('/api/penny/status');
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    const data = await res.json();
    updateBackendStatusUi(data);
    await loadAvailableModels(data);
    if (!data.shadowEnabled && state.memory.brainMode === 'shadow') {
      state.memory.brainMode = 'local';
      renderMemory();
      saveState();
      if (!state.syncingMemory) {
        await syncMemoryToDisk();
      }
    }
  } catch {
    const offlineStatus = { reachable: false, error: 'Unable to reach Penny status route.' };
    updateBackendStatusUi(offlineStatus);
    updateModelSetupUi({ lmStudio: offlineStatus });
  }
}

async function loadAvailableModels(preloadedStatus = null) {
  if (!els.modelSelect) return;
  try {
    const data = preloadedStatus || await (async () => {
      const res = await apiFetch('/api/penny/lmstudio/status');
      if (!res.ok) return null;
      return res.json();
    })();
    if (!data) return;
    const lmData = data.lmStudio || data;
    const isEmbed = (id) => /\b(embed|embedding|rerank)\b/i.test(id);
    const available = (lmData.availableModels || []).filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id));
    const installed = (lmData.installedModels || []).filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id));
    const candidates = Array.isArray(lmData.candidateModels)
      ? lmData.candidateModels.filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id))
      : [];
    const configured = lmData.chatPreferredModel && !isEmbed(lmData.chatPreferredModel)
      ? [String(lmData.chatPreferredModel).trim()]
      : [];
    const toolConfigured = lmData.toolPreferredModel && !isEmbed(lmData.toolPreferredModel)
      ? [String(lmData.toolPreferredModel).trim()]
      : [];
    const models = mergeDistinctModelIdsUi(available, installed, candidates, configured);
    if (!models.length) {
      els.modelSelect.innerHTML = '<option value="">no models loaded</option>';
    } else {
      const resolved = lmData.resolvedChatModel || lmData.resolvedModel || '';
      const runtime = lmData.runtimePreferredChatModel || lmData.runtimePreferredModel || lmData.chatPreferredModel || '';
      const selected = findBestModelMatchUi(models, runtime, resolved, lmData.configuredChatModel, lmData.configuredModel)
        || models[0];
      fillModelSelectOptionsUi(els.modelSelect, models, selected);
    }
    if (els.toolModelSelect) {
      const toolCandidates = Array.isArray(lmData.toolCandidateModels)
        ? lmData.toolCandidateModels.filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id))
        : [];
      const toolModels = mergeDistinctModelIdsUi(available, installed, toolCandidates, toolConfigured);
      if (!toolModels.length) {
        els.toolModelSelect.innerHTML = '<option value="">no models loaded</option>';
      } else {
        const selectedTool = findBestModelMatchUi(
          toolModels,
          lmData.runtimePreferredToolModel,
          lmData.resolvedToolModel,
          lmData.toolPreferredModel,
          lmData.configuredToolModel,
        ) || toolModels[0];
        fillModelSelectOptionsUi(els.toolModelSelect, toolModels, selectedTool);
      }
    }
    updateModelSetupUi(data.lmStudio ? data : { ...data, lmStudio: lmData });
  } catch {}
}

async function saveModelSetupFromControls() {
  const chatModel = els.modelSelect?.value || '';
  const toolModel = els.toolModelSelect?.value || '';
  const payload = {
    disableModelFallback: els.modelSetupFallback ? !els.modelSetupFallback.checked : false,
  };
  if (chatModel) payload.chatModel = chatModel;
  if (toolModel) payload.toolModel = toolModel;
  if (!payload.chatModel && !payload.toolModel && !Object.prototype.hasOwnProperty.call(payload, 'disableModelFallback')) return;
  try {
    const res = await apiFetch('/api/penny/lmstudio/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Model setup failed: ${res.status}`);
    if (data.resolvedChatModel && els.backendModel) els.backendModel.textContent = data.resolvedChatModel;
    if (data.resolvedToolModel && els.backendToolModel) els.backendToolModel.textContent = data.resolvedToolModel;
    if (els.backendLastLane) els.backendLastLane.textContent = 'pending';
    await loadBackendStatus();
  } catch (error) {
    console.warn(`[penny model setup] ${error?.message || error}`);
  }
}

els.modelSelect?.addEventListener('change', saveModelSetupFromControls);
els.toolModelSelect?.addEventListener('change', saveModelSetupFromControls);
els.modelSetupFallback?.addEventListener('change', saveModelSetupFromControls);
els.saveModelSetup?.addEventListener('click', saveModelSetupFromControls);
els.refreshModelSetup?.addEventListener('click', () => loadBackendStatus());

async function consolidateMemory() {
  if (state.consolidating) return;
  state.consolidating = true; updateTheme();
  try {
    const res = await apiFetch('/api/penny/consolidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: serializeMessagesForApi(8), memories: buildChatMemoryPayload(state.memory) }) });
    if (!res.ok) throw new Error('Consolidation failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
    await loadMemoryInspector({ quiet: true });
  } catch (error) {
    reportMemoryIssue('consolidation failed', error);
  } finally { state.consolidating = false; updateTheme(); }
}

function serializeMessagesForApi(limit = 16) {
  return state.messages
    .filter(msg => !msg.streaming)
    .slice(-limit)
    .map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content || ''),
    }));
}

async function sendMessage() {
  const userText = els.composer.value.trim();
  const pendingImage = attachmentUi.getPendingImage();
  const pendingFile = attachmentUi.getPendingFile();
  if (!userText) {
    if (pendingImage || pendingFile) setComposerNotice('Add a short prompt so Penny knows what to do with the attachment.', 'warn');
    return;
  }
  const { requestId, signal, replacedRequestId } = chatRequestGuard.start();
  if (replacedRequestId !== null) {
    removeTrailingStreamingAssistantDraft();
  }
  const imageData = pendingImage?.dataUrl || null;
  const fileData = pendingFile ? { ...pendingFile } : null;
  const msgObj = { role: 'user', content: userText };
  if (imageData) msgObj.image = imageData;
  if (fileData) msgObj.file = { name: fileData.name, size: fileData.size, lineCount: fileData.lineCount, type: fileData.type };
  state.messages.push(msgObj);
  const assistantDraft = { role: 'assistant', content: '', streaming: true, toolsUsed: [], mood: 'thinking' };
  state.messages.push(assistantDraft);
  els.composer.value = '';
  els.composer.dispatchEvent(new Event('input', { bubbles: true }));
  attachmentUi.clearPendingAttachments(); state.loading = true; state.presence = 'thinking'; renderMessages(); updateTheme(); saveState();
  try {
    const body = { sessionId: state.memory.sessionId, messages: serializeMessagesForApi(), memories: buildChatMemoryPayload(state.memory), stream: true };
    if (imageData) body.image = imageData;
    if (fileData) body.file = fileData;
    const res = await apiFetch('/api/penny/chat?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!chatRequestGuard.isActive(requestId)) return;
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
      if (!chatRequestGuard.isActive(requestId)) return;
      updateBrainModeUi(data.meta || { requestedMode: state.memory.brainMode, usedFallback: false, shadowError: data.detail || data.error || `Request failed: ${res.status}` });
      throw new Error(data.detail || data.error || `Request failed: ${res.status}`);
    }
    let streamedText = '';
    let finalData = null;
    await readPennyEventStream(res, {
      onEvent(event, data) {
        if (!chatRequestGuard.isActive(requestId)) return;
        if (event === 'status') {
          state.presence = data?.label || state.presence;
          updateTheme();
          return;
        }
        if (event === 'message.delta') {
          streamedText = typeof data?.text === 'string' && data.text ? data.text : `${streamedText}${data?.content || ''}`;
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant' && last?.streaming) last.content = stripDraftMood(streamedText);
          updateStreamingAssistantBubble(streamedText);
          return;
        }
        if (event === 'tool') {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant' && last?.streaming) {
            last.toolStatus = data?.label || `using ${data?.name || 'tool'}`;
          }
          state.presence = data?.state === 'running' ? 'tooling' : state.presence;
          renderMessages();
          updateTheme();
          return;
        }
        if (event === 'done') {
          finalData = data;
          return;
        }
        if (event === 'error') {
          throw new Error(data?.detail || data?.error || 'Streaming request failed.');
        }
      },
    });
    if (!chatRequestGuard.isActive(requestId)) return;
    if (!finalData) throw new Error('Stream ended without a final Penny payload.');
    const parsed = parseMood(finalData.text || streamedText || 'Something glitched.', finalData.meta?.mood || '');
    const last = state.messages[state.messages.length - 1];
    if (last?.role === 'assistant') {
      last.content = parsed.text;
      last.mood = parsed.mood;
      last.toolsUsed = Array.isArray(finalData.meta?.toolsUsed) ? finalData.meta.toolsUsed : [];
      delete last.toolStatus;
      delete last.streaming;
    } else {
      state.messages.push({ role: 'assistant', content: parsed.text, mood: parsed.mood, toolsUsed: Array.isArray(finalData.meta?.toolsUsed) ? finalData.meta.toolsUsed : [] });
    }
    applyExpressionDecision({
      autoMood: parsed.mood,
      decisionSource: inferExpressionSource(finalData.text || streamedText || '', finalData.meta?.mood || ''),
      decisionReason: `Reply mood resolved to ${parsed.mood} from Penny's latest response.`,
    });
    state.presence = 'present'; state.turns = finalData.meta?.turns || state.turns + 1; applyMemory(finalData.memory); maybeSpeak(parsed.text); updateBrainModeUi(finalData.meta || null);
    window.setTimeout(() => { loadMemoryInspector({ quiet: true }); }, 150);
  } catch (error) {
    if (!chatRequestGuard.isActive(requestId)) return;
    if (isAbortError(error)) {
      removeTrailingStreamingAssistantDraft();
      state.presence = state.messages.length ? 'present' : 'idle';
      return;
    }
    const prefix = state.memory.brainMode === 'shadow'
      ? 'Shadow brain did not return a reply.'
      : 'Local LLM did not return a reply.';
    const last = state.messages[state.messages.length - 1];
    if (last?.role === 'assistant' && last.streaming) {
      last.content = `${prefix} ${error?.message || 'Try again in a moment.'}`;
      delete last.toolStatus;
      delete last.streaming;
    } else {
      state.messages.push({ role: 'assistant', content: `${prefix} ${error?.message || 'Try again in a moment.'}` });
    }
    applyExpressionDecision({
      autoMood: 'thinking',
      decisionSource: 'error-fallback',
      decisionReason: 'The last request failed, so the shell fell back to the thinking state.',
    });
    state.presence = 'error';
  } finally {
    if (!chatRequestGuard.finish(requestId)) return;
    state.loading = false; renderMessages(); renderMemory(); updateTheme(); saveState(); els.composer.focus();
    loadBackendStatus();
  }
}

ensureMemoryInspectorUi();
for (const tab of els.tabs) tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
els.send.addEventListener('click', sendMessage);

if (els.imageBtn) els.imageBtn.addEventListener('click', () => els.imageInput?.click());
if (els.imageInput) els.imageInput.addEventListener('change', async () => {
  const file = els.imageInput.files?.[0];
  if (!file) return;
  try {
    const prepared = await prepareImageAttachment(file);
    attachmentUi.attachImage(prepared);
  } catch (error) {
    attachmentUi.clearPendingImage({ keepNotice: true });
    setComposerNotice(error?.message || 'Image prep failed. Try a smaller file.', 'error');
  }
});
if (els.imagePreviewRemove) els.imagePreviewRemove.addEventListener('click', () => attachmentUi.clearPendingImage());
if (els.fileBtn) els.fileBtn.addEventListener('click', () => els.fileInput?.click());
if (els.fileInput) els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  try {
    const prepared = await prepareFileAttachment(file);
    attachmentUi.attachFile(prepared);
  } catch (error) {
    attachmentUi.clearPendingFile({ keepNotice: true });
    setComposerNotice(error?.message || 'File prep failed. Try a smaller text/code file.', 'error');
  }
});
if (els.filePreviewRemove) els.filePreviewRemove.addEventListener('click', () => attachmentUi.clearPendingFile());
els.composer.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
els.nameInput.addEventListener('change', async () => { state.memory.userName = els.nameInput.value.trim(); saveState(); renderMemory(); await syncMemoryToDisk(); });
els.voiceToggle.addEventListener('change', async () => { state.memory.voiceOn = els.voiceToggle.checked; saveState(); await syncMemoryToDisk(); });
els.expressionOverrideSelect?.addEventListener('change', () => {
  state.expressionOverrideMood = normalizeMoodTag(els.expressionOverrideSelect.value) || '';
  const autoMood = normalizeMoodTag(state.lastAutoMood) || 'calm';
  applyExpressionDecision({
    autoMood,
    decisionSource: state.expressionOverrideMood ? 'manual-override' : 'manual-clear',
    decisionReason: state.expressionOverrideMood
      ? `Manual override changed to ${state.expressionOverrideMood}.`
      : 'Manual override cleared; Penny returned to the last auto mood.',
  });
  updateTheme();
  saveState();
});
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
els.saveApiToken?.addEventListener('click', () => {
  setApiAccessToken(els.apiTokenInput?.value || '');
  renderApiTokenControls();
  loadBackendStatus();
});
els.clearApiToken?.addEventListener('click', () => {
  setApiAccessToken('');
  renderApiTokenControls();
  loadBackendStatus();
});
els.refreshMemory.addEventListener('click', loadDurableMemory);
els.clearAllMemories?.addEventListener('click', async () => { await patchMemory({ memories: [] }); });
els.memoryInspectorToolbar?.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.id === 'refreshMemoryInspector') {
      await loadMemoryInspector();
      return;
    }
    if (button.id === 'purgeSessionArchive') {
      await purgeMemoryScopes({ clearSessionArchive: true });
      return;
    }
    if (button.id === 'purgeGlobalArchive') {
      await purgeMemoryScopes({ clearGlobalArchive: true });
      return;
    }
    if (button.id === 'purgeEmbeddings') {
      await purgeMemoryScopes({ clearEmbeddings: true });
    }
  } catch (error) {
    reportMemoryIssue('inspector purge failed', error);
  }
});
els.memoryInspectorPanel?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-review-action]');
  if (!button) return;
  try {
    await reviewMemoryPromotion(button.dataset.reviewId, button.dataset.reviewAction);
  } catch (error) {
    reportMemoryIssue('memory review failed', error);
  }
});
els.memoryList?.addEventListener('click', async (event) => {
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'memory') return;
  const index = Number(button.dataset.index); const memories = [...(state.memory.memories || [])]; memories.splice(index, 1); await patchMemory({ memories });
});
els.newChat?.addEventListener('click', async () => {
  cancelActiveChatRequest();
  const freshSessionId = createSessionId();
  state.memory = { ...state.memory, sessionId: freshSessionId };
  state.messages = [];
  state.turns = 0;
  applyExpressionDecision({
    autoMood: 'calm',
    decisionSource: 'session-reset',
    decisionReason: 'New chat reset the auto mood to calm.',
  });
  state.presence = 'idle';
  renderMessages();
  renderMemory();
  updateTheme();
  saveState();
  await syncMemoryToDisk();
});
els.clearMemory?.addEventListener('click', async () => {
  cancelActiveChatRequest();
  localStorage.removeItem(STORAGE_KEY);
  const freshSessionId = createSessionId();
  state.memory = { ...structuredClone(DEFAULT_MEMORY), sessionId: freshSessionId };
  state.messages = [];
  state.turns = 0;
  state.expressionOverrideMood = '';
  applyExpressionDecision({
    autoMood: 'calm',
    decisionSource: 'session-reset',
    decisionReason: 'Clearing local state reset the expression shell to calm.',
  });
  state.presence = 'idle';
  renderMessages(); renderMemory(); updateTheme(); saveState(); await syncMemoryToDisk();
});

loadState();
applyDebugSpriteOverrides();
renderMessages();
startIdleDecorScreensaver();
renderMemory();
updateTheme();
updateBrainModeUi();
renderApiTokenControls();
loadDurableMemory();
loadBackendStatus();
  loadExpressionPackManifest().then(() => {
    _lastSpriteKey = '';
    _lastRenderedMood = '';
    _lastPresentationProfile = null;
    if (!state.loading) renderMessages();
    updateTheme();
  }).catch(() => {});

const _debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
if (!_debugMode) {
  const memTab = document.querySelector('.tab[data-panel="memory"]');
  if (memTab) memTab.style.display = 'none';
}

window.__pennyDebug = (mood, turns) => {
    if (mood && MOODS[mood]) state.mood = mood;
    if (turns !== undefined) state.turns = Number(turns) || 0;
    _lastSpriteKey = '';
    _lastRenderedMood = '';
    _lastPresentationProfile = null;
    updateTheme();
  };
