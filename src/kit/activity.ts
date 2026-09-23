/**
 * Cross-app activity log read by the menu ("Pokračovat", per-app stats).
 * Key: `g92:activity` → { [appId]: ActivityEntry }.
 *
 *   recordActivity('tanky');                                     // on app start: "last opened"
 *   recordActivity('tanky', { metric: { label: 'Rekord', value: 1200 } });
 *   recordActivity('matematika', { progress: 0.4, note: 'Násobilka 7' });
 */
import { readJSON, writeJSON } from './storage';

export const ACTIVITY_KEY = 'g92:activity';

export interface ActivityMetric {
  /** Short Czech label, e.g. "Rekord", "Hotovo", "Slovíček". */
  label: string;
  /** Displayed as-is (numbers are formatted with cs-CZ separators by the menu). */
  value: number | string;
}

export interface ActivityEntry {
  /** ms epoch of the last recordActivity call */
  lastOpened: number;
  /** how many sessions were recorded (a new session = >30 min since last) */
  sessions: number;
  metric?: ActivityMetric;
  /** 0..1 overall progress */
  progress?: number;
  /** free text like "Úroveň 3" or "Násobilka 7" */
  note?: string;
}

export type ActivityMap = Record<string, ActivityEntry>;

export interface ActivityUpdate {
  metric?: ActivityMetric | null;
  progress?: number | null;
  note?: string | null;
}

const SESSION_GAP = 30 * 60 * 1000;
type Listener = (all: ActivityMap) => void;
const listeners = new Set<Listener>();

export function getActivity(): ActivityMap;
export function getActivity(appId: string): ActivityEntry | undefined;
export function getActivity(appId?: string): ActivityMap | ActivityEntry | undefined {
  const all = readJSON<ActivityMap>(ACTIVITY_KEY, {});
  const safe: ActivityMap = all && typeof all === 'object' ? all : {};
  return appId === undefined ? safe : safe[appId];
}

export function recordActivity(appId: string, update: ActivityUpdate = {}, now: number = Date.now()): ActivityEntry {
  const all = getActivity();
  const prev = all[appId];
  const entry: ActivityEntry = {
    lastOpened: now,
    sessions: (prev?.sessions ?? 0) + (!prev || now - prev.lastOpened > SESSION_GAP ? 1 : 0),
  };
  const metric = update.metric === undefined ? prev?.metric : update.metric ?? undefined;
  const progress = update.progress === undefined ? prev?.progress : update.progress ?? undefined;
  const note = update.note === undefined ? prev?.note : update.note ?? undefined;
  if (metric) entry.metric = { label: String(metric.label), value: metric.value };
  if (typeof progress === 'number' && Number.isFinite(progress)) entry.progress = Math.min(1, Math.max(0, progress));
  if (note) entry.note = String(note).slice(0, 80);
  all[appId] = entry;
  writeJSON(ACTIVITY_KEY, all);
  for (const fn of [...listeners]) fn(all);
  return entry;
}

export function clearActivity(appId?: string): void {
  if (appId === undefined) writeJSON(ACTIVITY_KEY, {});
  else {
    const all = getActivity();
    delete all[appId];
    writeJSON(ACTIVITY_KEY, all);
  }
  const all = getActivity();
  for (const fn of [...listeners]) fn(all);
}

/** App ids sorted by most recent use. */
export function recentApps(limit = 4): { id: string; entry: ActivityEntry }[] {
  return Object.entries(getActivity())
    .filter(([, e]) => e && typeof e.lastOpened === 'number')
    .sort((a, b) => b[1].lastOpened - a[1].lastOpened)
    .slice(0, limit)
    .map(([id, entry]) => ({ id, entry }));
}

export function subscribeActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVITY_KEY || e.key === null) {
      const all = getActivity();
      for (const fn of [...listeners]) fn(all);
    }
  });
}

/** Czech relative time: "právě teď", "před 5 minutami", "včera", "před 3 dny", "před 2 týdny"… */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return min === 1 ? 'před minutou' : `před ${min} minutami`;
  const h = Math.floor(min / 60);
  const today = new Date(now);
  const then = new Date(ts);
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(today) - dayStart(then)) / 86400000);
  if (days === 0) return h === 1 ? 'před hodinou' : `před ${h} hodinami`;
  if (days === 1) return 'včera';
  if (days < 7) return `před ${days} dny`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? 'před týdnem' : `před ${weeks} týdny`;
  const months = Math.floor(days / 30);
  if (days < 365) return months === 1 ? 'před měsícem' : `před ${months} měsíci`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'před rokem' : `před ${years} lety`;
}

/** Compact variant for tight spots: "teď", "před 5 min", "před 3 h", "včera", "před 4 dny", "12. 9." */
export function timeAgoShort(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'teď';
  if (min < 60) return `před ${min} min`;
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(new Date(now)) - dayStart(new Date(ts))) / 86400000);
  if (days === 0) return `před ${Math.floor(min / 60)} h`;
  if (days === 1) return 'včera';
  if (days < 7) return `před ${days} dny`;
  const d = new Date(ts);
  return d.getFullYear() === new Date(now).getFullYear() ? `${d.getDate()}. ${d.getMonth() + 1}.` : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

/** Format a metric value for display (cs-CZ thousands separators). */
export function formatMetric(value: number | string): string {
  return typeof value === 'number' ? value.toLocaleString('cs-CZ') : value;
}
