const defaultHttp = require('http');
const defaultHttps = require('https');
const defaultFs = require('fs');
const defaultPath = require('path');
const { URL: DefaultURL } = require('url');

function defaultFormatBytes(bytes = 0) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${Math.round(size)} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function createHttpError(statusCode, message) {
  const error = new Error(String(message || 'Request failed.'));
  error.statusCode = Number(statusCode) || 500;
  return error;
}

function sendJson(res, statusCode, data, { space = 2 } = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, space));
}

function safeReadBody(req, {
  maxBytes = 10 * 1024 * 1024,
  formatBytes = defaultFormatBytes,
  createHttpError: makeHttpError = createHttpError,
} = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      const chunkText = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      size += Buffer.byteLength(chunkText, 'utf8');
      if (size > maxBytes) {
        fail(makeHttpError(413, `Request body too large. Keep Penny payloads under ${formatBytes(maxBytes)}.`));
        req.destroy();
        return;
      }
      body += chunkText;
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(body);
    });

    req.on('error', fail);
  });
}

function postJsonLongRunning(urlString, {
  body,
  headers = {},
  signal,
  httpClient = defaultHttp,
  httpsClient = defaultHttps,
  URLCtor = DefaultURL,
  maxResponseBytes = 50 * 1024 * 1024,
} = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    let settled = false;
    let abortCleanup = () => {};
    const finish = (ok, value) => {
      if (settled) return;
      settled = true;
      abortCleanup();
      if (ok) resolve(value);
      else reject(value);
    };

    if (signal?.aborted) {
      const error = new Error('This operation was aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    let url;
    try {
      url = new URLCtor(urlString);
    } catch (error) {
      reject(error);
      return;
    }

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? httpsClient : httpClient;
    const port = url.port ? Number(url.port) : (isHttps ? 443 : 80);
    const reqHeaders = {
      ...headers,
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
    };

    const req = lib.request(
      {
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: reqHeaders,
        agent: false,
      },
      (res) => {
        const chunks = [];
        let len = 0;
        res.on('data', (chunk) => {
          len += chunk.length;
          if (len > maxResponseBytes) {
            req.destroy();
            finish(false, new Error('LM Studio response body too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf8');
          finish(true, { statusCode: res.statusCode, headers: res.headers, bodyText });
        });
        res.on('error', (error) => finish(false, error));
      },
    );

    req.setTimeout(0);
    req.on('error', (error) => finish(false, error));

    if (signal) {
      const onAbort = () => {
        req.destroy();
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        finish(false, error);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      abortCleanup = () => signal.removeEventListener('abort', onAbort);
    }

    req.write(payload);
    req.end();
  });
}

function postJsonSse(urlString, {
  body,
  headers = {},
  signal,
  onEvent,
  httpClient = defaultHttp,
  httpsClient = defaultHttps,
  URLCtor = DefaultURL,
} = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    let settled = false;
    let abortCleanup = () => {};
    const finish = (ok, value) => {
      if (settled) return;
      settled = true;
      abortCleanup();
      if (ok) resolve(value);
      else reject(value);
    };

    if (signal?.aborted) {
      const error = new Error('This operation was aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    let url;
    try {
      url = new URLCtor(urlString);
    } catch (error) {
      reject(error);
      return;
    }

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? httpsClient : httpClient;
    const port = url.port ? Number(url.port) : (isHttps ? 443 : 80);
    const reqHeaders = {
      Accept: 'text/event-stream',
      ...headers,
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
    };

    const req = lib.request(
      {
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: reqHeaders,
        agent: false,
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        res.setEncoding('utf8');
        if (statusCode < 200 || statusCode >= 300) {
          let errBody = '';
          res.on('data', (chunk) => {
            errBody += chunk;
          });
          res.on('end', () => {
            const error = new Error(`Stream request failed ${statusCode}: ${errBody}`);
            error.statusCode = statusCode;
            finish(false, error);
          });
          res.on('error', (error) => finish(false, error));
          return;
        }

        let buffer = '';
        const flushFrame = (frameText) => {
          const frame = String(frameText || '').trim();
          if (!frame) return;
          let event = 'message';
          const dataLines = [];
          for (const rawLine of frame.split(/\r?\n/)) {
            if (rawLine.startsWith('event:')) event = rawLine.slice(6).trim();
            else if (rawLine.startsWith('data:')) dataLines.push(rawLine.slice(5).trimStart());
          }
          const dataText = dataLines.join('\n');
          if (!dataText) return;
          let parsed = dataText;
          try {
            parsed = JSON.parse(dataText);
          } catch {}
          try {
            onEvent?.({ event, data: parsed });
          } catch (error) {
            req.destroy(error);
          }
        };
        const pump = (final = false) => {
          const normalized = buffer.replace(/\r\n/g, '\n');
          let idx;
          let start = 0;
          while ((idx = normalized.indexOf('\n\n', start)) !== -1) {
            flushFrame(normalized.slice(start, idx));
            start = idx + 2;
          }
          buffer = normalized.slice(start);
          if (final && buffer.trim()) {
            flushFrame(buffer);
            buffer = '';
          }
        };

        res.on('data', (chunk) => {
          buffer += chunk;
          pump(false);
        });
        res.on('end', () => {
          pump(true);
          finish(true, { statusCode, headers: res.headers });
        });
        res.on('error', (error) => finish(false, error));
      },
    );

    req.setTimeout(0);
    req.on('error', (error) => finish(false, error));

    if (signal) {
      const onAbort = () => {
        req.destroy();
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        finish(false, error);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      abortCleanup = () => signal.removeEventListener('abort', onAbort);
    }

    req.write(payload);
    req.end();
  });
}

function beginEventStream(res, { flushHeaders = true } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (flushHeaders && typeof res.flushHeaders === 'function') res.flushHeaders();
}

function sendEventStream(res, event, payload = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function startEventStreamKeepAlive(res, {
  intervalMs = 15_000,
  sendEvent = sendEventStream,
  now = () => Date.now(),
} = {}) {
  const tickerMs = Math.max(5000, Number(intervalMs) || 0);
  return setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    sendEvent(res, 'keepalive', { ts: now() });
  }, tickerMs);
}

function serveFile(res, filePath, {
  fs = defaultFs,
  path = defaultPath,
  mimeTypes = {},
  headers = {},
} = {}) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { ...headers, 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function createPennyServerHttpApi({
  httpClient = defaultHttp,
  httpsClient = defaultHttps,
  fs = defaultFs,
  path = defaultPath,
  URLCtor = DefaultURL,
  formatBytes = defaultFormatBytes,
  createHttpError: makeHttpError = createHttpError,
  mimeTypes = {},
} = {}) {
  return {
    formatBytes,
    createHttpError: makeHttpError,
    sendJson: (res, statusCode, data, options) => sendJson(res, statusCode, data, options),
    safeReadBody: (req, options) => safeReadBody(req, { ...options, formatBytes, createHttpError: makeHttpError }),
    postJsonLongRunning: (urlString, options) => postJsonLongRunning(urlString, { ...options, httpClient, httpsClient, URLCtor }),
    postJsonSse: (urlString, options) => postJsonSse(urlString, { ...options, httpClient, httpsClient, URLCtor }),
    beginEventStream: (res, options) => beginEventStream(res, options),
    sendEventStream: (res, event, payload) => sendEventStream(res, event, payload),
    startEventStreamKeepAlive: (res, options) => startEventStreamKeepAlive(res, options),
    serveFile: (res, filePath, options = {}) => serveFile(res, filePath, { fs, path, mimeTypes, ...options }),
  };
}

module.exports = {
  defaultFormatBytes,
  createHttpError,
  sendJson,
  safeReadBody,
  postJsonLongRunning,
  postJsonSse,
  beginEventStream,
  sendEventStream,
  startEventStreamKeepAlive,
  serveFile,
  createPennyServerHttpApi,
};
