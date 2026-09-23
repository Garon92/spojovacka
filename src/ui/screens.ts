import { LEVELS, WORLDS } from '../core/levels';
import { UI_ICONS, confirmDialog, h, toast, sfx as kitSfx } from '../kit';
import { tileIcon } from '../render/sprites';
import { Runner, SKINS, animalPortrait } from '../render/runner';
import { MAX_STARS, isUnlocked, levelRecord, nextLevel, store, totalStars } from '../app/save';
import { gem } from './content';
import type { Nav } from './nav';

const fmt = (n: number) => n.toLocaleString('cs-CZ');

function starsMini(n: number) {
  return h('span', { class: 'stars-mini', 'aria-label': `${n} ze 3 hvězd`, html: [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">${UI_ICONS.star}</span>`).join('') });
}

function coinPill() {
  return h('span', { class: 'pill pill--coins', title: 'Mince' }, h('span', { 'aria-hidden': 'true' }, '🪙'), h('b', { class: 'g92-tabular' }, fmt(store.get('coins'))));
}

function starPill() {
  return h('span', { class: 'pill pill--stars', title: 'Hvězdy', html: `${UI_ICONS.star}<b class="g92-tabular">${totalStars()}</b><span class="pill__of">/ ${MAX_STARS}</span>` });
}

/* ------------------------------------------------------------------ home */

export class HomeScreen {
  readonly el = h('section', { class: 'screen home', id: 'scr-home', hidden: true });
  constructor(private nav: Nav) {}

  render() {
    const theme = store.get('pieceTheme');
    const next = nextLevel();
    const allDone = LEVELS.every((l) => levelRecord(l.id).stars > 0);
    const logoTiles = h('div', { class: 'home__tiles', 'aria-hidden': 'true' });
    [0, 1, 2, 3, 4, 5].forEach((c, i) => {
      const t = tileIcon(theme, gem(c), 52);
      t.style.setProperty('--i', String(i));
      logoTiles.append(t);
    });
    const play = h(
      'button',
      { type: 'button', class: 'g92-btn g92-btn--xl home__play', 'data-primary': '' },
      h('span', { html: UI_ICONS.play, class: 'home__play-ico' }),
      h('span', { class: 'home__play-txt' }, h('b', null, 'Hrát'), h('small', null, allDone ? 'Všechny úrovně splněny' : `Úroveň ${next}`)),
    );
    play.addEventListener('click', () => {
      kitSfx.pop();
      this.nav.go('#/mapa');
    });
    const timedBest = store.get('timedBest');
    const bestTimed = Math.max(timedBest.easy, timedBest.normal, timedBest.hard);
    const card = (id: string, emoji: string, title: string, text: string, route: string) => {
      const b = h('button', { type: 'button', class: `modecard modecard--${id}` }, h('span', { class: 'modecard__ico', 'aria-hidden': 'true' }, emoji), h('span', { class: 'modecard__txt' }, h('b', null, title), h('span', null, text)));
      b.addEventListener('click', () => {
        kitSfx.tap();
        this.nav.go(route);
      });
      return b;
    };
    this.el.replaceChildren(
      h(
        'div',
        { class: 'home__inner' },
        h('div', { class: 'home__hero' }, logoTiles, h('h1', { class: 'home__title' }, 'Spojovačka'), h('p', { class: 'home__tag' }, 'Prohazuj, spojuj, odpaluj!'), h('div', { class: 'home__pills' }, starPill(), coinPill())),
        play,
        h(
          'div',
          { class: 'home__modes' },
          card('relax', '🧸', 'Pohoda', 'Bez prohry, pro nejmenší', '#/pohoda'),
          card('timed', '⏱️', 'Na čas', bestTimed > 0 ? `90 sekund · rekord ${fmt(bestTimed)}` : '90 sekund na co nejvíc bodů', '#/na-cas'),
          card('pets', SKINS.find((s) => s.id === store.get('activeSkin'))?.emoji ?? '🐭', 'Zvířátka', 'Kolečko a nová zvířátka za mince', '#/zviratka'),
          card('help', '❓', 'Jak hrát', 'Speciály, komba a překážky', '#/jak-hrat'),
        ),
      ),
    );
  }

  focus() {
    this.el.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true });
  }
}

/* ------------------------------------------------------------------ map */

export class MapScreen {
  readonly el = h('section', { class: 'screen map', id: 'scr-map', hidden: true });
  constructor(private nav: Nav) {}

  render() {
    const head = h(
      'header',
      { class: 'screen__head' },
      this.back(),
      h('h2', { class: 'screen__title' }, 'Úrovně'),
      h('span', { class: 'g92-spacer' }),
      starPill(),
      coinPill(),
    );
    const worlds = h('div', { class: 'map__worlds' });
    const current = nextLevel();
    for (const w of WORLDS) {
      const levels = LEVELS.filter((l) => l.world === w.id);
      const got = levels.reduce((a, l) => a + levelRecord(l.id).stars, 0);
      const unlocked = isUnlocked(levels[0].id);
      const path = h('ol', { class: 'map__path' });
      levels.forEach((l, i) => {
        const rec = levelRecord(l.id);
        const open = isUnlocked(l.id);
        const node = h(
          'button',
          {
            type: 'button',
            class: `lvl${open ? '' : ' is-locked'}${rec.stars > 0 ? ' is-done' : ''}${l.id === current ? ' is-current' : ''}`,
            style: `--i:${i}`,
            'aria-label': open ? `Úroveň ${l.id}${rec.stars ? `, ${rec.stars} ${rec.stars === 1 ? 'hvězda' : 'hvězdy'}` : ''}` : `Úroveň ${l.id}, zamčeno`,
            disabled: !open,
          },
          h('span', { class: 'lvl__num' }, open ? String(l.id) : '🔒'),
          open ? starsMini(rec.stars) : null,
          l.tip && open && rec.stars === 0 ? h('span', { class: 'lvl__new', 'aria-hidden': 'true' }, 'nové') : null,
        );
        node.addEventListener('click', () => {
          kitSfx.tap();
          this.nav.go(`#/uroven/${l.id}`);
        });
        path.append(h('li', { class: 'map__node' }, node));
      });
      worlds.append(
        h(
          'section',
          { class: `world world--${w.theme}${unlocked ? '' : ' is-locked'}`, 'aria-label': w.name },
          h('header', { class: 'world__head' }, h('span', { class: 'world__emoji', 'aria-hidden': 'true' }, w.emoji), h('h3', null, w.name), h('span', { class: 'world__stars', html: `${UI_ICONS.star} ${got} / 30` })),
          path,
        ),
      );
    }
    this.el.replaceChildren(h('div', { class: 'screen__inner' }, head, worlds));
  }

  private back() {
    const b = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--icon', 'aria-label': 'Zpět', html: UI_ICONS.back });
    b.addEventListener('click', () => this.nav.go('#/'));
    return b;
  }

  focus() {
    const cur = this.el.querySelector<HTMLElement>('.lvl.is-current') ?? this.el.querySelector<HTMLElement>('.lvl:not(.is-locked)');
    cur?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    cur?.focus({ preventScroll: true });
  }
}

/* ------------------------------------------------------------------ pets */

export class PetsScreen {
  readonly el = h('section', { class: 'screen pets', id: 'scr-pets', hidden: true });
  private runner: Runner | null = null;
  constructor(private nav: Nav) {}

  render() {
    this.runner?.stop();
    const canvas = h('canvas', { class: 'pets__wheel', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.runner = new Runner(canvas);
    this.runner.skin = store.get('activeSkin');
    this.runner.speed = 0.45;
    const back = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--icon', 'aria-label': 'Zpět', html: UI_ICONS.back });
    back.addEventListener('click', () => this.nav.go('#/'));
    const grid = h('div', { class: 'pets__grid' });
    const owned = store.get('ownedSkins');
    const active = store.get('activeSkin');
    const coins = store.get('coins');
    for (const s of SKINS) {
      const has = owned.includes(s.id);
      const isActive = s.id === active;
      const btn = h(
        'button',
        { type: 'button', class: `g92-btn ${isActive ? 'g92-btn--success' : has ? 'g92-btn--secondary' : coins >= s.cost ? '' : 'g92-btn--ghost'} g92-btn--block`, disabled: isActive },
        isActive ? 'Běhá v kolečku' : has ? 'Vybrat' : `Koupit · 🪙 ${s.cost}`,
      );
      btn.addEventListener('click', () => void this.choose(s.id));
      grid.append(
        h(
          'article',
          { class: `pet${isActive ? ' is-active' : ''}${has ? ' is-owned' : ''}` },
          h('div', { class: 'pet__pic' }, animalPortrait(s.id, 84)),
          h('h3', { class: 'pet__name' }, `${s.emoji} ${s.name}`),
          btn,
        ),
      );
    }
    this.el.replaceChildren(
      h(
        'div',
        { class: 'screen__inner' },
        h('header', { class: 'screen__head' }, back, h('h2', { class: 'screen__title' }, 'Zvířátka'), h('span', { class: 'g92-spacer' }), coinPill()),
        h(
          'div',
          { class: 'pets__hero' },
          canvas,
          h('div', { class: 'pets__text' }, h('p', null, 'Vyber si, kdo ti bude během hry běhat v kolečku. Čím víc bodů nasbíráš, tím rychleji běží.'), h('p', { class: 'g92-muted' }, 'Mince 🪙 dostáváš za každou hru – za body i za nové hvězdy.')),
        ),
        grid,
      ),
    );
  }

  private async choose(id: string) {
    const skin = SKINS.find((s) => s.id === id)!;
    const owned = store.get('ownedSkins');
    if (!owned.includes(id)) {
      const coins = store.get('coins');
      if (coins < skin.cost) {
        kitSfx.error();
        toast(`Na ${skin.name.toLowerCase()} potřebuješ 🪙 ${skin.cost}. Máš ${coins}.`, { variant: 'danger' });
        return;
      }
      const ok = await confirmDialog({ title: `Koupit – ${skin.name}?`, message: `Stojí 🪙 ${skin.cost}. Zbyde ti 🪙 ${coins - skin.cost}.`, confirmLabel: 'Koupit' });
      if (!ok) return;
      store.set('coins', coins - skin.cost);
      store.set('ownedSkins', [...owned, id]);
      kitSfx.coin();
      toast(`${skin.emoji} ${skin.name} je tvoje!`, { variant: 'success' });
    } else kitSfx.tap();
    store.set('activeSkin', id);
    this.render();
    this.runner?.start();
  }

  enter() {
    this.runner?.start();
  }
  leave() {
    this.runner?.stop();
  }
  focus() {
    this.el.querySelector<HTMLElement>('.screen__head button')?.focus({ preventScroll: true });
  }
}

