/**
 * Penny expression/runtime helpers for mood, sprite, theme, and idle decor behavior.
 * The main app can import these helpers without inheriting the current monolith.
 */

export const MOOD_THEMES = {
  calm: { primary: '#7dd3fc', secondary: '#0ea5e9', glow: 'rgba(125,211,252,0.24)', ring: 'rgba(125,211,252,0.14)', label: 'calm' },
  happy: { primary: '#86efac', secondary: '#22c55e', glow: 'rgba(134,239,172,0.24)', ring: 'rgba(134,239,172,0.14)', label: 'happy' },
  excited: { primary: '#fcd34d', secondary: '#f59e0b', glow: 'rgba(252,211,77,0.26)', ring: 'rgba(252,211,77,0.16)', label: 'excited' },
  thinking: { primary: '#d8b4fe', secondary: '#8b5cf6', glow: 'rgba(216,180,254,0.25)', ring: 'rgba(216,180,254,0.14)', label: 'thinking' },
  surprised: { primary: '#f9a8d4', secondary: '#ec4899', glow: 'rgba(249,168,212,0.25)', ring: 'rgba(249,168,212,0.14)', label: 'surprised' },
  flirty: { primary: '#fb7185', secondary: '#e11d48', glow: 'rgba(251,113,133,0.28)', ring: 'rgba(251,113,133,0.16)', label: 'flirty' },
  smug: { primary: '#fdba74', secondary: '#ea580c', glow: 'rgba(253,186,116,0.26)', ring: 'rgba(253,186,116,0.14)', label: 'smug' },
  annoyed: { primary: '#94a3b8', secondary: '#475569', glow: 'rgba(148,163,184,0.22)', ring: 'rgba(148,163,184,0.12)', label: 'annoyed' },
};

export const MOOD_TAGS = ['calm', 'happy', 'excited', 'thinking', 'surprised', 'flirty', 'smug', 'annoyed'];
export const LEGACY_EXPRESSION_PACK_URL = '/sprites/packs/default/manifest.json';
// Public Penny defaults to the authored pose-sprite pack. The v1.4 registered
// composites remain shipped and independently verified, but are not the normal
// companion face while their animation direction is experimental.
export const DEFAULT_EXPRESSION_PACK_URL = LEGACY_EXPRESSION_PACK_URL;
export const EXPRESSION_DECISION_VERSION = 'penny-expression-decision.v1';
export const EXPRESSION_RENDER_MODES = Object.freeze(['legacy-chibi', 'registered-composite']);
export const EXPRESSION_TRANSITION_MODES = Object.freeze(['atomic-fade-swap']);

export const CHIBI_AVATARS = {
  calm: '/sprites/decor/chibi-avatar-calm.png',
  happy: '/sprites/decor/chibi-avatar-happy.png',
  excited: '/sprites/decor/chibi-avatar-excited.png',
  thinking: '/sprites/decor/chibi-avatar-thinking.png',
  surprised: '/sprites/decor/chibi-penny-peace.png',
  flirty: '/sprites/decor/chibi-avatar-flirty.png',
  smug: '/sprites/decor/chibi-avatar-smug.png',
  annoyed: '/sprites/decor/chibi-avatar-annoyed.png',
};

export const BAKED_CHECKERBOARD_CHIBIS = new Set([
  '/sprites/decor/chibi-avatar-surprised.png',
  '/sprites/decor/chibi-penny-heart.png',
  '/sprites/decor/chibi-penny-think.png',
  '/sprites/decor/chibi-penny-wink.png',
]);

export const MOOD_SPRITES = {
  calm: [
    { src: '/sprites/decor/chibi-avatar-calm.png', label: 'RIGHT HERE', pill: 'KNOWING', pos: '50% 48%' },
  ],
  happy: [
    { src: '/sprites/decor/chibi-avatar-happy.png', label: 'CHARM MODE', pill: 'CHARMED', pos: '50% 48%' },
  ],
  excited: [
    { src: '/sprites/decor/chibi-avatar-excited.png', label: 'SPARKED UP', pill: 'SPARKED', pos: '50% 48%' },
    { src: '/sprites/decor/chibi-penny-peace.png', label: 'OH, HELL YES', pill: 'FIRED UP', pos: '50% 48%' },
  ],
  thinking: [
    { src: '/sprites/decor/chibi-avatar-thinking.png', label: 'LOCKED IN', pill: 'LOCKED IN', pos: '50% 48%' },
  ],
  surprised: [
    { src: '/sprites/decor/chibi-penny-peace.png', label: 'DID NOT SEE THAT COMING', pill: 'WHOA', pos: '50% 48%' },
  ],
  flirty: [
    { src: '/sprites/decor/chibi-avatar-flirty.png', label: 'COME HERE', pill: 'TEASING', pos: '50% 48%' },
  ],
  smug: [
    { src: '/sprites/decor/chibi-avatar-smug.png', label: 'TOLD YOU', pill: 'SMUG', pos: '50% 48%' },
  ],
  annoyed: [
    { src: '/sprites/decor/chibi-avatar-annoyed.png', label: 'REALLY NOW?', pill: 'ANNOYED', pos: '50% 48%' },
  ],
};

export const CHAT_DECOR_CHIBI = [
  '/sprites/decor/chibi-avatar-calm.png',
  '/sprites/decor/chibi-penny-peace.png',
  '/sprites/decor/chibi-avatar-happy.png',
  '/sprites/decor/chibi-avatar-flirty.png',
];

export const CHAT_DECOR_TECH = [
  '/sprites/decor/pixel-headphones.png',
  '/sprites/decor/pixel-monitor.png',
  '/sprites/decor/pixel-chip.png',
  '/sprites/decor/pixel-crystal.png',
  '/sprites/decor/pixel-blossoms.png',
];

export const IDLE_DECOR_TEXT = [
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

export const IDLE_DECOR_CHIBI_POOL = [...new Set([...Object.values(CHIBI_AVATARS), ...CHAT_DECOR_CHIBI])]
  .filter((src) => !BAKED_CHECKERBOARD_CHIBIS.has(src));
export const IDLE_DECOR_TECH_POOL = [...new Set(CHAT_DECOR_TECH)];

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function isSafePublicAssetPath(value = '') {
  const text = normalizeString(value);
  if (!text || !text.startsWith('/sprites/') || text.startsWith('//') || text.includes('\\')) return false;
  if (/[?#]/.test(text) || /^[A-Za-z]:/.test(text)) return false;
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    return false;
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return false;
  return !decoded.split('/').some((part) => part === '..' || part === '.');
}

export function normalizeExpressionAssetPath(value, fallback = '') {
  if (isSafePublicAssetPath(value)) return normalizeString(value);
  return isSafePublicAssetPath(fallback) ? normalizeString(fallback) : '';
}

export function normalizeExpressionMode(value, allowedValues = [], fallback = '') {
  const text = normalizeString(value);
  return allowedValues.includes(text) ? text : fallback;
}

export function normalizeExpressionRenderMode(value, fallback = 'legacy-chibi') {
  return normalizeExpressionMode(value, EXPRESSION_RENDER_MODES, fallback);
}

export function normalizeExpressionTransitionMode(value, fallback = 'atomic-fade-swap') {
  return normalizeExpressionMode(value, EXPRESSION_TRANSITION_MODES, fallback);
}

export function normalizeSpriteDescriptor(value, fallback = {}) {
  if (typeof value === 'string') {
    return {
      ...fallback,
      src: normalizeExpressionAssetPath(value, fallback.src || ''),
    };
  }
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }
  const out = { ...fallback, ...value };
  out.src = normalizeExpressionAssetPath(out.src, fallback.src || '');
  out.fallbackSrc = normalizeExpressionAssetPath(out.fallbackSrc, fallback.fallbackSrc || '');
  if (out.fallbackSrc === out.src) out.fallbackSrc = '';
  out.alt = normalizeString(out.alt, fallback.alt || '');
  out.label = normalizeString(out.label, fallback.label || '');
  out.pill = normalizeString(out.pill, fallback.pill || '');
  out.pos = normalizeString(out.pos, fallback.pos || '50% 48%');
  return out;
}

export function normalizeVariantList(value, fallbackList = []) {
  const input = Array.isArray(value) ? value : [];
  const source = input.length ? input : fallbackList;
  return source
    .map((item, index) => normalizeSpriteDescriptor(item, fallbackList[index] || fallbackList[0] || {}))
    .filter((item) => item.src);
}

export function createDefaultExpressionPack() {
  return {
    id: 'default',
    name: 'Penny Default Expression Pack',
    version: 1,
    fallbackMood: 'calm',
    contract: [...MOOD_TAGS],
    source: '',
    renderMode: 'legacy-chibi',
    transitionMode: 'atomic-fade-swap',
    integrity: '',
    moods: {
      calm: {
        label: 'calm',
        avatar: { src: CHIBI_AVATARS.calm, alt: 'Penny calm expression' },
        variants: MOOD_SPRITES.calm,
        secondaryVariants: [
          { src: '/sprites/penny-mood-calm.png', label: 'QUIET', pill: 'QUIET', pos: '50% 50%' },
          { src: '/sprites/penny-mood-calm-2.png', label: 'SOFT CALM', pill: 'SOFT', pos: '50% 50%' },
        ],
        sceneHint: 'settled',
        backgroundHint: '/sprites/penny-mood-calm.png',
      },
      happy: {
        label: 'happy',
        avatar: { src: CHIBI_AVATARS.happy, alt: 'Penny happy expression' },
        variants: MOOD_SPRITES.happy,
        secondaryVariants: [
          { src: '/sprites/penny-mood-happy.png', label: 'BRIGHT', pill: 'BRIGHT', pos: '50% 50%' },
          { src: '/sprites/penny-mood-happy-2.png', label: 'WARM', pill: 'WARM', pos: '50% 50%' },
        ],
        sceneHint: 'warm',
        backgroundHint: '/sprites/penny-mood-happy.png',
      },
      excited: {
        label: 'excited',
        avatar: { src: CHIBI_AVATARS.excited, alt: 'Penny excited expression' },
        variants: MOOD_SPRITES.excited,
        secondaryVariants: [
          { src: '/sprites/penny-mood-excited.png', label: 'LIT UP', pill: 'LIT', pos: '50% 50%' },
          { src: '/sprites/penny-mood-excited-2.png', label: 'ON IT', pill: 'ON IT', pos: '50% 50%' },
        ],
        sceneHint: 'sparked',
        backgroundHint: '/sprites/penny-mood-excited.png',
      },
      thinking: {
        label: 'thinking',
        avatar: { src: CHIBI_AVATARS.thinking, alt: 'Penny thinking expression' },
        variants: MOOD_SPRITES.thinking,
        secondaryVariants: [
          { src: '/sprites/penny-mood-thinking.png', label: 'WORKING IT OUT', pill: 'WORKING', pos: '50% 50%' },
          { src: '/sprites/penny-mood-thinking-2.png', label: 'HOLD ON', pill: 'HOLD ON', pos: '50% 50%' },
        ],
        sceneHint: 'focused',
        backgroundHint: '/sprites/penny-mood-thinking.png',
      },
      surprised: {
        label: 'surprised',
        avatar: { src: CHIBI_AVATARS.surprised, alt: 'Penny surprised expression' },
        variants: MOOD_SPRITES.surprised,
        secondaryVariants: [
          { src: '/sprites/penny-mood-surprised.png', label: 'WHOOPS', pill: 'WHOOPS', pos: '50% 50%' },
          { src: '/sprites/penny-mood-surprised-2.png', label: 'OH?', pill: 'OH?', pos: '50% 50%' },
        ],
        sceneHint: 'startled',
        backgroundHint: '/sprites/penny-mood-surprised.png',
      },
      flirty: {
        label: 'flirty',
        avatar: { src: CHIBI_AVATARS.flirty, alt: 'Penny flirty expression' },
        variants: MOOD_SPRITES.flirty,
        secondaryVariants: [
          { src: '/sprites/penny-mood-flirty.png', label: 'CLOSE', pill: 'CLOSE', pos: '50% 50%' },
          { src: '/sprites/penny-mood-flirty-2.png', label: 'PLAYING', pill: 'PLAYING', pos: '50% 50%' },
        ],
        sceneHint: 'teasing',
        backgroundHint: '/sprites/penny-mood-flirty.png',
      },
      smug: {
        label: 'smug',
        avatar: { src: CHIBI_AVATARS.smug, alt: 'Penny smug expression' },
        variants: MOOD_SPRITES.smug,
        secondaryVariants: [
          { src: '/sprites/penny-mood-smug.png', label: 'NICE TRY', pill: 'NICE TRY', pos: '50% 50%' },
          { src: '/sprites/penny-mood-smug-2.png', label: 'CALLED IT', pill: 'CALLED IT', pos: '50% 50%' },
        ],
        sceneHint: 'self-satisfied',
        backgroundHint: '/sprites/penny-mood-smug.png',
      },
      annoyed: {
        label: 'annoyed',
        avatar: { src: CHIBI_AVATARS.annoyed, alt: 'Penny annoyed expression' },
        variants: MOOD_SPRITES.annoyed,
        secondaryVariants: [
          { src: '/sprites/penny-mood-annoyed.png', label: 'NOT IMPRESSED', pill: 'NOT IMPRESSED', pos: '50% 50%' },
          { src: '/sprites/penny-mood-annoyed-2.png', label: 'CUT IT OUT', pill: 'CUT IT OUT', pos: '50% 50%' },
        ],
        sceneHint: 'irritated',
        backgroundHint: '/sprites/penny-mood-annoyed.png',
      },
    },
  };
}

export function normalizeMoodEntry(
  mood,
  entry = {},
  fallbackEntry = createDefaultExpressionPack().moods[mood] || createDefaultExpressionPack().moods.calm,
  packDefaults = {},
) {
  const renderMode = normalizeExpressionRenderMode(
    entry.renderMode,
    normalizeExpressionRenderMode(packDefaults.renderMode, 'legacy-chibi'),
  );
  const transitionMode = normalizeExpressionTransitionMode(
    entry.transitionMode,
    normalizeExpressionTransitionMode(packDefaults.transitionMode, 'atomic-fade-swap'),
  );
  const applyDescriptorModes = (descriptor = {}) => ({
    ...descriptor,
    renderMode: normalizeExpressionRenderMode(descriptor.renderMode, renderMode),
    transitionMode: normalizeExpressionTransitionMode(descriptor.transitionMode, transitionMode),
  });
  const fallbackAvatar = normalizeSpriteDescriptor(fallbackEntry.avatar || fallbackEntry.variants?.[0] || {}, {
    src: '',
    alt: `Penny ${mood}`,
    label: '',
    pill: '',
    pos: '50% 48%',
  });
  const avatar = applyDescriptorModes(normalizeSpriteDescriptor(entry.avatar || entry.primary || entry.image, fallbackAvatar));
  const variants = normalizeVariantList(entry.variants, fallbackEntry.variants || []).map(applyDescriptorModes);
  const extraVariants = normalizeVariantList(entry.extraVariants || entry.variantAdditions, []).map(applyDescriptorModes);
  const secondaryVariants = normalizeVariantList(entry.secondaryVariants, fallbackEntry.secondaryVariants || []).map(applyDescriptorModes);
  const backgroundHint = normalizeExpressionAssetPath(
    typeof entry.backgroundHint === 'string' ? entry.backgroundHint : entry.background?.src || entry.background || fallbackEntry.backgroundHint || '',
    fallbackEntry.backgroundHint || '',
  );
  const seenVariantSrcs = new Set();
  const mergedVariants = [...variants, ...extraVariants].filter((variant) => {
    if (!variant?.src || BAKED_CHECKERBOARD_CHIBIS.has(variant.src) || seenVariantSrcs.has(variant.src)) return false;
    seenVariantSrcs.add(variant.src);
    return true;
  });

  return {
    ...fallbackEntry,
    ...entry,
    avatar,
    variants: mergedVariants.length ? mergedVariants : (fallbackEntry.variants || []),
    secondaryVariants,
    sceneHint: normalizeString(entry.sceneHint, fallbackEntry.sceneHint || ''),
    backgroundHint,
    renderMode,
    transitionMode,
  };
}

export function normalizeExpressionPackManifest(manifest, basePack = createDefaultExpressionPack()) {
  if (!manifest || typeof manifest !== 'object') {
    return cloneValue(basePack);
  }

  const pack = cloneValue(basePack);
  pack.id = normalizeString(manifest.id, pack.id);
  pack.name = normalizeString(manifest.name, pack.name);
  pack.version = Number.isFinite(Number(manifest.version)) ? Number(manifest.version) : pack.version;
  pack.fallbackMood = MOOD_TAGS.includes(manifest.fallbackMood) ? manifest.fallbackMood : pack.fallbackMood;
  pack.contract = [...MOOD_TAGS];
  pack.source = normalizeString(manifest.source, '');
  pack.renderMode = normalizeExpressionRenderMode(manifest.renderMode, pack.renderMode || 'legacy-chibi');
  pack.transitionMode = normalizeExpressionTransitionMode(manifest.transitionMode, pack.transitionMode || 'atomic-fade-swap');
  pack.integrity = normalizeExpressionAssetPath(manifest.integrity, '');

  const sourceMoods = manifest.moods && typeof manifest.moods === 'object' ? manifest.moods : {};
  for (const mood of MOOD_TAGS) {
    pack.moods[mood] = normalizeMoodEntry(
      mood,
      sourceMoods[mood] || manifest[mood] || {},
      pack.moods[mood],
      {
        renderMode: pack.renderMode,
        transitionMode: pack.transitionMode,
      },
    );
  }

  return pack;
}

export function parseMood(text, fallbackMood = '', moodMap = MOOD_THEMES) {
  const str = String(text || '');
  const all = [...str.matchAll(/\[MOOD:(\w+)\]/g)];
  const lastTag = all.length ? all[all.length - 1][1] : null;
  const mood = lastTag && moodMap[lastTag]
    ? lastTag
    : (fallbackMood && moodMap[fallbackMood] ? fallbackMood : 'calm');
  return { mood, text: str.replace(/\s*\[MOOD:\w+\]\s*/g, '').trim() };
}

export function normalizeMoodTag(value = '', moodMap = MOOD_THEMES) {
  const text = normalizeString(value).toLowerCase();
  if (!text) return '';
  return moodMap[text] ? text : '';
}

export function buildExpressionDecisionRecord({
  mood = 'calm',
  decisionSource = 'state-fallback',
  decisionReason = '',
  manualOverride = '',
  persistedMood = '',
} = {}) {
  const normalizedMood = normalizeMoodTag(mood) || 'calm';
  return {
    version: EXPRESSION_DECISION_VERSION,
    mood: normalizedMood,
    decisionSource: normalizeString(decisionSource, 'state-fallback'),
    decisionReason: normalizeString(decisionReason, 'No expression reason was recorded.'),
    manualOverride: normalizeMoodTag(manualOverride),
    persistedMood: normalizeMoodTag(persistedMood),
  };
}

export function stripDraftMood(text) {
  return String(text || '')
    .replace(/\s*\[MOOD:\w+\]\s*$/g, '')
    .replace(/\s*\[MOOD:[^\]]*$/g, '')
    .trimEnd();
}

export function getMoodTheme(mood = 'calm', paletteMap = MOOD_THEMES) {
  return paletteMap[mood] || paletteMap.calm || MOOD_THEMES.calm;
}

export function applyMoodCssVariables(root, mood = 'calm', paletteMap = MOOD_THEMES) {
  const palette = getMoodTheme(mood, paletteMap);
  if (root?.style?.setProperty) {
    root.style.setProperty('--primary', palette.primary);
    root.style.setProperty('--secondary', palette.secondary);
    root.style.setProperty('--glow', palette.glow);
    root.style.setProperty('--ring', palette.ring);
  }
  return palette;
}

export function getActiveMoodEntry(pack, mood = 'calm') {
  const fallbackMood = MOOD_TAGS.includes(pack?.fallbackMood) ? pack.fallbackMood : 'calm';
  const key = MOOD_TAGS.includes(mood) ? mood : fallbackMood;
  return pack?.moods?.[key] || pack?.moods?.calm || createDefaultExpressionPack().moods.calm;
}

export function getMoodSpriteVariants(pack, mood) {
  const entry = getActiveMoodEntry(pack, mood);
  return entry.variants || [];
}

export function getMoodAvatarSrc(pack, mood = 'calm') {
  const entry = getActiveMoodEntry(pack, mood);
  return entry.avatar?.src || entry.variants?.[0]?.src || createDefaultExpressionPack().moods.calm.avatar.src || CHIBI_AVATARS.calm;
}

export function getMoodAvatarDescriptor(pack, mood = 'calm') {
  const entry = getActiveMoodEntry(pack, mood);
  const fallbackSrc = CHIBI_AVATARS[mood] || CHIBI_AVATARS.calm;
  return {
    ...(entry.avatar || entry.variants?.[0] || {}),
    src: getMoodAvatarSrc(pack, mood),
    fallbackSrc: normalizeExpressionAssetPath(
      entry.avatar?.fallbackSrc || entry.variants?.[0]?.fallbackSrc,
      fallbackSrc,
    ),
    renderMode: normalizeExpressionRenderMode(
      entry.avatar?.renderMode || entry.renderMode || pack?.renderMode,
      'legacy-chibi',
    ),
    transitionMode: normalizeExpressionTransitionMode(
      entry.avatar?.transitionMode || entry.transitionMode || pack?.transitionMode,
      'atomic-fade-swap',
    ),
  };
}

export function getMoodSpriteVariant(pack, mood, variantIndex = 0) {
  const entry = getActiveMoodEntry(pack, mood);
  const variants = entry.variants || [];
  const index = Number.isInteger(variantIndex) && variantIndex >= 0 ? variantIndex : 0;
  const variant = variants[index] || variants[0] || entry.avatar || {};
  return {
    ...variant,
    index: variants.length ? Math.min(index, variants.length - 1) : 0,
    sceneHint: entry.sceneHint || '',
    backgroundHint: entry.backgroundHint || '',
    secondaryVariantCount: Array.isArray(entry.secondaryVariants) ? entry.secondaryVariants.length : 0,
  };
}

export function getMoodPresentationProfile({
  mood = 'calm',
  intensity = 0,
  previousMood = '',
  variantCount = 0,
  cycleSeed = 0,
} = {}) {
  const safeMood = MOOD_TAGS.includes(mood) ? mood : 'calm';
  const safePreviousMood = MOOD_TAGS.includes(previousMood) ? previousMood : '';
  const safeIntensity = Math.max(0, Math.min(2, Math.floor(Number(intensity) || 0)));
  const changed = !!safePreviousMood && safePreviousMood !== safeMood;
  const profiles = {
    calm: {
      impact: 'soft',
      variantByIntensity: [0, 0, 1],
      closeUpAt: 2,
      scaleBoost: [1, 1.01, 1.03],
      fadeOutMs: [120, 110, 105],
      swapDelayMs: [130, 120, 112],
      fadeInMs: [210, 195, 185],
      settleMs: [220, 205, 195],
      glitchMs: [180, 190, 205],
      burstCount: [8, 10, 12],
    },
    happy: {
      impact: 'warm',
      variantByIntensity: [0, 0, 1],
      closeUpAt: 2,
      scaleBoost: [1, 1.02, 1.05],
      fadeOutMs: [108, 100, 96],
      swapDelayMs: [118, 108, 102],
      fadeInMs: [188, 176, 168],
      settleMs: [198, 188, 178],
      glitchMs: [205, 220, 238],
      burstCount: [11, 13, 15],
    },
    excited: {
      impact: 'charged',
      variantByIntensity: [0, 1, 1],
      closeUpAt: 1,
      scaleBoost: [1.03, 1.07, 1.1],
      fadeOutMs: [92, 84, 78],
      swapDelayMs: [102, 92, 86],
      fadeInMs: [168, 154, 146],
      settleMs: [178, 166, 156],
      glitchMs: [248, 268, 290],
      burstCount: [16, 20, 24],
    },
    thinking: {
      impact: 'focused',
      variantByIntensity: [0, 1, 1],
      closeUpAt: 2,
      scaleBoost: [1, 1.02, 1.05],
      fadeOutMs: [106, 102, 98],
      swapDelayMs: [120, 116, 110],
      fadeInMs: [196, 188, 182],
      settleMs: [208, 198, 190],
      glitchMs: [192, 206, 220],
      burstCount: [9, 12, 14],
    },
    surprised: {
      impact: 'snap',
      variantByIntensity: [0, 1, 1],
      closeUpAt: 1,
      scaleBoost: [1.02, 1.07, 1.12],
      fadeOutMs: [82, 74, 68],
      swapDelayMs: [90, 82, 76],
      fadeInMs: [154, 142, 136],
      settleMs: [166, 152, 146],
      glitchMs: [260, 284, 306],
      burstCount: [18, 22, 26],
    },
    flirty: {
      impact: 'close',
      variantByIntensity: [0, 0, 1],
      closeUpAt: 1,
      scaleBoost: [1.02, 1.06, 1.1],
      fadeOutMs: [96, 88, 84],
      swapDelayMs: [108, 98, 92],
      fadeInMs: [176, 166, 158],
      settleMs: [188, 176, 168],
      glitchMs: [214, 232, 246],
      burstCount: [12, 15, 18],
    },
    smug: {
      impact: 'showboat',
      variantByIntensity: [0, 1, 1],
      closeUpAt: 1,
      scaleBoost: [1.01, 1.05, 1.08],
      fadeOutMs: [94, 86, 82],
      swapDelayMs: [106, 96, 90],
      fadeInMs: [172, 162, 154],
      settleMs: [184, 172, 164],
      glitchMs: [224, 242, 258],
      burstCount: [12, 16, 19],
    },
    annoyed: {
      impact: 'hard',
      variantByIntensity: [0, 1, 1],
      closeUpAt: 1,
      scaleBoost: [1.01, 1.04, 1.08],
      fadeOutMs: [88, 80, 74],
      swapDelayMs: [98, 90, 84],
      fadeInMs: [164, 150, 144],
      settleMs: [176, 162, 154],
      glitchMs: [236, 254, 272],
      burstCount: [14, 18, 21],
    },
  };
  const profile = profiles[safeMood] || profiles.calm;
  const preferredVariantIndex = profile.variantByIntensity?.[safeIntensity] ?? 0;
  const safeVariantCount = Math.max(0, Math.floor(Number(variantCount) || 0));
  const safeCycleSeed = Math.max(0, Math.floor(Number(cycleSeed) || 0));
  const variantIndex = safeVariantCount > 0
    ? (preferredVariantIndex + safeCycleSeed) % safeVariantCount
    : preferredVariantIndex;
  const burstCount = (profile.burstCount?.[safeIntensity] ?? 12) + (changed ? 4 : 0);
  const closeUp = safeIntensity >= Number(profile.closeUpAt ?? 2) || (changed && safeIntensity >= 1);

  return {
    mood: safeMood,
    previousMood: safePreviousMood,
    changed,
    intensity: safeIntensity,
    profile: safeMood,
    impact: profile.impact || 'soft',
    variantIndex,
    closeUp,
    scaleBoost: profile.scaleBoost?.[safeIntensity] ?? 1,
    fadeOutMs: profile.fadeOutMs?.[safeIntensity] ?? 100,
    swapDelayMs: profile.swapDelayMs?.[safeIntensity] ?? 110,
    fadeInMs: profile.fadeInMs?.[safeIntensity] ?? 180,
    settleMs: profile.settleMs?.[safeIntensity] ?? 200,
    glitchMs: profile.glitchMs?.[safeIntensity] ?? 220,
    burstCount,
  };
}

export function pickChibiHudLabel(pack, mood, rng = Math.random) {
  const variants = getMoodSpriteVariants(pack, mood);
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const pick = variants[Math.floor(roll * variants.length)] || variants[0];
  return pick?.label || getActiveMoodEntry(pack, mood).label || MOOD_THEMES[mood]?.label || 'penny';
}

export function buildCompanionFaceHtml({
  pack,
  mood,
  variantIndex = 0,
  presentationProfile = null,
  rng = Math.random,
  escapeHtmlFn = escapeHtml,
} = {}) {
  const variant = getMoodSpriteVariant(pack, mood, variantIndex);
  const entry = getActiveMoodEntry(pack, mood);
  const avatar = getMoodAvatarDescriptor(pack, mood);
  const src = variant?.src || avatar.src || CHIBI_AVATARS.calm;
  const fallbackSrc = normalizeExpressionAssetPath(
    variant?.fallbackSrc || avatar.fallbackSrc,
    CHIBI_AVATARS[mood] || CHIBI_AVATARS.calm,
  );
  const label = variant?.label || pickChibiHudLabel(pack, mood, rng);
  const pos = variant?.pos || '50% 46%';
  const packId = escapeHtmlFn(pack?.id || 'default');
  const safeMood = escapeHtmlFn(mood || 'calm');
  const renderMode = normalizeExpressionRenderMode(
    variant?.renderMode || entry.renderMode || pack?.renderMode,
    'legacy-chibi',
  );
  const transitionMode = normalizeExpressionTransitionMode(
    variant?.transitionMode || entry.transitionMode || pack?.transitionMode,
    'atomic-fade-swap',
  );
  const wrapperClass = renderMode === 'registered-composite'
    ? 'penny-display penny-chibi penny-registered-composite'
    : 'penny-display penny-chibi';
  const imageClass = renderMode === 'registered-composite'
    ? 'penny-art penny-art-registered-composite'
    : 'penny-art penny-art-chibi';
  const alt = variant?.alt || avatar.alt || `Penny ${mood || 'calm'} expression`;
  const profile = presentationProfile && typeof presentationProfile === 'object'
    ? presentationProfile
    : getMoodPresentationProfile({ mood, intensity: 0 });
  return `
    <div class="${wrapperClass} penny-${safeMood}" data-variant="${variant?.index ?? 0}" data-expression-pack="${packId}" data-expression-render-mode="${renderMode}" data-expression-transition="${transitionMode}" data-expression-scene="${escapeHtmlFn(entry.sceneHint || '')}" data-expression-background="${escapeHtmlFn(entry.backgroundHint || '')}" data-expression-secondary-count="${variant?.secondaryVariantCount ?? 0}" data-expression-profile="${escapeHtmlFn(profile.profile || String(mood || 'calm'))}" data-expression-impact="${escapeHtmlFn(profile.impact || 'soft')}" data-expression-closeup="${profile.closeUp ? '1' : '0'}" data-expression-intensity="${Number(profile.intensity || 0)}">
      <img src="${escapeHtmlFn(src)}" data-fallback-src="${escapeHtmlFn(fallbackSrc)}" data-expression-render-mode="${renderMode}" data-expression-transition="${transitionMode}" class="${imageClass}" style="object-position:${escapeHtmlFn(pos)}" alt="${escapeHtmlFn(alt)}" decoding="async" draggable="false" />
      <div class="penny-hud">
        <span class="penny-hud-left">PENNY.EXE</span>
        <span class="penny-hud-right">${escapeHtmlFn(label)}</span>
      </div>
      <div class="penny-hud-bottom">${escapeHtmlFn(String(mood || 'calm').toUpperCase())}</div>
    </div>
  `;
}

export function chatDecorSrcs(index, role, chibiDecor = CHAT_DECOR_CHIBI, techDecor = CHAT_DECOR_TECH) {
  const seed = index * 17 + (role === 'user' ? 11 : 3);
  const tech = techDecor[seed % techDecor.length];
  if (role === 'user') return [tech];
  const chibi = chibiDecor[(seed + 2) % chibiDecor.length];
  return [chibi, tech];
}

export function classifyIdleDecorClass(src = '') {
  if (/pixel-(crystal|blossoms)\.png$/i.test(src)) return 'decor-cyber';
  if (/pixel-/i.test(src)) return 'decor-tech';
  return 'decor-chibi';
}

export function createIdleDecorImage(documentRef, src = '') {
  const img = documentRef.createElement('img');
  img.src = src;
  img.alt = '';
  img.draggable = false;
  img.className = `decor-float decor-screensaver ${classifyIdleDecorClass(src)}`;
  return img;
}

export function createIdleDecorText(documentRef, text = '') {
  const span = documentRef.createElement('span');
  span.className = 'decor-float decor-text decor-screensaver';
  span.textContent = text;
  return span;
}

export function ensureIdleDecorPopulation(container, documentRef, {
  chibiPool = IDLE_DECOR_CHIBI_POOL,
  techPool = IDLE_DECOR_TECH_POOL,
  textPool = IDLE_DECOR_TEXT,
  chibiCount = 5,
  techCount = 4,
  textCount = 3,
} = {}) {
  if (!container || container.dataset.screensaverSeeded === '1') return false;
  container.dataset.screensaverSeeded = '1';

  for (const node of container.querySelectorAll('.decor-float')) {
    node.classList.add('decor-screensaver');
  }

  const extraNodes = [];
  for (let i = 0; i < chibiCount; i += 1) {
    extraNodes.push(createIdleDecorImage(documentRef, chibiPool[i % chibiPool.length]));
  }
  for (let i = 0; i < techCount; i += 1) {
    extraNodes.push(createIdleDecorImage(documentRef, techPool[i % techPool.length]));
  }
  for (let i = 0; i < textCount; i += 1) {
    extraNodes.push(createIdleDecorText(documentRef, textPool[i % textPool.length]));
  }

  for (const node of extraNodes) {
    container.appendChild(node);
  }
  return true;
}

export function measureIdleDecorNode(node) {
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

export function applyIdleDecorFrame(item, timestamp = 0) {
  const sway = Math.sin((timestamp * 0.001 * item.wobbleSpeed) + item.phase) * item.wobble;
  const opacity = Math.max(0.08, Math.min(0.34, item.baseOpacity + Math.cos((timestamp * 0.00075) + item.phase) * 0.028));
  item.node.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) scale(${item.scale.toFixed(3)}) rotate(${(item.rotation + sway).toFixed(2)}deg)`;
  item.node.style.opacity = opacity.toFixed(3);
}

export function syncIdleDecorBounds(container, scrollHost) {
  if (!container || !scrollHost) return false;
  const previousHeight = container.style.height;
  // The decor layer is absolutely positioned, so its old inline height can keep
  // scrollHeight pinned to a long transcript after New Chat clears the messages.
  // Remove that self-reference before measuring the current flow content.
  container.style.height = '';
  const targetHeight = Math.max(scrollHost.scrollHeight, scrollHost.clientHeight);
  const targetWidth = scrollHost.clientWidth;
  if (!targetHeight || !targetWidth) {
    container.style.height = previousHeight;
    return false;
  }
  const nextHeight = `${Math.ceil(targetHeight)}px`;
  const nextWidth = `${Math.ceil(targetWidth)}px`;
  const changed = previousHeight !== nextHeight || container.style.width !== nextWidth;
  container.style.height = nextHeight;
  container.style.width = nextWidth;
  return changed;
}

export function shouldReseedIdleDecorBounds(previous = {}, next = {}, {
  widthThreshold = 48,
  heightThreshold = 96,
  heightRatioThreshold = 0.18,
} = {}) {
  const prevWidth = Number(previous.width) || 0;
  const prevHeight = Number(previous.height) || 0;
  const nextWidth = Number(next.width) || 0;
  const nextHeight = Number(next.height) || 0;
  if (!prevWidth || !prevHeight || !nextWidth || !nextHeight) return true;
  if (Math.abs(nextWidth - prevWidth) > widthThreshold) return true;
  const heightDelta = Math.abs(nextHeight - prevHeight);
  if (heightDelta > heightThreshold && heightDelta / Math.max(prevHeight, 1) > heightRatioThreshold) return true;
  return false;
}

function clampIdleDecorItemsToBounds(items = [], width = 0, height = 0) {
  for (const item of items) {
    const maxX = Math.max(0, width - item.width);
    const maxY = Math.max(0, height - item.height);
    item.x = Math.min(maxX, Math.max(0, item.x));
    item.y = Math.min(maxY, Math.max(0, item.y));
  }
}

export function seedIdleDecorMotion(container, {
  random = Math.random,
  now = () => (typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now()),
} = {}) {
  if (!container) return { width: 0, height: 0, items: [] };
  const bounds = container.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return { width: 0, height: 0, items: [] };

  const items = [];
  const nodes = Array.from(container.querySelectorAll('.decor-float'));
  const currentNow = now();
  for (const node of nodes) {
    const { width, height } = measureIdleDecorNode(node);
    const maxX = Math.max(0, bounds.width - width);
    const maxY = Math.max(0, bounds.height - height);
    const speedX = node.classList.contains('decor-chibi') ? 10 + random() * 5 : node.classList.contains('decor-text') ? 7 + random() * 5 : 11 + random() * 6;
    const speedY = node.classList.contains('decor-chibi') ? 8 + random() * 5 : node.classList.contains('decor-text') ? 6 + random() * 4 : 9 + random() * 5;
    const item = {
      node,
      x: random() * maxX,
      y: random() * maxY,
      vx: speedX * (random() > 0.5 ? 1 : -1),
      vy: speedY * (random() > 0.5 ? 1 : -1),
      width,
      height,
      scale: node.classList.contains('decor-chibi')
        ? 0.7 + random() * 0.32
        : node.classList.contains('decor-text')
          ? 0.84 + random() * 0.22
          : 0.78 + random() * 0.25,
      rotation: -6 + random() * 12,
      spin: -2.6 + random() * 5.2,
      baseOpacity: node.classList.contains('decor-chibi')
        ? 0.16 + random() * 0.13
        : node.classList.contains('decor-text')
          ? 0.12 + random() * 0.08
          : 0.1 + random() * 0.08,
      phase: random() * Math.PI * 2,
      wobble: node.classList.contains('decor-text') ? 0.45 + random() * 0.75 : 0.7 + random() * 1.1,
      wobbleSpeed: 0.45 + random() * 0.75,
    };
    node.style.left = '0px';
    node.style.top = '0px';
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    items.push(item);
    applyIdleDecorFrame(item, currentNow);
  }

  return {
    width: bounds.width,
    height: bounds.height,
    items,
    lastTs: 0,
    rafId: 0,
    resizeTimer: 0,
  };
}

export function bindExpressionImageFallback(img, {
  consoleRef = globalThis.console,
} = {}) {
  if (!img?.addEventListener) return false;
  if (img.dataset?.expressionFallbackBound === '1') return false;
  const primarySrc = normalizeExpressionAssetPath(img.getAttribute?.('src') || img.src || '');
  const fallbackSrc = normalizeExpressionAssetPath(img.dataset?.fallbackSrc || '');
  if (!fallbackSrc || fallbackSrc === primarySrc) return false;
  img.dataset.expressionFallbackBound = '1';

  const onError = () => {
    if (img.dataset.expressionFallbackAttempted === '1') {
      if (img.dataset.expressionFallbackReported !== '1') {
        img.dataset.expressionFallbackReported = '1';
        consoleRef?.error?.('Penny expression image and its legacy fallback both failed to load.');
      }
      return;
    }
    img.dataset.expressionFallbackAttempted = '1';
    img.setAttribute('src', fallbackSrc);
  };

  img.addEventListener('error', onError);
  if (img.complete && !img.naturalWidth) onError();
  return true;
}

export function waitForExpressionImages(containers = [], {
  timeoutMs = 500,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  const images = [...new Set(
    containers
      .filter(Boolean)
      .flatMap((container) => Array.from(container.querySelectorAll?.('.penny-art') || [])),
  )];
  if (!images.length) return Promise.resolve(false);
  if (images.every((img) => img.complete && Number(img.naturalWidth) > 0)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      for (const img of images) img.removeEventListener?.('load', onSettled);
      if (timerId) clearTimeoutImpl?.(timerId);
    };
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ready);
    };
    const onSettled = () => {
      if (images.every((img) => img.complete && Number(img.naturalWidth) > 0)) finish(true);
    };
    for (const img of images) img.addEventListener?.('load', onSettled);
    const timerId = setTimeoutImpl?.(() => finish(
      images.every((img) => img.complete && Number(img.naturalWidth) > 0),
    ), Math.max(0, Number(timeoutMs) || 0));
    onSettled();
  });
}

export function preloadExpressionImage(src, {
  ImageCtor = globalThis.Image,
  timeoutMs = 2000,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  const safeSrc = normalizeExpressionAssetPath(src);
  if (!safeSrc) return Promise.resolve({ ok: false, src: '', image: null, error: 'invalid-asset-path' });
  if (typeof ImageCtor !== 'function') {
    return Promise.resolve({ ok: false, src: safeSrc, image: null, error: 'image-constructor-unavailable' });
  }

  return new Promise((resolve) => {
    const image = new ImageCtor();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timerId) clearTimeoutImpl?.(timerId);
      image.onload = null;
      image.onerror = null;
      resolve({ src: safeSrc, image, ...result });
    };
    image.onload = async () => {
      if (typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch {
          // A completed image remains usable when decode() is unsupported or races cache state.
        }
      }
      finish({ ok: Number(image.naturalWidth) > 0, error: Number(image.naturalWidth) > 0 ? '' : 'zero-natural-width' });
    };
    image.onerror = () => finish({ ok: false, error: 'image-load-failed' });
    const timerId = setTimeoutImpl?.(
      () => finish({ ok: false, error: 'image-load-timeout' }),
      Math.max(0, Number(timeoutMs) || 0),
    );
    image.decoding = 'async';
    image.src = safeSrc;
    if (image.complete && Number(image.naturalWidth) > 0) image.onload();
  });
}

export function createExpressionPackRuntime({
  fetchImpl = globalThis.fetch,
  manifestUrl = DEFAULT_EXPRESSION_PACK_URL,
  defaultPack = createDefaultExpressionPack(),
  ImageCtor = globalThis.Image,
  preloadTimeoutMs = 2000,
  requestIdleCallbackImpl = globalThis.requestIdleCallback,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  let activePack = cloneValue(defaultPack);
  let loadPromise = null;
  const preloadPromises = new Map();
  const preloadRefs = new Map();
  const status = {
    manifestLoaded: false,
    calmReady: false,
    fallbackActive: false,
    preloadedCount: 0,
    lastError: '',
  };

  const preload = (src) => {
    const safeSrc = normalizeExpressionAssetPath(src);
    if (!safeSrc) return Promise.resolve({ ok: false, src: '', image: null, error: 'invalid-asset-path' });
    if (preloadPromises.has(safeSrc)) return preloadPromises.get(safeSrc);
    const promise = preloadExpressionImage(safeSrc, {
      ImageCtor,
      timeoutMs: preloadTimeoutMs,
      setTimeoutImpl,
      clearTimeoutImpl,
    }).then((result) => {
      if (result.image) preloadRefs.set(safeSrc, result.image);
      if (result.ok) status.preloadedCount = [...preloadRefs.values()].filter((image) => Number(image.naturalWidth) > 0).length;
      return result;
    });
    preloadPromises.set(safeSrc, promise);
    return promise;
  };

  const scheduleRemainingPreloads = () => {
    const calmSrc = getMoodAvatarDescriptor(activePack, 'calm').src;
    const remaining = [...new Set(
      MOOD_TAGS
        .map((mood) => getMoodAvatarDescriptor(activePack, mood).src)
        .filter((src) => src && src !== calmSrc),
    )];
    const run = () => {
      for (const src of remaining) preload(src);
    };
    if (typeof requestIdleCallbackImpl === 'function') {
      requestIdleCallbackImpl(run, { timeout: 1000 });
    } else {
      setTimeoutImpl?.(run, 0);
    }
  };

  const prepareCalm = async () => {
    const calm = getMoodAvatarDescriptor(activePack, 'calm');
    const fallbackPromise = calm.fallbackSrc && calm.fallbackSrc !== calm.src
      ? preload(calm.fallbackSrc)
      : null;
    const primary = await preload(calm.src);
    status.calmReady = primary.ok;
    if (!primary.ok && fallbackPromise) {
      const fallback = await fallbackPromise;
      status.fallbackActive = fallback.ok;
      status.lastError = primary.error || 'calm-primary-failed';
    } else if (!primary.ok) {
      status.lastError = primary.error || 'calm-primary-failed';
    }
    scheduleRemainingPreloads();
  };

  return {
    get pack() {
      return activePack;
    },
    get status() {
      return { ...status };
    },
    reset() {
      activePack = cloneValue(defaultPack);
      status.manifestLoaded = false;
      status.calmReady = false;
      status.fallbackActive = false;
      status.preloadedCount = 0;
      status.lastError = '';
      preloadPromises.clear();
      preloadRefs.clear();
      return activePack;
    },
    normalize(manifest) {
      return normalizeExpressionPackManifest(manifest, defaultPack);
    },
    preload,
    async load() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        status.manifestLoaded = false;
        status.calmReady = false;
        status.fallbackActive = false;
        status.lastError = '';
        try {
          const res = await fetchImpl(manifestUrl, { cache: 'no-store' });
          if (!res.ok) throw new Error(`manifest-http-${res.status || 'error'}`);
          const manifest = await res.json();
          activePack = normalizeExpressionPackManifest(manifest, defaultPack);
          status.manifestLoaded = true;
        } catch (error) {
          activePack = cloneValue(defaultPack);
          status.lastError = normalizeString(error?.message, 'manifest-load-failed');
        }
        await prepareCalm();
        return activePack;
      })();
      try {
        return await loadPromise;
      } finally {
        loadPromise = null;
      }
    },
  };
}

export function createIdleDecorRuntime({
  windowRef = globalThis.window,
  container,
  chatWrap,
  random = Math.random,
  now = () => (typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now()),
  chibiPool = IDLE_DECOR_CHIBI_POOL,
  techPool = IDLE_DECOR_TECH_POOL,
  textPool = IDLE_DECOR_TEXT,
} = {}) {
  const documentRef = container?.ownerDocument || globalThis.document;
  const state = {
    rafId: 0,
    lastTs: 0,
    width: 0,
    height: 0,
    items: [],
    resizeTimer: 0,
  };

  function syncBounds() {
    const scrollHost = chatWrap || container?.ownerDocument?.getElementById?.('chatWrap') || container?.parentElement;
    return syncIdleDecorBounds(container, scrollHost);
  }

  function ensurePopulation() {
    return ensureIdleDecorPopulation(container, documentRef, { chibiPool, techPool, textPool });
  }

  function reseed() {
    const next = seedIdleDecorMotion(container, { random, now });
    state.width = next.width;
    state.height = next.height;
    state.items = next.items;
    state.lastTs = 0;
    return state;
  }

  function tick(timestamp) {
    if (!state.items.length) {
      state.rafId = 0;
      return;
    }

    if (!state.lastTs) state.lastTs = timestamp;
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - state.lastTs) / 1000));
    state.lastTs = timestamp;

    if (!container) {
      state.rafId = 0;
      return;
    }

    const boundsChanged = syncBounds();
    const bounds = container.getBoundingClientRect();
    if (bounds.width && bounds.height && boundsChanged) {
      const nextBounds = { width: bounds.width, height: bounds.height };
      if (shouldReseedIdleDecorBounds(state, nextBounds)) {
        reseed();
      } else {
        state.width = bounds.width;
        state.height = bounds.height;
        clampIdleDecorItemsToBounds(state.items, state.width, state.height);
      }
    }

    for (const item of state.items) {
      const maxX = Math.max(0, state.width - item.width);
      const maxY = Math.max(0, state.height - item.height);
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

    state.rafId = windowRef.requestAnimationFrame(tick);
  }

  return {
    state,
    ensurePopulation,
    reseed,
    syncBounds,
    start() {
      if (!container) return false;
      if (windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
      ensurePopulation();
      syncBounds();
      reseed();
      if (!state.rafId) {
        state.lastTs = 0;
        state.rafId = windowRef.requestAnimationFrame(tick);
      }
      return true;
    },
    handleResize() {
      if (!container) return;
      windowRef.clearTimeout(state.resizeTimer);
      state.resizeTimer = windowRef.setTimeout(() => {
        reseed();
      }, 120);
    },
    stop() {
      if (state.rafId) {
        windowRef.cancelAnimationFrame(state.rafId);
        state.rafId = 0;
      }
      if (state.resizeTimer) {
        windowRef.clearTimeout(state.resizeTimer);
        state.resizeTimer = 0;
      }
    },
  };
}
