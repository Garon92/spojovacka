/** Win rates of a weaker "casual" bot (sees few moves, often picks a random one) at the tuned move limits. */
import { chooseMove } from '../src/core/bot';
import { playMove } from '../src/core/game';
import { LEVELS, levelConfig } from '../src/core/levels';
import { createRng } from '../src/core/rng';
import { createGame, isLost, isWon } from '../src/core/state';

const GAMES = Number(process.argv[2] ?? 30);
const out: string[] = [];
for (const l of LEVELS) {
  let won = 0;
  for (let g = 0; g < GAMES; g++) {
    const s = createGame(levelConfig(l), 20000 + g * 7 + l.id);
    const rng = createRng(g + 1);
    while (!isWon(s) && !isLost(s)) {
      const m = chooseMove(s, rng, 0.3, 6);
      if (!m) break;
      playMove(s, m);
    }
    if (isWon(s)) won++;
  }
  out.push(`${l.id}:${Math.round((won / GAMES) * 100)}%`);
}
console.log(out.join('  '));
