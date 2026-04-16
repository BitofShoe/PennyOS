import { escapeHtml, stripDraftMood } from './penny-expression-runtime.mjs';

/**
 * @typedef {Object} TranscriptRowViewModel
 * @property {'assistant' | 'user'} role
 * @property {boolean} streaming
 * @property {string} mood
 * @property {string} content
 * @property {string | null} image
 * @property {{ name: string, meta: string } | null} file
 * @property {string} toolMeta
 * @property {boolean} loading
 */

function defaultFormatBytes(bytes = 0) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${Math.round(size)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

/**
 * @returns {TranscriptRowViewModel[]}
 */
export function buildTranscriptMessageViewModels(messages = [], {
  loading = false,
  stateMood = 'calm',
  formatBytesFn = defaultFormatBytes,
} = {}) {
  const rows = [];
  const list = Array.isArray(messages) ? messages : [];
  const hasStreamingDraft = list[list.length - 1]?.role === 'assistant' && list[list.length - 1]?.streaming;

  for (const message of list) {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const mood = role === 'assistant' && message?.mood ? String(message.mood) : stateMood;
    const content = message?.streaming ? stripDraftMood(message?.content || '') : String(message?.content || '');
    const file = (message?.file || message?.fileMeta) && role === 'user'
      ? {
          name: String((message.file || message.fileMeta).name || 'Attached file'),
          meta: (message.file || message.fileMeta).lineCount
            ? `${(message.file || message.fileMeta).lineCount} lines`
            : formatBytesFn((message.file || message.fileMeta).size || 0),
        }
      : null;
    const toolLabels = Array.isArray(message?.toolsUsed)
      ? message.toolsUsed.map((tool) => tool?.label || tool?.name).filter(Boolean)
      : [];

    rows.push({
      role,
      streaming: message?.streaming === true,
      mood,
      content,
      image: role === 'user' ? (message?.image || null) : null,
      file,
      toolMeta: message?.toolStatus || (toolLabels.length ? `checked ${toolLabels.join(' • ')}` : ''),
      loading: false,
    });
  }

  if (loading && !hasStreamingDraft) {
    rows.push({
      role: 'assistant',
      streaming: false,
      mood: 'thinking',
      content: '',
      image: null,
      file: null,
      toolMeta: '',
      loading: true,
    });
  }

  return rows;
}

export function renderTranscriptMessages({
  chatEl,
  introEl = null,
  cyberDecorEl = null,
  chatWrapEl = null,
  messages = [],
  loading = false,
  stateMood = 'calm',
  avatarSrcForMood,
  appendMessageDecor,
  formatBytesFn = defaultFormatBytes,
  escapeHtmlFn = escapeHtml,
} = {}) {
  if (!chatEl) return [];
  const rows = buildTranscriptMessageViewModels(messages, { loading, stateMood, formatBytesFn });

  chatEl.innerHTML = '';
  if (introEl) introEl.hidden = true;
  if (cyberDecorEl) {
    cyberDecorEl.dataset.scene = rows.length === 0 && !loading ? 'empty' : 'thread';
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const item = chatEl.ownerDocument.createElement('div');
    item.className = `msg-row ${row.role}${row.streaming ? ' streaming' : ''}`;

    if (row.role === 'assistant') {
      const header = chatEl.ownerDocument.createElement('div');
      header.className = 'msg-header';
      header.innerHTML = `<img class="msg-avatar" src="${avatarSrcForMood(row.mood)}" alt="" /><span class="msg-label">PENNY</span>`;
      item.appendChild(header);
    }

    if (row.image && row.role === 'user') {
      const imgWrap = chatEl.ownerDocument.createElement('div');
      imgWrap.className = 'msg-image';
      imgWrap.innerHTML = `<img src="${row.image}" alt="Attached" />`;
      item.appendChild(imgWrap);
    }

    if (row.file && row.role === 'user') {
      const fileWrap = chatEl.ownerDocument.createElement('div');
      fileWrap.className = 'msg-file';
      fileWrap.innerHTML = `
        <span class="msg-file-icon" aria-hidden="true">&#128206;</span>
        <div class="msg-file-copy">
          <strong>${escapeHtmlFn(row.file.name)}</strong>
          <small>${escapeHtmlFn(row.file.meta)}</small>
        </div>
      `;
      item.appendChild(fileWrap);
    }

    const bubble = chatEl.ownerDocument.createElement('div');
    bubble.className = `bubble ${row.role}${row.streaming ? ' streaming' : ''}${row.loading ? ' loading-bubble' : ''}`;
    bubble.innerHTML = row.loading
      ? '<span></span><span></span><span></span>'
      : (row.content
        ? escapeHtmlFn(row.content).replace(/\n/g, '<br>')
        : (row.streaming ? '<span class="stream-caret" aria-hidden="true"></span>' : ''));
    item.appendChild(bubble);

    if (row.toolMeta) {
      const meta = chatEl.ownerDocument.createElement('div');
      meta.className = 'msg-meta live';
      meta.textContent = row.toolMeta;
      item.appendChild(meta);
    }

    appendMessageDecor?.(item, index, row.role);
    chatEl.appendChild(item);
  }

  if (chatWrapEl) {
    chatWrapEl.scrollTop = chatWrapEl.scrollHeight;
  } else if (chatEl.parentElement) {
    chatEl.parentElement.scrollTop = chatEl.parentElement.scrollHeight;
  }

  return rows;
}

export function updateStreamingAssistantBubble({
  chatEl,
  text = '',
  chatWrapEl = null,
  stripDraftMoodFn = stripDraftMood,
  escapeHtmlFn = escapeHtml,
} = {}) {
  if (!chatEl) return false;
  const rows = chatEl.querySelectorAll('.msg-row.assistant');
  const row = rows[rows.length - 1];
  if (!row) return false;
  const bubble = row.querySelector('.bubble.assistant');
  if (!bubble) return false;
  const visible = stripDraftMoodFn(text);
  bubble.classList.add('streaming');
  row.classList.add('streaming');
  bubble.innerHTML = visible
    ? escapeHtmlFn(visible).replace(/\n/g, '<br>')
    : '<span class="stream-caret" aria-hidden="true"></span>';
  const scrollHost = chatWrapEl || chatEl.parentElement;
  if (scrollHost) {
    scrollHost.scrollTop = scrollHost.scrollHeight;
  }
  return true;
}

export async function readPennyEventStream(response, handlers = {}) {
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('Streaming is not supported by this browser response.');
  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (frameText) => {
    const frame = String(frameText || '').trim();
    if (!frame) return;
    let event = 'message';
    const dataLines = [];
    for (const rawLine of frame.split(/\r?\n/)) {
      if (rawLine.startsWith('event:')) event = rawLine.slice(6).trim();
      else if (rawLine.startsWith('data:')) dataLines.push(rawLine.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const dataText = dataLines.join('\n');
    let data = dataText;
    try {
      data = JSON.parse(dataText);
    } catch {}
    handlers.onEvent?.(event, data);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      flushFrame(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
    if (done) break;
  }
  if (buffer.trim()) flushFrame(buffer);
}
