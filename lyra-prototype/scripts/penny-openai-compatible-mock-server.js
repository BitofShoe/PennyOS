#!/usr/bin/env node
const http = require('node:http');

function argValue(argv, name, fallback = '') {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

async function main(argv = process.argv.slice(2)) {
  const host = argValue(argv, 'host', '127.0.0.1');
  const port = Number(argValue(argv, 'port', '18081'));
  const modelId = argValue(argv, 'model-id', 'penny-sidecar-toy-model');
  const stats = {
    models_requests: 0,
    chat_requests: 0,
    last_chat_model: null,
    last_chat_prompt_sample: '',
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: true, service: 'penny-openai-compatible-mock' });
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/stats' || url.pathname === '/v1/stats')) {
      sendJson(res, 200, stats);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      stats.models_requests += 1;
      sendJson(res, 200, {
        object: 'list',
        data: [{ id: modelId, object: 'model', owned_by: 'penny-sidecar-trial' }],
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (_err) {
        body = {};
      }
      stats.chat_requests += 1;
      stats.last_chat_model = body.model || modelId;
      stats.last_chat_prompt_sample = String(body.messages?.[0]?.content || '').slice(0, 120);
      sendJson(res, 200, {
        id: 'chatcmpl-penny-sidecar-mock',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model || modelId,
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Penny sidecar mock route ok. Open WebUI is only a lab sidecar here.',
          },
        }],
      });
      return;
    }
    sendJson(res, 404, { error: `Unhandled mock route: ${req.method} ${url.pathname}` });
  });

  server.listen(port, host, () => {
    process.stdout.write(`penny-openai-compatible-mock listening on http://${host}:${port}/v1 model=${modelId}\n`);
  });

  const close = () => server.close(() => process.exit(0));
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}

if (require.main === module) {
  main();
}

module.exports = { main };
