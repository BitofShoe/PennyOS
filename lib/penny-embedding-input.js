const EMBEDDINGGEMMA_EOS_TOKEN = '<eos>';
const RAW_EMBEDDING_REQUEST_FORMAT = 'raw-v1';
const EMBEDDINGGEMMA_EOS_REQUEST_FORMAT = 'embeddinggemma-eos-v1';

function normalizeEmbeddingRequestModelId(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function isEmbeddingGemmaModel(value = '') {
  const model = normalizeEmbeddingRequestModelId(value);
  return /embedding-?gemma-?300m/.test(model);
}

function embeddingRequestFormatKeyForModel(model = '') {
  return isEmbeddingGemmaModel(model)
    ? EMBEDDINGGEMMA_EOS_REQUEST_FORMAT
    : RAW_EMBEDDING_REQUEST_FORMAT;
}

function formatEmbeddingRequestInput(input = '', model = '') {
  const text = String(input || '');
  if (!text) return text;
  if (embeddingRequestFormatKeyForModel(model) !== EMBEDDINGGEMMA_EOS_REQUEST_FORMAT) {
    return text;
  }
  if (text.trimEnd().endsWith(EMBEDDINGGEMMA_EOS_TOKEN)) return text;
  return `${text}${EMBEDDINGGEMMA_EOS_TOKEN}`;
}

module.exports = {
  EMBEDDINGGEMMA_EOS_REQUEST_FORMAT,
  RAW_EMBEDDING_REQUEST_FORMAT,
  embeddingRequestFormatKeyForModel,
  formatEmbeddingRequestInput,
  isEmbeddingGemmaModel,
};
