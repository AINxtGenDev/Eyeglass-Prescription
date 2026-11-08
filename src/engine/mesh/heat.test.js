// VIZ-05 (03-03, D-04(e)/D-23/D-25): every heatmap number is an engine number. Callouts are
// compared with toBe (the same numbers, never re-sampled from the mesh).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateLens } from '../evaluate.js';
import { thicknessAt } from '../metrics.js';
import { frameOutline } from '../frame/outline.js';
import { MATERIALS } from '../materials.js';
import { meridianProfile, meridianEndLabels } from '../profile.js';
import { thickest, thinnest } from '../../state/compare.js';
import { allocLensBuffers, buildLensMesh } from './lens.js';
import { heatScale, ISO_STEPS, isoLevels, heatCallouts, isoLabelPoints, THICKEST_MERGE_DEG } from './heat.js';

// lens(o) copied from lens.test.js
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
const SHAPES4 = ['rund', 'rechteckig', 'panto', 'pilot'];

const EX_OD = lens({ axisDeg: 180 });
const EX_OS = lens({ eye: 'OS', sph: -2.5, cyl: -0.75, axisDeg: 170, monoPD: 31.5 });
const GRENZFALL = lens({
  sph: 10.75,
  cyl: -1,
  axisDeg: 89,
  materialId: 'idx167',
  frame: { shape: 'rechteckig', A: 43, B: 43, DBL: 21 },
  monoPD: 36,
});
const MINUS10 = lens({ sph: -10, cyl: 0, frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 14 }, monoPD: 25 });
const PLUS4 = lens({ sph: 4, cyl: 0 });
// Minus lens whose etMax lies on the temporal half-chord (polar angle 180,00° about the OC).
const MINUS4_RUND = lens({ sph: -4, cyl: 0, frame: { shape: 'rund', A: 48, B: 44, DBL: 20 }, monoPD: 30 });

function evalLens(spec) {
  const r = evaluateLens(spec);
  expect(r.ok).toBe(true);
  return { r, L: { surfaces: r.surfaces, frame: spec.frame, eye: spec.eye } };
}

describe('VIZ-05 heat values from the engine D-04(e)', () => {
  it('heatScale = min of thinnest and max of thickest over the displayed lenses (D-23/D-25)', () => {
    const ms = [EX_OD, EX_OS, PLUS4, MINUS10].map((s) => evaluateLens(s).metrics);
    for (const list of [ms.slice(0, 1), ms.slice(0, 2), ms]) {
      const sc = heatScale(list);
      expect(sc.min).toBe(Math.min(...list.map((m) => thinnest(m).value)));
      expect(sc.max).toBe(Math.max(...list.map((m) => thickest(m).value)));
    }
    expect(heatScale([])).toBeNull();
  });

  it('ISO_STEPS: the UI-SPEC set plus 5 and 10', () => {
    expect(ISO_STEPS).toEqual([0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]);
    expect(Object.isFrozen(ISO_STEPS)).toBe(true);
  });

  it('isoLevels: step, values strictly inside, scale ends, flat flag', () => {
    expect(isoLevels(1.8, 4.6)).toEqual({ step: 0.5, values: [2, 2.5, 3, 3.5, 4, 4.5], scaleMin: 1.5, scaleMax: 5, flat: false });
    expect(isoLevels(2.0, 2.05).flat).toBe(true);
    const big = isoLevels(1.0, 41.5);
    expect(big.step).toBe(5);
    expect(big.values).toEqual([5, 10, 15, 20, 25, 30, 35, 40]);
    const eq = isoLevels(3, 3);
    expect(eq.scaleMax).toBeGreaterThan(eq.scaleMin);
    expect(eq.flat).toBe(true);
    // values rounded to 1e-9: no 0,30000000000000004
    const fine = isoLevels(0.15, 0.95);
    expect(fine.step).toBe(0.1);
    expect(fine.values).toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    // exact multiples at the ends are not inside
    expect(isoLevels(2, 4).values).toEqual([2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]);
    // beyond 10 · 9 mm: the largest step, more than 8 lines (no computable lens gets there)
    expect(isoLevels(0, 200).step).toBe(10);
    // every result: 2…8 lines or flat
    for (const [a, b] of [
      [1.8, 4.597],
      [1.8, 41.499],
      [0.5, 0.71],
      [4.876, 4.9],
    ]) {
      const r = isoLevels(a, b);
      expect(r.flat || (r.values.length >= 2 && r.values.length <= 8)).toBe(true);
      expect(r.scaleMin).toBeLessThanOrEqual(a);
      expect(r.scaleMax).toBeGreaterThanOrEqual(b);
    }
  });

  for (const [name, spec] of [
    ['example OD', EX_OD],
    ['example OS', EX_OS],
  ]) {
    it(`heatCallouts D-04(e) ${name}: edge callouts are meridianProfile ends, centre = ct at the OC`, () => {
      const { r, L } = evalLens(spec);
      const m = r.metrics;
      const c = heatCallouts(L, m);
      expect(c.ok).toBe(true);
      for (const theta of [0, 90]) {
        const p = meridianProfile(L, theta);
        const labels = meridianEndLabels(spec.eye, theta);
        for (let e = 0; e < 2; e++) {
          const k = labels[e];
          expect(c[k].t).toBe(p.ends[e].t);
          expect(c[k].x).toBe(p.ends[e].x);
          expect(c[k].y).toBe(p.ends[e].y);
        }
      }
      expect(Object.keys(c).sort()).toEqual(['centre', 'inferior', 'nasal', 'ok', 'superior', 'temporal', 'thickest']);
      expect(c.centre.t).toBe(m.ct);
      expect(c.centre.x).toBe(r.surfaces.oc.x);
      expect(c.centre.y).toBe(r.surfaces.oc.y);
      expect(c.thickest.t).toBe(Math.max(m.ct, m.etMax.value));
      expect(c.thickest.t).toBe(thickest(m).value);
      expect(c.thickest.where).toBe('edge');
      expect(c.thickest.x).toBe(m.etMax.x);
      expect(c.thickest.y).toBe(m.etMax.y);
    });
  }

  it('thickest: plus lens → centre (merge centre); minus → edge, merged only within 10°', () => {
    expect(THICKEST_MERGE_DEG).toBe(10);
    const plus = evalLens(PLUS4);
    const cp = heatCallouts(plus.L, plus.r.metrics);
    expect(cp.thickest).toEqual({ t: plus.r.metrics.ct, where: 'centre', x: plus.r.surfaces.oc.x, y: plus.r.surfaces.oc.y, merge: 'centre' });
    // MINUS4_RUND: etMax at 180,00° about the OC, the temporal half-chord direction
    const mr = evalLens(MINUS4_RUND);
    const cm = heatCallouts(mr.L, mr.r.metrics);
    expect(cm.thickest.where).toBe('edge');
    expect(cm.thickest.merge).toBe('temporal');
    // example OD: etMax temporal-superior at 151,9° about the OC, 28° from the temporal callout
    const ex = evalLens(EX_OD);
    const ce = heatCallouts(ex.L, ex.r.metrics);
    expect(ce.thickest.where).toBe('edge');
    expect(ce.thickest.merge).toBeNull();
  });

  it('NO_CHORD: OC outside the outline → ok false, centre and thickest only', () => {
    const { r, L } = evalLens(lens({ monoPD: 70 }));
    expect(meridianProfile(L, 0).ok).toBe(false);
    const c = heatCallouts(L, r.metrics);
    expect(c.ok).toBe(false);
    expect(c.code).toBe('NO_CHORD');
    expect(c.centre.t).toBe(r.metrics.ct);
    expect(c.thickest.t).toBe(thickest(r.metrics).value);
    for (const k of ['nasal', 'temporal', 'superior', 'inferior']) expect(c).not.toHaveProperty(k);
    expect(isoLabelPoints(L, r.metrics, [2, 3], c)).toEqual([null, null]);
  });

  for (const [name, spec] of [
    ['example OD', EX_OD],
    ['example OS', EX_OS],
    ['−10 CR-39 62×55/14', MINUS10],
    ['+4 sph', PLUS4],
  ]) {
    it(`isoLabelPoints ${name}: points on the iso value, temporal half-chord first`, () => {
      const { r, L } = evalLens(spec);
      const m = r.metrics;
      const c = heatCallouts(L, m);
      const sc = heatScale([m]);
      const iso = isoLevels(sc.min, sc.max);
      const values = [sc.min - 1, ...iso.values, sc.max + 1];
      const pts = isoLabelPoints(L, m, values, c);
      expect(pts).toHaveLength(values.length);
      expect(pts[0]).toBeNull();
      expect(pts.at(-1)).toBeNull();
      let found = 0;
      pts.forEach((p, k) => {
        if (p === null) return;
        found++;
        expect(Math.abs(thicknessAt(r.surfaces, p.x, p.y) - values[k])).toBeLessThan(1e-6);
        // on one of the four half-chords; the temporal one whenever it reaches the value
        const tEnd = c.temporal.t;
        const inTemporal = (values[k] - m.ct) * (values[k] - tEnd) <= 0;
        const ox = c.centre.x;
        const oy = c.centre.y;
        const cross = (q) => (q.x - ox) * (p.y - oy) - (q.y - oy) * (p.x - ox);
        if (inTemporal) expect(Math.abs(cross(c.temporal))).toBeLessThan(1e-6);
        else expect(['superior', 'nasal', 'inferior'].some((key) => Math.abs(cross(c[key])) < 1e-6)).toBe(true);
      });
      console.info('[03-03] iso labels', name, 'values', iso.values.length, 'placed', found);
    });
  }

  it('isoLabelPoints: a value no half-chord reaches → null', () => {
    const { r, L } = evalLens(EX_OD);
    const m = r.metrics;
    const c = heatCallouts(L, m);
    // etMax sits in a corner; the half-chord ends stay below it
    const top = Math.max(...['temporal', 'superior', 'nasal', 'inferior'].map((k) => c[k].t));
    expect(top).toBeLessThan(m.etMax.value);
    const v = (top + m.etMax.value) / 2;
    expect(isoLabelPoints(L, m, [v], c)).toEqual([null]);
    // a value equal to the centre thickness is found at the OC itself
    const [p] = isoLabelPoints(L, m, [m.ct], c);
    expect(p).toEqual({ x: c.centre.x, y: c.centre.y });
  });

  // A3: the mesh never shows a thickness outside the shared scale by more than 0,01 mm.
  const fuzz = fc.sample(
    fc
      .record({
        eye: fc.constantFrom('OD', 'OS'),
        sph: fc.integer({ min: -48, max: 48 }).map((k) => k / 4),
        cyl: fc.integer({ min: -24, max: 0 }).map((k) => k / 4 + 0),
        axisDeg: fc.integer({ min: 0, max: 179 }),
        materialId: fc.constantFrom(...Object.keys(MATERIALS)),
        shape: fc.constantFrom(...SHAPES4),
        A: fc.integer({ min: 40, max: 62 }),
        B: fc.integer({ min: 28, max: 55 }),
        DBL: fc.integer({ min: 14, max: 24 }),
        monoPD: fc.integer({ min: 25, max: 40 }),
      })
      .map(({ shape, A, B, DBL, ...rx }) => lens({ ...rx, frame: { shape, A, B, DBL } })),
    { numRuns: 30, seed: 30304 },
  );
  const a3 = { checked: 0, worst: 0 };
  const a3Check = (spec) => {
    const r = evaluateLens(spec);
    if (!r.ok) return false;
    const out = allocLensBuffers();
    const outline = frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye);
    expect(buildLensMesh(r.surfaces, outline, out).finite).toBe(true);
    const sc = heatScale([r.metrics]);
    for (const t of out.thick) {
      const over = Math.max(sc.min - t, t - sc.max);
      a3.worst = Math.max(a3.worst, over);
      if (over > 0.01) expect({ t, min: sc.min, max: sc.max }).toBe('within scale');
    }
    a3.checked++;
    return true;
  };
  it('A3: named lenses, every mesh thickness within the scale ± 0,01 mm', () => {
    for (const spec of [EX_OD, EX_OS, GRENZFALL, MINUS10]) expect(a3Check(spec)).toBe(true);
  });
  for (let c = 0; c < 3; c++) {
    it(`A3: fuzz lenses ${10 * c + 1}–${10 * c + 10}`, () => {
      for (const spec of fuzz.slice(10 * c, 10 * c + 10)) a3Check(spec);
      if (c === 2) {
        console.info('[03-03] A3 lenses', a3.checked, 'worst excess over the scale mm', a3.worst);
        expect(a3.checked).toBeGreaterThanOrEqual(4 + 15);
      }
    });
  }
});
