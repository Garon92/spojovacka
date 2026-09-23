import { createStore } from '../kit';
import { LEVELS } from '../core/levels';
import type { PieceTheme } from '../render/palette';
import { SKINS } from '../render/runner';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface LevelRecord {
  stars: number;
  best: number;
}

export interface Stats {
  games: number;
  wins: number;
  tiles: number;
  specials: number;
  bestCascade: number;
}

const THEMES: PieceTheme[] = ['shapes', 'balls', 'diamonds', 'dinos'];

export const store = createStore('spojovacka', {
  version: 2,
  defaults: {
    levels: {} as Record<string, LevelRecord>,
    coins: 0,
    ownedSkins: ['mouse'] as string[],
    activeSkin: 'mouse',
    pieceTheme: 'shapes' as PieceTheme,
    hints: true,
    fastAnim: false,
    timedBest: { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>,
    relaxBest: 0,
    relaxDiff: 'easy' as Difficulty,
    timedDiff: 'normal' as Difficulty,
    stats: { games: 0, wins: 0, tiles: 0, specials: 0, bestCascade: 0 } as Stats,
    seenTips: [] as string[],
  },
  migrate(from, m) {
    if (from < 2) {
      // original game (2025): { soundEnabled, pieceTheme, activeSkin, ownedSkins }
      const old = m.legacyJSON<{ pieceTheme?: string; activeSkin?: string; ownedSkins?: string[] }>('spojovacka:v1');
      if (old && typeof old === 'object') {
        const owned = Array.isArray(old.ownedSkins) ? old.ownedSkins.filter((s) => SKINS.some((k) => k.id === s)) : [];
        if (!owned.includes('mouse')) owned.unshift('mouse');
        m.set('ownedSkins', owned);
        if (typeof old.activeSkin === 'string' && owned.includes(old.activeSkin)) m.set('activeSkin', old.activeSkin);
        // the old default was "balls" – only keep an explicit choice
        if (old.pieceTheme === 'dinos' || old.pieceTheme === 'diamonds') m.set('pieceTheme', old.pieceTheme);
        m.removeLegacy('spojovacka:v1');
      }
    }
  },
});

// sanitize values that might come from an older / broken save
if (!THEMES.includes(store.get('pieceTheme'))) store.set('pieceTheme', 'shapes');
if (!store.get('ownedSkins').includes(store.get('activeSkin'))) store.set('activeSkin', 'mouse');

export function levelRecord(id: number): LevelRecord {
  return store.get('levels')[String(id)] ?? { stars: 0, best: 0 };
}

export function isUnlocked(id: number): boolean {
  if (id <= 1) return true;
  return levelRecord(id - 1).stars > 0;
}

export function totalStars(): number {
  return Object.values(store.get('levels')).reduce((a, r) => a + (r.stars ?? 0), 0);
}

export const MAX_STARS = LEVELS.length * 3;

/** first level that is unlocked but not yet won (or the last level) */
export function nextLevel(): number {
  for (const l of LEVELS) if (levelRecord(l.id).stars === 0) return l.id;
  return LEVELS[LEVELS.length - 1].id;
}

/** Store a finished level; returns what changed. */
export function submitLevel(id: number, stars: number, score: number): { newStars: number; newBest: boolean; prev: LevelRecord } {
  const prev = levelRecord(id);
  const rec: LevelRecord = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
  store.update('levels', (lv) => ({ ...lv, [String(id)]: rec }));
  return { newStars: Math.max(0, stars - prev.stars), newBest: score > prev.best && prev.best > 0, prev };
}

export function addCoins(n: number): number {
  return store.update('coins', (c) => Math.max(0, c + Math.round(n)));
}

export function recordStats(p: Partial<Stats>) {
  store.update('stats', (s) => ({
    games: s.games + (p.games ?? 0),
    wins: s.wins + (p.wins ?? 0),
    tiles: s.tiles + (p.tiles ?? 0),
    specials: s.specials + (p.specials ?? 0),
    bestCascade: Math.max(s.bestCascade, p.bestCascade ?? 0),
  }));
}

/** coins for a score (all modes) */
export function coinsForScore(score: number): number {
  return Math.floor(score / 300);
}
