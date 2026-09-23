/**
 * App help ("Jak hrát / Jak na to") shown by the appbar's "?" button — pictograms first, text second.
 *
 *   setHelp({ howTo: [{ icon: '👆', text: 'Klepni na komára' }], keys: [{ keys: ['P'], text: 'pauza' }] });
 *   // → <g92-appbar> gets a "?" button that opens this dialog (unless a g92-help listener calls preventDefault()).
 *   showHelp();   // open it from anywhere (e.g. a "Jak hrát" button of your own)
 */
import { openDialog, type DialogHandle } from './dialog';
import { UI_ICONS, h } from './dom';

export interface HelpContent {
  title?: string;
  /** short intro paragraph */
  intro?: string;
  howTo?: { icon: string; text: string }[];
  keys?: { keys: string[]; text: string }[];
  /** extra HTML (trusted) or node appended at the end */
  extra?: string | Node;
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
    title: content.title ?? 'Jak na to',
    icon: UI_ICONS.help,
    content: body,
    wide: (content.howTo?.length ?? 0) > 2,
    actions: [{ label: 'Rozumím', autofocus: true, icon: UI_ICONS.check }],
  });
}
