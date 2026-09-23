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
  setItem(key: string, value: string): void {
    memory.set(key, value);
    const s = ls();
    if (s) {
      try {
        s.setItem(key, value);
      } catch {
        /* quota or disabled: keep in memory */
      }
    }
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

export function writeJSON(key: string, value: unknown): void {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* non-serialisable: ignore */
  }
}

/** @internal for tests */
export function __resetStorageForTests(): void {
  memory.clear();
  native = undefined;
}
