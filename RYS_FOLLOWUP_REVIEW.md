# RYS Follow-Up Review

Date: 2026-04-12

Sources reviewed:
- Reddit: [RYS II - Repeated layers with Qwen3.5 27B and some hints at a "Universal Language"](https://www.reddit.com/r/LocalLLaMA/comments/1s1t5ot/rys_ii_repeated_layers_with_qwen35_27b_and_some/)
- Blog: [LLM Neuroanatomy: How I Topped the LLM Leaderboard Without Changing a Single Weight](https://dnhkng.github.io/posts/rys/)
- Blog: [LLM Neuroanatomy II: Modern LLM Hacking and hints of a Universal Language?](https://dnhkng.github.io/posts/rys-ii/)

## Short answer

Yes, there are useful ideas here for Penny.

But the most applicable ideas are about **evaluation methodology and architecture boundaries**, not "go rebuild Penny around repeated layers tomorrow."

The RYS material is most valuable for this project in three ways:

- how to search model/design space cheaply with small deterministic probes
- how to validate promising ideas on larger holdout sets afterward
- how to think about separating deep reasoning state from final surface language

That last point maps surprisingly well to Penny's existing semantic-core -> Penny-render path.

## What seems newly useful for Penny

### 1. Improve model eval methodology with a two-stage search -> validate workflow

This is the strongest practical takeaway that does **not** seem fully applied yet.

The RYS articles use:

- tiny, fast, objective probes for broad search
- then larger validation sets for final judgment

For Penny, that suggests:

#### Fast probe layer

Use very short, highly repeatable prompts for:

- memory recall accuracy
- tool-routing accuracy
- direct-intent detection
- syntax-check / edit verification behavior
- short "Penny voice stays Penny while technical" checks
- latency under identical prompt shapes

These should be cheap enough to run a lot.

#### Validation layer

Only after a candidate model/prompt/routing change looks good on the cheap probes, re-run the heavier suites:

- full voice QA
- longer agentic inspect/edit tasks
- real web-tool tasks
- multi-turn memory tests

This would make the current eval process faster and less noisy.

### 2. Add more objective scoring instead of relying mostly on pass/fail or vibe checks

The first RYS article is very strong on this point:

- prefer objective or partially objective scoring
- avoid expensive LLM-judge loops when possible
- preserve gradient in the score instead of only binary success/failure

For Penny, useful examples would be:

- memory recall score:
  exact match / partial key match / wrong
- agentic coding score:
  route selected correctly / edit performed / syntax passes / diff matches requested change
- voice score:
  detected bland-tell count, swear count, repetition count, canned-helper phrase count
- latency score:
  median and p95 per prompt bucket

This repo already started doing some of that in `scripts/eval-penny-models.js`, but it is not yet a fully intentional scoring framework.

### 3. Consider RYS/Qwen variants as **bench candidates**, not architecture commitments

This repo is still mostly benchmarking Gemma-family models.

Given Penny's current pain points, a RYS or Qwen3.5-family candidate could be worth testing if:

- it runs cleanly in your local stack
- it is measurably better at tool planning / inspect / agentic edits
- it does not wreck Penny's tone

Important caveat:

- this should be treated as a **contained benchmark lane**
- not as a core architecture rewrite

The Reddit thread itself suggested the community still needed more baseline benchmarking and fine-tuning work, and the author also noted that repeated-layer setups benefit from fine-tuning. So for this project, the right move is "benchmark carefully," not "bet the app on it."

### 4. The semantic-core -> Penny-render split now looks even more justified

The RYS essays argue, in effect, that middle-layer reasoning can be usefully separated from surface expression.

Penny already has an architectural cousin of that idea:

- verified tool facts are gathered
- a semantic core is built
- final output is rendered in Penny's voice

That does not prove the same theory, but it **does** suggest the direction is sane.

I would call this an area where the project was ahead of the source material rather than behind it.

### 5. Probe sets should be more orthogonal

The RYS work explicitly tries to use orthogonal task families rather than one narrow benchmark.

For Penny, the current evals would be stronger if they intentionally separated:

- voice / chemistry
- technical clarity
- memory durability
- routing correctness
- tool-use completeness
- latency / timeout behavior

Right now these categories are present, but not always cleanly separated.

## What does **not** look like the right move yet

### 1. Rebuilding Penny around repeated-layer custom model surgery

This feels premature.

Reasons:

- Penny currently runs through LM Studio and a simple local Node stack
- custom repeated-layer formats may complicate inference support, deployment, and reproducibility
- the current bottlenecks are still mostly:
  - monolithic backend structure
  - missing automated tests
  - eval/noise management
  - long-turn latency

So yes, benchmark RYS-style models if practical.
No, do not turn this project into a model-hacking lab before the app itself is cleaner.

### 2. Chasing the "universal language" idea as a product feature

Interesting research idea.
Not currently a top product improvement.

Unless Penny is about to become meaningfully multilingual or gain a more formal intermediate reasoning representation, this is insight, not roadmap.

## Updated codebase review

## Findings

### [P1] The biggest recommendation from the last review was documented, but not actually executed in code

The repo now has good docs acknowledging the backend monolith, but the monolith itself kept growing:

- [`ARCHITECTURE.md:265`](./ARCHITECTURE.md#L265) explicitly says the biggest debt is that `server.js` is doing too many jobs
- [`ARCHITECTURE.md:269`](./ARCHITECTURE.md#L269) lists the mixed responsibilities
- [`server.js`](./server.js) is now about 4,897 lines

At the last review, `server.js` was about 4,747 lines. So the advice was **recognized**, but the runtime code moved further in the opposite direction.

Verdict: **partially followed in docs, ignored in implementation**

### [P1] There is still no real automated test lane for the riskiest backend logic

The repo has QA/eval scripts, which is good, but `package.json` still exposes no `test` script or normal automated verification entrypoint:

- [`package.json:6`](./package.json#L6) through [`package.json:12`](./package.json#L12)

Meanwhile, important correctness logic still lives in handwritten heuristics inside `server.js`, for example:

- [`server.js:320`](./server.js#L320) `selectMemoriesForPrompt`
- [`server.js:653`](./server.js#L653) `looksLikeActionableToolRequest`
- [`server.js:669`](./server.js#L669) `shouldOfferLocalTools`
- [`server.js:2605`](./server.js#L2605) `executeDirectProjectInspectIntent`

These are exactly the kinds of functions that should have fast unit tests.

Verdict: **mostly ignored**

### [P2] File-management advice was followed conceptually, but not enforced mechanically

The repo now has a much better map of what is source versus artifact:

- [`CODEBASE.md:175`](./CODEBASE.md#L175) calls `output/` generated artifacts
- [`CODEBASE.md:187`](./CODEBASE.md#L187) says it is noisy
- [`CODEBASE.md:267`](./CODEBASE.md#L267) through [`CODEBASE.md:270`](./CODEBASE.md#L270) explicitly call out large files and noisy root layout

But the mechanical policy is still weak:

- [`package.json`](./package.json) has no cleanup/archive scripts
- [`.gitignore:1`](./.gitignore#L1) through [`.gitignore:3`](./.gitignore#L3) only ignore three directories
- `output/`, `.playwright-cli/`, live server metadata files, logs, screenshots, and handoff docs are still easy to accumulate in-place

So the repo now **knows** the file-management problem exists, but it has not really been systematized yet.

Verdict: **partially followed**

## What the repo did improve since the last review

These are real follow-through items:

### 1. `ARCHITECTURE.md` was added

This was one of the clearest recommendations last time, and it was done well:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)

It is honest about current debt, explains the real runtime shape, and is actually useful.

Verdict: **followed**

### 2. `CODEBASE.md` was added

Also a direct follow-through from the last review:

- [`CODEBASE.md`](./CODEBASE.md)

This is a meaningful improvement for future contributors and other agents.

Verdict: **followed**

### 3. The voice system stayed disciplined

The project continued to use the canon -> distilled -> runtime structure in `penny-voice/`.

That remains one of the healthiest parts of the repo.

Verdict: **followed**

### 4. OpenClaw stayed in the "prove it first" bucket

The repo did not overcommit to shadow mode, which was exactly the cautious recommendation from the last pass.

Verdict: **followed**

## What still looks weak

### 1. Runtime architecture is cleaner on paper than on disk

The docs got better faster than the code layout did.

That is still net positive, but it means the project has entered the "we can describe the monolith clearly" phase, not the "we have reduced the monolith" phase.

### 2. Artifact density is still high

The repo root, `output/`, and support dirs still gather a lot of one-off material. Some of this is unavoidable, but the current structure still makes retrieval/navigation noisier than it should be for future agent work.

### 3. Eval culture is strong, but the base test layer is missing

The repo is good at bespoke QA runs and benchmark notes.
It is still weak at "safe fast regression tests for core decision logic."

## Concrete next steps I would recommend now

### High priority

1. Add a real `test` lane.

Even a small `node:test` suite would be a big step.

Start with:

- `selectMemoriesForPrompt`
- actionable tool gating
- direct inspect intent detection
- memory extraction / merge behavior
- mood-tag precedence

### High priority

2. Turn the RYS lesson into an eval refactor, not a model rewrite.

Specifically:

- small cheap probes first
- larger validation afterward
- clearer scoring rubrics
- more separation between voice, routing, memory, and tool correctness

### High priority

3. Freeze further `server.js` growth and split one subsystem out

Best first candidate:

- memory logic

Second-best:

- project/web tool helpers

### Medium priority

4. Enforce file-management policy instead of only documenting it

Examples:

- ignore or archive more generated artifacts
- add cleanup scripts
- put dated eval runs under subfolders
- keep screenshots and temporary research extracts out of source-heavy folders where possible

### Medium priority

5. Add one benchmark lane for a non-Gemma candidate

Not because RYS is guaranteed to win.
Because Penny currently benefits from comparing model families instead of tuning one family forever.

## Final verdict on whether the last advice was followed

### Followed

- Add architecture documentation
- Add a practical codebase map
- Keep voice assets compressed and structured
- Keep OpenClaw shadow skeptical and bounded

### Partially followed

- Improve file management
- Improve evaluation methodology
- reduce codebase confusion for future agents

### Not really followed yet

- split `server.js`
- add automated tests for core backend behavior
- turn file-management guidance into actual repo policy

## Bottom line

The project did **not** ignore the last review.

It followed the **documentation and framing** advice very well.

But it has not yet followed the two most expensive recommendations:

- modularizing the backend
- adding automated tests for the backend heuristics

The RYS material reinforces that those two things matter even more now, because once you start doing more serious model comparisons, you need cleaner architecture and cheaper, more objective evals or you end up benchmarking noise.
