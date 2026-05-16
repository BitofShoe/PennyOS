const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createPromptAssetLoader,
  readPromptAsset,
  readPromptJsonAsset,
} = require('../lib/penny-prompt-assets');

function makeTempVoiceDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-prompt-assets-'));
  const runtimeDir = path.join(root, 'penny-voice', 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  return { root, runtimeDir };
}

test('prompt assets normalize text, read json, and reuse cache entries', () => {
  const { runtimeDir } = makeTempVoiceDir();
  const blendFile = path.join(runtimeDir, 'penny-operational-blend.md');
  const directivesFile = path.join(runtimeDir, 'penny-chat-directives.md');
  const examplesFile = path.join(runtimeDir, 'penny-voice-examples.md');
  const overlaysFile = path.join(runtimeDir, 'penny-overlays.json');

  fs.writeFileSync(blendFile, '  blend line  \r\n');
  fs.writeFileSync(directivesFile, 'directive line\n');
  fs.writeFileSync(examplesFile, 'example line\n');
  fs.writeFileSync(overlaysFile, JSON.stringify([{ id: 'overlay-1', text: 'Hi', enabled: true }], null, 2));

  const loader = createPromptAssetLoader({
    fs,
    path,
    cache: new Map(),
    voiceDir: path.join(runtimeDir, '..'),
    fallbacks: {
      blend: 'fallback blend',
      chatDirectives: 'fallback directives',
      examples: 'fallback examples',
      overlays: [],
    },
  });

  const first = loader.getPennyVoiceAssets();
  assert.equal(first.blend, 'blend line');
  assert.equal(first.chatDirectives, 'directive line');
  assert.equal(first.examples, 'example line');
  assert.deepEqual(first.overlays, [{ id: 'overlay-1', text: 'Hi', enabled: true }]);

  const cachedBlend = readPromptAsset(blendFile, 'fallback blend', {
    fs,
    path,
    cache: loader.cache,
  });
  const cachedBlendAgain = readPromptAsset(blendFile, 'fallback blend', {
    fs,
    path,
    cache: loader.cache,
  });
  assert.equal(cachedBlend, 'blend line');
  assert.equal(cachedBlendAgain, 'blend line');

  const cachedJson = readPromptJsonAsset(overlaysFile, [], {
    fs,
    path,
    cache: loader.cache,
  });
  assert.deepEqual(cachedJson, [{ id: 'overlay-1', text: 'Hi', enabled: true }]);
});

test('prompt asset loaders fall back cleanly when files are missing or invalid', () => {
  const missingLoader = createPromptAssetLoader({
    fs,
    path,
    cache: new Map(),
    voiceDir: path.join(os.tmpdir(), 'does-not-exist'),
    fallbacks: {
      blend: 'fallback blend',
      chatDirectives: 'fallback directives',
      examples: 'fallback examples',
      overlays: [{ id: 'fallback-overlay', text: 'Fallback', enabled: true }],
    },
  });

  const assets = missingLoader.getPennyVoiceAssets();
  assert.equal(assets.blend, 'fallback blend');
  assert.equal(assets.chatDirectives, 'fallback directives');
  assert.equal(assets.examples, 'fallback examples');
  assert.deepEqual(assets.overlays, [{ id: 'fallback-overlay', text: 'Fallback', enabled: true }]);
});
