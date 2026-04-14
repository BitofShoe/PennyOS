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
  if (typeof textFromChatMessage !== 'function') throw new TypeError('createLmStudioTransportApi requires textFromChatMessage');
  if (typeof textValueFromField !== 'function') throw new TypeError('createLmStudioTransportApi requires textValueFromField');
  if (typeof collectTextParts !== 'function') throw new TypeError('createLmStudioTransportApi requires collectTextParts');
  if (typeof looksOnlyLikeCoT !== 'function') throw new TypeError('createLmStudioTransportApi requires looksOnlyLikeCoT');
  if (typeof isMissingLmStudioThreadError !== 'function') throw new TypeError('createLmStudioTransportApi requires isMissingLmStudioThreadError');
  if (typeof lmStudioStageLabel !== 'function') throw new TypeError('createLmStudioTransportApi requires lmStudioStageLabel');

  function salvageVisibleReply({ visibleText = '', reasoningText = '' } = {}) {
    let primary = coercePennyVisibleReply(String(visibleText || '').trim());
    if (!primary || looksOnlyLikeCoT(primary)) {
      let fromR = extractPennyFromReasoning(reasoningText);
      if (!fromR) fromR = extractPennyFromPlanningBlob(reasoningText);
      if (fromR) primary = coercePennyVisibleReply(fromR);
    }
    if (!primary && ALLOW_RAW_REASONING_FALLBACK && reasoningText) {
      primary = String(reasoningText).trim();
    }
    return primary ? primary.trim() : '';
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

  function chooseFinalStreamReply({ streamedVisibleText = '', finalizedVisibleText = '', reasoningText = '' } = {}) {
    const streamedCandidate = coercePennyVisibleReply(String(streamedVisibleText || '').trim());
    const finalizedCandidate = salvageVisibleReply({ visibleText: finalizedVisibleText, reasoningText });
    if (!finalizedCandidate) return streamedCandidate || '';
    if (!streamedCandidate) return finalizedCandidate;
    return shouldPreferStreamedVisibleReply(streamedCandidate, finalizedCandidate)
      ? streamedCandidate.trim()
      : finalizedCandidate;
  }

  async function runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      try {
        const payload = {
          model,
          input: buildLmStudioPrompt({ userText, messages, memories, file }),
          temperature: 0.9,
          max_output_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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
        const primary = salvageVisibleReply({ visibleText: outputText, reasoningText });
        if (!primary && RESPONSES_THEN_CHAT_FALLBACK) {
          return runLmStudioChatCompletionsApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime });
        }
        if (!primary) {
          throw new Error(
            'LM Studio /responses returned only internal reasoning (no speakable reply). Try: set PENNY_LOCAL_LLM_TRANSPORT=chat, or enable PENNY_RESPONSES_CHAT_FALLBACK (default on), or turn off reasoning in LM Studio for this model.',
          );
        }
        return primary;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model, status) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      const nativeModel = pickLmStudioNativeModelId(model, status);
      const systemPrompt = buildLmStudioLeanSystemPrompt({ memories });
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
          input: buildLmStudioStatefulInput({ userText, messages, memories, image, file, hasThread: canContinue }),
          temperature: 0.9,
          max_output_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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
        const primary = salvageVisibleReply({ visibleText: outputText, reasoningText });
        if (!primary) {
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
        return primary;
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

  async function streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model, status) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      const nativeModel = pickLmStudioNativeModelId(model, status);
      const systemPrompt = buildLmStudioLeanSystemPrompt({ memories });
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
          input: buildLmStudioStatefulInput({ userText, messages, memories, image, file, hasThread: canContinue }),
          temperature: 0.9,
          max_output_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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

        const primary = chooseFinalStreamReply({
          streamedVisibleText,
          finalizedVisibleText: visibleText,
          reasoningText,
        });
        if (!primary) throw new Error('No assistant text from LM Studio stateful chat stream');

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
        return primary;
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

  async function streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);

      try {
        const payload = {
          model,
          input: buildLmStudioPrompt({ userText, messages, memories, file }),
          temperature: 0.9,
          max_output_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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

        let primary = chooseFinalStreamReply({
          streamedVisibleText,
          finalizedVisibleText: visibleText,
          reasoningText,
        });
        if (!primary && finalResponse) {
          const collected = collectLmStudioResponsesStrings(finalResponse);
          primary = chooseFinalStreamReply({
            streamedVisibleText,
            finalizedVisibleText: collected.outputText,
            reasoningText: collected.reasoningText,
          });
        }
        if (!primary && RESPONSES_THEN_CHAT_FALLBACK) {
          return streamLmStudioChatCompletionsApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime });
        }
        if (!primary) {
          throw new Error(
            'LM Studio /responses stream returned only internal reasoning (no speakable reply). Try: set PENNY_LOCAL_LLM_TRANSPORT=chat, or enable PENNY_RESPONSES_CHAT_FALLBACK (default on), or turn off reasoning in LM Studio for this model.',
          );
        }
        return primary;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);

      try {
        const payload = {
          model,
          messages: buildLmStudioMessages({ userText, messages, memories, image, file }),
          temperature: 0.9,
          max_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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

        const primary = salvageVisibleReply({ visibleText, reasoningText });
        if (!primary) throw new Error('No assistant text from chat/completions stream');
        clearLmStudioThread(memories);
        return primary;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime }) {
    return withLmStudioLaneModel(lane, async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      try {
        const payload = {
          model,
          messages: buildLmStudioMessages({ userText, messages, memories, image, file }),
          temperature: 0.9,
          max_tokens: Math.min(LMSTUDIO_MAX_OUTPUT_TOKENS, LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS),
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
        let text = textFromChatMessage(msg);
        if (!text) {
          const delta = parsed?.choices?.[0]?.delta;
          text = textFromChatMessage(
            typeof delta === 'object' ? { content: delta?.content, reasoning_content: delta?.reasoning_content } : {},
          );
        }
        if (!text) throw new Error(`No assistant text from chat/completions: ${bodyText.slice(0, 800)}`);
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

  async function runLmStudioLocal({ userText, messages, memories, image, file, abortSignal, lane = 'chat', laneRuntime }) {
    const transport = LOCAL_LLM_TRANSPORT;
    if (transport === 'stateful' || transport === 'native' || transport === 'native-chat' || transport === 'stateful-chat') {
      return runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
    }
    if (transport === 'chat') {
      return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
    }
    if (transport === 'responses') {
      if (image) return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
      return runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime });
    }
    if (transport === 'auto') {
      const status = await getLmStudioConnectionStatus();
      const preferredModel = lane === 'tool'
        ? String(status?.resolvedToolModel || status?.toolCandidateModels?.[0] || '').trim()
        : String(status?.resolvedChatModel || status?.candidateModels?.[0] || '').trim();
      if (preferredModel && shouldPreferLmStudioChatCompletions(preferredModel, status)) {
        return runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
      }
    }
    try {
      return await runLmStudioStatefulChatApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
    } catch (error) {
      const code = error?.statusCode;
      const msg = String(error?.message || '');
      if (error?.name === 'AbortError' || /timed out/i.test(msg)) throw error;
      if (code === 404 || /404/.test(msg) || /not found/i.test(msg) || /No assistant text from LM Studio stateful chat/i.test(msg) || /LM Studio stateful chat error/i.test(msg)) {
        clearLmStudioThread(memories);
        try {
          return await runLmStudioChatCompletionsApi({ userText, messages, memories, image, file, abortSignal, lane, laneRuntime });
        } catch (chatError) {
          const chatCode = chatError?.statusCode;
          const chatMsg = String(chatError?.message || '');
          if (chatCode === 404 || /404/.test(chatMsg) || /not found/i.test(chatMsg)) {
            if (image) {
              throw new Error('LM Studio /responses fallback cannot carry vision attachments. Use native chat or chat/completions with a vision-capable model.');
            }
            return runLmStudioResponsesApi({ userText, messages, memories, file, abortSignal, lane, laneRuntime });
          }
          throw chatError;
        }
      }
      throw error;
    }
  }

  async function streamLmStudioLocal({ userText, messages, memories, image, file, onEvent, abortSignal, lane = 'chat', laneRuntime }) {
    const transport = LOCAL_LLM_TRANSPORT;
    if (transport === 'stateful' || transport === 'native' || transport === 'native-chat' || transport === 'stateful-chat') {
      return streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
    }
    if (transport === 'chat') {
      return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
    }
    if (transport === 'responses') {
      if (image) return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
      return streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime });
    }
    if (transport === 'auto') {
      const status = await getLmStudioConnectionStatus();
      const preferredModel = lane === 'tool'
        ? String(status?.resolvedToolModel || status?.toolCandidateModels?.[0] || '').trim()
        : String(status?.resolvedChatModel || status?.candidateModels?.[0] || '').trim();
      if (preferredModel && shouldPreferLmStudioChatCompletions(preferredModel, status)) {
        return streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
      }
    }
    try {
      return await streamLmStudioStatefulChatApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
    } catch (error) {
      const code = error?.statusCode;
      const msg = String(error?.message || '');
      if (error?.name === 'AbortError' || /timed out/i.test(msg)) throw error;
      if (code === 404 || /404/.test(msg) || /not found/i.test(msg) || /No assistant text from LM Studio stateful chat stream/i.test(msg) || /LM Studio stateful chat stream error/i.test(msg)) {
        clearLmStudioThread(memories);
        try {
          return await streamLmStudioChatCompletionsApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane, laneRuntime });
        } catch (chatError) {
          const chatCode = chatError?.statusCode;
          const chatMsg = String(chatError?.message || '');
          if (chatCode === 404 || /404/.test(chatMsg) || /not found/i.test(chatMsg)) {
            if (image) {
              throw new Error('LM Studio /responses fallback cannot carry vision attachments. Use native chat or chat/completions with a vision-capable model.');
            }
            return streamLmStudioResponsesApi({ userText, messages, memories, file, onEvent, abortSignal, lane, laneRuntime });
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
