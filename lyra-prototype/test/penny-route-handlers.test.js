const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { bindClientDisconnectAbort, createPennyRouteHandlers } = require('../lib/penny-route-handlers');
const { buildLastRouteInfo } = require('../lib/penny-runtime-artifacts');

function createToolReceiptRouteHarness({
  sessionId = 'tool-receipt-session',
  userText = 'Inspect README.md',
  runResult = {},
  staticEmbeddingStatus = null,
  queryStaticMemoryIndex = null,
} = {}) {
  const memoryStore = new Map();
  let response = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({
        sessionId,
        messages: [
          {
            role: 'user',
            content: userText,
          },
        ],
        memories: { brainMode: 'local', memories: [] },
      });
    },
    buildLastRouteInfo,
    buildChatMemoryState(_sessionId, memories = {}) {
      return {
        memory: {
          brainMode: memories.brainMode || 'local',
          memories: Array.isArray(memories.memories) ? memories.memories : [],
        },
        patch: {
          provenance: [],
          reviewCandidates: [],
        },
      };
    },
    sanitizeChatMessages(messages = []) {
      return Array.isArray(messages) ? messages : [];
    },
    sanitizeImageDataUrl() {
      return null;
    },
    sanitizeFileAttachment() {
      return null;
    },
    appendAttachmentContext(text = '') {
      return text;
    },
    async buildRuntimeMemoryContext() {
      return {
        memories: [],
        retrieval: null,
        archiveContext: null,
        researchLedger: null,
        promptComposition: null,
        promptTruth: null,
        latencyBudget: {
          latencyClass: 'tool-heavy',
          allowSemanticQuery: false,
          allowArchiveCompression: false,
          allowSemanticRender: false,
        },
        semanticMemory: {
          ready: false,
          mode: 'disabled',
        },
      };
    },
    selectLocalLane() {
      return {
        localLane: 'tool',
        directIntent: null,
        needsTools: true,
        reason: 'tool-intent',
      };
    },
    async runLmStudioLocalSmart() {
      return runResult;
    },
    async streamLmStudioLocalSmart() {
      throw new Error('stream path should not be used in this test');
    },
    scheduleResearchLedgerUpdate() {
      return {
        status: 'skipped',
        reason: 'tool-receipt-test',
      };
    },
    scheduleArchiveConsolidation() {},
    saveStoredMemory(savedSessionId, memory) {
      memoryStore.set(savedSessionId, memory);
      return memory;
    },
    getStoredMemory(savedSessionId) {
      return {
        memory: memoryStore.get(savedSessionId) || { memories: [] },
      };
    },
    mergeMemoryItems(items = []) {
      return items;
    },
    mergeMemoryState(existing = {}, patch = {}) {
      return { ...existing, ...patch };
    },
    reviewPromotion() {
      return null;
    },
    purgeArchiveMemory() {
      return null;
    },
    purgeResearchLedger() {
      return null;
    },
    buildCombinedMemoryInspector() {
      return {};
    },
    buildPennyReply() {
      return '';
    },
    runOpenClawShadow() {
      return '';
    },
    retagAssistantReply(text = '') {
      return text;
    },
    extractReplyMoodTag() {
      return 'calm';
    },
    pickMood() {
      return 'calm';
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*/gi, '').trim();
    },
    beginEventStream() {},
    sendEventStream() {},
    startEventStreamKeepAlive() {
      return null;
    },
    describeLocalBrainFailure(error) {
      return String(error?.message || error || 'local failure');
    },
    getLmStudioConnectionStatus() {
      return {};
    },
    getSemanticMemoryStatus() {
      return {};
    },
    getStaticEmbeddingStatus() {
      return staticEmbeddingStatus;
    },
    queryStaticMemoryIndex,
    setRuntimePreferredChatModel() {},
    getRuntimePreferredChatModel() {
      return '';
    },
    sessionState: {
      turns: 0,
      lastMood: 'calm',
      memory: [],
    },
    constants: {
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 0,
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
      LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
      LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
      LMSTUDIO_MODEL: 'google/gemma-4-e4b',
      LOCAL_LLM_TRANSPORT: 'chat-completions',
      RESPONSES_THEN_CHAT_FALLBACK: false,
      LMSTUDIO_MAX_OUTPUT_TOKENS: 1024,
      MEMORY_FILE: 'data/penny-memory.json',
      MEMORY_ARCHIVE_FILE: 'data/penny-memory-archive.json',
      MEMORY_EMBEDDINGS_FILE: 'data/penny-memory-embeddings.json',
      WEB_SEARCH_ENABLED: true,
    },
  });

  return {
    handlers,
    memoryStore,
    getResponse: () => response,
  };
}

test('bindClientDisconnectAbort aborts on aborted, request close, and response close', () => {
  for (const eventName of ['aborted', 'request-close', 'response-close']) {
    const req = new EventEmitter();
    const res = new EventEmitter();
    const controller = new AbortController();
    const binding = bindClientDisconnectAbort(req, res, controller);

    if (eventName === 'response-close') {
      res.emit('close');
    } else if (eventName === 'request-close') {
      req.emit('close');
    } else {
      req.emit(eventName);
    }

    assert.equal(binding.isClosed(), true);
    assert.equal(controller.signal.aborted, true);
    binding.cleanup();
  }
});

test('bindClientDisconnectAbort cleanup removes listeners', () => {
  const req = new EventEmitter();
  const res = new EventEmitter();
  const controller = new AbortController();
  const binding = bindClientDisconnectAbort(req, res, controller);

  binding.cleanup();
  req.emit('aborted');
  req.emit('close');
  res.emit('close');

  assert.equal(binding.isClosed(), false);
  assert.equal(controller.signal.aborted, false);
});

test('status route exposes static embedding runtime status when provided', async () => {
  const harness = createToolReceiptRouteHarness({
    staticEmbeddingStatus: {
      enabled: true,
      mode: 'live-shadow',
      provider: 'model2vec-potion-8m',
      indexedItems: 421,
      pendingItems: 3,
      lastQueryMs: 1.8,
      ready: true,
    },
  });

  const handled = await harness.handlers.handleApiRoute({
    req: { method: 'GET' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/status'),
  });
  const response = harness.getResponse();

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json.staticEmbedding, {
    enabled: true,
    mode: 'live-shadow',
    provider: 'model2vec-potion-8m',
    indexedItems: 421,
    pendingItems: 3,
    lastQueryMs: 1.8,
    ready: true,
  });
});

test('chat route queries static memory sidecar without changing the reply path', async () => {
  const queryCalls = [];
  const harness = createToolReceiptRouteHarness({
    sessionId: 'static-query-session',
    userText: 'What do you remember about the copper rabbit?',
    queryStaticMemoryIndex: async (text) => {
      queryCalls.push(text);
      return { skipped: false, candidates: [] };
    },
    runResult: {
      text: 'I remember the copper rabbit thread.\n[MOOD:calm]',
      toolsUsed: [],
      toolRecords: [],
      toolEvidenceFacts: [],
      localLane: 'tool',
      requestedModel: 'google/gemma-4-e4b',
      resolvedModel: 'google/gemma-4-e4b',
      executionPath: 'llm-tool-loop',
      laneFallback: false,
      modelUsed: true,
    },
  });

  const handled = await harness.handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });
  const response = harness.getResponse();

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(queryCalls, ['What do you remember about the copper rabbit?']);
  assert.equal(response.json.text, 'I remember the copper rabbit thread.\n[MOOD:calm]');
});

test('chat route keeps write-required tool misses out of the ledger and artifact success path', async () => {
  const memoryStore = new Map();
  let response = null;
  let ledgerCalls = 0;
  let archiveCalls = 0;

  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({
        sessionId: 'write-miss-session',
        messages: [
          {
            role: 'user',
            content: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
          },
        ],
        memories: { brainMode: 'local', memories: [] },
      });
    },
    buildLastRouteInfo,
    buildChatMemoryState(_sessionId, memories = {}) {
      return {
        memory: {
          brainMode: memories.brainMode || 'local',
          memories: Array.isArray(memories.memories) ? memories.memories : [],
        },
        patch: {
          provenance: [],
          reviewCandidates: [],
        },
      };
    },
    sanitizeChatMessages(messages = []) {
      return Array.isArray(messages) ? messages : [];
    },
    sanitizeImageDataUrl() {
      return null;
    },
    sanitizeFileAttachment() {
      return null;
    },
    appendAttachmentContext(text = '') {
      return text;
    },
    async buildRuntimeMemoryContext() {
      return {
        memories: [],
        retrieval: null,
        archiveContext: null,
        researchLedger: null,
        promptComposition: null,
        promptTruth: null,
        latencyBudget: {
          latencyClass: 'tool-heavy',
          allowSemanticQuery: false,
          allowArchiveCompression: false,
          allowSemanticRender: false,
        },
        semanticMemory: {
          ready: false,
          mode: 'disabled',
        },
      };
    },
    selectLocalLane() {
      return {
        localLane: 'tool',
        directIntent: null,
        needsTools: true,
        reason: 'tool-intent',
      };
    },
    async runLmStudioLocalSmart() {
      return {
        text: "i inspected tmp/qwen-dual-lane-sandbox.md, but i did not complete a verified edit, so i'm not going to pretend i did. no write landed, no fake victory lap.\n[MOOD:annoyed]",
        toolsUsed: [
          {
            name: 'read_project_file',
            label: 'read tmp/qwen-dual-lane-sandbox.md',
            ok: true,
          },
        ],
        toolRecords: [
          {
            name: 'read_project_file',
            args: { path: 'tmp/qwen-dual-lane-sandbox.md' },
            result: {
              ok: true,
              label: 'read tmp/qwen-dual-lane-sandbox.md',
              data: {
                path: 'tmp/qwen-dual-lane-sandbox.md',
                textPreview: 'alpha',
              },
            },
          },
        ],
        toolOutcome: {
          writeIntentRequired: true,
          writeIntentSatisfied: false,
          confirmedWriteCount: 0,
          failureReason: 'write-required-unmet',
          debug: {
            manualFallback: {
              used: true,
              reasonCode: 'tool_loop_missing_workspace_write',
              reason: 'Tool loop required a confirmed workspace write before final reply.',
              lastPlannerStatus: 'final-before-write',
              lastDecisionKind: 'final',
              lastDecisionTool: '',
              lastDecisionError: '',
              lastAssistantText: 'i already handled it.',
              invalidReplyCount: 0,
              emptyReplyCount: 0,
            },
            writeRescue: {
              attempted: true,
              phase: 'manual',
              status: 'non-tool-decision',
              responseStatusCode: 200,
              decisionKind: 'final',
              tool: '',
              argsPath: 'tmp/qwen-dual-lane-sandbox.md',
              parseError: '',
              assistantText: 'still not a write',
              responseBody: '',
            },
          },
        },
        localLane: 'tool',
        requestedModel: 'qwen/qwen3.6-35b-a3b',
        resolvedModel: 'qwen/qwen3.6-35b-a3b',
        executionPath: 'llm-tool-loop',
        laneFallback: false,
        modelUsed: true,
        canonicalFactsPresent: false,
        canonicalOverrideActive: false,
      };
    },
    async streamLmStudioLocalSmart() {
      throw new Error('stream path should not be used in this test');
    },
    scheduleResearchLedgerUpdate() {
      ledgerCalls += 1;
      return {
        status: 'applied',
        reason: 'should-not-run',
      };
    },
    scheduleArchiveConsolidation() {
      archiveCalls += 1;
    },
    saveStoredMemory(sessionId, memory) {
      memoryStore.set(sessionId, memory);
      return memory;
    },
    getStoredMemory(sessionId) {
      return {
        memory: memoryStore.get(sessionId) || { memories: [] },
      };
    },
    mergeMemoryItems(items = []) {
      return items;
    },
    mergeMemoryState(existing = {}, patch = {}) {
      return { ...existing, ...patch };
    },
    reviewPromotion() {
      return null;
    },
    purgeArchiveMemory() {
      return null;
    },
    purgeResearchLedger() {
      return null;
    },
    buildCombinedMemoryInspector() {
      return {};
    },
    buildPennyReply() {
      return '';
    },
    runOpenClawShadow() {
      return '';
    },
    retagAssistantReply(text = '') {
      return text;
    },
    extractReplyMoodTag() {
      return 'annoyed';
    },
    pickMood() {
      return 'annoyed';
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*/gi, '').trim();
    },
    beginEventStream() {},
    sendEventStream() {},
    startEventStreamKeepAlive() {
      return null;
    },
    describeLocalBrainFailure(error) {
      return String(error?.message || error || 'local failure');
    },
    getLmStudioConnectionStatus() {
      return {};
    },
    getSemanticMemoryStatus() {
      return {};
    },
    setRuntimePreferredChatModel() {},
    getRuntimePreferredChatModel() {
      return '';
    },
    sessionState: {
      turns: 0,
      lastMood: 'calm',
      memory: [],
    },
    constants: {
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 0,
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
      LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
      LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
      LMSTUDIO_MODEL: 'qwen/qwen3.6-35b-a3b',
      LOCAL_LLM_TRANSPORT: 'chat-completions',
      RESPONSES_THEN_CHAT_FALLBACK: false,
      LMSTUDIO_MAX_OUTPUT_TOKENS: 1024,
      MEMORY_FILE: 'data/penny-memory.json',
      MEMORY_ARCHIVE_FILE: 'data/penny-memory-archive.json',
      MEMORY_EMBEDDINGS_FILE: 'data/penny-memory-embeddings.json',
      WEB_SEARCH_ENABLED: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });

  assert.equal(handled, true);
  assert.ok(response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.meta.researchLedgerUpdate.status, 'skipped');
  assert.equal(response.json.meta.researchLedgerUpdate.reason, 'write-required-unmet');
  assert.equal(response.json.meta.toolOutcome.writeIntentRequired, true);
  assert.equal(response.json.meta.toolOutcome.writeIntentSatisfied, false);
  assert.equal(response.json.meta.toolOutcome.debug.manualFallback.used, true);
  assert.equal(response.json.meta.toolOutcome.debug.writeRescue.status, 'non-tool-decision');
  assert.equal(response.json.meta.artifact.authority.reply, 'write-required-unmet');
  assert.equal(response.json.meta.artifact.authority.toolClaims, 'write-unverified');
  assert.equal(
    response.json.meta.artifact.summary.text,
    'Verifier-first turn did not complete a verified edit (write required unmet).',
  );
  assert.equal(response.json.meta.artifact.sideEffects.some((item) => item.type === 'file-write' && item.status === 'missing'), true);
  assert.equal(response.json.meta.artifact.toolOutcome.writeIntentSatisfied, false);
  assert.equal(ledgerCalls, 0);
  assert.equal(archiveCalls, 0);

  const saved = memoryStore.get('write-miss-session');
  assert.ok(saved);
  assert.equal(saved.lastRoute.researchLedgerUpdate.status, 'skipped');
  assert.equal(saved.lastRoute.toolOutcome.writeIntentSatisfied, false);
  assert.equal(saved.lastRoute.toolOutcome.debug.manualFallback.used, true);
  assert.equal(saved.lastRoute.artifact.authority.reply, 'write-required-unmet');
});

test('chat route threads successful write intent into ledger scheduling so generic authored writes can be skipped honestly', async () => {
  const memoryStore = new Map();
  let response = null;
  let archiveCalls = 0;
  let capturedLedgerArgs = null;

  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({
        sessionId: 'generic-write-session',
        messages: [
          {
            role: 'user',
            content: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice. I am not giving you a topic on purpose. You can write whatever you want there. Then tell me exactly what you changed.",
          },
        ],
        memories: { brainMode: 'local', memories: [] },
      });
    },
    buildLastRouteInfo,
    buildChatMemoryState(_sessionId, memories = {}) {
      return {
        memory: {
          brainMode: memories.brainMode || 'local',
          memories: Array.isArray(memories.memories) ? memories.memories : [],
        },
        patch: {
          provenance: [],
          reviewCandidates: [],
        },
      };
    },
    sanitizeChatMessages(messages = []) {
      return Array.isArray(messages) ? messages : [];
    },
    sanitizeImageDataUrl() {
      return null;
    },
    sanitizeFileAttachment() {
      return null;
    },
    appendAttachmentContext(text = '') {
      return text;
    },
    async buildRuntimeMemoryContext() {
      return {
        memories: [],
        retrieval: null,
        archiveContext: null,
        researchLedger: null,
        promptComposition: null,
        promptTruth: null,
        latencyBudget: {
          latencyClass: 'tool-heavy',
          allowSemanticQuery: false,
          allowArchiveCompression: false,
          allowSemanticRender: false,
        },
        semanticMemory: {
          ready: false,
          mode: 'disabled',
        },
      };
    },
    selectLocalLane() {
      return {
        localLane: 'tool',
        directIntent: null,
        needsTools: true,
        reason: 'tool-intent',
      };
    },
    async runLmStudioLocalSmart() {
      return {
        text: "i added three soft sentences to Penny's Playground/penny-qa-freewrite.md and left the rest of the file alone.\n[MOOD:happy]",
        toolsUsed: [
          {
            name: 'insert_in_project_file',
            label: "insert Penny's Playground/penny-qa-freewrite.md",
            ok: true,
          },
          {
            name: 'get_git_status',
            label: 'git status',
            ok: true,
          },
        ],
        toolRecords: [
          {
            name: 'insert_in_project_file',
            args: { path: "Penny's Playground/penny-qa-freewrite.md" },
            result: {
              ok: true,
              label: "insert Penny's Playground/penny-qa-freewrite.md",
              data: {
                path: "Penny's Playground/penny-qa-freewrite.md",
              },
            },
          },
          {
            name: 'get_git_status',
            args: {},
            result: {
              ok: true,
              label: 'git status',
              data: {},
            },
          },
        ],
        toolOutcome: {
          writeIntentRequired: true,
          writeIntentSatisfied: true,
          confirmedWriteCount: 1,
          failureReason: '',
        },
        localLane: 'tool',
        requestedModel: 'qwen/qwen3.6-35b-a3b',
        resolvedModel: 'qwen/qwen3.6-35b-a3b',
        executionPath: 'llm-tool-loop',
        laneFallback: false,
        modelUsed: true,
        canonicalFactsPresent: false,
        canonicalOverrideActive: false,
      };
    },
    async streamLmStudioLocalSmart() {
      throw new Error('stream path should not be used in this test');
    },
    scheduleResearchLedgerUpdate(args = {}) {
      capturedLedgerArgs = args;
      return {
        status: 'skipped',
        reason: 'generic-write-turn',
        context: null,
        topic: null,
      };
    },
    scheduleArchiveConsolidation() {
      archiveCalls += 1;
    },
    saveStoredMemory(sessionId, memory) {
      memoryStore.set(sessionId, memory);
      return memory;
    },
    getStoredMemory(sessionId) {
      return {
        memory: memoryStore.get(sessionId) || { memories: [] },
      };
    },
    mergeMemoryItems(items = []) {
      return items;
    },
    mergeMemoryState(existing = {}, patch = {}) {
      return { ...existing, ...patch };
    },
    reviewPromotion() {
      return null;
    },
    purgeArchiveMemory() {
      return null;
    },
    purgeResearchLedger() {
      return null;
    },
    buildCombinedMemoryInspector() {
      return {};
    },
    buildPennyReply() {
      return '';
    },
    runOpenClawShadow() {
      return '';
    },
    retagAssistantReply(text = '') {
      return text;
    },
    extractReplyMoodTag() {
      return 'happy';
    },
    pickMood() {
      return 'happy';
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*/gi, '').trim();
    },
    beginEventStream() {},
    sendEventStream() {},
    startEventStreamKeepAlive() {
      return null;
    },
    describeLocalBrainFailure(error) {
      return String(error?.message || error || 'local failure');
    },
    getLmStudioConnectionStatus() {
      return {};
    },
    getSemanticMemoryStatus() {
      return {};
    },
    setRuntimePreferredChatModel() {},
    getRuntimePreferredChatModel() {
      return '';
    },
    sessionState: {
      turns: 0,
      lastMood: 'calm',
      memory: [],
    },
    constants: {
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 0,
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
      LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
      LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
      LMSTUDIO_MODEL: 'qwen/qwen3.6-35b-a3b',
      LOCAL_LLM_TRANSPORT: 'chat-completions',
      RESPONSES_THEN_CHAT_FALLBACK: false,
      LMSTUDIO_MAX_OUTPUT_TOKENS: 1024,
      MEMORY_FILE: 'data/penny-memory.json',
      MEMORY_ARCHIVE_FILE: 'data/penny-memory-archive.json',
      MEMORY_EMBEDDINGS_FILE: 'data/penny-memory-embeddings.json',
      WEB_SEARCH_ENABLED: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });

  assert.equal(handled, true);
  assert.ok(response);
  assert.equal(response.statusCode, 200);
  assert.ok(capturedLedgerArgs);
  assert.equal(capturedLedgerArgs.toolOutcome.writeIntentRequired, true);
  assert.equal(capturedLedgerArgs.toolOutcome.writeIntentSatisfied, true);
  assert.equal(response.json.meta.researchLedgerUpdate.status, 'skipped');
  assert.equal(response.json.meta.researchLedgerUpdate.reason, 'generic-write-turn');
  assert.equal(response.json.meta.toolOutcome.writeIntentSatisfied, true);
  assert.equal(response.json.meta.artifact.authority.reply, 'verified-tool-evidence');
  assert.equal(archiveCalls, 0);

  const saved = memoryStore.get('generic-write-session');
  assert.ok(saved);
  assert.equal(saved.lastRoute.researchLedgerUpdate.reason, 'generic-write-turn');
  assert.equal(saved.lastRoute.toolOutcome.writeIntentSatisfied, true);
});

test('chat route forwards deterministic direct-tool evidence facts into the runtime artifact receipt', async () => {
  const sessionId = 'deterministic-receipt-session';
  const harness = createToolReceiptRouteHarness({
    sessionId,
    userText: 'Open README.md and tell me what it says without changing anything.',
    runResult: {
      text: 'README.md says Penny is a local-first companion prototype.\n[MOOD:calm]',
      toolsUsed: [
        { name: 'read_project_file', label: 'read README.md', ok: true },
      ],
      toolRecords: [
        {
          name: 'read_project_file',
          args: { path: 'README.md' },
          result: {
            ok: true,
            label: 'read README.md',
            data: {
              path: 'README.md',
              textPreview: '# Penny',
            },
          },
        },
      ],
      toolEvidenceFacts: [{
        path: 'direct_deterministic',
        promptVisibility: 'not_prompt_visible',
        nonPromptUse: 'deterministic_only',
        renderForm: 'none',
        modelHop: 'none',
        toolRecordIndexes: [0],
      }],
      localLane: 'tool',
      requestedModel: 'google/gemma-4-e4b',
      resolvedModel: '',
      executionPath: 'deterministic-tool',
      laneFallback: false,
      modelUsed: false,
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
    },
  });

  const handled = await harness.handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });

  const response = harness.getResponse();
  assert.equal(handled, true);
  assert.ok(response);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.deterministicOnlyItemCount, 1);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 0);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.items[0].path, 'direct_deterministic');
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'README.md');

  const saved = harness.memoryStore.get(sessionId);
  assert.ok(saved);
  assert.equal(saved.lastRoute.artifact.toolEvidenceReceipt.summary.deterministicOnlyItemCount, 1);
});

test('chat route forwards direct single-tool LM evidence facts into the runtime artifact receipt', async () => {
  const sessionId = 'lm-receipt-session';
  const harness = createToolReceiptRouteHarness({
    sessionId,
    userText: 'Read docs/README.md and give me the short takeaway.',
    runResult: {
      text: 'docs/README.md is the docs authority map.\n[MOOD:thinking]',
      toolsUsed: [
        { name: 'read_project_file', label: 'read docs/README.md', ok: true },
      ],
      toolRecords: [
        {
          name: 'read_project_file',
          args: { path: 'docs/README.md' },
          result: {
            ok: true,
            label: 'read docs/README.md',
            data: {
              path: 'docs/README.md',
              textPreview: '# Docs',
            },
          },
        },
      ],
      toolEvidenceFacts: [{
        path: 'direct_single_tool_context_answer',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'raw_json',
        modelHop: 'single',
        toolRecordIndexes: [0],
      }],
      localLane: 'tool',
      requestedModel: 'google/gemma-4-e4b',
      resolvedModel: 'google/gemma-4-e4b',
      executionPath: 'llm-tool-loop',
      laneFallback: false,
      modelUsed: true,
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
    },
  });

  const handled = await harness.handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });

  const response = harness.getResponse();
  assert.equal(handled, true);
  assert.ok(response);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 1);
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.items[0].path, 'direct_single_tool_context_answer');
  assert.equal(response.json.meta.artifact.toolEvidenceReceipt.items[0].modelHop, 'single');

  const saved = harness.memoryStore.get(sessionId);
  assert.ok(saved);
  assert.equal(saved.lastRoute.artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 1);
});

test('chat route keeps image uploads on the chat lane and records attachment-bounded reasoning', async () => {
  const memoryStore = new Map();
  let response = null;
  let runtimeContextArgs = null;
  let localSmartArgs = null;

  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({
        sessionId: 'image-upload-session',
        messages: [
          {
            role: 'user',
            content: 'Tell me what you see in this image.',
          },
        ],
        image: 'data:image/jpeg;base64,abc123',
        memories: { brainMode: 'local', memories: [] },
      });
    },
    buildLastRouteInfo,
    buildChatMemoryState(_sessionId, memories = {}) {
      return {
        memory: {
          brainMode: memories.brainMode || 'local',
          memories: Array.isArray(memories.memories) ? memories.memories : [],
        },
        patch: {
          provenance: [],
          reviewCandidates: [],
        },
      };
    },
    sanitizeChatMessages(messages = []) {
      return Array.isArray(messages) ? messages : [];
    },
    sanitizeImageDataUrl(value = '') {
      return value ? { dataUrl: value } : null;
    },
    sanitizeFileAttachment() {
      return null;
    },
    appendAttachmentContext(text = '') {
      return text;
    },
    async buildRuntimeMemoryContext(args = {}) {
      runtimeContextArgs = args;
      return {
        memories: [],
        retrieval: null,
        archiveContext: null,
        researchLedger: null,
        promptComposition: null,
        promptTruth: null,
        latencyBudget: {
          latencyClass: 'image-heavy',
          policyMode: 'attachment-bounded',
          allowSemanticQuery: false,
          allowArchiveCompression: false,
          allowSemanticRender: false,
        },
        semanticMemory: {
          ready: false,
          mode: 'disabled',
        },
      };
    },
    selectLocalLane(args = {}) {
      assert.equal(typeof args.image, 'string');
      return {
        localLane: 'chat',
        directIntent: null,
        needsTools: false,
        reason: 'image-chat',
      };
    },
    async runLmStudioLocalSmart(args = {}) {
      localSmartArgs = args;
      return {
        text: 'i can see the image you attached. tiny little test square.\n[MOOD:thinking]',
        toolsUsed: [],
        toolRecords: [],
        toolOutcome: null,
        localLane: 'chat',
        requestedModel: 'qwen/qwen3.6-35b-a3b',
        resolvedModel: 'qwen/qwen3.6-35b-a3b',
        executionPath: 'llm-chat',
        laneFallback: false,
        modelUsed: true,
        canonicalFactsPresent: false,
        canonicalOverrideActive: false,
      };
    },
    async streamLmStudioLocalSmart() {
      throw new Error('stream path should not be used in this test');
    },
    scheduleResearchLedgerUpdate() {
      return {
        status: 'skipped',
        reason: 'ordinary-chat-turn',
        context: null,
        topic: null,
      };
    },
    scheduleArchiveConsolidation() {},
    saveStoredMemory(sessionId, memory) {
      memoryStore.set(sessionId, memory);
      return memory;
    },
    getStoredMemory(sessionId) {
      return {
        memory: memoryStore.get(sessionId) || { memories: [] },
      };
    },
    mergeMemoryItems(items = []) {
      return items;
    },
    mergeMemoryState(existing = {}, patch = {}) {
      return { ...existing, ...patch };
    },
    reviewPromotion() {
      return null;
    },
    purgeArchiveMemory() {
      return null;
    },
    purgeResearchLedger() {
      return null;
    },
    buildCombinedMemoryInspector() {
      return {};
    },
    buildPennyReply() {
      return '';
    },
    runOpenClawShadow() {
      return '';
    },
    retagAssistantReply(text = '') {
      return text;
    },
    extractReplyMoodTag() {
      return 'thinking';
    },
    pickMood() {
      return 'thinking';
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*/gi, '').trim();
    },
    beginEventStream() {},
    sendEventStream() {},
    startEventStreamKeepAlive() {
      return null;
    },
    describeLocalBrainFailure(error) {
      return String(error?.message || error || 'local failure');
    },
    getLmStudioConnectionStatus() {
      return {};
    },
    getSemanticMemoryStatus() {
      return {};
    },
    setRuntimePreferredChatModel() {},
    getRuntimePreferredChatModel() {
      return '';
    },
    sessionState: {
      turns: 0,
      lastMood: 'calm',
      memory: [],
    },
    constants: {
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 0,
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
      LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
      LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
      LMSTUDIO_MODEL: 'qwen/qwen3.6-35b-a3b',
      LOCAL_LLM_TRANSPORT: 'chat-completions',
      RESPONSES_THEN_CHAT_FALLBACK: false,
      LMSTUDIO_MAX_OUTPUT_TOKENS: 1024,
      MEMORY_FILE: 'data/penny-memory.json',
      MEMORY_ARCHIVE_FILE: 'data/penny-memory-archive.json',
      MEMORY_EMBEDDINGS_FILE: 'data/penny-memory-embeddings.json',
      WEB_SEARCH_ENABLED: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://127.0.0.1/api/penny/chat'),
  });

  assert.equal(handled, true);
  assert.ok(response);
  assert.equal(response.statusCode, 200);
  assert.equal(runtimeContextArgs.attachmentType, 'image');
  assert.equal(localSmartArgs.image, 'data:image/jpeg;base64,abc123');
  assert.equal(localSmartArgs.laneSelection.localLane, 'chat');
  assert.equal(response.json.meta.localLane, 'chat');
  assert.equal(response.json.meta.artifact.scope.selectedLane, 'chat');
  assert.equal(response.json.meta.artifact.modelAdvisory.reasoningPolicy.mode, 'attachment-bounded');
  assert.equal(response.json.meta.artifact.trace.reasoningPolicy.mode, 'attachment-bounded');
});

test('streamed chat route sends image replies through message.delta and done events', async () => {
  const events = [];

  const handlers = createPennyRouteHandlers({
    async safeReadBody() {
      return JSON.stringify({
        sessionId: 'image-upload-stream-session',
        messages: [
          {
            role: 'user',
            content: 'Tell me what you see in this image.',
          },
        ],
        image: 'data:image/jpeg;base64,abc123',
        memories: { brainMode: 'local', memories: [] },
      });
    },
    buildLastRouteInfo,
    buildChatMemoryState(_sessionId, memories = {}) {
      return {
        memory: {
          brainMode: memories.brainMode || 'local',
          memories: Array.isArray(memories.memories) ? memories.memories : [],
        },
        patch: {
          provenance: [],
          reviewCandidates: [],
        },
      };
    },
    sanitizeChatMessages(messages = []) {
      return Array.isArray(messages) ? messages : [];
    },
    sanitizeImageDataUrl(value = '') {
      return value ? { dataUrl: value } : null;
    },
    sanitizeFileAttachment() {
      return null;
    },
    appendAttachmentContext(text = '') {
      return text;
    },
    async buildRuntimeMemoryContext() {
      return {
        memories: [],
        retrieval: null,
        archiveContext: null,
        researchLedger: null,
        promptComposition: null,
        promptTruth: null,
        latencyBudget: {
          latencyClass: 'image-heavy',
          policyMode: 'attachment-bounded',
          allowSemanticQuery: false,
          allowArchiveCompression: false,
          allowSemanticRender: false,
        },
        semanticMemory: {
          ready: false,
          mode: 'disabled',
        },
      };
    },
    selectLocalLane() {
      return {
        localLane: 'chat',
        directIntent: null,
        needsTools: false,
        reason: 'image-chat',
      };
    },
    async runLmStudioLocalSmart() {
      return {
        text: 'I can see the image you attached. Tiny little test square.\n[MOOD:thinking]',
        toolsUsed: [],
        toolRecords: [],
        toolOutcome: null,
        localLane: 'chat',
        requestedModel: 'qwen/qwen3.6-35b-a3b',
        resolvedModel: 'qwen/qwen3.6-35b-a3b',
        executionPath: 'llm-chat',
        laneFallback: false,
        modelUsed: true,
        canonicalFactsPresent: false,
        canonicalOverrideActive: false,
      };
    },
    async streamLmStudioLocalSmart() {
      throw new Error('stream path should not be used for image turns');
    },
    scheduleResearchLedgerUpdate() {
      return {
        status: 'skipped',
        reason: 'ordinary-chat-turn',
        context: null,
        topic: null,
      };
    },
    scheduleArchiveConsolidation() {},
    saveStoredMemory(_sessionId, memory) {
      return memory;
    },
    getStoredMemory() {
      return { memory: { memories: [] } };
    },
    mergeMemoryItems(items = []) {
      return items;
    },
    mergeMemoryState(existing = {}, patch = {}) {
      return { ...existing, ...patch };
    },
    reviewPromotion() {
      return null;
    },
    purgeArchiveMemory() {
      return null;
    },
    purgeResearchLedger() {
      return null;
    },
    buildCombinedMemoryInspector() {
      return {};
    },
    buildPennyReply() {
      return '';
    },
    runOpenClawShadow() {
      return '';
    },
    retagAssistantReply(text = '') {
      return text;
    },
    extractReplyMoodTag() {
      return 'thinking';
    },
    pickMood() {
      return 'thinking';
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*/gi, '').trim();
    },
    beginEventStream() {},
    sendEventStream(_res, event, data) {
      events.push({ event, data });
    },
    startEventStreamKeepAlive() {
      return () => {};
    },
    bindClientDisconnectAbort() {
      return {
        isClosed() {
          return false;
        },
      };
    },
    describeLocalBrainFailure(error) {
      return String(error?.message || error || 'local failure');
    },
    getLmStudioConnectionStatus() {
      return {};
    },
    getSemanticMemoryStatus() {
      return {};
    },
    setRuntimePreferredChatModel() {},
    getRuntimePreferredChatModel() {
      return '';
    },
    sessionState: {
      turns: 0,
      lastMood: 'calm',
      memory: [],
    },
    constants: {
      OPENCLAW_ENABLED: false,
      OPENCLAW_TIMEOUT_MS: 0,
      PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
      LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
      LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
      LMSTUDIO_MODEL: 'qwen/qwen3.6-35b-a3b',
      LOCAL_LLM_TRANSPORT: 'chat-completions',
      RESPONSES_THEN_CHAT_FALLBACK: false,
      LMSTUDIO_MAX_OUTPUT_TOKENS: 1024,
      MEMORY_FILE: 'data/penny-memory.json',
      MEMORY_ARCHIVE_FILE: 'data/penny-memory-archive.json',
      MEMORY_EMBEDDINGS_FILE: 'data/penny-memory-embeddings.json',
      WEB_SEARCH_ENABLED: true,
    },
  });

  const req = {
    method: 'POST',
    setTimeout() {},
    socket: {
      setTimeout() {},
    },
  };
  const res = {
    setTimeout() {},
    end() {},
  };

  const handled = await handlers.handleApiRoute({
    req,
    res,
    url: new URL('http://127.0.0.1/api/penny/chat?stream=1'),
  });

  assert.equal(handled, true);
  assert.equal(events.some((item) => item.event === 'message.delta' && /tiny little test square/i.test(String(item.data?.text || ''))), true);
  assert.equal(events.some((item) => item.event === 'done' && /tiny little test square/i.test(String(item.data?.text || ''))), true);
});
