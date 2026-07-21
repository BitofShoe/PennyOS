function isOpenAiApiBase(value = '') {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'api.openai.com';
  } catch {
    return false;
  }
}

function isGpt56Model(value = '') {
  return /^gpt-5\.6(?:-|$)/i.test(String(value || '').trim());
}

function buildOpenAiChatCompatibilityFields({
  baseUrl = '',
  model = '',
  hasFunctionTools = false,
} = {}) {
  if (!hasFunctionTools || !isOpenAiApiBase(baseUrl) || !isGpt56Model(model)) return {};
  return { reasoning_effort: 'none' };
}

module.exports = {
  buildOpenAiChatCompatibilityFields,
  isGpt56Model,
  isOpenAiApiBase,
};
