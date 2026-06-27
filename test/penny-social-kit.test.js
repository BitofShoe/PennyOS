const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const {
  buildSocialKit,
  discoverMarketingVideos,
  loadSocialKitManifest,
  normalizeRelativePath,
} = require('../scripts/build-penny-social-kit');

function touchFile(filePath, body = 'asset') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

test('social kit manifest points at public-safe assets and disclosures', () => {
  const manifest = loadSocialKitManifest({ rootDir: ROOT });

  assert.equal(manifest.schema, 'pennyos-social-kit.v1');
  assert.ok(manifest.disclosures.some((item) => /adult users/i.test(item)));
  assert.ok(manifest.disclosures.some((item) => /does not bundle/i.test(item)));
  assert.ok(manifest.assets.length >= 8);

  const disallowed = /(review-experience|voice-redo|memory-qa|runtime-fit|model-eval|browser-smoke|tauri-consumer-smoke|clean-proof|receipt|\.env|penny-memory\.json)/i;

  for (const asset of manifest.assets) {
    assert.ok(asset.id, 'asset id is required');
    assert.ok(asset.alt, `${asset.id} needs alt text`);
    assert.doesNotMatch(normalizeRelativePath(asset.source), disallowed, `${asset.id} should not point at private QA or proof material`);
    if (!asset.optional) {
      assert.ok(fs.existsSync(path.join(ROOT, asset.source)), `${asset.source} exists`);
    }
  }
});

test('discoverMarketingVideos finds PennyOS product videos and ignores QA receipts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-social-videos-'));
  try {
    touchFile(path.join(root, 'output', 'pennyos-product-video-2026-05-19', 'pennyos-product-video-v8.mp4'));
    touchFile(path.join(root, 'output', 'pennyos-product-demo-2026-06-21', 'pennyos-social-demo.mp4'));
    touchFile(path.join(root, 'output', 'tauri-consumer-smoke', 'pennyos-installer-proof.mp4'));
    touchFile(path.join(root, 'output', 'playwright', 'penny-browser-smoke-2026.png'));

    const videos = discoverMarketingVideos({ rootDir: root }).map((item) => item.source);

    assert.deepEqual(videos, [
      'output/pennyos-product-demo-2026-06-21/pennyos-social-demo.mp4',
      'output/pennyos-product-video-2026-05-19/pennyos-product-video-v8.mp4',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildSocialKit writes a polished share folder without private clutter', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-social-kit-'));
  const outDir = path.join(root, 'output', 'pennyos-social-kit');

  try {
    const manifest = {
      schema: 'pennyos-social-kit.v1',
      title: 'PennyOS Social Kit',
      tagline: 'A local companion with teeth.',
      oneLiner: 'PennyOS is a source-available technical preview for a local-first AI companion runtime.',
      disclosures: [
        'PennyOS is intended for adult users.',
        'PennyOS does not bundle model runtimes, model weights, embeddings, voice models, or OpenAI credentials.',
      ],
      assets: [
        {
          id: 'hero-presenting',
          type: 'image',
          source: 'public/sprites/packs/pen2/pen2-smug-presenting.png',
          target: 'assets/images/hero-presenting.png',
          role: 'Hero image',
          alt: 'Penny presenting herself in the shipped expression pack.',
          caption: 'The face of PennyOS.',
        },
      ],
      postTemplates: {
        xLaunch: ['I built PennyOS because I wanted a local AI companion that feels like someone.'],
        xThread: ['PennyOS is local-first by default.', 'Technical preview. Setup matters.'],
      },
    };

    fs.mkdirSync(path.join(root, 'docs', 'penny-public'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'docs', 'penny-public', 'social-kit-assets.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(root, 'docs', 'penny-public', 'social-kit.md'), '# PennyOS Social Kit\n');
    touchFile(path.join(root, 'public', 'sprites', 'packs', 'pen2', 'pen2-smug-presenting.png'), 'png');
    touchFile(path.join(root, 'output', 'pennyos-product-demo-2026-06-21', 'pennyos-social-demo.mp4'), 'mp4');
    touchFile(path.join(root, 'output', 'voice-redo-qa-private.json'), '{}');

    const report = buildSocialKit({ rootDir: root, outDir });

    assert.equal(report.copied.length, 2);
    assert.ok(fs.existsSync(path.join(outDir, 'README.md')));
    assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
    assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'posts', 'x-posts.md')));
    assert.ok(fs.existsSync(path.join(outDir, 'assets', 'images', 'hero-presenting.png')));
    assert.ok(fs.existsSync(path.join(outDir, 'assets', 'videos', 'archive', 'pennyos-social-demo.mp4')));
    assert.equal(fs.existsSync(path.join(outDir, 'output', 'voice-redo-qa-private.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
