/**
 * Automated mood / chamber QA (raster sprites, HUD, glow, crossfade, debug URL).
 *
 *   node qa-mood-audit.mjs
 *
 * Requires: npm start (http://localhost:4317), same .qa-pw bootstrap as qa-transition.mjs
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

const MOODS = ['calm', 'happy', 'excited', 'thinking', 'surprised'];

const EXPECTED_HUD = {
  calm: 'ONLINE',
  happy: 'CHARM MODE',
  excited: 'MAX HYPE',
  thinking: 'LOCKED IN',
  surprised: 'FLUSTERED',
};

/** Must match MOODS[].glow in public/app.js (spacing-sensitive). */
const EXPECTED_GLOW_PREFIX = {
  calm: 'rgba(125,211,252',
  happy: 'rgba(134,239,172',
  excited: 'rgba(252,211,77',
  thinking: 'rgba(216,180,254',
  surprised: 'rgba(249,168,212',
};

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

async function readChamberState(page) {
  return page.evaluate(() => {
    const shell = document.getElementById('shell');
    const root = document.documentElement;
    const img = document.querySelector('image.avatar-character-img');
    const href = img ? img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') : null;
    const htmlImg = /** @type {SVGImageElement | null} */ (img);
    let bbox = { width: 0, height: 0 };
    if (htmlImg) {
      try {
        bbox = htmlImg.getBBox();
      } catch {
        /* ignore */
      }
    }
    const hudEls = Array.from(document.querySelectorAll('.avatar-hud-text'));
    const hudRight = hudEls.find((el) => el.classList.contains('right'));
    const hudSub = document.querySelector('.avatar-hud-sub');
    const hasVectorCharacter = !!document.querySelector('.avatar-character');
    const pathInClip = document.querySelectorAll('g[clip-path] path').length;
    return {
      shellMood: shell?.dataset?.mood || '',
      glow: root.style.getPropertyValue('--glow').trim() || getComputedStyle(root).getPropertyValue('--glow').trim(),
      primary: root.style.getPropertyValue('--primary').trim() || getComputedStyle(root).getPropertyValue('--primary').trim(),
      hudRight: (hudRight?.textContent || '').trim(),
      hudSub: (hudSub?.textContent || '').trim(),
      imgHref: href || '',
      imgNaturalWidth: htmlImg?.naturalWidth ?? 0,
      imgNaturalHeight: htmlImg?.naturalHeight ?? 0,
      imgBBoxW: bbox.width,
      imgBBoxH: bbox.height,
      hasRasterImage: !!img,
      hasVectorCharacterGroup: hasVectorCharacter,
      clipPathPathCount: pathInClip,
      faceOpacity: parseFloat(getComputedStyle(document.getElementById('coreFace') || document.body).opacity),
    };
  });
}

async function main() {
  ensurePlaywright();
  const { chromium } = loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const failures = [];

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(500);

  if (!(await page.evaluate(() => typeof window.__pennyDebug === 'function'))) {
    failures.push('window.__pennyDebug is missing');
  }

  for (const mood of MOODS) {
    await page.evaluate((m) => window.__pennyDebug(m), mood);
    await page.waitForFunction(
      (expected) => {
        const img = document.querySelector('image.avatar-character-img');
        if (!img) return false;
        const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
        if (!href.includes(`penny-mood-${expected}.png`)) return false;
        const sub = document.querySelector('.avatar-hud-sub')?.textContent || '';
        if (!sub.toUpperCase().includes(`CHARACTER LINK / ${String(expected).toUpperCase()}`)) return false;
        return true;
      },
      mood,
      { timeout: 8000 }
    );

    const s = await readChamberState(page);
    const linkOk = s.hudSub.toUpperCase().includes(`CHARACTER LINK / ${mood.toUpperCase()}`);

    if (s.shellMood !== mood) failures.push(`[${mood}] shell data-mood: got ${s.shellMood}`);
    if (s.hudRight !== EXPECTED_HUD[mood]) failures.push(`[${mood}] HUD right: expected "${EXPECTED_HUD[mood]}", got "${s.hudRight}"`);
    if (!linkOk) failures.push(`[${mood}] HUD sub link line wrong: "${s.hudSub}"`);
    if (!s.glow.startsWith(EXPECTED_GLOW_PREFIX[mood])) {
      failures.push(`[${mood}] --glow: expected prefix ${EXPECTED_GLOW_PREFIX[mood]}, got "${s.glow}"`);
    }
    if (!s.hasRasterImage) failures.push(`[${mood}] missing <image class="avatar-character-img">`);
    if (s.hasVectorCharacterGroup) failures.push(`[${mood}] legacy .avatar-character group still present (expected raster only)`);
    if (!s.imgHref.includes(`penny-mood-${mood}.png`)) failures.push(`[${mood}] image href wrong: ${s.imgHref}`);
    const rasterOk =
      (s.imgNaturalWidth >= 32 && s.imgNaturalHeight >= 32) ||
      (s.imgBBoxW >= 32 && s.imgBBoxH >= 32);
    if (!rasterOk) {
      failures.push(
        `[${mood}] raster not visible (natural ${s.imgNaturalWidth}x${s.imgNaturalHeight}, bbox ${s.imgBBoxW}x${s.imgBBoxH})`
      );
    }

    console.log(
      `OK mood=${mood} hud=${s.hudRight} glow=${s.glow.slice(0, 28)}… natural=${s.imgNaturalWidth}x${s.imgNaturalHeight} bbox=${s.imgBBoxW}x${s.imgBBoxH}`
    );
  }

  await page.evaluate(() => window.__pennyDebug('calm'));
  await page.waitForTimeout(350);
  const crossfade = await page.evaluate(() => {
    return new Promise((resolve) => {
      const el = document.getElementById('coreFace');
      if (!el) {
        resolve({ error: 'no coreFace' });
        return;
      }
      const samples = [];
      window.__pennyDebug('surprised');
      const t0 = performance.now();
      function sample() {
        const t = performance.now() - t0;
        samples.push({ t, o: parseFloat(getComputedStyle(el).opacity) });
        if (t < 450) requestAnimationFrame(sample);
        else resolve({ samples });
      }
      requestAnimationFrame(sample);
    });
  });

  if (crossfade.error) failures.push(`crossfade: ${crossfade.error}`);
  else {
    const minO = Math.min(...crossfade.samples.map((x) => x.o));
    const maxO = Math.max(...crossfade.samples.map((x) => x.o));
    if (minO > 0.25) failures.push(`crossfade: opacity did not dip (min=${minO})`);
    if (maxO < 0.99) failures.push(`crossfade: opacity did not return to ~1 (max=${maxO})`);
    console.log(`OK crossfade calm→surprised: opacity min=${minO.toFixed(3)} max=${maxO.toFixed(3)}`);
  }

  const debugPage = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await debugPage.goto(new URL('/?debugMood=happy&debugTurns=2', BASE).href, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await debugPage.waitForTimeout(600);
  const dbg = await debugPage.evaluate(() => ({
    turns: document.getElementById('turnsValue')?.textContent,
    shell: document.getElementById('shell')?.dataset?.mood,
    hud: document.querySelector('.avatar-hud-text.right')?.textContent?.trim(),
  }));
  if (dbg.shell !== 'happy') failures.push(`debug URL: expected shell happy, got ${dbg.shell}`);
  if (dbg.hud !== EXPECTED_HUD.happy) failures.push(`debug URL: HUD ${dbg.hud}`);
  if (dbg.turns !== '2') failures.push(`debug URL: turnsValue expected2, got ${dbg.turns}`);
  console.log(`OK ?debugMood=happy&debugTurns=2 → shell=${dbg.shell} turns=${dbg.turns} hud=${dbg.hud}`);
  await debugPage.close();

  await browser.close();

  if (failures.length) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }
  console.log('\nAll mood audit checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
