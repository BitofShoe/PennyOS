const fs = require('fs');

function unquoteEnvValue(value = '') {
  const raw = String(value || '').trim();
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw.replace(/\s+#.*$/, '').trim();
}

function parsePennyEnvText(text = '') {
  const out = {};
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const withoutExport = trimmed.replace(/^export\s+/i, '');
    const idx = withoutExport.indexOf('=');
    if (idx <= 0) continue;
    const key = withoutExport.slice(0, idx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    out[key] = unquoteEnvValue(withoutExport.slice(idx + 1));
  }
  return out;
}

function loadPennyEnvFile({
  envFile = '',
  env = process.env,
  fsImpl = fs,
} = {}) {
  const target = String(envFile || '').trim();
  if (!target) return { loaded: false, reason: 'missing-path', applied: [], skippedExisting: [] };
  if (!fsImpl.existsSync(target)) return { loaded: false, reason: 'missing', applied: [], skippedExisting: [] };
  const parsed = parsePennyEnvText(fsImpl.readFileSync(target, 'utf8'));
  const applied = [];
  const skippedExisting = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (Object.prototype.hasOwnProperty.call(env, key) && env[key] != null) {
      skippedExisting.push(key);
      continue;
    }
    env[key] = value;
    applied.push(key);
  }
  return {
    loaded: true,
    path: target,
    applied,
    skippedExisting,
  };
}

module.exports = {
  loadPennyEnvFile,
  parsePennyEnvText,
  unquoteEnvValue,
};
