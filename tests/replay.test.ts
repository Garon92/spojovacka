/**
 * Contract test between core and renderer: replaying the emitted steps on a simple
 * "id → position" model must end exactly in the final board state.
 */
import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/core/bot';
import { playBonus, playMove } from '../src/core/game';
import { LEVELS, levelConfig } from '../src/core/levels';
import { createRng } from '../src/core/rng';
import { createGame, isLost, isWon, type GameState } from '../src/core/state';
import type { Step } from '../src/core/types';

type Model = Map<number, { x: number; y: number; special: string; color: number }>;

function snapshot(s: GameState): Model {
  const m: Model = new Map();
  s.board.cells.forEach((c, i) => {
    if (c.tile) m.set(c.tile.id, { x: i % s.board.w, y: Math.floor(i / s.board.w), special: c.tile.special, color: c.tile.color });
  });
  return m;
}

function replay(m: Model, steps: Step[]) {
  for (const st of steps) {
    switch (st.type) {
      case 'swap': {
        if (st.invalid) break;
        const a = m.get(st.ida)!;
        const b = m.get(st.idb)!;
        const ax = a.x;
        const ay = a.y;
        a.x = b.x;
        a.y = b.y;
        b.x = ax;
        b.y = ay;
        break;
      }
      case 'clear':
        for (const c of st.cleared) {
          expect(m.has(c.id)).toBe(true);
          m.delete(c.id);
        }
        for (const cr of st.created) {
          m.delete(cr.replacedId);
          m.set(cr.tile.id, { x: cr.x, y: cr.y, special: cr.tile.special, color: cr.tile.color });
        }
        for (const t of st.transformed) {
          const v = m.get(t.id);
          if (v) v.special = t.special;
        }
        // tiles transformed and then cleared in the same step were removed above; created ones may be cleared later
        break;
      case 'fall':
        for (const sp of st.spawns) {
          const last = sp.seg.path[sp.seg.path.length - 1];
          m.set(sp.tile.id, { x: last.x, y: last.y, special: sp.tile.special, color: sp.tile.color });
        }
        for (const seg of [...st.moves].sort((p, q) => p.start - q.start)) {
          const v = m.get(seg.id)!;
          expect(v).toBeDefined();
          expect({ x: v.x, y: v.y }).toEqual(seg.from);
          const last = seg.path[seg.path.length - 1];
          v.x = last.x;
          v.y = last.y;
        }
        break;
      case 'collect':
        for (const c of st.chicks) m.delete(c.id);
        break;
      case 'shuffle':
        for (const t of st.tiles) m.set(t.tile.id, { x: t.to.x, y: t.to.y, special: t.tile.special, color: t.tile.color });
        break;
      case 'bonus':
        for (const c of st.converted) {
          const v = m.get(c.id);
          if (v) v.special = c.special;
        }
        break;
    }
  }
}

function positions(m: Model) {
  return [...m.entries()].map(([id, v]) => `${id}@${v.x},${v.y}`).sort();
}

describe('step replay matches the final state', () => {
  it('holds for many bot games across all levels', () => {
    for (const l of LEVELS) {
      const g = createGame(levelConfig(l), 31 + l.id);
      const rng = createRng(l.id);
      const model = snapshot(g);
      for (let i = 0; i < 12 && !isWon(g) && !isLost(g); i++) {
        const m = chooseMove(g, rng, 0.7, 10);
        if (!m) break;
        const r = playMove(g, m);
        replay(model, r.steps);
        expect(positions(model)).toEqual(positions(snapshot(g)));
      }
      if (isWon(g)) {
        const r = playBonus(g);
        replay(model, r.steps);
        expect(positions(model)).toEqual(positions(snapshot(g)));
      }
    }
  }, 60000);

  it('fall segments of one tile are contiguous in time', () => {
    const l = LEVELS[29];
    const g = createGame(levelConfig(l), 5);
    const rng = createRng(2);
    for (let i = 0; i < 10; i++) {
      const m = chooseMove(g, rng, 1, 10);
      if (!m) break;
      for (const st of playMove(g, m).steps) {
        if (st.type !== 'fall') continue;
        const byId = new Map<number, { start: number; end: number }[]>();
        for (const seg of st.moves) {
          const arr = byId.get(seg.id) ?? [];
          arr.push({ start: seg.start, end: seg.start + seg.path.length });
          byId.set(seg.id, arr);
        }
        for (const arr of byId.values()) {
          arr.sort((a, b) => a.start - b.start);
          for (let k = 1; k < arr.length; k++) expect(arr[k].start).toBeGreaterThanOrEqual(arr[k - 1].end);
        }
      }
    }
  });
});
