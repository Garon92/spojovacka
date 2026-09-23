/**
 * vite-plugin-pwa options for a g92 app — one line in vite.config.ts:
 *
 *   import { VitePWA } from 'vite-plugin-pwa';
 *   import { g92Pwa } from './src/kit/pwa';
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
import { APP_BY_ID, type AppId } from './apps';

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
  const app = APP_BY_ID[appId];
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
