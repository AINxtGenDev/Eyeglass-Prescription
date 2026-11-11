// VIZ-01 (03-02) D-04(c): the linear interpolation between mesh vertices stays close to the
// analytic surfaces. User decision 2026-11-08 (split tolerance): ≤ 0,01 mm for nₑ ≥ 1,49;
// documented ≤ 0,025 mm for custom nₑ < 1,49 (raising RINGS to 128 still gives 0,0127 mm,
// 03-RESEARCH Pattern 1 table, Pitfall 4).
//
// 03-LC (lens-critic result review M1): that bound does NOT hold over the whole input domain. A
// full scan of the grid below (58 552 computable lenses, 2026-11-09, this probe) measured:
// - nₑ ≥ 1,49, etMax ≤ 31 mm: every lens ≤ 0,01 mm. Between etMax 31,1 and 34,9 mm, 10 of
//   51 397 lenses exceed it (worst 0,0174 mm, CR-39 panto 62×40/18 PD 40 −12 −6 × 30, etMax
//   34,92). Above etMax 35 mm (879 lenses) the worst is 0,1062 mm (1,74 rechteckig 58×50/24 PD 25
//   −12 −6 × 30, etMax 58,6). Off the grid the same lens at axis 150 reaches 0,1169 mm (0,204 %,
//   lens-critic re-review 2026-11-11): within the accepted bound only through its 0,6 % clause.
// - custom nₑ 1,40: etMax ≤ 35 mm all ≤ 0,025 mm (worst 0,0162); above, worst 0,0426 mm
//   (rechteckig 62×55/18 PD 25 −6 −3 × 30, etMax 57,6).
// - Worst error / local analytic thickness at the same point, over all lenses: 0,56 %.
// The error sits where the spoke spacing meets the steep back curve (angular, so more rings do
// not help). The restated bound needs the user's re-acceptance; until then this file asserts the
// measured behaviour: the bound where it holds, and regression guards (the measured worst,
// rounded up; NOT accepted bounds) everywhere else.
//
// Probe: 10 barycentric points per triangle of FRONT_INDEX (BACK_INDEX is the same triangle set):
// the 3 edge midpoints, the centroid and the 6 permutations of (1/2, 1/3, 1/6). lens-critic
// MINOR 13: midpoints + centroid alone can miss the per-triangle maximum by about 3 %; the old
// 4-point worst is logged next to the 10-point worst.
import { describe, it, expect } from 'vitest';
import { evaluateLens } from '../evaluate.js';
import { frontSagAt, backSagAt } from '../design.js';
import { frameOutline } from '../frame/outline.js';
import { MATERIALS } from '../materials.js';
import { FRONT_INDEX } from './topology.js';
import { allocLensBuffers, buildLensMesh } from './lens.js';

const STRICT_MM = 0.01; // nₑ ≥ 1,49
const LOW_INDEX_MM = 0.025; // custom nₑ < 1,49, documented, user-accepted 2026-11-08

const lens = (o = {}) => ({
  eye: 'OD',
  sph: -2.75,
  cyl: -0.5,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const custom = (ne, o = {}) =>
  lens({ materialId: 'custom', customMaterial: { ne, density: 1.3, ve: null }, minCT: 2, minET: 1.2, ...o });

const H = 1 / 2;
const T = 1 / 3;
const S = 1 / 6;
// first 4 = the old probe (3 edge midpoints + centroid)
const BARY = [
  [H, H, 0],
  [0, H, H],
  [H, 0, H],
  [T, T, T],
  [H, T, S],
  [H, S, T],
  [T, H, S],
  [T, S, H],
  [S, H, T],
  [S, T, H],
];

const OUT = allocLensBuffers();

/** Max |Δz| of front and back, { p10, p4 }, and the max of |Δz| / local thickness (fraction). */
function maxSagError(s, outline) {
  const res = buildLensMesh(s, outline, OUT);
  expect(res.finite).toBe(true);
  const { front: F, back: B } = OUT;
  let p10 = 0;
  let p4 = 0;
  let fraction = 0;
  for (let t = 0; t < FRONT_INDEX.length; t += 3) {
    const a = 3 * FRONT_INDEX[t];
    const b = 3 * FRONT_INDEX[t + 1];
    const c = 3 * FRONT_INDEX[t + 2];
    for (let q = 0; q < BARY.length; q++) {
      const [l1, l2, l3] = BARY[q];
      const x = l1 * F[a] + l2 * F[b] + l3 * F[c];
      const y = l1 * F[a + 1] + l2 * F[b + 1] + l3 * F[c + 1];
      const zf = l1 * F[a + 2] + l2 * F[b + 2] + l3 * F[c + 2];
      const zb = l1 * B[a + 2] + l2 * B[b + 2] + l3 * B[c + 2];
      const sf = frontSagAt(s, x, y);
      const sb = backSagAt(s, x, y);
      const e = Math.max(Math.abs(zf + sf), Math.abs(zb + s.ct + sb));
      if (!(e <= 1)) expect({ t, q, e }).toBe('finite small error'); // NaN guard
      if (e > p10) p10 = e;
      if (q < 4 && e > p4) p4 = e;
      // 03-LC M1: the error as a fraction of the analytic thickness at the same point
      const f = e / (s.ct + sb - sf);
      if (f > fraction) fraction = f;
    }
  }
  return { p10, p4, fraction };
}

const NAMED_STRICT = [
  ['−10 CR-39 rechteckig 62×55/14 PD 25', lens({ sph: -10, cyl: 0, frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 14 }, monoPD: 25 })],
  ['−10 −6 × 45 idx174 rechteckig 40×28/18 PD 40', lens({ sph: -10, cyl: -6, axisDeg: 45, materialId: 'idx174', frame: { shape: 'rechteckig', A: 40, B: 28, DBL: 18 }, monoPD: 40 })],
  ['Grenzfall +10,75 −1,00 × 89 idx167 rechteckig 43×43/21 PD 36', lens({ sph: 10.75, cyl: -1, axisDeg: 89, materialId: 'idx167', frame: { shape: 'rechteckig', A: 43, B: 43, DBL: 21 }, monoPD: 36 })],
  ['+7,50 −5,75 × 148 trivex rechteckig 62×55/23 PD 31', lens({ sph: 7.5, cyl: -5.75, axisDeg: 148, materialId: 'trivex', frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 23 }, monoPD: 31 })],
  ['Expert: manual base curve 0, sph −6', lens({ sph: -6, baseCurve: 0 })],
  // base curve 10 at sph −6 is BACK_SAG_UNDEFINED in 52×38; 46×32 is the nearest size that computes
  ['Expert: manual base curve 10, sph −6, rechteckig 46×32/18', lens({ sph: -6, baseCurve: 10, frame: { shape: 'rechteckig', A: 46, B: 32, DBL: 18 } })],
  ['Expert: front conic k −1, sph −6', lens({ sph: -6, frontConic: -1 })],
  ['Expert: front conic k −5, sph −6', lens({ sph: -6, frontConic: -5 })],
  ['Expert: custom nₑ 1,49, sph −6', custom(1.49, { sph: -6 })],
  ['Expert: custom nₑ 1,9, sph −6', custom(1.9, { sph: -6 })],
];

// Plus the large-frame case of the research worst (62×55/14 PD 25); at sph −12 it is not computable.
const BIG = { frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 14 }, monoPD: 25, cyl: 0 };
const NAMED_CUSTOM_LOW = [1.4, 1.43].flatMap((ne) => [
  ...[-6, -12].map((sph) => [`custom nₑ ${ne} sph ${sph}`, custom(ne, { sph })]),
  ...[-6, -12].map((sph) => [`custom nₑ ${ne} sph ${sph} rechteckig 62×55/14 PD 25`, custom(ne, { sph, ...BIG })]),
  // scan worst of 410 computable low-index lenses (executor scratch scan 2026-11-08, 4-point probe 0,0231 mm)
  [`custom nₑ ${ne} sph −6 −3 × 45 rechteckig 62×55/14 PD 25`, custom(ne, { sph: -6, ...BIG, cyl: -3, axisDeg: 45 })],
]);

/** Runs a set; returns counts and the worst values. Non-ok results are skipped and counted. */
function runSet(name, specs, bound) {
  let ok = 0;
  let skipped = 0;
  let worst = 0;
  let worst4 = 0;
  for (const [label, spec] of specs) {
    const r = evaluateLens(spec);
    if (!r.ok) {
      skipped++;
      continue;
    }
    ok++;
    const outline = frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye);
    const { p10, p4 } = maxSagError(r.surfaces, outline);
    if (!(p10 <= bound)) expect({ label, p10 }).toEqual({ label, p10: `≤ ${bound}` });
    worst = Math.max(worst, p10);
    worst4 = Math.max(worst4, p4);
  }
  console.info(`[03-02] D-04(c) ${name}: ok ${ok}, skipped ${skipped}, worst 10-point ${worst} mm, worst 4-point ${worst4} mm`);
  return { ok, skipped, worst };
}

// ---- 03-LC (lens-critic M1): deterministic grid instead of the seeded 50-sample fuzz ----
// The lens-critic scan grid: 4 shapes × 3 sizes × DBL 14/18/24 × PD 25/32/40 × Sph −12…+6 ×
// (Cyl 0, or Cyl −3/−6 × axes 0/30/45/60/90/135/170) = 9 720 specs per material. The full grid
// (all 6 listed materials + custom nₑ 1,40) costs about 30 min, so the test runs a stride sample
// of it (stride 557, prime, so every dimension cycles through all its values) per material, plus
// every full-scan lens that exceeds the bound at etMax ≤ 35 mm and each material's full-scan
// worst above 35 mm.
const SHAPES = ['rechteckig', 'rund', 'panto', 'pilot'];
const SIZES = [
  [62, 55],
  [58, 50],
  [62, 40],
];
const DBLS = [14, 18, 24];
const PDS = [25, 32, 40];
const SPHS = [-12, -9, -6, -3, 3, 6];
const CYL_AXES = [[0, 0], ...[-3, -6].flatMap((c) => [0, 30, 45, 60, 90, 135, 170].map((a) => [c, a]))];
const GRID_N = SHAPES.length * SIZES.length * DBLS.length * PDS.length * SPHS.length * CYL_AXES.length;
const STRIDE = 557;
const LOW_NE = 1.4; // the lowest custom nₑ the form accepts (validate.js CUSTOM_RANGES.ne error range)

/** Spec of grid index i (mixed radix, CYL_AXES fastest) for a material id or 'custom'. */
function gridSpec(i, materialId) {
  const pick = (arr) => {
    const v = arr[i % arr.length];
    i = Math.floor(i / arr.length);
    return v;
  };
  const [cyl, axisDeg] = pick(CYL_AXES);
  const sph = pick(SPHS);
  const monoPD = pick(PDS);
  const DBL = pick(DBLS);
  const [A, B] = pick(SIZES);
  const shape = pick(SHAPES);
  return gridLens(materialId, { shape, A, B, DBL, monoPD, sph, cyl, axisDeg });
}
function gridLens(materialId, { shape, A, B, DBL, monoPD, sph, cyl, axisDeg }) {
  const o = { sph, cyl, axisDeg, frame: { shape, A, B, DBL }, monoPD };
  return materialId === 'custom' ? custom(LOW_NE, o) : lens({ ...o, materialId });
}
const label = (m, s) => `${m} ${s.frame.shape} ${s.frame.A}×${s.frame.B}/${s.frame.DBL} PD ${s.monoPD} ${s.sph} ${s.cyl} × ${s.axisDeg}`;

const GRID_MATERIALS = [...Object.keys(MATERIALS), 'custom'];
/** Full-scan rows (2026-11-09): [material, shape, A, B, DBL, PD, sph, cyl, axis, measured mm, etMax]. */
const SCAN_OVER_BELOW_35 = [
  ['pc', 'panto', 62, 55, 24, 40, -12, -6, 135, 0.01109, 31.1],
  ['idx160', 'panto', 62, 55, 14, 40, -12, -6, 60, 0.01093, 31.54],
  ['trivex', 'rechteckig', 58, 50, 24, 40, -9, -6, 60, 0.01025, 32.51],
  ['trivex', 'rechteckig', 58, 50, 24, 40, -12, -3, 60, 0.0106, 32.75],
  ['cr39', 'pilot', 62, 55, 14, 40, -12, -3, 45, 0.01021, 32.98],
  ['trivex', 'pilot', 58, 50, 14, 32, -9, -6, 60, 0.01062, 33.39],
  ['trivex', 'pilot', 58, 50, 14, 32, -12, -3, 60, 0.01102, 33.44],
  ['trivex', 'panto', 62, 40, 24, 40, -12, -3, 60, 0.01105, 34.01],
  ['idx167', 'rechteckig', 62, 55, 18, 40, -12, -6, 60, 0.01273, 34.62],
  ['cr39', 'panto', 62, 40, 18, 40, -12, -6, 30, 0.01736, 34.92],
];
const SCAN_WORST_ABOVE_35 = [
  ['cr39', 'rechteckig', 58, 50, 24, 40, -12, -3, 30, 0.06981, 40.41],
  ['trivex', 'rechteckig', 62, 40, 24, 32, -9, -6, 30, 0.05486, 53.24],
  ['pc', 'panto', 58, 50, 14, 32, -12, -6, 30, 0.03893, 37.26],
  ['idx160', 'pilot', 62, 55, 18, 32, -12, -3, 45, 0.01917, 41.28],
  ['idx167', 'panto', 62, 40, 14, 25, -12, -3, 60, 0.01973, 45.99],
  ['idx174', 'rechteckig', 58, 50, 24, 25, -12, -6, 30, 0.10618, 58.6],
  ['custom', 'rechteckig', 62, 55, 18, 25, -6, -3, 30, 0.04262, 57.62],
  // lens-critic re-review 2026-11-11 (MINOR 3): off the grid's axes, axis 150 is worse than the
  // grid worst: 0,1169 mm at 0,204 % of local thickness (accepted bound: ≤ 0,11 mm OR ≤ 0,6 %).
  ['idx174', 'rechteckig', 58, 50, 24, 25, -12, -6, 150, 0.11686, 58.6],
  ['custom', 'rechteckig', 62, 55, 18, 25, -6, -3, 150, 0.04466, 57.62],
];
const scanSpec = ([m, shape, A, B, DBL, monoPD, sph, cyl, axisDeg]) => gridLens(m, { shape, A, B, DBL, monoPD, sph, cyl, axisDeg });

/** Where D-04(c) holds over the whole scanned grid (no exceedance at etMax ≤ 31 mm; first at 31,1). */
const ETMAX_HOLDS_MM = 31;
/** Regression guards (measured full-scan worst, rounded up), NOT accepted bounds. */
const GUARD_TO_35_MM = 0.02; // nₑ ≥ 1,49, 31 < etMax ≤ 35: measured 0,0174
const GUARD_ABOVE_35_MM = 0.12; // nₑ ≥ 1,49, etMax > 35: grid 0,1062, off-grid axis 150 0,1169
const GUARD_LOW_ABOVE_35_MM = 0.045; // custom nₑ 1,40, etMax > 35: measured 0,0426
const GUARD_FRACTION = 0.006; // error / local thickness at the same point: measured 0,0056

/**
 * Checks every computable spec against the region rule; returns the worst values per region.
 * low = custom nₑ < 1,49. Regions: etMax ≤ 31 (strict) → D-04(c); 31 < etMax ≤ 35 → D-04(c) for
 * low, guard for strict; etMax > 35 → guard.
 */
function runGrid(name, specs) {
  const worst = { holds: null, to35: null, above35: null, fraction: 0 };
  let ok = 0;
  let skipped = 0;
  for (const [lbl, spec] of specs) {
    const r = evaluateLens(spec);
    if (!r.ok) {
      skipped++;
      continue;
    }
    ok++;
    const low = spec.materialId === 'custom' && spec.customMaterial.ne < 1.49;
    const et = r.metrics.etMax.value;
    const outline = frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye);
    const { p10, fraction } = maxSagError(r.surfaces, outline);
    const region = et <= ETMAX_HOLDS_MM ? 'holds' : et <= 35 ? 'to35' : 'above35';
    const limit =
      region === 'above35'
        ? low
          ? GUARD_LOW_ABOVE_35_MM
          : GUARD_ABOVE_35_MM
        : low
          ? LOW_INDEX_MM
          : region === 'holds'
            ? STRICT_MM
            : GUARD_TO_35_MM;
    if (!(p10 <= limit)) expect({ lbl, etMax: et, p10 }).toEqual({ lbl, etMax: et, p10: `≤ ${limit} (${region})` });
    if (!(fraction <= GUARD_FRACTION)) expect({ lbl, fraction }).toEqual({ lbl, fraction: `≤ ${GUARD_FRACTION}` });
    if (!worst[region] || p10 > worst[region].mm) worst[region] = { mm: p10, etMax: et, lbl };
    worst.fraction = Math.max(worst.fraction, fraction);
  }
  console.info(`[03-LC] D-04(c) grid ${name}: ok ${ok}, skipped ${skipped}, worst ${JSON.stringify(worst)}`);
  return { ok, skipped, worst };
}

describe('VIZ-01 tessellation bound D-04(c)', () => {
  it('named extremes and Expert overrides (nₑ ≥ 1,49): max sag error ≤ 0.01 mm', () => {
    const { ok } = runSet('NAMED_STRICT', NAMED_STRICT, STRICT_MM);
    expect(ok).toBe(NAMED_STRICT.length);
  });

  it('custom nₑ < 1,49: max sag error ≤ documented 0,025 mm (user-accepted 2026-11-08)', () => {
    const { ok } = runSet('NAMED_CUSTOM_LOW', NAMED_CUSTOM_LOW, LOW_INDEX_MM);
    expect(ok).toBeGreaterThanOrEqual(1);
  });

  it('the stride sample covers every grid value', () => {
    const seen = { shape: new Set(), size: new Set(), DBL: new Set(), PD: new Set(), sph: new Set(), cylAx: new Set() };
    for (const m of GRID_MATERIALS) {
      for (const [, s] of strideSample(m)) {
        seen.shape.add(s.frame.shape);
        seen.size.add(`${s.frame.A}×${s.frame.B}`);
        seen.DBL.add(s.frame.DBL);
        seen.PD.add(s.monoPD);
        seen.sph.add(s.sph);
        seen.cylAx.add(`${s.cyl}/${s.axisDeg}`);
      }
    }
    expect([seen.shape.size, seen.size.size, seen.DBL.size, seen.PD.size, seen.sph.size, seen.cylAx.size]).toEqual([
      SHAPES.length,
      SIZES.length,
      DBLS.length,
      PDS.length,
      SPHS.length,
      CYL_AXES.length,
    ]);
  });

  // One test per material keeps each well under the 30 s testTimeout.
  for (const m of GRID_MATERIALS) {
    it(`grid stride sample, ${m === 'custom' ? `custom nₑ ${LOW_NE}` : m}: D-04(c) where it holds, guards elsewhere`, () => {
      const { ok } = runGrid(m, strideSample(m));
      expect(ok).toBeGreaterThanOrEqual(10);
    });
  }

  it('full-scan exceedances at etMax ≤ 35 mm: reproduce, and stay under the 0,02 mm guard', () => {
    for (const row of SCAN_OVER_BELOW_35) {
      const spec = scanSpec(row);
      const r = evaluateLens(spec);
      expect(r.ok, label(row[0], spec)).toBe(true);
      const { p10 } = maxSagError(r.surfaces, frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye));
      expect(r.metrics.etMax.value).toBeCloseTo(row[10], 1);
      expect(p10, label(row[0], spec)).toBeCloseTo(row[9], 4);
      expect(p10).toBeGreaterThan(STRICT_MM);
      expect(p10).toBeLessThanOrEqual(GUARD_TO_35_MM);
    }
  });

  it('full-scan worst above etMax 35 mm per material: reproduce, and stay under the guards', () => {
    for (const row of SCAN_WORST_ABOVE_35) {
      const spec = scanSpec(row);
      const r = evaluateLens(spec);
      expect(r.ok, label(row[0], spec)).toBe(true);
      const { p10 } = maxSagError(r.surfaces, frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye));
      expect(r.metrics.etMax.value).toBeGreaterThan(35);
      expect(p10, label(row[0], spec)).toBeCloseTo(row[9], 4);
      expect(p10).toBeLessThanOrEqual(row[0] === 'custom' ? GUARD_LOW_ABOVE_35_MM : GUARD_ABOVE_35_MM);
    }
  });
});

/** Stride sample of the grid for one material; the offset differs per material. */
function strideSample(m) {
  const off = GRID_MATERIALS.indexOf(m) * 41;
  const out = [];
  for (let k = 0; k * STRIDE < GRID_N; k++) {
    const spec = gridSpec((off + k * STRIDE) % GRID_N, m);
    out.push([label(m, spec), spec]);
  }
  return out;
}
