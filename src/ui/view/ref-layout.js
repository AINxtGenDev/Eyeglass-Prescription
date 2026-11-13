// Durchblick panel layout and chart definition (04-08, REF-01; UI-SPEC "Layout of the picture",
// "Narrow stage fallback", D-06, D-08). Pure: no three.js, no DOM, so the e2e Node oracle
// (e2e/view-ref.spec.js) and refraction.js use the same numbers and the same chart.
//
// - Panels: two panels side by side from a REF_SPLIT_MIN_PX wide stage, one below. Two-panel order
//   is 'L' (OS, the wearer's left) then 'R' (OD): the picture is drawn as the wearer sees it, so
//   the right lens is in the right panel (D-06). Both panels get the same width, floor((W − 2) / 2),
//   with the 2 px divider between them; the right panel is flush right (compare3d halfBox rule).
// - Scale: pxPerTan = longSide / (2 · tan FIELD_HALF_ANGLE_DEG), from the panel size only.
// - Chart (D-08): one chart at infinity in object-tan units; checker square CHART_SQUARE_TAN with a
//   square corner at object tan (0, 0); the paper-white letter band from +1 to +3 squares above the
//   line of sight. checkerInk / inLetterBand are THE definition the drawing and the oracle share.
// - gridTriangles: the index list of a warp grid, split along warp.js CELL_DIAGONAL, the same
//   interpolant the N10 engine test bounds (lens-critic MINOR 1).
import { CELL_DIAGONAL, FIELD_HALF_ANGLE_DEG } from '../../engine/warp.js';

const RAD = Math.PI / 180;

/** Checker square edge in object tan units: tan 6° (UI-SPEC D-08, fixed with the 30° field by P0, 04-P0-RESULTS.md). */
export const CHART_SQUARE_TAN = Math.tan(6 * RAD);
/** Stage width (CSS px) from which two panels are shown: the same 360 px rule as compare3d.js SPLIT_MIN_PX. */
export const REF_SPLIT_MIN_PX = 360;
/** Divider between the two panels (CSS px, UI-SPEC: 2 px --line). */
export const REF_DIVIDER_PX = 2;
/** Letter band: from +1 to +3 squares above the line of sight; cap height 1 square (UI-SPEC D-08). */
export const CHART_BAND_SQUARES = Object.freeze({ from: 1, to: 3, cap: 1 });

const TAN_FIELD = Math.tan(FIELD_HALF_ANGLE_DEG * RAD);

/** Scale of a panel: px per tan unit, from its longer side (UI-SPEC "Field"). */
export const pxPerTanFor = (w, h) => Math.max(w, h) / (2 * TAN_FIELD);

/**
 * @param {{ stageW: number, stageH: number, compare?: boolean, shownEye?: 'OD'|'OS' }} o stage content box (CSS px);
 *   compare = the A/B layout (04-11: 'A' left, 'B' right, both the shown eye); shownEye = the eye of a single panel
 * @returns {{ panels: Array<{ id: string, eye: 'OD'|'OS', x: number, y: number, w: number, h: number,
 *   pxPerTan: number, squarePx: number }>, split: boolean }}
 */
export function panelLayout({ stageW, stageH, compare = false, shownEye = 'OD' }) {
  if (!(stageW > 0 && stageH > 0)) return { panels: [], split: false };
  const split = stageW >= REF_SPLIT_MIN_PX;
  const panel = (id, eye, x, w) => {
    const pxPerTan = pxPerTanFor(w, stageH);
    return { id, eye, x, y: 0, w, h: stageH, pxPerTan, squarePx: CHART_SQUARE_TAN * pxPerTan };
  };
  if (!split) return { panels: [panel(compare ? 'B' : shownEye === 'OS' ? 'L' : 'R', shownEye, 0, stageW)], split };
  const w = Math.floor((stageW - REF_DIVIDER_PX) / 2);
  const right = stageW - w;
  const panels = compare
    ? [panel('A', shownEye, 0, w), panel('B', shownEye, right, w)]
    : [panel('L', 'OS', 0, w), panel('R', 'OD', right, w)];
  return { panels, split };
}

/**
 * The two triangles of a cell (vertex offsets sw, se, nw, ne → 0, 1, 2, 3) for a diagonal name.
 * Counter-clockwise in y-up panel coordinates. Throws on an unknown name.
 * @param {string} diagonal
 */
export function cellSplit(diagonal) {
  if (diagonal === 'sw-ne') return [0, 1, 3, 0, 3, 2];
  if (diagonal === 'se-nw') return [0, 1, 2, 1, 3, 2];
  throw new Error(`ref-layout: unknown CELL_DIAGONAL '${diagonal}'`);
}
// At module load: a typo in the engine constant must fail loudly, not draw another interpolant.
const SPLIT = cellSplit(CELL_DIAGONAL);

/**
 * Index list of an nx × ny warp grid (vertices row-major from the bottom row, (nx + 1)·(ny + 1)),
 * six indices per cell in cell order (row-major from the bottom), split along CELL_DIAGONAL.
 * @param {number} nx @param {number} ny
 * @returns {Uint32Array}
 */
export function gridTriangles(nx, ny) {
  const stride = nx + 1;
  const out = new Uint32Array(6 * nx * ny);
  let o = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const sw = j * stride + i;
      const corner = [sw, sw + 1, sw + stride, sw + stride + 1];
      for (const c of SPLIT) out[o++] = corner[c];
    }
  }
  return out;
}

/** True when object tan (u, v) lies in the paper-white letter band (u is free: the band spans the chart). */
export const inLetterBand = (v) => v >= CHART_BAND_SQUARES.from * CHART_SQUARE_TAN && v < CHART_BAND_SQUARES.to * CHART_SQUARE_TAN;

/**
 * Checker colour at object tan (u, v), ignoring the letter band: true = ink (#1a1a1a), false = paper.
 * Square (i, j) = (floor(u / S), floor(v / S)); ink when i + j is even, so the square right of and
 * above the line of sight (0, 0) is ink and the chart has a square corner at (0, 0).
 */
export function checkerInk(u, v) {
  const i = Math.floor(u / CHART_SQUARE_TAN);
  const j = Math.floor(v / CHART_SQUARE_TAN);
  return ((i + j) & 1) === 0;
}
