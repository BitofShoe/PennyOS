const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-storage.js');

test('state snapshot persists expression override metadata alongside mood state', async () => {
  const store = new Map();
  global.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };

  const { saveStateSnapshot, loadStateSnapshot, DEFAULT_MEMORY } = await helpersPromise;
  saveStateSnapshot({
    memory: { ...DEFAULT_MEMORY, userName: 'Malac' },
    messages: [{ role: 'assistant', content: 'hi' }],
    mood: 'smug',
    lastAutoMood: 'thinking',
    expressionOverrideMood: 'smug',
    expressionDecision: {
      version: 'penny-expression-decision.v1',
      mood: 'smug',
      decisionSource: 'manual-override',
      decisionReason: 'Manual override pinned Penny to smug.',
      manualOverride: 'smug',
      persistedMood: 'smug',
    },
    turns: 3,
  });

  const snapshot = loadStateSnapshot();
  assert.equal(snapshot.memory.userName, 'Malac');
  assert.equal(snapshot.mood, 'smug');
  assert.equal(snapshot.lastAutoMood, 'thinking');
  assert.equal(snapshot.expressionOverrideMood, 'smug');
  assert.equal(snapshot.expressionDecision.decisionSource, 'manual-override');
  assert.equal(snapshot.turns, 3);

  delete global.localStorage;
});
