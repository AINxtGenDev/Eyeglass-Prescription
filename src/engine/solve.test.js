import { describe, it, expect } from 'vitest';
import { solveCT, optimiseBaseCurve } from './solve.js';
import { design, backSagAt } from './design.js';
import { thicknessAt } from './metrics.js';
import { sphereSag } from './sag.js';
import { circleOutline, mirrorOutlineX } from './frame/outline.js';

const C = { x: 0, y: 0 };
const base = { cyl: 0, axisDeg: 0, n: 1.5, minCT: 1.8, minET: 1.0, oc: C };

function outlineThicknesses(surfaces, outline) {
  const t = [];
  for (let i = 0; i < outline.length; i += 2) t.push(thicknessAt(surfaces, outline[i], outline[i + 1]));
  return t;
}

describe('ENG-02 thick-lens design', () => {
  it('follows the back-vertex relation and the back sign convention', () => {
    const s = design({ sph: -3, cyl: -1, axisDeg: 30, n: 1.5, D1: 5, ct: 2, oc: C });
    const D1v = 5 / (1 - (2 / 1000 / 1.5) * 5);
    expect(s.D1v).toBeCloseTo(D1v, 14);
    expect(s.D2a).toBeCloseTo(-3 - D1v, 14);
    expect(s.D2b).toBeCloseTo(-4 - D1v, 14);
    expect(s.c1).toBeCloseTo(5 / 500, 15);
    expect(s.ca).toBeCloseTo(-s.D2a / 500, 15);
    expect(s.cb).toBeCloseTo(-s.D2b / 500, 15);
    expect(s.ca).toBeGreaterThan(0);
    expect(s.axisRad).toBeCloseTo(Math.PI / 6, 15);
    expect(s.k1).toBe(0);
  });
  it('backSagAt is the torus rotated to the TABO axis about the OC', () => {
    const oc = { x: 3, y: -1 };
    const s = design({ sph: -3, cyl: -1, axisDeg: 30, n: 1.5, D1: 5, ct: 2, oc });
    const a = Math.PI / 6;
    for (const t of [5, 12, -20]) {
      // along the axis: base curve ca; perpendicular: cross curve cb
      const ax = backSagAt(s, oc.x + t * Math.cos(a), oc.y + t * Math.sin(a));
      const cr = backSagAt(s, oc.x - t * Math.sin(a), oc.y + t * Math.cos(a));
      expect(ax).toBeCloseTo(sphereSag(s.ca, t * t), 12);
      expect(cr).toBeCloseTo(sphereSag(s.cb, t * t), 12);
    }
  });
});

describe('ENG-04 CT solve', () => {
  const outline = circleOutline(50);

  it('minus lens −4.00: CT = minCT, ET > CT everywhere', () => {
    const r = solveCT({ ...base, sph: -4, D1: 4, outline });
    expect(r.ok).toBe(true);
    expect(r.binding).toBe('minCT');
    expect(r.ct).toBe(1.8);
    expect(r.iterations).toBe(1); // MINOR-12: outline passes run
    const t = outlineThicknesses(r.surfaces, outline);
    for (const v of t) expect(v).toBeGreaterThan(r.ct);
    expect(r.maxThickness).toBeCloseTo(Math.max(...t), 9);
  });

  it('plus lens +4.00: CT set by minET, CT > ET everywhere', () => {
    const r = solveCT({ ...base, sph: 4, D1: 10, outline });
    expect(r.ok).toBe(true);
    expect(r.binding).toBe('minET');
    const t = outlineThicknesses(r.surfaces, outline);
    expect(Math.abs(Math.min(...t) - 1.0)).toBeLessThan(1e-3);
    for (const v of t) expect(r.ct).toBeGreaterThan(v);
    expect(r.iterations).toBeGreaterThanOrEqual(1);
    expect(r.iterations).toBeLessThanOrEqual(10);
    expect(r.maxThickness).toBe(r.ct);
  });

  it('maxIter 1 on +8.00 → THICK_LENS_NOT_CONVERGED', () => {
    const r = solveCT({ ...base, sph: 8, D1: 10, outline, maxIter: 1 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('THICK_LENS_NOT_CONVERGED');
    expect(r.iterations).toBe(1);
  });

  it('D1 800 with minCT 2 → VERTEX_TERM_INVALID', () => {
    const r = solveCT({ ...base, sph: 0, D1: 800, minCT: 2, outline });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('VERTEX_TERM_INVALID');
    expect(r.data).toEqual({ ct: 2, D1: 800 });
  });

  it('explicit D1 10 on a 120 mm circle → FRONT_SAG_UNDEFINED (R1 50 < 60)', () => {
    const r = solveCT({ ...base, sph: 0, D1: 10, outline: circleOutline(120) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FRONT_SAG_UNDEFINED');
    expect(r.data.R1).toBeCloseTo(50, 12);
    expect(r.data.rhoMax).toBeCloseTo(60, 9);
    expect(r.iterations).toBe(1); // MINOR-12: the failing pass counts
  });

  it('back surface steeper than the outline → BACK_SAG_UNDEFINED', () => {
    const r = solveCT({ ...base, sph: -20, D1: 0.5, outline: circleOutline(62) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACK_SAG_UNDEFINED');
    expect(r.data).toEqual({ meridian: 'cross', axisDeg: 0 });
  });

  it('warm start converges to the same fixed point with no more iterations', () => {
    const cold = solveCT({ ...base, sph: 8, D1: 9, outline });
    const warm = solveCT({ ...base, sph: 8, D1: 9, outline, ct0: 12 });
    expect(cold.ok && warm.ok).toBe(true);
    expect(Math.abs(warm.ct - cold.ct)).toBeLessThan(1e-4);
    expect(warm.iterations).toBeLessThanOrEqual(cold.iterations);
    expect(warm.maxThickness).toBe(warm.ct);
    // ct0 below minCT is lifted to minCT
    const low = solveCT({ ...base, sph: 8, D1: 9, outline, ct0: 0.1 });
    expect(low.ct).toBe(cold.ct);
  });
});

describe('ENG-05 outline symmetry', () => {
  it('circleOutline(50) is bitwise symmetric about the x axis', () => {
    const o = circleOutline(50);
    const n = o.length / 2;
    expect(n).toBe(720);
    expect(o[1] === 0).toBe(true);
    expect(o[2 * (n / 2) + 1] === 0).toBe(true);
    expect(o[0]).toBe(25);
    for (let k = 1; k < n / 2; k++) {
      expect(o[2 * (n - k)] === o[2 * k]).toBe(true);
      expect(o[2 * (n - k) + 1] === -o[2 * k + 1]).toBe(true);
    }
  });

  it('mirrorOutlineX is the index-mapped bitwise x-negation and stays CCW', () => {
    const o = circleOutline(50);
    const m = mirrorOutlineX(o);
    const n = o.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (n - i) % n;
      expect(m[2 * i] === -o[2 * j]).toBe(true);
      expect(m[2 * i + 1] === o[2 * j + 1]).toBe(true);
    }
    let area = 0;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      area += m[2 * i] * m[2 * k + 1] - m[2 * k] * m[2 * i + 1];
    }
    expect(area / 2).toBeGreaterThan(0);
  });

  it('circleOutline throws unless n is a multiple of 4', () => {
    expect(() => circleOutline(50, 722)).toThrow();
  });
});

describe('MAT-02 optimiseBaseCurve', () => {
  const sweep = []; // D1 = 0.50, 0.55, …
  for (let k = 10; k <= 200; k++) sweep.push(k / 20);
  const bruteMin = (p, maxD1) => {
    let m = Infinity;
    for (const D1 of sweep) {
      if (D1 > maxD1 + 1e-12) break;
      const r = solveCT({ ...p, D1 });
      if (r.ok && r.maxThickness < m) m = r.maxThickness;
    }
    return m;
  };

  it('+12.00 decentred 24 mm: never thicker than the seed, near brute force, deterministic', () => {
    const outline = circleOutline(50);
    const p = { ...base, sph: 12, outline, oc: { x: 24, y: 0 } };
    const maxD1 = 500 / 51;
    const r = optimiseBaseCurve({ ...p, maxD1, seedD1: 10 });
    expect(r.ok).toBe(true);
    expect(typeof r.seedMaxThickness).toBe('number');
    expect(r.maxThickness).toBeLessThanOrEqual(r.seedMaxThickness + 1e-9);
    expect(r.D1).toBeGreaterThanOrEqual(0.5);
    expect(r.D1).toBeLessThanOrEqual(maxD1);
    expect(r.evaluations).toBeLessThanOrEqual(40);
    const again = optimiseBaseCurve({ ...p, maxD1, seedD1: 10 });
    expect(again.D1).toBe(r.D1);
    expect(again.ct).toBe(r.ct);
    expect(r.maxThickness).toBeLessThanOrEqual(bruteMin(p, maxD1) + 0.01);
  });

  it('seed guarantee for −2.00 and +4.00 (seed = Vogel-clamped)', () => {
    const outline = circleOutline(50);
    for (const [sph, seedD1] of [
      [-2, 5],
      [4, 10],
    ]) {
      const r = optimiseBaseCurve({ ...base, sph, outline, maxD1: 10, seedD1 });
      expect(r.ok).toBe(true);
      expect(typeof r.seedMaxThickness).toBe('number');
      expect(r.maxThickness).toBeLessThanOrEqual(r.seedMaxThickness + 1e-9);
    }
  });

  it('nothing computes (−20.00, 62 mm centred) → BACK_SAG_UNDEFINED, searched', () => {
    const r = optimiseBaseCurve({
      ...base,
      sph: -20,
      outline: circleOutline(62),
      maxD1: 500 / 33,
      seedD1: 0.5,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACK_SAG_UNDEFINED');
    expect(r.data.searched).toBe(true);
    expect(r.evaluations).toBeLessThanOrEqual(130);
  });

  it('maxD1 below the floor scans the floor only and still finds a lens', () => {
    const r = optimiseBaseCurve({ ...base, sph: -1, outline: circleOutline(50), maxD1: 0.3, seedD1: 0.5 });
    expect(r.ok).toBe(true);
    expect(r.D1).toBe(0.5);
    expect(r.coarseD1).toBe(0.5);
  });

  it('coarse grid infeasible: the 0.10 dpt impossibility rescan over [0.5, 10] finds a lens', () => {
    // maxD1 forced below the floor: the coarse grid is {0.5}, where +20 on 52 mm cannot be made
    // (back radius ≈ 25.6 mm < 26 mm), so the rescan runs and must find a computable front.
    const r = optimiseBaseCurve({ ...base, sph: 20, outline: circleOutline(52), maxD1: 0.3, seedD1: 10 });
    expect(r.ok).toBe(true);
    expect(r.evaluations).toBeGreaterThan(22);
    expect(r.evaluations).toBeLessThanOrEqual(130);
    expect(r.maxThickness).toBeLessThanOrEqual(r.seedMaxThickness + 1e-9);
  });

  // A spiky outline whose every 4th point (the decimated outline) lies on a small circle and all
  // other points on a large one: decimation then hides real violations, which exercises the
  // full-outline repeat of the coarse scan.
  const spiky = (rIn, rOut, n = 720) => {
    const o = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const r = i % 4 === 0 ? rIn : rOut;
      const a = (2 * Math.PI * i) / n;
      o[2 * i] = r * Math.cos(a);
      o[2 * i + 1] = r * Math.sin(a);
    }
    return o;
  };

  it('decimation hides a violation: full-outline repeat finds the real optimum', () => {
    const outline = spiky(10, 55);
    const p = { ...base, sph: 12, outline };
    const r = optimiseBaseCurve({ ...p, maxD1: 10, seedD1: 0.5 });
    expect(r.ok).toBe(true);
    expect(r.coarseMaxThickness).toBe(null); // coarse best does not compute on the full outline
    expect(r.evaluations).toBeGreaterThan(40);
    expect(solveCT({ ...p, D1: r.D1 }).ok).toBe(true);
    expect(r.maxThickness).toBeLessThanOrEqual(bruteMin(p, 10) + 0.01);
  });

  it('decimation hides a violation and nothing computes: coded error', () => {
    const r = optimiseBaseCurve({ ...base, sph: -20, outline: spiky(20, 30), maxD1: 10, seedD1: 0.5 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACK_SAG_UNDEFINED');
    expect(r.data.searched).toBe(true);
  });
});

describe('ENG-07 BACK_SAG_UNDEFINED meridian label', () => {
  // sph −20, cyl −4, axis 0, n 1.5, D1 0.5: ca ≈ 0.041 (R ≈ 24.4 mm), cb ≈ 0.049 (R ≈ 20.4 mm).
  const p = { ...base, sph: -20, cyl: -4, axisDeg: 0, D1: 0.5 };
  it("base-type failure first, cross failure second → 'cross'", () => {
    const r = solveCT({ ...p, outline: new Float64Array([30, 0, 0, 22]) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACK_SAG_UNDEFINED');
    expect(r.data.meridian).toBe('cross');
    expect(r.data.axisDeg).toBe(0);
  });
  it("only a base-type failure → 'base'", () => {
    const r = solveCT({ ...p, outline: new Float64Array([30, 0, 0, 5]) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BACK_SAG_UNDEFINED');
    expect(r.data.meridian).toBe('base');
  });
});

// ---------------------------------------------------------------------------------------------
// 01-12 (GAP-1, D-A, D-C, MINOR-12): non-convex back, ceiling +14, boundary bisection,
// flat-front tie-break and the outline pass count.
// ---------------------------------------------------------------------------------------------
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { evaluateLens } from './evaluate.js';
import { FLAT_FRONT_TOLERANCE_MM } from './solve.js';
import { BASE_CURVE_LIMITS } from './power.js';

const PRE = JSON.parse(readFileSync(new URL('../../test/fixtures/pins-pre-01-12.json', import.meta.url), 'utf8'));
const PRE_FRAMES = Object.fromEntries(PRE.grid.frames.map((f) => [f.shape, f]));
const lensSpec = (o = {}) => ({
  eye: 'OD',
  sph: 0,
  cyl: 0,
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
const preSpec = (e) => {
  const f = PRE_FRAMES[e.frame];
  return lensSpec({
    sph: e.sph,
    cyl: e.cyl,
    axisDeg: PRE.grid.axisDeg,
    materialId: e.materialId,
    frame: { shape: f.shape, A: f.A, B: f.B, DBL: f.DBL },
    monoPD: f.monoPD,
  });
};
const Jof = (r) => Math.max(r.metrics.ct, r.metrics.etMax.value);
const D2max = (r) => Math.max(r.intermediates.D2a, r.intermediates.D2b);
const rect5238 = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };

describe('MAT-02 lenses with no positive meridian are unchanged (01-12)', () => {
  it(`144 specs bitwise equal to the pre-change fixture (${PRE.generatedAt})`, () => {
    expect(PRE.noPositiveMeridian).toHaveLength(144);
    for (const e of PRE.noPositiveMeridian) {
      const r = evaluateLens(preSpec(e));
      const name = `${e.sph}/${e.cyl} ${e.frame} ${e.materialId}`;
      expect(r.ok, name).toBe(e.ok);
      if (!e.ok) {
        expect(r.diagnostics[0].code, name).toBe(e.code);
        continue;
      }
      expect(r.intermediates.D1, name).toBe(e.D1);
      expect(r.metrics.ct, name).toBe(e.ct);
      expect(r.metrics.etMax.value, name).toBe(e.etMax);
      expect(r.metrics.weightG, name).toBe(e.weightG);
    }
  });
});

describe('MAT-02 at-risk lenses keep their thickness (01-12)', () => {
  it('plus/mixed lenses whose old optimum had a non-convex back: J_new ≤ J_old + τ', () => {
    expect(PRE.atRisk.length).toBeGreaterThanOrEqual(1);
    const moved = [];
    for (const e of PRE.atRisk) {
      const r = evaluateLens(preSpec(e));
      const name = `${e.sph}/${e.cyl} ${e.frame} ${e.materialId}`;
      expect(r.ok, name).toBe(true);
      expect(Jof(r), name).toBeLessThanOrEqual(e.J + FLAT_FRONT_TOLERANCE_MM);
      if (Math.abs(r.intermediates.D1 - e.D1) > 0.05) {
        moved.push(`${name}: D1 ${e.D1.toFixed(3)} → ${r.intermediates.D1.toFixed(3)}, J ${e.J.toFixed(3)} → ${Jof(r).toFixed(3)}`);
      }
    }
    console.log(`[01-12] at-risk: ${PRE.atRisk.length} specs, D1 moved > 0.05 dpt: ${moved.length}\n  ` + moved.join('\n  '));
  });
});

// Flattest front within τ of the thinnest, by a 0.05 dpt manual sweep over [0.50, maxD1] with a
// non-convex back (the same domain the search minimises over).
const bruteFlat = (s) => {
  let jMin = Infinity;
  const pts = [];
  for (let k = 10; k <= 280; k++) {
    const r = evaluateLens({ ...s, baseCurve: k / 20 });
    if (!r.ok) continue;
    if (r.intermediates.R1 < r.intermediates.rhoMax + 2 - 1e-9) break; // beyond maxD1
    if (D2max(r) > 0) continue;
    pts.push([k / 20, Jof(r)]);
    if (Jof(r) < jMin) jMin = Jof(r);
  }
  const flat = pts.find(([, j]) => j <= jMin + FLAT_FRONT_TOLERANCE_MM);
  return { jMin, flatD1: flat ? flat[0] : null };
};

describe('MAT-02 flat-front tie-break (D-C)', () => {
  const PILOT = { shape: 'pilot', A: 58, B: 50, DBL: 14 };
  const worked = lensSpec({ sph: 0.25, materialId: 'idx174', frame: PILOT, monoPD: 30 });

  it('worked example +0,25 1,74 pilot 58×50/14 PD 30: flat front, within τ, edge ≥ minET on the full outline', () => {
    const r = evaluateLens(worked);
    expect(r.ok).toBe(true);
    const im = r.intermediates;
    const j = Jof(r);
    console.log('[01-12] D-C worked example: D1', im.D1, 'J', j, 'J_min', im.baseCurveSearch.minMaxThickness, 'evaluations', im.baseCurveSearch.evaluations);
    expect(im.D1).toBeLessThanOrEqual(2.25);
    expect(j).toBeLessThanOrEqual(im.baseCurveSearch.minMaxThickness + FLAT_FRONT_TOLERANCE_MM + 1e-9);
    expect(D2max(r)).toBeLessThanOrEqual(0);
    // lens-critic MINOR (amendment 4): the tie-break solve runs on the full 720-point outline
    expect(r.metrics.etMin.value).toBeGreaterThanOrEqual(1.0 - 1e-4);
  });

  it('strong plus +6 rechteckig 52×38: the tie-break does not run, D1 is the thinnest optimum', () => {
    const r = evaluateLens(lensSpec({ sph: 6, frame: rect5238 }));
    expect(r.ok).toBe(true);
    expect(r.intermediates.D1).toBeLessThanOrEqual(6 + 2);
    expect(Jof(r)).toBe(r.intermediates.baseCurveSearch.minMaxThickness);
  });

  it('property (affected region, numRuns 200, seed 12): m ≤ +2 ⇒ D1 ≤ max(m, 0) + 2, J ≤ J_min + τ, flattest by brute force', () => {
    const arb = fc
      .record({
        sph: fc.integer({ min: 0, max: 8 }).map((k) => k / 4),
        cyl: fc.integer({ min: -4, max: 0 }).map((k) => k / 4 + 0),
        axisDeg: fc.integer({ min: 0, max: 179 }),
        materialId: fc.constantFrom('idx160', 'idx167', 'idx174', 'idx174', 'idx167', 'cr39'),
        shape: fc.constantFrom('rund', 'rechteckig', 'panto', 'pilot'),
        A: fc.integer({ min: 46, max: 62 }),
        B: fc.integer({ min: 28, max: 55 }),
        DBL: fc.integer({ min: 14, max: 24 }),
        monoPD: fc.integer({ min: 25, max: 40 }),
      })
      .map(({ shape, A, B, DBL, ...rx }) => lensSpec({ ...rx, frame: { shape, A, B, DBL } }));
    let ok = 0;
    let worstFlat = -Infinity;
    fc.assert(
      fc.property(arb, (s) => {
        const r = evaluateLens(s);
        if (!r.ok) return;
        ok++;
        const m = Math.max(s.sph, s.sph + s.cyl);
        const D1 = r.intermediates.D1;
        expect(D1).toBeLessThanOrEqual(Math.max(m, 0) + 2);
        expect(Jof(r)).toBeLessThanOrEqual(r.intermediates.baseCurveSearch.minMaxThickness + FLAT_FRONT_TOLERANCE_MM + 1e-9);
        const b = bruteFlat(s);
        if (b.flatD1 !== null) {
          worstFlat = Math.max(worstFlat, D1 - b.flatD1);
          expect(D1).toBeLessThanOrEqual(b.flatD1 + 0.05);
        }
      }),
      { numRuns: 200, seed: 12 },
    );
    console.log('[01-12] D-C property: ok', ok, 'of 200, worst D1 − brute flattest', worstFlat);
  }, 300_000);
});

describe('MAT-02 back surface never convex (01-12, GAP-1)', () => {
  it('+4 on circleOutline(50) centred: D2 ≤ 0', () => {
    const r = optimiseBaseCurve({ ...base, sph: 4, outline: circleOutline(50), maxD1: 14, seedD1: 10 });
    expect(r.ok).toBe(true);
    expect(Math.max(r.surfaces.D2a, r.surfaces.D2b)).toBeLessThanOrEqual(0);
  });
  it('+2 … +12 in rechteckig 52×38/18 PD 32 CR-39: ok and −0,05 ≤ D2a ≤ 0', () => {
    for (const sph of [2, 4, 6, 10, 11, 12]) {
      const r = evaluateLens(lensSpec({ sph, frame: rect5238 }));
      expect(r.ok, `+${sph}`).toBe(true);
      expect(r.intermediates.D2a, `+${sph}`).toBeLessThanOrEqual(0);
      expect(r.intermediates.D2a, `+${sph}`).toBeGreaterThanOrEqual(-0.05);
      console.log(`[01-12] +${sph} 52×38: D1 ${r.intermediates.D1} D2a ${r.intermediates.D2a} CT ${r.metrics.ct} evaluations ${r.intermediates.baseCurveSearch.evaluations}`);
    }
  });
  it('+6 −2 × 30 decentred and +2 −3 × 90: every back principal power ≤ 0', () => {
    const a = evaluateLens(lensSpec({ sph: 6, cyl: -2, axisDeg: 30, frame: rect5238, monoPD: 28 }));
    expect(a.ok).toBe(true);
    expect(a.intermediates.D2a).toBeLessThanOrEqual(0);
    expect(a.intermediates.D2b).toBeLessThanOrEqual(0);
    const b = evaluateLens(lensSpec({ sph: 2, cyl: -3, axisDeg: 90, frame: rect5238 }));
    expect(b.ok).toBe(true);
    expect(b.intermediates.D2a).toBeLessThanOrEqual(0);
    console.log('[01-12] +2 −3×90: D1', b.intermediates.D1, 'D2a', b.intermediates.D2a);
  });
});

describe('MAT-02 ceiling +14 (D-A)', () => {
  it('BASE_CURVE_LIMITS is { min 0.5, max 14 }', () => {
    expect(BASE_CURVE_LIMITS).toEqual({ min: 0.5, max: 14 });
  });
  it('+12 computes in rechteckig 40×30/18 PD 29 and 62×55/18 PD 32 with CR-39 and 1,74', () => {
    for (const [frame, monoPD] of [
      [{ shape: 'rechteckig', A: 40, B: 30, DBL: 18 }, 29],
      [{ shape: 'rechteckig', A: 62, B: 55, DBL: 18 }, 32],
    ]) {
      for (const materialId of ['cr39', 'idx174']) {
        const r = evaluateLens(lensSpec({ sph: 12, frame, monoPD, materialId }));
        const name = `+12 ${frame.A}×${frame.B} ${materialId}`;
        expect(r.ok, name).toBe(true);
        expect(D2max(r), name).toBeLessThanOrEqual(0);
        console.log(`[01-12] ${name}: D1 ${r.intermediates.D1} CT ${r.metrics.ct}`);
      }
    }
  });
});

describe('MAT-02 impossibility covers the whole automatic range (lens-critic MINOR-1, MAJOR-B)', () => {
  // These PDs are outside the RX-04 range (phase 2), but the engine's impossibility claim must
  // still hold for them: feasibility can be a narrow window the 0,10 dpt rescan steps over.
  it('+12 rund 62×62/14 PD 10 CR-39 and +20 1,74 rund 52×52/24 PD 5 compute', () => {
    for (const s of [
      lensSpec({ sph: 12, frame: { shape: 'rund', A: 62, B: 62, DBL: 14 }, monoPD: 10 }),
      lensSpec({ sph: 20, materialId: 'idx174', frame: { shape: 'rund', A: 52, B: 52, DBL: 24 }, monoPD: 5 }),
    ]) {
      const r = evaluateLens(s);
      expect(r.ok, `${s.sph} ${s.frame.A}`).toBe(true);
      expect(D2max(r)).toBeLessThanOrEqual(0);
      console.log(`[01-12] window ${s.sph} ${s.frame.A}: D1 ${r.intermediates.D1} CT ${r.metrics.ct} evaluations ${r.intermediates.baseCurveSearch.evaluations}`);
    }
  });
});

describe('ENG-07 BACK_SURFACE_CONVEX', () => {
  const S16 = lensSpec({ sph: 16, frame: { shape: 'rund', A: 40, B: 40, DBL: 18 }, monoPD: 32 });
  it('+16 rund 40×40/18 PD 32 CR-39 → one error BACK_SURFACE_CONVEX, searched, D2max > 0', () => {
    const r = evaluateLens(S16);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0].code).toBe('BACK_SURFACE_CONVEX');
    expect(r.diagnostics[0].severity).toBe('error');
    expect(r.diagnostics[0].data.searched).toBe(true);
    expect(r.diagnostics[0].data.D2max).toBeGreaterThan(0);
  });
  it('the text claim: a manual front steeper than +14 computes with a non-convex back (lens-critic MINOR-7)', () => {
    const okFronts = [];
    for (let k = 57; k <= 96; k++) {
      const r = evaluateLens({ ...S16, baseCurve: k / 4 });
      if (r.ok && r.intermediates.D2a <= 0) okFronts.push(k / 4);
    }
    console.log('[01-12] +16 rund 40: manual fronts > 14 with D2a ≤ 0:', okFronts.join(', '));
    expect(okFronts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('MINOR-12 solveCT counts outline passes', () => {
  const outline = circleOutline(50);
  it('first-pass convergence reports 1; maxIter 1 reports 1; warm ≤ cold', () => {
    expect(solveCT({ ...base, sph: -4, D1: 4, outline }).iterations).toBe(1);
    const nc = solveCT({ ...base, sph: 8, D1: 10, outline, maxIter: 1 });
    expect(nc.code).toBe('THICK_LENS_NOT_CONVERGED');
    expect(nc.iterations).toBe(1);
    const cold = solveCT({ ...base, sph: 8, D1: 9, outline });
    const warm = solveCT({ ...base, sph: 8, D1: 9, outline, ct0: cold.ct });
    expect(warm.iterations).toBe(1);
    expect(warm.iterations).toBeLessThanOrEqual(cold.iterations);
  });
});
