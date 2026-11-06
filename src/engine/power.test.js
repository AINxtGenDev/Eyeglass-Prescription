import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  sphericalEquivalent,
  vogelBaseCurve,
  baseCurveAuto,
  BASE_CURVE_LIMITS,
  FRONT_RADIUS_MARGIN_MM,
  meridianPower,
  rxToMatrix,
  matrixToRx,
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
  it('limits are [0.5, 14] (D-A, 01-12) and frozen; margin is 2 mm', () => {
    expect(BASE_CURVE_LIMITS).toEqual({ min: 0.5, max: 14 });
    expect(Object.isFrozen(BASE_CURVE_LIMITS)).toBe(true);
    expect(FRONT_RADIUS_MARGIN_MM).toBe(2);
  });
  it('Vogel reference SE −12 → raw 0, clamped 0.5, maxD1 = 500/29 capped at 14', () => {
    expect(baseCurveAuto(-12, { n: 1.5, rhoMax: 27 })).toEqual({
      vogelD1: 0,
      vogelClampedD1: 0.5,
      maxD1: 14,
    });
  });
  it('Vogel reference SE +12 → raw 18, clamped 14', () => {
    const r = baseCurveAuto(12, { n: 1.5, rhoMax: 27 });
    expect(r.vogelD1).toBe(18);
    expect(r.vogelClampedD1).toBe(14);
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
  it('search upper bound n 1.738, rhoMax 51 → 738/53 (below the ceiling 14)', () => {
    expect(Math.abs(baseCurveAuto(0, { n: 1.738, rhoMax: 51 }).maxD1 - 738 / 53)).toBeLessThan(1e-9);
  });
  it('conic aware: k1 0.5 → 500/(53·√1.5)', () => {
    const r = baseCurveAuto(0, { n: 1.5, rhoMax: 51, k1: 0.5 });
    expect(Math.abs(r.maxD1 - 7.7027979333)).toBeLessThan(1e-9);
  });
  it('conic aware: k1 −1 and −2 → no front cap', () => {
    for (const k1 of [-1, -2]) {
      for (const rhoMax of [10, 51, 400, 5000]) {
        expect(baseCurveAuto(0, { n: 1.5, rhoMax, k1 }).maxD1).toBe(BASE_CURVE_LIMITS.max);
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
          const max = BASE_CURVE_LIMITS.max;
          if (r.vogelClampedD1 < 0.5 || r.vogelClampedD1 > max) return false;
          if (r.vogelClampedD1 !== Math.min(Math.max(vogelBaseCurve(se), 0.5), max)) return false;
          if (r.maxD1 > max) return false;
          if (k1 === 0) {
            const expected = Math.min(max, K(n) / (rhoMax + FRONT_RADIUS_MARGIN_MM));
            if (Math.abs(r.maxD1 - expected) > 1e-12) return false;
          }
          return true;
        },
      ),
      { numRuns: 500, seed: 3 },
    );
  });
});

describe('ENG-01 meridian power and power matrix', () => {
  const rxs = [
    { sph: -2, cyl: -1.5, axisDeg: 30 },
    { sph: 4, cyl: -2, axisDeg: 180 },
    { sph: 0, cyl: -0.25, axisDeg: 90 },
    { sph: -6, cyl: -6, axisDeg: 135 },
    { sph: 1, cyl: 0, axisDeg: 0 },
  ];
  it('D(α) = S, D(α + 90) = S + C, period 180°', () => {
    for (const { sph, cyl, axisDeg } of rxs) {
      expect(meridianPower(sph, cyl, axisDeg, axisDeg)).toBeCloseTo(sph, 12);
      expect(meridianPower(sph, cyl, axisDeg, axisDeg + 90)).toBeCloseTo(sph + cyl, 12);
      for (const t of [0, 17, 63, 101, 150]) {
        expect(meridianPower(sph, cyl, axisDeg, t + 180)).toBeCloseTo(meridianPower(sph, cyl, axisDeg, t), 12);
      }
    }
  });
  it('D(θ) = eᵀ·F·e for 36 sampled θ', () => {
    for (const rx of rxs) {
      const F = rxToMatrix(rx);
      for (let k = 0; k < 36; k++) {
        const th = (k * 10 * Math.PI) / 180;
        const e = [Math.cos(th), Math.sin(th)];
        const q = e[0] * (F[0][0] * e[0] + F[0][1] * e[1]) + e[1] * (F[1][0] * e[0] + F[1][1] * e[1]);
        expect(Math.abs(q - meridianPower(rx.sph, rx.cyl, rx.axisDeg, k * 10))).toBeLessThanOrEqual(1e-12);
      }
    }
  });
  it('F is symmetric', () => {
    const F = rxToMatrix({ sph: -2, cyl: -1, axisDeg: 70 });
    expect(F[0][1]).toBe(F[1][0]);
  });
  it('matrixToRx(rxToMatrix(rx)) round-trips (axis mod 180, skipped for cyl 0)', () => {
    const q = (lo, hi) => fc.integer({ min: lo * 4, max: hi * 4 }).map((k) => k / 4);
    fc.assert(
      fc.property(q(-12, 12), q(-6, 0), fc.integer({ min: 0, max: 179 }), (sph, cyl, axisDeg) => {
        const r = matrixToRx(rxToMatrix({ sph, cyl, axisDeg }));
        expect(Math.abs(r.sph - sph)).toBeLessThan(1e-9);
        expect(Math.abs(r.cyl - cyl)).toBeLessThan(1e-9);
        expect(r.cyl).toBeLessThanOrEqual(0);
        expect(r.axisDeg).toBeGreaterThanOrEqual(0);
        expect(r.axisDeg).toBeLessThan(180);
        if (cyl !== 0) {
          const d = Math.abs(r.axisDeg - axisDeg) % 180;
          expect(Math.min(d, 180 - d)).toBeLessThan(1e-7);
        }
      }),
      { numRuns: 500, seed: 7 },
    );
  });
  it('cyl 0 gives cyl exactly 0 (no −0)', () => {
    expect(Object.is(matrixToRx(rxToMatrix({ sph: -3, cyl: 0, axisDeg: 0 })).cyl, 0)).toBe(true);
  });
});
