const PROJECT_PATH_PATTERN = /\b[A-Za-z0-9_.()' -]+(?:[\\/][A-Za-z0-9_.()' -]+)*\.(?:js|cjs|mjs|json|md|txt|html|css|svg|ps1|log)(?::\d+)?\b/g;

function normalizeProjectPath(value = '') {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/:\d+$/, '')
    .replace(/^\.\//, '');
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function successfulToolRecords(toolRecords = [], names = []) {
  const wanted = new Set(names);
  return (Array.isArray(toolRecords) ? toolRecords : [])
    .filter((record) => wanted.has(String(record?.name || '').trim()) && record?.result?.ok === true);
}

function collectProjectSearchHits(toolRecords = []) {
  const hits = [];
  for (const record of successfulToolRecords(toolRecords, ['search_project_text'])) {
    const data = record?.result?.data && typeof record.result.data === 'object' ? record.result.data : {};
    for (const hit of Array.isArray(data.hits) ? data.hits : []) {
      const path = normalizeProjectPath(hit?.path);
      if (!path) continue;
      hits.push({
        path,
        line: Number.isFinite(Number(hit?.line)) ? Number(hit.line) : 0,
        text: String(hit?.text || '').trim(),
        query: String(data.query || record?.args?.query || '').trim(),
      });
    }
  }
  return hits;
}

function collectProjectReadPaths(toolRecords = []) {
  const paths = [];
  for (const record of successfulToolRecords(toolRecords, ['read_project_file', 'read_project_file_around_match'])) {
    const args = record?.args && typeof record.args === 'object' ? record.args : {};
    const data = record?.result?.data && typeof record.result.data === 'object' ? record.result.data : {};
    const path = normalizeProjectPath(data.path || args.path);
    if (path) paths.push(path);
  }
  return uniqueStrings(paths);
}

function extractMentionedProjectPaths(text = '') {
  const paths = [];
  const source = String(text || '');
  for (const match of source.matchAll(PROJECT_PATH_PATTERN)) {
    const path = normalizeProjectPath(match?.[0] || '');
    if (path) paths.push(path);
  }
  return uniqueStrings(paths);
}

function extractSymbolNames(text = '') {
  const source = String(text || '');
  const symbols = [];
  const patterns = [
    /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/g,
    /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s+)?(?:function|\()/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const symbol = String(match?.[1] || '').trim();
      if (symbol && symbol.length >= 3) symbols.push(symbol);
    }
  }
  return uniqueStrings(symbols);
}

function buildPathPattern(path = '') {
  const escaped = escapeRegExp(normalizeProjectPath(path)).replace(/\\\//g, '[\\\\/]');
  return new RegExp(escaped, 'i');
}

function windowAroundPath(text = '', path = '', radius = 140) {
  const source = String(text || '');
  const match = source.match(buildPathPattern(path));
  if (!match || typeof match.index !== 'number') return '';
  const start = Math.max(0, match.index - radius);
  const end = Math.min(source.length, match.index + match[0].length + radius);
  return source.slice(start, end);
}

function isSearchScopedCandidateLanguage(text = '') {
  return /\b(?:search(?:ed|es|ing)?|search result|search hit|hit|candidate|promising|found by search|not read|haven't read|have not read|need to read|would read|before claiming|before finalizing)\b/i.test(String(text || ''));
}

function textHasExactLineClaimForPath(text = '', path = '') {
  const window = windowAroundPath(text, path);
  if (!window || isSearchScopedCandidateLanguage(window)) return false;
  return /\bline(?:s)?\s+\d+\b/i.test(window)
    || new RegExp(`${escapeRegExp(normalizeProjectPath(path)).replace(/\\\//g, '[\\\\/]')}:\\d+`, 'i').test(String(text || ''));
}

function userAskedForExactCodeDetails(userText = '') {
  return /\b(?:exact|concrete|specific)\b[\s\S]{0,80}\b(?:file|path|line|function|symbol|code|mechanic)/i.test(String(userText || ''))
    || /\b(?:function names?|line numbers?|code mechanics?|where .* lives|where .* strips|where .* handles)\b/i.test(String(userText || ''));
}

function textClaimsSearchHitSymbol({ text = '', userText = '', path = '', symbols = [] } = {}) {
  if (!userAskedForExactCodeDetails(userText)) return false;
  const window = windowAroundPath(text, path);
  if (!window || isSearchScopedCandidateLanguage(window)) return false;
  return symbols.some((symbol) => new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(window));
}

function findSearchOnlyExactClaimIssues({ text = '', userText = '', toolRecords = [] } = {}) {
  const hits = collectProjectSearchHits(toolRecords);
  if (!hits.length) return [];
  const readPaths = new Set(collectProjectReadPaths(toolRecords).map((path) => path.toLowerCase()));
  const searchPaths = new Set(hits.map((hit) => hit.path.toLowerCase()));
  const mentionedPaths = extractMentionedProjectPaths(text)
    .filter((path) => searchPaths.has(path.toLowerCase()))
    .filter((path) => !readPaths.has(path.toLowerCase()));
  const issues = [];
  for (const path of mentionedPaths) {
    const pathHits = hits.filter((hit) => hit.path.toLowerCase() === path.toLowerCase());
    const symbols = uniqueStrings(pathHits.flatMap((hit) => extractSymbolNames(hit.text)));
    const lineClaim = textHasExactLineClaimForPath(text, path);
    const symbolClaim = textClaimsSearchHitSymbol({ text, userText, path, symbols });
    if (!lineClaim && !symbolClaim) continue;
    issues.push({
      code: 'search-only-exact-claim',
      path,
      reason: lineClaim ? 'line-claim-without-read' : 'symbol-claim-without-read',
      symbols,
    });
  }
  return issues;
}

function buildSearchToReadHandoffGuidance(searchData = {}) {
  const hits = Array.isArray(searchData?.hits) ? searchData.hits : [];
  if (!hits.length) return '';
  const paths = uniqueStrings(hits.map((hit) => normalizeProjectPath(hit?.path))).slice(0, 4);
  return [
    'Search result handoff:',
    'search_project_text only narrows candidate files; it is not enough for exact file/line/function/code-mechanics claims.',
    paths.length ? `Promising candidate path${paths.length === 1 ? '' : 's'}: ${paths.join(', ')}` : '',
    'If the final answer needs exact code details, read a matching path next with read_project_file_around_match or read_project_file before finalizing.',
  ].filter(Boolean).join('\n');
}

function buildSearchOnlyExactClaimGuidance(issues = []) {
  const paths = uniqueStrings((Array.isArray(issues) ? issues : []).map((issue) => issue.path)).slice(0, 4);
  return [
    'Your draft made exact file/line/function/code claims from search_project_text hits only.',
    'Search hits are candidate evidence; they do not verify surrounding code mechanics by themselves.',
    paths.length ? `Read next before finalizing: ${paths.join(', ')}` : '',
    'Call read_project_file_around_match or read_project_file for each claimed path you need, then answer from that read-backed context.',
    'If you cannot read it in this turn, say only that search found candidate hits and do not present exact line/function/code claims as verified.',
  ].filter(Boolean).join('\n');
}

function composeSearchOnlyClaimFallback({ toolRecords = [] } = {}) {
  const hits = collectProjectSearchHits(toolRecords);
  if (!hits.length) return '';
  const paths = uniqueStrings(hits.map((hit) => hit.path)).slice(0, 4);
  const query = uniqueStrings(hits.map((hit) => hit.query)).slice(0, 2).join(' / ');
  return [
    `i searched the repo${query ? ` for "${query}"` : ''} and found candidate hits${paths.length ? ` in ${paths.join(', ')}` : ''}.`,
    "i haven't read those files in this turn, so i'm not going to turn search snippets into exact code claims yet.",
    '[MOOD:thinking]',
  ].join(' ');
}

module.exports = {
  buildSearchOnlyExactClaimGuidance,
  buildSearchToReadHandoffGuidance,
  composeSearchOnlyClaimFallback,
  findSearchOnlyExactClaimIssues,
};
