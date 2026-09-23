import type { Board, Cell, Pos, Tile } from './types';

/**
 * Layout legend (one character per cell):
 *   .  normal cell            #  hole (not part of the board)
 *   1  ice (1 layer)          2  ice (2 layers)
 *   c  crate (1 hit)          C  crate (2 hits)        K  crate (3 hits)
 *   l  chained tile           L  chained tile on ice
 *   o  chick (must be brought down)
 */
export const LAYOUT_CHARS = '.#12cCKlLo';

export interface ParsedLayout {
  board: Board;
  chicks: Pos[];
}

export function emptyCell(playable = true): Cell {
  return { playable, tile: null, ice: 0, crate: 0, chain: 0 };
}

export function parseLayout(lines: readonly string[]): ParsedLayout {
  const h = lines.length;
  const w = Math.max(...lines.map((l) => l.length));
  const cells: Cell[] = [];
  const chicks: Pos[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = lines[y][x] ?? '#';
      const c = emptyCell(ch !== '#');
      switch (ch) {
        case '1':
          c.ice = 1;
          break;
        case '2':
          c.ice = 2;
          break;
        case 'c':
          c.crate = 1;
          break;
        case 'C':
          c.crate = 2;
          break;
        case 'K':
          c.crate = 3;
          break;
        case 'l':
          c.chain = 1;
          break;
        case 'L':
          c.chain = 1;
          c.ice = 1;
          break;
        case 'o':
          chicks.push({ x, y });
          break;
        case '.':
        case '#':
          break;
        default:
          throw new Error(`Unknown layout char "${ch}"`);
      }
      cells.push(c);
    }
  }
  return { board: { w, h, cells }, chicks };
}

export function inBounds(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.w && y < b.h;
}

export function cellAt(b: Board, x: number, y: number): Cell | undefined {
  return inBounds(b, x, y) ? b.cells[y * b.w + x] : undefined;
}

export function tileAt(b: Board, x: number, y: number): Tile | null {
  return cellAt(b, x, y)?.tile ?? null;
}

/** Cell that can hold a tile right now (playable, no crate). */
export function isOpen(c: Cell | undefined): c is Cell {
  return !!c && c.playable && c.crate === 0;
}

/** A tile the player may grab and swap. */
export function isSwappable(b: Board, x: number, y: number): boolean {
  const c = cellAt(b, x, y);
  return isOpen(c) && c.tile !== null && c.chain === 0;
}

/** Can this tile be part of a color match? */
export function isMatchable(t: Tile | null): t is Tile {
  return !!t && t.kind === 'gem' && t.special !== 'rainbow' && t.color >= 0;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function cloneBoard(b: Board): Board {
  return {
    w: b.w,
    h: b.h,
    cells: b.cells.map((c) => ({ ...c, tile: c.tile ? { ...c.tile } : null })),
  };
}

export function swapTiles(b: Board, a: Pos, c: Pos): void {
  const ca = b.cells[a.y * b.w + a.x];
  const cb = b.cells[c.y * b.w + c.x];
  const t = ca.tile;
  ca.tile = cb.tile;
  cb.tile = t;
}

export const DIRS4: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** y of the bottom-most playable cell of each column (chick exit), -1 if none. */
export function exitRows(b: Board): number[] {
  const out: number[] = [];
  for (let x = 0; x < b.w; x++) {
    let ey = -1;
    for (let y = b.h - 1; y >= 0; y--) {
      if (b.cells[y * b.w + x].playable) {
        ey = y;
        break;
      }
    }
    out.push(ey);
  }
  return out;
}

/** y of the top-most playable cell of each column (spawner), -1 if none. */
export function spawnRows(b: Board): number[] {
  const out: number[] = [];
  for (let x = 0; x < b.w; x++) {
    let sy = -1;
    for (let y = 0; y < b.h; y++) {
      if (b.cells[y * b.w + x].playable) {
        sy = y;
        break;
      }
    }
    out.push(sy);
  }
  return out;
}

/** Debug helper: board → strings of color digits (tests). */
export function boardToStrings(b: Board): string[] {
  const out: string[] = [];
  for (let y = 0; y < b.h; y++) {
    let row = '';
    for (let x = 0; x < b.w; x++) {
      const c = b.cells[y * b.w + x];
      if (!c.playable) row += '#';
      else if (c.crate > 0) row += 'c';
      else if (!c.tile) row += '_';
      else if (c.tile.kind === 'chick') row += 'o';
      else if (c.tile.special === 'rainbow') row += '*';
      else row += String(c.tile.color);
    }
    out.push(row);
  }
  return out;
}
