/** Czech language helpers: plural forms, vocative (5. pád) for friendly greetings, time-of-day greeting. */

/** plural(5, 'bod', 'body', 'bodů') → 'bodů' */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  if (a >= 2 && a <= 4 && Number.isInteger(a)) return few;
  return many;
}

/** "5 bodů", "1 bod", "1 200 bodů" */
export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n.toLocaleString('cs-CZ')} ${plural(n, one, few, many)}`;
}

const keepAsIs = /[eiyíýouůú]$/i;

/**
 * Best-effort Czech vocative of a first name for greetings:
 * Adámek→Adámku, Adam→Adame, Petr→Petře, Pavel→Pavle, Tomáš→Tomáši, Dominik→Dominiku, Ema→Emo, Marie→Marie.
 * Multi-word input and names already in vocative form are returned unchanged.
 */
export function vocative(name: string): string {
  const n = name.trim();
  if (!n || /\s/.test(n) || n.length < 2) return n;
  const low = n.toLowerCase();
  const stem = (k: number) => n.slice(0, n.length - k);
  const upper = n === n.toUpperCase();
  const out = (() => {
    if (keepAsIs.test(low)) return n;
    if (low.endsWith('ek')) return stem(2) + 'ku';
    if (low.endsWith('ec')) return stem(2) + 'če';
    if (/[aeiouyáéíóúůý]el$/.test(low)) return n + 'i'; // Daniel → Danieli
    if (low.endsWith('el')) return stem(2) + 'le'; // Pavel → Pavle
    if (/[bcdfghjklmnpqrstvwxzčďňřšťž]r$/.test(low)) return stem(1) + 'ře'; // Petr → Petře
    if (low.endsWith('a')) return stem(1) + 'o';
    if (/(k|h|g|ch)$/.test(low)) return n + 'u';
    if (/[šžčřcjťďňsxz]$/.test(low)) return n + 'i';
    if (/[bdflmnprtvw]$/.test(low)) return n + 'e';
    return n;
  })();
  return upper ? out.toUpperCase() : out;
}

export type DayPart = 'night' | 'morning' | 'forenoon' | 'afternoon' | 'evening';

export function dayPart(d: Date = new Date()): DayPart {
  const h = d.getHours();
  if (h < 5) return 'night';
  if (h < 9) return 'morning';
  if (h < 12) return 'forenoon';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

const GREETINGS: Record<DayPart, string> = {
  night: 'Dobrou noc',
  morning: 'Dobré ráno',
  forenoon: 'Dobré dopoledne',
  afternoon: 'Dobré odpoledne',
  evening: 'Dobrý večer',
};

/** "Dobré odpoledne, Adámku!" / "Dobré ráno!" */
export function greeting(name = '', d: Date = new Date()): string {
  const g = GREETINGS[dayPart(d)];
  const v = vocative(name);
  return v ? `${g}, ${v}!` : `${g}!`;
}
