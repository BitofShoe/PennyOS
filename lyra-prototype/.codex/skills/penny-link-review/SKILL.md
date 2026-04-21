---
name: penny-link-review
description: Standardize Penny external link-batch research and source review passes. Use when Codex is given external URLs, papers, repos, articles, Reddit threads, docs, or source bundles and needs to assess source health, repo applicability, risks, authority conflicts, owner seams, verification commands, and bounded next slices without adding runtime infrastructure.
compatibility:
  os:
    - Windows
  shell:
    - PowerShell
  node: ">=24 <25"
  npm: ">=11 <12"
allowed-tools:
  - functions.shell_command
---

# Penny Link Review

Use this skill for Penny external-source review passes. The goal is a grounded research artifact or handoff that turns a batch of links into bounded Penny-native decisions.

## Default Workflow

1. Inventory every supplied source and deduplicate obvious repeats.
2. Check source health before deep synthesis. If the user asked to be notified about broken links, stop and report blockers before continuing.
3. Read current repo truth before recommendations: `docs/README.md`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and any owner docs for the touched seam.
4. Classify each useful lesson into the required output buckets below.
5. Translate external ideas into Penny seams, verification cost, and bounded next slices.
6. Keep the final artifact explicit about scope, limits, and authority. External sources are evidence, not current repo law.

## Required Output Buckets

Every link-batch review must include these buckets, even if a bucket says `none`:

- Source health
- Already landed
- Strengthen now
- Maybe later
- Do not add
- License/access risk
- Privacy/local-data risk
- Platformization risk
- Current-law conflict
- Owner seams
- Verification commands
- Artifact scope/limits

## Bucket Guidance

- Source health: record reachability, redirects, paywalls, missing raw files, stale docs, dynamic-page failures, and which sources were not actually read.
- Already landed: name the Penny feature, doc, helper, test, artifact, or runtime seam that already covers the lesson.
- Strengthen now: include only small, repo-native improvements with a plausible owner and cheap verification path.
- Maybe later: reserve for ideas that need a demonstrated Penny pain or a separate plan before implementation.
- Do not add: reject imports that would turn Penny into a generic platform, hosted service, browser extension stack, CMS, graph-memory server, workspace OS, or broad multi-agent system.
- License/access risk: flag no-license, restrictive-license, source-unavailable, paywalled, or unclear-copyability material. Treat risky sources as pattern input only.
- Privacy/local-data risk: identify anything that would export user data, centralize private memory, scrape browsing state, sync to hosted services, or weaken local-first boundaries.
- Platformization risk: call out when an external project is solving multi-user, hosted, marketplace, enterprise, or generalized-agent problems that Penny does not currently have.
- Current-law conflict: compare claims against current Penny law and, for legal/regulatory claims, official/current sources. Mark unverified law-like claims as unverified instead of laundering them into recommendations.
- Owner seams: name the exact repo owners that would change if a follow-up slice is approved. Prefer existing `lib/`, `public/js/`, `scripts/`, `docs/`, or skill owners over new infrastructure.
- Verification commands: list the narrow commands or manual checks that would prove the recommendation. Include `git diff --check` for docs-only changes and targeted tests for code slices.
- Artifact scope/limits: state whether the output is historical evidence, implementation plan, generated artifact, or current-law update. State what it must not be used for.

## Guardrails

- Do not add browser-extension capture to Penny core.
- Do not auto-ingest web pages into Penny memory.
- Do not create a CMS, source warehouse, hosted sync layer, or broad knowledge platform.
- Do not copy code from no-license, unclear-license, or restrictive-license repos.
- Do not treat external source enthusiasm as approval to widen PromptTruth, `toolEvidenceReceipt`, runtime voice, memory authority, or LM Studio defaults.
- Do not recommend larger context or broader retrieval before proving a Penny-specific failure.

## Recommended Artifact Shape

For a standalone report, start with:

```markdown
# Penny External Link Review - YYYY-MM-DD

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of YYYY-MM-DD
> Use this for: ...
> Do not use this for: current runtime law, dependency approval, broad platform replacement, runtime voice changes, PromptTruth expansion, or toolEvidenceReceipt expansion.
```

Then use the required buckets as section headings. End with a compact "Suggested next slice" that names goal, owner seams, verification commands, and explicit non-goals.
