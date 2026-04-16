const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-expression-runtime.mjs');

test('default expression pack keeps the eight-mood contract and calm fallback', async () => {
  const { createDefaultExpressionPack, MOOD_TAGS } = await helpersPromise;
  const pack = createDefaultExpressionPack();

  assert.deepEqual(pack.contract, MOOD_TAGS);
  assert.equal(pack.fallbackMood, 'calm');
  assert.equal(Object.keys(pack.moods).length, 8);
  assert.equal(pack.moods.calm.variants.length, 2);
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
  assert.equal(label, 'HOLD ON');
  assert.deepEqual(chatDecorSrcs(0, 'user'), ['/sprites/decor/pixel-monitor.png']);
  assert.deepEqual(chatDecorSrcs(0, 'assistant'), ['/sprites/decor/chibi-penny-peace.png', '/sprites/decor/pixel-crystal.png']);
  assert.equal(classifyIdleDecorClass('/sprites/decor/pixel-crystal.png'), 'decor-cyber');
});

test('presentation profiles sharpen mood contrast without changing the mood contract', async () => {
  const { getMoodPresentationProfile } = await helpersPromise;

  const calm = getMoodPresentationProfile({ mood: 'calm', intensity: 0 });
  const surprised = getMoodPresentationProfile({ mood: 'surprised', intensity: 2, previousMood: 'calm' });

  assert.equal(calm.impact, 'soft');
  assert.equal(calm.closeUp, false);
  assert.equal(surprised.variantIndex, 1);
  assert.equal(surprised.closeUp, true);
  assert.ok(surprised.burstCount > calm.burstCount);
  assert.ok(surprised.glitchMs > calm.glitchMs);
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
