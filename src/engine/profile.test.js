// ANA-01 (02-13): meridian profile of the lens. The drawing's numbers must be the result's
// numbers: t(0) = CT, the end thicknesses = thicknessAt at the outline hit points.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateLens } from './evaluate.js';
import { thicknessAt } from './metrics.js';
import { nasalSign } from './conventions.js';
import { frameOutline } from './frame/outline.js';
import { SHAPES } from './frame/shapes.js';
import { MATERIALS } from './materials.js';
import { meridianProfile, principalMeridians, meridianEndLabels, END_LABEL_TOL_DEG } from './profile.js';

const lens = (o = {}) => ({
  eye: 'OD',
  sph: -2.75,
  cyl: -0.5,
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
const quarter = (min, max) => fc.integer({ min: min * 4, max: max * 4 }).map((k) => k / 4 + 0);
const SHAPES4 = ['rund', 'rechteckig', 'panto', 'pilot'];

/** Distance from (px, py) to the closed outline polygon. */
function boundaryDistance(outline, px, py) {
  const n = outline.length / 2;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    const ax = outline[2 * i];
    const ay = outline[2 * i + 1];
    const ex = outline[2 * k] - ax;
    const ey = outline[2 * k + 1] - ay;
    const u = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
    best = Math.min(best, Math.hypot(ax + u * ex - px, ay + u * ey - py));
  }
  return best;
}

const input = (r, s) => ({ surfaces: r.surfaces, frame: s.frame, eye: s.eye });

describe('meridianProfile (ANA-01)', () => {
  it('property: t(0) = CT, ends = thicknessAt at the hit points, ends on the outline (≥ 100 cases)', () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-8, 6),
          cyl: quarter(-4, 0),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          shape: fc.constantFrom(...SHAPES4),
          monoPD: fc.integer({ min: 30, max: 34 }),
          eye: fc.constantFrom('OD', 'OS'),
        }),
        ({ sph, cyl, axisDeg, shape, monoPD, eye }) => {
          const { A, B, DBL } = SHAPES[shape].defaults;
          const s = lens({ eye, sph, cyl, axisDeg, monoPD, frame: { shape, A, B, DBL } });
          const r = evaluateLens(s);
          if (!r.ok) return;
          checked++;
          const outline = frameOutline(shape, A, B, eye);
          for (const theta of principalMeridians({ cyl, axisDeg })) {
            const p = meridianProfile(input(r, s), theta);
            expect(p.ok).toBe(true);
            expect(p.thetaDeg).toBe(theta);
            expect(p.ct).toBe(r.metrics.ct);
            const i0 = p.s.indexOf(0);
            expect(i0).toBeGreaterThan(0);
            expect(Math.abs(p.t[i0] - r.metrics.ct)).toBeLessThan(1e-9);
            expect(p.ends[0].s).toBeGreaterThan(0);
            expect(p.ends[1].s).toBeLessThan(0);
            expect(p.s[p.s.length - 1]).toBe(p.ends[0].s);
            expect(p.s[0]).toBe(p.ends[1].s);
            for (const end of p.ends) {
              expect(Math.abs(end.t - thicknessAt(r.surfaces, end.x, end.y))).toBeLessThan(1e-9);
              expect(boundaryDistance(outline, end.x, end.y)).toBeLessThan(1e-6);
            }
            for (let i = 0; i < p.s.length; i++) {
              expect(p.t[i]).toBeCloseTo(p.zFront[i] - p.zBack[i], 12);
            }
          }
        },
      ),
      { numRuns: 120, seed: 13 },
    );
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  it('property: θ and θ + 180° give the same chord reversed (≥ 100 cases)', () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-8, 6),
          cyl: quarter(-4, 0),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          theta: fc.integer({ min: 0, max: 179 }),
          shape: fc.constantFrom(...SHAPES4),
          monoPD: fc.integer({ min: 30, max: 34 }),
          eye: fc.constantFrom('OD', 'OS'),
        }),
        ({ sph, cyl, axisDeg, theta, shape, monoPD, eye }) => {
          const { A, B, DBL } = SHAPES[shape].defaults;
          const s = lens({ eye, sph, cyl, axisDeg, monoPD, frame: { shape, A, B, DBL } });
          const r = evaluateLens(s);
          if (!r.ok) return;
          checked++;
          const p = meridianProfile(input(r, s), theta);
          const q = meridianProfile(input(r, s), theta + 180);
          expect(p.ok && q.ok).toBe(true);
          expect(q.s.length).toBe(p.s.length);
          const n = p.s.length;
          for (let i = 0; i < n; i++) {
            expect(Math.abs(q.s[i] + p.s[n - 1 - i])).toBeLessThan(1e-9);
            expect(Math.abs(q.t[i] - p.t[n - 1 - i])).toBeLessThan(1e-9);
          }
          expect(Math.abs(q.ends[0].t - p.ends[1].t)).toBeLessThan(1e-9);
          expect(Math.abs(q.ends[1].t - p.ends[0].t)).toBeLessThan(1e-9);
        },
      ),
      { numRuns: 120, seed: 31 },
    );
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  it('example OD horizontal: nasal end in +x, temporal in −x, both ends ≥ minET − 0,01 mm', () => {
    const s = lens();
    const r = evaluateLens(s);
    expect(r.ok).toBe(true);
    const p = meridianProfile(input(r, s), 0);
    expect(p.ok).toBe(true);
    expect(nasalSign('OD')).toBe(1);
    expect(p.ends[0].location).toContain('nasal');
    expect(p.ends[1].location).toContain('temporal');
    const minET = MATERIALS.cr39.minET;
    expect(Math.min(p.ends[0].t, p.ends[1].t)).toBeGreaterThanOrEqual(minET - 0.01);
    expect(p.s.length).toBe(97);
  });

  it('worst end thickness margin to minET over the principal meridians of a grid (recorded for the SUMMARY)', () => {
    let worst = Infinity;
    for (const shape of SHAPES4) {
      const { A, B, DBL } = SHAPES[shape].defaults;
      for (const sph of [-8, -4, -1, 0, 2, 6]) {
        for (const cyl of [0, -1, -4]) {
          for (const axisDeg of [0, 30, 90, 150]) {
            for (const eye of ['OD', 'OS']) {
              const s = lens({ eye, sph, cyl, axisDeg, frame: { shape, A, B, DBL } });
              const r = evaluateLens(s);
              if (!r.ok) continue;
              for (const theta of [...principalMeridians({ cyl, axisDeg }), 90]) {
                const p = meridianProfile(input(r, s), theta);
                for (const e of p.ends) worst = Math.min(worst, e.t - MATERIALS.cr39.minET);
              }
            }
          }
        }
      }
    }
    console.info(`meridianProfile: worst end t − minET = ${worst.toExponential(3)} mm`);
    expect(worst).toBeGreaterThanOrEqual(-0.01);
  });

  it('OC outside the outline → NO_CHORD when the line misses one side (engine-level only)', () => {
    const s = lens({ monoPD: 70 });
    const r = evaluateLens(s);
    expect(r.ok).toBe(true);
    expect(r.diagnostics.map((d) => d.code)).toContain('OC_OUTSIDE_OUTLINE');
    expect(meridianProfile(input(r, s), 0)).toEqual({ ok: false, code: 'NO_CHORD' });
    expect(meridianProfile(input(r, s), 90)).toEqual({ ok: false, code: 'NO_CHORD' });
  });

  it('non-finite surfaces → NO_CHORD, never a throw', () => {
    const s = lens();
    const r = evaluateLens(s);
    const bad = { ...r.surfaces, ct: Number.NaN };
    expect(meridianProfile({ surfaces: bad, frame: s.frame, eye: 'OD' }, 0)).toEqual({ ok: false, code: 'NO_CHORD' });
  });
});

describe('principalMeridians', () => {
  it('horizontal plus the two principal meridians, deduplicated, ascending', () => {
    expect(principalMeridians({ cyl: 0, axisDeg: 30 })).toEqual([0]);
    expect(principalMeridians({ cyl: -2, axisDeg: 30 })).toEqual([0, 30, 120]);
    expect(principalMeridians({ cyl: -2, axisDeg: 0 })).toEqual([0, 90]);
    expect(principalMeridians({ cyl: -2, axisDeg: 90 })).toEqual([0, 90]);
    expect(principalMeridians({ cyl: -1, axisDeg: 120 })).toEqual([0, 30, 120]);
  });
});

describe('meridianEndLabels', () => {
  it('tolerance is 15°', () => {
    expect(END_LABEL_TOL_DEG).toBe(15);
  });
  // nasalSign('OD') = +1 (conventions.js): OD nasal is +x.
  it.each([
    ['OD', 0, ['nasal', 'temporal']],
    ['OD', 10, ['nasal', 'temporal']],
    ['OD', 30, ['nasal-superior', 'temporal-inferior']],
    ['OD', 90, ['superior', 'inferior']],
    ['OD', 80, ['superior', 'inferior']],
    ['OD', 120, ['temporal-superior', 'nasal-inferior']],
    ['OD', 170, ['temporal', 'nasal']],
    ['OS', 0, ['temporal', 'nasal']],
    ['OS', 10, ['temporal', 'nasal']],
    ['OS', 30, ['temporal-superior', 'nasal-inferior']],
    ['OS', 90, ['superior', 'inferior']],
    ['OS', 120, ['nasal-superior', 'temporal-inferior']],
  ])('%s %i° → %j', (eye, theta, want) => {
    expect(meridianEndLabels(eye, theta)).toEqual(want);
  });
  it('the labels come from the direction: θ + 180° swaps them', () => {
    for (const eye of ['OD', 'OS']) {
      for (const th of [0, 10, 30, 90, 120]) {
        expect(meridianEndLabels(eye, th + 180)).toEqual([...meridianEndLabels(eye, th)].reverse());
      }
    }
  });
});
