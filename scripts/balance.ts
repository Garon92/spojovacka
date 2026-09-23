/**
 * Level balancing by simulation.
 *   npm run balance            – simulate all levels, print the table
 *   npm run balance -- --write – also write tuned moves / star thresholds to src/core/balance.json
 *   npm run balance -- --only=12,13 --games=80
 *
 * 1) Play each level with unlimited moves and record how many moves the bot needed.
 * 2) moves = the percentile of that distribution matching the target win rate of the level (difficulty curve).
 * 3) Replay with the chosen move limit (+ leftover-move finale) → 2★ / 3★ score thresholds from the winners.
 */
import fs from 'node:fs';
import { chooseMove } from '../src/core/bot';
import { playBonus, playMove } from '../src/core/game';
import { LEVELS, levelConfig, type LevelDef } from '../src/core/levels';
import { createRng } from '../src/core/rng';
import { createGame, isLost, isWon } from '../src/core/state';

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const GAMES = Number(opt('games') ?? 60);
const only = opt('only')?.split(',').map(Number);
const write = args.includes('--write');
const SKILL = Number(opt('skill') ?? 0.6);

/** target bot win rate per level: a gentle curve with breathers after the world bosses */
export function targetWinRate(l: LevelDef): number {
  const inWorld = (l.id - 1) % 10; // 0..9
  const base = [0.98, 0.93, 0.88, 0.83][l.world];
  const slope = [0.04, 0.06, 0.07, 0.08][l.world];
  let t = base - (slope * inWorld) / 9;
  if (inWorld === 9) t -= 0.04; // boss
  if (l.tip) t += 0.03; // tutorial levels are easier
  if (l.id <= 2) t = 0.98;
  return Math.min(0.98, Math.max(0.5, t));
}

function movesNeeded(l: LevelDef, seed: number): number {
  const g = createGame({ ...levelConfig(l), moves: 200 }, seed);
  const rng = createRng(seed * 7 + 1);
  for (let i = 0; i < 200; i++) {
    if (isWon(g)) return g.movesMade;
    const m = chooseMove(g, rng, SKILL);
    if (!m) return Infinity;
    playMove(g, m);
  }
  return isWon(g) ? g.movesMade : Infinity;
}

function playLimited(l: LevelDef, moves: number, seed: number): { won: boolean; score: number } {
  const g = createGame({ ...levelConfig(l), moves }, seed);
  const rng = createRng(seed * 13 + 5);
  while (!isWon(g) && !isLost(g)) {
    const m = chooseMove(g, rng, SKILL);
    if (!m) break;
    playMove(g, m);
  }
  const won = isWon(g);
  if (won) playBonus(g);
  return { won, score: g.score };
}

const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.ceil(p * arr.length) - 1))];
const round = (v: number, step: number) => Math.round(v / step) * step;

const out: Record<string, { moves: number; stars: [number, number] }> = write
  ? JSON.parse(fs.readFileSync(new URL('../src/core/balance.json', import.meta.url), 'utf8'))
  : {};

console.log('lvl  target  p50  moves  win%   ★★     ★★★   (ms)');
for (const l of LEVELS) {
  if (only && !only.includes(l.id)) continue;
  const t0 = Date.now();
  const need: number[] = [];
  for (let g = 0; g < GAMES; g++) need.push(movesNeeded(l, 1000 + g * 31 + l.id));
  need.sort((a, b) => a - b);
  const target = targetWinRate(l);
  // generous percentile for the target win rate, but cut long unlucky tails (median × 1.7)
  const p50 = pct(need, 0.5);
  let moves = Math.max(10, Math.min(45, pct(need, target) + 2, Math.round(p50 * 1.7) + 3));
  let wins: number[] = [];
  let won = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    wins = [];
    won = 0;
    for (let g = 0; g < GAMES; g++) {
      const r = playLimited(l, moves, 5000 + g * 17 + l.id);
      if (r.won) {
        won++;
        wins.push(r.score);
      }
    }
    // the second (independent) run must roughly confirm the target; otherwise give an extra move
    if (won / GAMES >= Math.min(target, 0.9) - 0.06 || moves >= 45) break;
    moves++;
  }
  wins.sort((a, b) => a - b);
  const s2 = wins.length ? round(pct(wins, 0.3), 100) : l.stars[0];
  const s3 = wins.length ? Math.max(s2 + 300, round(pct(wins, 0.8), 100)) : l.stars[1];
  out[String(l.id)] = { moves, stars: [s2, s3] };
  console.log(
    `${String(l.id).padStart(3)}  ${(target * 100).toFixed(0).padStart(5)}%  ${String(pct(need, 0.5)).padStart(3)}  ${String(moves).padStart(5)}  ${((won / GAMES) * 100).toFixed(0).padStart(4)}%  ${String(s2).padStart(6)}  ${String(s3).padStart(6)}  (${Date.now() - t0})`,
  );
}
if (write) {
  fs.writeFileSync(new URL('../src/core/balance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log('written src/core/balance.json');
}
