import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  sphericalEquivalent,
  vogelBaseCurve,
  baseCurveAuto,
  BASE_CURVE_LIMITS,
  FRONT_RADIUS_MARGIN_MM,
} from './power.js';
import { K } from './conventions.js';

describe('MAT-02 Vogel rule', () => {
  it('worked example +4.00 −1.00 × 90 → 9.50', () => {
    expect(vogelBaseCurve(sphericalEquivalent(4, -1))).toBeCloseTo(9.5, 12);
  });
  it('worked example −4.00 −2.00 × 180 → 3.50', () => {
    expect(sphericalEquivalent(-4, -2)).toBe(-5);
    expect(vogelBaseCurve(-5)).toBeCloseTo(3.5, 12);
  });
  it('is continuous at SE 0 (6.00)', () => {
    expect(vogelBaseCurve(0)).toBe(6);
    expect(vogelBaseCurve(1e-12)).toBeCloseTo(6, 10);
    expect(vogelBaseCurve(-1e-12)).toBeCloseTo(6, 10);
  });
});

describe('MAT-02 base curve', () => {
  it('limits are [0.5, 10] and frozen; margin is 2 mm', () => {
    expect(BASE_CURVE_LIMITS).toEqual({ min: 0.5, max: 10 });
    expect(Object.isFrozen(BASE_CURVE_LIMITS)).toBe(true);
    expect(FRONT_RADIUS_MARGIN_MM).toBe(2);
  });
  it('Vogel reference SE −12 → raw 0, clamped 0.5, maxD1 10', () => {
    expect(baseCurveAuto(-12, { n: 1.5, rhoMax: 27 })).toEqual({
      vogelD1: 0,
      vogelClampedD1: 0.5,
      maxD1: 10,
    });
  });
  it('Vogel reference SE +12 → raw 18, clamped 10', () => {
    const r = baseCurveAuto(12, { n: 1.5, rhoMax: 27 });
    expect(r.vogelD1).toBe(18);
    expect(r.vogelClampedD1).toBe(10);
  });
  it('Vogel reference SE −2 → 5, 5', () => {
    const r = baseCurveAuto(-2, { n: 1.5, rhoMax: 27 });
    expect(r.vogelD1).toBe(5);
    expect(r.vogelClampedD1).toBe(5);
  });
  it('search upper bound n 1.5, rhoMax 51 → 500/53, independent of SE', () => {
    for (const se of [-10, -2, 0, 3, 12]) {
      const r = baseCurveAuto(se, { n: 1.5, rhoMax: 51 });
      expect(Math.abs(r.maxD1 - 9.4339622642)).toBeLessThan(1e-9);
    }
  });
  it('search upper bound n 1.738, rhoMax 51 → 738/53 > 10 so 10', () => {
    expect(baseCurveAuto(0, { n: 1.738, rhoMax: 51 }).maxD1).toBe(10);
  });
  it('conic aware: k1 0.5 → 500/(53·√1.5)', () => {
    const r = baseCurveAuto(0, { n: 1.5, rhoMax: 51, k1: 0.5 });
    expect(Math.abs(r.maxD1 - 7.7027979333)).toBeLessThan(1e-9);
  });
  it('conic aware: k1 −1 and −2 → no front cap', () => {
    for (const k1 of [-1, -2]) {
      for (const rhoMax of [10, 51, 400, 5000]) {
        expect(baseCurveAuto(0, { n: 1.5, rhoMax, k1 }).maxD1).toBe(10);
      }
    }
  });
  it('k1 omitted equals k1 0', () => {
    expect(baseCurveAuto(-3, { n: 1.6, rhoMax: 60 })).toEqual(
      baseCurveAuto(-3, { n: 1.6, rhoMax: 60, k1: 0 }),
    );
  });
  it('invariant property (fast-check, 500 runs)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -18, max: 18, noNaN: true }),
        fc.constantFrom(1.5, 1.53, 1.59, 1.598, 1.664, 1.738),
        fc.double({ min: 10, max: 400, noNaN: true }),
        fc.constantFrom(-1, 0, 0.5),
        (se, n, rhoMax, k1) => {
          const r = baseCurveAuto(se, { n, rhoMax, k1 });
          if (r.vogelClampedD1 < 0.5 || r.vogelClampedD1 > 10) return false;
          if (r.vogelClampedD1 !== Math.min(Math.max(vogelBaseCurve(se), 0.5), 10)) return false;
          if (r.maxD1 > 10) return false;
          if (k1 === 0) {
            const expected = Math.min(10, K(n) / (rhoMax + FRONT_RADIUS_MARGIN_MM));
            if (Math.abs(r.maxD1 - expected) > 1e-12) return false;
          }
          return true;
        },
      ),
      { numRuns: 500, seed: 3 },
    );
  });
});
