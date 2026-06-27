const fs = require('node:fs');
const path = require('node:path');

const {
  buildP0EvalPackArtifact,
} = require('../lib/penny-p0-eval-pack');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');

function parseP0EvalPackArgs(args = process.argv.slice(2)) {
  const parsed = {
    fixture: true,
    mode: 'fixture',
    outputPath: '',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || '').trim();
    if (arg === '--fixture') {
      parsed.fixture = true;
      parsed.mode = 'fixture';
    } else if (arg === '--output' || arg === '--out') {
      parsed.outputPath = path.resolve(ROOT_DIR, args[index + 1] || '');
      index += 1;
    } else if (arg.startsWith('--output=')) {
      parsed.outputPath = path.resolve(ROOT_DIR, arg.slice('--output='.length));
    } else if (arg.startsWith('--out=')) {
      parsed.outputPath = path.resolve(ROOT_DIR, arg.slice('--out='.length));
    }
  }
  if (!parsed.outputPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    parsed.outputPath = path.join(OUTPUT_DIR, `p0-eval-pack-${stamp}.json`);
  }
  return parsed;
}

function writeP0EvalPackArtifact({ outputPath, artifact } = {}) {
  if (!outputPath) throw new Error('writeP0EvalPackArtifact requires outputPath');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath };
}

function main(argv = process.argv.slice(2)) {
  const options = parseP0EvalPackArgs(argv);
  const artifact = buildP0EvalPackArtifact();
  writeP0EvalPackArtifact({
    outputPath: options.outputPath,
    artifact,
  });
  console.log(`Saved Penny P0 eval fixture pack to ${options.outputPath}`);
  console.log(`Mode: ${artifact.measurementMode}; verdict: ${artifact.summary.trustVerdict}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  parseP0EvalPackArgs,
  writeP0EvalPackArtifact,
  main,
};
