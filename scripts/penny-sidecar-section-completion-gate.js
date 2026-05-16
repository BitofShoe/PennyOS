#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  readJsonFile,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  evaluateSectionCompletionMatrix,
} = require('../lib/penny-sidecar-section-completion');
const {
  writeJson,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:completion-gate - validate sections 2-7 runnable trial completion

Usage:
  npm run penny:sidecar:completion-gate -- --matrix artifacts/sidecar-trials/section-completion-matrix.json --json
  node scripts/penny-sidecar-section-completion-gate.js --matrix artifacts/sidecar-trials/section-completion-matrix.json --out artifacts/sidecar-trials/section-completion-gate-result.json

Options:
  --matrix           Completion matrix JSON path. Defaults to artifacts/sidecar-trials/section-completion-matrix.json.
  --out              Optional JSON result artifact path.
  --json             Print gate result JSON to stdout.
  --help             Show this help.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const matrixPath = argValue(args, 'matrix', 'artifacts/sidecar-trials/section-completion-matrix.json');
  const matrix = readJsonFile(matrixPath);
  const result = evaluateSectionCompletionMatrix(matrix);
  const outPath = argValue(args, 'out');
  if (outPath) writeJson(outPath, result);
  if (hasFlag(args, 'json')) printJson(result);
  else printText(`all_required_sections_complete=${result.all_required_sections_complete}\nfailing=${result.summary.failing}\n`);
  if (!result.all_required_sections_complete) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { main, helpText };
