// Experten-Ansicht (02-02, UX-02, ANA-02, D-32): the switch and the Zwischenwerte per eye.
// The Expert blocks only get the `hidden` attribute; they are never created or removed, so every
// value id exists and is filled while the switch is off (textContent readers keep working).
// The switch state is not persisted (D-32, T-02-03: shared ainxtgendev.github.io origin).
// 02-10 (MAT-03, MAT-04, D-33, D-34): the Glas-Einstellungen block (manual base curve, minimum
// thicknesses). Overrides apply only while the switch is on (T-02-28); typed values are kept.
// 02-11 (MAT-05): Vorderfläche sphärisch / asphärisch with the conic constant k (generic model).
import { $, setText } from './dom.js';
import { icon } from './icons.js';
import { nasalSign } from '../engine/conventions.js';
import { MATERIALS } from '../engine/materials.js';
import { sphericalEquivalent } from '../engine/power.js';
import { validateBaseCurve, validateMinThickness, validateConic, BASE_CURVE_MANUAL, CONIC_DEFAULT } from '../state/validate.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtMm, fmtGram, fmtConic } from '../i18n/format.js';
import { showFieldMessage, messageStatus, flushOnBlur } from './rx-input.js';

const DASH = '–';

/** Expert value ids per eye (results.js setStale marks them like the card values). */
export const EXPERT_CELLS = ['dec', 'etmax', 'etmin', 'basecurve', 'd2', 'radii', 'sags', 'binding', 'weight-precise'];

// Named outline points of the sags row, in this order (lay words from loc.*).
const SAG_POINTS = ['nasal', 'temporal', 'superior', 'inferior'];

let expert = false;

/** True while the Experten-Ansicht switch is on. */
export const isExpert = () => expert;

function apply() {
  for (const el of document.querySelectorAll('[data-expert]')) /** @type {HTMLElement} */ (el).hidden = !expert;
}

const BC_ID = 'expert-basecurve';
const MIN_ID = { minCT: 'expert-min-ct', minET: 'expert-min-et' };
const K_ID = 'expert-k';
const EXPERT_FIELDS = [BC_ID, MIN_ID.minCT, MIN_ID.minET, K_ID];
const field = (id) => /** @type {HTMLInputElement} */ ($(id));
// Field text without sign or unit, as typed: "1,8" (parseMm takes one decimal), "4,50".
const mmField = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const dptField = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** The min fields hold a typed value (kept across material changes) rather than the default. */
const minEdited = { minCT: false, minET: false };
/** Material whose defaults are in the min fields. */
let fieldMaterial = 'cr39';
/** @type {() => void} */
let onShown = () => {};

/**
 * Vogel D1 as a usable manual value (lens-critic phase-1 MINOR-5): nearest 0,25 dpt step, clamped
 * to the manual range 0,00…+10,00 (MAT-03). + 0: no −0.
 */
export const vogelRounded = (vogelD1) =>
  Math.min(BASE_CURVE_MANUAL[1], Math.max(BASE_CURVE_MANUAL[0], Math.round(vogelD1 * 4) / 4)) + 0;

/** Fill the min fields that were not typed with the material's defaults (materials.js, D-34). */
function fillMinDefaults(materialId, { reset = false } = {}) {
  fieldMaterial = materialId;
  for (const k of /** @type {const} */ (['minCT', 'minET'])) {
    if (reset) minEdited[k] = false;
    if (!minEdited[k]) field(MIN_ID[k]).value = mmField.format(MATERIALS[materialId][k]);
  }
}

/**
 * Material change hook (material-input.js): re-fill the defaults unless the field was edited.
 * 'custom' (02-12) has no defaults here: its own fields carry the minimums, the fields keep theirs.
 */
export const onMaterialChange = (materialId) => {
  if (Object.hasOwn(MATERIALS, materialId)) fillMinDefaults(materialId);
};

/**
 * Wire the switch and the Glas-Einstellungen. Off on every load: the checkbox is reset here, so a
 * browser that restores form state on reload cannot turn it on. `onChange` gets the toggle (the
 * caller re-renders the location suffixes and schedules an input frame, because the overrides
 * change the specs); focus stays on the switch (UI-SPEC "Expert switch on"). `schedule` runs an
 * input frame for the Expert fields.
 * @param {(timeStamp: number) => void} onChange
 * @param {{ schedule: (timeStamp: number) => void, onMessageShown: () => void, materialId: string }} deps
 */
export function initExpert(onChange, { schedule, onMessageShown, materialId }) {
  const sw = /** @type {HTMLInputElement} */ ($('expert'));
  sw.checked = false;
  expert = false;
  apply();
  sw.addEventListener('change', (e) => {
    expert = sw.checked;
    apply();
    onChange(e.timeStamp);
  });
  onShown = onMessageShown;
  field(BC_ID).value = '';
  fillMinDefaults(materialId, { reset: true });
  field(BC_ID).addEventListener('input', (e) => schedule(e.timeStamp));
  for (const k of /** @type {const} */ (['minCT', 'minET'])) {
    field(MIN_ID[k]).addEventListener('input', (e) => {
      // An emptied field goes back to the default (and is re-filled on the next material change).
      minEdited[k] = field(MIN_ID[k]).value.trim() !== '';
      schedule(e.timeStamp);
    });
  }
  // Vorderfläche: the k field only for asphärisch; either choice runs an input frame. The check
  // icon carries the selected state (not colour alone), as in #cmp-show.
  for (const radio of document.querySelectorAll('input[name=expert-front]')) {
    radio.after(icon('check'));
    radio.addEventListener('change', (e) => {
      $('expert-k-wrap').hidden = !aspheric();
      schedule(e.timeStamp);
    });
  }
  $('expert-k-wrap').hidden = !aspheric();
  field(K_ID).addEventListener('input', (e) => schedule(e.timeStamp));
  for (const id of EXPERT_FIELDS) flushOnBlur(id);
  $('expert-min-reset').addEventListener('click', (e) => {
    fillMinDefaults(fieldMaterial, { reset: true });
    schedule(e.timeStamp);
  });
  $('expert-bc-vogel').addEventListener('click', () => {
    const v = $('expert-bc-vogel').dataset.value;
    if (!v) return;
    field(BC_ID).value = v;
    field(BC_ID).focus();
    field(BC_ID).dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** 'asphärisch' is chosen (the k field is shown). */
const aspheric = () =>
  /** @type {HTMLInputElement | null} */ (document.querySelector('input[name=expert-front]:checked'))?.value === 'asph';

const NO_OVERRIDES = Object.freeze({
  baseCurve: null,
  minCT: null,
  minET: null,
  frontConic: null,
  active: false,
  blocked: false,
  firstBlockedFieldId: null,
  pendingMessage: false,
});

/** Source words of a min field: typed, or the material's sourced / assumed default (MINOR-3). */
function minSource(k, m, value) {
  if (minEdited[k] && value !== null && value !== m[k]) return t('expert.min.typed');
  return t(m.assumed?.includes(k) ? 'expert.min.assumed' : 'expert.min.sourced');
}

/**
 * The Expert overrides for the specs, only while the switch is on (T-02-28). Validates the three
 * fields (messages after the pause, like the Rx fields); a Fehler or Außerhalb des Modells blocks
 * both eyes and is never clamped (T-02-26). A minimum equal to the material default is sent as
 * null, so the spec (cache key) equals the one without overrides and the result is shared with
 * the material table.
 * @param {string} materialId
 * frontConic (02-11): k while 'asphärisch' is chosen and the k field is valid (empty = CONIC_DEFAULT),
 * else null (sphere). A k message blocks both eyes only while 'asphärisch' is chosen.
 * @returns {{ baseCurve: number|null, minCT: number|null, minET: number|null,
 *   frontConic: number|null, active: boolean,
 *   blocked: boolean, firstBlockedFieldId: string|null, pendingMessage: boolean }}
 */
export function readExpertOverrides(materialId) {
  if (!expert) return NO_OVERRIDES;
  // 02-12: with 'Eigenes Material' its own minimum fields (#custom-material) replace these two, so
  // they are hidden and send nothing (one minimum per spec, no competing fields).
  const custom = !Object.hasOwn(MATERIALS, materialId);
  $('expert-min').hidden = custom;
  $('expert-min-reset').hidden = custom;
  const m = MATERIALS[custom ? fieldMaterial : materialId];
  const bc = validateBaseCurve(field(BC_ID).value);
  showFieldMessage(BC_ID, bc.msg, { kind: 'dpt', apply: null, shown: onShown });
  setText(`${BC_ID}-echo`, bc.value === null ? (bc.msg ? '' : t('expert.bc.echoAuto')) : fmtDiopter(bc.value) + ' – ' + t('expert.bc.echoManual'));
  const out = { baseCurve: bc.value, minCT: null, minET: null, active: true };
  for (const k of /** @type {const} */ (['minCT', 'minET'])) {
    if (custom) {
      showFieldMessage(MIN_ID[k], null, { kind: 'mm', apply: null });
      continue;
    }
    const r = validateMinThickness(field(MIN_ID[k]).value);
    showFieldMessage(MIN_ID[k], r.msg, { kind: 'mm', apply: null, shown: onShown });
    setText(`${MIN_ID[k]}-echo`, r.msg ? '' : minSource(k, m, r.value));
    out[k] = r.value === null || r.value === m[k] ? null : r.value;
  }
  const asph = aspheric();
  const k = asph ? validateConic(field(K_ID).value) : { value: null, msg: null };
  showFieldMessage(K_ID, k.msg, { kind: 'k', apply: null, shown: onShown });
  out.frontConic = asph && !k.msg ? (k.value ?? CONIC_DEFAULT) : null;
  setText(`${K_ID}-echo`, out.frontConic === null ? '' : t('expert.k.echo', { k: fmtConic(out.frontConic) }));
  const st = expertStatus();
  return { ...out, blocked: st.firstBlockedFieldId !== null, ...st };
}

/**
 * The first Expert field whose message blocks both eyes, and whether a blocking message is not on
 * screen yet; read fresh from the message states (like frameStatus).
 */
export function expertStatus() {
  let firstBlockedFieldId = null;
  let pendingMessage = false;
  for (const id of EXPERT_FIELDS) {
    const st = messageStatus(id);
    if (!st.blocks) continue;
    firstBlockedFieldId ??= id;
    if (st.pending) pendingMessage = true;
  }
  return { firstBlockedFieldId, pendingMessage };
}

/**
 * The Vogel sentence (D-01 final, lens-critic MAJOR-2). The thickness of the Vogel lens is always
 * named when it computes (lens-critic phase-1 MINOR-2); a manual result names the Vogel value only.
 * `rounded` appends the 0,25 dpt step that 'Vogel-Basiskurve übernehmen' writes (MINOR-5).
 */
function vogelRefText(im, { rounded = false, basis = '' } = {}) {
  // Raw Vogel value; when the rule leaves +0,50…+14,00 (D-A) the clamp is named, and any
  // thickness in the sentence refers to the clamped lens (01-13, MINOR-1).
  let vogel = fmtDiopter(im.vogelD1);
  let text;
  if (im.baseCurveRule !== 'thinnest') {
    text = t('basecurve.vogelRef', { vogel });
  } else {
    if (im.vogelD1 !== im.vogelClampedD1) {
      vogel += t('basecurve.vogelClamped', { clamped: fmtDiopter(im.vogelClampedD1) });
    }
    const v = im.vogelMaxThickness;
    text =
      v === null
        ? t('basecurve.vogelRefImpossible', { vogel })
        : t('basecurve.vogelRefThicker', { vogel, thickness: fmtMm(v) });
  }
  text += basis;
  if (rounded) text += ' ' + t('basecurve.vogelRounded', { rounded: fmtDiopter(vogelRounded(im.vogelD1)) });
  return text;
}

/**
 * ' (für sphärische Vorderfläche bestimmt)' for an automatic curve with an aspheric front, else ''.
 * A manual curve is not chosen by the rule and its Vogel sentence has no thickness.
 */
const sphericalBasis = (im, k1) => (k1 !== 0 && im.baseCurveRule === 'thinnest' ? ' ' + t('basecurve.sphericalBasis') : '');

/**
 * Base-curve cell: the rule plus the Vogel reference. With an aspheric front (k1 ≠ 0) the rule and
 * the Vogel thickness were evaluated at k = 0, so both say so (lens-critic MINOR-1).
 */
function baseCurveText(im, k1 = 0) {
  const basis = sphericalBasis(im, k1);
  return fmtDiopter(im.D1) + ' – ' + t('basecurve.rule.' + im.baseCurveRule) + basis + ' ' + vogelRefText(im, { basis });
}

const GLASS = { OD: 'result.glass.od', OS: 'result.glass.os' };

/**
 * Glas-Einstellungen lines from the painted results (pipeline.js paintCompare, after the main
 * result). `main` = the results on the cards (all overrides); `auto` = the same specs with the
 * automatic base curve (the main results themselves when no manual base curve is set; undefined
 * while that job computes). null = no result for the eye.
 * `specs` = the main specs (the minus-lens note needs the Rx).
 * @param {{ specs: Record<'OD'|'OS', object|null>, main: Record<'OD'|'OS', object|null>,
 *   auto: Record<'OD'|'OS', object|null> | undefined }} r
 */
export function renderGlassSettings({ specs, main, auto }) {
  let minusFloor = false;
  for (const eye of /** @type {const} */ (['OD', 'OS'])) {
    const e = eye.toLowerCase();
    const glass = t(GLASS[eye]);
    const a = auto?.[eye];
    if (a?.ok) {
      const im = a.intermediates;
      const basis = sphericalBasis(im, a.surfaces.k1);
      const vogelRef = (basis ? basis.trim() + ' ' : '') + vogelRefText(im, { rounded: true, basis });
      setText(`expert-bc-auto-${e}`, t('expert.bc.autoLine', { glass, value: fmtDiopter(im.D1), vogelRef }));
      // The phase-1 rule puts minus lenses at the +0,50 floor (01-SKELETON): say so (D-01 disclosure).
      const s = specs[eye];
      if (s && sphericalEquivalent(s.sph, s.cyl) < 0 && im.baseCurveRule === 'thinnest' && im.D1 <= 0.5 + 1e-9) minusFloor = true;
    } else {
      setText(`expert-bc-auto-${e}`, t('expert.bc.autoNone', { glass }));
    }
    const r = main[eye];
    setText(`expert-binding-${e}`, r?.ok ? t('expert.binding.line', { glass, text: t('expert.binding.' + r.intermediates.bindingConstraint) }) : '');
  }
  $('expert-bc-minus-note').hidden = !minusFloor;
  // 'Vogel-Basiskurve übernehmen' writes the right eye's rounded Vogel value (left when R has none).
  const ref = [main.OD, main.OS].find((r) => r?.ok);
  const btn = $('expert-bc-vogel');
  if (ref) btn.dataset.value = dptField.format(vogelRounded(ref.intermediates.vogelD1));
  else delete btn.dataset.value;
}

/** Radius in mm, or "plan" for a plano surface (the engine gives null, never Infinity). */
const radius = (r) => (r === null ? t('expert.zw.plano') : fmtMm(r));

/**
 * Fill the Zwischenwerte of one eye from a successful LensResult, whatever the switch state.
 * The locations next to 'Dickster Rand' and 'Dünnster Rand' (#result-{eye}-etmax-loc, -etmin-loc)
 * are written by results.js, which owns all location words and their Expert suffix.
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
  // 'Dünnster Rand' (02-16): the thinnest edge, kept next to the card's thinnest point.
  setText(`${p}-etmin`, fmtMm(m.etMin.value));
  setText(`${p}-basecurve`, baseCurveText(im, res.surfaces.k1));
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
