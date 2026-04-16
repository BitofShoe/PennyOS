const { formatPromptMemories } = require('./penny-memory');

const PROMPT_SLOT_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'voiceBlend',
    label: 'Runtime voice blend',
    assetKey: 'blend',
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
  }),
  Object.freeze({
    id: 'directives',
    label: 'Conversation directives',
    assetKey: 'chatDirectives',
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
  }),
  Object.freeze({
    id: 'overlays',
    label: 'Lane overlays',
    assetKey: 'overlays',
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow']),
  }),
  Object.freeze({
    id: 'examples',
    label: 'Quick voice examples',
    assetKey: 'examples',
    allowedLanes: Object.freeze(['chat', 'shadow']),
  }),
  Object.freeze({
    id: 'memory',
    label: 'Memory',
    assetKey: 'memory',
    allowedLanes: Object.freeze(['chat', 'tool', 'shadow', 'semantic-render']),
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
    allowedLanes: slot.allowedLanes,
    enabled: slot.allowedLanes.includes(normalizedLane),
  }));
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
} = {}) {
  const overlays = resolvePromptOverlays(assets.overlays || [], {
    lane,
    mode,
    attachmentType,
    sceneFamily,
  });
  const slotRegistry = resolvePromptSlotRegistry(lane);
  const blocks = slotRegistry.reduce((acc, slot) => {
    if (!slot.enabled) return acc;
    if (slot.id === 'voiceBlend') {
      const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
      if (block) acc.push(block);
      return acc;
    }
    if (slot.id === 'directives') {
      if (includeChatDirectives) {
        const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
        if (block) acc.push(block);
      }
      return acc;
    }
    if (slot.id === 'overlays') {
      if (overlays.length) {
        acc.push(`${slot.label}:\n${overlays.map((overlay) => `- ${overlay.text}`).join('\n')}`);
      }
      return acc;
    }
    if (slot.id === 'examples') {
      if (includeExamples) {
        const block = formatPromptAssetBlock(slot.label, assets[slot.assetKey]);
        if (block) acc.push(block);
      }
      return acc;
    }
    return acc;
  }, []);

  return {
    stack: blocks.filter(Boolean).join('\n\n'),
    memoryBlock: formatPromptMemories(memories, userText, memoryLimit, fallbackMemory),
    overlays,
    slots: slotRegistry,
  };
}

module.exports = {
  PROMPT_SLOT_REGISTRY,
  normalizePromptAssetText,
  formatPromptAssetBlock,
  resolvePromptSlotRegistry,
  resolvePromptOverlays,
  buildPromptStack,
};
