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
 * @param {{ baseCurve?: number|null, minCT?: number|null, minET?: number|null, frontConic?: number|null,
 *   customMaterial?: { ne: number, density: number, ve: number|null } | null }} [overrides]
 *   Expert overrides (02-10, MAT-03/04); missing = null. The key order never changes (cache key).
 *   frontConic (02-11, MAT-05) is appended as the last key only when it is a non-zero finite
 *   number: the phase-1 bench keys and the 02-10 JSON stay identical, and k = 0 shares the cache
 *   entry with the sphere (the engine treats null and 0 the same).
 *   customMaterial (02-12, MAT-06) is appended last only when materialId is 'custom' (a listed
 *   material never carries it, so those keys stay byte-identical).
 */
export function specFor(eye, rx, monoPD, materialId, frame, fittingHeight = null, overrides = {}) {
  const spec = {
    eye,
    sph: rx.sph,
    cyl: rx.cyl,
    axisDeg: rx.axisDeg,
    materialId,
    frame,
    monoPD,
    fittingHeight,
    baseCurve: overrides.baseCurve ?? null,
    minCT: overrides.minCT ?? null,
    minET: overrides.minET ?? null,
  };
  const k = overrides.frontConic;
  if (Number.isFinite(k) && k !== 0) spec.frontConic = k;
  if (materialId === 'custom') spec.customMaterial = overrides.customMaterial ?? null;
  return spec;
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

// Rescan-path pair (01-12-SUMMARY finding for ENG-09): about 0,07 % of eyes in the fuzz domain
// compute only through the 136-point rescan, with 163–179 evaluations per eye. The slowest timed
// one: +11,75 −5,25 × 5, CR-39, rund 43 × 55, DBL 20, PD 27, FH 0. The page cannot enter it
// (no fitting-height field, D-04), so it is a worker bench readout only.
const RESCAN_RX = Object.freeze({ sph: 11.75, cyl: -5.25, axisDeg: 5 });
const RESCAN_FRAME = Object.freeze({ shape: 'rund', A: 43, B: 55, DBL: 20 });
export const RESCAN_PAIR = pair(RESCAN_RX, 27, 'cr39', RESCAN_FRAME, 0);

/**
 * Bench pair by case id (worker bench jobs, 01-15). k is the frame-miss counter.
 * @param {'normal'|'frameMiss'|'grenzfall'|'rescan'} caseId @param {number} k
 */
export function benchPair(caseId, k) {
  switch (caseId) {
    case 'normal':
      return NORMAL_PAIR;
    case 'frameMiss':
      return frameMissPair(k);
    case 'grenzfall':
      return GRENZFALL_PAIR;
    case 'rescan':
      return RESCAN_PAIR;
    default:
      throw new Error(`unknown bench case: ${caseId}`);
  }
}

/** Median of an ascending array. */
export const medianOf = (sorted) => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

/** Nearest-rank percentile of an ascending array (p95 of 50 runs = the 48th value). */
export const tailOf = (sorted, pct) => sorted[Math.ceil((pct / 100) * sorted.length) - 1];
