#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

function cleanText(value) {
  return String(value || '').trim();
}

function quoteWindowsCmdArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function formatWindowsCmdToken(value, index) {
  const text = String(value || '');
  if (/^[A-Za-z0-9_.:=@/+,-]+$/.test(text)) return text;
  return quoteWindowsCmdArg(text);
}

function shouldRetryThroughWindowsCmd(command, result, platform) {
  if (platform !== 'win32') return false;
  if (!result || !result.error) return false;
  if (!/\.(cmd|bat)$/i.test(String(command || ''))) return false;
  const errorCode = result.error.code || result.error.message || result.error;
  return ['EINVAL', 'ENOENT'].includes(String(errorCode || ''));
}

function runCommand(command, args = [], options = {}) {
  const spawnSyncImpl = options.spawnSyncImpl || childProcess.spawnSync;
  const platform = options.platform || process.platform;
  try {
    let result = spawnSyncImpl(command, args, {
      encoding: 'utf8',
      shell: false,
      timeout: options.timeout || 8000,
      windowsHide: true,
    });
    if (shouldRetryThroughWindowsCmd(command, result, platform)) {
      const cmdExe = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`;
      const cmdLine = [command, ...args].map(formatWindowsCmdToken).join(' ');
      result = spawnSyncImpl(cmdExe, ['/d', '/s', '/c', cmdLine], {
        encoding: 'utf8',
        shell: false,
        timeout: options.timeout || 8000,
        windowsHide: true,
      });
    }
    if (result.error) {
      return {
        ok: false,
        command,
        args,
        error: result.error.code || result.error.message,
        stdout: cleanText(result.stdout),
        stderr: cleanText(result.stderr),
      };
    }
    return {
      ok: result.status === 0,
      command,
      args,
      status: result.status,
      stdout: cleanText(result.stdout),
      stderr: cleanText(result.stderr),
    };
  } catch (error) {
    return {
      ok: false,
      command,
      args,
      error: error.message,
      stdout: '',
      stderr: '',
    };
  }
}

function readLinuxReleaseText(fsImpl = fs) {
  const parts = [];
  for (const file of ['/proc/version', '/proc/sys/kernel/osrelease']) {
    try {
      parts.push(fsImpl.readFileSync(file, 'utf8'));
    } catch (_) {
      // Optional platform hint only.
    }
  }
  return parts.join('\n');
}

function collectTauriPrerequisiteVersions(options = {}) {
  const platform = options.platform || process.platform;
  const isWindows = platform === 'win32';
  const npx = isWindows ? 'npx.cmd' : 'npx';
  const npm = isWindows ? 'npm.cmd' : 'npm';
  const versions = {
    node: {
      ok: true,
      command: process.execPath,
      stdout: process.version,
    },
    npm: runCommand(npm, ['--version']),
    cargo: runCommand('cargo', ['--version']),
    rustc: runCommand('rustc', ['--version']),
    tauri: runCommand(npx, ['tauri', '--version']),
  };

  if (platform === 'linux') {
    versions.pkgConfigWebkit = runCommand('pkg-config', ['--modversion', 'webkit2gtk-4.1']);
    versions.rsvg = runCommand('rsvg-convert', ['--version']);
  } else if (platform === 'darwin') {
    versions.xcodeSelect = runCommand('xcode-select', ['-p']);
  } else if (platform === 'win32') {
    versions.webview2 = runCommand('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      [
        '$paths=@(',
        "'HKCU:\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',",
        "'HKLM:\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',",
        "'HKLM:\\Software\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'",
        ');',
        'if($paths | Where-Object { Test-Path $_ }) { "WebView2 detected"; exit 0 }',
        'Write-Error "WebView2 runtime not detected"; exit 1',
      ].join(' '),
    ]);
  }

  return versions;
}

function checkOk(check) {
  return check && check.ok === true;
}

function describeCheck(check) {
  if (!check) return 'not checked';
  if (check.stdout) return check.stdout.split(/\r?\n/)[0];
  if (check.stderr) return check.stderr.split(/\r?\n/)[0];
  if (check.error) return check.error;
  if (typeof check.status === 'number') return `exit ${check.status}`;
  return check.ok ? 'ok' : 'missing';
}

function evaluateTauriPrerequisites(options = {}) {
  const platform = options.platform || process.platform;
  const releaseText = options.releaseText
    ?? (platform === 'linux' ? readLinuxReleaseText(options.fsImpl || fs) : os.release());
  const versions = options.versions || collectTauriPrerequisiteVersions({ platform });
  const isWsl = platform === 'linux' && /microsoft|wsl/i.test(String(releaseText || ''));
  const blockers = [];
  const warnings = [];
  const notes = [];

  if (!checkOk(versions.node)) blockers.push('Node.js is not available.');
  if (!checkOk(versions.npm)) blockers.push('npm is not available.');
  if (!checkOk(versions.cargo)) blockers.push('Cargo is not installed or not on PATH.');
  if (!checkOk(versions.rustc)) blockers.push('rustc is not installed or not on PATH.');
  if (!checkOk(versions.tauri)) blockers.push('Tauri CLI is not available through npx tauri.');

  if (platform === 'linux') {
    if (!checkOk(versions.pkgConfigWebkit)) {
      blockers.push('webkit2gtk-4.1 development files are missing.');
    }
    if (!checkOk(versions.rsvg)) {
      blockers.push('rsvg-convert is missing.');
    }
  } else if (platform === 'darwin') {
    if (!checkOk(versions.xcodeSelect)) {
      blockers.push('Xcode Command Line Tools are missing.');
    }
  } else if (platform === 'win32') {
    if (!checkOk(versions.webview2)) {
      warnings.push('WebView2 runtime was not detected by registry probe; modern Windows 10/11 often has it already, but Tauri may still ask for it.');
    }
    notes.push('Windows builds also need Microsoft C++ Build Tools for native Tauri compilation.');
  }

  if (isWsl) {
    notes.push('This is WSL. Run npm run tauri:dev:windows from Windows PowerShell if Rust/WebView2 are installed on Windows; WSL still needs Linux WebKitGTK/Rust prerequisites for a native Linux Tauri window.');
  }

  notes.push('Build machines need Node/npm/Rust/Cargo/platform tooling; installed Tauri packages bundle Penny\'s Node sidecar and runtime tree, but not LM Studio, llama.cpp, models, or embeddings.');

  return {
    ok: blockers.length === 0,
    platform,
    environment: {
      platform,
      isWsl,
      releaseText: String(releaseText || '').trim(),
    },
    checks: {
      node: { ok: checkOk(versions.node), detail: describeCheck(versions.node) },
      npm: { ok: checkOk(versions.npm), detail: describeCheck(versions.npm) },
      cargo: { ok: checkOk(versions.cargo), detail: describeCheck(versions.cargo) },
      rustc: { ok: checkOk(versions.rustc), detail: describeCheck(versions.rustc) },
      tauri: { ok: checkOk(versions.tauri), detail: describeCheck(versions.tauri) },
      pkgConfigWebkit: versions.pkgConfigWebkit
        ? { ok: checkOk(versions.pkgConfigWebkit), detail: describeCheck(versions.pkgConfigWebkit) }
        : undefined,
      rsvg: versions.rsvg
        ? { ok: checkOk(versions.rsvg), detail: describeCheck(versions.rsvg) }
        : undefined,
      xcodeSelect: versions.xcodeSelect
        ? { ok: checkOk(versions.xcodeSelect), detail: describeCheck(versions.xcodeSelect) }
        : undefined,
      webview2: versions.webview2
        ? { ok: checkOk(versions.webview2), detail: describeCheck(versions.webview2) }
        : undefined,
    },
    blockers,
    warnings,
    notes,
  };
}

function formatTauriPrerequisiteReport(result) {
  const lines = [];
  lines.push(`Penny Tauri prerequisite check (${result.environment.isWsl ? 'WSL' : result.platform})`);
  lines.push(`Status: ${result.ok ? 'ready' : 'blocked'}`);
  lines.push('');
  lines.push('Checks:');
  for (const [name, check] of Object.entries(result.checks)) {
    if (!check) continue;
    lines.push(`- ${name}: ${check.ok ? 'ok' : 'missing'} (${check.detail})`);
  }
  if (result.blockers.length) {
    lines.push('');
    lines.push('Blockers:');
    for (const blocker of result.blockers) lines.push(`- ${blocker}`);
  }
  if (result.warnings.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  if (result.notes.length) {
    lines.push('');
    lines.push('Notes:');
    for (const note of result.notes) lines.push(`- ${note}`);
  }
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const strict = argv.includes('--strict');
  const result = evaluateTauriPrerequisites();
  process.stdout.write(json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatTauriPrerequisiteReport(result)}\n`);
  if (strict && !result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectTauriPrerequisiteVersions,
  evaluateTauriPrerequisites,
  formatTauriPrerequisiteReport,
  runCommand,
};
