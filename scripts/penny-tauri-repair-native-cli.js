#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TAURI_NATIVE_PACKAGES = {
  'linux:x64': '@tauri-apps/cli-linux-x64-gnu',
  'win32:x64': '@tauri-apps/cli-win32-x64-msvc',
};

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    shell: false,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result;
}

function tauriCliVersion() {
  const packageJson = require(path.join(PROJECT_ROOT, 'package.json'));
  const raw = packageJson.devDependencies && packageJson.devDependencies['@tauri-apps/cli'];
  if (!raw) throw new Error('@tauri-apps/cli is not listed in devDependencies.');
  return String(raw).replace(/^[~^]/, '');
}

function nativePackagesForArgs(argv) {
  if (argv.includes('--shared-wsl-windows')) {
    return [
      TAURI_NATIVE_PACKAGES['linux:x64'],
      TAURI_NATIVE_PACKAGES['win32:x64'],
    ];
  }
  const key = `${process.platform}:${process.arch}`;
  const packageName = TAURI_NATIVE_PACKAGES[key];
  if (!packageName) {
    throw new Error(`No Penny Tauri native CLI repair package is mapped for ${key}.`);
  }
  return [packageName];
}

function safeName(packageName) {
  return packageName.replace(/^@/, '').replace(/[\\/]/g, '-');
}

function packNativePackage(packageName, version, tempDir) {
  const result = run(npmCommand(), ['pack', `${packageName}@${version}`, '--pack-destination', tempDir]);
  const tarball = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.tgz'))
    .pop();
  if (!tarball) throw new Error(`npm pack did not report a tarball for ${packageName}.`);
  return path.join(tempDir, path.basename(tarball));
}

function extractNativePackage(packageName, tarball, tempDir) {
  const unpackDir = path.join(tempDir, `unpack-${safeName(packageName)}`);
  const targetDir = path.join(PROJECT_ROOT, 'node_modules', ...packageName.split('/'));
  fs.rmSync(unpackDir, { recursive: true, force: true });
  fs.mkdirSync(unpackDir, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', unpackDir]);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.renameSync(path.join(unpackDir, 'package'), targetDir);
  return targetDir;
}

function main(argv = process.argv.slice(2)) {
  const version = tauriCliVersion();
  const packageNames = nativePackagesForArgs(argv);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-tauri-native-'));
  try {
    for (const packageName of packageNames) {
      const tarball = packNativePackage(packageName, version, tempDir);
      const targetDir = extractNativePackage(packageName, tarball, tempDir);
      process.stdout.write(`Restored ${packageName}@${version} to ${targetDir}\n`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  nativePackagesForArgs,
  main,
};
