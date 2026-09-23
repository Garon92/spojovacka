import { isSwappable, swapTiles } from './board';
import { matchSizeAt } from './match';
import type { Board, Pos, Special } from './types';

export interface SwapCandidate {
  a: Pos;
  b: Pos;
  /** rough value: size of the resulting match(es); specials score higher */
  value: number;
  /** does the swap involve a special piece? */
  special: boolean;
}

const SPECIAL_VALUE: Record<Special, number> = {
  none: 0,
  rocketH: 8,
  rocketV: 8,
  bomb: 10,
  butterfly: 6,
  rainbow: 14,
};

/** All valid swaps on the board. */
export function findSwaps(b: Board, limit = Infinity): SwapCandidate[] {
  const out: SwapCandidate[] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!isSwappable(b, x, y)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isSwappable(b, nx, ny)) continue;
        const ta = b.cells[y * b.w + x].tile!;
        const tb = b.cells[ny * b.w + nx].tile!;
        const a = { x, y };
        const c = { x: nx, y: ny };
        if (ta.special !== 'none' || tb.special !== 'none') {
          const both = ta.special !== 'none' && tb.special !== 'none';
          out.push({
            a,
            b: c,
            value: SPECIAL_VALUE[ta.special] + SPECIAL_VALUE[tb.special] + (both ? 12 : 0),
            special: true,
          });
        } else {
          swapTiles(b, a, c);
          const va = matchSizeAt(b, x, y);
          const vb = matchSizeAt(b, nx, ny);
          swapTiles(b, a, c);
          if (va > 0 || vb > 0) out.push({ a, b: c, value: va + vb, special: false });
        }
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** Specials that can be activated by tapping. */
export function findTaps(b: Board): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!isSwappable(b, x, y)) continue;
      const t = b.cells[y * b.w + x].tile!;
      if (t.special !== 'none') out.push({ x, y });
    }
  }
  return out;
}

/** Is there any move at all (a matching swap, a special to swap or tap)? */
export function hasMove(b: Board): boolean {
  return findSwaps(b, 1).length > 0 || findTaps(b).length > 0;
}

/** Best-looking swap for the hint (prefers big matches / specials). */
export function bestHint(b: Board): SwapCandidate | null {
  const all = findSwaps(b);
  if (all.length === 0) return null;
  let best = all[0];
  for (const c of all) if (c.value > best.value) best = c;
  return best;
}
