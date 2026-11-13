// Outline geometry for the Durchblick warp grid (REF-01, 04-03). Pure JS, no DOM, no Three.js.
// Outlines are the frameOutline format: CCW Float64Array [x0, y0, x1, y1, …], lens-local mm.

/**
 * Even-odd ray test: is (px, py) inside the closed outline polygon?
 * Lifted from evaluate.js insideOutline; evaluate.js and profile.js keep their private copies in
 * phase 4 (surgical rule, a later clean-up).
 */
export function insideOutline(outline, px, py) {
  let inside = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i];
    const yi = outline[2 * i + 1];
    const xj = outline[2 * j];
    const yj = outline[2 * j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Squared distance from (px, py) to the nearest polygon edge. */
function minEdgeDist2(outline, px, py) {
  let best = Infinity;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = outline[2 * j];
    const ay = outline[2 * j + 1];
    const ex = outline[2 * i] - ax;
    const ey = outline[2 * i + 1] - ay;
    const wx = px - ax;
    const wy = py - ay;
    const L2 = ex * ex + ey * ey;
    let t = L2 > 0 ? (wx * ex + wy * ey) / L2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = wx - t * ex;
    const dy = wy - t * ey;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return best;
}

/**
 * Signed distance from (px, py) to the outline polygon in mm: negative inside, positive outside.
 * @param {ArrayLike<number>} outline @param {number} px @param {number} py
 */
export function signedDistanceToOutline(outline, px, py) {
  const d = Math.sqrt(minEdgeDist2(outline, px, py));
  return insideOutline(outline, px, py) ? -d : d;
}

/**
 * Smallest and largest distance from (ox, oy) to the outline boundary (fast paths of the warp
 * grid: with (ox, oy) inside, a point closer than rMin is inside; any point farther than
 * rMax + w is more than w outside).
 * @returns {{ rMin: number, rMax: number }}
 */
export function outlineRadii(outline, ox, oy) {
  let rMax = 0;
  for (let i = 0; i < outline.length; i += 2) {
    const r = Math.hypot(outline[i] - ox, outline[i + 1] - oy);
    if (r > rMax) rMax = r;
  }
  return { rMin: Math.sqrt(minEdgeDist2(outline, ox, oy)), rMax };
}
