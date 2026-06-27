const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MANIFEST_PATH = 'docs/penny-public/social-kit-assets.json';
const DEFAULT_STRATEGY_DOC = 'docs/penny-public/social-kit.md';
const DEFAULT_OUT_DIR = 'output/pennyos-social-kit';

const MARKETING_VIDEO_CANDIDATES = [
  {
    id: 'pennyos-social-demo',
    type: 'video',
    source: 'output/pennyos-product-demo-2026-06-21/pennyos-social-demo.mp4',
    target: 'assets/videos/archive/pennyos-social-demo.mp4',
    role: 'Primary 33-second social demo',
    alt: 'A 16:9 PennyOS product demo showing the app as a local companion runtime.',
    caption: 'The fastest moving demo cut: use this first for X/Twitter, Bluesky, Discord, and a pinned repo post.',
    publicSafety: 'Public-facing product demo selected from output after excluding proof receipts and local runtime logs.',
    priority: 100,
  },
  {
    id: 'pennyos-product-video-v8',
    type: 'video',
    source: 'output/pennyos-product-video-2026-05-19/pennyos-product-video-v8.mp4',
    target: 'assets/videos/archive/pennyos-product-video-v8.mp4',
    role: 'Longer explainer archive candidate',
    alt: 'A longer horizontal PennyOS product explainer video.',
    caption: 'Use as an archive/reference cut only after a final human scrub for dated copy or private repo context.',
    publicSafety: 'Maybe public after review; included under archive instead of primary social copy.',
    priority: 70,
  },
];

function normalizeRelativePath(relativePath = '') {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .trim();
}

function ensureDir(dirPath = '') {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveInside(baseDir = process.cwd(), relativePath = '') {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) throw new Error('Missing relative path');
  const resolved = path.resolve(baseDir, normalized);
  const relative = path.relative(baseDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes base directory: ${relativePath}`);
  }
  return { normalized, resolved };
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadSocialKitManifest({
  rootDir = process.cwd(),
  manifestPath = DEFAULT_MANIFEST_PATH,
} = {}) {
  const manifestFile = path.join(rootDir, manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.schema !== 'pennyos-social-kit.v1') {
    throw new Error(`Unsupported PennyOS social kit schema: ${manifest.schema || 'missing'}`);
  }
  return manifest;
}

function discoverMarketingVideos({ rootDir = process.cwd() } = {}) {
  return MARKETING_VIDEO_CANDIDATES
    .filter((candidate) => fs.existsSync(path.join(rootDir, candidate.source)))
    .map((candidate) => {
      const filePath = path.join(rootDir, candidate.source);
      const stat = fs.statSync(filePath);
      return {
        ...candidate,
        source: normalizeRelativePath(candidate.source),
        target: normalizeRelativePath(candidate.target),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.priority - a.priority || a.source.localeCompare(b.source));
}

function copyAsset({
  rootDir = process.cwd(),
  outDir = path.join(rootDir, DEFAULT_OUT_DIR),
  asset = {},
} = {}) {
  const source = resolveInside(rootDir, asset.source);
  const target = resolveInside(outDir, asset.target || path.join('assets', path.basename(source.normalized)));
  if (!fs.existsSync(source.resolved) || !fs.statSync(source.resolved).isFile()) {
    return {
      copied: null,
      skipped: {
        id: asset.id || source.normalized,
        source: source.normalized,
        reason: asset.optional ? 'optional-missing' : 'missing-required-asset',
      },
    };
  }

  ensureDir(path.dirname(target.resolved));
  fs.copyFileSync(source.resolved, target.resolved);
  const stat = fs.statSync(source.resolved);
  return {
    copied: {
      id: asset.id || source.normalized,
      type: asset.type || 'asset',
      source: source.normalized,
      target: normalizeRelativePath(path.relative(outDir, target.resolved)),
      role: asset.role || '',
      alt: asset.alt || '',
      caption: asset.caption || '',
      publicSafety: asset.publicSafety || '',
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    },
    skipped: null,
  };
}

function buildPostMarkdown(manifest = {}) {
  const launchPosts = manifest.postTemplates?.xLaunch || [];
  const threadPosts = manifest.postTemplates?.xThread || [];
  const videoCaptions = manifest.postTemplates?.videoCaptions || [];

  return `# PennyOS X/Twitter Post Pack

Use these as starting copy. Keep the adult-user disclosure and technical-preview caveat near any broad public post.

## Launch Posts

${launchPosts.map((post, index) => `### Option ${index + 1}\n\n${post}`).join('\n\n')}

## Thread Starter

${threadPosts.map((post, index) => `${index + 1}. ${post}`).join('\n\n')}

## Video Captions

${videoCaptions.map((post, index) => `### Caption ${index + 1}\n\n${post}`).join('\n\n')}

## Required Footer For Broad Posts

${(manifest.disclosures || []).map((item) => `- ${item}`).join('\n')}
`;
}

function buildAltTextMarkdown({ copied = [] } = {}) {
  const rows = copied
    .filter((asset) => asset.alt)
    .map((asset) => `## ${asset.id}\n\nAsset: \`${asset.target}\`\n\nAlt text: ${asset.alt}\n\nCaption: ${asset.caption || 'n/a'}\n`)
    .join('\n');

  return `# PennyOS Social Kit Alt Text

Every public image/video post should include alt text. These are deliberately descriptive rather than cute.

${rows || 'No copied assets with alt text were found.\n'}`;
}

function buildReadmeMarkdown({ manifest = {}, copied = [], skipped = [], generatedAt = new Date().toISOString() } = {}) {
  const assetRows = copied.length
    ? copied.map((asset) => `| ${asset.role || asset.id} | \`${asset.target}\` | ${asset.caption || ''} |`).join('\n')
    : '| none | no assets copied | check manifest and source files |';
  const skippedBlock = skipped.length
    ? `\n## Skipped Optional Assets\n\n${skipped.map((item) => `- \`${item.source}\`: ${item.reason}`).join('\n')}\n`
    : '';

  return `# ${manifest.title || 'PennyOS Social Kit'}

Generated: ${generatedAt}

${manifest.oneLiner || ''}

Tagline: ${manifest.tagline || 'A local companion with teeth.'}

## Start Here

1. Open \`index.html\` for the visual gallery.
2. Use \`posts/x-posts.md\` for ready-to-edit social copy.
3. Use \`alt-text.md\` when posting images or videos.
4. Use \`manifest.json\` if you need exact source paths and copied output paths.

## Best First Post

- Video: \`assets/videos/archive/pennyos-social-demo.mp4\`
- Hero image: \`assets/images/hero-presenting.png\`
- Caption: ${manifest.postTemplates?.videoCaptions?.[0] || manifest.tagline || 'PennyOS is a local-first AI companion runtime.'}

## Included Assets

| Role | File | Caption |
| --- | --- | --- |
${assetRows}

## Boundaries

${(manifest.disclosures || []).map((item) => `- ${item}`).join('\n')}

## Keep Out Of Public Posts

- Local QA receipts, runtime logs, clean-machine proof folders, and private review bundles.
- Anything with user-data folders, local usernames, credential fields, PATH inventories, model file paths, or fixture/mock proof text.
- Exact "latest model" claims unless you have just rechecked the upstream model docs.
${skippedBlock}`;
}

function buildIndexHtml({ manifest = {}, copied = [], generatedAt = new Date().toISOString() } = {}) {
  const primaryVideo = copied.find((asset) => asset.id === 'pennyos-social-demo');
  const heroImage = copied.find((asset) => asset.id === 'hero-presenting') || copied.find((asset) => asset.type === 'image');
  const imageAssets = copied.filter((asset) => asset.type === 'image');
  const videoAssets = copied.filter((asset) => asset.type === 'video');
  const tags = manifest.positioningTags || ['local-first', 'memory', 'bounded tools', 'technical preview'];
  const copiedTargets = new Set(copied.map((asset) => asset.target));
  const videoPosters = new Map([
    ['pennyos-social-demo', 'assets/images/demo-frame-03.jpg'],
    ['pennyos-product-video-v8', 'assets/images/demo-contact-sheet.jpg'],
  ]);

  const imageGrid = imageAssets.map((asset) => `
          <figure class="asset-tile">
            <img src="${escapeHtml(asset.target)}" alt="${escapeHtml(asset.alt)}">
            <figcaption>
              <strong>${escapeHtml(asset.role || asset.id)}</strong>
              <span>${escapeHtml(asset.caption || '')}</span>
              <a href="${escapeHtml(asset.target)}" download>Download</a>
            </figcaption>
          </figure>`).join('\n');

  const videoGrid = videoAssets.map((asset) => `
          <figure class="video-tile">
            <video controls preload="metadata" playsinline${copiedTargets.has(videoPosters.get(asset.id)) ? ` poster="${escapeHtml(videoPosters.get(asset.id))}"` : ''} src="${escapeHtml(asset.target)}"></video>
            <figcaption>
              <strong>${escapeHtml(asset.role || asset.id)}</strong>
              <span>${escapeHtml(asset.caption || '')}</span>
              <a href="${escapeHtml(asset.target)}" download>Download video</a>
            </figcaption>
          </figure>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(manifest.title || 'PennyOS Social Kit')}</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #fff8f0;
      --muted: #c9c0b8;
      --panel: #1d1f24;
      --panel-strong: #29252b;
      --line: #4b4043;
      --ember: #ff7b54;
      --rose: #ff4f87;
      --cyan: #67d8ff;
      --mint: #7be7b2;
      --graphite: #121316;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--graphite);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    a { color: var(--cyan); }

    .shell {
      min-height: 100vh;
      background:
        linear-gradient(135deg, rgba(255, 123, 84, 0.18), transparent 30%),
        linear-gradient(315deg, rgba(103, 216, 255, 0.12), transparent 26%),
        var(--graphite);
    }

    header {
      display: grid;
      grid-template-columns: minmax(0, 1.02fr) minmax(280px, 0.78fr);
      gap: clamp(24px, 4vw, 64px);
      align-items: center;
      min-height: 92vh;
      padding: clamp(28px, 5vw, 72px);
      border-bottom: 1px solid rgba(255, 248, 240, 0.14);
    }

    .eyebrow {
      margin: 0 0 14px;
      color: var(--mint);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      max-width: 11ch;
      margin: 0;
      font-size: clamp(3rem, 8vw, 7.8rem);
      line-height: 0.92;
      letter-spacing: 0;
    }

    .lede {
      max-width: 760px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: clamp(1.05rem, 2vw, 1.45rem);
    }

    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 28px;
    }

    .tag {
      border: 1px solid rgba(255, 248, 240, 0.18);
      background: rgba(255, 248, 240, 0.08);
      color: var(--ink);
      padding: 8px 11px;
      border-radius: 999px;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .hero-art {
      margin: 0;
      align-self: stretch;
      display: grid;
      place-items: end center;
      min-height: 420px;
      overflow: hidden;
      border: 1px solid rgba(255, 248, 240, 0.14);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 79, 135, 0.18), transparent 45%),
        linear-gradient(0deg, rgba(255, 123, 84, 0.24), transparent 38%),
        #202026;
    }

    .hero-art img {
      width: min(100%, 620px);
      max-height: 80vh;
      object-fit: contain;
      filter: drop-shadow(0 24px 28px rgba(0, 0, 0, 0.42));
    }

    main {
      padding: clamp(28px, 5vw, 72px);
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 18px;
      margin-bottom: 18px;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.7rem, 3vw, 3rem);
      letter-spacing: 0;
    }

    .note {
      max-width: 720px;
      color: var(--muted);
      margin: 0;
    }

    .video-grid,
    .asset-grid {
      display: grid;
      gap: 18px;
    }

    .video-grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      margin-bottom: 56px;
    }

    .asset-grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    }

    figure {
      margin: 0;
      background: rgba(29, 31, 36, 0.88);
      border: 1px solid rgba(255, 248, 240, 0.14);
      border-radius: 8px;
      overflow: hidden;
    }

    video,
    .asset-tile img {
      display: block;
      width: 100%;
      background: #0d0e10;
    }

    video {
      aspect-ratio: 16 / 9;
    }

    .asset-tile img {
      aspect-ratio: 1 / 1;
      object-fit: contain;
      padding: 12px;
    }

    figcaption {
      display: grid;
      gap: 8px;
      padding: 14px;
    }

    figcaption strong {
      color: var(--ink);
    }

    figcaption span {
      color: var(--muted);
      font-size: 0.94rem;
    }

    .copy-bank {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      gap: 14px;
      margin: 56px 0;
    }

    .copy-card {
      border: 1px solid rgba(255, 248, 240, 0.14);
      border-radius: 8px;
      padding: 18px;
      background: var(--panel-strong);
    }

    .copy-card p {
      margin: 0;
      color: var(--muted);
    }

    footer {
      padding: 24px clamp(28px, 5vw, 72px) 44px;
      color: var(--muted);
      border-top: 1px solid rgba(255, 248, 240, 0.14);
    }

    @media (max-width: 780px) {
      header {
        grid-template-columns: 1fr;
        min-height: auto;
      }

      .hero-art {
        min-height: 320px;
      }

      .section-head {
        display: block;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <section>
        <p class="eyebrow">PennyOS social kit</p>
        <h1>${escapeHtml(manifest.tagline || 'A local companion with teeth.')}</h1>
        <p class="lede">${escapeHtml(manifest.oneLiner || '')}</p>
        <div class="tag-row">
          ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('\n          ')}
        </div>
      </section>
      <figure class="hero-art">
        ${heroImage ? `<img src="${escapeHtml(heroImage.target)}" alt="${escapeHtml(heroImage.alt)}">` : ''}
      </figure>
    </header>
    <main>
      <section aria-labelledby="videos-title">
        <div class="section-head">
          <h2 id="videos-title">Post This First</h2>
          <p class="note">Use the short demo as the concentrated cool dose. The longer explainer belongs in the archive until a human does one last scrub.</p>
        </div>
        <div class="video-grid">
          ${primaryVideo ? videoGrid : '<p class="note">No product video was copied. Rebuild after generating the social demo.</p>'}
        </div>
      </section>

      <section aria-labelledby="images-title">
        <div class="section-head">
          <h2 id="images-title">Image Arsenal</h2>
          <p class="note">Hero art, reaction sprites, setup stills, and app-facing moments ready for posts, threads, thumbnails, and replies.</p>
        </div>
        <div class="asset-grid">
          ${imageGrid}
        </div>
      </section>

      <section aria-labelledby="copy-title">
        <div class="section-head">
          <h2 id="copy-title">Copy Bank</h2>
          <p class="note">Sharp by default, honest at the edges.</p>
        </div>
        <div class="copy-bank">
          ${(manifest.postTemplates?.xLaunch || []).slice(0, 3).map((post, index) => `
          <article class="copy-card">
            <strong>Post option ${index + 1}</strong>
            <p>${escapeHtml(post)}</p>
          </article>`).join('\n')}
        </div>
      </section>
    </main>
    <footer>
      Generated ${escapeHtml(generatedAt)}. Technical preview. Intended for adult users. Local setup, model choice, hardware, and runtime state matter.
    </footer>
  </div>
</body>
</html>
`;
}

function buildSocialKit({
  rootDir = process.cwd(),
  outDir = path.join(rootDir, DEFAULT_OUT_DIR),
  manifestPath = DEFAULT_MANIFEST_PATH,
  strategyDoc = DEFAULT_STRATEGY_DOC,
} = {}) {
  const sourceRoot = path.resolve(rootDir);
  const bundleRoot = path.resolve(outDir);
  const manifest = loadSocialKitManifest({ rootDir: sourceRoot, manifestPath });
  const generatedAt = new Date().toISOString();
  const discoveredVideos = discoverMarketingVideos({ rootDir: sourceRoot });
  const assets = [...(manifest.assets || []), ...discoveredVideos];
  const copied = [];
  const skipped = [];

  fs.rmSync(bundleRoot, { recursive: true, force: true });
  ensureDir(bundleRoot);

  for (const asset of assets) {
    const result = copyAsset({ rootDir: sourceRoot, outDir: bundleRoot, asset });
    if (result.copied) copied.push(result.copied);
    if (result.skipped) {
      skipped.push(result.skipped);
      if (result.skipped.reason === 'missing-required-asset') {
        throw new Error(`Required social kit asset missing: ${result.skipped.source}`);
      }
    }
  }

  ensureDir(path.join(bundleRoot, 'posts'));
  ensureDir(path.join(bundleRoot, 'strategy'));
  fs.writeFileSync(
    path.join(bundleRoot, 'README.md'),
    buildReadmeMarkdown({ manifest, copied, skipped, generatedAt }),
    'utf8',
  );
  fs.writeFileSync(path.join(bundleRoot, 'posts', 'x-posts.md'), buildPostMarkdown(manifest), 'utf8');
  fs.writeFileSync(path.join(bundleRoot, 'alt-text.md'), buildAltTextMarkdown({ copied }), 'utf8');
  fs.writeFileSync(path.join(bundleRoot, 'index.html'), buildIndexHtml({ manifest, copied, generatedAt }), 'utf8');

  const strategySource = path.join(sourceRoot, strategyDoc);
  if (fs.existsSync(strategySource)) {
    fs.copyFileSync(strategySource, path.join(bundleRoot, 'strategy', 'social-kit.md'));
  }

  const outputManifest = {
    schema: manifest.schema,
    title: manifest.title,
    generatedAt,
    rootDir: sourceRoot,
    copiedCount: copied.length,
    copied,
    skipped,
    discoveredVideos,
    privacyNote: 'This bundle intentionally includes public marketing assets and excludes private local QA receipts, proof logs, live memory files, and runtime diagnostics.',
  };
  fs.writeFileSync(path.join(bundleRoot, 'manifest.json'), `${JSON.stringify(outputManifest, null, 2)}\n`, 'utf8');

  return {
    outDir: bundleRoot,
    copied,
    skipped,
    discoveredVideos,
    files: [
      'README.md',
      'index.html',
      'manifest.json',
      'alt-text.md',
      'posts/x-posts.md',
      'strategy/social-kit.md',
    ],
  };
}

function readArgValue(argv = [], name = '') {
  const flag = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '');
    if (value === flag) return argv[index + 1] || '';
    if (value.startsWith(`${flag}=`)) return value.slice(flag.length + 1);
  }
  return '';
}

function main(argv = process.argv.slice(2)) {
  const outArg = readArgValue(argv, 'out');
  const report = buildSocialKit({
    rootDir: process.cwd(),
    outDir: outArg ? path.resolve(process.cwd(), outArg) : undefined,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildSocialKit,
  discoverMarketingVideos,
  loadSocialKitManifest,
  normalizeRelativePath,
};
