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
  'penny-voice/runtime/penny-operational-blend.md',
  'data/penny-memory.seed.json',
  'data/penny-memory-books.seed.json',
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
