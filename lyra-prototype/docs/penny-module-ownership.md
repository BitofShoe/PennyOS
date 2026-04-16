# Penny Module Ownership Notes

This note complements the section-map docs.

The goal is not to pretend the repo is small.
The goal is to keep the remaining gravity wells explicit about ownership, inputs, outputs, and side effects.

## `lib/penny-memory-archive.js`

Owns:
- archive storage and normalization
- embeddings cache persistence
- archive lifecycle
- retrieval orchestration
- contradiction/provenance persistence
- inspector archive payload shaping

Must not own:
- canonical explicit-memory truth
- route-level response shaping
- frontend inspector rendering

Inputs:
- `sessionId`
- turn text
- retrieval/provenance inputs from the route layer
- LM Studio embed status

Outputs:
- archive context for prompt assembly
- inspector archive payload
- review queue operations

Allowed side effects:
- archive file writes
- embeddings file writes

## `lib/penny-route-handlers.js`

Owns:
- HTTP route behavior
- request parsing
- route-level response metadata
- route-level persistence decisions

Must not own:
- low-level LM Studio transport behavior
- archive scoring policy
- frontend state decisions

Inputs:
- sanitized request payloads
- orchestrator/service helpers from `server.js`

Outputs:
- HTTP responses
- persisted `lastRoute` metadata

Allowed side effects:
- route-triggered memory writes
- archive consolidation scheduling

## `lib/penny-direct-intents.js`

Owns:
- deterministic intent detection for project/web/runtime/git reads
- deterministic reply shaping for those tool results
- weak deterministic-reply detection

Must not own:
- lane selection policy beyond direct-intent resolution
- full tool-loop planning
- archive or prompt-stack behavior

Inputs:
- user text
- direct tool results

Outputs:
- direct-intent resolution objects
- bounded deterministic replies
- reply-quality heuristics

Allowed side effects:
- none

## `lib/penny-lmstudio-transports.js`

Owns:
- LM Studio transport family selection
- request/stream glue for stateful chat, chat completions, and responses paths

Must not own:
- route policy
- prompt-stack policy
- archive memory policy

Inputs:
- model ids
- prompt/messages payloads
- transport config

Outputs:
- normalized LM Studio responses and streams

Allowed side effects:
- LM Studio HTTP calls only

## `public/js/penny-app.js`

Owns:
- browser orchestration
- shared app state
- coordination across transcript, memory panel, expression runtime, attachments, and backend status

Must not own:
- low-level transcript rendering rules
- memory-panel rendering rules
- ambient chrome that can live in a dedicated helper

Inputs:
- DOM references
- backend responses/events
- storage snapshot

Outputs:
- coordinated UI updates
- browser-side persistence snapshots

Allowed side effects:
- DOM mutation
- browser storage writes
- frontend fetches to Penny routes

## `public/js/penny-expression-runtime.mjs`

Owns:
- mood presentation helpers
- expression-pack loading/normalization
- idle decor runtime

Must not own:
- transcript logic
- memory-panel logic
- backend status logic

Inputs:
- mood ids
- pack manifests
- DOM containers passed from the app shell

Outputs:
- render-ready expression data
- idle decor runtime behavior

Allowed side effects:
- DOM mutation only through the runtime helpers it is explicitly given
