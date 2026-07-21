const test = require('node:test');
const assert = require('node:assert/strict');

const {
  apiAuthHeaders,
  buildEvalStatePaths,
  buildLoadArgsForSettings,
  buildPromptAndSamplingContract,
  buildServerEnvironment,
  promptNamesForSuite,
  shouldAcceptDeferredModelLoadPreparation,
  summarizePromptResults,
  summarizePresetWiring,
} = require('../scripts/eval-penny-models');

test('model eval runner records Penny preset and chat sampling contract', () => {
  const headers = apiAuthHeaders({ 'Content-Type': 'application/json' });
  assert.equal(headers['Content-Type'], 'application/json');
  assert.match(headers.Authorization || '', /^Bearer\s+\S+/);

  const preset = {
    presetIdentifier: '@local:penny',
    settings: {
      path: 'settings.json',
      exists: true,
      experimentalLoadPresets: true,
    },
    selectedConversation: {
      path: 'conversation.json',
      exists: true,
      preset: '@local:penny',
      presetOk: true,
    },
    chatConfigs: [{ path: 'chat.json', exists: true, preset: '@local:penny', presetOk: true }],
    toolConfigs: [{ path: 'tool.json', exists: true, preset: '@local:penny', presetOk: true }],
    repairedPaths: [],
    missingTargets: [],
  };

  const summary = summarizePresetWiring(preset);
  assert.equal(summary.settings.experimentalLoadPresets, true);
  assert.equal(summary.selectedConversation.presetOk, true);
  assert.equal(summary.chatConfigs[0].presetOk, true);

  const contract = buildPromptAndSamplingContract({ preset });
  assert.equal(contract.lmStudioPresetIdentifier, process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny');
  assert.equal(contract.authTokenStoredInArtifact, false);
  assert.equal(contract.apiAuthConfigured, true);
  assert.equal(contract.chatSampling.temperature, Number(process.env.PENNY_LMSTUDIO_CHAT_TEMPERATURE || 1));
  assert.equal(contract.chatSampling.top_p, Number(process.env.PENNY_LMSTUDIO_CHAT_TOP_P || 0.95));
  assert.equal(contract.chatSampling.top_k, Number(process.env.PENNY_LMSTUDIO_CHAT_TOP_K || 64));
  assert.equal(contract.lmStudioPresetWiring.toolConfigs[0].presetOk, true);
});

test('model eval summary does not count slow timeout budgets as hard failures', () => {
  const summary = summarizePromptResults([
    { ok: true, seconds: 4, analysis: { swearCount: 1, blandTellCount: 0 } },
    { ok: false, seconds: 120, error: 'Client timed out after 120000ms' },
    { ok: false, seconds: 1, error: 'template error' },
  ]);

  assert.equal(summary.attempted, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.timedOut, 1);
  assert.equal(summary.unresolved, 2);
});

test('model eval summary flags mood-tag-only replies as invalid visible completions', () => {
  const summary = summarizePromptResults([
    {
      name: 'olympicsJealousApp',
      ok: true,
      seconds: 18,
      text: '[MOOD:smug]',
      analysis: {
        chars: 0,
        words: 0,
        swearCount: 0,
        swears: [],
        spiceHitCount: 0,
        humorHitCount: 0,
        blandTellCount: 0,
      },
    },
    {
      name: 'olympicsComebacks',
      ok: true,
      seconds: 20,
      text: 'That mood-tag-only answer tripped over its own cape. [MOOD:smug]',
      analysis: {
        chars: 49,
        words: 9,
        swearCount: 0,
        swears: [],
        spiceHitCount: 0,
        humorHitCount: 1,
        blandTellCount: 0,
      },
    },
  ]);

  assert.equal(summary.completed, 2);
  assert.equal(summary.invalidVisibleReplies, 1);
  assert.deepEqual(summary.invalidVisibleReplyNames, ['olympicsJealousApp']);
  assert.equal(summary.validVisibleReplies, 1);
});

test('model eval server environment isolates archive, ledger, embeddings, and static prompt state', () => {
  const paths = buildEvalStatePaths({
    PENNY_EVAL_MEMORY_FILE: 'data/custom-memory.json',
  }, {
    rootDir: '/tmp/penny-root',
    stamp: '2026-06-30Tmodel',
  });

  assert.match(paths.archiveFile, /penny-memory-archive\.model-eval-2026-06-30Tmodel\.json$/);
  assert.match(paths.embeddingsFile, /penny-memory-embeddings\.model-eval-2026-06-30Tmodel\.json$/);
  assert.match(paths.ledgerFile, /penny-memory-ledger\.model-eval-2026-06-30Tmodel\.json$/);
  assert.match(paths.staticEmbeddingsFile, /penny-memory-embeddings\.static\.model-eval-2026-06-30Tmodel\.json$/);

  const env = buildServerEnvironment({
    baseEnv: {
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '1',
      PENNY_STATIC_EMBED_MODE: 'live-advisory',
    },
    statePaths: paths,
    modelKey: 'gemma-4-12b-it',
  });

  assert.equal(env.PENNY_MEMORY_FILE, paths.memoryFile);
  assert.equal(env.PENNY_MEMORY_ARCHIVE_FILE, paths.archiveFile);
  assert.equal(env.PENNY_MEMORY_EMBEDDINGS_FILE, paths.embeddingsFile);
  assert.equal(env.PENNY_MEMORY_LEDGER_FILE, paths.ledgerFile);
  assert.equal(env.PENNY_OPEN_LOOP_FILE, paths.openLoopFile);
  assert.equal(env.PENNY_ENABLE_RESEARCH_LEDGER_PROMPT, '0');
  assert.equal(env.PENNY_ENABLE_BACKGROUND_CHAT_VECTORS, '0');
  assert.equal(env.PENNY_STATIC_EMBED_MODE, 'off');
  assert.equal(env.PENNY_STATIC_EMBED_CACHE_FILE, '');
  assert.equal(env.PENNY_LMSTUDIO_CHAT_MODEL, 'gemma-4-12b-it');
});

test('voice olympics prompt suite is a substantial spicy humor gauntlet', () => {
  const names = promptNamesForSuite('voice_olympics');
  assert.ok(names.length >= 10);
  assert.ok(names.includes('olympicsSpicyDare'));
  assert.ok(names.includes('olympicsControlledCurse'));
  assert.ok(names.includes('olympicsDirtyTechMetaphor'));
});

test('model eval load args can force safe single-prediction gpu policy', () => {
  const args = buildLoadArgsForSettings('qwen3.6-27b-mtp', {
    contextLength: 8192,
    ttlSeconds: 1800,
    parallel: 1,
    gpu: '0.6',
  });

  assert.deepEqual(args, [
    'load',
    'qwen3.6-27b-mtp',
    '-y',
    '-c',
    '8192',
    '--ttl',
    '1800',
    '--parallel',
    '1',
    '--gpu',
    '0.6',
  ]);
});

test('model eval summary records profanity and voice-signal counts', () => {
  const summary = summarizePromptResults([
    {
      ok: true,
      seconds: 5,
      analysis: {
        swearCount: 2,
        swears: ['fuck', 'hell'],
        spiceHitCount: 1,
        humorHitCount: 2,
        blandTellCount: 0,
      },
    },
  ]);

  assert.equal(summary.totalSwears, 2);
  assert.equal(summary.swearHistogram.fuck, 1);
  assert.equal(summary.swearHistogram.hell, 1);
  assert.equal(summary.totalSpiceHits, 1);
  assert.equal(summary.totalHumorHits, 2);
});

test('model eval preparation can defer the loaded chat model to candidate loads', () => {
  const accepted = shouldAcceptDeferredModelLoadPreparation({
    blockers: ['LM Studio is reachable, but no usable chat or tool model is currently loaded. Load a lane-capable model before running QA.'],
  }, { prepLoadChatModel: false });

  assert.equal(accepted, true);
  assert.equal(shouldAcceptDeferredModelLoadPreparation({
    blockers: ['Some unrelated readiness failure.'],
  }, { prepLoadChatModel: false }), false);
});
