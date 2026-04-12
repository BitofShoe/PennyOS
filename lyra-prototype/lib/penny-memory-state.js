const {
  mergeMemoryItems,
  normalizeText,
} = require('./penny-memory');

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
    const prefMatch = normalized.match(/\b(i like|i love|i'm into|i am into|my favorite(?: thing)? is|i've been obsessed with|i am obsessed with)\b(.+)/i);
    if (prefMatch) {
      const tail = normalizeText(prefMatch[2]).replace(/[.!?]+$/g, '');
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

  function consolidateMemory(messages = [], existing = {}) {
    let userName = normalizeUserName(existing.userName || '');
    const newMemories = [];
    const userMessages = Array.isArray(messages)
      ? messages.filter((msg) => msg?.role === 'user').map((msg) => String(msg.content || '').trim()).filter(Boolean)
      : [];
    for (const text of userMessages) {
      const nameMatch = text.match(/\b(?:my name is|call me)\s+([a-z][a-z'-]{1,30})\b/i);
      if (nameMatch) userName = normalizeUserName(nameMatch[1]);
      for (const memory of extractMemories(text)) newMemories.push(memory);
    }
    const existingMemories = Array.isArray(existing.memories) ? existing.memories : [];
    return { userName, memories: mergeMemoryItems([...newMemories, ...existingMemories]) };
  }

  function buildChatMemoryStateFromDiskMemory(diskMemory = {}, clientMemory = {}, messages = []) {
    const runtimeMemory = mergeMemoryState(diskMemory, getChatMemorySettings(clientMemory), { replaceMemories: false });
    const consolidated = consolidateMemory(messages, runtimeMemory);
    const merged = mergeMemoryState(runtimeMemory, consolidated, { replaceMemories: false });
    return { diskMemory, memory: merged, patch: consolidated };
  }

  return {
    mergeMemoryState,
    getChatMemorySettings,
    extractMemories,
    consolidateMemory,
    buildChatMemoryStateFromDiskMemory,
  };
}

module.exports = {
  createMemoryStateApi,
};
