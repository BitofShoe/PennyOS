# Penny Deterministic Extraction QA Plan

> Category: Implementation plan
> Authority: Later-if-needed planning note
> Status: Draft; not queued runtime work
> Use this for: preserving the document/numeric extraction lesson if Penny later grows document ingestion QA.
> Do not use this for: wiring OCR now, adding hosted document tools, approving a CMS/source warehouse, or treating LLM summaries as numeric truth.

## Goal and success criteria

- Goal:
  Preserve the deterministic extraction lesson from the April 21 link-batch research without prematurely building document infrastructure.
- User-facing or engineering success criteria:
  If Penny later needs finance, tax, form, table, or other high-precision document ingestion, the first fixture shape requires source receipts, numeric checks, schema expectations, and manual review before LLM reasoning is trusted.
- What will be considered done:
  This note is indexed as a later plan. No runtime code, OCR tool, hosted connector, document-management surface, or QA runner exists until a future slice proves document ingestion matters.

## Task fit

- Blockers:
  No current Penny pain requires a document ingestion pipeline.
- Complexity:
  Low as a docs-only planning note; medium-high if later implemented because OCR, table extraction, and source receipts can fail in source-specific ways.
- Confidence:
  High for preserving the fixture contract; low for picking exact OCR/table libraries before a real document source exists.
- Touched owners:
  Near-term docs only: `docs/plans/` and `docs/README.md`.
- Verification cost:
  Docs diff and markdown review only.
- Cleanup risk:
  Low, because this creates no generated artifacts and touches no runtime state.

## Decisions already locked

- Constraint or decision:
  Deterministic parsing, schemas, numeric checks, and source receipts come before LLM reasoning for finance/tax-like PDFs and tables.
- Constraint or decision:
  LLM summaries are advisory unless backed by extracted source receipts and validation checks.
- Constraint or decision:
  Manual review is required by default for high-precision document extraction fixtures.
- Constraint or decision:
  This is a later, if-needed plan, not a near-term runtime slice.

## Source pressure

- [penny-link-batch-research-pass-2026-04-21.md](../penny-link-batch-research-pass-2026-04-21.md) says local LLMs alone are not reliable for numeric extraction from messy PDFs, and recommends OCR/table extraction, deterministic checks, schemas, chunking, and human review.
- [penny-document-chunking-notes.md](../penny-document-chunking-notes.md) says raw PDFs are presentation formats, not good primary reasoning formats, and argues for normalized text, meaningful sections, indexes, and source references.
- The Paperless-style lessons are useful as pipeline pressure only: original-vs-derived identity, preflight/normalize/chunk/extract/dedup/review packets. They are not a reason to import document-management product scope.

## Future fixture shape

If document ingestion matters later, start with fixture data shaped like this:

```js
{
  schema: 'penny-document-extraction-qa.v1',
  sourceType: 'pdf' | 'csv' | 'image-table' | 'text',
  extractionMode: 'deterministic' | 'ocr-assisted' | 'llm-summarized',
  expectedFields: [],
  numericChecks: [],
  sourceReceipts: [],
  manualReviewRequired: true,
  llmReasoningAllowed: false
}
```

Field intent:

- `schema`: stable artifact contract for fixtures and future QA output.
- `sourceType`: source medium, not trust level.
- `extractionMode`: what produced the candidate fields; `llm-summarized` should not satisfy numeric truth by itself.
- `expectedFields`: named fields the extraction must produce, with optional type/format expectations when a future fixture needs them.
- `numericChecks`: exact, range, sum, cross-field, or source-line checks for numbers.
- `sourceReceipts`: source page, row, table, region, line, checksum, or excerpt pointers that let a reviewer trace every important field.
- `manualReviewRequired`: defaults to `true` for high-precision documents.
- `llmReasoningAllowed`: defaults to `false`; can become `true` only after the fixture's deterministic checks and source receipts pass.

## Later owner seams

Only if a future slice proves this is needed:

- `lib/penny-document-extraction-qa.js`
  Own the fixture normalizer, validation helpers, failure taxonomy, and source-receipt interpretation.
- `scripts/qa-penny-document-extraction.js`
  Write a deterministic or fixture-only QA artifact from checked-in safe samples.
- `test/penny-document-extraction-qa.test.js`
  Cover schema validation, numeric checks, receipt requirements, manual-review gates, and the rule that LLM summaries cannot pass numeric extraction alone.

## Proposed future checks

- Required fields are present and type-compatible.
- Numeric fields match exact or tolerance checks from source data.
- Totals and subtotals reconcile where the source provides both.
- Every high-impact extracted field has at least one source receipt.
- OCR-assisted extraction carries degraded/capability state when table/region confidence is weak.
- Manual review gates remain explicit instead of silently approving uncertain fields.
- LLM reasoning is blocked until deterministic checks and receipt requirements pass.

## Boundary

- Do not wire OCR now.
- Do not add hosted document tools.
- Do not add Sanity, NotebookLM, Paperless-style product surfaces, CMS/source warehouse behavior, scanner/email ingestion, share links, or broad document chat.
- Do not add runtime memory promotion from extracted document facts.
- Do not expand PromptTruth or `toolEvidenceReceipt` for this plan.
- Do not change LM Studio state, prompt text, browser-extension capture, web-page auto-ingest, or live QA/eval behavior.

## Verification plan

- Automated checks:
  `git diff --check HEAD`
- Manual checks:
  Confirm the docs index labels this as a later-if-needed plan.
- What should stay unchanged:
  Runtime code, tests, prompts, memory behavior, source ingestion behavior, and live model state.
- What would count as out-of-scope drift:
  Any OCR wiring, hosted connector, source warehouse, document-management UI, runtime route, or test runner added before a real document-ingestion need exists.

## Results and handoff

- Landed:
  Planning note only.
- Verified:
  Docs diff and whitespace checks.
- Deferred:
  All runtime owners, OCR/table extraction choices, QA fixtures, and tests.
- Cleanup completed:
  No generated artifacts created.
- Follow-up owner or next slice:
  Future document-ingestion slice, only if Penny gets a concrete high-precision document workflow.
