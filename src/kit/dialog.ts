/**
 * Modal dialogs on top of native <dialog> (showModal = real focus trap + inert page).
 *
 *   const d = openDialog({ title: 'Nápověda', content: '<p>…</p>', actions: [{ label: 'Rozumím' }] });
 *   await d.closed;
 *   if (await confirmDialog({ title: 'Smazat postup?', message: 'Nejde to vrátit.', danger: true })) …
 *   await alertDialog({ title: 'Hotovo!', message: 'Uloženo.' });
 *   openSettingsDialog();  // global g92 settings (sound, volume, theme, motion, name)
 */
import { UI_ICONS, bindRange, h } from './dom';
import { getSettings, setSettings, subscribeSettings, type MotionSetting, type ThemeSetting } from './settings';
import { sfx } from './sfx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';

export interface DialogAction {
  label: string;
  /** value the dialog resolves with (default: label) */
  value?: string;
  variant?: ButtonVariant;
  autofocus?: boolean;
  /** icon SVG string shown before the label */
  icon?: string;
  /** return false to keep the dialog open */
  onClick?: (close: (value?: string) => void) => void | boolean;
}

export interface DialogOptions {
  title?: string;
  /** HTML string (trusted) or a Node */
  content?: string | Node;
  actions?: DialogAction[];
  /** Esc / backdrop / × close it (default true) */
  dismissible?: boolean;
  wide?: boolean;
  className?: string;
  /** SVG shown in an accent tile before the title */
  icon?: string;
  /** value used when dismissed via Esc/backdrop/× (default undefined) */
  dismissValue?: string;
  onOpen?: (dialog: HTMLDialogElement) => void;
  onClose?: (value: string | undefined) => void;
}

export interface DialogHandle {
  el: HTMLDialogElement;
  body: HTMLElement;
  close(value?: string): void;
  /** resolves with the chosen action value (or dismissValue) */
  closed: Promise<string | undefined>;
}

const btnClass = (v: ButtonVariant = 'primary') => `g92-btn${v === 'primary' ? '' : ` g92-btn--${v}`}`;

export function openDialog(opts: DialogOptions): DialogHandle {
  const dismissible = opts.dismissible ?? true;
  const titleId = `g92-dlg-${Math.random().toString(36).slice(2, 8)}`;
  const el = h('dialog', {
    class: `g92-dialog${opts.wide ? ' g92-dialog--wide' : ''}${opts.className ? ` ${opts.className}` : ''}`,
    'aria-labelledby': opts.title ? titleId : null,
  }) as HTMLDialogElement;

  const body = h('div', { class: 'g92-dialog__body' });
  if (typeof opts.content === 'string') body.innerHTML = opts.content;
  else if (opts.content) body.append(opts.content);

  let resolve!: (v: string | undefined) => void;
  const closed = new Promise<string | undefined>((r) => (resolve = r));
  let done = false;
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const close = (value?: string) => {
    if (done) return;
    done = true;
    el.classList.add('is-closing');
    const finish = () => {
      try {
        el.close();
      } catch {
        /* already closed */
      }
      el.remove();
      previouslyFocused?.focus?.({ preventScroll: true });
      opts.onClose?.(value);
      resolve(value);
    };
    const reduce = getComputedStyle(document.documentElement).getPropertyValue('--g92-motion').trim() === '0';
    if (reduce) finish();
    else {
      let finished = false;
      const once = () => {
        if (finished) return;
        finished = true;
        finish();
      };
      el.addEventListener('animationend', once, { once: true });
      setTimeout(once, 260);
    }
  };

  if (opts.title || dismissible) {
    const head = h('div', { class: 'g92-dialog__head' });
    if (opts.icon) head.append(h('span', { class: 'g92-icon-tile', html: opts.icon, 'aria-hidden': 'true' }));
    head.append(h('h2', { class: 'g92-dialog__title', id: titleId }, opts.title ?? ''));
    if (dismissible) {
      head.append(
        h('button', {
          type: 'button',
          class: 'g92-btn g92-btn--ghost g92-btn--icon',
          'aria-label': 'Zavřít',
          html: UI_ICONS.close,
          onclick: () => close(opts.dismissValue),
        }),
      );
    }
    el.append(head);
  }
  el.append(body);

  if (opts.actions?.length) {
    const foot = h('div', { class: 'g92-dialog__foot' });
    for (const a of opts.actions) {
      const b = h('button', { type: 'button', class: btnClass(a.variant), autofocus: a.autofocus ?? false });
      if (a.icon) b.insertAdjacentHTML('beforeend', a.icon);
      b.append(a.label);
      b.addEventListener('click', () => {
        const keep = a.onClick?.(close) === false;
        if (!keep && !done) close(a.value ?? a.label);
      });
      foot.append(b);
    }
    el.append(foot);
  }

  let openedAt = Infinity;
  el.addEventListener('cancel', (e) => {
    e.preventDefault();
    // the Escape keydown that opened this dialog must not immediately close it again
    if (performance.now() - openedAt < 150) return;
    if (dismissible) close(opts.dismissValue);
  });
  el.addEventListener('click', (e) => {
    if (!dismissible || e.target !== el) return;
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close(opts.dismissValue);
  });

  document.body.append(el);
  const show = () => {
    if (done || !el.isConnected) return;
    el.showModal();
    openedAt = performance.now();
    // no explicit autofocus → focus the dialog itself (not the × button, which would show a focus ring)
    if (!el.querySelector('[autofocus]')) {
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
    opts.onOpen?.(el);
  };
  // Opened from inside a keydown handler (e.g. Esc → "Opravdu odejít?"): the same key event would reach the
  // new modal dialog and fire `cancel` right away — show it after the event has finished dispatching.
  const current = (globalThis as { event?: Event }).event;
  if (current && current.type === 'keydown') setTimeout(show, 0);
  else show();
  return { el, body, close, closed };
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
}

export async function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  const d = openDialog({
    title: o.title,
    icon: o.icon,
    content: o.message ? h('p', { class: 'g92-muted' }, o.message) : undefined,
    dismissValue: 'cancel',
    actions: [
      { label: o.cancelLabel ?? 'Zrušit', value: 'cancel', variant: 'secondary' },
      { label: o.confirmLabel ?? 'Ano', value: 'ok', variant: o.danger ? 'danger' : 'primary', autofocus: true },
    ],
  });
  return (await d.closed) === 'ok';
}

export async function alertDialog(o: { title: string; message?: string; okLabel?: string; icon?: string }): Promise<void> {
  const d = openDialog({
    title: o.title,
    icon: o.icon,
    content: o.message ? h('p', { class: 'g92-muted' }, o.message) : undefined,
    actions: [{ label: o.okLabel ?? 'OK', autofocus: true }],
  });
  await d.closed;
}

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------

export interface SettingsDialogOptions {
  /** extra app-specific section appended at the end */
  extra?: Node;
  /** hide the name field (e.g. apps that never show it) */
  hideName?: boolean;
  /** heading override */
  title?: string;
}

function segmented<T extends string>(name: string, label: string, value: T, options: { value: T; label: string; icon?: string }[], onChange: (v: T) => void): HTMLElement {
  const group = h('div', { class: 'g92-segmented g92-segmented--block', role: 'radiogroup', 'aria-label': label });
  for (const o of options) {
    const input = h('input', { type: 'radio', name, value: o.value }) as HTMLInputElement;
    input.checked = o.value === value;
    input.addEventListener('change', () => input.checked && onChange(o.value));
    const span = h('span', { html: (o.icon ?? '') + `<span>${o.label}</span>` });
    group.append(h('label', null, input, span));
  }
  return h('div', { class: 'g92-field' }, h('span', { class: 'g92-label' }, label), group);
}

let settingsOpen: DialogHandle | null = null;

export function openSettingsDialog(opts: SettingsDialogOptions = {}): DialogHandle {
  if (settingsOpen) return settingsOpen;
  const s = getSettings();
  const uid = Math.random().toString(36).slice(2, 7);

  // sound
  const soundToggle = h('input', { type: 'checkbox', class: 'g92-toggle', role: 'switch', id: `g92-snd-${uid}` }) as HTMLInputElement;
  soundToggle.checked = s.sound;
  const volume = h('input', {
    type: 'range',
    class: 'g92-range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(s.volume * 100),
    'aria-label': 'Hlasitost',
  }) as HTMLInputElement;
  volume.disabled = !s.sound;
  bindRange(volume);
  soundToggle.addEventListener('change', () => {
    setSettings({ sound: soundToggle.checked });
    volume.disabled = !soundToggle.checked;
    if (soundToggle.checked) sfx.pop();
  });
  let volTimer = 0;
  volume.addEventListener('input', () => {
    setSettings({ volume: Number(volume.value) / 100 });
    clearTimeout(volTimer);
    volTimer = window.setTimeout(() => sfx.tap(), 60);
  });

  const soundSection = h(
    'div',
    { class: 'g92-field' },
    h('label', { class: 'g92-switch-row', for: `g92-snd-${uid}` }, h('span', { class: 'g92-label' }, 'Zvuky'), soundToggle),
    h('div', { class: 'g92-row', style: 'gap: var(--g92-space-3)' }, h('span', { html: UI_ICONS.soundOff, class: 'g92-muted', style: 'width:22px;flex:none' }), volume, h('span', { html: UI_ICONS.soundOn, class: 'g92-muted', style: 'width:22px;flex:none' })),
  );

  const theme = segmented<ThemeSetting>(`g92-theme-${uid}`, 'Vzhled', s.theme, [
    { value: 'auto', label: 'Auto', icon: UI_ICONS.auto },
    { value: 'light', label: 'Světlý', icon: UI_ICONS.sun },
    { value: 'dark', label: 'Tmavý', icon: UI_ICONS.moon },
  ], (v) => setSettings({ theme: v }));

  const motion = segmented<MotionSetting>(`g92-motion-${uid}`, 'Animace (Auto = podle zařízení)', s.reducedMotion, [
    { value: 'auto', label: 'Auto' },
    { value: 'on', label: 'Méně' },
    { value: 'off', label: 'Všechny' },
  ], (v) => setSettings({ reducedMotion: v }));

  const content = h('div', { class: 'g92-stack', style: '--g92-gap: var(--g92-space-5)' }, soundSection, theme, motion);

  if (!opts.hideName) {
    const name = h('input', {
      type: 'text',
      class: 'g92-input',
      id: `g92-name-${uid}`,
      maxlength: 40,
      autocomplete: 'nickname',
      placeholder: 'Jak ti máme říkat?',
      value: s.playerName,
    }) as HTMLInputElement;
    name.addEventListener('input', () => setSettings({ playerName: name.value.trim() }));
    content.append(h('div', { class: 'g92-field' }, h('label', { class: 'g92-label', for: `g92-name-${uid}` }, 'Jméno hráče'), name));
  }
  if (opts.extra) content.append(opts.extra);
  content.append(h('p', { class: 'g92-hint' }, 'Nastavení platí pro všechny hry a cvičení.'));

  // keep controls in sync if settings change elsewhere (other tab, appbar sound button)
  const off = subscribeSettings((n) => {
    soundToggle.checked = n.sound;
    volume.disabled = !n.sound;
  });

  settingsOpen = openDialog({
    title: opts.title ?? 'Nastavení',
    icon: UI_ICONS.settings,
    content,
    actions: [{ label: 'Hotovo', autofocus: false }],
    onClose: () => {
      off();
      settingsOpen = null;
    },
  });
  return settingsOpen;
}
