import type { TipId } from '../core/levels';
import type { Goal, Special, Tile } from '../core/types';
import { h } from '../kit';
import { GEM_COLORS, type PieceTheme } from '../render/palette';
import { obstacleIcon, tileIcon } from '../render/sprites';

type TileSpec = Pick<Tile, 'kind' | 'color' | 'special'>;
export const gem = (color: number, special: Special = 'none'): TileSpec => ({ kind: 'gem', color, special });
export const CHICK: TileSpec = { kind: 'chick', color: -1, special: 'none' };

/** A row of small tile pictures, optionally with "→ result" */
export function tileRow(theme: PieceTheme, tiles: (TileSpec | string)[], size = 34): HTMLElement {
  const row = h('span', { class: 'tile-row', 'aria-hidden': 'true' });
  for (const t of tiles) {
    if (t === 'ice' || t === 'crate' || t === 'chain') row.append(obstacleIcon(t, size));
    else if (typeof t === 'string') row.append(h('span', { class: 'tile-row__op' }, t));
    else row.append(tileIcon(theme, t, size));
  }
  return row;
}

export interface TipDef {
  title: string;
  text: string;
  pic: (theme: PieceTheme) => HTMLElement;
}

export const TIPS: Record<TipId, TipDef> = {
  swap: {
    title: 'Prohoď a spoj',
    text: 'Přetáhni dílek na souseda (nebo klepni na oba). Tři stejné v řadě zmizí.',
    pic: (t) => tileRow(t, [gem(0), gem(0), gem(1), '→', gem(0), gem(0), gem(0)]),
  },
  goals: {
    title: 'Úkoly úrovně',
    text: 'Nahoře vidíš, co máš posbírat. Stihni to dřív, než dojdou tahy!',
    pic: (t) => tileRow(t, [gem(1), gem(2)]),
  },
  rocket: {
    title: 'Raketa',
    text: '4 stejné v řadě vyrobí raketu. Klepni na ni nebo ji prohoď – vyčistí celý řádek nebo sloupec.',
    pic: (t) => tileRow(t, [gem(3), gem(3), gem(3), gem(3), '→', gem(3, 'rocketV')]),
  },
  ice: {
    title: 'Led',
    text: 'Spoj dílky, které stojí na ledu – led praskne. Rozbij všechen led!',
    pic: (t) => tileRow(t, ['ice', '→', gem(1)]),
  },
  bomb: {
    title: 'Bomba',
    text: 'Tvar L nebo T vyrobí bombu. Vybuchne kolem sebe.',
    pic: (t) => tileRow(t, [gem(4), gem(4), gem(4), '+', gem(4), gem(4), '→', gem(4, 'bomb')]),
  },
  holes: {
    title: 'Tvary desky',
    text: 'Deska může mít díry. Dílky jimi propadávají dolů.',
    pic: (t) => tileRow(t, [gem(0), gem(4)]),
  },
  chick: {
    title: 'Kuřátka',
    text: 'Dostaň kuřátka až na spodek desky – spojuj dílky pod nimi.',
    pic: (t) => tileRow(t, [CHICK, '→', '⬇️']),
  },
  butterfly: {
    title: 'Motýl',
    text: 'Čtverec 2×2 vyrobí motýla. Vyčistí okolí a odletí tam, kde je potřeba.',
    pic: (t) => tileRow(t, [gem(2), gem(2), gem(2), gem(2), '→', gem(2, 'butterfly')]),
  },
  crate: {
    title: 'Bedny',
    text: 'Bedny rozbiješ spojením vedle nich nebo výbuchem. Silnější bedny vydrží víc ran.',
    pic: (t) => tileRow(t, ['crate', gem(0), gem(0), gem(0)]),
  },
  rainbow: {
    title: 'Duha',
    text: '5 stejných v řadě vyrobí duhu. Prohoď ji s dílkem a zmizí všechny dílky té barvy!',
    pic: (t) => tileRow(t, [gem(5), gem(5), gem(5), gem(5), gem(5), '→', gem(-1, 'rainbow')]),
  },
  chain: {
    title: 'Řetězy',
    text: 'Dílek v řetězu se nedá posunout. Spoj ho s ostatními a řetěz praskne.',
    pic: (t) => tileRow(t, ['chain', '→', gem(1)]),
  },
  combo: {
    title: 'Komba',
    text: 'Prohoď dva speciály mezi sebou – vznikne mocné kombo!',
    pic: (t) => tileRow(t, [gem(0, 'rocketH'), '+', gem(1, 'bomb'), '=', '💥']),
  },
};

/** Czech label for a goal ("Sesbírej 20 srdíček"). */
export function goalLabel(g: Goal): string {
  switch (g.kind) {
    case 'score':
      return `Získej ${g.target.toLocaleString('cs-CZ')} bodů`;
    case 'color':
      return `Sesbírej ${g.target} ${GEM_COLORS[g.color ?? 0].plural}`;
    case 'ice':
      return `Rozbij led (${g.target}×)`;
    case 'crate':
      return `Rozbij bedny (${g.target}×)`;
    case 'chain':
      return `Přetrhni řetězy (${g.target}×)`;
    case 'chick':
      return `Dostaň dolů ${g.target} ${g.target === 1 ? 'kuřátko' : g.target < 5 ? 'kuřátka' : 'kuřátek'}`;
    case 'special':
      return `Odpal ${g.target}× ${g.special === 'rocket' ? 'raketu' : g.special === 'bomb' ? 'bombu' : 'motýla'}`;
  }
}

export function goalIcon(theme: PieceTheme, g: Goal, size: number): HTMLElement {
  switch (g.kind) {
    case 'score':
      return h('span', { class: 'goal-emoji', style: `font-size:${Math.round(size * 0.8)}px` }, '⭐');
    case 'color':
      return tileIcon(theme, gem(g.color ?? 0), size);
    case 'ice':
      return obstacleIcon('ice', size, 1);
    case 'crate':
      return obstacleIcon('crate', size, 1);
    case 'chain':
      return obstacleIcon('chain', size);
    case 'chick':
      return tileIcon(theme, CHICK, size);
    case 'special':
      return tileIcon(theme, gem(1, g.special === 'rocket' ? 'rocketH' : g.special === 'bomb' ? 'bomb' : 'butterfly'), size);
  }
}

/** Full "how to play" content (dialog + start overlays). */
export function howToContent(theme: PieceTheme): HTMLElement {
  const sec = (title: string, ...rows: HTMLElement[]) => h('section', { class: 'howto__sec' }, h('h3', { class: 'howto__title' }, title), ...rows);
  const row = (pic: HTMLElement, text: string) => h('div', { class: 'howto__row' }, pic, h('p', null, text));
  return h(
    'div',
    { class: 'howto' },
    sec(
      'Základy',
      row(tileRow(theme, [gem(0), gem(0), gem(1), '→', gem(0), gem(0), gem(0)], 30), 'Přetáhni dílek na souseda, nebo klepni na dva sousedy za sebou. Tři a víc stejných v řadě zmizí.'),
      row(tileRow(theme, [gem(2), gem(3), gem(4)], 30), 'Každá barva má svůj tvar – srdíčko, kolečko, hvězdička, trojúhelník, kosočtverec a čtvereček.'),
    ),
    sec(
      'Speciální dílky',
      row(tileRow(theme, [gem(3, 'rocketH'), gem(3, 'rocketV')], 30), '4 v řadě → raketa. Vyčistí celý řádek nebo sloupec.'),
      row(tileRow(theme, [gem(4, 'bomb')], 30), 'Tvar L nebo T → bomba. Vybuchne kolem sebe.'),
      row(tileRow(theme, [gem(2, 'butterfly')], 30), 'Čtverec 2×2 → motýl. Vyčistí okolí a odletí k překážce nebo úkolu.'),
      row(tileRow(theme, [gem(-1, 'rainbow')], 30), '5 v řadě → duha. Prohoď ji s dílkem a zmizí celá ta barva.'),
      row(h('span', { class: 'howto__emoji' }, '👆'), 'Speciál odpálíš klepnutím nebo prohozením. Každé odpálení stojí jeden tah.'),
    ),
    sec(
      'Komba (prohoď dva speciály)',
      row(tileRow(theme, [gem(0, 'rocketH'), '+', gem(1, 'rocketV')], 28), 'Kříž – celý řádek i sloupec.'),
      row(tileRow(theme, [gem(0, 'rocketH'), '+', gem(1, 'bomb')], 28), 'Tři řádky a tři sloupce najednou.'),
      row(tileRow(theme, [gem(4, 'bomb'), '+', gem(1, 'bomb')], 28), 'Obří výbuch.'),
      row(tileRow(theme, [gem(-1, 'rainbow'), '+', gem(0, 'rocketV')], 28), 'Všechny dílky té barvy se promění v rakety (bomby, motýly) a vybuchnou.'),
      row(tileRow(theme, [gem(-1, 'rainbow'), '+', gem(-1, 'rainbow')], 28), 'Vyčistí celou desku!'),
      row(tileRow(theme, [gem(2, 'butterfly'), '+', gem(0, 'bomb')], 28), 'Motýl odnese speciál k cíli.'),
    ),
    sec(
      'Překážky a úkoly',
      row(tileRow(theme, ['ice'], 30), 'Led – spoj dílek, který na něm leží. Tmavý led potřebuje dva zásahy.'),
      row(tileRow(theme, ['crate'], 30), 'Bedna – spoj dílky vedle ní nebo ji odpal. Kované bedny vydrží víc.'),
      row(tileRow(theme, ['chain'], 30), 'Řetěz – dílek nejde posunout; spoj ho a řetěz praskne.'),
      row(tileRow(theme, [CHICK], 30), 'Kuřátko – dostaň ho až dolů na spodek desky.'),
    ),
    sec(
      'Ovládání',
      row(h('span', { class: 'howto__emoji' }, '🖱️'), 'Myš a dotyk: táhni, nebo klikni na dva dílky. Když chvíli nehraješ, hra ti poradí.'),
      row(
        h('span', { class: 'howto__keys', html: '<kbd class="g92-kbd">←</kbd><kbd class="g92-kbd">→</kbd><kbd class="g92-kbd">↑</kbd><kbd class="g92-kbd">↓</kbd>' }),
        'Klávesnice: šipky posouvají kurzor, Enter/mezerník vybere dílek, šipka ho pak prohodí. H = nápověda, P nebo Esc = pauza.',
      ),
    ),
  );
}
