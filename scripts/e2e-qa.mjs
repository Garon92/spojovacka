// QA round verification: one check per finding (SPOJ-01 … SPOJ-13) at the viewports QA used.
// usage: node scripts/e2e-qa.mjs <outDir> [--base=http://localhost:5177/spojovacka/]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'AI/garon92-pages/_night/tools/node_modules/playwright-core'));

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'shots';
const base = args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:5177/spojovacka/';
fs.mkdirSync(out, { recursive: true });

const results = [];
const errors = [];
const ok = (id, name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${id} ${name}${extra ? ` (${extra})` : ''}`);
  if (!cond) process.exitCode = 1;
};
const VP = {
  p360: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
  p390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  phoneL: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1440, height: 900 } },
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function open(vp, { dark = false, progress = 0, coins = 0 } = {}) {
  const ctx = await browser.newContext({ ...VP[vp], deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', locale: 'cs-CZ' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${vp}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${vp}] pageerror ${e.message}`));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.evaluate(
    ({ progress, coins }) => {
      localStorage.clear();
      const lv = {};
      for (let i = 1; i <= progress; i++) lv[i] = { stars: 1 + (i % 3), best: 3000 };
      localStorage.setItem('g92:spojovacka:levels', JSON.stringify(lv));
      localStorage.setItem('g92:spojovacka:coins', String(coins));
      localStorage.setItem('g92:spojovacka:__version', '2');
    },
    { progress, coins },
  );
  await page.reload();
  await page.waitForTimeout(500);
  return { ctx, page };
}
const wait = (page, ms) => page.waitForTimeout(ms);
const idle = (page) => page.waitForFunction(() => !window.__spojovacka.busy(), null, { timeout: 30000 });
async function startLevel(page, id) {
  await page.goto(base + '#/uroven/' + id);
  await wait(page, 800);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(page, 1200);
}
/** win the running level: mark goals done, then one real move */
async function forceWin(page) {
  await page.evaluate(() => {
    const st = window.__spojovacka.state();
    for (const g of st.goals) {
      g.done = g.target;
      if (g.kind === 'score') st.score = Math.max(st.score, g.target);
    }
  });
  await page.evaluate(() => window.__spojovacka.botMove());
  await page.waitForSelector('.g92-overlay--results', { timeout: 60000 });
  await wait(page, 2600);
}
function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---------------- SPOJ-01: night world overlays readable in light theme
{
  const { ctx, page } = await open('p390', { progress: 39 });
  await startLevel(page, 31);
  await page.keyboard.press('p');
  await wait(page, 600);
  const c1 = await page.evaluate(() => {
    const t = document.querySelector('.g92-overlay--pause .g92-overlay__title');
    const p = document.querySelector('.g92-overlay--pause .g92-overlay__panel');
    const v = document.querySelector('.g92-overlay--pause .g92-overlay__stat dd');
    return { title: getComputedStyle(t).color, stat: getComputedStyle(v).color, bg: getComputedStyle(p).backgroundColor };
  });
  await page.screenshot({ path: path.join(out, 'qa-p390-light-pause-l31.png') });
  ok('SPOJ-01', 'pause text contrast (night, light)', contrast(c1.title, c1.bg) > 7 && contrast(c1.stat, c1.bg) > 7, `${contrast(c1.title, c1.bg).toFixed(1)}:1`);
  await page.keyboard.press('Escape');
  await wait(page, 400);
  await forceWin(page);
  const c2 = await page.evaluate(() => {
    const t = document.querySelector('.g92-overlay--results .g92-overlay__title');
    const p = document.querySelector('.g92-overlay--results .g92-overlay__panel');
    return { title: getComputedStyle(t).color, bg: getComputedStyle(p).backgroundColor };
  });
  await page.screenshot({ path: path.join(out, 'qa-p390-light-win-l31.png') });
  ok('SPOJ-01', 'results text contrast (night, light)', contrast(c2.title, c2.bg) > 7, `${contrast(c2.title, c2.bg).toFixed(1)}:1`);
  // SPOJ-03: primary button is clickable right away and nothing covers it
  const hit = await page.evaluate(() => {
    const b = document.querySelector('.g92-overlay--results [data-primary]');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { same: b === el || b.contains(el), toasts: document.querySelectorAll('.g92-toast').length, badges: [...document.querySelectorAll('.g92-overlay__stat dt')].filter((d) => /úspěch/i.test(d.textContent)).length };
  });
  ok('SPOJ-03', 'no toast over results, achievements inside results', hit.same && hit.toasts === 0, JSON.stringify(hit));
  await ctx.close();
}

// ---------------- SPOJ-02: phone landscape, 4 goals, no page scroll, board + bar fully visible
for (const lvl of [40, 30, 20]) {
  const { ctx, page } = await open('phoneL', { progress: 39, dark: true });
  await startLevel(page, lvl);
  const m = await page.evaluate(() => {
    const board = document.querySelector('canvas.board').getBoundingClientRect();
    const bar = document.querySelector('.game__bar').getBoundingClientRect();
    const hud = document.querySelector('.hud').getBoundingClientRect();
    return { docH: document.documentElement.scrollHeight, vh: innerHeight, boardBottom: board.bottom, barBottom: bar.bottom, hudBottom: hud.bottom, hudScroll: document.querySelector('.hud').scrollHeight > document.querySelector('.hud').clientHeight };
  });
  await page.screenshot({ path: path.join(out, `qa-phoneL-dark-level${lvl}.png`) });
  ok('SPOJ-02', `844×390 level ${lvl} fits`, m.docH <= m.vh && m.boardBottom <= m.vh && m.barBottom <= m.vh && m.hudBottom <= m.vh, JSON.stringify(m));
  await ctx.close();
}

// ---------------- SPOJ-03 + SPOJ-11: fresh player, 360×740, win level 1
{
  const { ctx, page } = await open('p360', { dark: true });
  await startLevel(page, 1);
  await forceWin(page);
  const m = await page.evaluate(() => {
    const b = document.querySelector('.g92-overlay--results [data-primary]');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const stats = [...document.querySelectorAll('.g92-overlay--results .g92-overlay__stat')].map((s) => Math.round(s.getBoundingClientRect().top));
    return { clickable: b === el || b.contains(el), toasts: document.querySelectorAll('.g92-toast').length, chips: [...document.querySelectorAll('.g92-overlay__stat')].filter((d) => /úspěch/i.test(d.textContent)).map((c) => c.textContent.trim()), rows: new Set(stats).size, stats: stats.length };
  });
  await page.screenshot({ path: path.join(out, 'qa-p360-dark-win-l1.png') });
  ok('SPOJ-03', '360 win l1: CTA clickable, no toasts, achievement badge shown', m.clickable && m.toasts === 0 && m.chips.length >= 1, JSON.stringify(m));
  ok('SPOJ-11', 'results stats in one row', m.rows === 1, `${m.stats} stats, ${m.rows} rows`);
  // next screen: no late toast leaking into the next intro
  await page.getByRole('button', { name: 'Další úroveň' }).click();
  await wait(page, 3000);
  const late = await page.evaluate(() => document.querySelectorAll('.g92-toast').length);
  ok('SPOJ-03', 'no late toasts on the next screen', late === 0, String(late));
  await ctx.close();
}

// ---------------- SPOJ-04: settings pause the timed mode
{
  const { ctx, page } = await open('p390');
  await page.goto(base + '#/na-cas');
  await wait(page, 800);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(page, 3600);
  const t0 = await page.textContent('.hud__big');
  await page.locator('g92-appbar').getByRole('button', { name: 'Nastavení' }).click();
  await wait(page, 4000);
  const t1 = await page.textContent('.hud__big');
  const paused = await page.evaluate(() => !!document.querySelector('.g92-overlay--pause'));
  await page.screenshot({ path: path.join(out, 'qa-p390-light-timed-settings.png') });
  ok('SPOJ-04', 'timer stops while ⚙ is open', t0 === t1 && paused, `${t0} → ${t1}, pause overlay ${paused}`);
  await ctx.close();
}

// ---------------- SPOJ-05: map scrolls to the current level
{
  const { ctx, page } = await open('p360', { progress: 39 });
  await page.goto(base + '#/');
  await wait(page, 500);
  await page.getByRole('button', { name: /Hrát/ }).first().click();
  await wait(page, 800);
  const m = await page.evaluate(() => {
    const cur = document.querySelector('.lvl.is-current').getBoundingClientRect();
    return { scrollY: Math.round(scrollY), top: Math.round(cur.top), bottom: Math.round(cur.bottom), vh: innerHeight };
  });
  await page.screenshot({ path: path.join(out, 'qa-p360-light-map-progress.png') });
  ok('SPOJ-05', 'map centred on the current level', m.scrollY > 0 && m.top >= 0 && m.bottom <= m.vh, JSON.stringify(m));
  // SPOJ-07: the in-page back is a labelled "Domů"
  const back = await page.textContent('.screen__head .home-btn');
  ok('SPOJ-07', 'in-page back labelled "Domů"', back?.trim() === 'Domů', back ?? '');
  await ctx.close();
}

// ---------------- SPOJ-06: home tiles at phone widths
for (const w of [360, 375, 381, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'cs-CZ' });
  const page = await ctx.newPage();
  await page.goto(base + '#/');
  await wait(page, 700);
  const m = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('.modecard__txt b')].map((b) => {
      const lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.3;
      return Math.round(b.getBoundingClientRect().height / lh);
    });
    const heights = [...document.querySelectorAll('.modecard')].map((c) => Math.round(c.getBoundingClientRect().height));
    return { titleLines: Math.max(...titles), heights: [...new Set(heights)], overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  if (w === 390 || w === 360) await page.screenshot({ path: path.join(out, `qa-p${w}-light-home.png`) });
  ok('SPOJ-06', `home ${w}px: titles on one line, equal cards`, m.titleLines === 1 && m.heights.length === 1 && !m.overflowX, JSON.stringify(m));
  await ctx.close();
}

// ---------------- SPOJ-08 / SPOJ-12 / SPOJ-13: pets
{
  const { ctx, page } = await open('p360', { coins: 37, dark: true });
  await page.goto(base + '#/zviratka');
  await wait(page, 900);
  const m = await page.evaluate(() =>
    [...document.querySelectorAll('.pet')].map((p) => ({ name: p.querySelector('.pet__name').textContent, btn: p.querySelector('button').textContent, disabled: p.querySelector('button').disabled })),
  );
  await page.screenshot({ path: path.join(out, 'qa-p360-dark-zviratka.png'), fullPage: true });
  const rat = m.find((p) => p.name.includes('Potkan'));
  ok('SPOJ-13', 'unaffordable pet disabled with missing amount', rat?.disabled && /chybí\s23/.test(rat.btn), JSON.stringify(rat));
  await ctx.close();
}
{
  const { ctx, page } = await open('p390', { coins: 500 });
  await page.goto(base + '#/zviratka');
  await wait(page, 900);
  await page.locator('.pet', { hasText: 'Potkan' }).getByRole('button').click();
  await wait(page, 400);
  const title = await page.textContent('dialog[open] h2, dialog[open] .g92-dialog__title');
  ok('SPOJ-08', 'buy dialog grammar', /Koupit potkana\?/.test(title ?? ''), title ?? '');
  await page.getByRole('button', { name: 'Koupit' }).last().click();
  await wait(page, 700);
  const t = await page.textContent('.g92-toast');
  ok('SPOJ-08', 'bought toast grammar', /Potkan teď běhá v kolečku/.test(t ?? ''), t ?? '');
  await page.screenshot({ path: path.join(out, 'qa-p390-light-zviratka-rat.png') });
  await ctx.close();
}

// ---------------- SPOJ-09 / SPOJ-10: lose screen with icon chips + disabled coin option
{
  const { ctx, page } = await open('p390', { progress: 3, coins: 18 });
  await startLevel(page, 2);
  await page.evaluate(() => window.__spojovacka.setMovesLeft(1));
  await page.evaluate(() => window.__spojovacka.botMove());
  await page.waitForSelector('.g92-overlay--results', { timeout: 30000 });
  await wait(page, 1500);
  const m = await page.evaluate(() => ({
    chips: document.querySelectorAll('.lose__goals .goal').length,
    extra: document.querySelector('.lose__extra')?.textContent ?? '',
    extraDisabled: document.querySelector('.lose__extra')?.disabled ?? false,
    primary: document.querySelector('.g92-overlay--results [data-primary]').textContent.trim(),
  }));
  await page.screenshot({ path: path.join(out, 'qa-p390-light-lose-l2.png') });
  ok('SPOJ-10', 'lose: goal chips + disabled +5 moves', m.chips >= 1 && m.extraDisabled && /máš 18/.test(m.extra), JSON.stringify(m));
  ok('SPOJ-09', 'lose primary is "Hrát znovu"', m.primary === 'Hrát znovu', m.primary);
  await ctx.close();
}

// ---------------- SPOJ-13: no duplicate title in Pohoda
{
  const { ctx, page } = await open('p390');
  await page.goto(base + '#/pohoda');
  await wait(page, 800);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await wait(page, 900);
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.game__title')).display);
  await page.screenshot({ path: path.join(out, 'qa-p390-light-relax.png') });
  ok('SPOJ-13', 'no title above the board in Pohoda', vis === 'none', vis);
  await ctx.close();
}

// ---------------- kit v0.7 contract: appbar pause, leave guard, help title, keys, activity metric
{
  const { ctx, page } = await open('p390', { progress: 3 });
  await page.goto(base + '#/');
  await wait(page, 500);
  const pauseHome = await page.locator('g92-appbar > .g92-appbar-action').first().isVisible();
  await startLevel(page, 2);
  const pauseGame = await page.locator('g92-appbar > .g92-appbar-action').first().isVisible();
  ok('KIT', 'appbar pause button only while playing', !pauseHome && pauseGame, `home ${pauseHome}, game ${pauseGame}`);
  // before the first move nothing is lost → no guard; after a move → guard
  await page.evaluate(() => window.__spojovacka.botMove());
  await idle(page);
  await page.locator('g92-appbar').getByRole('link', { name: /Menu/ }).or(page.locator('g92-appbar').getByRole('button', { name: /Menu/ })).first().click();
  await wait(page, 600);
  const guard = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return { title: d?.querySelector('h2, .g92-dialog__title')?.textContent ?? '', focus: document.activeElement?.textContent?.trim() ?? '', paused: !!document.querySelector('.g92-overlay--pause'), url: location.pathname };
  });
  await page.screenshot({ path: path.join(out, 'qa-p390-light-leave-guard.png') });
  ok('KIT', 'Menu mid-level asks (focus Zůstat) and pauses', /Odejít do menu/.test(guard.title) && /Zůstat/.test(guard.focus) && guard.paused, JSON.stringify(guard));
  await page.getByRole('button', { name: 'Zůstat' }).click();
  await wait(page, 400);
  const still = await page.evaluate(() => ({ url: location.pathname + location.hash, paused: !!document.querySelector('.g92-overlay--pause') }));
  ok('KIT', 'Zůstat keeps the game (paused)', still.url.includes('/spojovacka/#/uroven/2') && still.paused, JSON.stringify(still));
  // pause overlay wording
  const pauseBtns = await page.evaluate(() => [...document.querySelectorAll('.g92-overlay--pause button, .g92-overlay--pause a')].map((b) => b.textContent.trim()));
  ok('KIT', 'pause: Pokračovat / Hrát znovu / Ukončit hru / Menu', ['Pokračovat', 'Hrát znovu', 'Ukončit hru', 'Menu'].every((w) => pauseBtns.includes(w)), pauseBtns.join(' | '));
  await page.keyboard.press('Escape');
  await wait(page, 400);
  // help via "?" key → kit dialog "Jak hrát", game pauses
  await page.keyboard.press('?');
  await wait(page, 600);
  const help = await page.evaluate(() => ({ title: document.querySelector('dialog[open] h2, dialog[open] .g92-dialog__title')?.textContent ?? '', paused: !!document.querySelector('.g92-overlay--pause'), rich: !!document.querySelector('dialog[open] .howto') }));
  ok('KIT', 'help = kit dialog "Jak hrát" with our content, game paused', help.title === 'Jak hrát' && help.rich && help.paused, JSON.stringify(help));
  await page.getByRole('button', { name: 'Rozumím' }).click();
  await wait(page, 300);
  // M = mute (appbar keys)
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('g92:settings') ?? '{}').sound !== false);
  await page.keyboard.press('Escape');
  await wait(page, 300);
  await page.keyboard.press('m');
  await wait(page, 300);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('g92:settings') ?? '{}').sound !== false);
  ok('KIT', 'M toggles sound (kit keys)', before !== after, `${before} → ${after}`);
  // win → activity metric with unit + href
  await forceWin(page);
  const act = await page.evaluate(() => JSON.parse(localStorage.getItem('g92:activity') ?? '{}').spojovacka);
  ok('KIT', 'menu metric has unit/of + note + href', Array.isArray(act?.metric?.unit) && act.metric.of === 120 && /Úroveň/.test(act.note) && /^\/spojovacka\/#\/uroven\//.test(act.href), JSON.stringify(act));
  const doc = await page.evaluate(() => ({ title: document.title, game: document.documentElement.classList.contains('g92-game') }));
  ok('KIT', 'title + g92-game class', doc.title === 'Spojovačka – Spoj tři stejné' && doc.game, JSON.stringify(doc));
  await ctx.close();
}
// timed difficulty names
{
  const { ctx, page } = await open('p360');
  await page.goto(base + '#/na-cas');
  await wait(page, 900);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.g92-difficulty__label')].map((l) => l.textContent));
  await page.screenshot({ path: path.join(out, 'qa-p360-light-timed-start.png') });
  ok('KIT', 'DIFFICULTIES_3 Lehká / Normální / Těžká', labels.join('/') === 'Lehká/Normální/Těžká', labels.join('/'));
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
