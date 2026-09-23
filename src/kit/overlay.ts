/**
 * Game screens: start, pause, results, countdown — same look in every g92 game.
 *
 *   const { difficulty } = await showStart({
 *     appId: 'tanky',
 *     difficulties: [...DIFFICULTIES_3],                     // Lehká 🐢 · Normální 🐇 · Těžká 🔥 (labels.ts)
 *     difficulty: store.get('difficulty'),
 *     best: { label: 'Rekord', value: store.get('best') },
 *     howTo: [{ icon: '👆', text: 'Klepni a miř' }, { icon: '💥', text: 'Pusť a vystřel' }],
 *     keys: [{ keys: ['←', '→'], text: 'otáčení' }, { keys: ['Mezerník'], text: 'střelba' }],
 *   });
 *   await countdown();
 *   // … game …
 *   const choice = await showPause({ quit: true });            // 'resume' | 'restart' | 'quit' | 'menu'
 *   const next = await showResults({ score, best, isNewBest, stars: 2, stats: [{ label: 'Přesnost', value: '92 %' }] });  // 'again' | 'menu'
 *
 * Every show* returns a Promise with extra `el` and `close(value)` (e.g. close the pause overlay from your own Esc handler).
 * autoPause(fn) calls fn when the tab is hidden or the window loses focus.
 */
import { getApp } from './apps';
import { confetti } from './confetti';
import { UI_ICONS, h, starsHTML } from './dom';
import { prefersReducedMotion } from './settings';
import { sfx } from './sfx';
import { formatMetric } from './activity';
import { plural } from './cz';
import { setHelp } from './help';
import { HELP_TITLE_GAME, LABELS, LABEL_ICONS } from './labels';
import { goToMenu } from './nav';

export type OverlayPromise<T> = Promise<T> & { el: HTMLElement; close: (value: T) => void };

export interface OverlayBaseOptions {
  /** mount point (default: document.body). A non-body container must be position: relative. */
  container?: HTMLElement;
  /** 'blur' (game visible behind), 'solid' (accent-tinted page background), 'clear' */
  backdrop?: 'blur' | 'solid' | 'clear';
  /** cover the appbar too (default false: overlay starts below <g92-appbar>) */
  coverAppbar?: boolean;
  /** extra content appended into the panel (before actions) */
  extra?: Node;
  className?: string;
}

export interface Difficulty {
  id: string;
  label: string;
  /** emoji or SVG string */
  icon?: string;
  hint?: string;
}

export interface HowToStep {
  /** emoji or SVG string — make it speak for itself (kids don't read) */
  icon: string;
  text: string;
}

export interface KeyHint {
  keys: string[];
  text: string;
}

export interface StartOptions extends OverlayBaseOptions {
  appId?: string;
  title?: string;
  subtitle?: string;
  /** emoji or SVG for the big tile (default: app icon) */
  icon?: string;
  playLabel?: string;
  difficulties?: Difficulty[];
  difficulty?: string;
  difficultyLabel?: string;
  best?: { label?: string; value: number | string } | null;
  howTo?: HowToStep[];
  keys?: KeyHint[];
  /** open the how-to view immediately (e.g. first visit) */
  showHowTo?: boolean;
  /** also register howTo/keys as the appbar "?" help (setHelp) so it is available during the game */
  helpInAppbar?: boolean;
  /** smaller icon/title/gaps — use when you add `extra` content so "Hrát" stays above the fold */
  compact?: boolean;
}

export interface StartResult {
  difficulty: string | undefined;
}

export interface PauseOptions extends OverlayBaseOptions {
  title?: string;
  subtitle?: string;
  /** hide "Hrát znovu" */
  noRestart?: boolean;
  /** add "Ukončit hru" (resolves 'quit' → go to your in-app home); pass a string to relabel */
  quit?: boolean | string;
  /** hide "Menu" (e.g. when "Ukončit hru" is the way out) */
  noMenu?: boolean;
  /** where "Menu" goes; null = just resolve 'menu' (default '/menu/') */
  menuHref?: string | null;
  menuLabel?: string;
  stats?: { label: string; value: number | string }[];
}

export type PauseChoice = 'resume' | 'restart' | 'menu' | 'quit';

export interface ResultsOptions extends OverlayBaseOptions {
  title?: string;
  subtitle?: string;
  score?: number | string;
  /** unit under the score: one string, or Czech plural forms [one, few, many] (default ['bod', 'body', 'bodů']) */
  scoreLabel?: string | readonly [string, string, string];
  best?: number | string | null;
  bestLabel?: string;
  isNewBest?: boolean;
  /** 0..maxStars; omit to hide stars */
  stars?: number;
  maxStars?: number;
  stats?: { label: string; value: number | string; icon?: string }[];
  againLabel?: string;
  /** icon (SVG string) of the primary button; default UI_ICONS.restart — for "Další úroveň" use LABELS.next + LABEL_ICONS.next */
  againIcon?: string;
  /** where "Menu" goes; null = just resolve 'menu' (default '/menu/') */
  menuHref?: string | null;
  menuLabel?: string;
  /** additional buttons (resolve with their value) */
  actions?: { label: string; value: string; variant?: 'primary' | 'secondary' | 'ghost' | 'soft'; icon?: string }[];
  /** play win/lose sound + confetti (default true) */
  celebrate?: boolean;
  /** treat as a loss (sad sound, no confetti) */
  lost?: boolean;
}

export type ResultsChoice = 'again' | 'menu' | (string & {});

export interface CountdownOptions {
  from?: number;
  goLabel?: string;
  container?: HTMLElement;
  /** ms per step */
  step?: number;
}

const isSvg = (s: string) => s.trimStart().startsWith('<svg');
const iconHTML = (s: string) => (isSvg(s) ? s : `<span class="g92-emoji">${escapeHTML(s)}</span>`);

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function mount<T>(opts: OverlayBaseOptions, kind: string, build: (close: (v: T) => void, panel: HTMLElement) => void, onKey?: (e: KeyboardEvent, close: (v: T) => void) => void): OverlayPromise<T> {
  const container = opts.container ?? document.body;
  const root = h('div', {
    class: `g92-overlay g92-overlay--${opts.backdrop ?? 'blur'} g92-overlay--${kind}${container !== document.body ? ' g92-overlay--contained' : ''}${opts.className ? ` ${opts.className}` : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
  });
  if (container === document.body && !opts.coverAppbar) {
    const bar = document.querySelector('g92-appbar');
    if (bar && !bar.hasAttribute('hidden')) root.style.top = 'var(--g92-appbar-total)';
  }
  const panel = h('div', { class: 'g92-overlay__panel' });
  root.append(panel);

  let resolve!: (v: T) => void;
  let closed = false;
  const promise = new Promise<T>((r) => (resolve = r)) as OverlayPromise<T>;
  const keyHandler = (e: KeyboardEvent) => {
    if (closed || e.defaultPrevented) return;
    // don't steal keys from dialogs opened above
    if (document.querySelector('dialog[open]')) return;
    onKey?.(e, close);
  };
  function close(v: T): void {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', keyHandler, true);
    root.classList.add('is-leaving');
    const done = () => root.remove();
    if (prefersReducedMotion()) done();
    else setTimeout(done, 220);
    resolve(v);
  }
  build(close, panel);
  if (opts.extra) {
    const wrap = h('div', { class: 'g92-overlay__extra' }, opts.extra);
    const actions = panel.querySelector('.g92-overlay__actions');
    (actions?.parentElement ?? panel).insertBefore(wrap, actions);
  }
  // hero (icon, title, score…) | controls (choices, stats, buttons) — side by side on short landscape screens
  const containers = panel.querySelector(':scope > .g92-overlay__view') ? [...panel.querySelectorAll<HTMLElement>(':scope > .g92-overlay__view')] : [panel];
  for (const c of containers) splitHeroControls(c);
  window.addEventListener('keydown', keyHandler, true);
  container.append(root);
  const primary = panel.querySelector<HTMLElement>('[data-primary]');
  requestAnimationFrame(() => primary?.focus({ preventScroll: true }));
  promise.el = root;
  promise.close = close;
  return promise;
}

const CONTROL_SEL = '.g92-overlay__section, .g92-overlay__stats, .g92-overlay__extra, .g92-howto, .g92-keys, .g92-overlay__actions';

function splitHeroControls(c: HTMLElement): void {
  const kids = [...c.children];
  const idx = kids.findIndex((k) => k.matches(CONTROL_SEL));
  if (idx <= 0) return;
  c.append(h('div', { class: 'g92-overlay__hero' }, ...kids.slice(0, idx)), h('div', { class: 'g92-overlay__controls' }, ...kids.slice(idx)));
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

// ---------------------------------------------------------------------------
// Start screen
// ---------------------------------------------------------------------------

export function showStart(opts: StartOptions = {}): OverlayPromise<StartResult> {
  const app = getApp(opts.appId ?? document.querySelector('g92-appbar')?.getAttribute('app'));
  let difficulty = opts.difficulty ?? opts.difficulties?.[0]?.id;
  if (opts.helpInAppbar && (opts.howTo?.length || opts.keys?.length)) setHelp({ title: HELP_TITLE_GAME, howTo: opts.howTo, keys: opts.keys });

  return mount<StartResult>(
    { backdrop: 'solid', ...opts, className: `${opts.compact ? 'g92-overlay--compact ' : ''}${opts.className ?? ''}`.trim() || undefined },
    'start',
    (close, panel) => {
      const main = h('div', { class: 'g92-overlay__view' });
      const tile = h('div', { class: 'g92-overlay__icon', html: iconHTML(opts.icon ?? app?.icon ?? UI_ICONS.play), 'aria-hidden': 'true' });
      main.append(tile, h('h1', { class: 'g92-overlay__title' }, opts.title ?? app?.name ?? 'Hra'));
      const sub = opts.subtitle ?? app?.tagline;
      if (sub) main.append(h('p', { class: 'g92-overlay__subtitle' }, sub));
      if (opts.best && opts.best.value !== 0 && opts.best.value !== '' && opts.best.value !== null) {
        main.append(
          h('div', { class: 'g92-overlay__best', html: `${UI_ICONS.trophy}<span>${escapeHTML(opts.best.label ?? 'Rekord')}: <b>${escapeHTML(formatMetric(opts.best.value))}</b></span>` }),
        );
      }

      if (opts.difficulties?.length) {
        const name = `g92-diff-${Math.random().toString(36).slice(2, 7)}`;
        const group = h('div', { class: 'g92-difficulty', role: 'radiogroup', 'aria-label': opts.difficultyLabel ?? 'Obtížnost' });
        // up to 4 options always stay in one row (even on 360px phones)
        if (opts.difficulties.length <= 4) group.style.gridTemplateColumns = `repeat(${opts.difficulties.length}, minmax(0, 1fr))`;
        for (const d of opts.difficulties) {
          const input = h('input', { type: 'radio', name, value: d.id }) as HTMLInputElement;
          input.checked = d.id === difficulty;
          input.addEventListener('change', () => {
            if (input.checked) {
              difficulty = d.id;
              sfx.click();
            }
          });
          const card = h('span', { class: 'g92-difficulty__card' });
          if (d.icon) card.append(h('span', { class: 'g92-difficulty__icon', html: iconHTML(d.icon), 'aria-hidden': 'true' }));
          card.append(h('span', { class: 'g92-difficulty__label' }, d.label));
          if (d.hint) card.append(h('span', { class: 'g92-difficulty__hint' }, d.hint));
          group.append(h('label', { class: 'g92-difficulty__option' }, input, card));
        }
        main.append(
          h('div', { class: 'g92-overlay__section' }, h('span', { class: 'g92-eyebrow' }, opts.difficultyLabel ?? 'Obtížnost'), group),
        );
      }

      const play = h('button', { type: 'button', class: 'g92-btn g92-btn--xl g92-btn--block g92-overlay__play', 'data-primary': true, html: UI_ICONS.play });
      play.append(opts.playLabel ?? LABELS.play);
      play.addEventListener('click', () => {
        sfx.pop();
        close({ difficulty });
      });
      const actions = h('div', { class: 'g92-overlay__actions' }, play);

      const hasHowTo = Boolean(opts.howTo?.length || opts.keys?.length);
      const howView = h('div', { class: 'g92-overlay__view', hidden: true });
      if (hasHowTo) {
        const howBtn = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary g92-btn--lg g92-btn--block', html: UI_ICONS.help });
        howBtn.append(HELP_TITLE_GAME);
        actions.append(howBtn);

        howView.append(h('div', { class: 'g92-overlay__icon g92-overlay__icon--sm', html: UI_ICONS.help, 'aria-hidden': 'true' }), h('h2', { class: 'g92-overlay__title g92-overlay__title--sm' }, HELP_TITLE_GAME));
        if (opts.howTo?.length) {
          const steps = h('ol', { class: 'g92-howto' });
          opts.howTo.forEach((s, i) =>
            steps.append(
              h('li', { class: 'g92-howto__step', style: `--i:${i}` }, h('span', { class: 'g92-howto__icon', html: iconHTML(s.icon), 'aria-hidden': 'true' }), h('span', { class: 'g92-howto__text' }, s.text)),
            ),
          );
          howView.append(steps);
        }
        if (opts.keys?.length) {
          const list = h('ul', { class: 'g92-keys' });
          for (const k of opts.keys) {
            list.append(h('li', null, h('span', { class: 'g92-keys__keys', html: k.keys.map((x) => `<kbd class="g92-kbd">${escapeHTML(x)}</kbd>`).join(' ') }), h('span', null, k.text)));
          }
          howView.append(list);
        }
        const backBtn = h('button', { type: 'button', class: 'g92-btn g92-btn--xl g92-btn--block', html: UI_ICONS.check });
        backBtn.append(LABELS.gotIt);
        howView.append(h('div', { class: 'g92-overlay__actions' }, backBtn));

        const showHow = (on: boolean) => {
          main.hidden = on;
          howView.hidden = !on;
          // the visible view's main button is the primary one (Enter, focus, tests)
          backBtn.toggleAttribute('data-primary', on);
          play.toggleAttribute('data-primary', !on);
          (on ? backBtn : play).focus({ preventScroll: true });
        };
        howBtn.addEventListener('click', () => {
          sfx.tap();
          showHow(true);
        });
        backBtn.addEventListener('click', () => {
          sfx.tap();
          showHow(false);
        });
        if (opts.showHowTo) {
          main.hidden = true;
          howView.hidden = false;
          backBtn.setAttribute('data-primary', '');
          play.removeAttribute('data-primary');
        }
      }
      main.append(actions);
      panel.append(main, howView);
    },
    (e, close) => {
      if (isTyping(e)) return;
      const root = document.activeElement;
      if ((e.key === 'Enter' || e.key === ' ') && (!root || root === document.body)) {
        e.preventDefault();
        sfx.pop();
        close({ difficulty });
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export function showPause(opts: PauseOptions = {}): OverlayPromise<PauseChoice> {
  sfx.whoosh();
  return mount<PauseChoice>(
    opts,
    'pause',
    (close, panel) => {
      panel.append(
        h('div', { class: 'g92-overlay__icon g92-overlay__icon--sm', html: UI_ICONS.pause, 'aria-hidden': 'true' }),
        h('h2', { class: 'g92-overlay__title' }, opts.title ?? LABELS.pause),
      );
      if (opts.subtitle) panel.append(h('p', { class: 'g92-overlay__subtitle' }, opts.subtitle));
      if (opts.stats?.length) panel.append(statsEl(opts.stats));
      const resume = h('button', { type: 'button', class: 'g92-btn g92-btn--xl g92-btn--block', 'data-primary': true, html: LABEL_ICONS.resume });
      resume.append(LABELS.resume);
      resume.addEventListener('click', () => {
        sfx.pop();
        close('resume');
      });
      const actions = h('div', { class: 'g92-overlay__actions' }, resume);
      const row = h('div', { class: 'g92-overlay__row' });
      if (!opts.noRestart) {
        const restart = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary g92-btn--lg', html: LABEL_ICONS.again });
        restart.append(LABELS.again);
        restart.addEventListener('click', () => {
          sfx.tap();
          close('restart');
        });
        row.append(restart);
      }
      if (opts.quit) {
        const quit = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--lg', html: LABEL_ICONS.home });
        quit.append(typeof opts.quit === 'string' ? opts.quit : LABELS.quit);
        quit.addEventListener('click', () => {
          sfx.tap();
          close('quit');
        });
        row.append(quit);
      }
      if (!opts.noMenu) row.append(menuButton(opts.menuHref, opts.menuLabel, () => close('menu')));
      actions.append(row);
      panel.append(actions);
    },
    (e, close) => {
      if (isTyping(e)) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        e.stopPropagation();
        sfx.pop();
        close('resume');
      }
    },
  );
}

/** "Menu" = leave the app (grid icon). An explicit choice in pause/results → no second confirmation. */
function menuButton(href: string | null | undefined, label: string | undefined, onClick: () => void): HTMLElement {
  const target = href === undefined ? '/menu/' : href;
  const b = h(target ? 'a' : 'button', {
    class: 'g92-btn g92-btn--ghost g92-btn--lg',
    // "Menu" always means leaving the app → grid icon (a custom href is some other "back")
    html: target === null || target === '/menu/' ? LABEL_ICONS.menu : UI_ICONS.back,
    ...(target ? { href: target } : { type: 'button' }),
  });
  b.append(label ?? LABELS.menu);
  b.addEventListener('click', (e) => {
    sfx.tap();
    onClick();
    if (target && !(e instanceof MouseEvent && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey))) {
      e.preventDefault();
      void goToMenu({ href: target, skipGuard: true });
    }
  });
  return b;
}

function statsEl(stats: { label: string; value: number | string; icon?: string }[]): HTMLElement {
  const wrap = h('dl', { class: 'g92-overlay__stats' });
  for (const s of stats) {
    wrap.append(
      h(
        'div',
        { class: 'g92-overlay__stat' },
        h('dt', { html: (s.icon ? iconHTML(s.icon) : '') + escapeHTML(s.label) }),
        h('dd', null, typeof s.value === 'number' ? formatMetric(s.value) : s.value),
      ),
    );
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const STAR_TITLES = ['Zkus to znovu!', 'Dobrá práce!', 'Výborně!', 'Úžasné!'];

export function showResults(opts: ResultsOptions = {}): OverlayPromise<ResultsChoice> {
  const maxStars = opts.maxStars ?? 3;
  const stars = opts.stars === undefined ? undefined : Math.max(0, Math.min(maxStars, Math.round(opts.stars)));
  const celebrate = opts.celebrate ?? true;
  const great = !opts.lost && (opts.isNewBest || (stars !== undefined && stars >= Math.max(1, maxStars - 1)));

  const p = mount<ResultsChoice>(
    opts,
    'results',
    (close, panel) => {
      const titleSaysBest = !opts.title && Boolean(opts.isNewBest);
      const title =
        opts.title ??
        (opts.isNewBest ? 'Nový rekord!' : stars !== undefined ? (STAR_TITLES[Math.round((stars / maxStars) * 3)] ?? 'Hotovo!') : opts.lost ? 'Konec hry' : 'Hotovo!');
      if (stars !== undefined) {
        panel.append(h('div', { class: 'g92-overlay__stars', html: starsHTML(stars, maxStars, 'g92-stars--lg g92-stars--animate') }));
      } else {
        panel.append(h('div', { class: 'g92-overlay__icon g92-overlay__icon--sm', html: opts.lost ? UI_ICONS.restart : UI_ICONS.trophy, 'aria-hidden': 'true' }));
      }
      panel.append(h('h2', { class: 'g92-overlay__title' }, title));
      if (opts.subtitle) panel.append(h('p', { class: 'g92-overlay__subtitle' }, opts.subtitle));

      if (opts.score !== undefined) {
        const scoreEl = h('div', { class: 'g92-overlay__score g92-tabular' }, typeof opts.score === 'number' ? '0' : opts.score);
        const scoreBox = h('div', { class: 'g92-overlay__scorebox' }, scoreEl, h('div', { class: 'g92-overlay__score-label' }, scoreUnit(opts.score, opts.scoreLabel)));
        panel.append(scoreBox);
        if (typeof opts.score === 'number') countUp(scoreEl, opts.score);
      }
      if (opts.isNewBest) {
        // the title already says it → no duplicate badge
        if (!titleSaysBest) panel.append(h('div', { class: 'g92-badge g92-badge--solid g92-overlay__newbest', html: `${UI_ICONS.sparkle}<span>Nový rekord</span>` }));
      } else if (opts.best !== undefined && opts.best !== null && opts.best !== '') {
        panel.append(h('div', { class: 'g92-overlay__best', html: `${UI_ICONS.trophy}<span>${escapeHTML(opts.bestLabel ?? 'Rekord')}: <b>${escapeHTML(formatMetric(opts.best))}</b></span>` }));
      }
      if (opts.stats?.length) panel.append(statsEl(opts.stats));

      const again = h('button', { type: 'button', class: 'g92-btn g92-btn--xl g92-btn--block', 'data-primary': true, html: opts.againIcon ?? UI_ICONS.restart });
      again.append(opts.againLabel ?? LABELS.again);
      again.addEventListener('click', () => {
        sfx.pop();
        close('again');
      });
      const actions = h('div', { class: 'g92-overlay__actions' }, again);
      const row = h('div', { class: 'g92-overlay__row' });
      for (const a of opts.actions ?? []) {
        const b = h('button', { type: 'button', class: `g92-btn g92-btn--lg g92-btn--${a.variant ?? 'secondary'}`, html: a.icon ?? '' });
        b.append(a.label);
        b.addEventListener('click', () => {
          sfx.tap();
          close(a.value);
        });
        row.append(b);
      }
      row.append(menuButton(opts.menuHref, opts.menuLabel, () => close('menu')));
      actions.append(row);
      panel.append(actions);
    },
    (e, close) => {
      if (isTyping(e)) return;
      const active = document.activeElement;
      if ((e.key === 'Enter' || e.key === ' ') && (!active || active === document.body)) {
        e.preventDefault();
        close('again');
      }
    },
  );

  if (celebrate) {
    setTimeout(() => {
      if (opts.lost) sfx.lose();
      else if (great) sfx.win();
      else sfx.success();
      if (great) confetti({ particleCount: opts.isNewBest || stars === maxStars ? 180 : 100, cannons: opts.isNewBest || stars === maxStars });
    }, 150);
  }
  return p;
}

const POINTS: readonly [string, string, string] = ['bod', 'body', 'bodů'];

function scoreUnit(score: number | string, label: ResultsOptions['scoreLabel']): string {
  const forms = label === undefined ? POINTS : label;
  if (typeof forms === 'string') return forms;
  const n = typeof score === 'number' ? score : Number(String(score).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? plural(n, forms[0], forms[1], forms[2]) : forms[2];
}

function countUp(el: HTMLElement, to: number): void {
  if (prefersReducedMotion() || !Number.isFinite(to) || Math.abs(to) < 2) {
    el.textContent = formatMetric(to);
    return;
  }
  const dur = Math.min(1400, 500 + Math.abs(to) * 4);
  const t0 = performance.now();
  const decimals = Number.isInteger(to) ? 0 : 1;
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    const v = to * eased;
    el.textContent = formatMetric(decimals ? Math.round(v * 10) / 10 : Math.round(v));
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Countdown 3-2-1
// ---------------------------------------------------------------------------

export function countdown(opts: CountdownOptions = {}): Promise<void> {
  const from = opts.from ?? 3;
  const step = opts.step ?? 800;
  const container = opts.container ?? document.body;
  const root = h('div', { class: `g92-countdown${container !== document.body ? ' g92-overlay--contained' : ''}`, 'aria-live': 'assertive' });
  container.append(root);
  return new Promise((resolve) => {
    let n = from;
    const show = () => {
      root.textContent = '';
      const final = n === 0;
      const num = h('span', { class: `g92-countdown__num${final ? ' is-go' : ''}` }, final ? (opts.goLabel ?? 'Start!') : String(n));
      root.append(num);
      sfx.countdown(final);
      if (final) {
        setTimeout(() => {
          root.remove();
          resolve();
        }, Math.min(600, step));
      } else {
        n -= 1;
        setTimeout(show, step);
      }
    };
    show();
  });
}

// ---------------------------------------------------------------------------
// Auto-pause
// ---------------------------------------------------------------------------

/**
 * Call `pause` when the page is hidden, loses focus, or a kit dialog opens (help, settings, confirm —
 * `g92-dialog-open`). Returns an unsubscribe function. Opt out per source with the options.
 */
export function autoPause(pause: () => void, opts: { onBlur?: boolean; onDialog?: boolean } = {}): () => void {
  const onVis = () => {
    if (document.visibilityState === 'hidden') pause();
  };
  const onBlur = () => pause();
  const onDialog = () => pause();
  document.addEventListener('visibilitychange', onVis);
  if (opts.onBlur ?? true) window.addEventListener('blur', onBlur);
  if (opts.onDialog ?? true) document.addEventListener('g92-dialog-open', onDialog);
  window.addEventListener('pagehide', onBlur);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('g92-dialog-open', onDialog);
    window.removeEventListener('pagehide', onBlur);
  };
}
