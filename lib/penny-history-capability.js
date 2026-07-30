const {
  LATENCY_BUDGETS,
  LATENCY_CLASSES,
} = require('./penny-latency-budget');

const HISTORY_CAPABILITY_REASON_CODE = 'history_architecture_capability';

const HISTORY_PROFILE_ORDER = Object.freeze([
  Object.freeze({ latencyClass: LATENCY_CLASSES.CASUAL_COMPANION, label: 'casual chat' }),
  Object.freeze({ latencyClass: LATENCY_CLASSES.MEMORY_HEAVY_RECALL, label: 'memory-heavy recall' }),
  Object.freeze({ latencyClass: LATENCY_CLASSES.TOOL_HEAVY, label: 'tool-heavy work' }),
  Object.freeze({ latencyClass: LATENCY_CLASSES.IMAGE_HEAVY, label: 'image-heavy work' }),
]);

function isHistoryCapabilityQuestion(userText = '') {
  const text = String(userText || '').trim().toLowerCase();
  if (!text) return false;
  const questionShaped = /\?/.test(text)
    || /^(?:how|what|do|does|can|will|would|are|is|explain|describe|tell me)\b/i.test(text);
  if (!questionShaped) return false;

  const recentUnit = '(?:recent|last|previous|prior)?\\s*(?:chat\\s+)?(?:turns?|messages?|exchanges?)';
  const asksNumericSelfBoundary = new RegExp(`\\bhow many\\b[\\s\\S]{0,72}\\b${recentUnit}\\b`, 'i').test(text)
    && (
      /\b(?:do|can|will|would|are)\s+you\b/i.test(text)
      || /\b(?:your|penny'?s)\s+(?:prompt|context|history|memory)\b/i.test(text)
      || /\b(?:include|keep|retain|remember|see|use)\b[\s\S]{0,32}\b(?:your|the)\s+(?:prompt|context|history|memory)\b/i.test(text)
    );
  if (asksNumericSelfBoundary) return true;
  if (new RegExp(`\\b(?:always|only|just)\\b[\\s\\S]{0,48}\\b(?:keep|remember|retain|send|include|see|use)?\\s*(?:the\\s+)?${recentUnit}\\b`, 'i').test(text)) return true;
  if (/\b(?:conversation|chat|recent-message|recent message)\s+(?:history|context|window)\b/i.test(text)) return true;
  if (/\b(?:remember|retain|keep|send|include|see|use)\b[\s\S]{0,48}\b(?:whole|entire|all of (?:our|the))\s+(?:chat|conversation|history)\b/i.test(text)) return true;
  if (/\b(?:how|explain|describe|what)\b[\s\S]{0,48}\b(?:your|penny'?s)\s+(?:conversation\s+)?(?:history|memory)\s+(?:architecture|system|window|works?|work)\b/i.test(text)) return true;
  if (/\b(?:how|explain|describe)\b[\s\S]{0,40}\b(?:your|penny'?s)\s+(?:memory|history)\b/i.test(text)) return true;
  return false;
}

function buildHistoryBudgetSnapshot() {
  return HISTORY_PROFILE_ORDER.map(({ latencyClass, label }) => ({
    latencyClass,
    label,
    recentMessageEntries: Number(LATENCY_BUDGETS[latencyClass]?.recentHistoryCount || 0),
  }));
}

function buildHistoryCapabilityReply() {
  const snapshot = buildHistoryBudgetSnapshot();
  const profileText = snapshot
    .map((profile) => `${profile.label} ${profile.recentMessageEntries}`)
    .join(', ');
  return [
    'Short version: I do not have one fixed “last N turns” rule.',
    `The current recent-history budgets are message entries, not conversational turns: ${profileText}.`,
    'The active transport can stage the current user message separately, and a canonical-memory question can suppress recent chat entirely so stale dialogue does not outrank explicit remembered facts.',
    'Explicit remembered facts are a separate canonical layer; archive/session retrieval is advisory, and tool evidence is separate again. So I do not automatically send or retain the whole chat, and those budget numbers are current configuration—not a promise that the model will recall every included detail.',
    '[MOOD:thinking]',
  ].join('\n\n');
}

function resolveHistoryCapabilityIntent(userText = '') {
  if (!isHistoryCapabilityQuestion(userText)) return null;
  return {
    kind: 'deterministic_reply',
    name: 'answer_history_capability',
    args: {},
    text: buildHistoryCapabilityReply(),
    reasonCode: HISTORY_CAPABILITY_REASON_CODE,
  };
}

module.exports = {
  HISTORY_CAPABILITY_REASON_CODE,
  HISTORY_PROFILE_ORDER,
  isHistoryCapabilityQuestion,
  buildHistoryBudgetSnapshot,
  buildHistoryCapabilityReply,
  resolveHistoryCapabilityIntent,
};
