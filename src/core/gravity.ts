import { isOpen, spawnRows } from './board';
import type { Board, FallSegment, FallStep, Pos, Tile } from './types';

export interface GravityHooks {
  /** create a new tile for column x (called once per spawned tile) */
  spawn(x: number): Tile;
}

/**
 * Let tiles fall in discrete ticks. Each tick every tile moves at most one cell:
 * 1) straight down (through holes in the board), 2) new tiles appear in the top cell of each column,
 * 3) only when nothing moved straight: tiles slide diagonally into cells blocked from above
 * (e.g. under a crate or a chained tile).
 * Mutates the board and returns the recorded paths for the animation.
 */
export function applyGravity(b: Board, hooks: GravityHooks): FallStep {
  const { w, h, cells } = b;
  const tops = spawnRows(b);
  const segs = new Map<number, FallSegment>();
  const lastTick = new Map<number, number>();
  const finished: FallSegment[] = [];
  const spawns: { tile: Tile; seg: FallSegment }[] = [];
  const spawnSeg = new Map<number, FallSegment>();

  const record = (tile: Tile, from: Pos, to: Pos, tick: number) => {
    const seg = segs.get(tile.id);
    if (seg && lastTick.get(tile.id) === tick - 1) {
      seg.path.push(to);
    } else {
      if (seg && spawnSeg.get(tile.id) !== seg) finished.push(seg);
      const ns: FallSegment = { id: tile.id, start: tick, from, path: [to] };
      segs.set(tile.id, ns);
    }
    lastTick.set(tile.id, tick);
  };

  const fillable = (i: number) => {
    const c = cells[i];
    return isOpen(c) && c.tile === null;
  };

  let tick = 0;
  for (let guard = 0; guard < 1000; guard++) {
    let changed = false;
    const moved = new Set<number>();

    // 1) vertical
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!fillable(i)) continue;
        // nearest playable cell above (skipping holes)
        let sy = y - 1;
        while (sy >= 0 && !cells[sy * w + x].playable) sy--;
        if (sy < 0) continue;
        const src = cells[sy * w + x];
        if (src.crate > 0 || src.chain > 0 || !src.tile) continue;
        if (moved.has(src.tile.id)) continue;
        const t = src.tile;
        src.tile = null;
        cells[i].tile = t;
        moved.add(t.id);
        record(t, { x, y: sy }, { x, y }, tick);
        changed = true;
      }
    }

    // 2) spawn
    for (let x = 0; x < w; x++) {
      const ty = tops[x];
      if (ty < 0) continue;
      const i = ty * w + x;
      if (!fillable(i)) continue;
      const t = hooks.spawn(x);
      cells[i].tile = t;
      moved.add(t.id);
      const seg: FallSegment = { id: t.id, start: tick, from: { x, y: ty - 1 }, path: [{ x, y: ty }] };
      segs.set(t.id, seg);
      lastTick.set(t.id, tick);
      spawns.push({ tile: { ...t }, seg });
      spawnSeg.set(t.id, seg);
      changed = true;
    }

    // 3) diagonal (only when the board is vertically settled)
    if (!changed) {
      for (let y = h - 1; y >= 1; y--) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!fillable(i)) continue;
          const order = (x + y + tick) % 2 === 0 ? [-1, 1] : [1, -1];
          for (const dx of order) {
            const sx = x + dx;
            const sy = y - 1;
            if (sx < 0 || sx >= w) continue;
            const src = cells[sy * w + sx];
            if (!isOpen(src) || src.chain > 0 || !src.tile) continue;
            if (moved.has(src.tile.id)) continue;
            // the source must not be able to fall straight down
            if (fillable(y * w + sx)) continue;
            const t = src.tile;
            src.tile = null;
            cells[i].tile = t;
            moved.add(t.id);
            record(t, { x: sx, y: sy }, { x, y }, tick);
            changed = true;
            break;
          }
        }
      }
    }

    if (!changed) break;
    tick++;
  }

  const moves: FallSegment[] = [...finished];
  for (const seg of segs.values()) {
    // a spawned tile may continue in extra segments (pause + continue) – those are regular moves
    if (spawnSeg.get(seg.id) !== seg) moves.push(seg);
  }
  return { type: 'fall', moves, spawns, ticks: tick };
}
