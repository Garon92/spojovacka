import { isAdjacent, isSwappable, swapTiles } from './board';
import { findMatches } from './match';
import { comboEffect, resolveAll, type InitialAction } from './resolve';
import { isWon, type GameState } from './state';
import type { Move, MoveResult, Pos, Special, Step } from './types';

export const BONUS_PER_MOVE = 100;

function useMove(s: GameState) {
  s.movesMade++;
  if (s.movesLeft !== null) s.movesLeft = Math.max(0, s.movesLeft - 1);
}

function invalid(steps: Step[] = []): MoveResult {
  return { valid: false, steps, gained: 0, cascades: 0 };
}

/** Is this move allowed right now (without performing it)? */
export function canPlay(s: GameState, m: Move): boolean {
  if (s.movesLeft !== null && s.movesLeft <= 0) return false;
  const b = s.board;
  if (m.type === 'tap') {
    return isSwappable(b, m.a.x, m.a.y) && b.cells[m.a.y * b.w + m.a.x].tile!.special !== 'none';
  }
  return isAdjacent(m.a, m.b) && isSwappable(b, m.a.x, m.a.y) && isSwappable(b, m.b.x, m.b.y);
}

/**
 * Perform a move and resolve everything it causes. Mutates the state.
 * Invalid swaps (no match, no special) return valid=false with a swap-back step.
 */
export function playMove(s: GameState, m: Move): MoveResult {
  if (!canPlay(s, m)) return invalid();
  const b = s.board;
  const before = s.score;
  const steps: Step[] = [];

  if (m.type === 'tap') {
    useMove(s);
    const cascades = resolveAll(s, steps, [], [{ type: 'trigger', x: m.a.x, y: m.a.y, t: 0 }]);
    return { valid: true, steps, gained: s.score - before, cascades };
  }

  const { a, b: c } = m;
  const ta = b.cells[a.y * b.w + a.x].tile!;
  const tc = b.cells[c.y * b.w + c.x].tile!;
  swapTiles(b, a, c);
  // now ta sits at c and tc sits at a
  const sa = ta.special !== 'none';
  const sc = tc.special !== 'none';

  if (!sa && !sc) {
    const groups = findMatches(b, [c, a]);
    if (groups.length === 0) {
      swapTiles(b, a, c);
      return invalid([{ type: 'swap', a, b: c, ida: ta.id, idb: tc.id, invalid: true }]);
    }
    steps.push({ type: 'swap', a, b: c, ida: ta.id, idb: tc.id, invalid: false });
    useMove(s);
    const cascades = resolveAll(s, steps, groups, []);
    return { valid: true, steps, gained: s.score - before, cascades };
  }

  steps.push({ type: 'swap', a, b: c, ida: ta.id, idb: tc.id, invalid: false });
  useMove(s);
  const actions: InitialAction[] = [];
  const groups = findMatches(b, [c, a]);
  if (sa && sc) {
    const { eff, color } = comboEffect(ta, tc);
    actions.push({ type: 'effect', x: c.x, y: c.y, t: 0, eff, consume: [c, a], color });
  } else {
    const spPos: Pos = sa ? c : a;
    const sp = sa ? ta : tc;
    const other = sa ? tc : ta;
    if (sp.special === 'rainbow') {
      const color = other.kind === 'gem' && other.color >= 0 ? other.color : null;
      actions.push({ type: 'effect', x: spPos.x, y: spPos.y, t: 0, eff: { type: 'rainbow', color }, consume: [spPos], color: -1 });
    } else {
      actions.push({ type: 'trigger', x: spPos.x, y: spPos.y, t: 0 });
    }
  }
  const cascades = resolveAll(s, steps, groups, actions);
  return { valid: true, steps, gained: s.score - before, cascades };
}

/**
 * Level finale: leftover moves turn into rockets (every 4th into a bomb) that fire one after another,
 * then any specials left on the board go off too.
 */
export function playBonus(s: GameState): MoveResult {
  const steps: Step[] = [];
  const before = s.score;
  const left = s.movesLeft ?? 0;
  if (!isWon(s)) return invalid();
  let cascades = 0;
  if (left > 0) {
    const b = s.board;
    const cand: Pos[] = [];
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (!isSwappable(b, x, y)) continue;
        const t = b.cells[y * b.w + x].tile!;
        if (t.kind === 'gem' && t.special === 'none') cand.push({ x, y });
      }
    }
    s.rng.shuffle(cand);
    const n = Math.min(left, cand.length, 12);
    const converted: { id: number; x: number; y: number; special: Special; order: number }[] = [];
    const actions: InitialAction[] = [];
    for (let k = 0; k < n; k++) {
      const p = cand[k];
      const t = b.cells[p.y * b.w + p.x].tile!;
      t.special = k % 4 === 3 ? 'bomb' : s.rng.next() < 0.5 ? 'rocketH' : 'rocketV';
      converted.push({ id: t.id, x: p.x, y: p.y, special: t.special, order: k });
      actions.push({ type: 'trigger', x: p.x, y: p.y, t: 1 + k * 0.9 });
    }
    s.score += left * BONUS_PER_MOVE;
    s.movesLeft = 0;
    steps.push({ type: 'bonus', converted, movesUsed: left });
    cascades = resolveAll(s, steps, [], actions);
  }
  // detonate remaining specials
  for (let round = 0; round < 5; round++) {
    const b = s.board;
    const acts: InitialAction[] = [];
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const c = b.cells[y * b.w + x];
        if (c.playable && c.crate === 0 && c.tile && c.tile.special !== 'none') {
          acts.push({ type: 'trigger', x, y, t: acts.length * 0.6 });
        }
      }
    }
    if (acts.length === 0) break;
    cascades = Math.max(cascades, resolveAll(s, steps, [], acts));
  }
  for (const g of s.goals) if (g.kind === 'score') g.done = s.score;
  return { valid: true, steps, gained: s.score - before, cascades };
}
