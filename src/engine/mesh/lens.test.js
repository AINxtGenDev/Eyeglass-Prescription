// VIZ-01 (03-02, D-02/D-03/D-04): the lens mesh is built from the engine's own surfaces and
// outline, so the picture shows the numbers. Values are compared within explicit tolerances,
// never by argmax index equality (03-RESEARCH Pitfall 2).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateLens } from '../evaluate.js';
import { thicknessAt } from '../metrics.js';
import { frameOutline } from '../frame/outline.js';
import { SHAPES } from '../frame/shapes.js';
import { MATERIALS } from '../materials.js';
import {
  RINGS,
  SPOKES,
  GRADING,
  RING_FRAC,
  VERTS,
  FRONT_INDEX,
  BACK_INDEX,
  BAND_INDEX,
} from './topology.js';
import { LENS_LENGTHS, allocLensBuffers, outlineNormals, buildLensMesh } from './lens.js';

// lens(o), quarter, SHAPES4 copied from profile.test.js
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

// signedArea copied from outline.test.js (shoelace, CCW > 0), here on a flat [x0, y0, …] triangle.
function signedArea(o) {
  const n = o.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += o[2 * i] * o[2 * j + 1] - o[2 * j] * o[2 * i + 1];
  }
  return a / 2;
}

// Fuzz domain copied from diagnostics.test.js (tier 4).
const specArb = fc
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
  .map(({ shape, A, B, DBL, ...rx }) => lens({ ...rx, frame: { shape, A, B, DBL } }));

const outlineOf = (spec) => frameOutline(spec.frame.shape, spec.frame.A, spec.frame.B, spec.eye);
const rimVertex = (i) => 1 + (RINGS - 1) * SPOKES + i;

function build(spec) {
  const r = evaluateLens(spec);
  if (!r.ok) return null;
  const outline = outlineOf(spec);
  const out = allocLensBuffers();
  const res = buildLensMesh(r.surfaces, outline, out);
  return { r, outline, out, res };
}

const EXAMPLE = lens({ axisDeg: 180 });
const GRENZFALL = lens({
  sph: 10.75,
  cyl: -1,
  axisDeg: 89,
  materialId: 'idx167',
  frame: { shape: 'rechteckig', A: 43, B: 43, DBL: 21 },
  monoPD: 36,
});
// DBL 14: at DBL 18 and 24 this lens is BACK_SAG_UNDEFINED (lens-critic MINOR 3).
const MINUS10 = lens({
  sph: -10,
  cyl: 0,
  axisDeg: 0,
  frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 14 },
  monoPD: 25,
});

/** Mesh thickness at (px, py), barycentric in the containing FRONT_INDEX triangle. */
function interpolateThickness(out, px, py) {
  const P = out.front;
  for (let t = 0; t < FRONT_INDEX.length; t += 3) {
    const [a, b, c] = [FRONT_INDEX[t], FRONT_INDEX[t + 1], FRONT_INDEX[t + 2]];
    const ax = P[3 * a];
    const ay = P[3 * a + 1];
    const bx = P[3 * b];
    const by = P[3 * b + 1];
    const cx = P[3 * c];
    const cy = P[3 * c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
    const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
    const l3 = 1 - l1 - l2;
    if (l1 >= -1e-12 && l2 >= -1e-12 && l3 >= -1e-12) {
      return l1 * out.thick[a] + l2 * out.thick[b] + l3 * out.thick[c];
    }
  }
  return NaN;
}

describe('VIZ-01 lens mesh (D-04)', () => {
  describe('topology', () => {
    it('fixed counts: VERTS 46 081, 91 440 triangles per surface, 1440 band triangles, Uint16', () => {
      expect(RINGS).toBe(64);
      expect(SPOKES).toBe(720);
      expect(GRADING).toBe(2.5);
      expect(VERTS).toBe(46081);
      expect(FRONT_INDEX).toBeInstanceOf(Uint16Array);
      expect(BACK_INDEX).toBeInstanceOf(Uint16Array);
      expect(BAND_INDEX).toBeInstanceOf(Uint16Array);
      expect(FRONT_INDEX.length).toBe(3 * 91440);
      expect(BACK_INDEX.length).toBe(3 * 91440);
      expect(BAND_INDEX.length).toBe(3 * 1440);
      expect(Math.max(...FRONT_INDEX)).toBe(VERTS - 1);
      expect(Math.max(...BACK_INDEX)).toBe(VERTS - 1);
      expect(Math.max(...BAND_INDEX)).toBe(2 * SPOKES - 1);
    });

    it('RING_FRAC: 0 … 1, strictly increasing, 1 − (1 − k/64)^2.5', () => {
      expect(RING_FRAC).toBeInstanceOf(Float64Array);
      expect(RING_FRAC.length).toBe(RINGS + 1);
      expect(RING_FRAC[0]).toBe(0);
      expect(RING_FRAC[RINGS]).toBe(1);
      for (let k = 1; k <= RINGS; k++) {
        expect(RING_FRAC[k]).toBeGreaterThan(RING_FRAC[k - 1]);
        expect(Math.abs(RING_FRAC[k] - (1 - (1 - k / 64) ** 2.5))).toBeLessThan(1e-15);
      }
    });

    it('front triangles are CCW from +z, back is the same set reversed, band faces outward', () => {
      const { out } = build(lens({ frame: { shape: 'panto', A: 50, B: 40, DBL: 18 } }));
      const P = out.front;
      const tri = (idx, t) => {
        const v = [idx[t], idx[t + 1], idx[t + 2]];
        return Float64Array.from(v.flatMap((p) => [P[3 * p], P[3 * p + 1]]));
      };
      for (let t = 0; t < FRONT_INDEX.length; t += 3) {
        const a = signedArea(tri(FRONT_INDEX, t));
        if (!(a > 0)) expect({ t, a }).toEqual({ t, a: 'positive' });
        const b = signedArea(tri(BACK_INDEX, t));
        if (!(b < 0)) expect({ t, b }).toEqual({ t, b: 'negative' });
        expect(BACK_INDEX[t]).toBe(FRONT_INDEX[t]);
        expect(BACK_INDEX[t + 1]).toBe(FRONT_INDEX[t + 2]);
        expect(BACK_INDEX[t + 2]).toBe(FRONT_INDEX[t + 1]);
      }
      const B = out.band;
      for (let t = 0; t < BAND_INDEX.length; t += 3) {
        const [a, b, c] = [BAND_INDEX[t], BAND_INDEX[t + 1], BAND_INDEX[t + 2]];
        const e1 = [0, 1, 2].map((d) => B[3 * b + d] - B[3 * a + d]);
        const e2 = [0, 1, 2].map((d) => B[3 * c + d] - B[3 * a + d]);
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const i = a % SPOKES;
        const dot = nx * out.bandN[3 * i] + ny * out.bandN[3 * i + 1];
        if (!(dot > 0)) expect({ t, dot }).toEqual({ t, dot: 'positive' });
      }
    });
  });

  it('allocLensBuffers returns Float32Arrays with the LENS_LENGTHS lengths', () => {
    expect(Object.isFrozen(LENS_LENGTHS)).toBe(true);
    expect(LENS_LENGTHS).toEqual({
      front: VERTS * 3,
      frontN: VERTS * 3,
      back: VERTS * 3,
      backN: VERTS * 3,
      thick: VERTS,
      band: 2 * 720 * 3,
      bandN: 2 * 720 * 3,
    });
    const out = allocLensBuffers();
    for (const [k, len] of Object.entries(LENS_LENGTHS)) {
      expect(out[k]).toBeInstanceOf(Float32Array);
      expect(out[k].length).toBe(len);
    }
  });

  it('D-04(a) outline vertex front z − back z = thicknessAt (≥ 100 lenses, both eyes, all shapes)', () => {
    let checked = 0;
    let worst = 0;
    const out = allocLensBuffers();
    fc.assert(
      fc.property(
        fc.record({
          sph: quarter(-8, 8),
          cyl: quarter(-4, 0),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          shape: fc.constantFrom(...SHAPES4),
          monoPD: fc.integer({ min: 26, max: 38 }),
          eye: fc.constantFrom('OD', 'OS'),
        }),
        ({ sph, cyl, axisDeg, shape, monoPD, eye }) => {
          const { A, B, DBL } = SHAPES[shape].defaults;
          const spec = lens({ eye, sph, cyl, axisDeg, monoPD, frame: { shape, A, B, DBL } });
          const r = evaluateLens(spec);
          if (!r.ok) return;
          checked++;
          const s = r.surfaces;
          const outline = outlineOf(spec);
          expect(buildLensMesh(s, outline, out).finite).toBe(true);
          for (let i = 0; i < SPOKES; i++) {
            const p = rimVertex(i);
            const x = outline[2 * i];
            const y = outline[2 * i + 1];
            const t = thicknessAt(s, x, y);
            const d = Math.abs(out.front[3 * p + 2] - out.back[3 * p + 2] - t);
            if (d > worst) worst = d;
            if (!(d < 1e-3)) expect({ i, d }).toEqual({ i, d: '< 1e-3' });
            if (!(Math.abs(out.thick[p] - t) < 1e-4)) expect({ i, thick: out.thick[p], t }).toBe(null);
            // spoke i of the outer ring IS outline point i (D-03)
            expect(out.front[3 * p]).toBe(Math.fround(x));
            expect(out.front[3 * p + 1]).toBe(Math.fround(y));
          }
        },
      ),
      { numRuns: 160, seed: 30302 },
    );
    console.info('[03-02] D-04(a) lenses', checked, 'worst |zF − zB − thicknessAt| mm', worst);
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  describe('D-04(b) edge extremes and centre', () => {
    it.each([
      ['example −2,75 −0,50 × 180 CR-39 rechteckig 52×38/18 PD 32', EXAMPLE],
      ['Grenzfall +10,75 −1,00 × 89 idx167 rechteckig 43×43/21 PD 36', GRENZFALL],
      ['−10 CR-39 rechteckig 62×55/14 PD 25', MINUS10],
    ])('%s', (_name, spec) => {
      const b = build(spec);
      expect(b).not.toBeNull();
      const { r, out, res } = b;
      const m = r.metrics;
      const s = r.surfaces;
      expect(res.finite).toBe(true);
      const bandT = (i) => out.band[3 * i + 2] - out.band[3 * (SPOKES + i) + 2];
      expect(Math.abs(bandT(m.etMax.index) - m.etMax.value)).toBeLessThan(1e-3);
      expect(Math.abs(bandT(m.etMin.index) - m.etMin.value)).toBeLessThan(1e-3);
      let hi = -Infinity;
      let lo = Infinity;
      for (let i = 0; i < SPOKES; i++) {
        hi = Math.max(hi, bandT(i));
        lo = Math.min(lo, bandT(i));
      }
      expect(hi).toBeLessThanOrEqual(m.etMax.value + 1e-3);
      expect(lo).toBeGreaterThanOrEqual(m.etMin.value - 1e-3);
      expect(thicknessAt(s, s.oc.x, s.oc.y)).toBe(s.ct);
      const tOC = interpolateThickness(out, s.oc.x, s.oc.y);
      expect(Math.abs(tOC - s.ct)).toBeLessThan(0.02);
    });
  });

  it('D-04(d) the OS lens is built from its own surfaces and outline, not mirrored from OD', () => {
    const base = { sph: -4, cyl: -2, axisDeg: 30, monoPD: 32 };
    const od = build(lens({ ...base, eye: 'OD' }));
    const osSpec = lens({ ...base, eye: 'OS' });
    const os = build(osSpec);
    const again = allocLensBuffers();
    buildLensMesh(evaluateLens(osSpec).surfaces, frameOutline('rechteckig', 52, 38, 'OS'), again);
    for (const k of Object.keys(LENS_LENGTHS)) expect(again[k]).toEqual(os.out[k]);
    // OS outline point i = mirror of OD point (720 − i) mod 720, so vertex (k, i) of OS sits at
    // (−x, y) of OD vertex (k, j). Mirroring the OD mesh would give the same z there.
    let maxDz = 0;
    for (let k = 1; k <= RINGS; k++) {
      for (let j = 0; j < SPOKES; j++) {
        const pOD = 1 + (k - 1) * SPOKES + j;
        const pOS = 1 + (k - 1) * SPOKES + ((SPOKES - j) % SPOKES);
        expect(os.out.front[3 * pOS]).toBe(-od.out.front[3 * pOD]);
        expect(os.out.front[3 * pOS + 1]).toBe(od.out.front[3 * pOD + 1]);
        maxDz = Math.max(
          maxDz,
          Math.abs(os.out.front[3 * pOS + 2] - od.out.front[3 * pOD + 2]),
          Math.abs(os.out.back[3 * pOS + 2] - od.out.back[3 * pOD + 2]),
        );
      }
    }
    expect(maxDz).toBeGreaterThan(0.01);
  });

  it('normals: unit length, front z > 0, back z < 0, band in-plane and outward', () => {
    for (const spec of [EXAMPLE, GRENZFALL, MINUS10, lens({ eye: 'OS', frame: { shape: 'pilot', A: 56, B: 48, DBL: 16 } })]) {
      const { out } = build(spec);
      for (let p = 0; p < VERTS; p++) {
        const f = [out.frontN[3 * p], out.frontN[3 * p + 1], out.frontN[3 * p + 2]];
        const b = [out.backN[3 * p], out.backN[3 * p + 1], out.backN[3 * p + 2]];
        if (!(Math.abs(Math.hypot(...f) - 1) < 1e-5 && f[2] > 0)) expect({ p, f }).toBe(null);
        if (!(Math.abs(Math.hypot(...b) - 1) < 1e-5 && b[2] < 0)) expect({ p, b }).toBe(null);
      }
      for (let v = 0; v < 2 * SPOKES; v++) {
        const n = [out.bandN[3 * v], out.bandN[3 * v + 1], out.bandN[3 * v + 2]];
        expect(n[2]).toBe(0);
        expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(1e-5);
        expect(n[0] * out.band[3 * v] + n[1] * out.band[3 * v + 1]).toBeGreaterThan(0);
      }
    }
  });

  it('outlineNormals: outward unit normals for a CCW circle', () => {
    const o = frameOutline('rund', 50, 50, 'OD');
    const n = outlineNormals(o, new Float64Array(2 * SPOKES));
    for (let i = 0; i < SPOKES; i++) {
      const r = Math.hypot(o[2 * i], o[2 * i + 1]);
      expect(Math.abs(Math.hypot(n[2 * i], n[2 * i + 1]) - 1)).toBeLessThan(1e-12);
      expect((n[2 * i] * o[2 * i] + n[2 * i + 1] * o[2 * i + 1]) / r).toBeGreaterThan(0.999);
    }
  });

  it('boundingSphere contains every front, back and band vertex', () => {
    for (const spec of [EXAMPLE, GRENZFALL, MINUS10]) {
      const { out, res } = build(spec);
      const { x, y, z, r } = res.boundingSphere;
      for (const buf of [out.front, out.back, out.band]) {
        for (let q = 0; q < buf.length; q += 3) {
          const d = Math.hypot(buf[q] - x, buf[q + 1] - y, buf[q + 2] - z);
          if (!(d <= r + 1e-6)) expect({ q, d, r }).toBe(null);
        }
      }
    }
  });

  it('finiteness over the fuzz domain (≥ 100 computable lenses); NaN ct gives finite false', () => {
    let checked = 0;
    const out = allocLensBuffers();
    fc.assert(
      fc.property(specArb, (spec) => {
        const r = evaluateLens(spec);
        if (!r.ok) return;
        checked++;
        const res = buildLensMesh(r.surfaces, outlineOf(spec), out);
        expect(res.finite).toBe(true);
        for (const k of Object.keys(LENS_LENGTHS)) {
          if (!out[k].every(Number.isFinite)) expect({ spec, k }).toBe('finite');
        }
      }),
      { numRuns: 200, seed: 30303 },
    );
    expect(checked).toBeGreaterThanOrEqual(100);
    const { surfaces } = evaluateLens(EXAMPLE);
    const res = buildLensMesh({ ...surfaces, ct: NaN }, frameOutline('rechteckig', 52, 38, 'OD'), out);
    expect(res.finite).toBe(false);
  });

  it('guards: 720-point outline and exact buffer lengths', () => {
    const { surfaces } = evaluateLens(EXAMPLE);
    const o = frameOutline('rechteckig', 52, 38, 'OD');
    expect(() => buildLensMesh(surfaces, o.subarray(0, 1438), allocLensBuffers())).toThrow(
      'buildLensMesh: outline must have 720 points',
    );
    for (const k of Object.keys(LENS_LENGTHS)) {
      const out = allocLensBuffers();
      out[k] = new Float32Array(out[k].length - 3);
      expect(() => buildLensMesh(surfaces, o, out)).toThrow(/buildLensMesh/);
    }
    const out = allocLensBuffers();
    delete out.thick;
    expect(() => buildLensMesh(surfaces, o, out)).toThrow(/buildLensMesh/);
  });
});
