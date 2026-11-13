import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { traceRay, traceBVP } from './trace.js';
import { design, backSagAt } from './design.js';
import { rxToMatrix, matrixToRx, vogelBaseCurve, sphericalEquivalent } from './power.js';
import { K } from './conventions.js';
import { evaluateLens } from './evaluate.js';
import { traceFromEye, TRACE_STATUS } from './trace.js';
import { frameOutline } from './frame/outline.js';

const O = { x: 0, y: 0 };
const q4 = (lo, hi) => fc.integer({ min: lo * 4, max: hi * 4 }).map((k) => k / 4);
const vogelD1 = (sph, cyl) => Math.min(10, Math.max(0.5, vogelBaseCurve(sphericalEquivalent(sph, cyl))));
const ELEMENTS = [
  [0, 0],
  [0, 1],
  [1, 1],
];
const maxElementError = (F, E) => Math.max(...ELEMENTS.map(([i, j]) => Math.abs(F[i][j] - E[i][j])));
const axisError = (a, b) => {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
};

describe('ENG-08 tier 3 ray-trace oracle (design)', () => {
  const cases = [
    { sph: 12, cyl: -6, axisDeg: 45, n: 1.5 },
    { sph: -12, cyl: -6, axisDeg: 10, n: 1.738 },
    { sph: 4, cyl: -2, axisDeg: 180, n: 1.664 },
    { sph: -6, cyl: 0, axisDeg: 0, n: 1.59 },
    { sph: 0, cyl: -0.25, axisDeg: 90, n: 1.5 },
  ];
  for (const c of cases) {
    it(`thick design ${c.sph}/${c.cyl}×${c.axisDeg} n ${c.n} reproduces the Rx within 0,01 dpt`, () => {
      const ct = c.sph > 0 ? 8 : 2;
      const s = design({ ...c, D1: vogelD1(c.sph, c.cyl), ct, oc: O });
      const F = traceBVP(s);
      expect(maxElementError(F, rxToMatrix(c))).toBeLessThan(0.01);
    });
  }
  it('works with a decentred OC (rays about the OC)', () => {
    const rx = { sph: -4, cyl: -2, axisDeg: 30 };
    const s = design({ ...rx, n: 1.5, D1: 4, ct: 2, oc: { x: 3, y: -2 } });
    expect(maxElementError(traceBVP(s), rxToMatrix(rx))).toBeLessThan(0.01);
  });
  it('axis rotation sign: ×30 traces back to 30 and ×150 to 150', () => {
    for (const axisDeg of [30, 150]) {
      const s = design({ sph: -2, cyl: -2, axisDeg, n: 1.5, D1: 4, ct: 2, oc: O });
      const r = matrixToRx(traceBVP(s));
      expect(axisError(r.axisDeg, axisDeg)).toBeLessThan(0.1);
    }
  });
  it('rejects a thin-lens design (D2 = S − D1, no vertex term) at +8,00, CT 8 mm', () => {
    const sph = 8;
    const s = design({ sph, cyl: 0, axisDeg: 0, n: 1.5, D1: vogelD1(sph, 0), ct: 8, oc: O });
    const thin = { ...s, ca: -(sph - s.D1) / K(1.5), cb: -(sph - s.D1) / K(1.5) };
    const err = maxElementError(traceBVP(thin), rxToMatrix({ sph, cyl: 0, axisDeg: 0 }));
    expect(err).toBeGreaterThan(0.3);
    console.log('[01-08] thin-lens design +8 CT 8: oracle error', err.toFixed(4), 'dpt');
  });
  it('traceRay is deterministic and returns P and slope at the back vertex plane', () => {
    const s = design({ sph: 3, cyl: -1, axisDeg: 20, n: 1.6, D1: 8, ct: 4, oc: O });
    const a = traceRay(s, 0.2, -0.1);
    const b = traceRay(s, 0.2, -0.1);
    expect(a).toEqual(b);
    expect(a.P).toHaveLength(2);
    expect(a.slope).toHaveLength(2);
    expect(a.iterations[0]).toBeLessThanOrEqual(20);
    expect(a.iterations[1]).toBeLessThanOrEqual(20);
    // on-axis ray stays on axis
    const z = traceRay(s, 0, 0);
    expect(Math.abs(z.P[0]) + Math.abs(z.P[1]) + Math.abs(z.slope[0]) + Math.abs(z.slope[1])).toBe(0);
  });
  it('throws when the ray misses a surface (non-converging oracle fails loudly)', () => {
    const s = design({ sph: -20, cyl: -4, axisDeg: 0, n: 1.5, D1: 0.5, ct: 2, oc: O });
    expect(() => traceRay(s, 30, 0)).toThrow();
  });

  it('property: full input range within 0,01 dpt, axis within 0,1° (300 runs, seed 42)', () => {
    let worst = 0;
    let worstAxis = 0;
    let maxIter = 0;
    fc.assert(
      fc.property(
        q4(-12, 12),
        q4(-6, 0),
        fc.integer({ min: 0, max: 179 }),
        fc.constantFrom(1.5, 1.53, 1.59, 1.598, 1.664, 1.738),
        fc.double({ min: 1, max: 12, noNaN: true }),
        (sph, cyl, axisDeg, n, ct) => {
          const rx = { sph, cyl, axisDeg };
          const s = design({ ...rx, n, D1: vogelD1(sph, cyl), ct, oc: O });
          const F = traceBVP(s);
          const err = maxElementError(F, rxToMatrix(rx));
          worst = Math.max(worst, err);
          expect(err).toBeLessThan(0.01);
          if (Math.abs(cyl) >= 0.25) {
            const a = axisError(matrixToRx(F).axisDeg, axisDeg);
            worstAxis = Math.max(worstAxis, a);
            expect(a).toBeLessThan(0.1);
          }
          for (const [x, y] of [
            [0.25, 0],
            [0, 0.25],
            [-0.18, 0.18],
          ]) {
            const r = traceRay(s, x, y);
            maxIter = Math.max(maxIter, ...r.iterations);
          }
        },
      ),
      { numRuns: 300, seed: 42 },
    );
    expect(maxIter).toBeLessThanOrEqual(20);
    console.log(`[01-08] design property: worst element error ${worst.toExponential(3)} dpt, worst axis error ${worstAxis.toExponential(3)}°, max Newton iterations ${maxIter}`);
  });
});

describe('ENG-03 implicit-torus check (independent of torusSag algebra)', () => {
  const cases = [
    { sph: -4, cyl: -2, axisDeg: 30, D1: 4 }, // concave back
    { sph: 12, cyl: -2, axisDeg: 120, D1: 6 }, // convex back
    { sph: 6, cyl: -4, axisDeg: 75, D1: 4 }, // mixed back (ca < 0 < cb)
    { sph: -8, cyl: -6, axisDeg: 0, D1: 1 },
  ];
  for (const c of cases) {
    it(`back sag satisfies the tyre-torus equation (${c.sph}/${c.cyl}×${c.axisDeg}, D1 ${c.D1})`, () => {
      const oc = { x: 2, y: -1 };
      const s = design({ ...c, n: 1.5, ct: 3, oc });
      expect(s.ca !== 0 && s.cb !== 0).toBe(true);
      const Ru = 1 / s.ca;
      const rv = 1 / s.cb;
      const a = (c.axisDeg * Math.PI) / 180;
      let checked = 0;
      for (let k = 0; checked < 50 && k < 500; k++) {
        const u = 22 * Math.sin(1.7 * k + 0.3);
        const v = 22 * Math.cos(2.3 * k + 0.1);
        if (Math.abs(u) < 0.5 || Math.abs(v) < 0.5) continue;
        const x = oc.x + u * Math.cos(a) - v * Math.sin(a);
        const y = oc.y + u * Math.sin(a) + v * Math.cos(a);
        const z = backSagAt(s, x, y);
        if (Number.isNaN(z)) continue;
        const res = v * v + (Math.sign(Ru) * Math.sqrt(u * u + (Ru - z) ** 2) - (Ru - rv)) ** 2 - rv * rv;
        expect(Math.abs(res)).toBeLessThanOrEqual(1e-9 * rv * rv);
        checked++;
      }
      expect(checked).toBe(50);
    });
  }
});

describe('ENG-02 pipeline property: evaluateLens surfaces reproduce the Rx', () => {
  it('automatic base curve, CT solve, decentred OC (100 runs, seed: 43)', () => {
    let worst = 0;
    let okRuns = 0;
    fc.assert(
      fc.property(
        q4(-12, 12),
        q4(-6, 0),
        fc.integer({ min: 0, max: 179 }),
        fc.constantFrom('cr39', 'trivex', 'pc', 'idx160', 'idx167', 'idx174'),
        fc.constantFrom('rund', 'rechteckig', 'panto', 'pilot'),
        fc.integer({ min: 40, max: 62 }),
        fc.integer({ min: 28, max: 55 }),
        fc.integer({ min: 14, max: 24 }),
        fc.integer({ min: 25, max: 40 }),
        fc.constantFrom('OD', 'OS'),
        (sph, cyl, axisDeg, materialId, shape, A, B, DBL, monoPD, eye) => {
          const spec = {
            eye,
            sph,
            cyl,
            axisDeg,
            materialId,
            frame: { shape, A, B, DBL },
            monoPD,
            fittingHeight: null,
            baseCurve: null,
            minCT: null,
            minET: null,
          };
          const r = evaluateLens(spec);
          if (!r.ok) return;
          okRuns++;
          const err = maxElementError(traceBVP(r.surfaces), rxToMatrix(spec));
          worst = Math.max(worst, err);
          expect(err).toBeLessThan(0.01);
        },
      ),
      { numRuns: 100, seed: 43 },
    );
    expect(okRuns).toBeGreaterThan(50);
    console.log(`[01-08] evaluateLens property: ${okRuns}/100 computable, worst element error ${worst.toExponential(3)} dpt`);
  });
});

describe('REF-01 reverse trace from the eye (D-12)', () => {
  const H = 15;
  const lensSpec = (o = {}) => ({
    eye: 'OD',
    sph: -4,
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
  const plate = (n = 1.5) => ({ n, ct: 2, c1: 0, k1: 0, ca: 0, cb: 0, axisRad: 0, oc: { x: 0, y: 0 } });
  const allFiniteDeep = (v) =>
    typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' ? true : Object.values(v).every(allFiniteDeep);
  const insidePolygon = (outline, px, py) => {
    let inside = false;
    const m = outline.length / 2;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const xi = outline[2 * i];
      const yi = outline[2 * i + 1];
      const xj = outline[2 * j];
      const yj = outline[2 * j + 1];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  it('TRACE_STATUS lists the five statuses and is frozen', () => {
    expect(TRACE_STATUS).toEqual({ OK: 'ok', MISS_BACK: 'missBack', TIR_BACK: 'tirBack', MISS_FRONT: 'missFront', TIR_FRONT: 'tirFront' });
    expect(Object.isFrozen(TRACE_STATUS)).toBe(true);
  });

  it('plane-parallel plate keeps every direction (objTan = eye tan within 1e-12)', () => {
    const s = plate();
    for (const ex of [0, 0.2, -0.2, 0.5, -0.5]) {
      for (const ey of [0, 0.2, -0.2, 0.5, -0.5]) {
        const r = traceFromEye(s, H, ex, ey);
        expect(r.status).toBe('ok');
        expect(Math.abs(r.objTan[0] - ex)).toBeLessThan(1e-12);
        expect(Math.abs(r.objTan[1] - ey)).toBeLessThan(1e-12);
      }
    }
  });

  it('on-axis ray of −4,00 CR-39 (rechteckig 52×38/18, PD 32) leaves along the axis', () => {
    const lens = evaluateLens(lensSpec());
    expect(lens.ok).toBe(true);
    const r = traceFromEye(lens.surfaces, H, 0, 0);
    expect(r.status).toBe('ok');
    expect(Math.abs(r.objTan[0])).toBeLessThan(1e-12);
    expect(Math.abs(r.objTan[1])).toBeLessThan(1e-12);
  });

  it('missBack: a direction so oblique that the back seed leaves the sag domain (no exception)', () => {
    const s = design({ sph: -20, cyl: -4, axisDeg: 0, n: 1.5, D1: 0.5, ct: 2, oc: O });
    const r = traceFromEye(s, H, 5, 0);
    expect(r).toEqual({ status: 'missBack' });
  });

  it('missFront: flat back hit, steep synthetic front out of reach (no exception)', () => {
    // Synthetic: front radius 16,7 mm; the back hit at x ≈ 20 mm lies outside the front's domain.
    const s = { ...plate(), c1: 0.06 };
    const r = traceFromEye(s, H, 1.2, 0);
    expect(r.status).toBe('missFront');
    expect(r.back).toHaveLength(3);
    expect(r.front).toBeUndefined();
    expect(allFiniteDeep(r)).toBe(true);
  });

  it('tirFront with a real lens: −4,00 CR-39 OD, temporal at tan 1,97, back hit inside the frame outline', () => {
    const lens = evaluateLens(lensSpec());
    expect(lens.ok).toBe(true);
    // OD: +x = nasal (conventions.js), so temporal = −x.
    const r = traceFromEye(lens.surfaces, H, -1.97, 0);
    expect(r.status).toBe('tirFront');
    expect(r.back).toHaveLength(3);
    expect(r.front).toHaveLength(3);
    expect(r.objTan).toBeUndefined();
    expect(allFiniteDeep(r)).toBe(true);
    const outline = frameOutline('rechteckig', 52, 38, 'OD');
    expect(insidePolygon(outline, r.back[0], r.back[1])).toBe(true);
  });

  it('tirBack (SYNTHETIC n = 0,6 < 1, branch coverage only: unreachable for any catalogue lens)', () => {
    // n > 1 never reflects totally when entering glass from air; n = 0,6 makes η = 1/n > 1.
    const r = traceFromEye(plate(0.6), H, 1, 0);
    expect(r.status).toBe('tirBack');
    expect(r.back).toHaveLength(3);
    expect(r.front).toBeUndefined();
    expect(allFiniteDeep(r)).toBe(true);
  });

  it('property: no exception, ok always has finite objTan (Sph −12…+12, Cyl 0…−6, CR-39/1,74, tan ≤ 0,816; 300 runs, seed 44)', () => {
    let ok = 0;
    let skipped = 0;
    const counts = {};
    fc.assert(
      fc.property(
        q4(-12, 12),
        q4(-6, 0),
        fc.integer({ min: 0, max: 179 }),
        fc.constantFrom('cr39', 'idx174'),
        fc.constantFrom('OD', 'OS'),
        fc.double({ min: 0, max: 0.816, noNaN: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        (sph, cyl, axisDeg, materialId, eye, rho, phi) => {
          const lens = evaluateLens(lensSpec({ sph, cyl, axisDeg, materialId, eye }));
          if (!lens.ok) {
            skipped++;
            return;
          }
          const r = traceFromEye(lens.surfaces, H, rho * Math.cos(phi), rho * Math.sin(phi));
          counts[r.status] = (counts[r.status] ?? 0) + 1;
          expect(Object.values(TRACE_STATUS)).toContain(r.status);
          expect(allFiniteDeep(r)).toBe(true);
          if (r.status === 'ok') {
            ok++;
            expect(r.objTan.every(Number.isFinite)).toBe(true);
          }
        },
      ),
      { numRuns: 300, seed: 44 },
    );
    console.log(`[04-01] traceFromEye property: statuses ${JSON.stringify(counts)}, ${skipped} engine-rejected skipped`);
    expect(ok).toBeGreaterThan(100);
  });
});
