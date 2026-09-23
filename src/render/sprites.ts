import type { Special, Tile } from '../core/types';
import { EMOJI_FONT, GEM_COLORS, type PieceTheme, type ShapeKind } from './palette';

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h = w): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

function roundedPoly(ctx: Ctx, pts: [number, number][], radius: number) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    ctx.arcTo(p1[0], p1[1], (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, radius);
  }
  ctx.closePath();
}

/** Path of a piece shape centered at 0,0 with "radius" r. */
export function shapePath(ctx: Ctx, shape: ShapeKind, r: number) {
  switch (shape) {
    case 'heart': {
      const s = r * 1.02;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.92);
      ctx.bezierCurveTo(-s * 0.25, s * 0.68, -s * 1.02, s * 0.22, -s * 0.98, -s * 0.3);
      ctx.bezierCurveTo(-s * 0.94, -s * 0.86, -s * 0.28, -s * 1.02, 0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.28, -s * 1.02, s * 0.94, -s * 0.86, s * 0.98, -s * 0.3);
      ctx.bezierCurveTo(s * 1.02, s * 0.22, s * 0.25, s * 0.68, 0, s * 0.92);
      ctx.closePath();
      break;
    }
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.closePath();
      break;
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r * 1.06 : r * 0.52;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr + r * 0.06]);
      }
      roundedPoly(ctx, pts, r * 0.1);
      break;
    }
    case 'triangle': {
      const pts: [number, number][] = [0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        return [Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1 + r * 0.16];
      });
      roundedPoly(ctx, pts, r * 0.26);
      break;
    }
    case 'diamond':
      roundedPoly(
        ctx,
        [
          [0, -r * 1.02],
          [r * 0.84, 0],
          [0, r * 1.02],
          [-r * 0.84, 0],
        ],
        r * 0.2,
      );
      break;
    case 'square':
      roundedPoly(
        ctx,
        [
          [-r * 0.8, -r * 0.8],
          [r * 0.8, -r * 0.8],
          [r * 0.8, r * 0.8],
          [-r * 0.8, r * 0.8],
        ],
        r * 0.3,
      );
      break;
  }
}

function gloss(ctx: Ctx, r: number, alpha = 0.5) {
  const g = ctx.createLinearGradient(0, -r, 0, 0);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(-r * 0.08, -r * 0.42, r * 0.58, r * 0.34, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawGem(ctx: Ctx, theme: PieceTheme, color: number, r: number) {
  const c = GEM_COLORS[color] ?? GEM_COLORS[0];
  if (theme === 'dinos') {
    // soft rounded tile with an animal
    roundedPoly(
      ctx,
      [
        [-r * 0.92, -r * 0.92],
        [r * 0.92, -r * 0.92],
        [r * 0.92, r * 0.92],
        [-r * 0.92, r * 0.92],
      ],
      r * 0.38,
    );
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, c.light);
    g.addColorStop(1, c.base);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.08;
    ctx.strokeStyle = c.dark;
    ctx.stroke();
    ctx.font = `${Math.round(r * 1.25)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.animal, 0, r * 0.08);
    return;
  }
  if (theme === 'balls') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 0.95);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, c.light);
    g.addColorStop(0.7, c.base);
    g.addColorStop(1, c.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = c.dark;
    ctx.stroke();
    // symbol
    ctx.save();
    ctx.translate(0, r * 0.04);
    shapePath(ctx, c.shape, r * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (theme === 'diamonds') {
    shapePath(ctx, c.shape, r);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, c.light);
    g.addColorStop(0.45, c.base);
    g.addColorStop(1, c.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = c.dark;
    ctx.stroke();
    // facets
    ctx.save();
    shapePath(ctx, c.shape, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = r * 0.04;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
      ctx.stroke();
    }
    ctx.restore();
    // table
    shapePath(ctx, c.shape, r * 0.5);
    const t = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
    t.addColorStop(0, '#ffffff');
    t.addColorStop(1, c.light);
    ctx.fillStyle = t;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    // sparkle
    sparkle(ctx, -r * 0.42, -r * 0.46, r * 0.2);
    return;
  }
  // 'shapes' – glossy candy
  shapePath(ctx, c.shape, r);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.1);
  g.addColorStop(0, c.light);
  g.addColorStop(0.55, c.base);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.075;
  ctx.strokeStyle = c.dark;
  ctx.stroke();
  ctx.save();
  shapePath(ctx, c.shape, r);
  ctx.clip();
  gloss(ctx, r, 0.55);
  ctx.restore();
}

function sparkle(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.restore();
}

function emoji(ctx: Ctx, ch: string, size: number, rot = 0, dy = 0) {
  ctx.save();
  ctx.rotate(rot);
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = size * 0.25;
  ctx.fillText(ch, 0, dy + size * 0.06);
  ctx.restore();
}

function drawRainbow(ctx: Ctx, r: number) {
  const cols = GEM_COLORS.map((c) => c.base);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  if (typeof ctx.createConicGradient === 'function') {
    const g = ctx.createConicGradient(0, 0, 0);
    cols.forEach((c, i) => g.addColorStop(i / cols.length, c));
    g.addColorStop(1, cols[0]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = cols[4];
  }
  ctx.fill();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
  inner.addColorStop(0, 'rgba(255,255,255,1)');
  inner.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  sparkle(ctx, 0, 0, r * 0.42);
  sparkle(ctx, -r * 0.45, -r * 0.45, r * 0.16);
}

function drawSpecialOverlay(ctx: Ctx, special: Special, r: number, clip: () => void) {
  switch (special) {
    case 'rocketH':
    case 'rocketV': {
      // white stripes along the firing direction (inside the piece outline)
      ctx.save();
      clip();
      ctx.clip();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      for (const k of [-0.55, 0, 0.55]) {
        if (special === 'rocketH') ctx.fillRect(-r, k * r - r * 0.08, r * 2, r * 0.16);
        else ctx.fillRect(k * r - r * 0.08, -r, r * 0.16, r * 2);
      }
      ctx.restore();
      emoji(ctx, '🚀', r * 1.05, special === 'rocketH' ? Math.PI / 4 : -Math.PI / 4);
      break;
    }
    case 'bomb':
      emoji(ctx, '💣', r * 1.15);
      break;
    case 'butterfly':
      emoji(ctx, '🦋', r * 1.1);
      break;
    default:
      break;
  }
}

/** Draw a whole tile (piece + special overlay) centered at 0,0. */
export function drawTile(ctx: Ctx, theme: PieceTheme, t: Pick<Tile, 'kind' | 'color' | 'special'>, r: number) {
  if (t.kind === 'chick') {
    ctx.save();
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, 'rgba(255,251,235,1)');
    g.addColorStop(0.75, 'rgba(254,243,199,0.95)');
    g.addColorStop(1, 'rgba(253,230,138,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    emoji(ctx, '🐥', r * 1.35);
    return;
  }
  if (t.special === 'rainbow') {
    drawRainbow(ctx, r);
    return;
  }
  const clean = theme === 'dinos' && t.special !== 'none' ? 'shapes' : theme;
  drawGem(ctx, clean, t.color, r);
  const shape = (GEM_COLORS[t.color] ?? GEM_COLORS[0]).shape;
  drawSpecialOverlay(ctx, t.special, r, () => {
    if (clean === 'balls') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    } else shapePath(ctx, shape, r);
  });
}

/* ---------- obstacles ---------- */

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawCrate(ctx: Ctx, s: number, hp: number) {
  const pad = s * 0.06;
  const x = pad;
  const y = pad;
  const w = s - pad * 2;
  const wood = hp >= 3 ? ['#a16207', '#78350f', '#451a03'] : hp === 2 ? ['#d97706', '#92400e', '#78350f'] : ['#f0b86e', '#c47f3a', '#8a5a2b'];
  rrect(ctx, x, y, w, w, s * 0.14);
  const g = ctx.createLinearGradient(0, y, 0, y + w);
  g.addColorStop(0, wood[0]);
  g.addColorStop(1, wood[1]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = wood[2];
  ctx.stroke();
  // planks
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = s * 0.025;
  for (const k of [1 / 3, 2 / 3]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.06, y + w * k);
    ctx.lineTo(x + w - s * 0.06, y + w * k);
    ctx.stroke();
  }
  // diagonal brace
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.12, y + w - s * 0.12);
  ctx.lineTo(x + w - s * 0.12, y + s * 0.12);
  ctx.stroke();
  if (hp >= 2) {
    // iron straps
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + w * 0.18, y, w * 0.12, w);
    ctx.fillRect(x + w * 0.7, y, w * 0.12, w);
    ctx.fillStyle = '#cbd5e1';
    for (const sx of [0.24, 0.76]) {
      for (const sy of [0.15, 0.5, 0.85]) {
        ctx.beginPath();
        ctx.arc(x + w * sx, y + w * sy, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (hp >= 3) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(x, y + w * 0.44, w, w * 0.12);
  }
  // nails
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [nx, ny] of [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.12, 0.88],
    [0.88, 0.88],
  ]) {
    ctx.beginPath();
    ctx.arc(x + w * nx, y + w * ny, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawIce(ctx: Ctx, s: number, layers: number) {
  const pad = s * 0.03;
  rrect(ctx, pad, pad, s - pad * 2, s - pad * 2, s * 0.16);
  const g = ctx.createLinearGradient(0, 0, s, s);
  if (layers >= 2) {
    g.addColorStop(0, 'rgba(186,230,253,0.98)');
    g.addColorStop(1, 'rgba(56,189,248,0.95)');
  } else {
    g.addColorStop(0, 'rgba(224,242,254,0.95)');
    g.addColorStop(1, 'rgba(125,211,252,0.8)');
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * (layers >= 2 ? 0.07 : 0.04);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  // frosty streaks
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.45);
  ctx.lineTo(s * 0.45, s * 0.1);
  ctx.moveTo(s * 0.55, s * 0.95);
  ctx.lineTo(s * 0.95, s * 0.55);
  ctx.stroke();
  if (layers >= 2) {
    ctx.strokeStyle = 'rgba(12,74,110,0.35)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.2, s * 0.75);
    ctx.moveTo(s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.8, s * 0.3);
    ctx.moveTo(s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.62, s * 0.88);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawChain(ctx: Ctx, s: number) {
  const link = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.1, s * 0.055, 0, 0, Math.PI * 2);
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.lineWidth = s * 0.028;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
    ctx.restore();
  };
  for (const dir of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const k = (i + 0.5) / 6;
      const x = dir === 1 ? s * (0.05 + k * 0.9) : s * (0.95 - k * 0.9);
      const y = s * (0.05 + k * 0.9);
      link(x, y, (dir * Math.PI) / 4 + (i % 2 ? Math.PI / 2 : 0));
    }
  }
  // padlock
  const cx = s * 0.5;
  const cy = s * 0.56;
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.08, s * 0.08, Math.PI, 0);
  ctx.stroke();
  rrect(ctx, cx - s * 0.12, cy - s * 0.08, s * 0.24, s * 0.18, s * 0.04);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.stroke();
}

/* ---------- cache ---------- */

export class SpriteCache {
  private tiles = new Map<string, HTMLCanvasElement>();
  private misc = new Map<string, HTMLCanvasElement>();
  constructor(
    /** sprite size in device pixels (one cell) */
    readonly size: number,
    readonly theme: PieceTheme,
  ) {}

  tile(t: Pick<Tile, 'kind' | 'color' | 'special'>): HTMLCanvasElement {
    const key = `${t.kind}|${t.color}|${t.special}`;
    let c = this.tiles.get(key);
    if (!c) {
      const s = this.size;
      const [cv, ctx] = makeCanvas(s * 1.2);
      ctx.translate(cv.width / 2, cv.height / 2);
      drawTile(ctx, this.theme, t, s * 0.4);
      c = cv;
      this.tiles.set(key, c);
    }
    return c;
  }

  private cached(key: string, draw: (ctx: Ctx, s: number) => void): HTMLCanvasElement {
    let c = this.misc.get(key);
    if (!c) {
      const [cv, ctx] = makeCanvas(this.size);
      draw(ctx, this.size);
      c = cv;
      this.misc.set(key, c);
    }
    return c;
  }

  crate(hp: number) {
    return this.cached(`crate${hp}`, (ctx, s) => drawCrate(ctx, s, hp));
  }
  ice(layers: number) {
    return this.cached(`ice${layers}`, (ctx, s) => drawIce(ctx, s, layers));
  }
  chain() {
    return this.cached('chain', (ctx, s) => drawChain(ctx, s));
  }
  /** soft round glow used by particles */
  glow(color: string) {
    return this.cached(`glow${color}`, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, color);
      g.addColorStop(0.35, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
}

/** Small standalone icon canvas (HUD goals, how-to page). */
export function tileIcon(theme: PieceTheme, t: Pick<Tile, 'kind' | 'color' | 'special'>, cssSize: number): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const [cv, ctx] = makeCanvas(cssSize * dpr);
  ctx.translate(cv.width / 2, cv.height / 2);
  drawTile(ctx, theme, t, cv.width * 0.42);
  cv.style.width = `${cssSize}px`;
  cv.style.height = `${cssSize}px`;
  return cv;
}

export function obstacleIcon(kind: 'ice' | 'crate' | 'chain', cssSize: number, level = 1): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const s = cssSize * dpr;
  const [cv, ctx] = makeCanvas(s);
  if (kind === 'ice') drawIce(ctx, s, level);
  else if (kind === 'crate') drawCrate(ctx, s, level);
  else {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    drawTile(ctx, 'shapes', { kind: 'gem', color: 1, special: 'none' }, s * 0.36);
    ctx.restore();
    drawChain(ctx, s);
  }
  cv.style.width = `${cssSize}px`;
  cv.style.height = `${cssSize}px`;
  return cv;
}
