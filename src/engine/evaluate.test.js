import { describe, it, expect } from 'vitest';
import { evaluateLens, evaluatePair } from './evaluate.js';
import { optimiseBaseCurve, FLAT_FRONT_TOLERANCE_MM as TAU } from './solve.js';
import { baseCurveAuto, sphericalEquivalent } from './power.js';
import { frameOutline } from './frame/outline.js';
import { maxRadiusFromOC, thicknessAt } from './metrics.js';
import { MATERIALS } from './materials.js';
import { traceBVP } from './trace.js';
import { rxToMatrix } from './power.js';

const spec = (o = {}) => ({
  eye: 'OD',
  sph: -2,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rund', A: 50, B: 50, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const J = (r) => Math.max(r.metrics.ct, r.metrics.etMax.value);
const SWEEP = [];
for (let k = 10; k <= 280; k++) SWEEP.push(k / 20); // 0.50, 0.55, …, 14.00 (01-12: whole automatic range)
/** A manual result counts only with a non-convex back (01-12, GAP-1). */
const okNonConvex = (r) => r.ok && Math.max(r.intermediates.D2a, r.intermediates.D2b) <= 0;
/** D1 inside the search domain [0.50, maxD1] (FRONT_RADIUS_MARGIN_MM cap; maxD1 does not depend on SE). */
const inSearchDomain = (r) =>
  r.intermediates.D1 <= baseCurveAuto(0, { n: r.intermediates.n, rhoMax: r.intermediates.rhoMax }).maxD1 + 1e-12;
// Optimality oracle: the search minimises over [0.50, maxD1] (FRONT_RADIUS_MARGIN_MM); the
// margin-free rescan and bisection only decide feasibility when nothing in that domain computes.
const manualMin = (s) => {
  let m = Infinity;
  for (const baseCurve of SWEEP) {
    const r = evaluateLens({ ...s, baseCurve });
    if (okNonConvex(r) && inSearchDomain(r) && J(r) < m) m = J(r);
  }
  return m;
};

describe('ENG-05 decentration', () => {
  for (const [sph, PD] of [
    [-2, 32],
    [6, 10],
    [12, 10],
  ]) {
    it(`OD and OS are bitwise mirror results (sph ${sph}, PD ${PD})`, () => {
      const { OD, OS } = evaluatePair({
        OD: spec({ sph, monoPD: PD }),
        OS: spec({ eye: 'OS', sph, monoPD: PD }),
      });
      expect(OD.ok && OS.ok).toBe(true);
      expect(OS.intermediates.D1).toBe(OD.intermediates.D1);
      expect(OS.metrics.ct).toBe(OD.metrics.ct);
      expect(Math.abs(OS.metrics.etAt.nasal - OD.metrics.etAt.nasal)).toBeLessThan(1e-9);
      expect(Math.abs(OS.metrics.etAt.temporal - OD.metrics.etAt.temporal)).toBeLessThan(1e-9);
      expect(Math.abs(OS.metrics.etMax.value - OD.metrics.etMax.value)).toBeLessThan(1e-9);
      expect(OS.metrics.etMax.location).toBe(OD.metrics.etMax.location);
    });
  }
  it('decentration.x = +2 for OD and −2 for OS at PD 32', () => {
    expect(evaluateLens(spec()).metrics.decentration.x).toBe(2);
    expect(evaluateLens(spec({ eye: 'OS' })).metrics.decentration.x).toBe(-2);
  });
  it('fittingHeight is measured from the bottom of the box', () => {
    const r = evaluateLens(spec({ fittingHeight: 27 }));
    expect(r.ok).toBe(true);
    expect(r.metrics.decentration.y).toBe(2);
  });
});

const fspec = (shape, A, B, DBL, o = {}) => spec({ frame: { shape, A, B, DBL }, ...o });
const pair = (shape, A, B, DBL, o = {}) =>
  evaluatePair({ OD: fspec(shape, A, B, DBL, o), OS: fspec(shape, A, B, DBL, { ...o, eye: 'OS' }) });

describe('ENG-05 decentration on frame outlines', () => {
  it('decentration = (A + DBL)/2 − monoPD, nasal per eye', () => {
    const a = pair('rechteckig', 52, 40, 18, { monoPD: 32 });
    expect(a.OD.metrics.decentration.x).toBe(3);
    expect(a.OS.metrics.decentration.x).toBe(-3);
    const b = pair('rechteckig', 52, 40, 18, { monoPD: 35 });
    expect(Math.abs(b.OD.metrics.decentration.x)).toBe(0);
    expect(Math.abs(b.OS.metrics.decentration.x)).toBe(0);
    const c = pair('rechteckig', 40, 40, 24, { monoPD: 25 });
    expect(c.OD.ok && c.OS.ok).toBe(true);
    expect(c.OD.metrics.decentration.x).toBe(7);
    expect(c.OS.metrics.decentration.x).toBe(-7);
  });

  it('minus lens −6.00 rechteckig 52×40/18, PD 32: temporal edge thicker than nasal, both eyes', () => {
    const { OD, OS } = pair('rechteckig', 52, 40, 18, { sph: -6, monoPD: 32 });
    for (const r of [OD, OS]) {
      expect(r.ok).toBe(true);
      expect(r.metrics.etAt.temporal).toBeGreaterThan(r.metrics.etAt.nasal);
      expect(r.metrics.etMax.location).toContain('temporal');
    }
    console.log(
      '[01-07] −6.00 rechteckig 52×40/18 PD 32 CR-39:',
      'OD nasal', OD.metrics.etAt.nasal, 'temporal', OD.metrics.etAt.temporal,
      '| OS nasal', OS.metrics.etAt.nasal, 'temporal', OS.metrics.etAt.temporal,
      '| CT', OD.metrics.ct, 'etMax', OD.metrics.etMax.value, OD.metrics.etMax.location,
    );
  });

  for (const [shape, A, B, DBL, PD] of [
    ['rund', 48, 44, 20, 30],
    ['rechteckig', 52, 38, 18, 30],
    ['panto', 49, 42, 20, 30],
    ['pilot', 58, 50, 14, 30],
  ]) {
    for (const sph of [-4, 4]) {
      it(`sphere ${sph} on ${shape} ${A}×${B}/${DBL}: OD and OS mirror exactly (decentration)`, () => {
        const { OD, OS } = pair(shape, A, B, DBL, { sph, monoPD: PD });
        expect(OD.ok && OS.ok).toBe(true);
        expect(OS.intermediates.D1).toBe(OD.intermediates.D1);
        expect(OS.metrics.ct).toBe(OD.metrics.ct);
        for (const k of ['nasal', 'temporal', 'superior', 'inferior']) {
          expect(Math.abs(OS.metrics.etAt[k] - OD.metrics.etAt[k])).toBeLessThan(1e-9);
        }
        expect(Math.abs(OS.metrics.etMax.value - OD.metrics.etMax.value)).toBeLessThan(1e-9);
        expect(OS.metrics.etMax.location).toBe(OD.metrics.etMax.location);
      });
    }
  }

  it('plus lens +4.00 rechteckig: thinnest edge is temporal and CT is set by minET', () => {
    const { OD, OS } = pair('rechteckig', 52, 40, 18, { sph: 4, monoPD: 32 });
    for (const r of [OD, OS]) {
      expect(r.ok).toBe(true);
      expect(r.metrics.etMin.location).toContain('temporal');
      expect(r.intermediates.bindingConstraint).toBe('minET');
      expect(r.metrics.etMin.value).toBeCloseTo(1.0, 6);
      expect(r.diagnostics.map((d) => d.code)).toContain('CT_SET_BY_MIN_ET');
    }
  });

  it('fittingHeight moves the OC up (D-04): minus lens is thicker at the inferior edge', () => {
    const r = evaluateLens(fspec('rechteckig', 52, 40, 18, { sph: -6, fittingHeight: 24 }));
    expect(r.ok).toBe(true);
    expect(r.metrics.decentration.y).toBe(4);
    expect(r.metrics.etAt.inferior).toBeGreaterThan(r.metrics.etAt.superior);
    const z = evaluateLens(fspec('rechteckig', 52, 40, 18, { sph: -6 }));
    expect(z.metrics.decentration.y).toBe(0);
  });

  it('accepts every shape with A ≠ B', () => {
    for (const shape of ['rund', 'rechteckig', 'panto', 'pilot']) {
      expect(evaluateLens(fspec(shape, 55, 30, 18, { sph: -3 })).ok).toBe(true);
    }
  });
});

describe('ENG-04 outline sampling convergence', () => {
  for (const sph of [6, -6]) {
    it(`pilot 58×50/14 PD 30, sph ${sph}: n = 720 vs 5760 within 0.005 mm`, () => {
      const s = fspec('pilot', 58, 50, 14, { sph, monoPD: 30 });
      const a = evaluateLens(s);
      const b = evaluateLens(s, { outlinePoints: 5760 });
      expect(a.ok && b.ok).toBe(true);
      const dCT = Math.abs(a.metrics.ct - b.metrics.ct);
      const dET = Math.abs(a.metrics.etMax.value - b.metrics.etMax.value);
      console.log(`[01-07] convergence sph ${sph}: ΔCT ${dCT}, ΔetMax ${dET}`);
      expect(dCT).toBeLessThanOrEqual(0.005);
      expect(dET).toBeLessThanOrEqual(0.005);
    }, 30_000);
  }
});

describe('MAT-02 automatic base curve on frame outlines', () => {
  it('+12.00 rechteckig 62×55/24, PD 25: rhoMax from the real outline, D1 frame-limited', () => {
    const r = evaluateLens(fspec('rechteckig', 62, 55, 24, { sph: 12, monoPD: 25 }));
    expect(r.ok).toBe(true);
    const im = r.intermediates;
    const rho = maxRadiusFromOC(frameOutline('rechteckig', 62, 55, 'OD'), { x: 18, y: 0 });
    expect(im.rhoMax).toBe(rho);
    expect(im.rhoMax).toBeGreaterThan(50);
    expect(im.baseCurveRule).toBe('thinnest');
    const maxD1 = 500 / (im.rhoMax + 2);
    expect(im.D1).toBeLessThanOrEqual(maxD1);
    expect(im.R1).toBeGreaterThanOrEqual(im.rhoMax + 2 - 1e-9);
    expect(im.vogelClampedD1).toBe(14); // 01-12: ceiling +14 (D-A); was 10
    expect(im.vogelMaxThickness).toBe(null);
    // 01-12 re-derived (non-convex back): D1 6,687 → 9,189, CT 33,34 → 38,31 mm
    expect(im.D1).toBeCloseTo(9.1891, 3);
    expect(r.metrics.ct).toBeCloseTo(38.31, 2);
    expect(Math.max(im.D2a, im.D2b)).toBeLessThanOrEqual(0);
    console.log('[01-07] +12 rechteckig 62×55/24 PD 25: rhoMax', im.rhoMax, 'maxD1', maxD1, 'D1', im.D1, 'CT', r.metrics.ct);
  });
});

describe('ENG-07 invalid specs', () => {
  const cases = [
    [{ cyl: 0.5 }, 'plus-cyl-must-be-transposed'],
    [{ frame: { shape: 'oval', A: 50, B: 40, DBL: 18 } }, 'unknown-shape'],
    [{ frame: { shape: 'toString', A: 50, B: 40, DBL: 18 } }, 'unknown-shape'],
    [{ sph: NaN }, 'non-finite'],
    [{ monoPD: Infinity }, 'non-finite'],
    [{ materialId: 'glass' }, 'material'],
    [{ materialId: 'toString' }, 'material'],
    [{ eye: 'OU' }, 'eye'],
    [{ frame: null }, 'frame'],
    [{ frame: { shape: 'rund', A: 0, B: 0, DBL: 18 } }, 'frame-size'],
    [{ fittingHeight: NaN }, 'fitting-height'],
    [{ baseCurve: -1 }, 'base-curve'],
    [{ minCT: 0 }, 'min-thickness'],
    [{ minET: NaN }, 'min-thickness'],
  ];
  for (const [o, reason] of cases) {
    it(`INVALID_SPEC ${reason} (${JSON.stringify(o)})`, () => {
      const r = evaluateLens(spec(o));
      expect(r.ok).toBe(false);
      expect(r.diagnostics).toEqual([{ code: 'INVALID_SPEC', severity: 'error', data: { reason } }]);
      expect(r.metrics).toBe(null);
      expect(r.intermediates).toBe(null);
      expect(r.surfaces).toBe(null);
    });
  }
  it('non-object spec → INVALID_SPEC', () => {
    expect(evaluateLens(null).diagnostics[0].data.reason).toBe('spec');
  });
});

describe('MAT-02 automatic base curve (D-01)', () => {
  it('normal lens −2.00 round 50/18/32: thinnest, floor exactly, Vogel as reference', () => {
    const r = evaluateLens(spec());
    expect(r.ok).toBe(true);
    const im = r.intermediates;
    expect(im.baseCurveRule).toBe('thinnest');
    expect(im.vogelD1).toBe(5);
    expect(im.vogelClampedD1).toBe(5);
    expect(typeof im.vogelMaxThickness).toBe('number');
    expect(im.vogelMaxThickness).toBeGreaterThanOrEqual(J(r) - 1e-9);
    expect(im.baseCurveSearch.evaluations).toBeLessThanOrEqual(40);
    expect(im.baseCurveSearch.maxThickness).toBeCloseTo(J(r), 9);
    expect(r.diagnostics.every((d) => d.code.startsWith('CT_SET_BY_'))).toBe(true);
    expect(im.D1).toBe(0.5);
    expect(im.R1).toBeCloseTo(1000, 9);
    expect(r.surfaces).toEqual({
      n: 1.5,
      ct: r.metrics.ct,
      c1: r.surfaces.c1,
      k1: 0,
      ca: r.surfaces.ca,
      cb: r.surfaces.cb,
      axisRad: 0,
      oc: { x: 2, y: 0 },
    });
    console.log('[01-02] −2.00 OD 50/18/32: D1', im.D1, 'J', J(r), 'Vogel J', im.vogelMaxThickness);
  });

  it('plano lens: back radius is null, never Infinity', () => {
    const r = evaluateLens(spec({ sph: 0, baseCurve: 0.5, minCT: 2, minET: 2 }));
    expect(r.ok).toBe(true);
    // with sph 0 the back is slightly steeper than the front (D1v > D1), so only check finiteness
    for (const k of ['R1', 'Ra', 'Rb']) {
      const v = r.intermediates[k];
      expect(v === null || Number.isFinite(v)).toBe(true);
    }
  });

  it('Vogel reference outside the range: +12.00 round 50/18/32 (clamped to 14, 01-12)', () => {
    const r = evaluateLens(spec({ sph: 12 }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.vogelD1).toBe(18);
    expect(r.intermediates.vogelClampedD1).toBe(14);
    // 01-12 re-derived: D1 7,597 → 11,112 (D2 ≈ 0), J 9,750 → 10,000 mm; Vogel J 10,720
    expect(r.intermediates.D1).toBeCloseTo(11.1115, 3);
    expect(J(r)).toBeCloseTo(10.0, 2);
    expect(r.intermediates.vogelMaxThickness).toBeGreaterThan(J(r));
    expect(r.intermediates.baseCurveRule).toBe('thinnest');
    expect(r.intermediates.bindingConstraint).toBe('minET');
    console.log('[01-02] +12 PD32: D1', r.intermediates.D1, 'J', J(r), 'Vogel J', r.intermediates.vogelMaxThickness, r.intermediates.baseCurveSearch);
  });

  it('frame-limited plus lens +12.00 round 50/18/PD 10 (Vogel lens at 14 not computable, 01-12)', () => {
    const r = evaluateLens(spec({ sph: 12, monoPD: 10 }));
    expect(r.ok).toBe(true);
    const im = r.intermediates;
    expect(im.rhoMax).toBeCloseTo(49, 9);
    const maxD1 = 500 / 51;
    expect(Math.abs(maxD1 - 9.8039215686)).toBeLessThan(1e-9);
    expect(im.D1).toBeLessThanOrEqual(maxD1);
    expect(im.R1).toBeGreaterThanOrEqual(im.rhoMax + 2 - 1e-9);
    // 01-12: the Vogel seed is 14 > maxD1 9,80, so it does not compute (was 37,76 mm at 10)
    expect(im.vogelMaxThickness).toBe(null);
    // 01-12 re-derived: D1 6,784 → 9,452, CT 30,06 → 33,92 mm
    expect(im.D1).toBeCloseTo(9.452, 3);
    expect(r.metrics.ct).toBeCloseTo(33.916, 2);
    console.log('[01-02] +12 PD10: D1', im.D1, 'CT', r.metrics.ct, 'Vogel J', im.vogelMaxThickness, im.baseCurveSearch);
  });

  it('refinement beats the coarse best (+12.00, round 50/18/PD 10)', () => {
    const outline = frameOutline('rund', 50, 50, 'OD');
    const oc = { x: 24, y: 0 };
    const bc = baseCurveAuto(sphericalEquivalent(12, 0), { n: 1.5, rhoMax: maxRadiusFromOC(outline, oc) });
    const r = optimiseBaseCurve({
      sph: 12,
      cyl: 0,
      axisDeg: 0,
      n: 1.5,
      minCT: 1.8,
      minET: 1.0,
      outline,
      oc,
      maxD1: bc.maxD1,
      seedD1: bc.vogelClampedD1,
    });
    expect(r.ok).toBe(true);
    expect(typeof r.coarseMaxThickness).toBe('number');
    expect(r.maxThickness).toBeLessThan(r.coarseMaxThickness);
    expect(Math.abs(r.D1 - r.coarseD1)).toBeGreaterThan(0);
    expect(Math.abs(r.D1 * 2 - Math.round(r.D1 * 2))).toBeGreaterThan(1e-9);
    expect(evaluateLens(spec({ sph: 12, monoPD: 10 })).intermediates.D1).toBe(r.D1);
    console.log('[01-02] refinement: coarse D1', r.coarseD1, 'J', r.coarseMaxThickness, '→ D1', r.D1, 'J', r.maxThickness, 'evaluations', r.evaluations, 'searchIterations', r.searchIterations);
  });

  it('optimality for all lenses: J_auto ≤ manual 0.05 dpt sweep minimum + 0.01 mm', () => {
    let worst = -Infinity;
    let worstSpec = null;
    let okCount = 0;
    for (const sph of [-12, -6, -2, 0, 2, 6, 12]) {
      for (const A of [40, 50, 62]) {
        for (const monoPD of [10, 32]) {
          const s = spec({ sph, monoPD, frame: { shape: 'rund', A, B: A, DBL: 18 } });
          const r = evaluateLens(s);
          if (!r.ok) continue;
          okCount++;
          const gap = J(r) - manualMin(s);
          if (gap > worst) (worst = gap), (worstSpec = { sph, A, monoPD });
        }
      }
    }
    console.log('[01-02] optimality: ok specs', okCount, 'worst gap (mm)', worst, worstSpec);
    expect(okCount).toBeGreaterThan(0);
    // D-C: the tie-break may trade up to τ for a flatter front
    expect(worst).toBeLessThanOrEqual(TAU + 0.01);
  }, 60_000);

  it('rescue property: no failing automatic lens is computable with any manual D1', () => {
    let failing = 0;
    let rescueCount = 0;
    let total = 0;
    for (const sph of [-20, -12, -6, 0, 6, 12, 20]) {
      for (const A of [40, 50, 62]) {
        for (const DBL of [14, 24]) {
          for (const monoPD of [5, 10, 25, 40]) {
            total++;
            const s = spec({ sph, monoPD, frame: { shape: 'rund', A, B: A, DBL } });
            const r = evaluateLens(s);
            if (!r.ok) {
              expect(r.diagnostics[0].code).not.toBe('FRONT_SAG_UNDEFINED');
              expect(r.diagnostics[0].data.searched).toBe(true);
              failing++;
              // rescue oracle: whole range, not capped at maxD1 (lens-critic MINOR-1)
              if (SWEEP.some((baseCurve) => okNonConvex(evaluateLens({ ...s, baseCurve })))) rescueCount++;
            }
          }
        }
      }
    }
    console.log('[01-02] rescue: specs', total, 'failing', failing, 'rescuable', rescueCount);
    expect(rescueCount).toBe(0);
  }, 60_000);

  it('impossible for every D1: −20.00 62/18/PD 40 and +20.00 50/18/PD 5', () => {
    for (const s of [
      spec({ sph: -20, monoPD: 40, frame: { shape: 'rund', A: 62, B: 62, DBL: 18 } }),
      spec({ sph: 20, monoPD: 5 }),
    ]) {
      const r = evaluateLens(s);
      expect(r.ok).toBe(false);
      expect(r.diagnostics).toHaveLength(1);
      expect(r.diagnostics[0].code).toBe('BACK_SAG_UNDEFINED');
      expect(r.diagnostics[0].severity).toBe('error');
      expect(r.diagnostics[0].data.searched).toBe(true);
    }
  });

  it('a manual base curve bypasses the search', () => {
    const s = spec({ sph: 12, monoPD: 5 });
    const bad = evaluateLens({ ...s, baseCurve: 10 });
    expect(bad.ok).toBe(false);
    expect(bad.diagnostics[0].code).toBe('FRONT_SAG_UNDEFINED');
    expect(bad.diagnostics[0].data.R1).toBeCloseTo(50, 9);
    expect(Math.abs(bad.diagnostics[0].data.rhoMax - 54)).toBeLessThan(0.01);
    expect(bad.diagnostics[0].data.searched).toBeUndefined();
    const manual = evaluateLens({ ...s, baseCurve: 6 });
    expect(manual.ok).toBe(true);
    expect(manual.intermediates.baseCurveRule).toBe('manual');
    expect(manual.intermediates.baseCurveSearch).toBe(null);
    expect(manual.intermediates.vogelMaxThickness).toBe(null);
    expect(manual.intermediates.D1).toBe(6);
    const auto = evaluateLens(s);
    expect(auto.ok).toBe(true);
    expect(auto.intermediates.baseCurveRule).toBe('thinnest');
    console.log('[01-02] +12 PD5 auto: D1', auto.intermediates.D1, 'CT', auto.metrics.ct);
  });
});

describe('ENG-03 TABO golden (cylinder orientation)', () => {
  const centred = (o) => spec({ frame: { shape: 'rund', A: 50, B: 50, DBL: 18 }, monoPD: 34, ...o });
  it('OD −2,00 −2,00 × 90: horizontal edges thicker than vertical', () => {
    const r = evaluateLens(centred({ sph: -2, cyl: -2, axisDeg: 90 }));
    expect(r.ok).toBe(true);
    const e = r.metrics.etAt;
    for (const h of [e.nasal, e.temporal]) {
      expect(h).toBeGreaterThan(e.superior);
      expect(h).toBeGreaterThan(e.inferior);
    }
  });
  it('OD −2,00 −1,00 × 180: superior/inferior thicker than nasal/temporal', () => {
    const r = evaluateLens(centred({ sph: -2, cyl: -1, axisDeg: 180 }));
    expect(r.ok).toBe(true);
    const e = r.metrics.etAt;
    for (const v of [e.superior, e.inferior]) {
      expect(v).toBeGreaterThan(e.nasal);
      expect(v).toBeGreaterThan(e.temporal);
    }
  });
});

function bboxGrid(outline, k = 41) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < outline.length; i += 2) {
    x0 = Math.min(x0, outline[i]);
    x1 = Math.max(x1, outline[i]);
    y0 = Math.min(y0, outline[i + 1]);
    y1 = Math.max(y1, outline[i + 1]);
  }
  const pts = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) pts.push([x0 + ((x1 - x0) * i) / (k - 1), y0 + ((y1 - y0) * j) / (k - 1)]);
  }
  return pts;
}

describe('ENG-05 OD/OS point reflection', () => {
  const frames = [
    { shape: 'rund', A: 50, B: 50, DBL: 18 },
    { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
  ];
  const rxs = [
    [-2, -2, 45],
    [4, -2, 30],
    [-6, -1, 120],
  ];
  for (const frame of frames) {
    for (const [sph, cyl, axisDeg] of rxs) {
      it(`left lens = point reflection of right (${sph}/${cyl}×${axisDeg}, ${frame.shape})`, () => {
        const o = { sph, cyl, axisDeg, frame, monoPD: 30 };
        const { OD, OS } = evaluatePair({ OD: spec(o), OS: spec({ ...o, eye: 'OS' }) });
        expect(OD.ok && OS.ok).toBe(true);
        expect(OS.intermediates.D1).toBe(OD.intermediates.D1);
        expect(Math.abs(OS.metrics.ct - OD.metrics.ct)).toBeLessThanOrEqual(1e-9);
        let checked = 0;
        for (const [x, y] of bboxGrid(frameOutline(frame.shape, frame.A, frame.B, 'OS'))) {
          const a = thicknessAt(OS.surfaces, x, y);
          const b = thicknessAt(OD.surfaces, -x, -y);
          if (Number.isNaN(a) || Number.isNaN(b)) continue;
          expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9);
          checked++;
        }
        expect(checked).toBeGreaterThan(1000);
      });
    }
  }
  it('is not a mirror image (−2,00 −2,00 × 45, rechteckig 52×38/18/PD 30)', () => {
    const o = { sph: -2, cyl: -2, axisDeg: 45, frame: frames[1], monoPD: 30 };
    const { OD, OS } = evaluatePair({ OD: spec(o), OS: spec({ ...o, eye: 'OS' }) });
    let maxDiff = 0;
    for (const [x, y] of bboxGrid(frameOutline('rechteckig', 52, 38, 'OS'))) {
      const d = Math.abs(thicknessAt(OS.surfaces, x, y) - thicknessAt(OD.surfaces, -x, y));
      if (d > maxDiff) maxDiff = d;
    }
    expect(maxDiff).toBeGreaterThan(0.05);
  });
});

describe('ENG-03 oblique-axis pair check (TABO, both eyes)', () => {
  const cases = [
    [-2, -2, 45],
    [-2, -2, 135],
    [-6, -1, 45],
  ];
  for (const [sph, cyl, axisDeg] of cases) {
    for (const eye of ['OD', 'OS']) {
      it(`${eye} ${sph}/${cyl}×${axisDeg}: the meridian axis + 90° is thicker`, () => {
        const r = evaluateLens(spec({ eye, sph, cyl, axisDeg, monoPD: 34 }));
        expect(r.ok).toBe(true);
        expect(r.surfaces.oc.x === 0).toBe(true);
        let checked = 0;
        for (let deg = 0; deg < 360; deg += 5) {
          const x = 20 * Math.cos((deg * Math.PI) / 180);
          const y = 20 * Math.sin((deg * Math.PI) / 180);
          if (Math.abs(x * y) < 1) continue;
          const thickSide = axisDeg === 45 ? x * y < 0 : x * y > 0;
          if (!thickSide) continue;
          const t = thicknessAt(r.surfaces, x, y);
          const tm = thicknessAt(r.surfaces, -x, y);
          if (!(t > tm + 1e-6)) throw new Error(`counterexample at (${x}, ${y}): ${t} vs ${tm}`);
          checked++;
        }
        expect(checked).toBeGreaterThan(30);
      });
    }
  }
});

describe('ENG-04 mixed meridians', () => {
  it('+2,00 −4,00 × 90 in rechteckig 52×38/18, PD 32: both constraints honoured', () => {
    const r = evaluateLens(spec({ sph: 2, cyl: -4, axisDeg: 90, frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 } }));
    expect(r.ok).toBe(true);
    const { minCT, minET } = MATERIALS.cr39;
    const outline = frameOutline('rechteckig', 52, 38, 'OD');
    let tMin = Infinity;
    for (let i = 0; i < outline.length; i += 2) tMin = Math.min(tMin, thicknessAt(r.surfaces, outline[i], outline[i + 1]));
    expect(tMin).toBeGreaterThanOrEqual(minET - 1e-6);
    expect(r.metrics.ct).toBeGreaterThanOrEqual(minCT - 1e-6);
    if (r.intermediates.bindingConstraint === 'minCT') expect(Math.abs(r.metrics.ct - minCT)).toBeLessThanOrEqual(1e-3);
    else expect(Math.abs(tMin - minET)).toBeLessThanOrEqual(1e-3);
    console.log('[01-08] mixed +2/−4×90: binding', r.intermediates.bindingConstraint, 'CT', r.metrics.ct, 'min ET', tMin, 'D1', r.intermediates.D1);
  });
});

describe('ENG-07 cylinder impossibility (SC-4)', () => {
  it('−12,00 −6,00 × 10 in rechteckig 62×55/18, PD 32 → BACK_SAG_UNDEFINED cross, searched', () => {
    const r = evaluateLens(
      spec({ sph: -12, cyl: -6, axisDeg: 10, frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 18 } }),
    );
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].code).toBe('BACK_SAG_UNDEFINED');
    expect(r.diagnostics[0].data.meridian).toBe('cross');
    expect(r.diagnostics[0].data.searched).toBe(true);
  });
});

describe('ENG-06 intermediates sags (01-13)', () => {
  const sagClosed = (R, r) => {
    const c = 1 / R;
    return (c * r * r) / (1 + Math.sqrt(1 - c * c * r * r));
  };
  const KEYS = ['nasal', 'temporal', 'superior', 'inferior', 'etMax', 'etMin', 'rhoMax'];
  const SPECS = [
    ['−2 rund 50×50/18 PD 32', spec()],
    ['−4 −2 × 30 rechteckig 52×38/18 PD 32', spec({ sph: -4, cyl: -2, axisDeg: 30, frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 } })],
    ['+4 rechteckig 52×38/18 PD 32', spec({ sph: 4, frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 } })],
    ['+6 −2 × 30 panto 49×42/20 PD 30', spec({ sph: 6, cyl: -2, axisDeg: 30, frame: { shape: 'panto', A: 49, B: 42, DBL: 20 }, monoPD: 30 })],
    ['−6 pilot 58×50/14 PD 30', spec({ sph: -6, frame: { shape: 'pilot', A: 58, B: 50, DBL: 14 }, monoPD: 30 })],
    ['OS −4 −2 × 30 rechteckig 52×38/18 PD 32', spec({ eye: 'OS', sph: -4, cyl: -2, axisDeg: 30, frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 } })],
  ];

  it('closed form: −2,00 OD rund 50×50/18, PD 32 nasal sag at (25, 0), r = 23', () => {
    const r = evaluateLens(spec());
    expect(r.ok).toBe(true);
    const p = r.intermediates.sags.nasal;
    expect(p.x).toBeCloseTo(25, 12);
    expect(Math.abs(p.y)).toBeLessThan(1e-12);
    expect(Math.abs(p.front - sagClosed(r.intermediates.R1, 23))).toBeLessThan(1e-9);
    expect(Math.abs(p.back - sagClosed(r.intermediates.Ra, 23))).toBeLessThan(1e-9);
    console.log('[01-13] sags −2 rund 50/18/32 OD', JSON.stringify(r.intermediates.sags));
  });

  it.each(SPECS)('consistency: ct − front + back = reported thickness (%s)', (_name, s) => {
    const r = evaluateLens(s);
    expect(r.ok).toBe(true);
    const sg = r.intermediates.sags;
    const t = (k) => r.metrics.ct - sg[k].front + sg[k].back;
    for (const k of ['nasal', 'temporal', 'superior', 'inferior']) {
      expect(Math.abs(t(k) - r.metrics.etAt[k]), k).toBeLessThan(1e-9);
    }
    expect(Math.abs(t('etMax') - r.metrics.etMax.value)).toBeLessThan(1e-9);
    expect(Math.abs(t('etMin') - r.metrics.etMin.value)).toBeLessThan(1e-9);
    expect(Math.abs(t('rhoMax') - thicknessAt(r.surfaces, sg.rhoMax.x, sg.rhoMax.y))).toBeLessThan(1e-9);
    expect(sg.etMax.x).toBe(r.metrics.etMax.x);
    expect(sg.etMin.y).toBe(r.metrics.etMin.y);
  });

  it.each(SPECS)('rhoMax point lies at distance intermediates.rhoMax from the OC (%s)', (_name, s) => {
    const r = evaluateLens(s);
    const p = r.intermediates.sags.rhoMax;
    const oc = r.surfaces.oc;
    expect(Math.abs(Math.hypot(p.x - oc.x, p.y - oc.y) - r.intermediates.rhoMax)).toBeLessThan(1e-12);
  });

  it('eye symmetry: sphere-only rund, OD and OS nasal sags are equal', () => {
    const { OD, OS } = evaluatePair({ OD: spec({ sph: -3 }), OS: spec({ eye: 'OS', sph: -3 }) });
    expect(OS.intermediates.sags.nasal.front).toBe(OD.intermediates.sags.nasal.front);
    expect(OS.intermediates.sags.nasal.back).toBe(OD.intermediates.sags.nasal.back);
  });

  it.each(SPECS)('every sag value is finite (%s)', (_name, s) => {
    const sg = evaluateLens(s).intermediates.sags;
    for (const k of KEYS) {
      for (const f of ['x', 'y', 'front', 'back']) expect(Number.isFinite(sg[k][f]), `${k}.${f}`).toBe(true);
    }
  });
});

describe('MAT-01 the engine exposes the sourced Abbe number νe (01-13)', () => {
  it.each(Object.keys(MATERIALS))('%s: intermediates.abbe === MATERIALS[id].ve', (materialId) => {
    const r = evaluateLens(spec({ materialId }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.abbe).toBe(MATERIALS[materialId].ve);
  });
});

describe('MAT-03 manual base curve 0,00…+10,00 and MANUAL_BACK_CONVEX (02-10)', () => {
  // Canonical frame (bench NORMAL_FRAME): rechteckig 52 × 38, DBL 18, PD 32, CR-39.
  const FRAME = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
  const plus = (o = {}) => spec({ sph: 2, frame: FRAME, ...o });
  const codes = (r) => r.diagnostics.map((d) => d.code);
  const d2max = (r) => Math.max(r.intermediates.D2a, r.intermediates.D2b);

  it('baseCurve 0 computes for −4,00: D1 0, R1 null, rule manual', () => {
    const r = evaluateLens(spec({ sph: -4, baseCurve: 0 }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.D1).toBe(0);
    expect(r.intermediates.R1).toBe(null);
    expect(r.intermediates.baseCurveRule).toBe('manual');
    expect(codes(r)).not.toContain('MANUAL_BACK_CONVEX');
  });

  it('baseCurve −0,25 is INVALID_SPEC base-curve; minCT/minET 0 stay invalid', () => {
    expect(evaluateLens(spec({ baseCurve: -0.25 })).diagnostics).toEqual([
      { code: 'INVALID_SPEC', severity: 'error', data: { reason: 'base-curve' } },
    ]);
    expect(evaluateLens(spec({ minET: 0 })).diagnostics[0].data.reason).toBe('min-thickness');
  });

  it('+2,00 with manual 0,50 (pinned): ok with MANUAL_BACK_CONVEX warn, D2max +1,4995', () => {
    const r = evaluateLens(plus({ baseCurve: 0.5 }));
    expect(r.ok).toBe(true);
    const w = r.diagnostics.find((d) => d.code === 'MANUAL_BACK_CONVEX');
    expect(w.severity).toBe('warn');
    expect(Number.isFinite(w.data.D2max)).toBe(true);
    expect(w.data.D2max).toBe(d2max(r));
    expect(w.data.D2max).toBeCloseTo(1.4995, 4);
    expect(codes(evaluateLens(plus()))).not.toContain('MANUAL_BACK_CONVEX');
  });

  it('steeper base curve clears the convex back (D2 = Sph − D1v), flatter keeps it', () => {
    const steep = evaluateLens(plus({ baseCurve: 3 }));
    expect(steep.ok).toBe(true);
    expect(d2max(steep)).toBeLessThan(0);
    expect(codes(steep)).not.toContain('MANUAL_BACK_CONVEX');
    const flat = evaluateLens(plus({ baseCurve: 0 }));
    expect(flat.ok).toBe(true);
    expect(flat.intermediates.D1v).toBe(0);
    expect(d2max(flat)).toBeCloseTo(2, 12);
    expect(codes(flat)).toContain('MANUAL_BACK_CONVEX');
  });

  // Minus-cylinder form (cyl ≤ 0), so max(sph, sph + cyl) = sph: the mixed +1,00 −2,00 still warns.
  it.each([
    [0.25, 0],
    [1, -2],
    [2, -0.5],
    [-2, -1],
    [0, 0],
  ])('baseCurve 0 with sph %s cyl %s: warning iff max(sph, sph + cyl) > 0', (sph, cyl) => {
    const r = evaluateLens(spec({ sph, cyl, axisDeg: 30, frame: FRAME, baseCurve: 0 }));
    expect(r.ok).toBe(true);
    expect(codes(r).includes('MANUAL_BACK_CONVEX')).toBe(Math.max(sph, sph + cyl) > 0);
  });
});

describe('MAT-05 generic conic front (02-11)', () => {
  const EL = [
    [0, 0],
    [0, 1],
    [1, 1],
  ];
  const maxElementError = (F, E) => Math.max(...EL.map(([i, j]) => Math.abs(F[i][j] - E[i][j])));
  const RECT = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
  const plus4 = (o = {}) => spec({ sph: 4, frame: RECT, ...o });
  const normal = (o = {}) => spec({ sph: -4, cyl: -2, axisDeg: 30, frame: RECT, ...o });
  const d2max = (r) => Math.max(r.intermediates.D2a, r.intermediates.D2b);

  it('frontConic 0 or null gives results identical to the sphere (normal and plus case)', () => {
    for (const s of [normal, plus4]) {
      const base = evaluateLens(s());
      expect(evaluateLens(s({ frontConic: 0 }))).toEqual(base);
      expect(evaluateLens(s({ frontConic: null }))).toEqual(base);
    }
  });

  it('+4,00 CR-39 rechteckig 52×38/18: D1 kept from k = 0 (guard at −5 only), CT decreases', () => {
    const r0 = evaluateLens(plus4());
    const D10 = r0.intermediates.D1;
    const cts = [r0.metrics.ct];
    for (const k of [-1, -2, -5]) {
      const r = evaluateLens(plus4({ frontConic: k }));
      expect(r.ok).toBe(true);
      expect(r.surfaces.k1).toBe(k);
      expect(r.intermediates.baseCurveRule).toBe('thinnest');
      expect(d2max(r)).toBeLessThanOrEqual(0);
      if (k === -5) {
        expect(r.intermediates.D1).toBeGreaterThanOrEqual(D10);
        expect(r.intermediates.D1 - D10).toBeLessThan(0.01);
      } else {
        expect(Math.abs(r.intermediates.D1 - D10)).toBeLessThan(1e-12);
      }
      cts.push(r.metrics.ct);
      console.log(`[02-11] +4,00 k ${k}: CT ${r.metrics.ct.toFixed(4)} D1 ${r.intermediates.D1.toFixed(4)}`);
    }
    for (let i = 1; i < cts.length; i++) expect(cts[i]).toBeLessThan(cts[i - 1]);
    [4.876, 4.817, 4.762, 4.613].forEach((v, i) => expect(cts[i]).toBeCloseTo(v, 2));
  });

  it('+6,00 −1,00 × 90, k −5: the convex-back guard fires, the back stays non-convex', () => {
    const s = plus4({ sph: 6, cyl: -1, axisDeg: 90 });
    const r0 = evaluateLens(s);
    const r = evaluateLens({ ...s, frontConic: -5 });
    expect(r.ok).toBe(true);
    expect(d2max(r)).toBeLessThanOrEqual(0);
    expect(r.intermediates.D1).toBeGreaterThan(r0.intermediates.D1);
    expect(r.intermediates.D1).toBeCloseTo(5.875, 3);
    expect(r.metrics.ct).toBeLessThan(r0.metrics.ct);
    for (const k of [-1, -2, -5]) {
      const rk = evaluateLens({ ...s, frontConic: k });
      console.log(`[02-11] +6,00/−1,00×90 k ${k}: CT ${rk.metrics.ct.toFixed(4)} D1 ${rk.intermediates.D1.toFixed(4)}`);
    }
    console.log(`[02-11] +6,00/−1,00×90 k 0: CT ${r0.metrics.ct.toFixed(4)} D1 ${r0.intermediates.D1.toFixed(4)}`);
  });

  it('manual base curve with frontConic −1: k1 −1, rule manual', () => {
    const r = evaluateLens(plus4({ baseCurve: 6, frontConic: -1 }));
    expect(r.ok).toBe(true);
    expect(r.surfaces.k1).toBe(-1);
    expect(r.intermediates.baseCurveRule).toBe('manual');
    expect(r.intermediates.D1).toBe(6);
  });

  it.each([0.5, NaN, Infinity, '−1'])('frontConic %s is INVALID_SPEC front-conic', (k) => {
    const r = evaluateLens(plus4({ frontConic: k }));
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ code: 'INVALID_SPEC', data: { reason: 'front-conic' } });
  });

  it('paraxial power is set by the vertex curvature: traceBVP reproduces the Rx with k ≠ 0', () => {
    for (const [sph, cyl, axisDeg] of [
      [4, 0, 0],
      [6, -1, 90],
      [-4, -2, 30],
    ]) {
      for (const k of [-1, -5]) {
        const r = evaluateLens(plus4({ sph, cyl, axisDeg, frontConic: k }));
        expect(r.ok).toBe(true);
        expect(maxElementError(traceBVP(r.surfaces), rxToMatrix({ sph, cyl, axisDeg }))).toBeLessThan(0.01);
      }
    }
  });
});

describe('customMaterial (02-12, MAT-06): user-supplied ne, density, νe', () => {
  const CR39 = { ne: 1.5, density: 1.32, ve: 56 };
  const custom = (o = {}) => spec({ materialId: 'custom', customMaterial: CR39, minCT: 1.8, minET: 1.0, ...o });

  it.each([
    ['minus', {}],
    ['plus cyl', { sph: 4, cyl: -1.5, axisDeg: 60 }],
  ])('CR-39 constants as customMaterial give metrics and intermediates equal to cr39 (%s)', (_, rx) => {
    const a = evaluateLens(custom(rx));
    const b = evaluateLens(spec({ materialId: 'cr39', ...rx }));
    expect(a.ok).toBe(true);
    expect(a.metrics).toEqual(b.metrics);
    expect(a.intermediates).toEqual(b.intermediates);
    expect(a.surfaces).toEqual(b.surfaces);
    expect(a.intermediates.abbe).toBe(56);
  });

  it('ve null computes and gives intermediates.abbe null', () => {
    const r = evaluateLens(custom({ customMaterial: { ne: 1.523, density: 2.54, ve: null } }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.abbe).toBeNull();
    expect(r.intermediates.n).toBe(1.523);
  });

  it('crown glass (ne 1,523, density 2,54) is heavier than CR-39 for the same Rx', () => {
    const glass = evaluateLens(custom({ customMaterial: { ne: 1.523, density: 2.54, ve: 58 } }));
    const cr = evaluateLens(spec());
    expect(glass.metrics.weightG).toBeGreaterThan(1.7 * cr.metrics.weightG);
  });

  it.each([
    ['no customMaterial', { customMaterial: undefined }],
    ['customMaterial null', { customMaterial: null }],
    ['minCT null', { minCT: null }],
    ['minET null', { minET: null }],
    ['ne 1', { customMaterial: { ne: 1, density: 1.32, ve: 56 } }],
    ['ne NaN', { customMaterial: { ne: NaN, density: 1.32, ve: 56 } }],
    ['density 0', { customMaterial: { ne: 1.5, density: 0, ve: 56 } }],
    ['density Infinity', { customMaterial: { ne: 1.5, density: Infinity, ve: 56 } }],
    ['ve 0', { customMaterial: { ne: 1.5, density: 1.32, ve: 0 } }],
    ['ve string', { customMaterial: { ne: 1.5, density: 1.32, ve: '56' } }],
    ['ve missing', { customMaterial: { ne: 1.5, density: 1.32 } }],
    ['not an object', { customMaterial: 1.5 }],
  ])('materialId custom with %s is INVALID_SPEC custom-material', (_, o) => {
    const r = evaluateLens(custom(o));
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ code: 'INVALID_SPEC', data: { reason: 'custom-material' } });
  });

  it('customMaterial together with a listed materialId is INVALID_SPEC custom-material', () => {
    const r = evaluateLens(spec({ materialId: 'cr39', customMaterial: CR39 }));
    expect(r.diagnostics[0]).toMatchObject({ code: 'INVALID_SPEC', data: { reason: 'custom-material' } });
  });

  it('customMaterial null with a listed materialId is the unchanged result', () => {
    expect(evaluateLens(spec({ customMaterial: null }))).toEqual(evaluateLens(spec()));
  });
});
