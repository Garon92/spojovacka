/** Tile colors — every color also has its own shape (color-blind friendly). */
export type ShapeKind = 'heart' | 'circle' | 'star' | 'triangle' | 'diamond' | 'square';

export interface GemColor {
  id: number;
  /** Czech name of the piece for labels ("srdíčko") */
  name: string;
  /** plural for goals (genitive: "15 srdíček") */
  plural: string;
  base: string;
  light: string;
  dark: string;
  shape: ShapeKind;
  animal: string;
}

export const GEM_COLORS: GemColor[] = [
  { id: 0, name: 'srdíčko', plural: 'srdíček', base: '#f43f5e', light: '#fda4af', dark: '#be123c', shape: 'heart', animal: '🦀' },
  { id: 1, name: 'kulička', plural: 'kuliček', base: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8', shape: 'circle', animal: '🐳' },
  { id: 2, name: 'hvězdička', plural: 'hvězdiček', base: '#facc15', light: '#fef08a', dark: '#ca8a04', shape: 'star', animal: '🐝' },
  { id: 3, name: 'trojúhelník', plural: 'trojúhelníků', base: '#22c55e', light: '#86efac', dark: '#15803d', shape: 'triangle', animal: '🦖' },
  { id: 4, name: 'kosočtverec', plural: 'kosočtverců', base: '#a855f7', light: '#d8b4fe', dark: '#7e22ce', shape: 'diamond', animal: '🐙' },
  { id: 5, name: 'čtvereček', plural: 'čtverečků', base: '#f97316', light: '#fdba74', dark: '#c2410c', shape: 'square', animal: '🦊' },
];

export type PieceTheme = 'shapes' | 'balls' | 'diamonds' | 'dinos';

export const PIECE_THEMES: { id: PieceTheme; name: string; emoji: string }[] = [
  { id: 'shapes', name: 'Tvary', emoji: '🔷' },
  { id: 'balls', name: 'Kuličky', emoji: '🔵' },
  { id: 'diamonds', name: 'Diamanty', emoji: '💎' },
  { id: 'dinos', name: 'Zvířátka', emoji: '🦖' },
];

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
