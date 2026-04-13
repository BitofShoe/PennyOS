function createLocalLaneApi({
  shouldOfferLocalTools,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
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

  function selectLocalLane({ userText = '', image = null, file = null } = {}) {
    const text = String(userText || '').trim();
    if (image) {
      return {
        localLane: 'chat',
        directIntent: null,
        forceToolLoop: false,
        needsTools: false,
        reason: 'image-chat',
      };
    }

    const directIntent = resolveDirectToolIntent(text);
    const forceToolLoop = shouldForceLocalToolLoop(text);
    const needsTools = !!(file || forceToolLoop || shouldOfferLocalTools(text));
    const localLane = directIntent || needsTools ? 'tool' : 'chat';
    let reason = 'companion-chat';
    if (directIntent) reason = `direct:${directIntent.name || 'tool'}`;
    else if (file) reason = 'attached-file';
    else if (forceToolLoop) reason = 'forced-tool-loop';
    else if (needsTools) reason = 'tool-offer';

    return {
      localLane,
      directIntent,
      forceToolLoop,
      needsTools,
      reason,
    };
  }

  return {
    selectLocalLane,
  };
}

module.exports = {
  createLocalLaneApi,
};
