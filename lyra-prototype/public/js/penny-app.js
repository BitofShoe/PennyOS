import {
  fillModelSelectOptions as fillModelSelectOptionsUi,
  mergeDistinctModelIds as mergeDistinctModelIdsUi,
  findBestModelMatch as findBestModelMatchUi,
  updateBackendStatusUi as updateBackendStatusUiHelper,
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

const MOODS = {
  calm: { primary: '#7dd3fc', secondary: '#0ea5e9', glow: 'rgba(125,211,252,0.24)', ring: 'rgba(125,211,252,0.14)', label: 'calm' },
  happy: { primary: '#86efac', secondary: '#22c55e', glow: 'rgba(134,239,172,0.24)', ring: 'rgba(134,239,172,0.14)', label: 'happy' },
  excited: { primary: '#fcd34d', secondary: '#f59e0b', glow: 'rgba(252,211,77,0.26)', ring: 'rgba(252,211,77,0.16)', label: 'excited' },
  thinking: { primary: '#d8b4fe', secondary: '#8b5cf6', glow: 'rgba(216,180,254,0.25)', ring: 'rgba(216,180,254,0.14)', label: 'thinking' },
  surprised: { primary: '#f9a8d4', secondary: '#ec4899', glow: 'rgba(249,168,212,0.25)', ring: 'rgba(249,168,212,0.14)', label: 'surprised' },
  flirty: { primary: '#fb7185', secondary: '#e11d48', glow: 'rgba(251,113,133,0.28)', ring: 'rgba(251,113,133,0.16)', label: 'flirty' },
  smug: { primary: '#fdba74', secondary: '#ea580c', glow: 'rgba(253,186,116,0.26)', ring: 'rgba(253,186,116,0.14)', label: 'smug' },
  annoyed: { primary: '#94a3b8', secondary: '#475569', glow: 'rgba(148,163,184,0.22)', ring: 'rgba(148,163,184,0.12)', label: 'annoyed' },
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
  memoryInspector: null,
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
  chatWrap: document.getElementById('chatWrap'),
  cyberDecor: document.querySelector('.cyber-decor'),
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
  backendToolModel: document.getElementById('backendToolModel'),
  backendLastLane: document.getElementById('backendLastLane'),
  newChat: document.getElementById('newChat'),
  clearMemory: document.getElementById('clearMemory'),
  refreshMemory: document.getElementById('refreshMemory'),
  clearAllMemories: document.getElementById('clearAllMemories'),
  modelSelect: document.getElementById('modelSelect'),
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
  if (els.memoryInspectorPanel) return;
  const host = els.memoryList?.parentElement;
  if (!host) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'memory-toolbar';
  toolbar.innerHTML = `
    <div>
      <div class="section-label">Hybrid memory inspector</div>
      <div class="memory-toolbar-note">
        Explicit facts stay canonical. Archive recall, summaries, patterns, and review items live here.
      </div>
    </div>
    <div class="memory-toolbar-actions">
      <button id="refreshMemoryInspector" class="secondary-btn tiny" type="button">Refresh inspector</button>
      <button id="purgeSessionArchive" class="secondary-btn tiny danger" type="button">Clear session archive</button>
      <button id="purgeGlobalArchive" class="secondary-btn tiny danger" type="button">Clear archive</button>
      <button id="purgeEmbeddings" class="secondary-btn tiny danger" type="button">Clear embeddings</button>
    </div>
  `;
  const panel = document.createElement('div');
  panel.id = 'memoryInspectorPanel';
  panel.className = 'list-block empty';
  panel.textContent = 'Inspector data will appear here once Penny has a chat to archive.';
  host.append(toolbar, panel);
  els.memoryInspectorToolbar = toolbar;
  els.memoryInspectorPanel = panel;
}
function setComposerNotice(text = '', tone = 'muted') {
  if (!els.composerNotice) return;
  els.composerNotice.textContent = text;
  els.composerNotice.dataset.tone = tone;
  els.composerNotice.hidden = !text;
}
const attachmentUi = createAttachmentUi({ els, setComposerNotice });

function parseMood(text, fallbackMood = '') {
  const str = String(text || '');
  const all = [...str.matchAll(/\[MOOD:(\w+)\]/g)];
  const lastTag = all.length ? all[all.length - 1][1] : null;
  const mood = lastTag && MOODS[lastTag]
    ? lastTag
    : (fallbackMood && MOODS[fallbackMood] ? fallbackMood : 'calm');
  return { mood, text: str.replace(/\s*\[MOOD:\w+\]\s*/g, '').trim() };
}

function stripDraftMood(text) {
  return String(text || '')
    .replace(/\s*\[MOOD:\w+\]\s*$/g, '')
    .replace(/\s*\[MOOD:[^\]]*$/g, '')
    .trimEnd();
}

function escapeHtml(text) {
  return String(text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const MOOD_SPRITES = {
  calm: [
    { src: '/sprites/decor/chibi-avatar-calm.png', label: 'RIGHT HERE', pill: 'KNOWING', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-think.png', label: 'SETTLE IN', pill: 'SETTLED', pos: '50% 44%' },
  ],
  happy: [
    { src: '/sprites/decor/chibi-avatar-happy.png', label: 'CHARM MODE', pill: 'CHARMED', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-heart.png', label: 'SOFT SPOT', pill: 'SOFT', pos: '50% 43%' },
  ],
  excited: [
    { src: '/sprites/decor/chibi-avatar-excited.png', label: 'SPARKED UP', pill: 'SPARKED', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-peace.png', label: 'OH, HELL YES', pill: 'FIRED UP', pos: '50% 48%' },
  ],
  thinking: [
    { src: '/sprites/decor/chibi-avatar-thinking.png', label: 'LOCKED IN', pill: 'LOCKED IN', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-think.png', label: 'DOING THE MATH', pill: 'FOCUSED', pos: '50% 44%' },
  ],
  surprised: [
    { src: '/sprites/decor/chibi-avatar-surprised.png', label: 'WAIT, WHAT?', pill: 'STARTLED', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-peace.png', label: 'DID NOT SEE THAT COMING', pill: 'WHOA', pos: '50% 48%' },
  ],
  flirty: [
    { src: '/sprites/decor/chibi-avatar-flirty.png', label: 'COME HERE', pill: 'TEASING', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-heart.png', label: 'YOU ASKED FOR THIS', pill: 'DANGEROUS', pos: '50% 43%' },
  ],
  smug: [
    { src: '/sprites/decor/chibi-avatar-smug.png', label: 'TOLD YOU', pill: 'SMUG', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-wink.png', label: 'TOO EASY', pill: 'TOO EASY', pos: '50% 48%' },
  ],
  annoyed: [
    { src: '/sprites/decor/chibi-avatar-annoyed.png', label: 'REALLY NOW?', pill: 'ANNOYED', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-think.png', label: 'TRY ME', pill: 'TRY ME', pos: '50% 44%' },
  ],
};

/** Chibi mood sprites — shared by sidebar main display and chat bubble avatars. */
const CHIBI_AVATARS = {
  calm: '/sprites/decor/chibi-avatar-calm.png',
  happy: '/sprites/decor/chibi-avatar-happy.png',
  excited: '/sprites/decor/chibi-avatar-excited.png',
  thinking: '/sprites/decor/chibi-avatar-thinking.png',
  surprised: '/sprites/decor/chibi-avatar-surprised.png',
  flirty: '/sprites/decor/chibi-avatar-flirty.png',
  smug: '/sprites/decor/chibi-avatar-smug.png',
  annoyed: '/sprites/decor/chibi-avatar-annoyed.png',
};

/** Small stamps beside each chat row — scroll with the thread (unlike fixed .cyber-decor). */
const CHAT_DECOR_CHIBI = [
  '/sprites/decor/chibi-penny-wink.png',
  '/sprites/decor/chibi-penny-peace.png',
  '/sprites/decor/chibi-penny-think.png',
  '/sprites/decor/chibi-penny-heart.png',
];
const CHAT_DECOR_TECH = [
  '/sprites/decor/pixel-headphones.png',
  '/sprites/decor/pixel-monitor.png',
  '/sprites/decor/pixel-chip.png',
  '/sprites/decor/pixel-crystal.png',
  '/sprites/decor/pixel-blossoms.png',
];
const IDLE_DECOR_TEXT = [
  'PENNY.EXE',
  'OPEN_CHANNEL',
  'THREAD_OPEN',
  'LINK_OK',
  'BUFFER',
  '>>STREAM',
  'SIGNAL',
  'NODE_SYNC',
  'SYS://PENNY.CORE',
  'VECTOR',
];
const IDLE_DECOR_CHIBI_POOL = [...new Set([...Object.values(CHIBI_AVATARS), ...CHAT_DECOR_CHIBI])];
const IDLE_DECOR_TECH_POOL = [...new Set(CHAT_DECOR_TECH)];

function chatDecorSrcs(index, role) {
  const seed = index * 17 + (role === 'user' ? 11 : 3);
  const tech = CHAT_DECOR_TECH[seed % CHAT_DECOR_TECH.length];
  if (role === 'user') return [tech];
  const chibi = CHAT_DECOR_CHIBI[(seed + 2) % CHAT_DECOR_CHIBI.length];
  return [chibi, tech];
}

function appendMessageDecor(item, index, role) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-decor';
  wrap.setAttribute('aria-hidden', 'true');
  for (const src of chatDecorSrcs(index, role)) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'msg-decor-img';
    img.draggable = false;
    wrap.appendChild(img);
  }
  item.appendChild(wrap);
}

const idleDecorState = {
  rafId: 0,
  lastTs: 0,
  width: 0,
  height: 0,
  items: [],
  resizeTimer: 0,
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function classifyIdleDecorClass(src = '') {
  if (/pixel-(crystal|blossoms)\.png$/i.test(src)) return 'decor-cyber';
  if (/pixel-/i.test(src)) return 'decor-tech';
  return 'decor-chibi';
}

function createIdleDecorImage(src = '') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.draggable = false;
  img.className = `decor-float decor-screensaver ${classifyIdleDecorClass(src)}`;
  return img;
}

function createIdleDecorText(text = '') {
  const span = document.createElement('span');
  span.className = 'decor-float decor-text decor-screensaver';
  span.textContent = text;
  return span;
}

function ensureIdleDecorPopulation() {
  const container = els.cyberDecor;
  if (!container || container.dataset.screensaverSeeded === '1') return;
  container.dataset.screensaverSeeded = '1';

  for (const node of container.querySelectorAll('.decor-float')) {
    node.classList.add('decor-screensaver');
  }

  const extraNodes = [];
  for (let i = 0; i < 5; i += 1) {
    extraNodes.push(createIdleDecorImage(IDLE_DECOR_CHIBI_POOL[i % IDLE_DECOR_CHIBI_POOL.length]));
  }
  for (let i = 0; i < 4; i += 1) {
    extraNodes.push(createIdleDecorImage(IDLE_DECOR_TECH_POOL[i % IDLE_DECOR_TECH_POOL.length]));
  }
  for (let i = 0; i < 3; i += 1) {
    extraNodes.push(createIdleDecorText(IDLE_DECOR_TEXT[i % IDLE_DECOR_TEXT.length]));
  }

  for (const node of extraNodes) {
    container.appendChild(node);
  }
}

function measureIdleDecorNode(node) {
  const rect = node.getBoundingClientRect();
  const fallbackWidth = node.classList.contains('decor-chibi')
    ? 192
    : node.classList.contains('decor-text')
      ? 180
      : node.classList.contains('decor-cyber')
        ? 100
        : 112;
  const width = rect.width || fallbackWidth;
  const height = rect.height || (node.classList.contains('decor-text') ? 28 : fallbackWidth * 0.72);
  return { width, height };
}

function applyIdleDecorFrame(item, timestamp = 0) {
  const sway = Math.sin((timestamp * 0.001 * item.wobbleSpeed) + item.phase) * item.wobble;
  const opacity = Math.max(0.08, Math.min(0.34, item.baseOpacity + Math.cos((timestamp * 0.00075) + item.phase) * 0.028));
  item.node.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) scale(${item.scale.toFixed(3)}) rotate(${(item.rotation + sway).toFixed(2)}deg)`;
  item.node.style.opacity = opacity.toFixed(3);
}

function seedIdleDecorMotion() {
  const container = els.cyberDecor;
  if (!container) return;
  const bounds = container.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  idleDecorState.width = bounds.width;
  idleDecorState.height = bounds.height;
  idleDecorState.items = [];

  const nodes = Array.from(container.querySelectorAll('.decor-float'));
  const now = performance.now();
  for (const node of nodes) {
    const { width, height } = measureIdleDecorNode(node);
    const maxX = Math.max(0, bounds.width - width);
    const maxY = Math.max(0, bounds.height - height);
    const speedX = node.classList.contains('decor-chibi') ? randomBetween(10, 15) : node.classList.contains('decor-text') ? randomBetween(7, 12) : randomBetween(11, 17);
    const speedY = node.classList.contains('decor-chibi') ? randomBetween(8, 13) : node.classList.contains('decor-text') ? randomBetween(6, 10) : randomBetween(9, 14);
    const item = {
      node,
      x: randomBetween(0, maxX),
      y: randomBetween(0, maxY),
      vx: speedX * (Math.random() > 0.5 ? 1 : -1),
      vy: speedY * (Math.random() > 0.5 ? 1 : -1),
      width,
      height,
      scale: node.classList.contains('decor-chibi')
        ? randomBetween(0.7, 1.02)
        : node.classList.contains('decor-text')
          ? randomBetween(0.84, 1.06)
          : randomBetween(0.78, 1.03),
      rotation: randomBetween(-6, 6),
      spin: randomBetween(-2.6, 2.6),
      baseOpacity: node.classList.contains('decor-chibi')
        ? randomBetween(0.16, 0.29)
        : node.classList.contains('decor-text')
          ? randomBetween(0.12, 0.2)
          : randomBetween(0.1, 0.18),
      phase: randomBetween(0, Math.PI * 2),
      wobble: node.classList.contains('decor-text') ? randomBetween(0.45, 1.2) : randomBetween(0.7, 1.8),
      wobbleSpeed: randomBetween(0.45, 1.2),
    };
    node.style.left = '0px';
    node.style.top = '0px';
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    idleDecorState.items.push(item);
    applyIdleDecorFrame(item, now);
  }
}

function syncIdleDecorBounds() {
  const container = els.cyberDecor;
  const scrollHost = els.chatWrap || els.chat?.parentElement;
  if (!container || !scrollHost) return false;
  const targetHeight = Math.max(scrollHost.scrollHeight, scrollHost.clientHeight);
  const targetWidth = scrollHost.clientWidth;
  if (!targetHeight || !targetWidth) return false;
  const nextHeight = `${Math.ceil(targetHeight)}px`;
  const nextWidth = `${Math.ceil(targetWidth)}px`;
  const changed = container.style.height !== nextHeight || container.style.width !== nextWidth;
  container.style.height = nextHeight;
  container.style.width = nextWidth;
  return changed;
}

function tickIdleDecor(timestamp) {
  if (!idleDecorState.items.length) {
    idleDecorState.rafId = 0;
    return;
  }

  if (!idleDecorState.lastTs) idleDecorState.lastTs = timestamp;
  const dt = Math.min(0.05, Math.max(0.001, (timestamp - idleDecorState.lastTs) / 1000));
  idleDecorState.lastTs = timestamp;

  const container = els.cyberDecor;
  if (!container) {
    idleDecorState.rafId = 0;
    return;
  }

  const boundsChanged = syncIdleDecorBounds();
  const bounds = container.getBoundingClientRect();
  if (bounds.width && bounds.height && (boundsChanged || Math.abs(bounds.width - idleDecorState.width) > 1 || Math.abs(bounds.height - idleDecorState.height) > 1)) {
    seedIdleDecorMotion();
  }

  for (const item of idleDecorState.items) {
    const maxX = Math.max(0, idleDecorState.width - item.width);
    const maxY = Math.max(0, idleDecorState.height - item.height);
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rotation += item.spin * dt;

    if (item.x <= 0 || item.x >= maxX) {
      item.x = Math.min(maxX, Math.max(0, item.x));
      item.vx *= -1;
      item.spin *= -1;
    }
    if (item.y <= 0 || item.y >= maxY) {
      item.y = Math.min(maxY, Math.max(0, item.y));
      item.vy *= -1;
    }

    applyIdleDecorFrame(item, timestamp);
  }

  idleDecorState.rafId = window.requestAnimationFrame(tickIdleDecor);
}

function startIdleDecorScreensaver() {
  if (!els.cyberDecor) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  ensureIdleDecorPopulation();
  syncIdleDecorBounds();
  seedIdleDecorMotion();
  if (!idleDecorState.rafId) {
    idleDecorState.lastTs = 0;
    idleDecorState.rafId = window.requestAnimationFrame(tickIdleDecor);
  }
}

window.addEventListener('resize', () => {
  if (!els.cyberDecor) return;
  window.clearTimeout(idleDecorState.resizeTimer);
  idleDecorState.resizeTimer = window.setTimeout(() => {
    seedIdleDecorMotion();
  }, 120);
});

function pickChibiHudLabel(mood) {
  const variants = MOOD_SPRITES[mood] || MOOD_SPRITES.calm;
  return variants[Math.floor(Math.random() * variants.length)].label;
}

function getMoodSpriteVariant(mood) {
  const variants = MOOD_SPRITES[mood] || MOOD_SPRITES.calm;
  const index = 0;
  return { ...(variants[index] || variants[0]), index };
}

function companionFaceHtml(mood) {
  const variant = getMoodSpriteVariant(mood);
  const src = variant?.src || CHIBI_AVATARS[mood] || CHIBI_AVATARS.calm;
  const label = variant?.label || pickChibiHudLabel(mood);
  const pos = variant?.pos || '50% 46%';
  return `
    <div class="penny-display penny-chibi penny-${mood}" data-variant="${variant?.index ?? 0}">
      <img src="${src}" class="penny-art penny-art-chibi" style="object-position:${pos}" alt="Penny" draggable="false" />
      <div class="penny-hud">
        <span class="penny-hud-left">PENNY.EXE</span>
        <span class="penny-hud-right">${label}</span>
      </div>
      <div class="penny-hud-bottom">${mood.toUpperCase()}</div>
    </div>
  `;
}


function updateBrainModeUi(meta = null) {
  const mode = state.memory.brainMode === 'local' ? 'local' : 'shadow';
  if (els.brainModeShadow) els.brainModeShadow.checked = mode === 'shadow';
  if (els.brainModeLocal) els.brainModeLocal.checked = mode === 'local';
  if (els.backendLastLane) els.backendLastLane.textContent = formatLastLane(meta);
  if (!els.brainModeNote) return;
  if (!meta) {
    els.brainModeNote.textContent = mode === 'shadow'
      ? 'Shadow uses the optional OpenClaw lane. It is still experimental and not Penny\'s main chat brain.'
      : 'LM Studio is Penny\'s main brain right now. Chat and tool lanes route automatically.';
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
  if (meta.requestedMode === 'local' && meta.localLane) {
    const lane = meta.localLane === 'tool' ? 'tool lane' : 'chat lane';
    const modelText = meta.resolvedModel ? ` on ${meta.resolvedModel}` : '';
    const fallbackText = meta.laneFallback ? ' It had to fall back to the best loaded local model.' : '';
    els.brainModeNote.textContent = `LM Studio handled the last reply on the ${lane}${modelText}.${fallbackText}`.trim();
    return;
  }
  els.brainModeNote.textContent = mode === 'local'
    ? 'LM Studio handled the last reply.'
    : 'Shadow is selected. This lane is experimental, and Penny will block the reply if OpenClaw fails.';
}

let _lastSpriteKey = '';
let _spriteTimer = null;

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

function triggerGlitch() {
  const core = document.querySelector('.core');
  if (!core) return;
  core.classList.add('mood-glitch');
  if (window._particleBurst) window._particleBurst();
  setTimeout(() => core.classList.remove('mood-glitch'), 320);
}

function renderSprite(mood, palette) {
  const container = els.coreFace;
  const intensity = getIntensity();
  const variant = getMoodSpriteVariant(mood);
  const spriteKey = `${mood}:${intensity}:${variant?.src || 'default'}`;
  if (spriteKey === _lastSpriteKey) return;

  const html = companionFaceHtml(mood);
  const isFirstRender = !container.querySelector('.penny-display');

  if (isFirstRender) {
    container.innerHTML = html;
    _lastSpriteKey = spriteKey;
    applyIntensityClass();
    return;
  }

  triggerGlitch();

  if (_spriteTimer) { clearTimeout(_spriteTimer); _spriteTimer = null; }

  container.style.transition = 'opacity 100ms ease-out';
  container.style.opacity = '0.04';

  _spriteTimer = setTimeout(() => {
    container.innerHTML = html;
    applyIntensityClass();
    container.style.transition = 'opacity 180ms ease-in';
    container.style.opacity = '1';
    _spriteTimer = setTimeout(() => {
      container.style.transition = '';
      _spriteTimer = null;
    }, 200);
    _lastSpriteKey = spriteKey;
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
  updateBackendStatusUiHelper({ els, state, status });
}

function pennyAvatarSrc(mood = state.mood) {
  return CHIBI_AVATARS[mood] || CHIBI_AVATARS.calm;
}

function renderMessages() {
  els.chat.innerHTML = '';
  if (els.intro) els.intro.hidden = true;
  if (els.cyberDecor) {
    els.cyberDecor.dataset.scene = state.messages.length === 0 && !state.loading ? 'empty' : 'thread';
  }
  const hasStreamingDraft = state.messages[state.messages.length - 1]?.role === 'assistant' && state.messages[state.messages.length - 1]?.streaming;
  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i];
    const msgMood = msg.role === 'assistant' && msg.mood && MOODS[msg.mood] ? msg.mood : state.mood;
    const item = document.createElement('div');
    item.className = `msg-row ${msg.role}${msg.streaming ? ' streaming' : ''}`;
    if (msg.role === 'assistant') {
      const header = document.createElement('div');
      header.className = 'msg-header';
      header.innerHTML = `<img class="msg-avatar" src="${pennyAvatarSrc(msgMood)}" alt="" /><span class="msg-label">PENNY</span>`;
      item.appendChild(header);
    }
    if (msg.image && msg.role === 'user') {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'msg-image';
      imgWrap.innerHTML = `<img src="${msg.image}" alt="Attached" />`;
      item.appendChild(imgWrap);
    }
    if ((msg.file || msg.fileMeta) && msg.role === 'user') {
      const file = msg.file || msg.fileMeta;
      const fileWrap = document.createElement('div');
      fileWrap.className = 'msg-file';
      fileWrap.innerHTML = `
        <span class="msg-file-icon" aria-hidden="true">&#128206;</span>
        <div class="msg-file-copy">
          <strong>${escapeHtml(file.name || 'Attached file')}</strong>
          <small>${escapeHtml(file.lineCount ? `${file.lineCount} lines` : formatBytes(file.size || 0))}</small>
        </div>
      `;
      item.appendChild(fileWrap);
    }
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role}${msg.streaming ? ' streaming' : ''}`;
    const content = msg.streaming ? stripDraftMood(msg.content) : msg.content;
    bubble.innerHTML = content
      ? escapeHtml(content).replace(/\n/g, '<br>')
      : (msg.streaming ? '<span class="stream-caret" aria-hidden="true"></span>' : '');
    item.appendChild(bubble);
    const toolLabels = Array.isArray(msg.toolsUsed) ? msg.toolsUsed.map(tool => tool?.label || tool?.name).filter(Boolean) : [];
    if (msg.toolStatus || toolLabels.length) {
      const meta = document.createElement('div');
      meta.className = `msg-meta${msg.toolStatus ? ' live' : ''}`;
      meta.textContent = msg.toolStatus || `checked ${toolLabels.join(' • ')}`;
      item.appendChild(meta);
    }
    appendMessageDecor(item, i, msg.role);
    els.chat.appendChild(item);
  }
  if (state.loading && !hasStreamingDraft) {
    const loading = document.createElement('div');
    loading.className = 'msg-row assistant';
    loading.innerHTML = `<div class="msg-header"><img class="msg-avatar" src="${pennyAvatarSrc('thinking')}" alt="" /><span class="msg-label">PENNY</span></div><div class="bubble assistant loading-bubble"><span></span><span></span><span></span></div>`;
    appendMessageDecor(loading, state.messages.length, 'assistant');
    els.chat.appendChild(loading);
  }
  syncIdleDecorBounds();
  els.chat.parentElement.scrollTop = els.chat.parentElement.scrollHeight;
}

function updateStreamingAssistantBubble(text = '') {
  const rows = els.chat.querySelectorAll('.msg-row.assistant');
  const row = rows[rows.length - 1];
  if (!row) return;
  const bubble = row.querySelector('.bubble.assistant');
  if (!bubble) return;
  const visible = stripDraftMood(text);
  bubble.classList.add('streaming');
  row.classList.add('streaming');
  bubble.innerHTML = visible
    ? escapeHtml(visible).replace(/\n/g, '<br>')
    : '<span class="stream-caret" aria-hidden="true"></span>';
  syncIdleDecorBounds();
  els.chat.parentElement.scrollTop = els.chat.parentElement.scrollHeight;
}

async function readPennyEventStream(response, handlers = {}) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming is not supported by this browser response.');
  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (frameText) => {
    const frame = String(frameText || '').trim();
    if (!frame) return;
    let event = 'message';
    const dataLines = [];
    for (const rawLine of frame.split(/\r?\n/)) {
      if (rawLine.startsWith('event:')) event = rawLine.slice(6).trim();
      else if (rawLine.startsWith('data:')) dataLines.push(rawLine.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const dataText = dataLines.join('\n');
    let data = dataText;
    try {
      data = JSON.parse(dataText);
    } catch {}
    handlers.onEvent?.(event, data);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      flushFrame(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
    if (done) break;
  }
  if (buffer.trim()) flushFrame(buffer);
}

function renderMemory() {
  ensureMemoryInspectorUi();
  const memories = state.memory.memories || [];
  if (els.memoryList) {
    els.memoryList.className = `list-block${memories.length ? '' : ' empty'}`;
    els.memoryList.innerHTML = memories.length
      ? memories.map((item, index) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtml(item.text)}<small>${escapeHtml(item.kind || 'memory')}</small></div><button class="memory-remove" data-kind="memory" data-index="${index}" type="button">x</button></div>`).join('')
      : 'Nothing stored yet. Penny will start picking things up as you talk.';
  }
  if (els.clearAllMemories) els.clearAllMemories.textContent = 'Clear explicit facts';
  if (els.nameInput) els.nameInput.value = state.memory.userName || '';
  if (els.voiceToggle) els.voiceToggle.checked = !!state.memory.voiceOn;
  renderMemoryInspector();
  updateBrainModeUi();
}

function renderMemoryInspector() {
  ensureMemoryInspectorUi();
  if (!els.memoryInspectorPanel) return;
  const inspector = state.memoryInspector;
  if (!inspector) {
    els.memoryInspectorPanel.className = 'list-block empty';
    els.memoryInspectorPanel.textContent = 'Inspector data will appear here once Penny has a chat to archive.';
    return;
  }
  const explicit = inspector.explicit || {};
  const session = inspector.archive?.session || {};
  const global = inspector.archive?.global || {};
  const semantic = inspector.embeddings?.semanticMemory || {};
  const retrieval = session.lastRetrieval || { session: [], global: [] };
  const queue = Array.isArray(global.promotionQueue) ? global.promotionQueue : [];

  const renderItems = (items = [], emptyText = 'None right now.') => {
    if (!items.length) return `<div class="list-item"><div class="memory-copy">${escapeHtml(emptyText)}</div></div>`;
    return items.map((item) => `
      <div class="list-item memory-item">
        <div class="memory-copy">
          ${escapeHtml(item.text || item.excerpt || '')}
          <small>${escapeHtml(item.sourceType || item.type || 'memory')} · ${escapeHtml(item.sensitivity || 'normal')}</small>
        </div>
      </div>
    `).join('');
  };

  const renderQueue = () => {
    if (!queue.length) return `<div class="list-item"><div class="memory-copy">Promotion queue is empty.</div></div>`;
    return queue.map((item) => `
      <div class="list-item memory-item">
        <div class="memory-copy">
          ${escapeHtml(item.text || '')}
          <small>evidence ${escapeHtml(String(item.evidenceCount || 0))} · confidence ${escapeHtml(String(Math.round((item.confidence || 0) * 100)))}%</small>
        </div>
        <div class="memory-toolbar-actions">
          <button class="secondary-btn tiny" type="button" data-review-action="approve" data-review-id="${escapeHtml(item.id || '')}">Approve</button>
          <button class="secondary-btn tiny danger" type="button" data-review-action="reject" data-review-id="${escapeHtml(item.id || '')}">Reject</button>
        </div>
      </div>
    `).join('');
  };

  els.memoryInspectorPanel.className = 'list-block';
  els.memoryInspectorPanel.innerHTML = `
    <div class="list-item">
      <div class="memory-copy">
        Semantic memory is <strong>${escapeHtml(semantic.ready ? 'active' : 'fallback')}</strong>.
        <small>${escapeHtml(semantic.configuredModel || 'no embedding model configured')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Explicit facts: ${escapeHtml(String(explicit.count || 0))} · Session archive: ${escapeHtml(String(session.episodeCount || 0))} episodes · Global patterns: ${escapeHtml(String(global.patternCount || 0))}
      </div>
    </div>
    <div class="section-label" style="margin-top:12px;">Last retrieval for Penny's reply</div>
    ${renderItems([...(retrieval.session || []), ...(retrieval.global || [])], 'No archive memories were used on the last reply.')}
    <div class="section-label" style="margin-top:12px;">Session archive</div>
    ${renderItems(session.recentEpisodes || [], 'No archived session episodes yet.')}
    <div class="section-label" style="margin-top:12px;">Longer-term summaries and patterns</div>
    ${renderItems([...(global.summaries || []), ...(global.patterns || [])], 'No global summaries or patterns yet.')}
    <div class="section-label" style="margin-top:12px;">Promotion queue</div>
    ${renderQueue()}
  `;
}

function saveState() {
  saveStateSnapshot(state);
}

function loadState() {
  const snapshot = loadStateSnapshot();
  if (!snapshot) return;
  state.memory = snapshot.memory;
  state.messages = snapshot.messages;
  state.mood = snapshot.mood && MOODS[snapshot.mood] ? snapshot.mood : 'calm';
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
    loadAvailableModels();
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
  const res = await fetch(`/api/penny/memory${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Memory request failed: ${res.status}`);
  return res.json();
}

async function memoryInspectorRequest(pathname, method = 'GET', body = null) {
  const res = await fetch(pathname, {
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
    const res = await fetch(`/api/penny/memory?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
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
    const isEmbed = (id) => /\b(embed|embedding|rerank)\b/i.test(id);
    const available = (data.availableModels || []).filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id));
    const installed = (data.installedModels || []).filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id));
    const candidates = Array.isArray(data.candidateModels)
      ? data.candidateModels.filter((id) => typeof id === 'string' && id.trim() && !isEmbed(id))
      : [];
    const configured = data.chatPreferredModel && !isEmbed(data.chatPreferredModel)
      ? [String(data.chatPreferredModel).trim()]
      : [];
    const models = mergeDistinctModelIdsUi(available, installed, candidates, configured);
    if (!models.length) {
      els.modelSelect.innerHTML = '<option value="">no models loaded</option>';
      return;
    }
    const resolved = data.resolvedChatModel || data.resolvedModel || '';
    const runtime = data.runtimePreferredModel || data.chatPreferredModel || '';
    const selected = findBestModelMatchUi(models, runtime, resolved, data.configuredModel)
      || models[0];
    fillModelSelectOptionsUi(els.modelSelect, models, selected);
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
    if (els.backendLastLane) els.backendLastLane.textContent = 'pending';
    loadBackendStatus();
  } catch {}
});

async function consolidateMemory() {
  if (state.consolidating) return;
  state.consolidating = true; updateTheme();
  try {
    const res = await fetch('/api/penny/consolidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: serializeMessagesForApi(8), memories: buildChatMemoryPayload(state.memory) }) });
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
  if (state.loading) return;
  if (!userText) {
    if (pendingImage || pendingFile) setComposerNotice('Add a short prompt so Penny knows what to do with the attachment.', 'warn');
    return;
  }
  const imageData = pendingImage?.dataUrl || null;
  const fileData = pendingFile ? { ...pendingFile } : null;
  const msgObj = { role: 'user', content: userText };
  if (imageData) msgObj.image = imageData;
  if (fileData) msgObj.file = { name: fileData.name, size: fileData.size, lineCount: fileData.lineCount, type: fileData.type };
  state.messages.push(msgObj);
  const assistantDraft = { role: 'assistant', content: '', streaming: true, toolsUsed: [], mood: 'thinking' };
  state.messages.push(assistantDraft);
  els.composer.value = ''; attachmentUi.clearPendingAttachments(); state.loading = true; state.presence = 'thinking'; renderMessages(); updateTheme(); saveState();
  try {
    const body = { sessionId: state.memory.sessionId, messages: serializeMessagesForApi(), memories: buildChatMemoryPayload(state.memory), stream: true };
    if (imageData) body.image = imageData;
    if (fileData) body.file = fileData;
    const res = await fetch('/api/penny/chat?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
      updateBrainModeUi(data.meta || { requestedMode: state.memory.brainMode, usedFallback: false, shadowError: data.detail || data.error || `Request failed: ${res.status}` });
      throw new Error(data.detail || data.error || `Request failed: ${res.status}`);
    }
    let streamedText = '';
    let finalData = null;
    await readPennyEventStream(res, {
      onEvent(event, data) {
        if (event === 'status') {
          state.presence = data?.label || state.presence;
          updateTheme();
          return;
        }
        if (event === 'message.delta') {
          streamedText = typeof data?.text === 'string' && data.text ? data.text : `${streamedText}${data?.content || ''}`;
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant') last.content = stripDraftMood(streamedText);
          updateStreamingAssistantBubble(streamedText);
          return;
        }
        if (event === 'tool') {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant') {
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
    state.mood = parsed.mood; state.presence = 'present'; state.turns = finalData.meta?.turns || state.turns + 1; applyMemory(finalData.memory); maybeSpeak(parsed.text); updateBrainModeUi(finalData.meta || null);
    window.setTimeout(() => { loadMemoryInspector({ quiet: true }); }, 150);
  } catch (error) {
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
    state.mood = 'thinking'; state.presence = 'error';
  } finally {
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

function isFlagEmoji(s) {
  const cps = [...s].map((c) => c.codePointAt(0));
  return cps.length >= 2 && cps.every((p) => p >= 0x1f1e6 && p <= 0x1f1ff);
}

function buildEmojiSet() {
  const picto = /\p{Extended_Pictographic}/u;
  const out = [];
  const seen = new Set();
  const add = (ch) => {
    if (!ch || seen.has(ch) || isFlagEmoji(ch)) return;
    seen.add(ch);
    out.push(ch);
  };
  const scan = (from, to) => {
    for (let cp = from; cp <= to && out.length < 400; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (cp >= 0x1f1e6 && cp <= 0x1f1ff) continue;
      const ch = String.fromCodePoint(cp);
      if (!picto.test(ch)) continue;
      add(ch);
    }
  };
  scan(0x1f600, 0x1f64f);
  scan(0x1f300, 0x1f5ff);
  scan(0x1f680, 0x1f6ff);
  scan(0x1f900, 0x1f9ff);
  scan(0x1fa70, 0x1faff);
  scan(0x2600, 0x26ff);
  scan(0x2700, 0x27bf);
  ['\u2764\uFE0F', '\u2728', '\u2B50', '\u26A1', '\u231A', '\u231B'].forEach(add);
  return out;
}

const EMOJI_SET = buildEmojiSet();
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
  const freshSessionId = createSessionId();
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
  const freshSessionId = createSessionId();
  state.memory = { ...structuredClone(DEFAULT_MEMORY), sessionId: freshSessionId };
  state.messages = []; state.turns = 0; state.mood = 'calm'; state.presence = 'idle';
  renderMessages(); renderMemory(); updateTheme(); saveState(); await syncMemoryToDisk();
});

loadState();
applyDebugSpriteOverrides();
renderMessages();
startIdleDecorScreensaver();
renderMemory();
updateTheme();
updateBrainModeUi();
loadDurableMemory();
loadBackendStatus();
loadAvailableModels();

(function bootSequence() {
  const overlay = document.getElementById('bootOverlay');
  if (!overlay) return;
  setTimeout(() => {
    overlay.classList.add('done');
    setTimeout(() => overlay.remove(), 600);
  }, 1800);
})();

(function idleEvents() {
  const core = document.querySelector('.core');
  if (!core) return;

  function randomFlicker() {
    core.classList.add('idle-flicker');
    setTimeout(() => core.classList.remove('idle-flicker'), 80);
  }

  function randomInterference() {
    core.classList.add('idle-interference');
    setTimeout(() => core.classList.remove('idle-interference'), 200);
  }

  setInterval(() => {
    const roll = Math.random();
    if (roll < 0.3) randomFlicker();
    else if (roll < 0.5) randomInterference();
  }, 4000);
})();

const _debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
if (!_debugMode) {
  const memTab = document.querySelector('.tab[data-panel="memory"]');
  if (memTab) memTab.style.display = 'none';
}

window.__pennyDebug = (mood, turns) => {
  if (mood && MOODS[mood]) state.mood = mood;
  if (turns !== undefined) state.turns = Number(turns) || 0;
  _lastSpriteKey = '';
  updateTheme();
};

(function initParallax() {
  const core = document.querySelector('.core');
  if (!core) return;
  const MAX_SHIFT = 12;

  document.addEventListener('mousemove', (e) => {
    const display = core.querySelector('.penny-display');
    if (!display) return;
    const rect = core.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    const x = Math.max(-1, Math.min(1, dx)) * MAX_SHIFT;
    const y = Math.max(-1, Math.min(1, dy)) * MAX_SHIFT;
    const s = INTENSITY_SCALES[getIntensity()] || 1;
    display.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  });
})();

(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const COUNT = 35;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  function spawn(burst) {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (burst) {
      const cx = rect.width / 2;
      const cy = rect.height * 0.4;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5 + 0.5;
      return {
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40,
        r: Math.random() * 2.5 + 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        alpha: Math.random() * 0.6 + 0.3,
        life: Math.random() * 60 + 30,
        age: 0,
        burst: true,
      };
    }
    return {
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(Math.random() * 0.2 + 0.05),
      alpha: Math.random() * 0.4 + 0.1,
      life: Math.random() * 400 + 200,
      age: 0,
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(spawn());

  window._particleBurst = function () {
    for (let i = 0; i < 20; i++) particles.push(spawn(true));
  };

  function frame() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const palette = MOODS[state.mood] || MOODS.calm;
    const color = palette.primary;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.burst) p.vy += 0.02;
      p.age++;

      const progress = p.age / p.life;
      const fadeAlpha = progress < 0.1
        ? progress / 0.1
        : progress > 0.7
          ? (1 - progress) / 0.3
          : 1;
      const a = p.alpha * fadeAlpha;

      if (p.age >= p.life || p.y < -10 || p.x < -10 || p.x > w + 10 || p.y > h + 10) {
        if (p.burst) {
          particles.splice(i, 1);
        } else {
          particles[i] = spawn();
          particles[i].y = h + 5;
        }
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
