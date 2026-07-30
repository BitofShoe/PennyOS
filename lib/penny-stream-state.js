const DEFAULT_REASONING_STREAM_MAX_CHARS = 8192;

function createBoundedTextAccumulator({
  maxChars = DEFAULT_REASONING_STREAM_MAX_CHARS,
} = {}) {
  const limit = Math.max(0, Math.floor(Number(maxChars) || 0));
  let text = '';
  let totalChars = 0;

  function append(value = '') {
    const chunk = String(value || '');
    if (!chunk) return snapshot();
    totalChars += chunk.length;
    if (text.length < limit) {
      text += chunk.slice(0, Math.max(0, limit - text.length));
    }
    return snapshot();
  }

  function replace(value = '') {
    text = '';
    totalChars = 0;
    return append(value);
  }

  function snapshot() {
    return {
      text,
      capturedChars: text.length,
      totalChars,
      truncated: totalChars > text.length,
    };
  }

  return {
    append,
    replace,
    snapshot,
  };
}

function createStreamEventForwarder(onEvent) {
  let lastStatusKey = '';
  let lastToolKey = '';
  let lastVisibleText = '';
  let lastResetReason = '';

  return function forward(rawEvent = {}) {
    const event = rawEvent && typeof rawEvent === 'object' ? rawEvent : {};
    if (event.type === 'status') {
      const normalized = {
        type: 'status',
        stage: String(event.stage || ''),
        label: String(event.label || ''),
      };
      const key = `${normalized.stage}\n${normalized.label}`;
      if (key === lastStatusKey) return false;
      lastStatusKey = key;
      lastResetReason = '';
      onEvent?.(normalized);
      return true;
    }

    if (event.type === 'tool') {
      const key = [
        event.state,
        event.name,
        event.label,
        event.ok,
      ].map(value => String(value ?? '')).join('\n');
      if (key === lastToolKey) return false;
      lastToolKey = key;
      lastResetReason = '';
      onEvent?.(event);
      return true;
    }

    if (event.type === 'stream.reset') {
      const reason = String(event.reason || 'stream-retry');
      if (!lastVisibleText && reason === lastResetReason) return false;
      lastVisibleText = '';
      lastStatusKey = '';
      lastToolKey = '';
      lastResetReason = reason;
      onEvent?.({ type: 'stream.reset', reason });
      return true;
    }

    if (event.type === 'message.delta') {
      const candidate = typeof event.text === 'string' ? event.text : '';
      let content = typeof event.content === 'string' ? event.content : '';
      let nextText = candidate;
      if (candidate) {
        if (candidate === lastVisibleText || (lastVisibleText && lastVisibleText.startsWith(candidate))) {
          return false;
        }
        if (candidate.startsWith(lastVisibleText)) {
          content = candidate.slice(lastVisibleText.length);
        } else if (!content) {
          content = candidate;
        }
      } else {
        if (!content) return false;
        nextText = `${lastVisibleText}${content}`;
      }
      if (!content && nextText === lastVisibleText) return false;
      lastVisibleText = nextText;
      lastResetReason = '';
      onEvent?.({
        type: 'message.delta',
        content,
        text: nextText,
      });
      return true;
    }

    lastResetReason = '';
    onEvent?.(event);
    return true;
  };
}

module.exports = {
  DEFAULT_REASONING_STREAM_MAX_CHARS,
  createBoundedTextAccumulator,
  createStreamEventForwarder,
};
