// VIZ-01 (03-02) D-04(c): the linear interpolation between mesh vertices stays close to the
// analytic surfaces. User decision 2026-11-08 (split tolerance): ≤ 0,01 mm for nₑ ≥ 1,49;
// documented ≤ 0,025 mm for custom nₑ < 1,49 (raising RINGS to 128 still gives 0,0127 mm,
// 03-RESEARCH Pattern 1 table, Pitfall 4).
//
// Probe: 10 barycentric points per triangle of FRONT_INDEX (BACK_INDEX is the same triangle set):
// the 3 edge midpoints, the centroid and the 6 permutations of (1/2, 1/3, 1/6). lens-critic
// MINOR 13: midpoints + centroid alone can miss the per-triangle maximum by about 3 %; the old
// 4-point worst is logged next to the 10-point worst.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

/** Max |Δz| of front and back, { p10, p4 }. */
function maxSagError(s, outline) {
  const res = buildLensMesh(s, outline, OUT);
  expect(res.finite).toBe(true);
  const { front: F, back: B } = OUT;
  let p10 = 0;
  let p4 = 0;
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
      const e = Math.max(Math.abs(zf + frontSagAt(s, x, y)), Math.abs(zb + s.ct + backSagAt(s, x, y)));
      if (!(e <= 1)) expect({ t, q, e }).toBe('finite small error'); // NaN guard
      if (e > p10) p10 = e;
      if (q < 4 && e > p4) p4 = e;
    }
  }
  return { p10, p4 };
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

// Seeded fuzz over the diagnostics.test.js domain (tier 4), sourced materials, all 4 shapes.
const specArb = fc
  .record({
    eye: fc.constantFrom('OD', 'OS'),
    sph: fc.integer({ min: -48, max: 48 }).map((k) => k / 4),
    cyl: fc.integer({ min: -24, max: 0 }).map((k) => k / 4 + 0),
    axisDeg: fc.integer({ min: 0, max: 179 }),
    materialId: fc.constantFrom(...Object.keys(MATERIALS)),
    shape: fc.constantFrom('rund', 'rechteckig', 'panto', 'pilot'),
    A: fc.integer({ min: 40, max: 62 }),
    B: fc.integer({ min: 28, max: 55 }),
    DBL: fc.integer({ min: 14, max: 24 }),
    monoPD: fc.integer({ min: 25, max: 40 }),
  })
  .map(({ shape, A, B, DBL, ...rx }) => lens({ ...rx, frame: { shape, A, B, DBL } }));
const FUZZ = fc.sample(specArb, { numRuns: 50, seed: 30304 });

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

const fuzzSet = (from, to) => FUZZ.slice(from, to).map((s, i) => [`fuzz #${from + i}`, s]);

describe('VIZ-01 tessellation bound D-04(c)', () => {
  it('named extremes and Expert overrides (nₑ ≥ 1,49): max sag error ≤ 0.01 mm', () => {
    const { ok } = runSet('NAMED_STRICT', NAMED_STRICT, STRICT_MM);
    expect(ok).toBe(NAMED_STRICT.length);
  });

  it('custom nₑ < 1,49: max sag error ≤ documented 0,025 mm (user-accepted 2026-11-08)', () => {
    const { ok } = runSet('NAMED_CUSTOM_LOW', NAMED_CUSTOM_LOW, LOW_INDEX_MM);
    expect(ok).toBeGreaterThanOrEqual(1);
  });

  // Two chunks of the same seeded sample, so each stays well under the 30 s testTimeout.
  let fuzzOk = 0;
  it('seeded fuzz (seed 30304) samples 1–25: max sag error ≤ 0.01 mm', () => {
    fuzzOk += runSet('FUZZ 1–25', fuzzSet(0, 25), STRICT_MM).ok;
  });
  it('seeded fuzz (seed 30304) samples 26–50: max sag error ≤ 0.01 mm; ≥ 40 of 50 computable', () => {
    fuzzOk += runSet('FUZZ 26–50', fuzzSet(25, 50), STRICT_MM).ok;
    expect(fuzzOk).toBeGreaterThanOrEqual(40);
  });
});
