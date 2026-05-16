#!/usr/bin/env node
const {
  readJsonFile,
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  labCockpitTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:lab-cockpit - section 2 Open WebUI lab cockpit trial

Usage:
  npm run penny:sidecar:lab-cockpit -- --fixture --json
  npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --artifact-out artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json
  npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --openwebui-mock-model-trial --openwebui-base-url http://127.0.0.1:13000 --mock-openai-base-url http://127.0.0.1:18081/v1 --json

Options:
  --fixture                    Run deterministic fixture/mock harness.
  --live-probe                 Run safe local availability probes.
  --openwebui-mock-model-trial Verify Open WebUI sees/routes to a disposable mock OpenAI-compatible model.
  --openwebui-base-url         Open WebUI base URL for the live trial.
  --mock-openai-base-url       Mock OpenAI-compatible base URL for direct checks.
  --openwebui-auth-token-file  Local disposable signup JSON containing a token field.
  --artifact-out               JSON artifact path. Defaults to the declared section artifact.
  --json                       Print JSON to stdout.
  --help                       Show this help.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const authTokenFile = argValue(args, 'openwebui-auth-token-file', '');
  const openWebuiAuthToken = authTokenFile ? String(readJsonFile(authTokenFile).token || '') : '';
  const payload = labCockpitTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    openwebuiMockModelTrial: hasFlag(args, 'openwebui-mock-model-trial'),
    openWebuiBaseUrl: argValue(args, 'openwebui-base-url', ''),
    mockOpenAiBaseUrl: argValue(args, 'mock-openai-base-url', ''),
    openWebuiAuthToken,
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.lab.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
