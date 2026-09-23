import { createRng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import type { Board, Cell, Special, Tile } from '../src/core/types';

/**
 * Build a state from rows of characters:
 *  0-5 gem color, # hole, c crate (1 hit), C crate (2 hits), o chick, _ empty cell,
 *  * rainbow, and uppercase letters for colored specials: H/V rocket (color 0), B bomb (color 0), F butterfly (color 0).
 */
export function stateFrom(rows: string[], opts: { colors?: number; moves?: number | null; seed?: number } = {}): GameState {
  const h = rows.length;
  const w = rows[0].length;
  let id = 1;
  const cells: Cell[] = [];
  const mk = (color: number, special: Special = 'none', kind: Tile['kind'] = 'gem'): Tile => ({ id: id++, color, special, kind });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const c: Cell = { playable: true, tile: null, ice: 0, crate: 0, chain: 0 };
      if (ch === '#') c.playable = false;
      else if (ch === 'c') c.crate = 1;
      else if (ch === 'C') c.crate = 2;
      else if (ch === 'o') c.tile = mk(-1, 'none', 'chick');
      else if (ch === '*') c.tile = mk(-1, 'rainbow');
      else if (ch === 'H') c.tile = mk(0, 'rocketH');
      else if (ch === 'V') c.tile = mk(0, 'rocketV');
      else if (ch === 'B') c.tile = mk(0, 'bomb');
      else if (ch === 'F') c.tile = mk(0, 'butterfly');
      else if (ch === '_') c.tile = null;
      else if (/[0-9]/.test(ch)) c.tile = mk(Number(ch));
      else throw new Error(`bad char ${ch}`);
      cells.push(c);
    }
  }
  const board: Board = { w, h, cells };
  const exits: number[] = [];
  for (let x = 0; x < w; x++) {
    let e = -1;
    for (let y = h - 1; y >= 0; y--) if (cells[y * w + x].playable) {
      e = y;
      break;
    }
    exits.push(e);
  }
  return {
    board,
    colors: opts.colors ?? 6,
    rng: createRng(opts.seed ?? 42),
    nextId: id,
    score: 0,
    movesLeft: opts.moves === undefined ? 20 : opts.moves,
    movesMade: 0,
    goals: [],
    chicks: null,
    stats: { cleared: 0, specialsMade: 0, specialsUsed: 0, maxCascade: 0, combos: 0 },
    exits,
  };
}

export function tile(s: GameState, x: number, y: number): Tile | null {
  return s.board.cells[y * s.board.w + x].tile;
}

export function cell(s: GameState, x: number, y: number): Cell {
  return s.board.cells[y * s.board.w + x];
}

/** every open cell holds a tile */
export function isFull(s: GameState): boolean {
  return s.board.cells.every((c) => !c.playable || c.crate > 0 || c.tile !== null);
}

/** all tile ids are unique */
export function idsUnique(s: GameState): boolean {
  const ids = s.board.cells.flatMap((c) => (c.tile ? [c.tile.id] : []));
  return new Set(ids).size === ids.length;
}
