/**
 * @typedef {'image_chat' | 'direct_intent' | 'attached_file' | 'forced_tool_loop' | 'tool_offer' | 'companion_chat'} LocalLaneReasonCode
 *
 * @typedef {Object} LaneSelectionResult
 * @property {'chat' | 'tool'} localLane
 * @property {Object|null} directIntent
 * @property {boolean} forceToolLoop
 * @property {boolean} needsTools
 * @property {string} reason
 * @property {LocalLaneReasonCode} reasonCode
 */
const LOCAL_LANE_REASON_CODES = Object.freeze({
  IMAGE_CHAT: 'image_chat',
  DIRECT_INTENT: 'direct_intent',
  ATTACHED_FILE: 'attached_file',
  FORCED_TOOL_LOOP: 'forced_tool_loop',
  TOOL_OFFER: 'tool_offer',
  COMPANION_CHAT: 'companion_chat',
});

function createLocalLaneApi({
  shouldOfferLocalTools,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
  resolveAttachedFileIntent = null,
} = {}) {
  if (typeof shouldOfferLocalTools !== 'function') {
    throw new TypeError('createLocalLaneApi requires shouldOfferLocalTools');
  }
  if (typeof shouldForceLocalToolLoop !== 'function') {
    throw new TypeError('createLocalLaneApi requires shouldForceLocalToolLoop');
  }
  if (typeof resolveDirectToolIntent !== 'function') {
    throw new TypeError('createLocalLaneApi requires resolveDirectToolIntent');
  }
  if (resolveAttachedFileIntent != null && typeof resolveAttachedFileIntent !== 'function') {
    throw new TypeError('createLocalLaneApi requires resolveAttachedFileIntent to be a function when provided');
  }

  function selectLocalLane({ userText = '', image = null, file = null } = {}) {
    const text = String(userText || '').trim();
    if (image) {
      return {
        localLane: 'chat',
        directIntent: null,
        forceToolLoop: false,
        needsTools: false,
        reason: 'image-chat',
        reasonCode: LOCAL_LANE_REASON_CODES.IMAGE_CHAT,
      };
    }

    const directIntent = resolveDirectToolIntent(text)
      || (typeof resolveAttachedFileIntent === 'function' ? resolveAttachedFileIntent(text, file) : null);
    const forceToolLoop = shouldForceLocalToolLoop(text);
    const needsTools = !!(directIntent || forceToolLoop || shouldOfferLocalTools(text));
    const localLane = directIntent || needsTools ? 'tool' : 'chat';
    let reason = 'companion-chat';
    let reasonCode = LOCAL_LANE_REASON_CODES.COMPANION_CHAT;
    if (directIntent) reason = `direct:${directIntent.name || 'tool'}`;
    if (directIntent) reasonCode = LOCAL_LANE_REASON_CODES.DIRECT_INTENT;
    else if (file) {
      reason = 'attached-file';
      reasonCode = LOCAL_LANE_REASON_CODES.ATTACHED_FILE;
    } else if (forceToolLoop) {
      reason = 'forced-tool-loop';
      reasonCode = LOCAL_LANE_REASON_CODES.FORCED_TOOL_LOOP;
    } else if (needsTools) {
      reason = 'tool-offer';
      reasonCode = LOCAL_LANE_REASON_CODES.TOOL_OFFER;
    }

    return {
      localLane,
      directIntent,
      forceToolLoop,
      needsTools,
      reason,
      reasonCode,
    };
  }

  return {
    LOCAL_LANE_REASON_CODES,
    selectLocalLane,
  };
}

module.exports = {
  createLocalLaneApi,
  LOCAL_LANE_REASON_CODES,
};
