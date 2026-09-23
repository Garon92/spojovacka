/**
 * Registry of every app in the garon92 family. Single source of truth for names,
 * taglines, accents and icons — the menu, <g92-appbar> and PWA manifests read it.
 */

export type AppCategory = 'learn' | 'play' | 'hub';

export type AppId = 'menu' | 'matematika' | 'cestina' | 'anglictina' | 'tanky' | 'ryby' | 'komari' | 'spojovacka' | 'dots';

export interface G92App {
  id: AppId;
  /** Czech display name */
  name: string;
  /** Short line under the name (≤ 32 chars) */
  tagline: string;
  /** One sentence for cards / manifest description */
  description: string;
  category: AppCategory;
  /** Brand colour (hex) — becomes --accent */
  accent: string;
  /** Inline SVG (24×24, currentColor, stroke 2, duotone fills) */
  icon: string;
  /** Absolute path on garon92.github.io */
  path: `/${string}/`;
  /** Optional small tags shown on menu cards */
  tags?: string[];
  /** Label of the headline metric the app reports via activity.ts (for empty states) */
  metricLabel?: string;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const DUO = 'fill="currentColor" fill-opacity=".2"';

export const ICONS = {
  menu: svg(
    `<rect x="3.5" y="3.5" width="7" height="7" rx="2.2" ${DUO}/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2" ${DUO}/>`,
  ),
  matematika: svg(
    `<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" ${DUO} stroke="none"/><path d="M8 5v6M5 8h6M13.5 8h5.5M5.5 14.5l5 5M10.5 14.5l-5 5M13.5 15.5h5.5M13.5 18.5h5.5"/>`,
  ),
  cestina: svg(
    `<path d="M12 6.8C10.2 5.3 7.6 4.5 3.5 4.5v13.2c4.1 0 6.7.7 8.5 2.3 1.8-1.6 4.4-2.3 8.5-2.3V4.5c-4.1 0-6.7.8-8.5 2.3Z" ${DUO}/><path d="M12 6.8V20M6.5 9h2.5M6.5 12.5h2.5M15 9h2.5"/>`,
  ),
  anglictina: svg(
    `<circle cx="12" cy="12" r="9" ${DUO}/><path d="M3 12h18M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3Z"/>`,
  ),
  tanky: svg(
    `<rect x="2.5" y="14" width="19" height="6" rx="3" ${DUO}/><path d="M5.5 14l1.8-3.5h9.4L19 14"/><rect x="8.5" y="6.5" width="6.5" height="4" rx="1.6"/><path d="M15 8.5h6"/><circle cx="7" cy="17" r=".6" fill="currentColor"/><circle cx="12" cy="17" r=".6" fill="currentColor"/><circle cx="17" cy="17" r=".6" fill="currentColor"/>`,
  ),
  ryby: svg(
    `<path d="M21.5 12c-2 3.6-5 5.5-8.5 5.5S7 15.7 5.8 12C7 8.3 9.5 6.5 13 6.5s6.5 1.9 8.5 5.5Z" ${DUO}/><path d="M5.8 12 2.5 8.5v7Z"/><path d="M11 9.6c-.8 1.6-.8 3.2 0 4.8"/><circle cx="16.8" cy="11" r="1.1" fill="currentColor" stroke="none"/>`,
  ),
  komari: svg(
    `<path d="M10.3 11.2C7.6 8.4 4 8.6 3.5 10.8c-.4 2 3 3.1 6.8 1.9M13.7 11.2c2.7-2.8 6.3-2.6 6.8-.4.4 2-3 3.1-6.8 1.9" ${DUO}/><ellipse cx="12" cy="14.8" rx="2.1" ry="4.3" ${DUO}/><circle cx="12" cy="8.6" r="1.7"/><path d="M12 6.9V2.8M10.3 17.3l-3.6 3.2M13.7 17.3l3.6 3.2M10 14.3l-4.5 1.2M14 14.3l4.5 1.2"/>`,
  ),
  spojovacka: svg(
    `<circle cx="7" cy="7" r="3.6" ${DUO}/><path d="M17 3.2 20.8 7 17 10.8 13.2 7Z"/><rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2"/><path d="M17 13.4l4 7.2h-8Z" ${DUO}/>`,
  ),
  dots: svg(
    `<circle cx="9" cy="10" r="4.2" ${DUO}/><circle cx="17" cy="15.8" r="2.7" ${DUO}/><circle cx="17.2" cy="5.6" r="1.6" fill="currentColor" stroke="none"/><circle cx="5.8" cy="18.4" r="1.4" fill="currentColor" stroke="none"/><circle cx="12.2" cy="19.6" r=".9" fill="currentColor" stroke="none"/><path d="M12.6 12.4l2.2 1.6" stroke-dasharray="1 2.5"/>`,
  ),
} as const satisfies Record<AppId, string>;

export const APPS: readonly G92App[] = [
  {
    id: 'menu',
    name: 'Menu',
    tagline: 'Všechno na jednom místě',
    description: 'Rozcestník her a procvičování pro celou rodinu.',
    category: 'hub',
    accent: '#6d5dfc',
    icon: ICONS.menu,
    path: '/menu/',
  },
  {
    id: 'matematika',
    name: 'Matematika',
    tagline: 'Počítání hrou',
    description: 'Sčítání, odčítání, násobení i dělení — příklady, hvězdičky a počítadlo.',
    category: 'learn',
    accent: '#7c5cff',
    icon: ICONS.matematika,
    path: '/matematika/',
    metricLabel: 'Příkladů',
  },
  {
    id: 'cestina',
    name: 'Čeština',
    tagline: 'Čtení a psaní pro Adámka',
    description: 'Abeceda, slova, věty, poslech a psaní — krok za krokem.',
    category: 'learn',
    accent: '#e0479e',
    icon: ICONS.cestina,
    path: '/cestina/',
    metricLabel: 'Hotovo',
  },
  {
    id: 'anglictina',
    name: 'Angličtina',
    tagline: 'Příprava na maturitu',
    description: 'Slovíčka, gramatika, čtení s porozuměním a cvičné testy k maturitě.',
    category: 'learn',
    accent: '#3b82f6',
    icon: ICONS.anglictina,
    path: '/anglictina/',
    metricLabel: 'Hotovo',
  },
  {
    id: 'tanky',
    name: 'Tanky',
    tagline: 'Tanková bitva',
    description: 'Zamiř, vystřel a přechytrač soupeře v tankové bitvě.',
    category: 'play',
    accent: '#ef5350',
    icon: ICONS.tanky,
    path: '/tanky/',
    metricLabel: 'Rekord',
  },
  {
    id: 'ryby',
    name: 'Ryby',
    tagline: 'Rybaření u nás doma',
    description: 'Nahoď prut a chytej české ryby — album úlovků, mise a odměny.',
    category: 'play',
    accent: '#0ea5e9',
    icon: ICONS.ryby,
    path: '/ryby/',
    metricLabel: 'Rekord',
  },
  {
    id: 'komari',
    name: 'Komáři',
    tagline: 'Plácni je všechny!',
    description: 'Bzzz… rychle, než tě štípnou! Plácačka na komáry.',
    category: 'play',
    accent: '#22c55e',
    icon: ICONS.komari,
    path: '/komari/',
    metricLabel: 'Rekord',
  },
  {
    id: 'spojovacka',
    name: 'Spojovačka',
    tagline: 'Spoj tři stejné',
    description: 'Prohazuj barevné tvary, skládej řady a odpal rakety a bomby.',
    category: 'play',
    accent: '#f59e0b',
    icon: ICONS.spojovacka,
    path: '/spojovacka/',
    metricLabel: 'Rekord',
  },
  {
    id: 'dots',
    name: 'Dots',
    tagline: 'Živé barevné tečky',
    description: 'Simulace „particle life": z pár pravidel vznikají buňky, řetězy i lov.',
    category: 'play',
    accent: '#14b8a6',
    icon: ICONS.dots,
    path: '/dots/',
    tags: ['simulace'],
  },
];

export const APP_BY_ID: Readonly<Record<AppId, G92App>> = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, G92App>;

export function getApp(id: string | null | undefined): G92App | undefined {
  return id ? (APP_BY_ID as Record<string, G92App | undefined>)[id] : undefined;
}

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  learn: 'Učení',
  play: 'Hry',
  hub: 'Rozcestník',
};

type StyleTarget = { style: { setProperty(name: string, value: string): void } };

/** Apply an app's accent (id or colour) to :root or another element. DOM-free typing so vite.config can import this file. */
export function applyAccent(idOrColor: string, el?: StyleTarget | null): void {
  const target = el ?? (globalThis as { document?: { documentElement: StyleTarget } }).document?.documentElement;
  if (!target) return;
  const color = getApp(idOrColor)?.accent ?? idOrColor;
  target.style.setProperty('--accent', color);
}

/** Mix a hex colour with white (t>0) or black (t<0). */
export function shade(hex: string, t: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return '#' + rgb.map((c) => Math.round(c + (target - c) * k).toString(16).padStart(2, '0')).join('');
}

/**
 * Standalone app icon SVG (favicon / PWA icon source): accent gradient tile + white glyph.
 * maskable → full-bleed square with the glyph inside the safe zone.
 */
export function appIconSvg(idOrApp: AppId | G92App, opts: { maskable?: boolean; size?: number } = {}): string {
  const app = typeof idOrApp === 'string' ? APP_BY_ID[idOrApp] : idOrApp;
  const size = opts.size ?? 512;
  const inner = app.icon.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const light = shade(app.accent, 0.28);
  const dark = shade(app.accent, -0.18);
  const glyph = opts.maskable ? 0.5 : 0.62; // share of the tile
  const scale = (512 * glyph) / 24;
  const offset = (512 - 24 * scale) / 2;
  const rx = opts.maskable ? 0 : 116;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs><linearGradient id="g92g-${app.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${app.accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="g92h-${app.id}" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" rx="${rx}" fill="url(#g92g-${app.id})"/><rect width="512" height="512" rx="${rx}" fill="url(#g92h-${app.id})"/>
<g transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${scale.toFixed(4)})" color="#fff" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;
}
