// Shared ENG-09 bench cases (01-14): one definition for the Node bench
// (test/bench/recompute.test.js), the page readouts (src/ui/main.js) and 01-11 case A.
// The page labels are built from these spec values, so changing a case here changes its label.

export const BENCH_RUNS = 50;

/**
 * @param {'OD'|'OS'} eye
 * @param {{ sph: number, cyl: number, axisDeg: number }} rx minus-cylinder form only (cyl ≤ 0)
 * @param {number} monoPD @param {string} materialId
 * @param {{ shape: string, A: number, B: number, DBL: number }} frame
 * @param {number|null} [fittingHeight] mm from the bottom of the box; the page sends null (D-04)
 */
export function specFor(eye, rx, monoPD, materialId, frame, fittingHeight = null) {
  return {
    eye,
    sph: rx.sph,
    cyl: rx.cyl,
    axisDeg: rx.axisDeg,
    materialId,
    frame,
    monoPD,
    fittingHeight,
    baseCurve: null,
    minCT: null,
    minET: null,
  };
}

const pair = (rx, monoPD, materialId, frame, fittingHeight = null) =>
  Object.freeze({
    OD: specFor('OD', rx, monoPD, materialId, frame, fittingHeight),
    OS: specFor('OS', rx, monoPD, materialId, frame, fittingHeight),
  });

// Canonical normal case: −4,00 / −2,00 × 30°, Rechteckig 52 × 38, DBL 18, PD 32, CR-39.
const NORMAL_RX = Object.freeze({ sph: -4, cyl: -2, axisDeg: 30 });
const NORMAL_FRAME = Object.freeze({ shape: 'rechteckig', A: 52, B: 38, DBL: 18 });
export const NORMAL_PAIR = pair(NORMAL_RX, 32, 'cr39', NORMAL_FRAME);

// Grenzfall (01-12 group G): the slowest pair by measured desktop median among the fuzz top 5 by
// pair CT iterations: +10,75 −1,00 × 89, 1,67, rechteckig 43 × 43, DBL 21, PD 36, FH 0.
const GRENZFALL_RX = Object.freeze({ sph: 10.75, cyl: -1, axisDeg: 89 });
const GRENZFALL_FRAME = Object.freeze({ shape: 'rechteckig', A: 43, B: 43, DBL: 21 });
export const GRENZFALL_PAIR = pair(GRENZFALL_RX, 36, 'idx167', GRENZFALL_FRAME, 0);

/**
 * The normal pair with frame.A = 52 + 0,001·(k + 1): a new outline-cache key per k, so each
 * evaluation builds the outline once (outline.js caches by shape|A|B|n). Callers never reuse k.
 * @param {number} k
 */
export function frameMissPair(k) {
  const frame = Object.freeze({ ...NORMAL_FRAME, A: 52 + 0.001 * (k + 1) });
  return pair(NORMAL_RX, 32, 'cr39', frame);
}
