const {
  mergeMemoryItems,
  normalizeText,
} = require('./penny-memory');

const CORRECTION_MARKERS = [
  /\bactually\b/i,
  /\binstead\b/i,
  /\bcorrection\b/i,
  /\bchanged my mind\b/i,
  /\bnot anymore\b/i,
  /\bnot any more\b/i,
  /\bused to\b/i,
  /\bnow\b/i,
  /^\s*no[, ]/i,
];

const EXPLICIT_MEMORY_INTENT_PATTERNS = [
  /\bremember this\b/i,
  /\bremember that\b/i,
  /\bremember this exactly\b/i,
  /\bnote this\b/i,
  /\bdon't forget\b/i,
  /\bfor later\b/i,
];

function createMemoryStateApi({
  normalizeMemoryRecord,
  normalizeUserName,
  normalizeBrainMode,
  nowMs = () => Date.now(),
} = {}) {
  if (typeof normalizeMemoryRecord !== 'function') {
    throw new TypeError('createMemoryStateApi requires normalizeMemoryRecord');
  }
  if (typeof normalizeUserName !== 'function') {
    throw new TypeError('createMemoryStateApi requires normalizeUserName');
  }
  if (typeof normalizeBrainMode !== 'function') {
    throw new TypeError('createMemoryStateApi requires normalizeBrainMode');
  }

  function mergeMemoryState(base = {}, patch = {}, options = {}) {
    const sessionId = base.sessionId || patch.sessionId || 'default';
    const record = normalizeMemoryRecord({ ...base, ...patch }, sessionId);
    const hasPatchMemories = Object.prototype.hasOwnProperty.call(patch, 'memories') && Array.isArray(patch.memories);
    const replaceMemories = options.replaceMemories === true
      || (options.replaceMemories !== false && hasPatchMemories);
    const sources = replaceMemories
      ? (patch.memories || [])
      : [...(patch.memories || []), ...(base.memories || [])];
    record.memories = mergeMemoryItems(sources);
    return record;
  }

  function getChatMemorySettings(clientMemory = {}) {
    if (!clientMemory || typeof clientMemory !== 'object') return {};
    const next = {};
    if (Object.prototype.hasOwnProperty.call(clientMemory, 'userName')) next.userName = normalizeUserName(clientMemory.userName);
    if (Object.prototype.hasOwnProperty.call(clientMemory, 'voiceOn')) next.voiceOn = !!clientMemory.voiceOn;
    if (Object.prototype.hasOwnProperty.call(clientMemory, 'brainMode')) next.brainMode = normalizeBrainMode(clientMemory.brainMode);
    return next;
  }

  function extractMemories(text = '') {
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    const out = [];
    const timestamp = nowMs();
    const propertyPatterns = [
      {
        pattern: /\bmy favorite ([a-z][a-z0-9' -]{1,40}?) is\b(.+)/i,
        buildText(match) {
          const label = normalizeText(`Favorite ${match[1]}`).replace(/[.!?]+$/g, '');
          const value = normalizeText(match[2]).replace(/[.!?]+$/g, '');
          if (!label || !value) return '';
          return `${label} is ${value.replace(/\bnow\b$/i, '').trim()}`;
        },
      },
      {
        pattern: /\bmy ([a-z][a-z0-9' -]{2,50}?) is\b(.+)/i,
        buildText(match) {
          const label = normalizeText(match[1]).replace(/[.!?]+$/g, '');
          const value = normalizeText(match[2]).replace(/[.!?]+$/g, '');
          if (!label || !value) return '';
          return `${label} is ${value.replace(/\bnow\b$/i, '').trim()}`;
        },
      },
    ];
    let matchedPropertyFact = false;
    for (const entry of propertyPatterns) {
      const match = normalized.match(entry.pattern);
      if (!match) continue;
      const factText = normalizeText(entry.buildText(match));
      if (factText && factText.length >= 6 && factText.length <= 160) {
        out.push({ text: factText, kind: 'explicit', ts: timestamp });
        matchedPropertyFact = true;
      }
      break;
    }
    const prefMatch = normalized.match(/\b(i like|i love|i'm into|i am into|my favorite(?: thing)? is|i've been obsessed with|i am obsessed with)\b(.+)/i);
    if (prefMatch && !matchedPropertyFact) {
      const tail = normalizeText(prefMatch[2]).replace(/[.!?]+$/g, '').replace(/\bnow\b$/i, '').trim();
      if (tail && tail.length >= 4 && tail.length <= 120) out.push({ text: `They like ${tail}`, kind: 'preference', ts: timestamp });
    }
    const idPatterns = [/\b(i work as|i work in)\b(.+)/i, /\b(i live in|i'm from|i am from)\b(.+)/i, /\b(i'm a|i am a)\b(.+)/i];
    for (const pat of idPatterns) {
      const match = normalized.match(pat);
      if (!match) continue;
      const tail = normalizeText(match[2]).replace(/[.!?]+$/g, '');
      if (tail && tail.length >= 3 && tail.length <= 100) out.push({ text: `They said ${match[1].toLowerCase()} ${tail}`, kind: 'personal', ts: timestamp });
    }
    const traitPatterns = [/\bi'm the kind of person who\b(.+)/i, /\bi am the kind of person who\b(.+)/i, /\bi tend to\b(.+)/i, /\bi usually\b(.+)/i, /\bi always\b(.{8,80})/i];
    for (const pat of traitPatterns) {
      const match = normalized.match(pat);
      if (!match) continue;
      const tail = normalizeText(match[1]).replace(/[.!?]+$/g, '');
      if (tail && tail.length >= 6 && tail.length <= 100) out.push({ text: `They tend to ${tail}`, kind: 'observation', ts: timestamp });
    }
    if (/\b(remember|note this|don't forget)\b/i.test(normalized)) {
      const cleaned = normalizeText(normalized.replace(/\b(remember|note this|don't forget|remember that|remember this)\b[:,]?/ig, ''));
      if (cleaned && cleaned.length >= 4 && cleaned.length <= 200) out.push({ text: cleaned, kind: 'explicit', ts: timestamp });
    }
    return out;
  }

  function hasExplicitMemoryIntent(text = '') {
    const source = String(text || '').trim();
    return EXPLICIT_MEMORY_INTENT_PATTERNS.some((pattern) => pattern.test(source));
  }

  function normalizeReviewCandidates(items = [], latestUserText = '') {
    const evidenceSnippet = normalizeText(latestUserText).slice(0, 220);
    return mergeMemoryItems((Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      source: 'review-candidate',
      evidence: evidenceSnippet ? [evidenceSnippet] : (Array.isArray(item?.evidence) ? item.evidence : []),
      origin: {
        sourceType: 'heuristic-chat',
        scope: 'review-promote',
        evidenceSnippet: evidenceSnippet || String(item?.origin?.evidenceSnippet || '').trim(),
      },
    })));
  }

  function consolidateMemory(messages = [], existing = {}) {
    let userName = normalizeUserName(existing.userName || '');
    const canonicalMemories = [];
    const reviewCandidates = [];
    const replacedTopicKeys = new Set();
    const userMessages = Array.isArray(messages)
      ? messages.filter((msg) => msg?.role === 'user').map((msg) => String(msg.content || '').trim()).filter(Boolean)
      : [];
    const existingMemories = Array.isArray(existing.memories) ? existing.memories : [];
    for (const text of userMessages) {
      const nameMatch = text.match(/\b(?:my name is|call me)\s+([a-z][a-z'-]{1,30})\b/i);
      if (nameMatch) userName = normalizeUserName(nameMatch[1]);
      const extracted = extractMemories(text);
      if (!extracted.length) continue;
      const correctionStyle = buildCorrectionProvenance(existingMemories, text).length > 0;
      const directWrite = hasExplicitMemoryIntent(text) || correctionStyle;
      if (directWrite) {
        canonicalMemories.push(...extracted.map((item) => {
          if (correctionStyle) {
            const topicKey = deriveMemoryTopicKey(item?.text || '', item?.kind || '');
            if (topicKey) replacedTopicKeys.add(topicKey);
          }
          return {
            ...item,
            source: correctionStyle ? 'correction' : 'explicit',
            evidence: [normalizeText(text).slice(0, 220)].filter(Boolean),
          };
        }));
      } else {
        reviewCandidates.push(...normalizeReviewCandidates(extracted, text));
      }
    }
    const retainedExistingMemories = existingMemories.filter((item) => {
      const topicKey = deriveMemoryTopicKey(item?.text || '', item?.kind || '');
      return !topicKey || !replacedTopicKeys.has(topicKey);
    });
    return {
      userName,
      memories: mergeMemoryItems([...canonicalMemories, ...retainedExistingMemories]),
      reviewCandidates: normalizeReviewCandidates(reviewCandidates),
    };
  }

  function findCorrectionTrigger(text = '') {
    const source = String(text || '').trim();
    for (const pattern of CORRECTION_MARKERS) {
      const match = source.match(pattern);
      if (!match) continue;
      return normalizeText(match[0]).slice(0, 80);
    }
    return '';
  }

  function deriveMemoryTopicKey(text = '', kind = '') {
    let source = normalizeText(text).toLowerCase();
    if (!source) return '';
    if (source.startsWith('they said ')) source = source.slice(10).trim();
    if (source.startsWith('they like ') || source.startsWith('they tend to ')) return '';

    const favoriteMatch = source.match(/^(my favorite(?: [a-z]+){0,4})\s+is\b/);
    if (favoriteMatch) return normalizeText(favoriteMatch[1]).toLowerCase();

    const identityMatch = source.match(/^(i(?:'m| am)\s+(?:from|a)|i\s+work\s+(?:as|in)|i\s+live\s+in)\b/);
    if (identityMatch) return normalizeText(identityMatch[1]).toLowerCase();

    const propertyMatch = source.match(/^(.{3,80}?)\s+(?:is|are|was|were|keeps?|keep|uses?|use|sits?|sit|lives?|live|works?\s+as|works?\s+in|work\s+as|work\s+in|calls?|call)\b/);
    if (propertyMatch) return normalizeText(propertyMatch[1]).toLowerCase();

    if (kind === 'explicit') {
      const prefix = source.split(/\b(?:is|are|was|were|keep|keeps|use|uses|call|calls)\b/i)[0] || '';
      const normalizedPrefix = normalizeText(prefix).toLowerCase();
      if (normalizedPrefix.length >= 4 && normalizedPrefix.length <= 80) return normalizedPrefix;
    }

    return '';
  }

  function buildCorrectionProvenance(existingMemories = [], latestUserText = '') {
    const trigger = findCorrectionTrigger(latestUserText);
    if (!trigger) return [];

    const existingByTopic = new Map();
    for (const item of Array.isArray(existingMemories) ? existingMemories : []) {
      const topicKey = deriveMemoryTopicKey(item?.text || '', item?.kind || '');
      if (!topicKey || existingByTopic.has(topicKey)) continue;
      existingByTopic.set(topicKey, item);
    }

    const replacements = [];
    const seen = new Set();
    for (const next of extractMemories(latestUserText)) {
      const topicKey = deriveMemoryTopicKey(next?.text || '', next?.kind || '');
      const previous = topicKey ? existingByTopic.get(topicKey) : null;
      if (!topicKey || !previous) continue;
      const oldText = normalizeText(previous.text || '');
      const newText = normalizeText(next.text || '');
      if (!oldText || !newText || oldText.toLowerCase() === newText.toLowerCase() || seen.has(topicKey)) continue;
      seen.add(topicKey);
      replacements.push({
        topicKey,
        conflictKey: topicKey,
        oldText,
        newText,
        trigger,
        confidence: 1,
      });
      if (replacements.length >= 4) break;
    }
    return replacements;
  }

  function buildChatMemoryStateFromDiskMemory(diskMemory = {}, clientMemory = {}, messages = []) {
    const runtimeMemory = mergeMemoryState(diskMemory, getChatMemorySettings(clientMemory), { replaceMemories: false });
    const consolidated = consolidateMemory(messages, runtimeMemory);
    const latestUserText = Array.isArray(messages)
      ? [...messages].reverse().find((msg) => msg?.role === 'user' && String(msg.content || '').trim())?.content || ''
      : '';
    const provenance = buildCorrectionProvenance(runtimeMemory.memories, latestUserText);
    const merged = mergeMemoryState(runtimeMemory, consolidated, { replaceMemories: false });
    return {
      diskMemory,
      memory: merged,
      patch: {
        ...consolidated,
        provenance,
        reviewCandidates: Array.isArray(consolidated.reviewCandidates) ? consolidated.reviewCandidates : [],
      },
    };
  }

  return {
    mergeMemoryState,
    getChatMemorySettings,
    extractMemories,
    consolidateMemory,
    deriveMemoryTopicKey,
    buildCorrectionProvenance,
    buildChatMemoryStateFromDiskMemory,
  };
}

module.exports = {
  createMemoryStateApi,
};
