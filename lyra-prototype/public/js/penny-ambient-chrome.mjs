export function isFlagEmoji(text) {
  const cps = [...text].map((ch) => ch.codePointAt(0));
  return cps.length >= 2 && cps.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff);
}

export function buildEmojiSet() {
  const picto = /\p{Extended_Pictographic}/u;
  const out = [];
  const seen = new Set();
  const add = (ch) => {
    if (!ch || seen.has(ch) || isFlagEmoji(ch)) return;
    seen.add(ch);
    out.push(ch);
  };
  const scan = (from, to) => {
    for (let cp = from; cp <= to && out.length < 400; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (cp >= 0x1f1e6 && cp <= 0x1f1ff) continue;
      const ch = String.fromCodePoint(cp);
      if (!picto.test(ch)) continue;
      add(ch);
    }
  };
  scan(0x1f600, 0x1f64f);
  scan(0x1f300, 0x1f5ff);
  scan(0x1f680, 0x1f6ff);
  scan(0x1f900, 0x1f9ff);
  scan(0x1fa70, 0x1faff);
  scan(0x2600, 0x26ff);
  scan(0x2700, 0x27bf);
  ['\u2764\uFE0F', '\u2728', '\u2B50', '\u26A1', '\u231A', '\u231B'].forEach(add);
  return out;
}

function createEmojiPickerRuntime({ composerEl, emojiBtnEl, emojiPickerEl, emojiGridEl, documentRef }) {
  if (!composerEl || !emojiPickerEl || !emojiBtnEl) return {};

  const emojiSet = buildEmojiSet();
  if (emojiGridEl) {
    emojiGridEl.innerHTML = emojiSet.map((emoji) => `<button type="button" class="emoji-item">${emoji}</button>`).join('');
  }

  const insertEmoji = (emoji) => {
    if (!emoji) return;
    const pos = composerEl.selectionStart ?? composerEl.value.length;
    const value = composerEl.value;
    composerEl.value = value.slice(0, pos) + emoji + value.slice(pos);
    composerEl.focus();
    composerEl.selectionStart = composerEl.selectionEnd = pos + emoji.length;
    emojiPickerEl.hidden = true;
  };

  const onGridClick = (event) => {
    const item = event.target.closest('.emoji-item');
    if (!item) return;
    insertEmoji(item.textContent || '');
  };

  const onButtonClick = (event) => {
    event.stopPropagation();
    emojiPickerEl.hidden = !emojiPickerEl.hidden;
  };

  const onDocumentClick = () => {
    emojiPickerEl.hidden = true;
  };

  const onPickerClick = (event) => event.stopPropagation();

  emojiGridEl?.addEventListener('click', onGridClick);
  emojiBtnEl.addEventListener('click', onButtonClick);
  emojiPickerEl.addEventListener('click', onPickerClick);
  documentRef?.addEventListener('click', onDocumentClick);

  return {
    emojiSet,
    insertEmoji,
    destroy() {
      emojiGridEl?.removeEventListener('click', onGridClick);
      emojiBtnEl.removeEventListener('click', onButtonClick);
      emojiPickerEl.removeEventListener('click', onPickerClick);
      documentRef?.removeEventListener('click', onDocumentClick);
    },
  };
}

function createBootOverlayRuntime({ windowRef, bootOverlayEl }) {
  if (!bootOverlayEl) return {};
  const doneTimeoutId = windowRef.setTimeout(() => {
    bootOverlayEl.classList.add('done');
    windowRef.setTimeout(() => bootOverlayEl.remove(), 600);
  }, 1800);
  return { doneTimeoutId };
}

function createIdleChromeRuntime({ windowRef, coreEl, randomFn }) {
  if (!coreEl) return {};

  const timerId = windowRef.setInterval(() => {
    const roll = randomFn();
    if (roll < 0.3) {
      coreEl.classList.add('idle-flicker');
      windowRef.setTimeout(() => coreEl.classList.remove('idle-flicker'), 80);
    } else if (roll < 0.5) {
      coreEl.classList.add('idle-interference');
      windowRef.setTimeout(() => coreEl.classList.remove('idle-interference'), 200);
    }
  }, 4000);

  return { timerId };
}

function createParallaxRuntime({ windowRef, documentRef, coreEl, scaleFn }) {
  if (!coreEl) return {};
  const MAX_SHIFT = 12;

  const onMouseMove = (event) => {
    const display = coreEl.querySelector('.penny-display');
    if (!display) return;
    const rect = coreEl.getBoundingClientRect();
    const width = windowRef.innerWidth || 1;
    const height = windowRef.innerHeight || 1;
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (height / 2);
    const x = Math.max(-1, Math.min(1, dx)) * MAX_SHIFT;
    const y = Math.max(-1, Math.min(1, dy)) * MAX_SHIFT;
    const scale = typeof scaleFn === 'function' ? scaleFn() : 1;
    display.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  documentRef.addEventListener('mousemove', onMouseMove);
  return { onMouseMove };
}

function createParticleRuntime({ canvasEl, windowRef, randomFn, moodPaletteFn }) {
  if (!canvasEl) return { particleBurst: null };

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return { particleBurst: null };

  const particles = [];
  const COUNT = 35;
  let frameId = null;

  function resize() {
    const rect = canvasEl.parentElement?.getBoundingClientRect?.();
    if (!rect) return;
    const dpr = windowRef.devicePixelRatio || 1;
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  function spawn(burst) {
    const rect = canvasEl.parentElement?.getBoundingClientRect?.();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    if (burst) {
      const cx = width / 2;
      const cy = height * 0.4;
      const angle = randomFn() * Math.PI * 2;
      const speed = randomFn() * 1.5 + 0.5;
      return {
        x: cx + (randomFn() - 0.5) * 40,
        y: cy + (randomFn() - 0.5) * 40,
        r: randomFn() * 2.5 + 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        alpha: randomFn() * 0.6 + 0.3,
        life: randomFn() * 60 + 30,
        age: 0,
        burst: true,
      };
    }
    return {
      x: randomFn() * width,
      y: randomFn() * height,
      r: randomFn() * 1.5 + 0.5,
      vx: (randomFn() - 0.5) * 0.15,
      vy: -(randomFn() * 0.2 + 0.05),
      alpha: randomFn() * 0.4 + 0.1,
      life: randomFn() * 400 + 200,
      age: 0,
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(spawn(false));

  function particleBurst(count = 20) {
    const burstCount = Math.max(4, Math.min(48, Math.floor(Number(count) || 20)));
    for (let i = 0; i < burstCount; i++) particles.push(spawn(true));
  }

  function frame() {
    const rect = canvasEl.parentElement?.getBoundingClientRect?.();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    ctx.clearRect(0, 0, width, height);

    const palette = moodPaletteFn?.();
    const color = palette?.primary || '#86a8ff';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.burst) p.vy += 0.02;
      p.age++;

      const progress = p.age / p.life;
      const fadeAlpha = progress < 0.1
        ? progress / 0.1
        : progress > 0.7
          ? (1 - progress) / 0.3
          : 1;
      const a = p.alpha * fadeAlpha;

      if (p.age >= p.life || p.y < -10 || p.x < -10 || p.x > width + 10 || p.y > height + 10) {
        if (p.burst) {
          particles.splice(i, 1);
        } else {
          particles[i] = spawn(false);
          particles[i].y = height + 5;
        }
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frameId = windowRef.requestAnimationFrame(frame);
  }

  resize();
  windowRef.addEventListener('resize', resize);
  frameId = windowRef.requestAnimationFrame(frame);

  return {
    particleBurst,
    destroy() {
      if (frameId !== null && windowRef.cancelAnimationFrame) {
        windowRef.cancelAnimationFrame(frameId);
      }
      windowRef.removeEventListener('resize', resize);
    },
  };
}

export function createAmbientChromeRuntime({
  windowRef,
  documentRef,
  composerEl,
  emojiBtnEl,
  emojiPickerEl,
  emojiGridEl,
  bootOverlayEl,
  coreEl,
  particleCanvasEl,
  randomFn = Math.random,
  scaleFn = () => 1,
  moodPaletteFn = () => null,
}) {
  const emojiPickerRuntime = createEmojiPickerRuntime({
    composerEl,
    emojiBtnEl,
    emojiPickerEl,
    emojiGridEl,
    documentRef,
  });
  createBootOverlayRuntime({ windowRef, bootOverlayEl });
  createIdleChromeRuntime({ windowRef, coreEl, randomFn });
  createParallaxRuntime({ windowRef, documentRef, coreEl, scaleFn });
  const particleRuntime = createParticleRuntime({
    canvasEl: particleCanvasEl,
    windowRef,
    randomFn,
    moodPaletteFn,
  });

  return {
    emojiSet: emojiPickerRuntime.emojiSet || [],
    particleBurst: particleRuntime.particleBurst || null,
  };
}
