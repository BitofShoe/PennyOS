# Penny Memory and Agent Link Review - 2026-05-12

> Category: external-source research synthesis
> Authority level: historical evidence
> Current status: current source review as of 2026-05-12
> Use this for: bounded Penny memory ideas, coding-agent workflow ideas, and follow-up slice selection
> Do not use this for: runtime law, dependency approval, license approval, model proof, memory ingestion, PromptTruth expansion, toolEvidenceReceipt expansion, default context changes, or permission to platformize Penny

Reviewed sources:

- Medium: <https://medium.com/@upayan1231/how-i-accidentally-rebuilt-the-human-brain-trying-to-stop-a-chatbot-from-forgetting-me-fc8dea6e41eb>
- Reddit: <https://www.reddit.com/r/codex/comments/1ta7k2c/i_wrote_about_building_a_memory_system_for_llms/>
- GitHub: <https://github.com/pbakaus/impeccable>

Supporting sources checked because the Medium/Reddit discussion pointed at them:

- Synapse-OSS: <https://github.com/UpayanGhosh/Synapse-OSS> at `3041e90d82e1cef13087b392eef8f883afb24047`
- Athena-Public: <https://github.com/winstonkoh87/Athena-Public> at `1ce58926f2ac2f6897880398cc14c687e33c70ff`

## Source Health

- Medium was reachable and readable. Treat it as a self-reported design narrative, not proof. It provides no reproducible evals, privacy threat model, or code-level contract in the article itself.
- Reddit was reachable, with visible discussion around the memory-system post. Treat it as low-to-medium authority social evidence. The skeptical comments are useful because they name failure modes Penny already cares about: memory poisoning tone, retrieval being hit-or-miss, and token waste.
- `pbakaus/impeccable` was reachable, cloned, and inspected at `e587004ee42883dad40d14cd0f5e1b21ae1933df`. It is Apache-2.0 with a NOTICE file crediting upstream design-skill sources. It has a real skill package, CLI, detector, docs, extension, and tests, but it should remain a sidecar review tool unless a later slice explicitly adopts it.
- Synapse-OSS was inspected as implementation context for the Medium/Reddit memory claims. It is useful background for patterns, but its multi-channel assistant architecture is much broader than Penny.
- Athena-Public was inspected only as adjacent comparison from the thread. Its most relevant idea is file-based, just-in-time context for coding agents, not a Penny runtime import.

## Already Landed In Penny

These sources mostly confirm directions Penny already chose:

- Penny already has a hybrid memory stack: explicit canonical memory, archive memory, semantic IDs/domains/claims/source audits, open loops, research ledger context, PromptTruth receipts, and sibling toolEvidenceReceipt artifacts.
- The archive policy already scores more than vector similarity. It includes exact anchors, contradiction repair, source authority, evidence count, open-loop signal, recency, sensitivity, and rerank-shadow paths in `lib/penny-memory-archive-policy.js`.
- Review-gated consolidation already exists as a principle. `lib/penny-session-reflection.js`, memory suggestions, and promotion queues keep suggested memory below canonical explicit memory.
- Dynamic memory links already exist as retrieval/navigation hints rather than proof or graph-database law.
- The repo already has local skills, delegation guidance, and docs authority boundaries for agents coding Penny.

So the right move is not "build Synapse inside Penny" or "install a memory OS." The right move is to sharpen the failure cases where Penny's current architecture could still lie, over-remember, or help agents change the UI without enough local taste/context.

## Definitely Useful

### 1. Add a memory-context canary for stale or tone-poisoning recall

The strongest Reddit lesson is not that Penny needs more memory. It is that memory can make a companion worse when a semantically relevant item is stale, emotionally wrong, or too heavy for the current moment.

Good follow-up slice:

- Add fixture coverage where an archive item is semantically close but should be held back, demoted, or labeled advisory because it is stale, contradicted, sensitive, or mood-poisoning.
- Verify the final response does not over-personalize from that item.
- Keep this fixture-only or isolated; do not touch the user's live memory.

Likely owners:

- `lib/penny-memory-archive-policy.js`
- `lib/penny-memory-archive.js`
- `test/penny-memory-archive-policy.test.js`
- `test/penny-candidate-survival-qa.test.js`
- `scripts/qa-penny-memory.js`

Useful proof:

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-candidate-survival-qa.test.js
```

### 2. Add entity-collision and relationship-ambiguity fixtures

The Medium/Synapse framing stresses that vector recall remembers "what" better than "why." Penny can use that as a QA prompt, not as a storage migration.

Good follow-up slice:

- Add cases where two people, projects, or relationships share a name or near-name.
- Expected behavior: keep the entities separate, prefer `unknown` or a clarification path, and avoid merging relationships just because the embedding match is strong.
- Tie this to existing semantic claims and memory-link policy rather than a new graph store.

Likely owners:

- `lib/penny-memory-links.js`
- `lib/penny-memory-link-policy.js`
- `lib/penny-semantic-claims.js`
- `test/penny-memory-links.test.js`
- `test/penny-semantic-claims.test.js`

Useful proof:

```bash
node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-semantic-claims.test.js
```

### 3. Add a capability-profile canary for Penny and coding agents

Both the memory article and the coding-agent tooling discussion point at the same small failure: agents often say they cannot do something that their current tool surface can actually do, or they claim access they do not have.

Good follow-up slice:

- Add QA cases where files, local commands, or source checks are available and the assistant must not fall into unsupported "I cannot access that" boilerplate.
- Also add the inverse case: when access is absent or unverified, the response must say `not run`, `not checked`, or `unknown` instead of bluffing.
- Keep this as a trust/capability canary. Do not weaken action-safety or make external writes automatic.

Likely owners:

- `server.js` prompt-facing tool/capability guidance
- `lib/penny-tool-registry.js`
- `lib/penny-qa-trust.js`
- `scripts/qa-penny-voice-redo.js`
- relevant trust/voice tests after seam inspection

### 4. Use Impeccable as an optional UI review sidecar

Impeccable is best treated as a design-review sidecar for agents coding Penny, not a Penny dependency.

Possible use:

```bash
npx impeccable detect public/ --fast --json
```

Notes:

- A local detector run against `public/styles.css` flagged `Space Grotesk` and one side-tab-style border. Those are advisory only. They are not bugs by themselves because Penny's existing visual identity may intentionally choose them.
- The useful part is the workflow: gather product/design context first, run deterministic checks before subjective polish, then decide whether any finding conflicts with Penny's identity.
- Do not make Impeccable binding CI or default law without a separate adoption slice.

Likely owner if documented:

- `.codex/skills/penny-link-review/SKILL.md`
- `.codex/skills/README.md`
- `docs/plans/TEMPLATE.md`

### 5. Add a small external-tool intake checklist for coding agents

The Impeccable repo is useful because it packages a skill, command vocabulary, detector, browser workflow, and harness notes. Penny does not need to copy those pieces, but agents coding Penny could use a tighter intake checklist before adopting external tools.

Checklist shape:

- license and NOTICE checked
- network or data-egress behavior checked
- runtime-law conflict checked
- Penny voice/product identity conflict checked
- source-health and version pin recorded
- one local command or fixture proof recorded
- adoption mode chosen: reject, sidecar, docs-only, fixture-only, or runtime candidate

This fits Penny's existing skills better than it fits runtime code.

## Maybe Useful Later

- A local reranker or second-stage scorer, but only if candidate-survival QA proves the current archive policy misses important cases.
- A more explicit relationship-walk for personal entities, but only if entity-collision fixtures expose a real failure.
- A review-gated style or feedback profile for Penny's companion voice, but never an automatic persona mutation layer.
- An optional project-local install of Impeccable for UI-heavy coding sessions, after license/NOTICE review and conflict checks.
- Athena-style session start/end compaction for coding agents working on Penny. Keep it in repo skills or handoff docs, not Penny's user-memory runtime.

## Do Not Add

- Do not add Synapse's broad multi-channel gateway, WhatsApp/Telegram/Discord/Slack routing, LiteLLM routing, Vault privacy layer, or SBS auto-persona updater to Penny.
- Do not add a graph database, LanceDB migration, sqlite-vec migration, browser-extension capture path, or hosted memory service from these links.
- Do not ingest the Medium article, Reddit thread, Synapse docs, Athena docs, or Impeccable references into Penny memory, runtime voice, PromptTruth, toolEvidenceReceipt, or default context.
- Do not treat emotional salience as durable truth. In Penny, affective signals should influence review priority or response care, not automatically become facts about the user.
- Do not treat Impeccable's design bans as higher authority than Penny's local UI identity or this repo's frontend guidance.

## Risks

- License: Medium and Reddit content are not code licenses. Impeccable is Apache-2.0, but its NOTICE references upstream design-skill sources and a typography reference with separate upstream licensing language. Synapse-OSS and Athena-Public were MIT at inspection time. Copying code or prose still needs a focused license pass.
- Privacy: the broadest sources assume capture, sync, channels, or long-lived personal memory. Penny should stay local, inspectable, and review-gated.
- Platformization: Synapse and Athena solve broader assistant-platform or memory-OS problems. Penny is a single-user local companion prototype.
- Evidence: the Medium/Reddit memory claims are mostly anecdotal. Use them to design Penny QA fixtures, not to justify architecture churn.
- Authority: this document is historical source synthesis. Code, tests, runtime artifacts, and current-law docs win when they disagree.

## Recommended Next Slice

The best near-term slice is the memory-context canary:

1. Add isolated fixtures for stale, contradicted, sensitive, and tone-poisoning archive candidates.
2. Assert selected/rendered prompt candidates stay honest and bounded.
3. Assert the visible reply does not over-personalize from held-back or advisory memory.
4. Run only fixture/unit QA, not live LM Studio or user-memory QA.

Acceptance criteria:

- New tests cover at least one stale candidate, one contradicted candidate, and one emotionally loaded but unsupported candidate.
- The candidate trace or PromptTruth-adjacent receipt makes the holdback/demotion reason inspectable.
- No changes to canonical user memory, runtime voice, default model, context budget, PromptTruth schema, or toolEvidenceReceipt schema.

Verification commands for that slice:

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-candidate-survival-qa.test.js
npm run qa:session-reflection
```

For this docs-only review note:

```bash
git diff --check
```
