const crypto = require('crypto');
const os = require('os');
const net = require('net');

const DEFAULT_COOKIE_NAME = 'penny_access_token';

function isTruthyEnv(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function resolveBindHost({ lanShare = false, host = '' } = {}) {
  const explicit = String(host || '').trim();
  if (explicit) return explicit;
  return lanShare === true ? '0.0.0.0' : '127.0.0.1';
}

function normalizeHostName(value = '') {
  let host = String(value || '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end !== -1) return host.slice(1, end);
  }
  const colonCount = (host.match(/:/g) || []).length;
  if (colonCount === 1) host = host.split(':')[0];
  return host;
}

function isLoopbackAddress(value = '') {
  const host = normalizeHostName(value);
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (net.isIP(host) === 4) return host.startsWith('127.');
  if (/^::ffff:127\./i.test(host)) return true;
  return false;
}

function listLanIPv4Addresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const rec of list) {
      const fam = rec.family;
      if ((fam === 'IPv4' || fam === 4) && !rec.internal) out.push(rec.address);
    }
  }
  return [...new Set(out)];
}

function parseCookieHeader(header = '') {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function extractRequestToken(req, cookieName = DEFAULT_COOKIE_NAME) {
  const headers = req?.headers || {};
  const authorization = String(headers.authorization || headers.Authorization || '').trim();
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (bearer) return bearer;
  const headerToken = String(
    headers['x-penny-access-token']
      || headers['x-penny-api-token']
      || headers['x-penny-token']
      || '',
  ).trim();
  if (headerToken) return headerToken;
  const cookies = parseCookieHeader(headers.cookie || headers.Cookie || '');
  return String(cookies[cookieName] || '').trim();
}

function tokenEquals(a = '', b = '') {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createAccessToken(env = process.env) {
  const configured = String(
    env.PENNY_API_TOKEN
      || env.PENNY_ACCESS_TOKEN
      || env.PENNY_LOCAL_API_TOKEN
      || '',
  ).trim();
  if (configured) return { token: configured, generated: false };
  return { token: crypto.randomBytes(24).toString('base64url'), generated: true };
}

function createPennyApiSecurity({
  env = process.env,
  sendJson,
  lanAddresses = listLanIPv4Addresses,
  cookieName = DEFAULT_COOKIE_NAME,
  accessToken: accessTokenOverride = null,
} = {}) {
  if (typeof sendJson !== 'function') throw new TypeError('createPennyApiSecurity requires sendJson');
  const lanShare = isTruthyEnv(env.PENNY_LAN_SHARE);
  const allowLocalNoToken = isTruthyEnv(env.PENNY_API_ALLOW_LOCAL_NO_TOKEN);
  const requireAllApiToken = isTruthyEnv(env.PENNY_REQUIRE_API_TOKEN);
  const tokenState = accessTokenOverride
    ? { token: String(accessTokenOverride), generated: false }
    : createAccessToken(env);
  const configuredAllowedHosts = String(env.PENNY_ALLOWED_HOSTS || '')
    .split(',')
    .map(normalizeHostName)
    .filter(Boolean);

  function allowedHostNames() {
    const hosts = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      '0:0:0:0:0:0:0:1',
      ...configuredAllowedHosts,
    ]);
    if (lanShare) {
      for (const address of lanAddresses()) hosts.add(normalizeHostName(address));
    }
    return hosts;
  }

  function isAllowedHost(hostHeader = '') {
    const host = normalizeHostName(hostHeader);
    if (!host) return false;
    if (isLoopbackAddress(host)) return true;
    return allowedHostNames().has(host);
  }

  function isAllowedOrigin(origin = '') {
    const value = String(origin || '').trim();
    if (!value) return true;
    try {
      const parsed = new URL(value);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      return isAllowedHost(parsed.host);
    } catch {
      return false;
    }
  }

  function isJsonMutation(req, url) {
    const method = String(req?.method || 'GET').toUpperCase();
    return url?.pathname?.startsWith('/api/')
      && ['POST', 'PATCH', 'PUT'].includes(method);
  }

  function hasJsonContentType(req) {
    const contentType = String(req?.headers?.['content-type'] || req?.headers?.['Content-Type'] || '').toLowerCase();
    return contentType.split(';').map((part) => part.trim()).includes('application/json');
  }

  function isStrongTokenRoute(req, url) {
    const method = String(req?.method || 'GET').toUpperCase();
    const pathname = String(url?.pathname || '');
    if (pathname.startsWith('/api/penny/workspace-writes')) return true;
    if (method === 'POST' && pathname === '/api/penny/memory/purge') return true;
    if (method === 'POST' && pathname === '/api/penny/lmstudio/model') return true;
    return false;
  }

  function requestNeedsToken(req, url) {
    if (!url?.pathname?.startsWith('/api/')) return false;
    if (allowLocalNoToken && isLoopbackAddress(req?.socket?.remoteAddress || '')) return false;
    return lanShare || requireAllApiToken || isStrongTokenRoute(req, url);
  }

  function validateApiRequest(req, url) {
    if (!url?.pathname?.startsWith('/api/')) return { ok: true };
    if (!isAllowedHost(req?.headers?.host || '')) {
      return { ok: false, statusCode: 403, code: 'host_rejected', error: 'Unexpected Host header for this Penny server.' };
    }
    if (!isAllowedOrigin(req?.headers?.origin || '')) {
      return { ok: false, statusCode: 403, code: 'origin_rejected', error: 'Unexpected Origin for this Penny server.' };
    }
    if (isJsonMutation(req, url) && !hasJsonContentType(req)) {
      return { ok: false, statusCode: 415, code: 'json_required', error: 'JSON API mutations require Content-Type: application/json.' };
    }
    if (requestNeedsToken(req, url)) {
      const supplied = extractRequestToken(req, cookieName);
      if (!tokenEquals(supplied, tokenState.token)) {
        return { ok: false, statusCode: 401, code: 'token_required', error: 'Penny API access token required.' };
      }
    }
    return { ok: true };
  }

  function handleApiSecurity({ req, res, url } = {}) {
    const result = validateApiRequest(req, url);
    if (result.ok) return false;
    sendJson(res, result.statusCode, {
      ok: false,
      error: result.error,
      code: result.code,
    });
    return true;
  }

  function shouldBootstrapLoopbackCookie(req) {
    const remote = req?.socket?.remoteAddress || '';
    return isLoopbackAddress(remote);
  }

  function buildBootstrapCookie() {
    return `${cookieName}=${encodeURIComponent(tokenState.token)}; Path=/; SameSite=Strict; HttpOnly`;
  }

  function staticSecurityHeaders(req) {
    const headers = {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    };
    if (shouldBootstrapLoopbackCookie(req)) {
      headers['Set-Cookie'] = buildBootstrapCookie();
    }
    return headers;
  }

  function startupSecurityLines({ port } = {}) {
    const lines = [];
    if (lanShare) {
      lines.push('LAN sharing is enabled; every /api/* request requires a Penny API token.');
      if (tokenState.generated) {
        lines.push(`Generated LAN API token for this process: ${tokenState.token}`);
      } else {
        lines.push('LAN API token loaded from PENNY_API_TOKEN/PENNY_ACCESS_TOKEN.');
      }
    } else {
      lines.push('LAN sharing is off; Penny is bound to localhost and loopback browsers get a local session cookie.');
      if (isStrongTokenRoute({ method: 'POST' }, { pathname: '/api/penny/memory/purge' })) {
        lines.push('Memory purge and model-change routes still require the local session token.');
      }
    }
    if (port) lines.push(`API security policy active on port ${port}.`);
    return lines;
  }

  return {
    lanShare,
    accessToken: tokenState.token,
    accessTokenGenerated: tokenState.generated,
    cookieName,
    resolveBindHost: (options = {}) => resolveBindHost({ lanShare, ...options }),
    isAllowedHost,
    isAllowedOrigin,
    validateApiRequest,
    handleApiSecurity,
    staticSecurityHeaders,
    startupSecurityLines,
    requestNeedsToken,
  };
}

module.exports = {
  DEFAULT_COOKIE_NAME,
  createPennyApiSecurity,
  isLoopbackAddress,
  isTruthyEnv,
  listLanIPv4Addresses,
  normalizeHostName,
  resolveBindHost,
};
