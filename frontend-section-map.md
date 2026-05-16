# `public/` section map

**Purpose:** current-state map for the browser-side orchestration layer after the boring-sprint boundary pass.  
**Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CODEBASE.md](./CODEBASE.md), [docs/penny-module-ownership.md](./docs/penny-module-ownership.md)

This doc is the browser-side equivalent of `server-js-section-map.md`. Treat it as the map for the remaining frontend coordination shell, not as a promise that the UI is fully split yet.

Delegation note: if a task crosses frontend with backend, tests, or docs, treat that as a cue to delegate the read-only exploration, QA inspection, and doc mapping before a single editor writes the final change. Codex only gets six live subagents at once, so a spawn-limit error should be fixed immediately by closing or reusing agents before work continues. If the work needs a written plan, start from [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md).

---

## How to use this doc

1. Start here before touching `public/js/`.
2. If the behavior already lives in a small helper, extend that helper first.
3. If the behavior is still orchestration-heavy in `public/js/penny-app.js`, keep the change narrow and prefer a new named browser module for the feature slice.
4. Keep `public/app.js` bootstrap-only.

---

## Top-level files

Still in `public/`:

- `public/app.js`
Bootstrap only.
- `public/js/penny-app.js`
Main browser orchestration, transcript flow, streaming SSE handling, mood and sprite updates, memory/settings actions, and memory inspector wiring.
- `public/js/penny-lmstudio-ui.js`
LM Studio diagnostics and chat-model picker helpers.
- `public/js/penny-attachments.js`
Attachment prep and preview handling.
- `public/js/penny-storage.js`
Browser persistence and session-id helpers.
- `public/styles.css`
Visual styling.
- `public/index.html`
HTML shell.
- `public/sprites/*`
Mood art and decor assets.

---

## Remaining frontend ownership bands

### A. Bootstrap

Role:

- wire the app into the page
- avoid app logic

Target rule:

- never add feature behavior here

### B. Main orchestration shell

Role:

- transcript rendering
- streaming reply handling
- memory/settings actions
- inspector wiring
- mood/sprite state coordination
- coordination for ambient UI chrome helpers

Target rule:

- use this file to connect behavior, not to own every behavior slice

Accepted inputs:

- DOM references
- browser storage snapshot
- backend responses and event streams

Expected outputs:

- coordinated UI state updates
- browser persistence writes

Allowed side effects:

- DOM mutation
- fetch calls to Penny routes
- browser storage writes

### C. LM Studio UI helpers

Role:

- model picker UI
- connection/status display
- small diagnostics helpers

Target rule:

- keep the diagnostics widgets here instead of expanding `penny-app.js`

### D. Attachments

Role:

- file/image prep
- preview handling

Target rule:

- keep attachment-specific logic isolated from chat and memory UI

### E. Browser storage

Role:

- local session/persistence helpers

Target rule:

- do not move server-owned memory or archive state into browser storage

### F. Ambient chrome

Role:

- boot overlay
- emoji picker wiring
- idle flicker/interference
- parallax
- particles

Target rule:

- keep non-chat presentation chrome out of `penny-app.js`
- keep the interface explicit: DOM inputs in, teardown/hooks out

Accepted inputs:

- DOM references
- `window`
- small callbacks like `onComposerSubmit` or `onParticleBurstReady`

Expected outputs:

- chrome event wiring
- particle burst hook for the shell

Allowed side effects:

- DOM event listeners
- animation timers
- canvas drawing

---

## How to add frontend behavior without re-monolithing

- add new browser behavior to a small named `public/js/` helper before teaching `penny-app.js` another job
- keep `public/app.js` as the single bootstrap path
- if a browser helper starts owning two unrelated slices, split it before adding the next feature
- if a UI action needs a reason code or fallback path, make that decision visible in the slice that owns the action
- for cross-cutting work, let subagents gather the independent frontend, backend, test, and doc facts first, then consolidate before editing

---

## Suggested next splits

1. Transcript rendering and streaming response handling
2. Memory/settings inspector actions
3. Mood/sprite and idle decor presentation
4. Any new browser-only feature slice that currently would be easiest to jam into `penny-app.js`

That order keeps the remaining risk concentrated in orchestration, state coordination, and the last shared UI helpers.
