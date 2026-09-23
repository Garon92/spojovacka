/**
 * vite-plugin-pwa options for a g92 app — one line in vite.config.ts:
 *
 *   import { VitePWA } from 'vite-plugin-pwa';
 *   import { g92Pwa } from './src/kit/pwa';   // or './src/kit/pwa.ts' (needs allowImportingTsExtensions)
 *   export default defineConfig({ base: '/tanky/', plugins: [VitePWA(g92Pwa('tanky'))] });
 *
 * Icons expected in public/: favicon.svg, pwa-192.png, pwa-512.png, pwa-maskable-512.png, apple-touch-icon.png
 * Generate them (from the registry icon + accent):
 *   node --experimental-strip-types ~/AI/garon92-pages/menu/kit/scripts/pwa-icons.mjs tanky ./public
 * and add to index.html <head>:
 *   <link rel="icon" href="/tanky/favicon.svg" type="image/svg+xml">   (Vite rewrites %BASE_URL% too)
 *   <link rel="apple-touch-icon" href="/tanky/apple-touch-icon.png">
 *   <meta name="theme-color" content="<accent>">
 * This file must stay free of DOM APIs (it runs in Node inside vite.config).
 */
// NB: no imports here — Vite's native config loader (future default) wants import paths with extensions,
// which not every app tsconfig allows. The table below mirrors apps.ts; tests/pwa.test.ts keeps them in sync.
type AppId = 'menu' | 'matematika' | 'cestina' | 'anglictina' | 'tanky' | 'ryby' | 'komari' | 'spojovacka' | 'dots';
interface PwaApp {
  id: AppId;
  name: string;
  tagline: string;
  description: string;
  category: 'learn' | 'play' | 'hub';
  accent: string;
  path: `/${string}/`;
}
export const PWA_APPS: Record<AppId, PwaApp> = {
  menu: { id: 'menu', name: 'Menu', tagline: 'Všechno na jednom místě', description: 'Rozcestník her a procvičování pro celou rodinu.', category: 'hub', accent: '#6d5dfc', path: '/menu/' },
  matematika: { id: 'matematika', name: 'Matematika', tagline: 'Počítání hrou', description: 'Sčítání, odčítání, násobení i dělení — příklady, hvězdičky a počítadlo.', category: 'learn', accent: '#7c5cff', path: '/matematika/' },
  cestina: { id: 'cestina', name: 'Čeština', tagline: 'Čtení a psaní pro Adámka', description: 'Abeceda, slova, věty, poslech a psaní — krok za krokem.', category: 'learn', accent: '#e0479e', path: '/cestina/' },
  anglictina: { id: 'anglictina', name: 'Angličtina', tagline: 'Příprava na maturitu', description: 'Slovíčka, gramatika, čtení s porozuměním a cvičné testy k maturitě.', category: 'learn', accent: '#3b82f6', path: '/anglictina/' },
  tanky: { id: 'tanky', name: 'Tanky', tagline: 'Tanková bitva', description: 'Zamiř, vystřel a přechytrač soupeře v tankové bitvě.', category: 'play', accent: '#ef5350', path: '/tanky/' },
  ryby: { id: 'ryby', name: 'Ryby', tagline: 'Rybaření u nás doma', description: 'Nahoď prut a chytej české ryby — album úlovků, mise a odměny.', category: 'play', accent: '#0ea5e9', path: '/ryby/' },
  komari: { id: 'komari', name: 'Komáři', tagline: 'Plácni je všechny!', description: 'Bzzz… rychle, než tě štípnou! Plácačka na komáry.', category: 'play', accent: '#22c55e', path: '/komari/' },
  spojovacka: { id: 'spojovacka', name: 'Spojovačka', tagline: 'Spoj tři stejné', description: 'Prohazuj barevné tvary, skládej řady a odpal rakety a bomby.', category: 'play', accent: '#f59e0b', path: '/spojovacka/' },
  dots: { id: 'dots', name: 'Dots', tagline: 'Živé barevné tečky', description: 'Simulace „particle life": z pár pravidel vznikají buňky, řetězy i lov.', category: 'play', accent: '#14b8a6', path: '/dots/' },
};

export interface G92PwaOverrides {
  name?: string;
  shortName?: string;
  description?: string;
  /** 'standalone' (default) or 'fullscreen' for games that want it */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui';
  orientation?: 'any' | 'portrait' | 'landscape';
  /** extra glob patterns to precache (default covers js/css/html/svg/png/webp/woff2/json/mp3) */
  globPatterns?: string[];
  /** big assets (MB) allowed in precache (default 6) */
  maxFileSizeMB?: number;
  /** runtime caching rules passed to workbox (workbox RuntimeCaching[]) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtimeCaching?: any[];
  /** paths that must not fall back to index.html (multi-page apps) */
  navigateFallbackDenylist?: RegExp[];
  /** disable the SPA navigate fallback (multi-page apps) */
  noNavigateFallback?: boolean;
  /** passed through to VitePWA (merged last) */
  extra?: Record<string, unknown>;
}

export function g92Pwa(appId: AppId, o: G92PwaOverrides = {}) {
  const app = PWA_APPS[appId];
  if (!app) throw new Error(`g92Pwa: unknown app "${appId}"`);
  const scope = app.path;
  const categories = app.category === 'learn' ? ['education', 'kids'] : app.category === 'play' ? ['games', 'kids', 'entertainment'] : ['kids', 'education', 'games'];
  return {
    registerType: 'autoUpdate' as const,
    injectRegister: 'auto' as const,
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      id: scope,
      name: o.name ?? (app.id === 'menu' ? 'garon92 — hry a učení' : `${app.name} — ${app.tagline}`),
      short_name: o.shortName ?? app.name,
      description: o.description ?? app.description,
      lang: 'cs',
      dir: 'ltr' as const,
      start_url: scope,
      scope,
      display: o.display ?? ('standalone' as const),
      orientation: o.orientation ?? ('any' as const),
      theme_color: app.accent,
      background_color: '#f5f6fb',
      categories,
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    workbox: {
      globPatterns: o.globPatterns ?? ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,avif,woff2,json,mp3,ogg,wav,ico,webmanifest}'],
      maximumFileSizeToCacheInBytes: (o.maxFileSizeMB ?? 6) * 1024 * 1024,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      ...(o.noNavigateFallback ? { navigateFallback: null } : { navigateFallback: 'index.html', navigateFallbackDenylist: o.navigateFallbackDenylist ?? [] }),
      ...(o.runtimeCaching ? { runtimeCaching: o.runtimeCaching } : {}),
    },
    devOptions: { enabled: false },
    ...(o.extra ?? {}),
  };
}
