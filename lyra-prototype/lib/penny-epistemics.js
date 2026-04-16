const EPISTEMIC_STANCES = Object.freeze({
  ANSWER: 'answer',
  QUALIFY: 'qualify',
  CORRECT: 'correct',
  REFUSE: 'refuse',
});

function trimText(value = '', limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function normalizeNeedle(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values = [], limit = 8) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function mentionsText(haystack = '', needle = '') {
  const source = normalizeNeedle(haystack);
  const target = normalizeNeedle(needle);
  if (!source || !target) return false;
  return source.includes(target);
}

function normalizeEpistemicCaution(value = null) {
  const raw = value && typeof value === 'object' ? value : {};
  const enabled = raw.enabled === true;
  const signals = uniqueStrings(raw.signals || [], 6);
  const scope = String(raw.scope || '').trim() || 'none';
  const stance = Object.values(EPISTEMIC_STANCES).includes(String(raw.stance || '').trim())
    ? String(raw.stance || '').trim()
    : EPISTEMIC_STANCES.ANSWER;
  const note = trimText(raw.note || '', 220);
  return {
    enabled,
    triggered: enabled && (raw.triggered === true || signals.length > 0),
    scope,
    stance,
    signals,
    note,
  };
}

function stancePriority(stance = '') {
  switch (String(stance || '').trim()) {
    case EPISTEMIC_STANCES.REFUSE:
      return 4;
    case EPISTEMIC_STANCES.CORRECT:
      return 3;
    case EPISTEMIC_STANCES.QUALIFY:
      return 2;
    default:
      return 1;
  }
}

function mergeEpistemicCaution(base = null, next = null) {
  const left = normalizeEpistemicCaution(base);
  const right = normalizeEpistemicCaution(next);
  const enabled = left.enabled || right.enabled;
  const signals = uniqueStrings([...(left.signals || []), ...(right.signals || [])], 6);
  const leftStance = left.triggered ? left.stance : EPISTEMIC_STANCES.ANSWER;
  const rightStance = right.triggered ? right.stance : EPISTEMIC_STANCES.ANSWER;
  const stance = stancePriority(rightStance) >= stancePriority(leftStance) ? rightStance : leftStance;
  return {
    enabled,
    triggered: enabled && (left.triggered || right.triggered || signals.length > 0),
    scope: right.scope !== 'none' ? right.scope : left.scope,
    stance,
    signals,
    note: right.note || left.note,
  };
}

const STICKY_EPISTEMIC_SIGNALS = Object.freeze([
  'active_contradiction',
  'retrieval_fallback',
  'weak_memory_evidence',
]);

function buildPostToolEpistemicCaution({
  previous = null,
  enabled = false,
  userText = '',
  selectedLane = 'tool',
  retrieval = null,
  archiveContext = null,
  toolRecords = [],
} = {}) {
  const fresh = buildEpistemicCaution({
    enabled,
    userText,
    selectedLane,
    retrieval,
    archiveContext,
    toolRecords,
  });
  const prior = normalizeEpistemicCaution(previous);
  const stickySignals = (prior.signals || []).filter((signal) => STICKY_EPISTEMIC_SIGNALS.includes(signal));
  if (!stickySignals.length) return fresh;
  return mergeEpistemicCaution({
    ...prior,
    triggered: stickySignals.length > 0,
    signals: stickySignals,
    note: '',
  }, fresh);
}

function normalizeArchiveSynthesis(value = null) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    enabled: raw.enabled === true,
    generated: raw.enabled === true && raw.generated === true && !!trimText(raw.summary || '', 320),
    kind: trimText(raw.kind || '', 80),
    scope: trimText(raw.scope || '', 80),
    summary: trimText(raw.summary || '', 320),
    evidenceSources: uniqueStrings(raw.evidenceSources || [], 6),
  };
}

function isQuestionLike(text = '') {
  return /\?/.test(String(text || '')) || /\b(what|which|who|where|when|why|how|did|do|does|is|are|was|were|tell me|remind me|check|verify|confirm)\b/i.test(String(text || ''));
}

function looksMemoryHeavy(text = '') {
  return /\b(remember|recall|earlier|before|favorite|correct|actually|again|what was|what did|what do i|what did i|still|now)\b/i.test(String(text || ''));
}

function looksToolClaimHeavy(text = '') {
  return /\b(you already|you did|you changed|you edited|you fixed|you verified|you checked|you inspected|you read|you looked|confirm you|say that you)\b/i.test(String(text || ''));
}

function looksRepoFactHeavy(text = '') {
  return /\b(readme(?:\.md)?|package\.json|server\.js|codebase\.md|architecture\.md|repo(?:sitory)?|exact line|which line|what line|line \d+)\b/i.test(String(text || ''));
}

function buildEpistemicCaution({
  enabled = false,
  userText = '',
  selectedLane = 'chat',
  retrieval = null,
  archiveContext = null,
  toolRecords = [],
} = {}) {
  if (!enabled) return normalizeEpistemicCaution({ enabled: false });

  const memoryHeavy = isQuestionLike(userText) && looksMemoryHeavy(userText);
  const toolHeavy = String(selectedLane || '').trim() === 'tool'
    || (Array.isArray(toolRecords) && toolRecords.length > 0)
    || looksToolClaimHeavy(userText);
  const repoHeavy = isQuestionLike(userText) && looksRepoFactHeavy(userText);
  const contradictions = Array.isArray(archiveContext?.activeContradictions)
    ? archiveContext.activeContradictions
    : [];
  const contradictionTouched = contradictions.some((item) => (
    mentionsText(userText, item?.oldText || '')
    || mentionsText(userText, item?.newText || '')
    || mentionsText(userText, item?.conflictKey || '')
  ));
  const retrievalMode = String(retrieval?.mode || archiveContext?.mode || '').trim();
  const retrievalFallback = retrievalMode === 'keyword'
    || String(retrieval?.reasonCode || archiveContext?.reasonCode || '').trim() === 'keyword_fallback'
    || retrieval?.compression?.used === true
    || archiveContext?.compression?.used === true;
  const sessionHits = Array.isArray(retrieval?.session) ? retrieval.session.length : (Array.isArray(archiveContext?.session) ? archiveContext.session.length : 0);
  const globalHits = Array.isArray(retrieval?.global) ? retrieval.global.length : (Array.isArray(archiveContext?.global) ? archiveContext.global.length : 0);
  const weakMemoryEvidence = memoryHeavy && retrievalFallback && (sessionHits + globalHits) < 1;
  const verifiedToolCount = Array.isArray(toolRecords)
    ? toolRecords.filter((item) => item?.result?.ok === true).length
    : 0;
  const missingToolEvidence = toolHeavy && looksToolClaimHeavy(userText) && verifiedToolCount < 1;
  const missingRepoEvidence = repoHeavy && verifiedToolCount < 1;

  const signals = [];
  if (contradictionTouched) signals.push('active_contradiction');
  if (memoryHeavy && retrievalFallback) signals.push('retrieval_fallback');
  if (weakMemoryEvidence) signals.push('weak_memory_evidence');
  if (missingToolEvidence) signals.push('missing_tool_evidence');
  if (missingRepoEvidence) signals.push('missing_repo_evidence');

  let stance = EPISTEMIC_STANCES.ANSWER;
  if (signals.includes('missing_tool_evidence')) {
    stance = EPISTEMIC_STANCES.REFUSE;
  } else if (signals.includes('active_contradiction')) {
    stance = EPISTEMIC_STANCES.CORRECT;
  } else if (signals.includes('retrieval_fallback') || signals.includes('weak_memory_evidence') || signals.includes('missing_repo_evidence')) {
    stance = EPISTEMIC_STANCES.QUALIFY;
  }

  const note = signals.includes('missing_tool_evidence')
    ? 'Tool-backed claims need verified evidence before Penny presents them as done.'
    : signals.includes('active_contradiction')
      ? 'A tracked contradiction touches this recall, so Penny should correct stale premises instead of complying.'
      : signals.includes('missing_repo_evidence')
        ? 'Current repo and file claims should stay qualified until Penny has verified them with tools.'
      : signals.includes('retrieval_fallback') || signals.includes('weak_memory_evidence')
        ? 'Archive evidence is weaker than usual here, so Penny should qualify instead of guessing.'
        : '';

  return normalizeEpistemicCaution({
    enabled: true,
    triggered: signals.length > 0,
    scope: toolHeavy ? 'tool' : (memoryHeavy ? 'memory' : (repoHeavy ? 'repo' : 'none')),
    stance,
    signals,
    note,
  });
}

function buildArchiveSynthesis({
  enabled = false,
  userText = '',
  selectedLane = 'chat',
  retrieval = null,
  archiveContext = null,
} = {}) {
  if (!enabled) return normalizeArchiveSynthesis({ enabled: false });
  if (String(selectedLane || '').trim() !== 'chat') return normalizeArchiveSynthesis({ enabled: true, generated: false });

  const session = Array.isArray(archiveContext?.session) ? archiveContext.session : [];
  const global = Array.isArray(archiveContext?.global) ? archiveContext.global : [];
  const contradictions = Array.isArray(archiveContext?.activeContradictions) ? archiveContext.activeContradictions : [];
  const compression = retrieval?.compression || archiveContext?.compression || {};
  const recallish = isQuestionLike(userText) && (
    looksMemoryHeavy(userText)
    || contradictions.length > 0
    || session.length > 0
    || (global.length > 0 && looksMemoryHeavy(userText))
  );
  if (!recallish) return normalizeArchiveSynthesis({ enabled: true, generated: false });

  const parts = [];
  const evidenceSources = [];
  if (contradictions.length) {
    const item = contradictions[0];
    parts.push(`Correction in play: ${trimText(item?.newText || '', 120)} replaces ${trimText(item?.oldText || '', 80)}.`);
    evidenceSources.push('correction');
  }
  if (session.length) {
    parts.push(`Session thread: ${trimText(session[0]?.text || '', 120)}.`);
    evidenceSources.push(String(session[0]?.sourceLabel || 'archive-session').trim() || 'archive-session');
  }
  if (global.length) {
    parts.push(`Longer pattern: ${trimText(global[0]?.text || '', 120)}.`);
    evidenceSources.push(String(global[0]?.sourceLabel || 'archive-global').trim() || 'archive-global');
  }
  if (!parts.length && compression?.used === true && Array.isArray(compression.chapters) && compression.chapters.length) {
    parts.push(`Compressed archive cue: ${trimText(compression.chapters[0]?.text || '', 120)}.`);
    evidenceSources.push(String(compression.chapters[0]?.sourceType || 'chapter').trim() || 'chapter');
  }

  const summary = trimText(parts.slice(0, 3).join(' '), 320);
  return normalizeArchiveSynthesis({
    enabled: true,
    generated: !!summary,
    kind: 'archive-advisory-summary',
    scope: 'archive-advisory',
    summary,
    evidenceSources,
  });
}

function buildEpistemicPromptBlock(caution = null) {
  const normalized = normalizeEpistemicCaution(caution);
  if (!normalized.enabled || !normalized.triggered) return '';
  const lines = [
    'Epistemic caution (experimental) is active for this turn.',
    `- Preferred stance: ${normalized.stance}.`,
  ];
  if (normalized.signals.includes('active_contradiction')) {
    lines.push('- A tracked correction touches this topic. Correct stale premises instead of playing along.');
  }
  if (normalized.signals.includes('retrieval_fallback') || normalized.signals.includes('weak_memory_evidence')) {
    lines.push('- Memory evidence is weaker or fallback-only. Qualify instead of guessing.');
  }
  if (normalized.signals.includes('missing_repo_evidence')) {
    lines.push('- Repo and file claims are unverified right now. Do not invent exact lines, edits, or confirmations.');
  }
  if (normalized.signals.includes('missing_tool_evidence')) {
    lines.push('- Do not claim an edit, check, or verification happened without verified tool evidence.');
  }
  lines.push('- Keep the reply compact and still sound like Penny. Do not flatten into generic hedging.');
  return lines.join('\n');
}

module.exports = {
  EPISTEMIC_STANCES,
  normalizeEpistemicCaution,
  mergeEpistemicCaution,
  buildPostToolEpistemicCaution,
  normalizeArchiveSynthesis,
  buildEpistemicCaution,
  buildArchiveSynthesis,
  buildEpistemicPromptBlock,
};
