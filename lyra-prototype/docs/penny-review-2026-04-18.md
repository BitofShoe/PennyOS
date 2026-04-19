# Penny repo review — brutally honest senior engineer / architect pass

Reviewed against the uploaded repo snapshot at commit `91a8eb01c18a65c5a0cbef79c373fdda5f85d43e` on `main`. I ignored local runtime debris as requested and worked from a clean archived tree of that exact commit. I read `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, and `docs/penny-runtime-authority-contract-2026-04-17.md` first.

I also ran the test suite locally in this environment. The container has Node 22 while `package.json` asks for Node 24, so treat runtime-specific behavior cautiously, but the main failure I found is a real path-normalization/test-honesty issue, not a syntax mismatch.

## Findings (ordered by severity)

### 1) Critical — the new runtime truth/provenance surfaces are **not prompt-truthful yet**

This is the biggest issue in the repo right now, and it is directly in the area you asked me to stress test.

The actual prompt path correctly suppresses archive and research-ledger sections on direct canon-authority questions:

- `lib/penny-memory.js:285-320`

But the artifact/inspector path can still claim that advisory context was “injected” even when it was held back:

- `server.js:417-423` computes `researchLedgerPromptInjected` *before* actual prompt assembly.
- `lib/penny-route-handlers.js:993-1000` captures that boolean from the runtime memory context.
- `lib/penny-route-handlers.js:1170-1201` and `1223-1242` pass it straight into the artifact and persisted route state.
- `lib/penny-route-handlers.js:449-475` can also replace the prompt-time ledger context with the **post-update** ledger context after the reply is already done.
- `server.js:523-564` shows that the ledger update returns a fresh `getPromptContext(...)` after mutation.
- `lib/penny-runtime-artifacts.js:797-839` hard-codes archive session/global retrieval entries as `injected: true`.
- `lib/penny-runtime-artifacts.js:887-903` marks research-ledger entries as injected from that early boolean, not from actual rendered prompt content.
- `lib/penny-runtime-artifacts.js:644-688` and `729-773` then count those entries into `authorityPressure` and `advisoryMerge`.
- `lib/penny-runtime-artifacts.js:1035-1062` also promotes them into accepted evidence.
- `public/js/penny-memory-panel.mjs:342-379` renders those counts and the ledger “injected/held back” flag as if they are factual receipts.

There is also a second artifact lie in the same subsystem:

- `lib/penny-runtime-artifacts.js:1341-1347` falls back to `"Chat lane reply with additive archive context."` whenever there is no verified tool evidence and the request was not shadow. That means a tool-turn with no tool evidence can be summarized as a chat-lane reply.

I reproduced this locally on the clean commit snapshot in two ways:

1. A direct authority question produced a memory block containing only stable facts, but `buildRuntimeArtifact(...)` still reported **3 advisory items/channels injected**.
2. A `deterministic-tool` artifact with `modelUsage: not-used` can still show `researchLedgerPromptInjected: true` and the summary text `"Chat lane reply with additive archive context."`

That is not a telemetry nit. It is a trust bug. The receipts are drifting away from the actual runtime behavior.

Worse, some tests currently lock this mismatch in as the expected behavior:

- `test/penny-runtime-artifacts.test.js:196-285`
- `test/penny-memory-panel.test.js:545-579`
- `test/penny-memory-qa-script.test.js:115-137`

So the code and the tests are currently agreeing on the wrong thing.

### 2) High — the research ledger can fossilize tentative assistant prose into quasi-facts and over-merge unrelated repo work

The ledger is still bounded, which is good. But its current update model is too eager to turn “latest assistant wording” into the stored topic answer.

Problem spots:

- `lib/penny-research-ledger.js:333-367` derives topic identity mostly from the first evidence ref. In practice, many separate questions about the same file collapse into one topic.
- `lib/penny-research-ledger.js:382-387` marks a topic `settled` whenever it has evidence and no open follow-ups.
- `lib/penny-research-ledger.js:404-417` prefers `conclusion` as the prompt summary.
- `lib/penny-research-ledger.js:537-547` unconditionally stores `conclusion: cleanAssistantText`.
- `lib/penny-research-ledger.js:426-453` still allows one same-session topic through even when there is no anchor overlap.

I reproduced a concrete bad case locally:

- First turn: question about the `package.json` test script.
- Second turn: separate question about the `package.json` Node engine.
- Result: both collapsed into one `path-package-json` topic, the earlier question disappeared as the active summary, and the topic ended up `settled` with the later conclusion.

That is too coarse for research continuity. A ledger topic keyed only by file path is not a safe unit of meaning.

The risk here is not that the ledger is too big. The risk is that it becomes a small, confident-looking cache of whatever Penny last said about a file.

### 3) High — memory truth is still too phrase-shaped on both the write path and the read path

#### Write path problem: natural preference corrections often do not update canon

- `lib/penny-memory-state.js:102-105` converts natural preference language like `I like X` into `They like X`.
- `lib/penny-memory-state.js:202-207` then returns no topic key for `They like ...` and `They tend to ...`.
- `lib/penny-memory-state.js:226-258` therefore cannot build correction provenance for those preference-style memories.
- `lib/penny-memory-state.js:163-178` only promotes to canon on explicit memory intent or a detected correction.

I reproduced this locally:

- Existing canon: `They like oolong`
- New user turn: `Actually, I like lapsang souchong now.`
- Result: old canon stayed in place; the new preference was only queued as a `review-candidate`; provenance stayed empty.

That is a user-facing truth bug for a companion product. Real users will say things like that constantly.

#### Read path problem: natural canon-authority questions do not always trigger canon-first suppression

- `lib/penny-memory.js:185-199` defines direct memory-authority detection.
- `lib/penny-latency-budget.js:94-113` defines a broader canonical-memory question detector.
- `server.js:2347-2368` uses the narrower direct-authority detection for history suppression.

So the system is internally inconsistent: a question can be “memory-heavy” for latency budgeting but **not** be recognized as a canon-authority question for prompt suppression.

Concrete example:

- `What tea do I like again?` is not treated as a direct memory-authority question.
- `test/penny-memory.test.js:227-245` explicitly expects advisory retrieval hints to be present for that phrasing.
- Meanwhile more patterned phrasings like `Tell me what you remember about my tea` *do* get canon-first treatment in `test/penny-memory.test.js:247-283`.

That means Penny’s truth behavior still changes based on brittle wording, not just user intent.

### 4) Medium — archive dedupe and retrieval receipts still have stale-state / continuity risks

- `lib/penny-memory-archive.js:2123-2128` dedupes episodes by exact `userText + assistantText` hash.
- `lib/penny-memory-archive.js:2194-2213` stores only one bounded `lastRetrieval` snapshot.
- `lib/penny-memory-archive.js:2356-2360` exposes only that single snapshot in the inspector.

The exact-hash dedupe is efficient, but for a companion product it is also blunt. If the same line or correction happens on two different days, that recurrence can be meaningful. Right now it disappears as a distinct episode.

The single `lastRetrieval` snapshot is useful for debugging, but it is not a durable per-turn audit trail. Combined with the artifact-truth issue above, it means the “why did Penny answer this way?” story is still too lossy.

### 5) Medium — the QA gate is not yet honest enough to be a release oracle

I ran the tests locally and got:

- 234 pass
- 1 fail
- 3 todo

The failing case is real and worth fixing:

- `test/penny-project-tools.test.js:88-99`
- `lib/penny-project-tools.js:46-53`, `113-116`, `221-231`

On POSIX, `..\\outside.txt` is treated as a literal filename fragment, not a parent-directory escape. So `resolveProjectPath(...)` does not reject it as “outside project”; the code later hits `ENOENT` instead. That means the guard/test pair is not actually cross-platform-honest today.

There is also QA self-reference in the memory harness:

- `scripts/qa-penny-memory.js:252-259` requires advisory injection counts as part of “canonical authority pressure satisfied,” which currently rewards the inflated artifact receipts from finding #1.
- `scripts/qa-penny-memory.js:693-706` uses a brittle phrase matcher for `session_level_premise_drift`, which matches the caveat you already called out.

So the QA posture is promising, but I would not yet treat it as a final truth gate without fixing the artifact semantics first.

## Brief praise

Brief and specific, because you asked for brutal honesty:

- The canon-vs-advisory boundary is materially better than before. `formatPromptMemories(...)` really does hold back archive and research-ledger sections on several direct-authority paths instead of just documenting that intent (`lib/penny-memory.js:285-320`).
- `PROMPT_SLOT_REGISTRY` and the slot-summary pipeline look like **good complexity**, not swamp complexity (`lib/penny-prompt-stack.js:3-59`, `145-225`).
- The atomic JSON write pass was a worthwhile robustness improvement (`server.js:337-342`, `379-386`; `lib/penny-memory-archive.js:314`, `963`, `1062`; `lib/penny-research-ledger.js:254`, `297`).

## Brief summary

The repo is moving in the right direction on canon-first behavior, bounded advisory memory, and inspectability.

But the thing you most wanted checked — whether the new truth/provenance surfaces are *actually truthful* — is where the biggest issue is. Right now the runtime can behave correctly while the artifact, inspector, and QA receipts still describe a more advisory-injected story than what really happened. That undermines the value of the whole observability layer.

The second major issue is that the research ledger is still a little too eager to store “whatever the assistant last said” as the answer for a broad topic bucket.

## Direct answers to your six focus areas

### 1) Highest-risk bugs or regressions

The highest-risk issue is the artifact/inspector truth gap:

- advisory context can be recorded as injected when it was actually held back
- post-turn ledger state can appear in the artifact as though it shaped the reply
- some tests currently bless that mismatch

After that, the biggest user-facing risk is phrase-shaped memory truth:

- natural preference corrections can fail to update canon
- natural canon-authority questions can miss the canon-first path

### 2) Hidden failure modes or stale-state risks

The ones I would worry about most in live use are:

- ledger context recorded after mutation, not only at prompt time
- same-file ledger topic merging unrelated repo questions
- exact-text archive dedupe flattening meaningful recurrence over time
- only one `lastRetrieval` snapshot for auditability
- narrow regex boundaries causing behavior changes from small wording shifts

### 3) Whether current trust/provenance/memory surfaces are actually truthful

Not yet.

The prompt-slot summaries are mostly fine. The cleanup-transform separation is conceptually fine. But the authority-pressure / advisory-merge / research-ledger-injected / accepted-evidence surfaces are **not trustworthy enough yet** because they are derived from selected candidate context, not the actual final rendered prompt usage.

### 4) Whether current complexity is good complexity or swamp complexity

Mixed.

Good complexity:

- explicit canon vs archive vs research ledger
- prompt-slot registry and slot-summary pipeline
- additive normalization for lossy/probation metadata

Swamp complexity:

- multiple overlapping “truth receipt” surfaces with no single ground-truth emitter
- pre-prompt, prompt-time, and post-prompt state getting mixed in artifacts
- QA assertions that validate telemetry conventions rather than actual prompt truth

### 5) Whether the docs still honestly match the code

Mostly yes on structure and intent. Not fully yes on observability truth.

- `README.md:34-40` and `ARCHITECTURE.md:156-180` are directionally honest about canon vs archive vs ledger.
- `docs/penny-runtime-authority-contract-2026-04-17.md:4-11` is the right contract *intent*.
- But the current implementation is not yet delivering that contract for runtime artifacts and inspector receipts.

So the docs are honest about the architecture you want, but slightly ahead of the code on “the receipts are truthful.”

### 6) The single most valuable next bounded slice before more live user testing

**Build one prompt-truth receipt emitted by the actual prompt assembly path, and make everything else consume that.**

More concretely:

- have prompt assembly return structured per-channel usage like:
  - `selected`
  - `rendered`
  - `heldBackReason`
  - `sourceIds`
  - `renderedLineCount`
- thread that receipt into:
  - runtime artifact
  - inspector panel
  - QA witness trace
- rewrite the relevant tests around:
  - direct authority suppression
  - deterministic-tool / no-model turns
  - research-ledger selected-vs-rendered distinction

That one slice would buy you the most trust, boundedness, and maintainability per unit of work. I would do that **before** broadening the ledger, adding more summaries, or doing more live-user trust evaluation.

## Plain-English explanation for a non-expert

Penny’s memory system is getting smarter, but her “debug receipts” are not fully honest yet.

Right now, Penny can sometimes do the *right thing* internally — for example, answering from your saved canon facts and ignoring older fuzzy hints — while her inspector still says those fuzzy hints were part of the answer. That is bad because it makes debugging feel more precise than it really is.

There is also still too much dependence on exact wording. If you say a correction in the exact phrasing the system expects, it usually works. If you say it more naturally, Penny can keep the old fact or treat the new one as only a maybe.

So my blunt recommendation is: before more live testing, make the observability layer tell the literal truth about what actually went into the prompt. Once that is solid, the rest of the memory/ledger system becomes much easier to trust and tune.
