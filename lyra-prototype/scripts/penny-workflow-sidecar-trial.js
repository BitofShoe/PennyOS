#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  workflowTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:workflow - section 4 n8n-style local dry-run toy flow

Usage:
  npm run penny:sidecar:workflow -- --fixture --json
  npm run penny:sidecar:workflow -- --fixture --live-probe --n8n-workflow-trial --artifact-out artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json

Options:
  --fixture          Run deterministic toy-flow fixture.
  --live-probe       Run safe read-only local availability probes.
  --n8n-workflow-trial
                     If n8n is live, import/export a local-only manual workflow in the disposable container.
  --n8n-container-name
                     Docker container name for the n8n CLI import. Defaults to N8N_CONTAINER_NAME or penny-n8n-trial.
  --n8n-base-url     n8n base URL. Defaults to N8N_BASE_URL or http://127.0.0.1:5678.
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
  const payload = workflowTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    n8nWorkflowTrial: hasFlag(args, 'n8n-workflow-trial'),
    n8nContainerName: argValue(args, 'n8n-container-name'),
    n8nBaseUrl: argValue(args, 'n8n-base-url'),
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.workflow.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
