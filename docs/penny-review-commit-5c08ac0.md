# Penny repo review — commit `5c08ac05fef01a0564822398aa236683ef3c5768`

> Category: Review snapshot
> Authority: Historical evidence
> Status: Historical
> Use this for: commit-specific findings, risks, and follow-up ideas.
> Do not use this for: standing runtime law or current-state assumptions without checking newer code, tests, and contract docs.

I reviewed a clean worktree at the exact commit from the uploaded repo snapshot, ignored local runtime debris, read the four requested docs first, and ran the test suite.

Test run: `npm test --silent` → **238 passing, 1 failing, 3 todo**.

## Findings

### 1. High — the research ledger can still launder assistant synthesis into “settled” continuity

- `lib/penny-research-ledger.js:557-562` marks a topic as `settled` whenever there is evidence, no contradiction, and no open follow-up.
- `lib/penny-research-ledger.js:579-593` then prefers `topic.conclusion` for prompt summaries.
- `lib/penny-research-ledger.js:723-740` stores raw `assistantText` as `conclusion`.

That means a verified tool read can support a **narrow** fact, while Penny’s **broader** wording becomes the durable topic summary.

I reproduced this with a `read_project_file(package.json)` turn:

- user: `Does package.json pin Node 22, and does that prove the repo is modern?`
- assistant: `package.json pins Node 22, so yes, the repo is modern.`
- evidence: only a verified `package.json` read showing Node 22 engines

Result:

- `status: "settled"`
- `conclusion: "package.json pins Node 22, so yes, the repo is modern."`
- prompt summary later prefers that same conclusion

Why this matters:

This is now the most likely way Penny can **look truthful in artifacts while still being wrong in behavior**. The prompt/audit receipts can honestly say “ledger context was rendered,” while the ledger content itself is already semantically too strong.

Missing coverage:

I did not find a regression test in `test/penny-research-ledger.test.js` that forbids “verified subfact + broader assistant synthesis” from becoming a `settled` topic.

### 2. High — question-scoped ledger identity is the right direction, but the current topic ID is still split-happy

- `lib/penny-research-ledger.js:237-249` builds both a normalized `scopeKey` and an order-preserving `scopeLabel`.
- `lib/penny-research-ledger.js:327-345` hashes `scopeKey`, but still includes a slugified `scopeLabel` in `topicId`.

So two phrasings that normalize to the same question scope can still produce different topic IDs.

I reproduced four equivalent phrasings of the same package.json question:

- `Does package.json keep node 22 engines pin?`
- `Does package.json keep engines node 22 pin?`
- `Does package.json keep 22 node engines pin?`
- `Does package.json keep pin node 22 engines?`

All four produced:

- the same `scopeKey`: `22 engines keep node pin`
- the same hash suffix
- **different** `topicId`s, because the `scopeLabel` word order differed

Store result: **4 topics** instead of 1.

Why this matters:

You fixed the old file-scoped overwrite problem, but before more live QA the ledger is still too vulnerable to **false splits**. That hurts continuity, inspector usefulness, and prompt relevance scoring.

Missing coverage:

`test/penny-research-ledger.test.js:58-127` covers:

- same file, different questions → separate topics
- same question, same topic → merge

But it does **not** cover lexical reorder / normalization collisions.

### 3. Medium — the structured truth receipts are now mostly honest, but one human-facing summary string still lies

What improved:

- `server.js:466-479` now gets `promptTruth` from prompt assembly itself and derives `researchLedgerPromptInjected` from rendered counts.
- `lib/penny-route-handlers.js:405-466` freezes prompt-time truth and stores post-turn ledger mutation separately.
- `lib/penny-memory-archive.js:1012-1035` and `2317-2385` keep `recentAuditTrail` and `lastRetrieval.summary` aligned.

That closes the biggest issue from the last review.

What still overstates:

- `lib/penny-runtime-artifacts.js:1386-1395` still emits `"Chat lane reply with additive archive context."` for ordinary chat replies even when no archive, book, or ledger content was actually rendered.
- `lib/penny-runtime-artifacts.js:1139-1141` and `1166-1168` also use “were available to support the reply / wake context” wording that is slightly stronger than the structured receipt.

I reproduced the summary-text issue with a bare `buildRuntimeArtifact(...)` call: advisory channels were zeroed, but the top-line summary still claimed additive archive context.

Why this matters:

Your machine-readable receipts are now better than your prose headline. Humans and agents tend to skim the headline first.

### 4. Medium — canon-first memory handling is materially better, but it is still too dependent on a narrow regex/anchor list

- Detection lives in `lib/penny-memory.js:21-37` and `213-229`.
- Archive suppression happens in `lib/penny-memory.js:330-360`.

The good news:

The tea / notebook / mascot style questions are much better aligned now.

The remaining problem:

Natural fact-recall phrasing still changes whether advisory archive context gets suppressed.

I reproduced this with:

- explicit memory: `Backup mug is orange`
- conflicting archive hint: `Backup mug was blue`

Results:

- `What color is my backup mug?` → `isCanonicalMemoryQuestion = false`; archive candidate rendered
- `Where is my backup mug?` → `isCanonicalMemoryQuestion = true`; same archive candidate held back with `canon-priority-suppression`

Coverage is better than before, but still narrow. The new tests in `test/penny-memory.test.js:324-385` cover natural location/identity cases like notebook and mascot, but not enough generic “what is X again?” recall shapes.

Why this matters:

For a companion product, truth should not swing this much based on user phrasing.

### 5. Medium — the memory QA harness now checks better receipt semantics, but answer grading is still too phrase-matcher-heavy

- Improvement: `scripts/qa-penny-memory.js:252-278` now checks canonical-authority pressure from `promptTruth` candidate/rendered/held-back fields instead of inflated pre-render telemetry.
- Remaining brittleness: `scripts/qa-penny-memory.js:227-250` and scenarios like `734-742` still rely on normalized substring matching for “truth replacement.”

That means long live-QA can still waste time on wording variance rather than actual behavioral regressions.

Your known `session_level_premise_drift` caveat is still the right caution.

### 6. Low/Medium — the test suite is still not honestly green

I ran `npm test --silent` and got **238 passing, 1 failing, 3 todo**.

The failing test is `test/penny-project-tools.test.js:88-99`.
The guard it exercises is `lib/penny-project-tools.js:46-53`.

On this environment, `..\\outside.txt` is not treated as a parent escape, so the code does not fail with the intended “stay inside the Penny project” error.

This is **not** a reason to go do a portability project.
It **is** a reason not to tell yourself the repo is fully green when it is not.

### 7. Low/Medium — the current swamp-complexity hotspot is the parallel receipt stack, not the memory model itself

One turn’s truth now has to stay aligned across:

- prompt assembly in `lib/penny-memory.js`
- artifact derivation in `lib/penny-runtime-artifacts.js`
- route-threaded audit snapshots in `lib/penny-route-handlers.js:405-466`
- archive persistence in `lib/penny-memory-archive.js:912-1035` and `2317-2385`
- inspector rendering in `public/js/penny-memory-panel.mjs:621-666`
- QA witness logic in `scripts/qa-penny-memory.js:252-278`

Compatibility aliases like:

- `researchLedgerPromptInjected` (`server.js:479-486`, `lib/penny-runtime-artifacts.js:1366-1372`)
- duplicated `promptTruth` under both `artifact.promptTruth` and `artifact.modelAdvisory.promptTruth` (`lib/penny-runtime-artifacts.js:1369-1427`)
- `lastRetrieval.summary` as a compatibility mirror of the newest audit slice (`lib/penny-memory-archive.js:1012-1035`)

are understandable, but they are now the biggest future drift risk.

The danger is no longer “the memory model is too ambitious.”
The danger is “every new truth field now has six places to stay synchronized.”

## Brief praise

Brief and specific:

- Prompt assembly really **is** the source of truth now (`server.js:466-479`). That was the right fix.
- `recentAuditTrail` / `lastRetrieval` alignment is genuinely better and bounded (`lib/penny-memory-archive.js:1012-1035`).
- Natural preference correction promotion looks materially improved (`lib/penny-memory-state.js:232-287`).

## Brief summary

This repo is in a meaningfully better place than the last review.

The old core issue — pre-render or post-turn state pretending to be prompt-time truth — looks largely closed.

The main remaining risk has shifted upward into the **research ledger itself**:

- topic identity is still too lexical and can split the same investigation
- conclusion/status logic can still turn broader assistant wording into durable quasi-fact

So the next problem is less “receipts lying about prompt use” and more “ledger content becoming too brittle or too strong.”

## Direct answers to the six focus areas

### 1. Highest-risk bugs or regressions

1. Research-ledger topics can still store over-broad assistant conclusions as `settled` truth (`lib/penny-research-ledger.js:557-562`, `579-593`, `723-740`).
2. Question-scoped ledger identity still fragments same-question continuity under wording changes (`lib/penny-research-ledger.js:237-249`, `327-345`).
3. One artifact headline still overstates advisory usage (`lib/penny-runtime-artifacts.js:1386-1395`).

### 2. Hidden failure modes or stale-state risks

- Same investigation can quietly fork into multiple ledger topics because of token order drift.
- Narrow verified evidence can be converted into a broader “settled” continuity claim.
- Compatibility/narrative receipt layers can still sound stronger than the structured `promptTruth` data.
- For non-archived routes, the immediate runtime artifact remains the main truth source; `recentAuditTrail` is a session-archive feature, not a universal turn log (`lib/penny-route-handlers.js:469-505`).

### 3. Whether the current trust/provenance/memory surfaces are actually truthful

Mostly yes now, with an important caveat.

- `promptTruth`: mostly literal now
- `recentAuditTrail`: mostly literal as a compact prompt-time snapshot plus post-turn ledger status
- `lastRetrieval.summary`: truthful as a **compatibility summary**, but intentionally lossy; it is **not** a full rendered/held-back receipt by itself

What still overstates certainty is mostly the **narrative layer**, not the structured layer:

- `artifact.summary.text`
- some `wakeHierarchy` wording

### 4. Whether current complexity is good complexity or swamp complexity

Mostly good complexity in the memory model itself.

The swamp hotspot is the **receipt plumbing**, not the companion-memory design:

- prompt truth
- artifact summaries
- archive audit slices
- inspector views
- QA witnesses

That stack is now the main maintainability risk.

### 5. Whether the docs still honestly match the code

Mostly yes, and much more than last round.

- `README.md:34-42` and `132-143` are directionally honest.
- `docs/penny-runtime-authority-contract-2026-04-17.md:12-17` now matches the intended shipped contract well.

The code is slightly sloppier than the docs in one narrow place: the artifact headline/prose summaries still overstate more than the structured receipts do.

### 6. The single most valuable next bounded slice before more live user testing

**Research-ledger trust-hardening.**

If I were being brutally practical, I would do one bounded pass with two rules:

1. **Make topic identity truly normalization-driven**
   - derive `topicId` from normalized `scopeKey`, not `scopeLabel`
   - keep `scopeLabel` as display text only
   - add lexical-reorder merge tests

2. **Make settled conclusions evidence-tight**
   - do not automatically persist raw assistant wording as a `settled` conclusion
   - either extract only evidence-backed claims, or mark the whole conclusion provisional when it goes beyond the verified anchor

That slice buys the most truthfulness per unit of work before longer live QA.

## Bonus answers

### Do `promptTruth`, `recentAuditTrail`, and `lastRetrieval` now tell the literal truth about what Penny actually selected, rendered, held back, and mutated after the turn, or is any receipt still overstating certainty?

- **`promptTruth`**: yes, mostly literal now.
- **`recentAuditTrail`**: yes, for the compact slice it stores; it cleanly separates prompt-time truth from post-turn `researchLedger.updateStatus`.
- **`lastRetrieval.summary`**: truthful as a compact compatibility summary of selection state, but it is intentionally lossy and should not be read as the standalone rendered/held-back receipt.

The remaining overstatement is mostly in:

- `lib/penny-runtime-artifacts.js:1386-1395` (`summary.text`)
- `lib/penny-runtime-artifacts.js:1139-1141` and `1166-1168` (`wakeHierarchy` prose)

So: **core structured truth is mostly fixed; narrative wrappers are not fully disciplined yet**.

### Is the new question-scoped research-ledger identity the right granularity, or is the scope normalization still too brittle or too merge-happy before more live memory QA?

The **granularity is right**.
The **implementation is still too brittle**.

I am more worried about **false splits** than false merges right now.

The concrete bug is that `topicId` still depends on `scopeLabel` order even when `scopeKey` is identical (`lib/penny-research-ledger.js:338-345`).

### Are there any remaining places where post-turn `researchLedgerUpdate` and prompt-time truth could drift apart again through hidden coupling?

I did **not** find the old core bug again.

The important separation is now real:

- prompt-time truth is frozen via `promptTruth`
- post-turn mutation is stored separately in `researchLedger.updateStatus`
- `buildArchiveAuditSnapshot(...)` in `lib/penny-route-handlers.js:405-466` keeps those lanes separate

The remaining drift risk is now mostly from **derived compatibility layers** and **narrative summaries**, not from the underlying prompt-time receipt.

### Is the `recentAuditTrail` plus compatibility `lastRetrieval.summary` shape a good bounded compromise, or is there a cleaner additive contract to prefer before this hardens further?

It is a **good bounded compromise** right now.

I would keep:

- full runtime artifact for deep truth/debugging
- compact `recentAuditTrail`
- compatibility `lastRetrieval.summary`

I would **not** add a third sibling receipt.

My only caution:

- `recentAuditTrail` is truthful but compact
- `lastRetrieval.summary` is truthful but lossy
- neither should be treated as a substitute for the full runtime artifact

Also, `recentAuditTrail` only exists for turns that are actually archived (`lib/penny-route-handlers.js:469-505`). That is fine if intentional; just do not oversell it as a universal turn log.

### Does the current memory QA harness now test the right semantics, or are there still brittle matcher assumptions that will waste future long live-QA time?

It tests **more of the right semantics** than before.

But yes, there are still brittle matcher assumptions that can waste time:

- substring-style truth replacement
- phrase-sensitive pass/fail criteria
- scenario wording coupling

So the harness is now a **better regression net**, but still not a strong enough semantic judge to fully trust unattended on long live-QA.

### What is the single best bounded next slice before more live-QA: semantic archive retrieval quality, ledger identity refinement, audit-surface simplification, or something else?

**Ledger trust-hardening**.

If forced to choose from your list, the closest bucket is **ledger identity refinement** — but I would explicitly include **conclusion/status hardening** in that same slice.

I would *not* spend the next slice on broad archive retrieval quality or broad audit-surface simplification first.

### Are there any truth/provenance surfaces here that should be removed or collapsed because they risk becoming ceremony instead of reliable debugging signal?

Yes, but only the compatibility duplicates — and not before current consumers are migrated.

The two best collapse candidates are:

1. `researchLedgerPromptInjected`
   - keep it only as a temporary compatibility alias derived from `promptTruth`
2. duplicated `promptTruth` under both `artifact.promptTruth` and `artifact.modelAdvisory.promptTruth`
   - pick one canonical location once the UI / QA no longer need the fallback path

I would **not** remove:

- `promptTruth`
- `recentAuditTrail`
- `lastRetrieval.summary`

Those are pulling their weight.

### If I were being brutally practical, where is the current swamp-complexity hotspot that most threatens maintainability even if behavior is now more truthful?

The hotspot is the **parallel receipt stack**:

`memory.js` → `runtime-artifacts.js` → `route-handlers.js` → `memory-archive.js` → `memory-panel.mjs` → `qa-penny-memory.js`

That is where future drift will come from if you keep adding truth/provenance siblings.

### What is the most likely way Penny could still look truthful in artifacts while being wrong in behavior?

Not via the old prompt-use lie.
That looks much better now.

The most likely remaining path is:

1. verified tool evidence supports a **narrow** fact
2. Penny says something **broader**
3. the ledger stores that broader conclusion as `settled`
4. later artifacts honestly say that ledger topic was rendered
5. the behavior is still semantically wrong because the topic itself was too strong

So the next truth bug is no longer “receipt drift.”
It is “**honestly rendering a bad ledger proposition**.”

## Plain-English explanation for a non-expert

The good news is that Penny’s new receipts are much more honest than before.

The bad news is that one important memory system — the research ledger — can still make two kinds of mistakes:

1. save the **same question** in multiple buckets just because it was worded a little differently
2. save Penny’s **broader interpretation** as if a tool had fully proved it

So the next smart step is **not** adding more features.
It is tightening how the research ledger:

- decides two questions are the same
- decides something is really “settled” versus only a tentative conclusion

That is the highest-value cleanup before more live user testing.
