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
    expect(r.iterations).toBeLessThanOrEqual(1);
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
    expect(r.iterations).toBe(0);
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
