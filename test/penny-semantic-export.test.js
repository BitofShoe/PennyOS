const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_SEMANTIC_EXPORT_FORMAT,
  PENNY_SEMANTIC_EXPORT_SCHEMA,
  SEMANTIC_EXPORT_MODES,
  buildSemanticExportArtifact,
  buildSemanticExportFixtureInput,
} = require('../lib/penny-semantic-export');
const {
  SEMANTIC_ID_KINDS,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');
const {
  parseArgValue,
  parseSemanticExportArgs,
  writeSemanticExportArtifact,
} = require('../scripts/export-penny-semantic-claims');

const GENERATED_AT = '2026-04-22T21:00:00.000Z';

test('semantic export fixture writes plain local Penny JSON with guardrails', () => {
  const artifact = buildSemanticExportArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, PENNY_SEMANTIC_EXPORT_SCHEMA);
  assert.equal(artifact.artifactKind, 'semantic-export');
  assert.equal(artifact.format, PENNY_SEMANTIC_EXPORT_FORMAT);
  assert.equal(artifact.mode, SEMANTIC_EXPORT_MODES.FIXTURE);
  assert.equal(artifact.localOnly, true);
  assert.equal(artifact.readOnly, true);
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.canonicalMemoryWrites, false);
  assert.equal(artifact.memoryPromotion, false);
  assert.equal(artifact.defaultPromptLimitsRaised, false);
  assert.equal(artifact.rdfXmlParserAdded, false);
  assert.equal(artifact.jsonLdAdded, false);
  assert.equal(artifact.sparqlAdded, false);
  assert.equal(artifact.triplestoreDependency, false);
  assert.equal(artifact.ontologyInference, false);
  assert.equal(artifact.graphDbMigration, false);
  assert.equal(artifact.linkedDataPublishing, false);
  assert.equal(artifact.uriDereferencing, false);
  assert.equal(artifact.automaticDereferencing, false);
  assert.equal(artifact.semanticIdsDereferenceable, false);
  assert.equal(artifact.claims.length, 3);
  assert.equal(artifact.links.length, 2);
  assert.ok(artifact.domains.length >= 10);
  assert.ok(artifact.predicates.length >= 18);
  assert.equal(artifact.summary.claimCount, 3);
  assert.equal(artifact.summary.linkCount, 2);
  assert.equal(artifact.summary.canonicalClaimCount, 1);
  assert.equal(artifact.summary.candidateOnlyClaimCount, 1);
  assert.equal(artifact.summary.staleClaimCount, 1);
  assert.equal(artifact.summary.dereferenceableSemanticIdCount, 0);
  assert.match(artifact.limits.join('\n'), /Local debug export only/);
  assert.match(artifact.limits.join('\n'), /No RDF\/XML parsing/);
  assert.match(artifact.limits.join('\n'), /No SPARQL\/triplestore dependency/);
  assert.equal(
    artifact.predicates.some((predicate) => predicate.id === SEMANTIC_PREDICATE_IDS.FAVORITE_TEA),
    true,
  );
  assert.equal(
    artifact.semanticIds.every((id) => validateSemanticId(id).valid),
    true,
  );
  assert.equal(
    artifact.semanticIds.some((id) => validateSemanticId(id, SEMANTIC_ID_KINDS.CLAIM).valid),
    true,
  );
});

test('semantic export can normalize local input and hold back invalid claims or links', () => {
  const input = buildSemanticExportFixtureInput(GENERATED_AT);
  input.claims.push({
    subject: { type: 'user', label: 'the user' },
    predicate: { id: 'penny:predicate:definitely-proves' },
    object: { type: 'text' },
    source: { sourceType: 'explicit-memory' },
    status: {},
  });
  input.links.push({
    sourceId: 'memory:a',
    targetId: 'memory:b',
    relation: 'definitely-proves',
  });

  const artifact = buildSemanticExportArtifact({
    generatedAt: GENERATED_AT,
    mode: 'local-input',
    input,
  });

  assert.equal(artifact.mode, SEMANTIC_EXPORT_MODES.LOCAL_INPUT);
  assert.equal(artifact.claims.length, 3);
  assert.equal(artifact.links.length, 2);
  assert.equal(artifact.heldBack.claims.length, 1);
  assert.match(artifact.heldBack.claims[0].reason, /missing or unregistered predicate/);
  assert.equal(artifact.heldBack.links.length, 1);
  assert.match(artifact.heldBack.links[0].reason, /invalid relation/);
  assert.equal(artifact.summary.heldBackClaimCount, 1);
  assert.equal(artifact.summary.heldBackLinkCount, 1);
  assert.equal(artifact.summary.behaviorChanged, false);
  assert.equal(artifact.summary.uriDereferencing, false);
});

test('semantic export script parser and writer support fixture and local input modes', () => {
  assert.deepEqual(parseSemanticExportArgs([]), {
    fixture: true,
    mode: SEMANTIC_EXPORT_MODES.FIXTURE,
    inputPath: '',
    outputPath: '',
    generatedAt: '',
    compact: false,
  });
  assert.deepEqual(parseSemanticExportArgs([
    '--input',
    'tmp/semantic-input.json',
    '--output=tmp/semantic-export.json',
    '--generated-at',
    GENERATED_AT,
    '--compact',
  ]), {
    fixture: false,
    mode: SEMANTIC_EXPORT_MODES.LOCAL_INPUT,
    inputPath: 'tmp/semantic-input.json',
    outputPath: 'tmp/semantic-export.json',
    generatedAt: GENERATED_AT,
    compact: true,
  });
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.throws(
    () => parseSemanticExportArgs(['--fixture', '--input=tmp/input.json']),
    /either --fixture or --input/i,
  );
  assert.throws(
    () => parseSemanticExportArgs(['--input=tmp/input.json', '--mode=fixture']),
    /must be local-input/i,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-semantic-export-'));
  const outputPath = path.join(dir, 'artifact.json');
  const artifact = buildSemanticExportArtifact({ generatedAt: GENERATED_AT });
  const result = writeSemanticExportArtifact({ outputPath, artifact, compact: true });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, PENNY_SEMANTIC_EXPORT_SCHEMA);
  assert.equal(written.format, PENNY_SEMANTIC_EXPORT_FORMAT);
  assert.equal(written.summary.linkCount, 2);
});

test('semantic export package script does not add RDF or JSON-LD dependencies', () => {
  const pkg = require('../package.json');
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  assert.equal(pkg.scripts['export:semantic-claims'], 'node scripts/export-penny-semantic-claims.js');
  assert.equal(deps.rdf, undefined);
  assert.equal(deps.jsonld, undefined);
  assert.equal(deps.sparql, undefined);
  assert.equal(deps.n3, undefined);
});
