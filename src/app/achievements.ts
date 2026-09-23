import { LEVELS } from '../core/levels';
import { dailyState, getStats, levelRecord, store } from './save';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  /** [current, goal] */
  progress: () => [number, number];
}

const levelsWith = (pred: (stars: number) => boolean, from = 1, to = LEVELS.length) =>
  LEVELS.filter((l) => l.id >= from && l.id <= to && pred(levelRecord(l.id).stars)).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', emoji: '🎉', name: 'První výhra', desc: 'Splň svou první úroveň.', progress: () => [Math.min(1, getStats().wins), 1] },
  { id: 'rockets', emoji: '🚀', name: 'Raketová základna', desc: 'Odpal 25 raket.', progress: () => [getStats().rockets, 25] },
  { id: 'bombs', emoji: '💣', name: 'Ohňostroj', desc: 'Odpal 15 bomb.', progress: () => [getStats().bombs, 15] },
  { id: 'butterflies', emoji: '🦋', name: 'Motýlí louka', desc: 'Vypusť 20 motýlů.', progress: () => [getStats().butterflies, 20] },
  { id: 'rainbow', emoji: '🌈', name: 'Duhový kouzelník', desc: 'Slož 5 v řadě a vyrob duhu.', progress: () => [Math.min(1, getStats().rainbowsMade), 1] },
  { id: 'combo', emoji: '✨', name: 'Kombo!', desc: 'Prohoď dva speciály mezi sebou.', progress: () => [Math.min(1, getStats().combos), 1] },
  { id: 'mega', emoji: '🌟', name: 'Celá deska!', desc: 'Prohoď dvě duhy.', progress: () => [Math.min(1, getStats().megaCombos), 1] },
  { id: 'cascade5', emoji: '⛓️', name: 'Řetězová reakce', desc: 'Udělej řetěz ×5.', progress: () => [Math.min(5, getStats().bestCascade), 5] },
  { id: 'cascade8', emoji: '🌀', name: 'Nekonečný řetěz', desc: 'Udělej řetěz ×8.', progress: () => [Math.min(8, getStats().bestCascade), 8] },
  { id: 'chicks', emoji: '🐥', name: 'Kvočna', desc: 'Zachraň 25 kuřátek.', progress: () => [getStats().chicks, 25] },
  { id: 'world1', emoji: '🌼', name: 'Louka je tvoje', desc: 'Splň všechny úrovně Rozkvetlé louky.', progress: () => [levelsWith((s) => s > 0, 1, 10), 10] },
  { id: 'world2', emoji: '🌲', name: 'Lesní průvodce', desc: 'Splň všechny úrovně Tajemného lesa.', progress: () => [levelsWith((s) => s > 0, 11, 20), 10] },
  { id: 'world3', emoji: '❄️', name: 'Ledový krasobruslař', desc: 'Splň všechny úrovně Zamrzlého jezera.', progress: () => [levelsWith((s) => s > 0, 21, 30), 10] },
  { id: 'world4', emoji: '🌙', name: 'Hvězdář', desc: 'Splň všechny úrovně Hvězdné noci.', progress: () => [levelsWith((s) => s > 0, 31, 40), 10] },
  { id: 'stars3', emoji: '⭐', name: 'Tři hvězdičky', desc: 'Získej 3 hvězdy v 10 úrovních.', progress: () => [levelsWith((s) => s >= 3), 10] },
  { id: 'perfect', emoji: '👑', name: 'Mistr Spojovačky', desc: 'Všech 40 úrovní za 3 hvězdy.', progress: () => [levelsWith((s) => s >= 3), LEVELS.length] },
  { id: 'timed', emoji: '⏱️', name: 'Rychlé ruce', desc: 'Na čas (normální) nasbírej 10 000 bodů.', progress: () => [Math.min(10000, store.get('timedBest').normal), 10000] },
  { id: 'relax', emoji: '🧸', name: 'Pohodář', desc: 'V Pohodě nasbírej 20 000 bodů v jedné hře.', progress: () => [Math.min(20000, store.get('relaxBest')), 20000] },
  { id: 'pets', emoji: '🐹', name: 'Chovatel', desc: 'Měj aspoň 4 zvířátka.', progress: () => [Math.min(4, store.get('ownedSkins').length), 4] },
  { id: 'daily1', emoji: '📅', name: 'Denní hráč', desc: 'Splň denní výzvu.', progress: () => [Math.min(1, dailyState().best), 1] },
  { id: 'daily7', emoji: '🔥', name: 'Týdenní série', desc: 'Splň denní výzvu 7 dní po sobě.', progress: () => [Math.min(7, dailyState().best), 7] },
  { id: 'tiles', emoji: '💎', name: 'Sběratel', desc: 'Spoj celkem 5 000 dílků.', progress: () => [Math.min(5000, getStats().tiles), 5000] },
];

export function isUnlocked(a: Achievement): boolean {
  const [cur, goal] = a.progress();
  return cur >= goal;
}

/** Check all achievements, store the new ones and return them (for a toast). */
export function checkAchievements(): Achievement[] {
  const have = new Set(store.get('achievements'));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && isUnlocked(a));
  if (fresh.length) store.set('achievements', [...have, ...fresh.map((a) => a.id)]);
  return fresh;
}

export function unlockedCount(): number {
  const have = new Set(store.get('achievements'));
  return ACHIEVEMENTS.filter((a) => have.has(a.id)).length;
}
