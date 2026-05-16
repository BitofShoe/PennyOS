# Penny Semantic Identity + Provenance Contracts Plan

> Date: 2026-04-22
> Status: Agent handoff / implementation planning doc
> Scope: Post-Dynamic-Memory-Linking semantic-system hardening
> Core recommendation: **Borrow RDF's discipline, not RDF's machinery.**
> Primary next implementation theme: stable semantic IDs, typed claim contracts, provenance/authority domains, and structured candidate QA.

---

## 0. Executive Summary

RFC 3870 and its cited RDF/URI/Web architecture sources are useful for Penny, but **not** because Penny should adopt RDF/XML, SPARQL, a triplestore, ontology inference, or Linked Data publishing.

The useful import is narrower and more Penny-shaped:

```text
identifier discipline
claim/provenance discipline
authority domains
relation/predicate contracts
stable source IDs
source separation
"garbage in, garbage out" warnings
```

Penny already has the important product-law shape:

```text
explicit memory = canonical
archive/session/global/research/static/open-loop context = advisory unless promoted by existing reviewed paths
semantic/static retrieval = candidate discovery, not truth authority
PromptTruth = prompt-time rendered/candidate memory/research context
toolEvidenceReceipt = sibling runtime artifact, not a PromptTruth channel
```

The next useful step after Dynamic Memory Linking is therefore:

```text
Semantic Identity + Provenance Contracts
```

That means Penny should be able to represent and audit claims like:

```text
This source asserted this relation about this subject/object at this time,
under this authority domain,
with this support state,
and this stable local identifier.
```

Not:

```text
The graph says it, therefore it is true.
```

---

## 1. External Source Frame

### 1.1 RFC 3870

RFC 3870 is an Informational RFC from September 2004 that registers the `application/rdf+xml` media type. It describes RDF/XML as an XML serialization for RDF, and RDF as a language intended to support resource description and data exchange on the Web.

For Penny, RFC 3870 is most useful for its warning that RDF can combine assertions from many sources and produce facts or deductions that are false or unclear. Its security considerations explicitly warn designers not to ignore reliability and provenance, ending with the classic "Garbage-in, Garbage-out" concern.

**Penny translation:**

```text
Structured assertions are not automatically true.
Provenance matters.
Source reliability matters.
Combining facts can create false certainty.
```

### 1.2 RDF 1.1 Concepts

RDF 1.1 Concepts defines the basic triple shape:

```text
subject predicate object
```

RDF also distinguishes graphs and datasets, supports named graphs, and warns that blank-node identifiers are local and not persistent or portable. It also defines IRI equality as simple string comparison, with no extra normalization when comparing IRIs.

**Penny translation:**

```text
Use subject / predicate / object as an assertion contract shape.
Keep source domains separate instead of collapsing them into one truth soup.
Do not treat temporary chunk IDs as stable semantic identities.
Do not decide identity with fuzzy generated labels.
```

### 1.3 RFC 3986 and WebArch

RFC 3986 distinguishes identification from interaction: a URI can identify a resource without implying that the resource will or should be accessed. WebArch also gives the useful URI opacity rule: agents should not infer properties of a referenced resource from its URI string unless a relevant specification explicitly licenses that inference.

**Penny translation:**

```text
Identifier != dereference permission.
Identifier != evidence.
Identifier text should be opaque for inference.
Do not auto-fetch arbitrary semantic IDs.
Do not broadcast local memory/source identifiers.
```

---

## 2. Internal Penny Source Frame

Use these internal notes as the project frame:

- `docs/penny-link-batch-research-pass-2026-04-21.md`
  - Use scoped context, tool receipts, deterministic checks, token-cost awareness, and Penny-shaped evals.
  - Keep raw sources, generated synthesis, indexes, logs, and review loops as separate layers.
  - Do not import graph-memory/platform systems wholesale.
- `docs/penny-ledger-prompt-compare-note-2026-04-17.md`
  - Bounded continuity beat sterile amnesia in measured comparison.
  - The better path was not "delete the bridge" and not "leave it noisy," but "keep it, then tighten relevance."
- `docs/penny-sharper-candidate-selection-research-plan-2026-04-21.md`
  - Static/semantic embeddings are cheap discovery machinery, not authority.
  - Candidate survival must show whether the right memory existed, entered the candidate set, ranked, rendered, or was held back.
  - Faster retrieval should improve pre-render selection, not increase prompt bloat.

---

## 3. Core Design Decision

### 3.1 Do This

Build **Penny-native semantic identity and provenance contracts**:

```text
stable local IDs
small predicate registry
structured claim schema
authority domain registry
structured candidate contract QA
source-ID audit
dynamic-link integration
semantic claim traces
rendered-claim authority labels
optional local export artifact
```

### 3.2 Do Not Do This

Do **not** add:

```text
RDF/XML parser
SPARQL
triplestore
graph DB migration
ontology reasoner
public Linked Data publishing
automatic URI dereferencing
semantic web crawler
PromptTruth expansion
raw semantic graph in prompt
semantic/static candidate truth promotion
auto memory promotion
```

### 3.3 The Mantra

```text
Borrow RDF's discipline, not RDF's machinery.
```

More Penny-flavored:

```text
Every semantic claim needs an identity, a relation, a source, an authority, and a temporal state — otherwise it is just vibes with brackets.
```

---

## 4. Why This Belongs After Dynamic Memory Linking

Dynamic Memory Linking will create relation edges like:

```text
episode A correction-of episode B
research note source-for plan C
open loop follow-up-to session decision D
memory item contradicts stale summary E
```

That immediately raises identity/provenance questions:

```text
What exactly is A?
Is A the raw episode, a generated summary, or an extracted claim?
If the archive is regenerated, does A still exist?
If a static embedding candidate points to chunk 14, what source assertion does chunk 14 represent?
If two summaries mention "copper rabbit," are they the same claim or separate evidence?
If a link says correction-of, what predicate contract does that imply?
```

Semantic Identity + Provenance Contracts answer those questions without turning Penny into an RDF system.

---

## 5. The Penny Semantic Claim Model

### 5.1 Safe Semantic Unit

The safe semantic unit is **not**:

```text
subject predicate object = truth
```

The safe semantic unit is:

```text
a source/domain asserted a subject-predicate-object relation
with a support state, authority, temporal scope, and source receipt
```

### 5.2 Example: Explicit Current Memory

```json
{
  "schema": "penny-semantic-claim.v1",
  "claimId": "penny:claim:sha256:...",
  "domainId": "penny:domain:explicit-memory",
  "subject": {
    "id": "penny:user:self",
    "type": "user",
    "label": "the user"
  },
  "predicate": {
    "id": "penny:predicate:favorite-tea",
    "label": "favorite tea"
  },
  "object": {
    "id": null,
    "type": "text",
    "label": "lapsang souchong",
    "text": "lapsang souchong"
  },
  "source": {
    "sourceId": "penny:source:explicit-memory:favorite-tea",
    "sourceType": "explicit-memory",
    "excerpt": "favorite tea = lapsang souchong",
    "observedAt": "2026-04-22T00:00:00.000Z"
  },
  "authority": {
    "sourceAuthority": "canonical",
    "supportState": "verified",
    "canonicality": "canonical",
    "confidence": "high"
  },
  "temporal": {
    "temporalScope": "current",
    "observedAt": "2026-04-22T00:00:00.000Z"
  },
  "status": {
    "stale": false,
    "contradictedBy": [],
    "supersededBy": []
  }
}
```

### 5.3 Example: Stale Advisory Archive Claim

```json
{
  "schema": "penny-semantic-claim.v1",
  "claimId": "penny:claim:sha256:...",
  "domainId": "penny:domain:session-archive",
  "subject": {
    "id": "penny:user:self",
    "type": "user",
    "label": "the user"
  },
  "predicate": {
    "id": "penny:predicate:favorite-tea",
    "label": "favorite tea"
  },
  "object": {
    "type": "text",
    "label": "oolong",
    "text": "oolong"
  },
  "source": {
    "sourceId": "penny:source:archive:episode:abc123",
    "sourceType": "archive-episode",
    "excerpt": "User once said their favorite tea was oolong.",
    "observedAt": "2026-04-10T00:00:00.000Z"
  },
  "authority": {
    "sourceAuthority": "advisory",
    "supportState": "rendered-advisory",
    "canonicality": "advisory",
    "confidence": "medium"
  },
  "temporal": {
    "temporalScope": "historical",
    "observedAt": "2026-04-10T00:00:00.000Z"
  },
  "status": {
    "stale": true,
    "contradictedBy": ["penny:claim:favorite-tea-lapsang-current"],
    "supersededBy": ["penny:claim:favorite-tea-lapsang-current"]
  }
}
```

### 5.4 Example: Static Candidate Claim

```json
{
  "schema": "penny-semantic-claim.v1",
  "claimId": "penny:claim:candidate:...",
  "domainId": "penny:domain:static-candidate",
  "subject": {
    "id": "penny:user:self",
    "type": "user",
    "label": "the user"
  },
  "predicate": {
    "id": "penny:predicate:favorite-tea",
    "label": "favorite tea"
  },
  "object": {
    "type": "text",
    "label": "oolong",
    "text": "oolong"
  },
  "source": {
    "sourceId": "penny:source:static-candidate:archive:episode:abc123",
    "sourceType": "static-candidate",
    "excerpt": "...favorite tea was oolong...",
    "observedAt": "2026-04-22T00:00:00.000Z"
  },
  "authority": {
    "sourceAuthority": "candidate-only",
    "supportState": "candidate-only",
    "canonicality": "not-canonical",
    "confidence": "low"
  },
  "temporal": {
    "temporalScope": "unknown"
  },
  "status": {
    "stale": null,
    "contradictedBy": [],
    "supersededBy": []
  }
}
```

---

## 6. Suggested Implementation Series

Recommended series name:

```text
Semantic Identity + Provenance Contracts
```

Preferred order:

```text
1. Semantic identifier contract
2. Predicate registry
3. Semantic claim contract schema
4. Authority domains
5. Structured candidate contract QA
6. Source-ID audit
7. Dynamic memory linking integration
8. Semantic claim traces in candidate survival
9. Prompt rendering authority guardrails
10. Optional local semantic export
```

---

# Slice 1 — Semantic Identifier Contract

## Goal

Define stable local identifiers for Penny semantic objects without introducing RDF, URL dereferencing, or external graph infrastructure.

## Likely Files

```text
lib/penny-semantic-ids.js
test/penny-semantic-ids.test.js
README.md
ARCHITECTURE.md
CODEBASE.md
```

## ID Kinds

```text
sourceId
claimId
entityId
predicateId
linkId
domainId
renderedContextId
vectorSourceId
```

## Rules

```text
IDs are local logical identifiers.
IDs are not network fetch instructions.
IDs are opaque for inference.
IDs should be stable across rechunking when the underlying source/claim is stable.
Generated summaries can have their own IDs but must point back to raw source IDs.
Temporary chunk IDs are not semantic IDs unless explicitly stabilized.
```

## Suggested API

```js
const SEMANTIC_ID_KINDS = Object.freeze({
  SOURCE: 'source',
  CLAIM: 'claim',
  ENTITY: 'entity',
  PREDICATE: 'predicate',
  LINK: 'link',
  DOMAIN: 'domain',
  RENDERED_CONTEXT: 'rendered-context',
  VECTOR_SOURCE: 'vector-source',
});

function normalizeSemanticIdParts(parts) {}
function buildSemanticSourceId(parts) {}
function buildSemanticClaimId(parts) {}
function buildSemanticEntityId(parts) {}
function buildSemanticPredicateId(name) {}
function validateSemanticId(id, expectedKind = null) {}
function semanticIdIsDereferenceable(id) { return false; }
```

## Example

```js
const claimId = buildSemanticClaimId({
  subjectId: 'penny:user:self',
  predicateId: 'penny:predicate:favorite-tea',
  objectTextNorm: 'lapsang souchong',
  sourceId: 'penny:source:explicit-memory:favorite-tea',
  temporalScope: 'current',
});
```

## Tests

```text
same normalized claim -> same claimId
different predicate -> different claimId
different temporal scope -> different claimId
rechunked source text with same sourceId keeps source identity
sourceId and claimId kinds validate separately
identifier helper does not infer semantics from readable text
identifier helper never dereferences IDs
```

## Non-Goals

```text
No RDF parser.
No URL fetch.
No JSON-LD library.
No graph DB.
No PromptTruth change.
```

## Acceptance Criteria

```text
Penny can mint stable local semantic IDs.
IDs do not imply dereference permission.
IDs can be used by claims, links, traces, vector caches, and rendered-context receipts.
```

## Suggested Commit

```text
semantic: add local semantic identifier contracts
```

---

# Slice 2 — Predicate Registry

## Goal

Create a small Penny predicate/relation registry so dynamic links and claims stop being arbitrary strings.

## Likely Files

```text
lib/penny-semantic-predicates.js
test/penny-semantic-predicates.test.js
```

## Initial Predicate Set

```text
favorite-tea
current-coding-mascot
corrected-to
correction-of
stale-prior
contradicts
source-for
implements
follow-up-to
open-loop-about
same-project-thread
user-prefers-response-style
```

## Predicate Definition Shape

```js
{
  id: 'penny:predicate:correction-of',
  label: 'correction of',
  subjectTypes: ['claim', 'memory-item', 'archive-episode'],
  objectTypes: ['claim', 'memory-item', 'archive-episode'],
  inversePredicateId: 'penny:predicate:stale-prior',
  authorityBehavior: 'does-not-canonize',
  stalenessBehavior: 'marks-target-stale-when-source-current',
  canInfluenceRanking: true,
  canPromoteToExplicitMemory: false,
  requiresSourceReceipt: true,
  memorySensitive: true
}
```

## Suggested API

```js
function listSemanticPredicates() {}
function getSemanticPredicate(predicateId) {}
function validateSemanticPredicateId(predicateId) {}
function normalizeSemanticPredicate(predicateLike) {}
function predicateCanInfluenceRanking(predicateId) {}
function predicateRequiresReceipt(predicateId) {}
```

## Tests

```text
registered predicates validate
unknown predicate fails closed
inverse relation is declared where expected
correction predicates require receipts
ranking-enabled predicates are explicitly marked
memory-sensitive predicates are explicitly marked
predicate labels do not decide behavior; IDs do
```

## Acceptance Criteria

```text
Dynamic links and semantic claims can use typed relations.
Unknown relations fail closed.
Predicate behavior is explicit and testable.
```

## Suggested Commit

```text
semantic: add predicate registry
```

---

# Slice 3 — Semantic Claim Contract Schema

## Goal

Define Penny's structured semantic claim shape with subject, predicate, object, source, authority, support state, and temporal scope.

## Likely Files

```text
lib/penny-semantic-claims.js
test/penny-semantic-claims.test.js
```

## Schema Constant

```js
const PENNY_SEMANTIC_CLAIM_SCHEMA = 'penny-semantic-claim.v1';
```

## Suggested API

```js
function normalizeSemanticClaim(claimLike) {}
function validateSemanticClaim(claimLike) {}
function summarizeSemanticClaim(claim) {}
function claimCanBeTreatedAsCanonical(claim) {}
function claimCanBeRendered(claim) {}
function claimIsCandidateOnly(claim) {}
function claimIsStale(claim) {}
```

## Required Claim Fields

```text
schema
claimId
domainId
subject.id
subject.type
predicate.id
object.type
object.text or object.id
source.sourceId
source.sourceType
authority.sourceAuthority
authority.supportState
authority.canonicality
temporal.temporalScope
status.stale
```

## Important Rules

```text
candidate-only claims cannot be canonical
static-candidate claims cannot override explicit memory
archive claims default to advisory
explicit-memory claims can be canonical
stale claims must record contradictedBy or supersededBy when known
claims without sourceId fail validation unless explicitly fixture-only
```

## Tests

```text
claim requires subject/predicate/object/source/authority
candidate-only claim cannot be canonical
explicit-memory claim can be canonical
archive claim defaults advisory
static candidate claim stays candidate-only
claim with stale status records superseding source
claim validation rejects missing source ID
claim summary includes relation/source/authority/temporal state
```

## Acceptance Criteria

```text
Penny can represent memory/source assertions without RDF infrastructure.
Claim contracts separate object match from relation/source/authority correctness.
```

## Suggested Commit

```text
semantic: add structured claim contracts
```

---

# Slice 4 — Authority Domains

## Goal

Make Penny's source domains explicit and testable.

## Likely Files

```text
lib/penny-semantic-domains.js
test/penny-semantic-domains.test.js
ARCHITECTURE.md
```

## Initial Domains

```text
explicit-memory
session-archive
global-archive
research-ledger
static-candidate
open-loop
tool-evidence
document-extraction
repo-current-law
runtime-artifact
```

## Domain Definition Shape

```js
{
  id: 'penny:domain:explicit-memory',
  label: 'explicit memory',
  defaultAuthority: 'canonical',
  defaultSupportState: 'verified',
  canOverrideExplicitMemory: false,
  canPromoteToExplicitMemory: false,
  canRenderToPrompt: true,
  canInfluenceRanking: true,
  requiresReceipt: true,
  promptTruthChannelEligible: true,
  toolEvidenceReceiptEligible: false
}
```

Static candidate example:

```js
{
  id: 'penny:domain:static-candidate',
  label: 'static embedding candidate',
  defaultAuthority: 'candidate-only',
  defaultSupportState: 'candidate-only',
  canOverrideExplicitMemory: false,
  canPromoteToExplicitMemory: false,
  canRenderToPrompt: false,
  canInfluenceRanking: true,
  requiresReceipt: true,
  promptTruthChannelEligible: false,
  toolEvidenceReceiptEligible: false
}
```

## Tests

```text
explicit memory domain is canonical
static candidate domain cannot override explicit memory
research ledger domain is advisory
open-loop domain is advisory
repo-current-law domain can support repo-doc claims but not personal memory
 tool-evidence domain is sibling evidence, not PromptTruth
unknown domain fails closed
```

## Acceptance Criteria

```text
Source authority becomes a typed contract.
Domains preserve Penny's explicit/canonical vs advisory/candidate boundaries.
```

## Suggested Commit

```text
semantic: add authority domain contracts
```

---

# Slice 5 — Structured Candidate Contract QA

## Goal

Extend candidate/source-sensitive QA so it can detect semantic failures beyond simple object matching.

## Likely Files

```text
lib/penny-candidate-survival-qa.js
lib/penny-context-pressure-qa.js
test/penny-candidate-survival-qa.test.js
test/penny-context-pressure-qa.test.js
scripts/qa-penny-memory.js
test/penny-memory-qa-script.test.js
```

## New Failure Classes

```text
right-object-wrong-predicate
right-predicate-stale-object
right-source-wrong-temporal-scope
candidate-only-treated-as-verified
rendered-advisory-treated-as-canonical
found-not-rendered
missing-source-id
unstable-claim-id
authority-domain-mismatch
source-id-mismatch
```

## Example Fixture

```js
{
  id: 'coding-mascot-correction-contract',
  query: 'What is the current coding mascot?',
  expectedClaim: {
    subjectId: 'penny:project:lyra-prototype',
    predicateId: 'penny:predicate:current-coding-mascot',
    objectText: 'copper rabbit',
    temporalScope: 'current',
    allowedDomainIds: [
      'penny:domain:explicit-memory',
      'penny:domain:session-archive'
    ],
    requiredSupportStates: ['verified', 'rendered-advisory']
  },
  forbiddenClaims: [
    {
      predicateId: 'penny:predicate:current-coding-mascot',
      objectText: 'brass fox',
      reason: 'stale prior'
    }
  ]
}
```

## Classifier Behavior

```text
If object matches but predicate is wrong -> right-object-wrong-predicate.
If predicate matches but object is stale -> right-predicate-stale-object.
If object/predicate match but temporal scope is stale/historical when current is required -> right-source-wrong-temporal-scope.
If claim is candidate-only but answer/report treats it as verified -> candidate-only-treated-as-verified.
If advisory rendered claim is treated as canonical -> rendered-advisory-treated-as-canonical.
If expected claim is in raw/ranked candidates but not rendered -> found-not-rendered.
If claim lacks sourceId -> missing-source-id.
```

## Tests

```text
right object with wrong predicate fails
right predicate with stale object fails
candidate-only object cannot count verified
rendered advisory cannot count canonical
missing source ID fails artifact validation
stable claim IDs survive fixture rebuild
false-premise correction preserves current claim over stale prior
```

## Acceptance Criteria

```text
QA distinguishes semantic correctness from string coincidence.
Candidate-only support remains visibly weaker than canonical/rendered support.
No runtime scoring change required in this slice.
```

## Suggested Commit

```text
qa: add structured semantic candidate contract checks
```

---

# Slice 6 — Source-ID Audit

## Goal

Add a QA artifact that proves semantic/static/link/rendered artifacts point back to stable source IDs.

## Likely Files

```text
lib/penny-semantic-source-audit.js
test/penny-semantic-source-audit.test.js
scripts/qa-penny-semantic-source-audit.js
package.json
```

## Audit Surfaces

```text
explicit memory IDs
archive episode IDs
archive summary IDs
ledger topic IDs
static vector source IDs
PromptTruth rendered IDs
toolEvidenceReceipt source IDs
open-loop IDs
dynamic memory link IDs
candidate-survival trace IDs
semantic claim IDs
```

## Artifact Shape

```json
{
  "schema": "penny-semantic-source-audit.v1",
  "generatedAt": "2026-04-22T00:00:00.000Z",
  "measurementMode": "fixture-or-local-audit",
  "surfaces": {
    "archive": {
      "items": 24,
      "missingSourceIds": 0,
      "unstableIds": 0
    },
    "staticEmbeddings": {
      "items": 24,
      "providerAwareSourceIds": true,
      "cacheSourceMismatches": 0
    },
    "promptTruth": {
      "renderedItems": 3,
      "renderedItemsWithSourceIds": 3
    }
  },
  "failures": [],
  "limits": [
    "Source-ID audit does not prove answer quality.",
    "Semantic IDs are local identifiers, not dereference permissions."
  ]
}
```

## Suggested Script

```json
{
  "qa:semantic:source-audit": "node scripts/qa-penny-semantic-source-audit.js"
}
```

## Tests

```text
detects missing source IDs
detects cache/source ID mismatch
detects rendered item without source ID
detects dynamic link target missing
passes clean fixture
reports fixture-only/local-audit measurement mode honestly
```

## Acceptance Criteria

```text
Penny can prove that semantic/static/link artifacts point back to stable sources.
The audit is separate from PromptTruth and toolEvidenceReceipt.
```

## Suggested Commit

```text
qa: add semantic source-id audit
```

---

# Slice 7 — Dynamic Memory Linking Integration

## Goal

Make dynamic memory links use semantic IDs, registered predicates, and authority/support metadata.

## Likely Files

```text
lib/penny-memory-links.js
lib/penny-semantic-ids.js
lib/penny-semantic-predicates.js
lib/penny-semantic-claims.js
test/penny-memory-links.test.js
test/penny-semantic-predicates.test.js
test/penny-semantic-claims.test.js
```

## Link Shape

```js
{
  linkId,
  sourceClaimId,
  predicateId,
  targetClaimId,
  domainId,
  sourceAuthority,
  supportState,
  createdAt,
  evidence: [
    {
      sourceId,
      excerpt,
      observedAt
    }
  ],
  confidence,
  canInfluenceRanking
}
```

## Rules

```text
link requires registered predicate
link requires source and target semantic IDs
correction link can create inverse stale-prior relation if enabled
candidate-only link cannot canonize source or target
link to missing target fails audit
link labels cannot decide behavior without predicate IDs
```

## Tests

```text
valid correction link passes
unknown predicate fails
missing sourceClaimId fails
missing targetClaimId fails
candidate-only link stays advisory
correction-of inverse stale-prior relation is generated only when configured
link to missing target is caught by source-ID audit
```

## Acceptance Criteria

```text
Dynamic links become structured retrieval/navigation hints, not loose labels.
Dynamic links do not canonize claims.
```

## Suggested Commit

```text
memory: bind dynamic links to semantic contracts
```

---

# Slice 8 — Semantic Claim Traces In Candidate Survival

## Goal

Make retrieval artifacts show not just text candidates but structured semantic claim candidates.

## Likely Files

```text
lib/penny-memory-archive.js
lib/penny-candidate-survival-qa.js
test/penny-memory-archive.test.js
test/penny-candidate-survival-qa.test.js
```

## Trace Addition

```json
{
  "candidateId": "archive:episode:abc123",
  "textPreview": "You corrected the coding mascot from brass fox to copper rabbit...",
  "claim": {
    "claimId": "penny:claim:sha256:...",
    "subjectId": "penny:project:lyra-prototype",
    "predicateId": "penny:predicate:current-coding-mascot",
    "objectText": "copper rabbit",
    "domainId": "penny:domain:session-archive",
    "sourceAuthority": "advisory",
    "supportState": "rendered-advisory",
    "temporalScope": "current"
  },
  "candidateChannels": ["static-embedding", "lexical"],
  "selected": true,
  "rendered": true,
  "heldBackReason": ""
}
```

## Tests

```text
candidate trace includes semantic claim fields when available
candidate without claim fields is labeled unstructured/advisory
right object under wrong predicate is visible in trace
static candidate claim remains candidate-only
claim trace does not expand PromptTruth
```

## Acceptance Criteria

```text
A reviewer can distinguish "Penny found copper rabbit as current mascot" from "Penny found copper rabbit in unrelated text."
```

## Suggested Commit

```text
qa: include semantic claim traces in candidate survival
```

---

# Slice 9 — Prompt Rendering Authority Guardrails

## Goal

Preserve claim authority labels when claim summaries are rendered to the prompt, without expanding PromptTruth into a raw semantic graph.

## Likely Files

```text
lib/penny-prompttruth.js
lib/penny-memory-archive.js
test/penny-prompttruth.test.js
test/penny-memory-archive.test.js
```

## Rule

PromptTruth can record **rendered prompt-time claim summaries/IDs**, not raw candidate traces or full semantic graphs.

Allowed PromptTruth-style metadata for rendered context:

```json
{
  "renderedClaimId": "penny:claim:sha256:...",
  "domainId": "penny:domain:session-archive",
  "sourceAuthority": "advisory",
  "supportState": "rendered-advisory",
  "temporalScope": "current"
}
```

Not allowed:

```text
all raw candidate claims
all dynamic links
all source graph internals
all static similarity traces
```

## Tests

```text
rendered claim gets authority label
candidate-only unrendered claim stays out of PromptTruth rendered list
toolEvidenceReceipt remains separate
PromptTruth does not include raw source graph
semantic claim trace stays sibling artifact/retrieval trace
```

## Acceptance Criteria

```text
PromptTruth remains prompt-time rendered/candidate memory/research context.
Rendered claim authority labels are preserved.
Raw semantic systems remain outside PromptTruth.
```

## Suggested Commit

```text
prompttruth: preserve rendered claim authority labels
```

---

# Slice 10 — Optional Local Semantic Export

## Goal

Add a local read-only debug export for semantic claims, links, domains, and predicates.

## Likely Files

```text
scripts/export-penny-semantic-claims.js
test/penny-semantic-export.test.js
package.json
```

## Export Shape

Use plain JSON first.

```json
{
  "schema": "penny-semantic-export.v1",
  "format": "penny-json",
  "generatedAt": "2026-04-22T00:00:00.000Z",
  "claims": [],
  "links": [],
  "domains": [],
  "predicates": [],
  "limits": [
    "Local debug export only.",
    "Not public Linked Data.",
    "No automatic dereferencing.",
    "No SPARQL/triplestore dependency."
  ]
}
```

## Optional Script

```json
{
  "export:semantic-claims": "node scripts/export-penny-semantic-claims.js"
}
```

## Tests

```text
export includes claims/domains/predicates/links
export is local JSON
export does not dereference IDs
export does not require RDF/JSON-LD libraries
```

## Acceptance Criteria

```text
Developers can inspect semantic claims and links without adding a graph database or public semantic web integration.
```

## Suggested Commit

```text
semantic: add local claim export artifact
```

---

## 7. How This Helps Static Embeddings

Static similarity can say:

```text
this text is close to the query
```

Semantic contracts let Penny say:

```text
this candidate is close,
but its predicate is stale-prior,
and the current-correction claim is nearby,
so rank the current correction higher.
```

Example:

```text
Static retrieves: brass fox
Semantic claim contract says:
  predicate = current-coding-mascot
  status = stale
  supersededBy = copper rabbit claim
Policy says:
  do not render as current truth
  maybe render only as correction context
```

This is the difference between fuzzy aliveness and bounded aliveness.

---

## 8. How This Helps Frame Budget

Semantic IDs and predicates are culling metadata.

They let Penny filter faster:

```text
Need current preference?
  filter temporalScope=current.

Need source-backed repo fact?
  filter domain=repo-current-law.

Need advisory research context?
  filter domain=research-ledger.

Need exact relation?
  filter predicate before embedding rank.
```

That means Penny can spend the runtime frame on better candidates, not more prompt bloat.

---

## 9. How This Helps Session Reflection

Session reflection can output review-gated semantic claim suggestions:

```json
{
  "suggestedClaim": {
    "subject": {
      "id": "penny:user:self",
      "type": "user"
    },
    "predicate": {
      "id": "penny:predicate:user-prefers-response-style"
    },
    "object": {
      "type": "text",
      "text": "long detailed slice-by-slice plans"
    },
    "source": {
      "sourceId": "penny:source:session-reflection:2026-04-22",
      "sourceType": "session-reflection",
      "excerpt": "User repeatedly asked for long detailed slice-by-slice plans."
    },
    "authority": {
      "sourceAuthority": "suggested-explicit-memory",
      "supportState": "review-required",
      "canonicality": "not-canonical"
    },
    "requiresApproval": true
  }
}
```

Rule:

```text
Reflection can suggest claims. It cannot canonize them.
```

---

## 10. Risks And Mitigations

## Risk: Relation Soup

If every model-generated phrase becomes a predicate, the system becomes useless.

Mitigation:

```text
small predicate registry
unknown predicate fails closed
new predicates require tests
```

## Risk: False Precision

A structured claim can look more true than prose.

Mitigation:

```text
always include authority, supportState, source, and temporal scope
candidate-only remains candidate-only
```

## Risk: Platform Creep

RDF-like work can lure agents into triplestores, SPARQL, graph DBs, and Linked Data publishing.

Mitigation:

```text
plain JS/JSON contracts only
no RDF dependencies
no graph DB
no ontology inference
```

## Risk: Privacy Leak Through Identifiers

If IDs are URLs or dereferenced automatically, local memory can leak.

Mitigation:

```text
local opaque IDs
no automatic dereference
no public publishing
identifier != network permission
```

## Risk: PromptTruth Expansion

Raw semantic graphs do not belong in PromptTruth.

Mitigation:

```text
PromptTruth only records rendered prompt-time context summaries/IDs
candidate traces and claim registries stay sibling artifacts
```

---

## 11. Agent Implementation Preamble

Use this as the top of each agent prompt for this implementation series.

```text
You are GPT-5.4 Codex working in the Penny / lyra-prototype repo.

This task is part of the Semantic Identity + Provenance Contracts series.

Project constraints:
- Penny is a single-user local companion prototype, not a generic semantic-web platform.
- Explicit memory is canonical.
- Archive, research-ledger, static, semantic, open-loop, and generated reflection context are advisory unless promoted by existing reviewed paths.
- Semantic/static retrieval is candidate discovery, not truth authority.
- PromptTruth must remain prompt-time rendered/candidate memory/research context.
- toolEvidenceReceipt must stay a sibling runtime artifact, not a PromptTruth channel.
- Do not add RDF/XML parsing, SPARQL, triplestore, ontology inference, Linked Data publishing, graph DB replacement, or automatic URI dereferencing.
- Do not auto-promote semantic claims or retrieved candidates into explicit memory.
- Do not increase default prompt/rendered memory limits.
- Do not broadly expand server.js.
- Keep changes in focused lib helpers, QA artifacts, scripts, and docs.

Implementation rules:
1. Inspect current repo state before editing.
2. Make the smallest coherent slice.
3. Add tests in the same slice.
4. Preserve existing module/test style.
5. Prefer pure helper functions and fixture/unit artifacts before runtime behavior changes.
6. Run focused tests and git diff --check.
7. Final response must say files changed, behavior changed vs not changed, tests run, skipped tests, risks, and suggested commit message.
```

---

## 12. Verification Commands By Slice

Use targeted tests first, then broader tests if practical.

```bash
node --test test/penny-semantic-ids.test.js
node --test test/penny-semantic-predicates.test.js
node --test test/penny-semantic-claims.test.js
node --test test/penny-semantic-domains.test.js
node --test test/penny-candidate-survival-qa.test.js test/penny-context-pressure-qa.test.js
node --test test/penny-semantic-source-audit.test.js test/penny-memory-qa-script.test.js
node --test test/penny-memory-links.test.js
node --test test/penny-memory-archive.test.js test/penny-prompttruth.test.js
npm run qa:memory:source-sensitive
npm run qa:memory:candidate-survival-fixture
npm run qa:semantic:source-audit
git diff --check
npm test
```

Only claim commands passed if actually run.

---

## 13. Final Recommendation

Yes, pursue this after Dynamic Memory Linking.

Do it as:

```text
Semantic Identity + Provenance Contracts
```

not:

```text
RDF stack
```

The implementation should strengthen Penny's semantic spine:

```text
stable IDs
typed predicates
structured claims
authority domains
source-ID audits
structured candidate QA
claim-aware dynamic links
claim-aware candidate traces
rendered authority labels
```

This will make Penny's semantic/static/open-loop systems more precise and more alive while preserving the most important truth boundary:

```text
A candidate can help Penny notice.
Only source authority, support state, temporal scope, and reviewed memory paths can help Penny know.
```
