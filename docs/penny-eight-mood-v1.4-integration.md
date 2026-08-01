# Penny eight-mood v1.4 integration receipt

## Result

Candidate B — Relaxed diagonal wink — is the v1.4 production flirty expression. Its selected source and the live production composite are byte-identical at SHA-256 `88735dcd514ebba5df97526bc3a8461b2845bc30c79ff429dbc168149da5728f`. No redraw, shape edit, simplification, or eyelid reconstruction occurred during promotion.

PennyOS now loads `public/sprites/packs/penny-2d25d-v1.4/manifest.json`. Vessel D is frozen as `6:5`, `contain`, centered. The CSS freeze SHA-256 is `2f16546be61abe0964c908f9c6e11b2ac41a190a5d756d8dd1ee6416289cd2a3`.

## Upstream asset proof

- v1.2 controlling archive SHA-256: `4a700986d7d2703f9e3da40e5835da01faefbe93af480107684f4865ff7e3849`.
- v1.4 archive SHA-256: `f7ae7631b76bcc4a5a9afee4e1e1b9e9ca128842ef8ac27eda31f181828238c7`.
- Frozen master SHA-256: `ea4abf0a98567898d4d658372fe99d2e2c5169106b0b264e2e9566aac9162d04`.
- Changed production pixels: `15,152`, bbox `[306,436,500,571)` inside allowed eye/socket box `[295,425,505,575)`.
- Selected and promoted localized-pixel SHA-256: `7c0658afb684a9b632e441356b1f7cc5228a463b9f0d2dae4a8846c0867cc762`.
- Outside-box changes: `0`; alpha-channel changes: `0`; exact recomposition mismatches: `0`.
- Exactly three upstream production files differ from v1.2: the wink control, flirty overlay, and flirty composite.
- Frozen master, five physical layers, and seven non-flirty overlays/composites are byte-identical to v1.2.
- All eight public mood keys and all `1024×1024 RGBA` registrations are preserved.

Strict machine receipt: `output/penny-eight-mood-v1.4-closeout/20260801T045839Z/PENNY_EIGHT_MOOD_V14_ARCHIVE_VERIFICATION.json`.

## Browser and visual proof

`scripts/qa-penny-eight-mood-assets.js` passed `22/22` checks with model preparation and LM Studio CLI discovery disabled. Vessel D was safe at `1280×860` and `1280×720` and measured `1.235×` the displayed alpha area of Vessel B. Desktop, complete mobile, 96px transcript, 62px mobile, reduced-motion, image fallback, manifest fallback, rapid-change, and transition checks passed.

Every sampled happy-to-flirty transition frame contained exactly one image node and one complete mood source. The three browser 404s were deliberate isolated fallback probes; normal rendered lanes had no unexpected console warnings, errors, failed requests, or missing assets.

Visual index: `output/penny-eight-mood-v1.4-closeout/20260801T045839Z/PENNY_EIGHT_MOOD_V14_FINAL_PRODUCTION_RECEIPT.png`.

## Release and package proof

- Focused expression tests: `23/23` pass.
- Existing end-to-end Penny browser smoke: `18/18` checks pass using its isolated mock services.
- Full `npm run check:release`: pass; `1,277/1,277` tests pass.
- `npm pack --dry-run --json`: pass; `486` entries, v1.4 included, no v1.3 path.
- `npm pack --dry-run --ignore-scripts --json`: pass; same `486`-entry inventory.
- Tauri wrapper tests: `13/13` pass.
- Sidecar staging: `205` files; v1.4 included; no v1.3 path; no private state; staged flirty SHA equals Candidate B.
- Tauri no-bundle release compile: pass.
- Tauri MSI and NSIS build: pass.
- Stripped-PATH consumer smoke: pass; bundled `penny-node.exe`; Node/npm/Cargo/Rust absent; `/api/penny/status` HTTP `200`; clean shutdown.

The install/uninstall clean-proof harness was deliberately not run because a user-owned Start Menu shortcut already points to `E:\L MART\PennyOS\pennyos.exe`; the harness would overwrite that shortcut and may alter existing installer registration. This is a preservation boundary, not a build failure.

## State boundary

No model was started, stopped, loaded, unloaded, reloaded, or swapped. No Lane B work began. The work remains unstaged and uncommitted for review.
