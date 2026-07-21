function normalizedText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isEmbeddingModelEntry(entry = {}) {
  const type = normalizedText(entry.type);
  if (type === 'embedding' || type === 'rerank') return true;
  if (type === 'llm') return false;

  const joined = [
    entry.identifier,
    entry.modelKey,
    entry.displayName,
    entry.path,
    entry.indexedModelIdentifier,
    entry.architecture,
  ].map(normalizedText).join(' ');

  return /\b(embed|embedding|rerank)\b/.test(joined) || /embeddinggemma/.test(joined);
}

function loadedModelIdentifier(entry = {}) {
  return String(entry.identifier || entry.modelKey || entry.path || entry.indexedModelIdentifier || '').trim();
}

function getUnloadIdentifiersForNonEmbeddingModels(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object')
    .filter((entry) => !isEmbeddingModelEntry(entry))
    .map(loadedModelIdentifier)
    .filter(Boolean);
}

function summarizeLoadedModelEntries(entries = []) {
  const summary = {
    llm: 0,
    embedding: 0,
    other: 0,
    identifiers: {
      llm: [],
      embedding: [],
      other: [],
    },
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    const identifier = loadedModelIdentifier(entry);
    if (isEmbeddingModelEntry(entry)) {
      summary.embedding += 1;
      if (identifier) summary.identifiers.embedding.push(identifier);
    } else if (normalizedText(entry?.type) === 'llm' || identifier) {
      summary.llm += 1;
      if (identifier) summary.identifiers.llm.push(identifier);
    } else {
      summary.other += 1;
      if (identifier) summary.identifiers.other.push(identifier);
    }
  }

  return summary;
}

module.exports = {
  getUnloadIdentifiersForNonEmbeddingModels,
  isEmbeddingModelEntry,
  loadedModelIdentifier,
  summarizeLoadedModelEntries,
};
