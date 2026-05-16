/**
 * Composer QA round: models, calm variants, emoji bubbles, sprite 404s, layout screenshots.
 *
 *   node qa-composer-round.mjs
 *
 * Requires: http://localhost:4317 (npm start). Uses ./.qa-pw for Playwright.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PW_DIR = path.join(__dirname, '.qa-pw');
const PW_PKG = path.join(PW_DIR, 'package.json');
const PW_READY = path.join(PW_DIR, 'node_modules', 'playwright', 'package.json');
const BASE = process.env.PENNY_QA_BASE || 'http://localhost:4317/';
const OUT = path.join(__dirname, 'qa-composer-visual');

const SPRITES = [
  '/sprites/penny-mood-calm.png',
  '/sprites/penny-mood-calm-2.png',
  '/sprites/penny-mood-happy.png',
  '/sprites/penny-mood-happy-2.png',
  '/sprites/penny-mood-excited.png',
  '/sprites/penny-mood-excited-2.png',
  '/sprites/penny-mood-thinking.png',
  '/sprites/penny-mood-thinking-2.png',
  '/sprites/penny-mood-surprised.png',
  '/sprites/penny-mood-surprised-2.png',
];

function ensurePlaywright() {
  if (fs.existsSync(PW_READY)) return;
  fs.mkdirSync(PW_DIR, { recursive: true });
  if (!fs.existsSync(PW_PKG)) {
    fs.writeFileSync(
      PW_PKG,
      JSON.stringify(
        { name: 'qa-pw', private: true, dependencies: { playwright: '1.49.1' } },
        null,
        2
      )
    );
  }
  execSync('npm install --omit=dev', { cwd: PW_DIR, stdio: 'inherit' });
}

function loadChromium() {
  const require = createRequire(PW_PKG);
  return require('playwright');
}

async function fetchStatus(base) {
  const u = new URL('/api/penny/lmstudio/status', base);
  const r = await fetch(u);
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, data: await r.json() };
}

async function headOk(base, pathStr) {
  const u = new URL(pathStr, base);
  const r = await fetch(u, { method: 'HEAD' });
  if (r.status === 405 || r.status === 501) {
    const g = await fetch(u, { method: 'GET' });
    return g.ok;
  }
  return r.ok;
}

async function main() {
  ensurePlaywright();
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const failures = [];
  const notes = [];

  for (const p of SPRITES) {
    const ok = await headOk(BASE, p);
    if (!ok) failures.push(`404 or failed: ${p}`);
  }
  if (!SPRITES.some((p) => failures.some((f) => f.includes(p)))) {
    console.log('OK all 10 sprite URLs respond.');
  }

  const st = await fetchStatus(BASE);
  if (!st.ok) {
    notes.push(`LM Studio status HTTP ${st.status} — model selector checks may be limited.`);
  } else {
    const models = (st.data.availableModels || []).filter((id) => !/\b(embed|embedding|rerank)\b/i.test(id));
    console.log(`LM Studio status: ${models.length} chat model(s) advertised.`);
    if (!models.length) notes.push('No chat models in status — selector may show "no models loaded".');
  }

  const { chromium } = loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1200);

  try {
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('#modelSelect');
        if (!sel) return false;
        const t = sel.textContent || '';
        if (/loading models/i.test(t)) return false;
        return sel.querySelectorAll('option').length > 0;
      },
      { timeout: 15_000 }
    );
  } catch {
    notes.push('modelSelect did not leave "loading" within 15s — LM Studio may be offline.');
  }

  const modelInfo = await page.evaluate(() => {
    const sel = document.querySelector('#modelSelect');
    const opts = sel
      ? Array.from(sel.querySelectorAll('option')).map((o) => ({
          v: o.value,
          t: o.textContent?.trim(),
        }))
      : [];
    return { optionCount: opts.length, options: opts, selected: sel?.value || '' };
  });

  if (modelInfo.optionCount === 0) failures.push('modelSelect has no options after load.');
  else {
    const nonempty = modelInfo.options.filter((o) => o.v);
    console.log(`OK model selector: ${nonempty.length} option(s). Example: ${nonempty[0]?.v || 'n/a'}`);
    if (nonempty.length >= 2) {
      const pick = nonempty.find((o) => o.v !== modelInfo.selected) || nonempty[1];
      await page.evaluate((modelId) => {
        const s = document.querySelector('#modelSelect');
        if (!s) return;
        s.value = modelId;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }, pick.v);
      await page.waitForTimeout(1200);
      const resolved = await page.textContent('#backendModel');
      console.log(`OK model switch POST -> active "${pick.v}", resolved label: ${resolved?.trim()}`);
    } else {
      notes.push('Only one (or zero) model id — could not verify switching between two models.');
    }
  }

  const calmVariants = await page.evaluate(async () => {
    const srcs = [];
    const labels = [];
    for (let i = 0; i < 24; i++) {
      window.__pennyDebug('calm');
      await new Promise((r) => setTimeout(r, 380));
      const img = document.querySelector('.penny-art');
      srcs.push(img?.getAttribute('src') || '');
      labels.push(document.querySelector('.penny-hud-right')?.textContent?.trim() || '');
    }
    return { srcs, labels };
  });

  const uniqueSrc = new Set(calmVariants.srcs);
  const uniqueLabels = new Set(calmVariants.labels);
  console.log(`Calm __pennyDebug x24: ${uniqueSrc.size} unique src, ${uniqueLabels.size} unique HUD labels.`);
  if (uniqueSrc.size < 2) {
    failures.push(
      'Expected random calm variants: fewer than 2 distinct image src over 24 __pennyDebug("calm") calls.'
    );
  }

  const emojiOk = await page.evaluate(() => {
    if (typeof state === 'undefined' || typeof renderMessages !== 'function') {
      return { ok: false, reason: 'state/renderMessages not in page global scope for this build' };
    }
    const payload = 'Emoji QA \uD83E\uDD73 \u2764\uFE0F \u2728';
    state.messages.push({ role: 'user', content: payload });
    renderMessages();
    const last = document.querySelector('#chat .bubble.user:last-of-type');
    const text = last?.textContent || '';
    const ok =
      text.includes('\uD83E\uDD73') && text.includes('\u2764\uFE0F') && text.includes('\u2728');
    return { ok, text };
  });

  if (!emojiOk.ok) {
    failures.push(`Emoji in chat bubble: ${emojiOk.reason || `missing in DOM, got: ${JSON.stringify(emojiOk.text)}`}`);
  } else {
    console.log('OK emoji preserved in user bubble after renderMessages.');
  }

  const posByMood = await page.evaluate(async () => {
    const moods = ['calm', 'happy', 'excited', 'thinking', 'surprised'];
    const out = {};
    for (const m of moods) {
      window.__pennyDebug(m);
      await new Promise((r) => setTimeout(r, 450));
      out[m] = document.querySelector('.penny-art')?.getAttribute('style') || '';
    }
    return out;
  });
  console.log('object-position samples (inline style on .penny-art):');
  for (const [m, s] of Object.entries(posByMood)) console.log(`  ${m}: ${s}`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.click('#emojiBtn');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'desktop-emoji-open.png'), fullPage: true });

  await page.setViewportSize({ width: 420, height: 780 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.click('#emojiBtn');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'narrow-emoji-open.png'), fullPage: true });

  await browser.close();

  console.log(`Screenshots: ${OUT}/desktop-emoji-open.png, narrow-emoji-open.png`);

  if (notes.length) {
    console.log('\nNotes:');
    notes.forEach((n) => console.log(` - ${n}`));
  }
  if (failures.length) {
    console.error('\nFAILURES:');
    failures.forEach((f) => console.error(' -', f));
    process.exit(1);
  }
  console.log('\nqa-composer-round: all automated checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
