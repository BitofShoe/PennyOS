const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'sidecar-trials');
const FIXTURE_DIR = path.join(ROOT, 'fixtures', 'sidecar-trials');

function isoNow() {
  return new Date().toISOString();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function writeJson(filePath, payload) {
  const resolved = path.resolve(ROOT, filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return resolved;
}

function safeCurl(url) {
  try {
    const output = execFileSync('curl', ['--max-time', '1', '-fsS', url], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    });
    return { ok: true, sample: output.slice(0, 240) };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

function safeJsonCurl(url) {
  try {
    const output = execFileSync('curl', ['--max-time', '5', '-fsS', url], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 6500,
    });
    return {
      ok: true,
      sample: output.slice(0, 240),
      json: JSON.parse(output),
    };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

function requestQdrantJson({
  baseUrl = 'http://127.0.0.1:6333',
  pathSuffix = '/',
  method = 'GET',
  body,
} = {}) {
  const args = [
    '--max-time',
    '8',
    '-fsS',
    '-X',
    method,
    '-H',
    'Content-Type: application/json',
  ];
  if (body !== undefined) args.push('--data-binary', JSON.stringify(body));
  args.push(joinUrl(baseUrl, pathSuffix));
  try {
    const output = execFileSync('curl', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return {
      ok: true,
      sample: output.slice(0, 240),
      json: output.trim() ? JSON.parse(output) : null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      sample: err.stdout?.toString?.().slice(0, 240) || '',
    };
  }
}

function requestSpeachesJson({
  baseUrl = 'http://127.0.0.1:8000',
  pathSuffix = '/',
  method = 'GET',
  body,
  timeoutMs = 30000,
  execFile = execFileSync,
} = {}) {
  const maxTimeSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args = [
    '--max-time',
    String(maxTimeSeconds),
    '-fsS',
    '-X',
    method,
    '-H',
    'Content-Type: application/json',
  ];
  if (body !== undefined) args.push('--data-binary', JSON.stringify(body));
  args.push(joinUrl(baseUrl, pathSuffix));
  try {
    const output = execFile('curl', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs + 1000,
    });
    const text = String(output || '');
    let json = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch (_err) {
        json = null;
      }
    }
    return {
      ok: true,
      sample: text.slice(0, 240),
      json,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      sample: err.stdout?.toString?.().slice(0, 240) || '',
    };
  }
}

function requestOpenWebuiJson({
  baseUrl = 'http://127.0.0.1:3000',
  pathSuffix = '/',
  method = 'GET',
  body,
  headers = {},
  timeoutMs = 30000,
} = {}) {
  const maxTimeSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-openwebui-'));
  const bodyPath = path.join(tempDir, 'body.txt');
  const args = [
    '--max-time',
    String(maxTimeSeconds),
    '-sS',
    '-X',
    method,
    '-H',
    'Content-Type: application/json',
    '-o',
    bodyPath,
    '-w',
    '%{http_code}',
  ];
  for (const [key, value] of Object.entries(headers || {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      args.push('-H', `${key}: ${value}`);
    }
  }
  if (body !== undefined) args.push('--data-binary', JSON.stringify(body));
  args.push(joinUrl(baseUrl, pathSuffix));
  try {
    const output = execFileSync('curl', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs + 1000,
    }).trim();
    const statusCode = Number(output);
    const text = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : '';
    let json = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch (_err) {
        json = null;
      }
    }
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      sample: text.slice(0, 240),
      json,
    };
  } catch (err) {
    return {
      ok: false,
      status_code: 0,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      sample: fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8').slice(0, 240) : '',
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_err) {
      // Open WebUI probe bodies are disposable live-check samples.
    }
  }
}

function requestSpeachesBinary({
  baseUrl = 'http://127.0.0.1:8000',
  pathSuffix = '/',
  method = 'POST',
  body,
  timeoutMs = 60000,
} = {}) {
  const maxTimeSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-speaches-'));
  const outputPath = path.join(tempDir, 'speech-output.bin');
  const headerPath = path.join(tempDir, 'headers.txt');
  const args = [
    '--max-time',
    String(maxTimeSeconds),
    '-fsS',
    '-X',
    method,
    '-H',
    'Content-Type: application/json',
    '--dump-header',
    headerPath,
    '--output',
    outputPath,
  ];
  if (body !== undefined) args.push('--data-binary', JSON.stringify(body));
  args.push(joinUrl(baseUrl, pathSuffix));
  try {
    execFileSync('curl', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs + 1000,
    });
    const headerText = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
    const contentType = headerText.match(/^content-type:\s*([^\r\n]+)/im)?.[1]?.trim() || null;
    return {
      ok: true,
      bytes: fs.statSync(outputPath).size,
      contentType,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      bytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_err) {
      // The generated fixture audio is intentionally disposable.
    }
  }
}

function dockerNames() {
  try {
    const output = execFileSync('docker', ['ps', '--format', '{{.Names}}'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    });
    return output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  } catch (_err) {
    return [];
  }
}

function powershellHttpProbe(url) {
  try {
    const script = `$ProgressPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri '${url.replace(/'/g, "''")}'; Write-Output $r.StatusCode } catch { exit 7 }`;
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500,
    }).trim();
    return { ok: /^2\d\d$/.test(output), status_code: output };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

function safeHttpStatusCurl(url, { timeoutSeconds = 2 } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-http-status-'));
  const bodyPath = path.join(tempDir, 'body.txt');
  try {
    const output = execFileSync('curl', [
      '--max-time',
      String(timeoutSeconds),
      '-sS',
      '-o',
      bodyPath,
      '-w',
      '%{http_code}',
      url,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: (timeoutSeconds * 1000) + 1000,
    }).trim();
    const statusCode = Number(output);
    const sample = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8').slice(0, 240) : '';
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      sample,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      status_code: 0,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_err) {
      // Probe bodies are disposable endpoint samples, not persisted data.
    }
  }
}

function powershellHttpStatusProbe(url) {
  try {
    const escapedUrl = url.replace(/'/g, "''");
    const script = `$ProgressPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri '${escapedUrl}'; Write-Output ('STATUS=' + [int]$r.StatusCode); if ($null -ne $r.Content) { Write-Output $r.Content } } catch { if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { Write-Output ('STATUS=' + [int]$_.Exception.Response.StatusCode); exit 0 }; Write-Output ('ERROR=' + $_.Exception.Message); exit 7 }`;
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 3500,
    }).trim();
    const statusCode = Number(output.match(/STATUS=(\d+)/)?.[1] || 0);
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      sample: output.replace(/^STATUS=\d+\s*/m, '').slice(0, 240),
    };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr?.toString?.().trim() || err.code || err.message,
      status_code: 0,
    };
  }
}

function statusIsAuthBlocked(response = {}) {
  return [401, 403].includes(Number(response.status_code));
}

function probeReadOnlyHttpEndpoints({
  urls = [],
  dockerPatterns = [],
  envNames = [],
  run = false,
  requestStatus = safeHttpStatusCurl,
  windowsRequestStatus = powershellHttpStatusProbe,
} = {}) {
  const details = [];
  const envHits = [];
  for (const name of envNames) {
    if (process.env[name]) envHits.push({ name, value_present: true });
  }
  const containers = run ? dockerNames() : [];
  const dockerHits = containers.filter((name) => dockerPatterns.some((pattern) => pattern.test(name)));
  let found = false;
  let blockedByAuth = false;
  for (const url of urls) {
    if (!run) {
      details.push({ url, checked: false, reason: 'live probe not requested' });
      continue;
    }
    const wsl = requestStatus(url);
    const windows = windowsRequestStatus(url);
    const ok = wsl.ok || windows.ok;
    found = found || ok;
    blockedByAuth = blockedByAuth || statusIsAuthBlocked(wsl) || statusIsAuthBlocked(windows);
    details.push({ url, checked: true, wsl, windows });
  }
  return {
    ran: run,
    found,
    blocked_by_auth: !found && blockedByAuth,
    details,
    docker_containers: dockerHits,
    env_hits: envHits,
    read_only_endpoints_only: true,
    streams_requested: false,
    camera_history_requested: false,
    home_control_action: false,
    service_call_requested: false,
  };
}

function probeEndpoints({ urls = [], dockerPatterns = [], envNames = [], run = false } = {}) {
  const details = [];
  const envHits = [];
  for (const name of envNames) {
    if (process.env[name]) envHits.push({ name, value_present: true });
  }
  const containers = run ? dockerNames() : [];
  const dockerHits = containers.filter((name) => dockerPatterns.some((pattern) => pattern.test(name)));
  let found = false;
  for (const url of urls) {
    if (!run) {
      details.push({ url, checked: false, reason: 'live probe not requested' });
      continue;
    }
    const wsl = safeCurl(url);
    const windows = powershellHttpProbe(url);
    const ok = wsl.ok || windows.ok;
    found = found || ok;
    details.push({ url, checked: true, wsl, windows });
  }
  return {
    ran: run,
    found,
    details,
    docker_containers: dockerHits,
    env_hits: envHits,
  };
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function joinUrl(baseUrl, suffix) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}${suffix}`;
}

function firstSuccessfulProbeBaseUrl(details = [], suffix = '') {
  const found = details.find((detail) => detail?.wsl?.ok || detail?.windows?.ok);
  const url = found?.url || '';
  if (!url) return '';
  return suffix && url.endsWith(suffix) ? url.slice(0, -suffix.length) : url;
}

function normalizeSearxngJsonSources(payload = {}, { limit = 5 } = {}) {
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results
    .map((result) => {
      const title = String(result?.title || '').trim();
      const url = String(result?.url || '').trim();
      const snippet = String(result?.content || result?.snippet || '').trim();
      if (!title || !url) return null;
      return {
        title,
        url,
        source_type: 'web',
        confidence: 'unknown',
        ...(snippet ? { snippet: snippet.slice(0, 500) } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function probeSearxngJson({ baseUrls = [], query = 'penny-local-sidecar', run = false } = {}) {
  const details = [];
  if (!run) return { ran: false, found: false, query_ran: false, sources: [], details };
  for (const baseUrl of baseUrls) {
    const url = joinUrl(baseUrl, `/search?q=${encodeURIComponent(query)}&format=json`);
    const wsl = safeJsonCurl(url);
    const sources = wsl.ok ? normalizeSearxngJsonSources(wsl.json) : [];
    const found = wsl.ok && sources.length > 0;
    details.push({
      url,
      checked: true,
      wsl: wsl.ok
        ? { ok: true, sample: wsl.sample, parsed_sources: sources.length }
        : { ok: false, error: wsl.error },
    });
    if (found) return { ran: true, found: true, query_ran: true, sources, details };
  }
  return { ran: true, found: false, query_ran: false, sources: [], details };
}

function buildResearchDigest({
  fixture,
  liveJsonSources = [],
  liveJsonOk = false,
  jsonFormatBlocked = false,
} = {}) {
  if (liveJsonOk && liveJsonSources.length > 0) {
    return {
      query: fixture.query,
      mode: 'live_json',
      sources: liveJsonSources,
      summary: `Live SearXNG JSON returned ${liveJsonSources.length} reviewable source(s); claims remain unverified until review.`,
      claims: [{
        claim: 'Live SearXNG JSON returned reviewable sources for the toy sidecar query.',
        source_indexes: [0],
        verified: false,
        confidence: 'unknown',
      }],
      unknowns: [
        'Live search result relevance and correctness still require review before any durable use.',
      ],
      memory_write: false,
      requires_review: true,
    };
  }
  return {
    query: fixture.query,
    mode: jsonFormatBlocked ? 'live' : 'fixture',
    sources: fixture.sources,
    summary: 'Fixture digest keeps sources separate from conclusions and leaves adoption decisions review-only.',
    claims: fixture.claims,
    unknowns: jsonFormatBlocked
      ? ['Whether JSON output is enabled remains blocked/unknown in the disposable SearXNG container; HTML search smoke returned 200.']
      : fixture.unknowns,
    memory_write: false,
    requires_review: true,
  };
}

function n8nToyWorkflow() {
  return {
    id: 'penny-sidecar-local-toy-flow',
    name: 'Penny Sidecar Local Toy Flow',
    active: false,
    nodes: [
      {
        parameters: {},
        id: 'manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [240, 300],
      },
      {
        parameters: {
          assignments: {
            assignments: [{
              id: 'toy-summary',
              name: 'summary',
              value: 'local-only sidecar workflow object imported for review',
              type: 'string',
            }],
          },
          options: {},
        },
        id: 'set-review-summary',
        name: 'Set Review Summary',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [480, 300],
      },
    ],
    connections: {
      'Manual Trigger': {
        main: [[{ node: 'Set Review Summary', type: 'main', index: 0 }]],
      },
    },
    settings: { executionOrder: 'v1' },
  };
}

function dockerCommand(args = []) {
  return execFileSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  });
}

function runN8nLiveWorkflowTrial({
  run = false,
  found = false,
  containerName = 'penny-n8n-trial',
  docker = dockerCommand,
} = {}) {
  const workflow = n8nToyWorkflow();
  const result = {
    ran: Boolean(run && found),
    found: Boolean(found),
    mode: 'docker_cli_import',
    container_name: containerName,
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    workflow_object_created: false,
    workflow_imported: false,
    workflow_export_checked: false,
    local_only: true,
    dry_run: false,
    credentials_used: false,
    webhook_used: false,
    schedule_used: false,
    email_used: false,
    cloud_used: false,
    public_action: false,
    home_or_system_action: false,
    memory_write: false,
    errors: [],
  };
  if (!run) {
    result.skipped_reason = 'n8n workflow trial not requested';
    return result;
  }
  if (!found) {
    result.skipped_reason = 'n8n service not found';
    return result;
  }

  const localInput = path.join(os.tmpdir(), 'penny-sidecar-n8n-workflow.json');
  const remoteInput = '/tmp/penny-sidecar-n8n-workflow.json';
  const remoteExport = '/tmp/penny-sidecar-n8n-workflows-export.json';
  fs.writeFileSync(localInput, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  try {
    docker(['cp', localInput, `${containerName}:${remoteInput}`]);
    const importOutput = docker(['exec', containerName, 'n8n', 'import:workflow', '--input', remoteInput]);
    result.workflow_imported = /import/i.test(String(importOutput || '')) || String(importOutput || '').trim() === '';
    result.workflow_object_created = result.workflow_imported;
    try {
      docker(['exec', containerName, 'n8n', 'export:workflow', '--all', '--output', remoteExport]);
      result.workflow_export_checked = true;
    } catch (err) {
      result.errors.push(`workflow export check failed: ${err.stderr?.toString?.().trim() || err.message || err}`);
    }
  } catch (err) {
    result.blocked_by = 'n8n_cli_import_failed';
    result.errors.push(err.stderr?.toString?.().trim() || err.stdout?.toString?.().trim() || err.message || String(err));
  } finally {
    try {
      fs.rmSync(localInput, { force: true });
    } catch (_err) {
      // Local temp cleanup is separate from the disposable n8n workflow proof.
    }
  }
  result.ok = result.workflow_object_created
    && result.workflow_imported
    && result.workflow_export_checked
    && result.errors.length === 0;
  return result;
}

function responseContainsModel(payload = {}, modelId = '') {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  return rows.some((row) => String(row?.id || row?.name || '') === modelId);
}

function chatResponseText(payload = {}) {
  return String(
    payload?.choices?.[0]?.message?.content
    || payload?.choices?.[0]?.delta?.content
    || payload?.message?.content
    || payload?.content
    || '',
  );
}

function sleepMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function mockChatRequestCount(statsResponse = {}) {
  return Number(statsResponse?.json?.chat_requests || 0);
}

function runOpenWebuiMockModelTrial({
  run = false,
  found = false,
  openWebuiBaseUrl = 'http://127.0.0.1:3000',
  mockOpenAiBaseUrl = 'http://127.0.0.1:18081/v1',
  openWebuiAuthToken = '',
  modelId = 'penny-sidecar-toy-model',
  requestJson = requestOpenWebuiJson,
} = {}) {
  const toyPrompt = 'Reply with: Penny sidecar mock route ok.';
  const openWebuiHeaders = openWebuiAuthToken
    ? { Authorization: `Bearer ${openWebuiAuthToken}` }
    : {};
  const result = {
    ran: Boolean(run && found),
    found: Boolean(found),
    openwebui_base_url: openWebuiBaseUrl,
    mock_openai_base_url: mockOpenAiBaseUrl,
    mock_model_id: modelId,
    openwebui_auth_used: Boolean(openWebuiAuthToken),
    direct_mock_models_ran: false,
    direct_mock_chat_ran: false,
    openwebui_models_checked: false,
    openwebui_model_visible: false,
    openwebui_chat_routed: false,
    openwebui_chat_reached_mock: false,
    mock_chat_requests_before_openwebui: null,
    mock_chat_requests_after_openwebui: null,
    toy_prompt: toyPrompt,
    toy_response_seen: false,
    blocked_by_auth: false,
    mock_endpoint_used: true,
    live_lmstudio_used: false,
    penny_ui_replaced: false,
    memory_imported: false,
    private_runtime_artifacts_uploaded: false,
    memory_write: false,
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    errors: [],
  };
  if (!run) {
    result.skipped_reason = 'Open WebUI mock model trial not requested';
    return result;
  }
  if (!found) {
    result.skipped_reason = 'Open WebUI service not found';
    return result;
  }

  const mockModels = requestJson({
    baseUrl: mockOpenAiBaseUrl,
    pathSuffix: '/models',
    method: 'GET',
    timeoutMs: 15000,
  });
  if (mockModels.ok) {
    result.direct_mock_models_ran = true;
    result.direct_mock_model_visible = responseContainsModel(mockModels.json, modelId);
  } else {
    result.errors.push(`mock /models failed: ${mockModels.error || mockModels.sample || mockModels.status_code || 'unknown response'}`);
  }

  const mockChat = requestJson({
    baseUrl: mockOpenAiBaseUrl,
    pathSuffix: '/chat/completions',
    method: 'POST',
    body: {
      model: modelId,
      messages: [{ role: 'user', content: toyPrompt }],
      stream: false,
    },
    timeoutMs: 15000,
  });
  if (mockChat.ok) result.direct_mock_chat_ran = true;
  else result.errors.push(`mock /chat/completions failed: ${mockChat.error || mockChat.sample || mockChat.status_code || 'unknown response'}`);

  const statsBefore = requestJson({
    baseUrl: mockOpenAiBaseUrl,
    pathSuffix: '/stats',
    method: 'GET',
    timeoutMs: 5000,
  });
  if (statsBefore.ok) result.mock_chat_requests_before_openwebui = mockChatRequestCount(statsBefore);

  const openWebuiModels = requestJson({
    baseUrl: openWebuiBaseUrl,
    pathSuffix: '/api/models',
    method: 'GET',
    headers: openWebuiHeaders,
    timeoutMs: 30000,
  });
  if (openWebuiModels.ok) {
    result.openwebui_models_checked = true;
    result.openwebui_model_visible = responseContainsModel(openWebuiModels.json, modelId);
  } else if ([401, 403].includes(Number(openWebuiModels.status_code))) {
    result.blocked_by_auth = true;
    result.errors.push(`Open WebUI /api/models blocked by auth: ${openWebuiModels.status_code}`);
  } else {
    result.errors.push(`Open WebUI /api/models failed: ${openWebuiModels.error || openWebuiModels.sample || openWebuiModels.status_code || 'unknown response'}`);
  }

  const openWebuiChat = requestJson({
    baseUrl: openWebuiBaseUrl,
    pathSuffix: '/api/chat/completions',
    method: 'POST',
    headers: openWebuiHeaders,
    body: {
      model: modelId,
      messages: [{ role: 'user', content: toyPrompt }],
      stream: false,
      chat_id: 'penny-sidecar-openwebui-mock-chat',
      id: 'penny-sidecar-openwebui-mock-message',
      session_id: 'penny-sidecar-openwebui-mock-session',
    },
    timeoutMs: 30000,
  });
  if (openWebuiChat.ok) {
    result.openwebui_toy_response = chatResponseText(openWebuiChat.json).slice(0, 500);
    result.toy_response_seen = /Penny sidecar mock route ok/i.test(result.openwebui_toy_response)
      || /mock endpoint reply/i.test(result.openwebui_toy_response);
    if (result.mock_chat_requests_before_openwebui !== null) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const statsAfter = requestJson({
          baseUrl: mockOpenAiBaseUrl,
          pathSuffix: '/stats',
          method: 'GET',
          timeoutMs: 5000,
        });
        if (statsAfter.ok) {
          result.mock_chat_requests_after_openwebui = mockChatRequestCount(statsAfter);
          if (result.mock_chat_requests_after_openwebui > result.mock_chat_requests_before_openwebui) {
            result.openwebui_chat_reached_mock = true;
            break;
          }
        }
        sleepMs(500);
      }
    }
    result.openwebui_chat_routed = result.toy_response_seen
      || result.openwebui_chat_reached_mock
      || openWebuiChat.json?.status === true;
  } else if ([401, 403].includes(Number(openWebuiChat.status_code))) {
    result.blocked_by_auth = true;
    result.errors.push(`Open WebUI /api/chat/completions blocked by auth: ${openWebuiChat.status_code}`);
  } else {
    result.errors.push(`Open WebUI /api/chat/completions failed: ${openWebuiChat.error || openWebuiChat.sample || openWebuiChat.status_code || 'unknown response'}`);
  }

  result.ok = result.direct_mock_models_ran
    && result.direct_mock_chat_ran
    && result.openwebui_models_checked
    && result.openwebui_model_visible
    && result.openwebui_chat_routed
    && (result.toy_response_seen || result.openwebui_chat_reached_mock)
    && result.errors.length === 0;
  if (!result.ok && !result.blocked_by_auth && result.errors.length > 0) result.blocked_by = 'openwebui_mock_model_trial_failed';
  return result;
}

function labCockpitTrial({
  liveProbe = false,
  openwebuiMockModelTrial = false,
  openWebuiBaseUrl = '',
  mockOpenAiBaseUrl = '',
  openWebuiAuthToken = '',
} = {}) {
  const openWebuiBaseUrls = uniqueStrings([
    openWebuiBaseUrl,
    process.env.OPEN_WEBUI_BASE_URL,
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
  ]);
  const probe = probeEndpoints({
    run: liveProbe,
    urls: [
      ...openWebuiBaseUrls.map((baseUrl) => joinUrl(baseUrl, '/health')),
      'http://127.0.0.1:11434/api/tags',
    ],
    dockerPatterns: [/open[-_]?webui/i, /anything[-_]?llm/i, /lobe/i, /librechat/i],
    envNames: ['OPEN_WEBUI_BASE_URL', 'ANYTHINGLLM_BASE_URL', 'LOBE_CHAT_BASE_URL', 'LIBRECHAT_BASE_URL'],
  });
  const openWebuiLiveBaseUrl = firstSuccessfulProbeBaseUrl(probe.details, '/health') || openWebuiBaseUrls[0];
  const mockBaseUrl = mockOpenAiBaseUrl || process.env.PENNY_MOCK_OPENAI_BASE_URL || 'http://127.0.0.1:18081/v1';
  const openwebuiMockModel = runOpenWebuiMockModelTrial({
    run: liveProbe && openwebuiMockModelTrial,
    found: probe.found,
    openWebuiBaseUrl: openWebuiLiveBaseUrl,
    mockOpenAiBaseUrl: mockBaseUrl,
    openWebuiAuthToken,
  });
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-2-lab-cockpit.v1',
    section_id: 2,
    section_title: 'Local lab cockpit',
    primary_app: 'Open WebUI',
    candidate_apps: ['Open WebUI', 'AnythingLLM', 'Lobe Chat', 'LibreChat'],
    status: probe.found ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      ...probe,
      openwebui_mock_model_trial: openwebuiMockModel,
    },
    trial: {
      mode: probe.found ? 'live' : 'fixture',
      endpoint_kind: openwebuiMockModel.ok ? 'openwebui_to_mock_openai_compatible' : probe.found ? 'local_openai_compatible' : 'mock',
      prompt_kind: 'non_private_toy_prompt',
      model_picker_checked: true,
      rag_visibility_checked: true,
      artifact_panel_pattern_checked: true,
      per_chat_provider_configuration_checked: true,
      toy_prompt: 'Summarize why local lab cockpits must stay sidecars.',
      toy_response: 'Use the lab for model and RAG experiments; Penny remains the companion runtime owner.',
    },
    patterns_to_steal: [
      'model picker ergonomics',
      'tool/RAG visibility',
      'artifact panels',
      'per-chat/provider configuration',
      'quick local experiments that do not mutate the main app',
    ],
    must_remain_sidecar: true,
    penny_replacement: false,
    memory_imported: false,
    memory_write: false,
    private_runtime_artifacts_uploaded: false,
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    recommended_next_live_command: `OPEN_WEBUI_BASE_URL=${openWebuiLiveBaseUrl} PENNY_MOCK_OPENAI_BASE_URL=${mockBaseUrl} npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --openwebui-mock-model-trial --openwebui-base-url ${openWebuiLiveBaseUrl} --mock-openai-base-url ${mockBaseUrl}`,
  };
}

function homeCameraTrial({
  liveProbe = false,
  frigateBaseUrl = '',
  homeAssistantBaseUrl = '',
  readOnlyProbe = probeReadOnlyHttpEndpoints,
} = {}) {
  const frigateBaseUrls = uniqueStrings([
    frigateBaseUrl,
    process.env.FRIGATE_URL,
    'http://127.0.0.1:5000',
    'http://127.0.0.1:8971',
  ]);
  const homeAssistantBaseUrls = uniqueStrings([
    homeAssistantBaseUrl,
    process.env.HOME_ASSISTANT_URL,
    'http://127.0.0.1:8123',
  ]);
  const frigateProbe = readOnlyProbe({
    run: liveProbe,
    urls: frigateBaseUrls.map((baseUrl) => joinUrl(baseUrl, '/api/version')),
    dockerPatterns: [/frigate/i],
    envNames: ['FRIGATE_URL'],
  });
  const homeAssistantProbe = readOnlyProbe({
    run: liveProbe,
    urls: homeAssistantBaseUrls.map((baseUrl) => joinUrl(baseUrl, '/api/')),
    dockerPatterns: [/home[-_]?assistant/i],
    envNames: ['HOME_ASSISTANT_URL'],
  });
  const events = readJson('fixtures/sidecar-trials/frigate-events.fixture.json').events;
  const state = readJson('fixtures/sidecar-trials/home-assistant-state.fixture.json');
  const sourceLabels = [...new Set(events.map((event) => event.camera).concat(state.entities.map((entity) => entity.entity_id)))];
  const liveFound = frigateProbe.found || homeAssistantProbe.found;
  const primaryApp = frigateProbe.found
    ? 'Frigate version probe'
    : homeAssistantProbe.found
      ? 'Home Assistant health probe'
      : 'Frigate/Home Assistant fixture harness';
  const preferredBaseUrl = homeAssistantProbe.found ? homeAssistantBaseUrls[0] : frigateBaseUrls[0];
  const preferredFlag = homeAssistantProbe.found ? '--home-assistant-base-url' : '--frigate-base-url';
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-3-home-camera.v1',
    section_id: 3,
    section_title: 'Home and camera/event sidecars',
    primary_app: primaryApp,
    candidate_apps: ['Frigate', 'Home Assistant'],
    status: liveFound ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      frigate: {
        ran: frigateProbe.ran,
        found: frigateProbe.found,
        blocked_by_auth: frigateProbe.blocked_by_auth,
        details: frigateProbe.details,
        read_only_endpoints_only: frigateProbe.read_only_endpoints_only,
        streams_requested: frigateProbe.streams_requested,
        camera_history_requested: frigateProbe.camera_history_requested,
        home_control_action: frigateProbe.home_control_action,
      },
      home_assistant: {
        ran: homeAssistantProbe.ran,
        found: homeAssistantProbe.found,
        blocked_by_auth: homeAssistantProbe.blocked_by_auth,
        details: homeAssistantProbe.details,
        read_only_endpoints_only: homeAssistantProbe.read_only_endpoints_only,
        streams_requested: homeAssistantProbe.streams_requested,
        camera_history_requested: homeAssistantProbe.camera_history_requested,
        home_control_action: homeAssistantProbe.home_control_action,
      },
    },
    event_summary_card: {
      source: 'fixture',
      read_only: true,
      summary: 'Fixture events show one driveway package drop and one backyard animal detection; no actions are taken.',
      events: events.map((event) => ({
        event_id: event.event_id,
        source_label: event.camera,
        label: event.label,
        confidence: event.confidence,
        observed_at: event.observed_at,
      })),
      source_labels: sourceLabels,
      home_control_action: false,
      camera_history_persisted: false,
      ambient_capture: false,
      memory_write: false,
      requires_user_review: true,
    },
    patterns_to_steal: [
      'source-grounded event summaries',
      'read-only home status cards',
      'confirmation before action',
      'source labels',
    ],
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    recommended_next_live_command: `${homeAssistantProbe.found ? 'HOME_ASSISTANT_URL' : 'FRIGATE_URL'}=${preferredBaseUrl} npm run penny:sidecar:home-camera -- --fixture --live-probe ${preferredFlag} ${preferredBaseUrl}`,
  };
}

function workflowTrial({
  liveProbe = false,
  n8nWorkflowTrial = false,
  n8nContainerName = '',
  n8nBaseUrl = '',
} = {}) {
  const n8nBaseUrls = uniqueStrings([
    n8nBaseUrl,
    process.env.N8N_BASE_URL,
    'http://127.0.0.1:5678',
  ]);
  const n8nProbe = probeEndpoints({
    run: liveProbe,
    urls: n8nBaseUrls.flatMap((baseUrl) => [
      joinUrl(baseUrl, '/healthz'),
      joinUrl(baseUrl, '/rest/settings'),
    ]),
    dockerPatterns: [/n8n/i],
    envNames: ['N8N_BASE_URL'],
  });
  const windmillProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:8000/api/version'],
    dockerPatterns: [/windmill/i],
    envNames: ['WINDMILL_BASE_URL'],
  });
  const activepiecesProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:8080/api/v1/flags'],
    dockerPatterns: [/activepieces/i],
    envNames: ['ACTIVEPIECES_BASE_URL'],
  });
  const fixture = readText('fixtures/sidecar-trials/workflow-input.fixture.txt').trim();
  const classification = /invoice|receipt|deadline/i.test(fixture) ? 'reviewable_admin_note' : 'general_note';
  const n8nContainer = n8nContainerName || process.env.N8N_CONTAINER_NAME || 'penny-n8n-trial';
  const n8nLiveWorkflowTrial = runN8nLiveWorkflowTrial({
    run: liveProbe && n8nWorkflowTrial,
    found: n8nProbe.found,
    containerName: n8nContainer,
  });
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-4-workflow.v1',
    section_id: 4,
    section_title: 'Workflow automation sidecars',
    primary_app: 'n8n-style toy flow',
    candidate_apps: ['n8n', 'Windmill', 'Activepieces'],
    status: (n8nProbe.found || windmillProbe.found || activepiecesProbe.found) ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      n8n: { ran: n8nProbe.ran, found: n8nProbe.found, details: n8nProbe.details },
      n8n_live_workflow_trial: n8nLiveWorkflowTrial,
      windmill: { ran: windmillProbe.ran, found: windmillProbe.found, details: windmillProbe.details },
      activepieces: { ran: activepiecesProbe.ran, found: activepiecesProbe.found, details: activepiecesProbe.details },
    },
    toy_flow: {
      dry_run: true,
      local_only: true,
      input_kind: 'fixture_text_payload',
      output_kind: 'structured_summary',
      email_used: false,
      webhook_used: false,
      cloud_used: false,
      public_action: false,
      home_or_system_action: false,
      cron_or_schedule: false,
      side_effect_labels: ['stdout_json', 'artifact_out_only_when_declared'],
    },
    summary: {
      classification,
      structured_fields: {
        title: 'Toy local workflow summary',
        needs_review: true,
        extracted_topic: 'local-only sidecar dry run',
      },
    },
    patterns_to_steal: [
      'reviewable action queues',
      'structured output contracts',
      'dry-run mode',
      'per-tool side-effect labels',
    ],
    memory_write: false,
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    recommended_next_live_command: `N8N_BASE_URL=${n8nBaseUrls[0]} N8N_CONTAINER_NAME=${n8nContainer} npm run penny:sidecar:workflow -- --fixture --live-probe --n8n-workflow-trial --n8n-base-url ${n8nBaseUrls[0]} --n8n-container-name ${n8nContainer}`,
  };
}

function researchTrial({ liveProbe = false, searxngBaseUrl = '' } = {}) {
  const searxngBaseUrls = uniqueStrings([
    searxngBaseUrl,
    process.env.SEARXNG_URL,
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8888',
  ]);
  const probe = probeEndpoints({
    run: liveProbe,
    urls: searxngBaseUrls.flatMap((baseUrl) => [
      joinUrl(baseUrl, '/search?q=penny-local-sidecar&format=json'),
      joinUrl(baseUrl, '/search?q=penny-local-sidecar'),
    ]),
    dockerPatterns: [/searxng/i, /perplexica/i, /morphic/i],
    envNames: ['SEARXNG_URL', 'PERPLEXICA_URL', 'MORPHIC_URL'],
  });
  const fixture = readJson('fixtures/sidecar-trials/search-results.fixture.json');
  const jsonProbe = probeSearxngJson({
    baseUrls: searxngBaseUrls,
    query: 'penny-local-sidecar',
    run: liveProbe,
  });
  const digest = buildResearchDigest({
    fixture,
    liveJsonSources: jsonProbe.sources,
    liveJsonOk: jsonProbe.found,
    jsonFormatBlocked: probe.found && !jsonProbe.found,
  });
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-5-research.v1',
    section_id: 5,
    section_title: 'Local research/search sidecars',
    primary_app: 'SearXNG',
    candidate_apps: ['SearXNG', 'Local Deep Research', 'Perplexica', 'Morphic'],
    status: probe.found ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      ran: probe.ran,
      found: probe.found,
      query_ran: probe.found,
      details: probe.details,
      json_output: jsonProbe,
    },
    digest,
    patterns_to_steal: [
      'citation-first summaries',
      'source lists separated from conclusions',
      'unknown/not verified as normal output',
      'small digests reviewed before durable save',
    ],
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    recommended_next_live_command: 'docker run --rm -p 18089:8080 -v "$PWD/fixtures/sidecar-trials/searxng-json-settings.yml:/etc/searxng/settings.yml:ro" searxng/searxng:latest && SEARXNG_URL=http://127.0.0.1:18089 npm run penny:sidecar:research -- --fixture --live-probe --searxng-base-url http://127.0.0.1:18089',
  };
}

function qdrantFixturePoints() {
  return [
    {
      id: 1,
      vector: [0.92, 0.11, 0.22, 0.05],
      payload: {
        doc_id: 'penny-sidecar-memory-boundary',
        title: 'penny-sidecar-memory-boundary.md',
        chunk_id: 'chunk-1',
        source: 'fixture',
        text: 'Document sidecar outputs are review artifacts with citations/provenance. They are not Penny memory or PromptTruth.',
        private_docs_used: false,
        penny_memory_imported: false,
        memory_write: false,
      },
    },
    {
      id: 2,
      vector: [0.77, 0.31, 0.41, 0.09],
      payload: {
        doc_id: 'penny-sidecar-rag-patterns',
        title: 'penny-sidecar-rag-patterns.md',
        chunk_id: 'chunk-1',
        source: 'fixture',
        text: 'A tiny local RAG sandbox should separate document says from model infers before any real document workspace exists.',
        private_docs_used: false,
        penny_memory_imported: false,
        memory_write: false,
      },
    },
  ];
}

function qdrantCollectionName() {
  return `penny_sidecar_trial_${Date.now()}`;
}

function qdrantStepFailed(step, response = {}) {
  const error = response.error || response.sample || 'unknown qdrant response';
  return `${step} failed: ${error}`;
}

function runQdrantLiveWriteTrial({
  run = false,
  found = false,
  baseUrl = 'http://127.0.0.1:6333',
  collectionName = qdrantCollectionName(),
  requestJson = requestQdrantJson,
} = {}) {
  const result = {
    ran: Boolean(run && found),
    found: Boolean(found),
    base_url: baseUrl,
    collection_name: collectionName,
    collection_created: false,
    vectors_upserted: 0,
    search_ran: false,
    search_result_count: 0,
    collection_deleted: false,
    private_docs_used: false,
    penny_memory_imported: false,
    memory_write: false,
    errors: [],
  };
  if (!run) {
    result.skipped_reason = 'qdrant write trial not requested';
    return result;
  }
  if (!found) {
    result.skipped_reason = 'qdrant service not found';
    return result;
  }

  const collectionPath = `/collections/${encodeURIComponent(collectionName)}`;
  try {
    const create = requestJson({
      baseUrl,
      pathSuffix: collectionPath,
      method: 'PUT',
      body: { vectors: { size: 4, distance: 'Cosine' } },
    });
    if (!create.ok) throw new Error(qdrantStepFailed('collection create', create));
    result.collection_created = true;

    const points = qdrantFixturePoints();
    const upsert = requestJson({
      baseUrl,
      pathSuffix: `${collectionPath}/points?wait=true`,
      method: 'PUT',
      body: { points },
    });
    if (!upsert.ok) throw new Error(qdrantStepFailed('point upsert', upsert));
    result.vectors_upserted = points.length;

    const search = requestJson({
      baseUrl,
      pathSuffix: `${collectionPath}/points/search`,
      method: 'POST',
      body: {
        vector: [0.9, 0.1, 0.2, 0.05],
        limit: 2,
        with_payload: true,
      },
    });
    if (!search.ok) throw new Error(qdrantStepFailed('vector search', search));
    result.search_ran = true;
    const searchResult = search.json?.result;
    result.search_result_count = Array.isArray(searchResult)
      ? searchResult.length
      : Array.isArray(searchResult?.points)
        ? searchResult.points.length
        : 0;
  } catch (err) {
    result.errors.push(err.message || String(err));
    result.blocked_by = 'qdrant_request_failed';
  } finally {
    if (result.collection_created) {
      const deleted = requestJson({
        baseUrl,
        pathSuffix: collectionPath,
        method: 'DELETE',
      });
      if (deleted.ok) result.collection_deleted = true;
      else result.errors.push(qdrantStepFailed('collection delete', deleted));
    }
  }
  result.ok = result.collection_created
    && result.vectors_upserted > 0
    && result.search_ran
    && result.collection_deleted
    && result.errors.length === 0;
  return result;
}

function ragTrial({ liveProbe = false, qdrantWriteTrial = false, qdrantBaseUrl = '' } = {}) {
  const qdrantBaseUrls = uniqueStrings([
    qdrantBaseUrl,
    process.env.QDRANT_URL,
    'http://127.0.0.1:6333',
  ]);
  const qdrantProbe = probeEndpoints({
    run: liveProbe,
    urls: qdrantBaseUrls.map((baseUrl) => joinUrl(baseUrl, '/collections')),
    dockerPatterns: [/qdrant/i],
    envNames: ['QDRANT_URL'],
  });
  const paperlessProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:8000/api/'],
    dockerPatterns: [/paperless/i],
    envNames: ['PAPERLESS_URL'],
  });
  const question = readJson('fixtures/sidecar-trials/rag-questions.fixture.json').questions[0];
  const docs = fs.readdirSync(path.join(FIXTURE_DIR, 'rag-docs'))
    .filter((file) => /\.(md|txt)$/i.test(file))
    .map((file) => ({ file, text: fs.readFileSync(path.join(FIXTURE_DIR, 'rag-docs', file), 'utf8') }));
  const matchingDoc = docs.find((doc) => doc.text.toLowerCase().includes('review-gated')) || docs[0];
  const snippet = matchingDoc.text.split(/\r?\n/).find((line) => line.trim() && !line.startsWith('#')).trim();
  const qdrantLiveBaseUrl = firstSuccessfulProbeBaseUrl(qdrantProbe.details, '/collections') || qdrantBaseUrls[0];
  const qdrantLiveWriteTrial = runQdrantLiveWriteTrial({
    run: liveProbe && qdrantWriteTrial,
    found: qdrantProbe.found,
    baseUrl: qdrantLiveBaseUrl,
  });
  const qdrantLiveCommand = `QDRANT_URL=${qdrantLiveBaseUrl} npm run penny:sidecar:rag -- --fixture --live-probe --qdrant-write-trial --qdrant-base-url ${qdrantLiveBaseUrl}`;
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-6-rag.v1',
    section_id: 6,
    section_title: 'Document/RAG workspaces',
    primary_app: 'tiny local RAG sandbox',
    candidate_apps: ['Paperless-ngx', 'Kotaemon', 'Onyx', 'txtai', 'RAGLite', 'Qdrant'],
    status: (qdrantProbe.found || paperlessProbe.found) ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      qdrant: { ran: qdrantProbe.ran, found: qdrantProbe.found, details: qdrantProbe.details },
      qdrant_live_write_trial: qdrantLiveWriteTrial,
      paperless: { ran: paperlessProbe.ran, found: paperlessProbe.found, details: paperlessProbe.details },
    },
    rag_answer: {
      workspace: 'fixture_document_sandbox',
      question: question.question,
      answer: 'The fixture documents say RAG outputs should keep citations/provenance and require review before any memory promotion.',
      document_citations: [{
        doc_id: matchingDoc.file.replace(/\.[^.]+$/, ''),
        title: matchingDoc.file,
        chunk_id: 'chunk-1',
        quote_or_snippet: snippet,
        confidence: 'high',
      }],
      document_says: ['Document sidecar outputs are review artifacts with citations/provenance.'],
      model_infers: ['A tiny local sandbox is enough to test the interface shape before any real document workspace is installed.'],
      memory_promotion_candidate: false,
      memory_write: false,
      requires_review: true,
    },
    patterns_to_steal: [
      'document chunk provenance',
      'citation UX',
      'document says vs model infers',
      'review-gated promotion into memory',
    ],
    private_docs_used: false,
    penny_memory_imported: false,
    memory_write: false,
    prompttruth_changed: false,
    runtime_changed: false,
    default_model_changed: false,
    recommended_next_live_command: qdrantLiveCommand,
  };
}

function runSpeachesTtsLiveTrial({
  run = false,
  found = false,
  baseUrl = 'http://127.0.0.1:8000',
  modelId = 'speaches-ai/Kokoro-82M-v1.0-ONNX',
  voice = 'af_heart',
  input = 'Penny sidecar audio fixture. No microphone was used.',
  requestJson = requestSpeachesJson,
  requestBinary = requestSpeachesBinary,
} = {}) {
  const result = {
    ran: Boolean(run && found),
    found: Boolean(found),
    base_url: baseUrl,
    model_id: modelId,
    voice,
    registry_checked: false,
    model_download_requested: false,
    model_available: false,
    tts_request_ran: false,
    audio_bytes_generated: 0,
    response_format: 'wav',
    microphone_access: false,
    recording_started: false,
    ambient_capture: false,
    input_audio_uploaded: false,
    audio_output_persisted: false,
    private_audio_used: false,
    penny_memory_imported: false,
    memory_write: false,
    errors: [],
  };
  if (!run) {
    result.skipped_reason = 'speaches tts trial not requested';
    return result;
  }
  if (!found) {
    result.skipped_reason = 'speaches service not found';
    return result;
  }

  const registry = requestJson({
    baseUrl,
    pathSuffix: '/v1/registry?task=text-to-speech',
    method: 'GET',
    timeoutMs: 30000,
  });
  if (registry.ok) result.registry_checked = true;
  else result.errors.push(`registry check failed: ${registry.error || registry.sample || 'unknown response'}`);

  const download = requestJson({
    baseUrl,
    pathSuffix: `/v1/models/${modelId}`,
    method: 'POST',
    timeoutMs: 600000,
  });
  if (download.ok) result.model_download_requested = true;
  else result.errors.push(`model download failed: ${download.error || download.sample || 'unknown response'}`);

  const models = requestJson({
    baseUrl,
    pathSuffix: '/v1/models',
    method: 'GET',
    timeoutMs: 30000,
  });
  if (models.ok) {
    const modelRows = Array.isArray(models.json?.data) ? models.json.data : [];
    result.model_available = modelRows.some((model) => String(model?.id || '') === modelId);
  } else {
    result.errors.push(`model availability check failed: ${models.error || models.sample || 'unknown response'}`);
  }

  const speech = requestBinary({
    baseUrl,
    pathSuffix: '/v1/audio/speech',
    method: 'POST',
    body: {
      model: modelId,
      voice,
      input,
      response_format: result.response_format,
    },
    timeoutMs: 120000,
  });
  if (speech.ok) {
    result.tts_request_ran = true;
    result.audio_bytes_generated = Number(speech.bytes || 0);
    if (speech.contentType) result.content_type = speech.contentType;
  } else {
    result.errors.push(`tts request failed: ${speech.error || 'unknown response'}`);
  }

  if (result.errors.length > 0) result.blocked_by = 'speaches_tts_request_failed';
  result.ok = result.registry_checked
    && result.model_download_requested
    && result.model_available
    && result.tts_request_ran
    && result.audio_bytes_generated > 0
    && result.errors.length === 0;
  return result;
}

function audioTrial({
  liveProbe = false,
  speachesTtsTrial = false,
  speachesBaseUrl = '',
  ttsInput = '',
} = {}) {
  const speachesBaseUrls = uniqueStrings([
    speachesBaseUrl,
    process.env.SPEACHES_BASE_URL,
    'http://127.0.0.1:8000',
  ]);
  const speachesProbe = probeEndpoints({
    run: liveProbe,
    urls: speachesBaseUrls.flatMap((baseUrl) => [
      joinUrl(baseUrl, '/v1/models'),
      joinUrl(baseUrl, '/health'),
    ]),
    dockerPatterns: [/speaches/i],
    envNames: ['SPEACHES_BASE_URL'],
  });
  const openedaiProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:5050/v1/models'],
    dockerPatterns: [/openedai[-_]?speech/i],
    envNames: ['OPENEDAI_SPEECH_BASE_URL'],
  });
  const whisperProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:9000/health', 'http://127.0.0.1:9000/v1/models'],
    dockerPatterns: [/faster[-_]?whisper/i],
    envNames: ['FASTER_WHISPER_BASE_URL'],
  });
  const parlerProbe = probeEndpoints({
    run: liveProbe,
    urls: ['http://127.0.0.1:8008/health'],
    dockerPatterns: [/parler/i],
    envNames: ['PARLER_BASE_URL'],
  });
  const fixture = readJson('fixtures/sidecar-trials/audio-transcript.fixture.json');
  const previewText = String(ttsInput || '').trim() || fixture.transcript;
  const speachesLiveBaseUrl = firstSuccessfulProbeBaseUrl(speachesProbe.details, '/v1/models')
    || firstSuccessfulProbeBaseUrl(speachesProbe.details, '/health')
    || speachesBaseUrls[0];
  const speachesTtsLiveTrial = runSpeachesTtsLiveTrial({
    run: liveProbe && speachesTtsTrial,
    found: speachesProbe.found,
    baseUrl: speachesLiveBaseUrl,
    input: previewText,
  });
  const speachesLiveCommand = `SPEACHES_BASE_URL=${speachesLiveBaseUrl} npm run penny:sidecar:audio -- --fixture --live-probe --speaches-tts-trial --speaches-base-url ${speachesLiveBaseUrl}`;
  return {
    schema_version: 1,
    artifact_schema: 'penny-sidecar-section-7-audio.v1',
    section_id: 7,
    section_title: 'Audio/voice sidecars',
    primary_app: speachesProbe.found ? 'Speaches live TTS fixture' : 'faster-whisper-server fixture harness',
    candidate_apps: ['Speaches', 'openedai-speech', 'faster-whisper-server', 'Parler'],
    status: (speachesProbe.found || openedaiProbe.found || whisperProbe.found || parlerProbe.found) ? 'LIVE_VERIFIED' : 'HARNESS_VERIFIED',
    generated_at: isoNow(),
    live_probe: {
      speaches: { ran: speachesProbe.ran, found: speachesProbe.found, details: speachesProbe.details },
      speaches_tts_live_trial: speachesTtsLiveTrial,
      openedai_speech: { ran: openedaiProbe.ran, found: openedaiProbe.found, details: openedaiProbe.details },
      faster_whisper: { ran: whisperProbe.ran, found: whisperProbe.found, details: whisperProbe.details },
      parler: { ran: parlerProbe.ran, found: parlerProbe.found, details: parlerProbe.details },
    },
    transcript_review: {
      audio_source: 'fixture',
      ambient_capture: false,
      transcript: previewText,
      confidence: fixture.confidence,
      reviewed: false,
      memory_write: false,
      tts_output_generated: speachesTtsLiveTrial.ok === true,
      latency_ms: null,
      quality_notes: fixture.quality_notes,
      requires_review: true,
    },
    patterns_to_steal: [
      'local voice endpoint abstraction',
      'push-to-talk or explicit recording',
      'transcript review',
      'voice as optional interface',
    ],
    microphone_access: false,
    recording_started: false,
    ambient_capture: false,
    private_audio_used: false,
    penny_memory_imported: false,
    memory_write: false,
    runtime_changed: false,
    default_model_changed: false,
    prompttruth_changed: false,
    recommended_next_live_command: speachesLiveCommand,
  };
}

const TRIALS = Object.freeze({
  lab: { build: labCockpitTrial, defaultArtifact: 'artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json' },
  home: { build: homeCameraTrial, defaultArtifact: 'artifacts/sidecar-trials/section-3-home-camera-frigate.json' },
  workflow: { build: workflowTrial, defaultArtifact: 'artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json' },
  research: { build: researchTrial, defaultArtifact: 'artifacts/sidecar-trials/section-5-research-searxng-digest.json' },
  rag: { build: ragTrial, defaultArtifact: 'artifacts/sidecar-trials/section-6-rag-document-sandbox.json' },
  audio: { build: audioTrial, defaultArtifact: 'artifacts/sidecar-trials/section-7-audio-transcript-review.json' },
});

module.exports = {
  ARTIFACT_DIR,
  FIXTURE_DIR,
  writeJson,
  probeEndpoints,
  probeReadOnlyHttpEndpoints,
  normalizeSearxngJsonSources,
  buildResearchDigest,
  probeSearxngJson,
  runOpenWebuiMockModelTrial,
  requestSpeachesJson,
  runN8nLiveWorkflowTrial,
  runQdrantLiveWriteTrial,
  runSpeachesTtsLiveTrial,
  labCockpitTrial,
  homeCameraTrial,
  workflowTrial,
  researchTrial,
  ragTrial,
  audioTrial,
  TRIALS,
};
