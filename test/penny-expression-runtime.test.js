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

test('default manifest appends Pen2 variants that can be selected for every mood', async () => {
  const {
    createDefaultExpressionPack,
    normalizeExpressionPackManifest,
    MOOD_TAGS,
    getMoodSpriteVariants,
    getMoodSpriteVariant,
    getMoodPresentationProfile,
    buildCompanionFaceHtml,
  } = await helpersPromise;
  const manifestPath = path.join(__dirname, '..', 'public', 'sprites', 'packs', 'default', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pack = normalizeExpressionPackManifest(manifest, createDefaultExpressionPack());

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
    assert.ok(
      variants.some((variant) => variant.src.includes('/sprites/decor/chibi-')),
      `${mood} should keep at least one old chibi sprite in rotation`,
    );
    const pen2Variants = variants.filter((variant) => variant.src.includes('/sprites/packs/pen2/'));
    assert.ok(pen2Variants.length > 0, `${mood} should include at least one Pen2 sprite`);

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

    for (const variant of pen2Variants) {
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
  assert.equal(getMoodAvatarSrc(pack, 'unknown-mood'), '/sprites/decor/chibi-avatar-calm.png');
  assert.equal(variant.sceneHint, 'focused');
  assert.equal(variant.backgroundHint, '/sprites/penny-mood-thinking.png');
  assert.equal(variant.secondaryVariantCount, 2);
  assert.equal(label, 'LOCKED IN');
  assert.deepEqual(chatDecorSrcs(0, 'user'), ['/sprites/decor/pixel-monitor.png']);
  assert.deepEqual(chatDecorSrcs(0, 'assistant'), ['/sprites/decor/chibi-penny-peace.png', '/sprites/decor/pixel-crystal.png']);
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

test('main app keeps the chatbox cyber-decor layer static during normal renders', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'penny-app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

  assert.equal(appJs.includes('createIdleDecorRuntime'), false);
  assert.equal(appJs.includes('startIdleDecorScreensaver'), false);
  assert.match(css, /\.decor-float\s*\{[^}]*animation:\s*none;/s);
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
  assert.equal(fallbackPack.moods.calm.avatar.src, '/sprites/decor/chibi-avatar-calm.png');
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
