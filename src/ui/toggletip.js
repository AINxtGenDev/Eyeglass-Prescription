// Toggletips as APG disclosures (UX-01, D-31, RESEARCH Pattern 4): a native button with
// aria-expanded/aria-controls, toggled by click, Enter and Space (native button behaviour).
// Esc on the button or inside the panel closes it and returns focus to the button. Several tips
// may be open at once; no hover handlers. The tip is never in an input's aria-describedby.
import { icon } from './icons.js';

/** @param {ParentNode} [root] */
export function initToggletips(root = document) {
  for (const btn of root.querySelectorAll('button.tip-btn[aria-controls]')) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) continue;
    // A tip in its own table row (Rx header tips): the row follows the panel.
    const row = panel.closest('tr.tip-row');
    const set = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (row) row.hidden = !open;
    };
    btn.append(icon('info'));
    set(false);
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    const onKey = (e) => {
      if (e.key !== 'Escape' || btn.getAttribute('aria-expanded') !== 'true') return;
      e.preventDefault();
      set(false);
      btn.focus();
    };
    btn.addEventListener('keydown', onKey);
    panel.addEventListener('keydown', onKey);
  }
}
