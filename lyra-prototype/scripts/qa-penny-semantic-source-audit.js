const fs = require('fs');
const path = require('path');

const {
  PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA,
  SOURCE_AUDIT_MEASUREMENT_MODES,
  buildCleanSemanticSourceAuditFixtureInput,
  buildSemanticSourceAuditArtifact,
  normalizeMeasurementMode,
} = require('../lib/penny-semantic-source-audit');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `semantic-source-audit-${STAMP}.json`);

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

function parseSemanticSourceAuditArgs(argv = process.argv.slice(2)) {
  const requestedMode = parseArgValue('mode', argv);
  const fixture = hasArgFlag('fixture', argv) || !requestedMode || requestedMode === 'fixture' || requestedMode === 'fixture-only';
  const mode = fixture
    ? SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY
    : normalizeMeasurementMode(requestedMode);
  if (mode !== SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY) {
    throw new Error('Semantic source audit runner currently supports fixture-only output.');
  }
  return {
    fixture: true,
    mode,
    outputPath: parseArgValue('output', argv),
    generatedAt: parseArgValue('generated-at', argv),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeSemanticSourceAuditArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildSemanticSourceAuditArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const args = parseSemanticSourceAuditArgs(argv);
  const generatedAt = args.generatedAt || new Date().toISOString();
  const outputPath = args.outputPath || OUTPUT_PATH;
  const artifact = buildSemanticSourceAuditArtifact({
    generatedAt,
    measurementMode: args.mode,
    input: buildCleanSemanticSourceAuditFixtureInput(),
  });
  const result = writeSemanticSourceAuditArtifact({ outputPath, artifact });
  console.log(`Semantic source audit complete: ${result.outputPath}`);
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
  PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA,
  main,
  parseArgValue,
  parseSemanticSourceAuditArgs,
  writeSemanticSourceAuditArtifact,
};
