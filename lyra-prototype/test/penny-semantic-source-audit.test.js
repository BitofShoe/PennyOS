const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA,
  SOURCE_AUDIT_FAILURE_MODES,
  SOURCE_AUDIT_MEASUREMENT_MODES,
  SOURCE_AUDIT_SURFACES,
  buildCleanSemanticSourceAuditFixtureInput,
  buildSemanticSourceAuditArtifact,
  validateSourceIdValue,
} = require('../lib/penny-semantic-source-audit');
const {
  buildSemanticClaimId,
  buildSemanticSourceId,
} = require('../lib/penny-semantic-ids');
const {
  parseArgValue,
  parseSemanticSourceAuditArgs,
  writeSemanticSourceAuditArtifact,
} = require('../scripts/qa-penny-semantic-source-audit');

const GENERATED_AT = '2026-04-22T19:00:00.000Z';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('semantic source audit fixture covers source-bearing surfaces without behavior changes', () => {
  const artifact = buildSemanticSourceAuditArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA);
  assert.equal(artifact.artifactKind, 'semantic-source-id-audit');
  assert.equal(artifact.measurementMode, SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY);
  assert.equal(artifact.runnerMode, SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY);
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.liveChatTouched, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.canonicalMemoryWrites, false);
  assert.equal(artifact.graphDbMigration, false);
  assert.equal(artifact.rdfParserAdded, false);
  assert.equal(artifact.sparqlAdded, false);
  assert.equal(artifact.uriDereferencing, false);
  assert.equal(artifact.failures.length, 0);
  assert.equal(artifact.summary.failureCount, 0);
  assert.equal(artifact.summary.surfaceCount, 10);
  assert.equal(artifact.summary.cacheSourceMismatches, 0);
  assert.equal(artifact.summary.renderedItemsWithSourceIds, 1);
  assert.equal(artifact.summary.dynamicLinkMissingTargets, 0);
  assert.equal(artifact.summary.behaviorChanged, false);
  assert.equal(artifact.summary.promptTruthExpanded, false);
  assert.equal(artifact.summary.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.summary.uriDereferencing, false);
  assert.equal(artifact.surfaces[SOURCE_AUDIT_SURFACES.EXPLICIT_MEMORY].itemsWithSourceIds, 1);
  assert.equal(artifact.surfaces[SOURCE_AUDIT_SURFACES.ARCHIVE].items, 2);
  assert.equal(artifact.surfaces[SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS].providerAwareSourceIds, true);
  assert.equal(artifact.surfaces[SOURCE_AUDIT_SURFACES.PROMPT_TRUTH].renderedItemsMissingSourceIds, 0);
  assert.equal(artifact.surfaces[SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS].validClaims, 1);
  assert.match(artifact.limits.join('\n'), /does not prove answer quality/);
  assert.match(artifact.limits.join('\n'), /not dereference permissions/);
  assert.match(artifact.limits.join('\n'), /does not expand PromptTruth/);
});

test('semantic source audit detects source-id, cache, rendered, link, and claim failures', () => {
  const input = clone(buildCleanSemanticSourceAuditFixtureInput());
  const explicitSourceId = input.explicitMemory[0].sourceId;
  const alternateSourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'archive:episode:wrong-cache-source',
  });

  input.staticEmbeddings[0].cacheSourceId = alternateSourceId;
  input.staticEmbeddings[0].vectorSourceId = 'penny:vector-source:not-a-digest';
  input.promptTruth.renderedItems.push({
    channel: 'globalArchive',
    id: 'rendered-without-source',
  });
  input.toolEvidenceReceipt.items.push({
    id: 'tool-evidence:missing-source',
    evidenceType: 'deterministic-read',
  });
  input.dynamicMemoryLinks.push({
    id: 'link:missing-target',
    sourceId: explicitSourceId,
    targetId: 'archive:missing-target',
    relation: 'correction-of',
  });
  const wrongClaimBasis = {
    ...input.semanticClaims[0],
    claimId: '',
    object: { type: 'text', text: 'brass fox' },
  };
  input.semanticClaims.push({
    ...input.semanticClaims[0],
    claimId: buildSemanticClaimId(wrongClaimBasis),
  });
  input.semanticClaims.push({
    ...input.semanticClaims[0],
    claimId: '',
    source: {
      sourceType: 'explicit-memory',
      excerpt: 'source intentionally missing for audit coverage',
    },
  });

  const artifact = buildSemanticSourceAuditArtifact({
    generatedAt: GENERATED_AT,
    input,
  });
  const failures = artifact.summary.byFailureMode;

  assert.equal(artifact.summary.failureCount, 7);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.CACHE_SOURCE_ID_MISMATCH], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.INVALID_VECTOR_SOURCE_ID], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.RENDERED_ITEM_MISSING_SOURCE_ID], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.TOOL_EVIDENCE_MISSING_SOURCE_ID], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.DYNAMIC_LINK_TARGET_MISSING], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_MISSING_SOURCE_ID], 1);
  assert.equal(failures[SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_UNSTABLE_CLAIM_ID], 1);
  assert.equal(artifact.surfaces.staticEmbeddings.cacheSourceMismatches, 1);
  assert.equal(artifact.surfaces.promptTruth.renderedItemsMissingSourceIds, 1);
  assert.equal(artifact.surfaces.dynamicMemoryLinks.missingTargetEndpoints, 1);
  assert.equal(artifact.surfaces.semanticClaims.missingSourceIds, 1);
  assert.equal(artifact.surfaces.semanticClaims.unstableClaimIds, 1);
});

test('semantic source audit reports fixture-only and local-audit modes honestly', () => {
  const fixture = buildSemanticSourceAuditArtifact({
    generatedAt: GENERATED_AT,
    measurementMode: 'fixture',
  });
  const local = buildSemanticSourceAuditArtifact({
    generatedAt: GENERATED_AT,
    measurementMode: 'local-audit',
    input: buildCleanSemanticSourceAuditFixtureInput(),
  });

  assert.equal(fixture.measurementMode, SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY);
  assert.equal(local.measurementMode, SOURCE_AUDIT_MEASUREMENT_MODES.LOCAL_AUDIT);
  assert.equal(local.runnerMode, SOURCE_AUDIT_MEASUREMENT_MODES.LOCAL_AUDIT);
  assert.equal(local.liveModelCalls, false);
});

test('source id validator rejects missing, invalid, and temporary ids without dereferencing', () => {
  const stable = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'stable-source' });

  assert.equal(validateSourceIdValue(stable).ok, true);
  assert.equal(validateSourceIdValue('archive:episode:abc123').ok, true);
  assert.equal(validateSourceIdValue('').missing, true);
  assert.equal(validateSourceIdValue('chunk-17').unstable, true);
  assert.equal(validateSourceIdValue('https://example.invalid/source', { requireSemantic: true }).invalid, true);
});

test('semantic source audit script parser and writer stay fixture-only', () => {
  assert.deepEqual(parseSemanticSourceAuditArgs([]), {
    fixture: true,
    mode: SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY,
    outputPath: '',
    generatedAt: '',
  });
  assert.deepEqual(parseSemanticSourceAuditArgs([
    '--fixture',
    '--output=tmp/semantic-source-audit.json',
    '--generated-at',
    GENERATED_AT,
  ]), {
    fixture: true,
    mode: SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY,
    outputPath: 'tmp/semantic-source-audit.json',
    generatedAt: GENERATED_AT,
  });
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.throws(() => parseSemanticSourceAuditArgs(['--mode=local-audit']), /fixture-only output/i);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-semantic-source-audit-'));
  const outputPath = path.join(dir, 'artifact.json');
  const artifact = buildSemanticSourceAuditArtifact({ generatedAt: GENERATED_AT });
  const result = writeSemanticSourceAuditArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA);
  assert.equal(written.summary.failureCount, 0);
});
