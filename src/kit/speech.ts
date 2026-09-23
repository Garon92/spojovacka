/**
 * Speech helper with the family rule:
 *  - automatic speech (reading a task aloud when it appears) follows the `voice` setting ("Předčítání"),
 *  - speech the user asked for (tapping 🔊 / "Poslechnout") ALWAYS speaks — even with sound effects off.
 *
 *   speak('Kolik je dva plus tři?', { auto: true });   // only when Předčítání is on
 *   speak('kapr', { lang: 'cs-CZ' });                  // tapped → always
 */
import { getSettings } from './settings';

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  /** automatic (not user-initiated) speech → respects settings.voice */
  auto?: boolean;
  /** cancel what is being said (default true) */
  interrupt?: boolean;
}

/** May the app speak on its own right now? */
export function canAutoSpeak(): boolean {
  return getSettings().voice;
}

/** Speak text; returns false when skipped (auto + voice off) or unsupported. */
export function speak(text: string, o: SpeakOptions = {}): boolean {
  if (o.auto && !canAutoSpeak()) return false;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try {
    if (o.interrupt ?? true) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = o.lang ?? 'cs-CZ';
    u.rate = o.rate ?? 0.95;
    u.pitch = o.pitch ?? 1;
    u.volume = Math.max(0.2, getSettings().volume);
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
    if (voice) u.voice = voice;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
