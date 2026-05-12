#!/usr/bin/env node
const {
  parseArgs,
  hasFlag,
  argValue,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');
const {
  audioTrial,
  writeJson,
  TRIALS,
} = require('../lib/penny-sidecar-trials');

function helpText() {
  return `penny:sidecar:audio - section 7 audio/voice transcript review trial

Usage:
  npm run penny:sidecar:audio -- --fixture --json
  npm run penny:sidecar:audio -- --fixture --live-probe --artifact-out artifacts/sidecar-trials/section-7-audio-transcript-review.json
  npm run penny:sidecar:audio -- --fixture --live-probe --speaches-tts-trial --speaches-base-url http://127.0.0.1:18000 --json

Options:
  --fixture             Run deterministic transcript fixture.
  --live-probe          Run safe local availability probes.
  --speaches-tts-trial  Download/use a disposable Speaches TTS model and generate fixture audio.
  --speaches-base-url   Speaches base URL for the live probe/trial.
  --artifact-out        JSON artifact path. Defaults to the declared section artifact.
  --json                Print JSON to stdout.
  --help                Show this help.
`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = audioTrial({
    liveProbe: hasFlag(args, 'live-probe'),
    speachesTtsTrial: hasFlag(args, 'speaches-tts-trial'),
    speachesBaseUrl: argValue(args, 'speaches-base-url', ''),
  });
  const artifactOut = argValue(args, 'artifact-out', TRIALS.audio.defaultArtifact);
  writeJson(artifactOut, payload);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(`Wrote ${artifactOut}\nstatus=${payload.status}\n`);
}

if (require.main === module) main();

module.exports = { main, helpText };
