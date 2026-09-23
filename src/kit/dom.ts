/** Small DOM helpers + UI icon set shared by kit components (and handy for apps). */
import { plural } from './cz';

export { plural };

const svg = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

/** UI icons (24×24, currentColor). */
export const UI_ICONS = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  home: svg('<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>'),
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor" fill-opacity=".2"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor" fill-opacity=".2"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  fullscreen: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
  fullscreenExit: svg('<path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  help: svg('<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity=".12"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><circle cx="12" cy="17.2" r=".4" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor"/>'),
  restart: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  cross: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0Z" fill="currentColor" fill-opacity=".2"/><path d="M8 5.5H5a2.5 2.5 0 0 0 3 4M16 5.5h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5"/>'),
  sparkle: svg('<path d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9L12 17.7l-1.9-5.2-5.2-1.9 5.2-1.9Z" fill="currentColor" fill-opacity=".2"/><path d="M19 16.5v4M17 18.5h4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity=".2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" fill-opacity=".2"/>'),
  auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" fill="currentColor"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.8" fill="currentColor" fill-opacity=".2"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
  flame: svg('<path d="M12 3c.5 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2.2 1.1-3.6 2.2-4.6.2 1.6 1 2.6 2 2.6-.4-3 .3-5.5.8-8Z" fill="currentColor" fill-opacity=".2"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.6c.4 0 .8.2 1 .6l2.4 4.9 5.4.8c.9.1 1.3 1.2.6 1.9l-3.9 3.8.9 5.4c.2.9-.8 1.6-1.6 1.2L12 18.6l-4.8 2.6c-.8.4-1.8-.3-1.6-1.2l.9-5.4-3.9-3.8c-.7-.7-.3-1.8.6-1.9l5.4-.8L11 3.2c.2-.4.6-.6 1-.6Z"/></svg>',
} as const;

export type UiIconName = keyof typeof UI_ICONS;

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener> & {
  html?: string;
  style?: string;
};

/**
 * Hyperscript: h('button', { class: 'g92-btn', onclick: fn }, 'Hrát')
 * Attributes starting with `on` become listeners; `html` sets innerHTML (trusted strings only).
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElement;
export function h(tag: string, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') el.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Stars markup: `starsHTML(2)` → ★★☆ (use inside any element; add class g92-stars--lg / --animate). */
export function starsHTML(count: number, max = 3, extraClass = ''): string {
  const n = Math.max(0, Math.min(max, Math.round(count)));
  let s = '';
  for (let i = 0; i < max; i++) s += UI_ICONS.star.replace('<svg ', `<svg class="g92-star${i < n ? ' is-on' : ''}" `);
  return `<span class="g92-stars ${extraClass}" role="img" aria-label="${n} ${pluralStars(n)} z ${max}">${s}</span>`;
}

function pluralStars(n: number): string {
  return plural(n, 'hvězda', 'hvězdy', 'hvězd');
}

/** Re-trigger a CSS animation class (e.g. g92-anim-shake) on an element. */
export function flash(el: Element, className: 'g92-anim-shake' | 'g92-anim-pop' | string): void {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
  el.addEventListener('animationend', () => el.classList.remove(className), { once: true });
}

/** Keep a .g92-range's filled track in sync (WebKit has no ::range-progress). */
export function bindRange(input: HTMLInputElement): () => void {
  const update = () => {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const pct = ((Number(input.value) - min) / (max - min || 1)) * 100;
    input.style.setProperty('--_pct', `${pct}%`);
  };
  update();
  input.addEventListener('input', update);
  return () => input.removeEventListener('input', update);
}
