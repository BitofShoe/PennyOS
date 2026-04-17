function createDirectIntentReplyApi({
  truncateText,
  stripReplyMoodTags,
  LOCAL_LLM_TRANSPORT,
} = {}) {
  if (typeof truncateText !== 'function') {
    throw new TypeError('createDirectIntentReplyApi requires truncateText');
  }
  if (typeof stripReplyMoodTags !== 'function') {
    throw new TypeError('createDirectIntentReplyApi requires stripReplyMoodTags');
  }

  function cleanDirectInstructionContent(text = '') {
    let cleaned = String(text || '').trim();
    cleaned = cleaned.replace(/^```[a-z0-9_-]*\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();
    cleaned = cleaned.replace(/\s+then\s+(?:verify|check|tell|show|explain)\b[\s\S]*$/i, '').trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"'))
      || (cleaned.startsWith("'") && cleaned.endsWith("'"))
      || (cleaned.startsWith('`') && cleaned.endsWith('`'))) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned.replace(/\r\n/g, '\n');
  }

  function takeFirstUsefulSentence(text = '', limit = 280) {
    const cleaned = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    const sentenceMatch = cleaned.match(/^(.{1,280}?[.!?])(?:\s|$)/);
    if (sentenceMatch?.[1]) return sentenceMatch[1].trim();
    return truncateText(cleaned, limit);
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

  function composeDirectReadReply(result = {}) {
    const pathLabel = String(result.path || 'that file').trim();
    const query = String(result.query || '').trim();
    const questionType = String(result.questionType || '').trim().toLowerCase();
    const excerpt = String(result.excerpt || '').trim();
    const error = String(result.error || '').trim();
    if (error) {
      const scope = query
        ? `${pathLabel} for "${query}"`
        : pathLabel;
      if (query && /could not find/i.test(error)) {
        return `i checked ${scope}, and there is no matching line there. i did not edit anything, and i did not run a verification step.\n[MOOD:thinking]`;
      }
      return `i tried to inspect ${scope}, but it blew up: ${error}\n\ni did not edit anything, and i did not run a verification step.\n[MOOD:annoyed]`;
    }
    if (query) {
      const excerptLines = String(excerpt || '')
        .split('\n')
        .map((line) => {
          const match = line.match(/^(\d+):(.*)$/);
          if (match) {
            return { lineNumber: Number(match[1]), text: String(match[2] || '').trim() };
          }
          return { lineNumber: null, text: String(line || '').trim() };
        })
        .filter((line) => line.text);
      const escaped = String(query || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const looksLikeDefinitionLine = (lineText = '') => {
        const line = String(lineText || '').trim();
        if (!line || !query) return false;
        return new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b`).test(line)
          || new RegExp(`\\bfunction\\s+${escaped}\\b`).test(line)
          || new RegExp(`\\bclass\\s+${escaped}\\b`).test(line)
          || new RegExp(`\\b${escaped}\\s*=`).test(line)
          || new RegExp(`\\b${escaped}\\s*:`).test(line)
          || new RegExp(`\\bmodule\\.exports\\.${escaped}\\b`).test(line)
          || new RegExp(`\\bexports\\.${escaped}\\b`).test(line);
      };
      const matchingLines = excerptLines.filter((line) => line.text.toLowerCase().includes(query.toLowerCase()));
      const focusLine = (questionType === 'definition'
        ? matchingLines.find((line) => looksLikeDefinitionLine(line.text))
        : null)
        || matchingLines[0]
        || excerptLines.find((line) => line.text);
      const focusLineNumber = focusLine?.lineNumber || result.matchLine || result.startLine || 1;
      const supportText = focusLine?.text ? truncateText(focusLine.text, 220) : '';
      const answer = questionType === 'definition'
        ? (supportText && looksLikeDefinitionLine(supportText)
          ? `i checked ${pathLabel} for "${query}". short version: ${query} looks defined around line ${focusLineNumber}.`
          : `i checked ${pathLabel} for "${query}". short version: ${pathLabel} does not appear to define ${query} there; the strongest live mention is around line ${focusLineNumber}.`)
        : (supportText
          ? `i checked ${pathLabel} for "${query}". short version: it does mention ${query} around line ${focusLineNumber}.`
          : `i checked ${pathLabel} for "${query}". short version: there is relevant context around line ${focusLineNumber}.`);
      const support = supportText
        ? `\n\nsupporting line ${focusLineNumber}: ${supportText}`
        : '';
      return `${answer}${support}\n\ni did not edit anything, and i did not run a verification step.\n[MOOD:thinking]`;
    }
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

  function cleanDirectInstructionContent(text = '') {
    let cleaned = String(text || '').trim();
    cleaned = cleaned.replace(/^```[a-z0-9_-]*\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"'))
      || (cleaned.startsWith("'") && cleaned.endsWith("'"))
      || (cleaned.startsWith('`') && cleaned.endsWith('`'))) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned.replace(/\r\n/g, '\n');
  }

  function normalizeDirectLineSnippet(text = '') {
    const content = cleanDirectInstructionContent(text);
    if (!content) return '';
    const natural = content.replace(/\s*,\s*$/, '').trim();
    const logMatch = natural.match(/^logs?\s+["'`]([\s\S]*?)["'`]$/i);
    if (logMatch) return `console.log(${JSON.stringify(logMatch[1])});`;
    return content;
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
      const snippet = String(insert?.result?.data?.textPreview || insert?.args?.text || '')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '')
        .trim()
        .replace(/\s+/g, ' ');
      const normalizedReply = String(stripped).replace(/\s+/g, ' ').trim().toLowerCase();
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
  };
}

module.exports = {
  createDirectIntentReplyApi,
};
