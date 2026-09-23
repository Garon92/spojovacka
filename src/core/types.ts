/** Pure game model types — no DOM here. */

export const MAX_COLORS = 6;

/**
 * Special pieces:
 * - rocketH / rocketV: clears the whole row / column (made from 4 in a row)
 * - bomb: explodes in a circle of diameter 5 (made from an L / T shape)
 * - rainbow: clears every piece of one color (made from 5 in a row)
 * - butterfly: clears a "+" around itself and flies to a goal cell (made from a 2×2 square)
 */
export type Special = 'none' | 'rocketH' | 'rocketV' | 'bomb' | 'rainbow' | 'butterfly';
export type SpecialFamily = 'rocket' | 'bomb' | 'rainbow' | 'butterfly';

export type TileKind = 'gem' | 'chick';

export interface Tile {
  id: number;
  kind: TileKind;
  /** 0..MAX_COLORS-1, -1 for colorless (rainbow, chick) */
  color: number;
  special: Special;
}

export interface Cell {
  /** false = hole in the board */
  playable: boolean;
  tile: Tile | null;
  /** ice layers under the tile (0..2) */
  ice: number;
  /** crate hit points (0..3); a cell with a crate holds no tile */
  crate: number;
  /** chain on the tile (0..1): the tile can't move, a hit breaks the chain instead of the tile */
  chain: number;
}

export interface Pos {
  x: number;
  y: number;
}

export interface Board {
  w: number;
  h: number;
  /** row-major, index = y * w + x */
  cells: Cell[];
}

export type GoalKind = 'score' | 'color' | 'ice' | 'crate' | 'chain' | 'chick' | 'special';

export type GoalDef =
  | { type: 'score'; target: number }
  | { type: 'color'; color: number; count: number }
  | { type: 'ice' }
  | { type: 'crate' }
  | { type: 'chain' }
  | { type: 'chick'; count: number }
  | { type: 'special'; special: Exclude<SpecialFamily, 'rainbow'>; count: number };

export interface Goal {
  kind: GoalKind;
  color?: number;
  special?: SpecialFamily;
  target: number;
  done: number;
}

export interface ChickConfig {
  /** how many chicks must be brought down (incl. those placed by the layout) */
  total: number;
  /** max chicks on the board at once */
  maxOnBoard: number;
  /** min moves between two spawned chicks */
  gap: number;
}

export interface GameConfig {
  layout: string[];
  colors: number;
  /** null = unlimited (relax / timed modes) */
  moves: number | null;
  goals: GoalDef[];
  chicks?: ChickConfig;
}

export interface GameStats {
  cleared: number;
  specialsMade: number;
  specialsUsed: number;
  maxCascade: number;
  combos: number;
}

export interface ChickState extends ChickConfig {
  spawned: number;
  collected: number;
  lastSpawnMove: number;
}

export type Move = { type: 'swap'; a: Pos; b: Pos } | { type: 'tap'; a: Pos };

/* ---------- Steps: what happened, in order, so the renderer can replay it ---------- */

export interface SwapStep {
  type: 'swap';
  a: Pos;
  b: Pos;
  /** ids of the tiles that were at a and b before the swap */
  ida: number;
  idb: number;
  /** true = no match, the tiles swap back */
  invalid: boolean;
}

export interface ClearedTile {
  id: number;
  x: number;
  y: number;
  /** abstract time (1 unit ≈ 90 ms) */
  t: number;
  color: number;
  special: Special;
  /** position the tile merges into (special creation), if any */
  mergeTo?: Pos;
}

export type ActivationFx =
  | { kind: 'rocket'; dir: 'h' | 'v'; x: number; y: number; t: number; color: number }
  | { kind: 'bomb'; x: number; y: number; t: number; radius: number; color: number }
  | { kind: 'rainbow'; x: number; y: number; t: number; color: number; targets: Pos[] }
  | { kind: 'butterfly'; x: number; y: number; t: number; to: Pos; arrive: number; color: number; carry: Special }
  | { kind: 'rainbowAll'; x: number; y: number; t: number };

export interface BlockerHit {
  x: number;
  y: number;
  t: number;
  type: 'ice' | 'crate' | 'chain';
  /** layers / hit points left after the hit */
  left: number;
}

export interface CreatedSpecial {
  tile: Tile;
  x: number;
  y: number;
  t: number;
  /** id of the tile that was transformed */
  replacedId: number;
}

export interface TransformedTile {
  id: number;
  x: number;
  y: number;
  t: number;
  special: Special;
}

export interface ScorePopup {
  x: number;
  y: number;
  t: number;
  value: number;
}

export interface ClearStep {
  type: 'clear';
  cascade: number;
  cleared: ClearedTile[];
  activations: ActivationFx[];
  blockers: BlockerHit[];
  created: CreatedSpecial[];
  transformed: TransformedTile[];
  popups: ScorePopup[];
  score: number;
  /** total abstract duration of the step */
  duration: number;
  /** sizes of the matched groups (for sound / callouts) */
  groups: number[];
}

export interface FallSegment {
  id: number;
  /** tick at which the segment starts */
  start: number;
  from: Pos;
  /** position after each successive tick */
  path: Pos[];
}

export interface FallStep {
  type: 'fall';
  moves: FallSegment[];
  /** new tiles entering from the top (their segment starts above the board) */
  spawns: { tile: Tile; seg: FallSegment }[];
  ticks: number;
}

export interface CollectStep {
  type: 'collect';
  chicks: { id: number; x: number; y: number }[];
  score: number;
}

export interface ShuffleStep {
  type: 'shuffle';
  tiles: { tile: Tile; from: Pos; to: Pos }[];
}

export interface BonusStep {
  type: 'bonus';
  /** tiles converted into specials by leftover moves */
  converted: { id: number; x: number; y: number; special: Special; order: number }[];
  movesUsed: number;
}

export type Step = SwapStep | ClearStep | FallStep | CollectStep | ShuffleStep | BonusStep;

export interface MoveResult {
  valid: boolean;
  steps: Step[];
  /** score gained by this move (incl. cascades) */
  gained: number;
  /** highest cascade reached */
  cascades: number;
}
