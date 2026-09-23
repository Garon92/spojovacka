/**
 * Leaving an app ("Menu") — one behaviour for the whole family.
 *
 * - <g92-appbar>'s "Menu" dispatches a cancelable `g92-back` event, then asks the leave guard, then navigates.
 * - While a game / lesson / exam is running the app registers a guard:
 *
 *     const off = guardLeave({ isActive: () => game.running, onPause: () => game.pause() });
 *     // → "Odejít do menu? Rozehraná hra se neuloží." with "Zůstat" focused; "Odejít" leaves.
 *
 *   or low-level: setLeaveGuard(() => boolean | Promise<boolean>)   (true = may leave)
 * - Navigation: if the user came from /menu/ (same-origin), we go BACK in history instead of pushing a new
 *   entry, so the system Back button doesn't loop menu ↔ app. Installed apps (standalone PWA, launched
 *   directly) hide the "Menu" link — /menu/ is outside their scope.
 * - goToMenu() does the same for your own "Menu" buttons (overlays use it).
 */
import { openDialog } from './dialog';
import { UI_ICONS } from './dom';
import { LABELS } from './labels';

export type LeaveGuard = () => boolean | Promise<boolean>;

let guard: LeaveGuard | null = null;
let unloadGuard: (() => boolean) | null = null;
/** set right before we navigate away ourselves, so beforeunload doesn't ask a second time */
let leaving = false;
const MENU_PATH = '/menu/';
const FROM_MENU = 'g92FromMenu';

/** Register (or clear with null) the leave guard. Returns an unregister function. */
export function setLeaveGuard(fn: LeaveGuard | null): () => void {
  guard = fn;
  return () => {
    if (guard === fn) guard = null;
  };
}

export interface ConfirmLeaveOptions {
  title?: string;
  message?: string;
  stayLabel?: string;
  leaveLabel?: string;
}

/** The standard "Odejít do menu?" dialog. Resolves true when the user chooses to leave. */
export async function confirmLeave(o: ConfirmLeaveOptions = {}): Promise<boolean> {
  const d = openDialog({
    title: o.title ?? 'Odejít do menu?',
    icon: UI_ICONS.grid,
    kind: 'confirm-leave',
    content: `<p class="g92-muted">${escapeHTML(o.message ?? 'Rozehraná hra se neuloží.')}</p>`,
    dismissValue: 'stay',
    actions: [
      { label: o.leaveLabel ?? LABELS.leave, value: 'leave', variant: 'secondary' },
      { label: o.stayLabel ?? LABELS.stay, value: 'stay', variant: 'primary', autofocus: true, icon: UI_ICONS.play },
    ],
  });
  return (await d.closed) === 'leave';
}

export interface GuardLeaveOptions extends ConfirmLeaveOptions {
  /** is a game / session running right now? (no dialog when false) */
  isActive: () => boolean;
  /** pause the game before asking */
  onPause?: () => void;
  /** user chose to stay (resume or leave your pause overlay up) */
  onStay?: () => void;
  /** user chose to leave (save partial progress here) */
  onLeave?: () => void;
  /** also ask the browser on reload / tab close / system Back to another page (default true) */
  beforeUnload?: boolean;
}

/** High-level guard: pause + confirm while active. Returns an unregister function. */
export function guardLeave(o: GuardLeaveOptions): () => void {
  const fn: LeaveGuard = async () => {
    if (!o.isActive()) return true;
    o.onPause?.();
    const leave = await confirmLeave(o);
    if (leave) o.onLeave?.();
    else o.onStay?.();
    return leave;
  };
  const offGuard = setLeaveGuard(fn);
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (leaving || !o.isActive()) return;
    e.preventDefault();
    e.returnValue = '';
  };
  const useUnload = o.beforeUnload ?? true;
  if (useUnload && typeof window !== 'undefined') window.addEventListener('beforeunload', onBeforeUnload);
  unloadGuard = o.isActive;
  return () => {
    offGuard();
    if (useUnload && typeof window !== 'undefined') window.removeEventListener('beforeunload', onBeforeUnload);
    if (unloadGuard === o.isActive) unloadGuard = null;
  };
}

/** True when a guard is registered and says the app is busy. */
export function isLeaveGuarded(): boolean {
  return Boolean(unloadGuard?.());
}

/** Ask the registered guard. true = may leave. */
export async function canLeave(): Promise<boolean> {
  if (!guard) return true;
  try {
    return await guard();
  } catch {
    return true;
  }
}

/** Installed app launched on its own (standalone/fullscreen PWA window). */
export function isStandalone(): boolean {
  if (typeof matchMedia !== 'function') return false;
  try {
    return (
      matchMedia('(display-mode: standalone)').matches ||
      matchMedia('(display-mode: fullscreen)').matches ||
      matchMedia('(display-mode: minimal-ui)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Did the user arrive at this page from the family menu (same tab)? */
export function cameFromMenu(): boolean {
  try {
    return (history.state as Record<string, unknown> | null)?.[FROM_MENU] === true;
  } catch {
    return false;
  }
}

/** Show the "Menu" link? Hidden in an installed app that wasn't opened from the menu (out of scope). */
export function menuLinkAvailable(): boolean {
  return !isStandalone() || cameFromMenu();
}

interface NavEntry {
  url: string;
  key: string;
  index: number;
}
interface NavApi {
  currentEntry: NavEntry | null;
  entries(): NavEntry[];
  traverseTo(key: string): unknown;
}

/**
 * Navigate to the menu (or `href`) the family way: guard → history back when we came from the menu →
 * otherwise a normal navigation. Pass { skipGuard: true } from an explicit "Menu" choice (pause/results).
 */
export async function goToMenu(opts: { href?: string; skipGuard?: boolean } = {}): Promise<boolean> {
  if (!opts.skipGuard && !(await canLeave())) return false;
  leaving = true;
  const href = opts.href ?? MENU_PATH;
  const target = new URL(href, location.href);
  if (target.origin === location.origin && target.pathname === MENU_PATH) {
    // Navigation API: jump back to the exact menu entry, even after in-app (pushState) navigation
    const nav = (globalThis as { navigation?: NavApi }).navigation;
    const cur = nav?.currentEntry;
    if (nav && cur) {
      const entries = nav.entries();
      for (let i = cur.index - 1; i >= 0; i--) {
        const e = entries[i];
        if (!e) break;
        const u = new URL(e.url);
        if (u.origin !== location.origin) break;
        if (u.pathname === MENU_PATH) {
          nav.traverseTo(e.key);
          return true;
        }
        // stop at another app: only skip entries of this app
        if (!u.pathname.startsWith(appRoot())) break;
      }
    }
    if (cameFromMenu() && history.length > 1) {
      history.back();
      return true;
    }
  }
  location.href = target.href;
  return true;
}

function appRoot(): string {
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return seg ? `/${seg}/` : '/';
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// ---- mark the landing entry when we arrived from the menu -----------------------------------------
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === location.origin && ref.pathname.startsWith(MENU_PATH) && !location.pathname.startsWith(MENU_PATH)) {
      const state = (history.state && typeof history.state === 'object' ? history.state : {}) as Record<string, unknown>;
      if (state[FROM_MENU] !== true) history.replaceState({ ...state, [FROM_MENU]: true }, '');
    }
  } catch {
    /* sandboxed / opaque origin */
  }
  window.addEventListener('pageshow', () => {
    leaving = false;
  });
}
