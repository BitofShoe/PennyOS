function createDirectToolAssistApi({
  executePennyTool,
  executeDirectProjectInspectIntent,
  runLmStudioToolContextAnswer,
  composeDirectRuntimeReply,
  composeDirectSyntaxReply,
  composeDirectGitStatusReply,
  composeDirectSearchReply,
  composeDirectReadReply,
  composeDirectFileListReply,
  composeDirectWebSearchReply,
  composeDirectWebPageReply,
  composeToolRecordFallback,
  shouldUseDirectReadReply,
  clampNumber,
  normalizeWebUrl,
  WEB_SEARCH_MAX_RESULTS,
} = {}) {
  if (typeof executePennyTool !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires executePennyTool');
  }
  if (typeof executeDirectProjectInspectIntent !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires executeDirectProjectInspectIntent');
  }
  if (typeof runLmStudioToolContextAnswer !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires runLmStudioToolContextAnswer');
  }
  if (typeof composeDirectRuntimeReply !== 'function'
    || typeof composeDirectSyntaxReply !== 'function'
    || typeof composeDirectGitStatusReply !== 'function'
    || typeof composeDirectSearchReply !== 'function'
    || typeof composeDirectReadReply !== 'function'
    || typeof composeDirectFileListReply !== 'function'
    || typeof composeDirectWebSearchReply !== 'function'
    || typeof composeDirectWebPageReply !== 'function'
    || typeof composeToolRecordFallback !== 'function'
    || typeof shouldUseDirectReadReply !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires direct reply helpers');
  }
  if (typeof clampNumber !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires clampNumber');
  }
  if (typeof normalizeWebUrl !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires normalizeWebUrl');
  }

  async function executeDirectToolSequence(intent = {}, onToolEvent) {
    const toolsUsed = [];
    const results = [];
    for (const step of Array.isArray(intent.steps) ? intent.steps : []) {
      const name = String(step?.name || '').trim();
      const args = step?.args && typeof step.args === 'object' ? step.args : {};
      if (!name) continue;
      onToolEvent?.({ type: 'tool', state: 'running', name, label: `using ${name}` });
      const result = await executePennyTool(name, args);
      toolsUsed.push({ name, ok: result.ok, label: result.label });
      results.push({ name, args, result });
      onToolEvent?.({ type: 'tool', state: 'done', name, label: result.label, ok: result.ok });
      if (!result.ok) break;
    }
    return { toolsUsed, results };
  }

  async function executeDirectWebInspectIntent({ intent, onToolEvent }) {
    const query = String(intent?.args?.query || '').trim();
    const limit = clampNumber(
      intent?.args?.limit,
      1,
      WEB_SEARCH_MAX_RESULTS,
      Math.min(5, WEB_SEARCH_MAX_RESULTS),
    );
    const toolsUsed = [];
    const results = [];

    onToolEvent?.({ type: 'tool', state: 'running', name: 'search_web', label: 'using search_web' });
    let searchResult;
    try {
      searchResult = await executePennyTool('search_web', { query, limit });
    } catch (error) {
      return {
        toolsUsed,
        results,
        fallbackText: `i tried to search the web for "${query}", but it blew up: ${String(error?.message || error).trim()}\n[MOOD:annoyed]`,
      };
    }
    toolsUsed.push({ name: 'search_web', ok: searchResult.ok, label: searchResult.label });
    results.push({ name: 'search_web', args: { query, limit }, result: searchResult });
    onToolEvent?.({ type: 'tool', state: 'done', name: 'search_web', label: searchResult.label, ok: searchResult.ok });
    if (!searchResult.ok) {
      return { toolsUsed, results, fallbackText: composeDirectWebSearchReply(searchResult.data) };
    }

    const top = Array.isArray(searchResult.data?.results)
      ? searchResult.data.results.find((item) => normalizeWebUrl(item?.url))
      : null;
    if (!top?.url) {
      return { toolsUsed, results, fallbackText: composeDirectWebSearchReply(searchResult.data) };
    }

    onToolEvent?.({ type: 'tool', state: 'running', name: 'read_web_page', label: 'using read_web_page' });
    let pageResult;
    try {
      pageResult = await executePennyTool('read_web_page', { url: top.url });
    } catch (error) {
      pageResult = {
        ok: false,
        label: `failed to read ${top.url}`,
        data: { error: String(error?.message || error).trim(), url: top.url },
      };
    }
    toolsUsed.push({ name: 'read_web_page', ok: pageResult.ok, label: pageResult.label });
    results.push({ name: 'read_web_page', args: { url: top.url }, result: pageResult });
    onToolEvent?.({ type: 'tool', state: 'done', name: 'read_web_page', label: pageResult.label, ok: pageResult.ok });
    if (!pageResult.ok) {
      return { toolsUsed, results, fallbackText: composeToolRecordFallback(results) };
    }
    return { toolsUsed, results, fallbackText: composeToolRecordFallback(results) };
  }

  function composeDirectEditReply(intent = {}, sequence = {}) {
    const primaryName = intent.mode === 'direct_replace'
      ? 'replace_in_project_file'
      : intent.mode === 'direct_append'
        ? 'insert_in_project_file'
        : 'write_project_file';
    const primary = (sequence.results || []).find((item) => item.name === primaryName);
    if (!primary || !primary.result?.ok) {
      const detail = String(primary?.result?.data?.error || 'The edit tool did not complete.').trim();
      return `i tried to change ${intent.path || 'that file'}, but it blew up. ${detail}\n[MOOD:annoyed]`;
    }

    const pathLabel = primary.result.data?.path || intent.path || 'that file';
    const lines = [];
    if (intent.mode === 'direct_replace') {
      const replaced = Number(primary.result.data?.replaced || 0);
      lines.push(`${pathLabel} is updated. i replaced ${replaced} match${replaced === 1 ? '' : 'es'}.`);
    } else if (intent.mode === 'direct_append') {
      lines.push(`${pathLabel} has the new line in place.`);
    } else {
      const action = primary.result.data?.action === 'created' ? 'created' : 'updated';
      lines.push(`${pathLabel} is ${action}.`);
    }

    const syntax = (sequence.results || []).find((item) => item.name === 'run_node_check');
    if (syntax?.result?.data) {
      lines.push(syntax.result.data.ok === false
        ? `${pathLabel} still fails \`node --check\`: ${String(syntax.result.data.stderr || syntax.result.data.stdout || 'syntax failure').trim()}`
        : `${pathLabel} also passes \`node --check\`.`);
    }

    const git = (sequence.results || []).find((item) => item.name === 'get_git_status');
    if (git?.result?.ok !== false) {
      const status = String(git?.result?.data?.status || '').trim();
      if (status && status !== '(clean)') lines.push('git sees the local change too.');
    }

    return `${lines.join(' ')}\n[MOOD:smug]`;
  }

  async function runDirectToolAssist({ userText, messages, memories, intent, onToolEvent, abortSignal }) {
    if (intent?.kind === 'sequence') {
      const sequence = await executeDirectToolSequence(intent, onToolEvent);
      return {
        text: composeDirectEditReply(intent, sequence),
        toolsUsed: sequence.toolsUsed,
        toolRecords: sequence.results,
      };
    }
    if (intent?.name === 'inspect_project_symbol') {
      const sequence = await executeDirectProjectInspectIntent({
        intent,
        onToolEvent,
        executePennyTool,
        clampNumber,
      });
      return {
        text: sequence.fallbackText || composeToolRecordFallback(sequence.results),
        toolsUsed: sequence.toolsUsed,
        toolRecords: sequence.results,
      };
    }
    if (intent?.name === 'inspect_web_result') {
      const sequence = await executeDirectWebInspectIntent({
        intent,
        onToolEvent,
      });
      return {
        text: sequence.fallbackText || composeToolRecordFallback(sequence.results),
        toolsUsed: sequence.toolsUsed,
        toolRecords: sequence.results,
        skipSemanticRender: true,
      };
    }
    onToolEvent?.({ type: 'tool', state: 'running', name: intent.name, label: `using ${intent.name}` });
    const result = await executePennyTool(intent.name, intent.args || {});
    onToolEvent?.({ type: 'tool', state: 'done', name: intent.name, label: result.label, ok: result.ok });
    const toolRecords = [{ name: intent.name, args: intent.args || {}, result }];
    const toolsUsed = [{ name: intent.name, ok: result.ok, label: result.label }];
    if (intent.name === 'get_runtime_status') {
      return { text: composeDirectRuntimeReply(result.data), toolsUsed, toolRecords };
    }
    if (intent.name === 'run_node_check') {
      return { text: composeDirectSyntaxReply(result.data), toolsUsed, toolRecords };
    }
    if (intent.name === 'get_git_status') {
      return { text: composeDirectGitStatusReply(result.data), toolsUsed, toolRecords };
    }
    if (intent.name === 'search_project_text') {
      return { text: composeDirectSearchReply(result.data), toolsUsed, toolRecords, skipSemanticRender: true };
    }
    if (
      (intent.name === 'read_project_file' || intent.name === 'read_project_file_around_match')
      && (shouldUseDirectReadReply(userText) || (intent.name === 'read_project_file_around_match' && intent.args?.query))
    ) {
      return { text: composeDirectReadReply(result.data), toolsUsed, toolRecords, skipSemanticRender: true };
    }
    if (intent.name === 'list_project_files') {
      return { text: composeDirectFileListReply(result.data), toolsUsed, toolRecords, skipSemanticRender: true };
    }
    if (intent.name === 'search_web') {
      return { text: composeDirectWebSearchReply(result.data), toolsUsed, toolRecords, skipSemanticRender: true };
    }
    if (intent.name === 'read_web_page') {
      return { text: composeDirectWebPageReply(result.data), toolsUsed, toolRecords, skipSemanticRender: true };
    }
    onToolEvent?.({ type: 'status', stage: 'replying', label: 'turning the findings into words' });
    const text = await runLmStudioToolContextAnswer({
      userText,
      messages,
      memories,
      toolName: intent.name,
      toolData: result.data,
      abortSignal,
    });
    return { text, toolsUsed, toolRecords };
  }

  return {
    executeDirectToolSequence,
    executeDirectWebInspectIntent,
    composeDirectEditReply,
    runDirectToolAssist,
  };
}

module.exports = {
  createDirectToolAssistApi,
};
