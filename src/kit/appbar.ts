/**
 * <g92-appbar> — the shared top bar of every g92 app.
 *
 *   <g92-appbar app="tanky" fullscreen help>
 *     <button slot="actions" class="g92-btn g92-btn--ghost g92-btn--icon" aria-label="Pauza">…</button>
 *   </g92-appbar>
 *
 * Attributes
 *   app          app id from apps.ts (name, icon, accent)            required
 *   heading      title override (default: app name)
 *   back         href of the back link (default "/menu/"; "none" hides it; hidden for app="menu")
 *   back-label   text of the back link (default "Menu")
 *   fullscreen   show a fullscreen toggle; value may be a CSS selector of the element to fullscreen
 *   help         show a "?" button → dispatches `g92-help` (cancelable); default opens setHelp() content
 *   no-sound     hide the sound toggle
 *   no-settings  hide the settings button
 *   no-accent    don't set --accent on :root from the registry
 *   no-activity  don't record "last opened" in activity.ts
 *   transparent  no background/border (for heroes / game screens)
 * Slots
 *   actions      extra buttons, placed before the built-in ones
 *   title        replaces the icon + title block
 *   start        after the back link (e.g. a breadcrumb)
 * Events (bubbling, composed)
 *   g92-help (cancelable)       help button pressed; default: showHelp() if setHelp() was used
 *   g92-settings (cancelable)   settings pressed; preventDefault() to show your own UI
 *   g92-fullscreen              detail: { active: boolean }
 * CSS parts: bar, back, title, icon, name, actions, button
 */
import { recordActivity } from './activity';
import { applyAccent, getApp } from './apps';
import { openSettingsDialog } from './dialog';
import { getHelp, showHelp, syncAppbarHelp } from './help';
import { UI_ICONS } from './dom';
import { getSettings, resolvedTheme, setSettings, subscribeSettings } from './settings';
import { sfx } from './sfx';

const STYLE = /* css */ `
:host {
  display: block;
  position: sticky;
  top: 0;
  z-index: var(--g92-z-appbar, 100);
  font-family: var(--g92-font, system-ui, sans-serif);
  color: var(--g92-text, #161a2e);
  -webkit-user-select: none;
  user-select: none;
}
:host([hidden]) { display: none; }
.bar {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  height: calc(var(--g92-appbar-h, 60px) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) max(10px, env(safe-area-inset-right, 0px)) 0 max(10px, env(safe-area-inset-left, 0px));
  background: var(--g92-surface-glass, rgb(255 255 255 / .75));
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  backdrop-filter: blur(16px) saturate(1.5);
  border-bottom: 1px solid var(--g92-border, rgb(0 0 0 / .1));
}
:host([transparent]) .bar {
  background: transparent;
  border-bottom-color: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
a, button {
  -webkit-tap-highlight-color: transparent;
  font: inherit;
  color: inherit;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 14px 0 8px;
  border-radius: var(--g92-radius-pill, 999px);
  text-decoration: none;
  font-weight: var(--g92-fw-bold, 700);
  font-size: var(--g92-fs-sm, .875rem);
  color: var(--g92-text-muted, #595f7a);
  background: var(--g92-surface-2, #f1f3f9);
  border: 1px solid var(--g92-border, rgb(0 0 0 / .08));
  flex: none;
  transition: background-color var(--g92-dur-2, .16s), color var(--g92-dur-2, .16s), transform var(--g92-dur-2, .16s) var(--g92-ease-spring, ease);
}
.back > span[aria-hidden] { display: grid; place-items: center; }
.back svg { width: 20px; height: 20px; display: block; }
.back:hover { color: var(--g92-text, #161a2e); background: var(--g92-surface-3, #e5e8f2); }
.back:active { transform: scale(.96); }
.title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
  padding-left: 4px;
}
.icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, color-mix(in oklab, var(--accent, #6d5dfc) 78%, #fff), var(--accent, #6d5dfc));
  box-shadow: inset 0 -2px 0 rgb(0 0 0 / .14), 0 2px 8px -2px var(--accent-glow, transparent);
}
.icon svg { width: 22px; height: 22px; filter: drop-shadow(0 1px 1px rgb(0 0 0 / .18)); }
.icon:empty { display: none; }
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--g92-fs-lg, 1.125rem);
  font-weight: var(--g92-fw-black, 900);
  letter-spacing: -.01em;
  line-height: 1.2;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--g92-text-muted, #595f7a);
  cursor: pointer;
  transition: background-color var(--g92-dur-2, .16s), color var(--g92-dur-2, .16s), transform var(--g92-dur-2, .16s) var(--g92-ease-spring, ease);
}
.btn svg { width: 24px; height: 24px; }
.btn:hover { background: var(--g92-surface-2, #f1f3f9); color: var(--g92-text, #161a2e); }
.btn:active { transform: scale(.92); }
.btn[aria-pressed="false"].sound { color: var(--g92-text-subtle, #858aa3); }
a:focus-visible, button:focus-visible {
  outline: 3px solid var(--g92-focus, #6d5dfc);
  outline-offset: 2px;
}
a:focus:not(:focus-visible), button:focus:not(:focus-visible) { outline: none; }
[hidden] { display: none !important; }
::slotted([slot="actions"]) { flex: none; }
::slotted([slot="title"]) { flex: 1 1 auto; min-width: 0; }
.btn svg, .icon svg { display: block; }
@media (max-width: 479px) {
  .back .label { display: none; }
  .back { width: 44px; padding: 0; justify-content: center; }
  .name { font-size: var(--g92-fs-md, 1rem); }
  .icon { width: 34px; height: 34px; border-radius: 11px; }
  .icon svg { width: 20px; height: 20px; }
}
@media (max-width: 359px) {
  .icon { display: none; }
}
`;

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

function fsElement(): Element | null {
  const d = document as FsDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function fsEnabled(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export class G92Appbar extends HTMLElement {
  static observedAttributes = ['app', 'heading', 'back', 'back-label', 'fullscreen', 'help', 'no-sound', 'no-settings', 'no-accent'];

  #root: ShadowRoot;
  #els: {
    back: HTMLAnchorElement;
    backLabel: HTMLElement;
    icon: HTMLElement;
    name: HTMLElement;
    help: HTMLButtonElement;
    sound: HTMLButtonElement;
    fs: HTMLButtonElement;
    settings: HTMLButtonElement;
  };
  #offSettings: (() => void) | null = null;
  #recorded = false;
  #onFsChange = () => {
    this.#renderFs();
    this.dispatchEvent(new CustomEvent('g92-fullscreen', { bubbles: true, composed: true, detail: { active: Boolean(fsElement()) } }));
  };

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${STYLE}</style>
<header class="bar" part="bar">
  <a class="back" part="back" href="/menu/"><span aria-hidden="true">${UI_ICONS.back}</span><span class="label">Menu</span></a>
  <slot name="start"></slot>
  <slot name="title"><div class="title" part="title"><span class="icon" part="icon" aria-hidden="true"></span><span class="name" part="name"></span></div></slot>
  <div class="actions" part="actions">
    <slot name="actions"></slot>
    <button class="btn help" part="button" type="button" aria-label="Jak na to" title="Jak na to" hidden>${UI_ICONS.help}</button>
    <button class="btn sound" part="button" type="button" aria-label="Zvuk" title="Zvuk"></button>
    <button class="btn fs" part="button" type="button" aria-label="Celá obrazovka" title="Celá obrazovka" hidden>${UI_ICONS.fullscreen}</button>
    <button class="btn settings" part="button" type="button" aria-label="Nastavení" title="Nastavení">${UI_ICONS.settings}</button>
  </div>
</header>`;
    const q = <T extends Element>(s: string) => this.#root.querySelector(s) as T;
    this.#els = {
      back: q('.back'),
      backLabel: q('.back .label'),
      icon: q('.icon'),
      name: q('.name'),
      help: q('.help'),
      sound: q('.sound'),
      fs: q('.fs'),
      settings: q('.settings'),
    };
    this.#els.help.addEventListener('click', () => {
      sfx.tap();
      const ev = new CustomEvent('g92-help', { bubbles: true, composed: true, cancelable: true });
      // default action: show content registered with setHelp() (help.ts)
      if (this.dispatchEvent(ev) && getHelp()) showHelp();
    });
    this.#els.sound.addEventListener('click', () => {
      const on = !getSettings().sound;
      setSettings({ sound: on });
      if (on) sfx.pop();
    });
    this.#els.fs.addEventListener('click', () => void this.toggleFullscreen());
    this.#els.settings.addEventListener('click', () => {
      sfx.tap();
      const ev = new CustomEvent('g92-settings', { bubbles: true, composed: true, cancelable: true });
      if (this.dispatchEvent(ev)) openSettingsDialog();
    });
  }

  connectedCallback(): void {
    syncAppbarHelp(this);
    this.#render();
    this.#renderSound();
    this.#offSettings ??= subscribeSettings(() => {
      this.#renderSound();
      this.#syncThemeColor();
    });
    document.addEventListener('fullscreenchange', this.#onFsChange);
    document.addEventListener('webkitfullscreenchange', this.#onFsChange);
    this.#syncThemeColor();
    const app = this.app;
    if (!this.#recorded && app && app !== 'menu' && !this.hasAttribute('no-activity') && getApp(app)) {
      this.#recorded = true;
      recordActivity(app);
    }
  }

  disconnectedCallback(): void {
    this.#offSettings?.();
    this.#offSettings = null;
    document.removeEventListener('fullscreenchange', this.#onFsChange);
    document.removeEventListener('webkitfullscreenchange', this.#onFsChange);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  // ---- reflected properties (React 19 sets these directly) ----
  get app(): string {
    return this.getAttribute('app') ?? '';
  }
  set app(v: string) {
    this.setAttribute('app', v);
  }
  get heading(): string {
    return this.getAttribute('heading') ?? '';
  }
  set heading(v: string) {
    if (v) this.setAttribute('heading', v);
    else this.removeAttribute('heading');
  }
  get back(): string {
    return this.getAttribute('back') ?? '';
  }
  set back(v: string) {
    if (v) this.setAttribute('back', v);
    else this.removeAttribute('back');
  }
  get fullscreen(): boolean | string {
    const v = this.getAttribute('fullscreen');
    return v === null ? false : v || true;
  }
  set fullscreen(v: boolean | string) {
    if (v === false || v === null || v === undefined) this.removeAttribute('fullscreen');
    else this.setAttribute('fullscreen', v === true ? '' : String(v));
  }
  get help(): boolean {
    return this.hasAttribute('help');
  }
  set help(v: boolean) {
    this.toggleAttribute('help', Boolean(v));
  }

  /** Toggle fullscreen on the target (attribute selector) or the whole document. */
  async toggleFullscreen(): Promise<void> {
    const d = document as FsDoc;
    try {
      if (fsElement()) {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } else {
        const sel = this.getAttribute('fullscreen');
        const target = ((sel && document.querySelector(sel)) || document.documentElement) as FsEl;
        await (target.requestFullscreen?.({ navigationUI: 'hide' }) ?? target.webkitRequestFullscreen?.());
      }
    } catch {
      /* not allowed (iframe, iOS) */
    }
  }

  #render(): void {
    const appId = this.app;
    const app = getApp(appId);
    const e = this.#els;
    e.icon.innerHTML = app?.icon ?? '';
    e.name.textContent = this.getAttribute('heading') || app?.name || '';
    const back = this.getAttribute('back');
    const hideBack = back === 'none' || (appId === 'menu' && !back);
    e.back.hidden = hideBack;
    e.back.href = back && back !== 'none' ? back : '/menu/';
    const backLabel = this.getAttribute('back-label') || 'Menu';
    e.backLabel.textContent = backLabel;
    e.back.setAttribute('aria-label', `Zpět: ${backLabel}`);
    e.help.hidden = !this.hasAttribute('help');
    e.sound.hidden = this.hasAttribute('no-sound');
    e.settings.hidden = this.hasAttribute('no-settings');
    e.fs.hidden = !this.hasAttribute('fullscreen') || !fsEnabled();
    this.#renderFs();
    if (app && !this.hasAttribute('no-accent')) applyAccent(app.accent);
  }

  #renderSound(): void {
    const on = getSettings().sound;
    const b = this.#els.sound;
    b.innerHTML = on ? UI_ICONS.soundOn : UI_ICONS.soundOff;
    b.setAttribute('aria-pressed', String(on));
    const label = on ? 'Zvuk je zapnutý' : 'Zvuk je vypnutý';
    b.setAttribute('aria-label', label);
    b.title = label;
  }

  #renderFs(): void {
    const active = Boolean(fsElement());
    const b = this.#els.fs;
    b.innerHTML = active ? UI_ICONS.fullscreenExit : UI_ICONS.fullscreen;
    const label = active ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.setAttribute('aria-pressed', String(active));
  }

  #syncThemeColor(): void {
    if (this.hasAttribute('no-theme-color')) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    meta.content = resolvedTheme() === 'dark' ? '#161a2f' : '#ffffff';
  }
}

export function defineAppbar(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('g92-appbar')) {
    customElements.define('g92-appbar', G92Appbar);
  }
}

defineAppbar();

declare global {
  interface HTMLElementTagNameMap {
    'g92-appbar': G92Appbar;
  }
}
