import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { insideOutline, signedDistanceToOutline, outlineRadii } from './outline-geom.js';
import { frameOutline } from './frame/outline.js';

// Oracle: the private even-odd test of evaluate.js (lines 123–135), re-implemented here.
function oracleInside(outline, px, py) {
  let inside = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i];
    const yi = outline[2 * i + 1];
    const xj = outline[2 * j];
    const yj = outline[2 * j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Square of half-side 10 about the origin, CCW.
const SQUARE = Float64Array.from([10, -10, 10, 10, -10, 10, -10, -10]);

describe('REF-01 outline geometry (warp grid fast paths)', () => {
  it('insideOutline: square inside / outside cases', () => {
    expect(insideOutline(SQUARE, 0, 0)).toBe(true);
    expect(insideOutline(SQUARE, 9.999, -9.999)).toBe(true);
    expect(insideOutline(SQUARE, 10.001, 0)).toBe(false);
    expect(insideOutline(SQUARE, 0, -10.001)).toBe(false);
    expect(insideOutline(SQUARE, 50, 50)).toBe(false);
  });

  it('insideOutline equals the evaluate.js even-odd test on 1 000 random points (square and pilot)', () => {
    const pilot = frameOutline('pilot', 52, 38, 'OD');
    fc.assert(
      fc.property(fc.double({ min: -30, max: 30, noNaN: true }), fc.double({ min: -30, max: 30, noNaN: true }), (x, y) => {
        expect(insideOutline(SQUARE, x, y)).toBe(oracleInside(SQUARE, x, y));
        expect(insideOutline(pilot, x, y)).toBe(oracleInside(pilot, x, y));
      }),
      { numRuns: 1000, seed: 403 },
    );
  });

  it('signedDistanceToOutline: exact distance to a square edge, negative inside, positive outside', () => {
    expect(signedDistanceToOutline(SQUARE, 0, 0)).toBeCloseTo(-10, 12);
    expect(signedDistanceToOutline(SQUARE, 7, 1)).toBeCloseTo(-3, 12);
    expect(signedDistanceToOutline(SQUARE, 13, 2)).toBeCloseTo(3, 12);
    expect(signedDistanceToOutline(SQUARE, 0, -14.5)).toBeCloseTo(4.5, 12);
    // corner region: Euclidean distance to the vertex
    expect(signedDistanceToOutline(SQUARE, 13, 14)).toBeCloseTo(5, 12);
    fc.assert(
      fc.property(fc.double({ min: -30, max: 30, noNaN: true }), fc.double({ min: -30, max: 30, noNaN: true }), (x, y) => {
        const dx = Math.max(Math.abs(x) - 10, 0);
        const dy = Math.max(Math.abs(y) - 10, 0);
        const outside = Math.abs(x) > 10 || Math.abs(y) > 10;
        const exact = outside ? Math.hypot(dx, dy) : -Math.min(10 - Math.abs(x), 10 - Math.abs(y));
        expect(Math.abs(signedDistanceToOutline(SQUARE, x, y) - exact)).toBeLessThan(1e-12);
      }),
      { numRuns: 500, seed: 404 },
    );
  });

  it('outlineRadii: rMin ≤ |p − oc| ≤ rMax for every vertex; square about its centre', () => {
    const sq = outlineRadii(SQUARE, 0, 0);
    expect(sq.rMin).toBeCloseTo(10, 12);
    expect(sq.rMax).toBeCloseTo(Math.SQRT2 * 10, 12);
    for (const [shape, ox, oy] of [
      ['rechteckig', 6, 0],
      ['pilot', -13, 2],
      ['rund', 0, -5],
      ['panto', 3, 3],
    ]) {
      const o = frameOutline(shape, 40, 28, 'OD');
      const { rMin, rMax } = outlineRadii(o, ox, oy);
      expect(rMin).toBeGreaterThan(0);
      for (let i = 0; i < o.length; i += 2) {
        const r = Math.hypot(o[i] - ox, o[i + 1] - oy);
        expect(r).toBeGreaterThanOrEqual(rMin - 1e-12);
        expect(r).toBeLessThanOrEqual(rMax + 1e-12);
      }
    }
  });
});
