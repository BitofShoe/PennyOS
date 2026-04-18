/**
 * @typedef {'empty_input' | 'raw_reasoning_fallback' | 'tagged_visible_reply' | 'salvaged_draft_candidate' | 'salvaged_quote_candidate' | 'cleanup_mood_tagged_reply' | 'cleanup_plain_reply'} VisibleReplyReasonCode
 *
 * @typedef {Object} VisibleReplyDecision
 * @property {string} text
 * @property {VisibleReplyReasonCode} reasonCode
 * @property {boolean} cleanupApplied
 * @property {boolean} materialChange
 * @property {boolean} reconstructedReply
 * @property {boolean} usedReasoningFallback
 * @property {Object} cleanupTransform
 */
const VISIBLE_REPLY_REASON_CODES = Object.freeze({
  EMPTY_INPUT: 'empty_input',
  RAW_REASONING_FALLBACK: 'raw_reasoning_fallback',
  TAGGED_VISIBLE_REPLY: 'tagged_visible_reply',
  SALVAGED_DRAFT_CANDIDATE: 'salvaged_draft_candidate',
  SALVAGED_QUOTE_CANDIDATE: 'salvaged_quote_candidate',
  CLEANUP_MOOD_TAGGED_REPLY: 'cleanup_mood_tagged_reply',
  CLEANUP_PLAIN_REPLY: 'cleanup_plain_reply',
});

function createVisibleReplyApi({
  ALLOW_RAW_REASONING_FALLBACK,
  retagAssistantReply,
} = {}) {
  if (typeof retagAssistantReply !== 'function') {
    throw new TypeError('createVisibleReplyApi requires retagAssistantReply');
  }

  function stripThinkSpans(s) {
    let t = String(s || '');
    const stripBlocks = [
      /\u003c\s*think\s*\u003e[\s\S]*?\u003c\s*\/\s*think\s*\u003e/gis,
      /\u003credacted_reasoning\u003e[\s\S]*?\u003c\/redacted_reasoning\u003e/gis,
      /\u003creasoning\u003e[\s\S]*?\u003c\/reasoning\u003e/gi,
      /<\|channel\>\s*(?:thought|analysis)[\s\S]*?<channel\|>/gi,
    ];
    for (const re of stripBlocks) {
      t = t.replace(re, '');
    }
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }

  function takeAfterLastHorizontalRule(txt) {
    const x = String(txt || '');
    const chunks = x.split(/\n-{3,}\n/);
    if (chunks.length >= 2) {
      return chunks[chunks.length - 1].trim();
    }
    return x.trim();
  }

  function extractTaggedVisibleReply(text = '') {
    const source = String(text || '');
    const matches = [
      source.match(/<final>([\s\S]*?)<\/final>/i),
      source.match(/<answer>([\s\S]*?)<\/answer>/i),
      source.match(/<response>([\s\S]*?)<\/response>/i),
    ].filter(Boolean);
    return matches[0]?.[1]?.trim() || '';
  }

  function takeAfterFinalCue(text = '') {
    const source = String(text || '');
    const re = /(?:^|\n)(?:final answer|final response|assistant reply|visible reply|spoken reply)\s*:\s*/ig;
    let lastMatch = null;
    let match;
    while ((match = re.exec(source)) !== null) {
      lastMatch = match;
    }
    return lastMatch ? source.slice(lastMatch.index + lastMatch[0].length).trim() : source.trim();
  }

  function stripWrappingCodeFence(text = '') {
    let out = String(text || '').trim();
    if (/^```/.test(out) && /```$/.test(out)) {
      out = out.replace(/^```[a-z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    return out;
  }

  function stripReplyPrefix(text = '') {
    return String(text || '').replace(/^(?:penny|assistant)\s*:\s*/i, '').trim();
  }

  function repairCommonMojibake(text = '') {
    return String(text || '')
      .replace(/â€™|â€˜/g, "'")
      .replace(/â€œ|â€/g, '"')
      .replace(/â€“|â€”|â€‘/g, '-')
      .replace(/â€¦/g, '...')
      .replace(/Â /g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2011\u2013\u2014\u2015]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00a0/g, ' ');
  }

  function normalizeVisibleReplyComparable(text = '') {
    let out = repairCommonMojibake(String(text || ''));
    out = stripThinkSpans(out);
    const tagged = extractTaggedVisibleReply(out);
    if (tagged) out = tagged;
    out = takeAfterLastHorizontalRule(out);
    out = takeAfterFinalCue(out);
    out = stripReplyPrefix(stripWrappingCodeFence(out));
    out = out
      .replace(/\s*\[MOOD:\w+\]\s*/gi, ' ')
      .replace(/(?:^|\n)\s*\*?\s*(?:draft(?:\s+\d+)?|final polish)\s*:\s*/gi, ' ')
      .replace(/actually, let's make it more\s*["']?penny["']?\.?\s*/gi, ' ');
    return out
      .split(/\r?\n/)
      .map((line) => normalizeMetaLead(line))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function hasVisibleCleanupArtifacts(raw = '') {
    const text = String(raw || '');
    const hasNormalizedMetaLead = String(text || '')
      .split(/\r?\n/)
      .some((line) => /^(thinking process|analyze the request|draft(?:\s+\d+)?|final polish)\b/i.test(normalizeMetaLead(line)));
    if (hasNormalizedMetaLead) return true;
    return /<\s*(?:think|redacted_reasoning|reasoning|final|answer|response)\b/i.test(text)
      || /<\|channel\>\s*(?:thought|analysis)/i.test(text)
      || /(?:^|\n)\s*(?:thinking process|analyze the request|draft(?:\s+\d+)?|final polish)\b/i.test(text)
      || /actually, let's make it more/i.test(text)
      || /```/.test(text)
      || /^(?:penny|assistant)\s*:/im.test(text)
      || /[“”‘’…—–]/.test(text);
  }

  function buildCleanupTransform(raw = '', reasonCode = VISIBLE_REPLY_REASON_CODES.EMPTY_INPUT, {
    cleanupApplied = false,
    materialChange = false,
    reconstructedReply = false,
    usedReasoningFallback = false,
  } = {}) {
    const text = String(raw || '');
    const operations = [];
    if (/<\s*(?:think|redacted_reasoning|reasoning)\b/i.test(text) || /<\|channel\>\s*(?:thought|analysis)/i.test(text)) {
      operations.push('strip-internal-reasoning');
    }
    if (/<\s*(?:final|answer|response)\b/i.test(text)) operations.push('extract-visible-tag');
    if (/(?:^|\n)(?:final answer|final response|assistant reply|visible reply|spoken reply)\s*:/i.test(text)) {
      operations.push('extract-final-cue');
    }
    if (/```/.test(text)) operations.push('strip-code-fence');
    if (/^(?:penny|assistant)\s*:/im.test(text)) operations.push('strip-speaker-prefix');
    if (/(?:^|\n)\s*\*?\s*(?:thinking process|analyze the request|draft(?:\s+\d+)?|final polish)\b/i.test(text)) {
      operations.push('drop-meta-lines');
    }
    if (/[â€œâ€â€˜â€™â€¦â€”â€“]|Ã/.test(text)) operations.push('repair-text-encoding');
    if (reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE) operations.push('salvage-draft-candidate');
    if (reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE) operations.push('salvage-quoted-reply');
    if (usedReasoningFallback === true || reasonCode === VISIBLE_REPLY_REASON_CODES.RAW_REASONING_FALLBACK) {
      operations.push('fallback-to-reasoning');
    }
    if (
      reasonCode === VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY
      || reasonCode === VISIBLE_REPLY_REASON_CODES.CLEANUP_PLAIN_REPLY
      || reasonCode === VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY
    ) {
      operations.push('retag-visible-reply');
    }
    let transformClass = 'pass-through';
    if (reasonCode === VISIBLE_REPLY_REASON_CODES.RAW_REASONING_FALLBACK) transformClass = 'reasoning-fallback';
    else if (
      reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE
      || reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE
    ) transformClass = 'salvage-reconstruction';
    else if (reasonCode === VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY) transformClass = 'tag-extract';
    else if (cleanupApplied) transformClass = 'presentation-cleanup';
    return {
      class: transformClass,
      scope: 'presentation-only',
      semanticRepair: false,
      materiality: reconstructedReply
        ? 'reconstructed'
        : (cleanupApplied
          ? (materialChange ? 'material' : 'surface')
          : 'none'),
      idempotent: true,
      expectedIdempotence: 'stable-once-cleaned',
      operations: [...new Set(operations)],
    };
  }

  function finalizeVisibleReplyDecision(raw = '', text = '', reasonCode = VISIBLE_REPLY_REASON_CODES.EMPTY_INPUT, {
    usedReasoningFallback = false,
  } = {}) {
    const normalizedText = String(text || '').trim();
    const reconstructedReply = usedReasoningFallback === true
      || reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE
      || reasonCode === VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE
      || reasonCode === VISIBLE_REPLY_REASON_CODES.RAW_REASONING_FALLBACK;
    const materialChange = reconstructedReply
      || (
        reasonCode !== VISIBLE_REPLY_REASON_CODES.EMPTY_INPUT
        && normalizeVisibleReplyComparable(raw) !== normalizeVisibleReplyComparable(normalizedText)
      );
    const cleanupApplied = reconstructedReply
      || (
        reasonCode !== VISIBLE_REPLY_REASON_CODES.EMPTY_INPUT
        && reasonCode !== VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY
        && (materialChange || hasVisibleCleanupArtifacts(raw))
      );
    const usedFallback = usedReasoningFallback === true || reasonCode === VISIBLE_REPLY_REASON_CODES.RAW_REASONING_FALLBACK;
    return {
      text: normalizedText,
      reasonCode,
      cleanupApplied,
      materialChange,
      reconstructedReply,
      usedReasoningFallback: usedFallback,
      cleanupTransform: buildCleanupTransform(raw, reasonCode, {
        cleanupApplied,
        materialChange,
        reconstructedReply,
        usedReasoningFallback: usedFallback,
      }),
    };
  }

  function normalizeMetaLead(line = '') {
    return repairCommonMojibake(String(line || ''))
      .trim()
      .replace(/^[>\-*+\d.\s)]+/, '')
      .replace(/\*/g, '')
      .replace(/[`\u201c\u201d]/g, '"')
      .trim();
  }

  function isMetaThinkingLine(line) {
    const raw = String(line || '').trim();
    const x = normalizeMetaLead(raw);
    if (x.length < 12) return true;
    if (/^(#{1,3}\s|[-*]\s|Step\s+\d|\d+\.\s|Output:|Response:|Final answer:)/i.test(raw)) return true;
    if (/^(Thinking Process|Analyze the Request|Determine the Voice|Drafting the Reply|Fact Check|Constraint Check|Refinement|Penny-ifying|Final Polish|Draft(?:\s+\d+)?|Observation|Tone|Content)\b/i.test(x)) return true;
    return /^(I need to|I'll |I should|Let me |First,|The user |Okay, I|Since the |Based on|Looking at|I will |My goal|According to|Here's |I must|We need|I can |I have to|To respond|I want to|I'm going to|Note:|Analysis:|Actually, let's make it more)/i.test(x);
  }

  function stripLeadingMetaLines(block = '') {
    const lines = String(block || '').split(/\r?\n/);
    while (lines.length) {
      const first = String(lines[0] || '').trim();
      if (!first) {
        lines.shift();
        continue;
      }
      if (isMetaThinkingLine(first)) {
        lines.shift();
        continue;
      }
      break;
    }
    return lines.join('\n').trim();
  }

  function cleanDraftCandidate(text = '') {
    let out = repairCommonMojibake(String(text || '').trim()).replace(/\s+\[MOOD:\w+\]\s*$/i, '');
    out = out.replace(/^["\u201c\u201d]\s*/, '').trim();
    if ((out.match(/"/g) || []).length % 2 === 1 && out.startsWith('"')) {
      out = out.slice(1).trim();
    }
    return out.replace(/\s{2,}/g, ' ').trim();
  }

  function collectDraftCandidates(text = '') {
    const lines = String(text || '').split(/\r?\n/);
    const candidates = [];
    const isDraftLead = (line) => {
      const x = normalizeMetaLead(line);
      return /^(Draft(?:\s+\d+)?|Final Polish)\s*:/i.test(x) || /^Actually, let's make it more/i.test(x);
    };
    const trimDraftLead = (line) => {
      const x = normalizeMetaLead(line);
      return x
        .replace(/^(?:Draft(?:\s+\d+)?|Final Polish)\s*:\s*/i, '')
        .replace(/^Actually, let's make it more\s*"penny"\.?\s*/i, '')
        .trim();
    };
    for (let i = 0; i < lines.length; i += 1) {
      if (!isDraftLead(lines[i])) continue;
      const collected = [];
      const inline = trimDraftLead(lines[i]);
      if (inline) collected.push(inline);
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = String(lines[j] || '').trim();
        if (!next) {
          if (collected.length) break;
          continue;
        }
        if (isDraftLead(next) || (isMetaThinkingLine(next) && collected.length)) break;
        if (isMetaThinkingLine(next) && !collected.length) continue;
        collected.push(next.replace(/^[-*]\s*/, '').trim());
      }
      const candidate = cleanDraftCandidate(collected.join(' '));
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  function collectQuotedReplyCandidates(text = '') {
    return [...String(text || '').matchAll(/"([^"\n]{20,}?)"/g)]
      .map((match) => cleanDraftCandidate(match[1]))
      .filter((candidate) => candidate && !isMetaThinkingLine(candidate));
  }

  function paragraphLooksLikeCoT(p) {
    const block = String(p || '').trim();
    if (!block) return true;
    if (isMetaThinkingLine(block.split('\n')[0] || '')) return true;
    if (/\b(option \d|draft(?:\s+\d+)?|final polish|refining option|adding more bite)\b/i.test(block)) return true;
    const head = block.slice(0, 260);
    if (/\b(user (said|wants|is asking)|the prompt|as (an )?ai|instruction says|penny should|i (need|must|will|should) (respond|answer|write|mention|make sure)|format.*mood tag|the mood should|let'?s (draft|try|stick)|this gives me room|wait, i need to check|actually, looking closer)\b/i.test(head)) {
      return true;
    }
    return false;
  }

  function looksOnlyLikeCoT(str) {
    const m = String(str || '').trim();
    if (!m) return true;
    if (/\[MOOD:\w+\]/.test(m)) return false;
    if (m.length < 100) return false;
    return paragraphLooksLikeCoT(m.split(/\n\n/)[0] || m);
  }

  function classifyVisibleReplyDecision(raw = '') {
    let t = stripThinkSpans(repairCommonMojibake(String(raw || '').trim()));
    t = t.replace(/^<\|channel\>\s*(?:thought|analysis)\s*/i, '').trim();
    if (!t) {
      return finalizeVisibleReplyDecision(raw, '', VISIBLE_REPLY_REASON_CODES.EMPTY_INPUT);
    }
    if (ALLOW_RAW_REASONING_FALLBACK) {
      return finalizeVisibleReplyDecision(raw, t, VISIBLE_REPLY_REASON_CODES.RAW_REASONING_FALLBACK, {
        usedReasoningFallback: true,
      });
    }
    const tagged = extractTaggedVisibleReply(t);
    const sawTaggedVisibleReply = !!tagged;
    if (tagged) t = tagged;
    t = takeAfterLastHorizontalRule(t);
    t = takeAfterFinalCue(t);
    t = stripReplyPrefix(stripWrappingCodeFence(t));
    const moodMatches = [...t.matchAll(/\[MOOD:(\w+)\]/g)];
    const lastMood = moodMatches.length ? moodMatches[moodMatches.length - 1] : null;
    if (lastMood) {
      const moodTag = lastMood[0];
      const endIdx = lastMood.index;
      const before = t.slice(0, endIdx).trim();
      const afterMood = t.slice(endIdx + moodTag.length).trim();
      const draftCandidates = collectDraftCandidates(before);
      const quoteCandidates = collectQuotedReplyCandidates(before);
      const parts = before.split(/\n{2,}/).map(v => stripLeadingMetaLines(v)).filter(Boolean);
      while (parts.length > 1 && paragraphLooksLikeCoT(parts[0])) {
        parts.shift();
      }
      let body = parts.join('\n\n').trim();
      let reasonCode = sawTaggedVisibleReply
        ? VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY
        : VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY;
      if ((!body || looksOnlyLikeCoT(body)) && draftCandidates.length) {
        body = draftCandidates[draftCandidates.length - 1];
        reasonCode = VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE;
      }
      if ((!body || looksOnlyLikeCoT(body)) && quoteCandidates.length) {
        body = quoteCandidates.join('\n\n');
        reasonCode = VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE;
      }
      if (!body) body = stripLeadingMetaLines(before);
      body = cleanDraftCandidate(body);
      const out = `${body}\n${moodTag}${afterMood ? `\n${afterMood}` : ''}`.trim();
      return finalizeVisibleReplyDecision(
        raw,
        retagAssistantReply(repairCommonMojibake(out.replace(/\n{3,}/g, '\n\n')), lastMood[1] || ''),
        reasonCode,
      );
    }
    const draftCandidates = collectDraftCandidates(t);
    const quoteCandidates = collectQuotedReplyCandidates(t);
    const tailParts = t.split(/\n{2,}/).map(v => stripLeadingMetaLines(v)).filter(Boolean);
    while (tailParts.length > 1 && paragraphLooksLikeCoT(tailParts[0])) {
      tailParts.shift();
    }
    let out = tailParts.join('\n\n').trim();
    let reasonCode = sawTaggedVisibleReply
      ? VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY
      : VISIBLE_REPLY_REASON_CODES.CLEANUP_PLAIN_REPLY;
    if ((!out || looksOnlyLikeCoT(out)) && draftCandidates.length) {
      out = draftCandidates[draftCandidates.length - 1];
      reasonCode = VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE;
    }
    if ((!out || looksOnlyLikeCoT(out)) && quoteCandidates.length) {
      out = quoteCandidates.join('\n\n');
      reasonCode = VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE;
    }
    if (!out) out = stripLeadingMetaLines(t);
    out = cleanDraftCandidate(out);
    return finalizeVisibleReplyDecision(
      raw,
      retagAssistantReply(repairCommonMojibake(out.replace(/\n{3,}/g, '\n\n'))),
      reasonCode,
    );
  }

  function coercePennyVisibleReply(raw) {
    return classifyVisibleReplyDecision(raw).text;
  }

  function collectLmStudioResponsesStrings(parsed) {
    const outputParts = [];
    const reasoningParts = [];
    const top = String(parsed?.output_text || '').trim();
    if (top) outputParts.push(top);

    function walkPart(part) {
      if (part == null) return;
      if (Array.isArray(part)) {
        part.forEach(walkPart);
        return;
      }
      if (typeof part !== 'object') return;
      const t = String(part.type || '');
      const txt = part.text;
      if (typeof txt === 'string' && txt.length) {
        if (t === 'output_text') {
          outputParts.push(txt);
        } else if (t === 'reasoning_text' || (/reasoning/i.test(t) && t !== 'output_text')) {
          reasoningParts.push(txt);
        }
      }
      if (Array.isArray(part.content)) {
        part.content.forEach(walkPart);
      }
    }

    for (const block of parsed?.output || []) {
      walkPart(block);
    }

    return {
      outputText: outputParts.join('\n').trim(),
      reasoningText: reasoningParts.join('\n').trim(),
    };
  }

  function extractPennyFromPlanningBlob(blob) {
    const text = stripThinkSpans(String(blob || '').trim());
    if (!text) return '';
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const candidateLines = lines.filter((l) => {
      if (/^[\*\-â€¢]\s/.test(l)) return false;
      if (/^\d+\.(\s|$)/.test(l)) return false;
      if (/^\*?\s*(Character|Constraint|Goal|User Profile|Context|Personality):/i.test(l)) return false;
      if (l.length < 12) return false;
      return true;
    });
    if (!candidateLines.length) return '';
    const tail = candidateLines.slice(-4).join('\n');
    return tail.length >= 25 ? tail : '';
  }

  function extractPennyFromReasoning(reasoning) {
    const text = stripThinkSpans(String(reasoning || '').trim());
    if (!text) return '';
    if (ALLOW_RAW_REASONING_FALLBACK) return text;
    const moodIdx = text.lastIndexOf('[MOOD:');
    if (moodIdx !== -1) {
      const after = text.slice(moodIdx);
      const m = after.match(/^\[MOOD:\w+\]/);
      if (m) {
        let bodyStart = text.lastIndexOf('\n\n', moodIdx);
        bodyStart = bodyStart === -1 ? 0 : bodyStart + 2;
        const body = text.slice(bodyStart, moodIdx).trim();
        const mood = m[0];
        if (body.length >= 6) return `${body}\n${mood}`.trim();
        return mood;
      }
    }
    const paras = text.split(/\n{2,}/).map(par => par.trim()).filter(Boolean);
    for (let i = paras.length - 1; i >= 0; i -= 1) {
      const par = paras[i];
      if (par.length < 20) continue;
      if (isMetaThinkingLine(par.split('\n')[0] || '')) continue;
      return par;
    }
    return '';
  }

  function collectTextParts(value, bucket = 'visible', out = []) {
    if (value == null) return out;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach(item => collectTextParts(item, bucket, out));
      return out;
    }
    if (typeof value !== 'object') return out;

    const type = String(value.type || '').toLowerCase();
    const textValue = typeof value.text === 'string'
      ? value.text
      : typeof value.content === 'string'
        ? value.content
        : '';
    if (textValue) {
      const isReasoning = type.includes('reasoning');
      if ((bucket === 'reasoning' && isReasoning) || (bucket === 'visible' && !isReasoning)) {
        out.push(textValue);
      }
    }
    if (Array.isArray(value.content)) {
      value.content.forEach(item => collectTextParts(item, bucket, out));
    }
    if (Array.isArray(value.parts)) {
      value.parts.forEach(item => collectTextParts(item, bucket, out));
    }
    return out;
  }

  function textValueFromField(value, bucket = 'visible') {
    return collectTextParts(value, bucket, []).join('\n').trim();
  }

  function textFromChatMessage(msg) {
    if (!msg || typeof msg !== 'object') return '';
    const content = stripThinkSpans(repairCommonMojibake(textValueFromField(msg.content, 'visible') || String(msg.content ?? '').trim()));
    const reasoning = [
      repairCommonMojibake(textValueFromField(msg.reasoning_content, 'reasoning') || String(msg.reasoning_content ?? '').trim()),
      repairCommonMojibake(textValueFromField(msg.reasoning, 'reasoning') || String(msg.reasoning ?? '').trim()),
    ].filter(Boolean).join('\n').trim();
    let out = '';
    if (content) out = coercePennyVisibleReply(content);
    if (!out || looksOnlyLikeCoT(out)) {
      const fromR = extractPennyFromReasoning(reasoning);
      if (fromR) out = coercePennyVisibleReply(fromR);
    }
    if (!out && ALLOW_RAW_REASONING_FALLBACK && reasoning) {
      out = stripThinkSpans(reasoning);
    }
    return out || '';
  }

  function collectLmStudioStatefulChatStrings(parsed) {
    const outputParts = [];
    const reasoningParts = [];
    const top = typeof parsed?.output_text === 'string' ? parsed.output_text.trim() : '';
    if (top) outputParts.push(top);

    const blocks = Array.isArray(parsed?.output) ? parsed.output : [];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const type = String(block.type || '').toLowerCase();
      if (type === 'message') {
        const visible = textValueFromField(block.content, 'visible') || String(block.content ?? '').trim();
        if (visible) outputParts.push(visible);
        const reasoning = textValueFromField(block.content, 'reasoning');
        if (reasoning) reasoningParts.push(reasoning);
        continue;
      }
      const visible = textValueFromField(block.content ?? block.text ?? '', 'visible');
      if (visible && !type.includes('reasoning')) outputParts.push(visible);
      const reasoning = textValueFromField(block.content ?? block.text ?? '', 'reasoning');
      if (reasoning || type.includes('reasoning')) reasoningParts.push(reasoning || String(block.text || '').trim());
    }

    return {
      responseId: String(parsed?.response_id || parsed?.id || '').trim(),
      outputText: outputParts.join('\n').trim(),
      reasoningText: reasoningParts.join('\n').trim(),
    };
  }

  function isMissingLmStudioThreadError(error) {
    const message = String(error?.message || '');
    return /\b(previous_response_id|response(?:_id)? .*not found|unknown response|invalid response id|unknown conversation|conversation .*not found|expired)\b/i.test(message);
  }

  function lmStudioStageLabel(type = '') {
    switch (String(type || '')) {
      case 'model_load.start': return 'loading model';
      case 'model_load.end': return 'model ready';
      case 'prompt_processing.start': return 'reading thread';
      case 'prompt_processing.end': return 'prompt ready';
      case 'reasoning.start': return 'thinking';
      case 'message.start': return 'replying';
      case 'message.end': return 'reply ready';
      default: return '';
    }
  }

  return {
    stripThinkSpans,
    takeAfterLastHorizontalRule,
    extractTaggedVisibleReply,
    takeAfterFinalCue,
    stripWrappingCodeFence,
    stripReplyPrefix,
    normalizeMetaLead,
    isMetaThinkingLine,
    stripLeadingMetaLines,
    cleanDraftCandidate,
    collectDraftCandidates,
    collectQuotedReplyCandidates,
    paragraphLooksLikeCoT,
    looksOnlyLikeCoT,
    coercePennyVisibleReply,
    classifyVisibleReplyDecision,
    collectLmStudioResponsesStrings,
    extractPennyFromPlanningBlob,
    extractPennyFromReasoning,
    collectTextParts,
    textValueFromField,
    textFromChatMessage,
    collectLmStudioStatefulChatStrings,
    isMissingLmStudioThreadError,
    lmStudioStageLabel,
    repairCommonMojibake,
    VISIBLE_REPLY_REASON_CODES,
  };
}

module.exports = {
  createVisibleReplyApi,
  VISIBLE_REPLY_REASON_CODES,
};
