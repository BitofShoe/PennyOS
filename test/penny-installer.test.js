const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageJson = require('../package.json');
const { REQUIRED } = require('../scripts/check-required-release-files');

const ROOT = path.resolve(__dirname, '..');

test('Windows source zip installer is shipped as a required release surface', () => {
  for (const rel of ['Install-Penny.ps1', 'Install-Penny.cmd']) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `${rel} should exist`);
    assert.equal(REQUIRED.includes(rel), true, `${rel} should be a required release file`);
    assert.equal(packageJson.files.includes(rel), true, `${rel} should be included in npm pack`);
  }
});

test('PowerShell installer performs the novice install contract', () => {
  const script = fs.readFileSync(path.join(ROOT, 'Install-Penny.ps1'), 'utf8');
  assert.match(script, /Node\.js 24\.x/);
  assert.match(script, /npm 11\.x/);
  assert.match(script, /Copy-Item \$envExample \$envFile -Force/);
  assert.match(script, /Invoke-LoggedNative -FilePath \$npmExe -Arguments @\('ci'\)/);
  assert.match(script, /PennyOS Start\.lnk/);
  assert.match(script, /start-penny\.ps1/);
  assert.match(script, /http:\/\/localhost:\$Port\//);
});

test('cmd installer wrapper invokes PowerShell installer with execution policy bypass', () => {
  const wrapper = fs.readFileSync(path.join(ROOT, 'Install-Penny.cmd'), 'utf8');
  assert.match(wrapper, /powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Penny\.ps1" %\*/);
  assert.match(wrapper, /pause/);
});
