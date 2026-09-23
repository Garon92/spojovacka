/**
 * Confetti burst on a full-screen canvas. Skipped entirely when reduced motion is on.
 *   confetti();                                  // centered burst in accent + gold
 *   confetti({ origin: { x: 0.5, y: 0.8 }, particleCount: 200, spread: 100 });
 *   confettiFrom(buttonEl);                      // burst from an element's centre
 */
import { prefersReducedMotion } from './settings';

export interface ConfettiOptions {
  particleCount?: number;
  /** 0..1 of the viewport */
  origin?: { x: number; y: number };
  /** cone width in degrees */
  spread?: number;
  /** direction in degrees, 90 = up */
  angle?: number;
  /** initial speed in px/frame at 60 fps */
  velocity?: number;
  colors?: string[];
  /** ms before particles fade */
  duration?: number;
  /** also fire two side cannons */
  cannons?: boolean;
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1 | 2; // rect, circle, ribbon
  tilt: number;
  vt: number;
  life: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let particles: P[] = [];
let raf = 0;
let last = 0;

function accentColors(): string[] {
  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue('--accent').trim() || '#6d5dfc';
  return [accent, '#f5b700', '#ff6b9a', '#3ddc97', '#4cc3ff', '#ffffff', accent];
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (canvas && ctx2d && canvas.isConnected) return ctx2d;
  canvas = document.createElement('canvas');
  canvas.className = 'g92-confetti';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 'var(--g92-z-confetti, 1300)',
  });
  document.body.append(canvas);
  ctx2d = canvas.getContext('2d');
  resize();
  return ctx2d;
}

function resize(): void {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx2d?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(t: number): void {
  const c = ctx2d;
  if (!c || !canvas) return;
  const dt = Math.min(3, last ? (t - last) / 16.67 : 1);
  last = t;
  c.clearRect(0, 0, innerWidth, innerHeight);
  const next: P[] = [];
  for (const p of particles) {
    p.vx *= Math.pow(0.985, dt);
    p.vy = p.vy * Math.pow(0.985, dt) + 0.28 * dt;
    p.x += p.vx * dt + Math.sin(p.tilt) * 0.6 * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.tilt += p.vt * dt;
    p.life -= 16.67 * dt;
    if (p.y > innerHeight + 40 || p.life < -600) continue;
    const alpha = p.life > 0 ? 1 : Math.max(0, 1 + p.life / 600);
    c.save();
    c.globalAlpha = alpha;
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.scale(1, Math.cos(p.tilt));
    c.fillStyle = p.color;
    if (p.shape === 1) {
      c.beginPath();
      c.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      c.fill();
    } else if (p.shape === 2) {
      c.fillRect(-p.w, -p.h / 4, p.w * 2, p.h / 2);
    } else {
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    c.restore();
    next.push(p);
  }
  particles = next;
  if (particles.length) raf = requestAnimationFrame(frame);
  else stop();
}

function stop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  canvas?.remove();
  canvas = null;
  ctx2d = null;
  window.removeEventListener('resize', resize);
}

function burst(o: Required<Pick<ConfettiOptions, 'particleCount' | 'origin' | 'spread' | 'angle' | 'velocity' | 'duration'>> & { colors: string[] }): void {
  const ox = o.origin.x * innerWidth;
  const oy = o.origin.y * innerHeight;
  for (let i = 0; i < o.particleCount; i++) {
    const a = ((o.angle + (Math.random() - 0.5) * o.spread) * Math.PI) / 180;
    const v = o.velocity * (0.55 + Math.random() * 0.6);
    const size = 6 + Math.random() * 7;
    particles.push({
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: -Math.sin(a) * v,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      w: size,
      h: size * (0.5 + Math.random() * 0.6),
      color: o.colors[(Math.random() * o.colors.length) | 0] ?? '#f5b700',
      shape: (Math.random() < 0.25 ? 1 : Math.random() < 0.2 ? 2 : 0) as 0 | 1 | 2,
      tilt: Math.random() * Math.PI,
      vt: 0.05 + Math.random() * 0.12,
      life: o.duration * (0.6 + Math.random() * 0.5),
    });
  }
}

/** Fire confetti. Returns false when skipped (reduced motion / no DOM). */
export function confetti(opts: ConfettiOptions = {}): boolean {
  if (typeof document === 'undefined' || prefersReducedMotion()) return false;
  if (!ensureCanvas()) return false;
  const colors = opts.colors ?? accentColors();
  const base = {
    particleCount: Math.min(400, opts.particleCount ?? 140),
    origin: opts.origin ?? { x: 0.5, y: 0.45 },
    spread: opts.spread ?? 80,
    angle: opts.angle ?? 90,
    velocity: opts.velocity ?? 16,
    duration: opts.duration ?? 2200,
    colors,
  };
  burst(base);
  if (opts.cannons) {
    burst({ ...base, particleCount: base.particleCount / 2, origin: { x: 0, y: 0.75 }, angle: 60, spread: 45, velocity: base.velocity * 1.15 });
    burst({ ...base, particleCount: base.particleCount / 2, origin: { x: 1, y: 0.75 }, angle: 120, spread: 45, velocity: base.velocity * 1.15 });
  }
  if (!raf) {
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
  }
  return true;
}

/** Burst from the centre of an element. */
export function confettiFrom(el: Element, opts: Omit<ConfettiOptions, 'origin'> = {}): boolean {
  const r = el.getBoundingClientRect();
  return confetti({ particleCount: 60, spread: 70, velocity: 11, ...opts, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } });
}

/** Remove all confetti immediately. */
export function clearConfetti(): void {
  particles = [];
  stop();
}
