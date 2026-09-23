/**
 * Global settings shared by every g92 app (same origin → same localStorage).
 * Key: `g92:settings`. Importing this module applies theme/motion to <html>.
 *
 *   import { settings } from './kit';
 *   settings.get().sound            // boolean
 *   settings.set({ theme: 'dark' })
 *   const off = settings.subscribe((s) => …)   // also fires on changes from other tabs
 */
import { readJSON, writeJSON } from './storage';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export type MotionSetting = 'auto' | 'on' | 'off'; // on = reduce motion, off = full motion

export interface G92Settings {
  sound: boolean;
  /** 0..1 */
  volume: number;
  theme: ThemeSetting;
  reducedMotion: MotionSetting;
  playerName: string;
}

export const SETTINGS_KEY = 'g92:settings';

export const DEFAULT_SETTINGS: Readonly<G92Settings> = Object.freeze({
  sound: true,
  volume: 0.7,
  theme: 'auto',
  reducedMotion: 'auto',
  playerName: '',
});

type Listener = (s: Readonly<G92Settings>, prev: Readonly<G92Settings>) => void;
const listeners = new Set<Listener>();
let current: Readonly<G92Settings> = load();

function sanitize(raw: unknown): G92Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof G92Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  const vol = typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : d.volume;
  return {
    sound: typeof r.sound === 'boolean' ? r.sound : d.sound,
    volume: vol,
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'auto' ? r.theme : d.theme,
    reducedMotion: r.reducedMotion === 'on' || r.reducedMotion === 'off' || r.reducedMotion === 'auto' ? r.reducedMotion : d.reducedMotion,
    playerName: typeof r.playerName === 'string' ? r.playerName.slice(0, 40) : d.playerName,
  };
}

function load(): Readonly<G92Settings> {
  return Object.freeze(sanitize(readJSON<unknown>(SETTINGS_KEY, {})));
}

function mql(q: string): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia(q) : null;
  } catch {
    return null;
  }
}

/** 'light' | 'dark' actually in effect (resolves 'auto' via the OS). */
export function resolvedTheme(s: Readonly<G92Settings> = current): 'light' | 'dark' {
  if (s.theme !== 'auto') return s.theme;
  return mql('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/** True when animations should be minimised (setting or OS preference). */
export function prefersReducedMotion(s: Readonly<G92Settings> = current): boolean {
  if (s.reducedMotion === 'on') return true;
  if (s.reducedMotion === 'off') return false;
  return mql('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/** Reflect settings on <html>: data-theme (only when forced), data-scheme (resolved), data-motion. */
export function applySettings(s: Readonly<G92Settings> = current): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.setAttribute('data-scheme', resolvedTheme(s));
  if (s.reducedMotion === 'auto') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', s.reducedMotion === 'on' ? 'reduce' : 'full');
}

function emit(prev: Readonly<G92Settings>): void {
  applySettings(current);
  for (const fn of [...listeners]) {
    try {
      fn(current, prev);
    } catch (e) {
      console.error(e);
    }
  }
}

export function getSettings(): G92Settings {
  return { ...current };
}

/** Referentially stable, frozen snapshot (changes identity only when settings change) — for React's useSyncExternalStore. */
export function getSettingsSnapshot(): Readonly<G92Settings> {
  return current;
}

export function setSettings(patch: Partial<G92Settings>): G92Settings {
  const prev = current;
  current = Object.freeze(sanitize({ ...current, ...patch }));
  writeJSON(SETTINGS_KEY, current);
  emit(prev);
  return { ...current };
}

export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-read from storage (used by the cross-tab listener; handy in tests). */
export function reloadSettings(): void {
  const prev = current;
  current = load();
  emit(prev);
}

export const settings = {
  get: getSettings,
  snapshot: getSettingsSnapshot,
  set: setSettings,
  subscribe: subscribeSettings,
  reload: reloadSettings,
  resolvedTheme,
  prefersReducedMotion,
  defaults: DEFAULT_SETTINGS,
};

// ---- side effects on import (browser only) --------------------------------
if (typeof window !== 'undefined') {
  applySettings(current);
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY || e.key === null) reloadSettings();
  });
  const onSystemChange = () => emit(current);
  mql('(prefers-color-scheme: dark)')?.addEventListener?.('change', onSystemChange);
  mql('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', onSystemChange);
}
