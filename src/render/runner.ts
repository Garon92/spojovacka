/**
 * The hamster wheel from the original game: an animal runs in a wheel, faster with a higher score.
 * Vector-drawn (no images). Extended with more animals.
 */

export interface SkinDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

export const SKINS: SkinDef[] = [
  { id: 'mouse', name: 'Myška', emoji: '🐭', cost: 0 },
  { id: 'rat', name: 'Potkan', emoji: '🐀', cost: 60 },
  { id: 'hamster', name: 'Křeček', emoji: '🐹', cost: 100 },
  { id: 'dog', name: 'Pejsek', emoji: '🐶', cost: 150 },
  { id: 'cat', name: 'Kočička', emoji: '🐱', cost: 200 },
  { id: 'rabbit', name: 'Zajíček', emoji: '🐰', cost: 260 },
  { id: 'dino', name: 'Dinosaurus', emoji: '🦖', cost: 320 },
  { id: 'fox', name: 'Liška', emoji: '🦊', cost: 400 },
];

interface AnimalCfg {
  body: string;
  belly: string;
  tail: string;
  ear: string;
  snout: number;
  tailLen: number;
  ears: 'round' | 'floppy' | 'pointy' | 'long';
  whiskers: boolean;
  spikes?: boolean;
  bushy?: boolean;
  stripes?: boolean;
  tailWidth?: number;
}

const CFG: Record<string, AnimalCfg> = {
  mouse: { body: '#aab3c2', belly: '#dbe2ee', tail: '#c8cfdb', ear: '#e1a7b7', snout: 1, tailLen: 1.05, ears: 'round', whiskers: true },
  rat: { body: '#8b93a6', belly: '#c7ceda', tail: '#b7bfcc', ear: '#d6b3c2', snout: 1.05, tailLen: 1.25, ears: 'round', whiskers: true },
  hamster: { body: '#e8a45c', belly: '#fbe7cf', tail: '#e8a45c', ear: '#f4b9a4', snout: 0.85, tailLen: 0.25, ears: 'round', whiskers: true },
  dog: { body: '#b48a62', belly: '#e7d3b7', tail: '#caa27b', ear: '#8e6846', snout: 1.18, tailLen: 0.7, ears: 'floppy', whiskers: false },
  cat: { body: '#94a3b8', belly: '#e2e8f0', tail: '#94a3b8', ear: '#f9a8d4', snout: 0.9, tailLen: 1.2, ears: 'pointy', whiskers: true, stripes: true, tailWidth: 0.7 },
  rabbit: { body: '#e7e5e4', belly: '#fafaf9', tail: '#ffffff', ear: '#fbcfe8', snout: 0.95, tailLen: 0.25, ears: 'long', whiskers: true, tailWidth: 1.4 },
  dino: { body: '#35d07f', belly: '#bdf7db', tail: '#2bb56c', ear: '#2bb56c', snout: 1.1, tailLen: 1.15, ears: 'round', whiskers: false, spikes: true, tailWidth: 1.1 },
  fox: { body: '#f97316', belly: '#fff7ed', tail: '#fb923c', ear: '#7c2d12', snout: 1.25, tailLen: 1.0, ears: 'pointy', whiskers: false, bushy: true, tailWidth: 1.6 },
};

function drawAnimal(ctx: CanvasRenderingContext2D, skin: string, sizePx: number, phase: number) {
  const cfg = CFG[skin] ?? CFG.mouse;
  const u = sizePx / 10;
  const run = Math.sin(phase);
  const run2 = Math.sin(phase + Math.PI);
  const bob = Math.sin(phase * 0.5) * (u * 0.25);
  const outline = 'rgba(0,0,0,0.18)';
  ctx.save();
  ctx.translate(0, bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, u * 2.4, u * 4, u * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // tail
  ctx.save();
  ctx.strokeStyle = cfg.tail;
  ctx.lineWidth = u * 0.55 * (cfg.tailWidth ?? 1);
  const sw = 0.55 * run;
  if (cfg.bushy) {
    ctx.fillStyle = cfg.tail;
    ctx.beginPath();
    ctx.ellipse(-u * 4.6, -u * 0.3 + sw * u, u * 2.2, u * 0.95, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.ellipse(-u * 6.2, -u * 0.9 + sw * u, u * 0.8, u * 0.55, -0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.tailLen < 0.5) {
    ctx.fillStyle = cfg.tail;
    ctx.beginPath();
    ctx.arc(-u * 3.3, -u * 0.2, u * 0.7 * (cfg.tailWidth ?? 1), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-u * 3.2, u * 0.2);
    ctx.quadraticCurveTo(-u * 5.2, -u * 0.4 + sw * u, -u * 6.6 * cfg.tailLen, u * 0.6 + sw * u);
    ctx.stroke();
  }
  ctx.restore();

  const legs = (layer: number) => {
    ctx.save();
    ctx.strokeStyle = layer === 0 ? 'rgba(10,12,18,0.45)' : 'rgba(20,22,30,0.6)';
    ctx.lineWidth = u * 0.65;
    const a = layer === 0 ? run2 : run;
    const b = layer === 0 ? run : run2;
    const bx = layer === 0 ? -1.7 : -1.2;
    const fx = layer === 0 ? 1.4 : 1.9;
    ctx.beginPath();
    ctx.moveTo(bx * u, u * 1.5);
    ctx.lineTo(bx * u + a * u * 0.85, u * (2.7 - Math.max(0, a) * 0.55));
    ctx.moveTo(fx * u, u * 1.5);
    ctx.lineTo(fx * u + b * u * 0.85, u * (2.7 - Math.max(0, b) * 0.55));
    ctx.stroke();
    ctx.restore();
  };
  legs(0);

  // body
  ctx.save();
  ctx.fillStyle = cfg.body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = u * 0.25;
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 3.3, u * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = cfg.belly;
  ctx.beginPath();
  ctx.ellipse(u * 0.6, u * 0.6, u * 2, u * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (cfg.stripes) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = u * 0.3;
    for (const k of [-1.6, -0.6, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(k * u, -u * 1.9);
      ctx.lineTo(k * u + u * 0.3, -u * 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();

  // head
  ctx.save();
  ctx.translate(u * 3.1, -u * 0.6);
  // ears behind the head
  ctx.fillStyle = cfg.ear;
  if (cfg.ears === 'long') {
    for (const dx of [-0.7, -0.1]) {
      ctx.beginPath();
      ctx.ellipse(dx * u, -u * 2.2, u * 0.45, u * 1.4, -0.25, 0, Math.PI * 2);
      ctx.fillStyle = cfg.body;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(dx * u, -u * 2.2, u * 0.22, u * 1.05, -0.25, 0, Math.PI * 2);
      ctx.fillStyle = cfg.ear;
      ctx.fill();
    }
  } else if (cfg.ears === 'pointy') {
    ctx.fillStyle = cfg.body;
    for (const dx of [-0.9, 0.1]) {
      ctx.beginPath();
      ctx.moveTo(dx * u - u * 0.5, -u * 0.8);
      ctx.lineTo(dx * u + u * 0.1, -u * 2.2);
      ctx.lineTo(dx * u + u * 0.6, -u * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = cfg.ear;
    ctx.beginPath();
    ctx.moveTo(-u * 1.1, -u * 0.9);
    ctx.lineTo(-u * 0.8, -u * 1.8);
    ctx.lineTo(-u * 0.45, -u * 0.85);
    ctx.fill();
  }
  ctx.fillStyle = cfg.body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = u * 0.22;
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 1.7, u * 1.3, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(u * 1.2 * cfg.snout, u * 0.25, u * 0.75, u * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // nose
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(u * (1.2 * cfg.snout + 0.65), u * 0.15, u * 0.17, 0, Math.PI * 2);
  ctx.fill();
  // eye
  ctx.fillStyle = 'rgba(10,12,18,0.85)';
  ctx.beginPath();
  ctx.arc(u * 0.35, -u * 0.25, u * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(u * 0.42, -u * 0.32, u * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // front ears
  ctx.fillStyle = cfg.ear;
  if (cfg.ears === 'floppy') {
    ctx.beginPath();
    ctx.ellipse(-u * 0.55, -u * 0.55, u * 0.55, u * 0.9, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.ears === 'round') {
    ctx.beginPath();
    ctx.ellipse(-u * 0.45, -u * 1.05, u * 0.6, u * 0.7, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cfg.whiskers) {
    ctx.strokeStyle = 'rgba(30,41,59,0.35)';
    ctx.lineWidth = u * 0.1;
    ctx.beginPath();
    ctx.moveTo(u * 1.35, u * 0.15);
    ctx.lineTo(u * 2.6, -u * 0.1);
    ctx.moveTo(u * 1.35, u * 0.4);
    ctx.lineTo(u * 2.6, u * 0.45);
    ctx.stroke();
  }
  ctx.restore();

  legs(1);

  if (cfg.spikes) {
    ctx.save();
    ctx.translate(-u * 1.2, -u * 1.85);
    ctx.fillStyle = '#16a34a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * u * 0.75, 0);
      ctx.lineTo(i * u * 0.75 + u * 0.37, -u * 0.6);
      ctx.lineTo(i * u * 0.75 + u * 0.75, 0);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** score → 0..1, asymptotic like in the original game (100 % is never reached) */
export function speedFromScore(score: number, scale = 1000): number {
  const x = Math.max(0, score) / scale;
  return 1 - Math.pow(1 + x, -0.7);
}

export class Runner {
  private ctx: CanvasRenderingContext2D;
  private angle = Math.random() * Math.PI * 2;
  private t = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  skin = 'mouse';
  /** 0..1 */
  speed = 0.2;
  private shown = 0.2;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.render(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  render(dt: number) {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    if (r.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(r.width * dpr);
    const H = Math.round(r.height * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = this.ctx;
    const size = Math.min(W, H);
    this.shown += (this.speed - this.shown) * Math.min(1, dt * 2);
    const rps = 0.1 + 0.95 * Math.min(0.999, this.shown);
    this.angle = (this.angle + dt * Math.PI * 2 * rps) % (Math.PI * 2);
    this.t += dt;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const R = size * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    // stand
    ctx.strokeStyle = 'rgba(100,116,139,0.8)';
    ctx.lineWidth = size * 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.55, R * 1.15);
    ctx.moveTo(0, 0);
    ctx.lineTo(R * 0.55, R * 1.15);
    ctx.stroke();
    // wheel back
    const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.05);
    g.addColorStop(0, 'rgba(245,158,11,0.05)');
    g.addColorStop(1, 'rgba(245,158,11,0.22)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // spokes
    ctx.save();
    ctx.rotate(this.angle);
    ctx.strokeStyle = 'rgba(148,163,184,0.75)';
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
      ctx.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
      ctx.stroke();
    }
    // rungs on the rim
    ctx.strokeStyle = 'rgba(245,158,11,0.9)';
    ctx.lineWidth = Math.max(2, size * 0.02);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93);
      ctx.lineTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02);
      ctx.stroke();
    }
    ctx.restore();
    // rim
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(2, size * 0.028);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    // hub
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
    // animal at the bottom of the wheel
    const phase = this.t * (10 + this.shown * 14);
    ctx.translate(0, R * 0.62);
    ctx.rotate(Math.sin(phase) * 0.04);
    drawAnimal(ctx, this.skin, size * 0.17, phase);
    ctx.restore();
  }
}

/** Static portrait of an animal for skin cards. */
export function animalPortrait(skin: string, cssSize: number): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(cssSize * dpr);
  c.style.width = c.style.height = `${cssSize}px`;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width * 0.52, c.height * 0.52);
  drawAnimal(ctx, skin, c.width * 0.5, 0.8);
  return c;
}
