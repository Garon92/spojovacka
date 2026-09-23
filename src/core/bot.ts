import { playMove } from './game';
import { findSwaps, findTaps } from './moves';
import type { Rng } from './rng';
import { cloneState, goalProgress, type GameState } from './state';
import type { Move } from './types';

/** Obstacles still on the board (ice layers + crate hp + chains) – partial progress for the bot. */
export function obstaclesLeft(s: GameState): number {
  let n = 0;
  for (const c of s.board.cells) if (c.playable) n += c.ice + c.crate + c.chain;
  return n;
}

/** How far down the chicks are (0..1 each). */
function chickDepth(s: GameState): number {
  const b = s.board;
  let d = 0;
  for (let i = 0; i < b.cells.length; i++) {
    if (b.cells[i].tile?.kind === 'chick') {
      const x = i % b.w;
      const y = Math.floor(i / b.w);
      d += y / Math.max(1, s.exits[x]);
    }
  }
  return d;
}

export function evaluate(s: GameState): number {
  return goalProgress(s) * 1000 + s.score / 25 - obstaclesLeft(s) * 12 + chickDepth(s) * 40;
}

export function candidateMoves(s: GameState): Move[] {
  const swaps = findSwaps(s.board).map((sw): Move => ({ type: 'swap', a: sw.a, b: sw.b }));
  const taps = findTaps(s.board).map((a): Move => ({ type: 'tap', a }));
  return [...swaps, ...taps];
}

/**
 * Greedy one-move look-ahead bot (used for level balancing and the auto-play debug hook).
 * `skill` = probability of taking the best evaluated move (otherwise one of the top 4).
 * The look-ahead uses a different random seed, so it can't see future refills.
 */
export function chooseMove(s: GameState, rng: Rng, skill = 0.8, maxCandidates = 24): Move | null {
  let cands = candidateMoves(s);
  if (cands.length === 0) return null;
  if (cands.length > maxCandidates) {
    const specials = cands.filter((m) => m.type === 'tap');
    const rest = rng.shuffle(cands.filter((m) => m.type !== 'tap')).slice(0, maxCandidates - specials.length);
    cands = [...specials, ...rest];
  }
  const scored = cands.map((m) => {
    const c = cloneState(s, rng.int(2 ** 31));
    const r = playMove(c, m);
    return { m, v: r.valid ? evaluate(c) : -Infinity };
  });
  scored.sort((p, q) => q.v - p.v);
  if (rng.next() < skill) return scored[0].m;
  return scored[rng.int(Math.min(4, scored.length))].m;
}
