const DIRECTED_TOOL_REQUEST_RE = /\b(can you|could you|would you|will you|please|try|use|tell me|show me)\b/;
const QUESTION_TOOL_REQUEST_RE = /\b(what|which|where|why|how)\b/;
const TOOL_VERB_PATTERN = '(?:check|show|tell me|read|open|inspect|search|find|grep|list|scan|summarize|explain|walk through|look up|look into|look at|fix|change|edit|update|patch|rewrite|refactor|implement|add|remove|create|build|test|lint|run|debug|compare|review)';
const IMPERATIVE_TOOL_REQUEST_RE = new RegExp(
  '^\\s*(?:hey\\s+penny[,! ]+)?(?:(?:in|inside|within)\\s+[^,.!?]+,\\s*)?' + TOOL_VERB_PATTERN + '\\b',
  'i',
);
const SELF_DIRECTED_TOOL_ACTION_RE = new RegExp(
  '\\b(?:let me|lemme|i(?:\'ll| will| wanna| want to| need to| can| could| should| might| may| am going to|\'m gonna)|we(?:\'ll| will| wanna| want to| need to| can| could| should| might| may| are going to|\'re gonna))\\s+'
    + TOOL_VERB_PATTERN + '\\b',
  'i',
);

function looksLikeActionableToolRequest(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  if (/\b(git diff|git status|node --check)\b/.test(lower)) return true;
  if (DIRECTED_TOOL_REQUEST_RE.test(lower)) return true;
  if (QUESTION_TOOL_REQUEST_RE.test(lower) && /\?/.test(lower)) return true;
  if (IMPERATIVE_TOOL_REQUEST_RE.test(lower)) return true;
  if (SELF_DIRECTED_TOOL_ACTION_RE.test(lower)) return false;
  return false;
}

function looksLikeCasualFeatureMention(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  const selfNarration = /\b(i|i've|i have|i just|we|we've|we have|my human|spent all day|all day)\b/.test(lower);
  const changeVerb = /\b(added|gave|taught|trained|built|coded|implemented|made|hooked up|wired up|turned you into)\b/.test(lower);
  const featureMention = /\b(agent|agentic|web|web search|internet|attach files?|attachments?|code|coding|tool|tools)\b/.test(lower);
  const explicitAsk = /\b(can you|could you|would you|will you|please|try|use|check|show|tell me|read|open|inspect|explain|look up|look into|look at|fix|change|edit|update|patch|rewrite|refactor|implement|add|remove|create|build|test|lint|run|debug|compare|review)\b/.test(lower)
    || (/\b(what|which|where|why|how)\b/.test(lower) && /\?/.test(lower));
  return selfNarration && changeVerb && featureMention && !explicitAsk;
}

function looksLikeExplicitWebToolRequest(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  if (/\b(search(?: the)? web|search online|search the internet|check(?: the)? web|check online|check the internet|look up\b|google\b|read(?: the)? (?:page|result)\b|open(?: the)? (?:page|result)\b|inspect(?: the)? (?:page|result)\b)\b/.test(lower)) {
    return true;
  }
  return /\b(find|get|check|show|tell me|read|open|look up)\b[\s\S]{0,60}\b(latest|current|today'?s|today|news)\b[\s\S]{0,40}\b(on|about|for)\b/.test(lower)
    || /\b(what(?:'s| is) the latest on|latest news on|latest news about|current status of)\b/.test(lower);
}

function shouldOfferLocalTools(userText = '') {
  const text = String(userText || '').toLowerCase();
  if (!text) return false;
  if (looksLikeCasualFeatureMention(text)) return false;
  const actionable = looksLikeActionableToolRequest(text);
  if (/\b(server\.js|app\.js|styles\.css|index\.html|package\.json|readme|penny_how_we_got_here_and_next_steps\.md)\b/.test(text)) return actionable;
  if (/\b(log|logs|stack trace|traceback|runtime|lm studio|model|models|status|diagnostic|diagnostics|error|errors|bug|bugs)\b/.test(text)) return actionable;
  if (looksLikeExplicitWebToolRequest(text)) return true;
  if (/\b(read|open|show|inspect|search|find|grep|list|scan|summarize|explain)\b/.test(text) && /\b(file|files|folder|folders|directory|directories|code|repo|project)\b/.test(text)) return actionable;
  if (/\b(fix|change|edit|update|patch|rewrite|refactor|implement|add|remove|create|build|test|lint|check)\b/.test(text) && /\b(file|files|server\.js|app\.js|styles\.css|index\.html|code|repo|project|button|composer|ui|tool)\b/.test(text)) return actionable;
  if (/\b(which file|what file|where is|line \d+|function|route|endpoint)\b/.test(text)) return true;
  return false;
}

function defaultClampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

async function executeDirectProjectInspectIntent({ intent = {}, onToolEvent, executePennyTool, clampNumber = defaultClampNumber } = {}) {
  if (typeof executePennyTool !== 'function') {
    throw new Error('executePennyTool is required');
  }

  const query = String(intent?.args?.query || '').trim();
  const beforeLines = clampNumber(intent?.args?.beforeLines, 0, 80, 12);
  const afterLines = clampNumber(intent?.args?.afterLines, 1, 120, 56);
  if (!query) {
    return {
      toolsUsed: [],
      results: [],
      fallbackText: 'i need an actual symbol or phrase to inspect, not vibes and smoke.\n[MOOD:annoyed]',
    };
  }

  const toolsUsed = [];
  const results = [];
  const runTool = async (name, args) => {
    onToolEvent?.({ type: 'tool', state: 'running', name, label: `using ${name}` });
    const result = await executePennyTool(name, args);
    toolsUsed.push({ name, ok: result.ok, label: result.label });
    results.push({ name, args, result });
    onToolEvent?.({ type: 'tool', state: 'done', name, label: result.label, ok: result.ok });
    return result;
  };

  const searchResult = await runTool('search_project_text', { query, limit: 5 });
  if (!searchResult.ok) {
    return {
      toolsUsed,
      results,
      fallbackText: `i tried to inspect "${query}", but the project search choked. ${String(searchResult.data?.error || 'rude little failure.').trim()}\n[MOOD:annoyed]`,
    };
  }

  const hits = Array.isArray(searchResult.data?.hits) ? searchResult.data.hits : [];
  if (!hits.length) {
    return {
      toolsUsed,
      results,
      fallbackText: `i searched for "${query}" and didn't find a damn thing in the repo.\n[MOOD:annoyed]`,
    };
  }

  const topHit = hits[0];
  const startLine = Math.max(1, Number(topHit.line || 1) - beforeLines);
  const endLine = startLine + afterLines + beforeLines;
  await runTool('read_project_file', {
    path: topHit.path,
    startLine,
    endLine,
  });
  return {
    toolsUsed,
    results,
    fallbackText: `i found the live code around "${query}" and pulled the relevant chunk.\n[MOOD:thinking]`,
  };
}

module.exports = {
  looksLikeActionableToolRequest,
  looksLikeCasualFeatureMention,
  looksLikeExplicitWebToolRequest,
  shouldOfferLocalTools,
  executeDirectProjectInspectIntent,
};
