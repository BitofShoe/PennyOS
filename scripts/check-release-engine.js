#!/usr/bin/env node
const packageJson = require('../package.json');
const {
  checkRuntimeEngines,
  readNpmVersion,
} = require('../lib/penny-engine-check');

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
