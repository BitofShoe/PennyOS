function createWebToolsApi({
  WEB_SEARCH_ENABLED,
  WEB_SEARCH_TIMEOUT_MS,
  WEB_SEARCH_MAX_RESULTS,
  WEB_FETCH_MAX_BYTES,
  WEB_FETCH_MAX_CHARS,
  clampNumber,
  collapseWhitespace,
  parseDuckDuckGoLiteResults,
  fetchTextWithLimit,
  normalizeWebUrl,
  extractHtmlTitle,
  stripHtmlToText,
  truncateText,
} = {}) {
  if (typeof clampNumber !== 'function') throw new TypeError('createWebToolsApi requires clampNumber');
  if (typeof collapseWhitespace !== 'function') throw new TypeError('createWebToolsApi requires collapseWhitespace');
  if (typeof parseDuckDuckGoLiteResults !== 'function') throw new TypeError('createWebToolsApi requires parseDuckDuckGoLiteResults');
  if (typeof fetchTextWithLimit !== 'function') throw new TypeError('createWebToolsApi requires fetchTextWithLimit');
  if (typeof normalizeWebUrl !== 'function') throw new TypeError('createWebToolsApi requires normalizeWebUrl');
  if (typeof extractHtmlTitle !== 'function') throw new TypeError('createWebToolsApi requires extractHtmlTitle');
  if (typeof stripHtmlToText !== 'function') throw new TypeError('createWebToolsApi requires stripHtmlToText');
  if (typeof truncateText !== 'function') throw new TypeError('createWebToolsApi requires truncateText');

  async function searchWebTool(args = {}) {
    if (!WEB_SEARCH_ENABLED) throw new Error('Web search is disabled on this Penny server.');
    const query = collapseWhitespace(String(args.query || ''));
    if (!query) throw new Error('search_web needs a query.');
    const limit = clampNumber(args.limit, 1, WEB_SEARCH_MAX_RESULTS, Math.min(5, WEB_SEARCH_MAX_RESULTS));
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const fetched = await fetchTextWithLimit(searchUrl, {
      timeoutMs: WEB_SEARCH_TIMEOUT_MS,
      maxBytes: Math.min(WEB_FETCH_MAX_BYTES, 600 * 1024),
    });
    const results = parseDuckDuckGoLiteResults(fetched.text, limit);
    if (!results.length) {
      throw new Error(`No web results came back for "${query}".`);
    }
    return {
      query,
      limit,
      engine: 'duckduckgo-lite',
      searchUrl,
      results,
      fetchedAt: new Date().toISOString(),
    };
  }

  async function readWebPageTool(args = {}) {
    if (!WEB_SEARCH_ENABLED) throw new Error('Web page reading is disabled on this Penny server.');
    const targetUrl = normalizeWebUrl(String(args.url || ''));
    if (!targetUrl) throw new Error('read_web_page needs a valid http/https URL.');
    const fetched = await fetchTextWithLimit(targetUrl, {
      timeoutMs: WEB_SEARCH_TIMEOUT_MS,
      maxBytes: WEB_FETCH_MAX_BYTES,
    });
    const rawHtml = String(fetched.text || '');
    const title = extractHtmlTitle(rawHtml);
    const text = String(stripHtmlToText(rawHtml) || '').trim();
    return {
      url: fetched.url || targetUrl,
      requestedUrl: targetUrl,
      title: title || null,
      contentType: fetched.contentType || '',
      text: truncateText(text, WEB_FETCH_MAX_CHARS),
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    searchWebTool,
    readWebPageTool,
  };
}

module.exports = {
  createWebToolsApi,
};
