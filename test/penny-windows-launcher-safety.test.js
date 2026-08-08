const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('PowerShell launchers verify Penny server identity before trusting a stored PID', () => {
  const start = fs.readFileSync(path.join(root, 'start-penny.ps1'), 'utf8');
  const stop = fs.readFileSync(path.join(root, 'stop-penny.ps1'), 'utf8');

  assert.match(start, /Find-PennyServerProcess\s*\{\s*param\(\[int\]\$ProcessId = 0\)/);
  assert.match(start, /\$existingServerProc = Find-PennyServerProcess -ProcessId \$existingPidNumber/);
  assert.doesNotMatch(start, /Get-Process -Id \$existingPid/);

  assert.match(stop, /function Find-PennyServerProcess/);
  assert.match(stop, /Find-PennyServerProcess -ProcessId \$serverPidNumber/);
  assert.match(stop, /Stop-Process -Id \$serverProc\.ProcessId -Force/);
  assert.doesNotMatch(stop, /Stop-Process -Id \$serverPid -Force/);
});
