const {
  buildSidecarTrialContract,
  renderContractMarkdown,
} = require('../lib/penny-sidecar-contracts');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:lab-cockpit - local lab cockpit sidecar templates

Usage:
  npm run penny:lab-cockpit -- --template OpenWebUI
  npm run penny:lab-cockpit -- --template AnythingLLM --json

Lab cockpits are optional sidecars, not Penny replacements. Penny memory import is forbidden by default.
`;
}

function normalizeName(value = 'OpenWebUI') {
  if (/^openwebui$/i.test(value)) return 'Open WebUI';
  return value;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const name = normalizeName(argValue(args, 'template', 'OpenWebUI'));
  const payload = buildSidecarTrialContract(name);
  const markdown = renderContractMarkdown(payload);
  writeFileIfRequested(argValue(args, 'out'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileIfRequested(argValue(args, 'markdown-out'), markdown);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(markdown);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
};
