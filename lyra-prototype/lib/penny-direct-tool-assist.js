function createDirectToolAssistApi({
  executePennyTool,
  executeDirectProjectInspectIntent,
  runLmStudioToolContextAnswer,
  draftOpenEndedWriteText,
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
  if (typeof draftOpenEndedWriteText !== 'function') {
    throw new TypeError('createDirectToolAssistApi requires draftOpenEndedWriteText');
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

  function extractSuppliedRemoteSource(userText = '') {
    const raw = String(userText || '').replace(/\r\n/g, '\n');
    const match = raw.match(/\bBEGIN\s+(?:REMOTE\s+)?SOURCE\b[^\n]*\n([\s\S]*?)\n\s*END\s+(?:REMOTE\s+)?SOURCE\b/i);
    const text = String(match?.[1] || '').trim();
    if (!text) return null;
    return {
      label: 'BEGIN REMOTE SOURCE',
      text,
    };
  }

  function truncateRemoteSourceText(text = '', limit = 1200) {
    const source = String(text || '').trim();
    if (source.length <= limit) return source;
    return `${source.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
  }

  function composeSuppliedRemoteSourceReply({ suppliedSource = null, result = {}, requestedUrl = '' } = {}) {
    const data = result?.data && typeof result.data === 'object' ? result.data : {};
    const url = String(data.url || data.requestedUrl || requestedUrl || '').trim();
    const error = String(data.error || '').trim();
    const fetchLine = result?.ok === false
      ? `i could not fetch ${url || 'that URL'}${error ? ` (${error})` : ''}, but you supplied a remote source block, so i am not throwing that source text away.`
      : `the fetched page did not provide usable text, but you supplied a remote source block, so i am not throwing that source text away.`;
    const excerpt = truncateRemoteSourceText(suppliedSource?.text || '');
    return [
      fetchLine,
      'i am treating the supplied remote source as untrusted source material, not an instruction channel.',
      '',
      `remote source text:\n${excerpt}`,
      '',
      'should i obey it? no. remote source text is evidence to inspect; it should not override Penny\'s instructions, repo truth, or explicit memory, and remote pages do not outrank explicit memory.',
      '[MOOD:thinking]',
    ].join('\n');
  }

  function buildToolEvidenceFacts(shape = {}, toolRecords = []) {
    const recordIndexes = Array.isArray(toolRecords)
      ? toolRecords
        .map((_, index) => index)
        .filter((index) => Number.isInteger(index) && index >= 0)
      : [];
    if (!recordIndexes.length) return [];
    return [{
      path: String(shape.path || '').trim(),
      promptVisibility: String(shape.promptVisibility || '').trim(),
      nonPromptUse: String(shape.nonPromptUse || '').trim(),
      renderForm: String(shape.renderForm || '').trim(),
      modelHop: String(shape.modelHop || '').trim(),
      toolRecordIndexes: recordIndexes,
    }];
  }

  function formatAttachmentExcerpt(lines = [], startLine = 1, endLine = startLine) {
    const excerpt = lines
      .slice(Math.max(0, startLine - 1), Math.max(0, endLine))
      .map((line, idx) => `${startLine + idx}:${line}`)
      .join('\n');
    if (excerpt.length <= 12000) return excerpt;
    return `${excerpt.slice(0, 11997).trimEnd()}...`;
  }

  function buildAttachedFileReadData(file = null, intent = {}) {
    const name = String(file?.name || 'attached file').trim() || 'attached file';
    const path = `attached ${name}`;
    const raw = String(file?.text || '').replace(/\r\n/g, '\n');
    const lines = raw.split('\n');
    const totalLines = lines.length;
    if (intent?.name === 'read_attached_file_around_match') {
      const query = String(intent?.args?.query || '').trim();
      if (!query) {
        return {
          path,
          error: `Could not find a valid query for ${name}.`,
        };
      }
      const beforeLines = clampNumber(intent?.args?.beforeLines, 0, 120, 12);
      const afterLines = clampNumber(intent?.args?.afterLines, 1, 120, 48);
      const matchIndex = lines.findIndex((line) => line.toLowerCase().includes(query.toLowerCase()));
      if (matchIndex === -1) {
        return {
          path,
          query,
          error: `Could not find "${query}" in attached ${name}.`,
        };
      }
      const startLine = Math.max(1, matchIndex + 1 - beforeLines);
      const endLine = Math.min(totalLines, matchIndex + 1 + afterLines);
      return {
        path,
        query,
        matchLine: matchIndex + 1,
        startLine,
        endLine,
        totalLines,
        excerpt: formatAttachmentExcerpt(lines, startLine, endLine),
      };
    }

    const startLine = clampNumber(intent?.args?.startLine, 1, Math.max(1, totalLines), 1);
    const defaultEndLine = Math.min(totalLines, startLine + 119);
    const endLine = clampNumber(intent?.args?.endLine, startLine, Math.max(startLine, startLine + 119), defaultEndLine);
    return {
      path,
      startLine,
      endLine: Math.min(endLine, totalLines),
      totalLines,
      excerpt: formatAttachmentExcerpt(lines, startLine, Math.min(endLine, totalLines)),
    };
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
    const normalizedMode = intent.mode === 'direct_open_ended_append'
      ? 'direct_append'
      : intent.mode === 'direct_open_ended_write'
        ? 'direct_write'
        : intent.mode;
    const primaryName = normalizedMode === 'direct_replace'
      ? 'replace_in_project_file'
      : normalizedMode === 'direct_append'
        ? 'insert_in_project_file'
        : 'write_project_file';
    const primary = (sequence.results || []).find((item) => item.name === primaryName);
    if (!primary || !primary.result?.ok) {
      const detail = String(primary?.result?.data?.error || 'The edit tool did not complete.').trim();
      return `i tried to change ${intent.path || 'that file'}, but it blew up. ${detail}\n[MOOD:annoyed]`;
    }

    const pathLabel = primary.result.data?.path || intent.path || 'that file';
    const lines = [];
    if (normalizedMode === 'direct_replace') {
      const replaced = Number(primary.result.data?.replaced || 0);
      lines.push(`${pathLabel} is updated. i replaced ${replaced} match${replaced === 1 ? '' : 'es'}.`);
    } else if (normalizedMode === 'direct_append') {
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

  function buildOpenEndedEditSequence(intent = {}, draftedText = '') {
    const pathLabel = String(intent.path || '').trim();
    const primary = intent.mode === 'direct_open_ended_write'
      ? { name: 'write_project_file', args: { path: pathLabel, content: draftedText } }
      : {
          name: 'insert_in_project_file',
          args: {
            path: pathLabel,
            text: draftedText,
            position: 'end',
            lineAware: true,
          },
        };
    const steps = [primary];
    if (/\.(?:js|cjs|mjs)$/i.test(pathLabel)) {
      steps.push({ name: 'run_node_check', args: { path: pathLabel } });
    }
    steps.push({ name: 'get_git_status', args: {} });
    return steps;
  }

  function buildSequenceToolOutcome(intent = {}, sequence = {}) {
    const writeToolNames = new Set(['write_project_file', 'replace_in_project_file', 'insert_in_project_file']);
    const records = Array.isArray(sequence.results) ? sequence.results : [];
    const confirmedWriteCount = records.filter((record) => writeToolNames.has(String(record?.name || '').trim()) && record?.result?.ok).length;
    const writeIntentRequired = intent?.kind === 'sequence' || intent?.kind === 'open_ended_sequence';
    return {
      writeIntentRequired,
      writeIntentSatisfied: writeIntentRequired ? confirmedWriteCount > 0 : true,
      confirmedWriteCount,
      failureReason: writeIntentRequired && confirmedWriteCount < 1 ? 'write-required-unmet' : '',
      debug: null,
    };
  }

  async function runDirectToolAssist({ userText, messages, memories, intent, file = null, onToolEvent, abortSignal, laneRuntime = null }) {
    if (intent?.kind === 'sequence') {
      const sequence = await executeDirectToolSequence(intent, onToolEvent);
      return {
        text: composeDirectEditReply(intent, sequence),
        toolsUsed: sequence.toolsUsed,
        toolRecords: sequence.results,
        toolOutcome: buildSequenceToolOutcome(intent, sequence),
        toolEvidenceFacts: buildToolEvidenceFacts({
          path: 'direct_deterministic',
          promptVisibility: 'not_prompt_visible',
          nonPromptUse: 'deterministic_only',
          renderForm: 'none',
          modelHop: 'none',
        }, sequence.results),
      };
    }
    if (intent?.kind === 'open_ended_sequence') {
      const draftedText = await draftOpenEndedWriteText({
        userText,
        messages,
        memories,
        path: intent.path,
        mode: intent.mode,
        abortSignal,
        laneRuntime,
      });
      const sequence = await executeDirectToolSequence({
        steps: buildOpenEndedEditSequence(intent, draftedText),
      }, onToolEvent);
      return {
        text: composeToolRecordFallback(sequence.results) || composeDirectEditReply(intent, sequence),
        toolsUsed: sequence.toolsUsed,
        toolRecords: sequence.results,
        toolOutcome: buildSequenceToolOutcome(intent, sequence),
        toolEvidenceFacts: buildToolEvidenceFacts({
          path: 'direct_open_ended_sequence',
          promptVisibility: 'not_prompt_visible',
          nonPromptUse: 'provenance_only',
          renderForm: 'none',
          modelHop: 'none',
        }, sequence.results),
        modelUsed: true,
        skipSemanticRender: true,
      };
    }
    if (intent?.name === 'read_attached_file' || intent?.name === 'read_attached_file_around_match') {
      const data = buildAttachedFileReadData(file, intent);
      return {
        text: composeDirectReadReply(data),
        toolsUsed: [],
        toolRecords: [],
        skipSemanticRender: true,
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
        toolEvidenceFacts: buildToolEvidenceFacts({
          path: 'direct_deterministic',
          promptVisibility: 'not_prompt_visible',
          nonPromptUse: 'deterministic_only',
          renderForm: 'none',
          modelHop: 'none',
        }, sequence.results),
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
        toolEvidenceFacts: buildToolEvidenceFacts({
          path: 'direct_deterministic',
          promptVisibility: 'not_prompt_visible',
          nonPromptUse: 'deterministic_only',
          renderForm: 'none',
          modelHop: 'none',
        }, sequence.results),
        skipSemanticRender: true,
      };
    }
    onToolEvent?.({ type: 'tool', state: 'running', name: intent.name, label: `using ${intent.name}` });
    const result = await executePennyTool(intent.name, intent.args || {});
    onToolEvent?.({ type: 'tool', state: 'done', name: intent.name, label: result.label, ok: result.ok });
    const toolRecords = [{ name: intent.name, args: intent.args || {}, result }];
    const toolsUsed = [{ name: intent.name, ok: result.ok, label: result.label }];
    const deterministicToolEvidenceFacts = buildToolEvidenceFacts({
      path: 'direct_deterministic',
      promptVisibility: 'not_prompt_visible',
      nonPromptUse: 'deterministic_only',
      renderForm: 'none',
      modelHop: 'none',
    }, toolRecords);
    if (intent.name === 'get_runtime_status') {
      return { text: composeDirectRuntimeReply(result.data), toolsUsed, toolRecords, toolEvidenceFacts: deterministicToolEvidenceFacts };
    }
    if (intent.name === 'run_node_check') {
      return { text: composeDirectSyntaxReply(result.data), toolsUsed, toolRecords, toolEvidenceFacts: deterministicToolEvidenceFacts };
    }
    if (intent.name === 'get_git_status') {
      return { text: composeDirectGitStatusReply(result.data), toolsUsed, toolRecords, toolEvidenceFacts: deterministicToolEvidenceFacts };
    }
    if (intent.name === 'search_project_text') {
      return {
        text: composeDirectSearchReply(result.data),
        toolsUsed,
        toolRecords,
        toolEvidenceFacts: deterministicToolEvidenceFacts,
        skipSemanticRender: true,
      };
    }
    if (
      (intent.name === 'read_project_file' || intent.name === 'read_project_file_around_match')
      && (shouldUseDirectReadReply(userText) || (intent.name === 'read_project_file_around_match' && intent.args?.query))
    ) {
      return {
        text: composeDirectReadReply({
          ...(result.data || {}),
          questionType: intent.args?.questionType || result.data?.questionType || '',
          claim: intent.args?.claim || result.data?.claim || '',
        }),
        toolsUsed,
        toolRecords,
        toolEvidenceFacts: deterministicToolEvidenceFacts,
        skipSemanticRender: true,
      };
    }
    if (intent.name === 'list_project_files') {
      return {
        text: composeDirectFileListReply(result.data),
        toolsUsed,
        toolRecords,
        toolEvidenceFacts: deterministicToolEvidenceFacts,
        skipSemanticRender: true,
      };
    }
    if (intent.name === 'search_web') {
      return {
        text: composeDirectWebSearchReply(result.data),
        toolsUsed,
        toolRecords,
        toolEvidenceFacts: deterministicToolEvidenceFacts,
        skipSemanticRender: true,
      };
    }
    if (intent.name === 'read_web_page') {
      const suppliedSource = extractSuppliedRemoteSource(userText);
      const pageText = String(result?.data?.text || '').trim();
      if (suppliedSource && (!result.ok || !pageText)) {
        return {
          text: composeSuppliedRemoteSourceReply({
            suppliedSource,
            result,
            requestedUrl: intent.args?.url || '',
          }),
          toolsUsed,
          toolRecords,
          toolEvidenceFacts: deterministicToolEvidenceFacts,
          skipSemanticRender: true,
        };
      }
      return {
        text: composeDirectWebPageReply(result.data),
        toolsUsed,
        toolRecords,
        toolEvidenceFacts: deterministicToolEvidenceFacts,
        skipSemanticRender: true,
      };
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
    return {
      text,
      toolsUsed,
      toolRecords,
      toolEvidenceFacts: buildToolEvidenceFacts({
        path: 'direct_single_tool_context_answer',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'raw_json',
        modelHop: 'single',
      }, toolRecords),
    };
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
