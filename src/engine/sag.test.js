import { describe, it, expect } from 'vitest';
import { sphereSag, torusSag, sphereSagGrad, torusSagGrad } from './sag.js';
import { design } from './design.js';
import { vogelBaseCurve, sphericalEquivalent } from './power.js';

describe('ENG-02 sphere sag', () => {
  it('matches the closed form c = 0.01, r² = 100', () => {
    expect(Math.abs(sphereSag(0.01, 100) - 0.5012562893)).toBeLessThan(1e-9);
  });
  it('plano surface gives exactly 0', () => {
    expect(sphereSag(0, 400)).toBe(0);
  });
  it('is continuous for tiny curvature (no NaN)', () => {
    const s = sphereSag(1e-12, 400);
    expect(Number.isNaN(s)).toBe(false);
    expect(s).toBeCloseTo(2e-10, 20);
  });
  it('returns NaN on domain violation (q < 0)', () => {
    expect(Number.isNaN(sphereSag(0.05, 500))).toBe(true);
  });
  it('paraboloid (k = −1) gives c·r²/2', () => {
    expect(sphereSag(0.02, 900, -1)).toBeCloseTo((0.02 * 900) / 2, 12);
  });
});

// Deterministic pseudo-random points (no Math.random in tests).
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const naive = (cu, cv, u, v) => {
  const Ru = 1 / cu;
  const zv = 1 / cv - Math.sqrt(1 / (cv * cv) - v * v);
  return Ru - Math.sqrt((Ru - zv) ** 2 - u * u);
};
const CURVS = [-0.025, -0.01, 0.004, 0.01, 0.02, 0.026];

describe('ENG-03 torus sag (tyre, D-03)', () => {
  it('principal meridians are exactly the circle sags', () => {
    for (const cu of CURVS) {
      for (const cv of CURVS) {
        for (const t of [0.5, 5, 12.5, 25, 30]) {
          const a = sphereSag(cv, t * t);
          const b = sphereSag(cu, t * t);
          expect(Math.abs(torusSag(cu, cv, 0, t) - a)).toBeLessThanOrEqual(1e-15 * Math.abs(a));
          expect(Math.abs(torusSag(cu, cv, t, 0) - b)).toBeLessThanOrEqual(1e-15 * Math.abs(b));
        }
      }
    }
  });
  it('equal curvatures reduce to the sphere', () => {
    const rnd = lcg(1);
    for (let i = 0; i < 200; i++) {
      const c = CURVS[i % CURVS.length];
      const u = (rnd() - 0.5) * 50;
      const v = (rnd() - 0.5) * 50;
      expect(Math.abs(torusSag(c, c, u, v) - sphereSag(c, u * u + v * v))).toBeLessThanOrEqual(1e-12);
    }
  });
  it('cu = 0 is the exact circular cylinder; cu = 1e-12 is continuous', () => {
    for (const [u, v] of [
      [0, 10],
      [20, 10],
      [-30, -25],
    ]) {
      expect(torusSag(0, 0.02, u, v)).toBe(sphereSag(0.02, v * v));
      expect(Math.abs(torusSag(1e-12, 0.02, u, v) - torusSag(0, 0.02, u, v))).toBeLessThan(1e-9);
    }
  });
  it('stable form equals the naive form where that is well-conditioned', () => {
    const rnd = lcg(2);
    for (let i = 0; i < 300; i++) {
      const cu = 0.005 + rnd() * 0.02;
      const cv = 0.005 + rnd() * 0.02;
      const u = (rnd() - 0.5) * 40;
      const v = (rnd() - 0.5) * 40;
      const t = torusSag(cu, cv, u, v);
      if (Number.isNaN(t)) continue;
      expect(Math.abs(t - naive(cu, cv, u, v))).toBeLessThanOrEqual(1e-12);
    }
  });
  it('returns NaN on each domain violation', () => {
    expect(Number.isNaN(torusSag(0.01, 0.05, 0, 21))).toBe(true); // cv²v² > 1
    expect(Number.isNaN(torusSag(0.5, 0.05, 0, 19.9))).toBe(true); // 1 − cu·zv ≤ 0
    expect(Number.isNaN(torusSag(0.05, 0.01, 21, 1))).toBe(true); // 1 − q²u² < 0
  });
  it('tyre golden value (hand-computed) pins the orientation against the barrel form', () => {
    const tyre = torusSag(0.01, 0.02, 20, 20);
    const barrel = torusSag(0.02, 0.01, 20, 20);
    expect(Math.abs(tyre - 6.2846026794)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(barrel - 6.3876046419)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(barrel - tyre)).toBeGreaterThan(0.1);
  });
});

describe('ENG-03 sag gradients', () => {
  const h = 1e-6;
  it('sphereSagGrad matches central differences', () => {
    for (const c of CURVS) {
      for (const k of [0, -1, 0.5]) {
        for (const [x, y] of [
          [3, 4],
          [-12, 7],
          [20, -15],
        ]) {
          const s = (a, b) => sphereSag(c, a * a + b * b, k);
          const [gx, gy] = sphereSagGrad(c, x, y, k);
          expect(Math.abs(gx - (s(x + h, y) - s(x - h, y)) / (2 * h))).toBeLessThan(1e-6);
          expect(Math.abs(gy - (s(x, y + h) - s(x, y - h)) / (2 * h))).toBeLessThan(1e-6);
        }
      }
    }
  });
  it('torusSagGrad matches central differences', () => {
    for (const cu of CURVS) {
      for (const cv of CURVS) {
        for (const [u, v] of [
          [3, 4],
          [-12, 7],
          [20, -15],
          [0, 9],
          [9, 0],
        ]) {
          const s = (a, b) => torusSag(cu, cv, a, b);
          const [gu, gv] = torusSagGrad(cu, cv, u, v);
          expect(Math.abs(gu - (s(u + h, v) - s(u - h, v)) / (2 * h))).toBeLessThan(1e-6);
          expect(Math.abs(gv - (s(u, v + h) - s(u, v - h)) / (2 * h))).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe('ENG-03 model difference (PITFALLS Pitfall 5 cross-check)', () => {
  // Meridional (Euler) model: sphere sag with c(φ) = ca·cos²φ + cb·sin²φ, φ from the axis.
  const meridional = (ca, cb, u, v) => {
    const r2 = u * u + v * v;
    const c = r2 === 0 ? ca : (ca * u * u + cb * v * v) / r2;
    return sphereSag(c, r2);
  };
  const rows = [
    [0, -2],
    [0, -6],
    [4, -6],
    [-6, -6],
  ];
  for (const [sph, cyl] of rows) {
    it(`agrees on the principal meridians and differs off-axis (${sph}/${cyl}, r 30, n 1.50)`, () => {
      const D1 = vogelBaseCurve(sphericalEquivalent(sph, cyl));
      const s = design({ sph, cyl, axisDeg: 0, n: 1.5, D1, ct: 2, oc: { x: 0, y: 0 } });
      const r = 30;
      expect(torusSag(s.ca, s.cb, r, 0)).toBe(meridional(s.ca, s.cb, r, 0));
      expect(Math.abs(torusSag(s.ca, s.cb, 0, r) - meridional(s.ca, s.cb, 0, r))).toBeLessThanOrEqual(
        1e-15 * Math.abs(meridional(s.ca, s.cb, 0, r)),
      );
      let maxDiff = 0;
      for (let deg = 0; deg <= 90; deg += 0.5) {
        const p = (deg * Math.PI) / 180;
        const d = Math.abs(
          torusSag(s.ca, s.cb, r * Math.cos(p), r * Math.sin(p)) -
            meridional(s.ca, s.cb, r * Math.cos(p), r * Math.sin(p)),
        );
        if (d > maxDiff) maxDiff = d;
      }
      const q = r / Math.SQRT2;
      const diag = torusSag(s.ca, s.cb, q, q) - meridional(s.ca, s.cb, q, q);
      expect(maxDiff).toBeGreaterThan(1e-3);
      console.log(`[01-08] Pitfall 5 ${sph}/${cyl}: D1 ${D1}, diag 45° diff ${diag.toFixed(4)} mm, max |diff| ${maxDiff.toFixed(4)} mm`);
    });
  }
});
