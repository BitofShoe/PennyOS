#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_TAURI_DIR = path.join(PROJECT_ROOT, 'src-tauri');
const RUNTIME_DIR = path.join(SRC_TAURI_DIR, 'gen', 'penny-runtime');
const MANIFEST_PATH = path.join(SRC_TAURI_DIR, 'gen', 'penny-runtime-manifest.json');
const BINARIES_DIR = path.join(SRC_TAURI_DIR, 'binaries');
const SIDECAR_BASENAME = 'penny-node';
const TAURI_TARGET_DIR = path.join(SRC_TAURI_DIR, 'target');

const RUNTIME_ENTRIES = Object.freeze([
  { source: 'server.js', target: 'server.js', type: 'file' },
  { source: 'package.json', target: 'package.json', type: 'file' },
  { source: '.env.example', target: '.env.example', type: 'file' },
  { source: 'lib', target: 'lib', type: 'dir' },
  { source: 'public', target: 'public', type: 'dir' },
  { source: path.join('penny-voice', 'runtime'), target: path.join('penny-voice', 'runtime'), type: 'dir' },
  { source: path.join('data', 'penny-memory.seed.json'), target: path.join('data', 'penny-memory.seed.json'), type: 'file' },
  { source: path.join('data', 'penny-memory-books.seed.json'), target: path.join('data', 'penny-memory-books.seed.json'), type: 'file' },
]);

const FORBIDDEN_RUNTIME_PATTERNS = Object.freeze([
  /^\.env$/i,
  /^node_modules(?:\/|$)/i,
  /^src-tauri(?:\/|$)/i,
  /^logs(?:\/|$)/i,
  /^tmp(?:\/|$)/i,
  /^output(?:\/|$)/i,
  /^artifacts(?:\/|$)/i,
  /^test-results(?:\/|$)/i,
  /^\.git(?:\/|$)/i,
  /^data\/(?!penny-memory\.seed\.json$|penny-memory-books\.seed\.json$)/i,
]);

const SKIPPED_RUNTIME_PATTERNS = Object.freeze([
  /^public\/js\/penny-sidecar-panel\.mjs$/i,
  /^lib\/penny-sidecar-[^/]+\.js$/i,
  /^lib\/penny-local-llm-app-catalog\.js$/i,
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    json: false,
    targetTriple: process.env.PENNY_TAURI_TARGET_TRIPLE || '',
    nodePath: process.env.PENNY_TAURI_NODE_BINARY || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--target') {
      options.targetTriple = argv[++index] || '';
    } else if (arg.startsWith('--target=')) {
      options.targetTriple = arg.slice('--target='.length);
    } else if (arg === '--node') {
      options.nodePath = argv[++index] || '';
    } else if (arg.startsWith('--node=')) {
      options.nodePath = arg.slice('--node='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function slash(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function relativeSlash(filePath) {
  return slash(path.relative(PROJECT_ROOT, filePath));
}

function run(command, args = []) {
  const result = childProcess.spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function detectTargetTriple() {
  const direct = run('rustc', ['--print', 'host-tuple']);
  if (direct) return direct.split(/\r?\n/)[0].trim();

  const verbose = run('rustc', ['-Vv']);
  const match = verbose.match(/^host:\s*(\S+)/m);
  if (match) return match[1];

  throw new Error('Could not determine Rust target triple. Install rustc or pass --target <triple>.');
}

function targetExtension(targetTriple = '') {
  return /windows|pc-windows/i.test(targetTriple) ? '.exe' : '';
}

function resolveNodePath(configured = '') {
  const candidate = configured || process.execPath;
  if (!candidate) throw new Error('Could not determine a Node executable to bundle.');
  return path.resolve(candidate);
}

function sidecarFileName(targetTriple) {
  return `${SIDECAR_BASENAME}-${targetTriple}${targetExtension(targetTriple)}`;
}

function collectFiles(sourceAbs, targetRel, out = []) {
  const stat = fs.statSync(sourceAbs);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(sourceAbs).sort()) {
      collectFiles(path.join(sourceAbs, name), path.join(targetRel, name), out);
    }
    return out;
  }
  if (!stat.isFile()) return out;
  const normalized = slash(targetRel);
  if (SKIPPED_RUNTIME_PATTERNS.some((pattern) => pattern.test(normalized))) return out;
  if (FORBIDDEN_RUNTIME_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error(`Refusing to stage forbidden runtime path: ${normalized}`);
  }
  out.push({
    source: relativeSlash(sourceAbs),
    target: normalized,
    bytes: stat.size,
  });
  return out;
}

function copyFile(sourceAbs, targetAbs) {
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.copyFileSync(sourceAbs, targetAbs);
}

function copyRuntimeFile(entry) {
  copyFile(
    path.join(PROJECT_ROOT, entry.source),
    path.join(RUNTIME_DIR, entry.target),
  );
}

function copyRuntimeDir(entry) {
  const sourceRoot = path.join(PROJECT_ROOT, entry.source);
  const files = collectFiles(sourceRoot, entry.target);
  for (const file of files) {
    copyFile(
      path.join(PROJECT_ROOT, file.source),
      path.join(RUNTIME_DIR, file.target),
    );
  }
}

function cleanStaleTauriBuildOutputs() {
  for (const profile of ['debug', 'release']) {
    const profileDir = path.join(TAURI_TARGET_DIR, profile);
    fs.rmSync(path.join(profileDir, 'penny-runtime'), { recursive: true, force: true });
    fs.rmSync(path.join(profileDir, 'bundle'), { recursive: true, force: true });
    for (const sidecarName of ['penny-node', 'penny-node.exe']) {
      fs.rmSync(path.join(profileDir, sidecarName), { force: true });
    }
  }
}

function buildRuntimeFileManifest() {
  const files = [];
  for (const entry of RUNTIME_ENTRIES) {
    const sourceAbs = path.join(PROJECT_ROOT, entry.source);
    if (!fs.existsSync(sourceAbs)) {
      throw new Error(`Required runtime input is missing: ${entry.source}`);
    }
    collectFiles(sourceAbs, entry.target, files);
  }
  return files.sort((left, right) => left.target.localeCompare(right.target));
}

function buildManifest(options = {}) {
  const targetTriple = String(options.targetTriple || detectTargetTriple()).trim();
  if (!targetTriple) throw new Error('Missing target triple.');

  const nodePath = resolveNodePath(options.nodePath);
  const nodeExists = fs.existsSync(nodePath);
  const extension = targetExtension(targetTriple);
  if (!nodeExists) throw new Error(`Node executable does not exist: ${nodePath}`);
  if (extension === '.exe' && path.extname(nodePath).toLowerCase() !== '.exe') {
    throw new Error(`Windows Tauri sidecar builds need a Windows node.exe. Got: ${nodePath}`);
  }

  const runtimeFiles = buildRuntimeFileManifest();
  const sidecarName = sidecarFileName(targetTriple);
  const sidecarPath = path.join(BINARIES_DIR, sidecarName);

  return {
    schema: 'penny-tauri-sidecar-manifest.v1',
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun === true,
    targetTriple,
    sidecar: {
      externalBin: 'binaries/penny-node',
      baseName: SIDECAR_BASENAME,
      fileName: sidecarName,
      path: relativeSlash(sidecarPath),
      nodeSource: nodePath,
      nodeSourceBytes: fs.statSync(nodePath).size,
    },
    runtime: {
      resourceName: 'penny-runtime',
      sourceRoot: relativeSlash(RUNTIME_DIR),
      resourceTarget: 'penny-runtime/',
      fileCount: runtimeFiles.length,
      bytes: runtimeFiles.reduce((sum, file) => sum + file.bytes, 0),
      files: runtimeFiles,
      excludes: [
        'data live memory/archive/embedding files',
        'node_modules',
        'logs',
        'tmp',
        'output',
        'artifacts',
        'src-tauri/target',
        'src-tauri/gen',
        '.env',
        'source/dev sidecar harness libs',
        'browser sidecar panel module',
      ],
    },
    appDataDefaults: {
      env: [
        'PENNY_DATA_DIR',
        'PENNY_CONFIG_DIR',
        'PENNY_ENV_FILE',
        'PENNY_MEMORY_FILE',
        'PENNY_MEMORY_ARCHIVE_FILE',
        'PENNY_MEMORY_EMBEDDINGS_FILE',
        'PENNY_MEMORY_LEDGER_FILE',
        'PENNY_MEMORY_BOOKS_FILE',
        'PENNY_OPEN_LOOP_FILE',
        'PENNY_PENDING_WORKSPACE_WRITES_FILE',
        'PENNY_STATIC_EMBED_CACHE_FILE',
        'PENNY_LOCAL_MODEL_PREFERENCE_FILE',
        'PENNY_TAURI_LOG',
      ],
    },
  };
}

function stageSidecarRuntime(options = {}) {
  const manifest = buildManifest(options);
  if (options.dryRun) return manifest;

  cleanStaleTauriBuildOutputs();
  fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.mkdirSync(BINARIES_DIR, { recursive: true });

  for (const entry of RUNTIME_ENTRIES) {
    if (entry.type === 'dir') copyRuntimeDir(entry);
    else copyRuntimeFile(entry);
  }

  copyFile(manifest.sidecar.nodeSource, path.join(PROJECT_ROOT, manifest.sidecar.path));
  if (targetExtension(manifest.targetTriple) !== '.exe') {
    fs.chmodSync(path.join(PROJECT_ROOT, manifest.sidecar.path), 0o755);
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...manifest, dryRun: false }, null, 2)}\n`);
  return { ...manifest, dryRun: false };
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/penny-tauri-build-sidecar.js [--dry-run] [--json] [--target <triple>] [--node <path>]\n`);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const manifest = stageSidecarRuntime(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  process.stdout.write([
    `Penny Tauri sidecar staged for ${manifest.targetTriple}`,
    `- sidecar: ${manifest.sidecar.path}`,
    `- runtime: ${manifest.runtime.sourceRoot} (${manifest.runtime.fileCount} files)`,
    `- manifest: ${relativeSlash(MANIFEST_PATH)}`,
    '',
  ].join('\n'));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  buildManifest,
  detectTargetTriple,
  parseArgs,
  sidecarFileName,
  stageSidecarRuntime,
};
