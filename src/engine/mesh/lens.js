// VIZ-01 (03-02): lens mesh builder, D-02/D-03. Pure JS, no Three.js, runs in Node and the worker.
// Every value comes from the engine's own surface functions (frontSagAt, backSagAt, their
// gradients, thicknessAt): there is no second copy of the optics here.
//
// Conventions (conventions.js): lens-local (boxing-centre) x, y in mm; zFront = −sF,
// zBack = −CT − sB, +z toward the examiner. Fixed topology from topology.js (RINGS × SPOKES),
// so buffer lengths never change. Normals are analytic (surface gradient); the edge band has its
// own vertices with in-plane outward normals, so no normal is averaged across the rim seam.

import { frontSagAt, backSagAt, frontSagGradAt, backSagGradAt } from '../design.js';
import { thicknessAt } from '../metrics.js';
import { RINGS, SPOKES, RING_FRAC, VERTS } from './topology.js';

/** Float32Array lengths of one lens mesh (positions/normals xyz, thickness scalar). */
export const LENS_LENGTHS = Object.freeze({
  front: VERTS * 3,
  frontN: VERTS * 3,
  back: VERTS * 3,
  backN: VERTS * 3,
  thick: VERTS,
  band: 2 * SPOKES * 3,
  bandN: 2 * SPOKES * 3,
});

/** One set of mesh buffers, allocated once and reused for every re-mesh. */
export function allocLensBuffers() {
  const out = {};
  for (const [k, len] of Object.entries(LENS_LENGTHS)) out[k] = new Float32Array(len);
  return out;
}

/**
 * In-plane outward unit normals of a CCW outline: at vertex i the normalised average of the
 * adjacent edge normals (ey, −ex). Writes 2 values per vertex into `out` and returns it.
 * @param {Float64Array} outline [x0, y0, …], CCW
 * @param {Float64Array|Float32Array} out length = outline.length
 */
export function outlineNormals(outline, out) {
  const n = outline.length / 2;
  for (let i = 0; i < n; i++) {
    const h = (i + n - 1) % n;
    const j = (i + 1) % n;
    const ex0 = outline[2 * i] - outline[2 * h];
    const ey0 = outline[2 * i + 1] - outline[2 * h + 1];
    const ex1 = outline[2 * j] - outline[2 * i];
    const ey1 = outline[2 * j + 1] - outline[2 * i + 1];
    const l0 = Math.hypot(ex0, ey0);
    const l1 = Math.hypot(ex1, ey1);
    const nx = ey0 / l0 + ey1 / l1;
    const ny = -ex0 / l0 - ex1 / l1;
    const L = Math.hypot(nx, ny);
    out[2 * i] = nx / L;
    out[2 * i + 1] = ny / L;
  }
  return out;
}

const RIM_N = new Float64Array(2 * SPOKES);

/**
 * Build one lens mesh into the fixed-length buffers `out` (from allocLensBuffers).
 * @param {{ n: number, ct: number, c1: number, k1: number, ca: number, cb: number,
 *           axisRad: number, oc: { x: number, y: number } }} s LensResult.surfaces
 * @param {Float64Array} outline the engine's 720-point frameOutline for the same eye
 * @param {ReturnType<typeof allocLensBuffers>} out
 * @returns {{ finite: boolean, boundingSphere: { x: number, y: number, z: number, r: number } }}
 *   finite = false when any value is non-finite (the view must not upload the mesh)
 */
export function buildLensMesh(s, outline, out) {
  if (outline.length !== 2 * SPOKES) throw new Error('buildLensMesh: outline must have 720 points');
  for (const [k, len] of Object.entries(LENS_LENGTHS)) {
    if (out[k]?.length !== len) throw new Error(`buildLensMesh: out.${k} must have length ${len}`);
  }
  const { front, frontN, back, backN, thick, band, bandN } = out;
  let finite = true;
  let maxR2 = 0;
  let zMax = -Infinity;
  let zMin = Infinity;
  let p = 0;
  for (let k = 0; k <= RINGS; k++) {
    const f = RING_FRAC[k];
    const m = k === 0 ? 1 : SPOKES;
    for (let i = 0; i < m; i++, p++) {
      const x = f * outline[2 * i];
      const y = f * outline[2 * i + 1];
      const sF = frontSagAt(s, x, y);
      const sB = backSagAt(s, x, y);
      const [fx, fy] = frontSagGradAt(s, x, y);
      const [bx, by] = backSagGradAt(s, x, y);
      const t = thicknessAt(s, x, y);
      if (!Number.isFinite(s.ct + sF + sB + fx + fy + bx + by + t + x + y)) finite = false;
      const q = 3 * p;
      front[q] = x;
      front[q + 1] = y;
      front[q + 2] = -sF;
      back[q] = x;
      back[q + 1] = y;
      back[q + 2] = -s.ct - sB;
      let L = Math.hypot(fx, fy, 1);
      frontN[q] = fx / L;
      frontN[q + 1] = fy / L;
      frontN[q + 2] = 1 / L;
      L = Math.hypot(bx, by, 1);
      backN[q] = -bx / L;
      backN[q + 1] = -by / L;
      backN[q + 2] = -1 / L;
      thick[p] = t;
      // bounds from the stored Float32 values, so the sphere contains what is drawn
      const r2 = front[q] * front[q] + front[q + 1] * front[q + 1];
      if (r2 > maxR2) maxR2 = r2;
      zMax = Math.max(zMax, front[q + 2], back[q + 2]);
      zMin = Math.min(zMin, front[q + 2], back[q + 2]);
    }
  }
  // Edge band: own copies of the outer ring (spoke i = outline point i), outward in-plane normals.
  outlineNormals(outline, RIM_N);
  const rim = 3 * (1 + (RINGS - 1) * SPOKES);
  for (let i = 0; i < SPOKES; i++) {
    const src = rim + 3 * i;
    const qf = 3 * i;
    const qb = 3 * (SPOKES + i);
    for (let d = 0; d < 3; d++) {
      band[qf + d] = front[src + d];
      band[qb + d] = back[src + d];
    }
    bandN[qf] = bandN[qb] = RIM_N[2 * i];
    bandN[qf + 1] = bandN[qb + 1] = RIM_N[2 * i + 1];
    bandN[qf + 2] = bandN[qb + 2] = 0;
  }
  const half = (zMax - zMin) / 2;
  return {
    finite,
    boundingSphere: { x: 0, y: 0, z: (zMax + zMin) / 2, r: Math.sqrt(maxR2 + half * half) },
  };
}
