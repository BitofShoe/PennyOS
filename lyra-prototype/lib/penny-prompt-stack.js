const { buildPromptMemoryContext } = require('./penny-memory');

const PROMPT_SLOT_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'voiceBlend',
    label: 'Runtime voice blend',
    assetKey: 'blend',
    owner: 'voice-runtime',
    precedence: 10,
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
    emptyBehavior: 'omit',
    holdbackBehavior: 'not-applicable',
    renderTarget: 'stack',
  }),
  Object.freeze({
    id: 'directives',
    label: 'Conversation directives',
    assetKey: 'chatDirectives',
    owner: 'conversation-policy',
    precedence: 20,
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
    emptyBehavior: 'omit',
    holdbackBehavior: 'policy-holdback',
    renderTarget: 'stack',
  }),
  Object.freeze({
    id: 'overlays',
    label: 'Lane overlays',
    assetKey: 'overlays',
    owner: 'lane-policy',
    precedence: 30,
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow']),
    emptyBehavior: 'no-op',
    holdbackBehavior: 'lane-gated',
    renderTarget: 'stack',
  }),
  Object.freeze({
    id: 'examples',
    label: 'Quick voice examples',
    assetKey: 'examples',
    owner: 'voice-examples',
    precedence: 40,
    allowedLanes: Object.freeze(['chat', 'shadow']),
    emptyBehavior: 'omit',
    holdbackBehavior: 'budget-holdback',
    renderTarget: 'stack',
  }),
  Object.freeze({
    id: 'memory',
    label: 'Memory',
    assetKey: 'memory',
    owner: 'memory-runtime',
    precedence: 50,
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
    emptyBehavior: 'fallback-block',
    holdbackBehavior: 'not-applicable',
    renderTarget: 'memory-block',
  }),
]);

function normalizePromptAssetText(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').trim();
}

function formatPromptAssetBlock(label, text = '') {
  const normalized = normalizePromptAssetText(text);
  return normalized ? `${label}:\n${normalized}` : '';
}

function normalizeLane(lane = 'chat') {
  return String(lane || 'chat').trim().toLowerCase();
}

function normalizeOverlay(raw = {}) {
  const text = normalizePromptAssetText(raw.text);
  if (!text) return null;
  const appliesTo = raw.appliesTo && typeof raw.appliesTo === 'object' ? raw.appliesTo : {};
  return {
    id: String(raw.id || '').trim() || `overlay-${Math.random().toString(36).slice(2, 10)}`,
    slot: String(raw.slot || 'lane-overlay').trim() || 'lane-overlay',
    enabled: raw.enabled !== false,
    text,
    appliesTo: {
      lane: Array.isArray(appliesTo.lane) ? appliesTo.lane.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).slice(0, 4) : [],
      mode: Array.isArray(appliesTo.mode) ? appliesTo.mode.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).slice(0, 4) : [],
      attachmentType: Array.isArray(appliesTo.attachmentType) ? appliesTo.attachmentType.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).slice(0, 4) : [],
      sceneFamily: Array.isArray(appliesTo.sceneFamily) ? appliesTo.sceneFamily.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).slice(0, 4) : [],
    },
  };
}

function resolvePromptSlotRegistry(lane = 'chat') {
  const normalizedLane = normalizeLane(lane);
  return PROMPT_SLOT_REGISTRY.map((slot) => ({
    id: slot.id,
    label: slot.label,
    assetKey: slot.assetKey,
    owner: slot.owner,
    precedence: slot.precedence,
    allowedLanes: slot.allowedLanes,
    emptyBehavior: slot.emptyBehavior,
    holdbackBehavior: slot.holdbackBehavior,
    renderTarget: slot.renderTarget,
    enabled: slot.allowedLanes.includes(normalizedLane),
  }));
}

function normalizePromptSlotSummary(raw = {}, defaults = {}) {
  const value = {
    ...(defaults && typeof defaults === 'object' ? defaults : {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
  const slotOrder = Array.isArray(value.slotOrder)
    ? value.slotOrder.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
    : [];
  const slots = Array.isArray(value.slots)
    ? value.slots.map((slot) => ({
        id: String(slot?.id || '').trim(),
        label: String(slot?.label || slot?.id || '').trim(),
        owner: String(slot?.owner || '').trim(),
        precedence: Number.isFinite(Number(slot?.precedence)) ? Math.max(0, Number(slot.precedence)) : 0,
        eligible: slot?.eligible === true,
        renderTarget: String(slot?.renderTarget || 'stack').trim() || 'stack',
        emptyBehavior: String(slot?.emptyBehavior || 'omit').trim() || 'omit',
        holdbackBehavior: String(slot?.holdbackBehavior || 'not-applicable').trim() || 'not-applicable',
        state: String(slot?.state || '').trim() || 'no-op',
        reason: String(slot?.reason || '').trim(),
      })).filter((slot) => slot.id).slice(0, 12)
    : [];
  return {
    lane: normalizeLane(value.lane || 'chat'),
    mode: String(value.mode || 'local').trim().toLowerCase() || 'local',
    attachmentType: String(value.attachmentType || 'none').trim().toLowerCase() || 'none',
    slotOrder,
    eligibleSlotCount: Math.max(0, Number(value.eligibleSlotCount || 0)),
    filledSlotCount: Math.max(0, Number(value.filledSlotCount || 0)),
    heldBackSlotCount: Math.max(0, Number(value.heldBackSlotCount || 0)),
    noOpSlotCount: Math.max(0, Number(value.noOpSlotCount || 0)),
    overlaysApplied: Math.max(0, Number(value.overlaysApplied || 0)),
    memoryBlockPresent: value.memoryBlockPresent === true,
    slots,
  };
}

function buildPromptCompositionSummary({
  slots = [],
  memoryBlock = '',
  lane = 'chat',
  mode = 'local',
  attachmentType = 'none',
  overlays = [],
  filledSlotIds = [],
  includeChatDirectives = true,
  includeExamples = false,
} = {}) {
  const filledSlotIdSet = new Set(
    Array.isArray(filledSlotIds)
      ? filledSlotIds.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
  );
  const slotSummaries = (Array.isArray(slots) ? slots : []).map((slot) => {
    const base = {
      id: slot.id,
      label: slot.label,
      owner: slot.owner,
      precedence: slot.precedence,
      eligible: slot.enabled === true,
      renderTarget: slot.renderTarget || 'stack',
      emptyBehavior: slot.emptyBehavior || 'omit',
      holdbackBehavior: slot.holdbackBehavior || 'not-applicable',
      state: slot.enabled === true ? 'no-op' : 'ineligible',
      reason: slot.enabled === true ? '' : 'lane-ineligible',
    };
    if (slot.id === 'directives' && slot.enabled && includeChatDirectives !== true) {
      return {
        ...base,
        state: 'held-back',
        reason: 'chat-directives-disabled',
      };
    }
    if (slot.id === 'examples' && slot.enabled && includeExamples !== true) {
      return {
        ...base,
        state: 'held-back',
        reason: 'examples-disabled',
      };
    }
    if (slot.id === 'overlays' && slot.enabled && (!Array.isArray(overlays) || !overlays.length)) {
      return {
        ...base,
        state: 'no-op',
        reason: 'no-overlay-match',
      };
    }
    if (slot.id === 'memory' && slot.enabled) {
      return {
        ...base,
        state: filledSlotIdSet.has(slot.id) ? 'filled' : 'no-op',
        reason: filledSlotIdSet.has(slot.id) ? 'memory-block-assembled' : 'memory-block-empty',
      };
    }
    return {
      ...base,
      state: slot.enabled === true
        ? (filledSlotIdSet.has(slot.id) ? 'filled' : 'no-op')
        : 'ineligible',
      reason: slot.enabled === true
        ? (filledSlotIdSet.has(slot.id) ? 'slot-populated' : 'slot-empty')
        : 'lane-ineligible',
    };
  });
  return normalizePromptSlotSummary({
    lane,
    mode,
    attachmentType,
    slotOrder: slotSummaries.map((slot) => slot.id),
    eligibleSlotCount: slotSummaries.filter((slot) => slot.eligible).length,
    filledSlotCount: slotSummaries.filter((slot) => slot.state === 'filled').length,
    heldBackSlotCount: slotSummaries.filter((slot) => slot.state === 'held-back').length,
    noOpSlotCount: slotSummaries.filter((slot) => slot.state === 'no-op').length,
    overlaysApplied: Array.isArray(overlays) ? overlays.length : 0,
    memoryBlockPresent: String(memoryBlock || '').trim().length > 0,
    slots: slotSummaries,
  });
}

function shouldKeepOverlayForLane(overlay, lane) {
  const normalizedLane = normalizeLane(lane);
  if (normalizedLane === 'semantic-render') return false;
  if (normalizedLane === 'tool' && overlay.appliesTo.sceneFamily.length) return false;
  return true;
}

function resolvePromptOverlays(overlays = [], context = {}) {
  const lane = normalizeLane(context.lane);
  const mode = String(context.mode || 'local').trim().toLowerCase();
  const attachmentType = String(context.attachmentType || 'none').trim().toLowerCase();
  const sceneFamily = String(context.sceneFamily || '').trim().toLowerCase();
  return (Array.isArray(overlays) ? overlays : [])
    .map(normalizeOverlay)
    .filter(Boolean)
    .filter((overlay) => {
      if (!overlay.enabled) return false;
      const lanes = overlay.appliesTo.lane;
      const modes = overlay.appliesTo.mode;
      const attachmentTypes = overlay.appliesTo.attachmentType;
      const sceneFamilies = overlay.appliesTo.sceneFamily;
      if (lanes.length && !lanes.includes(lane)) return false;
      if (modes.length && !modes.includes(mode)) return false;
      if (attachmentTypes.length && !attachmentTypes.includes(attachmentType)) return false;
      if (sceneFamilies.length && !sceneFamilies.includes(sceneFamily)) return false;
      if (!shouldKeepOverlayForLane(overlay, lane)) return false;
      return true;
    });
}

function buildPromptStack({
  assets = {},
  memories = {},
  userText = '',
  lane = 'chat',
  mode = 'local',
  attachmentType = 'none',
  sceneFamily = '',
  includeChatDirectives = true,
  includeExamples = false,
  memoryLimit = 12,
  fallbackMemory = '',
  promptTruthHints = null,
} = {}) {
  const overlays = resolvePromptOverlays(assets.overlays || [], {
    lane,
    mode,
    attachmentType,
    sceneFamily,
  });
  const slotRegistry = resolvePromptSlotRegistry(lane);
  const filledSlotIds = [];
  const blocks = slotRegistry.reduce((acc, slot) => {
    if (!slot.enabled) return acc;
    if (slot.id === 'voiceBlend') {
      const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
      if (block) {
        acc.push(block);
        filledSlotIds.push(slot.id);
      }
      return acc;
    }
    if (slot.id === 'directives') {
      if (includeChatDirectives) {
        const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
        if (block) {
          acc.push(block);
          filledSlotIds.push(slot.id);
        }
      }
      return acc;
    }
    if (slot.id === 'overlays') {
      if (overlays.length) {
        acc.push(`${slot.label}:\n${overlays.map((overlay) => `- ${overlay.text}`).join('\n')}`);
        filledSlotIds.push(slot.id);
      }
      return acc;
    }
    if (slot.id === 'examples') {
      if (includeExamples) {
        const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
        if (block) {
          acc.push(block);
          filledSlotIds.push(slot.id);
        }
      }
      return acc;
    }
    return acc;
  }, []);
  const promptMemoryContext = buildPromptMemoryContext(memories, userText, memoryLimit, fallbackMemory, Date.now(), promptTruthHints);
  const memoryBlock = promptMemoryContext.text;
  const promptTruth = promptMemoryContext.promptTruth;
  if (memoryBlock) filledSlotIds.push('memory');
  const slotSummary = buildPromptCompositionSummary({
    slots: slotRegistry,
    memoryBlock,
    lane,
    mode,
    attachmentType,
    overlays,
    filledSlotIds,
    includeChatDirectives,
    includeExamples,
  });

  return {
    stack: blocks.filter(Boolean).join('\n\n'),
    memoryBlock,
    promptTruth,
    overlays,
    slots: slotRegistry,
    slotSummary,
  };
}

module.exports = {
  PROMPT_SLOT_REGISTRY,
  normalizePromptAssetText,
  formatPromptAssetBlock,
  resolvePromptSlotRegistry,
  resolvePromptOverlays,
  normalizePromptSlotSummary,
  buildPromptCompositionSummary,
  buildPromptStack,
};
