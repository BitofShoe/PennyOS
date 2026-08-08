const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

function decodeHtmlEntities(text = '') {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeHostname(value = '') {
  let host = String(value || '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

function parseIpv4(value = '') {
  const host = normalizeHostname(value);
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function ipv4Category(value = '') {
  const parts = parseIpv4(value);
  if (!parts) return '';
  const [a, b, c, d] = parts;
  if (a === 0) return 'this-network';
  if (a === 10) return 'rfc1918';
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 172 && b >= 16 && b <= 31) return 'rfc1918';
  if (a === 192 && b === 168) return 'rfc1918';
  if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade-nat';
  // IANA Special-Purpose registry entries whose destinations are not globally reachable.
  if (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10) return 'ietf-protocol-assignment';
  if (a === 192 && b === 0 && c === 2) return 'documentation';
  if (a === 192 && b === 88 && c === 99) return 'deprecated-6to4-relay';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmarking';
  if (a === 198 && b === 51 && c === 100) return 'documentation';
  if (a === 203 && b === 0 && c === 113) return 'documentation';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return 'reserved';
  return 'public';
}

function expandIpv6(host = '') {
  const value = normalizeHostname(host);
  if (!value.includes(':')) return null;
  const zoneIndex = value.indexOf('%');
  const withoutZone = zoneIndex === -1 ? value : value.slice(0, zoneIndex);
  const ipv4TailMatch = withoutZone.match(/(.+):(\d{1,3}(?:\.\d{1,3}){3})$/);
  let working = withoutZone;
  let ipv4Tail = null;
  if (ipv4TailMatch) {
    ipv4Tail = parseIpv4(ipv4TailMatch[2]);
    if (!ipv4Tail) return null;
    working = ipv4TailMatch[1];
  }
  const [leftRaw, rightRaw = ''] = working.split('::');
  if (working.split('::').length > 2) return null;
  const left = leftRaw ? leftRaw.split(':').filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(':').filter(Boolean) : [];
  const tail = ipv4Tail ? [
    ((ipv4Tail[0] << 8) | ipv4Tail[1]).toString(16),
    ((ipv4Tail[2] << 8) | ipv4Tail[3]).toString(16),
  ] : [];
  const missing = 8 - left.length - right.length - tail.length;
  if (missing < 0) return null;
  const parts = [
    ...left,
    ...Array(missing).fill('0'),
    ...right,
    ...tail,
  ];
  if (parts.length !== 8) return null;
  const numbers = parts.map((part) => parseInt(part || '0', 16));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) return null;
  return numbers;
}

function ipv6MappedIpv4(host = '') {
  const parts = expandIpv6(host);
  if (!parts) return null;
  if (parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff) {
    return [
      (parts[6] >> 8) & 0xff,
      parts[6] & 0xff,
      (parts[7] >> 8) & 0xff,
      parts[7] & 0xff,
    ];
  }
  return null;
}

function matchesIpv6Prefix(parts = [], prefix = [], bits = 0) {
  if (!Array.isArray(parts) || parts.length !== 8 || !Array.isArray(prefix)) return false;
  const fullWords = Math.floor(bits / 16);
  const remainingBits = bits % 16;
  for (let index = 0; index < fullWords; index += 1) {
    if (parts[index] !== prefix[index]) return false;
  }
  if (!remainingBits) return true;
  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return (parts[fullWords] & mask) === (prefix[fullWords] & mask);
}

function isGloballyReachableIetfIpv6Exception(parts = []) {
  if (matchesIpv6Prefix(parts, [0x2001, 0x0003], 32)) return true;
  if (matchesIpv6Prefix(parts, [0x2001, 0x0004, 0x0112], 48)) return true;
  if (matchesIpv6Prefix(parts, [0x2001, 0x0020], 28)) return true;
  if (matchesIpv6Prefix(parts, [0x2001, 0x0030], 28)) return true;
  const anycastTail = parts.slice(0, 7).every((part, index) => (index === 0 ? part === 0x2001 : part === (index === 1 ? 1 : 0)));
  return anycastTail && [1, 2, 3].includes(parts[7]);
}

function ipv6Category(value = '') {
  const mapped = ipv6MappedIpv4(value);
  if (mapped) return 'ipv4-mapped';
  const parts = expandIpv6(value);
  if (!parts) return '';
  if (parts.every((part) => part === 0)) return 'unspecified';
  if (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return 'loopback';
  const first = parts[0];
  if ((first & 0xffc0) === 0xfe80) return 'link-local';
  if ((first & 0xfe00) === 0xfc00) return 'unique-local';
  if ((first & 0xff00) === 0xff00) return 'multicast';
  // IANA Special-Purpose registry entries whose destinations are not globally reachable.
  if (matchesIpv6Prefix(parts, [0x0064, 0xff9b, 0x0001], 48)) return 'ipv4-ipv6-translation';
  if (matchesIpv6Prefix(parts, [0x0100, 0x0000, 0x0000, 0x0000], 64)) return 'discard-only';
  if (matchesIpv6Prefix(parts, [0x0100, 0x0000, 0x0000, 0x0001], 64)) return 'dummy-ipv6';
  if (matchesIpv6Prefix(parts, [0x2001, 0x0000], 23) && !isGloballyReachableIetfIpv6Exception(parts)) return 'ietf-protocol-assignment';
  if (matchesIpv6Prefix(parts, [0x2002], 16)) return '6to4';
  if (matchesIpv6Prefix(parts, [0x2001, 0x0db8], 32)) return 'documentation';
  if (matchesIpv6Prefix(parts, [0x3fff, 0x0000], 20)) return 'documentation';
  if (matchesIpv6Prefix(parts, [0x5f00], 16)) return 'segment-routing';
  return 'public';
}

function classifyHostTarget(hostname = '') {
  const host = normalizeHostname(hostname);
  if (!host) return { category: 'invalid', private: true, reason: 'empty-host' };
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { category: 'loopback', private: true, reason: 'localhost' };
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const category = ipv4Category(host);
    return { category, private: category !== 'public', reason: category };
  }
  if (ipVersion === 6) {
    const category = ipv6Category(host);
    return { category, private: category !== 'public', reason: category };
  }
  return { category: 'hostname', private: false, reason: 'dns-required' };
}

function isPrivateAddress(value = '') {
  return classifyHostTarget(value).private === true;
}

function normalizeRequestHeaders(headers = {}) {
  const out = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[String(key)] = String(value);
    return out;
  }
  for (const [key, value] of Object.entries(headers || {})) {
    if (value == null) continue;
    out[String(key)] = String(value);
  }
  return out;
}

function headerGetterFromNodeHeaders(headers = {}) {
  return {
    get(name = '') {
      const key = String(name || '').toLowerCase();
      const value = headers[key];
      if (Array.isArray(value)) return value.join(', ');
      if (value == null) return null;
      return String(value);
    },
  };
}

function hostHeaderForUrl(parsed) {
  return parsed.host;
}

function createAbortError() {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function selectVerifiedAddress(safety = {}) {
  const addresses = Array.isArray(safety.addresses) ? safety.addresses : [];
  const publicAddress = addresses.find((entry) => {
    if (!entry || !entry.address) return false;
    const classification = classifyHostTarget(entry.address);
    return entry.private !== true && classification.private !== true;
  });
  if (publicAddress) return publicAddress;
  return safety.ok === true ? (addresses.find((entry) => entry?.address) || null) : null;
}

function createVerifiedAddressFetch({
  httpModule = http,
  httpsModule = https,
} = {}) {
  if (!httpModule || typeof httpModule.request !== 'function') {
    throw new TypeError('createVerifiedAddressFetch requires an httpModule with request');
  }
  if (!httpsModule || typeof httpsModule.request !== 'function') {
    throw new TypeError('createVerifiedAddressFetch requires an httpsModule with request');
  }

  return function fetchVerifiedAddress(urlString, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(String(urlString || ''));
      const isHttps = parsed.protocol === 'https:';
      const requestModule = isHttps ? httpsModule : httpModule;
      const targetAddress = selectVerifiedAddress(options.safety);
      if (!targetAddress) {
        reject(new Error(`No verified public address was available for ${parsed.toString()}.`));
        return;
      }

      const headers = normalizeRequestHeaders(options.headers);
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'host') delete headers[key];
      }
      headers.Host = hostHeaderForUrl(parsed);

      const signal = options.signal || null;
      const requestOptions = {
        protocol: parsed.protocol,
        hostname: targetAddress.address,
        port: parsed.port || (isHttps ? 443 : 80),
        method: options.method || 'GET',
        path: `${parsed.pathname || '/'}${parsed.search || ''}`,
        headers,
      };
      if (isHttps && !net.isIP(parsed.hostname)) {
        requestOptions.servername = parsed.hostname;
      }

      let req = null;
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        signal?.removeEventListener?.('abort', onAbort);
      };
      const onAbort = () => {
        req?.destroy?.(createAbortError());
      };

      req = requestModule.request(requestOptions, (res) => {
        const remoteAddress = res.socket?.remoteAddress || req?.socket?.remoteAddress || targetAddress.address;
        res.once?.('end', cleanup);
        res.once?.('close', cleanup);
        const status = Number(res.statusCode || 0);
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: res.statusMessage || '',
          headers: headerGetterFromNodeHeaders(res.headers || {}),
          body: res,
          url: parsed.toString(),
          finalPeerAddress: remoteAddress,
          finalPeerFamily: net.isIP(remoteAddress) || targetAddress.family || 0,
        });
      });
      req.on('error', (error) => {
        cleanup();
        reject(error);
      });
      if (signal) {
        if (signal.aborted) {
          req.destroy(createAbortError());
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      req.end();
    });
  };
}

function normalizeWebUrl(raw = '') {
  const base = 'https://duckduckgo.com';
  try {
    let value = decodeHtmlEntities(String(raw || '').trim());
    if (!value) return '';
    if (value.startsWith('//')) value = `https:${value}`;
    const parsed = new URL(value, base);
    const isDuckRedirect = /(^|\.)duckduckgo\.com$/i.test(parsed.hostname)
      && /^\/l\/?$/i.test(parsed.pathname);
    if (isDuckRedirect) {
      const target = parsed.searchParams.get('uddg') || parsed.searchParams.get('rut');
      if (target) return normalizeWebUrl(target);
      return '';
    }
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    if (/^duckduckgo\.com$/i.test(parsed.hostname) && !parsed.pathname.startsWith('/l')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function createWebUrlSafetyApi({
  allowPrivateNetwork = false,
  lookup = dns.promises.lookup,
  fetchImpl = globalThis.fetch,
  fetchVerifiedAddress = null,
  verifyFinalPeer = null,
  userAgent = 'Penny/0.1 (+local tool search)',
  formatBytes = (bytes) => `${bytes} B`,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('createWebUrlSafetyApi requires fetchImpl');
  if (fetchVerifiedAddress != null && typeof fetchVerifiedAddress !== 'function') {
    throw new TypeError('createWebUrlSafetyApi fetchVerifiedAddress must be a function when provided');
  }
  if (verifyFinalPeer != null && typeof verifyFinalPeer !== 'function') {
    throw new TypeError('createWebUrlSafetyApi verifyFinalPeer must be a function when provided');
  }

  async function resolveUrlSafety(urlString = '') {
    const normalized = normalizeWebUrl(urlString);
    if (!normalized) {
      return { ok: false, url: '', reason: 'invalid-url', addresses: [] };
    }
    const parsed = new URL(normalized);
    const direct = classifyHostTarget(parsed.hostname);
    if (direct.private) {
      return {
        ok: allowPrivateNetwork === true,
        url: normalized,
        reason: direct.reason,
        addresses: [{ address: parsed.hostname, family: net.isIP(parsed.hostname) || 0, category: direct.category }],
      };
    }
    let addresses = [];
    try {
      addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
    } catch (error) {
      return { ok: false, url: normalized, reason: `dns-failed:${error?.code || error?.message || 'unknown'}`, addresses: [] };
    }
    const normalizedAddresses = addresses.map((entry) => {
      const category = classifyHostTarget(entry.address);
      return {
        address: entry.address,
        family: entry.family || net.isIP(entry.address) || 0,
        category: category.category,
        private: category.private,
      };
    });
    const blocked = normalizedAddresses.find((entry) => entry.private);
    if (blocked) {
      return {
        ok: allowPrivateNetwork === true,
        url: normalized,
        reason: blocked.category || 'private-address',
        addresses: normalizedAddresses,
      };
    }
    return { ok: true, url: normalized, reason: 'public', addresses: normalizedAddresses };
  }

  async function assertUrlAllowed(urlString = '') {
    const safety = await resolveUrlSafety(urlString);
    if (!safety.ok) {
      const target = safety.url || String(urlString || '').trim() || 'requested URL';
      throw new Error(`Blocked private or unsafe web target (${safety.reason}) for ${target}. Set PENNY_WEB_ALLOW_PRIVATE_NET=1 only for deliberate local-network fetches.`);
    }
    return safety;
  }

  async function readResponseTextWithLimit(response, {
    maxBytes,
    controller,
  } = {}) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body || []) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maxBytes) {
        try {
          controller?.abort?.();
        } catch {}
        throw new Error(`Response exceeded Penny's web fetch cap of ${formatBytes(maxBytes)} while streaming.`);
      }
      chunks.push(buffer);
    }
    return {
      text: Buffer.concat(chunks).toString('utf8'),
      bytes,
    };
  }

  function normalizeFinalPeerEntries(metadata = null) {
    if (!metadata) return [];
    if (typeof metadata === 'string') return [{ address: metadata }];
    if (Array.isArray(metadata)) return metadata.flatMap((item) => normalizeFinalPeerEntries(item));
    if (typeof metadata !== 'object') return [];
    if (Array.isArray(metadata.addresses)) {
      return metadata.addresses.flatMap((item) => normalizeFinalPeerEntries(item));
    }
    const address = metadata.address
      || metadata.remoteAddress
      || metadata.finalPeerAddress
      || metadata.peerAddress
      || metadata.socket?.remoteAddress
      || '';
    if (!address) return [];
    return [{
      address,
      family: metadata.family || metadata.addressFamily || net.isIP(address) || 0,
    }];
  }

  async function assertFinalPeerAllowed({ currentUrl, response, safety }) {
    const metadata = [];
    if (response?.finalPeerAddress || response?.remoteAddress || response?.peerAddress || response?.socket?.remoteAddress) {
      metadata.push(response);
    }
    if (typeof verifyFinalPeer === 'function') {
      metadata.push(await verifyFinalPeer({ url: currentUrl, response, safety }));
    }
    const peers = normalizeFinalPeerEntries(metadata).map((entry) => {
      const classification = classifyHostTarget(entry.address);
      return {
        address: entry.address,
        family: entry.family || net.isIP(entry.address) || 0,
        category: classification.category,
        private: classification.private,
      };
    });
    const blocked = peers.find((entry) => entry.private);
    if (blocked && allowPrivateNetwork !== true) {
      throw new Error(`Blocked private or unsafe web target (final peer ${blocked.category}) for ${currentUrl}. Set PENNY_WEB_ALLOW_PRIVATE_NET=1 only for deliberate local-network fetches.`);
    }
    return peers;
  }

  async function fetchTextWithLimit(url, {
    timeoutMs = 15_000,
    maxBytes = 900 * 1024,
    maxRedirects = 5,
  } = {}) {
    let currentUrl = normalizeWebUrl(url);
    if (!currentUrl) throw new Error('Web request needs a valid http/https URL.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        const safety = await assertUrlAllowed(currentUrl);
        const requestOptions = {
          headers: {
            'User-Agent': userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'manual',
          signal: controller.signal,
        };
        const response = typeof fetchVerifiedAddress === 'function'
          ? await fetchVerifiedAddress(currentUrl, { ...requestOptions, safety })
          : await fetchImpl(currentUrl, requestOptions);
        await assertFinalPeerAllowed({ currentUrl, response, safety });
        const status = Number(response.status || 0);
        if (status >= 300 && status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`Redirect response ${status} had no Location header.`);
          const nextUrl = normalizeWebUrl(new URL(location, currentUrl).toString());
          if (!nextUrl) throw new Error(`Redirect response ${status} pointed at an invalid URL.`);
          await assertUrlAllowed(nextUrl);
          currentUrl = nextUrl;
          continue;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const body = await readResponseTextWithLimit(response, { maxBytes, controller });
        return {
          ok: true,
          url: response.url || currentUrl,
          contentType,
          text: body.text,
          bytes: body.bytes,
        };
      }
      throw new Error(`Too many redirects while reading ${currentUrl}.`);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Web request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    assertUrlAllowed,
    classifyHostTarget,
    fetchTextWithLimit,
    isPrivateAddress,
    normalizeWebUrl,
    resolveUrlSafety,
  };
}

module.exports = {
  classifyHostTarget,
  createVerifiedAddressFetch,
  createWebUrlSafetyApi,
  isPrivateAddress,
  normalizeWebUrl,
};
