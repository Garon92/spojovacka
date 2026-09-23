/**
 * Reset an app completely — every app's "Smazat postup / Smazat všechna data" button must use this, so the
 * menu doesn't keep showing "Pokračovat" or daily counts for data that no longer exists.
 *
 *   if (await confirmDialog({ title: 'Smazat postup?', message: '…', danger: true })) { resetApp('cestina'); location.reload(); }
 */
import { clearActivity } from './activity';
import { safeStorage } from './storage';

/** Keys that describe the device, not the user's progress — kept on reset. */
const KEEP = new Set(['offline']);

/** Remove all `g92:<appId>:*` keys (store, daily goal/streak, per-app name…) and the app's menu activity. Returns removed keys. */
export function resetApp(appId: string, opts: { keep?: string[] } = {}): string[] {
  const prefix = `g92:${appId}:`;
  const keep = new Set([...KEEP, ...(opts.keep ?? [])]);
  const removed: string[] = [];
  for (const key of safeStorage.keys(prefix)) {
    if (keep.has(key.slice(prefix.length))) continue;
    safeStorage.removeItem(key);
    removed.push(key);
  }
  clearActivity(appId);
  return removed;
}

/** Alias (QA naming). */
export const resetAppData = resetApp;
