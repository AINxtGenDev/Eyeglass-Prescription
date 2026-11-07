// Small DOM helpers shared by the UI modules (split out of main.js in 02-01).
// Every visible string is written with textContent, never as HTML markup (T-02-01).
import { t } from '../i18n/t.js';

export const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** Write text only when it changes: fewer DOM writes per keystroke, no re-announced live regions. */
export const setText = (id, text) => {
  const el = $(id);
  if (el.textContent !== text) el.textContent = text;
};

export const para = (text) => {
  const el = document.createElement('p');
  el.textContent = text;
  return el;
};

export function applyDictionary() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  }
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  }
}
