// Screenshots of every piece theme with specials + obstacles + hint (visual QA).
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'AI/garon92-pages/_night/tools/node_modules/playwright-core'));
const out = process.argv[2] ?? 'shots';
const base = 'http://localhost:5177/spojovacka/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
for (const dark of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.evaluate(() => {
    const lv = {};
    for (let i = 1; i <= 40; i++) lv[i] = { stars: 1, best: 100 };
    localStorage.setItem('g92:spojovacka:levels', JSON.stringify(lv));
  });
  await page.reload();
  for (const [lvl, theme] of [[30, 'shapes'], [34, 'balls'], [28, 'diamonds'], [40, 'dinos']]) {
    await page.goto(base + '#/uroven/' + lvl);
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Hrát' }).click();
    await page.waitForTimeout(300);
    await page.evaluate((t) => { window.__spojovacka.setPieceTheme(t); window.__spojovacka.demoSpecials(); window.__spojovacka.hintNow(); }, theme);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `theme-${theme}${dark ? '-dark' : ''}.png`) });
    await page.goto(base + '#/');
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors');
