/**
 * Toasts — short, non-blocking messages at the TOP of the screen, just below <g92-appbar>.
 * They never catch taps (only an action button is clickable), so they can't cover bottom navigation or
 * primary buttons. Shown above open dialogs too (popover top layer where supported).
 *
 *   toast('Uloženo');
 *   toast('Nový rekord!', { variant: 'success', icon: UI_ICONS.trophy, duration: 3000 });
 *   toast('Je k dispozici nová verze.', { action: { label: 'Obnovit', onClick: () => location.reload() } });
 *
 * Extra offset (e.g. an app toolbar under the appbar): :root { --g92-toast-offset: 56px }
 */
import { h } from './dom';

export type ToastVariant = 'default' | 'success' | 'danger' | 'accent';

export interface ToastOptions {
  variant?: ToastVariant;
  /** ms; 0 = stays until dismissed via the returned function */
  duration?: number;
  /** SVG string */
  icon?: string;
  /** optional button inside the toast (e.g. "Obnovit" for PWA updates). Default duration becomes 8 s. */
  action?: { label: string; onClick: () => void };
}

let region: HTMLElement | null = null;

function supportsPopover(): boolean {
  return typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
}

function getRegion(): HTMLElement {
  if (!region || !region.isConnected) {
    region = h('div', { class: 'g92-toasts', role: 'status', 'aria-live': 'polite' });
    if (supportsPopover()) region.setAttribute('popover', 'manual');
    document.body.append(region);
  }
  // (re)enter the top layer so the toast sits above a dialog opened after the region
  if (supportsPopover()) {
    try {
      if (region.matches(':popover-open')) region.hidePopover();
      region.showPopover();
    } catch {
      /* not supported */
    }
  }
  return region;
}

/** Show a toast; returns a function that dismisses it. */
export function toast(message: string, opts: ToastOptions = {}): () => void {
  const el = h('div', { class: `g92-toast${opts.variant && opts.variant !== 'default' ? ` g92-toast--${opts.variant}` : ''}` });
  if (opts.icon) el.append(h('span', { html: opts.icon, class: 'g92-toast__icon' }));
  el.append(h('span', { class: 'g92-toast__msg' }, message));
  let gone = false;
  function dismiss(): void {
    if (gone) return;
    gone = true;
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      if (region && !region.childElementCount && supportsPopover()) {
        try {
          region.hidePopover();
        } catch {
          /* ignore */
        }
      }
    }, 200);
  }
  if (opts.action) {
    const { label, onClick } = opts.action;
    const btn = h('button', { type: 'button', class: 'g92-toast__action' }, label);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
      dismiss();
    });
    el.append(btn);
  }
  const r = getRegion();
  r.append(el);
  while (r.children.length > 3) r.firstElementChild?.remove();
  const duration = opts.duration ?? (opts.action ? 8000 : 2600);
  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}
