function createReplyGuardApi({
  stripReplyMoodTags,
  enableContradictionGuards = true,
} = {}) {
  if (typeof stripReplyMoodTags !== 'function') {
    throw new TypeError('createReplyGuardApi requires stripReplyMoodTags');
  }

  function countGuardWords(text = '') {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function candidateTextHasConcreteAnchor(text = '') {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    return /(?:^|\n)\s*(?:https?:\/\/|www\.)/i.test(stripped)
      || /\b[A-Za-z0-9_.\/-]+\.(?:js|mjs|json|md|txt|html|css)(?::\d+)?\b/.test(stripped);
  }

  function looksLikePreambleOnlyReply(text = '') {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    if (!stripped) return true;
    const normalized = stripped.replace(/\s+/g, ' ').trim().toLowerCase();
    if (countGuardWords(normalized) > 24) return false;
    return /(?:^|\b)(?:here(?:'s| is)\s+(?:the\s+)?(?:breakdown|dirt|takeaway|short version)|i ran the gauntlet|i dug through|i mapped the connections|i checked the page|found it)\b/.test(normalized)
      && !/(?:^|\n)\s*(?:[-*]|\d+\.)\s+\S/.test(stripped)
      && !candidateTextHasConcreteAnchor(stripped);
  }

  function candidateHasUnbalancedInlineMarkers(text = '') {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    if (!stripped) return false;
    if (((stripped.match(/`/g) || []).length % 2) === 1) return true;
    if (((stripped.match(/"/g) || []).length % 2) === 1 && countGuardWords(stripped) < 80) return true;
    return /[`:,([{-]\s*$/.test(stripped);
  }

  function userRequestedStructuredReply(userText = '') {
    return /\b(?:bullet|bullets|list|breakdown|sections?|step-by-step|step by step)\b/i.test(String(userText || ''));
  }

  function candidateHasStructuredReply(text = '') {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    return /(?:^|\n)\s*(?:[-*]|\d+\.)\s+\S/.test(stripped)
      || /(?:^|\n)\s*[A-Z][A-Za-z0-9 /_-]{2,48}:\s+\S/.test(stripped);
  }

  function candidateHasConcreteToolAnchor(text = '', toolRecords = []) {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    if (candidateTextHasConcreteAnchor(stripped)) return true;
    const records = Array.isArray(toolRecords) ? toolRecords : [];
    return records.some((record) => {
      const args = record?.args && typeof record.args === 'object' ? record.args : {};
      const data = record?.result?.data && typeof record.result.data === 'object' ? record.result.data : {};
      const targets = [
        args.path,
        args.query,
        args.url,
        data.path,
        data.url,
        data.requestedUrl,
        data.query,
      ].map((value) => String(value || '').trim()).filter((value) => value.length >= 4);
      return targets.some((target) => stripped.includes(target));
    });
  }

  function collectReplyGuardCodes({
    candidate = '',
    activeContradictions = [],
    userText = '',
    toolRecords = [],
  } = {}) {
    const text = String(candidate || '').trim();
    const bare = stripReplyMoodTags(text).trim();
    const wordCount = countGuardWords(bare);
    const recordCount = Array.isArray(toolRecords) ? toolRecords.length : 0;
    const codes = [];
    if (!text || text.length < 4) codes.push('empty_visible_reply');
    if (/\b(?:todo|tbd|placeholder|insert .* here|coming soon)\b/i.test(text)) codes.push('placeholder_visible_reply');
    if (/\.\.\.$/.test(text) && text.split(/\s+/).length < 10) codes.push('clipped_visible_reply');
    if (candidateHasUnbalancedInlineMarkers(text)) codes.push('clipped_visible_reply');
    if (looksLikePreambleOnlyReply(text)) codes.push('preamble_only_visible_reply');
    if (userRequestedStructuredReply(userText) && wordCount < 80 && !candidateHasStructuredReply(text)) {
      codes.push('requested_structure_missing');
    }
    if (recordCount >= 2 && wordCount < 48 && !candidateHasConcreteToolAnchor(text, toolRecords)) {
      codes.push('tool_summary_too_thin');
    }
    if (enableContradictionGuards) {
      for (const contradiction of activeContradictions) {
        if (textMentionsFact(text, contradiction.oldText) && !textMentionsFact(text, contradiction.newText)) {
          codes.push('contradiction_stale_value');
          break;
        }
      }
    }
    return [...new Set(codes)];
  }

  function normalizeGuardText(text = '') {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function textMentionsFact(text = '', fact = '') {
    const needle = normalizeGuardText(fact);
    if (!needle) return false;
    return normalizeGuardText(text).includes(needle);
  }

  function candidateBlockLooksClipped(text = '') {
    const stripped = stripReplyMoodTags(String(text || '')).trim();
    if (!stripped) return false;
    return candidateHasUnbalancedInlineMarkers(stripped)
      || /(?:\bregex\s+`?\/|`\/|\(\s*$|\[\s*$|\{\s*$)/i.test(stripped);
  }

  function salvageClippedVisibleReply(text = '') {
    const source = String(text || '').trim();
    if (!source || !candidateBlockLooksClipped(source)) return '';
    const moodMatch = source.match(/\s*(\[MOOD:\w+\])\s*$/i);
    const moodTag = moodMatch ? moodMatch[1] : '';
    let body = moodMatch ? source.slice(0, moodMatch.index).trim() : source;
    if (!body) return '';
    const paragraphs = body.split(/\n{2,}/);
    while (paragraphs.length > 1 && candidateBlockLooksClipped(paragraphs[paragraphs.length - 1])) {
      paragraphs.pop();
    }
    body = paragraphs.join('\n\n').trim();
    if (candidateBlockLooksClipped(body)) {
      const lines = body.split(/\r?\n/);
      while (lines.length > 1 && candidateBlockLooksClipped(lines[lines.length - 1])) {
        lines.pop();
      }
      body = lines.join('\n').trim();
    }
    if (!body || candidateBlockLooksClipped(body) || body.length < 40) return '';
    return `${body}${moodTag ? `\n${moodTag}` : ''}`.trim();
  }

  function buildSemanticRepairInstructions({ guardCodes = [], activeContradictions = [] } = {}) {
    const lines = [];
    if (guardCodes.includes('empty_visible_reply') || guardCodes.includes('placeholder_visible_reply') || guardCodes.includes('clipped_visible_reply')) {
      lines.push('- Return one complete visible reply. No placeholders, clipped fragments, dangling quotes, dangling backticks, or TODO language.');
    }
    if (guardCodes.includes('preamble_only_visible_reply') || guardCodes.includes('tool_summary_too_thin')) {
      lines.push('- Do not return a setup sentence by itself. Include concrete facts from the verified tool trail, with real file paths, URLs, symbols, line numbers, or outcomes when they are present.');
    }
    if (guardCodes.includes('requested_structure_missing')) {
      lines.push('- The user asked for a structured answer. Use bullets or short labeled sections instead of a single preamble paragraph.');
    }
    if (guardCodes.includes('contradiction_stale_value')) {
      lines.push('- Do not restate superseded facts as current truth.');
      for (const contradiction of activeContradictions.slice(0, 2)) {
        lines.push(`- If that fact is relevant, treat "${contradiction.newText}" as current and "${contradiction.oldText}" as replaced.`);
      }
    }
    return lines.join('\n');
  }

  return {
    collectReplyGuardCodes,
    salvageClippedVisibleReply,
    buildSemanticRepairInstructions,
  };
}

module.exports = {
  createReplyGuardApi,
};
