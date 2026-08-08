const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helpersPromise = import('../public/js/penny-expression-runtime.mjs');

const BAKED_CHECKERBOARD_CHIBIS = [
  '/sprites/decor/chibi-avatar-surprised.png',
  '/sprites/decor/chibi-penny-heart.png',
  '/sprites/decor/chibi-penny-think.png',
  '/sprites/decor/chibi-penny-wink.png',
];

test('default expression pack keeps the eight-mood contract and calm fallback', async () => {
  const { createDefaultExpressionPack, MOOD_TAGS } = await helpersPromise;
  const pack = createDefaultExpressionPack();

  assert.deepEqual(pack.contract, MOOD_TAGS);
  assert.equal(pack.fallbackMood, 'calm');
  assert.equal(Object.keys(pack.moods).length, 8);
  assert.equal(pack.moods.calm.variants.length, 1);
  assert.equal(pack.moods.calm.secondaryVariants.length, 2);
});

test('manifest normalization preserves the contract and merges mood overrides safely', async () => {
  const { createDefaultExpressionPack, normalizeExpressionPackManifest } = await helpersPromise;
  const pack = normalizeExpressionPackManifest({
    id: 'custom-pack',
    name: 'Custom Pack',
    version: '2',
    fallbackMood: 'bogus',
    source: 'unit-test',
    moods: {
      calm: {
        avatar: { src: '/sprites/decor/chibi-avatar-calm.png', alt: 'Calm alt' },
        backgroundHint: '/sprites/custom-calm.png',
      },
      flirty: {
        secondaryVariants: [
          { src: '/sprites/custom-flirty.png', label: 'custom', pill: 'custom', pos: '50% 50%' },
        ],
      },
    },
  }, createDefaultExpressionPack());

  assert.equal(pack.id, 'custom-pack');
  assert.equal(pack.name, 'Custom Pack');
  assert.equal(pack.version, 2);
  assert.equal(pack.fallbackMood, 'calm');
  assert.deepEqual(pack.contract, ['calm', 'happy', 'excited', 'thinking', 'surprised', 'flirty', 'smug', 'annoyed']);
  assert.equal(pack.source, 'unit-test');
  assert.equal(pack.moods.calm.backgroundHint, '/sprites/custom-calm.png');
  assert.equal(pack.moods.flirty.secondaryVariants[0].src, '/sprites/custom-flirty.png');
});

test('registered composite manifest normalizes exact modes, local fallbacks, and one variant per mood', async () => {
  const {
    createDefaultExpressionPack,
    normalizeExpressionPackManifest,
    getMoodAvatarDescriptor,
    getMoodSpriteVariants,
    MOOD_TAGS,
  } = await helpersPromise;
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'penny-2d25d-v1.4', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pack = normalizeExpressionPackManifest(manifest, createDefaultExpressionPack());

  assert.equal(pack.id, 'penny-2d25d-eight-mood-v1.4');
  assert.equal(pack.renderMode, 'registered-composite');
  assert.equal(pack.transitionMode, 'atomic-fade-swap');
  assert.equal(pack.integrity, '/sprites/packs/penny-2d25d-v1.4/integrity.json');
  assert.deepEqual(pack.contract, MOOD_TAGS);
  for (const mood of MOOD_TAGS) {
    const avatar = getMoodAvatarDescriptor(pack, mood);
    const variants = getMoodSpriteVariants(pack, mood);
    assert.equal(variants.length, 1, `${mood} must remain deterministic`);
    assert.equal(avatar.src, `/sprites/packs/penny-2d25d-v1.4/composites/${mood}.png`);
    assert.notEqual(avatar.fallbackSrc, avatar.src);
    assert.equal(avatar.renderMode, 'registered-composite');
    assert.equal(avatar.transitionMode, 'atomic-fade-swap');
  }
});

test('expression mode precedence is descriptor then mood then pack with safe legacy fallback', async () => {
  const {
    createDefaultExpressionPack,
    normalizeExpressionPackManifest,
  } = await helpersPromise;
  const pack = normalizeExpressionPackManifest({
    renderMode: 'registered-composite',
    transitionMode: 'atomic-fade-swap',
    moods: {
      calm: {
        renderMode: 'legacy-chibi',
        avatar: {
          src: '/sprites/custom/avatar.png',
          renderMode: 'registered-composite',
        },
        variants: [{
          src: '/sprites/custom/variant.png',
          renderMode: 'bogus-mode',
          transitionMode: 'bogus-transition',
        }],
      },
    },
  }, createDefaultExpressionPack());

  assert.equal(pack.moods.calm.renderMode, 'legacy-chibi');
  assert.equal(pack.moods.calm.avatar.renderMode, 'registered-composite');
  assert.equal(pack.moods.calm.variants[0].renderMode, 'legacy-chibi');
  assert.equal(pack.moods.calm.variants[0].transitionMode, 'atomic-fade-swap');
});

test('expression URL normalization rejects remote, drive, data, and traversal paths', async () => {
  const {
    isSafePublicAssetPath,
    normalizeExpressionAssetPath,
  } = await helpersPromise;

  assert.equal(isSafePublicAssetPath('/sprites/packs/example/calm.png'), true);
  assert.equal(isSafePublicAssetPath('/sprites/../private.txt'), false);
  assert.equal(isSafePublicAssetPath('/sprites/%2e%2e/private.txt'), false);
  assert.equal(isSafePublicAssetPath('file:///tmp/calm.png'), false);
  assert.equal(isSafePublicAssetPath('data:image/png;base64,abc'), false);
  assert.equal(isSafePublicAssetPath('https://example.com/calm.png'), false);
  assert.equal(isSafePublicAssetPath('C:\\temp\\calm.png'), false);
  assert.equal(
    normalizeExpressionAssetPath('https://example.com/calm.png', '/sprites/decor/chibi-avatar-calm.png'),
    '/sprites/decor/chibi-avatar-calm.png',
  );
});

test('public default manifest leads with clean mood-specific chibis and retains Pen2 variants for every mood', async () => {
  const {
    DEFAULT_EXPRESSION_PACK_URL,
    LEGACY_EXPRESSION_PACK_URL,
    createDefaultExpressionPack,
    normalizeExpressionPackManifest,
    MOOD_TAGS,
    getMoodAvatarSrc,
    getMoodSpriteVariants,
    getMoodSpriteVariant,
    getMoodPresentationProfile,
    buildCompanionFaceHtml,
    CHIBI_PRIMARY_FRAMING,
  } = await helpersPromise;
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'default', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pack = normalizeExpressionPackManifest(manifest, createDefaultExpressionPack());
  assert.equal(DEFAULT_EXPRESSION_PACK_URL, LEGACY_EXPRESSION_PACK_URL);

  for (const mood of MOOD_TAGS) {
    const variants = getMoodSpriteVariants(pack, mood);
    assert.equal(
      variants.some((variant) => variant.src.includes('/sprites/penny-mood-')),
      false,
      `${mood} main sprite rotation should not include legacy wide mood panels`,
    );
    assert.equal(
      variants.some((variant) => BAKED_CHECKERBOARD_CHIBIS.includes(variant.src)),
      false,
      `${mood} main sprite rotation should not include baked-checkerboard chibi sprites`,
    );
    assert.equal(getMoodAvatarSrc(pack, mood), variants[0].src, `${mood} primary avatar should be its first rotation sprite`);
    assert.equal(getMoodAvatarSrc(pack, mood), `/sprites/packs/default/chibi/${mood}.png`, `${mood} primary avatar should be its cleaned chibi`);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'public', getMoodAvatarSrc(pack, mood))), true, `${mood} primary chibi file should ship`);
    assert.equal(pack.moods[mood].avatar.scale, CHIBI_PRIMARY_FRAMING[mood].scale, `${mood} avatar should carry its authored presentation scale`);
    assert.equal(pack.moods[mood].avatar.shot, CHIBI_PRIMARY_FRAMING[mood].shot, `${mood} avatar should carry its authored camera shot`);
    assert.equal(variants[0].scale, CHIBI_PRIMARY_FRAMING[mood].scale, `${mood} primary pose should carry its authored presentation scale`);
    assert.equal(variants[0].shot, CHIBI_PRIMARY_FRAMING[mood].shot, `${mood} primary pose should carry its authored camera shot`);
    assert.ok(variants.some((variant) => variant.src.includes('/sprites/packs/pen2/')), `${mood} rotation should retain Pen2 art`);

    const selectedSrcs = new Set();
    for (let seed = 0; seed < variants.length; seed += 1) {
      const profile = getMoodPresentationProfile({
        mood,
        intensity: 0,
        variantCount: variants.length,
        cycleSeed: seed,
      });
      selectedSrcs.add(getMoodSpriteVariant(pack, mood, profile.variantIndex).src);
    }

    for (const variant of variants) {
      assert.ok(selectedSrcs.has(variant.src), `${mood} should be able to select ${variant.src}`);
    }
  }

  const smugVariants = getMoodSpriteVariants(pack, 'smug');
  const smugPen2Index = smugVariants.findIndex((variant) => variant.src.includes('/sprites/packs/pen2/'));
  const html = buildCompanionFaceHtml({
    pack,
    mood: 'smug',
    variantIndex: smugPen2Index,
  });
  assert.match(html, /\/sprites\/packs\/pen2\/pen2-smug-/);
});

test('companion face output bounds untrusted sprite framing and carries authored pose framing', async () => {
  const {
    buildCompanionFaceHtml,
    createDefaultExpressionPack,
    normalizeSpriteScale,
    normalizeSpriteShot,
  } = await helpersPromise;

  assert.equal(normalizeSpriteScale('not-a-number'), 1.3);
  assert.equal(normalizeSpriteScale(0.1), 0.9);
  assert.equal(normalizeSpriteScale(9), 2.1);
  assert.equal(normalizeSpriteShot('close'), 'close');
  assert.equal(normalizeSpriteShot('bogus'), 'wide');

  const html = buildCompanionFaceHtml({
    pack: createDefaultExpressionPack(),
    mood: 'excited',
    variantIndex: 0,
  });
  assert.match(html, /data-expression-shot="medium"/);
  assert.match(html, /data-expression-sprite-scale="1\.38"/);
  assert.match(html, /--penny-chibi-scale:1\.38/);
});

test('decor chibi pools exclude baked-checkerboard assets', async () => {
  const {
    CHAT_DECOR_CHIBI,
    IDLE_DECOR_CHIBI_POOL,
    createDefaultExpressionPack,
    getMoodAvatarSrc,
    normalizeExpressionPackManifest,
  } = await helpersPromise;
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'default', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pack = normalizeExpressionPackManifest(manifest, createDefaultExpressionPack());
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  for (const src of BAKED_CHECKERBOARD_CHIBIS) {
    assert.equal(CHAT_DECOR_CHIBI.includes(src), false, `${src} should not be used as chat decor`);
    assert.equal(IDLE_DECOR_CHIBI_POOL.includes(src), false, `${src} should not be used as idle decor`);
    assert.equal(indexHtml.includes(src), false, `${src} should not be hardcoded into index decor`);
  }
  assert.equal(BAKED_CHECKERBOARD_CHIBIS.includes(getMoodAvatarSrc(pack, 'surprised')), false);
  assert.equal(indexHtml.includes('/sprites/decor/chibi-'), false, 'static decor should use the cleaned catalog, not raw rectangular source art');
});

test('mood helpers pick the latest tag, theme, avatar, and decor sources', async () => {
  const {
    createDefaultExpressionPack,
    parseMood,
    stripDraftMood,
    getMoodTheme,
    getMoodAvatarSrc,
    getMoodSpriteVariant,
    pickChibiHudLabel,
    chatDecorSrcs,
    classifyIdleDecorClass,
  } = await helpersPromise;

  const pack = createDefaultExpressionPack();
  const parsed = parseMood('Still thinking [MOOD:calm] but now [MOOD:smug]', 'happy');
  const stripped = stripDraftMood('Draft reply [MOOD:smug]');
  const variant = getMoodSpriteVariant(pack, 'thinking');
  const label = pickChibiHudLabel(pack, 'thinking', () => 0.99);

  assert.equal(parsed.mood, 'smug');
  assert.equal(parsed.text, 'Still thinkingbut now');
  assert.equal(stripped, 'Draft reply');
  assert.equal(getMoodTheme('thinking').label, 'thinking');
  assert.equal(getMoodAvatarSrc(pack, 'unknown-mood'), '/sprites/packs/default/chibi/calm.png');
  assert.equal(variant.sceneHint, 'focused');
  assert.equal(variant.backgroundHint, '/sprites/penny-mood-thinking.png');
  assert.equal(variant.secondaryVariantCount, 2);
  assert.equal(label, 'LOCKED IN');
  assert.deepEqual(chatDecorSrcs(0, 'user'), ['/sprites/decor/pixel-monitor.png']);
  assert.deepEqual(chatDecorSrcs(0, 'assistant'), ['/sprites/packs/default/chibi/happy.png', '/sprites/decor/pixel-crystal.png']);
  assert.equal(classifyIdleDecorClass('/sprites/decor/pixel-crystal.png'), 'decor-cyber');
});

test('idle decor bounds tolerate composer height changes without reseeding the sprite field', async () => {
  const { shouldReseedIdleDecorBounds } = await helpersPromise;

  assert.equal(
    shouldReseedIdleDecorBounds({ width: 900, height: 620 }, { width: 900, height: 650 }),
    false,
  );
  assert.equal(
    shouldReseedIdleDecorBounds({ width: 900, height: 620 }, { width: 900, height: 716 }),
    false,
  );
  assert.equal(
    shouldReseedIdleDecorBounds({ width: 900, height: 620 }, { width: 900, height: 820 }),
    true,
  );
  assert.equal(
    shouldReseedIdleDecorBounds({ width: 900, height: 620 }, { width: 780, height: 620 }),
    true,
  );
});

test('idle decor bounds shrink after a long transcript is cleared for a new chat', async () => {
  const { syncIdleDecorBounds } = await helpersPromise;
  const container = {
    style: {
      height: '4200px',
      width: '900px',
    },
  };
  const scrollHost = {
    clientHeight: 620,
    clientWidth: 900,
    get scrollHeight() {
      const decorHeight = Number.parseInt(container.style.height, 10) || 0;
      return Math.max(620, decorHeight);
    },
  };

  assert.equal(syncIdleDecorBounds(container, scrollHost), true);
  assert.equal(container.style.height, '620px');
  assert.equal(container.style.width, '900px');
});

test('main app keeps the chatbox cyber-decor animation CSS without the reseeding screensaver runtime', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'penny-app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

  assert.match(appJs, /syncIdleDecorBounds as syncIdleDecorBoundsRuntime/);
  assert.match(appJs, /syncStaticCyberDecorBounds/);
  assert.equal(appJs.includes('createIdleDecorRuntime'), false);
  assert.equal(appJs.includes('startIdleDecorScreensaver'), false);
  assert.match(css, /\.decor-float\s*\{[^}]*animation:\s*decorDrift\s+22s/s);
  assert.match(css, /\.decor-float\.decor-screensaver\s*\{[^}]*animation:\s*none;/s);
});

test('presentation profiles sharpen mood contrast without changing the mood contract', async () => {
  const { getMoodPresentationProfile } = await helpersPromise;

  const calm = getMoodPresentationProfile({ mood: 'calm', intensity: 0 });
  const surprised = getMoodPresentationProfile({ mood: 'surprised', intensity: 2, previousMood: 'calm' });
  const cycled = getMoodPresentationProfile({ mood: 'happy', intensity: 0, variantCount: 5, cycleSeed: 4 });

  assert.equal(calm.impact, 'soft');
  assert.equal(calm.closeUp, false);
  assert.equal(surprised.variantIndex, 1);
  assert.equal(surprised.closeUp, true);
  assert.ok(surprised.burstCount > calm.burstCount);
  assert.ok(surprised.glitchMs > calm.glitchMs);
  assert.equal(cycled.variantIndex, 4);
});

test('expression pack runtime loads a manifest and falls back cleanly on failure', async () => {
  const { createExpressionPackRuntime } = await helpersPromise;

  const runtime = createExpressionPackRuntime({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        id: 'loaded-pack',
        fallbackMood: 'happy',
        moods: {
          happy: {
            avatar: '/sprites/decor/chibi-avatar-happy.png',
            backgroundHint: '/sprites/loaded-happy.png',
          },
        },
      }),
    }),
  });

  const pack = await runtime.load();
  assert.equal(pack.id, 'loaded-pack');
  assert.equal(pack.fallbackMood, 'happy');
  assert.equal(runtime.pack.id, 'loaded-pack');

  const fallbackRuntime = createExpressionPackRuntime({
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  });
  const fallbackPack = await fallbackRuntime.load();
  assert.equal(fallbackPack.id, 'default');
  assert.equal(fallbackPack.moods.calm.avatar.src, '/sprites/packs/default/chibi/calm.png');
});

test('expression pack runtime preloads calm and exposes bounded readiness status', async () => {
  const { createExpressionPackRuntime } = await helpersPromise;
  class FakeImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
    }

    set src(value) {
      this._src = value;
      this.complete = true;
      this.naturalWidth = 1024;
      queueMicrotask(() => this.onload?.());
    }

    get src() {
      return this._src;
    }

    decode() {
      return Promise.resolve();
    }
  }
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'penny-2d25d-v1.4', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const idleCallbacks = [];
  const runtime = createExpressionPackRuntime({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    ImageCtor: FakeImage,
    requestIdleCallbackImpl: (callback) => idleCallbacks.push(callback),
  });

  const pack = await runtime.load();
  assert.equal(pack.id, 'penny-2d25d-eight-mood-v1.4');
  assert.equal(runtime.status.manifestLoaded, true);
  assert.equal(runtime.status.calmReady, true);
  assert.equal(runtime.status.fallbackActive, false);
  assert.equal(runtime.status.preloadedCount, 2);
  assert.equal(idleCallbacks.length, 1);
  idleCallbacks[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(runtime.status.preloadedCount, 9);
});

test('image fallback swaps once and reports a second failure without looping', async () => {
  const { bindExpressionImageFallback } = await helpersPromise;
  const listeners = new Map();
  const logged = [];
  const img = {
    complete: false,
    naturalWidth: 0,
    dataset: {
      fallbackSrc: '/sprites/decor/chibi-avatar-calm.png',
    },
    attributes: {
      src: '/sprites/packs/penny-2d25d-v1.4/composites/calm.png',
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    getAttribute(name) {
      return this.attributes[name] || '';
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };

  assert.equal(bindExpressionImageFallback(img, { consoleRef: { error: (message) => logged.push(message) } }), true);
  listeners.get('error')();
  assert.equal(img.attributes.src, '/sprites/decor/chibi-avatar-calm.png');
  listeners.get('error')();
  assert.equal(img.attributes.src, '/sprites/decor/chibi-avatar-calm.png');
  assert.equal(logged.length, 1);
});

test('expression decision helpers normalize mood tags and capture override metadata', async () => {
  const { normalizeMoodTag, buildExpressionDecisionRecord, EXPRESSION_DECISION_VERSION } = await helpersPromise;

  assert.equal(normalizeMoodTag('SMUG'), 'smug');
  assert.equal(normalizeMoodTag('bogus'), '');

  const decision = buildExpressionDecisionRecord({
    mood: 'flirty',
    decisionSource: 'manual-override',
    decisionReason: 'Manual override pinned Penny to flirty.',
    manualOverride: 'flirty',
    persistedMood: 'flirty',
  });

  assert.equal(decision.version, EXPRESSION_DECISION_VERSION);
  assert.equal(decision.mood, 'flirty');
  assert.equal(decision.decisionSource, 'manual-override');
  assert.equal(decision.manualOverride, 'flirty');
  assert.equal(decision.persistedMood, 'flirty');
});

test('companion face html carries presentation profile hooks for the UI runtime', async () => {
  const {
    createDefaultExpressionPack,
    buildCompanionFaceHtml,
    getMoodPresentationProfile,
  } = await helpersPromise;

  const profile = getMoodPresentationProfile({ mood: 'flirty', intensity: 2, previousMood: 'happy' });
  const html = buildCompanionFaceHtml({
    pack: createDefaultExpressionPack(),
    mood: 'flirty',
    variantIndex: profile.variantIndex,
    presentationProfile: profile,
  });

  assert.match(html, /data-expression-profile="flirty"/);
  assert.match(html, /data-expression-impact="close"/);
  assert.match(html, /data-expression-closeup="1"/);
});

test('companion face html carries a fallback sprite for failed selected art loads', async () => {
  const {
    createDefaultExpressionPack,
    buildCompanionFaceHtml,
    getMoodPresentationProfile,
  } = await helpersPromise;

  const profile = getMoodPresentationProfile({ mood: 'calm', intensity: 0, variantCount: 4, cycleSeed: 1 });
  const html = buildCompanionFaceHtml({
    pack: createDefaultExpressionPack(),
    mood: 'calm',
    variantIndex: profile.variantIndex,
    presentationProfile: profile,
  });

  assert.match(html, /class="penny-art penny-art-chibi"/);
  assert.match(html, /data-fallback-src="\/sprites\/packs\/pen2\/pen2-calm-composed\.png"/);
});

test('registered companion face HTML uses internal classes and a distinct legacy fallback', async () => {
  const {
    createDefaultExpressionPack,
    normalizeExpressionPackManifest,
    buildCompanionFaceHtml,
  } = await helpersPromise;
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'penny-2d25d-v1.4', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pack = normalizeExpressionPackManifest(manifest, createDefaultExpressionPack());
  const html = buildCompanionFaceHtml({
    pack,
    mood: 'flirty',
  });

  assert.match(html, /class="penny-display penny-chibi penny-registered-composite penny-flirty"/);
  assert.match(html, /class="penny-art penny-art-registered-composite"/);
  assert.match(html, /data-expression-render-mode="registered-composite"/);
  assert.match(html, /data-expression-transition="atomic-fade-swap"/);
  assert.match(html, /src="\/sprites\/packs\/penny-2d25d-v1\.4\/composites\/flirty\.png"/);
  assert.match(html, /data-fallback-src="\/sprites\/decor\/chibi-avatar-flirty\.png"/);
  assert.match(html, /decoding="async"/);
});

test('main app transition source keeps a monotonic latest-wins generation guard', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'penny-app.js'), 'utf8');
  assert.match(appJs, /let _spriteTransitionGeneration = 0;/);
  assert.match(appJs, /const transitionGeneration = \+\+_spriteTransitionGeneration;/);
  assert.ok(
    (appJs.match(/transitionGeneration !== _spriteTransitionGeneration/g) || []).length >= 2,
    'both swap and settle timers must reject stale generations',
  );
});
