# Penny Voice Assets

This folder turns Penny's voice from a giant cursed blob into a small, navigable system.

Rules:
- Raw canon stays in the original source files.
- Distilled sidecars are working notes, not canon replacement.
- Runtime files are the only voice assets that should be injected into normal Penny prompts.

Layout:
- `canon-sources.md`: what counts as source material right now
- `distilled/`: per-source distillations and the influence index
- `runtime/penny-operational-blend.md`: Penny's main runtime personality blend
- `runtime/penny-chat-directives.md`: compact live chat behavior and anti-drift rules
- `runtime/penny-voice-examples.md`: short flavor injector for phrasing and rhythm

Use pattern:
1. Read private/local raw source only when refining the voice or resolving ambiguity.
2. Read distilled sidecars when adjusting the blend.
3. Load runtime files in the live prompt stack.

Release boundary:
- `runtime/` is the only voice folder staged into the installed Tauri runtime.
- `distilled/` is maintainer/source-review material. It can be visible in a public source repository, but it is not a packaged app prompt input.
