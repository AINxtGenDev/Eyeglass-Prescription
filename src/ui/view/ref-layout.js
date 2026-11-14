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
// - Reference ticks (04-09, UI-SPEC "Reference ticks", N1, N11): tickPositions from the panel
//   centre and pxPerTan only (identical in Mit and Ohne Glas, never Rx-dependent); tickVisible hides
//   a tick whose 14 px inner sample point lies on the rim face or the edge band of the drawn warp.
import { CELL_DIAGONAL, FIELD_HALF_ANGLE_DEG, REF_CLASS } from '../../engine/warp.js';

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
 * @param {{ stageW: number, stageH: number, compare?: boolean, shownEye?: 'OD'|'OS', shown?: 'A'|'B' }} o stage
 *   content box (CSS px); compare = the A/B layout (04-11, D-11a: 'A' left, 'B' right, both the
 *   compared eye, the same width so the same pxPerTan); shownEye = the eye of a single panel or of
 *   the A/B panels; shown = the variant of the single A/B panel below REF_SPLIT_MIN_PX (#cmp-show)
 * @returns {{ panels: Array<{ id: string, eye: 'OD'|'OS', x: number, y: number, w: number, h: number,
 *   pxPerTan: number, squarePx: number }>, split: boolean }}
 */
export function panelLayout({ stageW, stageH, compare = false, shownEye = 'OD', shown = 'B' }) {
  if (!(stageW > 0 && stageH > 0)) return { panels: [], split: false };
  const split = stageW >= REF_SPLIT_MIN_PX;
  const panel = (id, eye, x, w) => {
    const pxPerTan = pxPerTanFor(w, stageH);
    return { id, eye, x, y: 0, w, h: stageH, pxPerTan, squarePx: CHART_SQUARE_TAN * pxPerTan };
  };
  if (!split) return { panels: [panel(compare ? (shown === 'A' ? 'A' : 'B') : shownEye === 'OS' ? 'L' : 'R', shownEye, 0, stageW)], split };
  const w = Math.floor((stageW - REF_DIVIDER_PX) / 2);
  const right = stageW - w;
  const panels = compare
    ? [panel('A', shownEye, 0, w), panel('B', shownEye, right, w)]
    : [panel('L', 'OS', 0, w), panel('R', 'OD', right, w)];
  return { panels, split };
}

/** Default-eye tie band: 0,05 percentage points of |SM − 1| (UI-SPEC "Narrow stage fallback"). */
const DEFAULT_EYE_TIE = 0.0005;
const EPS = 1e-12;

/**
 * One-panel default eye (D-06 as amended): the eye with the larger |SM − 1| over its principal
 * meridians; ties within 0,05 percentage points go to the right eye; an eye without a computed
 * lens (null) never wins.
 * @param {{ OD?: { meridians: Array<{ sm: number }> } | null, OS?: { meridians: Array<{ sm: number }> } | null }} mags
 * @returns {'OD' | 'OS'}
 */
export function defaultRefEye(mags) {
  const size = (m) => (m?.meridians?.length ? Math.max(...m.meridians.map((x) => Math.abs(x.sm - 1))) : null);
  const od = size(mags?.OD);
  const os = size(mags?.OS);
  if (os === null) return 'OD';
  if (od === null) return 'OS';
  return os - od > DEFAULT_EYE_TIE + EPS ? 'OS' : 'OD';
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

/** Tick length from the panel edge inward (CSS px, UI-SPEC "Reference ticks"). */
export const TICK_LEN_PX = 12;
/** The chart is sampled this far inside the panel edge for a tick (UI-SPEC item 25, N11). */
export const TICK_SAMPLE_PX = 14;

/**
 * Reference ticks of one panel: one where a grid line of the "Ohne Glas" chart (object tan
 * n · CHART_SQUARE_TAN, n integer incl. 0) meets a panel edge. Vertical lines give 'top' and
 * 'bottom' ticks, horizontal lines 'left' and 'right' ones; none on the left/right edges for the
 * lines inside the letter band, n = +1 … +3 (N1). Strictly inside the edge (a line exactly on a
 * panel corner gets no tick).
 * @param {{ x: number, y: number, w: number, h: number, pxPerTan: number }} p panel, stage CSS px (y down)
 * @returns {Array<{ edge: 'top'|'bottom'|'left'|'right', n: number, x: number, y: number }>}
 *   x, y = the point on the edge (stage CSS px)
 */
export function tickPositions(p) {
  const k = CHART_SQUARE_TAN * p.pxPerTan;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const out = [];
  const nx = Math.floor(p.w / 2 / k);
  for (let n = -nx; n <= nx; n++) {
    const x = cx + n * k;
    if (!(x > p.x && x < p.x + p.w)) continue;
    out.push({ edge: 'top', n, x, y: p.y }, { edge: 'bottom', n, x, y: p.y + p.h });
  }
  const ny = Math.floor(p.h / 2 / k);
  for (let n = -ny; n <= ny; n++) {
    if (n >= CHART_BAND_SQUARES.from && n <= CHART_BAND_SQUARES.to) continue; // N1: letter band
    const y = cy - n * k; // +n is up, the stage y runs down
    if (!(y > p.y && y < p.y + p.h)) continue;
    out.push({ edge: 'left', n, x: p.x, y }, { edge: 'right', n, x: p.x + p.w, y });
  }
  return out;
}

/** A tick's 14 px inner sample point in panel px (origin lower-left, y up; the warpGrid frame). */
export function tickSamplePanelPx(p, tick) {
  const yUp = p.y + p.h - tick.y;
  if (tick.edge === 'top') return [tick.x - p.x, p.h - TICK_SAMPLE_PX];
  if (tick.edge === 'bottom') return [tick.x - p.x, TICK_SAMPLE_PX];
  if (tick.edge === 'left') return [TICK_SAMPLE_PX, yUp];
  return [p.w - TICK_SAMPLE_PX, yUp];
}

/**
 * Aperture class of a warp grid at a panel px point: the cell's class when its four corners agree,
 * else the class of the quadtree leaf that contains the point (warpGrid leaves layout).
 * @param {{ nx: number, ny: number, cellX: number, cellY: number, cls: Uint8Array, leaves: Float32Array, leafCount: number }} warp
 * @param {number} px @param {number} py panel px, y up
 */
export function classAt(warp, px, py) {
  const { nx, ny, cellX, cellY, cls } = warp;
  const i = Math.min(nx - 1, Math.max(0, Math.floor(px / cellX)));
  const j = Math.min(ny - 1, Math.max(0, Math.floor(py / cellY)));
  const stride = nx + 1;
  const k = j * stride + i;
  const c0 = cls[k];
  if (cls[k + 1] === c0 && cls[k + stride] === c0 && cls[k + stride + 1] === c0) return c0;
  const lv = warp.leaves;
  const aspect = cellY / cellX;
  for (let l = 0; l < warp.leafCount; l++) {
    const o = 6 * l;
    const x0 = lv[o];
    const y0 = lv[o + 1];
    const s = lv[o + 2];
    if (px >= x0 && px < x0 + s && py >= y0 && py < y0 + s * aspect) return lv[o + 3];
  }
  return c0;
}

/**
 * N11: false when the tick's 14 px inner sample point lies on the rim face or the edge band of the
 * drawn warp (the "Ohne Glas" square edge is not visible there); true without a warp.
 * @param {Parameters<typeof classAt>[0] | null} warp
 * @param {{ x: number, y: number, w: number, h: number }} panel
 * @param {{ edge: string, x: number, y: number }} tick
 */
export function tickVisible(warp, panel, tick) {
  if (!warp) return true;
  const [px, py] = tickSamplePanelPx(panel, tick);
  const c = classAt(warp, px, py);
  return c !== REF_CLASS.EDGE_BAND && c !== REF_CLASS.RIM_FACE;
}

/** 04-16 (lens-critic m1): the rim note needs a drawn rim band at least this wide (CSS px). */
export const RIM_NOTE_MIN_PX = 12;

/**
 * 04-16 (m1): width (CSS px) of the widest drawn rim band in one panel. The rim rectangles (grid
 * cells and quadtree leaves of class 2 / 4, panel px) are rasterised at 1 px by pixel centre, then
 * a 3-4 chamfer distance transform gives each rim pixel its distance to the nearest non-rim pixel;
 * outside the panel counts as non-rim, so a band cut by the panel edge is measured as drawn.
 * Returns 2 · the largest distance: W or W + 1 for an axis-parallel band of W px, within about
 * 8 % for other directions (chamfer 3-4 vs Euclidean).
 * @param {ArrayLike<number>} rects [x, y, w, h, …] in panel px
 * @param {number} w panel width @param {number} h panel height
 */
export function rimBandPx(rects, w, h) {
  const W = Math.ceil(w);
  const H = Math.ceil(h);
  if (rects.length === 0 || W <= 0 || H <= 0) return 0;
  const BIG = 0xffff;
  const d = new Uint16Array(W * H);
  for (let r = 0; r + 3 < rects.length; r += 4) {
    const i0 = Math.max(0, Math.ceil(rects[r] - 0.5));
    const i1 = Math.min(W, Math.ceil(rects[r] + rects[r + 2] - 0.5));
    const j0 = Math.max(0, Math.ceil(rects[r + 1] - 0.5));
    const j1 = Math.min(H, Math.ceil(rects[r + 1] + rects[r + 3] - 0.5));
    for (let j = j0; j < j1; j++) d.fill(BIG, j * W + i0, j * W + i1);
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : d[j * W + i]);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (d[k] === 0) continue;
      d[k] = Math.min(d[k], at(i - 1, j) + 3, at(i, j - 1) + 3, at(i - 1, j - 1) + 4, at(i + 1, j - 1) + 4);
    }
  }
  let max = 0;
  for (let j = H - 1; j >= 0; j--) {
    for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      if (d[k] === 0) continue;
      d[k] = Math.min(d[k], at(i + 1, j) + 3, at(i, j + 1) + 3, at(i + 1, j + 1) + 4, at(i - 1, j + 1) + 4);
      if (d[k] > max) max = d[k];
    }
  }
  return (2 * max) / 3;
}
