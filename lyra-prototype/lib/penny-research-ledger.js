const LEDGER_SCHEMA_VERSION = 1;
const LEDGER_PROMPT_TOPIC_LIMIT = 2;
const LEDGER_INSPECTOR_TOPIC_LIMIT = 8;
const LEDGER_EVIDENCE_LIMIT = 6;
const LEDGER_FOLLOW_UP_LIMIT = 4;
const LEDGER_CONTRADICTION_LIMIT = 4;
const LEDGER_SESSION_ID_LIMIT = 8;
const LEDGER_TURN_ID_LIMIT = 16;

const READ_ONLY_VERIFIED_TOOLS = new Set([
  'get_runtime_status',
  'list_project_files',
  'read_project_file',
  'read_project_file_around_match',
  'search_project_text',
  'get_git_status',
  'read_git_diff',
  'search_web',
  'read_web_page',
  'read_recent_logs',
  'run_node_check',
]);

const RESEARCH_CONTEXT_RE = /\b(research|investigat|inspect|check|verify|compare|artifact|qa|test|runtime|memory|tool|repo|file|branch|commit|diff|log|readme|package\.json)\b/i;
const OPEN_FOLLOW_UP_RE = /\b(need to check|needs to check|need to verify|needs to verify|would need to|follow up|follow-up|open question|not yet|unclear|unknown|worth checking|should verify|should check)\b/i;
const CAUSAL_CHAT_RE = /\b(flirty|kiss|cute|stay and talk|dangerous|banter|soft|softness|tease|mock me|be with me)\b/i;

function trimText(value = '', limit = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function trimIso(value = '', fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function tokenize(value = '') {
  return [...new Set(
    String(value || '')
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9._/#:-]{1,}/g) || [],
  )];
}

function appendUniqueStrings(items = [], values = [], limit = 8) {
  const seen = new Set();
  const output = [];
  for (const value of [...(Array.isArray(items) ? items : []), ...(Array.isArray(values) ? values : [])]) {
    const text = trimText(value || '', 220);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function slugify(value = '', fallback = 'topic') {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return text || fallback;
}

function defaultResearchLedgerStore() {
  return {
    meta: {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      updatedAt: '',
    },
    topics: {},
  };
}

function normalizeEvidenceRef(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = trimText(raw.type || '', 60) || 'evidence';
  const tool = trimText(raw.tool || '', 80);
  const ref = trimText(raw.ref || raw.target || raw.path || raw.url || raw.query || '', 220);
  const label = trimText(raw.label || '', 180);
  const note = trimText(raw.note || '', 220);
  const status = trimText(raw.status || '', 60) || 'verified';
  if (!ref && !label && !note) return null;
  return {
    type,
    tool,
    ref,
    label,
    note,
    status,
  };
}

function normalizeContradiction(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const conflictKey = trimText(raw.conflictKey || '', 120);
  const oldText = trimText(raw.oldText || '', 220);
  const newText = trimText(raw.newText || '', 220);
  if (!conflictKey && !oldText && !newText) return null;
  return {
    conflictKey,
    oldText,
    newText,
  };
}

function normalizeLedgerEntry(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const topicId = trimText(raw.topicId || '', 140);
  const topicLabel = trimText(raw.topicLabel || '', 180);
  if (!topicId || !topicLabel) return null;
  const status = ['open', 'provisional', 'settled'].includes(String(raw.status || '').trim())
    ? String(raw.status || '').trim()
    : 'provisional';
  return {
    topicId,
    topicLabel,
    question: trimText(raw.question || '', 260),
    status,
    conclusion: trimText(raw.conclusion || '', 320),
    evidenceRefs: (Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : [])
      .map(normalizeEvidenceRef)
      .filter(Boolean)
      .slice(0, LEDGER_EVIDENCE_LIMIT),
    openFollowUps: appendUniqueStrings([], raw.openFollowUps || [], LEDGER_FOLLOW_UP_LIMIT),
    contradictions: (Array.isArray(raw.contradictions) ? raw.contradictions : [])
      .map(normalizeContradiction)
      .filter(Boolean)
      .slice(0, LEDGER_CONTRADICTION_LIMIT),
    lastTouchedAt: trimIso(raw.lastTouchedAt, ''),
    sourceSessionIds: appendUniqueStrings([], raw.sourceSessionIds || [], LEDGER_SESSION_ID_LIMIT),
    sourceTurnIds: appendUniqueStrings([], raw.sourceTurnIds || [], LEDGER_TURN_ID_LIMIT),
    lane: trimText(raw.lane || '', 40),
    backend: trimText(raw.backend || '', 120),
  };
}

function createResearchLedgerApi({
  fs,
  path,
  LEDGER_FILE,
  nowMs = () => Date.now(),
} = {}) {
  if (!fs || typeof fs.readFileSync !== 'function') throw new TypeError('createResearchLedgerApi requires fs');
  if (!path || typeof path.resolve !== 'function') throw new TypeError('createResearchLedgerApi requires path');
  if (!LEDGER_FILE) throw new TypeError('createResearchLedgerApi requires LEDGER_FILE');

  function ensureLedgerFile() {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
    if (fs.existsSync(LEDGER_FILE)) return;
    fs.writeFileSync(LEDGER_FILE, `${JSON.stringify(defaultResearchLedgerStore(), null, 2)}\n`, 'utf8');
  }

  function readLedgerStore() {
    try {
      ensureLedgerFile();
      const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
      const parsed = raw ? JSON.parse(raw) : defaultResearchLedgerStore();
      const topics = {};
      for (const [key, value] of Object.entries(parsed?.topics || {})) {
        const topic = normalizeLedgerEntry({ ...value, topicId: value?.topicId || key });
        if (topic) topics[topic.topicId] = topic;
      }
      return {
        meta: {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          updatedAt: trimIso(parsed?.meta?.updatedAt, ''),
        },
        topics,
      };
    } catch {
      return defaultResearchLedgerStore();
    }
  }

  function writeLedgerStore(store = defaultResearchLedgerStore()) {
    ensureLedgerFile();
    const normalized = {
      meta: {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        updatedAt: new Date(nowMs()).toISOString(),
      },
      topics: {},
    };
    for (const [key, value] of Object.entries(store?.topics || {})) {
      const topic = normalizeLedgerEntry({ ...value, topicId: value?.topicId || key });
      if (topic) normalized.topics[topic.topicId] = topic;
    }
    fs.writeFileSync(LEDGER_FILE, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
  }

  function isVerifiedToolRecord(record = {}) {
    const name = String(record?.name || '').trim();
    return READ_ONLY_VERIFIED_TOOLS.has(name) && record?.result?.ok === true;
  }

  function buildEvidenceRefs(toolRecords = []) {
    const refs = [];
    for (const record of Array.isArray(toolRecords) ? toolRecords : []) {
      if (!isVerifiedToolRecord(record)) continue;
      const name = String(record?.name || '').trim();
      const data = record?.result?.data && typeof record.result.data === 'object' ? record.result.data : {};
      const pathRef = trimText(data.path || '', 220);
      const urlRef = trimText(data.url || data.requestedUrl || '', 220);
      const queryRef = trimText(data.query || record?.args?.query || '', 220);
      refs.push(normalizeEvidenceRef({
        type: pathRef ? 'project-path' : urlRef ? 'web-url' : queryRef ? 'query' : 'tool',
        tool: name,
        ref: pathRef || urlRef || queryRef,
        label: trimText(record?.result?.label || name, 180),
        note: trimText(data.textPreview || data.title || '', 220),
        status: 'verified',
      }));
      if (refs.length >= LEDGER_EVIDENCE_LIMIT) break;
    }
    return refs.filter(Boolean).slice(0, LEDGER_EVIDENCE_LIMIT);
  }

  function deriveTopicIdentity({ userText = '', evidenceRefs = [], contradictions = [] } = {}) {
    const contradiction = contradictions[0] || null;
    if (contradiction?.conflictKey) {
      return {
        topicId: `contradiction-${slugify(contradiction.conflictKey, 'contradiction')}`,
        topicLabel: contradiction.conflictKey,
      };
    }

    const primaryRef = evidenceRefs[0] || null;
    if (primaryRef?.type === 'project-path' && primaryRef.ref) {
      return {
        topicId: `path-${slugify(primaryRef.ref, 'path')}`,
        topicLabel: primaryRef.ref,
      };
    }
    if (primaryRef?.type === 'web-url' && primaryRef.ref) {
      return {
        topicId: `url-${slugify(primaryRef.ref, 'url')}`,
        topicLabel: primaryRef.ref,
      };
    }
    if (primaryRef?.ref) {
      return {
        topicId: `query-${slugify(primaryRef.ref, 'query')}`,
        topicLabel: primaryRef.ref,
      };
    }

    const fallback = trimText(userText, 120) || 'Research topic';
    return {
      topicId: `topic-${slugify(fallback, 'topic')}`,
      topicLabel: fallback,
    };
  }

  function buildOpenFollowUps({ userText = '', assistantText = '', contradictions = [] } = {}) {
    const cleanUserText = trimText(userText, 220);
    const cleanAssistantText = trimText(assistantText, 260);
    const followUps = [];
    if (OPEN_FOLLOW_UP_RE.test(cleanAssistantText) && cleanUserText) {
      followUps.push(cleanUserText);
    }
    if (contradictions.length && /not yet|still need|verify|check/i.test(cleanAssistantText) && cleanUserText) {
      followUps.push(cleanUserText);
    }
    return appendUniqueStrings([], followUps, LEDGER_FOLLOW_UP_LIMIT);
  }

  function determineStatus({ evidenceRefs = [], contradictions = [], openFollowUps = [] } = {}) {
    if (openFollowUps.length) return 'open';
    if (contradictions.length) return 'provisional';
    if (evidenceRefs.some((item) => item?.type === 'query')) return 'provisional';
    return evidenceRefs.length ? 'settled' : 'provisional';
  }

  function topicScore(topic = {}, sessionId = 'default', queryTokens = new Set()) {
    let score = 0;
    if (Array.isArray(topic.sourceSessionIds) && topic.sourceSessionIds.includes(sessionId)) score += 10;
    if (topic.status === 'open') score += 8;
    else if (topic.status === 'provisional') score += 4;
    else score += 1;
    const topicTokens = new Set([
      ...tokenize(topic.topicLabel),
      ...tokenize(topic.question),
      ...tokenize(topic.conclusion),
      ...tokenize((topic.openFollowUps || []).join(' ')),
    ]);
    for (const token of queryTokens) {
      if (topicTokens.has(token)) score += 3;
    }
    const touchedMs = Date.parse(topic.lastTouchedAt || '') || 0;
    if (touchedMs) {
      const ageDays = Math.max(0, nowMs() - touchedMs) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 3 - Math.min(3, ageDays / 3));
    }
    return score;
  }

  function summarizeTopicForPrompt(topic = {}) {
    const followUp = Array.isArray(topic.openFollowUps) && topic.openFollowUps.length
      ? topic.openFollowUps[0]
      : '';
    if (topic.status === 'open' && followUp) {
      return `open follow-up - ${followUp}`;
    }
    if (topic.conclusion) {
      return topic.conclusion;
    }
    if (topic.question) {
      return topic.question;
    }
    return topic.topicLabel;
  }

  function getPromptContext({
    sessionId = 'default',
    userText = '',
  } = {}) {
    const store = readLedgerStore();
    const queryTokens = new Set(tokenize(userText));
    const topics = Object.values(store.topics)
      .filter((topic) => {
        if (!normalizeLedgerEntry(topic)) return false;
        if (topic.status === 'open') return true;
        if (Array.isArray(topic.sourceSessionIds) && topic.sourceSessionIds.includes(sessionId)) return true;
        if (!queryTokens.size) return false;
        const haystack = `${topic.topicLabel} ${topic.question} ${topic.conclusion} ${(topic.openFollowUps || []).join(' ')}`;
        return tokenize(haystack).some((token) => queryTokens.has(token));
      })
      .sort((left, right) => topicScore(right, sessionId, queryTokens) - topicScore(left, sessionId, queryTokens))
      .slice(0, LEDGER_PROMPT_TOPIC_LIMIT)
      .map((topic) => ({
        topicId: topic.topicId,
        topicLabel: topic.topicLabel,
        status: topic.status,
        summary: summarizeTopicForPrompt(topic),
        openFollowUps: appendUniqueStrings([], topic.openFollowUps || [], 2),
        contradictions: (topic.contradictions || []).map(normalizeContradiction).filter(Boolean).slice(0, 2),
        evidenceRefs: (topic.evidenceRefs || []).map(normalizeEvidenceRef).filter(Boolean).slice(0, 3),
        lastTouchedAt: trimIso(topic.lastTouchedAt, ''),
        sourceSessionIds: appendUniqueStrings([], topic.sourceSessionIds || [], 4),
        sourceTurnIds: appendUniqueStrings([], topic.sourceTurnIds || [], 6),
      }));
    return {
      topics,
    };
  }

  function getResearchLedgerInspector({
    sessionId = 'default',
    userText = '',
  } = {}) {
    const store = readLedgerStore();
    const topics = Object.values(store.topics)
      .map(normalizeLedgerEntry)
      .filter(Boolean)
      .sort((left, right) => (Date.parse(right.lastTouchedAt || '') || 0) - (Date.parse(left.lastTouchedAt || '') || 0));
    return {
      meta: store.meta,
      topicCount: topics.length,
      openCount: topics.filter((item) => item.status === 'open').length,
      provisionalCount: topics.filter((item) => item.status === 'provisional').length,
      settledCount: topics.filter((item) => item.status === 'settled').length,
      context: getPromptContext({ sessionId, userText }),
      recentTopics: topics.slice(0, LEDGER_INSPECTOR_TOPIC_LIMIT),
      sessionTopics: topics.filter((item) => item.sourceSessionIds.includes(sessionId)).slice(0, LEDGER_INSPECTOR_TOPIC_LIMIT),
    };
  }

  function updateResearchLedgerFromTurn({
    sessionId = 'default',
    userText = '',
    assistantText = '',
    selectedLane = 'chat',
    backend = '',
    toolRecords = [],
    provenance = [],
  } = {}) {
    const cleanUserText = trimText(userText, 260);
    const cleanAssistantText = trimText(assistantText, 320);
    const contradictions = (Array.isArray(provenance) ? provenance : [])
      .map(normalizeContradiction)
      .filter(Boolean)
      .slice(0, LEDGER_CONTRADICTION_LIMIT);
    const evidenceRefs = buildEvidenceRefs(toolRecords);
    const openFollowUps = buildOpenFollowUps({
      userText: cleanUserText,
      assistantText: cleanAssistantText,
      contradictions,
    });
    const hasResearchContext = RESEARCH_CONTEXT_RE.test(`${cleanUserText} ${cleanAssistantText}`);
    const looksCasual = !evidenceRefs.length && CAUSAL_CHAT_RE.test(`${cleanUserText} ${cleanAssistantText}`);

    if (looksCasual) {
      return { updated: false, reason: 'casual-chat' };
    }
    if (!evidenceRefs.length && !contradictions.length && !(openFollowUps.length && hasResearchContext)) {
      return { updated: false, reason: 'non-qualifying-turn' };
    }

    const identity = deriveTopicIdentity({
      userText: cleanUserText,
      evidenceRefs,
      contradictions,
    });
    const store = readLedgerStore();
    const existing = normalizeLedgerEntry(store.topics?.[identity.topicId] || {});
    const lastTouchedAt = new Date(nowMs()).toISOString();
    const sourceTurnId = `${sessionId}:${nowMs()}`;
    const mergedOpenFollowUps = appendUniqueStrings(existing?.openFollowUps || [], openFollowUps, LEDGER_FOLLOW_UP_LIMIT);
    const mergedContradictions = [...(existing?.contradictions || []), ...contradictions]
      .map(normalizeContradiction)
      .filter(Boolean)
      .slice(-LEDGER_CONTRADICTION_LIMIT);
    const next = normalizeLedgerEntry({
      topicId: identity.topicId,
      topicLabel: identity.topicLabel,
      question: cleanUserText || existing?.question || identity.topicLabel,
      status: determineStatus({
        evidenceRefs: [...(existing?.evidenceRefs || []), ...evidenceRefs],
        contradictions: mergedContradictions,
        openFollowUps: mergedOpenFollowUps,
      }),
      conclusion: cleanAssistantText || existing?.conclusion || '',
      evidenceRefs: [
        ...(existing?.evidenceRefs || []),
        ...evidenceRefs,
      ],
      openFollowUps: mergedOpenFollowUps,
      contradictions: mergedContradictions,
      lastTouchedAt,
      sourceSessionIds: appendUniqueStrings(existing?.sourceSessionIds || [], [sessionId], LEDGER_SESSION_ID_LIMIT),
      sourceTurnIds: appendUniqueStrings(existing?.sourceTurnIds || [], [sourceTurnId], LEDGER_TURN_ID_LIMIT),
      lane: trimText(selectedLane || existing?.lane || '', 40),
      backend: trimText(backend || existing?.backend || '', 120),
    });
    if (!next) return { updated: false, reason: 'normalization-failed' };
    store.topics[next.topicId] = next;
    writeLedgerStore(store);
    return {
      updated: true,
      topic: next,
    };
  }

  function purgeResearchLedger({
    sessionId = 'default',
    clearSessionLedger = false,
    clearGlobalLedger = false,
  } = {}) {
    if (!clearSessionLedger && !clearGlobalLedger) {
      const store = readLedgerStore();
      return {
        clearedSessionTopics: 0,
        clearedGlobalTopics: 0,
        topicCount: Object.keys(store.topics || {}).length,
      };
    }
    if (clearGlobalLedger) {
      const existing = readLedgerStore();
      const removedCount = Object.keys(existing.topics || {}).length;
      const empty = writeLedgerStore(defaultResearchLedgerStore());
      return {
        clearedSessionTopics: 0,
        clearedGlobalTopics: removedCount,
        topicCount: 0,
      };
    }
    const store = readLedgerStore();
    let clearedSessionTopics = 0;
    for (const [topicId, topic] of Object.entries(store.topics || {})) {
      const normalized = normalizeLedgerEntry(topic);
      if (!normalized) {
        delete store.topics[topicId];
        continue;
      }
      if (!normalized.sourceSessionIds.includes(sessionId)) continue;
      clearedSessionTopics += 1;
      const sourceSessionIds = normalized.sourceSessionIds.filter((item) => item !== sessionId);
      const sourceTurnIds = normalized.sourceTurnIds.filter((item) => !item.startsWith(`${sessionId}:`));
      if (!sourceSessionIds.length) {
        delete store.topics[topicId];
        continue;
      }
      store.topics[topicId] = {
        ...normalized,
        sourceSessionIds,
        sourceTurnIds,
      };
    }
    const next = writeLedgerStore(store);
    return {
      clearedSessionTopics,
      clearedGlobalTopics: 0,
      topicCount: Object.keys(next.topics || {}).length,
    };
  }

  return {
    readLedgerStore,
    writeLedgerStore,
    getPromptContext,
    getResearchLedgerInspector,
    updateResearchLedgerFromTurn,
    purgeResearchLedger,
  };
}

module.exports = {
  LEDGER_SCHEMA_VERSION,
  LEDGER_PROMPT_TOPIC_LIMIT,
  createResearchLedgerApi,
};
