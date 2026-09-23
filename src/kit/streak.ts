/**
 * Daily goal + streak for learning apps (stored as g92:<app>:daily).
 *
 *   const daily = createDaily('matematika', { goal: 20 });
 *   const r = daily.record();            // after each solved task → { today, goal, reachedNow, streak }
 *   if (r.reachedNow) { sfx.levelUp(); toast('Denní cíl splněn!'); }
 *   daily.streak();  daily.today();  daily.week();   // week(): last 7 days [{ date, count, done }]
 */
import { readJSON, writeJSON } from './storage';

export interface DailyData {
  goal: number;
  days: Record<string, number>;
  bestStreak: number;
}

export interface DailyRecordResult {
  today: number;
  goal: number;
  /** true exactly when this record crossed the goal */
  reachedNow: boolean;
  streak: number;
}

export interface Daily {
  record(n?: number, now?: Date): DailyRecordResult;
  today(now?: Date): number;
  goal(): number;
  setGoal(goal: number): void;
  /** consecutive practice days ending today (or yesterday, if today not practised yet) */
  streak(now?: Date): number;
  bestStreak(): number;
  week(now?: Date): { date: string; count: number; done: boolean; isToday: boolean }[];
  /** 0..1 of today's goal */
  todayProgress(now?: Date): number;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function createDaily(appId: string, opts: { goal?: number; keepDays?: number } = {}): Daily {
  const key = `g92:${appId}:daily`;
  const load = (): DailyData => {
    const d = readJSON<Partial<DailyData>>(key, {});
    return {
      goal: typeof d.goal === 'number' && d.goal > 0 ? d.goal : (opts.goal ?? 10),
      days: d.days && typeof d.days === 'object' ? d.days : {},
      bestStreak: typeof d.bestStreak === 'number' ? d.bestStreak : 0,
    };
  };
  const save = (d: DailyData) => {
    // prune old days
    const keep = opts.keepDays ?? 400;
    const keys = Object.keys(d.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - keep))) delete d.days[k];
    writeJSON(key, d);
  };
  const streakOf = (d: DailyData, now: Date) => {
    let day = now;
    if (!d.days[dayKey(day)]) day = addDays(now, -1);
    let n = 0;
    while (d.days[dayKey(day)]) {
      n++;
      day = addDays(day, -1);
    }
    return n;
  };

  return {
    record(n = 1, now = new Date()) {
      const d = load();
      const k = dayKey(now);
      const before = d.days[k] ?? 0;
      d.days[k] = before + n;
      const streak = streakOf(d, now);
      d.bestStreak = Math.max(d.bestStreak, streak);
      save(d);
      return { today: d.days[k], goal: d.goal, reachedNow: before < d.goal && d.days[k] >= d.goal, streak };
    },
    today: (now = new Date()) => load().days[dayKey(now)] ?? 0,
    goal: () => load().goal,
    setGoal(goal) {
      const d = load();
      d.goal = Math.max(1, Math.round(goal));
      save(d);
    },
    streak: (now = new Date()) => streakOf(load(), now),
    bestStreak: () => load().bestStreak,
    week(now = new Date()) {
      const d = load();
      return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(now, i - 6);
        const k = dayKey(day);
        const count = d.days[k] ?? 0;
        return { date: k, count, done: count >= d.goal, isToday: i === 6 };
      });
    },
    todayProgress(now = new Date()) {
      const d = load();
      return Math.min(1, (d.days[dayKey(now)] ?? 0) / d.goal);
    },
  };
}
