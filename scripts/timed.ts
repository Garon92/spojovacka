/** Score distribution for the timed mode (≈ 24 moves in 90 s) → star thresholds. */
import { chooseMove } from '../src/core/bot';
import { playMove } from '../src/core/game';
import { createRng } from '../src/core/rng';
import { createGame } from '../src/core/state';

const PLAIN8 = Array(8).fill('........');
for (const [name, colors] of [['easy', 4], ['normal', 5], ['hard', 6]] as const) {
  const scores: number[] = [];
  for (let g = 0; g < 60; g++) {
    const s = createGame({ layout: PLAIN8, colors, moves: null, goals: [] }, 900 + g);
    const rng = createRng(g * 3 + 1);
    for (let i = 0; i < 24; i++) {
      const m = chooseMove(s, rng, 0.6);
      if (!m) break;
      playMove(s, m);
    }
    scores.push(s.score);
  }
  scores.sort((a, b) => a - b);
  const p = (q: number) => scores[Math.floor(q * (scores.length - 1))];
  console.log(name, 'p20', p(0.2), 'p50', p(0.5), 'p85', p(0.85), 'max', p(1));
}
