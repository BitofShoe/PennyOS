export const STORAGE_KEY = 'penny:v3';

export function createSessionId() {
  return `penny-local-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_MEMORY = {
  memories: [],
  userName: '',
  voiceOn: false,
  brainMode: 'local',
  lmStudioThread: null,
  sessionId: createSessionId(),
};

export function saveStateSnapshot(state) {
  const msgs = state.messages.slice(-16).map((message) => {
    const base = { ...message };
    if (message.image) {
      delete base.image;
      base.hadImage = true;
    }
    if (message.file) {
      base.fileMeta = {
        name: message.file.name,
        size: message.file.size,
        lineCount: message.file.lineCount,
      };
      delete base.file;
    }
    return base;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    memory: state.memory,
    messages: msgs,
    mood: state.mood,
    lastAutoMood: state.lastAutoMood,
    expressionOverrideMood: state.expressionOverrideMood || '',
    expressionDecision: state.expressionDecision || null,
    turns: state.turns,
  }));
}

export function loadStateSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const memory = { ...structuredClone(DEFAULT_MEMORY), ...(parsed.memory || {}) };
    if (memory.brainMode !== 'local' && memory.brainMode !== 'shadow') memory.brainMode = 'local';
    return {
      memory,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      mood: parsed.mood,
      lastAutoMood: parsed.lastAutoMood,
      expressionOverrideMood: parsed.expressionOverrideMood,
      expressionDecision: parsed.expressionDecision,
      turns: Number(parsed.turns || 0),
    };
  } catch {
    return null;
  }
}

export function buildChatMemoryPayload(memory = {}) {
  return {
    userName: memory.userName || '',
    voiceOn: !!memory.voiceOn,
    brainMode: memory.brainMode === 'shadow' ? 'shadow' : 'local',
  };
}
