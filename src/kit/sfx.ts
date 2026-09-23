/**
 * Tiny WebAudio synth — no audio files. Respects g92 settings (sound on/off, volume).
 * The AudioContext is created lazily and unlocked on the first user gesture.
 *
 *   import { sfx } from './kit';
 *   sfx.tap(); sfx.success(); sfx.play('coin');
 *   sfx.countdown(); sfx.countdown(true) // final "go" beep
 *   sfx.tone({ freq: 440, dur: 0.2, type: 'triangle' })
 */
import { getSettings, subscribeSettings } from './settings';

export type SfxName = 'tap' | 'success' | 'error' | 'pop' | 'coin' | 'levelUp' | 'win' | 'lose' | 'whoosh' | 'countdown' | 'go' | 'click' | 'flip';

export interface ToneOptions {
  freq: number;
  /** end frequency for a glide */
  to?: number;
  /** seconds */
  dur?: number;
  type?: OscillatorType;
  /** 0..1 relative to master */
  gain?: number;
  /** seconds from now */
  delay?: number;
  attack?: number;
  release?: number;
  detune?: number;
}

type AC = AudioContext;
let ctx: AC | null = null;
let master: GainNode | null = null;
let unlocked = false;
let noiseBuf: AudioBuffer | null = null;

function getCtx(): AC | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  syncVolume();
  return ctx;
}

function syncVolume(): void {
  if (!master || !ctx) return;
  const s = getSettings();
  // perceptual curve
  const v = s.sound ? Math.pow(s.volume, 1.6) * 0.9 : 0;
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
}

subscribeSettings(syncVolume);

/** Resume the AudioContext (call from a user gesture; done automatically on first tap/key). */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  unlocked = true;
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio();
    if (unlocked) {
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
      window.removeEventListener('touchend', once, true);
    }
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
  window.addEventListener('touchend', once, true);
}

function ready(): AC | null {
  const s = getSettings();
  if (!s.sound || s.volume <= 0) return null;
  const c = getCtx();
  if (!c || !master) return null;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  return c;
}

/** Play one synthesized tone. */
export function tone(o: ToneOptions): void {
  const c = ready();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.15;
  const attack = o.attack ?? 0.005;
  const release = o.release ?? Math.min(0.12, dur * 0.6);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
  if (o.detune) osc.detune.value = o.detune;
  const peak = 0.35 * (o.gain ?? 1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(o: { dur: number; from: number; to: number; gain?: number; delay?: number; q?: number }): void {
  const c = ready();
  if (!c || !master) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = o.q ?? 1.2;
  bp.frequency.setValueAtTime(o.from, t0);
  bp.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const g = c.createGain();
  const peak = 0.5 * (o.gain ?? 1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + o.dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

const N = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
// handy notes
const C5 = N(3), E5 = N(7), G5 = N(10), C6 = N(15), E6 = N(19), G6 = N(22), C7 = N(27);

const effects: Record<SfxName, () => void> = {
  tap: () => tone({ freq: 720, to: 560, dur: 0.05, type: 'sine', gain: 0.45 }),
  click: () => tone({ freq: 1200, to: 900, dur: 0.03, type: 'triangle', gain: 0.35 }),
  pop: () => tone({ freq: 380, to: 980, dur: 0.09, type: 'sine', gain: 0.7, attack: 0.002 }),
  flip: () => {
    tone({ freq: 500, to: 800, dur: 0.06, type: 'triangle', gain: 0.4 });
    noise({ dur: 0.08, from: 1800, to: 3000, gain: 0.25 });
  },
  success: () => {
    tone({ freq: C6, dur: 0.1, type: 'triangle', gain: 0.6 });
    tone({ freq: E6, dur: 0.1, type: 'triangle', gain: 0.6, delay: 0.08 });
    tone({ freq: G6, dur: 0.22, type: 'triangle', gain: 0.6, delay: 0.16 });
    tone({ freq: G6 * 2, dur: 0.2, type: 'sine', gain: 0.15, delay: 0.16 });
  },
  error: () => {
    tone({ freq: 240, to: 200, dur: 0.14, type: 'triangle', gain: 0.8 });
    tone({ freq: 200, to: 150, dur: 0.2, type: 'triangle', gain: 0.8, delay: 0.13 });
  },
  coin: () => {
    tone({ freq: N(14), dur: 0.07, type: 'square', gain: 0.22 });
    tone({ freq: N(19), dur: 0.28, type: 'square', gain: 0.22, delay: 0.07 });
  },
  levelUp: () => {
    [C5, E5, G5, C6, E6].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', gain: 0.55, delay: i * 0.07 }));
    tone({ freq: G6, dur: 0.35, type: 'triangle', gain: 0.5, delay: 0.35 });
  },
  win: () => {
    const seq = [C5, E5, G5, C6];
    seq.forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.55, delay: i * 0.11 }));
    [C6, E6, G6].forEach((f) => tone({ freq: f, dur: 0.7, type: 'triangle', gain: 0.35, delay: 0.46, release: 0.4 }));
    tone({ freq: C7, dur: 0.6, type: 'sine', gain: 0.12, delay: 0.46 });
  },
  lose: () => {
    [G5, E5, C5].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.5, delay: i * 0.2 }));
    tone({ freq: N(-2), to: N(-7), dur: 0.55, type: 'triangle', gain: 0.5, delay: 0.6, release: 0.3 });
  },
  whoosh: () => noise({ dur: 0.35, from: 300, to: 2600, gain: 0.55, q: 0.8 }),
  countdown: () => tone({ freq: 660, dur: 0.14, type: 'square', gain: 0.18 }),
  go: () => {
    tone({ freq: 990, dur: 0.35, type: 'square', gain: 0.2 });
    tone({ freq: 1980, dur: 0.3, type: 'sine', gain: 0.1 });
  },
};

/** Throttle identical sounds fired in the same frame (e.g. 5 pops at once). */
const lastPlayed = new Map<SfxName, number>();

export function play(name: SfxName): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = lastPlayed.get(name) ?? -Infinity;
  if (now - last < 30) return;
  lastPlayed.set(name, now);
  try {
    effects[name]();
  } catch {
    /* audio is best-effort */
  }
}

export const sfx = {
  play,
  tone,
  unlock: unlockAudio,
  tap: () => play('tap'),
  click: () => play('click'),
  pop: () => play('pop'),
  flip: () => play('flip'),
  success: () => play('success'),
  error: () => play('error'),
  coin: () => play('coin'),
  levelUp: () => play('levelUp'),
  win: () => play('win'),
  lose: () => play('lose'),
  whoosh: () => play('whoosh'),
  /** countdown beep; pass true for the final "go" */
  countdown: (final = false) => play(final ? 'go' : 'countdown'),
  go: () => play('go'),
  /** true when sound is enabled in settings */
  get enabled(): boolean {
    return getSettings().sound;
  },
};

export type HapticName = 'tap' | 'success' | 'error' | 'heavy';
const HAPTICS: Record<HapticName, number | number[]> = { tap: 8, success: [12, 40, 18], error: [30, 50, 30], heavy: 40 };

/** Short vibration on devices that support it (Android). Follows the sound setting. */
export function haptic(kind: HapticName = 'tap'): void {
  if (!getSettings().sound) return;
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(HAPTICS[kind]);
  } catch {
    /* ignore */
  }
}
