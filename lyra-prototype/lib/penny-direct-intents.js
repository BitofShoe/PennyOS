function createDirectIntentApi({
  stripCodeFences,
  collapseWhitespace,
  extractFirstUrl,
  normalizeWebUrl,
  truncateText,
  stripReplyMoodTags,
  LOCAL_LLM_TRANSPORT,
} = {}) {
  if (typeof stripCodeFences !== 'function') {
    throw new TypeError('createDirectIntentApi requires stripCodeFences');
  }
  if (typeof collapseWhitespace !== 'function') {
    throw new TypeError('createDirectIntentApi requires collapseWhitespace');
  }
  if (typeof extractFirstUrl !== 'function') {
    throw new TypeError('createDirectIntentApi requires extractFirstUrl');
  }
  if (typeof normalizeWebUrl !== 'function') {
    throw new TypeError('createDirectIntentApi requires normalizeWebUrl');
  }
  if (typeof truncateText !== 'function') {
    throw new TypeError('createDirectIntentApi requires truncateText');
  }
  if (typeof stripReplyMoodTags !== 'function') {
    throw new TypeError('createDirectIntentApi requires stripReplyMoodTags');
  }

  const PROJECT_PATH_EXTENSIONS = 'js|cjs|mjs|json|md|txt|html|css|svg|ps1|log';
  const QUOTED_PROJECT_PATH_PATTERNS = [
    new RegExp("`([^`\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))`", 'i'),
    new RegExp("\"([^\"\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))\"", 'i'),
    new RegExp("'([^'\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))'", 'i'),
  ];
  const UNQUOTED_PROJECT_PATH_PATTERN = new RegExp(
    "(?:^|[\\s`\"'(])([a-z0-9_./\\\\-]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))(?=$|[\\s`\"')?!,:;.])",
    'i',
  );

  function extractExplicitProjectPath(text = '') {
    const raw = String(text || '');
    for (const pattern of QUOTED_PROJECT_PATH_PATTERNS) {
      const match = raw.match(pattern);
      const candidate = String(match?.[1] || '').trim();
      if (candidate) return candidate;
    }
    const match = raw.match(UNQUOTED_PROJECT_PATH_PATTERN);
    return match ? match[1].trim().replace(/\\/g, '/') : '';
  }

  function cleanDirectInstructionContent(text = '') {
    let cleaned = stripCodeFences(String(text || '').trim());
    cleaned = cleaned.replace(/\s+then\s+(?:verify|check|tell|show|explain)\b[\s\S]*$/i, '').trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"'))
      || (cleaned.startsWith("'") && cleaned.endsWith("'"))
      || (cleaned.startsWith('`') && cleaned.endsWith('`'))) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned.replace(/\r\n/g, '\n');
  }

  function parseDirectWriteInstruction(text = '') {
    const raw = String(text || '');
    let match = raw.match(/\b(?:create|write)\s+([a-z0-9_./-]+\.[a-z0-9]+)\b[\s\S]*?\bwith exactly this line:\s*([\s\S]*?)(?=(?:\r?\n|$|\s+then\b))/i);
    if (match) {
      const content = cleanDirectInstructionContent(match[2]);
      if (content) return { path: match[1], content };
    }
    match = raw.match(/\b(?:create|write)\s+([a-z0-9_./-]+\.[a-z0-9]+)\b[\s\S]*?\bwith exactly these contents:\s*([\s\S]+)/i);
    if (match) {
      const content = cleanDirectInstructionContent(match[2]);
      if (content) return { path: match[1], content };
    }
    return null;
  }

  function normalizeDirectLineSnippet(text = '') {
    const content = cleanDirectInstructionContent(text);
    if (!content) return '';
    const natural = content.replace(/\s*,\s*$/, '').trim();
    const logMatch = natural.match(/^logs?\s+["'`]([\s\S]*?)["'`]$/i);
    if (logMatch) return `console.log(${JSON.stringify(logMatch[1])});`;
    return content;
  }

  function parseDirectReplaceInstruction(text = '') {
    const match = String(text || '').match(/\breplace\s+["'`]([\s\S]*?)["'`]\s+with\s+["'`]([\s\S]*?)["'`]\s+in\s+([a-z0-9_./-]+\.[a-z0-9]+)\b/i);
    if (!match) return null;
    return {
      path: match[3],
      find: match[1],
      replace: match[2],
    };
  }

  function parseDirectAppendInstruction(text = '') {
    const raw = String(text || '');
    const patterns = [
      /\b(?:add|append)\s+(?:exactly\s+)?this line\s+to\s+([a-z0-9_./-]+\.[a-z0-9]+)\b\s*:\s*([\s\S]+)/i,
      /\b(?:add|append)\s+(?:a\s+\w+\s+)?line\s+to\s+([a-z0-9_./-]+\.[a-z0-9]+)\b[\s\S]*?\bthat\s+([\s\S]*?)(?=(?:\r?\n|$|\s+then\b))/i,
      /\b(?:add|append)\s+to\s+([a-z0-9_./-]+\.[a-z0-9]+)\b[\s\S]*?\bthis line:\s*([\s\S]+)/i,
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const snippet = normalizeDirectLineSnippet(match[2]);
      if (snippet) return { path: match[1], text: snippet };
    }
    return null;
  }

  function buildDirectEditSequence(path, primaryStep, mode) {
    const steps = [primaryStep];
    if (/\.(?:js|cjs|mjs)$/i.test(path)) {
      steps.push({ name: 'run_node_check', args: { path } });
    }
    steps.push({ name: 'get_git_status', args: {} });
    return { kind: 'sequence', mode, path, steps };
  }

  function extractDirectWebQuery(text = '') {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const patterns = [
      /\b(?:search|check|look)\s+(?:the\s+)?(?:web|internet|online)\s+for\s+([\s\S]+)/i,
      /\blook up\s+([\s\S]+)/i,
      /\bgoogle\s+([\s\S]+)/i,
      /\bfind\s+(?:recent|current|latest)\s+info\s+(?:about|on)\s+([\s\S]+)/i,
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      const candidate = collapseWhitespace(match?.[1] || '').replace(/[?.!]+$/g, '');
      if (candidate) return candidate;
    }
    return '';
  }

  function shouldInspectTopWebResult(text = '') {
    const lower = String(text || '').toLowerCase();
    if (!lower) return false;
    if (/\b(page title|title, the url|the url|one short sentence|what it is|what is it|summari[sz]e|summary|read (?:the )?page|open (?:the )?(?:page|result)|tell me about)\b/.test(lower)) {
      return true;
    }
    return /\b(official|docs|documentation)\b/.test(lower);
  }

  function extractDirectSearchQuery(text = '') {
    const raw = String(text || '');
    const lower = raw.toLowerCase();
    const exactPatterns = [/`([^`\n]{2,120})`/, /"([^"\n]{2,120})"/, /'([^'\n]{2,120})'/];
    for (const pattern of exactPatterns) {
      const match = raw.match(pattern);
      const candidate = String(match?.[1] || '').trim();
      if (!candidate || extractExplicitProjectPath(candidate)) continue;
      return candidate;
    }
    const underscored = raw.match(/\b([a-z][a-z0-9]*_[a-z0-9_]+)\b/i);
    if (underscored?.[1]) return underscored[1];
    if (/\bgit diff\b/i.test(lower)) return 'git diff';
    if (/\bgit status\b/i.test(lower)) return 'git status';
    return '';
  }

  function looksLikeProjectPathDiscoveryIntent(text = '', query = '') {
    if (!query) return false;
    const lower = String(text || '').toLowerCase();
    if (extractExplicitProjectPath(query) || /^(git diff|git status)$/i.test(query)) return false;
    const discoveryVerb = /\b(find|locate|look for|look inside|peek inside|open|show|list|browse|search|where is|where's|what's in|what is in|do you see|can you see|check)\b/i.test(lower);
    const pathNoun = /\b(folder|directory|repo|repository|path|file|files|playground|inside)\b/i.test(lower);
    const contentOnly = /\b(line|lines|string|text|symbol|function|code|grep|used in|used for|what handles|what does)\b/i.test(lower);
    return discoveryVerb && pathNoun && !contentOnly;
  }

  function looksLikeDirectProjectInspectIntent(text = '', query = '') {
    if (!query) return false;
    const lower = String(text || '').toLowerCase();
    if (extractExplicitProjectPath(query) || /^(git diff|git status)$/i.test(query)) return false;
    const inspectVerb = /\b(inspect|explain|walk through|look at|check|show|read|around|how does|how do|why does|what does|tell me how)\b/i.test(lower);
    const projectNoun = /\b(code|repo|project|file|files|function|symbol|logic|implementation|works|working|decides|handle|handler|used)\b/i.test(lower);
    return inspectVerb && projectNoun;
  }

  function looksLikeOpenEndedProjectEdit(text = '') {
    const lower = String(text || '').toLowerCase();
    if (!lower) return false;
    const editVerb = /\b(add|append|write|edit|update|change|rewrite|revise|leave|put)\b/.test(lower);
    const creativeCue = /\b(in your own voice|pick the wording|choose the wording|decide what to write|whatever you want|anything you want|your own note)\b/.test(lower)
      || (/\b(note|line|paragraph)\b/.test(lower) && /\b(your own|yourself)\b/.test(lower));
    return editVerb && creativeCue;
  }

  function shouldForceLocalToolLoop(text = '') {
    const explicitPath = extractExplicitProjectPath(text);
    return !!(explicitPath && looksLikeOpenEndedProjectEdit(text));
  }

  function resolveDirectToolIntent(userText = '') {
    const text = String(userText || '');
    const lower = text.toLowerCase();
    const explicitPath = extractExplicitProjectPath(text);
    const explicitUrl = normalizeWebUrl(extractFirstUrl(text));
    const directWrite = parseDirectWriteInstruction(text);
    if (directWrite) {
      return buildDirectEditSequence(
        directWrite.path,
        { name: 'write_project_file', args: { path: directWrite.path, content: directWrite.content } },
        'direct_write',
      );
    }
    const directReplace = parseDirectReplaceInstruction(text);
    if (directReplace) {
      return buildDirectEditSequence(
        directReplace.path,
        {
          name: 'replace_in_project_file',
          args: {
            path: directReplace.path,
            find: directReplace.find,
            replace: directReplace.replace,
          },
        },
        'direct_replace',
      );
    }
    const directAppend = parseDirectAppendInstruction(text);
    if (directAppend) {
      return buildDirectEditSequence(
        directAppend.path,
        {
          name: 'insert_in_project_file',
          args: {
            path: directAppend.path,
            text: directAppend.text,
            position: 'end',
            lineAware: true,
          },
        },
        'direct_append',
      );
    }
    if (explicitPath && /\b(syntax|parse|node --check|compile)\b/i.test(lower)) {
      return { name: 'run_node_check', args: { path: explicitPath } };
    }
    if (/\bgit diff\b/i.test(lower) || (/\b(diff|show(?: me)?(?: the)? changes|what changed|what did you change)\b/i.test(lower) && (/\bgit\b/i.test(lower) || !!explicitPath))) {
      return { name: 'read_git_diff', args: explicitPath ? { path: explicitPath, contextLines: 3 } : { summaryOnly: true } };
    }
    if (explicitUrl && /\b(read|open|summarize|check|inspect|what(?:'s| is) on|what does|tell me about)\b/i.test(lower)) {
      return { name: 'read_web_page', args: { url: explicitUrl } };
    }
    const webQuery = extractDirectWebQuery(text);
    if (webQuery) {
      if (shouldInspectTopWebResult(text)) {
        return { name: 'inspect_web_result', args: { query: webQuery, limit: 5 } };
      }
      return { name: 'search_web', args: { query: webQuery, limit: 5 } };
    }
    if (explicitPath && looksLikeOpenEndedProjectEdit(text)) {
      return null;
    }
    if (explicitPath && /\b(read|open|show|inspect|explain|summarize|check|look at|walk through|search|find|grep|look for)\b/i.test(lower)) {
      const symbolQuery = extractDirectSearchQuery(text);
      if (symbolQuery && !/^(git diff|git status)$/i.test(symbolQuery) && !extractExplicitProjectPath(symbolQuery)) {
        return {
          name: 'read_project_file_around_match',
          args: {
            path: explicitPath,
            query: symbolQuery,
            beforeLines: 12,
            afterLines: 48,
          },
        };
      }
      return { name: 'read_project_file', args: { path: explicitPath, startLine: 1, endLine: 160 } };
    }
    const searchQuery = extractDirectSearchQuery(text);
    if (!explicitPath && searchQuery && looksLikeProjectPathDiscoveryIntent(text, searchQuery)) {
      return { name: 'list_project_files', args: { path: '.', recursive: true, pattern: searchQuery, limit: 24 } };
    }
    if (!explicitPath && looksLikeDirectProjectInspectIntent(text, searchQuery)) {
      return {
        name: 'inspect_project_symbol',
        args: {
          query: searchQuery,
          beforeLines: 12,
          afterLines: 56,
        },
      };
    }
    if (searchQuery && /\b(search|find|grep|where is|which file|what handles|wired up|hooked up|hooked into|used for|used in)\b/i.test(lower)) {
      return { name: 'search_project_text', args: { query: searchQuery, limit: 8 } };
    }
    if (/\b(what model|which model|runtime status|local status|lm studio status|what are you using|which local model|resolved model)\b/i.test(lower)) {
      return { name: 'get_runtime_status', args: {} };
    }
    if (/\bgit status\b/i.test(lower) || (/\bwhat changed\b/i.test(lower) && /\bgit\b/i.test(lower))) {
      return { name: 'get_git_status', args: {} };
    }
    if (/\b(log|logs|stderr|stdout|stack trace|traceback)\b/i.test(lower) && /\b(read|show|summarize|inspect|check|look at|why)\b/i.test(lower)) {
      const target = /\bstderr\b/i.test(lower) ? 'stderr' : /\bstdout\b/i.test(lower) ? 'stdout' : 'latest';
      return { name: 'read_recent_logs', args: { target, lines: 60 } };
    }
    return null;
  }

  function composeDirectRuntimeReply(status = {}) {
    const model = String(status.resolvedModel || '').trim();
    const reachability = status.reachable
      ? 'local link is up.'
      : 'local link is down right now.';
    const modelLine = model
      ? `Right now I'm riding on ${model}.`
      : 'LM Studio is reachable, but there is not a resolved chat model loaded yet.';
    const transportLine = `Transport is ${status.localTransport || LOCAL_LLM_TRANSPORT}.`;
    const installCount = Array.isArray(status.installedModels) ? status.installedModels.length : 0;
    const inventoryLine = installCount
      ? `I can also see ${installCount} installed local model${installCount === 1 ? '' : 's'} on disk.`
      : '';
    return `${reachability} ${modelLine} ${transportLine}${inventoryLine ? ` ${inventoryLine}` : ''}\n[MOOD:thinking]`;
  }

  function composeDirectSyntaxReply(result = {}) {
    const pathLabel = result.path || 'that file';
    if (result.ok === false) {
      const detail = String(result.stderr || result.stdout || 'Node reported a syntax failure.').trim();
      return `${pathLabel} did not pass \`node --check\`. ${detail}\n[MOOD:annoyed]`;
    }
    return `${pathLabel} passes \`node --check\`. no syntax panic, no exploding brackets, we're fine.\n[MOOD:smug]`;
  }

  function composeDirectGitStatusReply(result = {}) {
    if (result.ok === false) {
      return `git status did not cooperate. ${String(result.stderr || 'Something blocked it.').trim()}\n[MOOD:annoyed]`;
    }
    const status = String(result.status || '').trim();
    if (!status || status === '(clean)') {
      return `git is clean right now. no local changes waiting to bite us.\n[MOOD:calm]`;
    }
    return `here's the current git status:\n${status}\n[MOOD:thinking]`;
  }

  function composeDirectSearchReply(result = {}) {
    const query = String(result.query || '').trim() || 'that search';
    const hits = Array.isArray(result.hits) ? result.hits : [];
    if (!hits.length) {
      return `i searched for "${query}" and came up empty. if you want, i can try a broader phrase next.\n[MOOD:thinking]`;
    }
    const preview = hits
      .slice(0, 5)
      .map((hit) => `- ${hit.path}:${hit.line} ${hit.text}`)
      .join('\n');
    return `i searched for "${query}" and found the strongest hits here:\n${preview}\n[MOOD:thinking]`;
  }

  function shouldUseDirectReadReply(userText = '') {
    const lower = String(userText || '').toLowerCase();
    if (!lower) return false;
    return /\b(do not edit|don't edit|did you change|did you verify|whether you changed|whether you verified|current note string|what does it say|just tell me|just show me)\b/.test(lower);
  }

  function composeDirectReadReply(result = {}) {
    const pathLabel = String(result.path || 'that file').trim();
    const query = String(result.query || '').trim();
    const excerpt = String(result.excerpt || '').trim();
    const scope = query
      ? `around "${query}" in ${pathLabel}`
      : `${pathLabel} lines ${result.startLine || result.matchLine || 1}-${result.endLine || result.startLine || result.matchLine || 1}`;
    const intro = `i inspected ${scope}. i did not edit anything, and i did not run a verification step.`;
    return excerpt
      ? `${intro}\n\n${excerpt}\n[MOOD:thinking]`
      : `${intro}\n[MOOD:thinking]`;
  }

  function composeDirectFileListReply(result = {}) {
    const query = String(result.pattern || '').trim() || 'that';
    const items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) {
      return `i looked through the repo for "${query}" as a folder/file name and came up empty. if you want, i can try a broader term or inspect a specific path next.\n[MOOD:thinking]`;
    }
    const preview = items
      .slice(0, 8)
      .map((item) => `- ${item}`)
      .join('\n');
    return `i found "${query}" in the repo here:\n${preview}\n[MOOD:smug]`;
  }

  function composeDirectWebSearchReply(result = {}) {
    const query = String(result.query || '').trim() || 'that';
    const results = Array.isArray(result.results) ? result.results : [];
    if (!results.length) {
      return `i searched the web for "${query}" and it came back weirdly empty. the internet is being a little bitch about it.\n[MOOD:annoyed]`;
    }
    const preview = results
      .slice(0, 4)
      .map((item, idx) => {
        const snippet = item.snippet ? ` - ${item.snippet}` : '';
        return `${idx + 1}. ${item.title}\n   ${item.url}${snippet}`;
      })
      .join('\n');
    return `i searched the live web for "${query}". strongest hits:\n${preview}\n[MOOD:thinking]`;
  }

  function composeDirectWebPageReply(result = {}) {
    const title = String(result.title || '').trim();
    const url = String(result.url || result.requestedUrl || '').trim();
    const excerpt = truncateText(String(result.text || '').trim(), 900);
    const heading = title ? `${title}` : (url || 'that page');
    if (!excerpt) {
      return `i pulled ${heading}, but the page did not cough up usable text. rude.\n[MOOD:annoyed]`;
    }
    return `i pulled ${heading}${url ? `\n${url}` : ''}\n\nhere's the useful bit:\n${excerpt}\n[MOOD:thinking]`;
  }

  function takeFirstUsefulSentence(text = '', limit = 280) {
    const cleaned = collapseWhitespace(String(text || '').replace(/\s+/g, ' ').trim());
    if (!cleaned) return '';
    const sentenceMatch = cleaned.match(/^(.{1,280}?[.!?])(?:\s|$)/);
    if (sentenceMatch?.[1]) return sentenceMatch[1].trim();
    return truncateText(cleaned, limit);
  }

  function composeToolRecordFallback(toolRecords = []) {
    const records = Array.isArray(toolRecords) ? toolRecords : [];
    const insert = records.find((record) => record?.name === 'insert_in_project_file' && record?.result?.ok && record?.result?.data);
    if (insert) {
      const pathLabel = insert.result.data.path || 'that file';
      const snippet = truncateText(cleanDirectInstructionContent(String(insert.args?.text || insert.result.data?.textPreview || '').trim()), 1200);
      if (snippet) {
        return `i added this to ${pathLabel}:\n${snippet}\n[MOOD:smug]`;
      }
      return `i added the new text to ${pathLabel}. the change landed.\n[MOOD:smug]`;
    }
    const replace = records.find((record) => record?.name === 'replace_in_project_file' && record?.result?.ok && record?.result?.data);
    if (replace) {
      const pathLabel = replace.result.data.path || 'that file';
      const find = truncateText(String(replace.args?.find || '').trim(), 120);
      const next = truncateText(String(replace.args?.replace || '').trim(), 160);
      const replaced = Number(replace.result.data?.replaced || 0);
      if (find && next) {
        return `i updated ${pathLabel} by replacing ${replaced || 1} match${replaced === 1 ? '' : 'es'} of "${find}" with "${next}".\n[MOOD:smug]`;
      }
      return `i updated ${pathLabel} and the replacement landed.\n[MOOD:smug]`;
    }
    const write = records.find((record) => record?.name === 'write_project_file' && record?.result?.ok && record?.result?.data);
    if (write) {
      const pathLabel = write.result.data.path || 'that file';
      const action = write.result.data.action === 'created' ? 'created' : 'updated';
      return `i ${action} ${pathLabel}. the file is in place.\n[MOOD:smug]`;
    }
    const page = records.find((record) => record?.name === 'read_web_page' && record?.result?.ok && record?.result?.data);
    if (page) {
      const data = page.result.data;
      const heading = String(data.title || data.url || data.requestedUrl || 'that page').trim();
      const url = String(data.url || data.requestedUrl || '').trim();
      const sentence = takeFirstUsefulSentence(data.text, 260);
      if (sentence) {
        return `i checked ${heading}${url ? `\n${url}` : ''}\n\nshort version: ${sentence}\n[MOOD:thinking]`;
      }
      return `i checked ${heading}${url ? `\n${url}` : ''}, but the page text came back annoyingly thin.\n[MOOD:annoyed]`;
    }
    const web = records.find((record) => record?.name === 'search_web' && record?.result?.ok && Array.isArray(record?.result?.data?.results));
    if (web) {
      const results = web.result.data.results;
      if (!results.length) {
        return `i searched the web for "${web.result.data.query || 'that topic'}" and came up empty.\n[MOOD:annoyed]`;
      }
      const top = results[0];
      const snippet = truncateText(String(top?.snippet || '').trim(), 220);
      if (snippet) {
        return `i found the strongest live-web hit for "${web.result.data.query || 'that topic'}":\n${top.title}\n${top.url}\n\nshort version: ${snippet}\n[MOOD:thinking]`;
      }
      return `i found the strongest live-web hit for "${web.result.data.query || 'that topic'}":\n${top.title}\n${top.url}\n[MOOD:thinking]`;
    }
    const read = records.find((record) => record?.name === 'read_project_file' || record?.name === 'read_project_file_around_match');
    if (read?.result?.ok && read.result.data) {
      const data = read.result.data;
      const pathLabel = data.path || 'that file';
      const startLine = data.startLine || data.matchLine || '?';
      const endLine = data.endLine || startLine;
      return `i pulled the relevant code in ${pathLabel} around lines ${startLine}-${endLine}. the verified context is there, i just don't want to bluff the explanation.\n[MOOD:thinking]`;
    }
    const search = records.find((record) => record?.name === 'search_project_text');
    if (search?.result?.ok && Array.isArray(search.result.data?.hits)) {
      const hits = search.result.data.hits;
      if (!hits.length) {
        return `i searched for "${search.result.data.query || 'that symbol'}" and came up empty.\n[MOOD:annoyed]`;
      }
      const top = hits[0];
      return `i found the strongest hit for "${search.result.data.query || 'that symbol'}" in ${top.path}:${top.line}. if you want the exact excerpt, i can pull more around it.\n[MOOD:thinking]`;
    }
    return '';
  }

  function hasToolRecordName(toolRecords = [], names = []) {
    const wanted = new Set(names);
    return Array.isArray(toolRecords) && toolRecords.some((record) => wanted.has(String(record?.name || '').trim()));
  }

  function looksLikeWeakToolReply(text = '', toolRecords = []) {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    if (!stripped) return true;
    const hasEdit = hasToolRecordName(toolRecords, ['insert_in_project_file', 'replace_in_project_file', 'write_project_file']);
    if (!hasEdit) return false;
    const insert = Array.isArray(toolRecords)
      ? toolRecords.find((record) => record?.name === 'insert_in_project_file' && record?.result?.ok)
      : null;
    if (insert) {
      const snippet = collapseWhitespace(
        String(insert?.result?.data?.textPreview || insert?.args?.text || '')
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
          .trim(),
      );
      const normalizedReply = collapseWhitespace(stripped).toLowerCase();
      const normalizedSnippet = snippet.toLowerCase();
      if (normalizedSnippet && /\b(exactly what i added|here is exactly what i added|here's exactly what i added|micro-story i added|paragraph i added|i added this)\b/i.test(normalizedReply)) {
        if (!normalizedReply.includes(normalizedSnippet)) return true;
      }
    }
    if (((stripped.match(/`/g) || []).length % 2) === 1) return true;
    if (stripped.length < 70) return true;
    if (!/[.!?][)"'`]*$/.test(stripped) && stripped.length < 180) return true;
    return false;
  }

  return {
    extractExplicitProjectPath,
    cleanDirectInstructionContent,
    parseDirectWriteInstruction,
    parseDirectReplaceInstruction,
    parseDirectAppendInstruction,
    extractDirectWebQuery,
    extractDirectSearchQuery,
    looksLikeProjectPathDiscoveryIntent,
    looksLikeDirectProjectInspectIntent,
    looksLikeOpenEndedProjectEdit,
    shouldForceLocalToolLoop,
    resolveDirectToolIntent,
    composeDirectRuntimeReply,
    composeDirectSyntaxReply,
    composeDirectGitStatusReply,
    composeDirectSearchReply,
    composeDirectReadReply,
    composeDirectFileListReply,
    composeDirectWebSearchReply,
    composeDirectWebPageReply,
    composeToolRecordFallback,
    looksLikeWeakToolReply,
    shouldUseDirectReadReply,
  };
}

module.exports = {
  createDirectIntentApi,
};
