const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const {
  buildStaticEmbeddingServerEnv,
  buildCandidateSurvivalArchiveUnitPaths,
  buildQaServerEnv,
  buildSuitePaths,
  buildSourceSensitiveMemoryQaFixture,
  buildSmokeScenarioSpecs,
  buildMemoryQaTrace,
  buildStrictNoModelOpsMemoryPreparation,
  canonicalAuthorityPressureSatisfied,
  classifySourceSensitiveMemoryOutcome,
  countNeedleHits,
  normalizeQaStaticEmbedMode,
  parseMemoryQaArgs,
  resolveMemoryQaModelManagementMode,
  prepareMemoryQaRuntime,
  resolveMemoryQaStaticEmbeddingConfig,
  resolveChatRequestTimeoutMs,
  runCandidateSurvivalArchiveUnitQa,
  scoreTruthReplacement,
  summarizeSuites,
  SOURCE_SENSITIVE_MEMORY_CASES,
  SOURCE_SENSITIVE_OUTCOMES,
  MEMORY_QA_SEGMENT_IDS,
  MEMORY_QA_SEGMENT_ORDER,
} = require('../scripts/qa-penny-memory');
const {
  buildRuntimeArtifact,
} = require('../lib/penny-runtime-artifacts');
const {
  STATIC_SHADOW_EMBED_MODEL,
  createStaticShadowEmbeddingProvider,
} = require('../lib/penny-static-shadow-embeddings');

test('parseMemoryQaArgs defaults to combined mode when no flags are supplied', () => {
  const parsed = parseMemoryQaArgs([]);
  assert.equal(parsed.runMode, 'combined');
  assert.equal(parsed.runLabel, 'combined');
  assert.equal(parsed.segmentId, '');
  assert.equal(parsed.combinedMode, true);
});

test('parseMemoryQaArgs accepts known segment ids and smoke mode', () => {
  const segment = parseMemoryQaArgs(['--segment', MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT]);
  assert.equal(segment.runMode, 'segment');
  assert.equal(segment.segmentId, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);
  assert.equal(segment.runLabel, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);

  const smoke = parseMemoryQaArgs(['--smoke']);
  assert.equal(smoke.runMode, 'smoke');
  assert.equal(smoke.runLabel, 'smoke');
});

test('parseMemoryQaArgs supports judged mode and keeps it isolated from combined mode', () => {
  const judged = parseMemoryQaArgs(['--judged']);
  assert.equal(judged.runMode, 'judged');
  assert.equal(judged.runLabel, 'judged');
  assert.equal(judged.judgedMode, true);
  assert.equal(judged.combinedMode, false);

  assert.throws(() => parseMemoryQaArgs(['--judged', '--smoke']), /cannot combine --judged with --smoke/i);
  assert.throws(() => parseMemoryQaArgs(['--judged', '--segment', MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE]), /cannot combine --judged with --segment/i);
});

test('parseMemoryQaArgs supports source-sensitive fixture mode without live QA', () => {
  const parsed = parseMemoryQaArgs(['--source-sensitive-fixture']);
  assert.equal(parsed.runMode, 'source-sensitive-fixture');
  assert.equal(parsed.runLabel, 'source-sensitive');
  assert.equal(parsed.sourceSensitiveFixtureMode, true);
  assert.equal(parsed.combinedMode, false);

  assert.throws(() => parseMemoryQaArgs(['--source-sensitive-fixture', '--smoke']), /cannot combine --source-sensitive-fixture/i);
  assert.throws(() => parseMemoryQaArgs(['--source-sensitive-fixture', '--judged']), /cannot combine --source-sensitive-fixture/i);
});

test('parseMemoryQaArgs supports candidate-survival fixture and archive-unit modes without live QA', () => {
  const fixture = parseMemoryQaArgs(['--candidate-survival-fixture']);
  assert.equal(fixture.runMode, 'candidate-survival-fixture');
  assert.equal(fixture.runLabel, 'candidate-survival-fixture');
  assert.equal(fixture.candidateSurvivalFixtureMode, true);
  assert.equal(fixture.combinedMode, false);

  const archiveUnit = parseMemoryQaArgs(['--candidate-survival-archive-unit']);
  assert.equal(archiveUnit.runMode, 'candidate-survival-archive-unit');
  assert.equal(archiveUnit.runLabel, 'candidate-survival-archive-unit');
  assert.equal(archiveUnit.candidateSurvivalArchiveUnitMode, true);
  assert.equal(archiveUnit.combinedMode, false);
  assert.equal(archiveUnit.shadowEmbedProvider, '');
  assert.equal(archiveUnit.rerankShadowProvider, 'fixture-reranker');

  const shadow = parseMemoryQaArgs(['--candidate-survival-archive-unit', '--shadow-embed-provider=static']);
  assert.equal(shadow.runMode, 'candidate-survival-archive-unit');
  assert.equal(shadow.shadowEmbedProvider, 'static');

  const rerankUnavailable = parseMemoryQaArgs(['--candidate-survival-archive-unit', '--rerank-shadow-provider=local-cross-encoder']);
  assert.equal(rerankUnavailable.runMode, 'candidate-survival-archive-unit');
  assert.equal(rerankUnavailable.rerankShadowProvider, 'local-cross-encoder');

  const rerankDisabled = parseMemoryQaArgs(['--candidate-survival-archive-unit', '--rerank-shadow-provider=none']);
  assert.equal(rerankDisabled.rerankShadowProvider, '');

  assert.throws(() => parseMemoryQaArgs(['--candidate-survival-archive-unit', '--smoke']), /cannot combine --candidate-survival-archive-unit/i);
  assert.throws(() => parseMemoryQaArgs(['--candidate-survival-archive-unit', '--judged']), /cannot combine --candidate-survival-archive-unit/i);
  assert.throws(() => parseMemoryQaArgs(['--candidate-survival-fixture', '--source-sensitive-fixture']), /cannot combine --candidate-survival-fixture/i);
  assert.throws(() => parseMemoryQaArgs(['--candidate-survival-archive-unit', '--shadow-embed-provider=bogus']), /Unknown shadow embed provider/i);
});

test('static shadow provider is deterministic and local-only', async () => {
  const provider = createStaticShadowEmbeddingProvider();
  const first = provider.createEmbedding('A copper rabbit sat beside the coding notebook.');
  const second = provider.createEmbedding('A copper rabbit sat beside the coding notebook.');
  const different = provider.createEmbedding('A silver watch was on the arcade cashier.');
  const response = await provider.fetch('http://127.0.0.1:0/v1/embeddings', {
    body: JSON.stringify({ input: 'A copper rabbit sat beside the coding notebook.' }),
  });
  const payload = JSON.parse(await response.text());

  assert.equal(provider.provider, 'static');
  assert.equal(provider.model, STATIC_SHADOW_EMBED_MODEL);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
  assert.equal(payload.data[0].model, STATIC_SHADOW_EMBED_MODEL);
  assert.deepEqual(payload.data[0].embedding, first);
  assert.match(provider.cacheKeyForText('same text'), /^static:penny-static-shadow-lexical-v1:/);
});

test('parseMemoryQaArgs rejects invalid segment combinations', () => {
  assert.throws(() => parseMemoryQaArgs(['--smoke', '--segment', MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE]), /cannot combine --smoke with --segment/i);
  assert.throws(() => parseMemoryQaArgs(['--segment', 'bogus']), /Unknown memory QA segment/i);
  assert.deepEqual(MEMORY_QA_SEGMENT_ORDER, [
    'semantic-archive',
    'chapter-fallback',
    'contradiction-premise',
    'mixed-drift',
  ]);
});

test('buildQaServerEnv forces stateless chat transport for memory QA servers', () => {
  const env = buildQaServerEnv({
    suiteSlug: 'judged-semantic',
    suitePaths: {
      memoryFile: 'data/penny-memory.test.json',
      archiveFile: 'data/penny-memory-archive.test.json',
      embeddingsFile: 'data/penny-memory-embeddings.test.json',
      staticEmbeddingsFile: 'data/penny-memory-embeddings.static.test.json',
      ledgerFile: 'data/penny-memory-ledger.test.json',
      openLoopFile: 'data/penny-open-loops.test.json',
    },
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
  });

  assert.equal(env.PENNY_LOCAL_LLM_TRANSPORT, 'chat');
  assert.equal(env.PENNY_QA_SUITE, 'judged-semantic');
  assert.equal(env.PENNY_MEMORY_FILE, 'data/penny-memory.test.json');
  assert.equal(env.PENNY_MEMORY_ARCHIVE_FILE, 'data/penny-memory-archive.test.json');
  assert.equal(env.PENNY_MEMORY_EMBEDDINGS_FILE, 'data/penny-memory-embeddings.test.json');
  assert.equal(env.PENNY_MEMORY_LEDGER_FILE, 'data/penny-memory-ledger.test.json');
  assert.equal(env.PENNY_OPEN_LOOP_FILE, 'data/penny-open-loops.test.json');
});

test('memory QA static embedding config inherits runtime mode but isolates cache by suite', () => {
  assert.equal(normalizeQaStaticEmbedMode('advisory'), 'live-advisory');
  assert.equal(normalizeQaStaticEmbedMode('shadow'), 'live-shadow');
  assert.equal(normalizeQaStaticEmbedMode('nope'), 'off');
  assert.match(buildSuitePaths('unit-static').staticEmbeddingsFile, /penny-memory-embeddings\.static\.unit-static\./);

  const staticEmbeddingsFile = path.join(os.tmpdir(), 'penny-memory-embeddings.static.memory-qa-test.json');
  const rootDir = path.join(os.tmpdir(), 'penny-root');
  const suitePaths = {
    memoryFile: 'data/penny-memory.test.json',
    archiveFile: 'data/penny-memory-archive.test.json',
    embeddingsFile: 'data/penny-memory-embeddings.test.json',
    staticEmbeddingsFile,
    ledgerFile: 'data/penny-memory-ledger.test.json',
    openLoopFile: 'data/penny-open-loops.test.json',
  };
  const config = resolveMemoryQaStaticEmbeddingConfig({
    PENNY_STATIC_EMBED_MODE: 'live-advisory',
    PENNY_STATIC_EMBED_PROVIDER: 'model2vec-potion-8m',
    PENNY_STATIC_EMBED_MAX_CANDIDATES: '7',
  }, {
    rootDir,
    stamp: 'static-memory-test',
    defaultCacheFile: suitePaths.staticEmbeddingsFile,
  });

  assert.equal(config.enabled, true);
  assert.equal(config.mode, 'live-advisory');
  assert.equal(config.maxCandidates, 7);
  assert.equal(config.maxStaticOnlyRendered, 1);
  assert.equal(config.ownsCacheFile, true);
  assert.equal(config.cacheFile, suitePaths.staticEmbeddingsFile);

  assert.deepEqual(buildStaticEmbeddingServerEnv(config), {
    PENNY_STATIC_EMBED_MODE: 'live-advisory',
    PENNY_STATIC_EMBED_PROVIDER: 'model2vec-potion-8m',
    PENNY_STATIC_EMBED_INDEX_SCOPE: 'session,archive,research-ledger',
    PENNY_STATIC_EMBED_MAX_CANDIDATES: '7',
    PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: '1',
    PENNY_STATIC_EMBED_BATCH_SIZE: '16',
    PENNY_STATIC_EMBED_CACHE_FILE: suitePaths.staticEmbeddingsFile,
  });

  const env = buildQaServerEnv({
    suiteSlug: 'static-memory',
    suitePaths,
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
    env: {
      PENNY_STATIC_EMBED_MODE: 'live-advisory',
      PENNY_STATIC_EMBED_CACHE_FILE: 'data/shared-static-cache.json',
    },
  });
  assert.equal(env.PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(env.PENNY_STATIC_EMBED_CACHE_FILE, suitePaths.staticEmbeddingsFile);

  const qaEnv = buildQaServerEnv({
    suiteSlug: 'static-memory',
    suitePaths,
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
    env: {
      PENNY_STATIC_EMBED_MODE: 'live-advisory',
      PENNY_QA_STATIC_EMBED_CACHE_FILE: 'data/explicit-qa-static-cache.json',
    },
  });
  assert.equal(qaEnv.PENNY_STATIC_EMBED_CACHE_FILE, path.resolve(process.cwd(), 'data/explicit-qa-static-cache.json'));
});

test('memory QA model management supports strict no-model-ops mode', () => {
  assert.deepEqual(resolveMemoryQaModelManagementMode({
    PENNY_QA_STRICT_NO_MODEL_OPS: '1',
  }, []), {
    strictNoModelOps: true,
    manageModels: false,
    loadChatModel: false,
    loadEmbedModel: false,
    prepareReportOnly: true,
    repairPreset: false,
    loadStrategy: 'strict-no-model-ops',
  });

  assert.equal(resolveMemoryQaModelManagementMode({
    PENNY_QA_MANAGE_MODELS: '0',
  }, []).loadStrategy, 'preloaded-no-model-management');
});

test('strict memory QA preparation is provider-neutral and never constructs LM Studio automation', async () => {
  let automationFactoryCalls = 0;
  let providerProbeCalls = 0;
  const modelManagement = resolveMemoryQaModelManagementMode({
    PENNY_QA_STRICT_NO_MODEL_OPS: '1',
  }, []);
  const result = await prepareMemoryQaRuntime({
    modelManagement,
    automationFactory() {
      automationFactoryCalls += 1;
      throw new Error('automation factory must not run in strict no-model-ops mode');
    },
    probeModels: async ({ baseUrl }) => {
      providerProbeCalls += 1;
      assert.equal(baseUrl, 'http://provider.example/v1');
      return {
        schema: 'penny-provider-model-probe.v1',
        ok: true,
        models: [
          'unsloth/gemma-4-31b-it@q6_k',
          'google/gemma-4-e4b',
          'text-embedding-nomic-embed-text-v1.5',
        ],
        error: '',
      };
    },
    env: {
      PENNY_LMSTUDIO_BASE: 'http://provider.example/v1',
      PENNY_LMSTUDIO_API_KEY: 'provider-key',
    },
  });

  assert.equal(automationFactoryCalls, 0);
  assert.equal(providerProbeCalls, 1);
  assert.equal(result.automationApi, null);
  assert.equal(result.preparation.ok, true);
  assert.equal(result.preparation.strictNoModelOps, true);
  assert.equal(result.preparation.providerNeutral, true);
  assert.match(result.preparation.warnings.join(' '), /no LM Studio CLI/i);
});

test('strict memory QA preparation reports missing exposed models without attempting repair', async () => {
  const preparation = await buildStrictNoModelOpsMemoryPreparation({
    probeModels: async () => ({
      ok: true,
      models: ['some-other-model'],
      error: '',
    }),
  });

  assert.equal(preparation.ok, false);
  assert.match(preparation.blockers.join(' '), /chat model.*already be exposed/i);
  assert.match(preparation.blockers.join(' '), /tool model.*already be exposed/i);
});

test('strict memory QA child process leaves an lms spawn canary untouched', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-no-model-ops-'));
  const markerPath = path.join(tempDir, 'lms-invoked.txt');
  const childPath = path.join(tempDir, 'strict-preparation-child.cjs');
  const cmdCanary = path.join(tempDir, 'lms.cmd');
  const shCanary = path.join(tempDir, 'lms');
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: [
          { id: 'unsloth/gemma-4-31b-it@q6_k' },
          { id: 'google/gemma-4-e4b' },
        ],
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', error => (error ? reject(error) : resolve()));
  });
  const port = server.address().port;
  const qaScriptPath = path.resolve(__dirname, '../scripts/qa-penny-memory.js');
  fs.writeFileSync(cmdCanary, `@echo off\r\n> "${markerPath}" echo invoked\r\nexit /b 99\r\n`);
  fs.writeFileSync(shCanary, `#!/bin/sh\nprintf invoked > "${markerPath}"\nexit 99\n`, { mode: 0o755 });
  fs.writeFileSync(childPath, `
    const qa = require(${JSON.stringify(qaScriptPath)});
    const mode = qa.resolveMemoryQaModelManagementMode({ PENNY_QA_STRICT_NO_MODEL_OPS: '1' }, []);
    qa.prepareMemoryQaRuntime({ modelManagement: mode })
      .then(result => {
        process.stdout.write(JSON.stringify({
          ok: result.preparation.ok,
          providerNeutral: result.preparation.providerNeutral,
        }));
      })
      .catch(error => {
        console.error(error && (error.stack || error.message) || String(error));
        process.exitCode = 1;
      });
  `);

  try {
    const result = await new Promise((resolve, reject) => {
      execFile(process.execPath, [childPath], {
        env: {
          ...process.env,
          PATH: `${tempDir}${path.delimiter}${process.env.PATH || ''}`,
          PENNY_QA_STRICT_NO_MODEL_OPS: '1',
          PENNY_LMSTUDIO_BASE: `http://127.0.0.1:${port}/v1`,
          PENNY_QA_CHAT_MODEL: 'unsloth/gemma-4-31b-it@q6_k',
          PENNY_QA_TOOL_MODEL: 'google/gemma-4-e4b',
        },
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
          return;
        }
        resolve(JSON.parse(stdout));
      });
    });
    assert.deepEqual(result, { ok: true, providerNeutral: true });
    assert.equal(fs.existsSync(markerPath), false);
  } finally {
    await new Promise(resolve => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('candidate-survival archive-unit mode writes an artifact and cleans disposable stores', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-candidate-survival-'));
  const stamp = 'unit-test-stamp';
  let fetchCalls = 0;
  try {
    const paths = buildCandidateSurvivalArchiveUnitPaths({
      outputDir: tmpDir,
      stamp,
    });
    assert.equal(paths.ledgerFile.startsWith(tmpDir), true);
    assert.match(paths.ledgerFile, /penny-memory-ledger\.json$/);
    assert.equal(paths.openLoopFile.startsWith(tmpDir), true);
    assert.match(paths.openLoopFile, /penny-open-loops\.json$/);

    const result = await runCandidateSurvivalArchiveUnitQa({
      outputDir: tmpDir,
      outputPath: path.join(tmpDir, 'candidate-survival-artifact.json'),
      stamp,
      generatedAt: '2026-04-21T12:00:00.000Z',
      nowMs: Date.parse('2026-04-21T12:05:00.000Z'),
      primaryEmbedModel: 'text-embedding-nomic-embed-text-v1.5',
      shadowEmbedProvider: 'static',
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('fetch should not be called in archive-unit keyword fallback');
      },
    });
    const artifact = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const byId = new Map(artifact.cases.map((item) => [item.id, item]));

    assert.equal(fetchCalls, 0);
    assert.equal(artifact.cases.length, 8);
    assert.equal(artifact.measurementMode, 'archive-unit');
    assert.equal(artifact.liveModelCalls, false);
    assert.equal(artifact.serverSpawned, false);
    assert.equal(artifact.apiChatCalls, false);
    assert.equal(artifact.includeCandidateTrace, true);
    assert.equal(artifact.includeCandidateTraceLinks, true);
    assert.equal(artifact.files.ledgerFile.startsWith(tmpDir), true);
    assert.equal(artifact.files.openLoopFile.startsWith(tmpDir), true);
    assert.equal(artifact.files.shadowEmbeddingsFile.startsWith(tmpDir), true);
    assert.equal(artifact.failureModeDefinitions.length, 9);
    assert.equal(artifact.summary.byFailureMode['not-applicable'], 1);
    assert.equal(artifact.summary.byFailureMode['no-failure'], 5);
    assert.equal(artifact.summary.byFailureMode['low-rank'], 1);
    assert.equal(artifact.summary.byFailureMode['forbidden-rendered'], 0);
    assert.equal(artifact.summary.byFailureMode['missing-from-raw'], 1);
    assert.equal(artifact.linkAnalysisSummary.truthProof, false);
    assert.equal(artifact.linkAnalysisSummary.scoringActive, false);
    assert.equal(artifact.linkAnalysisSummary.candidateOnlyVerifiedSupportCount, 0);
    assert.equal(artifact.linkAnalysisSummary.byFailureMode['weak-link'] >= 1, true);
    assert.equal(artifact.linkAnalysisSummary.byFailureMode['missing-link'] >= 1, true);
    assert.equal(artifact.structuredCandidateContracts.measurementMode, 'fixture-only');
    assert.equal(artifact.structuredCandidateContracts.summary.byFailureMode['candidate-only-treated-as-verified'], 1);
    assert.equal(artifact.structuredCandidateContracts.summary.byFailureMode['rendered-advisory-treated-as-canonical'], 1);
    assert.equal(artifact.structuredCandidateContracts.summary.byFailureMode['source-id-mismatch'], 1);
    assert.equal(artifact.structuredCandidateContracts.summary.promptTruthExpanded, false);
    assert.equal(artifact.structuredCandidateContracts.summary.toolEvidenceReceiptChanged, false);
    assert.equal(artifact.rerankerShadow.provider, 'fixture-reranker');
    assert.equal(artifact.rerankerShadow.measurementMode, 'shadow-fixture');
    assert.deepEqual(artifact.rerankerShadow.improvedCases, ['archive-reranker-low-rank-shadow']);
    assert.deepEqual(artifact.rerankerShadow.regressedCases, []);
    assert.equal(artifact.rerankerShadow.verdict, 'shadow-improved-ordering');
    assert.equal(typeof artifact.rerankerShadow.latencyMs, 'number');
    assert.equal(artifact.cleanup.allRemoved, true);
    for (const file of artifact.cleanup.files) {
      assert.equal(file.existsAfterCleanup, false);
      assert.equal(fs.existsSync(file.path), false);
    }

    const explicitCase = byId.get('explicit-current-preference');
    assert.ok(explicitCase);
    assert.equal(explicitCase.archiveUnit.retrievalMode, 'keyword');
    assert.equal(explicitCase.archiveUnit.scoringProfile, 'baseline');
    assert.equal(explicitCase.archiveUnit.liveModelCalls, false);
    assert.equal(explicitCase.survival.expectedObjectPresentRanked, true);
    assert.equal(explicitCase.survival.expectedObjectSelected, true);
    assert.equal(explicitCase.survival.expectedObjectRendered, false);
    assert.equal(explicitCase.survival.bestRank, 1);
    assert.equal(explicitCase.survival.heldBackReason, 'canon-priority-suppression');
    assert.equal(explicitCase.failureMode, 'not-applicable');
    assert.match(explicitCase.recommendedInspection, /canonical explicit memory/i);
    assert.equal(explicitCase.forbiddenSurvival.forbiddenSelected, false);
    assert.equal(explicitCase.forbiddenSurvival.forbiddenRendered, false);
    assert.equal(explicitCase.forbiddenSurvival.forbiddenBestRank, 2);
    assert.ok(explicitCase.profileComparison);
    assert.deepEqual(Object.keys(explicitCase.profileComparison), [
      'baseline',
      'hybridV1',
      'renderedCountDelta',
      'verdict',
    ]);
    assert.equal(explicitCase.profileComparison.renderedCountDelta, 0);
    assert.equal(artifact.embeddingProviderComparison.primary.provider, 'primary');
    assert.equal(artifact.embeddingProviderComparison.primary.model, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(artifact.embeddingProviderComparison.primary.survivalAtK.eligible, 5);
    assert.equal(artifact.embeddingProviderComparison.shadow.provider, 'static');
    assert.equal(artifact.embeddingProviderComparison.shadow.model, STATIC_SHADOW_EMBED_MODEL);
    assert.equal(artifact.embeddingProviderComparison.shadow.survivalAtK.eligible, 5);
    assert.equal(typeof artifact.embeddingProviderComparison.shadow.cpuMs, 'number');
    assert.equal(artifact.embeddingProviderComparison.limits.includes('Default embedding provider unchanged.'), true);
    assert.equal(Object.prototype.hasOwnProperty.call(artifact.embeddingProviderComparison, 'promptTruth'), false);

    const archiveCase = byId.get('archive-rendered-episodic-detail');
    assert.ok(archiveCase);
    assert.equal(archiveCase.survival.expectedObjectPresentRaw, true);
    assert.equal(archiveCase.survival.expectedObjectPresentRanked, true);
    assert.equal(archiveCase.survival.expectedObjectSelected, true);
    assert.equal(archiveCase.survival.expectedObjectRendered, true);
    assert.equal(archiveCase.failureMode, 'no-failure');
    assert.equal(archiveCase.forbiddenSurvival.forbiddenSelected, false);
    assert.equal(archiveCase.forbiddenSurvival.forbiddenRendered, false);
    assert.equal(archiveCase.profileComparison.renderedCountDelta, 0);

    const semanticCase = byId.get('semantic-candidate-not-canonical');
    assert.ok(semanticCase);
    assert.equal(semanticCase.archiveUnit.verifiedAnswerSupport, false);
    assert.equal(semanticCase.archiveUnit.supportState, 'candidate-only');
    assert.equal(semanticCase.survival.expectedObjectPresentRaw, true);
    assert.equal(semanticCase.survival.expectedObjectSelected, true);
    assert.equal(semanticCase.survival.expectedObjectRendered, true);
    assert.equal(semanticCase.failureMode, 'no-failure');
    assert.match(semanticCase.failureModeReason, /rendered support/i);
    assert.equal(semanticCase.forbiddenSurvival.forbiddenSelected, false);
    assert.equal(semanticCase.forbiddenSurvival.forbiddenRendered, false);

    const lowRankCase = byId.get('archive-reranker-low-rank-shadow');
    assert.ok(lowRankCase);
    assert.equal(lowRankCase.survival.outcome, 'ranked-not-selected');
    assert.equal(lowRankCase.failureMode, 'low-rank');
    assert.equal(lowRankCase.survival.expectedObjectPresentRaw, true);
    assert.equal(lowRankCase.survival.expectedObjectPresentRanked, true);
    assert.equal(lowRankCase.survival.expectedObjectSelected, false);
    assert.equal(lowRankCase.survival.expectedObjectRendered, false);
    assert.equal(lowRankCase.rerankerShadowComparison.provider, 'fixture-reranker');
    assert.equal(lowRankCase.rerankerShadowComparison.activeBestRank, 2);
    assert.equal(lowRankCase.rerankerShadowComparison.rerankBestRank, 1);
    assert.equal(lowRankCase.rerankerShadowComparison.rerankWouldSelect, true);
    assert.equal(lowRankCase.topCandidates.some((item) => item.matchedExpected && item.rerankShadow.outputRank === 1), true);

    const absentCase = byId.get('fabricated-absent-tail-fact');
    assert.ok(absentCase);
    assert.equal(absentCase.survival.outcome, 'missing');
    assert.equal(absentCase.failureMode, 'missing-from-raw');
    assert.equal(absentCase.survival.expectedObjectPresentRaw, false);
    assert.equal(absentCase.forbiddenSurvival.forbiddenSelected, false);
    assert.equal(absentCase.forbiddenSurvival.forbiddenRendered, false);

    for (const [caseId, expectedObject, forbiddenObject] of [
      ['archive-coding-mascot-correction', 'copper rabbit', 'brass fox'],
      ['archive-cashier-watch-correction', 'gold watch', 'silver watch'],
    ]) {
      const correctionCase = byId.get(caseId);
      assert.ok(correctionCase);
      assert.equal(correctionCase.expected.object, expectedObject);
      assert.equal(correctionCase.survival.expectedObjectPresentRaw, true);
      assert.equal(correctionCase.survival.expectedObjectSelected, true);
      assert.equal(correctionCase.survival.expectedObjectRendered, true);
      assert.equal(correctionCase.survival.bestRank <= correctionCase.retrievalExpectation.survivalAtK, true);
      assert.equal(correctionCase.failureMode, 'no-failure');
      assert.equal(correctionCase.archiveUnit.includeCandidateTraceLinks, true);
      assert.equal(
        ['weak-link', 'missing-link'].includes(correctionCase.linkAnalysis.linkFailureMode),
        true,
      );
      assert.equal(['neutral', 'not-run'].includes(correctionCase.linkAnalysis.verdict), true);
      assert.equal(correctionCase.linkAnalysis.candidateOnlyVerifiedSupport, false);
      assert.equal(correctionCase.linkAnalysis.truthProof, false);
      if (correctionCase.linkAnalysis.linkFailureMode === 'weak-link') {
        assert.equal(
          correctionCase.linkAnalysis.staleCandidateLinks.some((link) => link.relation === 'stale-prior-of'),
          true,
        );
      }
      assert.equal(correctionCase.forbiddenSurvival.forbiddenSelected, false);
      assert.equal(correctionCase.forbiddenSurvival.forbiddenRendered, false);
      assert.equal(
        correctionCase.topCandidates.some((item) => item.matchedForbidden && item.textPreview.includes(forbiddenObject)),
        true,
      );
    }

    const sensitiveCase = byId.get('sensitive-weak-match-suppressed');
    assert.ok(sensitiveCase);
    assert.equal(sensitiveCase.survival.outcome, 'raw-only');
    assert.equal(sensitiveCase.survival.expectedObjectPresentRaw, true);
    assert.equal(sensitiveCase.survival.expectedObjectPresentRanked, false);
    assert.equal(sensitiveCase.survival.expectedObjectSelected, false);
    assert.equal(sensitiveCase.survival.expectedObjectRendered, false);
    assert.equal(sensitiveCase.failureMode, 'no-failure');
    assert.equal(sensitiveCase.traceSummary.filteredSensitiveCount, 1);
    const suppressed = sensitiveCase.topCandidates.find((item) => item.matchedExpected);
    assert.ok(suppressed);
    assert.equal(suppressed.eligible, false);
    assert.equal(suppressed.heldBackReason, 'sensitive-low-confidence');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveChatRequestTimeoutMs keeps smoke runs bounded by a smaller default', () => {
  assert.equal(resolveChatRequestTimeoutMs(null, { smokeMode: true }), 120000);
  assert.equal(resolveChatRequestTimeoutMs(null, { smokeMode: false }), 420000);
  assert.equal(resolveChatRequestTimeoutMs(33000, { smokeMode: true }), 33000);
});

test('buildSmokeScenarioSpecs keeps the live smoke suite bounded and excludes the obfuscated routing probe', () => {
  const specIds = buildSmokeScenarioSpecs().map((spec) => spec.id);
  assert.deepEqual(specIds, [
    'short-term-explicit',
    'contradiction',
    'premise-drift',
    'chapter-fallback-smoke',
  ]);
});

test('source-sensitive memory exports expose fixture cases and outcome classes', () => {
  const fixture = buildSourceSensitiveMemoryQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
    defaults: { chatModel: 'q6', toolModel: 'e4b', embedModel: 'nomic' },
  });
  assert.equal(SOURCE_SENSITIVE_MEMORY_CASES.length, fixture.cases.length);
  assert.equal(SOURCE_SENSITIVE_OUTCOMES.VERIFIED, 'verified');
  assert.equal(fixture.cases.every((item) => item.subject && item.relation && item.object && item.source && item.surfaceWording.length), true);
  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'I cannot verify that from memory yet.',
    object: 'aurora-17',
    supportState: 'absent',
  }), 'appropriately-abstained');
});

test('scoreTruthReplacement accepts alternative expected phrasings after normalization', () => {
  assert.equal(
    scoreTruthReplacement(
      'It stays left of your keyboard. [MOOD:smug]',
      [['left of the keyboard', 'left of your keyboard']],
      ['right side of the keyboard'],
    ),
    1,
  );
  assert.equal(
    scoreTruthReplacement(
      'It stays on the right side of the keyboard.',
      [['left of the keyboard', 'left of your keyboard']],
      ['right side of the keyboard'],
    ),
    0,
  );
  assert.equal(countNeedleHits('Left of your keyboard.', [['left of the keyboard', 'left of your keyboard']]), 1);
  assert.equal(
    scoreTruthReplacement(
      'You pivoted to lapsang souchong after the old oolong phase.',
      [[
        'lapsang souchong',
        'like lapsang souchong',
        'tea is lapsang souchong',
        'pivoted to lapsang souchong',
      ]],
      [[
        'favorite tea is oolong',
        'tea is oolong now',
        'you like oolong now',
      ]],
    ),
    1,
  );
  assert.equal(
    scoreTruthReplacement(
      "A copper rabbit. Don't go trying to sneak that brass fox back in here; we've already upgraded.",
      ['copper rabbit'],
      ['brass fox'],
    ),
    1,
  );
  assert.equal(
    scoreTruthReplacement(
      'A copper rabbit, not a brass fox.',
      ['copper rabbit'],
      ['brass fox'],
    ),
    1,
  );
  assert.equal(
    scoreTruthReplacement(
      'A copper rabbit? No, the answer is still a brass fox.',
      ['copper rabbit'],
      ['brass fox'],
    ),
    0,
  );
});

test('canonicalAuthorityPressureSatisfied requires canon-first pressure plus same-session advisory presence', () => {
  assert.equal(canonicalAuthorityPressureSatisfied({
    promptTruth: {
      canonicalFactsPresent: true,
      canonicalOverrideActive: true,
      channels: {
        sessionArchive: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
        globalArchive: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
        researchLedger: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
      },
    },
    modelAdvisory: {
      authorityPressure: {
        canonicalFactsPresent: true,
        canonicalOverrideActive: true,
        advisoryItemsRendered: 0,
        advisoryItemsInjected: 0,
        sameSessionAdvisoryItems: 0,
      },
    },
  }), true);

  assert.equal(canonicalAuthorityPressureSatisfied({
    promptTruth: {
      canonicalFactsPresent: true,
      canonicalOverrideActive: false,
      channels: {
        sessionArchive: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
        globalArchive: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        researchLedger: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
      },
    },
    modelAdvisory: {
      authorityPressure: {
        canonicalFactsPresent: true,
        canonicalOverrideActive: false,
        advisoryItemsRendered: 1,
        advisoryItemsInjected: 1,
        sameSessionAdvisoryItems: 1,
      },
    },
  }), false);
});

test('buildMemoryQaTrace emits a fallback trust verdict when lane fallback polluted the run', () => {
  const fallbackArtifact = buildRuntimeArtifact({
    sessionId: 'qa-fallback',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    laneFallback: true,
    promptTruth: {
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    latencyBudget: {
      latencyClass: 'memory-heavy-recall',
      policyMode: 'recall-heavy',
      approximateByPolicy: false,
      policyNote: 'Favor recall.',
      allowSemanticQuery: true,
      allowArchiveCompression: true,
      allowSemanticRender: true,
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-16T12:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'memory-heavy-recall',
      archiveRetrieval: { available: true, sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'semantic_query' },
      semanticRender: { available: true, attempted: true, used: true },
      modelRoundTrip: { available: true, durationMs: 125, transport: 'local-lmstudio' },
    },
  });
  const trace = buildMemoryQaTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:10:00.000Z',
    runMode: 'segment',
    segmentId: 'semantic-archive',
    suites: [
      {
        environment: {
          valid: false,
          laneFallbackArtifacts: 1,
          usedFallbackArtifacts: 0,
          reasons: ['runtime artifacts reported lane fallback on 1 turn(s)'],
        },
        serverStatus: {
          resolvedChatModel: 'q6',
          toolPreferredModel: 'e4b',
          embedPreferredModel: 'nomic',
          availableModels: ['q6', 'e4b'],
          maxOutputTokens: 320,
        },
        scenarios: [
          {
            ok: true,
            seconds: 10,
            meta: {
              localLane: 'chat',
              laneFallback: true,
              artifact: fallbackArtifact,
              toolsUsed: [],
            },
            memory: { memories: [] },
            inspectorAfter: { inspector: { archive: { global: { promotionQueue: [] } } } },
          },
        ],
      },
    ],
    summary: {
      completed: 1,
      failed: 0,
      invalid: 0,
      totalScenarioSeconds: 10,
      averageScenarioSeconds: 10,
    },
    preparation: {
      loadedModels: ['q6', 'e4b'],
    },
    qaModelPolicy: {
      chat: 'q6',
      tool: 'e4b',
      embed: 'nomic',
    },
  });

  assert.equal(trace.trust.verdict, 'fallback');
  assert.match(trace.trust.reasonCodes.join(','), /lane_fallback/);
  assert.equal(trace.runIdentity.runMode, 'segment');
  assert.equal(trace.runIdentity.segmentId, 'semantic-archive');
  assert.equal(trace.runIdentity.resolvedChatModel, 'q6');
  assert.equal(trace.runIdentity.resolvedToolModel, 'e4b');
  assert.equal(trace.runIdentity.loadedModels, 'q6, e4b');
  assert.equal(trace.runIdentity.fallbackArtifacts, 1);
  assert.equal(trace.driftCanaries.firstDriftReason, 'lane-fallback');
  assert.equal(trace.driftCanaries.firstDriftTurn, 'turn');
  assert.equal(trace.driftCanaries.fixationDetected, false);
  assert.equal(trace.driftCanaries.recoveredAfterDrift, false);
});

test('buildMemoryQaTrace records first drift and recovery from artifact facts without inventing a score', () => {
  const driftArtifact = buildRuntimeArtifact({
    sessionId: 'qa-drift',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    laneFallback: true,
    promptTruth: {
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    latencyBudget: {
      latencyClass: 'memory-heavy-recall',
      policyMode: 'recall-heavy',
      approximateByPolicy: false,
      policyNote: 'Favor recall.',
      allowSemanticQuery: true,
      allowArchiveCompression: true,
      allowSemanticRender: false,
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-18T07:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'memory-heavy-recall',
      archiveRetrieval: { available: true, sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'semantic_query' },
      semanticRender: { available: false, attempted: false, used: false },
      modelRoundTrip: { available: true, durationMs: 120, transport: 'local-lmstudio' },
    },
  });
  const recoveredArtifact = buildRuntimeArtifact({
    sessionId: 'qa-drift',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    promptTruth: {
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 1, renderedCount: 1, candidateSourceIds: ['session-1'], renderedSourceIds: ['session-1'] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    retrieval: {
      reasonCode: 'semantic_query',
      session: [{ id: 'session-1', sourceLabel: 'archive-session', scope: 'session', sourceType: 'episode', evidenceSnippet: 'Red glove on dryer three.' }],
    },
    latencyBudget: {
      latencyClass: 'memory-heavy-recall',
      policyMode: 'recall-heavy',
      approximateByPolicy: false,
      policyNote: 'Favor recall.',
      allowSemanticQuery: true,
      allowArchiveCompression: true,
      allowSemanticRender: true,
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-18T07:01:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'memory-heavy-recall',
      archiveRetrieval: { available: true, sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'semantic_query' },
      semanticRender: { available: true, attempted: true, used: true },
      modelRoundTrip: { available: true, durationMs: 110, transport: 'local-lmstudio' },
    },
  });

  const trace = buildMemoryQaTrace({
    startedAt: '2026-04-18T07:00:00.000Z',
    finishedAt: '2026-04-18T07:02:00.000Z',
    runMode: 'segment',
    segmentId: 'semantic-archive',
    suites: [
      {
        environment: {
          valid: true,
          laneFallbackArtifacts: 0,
          usedFallbackArtifacts: 0,
          reasons: [],
        },
        serverStatus: {
          resolvedChatModel: 'q6',
          toolPreferredModel: 'e4b',
          embedPreferredModel: 'nomic',
          availableModels: ['q6', 'e4b'],
          maxOutputTokens: 320,
        },
        scenarios: [
          {
            ok: true,
            seconds: 14,
            meta: {
              localLane: 'chat',
              artifact: driftArtifact,
              toolsUsed: [],
            },
            recall: {
              meta: {
                localLane: 'chat',
                artifact: recoveredArtifact,
                toolsUsed: [],
              },
            },
            memory: { memories: [] },
            inspectorAfter: { inspector: { archive: { global: { promotionQueue: [] } } } },
          },
        ],
      },
    ],
    summary: {
      completed: 1,
      failed: 0,
      invalid: 0,
      totalScenarioSeconds: 14,
      averageScenarioSeconds: 14,
    },
    preparation: {
      loadedModels: ['q6', 'e4b'],
    },
    qaModelPolicy: {
      chat: 'q6',
      tool: 'e4b',
      embed: 'nomic',
    },
  });

  assert.equal(trace.driftCanaries.firstDriftReason, 'lane-fallback');
  assert.equal(trace.driftCanaries.firstDriftTurn, 'turn');
  assert.equal(trace.driftCanaries.fixationDetected, false);
  assert.equal(trace.driftCanaries.fixationRepeatCount, 0);
  assert.equal(trace.driftCanaries.recoveredAfterDrift, true);
});

test('summarizeSuites and buildMemoryQaTrace retain judged group totals', () => {
  const suites = [
    {
      name: 'judged',
      segmentId: 'judged',
      runLabel: 'judged',
      serverStatus: {
        resolvedChatModel: 'q6',
        toolPreferredModel: 'e4b',
        embedPreferredModel: 'nomic',
        availableModels: ['q6', 'e4b'],
        maxOutputTokens: 320,
      },
      environment: {
        valid: true,
        reasons: [],
      },
      scenarios: [
        { name: 'write', group: 'write', ok: true, seconds: 1.25, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 1, globalItems: 0 } }, readiness: { warmState: 'warm' } } } },
        { name: 'retrieve', group: 'retrieve', ok: true, seconds: 2.5, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 2, globalItems: 1 } }, readiness: { warmState: 'warm' } } } },
        { name: 'retrieve-canon-over-advisory', group: 'retrieve', ok: true, seconds: 1.1, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 1, globalItems: 1 } }, readiness: { warmState: 'warm' } } } },
        { name: 'forget', group: 'forget', ok: false, seconds: 0.75, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 0, globalItems: 0 } }, readiness: { warmState: 'warm' } } } },
      ],
    },
  ];

  const summary = summarizeSuites(suites);
  assert.equal(summary.completed, 3);
  assert.equal(summary.failed, 1);
  assert.equal(summary.groups.write.total, 1);
  assert.equal(summary.groups.retrieve.total, 2);
  assert.equal(summary.groups.retrieve.completed, 2);
  assert.equal(summary.groups.forget.failed, 1);

  const trace = buildMemoryQaTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:10:00.000Z',
    runMode: 'judged',
    runLabel: 'judged',
    suites,
    summary,
    preparation: {
      loadedModels: ['q6', 'e4b'],
    },
    qaModelPolicy: {
      chat: 'q6',
      tool: 'e4b',
      embed: 'nomic',
    },
  });

  assert.equal(trace.promptVersion, 'qa-penny-memory.judged.v1');
  assert.equal(trace.contextLength.judgedMode, true);
  assert.equal(trace.validation.judgedGroupCount, 3);
  assert.equal(trace.memoryWrites.judgedWriteScenarios, 1);
  assert.equal(trace.memoryReads.judgedRetrieveScenarios, 2);
  assert.equal(trace.outcome.judgedCompletedScenarios, 3);
  assert.equal(trace.outcome.judgedFailedScenarios, 1);
  assert.equal(trace.outcome.judgedGroupNames, 'write, retrieve, forget');
  assert.equal(trace.runIdentity.runMode, 'judged');
  assert.equal(trace.runIdentity.runLabel, 'judged');
  assert.equal(trace.runIdentity.runtimeArtifactVersion, undefined);
});
