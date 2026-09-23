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

/** Female first names ending in a consonant — no vocative change (Ester, Rút, Miriam…). */
const FEMININE_CONSONANT = new Set(
  'ester rút ruth miriam dagmar ingrid karin nicol nikol ivet yvet margit carmen rachel ráchel vivien lilian jasmin jasmín agnes edit judit elisabet elizabet šarlot'.split(
    ' ',
  ),
);

/** Irregular vocatives of common names. */
const IRREGULAR: Record<string, string> = {
  otec: 'Otče',
  marcel: 'Marceli',
  axel: 'Axeli',
  gabriel: 'Gabrieli',
  kamarád: 'Kamaráde',
  mikuláš: 'Mikuláši',
  bůh: 'Bože',
};

/**
 * Best-effort Czech vocative of a first name for greetings:
 * Adámek→Adámku, Adam→Adame, Petr→Petře, Pavel→Pavle, Tomáš→Tomáši, Dominik→Dominiku, Ema→Emo, Marie→Marie,
 * Zdeněk→Zdeňku, Ester→Ester.
 * Multi-word input and names already in vocative form are returned unchanged.
 */
export function vocative(name: string): string {
  const n = name.trim();
  if (!n || /\s/.test(n) || n.length < 2) return n;
  const low = n.toLowerCase();
  const upper = n === n.toUpperCase() && n.length > 1;
  const stem = (k: number) => n.slice(0, n.length - k);
  const out = (() => {
    const irr = IRREGULAR[low];
    if (irr) return irr;
    if (FEMININE_CONSONANT.has(low)) return n;
    if (keepAsIs.test(low)) return n;
    // mobile ě before k after d/t/n: Luděk → Luďku, Zdeněk → Zdeňku
    const soft = /([dtn])ěk$/i.exec(n);
    if (soft) {
      const map: Record<string, string> = { d: 'ď', t: 'ť', n: 'ň', D: 'Ď', T: 'Ť', N: 'Ň' };
      return n.slice(0, n.length - 3) + (map[soft[1] as string] ?? soft[1]) + 'ku';
    }
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
  return 'evening';
}

/** Greetings (hello, never goodbye — "Dobrou noc" is a bedtime farewell in Czech). */
const GREETINGS: Record<DayPart, string> = {
  night: 'Ahoj',
  morning: 'Dobré ráno',
  forenoon: 'Dobré dopoledne',
  afternoon: 'Dobré odpoledne',
  evening: 'Dobrý večer',
};

/** "Dobré odpoledne, Adámku!" / "Dobré ráno!" / after midnight "Ahoj!" */
export function greeting(name = '', d: Date = new Date()): string {
  const g = GREETINGS[dayPart(d)];
  const v = vocative(name);
  return v ? `${g}, ${v}!` : `${g}!`;
}
