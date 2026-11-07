import { describe, it, expect } from 'vitest';
import { computeMetrics, thicknessAt, maxRadiusFromOC, TIE_TOL_MM } from './metrics.js';
import { evaluateLens } from './evaluate.js';
import { solveCT } from './solve.js';
import { frontSagAt } from './design.js';
import { circleOutline, frameOutline } from './frame/outline.js';

const a = 25;
// ∫₀ᵃ s dA for a sphere of radius R (R > a)
const V = (R) => Math.PI * a * a * R - ((2 * Math.PI) / 3) * (R ** 3 - (R * R - a * a) ** 1.5);

function solved(sph, D1, oc = { x: 0, y: 0 }) {
  const outline = circleOutline(2 * a);
  const r = solveCT({ sph, cyl: 0, axisDeg: 0, n: 1.5, D1, minCT: 1.8, minET: 1.0, outline, oc });
  expect(r.ok).toBe(true);
  return { r, outline };
}

describe('ENG-06 metrics', () => {
  for (const [sph, D1] of [
    [-4, 4],
    [4, 10],
  ]) {
    it(`round lens ${sph} at the OC: volume matches the closed form within 1e-4 relative`, () => {
      const { r, outline } = solved(sph, D1);
      const s = r.surfaces;
      const m = computeMetrics({ surfaces: s, outline, density: 1.32, eye: 'OD' });
      const closed = Math.PI * a * a * s.ct - V(1 / s.c1) + V(1 / s.ca);
      expect(Math.abs(m.volumeMm3 - closed) / closed).toBeLessThan(1e-4);
      expect(m.weightG).toBeCloseTo((m.volumeMm3 / 1000) * 1.32, 12);
      expect(m.ct).toBe(s.ct);
      expect(m.mbsMm).toBeCloseTo(2 * 25 + 2, 9);
      expect(m.frontProtrusion.max).toBeCloseTo(frontSagAt(s, outline[0], outline[1]), 9);
      expect(m.decentration).toEqual({ x: 0, y: 0 });
    });
  }

  it('maxRadiusFromOC of a centred 50 mm circle is 25', () => {
    expect(maxRadiusFromOC(circleOutline(50), { x: 0, y: 0 })).toBeCloseTo(25, 12);
    expect(maxRadiusFromOC(circleOutline(50), { x: 2, y: 0 })).toBeCloseTo(27, 12);
  });

  it('thicknessAt at the OC equals CT', () => {
    const { r } = solved(-4, 4);
    expect(thicknessAt(r.surfaces, 0, 0)).toBe(r.surfaces.ct);
  });

  it('decentred minus lens OD: thickest temporal, thinnest nasal, extremes labelled', () => {
    const { r, outline } = solved(-4, 4, { x: 2, y: 0 });
    const m = computeMetrics({ surfaces: r.surfaces, outline, density: 1.32, eye: 'OD' });
    expect(m.etMax.location).toBe('temporal');
    expect(m.etMin.location).toBe('nasal');
    expect(m.etMax.value).toBeCloseTo(m.etAt.temporal, 12);
    expect(m.etMin.value).toBeCloseTo(m.etAt.nasal, 12);
    expect(m.etAt.superior).toBeCloseTo(m.etAt.inferior, 9);
    expect(m.etMax.x).toBe(outline[2 * m.etMax.index]);
    expect(m.etMax.y).toBe(outline[2 * m.etMax.index + 1]);
    expect(m.decentration).toEqual({ x: 2, y: 0 });
    expect(m.mbsMm).toBeCloseTo(2 * 27 + 2, 9);
  });
});

describe('etMax/etMin tie rule (02-01, lens-critic round 2 MAJOR-1)', () => {
  const spec = (o) => ({
    eye: 'OD',
    sph: -0.5,
    cyl: -2,
    axisDeg: 180,
    materialId: 'cr39',
    frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
    monoPD: 32,
    fittingHeight: null,
    baseCurve: null,
    minCT: null,
    minET: null,
    ...o,
  });

  it('exports TIE_TOL_MM = 1e-9', () => {
    expect(TIE_TOL_MM).toBe(1e-9);
  });

  it('OD/OS −0,50 / −2,00 × 0 and × 180: same location, values bitwise the exact max/min', () => {
    for (const eye of ['OD', 'OS']) {
      for (const axisDeg of [0, 180]) {
        const s = spec({ eye, axisDeg });
        const r = evaluateLens(s);
        expect(r.ok).toBe(true);
        expect(r.metrics.etMax.location).toBe('temporal-superior');
        const ol = frameOutline(s.frame.shape, s.frame.A, s.frame.B, eye);
        let max = -Infinity;
        let min = Infinity;
        for (let i = 0; i < ol.length; i += 2) {
          const t = thicknessAt(r.surfaces, ol[i], ol[i + 1]);
          if (t > max) max = t;
          if (t < min) min = t;
        }
        expect(r.metrics.etMax.value).toBe(max);
        expect(r.metrics.etMin.value).toBe(min);
        const tSel = thicknessAt(r.surfaces, r.metrics.etMax.x, r.metrics.etMax.y);
        expect(Math.abs(tSel - max)).toBeLessThanOrEqual(TIE_TOL_MM);
      }
    }
  });
});
