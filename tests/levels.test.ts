import { describe, expect, it } from 'vitest';
import { LAYOUT_CHARS } from '../src/core/board';
import { chooseMove } from '../src/core/bot';
import { playBonus, playMove } from '../src/core/game';
import { LEVELS, WORLDS, levelConfig, starsFor } from '../src/core/levels';
import { findMatches } from '../src/core/match';
import { hasMove } from '../src/core/moves';
import { createRng } from '../src/core/rng';
import { createGame, isLost, isWon } from '../src/core/state';

describe('level data', () => {
  it('has 40 levels in 4 worlds with sequential ids', () => {
    expect(LEVELS).toHaveLength(40);
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(i + 1);
      expect(l.world).toBe(Math.floor(i / 10));
    });
    expect(WORLDS).toHaveLength(4);
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))('level %i is well formed', (_id, l) => {
    expect(l.layout.length).toBeGreaterThanOrEqual(6);
    expect(l.layout.length).toBeLessThanOrEqual(9);
    const w = l.layout[0].length;
    for (const row of l.layout) {
      expect(row.length).toBe(w);
      for (const ch of row) expect(LAYOUT_CHARS).toContain(ch);
    }
    expect(l.colors).toBeGreaterThanOrEqual(4);
    expect(l.colors).toBeLessThanOrEqual(6);
    expect(l.moves).toBeGreaterThanOrEqual(10);
    expect(l.stars[0]).toBeLessThan(l.stars[1]);
    for (const g of l.goals) if (g.type === 'color') expect(g.color).toBeLessThan(l.colors);
    // obstacle goals only where the obstacle exists
    const flat = l.layout.join('');
    for (const g of l.goals) {
      if (g.type === 'ice') expect(/[12L]/.test(flat)).toBe(true);
      if (g.type === 'crate') expect(/[cCK]/.test(flat)).toBe(true);
      if (g.type === 'chain') expect(/[lL]/.test(flat)).toBe(true);
      if (g.type === 'chick') expect(l.chicks).toBeDefined();
    }
  });

  it('every level starts without matches and with a move (several seeds)', () => {
    for (const l of LEVELS) {
      for (let seed = 1; seed <= 6; seed++) {
        const s = createGame(levelConfig(l), seed * 97 + l.id);
        expect(findMatches(s.board)).toEqual([]);
        expect(hasMove(s.board)).toBe(true);
        expect(s.goals.every((g) => g.target > 0)).toBe(true);
      }
    }
  });

  it('stars: 0 for a loss, 1..3 by score for a win', () => {
    const l = LEVELS[0];
    expect(starsFor(l, false, 999999)).toBe(0);
    expect(starsFor(l, true, 0)).toBe(1);
    expect(starsFor(l, true, l.stars[0])).toBe(2);
    expect(starsFor(l, true, l.stars[1])).toBe(3);
  });
});

describe('every level is winnable', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('bot wins level %i with its move limit (best of 4)', (_id, l) => {
    let wins = 0;
    for (let seed = 1; seed <= 4 && wins === 0; seed++) {
      const g = createGame(levelConfig(l), 7000 + seed * 13 + l.id);
      const rng = createRng(seed);
      while (!isWon(g) && !isLost(g)) {
        const m = chooseMove(g, rng, 1, 20);
        if (!m) break;
        playMove(g, m);
      }
      if (isWon(g)) {
        wins++;
        const before = g.score;
        playBonus(g);
        expect(g.score).toBeGreaterThanOrEqual(before);
        expect(g.movesLeft).toBe(0);
      }
    }
    expect(wins).toBeGreaterThan(0);
  }, 20000);
});
