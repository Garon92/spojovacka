/**
 * Family-wide vocabulary ("Pravidla rodiny aplikací"): one word + one icon per action, difficulty names,
 * help titles, settings labels, global keys. Use these instead of local wording so kids learn one pattern.
 */
import { UI_ICONS } from './dom';

/** Button labels. Flavour text ("Rybařit!") goes into subtitles, never onto buttons. */
export const LABELS = {
  /** start a game / session */
  play: 'Hrát',
  /** continue after a pause / resume a session */
  resume: 'Pokračovat',
  /** replay (on pause AND on results) */
  again: 'Hrát znovu',
  /** next level */
  next: 'Další úroveň',
  /** in-app home screen (never leaves the app) */
  home: 'Domů',
  /** leaves the app to /menu/ (grid icon) */
  menu: 'Menu',
  /** end the running game/session (goes to the in-app home) */
  quit: 'Ukončit hru',
  /** dismiss a first-run intro */
  intro: 'Jdeme na to!',
  /** close how-to / help */
  gotIt: 'Rozumím',
  /** stay in the game (leave-guard dialog, safe default) */
  stay: 'Zůstat',
  /** leave anyway (leave-guard dialog) */
  leave: 'Odejít',
  cancel: 'Zrušit',
  done: 'Hotovo',
  pause: 'Pauza',
  help: 'Nápověda',
  settings: 'Nastavení',
  moreSettings: 'Další nastavení…',
} as const;

/** The fixed icon for each label (same icon everywhere). */
export const LABEL_ICONS = {
  play: UI_ICONS.play,
  resume: UI_ICONS.play,
  again: UI_ICONS.restart,
  next: UI_ICONS.arrowRight,
  home: UI_ICONS.home,
  menu: UI_ICONS.grid,
  quit: UI_ICONS.close,
  intro: UI_ICONS.arrowRight,
  gotIt: UI_ICONS.check,
  pause: UI_ICONS.pause,
  help: UI_ICONS.help,
  settings: UI_ICONS.settings,
} as const;

export type LabelKey = keyof typeof LABELS;

/** Standard 3-step difficulty. App flavour goes into `hint` (e.g. { ...DIFFICULTIES_3[0], hint: '4 barvy' }). */
export const DIFFICULTIES_3 = [
  { id: 'easy', label: 'Lehká', icon: '🐢' },
  { id: 'normal', label: 'Normální', icon: '🐇' },
  { id: 'hard', label: 'Těžká', icon: '🔥' },
] as const satisfies readonly { id: string; label: string; icon: string }[];

export type Difficulty3 = (typeof DIFFICULTIES_3)[number]['id'];

/** Help dialog titles: games vs learning apps. */
export const HELP_TITLE_GAME = 'Jak hrát';
export const HELP_TITLE_LEARN = 'Jak na to';

/** Settings vocabulary — app settings pages reuse these words. */
export const SETTINGS_LABELS = {
  sound: 'Zvuky',
  volume: 'Hlasitost',
  voice: 'Předčítání',
  theme: 'Vzhled',
  motion: 'Animace',
  name: 'Jméno hráče',
  appName: 'Jméno v této aplikaci',
  more: 'Další nastavení…',
} as const;

/** Global keys (enabled by <g92-appbar keys>). Apps keep other letters for their own actions. */
export const GLOBAL_KEYS = [
  { keys: ['M'], text: 'zvuk zapnout / vypnout' },
  { keys: ['F'], text: 'celá obrazovka' },
  { keys: ['P', 'Esc'], text: 'pauza' },
  { keys: ['?'], text: 'nápověda' },
] as const;
