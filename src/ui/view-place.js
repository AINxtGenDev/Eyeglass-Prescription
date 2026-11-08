// Placement of the 3D view by breakpoint (03-06, lens-critic MAJOR 5; revises D-14 under the
// 03-CONTEXT revision rule). The numbers are the core value: below 900 px #view-slot sits directly
// AFTER section#result, so a phone user who reaches the results sees the first card value before
// the 3D view. On >= 900 px it stays the first child of .col-results (D-13). UX-03 (the lens view
// stays visible while editing on phones) is met by the summary-bar thumbnail (03-15).
//
// DOM move, not CSS `order`: reading and keyboard order stay equal to the visual order (WCAG 1.3.2,
// 2.4.3). Moving a canvas element keeps its WebGL context; layout.spec.js checks that the view
// still renders after a breakpoint change.
// Main chunk: no three, no view imports.
import { $ } from './dom.js';

// The same query as NARROW in summary-bar.js (the bar shows below the same breakpoint).
const NARROW = '(max-width: 899.98px)';

let placed = false;

/** Place #view-slot for the current breakpoint and follow changes. Idempotent. */
export function placeViewSlot() {
  if (placed) return;
  placed = true;
  const mq = matchMedia(NARROW);
  const apply = () => {
    const slot = $('view-slot');
    const result = $('result');
    if (mq.matches) {
      if (result.nextElementSibling !== slot) result.after(slot);
    } else {
      const col = /** @type {HTMLElement} */ (slot.closest('.col-results'));
      if (col.firstElementChild !== slot) col.prepend(slot);
    }
  };
  apply();
  mq.addEventListener('change', apply);
}
