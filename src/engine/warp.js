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
