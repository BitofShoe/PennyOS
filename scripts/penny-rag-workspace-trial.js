#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  ragTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:rag - section 6 tiny document/RAG workspace trial

Usage:
  npm run penny:sidecar:rag -- --fixture --json
  npm run penny:sidecar:rag -- --fixture --live-probe --qdrant-write-trial --artifact-out artifacts/sidecar-trials/section-6-rag-document-sandbox.json

Options:
  --fixture          Run deterministic document/RAG fixture.
  --live-probe       Run safe read-only local availability probes.
  --qdrant-write-trial
                     If Qdrant is live, create/upsert/search/delete a temporary fixture collection.
  --qdrant-base-url  Qdrant base URL. Defaults to QDRANT_URL or http://127.0.0.1:6333.
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
  const payload = ragTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    qdrantWriteTrial: hasFlag(args, 'qdrant-write-trial'),
    qdrantBaseUrl: argValue(args, 'qdrant-base-url'),
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.rag.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
