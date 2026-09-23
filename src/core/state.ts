import { cloneBoard, exitRows, isOpen, parseLayout } from './board';
import { matchSizeAt } from './match';
import { hasMove } from './moves';
import { createRng, type Rng } from './rng';
import { shuffleBoard } from './shuffle';
import { emptyStats, type Board, type ChickState, type GameConfig, type GameStats, type Goal, type GoalDef, type Tile } from './types';

export interface GameState {
  board: Board;
  colors: number;
  rng: Rng;
  nextId: number;
  score: number;
  /** null = unlimited */
  movesLeft: number | null;
  movesMade: number;
  goals: Goal[];
  chicks: ChickState | null;
  stats: GameStats;
  /** bottom-most playable row per column (chick exits) */
  exits: number[];
}

export function newTile(state: GameState, color: number, kind: Tile['kind'] = 'gem'): Tile {
  return { id: state.nextId++, kind, color: kind === 'chick' ? -1 : color, special: 'none' };
}

function goalFromDef(d: GoalDef, board: Board, chicks: number): Goal {
  switch (d.type) {
    case 'score':
      return { kind: 'score', target: d.target, done: 0 };
    case 'color':
      return { kind: 'color', color: d.color, target: d.count, done: 0 };
    case 'ice':
      return { kind: 'ice', target: board.cells.filter((c) => c.playable && c.ice > 0).length, done: 0 };
    case 'crate':
      return { kind: 'crate', target: board.cells.filter((c) => c.playable && c.crate > 0).length, done: 0 };
    case 'chain':
      return { kind: 'chain', target: board.cells.filter((c) => c.playable && c.chain > 0).length, done: 0 };
    case 'chick':
      return { kind: 'chick', target: Math.max(d.count, chicks), done: 0 };
    case 'special':
      return { kind: 'special', special: d.special, target: d.count, done: 0 };
  }
}

/** Fill every empty open cell with a random gem that does not create a match. */
export function fillWithoutMatches(state: GameState): void {
  const b = state.board;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.cells[y * b.w + x];
      if (!isOpen(c) || c.tile) continue;
      const start = state.rng.int(state.colors);
      let placed = false;
      for (let k = 0; k < state.colors; k++) {
        const col = (start + k) % state.colors;
        c.tile = newTile(state, col);
        if (matchSizeAt(b, x, y) === 0) {
          placed = true;
          break;
        }
      }
      if (!placed) c.tile = newTile(state, start);
    }
  }
}

export function createGame(cfg: GameConfig, seed: number): GameState {
  const { board, chicks } = parseLayout(cfg.layout);
  const colors = Math.max(3, Math.min(6, cfg.colors));
  const state: GameState = {
    board,
    colors,
    rng: createRng(seed),
    nextId: 1,
    score: 0,
    movesLeft: cfg.moves,
    movesMade: 0,
    goals: [],
    chicks: null,
    stats: emptyStats(),
    exits: exitRows(board),
  };
  for (const p of chicks) {
    board.cells[p.y * board.w + p.x].tile = newTile(state, -1, 'chick');
  }
  if (cfg.chicks || chicks.length > 0) {
    const cc = cfg.chicks ?? { total: chicks.length, maxOnBoard: chicks.length, gap: 0 };
    state.chicks = { ...cc, total: Math.max(cc.total, chicks.length), spawned: chicks.length, collected: 0, lastSpawnMove: 0 };
  }
  state.goals = cfg.goals.map((g) => goalFromDef(g, board, state.chicks?.total ?? 0));

  // generate a starting board without matches and with at least one move
  const template = cloneBoard(board);
  const idStart = state.nextId;
  for (let attempt = 0; attempt < 40; attempt++) {
    state.board = cloneBoard(template);
    state.nextId = idStart;
    fillWithoutMatches(state);
    if (hasMove(state.board)) return state;
  }
  shuffleBoard(state);
  return state;
}

export function cloneState(s: GameState, seed?: number): GameState {
  return {
    ...s,
    board: cloneBoard(s.board),
    rng: seed === undefined ? s.rng.clone() : createRng(seed),
    goals: s.goals.map((g) => ({ ...g })),
    chicks: s.chicks ? { ...s.chicks } : null,
    stats: { ...s.stats, used: { ...s.stats.used }, made: { ...s.stats.made } },
    exits: [...s.exits],
  };
}

export function isWon(s: GameState): boolean {
  return s.goals.length > 0 && s.goals.every((g) => g.done >= g.target);
}

export function isLost(s: GameState): boolean {
  return !isWon(s) && s.movesLeft !== null && s.movesLeft <= 0;
}

/** 0..1 overall goal completion (for hints / bots). */
export function goalProgress(s: GameState): number {
  if (s.goals.length === 0) return 0;
  let sum = 0;
  for (const g of s.goals) sum += Math.min(1, g.done / Math.max(1, g.target));
  return sum / s.goals.length;
}
