# Penny Release Checklist

Run before cutting a public release branch or package:

- `npm ci`
- `npm run check`
- `npm test`
- `npm run doctor`
- `npm run qa:browser:install`
- `npm run qa:browser:smoke`
- `npm pack --dry-run --json`
- `npm pack --dry-run --ignore-scripts --json`
- `git diff --check`
- `node --test test/penny-installer.test.js`
- `node scripts/check-release-artifacts.js`
- `node scripts/check-frontend-privacy.js`
- `node scripts/check-public-path-leaks.js`

Source-archive simulation:

```bash
rm -rf /tmp/pennyos-source-archive
mkdir -p /tmp/pennyos-source-archive
git archive --format=tar HEAD | tar -x -C /tmp/pennyos-source-archive
cd /tmp/pennyos-source-archive
npm ci
npm run check:release
npm pack --dry-run
```

GitHub release-page checks:

- Root README presents the project as `PennyOS`, not as an internal branch note.
- README preview image renders from a tracked `public/sprites/` asset.
- `package.json` repository, homepage, bugs URL, description, and keywords point at `BitofShoe/PennyOS`.
- Historical handoffs and chat-era notes live under `docs/archive/`, not at repo root.
- `docs/README.md` labels archived, public, historical, generated, and current-law docs clearly.

Expected release properties:

- GitHub source ZIP users get root `Install-Penny.ps1` and `Install-Penny.cmd`.
- The installer checks Node 24/npm 11, creates `.env`, runs `npm ci`, and creates PennyOS shortcuts.
- default bind host is loopback
- LAN sharing requires `PENNY_LAN_SHARE=1`
- LAN API access requires a token
- workspace write tools stage pending patches unless direct-write mode is explicitly enabled
- pending workspace edits are temporary and disappear when Penny restarts
- web reading/search is off unless `PENNY_WEB_SEARCH_ENABLED=1`
- web fetches block private/internal targets unless explicitly allowed
- generated artifacts, local memory, local logs, private notes, and secrets are not tracked
- README, install, security, and privacy docs match the current code

## Latest Local Release Receipt

Date: 2026-05-18 local time / 2026-05-19 UTC.

Scope: local static/package checks plus mock-browser QA for `codex/penny-installable-local-companion-release`. This does not claim a live LM Studio model-quality pass.

Environment:

- WSL shell: Node `v24.15.0`, npm `11.12.1`.
- Windows `cmd.exe` probe: Node `v24.14.0`, npm `11.9.0`; `node scripts\check-release-engine.js` passed.
- Browser smoke: disposable/mock QA server path, not the user's live loaded LM Studio model.

Passed:

- `npm ci` - added 1 package, audited 2 packages, 0 vulnerabilities.
- `npm run check` - release checks passed; `990` tests, `987` pass, `3` todo.
- `npm pack --dry-run` - prepack checks passed; dry-run tarball reported `370` files and about `89.6 MB` packaged.
- `npm run qa:browser:install` - Playwright Chromium installed/available.
- `npm run qa:browser:smoke` - passed; artifact: `output/playwright/penny-browser-smoke-2026-05-19T01-33-50-907Z.json`.

Known local-live gap:

- `npm run doctor` passed Node/npm and local policy checks, but failed in this WSL shell because the LM Studio CLI was not on WSL `PATH` and `http://127.0.0.1:1234/v1` was not reachable from WSL. Treat that as the remaining live Windows/LM Studio setup check, not as a source/package failure.
