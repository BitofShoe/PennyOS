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

function stableDecorSeed(value = '') {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sanitizeCodeLanguage(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_+.#-]/g, '')
    .slice(0, 32);
}

function renderInlineTranscriptText(text = '', escapeHtmlFn = escapeHtml) {
  return String(text || '')
    .split(/(`[^`\n]+`)/g)
    .map((part) => {
      if (/^`[^`\n]+`$/.test(part)) {
        return `<code class="bubble-inline-code">${escapeHtmlFn(part.slice(1, -1))}</code>`;
      }
      return escapeHtmlFn(part)
        .replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_\n][\s\S]*?)__/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    })
    .join('');
}

function renderPlainTranscriptText(text = '', escapeHtmlFn = escapeHtml) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return '';

  return normalized
    .split(/\n{2,}/)
    .map((rawBlock) => {
      const lines = rawBlock.split('\n');
      const heading = lines.length === 1 ? lines[0].match(/^(#{1,3})\s+(.+)$/) : null;
      if (heading) {
        const level = Math.min(3, heading[1].length);
        return `<h${level + 2} class="bubble-heading">${renderInlineTranscriptText(heading[2], escapeHtmlFn)}</h${level + 2}>`;
      }

      const unordered = lines.every((line) => /^\s*[-*+]\s+/.test(line));
      const ordered = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
      if (unordered || ordered) {
        const tag = ordered ? 'ol' : 'ul';
        const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
        const items = lines
          .map((line) => `<li>${renderInlineTranscriptText(line.replace(marker, ''), escapeHtmlFn)}</li>`)
          .join('');
        return `<${tag} class="bubble-list">${items}</${tag}>`;
      }

      return `<p class="bubble-paragraph">${lines.map((line) => renderInlineTranscriptText(line, escapeHtmlFn)).join('<br>')}</p>`;
    })
    .join('');
}

function renderCodeBlockHtml(code = '', language = '', escapeHtmlFn = escapeHtml) {
  const safeLanguage = sanitizeCodeLanguage(language);
  const codeAttrs = safeLanguage
    ? ` class="language-${safeLanguage}" data-language="${safeLanguage}"`
    : '';
  return `<pre class="bubble-code"><code${codeAttrs}>${escapeHtmlFn(String(code || ''))}</code></pre>`;
}

export function renderTranscriptContentHtml(content = '', { escapeHtmlFn = escapeHtml, streaming = false } = {}) {
  const text = String(content || '');
  if (!text) return '';

  const openingFencePattern = /^```([A-Za-z0-9_+.#-]{0,32})?\s*$/;
  const closingFencePattern = /^```\s*$/;
  const lines = text.split('\n');
  const segments = [];
  let plainLines = [];
  let codeLines = [];
  let codeLanguage = '';
  let inCode = false;

  const flushPlain = () => {
    if (!plainLines.length) return;
    segments.push({ type: 'text', value: plainLines.join('\n') });
    plainLines = [];
  };

  for (const line of lines) {
    if (!inCode) {
      const match = line.match(openingFencePattern);
      if (match) {
        flushPlain();
        inCode = true;
        codeLanguage = match[1] || '';
        codeLines = [];
        continue;
      }
      plainLines.push(line);
      continue;
    }

    if (closingFencePattern.test(line)) {
      segments.push({ type: 'code', value: codeLines.join('\n'), language: codeLanguage });
      inCode = false;
      codeLanguage = '';
      codeLines = [];
      continue;
    }

    codeLines.push(line);
  }

  if (inCode && streaming) {
    segments.push({ type: 'code', value: codeLines.join('\n'), language: codeLanguage });
  } else if (inCode) {
    return renderPlainTranscriptText(text, escapeHtmlFn);
  }

  flushPlain();

  return segments
    .map((segment) => (segment.type === 'code'
      ? renderCodeBlockHtml(segment.value, segment.language, escapeHtmlFn)
      : renderPlainTranscriptText(segment.value, escapeHtmlFn)))
    .filter(Boolean)
    .join('');
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

  for (let index = 0; index < list.length; index += 1) {
    const message = list[index];
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

    const decorKey = String(
      message?.id
      || message?.clientId
      || message?.createdAt
      || `${role}:${index}`,
    );

    rows.push({
      role,
      streaming: message?.streaming === true,
      mood,
      content,
      image: role === 'user' ? (message?.image || null) : null,
      file,
      toolMeta: message?.toolStatus || (toolLabels.length ? `checked ${toolLabels.join(' • ')}` : ''),
      loading: false,
      decorKey,
      decorSeed: stableDecorSeed(decorKey),
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
      decorKey: 'assistant:loading',
      decorSeed: stableDecorSeed('assistant:loading'),
    });
  }

  return rows;
}

export function captureTranscriptScrollState(scrollHost, {
  threshold = 48,
  forceStickToLatest = false,
} = {}) {
  if (!scrollHost) {
    return {
      stickToLatest: true,
      scrollTop: 0,
      bottomGap: 0,
    };
  }
  const scrollTop = Math.max(0, Number(scrollHost.scrollTop) || 0);
  const scrollHeight = Math.max(0, Number(scrollHost.scrollHeight) || 0);
  const clientHeight = Math.max(0, Number(scrollHost.clientHeight) || 0);
  const bottomGap = Math.max(0, scrollHeight - clientHeight - scrollTop);
  return {
    stickToLatest: forceStickToLatest || bottomGap <= Math.max(0, Number(threshold) || 0),
    scrollTop,
    bottomGap,
  };
}

export function restoreTranscriptScrollState(scrollHost, snapshot = {}) {
  if (!scrollHost) return;
  if (snapshot.stickToLatest !== false) {
    scrollHost.scrollTop = scrollHost.scrollHeight;
    return;
  }
  const maxScrollTop = Math.max(
    0,
    (Number(scrollHost.scrollHeight) || 0) - (Number(scrollHost.clientHeight) || 0),
  );
  scrollHost.scrollTop = Math.min(Math.max(0, Number(snapshot.scrollTop) || 0), maxScrollTop);
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
  avatarDescriptorForMood = null,
  appendMessageDecor,
  formatBytesFn = defaultFormatBytes,
  escapeHtmlFn = escapeHtml,
  forceStickToLatest = false,
} = {}) {
  if (!chatEl) return [];
  const scrollHost = chatWrapEl || chatEl.parentElement;
  const scrollState = captureTranscriptScrollState(scrollHost, { forceStickToLatest });
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
      const avatar = typeof avatarDescriptorForMood === 'function'
        ? avatarDescriptorForMood(row.mood)
        : { src: avatarSrcForMood(row.mood) };
      const registered = avatar?.renderMode === 'registered-composite';
      const avatarClass = registered ? 'msg-avatar msg-avatar-registered-composite' : 'msg-avatar';
      const fallbackAttribute = avatar?.fallbackSrc
        ? ` data-fallback-src="${escapeHtmlFn(avatar.fallbackSrc)}"`
        : '';
      const avatarHtml = `<img class="${avatarClass}" src="${escapeHtmlFn(avatar?.src || '')}"${fallbackAttribute} data-expression-render-mode="${registered ? 'registered-composite' : 'legacy-chibi'}" alt="" decoding="async" />`;
      header.innerHTML = `${registered ? `<span class="msg-avatar-frame">${avatarHtml}</span>` : avatarHtml}<span class="msg-label">PENNY</span>`;
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
        ? renderTranscriptContentHtml(row.content, { escapeHtmlFn, streaming: row.streaming })
        : (row.streaming ? '<span class="stream-caret" aria-hidden="true"></span>' : ''));
    item.appendChild(bubble);

    if (row.toolMeta) {
      const meta = chatEl.ownerDocument.createElement('div');
      meta.className = 'msg-meta live';
      meta.textContent = row.toolMeta;
      item.appendChild(meta);
    }

    appendMessageDecor?.(item, row.decorSeed ?? index, row.role, row);
    chatEl.appendChild(item);
  }

  restoreTranscriptScrollState(scrollHost, scrollState);

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
  const scrollHost = chatWrapEl || chatEl.parentElement;
  const scrollState = captureTranscriptScrollState(scrollHost);
  const rows = chatEl.querySelectorAll('.msg-row.assistant');
  const row = rows[rows.length - 1];
  if (!row) return false;
  const bubble = row.querySelector('.bubble.assistant');
  if (!bubble) return false;
  const visible = stripDraftMoodFn(text);
  bubble.classList.add('streaming');
  row.classList.add('streaming');
  bubble.innerHTML = visible
    ? renderTranscriptContentHtml(visible, { escapeHtmlFn, streaming: true })
    : '<span class="stream-caret" aria-hidden="true"></span>';
  restoreTranscriptScrollState(scrollHost, scrollState);
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
