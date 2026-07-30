const fs = require('fs');
const http = require('http');
const path = require('path');
const { performance } = require('perf_hooks');

const {
  buildPerformanceMatrix,
  assertPerformanceClaim,
} = require('../lib/penny-performance-matrix');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(
  ROOT_DIR,
  'output',
  `penny-performance-matrix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

function parseArgs(argv = process.argv.slice(2)) {
  const result = {
    outputPath: DEFAULT_OUTPUT,
    warmRuns: 5,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (arg === '--out' && argv[index + 1]) {
      result.outputPath = path.resolve(String(argv[index + 1]));
      index += 1;
    } else if (arg === '--warm-runs' && argv[index + 1]) {
      result.warmRuns = Math.max(3, Math.round(Number(argv[index + 1]) || 5));
      index += 1;
    }
  }
  return result;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createIsolatedMockProvider() {
  const stats = {
    requests: 0,
    primaryRequests: 0,
    repairRequests: 0,
  };
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"not found"}');
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {}
    stats.requests += 1;
    const repair = body?.metadata?.purpose === 'cadence-repair';
    if (repair) stats.repairRequests += 1;
    else stats.primaryRequests += 1;

    await delay(3);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-mock-prompt-eval-ms': repair ? '1.5' : '2.5',
    });
    res.flushHeaders?.();
    if (body?.metadata?.reasoning === 'observed') {
      res.write('event: reasoning.delta\ndata: {"reasoning":"private mock reasoning"}\n\n');
      await delay(4);
    }
    const first = repair ? 'Polished' : 'Mock';
    const second = repair ? ' reply.' : ' Penny reply.';
    res.write(`event: message.delta\ndata: ${JSON.stringify({ content: first })}\n\n`);
    await delay(5);
    res.write(`event: message.delta\ndata: ${JSON.stringify({ content: second })}\n\n`);
    await delay(3);
    res.end(`event: done\ndata: ${JSON.stringify({ text: `${first}${second}` })}\n\n`);
  });

  return {
    stats,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      return `http://127.0.0.1:${address.port}/v1`;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function parseSseEvent(block = '') {
  let event = 'message';
  const dataLines = [];
  for (const line of String(block || '').split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  let data = {};
  try {
    data = JSON.parse(dataLines.join('\n') || '{}');
  } catch {}
  return { event, data };
}

async function callMockProvider({ baseUrl, prompt, reasoning = 'disabled', purpose = 'primary' }) {
  const requestBody = {
    model: 'mock/penny-performance',
    stream: true,
    messages: [{ role: 'user', content: prompt }],
    metadata: { reasoning, purpose },
  };
  const dispatchAt = performance.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok || !response.body) throw new Error(`Mock provider returned HTTP ${response.status}.`);

  const decoder = new TextDecoder();
  let buffer = '';
  let firstEventAt = null;
  let firstVisibleAt = null;
  let lastVisibleAt = null;
  let visibleText = '';
  let reasoningChars = 0;
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      const eventAt = performance.now();
      if (firstEventAt == null) firstEventAt = eventAt;
      const parsed = parseSseEvent(block);
      if (parsed.event === 'reasoning.delta') {
        reasoningChars += String(parsed.data?.reasoning || '').length;
      }
      if (parsed.event === 'message.delta' && String(parsed.data?.content || '')) {
        if (firstVisibleAt == null) firstVisibleAt = eventAt;
        lastVisibleAt = eventAt;
        visibleText += String(parsed.data.content);
      }
    }
  }
  const completedAt = performance.now();
  return {
    dispatchAt,
    firstEventAt,
    firstVisibleAt,
    lastVisibleAt,
    completedAt,
    durationMs: completedAt - dispatchAt,
    promptEvaluationMs: Number(response.headers.get('x-mock-prompt-eval-ms')),
    visibleText,
    reasoningChars,
    requestBody,
  };
}

async function measureRun({
  baseUrl,
  profileId,
  repetition,
  warmup,
  reasoning,
  cadenceRepair,
}) {
  const prompt = 'Explain the bounded performance receipt in one visible sentence.';
  const startedAt = performance.now();
  const serializedPrompt = JSON.stringify([{ role: 'user', content: prompt }]);
  await delay(1);
  const primary = await callMockProvider({
    baseUrl,
    prompt,
    reasoning,
    purpose: 'primary',
  });
  let repair = null;
  if (cadenceRepair) {
    repair = await callMockProvider({
      baseUrl,
      prompt: `Polish only the visible cadence: ${primary.visibleText}`,
      reasoning: 'disabled',
      purpose: 'cadence-repair',
    });
  }
  const providersCompletedAt = repair?.completedAt || primary.completedAt;
  await delay(1);
  const finishedAt = performance.now();
  const pennyPreProviderMs = primary.dispatchAt - startedAt;
  const pennyPostProviderMs = finishedAt - providersCompletedAt;
  return {
    id: `${profileId}-${warmup ? 'warmup' : `warm-${repetition}`}`,
    profileId,
    repetition,
    warmup,
    measuredAt: new Date().toISOString(),
    measurementMode: 'isolated-mock',
    workload: {
      promptChars: prompt.length,
      promptBytes: Buffer.byteLength(serializedPrompt),
      promptTokenEstimate: Math.ceil(prompt.length / 4),
      messageCount: 1,
      outputTokenLimit: 64,
    },
    cache: {
      state: warmup ? 'cold' : 'warm',
      promptCacheHit: !warmup,
      providerCacheHit: !warmup,
    },
    calls: {
      primaryModelCalls: 1,
      cadenceRepairCalls: repair ? 1 : 0,
      totalModelCalls: repair ? 2 : 1,
    },
    timings: {
      endToEndMs: finishedAt - startedAt,
      pennyPreProviderMs,
      providerRoundTripMs: primary.durationMs,
      promptEvaluationMs: primary.promptEvaluationMs,
      firstProviderEventMs: primary.firstEventAt - startedAt,
      firstVisibleTokenMs: primary.firstVisibleAt - startedAt,
      visibleGenerationMs: primary.lastVisibleAt - primary.firstVisibleAt,
      pennyPostProviderMs,
      pennyOverheadMs: pennyPreProviderMs + pennyPostProviderMs,
      cadenceRepairMs: repair?.durationMs || 0,
    },
    output: {
      visibleChars: primary.visibleText.length,
      visibleTokenEstimate: Math.ceil(primary.visibleText.length / 4),
      reasoningCharsObserved: primary.reasoningChars,
    },
    timingSources: {
      promptEvaluation: 'isolated-mock-provider-header',
      firstProviderEvent: 'sse-parser-clock',
      firstVisibleToken: 'visible-message-delta-clock',
    },
  };
}

function buildProfiles() {
  const shared = {
    provider: 'isolated-local-http-mock',
    transport: 'openai-compatible-sse',
    model: 'mock/penny-performance',
    hardwareAcceleration: { state: 'not-applicable', backend: 'mock' },
    projector: { state: 'not-applicable' },
    contextWindowTokens: 256,
    outputTokenLimit: 64,
    notes: [
      'Measures local HTTP/SSE and harness decomposition only.',
      'Does not measure real model, accelerator, projector, or Penny quality.',
    ],
  };
  return [
    {
      ...shared,
      id: 'mock-reasoning-observed',
      label: 'Mock SSE with hidden reasoning before visible text',
      reasoning: {
        capability: 'supported',
        requested: 'not-requested',
        effective: 'enabled',
        observed: 'reasoning-observed',
      },
    },
    {
      ...shared,
      id: 'mock-cadence-repair',
      label: 'Mock SSE with a distinct cadence-repair second call',
      reasoning: {
        capability: 'supported',
        requested: 'disabled',
        effective: 'disabled',
        observed: 'no-reasoning-observed',
      },
    },
  ];
}

async function buildIsolatedMockMatrix({ warmRuns = 5 } = {}) {
  const provider = createIsolatedMockProvider();
  const baseUrl = await provider.listen();
  const profiles = buildProfiles();
  const runs = [];
  try {
    for (const profile of profiles) {
      const reasoning = profile.id === 'mock-reasoning-observed' ? 'observed' : 'disabled';
      const cadenceRepair = profile.id === 'mock-cadence-repair';
      runs.push(await measureRun({
        baseUrl,
        profileId: profile.id,
        repetition: 0,
        warmup: true,
        reasoning,
        cadenceRepair,
      }));
      for (let repetition = 1; repetition <= warmRuns; repetition += 1) {
        runs.push(await measureRun({
          baseUrl,
          profileId: profile.id,
          repetition,
          warmup: false,
          reasoning,
          cadenceRepair,
        }));
      }
    }
  } finally {
    await provider.close();
  }
  const matrix = buildPerformanceMatrix({
    measurementPurpose: 'Isolated plumbing proof for the Penny performance-matrix contract.',
    profiles,
    runs,
    minWarmRuns: 3,
  });
  matrix.mockProvider = {
    ...provider.stats,
    processBoundary: 'same-process isolated localhost HTTP server',
    modelStateTouched: false,
  };
  for (const profile of profiles) {
    assertPerformanceClaim(matrix, {
      profileId: profile.id,
      scope: 'transport-plumbing-only',
    });
  }
  return matrix;
}

async function main() {
  const args = parseArgs();
  const matrix = await buildIsolatedMockMatrix({ warmRuns: args.warmRuns });
  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  process.stdout.write(`Saved Penny performance matrix to ${args.outputPath}\n`);
  process.stdout.write(`Profiles: ${matrix.profiles.length}; warm runs per profile: ${args.warmRuns}; live interactive claims: ${matrix.claimAudit.liveInteractiveClaimable}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.stack || error?.message || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  parseSseEvent,
  createIsolatedMockProvider,
  callMockProvider,
  measureRun,
  buildProfiles,
  buildIsolatedMockMatrix,
};
