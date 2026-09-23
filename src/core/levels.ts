import balance from './balance.json';
import { createRng } from './rng';
import type { ChickConfig, GameConfig, GoalDef } from './types';

/** Short tutorial tips shown in the level intro (see ui/tips.ts). */
export type TipId =
  | 'swap'
  | 'goals'
  | 'rocket'
  | 'ice'
  | 'bomb'
  | 'holes'
  | 'chick'
  | 'butterfly'
  | 'crate'
  | 'rainbow'
  | 'chain'
  | 'combo';

export interface LevelDef {
  id: number;
  world: number;
  colors: number;
  moves: number;
  layout: string[];
  goals: GoalDef[];
  chicks?: ChickConfig;
  /** score needed for 2 and 3 stars (1 star = level won) */
  stars: [number, number];
  tip?: TipId;
}

export interface WorldDef {
  id: number;
  name: string;
  emoji: string;
  /** css class suffix for background */
  theme: 'meadow' | 'forest' | 'lake' | 'night';
}

export const WORLDS: WorldDef[] = [
  { id: 0, name: 'Rozkvetlá louka', emoji: '🌼', theme: 'meadow' },
  { id: 1, name: 'Tajemný les', emoji: '🌲', theme: 'forest' },
  { id: 2, name: 'Zamrzlé jezero', emoji: '❄️', theme: 'lake' },
  { id: 3, name: 'Hvězdná noc', emoji: '🌙', theme: 'night' },
];

const P8 = ['........', '........', '........', '........', '........', '........', '........', '........'];
const P9 = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];

type Def = Omit<LevelDef, 'id' | 'world'>;

// Colors: 0 red heart, 1 blue circle, 2 yellow star, 3 green triangle, 4 purple diamond, 5 orange square.
// `moves` and `stars` are tuned with `npm run balance` (bot simulation).
const W1: Def[] = [
  {
    colors: 5,
    moves: 15,
    layout: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
    goals: [{ type: 'color', color: 0, count: 24 }],
    stars: [900, 1400],
    tip: 'swap',
  },
  {
    colors: 5,
    moves: 18,
    layout: P8,
    goals: [
      { type: 'color', color: 1, count: 25 },
      { type: 'color', color: 2, count: 25 },
    ],
    stars: [2000, 3000],
    tip: 'goals',
  },
  {
    colors: 5,
    moves: 20,
    layout: P8,
    goals: [{ type: 'special', special: 'rocket', count: 2 }],
    stars: [2500, 3800],
    tip: 'rocket',
  },
  {
    colors: 5,
    moves: 20,
    layout: ['........', '.111111.', '.111111.', '.111111.', '.111111.', '.111111.', '.111111.', '........'],
    goals: [{ type: 'ice' }],
    stars: [2500, 3800],
    tip: 'ice',
  },
  {
    colors: 5,
    moves: 22,
    layout: ['#......#', '........', '........', '........', '........', '........', '........', '#......#'],
    goals: [
      { type: 'special', special: 'bomb', count: 1 },
      { type: 'color', color: 3, count: 20 },
    ],
    stars: [3000, 4500],
    tip: 'bomb',
  },
  {
    colors: 5,
    moves: 22,
    layout: ['#..##..#', '........', '........', '........', '#......#', '##....##', '###..###'],
    goals: [
      { type: 'color', color: 0, count: 25 },
      { type: 'color', color: 4, count: 20 },
    ],
    stars: [3000, 4500],
    tip: 'holes',
  },
  {
    colors: 5,
    moves: 20,
    layout: ['...o....', '........', '........', '........', '........', '........', '........', '........'],
    goals: [{ type: 'chick', count: 3 }],
    chicks: { total: 3, maxOnBoard: 1, gap: 2 },
    stars: [2500, 4000],
    tip: 'chick',
  },
  {
    colors: 5,
    moves: 22,
    layout: ['11....11', '1......1', '........', '........', '........', '........', '1......1', '11....11'],
    goals: [
      { type: 'special', special: 'butterfly', count: 2 },
      { type: 'ice' },
    ],
    stars: [3000, 4500],
    tip: 'butterfly',
  },
  {
    colors: 5,
    moves: 22,
    layout: ['........', '..2222..', '.222222.', '.22..22.', '.22..22.', '.222222.', '..2222..', '........'],
    goals: [{ type: 'ice' }],
    stars: [3000, 4500],
  },
  {
    colors: 5,
    moves: 25,
    layout: ['..o..o..', '........', '........', '........', '11111111', '11111111', '........', '........'],
    goals: [{ type: 'chick', count: 3 }, { type: 'ice' }],
    chicks: { total: 3, maxOnBoard: 2, gap: 4 },
    stars: [4000, 6000],
  },
];

const W2: Def[] = [
  {
    colors: 5,
    moves: 20,
    layout: ['........', 'cc....cc', 'cc....cc', '........', '........', '..cccc..', '..cccc..', '........'],
    goals: [{ type: 'crate' }],
    stars: [2500, 4000],
    tip: 'crate',
  },
  {
    colors: 5,
    moves: 22,
    layout: ['........', '.c....c.', '.c....c.', '........', '........', '.c....c.', '.c....c.', '........'],
    goals: [{ type: 'crate' }, { type: 'color', color: 2, count: 35 }],
    stars: [3000, 4500],
  },
  {
    colors: 6,
    moves: 22,
    layout: P8,
    goals: [
      { type: 'color', color: 5, count: 15 },
      { type: 'score', target: 2500 },
    ],
    stars: [3200, 4500],
    tip: 'rainbow',
  },
  {
    colors: 5,
    moves: 24,
    layout: ['...o....', '........', '.C....C.', '........', '...CC...', '........', '.C....C.', '........'],
    goals: [{ type: 'chick', count: 2 }, { type: 'crate' }],
    chicks: { total: 2, maxOnBoard: 1, gap: 3 },
    stars: [3500, 5000],
  },
  {
    colors: 5,
    moves: 22,
    layout: ['###..###', '##....##', '#......#', '........', '........', '###..###', '###..###', '###..###'],
    goals: [
      { type: 'color', color: 3, count: 25 },
      { type: 'color', color: 1, count: 20 },
    ],
    stars: [3000, 4500],
  },
  {
    colors: 5,
    moves: 28,
    layout: ['c......c', '.111111.', '.1c11c1.', '.111111.', '.111111.', '.1c11c1.', '.111111.', 'c......c'],
    goals: [{ type: 'ice' }, { type: 'crate' }],
    stars: [5000, 7500],
  },
  {
    colors: 5,
    moves: 24,
    layout: ['..o..o..', '........', 'cc....cc', '........', '...CC...', '........', '........', '........'],
    goals: [{ type: 'chick', count: 4 }, { type: 'crate' }],
    chicks: { total: 4, maxOnBoard: 2, gap: 3 },
    stars: [3500, 5500],
  },
  {
    colors: 5,
    moves: 25,
    layout: ['C......C', '........', '........', '...CC...', '...CC...', '........', '........', 'C......C'],
    goals: [{ type: 'special', special: 'rocket', count: 4 }, { type: 'crate' }],
    stars: [4000, 6000],
    tip: 'combo',
  },
  {
    colors: 5,
    moves: 25,
    layout: ['........', '.K.CC.K.', '........', 'C..KK..C', 'C..KK..C', '........', '.K.CC.K.', '........'],
    goals: [{ type: 'crate' }],
    stars: [4000, 6000],
  },
  {
    colors: 5,
    moves: 30,
    layout: ['.o....o.', '........', 'cc1111cc', '..1111..', '..1111..', 'cc1111cc', '........', '........'],
    goals: [{ type: 'chick', count: 3 }, { type: 'ice' }, { type: 'crate' }],
    chicks: { total: 3, maxOnBoard: 2, gap: 5 },
    stars: [6000, 9000],
  },
];

const W3: Def[] = [
  {
    colors: 5,
    moves: 20,
    layout: ['........', '.llllll.', '........', '.l.ll.l.', '.l.ll.l.', '........', '.llllll.', '........'],
    goals: [{ type: 'chain' }],
    stars: [2500, 4000],
    tip: 'chain',
  },
  {
    colors: 5,
    moves: 25,
    layout: ['2......2', '.2....2.', '..2..2..', '...22...', '...22...', '..2..2..', '.2....2.', '2......2'],
    goals: [{ type: 'ice' }],
    stars: [4000, 6000],
  },
  {
    colors: 5,
    moves: 24,
    layout: ['........', '.LLLLLL.', '........', '........', '........', '........', '.LLLLLL.', '........'],
    goals: [{ type: 'chain' }, { type: 'ice' }],
    stars: [3500, 5500],
  },
  {
    colors: 6,
    moves: 25,
    layout: ['#.#..#.#', '........', '#......#', '..1111..', '..1111..', '#......#', '........', '#.#..#.#'],
    goals: [{ type: 'ice' }, { type: 'color', color: 1, count: 25 }],
    stars: [3500, 5500],
  },
  {
    colors: 5,
    moves: 28,
    layout: P8,
    goals: [
      { type: 'special', special: 'bomb', count: 3 },
      { type: 'special', special: 'rocket', count: 3 },
    ],
    stars: [5000, 7500],
  },
  {
    colors: 5,
    moves: 28,
    layout: ['..o..o..', '........', 'll.ll.ll', '........', '........', '.l.ll.l.', '........', '........'],
    goals: [{ type: 'chick', count: 4 }, { type: 'chain' }],
    chicks: { total: 4, maxOnBoard: 2, gap: 3 },
    stars: [5000, 7500],
  },
  {
    colors: 5,
    moves: 30,
    layout: ['.........', '.1111111.', '.1222221.', '.1222221.', '.1222221.', '.1222221.', '.1222221.', '.1111111.', '.........'],
    goals: [{ type: 'ice' }],
    stars: [6000, 9000],
  },
  {
    colors: 5,
    moves: 28,
    layout: ['cc....cc', 'c.llll.c', '..l..l..', '..l..l..', '..l..l..', '..l..l..', 'c.llll.c', 'cc....cc'],
    goals: [{ type: 'chain' }, { type: 'crate' }],
    stars: [5000, 7500],
  },
  {
    colors: 6,
    moves: 30,
    layout: ['l......l', '........', '..l..l..', '........', '........', '..l..l..', '........', 'l......l'],
    goals: [
      { type: 'color', color: 0, count: 30 },
      { type: 'color', color: 2, count: 30 },
      { type: 'color', color: 4, count: 30 },
      { type: 'chain' },
    ],
    stars: [5500, 8000],
  },
  {
    colors: 5,
    moves: 32,
    layout: ['.o.##.o.', '........', 'LL2222LL', '........', '.C....C.', '..2222..', '........', '........'],
    goals: [{ type: 'chick', count: 3 }, { type: 'ice' }, { type: 'chain' }, { type: 'crate' }],
    chicks: { total: 3, maxOnBoard: 2, gap: 5 },
    stars: [7000, 10000],
  },
];

const W4: Def[] = [
  {
    colors: 6,
    moves: 25,
    layout: P9,
    goals: [{ type: 'score', target: 6000 }],
    stars: [8000, 11000],
  },
  {
    colors: 5,
    moves: 28,
    layout: ['####.####', '###.2.###', '#.21112.#', '.2111112.', '2111.1112', '.2111112.', '#.21112.#', '###.2.###', '####.####'],
    goals: [{ type: 'ice' }],
    stars: [5000, 7500],
  },
  {
    colors: 5,
    moves: 30,
    layout: ['..o...o..', '.........', '.KK...KK.', '.........', '...KKK...', '.........', '.........', '.........'],
    goals: [{ type: 'chick', count: 4 }, { type: 'crate' }],
    chicks: { total: 4, maxOnBoard: 2, gap: 4 },
    stars: [6000, 9000],
  },
  {
    colors: 5,
    moves: 30,
    layout: ['...o.o...', '.........', 'c.l2.2l.c', '.........', '..L...L..', '.........', 'c.l2.2l.c', '.........', '.........'],
    goals: [{ type: 'chick', count: 3 }, { type: 'chain' }, { type: 'ice' }, { type: 'crate' }],
    chicks: { total: 3, maxOnBoard: 2, gap: 5 },
    stars: [6500, 9500],
  },
  {
    colors: 6,
    moves: 28,
    layout: P9,
    goals: [
      { type: 'color', color: 0, count: 35 },
      { type: 'color', color: 1, count: 35 },
      { type: 'color', color: 5, count: 35 },
    ],
    stars: [6000, 9000],
  },
  {
    colors: 5,
    moves: 30,
    layout: ['.........', '.l.lLl.l.', '.........', '.lLl.lLl.', '.........', '.lLl.lLl.', '.........', '.l.lLl.l.', '.........'],
    goals: [{ type: 'chain' }, { type: 'ice' }],
    stars: [6000, 9000],
  },
  {
    colors: 5,
    moves: 32,
    layout: ['.........', '.2222222.', '.2.....2.', '.2.222.2.', '.2.2.2.2.', '.2.222.2.', '.2.....2.', '.2222222.', '.........'],
    goals: [{ type: 'ice' }],
    stars: [7000, 10500],
  },
  {
    colors: 5,
    moves: 32,
    layout: ['.o..o..o.', '.........', '.........', '..c...c..', '.........', '....C....', '.........', '.........', '.........'],
    goals: [{ type: 'chick', count: 5 }, { type: 'crate' }],
    chicks: { total: 5, maxOnBoard: 3, gap: 3 },
    stars: [7000, 10000],
  },
  {
    colors: 5,
    moves: 32,
    layout: ['.........', '.C.C.C.C.', '.........', '.C.K.K.C.', '....K....', '.C.K.K.C.', '.........', '.C.C.C.C.', '.........'],
    goals: [{ type: 'crate' }],
    stars: [7000, 10500],
  },
  {
    colors: 6,
    moves: 35,
    layout: ['o...o...o', '.........', 'LL.222.LL', '.........', '.C.KKK.C.', '.........', '..2...2..', '.l.....l.', '.........'],
    goals: [{ type: 'chick', count: 4 }, { type: 'ice' }, { type: 'chain' }, { type: 'crate' }],
    chicks: { total: 4, maxOnBoard: 3, gap: 4 },
    stars: [8000, 12000],
  },
];

/** Tuned values from `npm run balance` (moves + star thresholds), keyed by level id. */
const TUNED = balance as unknown as Record<string, { moves?: number; stars?: [number, number] }>;

export const LEVELS: LevelDef[] = [W1, W2, W3, W4].flatMap((w, wi) =>
  w.map((d, i) => {
    const id = wi * 10 + i + 1;
    return { ...d, ...(TUNED[String(id)] ?? {}), id, world: wi };
  }),
);

export function levelById(id: number): LevelDef | undefined {
  return LEVELS[id - 1];
}

export function levelConfig(l: LevelDef): GameConfig {
  return { layout: l.layout, colors: l.colors, moves: l.moves, goals: l.goals, ...(l.chicks ? { chicks: l.chicks } : {}) };
}

/** Stars for a finished level (0 = lost). */
export function starsFor(l: LevelDef, won: boolean, score: number): number {
  if (!won) return 0;
  if (score >= l.stars[1]) return 3;
  if (score >= l.stars[0]) return 2;
  return 1;
}

/** stable 32-bit hash of a string (FNV-1a) */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Daily challenge: a remix of one of the regular levels (not the tutorial ones) with different
 * goal colors and slightly bigger goals. Same for everybody on the same day.
 */
export function dailyLevel(dayKey: string): LevelDef {
  const rng = createRng(hashString(`daily:${dayKey}`));
  const pool = LEVELS.filter((l) => l.id > 5);
  const base = pool[rng.int(pool.length)];
  const used = new Set<number>();
  const goals = base.goals.map((g) => {
    if (g.type !== 'color') return g;
    let c = rng.int(base.colors);
    while (used.has(c)) c = (c + 1) % base.colors;
    used.add(c);
    return { ...g, color: c, count: Math.round((g.count * 1.1) / 5) * 5 };
  });
  return { ...base, goals, moves: base.moves + 2, tip: undefined };
}

/** seed of the daily board (everybody gets the same starting board) */
export function dailySeed(dayKey: string): number {
  return hashString(`board:${dayKey}`);
}
