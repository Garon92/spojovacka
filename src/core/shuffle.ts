import { isOpen } from './board';
import { findMatches, matchSizeAt } from './match';
import { hasMove } from './moves';
import type { GameState } from './state';
import type { Board, Pos, ShuffleStep, Tile } from './types';

function eligible(b: Board): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.cells[y * b.w + x];
      if (isOpen(c) && c.chain === 0 && c.tile && c.tile.kind === 'gem' && c.tile.special === 'none') out.push({ x, y });
    }
  }
  return out;
}

function recolorMatches(state: GameState, cells: Pos[]): void {
  const b = state.board;
  for (let pass = 0; pass < 4; pass++) {
    let fixed = true;
    for (const p of cells) {
      const t = b.cells[p.y * b.w + p.x].tile!;
      if (matchSizeAt(b, p.x, p.y) === 0) continue;
      fixed = false;
      const start = state.rng.int(state.colors);
      for (let k = 0; k < state.colors; k++) {
        t.color = (start + k) % state.colors;
        if (matchSizeAt(b, p.x, p.y) === 0) break;
      }
    }
    if (fixed) return;
  }
}

/** Recolor a few tiles so that a swap is guaranteed to exist. */
function forceMove(state: GameState, cells: Pos[]): boolean {
  const b = state.board;
  const set = new Set(cells.map((p) => p.y * b.w + p.x));
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && set.has(y * b.w + x);
  const order = state.rng.shuffle([...cells]);
  // pattern: K K q   with K below/above q  → swap q with that K
  const patterns: [number, number][][] = [
    // horizontal: p1=(0,0) p2=(1,0) q=(2,0) p3=(2,±1)
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, -1],
    ],
    // vertical: p1=(0,0) p2=(0,1) q=(0,2) p3=(±1,2)
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [-1, 2],
    ],
  ];
  for (const base of order) {
    for (const pat of patterns) {
      const pts = pat.map(([dx, dy]) => ({ x: base.x + dx, y: base.y + dy }));
      if (!pts.every((p) => ok(p.x, p.y))) continue;
      const [p1, p2, q, p3] = pts.map((p) => b.cells[p.y * b.w + p.x].tile!) as Tile[];
      const saved = [p1.color, p2.color, q.color, p3.color];
      for (let k = 0; k < state.colors; k++) {
        p1.color = k;
        p2.color = k;
        p3.color = k;
        if (q.color === k) q.color = (k + 1) % state.colors;
        const noMatch = pts.every((p) => matchSizeAt(b, p.x, p.y) === 0) && findMatches(b).length === 0;
        if (noMatch && hasMove(b)) return true;
      }
      [p1.color, p2.color, q.color, p3.color] = saved;
    }
  }
  return false;
}

/**
 * Shuffle the movable gems so that there is no match on the board and at least one move exists.
 * Falls back to recoloring a few gems when random permutations fail.
 */
export function shuffleBoard(state: GameState): ShuffleStep {
  const b = state.board;
  const cells = eligible(b);
  const orig = cells.map((p) => b.cells[p.y * b.w + p.x].tile!);
  const from = new Map<number, Pos>();
  cells.forEach((p, i) => from.set(orig[i].id, p));

  const place = (tiles: Tile[]) => cells.forEach((p, i) => (b.cells[p.y * b.w + p.x].tile = tiles[i]));

  let done = false;
  for (let attempt = 0; attempt < 60 && !done; attempt++) {
    const perm = state.rng.shuffle([...orig]);
    place(perm);
    if (findMatches(b).length === 0 && hasMove(b)) done = true;
  }
  if (!done) {
    recolorMatches(state, cells);
    if (!(findMatches(b).length === 0 && hasMove(b))) forceMove(state, cells);
  }

  const tiles = cells.map((p) => {
    const t = b.cells[p.y * b.w + p.x].tile!;
    return { tile: { ...t }, from: from.get(t.id)!, to: p };
  });
  return { type: 'shuffle', tiles };
}
