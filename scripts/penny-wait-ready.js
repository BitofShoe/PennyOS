const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_POLL_MS = 500;

function parseArgs(argv = []) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = String(argv[i] || '');
    if (!raw.startsWith('--')) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next && !String(next).startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = '1';
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPennyReady({
  url = 'http://127.0.0.1:4317/api/penny/status',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
  fetchImpl = fetch,
} = {}) {
  const startedAt = Date.now();
  let lastError = '';
  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(2000, timeoutMs));
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await response.text();
      if (!response.ok) {
        lastError = `status ${response.status}: ${text.slice(0, 240)}`;
      } else {
        let parsed = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = {};
        }
        if (parsed && parsed.ok === true) {
          return {
            ok: true,
            url,
            waitedMs: Date.now() - startedAt,
            statusCode: response.status,
            body: parsed,
            error: '',
          };
        }
        lastError = `response did not report ok=true: ${text.slice(0, 240)}`;
      }
    } catch (error) {
      lastError = String(error?.message || error).trim();
    }
    await sleep(pollMs);
  }

  return {
    ok: false,
    url,
    waitedMs: Date.now() - startedAt,
    statusCode: 0,
    body: null,
    error: lastError || `Timed out waiting for ${url}`,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = String(args.url || 'http://127.0.0.1:4317/api/penny/status').trim();
  const timeoutMs = Math.max(1000, Number(args['timeout-ms'] || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const pollMs = Math.max(100, Number(args['poll-ms'] || DEFAULT_POLL_MS) || DEFAULT_POLL_MS);
  const result = await waitForPennyReady({ url, timeoutMs, pollMs });
  if (result.ok) {
    process.stdout.write(`Penny is ready at ${url} after ${result.waitedMs}ms.\n`);
    return;
  }
  process.stderr.write(`Penny readiness check failed for ${url} after ${result.waitedMs}ms: ${result.error}\n`);
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  waitForPennyReady,
};
