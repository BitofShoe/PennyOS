const WEB_SETTINGS_MANAGED_KEYS = Object.freeze([
  'PENNY_WEB_SEARCH_ENABLED',
  'PENNY_WEB_ANSWER_MODE',
]);

const WEB_ANSWER_MODES = Object.freeze({
  MODEL: 'model',
  DIRECT: 'direct',
});

function normalizeWebAnswerMode(value = '') {
  return String(value || '').trim().toLowerCase() === WEB_ANSWER_MODES.DIRECT
    ? WEB_ANSWER_MODES.DIRECT
    : WEB_ANSWER_MODES.MODEL;
}

function isWebDirectIntent(intent = null) {
  const name = String(intent?.name || '').trim();
  return name === 'search_web' || name === 'read_web_page' || name === 'inspect_web_result';
}

function chooseConfiguredDirectIntent(intent = null, answerMode = WEB_ANSWER_MODES.MODEL) {
  if (normalizeWebAnswerMode(answerMode) === WEB_ANSWER_MODES.MODEL && isWebDirectIntent(intent)) {
    return { ...intent, modelDriven: true };
  }
  return intent;
}

function buildWebSettingsEnvPatch({ enabled = false, answerMode = WEB_ANSWER_MODES.MODEL } = {}) {
  return {
    PENNY_WEB_SEARCH_ENABLED: enabled === true ? '1' : '0',
    PENNY_WEB_ANSWER_MODE: normalizeWebAnswerMode(answerMode),
  };
}

function buildWebSettingsStatus({ env = process.env, pending = null } = {}) {
  return {
    ok: true,
    enabled: String(env.PENNY_WEB_SEARCH_ENABLED || '').trim() === '1',
    answerMode: normalizeWebAnswerMode(env.PENNY_WEB_ANSWER_MODE),
    privateNetworkAllowed: String(env.PENNY_WEB_ALLOW_PRIVATE_NET || '').trim() === '1',
    restartRequired: !!pending,
    pending,
  };
}

module.exports = {
  WEB_ANSWER_MODES,
  WEB_SETTINGS_MANAGED_KEYS,
  buildWebSettingsEnvPatch,
  buildWebSettingsStatus,
  chooseConfiguredDirectIntent,
  isWebDirectIntent,
  normalizeWebAnswerMode,
};
