// Thickest point, display rounding and the left/right difference rule (02-01, RES-01, RES-04).
// Pure: no DOM, no i18n text. Returns codes; src/ui turns them into German.

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
