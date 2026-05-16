#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  researchTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:research - section 5 SearXNG-style source-cited digest trial

Usage:
  npm run penny:sidecar:research -- --fixture --json
  npm run penny:sidecar:research -- --fixture --live-probe --artifact-out artifacts/sidecar-trials/section-5-research-searxng-digest.json

Options:
  --fixture          Run deterministic search-result fixture.
  --live-probe       Run safe read-only local availability probes.
  --searxng-base-url Override the local SearXNG base URL for live probes.
  --artifact-out     JSON artifact path. Defaults to the declared section artifact.
  --json             Print JSON to stdout.
  --help             Show this help.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = researchTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    searxngBaseUrl: argValue(args, 'searxng-base-url', ''),
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.research.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
