const {
  OPEN_LOOP_STATUSES,
  normalizeOpenLoop,
} = require('./penny-open-loops');

const OPEN_LOOP_EXTRACTION_SCHEMA = 'penny-open-loop-suggestions.v1';

const STATUS_SIGNALS = Object.freeze({
  COMPLETED: 'completed-signal',
  DEFERRED: 'deferred-signal',
  BLOCKED: 'blocked-signal',
  IN_PROGRESS: 'in-progress-signal',
  OPEN: 'open-signal',
});

const SENSITIVE_INFERENCE_PATTERN = /\b(depressed|depression|anxiety|diagnos(?:is|ed)|medical|medication|therapy|trauma|pregnant|sexual|romantic|political|religion|financial|bank|password|secret|home address|phone number)\b/i;
const SPECULATION_PATTERN = /\b(?:maybe|probably|possibly|speculative|speculation|might|could be|seems?|appears?|assume|guess|suspect|unclear)\b/i;
const ACTION_PATTERN = /\b(?:next\s+(?:risk|step|follow-?up|target|slice)|follow-?up|deferred|blocked|halfway|in progress|unfinished|pending|still needs?|todo|landed|completed|done|no follow-?up unless)\b/i;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value = '', limit = 1000) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '') {
  return cleanText(value, 120).toLowerCase().replace(/[_\s]+/g, '-');
}

function cleanTitle(value = '') {
  return cleanText(value, 160)
    .replace(/^(?:reflection|session|artifact|note|summary)\s*:\s*/i, '')
    .replace(/^(?:maybe|probably|possibly|speculative(?:ly)?)\s+/i, '')
    .replace(/^(?:the\s+)?(?:open\s+loop|follow-?up|next\s+step)\s+(?:is|was|for|on)\s+/i, '')
    .replace(/[.?!;:,]+$/g, '')
    .trim();
}

function sentenceCase(value = '') {
  const text = cleanText(value, 500).replace(/^[\s:;-]+/, '');
  if (!text) return '';
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`.replace(/[.?!]+$/g, '');
}

function slugify(value = '', fallback = 'open-loop') {
  const slug = cleanText(value, 180).toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function normalizeNowIso(now = new Date()) {
  if (now instanceof Date) {
    const time = now.getTime();
    return Number.isFinite(time) ? now.toISOString() : new Date().toISOString();
  }
  const parsed = Date.parse(String(now || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function clampInteger(value, fallback = 12, min = 0, max = 50) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeArtifactList(input = {}) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') return [{ text: input, type: 'fixture' }];
  if (!isPlainObject(input)) return [];
  if (Array.isArray(input.artifacts)) return input.artifacts;
  if (Array.isArray(input.items)) return input.items;
  return [input];
}

function normalizeSource(artifact = {}, index = 0, fallbackText = '') {
  const raw = isPlainObject(artifact) ? artifact : {};
  const type = cleanToken(raw.sourceType || raw.kind || raw.type || 'fixture') || 'fixture';
  const id = cleanText(
    raw.id
      || raw.artifactId
      || raw.turnId
      || raw.sessionId
      || raw.sourceId
      || `fixture-${index + 1}`,
    180,
  );
  const path = cleanText(raw.path || raw.file || '', 500);
  const url = cleanText(raw.url || '', 500);
  const label = cleanText(raw.label || raw.title || raw.name || type, 180);
  const createdAt = cleanText(raw.createdAt || raw.updatedAt || raw.at || '', 80);
  const sourceRef = {
    type,
    ...(id ? { id } : {}),
    ...(path ? { path } : {}),
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
    note: 'open-loop fixture extraction',
  };
  return {
    ...sourceRef,
    ...(createdAt ? { createdAt: normalizeNowIso(createdAt) } : {}),
    excerpt: cleanText(fallbackText, 360),
  };
}

function cleanArtifactTextValue(value = '') {
  if (Array.isArray(value)) {
    return value.map(cleanArtifactTextValue).filter(Boolean).join('\n');
  }
  if (isPlainObject(value)) return '';
  return cleanText(value, 2000);
}

function collectArtifactText(artifact = {}) {
  if (typeof artifact === 'string') return artifact;
  if (!isPlainObject(artifact)) return '';
  const values = [
    artifact.text,
    artifact.content,
    artifact.summary,
    isPlainObject(artifact.reflection) ? '' : artifact.reflection,
    artifact.notes,
    artifact.note,
    artifact.excerpt,
    artifact.nextLikelyStep,
  ];
  if (isPlainObject(artifact.session)) {
    values.push(
      artifact.session.text,
      artifact.session.summary,
      artifact.session.reflection,
      artifact.session.notes,
    );
  }
  if (isPlainObject(artifact.reflection)) {
    values.push(
      artifact.reflection.text,
      artifact.reflection.summary,
      artifact.reflection.nextLikelyStep,
      artifact.reflection.notes,
    );
  }
  return values.map(cleanArtifactTextValue).filter(Boolean).join('\n');
}

function splitCandidateTexts(text = '') {
  return cleanText(text, 8000)
    .split(/(?:\r?\n)+|(?<=[.?!])\s+(?=[A-Z0-9"'])/g)
    .map((item) => cleanText(item, 1000))
    .filter(Boolean);
}

function classifyStatus(text = '') {
  const source = cleanText(text, 1000);
  if (/\b(?:deferred|parked|later branch|until concrete|wait(?:ing)? for a concrete)\b/i.test(source)) {
    return { status: OPEN_LOOP_STATUSES.DEFERRED, signal: STATUS_SIGNALS.DEFERRED };
  }
  if (/\b(?:blocked|waiting on|blocked on|stuck until)\b/i.test(source)) {
    return { status: OPEN_LOOP_STATUSES.BLOCKED, signal: STATUS_SIGNALS.BLOCKED };
  }
  if (/\b(?:halfway|half-way|in progress|unfinished|pending|still needs?|next\s+(?:risk|step|follow-?up|target|slice)|todo)\b/i.test(source)) {
    return { status: OPEN_LOOP_STATUSES.IN_PROGRESS, signal: STATUS_SIGNALS.IN_PROGRESS };
  }
  if (/\b(?:landed|completed|complete|done|resolved|shipped|no follow-?up unless)\b/i.test(source)) {
    return { status: OPEN_LOOP_STATUSES.COMPLETED, signal: STATUS_SIGNALS.COMPLETED };
  }
  if (/\bfollow-?up\b/i.test(source)) {
    return { status: OPEN_LOOP_STATUSES.OPEN, signal: STATUS_SIGNALS.OPEN };
  }
  return { status: '', signal: '' };
}

function extractTitle(text = '') {
  const source = cleanText(text, 1000);
  const firstClause = cleanText(source.split(/[;.] /)[0] || source, 400);
  const patterns = [
    /^(.*?)\s+(?:is|was|stays|remains)?\s*(?:halfway(?: done)?|half-way(?: done)?|in progress|unfinished|pending|blocked|deferred|landed|completed|complete|done|resolved|shipped)\b/i,
    /^(.*?)\s+(?:deferred|blocked|landed|completed|done|resolved|shipped)\b/i,
    /^(.*?)\s+(?:still needs?|needs?|has)\s+/i,
    /^(.*?)\s+next\s+(?:risk|step|follow-?up|target|slice)\b/i,
  ];
  for (const pattern of patterns) {
    const match = firstClause.match(pattern);
    const title = cleanTitle(match?.[1] || '');
    if (title) return title;
  }
  const fallback = cleanTitle(firstClause.split(/\b(?:next\s+(?:risk|step|follow-?up)|follow-?up|deferred|blocked|landed)\b/i)[0]);
  if (fallback && fallback.split(/\s+/).length <= 8) return fallback;
  return '';
}

function extractNextLikelyStep(text = '', status = '') {
  const source = cleanText(text, 1000);
  const noFollowUp = source.match(/\bno follow-?up unless\s+(.+)$/i);
  if (noFollowUp?.[1]) return `No follow-up unless ${sentenceCase(noFollowUp[1])}`;

  const next = source.match(/\bnext\s+(?:risk|step|follow-?up|target|slice)\s*(?:is|:|-)?\s+(.+)$/i);
  if (next?.[1]) return sentenceCase(next[1]);

  const deferred = source.match(/\bdeferred\s+until\s+(.+)$/i)
    || source.match(/\bwait(?:ing)?\s+until\s+(.+)$/i);
  if (deferred?.[1]) return `Wait until ${sentenceCase(deferred[1])}`;

  const blocked = source.match(/\bblocked\s+on\s+(.+)$/i)
    || source.match(/\bwaiting\s+on\s+(.+)$/i);
  if (blocked?.[1]) return `Unblock ${sentenceCase(blocked[1])}`;

  const stillNeeds = source.match(/\bstill needs?\s+(.+)$/i)
    || source.match(/\bneeds?\s+(.+)$/i);
  if (stillNeeds?.[1]) return sentenceCase(stillNeeds[1]);

  if (status === OPEN_LOOP_STATUSES.COMPLETED) return 'No follow-up currently identified';
  return '';
}

function priorityForText(text = '', status = '') {
  if (/\b(?:critical|urgent|risk|blocked|guardrail|safety)\b/i.test(text)) return 'high';
  if (status === OPEN_LOOP_STATUSES.COMPLETED) return 'low';
  return 'medium';
}

function confidenceForText({ text = '', status = '', speculation = false } = {}) {
  if (speculation) return 'low';
  if (status === OPEN_LOOP_STATUSES.COMPLETED && /\b(?:landed|completed|done|resolved|shipped)\b/i.test(text)) return 'high';
  if (/\b(?:halfway|deferred|blocked|next\s+(?:risk|step|follow-?up))\b/i.test(text)) return 'medium';
  return 'medium';
}

function buildRejection({ reason = '', text = '', source = null } = {}) {
  return {
    reason: cleanToken(reason) || 'not-actionable',
    ...(source ? { source } : {}),
    excerpt: cleanText(text, 360),
  };
}

function extractOpenLoopSuggestionFromText({
  text = '',
  source = null,
  now = new Date(),
} = {}) {
  const excerpt = cleanText(text, 1000);
  if (!excerpt || !ACTION_PATTERN.test(excerpt)) {
    return {
      suggestion: null,
      rejection: buildRejection({ reason: 'not-actionable', text: excerpt, source }),
    };
  }

  const speculation = SPECULATION_PATTERN.test(excerpt);
  if (SENSITIVE_INFERENCE_PATTERN.test(excerpt)) {
    return {
      suggestion: null,
      rejection: buildRejection({
        reason: speculation ? 'sensitive-private-inference' : 'sensitive-topic-suppressed',
        text: excerpt,
        source,
      }),
    };
  }

  const { status, signal } = classifyStatus(excerpt);
  const title = extractTitle(excerpt);
  if (!status || !title) {
    return {
      suggestion: null,
      rejection: buildRejection({ reason: status ? 'missing-title' : 'missing-status-signal', text: excerpt, source }),
    };
  }

  const sourceRef = source
    ? {
        type: source.type,
        ...(source.id ? { id: source.id } : {}),
        ...(source.path ? { path: source.path } : {}),
        ...(source.url ? { url: source.url } : {}),
        ...(source.label ? { label: source.label } : {}),
        note: speculation ? 'speculative open-loop fixture extraction' : 'open-loop fixture extraction',
      }
    : { type: 'fixture', note: speculation ? 'speculative open-loop fixture extraction' : 'open-loop fixture extraction' };

  const lastTouchedAt = source?.createdAt || normalizeNowIso(now);
  const nextLikelyStep = extractNextLikelyStep(excerpt, status);
  const loop = normalizeOpenLoop({
    id: slugify(title),
    title,
    status,
    priority: priorityForText(excerpt, status),
    lastTouchedAt,
    nextLikelyStep,
    sourceRefs: [sourceRef],
    confidence: confidenceForText({ text: excerpt, status, speculation }),
    completedAt: status === OPEN_LOOP_STATUSES.COMPLETED ? lastTouchedAt : '',
    surfacePolicy: {
      mode: status === OPEN_LOOP_STATUSES.COMPLETED ? 'manual-only' : 'relevant-only',
      maxSurfaceCount: status === OPEN_LOOP_STATUSES.COMPLETED ? 0 : 1,
    },
  });

  if (!loop) {
    return {
      suggestion: null,
      rejection: buildRejection({ reason: 'normalization-rejected', text: excerpt, source }),
    };
  }

  return {
    suggestion: {
      ...loop,
      source: {
        ...(source || sourceRef),
        excerpt,
      },
      speculation,
      labels: speculation ? ['speculation'] : [],
      extraction: {
        sourceExcerpt: excerpt,
        sourceType: source?.type || sourceRef.type,
        statusSignal: signal,
        speculation,
        reason: speculation ? 'speculative-open-loop-pattern' : 'open-loop-pattern',
      },
    },
    rejection: null,
  };
}

function extractOpenLoopSuggestions(input = {}, options = {}) {
  const config = isPlainObject(input) && (Array.isArray(input.artifacts) || Array.isArray(input.items))
    ? input
    : {};
  const now = config.now || options.now || input.now || new Date();
  const generatedAt = normalizeNowIso(now);
  const maxSuggestions = clampInteger(config.maxSuggestions ?? options.maxSuggestions, 12, 0, 50);
  const artifacts = normalizeArtifactList(input);
  const openLoopSuggestions = [];
  const rejected = [];
  const seenIds = new Set();

  artifacts.forEach((artifact, index) => {
    const text = collectArtifactText(artifact);
    const sourceBase = normalizeSource(artifact, index, text);
    for (const candidateText of splitCandidateTexts(text)) {
      if (openLoopSuggestions.length >= maxSuggestions) break;
      const source = {
        ...sourceBase,
        excerpt: cleanText(candidateText, 360),
      };
      const { suggestion, rejection } = extractOpenLoopSuggestionFromText({
        text: candidateText,
        source,
        now,
      });
      if (suggestion) {
        if (seenIds.has(suggestion.id)) continue;
        seenIds.add(suggestion.id);
        openLoopSuggestions.push(suggestion);
      } else if (rejection) {
        rejected.push(rejection);
      }
    }
  });

  return {
    schema: OPEN_LOOP_EXTRACTION_SCHEMA,
    generatedAt,
    openLoopSuggestions,
    rejected,
    summary: {
      suggestionCount: openLoopSuggestions.length,
      rejectedCount: rejected.length,
      speculationCount: openLoopSuggestions.filter((item) => item.speculation === true).length,
      sourceCount: artifacts.length,
    },
  };
}

module.exports = {
  OPEN_LOOP_EXTRACTION_SCHEMA,
  extractOpenLoopSuggestionFromText,
  extractOpenLoopSuggestions,
};
