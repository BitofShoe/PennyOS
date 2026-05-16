const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);
const EXTERNAL_URL_RE = /\bhttps?:\/\/([^'"\\)\s<>]+)/gi;
const ALLOWED_EXTERNAL_URLS = new Set([
  'http://www.w3.org/2000/svg',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(fullPath);
  }
  return out;
}

function toProjectRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

const failures = [];
for (const filePath of walk(PUBLIC_DIR)) {
  const rel = toProjectRelative(filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(text)) {
    failures.push(`${rel}: Google Fonts reference found`);
  }
  if (/<link\b[^>]+\brel=["']?preconnect["']?/i.test(text)) {
    failures.push(`${rel}: preconnect link found`);
  }
  for (const match of text.matchAll(EXTERNAL_URL_RE)) {
    const url = match[0];
    if (ALLOWED_EXTERNAL_URLS.has(url)) continue;
    failures.push(`${rel}: external URL found: ${url}`);
  }
}

if (failures.length) {
  console.error('Frontend privacy check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Frontend privacy check passed.');
