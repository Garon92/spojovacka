export type ParticleKind = 'glow' | 'shard' | 'star' | 'chip';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rot: number;
  vr: number;
  gravity: number;
}

/** Simple particle system; positions and sizes are in cell units. */
export class Particles {
  items: Particle[] = [];
  max = 420;

  emit(p: Omit<Particle, 'age'>) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ ...p, age: 0 });
  }

  burst(x: number, y: number, color: string, count: number, opts: Partial<Pick<Particle, 'kind' | 'size' | 'gravity'>> & { speed?: number; life?: number } = {}) {
    const speed = opts.speed ?? 4;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.75);
      this.emit({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.35,
        life: (opts.life ?? 0.55) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 0.16) * (0.6 + Math.random() * 0.8),
        color,
        kind: opts.kind ?? 'glow',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        gravity: opts.gravity ?? 9,
      });
    }
  }

  update(dt: number) {
    const out: Particle[] = [];
    for (const p of this.items) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      out.push(p);
    }
    this.items = out;
  }

  clear() {
    this.items = [];
  }
}
