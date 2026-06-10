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
  assert.match(script, /function Invoke-NativeProcess/);
  assert.match(script, /Start-Process/);
  assert.match(script, /RedirectStandardOutput/);
  assert.match(script, /RedirectStandardError/);
  assert.match(script, /Copy-Item \$envExample \$envFile -Force/);
  assert.match(script, /Invoke-LoggedNative -FilePath \$npmExe -Arguments @\('ci'\)/);
  assert.match(script, /PennyOS Start\.lnk/);
  assert.match(script, /start-penny\.ps1/);
  assert.match(script, /http:\/\/localhost:\$Port\//);
});

test('PowerShell start script lets .env drive default port unless -Port is passed', () => {
  const script = fs.readFileSync(path.join(ROOT, 'start-penny.ps1'), 'utf8');
  assert.match(script, /Import-PennyDotEnv/);
  assert.match(script, /\$PSBoundParameters\.ContainsKey\('Port'\)/);
  assert.match(script, /\$effectivePort/);
  assert.match(script, /set "PORT=' \+ \$effectivePort \+ '"/);
});

test('PowerShell start script fails fast on the declared release engine', () => {
  const script = fs.readFileSync(path.join(ROOT, 'start-penny.ps1'), 'utf8');
  assert.match(script, /\$engineCheckScript = Join-Path \$root 'scripts\\check-release-engine\.js'/);
  assert.match(script, /Checking Penny release runtime engine/);
  assert.match(script, /& \$nodeExe \$engineCheckScript/);
  assert.match(script, /Start-Penny\.ps1 requires Node\.js 24\.x and npm 11\.x/);
});

test('.env.example exposes background vectorization and transport-default rationale', () => {
  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.match(envExample, /PENNY_ENABLE_BACKGROUND_CHAT_VECTORS=1/);
  assert.match(envExample, /background chat vectorization/i);
  assert.match(envExample, /raw server default/i);
  assert.match(envExample, /auto/i);
  assert.match(envExample, /generated \.env/i);
  assert.match(envExample, /chat/i);
});

test('.env.example ships the local companion profile with aliveness features enabled', () => {
  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.match(envExample, /PENNY_ENABLE_OPEN_LOOP_PROMPT=1/);
  assert.match(envExample, /PENNY_ENABLE_BOUNDED_INITIATIVE=1/);
  assert.match(envExample, /PENNY_ENABLE_TURN_STATE_PROMPT=1/);
  assert.match(envExample, /profile default/i);
  assert.match(envExample, /server default/i);
});

test('release docs distinguish the source package from a future runtime bundle', () => {
  const decisions = fs.readFileSync(path.join(ROOT, 'docs', 'penny-release-decisions-2026-05-18.md'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(decisions, /source\/dev bundle/i);
  assert.match(decisions, /runtime bundle/i);
  assert.match(decisions, /tests, fixtures, docs, and scripts/i);
  assert.match(readme, /source\/dev bundle/i);
  assert.match(readme, /not a slim runtime bundle/i);
});

test('cmd installer wrapper invokes PowerShell installer with execution policy bypass', () => {
  const wrapper = fs.readFileSync(path.join(ROOT, 'Install-Penny.cmd'), 'utf8');
  assert.match(wrapper, /powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Penny\.ps1" %\*/);
  assert.match(wrapper, /pause/);
});

test('release scripts enforce the declared runtime and syntax gate', () => {
  assert.match(packageJson.scripts.test, /scripts\/check-release-engine\.js/);
  assert.match(packageJson.scripts.test, /node --test test\/\*\.test\.js/);
  assert.match(packageJson.scripts['check:release'], /check:engine/);
  assert.match(packageJson.scripts.prepack, /check:engine/);
  assert.match(packageJson.scripts.prepack, /node --check server\.js/);
});
