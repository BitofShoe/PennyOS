# Penny Release Plan Ledger

> Category: Release status overlay
> Authority: Current execution receipt, not a replacement for the older handoffs
> Status: Active as of 2026-05-25
> Use this for: deciding which older release-handoff items are landed, still real, or deferred
> Do not use this for: claiming live LM Studio, LAN, Tauri, or packaging checks passed in this run

## Source handoffs

- `docs/plans/penny-installable-local-companion-goal-mode-handoff-2026-05-16.md`
- `docs/plans/penny-release-critique-goal-mode-handoff-2026-05-17.md`
- Current execution ledger: `docs/plans/penny-docs-remaining-feature-audit-execution-ledger-2026-05-25.md`

## Landed or now covered

- Cross-platform project path safety: verified by `node --test test/penny-project-tools.test.js`.
- Pending workspace write persistence: pending edits now survive server/API recreation in ignored local state and still recheck base hashes before approval.
- Web fetch TOCTOU hardening: Penny web tools now use a verified-address transport that connects to the prechecked address and blocks private final peers unless private access is explicitly allowed.
- Memory export: `GET /api/penny/memory/export` returns canonical explicit memory only, is token-gated like other sensitive memory controls, and exposes a remembered-facts export affordance in the memory panel.
- Offline knowledge source artifacts: conversation import now records `penny-source-artifact.v1` receipts with raw-file SHA-256 checksums and threads source artifact IDs through chunks and review packets.
- Fixture canaries: sensitive-memory suppression, entity collision, capability honesty, memory books, chapter compression, prompt-stack separation, and lane compare fixture coverage now have focused tests.

## Still real release work

- Final package/install verification remains live/local work and was not run here.
- Live mixed-drift memory QA, browser smoke, phone/LAN reset, and Tauri checks remain permissioned local/live checks.
- `server.js` and `public/js/penny-app.js` should stay thin orchestration shells; avoid growing them when extracted owners exist.
- The lane compare runner is fixture-only by default. Live isolated per-profile comparison still requires explicit model-management approval, one profile at a time, with disposable state and cleanup receipts.

## Deferred or intentionally not built

- Graph DB, RDF, JSON-LD, SPARQL, triplestore, public URI dereferencing, crawler/reasoner infrastructure.
- Hosted OCR, CMS, broad document chat, and generic document source maps without a concrete document workflow.
- Default static live-advisory, EmbeddingGemma, global thinking, huge context changes, PromptTruth expansion, or ToolEvidenceReceipt merge.
- Auto-promotion of reflections, links, static hits, semantic claims, or emotional salience into canonical explicit memory.

## Verification receipts

Use the execution ledger for exact commands and pass/fail output. As of this overlay, all claims above are `local/static` unless explicitly labeled as live/local deferred.
