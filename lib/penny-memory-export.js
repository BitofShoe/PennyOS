const { mergeMemoryItems } = require('./penny-memory');

function cloneJsonSafe(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function buildExplicitMemoryExport(memory = {}, { generatedAt = new Date().toISOString() } = {}) {
  const explicit = memory && typeof memory === 'object' ? memory : {};
  const nowMs = Number.isFinite(Date.parse(generatedAt)) ? Date.parse(generatedAt) : Date.now();
  return {
    schema: 'penny-memory-export.v1',
    generatedAt,
    source: 'local-explicit-memory',
    canonicalExplicitMemory: {
      userName: String(explicit.userName || ''),
      memories: Array.isArray(explicit.memories)
        ? cloneJsonSafe(mergeMemoryItems(explicit.memories, explicit.memories.length, nowMs), [])
        : [],
      voiceOn: explicit.voiceOn === true,
      brainMode: String(explicit.brainMode || 'local'),
      updatedAt: String(explicit.updatedAt || ''),
    },
    advisoryArchiveIncluded: false,
    archiveExportHint: 'Archive memory is advisory/debug-only and is not included in this explicit-memory export.',
  };
}

module.exports = {
  buildExplicitMemoryExport,
};
