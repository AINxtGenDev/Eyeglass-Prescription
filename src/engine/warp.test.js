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
  warpGrid,
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

// ---------------------------------------------------------------------------------------------
// Task 2: warp grid, N10 error bounds, E10 visibility
// ---------------------------------------------------------------------------------------------

const TAN_FIELD = Math.tan((FIELD_HALF_ANGLE_DEG * Math.PI) / 180);
/** UI-SPEC field rule: pxPerTan = longSidePx / (2 · tan(half-angle)). */
const panelOf = (wPx, hPx) => ({ wPx, hPx, pxPerTan: Math.max(wPx, hPx) / (2 * TAN_FIELD) });
// Measured panels (scripts/measure-stages.mjs, 04-P0-RESULTS.md section 0): #view-stage content
// box on the production preview, two panels with a 2 px divider from 360 px, one panel below.
const PANEL_412 = panelOf(189, 285); // 412 × 915 phone, 246,82 px/tan (= UI-SPEC)
const PANEL_320 = panelOf(288, 216); // 320 × 640 phone, one panel, 249,42 px/tan (= UI-SPEC)
const PANEL_400 = panelOf(198, 248.75); // 400 px desktop column, 215,42 px/tan: the smallest scale
const PANEL_LARGEST = panelOf(639, 800); // largest measured panel (1280 × 800 fullscreen)
const CHART_SQUARE_TAN = Math.tan((6 * Math.PI) / 180);

const tierGrid = (ctx, panel, tier) =>
  warpGrid(ctx, panel, REF_GRID_TIERS[tier].cellPx, { leafPx: REF_GRID_TIERS[tier].leafPx });

/** Wearer eye tan of panel px (x right, y up from the bottom edge). */
const tanAt = (panel, x, y) => [(x - panel.wPx / 2) / panel.pxPerTan, (y - panel.hPx / 2) / panel.pxPerTan];

/**
 * The DRAWN interpolant (lens-critic MINOR 1): two triangles per cell split along CELL_DIAGONAL
 * 'sw-ne' (lower-left → upper-right), barycentric on the triangle that contains the point.
 * @returns {[number, number]} object tan at panel px (x, y)
 */
function drawnInterp(g, x, y) {
  const i = Math.min(Math.floor(x / g.cellX), g.nx - 1);
  const j = Math.min(Math.floor(y / g.cellY), g.ny - 1);
  const fx = x / g.cellX - i;
  const fy = y / g.cellY - j;
  const at = (a, b, c) => g.uv[2 * ((j + b) * (g.nx + 1) + i + a) + c];
  const out = [0, 0];
  for (let c = 0; c < 2; c++) {
    const sw = at(0, 0, c);
    const se = at(1, 0, c);
    const ne = at(1, 1, c);
    const nw = at(0, 1, c);
    out[c] = fx >= fy ? sw + fx * (se - sw) + fy * (ne - se) : sw + fy * (nw - sw) + fx * (ne - nw);
  }
  return out;
}

/** Max drawn-interpolant error (px) over the outermost all-class-1 cells along every panel edge. */
function edgeInterpErrorPx(ctx, panel, g) {
  let worst = 0;
  const cells = new Set();
  for (let i = 0; i < g.nx; i++) cells.add(`${i},0`).add(`${i},${g.ny - 1}`);
  for (let j = 0; j < g.ny; j++) cells.add(`0,${j}`).add(`${g.nx - 1},${j}`);
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    const corners = [0, 1, g.nx + 1, g.nx + 2].map((d) => g.cls[j * (g.nx + 1) + i + d]);
    if (!corners.every((c) => c === REF_CLASS.LENS)) continue;
    for (const [fx, fy] of [
      [2 / 3, 1 / 3],
      [1 / 3, 2 / 3],
      [0.5, 0.5],
    ]) {
      const x = (i + fx) * g.cellX;
      const y = (j + fy) * g.cellY;
      const exact = classifyDirection(ctx, ...tanAt(panel, x, y));
      expect(exact.cls).toBe(REF_CLASS.LENS);
      const d = drawnInterp(g, x, y);
      worst = Math.max(worst, Math.hypot(d[0] - exact.objTan[0], d[1] - exact.objTan[1]) * panel.pxPerTan);
    }
  }
  return worst;
}

/** Class on the horizontal centre line as drawn: the leaf there in mixed cells, else the cell's class. */
function drawnClassOnCentreLine(g, panel, x) {
  const y = panel.hPx / 2;
  const i = Math.min(Math.floor(x / g.cellX), g.nx - 1);
  const j = Math.min(Math.floor(y / g.cellY), g.ny - 1);
  const k = j * (g.nx + 1) + i;
  const corners = [g.cls[k], g.cls[k + 1], g.cls[k + g.nx + 1], g.cls[k + g.nx + 2]];
  if (corners.every((c) => c === corners[0])) return corners[0];
  const hRatio = g.cellY / g.cellX;
  for (let l = 0; l < g.leafCount; l++) {
    const x0 = g.leaves[6 * l];
    const y0 = g.leaves[6 * l + 1];
    const s = g.leaves[6 * l + 2];
    if (x >= x0 && x < x0 + s && y >= y0 && y < y0 + s * hRatio) return g.leaves[6 * l + 3];
  }
  throw new Error(`no leaf covers (${x}, ${y})`);
}

/** Class transitions (px) along a scan; classAt(x) gives the class at panel px x. */
function transitions(classAt, wPx, step) {
  const out = [];
  let prev = classAt(step / 2);
  for (let x = step / 2 + step; x < wPx; x += step) {
    const c = classAt(x);
    if (c !== prev) out.push({ x: x - step / 2, from: prev, to: c });
    prev = c;
  }
  return out;
}

/** True class boundaries on the centre line: 0,25 px scan, then bisection to 1e-6 px. */
function trueBoundaries(ctx, panel) {
  const cls = (x) => classifyDirection(ctx, ...tanAt(panel, x, panel.hPx / 2)).cls;
  return transitions(cls, panel.wPx, 0.25).map(({ x, from }) => {
    let a = x - 0.125;
    let b = x + 0.125;
    while (b - a > 1e-6) {
      const m = (a + b) / 2;
      if (cls(m) === from) a = m;
      else b = m;
    }
    return (a + b) / 2;
  });
}

/** Max distance between the drawn and the true class boundaries on the centre line (px). */
function boundaryErrorPx(ctx, panel, g) {
  const truth = trueBoundaries(ctx, panel);
  const drawn = transitions((x) => drawnClassOnCentreLine(g, panel, x), panel.wPx, 0.05).map((t) => t.x);
  expect(truth.length).toBeGreaterThan(0);
  expect(drawn.length).toBe(truth.length);
  return Math.max(...truth.map((t, k) => Math.abs(t - drawn[k])));
}

describe('REF-01 warp grid (D-12)', () => {
  it('layout of the reply: sizes, cell sizes, rays = grid points + leaf centres', () => {
    const { ctx } = item12(-4);
    const g = warpGrid(ctx, PANEL_320, 6, { leafPx: 1 });
    expect(g.ok).toBe(true);
    expect(g.nx).toBe(48);
    expect(g.ny).toBe(36);
    expect(g.cellX).toBe(6);
    expect(g.cellY).toBe(6);
    expect(g.uv).toBeInstanceOf(Float32Array);
    expect(g.uv.length).toBe(2 * 49 * 37);
    expect(g.cls).toBeInstanceOf(Uint8Array);
    expect(g.cls.length).toBe(49 * 37);
    expect(g.leaves).toBeInstanceOf(Float32Array);
    expect(g.leaves.length).toBe(6 * g.leafCount);
    expect(g.leafCount).toBeGreaterThan(0);
    expect(g.rays).toBe(49 * 37 + g.leafCount);
    // a panel that does not divide evenly: cellX = wPx / nx ≤ cellPx
    const h = warpGrid(ctx, PANEL_412, 10, { leafPx: 3 });
    expect(h.nx).toBe(19);
    expect(h.ny).toBe(29);
    expect(h.cellX).toBeCloseTo(189 / 19, 12);
    expect(h.cellY).toBeCloseTo(285 / 29, 12);
    expect(h.cellX).toBeLessThanOrEqual(10);
  });

  it('grid point (i, j) is the direction at panel px (i·cellX, j·cellY): centre = tan (0, 0), +x right, +y up', () => {
    const { ctx } = lensCtx({ sph: -2, cyl: -2, axisDeg: 30 });
    const g = warpGrid(ctx, PANEL_412, 6, { leafPx: 1 });
    for (const [i, j] of [
      [0, 0],
      [g.nx, 0],
      [0, g.ny],
      [g.nx, g.ny],
      [7, 31],
      [g.nx / 2, g.ny / 2],
    ]) {
      const k = j * (g.nx + 1) + i;
      const ref = classifyDirection(ctx, ...tanAt(PANEL_412, i * g.cellX, j * g.cellY));
      expect(g.cls[k]).toBe(ref.cls);
      expect(g.uv[2 * k]).toBeCloseTo(ref.objTan[0], 6);
      expect(g.uv[2 * k + 1]).toBeCloseTo(ref.objTan[1], 6);
    }
    // the centre grid point looks straight ahead
    const c = (g.ny / 2) * (g.nx + 1) + g.nx / 2;
    expect(Math.abs(g.uv[2 * c])).toBeLessThan(1e-7);
    expect(Math.abs(g.uv[2 * c + 1])).toBeLessThan(1e-7);
    // corner (nx, ny) is the upper right: positive tan in both
    const ur = g.ny * (g.nx + 1) + g.nx;
    expect(g.uv[2 * ur]).toBeGreaterThan(0);
    expect(g.uv[2 * ur + 1]).toBeGreaterThan(0);
  });

  it('every class value is 1…5 and no uv is NaN; uniform cells are not refined, mixed cells are', () => {
    for (const [o, panel] of [
      [{ sph: -4 }, PANEL_412],
      [{ sph: 12 }, PANEL_400],
    ]) {
      const { ctx } = lensCtx(o);
      const g = tierGrid(ctx, panel, 'fein');
      expect(g.cls.every((c) => c >= 1 && c <= 5)).toBe(true);
      expect(g.uv.every(Number.isFinite)).toBe(true);
      expect(g.leafCount).toBe(0); // default frame: no rim, all class 1
      expect(g.rimInField).toBe(false);
    }
    const { ctx } = item12(-4);
    const g = tierGrid(ctx, PANEL_320, 'mittel');
    expect(g.uv.every(Number.isFinite)).toBe(true);
    expect(g.leaves.every(Number.isFinite)).toBe(true);
    const leafSide = effectiveLeafPx('mittel');
    for (let l = 0; l < g.leafCount; l++) {
      const [x0, y0, s, cls, u, v] = g.leaves.subarray(6 * l, 6 * l + 6);
      expect(s).toBeLessThanOrEqual(leafSide + 1e-9);
      // each leaf carries its centre ray's class and uv
      const ref = classifyDirection(ctx, ...tanAt(PANEL_320, x0 + s / 2, y0 + (s * g.cellY) / g.cellX / 2));
      expect(cls).toBe(ref.cls);
      if (ref.objTan) {
        expect(u).toBeCloseTo(ref.objTan[0], 5);
        expect(v).toBeCloseTo(ref.objTan[1], 5);
      } else {
        expect([u, v]).toEqual([0, 0]);
      }
    }
    // a leaf exists only inside a cell whose corners differ
    for (let l = 0; l < g.leafCount; l++) {
      const i = Math.floor((g.leaves[6 * l] + 1e-6) / g.cellX);
      const j = Math.floor((g.leaves[6 * l + 1] + 1e-6) / g.cellY);
      const k = j * (g.nx + 1) + i;
      const c = [g.cls[k], g.cls[k + 1], g.cls[k + g.nx + 1], g.cls[k + g.nx + 2]];
      expect(c.every((x) => x === c[0])).toBe(false);
    }
  });

  it('M2: a larger leafPx gives fewer rays; tiers are monotonic rays(grob) ≤ rays(mittel) ≤ rays(fein)', () => {
    const { ctx } = item12(-4);
    expect(warpGrid(ctx, PANEL_320, 6, { leafPx: 2 }).rays).toBeLessThan(warpGrid(ctx, PANEL_320, 6, { leafPx: 1 }).rays);
    for (const sph of [-4, 4]) {
      const c = item12(sph).ctx;
      for (const panel of [PANEL_320, PANEL_LARGEST]) {
        const [f, m, g] = ['fein', 'mittel', 'grob'].map((t) => tierGrid(c, panel, t).rays);
        console.info(`rays item-12 ${sph} ${panel.wPx}×${panel.hPx}: fein ${f}, mittel ${m}, grob ${g}`);
        expect(g).toBeLessThanOrEqual(m);
        expect(m).toBeLessThanOrEqual(f);
      }
    }
  });

  it('N3: rimInField true for the item-12 frame at 320 px, false for the default frame at 412 px; past-rim and no-view flags', () => {
    const a = tierGrid(item12(-4).ctx, PANEL_320, 'fein');
    expect(a.rimInField).toBe(true);
    expect(a.pastRimInField).toBe(false);
    expect(a.noViewInField).toBe(false);
    const b = tierGrid(lensCtx({ sph: -4 }).ctx, PANEL_412, 'fein');
    expect(b.rimInField).toBe(false);
    expect(b.pastRimInField).toBe(false);
    expect(b.noViewInField).toBe(false);
    // synthetic: hemispherical back, small round frame → rim face and past the rim in one panel
    const steep = { ...PLATE, ca: 0.2, cb: 0.2 };
    const small = prepareWarp({ surfaces: steep, frame: { shape: 'rund', A: 14, B: 14 }, eye: 'OD' });
    const c = warpGrid(small, panelOf(300, 300), 10, { leafPx: 3 });
    expect(c.pastRimInField).toBe(true);
    expect(c.rimInField).toBe(true);
    expect(c.cls.every((x) => x >= 1 && x <= 5)).toBe(true);
    // no view: missed back with the plane hit inside a large outline
    const large = prepareWarp({ surfaces: steep, frame: { shape: 'rund', A: 60, B: 60 }, eye: 'OD' });
    expect(warpGrid(large, panelOf(300, 300), 10, { leafPx: 3 }).noViewInField).toBe(true);
  });

  it('maxObjTan is the largest class-1 |objTan| of the grid', () => {
    const { ctx } = lensCtx({ sph: -4 });
    const g = tierGrid(ctx, PANEL_412, 'fein');
    let m = 0;
    for (let k = 0; k < g.cls.length; k++) m = Math.max(m, Math.hypot(g.uv[2 * k], g.uv[2 * k + 1]));
    expect(g.maxObjTan).toBeCloseTo(m, 6);
    expect(g.maxObjTan).toBeGreaterThan(0.5);
  });

  it('leaf buffer growth: many mixed cells (fine leaves on a big panel) keep every leaf intact', () => {
    const { ctx } = item12(4);
    const g = warpGrid(ctx, PANEL_LARGEST, 6, { leafPx: 0.5 });
    expect(g.leafCount).toBeGreaterThan(4096);
    expect(g.leaves.length).toBe(6 * g.leafCount);
    for (let l = 0; l < g.leafCount; l++) {
      const cls = g.leaves[6 * l + 3];
      expect(cls >= 1 && cls <= 5).toBe(true);
    }
  });

  it('E2 for the grid: the central Jacobian at tier fein equals LensResult.magnification within 0,05 pp', () => {
    for (const o of [{ sph: -4 }, { sph: -2, cyl: -2, axisDeg: 30 }]) {
      const { lens, ctx } = lensCtx(o);
      const g = tierGrid(ctx, PANEL_412, 'fein');
      const ic = g.nx / 2;
      const jc = g.ny / 2;
      const uv = (i, j, c) => g.uv[2 * (j * (g.nx + 1) + i) + c];
      const dx = (2 * g.cellX) / PANEL_412.pxPerTan;
      const dy = (2 * g.cellY) / PANEL_412.pxPerTan;
      const j11 = (uv(ic + 1, jc, 0) - uv(ic - 1, jc, 0)) / dx;
      const j21 = (uv(ic + 1, jc, 1) - uv(ic - 1, jc, 1)) / dx;
      const j12 = (uv(ic, jc + 1, 0) - uv(ic, jc - 1, 0)) / dy;
      const j22 = (uv(ic, jc + 1, 1) - uv(ic, jc - 1, 1)) / dy;
      // eigenvalues of M = J⁻¹: trace(M) = trace(J)/det(J), det(M) = 1/det(J)
      const det = j11 * j22 - j12 * j21;
      const tr = (j11 + j22) / det;
      const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - 1 / det));
      const eig = [tr / 2 - disc, tr / 2 + disc];
      const sm = lens.magnification.meridians.map((m) => m.sm).sort((a, b) => a - b);
      if (sm.length === 1) sm.push(sm[0]);
      expect(Math.abs(eig[0] - sm[0])).toBeLessThan(0.0005);
      expect(Math.abs(eig[1] - sm[1])).toBeLessThan(0.0005);
    }
  });

  it('invalid ctx returns that failure object; invalid panel or cell size gives a failure, never an exception', () => {
    const bad = prepareWarp({});
    expect(warpGrid(bad, PANEL_412, 6)).toBe(bad);
    expect(warpGrid(undefined, PANEL_412, 6).ok).toBe(false);
    const { ctx } = lensCtx({ sph: -1 });
    for (const [panel, cell, opt] of [
      [{ wPx: 0, hPx: 10, pxPerTan: 10 }, 6, {}],
      [{ wPx: 10, hPx: NaN, pxPerTan: 10 }, 6, {}],
      [null, 6, {}],
      [PANEL_412, 0, {}],
      [PANEL_412, 6, { leafPx: -1 }],
    ]) {
      const r = warpGrid(ctx, panel, cell, opt);
      expect(r.ok).toBe(false);
      expect(Object.isFrozen(r)).toBe(true);
    }
  });
});

// N10 worst-case set (default frame, OD): both diagonal orientations of the oblique cylinder.
const N10_CASES = [
  { name: '−12,00 CR-39', o: { sph: -12 } },
  { name: '−10,00 / −4,00 × 30 CR-39', o: { sph: -10, cyl: -4, axisDeg: 30 } },
  { name: '−10,00 / −4,00 × 120 CR-39', o: { sph: -10, cyl: -4, axisDeg: 120 } },
  { name: '+12,00 CR-39', o: { sph: 12 } },
  { name: '+8,00 / −6,00 × 135 1,74', o: { sph: 8, cyl: -6, axisDeg: 135, materialId: 'idx174' } },
];

describe('REF-02 grid error bounds (N10)', () => {
  for (const tier of Object.keys(REF_GRID_TIERS)) {
    // N10 limit 0,5 px; the P0-fixed tiers must keep the NEW-4 headroom, ≤ 0,45 px.
    it(`${tier}: drawn (sw-ne) interpolant error at the panel edge ≤ 0,45 px (N10 limit 0,5 px) at 215,42 px/tan (measured 400 px column)`, () => {
      for (const { name, o } of N10_CASES) {
        const { ctx } = lensCtx(o);
        const g = tierGrid(ctx, PANEL_400, tier);
        const err = edgeInterpErrorPx(ctx, PANEL_400, g);
        console.info(`N10 ${tier} ${name}: edge error ${err.toFixed(4)} px`);
        expect(err, name).toBeLessThanOrEqual(0.45);
      }
    });

    it(`${tier}: class boundary on the centre line within 2 px of the true one (item-12 frame, 249,4 px/tan)`, () => {
      for (const sph of [-4, 4]) {
        const { ctx } = item12(sph);
        const g = tierGrid(ctx, PANEL_320, tier);
        const err = boundaryErrorPx(ctx, PANEL_320, g);
        console.info(`N10 ${tier} item-12 ${sph}: boundary error ${err.toFixed(3)} px`);
        expect(err).toBeLessThanOrEqual(2);
      }
    });
  }
});

/**
 * E10 edge-midpoint shift (UI-SPEC "How visible the effect is"): the shift of the chart point at
 * the middle of a panel edge between "Mit Glas" and "Ohne Glas", CSS px. side 'long' = the edges
 * at the ends of the long axis; max over the two opposite edges.
 */
function edgeMidShiftPx(ctx, panel, side) {
  const vertical = (panel.hPx >= panel.wPx) === (side === 'long');
  const half = (vertical ? panel.hPx : panel.wPx) / 2 / panel.pxPerTan;
  let worst = 0;
  for (const s of [-1, 1]) {
    const e = vertical ? [0, s * half] : [s * half, 0];
    const r = classifyDirection(ctx, ...e);
    expect(r.cls).toBe(REF_CLASS.LENS);
    worst = Math.max(worst, Math.hypot(r.objTan[0] - e[0], r.objTan[1] - e[1]) * panel.pxPerTan);
  }
  return worst;
}

/**
 * E10 tick offset: on the edges of `side` (long side = the two long edges), the distance along the
 * edge between the outermost tick and where its chart line crosses the line 14 px inside that edge
 * in "Mit Glas". Max over both edges and both ends.
 */
function tickOffsetPx(ctx, panel, side) {
  const P = panel.pxPerTan;
  const alongVertical = (panel.hPx >= panel.wPx) === (side === 'long');
  const alongHalf = (alongVertical ? panel.hPx : panel.wPx) / 2; // half-length of the edge, px
  const across = (alongVertical ? panel.wPx : panel.hPx) / 2 - 14; // the 14 px line, px from the centre
  const nMax = Math.floor(alongHalf / (CHART_SQUARE_TAN * P));
  let worst = 0;
  for (const s of [-1, 1]) {
    for (const n of [-nMax, nMax]) {
      const target = n * CHART_SQUARE_TAN;
      const chartAlong = (c) => {
        const dir = alongVertical ? [(s * across) / P, c] : [c, (s * across) / P];
        const r = classifyDirection(ctx, ...dir);
        expect(r.cls).toBe(REF_CLASS.LENS);
        return alongVertical ? r.objTan[1] : r.objTan[0];
      };
      let a = 0;
      let b = (Math.sign(n) * alongHalf * 1.5) / P;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if ((chartAlong(m) - target) * Math.sign(n) < 0) a = m;
        else b = m;
      }
      worst = Math.max(worst, Math.abs((a + b) / 2 - target) * P);
    }
  }
  return worst;
}

// E10 values are pinned to their P0 measurement (04-P0-RESULTS.md section 5, production trace at
// the measured geometries, lens-critic MINOR 2) with toBeCloseTo(measured, 2); the UI-SPEC
// thresholds stay as additional bounds.
describe('REF-01 visibility (E10)', () => {
  const lens = (o) => lensCtx(o).ctx;
  it('412 two-panel (measured 189 × 285): −1,00 and 0,00 / −1,00 × 180 reach 3,0 px, −0,75 does not', () => {
    const m1 = lens({ sph: -1 });
    const c180 = lens({ sph: 0, cyl: -1, axisDeg: 180 });
    const m075 = lens({ sph: -0.75 });
    const v = {
      m1Mid: edgeMidShiftPx(m1, PANEL_412, 'long'),
      m1Tick: tickOffsetPx(m1, PANEL_412, 'long'),
      c180Mid: edgeMidShiftPx(c180, PANEL_412, 'long'),
      c180Tick: tickOffsetPx(c180, PANEL_412, 'long'),
      c180TickShort: tickOffsetPx(c180, PANEL_412, 'short'),
      m075Mid: edgeMidShiftPx(m075, PANEL_412, 'long'),
    };
    console.info('E10 412', JSON.stringify(v));
    expect(v.m1Mid).toBeCloseTo(3.423, 2);
    expect(v.m1Tick).toBeCloseTo(3.1852, 2);
    expect(v.c180Mid).toBeCloseTo(3.423, 2);
    expect(v.c180Tick).toBeCloseTo(2.9445, 2);
    expect(v.c180TickShort).toBeCloseTo(0.3221, 2);
    expect(v.m075Mid).toBeCloseTo(2.5353, 2);
    expect(v.m1Mid).toBeGreaterThanOrEqual(3.0);
    expect(v.m1Tick).toBeGreaterThanOrEqual(2.5);
    expect(v.c180Mid).toBeGreaterThanOrEqual(3.0);
    expect(v.c180Tick).toBeGreaterThanOrEqual(2.5);
    expect(v.c180TickShort).toBeLessThanOrEqual(0.5);
    expect(v.m075Mid).toBeLessThan(3.0);
  });

  it('320 one-panel (measured 288 × 216): 0,00 / −1,00 × 90 reaches 3,0 px along the long side, ≤ 0,5 px across', () => {
    const c90 = lens({ sph: 0, cyl: -1, axisDeg: 90 });
    const v = {
      c90Mid: edgeMidShiftPx(c90, PANEL_320, 'long'),
      c90Tick: tickOffsetPx(c90, PANEL_320, 'long'),
      c90TickShort: tickOffsetPx(c90, PANEL_320, 'short'),
    };
    console.info('E10 320', JSON.stringify(v));
    expect(v.c90Mid).toBeCloseTo(3.4591, 2);
    expect(v.c90Tick).toBeCloseTo(3.0314, 2);
    expect(v.c90TickShort).toBeCloseTo(0.4498, 2);
    expect(v.c90Mid).toBeGreaterThanOrEqual(3.0);
    expect(v.c90Tick).toBeGreaterThanOrEqual(2.5);
    expect(v.c90TickShort).toBeLessThanOrEqual(0.5);
  });

  it('N6: 400 px desktop column (measured 198 × 248,75): −1,00 and 0,00 / −1,00 × 180, just below 3,0 px (P0 finding)', () => {
    const m1 = lens({ sph: -1 });
    const c180 = lens({ sph: 0, cyl: -1, axisDeg: 180 });
    const v = {
      m1Mid: edgeMidShiftPx(m1, PANEL_400, 'long'),
      m1Tick: tickOffsetPx(m1, PANEL_400, 'long'),
      c180Mid: edgeMidShiftPx(c180, PANEL_400, 'long'),
      c180Tick: tickOffsetPx(c180, PANEL_400, 'long'),
    };
    console.info('E10 400', JSON.stringify(v));
    expect(v.m1Mid).toBeCloseTo(2.9876, 2);
    expect(v.m1Tick).toBeCloseTo(2.952, 2);
    expect(v.c180Mid).toBeCloseTo(2.9876, 2);
    expect(v.c180Tick).toBeCloseTo(2.6366, 2);
    // P0 finding (04-P0-RESULTS.md section 5): the long side 248,75 px is below the 250 px at
    // which −1,00 reaches 3,0 px; recorded for lens-critic, not hidden by a looser bound.
    expect(v.m1Mid).toBeLessThan(3.0);
    expect(v.m1Tick).toBeGreaterThanOrEqual(2.5);
  });
});

// Ray counts recorded by P0 (04-P0-RESULTS.md section 8) for the item-12 frame, OD.
const P0_RAYS = {
  'item-12 −4,00 at 320 one-panel': { sph: -4, panel: PANEL_320, fein: 6549, mittel: 1900, grob: 1394 },
  'item-12 +4,00 at 320 one-panel': { sph: 4, panel: PANEL_320, fein: 6421, mittel: 1900, grob: 1426 },
  'item-12 −4,00 at largest 639 × 800': { sph: -4, panel: PANEL_LARGEST, fein: 23540, mittel: 9845, grob: 6609 },
  'item-12 +4,00 at largest 639 × 800': { sph: 4, panel: PANEL_LARGEST, fein: 26356, mittel: 10421, grob: 7025 },
};

// Host-independent cost gate (lens-critic M2, round-2 NEW-2): runs in CI on every push; timing
// never gates CI, the ray count does.
describe('REF-02 ray-count gate (M2)', () => {
  it('effectiveLeafPx(fein) ≤ effectiveLeafPx(mittel) ≤ effectiveLeafPx(grob) ≤ 2·√2; P0-fixed tiers', () => {
    expect(REF_GRID_TIERS).toEqual({
      fein: { cellPx: 6, leafPx: 1 },
      mittel: { cellPx: 8, leafPx: 2 },
      grob: { cellPx: 10, leafPx: 3 },
    });
    expect([effectiveLeafPx('fein'), effectiveLeafPx('mittel'), effectiveLeafPx('grob')]).toEqual([0.75, 2, 2.5]);
    expect(effectiveLeafPx('fein')).toBeLessThanOrEqual(effectiveLeafPx('mittel'));
    expect(effectiveLeafPx('mittel')).toBeLessThanOrEqual(effectiveLeafPx('grob'));
    expect(effectiveLeafPx('grob')).toBeLessThanOrEqual(2 * Math.SQRT2);
  });

  for (const [name, c] of Object.entries(P0_RAYS)) {
    it(`${name}: rays ≤ 1,1 × P0, rays(grob) ≤ rays(mittel) ≤ rays(fein), rays(grob) ≤ 0,5 · rays(fein)`, () => {
      const { ctx } = item12(c.sph);
      const rays = Object.fromEntries(['fein', 'mittel', 'grob'].map((t) => [t, tierGrid(ctx, c.panel, t).rays]));
      console.info(`ray gate ${name}: ${JSON.stringify(rays)}`);
      for (const t of ['fein', 'mittel', 'grob']) expect(rays[t], t).toBeLessThanOrEqual(1.1 * c[t]);
      expect(rays.grob).toBeLessThanOrEqual(rays.mittel);
      expect(rays.mittel).toBeLessThanOrEqual(rays.fein);
      expect(rays.grob).toBeLessThanOrEqual(0.5 * rays.fein);
    });
  }
});

/** UI-SPEC P0 criteria 1, 2 and 4 on the 8 × 36 polar grid within tan √2 · tan(field). */
function p0Criteria(o) {
  const s = spec(o);
  const lens = evaluateLens(s);
  expect(lens.ok, 'accepted by the engine').toBe(true);
  const ctx = prepareWarp({ surfaces: lens.surfaces, frame: s.frame, eye: s.eye });
  const rDisc = Math.SQRT2 * TAN_FIELD;
  const classes = new Set();
  for (let k = 0; k <= 8; k++) {
    for (let sp = 0; sp < (k === 0 ? 1 : 36); sp++) {
      const a = (2 * Math.PI * sp) / 36;
      const r = classifyDirection(ctx, ((rDisc * k) / 8) * Math.cos(a), ((rDisc * k) / 8) * Math.sin(a));
      classes.add(r.cls);
      // criteria 1 and 2: no back-inside ray that misses or reflects, no class-1 |tan| > 3 (both are class 3)
      expect(r.cls).not.toBe(REF_CLASS.NO_VIEW);
      if (r.cls === REF_CLASS.LENS) expect(Math.hypot(...r.objTan)).toBeLessThanOrEqual(OBJ_TAN_MAX);
    }
  }
  // criterion 4: both principal meridians of the trace vs LensResult.magnification ≤ 0,05 pp
  const { eig } = wearerMagnification(ctx);
  const sm = lens.magnification.meridians.map((m) => m.sm).sort((a, b) => a - b);
  if (sm.length === 1) sm.push(sm[0]);
  expect(Math.abs(eig[0] - sm[0])).toBeLessThan(0.0005);
  expect(Math.abs(eig[1] - sm[1])).toBeLessThan(0.0005);
  return classes;
}

const ITEM12_SPEC = { frame: ITEM12_FRAME, monoPD: 40 };
// The three G2 corner cases are the extremes of 04-P0-RESULTS.md section 1 / section 7.
const P0_CI = [
  ['item-12 −4,00 OD (rim in the field)', { ...ITEM12_SPEC, sph: -4 }, true],
  ['item-12 +4,00 OD (rim in the field)', { ...ITEM12_SPEC, sph: 4 }, true],
  ['default frame −10,00', { sph: -10 }, false],
  ['default frame +12,00', { sph: 12 }, false],
  [
    'G2 corner 1: rund 40×28/14 PD 25, idx174, BC 0, −12,00 / −6,00 × 0, OD (largest class-1 |objTan|)',
    { frame: { shape: 'rund', A: 40, B: 28, DBL: 14 }, monoPD: 25, materialId: 'idx174', baseCurve: 0, sph: -12, cyl: -6, axisDeg: 0 },
    false,
  ],
  [
    'G2 corner 2: rund 40×28/14 PD 40, cr39, BC 0, +12,00, OD (largest radial size change)',
    { frame: { shape: 'rund', A: 40, B: 28, DBL: 14 }, monoPD: 40, baseCurve: 0, sph: 12 },
    true,
  ],
  [
    'G2 corner 3: rechteckig 62×55/24 PD 25, trivex, BC 10, +12,00, OD (largest tangential size change)',
    { frame: { shape: 'rechteckig', A: 62, B: 55, DBL: 24 }, monoPD: 25, materialId: 'trivex', baseCurve: 10, sph: 12 },
    null,
  ],
];

describe('REF-01 P0 CI subset', () => {
  for (const [name, o, rim] of P0_CI) {
    it(`${name}: criteria 1, 2 and 4 on the 8 × 36 grid`, () => {
      const classes = p0Criteria(o);
      const hasRim = classes.has(2) || classes.has(4) || classes.has(5);
      if (rim !== null) expect(hasRim).toBe(rim);
    });
  }
});
