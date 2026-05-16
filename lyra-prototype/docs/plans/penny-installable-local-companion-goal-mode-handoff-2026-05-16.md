# Penny Full-Fat Installable Local Companion Release

Codex `/goal` handoff for turning the current Penny repo into a polished, installable, local-first companion app without shrinking it into a demo.

Date: 2026-05-16
Target repo/app: `lyra-prototype` / Penny
Preferred branch: `codex/penny-installable-local-companion-release`

## Goal Prompt To Paste Into Codex CLI

Paste this as the `/goal` objective, then attach or reference this file:

```text
/goal
Make the Penny repo a full-fat installable local companion app release branch, preserving the current local functionality, personality, memory behavior, and companion-first experience while making the GitHub-facing repo secure, polished, package-ready, and honest about its local-first boundaries.

Do not build a limited demo, stripped-down sample, or public showcase fork. The release branch may add explicit safety gates, release-mode defaults, docs, install scripts, CI, and repo cleanup, but Penny must remain the same real local companion app when configured by the user.

Start from the current main branch. Use subagents for independent security, repo, docs, frontend/privacy, and QA slices. Keep edits scoped, prove behavior with tests, and stop only when the acceptance checklist in docs/plans/penny-installable-local-companion-goal-mode-handoff-2026-05-16.md is satisfied or a real blocker is documented with receipts.
```

OpenAI references:

- Follow goals guide: <https://developers.openai.com/codex/use-cases/follow-goals>
- Subagents guide: <https://developers.openai.com/codex/subagents>
- Slash commands guide: <https://developers.openai.com/codex/cli/slash-commands>

## Non-Negotiables

- Full-fat only. No demo mode, no sample-only companion, no "public-lite" runtime.
- Preserve Penny's current local personality, voice, memory architecture, tool behavior, and companion-first design unless a change is explicitly needed for security or packaging.
- Security hardening can be bespoke to the GitHub/release branch. Do not weaken the user's current local convenience unnecessarily; instead use explicit release-safe defaults and opt-in local power toggles.
- Do not commit private memories, local data, logs, generated QA artifacts, secrets, `.env` files, personal paths, or user-specific runtime state.
- Do not sand Penny into a generic assistant while cleaning the repo.
- Do not blur historical docs, source/persona material, generated artifacts, current implementation law, and public install docs.
- Do not trust subagent agreement alone. Require file refs, tests, command receipts, or explicit advisory status.
- Do not leave the repo in a state where README claims outrun code, tests, or install behavior.

## Starting Protocol

1. Read repo instructions first:
   - `AGENTS.md`
   - `SOUL.md`
   - `USER.md`
   - `README.md`
   - `CODEBASE.md`
   - `ARCHITECTURE.md`
   - `docs/README.md`
   - `docs/plans/TEMPLATE.md`
2. Confirm git state:
   - `git status --short --branch`
   - `git remote -v`
   - `git fetch --all --prune`
   - `git status --short --branch`
3. Create an isolated working branch or worktree:
   - `git switch -c codex/penny-installable-local-companion-release`
   - If the main worktree has unrelated local edits, use a git worktree instead.
4. Keep a running implementation ledger in a plan note or PR body:
   - files read
   - files edited
   - tests run
   - not-run checks and why
   - security decisions
   - behavior preserved

## Skill And Subagent Setup

Use subagents aggressively, but keep ownership clean. The repo instructions allow at most six live subagents. Close agents when done.

Recommended subagents:

- Security routes/auth agent: `server.js`, `lib/penny-server-http.js`, `lib/penny-route-handlers.js`, any new API security helper, route security tests.
- Web fetch/SSRF agent: `server.js`, `lib/penny-web-tools.js`, any new URL safety helper, web fetch tests.
- Write-tool approval agent: `lib/penny-project-tools.js`, tool registry/runtime files, pending patch protocol tests.
- Repo/package/docs agent: README, install docs, `package.json`, CI, `.gitignore`, doc/archive mapping.
- Frontend/privacy agent: `public/index.html`, local fonts/assets, browser bootstrapping, UI unlock surfaces.
- QA/release agent: `npm run check`, targeted regression tests, artifact/privacy guards, browser smoke if UI changed.

Keep one primary editing owner per file boundary. If two agents need the same file, coordinate through the parent agent before either writes.

### Finding Skills When Paths Differ

Codex CLI skill paths vary by install. Do not hard-fail if a documented path is missing.

Search in this order:

```bash
find . -path '*/SKILL.md' -print
find "${CODEX_HOME:-$HOME/.codex}" -path '*/SKILL.md' -print 2>/dev/null | head -200
rg -n "superpowers|penny-qa-release|penny-lmstudio|penny-memory" . "${CODEX_HOME:-$HOME/.codex}" 2>/dev/null
```

Repo-local Penny skills are expected under:

```text
.codex/skills/
```

Start with:

```text
.codex/skills/README.md
```

Useful Penny skills:

- `penny-qa-release`: release-style QA, readiness checks, local eval artifact interpretation.
- `penny-lmstudio-ops`: LM Studio readiness, local model state, Windows/WSL runtime checks.
- `penny-memory-inspector`: explicit/archive/semantic memory inspection and safe cleanup.
- `penny-link-review`: external source and repo-fit reviews.

Superpowers skills may live in a plugin cache such as:

```text
$CODEX_HOME/plugins/cache/openai-curated/superpowers/.../skills/
```

If that exact path does not exist, search for `using-git-worktrees/SKILL.md`, `subagent-driven-development/SKILL.md`, or `verification-before-completion/SKILL.md`.

Recommended Superpowers sequence:

- `using-git-worktrees`: before starting if the current tree is not clean.
- `writing-plans`: if turning this handoff into a detailed execution plan.
- `subagent-driven-development`: when dispatching the independent agents above.
- `systematic-debugging`: before fixing unexpected test failures.
- `verification-before-completion`: before claiming the branch is done.
- `finishing-a-development-branch`: before merge, PR, or release wrap-up.

If Superpowers is unavailable, continue using the equivalent behavior: isolated branch, explicit plan, tests before claims, and receipt-backed completion.

## Product Shape

The public repo should say, in code and docs:

- Penny is a local-first personal companion app.
- Penny is installable and runnable by another local user.
- Penny can still use LM Studio and local models.
- LAN/phone access is a feature, but it is explicit opt-in.
- Tool-capable routes and workspace writes are high-power and gated.
- Private user memory/data is never part of the public repo.
- The app is not a hosted SaaS and should not be exposed directly to the public internet.

The goal is "polished local companion app," not "enterprise platform."

## Phase 0 - Baseline Inventory

Produce a short baseline report before editing:

- current branch and remote status
- Node/npm versions
- current `npm test` result
- current security-sensitive route map
- current tracked artifact/noise map
- current public README/install gaps
- current external network calls in shipped UI

Suggested commands:

```bash
git status --short --branch
node --version
npm --version
npm test
rg -n "server.listen|listen\\(|/api/penny|fetch\\(|Google Fonts|fonts.googleapis|fonts.gstatic|write_project_file|replace_in_project_file|insert_in_project_file" server.js lib public test README.md package.json
git ls-files | sed 's#/[^/]*$##' | sort | uniq -c | sort -nr | head -50
git ls-files | rg '(^output/|playwright|screenshot|\\.png$|memory|\\.env|local|private|Kimi|kimi|Playground|handoff|Today)'
```

Do not treat this report as success. It is the starting snapshot.

## Phase 1 - P0 Local/LAN API Security

Problem: the current server is LAN-friendly. That is useful, but unsafe as a default if powerful `/api/*` routes can be reached by any device on the network.

Required behavior:

- Bind to `127.0.0.1` by default.
- Bind to `0.0.0.0` only when `PENNY_LAN_SHARE=1`.
- Print LAN URLs only when `PENNY_LAN_SHARE=1`.
- Require a real access token for all `/api/*` routes in LAN mode.
- Prefer token protection always for write-capable routes, even on localhost, unless a deliberate local dev bypass is documented.
- Reject unexpected `Origin` values.
- Reject unexpected `Host` values.
- Require JSON content type for JSON mutation routes.
- Hide private local file paths from unauthenticated or failed status responses.
- Add strict tests for memory read/write/purge, model change, chat, status, and tool-capable routes.

Likely files:

- `server.js`
- `lib/penny-server-http.js`
- `lib/penny-route-handlers.js`
- new helper if useful: `lib/penny-api-security.js`
- tests under `test/`
- README/security docs

Implementation preference:

```js
const host = process.env.PENNY_LAN_SHARE === '1' ? '0.0.0.0' : '127.0.0.1';
server.listen(port, host, () => {
  // Always print localhost.
  // Print LAN addresses only when PENNY_LAN_SHARE=1.
});
```

Do not hardcode a token into browser assets. Use a local-only bootstrap mechanism, a generated local session secret, an env var, or another explicit pattern that does not leak into git.

Regression tests must cover at least:

- default server host is loopback
- LAN host is opt-in
- LAN API request without token is rejected
- invalid token is rejected
- valid token is accepted for intended routes
- unexpected Origin is rejected
- mutation with non-JSON content type is rejected
- memory purge rejects without strongest gate
- model change rejects without strongest gate

## Phase 2 - P0 Web Fetch / SSRF Hardening

Problem: arbitrary URL fetches are high-power in a local companion app. They can reach local services, router/admin pages, LM Studio endpoints, or metadata services unless blocked.

Required behavior:

- Normalize only `http:` and `https:` URLs.
- Block loopback, localhost, `0.0.0.0`, private RFC1918 ranges, link-local ranges, multicast, unique-local IPv6, and metadata service addresses by default.
- Resolve DNS before fetch and block private/internal targets.
- Re-check the final response URL after redirects.
- Block public-to-private redirects.
- Stream response bodies and abort once byte limit is exceeded.
- Add explicit opt-in for private network fetches:
  - `PENNY_WEB_ALLOW_PRIVATE_NET=1`
- Keep the default safe.

Likely files:

- `server.js`
- `lib/penny-web-tools.js`
- new helper if useful: `lib/penny-web-url-safety.js`
- tests under `test/`

Regression tests must cover:

- `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` blocked
- common private ranges blocked
- link-local and metadata IPs blocked
- redirect to private target blocked
- private fetch allowed only with explicit opt-in
- byte limit enforced while streaming, not after full body read
- DuckDuckGo redirect handling still works for safe public URLs

## Phase 3 - P1 Workspace Write Approval Boundary

Problem: project-file write tools are useful for a trusted local prototype but too powerful to execute silently in a LAN-accessible installable app.

Current high-power tools to inspect:

- `write_project_file`
- `replace_in_project_file`
- `insert_in_project_file`

Required behavior:

- Keep the tools. Do not remove the full-fat capability.
- Add a hard approval boundary before filesystem writes.
- Release-safe default should be dry-run or pending patch.
- Direct writes require explicit opt-in, such as:
  - `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`
  - per-session UI unlock
  - path-level allowlist
  - two-phase pending patch approval
- Tool metadata like `sideEffectClass: "workspace-write"` is useful but not sufficient.
- Add receipts so the user can inspect what would change before applying it.

Preferred model:

1. First tool call creates a pending patch receipt.
2. UI shows the pending patch.
3. Human approval applies it.
4. Direct write mode remains available only through explicit local opt-in.

Likely files:

- `lib/penny-project-tools.js`
- tool registry/runtime files
- route handlers that execute tools
- frontend UI surface if approval is in-browser
- tests under `test/`

Regression tests must cover:

- default write tools do not mutate disk
- pending patch receipt contains intended path and diff
- approval applies only the pending patch
- approval cannot escape the project root
- direct write mode only works with explicit unlock
- denied or expired pending writes leave files unchanged

## Phase 4 - Repo Boundary And Public Package Shape

Problem: the current workspace has app code, personal workspace material, old handoffs, generated artifacts, persona/source notes, and legacy adjacent machinery mixed together. That is fine privately, but not for a clean public/installable repo.

Decision to make early:

- Is the public repo root the `lyra-prototype` app itself?
- Or is this an umbrella repo with `apps/penny/`, `docs/`, `archive/`, and private-source folders?

Recommendation:

- Make the Penny app the public source of truth.
- If keeping the umbrella shape, make app/package boundaries obvious and do not require private parent workspace files.
- Move or archive old root/handoff/persona/source material into clearly named non-runtime folders.
- Keep private memory/data ignored.

Cleanup targets to audit:

- generated screenshots and Playwright output
- root handoff docs
- root personality/source material
- old Kimi/OpenClaw scripts not needed by Penny install
- hardcoded Windows paths in public docs
- local-only recovery/chat-looking files
- large artifacts that are not shipped UI assets
- stale "prototype" naming where it harms installable app framing

Do not delete first. Classify files:

- runtime app
- shipped asset
- current docs
- install docs
- security docs
- test fixture
- source/persona material
- historical archive
- generated artifact
- private/local only
- legacy adjacent tool

Then move or ignore based on classification.

Likely files:

- `README.md`
- `CODEBASE.md`
- `ARCHITECTURE.md`
- `docs/README.md`
- `package.json`
- `.gitignore`
- `.gitattributes`
- CI files
- new `SECURITY.md`
- new `PRIVACY.md`
- new `INSTALL.md` if needed
- maybe `docs/archive/` or `docs/source-material/`

Public README should include:

- what Penny is
- privacy/local-first boundaries
- prerequisites
- LM Studio setup
- install steps
- first run
- localhost default
- LAN sharing opt-in
- token setup
- tool/write approval model
- test/check commands
- troubleshooting
- what is intentionally not included

Avoid private absolute paths. Use generic paths.

## Phase 5 - Local-First Frontend Privacy

Problem: a private local companion should not contact Google Fonts just by opening the UI.

Required behavior:

- Remove `fonts.googleapis.com` and `fonts.gstatic.com` from shipped UI.
- Use system fonts or vendored local fonts.
- If vendoring fonts, include license files and document provenance.
- Add a simple check that fails if shipped HTML/CSS references Google Fonts or other unexpected external font hosts.

Likely files:

- `public/index.html`
- CSS files under `public/`
- assets under `public/`
- README/privacy docs
- tests or `npm run check` guard

Regression check:

```bash
rg -n "fonts\\.googleapis|fonts\\.gstatic|google fonts" public README.md docs package.json
```

Expected result should be no shipped external font dependency, except historical docs if explicitly archived.

## Phase 6 - Runtime / Platform Contract

Problem: package metadata currently suggests a specific Node/npm lane, while tests may pass on nearby versions. The release repo should make the supported path clear.

Required behavior:

- Decide supported Node version:
  - If Node 24 is truly required, CI must prove Node 24.
  - If Node 22 works and is desired, loosen engines and test both Node 22 and 24.
  - If parts require Node 24 but fixture tests pass on Node 22, document the split.
- Add one blessed contributor command:
  - `npm run check`
- Make CI run the blessed command on the supported version.

Recommended `npm run check` ingredients:

```bash
node --check server.js
node --test test/*.test.js
npm run qa:memory:source-sensitive
npm run eval:aliveness:fixture
```

Add lint/format/static checks only if they are lightweight and repo-appropriate. Do not derail the release with a large style migration.

Likely files:

- `package.json`
- `package-lock.json`
- CI workflow files
- README/install docs
- preflight scripts

## Phase 7 - Installable App Polish

The release should feel installable, not merely runnable from a private workspace.

Minimum package-ready improvements:

- Clean README with quickstart and boundaries.
- Install/run commands that work from a fresh clone.
- `.env.example` with safe placeholders.
- Security docs that explain LAN/token/write-tool behavior.
- Privacy docs that explain local memory, LM Studio, web fetch, and external network calls.
- Troubleshooting docs for LM Studio, Node version, Windows/WSL, and LAN phone access.
- Clear scripts:
  - `npm start`
  - `npm run start:durable`
  - `npm run stop`
  - `npm test`
  - `npm run check`
  - `npm run preflight`
- CI running `npm run check`.
- Generated artifact guard.
- No private data in tracked files.

Nice-to-have if time remains:

- Release checklist in `docs/release-checklist.md`.
- Screenshot or local UI preview using safe shipped assets.
- `SECURITY.md` with responsible local-use warnings.
- `PRIVACY.md` with offline-first and opt-in network call table.
- `CONTRIBUTING.md` with test and doc authority guidance.

## Phase 8 - Verification Matrix

Before declaring the goal complete, run and record:

```bash
npm run check
npm test
npm run preflight
```

Run targeted tests added for:

- API auth/LAN host behavior
- JSON content-type enforcement
- Host/Origin validation
- memory purge/model/chat route rejection without token
- web fetch SSRF blocking
- web fetch streaming byte limit
- write-tool approval boundary
- no external Google Fonts in shipped UI
- no private memory/data/log artifacts in tracked release files

Also run:

```bash
git status --short --branch
git diff --check
git ls-files | rg '(^data/penny-memory|\\.env$|\\.lyra-|output/playwright|private|secret|token|memory/20[0-9]{2}-[0-9]{2}-[0-9]{2})'
```

If frontend UI changes occurred, run browser smoke or Playwright coverage appropriate for this repo and attach screenshots or artifact paths. Avoid live LM Studio-heavy QA unless the repo-local QA skill says it is safe and the user's loaded model state is protected.

## Done Means

The branch is done only when all are true:

- Penny still runs as the full local companion app.
- Localhost is the default bind target.
- LAN sharing is explicit opt-in.
- LAN API access requires a token.
- Powerful write/memory/model/chat routes are gated.
- Web fetch blocks private/internal targets by default.
- Web fetch enforces byte caps while streaming.
- Workspace write tools have a human approval boundary or explicit local unlock.
- Public docs explain install, privacy, security, LM Studio, LAN, and write tools honestly.
- Public docs no longer rely on private absolute paths.
- Shipped UI does not call Google Fonts.
- Node/npm support is documented and CI-tested.
- `npm run check` exists and passes.
- No private memory/data/log/generated QA residue is tracked.
- Any remaining archive/source material is clearly labeled.
- Tests and receipts are captured in the final goal summary.

## Stop And Ask Only For Real Blockers

Do not stop for questions the repo can answer. Stop and ask only if:

- a private memory/persona file must be moved or deleted and classification is genuinely ambiguous;
- an install/security choice would intentionally remove current full-fat local functionality;
- CI or package publishing requires credentials;
- a required live LM Studio check would disturb the user's loaded model state;
- subagent or `/goal` tooling is unavailable and there is no safe fallback.

## Troubleshooting `/goal`

If `/goal` is unavailable in Codex CLI:

- Check the installed Codex CLI version.
- Check whether the feature is enabled but the slash command is not exposed.
- Check official slash command docs before trying random restarts.
- Continue with this document as a normal execution plan if necessary, preserving the same acceptance criteria.

If subagents are unavailable:

- Continue in one agent, but keep the same ownership map as sections.
- Finish one file boundary before starting another.
- Preserve receipts for each phase.

## Final Goal Summary Template

Use this shape when closing the `/goal`:

```markdown
## Summary

Penny is now packaged as a full-fat installable local companion app branch, with release-safe security defaults and preserved local functionality.

## Files Changed

- ...

## Security Changes

- ...

## Full-Fat Behavior Preserved

- ...

## Tests / Receipts

- `npm run check` - pass
- `npm test` - pass
- ...

## Not Run

- ...

## Remaining Risks

- ...

## Suggested Next Step

- ...
```
