const defaultFs = require('fs');
const defaultPath = require('path');

function normalizePromptAssetText(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').trim();
}

function createPromptAssetCache() {
  return new Map();
}

function resolvePromptAssetPath(relativeOrAbsolutePath, path = defaultPath) {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(__dirname, relativeOrAbsolutePath);
}

function readPromptAsset(relativeOrAbsolutePath, fallback = '', {
  fs = defaultFs,
  path = defaultPath,
  cache = createPromptAssetCache(),
  normalizeText = normalizePromptAssetText,
} = {}) {
  const assetPath = resolvePromptAssetPath(relativeOrAbsolutePath, path);
  try {
    const stat = fs.statSync(assetPath);
    const cached = cache?.get?.(assetPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.text;
    const text = normalizeText(fs.readFileSync(assetPath, 'utf8'));
    cache?.set?.(assetPath, { mtimeMs: stat.mtimeMs, text });
    return text || normalizeText(fallback);
  } catch {
    return normalizeText(fallback);
  }
}

function readPromptJsonAsset(relativeOrAbsolutePath, fallback = [], options = {}) {
  const fs = options.fs || defaultFs;
  const path = options.path || defaultPath;
  const cache = options.cache || createPromptAssetCache();
  const normalizeText = options.normalizeText || normalizePromptAssetText;
  const assetPath = resolvePromptAssetPath(relativeOrAbsolutePath, path);

  try {
    const stat = fs.statSync(assetPath);
    const cached = cache?.get?.(assetPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }
    const raw = normalizeText(fs.readFileSync(assetPath, 'utf8'));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) return fallback;
    cache?.set?.(assetPath, { mtimeMs: stat.mtimeMs, value: parsed });
    return parsed;
  } catch {
    return fallback;
  }
}

function getPennyVoiceAssets({
  fs = defaultFs,
  path = defaultPath,
  cache = createPromptAssetCache(),
  voiceDir = '',
  fallbacks = {},
} = {}) {
  const baseDir = String(voiceDir || '').trim();
  if (!baseDir) {
    return {
      blend: normalizePromptAssetText(fallbacks.blend || ''),
      chatDirectives: normalizePromptAssetText(fallbacks.chatDirectives || ''),
      examples: normalizePromptAssetText(fallbacks.examples || ''),
      overlays: Array.isArray(fallbacks.overlays) ? fallbacks.overlays.slice() : [],
    };
  }

  return {
    blend: readPromptAsset(path.join(baseDir, 'runtime', 'penny-operational-blend.md'), fallbacks.blend || '', {
      fs,
      path,
      cache,
    }),
    chatDirectives: readPromptAsset(path.join(baseDir, 'runtime', 'penny-chat-directives.md'), fallbacks.chatDirectives || '', {
      fs,
      path,
      cache,
    }),
    examples: readPromptAsset(path.join(baseDir, 'runtime', 'penny-voice-examples.md'), fallbacks.examples || '', {
      fs,
      path,
      cache,
    }),
    overlays: readPromptJsonAsset(path.join(baseDir, 'runtime', 'penny-overlays.json'), Array.isArray(fallbacks.overlays) ? fallbacks.overlays : [], {
      fs,
      path,
      cache,
    }),
  };
}

function createPromptAssetLoader({
  fs = defaultFs,
  path = defaultPath,
  cache = createPromptAssetCache(),
  voiceDir = '',
  fallbacks = {},
} = {}) {
  return {
    cache,
    normalizePromptAssetText,
    resolvePromptAssetPath: (relativeOrAbsolutePath) => resolvePromptAssetPath(relativeOrAbsolutePath, path),
    readPromptAsset: (relativeOrAbsolutePath, fallback = '') => readPromptAsset(relativeOrAbsolutePath, fallback, { fs, path, cache }),
    readPromptJsonAsset: (relativeOrAbsolutePath, fallback = []) => readPromptJsonAsset(relativeOrAbsolutePath, fallback, { fs, path, cache }),
    getPennyVoiceAssets: () => getPennyVoiceAssets({ fs, path, cache, voiceDir, fallbacks }),
  };
}

module.exports = {
  normalizePromptAssetText,
  createPromptAssetCache,
  resolvePromptAssetPath,
  readPromptAsset,
  readPromptJsonAsset,
  getPennyVoiceAssets,
  createPromptAssetLoader,
};
