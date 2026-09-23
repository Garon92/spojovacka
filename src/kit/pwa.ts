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
  dots: { id: 'dots', name: 'Dots', tagline: 'Živé barevné tečky', description: 'Živá simulace částic: z pár pravidel vznikají buňky, řetězy i lov.', category: 'play', accent: '#14b8a6', path: '/dots/' },
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
  /** extra files NOT to precache (italic fonts and 404.html are always ignored) */
  globIgnores?: string[];
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

const MENU_TITLE = 'Garon92 – hry a učení';
const MENU_SHORT_NAME = 'Hry a učení';

/** Family title format for <title> and the manifest: "‹Name› – ‹tagline›" (en dash). */
export function pwaTitle(appId: AppId): string {
  const app = PWA_APPS[appId];
  return app.id === 'menu' ? MENU_TITLE : `${app.name} – ${app.tagline}`;
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
      name: o.name ?? pwaTitle(app.id),
      short_name: o.shortName ?? (app.id === 'menu' ? MENU_SHORT_NAME : app.name),
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
      // italic Nunito is never used by default — don't precache it (+ the 404 page)
      globIgnores: ['**/*italic*', '**/404.html', ...(o.globIgnores ?? [])],
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

// ---------------------------------------------------------------------------
// Czech 404 page per app (GitHub Pages serves /<app>/404.html for unknown paths)
// ---------------------------------------------------------------------------

interface EmitCtx {
  emitFile(file: { type: 'asset'; fileName: string; source: string | Uint8Array }): string;
  warn?(msg: string): void;
}
type BundleItem = { type: string; fileName?: string; source?: string | Uint8Array };

/**
 * Vite plugin: emits dist/404.html.
 *   plugins: [VitePWA(g92Pwa('tanky')), g92NotFoundPage('tanky')]
 * `spa: true` (apps with path routes, e.g. angličtina) copies the built index.html, so deep links render the
 * app instead of GitHub's English error page. Otherwise a small Czech page with a big "Zpět do aplikace" button.
 */
export function g92NotFoundPage(appId: AppId, o: { spa?: boolean } = {}) {
  const app = PWA_APPS[appId];
  return {
    name: 'g92-404',
    apply: 'build' as const,
    enforce: 'post' as const,
    generateBundle(this: EmitCtx, _options: unknown, bundle: Record<string, BundleItem>) {
      if (o.spa) {
        const index = bundle['index.html'];
        if (index && index.source !== undefined) {
          this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
          return;
        }
        this.warn?.('g92NotFoundPage: index.html not found in bundle, emitting the static 404 page');
      }
      this.emitFile({ type: 'asset', fileName: '404.html', source: notFoundHtml(app) });
    },
  };
}

function notFoundHtml(app: PwaApp): string {
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Stránka nenalezena – ${app.name}</title>
<link rel="icon" href="${app.path}favicon.svg" type="image/svg+xml">
<style>
:root{--a:${app.accent};--bg:#f5f6fb;--s:#fff;--t:#161a2e;--m:#595f7a;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0c0f1d;--s:#161a2f;--t:#eef0fb;--m:#a6acc8}}
*{box-sizing:border-box;margin:0}
body{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(60rem 30rem at 50% -10rem,color-mix(in oklab,var(--a) 18%,transparent),transparent 70%),var(--bg);color:var(--t);font:500 17px/1.5 'Nunito Variable',Nunito,ui-rounded,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center}
main{max-width:26rem;padding:36px 28px;border-radius:32px;background:var(--s);box-shadow:0 20px 50px -20px rgb(0 0 0/.25)}
.i{font-size:64px;line-height:1}
h1{margin:12px 0 6px;font-size:28px;font-weight:900;letter-spacing:-.02em}
p{color:var(--m)}
a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;margin-top:22px;border-radius:18px;font-weight:900;text-decoration:none}
.p{background:var(--a);color:#fff;font-size:20px;box-shadow:inset 0 -4px 0 rgb(0 0 0/.15)}
.s{min-height:48px;margin-top:10px;color:var(--t);border:2px solid color-mix(in oklab,var(--t) 15%,transparent)}
</style>
</head>
<body>
<main>
<div class="i" aria-hidden="true">🧭</div>
<h1>Tahle stránka tu není</h1>
<p>Možná se změnila adresa. Nevadí — pokračuj v aplikaci ${app.name}.</p>
<a class="p" href="${app.path}">Zpět do aplikace</a>
${app.id === 'menu' ? '' : '<a class="s" href="/menu/">Menu – všechny hry a cvičení</a>'}
</main>
</body>
</html>
`;
}
