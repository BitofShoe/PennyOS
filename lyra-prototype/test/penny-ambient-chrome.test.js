const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-ambient-chrome.mjs');

function createClassList() {
  const classes = new Set();
  return {
    add(...items) { for (const item of items) classes.add(item); },
    remove(...items) { for (const item of items) classes.delete(item); },
    has(item) { return classes.has(item); },
  };
}

test('buildEmojiSet returns pictographic emoji and skips flags', async () => {
  const { buildEmojiSet } = await helpersPromise;
  const set = buildEmojiSet();

  assert.ok(set.includes('✨'));
  assert.ok(set.includes('⚡'));
  assert.ok(!set.some((item) => item === '🇺🇸'));
});

test('createAmbientChromeRuntime wires the emoji picker and particle burst contract', async () => {
  const { createAmbientChromeRuntime } = await helpersPromise;

  const listeners = {};
  const documentRef = {
    addEventListener(type, handler) {
      listeners[`document:${type}`] = handler;
    },
    removeEventListener(type) {
      delete listeners[`document:${type}`];
    },
  };
  const composerEl = {
    value: 'hello',
    selectionStart: 5,
    selectionEnd: 5,
    focusCalled: false,
    focus() { this.focusCalled = true; },
  };
  const emojiPickerEl = {
    hidden: true,
    classList: createClassList(),
    addEventListener(type, handler) {
      listeners[`picker:${type}`] = handler;
    },
    removeEventListener(type) {
      delete listeners[`picker:${type}`];
    },
  };
  const emojiGridEl = {
    innerHTML: '',
    addEventListener(type, handler) {
      listeners[`grid:${type}`] = handler;
    },
    removeEventListener(type) {
      delete listeners[`grid:${type}`];
    },
  };
  const emojiBtnEl = {
    addEventListener(type, handler) {
      listeners[`btn:${type}`] = handler;
    },
    removeEventListener(type) {
      delete listeners[`btn:${type}`];
    },
  };
  const bootOverlayEl = {
    classList: createClassList(),
    removed: false,
    remove() { this.removed = true; },
  };
  const coreEl = {
    classList: createClassList(),
    querySelector() {
      return { style: {} };
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 200, height: 200 };
    },
  };
  const particleCanvasEl = {
    parentElement: {
      getBoundingClientRect() {
        return { width: 200, height: 120 };
      },
    },
    getContext() {
      return {
        scale() {},
        clearRect() {},
        beginPath() {},
        arc() {},
        fill() {},
        set globalAlpha(value) { this._alpha = value; },
        set fillStyle(value) { this._fillStyle = value; },
      };
    },
    width: 0,
    height: 0,
  };
  const windowRef = {
    devicePixelRatio: 1,
    requestAnimationFrame(fn) {
      this._raf = fn;
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout(fn) {
      fn();
      return 1;
    },
    setInterval(fn) {
      this._interval = fn;
      return 1;
    },
    addEventListener(type, handler) {
      listeners[`window:${type}`] = handler;
    },
    removeEventListener(type) {
      delete listeners[`window:${type}`];
    },
  };

  const runtime = createAmbientChromeRuntime({
    windowRef,
    documentRef,
    composerEl,
    emojiBtnEl,
    emojiPickerEl,
    emojiGridEl,
    bootOverlayEl,
    coreEl,
    particleCanvasEl,
    randomFn: () => 0.1,
    scaleFn: () => 1.3,
    moodPaletteFn: () => ({ primary: '#123456' }),
  });

  assert.ok(emojiGridEl.innerHTML.includes('emoji-item'));
  assert.equal(typeof runtime.particleBurst, 'function');

  listeners['btn:click']({ stopPropagation() {} });
  assert.equal(emojiPickerEl.hidden, false);

  listeners['grid:click']({
    target: {
      closest() {
        return { textContent: '✨' };
      },
    },
  });
  assert.equal(composerEl.value, 'hello✨');
  assert.equal(composerEl.focusCalled, true);
  assert.equal(emojiPickerEl.hidden, true);

  assert.equal(bootOverlayEl.classList.has('done'), true);
  assert.equal(bootOverlayEl.removed, true);
});

test('createAmbientChromeRuntime autosizes the composer textarea', async () => {
  const { createAmbientChromeRuntime } = await helpersPromise;
  const listeners = {};
  const composerEl = {
    style: {},
    scrollHeight: 88,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
  };
  const windowRef = {
    requestAnimationFrame(fn) {
      fn();
      return 1;
    },
  };

  const runtime = createAmbientChromeRuntime({
    windowRef,
    documentRef: {},
    composerEl,
  });

  assert.equal(composerEl.style.height, '88px');
  assert.equal(typeof runtime.syncComposerSize, 'function');

  composerEl.scrollHeight = 132;
  listeners.input();
  assert.equal(composerEl.style.height, '132px');
});
