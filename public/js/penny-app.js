import {
  fillModelSelectOptions as fillModelSelectOptionsUi,
  updateBackendStatusUi as updateBackendStatusUiHelper,
  updateModelSetupUi as updateModelSetupUiHelper,
  formatLastLane,
  summarizeShellModelConnection,
} from './penny-lmstudio-ui.js';
import {
  createAttachmentUi,
  formatBytes,
  prepareFileAttachment,
  prepareFolderAttachment,
  prepareImageAttachments,
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
  readPublicProviderFailure,
} from './penny-public-errors.mjs';
import {
  createClientStreamReducer,
} from './penny-stream-state.mjs';
import {
  MOOD_THEMES as MOODS,
  CHAT_DECOR_CHIBI as CHAT_DECOR_CHIBI_RUNTIME,
  CHAT_DECOR_TECH as CHAT_DECOR_TECH_RUNTIME,
  DEFAULT_EXPRESSION_PACK_URL as DEFAULT_EXPRESSION_PACK_URL_RUNTIME,
  createDefaultExpressionPack as createDefaultExpressionPackRuntime,
  createExpressionPackRuntime,
  parseMood as parseMoodRuntime,
  normalizeMoodTag as normalizeMoodTagRuntime,
  buildExpressionDecisionRecord,
  stripDraftMood as stripDraftMoodRuntime,
  escapeHtml as escapeHtmlRuntime,
  getMoodAvatarDescriptor as getMoodAvatarDescriptorRuntime,
  getMoodSpriteVariant as getMoodSpriteVariantRuntime,
  getMoodSpriteVariants as getMoodSpriteVariantsRuntime,
  getMoodPresentationProfile as getMoodPresentationProfileRuntime,
  chatDecorSrcs as chatDecorSrcsRuntime,
  buildCompanionFaceHtml as buildCompanionFaceHtmlRuntime,
  bindExpressionImageFallback,
  waitForExpressionImages,
  applyMoodCssVariables,
  syncIdleDecorBounds as syncIdleDecorBoundsRuntime,
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
  createRuntimeVoiceController,
} from './penny-runtime-voice.mjs';
import {
  ensureMemoryInspectorUi as ensureMemoryInspectorUiModule,
  renderMemoryList as renderMemoryListModule,
  renderMemoryInspector as renderMemoryInspectorUi,
  buildBrainModeNote,
} from './penny-memory-panel.mjs';
import {
  renderWorkspaceWritesPanel,
  buildWorkspaceWritesBadgeState,
} from './penny-workspace-writes-panel.mjs';

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
  workspaceWrites: null,
};

const API_TOKEN_STORAGE_KEY = 'penny:api-token';
let nextMessageOrdinal = 0;

function createMessageId(role = 'message') {
  nextMessageOrdinal += 1;
  return `${role}-${Date.now().toString(36)}-${nextMessageOrdinal.toString(36)}`;
}

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
  memoryTab: document.querySelector('.tab[data-panel="memory"]'),
  workspaceWritesBadge: document.getElementById('workspaceWritesBadge'),
  views: Array.from(document.querySelectorAll('.view')),
  memoryList: document.getElementById('memoryList'),
  workspaceWritesPanel: document.getElementById('workspaceWritesPanel'),
  nameInput: document.getElementById('nameInput'),
  voiceToggle: document.getElementById('voiceToggle'),
  voiceStatus: document.getElementById('voiceStatus'),
  voiceSetupNote: document.getElementById('voiceSetupNote'),
  voiceBaseUrl: document.getElementById('voiceBaseUrl'),
  voiceModel: document.getElementById('voiceModel'),
  voiceName: document.getElementById('voiceName'),
  voiceOptions: document.getElementById('voiceOptions'),
  voiceGain: document.getElementById('voiceGain'),
  voiceSpeed: document.getElementById('voiceSpeed'),
  saveVoiceSetup: document.getElementById('saveVoiceSetup'),
  refreshVoiceStatus: document.getElementById('refreshVoiceStatus'),
  voiceTest: document.getElementById('voiceTest'),
  voiceStop: document.getElementById('voiceStop'),
  voiceReplay: document.getElementById('voiceReplay'),
  expressionOverrideSelect: document.getElementById('expressionOverrideSelect'),
  expressionDecisionNote: document.getElementById('expressionDecisionNote'),
  brainModeShadowRow: document.getElementById('brainModeShadowRow'),
  brainModeShadow: document.getElementById('brainModeShadow'),
  brainModeLocal: document.getElementById('brainModeLocal'),
  brainModeNote: document.getElementById('brainModeNote'),
  firstRunSetupPanel: document.getElementById('firstRunSetupPanel'),
  firstRunSetupSection: document.getElementById('firstRunSetupSection'),
  firstRunUseLocal: document.getElementById('firstRunUseLocal'),
  firstRunUseOpenAi: document.getElementById('firstRunUseOpenAi'),
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
  localModelSetupSection: document.getElementById('localModelSetupSection'),
  toolModelSelect: document.getElementById('toolModelSelect'),
  embedModelSelect: document.getElementById('embedModelSelect'),
  saveModelSetup: document.getElementById('saveModelSetup'),
  refreshModelSetup: document.getElementById('refreshModelSetup'),
  providerSetupPanel: document.getElementById('providerSetupPanel'),
  providerStatus: document.getElementById('providerStatus'),
  providerRefresh: document.getElementById('providerRefresh'),
  providerUseLocal: document.getElementById('providerUseLocal'),
  providerShowOpenAi: document.getElementById('providerShowOpenAi'),
  openAiCloudPanel: document.getElementById('openAiCloudPanel'),
  openAiApiKey: document.getElementById('openAiApiKey'),
  openAiChatModel: document.getElementById('openAiChatModel'),
  openAiToolModel: document.getElementById('openAiToolModel'),
  openAiEmbedModel: document.getElementById('openAiEmbedModel'),
  openAiCloudDisclosure: document.getElementById('openAiCloudDisclosure'),
  connectOpenAiProvider: document.getElementById('connectOpenAiProvider'),
  resetLocalProvider: document.getElementById('resetLocalProvider'),
  providerSetupNote: document.getElementById('providerSetupNote'),
  webSettingsPanel: document.getElementById('webSettingsPanel'),
  webSearchToggle: document.getElementById('webSearchToggle'),
  webAnswerMode: document.getElementById('webAnswerMode'),
  saveWebSettings: document.getElementById('saveWebSettings'),
  webSettingsNote: document.getElementById('webSettingsNote'),
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
  imagePreviewList: document.getElementById('imagePreviewList'),
  imagePreviewRemove: document.getElementById('imagePreviewRemove'),
  fileInput: document.getElementById('fileInput'),
  fileBtn: document.getElementById('fileBtn'),
  folderInput: document.getElementById('folderInput'),
  folderBtn: document.getElementById('folderBtn'),
  filePreview: document.getElementById('filePreview'),
  filePreviewName: document.getElementById('filePreviewName'),
  filePreviewMeta: document.getElementById('filePreviewMeta'),
  filePreviewRemove: document.getElementById('filePreviewRemove'),
  composerNotice: document.getElementById('composerNotice'),
  composerDropZone: document.getElementById('composerDropZone'),
};

function ensureMemoryInspectorUi() {
  return ensureMemoryInspectorUiModule(els);
}
function setComposerNotice(text = '', tone = 'muted', source = 'manual') {
  if (!els.composerNotice) return;
  els.composerNotice.textContent = text;
  els.composerNotice.dataset.tone = tone;
  if (text) els.composerNotice.dataset.source = source;
  else delete els.composerNotice.dataset.source;
  els.composerNotice.hidden = !text;
}

function updateModelConnectionNotice(status = state.backendStatus) {
  const summary = summarizeShellModelConnection(status);
  if (!summary.ready && !summary.checking) {
    setComposerNotice(summary.noticeText, 'warn', 'model-connection');
    return summary;
  }
  if (els.composerNotice?.dataset.source === 'model-connection') {
    setComposerNotice('', 'muted', 'model-connection');
  }
  return summary;
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
const runtimeVoice = createRuntimeVoiceController({ els, apiFetch });

function removeTrailingStreamingAssistantDraft() {
  const last = state.messages[state.messages.length - 1];
  if (last?.role === 'assistant' && last?.streaming) {
    state.messages.pop();
  }
}

function cancelActiveChatRequest({ removeStreamingDraft = false, clearLoading = true } = {}) {
  const canceledRequestId = chatRequestGuard.cancel();
  runtimeVoice.stop();
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
  preloadTimeoutMs: 1700,
});

async function loadExpressionPackManifest() {
  activeExpressionPack = await expressionPackRuntime.load();
  return activeExpressionPack;
}

function appendMessageDecor(item, decorSeed, role) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-decor';
  wrap.setAttribute('aria-hidden', 'true');
  for (const src of chatDecorSrcsRuntime(decorSeed, role, CHAT_DECOR_CHIBI_RUNTIME, CHAT_DECOR_TECH_RUNTIME)) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'msg-decor-img';
    img.draggable = false;
    wrap.appendChild(img);
  }
  item.appendChild(wrap);
}

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

function applyCompanionArtFallback(container) {
  if (!container) return;
  for (const img of Array.from(container.querySelectorAll('[data-fallback-src]'))) {
    bindExpressionImageFallback(img);
  }
}

function applyCompanionArtFallbacks(containers = []) {
  for (const container of containers) applyCompanionArtFallback(container);
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
  const mode = state.memory.brainMode === 'shadow' ? 'shadow' : 'local';
  if (els.brainModeShadow) els.brainModeShadow.checked = mode === 'shadow';
  if (els.brainModeLocal) els.brainModeLocal.checked = mode === 'local';
  if (els.backendLastLane) els.backendLastLane.textContent = formatLastLane(meta);
  if (!els.brainModeNote) return;
  els.brainModeNote.textContent = buildBrainModeNote({ mode, meta, status: state.backendStatus });
}
let _lastSpriteKey = '';
let _spriteTimer = null;
let _lastRenderedMood = '';
let _lastPresentationProfile = null;
let _spriteTransitionGeneration = 0;

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

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function triggerGlitch(profile = null) {
  if (prefersReducedMotion()) return;
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
  const transitionGeneration = ++_spriteTransitionGeneration;

  const html = companionFaceHtml(mood, profile);
  const isFirstRender = hasMissingSprite;
  const reducedMotion = prefersReducedMotion();
  const fadeOutMs = reducedMotion ? 0 : Number(profile.fadeOutMs || 100);
  const swapDelayMs = reducedMotion ? 0 : Number(profile.swapDelayMs || 110);
  const fadeInMs = reducedMotion ? 0 : Number(profile.fadeInMs || 180);
  const settleMs = reducedMotion ? 0 : Number(profile.settleMs || 200);

  if (isFirstRender) {
    for (const container of containers) {
      container.innerHTML = html;
      container.style.transition = '';
      container.style.opacity = '1';
    }
    applyCompanionArtFallbacks(containers);
    _lastSpriteKey = spriteKey;
    _lastRenderedMood = mood;
    _lastPresentationProfile = profile;
    applyIntensityClass();
    return;
  }

  triggerGlitch(profile);

  if (_spriteTimer) { clearTimeout(_spriteTimer); _spriteTimer = null; }

  for (const container of containers) {
    container.style.transition = `opacity ${fadeOutMs}ms ease-out`;
    container.style.opacity = '0.04';
  }

  _spriteTimer = setTimeout(() => {
    if (transitionGeneration !== _spriteTransitionGeneration) return;
    for (const container of containers) {
      container.innerHTML = html;
    }
    applyCompanionArtFallbacks(containers);
    applyIntensityClass();
    for (const container of containers) {
      container.style.transition = `opacity ${fadeInMs}ms ease-in`;
      container.style.opacity = '1';
    }
    _lastPresentationProfile = profile;
    _spriteTimer = setTimeout(() => {
      if (transitionGeneration !== _spriteTransitionGeneration) return;
      for (const container of containers) {
        container.style.transition = '';
      }
      _spriteTimer = null;
    }, settleMs);
    _lastSpriteKey = spriteKey;
    _lastRenderedMood = mood;
  }, swapDelayMs);
}

function updateTheme() {
  const palette = applyMoodCssVariables(document.documentElement, state.mood, MOODS);
  els.moodPill.textContent = state.loading ? 'thinking' : palette.label;
  els.presenceValue.textContent = state.presence;
  els.turnsValue.textContent = String(state.turns);
  const modelSummary = summarizeShellModelConnection(state.backendStatus);
  const statusText = state.loading ? 'processing' : state.consolidating ? 'saving memory' : state.syncingMemory ? 'syncing memory' : modelSummary.statusText;
  els.statusValue.textContent = statusText;
  els.statusValueTop.textContent = statusText;
  renderSprite(state.mood, palette);
  els.shell.dataset.mood = state.mood;
  els.shell.dataset.expressionPack = activeExpressionPack.id || 'default';
  renderExpressionDecisionUi();
}

function updateBackendStatusUi(status = null) {
  updateBackendStatusUiHelper({ els, state, status });
  if (els.brainModeShadowRow) {
    els.brainModeShadowRow.hidden = status?.shadowEnabled !== true;
  }
  updateModelConnectionNotice(status);
  updateTheme();
}

function updateModelSetupUi(status = null) {
  return updateModelSetupUiHelper({ els, status });
}

function pennyAvatarDescriptor(mood = state.mood) {
  return getMoodAvatarDescriptorRuntime(activeExpressionPack, mood);
}

function pennyAvatarSrc(mood = state.mood) {
  return pennyAvatarDescriptor(mood).src;
}

function syncStaticCyberDecorBounds() {
  return syncIdleDecorBoundsRuntime(els.cyberDecor, els.chatWrap || els.chat?.parentElement);
}

function queueStaticCyberDecorBoundsSync() {
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(() => syncStaticCyberDecorBounds());
    return;
  }
  syncStaticCyberDecorBounds();
}

function renderMessages({ forceStickToLatest = false } = {}) {
  renderTranscriptMessagesUi({
    chatEl: els.chat,
    introEl: els.intro,
    cyberDecorEl: els.cyberDecor,
    chatWrapEl: els.chatWrap || els.chat?.parentElement,
    messages: state.messages,
    loading: state.loading,
    stateMood: state.mood,
    avatarSrcForMood: pennyAvatarSrc,
    avatarDescriptorForMood: pennyAvatarDescriptor,
    appendMessageDecor,
    formatBytesFn: formatBytes,
    escapeHtmlFn: escapeHtml,
    forceStickToLatest,
  });
  applyCompanionArtFallback(els.chat);
  queueStaticCyberDecorBoundsSync();
}

function updateStreamingAssistantBubble(text = '') {
  updateStreamingAssistantBubbleUi({
    chatEl: els.chat,
    text,
    chatWrapEl: els.chatWrap || els.chat?.parentElement,
    stripDraftMoodFn: stripDraftMood,
    escapeHtmlFn: escapeHtml,
  });
  queueStaticCyberDecorBoundsSync();
}

async function readPennyEventStream(response, handlers = {}) {
  return readPennyEventStreamUi(response, handlers);
}

function renderMemory() {
  ensureMemoryInspectorUi();
  renderMemoryListModule({ els, memory: state.memory, inspector: state.memoryInspector, escapeHtmlFn: escapeHtml });
  renderWorkspaceWritesPanel({ panelEl: els.workspaceWritesPanel, payload: state.workspaceWrites || {}, escapeHtmlFn: escapeHtml });
  updateWorkspaceWritesBadge(state.workspaceWrites || {});
  runtimeVoice.setEnabled(state.memory.voiceOn === true);
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
    const vesselFit = String(params.get('vesselFit') || '').toUpperCase();
    if (debugMood && MOODS[debugMood]) state.mood = debugMood;
    if (debugTurns !== null && debugTurns !== '') state.turns = Number(debugTurns) || 0;
    if (['A', 'B', 'C', 'D'].includes(vesselFit)) {
      document.documentElement.dataset.vesselFit = vesselFit;
    }
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
    loadWorkspaceWrites({ quiet: true });
  }
  if (panel === 'settings') {
    loadBackendStatus();
    refreshRuntimeVoiceStatus();
  }
  if (panel === 'chat') queueStaticCyberDecorBoundsSync();
}

function maybeSpeak(text) {
  if (!state.memory.voiceOn) return;
  runtimeVoice.speak(text);
}

function applyMemory(memory, options = {}) {
  if (!memory) return;
  const previousVoiceOn = state.memory.voiceOn === true;
  state.memory = {
    ...state.memory,
    ...memory,
    memories: Array.isArray(memory.memories) ? memory.memories : state.memory.memories,
  };
  if (options.preserveVoiceOn === true && previousVoiceOn) {
    state.memory.voiceOn = true;
  }
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

async function workspaceWritesRequest(pathname = '/api/penny/workspace-writes', method = 'GET', body = null) {
  const res = await apiFetch(pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Workspace write request failed: ${res.status}`);
  return res.json();
}

async function loadWorkspaceWrites(options = {}) {
  try {
    const data = await workspaceWritesRequest();
    state.workspaceWrites = data;
    renderWorkspaceWritesPanel({ panelEl: els.workspaceWritesPanel, payload: state.workspaceWrites, escapeHtmlFn: escapeHtml });
    updateWorkspaceWritesBadge(state.workspaceWrites);
  } catch (error) {
    state.workspaceWrites = { pending: [], count: 0, error: error?.message || String(error || 'unknown error') };
    renderWorkspaceWritesPanel({ panelEl: els.workspaceWritesPanel, payload: state.workspaceWrites, escapeHtmlFn: escapeHtml });
    updateWorkspaceWritesBadge(state.workspaceWrites);
    if (!options.quiet) reportMemoryIssue('workspace edits load failed', error);
  }
}

function updateWorkspaceWritesBadge(payload = {}) {
  const badge = buildWorkspaceWritesBadgeState(payload);
  if (!els.workspaceWritesBadge) return badge;
  els.workspaceWritesBadge.hidden = !badge.visible;
  els.workspaceWritesBadge.textContent = badge.label;
  els.workspaceWritesBadge.title = badge.title;
  els.workspaceWritesBadge.setAttribute('aria-label', badge.title || 'No workspace edits awaiting approval');
  els.memoryTab?.classList.toggle('has-badge', badge.visible);
  return badge;
}

async function reviewWorkspaceWrite(id = '', action = '') {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (normalizedAction !== 'approve' && normalizedAction !== 'deny') return;
  await workspaceWritesRequest(`/api/penny/workspace-writes/${normalizedAction}`, 'POST', { id });
  await loadWorkspaceWrites();
}

async function loadMemoryInspector(options = {}) {
  ensureMemoryInspectorUi();
  try {
    const data = await memoryInspectorRequest(`/api/penny/memory/inspector?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
    state.memoryInspector = data.inspector || null;
    renderMemoryListModule({ els, memory: state.memory, inspector: state.memoryInspector, escapeHtmlFn: escapeHtml });
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

async function exportRememberedFacts() {
  const res = await apiFetch(`/api/penny/memory/export?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
  if (!res.ok) throw new Error(`Memory export request failed: ${res.status}`);
  const data = await res.json();
  const payload = data.export || data;
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `penny-remembered-facts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
    await refreshProviderStatus({ quiet: true });
    await refreshWebSettings({ quiet: true });
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

function setProviderSetupNote(text = '', tone = 'muted') {
  if (!els.providerSetupNote) return;
  els.providerSetupNote.textContent = text;
  els.providerSetupNote.dataset.tone = tone;
}

function setOpenAiCloudPanelVisible(visible = true) {
  if (els.openAiCloudPanel) els.openAiCloudPanel.hidden = visible !== true;
}

function focusLocalModelSetup() {
  setOpenAiCloudPanelVisible(false);
  setProviderSetupNote('Local model setup is selected. Start LM Studio, llama.cpp, or another local OpenAI-compatible server, then choose the loaded model below.', 'muted');
  els.localModelSetupSection?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  els.modelSelect?.focus();
}

function setProviderBusy(busy = false) {
  if (els.connectOpenAiProvider) els.connectOpenAiProvider.disabled = busy;
  if (els.resetLocalProvider) els.resetLocalProvider.disabled = busy;
  if (els.providerUseLocal) els.providerUseLocal.disabled = busy;
  if (els.providerRefresh) els.providerRefresh.disabled = busy;
}

function renderProviderStatus(status = null) {
  if (!els.providerStatus && !els.providerSetupPanel) return;
  const activeProvider = String(status?.activeProvider || 'local');
  const pendingProvider = String(status?.pendingProvider || status?.pending?.provider || '');
  const isCloudActive = activeProvider === 'openai-cloud';
  const hasPending = !!pendingProvider;
  if (els.firstRunSetupPanel) {
    const localModelReady = summarizeShellModelConnection(state.backendStatus).ready === true;
    const hideFirstRun = isCloudActive || hasPending || localModelReady;
    els.firstRunSetupPanel.hidden = hideFirstRun;
    if (els.firstRunSetupSection) els.firstRunSetupSection.hidden = hideFirstRun;
  }
  if (els.providerSetupPanel) {
    els.providerSetupPanel.dataset.severity = hasPending ? 'needs-setup' : 'ready';
    els.providerSetupPanel.className = `setup-card setup-${hasPending ? 'needs-setup' : 'ready'}`;
  }
  if (els.providerStatus) {
    if (hasPending) {
      els.providerStatus.textContent = pendingProvider === 'local'
        ? 'Local model setup saved. Close and reopen PennyOS to switch back.'
        : 'OpenAI API setup saved. Close and reopen PennyOS to use it.';
    } else if (isCloudActive) {
      els.providerStatus.textContent = 'Using OpenAI API. Not private/local.';
    } else {
      els.providerStatus.textContent = 'Using local model path. Cloud is off.';
    }
  }
  if (isCloudActive || pendingProvider === 'openai-cloud') {
    setOpenAiCloudPanelVisible(true);
  }
  const cloudDefaults = status?.cloudDefaults || {};
  if (els.openAiChatModel && !els.openAiChatModel.value) {
    els.openAiChatModel.value = status?.chatModel || cloudDefaults.chat || '';
  }
  if (els.openAiToolModel && !els.openAiToolModel.value) {
    els.openAiToolModel.value = status?.toolModel || cloudDefaults.tool || status?.chatModel || cloudDefaults.chat || '';
  }
  if (els.openAiEmbedModel && !els.openAiEmbedModel.value) {
    els.openAiEmbedModel.value = status?.embedModel || cloudDefaults.embed || '';
  }
  const preview = status?.apiKeyPreview || status?.pending?.apiKeyPreview || '';
  if (hasPending) {
    setProviderSetupNote(status?.restartHint || 'Provider setup saved. Close and reopen PennyOS for this to take effect.', 'warn');
  } else if (isCloudActive) {
    setProviderSetupNote(`OpenAI API is active${preview ? ` with key ${preview}` : ''}. Prompts/context may leave this computer.`, 'warn');
  } else {
    setProviderSetupNote('Local-first mode is active. The OpenAI API remains off unless you save it here.', 'muted');
  }
}

async function refreshProviderStatus({ quiet = false } = {}) {
  if (!els.providerStatus && !els.providerSetupPanel) return null;
  try {
    const res = await apiFetch('/api/penny/provider/status');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Provider status failed: ${res.status}`);
    renderProviderStatus(data);
    return data;
  } catch (error) {
    if (!quiet) setProviderSetupNote(error?.message || 'Provider status failed.', 'warn');
    return null;
  }
}

function renderWebSettings(status = null) {
  if (!els.webSettingsPanel) return;
  const pending = status?.pending && typeof status.pending === 'object' ? status.pending : null;
  const enabled = pending ? pending.enabled === true : status?.enabled === true;
  const answerMode = String(pending?.answerMode || status?.answerMode || 'model') === 'direct' ? 'direct' : 'model';
  if (els.webSearchToggle) els.webSearchToggle.checked = enabled;
  if (els.webAnswerMode) {
    els.webAnswerMode.value = answerMode;
    els.webAnswerMode.disabled = !enabled;
  }
  els.webSettingsPanel.className = `setup-card setup-${enabled ? 'ready' : 'needs-setup'}`;
  if (!els.webSettingsNote) return;
  if (status?.restartRequired) {
    els.webSettingsNote.textContent = status.restartHint || 'Saved. Close and reopen PennyOS to apply web access changes.';
    els.webSettingsNote.dataset.tone = 'warn';
  } else if (!enabled) {
    els.webSettingsNote.textContent = 'Web access is off. Penny stays local unless you enable and save it here.';
    els.webSettingsNote.dataset.tone = 'muted';
  } else {
    els.webSettingsNote.textContent = answerMode === 'direct'
      ? 'Web access is on with fast deterministic result lists.'
      : 'Web access is on. Penny will shape search results into a natural answer.';
    els.webSettingsNote.dataset.tone = 'muted';
  }
}

async function refreshWebSettings({ quiet = false } = {}) {
  if (!els.webSettingsPanel) return null;
  try {
    const res = await apiFetch('/api/penny/web-settings');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Web settings failed: ${res.status}`);
    renderWebSettings(data);
    return data;
  } catch (error) {
    if (!quiet && els.webSettingsNote) {
      els.webSettingsNote.textContent = error?.message || 'Web settings could not be loaded.';
      els.webSettingsNote.dataset.tone = 'warn';
    }
    return null;
  }
}

async function saveWebSettingsFromControls() {
  if (!els.saveWebSettings) return;
  els.saveWebSettings.disabled = true;
  if (els.webSettingsNote) {
    els.webSettingsNote.textContent = 'Saving web settings...';
    els.webSettingsNote.dataset.tone = 'muted';
  }
  try {
    const res = await apiFetch('/api/penny/web-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: els.webSearchToggle?.checked === true,
        answerMode: els.webAnswerMode?.value || 'model',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Web settings save failed: ${res.status}`);
    renderWebSettings(data);
  } catch (error) {
    if (els.webSettingsNote) {
      els.webSettingsNote.textContent = error?.message || 'Web settings could not be saved.';
      els.webSettingsNote.dataset.tone = 'warn';
    }
  } finally {
    els.saveWebSettings.disabled = false;
  }
}

async function connectOpenAiProviderFromControls() {
  if (!els.connectOpenAiProvider) return;
  const payload = {
    apiKey: els.openAiApiKey?.value || '',
    chatModel: els.openAiChatModel?.value || '',
    toolModel: els.openAiToolModel?.value || els.openAiChatModel?.value || '',
    embedModel: els.openAiEmbedModel?.value || '',
    acceptCloudDisclosure: els.openAiCloudDisclosure?.checked === true,
  };
  if (!String(payload.apiKey || '').trim()) {
    setProviderSetupNote('Paste an OpenAI Platform API key first.', 'warn');
    els.openAiApiKey?.focus();
    return;
  }
  if (!payload.acceptCloudDisclosure) {
    setProviderSetupNote('Check the cloud disclosure before saving OpenAI setup.', 'warn');
    return;
  }
  setProviderBusy(true);
  setProviderSetupNote('Checking OpenAI key and saving provider setup...', 'muted');
  try {
    const res = await apiFetch('/api/penny/provider/openai/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `OpenAI setup failed: ${res.status}`);
    if (els.openAiApiKey) els.openAiApiKey.value = '';
    renderProviderStatus(data);
  } catch (error) {
    setProviderSetupNote(error?.message || 'OpenAI setup failed.', 'warn');
  } finally {
    setProviderBusy(false);
  }
}

async function resetLocalProviderFromControls() {
  setProviderBusy(true);
  setProviderSetupNote('Saving local LM Studio defaults...', 'muted');
  try {
    const res = await apiFetch('/api/penny/provider/local/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Local reset failed: ${res.status}`);
    if (els.openAiApiKey) els.openAiApiKey.value = '';
    renderProviderStatus(data);
  } catch (error) {
    setProviderSetupNote(error?.message || 'Local reset failed.', 'warn');
  } finally {
    setProviderBusy(false);
  }
}

async function refreshRuntimeVoiceStatus() {
  await runtimeVoice.refreshStatus();
  runtimeVoice.setEnabled(state.memory.voiceOn === true);
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
    const statusForUi = data.lmStudio ? data : { ...data, lmStudio: lmData };
    const viewModel = updateModelSetupUi(statusForUi);
    const models = Array.isArray(viewModel.chatModels) ? viewModel.chatModels : [];
    if (!models.length) {
      els.modelSelect.innerHTML = '<option value="">no models loaded</option>';
    } else {
      const selected = viewModel.selectedChatModel || models[0];
      fillModelSelectOptionsUi(els.modelSelect, models, selected);
    }
    if (els.toolModelSelect) {
      const toolModels = Array.isArray(viewModel.toolModels) ? viewModel.toolModels : [];
      if (!toolModels.length) {
        els.toolModelSelect.innerHTML = '<option value="">no models loaded</option>';
      } else {
        const selectedTool = viewModel.selectedToolModel || toolModels[0];
        fillModelSelectOptionsUi(els.toolModelSelect, toolModels, selectedTool);
      }
    }
    if (els.embedModelSelect) {
      const embedModels = Array.isArray(viewModel.embeddingModels) ? viewModel.embeddingModels : [];
      if (!embedModels.length) {
        els.embedModelSelect.innerHTML = '<option value="">basic memory search</option>';
      } else {
        fillModelSelectOptionsUi(els.embedModelSelect, embedModels, viewModel.selectedEmbedModel || embedModels[0]);
      }
    }
  } catch {}
}

async function saveModelSetupFromControls() {
  const chatModel = els.modelSelect?.value || '';
  const toolModel = els.toolModelSelect?.value || '';
  const embedModel = els.embedModelSelect?.value || '';
  const payload = {
    disableModelFallback: els.modelSetupFallback ? !els.modelSetupFallback.checked : false,
  };
  if (chatModel) payload.chatModel = chatModel;
  if (toolModel) payload.toolModel = toolModel;
  if (embedModel) payload.embedModel = embedModel;
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
els.embedModelSelect?.addEventListener('change', saveModelSetupFromControls);
els.modelSetupFallback?.addEventListener('change', saveModelSetupFromControls);
els.saveModelSetup?.addEventListener('click', saveModelSetupFromControls);
els.refreshModelSetup?.addEventListener('click', () => loadBackendStatus());
els.providerRefresh?.addEventListener('click', () => refreshProviderStatus());
els.webSearchToggle?.addEventListener('change', () => {
  if (els.webAnswerMode) els.webAnswerMode.disabled = !els.webSearchToggle.checked;
});
els.saveWebSettings?.addEventListener('click', saveWebSettingsFromControls);
els.providerShowOpenAi?.addEventListener('click', () => {
  setOpenAiCloudPanelVisible(true);
  setProviderSetupNote('Paste an OpenAI Platform API key, confirm the warning, then save. Reopen PennyOS after it succeeds.', 'muted');
  els.openAiApiKey?.focus();
});
els.providerUseLocal?.addEventListener('click', () => {
  focusLocalModelSetup();
});
els.firstRunUseLocal?.addEventListener('click', () => {
  focusLocalModelSetup();
});
els.firstRunUseOpenAi?.addEventListener('click', () => {
  setOpenAiCloudPanelVisible(true);
  setProviderSetupNote('Paste an OpenAI Platform API key, confirm the warning, then save. Reopen PennyOS after it succeeds.', 'muted');
  els.openAiCloudPanel?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  els.openAiApiKey?.focus();
});
els.connectOpenAiProvider?.addEventListener('click', connectOpenAiProviderFromControls);
els.resetLocalProvider?.addEventListener('click', resetLocalProviderFromControls);
els.saveVoiceSetup?.addEventListener('click', async () => {
  try {
    await runtimeVoice.saveConfig();
    runtimeVoice.setEnabled(state.memory.voiceOn === true);
  } catch (error) {
    console.warn(`[penny voice] ${error?.message || error}`);
  }
});
els.refreshVoiceStatus?.addEventListener('click', refreshRuntimeVoiceStatus);
els.voiceTest?.addEventListener('click', () => runtimeVoice.testSpeak());
els.voiceStop?.addEventListener('click', () => runtimeVoice.stop());
els.voiceReplay?.addEventListener('click', () => runtimeVoice.replay());

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
  const pendingImages = attachmentUi.getPendingImages();
  const pendingFile = attachmentUi.getPendingFile();
  if (!userText) {
    if (pendingImages.length || pendingFile) setComposerNotice('Add a short prompt so Penny knows what to do with the attachment.', 'warn');
    return;
  }
  const { requestId, signal, replacedRequestId } = chatRequestGuard.start();
  if (replacedRequestId !== null) {
    removeTrailingStreamingAssistantDraft();
  }
  const imageData = pendingImages.map(image => image?.dataUrl).filter(Boolean);
  const fileData = pendingFile ? { ...pendingFile } : null;
  const msgObj = { id: createMessageId('user'), role: 'user', content: userText };
  if (imageData.length) msgObj.images = imageData;
  if (fileData) msgObj.file = { name: fileData.name, size: fileData.size, lineCount: fileData.lineCount, type: fileData.type };
  state.messages.push(msgObj);
  const assistantDraft = { id: createMessageId('assistant'), role: 'assistant', content: '', streaming: true, toolsUsed: [], mood: 'thinking' };
  state.messages.push(assistantDraft);
  els.composer.value = '';
  els.composer.dispatchEvent(new Event('input', { bubbles: true }));
  attachmentUi.clearPendingAttachments(); state.loading = true; state.presence = 'thinking'; renderMessages({ forceStickToLatest: true }); updateTheme(); saveState();
  try {
    const body = { sessionId: state.memory.sessionId, messages: serializeMessagesForApi(), memories: buildChatMemoryPayload(state.memory), stream: true };
    if (imageData.length) body.images = imageData;
    if (fileData) body.file = fileData;
    const res = await apiFetch('/api/penny/chat?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!chatRequestGuard.isActive(requestId)) return;
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
      if (!chatRequestGuard.isActive(requestId)) return;
      const publicFailure = readPublicProviderFailure(data);
      updateBrainModeUi(data.meta || {
        requestedMode: state.memory.brainMode,
        usedFallback: false,
        shadowError: publicFailure.message,
      });
      throw new Error(publicFailure.message);
    }
    let streamedText = '';
    let finalData = null;
    const streamReducer = createClientStreamReducer();
    await readPennyEventStream(res, {
      onEvent(event, data) {
        if (!chatRequestGuard.isActive(requestId)) return;
        const transition = streamReducer.apply(event, data);
        if (!transition.changed) return;
        if (event === 'stream.reset') {
          streamedText = '';
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant' && last?.streaming) {
            last.content = '';
            delete last.toolStatus;
          }
          state.presence = 'thinking';
          updateStreamingAssistantBubble('');
          updateTheme();
          return;
        }
        if (event === 'status') {
          state.presence = data?.label || state.presence;
          updateTheme();
          return;
        }
        if (event === 'message.delta') {
          streamedText = transition.text;
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
          throw new Error(readPublicProviderFailure(data, {
            fallbackMessage: 'Penny could not complete that streaming request.',
          }).message);
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
      state.messages.push({ id: createMessageId('assistant'), role: 'assistant', content: parsed.text, mood: parsed.mood, toolsUsed: Array.isArray(finalData.meta?.toolsUsed) ? finalData.meta.toolsUsed : [] });
    }
    applyExpressionDecision({
      autoMood: parsed.mood,
      decisionSource: inferExpressionSource(finalData.text || streamedText || '', finalData.meta?.mood || ''),
      decisionReason: `Reply mood resolved to ${parsed.mood} from Penny's latest response.`,
    });
    const shouldSpeakAfterReply = state.memory.voiceOn === true && runtimeVoice.isEnabled();
    state.presence = 'present';
    state.turns = finalData.meta?.turns || state.turns + 1;
    applyMemory(finalData.memory, { preserveVoiceOn: shouldSpeakAfterReply });
    if (finalData.meta?.responseLimit?.hit === true) {
      setComposerNotice('Penny hit the model output limit. Turn off LM Studio thinking mode for normal chat, then retry or ask her to continue.', 'warn', 'response-limit');
    } else if (els.composerNotice?.dataset.source === 'response-limit') {
      setComposerNotice('', 'muted', 'response-limit');
    }
    if (shouldSpeakAfterReply) runtimeVoice.speak(parsed.text);
    else maybeSpeak(parsed.text);
    updateBrainModeUi(finalData.meta || null);
    window.setTimeout(() => { loadMemoryInspector({ quiet: true }); }, 150);
  } catch (error) {
    if (!chatRequestGuard.isActive(requestId)) return;
    if (isAbortError(error)) {
      removeTrailingStreamingAssistantDraft();
      state.presence = state.messages.length ? 'present' : 'idle';
      return;
    }
    const modelSummary = summarizeShellModelConnection(state.backendStatus);
    if (!modelSummary.ready && !modelSummary.checking) {
      setComposerNotice(modelSummary.noticeText, 'warn', 'model-connection');
    }
    const prefix = state.memory.brainMode === 'shadow'
      ? 'The experimental review route did not return a reply.'
      : (modelSummary.ready ? 'Local LLM did not return a reply.' : modelSummary.failurePrefix);
    const last = state.messages[state.messages.length - 1];
    if (last?.role === 'assistant' && last.streaming) {
      last.content = `${prefix} ${error?.message || 'Try again in a moment.'}`;
      delete last.toolStatus;
      delete last.streaming;
    } else {
      state.messages.push({ id: createMessageId('assistant'), role: 'assistant', content: `${prefix} ${error?.message || 'Try again in a moment.'}` });
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
window.addEventListener('resize', queueStaticCyberDecorBoundsSync);
els.send.addEventListener('click', sendMessage);

async function attachImageFiles(files) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) return;
  try {
    const pending = attachmentUi.getPendingImages();
    const prepared = await prepareImageAttachments(selected, {
      existingCount: pending.length,
      existingBytes: pending.reduce((total, image) => total + Number(image?.bytes || 0), 0),
    });
    attachmentUi.attachImages(prepared, { append: true });
  } catch (error) {
    setComposerNotice(error?.message || 'Image prep failed. Try a smaller batch.', 'error');
  }
}

async function attachTextFile(file) {
  if (!file) return;
  try {
    attachmentUi.attachFile(await prepareFileAttachment(file));
  } catch (error) {
    attachmentUi.clearPendingFile({ keepNotice: true });
    setComposerNotice(error?.message || 'File prep failed. Try a smaller text/code file.', 'error');
  }
}

async function attachTextFolder(files) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) return;
  try {
    attachmentUi.attachFile(await prepareFolderAttachment(selected));
  } catch (error) {
    attachmentUi.clearPendingFile({ keepNotice: true });
    setComposerNotice(error?.message || 'Folder prep failed. Pick a few smaller text/code files.', 'error');
  }
}

async function handleComposerDrop(files) {
  const selected = Array.from(files || []).filter(Boolean);
  const images = selected.filter(file => String(file?.type || '').startsWith('image/'));
  const textFiles = selected.filter(file => !String(file?.type || '').startsWith('image/'));
  if (!images.length && !textFiles.length) {
    setComposerNotice('Drop images or text/code files here. Pasted paths are not uploads.', 'warn');
    return;
  }
  if (images.length) await attachImageFiles(images);
  if (textFiles.length === 1) await attachTextFile(textFiles[0]);
  if (textFiles.length > 1) await attachTextFolder(textFiles);
}

if (els.imageBtn) els.imageBtn.addEventListener('click', () => els.imageInput?.click());
if (els.imageInput) els.imageInput.addEventListener('change', async () => {
  await attachImageFiles(els.imageInput.files);
  els.imageInput.value = '';
});
if (els.imagePreviewRemove) els.imagePreviewRemove.addEventListener('click', () => attachmentUi.clearPendingImages());
if (els.fileBtn) els.fileBtn.addEventListener('click', () => els.fileInput?.click());
if (els.fileInput) els.fileInput.addEventListener('change', async () => {
  await attachTextFile(els.fileInput.files?.[0]);
  els.fileInput.value = '';
});
if (els.folderBtn) els.folderBtn.addEventListener('click', () => els.folderInput?.click());
if (els.folderInput) els.folderInput.addEventListener('change', async () => {
  await attachTextFolder(els.folderInput.files);
  els.folderInput.value = '';
});
if (els.filePreviewRemove) els.filePreviewRemove.addEventListener('click', () => attachmentUi.clearPendingFile());
if (els.composerDropZone) {
  let dragDepth = 0;
  const dragContainsFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
  els.composerDropZone.addEventListener('dragenter', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    els.composerDropZone.classList.add('is-dragging-files');
  });
  els.composerDropZone.addEventListener('dragover', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  els.composerDropZone.addEventListener('dragleave', (event) => {
    if (!dragContainsFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.composerDropZone.classList.remove('is-dragging-files');
  });
  els.composerDropZone.addEventListener('drop', async (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    els.composerDropZone.classList.remove('is-dragging-files');
    await handleComposerDrop(event.dataTransfer?.files);
  });
}
els.composer.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
els.composer.addEventListener('focus', () => {
  els.shell?.classList.add('is-composing');
  document.querySelector('.core')?.classList.add('is-composing');
});
els.composer.addEventListener('blur', () => {
  els.shell?.classList.remove('is-composing');
  document.querySelector('.core')?.classList.remove('is-composing');
});
els.nameInput.addEventListener('change', async () => { state.memory.userName = els.nameInput.value.trim(); saveState(); renderMemory(); await syncMemoryToDisk(); });
els.voiceToggle.addEventListener('change', async () => {
  state.memory.voiceOn = runtimeVoice.setEnabled(els.voiceToggle.checked);
  saveState();
  renderMemory();
  await syncMemoryToDisk();
});
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
  const exportButton = event.target.closest('#exportRememberedFacts');
  if (exportButton) {
    try {
      await exportRememberedFacts();
    } catch (error) {
      reportMemoryIssue('memory export failed', error);
    }
    return;
  }
  const reviewButton = event.target.closest('button[data-review-action]');
  if (reviewButton) {
    try {
      await reviewMemoryPromotion(reviewButton.dataset.reviewId, reviewButton.dataset.reviewAction);
    } catch (error) {
      reportMemoryIssue('memory review failed', error);
    }
    return;
  }
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'memory') return;
  const index = Number(button.dataset.index); const memories = [...(state.memory.memories || [])]; memories.splice(index, 1); await patchMemory({ memories });
});
els.workspaceWritesPanel?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-workspace-write-action]');
  if (!button) return;
  try {
    await reviewWorkspaceWrite(button.dataset.workspaceWriteId, button.dataset.workspaceWriteAction);
  } catch (error) {
    reportMemoryIssue('workspace edit review failed', error);
  }
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
    decisionReason: 'Resetting the local shell reset the expression shell to calm.',
  });
  state.presence = 'idle';
  renderMessages(); renderMemory(); updateTheme(); saveState(); await syncMemoryToDisk();
});

loadState();
applyDebugSpriteOverrides();
renderMessages();
renderMemory();
updateTheme();
updateBrainModeUi();
renderApiTokenControls();
loadDurableMemory();
loadWorkspaceWrites({ quiet: true });
loadBackendStatus();
refreshRuntimeVoiceStatus();
async function initializeExpressionPack() {
  try {
    await loadExpressionPackManifest();
    _lastSpriteKey = '';
    _lastRenderedMood = '';
    _lastPresentationProfile = null;
    for (const container of [els.coreFace, els.mobileCoreFace].filter(Boolean)) {
      container.replaceChildren();
    }
    if (!state.loading) renderMessages();
    updateTheme();
    const faceReady = await waitForExpressionImages(
      [els.coreFace, els.mobileCoreFace].filter(Boolean),
      { timeoutMs: 250 },
    );
    const expressionStatus = expressionPackRuntime.status;
    const registeredReady = expressionStatus.manifestLoaded
      && activeExpressionPack.id === 'penny-2d25d-eight-mood-v1.4'
      && expressionStatus.calmReady
      && faceReady;
    document.documentElement.dataset.expressionReady = registeredReady
      ? 'registered'
      : (faceReady ? 'legacy-fallback' : 'degraded');
  } catch {
    document.documentElement.dataset.expressionReady = 'degraded';
  } finally {
    document.documentElement.classList.remove('expression-loading');
  }
}

initializeExpressionPack();

const pennyDebug = (mood, turns) => {
  if (mood && MOODS[mood]) state.mood = mood;
  if (turns !== undefined) state.turns = Number(turns) || 0;
  _lastSpriteKey = '';
  _lastRenderedMood = '';
  _lastPresentationProfile = null;
  if (!state.loading) renderMessages();
  updateTheme();
};
Object.defineProperties(pennyDebug, {
  expressionStatus: {
    enumerable: true,
    get: () => expressionPackRuntime.status,
  },
  expressionPack: {
    enumerable: true,
    get: () => activeExpressionPack.id || 'default',
  },
  expressionTransitionGeneration: {
    enumerable: true,
    get: () => _spriteTransitionGeneration,
  },
});
window.__pennyDebug = pennyDebug;
