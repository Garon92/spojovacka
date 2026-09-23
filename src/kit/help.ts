/**
 * App help ("Jak hrát / Jak na to") shown by the appbar's "?" button — pictograms first, text second.
 *
 *   setHelp({ howTo: [{ icon: '👆', text: 'Klepni na komára' }], keys: [{ keys: ['P'], text: 'pauza' }] });
 *   // → <g92-appbar> gets a "?" button that opens this dialog (unless a g92-help listener calls preventDefault()).
 *   showHelp();   // open it from anywhere (e.g. a "Jak hrát" button of your own)
 */
import { getApp } from './apps';
import { openDialog, type DialogHandle } from './dialog';
import { UI_ICONS, h } from './dom';
import { HELP_TITLE_GAME, HELP_TITLE_LEARN, LABELS, LABEL_ICONS } from './labels';

export interface HelpSection {
  title: string;
  /** paragraph */
  text?: string;
  /** bullet list */
  items?: string[];
  /** optional emoji / SVG before the heading */
  icon?: string;
}

export interface HelpContent {
  /** default: "Jak hrát" for games, "Jak na to" for learning apps (from the appbar's app) */
  title?: string;
  /** short intro paragraph */
  intro?: string;
  /** pictogram steps (games, small kids) */
  howTo?: { icon: string; text: string }[];
  /** text layout for text-heavy apps: headed sections with a paragraph and/or bullet list */
  sections?: HelpSection[];
  keys?: { keys: string[]; text: string }[];
  /** extra HTML (trusted) or node appended at the end */
  extra?: string | Node;
}

/** "Jak hrát" for games, "Jak na to" for learning apps and the menu. */
export function helpTitle(appId?: string | null): string {
  const id = appId ?? (typeof document !== 'undefined' ? document.querySelector('g92-appbar')?.getAttribute('app') : null);
  return getApp(id)?.category === 'play' ? HELP_TITLE_GAME : HELP_TITLE_LEARN;
}

let current: HelpContent | null = null;

const isSvg = (s: string) => s.trimStart().startsWith('<svg');

/** Register (or clear with null) the help content; shows the "?" in every <g92-appbar>. Returns an unregister function. */
export function setHelp(content: HelpContent | null): () => void {
  current = content;
  if (typeof document !== 'undefined') {
    for (const bar of document.querySelectorAll('g92-appbar')) syncAppbarHelp(bar);
  }
  return () => {
    if (current === content) setHelp(null);
  };
}

/** @internal keeps an appbar's "?" in sync with the registered help */
export function syncAppbarHelp(bar: Element): void {
  if (current) {
    if (!bar.hasAttribute('help')) {
      bar.setAttribute('help', '');
      bar.setAttribute('data-auto-help', '');
    }
  } else if (bar.hasAttribute('data-auto-help')) {
    bar.removeAttribute('help');
    bar.removeAttribute('data-auto-help');
  }
}

export function getHelp(): HelpContent | null {
  return current;
}

export function showHelp(content: HelpContent | null = current): DialogHandle | null {
  if (!content) return null;
  const body = h('div', { class: 'g92-stack' });
  if (content.intro) body.append(h('p', { class: 'g92-muted' }, content.intro));
  if (content.howTo?.length) {
    const ol = h('ol', { class: 'g92-howto' });
    content.howTo.forEach((s, i) => {
      const icon = h('span', { class: 'g92-howto__icon', 'aria-hidden': 'true' });
      if (isSvg(s.icon)) icon.innerHTML = s.icon;
      else icon.append(h('span', { class: 'g92-emoji' }, s.icon));
      ol.append(h('li', { class: 'g92-howto__step', style: `--i:${i}` }, icon, h('span', { class: 'g92-howto__text' }, s.text)));
    });
    body.append(ol);
  }
  if (content.sections?.length) {
    const list = h('div', { class: 'g92-help-sections' });
    for (const sec of content.sections) {
      const head = h('h3', { class: 'g92-help-sections__title' });
      if (sec.icon) {
        const ic = h('span', { class: 'g92-help-sections__icon', 'aria-hidden': 'true' });
        if (isSvg(sec.icon)) ic.innerHTML = sec.icon;
        else ic.textContent = sec.icon;
        head.append(ic);
      }
      head.append(sec.title);
      const box = h('section', { class: 'g92-help-sections__item' }, head);
      if (sec.text) box.append(h('p', null, sec.text));
      if (sec.items?.length) box.append(h('ul', null, ...sec.items.map((t) => h('li', null, t))));
      list.append(box);
    }
    body.append(list);
  }
  if (content.keys?.length) {
    const ul = h('ul', { class: 'g92-keys' });
    for (const k of content.keys) {
      const keys = h('span', { class: 'g92-keys__keys' });
      for (const key of k.keys) keys.append(h('kbd', { class: 'g92-kbd' }, key));
      ul.append(h('li', null, keys, h('span', null, k.text)));
    }
    body.append(ul);
  }
  if (typeof content.extra === 'string') body.append(h('div', { html: content.extra }));
  else if (content.extra) body.append(content.extra);
  return openDialog({
    title: content.title ?? helpTitle(),
    icon: UI_ICONS.help,
    kind: 'help',
    content: body,
    wide: (content.howTo?.length ?? 0) > 2 || (content.sections?.length ?? 0) > 1,
    actions: [{ label: LABELS.gotIt, autofocus: true, icon: LABEL_ICONS.gotIt }],
  });
}
