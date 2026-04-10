# Penny LM Studio Debug Notes — 2026-04-08

## Goal
Get the custom Penny frontend at `http://localhost:4317` running with a local LM Studio Gemma brain instead of OpenAI / cloud OpenClaw.

## What was confirmed
- Penny frontend project exists at `C:\Users\malac\.openclaw\workspace-main\lyra-prototype`
- Intended launcher: `start-lyra.ps1`
- Intended URL: `http://localhost:4317`
- Frontend/server can be restarted successfully
- OpenClaw shadow path currently fails with literal response: `No response from OpenClaw.`
- OpenClaw default model was switched to LM Studio model `lmstudio/google/gemma-4-26b-a4b`
- LM Studio is reachable at `http://127.0.0.1:1234/v1`
- Direct LM Studio `/v1/chat/completions` works and returns JSON

## Key finding
Direct LM Studio requests to Gemma 4 currently return:
- `choices[0].message.content = ""`
- `choices[0].message.reasoning_content = ...`

The reasoning content contains plausible Penny-style candidate replies, but the final visible assistant text is empty.

## Code changes already made
- Patched `lyra-prototype/server.js` so local brain mode now calls LM Studio directly instead of the placeholder local-stable reply generator.
- Added LM Studio config constants:
  - base: `http://127.0.0.1:1234/v1`
  - model: `google/gemma-4-26b-a4b`
- Patched `public/app.js` so default brain mode is now `local`
- Updated UI brain-mode note text to reflect direct LM Studio local mode

## Current blocker
Gemma 4 in LM Studio is exposing reasoning output but not committing final visible output for the Penny prompt shape tested so far.

## Most likely next moves
1. Try LM Studio `/v1/responses` instead of `/v1/chat/completions`
2. Try a different Gemma / model setting that disables visible reasoning mode
3. Add temporary fallback logic that extracts a candidate final line from `reasoning_content` just to test UX viability
4. Try a different local model better suited for roleplay/chat output completion behavior
