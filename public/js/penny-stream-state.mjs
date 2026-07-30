export function createClientStreamReducer() {
  let text = '';
  let statusKey = '';
  let toolKey = '';

  return {
    apply(eventName = '', rawData = null) {
      const event = String(eventName || '');
      const data = rawData && typeof rawData === 'object' ? rawData : {};

      if (event === 'status') {
        const key = `${String(data.stage || '')}\n${String(data.label || '')}`;
        if (key === statusKey) return { changed: false, text };
        statusKey = key;
        return { changed: true, text, data };
      }

      if (event === 'tool') {
        const key = [data.state, data.name, data.label, data.ok]
          .map(value => String(value ?? ''))
          .join('\n');
        if (key === toolKey) return { changed: false, text };
        toolKey = key;
        return { changed: true, text, data };
      }

      if (event === 'stream.reset') {
        text = '';
        statusKey = '';
        toolKey = '';
        return { changed: true, reset: true, text };
      }

      if (event === 'message.delta') {
        const candidate = typeof data.text === 'string' ? data.text : '';
        const content = typeof data.content === 'string' ? data.content : '';
        if (candidate) {
          if (candidate === text || (text && text.startsWith(candidate))) {
            return { changed: false, text };
          }
          text = candidate.startsWith(text) ? candidate : `${text}${content || candidate}`;
        } else if (content) {
          text += content;
        } else {
          return { changed: false, text };
        }
        return { changed: true, text };
      }

      return { changed: true, text, data };
    },
    snapshot() {
      return { text, statusKey, toolKey };
    },
  };
}
