function createLmStudioTransportApi({
  withLmStudioLaneModel,
  getLmStudioConnectionStatus,
  pickLmStudioNativeModelId,
  shouldPreferLmStudioChatCompletions,
  postJsonLongRunning,
  postJsonSse,
  buildLmStudioPrompt,
  buildLmStudioMessages,
  buildLmStudioStatefulInput,
  buildLmStudioLeanSystemPrompt,
  hashText,
  normalizeLmStudioThread,
  clearLmStudioThread,
  bindAbortSignal,
  collectLmStudioResponsesStrings,
  collectLmStudioStatefulChatStrings,
  extractPennyFromPlanningBlob,
  extractPennyFromReasoning,
  coercePennyVisibleReply,
  classifyVisibleReplyDecision,
  textFromChatMessage,
  textValueFromField,
  collectTextParts,
  looksOnlyLikeCoT,
  isMissingLmStudioThreadError,
  lmStudioStageLabel,
  LOCAL_LLM_TRANSPORT,
  ALLOW_RAW_REASONING_FALLBACK,
  RESPONSES_THEN_CHAT_FALLBACK,
  LMSTUDIO_BASE,
  LMSTUDIO_NATIVE_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_TIMEOUT_MS,
  LMSTUDIO_MAX_OUTPUT_TOKENS,
  LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
  reportLmStudioReasoning,
} = {}) {
  if (typeof withLmStudioLaneModel !== 'function') throw new TypeError('createLmStudioTransportApi requires withLmStudioLaneModel');
  if (typeof getLmStudioConnectionStatus !== 'function') throw new TypeError('createLmStudioTransportApi requires getLmStudioConnectionStatus');
  if (typeof pickLmStudioNativeModelId !== 'function') throw new TypeError('createLmStudioTransportApi requires pickLmStudioNativeModelId');
  if (typeof shouldPreferLmStudioChatCompletions !== 'function') throw new TypeError('createLmStudioTransportApi requires shouldPreferLmStudioChatCompletions');
  if (typeof postJsonLongRunning !== 'function') throw new TypeError('createLmStudioTransportApi requires postJsonLongRunning');
  if (typeof postJsonSse !== 'function') throw new TypeError('createLmStudioTransportApi requires postJsonSse');
  if (typeof buildLmStudioPrompt !== 'function') throw new TypeError('createLmStudioTransportApi requires buildLmStudioPrompt');
  if (typeof buildLmStudioMessages !== 'function') throw new TypeError('createLmStudioTransportApi requires buildLmStudioMessages');
  if (typeof buildLmStudioStatefulInput !== 'function') throw new TypeError('createLmStudioTransportApi requires buildLmStudioStatefulInput');
  if (typeof buildLmStudioLeanSystemPrompt !== 'function') throw new TypeError('createLmStudioTransportApi requires buildLmStudioLeanSystemPrompt');
  if (typeof hashText !== 'function') throw new TypeError('createLmStudioTransportApi requires hashText');
  if (typeof normalizeLmStudioThread !== 'function') throw new TypeError('createLmStudioTransportApi requires normalizeLmStudioThread');
  if (typeof clearLmStudioThread !== 'function') throw new TypeError('createLmStudioTransportApi requires clearLmStudioThread');
  if (typeof bindAbortSignal !== 'function') throw new TypeError('createLmStudioTransportApi requires bindAbortSignal');
  if (typeof collectLmStudioResponsesStrings !== 'function') throw new TypeError('createLmStudioTransportApi requires collectLmStudioResponsesStrings');
  if (typeof collectLmStudioStatefulChatStrings !== 'function') throw new TypeError('createLmStudioTransportApi requires collectLmStudioStatefulChatStrings');
  if (typeof extractPennyFromPlanningBlob !== 'function') throw new TypeError('createLmStudioTransportApi requires extractPennyFromPlanningBlob');
  if (typeof extractPennyFromReasoning !== 'function') throw new TypeError('createLmStudioTransportApi requires extractPennyFromReasoning');
  if (typeof coercePennyVisibleReply !== 'function') throw new TypeError('createLmStudioTransportApi requires coercePennyVisibleReply');
  if (typeof classifyVisibleReplyDecision !== 'function') throw new TypeError('createLmStudioTransportApi requires classifyVisibleReplyDecision');
  if (typeof textFromChatMessage !== 'function') throw new TypeError('createLmStudioTransportApi requires textFromChatMessage');
  if (typeof textValueFromField !== 'function') throw new TypeError('createLmStudioTransportApi requires textValueFromField');
  if (typeof collectTextParts !== 'function') throw new TypeError('createLmStudioTransportApi requires collectTextParts');
  if (typeof looksOnlyLikeCoT !== 'function') throw new TypeError('createLmStudioTransportApi requires looksOnlyLikeCoT');
  if (typeof isMissingLmStudioThreadError !== 'function') throw new TypeError('createLmStudioTransportApi requires isMissingLmStudioThreadError');
  if (typeof lmStudioStageLabel !== 'function') throw new TypeError('createLmStudioTransportApi requires lmStudioStageLabel');

  function maybeReportReasoning({ transport = '', lane = 'chat', model = '', reasoningText = '' } = {}) {
    const text = String(reasoningText || '').trim();
    if (!text || typeof reportLmStudioReasoning !== 'function') return;
    try {
      reportLmStudioReasoning({ transport, lane, model, reasoningText: text });
    } catch {}
  }

  function normalizeCleanupDecision(decision = {}, overrides = {}) {
    const raw = decision && typeof decision === 'object' ? decision : {};
    const text = String(Object.prototype.hasOwnProperty.call(overrides, 'text') ? overrides.text : raw.text || '').trim();
    return {
      text,
      reasonCode: String(overrides.reasonCode || raw.reasonCode || 'none').trim() || 'none',
      cleanupApplied: overrides.cleanupApplied === true || raw.cleanupApplied === true,
      materialChange: overrides.materialChange === true || raw.materialChange === true,
      reconstructedReply: overrides.reconstructedReply === true || raw.reconstructedReply === true,
      usedReasoningFallback: overrides.usedReasoningFallback === true || raw.usedReasoningFallback === true,
      cleanupTransform: raw.cleanupTransform && typeof raw.cleanupTransform === 'object'
        ? { ...raw.cleanupTransform }
        : null,
    };
  }

  function recordLaneCleanup(laneRuntime, decision = {}) {
    const cleanup = normalizeCleanupDecision(decision);
    if (laneRuntime && typeof laneRuntime === 'object') {
      laneRuntime.cleanup = {
        reasonCode: cleanup.reasonCode,
        cleanupApplied: cleanup.cleanupApplied,
        materialChange: cleanup.materialChange,
        reconstructedReply: cleanup.reconstructedReply,
        usedReasoningFallback: cleanup.usedReasoningFallback,
      };
      laneRuntime.cleanupTransform = cleanup.cleanupTransform && typeof cleanup.cleanupTransform === 'object'
        ? { ...cleanup.cleanupTransform }
        : null;
    }
    return cleanup;
  }

  function salvageVisibleReplyDecision({ visibleText = '', reasoningText = '' } = {}) {
    const visibleDecision = normalizeCleanupDecision(classifyVisibleReplyDecision(String(visibleText || '').trim()));
    if (visibleDecision.text && !looksOnlyLikeCoT(visibleDecision.text)) {
      return visibleDecision;
    }
    let fromReasoning = extractPennyFromReasoning(reasoningText);
    if (!fromReasoning) fromReasoning = extractPennyFromPlanningBlob(reasoningText);
    if (fromReasoning) {
      return normalizeCleanupDecision(classifyVisibleReplyDecision(fromReasoning), {
        cleanupApplied: true,
        materialChange: true,
        reconstructedReply: true,
        usedReasoningFallback: true,
      });
    }
    if (!visibleDecision.text && ALLOW_RAW_REASONING_FALLBACK && reasoningText) {
      return normalizeCleanupDecision({
        text: String(reasoningText || '').trim(),
        reasonCode: 'raw_reasoning_fallback',
      }, {
        cleanupApplied: true,
        materialChange: true,
        reconstructedReply: true,
        usedReasoningFallback: true,
      });
    }
    return visibleDecision;
  }

  function salvageVisibleReply({ visibleText = '', reasoningText = '' } = {}) {
    return salvageVisibleReplyDecision({ visibleText, reasoningText }).text;
  }

  function stripTrailingMoodTag(text = '') {
    return String(text || '').replace(/\s*\[MOOD:\w+\]\s*$/i, '').trim();
  }

  function shouldPreferStreamedVisibleReply(streamedCandidate = '', finalizedCandidate = '') {
    const streamedBare = stripTrailingMoodTag(streamedCandidate);
    const finalizedBare = stripTrailingMoodTag(finalizedCandidate);
    if (!streamedBare || !finalizedBare) return false;
    if (looksOnlyLikeCoT(streamedBare)) return false;
    const streamedLength = streamedBare.length;
    const finalizedLength = finalizedBare.length;
    if (streamedLength < 180) return false;
    if ((streamedLength - finalizedLength) < 120) return false;
    return finalizedLength <= Math.floor(streamedLength * 0.72);
  }

  function chooseFinalStreamReplyDecision({ streamedVisibleText = '', finalizedVisibleText = '', reasoningText = '' } = {}) {
    const streamedDecision = normalizeCleanupDecision(classifyVisibleReplyDecision(String(streamedVisibleText || '').trim()));
    const finalizedDecision = salvageVisibleReplyDecision({ visibleText: finalizedVisibleText, reasoningText });
    if (!finalizedDecision.text) return streamedDecision;
    if (!streamedDecision.text) return finalizedDecision;
    return shouldPreferStreamedVisibleReply(streamedDecision.text, finalizedDecision.text)
      ? streamedDecision
      : finalizedDecision;
  }

  function chooseFinalStreamReply({ streamedVisibleText = '', finalizedVisibleText = '', reasoningText = '' } = {}) {
    return chooseFinalStreamReplyDecision({ streamedVisibleText, finalizedVisibleText, reasoningText }).text;
  }

  function resolveChatMessageVisibleReplyDecision(message = {}) {
    const msg = message && typeof message === 'object' ? message : {};
    const visibleText = textValueFromField(msg.content, 'visible') || String(msg.content ?? '').trim();
    const reasoningText = [
      textValueFromField(msg.reasoning_content, 'reasoning') || String(msg.reasoning_content ?? '').trim(),
      textValueFromField(msg.reasoning, 'reasoning') || String(msg.reasoning ?? '').trim(),
    ].filter(Boolean).join('\n').trim();
    return salvageVisibleReplyDecision({ visibleText, reasoningText });
  }

  async function runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      try {
        const payload = {
          model,
          input: buildLmStudioPrompt({ userText, messages, memories, file, latencyBudget }),
          temperature: 0.9,
          max_output_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
          stream: false,
        };
        const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/responses`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const bodyText = response.bodyText;
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const err = new Error(`LM Studio responses error ${response.statusCode}: ${bodyText}`);
          err.statusCode = response.statusCode;
          throw err;
        }
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          throw new Error(`LM Studio responses: invalid JSON: ${bodyText.slice(0, 400)}`);
        }
        const { outputText, reasoningText } = collectLmStudioResponsesStrings(parsed);
        maybeReportReasoning({ transport: 'responses', lane, model, reasoningText });
        const primary = salvageVisibleReplyDecision({ visibleText: outputText, reasoningText });
        if (!primary.text && RESPONSES_THEN_CHAT_FALLBACK) {
          return runLmStudioChatCompletionsApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime });
        }
        if (!primary.text) {
          throw new Error(
            'LM Studio /responses returned only internal reasoning (no speakable reply). Try: set PENNY_LOCAL_LLM_TRANSPORT=chat, or enable PENNY_RESPONSES_CHAT_FALLBACK (default on), or turn off reasoning in LM Studio for this model.',
          );
        }
        recordLaneCleanup(laneRuntime, primary);
        return primary.text;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model, status) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      const nativeModel = pickLmStudioNativeModelId(model, status);
      const systemPrompt = buildLmStudioLeanSystemPrompt({ memories, latencyBudget });
      const systemPromptHash = hashText(systemPrompt);
      const existingThread = normalizeLmStudioThread(memories?.lmStudioThread);
      const canContinue = !!(
        existingThread
        && existingThread.responseId
        && existingThread.model === nativeModel
        && existingThread.systemPromptHash === systemPromptHash
      );
      try {
        const payload = {
          model: nativeModel,
          input: buildLmStudioStatefulInput({ userText, messages, memories, image, file, hasThread: canContinue, latencyBudget }),
          temperature: 0.9,
          max_output_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
          stream: false,
        };
        if (canContinue) payload.previous_response_id = existingThread.responseId;
        else payload.system_prompt = systemPrompt;

        const response = await postJsonLongRunning(`${LMSTUDIO_NATIVE_BASE}/chat`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const bodyText = response.bodyText;
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const err = new Error(`LM Studio stateful chat error ${response.statusCode}: ${bodyText}`);
          err.statusCode = response.statusCode;
          throw err;
        }
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          throw new Error(`LM Studio stateful chat: invalid JSON: ${bodyText.slice(0, 400)}`);
        }

        const { responseId, outputText, reasoningText } = collectLmStudioStatefulChatStrings(parsed);
        maybeReportReasoning({ transport: 'native-stateful', lane, model: nativeModel, reasoningText });
        const primary = salvageVisibleReplyDecision({ visibleText: outputText, reasoningText });
        if (!primary.text) {
          throw new Error(`No assistant text from LM Studio stateful chat: ${bodyText.slice(0, 800)}`);
        }

        if (responseId && memories && typeof memories === 'object') {
          memories.lmStudioThread = {
            responseId,
            model: nativeModel,
            systemPromptHash,
            updatedAt: new Date().toISOString(),
          };
          if (laneRuntime && typeof laneRuntime === 'object') {
            laneRuntime.resolvedModel = nativeModel;
          }
        }
        recordLaneCleanup(laneRuntime, primary);
        return primary.text;
      } catch (error) {
        if (canContinue && isMissingLmStudioThreadError(error)) {
          if (memories && typeof memories === 'object') memories.lmStudioThread = null;
          return runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
        }
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model, status) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      const nativeModel = pickLmStudioNativeModelId(model, status);
      const systemPrompt = buildLmStudioLeanSystemPrompt({ memories, latencyBudget });
      const systemPromptHash = hashText(systemPrompt);
      const existingThread = normalizeLmStudioThread(memories?.lmStudioThread);
      const canContinue = !!(
        existingThread
        && existingThread.responseId
        && existingThread.model === nativeModel
        && existingThread.systemPromptHash === systemPromptHash
      );

      bindAbortSignal(controller, abortSignal);

      try {
        const payload = {
          model: nativeModel,
          input: buildLmStudioStatefulInput({ userText, messages, memories, image, file, hasThread: canContinue, latencyBudget }),
          temperature: 0.9,
          max_output_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
          stream: true,
        };
        if (canContinue) payload.previous_response_id = existingThread.responseId;
        else payload.system_prompt = systemPrompt;

        let visibleText = '';
        let streamedVisibleText = '';
        let reasoningText = '';
        let responseId = '';

        await postJsonSse(`${LMSTUDIO_NATIVE_BASE}/chat`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          onEvent: ({ event, data }) => {
            if (event === 'message.delta') {
              const chunk = typeof data?.content === 'string' ? data.content : '';
              if (chunk) {
                visibleText += chunk;
                streamedVisibleText += chunk;
                onEvent?.({ type: 'message.delta', content: chunk, text: visibleText });
              }
              return;
            }
            if (event === 'reasoning.delta') {
              const chunk = typeof data?.content === 'string' ? data.content : '';
              if (chunk) reasoningText += chunk;
              onEvent?.({ type: 'status', stage: 'thinking', label: 'thinking' });
              return;
            }
            if (event === 'chat.end') {
              const result = data?.result && typeof data.result === 'object' ? data.result : data;
              const collected = collectLmStudioStatefulChatStrings(result);
              responseId = collected.responseId || responseId;
              if (collected.outputText) visibleText = collected.outputText;
              if (collected.reasoningText) reasoningText = collected.reasoningText;
              return;
            }
            if (event === 'error') {
              const detail = typeof data?.error === 'string'
                ? data.error
                : typeof data?.message === 'string'
                  ? data.message
                  : JSON.stringify(data);
              throw new Error(`LM Studio stateful chat stream error: ${detail}`);
            }
            const label = lmStudioStageLabel(event);
            if (label) onEvent?.({ type: 'status', stage: event, label });
          },
        });

        const primary = chooseFinalStreamReplyDecision({
          streamedVisibleText,
          finalizedVisibleText: visibleText,
          reasoningText,
        });
        maybeReportReasoning({ transport: 'native-stateful-stream', lane, model: nativeModel, reasoningText });
        if (!primary.text) throw new Error('No assistant text from LM Studio stateful chat stream');

        if (responseId && memories && typeof memories === 'object') {
          memories.lmStudioThread = {
            responseId,
            model: nativeModel,
            systemPromptHash,
            updatedAt: new Date().toISOString(),
          };
          if (laneRuntime && typeof laneRuntime === 'object') {
            laneRuntime.resolvedModel = nativeModel;
          }
        }
        recordLaneCleanup(laneRuntime, primary);
        return primary.text;
      } catch (error) {
        if (canContinue && isMissingLmStudioThreadError(error)) {
          if (memories && typeof memories === 'object') memories.lmStudioThread = null;
          return streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
        }
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);

      try {
        const payload = {
          model,
          input: buildLmStudioPrompt({ userText, messages, memories, file, latencyBudget }),
          temperature: 0.9,
          max_output_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
          stream: true,
        };

        let visibleText = '';
        let streamedVisibleText = '';
        let reasoningText = '';
        let finalResponse = null;
        let replyStarted = false;

        await postJsonSse(`${LMSTUDIO_BASE}/responses`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          onEvent: ({ event, data }) => {
            const type = event !== 'message'
              ? event
              : typeof data?.type === 'string'
                ? data.type
                : '';

            if (type === 'response.output_text.delta') {
              const chunk = typeof data?.delta === 'string' ? data.delta : '';
              if (chunk) {
                visibleText += chunk;
                streamedVisibleText += chunk;
                if (!replyStarted) {
                  replyStarted = true;
                  onEvent?.({ type: 'status', stage: 'message.start', label: 'replying' });
                }
                onEvent?.({ type: 'message.delta', content: chunk, text: visibleText });
              }
              return;
            }

            if (/^response\.(reasoning|reasoning_summary|summary).*\.delta$/i.test(type)) {
              const chunk = typeof data?.delta === 'string'
                ? data.delta
                : typeof data?.text === 'string'
                  ? data.text
                  : '';
              if (chunk) reasoningText += chunk;
              onEvent?.({ type: 'status', stage: 'thinking', label: 'thinking' });
              return;
            }

            if (type === 'response.completed') {
              finalResponse = data?.response && typeof data.response === 'object' ? data.response : data;
              const collected = collectLmStudioResponsesStrings(finalResponse);
              if (collected.outputText) visibleText = collected.outputText;
              if (collected.reasoningText) reasoningText = collected.reasoningText;
              return;
            }

            if (type === 'response.in_progress' || type === 'response.created') {
              onEvent?.({ type: 'status', stage: type, label: 'thinking' });
              return;
            }

            if (type === 'response.output_item.added' || type === 'response.content_part.added') {
              onEvent?.({ type: 'status', stage: type, label: 'replying' });
              return;
            }

            if (type === 'response.failed' || type === 'error') {
              const detail = typeof data?.error === 'string'
                ? data.error
                : typeof data?.message === 'string'
                  ? data.message
                  : JSON.stringify(data);
              throw new Error(`LM Studio responses stream error: ${detail}`);
            }
          },
        });

        let primary = chooseFinalStreamReplyDecision({
          streamedVisibleText,
          finalizedVisibleText: visibleText,
          reasoningText,
        });
        maybeReportReasoning({ transport: 'responses-stream', lane, model, reasoningText });
        if (!primary.text && finalResponse) {
          const collected = collectLmStudioResponsesStrings(finalResponse);
          primary = chooseFinalStreamReplyDecision({
            streamedVisibleText,
            finalizedVisibleText: collected.outputText,
            reasoningText: collected.reasoningText,
          });
          maybeReportReasoning({ transport: 'responses-stream-final', lane, model, reasoningText: collected.reasoningText });
        }
        if (!primary.text && RESPONSES_THEN_CHAT_FALLBACK) {
          return streamLmStudioChatCompletionsApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime });
        }
        if (!primary.text) {
          throw new Error(
            'LM Studio /responses stream returned only internal reasoning (no speakable reply). Try: set PENNY_LOCAL_LLM_TRANSPORT=chat, or enable PENNY_RESPONSES_CHAT_FALLBACK (default on), or turn off reasoning in LM Studio for this model.',
          );
        }
        recordLaneCleanup(laneRuntime, primary);
        return primary.text;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);

      try {
        const payload = {
          model,
          messages: buildLmStudioMessages({ userText, messages, memories, image, file, latencyBudget }),
          temperature: 0.9,
          max_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
          stream: true,
        };

        let visibleText = '';
        let reasoningText = '';
        let replyStarted = false;

        await postJsonSse(`${LMSTUDIO_BASE}/chat/completions`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          onEvent: ({ event, data }) => {
            if (event === 'error') {
              const detail = typeof data?.error === 'string'
                ? data.error
                : typeof data?.error?.message === 'string'
                  ? data.error.message
                  : typeof data?.message === 'string'
                    ? data.message
                    : JSON.stringify(data);
              throw new Error(`LM Studio chat/completions stream error: ${detail}`);
            }
            if (typeof data === 'string') {
              if (data === '[DONE]') return;
              if (data) throw new Error(`LM Studio chat/completions stream error: ${data}`);
              return;
            }

            const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
            const delta = choice?.delta && typeof choice.delta === 'object' ? choice.delta : {};
            const contentChunk = typeof delta.content === 'string'
              ? delta.content
              : Array.isArray(delta.content)
                ? collectTextParts(delta.content, 'visible', []).join('')
                : '';
            const reasoningChunk = [
              textValueFromField(delta.reasoning_content, 'reasoning') || String(delta.reasoning_content ?? '').trim(),
              textValueFromField(delta.reasoning, 'reasoning') || String(delta.reasoning ?? '').trim(),
            ].filter(Boolean).join('\n').trim();

            if (reasoningChunk) {
              reasoningText += reasoningChunk;
              onEvent?.({ type: 'status', stage: 'thinking', label: 'thinking' });
            }

            if (contentChunk) {
              visibleText += contentChunk;
              if (!replyStarted) {
                replyStarted = true;
                onEvent?.({ type: 'status', stage: 'message.start', label: 'replying' });
              }
              onEvent?.({ type: 'message.delta', content: contentChunk, text: visibleText });
            }
          },
        });

        const primary = salvageVisibleReplyDecision({ visibleText, reasoningText });
        maybeReportReasoning({ transport: 'chat-completions-stream', lane, model, reasoningText });
        if (!primary.text) throw new Error('No assistant text from chat/completions stream');
        clearLmStudioThread(memories);
        recordLaneCleanup(laneRuntime, primary);
        return primary.text;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      try {
        const payload = {
          model,
          messages: buildLmStudioMessages({ userText, messages, memories, image, file, latencyBudget }),
          temperature: 0.9,
          max_tokens: Math.min(
            LMSTUDIO_MAX_OUTPUT_TOKENS,
            LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
            Number(latencyBudget?.maxOutputTokens || LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
          ),
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
          const err = new Error(`LM Studio chat/completions error ${response.statusCode}: ${bodyText}`);
          err.statusCode = response.statusCode;
          throw err;
        }
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          throw new Error(`LM Studio chat/completions: invalid JSON: ${bodyText.slice(0, 400)}`);
        }
        const msg = parsed?.choices?.[0]?.message;
        const reasoningText = [
          textValueFromField(msg?.reasoning_content, 'reasoning') || String(msg?.reasoning_content ?? '').trim(),
          textValueFromField(msg?.reasoning, 'reasoning') || String(msg?.reasoning ?? '').trim(),
        ].filter(Boolean).join('\n').trim();
        let decision = resolveChatMessageVisibleReplyDecision(msg);
        if (!decision.text) {
          const delta = parsed?.choices?.[0]?.delta;
          decision = resolveChatMessageVisibleReplyDecision(
            typeof delta === 'object' ? { content: delta?.content, reasoning_content: delta?.reasoning_content } : {},
          );
        }
        maybeReportReasoning({ transport: 'chat-completions', lane, model, reasoningText });
        if (!decision.text) throw new Error(`No assistant text from chat/completions: ${bodyText.slice(0, 800)}`);
        clearLmStudioThread(memories);
        recordLaneCleanup(laneRuntime, decision);
        return decision.text.trim();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioLocal({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    const transport = LOCAL_LLM_TRANSPORT;
    if (transport === 'stateful' || transport === 'native' || transport === 'native-chat' || transport === 'stateful-chat') {
      return runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'chat') {
      return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'responses') {
      if (image) return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
      return runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'auto') {
      const status = await getLmStudioConnectionStatus();
      const preferredModel = lane === 'tool'
        ? String(status?.resolvedToolModel || status?.toolCandidateModels?.[0] || '').trim()
        : String(status?.resolvedChatModel || status?.candidateModels?.[0] || '').trim();
      if (preferredModel && shouldPreferLmStudioChatCompletions(preferredModel, status)) {
        return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
      }
    }
    try {
      return await runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
    } catch (error) {
      const code = error?.statusCode;
      const msg = String(error?.message || '');
      if (error?.name === 'AbortError' || /timed out/i.test(msg)) throw error;
      if (code === 404 || /404/.test(msg) || /not found/i.test(msg) || /No assistant text from LM Studio stateful chat/i.test(msg) || /LM Studio stateful chat error/i.test(msg)) {
        clearLmStudioThread(memories);
        try {
          return await runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime, latencyBudget });
        } catch (chatError) {
          const chatCode = chatError?.statusCode;
          const chatMsg = String(chatError?.message || '');
          if (chatCode === 404 || /404/.test(chatMsg) || /not found/i.test(chatMsg)) {
            if (image) {
              throw new Error('LM Studio /responses fallback cannot carry vision attachments. Use native chat or chat/completions with a vision-capable model.');
            }
            return runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime, latencyBudget });
          }
          throw chatError;
        }
      }
      throw error;
    }
  }

  async function streamLmStudioLocal({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime, latencyBudget = null }) {
    const transport = LOCAL_LLM_TRANSPORT;
    if (transport === 'stateful' || transport === 'native' || transport === 'native-chat' || transport === 'stateful-chat') {
      return streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'chat') {
      return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'responses') {
      if (image) return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
      return streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
    }
    if (transport === 'auto') {
      const status = await getLmStudioConnectionStatus();
      const preferredModel = lane === 'tool'
        ? String(status?.resolvedToolModel || status?.toolCandidateModels?.[0] || '').trim()
        : String(status?.resolvedChatModel || status?.candidateModels?.[0] || '').trim();
      if (preferredModel && shouldPreferLmStudioChatCompletions(preferredModel, status)) {
        return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
      }
    }
    try {
      return await streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
    } catch (error) {
      const code = error?.statusCode;
      const msg = String(error?.message || '');
      if (error?.name === 'AbortError' || /timed out/i.test(msg)) throw error;
      if (code === 404 || /404/.test(msg) || /not found/i.test(msg) || /No assistant text from LM Studio stateful chat stream/i.test(msg) || /LM Studio stateful chat stream error/i.test(msg)) {
        clearLmStudioThread(memories);
        try {
          return await streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
        } catch (chatError) {
          const chatCode = chatError?.statusCode;
          const chatMsg = String(chatError?.message || '');
          if (chatCode === 404 || /404/.test(chatMsg) || /not found/i.test(chatMsg)) {
            if (image) {
              throw new Error('LM Studio /responses fallback cannot carry vision attachments. Use native chat or chat/completions with a vision-capable model.');
            }
            return streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime, latencyBudget });
          }
          throw chatError;
        }
      }
      throw error;
    }
  }

  return {
    runLmStudioResponsesApi,
    runLmStudioStatefulChatApi,
    streamLmStudioStatefulChatApi,
    streamLmStudioResponsesApi,
    streamLmStudioChatCompletionsApi,
    runLmStudioChatCompletionsApi,
    runLmStudioLocal,
    streamLmStudioLocal,
  };
}

module.exports = {
  createLmStudioTransportApi,
};
