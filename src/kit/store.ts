/**
 * Namespaced, versioned, typed persistent store for one app.
 * Every key lives in localStorage as `g92:<appId>:<key>` (JSON). Safe in private mode.
 *
 *   const store = createStore('tanky', {
 *     version: 2,
 *     defaults: { best: 0, difficulty: 'normal' as 'easy' | 'normal' | 'hard', muted: false },
 *     migrate(from, m) {                   // runs once when stored version < version
 *       if (from < 1) m.adopt('tankyHighScore', 'best', Number);   // legacy key → new key
 *     },
 *   });
 *   store.get('best');                      // number
 *   store.set('best', 42);
 *   store.update('best', (b) => b + 1);
 *   store.submitBest('best', score)          // { best, isNewBest }
 *   store.subscribe((key, value) => …);
 */
import { safeStorage } from './storage';

export interface MigrationApi<T> {
  /** Raw string of any localStorage key (e.g. the app's pre-kit keys). */
  legacy(key: string): string | null;
  /** Parsed JSON of any key, or undefined. */
  legacyJSON<V = unknown>(key: string): V | undefined;
  /** Remove any raw key. */
  removeLegacy(key: string): void;
  /** Copy a legacy key into a store key (optionally transformed) and remove the legacy key. Returns true if adopted. */
  adopt<K extends keyof T>(legacyKey: string, key: K, transform?: (raw: string) => T[K] | undefined): boolean;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
}

export interface StoreOptions<T> {
  version?: number;
  defaults: T;
  migrate?: (fromVersion: number, api: MigrationApi<T>) => void;
}

export type StoreListener<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface Store<T> {
  readonly appId: string;
  readonly version: number;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  update<K extends keyof T>(key: K, fn: (value: T[K]) => T[K]): T[K];
  /** Patch several keys at once. */
  patch(values: Partial<T>): void;
  /** Snapshot of all keys. */
  all(): T;
  /** Reset one key (or everything) to defaults. */
  reset(key?: keyof T): void;
  /** Store `value` if it beats the current one (higher wins unless lowerIsBetter). */
  submitBest<K extends keyof T>(key: K, value: number, opts?: { lowerIsBetter?: boolean }): { best: number; isNewBest: boolean };
  subscribe(fn: (key: keyof T, value: T[keyof T]) => void): () => void;
  /** Full storage key for a store key (for debugging). */
  keyOf(key: keyof T): string;
}

const VERSION_KEY = '__version';

function clone<V>(v: V): V {
  if (v === null || typeof v !== 'object') return v;
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as V;
  }
}

export function createStore<T extends Record<string, unknown>>(appId: string, options: StoreOptions<T>): Store<T> {
  const version = options.version ?? 1;
  const defaults = options.defaults;
  const prefix = `g92:${appId}:`;
  const listeners = new Set<(key: keyof T, value: T[keyof T]) => void>();
  const cache = new Map<keyof T, unknown>();

  const keyOf = (key: keyof T) => prefix + String(key);

  function read<K extends keyof T>(key: K): T[K] {
    if (cache.has(key)) return cache.get(key) as T[K];
    const raw = safeStorage.getItem(keyOf(key));
    let value: T[K];
    if (raw === null) value = clone(defaults[key]);
    else {
      try {
        value = JSON.parse(raw) as T[K];
      } catch {
        value = clone(defaults[key]);
      }
    }
    cache.set(key, value);
    return value;
  }

  function write<K extends keyof T>(key: K, value: T[K], notify = true): void {
    cache.set(key, value);
    if (value === undefined) safeStorage.removeItem(keyOf(key));
    else safeStorage.setItem(keyOf(key), JSON.stringify(value));
    if (notify) for (const fn of [...listeners]) fn(key, value);
  }

  // ---- versioning / migration ----
  const storedVersionRaw = safeStorage.getItem(prefix + VERSION_KEY);
  const storedVersion = storedVersionRaw === null ? 0 : Number(storedVersionRaw) || 0;
  if (storedVersion < version) {
    if (options.migrate) {
      const api: MigrationApi<T> = {
        legacy: (k) => safeStorage.getItem(k),
        legacyJSON: <V>(k: string) => {
          const raw = safeStorage.getItem(k);
          if (raw === null) return undefined;
          try {
            return JSON.parse(raw) as V;
          } catch {
            return undefined;
          }
        },
        removeLegacy: (k) => safeStorage.removeItem(k),
        adopt: (legacyKey, key, transform) => {
          const raw = safeStorage.getItem(legacyKey);
          if (raw === null) return false;
          let v: T[typeof key] | undefined;
          if (transform) v = transform(raw);
          else {
            try {
              v = JSON.parse(raw) as T[typeof key];
            } catch {
              v = raw as unknown as T[typeof key];
            }
          }
          if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return false;
          write(key, v, false);
          safeStorage.removeItem(legacyKey);
          return true;
        },
        get: (k) => read(k),
        set: (k, v) => write(k, v, false),
      };
      try {
        options.migrate(storedVersion, api);
      } catch (e) {
        console.error(`[g92 store:${appId}] migration failed`, e);
      }
    }
    safeStorage.setItem(prefix + VERSION_KEY, String(version));
  }

  // cross-tab: drop cache entries changed elsewhere
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(prefix)) {
        if (e.key === null) cache.clear();
        return;
      }
      const k = e.key.slice(prefix.length) as keyof T;
      if (!(k in defaults)) return;
      cache.delete(k);
      const v = read(k);
      for (const fn of [...listeners]) fn(k, v);
    });
  }

  const store: Store<T> = {
    appId,
    version,
    get: read,
    set: (key, value) => write(key, value),
    update(key, fn) {
      const next = fn(read(key));
      write(key, next);
      return next;
    },
    patch(values) {
      for (const k of Object.keys(values) as (keyof T)[]) write(k, values[k] as T[keyof T]);
    },
    all() {
      const out = {} as T;
      for (const k of Object.keys(defaults) as (keyof T)[]) out[k] = read(k);
      return out;
    },
    reset(key) {
      const keys = key === undefined ? (Object.keys(defaults) as (keyof T)[]) : [key];
      for (const k of keys) {
        cache.delete(k);
        safeStorage.removeItem(keyOf(k));
        const v = read(k);
        for (const fn of [...listeners]) fn(k, v);
      }
    },
    submitBest(key, value, opts) {
      const cur = read(key);
      let curNum = typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
      // lower-is-better (times, moves): a stored 0 means "no record yet"
      if (opts?.lowerIsBetter && curNum === 0) curNum = null;
      const isNewBest = Number.isFinite(value) && (curNum === null || (opts?.lowerIsBetter ? value < curNum : value > curNum));
      if (isNewBest) write(key, value as T[typeof key]);
      return { best: isNewBest ? value : (curNum ?? value), isNewBest };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    keyOf,
  };
  return store;
}
