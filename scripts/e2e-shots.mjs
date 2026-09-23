// Headless flow screenshots + console error check (playwright-core from _night/tools).
// usage: node scripts/e2e-shots.mjs <outDir> [--base=http://localhost:5177/spojovacka/] [--only=name]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'AI/garon92-pages/_night/tools/node_modules/playwright-core'));

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'shots';
const base = args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:5177/spojovacka/';
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
fs.mkdirSync(out, { recursive: true });

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function ctxFor(kind, dark) {
  const mobile = kind === 'mobile';
  const viewport = mobile ? { width: 390, height: 844 } : kind === 'tablet' ? { width: 820, height: 1180 } : kind === 'landscape' ? { width: 844, height: 390 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile || kind === 'landscape', hasTouch: mobile || kind === 'landscape', colorScheme: dark ? 'dark' : 'light', locale: 'cs-CZ' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${kind}${dark ? '-dark' : ''}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${kind}${dark ? '-dark' : ''}] pageerror ${e.message}`));
  return { ctx, page };
}

const wait = (p, ms) => p.waitForTimeout(ms);
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });
async function idle(p) {
  await p.waitForFunction(() => !window.__spojovacka.busy(), null, { timeout: 30000 });
}

async function flows(kind, dark) {
  const tag = `${kind}${dark ? '-dark' : ''}`;
  const { ctx, page } = await ctxFor(kind, dark);
  // give some progress so the map looks alive
  await page.goto(base);
  await page.evaluate(() => {
    const lv = {};
    for (let i = 1; i <= 13; i++) lv[i] = { stars: (i % 3) + 1, best: 3000 + i * 250 };
    localStorage.setItem('g92:spojovacka:levels', JSON.stringify(lv));
    localStorage.setItem('g92:spojovacka:coins', '185');
    localStorage.setItem('g92:spojovacka:__version', '2');
  });
  await page.goto(base + '#/');
  await page.reload();
  await wait(page, 900);
  await shot(page, `home-${tag}`);
  await page.goto(base + '#/mapa');
  await wait(page, 700);
  await shot(page, `map-${tag}`);
  await page.goto(base + '#/zviratka');
  await wait(page, 900);
  await shot(page, `pets-${tag}`);
  await page.goto(base + '#/uspechy');
  await wait(page, 600);
  await shot(page, `trophies-${tag}`);
  await page.goto(base + '#/denni');
  await wait(page, 900);
  await shot(page, `daily-intro-${tag}`);
  await page.goto(base + '#/');
  // level with obstacles
  await page.goto(base + '#/uroven/10');
  await wait(page, 900);
  await shot(page, `intro-${tag}`);
  await page.getByRole('button', { name: 'Hrát' }).click();
  await wait(page, 600);
  await shot(page, `level-${tag}`);
  // play a few moves; capture mid-animation
  for (let i = 0; i < 3; i++) {
    const p = page.evaluate(() => window.__spojovacka.botMove());
    await wait(page, 380);
    if (i === 1) await shot(page, `level-mid-${tag}`);
    await p;
    await idle(page);
  }
  await wait(page, 300);
  await shot(page, `level-after-${tag}`);
  // pause overlay
  await page.keyboard.press('p');
  await wait(page, 500);
  await shot(page, `pause-${tag}`);
  await page.keyboard.press('Escape');
  await wait(page, 400);
  // lose → results
  await page.evaluate(() => window.__spojovacka.setMovesLeft(1));
  await page.evaluate(() => window.__spojovacka.botMove());
  await wait(page, 3500);
  await shot(page, `lose-${tag}`);
  // relax mode start
  await page.goto(base + '#/pohoda');
  await wait(page, 900);
  await shot(page, `relax-start-${tag}`);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(page, 700);
  await shot(page, `relax-${tag}`);
  // timed
  await page.goto(base + '#/na-cas');
  await wait(page, 900);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(page, 3400);
  await shot(page, `timed-${tag}`);
  await ctx.close();
}

const combos = [
  ['desktop', false],
  ['mobile', false],
  ['desktop', true],
  ['mobile', true],
  ['landscape', false],
  ['tablet', false],
];
for (const [k, d] of combos) {
  if (only && !`${k}${d ? '-dark' : ''}`.includes(only)) continue;
  try {
    await flows(k, d);
  } catch (e) {
    errors.push(`[${k}${d ? '-dark' : ''}] FLOW FAILED: ${e.message}`);
  }
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors');
