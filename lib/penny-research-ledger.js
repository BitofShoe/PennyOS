const crypto = require('node:crypto');
const { writeJsonFileAtomicSync } = require('./penny-atomic-json');

const LEDGER_SCHEMA_VERSION = 3;
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
const RESEARCH_SHAPED_WRITE_RE = /\b(research|investigat|inspect|check|verify|compare|artifact|qa|test|runtime|memory|bug|issue|error|regression|debug|diagnos|broken|failing|failure|audit|prove)\b/i;
const OPEN_FOLLOW_UP_RE = /\b(need to check|needs to check|need to verify|needs to verify|would need to|follow up|follow-up|open question|not yet|unclear|unknown|worth checking|should verify|should check)\b/i;
const CAUSAL_CHAT_RE = /\b(flirty|kiss|cute|stay and talk|dangerous|banter|soft|softness|tease|mock me|be with me)\b/i;
const GENERIC_PROMPT_QUERY_TOKENS = new Set([
  'again',
  'artifact',
  'artifacts',
  'branch',
  'check',
  'claim',
  'claims',
  'commit',
  'compare',
  'diff',
  'earlier',
  'exact',
  'file',
  'files',
  'follow',
  'follow-up',
  'have',
  'investigation',
  'investigations',
  'investigate',
  'left',
  'line',
  'lines',
  'log',
  'memory',
  'next',
  'open',
  'prove',
  'proves',
  'proof',
  'qa',
  'question',
  'questions',
  'repo',
  'research',
  'runtime',
  'should',
  'still',
  'test',
  'tests',
  'thing',
  'thread',
  'threads',
  'tool',
  'tools',
  'unresolved',
  'verify',
  'what',
  'where',
  'work',
]);
const GENERIC_SCOPE_TOKENS = new Set([
  ...GENERIC_PROMPT_QUERY_TOKENS,
  'a',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'can',
  'did',
  'does',
  'exactly',
  'for',
  'give',
  'i',
  'if',
  'is',
  'in',
  'into',
  'it',
  'its',
  'me',
  'my',
  'now',
  'of',
  'on',
  'or',
  'please',
  'prove',
  'proving',
  'show',
  'since',
  'the',
  'tell',
  'to',
  'us',
  'verify',
  'was',
  'we',
  'you',
]);
const LEDGER_IDENTITY_KINDS = new Set([
  'anchored-question',
  'contradiction',
]);
const LEDGER_SOURCE_CLASSES = new Set([
  'verified-evidence',
  'question-followup',
  'contradiction',
]);
const LEDGER_SUMMARY_CLASSES = new Set([
  'evidence-tight',
  'question-carryover',
  'contradiction-provenance',
]);

function stableIdentityHash(value = '') {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex').slice(0, 10);
}

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

function buildMeaningfulPromptQueryTokens(userText = '') {
  return new Set(
    tokenize(userText).filter((token) => !GENERIC_PROMPT_QUERY_TOKENS.has(token)),
  );
}

function buildTopicPromptTokens(topic = {}) {
  const anchorTokens = tokenize([
    topic?.identity?.anchorRef || topic.topicLabel || '',
    ...(Array.isArray(topic.evidenceRefs)
      ? topic.evidenceRefs.map((item) => `${item?.ref || ''} ${item?.label || ''}`)
      : []),
  ].join(' '));
  return new Set(buildScopeTokens([
    topic?.identity?.scopeLabel || '',
    topic.question,
    (topic.openFollowUps || []).join(' '),
  ].join(' '), anchorTokens));
}

function buildTopicAnchorTokens(topic = {}) {
  const evidenceRefs = Array.isArray(topic.evidenceRefs) ? topic.evidenceRefs : [];
  return new Set([
    ...tokenize(topic?.identity?.anchorRef || topic.topicLabel),
    ...evidenceRefs.flatMap((item) => tokenize(`${item?.ref || ''} ${item?.label || ''}`)),
  ]);
}

function countTokenOverlap(queryTokens = new Set(), topicTokens = new Set()) {
  let overlap = 0;
  for (const token of queryTokens) {
    if (topicTokens.has(token)) overlap += 1;
  }
  return overlap;
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

function normalizeAnchorType(value = '', fallback = 'query') {
  const text = String(value || '').trim();
  if (['project-path', 'web-url', 'query', 'contradiction'].includes(text)) return text;
  return fallback;
}

function normalizeLedgerSourceClass(value = '', fallback = 'question-followup') {
  const text = String(value || '').trim();
  if (LEDGER_SOURCE_CLASSES.has(text)) return text;
  return fallback;
}

function normalizeLedgerSummaryClass(value = '', fallback = 'question-carryover') {
  const text = String(value || '').trim();
  if (LEDGER_SUMMARY_CLASSES.has(text)) return text;
  return fallback;
}

function normalizeSummaryEvidenceRefs(values = [], limit = 3) {
  return (Array.isArray(values) ? values : [])
    .map(normalizeEvidenceRef)
    .filter(Boolean)
    .slice(0, Math.max(1, Number(limit || 0) || 3));
}

function verifiedEvidenceRefs(evidenceRefs = []) {
  return (Array.isArray(evidenceRefs) ? evidenceRefs : [])
    .map(normalizeEvidenceRef)
    .filter(Boolean)
    .filter((item) => String(item?.status || '').trim().toLowerCase() === 'verified')
    .filter((item) => String(item?.type || '').trim().toLowerCase() !== 'query');
}

function buildContradictionSummary(contradictions = []) {
  const items = (Array.isArray(contradictions) ? contradictions : [])
    .map(normalizeContradiction)
    .filter(Boolean);
  const latest = items.length ? items[items.length - 1] : null;
  if (!latest) return '';
  const newText = trimText(latest.newText || '', 220);
  const oldText = trimText(latest.oldText || '', 220);
  const conflictKey = trimText(latest.conflictKey || '', 120);
  if (newText && oldText) return trimText(`correction: ${newText} (replaces: ${oldText})`, 320);
  if (newText) return trimText(`correction: ${newText}`, 320);
  if (oldText) return trimText(`correction replaces: ${oldText}`, 320);
  if (conflictKey) return trimText(`correction tracked for ${conflictKey}`, 320);
  return '';
}

function buildEvidenceTightSummary(evidenceRefs = []) {
  const verified = verifiedEvidenceRefs(evidenceRefs).slice().reverse();
  for (const item of verified) {
    const ref = trimText(item.ref || '', 140);
    const label = trimText(item.label || '', 140);
    const note = trimText(item.note || '', 220);
    if (note && ref) {
      return {
        conclusion: trimText(`verified in ${ref}: ${note}`, 320),
        summaryEvidenceRefs: [item],
      };
    }
    if (note && label) {
      return {
        conclusion: trimText(`verified via ${label}: ${note}`, 320),
        summaryEvidenceRefs: [item],
      };
    }
    if (note) {
      return {
        conclusion: trimText(`verified evidence: ${note}`, 320),
        summaryEvidenceRefs: [item],
      };
    }
    if (ref && label && ref.toLowerCase() !== label.toLowerCase()) {
      return {
        conclusion: trimText(`verified via ${label} (${ref})`, 320),
        summaryEvidenceRefs: [item],
      };
    }
    if (ref) {
      return {
        conclusion: trimText(`verified in ${ref}`, 320),
        summaryEvidenceRefs: [item],
      };
    }
  }
  return {
    conclusion: '',
    summaryEvidenceRefs: [],
  };
}

function deriveLedgerTruthSummary({
  raw = null,
  evidenceRefs = [],
  contradictions = [],
} = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const normalizedContradictions = (Array.isArray(contradictions) ? contradictions : [])
    .map(normalizeContradiction)
    .filter(Boolean);
  if (normalizedContradictions.length) {
    return {
      sourceClass: 'contradiction',
      summaryClass: 'contradiction-provenance',
      summaryEvidenceRefs: [],
      conclusion: buildContradictionSummary(normalizedContradictions),
    };
  }
  const evidenceTight = buildEvidenceTightSummary(evidenceRefs);
  if (evidenceTight.conclusion) {
    return {
      sourceClass: 'verified-evidence',
      summaryClass: 'evidence-tight',
      summaryEvidenceRefs: normalizeSummaryEvidenceRefs(evidenceTight.summaryEvidenceRefs, 3),
      conclusion: evidenceTight.conclusion,
    };
  }
  if (verifiedEvidenceRefs(evidenceRefs).length) {
    return {
      sourceClass: 'verified-evidence',
      summaryClass: 'question-carryover',
      summaryEvidenceRefs: [],
      conclusion: '',
    };
  }
  const preservedSummaryClass = normalizeLedgerSummaryClass(value.summaryClass, '');
  const preservedSourceClass = normalizeLedgerSourceClass(value.sourceClass, '');
  const preservedSummaryEvidenceRefs = normalizeSummaryEvidenceRefs(value.summaryEvidenceRefs, 3);
  const preservedConclusion = trimText(value.conclusion || '', 320);
  if (preservedSummaryClass === 'evidence-tight' && preservedConclusion && preservedSummaryEvidenceRefs.length) {
    return {
      sourceClass: preservedSourceClass || 'verified-evidence',
      summaryClass: 'evidence-tight',
      summaryEvidenceRefs: preservedSummaryEvidenceRefs,
      conclusion: preservedConclusion,
    };
  }
  return {
    sourceClass: 'question-followup',
    summaryClass: 'question-carryover',
    summaryEvidenceRefs: [],
    conclusion: '',
  };
}

function determineLedgerStatus({
  evidenceRefs = [],
  contradictions = [],
  openFollowUps = [],
  summaryClass = '',
} = {}) {
  if (openFollowUps.length) return 'open';
  if (contradictions.length) return 'provisional';
  if (!verifiedEvidenceRefs(evidenceRefs).length) return 'provisional';
  return normalizeLedgerSummaryClass(summaryClass, '') === 'evidence-tight'
    ? 'settled'
    : 'provisional';
}

function buildScopeTokens(userText = '', anchorTokens = []) {
  const anchor = new Set(Array.isArray(anchorTokens) ? anchorTokens : []);
  const ordered = tokenize(userText);
  const scopeTokens = [];
  const seen = new Set();
  for (const token of ordered) {
    if (!token || anchor.has(token) || GENERIC_SCOPE_TOKENS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    scopeTokens.push(token);
    if (scopeTokens.length >= 8) break;
  }
  return scopeTokens;
}

function buildScopeSummary(userText = '', anchorTokens = []) {
  const scopeTokens = buildScopeTokens(userText, anchorTokens);
  if (scopeTokens.length) {
    return {
      scopeKey: [...scopeTokens].sort().join(' '),
      scopeLabel: scopeTokens.slice(0, 6).join(' '),
    };
  }
  return {
    scopeKey: 'general',
    scopeLabel: 'general follow-up',
  };
}

function inferLegacyAnchorType({ topicId = '', evidenceRefs = [] } = {}) {
  const primaryRef = Array.isArray(evidenceRefs) ? evidenceRefs.find((item) => item?.ref) : null;
  if (primaryRef?.type) return normalizeAnchorType(primaryRef.type);
  const normalizedTopicId = String(topicId || '').trim().toLowerCase();
  if (normalizedTopicId.startsWith('path-')) return 'project-path';
  if (normalizedTopicId.startsWith('url-')) return 'web-url';
  if (normalizedTopicId.startsWith('contradiction-')) return 'contradiction';
  return 'query';
}

function buildLedgerIdentity({
  userText = '',
  topicId = '',
  topicLabel = '',
  evidenceRefs = [],
  contradictions = [],
  rawIdentity = null,
} = {}) {
  const contradiction = Array.isArray(contradictions)
    ? contradictions.find((item) => item?.conflictKey || item?.newText || item?.oldText)
    : null;
  const primaryRef = Array.isArray(evidenceRefs)
    ? evidenceRefs.find((item) => ['project-path', 'web-url', 'query'].includes(String(item?.type || '').trim()) && item?.ref)
      || evidenceRefs.find((item) => item?.ref)
    : null;
  const requestedKind = String(rawIdentity?.kind || '').trim();
  const kind = contradiction?.conflictKey || requestedKind === 'contradiction' || String(topicId || '').startsWith('contradiction-')
    ? 'contradiction'
    : (LEDGER_IDENTITY_KINDS.has(requestedKind) ? requestedKind : 'anchored-question');

  if (kind === 'contradiction') {
    const contradictionLabel = trimText(
      rawIdentity?.scopeLabel
      || rawIdentity?.anchorRef
      || contradiction?.conflictKey
      || topicLabel
      || userText,
      180,
    ) || 'contradiction';
    return {
      kind: 'contradiction',
      anchorType: 'contradiction',
      anchorRef: trimText(rawIdentity?.anchorRef || contradiction?.conflictKey || contradictionLabel, 220) || contradictionLabel,
      scopeKey: trimText(rawIdentity?.scopeKey || contradiction?.conflictKey || contradictionLabel, 180).toLowerCase() || 'contradiction',
      scopeLabel: contradictionLabel,
    };
  }

  const anchorType = normalizeAnchorType(
    rawIdentity?.anchorType || inferLegacyAnchorType({ topicId, evidenceRefs }),
    primaryRef?.type || 'query',
  );
  const anchorRef = trimText(
    rawIdentity?.anchorRef
    || primaryRef?.ref
    || topicLabel
    || userText,
    220,
  ) || 'Research topic';
  const anchorTokens = tokenize(`${anchorRef} ${primaryRef?.label || ''}`);
  const scopeSummary = buildScopeSummary(
    rawIdentity?.scopeLabel
    || rawIdentity?.scopeKey
    || userText
    || topicLabel,
    anchorTokens,
  );
  return {
    kind: 'anchored-question',
    anchorType,
    anchorRef,
    scopeKey: trimText(rawIdentity?.scopeKey || scopeSummary.scopeKey, 180).toLowerCase() || 'general',
    scopeLabel: trimText(rawIdentity?.scopeLabel || scopeSummary.scopeLabel, 180) || 'general follow-up',
  };
}

function buildLedgerTopicId(identity = {}) {
  if (identity?.kind === 'contradiction') {
    return `contradiction-${slugify(identity.scopeKey || identity.scopeLabel || identity.anchorRef, 'contradiction')}`;
  }
  const prefix = identity?.anchorType === 'project-path'
    ? 'path'
    : (identity?.anchorType === 'web-url' ? 'url' : 'query');
  const anchorSlug = slugify(identity?.anchorRef || identity?.scopeLabel || 'topic', 'topic');
  if (String(identity?.scopeKey || '').trim().toLowerCase() === 'general') {
    return `${prefix}-${anchorSlug}`;
  }
  const scopeSlug = slugify(identity?.scopeKey || identity?.scopeLabel || 'scope', 'scope').slice(0, 42);
  const scopeHash = stableIdentityHash([
    identity?.kind || '',
    identity?.anchorType || '',
    identity?.anchorRef || '',
    identity?.scopeKey || '',
  ].join('|'));
  return `${prefix}-${anchorSlug}-${scopeSlug}-${scopeHash}`;
}

function buildLedgerTopicLabel(identity = {}) {
  if (identity?.kind === 'contradiction') {
    return trimText(identity.scopeLabel || identity.anchorRef || 'contradiction', 180);
  }
  const anchorRef = trimText(identity?.anchorRef || '', 120);
  const scopeLabel = trimText(identity?.scopeLabel || '', 80);
  if (!scopeLabel || scopeLabel === 'general follow-up' || scopeLabel.toLowerCase() === anchorRef.toLowerCase()) {
    return anchorRef || scopeLabel || 'Research topic';
  }
  return trimText(`${anchorRef} - ${scopeLabel}`, 180);
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
  const evidenceRefs = (Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : [])
    .map(normalizeEvidenceRef)
    .filter(Boolean)
    .slice(0, LEDGER_EVIDENCE_LIMIT);
  const contradictions = (Array.isArray(raw.contradictions) ? raw.contradictions : [])
    .map(normalizeContradiction)
    .filter(Boolean)
    .slice(0, LEDGER_CONTRADICTION_LIMIT);
  const question = trimText(raw.question || '', 260);
  const openFollowUps = appendUniqueStrings([], raw.openFollowUps || [], LEDGER_FOLLOW_UP_LIMIT);
  const identity = buildLedgerIdentity({
    userText: question,
    topicId: trimText(raw.topicId || '', 140),
    topicLabel: trimText(raw.topicLabel || '', 180),
    evidenceRefs,
    contradictions,
    rawIdentity: raw.identity,
  });
  const topicId = buildLedgerTopicId(identity);
  const topicLabel = trimText(raw.topicLabel || buildLedgerTopicLabel(identity), 180) || buildLedgerTopicLabel(identity);
  if (!topicId || !topicLabel) return null;
  const truthSummary = deriveLedgerTruthSummary({
    raw,
    evidenceRefs,
    contradictions,
  });
  const status = determineLedgerStatus({
    evidenceRefs,
    contradictions,
    openFollowUps,
    summaryClass: truthSummary.summaryClass,
  });
  return {
    topicId,
    topicLabel,
    identity,
    question,
    status,
    sourceClass: truthSummary.sourceClass,
    summaryClass: truthSummary.summaryClass,
    summaryEvidenceRefs: truthSummary.summaryEvidenceRefs,
    conclusion: truthSummary.conclusion,
    evidenceRefs,
    openFollowUps,
    contradictions,
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
  if (!fs
    || typeof fs.readFileSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function'
    || typeof fs.mkdirSync !== 'function'
    || typeof fs.existsSync !== 'function') {
    throw new TypeError('createResearchLedgerApi requires fs');
  }
  if (!path || typeof path.resolve !== 'function') throw new TypeError('createResearchLedgerApi requires path');
  if (!LEDGER_FILE) throw new TypeError('createResearchLedgerApi requires LEDGER_FILE');

  function ensureLedgerFile() {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
    if (fs.existsSync(LEDGER_FILE)) return;
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: LEDGER_FILE,
      value: defaultResearchLedgerStore(),
    });
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
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: LEDGER_FILE,
      value: normalized,
    });
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

  function hasAnchoredResearchEvidence(evidenceRefs = []) {
    return verifiedEvidenceRefs(evidenceRefs)
      .some((item) => ['project-path', 'web-url'].includes(String(item?.type || '').trim().toLowerCase()) && trimText(item?.ref || '', 220));
  }

  function isResearchShapedWriteTurn({
    userText = '',
    assistantText = '',
    evidenceRefs = [],
    contradictions = [],
  } = {}) {
    if (Array.isArray(contradictions) && contradictions.length) return true;
    if (!hasAnchoredResearchEvidence(evidenceRefs)) return false;
    return RESEARCH_SHAPED_WRITE_RE.test(`${trimText(userText, 260)} ${trimText(assistantText, 320)}`);
  }

  function determineStatus(options = {}) {
    return determineLedgerStatus(options);
  }

  function topicScore(topic = {}, sessionId = 'default', queryTokens = new Set()) {
    let score = 0;
    if (Array.isArray(topic.sourceSessionIds) && topic.sourceSessionIds.includes(sessionId)) score += 10;
    if (topic.status === 'open') score += 8;
    else if (topic.status === 'provisional') score += 4;
    else score += 1;
    score += countTokenOverlap(queryTokens, buildTopicPromptTokens(topic)) * 3;
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
    if (topic.summaryClass === 'evidence-tight' && topic.conclusion) {
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
    const queryTokens = buildMeaningfulPromptQueryTokens(userText);
    const eligibleTopics = Object.values(store.topics)
      .map(normalizeLedgerEntry)
      .filter(Boolean)
      .map((topic) => {
        const sameSession = Array.isArray(topic.sourceSessionIds) && topic.sourceSessionIds.includes(sessionId);
        const scopeOverlap = countTokenOverlap(queryTokens, buildTopicPromptTokens(topic));
        const anchorOverlap = countTokenOverlap(queryTokens, buildTopicAnchorTokens(topic));
        const eligible = sameSession || scopeOverlap > 0 || anchorOverlap > 0;
        return {
          topic,
          sameSession,
          scopeOverlap,
          anchorOverlap,
          eligible,
        };
      })
      .filter((item) => item.eligible)
      .sort((left, right) => (
        right.anchorOverlap - left.anchorOverlap
        || right.scopeOverlap - left.scopeOverlap
        || Number(right.sameSession === true) - Number(left.sameSession === true)
        || topicScore(right.topic, sessionId, queryTokens) - topicScore(left.topic, sessionId, queryTokens)
      ));
    const anchorTopics = eligibleTopics.filter((item) => item.anchorOverlap > 0);
    const scopedAnchorTopics = anchorTopics.filter((item) => item.scopeOverlap > 0);
    const selectedTopics = scopedAnchorTopics.length
      ? scopedAnchorTopics.slice(0, LEDGER_PROMPT_TOPIC_LIMIT)
      : (anchorTopics.length
        ? anchorTopics.slice(0, 1)
        : eligibleTopics.slice(0, Math.min(1, LEDGER_PROMPT_TOPIC_LIMIT)));
    const topics = selectedTopics
      .map(({ topic }) => ({
        topicId: topic.topicId,
        topicLabel: topic.topicLabel,
        identity: topic.identity,
        status: topic.status,
        sourceClass: topic.sourceClass,
        summaryClass: topic.summaryClass,
        summaryEvidenceRefs: normalizeSummaryEvidenceRefs(topic.summaryEvidenceRefs, 3),
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
    toolOutcome = null,
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
    const writeIntentRequired = toolOutcome?.writeIntentRequired === true;
    const writeIntentSatisfied = writeIntentRequired
      ? toolOutcome?.writeIntentSatisfied === true
      : false;

    if (looksCasual) {
      return { updated: false, reason: 'casual-chat' };
    }
    if (writeIntentRequired && !writeIntentSatisfied) {
      return {
        updated: false,
        reason: trimText(toolOutcome?.failureReason || '', 80) || 'write-required-unmet',
      };
    }
    if (writeIntentSatisfied && !isResearchShapedWriteTurn({
      userText: cleanUserText,
      assistantText: cleanAssistantText,
      evidenceRefs,
      contradictions,
    })) {
      return { updated: false, reason: 'generic-write-turn' };
    }
    if (!evidenceRefs.length && !contradictions.length && !(openFollowUps.length && hasResearchContext)) {
      return { updated: false, reason: 'non-qualifying-turn' };
    }

    const identity = buildLedgerIdentity({
      userText: cleanUserText,
      topicLabel: '',
      evidenceRefs,
      contradictions,
    });
    const topicId = buildLedgerTopicId(identity);
    const topicLabel = buildLedgerTopicLabel(identity);
    const store = readLedgerStore();
    const existing = normalizeLedgerEntry(store.topics?.[topicId] || {});
    const lastTouchedAt = new Date(nowMs()).toISOString();
    const sourceTurnId = `${sessionId}:${nowMs()}`;
    const mergedOpenFollowUps = appendUniqueStrings(existing?.openFollowUps || [], openFollowUps, LEDGER_FOLLOW_UP_LIMIT);
    const mergedContradictions = [...(existing?.contradictions || []), ...contradictions]
      .map(normalizeContradiction)
      .filter(Boolean)
      .slice(-LEDGER_CONTRADICTION_LIMIT);
    const next = normalizeLedgerEntry({
      topicId,
      topicLabel,
      identity,
      question: cleanUserText || existing?.question || topicLabel,
      status: determineStatus({
        evidenceRefs: [...(existing?.evidenceRefs || []), ...evidenceRefs],
        contradictions: mergedContradictions,
        openFollowUps: mergedOpenFollowUps,
      }),
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
