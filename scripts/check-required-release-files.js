const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED = [
  '.env.example',
  'README.md',
  'INSTALL.md',
  'SECURITY.md',
  'PRIVACY.md',
  'LICENSE',
  'Install-Penny.ps1',
  'Install-Penny.cmd',
  'start-penny.ps1',
  'stop-penny.ps1',
  'server.js',
  'public/index.html',
  'public/sprites/packs/penny-2d25d-v1.4/manifest.json',
  'public/sprites/packs/penny-2d25d-v1.4/integrity.json',
  'docs/penny-public/README.md',
  'docs/penny-public/penny-mental-model.md',
  'docs/penny-public/pennyos-user-guide.md',
  'docs/sidecars/penny-sidecar-productized-workflows.md',
  'penny-voice/runtime/penny-operational-blend.md',
  'data/penny-memory.seed.json',
  'data/penny-memory-books.seed.json',
  'lib/penny-runtime-contract-receipt.js',
  'scripts/check-penny-runtime-contract-receipts.js',
  'test/penny-runtime-contract-receipt.test.js',
  'test/penny-runtime-contract-receipts-check.test.js',
  'lib/penny-p0-eval-pack.js',
  'scripts/eval-penny-p0-fixture-pack.js',
  'scripts/check-penny-expression-assets.js',
  'test/penny-expression-assets.test.js',
  'test/penny-p0-eval-pack.test.js',
];

function main() {
  const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error('Required release files are missing:');
    for (const rel of missing) console.error(`- ${rel}`);
    process.exit(1);
  }
  console.log(`Required release file check passed (${REQUIRED.length} files).`);
}

if (require.main === module) main();

module.exports = { REQUIRED };
