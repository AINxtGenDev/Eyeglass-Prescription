// Phone/tablet summary bar (02-02, D-20, UX-03): "R 4,6 mm · 7 g | L 4,6 mm · 7 g" at the bottom
// while the result cards are out of view. It only repeats the strings the cards were painted with
// (T-02-05): results.js passes them in, nothing is formatted or computed here. Not a live region:
// the cards already announce, a second announcement would double them (UI-SPEC).
// Accessible name = a visually hidden "Zum Ergebnis:" + the visible text. The UI-SPEC sentence as
// aria-label failed axe label-content-name-mismatch (WCAG 2.5.3 Label in Name: the visible text
// must be part of the name), so it is not used.
// 03-15 (UX-03): #bar-view-slot holds the 3D view's lens thumbnail (enableBarThumb).
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
  fitThumb();
}

/**
 * 03-15 (Rule 1): the numbers are never clipped. With the thumbnail the values line is 56 px
 * narrower; below 400 px style.css shrinks the side padding and the values font for it (the
 * longest realistic line, 'R 16,3 mm · 15 g | L 17,2 mm · 16 g', measured 237 px at 14 px against
 * 240 px free at 320 px). If the line still does not fit (another font, a longer value), the
 * thumbnail steps aside (class thumb-off) and the bar is the phase-2 text bar; the same when the
 * label would wrap (03-LC MINOR 6). Measured on text, visibility and size changes only, with the
 * thumbnail layout applied.
 */
function fitThumb() {
  const bar = $('summary-bar');
  if (!bar.classList.contains('has-thumb') || bar.hidden) return;
  bar.classList.remove('thumb-off');
  const values = $('summary-bar-values');
  const range = document.createRange();
  range.selectNodeContents(values);
  // 03-LC (MINOR 6): the label must stay on one line too (a 'Vorher (A):' / 'Nachher (B):' prefix
  // next to the thumbnail would wrap it and grow the bar over the 72 px scroll padding).
  const label = document.createRange();
  label.selectNodeContents($('summary-bar-label'));
  const lines = [...label.getClientRects()];
  const oneLine = lines.every((r) => Math.abs(r.top - lines[0].top) < 1);
  const fits = oneLine && range.getBoundingClientRect().width <= values.clientWidth + 0.5;
  bar.classList.toggle('thumb-off', !fits);
  $('bar-view-slot').hidden = !fits;
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
  window.addEventListener('resize', fitThumb);
}

/**
 * 03-15 (UX-03, D-14): show the lens thumbnail (view.js calls this after its first copy). The bar
 * becomes a 2-column grid (style.css #summary-bar.has-thumb); the canvas is aria-hidden, so the
 * bar's accessible name is unchanged. Never called without WebGL: the slot stays hidden.
 */
export function enableBarThumb() {
  $('bar-view-slot').hidden = false;
  $('summary-bar').classList.add('has-thumb');
  fitThumb();
}

const pair = (v) => (v ? t('bar.eye', { thick: v.thick, weight: v.weight }) : DASH);

/**
 * Repaint the bar from the card strings.
 * @param {{ OD: { thick: string, weight: string } | null, OS: { thick: string, weight: string } | null,
 *   busy: boolean, stale: boolean, config?: 'a' | 'b' | null }} s  thick = the card's thickest point
 *   (thickest(m)), weight = the card's whole grams; null = no result for that eye ('–');
 *   config 'a' = the cards show Vorher (A), so the label gets the 'Vorher (A):' prefix (02-17, M2);
 *   'b' = a comparison runs and the cards show Nachher (B): 'Nachher (B):' (03-LC MINOR 6).
 */
export function updateSummaryBar({ OD, OS, busy, stale, config = null }) {
  const label = t(busy ? 'result.computing' : 'bar.label');
  setText('summary-bar-label', config ? `${t(`bar.prefix.${config}`)} ${label}` : label);
  setText('summary-bar-values', t('bar.values', { od: pair(OD), os: pair(OS) }));
  const values = $('summary-bar-values');
  if (stale) values.dataset.stale = 'true';
  else delete values.dataset.stale;
  fitThumb();
}
