function createLmStudioToolLoopApi({
  withLmStudioLaneModel,
  postJsonLongRunning,
  executePennyTool,
  parseToolArguments,
  sanitizeToolMessages,
  clearLmStudioThread,
  bindAbortSignal,
  textFromChatMessage,
  buildLmStudioToolSystemPrompt,
  PENNY_TOOL_DEFINITIONS,
  composeToolRecordFallback,
  LMSTUDIO_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_TIMEOUT_MS,
  LMSTUDIO_TOOL_TEMPERATURE,
  LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
  LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  TOOL_DIRECT_HISTORY_LIMIT,
} = {}) {
  if (typeof withLmStudioLaneModel !== 'function') throw new TypeError('createLmStudioToolLoopApi requires withLmStudioLaneModel');
  if (typeof postJsonLongRunning !== 'function') throw new TypeError('createLmStudioToolLoopApi requires postJsonLongRunning');
  if (typeof executePennyTool !== 'function') throw new TypeError('createLmStudioToolLoopApi requires executePennyTool');
  if (typeof parseToolArguments !== 'function') throw new TypeError('createLmStudioToolLoopApi requires parseToolArguments');
  if (typeof sanitizeToolMessages !== 'function') throw new TypeError('createLmStudioToolLoopApi requires sanitizeToolMessages');
  if (typeof clearLmStudioThread !== 'function') throw new TypeError('createLmStudioToolLoopApi requires clearLmStudioThread');
  if (typeof bindAbortSignal !== 'function') throw new TypeError('createLmStudioToolLoopApi requires bindAbortSignal');
  if (typeof textFromChatMessage !== 'function') throw new TypeError('createLmStudioToolLoopApi requires textFromChatMessage');
  if (typeof buildLmStudioToolSystemPrompt !== 'function') throw new TypeError('createLmStudioToolLoopApi requires buildLmStudioToolSystemPrompt');
  if (!Array.isArray(PENNY_TOOL_DEFINITIONS)) throw new TypeError('createLmStudioToolLoopApi requires PENNY_TOOL_DEFINITIONS');
  if (typeof composeToolRecordFallback !== 'function') throw new TypeError('createLmStudioToolLoopApi requires composeToolRecordFallback');

  async function runLmStudioToolContextAnswer({ userText, messages, memories, toolName, toolData, abortSignal, laneRuntime }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);
      try {
        const contextMessages = [
          { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
          {
            role: 'system',
            content: `Verified live context for this reply:\nTool: ${toolName}\n${JSON.stringify(toolData, null, 2)}\nUse this concrete context in your answer. Stay recognizably Penny while being technically precise. If it still is not enough, say what else you would inspect next.`,
          },
          ...sanitizeToolMessages(messages, TOOL_DIRECT_HISTORY_LIMIT),
        ];
        if (!contextMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
          contextMessages.push({ role: 'user', content: userText });
        }
        const payload = {
          model,
          messages: contextMessages,
          temperature: LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
          max_tokens: LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
          stream: false,
        };
        const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const bodyText = response.bodyText;
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const err = new Error(`LM Studio direct tool assist error ${response.statusCode}: ${bodyText}`);
          err.statusCode = response.statusCode;
          throw err;
        }
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          throw new Error(`LM Studio direct tool assist: invalid JSON: ${bodyText.slice(0, 400)}`);
        }
        const message = parsed?.choices?.[0]?.message;
        const text = textFromChatMessage(message);
        if (!text) throw new Error(`No assistant text from direct tool assist: ${bodyText.slice(0, 800)}`);
        clearLmStudioThread(memories);
        return text.trim();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioToolLoop({ userText, messages, memories, onToolEvent, abortSignal, laneRuntime }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);

      const toolMessages = [
        { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
        {
          role: 'system',
          content: [
            'Tool-use playbook for Penny:',
            '- You are still Penny while doing engineering work. Keep the same voice and chemistry; do not turn into a dry generic assistant.',
            '- Use tools whenever the user wants code inspection, debugging, edits, verification, repo status, current web info, or a summary of changes.',
            '- If the user is trying to find a folder or file name, use list_project_files with a recursive pattern. search_project_text is for contents inside text files.',
            '- Project tools are repo-root bounded and ignore generated or heavy folders like .git, node_modules, output, tmp, and logs by default.',
            '- If the right file is unknown, start with list_project_files or search_project_text.',
            '- Read before editing unless the user gave an exact snippet and file path.',
            '- Prefer replace_in_project_file for surgical edits. Use write_project_file for new files or intentional full rewrites.',
            '- After code edits, verify with run_node_check for changed .js/.cjs/.mjs files and use git tools to confirm what changed.',
            '- If a file is attached in the user message, treat that attachment as real source material, but remember tools only operate on repo files.',
            '- In the final reply, say what you inspected, what you changed, and whether checks passed.',
            '- Never invent tool results, fake a file edit, or claim a verification step that did not happen.',
          ].join('\n'),
        },
        ...sanitizeToolMessages(messages),
      ];
      if (!toolMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
        toolMessages.push({ role: 'user', content: userText });
      }

      const toolsUsed = [];
      const toolRecords = [];
      const editedPaths = new Set();
      const autoCheckedSyntaxPaths = new Set();
      let autoCheckedGitStatus = false;
      try {
        for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
          onToolEvent?.({ type: 'status', stage: step === 0 ? 'planning' : 'tool-followup', label: step === 0 ? 'planning tool move' : 'working the next step' });
          const payload = {
            model,
            messages: toolMessages,
            tools: PENNY_TOOL_DEFINITIONS,
            tool_choice: 'auto',
            temperature: LMSTUDIO_TOOL_TEMPERATURE,
            max_tokens: LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS,
            stream: false,
          };
          const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const bodyText = response.bodyText;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(`LM Studio chat/completions tool call error ${response.statusCode}: ${bodyText}`);
            err.statusCode = response.statusCode;
            throw err;
          }
          let parsed;
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            throw new Error(`LM Studio tool chat/completions: invalid JSON: ${bodyText.slice(0, 400)}`);
          }
          const message = parsed?.choices?.[0]?.message || {};
          const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
          if (!toolCalls.length) {
            const text = textFromChatMessage(message);
            const pendingChecks = [];
            for (const relPath of editedPaths) {
              if (!/\.(?:js|cjs|mjs)$/i.test(relPath) || autoCheckedSyntaxPaths.has(relPath)) continue;
              pendingChecks.push({ name: 'run_node_check', args: { path: relPath } });
            }
            if (editedPaths.size && !autoCheckedGitStatus) {
              pendingChecks.push({ name: 'get_git_status', args: {} });
            }
            if (pendingChecks.length) {
              onToolEvent?.({ type: 'status', stage: 'verifying', label: 'verifying the edit' });
              toolMessages.push({
                role: 'assistant',
                content: typeof message.content === 'string' ? message.content : (text || ''),
              });
              for (const pending of pendingChecks) {
                onToolEvent?.({ type: 'tool', state: 'running', name: pending.name, label: `using ${pending.name}` });
                const result = await executePennyTool(pending.name, pending.args || {});
                toolsUsed.push({ name: pending.name, ok: result.ok, label: result.label });
                toolRecords.push({ name: pending.name, args: pending.args || {}, result });
                onToolEvent?.({ type: 'tool', state: 'done', name: pending.name, label: result.label, ok: result.ok });
                if (pending.name === 'run_node_check' && result.data?.path) autoCheckedSyntaxPaths.add(result.data.path);
                if (pending.name === 'get_git_status') autoCheckedGitStatus = true;
                toolMessages.push({
                  role: 'system',
                  content: `Automatic verification result from ${pending.name}:\n${JSON.stringify(result.data, null, 2)}`,
                });
              }
              toolMessages.push({
                role: 'system',
                content: "Automatic verification ran after your code edits. Update your final reply to include those verified outcomes in Penny's normal voice.",
              });
              continue;
            }
            if (!text) {
              toolMessages.push({
                role: 'system',
                content: toolsUsed.length
                  ? 'You just produced an empty reply. Answer again now using the verified tool results already in the conversation. Do not leave the assistant content blank.'
                  : "You just produced an empty reply. Try again now. Because this is a tool-enabled coding turn, either call the tool you need or answer in Penny's normal voice with concrete next-step reasoning.",
              });
              continue;
            }
            return { text: text.trim(), toolsUsed, toolRecords };
          }

          toolMessages.push({
            role: 'assistant',
            content: typeof message.content === 'string' ? message.content : '',
            tool_calls: toolCalls.map(call => ({
              id: call.id,
              type: call.type || 'function',
              function: {
                name: call?.function?.name || '',
                arguments: typeof call?.function?.arguments === 'string'
                  ? call.function.arguments
                  : JSON.stringify(call?.function?.arguments || {}),
              },
            })),
          });

          for (const call of toolCalls) {
            const name = String(call?.function?.name || '').trim();
            const parsedArgs = parseToolArguments(call?.function?.arguments);
            if (!parsedArgs.ok) {
              const failedResult = {
                ok: false,
                label: `tool args invalid for ${name || 'unknown tool'}`,
                data: { error: parsedArgs.error },
              };
              toolsUsed.push({ name, ok: failedResult.ok, label: failedResult.label });
              toolRecords.push({ name, args: {}, result: failedResult });
              onToolEvent?.({ type: 'tool', state: 'done', name, label: failedResult.label, ok: failedResult.ok });
              toolMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(failedResult.data),
              });
              continue;
            }
            const args = parsedArgs.value;
            onToolEvent?.({ type: 'tool', state: 'running', name, label: `using ${name}` });
            const result = await executePennyTool(name, args);
            toolsUsed.push({ name, ok: result.ok, label: result.label });
            toolRecords.push({ name, args, result });
            onToolEvent?.({ type: 'tool', state: 'done', name, label: result.label, ok: result.ok });
            if ((name === 'write_project_file' || name === 'replace_in_project_file') && result.ok && result.data?.path) {
              editedPaths.add(result.data.path);
            }
            if (name === 'run_node_check' && result.data?.path) {
              autoCheckedSyntaxPaths.add(result.data.path);
            }
            if (name === 'get_git_status') {
              autoCheckedGitStatus = true;
            }
            toolMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result.data),
            });
          }
        }
        if (toolRecords.length) {
          const fallbackText = composeToolRecordFallback(toolRecords)
            || "i did the tool work, but the reply brain chewed through its loop budget before it could say something normal.\n[MOOD:annoyed]";
          return { text: fallbackText, toolsUsed, toolRecords };
        }
        throw new Error(`Penny hit the tool-use loop limit (${MAX_TOOL_STEPS}) before finishing the reply.`);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  function parsePlannerDecision(text = '') {
    const parsed = parseToolArguments(text);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
      return { ok: false, error: parsed.error || 'Planner reply was not valid JSON.' };
    }
    const kind = String(parsed.value.kind || '').trim().toLowerCase();
    if (kind === 'tool') {
      const tool = String(parsed.value.tool || parsed.value.name || '').trim();
      if (!tool) return { ok: false, error: 'Planner JSON was missing `tool`.' };
      const args = parsed.value.args && typeof parsed.value.args === 'object' ? parsed.value.args : {};
      return { ok: true, kind, tool, args };
    }
    if (kind === 'final') {
      const finalText = String(parsed.value.text || '').trim();
      if (!finalText) return { ok: false, error: 'Planner JSON was missing `text` for the final reply.' };
      return { ok: true, kind, text: finalText };
    }
    return { ok: false, error: 'Planner JSON must use kind "tool" or "final".' };
  }

  function shouldFallbackToManualToolLoop(error) {
    const message = String(error?.message || '');
    return /No assistant text from tool-enabled chat\/completions/i.test(message)
      || /tool-use loop limit/i.test(message);
  }

  async function runLmStudioManualToolLoop({ userText, messages, memories, onToolEvent, abortSignal, laneRuntime }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);

      const plannerMessages = [
        { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
        {
          role: 'system',
          content: [
            'Manual tool planner mode:',
            '- Native function calling was flaky, so you must choose your next action with JSON only.',
            '- Reply with exactly one JSON object and no markdown.',
            '- Tool step schema: {"kind":"tool","tool":"read_project_file","args":{"path":"server.js"}}',
            '- Final step schema: {"kind":"final","text":"your normal Penny reply ending with one mood tag"}',
            `- Valid tool names: ${PENNY_TOOL_DEFINITIONS.map(item => item.function.name).join(', ')}`,
            '- Use one tool at a time.',
            '- Inspect before editing. Prefer targeted replacements over full rewrites.',
            '- For live/current information, use search_web first and read_web_page only if you need to inspect a result page.',
            '- After code edits, verify before returning kind final.',
            '- Stay recognizably Penny in the final text, but keep the technical facts exact.',
          ].join('\n'),
        },
        ...sanitizeToolMessages(messages),
      ];
      if (!plannerMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
        plannerMessages.push({ role: 'user', content: userText });
      }

      const toolsUsed = [];
      const toolRecords = [];
      const editedPaths = new Set();
      const autoCheckedSyntaxPaths = new Set();
      let autoCheckedGitStatus = false;

      try {
        for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
          onToolEvent?.({ type: 'status', stage: step === 0 ? 'planning' : 'tool-followup', label: step === 0 ? 'planning tool move' : 'working the next step' });
          const payload = {
            model,
            messages: plannerMessages,
            temperature: LMSTUDIO_TOOL_TEMPERATURE,
            max_tokens: LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
            stream: false,
          };
          const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const bodyText = response.bodyText;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(`LM Studio manual planner error ${response.statusCode}: ${bodyText}`);
            err.statusCode = response.statusCode;
            throw err;
          }
          let parsed;
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            throw new Error(`LM Studio manual planner: invalid JSON: ${bodyText.slice(0, 400)}`);
          }
          const message = parsed?.choices?.[0]?.message || {};
          const assistantText = textFromChatMessage(message);
          if (!assistantText) {
            plannerMessages.push({
              role: 'system',
              content: 'Your previous response was empty. Reply again with exactly one JSON object and no markdown.',
            });
            continue;
          }

          const decision = parsePlannerDecision(assistantText);
          if (!decision.ok) {
            plannerMessages.push({ role: 'assistant', content: assistantText });
            plannerMessages.push({
              role: 'system',
              content: `That was not valid planner JSON. ${decision.error} Reply again with exactly one JSON object and no markdown.`,
            });
            continue;
          }

          if (decision.kind === 'tool') {
            plannerMessages.push({ role: 'assistant', content: assistantText });
            onToolEvent?.({ type: 'tool', state: 'running', name: decision.tool, label: `using ${decision.tool}` });
            const result = await executePennyTool(decision.tool, decision.args || {});
            toolsUsed.push({ name: decision.tool, ok: result.ok, label: result.label });
            toolRecords.push({ name: decision.tool, args: decision.args || {}, result });
            onToolEvent?.({ type: 'tool', state: 'done', name: decision.tool, label: result.label, ok: result.ok });
            if ((decision.tool === 'write_project_file' || decision.tool === 'replace_in_project_file') && result.ok && result.data?.path) {
              editedPaths.add(result.data.path);
            }
            if (decision.tool === 'run_node_check' && result.data?.path) {
              autoCheckedSyntaxPaths.add(result.data.path);
            }
            if (decision.tool === 'get_git_status') {
              autoCheckedGitStatus = true;
            }
            plannerMessages.push({
              role: 'system',
              content: `Tool result from ${decision.tool}:\n${JSON.stringify(result.data, null, 2)}`,
            });
            continue;
          }

          const pendingChecks = [];
          for (const relPath of editedPaths) {
            if (!/\.(?:js|cjs|mjs)$/i.test(relPath) || autoCheckedSyntaxPaths.has(relPath)) continue;
            pendingChecks.push({ name: 'run_node_check', args: { path: relPath } });
          }
          if (editedPaths.size && !autoCheckedGitStatus) {
            pendingChecks.push({ name: 'get_git_status', args: {} });
          }
          if (pendingChecks.length) {
            onToolEvent?.({ type: 'status', stage: 'verifying', label: 'verifying the edit' });
            plannerMessages.push({ role: 'assistant', content: assistantText });
            for (const pending of pendingChecks) {
              onToolEvent?.({ type: 'tool', state: 'running', name: pending.name, label: `using ${pending.name}` });
              const result = await executePennyTool(pending.name, pending.args || {});
              toolsUsed.push({ name: pending.name, ok: result.ok, label: result.label });
              toolRecords.push({ name: pending.name, args: pending.args || {}, result });
              onToolEvent?.({ type: 'tool', state: 'done', name: pending.name, label: result.label, ok: result.ok });
              if (pending.name === 'run_node_check' && result.data?.path) autoCheckedSyntaxPaths.add(result.data.path);
              if (pending.name === 'get_git_status') autoCheckedGitStatus = true;
              plannerMessages.push({
                role: 'system',
                content: `Automatic verification result from ${pending.name}:\n${JSON.stringify(result.data, null, 2)}`,
              });
            }
            plannerMessages.push({
              role: 'system',
              content: `Automatic verification ran after your code edits. Reply again with kind "final" and include those verified outcomes in Penny's normal voice.`,
            });
            continue;
          }

          return { text: decision.text.trim(), toolsUsed, toolRecords };
        }
        if (toolRecords.length) {
          const fallbackText = composeToolRecordFallback(toolRecords)
            || "i did the tool work, but the reply brain chewed through its loop budget before it could say something normal.\n[MOOD:annoyed]";
          return { text: fallbackText, toolsUsed, toolRecords };
        }
        throw new Error(`Penny manual tool loop hit the limit (${MAX_TOOL_STEPS}) before finishing the reply.`);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  return {
    runLmStudioToolContextAnswer,
    runLmStudioToolLoop,
    parsePlannerDecision,
    shouldFallbackToManualToolLoop,
    runLmStudioManualToolLoop,
  };
}

module.exports = {
  createLmStudioToolLoopApi,
};
