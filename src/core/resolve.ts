import { DIRS4 } from './board';
import { applyGravity } from './gravity';
import { findMatches, type MatchGroup } from './match';
import { hasMove } from './moves';
import { shuffleBoard } from './shuffle';
import { newTile, type GameState } from './state';
import type { ClearStep, CollectStep, Pos, Special, SpecialFamily, Step, Tile } from './types';

/* ---------------- tuning ---------------- */

export const SCORE = {
  gem: 10,
  blocker: 20,
  chick: 150,
  create: { none: 0, rocketH: 60, rocketV: 60, bomb: 90, butterfly: 40, rainbow: 150 } as Record<Special, number>,
};

/** abstract time units (renderer maps 1 unit ≈ 90 ms) */
export const TIME = {
  rocketStep: 0.3,
  fuse: 0.35,
  flight: 2.6,
  create: 0.25,
};

/** Old bomb from the original game: circle of diameter 5 (dx² + dy² ≤ 4). */
export const BOMB_R2 = 4;
export const BIG_BOMB_R2 = 12;

export type Effect =
  | { type: 'rocket'; dir: 'h' | 'v' }
  | { type: 'bomb'; r2: number }
  | { type: 'rainbow'; color: number | null }
  | { type: 'butterfly'; carry: Special; count: number }
  | { type: 'cross' }
  | { type: 'bigCross' }
  | { type: 'rainbowAll' }
  | { type: 'rainbowTransform'; color: number; into: Special };

export type InitialAction =
  | { type: 'trigger'; x: number; y: number; t: number }
  | { type: 'effect'; x: number; y: number; t: number; eff: Effect; consume: Pos[]; color: number };

export function familyOf(s: Special): SpecialFamily | null {
  switch (s) {
    case 'rocketH':
    case 'rocketV':
      return 'rocket';
    case 'bomb':
      return 'bomb';
    case 'rainbow':
      return 'rainbow';
    case 'butterfly':
      return 'butterfly';
    default:
      return null;
  }
}

export function effectOf(s: Special): Effect | null {
  switch (s) {
    case 'rocketH':
      return { type: 'rocket', dir: 'h' };
    case 'rocketV':
      return { type: 'rocket', dir: 'v' };
    case 'bomb':
      return { type: 'bomb', r2: BOMB_R2 };
    case 'rainbow':
      return { type: 'rainbow', color: null };
    case 'butterfly':
      return { type: 'butterfly', carry: 'none', count: 1 };
    default:
      return null;
  }
}

/** Effect of swapping two specials together. */
export function comboEffect(a: Tile, b: Tile): { eff: Effect; color: number } {
  const fa = familyOf(a.special);
  const fb = familyOf(b.special);
  const has = (f: SpecialFamily) => fa === f || fb === f;
  const other = (f: SpecialFamily) => (fa === f ? b : a);
  if (fa === 'rainbow' && fb === 'rainbow') return { eff: { type: 'rainbowAll' }, color: -1 };
  if (has('rainbow')) {
    const o = other('rainbow');
    return { eff: { type: 'rainbowTransform', color: o.color, into: o.special }, color: o.color };
  }
  if (fa === 'rocket' && fb === 'rocket') return { eff: { type: 'cross' }, color: a.color };
  if (has('rocket') && has('bomb')) return { eff: { type: 'bigCross' }, color: a.color };
  if (fa === 'bomb' && fb === 'bomb') return { eff: { type: 'bomb', r2: BIG_BOMB_R2 }, color: a.color };
  if (fa === 'butterfly' && fb === 'butterfly') return { eff: { type: 'butterfly', carry: 'none', count: 3 }, color: a.color };
  // butterfly + rocket / bomb: the butterfly carries the other special
  const carried = other('butterfly');
  return { eff: { type: 'butterfly', carry: carried.special, count: 1 }, color: carried.color };
}

/* ---------------- tiny binary heap ---------------- */

interface Ev {
  t: number;
  seq: number;
  kind: 'hit' | 'adj' | 'act';
  x: number;
  y: number;
  src: number;
  eff?: Effect;
  color?: number;
  mergeTo?: Pos;
}

class Heap {
  private a: Ev[] = [];
  get size() {
    return this.a.length;
  }
  private less(i: number, j: number) {
    const p = this.a[i];
    const q = this.a[j];
    return p.t < q.t || (p.t === q.t && p.seq < q.seq);
  }
  push(e: Ev) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Ev | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/* ---------------- clear phase ---------------- */

interface Phase {
  s: GameState;
  step: ClearStep;
  heap: Heap;
  mult: number;
  seq: number;
  protectedIds: Set<number>;
  iceHit: Set<number>;
  adjHit: Set<number>;
  scheduled: Set<number>;
  reserved: Set<number>;
}

function push(ph: Phase, e: Omit<Ev, 'seq'>) {
  const b = ph.s.board;
  if (e.x < 0 || e.y < 0 || e.x >= b.w || e.y >= b.h) return;
  if (e.kind === 'hit') ph.scheduled.add(e.y * b.w + e.x);
  ph.heap.push({ ...e, seq: ph.seq++ });
}

function popup(ph: Phase, x: number, y: number, t: number): number {
  ph.step.popups.push({ x, y, t, value: 0 });
  return ph.step.popups.length - 1;
}

function gain(ph: Phase, pts: number, src: number) {
  ph.s.score += pts;
  ph.step.score += pts;
  if (src >= 0 && src < ph.step.popups.length) ph.step.popups[src].value += pts;
}

function countGoal(ph: Phase, kind: 'ice' | 'crate' | 'chain') {
  for (const g of ph.s.goals) if (g.kind === kind) g.done++;
}

function damageIce(ph: Phase, i: number, t: number, src: number) {
  const c = ph.s.board.cells[i];
  if (c.ice <= 0 || ph.iceHit.has(i)) return;
  ph.iceHit.add(i);
  c.ice--;
  const w = ph.s.board.w;
  ph.step.blockers.push({ x: i % w, y: Math.floor(i / w), t, type: 'ice', left: c.ice });
  gain(ph, SCORE.blocker, src);
  if (c.ice === 0) countGoal(ph, 'ice');
}

function countTileGoals(ph: Phase, tile: Tile) {
  for (const g of ph.s.goals) {
    if (g.kind === 'color' && tile.kind === 'gem' && tile.color === g.color) g.done++;
    if (g.kind === 'special' && familyOf(tile.special) === g.special) g.done++;
  }
}

function removeTile(ph: Phase, i: number, t: number, src: number, activate: boolean, mergeTo?: Pos) {
  const s = ph.s;
  const w = s.board.w;
  const c = s.board.cells[i];
  const tile = c.tile;
  if (!tile) return;
  c.tile = null;
  const x = i % w;
  const y = Math.floor(i / w);
  ph.step.cleared.push({ id: tile.id, x, y, t, color: tile.color, special: tile.special, ...(mergeTo ? { mergeTo } : {}) });
  s.stats.cleared++;
  countTileGoals(ph, tile);
  gain(ph, SCORE.gem * ph.mult, src);
  damageIce(ph, i, t, src);
  if (tile.special !== 'none') {
    s.stats.specialsUsed++;
    const fam = familyOf(tile.special);
    if (fam) s.stats.used[fam]++;
    if (activate) {
      const eff = effectOf(tile.special);
      if (eff) push(ph, { kind: 'act', t: t + TIME.fuse, x, y, src: popup(ph, x, y, t), eff, color: tile.color });
    }
  }
}

function hitCell(ph: Phase, e: Ev) {
  const b = ph.s.board;
  const i = e.y * b.w + e.x;
  const c = b.cells[i];
  if (!c.playable) return;
  if (c.crate > 0) {
    c.crate--;
    ph.step.blockers.push({ x: e.x, y: e.y, t: e.t, type: 'crate', left: c.crate });
    gain(ph, SCORE.blocker, e.src);
    if (c.crate === 0) countGoal(ph, 'crate');
    return;
  }
  if (e.kind === 'adj') return;
  const tile = c.tile;
  if (!tile || tile.kind === 'chick' || ph.protectedIds.has(tile.id)) return;
  if (c.chain > 0) {
    c.chain--;
    ph.step.blockers.push({ x: e.x, y: e.y, t: e.t, type: 'chain', left: c.chain });
    gain(ph, SCORE.blocker, e.src);
    if (c.chain === 0) countGoal(ph, 'chain');
    return;
  }
  removeTile(ph, i, e.t, e.src, true, e.mergeTo);
}

function mostCommonColor(ph: Phase): number {
  const counts = new Array<number>(ph.s.colors).fill(0);
  for (const c of ph.s.board.cells) {
    const t = c.tile;
    if (c.playable && t && t.kind === 'gem' && t.color >= 0 && t.color < counts.length) counts[t.color]++;
  }
  let best = -1;
  let bestN = 0;
  counts.forEach((n, col) => {
    if (n > bestN) {
      best = col;
      bestN = n;
    }
  });
  return best;
}

function goalColors(ph: Phase): Set<number> {
  const out = new Set<number>();
  for (const g of ph.s.goals) if (g.kind === 'color' && g.done < g.target && g.color !== undefined) out.add(g.color);
  return out;
}

/** Where should a butterfly fly? Obstacles and goals first. */
function pickTarget(ph: Phase): Pos | null {
  const b = ph.s.board;
  const tiers: number[][] = [[], [], [], [], [], []];
  const colors = goalColors(ph);
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i];
    if (!c.playable || ph.scheduled.has(i) || ph.reserved.has(i)) continue;
    if (c.crate > 0) tiers[0].push(i);
    else if (!c.tile || c.tile.kind !== 'gem' || ph.protectedIds.has(c.tile.id)) continue;
    else if (c.chain > 0) tiers[1].push(i);
    else if (c.ice > 0) tiers[2].push(i);
    else if (i >= b.w && b.cells[i - b.w].tile?.kind === 'chick') tiers[3].push(i);
    else if (colors.has(c.tile.color)) tiers[4].push(i);
    else tiers[5].push(i);
  }
  for (const tier of tiers) {
    if (tier.length > 0) {
      const i = ph.s.rng.pick(tier);
      return { x: i % b.w, y: Math.floor(i / b.w) };
    }
  }
  return null;
}

function rocketHits(ph: Phase, x: number, y: number, t: number, dir: 'h' | 'v', src: number, color: number) {
  const b = ph.s.board;
  ph.step.activations.push({ kind: 'rocket', dir, x, y, t, color });
  push(ph, { kind: 'hit', t, x, y, src });
  const len = dir === 'h' ? b.w : b.h;
  for (let d = 1; d < len; d++) {
    for (const sgn of [-1, 1]) {
      const nx = dir === 'h' ? x + sgn * d : x;
      const ny = dir === 'v' ? y + sgn * d : y;
      push(ph, { kind: 'hit', t: t + d * TIME.rocketStep, x: nx, y: ny, src });
    }
  }
}

function activate(ph: Phase, e: Ev) {
  const eff = e.eff!;
  const { x, y, t, src } = e;
  const color = e.color ?? -1;
  const b = ph.s.board;
  switch (eff.type) {
    case 'rocket':
      rocketHits(ph, x, y, t, eff.dir, src, color);
      break;
    case 'cross':
      rocketHits(ph, x, y, t, 'h', src, color);
      rocketHits(ph, x, y, t, 'v', src, color);
      break;
    case 'bigCross':
      for (let d = -1; d <= 1; d++) {
        if (y + d >= 0 && y + d < b.h) rocketHits(ph, x, y + d, t, 'h', src, color);
        if (x + d >= 0 && x + d < b.w) rocketHits(ph, x + d, y, t, 'v', src, color);
      }
      break;
    case 'bomb': {
      const r = Math.floor(Math.sqrt(eff.r2));
      ph.step.activations.push({ kind: 'bomb', x, y, t, radius: Math.sqrt(eff.r2) + 0.5, color });
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > eff.r2) continue;
          push(ph, { kind: 'hit', t: t + 0.15 + Math.sqrt(d2) * 0.1, x: x + dx, y: y + dy, src });
        }
      }
      break;
    }
    case 'rainbow': {
      const col = eff.color ?? mostCommonColor(ph);
      const targets: Pos[] = [];
      if (col >= 0) {
        for (let i = 0; i < b.cells.length; i++) {
          const c = b.cells[i];
          const tl = c.tile;
          if (c.playable && tl && tl.kind === 'gem' && tl.color === col && tl.special !== 'rainbow') {
            targets.push({ x: i % b.w, y: Math.floor(i / b.w) });
          }
        }
      }
      targets.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
      ph.step.activations.push({ kind: 'rainbow', x, y, t, color: col, targets });
      targets.forEach((p, k) => push(ph, { kind: 'hit', t: t + 0.6 + k * 0.05, x: p.x, y: p.y, src }));
      break;
    }
    case 'rainbowAll': {
      ph.s.stats.megaCombos++;
      ph.step.activations.push({ kind: 'rainbowAll', x, y, t });
      for (let i = 0; i < b.cells.length; i++) {
        const px = i % b.w;
        const py = Math.floor(i / b.w);
        push(ph, { kind: 'hit', t: t + 0.4 + Math.hypot(px - x, py - y) * 0.12, x: px, y: py, src });
      }
      break;
    }
    case 'rainbowTransform': {
      const targets: Pos[] = [];
      for (let i = 0; i < b.cells.length; i++) {
        const c = b.cells[i];
        const tl = c.tile;
        if (c.playable && c.chain === 0 && tl && tl.kind === 'gem' && tl.color === eff.color && tl.special === 'none') {
          targets.push({ x: i % b.w, y: Math.floor(i / b.w) });
        }
      }
      targets.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
      ph.step.activations.push({ kind: 'rainbow', x, y, t, color: eff.color, targets });
      targets.forEach((p, k) => {
        const tl = b.cells[p.y * b.w + p.x].tile!;
        let sp = eff.into;
        if (sp === 'rocketH' || sp === 'rocketV') sp = ph.s.rng.next() < 0.5 ? 'rocketH' : 'rocketV';
        tl.special = sp;
        ph.step.transformed.push({ id: tl.id, x: p.x, y: p.y, t: t + 0.5 + k * 0.05, special: sp });
        push(ph, { kind: 'hit', t: t + 1.6 + k * 0.16, x: p.x, y: p.y, src });
      });
      break;
    }
    case 'butterfly': {
      push(ph, { kind: 'hit', t: t + 0.05, x, y, src });
      for (const d of DIRS4) push(ph, { kind: 'hit', t: t + 0.1, x: x + d.x, y: y + d.y, src });
      for (let k = 0; k < eff.count; k++) {
        const target = pickTarget(ph);
        if (!target) break;
        ph.reserved.add(target.y * b.w + target.x);
        const arrive = t + TIME.flight + k * 0.3;
        ph.step.activations.push({ kind: 'butterfly', x, y, t: t + k * 0.3, to: target, arrive, color, carry: eff.carry });
        const carried = effectOf(eff.carry);
        if (carried) push(ph, { kind: 'act', t: arrive, x: target.x, y: target.y, src, eff: carried, color });
        else push(ph, { kind: 'hit', t: arrive, x: target.x, y: target.y, src });
      }
      break;
    }
  }
}

function runPhase(s: GameState, groups: MatchGroup[], actions: InitialAction[], cascade: number): ClearStep {
  const step: ClearStep = {
    type: 'clear',
    cascade,
    cleared: [],
    activations: [],
    blockers: [],
    created: [],
    transformed: [],
    popups: [],
    score: 0,
    duration: 0,
    groups: groups.map((g) => g.cells.length),
  };
  const ph: Phase = {
    s,
    step,
    heap: new Heap(),
    mult: Math.min(cascade, 8),
    seq: 0,
    protectedIds: new Set(),
    iceHit: new Set(),
    adjHit: new Set(),
    scheduled: new Set(),
    reserved: new Set(),
  };
  const b = s.board;

  for (const g of groups) {
    const cx = g.cells.reduce((a, p) => a + p.x, 0) / g.cells.length;
    const cy = g.cells.reduce((a, p) => a + p.y, 0) / g.cells.length;
    const src = popup(ph, cx, cy, 0);
    let mergeTo: Pos | undefined;
    if (g.special !== 'none' && g.at) {
      const ai = g.at.y * b.w + g.at.x;
      const cell = b.cells[ai];
      const old = cell.tile!;
      countTileGoals(ph, old);
      const nt = newTile(s, g.special === 'rainbow' ? -1 : g.color);
      nt.special = g.special;
      cell.tile = nt;
      ph.protectedIds.add(nt.id);
      step.created.push({ tile: { ...nt }, x: g.at.x, y: g.at.y, t: TIME.create, replacedId: old.id });
      s.stats.specialsMade++;
      const fam = familyOf(g.special);
      if (fam) s.stats.made[fam]++;
      gain(ph, SCORE.create[g.special] + SCORE.gem * ph.mult, src);
      damageIce(ph, ai, 0, src);
      mergeTo = g.at;
    }
    for (const p of g.cells) {
      if (g.at && p.x === g.at.x && p.y === g.at.y && mergeTo) continue;
      push(ph, { kind: 'hit', t: 0, x: p.x, y: p.y, src, ...(mergeTo ? { mergeTo } : {}) });
      for (const d of DIRS4) {
        const nx = p.x + d.x;
        const ny = p.y + d.y;
        if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) continue;
        const ni = ny * b.w + nx;
        if (b.cells[ni].crate > 0 && !ph.adjHit.has(ni)) {
          ph.adjHit.add(ni);
          push(ph, { kind: 'adj', t: 0.05, x: nx, y: ny, src });
        }
      }
    }
  }

  for (const a of actions) {
    if (a.type === 'trigger') {
      push(ph, { kind: 'hit', t: a.t, x: a.x, y: a.y, src: popup(ph, a.x, a.y, a.t) });
    } else {
      const src = popup(ph, a.x, a.y, a.t);
      for (const p of a.consume) removeTile(ph, p.y * b.w + p.x, a.t, src, false, a.consume.length > 1 ? { x: a.x, y: a.y } : undefined);
      push(ph, { kind: 'act', t: a.t + TIME.fuse, x: a.x, y: a.y, src, eff: a.eff, color: a.color });
      s.stats.combos += a.consume.length > 1 ? 1 : 0;
    }
  }

  let guard = 0;
  while (ph.heap.size > 0 && guard++ < 20000) {
    const e = ph.heap.pop()!;
    step.duration = Math.max(step.duration, e.t);
    if (e.kind === 'act') activate(ph, e);
    else hitCell(ph, e);
  }
  for (const a of step.activations) if (a.kind === 'butterfly') step.duration = Math.max(step.duration, a.arrive);
  step.popups = step.popups.filter((p) => p.value > 0);
  for (const g of s.goals) if (g.kind === 'score') g.done = s.score;
  return step;
}

/* ---------------- settle: gravity + chicks ---------------- */

function spawnTile(s: GameState, spawnedChick: { v: boolean }): Tile {
  const ch = s.chicks;
  if (
    ch &&
    !spawnedChick.v &&
    ch.spawned < ch.total &&
    ch.spawned - ch.collected < ch.maxOnBoard &&
    s.movesMade - ch.lastSpawnMove >= Math.max(1, ch.gap) &&
    // usually a random column; guaranteed when the remaining moves get tight
    (s.rng.next() < 0.35 || (s.movesLeft !== null && s.movesLeft <= (ch.total - ch.spawned) * 5 + 2))
  ) {
    ch.spawned++;
    ch.lastSpawnMove = s.movesMade;
    spawnedChick.v = true;
    return newTile(s, -1, 'chick');
  }
  return newTile(s, s.rng.int(s.colors));
}

export function collectChicks(s: GameState): CollectStep | null {
  const b = s.board;
  const found: CollectStep['chicks'] = [];
  for (let x = 0; x < b.w; x++) {
    const y = s.exits[x];
    if (y < 0) continue;
    const c = b.cells[y * b.w + x];
    if (c.tile?.kind === 'chick') {
      found.push({ id: c.tile.id, x, y });
      c.tile = null;
    }
  }
  if (found.length === 0) return null;
  const pts = found.length * SCORE.chick;
  s.score += pts;
  if (s.chicks) s.chicks.collected += found.length;
  for (const g of s.goals) {
    if (g.kind === 'chick') g.done += found.length;
    if (g.kind === 'score') g.done = s.score;
  }
  return { type: 'collect', chicks: found, score: pts };
}

export function settle(s: GameState, steps: Step[]): void {
  const flag = { v: false };
  for (let k = 0; k < 30; k++) {
    const fall = applyGravity(s.board, { spawn: () => spawnTile(s, flag) });
    if (fall.moves.length > 0 || fall.spawns.length > 0) steps.push(fall);
    const col = collectChicks(s);
    if (!col) break;
    steps.push(col);
  }
}

/**
 * Run clear phases (with cascades) until the board is stable.
 * Shuffles the board when no move is left. Returns the highest cascade.
 */
export function resolveAll(s: GameState, steps: Step[], groups: MatchGroup[], actions: InitialAction[]): number {
  let cascade = 0;
  let g = groups;
  let a = actions;
  while ((g.length > 0 || a.length > 0) && cascade < 60) {
    cascade++;
    steps.push(runPhase(s, g, a, cascade));
    settle(s, steps);
    g = findMatches(s.board);
    a = [];
  }
  s.stats.maxCascade = Math.max(s.stats.maxCascade, cascade);
  if (!hasMove(s.board)) steps.push(shuffleBoard(s));
  return cascade;
}
