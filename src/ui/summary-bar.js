// Phone/tablet summary bar (02-02, D-20, UX-03): "R 4,6 mm · 7 g | L 4,6 mm · 7 g" at the bottom
// while the result cards are out of view. It only repeats the strings the cards were painted with
// (T-02-05): results.js passes them in, nothing is formatted or computed here. Not a live region:
// the cards already announce, a second announcement would double them (UI-SPEC).
// Accessible name = a visually hidden "Zum Ergebnis:" + the visible text. The UI-SPEC sentence as
// aria-label failed axe label-content-name-mismatch (WCAG 2.5.3 Label in Name: the visible text
// must be part of the name), so it is not used.
import { $, setText } from './dom.js';
import { t } from '../i18n/t.js';

const DASH = '–';
// Below the desktop breakpoint (UI-SPEC: Desktop ≥ 900 px has no bar).
const NARROW = '(max-width: 899.98px)';

let resultInView = false;
/** @type {MediaQueryList | null} */
let narrow = null;

function updateVisibility() {
  $('summary-bar').hidden = resultInView || !narrow?.matches;
}

/** Observe #result and the breakpoint; a tap scrolls to the result and focuses its heading. */
export function initSummaryBar() {
  narrow = matchMedia(NARROW);
  narrow.addEventListener('change', updateVisibility);
  new IntersectionObserver((entries) => {
    for (const e of entries) resultInView = e.isIntersecting;
    updateVisibility();
  }).observe($('result'));
  $('summary-bar').addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('result').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    $('result-title').focus({ preventScroll: true });
  });
  updateSummaryBar({ OD: null, OS: null, busy: false, stale: false });
  updateVisibility();
}

const pair = (v) => (v ? t('bar.eye', { thick: v.thick, weight: v.weight }) : DASH);

/**
 * Repaint the bar from the card strings.
 * @param {{ OD: { thick: string, weight: string } | null, OS: { thick: string, weight: string } | null,
 *   busy: boolean, stale: boolean, config?: 'a' | null }} s  thick = the card's thickest point
 *   (thickest(m)), weight = the card's whole grams; null = no result for that eye ('–');
 *   config 'a' = the cards show Vorher (A), so the label gets the 'Vorher (A):' prefix (02-17, M2).
 */
export function updateSummaryBar({ OD, OS, busy, stale, config = null }) {
  const label = t(busy ? 'result.computing' : 'bar.label');
  setText('summary-bar-label', config === 'a' ? `${t('bar.prefix.a')} ${label}` : label);
  setText('summary-bar-values', t('bar.values', { od: pair(OD), os: pair(OS) }));
  const values = $('summary-bar-values');
  if (stale) values.dataset.stale = 'true';
  else delete values.dataset.stale;
}
