import { describe, expect, it } from 'vitest';
import { playBonus, playMove } from '../src/core/game';
import { findMatches } from '../src/core/match';
import { findSwaps, hasMove } from '../src/core/moves';
import { collectChicks } from '../src/core/resolve';
import { shuffleBoard } from '../src/core/shuffle';
import { createGame, isLost, isWon } from '../src/core/state';
import type { ClearStep, Step } from '../src/core/types';
import { cell, idsUnique, isFull, stateFrom, tile } from './helpers';

const clears = (steps: Step[]) => steps.filter((s): s is ClearStep => s.type === 'clear');
const clearedIds = (steps: Step[]) => new Set(clears(steps).flatMap((c) => c.cleared.map((t) => t.id)));

describe('swapping', () => {
  it('reverts a swap that makes no match and keeps the move', () => {
    const s = stateFrom(['0123', '1230', '2301', '3012'], { moves: 5 });
    const before = s.board.cells.map((c) => c.tile!.id);
    const r = playMove(s, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } });
    expect(r.valid).toBe(false);
    expect(r.steps).toEqual([expect.objectContaining({ type: 'swap', invalid: true })]);
    expect(s.board.cells.map((c) => c.tile!.id)).toEqual(before);
    expect(s.movesLeft).toBe(5);
  });

  it('rejects non-adjacent swaps and chained tiles', () => {
    const s = stateFrom(['0120', '1201']);
    expect(playMove(s, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }).valid).toBe(false);
    cell(s, 0, 0).chain = 1;
    expect(playMove(s, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }).valid).toBe(false);
  });

  it('clears a match of 3, scores, refills and uses a move', () => {
    const s2 = stateFrom(['0102', '2013', '3324', '4435'], { moves: 10 });
    const r2 = playMove(s2, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(r2.valid).toBe(true);
    expect(r2.steps[0]).toMatchObject({ type: 'swap', invalid: false });
    expect(s2.movesLeft).toBe(9);
    expect(s2.score).toBeGreaterThanOrEqual(30);
    expect(isFull(s2)).toBe(true);
    expect(idsUnique(s2)).toBe(true);
    expect(findMatches(s2.board)).toEqual([]);
  });
});

describe('specials', () => {
  it('creates a rocket from 4 in a row at the swapped cell', () => {
    const s = stateFrom(['00102', '12021', '23132', '31213'], { seed: 1 });
    const r = playMove(s, { type: 'swap', a: { x: 2, y: 1 }, b: { x: 2, y: 0 } });
    expect(r.valid).toBe(true);
    const first = clears(r.steps)[0];
    expect(first.created).toHaveLength(1);
    expect(first.created[0].tile.special).toBe('rocketV');
    expect(first.created[0]).toMatchObject({ x: 2, y: 0 });
    expect(s.stats.specialsMade).toBeGreaterThanOrEqual(1);
  });

  it('rocketH clears the whole row when tapped', () => {
    const s = stateFrom(['01234', '12H40', '23401', '34012'], { moves: 3 });
    const rowIds = [0, 1, 2, 3, 4].map((x) => tile(s, x, 1)!.id);
    const r = playMove(s, { type: 'tap', a: { x: 2, y: 1 } });
    expect(r.valid).toBe(true);
    const ids = clearedIds(r.steps);
    for (const id of rowIds) expect(ids.has(id)).toBe(true);
    expect(s.movesLeft).toBe(2);
    const fx = clears(r.steps)[0].activations[0];
    expect(fx).toMatchObject({ kind: 'rocket', dir: 'h' });
  });

  it('rocketV clears the whole column', () => {
    const s = stateFrom(['0123', '1V30', '2301', '3012']);
    const colIds = [0, 1, 2, 3].map((y) => tile(s, 1, y)!.id);
    const r = playMove(s, { type: 'tap', a: { x: 1, y: 1 } });
    const ids = clearedIds(r.steps);
    for (const id of colIds) expect(ids.has(id)).toBe(true);
  });

  it('bomb clears a circle of diameter 5 (13 cells)', () => {
    const rows = ['0123401', '1234012', '2340123', '340B234', '4012340', '0123401', '1234012'];
    const s = stateFrom(rows);
    const r = playMove(s, { type: 'tap', a: { x: 3, y: 3 } });
    const first = clears(r.steps)[0];
    const pos = new Set(first.cleared.map((c) => `${c.x},${c.y}`));
    expect(pos.size).toBe(13);
    expect(pos.has('3,1') && pos.has('1,3') && pos.has('5,3') && pos.has('3,5') && pos.has('2,2')).toBe(true);
    expect(pos.has('1,1')).toBe(false);
  });

  it('rainbow swapped with a gem clears every gem of that color', () => {
    const s = stateFrom(['0123', '1*30', '2301', '3012']);
    const color = tile(s, 2, 1)!.color; // 3
    const same = s.board.cells.filter((c) => c.tile?.color === color).map((c) => c.tile!.id);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } });
    expect(r.valid).toBe(true);
    const first = clears(r.steps)[0];
    const ids = new Set(first.cleared.map((c) => c.id));
    for (const id of same) expect(ids.has(id)).toBe(true);
    expect(first.activations[0]).toMatchObject({ kind: 'rainbow', color });
  });

  it('butterfly clears a + and flies to an obstacle', () => {
    const s = stateFrom(['01230', '12301', '23F12', '30123', '0123c']);
    const r = playMove(s, { type: 'tap', a: { x: 2, y: 2 } });
    const first = clears(r.steps)[0];
    const pos = new Set(first.cleared.map((c) => `${c.x},${c.y}`));
    for (const p of ['2,2', '1,2', '3,2', '2,1', '2,3']) expect(pos.has(p)).toBe(true);
    const fly = first.activations.find((a) => a.kind === 'butterfly');
    expect(fly).toMatchObject({ to: { x: 4, y: 4 } });
    expect(cell(s, 4, 4).crate).toBe(0);
  });

  it('specials hit by a match or explosion chain-react', () => {
    const s = stateFrom(['01234', '1V340', '23401', '3H012', '40123']);
    const r = playMove(s, { type: 'tap', a: { x: 1, y: 1 } });
    const first = clears(r.steps)[0];
    const kinds = first.activations.map((a) => a.kind + (a.kind === 'rocket' ? a.dir : ''));
    expect(kinds).toEqual(['rocketv', 'rocketh']);
    // row 3 cleared completely by the chained rocket
    const pos = new Set(first.cleared.map((c) => `${c.x},${c.y}`));
    for (let x = 0; x < 5; x++) expect(pos.has(`${x},3`)).toBe(true);
  });

  it('swapping a special with a normal gem activates it', () => {
    const s = stateFrom(['0123', '1H30', '2301', '3012']);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 2 } });
    expect(r.valid).toBe(true);
    expect(clears(r.steps)[0].activations[0]).toMatchObject({ kind: 'rocket', dir: 'h', y: 2 });
  });
});

describe('combos', () => {
  it('rocket + rocket → cross', () => {
    const s = stateFrom(['01234', '12340', '2HV31', '34012', '40123']);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 2 }, b: { x: 2, y: 2 } });
    const first = clears(r.steps)[0];
    const pos = new Set(first.cleared.map((c) => `${c.x},${c.y}`));
    for (let i = 0; i < 5; i++) {
      expect(pos.has(`${i},2`)).toBe(true);
      expect(pos.has(`2,${i}`)).toBe(true);
    }
    expect(s.stats.combos).toBe(1);
  });

  it('rocket + bomb → 3 rows and 3 columns', () => {
    const s = stateFrom(['0123401', '1234012', '2340123', '341HB34', '4012340', '0123401', '1234012']);
    const r = playMove(s, { type: 'swap', a: { x: 3, y: 3 }, b: { x: 4, y: 3 } });
    const first = clears(r.steps)[0];
    const rockets = first.activations.filter((a) => a.kind === 'rocket');
    expect(rockets).toHaveLength(6);
    const pos = new Set(first.cleared.map((c) => `${c.x},${c.y}`));
    for (let i = 0; i < 7; i++) {
      for (const k of [2, 3, 4]) {
        expect(pos.has(`${i},${k}`)).toBe(true);
        expect(pos.has(`${k + 1},${i}`)).toBe(true);
      }
    }
  });

  it('bomb + bomb → big explosion', () => {
    const rows = ['0123401', '1234012', '2340123', '341BB34', '4012340', '0123401', '1234012'];
    const s = stateFrom(rows);
    const r = playMove(s, { type: 'swap', a: { x: 3, y: 3 }, b: { x: 4, y: 3 } });
    const first = clears(r.steps)[0];
    expect(first.cleared.length).toBeGreaterThan(25);
  });

  it('rainbow + rocket turns all gems of that color into rockets', () => {
    const s = stateFrom(['01234', '12340', '2*H01', '34012', '40123']);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 2 }, b: { x: 2, y: 2 } });
    const first = clears(r.steps)[0];
    const zeros = 5; // color 0 gems besides the rocket itself
    expect(first.transformed.length).toBe(zeros);
    expect(first.transformed.every((t) => t.special === 'rocketH' || t.special === 'rocketV')).toBe(true);
    expect(first.activations.filter((a) => a.kind === 'rocket').length).toBeGreaterThanOrEqual(zeros);
  });

  it('rainbow + rainbow clears the whole board', () => {
    const s = stateFrom(['0123', '1**0', '2301', '3012']);
    const all = s.board.cells.map((c) => c.tile!.id);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } });
    const ids = new Set(clears(r.steps)[0].cleared.map((c) => c.id));
    for (const id of all) expect(ids.has(id)).toBe(true);
  });

  it('butterfly + rocket carries the rocket to the target', () => {
    const s = stateFrom(['01230', '12301', '2FH12', '30123', '0123c']);
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 2 }, b: { x: 2, y: 2 } });
    const first = clears(r.steps)[0];
    const fly = first.activations.find((a) => a.kind === 'butterfly');
    expect(fly).toMatchObject({ carry: 'rocketH', to: { x: 4, y: 4 } });
    expect(first.activations.some((a) => a.kind === 'rocket' && a.y === 4)).toBe(true);
  });
});

describe('cascades', () => {
  it('resolves chain reactions with an increasing multiplier', () => {
    // swapping (2,2)↔(2,3) clears 0 0 0 in row 2; column 0 then drops 1 1 onto the 1 below → second match
    const s = stateFrom(['1234', '1342', '0053', '1402'], { seed: 7 });
    const r = playMove(s, { type: 'swap', a: { x: 2, y: 2 }, b: { x: 2, y: 3 } });
    expect(r.valid).toBe(true);
    const cs = clears(r.steps);
    expect(cs.length).toBeGreaterThanOrEqual(2);
    cs.forEach((c, i) => expect(c.cascade).toBe(i + 1));
    expect(r.cascades).toBe(cs.length);
    expect(cs[0].score).toBe(30);
    expect(cs[1].score).toBeGreaterThanOrEqual(60); // ×2 multiplier
    expect(isFull(s)).toBe(true);
    expect(findMatches(s.board)).toEqual([]);
  });
});

describe('no moves & shuffle', () => {
  it('detects a board without moves', () => {
    const s = stateFrom(['0123', '2301', '0123', '2301']);
    expect(findSwaps(s.board)).toEqual([]);
    expect(hasMove(s.board)).toBe(false);
  });

  it('a special always counts as a move', () => {
    const s = stateFrom(['0123', '23H1', '0123', '2301']);
    expect(hasMove(s.board)).toBe(true);
  });

  it('shuffle guarantees a move and no matches (many seeds)', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const s = stateFrom(['0123', '2301', '0123', '2301'], { seed, colors: 4 });
      const ids = new Set(s.board.cells.map((c) => c.tile!.id));
      const step = shuffleBoard(s);
      expect(hasMove(s.board)).toBe(true);
      expect(findMatches(s.board)).toEqual([]);
      expect(new Set(step.tiles.map((t) => t.tile.id))).toEqual(ids);
    }
  });

  it('shuffle works around holes, crates and chains', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = stateFrom(['0#12c', '23010', '#1c23', '30121', '12#03'], { seed, colors: 5 });
      cell(s, 1, 1).chain = 1;
      shuffleBoard(s);
      expect(hasMove(s.board)).toBe(true);
      expect(findMatches(s.board)).toEqual([]);
      expect(cell(s, 1, 1).tile).not.toBeNull();
    }
  });

  it('shuffles automatically after a move that leaves no moves', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame({ layout: ['......', '......', '......', '......', '......', '......'], colors: 6, moves: 50, goals: [] }, seed);
      for (let i = 0; i < 40; i++) {
        const sw = findSwaps(g.board);
        expect(sw.length > 0 || hasMove(g.board)).toBe(true);
        if (sw.length === 0) break;
        playMove(g, { type: 'swap', a: sw[0].a, b: sw[0].b });
        expect(hasMove(g.board)).toBe(true);
        expect(findMatches(g.board)).toEqual([]);
        expect(isFull(g)).toBe(true);
      }
    }
  });
});

describe('goals', () => {
  it('counts collected colors', () => {
    const s = stateFrom(['0102', '2013', '3324', '4435']);
    s.goals = [{ kind: 'color', color: 0, target: 3, done: 0 }];
    playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(s.goals[0].done).toBeGreaterThanOrEqual(3);
    expect(isWon(s)).toBe(true);
  });

  it('breaks ice under matched tiles (one layer per clear)', () => {
    const s = stateFrom(['0102', '2013', '3324', '4435']);
    cell(s, 0, 0).ice = 1;
    cell(s, 2, 0).ice = 2;
    s.goals = [{ kind: 'ice', target: 2, done: 0 }];
    const r = playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(cell(s, 0, 0).ice).toBe(0);
    expect(cell(s, 2, 0).ice).toBeLessThanOrEqual(1);
    expect(clears(r.steps)[0].blockers.filter((bh) => bh.type === 'ice').length).toBeGreaterThanOrEqual(2);
    expect(s.goals[0].done).toBeGreaterThanOrEqual(1);
  });

  it('damages crates next to a match', () => {
    const s = stateFrom(['0102', 'C013', '3324', '4435']);
    s.goals = [{ kind: 'crate', target: 1, done: 0 }];
    playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(cell(s, 0, 1).crate).toBe(1);
    expect(s.goals[0].done).toBe(0);
  });

  it('a match on a chained tile breaks the chain but keeps the tile', () => {
    const s = stateFrom(['0102', '2013', '3324', '4435']);
    cell(s, 0, 0).chain = 1;
    const id = tile(s, 0, 0)!.id;
    s.goals = [{ kind: 'chain', target: 1, done: 0 }];
    playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(cell(s, 0, 0).chain).toBe(0);
    expect(s.board.cells.some((c) => c.tile?.id === id)).toBe(true);
    expect(s.goals[0].done).toBe(1);
  });

  it('collects chicks that reach the bottom', () => {
    const s = stateFrom(['121', 'o10', '001']);
    s.chicks = { total: 1, maxOnBoard: 1, gap: 1, spawned: 1, collected: 0, lastSpawnMove: 0 };
    s.goals = [{ kind: 'chick', target: 1, done: 0 }];
    // swapping (2,1)=0 with (2,2)=1 → row 2 = 0 0 0 → cleared → the chick falls to the bottom
    const r = playMove(s, { type: 'swap', a: { x: 2, y: 1 }, b: { x: 2, y: 2 } });
    expect(r.valid).toBe(true);
    expect(r.steps.some((st) => st.type === 'collect')).toBe(true);
    expect(s.goals[0].done).toBe(1);
    expect(isWon(s)).toBe(true);
    expect(collectChicks(s)).toBeNull();
  });

  it('explosions never destroy chicks', () => {
    const s = stateFrom(['0o23', '1V30', '2301', '3012']);
    s.chicks = { total: 1, maxOnBoard: 1, gap: 1, spawned: 1, collected: 0, lastSpawnMove: 0 };
    const id = tile(s, 1, 0)!.id;
    const r = playMove(s, { type: 'tap', a: { x: 1, y: 1 } });
    expect(clearedIds(r.steps).has(id)).toBe(false);
  });

  it('is lost when moves run out, won when goals are met', () => {
    const s = stateFrom(['0102', '2013', '3324', '4435'], { moves: 1 });
    s.goals = [{ kind: 'color', color: 5, target: 99, done: 0 }];
    playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(s.movesLeft).toBe(0);
    expect(isLost(s)).toBe(true);
    expect(isWon(s)).toBe(false);
    expect(playMove(s, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }).valid).toBe(false);
  });

  it('special goal counts used specials', () => {
    const s = stateFrom(['0123', '1H30', '2301', '3012']);
    s.goals = [{ kind: 'special', special: 'rocket', target: 1, done: 0 }];
    playMove(s, { type: 'tap', a: { x: 1, y: 1 } });
    expect(s.goals[0].done).toBeGreaterThanOrEqual(1);
  });

  it('score goal follows the score', () => {
    const s = stateFrom(['0102', '2013', '3324', '4435']);
    s.goals = [{ kind: 'score', target: 20, done: 0 }];
    playMove(s, { type: 'swap', a: { x: 1, y: 0 }, b: { x: 1, y: 1 } });
    expect(s.goals[0].done).toBe(s.score);
    expect(isWon(s)).toBe(true);
  });

  it('bonus finale turns leftover moves into points and uses them up', () => {
    const g = createGame({ layout: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'], colors: 5, moves: 8, goals: [{ type: 'score', target: 1 }] }, 5);
    const sw = findSwaps(g.board)[0];
    playMove(g, { type: 'swap', a: sw.a, b: sw.b });
    expect(isWon(g)).toBe(true);
    const before = g.score;
    const r = playBonus(g);
    expect(r.valid).toBe(true);
    expect(g.movesLeft).toBe(0);
    expect(g.score).toBeGreaterThan(before + 7 * 100);
    expect(r.steps[0]).toMatchObject({ type: 'bonus', movesUsed: 7 });
    expect(g.board.cells.every((c) => !c.tile || c.tile.special === 'none')).toBe(true);
    expect(isFull(g)).toBe(true);
  });
});
