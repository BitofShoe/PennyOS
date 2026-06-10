---
title: Penny Release Critique Cleanup Goal Mode Handoff
status: ready-for-goal-mode
created: 2026-05-17
branch: codex/penny-installable-local-companion-release
tags:
  - penny
  - release
  - goal-mode
  - handoff
---

# Penny Release Critique Cleanup Goal Mode Handoff

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` if available, or `superpowers:executing-plans` if working inline. This is a cross-cutting release hardening pass. Use checkbox steps for tracking, keep one primary editor per file boundary, and preserve receipts.

**Goal:** Turn the Claude/GPT release critique pile into a completed, verified PennyOS release cleanup pass: fix every objective issue, document or explicitly defer the product-level issues, and leave the branch easier for a novice reviewer to install, verify, and trust.

**Architecture:** Treat this as release engineering plus local-companion security hardening. Make the package/source zip self-verifying without Git metadata, tighten the local API and project tools around durable memory/secrets, clarify install/onboarding, and reduce Penny/Lyra naming drift without breaking compatibility.

**Tech Stack:** Node.js 24.x, npm 11.x, CommonJS server, browser ESM modules, PowerShell helper scripts, GitHub Actions, Node `node:test`, LM Studio or llama.cpp OpenAI-compatible local endpoints.

---

## Paste-Ready `/goal` Prompt

```text
/goal Please execute docs/plans/penny-release-critique-goal-mode-handoff-2026-05-17.md on branch codex/penny-installable-local-companion-release.

Important constraints:
- Fix all objective release blockers and security bugs in the plan.
- For product-level or unfixable items, add honest docs/decision notes and explicit acceptance criteria instead of leaving them vague.
- Do not touch ignored live memory, output artifacts, tmp bundles, loaded model state, or untracked local workspace folders unless the plan explicitly says to inspect them read-only.
- Keep Penny's authored voice in public docs, but make install/release instructions boringly precise.
- Use current repo truth over reviewer prose. If a critique is already fixed, mark it fixed in the plan/results and add the verifying receipt.
- End with commands run, files changed, source-zip/package verification, and a concise remaining-risk list.
```

## Current State Verified Before Writing This Handoff

Environment label: `local/static` unless noted.

- Branch is `codex/penny-installable-local-companion-release`.
- Tracked root release files still include `Today's Plan.md`, `debug-shadow.js`, `debug-shadow.ps1`, `debug-shadow-oneline.ps1`, `start-lyra.ps1`, and `stop-lyra.ps1`.
- Root `.env.example` is missing, while `README.md`, `INSTALL.md`, and `package.json` reference it.
- `package.json` has `"private": false`, `"license": "UNLICENSED"`, `prepack` runs `scripts/check-release-artifacts.js`, and package `files` includes `.env.example`, `start-lyra.ps1`, and `stop-lyra.ps1`.
- `scripts/check-release-artifacts.js` shells out to `git rev-parse --show-toplevel` and `git ls-files`.
- `test/penny-skill-pack.test.js` shells out to `git ls-files`.
- `lib/penny-api-security.js` has bare `decodeURIComponent(value)` in cookie parsing.
- `lib/penny-api-security.js` strong-token local routes are only workspace writes, `POST /api/penny/memory/purge`, and `POST /api/penny/lmstudio/model`; `POST/PATCH /api/penny/memory`, `POST /api/penny/memory/review`, and `POST /api/penny/consolidate` are not strong-token routes by default.
- `server.js` sets web reading on by default with `process.env.PENNY_WEB_SEARCH_ENABLED !== '0'`.
- `server.js` includes `.env` in `TEXT_FILE_EXTENSIONS`.
- `public/js/penny-app.js` hides the Memory tab unless `?debug=1`.
- `scripts/qa-penny-browser-smoke.js` installs the Playwright package into `.qa-pw`, but does not install the Chromium browser binary or emit a release-friendly next command when the executable is missing.
- `README.md` uses remote shields.io badges. This is not local UI telemetry, but it is external traffic when viewing the README online.
- `.github/workflows/check.yml` uses Node 24 and runs `npm run check`.

Untracked local folders `./.openclaw/` and `./lyra-prototype/` exist in this working tree. Treat them as local residue. Do not add them.

## Already Fixed Or Mostly Fixed From The Review

Verify these, but do not spend much time unless a check proves a regression.

- Public root no longer tracks `AGENTS.md`, `MEMORY.md`, `SOUL.md`, or `USER.md`.
- Nested `lyra-prototype/` is untracked local residue, not a tracked release subtree.
- GitHub workflow, issue templates, PR template, `LICENSE`, `.npmignore`, `INSTALL.md`, `PRIVACY.md`, and `SECURITY.md` exist.
- README is already Penny-voiced and significantly stronger than the earlier repo.
- Live experience artifacts exist in ignored `output/` and `tmp/` only; do not commit them.

## P0 Acceptance Criteria

- [ ] A fresh source archive without `.git` can run the release self-check command documented in README/INSTALL without `fatal: not a git repository`.
- [ ] `.env.example` exists, ships in package/source archives, and contains safe defaults plus comments for LM Studio/llama.cpp, LAN token, web reading, memory/tools, and reasoning debug flags.
- [ ] `npm pack --dry-run` works without `--ignore-scripts` in a source-archive-like directory.
- [ ] `npm run check` or a documented `npm run check:release` works in a no-Git extracted release tree. If both commands exist, docs must clearly say which one is for source checkouts and which one is for release zips.
- [ ] GitHub CI covers normal checkout checks and a source-archive simulation.

## P1 Acceptance Criteria

- [ ] All local memory mutation/review/consolidation routes require the loopback cookie/API token by default.
- [ ] Malformed cookies cannot throw out of API security.
- [ ] Project tools refuse to read secret-bearing files by default, while still allowing `.env.example`.
- [ ] Web reading is either opt-in by default or made painfully explicit in `.env.example`, README, INSTALL, status UI, and privacy docs.
- [ ] Browser smoke either installs/uses Chromium reliably or fails with the exact command to run.
- [ ] Penny-named launch scripts and runtime files exist; Lyra names are compatibility aliases only.
- [ ] Root/debug/private workflow residue is either moved out of the release surface or explicitly excluded/guarded.

## P2 Acceptance Criteria

- [ ] New developer docs explain the app path without requiring historical docs.
- [ ] Optional `@yarflam/potion-base-8m` dependency is explained in a new-user/dev context, including why it is optional and local-only after install.
- [ ] Node 24 requirement is justified or support matrix is changed and tested.
- [ ] Memory transparency has a safe default user surface, or a product decision note explains why it remains debug-only for this release.
- [ ] Feature flag sprawl is addressed with a configuration/profile map or explicitly deferred with a clear follow-up issue/doc.

---

## Task 1: Baseline And Release Archive Reproduction

**Files:**
- Read: `package.json`
- Read: `README.md`
- Read: `INSTALL.md`
- Read: `scripts/check-release-artifacts.js`
- Read: `test/penny-skill-pack.test.js`
- Create or update: `tmp/release-critique-baseline/` artifacts only if useful; do not commit `tmp/`.

- [ ] **Step 1: Confirm branch and dirt**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected:

- Branch is `codex/penny-installable-local-companion-release`.
- Any untracked `./.openclaw/`, `./lyra-prototype/`, `output/`, or `tmp/` remains untracked/ignored and is not staged.

- [ ] **Step 2: Reproduce source-archive behavior**

Run:

```bash
rm -rf tmp/release-critique-source-archive
mkdir -p tmp/release-critique-source-archive
git archive --format=tar HEAD | tar -x -C tmp/release-critique-source-archive
(
  cd tmp/release-critique-source-archive
  test ! -d .git
  npm ci
  npm run check
)
```

Expected before fixes: this likely fails with `fatal: not a git repository`.

- [ ] **Step 3: Reproduce package lifecycle behavior**

Run:

```bash
(
  cd tmp/release-critique-source-archive
  npm pack --dry-run
)
```

Expected before fixes: this likely fails because `prepack` invokes the Git-only release artifact check.

- [ ] **Step 4: Record baseline in the final result**

Do not commit the baseline artifacts. Mention the failure text and commands in the closeout.

## Task 2: Add `.env.example` And Required Release File Guard

**Files:**
- Create: `.env.example`
- Create: `scripts/check-required-release-files.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `INSTALL.md`
- Test: `test/penny-required-release-files.test.js`

- [ ] **Step 1: Add `.env.example` with safe release defaults**

Create `.env.example` at repo root. Keep it safe and explanatory. Suggested content:

```dotenv
# PennyOS local runtime settings
# Copy this file to .env, then adjust model names for your local LM Studio or llama.cpp server.

PORT=4317
HOST=127.0.0.1

# OpenAI-compatible local model endpoint.
# LM Studio default:
PENNY_LMSTUDIO_BASE=http://127.0.0.1:1234/v1
PENNY_LMSTUDIO_NATIVE_BASE=http://127.0.0.1:1234/api/v1

# Transport: chat is the most portable path for LM Studio/llama.cpp.
PENNY_LOCAL_LLM_TRANSPORT=chat

# Replace these with model IDs available in your local server.
PENNY_LMSTUDIO_CHAT_MODEL=google/gemma-4-31b
PENNY_LMSTUDIO_TOOL_MODEL=google/gemma-4-e4b
PENNY_LMSTUDIO_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5

# Local sharing and API protection.
PENNY_LAN_SHARE=0
PENNY_API_TOKEN=
PENNY_REQUIRE_API_TOKEN=0
PENNY_API_ALLOW_LOCAL_NO_TOKEN=0

# Web reading/search. Recommended release default: off unless you opt in.
PENNY_WEB_SEARCH_ENABLED=0
PENNY_WEB_ALLOW_PRIVATE_NET=0

# Workspace tools.
PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=0

# Debug/reasoning safety.
PENNY_ALLOW_RAW_REASONING_FALLBACK=0
PENNY_LOG_LMSTUDIO_REASONING=0

# Optional local static embedding provider. Leave off unless you know you need it.
PENNY_STATIC_EMBED_MODE=off
PENNY_STATIC_EMBED_PROVIDER=model2vec-potion-8m
```

If `PENNY_LMSTUDIO_NATIVE_BASE` actually needs `/api/v1` or bare host for LM Studio in this repo, verify against `lib/penny-lmstudio-status.js` and update the example accordingly.

- [ ] **Step 2: Add required-file checker**

Create `scripts/check-required-release-files.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED = [
  '.env.example',
  'README.md',
  'INSTALL.md',
  'SECURITY.md',
  'PRIVACY.md',
  'LICENSE',
  'server.js',
  'public/index.html',
  'penny-voice/runtime/penny-operational-blend.md',
  'data/penny-memory.seed.json',
  'data/penny-memory-books.seed.json',
];

function main() {
  const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error('Required release files are missing:');
    for (const rel of missing) console.error(`- ${rel}`);
    process.exit(1);
  }
  console.log(`Required release file check passed (${REQUIRED.length} files).`);
}

if (require.main === module) main();

module.exports = { REQUIRED };
```

- [ ] **Step 3: Add test for required files**

Create `test/penny-required-release-files.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { REQUIRED } = require('../scripts/check-required-release-files');

const ROOT = path.resolve(__dirname, '..');

test('required release files exist in the repo tree', () => {
  const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  assert.deepEqual(missing, []);
});
```

- [ ] **Step 4: Wire script**

In `package.json`, add:

```json
"check:required-files": "node scripts/check-required-release-files.js"
```

Update `check` later in Task 3 so required-file checking runs before tests.

- [ ] **Step 5: Docs**

Update README/INSTALL so `.env.example` is no longer a dead path and so web reading default matches Task 7.

## Task 3: Make Release Checks And Tests Work Without Git Metadata

**Files:**
- Modify: `scripts/check-release-artifacts.js`
- Modify: `test/penny-skill-pack.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/check.yml`
- Test: `test/penny-release-artifacts.test.js`

- [ ] **Step 1: Refactor `check-release-artifacts.js` to export pure helpers**

Keep existing ignore logic, but add a filesystem fallback. The script should:

- Use Git when `.git` is present and `git ls-files` works.
- Fall back to walking the filesystem when Git is unavailable.
- Print which mode was used: `git` or `filesystem`.
- Exclude generated/private dirs in filesystem mode: `.git`, `.codex`, `.openclaw`, `node_modules`, `output`, `tmp`, `logs`, `test-results`, `.qa-pw`, `.playwright-cli`, `lyra-prototype`.

Minimum exported API:

```js
module.exports = {
  isGeneratedOrPrivateTrackedFile,
  listReleaseFiles,
  normalizeRel,
};
```

`listReleaseFiles({ rootDir })` should return `{ mode, files }`.

- [ ] **Step 2: Add focused test**

Create `test/penny-release-artifacts.test.js` with temp dirs:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isGeneratedOrPrivateTrackedFile,
  listReleaseFiles,
} = require('../scripts/check-release-artifacts');

test('release artifact checker falls back to filesystem outside git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-release-no-git-'));
  try {
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# Penny\n');
    fs.writeFileSync(path.join(root, 'public', 'index.html'), '<!doctype html>\n');
    fs.writeFileSync(path.join(root, 'tmp', 'junk.txt'), 'nope\n');
    const result = listReleaseFiles({ rootDir: root });
    assert.equal(result.mode, 'filesystem');
    assert.deepEqual(result.files.sort(), ['README.md', 'public/index.html']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release artifact private-file classifier still rejects local residues', () => {
  assert.equal(isGeneratedOrPrivateTrackedFile('.lyra-server.pid'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('data/penny-memory.json'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('data/penny-memory.seed.json'), false);
  assert.equal(isGeneratedOrPrivateTrackedFile('lyra-prototype/AGENTS.md'), true);
});
```

- [ ] **Step 3: Make `penny-skill-pack` tests skip or fallback outside Git**

Preferred: replace direct `git ls-files` with a helper that returns `[]` when `.git` is absent and adds a clear `t.diagnostic('git metadata absent; checking filesystem only')`. Do not hard-fail with `fatal: not a git repository`.

- [ ] **Step 4: Split scripts**

Update `package.json` scripts toward this shape:

```json
"check:release-artifacts": "node scripts/check-release-artifacts.js",
"check:frontend-privacy": "node scripts/check-frontend-privacy.js",
"check:release": "npm run check:required-files && npm run check:release-artifacts && npm run check:frontend-privacy && node --check server.js && npm test",
"check": "npm run check:release",
"prepack": "npm run check:required-files && npm run check:release-artifacts && npm run check:frontend-privacy"
```

If package lifecycle is still too expensive, keep `prepack` to required files + frontend privacy + release artifacts only, but make sure it works without Git.

- [ ] **Step 5: CI source-archive simulation**

Add a second workflow step after normal `npm run check`:

```yaml
      - name: Source archive self-check
        run: |
          rm -rf /tmp/pennyos-source-archive
          mkdir -p /tmp/pennyos-source-archive
          git archive --format=tar HEAD | tar -x -C /tmp/pennyos-source-archive
          cd /tmp/pennyos-source-archive
          npm ci
          npm run check:release
          npm pack --dry-run
```

## Task 4: Browser Smoke Novice-Proofing

**Files:**
- Modify: `scripts/qa-penny-browser-smoke.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `INSTALL.md` or `docs/penny-browser-manual-checklist.md`
- Test: existing browser smoke tests if any, plus manual missing-browser path if feasible.

- [ ] **Step 1: Add browser install script**

Add package script:

```json
"qa:browser:install": "node scripts/qa-penny-browser-smoke.js --install-browser"
```

Or add a dedicated script `scripts/install-playwright-browser.js` if cleaner.

- [ ] **Step 2: Extend smoke script flags**

Teach `scripts/qa-penny-browser-smoke.js` to parse `--install-browser`. It should run:

```bash
node .qa-pw/node_modules/playwright/cli.js install chromium
```

after `ensurePlaywright()`.

- [ ] **Step 3: Detect missing executable**

Wrap `chromium.launch()` errors. If the message includes `Executable doesn't exist` or `playwright install`, throw a friendlier message:

```text
Playwright Chromium is not installed for Penny browser smoke.
Run: npm run qa:browser:install
Then retry: npm run qa:browser:smoke
```

- [ ] **Step 4: Update docs**

README `Make Sure I Did Not Lie` should say:

```powershell
npm run qa:browser:install
npm run qa:browser:smoke
```

and clarify that browser install is a QA dependency, not a runtime dependency.

## Task 5: Penny Naming, Lyra Compatibility, And Root Hygiene

**Files:**
- Create: `start-penny.ps1`
- Create: `stop-penny.ps1`
- Modify: `start-lyra.ps1`
- Modify: `stop-lyra.ps1`
- Modify: `server.js`
- Modify: `lib/penny-runtime-tools.js`
- Modify: `package.json`
- Modify: `README.md`, `INSTALL.md`, `CODEBASE.md`, `ARCHITECTURE.md`, `docs/README.md`, `docs/penny-lan-phone-reset-runbook-2026-04-21.md`
- Possibly move: `debug-shadow*.js/ps1`, `Today's Plan.md`

- [ ] **Step 1: Add Penny-named launcher files**

Copy current behavior from `start-lyra.ps1` to `start-penny.ps1`, but use Penny filenames:

- `.penny-server.pid`
- `.penny-server.meta.json`
- `.penny-local-env.ps1`
- `penny-server.out.log`
- `penny-server.err.log`

Keep support for existing `.lyra-local-env.ps1` as a compatibility fallback only if `.penny-local-env.ps1` is absent.

- [ ] **Step 2: Add compatibility aliases**

Make `start-lyra.ps1` a thin alias that warns and invokes `start-penny.ps1`. Make `stop-lyra.ps1` invoke `stop-penny.ps1`.

- [ ] **Step 3: Update package scripts**

Change:

```json
"start:durable": "powershell -ExecutionPolicy Bypass -File .\\start-penny.ps1",
"stop": "powershell -ExecutionPolicy Bypass -File .\\stop-penny.ps1"
```

Keep optional aliases:

```json
"start:durable:legacy": "powershell -ExecutionPolicy Bypass -File .\\start-lyra.ps1",
"stop:legacy": "powershell -ExecutionPolicy Bypass -File .\\stop-lyra.ps1"
```

- [ ] **Step 4: Update runtime log paths**

Update `lib/penny-runtime-tools.js` to prefer Penny logs while optionally reading legacy Lyra logs if Penny logs are absent.

- [ ] **Step 5: Server preference filename compatibility**

`server.js` already has Penny and legacy Lyra preference paths. Keep dual-read/dual-write compatibility only as needed, but expose Penny naming in docs/status.

- [ ] **Step 6: Move root debug/private residues**

Move root debug scripts into a less public location, for example:

- `debug-shadow.js` -> `scripts/debug/debug-shadow.js`
- `debug-shadow.ps1` -> `scripts/debug/debug-shadow.ps1`
- `debug-shadow-oneline.ps1` -> `scripts/debug/debug-shadow-oneline.ps1`
- `Today's Plan.md` -> `docs/archive/Todays Plan.md` or remove if obsolete

Update references or delete obsolete references. Do not move ignored live artifacts.

- [ ] **Step 7: Release guard**

Update release checks so root `debug-shadow*`, `Today's Plan.md`, `.lyra-*`, and `lyra-server.*.log` cannot be tracked in a release candidate.

## Task 6: API Security Hardening

**Files:**
- Modify: `lib/penny-api-security.js`
- Test: `test/penny-api-security.test.js`
- Possibly update: `SECURITY.md`

- [ ] **Step 1: Harden cookie parsing**

Change `parseCookieHeader` so malformed percent-encoding never throws:

```js
try {
  cookies[key] = decodeURIComponent(value);
} catch {
  cookies[key] = value;
}
```

- [ ] **Step 2: Add malformed cookie test**

Add to `test/penny-api-security.test.js`:

```js
test('API security ignores malformed cookie encoding instead of throwing', () => {
  const security = buildSecurity();
  const url = new URL('http://localhost:4317/api/penny/memory/purge');
  const request = req({ method: 'POST', contentType: 'application/json' });
  request.headers.cookie = 'penny_access_token=%E0%A4%A';
  assert.doesNotThrow(() => security.validateApiRequest(request, url));
  assert.equal(security.validateApiRequest(request, url).code, 'token_required');
});
```

- [ ] **Step 3: Require token for all memory mutations**

Update `isStrongTokenRoute`:

```js
function isStrongTokenRoute(req, url) {
  const method = String(req?.method || 'GET').toUpperCase();
  const pathname = String(url?.pathname || '');
  if (pathname.startsWith('/api/penny/workspace-writes')) return true;
  if (method === 'POST' && pathname === '/api/penny/lmstudio/model') return true;
  if (method !== 'GET' && pathname === '/api/penny/memory') return true;
  if (method === 'POST' && pathname === '/api/penny/memory/review') return true;
  if (method === 'POST' && pathname === '/api/penny/memory/purge') return true;
  if (method === 'POST' && pathname === '/api/penny/consolidate') return true;
  return false;
}
```

- [ ] **Step 4: Add token tests for memory routes**

Add table-driven tests for:

- `POST /api/penny/memory`
- `PATCH /api/penny/memory`
- `POST /api/penny/memory/review`
- `POST /api/penny/memory/purge`
- `POST /api/penny/consolidate`

Each should fail without token and pass with `Bearer test-token`.

- [ ] **Step 5: Tighten Origin policy or document decision**

Preferred default: same host and same port for Origin, plus configured `PENNY_ALLOWED_ORIGINS` for extras. If this would break the local UI, document why and add a `SECURITY.md` note instead. Do not silently leave the critique unaddressed.

## Task 7: Secret-Bearing File Read Protection

**Files:**
- Modify: `lib/penny-project-tools.js`
- Test: `test/penny-project-tools.test.js`
- Possibly modify: `server.js`
- Update: `SECURITY.md`

- [ ] **Step 1: Add secret read denylist**

Inside `createProjectToolsApi`, add:

```js
const DEFAULT_SECRET_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\..+/i,
  /(?:^|[/\\])id_rsa$/i,
  /(?:^|[/\\])id_ed25519$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

function isSecretBearingProjectFile(filePath) {
  const rel = toProjectRelative(filePath).replace(/\\/g, '/');
  if (rel === '.env.example' || rel.endsWith('/.env.example')) return false;
  return DEFAULT_SECRET_FILE_PATTERNS.some((pattern) => pattern.test(rel));
}
```

Call this from `readProjectFileTool`, `readProjectFileAroundMatchTool`, and `searchProjectTextTool` before reading contents.

- [ ] **Step 2: Add tests**

Add to `test/penny-project-tools.test.js`:

```js
test('project read tools refuse secret-bearing files but allow env example', () => {
  const { api, projectRoot, cleanup } = buildApi({
    textExtensions: new Set(['.env', '.example', '.txt', '.md', '.js', '.json']),
  });
  try {
    fs.writeFileSync(path.join(projectRoot, '.env'), 'PENNY_API_TOKEN=secret\n');
    fs.writeFileSync(path.join(projectRoot, '.env.example'), 'PENNY_API_TOKEN=\n');
    assert.throws(() => api.readProjectFileTool({ path: '.env' }), /secret-bearing|not readable/i);
    const example = api.readProjectFileTool({ path: '.env.example' });
    assert.match(example.excerpt, /PENNY_API_TOKEN=/);
  } finally {
    cleanup();
  }
});
```

If the existing `buildApi` test helper does not accept `textExtensions`, update it or keep the current set and create files with extensions it supports. The test must prove `.env` refusal and `.env.example` allowance.

## Task 8: Web Reading Default And Privacy Clarity

**Files:**
- Modify: `server.js`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `INSTALL.md`
- Modify: `PRIVACY.md`
- Modify: `SECURITY.md`
- Test: `test/penny-routes.test.js`, `test/penny-route-handlers.test.js`, or a focused new test if needed.

- [ ] **Step 1: Choose default**

Recommended release choice:

```js
const WEB_SEARCH_ENABLED = process.env.PENNY_WEB_SEARCH_ENABLED === '1';
```

This makes outbound web reading opt-in. If the product owner insists default-on, docs must say "Penny may make outbound web requests when web reading is enabled by default" in README/PRIVACY/INSTALL.

- [ ] **Step 2: Update `.env.example`**

Use:

```dotenv
PENNY_WEB_SEARCH_ENABLED=0
PENNY_WEB_ALLOW_PRIVATE_NET=0
```

- [ ] **Step 3: Tests**

Add or update a route/runtime test showing:

- default env disables web tools
- `PENNY_WEB_SEARCH_ENABLED=1` enables web tools
- private/loopback URLs remain blocked

- [ ] **Step 4: UI/status visibility**

If the UI already displays status, verify `webSearchEnabled` is visible in settings/status. If not, add a small non-alarming settings line: "Web reading: off/on".

## Task 9: Memory Transparency Surface

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/penny-app.js`
- Modify: `public/js/penny-memory-panel.mjs`
- Modify: `public/styles.css`
- Test: `test/penny-memory-panel.test.js`, `test/penny-transcript-ui.test.js`, browser smoke.

- [ ] **Step 1: Decide release behavior**

Preferred: show a safe Memory tab by default. Hide deep archive/debug internals behind an Advanced toggle.

Safe default should show:

- stable remembered facts
- pending suggestions/review candidates
- corrections or contradicted items
- purge/export controls if already present
- plain-language labels: "saved because you told me", "suggested, not saved", "archived context", "low confidence"

- [ ] **Step 2: Keep debug mode for deep internals**

Do not remove `?debug=1`; use it to expose PromptTruth, route artifacts, retrieval traces, and other developer diagnostics.

- [ ] **Step 3: Tests**

Add frontend tests that:

- default URL shows Memory tab
- default URL does not show advanced debug-only internals
- `?debug=1` exposes advanced inspector details

- [ ] **Step 4: Docs**

Update README and `docs/penny-for-new-developers.md` from Task 12 to describe canonical versus advisory memory in normal language.

If this is too big for the first /goal pass, create `docs/plans/penny-memory-transparency-followup-YYYY-MM-DD.md` and mark this task deferred with a reason. Do not leave it unaddressed.

## Task 10: Package Intent And Publish Protection

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `LICENSE` only if owner confirms wording change
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Decide npm posture**

Recommended for source-available private-release posture:

```json
"private": true,
"license": "UNLICENSED"
```

`private: true` blocks accidental `npm publish` while still allowing `npm pack`.

- [ ] **Step 2: If owner wants publishable tarballs later**

If `private: false` must remain, add:

```json
"publishConfig": {
  "access": "restricted"
}
```

and a README note that the repo is source-available, not open-source.

- [ ] **Step 3: Verify package**

Run:

```bash
npm pack --dry-run
npm pack --dry-run --ignore-scripts
```

Expected: both pass. Package file list should include `.env.example` and Penny launchers, not Lyra-only launchers or local residues.

## Task 11: Release Hygiene, Public Leak Checks, And Docs Partition

**Files:**
- Create: `scripts/check-public-path-leaks.js`
- Possibly create: `scripts/check-doc-links.js`
- Modify: `package.json`
- Modify/move docs under `docs/public/`, `docs/dev/`, `docs/archive/` or existing repo structure
- Modify: `docs/README.md`

- [ ] **Step 1: Add public path leak check**

Create `scripts/check-public-path-leaks.js` that scans tracked release files for:

- `C:\Users\`
- `C:/Users/`
- `.openclaw\workspace-main`
- `.openclaw/workspace-main`
- `workspace-main/lyra-prototype`
- owner-specific local username if present in public release files

Allowlist historical archived docs only if the repo deliberately keeps them. Better: move truly private local runbooks to `docs/archive/` and label them historical/local-operator only.

- [ ] **Step 2: Add script**

```json
"check:public-path-leaks": "node scripts/check-public-path-leaks.js"
```

Add it to `check:release`.

- [ ] **Step 3: Docs partition**

Create or update `docs/README.md` sections:

- New user docs
- Developer docs
- Release/QA docs
- Historical/archive docs

Make it clear that historical research/planning docs are not current runtime law.

- [ ] **Step 4: Link/package validation**

If package docs link to files omitted from npm `files`, either include the target docs or rewrite package-facing docs so package readers do not hit broken links.

## Task 12: New Developer Guide And Doctor Command

**Files:**
- Create: `docs/penny-for-new-developers.md`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `INSTALL.md`
- Possibly modify: `scripts/penny-preflight.js`

- [ ] **Step 1: Add `npm run doctor`**

Add:

```json
"doctor": "node scripts/penny-preflight.js"
```

Keep `preflight` as an alias.

- [ ] **Step 2: Make preflight novice-friendly**

Verify `scripts/penny-preflight.js` clearly reports:

- Node/npm version
- local endpoint reachability
- model list and selected model
- embed readiness
- web reading default
- LAN/token posture
- exact next command when something is missing

If it does not, add those messages.

- [ ] **Step 3: Create new developer doc**

Create `docs/penny-for-new-developers.md` with these headings:

```markdown
# Penny For New Developers

## Fast Mental Model

## What Starts When I Run `npm start`?

## What Happens When I Send A Message?

## Where Memory Lives

## Chat Lane Versus Tool Lane

## How File Tools Work Safely

## Web Reading And Privacy

## How To Change One Thing Safely

## Files To Ignore At First

## Useful Commands
```

Keep the tone clear and Penny-flavored, but make this a practical explainer, not a marketing page.

- [ ] **Step 4: Link it**

Add link from README and `docs/README.md`.

## Task 13: Node Version, ESM/CJS Clarity, And Cross-Platform Story

**Files:**
- Modify: `README.md`
- Modify: `INSTALL.md`
- Modify: `docs/penny-for-new-developers.md`
- Modify: `scripts/penny-preflight.js` if needed
- Possibly modify tests or frontend module filenames if Node import errors reproduce.

- [ ] **Step 1: Justify or change Node 24**

Run:

```bash
node -v
npm -v
npm test
```

If Node 24 is truly required, add one sentence:

```markdown
Penny pins Node 24.x for the current test/runtime surface; older Node versions may run parts of the app but are not release-supported.
```

If Node 22 is intended to work, change `engines`, CI matrix, and docs only after tests pass on both Node 22 and Node 24.

- [ ] **Step 2: ESM/CJS ambiguity**

If any Node 24 tests fail because browser `.js` modules use ESM `export`, fix the loader/test harness or rename frontend-only modules to `.mjs`. Do not rename broadly without checking import paths.

- [ ] **Step 3: Cross-platform wording**

Make install docs explicit:

- `npm start` is portable foreground mode.
- durable background launchers are currently Windows PowerShell.
- macOS/Linux users should use foreground mode for this release.
- LM Studio local server setup is external to Penny.

## Task 14: Optional Dependency And Feature Flag Sprawl

**Files:**
- Modify: `CODEBASE.md`
- Modify: `docs/penny-for-new-developers.md`
- Possibly create: `docs/penny-configuration-profiles.md`
- Possibly modify: `README.md`

- [ ] **Step 1: Document `@yarflam/potion-base-8m`**

Add a short section:

- What it is: optional in-process static embedding provider.
- Why optional: Penny can run without it; LM Studio/semantic fallback still works.
- Runtime posture: local package files after install; no runtime network by default.
- Authority boundary: candidate discovery only, not truth authority.
- License/supply-chain note: exact pinned optional dependency; keep review receipts in docs.

Use existing docs under `docs/plans/penny-static-embedding-live-reflex-plan-2026-04-22.md` as evidence.

- [ ] **Step 2: Feature flag map**

Create `docs/penny-configuration-profiles.md` if one does not exist. Include:

- Minimal local companion profile
- Web-reading opt-in profile
- LAN/phone profile
- QA/browser-smoke profile
- Memory-heavy QA profile
- Advanced experimental memory/static embedding profile

Each profile should list env vars and the risk boundary.

- [ ] **Step 3: Do not refactor all flags in this pass**

Feature flag sprawl is real, but a runtime mode registry is a later architecture task unless the first-pass docs/preflight are still confusing. If deferred, write the follow-up plan path in the final result.

## Task 15: Pending Workspace Writes Persistence Decision

**Files:**
- Modify: `lib/penny-project-tools.js` only if implementing persistence
- Modify: UI/docs if documenting temporary semantics
- Test: `test/penny-project-tools.test.js`
- Update: `SECURITY.md` or `docs/penny-for-new-developers.md`

- [ ] **Step 1: Choose behavior**

Recommended for this release: document the current safe behavior instead of persisting pending writes.

Current behavior: pending writes are process-memory only and disappear on restart. This is safer but can surprise users.

- [ ] **Step 2: Add UI/docs copy**

Add clear text wherever pending writes are surfaced:

```text
Pending workspace edits are temporary and disappear when Penny restarts.
```

- [ ] **Step 3: If implementing persistence**

Only implement persistence if explicitly chosen. Persist to an ignored local file with:

- base file hash
- creation time
- TTL
- exact path
- patch/content

Approval must still check current file hash before applying.

## Verification Plan

Run these before final sign-off. Label failures honestly.

```bash
node --test test/penny-api-security.test.js
node --test test/penny-project-tools.test.js
node --test test/penny-release-artifacts.test.js test/penny-required-release-files.test.js test/penny-skill-pack.test.js
npm run check:required-files
npm run check:release-artifacts
npm run check:frontend-privacy
npm run check:public-path-leaks
npm test
npm run check
npm pack --dry-run
npm pack --dry-run --ignore-scripts
```

Source archive simulation:

```bash
rm -rf tmp/release-critique-source-archive
mkdir -p tmp/release-critique-source-archive
git archive --format=tar HEAD | tar -x -C tmp/release-critique-source-archive
(
  cd tmp/release-critique-source-archive
  test ! -d .git
  npm ci
  npm run check:release
  npm pack --dry-run
)
```

Browser smoke:

```bash
npm run qa:browser:install
npm run qa:browser:smoke
```

If Playwright browser install is skipped, final result must say `not run` and explain why.

Optional live model QA should not be run unless explicitly requested and the local model state is protected:

```powershell
$env:PENNY_QA_STRICT_NO_MODEL_OPS="1"
$env:PENNY_QA_MANAGE_MODELS="0"
npm run qa:memory:semantic
```

## Cleanup Rules

- Do not commit ignored `output/`, `tmp/`, `logs/`, `.qa-pw/`, `.playwright-cli/`, `data/penny-memory*.json`, or live QA artifacts.
- Do not commit untracked `./.openclaw/` or `./lyra-prototype/`.
- If browser QA creates Playwright output, keep only referenced artifacts if the user asks; otherwise leave ignored.
- If any disposable source archive or package tarball is created under `tmp/`, leave it ignored and mention it only as a receipt.

## Final Response Requirements For The Goal Agent

Final response must include:

- Files changed.
- Issues fixed.
- Issues explicitly deferred and why.
- Commands run with pass/fail.
- Source archive self-check result.
- `npm pack --dry-run` result.
- Browser smoke result or `not run`.
- Git status summary.
- Whether any reviewer claim was found stale/already fixed.

## Remaining Product-Level Decisions To Surface If Not Fixed

- Desktop wrapper/Tauri/Electron is not required for this source-release pass. Create a later plan only if the user wants consumer-installer polish.
- Oversized `lib/` files are not release blockers unless they block one of the fixes. Do not broad-refactor them in this pass.
- Memory mixed-drift live QA currently has a known hard-case failure from `output/memory-qa-mixed-drift-2026-05-18T02-45-52-947Z.json` in this local workspace. Do not claim all memory behavior is solved. The semantic archive QA passed, but mixed correction drift needs follow-up.
- README remote badges are acceptable for GitHub display if the privacy docs say the local app itself does not fetch third-party assets. If the owner wants zero external README assets, replace badges with plain Markdown text.

## Notes For The Human

The best execution order is:

1. `.env.example`, required files, and no-Git release checks.
2. Security hardening and secret file read protection.
3. Web reading default/docs and browser smoke install.
4. Penny/Lyra naming cleanup and root hygiene.
5. New developer docs, optional dependency notes, and configuration profile docs.

That order turns the scariest reviewer failures into objective green checks before touching product-polish decisions.
