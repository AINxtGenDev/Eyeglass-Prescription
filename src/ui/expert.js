// Experten-Ansicht (02-02, UX-02, ANA-02, D-32): the switch and the Zwischenwerte per eye.
// The Expert blocks only get the `hidden` attribute; they are never created or removed, so every
// value id exists and is filled while the switch is off (textContent readers keep working).
// The switch state is not persisted (D-32, T-02-03: shared ainxtgendev.github.io origin).
import { $, setText } from './dom.js';
import { thickest } from '../state/compare.js';
import { nasalSign } from '../engine/conventions.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtMm, fmtGram } from '../i18n/format.js';

const DASH = '–';

/** Expert value ids per eye (results.js setStale marks them like the card values). */
export const EXPERT_CELLS = ['dec', 'etmax', 'basecurve', 'd2', 'radii', 'sags', 'binding', 'weight-precise'];

// Named outline points of the sags row, in this order (lay words from loc.*).
const SAG_POINTS = ['nasal', 'temporal', 'superior', 'inferior'];

let expert = false;

/** True while the Experten-Ansicht switch is on. */
export const isExpert = () => expert;

function apply() {
  for (const el of document.querySelectorAll('[data-expert]')) /** @type {HTMLElement} */ (el).hidden = !expert;
}

/**
 * Wire the switch. Off on every load: the checkbox is reset here, so a browser that restores form
 * state on reload cannot turn it on. `onChange` re-renders the location suffixes; focus stays on
 * the switch (UI-SPEC "Expert switch on").
 * @param {(timeStamp: number) => void} onChange
 */
export function initExpert(onChange) {
  const sw = /** @type {HTMLInputElement} */ ($('expert'));
  sw.checked = false;
  expert = false;
  apply();
  sw.addEventListener('change', (e) => {
    expert = sw.checked;
    apply();
    onChange(e.timeStamp);
  });
}

/** Base-curve cell: thinnest rule plus the Vogel reference (D-01 final, lens-critic MAJOR-2). */
function baseCurveText(m, im) {
  const bc = fmtDiopter(im.D1) + ' – ' + t('basecurve.rule.' + im.baseCurveRule);
  if (im.baseCurveRule !== 'thinnest') return bc;
  // Raw Vogel value; when the rule leaves +0,50…+14,00 (D-A) the clamp is named, and any
  // thickness in the sentence refers to the clamped lens (01-13, MINOR-1).
  let vogel = fmtDiopter(im.vogelD1);
  if (im.vogelD1 !== im.vogelClampedD1) {
    vogel += t('basecurve.vogelClamped', { clamped: fmtDiopter(im.vogelClampedD1) });
  }
  const v = im.vogelMaxThickness;
  const j = thickest(m).value;
  if (v === null) return bc + ' ' + t('basecurve.vogelRefImpossible', { vogel });
  if (v - j >= 0.05) return bc + ' ' + t('basecurve.vogelRefThicker', { vogel, thickness: fmtMm(v) });
  return bc + ' ' + t('basecurve.vogelRef', { vogel });
}

/** Radius in mm, or "plan" for a plano surface (the engine gives null, never Infinity). */
const radius = (r) => (r === null ? t('expert.zw.plano') : fmtMm(r));

/**
 * Fill the Zwischenwerte of one eye from a successful LensResult, whatever the switch state.
 * The location next to 'Dickster Rand' (#result-{eye}-etmax-loc) is written by results.js, which
 * owns all location words and their Expert suffix.
 * @param {'OD'|'OS'} eye @param {object} res LensResult with ok = true
 */
export function renderZwischenwerte(eye, res) {
  const p = `result-${eye.toLowerCase()}`;
  const m = res.metrics;
  const im = res.intermediates;
  // display only: the engine's signed x offset turned into "toward the nose" for this eye
  setText(`${p}-dec`, fmtMm(nasalSign(eye) * m.decentration.x));
  // 'Dickster Rand' is the edge value, number first (e2e etmaxOf).
  setText(`${p}-etmax`, fmtMm(m.etMax.value));
  setText(`${p}-basecurve`, baseCurveText(m, im));
  setText(`${p}-d2`, t('expert.zw.d2.value', { a: fmtDiopter(im.D2a), b: fmtDiopter(im.D2b) }));
  setText(`${p}-radii`, t('expert.zw.radii.value', { r1: radius(im.R1), ra: radius(im.Ra), rb: radius(im.Rb) }));
  setText(
    `${p}-sags`,
    SAG_POINTS.map((k) =>
      t('expert.zw.sags.point', { where: t('loc.' + k), front: fmtMm(im.sags[k].front), back: fmtMm(im.sags[k].back) }),
    ).join('; '),
  );
  setText(`${p}-binding`, t('expert.binding.' + im.bindingConstraint));
  setText(`${p}-weight-precise`, fmtGram(m.weightG));
}

/** No result for this eye: a dash in every Expert value. */
export function clearZwischenwerte(eye) {
  const p = `result-${eye.toLowerCase()}`;
  for (const c of EXPERT_CELLS) setText(`${p}-${c}`, DASH);
}
