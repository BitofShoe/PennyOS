const {
  probeLocalEndpointCompatibility,
  renderEndpointCompatibilityMarkdown,
} = require('../lib/penny-local-endpoint-compatibility');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:endpoint:probe - local OpenAI-compatible endpoint compatibility probe

Usage:
  npm run penny:endpoint:probe
  npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:1234/v1
  npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:18080/v1 --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --probe-model-call
  npm run penny:endpoint:probe -- --probe-model-call --json
  npm run penny:endpoint:probe -- --markdown-out output/local-endpoint-compatibility.md

Default mode calls /v1/models only. --probe-model-call sends tiny non-private compatibility probes for chat, streaming, tool-call, structured-output, developer-role, reasoning_effort, and responses support.
It never changes Penny runtime config, memory, default models, context limits, or thinking settings.
`;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = await probeLocalEndpointCompatibility({
    endpoint: argValue(args, 'endpoint') || undefined,
    probeModelCall: hasFlag(args, 'probe-model-call'),
    modelId: argValue(args, 'model-id') || undefined,
    timeoutMs: Number(argValue(args, 'timeout-ms', '5000')),
  });
  const markdown = renderEndpointCompatibilityMarkdown(payload);
  writeFileIfRequested(argValue(args, 'out'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileIfRequested(argValue(args, 'markdown-out'), markdown);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(markdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  helpText,
  main,
};
