import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { transpose, RX_CODES } from './transpose.js';

describe('transpose (RX-03)', () => {
  test('plus cylinder +1 +2 × 90 → minus +3 −2 × 180 (stored as 0)', () => {
    expect(transpose({ sph: 1, cyl: 2, axisDeg: 90 })).toEqual({
      minus: { sph: 3, cyl: -2, axisDeg: 0 },
      plus: { sph: 1, cyl: 2, axisDeg: 90 },
      transposed: true,
    });
  });

  test('minus cylinder −2 −1 × 180 stays, plus form −3 +1 × 90', () => {
    expect(transpose({ sph: -2, cyl: -1, axisDeg: 0 })).toEqual({
      minus: { sph: -2, cyl: -1, axisDeg: 0 },
      plus: { sph: -3, cyl: 1, axisDeg: 90 },
      transposed: false,
    });
  });

  test('oblique axis wraps: +0,50 +1,25 × 135 → +1,75 −1,25 × 45', () => {
    expect(transpose({ sph: 0.5, cyl: 1.25, axisDeg: 135 }).minus).toEqual({
      sph: 1.75,
      cyl: -1.25,
      axisDeg: 45,
    });
  });

  test('cyl 0 → plus null, not transposed, axis kept', () => {
    expect(transpose({ sph: -4, cyl: 0, axisDeg: 0 })).toEqual({
      minus: { sph: -4, cyl: 0, axisDeg: 0 },
      plus: null,
      transposed: false,
    });
  });

  test('never returns −0', () => {
    const r = transpose({ sph: -2, cyl: 2, axisDeg: 10 });
    expect(Object.is(r.minus.sph, 0)).toBe(true);
    const z = transpose({ sph: 0, cyl: -0, axisDeg: 0 });
    expect(Object.is(z.minus.cyl, 0)).toBe(true);
  });

  test('double transposition round-trips; axes stay in [0, 180) (fast-check, 200 runs)', () => {
    const quarter = (lo, hi) => fc.integer({ min: lo * 4, max: hi * 4 }).map((q) => q / 4);
    fc.assert(
      fc.property(quarter(-12, 12), quarter(-6, 6), fc.integer({ min: 0, max: 179 }), (sph, cyl, axisDeg) => {
        const r = transpose({ sph, cyl, axisDeg });
        const inRange = (a) => Number.isInteger(a) && a >= 0 && a < 180;
        if (!inRange(r.minus.axisDeg)) return false;
        if (r.minus.cyl > 0) return false;
        if (r.transposed !== cyl > 0) return false;
        if (cyl === 0) return r.plus === null;
        if (!inRange(r.plus.axisDeg) || r.plus.cyl <= 0) return false;
        // the input is one of the two forms
        const input = { sph, cyl, axisDeg };
        expect(cyl > 0 ? r.plus : r.minus).toEqual(input);
        // transposing either form gives the same pair back
        expect(transpose(r.plus)).toEqual({ ...r, transposed: true });
        expect(transpose(r.minus)).toEqual({ ...r, transposed: false });
        // spherical equivalent is invariant
        return r.minus.sph + r.minus.cyl / 2 === r.plus.sph + r.plus.cyl / 2;
      }),
      { numRuns: 200, seed: 5 },
    );
  });
});

describe('RX_CODES', () => {
  test('is frozen and keys equal values', () => {
    expect(Object.isFrozen(RX_CODES)).toBe(true);
    expect(Object.keys(RX_CODES).sort()).toEqual(['AXIS_MISSING_FOR_CYL', 'CYL_TRANSPOSED']);
    for (const [k, v] of Object.entries(RX_CODES)) expect(v).toBe(k);
  });
});
