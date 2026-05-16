const fs = require('fs');
const path = require('path');

const {
  PENNY_SEMANTIC_EXPORT_SCHEMA,
  SEMANTIC_EXPORT_MODES,
  buildSemanticExportArtifact,
  normalizeSemanticExportMode,
} = require('../lib/penny-semantic-export');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `semantic-export-${STAMP}.json`);

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return argv.some((arg) => String(arg || '').trim() === dashed);
}

function parseSemanticExportArgs(argv = process.argv.slice(2)) {
  const inputPath = parseArgValue('input', argv);
  const fixture = hasArgFlag('fixture', argv) || !inputPath;
  if (fixture && inputPath) {
    throw new Error('Use either --fixture or --input, not both.');
  }
  const mode = fixture
    ? SEMANTIC_EXPORT_MODES.FIXTURE
    : normalizeSemanticExportMode(parseArgValue('mode', argv) || SEMANTIC_EXPORT_MODES.LOCAL_INPUT);
  if (!fixture && mode !== SEMANTIC_EXPORT_MODES.LOCAL_INPUT) {
    throw new Error('Semantic export input mode must be local-input.');
  }
  return {
    fixture,
    mode,
    inputPath,
    outputPath: parseArgValue('output', argv),
    generatedAt: parseArgValue('generated-at', argv),
    compact: hasArgFlag('compact', argv),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath = '') {
  const resolved = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writeSemanticExportArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildSemanticExportArtifact(),
  compact = false,
} = {}) {
  ensureDir(path.dirname(outputPath));
  const json = compact
    ? JSON.stringify(artifact)
    : JSON.stringify(artifact, null, 2);
  fs.writeFileSync(outputPath, `${json}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const args = parseSemanticExportArgs(argv);
  const generatedAt = args.generatedAt || new Date().toISOString();
  const outputPath = args.outputPath || OUTPUT_PATH;
  const input = args.fixture ? null : readJsonFile(args.inputPath);
  const artifact = buildSemanticExportArtifact({
    generatedAt,
    mode: args.mode,
    input,
  });
  const result = writeSemanticExportArtifact({
    outputPath,
    artifact,
    compact: args.compact,
  });
  console.log(`Semantic export complete: ${result.outputPath}`);
  console.log(JSON.stringify(result.artifact.summary, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  PENNY_SEMANTIC_EXPORT_SCHEMA,
  main,
  parseArgValue,
  parseSemanticExportArgs,
  readJsonFile,
  writeSemanticExportArtifact,
};
