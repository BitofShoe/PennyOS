/**
 * Penny sprite transition capture (Playwright + window.__pennyDebug).
 *
 * Run from repo root (no playwright in root package.json):
 *   node qa-transition.mjs
 *
 * First run creates ./.qa-pw/ with a local playwright@1.49.1 install (gitignored),
 * then launches Chromium against http://localhost:4317.
 *
 * Env (optional):
 *   PENNY_QA_BASE       — default http://localhost:4317/
 *   PENNY_QA_SETTLE_MS  — ms after last __pennyDebug before final frame (default 350)
 *
 * Output: ./qa-transitions/*.png (gitignored)
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

const OUT_DIR = path.join(__dirname, 'qa-transitions');
const BASE = process.env.PENNY_QA_BASE || 'http://localhost:4317/';
const SETTLE_MS = Number(process.env.PENNY_QA_SETTLE_MS || 350);

const scenarios = [
  {
    id: 'calm0-calm3',
    note: 'calm t=0 → calm t=3 (1.28 → 2.36 scale)',
    steps: [
      ['calm', 0],
      ['calm', 3],
    ],
  },
  {
    id: 'calm0-surprised3',
    note: 'calm t=0 → surprised t=3 (cross-mood + close-up)',
    steps: [
      ['calm', 0],
      ['surprised', 3],
    ],
  },
  {
    id: 'excited3-thinking3',
    note: 'excited t=3 → thinking t=3 (close-up → close-up)',
    steps: [
      ['excited', 3],
      ['thinking', 3],
    ],
  },
];

/** Mid-transition samples after the second __pennyDebug (ms from that call). */
const MID_SAMPLES_MS = [0, 35, 70, 110, 150, 190, 230, 280];

function ensurePlaywright() {
  if (fs.existsSync(PW_READY)) return;
  fs.mkdirSync(PW_DIR, { recursive: true });
  if (!fs.existsSync(PW_PKG)) {
    fs.writeFileSync(
      PW_PKG,
      JSON.stringify(
        {
          name: 'qa-pw',
          private: true,
          dependencies: { playwright: '1.49.1' },
        },
        null,
        2
      )
    );
  }
  execSync('npm install --omit=dev', { cwd: PW_DIR, stdio: 'inherit' });
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function loadChromium() {
  const require = createRequire(PW_PKG);
  return require('playwright');
}

/**
 * @param {import('playwright').Page} page
 * @param {string} mood
 * @param {number} turns
 */
async function pennyDebug(page, mood, turns) {
  await page.evaluate(
    ([m, t]) => {
      window.__pennyDebug(m, t);
    },
    [mood, turns]
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {{ id: string, steps: [string, number][] }} scenario
 */
async function runScenario(page, scenario) {
  const { id, steps } = scenario;
  const [a, b] = steps;

  await pennyDebug(page, ...a);
  await page.waitForTimeout(SETTLE_MS);

  await pennyDebug(page, ...b);

  let elapsed = 0;
  for (let i = 0; i < MID_SAMPLES_MS.length; i++) {
    const target = MID_SAMPLES_MS[i];
    const delta = target - elapsed;
    if (delta > 0) await page.waitForTimeout(delta);
    elapsed = target;
    const tag = String(target).padStart(3, '0');
    await page.screenshot({
      path: path.join(OUT_DIR, `${id}-during-${tag}ms.png`),
    });
  }

  const remaining = SETTLE_MS - elapsed;
  if (remaining > 0) await page.waitForTimeout(remaining);
  await page.screenshot({
    path: path.join(OUT_DIR, `${id}-settled-${SETTLE_MS}ms.png`),
  });
}

async function main() {
  ensurePlaywright();
  ensureOutDir();

  const { chromium } = loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(600);

  const hookOk = await page.evaluate(() => typeof window.__pennyDebug === 'function');
  if (!hookOk) {
    await browser.close();
    throw new Error(
      'window.__pennyDebug not found — load /app.js from this prototype (same origin as PENNY_QA_BASE).'
    );
  }

  for (const sc of scenarios) {
    console.log(`\n=== ${sc.id}: ${sc.note} ===`);
    await runScenario(page, sc);
    console.log(`Wrote ${OUT_DIR}/${sc.id}-*.png`);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
