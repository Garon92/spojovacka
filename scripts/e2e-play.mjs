// Real input + full-level playthrough checks (playwright-core from _night/tools).
// usage: node scripts/e2e-play.mjs <outDir> [--base=http://localhost:5177/spojovacka/]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'AI/garon92-pages/_night/tools/node_modules/playwright-core'));

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'shots';
const base = args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:5177/spojovacka/';
fs.mkdirSync(out, { recursive: true });

const errors = [];
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, locale: 'cs-CZ' });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
const wait = (ms) => page.waitForTimeout(ms);
const api = (fn, arg) => page.evaluate(fn, arg);
const idle = () => page.waitForFunction(() => !window.__spojovacka.busy(), null, { timeout: 30000 });
const moves = () => api(() => window.__spojovacka.state().movesMade);

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.goto(base + '#/uroven/1');
await wait(600);
await page.getByRole('button', { name: 'Hrát' }).click();
await wait(500);

// 1) mouse drag
{
  const h = await api(() => window.__spojovacka.hint());
  const a = await api((p) => window.__spojovacka.cellCenter(p.x, p.y), h.a);
  const b = await api((p) => window.__spojovacka.cellCenter(p.x, p.y), h.b);
  const before = await moves();
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6);
  await page.mouse.up();
  await wait(100);
  await idle();
  ok('drag swap makes a move', (await moves()) === before + 1);
}
// 2) click-click
{
  await wait(300);
  const h = await api(() => window.__spojovacka.hint());
  const a = await api((p) => window.__spojovacka.cellCenter(p.x, p.y), h.a);
  const b = await api((p) => window.__spojovacka.cellCenter(p.x, p.y), h.b);
  const before = await moves();
  await page.mouse.click(a.x, a.y);
  await wait(120);
  await page.mouse.click(b.x, b.y);
  await wait(100);
  await idle();
  ok('click-click swap makes a move', (await moves()) === before + 1);
}
// 3) invalid swap is reverted and costs nothing
{
  await wait(300);
  const bad = await api(() => {
    const s = window.__spojovacka.state();
    const b = s.board;
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w - 1; x++) {
        const t1 = b.cells[y * b.w + x].tile;
        const t2 = b.cells[y * b.w + x + 1].tile;
        if (t1 && t2 && t1.special === 'none' && t2.special === 'none' && t1.color === t2.color) return { a: { x, y }, b: { x: x + 1, y } };
      }
    return null;
  });
  if (bad) {
    const before = await moves();
    const left = await api(() => window.__spojovacka.state().movesLeft);
    await api((m) => window.__spojovacka.move({ type: 'swap', a: m.a, b: m.b }), bad);
    await idle();
    ok('invalid swap keeps moves', (await moves()) === before && (await api(() => window.__spojovacka.state().movesLeft)) === left);
  }
}
// 4) keyboard: cursor starts in the middle; go to hint.a, Enter, arrow to hint.b
{
  await wait(300);
  const h = await api(() => window.__spojovacka.hint());
  const size = await api(() => ({ w: window.__spojovacka.state().board.w, h: window.__spojovacka.state().board.h }));
  await page.focus('canvas.board');
  await page.keyboard.press('ArrowLeft'); // show cursor (moves once)
  let cur = { x: Math.floor(size.w / 2) - 1, y: Math.floor(size.h / 2) };
  if (cur.x < 0) cur.x = 0;
  while (cur.x < h.a.x) { await page.keyboard.press('ArrowRight'); cur.x++; }
  while (cur.x > h.a.x) { await page.keyboard.press('ArrowLeft'); cur.x--; }
  while (cur.y < h.a.y) { await page.keyboard.press('ArrowDown'); cur.y++; }
  while (cur.y > h.a.y) { await page.keyboard.press('ArrowUp'); cur.y--; }
  const before = await moves();
  await page.keyboard.press('Enter');
  const key = h.b.x > h.a.x ? 'ArrowRight' : h.b.x < h.a.x ? 'ArrowLeft' : h.b.y > h.a.y ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.press(key);
  await wait(100);
  await idle();
  ok('keyboard swap makes a move', (await moves()) === before + 1);
}
// 5) play the level to the end with the bot, expect the results overlay
{
  for (let i = 0; i < 40; i++) {
    const ended = await api(() => window.__spojovacka.ended());
    if (ended) break;
    await api(() => window.__spojovacka.botMove());
    await idle();
  }
  await page.waitForSelector('.g92-overlay--results', { timeout: 60000 });
  await wait(1600);
  await page.screenshot({ path: path.join(out, 'win-desktop.png') });
  const title = await page.textContent('.g92-overlay--results .g92-overlay__title');
  ok('level 1 won → results', /splněna/.test(title ?? ''), title);
  const rec = await api(() => JSON.parse(localStorage.getItem('g92:spojovacka:levels') ?? '{}'));
  ok('stars saved', (rec['1']?.stars ?? 0) >= 1, JSON.stringify(rec['1']));
  const ach = await api(() => JSON.parse(localStorage.getItem('g92:spojovacka:achievements') ?? '[]'));
  ok('achievement "first win" unlocked', ach.includes('first-win'), JSON.stringify(ach));
  const st = await api(() => JSON.parse(localStorage.getItem('g92:spojovacka:stats') ?? '{}'));
  ok('stats recorded', st.wins >= 1 && st.tiles > 0, JSON.stringify(st));
  const act = await api(() => JSON.parse(localStorage.getItem('g92:activity') ?? '{}').spojovacka);
  ok('activity recorded', !!act?.metric, JSON.stringify(act));
  await page.getByRole('button', { name: 'Další úroveň' }).click();
  await wait(700);
  ok('next level opens', (await page.evaluate(() => location.hash)) === '#/uroven/2');
  await page.screenshot({ path: path.join(out, 'intro-l2-desktop.png') });
}
// 6) timed: finish quickly
{
  await page.goto(base + '#/na-cas');
  await wait(700);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(3300);
  await api(() => window.__spojovacka.botMove());
  await idle();
  await api(() => window.__spojovacka.setTime(1));
  await page.waitForSelector('.g92-overlay--results', { timeout: 15000 });
  await wait(1200);
  await page.screenshot({ path: path.join(out, 'timed-results-desktop.png') });
  const best = await api(() => JSON.parse(localStorage.getItem('g92:spojovacka:timedBest') ?? '{}'));
  ok('timed best saved', Object.values(best).some((v) => v > 0), JSON.stringify(best));
}
// 7) relax: pause → Skončit → results
{
  await page.goto(base + '#/pohoda');
  await wait(700);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(500);
  await api(() => window.__spojovacka.botMove());
  await idle();
  await page.keyboard.press('p');
  await wait(400);
  await page.getByRole('button', { name: 'Skončit' }).click();
  await page.waitForSelector('.g92-overlay--results', { timeout: 10000 });
  await wait(1000);
  await page.screenshot({ path: path.join(out, 'relax-results-desktop.png') });
  const coins = await api(() => Number(localStorage.getItem('g92:spojovacka:coins') ?? '0'));
  ok('coins earned', coins > 0, String(coins));
}
// 8) migration from the original save
{
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('spojovacka:v1', JSON.stringify({ soundEnabled: true, pieceTheme: 'dinos', activeSkin: 'dog', ownedSkins: ['mouse', 'rat', 'dog'] }));
  });
  await page.reload();
  await wait(500);
  const mig = await api(() => ({
    owned: JSON.parse(localStorage.getItem('g92:spojovacka:ownedSkins') ?? 'null'),
    active: JSON.parse(localStorage.getItem('g92:spojovacka:activeSkin') ?? 'null'),
    theme: JSON.parse(localStorage.getItem('g92:spojovacka:pieceTheme') ?? 'null'),
    old: localStorage.getItem('spojovacka:v1'),
  }));
  ok('v1 save migrated', mig.active === 'dog' && mig.owned?.includes('rat') && mig.theme === 'dinos' && mig.old === null, JSON.stringify(mig));
}

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
