import { describe, it, expect } from 'vitest';
import { solveCT } from './solve.js';
import { design, backSagAt } from './design.js';
import { thicknessAt } from './metrics.js';
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
  it('backSagAt rejects a toric back until 01-08', () => {
    const s = design({ sph: -3, cyl: -1, axisDeg: 30, n: 1.5, D1: 5, ct: 2, oc: C });
    expect(() => backSagAt(s, 1, 1)).toThrow();
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
    expect(r.data).toEqual({ meridian: 'cross' });
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
