export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

export interface Anim {
  start: number;
  dur: number;
  started?: boolean;
  onStart?: () => void;
  update?: (p: number, now: number) => void;
  onEnd?: () => void;
}

/** Minimal time-based animation runner driven by the render loop. */
export class Animator {
  private list: Anim[] = [];
  private waiters: { at: number; resolve: () => void }[] = [];

  add(a: Anim): Anim {
    this.list.push(a);
    return a;
  }

  /** resolve when `now` passes `at` */
  until(at: number): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ at, resolve }));
  }

  get busy() {
    return this.list.length > 0;
  }

  tick(now: number) {
    if (this.list.length) {
      const current = this.list;
      this.list = [];
      const keep: Anim[] = [];
      for (const a of current) {
        if (now < a.start) {
          keep.push(a);
          continue;
        }
        if (!a.started) {
          a.started = true;
          a.onStart?.();
        }
        const p = a.dur <= 0 ? 1 : clamp((now - a.start) / a.dur, 0, 1);
        a.update?.(p, now);
        if (p >= 1) a.onEnd?.();
        else keep.push(a);
      }
      // animations created inside callbacks were pushed to the fresh list
      this.list = keep.concat(this.list);
    }
    if (this.waiters.length) {
      const ready = this.waiters.filter((w) => now >= w.at);
      if (ready.length) {
        this.waiters = this.waiters.filter((w) => now < w.at);
        for (const w of ready) w.resolve();
      }
    }
  }

  /** finish everything immediately (e.g. when leaving the screen) */
  flush() {
    const list = this.list;
    this.list = [];
    for (const a of list) {
      if (!a.started) a.onStart?.();
      a.update?.(1, Infinity);
      a.onEnd?.();
    }
    this.list = [];
    const w = this.waiters;
    this.waiters = [];
    for (const x of w) x.resolve();
  }
}
