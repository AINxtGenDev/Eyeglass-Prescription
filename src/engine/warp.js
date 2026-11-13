// Durchblick warp grid (REF-01, REF-02, D-12): for a panel of the wearer's view, a regular grid of
// eye directions (uniform in eye tan = uniform in CSS px) traced through the real lens surfaces
// with trace.js traceFromEye, plus one aperture class per direction (UI-SPEC "Aperture, rim and
// edge band"). Pure JS: no DOM, no Three.js, no timing (the worker glue measures).
//
// Frames (D-07): the engine works in the examiner frame (conventions.js: +x = wearer's LEFT). The
// wearer sees the mirror image, so the ONE mirror of this module is wearer x = −engine x, done in
// classifyDirection. Every output field (eye tan, object tan, panel px) is in the wearer frame:
// +x = wearer's right = screen right, +y = up.

import { traceFromEye, TRACE_STATUS } from './trace.js';
import { frameOutline } from './frame/outline.js';
import { SHAPES } from './frame/shapes.js';
import { FRAME_FACE_MM } from './mesh/frame.js';
import { EYE_POINT_MM } from './magnification.js';
import { insideOutline, signedDistanceToOutline, outlineRadii } from './outline-geom.js';

/** Aperture classes, UI-SPEC table order. */
export const REF_CLASS = Object.freeze({ LENS: 1, EDGE_BAND: 2, NO_VIEW: 3, RIM_FACE: 4, PAST_RIM: 5 });

/** UI-SPEC class 1 limit: an object direction with |tan| above this has no defined picture. */
export const OBJ_TAN_MAX = 3;

/** Field half-angle along the panel's longer side (deg); provisional until P0 (04-03 Task 3). */
export const FIELD_HALF_ANGLE_DEG = 30;

/**
 * Grid tiers (provisional until P0, 04-03 Task 3): cell size and quadtree leaf target in CSS px.
 * leafPx: N10 allows a 2 px class boundary; a leaf of side L gives a centre-sample boundary error
 * ≤ L·√2/2, so L ≤ 2,83 px; the quadtree halves cells, so the real leaf is effectiveLeafPx, and it
 * must not get finer on a step down (lens-critic M2, round-2 NEW-2: with grob leafPx 2 the real
 * grob leaf was 1,375 px, finer than mittel's 2 px, and cost +23 … +66 % rays in rim cases).
 * grob cell 10, not 11: lens-critic round 3 measured 0,4998 px for −10,00/−4,00×30 at cell 11.
 */
export const REF_GRID_TIERS = Object.freeze({
  fein: Object.freeze({ cellPx: 6, leafPx: 1 }),
  mittel: Object.freeze({ cellPx: 8, leafPx: 2 }),
  grob: Object.freeze({ cellPx: 10, leafPx: 3 }),
});

/** The leaf side the quadtree really reaches for a tier (cells are halved, so ≤ leafPx). */
export function effectiveLeafPx(tier) {
  const { cellPx, leafPx } = REF_GRID_TIERS[tier];
  return cellPx / 2 ** Math.ceil(Math.log2(cellPx / leafPx));
}

/**
 * Each grid cell is drawn as two triangles split from its lower-left (south-west) to its
 * upper-right (north-east) corner. refraction.js builds its index buffer from this constant and
 * the N10 test interpolates with it (lens-critic MINOR 1: the drawn interpolant is the tested one).
 */
export const CELL_DIAGONAL = 'sw-ne';

const fin = Number.isFinite;
const failure = (code) => Object.freeze({ ok: false, code });

function surfacesOk(s) {
  if (s == null || typeof s !== 'object' || s.oc == null) return false;
  for (const v of [s.n, s.ct, s.c1, s.k1, s.ca, s.cb, s.axisRad, s.oc.x, s.oc.y]) if (!fin(v)) return false;
  return s.n > 1 && s.ct > 0;
}

/**
 * Warp context for one lens: surfaces, the frame outline of that eye and the fast-path radii.
 * @param {{ surfaces: object, frame: { shape: string, A: number, B: number }, eye: 'OD'|'OS',
 *   hMm?: number }} input surfaces = LensResult.surfaces; hMm = back vertex → eye point
 * @returns {object} ctx with ok: true, or a frozen { ok: false, code } (never an exception)
 */
export function prepareWarp(input) {
  if (input == null || typeof input !== 'object') return failure('INVALID_INPUT');
  const { surfaces, frame, eye, hMm = EYE_POINT_MM } = input;
  if (!surfacesOk(surfaces)) return failure('INVALID_SURFACES');
  if (frame == null || typeof frame !== 'object' || !Object.hasOwn(SHAPES, frame.shape)) return failure('INVALID_FRAME');
  if (!(fin(frame.A) && fin(frame.B) && frame.A > 0 && frame.B > 0)) return failure('INVALID_FRAME');
  if (eye !== 'OD' && eye !== 'OS') return failure('INVALID_EYE');
  if (!(fin(hMm) && hMm > 0)) return failure('INVALID_EYE_POINT');
  const outline = frameOutline(frame.shape, frame.A, frame.B, eye);
  const ocX = surfaces.oc.x;
  const ocY = surfaces.oc.y;
  const { rMin, rMax } = outlineRadii(outline, ocX, ocY);
  return {
    ok: true,
    surfaces,
    h: hMm,
    eye,
    outline,
    ocX,
    ocY,
    // rMin is a valid inside fast path only when the OC itself is inside the outline
    rInside: insideOutline(outline, ocX, ocY) ? rMin : 0,
    rPast: rMax + FRAME_FACE_MM,
  };
}

/** Inside test with the OC-radius fast path. */
function inside(ctx, x, y) {
  const dx = x - ctx.ocX;
  const dy = y - ctx.ocY;
  const r2 = dx * dx + dy * dy;
  if (r2 < ctx.rInside * ctx.rInside) return true;
  if (r2 > ctx.rPast * ctx.rPast) return false;
  return insideOutline(ctx.outline, x, y);
}

const NO_VIEW = Object.freeze({ cls: REF_CLASS.NO_VIEW, objTan: null });
const EDGE_BAND = Object.freeze({ cls: REF_CLASS.EDGE_BAND, objTan: null });
const RIM_FACE = Object.freeze({ cls: REF_CLASS.RIM_FACE, objTan: null });

/**
 * Class and traced object direction of one eye direction (UI-SPEC order 1 → 5).
 * @param {object} ctx from prepareWarp (ok: true)
 * @param {number} wTanX eye-side tangent, wearer frame (+x = screen right)
 * @param {number} wTanY eye-side tangent, +y up
 * @returns {{ cls: number, objTan: [number, number] | null }} objTan in the wearer frame for
 *   classes 1 (traced) and 5 (identity, past the rim); null for classes 2–4
 */
export function classifyDirection(ctx, wTanX, wTanY) {
  // D-07: the one mirror, wearer frame → engine frame (engine +x = wearer's left).
  const ex = -wTanX;
  const ey = wTanY;
  const r = traceFromEye(ctx.surfaces, ctx.h, ex, ey);
  // Back hit; when the extended back surface is missed, the plane z = −CT through the back vertex.
  let bx;
  let by;
  if (r.back) {
    bx = r.back[0];
    by = r.back[1];
  } else {
    bx = ctx.ocX + ctx.h * ex;
    by = ctx.ocY + ctx.h * ey;
  }
  if (!inside(ctx, bx, by)) {
    const dx = bx - ctx.ocX;
    const dy = by - ctx.ocY;
    const past =
      dx * dx + dy * dy > ctx.rPast * ctx.rPast || signedDistanceToOutline(ctx.outline, bx, by) > FRAME_FACE_MM;
    return past ? { cls: REF_CLASS.PAST_RIM, objTan: [wTanX, wTanY] } : RIM_FACE;
  }
  // Back hit inside. A front point outside the outline means the ray meets the lens edge wall in
  // the rim groove first (class 2), whatever happens at the extended front surface.
  if (r.front && !inside(ctx, r.front[0], r.front[1])) return EDGE_BAND;
  if (r.status !== TRACE_STATUS.OK) return NO_VIEW;
  const ox = -r.objTan[0]; // back to the wearer frame
  const oy = r.objTan[1];
  if (!(fin(ox) && fin(oy)) || Math.hypot(ox, oy) > OBJ_TAN_MAX) return NO_VIEW;
  return { cls: REF_CLASS.LENS, objTan: [ox, oy] };
}

const LEAF_FLOATS = 6;
const LEAF_START = 1024;

/**
 * Warp grid of one panel (D-12): a regular grid of eye directions, uniform in eye tan, with the
 * traced object direction and the class of every grid point, plus quadtree leaves for every cell
 * whose four corners do not share a class. Panel px: origin at the panel's lower-left corner,
 * +x right, +y up; the panel centre is wearer tan (0, 0); tan = (px − size/2) / pxPerTan.
 * @param {object} ctx from prepareWarp
 * @param {{ wPx: number, hPx: number, pxPerTan: number }} panel CSS px and the scale
 * @param {number} cellPx largest cell side; nx = ceil(wPx / cellPx), cellX = wPx / nx (same for y)
 * @param {{ leafPx?: number }} [opts] leaf target; mixed cells are halved until the leaf ≤ leafPx
 * @returns {{ ok: true, nx: number, ny: number, cellX: number, cellY: number,
 *   uv: Float32Array, cls: Uint8Array, leaves: Float32Array, leafCount: number, rays: number,
 *   rimInField: boolean, pastRimInField: boolean, noViewInField: boolean, maxObjTan: number }
 *   | { ok: false, code: string }}
 *   uv: wearer object tan per grid point, row-major from the bottom row, (nx + 1)·(ny + 1) points
 *   (0, 0 for classes 2–4); cls: class per grid point; leaves: [x0, y0, size, cls, u, v] per leaf,
 *   x0/y0 = lower-left corner in panel px, size = leaf width px (leaf height = size · cellY / cellX),
 *   cls/u/v from the leaf's centre ray; rays = classifyDirection calls (grid points + leaf
 *   centres), the host-independent cost measure (lens-critic M2); maxObjTan = max class-1 |objTan|
 */
export function warpGrid(ctx, panel, cellPx, { leafPx = 1 } = {}) {
  if (ctx?.ok !== true) return ctx?.ok === false ? ctx : failure('INVALID_CTX');
  const { wPx, hPx, pxPerTan: P } = panel ?? {};
  if (!(fin(wPx) && fin(hPx) && fin(P) && wPx > 0 && hPx > 0 && P > 0)) return failure('INVALID_PANEL');
  if (!(fin(cellPx) && cellPx > 0 && fin(leafPx) && leafPx > 0)) return failure('INVALID_CELL');

  const nx = Math.ceil(wPx / cellPx);
  const ny = Math.ceil(hPx / cellPx);
  const cellX = wPx / nx;
  const cellY = hPx / ny;
  const stride = nx + 1;
  const uv = new Float32Array(2 * stride * (ny + 1));
  const cls = new Uint8Array(stride * (ny + 1));
  let leaves = new Float32Array(LEAF_FLOATS * LEAF_START);
  let leafCount = 0;
  let rays = 0;
  let maxObjTan = 0;
  const seen = [false, false, false, false, false, false];

  // One sample: classify, fold in the finite check and the flags, write class and uv.
  const sample = (x, y, out, o) => {
    rays++;
    const r = classifyDirection(ctx, (x - wPx / 2) / P, (y - hPx / 2) / P);
    let c = r.cls;
    let u = 0;
    let v = 0;
    if (r.objTan !== null) {
      u = r.objTan[0];
      v = r.objTan[1];
      if (!(fin(u) && fin(v))) {
        c = REF_CLASS.NO_VIEW;
        u = 0;
        v = 0;
      } else if (c === REF_CLASS.LENS) {
        const m = Math.hypot(u, v);
        if (m > maxObjTan) maxObjTan = m;
      }
    }
    seen[c] = true;
    out[o] = u;
    out[o + 1] = v;
    return c;
  };

  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * stride + i;
      cls[k] = sample(i * cellX, j * cellY, uv, 2 * k);
    }
  }

  // Mixed cells: split to the full quadtree depth (each halving step on both axes) so every leaf
  // is ≤ effectiveLeafPx; each leaf carries its centre ray.
  const m = 2 ** Math.max(0, Math.ceil(Math.log2(cellPx / leafPx)));
  const lw = cellX / m;
  const lh = cellY / m;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * stride + i;
      const c0 = cls[k];
      if (cls[k + 1] === c0 && cls[k + stride] === c0 && cls[k + stride + 1] === c0) continue;
      for (let b = 0; b < m; b++) {
        for (let a = 0; a < m; a++) {
          if (LEAF_FLOATS * (leafCount + 1) > leaves.length) {
            const grown = new Float32Array(2 * leaves.length);
            grown.set(leaves);
            leaves = grown;
          }
          const o = LEAF_FLOATS * leafCount++;
          const x0 = i * cellX + a * lw;
          const y0 = j * cellY + b * lh;
          leaves[o] = x0;
          leaves[o + 1] = y0;
          leaves[o + 2] = lw;
          leaves[o + 3] = sample(x0 + lw / 2, y0 + lh / 2, leaves, o + 4);
        }
      }
    }
  }

  return {
    ok: true,
    nx,
    ny,
    cellX,
    cellY,
    uv,
    cls,
    leaves: leaves.subarray(0, LEAF_FLOATS * leafCount),
    leafCount,
    rays,
    rimInField: seen[REF_CLASS.EDGE_BAND] || seen[REF_CLASS.RIM_FACE],
    pastRimInField: seen[REF_CLASS.PAST_RIM],
    noViewInField: seen[REF_CLASS.NO_VIEW],
    maxObjTan,
  };
}
