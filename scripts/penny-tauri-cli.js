#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function addPathDirectory(directory) {
  if (!directory || !fs.existsSync(directory)) return;
  const delimiter = path.delimiter;
  const parts = String(process.env.PATH || process.env.Path || '')
    .split(delimiter)
    .filter(Boolean);
  const normalized = path.normalize(directory).toLowerCase();
  if (!parts.some((entry) => path.normalize(entry).toLowerCase() === normalized)) {
    process.env.PATH = [directory, ...parts].join(delimiter);
    process.env.Path = process.env.PATH;
  }
}

function main(argv = process.argv.slice(2)) {
  addPathDirectory(path.join(os.homedir(), '.cargo', 'bin'));

  const tauriCli = require.resolve('@tauri-apps/cli/tauri.js', {
    paths: [PROJECT_ROOT],
  });
  const result = childProcess.spawnSync(process.execPath, [tauriCli, ...argv], {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    windowsHide: false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
    return;
  }
  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  addPathDirectory,
  main,
};
