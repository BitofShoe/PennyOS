#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const packageJson = require('../package.json');
const {
  checkRuntimeEngines,
} = require('../lib/penny-engine-check');

function npmVersionFromUserAgent(value = '') {
  const match = String(value || '').match(/(?:^|\s)npm\/([^\s]+)/i);
  return match ? match[1] : '';
}

function readNpmVersion() {
  const fromUserAgent = npmVersionFromUserAgent(process.env.npm_config_user_agent || '');
  if (fromUserAgent) return fromUserAgent;
  try {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return execFileSync(npmBin, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const result = checkRuntimeEngines({
  packageJson,
  nodeVersion: process.version,
  npmVersion: readNpmVersion(),
});

if (!result.ok) {
  for (const failure of result.failures) {
    console.error(`[Penny release engine check] ${failure}`);
  }
  process.exit(1);
}

console.log(`[Penny release engine check] Node ${result.node.version} and npm ${result.npm.version} match package.json.`);
