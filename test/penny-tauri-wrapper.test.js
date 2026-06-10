const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

test('package exposes Tauri desktop scripts and ships the wrapper scaffold in source bundles', () => {
  const packageJson = readJson('package.json');

  assert.equal(packageJson.devDependencies?.['@tauri-apps/cli'], '2.11.2');
  assert.match(packageJson.scripts['tauri:doctor'], /penny-tauri-prereq-check/);
  assert.match(packageJson.scripts['tauri:doctor:strict'], /--strict/);
  assert.match(packageJson.scripts['tauri:doctor:windows'], /-DoctorOnly/);
  assert.match(packageJson.scripts['tauri:repair:native'], /penny-tauri-repair-native-cli/);
  assert.match(packageJson.scripts['tauri:repair:native:shared'], /--shared-wsl-windows/);
  assert.match(packageJson.scripts['tauri:dev'], /tauri:sidecar:build/);
  assert.match(packageJson.scripts['tauri:dev'], /penny-tauri-cli/);
  assert.match(packageJson.scripts['tauri:dev:windows'], /start-penny-tauri\.ps1/);
  assert.match(packageJson.scripts['tauri:build:check'], /tauri:sidecar:build/);
  assert.match(packageJson.scripts['tauri:build:check'], /penny-tauri-cli/);
  assert.match(packageJson.scripts['tauri:build:check'], /--no-bundle/);
  assert.match(packageJson.scripts['tauri:build'], /penny-tauri-cli/);
  assert.match(packageJson.scripts['tauri:consumer-smoke:windows'], /penny-tauri-consumer-smoke\.ps1/);
  assert.match(packageJson.scripts['tauri:clean-proof:windows'], /penny-tauri-clean-windows-proof\.ps1/);
  assert.match(packageJson.scripts['tauri:info'], /penny-tauri-cli/);
  assert.ok(packageJson.files.includes('src-tauri/Cargo.toml'));
  assert.ok(packageJson.files.includes('src-tauri/Cargo.lock'));
  assert.ok(packageJson.files.includes('src-tauri/tauri.conf.json'));
  assert.ok(packageJson.files.includes('src-tauri/src/'));
  assert.ok(packageJson.files.includes('src-tauri/loading/'));
  assert.ok(packageJson.files.includes('src-tauri/icons/'));
  assert.ok(!packageJson.files.includes('src-tauri/'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-prereq-check.js'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-cli.js'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-build-sidecar.js'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-consumer-smoke.ps1'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-clean-windows-proof.ps1'));
  assert.ok(packageJson.files.includes('scripts/penny-tauri-repair-native-cli.js'));
  assert.ok(packageJson.files.includes('docs/penny-tauri-wrapper-options-2026-05-19.md'));
  assert.ok(packageJson.files.includes('start-penny-tauri.ps1'));
  assert.match(packageJson.scripts['tauri:sidecar:build'], /penny-tauri-build-sidecar/);
  assert.match(packageJson.scripts['tauri:sidecar:manifest'], /--dry-run --json/);
  assert.match(packageJson.scripts['tauri:build'], /tauri:sidecar:build/);

  const npmIgnore = readText('.npmignore');
  const gitIgnore = readText('.gitignore');
  assert.match(npmIgnore, /^src-tauri\/gen\/$/m);
  assert.match(npmIgnore, /^src-tauri\/target\/$/m);
  assert.match(npmIgnore, /^src-tauri\/binaries\/$/m);
  assert.match(gitIgnore, /^src-tauri\/gen\/$/m);
  assert.match(gitIgnore, /^src-tauri\/target\/$/m);
  assert.match(gitIgnore, /^src-tauri\/binaries\/$/m);
});

test('Tauri config loads a local splash screen before the Rust wrapper navigates to Penny', () => {
  const config = readJson('src-tauri/tauri.conf.json');

  assert.ok(fs.existsSync(path.join(ROOT, 'src-tauri/icons/icon.png')));
  assert.ok(fs.existsSync(path.join(ROOT, 'src-tauri/icons/icon.ico')));
  assert.equal(config.productName, 'PennyOS');
  assert.equal(config.identifier, 'com.bitofshoe.pennyos');
  assert.equal(config.build.frontendDist, 'loading');
  assert.equal(config.app.windows[0].label, 'main');
  assert.equal(config.app.windows[0].url, 'index.html');
  assert.equal(config.app.windows[0].title, 'PennyOS');
  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.icon, ['icons/icon.png', 'icons/icon.ico']);
  assert.deepEqual(config.bundle.externalBin || [], ['binaries/penny-node']);
  assert.deepEqual(config.bundle.resources, {
    'gen/penny-runtime/': 'penny-runtime/',
  });
});

test('Rust Tauri wrapper starts bundled Penny runtime on loopback and waits for the real status route', () => {
  const mainRs = readText('src-tauri/src/main.rs');

  assert.match(mainRs, /PENNY_TAURI_PORT/);
  assert.match(mainRs, /PENNY_TAURI_SERVER_ROOT/);
  assert.match(mainRs, /PENNY_TAURI_FORCE_SIDECAR/);
  assert.match(mainRs, /PENNY_TAURI_FORCE_DEV_NODE/);
  assert.match(mainRs, /PENNY_TAURI_ALLOW_DEV_FALLBACK/);
  assert.match(mainRs, /debug_assertions/);
  assert.match(mainRs, /tauri_plugin_shell/);
  assert.match(mainRs, /ShellExt/);
  assert.match(mainRs, /\.plugin\(tauri_plugin_shell::init\(\)\)/);
  assert.match(mainRs, /BaseDirectory::Resource/);
  assert.match(mainRs, /penny-runtime/);
  assert.match(mainRs, /server\.js/);
  assert.match(mainRs, /sidecar\("penny-node"\)/);
  assert.match(mainRs, /\.arg\("server\.js"\)/);
  assert.doesNotMatch(mainRs, /\.arg\(&paths\.server_js\)/);
  assert.match(mainRs, /BaseDirectory::AppData/);
  assert.match(mainRs, /BaseDirectory::AppConfig/);
  assert.match(mainRs, /BaseDirectory::AppLog/);
  assert.match(mainRs, /PENNY_DATA_DIR/);
  assert.match(mainRs, /PENNY_CONFIG_DIR/);
  assert.match(mainRs, /PENNY_ENV_FILE/);
  assert.match(mainRs, /PENNY_MEMORY_FILE/);
  assert.match(mainRs, /PENNY_MEMORY_ARCHIVE_FILE/);
  assert.match(mainRs, /PENNY_MEMORY_EMBEDDINGS_FILE/);
  assert.match(mainRs, /PENNY_MEMORY_LEDGER_FILE/);
  assert.match(mainRs, /PENNY_MEMORY_BOOKS_FILE/);
  assert.match(mainRs, /PENNY_OPEN_LOOP_FILE/);
  assert.match(mainRs, /PENNY_PENDING_WORKSPACE_WRITES_FILE/);
  assert.match(mainRs, /PENNY_STATIC_EMBED_CACHE_FILE/);
  assert.match(mainRs, /PENNY_LOCAL_MODEL_PREFERENCE_FILE/);
  assert.match(mainRs, /PENNY_SKIP_LMSTUDIO_PREP/);
  assert.match(mainRs, /127\.0\.0\.1/);
  assert.match(mainRs, /\/api\/penny\/status/);
  assert.match(mainRs, /start_penny_server/);
  assert.match(mainRs, /wait_for_penny_ready/);
  assert.match(mainRs, /status_response_indicates_ready/);
  assert.match(mainRs, /is_whitespace/);
  assert.doesNotMatch(mainRs, /response\.contains\("200 OK"\)\s*&&\s*response\.contains/);
  assert.match(mainRs, /navigate/);
  assert.match(mainRs, /kill/);
  assert.match(mainRs, /PENNY_TAURI_LOG/);
  assert.match(mainRs, /penny-tauri-server\.log/);
  assert.match(mainRs, /try_wait/);
  assert.match(mainRs, /exited before Penny became ready/);
});

test('Tauri sidecar staging manifest bundles runtime resources without private state', () => {
  const builder = require('../scripts/penny-tauri-build-sidecar.js');
  const script = readText('scripts/penny-tauri-build-sidecar.js');

  assert.equal(builder.sidecarFileName('x86_64-pc-windows-msvc'), 'penny-node-x86_64-pc-windows-msvc.exe');
  assert.equal(builder.sidecarFileName('x86_64-unknown-linux-gnu'), 'penny-node-x86_64-unknown-linux-gnu');
  assert.match(script, /cleanStaleTauriBuildOutputs/);
  assert.match(script, /penny-runtime/);
  assert.match(script, /bundle/);

  const result = childProcess.spawnSync(process.execPath, [
    'scripts/penny-tauri-build-sidecar.js',
    '--dry-run',
    '--json',
    '--target',
    'x86_64-unknown-linux-gnu',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(result.stdout);
  assert.equal(manifest.schema, 'penny-tauri-sidecar-manifest.v1');
  assert.equal(manifest.dryRun, true);
  assert.equal(manifest.sidecar.externalBin, 'binaries/penny-node');
  assert.equal(manifest.runtime.resourceName, 'penny-runtime');
  assert.equal(manifest.runtime.resourceTarget, 'penny-runtime/');
  assert.ok(manifest.runtime.fileCount > 0);

  const targets = manifest.runtime.files.map((file) => file.target);
  assert.ok(targets.includes('server.js'));
  assert.ok(targets.includes('public/index.html'));
  assert.ok(targets.includes('data/penny-memory.seed.json'));
  assert.ok(targets.includes('data/penny-memory-books.seed.json'));
  assert.ok(targets.some((target) => target.startsWith('lib/')));
  assert.ok(targets.some((target) => target.startsWith('penny-voice/runtime/')));
  assert.ok(!targets.includes('data/penny-memory.json'));
  assert.ok(!targets.includes('.env'));
  assert.ok(!targets.includes('docs/penny-harness-engineering-link-review-2026-06-10.md'));
  assert.ok(!targets.includes('fixtures/penny-skill-baselines/source-review-fixture.json'));
  assert.ok(!targets.some((target) => target.startsWith('fixtures/sidecar-trials/')));
  assert.ok(!targets.includes('public/js/penny-sidecar-panel.mjs'));
  assert.ok(!targets.some((target) => /^lib\/penny-sidecar-[^/]+\.js$/.test(target)));
  assert.ok(!targets.includes('lib/penny-local-llm-app-catalog.js'));
  assert.ok(!targets.some((target) => target.startsWith('scripts/')));
  assert.ok(!targets.some((target) => target.startsWith('test/')));
  assert.ok(!targets.some((target) => target.startsWith('node_modules/')));
  assert.ok(!targets.some((target) => target.startsWith('src-tauri/')));
  assert.ok(!targets.some((target) => target.startsWith('artifacts/')));
});

test('Tauri loading shell explains startup and does not fetch remote assets', () => {
  const html = readText('src-tauri/loading/index.html');

  assert.match(html, /Starting PennyOS/i);
  assert.match(html, /local Penny server/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\./i);
});

test('Tauri prerequisite checker is importable and reports deterministic blocker summaries', () => {
  const checker = require('../scripts/penny-tauri-prereq-check.js');
  const result = checker.evaluateTauriPrerequisites({
    platform: 'linux',
    releaseText: 'microsoft wsl2',
    versions: {
      node: { ok: true, stdout: 'v24.15.0' },
      npm: { ok: true, stdout: '11.12.1' },
      cargo: { ok: false, error: 'missing' },
      rustc: { ok: false, error: 'missing' },
      tauri: { ok: true, stdout: '2.11.2' },
      pkgConfigWebkit: { ok: false, error: 'missing' },
      rsvg: { ok: false, error: 'missing' },
    },
  });

  assert.equal(result.environment.isWsl, true);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((entry) => /Cargo/.test(entry)));
  assert.ok(result.blockers.some((entry) => /webkit2gtk-4\.1/.test(entry)));
  assert.ok(result.notes.some((entry) => /Windows PowerShell/.test(entry)));
  assert.ok(result.notes.some((entry) => /installed Tauri packages bundle Penny's Node sidecar/i.test(entry)));
  assert.ok(result.notes.some((entry) => /not LM Studio, llama\.cpp, models, or embeddings/i.test(entry)));
  assert.ok(!result.notes.some((entry) => /does not bundle Node/i.test(entry)));
});

test('Tauri prerequisite checker falls back through cmd.exe for Windows command shims', () => {
  const checker = require('../scripts/penny-tauri-prereq-check.js');
  const calls = [];
  const result = checker.runCommand('npm.cmd', ['--version'], {
    platform: 'win32',
    spawnSyncImpl(command, args) {
      calls.push({ command, args });
      if (calls.length === 1) {
        return { error: { code: 'EINVAL' }, stdout: '', stderr: '' };
      }
      return { status: 0, stdout: '11.12.1\r\n', stderr: '' };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.stdout, '11.12.1');
  assert.equal(calls.length, 2);
  assert.match(calls[1].command, /cmd\.exe$/i);
  assert.deepEqual(calls[1].args, ['/d', '/s', '/c', 'npm.cmd --version']);
});

test('Tauri CLI runner uses the local CLI and refreshes the Cargo path', () => {
  const script = readText('scripts/penny-tauri-cli.js');

  assert.match(script, /@tauri-apps\/cli\/tauri\.js/);
  assert.match(script, /process\.execPath/);
  assert.match(script, /\.cargo/);
  assert.match(script, /PATH|Path/);
});

test('Tauri native CLI repair script can restore shared WSL and Windows bindings', () => {
  const script = readText('scripts/penny-tauri-repair-native-cli.js');

  assert.match(script, /@tauri-apps\/cli-linux-x64-gnu/);
  assert.match(script, /@tauri-apps\/cli-win32-x64-msvc/);
  assert.match(script, /npm/);
  assert.match(script, /pack/);
  assert.match(script, /tar/);
  assert.match(script, /--shared-wsl-windows/);
});

test('Windows consumer smoke script launches the sidecar with development tools hidden from PATH', () => {
  const script = readText('scripts/penny-tauri-consumer-smoke.ps1');

  assert.match(script, /PENNY_TAURI_FORCE_SIDECAR/);
  assert.match(script, /PENNY_TAURI_PORT/);
  assert.match(script, /PENNY_SKIP_LMSTUDIO_PREP/);
  assert.match(script, /C:\\Windows\\System32;C:\\Windows/);
  assert.match(script, /Find-CommandSource "node"/);
  assert.match(script, /Find-CommandSource "npm"/);
  assert.match(script, /Find-CommandSource "cargo"/);
  assert.match(script, /Find-CommandSource "rustc"/);
  assert.match(script, /\/api\/penny\/status/);
  assert.match(script, /penny-node\.exe/);
  assert.match(script, /tauri-consumer-smoke/);
});

test('Windows clean proof script installs launches screenshots and uninstalls the packaged app', () => {
  const script = readText('scripts/penny-tauri-clean-windows-proof.ps1');

  assert.match(script, /AllowDevToolsOnPath/);
  assert.match(script, /Clean Windows proof requires node, npm, cargo, and rustc to be absent/);
  assert.match(script, /PennyOS_0\.1\.0_x64-setup\.exe/);
  assert.match(script, /sideBySideInstaller/);
  assert.match(script, /\/S/);
  assert.match(script, /\/D=\$InstallDir/);
  assert.match(script, /Start Menu\\Programs\\PennyOS\.lnk/);
  assert.match(script, /PENNY_TAURI_FORCE_SIDECAR/);
  assert.match(script, /PENNY_TAURI_PORT/);
  assert.match(script, /PENNY_SKIP_LMSTUDIO_PREP/);
  assert.match(script, /\/api\/penny\/status/);
  assert.match(script, /Save-PrimaryScreenshot/);
  assert.match(script, /penny-runtime\\data/);
  assert.match(script, /APPDATA/);
  assert.match(script, /LOCALAPPDATA/);
  assert.match(script, /uninstall\.exe/);
  assert.match(script, /remainingProcesses/);
  assert.match(script, /penny-tauri-clean-windows-proof/);
});

test('Windows Tauri launcher preserves model state and checks desktop prerequisites', () => {
  const script = readText('start-penny-tauri.ps1');

  assert.match(script, /PENNY_SKIP_LMSTUDIO_PREP/);
  assert.match(script, /PENNY_TAURI_SERVER_ROOT/);
  assert.match(script, /\.cargo\\bin/);
  assert.match(script, /\$env:Path/);
  assert.match(script, /npm\.cmd/);
  assert.match(script, /cargo/);
  assert.match(script, /rustc/);
  assert.match(script, /WebView2/);
  assert.match(script, /tauri:dev/);
});
