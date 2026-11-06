import { describe, it, expect } from 'vitest';
import { DIAGNOSTICS, diag, STOCK_BLANK_MAX_MM } from './diagnostics.js';

describe('ENG-07 catalogue', () => {
  it('diag() builds a coded diagnostic', () => {
    expect(diag('CT_SET_BY_MIN_ET', {})).toEqual({
      code: 'CT_SET_BY_MIN_ET',
      severity: 'info',
      data: {},
    });
    expect(diag('INVALID_SPEC')).toEqual({ code: 'INVALID_SPEC', severity: 'error', data: {} });
  });
  it('diag() throws on an unknown code', () => {
    expect(() => diag('NOPE')).toThrow();
  });
  it('BASE_CURVE_CLAMPED is removed (D-01 final)', () => {
    expect(Object.keys(DIAGNOSTICS)).not.toContain('BASE_CURVE_CLAMPED');
  });
  it('every entry is frozen with a valid severity', () => {
    expect(Object.isFrozen(DIAGNOSTICS)).toBe(true);
    for (const [code, entry] of Object.entries(DIAGNOSTICS)) {
      expect(Object.isFrozen(entry), code).toBe(true);
      expect(['error', 'warn', 'info']).toContain(entry.severity);
    }
  });
  it('severities match the catalogue', () => {
    expect(DIAGNOSTICS.BLANK_EXCEEDS_STOCK.severity).toBe('warn');
    expect(DIAGNOSTICS.OC_OUTSIDE_OUTLINE.severity).toBe('warn');
    expect(DIAGNOSTICS.FRONT_SAG_UNDEFINED.severity).toBe('error');
    expect(DIAGNOSTICS.NON_FINITE_RESULT.severity).toBe('error');
    expect(DIAGNOSTICS.CT_SET_BY_MIN_CT.severity).toBe('info');
    expect(STOCK_BLANK_MAX_MM).toBe(75);
  });
});

// ---------------------------------------------------------------------------------------------
// 01-10 Task 1: remaining triggers, D-01 final pins, optimality, rescue count, fuzz.
// ---------------------------------------------------------------------------------------------
import fc from 'fast-check';
import { evaluateLens, evaluatePair } from './evaluate.js';
import { optimiseBaseCurve, FLAT_FRONT_TOLERANCE_MM as TAU } from './solve.js';
import { baseCurveAuto, sphericalEquivalent, FRONT_RADIUS_MARGIN_MM } from './power.js';
import { frameOutline } from './frame/outline.js';
import { maxRadiusFromOC } from './metrics.js';
import { MATERIALS } from './materials.js';

const lens = (o = {}) => ({
  eye: 'OD',
  sph: 0,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 24 },
  monoPD: 25,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const frame = (shape, A, B, DBL) => ({ shape, A, B, DBL });

/** J = max(CT, largest edge thickness), the quantity the D-01 search minimises. */
const maxThickness = (r) => Math.max(r.metrics.ct, r.metrics.etMax.value);

const SWEEP = [];
for (let k = 10; k <= 280; k++) SWEEP.push(k / 20); // 0.50, 0.55, …, 14.00 (271 values, 01-12)
expect(SWEEP).toHaveLength(271);

/** A manual result counts only with a non-convex back (01-12, GAP-1). */
const okNonConvex = (r) => r.ok && Math.max(r.intermediates.D2a, r.intermediates.D2b) <= 0;

/**
 * Rescue oracle: first manual D1 of the 271-value sweep that computes with a non-convex back, or
 * null. Not capped at maxD1 (lens-critic MINOR-1): the impossibility claim covers the whole
 * automatic range. A rescue is a search bug to fix in solve.js, not a test to relax.
 */
const manualSweepRescues = (spec) => {
  for (const baseCurve of SWEEP) if (okNonConvex(evaluateLens({ ...spec, baseCurve }))) return baseCurve;
  return null;
};
/**
 * Optimality oracle: minimum J over the non-convex ok results with D1 ≤ the spec's maxD1
 * (Infinity if none). The search minimises over [0.50, maxD1] (FRONT_RADIUS_MARGIN_MM); the
 * margin-free rescan and bisection only decide feasibility when nothing in that domain computes.
 */
const manualSweepMin = (spec) => {
  let m = Infinity;
  for (const baseCurve of SWEEP) {
    const r = evaluateLens({ ...spec, baseCurve });
    if (!okNonConvex(r)) continue;
    const { maxD1 } = baseCurveAuto(0, { n: r.intermediates.n, rhoMax: r.intermediates.rhoMax });
    if (baseCurve <= maxD1 + 1e-12 && maxThickness(r) < m) m = maxThickness(r);
  }
  return m;
};

const errors = (r) => r.diagnostics.filter((d) => d.severity === 'error');
const codes = (r) => r.diagnostics.map((d) => d.code);

// Rule every automatic result must satisfy (fuzz and extremes grid).
function checkRule(r) {
  const json = JSON.stringify(r);
  expect(json).not.toContain('NaN');
  expect(json).not.toContain('Infinity');
  if (r.ok) {
    expect(r.diagnostics.every((d) => d.severity !== 'error')).toBe(true);
    const walk = (v, path) => {
      if (typeof v === 'number') expect(Number.isFinite(v), path).toBe(true);
      else if (v === null || v === undefined) expect.fail(`metrics field ${path} is ${v}`);
      else if (typeof v === 'object') for (const [k, w] of Object.entries(v)) walk(w, `${path}.${k}`);
    };
    walk(r.metrics, 'metrics');
    // GAP-1 (01-12): every back principal power ≤ 0 (plano allowed)
    expect(Math.max(r.intermediates.D2a, r.intermediates.D2b)).toBeLessThanOrEqual(0);
  } else {
    expect(r.diagnostics).toHaveLength(1);
    expect(errors(r)).toHaveLength(1);
    expect(Object.keys(DIAGNOSTICS)).toContain(r.diagnostics[0].code);
    expect(r.diagnostics[0].code).not.toBe('FRONT_SAG_UNDEFINED');
    expect(r.metrics).toBe(null);
  }
}

const SC4 = lens({ sph: -12, cyl: -6, axisDeg: 10, frame: frame('rechteckig', 62, 55, 18), monoPD: 32 });

describe('ENG-07 diagnostics', () => {
  it('SC-4 / ENG-07 demo: −12,00 −6,00 × 10 in rechteckig 62×55/18, PD 32, CR-39 is impossible for every D1', () => {
    const r = evaluateLens(SC4);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'BACK_SAG_UNDEFINED',
      severity: 'error',
      data: { meridian: 'cross', searched: true },
    });
    expect(r.metrics).toBe(null);
    expect(manualSweepRescues(SC4)).toBe(null);
    console.log('[01-10] SC-4 demo: failing meridian', r.diagnostics[0].data.meridian, 'axis', r.diagnostics[0].data.axisDeg);
  });

  it('ENG-07 truthful suggestions for the SC-4 demo (1,74; smaller frames compute; rund of the same size does not)', () => {
    const hi = evaluateLens({ ...SC4, materialId: 'idx174' });
    const small = evaluateLens({ ...SC4, frame: frame('rechteckig', 50, 40, 18) });
    const round = evaluateLens({ ...SC4, frame: frame('rund', 48, 44, 20) });
    const sameRound = evaluateLens({ ...SC4, frame: frame('rund', 62, 55, 18) });
    expect(hi.ok).toBe(true);
    expect(small.ok).toBe(true);
    expect(round.ok).toBe(true);
    expect(sameRound.ok).toBe(false);
    expect(sameRound.diagnostics[0].code).toBe('BACK_SAG_UNDEFINED');
    expect(manualSweepRescues({ ...SC4, frame: frame('rund', 62, 55, 18) })).toBe(null);
    console.log('[01-10] SC-4 suggestions: 1.74 CT', hi.metrics.ct, 'J', maxThickness(hi), '| 50×40 J', maxThickness(small), '| rund 48×44 J', maxThickness(round));
  });

  it('ENG-07 manual base curve: FRONT_SAG_UNDEFINED, and its suggestions compute', () => {
    const s = lens({ sph: 4, baseCurve: 10 });
    const r = evaluateLens(s);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0].code).toBe('FRONT_SAG_UNDEFINED');
    expect(r.diagnostics[0].data.R1).toBeCloseTo(50, 9);
    expect(r.diagnostics[0].data.rhoMax).toBeGreaterThan(50);
    const hi = evaluateLens({ ...s, materialId: 'idx174' });
    expect(hi.ok).toBe(true);
    expect(hi.intermediates.R1).toBeCloseTo(73.8, 9);
    expect(evaluateLens({ ...s, frame: frame('rechteckig', 50, 40, 24) }).ok).toBe(true);
    expect(evaluateLens({ ...s, baseCurve: 6 }).ok).toBe(true);
  });

  it('ENG-07 OC_OUTSIDE_OUTLINE: fitting height above the box is a warning, numbers stay', () => {
    const r = evaluateLens(lens({ sph: -2, frame: frame('rechteckig', 52, 30, 18), monoPD: 32, fittingHeight: 40 }));
    expect(r.ok).toBe(true);
    const w = r.diagnostics.find((d) => d.code === 'OC_OUTSIDE_OUTLINE');
    expect(w).toEqual({ code: 'OC_OUTSIDE_OUTLINE', severity: 'warn', data: { x: 3, y: 25 } });
    const inside = evaluateLens(lens({ sph: -2, frame: frame('rechteckig', 52, 30, 18), monoPD: 32, fittingHeight: 20 }));
    expect(codes(inside)).not.toContain('OC_OUTSIDE_OUTLINE');
  });

  it('ENG-07 BLANK_EXCEEDS_STOCK absent for −2,00 in rechteckig 52×38/18, PD 32', () => {
    const r = evaluateLens(lens({ sph: -2, frame: frame('rechteckig', 52, 38, 18), monoPD: 32 }));
    expect(r.ok).toBe(true);
    expect(r.metrics.mbsMm).toBeLessThanOrEqual(STOCK_BLANK_MAX_MM);
    expect(codes(r)).not.toContain('BLANK_EXCEEDS_STOCK');
    expect(codes(r)).not.toContain('OC_OUTSIDE_OUTLINE');
  });

  it('ENG-07 extremes grid (2,304 specs): rule holds, rescue count 0', () => {
    let total = 0;
    let failing = 0;
    let rescueCount = 0;
    const byCode = {};
    for (const sph of [-12, 0, 12])
      for (const cyl of [-6, 0])
        for (const axisDeg of [0, 45, 90])
          for (const shape of ['rund', 'rechteckig', 'panto', 'pilot'])
            for (const A of [40, 62])
              for (const B of [28, 55])
                for (const DBL of [14, 24])
                  for (const monoPD of [25, 40])
                    for (const materialId of ['cr39', 'idx174']) {
                      total++;
                      const s = lens({ sph, cyl, axisDeg, materialId, frame: frame(shape, A, B, DBL), monoPD });
                      const r = evaluateLens(s);
                      checkRule(r);
                      if (!r.ok) {
                        failing++;
                        byCode[r.diagnostics[0].code] = (byCode[r.diagnostics[0].code] ?? 0) + 1;
                        if (manualSweepRescues(s) !== null) rescueCount++;
                      }
                    }
    console.log('[01-12] extremes grid: specs', total, 'failing', failing, byCode, 'rescuable', rescueCount);
    expect(total).toBe(2304);
    expect(rescueCount).toBe(0);
  }, 120_000);
});

// Fuzz domain (RESEARCH tier 4): quarter steps, all materials and shapes.
const specArb = fc
  .record({
    sph: fc.integer({ min: -48, max: 48 }).map((k) => k / 4),
    cyl: fc.integer({ min: -24, max: 0 }).map((k) => k / 4 + 0),
    axisDeg: fc.integer({ min: 0, max: 179 }),
    materialId: fc.constantFrom(...Object.keys(MATERIALS)),
    shape: fc.constantFrom('rund', 'rechteckig', 'panto', 'pilot'),
    A: fc.integer({ min: 40, max: 62 }),
    B: fc.integer({ min: 28, max: 55 }),
    DBL: fc.integer({ min: 14, max: 24 }),
    monoPD: fc.integer({ min: 25, max: 40 }),
    fh: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
  })
  .map(({ shape, A, B, DBL, fh, ...rx }) =>
    lens({
      ...rx,
      frame: frame(shape, A, B, DBL),
      fittingHeight: fh === null ? null : Math.round((fh / 1000) * B),
    }),
  );

// Grenzfall selection rule (01-12 group G, lens-critic MAJOR-3): take the top 5 pairs by pair CT
// iterations printed by the fuzz below, time each (10 warm-up runs, median of 50 evaluatePair
// runs) together with this candidate; the Grenzfall is the slowest by median. Recorded in
// 01-12-SUMMARY and wired in src/ui/main.js, test/bench/recompute.test.js and tech.timingWorst.
const GRENZFALL_CANDIDATE = lens({
  sph: 7.5,
  cyl: -5.75,
  axisDeg: 148,
  materialId: 'trivex',
  frame: frame('rechteckig', 62, 55, 23),
  monoPD: 31,
});

const describeSpec = (s) =>
  `${s.sph}/${s.cyl}×${s.axisDeg} ${s.materialId} ${s.frame.shape} ${s.frame.A}×${s.frame.B}/${s.frame.DBL} PD ${s.monoPD} FH ${s.fittingHeight}`;

describe('ENG-07 fuzz (never NaN)', () => {
  it('ENG-07 fuzz numRuns 1000: rule holds for both eyes, rescue count 0; ENG-09 worst case search cost', () => {
    let failing = 0;
    let rescueCount = 0;
    const byCode = {};
    const cost = [];
    const pairCost = (s) => {
      const p = evaluatePair({ OD: s, OS: { ...s, eye: 'OS' } });
      if (!p.OD.ok || !p.OS.ok) return { p, iterations: null };
      const a = p.OD.intermediates.baseCurveSearch;
      const b = p.OS.intermediates.baseCurveSearch;
      return { p, iterations: a.iterations + b.iterations, evaluations: a.evaluations + b.evaluations };
    };
    fc.assert(
      fc.property(specArb, (s) => {
        const { p, iterations, evaluations } = pairCost(s);
        for (const eye of ['OD', 'OS']) {
          const r = p[eye];
          checkRule(r);
          if (!r.ok) {
            failing++;
            byCode[r.diagnostics[0].code] = (byCode[r.diagnostics[0].code] ?? 0) + 1;
            if (manualSweepRescues({ ...s, eye }) !== null) rescueCount++;
          }
        }
        if (iterations !== null) cost.push({ s, iterations, evaluations });
      }),
      { numRuns: 1000, seed: 7 },
    );
    const cand = pairCost(GRENZFALL_CANDIDATE);
    expect(cand.iterations).not.toBe(null);
    cost.push({ s: GRENZFALL_CANDIDATE, iterations: cand.iterations, evaluations: cand.evaluations, candidate: true });
    cost.sort((a, b) => b.iterations - a.iterations);
    console.log('[01-12] fuzz: failing eyes', failing, 'of 2000', byCode, 'rescuable', rescueCount);
    console.log('[01-10] ENG-09 worst case top 5 (pair iterations / evaluations):');
    for (const c of cost.slice(0, 5)) console.log('  ', c.iterations, c.evaluations, describeSpec(c.s), c.candidate ? '(candidate)' : '');
    console.log('[01-10] candidate:', cand.iterations, cand.evaluations);
    const argmax = cost[0];
    expect(evaluatePair({ OD: argmax.s, OS: { ...argmax.s, eye: 'OS' } }).OD.ok).toBe(true);
    expect(argmax.iterations).toBeGreaterThanOrEqual(cand.iterations);
    expect(rescueCount).toBe(0);
  }, 300_000);
});

describe('MAT-02 automatic base curve (D-01)', () => {
  const A = lens({ sph: 12 }); // pin (a): rechteckig 62×55/24, PD 25, CR-39

  it("pin (a): +12,00 rechteckig 62×55/24, PD 25 computes with BLANK_EXCEEDS_STOCK, rule 'thinnest'", () => {
    const r = evaluateLens(A);
    expect(r.ok).toBe(true);
    checkRule(r);
    expect(r.metrics.ct).toBeGreaterThan(20);
    const w = r.diagnostics.find((d) => d.code === 'BLANK_EXCEEDS_STOCK');
    expect(w.severity).toBe('warn');
    expect(w.data.mbsMm).toBeGreaterThan(75);
    expect(w.data).toEqual({ mbsMm: r.metrics.mbsMm, stockMm: 75 });
    expect(r.diagnostics.some((d) => d.code.includes('BASE_CURVE'))).toBe(false);
    const im = r.intermediates;
    expect(im.baseCurveRule).toBe('thinnest');
    const { maxD1 } = baseCurveAuto(sphericalEquivalent(12, 0), { n: 1.5, rhoMax: im.rhoMax });
    expect(im.D1).toBeLessThanOrEqual(maxD1);
    expect(im.R1).toBeGreaterThanOrEqual(im.rhoMax + FRONT_RADIUS_MARGIN_MM - 1e-9);
    expect(im.vogelMaxThickness).toBe(null);
    // 01-12 re-derived (non-convex back, ceiling 14): D1 6,687 → 9,189, CT 33,34 → 38,31 mm
    expect(im.D1).toBeCloseTo(9.1891, 3);
    expect(r.metrics.ct).toBeCloseTo(38.31, 2);
    expect(im.vogelClampedD1).toBe(14);
    console.log('[01-10] pin (a): D1', im.D1, 'CT', r.metrics.ct, 'MBS', r.metrics.mbsMm, 'rhoMax', im.rhoMax, 'evaluations', im.baseCurveSearch.evaluations);
  });

  it('pin: +12,00 rechteckig 62×55/18, PD 32: Vogel only as reference; at +14 the Vogel lens does not compute (01-12)', () => {
    const r = evaluateLens(lens({ sph: 12, frame: frame('rechteckig', 62, 55, 18), monoPD: 32 }));
    expect(r.ok).toBe(true);
    checkRule(r);
    expect(r.metrics.ct).toBeGreaterThan(20);
    expect(codes(r)).toContain('BLANK_EXCEEDS_STOCK');
    const im = r.intermediates;
    expect(im.vogelD1).toBe(18);
    expect(im.vogelClampedD1).toBe(14);
    // 01-12: Vogel clamped to 14 > maxD1, no computable Vogel lens (was 25,04 mm at 10)
    expect(im.vogelMaxThickness).toBe(null);
    // 01-12 re-derived: D1 7,015 → 10,000 (maxD1 cap), J 23,04 → 25,04 mm
    expect(im.D1).toBeCloseTo(10.0, 3);
    expect(maxThickness(r)).toBeCloseTo(25.038, 2);
    console.log('[01-10] +12 62×55/18/32: D1', im.D1, 'J', maxThickness(r), 'Vogel J', im.vogelMaxThickness);
  });

  it('rescue case: plano −6,00 × 90 in 62×55/24, PD 25 — Vogel lens does not compute, thinnest does', () => {
    const r = evaluateLens(lens({ sph: 0, cyl: -6, axisDeg: 90 }));
    expect(r.ok).toBe(true);
    const im = r.intermediates;
    expect(im.baseCurveRule).toBe('thinnest');
    expect(im.D1).toBeLessThanOrEqual(3);
    expect(im.vogelClampedD1).toBe(4.5);
    expect(im.vogelMaxThickness).toBe(null);
    console.log('[01-10] rescue case: D1', im.D1, 'CT', r.metrics.ct, 'etMax', r.metrics.etMax.value);
  });

  it('optimality for all pinned lenses: J_auto ≤ brute-force minimum + 0.01 mm and ≤ Vogel reference', () => {
    const pins = {
      '+12 62×55/24/25': A,
      '+4 62×55/24/25': lens({ sph: 4 }),
      '+6 62×55/24/25': lens({ sph: 6 }),
      '+6 −2×30 62×55/24/25': lens({ sph: 6, cyl: -2, axisDeg: 30 }),
      '+12 rund 50×50/18/10': lens({ sph: 12, frame: frame('rund', 50, 50, 18), monoPD: 10 }),
      '+12 62×55/18/32': lens({ sph: 12, frame: frame('rechteckig', 62, 55, 18), monoPD: 32 }),
      'rescue 0 −6×90 62×55/24/25': lens({ sph: 0, cyl: -6, axisDeg: 90 }),
    };
    for (const [name, s] of Object.entries(pins)) {
      const r = evaluateLens(s);
      expect(r.ok, name).toBe(true);
      const j = maxThickness(r);
      const brute = manualSweepMin(s);
      // D-C: the tie-break may trade up to τ for a flatter front
      expect(j, name).toBeLessThanOrEqual(brute + TAU + 0.01);
      const v = r.intermediates.vogelMaxThickness;
      if (typeof v === 'number') expect(j, name).toBeLessThanOrEqual(v + TAU + 1e-9);
      console.log(`[01-10] optimality ${name}: D1 ${r.intermediates.D1.toFixed(4)} CT ${r.metrics.ct.toFixed(3)} J ${j.toFixed(4)} brute ${brute.toFixed(4)} gap ${(j - brute).toExponential(2)} Vogel J ${v}`);
    }
  }, 60_000);

  it('refinement beats the coarse grid: +12,00 rund 50×50/18, PD 10', () => {
    const s = lens({ sph: 12, frame: frame('rund', 50, 50, 18), monoPD: 10 });
    const r = evaluateLens(s);
    const outline = frameOutline('rund', 50, 50, 'OD');
    const oc = { x: 24, y: 0 };
    const bc = baseCurveAuto(12, { n: 1.5, rhoMax: maxRadiusFromOC(outline, oc) });
    const o = optimiseBaseCurve({ sph: 12, cyl: 0, axisDeg: 0, n: 1.5, minCT: 1.8, minET: 1, outline, oc, maxD1: bc.maxD1, seedD1: bc.vogelClampedD1 });
    expect(maxThickness(r)).toBeLessThan(o.coarseMaxThickness);
  });

  it('optimality fast-check sample (numRuns 60, seed 19) over the fuzz domain', () => {
    let worst = -Infinity;
    let worstSpec = null;
    let okCount = 0;
    fc.assert(
      fc.property(specArb, (s) => {
        const r = evaluateLens(s);
        if (!r.ok) return;
        okCount++;
        const j = maxThickness(r);
        const gap = j - manualSweepMin(s);
        if (gap > worst) (worst = gap), (worstSpec = s);
        // D-C: the tie-break may trade up to τ for a flatter front
        expect(gap).toBeLessThanOrEqual(TAU + 0.01);
        const v = r.intermediates.vogelMaxThickness;
        if (typeof v === 'number') expect(j).toBeLessThanOrEqual(v + TAU + 1e-9);
      }),
      { numRuns: 60, seed: 19 },
    );
    console.log('[01-10] optimality sample: ok', okCount, 'of 60, worst gap (mm)', worst, worstSpec && describeSpec(worstSpec));
  }, 120_000);

  it("thinnest vs Vogel table (sph −12 … +12, rule 'thinnest', J ≤ vogelMaxThickness)", () => {
    const rows = [];
    for (const [fname, f, PD] of [
      ['62×55/24/25', frame('rechteckig', 62, 55, 24), 25],
      ['52×38/18/32', frame('rechteckig', 52, 38, 18), 32],
    ]) {
      for (let sph = -12; sph <= 12; sph++) {
        const r = evaluateLens(lens({ sph, frame: f, monoPD: PD }));
        if (!r.ok) {
          rows.push(`${fname} ${sph}: ${r.diagnostics[0].code}`);
          continue;
        }
        const im = r.intermediates;
        expect(im.baseCurveRule).toBe('thinnest');
        const j = maxThickness(r);
        if (typeof im.vogelMaxThickness === 'number') expect(j).toBeLessThanOrEqual(im.vogelMaxThickness + TAU + 1e-9);
        rows.push(`| ${fname} | ${sph} | ${im.D1.toFixed(2)} | ${j.toFixed(2)} | ${im.vogelClampedD1.toFixed(2)} | ${im.vogelMaxThickness === null ? 'null' : im.vogelMaxThickness.toFixed(2)} |`);
      }
    }
    console.log('[01-10] thinnest vs Vogel:\n' + rows.join('\n'));
  });

  it('no automatic result reports FRONT_SAG_UNDEFINED (covered by checkRule in grid and fuzz)', () => {
    const r = evaluateLens(lens({ sph: 12, frame: frame('rund', 62, 55, 14), monoPD: 40 }));
    if (!r.ok) expect(r.diagnostics[0].code).not.toBe('FRONT_SAG_UNDEFINED');
  });
});
