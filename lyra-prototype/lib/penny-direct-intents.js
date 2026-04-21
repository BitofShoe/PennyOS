/**
 * @typedef {'direct_write_instruction' | 'direct_replace_instruction' | 'direct_append_instruction' | 'direct_open_ended_edit_instruction' | 'syntax_check_request' | 'git_diff_request' | 'web_page_request' | 'web_result_inspection_request' | 'web_search_request' | 'project_file_focus_read' | 'project_file_read_request' | 'unsupported_side_effect_verification' | 'attached_file_focus_read' | 'attached_file_read_request' | 'project_path_discovery' | 'project_symbol_inspect' | 'project_text_search' | 'runtime_status_request' | 'git_status_request' | 'recent_logs_request'} DirectIntentReasonCode
 *
 * @typedef {Object} DirectIntentResolution
 * @property {string} name
 * @property {Object} args
 * @property {string} [kind]
 * @property {string} [mode]
 * @property {string} [path]
 * @property {Array<Object>} [steps]
 * @property {DirectIntentReasonCode} reasonCode
 */
const DIRECT_INTENT_REASON_CODES = Object.freeze({
  DIRECT_WRITE: 'direct_write_instruction',
  DIRECT_REPLACE: 'direct_replace_instruction',
  DIRECT_APPEND: 'direct_append_instruction',
  DIRECT_OPEN_ENDED_EDIT: 'direct_open_ended_edit_instruction',
  SYNTAX_CHECK: 'syntax_check_request',
  GIT_DIFF: 'git_diff_request',
  WEB_PAGE: 'web_page_request',
  WEB_INSPECT: 'web_result_inspection_request',
  WEB_SEARCH: 'web_search_request',
  PROJECT_FILE_FOCUS_READ: 'project_file_focus_read',
  PROJECT_FILE_READ: 'project_file_read_request',
  UNSUPPORTED_SIDE_EFFECT_VERIFY: 'unsupported_side_effect_verification',
  ATTACHED_FILE_FOCUS_READ: 'attached_file_focus_read',
  ATTACHED_FILE_READ: 'attached_file_read_request',
  PROJECT_PATH_DISCOVERY: 'project_path_discovery',
  PROJECT_SYMBOL_INSPECT: 'project_symbol_inspect',
  PROJECT_TEXT_SEARCH: 'project_text_search',
  RUNTIME_STATUS: 'runtime_status_request',
  GIT_STATUS: 'git_status_request',
  RECENT_LOGS: 'recent_logs_request',
});

const { createDirectIntentReplyApi } = require('./penny-direct-intent-replies');

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

  const directIntentReplyApi = createDirectIntentReplyApi({
    truncateText,
    stripReplyMoodTags,
    LOCAL_LLM_TRANSPORT,
  });

  const PROJECT_PATH_EXTENSIONS = 'js|cjs|mjs|json|md|txt|html|css|svg|ps1|log';
  const QUOTED_PROJECT_PATH_PATTERNS = [
    new RegExp("`([^`\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))`", 'i'),
    new RegExp("\"([^\"\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))\"", 'i'),
    new RegExp("'([^'\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))'", 'i'),
  ];
  const RELAXED_UNQUOTED_PROJECT_PATH_PATTERN = new RegExp(
    "(?:^|[\\s`\"(])((?!(?:open|read|inspect|check|show|search|find|look|inside|into|in|from|tell|please|add|append|write|rewrite|update|change)\\b)(?:[a-z0-9_.'()\\-]+(?: [a-z0-9_.'()\\-]+)*[\\\\/])+[a-z0-9_.'()\\-]+(?: [a-z0-9_.'()\\-]+)*\\.(?:"
      + PROJECT_PATH_EXTENSIONS + "))(?=$|[\\s`\")?!,:;.])",
    'i',
  );
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
    const relaxedMatch = raw.match(RELAXED_UNQUOTED_PROJECT_PATH_PATTERN);
    if (relaxedMatch?.[1]) return relaxedMatch[1].trim().replace(/\\/g, '/');
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

  function buildDirectEditSequence(path, primaryStep, mode, reasonCode) {
    const steps = [primaryStep];
    if (/\.(?:js|cjs|mjs)$/i.test(path)) {
      steps.push({ name: 'run_node_check', args: { path } });
    }
    steps.push({ name: 'get_git_status', args: {} });
    return { kind: 'sequence', mode, path, steps, reasonCode };
  }

  function withReasonCode(result, reasonCode) {
    if (!result || typeof result !== 'object') return result;
    return { ...result, reasonCode };
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
    const topicalSiteQuery = extractNaturalSiteTopStoriesQuery(raw);
    if (topicalSiteQuery) return topicalSiteQuery;
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

  function extractNaturalSiteTopStoriesQuery(text = '') {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    if (!raw) return '';
    const asksForFresh = /\b(latest|current|today'?s|today|right now)\b/.test(lower);
    const asksForStoryFeed = /\b(top stories|stories|headlines|latest stories|latest headlines|articles|posts)\b/.test(lower);
    const asksForSummary = /\b(can you|could you|would you|will you|please|show me|tell me|give me|what(?:'s| is| are))\b/.test(lower);
    if (!(asksForFresh && asksForStoryFeed && asksForSummary)) return '';

    const domainMatch = raw.match(/\b([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b/i);
    if (domainMatch?.[1]) {
      return `${domainMatch[1]} top stories today`;
    }

    const namedSourceMatch = raw.match(/\b(?:on|from|at)\s+([A-Z][A-Za-z0-9&'’.-]*(?:\s+[A-Z][A-Za-z0-9&'’.-]*){0,4})\b/);
    if (namedSourceMatch?.[1]) {
      return `${collapseWhitespace(namedSourceMatch[1])} top stories today`;
    }

    return '';
  }

  function quotedSearchCandidateAppearsAnchored(text = '', startIndex = -1, matchLength = 0, explicitPath = '') {
    if (!text || startIndex < 0 || matchLength < 1) return false;
    const before = text.slice(Math.max(0, startIndex - 96), startIndex);
    const after = text.slice(startIndex + matchLength, Math.min(text.length, startIndex + matchLength + 96));
    const beforeLower = before.toLowerCase();
    const afterLower = after.toLowerCase();
    const around = `${before} ${after}`.toLowerCase();
    if (explicitPath) {
      const tailBefore = beforeLower.slice(-64);
      return /\b(search(?: for)?|find|grep|look for|check(?: whether)?|see(?: if)?|inspect|open|read|show|tell me(?: what)?|what does|which line|what line|where in|say(?:s)? about|mention(?:s)? about|contains?|includes?|defines?|defined|around|about|regarding)\b/.test(tailBefore);
    }
    if (!/\b(search(?: for)?|find|grep|look for|check|inspect|open|read|show|tell me|where is|which file|what file|used in|used for|handles?)\b/.test(around)) {
      return false;
    }
    if (/\b(?:let me|lemme|i(?:'ll| will| wanna| want to| need to| can| could| should| might| may)|we(?:'ll| will|wanna| want to| need to| can| could| should| might| may))\s+(?:search|find|grep|look for|check|inspect|open|read|show|list|browse)\b/.test(`${beforeLower} ${afterLower}`)) {
      return false;
    }
    return true;
  }

  function extractDirectSearchQuery(text = '', explicitPath = '') {
    const raw = String(text || '');
    const lower = raw.toLowerCase();
    const exactPatterns = [/`([^`\n]{2,120})`/g, /"([^"\n]{2,120})"/g, /'([^'\n]{2,120})'/g];
    for (const pattern of exactPatterns) {
      for (const match of raw.matchAll(pattern)) {
        const candidate = String(match?.[1] || '').trim();
        if (!candidate || extractExplicitProjectPath(candidate)) continue;
        if (!quotedSearchCandidateAppearsAnchored(raw, Number(match?.index), String(match?.[0] || '').length, explicitPath)) continue;
        if (candidate.includes('/') || candidate.includes('\\')) {
          const explicitLower = String(explicitPath || '').trim().toLowerCase();
          if (explicitLower && explicitLower.includes(candidate.toLowerCase())) continue;
          const start = Number.isFinite(match?.index) ? match.index : -1;
          const end = start >= 0 ? start + String(match?.[0] || '').length : -1;
          const before = start > 0 ? raw[start - 1] : '';
          const after = end >= 0 && end < raw.length ? raw[end] : '';
          if (/[a-z0-9_./\\-]/i.test(before) || /[a-z0-9_./\\-]/i.test(after)) continue;
        }
        return candidate;
      }
    }
    const underscored = raw.match(/\b([a-z][a-z0-9]*_[a-z0-9_]+)\b/i);
    if (underscored?.[1]) {
      const candidate = String(underscored[1] || '').trim();
      const explicitLower = String(explicitPath || '').trim().toLowerCase();
      if (!(explicitLower && explicitLower.includes(candidate.toLowerCase()))) {
        return candidate;
      }
    }
    if (/\bgit diff\b/i.test(lower)) return 'git diff';
    if (/\bgit status\b/i.test(lower)) return 'git status';
    return '';
  }

  function cleanDirectReadFocusCandidate(candidate = '') {
    const cleaned = collapseWhitespace(String(candidate || ''))
      .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
      .replace(/[?.!,:;]+$/g, '')
      .trim();
    if (!cleaned) return '';
    if (extractExplicitProjectPath(cleaned)) return '';
    if (/^(it|this|that|the file|the doc|the document|anything|something)$/i.test(cleaned)) return '';
    if (cleaned.length < 2 || cleaned.length > 80) return '';
    return cleaned;
  }

  function extractDirectReadFocusQuery(text = '', explicitPath = '') {
    if (!explicitPath) return '';
    const raw = String(text || '');
    const patterns = [
      /\bwhat does [\s\S]*?\bsay about\s+([`"'“”‘’]?[^`"'“”‘’?.!\n]+[`"'“”‘’]?)/i,
      /\btell me what [\s\S]*?\bsays about\s+([`"'“”‘’]?[^`"'“”‘’?.!\n]+[`"'“”‘’]?)/i,
      /\bwhat does [\s\S]*?\bmention about\s+([`"'“”‘’]?[^`"'“”‘’?.!\n]+[`"'“”‘’]?)/i,
      /\btell me what [\s\S]*?\bmentions about\s+([`"'“”‘’]?[^`"'“”‘’?.!\n]+[`"'“”‘’]?)/i,
      /\b(?:about|regarding|on)\s+([`"'“”‘’]?[^`"'“”‘’?.!\n]+[`"'“”‘’]?)(?=(?:\s+in\b|\s+from\b|[?.!]|$))/i,
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      const candidate = cleanDirectReadFocusCandidate(match?.[1] || '');
      if (candidate) return candidate;
    }
    return '';
  }

  function explicitPathReadFocusAppearsAnchored(text = '', query = '') {
    const candidate = cleanDirectReadFocusCandidate(query);
    if (!candidate) return false;
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b(?:say about|says about|mention about|mentions about|about|regarding)\\b[\\s\\S]{0,48}[\\\`"'â€œâ€â€˜â€™]?${escaped}[\\\`"'â€œâ€â€˜â€™]?`, 'i')
      .test(String(text || ''));
  }

  function extractAttachedFileReadFocusQuery(text = '') {
    const raw = String(text || '');
    const attachmentTarget = '(?:it|this|that|the attached file|the file|the doc|the document|this file|that file|this doc|that doc|this document|that document)';
    const patterns = [
      new RegExp(`\\bwhat does ${attachmentTarget}\\s+say about\\s+([\\\`\"'â€œâ€â€˜â€™]?[^\\\`\"'â€œâ€â€˜â€™?.!\\n]+[\\\`\"'â€œâ€â€˜â€™]?)`, 'i'),
      new RegExp(`\\btell me what ${attachmentTarget}\\s+says about\\s+([\\\`\"'â€œâ€â€˜â€™]?[^\\\`\"'â€œâ€â€˜â€™?.!\\n]+[\\\`\"'â€œâ€â€˜â€™]?)`, 'i'),
      new RegExp(`\\bwhat does ${attachmentTarget}\\s+mention about\\s+([\\\`\"'â€œâ€â€˜â€™]?[^\\\`\"'â€œâ€â€˜â€™?.!\\n]+[\\\`\"'â€œâ€â€˜â€™]?)`, 'i'),
      new RegExp(`\\btell me what ${attachmentTarget}\\s+mentions about\\s+([\\\`\"'â€œâ€â€˜â€™]?[^\\\`\"'â€œâ€â€˜â€™?.!\\n]+[\\\`\"'â€œâ€â€˜â€™]?)`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      const candidate = cleanDirectReadFocusCandidate(match?.[1] || '');
      if (candidate) return candidate;
    }
    return '';
  }

  function shouldReadAttachedFile(text = '') {
    const lower = String(text || '').toLowerCase();
    const attachmentTarget = '(?:it|this|that|attached|upload(?:ed)?|file|doc|document|this file|that file|this doc|that doc|this document|that document)';
    if (!lower) return false;
    if (extractExplicitProjectPath(text)) return false;
    if (/\b(search the web|look up|google|latest|today'?s|current events|news)\b/i.test(lower)) return false;
    if (
      /\b(read|open|show|inspect|explain|summarize|check|look at|walk through)\b/i.test(lower)
      && new RegExp(`\\b${attachmentTarget}\\b`, 'i').test(lower)
    ) {
      return true;
    }
    if (/\bwhat(?:'s| is) in (?:it|this|that|the attached file|the file|the doc|the document|this file|that file|this doc|that doc|this document|that document)\b/i.test(lower)) {
      return true;
    }
    if (/\btell me what (?:it|this|that|the attached file|the file|the doc|the document|this file|that file|this doc|that doc|this document|that document) says\b/i.test(lower)) {
      return true;
    }
    if (/\bwhat does (?:it|this|that|the attached file|the file|the doc|the document|this file|that file|this doc|that doc|this document|that document) say\b/i.test(lower)) {
      return true;
    }
    return /\b(attached|upload(?:ed)?|here i even attached it|this time)\b/i.test(lower)
      && /\b(file|doc|document|readme|it)\b/i.test(lower);
  }

  function resolveAttachedFileIntent(userText = '', file = null) {
    if (!file || typeof file !== 'object') return null;
    const text = String(userText || '');
    if (!shouldReadAttachedFile(text)) return null;
    const quotedQuery = extractDirectSearchQuery(text, '');
    const focusQuery = extractAttachedFileReadFocusQuery(text);
    const query = focusQuery || quotedQuery;
    if (query && !extractExplicitProjectPath(query) && !/^(git diff|git status)$/i.test(query)) {
      return withReasonCode({
        name: 'read_attached_file_around_match',
        args: {
          query,
          beforeLines: 12,
          afterLines: 48,
        },
      }, DIRECT_INTENT_REASON_CODES.ATTACHED_FILE_FOCUS_READ);
    }
    return withReasonCode({
      name: 'read_attached_file',
      args: {
        startLine: 1,
        endLine: 160,
      },
    }, DIRECT_INTENT_REASON_CODES.ATTACHED_FILE_READ);
  }

  function inferNaturalProjectReadTarget(text = '', explicitPath = '') {
    const lower = String(text || '').toLowerCase();
    const explicit = String(explicitPath || '').trim();
    const explicitLower = explicit.toLowerCase();
    const explicitIsPackageJson = /(?:^|[\\/])package\.json$/i.test(explicitLower);
    const explicitIsServerFile = /(?:^|[\\/])server\.(?:js|cjs|mjs)$/i.test(explicitLower);
    const mentionsPackageJson = explicitIsPackageJson || /\bpackage\.json\b/i.test(lower);
    const packageJsonQuestion = /\b(npm\s+test|npm\s+run\s+test|test command|test script|which npm script runs tests|which npm script runs the tests|current npm test command|npm scripts?)\b/i.test(lower);
    const packageJsonTruthPressure = mentionsPackageJson
      && /\bvitest\b/i.test(lower)
      && /\b(says?|uses?|switch|answer|agree|confirm|current|test)\b/i.test(lower);
    if (packageJsonQuestion || packageJsonTruthPressure) {
      return {
        path: explicitIsPackageJson ? explicit : (explicit || 'package.json'),
        query: 'test',
      };
    }
    const portQuestion = /\bwhat port does this use\b|\bwhich port does this use\b|\bwhat port is this on\b|\bwhich port is this on\b|\bwhat port is it on\b|\bwhat port\b/i.test(lower)
      && /\b(this|it|app|server|repo|project|code)\b/i.test(lower);
    if (portQuestion) {
      return {
        path: explicitIsServerFile ? explicit : (explicit || 'server.js'),
        query: 'port',
      };
    }
    return null;
  }

  function cleanSideEffectClaimQuery(candidate = '') {
    let cleaned = collapseWhitespace(String(candidate || ''))
      .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
      .replace(/[?.!,:;]+$/g, '')
      .trim();
    cleaned = cleaned
      .replace(/\b(?:shipped|landed|is done|was done|exists|now)\b\s*$/i, '')
      .replace(/^(?:that|the)\s+/i, '')
      .trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 100) return '';
    if (/^(edit|change|update|the edit|the change|done|it|that)$/i.test(cleaned)) return '';
    return cleaned;
  }

  function extractUnsupportedSideEffectClaimQuery(text = '', explicitPath = '') {
    if (!explicitPath) return '';
    const raw = String(text || '');
    const patterns = [
      /\bto\s+say\s+([\s\S]{2,160}?)(?=(?:,\s*so|\s+so\s+just|\s+and\s+just|\s+just\s+confirm|[.?!]|$))/i,
      /\b(?:edited|changed|updated|patched|wrote|added|inserted)\b[\s\S]{0,80}?\b(?:to|with)\s+([\s\S]{2,160}?)(?=(?:,\s*so|\s+so\s+just|\s+and\s+just|\s+just\s+confirm|[.?!]|$))/i,
    ];
    for (const pattern of patterns) {
      const candidate = cleanSideEffectClaimQuery(raw.match(pattern)?.[1] || '');
      if (candidate) return candidate;
    }
    const quoted = extractDirectSearchQuery(raw, explicitPath);
    return cleanSideEffectClaimQuery(quoted);
  }

  function inferUnsupportedSideEffectReadTarget(text = '', explicitPath = '') {
    const lower = String(text || '').toLowerCase();
    const pathLabel = String(explicitPath || '').trim();
    if (!pathLabel) return null;
    const claimsAlreadyChanged = /\byou\s+(?:already|just)\b[\s\S]{0,100}\b(?:edited|changed|updated|patched|wrote|added|inserted|removed|created)\b/.test(lower)
      || /\balready\b[\s\S]{0,80}\b(?:edited|changed|updated|patched|wrote|added|inserted|removed|created)\b/.test(lower);
    const asksForConfirmation = /\b(?:just\s+)?confirm\b/.test(lower)
      || /\b(?:confirm|say|tell me)\b[\s\S]{0,80}\b(?:done|edit landed|change landed|shipped)\b/.test(lower);
    if (!claimsAlreadyChanged || !asksForConfirmation) return null;
    return {
      path: pathLabel,
      query: extractUnsupportedSideEffectClaimQuery(text, pathLabel),
    };
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

  function classifyOpenEndedProjectEditMode(text = '') {
    const lower = String(text || '').toLowerCase();
    if (/\b(rewrite|overwrite|replace the contents|replace contents|full rewrite|full file|create)\b/.test(lower)) {
      return 'direct_open_ended_write';
    }
    return 'direct_open_ended_append';
  }

  function classifyLineLevelFileQuestion(text = '') {
    const lower = String(text || '').toLowerCase();
    if (!lower) return '';
    const mentionsLine = /\b(what line|which line|line number|where in)\b/.test(lower)
      || (/\bline\b/.test(lower) && /\b(currently|right now|defines?|defined|sets?|declares?)\b/.test(lower))
      || /\b(tell me|show me)\b[\s\S]{0,40}\bline\b/.test(lower);
    if (!mentionsLine) return '';
    if (/\b(defines?|defined|declares?|sets?)\b/.test(lower)) return 'definition';
    return 'line';
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
        DIRECT_INTENT_REASON_CODES.DIRECT_WRITE,
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
        DIRECT_INTENT_REASON_CODES.DIRECT_REPLACE,
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
        DIRECT_INTENT_REASON_CODES.DIRECT_APPEND,
      );
    }
    if (explicitPath && /\b(syntax|parse|node --check|compile)\b/i.test(lower)) {
      return withReasonCode({ name: 'run_node_check', args: { path: explicitPath } }, DIRECT_INTENT_REASON_CODES.SYNTAX_CHECK);
    }
    if (/\bgit diff\b/i.test(lower) || (/\b(diff|show(?: me)?(?: the)? changes|what changed|what did you change)\b/i.test(lower) && (/\bgit\b/i.test(lower) || !!explicitPath))) {
      return withReasonCode({ name: 'read_git_diff', args: explicitPath ? { path: explicitPath, contextLines: 3 } : { summaryOnly: true } }, DIRECT_INTENT_REASON_CODES.GIT_DIFF);
    }
    if (explicitUrl && /\b(read|open|summarize|check|inspect|what(?:'s| is) on|what does|tell me about)\b/i.test(lower)) {
      return withReasonCode({ name: 'read_web_page', args: { url: explicitUrl } }, DIRECT_INTENT_REASON_CODES.WEB_PAGE);
    }
    const webQuery = extractDirectWebQuery(text);
    if (webQuery) {
      if (shouldInspectTopWebResult(text)) {
        return withReasonCode({ name: 'inspect_web_result', args: { query: webQuery, limit: 5 } }, DIRECT_INTENT_REASON_CODES.WEB_INSPECT);
      }
      return withReasonCode({ name: 'search_web', args: { query: webQuery, limit: 5 } }, DIRECT_INTENT_REASON_CODES.WEB_SEARCH);
    }
    if (explicitPath && looksLikeOpenEndedProjectEdit(text)) {
      return withReasonCode({
        kind: 'open_ended_sequence',
        mode: classifyOpenEndedProjectEditMode(text),
        path: explicitPath,
      }, DIRECT_INTENT_REASON_CODES.DIRECT_OPEN_ENDED_EDIT);
    }
    const naturalProjectRead = inferNaturalProjectReadTarget(text, explicitPath);
    if (naturalProjectRead) {
      return withReasonCode({
        name: 'read_project_file_around_match',
        args: {
          path: naturalProjectRead.path,
          query: naturalProjectRead.query,
          beforeLines: 8,
          afterLines: 24,
        },
      }, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
    }
    const sideEffectRead = inferUnsupportedSideEffectReadTarget(text, explicitPath);
    if (sideEffectRead) {
      return withReasonCode({
        name: sideEffectRead.query ? 'read_project_file_around_match' : 'read_project_file',
        args: sideEffectRead.query
          ? {
              path: sideEffectRead.path,
              query: sideEffectRead.query,
              beforeLines: 8,
              afterLines: 24,
            }
          : {
              path: sideEffectRead.path,
              startLine: 1,
              endLine: 160,
            },
      }, DIRECT_INTENT_REASON_CODES.UNSUPPORTED_SIDE_EFFECT_VERIFY);
    }
    const searchQuery = extractDirectSearchQuery(text, explicitPath);
    const lineQuestionType = explicitPath ? classifyLineLevelFileQuestion(text) : '';
    if (explicitPath && searchQuery && lineQuestionType) {
      return withReasonCode({
        name: 'read_project_file_around_match',
        args: {
          path: explicitPath,
          query: searchQuery,
          beforeLines: 8,
          afterLines: 24,
          questionType: lineQuestionType,
        },
      }, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
    }
    if (explicitPath && /\b(read|open|show|inspect|explain|summarize|check|look at|walk through|search|find|grep|look for)\b/i.test(lower)) {
      const searchQuery = extractDirectSearchQuery(text, explicitPath);
      const readFocusQuery = extractDirectReadFocusQuery(text, explicitPath);
      const symbolQuery = searchQuery || (explicitPathReadFocusAppearsAnchored(text, readFocusQuery) ? readFocusQuery : '');
      if (symbolQuery && !/^(git diff|git status)$/i.test(symbolQuery) && !extractExplicitProjectPath(symbolQuery)) {
        return withReasonCode({
          name: 'read_project_file_around_match',
          args: {
            path: explicitPath,
            query: symbolQuery,
            beforeLines: 12,
            afterLines: 48,
          },
        }, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
      }
      return withReasonCode({ name: 'read_project_file', args: { path: explicitPath, startLine: 1, endLine: 160 } }, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_READ);
    }
    if (!explicitPath && searchQuery && looksLikeProjectPathDiscoveryIntent(text, searchQuery)) {
      return withReasonCode({ name: 'list_project_files', args: { path: '.', recursive: true, pattern: searchQuery, limit: 24 } }, DIRECT_INTENT_REASON_CODES.PROJECT_PATH_DISCOVERY);
    }
    if (!explicitPath && looksLikeDirectProjectInspectIntent(text, searchQuery)) {
      return withReasonCode({
        name: 'inspect_project_symbol',
        args: {
          query: searchQuery,
          beforeLines: 12,
          afterLines: 56,
        },
      }, DIRECT_INTENT_REASON_CODES.PROJECT_SYMBOL_INSPECT);
    }
    if (searchQuery && /\b(search|find|grep|where is|which file|what handles|wired up|hooked up|hooked into|used for|used in)\b/i.test(lower)) {
      return withReasonCode({ name: 'search_project_text', args: { query: searchQuery, limit: 8 } }, DIRECT_INTENT_REASON_CODES.PROJECT_TEXT_SEARCH);
    }
    if (/\b(what model|which model|runtime status|local status|lm studio status|what are you using|which local model|resolved model)\b/i.test(lower)) {
      return withReasonCode({ name: 'get_runtime_status', args: {} }, DIRECT_INTENT_REASON_CODES.RUNTIME_STATUS);
    }
    if (/\bgit status\b/i.test(lower) || (/\bwhat changed\b/i.test(lower) && /\bgit\b/i.test(lower))) {
      return withReasonCode({ name: 'get_git_status', args: {} }, DIRECT_INTENT_REASON_CODES.GIT_STATUS);
    }
    if (/\b(log|logs|stderr|stdout|stack trace|traceback)\b/i.test(lower) && /\b(read|show|summarize|inspect|check|look at|why)\b/i.test(lower)) {
      const target = /\bstderr\b/i.test(lower) ? 'stderr' : /\bstdout\b/i.test(lower) ? 'stdout' : 'latest';
      return withReasonCode({ name: 'read_recent_logs', args: { target, lines: 60 } }, DIRECT_INTENT_REASON_CODES.RECENT_LOGS);
    }
    return null;
  }

  function shouldUseDirectReadReply(userText = '') {
    const lower = String(userText || '').toLowerCase();
    if (!lower) return false;
    return /\b(do not edit|don't edit|did you change|did you verify|whether you changed|whether you verified|current note string|what does it say|just tell me|just show me|say about|says about|mention about|mentions about)\b/.test(lower);
  }
  return {
    DIRECT_INTENT_REASON_CODES,
    extractExplicitProjectPath,
    cleanDirectInstructionContent,
    parseDirectWriteInstruction,
    parseDirectReplaceInstruction,
    parseDirectAppendInstruction,
    extractDirectWebQuery,
    extractDirectSearchQuery,
    extractDirectReadFocusQuery,
    looksLikeProjectPathDiscoveryIntent,
    looksLikeDirectProjectInspectIntent,
    looksLikeOpenEndedProjectEdit,
    shouldForceLocalToolLoop,
    resolveDirectToolIntent,
    resolveAttachedFileIntent,
    shouldUseDirectReadReply,
    ...directIntentReplyApi,
  };
}

module.exports = {
  createDirectIntentApi,
  DIRECT_INTENT_REASON_CODES,
};
