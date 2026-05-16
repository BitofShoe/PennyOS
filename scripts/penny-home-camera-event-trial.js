#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  homeCameraTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:home-camera - section 3 Frigate/Home Assistant read-only event trial

Usage:
  npm run penny:sidecar:home-camera -- --fixture --json
  npm run penny:sidecar:home-camera -- --fixture --live-probe --artifact-out artifacts/sidecar-trials/section-3-home-camera-frigate.json
  npm run penny:sidecar:home-camera -- --fixture --live-probe --home-assistant-base-url http://127.0.0.1:18123 --json

Options:
  --fixture                  Run deterministic event fixtures.
  --live-probe               Run safe read-only local availability probes.
  --frigate-base-url         Frigate base URL for /api/version.
  --home-assistant-base-url  Home Assistant base URL for /api/.
  --artifact-out             JSON artifact path. Defaults to the declared section artifact.
  --json                     Print JSON to stdout.
  --help                     Show this help.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = homeCameraTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    frigateBaseUrl: argValue(args, 'frigate-base-url', ''),
    homeAssistantBaseUrl: argValue(args, 'home-assistant-base-url', ''),
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.home.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
