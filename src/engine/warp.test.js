import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  REF_CLASS,
  OBJ_TAN_MAX,
  FIELD_HALF_ANGLE_DEG,
  REF_GRID_TIERS,
  effectiveLeafPx,
  CELL_DIAGONAL,
  prepareWarp,
  classifyDirection,
} from './warp.js';
import { evaluateLens } from './evaluate.js';

const DEFAULT_FRAME = Object.freeze({ shape: 'rechteckig', A: 52, B: 38, DBL: 18 });
// Item 12 / E9 (UI-SPEC "Correctness"): the rim enters the field for this accepted frame.
const ITEM12_FRAME = Object.freeze({ shape: 'rechteckig', A: 40, B: 28, DBL: 14 });
const MATERIAL_IDS = ['cr39', 'trivex', 'pc', 'idx160', 'idx167', 'idx174'];
const SHAPE_IDS = ['rund', 'rechteckig', 'panto', 'pilot'];

const spec = (o = {}) => ({
  eye: 'OD',
  sph: 0,
  cyl: 0,
  axisDeg: 0,
  materialId: 'cr39',
  frame: DEFAULT_FRAME,
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});

/** Evaluated lens and its warp context (frame and eye taken from the spec). */
function lensCtx(o = {}) {
  const s = spec(o);
  const lens = evaluateLens(s);
  expect(lens.ok).toBe(true);
  const ctx = prepareWarp({ surfaces: lens.surfaces, frame: s.frame, eye: s.eye });
  expect(ctx.ok).toBe(true);
  return { lens, ctx };
}

const item12 = (sph, eye = 'OD') => lensCtx({ sph, eye, frame: ITEM12_FRAME, monoPD: 40 });

// Plane-parallel plate (c1 = ca = cb = 0) in a big round outline.
const PLATE = Object.freeze({ n: 1.5, ct: 2, c1: 0, k1: 0, ca: 0, cb: 0, axisRad: 0, oc: { x: 0, y: 0 } });

/**
 * Paraxial M = J⁻¹ of classifyDirection at wearer tan (0, 0), J = ∂objTan/∂eyeTan (central
 * differences): eigenvalues ascending and the screen angle φ (deg, [0, 180)) of each eigenvector.
 */
function wearerMagnification(ctx, e = 1e-4) {
  const obj = (x, y) => {
    const r = classifyDirection(ctx, x, y);
    expect(r.cls).toBe(REF_CLASS.LENS);
    return r.objTan;
  };
  const px = obj(e, 0);
  const mx = obj(-e, 0);
  const py = obj(0, e);
  const my = obj(0, -e);
  const j11 = (px[0] - mx[0]) / (2 * e);
  const j21 = (px[1] - mx[1]) / (2 * e);
  const j12 = (py[0] - my[0]) / (2 * e);
  const j22 = (py[1] - my[1]) / (2 * e);
  const det = j11 * j22 - j12 * j21;
  const a = j22 / det;
  const b = -j12 / det;
  const c = -j21 / det;
  const d = j11 / det;
  const half = (a + d) / 2;
  const disc = Math.sqrt(Math.max(0, half * half - (a * d - b * c)));
  const eig = [half - disc, half + disc];
  const angleOf = (l) => {
    const v1 = [b, l - a];
    const v2 = [l - d, c];
    const v = Math.hypot(...v1) >= Math.hypot(...v2) ? v1 : v2;
    const deg = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    return ((deg % 180) + 180) % 180;
  };
  return { eig, phi: eig.map(angleOf) };
}

/** Smallest difference of two axis angles mod 180. */
const axisDiff = (a, b) => {
  const d = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
};

describe('REF-01 warp constants', () => {
  it('classes, limits and the drawn cell diagonal', () => {
    expect(REF_CLASS).toEqual({ LENS: 1, EDGE_BAND: 2, NO_VIEW: 3, RIM_FACE: 4, PAST_RIM: 5 });
    expect(Object.isFrozen(REF_CLASS)).toBe(true);
    expect(OBJ_TAN_MAX).toBe(3);
    expect(FIELD_HALF_ANGLE_DEG).toBe(30);
    expect(CELL_DIAGONAL).toBe('sw-ne');
  });

  it('M2 / NEW-2: the real quadtree leaf never gets finer on a step down and stays ≤ 2·√2 px', () => {
    const f = effectiveLeafPx('fein');
    const m = effectiveLeafPx('mittel');
    const g = effectiveLeafPx('grob');
    expect(f).toBeLessThanOrEqual(m);
    expect(m).toBeLessThanOrEqual(g);
    expect(g).toBeLessThanOrEqual(2 * Math.SQRT2);
    for (const tier of Object.keys(REF_GRID_TIERS)) {
      const { cellPx, leafPx } = REF_GRID_TIERS[tier];
      expect(effectiveLeafPx(tier)).toBe(cellPx / 2 ** Math.ceil(Math.log2(cellPx / leafPx)));
      expect(effectiveLeafPx(tier)).toBeLessThanOrEqual(leafPx);
    }
  });
});

describe('REF-01 aperture classes (D-12 f, E9)', () => {
  it('invalid input gives a frozen failure object, never an exception', () => {
    for (const bad of [
      undefined,
      {},
      { surfaces: null, frame: ITEM12_FRAME, eye: 'OD' },
      { surfaces: PLATE, frame: { shape: 'nope', A: 40, B: 28 }, eye: 'OD' },
      { surfaces: PLATE, frame: ITEM12_FRAME, eye: 'XX' },
      { surfaces: PLATE, frame: { shape: 'rund', A: -1, B: 28 }, eye: 'OD' },
      { surfaces: { ...PLATE, n: NaN }, frame: ITEM12_FRAME, eye: 'OD' },
      { surfaces: PLATE, frame: ITEM12_FRAME, eye: 'OD', hMm: 0 },
    ]) {
      const r = prepareWarp(bad);
      expect(r.ok).toBe(false);
      expect(typeof r.code).toBe('string');
      expect(Object.isFrozen(r)).toBe(true);
    }
  });

  it('D-12 (a): a plane-parallel plate is the identity within 1e-12 (9 × 9 directions, tan ≤ 0,816)', () => {
    const ctx = prepareWarp({ surfaces: PLATE, frame: { shape: 'rund', A: 200, B: 200 }, eye: 'OD' });
    expect(ctx.ok).toBe(true);
    const t = 0.816 / Math.SQRT2;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const x = -t + (2 * t * i) / 8;
        const y = -t + (2 * t * j) / 8;
        const r = classifyDirection(ctx, x, y);
        expect(r.cls).toBe(REF_CLASS.LENS);
        expect(Math.abs(r.objTan[0] - x)).toBeLessThan(1e-12);
        expect(Math.abs(r.objTan[1] - y)).toBeLessThan(1e-12);
      }
    }
  });

  // N9: sample points in tan units (UI-SPEC "Aperture, rim and edge band"); OD temporal = +wTanX.
  const E9 = [
    { sph: -4, points: [[0.401, 1], [0.453, 2], [0.521, 4], [0.802, 5]] },
    { sph: 4, points: [[0.361, 1], [0.421, 2], [0.521, 4]] },
  ];
  for (const { sph, points } of E9) {
    for (const eye of ['OD', 'OS']) {
      it(`E9 item-12 frame ${sph > 0 ? '+' : ''}${sph},00 ${eye}: classes along the temporal centre line`, () => {
        const { ctx } = item12(sph, eye);
        const sign = eye === 'OD' ? 1 : -1; // OS temporal = screen left
        for (const [tan, cls] of points) {
          const r = classifyDirection(ctx, sign * tan, 0);
          expect(r.cls, `tan ${tan}`).toBe(cls);
          if (cls === 1 || cls === 5) {
            expect(r.objTan.every(Number.isFinite)).toBe(true);
          } else {
            expect(r.objTan).toBeNull();
          }
          if (cls === 5) expect(r.objTan).toEqual([sign * tan, 0]);
        }
      });
    }
  }

  it('back hit inside, front exit outside (thick plate in a small outline): class 2, never a chart sample', () => {
    const thick = { ...PLATE, ct: 10 };
    const ctx = prepareWarp({ surfaces: thick, frame: { shape: 'rund', A: 18, B: 18 }, eye: 'OD' });
    // eye ray tan 0,5: back hit at 7,5 mm (inside r = 9), front exit at 10,6 mm (outside)
    const r = classifyDirection(ctx, 0.5, 0);
    expect(r.cls).toBe(REF_CLASS.EDGE_BAND);
    expect(r.objTan).toBeNull();
    // OS and the vertical direction behave the same (round outline about the OC)
    expect(classifyDirection(prepareWarp({ surfaces: thick, frame: { shape: 'rund', A: 18, B: 18 }, eye: 'OS' }), -0.5, 0).cls).toBe(2);
    expect(classifyDirection(ctx, 0, 0.5).cls).toBe(2);
    expect(classifyDirection(ctx, 0.2, 0).cls).toBe(1);
  });

  it('missed extended back surface: back hit falls back to the plane z = −CT, class from the 4 mm band', () => {
    // hemispherical back of radius 5 mm: rays beyond tan ≈ 0,51 miss it entirely
    const steep = { ...PLATE, ca: 0.2, cb: 0.2 };
    const ctx = prepareWarp({ surfaces: steep, frame: { shape: 'rund', A: 14, B: 14 }, eye: 'OD' });
    // plane hit at 15·tan: tan 0,6 → 9 mm (2 mm outside r = 7) → rim face; tan 1,0 → 15 mm (8 mm) → past the rim
    const a = classifyDirection(ctx, 0.6, 0);
    expect(a.cls).toBe(REF_CLASS.RIM_FACE);
    expect(a.objTan).toBeNull();
    const b = classifyDirection(ctx, 1.0, 0);
    expect(b.cls).toBe(REF_CLASS.PAST_RIM);
    expect(b.objTan).toEqual([1.0, 0]);
    // 15·0,7 = 10,5 mm: 3,5 mm outside → still rim face; 15·0,75 = 11,25 mm: 4,25 mm → past the rim
    expect(classifyDirection(ctx, 0.7, 0).cls).toBe(REF_CLASS.RIM_FACE);
    expect(classifyDirection(ctx, 0.75, 0).cls).toBe(REF_CLASS.PAST_RIM);
  });

  it('missed back surface with the fallback hit inside the outline: class 3', () => {
    const steep = { ...PLATE, ca: 0.2, cb: 0.2 };
    const ctx = prepareWarp({ surfaces: steep, frame: { shape: 'rund', A: 40, B: 40 }, eye: 'OD' });
    // tan 0,6 misses the hemisphere, plane hit at 9 mm lies inside r = 20 → no defined picture
    const r = classifyDirection(ctx, 0.6, 0);
    expect(r.cls).toBe(REF_CLASS.NO_VIEW);
    expect(r.objTan).toBeNull();
  });

  it('lens-critic MINOR 3 (04-01 tirFront case): −4,00 CR-39, default frame, OD, temporal tan 1,97 → class 3', () => {
    const { ctx } = lensCtx({ sph: -4 });
    const r = classifyDirection(ctx, 1.97, 0);
    expect(r.cls).toBe(REF_CLASS.NO_VIEW);
    expect(r.objTan).toBeNull();
  });

  it('an object direction with |tan| > OBJ_TAN_MAX is class 3 (−4,00 CR-39 just before TIR)', () => {
    const { ctx } = lensCtx({ sph: -4 });
    const r = classifyDirection(ctx, 1.9, 0);
    expect(r.cls).toBe(REF_CLASS.NO_VIEW);
    // well inside: class 1 with |tan| ≤ 3
    const ok = classifyDirection(ctx, 0.8, 0);
    expect(ok.cls).toBe(REF_CLASS.LENS);
    expect(Math.hypot(...ok.objTan)).toBeLessThanOrEqual(OBJ_TAN_MAX);
  });

  it('property: random accepted lenses and directions within tan 0,816 → one class 1…5, never NaN, never an exception', () => {
    let checked = 0;
    fc.assert(
      fc.property(
        fc.record({
          sph: fc.integer({ min: -48, max: 48 }).map((k) => k / 4),
          cyl: fc.integer({ min: -24, max: 0 }).map((k) => k / 4),
          axisDeg: fc.integer({ min: 0, max: 179 }),
          materialId: fc.constantFrom(...MATERIAL_IDS),
          shape: fc.constantFrom(...SHAPE_IDS),
          A: fc.integer({ min: 40, max: 62 }),
          B: fc.integer({ min: 28, max: 55 }),
          DBL: fc.integer({ min: 14, max: 24 }),
          monoPD: fc.integer({ min: 25, max: 40 }),
          eye: fc.constantFrom('OD', 'OS'),
          r: fc.double({ min: 0, max: 0.816, noNaN: true }),
          a: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        }),
        (p) => {
          const frame = { shape: p.shape, A: p.A, B: p.B, DBL: p.DBL };
          const lens = evaluateLens(spec({ ...p, frame }));
          if (!lens.ok) return;
          checked++;
          const ctx = prepareWarp({ surfaces: lens.surfaces, frame, eye: p.eye });
          const res = classifyDirection(ctx, p.r * Math.cos(p.a), p.r * Math.sin(p.a));
          expect(res.cls).toBeGreaterThanOrEqual(1);
          expect(res.cls).toBeLessThanOrEqual(5);
          if (res.cls === 1 || res.cls === 5) expect(res.objTan.every(Number.isFinite)).toBe(true);
          else expect(res.objTan).toBeNull();
        },
      ),
      { numRuns: 300, seed: 4031 },
    );
    expect(checked).toBeGreaterThanOrEqual(200);
  });
});

describe('REF-01 wearer-view axis golden (D-07)', () => {
  it('−2,00 / −2,00 × 30: the less-minified direction lies at screen φ = 150° for OD and OS', () => {
    for (const eye of ['OD', 'OS']) {
      const { ctx } = lensCtx({ sph: -2, cyl: -2, axisDeg: 30, eye });
      const { eig, phi } = wearerMagnification(ctx);
      expect(axisDiff(phi[1], 150), eye).toBeLessThan(0.05);
      expect(eig[1]).toBeGreaterThan(eig[0]);
    }
  });

  for (const theta of [30, 120, 5, 85, 175]) {
    it(`−2,00 / −2,00 × ${theta}: axis meridian at φ = 180° − θ, eigenvalues = LensResult.magnification`, () => {
      for (const eye of ['OD', 'OS']) {
        const { lens, ctx } = lensCtx({ sph: -2, cyl: -2, axisDeg: theta, eye });
        const { eig, phi } = wearerMagnification(ctx);
        // the axis meridian carries F = Sph = −2 (less minified, larger eigenvalue)
        expect(axisDiff(phi[1], 180 - theta), `${eye} φ`).toBeLessThan(0.05);
        const sm = lens.magnification.meridians.map((m) => m.sm).sort((x, y) => x - y);
        expect(Math.abs(eig[0] - sm[0])).toBeLessThan(0.0005);
        expect(Math.abs(eig[1] - sm[1])).toBeLessThan(0.0005);
      }
    });
  }
});
