# `server.js` section map

**Purpose:** Function → responsibility map for planning the first real split of the backend monolith.  
**Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md), [Notes on Penny's Code From a Project Manager.md](./Notes%20on%20Penny's%20Code%20From%20a%20Project%20Manager.md)

**Line numbers** are from the `server.js` revision at the time this file was written (2026-04-09). They will drift as you edit; use nearby **function names** as the stable key.

---

## How to use this doc

1. **Pick a vertical slice** (e.g. “durable memory HTTP + merge” or “LM Studio transport only”).
2. Find the **line band** and **function list** below.
3. Move that band into a new module; re-export or inject dependencies (`MEMORY_FILE`, env constants) instead of copying globals.
4. Add tests against the **public** functions of the new module before deleting from `server.js`.

---

## Top-level symbols (outside functions)

| Symbol | Approx. lines | Role |
|--------|---------------|------|
| `require(...)` / env constants | 1–99 | Ports, paths, timeouts, tool limits, web search toggles, MIME allowlists |
| `lmStudioStatusCache`, `runtimePreferredModel` | 101–102 | Mutable LM Studio probe cache + UI-selected model hint |
| `sessionState` | 104 | Ephemeral chat turns / last mood / tiny in-memory transcript (not durable store) |
| `MIME_TYPES` | 105 | Static file `Content-Type` map |
| `PROMPT_ASSET_CACHE` | 106 | In-memory prompt file cache |
| `PENNY_*_FALLBACK` strings | 107–164 | Emergency prompt text if disk assets missing |

---

## HTTP API surface (router)

All routes live in the `http.createServer` callback starting ~**4612**.

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/api/penny/memory` | Read durable memory for `sessionId` |
| `POST` | `/api/penny/memory` | Replace/merge via `payload.memory` |
| `PATCH` | `/api/penny/memory` | Partial update via `payload.patch` (notably `memories` array semantics) |
| `POST` | `/api/penny/consolidate` | `buildChatMemoryState` + save (extraction / merge from messages) |
| `GET` | `/api/penny/shadow-status` | OpenClaw enabled / timeout metadata |
| `GET` | `/api/penny/lmstudio/status` | LM Studio connection + resolved model |
| `POST` | `/api/penny/lmstudio/model` | Set `runtimePreferredModel`, invalidate status cache |
| `POST` | `/api/penny/chat/shadow` | Legacy shadow route; may fall back to `buildPennyReply` |
| `POST` | `/api/penny/chat`, `/api/companion/chat` | Main chat: streaming or JSON; local LM Studio + tools or shadow |
| `GET` | `/api/penny/status`, `/api/companion/status` | Health-ish status + LM Studio snapshot |
| *static* | `/`, other paths under `public/` | `serveFile` with path traversal guard |

---

## Section A — Bootstrap & configuration (~1–164)

**Responsibility:** Wire Node built-ins, read `process.env`, define operational limits.

**Notable:** Single place to later replace with `src/config.js` that returns a frozen config object.

---

## Section B — Prompt assets (~166–197)

| Function | Responsibility |
|----------|------------------|
| `normalizePromptAssetText` | CRLF trim |
| `readPromptAsset` | Load markdown from `penny-voice/runtime` or absolute path |
| `getPennyVoiceAssets` | Bundle operational blend + directives + examples (cached) |
| `formatPromptAssetBlock` | Label + body for injection |
| `ensureDataDir` | Ensure `data/` exists |

**Split target:** `src/prompting/assets.js` (pure loading + cache; pass `PENNY_VOICE_DIR` in).

---

## Section C — Durable memory on disk (~198–264)

| Function | Responsibility |
|----------|----------------|
| `defaultMemoryRecord` | Schema defaults (`sessionId`, `userName`, `memories`, `voiceOn`, `brainMode`, `lmStudioThread`, …) |
| `isLikelyTestSessionId` | Detect eval/Q session ids for purge |
| `normalizeBrainMode` | `local` vs `shadow` |
| `normalizeUserName` | Trim / max length |
| `normalizeMemoryRecord` | Coerce record; uses `mergeMemoryItems` from `lib/penny-memory.js` |
| `readMemoryStore` / `writeMemoryStore` | JSON file `{ sessions: { … } }` |
| `getStoredMemory` / `saveStoredMemory` | Per-session read/write |
| `mergeMemoryState` | **Critical:** patch semantics for `memories` replace vs merge |
| `getChatMemorySettings` | Extract client-provided settings from payload |
| `buildChatMemoryState` | Disk + client + `consolidateMemory` pipeline for a turn |

**Split target:** `src/memory/store.js` (I/O + `mergeMemoryState` + normalize). Keep using `lib/penny-memory.js` for scoring/merge items.

**Tests to add when moving:** `mergeMemoryState` matrix (full replace, omit field, consolidate path).

---

## Section D — Text, HTML, URL helpers (~265–426)

| Function | Responsibility |
|----------|----------------|
| `hashText` | SHA1 helper |
| `normalizeLmStudioThread` | Stateful thread handle shape |
| `createHttpError` | Status-coded errors |
| `clampNumber`, `formatBytes`, `truncateText`, `collapseWhitespace` | Generic utilities |
| `decodeHtmlEntities`, `stripHtmlToText` | HTML → plain |
| `extractFirstUrl`, `normalizeWebUrl` | URL extraction / validation |
| `parseDuckDuckGoLiteResults` | HTML scrape for web search |
| `extractHtmlTitle` | Page title |
| `fetchTextWithLimit` | HTTP GET with byte/time caps |

**Split target:** `src/util/text.js` + `src/util/http-fetch.js` (or one `util/` module).

---

## Section E — Chat sanitization & attachments (~427–577)

| Function | Responsibility |
|----------|----------------|
| `stripCodeFences` | Remove ``` wrappers from model output |
| `normalizeToolArgsString`, `extractJsonObjectCandidate`, `repairJsonLikeArgs`, `parseToolArguments` | Lenient JSON for tool calls |
| `clearLmStudioThread` | Null thread in memory record |
| `sanitizeChatMessages` | Clip/normalize history for API |
| `sanitizeImageDataUrl` | Image attachment caps + MIME allowlist |
| `sanitizeFileAttachment` | Text attachment caps |
| `buildAttachedFileContext`, `appendAttachmentContext`, `buildToolUserText` | Composer context for file in prompt |
| `sanitizeToolMessages` | Tool-turn history limits |
| `describeLocalBrainFailure` | User-facing LM Studio error summary |

**Split target:** `src/chat/sanitize.js` or `src/attachments.js`.

---

## Section F — HTTP client for LM Studio / gateway (~578–834)

| Function | Responsibility |
|----------|----------------|
| `sendJson`, `safeReadBody` | JSON HTTP helpers |
| `postJsonLongRunning` | Buffered POST with long timeout |
| `postJsonSse` | SSE-style POST consumer |

**Split target:** `src/http/client.js`.

---

## Section G — Mood tags & placeholder replies (~835–920)

| Function | Responsibility |
|----------|----------------|
| `extractReplyMoodTag`, `stripReplyMoodTags`, `resolveReplyMood`, `retagAssistantReply` | `[MOOD:x]` handling |
| `pickMood` | Heuristic mood from text |
| `summarizeMemory` | Short thread summary string |
| `buildPennyReply` | **Non-LLM** canned replies (shadow fallback / offline flavor) |
| `buildShadowPrompt` | Assemble text for OpenClaw handoff |

**Split target:** `src/reply/mood.js` + `src/reply/placeholders.js`.

---

## Section H — LM Studio desktop integration (~921–1325)

| Function | Responsibility |
|----------|----------------|
| `readLmStudioDesktopSettings` | Read LM Studio `settings.json` |
| `normalizeLmStudioModelEntries`, `normalizeLmStudioInstalledModelEntries`, `normalizeLmStudioLoadedModelEntries` | Parse `lms` / API JSON shapes |
| `normalizeModelKey`, `tokenizeModelAlias`, `isQuantizationToken`, `modelTokenArraysEquivalent`, `modelsLookEquivalent` | Fuzzy model id matching |
| `mergeUniqueModelIds`, `rankLmStudioModel`, `sortLmStudioModelCandidates` | Pick best model candidate |
| `execFileText` | Spawn CLI helper |
| `getInstalledLmStudioModels`, `getLoadedLmStudioModels` | `lms` subprocess |
| `buildLmStudioLaunchHint` | Friendly error text |
| `getLmStudioConnectionStatus` | **Main status probe** (cached): health, resolved model, endpoints |
| `isMissingLmStudioModelError` | Detect “model not loaded” class errors |
| `withLmStudioCandidateModel` | Try alternate model ids |
| `pickLmStudioNativeModelId` | Native chat model id |
| `shouldPreferLmStudioChatCompletions` | Transport hint from model name |

**Split target:** `src/lmstudio/status.js` (large, cohesive).

---

## Section I — OpenClaw shadow (~1326–1369)

| Function | Responsibility |
|----------|----------------|
| `runOpenClawShadow` | Gateway POST; prompt blob to `openclaw/main` |

**Split target:** `src/shadow/openclaw.js`.

---

## Section J — Project & web tools (~1370–2012)

| Function | Responsibility |
|----------|----------------|
| `toProjectRelative`, `resolveProjectPath` | Safe path resolution under repo |
| `isProbablyTextFile`, `readUtf8ProjectFile` | File typing / read |
| `listProjectFilesTool`, `readProjectFileTool`, `readProjectFileAroundMatchTool`, `searchProjectTextTool` | File tools |
| `resolveLogTarget`, `readRecentLogsTool` | Log tail |
| `searchWebTool`, `readWebPageTool` | DuckDuckGo + fetch |
| `ensureWritableTextPath`, `writeProjectFileTool`, `replaceInProjectFileTool`, `insertInProjectFileTool` | Mutating file tools |
| `runNodeCheckTool` | `node --check` |
| `getGitStatusTool`, `readGitDiffTool` | Git |
| `getRuntimeStatusTool` | Large runtime introspection blob |

**Split target:** `src/tools/project.js`, `src/tools/web.js`, `src/tools/git.js`, `src/tools/runtime.js` (or one `tools/` with internal sections).

---

## Section K — Tool dispatch (~2013–2088)

| Function | Responsibility |
|----------|----------------|
| `toolLabelFromResult` | Human labels for UI |
| `executePennyTool` | **Switchboard** mapping tool name → implementation |

**Split target:** `src/tools/registry.js`.

---

## Section L — Direct intents (deterministic short-circuit) (~2089–2599)

| Function | Responsibility |
|----------|----------------|
| `extractDirectProjectPath`, `cleanDirectInstructionContent` | Parse user path hints |
| `parseDirectWriteInstruction`, `normalizeDirectLineSnippet`, `parseDirectReplaceInstruction`, `parseDirectAppendInstruction`, `buildDirectEditSequence` | Structured edit DSL from natural language |
| `extractDirectWebQuery`, `extractDirectSearchQuery` | Quick web/file search extraction |
| `looksLikeProjectPathDiscoveryIntent`, `looksLikeDirectProjectInspectIntent` | Heuristic gates |
| `resolveDirectToolIntent` | **Big** router: maps user text → intent object |
| `runLmStudioToolContextAnswer` | Short LM call with tool result context |
| `composeDirectRuntimeReply`, `composeDirectSyntaxReply`, `composeDirectGitStatusReply`, `composeDirectSearchReply`, `composeDirectReadReply`, `composeDirectFileListReply`, `composeDirectWebSearchReply`, `composeDirectWebPageReply`, `composeToolRecordFallback` | Template replies for tool outcomes |
| `shouldUseDirectReadReply` | Gate |
| `executeDirectToolSequence`, `composeDirectEditReply` | Run ordered tool steps |
| `runLmStudioDirectToolAssist` | LM-assisted path for direct intents |

**Split target:** `src/direct-intents/` (parser + composer + runner). Overlaps with `lib/penny-tool-intents.js` (`executeDirectProjectInspectIntent` already extracted).

---

## Section M — Full tool loop (~2601–2959)

| Function | Responsibility |
|----------|----------------|
| `runLmStudioToolLoop` | Planner + tool execution cycle |
| `parsePlannerDecision`, `shouldFallbackToManualToolLoop` | Planner output parsing / errors |
| `runLmStudioManualToolLoop` | Fallback stepping |

**Split target:** `src/lmstudio/tool-loop.js`.

---

## Section N — Tool system prompt (~2960–3014)

| Function | Responsibility |
|----------|----------------|
| `buildLmStudioToolSystemPrompt` | Instructions + tool schema prose for LM |

**Split target:** `src/prompting/tool-system.js`.

---

## Section O — Semantic render (~3015–3235)

| Function | Responsibility |
|----------|----------------|
| `semanticStringLimit`, `sanitizeSemanticValue`, `summarizeToolRecordForSemanticCore` | Shrink tool records for “semantic core” |
| `cleanDraftForSemanticRender` | Strip noise from draft |
| `buildSemanticCore` | Factual core blob |
| `shouldUseSemanticRender` | Heuristic: hard turn? |
| `buildLmStudioSemanticRenderSystemPrompt` | Final voice pass instructions |
| `renderSemanticReplyAsPenny` | LM call for styled final reply |
| `maybeRenderHardTurnReply` | Orchestrates semantic pass after tools |

**Split target:** `src/lmstudio/semantic-render.js`.

---

## Section P — Main chat prompts (~3236–3504)

| Function | Responsibility |
|----------|----------------|
| `buildLmStudioLeanSystemPrompt` | Shorter system prompt variant |
| `buildLmStudioSystemPrompt` | Full system prompt + voice assets |
| `buildLmStudioPrompt` | User/assistant template assembly |
| `buildLmStudioMessages` | OpenAI-style `messages[]` for completions |
| `buildLmStudioStatefulSeedText`, `buildLmStudioStatefulInput` | Native threaded chat payload |

**Split target:** `src/prompting/chat-prompts.js`.

---

## Section Q — Reply cleanup & LM response parsing (~3505–3799)

| Function | Responsibility |
|----------|----------------|
| `stripThinkSpans`, `takeAfterLastHorizontalRule`, `extractTaggedVisibleReply`, `takeAfterFinalCue`, `stripWrappingCodeFence`, `stripReplyPrefix` | Remove model scaffolding |
| `isMetaThinkingLine`, `paragraphLooksLikeCoT`, `looksOnlyLikeCoT` | CoT detection |
| `coercePennyVisibleReply` | **Main** visible reply extractor |
| `collectLmStudioResponsesStrings`, `extractPennyFromPlanningBlob`, `extractPennyFromReasoning` | Responses API shapes |
| `collectTextParts`, `textValueFromField`, `textFromChatMessage` | Recursive text extraction |
| `collectLmStudioStatefulChatStrings` | Stateful chat shapes |
| `isMissingLmStudioThreadError`, `lmStudioStageLabel` | Errors / UI labels |

**Split target:** `src/lmstudio/parse-reply.js`.

---

## Section R — SSE helpers (~3803–3835)

| Function | Responsibility |
|----------|----------------|
| `beginEventStream`, `sendEventStream`, `startEventStreamKeepAlive`, `bindAbortSignal` | Streaming to browser |

**Split target:** `src/http/sse.js`.

---

## Section S — LM Studio transports (~3836–4568)

| Function | Responsibility |
|----------|----------------|
| `runLmStudioResponsesApi`, `streamLmStudioResponsesApi` | `/v1/responses` |
| `runLmStudioStatefulChatApi`, `streamLmStudioStatefulChatApi` | `/api/v1/chat` stateful |
| `streamLmStudioChatCompletionsApi`, `runLmStudioChatCompletionsApi` | `/v1/chat/completions` |
| `runLmStudioLocal`, `streamLmStudioLocal` | Pick transport by settings |
| `runLmStudioLocalSmart`, `streamLmStudioLocalSmart` | **Entry** for chat: tools + semantic + routing |

**Split target:** `src/lmstudio/transports/` (one file per API family, shared low-level POST).

---

## Section T — Memory extraction (~4569–4609)

| Function | Responsibility |
|----------|----------------|
| `extractMemories` | Regex/heuristic facts from user lines |
| `consolidateMemory` | Fold messages into memory patch |

**Split target:** `src/memory/consolidate.js` (pure; easy to unit test).

---

## Section U — Static files (~4610)

| Function | Responsibility |
|----------|----------------|
| `serveFile` | Read file + MIME |

**Split target:** `src/static/serve.js`.

---

## Section V — Router closure (~4612–4930)

**Responsibility:** Only orchestration: parse payload, call brain, stream or JSON, update `sessionState`, save memory.

**Split target:** `src/routes/penny.js` + `src/app.js` that mounts `createPennyHandler(deps)`.

---

## Section W — Startup (~4932–4972)

| Function | Responsibility |
|----------|----------------|
| `listLanIPv4Addresses` | LAN URLs for phone |
| `purgeTestSessionsFromStore` | Delete test sessions on boot |
| `startServer` | `listen` + console hints |

**Split target:** `src/server.js` (thin entry).

---

## `module.exports` (~4974–4981)

Exported for tests / harnesses:

- `server`, `startServer`
- `getLmStudioConnectionStatus`
- `buildLmStudioMessages`
- `coercePennyVisibleReply`
- `textFromChatMessage`

Any extraction should **preserve or replace** these exports so `eval-penny-*.js` keeps working.

---

## Suggested first splits (ordered)

1. **Memory:** Section **C** + **T** → `src/memory/*` (highest bug history, clearest tests).
2. **LM Studio status:** Section **H** → `src/lmstudio/status.js` (big but isolated; already exported).
3. **Tool implementations:** Section **J** + **K** → `src/tools/*`.
4. **Reply parsing:** Section **Q** → `src/lmstudio/parse-reply.js` (frequently touched for model quirks).
5. **Transports:** Section **S** → multiple files under `src/lmstudio/transports/`.
6. **Router:** Section **V** last—after dependencies are modules.

---

## Already extracted (do not duplicate)

| Module | Role |
|--------|------|
| [lib/penny-memory.js](./lib/penny-memory.js) | `mergeMemoryItems`, `selectMemoriesForPrompt`, scoring, prompt formatting |
| [lib/penny-tool-intents.js](./lib/penny-tool-intents.js) | `shouldOfferLocalTools`, `executeDirectProjectInspectIntent` |

`server.js` still owns **disk merge** (`mergeMemoryState`) and **consolidation** (`consolidateMemory`); those are prime movers to `lib/` or `src/memory/` next.
