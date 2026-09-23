/**
 * Safe localStorage wrapper. Never throws (private mode, disabled storage, quota):
 * falls back to an in-memory map for the lifetime of the page.
 */
const memory = new Map<string, string>();
let native: Storage | null | undefined;

function ls(): Storage | null {
  if (native !== undefined) return native;
  try {
    const s = globalThis.localStorage;
    const probe = '__g92_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    native = s;
  } catch {
    native = null;
  }
  return native;
}

export const safeStorage = {
  /** True when values survive a reload (real localStorage works). */
  get persistent(): boolean {
    return ls() !== null;
  },
  getItem(key: string): string | null {
    const s = ls();
    if (s) {
      try {
        return s.getItem(key);
      } catch {
        /* fall through */
      }
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  /** Returns false when the value could not be persisted (quota full) — it is still kept in memory. */
  setItem(key: string, value: string): boolean {
    memory.set(key, value);
    const s = ls();
    if (s) {
      try {
        s.setItem(key, value);
      } catch (e) {
        reportWriteError(key, e);
        return false;
      }
    }
    return true;
  },
  removeItem(key: string): void {
    memory.delete(key);
    const s = ls();
    if (s) {
      try {
        s.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  },
  /** All keys starting with prefix. */
  keys(prefix = ''): string[] {
    const out = new Set<string>();
    const s = ls();
    if (s) {
      try {
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k !== null && k.startsWith(prefix)) out.add(k);
        }
      } catch {
        /* ignore */
      }
    }
    for (const k of memory.keys()) if (k.startsWith(prefix)) out.add(k);
    return [...out];
  },
};

let reported = false;

/**
 * A write failed (usually QuotaExceededError — all g92 apps share ~5 MB on one origin).
 * Dispatches `g92-storage-error` on window once per page; <g92-appbar> turns it into a toast.
 */
function reportWriteError(key: string, error: unknown): void {
  if (reported || typeof window === 'undefined') return;
  reported = true;
  try {
    window.dispatchEvent(new CustomEvent('g92-storage-error', { detail: { key, error } }));
  } catch {
    /* ignore */
  }
}

/** JSON helpers that never throw. */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be persisted. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    return safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-serialisable: ignore */
    return false;
  }
}

/** @internal for tests */
export function __resetStorageForTests(): void {
  memory.clear();
  native = undefined;
  reported = false;
}
