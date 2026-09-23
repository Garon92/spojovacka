import { describe, expect, it } from 'vitest';
import { applyGravity } from '../src/core/gravity';
import type { Tile } from '../src/core/types';
import { cell, idsUnique, isFull, stateFrom, tile } from './helpers';

function spawner(start = 1000) {
  let id = start;
  return { spawn: (): Tile => ({ id: id++, kind: 'gem', color: 5, special: 'none' }) };
}

describe('applyGravity', () => {
  it('drops tiles straight down and refills from the top', () => {
    const s = stateFrom(['01', '2_', '_3', '45']);
    const top0 = tile(s, 0, 0)!.id;
    const step = applyGravity(s.board, spawner());
    expect(isFull(s)).toBe(true);
    expect(tile(s, 0, 1)!.id).toBe(top0); // column 0: tiles 0 and 2 fall by one
    expect(tile(s, 0, 0)!.color).toBe(5); // new tile on top
    expect(step.spawns).toHaveLength(2);
    expect(idsUnique(s)).toBe(true);
    // every recorded path moves strictly downwards one tick at a time
    for (const seg of [...step.moves, ...step.spawns.map((s2) => s2.seg)]) {
      let prev = seg.from;
      for (const p of seg.path) {
        expect(p.y).toBeGreaterThan(prev.y);
        prev = p;
      }
    }
  });

  it('keeps chained tiles in place and slides tiles diagonally below obstacles', () => {
    const s = stateFrom(['012', '3c4', '5_1', '___']);
    applyGravity(s.board, spawner());
    expect(isFull(s)).toBe(true);
    expect(cell(s, 1, 1).crate).toBe(1);
    expect(idsUnique(s)).toBe(true);
  });

  it('does not move chained tiles', () => {
    const s = stateFrom(['01', '23', '__']);
    cell(s, 0, 1).chain = 1;
    const chained = tile(s, 0, 1)!.id;
    applyGravity(s.board, spawner());
    expect(tile(s, 0, 1)!.id).toBe(chained);
    expect(isFull(s)).toBe(true);
  });

  it('lets tiles fall through holes', () => {
    const s = stateFrom(['0', '#', '_']);
    const id = tile(s, 0, 0)!.id;
    applyGravity(s.board, spawner());
    expect(tile(s, 0, 2)!.id).toBe(id);
    expect(tile(s, 0, 0)).not.toBeNull();
  });

  it('is a no-op on a full board', () => {
    const s = stateFrom(['01', '23']);
    const step = applyGravity(s.board, spawner());
    expect(step.moves).toHaveLength(0);
    expect(step.spawns).toHaveLength(0);
    expect(step.ticks).toBe(0);
  });
});
