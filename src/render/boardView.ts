import type { GameState } from '../core/state';
import type {
  BonusStep,
  ClearStep,
  CollectStep,
  FallStep,
  Pos,
  ShuffleStep,
  Special,
  Step,
  SwapStep,
  Tile,
} from '../core/types';
import type { SfxName, SfxOptions } from '../audio/sfx';
import { Animator, clamp, ease, lerp } from './anim';
import { GEM_COLORS, type PieceTheme } from './palette';
import { Particles } from './particles';
import { SpriteCache } from './sprites';

/** ms per abstract time unit of the core */
const UNIT = 88;

export type ViewEvent =
  | { type: 'cleared'; color: number; special: Special; kind: Tile['kind'] }
  | { type: 'created'; replacedColor: number }
  | { type: 'blocker'; kind: 'ice' | 'crate' | 'chain'; left: number }
  | { type: 'chick'; n: number }
  | { type: 'score'; value: number }
  | { type: 'cascade'; n: number }
  | { type: 'shuffle' }
  | { type: 'bonus' };

export interface ViewCallbacks {
  sfx(name: SfxName, opts?: SfxOptions): void;
  event(e: ViewEvent): void;
}

interface TileVis {
  tile: { id: number; kind: Tile['kind']; color: number; special: Special };
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rot: number;
  sx: number;
  sy: number;
  flash: number;
  z: number;
}

interface CellVis {
  playable: boolean;
  ice: number;
  crate: number;
  chain: number;
}

type Fx = { until: number; draw(ctx: CanvasRenderingContext2D, now: number): void };

const colorOf = (c: number) => (c >= 0 ? GEM_COLORS[c]?.base ?? '#ffffff' : '#ffffff');

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 8;
  private h = 8;
  private tiles = new Map<number, TileVis>();
  private cells: CellVis[] = [];
  private anim = new Animator();
  private particles = new Particles();
  private fx: Fx[] = [];
  private sprites: SpriteCache | null = null;
  private bg: HTMLCanvasElement | null = null;
  private clip: Path2D | null = null;
  private theme: PieceTheme;
  private dpr = 1;
  /** cell size in device px */
  private cell = 40;
  /** board origin in device px */
  private ox = 0;
  private oy = 0;
  private raf = 0;
  private running = false;
  private lastT = 0;
  private shakeAmp = 0;
  private reduced = false;
  /** animation speed multiplier (lower = faster) */
  speed = 1;

  // interaction visuals
  selected: Pos | null = null;
  cursor: Pos | null = null;
  hint: { a: Pos; b: Pos } | null = null;
  private hintStart = 0;
  drag: { pos: Pos; dx: number; dy: number } | null = null;
  /** dims the board (e.g. no moves while paused) */
  dim = 0;

  constructor(
    canvas: HTMLCanvasElement,
    theme: PieceTheme,
    private cb: ViewCallbacks,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.theme = theme;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------- setup ---------------- */

  setTheme(theme: PieceTheme) {
    this.theme = theme;
    this.sprites = null;
  }

  /** Rebuild all visuals from the game state (no animation). */
  load(s: GameState) {
    this.anim.flush();
    this.fx = [];
    this.particles.clear();
    this.w = s.board.w;
    this.h = s.board.h;
    this.tiles.clear();
    this.cells = s.board.cells.map((c) => ({ playable: c.playable, ice: c.ice, crate: c.crate, chain: c.chain }));
    s.board.cells.forEach((c, i) => {
      if (c.tile) this.addTile(c.tile, i % this.w, Math.floor(i / this.w));
    });
    this.selected = null;
    this.hint = null;
    this.drag = null;
    this.resize(true);
  }

  /** Safety net after a move: make visuals match the state exactly. */
  sync(s: GameState) {
    const seen = new Set<number>();
    s.board.cells.forEach((c, i) => {
      const cv = this.cells[i];
      cv.ice = c.ice;
      cv.crate = c.crate;
      cv.chain = c.chain;
      if (!c.tile) return;
      const x = i % this.w;
      const y = Math.floor(i / this.w);
      seen.add(c.tile.id);
      const v = this.tiles.get(c.tile.id);
      if (!v) this.addTile(c.tile, x, y);
      else {
        v.tile = { ...c.tile };
        v.x = x;
        v.y = y;
        v.alpha = 1;
        v.scale = 1;
        v.rot = 0;
        v.sx = 1;
        v.sy = 1;
      }
    });
    for (const id of [...this.tiles.keys()]) if (!seen.has(id)) this.tiles.delete(id);
  }

  private addTile(t: Tile, x: number, y: number): TileVis {
    const v: TileVis = { tile: { id: t.id, kind: t.kind, color: t.color, special: t.special }, x, y, scale: 1, alpha: 1, rot: 0, sx: 1, sy: 1, flash: 0, z: 0 };
    this.tiles.set(t.id, v);
    return v;
  }

  resize(force = false) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    if (!force && W === this.canvas.width && H === this.canvas.height && this.dpr === dpr) return;
    this.canvas.width = W;
    this.canvas.height = H;
    this.dpr = dpr;
    const margin = 0.22;
    this.cell = Math.max(8, Math.floor(Math.min(W / (this.w + margin * 2), H / (this.h + margin * 2))));
    this.ox = Math.round((W - this.cell * this.w) / 2);
    this.oy = Math.round((H - this.cell * this.h) / 2);
    this.sprites = null;
    this.bg = null;
    this.draw(performance.now());
  }

  /** re-read theme colors (light/dark switch) */
  refreshColors() {
    this.bg = null;
  }

  /** Board-space cell under a client point (null outside the board). */
  cellAt(clientX: number, clientY: number): Pos | null {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * (this.canvas.width / r.width);
    const py = (clientY - r.top) * (this.canvas.height / r.height);
    const x = Math.floor((px - this.ox) / this.cell);
    const y = Math.floor((py - this.oy) / this.cell);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return { x, y };
  }

  /** CSS pixel size of one cell (for drag thresholds). */
  cellCss(): number {
    const r = this.canvas.getBoundingClientRect();
    return (this.cell / this.canvas.width) * r.width;
  }

  /** Client coordinates of a cell center (tests / debug hook). */
  cellCenterClient(p: Pos): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const k = r.width / this.canvas.width;
    return { x: r.left + (this.ox + (p.x + 0.5) * this.cell) * k, y: r.top + (this.oy + (p.y + 0.5) * this.cell) * k };
  }

  /** Client rect of the board area (for placing DOM callouts). */
  boardRectClient(): DOMRect {
    const r = this.canvas.getBoundingClientRect();
    const k = r.width / this.canvas.width;
    return new DOMRect(r.left + this.ox * k, r.top + this.oy * k, this.w * this.cell * k, this.h * this.cell * k);
  }

  /* ---------------- loop ---------------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** finish all running animations at once */
  flush() {
    this.anim.flush();
    this.fx = [];
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.anim.tick(now);
    this.particles.update(dt);
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 30);
    this.draw(now);
  }

  /* ---------------- drawing ---------------- */

  private cssVar(name: string, fallback: string) {
    const v = getComputedStyle(this.canvas).getPropertyValue(name).trim();
    return v || fallback;
  }

  private buildBackground() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const s = this.cell;
    const frame = this.cssVar('--board-frame', 'rgba(255,255,255,0.7)');
    const edge = this.cssVar('--board-edge', 'rgba(0,0,0,0.12)');
    const ca = this.cssVar('--cell-a', 'rgba(255,255,255,0.55)');
    const cbv = this.cssVar('--cell-b', 'rgba(255,255,255,0.35)');
    const m = Math.round(s * 0.14);
    const clip = new Path2D();
    g.save();
    g.translate(this.ox, this.oy);
    // soft shadow + frame (union of expanded cells)
    g.shadowColor = 'rgba(15,23,42,0.22)';
    g.shadowBlur = s * 0.35;
    g.shadowOffsetY = s * 0.08;
    g.fillStyle = frame;
    g.beginPath();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.cells[y * this.w + x].playable) continue;
        g.roundRect(x * s - m, y * s - m, s + 2 * m, s + 2 * m, m * 1.6);
      }
    }
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = edge;
    g.lineWidth = Math.max(1, s * 0.02);
    // cells
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.cells[y * this.w + x].playable) continue;
        g.fillStyle = (x + y) % 2 === 0 ? ca : cbv;
        g.beginPath();
        g.roundRect(x * s + 1, y * s + 1, s - 2, s - 2, s * 0.14);
        g.fill();
        clip.rect(this.ox + x * s - m, this.oy + y * s - m, s + 2 * m, s + 2 * m);
      }
    }
    g.restore();
    this.bg = c;
    this.clip = clip;
  }

  /** render every sprite in idle time so the first rocket/rainbow doesn't hitch */
  private prewarm(cache: SpriteCache) {
    const jobs: (() => void)[] = [];
    const specials = ['none', 'rocketH', 'rocketV', 'bomb', 'butterfly'] as const;
    for (let c = 0; c < GEM_COLORS.length; c++) {
      for (const sp of specials) jobs.push(() => cache.tile({ kind: 'gem', color: c, special: sp }));
      jobs.push(() => cache.glow(GEM_COLORS[c].light));
    }
    jobs.push(() => cache.tile({ kind: 'gem', color: -1, special: 'rainbow' }));
    jobs.push(() => cache.tile({ kind: 'chick', color: -1, special: 'none' }));
    for (const g of ['#ffffff', '#e0f2fe', '#fbbf24', '#fde047', '#fef08a', '#f0abfc', '#b45309', '#94a3b8']) jobs.push(() => cache.glow(g));
    for (const k of [1, 2, 3]) jobs.push(() => cache.crate(k));
    for (const k of [1, 2]) jobs.push(() => cache.ice(k));
    jobs.push(() => cache.chain());
    const ric: (cb: () => void) => void =
      'requestIdleCallback' in window ? (cb) => (window as Window).requestIdleCallback(() => cb(), { timeout: 200 }) : (cb) => setTimeout(cb, 16);
    const run = () => {
      if (this.sprites !== cache) return;
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < 8) jobs.shift()!();
      if (jobs.length) ric(run);
    };
    ric(run);
  }

  private draw(now: number) {
    if (this.cells.length !== this.w * this.h || this.cells.length === 0) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.sprites) {
      this.sprites = new SpriteCache(this.cell, this.theme);
      this.prewarm(this.sprites);
    }
    if (!this.bg) this.buildBackground();
    const sp = this.sprites;
    const s = this.cell;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.shakeAmp > 0.05 && !this.reduced) {
      const a = this.shakeAmp * this.dpr;
      ctx.translate(Math.sin(now * 0.09) * a, Math.cos(now * 0.077) * a);
    }
    ctx.drawImage(this.bg!, 0, 0);
    ctx.save();
    ctx.translate(this.ox, this.oy);

    // ice under the tiles, crates
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (!c.playable) continue;
      const x = (i % this.w) * s;
      const y = Math.floor(i / this.w) * s;
      if (c.ice > 0) ctx.drawImage(sp.ice(c.ice), x, y, s, s);
      if (c.crate > 0) ctx.drawImage(sp.crate(c.crate), x, y, s, s);
    }

    // hint glow
    const hintOn = this.hint && now - this.hintStart > 0;
    if (hintOn && this.hint) {
      const pulse = 0.5 + 0.5 * Math.sin((now - this.hintStart) / 180);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.35})`;
      for (const p of [this.hint.a, this.hint.b]) {
        ctx.beginPath();
        ctx.roundRect(p.x * s + s * 0.04, p.y * s + s * 0.04, s * 0.92, s * 0.92, s * 0.2);
        ctx.fill();
      }
      ctx.restore();
    }

    // tiles (clipped to the board so new tiles slide in from the edge)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shakeAmp > 0.05 && !this.reduced) {
      const a = this.shakeAmp * this.dpr;
      ctx.translate(Math.sin(now * 0.09) * a, Math.cos(now * 0.077) * a);
    }
    if (this.clip) ctx.clip(this.clip);
    ctx.translate(this.ox, this.oy);
    const list = [...this.tiles.values()].sort((a, b) => a.z - b.z || a.y - b.y);
    const size = s * 1.2;
    for (const v of list) {
      if (v.alpha <= 0.01 || v.scale <= 0.01) continue;
      let x = v.x;
      let y = v.y;
      let scale = v.scale;
      // hint wiggle
      if (hintOn && this.hint) {
        const { a, b } = this.hint;
        const t = Math.sin((now - this.hintStart) / 140) * 0.07;
        if (Math.round(v.x) === a.x && Math.round(v.y) === a.y) {
          x += (b.x - a.x) * t;
          y += (b.y - a.y) * t;
        } else if (Math.round(v.x) === b.x && Math.round(v.y) === b.y) {
          x += (a.x - b.x) * t;
          y += (a.y - b.y) * t;
        }
      }
      if (this.selected && Math.round(v.x) === this.selected.x && Math.round(v.y) === this.selected.y && v.scale === 1) {
        scale *= 1.08 + Math.sin(now / 160) * 0.04;
      }
      if (this.drag && Math.round(v.x) === this.drag.pos.x && Math.round(v.y) === this.drag.pos.y) {
        x += this.drag.dx;
        y += this.drag.dy;
        scale *= 1.1;
      }
      const img = sp.tile(v.tile);
      const cx = (x + 0.5) * s;
      const cy = (y + 0.5) * s;
      ctx.save();
      ctx.globalAlpha = clamp(v.alpha, 0, 1);
      ctx.translate(cx, cy);
      if (v.rot) ctx.rotate(v.rot);
      ctx.scale(scale * v.sx, scale * v.sy);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      if (v.flash > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(v.flash, 0, 1) * 0.8;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }
    ctx.restore();

    // chains on top of tiles
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.playable && c.chain > 0) ctx.drawImage(sp.chain(), (i % this.w) * s, Math.floor(i / this.w) * s, s, s);
    }

    // selection ring / keyboard cursor
    const ring = (p: Pos, color: string, width: number) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.roundRect(p.x * s + s * 0.05, p.y * s + s * 0.05, s * 0.9, s * 0.9, s * 0.22);
      ctx.stroke();
      ctx.restore();
    };
    if (this.selected) ring(this.selected, 'rgba(255,255,255,0.95)', Math.max(2, s * 0.07));
    if (this.cursor) {
      ring(this.cursor, this.cssVar('--accent', '#f59e0b'), Math.max(2, s * 0.06));
    }

    // effects
    this.fx = this.fx.filter((f) => now < f.until);
    for (const f of this.fx) f.draw(ctx, now);

    // particles
    ctx.save();
    for (const p of this.particles.items) {
      const k = 1 - p.age / p.life;
      const px = p.x * s;
      const py = p.y * s;
      const ps = p.size * s * (0.4 + 0.6 * k);
      ctx.globalAlpha = clamp(k * 1.2, 0, 1);
      if (p.kind === 'glow') {
        ctx.drawImage(sp.glow(p.color), px - ps, py - ps, ps * 2, ps * 2);
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? ps : ps * 0.4;
          const a = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        if (p.kind === 'shard') {
          ctx.beginPath();
          ctx.moveTo(0, -ps);
          ctx.lineTo(ps * 0.6, ps * 0.6);
          ctx.lineTo(-ps * 0.6, ps * 0.4);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-ps, -ps * 0.4, ps * 2, ps * 0.8);
        }
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.restore();

    if (this.dim > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(15,23,42,${this.dim * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- interaction visuals ---------------- */

  showHint(h: { a: Pos; b: Pos } | null) {
    if (h && this.hint && h.a.x === this.hint.a.x && h.a.y === this.hint.a.y && h.b.x === this.hint.b.x && h.b.y === this.hint.b.y) return;
    this.hint = h;
    this.hintStart = performance.now();
  }

  /** little "nope" shake of a tile that can't move */
  nudge(p: Pos) {
    const v = this.tileAtCell(p);
    if (!v) return;
    const now = performance.now();
    const x0 = p.x;
    this.anim.add({
      start: now,
      dur: 260,
      update: (t) => {
        v.x = x0 + Math.sin(t * Math.PI * 4) * 0.08 * (1 - t);
      },
      onEnd: () => (v.x = x0),
    });
  }

  private tileAtCell(p: Pos): TileVis | undefined {
    for (const v of this.tiles.values()) if (Math.round(v.x) === p.x && Math.round(v.y) === p.y && v.alpha > 0.5) return v;
    return undefined;
  }

  /* ---------------- step playback ---------------- */

  async play(steps: Step[]): Promise<void> {
    this.cascade = 1;
    for (const st of steps) {
      switch (st.type) {
        case 'swap':
          await this.playSwap(st);
          break;
        case 'clear':
          await this.playClear(st);
          break;
        case 'fall':
          await this.playFall(st);
          break;
        case 'collect':
          await this.playCollect(st);
          break;
        case 'shuffle':
          await this.playShuffle(st);
          break;
        case 'bonus':
          await this.playBonus(st);
          break;
      }
    }
  }

  /** later cascades play a bit faster so long chains don't drag */
  private cascade = 1;

  private ms(v: number) {
    const boost = Math.max(0.62, 1 - 0.08 * (this.cascade - 1));
    return v * this.speed * boost * (this.reduced ? 0.7 : 1);
  }

  private async playSwap(st: SwapStep) {
    const va = this.tiles.get(st.ida);
    const vb = this.tiles.get(st.idb);
    const now = performance.now();
    const d = this.ms(150);
    this.cb.sfx('swap');
    const move = (v: TileVis | undefined, from: Pos, to: Pos, start: number, e = ease.inOutQuad) => {
      if (!v) return;
      this.anim.add({
        start,
        dur: d,
        update: (p) => {
          const k = e(p);
          v.x = lerp(from.x, to.x, k);
          v.y = lerp(from.y, to.y, k);
        },
      });
    };
    if (va) va.z = 2;
    move(va, st.a, st.b, now);
    move(vb, st.b, st.a, now);
    if (st.invalid) {
      move(va, st.b, st.a, now + d + 40);
      move(vb, st.a, st.b, now + d + 40);
      this.anim.add({ start: now + d, dur: 1, onStart: () => this.cb.sfx('bad') });
      await this.anim.until(now + d * 2 + 60);
    } else {
      await this.anim.until(now + d + 10);
    }
    if (va) va.z = 0;
  }

  private burstFor(x: number, y: number, color: number, special: Special) {
    const n = this.reduced ? 3 : special !== 'none' ? 14 : 7;
    const col = color >= 0 ? GEM_COLORS[color].light : '#ffffff';
    this.particles.burst(x + 0.5, y + 0.5, col, n, { kind: 'glow', size: 0.22, speed: 3.5 });
    if (!this.reduced) this.particles.burst(x + 0.5, y + 0.5, '#ffffff', 2, { kind: 'star', size: 0.12, speed: 2.5, gravity: 2 });
  }

  private async playClear(st: ClearStep) {
    this.cascade = st.cascade;
    const now = performance.now();
    const T = this.ms(UNIT);
    const s = this.cell;
    if (st.cascade >= 2) this.cb.event({ type: 'cascade', n: st.cascade });
    if (st.groups.length > 0) this.cb.sfx('match', { pitch: Math.min(9, st.cascade - 1 + (st.groups.some((g) => g >= 5) ? 1 : 0)) });

    for (const c of st.cleared) {
      const v = this.tiles.get(c.id);
      const at = now + c.t * T;
      if (!v) continue;
      const x0 = v.x;
      const y0 = v.y;
      if (c.mergeTo) {
        const to = c.mergeTo;
        this.anim.add({
          start: at,
          dur: this.ms(170),
          onStart: () => this.cb.event({ type: 'cleared', color: c.color, special: c.special, kind: 'gem' }),
          update: (p) => {
            const k = ease.inQuad(p);
            v.x = lerp(x0, to.x, k);
            v.y = lerp(y0, to.y, k);
            v.scale = 1 - 0.4 * k;
            v.alpha = 1 - k * 0.8;
          },
          onEnd: () => this.tiles.delete(c.id),
        });
      } else {
        this.anim.add({
          start: at,
          dur: this.ms(210),
          onStart: () => {
            this.burstFor(c.x, c.y, c.color, c.special);
            this.cb.event({ type: 'cleared', color: c.color, special: c.special, kind: 'gem' });
          },
          update: (p) => {
            v.flash = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
            v.scale = p < 0.3 ? 1 + 0.22 * (p / 0.3) : 1.22 * (1 - ease.inQuad((p - 0.3) / 0.7));
            v.alpha = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
          },
          onEnd: () => this.tiles.delete(c.id),
        });
      }
    }

    for (const cr of st.created) {
      const at = now + cr.t * T;
      this.anim.add({
        start: at,
        dur: this.ms(300),
        onStart: () => {
          const old = this.tiles.get(cr.replacedId);
          const oldColor = old?.tile.color ?? -1;
          this.tiles.delete(cr.replacedId);
          const v = this.addTile(cr.tile, cr.x, cr.y);
          v.scale = 0.2;
          v.z = 1;
          this.cb.sfx('special');
          this.cb.event({ type: 'created', replacedColor: oldColor });
          this.ring(cr.x + 0.5, cr.y + 0.5, colorOf(cr.tile.color), 1.1, this.ms(380));
          this.particles.burst(cr.x + 0.5, cr.y + 0.5, '#ffffff', this.reduced ? 3 : 10, { kind: 'star', size: 0.14, speed: 3, gravity: 1 });
        },
        update: (p) => {
          const v = this.tiles.get(cr.tile.id);
          if (!v) return;
          v.scale = 0.2 + 0.8 * ease.outBack(p);
          v.flash = 1 - p;
        },
        onEnd: () => {
          const v = this.tiles.get(cr.tile.id);
          if (v) {
            v.scale = 1;
            v.z = 0;
          }
        },
      });
    }

    for (const tr of st.transformed) {
      this.anim.add({
        start: now + tr.t * T,
        dur: this.ms(220),
        onStart: () => {
          const v = this.tiles.get(tr.id);
          if (v) v.tile = { ...v.tile, special: tr.special };
          this.particles.burst(tr.x + 0.5, tr.y + 0.5, '#ffffff', 4, { kind: 'star', size: 0.12, speed: 2 });
        },
        update: (p) => {
          const v = this.tiles.get(tr.id);
          if (!v) return;
          v.flash = 1 - p;
          v.scale = 1 + 0.25 * Math.sin(p * Math.PI);
        },
      });
    }

    for (const bh of st.blockers) {
      this.anim.add({
        start: now + bh.t * T,
        dur: 1,
        onStart: () => {
          const cv = this.cells[bh.y * this.w + bh.x];
          if (bh.type === 'ice') {
            cv.ice = bh.left;
            this.particles.burst(bh.x + 0.5, bh.y + 0.5, '#e0f2fe', this.reduced ? 4 : 10, { kind: 'shard', size: 0.12, speed: 4 });
            this.cb.sfx('ice');
          } else if (bh.type === 'crate') {
            cv.crate = bh.left;
            this.particles.burst(bh.x + 0.5, bh.y + 0.5, '#b45309', this.reduced ? 4 : 12, { kind: 'chip', size: 0.1, speed: 4.5 });
            this.cb.sfx('crate');
            this.shake(2);
          } else {
            cv.chain = bh.left;
            this.particles.burst(bh.x + 0.5, bh.y + 0.5, '#94a3b8', this.reduced ? 4 : 10, { kind: 'chip', size: 0.08, speed: 4 });
            this.cb.sfx('chain');
          }
          this.cb.event({ type: 'blocker', kind: bh.type, left: bh.left });
        },
      });
    }

    for (const a of st.activations) {
      const at = now + a.t * T;
      switch (a.kind) {
        case 'rocket':
          this.anim.add({
            start: at,
            dur: 1,
            onStart: () => {
              this.cb.sfx('rocket');
              this.rocketFx(a.x, a.y, a.dir, colorOf(a.color), at, T * 0.3);
            },
          });
          break;
        case 'bomb':
          this.anim.add({
            start: at,
            dur: 1,
            onStart: () => {
              this.cb.sfx('bomb');
              this.shake(a.radius > 3 ? 9 : 6);
              this.ring(a.x + 0.5, a.y + 0.5, '#fde68a', a.radius, this.ms(420), true);
              this.ring(a.x + 0.5, a.y + 0.5, colorOf(a.color), a.radius * 0.8, this.ms(320));
              this.particles.burst(a.x + 0.5, a.y + 0.5, '#fbbf24', this.reduced ? 5 : 24, { kind: 'glow', size: 0.3, speed: 7 });
            },
          });
          break;
        case 'rainbow':
          this.anim.add({
            start: at,
            dur: 1,
            onStart: () => {
              this.cb.sfx('rainbow');
              this.rainbowFx(a.x, a.y, a.targets, colorOf(a.color), at, T);
            },
          });
          break;
        case 'rainbowAll':
          this.anim.add({
            start: at,
            dur: 1,
            onStart: () => {
              this.cb.sfx('rainbow');
              this.cb.sfx('bomb');
              this.shake(10);
              this.ring(a.x + 0.5, a.y + 0.5, '#ffffff', Math.max(this.w, this.h) * 1.1, this.ms(700), true);
            },
          });
          break;
        case 'butterfly': {
          const arrive = now + a.arrive * T;
          this.anim.add({
            start: at,
            dur: 1,
            onStart: () => {
              this.cb.sfx('butterfly');
              this.butterflyFx(a.x, a.y, a.to, at, arrive, a.carry);
            },
          });
          break;
        }
      }
    }

    for (const pp of st.popups) {
      this.anim.add({
        start: now + pp.t * T + this.ms(120),
        dur: 1,
        onStart: () => {
          this.popupFx(pp.x + 0.5, pp.y + 0.5, `+${pp.value}`, now + pp.t * T, st.cascade);
          this.cb.event({ type: 'score', value: pp.value });
        },
      });
    }
    void s;
    await this.anim.until(now + st.duration * T + this.ms(240));
  }

  private async playFall(st: FallStep) {
    const now = performance.now();
    // accelerating tick clock shared by all tiles → no overlaps, gravity feel
    const cum: number[] = [0];
    for (let k = 0; k <= st.ticks + 1; k++) cum.push(cum[k] + this.ms(Math.max(34, 92 * Math.pow(0.83, k))));
    const at = (k: number) => now + cum[Math.min(k, cum.length - 1)];
    const lastEnd = new Map<number, number>();
    const all = [...st.moves.map((seg) => ({ seg, spawn: null as Tile | null })), ...st.spawns.map((sp) => ({ seg: sp.seg, spawn: sp.tile }))];
    for (const { seg } of all) {
      const end = seg.start + seg.path.length;
      lastEnd.set(seg.id, Math.max(lastEnd.get(seg.id) ?? 0, end));
    }
    for (const { seg, spawn } of all) {
      let v = this.tiles.get(seg.id);
      if (!v && spawn) {
        v = this.addTile(spawn, seg.from.x, seg.from.y);
        v.alpha = 0;
      }
      if (!v) continue;
      const vis = v;
      const pts = [seg.from, ...seg.path];
      const end = seg.start + seg.path.length;
      const isLast = lastEnd.get(seg.id) === end;
      this.anim.add({
        start: at(seg.start),
        dur: at(end) - at(seg.start),
        update: (_p, tnow) => {
          const tt = Math.min(tnow, at(end));
          let i = 0;
          while (i < seg.path.length - 1 && tt >= at(seg.start + i + 1)) i++;
          const t0 = at(seg.start + i);
          const t1 = at(seg.start + i + 1);
          const k = clamp((tt - t0) / Math.max(1, t1 - t0), 0, 1);
          vis.x = lerp(pts[i].x, pts[i + 1].x, k);
          vis.y = lerp(pts[i].y, pts[i + 1].y, k);
          if (spawn) vis.alpha = Math.min(1, vis.alpha + 0.2);
        },
        onEnd: () => {
          const last = pts[pts.length - 1];
          vis.x = last.x;
          vis.y = last.y;
          vis.alpha = 1;
          if (isLast) this.land(vis);
        },
      });
    }
    await this.anim.until(at(st.ticks + 1) + this.ms(60));
  }

  private land(v: TileVis) {
    const now = performance.now();
    this.cb.sfx('land', { volume: 0.6 });
    this.anim.add({
      start: now,
      dur: this.ms(170),
      update: (p) => {
        const k = Math.sin(p * Math.PI) * (1 - p * 0.3);
        v.sy = 1 - 0.14 * k;
        v.sx = 1 + 0.1 * k;
      },
      onEnd: () => {
        v.sx = 1;
        v.sy = 1;
      },
    });
  }

  private async playCollect(st: CollectStep) {
    const now = performance.now();
    this.cb.sfx('chick');
    this.cb.event({ type: 'chick', n: st.chicks.length });
    this.cb.event({ type: 'score', value: st.score });
    for (const c of st.chicks) {
      const v = this.tiles.get(c.id);
      this.particles.burst(c.x + 0.5, c.y + 0.5, '#fde047', this.reduced ? 4 : 16, { kind: 'star', size: 0.16, speed: 4, gravity: 3 });
      this.popupFx(c.x + 0.5, c.y + 0.2, `+${Math.round(st.score / st.chicks.length)}`, now, 2);
      if (!v) continue;
      const y0 = v.y;
      v.z = 3;
      this.anim.add({
        start: now,
        dur: this.ms(520),
        update: (p) => {
          v.y = y0 - Math.sin(p * Math.PI) * 0.7 - p * 0.3;
          v.scale = 1 + 0.4 * p;
          v.alpha = 1 - ease.inQuad(p);
          v.rot = Math.sin(p * Math.PI * 3) * 0.25;
        },
        onEnd: () => this.tiles.delete(c.id),
      });
    }
    await this.anim.until(now + this.ms(420));
  }

  private async playShuffle(st: ShuffleStep) {
    const now = performance.now();
    this.cb.event({ type: 'shuffle' });
    this.cb.sfx('shuffle');
    const d = this.ms(650);
    for (const t of st.tiles) {
      const v = this.tiles.get(t.tile.id);
      if (!v) continue;
      const cx = this.w / 2 - 0.5;
      const cy = this.h / 2 - 0.5;
      this.anim.add({
        start: now + 250,
        dur: d,
        onStart: () => (v.tile = { ...t.tile }),
        update: (p) => {
          const k = ease.inOutCubic(p);
          // swirl through the middle of the board
          const mid = Math.sin(p * Math.PI) * 0.35;
          v.x = lerp(lerp(t.from.x, t.to.x, k), cx, mid);
          v.y = lerp(lerp(t.from.y, t.to.y, k), cy, mid);
          v.rot = Math.sin(p * Math.PI) * 1.2;
          v.scale = 1 - Math.sin(p * Math.PI) * 0.3;
        },
        onEnd: () => {
          v.x = t.to.x;
          v.y = t.to.y;
          v.rot = 0;
          v.scale = 1;
        },
      });
    }
    await this.anim.until(now + 250 + d + 50);
  }

  private async playBonus(st: BonusStep) {
    const now = performance.now();
    this.cb.event({ type: 'bonus' });
    this.cb.event({ type: 'score', value: st.score });
    const gap = this.ms(110);
    for (const c of st.converted) {
      this.anim.add({
        start: now + c.order * gap,
        dur: this.ms(260),
        onStart: () => {
          const v = this.tiles.get(c.id);
          if (v) v.tile = { ...v.tile, special: c.special };
          this.cb.sfx('special', { volume: 0.6 });
          this.particles.burst(c.x + 0.5, c.y + 0.5, '#fef08a', this.reduced ? 3 : 10, { kind: 'star', size: 0.14, speed: 3 });
        },
        update: (p) => {
          const v = this.tiles.get(c.id);
          if (!v) return;
          v.flash = 1 - p;
          v.scale = 1 + 0.3 * Math.sin(p * Math.PI);
        },
      });
    }
    await this.anim.until(now + st.converted.length * gap + this.ms(250));
  }

  /* ---------------- effects ---------------- */

  shake(amount: number) {
    if (this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  private ring(x: number, y: number, color: string, radius: number, dur: number, fill = false) {
    const start = performance.now();
    const s = this.cell;
    this.fx.push({
      until: start + dur,
      draw: (ctx, now) => {
        const p = clamp((now - start) / dur, 0, 1);
        const r = radius * s * ease.outCubic(p);
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.9;
        if (fill) {
          const g = ctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, Math.max(1, r));
          g.addColorStop(0, 'rgba(255,255,255,0.0)');
          g.addColorStop(0.7, color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x * s, y * s, Math.max(1, r), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = s * 0.12 * (1 - p) + 1;
          ctx.beginPath();
          ctx.arc(x * s, y * s, Math.max(1, r), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  private rocketFx(x: number, y: number, dir: 'h' | 'v', color: string, start: number, msPerCell: number) {
    const s = this.cell;
    const len = dir === 'h' ? this.w : this.h;
    const dur = msPerCell * len + 200;
    this.fx.push({
      until: start + dur,
      draw: (ctx, now) => {
        const dist = (now - start) / msPerCell;
        const fade = clamp(1 - (now - start - msPerCell * len) / 200, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const sgn of [-1, 1]) {
          const d = Math.min(dist, len + 1);
          const hx = (x + 0.5 + (dir === 'h' ? sgn * d : 0)) * s;
          const hy = (y + 0.5 + (dir === 'v' ? sgn * d : 0)) * s;
          const g = ctx.createLinearGradient((x + 0.5) * s, (y + 0.5) * s, hx, hy);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, color);
          ctx.strokeStyle = g;
          ctx.globalAlpha = 0.85 * fade;
          ctx.lineWidth = s * 0.34;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo((x + 0.5) * s, (y + 0.5) * s);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.globalAlpha = fade;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(hx, hy, s * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });
    if (!this.reduced) {
      // sparks along the path
      for (let d = 1; d < len; d += 2) {
        for (const sgn of [-1, 1]) {
          const px = x + 0.5 + (dir === 'h' ? sgn * d : 0);
          const py = y + 0.5 + (dir === 'v' ? sgn * d : 0);
          this.anim.add({ start: start + d * msPerCell, dur: 1, onStart: () => this.particles.burst(px, py, '#ffffff', 2, { kind: 'star', size: 0.1, speed: 2, gravity: 2 }) });
        }
      }
    }
  }

  private rainbowFx(x: number, y: number, targets: Pos[], color: string, start: number, T: number) {
    const s = this.cell;
    const end = start + (0.6 + targets.length * 0.05) * T + 300;
    const seeds = targets.map(() => Math.random() * 1000);
    this.fx.push({
      until: end,
      draw: (ctx, now) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        targets.forEach((tp, k) => {
          const hitAt = start + (0.6 + k * 0.05) * T;
          const age = now - (hitAt - 0.4 * T);
          if (age < 0 || now > hitAt + 260) return;
          const a = clamp(1 - (now - hitAt) / 260, 0, 1);
          const x0 = (x + 0.5) * s;
          const y0 = (y + 0.5) * s;
          const x1 = (tp.x + 0.5) * s;
          const y1 = (tp.y + 0.5) * s;
          ctx.strokeStyle = color;
          ctx.globalAlpha = a * 0.8;
          ctx.lineWidth = s * 0.06;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          const segs = 6;
          for (let i = 1; i < segs; i++) {
            const f = i / segs;
            const j = Math.sin(seeds[k] + i * 2.1 + now * 0.03) * s * 0.1;
            ctx.lineTo(lerp(x0, x1, f) + j, lerp(y0, y1, f) - j);
          }
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = s * 0.03;
          ctx.stroke();
        });
        ctx.restore();
      },
    });
  }

  private butterflyFx(x: number, y: number, to: Pos, start: number, arrive: number, carry: Special) {
    const s = this.cell;
    const sp = this.sprites!;
    const img = sp.tile({ kind: 'gem', color: 0, special: 'butterfly' });
    const carryImg = carry !== 'none' ? sp.tile({ kind: 'gem', color: 1, special: carry }) : null;
    const x0 = x + 0.5;
    const y0 = y + 0.5;
    const x1 = to.x + 0.5;
    const y1 = to.y + 0.5;
    // arc control point
    const cx = (x0 + x1) / 2 + (y1 - y0) * 0.35;
    const cy = (y0 + y1) / 2 - Math.max(1.5, Math.abs(x1 - x0) * 0.4);
    this.fx.push({
      until: arrive + 60,
      draw: (ctx, now) => {
        const p = clamp((now - start) / Math.max(1, arrive - start), 0, 1);
        const k = ease.inOutQuad(p);
        const bx = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * x1;
        const by = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y1;
        const flap = 0.75 + Math.abs(Math.sin(now / 45)) * 0.35;
        ctx.save();
        ctx.translate(bx * s, by * s);
        if (carryImg) ctx.drawImage(carryImg, -s * 0.35, -s * 0.1, s * 0.7, s * 0.7);
        ctx.scale(flap, 1);
        ctx.drawImage(img, -s * 0.55, -s * 0.55, s * 1.1, s * 1.1);
        ctx.restore();
      },
    });
    if (!this.reduced) {
      for (let i = 1; i < 8; i++) {
        this.anim.add({
          start: start + ((arrive - start) * i) / 8,
          dur: 1,
          onStart: () => {
            const k = ease.inOutQuad(i / 8);
            const bx = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * x1;
            const by = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y1;
            this.particles.burst(bx, by, '#f0abfc', 2, { kind: 'star', size: 0.1, speed: 1, gravity: 1 });
          },
        });
      }
    }
  }

  private popupFx(x: number, y: number, text: string, start: number, cascade: number) {
    const s = this.cell;
    const dur = this.ms(900);
    const size = s * (0.42 + Math.min(4, cascade - 1) * 0.06);
    const font = this.cssVar('--font-game', 'Nunito, system-ui, sans-serif');
    this.fx.push({
      until: start + dur + 200,
      draw: (ctx, now) => {
        const p = clamp((now - start) / dur, 0, 1);
        ctx.save();
        ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const sc = p < 0.15 ? ease.outBack(p / 0.15) : 1;
        ctx.translate(clamp(x, 0.8, this.w - 0.8) * s, (Math.max(0.55, y) - p * 0.8) * s);
        ctx.scale(sc, sc);
        ctx.font = `900 ${Math.round(size)}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = 'rgba(15,23,42,0.75)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = cascade >= 3 ? '#fde047' : '#ffffff';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      },
    });
  }
}
