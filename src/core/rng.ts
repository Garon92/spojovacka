/** Small, fast, seedable PRNG (mulberry32). Deterministic → reproducible levels and tests. */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  /** current internal state (for cloning) */
  get state(): number;
  clone(): Rng;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const rng: Rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) {
      return Math.floor(rng.next() * n);
    },
    pick(arr) {
      return arr[rng.int(arr.length)];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
    get state() {
      return s;
    },
    clone() {
      return createRng(s);
    },
  };
  return rng;
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
