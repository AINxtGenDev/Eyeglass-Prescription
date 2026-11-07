// Thickest point, display rounding and the left/right difference rule (02-01, RES-01, RES-04).
// Pure: no DOM, no i18n text. Returns codes; src/ui turns them into German.
// Material rows (02-06, RES-02): materialRows / thickerEye.
import { MATERIALS } from '../engine/materials.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

/**
 * Thickest point of the whole glass: the larger of the centre and the thickest edge (lens-critic
 * B1). Plus lenses: the centre; minus lenses: the edge; mixed cylinder: usually the edge. Same rule
 * as solveCT `maxThickness` and phase-1 main.js `Math.max(m.ct, m.etMax.value)`. This is the only
 * place where "Dickste Stelle" is derived; no card code reads `etMax.value` for it.
 * @param {{ ct: number, etMax: { value: number, location: string } }} m LensResult.metrics
 * @returns {{ value: number, where: string }} where = 'centre' or an etMax location code
 */
export function thickest(m) {
  const centre = m.ct >= m.etMax.value;
  return { value: centre ? m.ct : m.etMax.value, where: centre ? 'centre' : m.etMax.location };
}

// Display rules: differences are computed from the displayed values, so the arithmetic on screen
// adds up (RESEARCH Pitfall 10). Values are ≥ 0, so Math.round equals Intl's half-expand rounding
// (proven by the sweep in compare.test.js).
/** Round to the 0,1 mm display step. */
export const roundMm = (v) => Math.round(v * 10) / 10;
/** Round to whole displayed grams. */
export const roundG = (v) => Math.round(v);

/**
 * Uniform edge (02-01 display rule, moved here in 02-02): the displayed thickest and thinnest edge
 * are the same 0,1 mm value, so no edge location is named. Compares rounded values on purpose: an
 * edge that varies by less than 0,1 mm reads 'ringsum', matching what is shown. roundMm equals the
 * fmtMm rounding (sweep test below), so this is the 02-01 comparison of the display strings.
 * @param {{ etMax: { value: number }, etMin: { value: number } }} m LensResult.metrics
 */
export const uniformEdge = (m) => roundMm(m.etMax.value) === roundMm(m.etMin.value);

/**
 * L/R thickness threshold, mm on the displayed thickest point (thickest(m)). Measured on the
 * canonical frame, the rule fires from about 1 dpt of anisometropia, depending on rounding and on
 * which eye has the larger PD (−2/−3 raw 0,99 mm, +2/+3 0,97 mm; R −1/L −2 shows 2,8 / 3,8 and
 * fires, R −2/L −1 shows 3,7 / 2,8 and stays silent; the old etMax-only metric gave 0,61 mm for
 * plus, RESEARCH Open Q5 as corrected). About 3× the ±0,3 mm Zeiss CT tolerance used for τ.
 * Cosmetic visibility threshold, design constant, no medical meaning.
 */
export const LR_DIFF_MM = 1.0;

/**
 * L/R weight threshold, displayed whole grams (D-24). Re-derived on thickest(m): on the canonical
 * frame it never fires before the mm rule (1 dpt moves at most 2 displayed g; a sweep sph −8…+5
 * with 1–3 dpt differences found no weight-only case). The former plus-pair justification came
 * from the etMax metric and is withdrawn; the rule stays as a guard for large or dense
 * configurations. Design constant.
 */
export const LR_DIFF_G = 3;

/**
 * PD difference (mm) from which the PD is named next to a differing Rx (lens-critic rounds 2, 3).
 * It decides only between 'rx' and 'rx-pd'. On the canonical frame 1 mm of PD moves the thickest
 * point by 0,11–0,37 mm at sph −2…−6, so a typical 32 / 31,5 pair next to a real Rx difference
 * must not be blamed. It does NOT hold for strong myopes (same Rx, PD 32 / 30,5: −9 → 1,0 mm,
 * −10 → 1,1 mm, −12 → 1,8 mm displayed difference), so with an identical Rx any PD or
 * fitting-height difference is the cause ('pd'). Design constant.
 */
export const LR_PD_CAUSE_MM = 2;

// Axis matters only with a cylinder; 0 and 180 are the same TABO axis.
const axisKey = (s) => (s.cyl === 0 ? 0 : s.axisDeg % 180);
const sameRx = (a, b) => a.sph === b.sph && a.cyl === b.cyl && axisKey(a) === axisKey(b);

/** |Δ| of two optional mm values; null/null → 0, null/number → Infinity. */
function gap(a, b) {
  if (a === null && b === null) return 0;
  if (a === null || b === null) return Infinity;
  return Math.abs(a - b);
}

/**
 * What differs between the eyes: 'rx', 'pd' (PD or fitting height only), 'rx-pd', or null when
 * nothing differs.
 * @param {{ sph: number, cyl: number, axisDeg: number, monoPD: number, fittingHeight: number|null }} od
 * @param {typeof od} os
 */
export function lrCause(od, os) {
  const dPd = gap(od.monoPD, os.monoPD);
  const dFh = gap(od.fittingHeight ?? null, os.fittingHeight ?? null);
  if (sameRx(od, os)) return dPd > 0 || dFh > 0 ? 'pd' : null;
  return dPd >= LR_PD_CAUSE_MM || dFh >= LR_PD_CAUSE_MM ? 'rx-pd' : 'rx';
}

/**
 * L/R difference on displayed values. Thickness is checked first (D-24). The thresholds are tested
 * on the rounded difference, never on the raw float (2,8 − 1,8 = 0.9999999999999998).
 * @param {{ thick: number, weight: number }} od displayed (rounded) values
 * @param {{ thick: number, weight: number }} os
 * @param {'rx'|'pd'|'rx-pd'|null} cause from lrCause; null → null (nothing differs)
 */
export function lrDifference(od, os, cause) {
  if (cause === null) return null;
  const diffMm = roundMm(Math.abs(od.thick - os.thick));
  if (diffMm >= LR_DIFF_MM) return { kind: 'thickness', thicker: od.thick > os.thick ? 'OD' : 'OS', diffMm, cause };
  const diffG = roundG(Math.abs(od.weight - os.weight));
  if (diffG >= LR_DIFF_G) return { kind: 'weight', heavier: od.weight > os.weight ? 'OD' : 'OS', diffG, cause };
  return null;
}

/**
 * The eye whose displayed thickest point is larger; tie → OD. A null value (eye not computed)
 * loses.
 * @param {{ OD: number|null, OS: number|null }} thickByEye displayed (roundMm) thickest values
 * @returns {'OD'|'OS'}
 */
export function thickerEye({ OD, OS }) {
  if (OD === null || OD === undefined) return 'OS';
  if (OS === null || OS === undefined) return 'OD';
  return OS > OD ? 'OS' : 'OD';
}

const okLens = (r) => r?.ok === true;

/**
 * Rows of the material comparison (D-15, D-16), in MATERIALS order, codes only.
 *
 * - Thickness is thickest(m) = max(CT, etMax) (lens-critic B1, the same rule as the result card),
 *   so a plus lens's thickest point is its centre. Every difference is computed from the
 *   displayed (rounded) values, so 4,6 − 3,0 reads 1,6 mm (RESEARCH Pitfall 10).
 * - One eye for all rows: the thicker eye of the selected material on displayed values, tie → OD
 *   (lens-critic MINOR-4), so no row compares R against L. If one selected eye is not computed,
 *   the other is used.
 * - Weight is the sum of the displayed per-eye grams of the computed selected eyes.
 * - Every row uses its own material's sourced minCT/minET (RESEARCH Pitfall 11), so a higher
 *   index is not always much thinner. Expert overrides (02-10) apply as specified there. The minET
 *   of 1,67 and 1,74 is assumed (materials.js `assumed`); 02-07 footnotes it.
 *
 * @param {object} o
 * @param {string} o.selectedId the user's material; its row comes from the main result (never
 *   recomputed, D-15). 'custom' (02-12): its row comes first, then all six MATERIALS rows.
 * @param {{ OD?: object|null, OS?: object|null }} o.selected main LensResult pair
 * @param {Record<string, { OD?: object|null, OS?: object|null } | undefined>} o.others compare results
 * @returns {object[]} [] when no selected eye is computed; 6 rows, or 7 with 'custom'. Row: { id, eye, thickMm, thickWhere,
 *   ctMm, weightG, diffMm, diffG, pct, selected } (diffMm/diffG/pct positive = this row thinner
 *   or lighter; null on the selected row; pct null when diffMm is 0), or { id, failed: true }, or
 *   { id, pending: true } while the material is still computing.
 */
export function materialRows({ selectedId, selected, others }) {
  const eyes = EYES.filter((e) => okLens(selected?.[e]));
  if (eyes.length === 0) return [];
  const shown = (r) => (okLens(r) ? roundMm(thickest(r.metrics).value) : null);
  const eye = thickerEye({ OD: shown(selected.OD), OS: shown(selected.OS) });

  const rowOf = (id, pair, isSelected) => {
    if (!isSelected && pair === undefined) return { id, pending: true };
    if (!eyes.every((e) => okLens(pair?.[e]))) return { id, failed: true };
    const m = pair[eye].metrics;
    const t = thickest(m);
    return {
      id,
      eye,
      thickMm: roundMm(t.value),
      thickWhere: t.where,
      ctMm: roundMm(m.ct),
      weightG: eyes.reduce((sum, e) => sum + roundG(pair[e].metrics.weightG), 0),
      selected: isSelected,
    };
  };

  const sel = rowOf(selectedId, selected, true);
  // D-17 (02-12): a custom material is 'Ihre Auswahl' at the top and never a compared row; the
  // compared rows are always the six sourced MATERIALS, each against the custom values.
  const custom = selectedId === 'custom';
  const compared = Object.keys(MATERIALS).map((id) => {
    if (id === selectedId) return { ...sel, diffMm: null, diffG: null, pct: null };
    const row = rowOf(id, others?.[id], false);
    if (row.failed || row.pending) return row;
    const diffMm = roundMm(sel.thickMm - row.thickMm);
    return {
      ...row,
      diffMm,
      diffG: sel.weightG - row.weightG,
      pct: diffMm === 0 ? null : Math.round((diffMm / sel.thickMm) * 100),
    };
  });
  return custom ? [{ ...sel, diffMm: null, diffG: null, pct: null }, ...compared] : compared;
}

/**
 * Displayed values of one LensResult with the result cards' rounding: thick = roundMm of
 * thickest(m) (never the edge alone), ct = roundMm(CT), weight = whole grams. null when the lens
 * is not computed.
 * @param {object|null|undefined} res LensResult
 * @returns {{ thick: number, ct: number, weight: number } | null}
 */
export function displayedValues(res) {
  if (!okLens(res)) return null;
  const m = res.metrics;
  return { thick: roundMm(thickest(m).value), ct: roundMm(m.ct), weight: roundG(m.weightG) };
}

const CONFIG_ROWS = /** @type {const} */ ([
  ['thickOD', 'thick', 'OD'],
  ['thickOS', 'thick', 'OS'],
  ['ctOD', 'ct', 'OD'],
  ['ctOS', 'ct', 'OS'],
]);

/**
 * Configuration comparison (02-08, RES-03, D-28): Vorher (A) against Nachher (B), the same Rx,
 * from displayed values (displayedValues), so the differences on screen add up.
 *
 * - diff = b − a, rounded to the display step: negative = B thinner or lighter.
 * - An eye that is not computed in A or in B fails its rows; the weight and the summary then use
 *   the eyes computed in both, flagged partial.
 * - The summary eye is the thicker eye of B (the configuration the cards show by default; tie →
 *   OD), and thickDiffMm compares that same eye in A and B, never R against L (lens-critic
 *   MINOR-4, the materialRows rule).
 * - same: every computed row has difference 0.
 *
 * @param {{ OD: ReturnType<typeof displayedValues>, OS: ReturnType<typeof displayedValues> }} A
 * @param {typeof A} B
 * @returns {{ rows: object[], summary: { eye: 'OD'|'OS', thickDiffMm: number, weightDiffG: number,
 *   same: boolean, partial: boolean } | null }} rows: { id, a, b, diff } or { id, failed: true };
 *   weightBoth also carries partial: true when one eye is missing. summary null when no eye is
 *   computed in both.
 */
export function configDiff(A, B) {
  const eyes = EYES.filter((e) => A?.[e] && B?.[e]);
  const partial = eyes.length < 2;
  const rows = CONFIG_ROWS.map(([id, field, eye]) => {
    if (!eyes.includes(eye)) return { id, failed: true };
    const a = A[eye][field];
    const b = B[eye][field];
    return { id, a, b, diff: roundMm(b - a) };
  });
  if (eyes.length === 0) {
    rows.push({ id: 'weightBoth', failed: true });
    return { rows, summary: null };
  }
  const sum = (c) => eyes.reduce((s, e) => s + c[e].weight, 0);
  const wa = sum(A);
  const wb = sum(B);
  rows.push({ id: 'weightBoth', a: wa, b: wb, diff: wb - wa, ...(partial ? { partial: true } : {}) });
  const eye = thickerEye({ OD: B.OD && eyes.includes('OD') ? B.OD.thick : null, OS: B.OS && eyes.includes('OS') ? B.OS.thick : null });
  return {
    rows,
    summary: {
      eye,
      thickDiffMm: roundMm(B[eye].thick - A[eye].thick),
      weightDiffG: wb - wa,
      same: rows.every((r) => r.failed || r.diff === 0),
      partial,
    },
  };
}
