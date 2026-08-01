const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PACK_URL_ROOT = '/sprites/packs/penny-2d25d-v1.4/';
const DEFAULT_PACK_ROOT = path.join(PUBLIC_ROOT, 'sprites', 'packs', 'penny-2d25d-v1.4');
const MOODS = Object.freeze([
  'calm',
  'happy',
  'excited',
  'thinking',
  'surprised',
  'flirty',
  'smug',
  'annoyed',
]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, filePath)} is not valid JSON: ${error.message}`);
  }
}

function isSafeRootRelativeSpriteUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/sprites/') || value.startsWith('//')) return false;
  if (value.includes('\\') || /[?#]/.test(value) || /^[A-Za-z]:/.test(value)) return false;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  return !decoded.split('/').some((part) => part === '..' || part === '.');
}

function resolvePackUrl(url, packRoot) {
  if (!isSafeRootRelativeSpriteUrl(url) || !url.startsWith(PACK_URL_ROOT)) {
    fail(`Unsafe or out-of-pack runtime URL: ${url}`);
  }
  const relative = url.slice(PACK_URL_ROOT.length);
  const resolved = path.resolve(packRoot, relative);
  const rootWithSep = `${path.resolve(packRoot)}${path.sep}`;
  if (resolved !== path.resolve(packRoot) && !resolved.startsWith(rootWithSep)) {
    fail(`Runtime URL escapes pack root: ${url}`);
  }
  return resolved;
}

function resolvePublicUrl(url) {
  if (!isSafeRootRelativeSpriteUrl(url)) fail(`Unsafe public fallback URL: ${url}`);
  const resolved = path.resolve(PUBLIC_ROOT, url.slice(1));
  const publicWithSep = `${path.resolve(PUBLIC_ROOT)}${path.sep}`;
  if (!resolved.startsWith(publicWithSep)) fail(`Fallback URL escapes public root: ${url}`);
  return resolved;
}

function readPngReceipt(filePath) {
  const bytes = fs.readFileSync(filePath);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    fail(`${path.relative(ROOT, filePath)} is not a PNG`);
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    fail(`${path.relative(ROOT, filePath)} has no leading IHDR chunk`);
  }
  return {
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function listFilesRecursive(rootPath) {
  const files = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(fullPath));
    else if (entry.isFile()) files.push(fullPath);
    else fail(`Unexpected non-file entry in expression pack: ${fullPath}`);
  }
  return files;
}

function checkPack({ packRoot = DEFAULT_PACK_ROOT } = {}) {
  const manifestPath = path.join(packRoot, 'manifest.json');
  const integrityPath = path.join(packRoot, 'integrity.json');
  const manifest = readJson(manifestPath);
  const integrity = readJson(integrityPath);
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };

  assert(manifest.id === 'penny-2d25d-eight-mood-v1.4', `Unexpected pack id: ${manifest.id}`);
  assert(Number(manifest.version) === 1.4, `Unexpected pack version: ${manifest.version}`);
  assert(manifest.fallbackMood === 'calm', `Unexpected fallback mood: ${manifest.fallbackMood}`);
  assert(JSON.stringify(manifest.contract) === JSON.stringify(MOODS), 'Manifest mood contract/order differs');
  assert(manifest.renderMode === 'registered-composite', `Unexpected render mode: ${manifest.renderMode}`);
  assert(manifest.transitionMode === 'atomic-fade-swap', `Unexpected transition mode: ${manifest.transitionMode}`);
  assert(manifest.integrity === `${PACK_URL_ROOT}integrity.json`, `Unexpected integrity URL: ${manifest.integrity}`);
  assert(integrity.packId === manifest.id, 'Integrity pack id differs from manifest');
  assert(Number(integrity.version) === 1.4, `Unexpected integrity version: ${integrity.version}`);
  assert(integrity.fallbackMood === 'calm', 'Integrity fallback mood differs');
  assert(JSON.stringify(integrity.contract) === JSON.stringify(MOODS), 'Integrity mood contract/order differs');
  assert(
    integrity.sourceArchive?.sha256 === 'f7ae7631b76bcc4a5a9afee4e1e1b9e9ca128842ef8ac27eda31f181828238c7',
    'Source archive SHA-256 differs',
  );
  assert(integrity.sourceArchive?.entryCount === 120, 'Source archive entry count differs');
  assert(
    integrity.selectedCandidate?.sha256 === '88735dcd514ebba5df97526bc3a8461b2845bc30c79ff429dbc168149da5728f',
    'Selected Candidate B SHA-256 differs',
  );
  assert(integrity.selectedCandidate?.localizedChangedPixels === 15152, 'Selected Candidate B pixel count differs');
  assert(
    integrity.selectedCandidate?.localizedChangedPixelSha256 === '7c0658afb684a9b632e441356b1f7cc5228a463b9f0d2dae4a8846c0867cc762',
    'Selected Candidate B localized pixel SHA-256 differs',
  );
  assert(integrity.selectedCandidate?.productionCompositeByteIdentical === true, 'Candidate B promotion is not byte-identical');
  assert(integrity.selectedCandidate?.outsideAllowedEyeBoxChangedPixels === 0, 'Candidate B changed outside the eye box');
  assert(integrity.selectedCandidate?.alphaChannelChangedPixels === 0, 'Candidate B changed silhouette alpha');
  assert(
    integrity.frozenMasterSha256 === 'ea4abf0a98567898d4d658372fe99d2e2c5169106b0b264e2e9566aac9162d04',
    'Frozen master SHA-256 differs',
  );

  const receipts = {};
  for (const mood of MOODS) {
    const entry = manifest.moods?.[mood];
    const asset = integrity.assets?.[mood];
    const expectedUrl = `${PACK_URL_ROOT}composites/${mood}.png`;
    assert(!!entry, `Manifest is missing mood: ${mood}`);
    assert(!!asset, `Integrity map is missing mood: ${mood}`);
    if (!entry || !asset) continue;
    assert(Array.isArray(entry.variants) && entry.variants.length === 1, `${mood} must have exactly one primary variant`);
    assert(Array.isArray(entry.secondaryVariants) && entry.secondaryVariants.length === 1, `${mood} must have exactly one secondary variant`);
    assert(entry.avatar?.src === expectedUrl, `${mood} avatar source differs`);
    assert(entry.variants?.[0]?.src === expectedUrl, `${mood} primary variant source differs`);
    assert(entry.secondaryVariants?.[0]?.src === expectedUrl, `${mood} secondary variant source differs`);
    assert(entry.backgroundHint === expectedUrl, `${mood} background hint differs`);
    assert(entry.avatar?.fallbackSrc && entry.avatar.fallbackSrc !== expectedUrl, `${mood} avatar fallback is missing or self-referential`);
    assert(entry.variants?.[0]?.fallbackSrc && entry.variants[0].fallbackSrc !== expectedUrl, `${mood} variant fallback is missing or self-referential`);
    if (mood === 'flirty') {
      assert(entry.transitionMode === 'atomic-fade-swap', 'Flirty mood must explicitly use atomic-fade-swap');
      assert(entry.variants?.[0]?.transitionMode === 'atomic-fade-swap', 'Flirty variant must explicitly use atomic-fade-swap');
    }

    let filePath;
    try {
      filePath = resolvePackUrl(expectedUrl, packRoot);
      const avatarFallback = resolvePublicUrl(entry.avatar.fallbackSrc);
      const variantFallback = resolvePublicUrl(entry.variants[0].fallbackSrc);
      assert(fs.existsSync(avatarFallback), `${mood} avatar fallback does not exist`);
      assert(fs.existsSync(variantFallback), `${mood} variant fallback does not exist`);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    assert(fs.existsSync(filePath), `${mood} composite does not exist`);
    if (!fs.existsSync(filePath)) continue;
    const receipt = readPngReceipt(filePath);
    receipts[mood] = receipt;
    for (const field of ['bytes', 'sha256', 'width', 'height', 'bitDepth', 'colorType']) {
      assert(receipt[field] === asset[field], `${mood} ${field} differs: expected ${asset[field]}, got ${receipt[field]}`);
    }
    assert(asset.target === `composites/${mood}.png`, `${mood} integrity target differs`);
    assert(asset.source === `production-assets/mood-composites/${mood}.png`, `${mood} integrity source differs`);
  }

  const files = listFilesRecursive(packRoot);
  const pngFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === '.png');
  assert(pngFiles.length === 8, `Expected exactly eight PNGs, found ${pngFiles.length}`);
  assert(files.length === 10, `Expected manifest, integrity, and eight PNGs only; found ${files.length} files`);
  const totalBytes = Object.values(receipts).reduce((sum, item) => sum + item.bytes, 0);
  assert(totalBytes === 7349980, `Unexpected composite byte total: ${totalBytes}`);

  if (errors.length) fail(errors.map((message) => `- ${message}`).join('\n'));
  return {
    ok: true,
    packRoot,
    packId: manifest.id,
    moods: [...MOODS],
    totalBytes,
    receipts,
  };
}

function parsePackRoot(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--pack-root');
  return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : DEFAULT_PACK_ROOT;
}

function main() {
  try {
    const result = checkPack({ packRoot: parsePackRoot() });
    console.log(`Penny expression asset check passed (${result.moods.length} moods, ${result.totalBytes} bytes).`);
  } catch (error) {
    console.error('Penny expression asset check failed:');
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_PACK_ROOT,
  MOODS,
  checkPack,
  isSafeRootRelativeSpriteUrl,
  readPngReceipt,
  resolvePackUrl,
};
