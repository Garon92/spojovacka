/** Synthesized WebAudio sound effects (no audio files). Ported and extended from the original game. */
export type SfxName =
  | 'select'
  | 'swap'
  | 'bad'
  | 'match'
  | 'special'
  | 'rocket'
  | 'bomb'
  | 'rainbow'
  | 'butterfly'
  | 'ice'
  | 'crate'
  | 'chain'
  | 'chick'
  | 'shuffle'
  | 'land'
  | 'star'
  | 'win'
  | 'lose'
  | 'coin'
  | 'ui'
  | 'tick'
  | 'combo';

export interface SfxOptions {
  /** 0..n – raises the pitch (cascade level, star index…) */
  pitch?: number;
  volume?: number;
}

// C major pentatonic, rising with cascades
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

type AudioCtor = typeof AudioContext;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last = new Map<string, number>();
  enabled = true;
  volume = 0.8;

  /** must be called from a user gesture at least once (autoplay policy) */
  unlock() {
    if (!this.enabled) return;
    const c = this.ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.volume * 0.7;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number | null, dur: number, vol: number, delay = 0, detune = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.8, delay = 0, sweepTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  play(name: SfxName, opts: SfxOptions = {}) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== 'running') {
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      if (!ctx || ctx.state !== 'running') return;
    }
    // throttle very frequent sounds
    const now = performance.now();
    const minGap: Partial<Record<SfxName, number>> = { land: 70, ice: 45, crate: 45, chain: 45, match: 40, tick: 80 };
    const gap = minGap[name];
    if (gap !== undefined) {
      const l = this.last.get(name) ?? 0;
      if (now - l < gap) return;
      this.last.set(name, now);
    }
    const v = (opts.volume ?? 1) * 1;
    const p = opts.pitch ?? 0;
    switch (name) {
      case 'ui':
        this.tone('triangle', 740, 520, 0.07, 0.08 * v);
        break;
      case 'select':
        this.tone('sine', 660, 880, 0.06, 0.07 * v);
        break;
      case 'swap':
        this.tone('triangle', 400, 560, 0.08, 0.07 * v, 0, -6);
        this.tone('sine', 560, 700, 0.06, 0.04 * v, 0.01, 6);
        break;
      case 'bad':
        this.tone('sine', 240, 150, 0.12, 0.1 * v);
        this.tone('sine', 200, 120, 0.12, 0.06 * v, 0.09);
        break;
      case 'match': {
        const f = SCALE[Math.min(SCALE.length - 1, Math.max(0, p))];
        this.tone('triangle', f, f * 1.02, 0.14, 0.1 * v);
        this.tone('sine', f * 1.5, f * 1.52, 0.12, 0.05 * v, 0.03);
        this.noise(0.06, 0.025 * v, 'highpass', 2500, 0.7);
        break;
      }
      case 'special':
        [0, 1, 2, 3].forEach((i) => this.tone('sine', SCALE[2 + i * 2] ?? 1500, null, 0.18, 0.06 * v, i * 0.045));
        this.noise(0.25, 0.03 * v, 'highpass', 4000, 0.6);
        break;
      case 'rocket':
        this.noise(0.32, 0.13 * v, 'bandpass', 600, 1.2, 0, 3500);
        this.tone('sawtooth', 220, 700, 0.25, 0.05 * v, 0, -8);
        break;
      case 'bomb':
        this.tone('sine', 150, 45, 0.45, 0.22 * v);
        this.tone('triangle', 220, 70, 0.3, 0.08 * v, 0, -10);
        this.noise(0.5, 0.2 * v, 'lowpass', 900, 0.7, 0, 120);
        break;
      case 'rainbow':
        SCALE.slice(0, 8).forEach((f, i) => this.tone('sine', f, null, 0.22, 0.05 * v, i * 0.04));
        this.noise(0.5, 0.04 * v, 'highpass', 5000, 0.5);
        break;
      case 'butterfly':
        for (let i = 0; i < 5; i++) this.noise(0.05, 0.05 * v, 'bandpass', 1800 + i * 200, 3, i * 0.06);
        this.tone('sine', 900, 1300, 0.3, 0.04 * v);
        break;
      case 'ice':
        this.tone('sine', 2400 + Math.random() * 600, 1800, 0.08, 0.05 * v);
        this.noise(0.12, 0.06 * v, 'highpass', 3000, 1);
        break;
      case 'crate':
        this.tone('square', 180, 90, 0.08, 0.06 * v);
        this.noise(0.14, 0.12 * v, 'bandpass', 700, 1.5);
        break;
      case 'chain':
        this.tone('triangle', 1400, 1100, 0.12, 0.05 * v);
        this.tone('triangle', 1900, 1500, 0.1, 0.035 * v, 0.03);
        break;
      case 'chick':
        this.tone('sine', 1800, 2600, 0.07, 0.07 * v);
        this.tone('sine', 1900, 2800, 0.07, 0.06 * v, 0.1);
        break;
      case 'shuffle':
        this.noise(0.5, 0.08 * v, 'bandpass', 400, 0.8, 0, 2400);
        break;
      case 'land':
        this.tone('sine', 180, 120, 0.05, 0.035 * v);
        break;
      case 'star': {
        const f = [880, 1108.73, 1318.51][Math.min(2, p)];
        this.tone('triangle', f, null, 0.35, 0.1 * v);
        this.tone('sine', f * 2, null, 0.3, 0.04 * v, 0.02);
        break;
      }
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone('triangle', f, null, 0.28, 0.09 * v, i * 0.11));
        this.tone('sine', 1567.98, null, 0.6, 0.06 * v, 0.44);
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.08 * v, i * 0.16));
        break;
      case 'coin':
        this.tone('square', 988, null, 0.07, 0.04 * v);
        this.tone('square', 1319, null, 0.16, 0.04 * v, 0.07);
        break;
      case 'tick':
        this.tone('square', 1200, null, 0.03, 0.03 * v);
        break;
      case 'combo':
        [659.25, 783.99, 987.77, 1318.51].forEach((f, i) => this.tone('square', f, null, 0.09, 0.035 * v, i * 0.06));
        break;
    }
  }
}

export const sfx = new Sfx();
