const {
  buildLocalLlmAppRoadmap,
} = require('../lib/penny-local-llm-app-catalog');
const {
  buildSidecarDescriptorRegistry,
  renderDescriptorMarkdown,
} = require('../lib/penny-sidecar-descriptors');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:sidecar:descriptors - descriptor-only sidecar registry

Usage:
  node scripts/penny-sidecar-descriptors.js --json

Descriptors are planning and visibility only. They do not enable live adapters.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = buildSidecarDescriptorRegistry(buildLocalLlmAppRoadmap({ piDetected: hasFlag(args, 'pi-present') }));
  const markdown = renderDescriptorMarkdown(payload);
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
