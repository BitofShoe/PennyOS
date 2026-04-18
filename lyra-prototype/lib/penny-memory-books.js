const { writeJsonFileAtomicSync } = require('./penny-atomic-json');

const BOOKS_SCHEMA_VERSION = 1;
const MEMORY_BOOK_MATCH_LIMIT = 2;
const BOOK_TEXT_LIMIT = 260;

function clampNumber(value, min = 0, max = 100, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeTokenList(values = [], limit = 12, itemLimit = 80) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const text = normalizeText(value).toLowerCase().slice(0, itemLimit);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function buildMemoryBooksStore() {
  return {
    meta: {
      schemaVersion: BOOKS_SCHEMA_VERSION,
      updatedAt: '',
    },
    books: [],
  };
}

function normalizeMemoryBook(raw = {}) {
  const text = normalizeText(raw.text).slice(0, BOOK_TEXT_LIMIT);
  if (!text) return null;
  const triggers = raw.triggers && typeof raw.triggers === 'object' ? raw.triggers : {};
  const scope = String(raw.scope || 'all').trim().toLowerCase();
  const placement = String(raw.placement || 'memory').trim().toLowerCase();
  return {
    id: normalizeText(raw.id).slice(0, 80) || `memory-book-${Math.random().toString(36).slice(2, 10)}`,
    scope: ['all', 'chat', 'tool', 'shadow'].includes(scope) ? scope : 'all',
    placement: ['memory', 'overlay'].includes(placement) ? placement : 'memory',
    triggers: {
      phrases: normalizeTokenList(triggers.phrases, 16, 100),
      lanes: normalizeTokenList(triggers.lanes, 4, 20).filter((value) => ['chat', 'tool', 'shadow'].includes(value)),
      attachmentTypes: normalizeTokenList(triggers.attachmentTypes, 4, 20).filter((value) => ['none', 'image', 'file'].includes(value)),
      matchMode: String(triggers.matchMode || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any',
    },
    text,
    priority: clampNumber(raw.priority, 0, 100, 50),
    enabled: raw.enabled !== false,
    sensitivity: String(raw.sensitivity || '').trim().toLowerCase() === 'high' ? 'high' : 'normal',
    source: normalizeText(raw.source || 'local').slice(0, 80) || 'local',
  };
}

function normalizeMemoryBooksStore(store = {}) {
  const base = buildMemoryBooksStore();
  const parsed = store && typeof store === 'object' ? store : {};
  base.meta.updatedAt = normalizeText(parsed.meta?.updatedAt || '');
  base.books = Array.isArray(parsed.books)
    ? parsed.books.map(normalizeMemoryBook).filter(Boolean).slice(0, 64)
    : [];
  return base;
}

function createMemoryBooksApi({
  fs,
  path,
  BOOKS_FILE = '',
  BOOKS_SEED_FILE = '',
  nowMs = () => Date.now(),
} = {}) {
  if (!fs
    || typeof fs.existsSync !== 'function'
    || typeof fs.readFileSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function'
    || typeof fs.mkdirSync !== 'function') {
    throw new TypeError('createMemoryBooksApi requires fs');
  }
  if (!path || typeof path.dirname !== 'function') throw new TypeError('createMemoryBooksApi requires path');

  function ensureFile(filePath = '', builder = () => ({}), seedFile = '') {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) return;
    let initial = builder();
    if (seedFile && fs.existsSync(seedFile)) {
      try {
        initial = normalizeMemoryBooksStore(JSON.parse(fs.readFileSync(seedFile, 'utf8')));
      } catch {}
    }
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath,
      value: initial,
    });
  }

  function readMemoryBooksStore() {
    ensureFile(BOOKS_FILE, buildMemoryBooksStore, BOOKS_SEED_FILE);
    try {
      return normalizeMemoryBooksStore(JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8')));
    } catch {
      return normalizeMemoryBooksStore();
    }
  }

  function writeMemoryBooksStore(store = {}) {
    ensureFile(BOOKS_FILE, buildMemoryBooksStore, BOOKS_SEED_FILE);
    const normalized = normalizeMemoryBooksStore(store);
    normalized.meta.updatedAt = new Date(nowMs()).toISOString();
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: BOOKS_FILE,
      value: normalized,
    });
    return normalized;
  }

  function matchMemoryBooks({
    sessionId = 'default',
    userText = '',
    lane = 'chat',
    attachmentType = 'none',
  } = {}) {
    const store = readMemoryBooksStore();
    const normalizedText = normalizeText(userText).toLowerCase();
    const matches = [];

    for (const book of store.books) {
      if (!book.enabled || book.placement !== 'memory') continue;
      if (book.scope !== 'all' && book.scope !== lane) continue;

      const phrases = Array.isArray(book.triggers?.phrases) ? book.triggers.phrases : [];
      const lanes = Array.isArray(book.triggers?.lanes) ? book.triggers.lanes : [];
      const attachmentTypes = Array.isArray(book.triggers?.attachmentTypes) ? book.triggers.attachmentTypes : [];
      const matchedPhrases = phrases.filter((phrase) => normalizedText.includes(phrase));
      const laneMatched = !lanes.length || lanes.includes(String(lane || '').trim().toLowerCase());
      const attachmentMatched = !attachmentTypes.length || attachmentTypes.includes(String(attachmentType || 'none').trim().toLowerCase());
      const phraseMatched = !phrases.length || matchedPhrases.length > 0;
      const mode = book.triggers?.matchMode === 'all' ? 'all' : 'any';
      const matched = mode === 'all'
        ? laneMatched && attachmentMatched && phraseMatched
        : ((phrases.length && phraseMatched) || (attachmentTypes.length && attachmentMatched));
      if (!matched || !laneMatched) continue;

      const score = book.priority
        + (matchedPhrases.length * 14)
        + (attachmentTypes.length && attachmentMatched ? 6 : 0)
        + (lanes.length && laneMatched ? 4 : 0);
      matches.push({
        id: book.id,
        sessionId,
        placement: book.placement,
        scope: book.scope,
        text: book.text,
        priority: book.priority,
        score,
        sensitivity: book.sensitivity,
        source: book.source,
        matchedPhrases: matchedPhrases.slice(0, 4),
        matchedOn: {
          lane,
          attachmentType,
        },
      });
    }

    return {
      usedAt: new Date(nowMs()).toISOString(),
      lane: String(lane || 'chat'),
      attachmentType: String(attachmentType || 'none'),
      matches: matches
        .sort((left, right) => right.score - left.score || right.priority - left.priority || left.id.localeCompare(right.id))
        .slice(0, MEMORY_BOOK_MATCH_LIMIT),
    };
  }

  function getMemoryBooksInspector() {
    const store = readMemoryBooksStore();
    const enabled = store.books.filter((book) => book.enabled);
    return {
      meta: store.meta,
      count: store.books.length,
      enabledCount: enabled.length,
      entries: enabled.slice(0, 12),
    };
  }

  return {
    BOOKS_SCHEMA_VERSION,
    MEMORY_BOOK_MATCH_LIMIT,
    buildMemoryBooksStore,
    normalizeMemoryBooksStore,
    readMemoryBooksStore,
    writeMemoryBooksStore,
    matchMemoryBooks,
    getMemoryBooksInspector,
  };
}

module.exports = {
  BOOKS_SCHEMA_VERSION,
  MEMORY_BOOK_MATCH_LIMIT,
  buildMemoryBooksStore,
  normalizeMemoryBooksStore,
  createMemoryBooksApi,
};
