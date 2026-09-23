import './kit/kit.css';
import './style.css';
import { UI_ICONS, confirmDialog, h, openSettingsDialog, toast } from './kit';
import { sfx as gameSfx } from './audio/sfx';
import { LEVELS } from './core/levels';
import { isUnlocked, store } from './app/save';
import { PIECE_THEMES, type PieceTheme } from './render/palette';
import { tileIcon } from './render/sprites';
import { gem } from './ui/content';
import { GameScreen } from './ui/gameScreen';
import type { Nav } from './ui/nav';
import { HomeScreen, MapScreen, PetsScreen } from './ui/screens';

type ScreenName = 'home' | 'map' | 'pets' | 'game';

const app = document.getElementById('app')!;
const nav: Nav = {
  go(hash, force = false) {
    if (location.hash === hash) {
      if (force) route();
    } else location.hash = hash;
  },
};

const home = new HomeScreen(nav);
const map = new MapScreen(nav);
const pets = new PetsScreen(nav);
const game = new GameScreen(nav);
app.append(home.el, map.el, pets.el, game.el);

let current: ScreenName | null = null;
let lastNonHelp = '#/';

function show(name: ScreenName) {
  if (current === 'game') game.leave();
  if (current === 'pets') pets.leave();
  current = name;
  home.el.hidden = name !== 'home';
  map.el.hidden = name !== 'map';
  pets.el.hidden = name !== 'pets';
  document.body.dataset.screen = name;
  if (name === 'home') {
    home.render();
    home.focus();
  } else if (name === 'map') {
    map.render();
    map.focus();
  } else if (name === 'pets') {
    pets.render();
    pets.enter();
    pets.focus();
  } else {
    game.enter();
  }
  window.scrollTo({ top: 0 });
}

function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (a === 'jak-hrat') {
    void GameScreen.howTo().then(() => nav.go(lastNonHelp));
    return;
  }
  lastNonHelp = hash;
  switch (a) {
    case undefined:
      return show('home');
    case 'mapa':
      return show('map');
    case 'zviratka':
      return show('pets');
    case 'pohoda':
      show('game');
      return void game.startRelax();
    case 'na-cas':
      show('game');
      return void game.startTimed();
    case 'uroven': {
      const id = Number(b);
      if (!LEVELS.some((l) => l.id === id) || !isUnlocked(id)) return nav.go('#/mapa');
      show('game');
      return void game.startLevel(id);
    }
    default:
      return nav.go('#/');
  }
}

/* ---------------- appbar: help + app specific settings ---------------- */

const appbar = document.querySelector('g92-appbar')!;
appbar.addEventListener('g92-help', () => {
  if (current === 'game') void game.pause();
  void GameScreen.howTo();
});
appbar.addEventListener('g92-settings', (e) => {
  e.preventDefault();
  openSettingsDialog({ extra: settingsExtra() });
});

function settingsExtra(): HTMLElement {
  const wrap = h('div', { class: 'g92-stack settings-extra', style: '--g92-gap: var(--g92-space-4)' });
  wrap.append(h('h3', { class: 'settings-extra__title' }, 'Spojovačka'));
  // piece theme
  const group = h('div', { class: 'theme-pick', role: 'radiogroup', 'aria-label': 'Vzhled dílků' });
  const name = `theme-${Math.random().toString(36).slice(2, 6)}`;
  for (const t of PIECE_THEMES) {
    const input = h('input', { type: 'radio', name, value: t.id }) as HTMLInputElement;
    input.checked = store.get('pieceTheme') === t.id;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      store.set('pieceTheme', t.id as PieceTheme);
      game.setPieceTheme();
      if (current === 'home') home.render();
      gameSfx.play('select');
    });
    const pics = h('span', { class: 'theme-pick__pics', 'aria-hidden': 'true' }, tileIcon(t.id, gem(0), 26), tileIcon(t.id, gem(2), 26), tileIcon(t.id, gem(3), 26));
    group.append(h('label', { class: 'theme-pick__opt' }, input, h('span', { class: 'theme-pick__card' }, pics, h('span', null, t.name))));
  }
  wrap.append(h('div', { class: 'g92-field' }, h('span', { class: 'g92-label' }, 'Vzhled dílků'), group));
  const toggle = (label: string, key: 'hints' | 'fastAnim', after?: () => void) => {
    const id = `t-${key}`;
    const input = h('input', { type: 'checkbox', class: 'g92-toggle', role: 'switch', id }) as HTMLInputElement;
    input.checked = store.get(key);
    input.addEventListener('change', () => {
      store.set(key, input.checked);
      after?.();
    });
    return h('label', { class: 'g92-switch-row', for: id }, h('span', { class: 'g92-label' }, label), input);
  };
  wrap.append(toggle('Poradit tah, když chvíli nehraješ', 'hints'));
  wrap.append(toggle('Rychlejší animace', 'fastAnim', () => game.setAnimSpeed()));
  const reset = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--sm settings-extra__reset', html: UI_ICONS.restart }, 'Smazat postup ve Spojovačce');
  reset.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Smazat postup?',
      message: 'Zmizí hvězdy ve všech úrovních, rekordy, mince i koupená zvířátka. Nejde to vrátit.',
      confirmLabel: 'Smazat',
      danger: true,
    });
    if (!ok) return;
    store.reset();
    toast('Postup smazán. Začínáš znovu od úrovně 1.', { variant: 'accent' });
    game.setPieceTheme();
    route();
  });
  wrap.append(reset);
  return wrap;
}

/* ---------------- audio unlock ---------------- */

const unlock = () => gameSfx.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

window.addEventListener('hashchange', route);
route();
