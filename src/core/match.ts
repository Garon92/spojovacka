import { isMatchable } from './board';
import type { Board, Pos, Special } from './types';

export interface MatchGroup {
  color: number;
  cells: Pos[];
  /** special piece to create from this group ('none' for a plain match) */
  special: Special;
  /** where the special appears */
  at: Pos | null;
}

interface Shape {
  kind: 'h' | 'v' | 'sq';
  cells: number[];
}

export function colorAt(b: Board, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
  const c = b.cells[y * b.w + x];
  if (!c.playable || c.crate > 0) return -1;
  return isMatchable(c.tile) ? c.tile.color : -1;
}

function findShapes(b: Board): Shape[] {
  const shapes: Shape[] = [];
  const { w, h } = b;
  // horizontal runs
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const col = colorAt(b, x, y);
      if (col < 0) {
        x++;
        continue;
      }
      let e = x + 1;
      while (e < w && colorAt(b, e, y) === col) e++;
      if (e - x >= 3) {
        const cells: number[] = [];
        for (let i = x; i < e; i++) cells.push(y * w + i);
        shapes.push({ kind: 'h', cells });
      }
      x = e;
    }
  }
  // vertical runs
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      const col = colorAt(b, x, y);
      if (col < 0) {
        y++;
        continue;
      }
      let e = y + 1;
      while (e < h && colorAt(b, x, e) === col) e++;
      if (e - y >= 3) {
        const cells: number[] = [];
        for (let i = y; i < e; i++) cells.push(i * w + x);
        shapes.push({ kind: 'v', cells });
      }
      y = e;
    }
  }
  // 2×2 squares
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const col = colorAt(b, x, y);
      if (col < 0) continue;
      if (colorAt(b, x + 1, y) === col && colorAt(b, x, y + 1) === col && colorAt(b, x + 1, y + 1) === col) {
        shapes.push({ kind: 'sq', cells: [y * w + x, y * w + x + 1, (y + 1) * w + x, (y + 1) * w + x + 1] });
      }
    }
  }
  return shapes;
}

/**
 * Find all matches on the board, grouped into connected shapes, and decide which special each creates:
 * run of 5+ → rainbow, L/T/+ (horizontal and vertical run together) → bomb, run of 4 → rocket
 * (clears perpendicular to the run), 2×2 square → butterfly.
 * @param preferred cells where a special should preferably appear (the swapped cells).
 */
export function findMatches(b: Board, preferred: readonly Pos[] | null = null): MatchGroup[] {
  const shapes = findShapes(b);
  if (shapes.length === 0) return [];

  // union-find over shapes sharing a cell
  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const owner = new Map<number, number>();
  shapes.forEach((s, si) => {
    for (const c of s.cells) {
      const o = owner.get(c);
      if (o === undefined) owner.set(c, si);
      else {
        const ra = find(o);
        const rb = find(si);
        if (ra !== rb) parent[ra] = rb;
      }
    }
  });

  const groupsMap = new Map<number, Shape[]>();
  shapes.forEach((s, si) => {
    const r = find(si);
    const arr = groupsMap.get(r);
    if (arr) arr.push(s);
    else groupsMap.set(r, [s]);
  });

  const w = b.w;
  const out: MatchGroup[] = [];
  for (const group of groupsMap.values()) {
    const cellSet = new Set<number>();
    for (const s of group) for (const c of s.cells) cellSet.add(c);
    const cells = [...cellSet].sort((a, c) => a - c);
    const first = cells[0];
    const color = colorAt(b, first % w, Math.floor(first / w));

    const runs = group.filter((s) => s.kind !== 'sq');
    const hRuns = runs.filter((s) => s.kind === 'h');
    const vRuns = runs.filter((s) => s.kind === 'v');
    const squares = group.filter((s) => s.kind === 'sq');
    const longest = runs.reduce<Shape | null>((m, s) => (!m || s.cells.length > m.cells.length ? s : m), null);
    const maxRun = longest ? longest.cells.length : 0;

    let special: Special = 'none';
    if (maxRun >= 5) special = 'rainbow';
    else if (hRuns.length > 0 && vRuns.length > 0) special = 'bomb';
    else if (maxRun === 4 && longest) special = longest.kind === 'h' ? 'rocketV' : 'rocketH';
    else if (squares.length > 0) special = 'butterfly';

    const isCandidate = (i: number) => {
      const c = b.cells[i];
      return c.chain === 0 && c.tile !== null && c.tile.special === 'none';
    };

    let at: number | null = null;
    if (special !== 'none') {
      if (preferred) {
        for (const p of preferred) {
          const i = p.y * w + p.x;
          if (cellSet.has(i) && isCandidate(i)) {
            at = i;
            break;
          }
        }
      }
      if (at === null && special === 'bomb') {
        const vCells = new Set(vRuns.flatMap((s) => s.cells));
        const inter = hRuns.flatMap((s) => s.cells).find((c) => vCells.has(c) && isCandidate(c));
        if (inter !== undefined) at = inter;
      }
      if (at === null && longest && special !== 'butterfly') {
        const lc = longest.cells;
        const mid = (lc.length - 1) / 2;
        const order = lc.map((c, i) => ({ c, d: Math.abs(i - mid) })).sort((p, q) => p.d - q.d);
        const hit = order.find((o) => isCandidate(o.c));
        if (hit) at = hit.c;
      }
      if (at === null && special === 'butterfly') {
        const sq = squares.flatMap((s) => s.cells).find((c) => isCandidate(c));
        if (sq !== undefined) at = sq;
      }
      if (at === null) {
        const any = cells.find((c) => isCandidate(c));
        if (any !== undefined) at = any;
      }
      if (at === null) special = 'none';
    }

    out.push({
      color,
      cells: cells.map((i) => ({ x: i % w, y: Math.floor(i / w) })),
      special,
      at: at === null ? null : { x: at % w, y: Math.floor(at / w) },
    });
  }
  return out;
}

/**
 * Size of the match passing through (x, y) (0 = none). A 2×2 square counts as 4.
 * Fast local check used for move search.
 */
export function matchSizeAt(b: Board, x: number, y: number): number {
  const col = colorAt(b, x, y);
  if (col < 0) return 0;
  let l = x;
  while (colorAt(b, l - 1, y) === col) l--;
  let r = x;
  while (colorAt(b, r + 1, y) === col) r++;
  let u = y;
  while (colorAt(b, x, u - 1) === col) u--;
  let d = y;
  while (colorAt(b, x, d + 1) === col) d++;
  const hl = r - l + 1;
  const vl = d - u + 1;
  let size = 0;
  if (hl >= 3) size += hl;
  if (vl >= 3) size += vl - (hl >= 3 ? 1 : 0);
  if (size === 0) {
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]) {
      const sx = x + dx;
      const sy = y + dy;
      if (
        colorAt(b, sx, sy) === col &&
        colorAt(b, sx + 1, sy) === col &&
        colorAt(b, sx, sy + 1) === col &&
        colorAt(b, sx + 1, sy + 1) === col
      ) {
        return 4;
      }
    }
  }
  return size;
}
