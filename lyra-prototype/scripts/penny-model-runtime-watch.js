const {
  probeLocalEndpointCompatibility,
} = require('../lib/penny-local-endpoint-compatibility');
const {
  buildModelRuntimeWatchArtifact,
  buildGemmaCompatibleRuntimeWatch,
  renderModelRuntimeWatchMarkdown,
} = require('../lib/penny-model-runtime-watch');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:model-watch - neutral local model runtime watch

Usage:
  npm run penny:model-watch
  npm run penny:model-watch -- --endpoint http://127.0.0.1:1234/v1 --profile qwen
  npm run penny:model-watch -- --endpoint http://127.0.0.1:18080/v1 --profile qwen --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl
  npm run penny:model-watch -- --profile gemma --json

Observational only: no default model swap, memory write, thinking enablement, context raise, or prompt change.
`;
}

async function buildPayload(args) {
  const profile = argValue(args, 'profile', 'unknown');
  if (profile === 'gemma' && !argValue(args, 'endpoint')) {
    return buildGemmaCompatibleRuntimeWatch({ requestedModel: 'google/gemma-4-31b' });
  }
  const compatibility = await probeLocalEndpointCompatibility({
    endpoint: argValue(args, 'endpoint') || undefined,
    probeModelCall: hasFlag(args, 'probe-model-call'),
    modelId: argValue(args, 'model-id') || undefined,
    timeoutMs: Number(argValue(args, 'timeout-ms', '5000')),
  });
  return buildModelRuntimeWatchArtifact({
    profile,
    endpointCompatibility: compatibility,
  });
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = await buildPayload(args);
  const markdown = renderModelRuntimeWatchMarkdown(payload);
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
  buildPayload,
  main,
};
