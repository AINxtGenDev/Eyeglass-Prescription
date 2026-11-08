// VIZ-02 (03-03, D-06): parametric frame builder. Pure JS, no Three.js, runs in Node and the worker.
// The frame comes from the same inputs as the numbers: shape, A, B and DBL (the same frameOutline
// as evaluateLens), each eye's surfaces (the rim follows that lens's bevel curve, rim.js
// bevelApexMm), the rim depth and the temple length.
//
// World axes (UI-SPEC "Axes"): origin = bridge centre in the frame front plane, +y up, +z toward
// the viewer, OD boxing centre at x = −(A + DBL)/2, OS at +(A + DBL)/2, temples toward −z.
// Buffer frames:
//   rimOD/rimOS: x, y lens-local (the view places each rim in a group at boxingCentreX), z world
//     (lensZ included). The view shifts that eye's lens group by the same lensZ.
//   bridge, temples, hinges: world.
// Fixed topology: every buffer has its FRAME_LENGTHS length for every shape, size and eye.

import { bevelApexMm, BEVEL_RULE } from '../rim.js';
import { frontSagAt, backSagAt } from '../design.js';
import { thicknessAt, extremeIndices } from '../metrics.js';
import { frameOutline } from '../frame/outline.js';
import { nasalSign } from '../conventions.js';
import { outlineNormals } from './lens.js';
import { SPOKES } from './topology.js';

// [ASSUMED, UI-SPEC design value] rim face width, outward from the lens outline.
export const FRAME_FACE_MM = 4;
// [ASSUMED] the rim's inner lip covers the bevel, so the lens edge band is hidden inside the
// groove and never z-fights with the rim wall.
export const RIM_LIP_MM = 0.5;
// D-06: temple length when the stamp gives none.
export const TEMPLE_DEFAULT_MM = 140;
// [ASSUMED, from memory, unverified: common adult and child temple lengths] The stamp accepts any
// 2–3 digit temple (parse.js STAMP, 00…999); the drawing clamps to this range so a typo never
// gives a temple through the chart plane or shorter than the earpiece.
export const TEMPLE_RANGE_MM = Object.freeze([110, 160]);
// [ASSUMED, UI-SPEC design values] earpiece bend and temple opening (95° to the frame front).
export const EARPIECE_MM = 35;
export const EARPIECE_BEND_DEG = 30;
export const TEMPLE_SPLAY_DEG = 5;
// [ASSUMED] end-piece position: polar angle in the nasal-oriented frame φ = atan2(y, nasalSign·x),
// temporal-superior.
export const END_PIECE_DEG = 160;
// [ASSUMED] bridge arch height over the straight line between the nasal extremes.
export const BRIDGE_ARCH_MM = 3;
// [ASSUMED] sections: bridge 3 mm high × rim depth deep; temple 5 mm high × 2,5 mm wide; hinge
// box 6 × 6 × rim depth, 3 mm temporal of the outer rim point.
export const BRIDGE_HEIGHT_MM = 3;
export const TEMPLE_HEIGHT_MM = 5;
export const TEMPLE_WIDTH_MM = 2.5;
export const HINGE_MM = 6;
export const HINGE_OFFSET_MM = 3;
// [ASSUMED, UI-SPEC design value] the eye chart plane is centred at z = −CHART_DISTANCE_MM.
export const CHART_DISTANCE_MM = 200;

export const RIM_VERTS = 8 * SPOKES;
export const BRIDGE_RINGS = 33;
export const TEMPLE_STRAIGHT_SEGS = 40;
export const TEMPLE_BEND_SEGS = 8;
export const TEMPLE_RINGS = TEMPLE_STRAIGHT_SEGS + TEMPLE_BEND_SEGS + 1;
const RING = 8;
const HINGE_VERTS = 24;

/** Float32Array lengths of the frame mesh buffers (positions and normals, xyz). */
export const FRAME_LENGTHS = Object.freeze({
  rimOD: RIM_VERTS * 3,
  rimODN: RIM_VERTS * 3,
  rimOS: RIM_VERTS * 3,
  rimOSN: RIM_VERTS * 3,
  bridge: BRIDGE_RINGS * RING * 3,
  bridgeN: BRIDGE_RINGS * RING * 3,
  templeOD: TEMPLE_RINGS * RING * 3,
  templeODN: TEMPLE_RINGS * RING * 3,
  templeOS: TEMPLE_RINGS * RING * 3,
  templeOSN: TEMPLE_RINGS * RING * 3,
  hingeOD: HINGE_VERTS * 3,
  hingeODN: HINGE_VERTS * 3,
  hingeOS: HINGE_VERTS * 3,
  hingeOSN: HINGE_VERTS * 3,
});

/** One set of frame buffers, allocated once and reused for every re-mesh. */
export function allocFrameBuffers() {
  const out = {};
  for (const [k, len] of Object.entries(FRAME_LENGTHS)) out[k] = new Float32Array(len);
  return out;
}

/** World x of an eye's boxing centre: OD −(A + DBL)/2, OS +(A + DBL)/2. */
export const boxingCentreX = (eye, A, DBL) => (-nasalSign(eye) * (A + DBL)) / 2;

/** The temple length the frame is drawn with: the stamp value clamped to TEMPLE_RANGE_MM. */
export const templeDrawnMm = (templeMm = TEMPLE_DEFAULT_MM) =>
  Math.min(TEMPLE_RANGE_MM[1], Math.max(TEMPLE_RANGE_MM[0], templeMm));

// Rim: per outline point 8 vertices, 2 per face, so every face has its own flat normal:
// 0/1 front face inner/outer, 2/3 outer wall front/back, 4/5 back face outer/inner,
// 6/7 inner wall back/front. Face f, vertices a = 2f, b = 2f + 1: triangles (a_i, b_i, b_j) and
// (a_i, b_j, a_j), j = i + 1 (the loop closes 719 → 0), outward for a CCW outline.
export const RIM_INDEX = new Uint16Array(SPOKES * 4 * 6);
for (let i = 0, t = 0; i < SPOKES; i++) {
  const j = (i + 1) % SPOKES;
  for (let f = 0; f < 4; f++) {
    const ai = 8 * i + 2 * f;
    const aj = 8 * j + 2 * f;
    RIM_INDEX.set([ai, ai + 1, aj + 1, ai, aj + 1, aj], t);
    t += 6;
  }
}

// Tubes (bridge, temples): ring k has 8 vertices, corners C0 C1 | C1 C2 | C2 C3 | C3 C0 (see
// writeRing). Face f, a = 8k + 2f, b = a + 1: triangles (a_k, b_{k+1}, b_k), (a_k, a_{k+1}, b_{k+1}).
// The tube ends are open: they sit inside the rim or the hinge box.
function tubeIndex(rings) {
  const idx = new Uint16Array((rings - 1) * 4 * 6);
  for (let k = 0, t = 0; k < rings - 1; k++) {
    for (let f = 0; f < 4; f++) {
      const a0 = RING * k + 2 * f;
      const a1 = a0 + RING;
      idx.set([a0, a1 + 1, a0 + 1, a0, a1, a1 + 1], t);
      t += 6;
    }
  }
  return idx;
}
export const BRIDGE_INDEX = tubeIndex(BRIDGE_RINGS);
export const TEMPLE_INDEX = tubeIndex(TEMPLE_RINGS);

// Hinge box: 6 faces × 4 corners, CCW seen from outside.
export const HINGE_INDEX = new Uint16Array(36);
for (let f = 0; f < 6; f++) HINGE_INDEX.set([4 * f, 4 * f + 1, 4 * f + 2, 4 * f, 4 * f + 2, 4 * f + 3], 6 * f);

const NRM = new Float64Array(2 * SPOKES);
const ZC = { OD: new Float64Array(SPOKES), OS: new Float64Array(SPOKES) };
const DEG = Math.PI / 180;

const put = (a, k, x, y, z) => {
  a[3 * k] = x;
  a[3 * k + 1] = y;
  a[3 * k + 2] = z;
};

/**
 * Rim of one eye. Rim centre z at outline point i (lens-local) = apex_i = zFront_i − bevelApexMm(t_i)
 * = −sF_i − bevelApexMm(t_i); the rim spans apex ± D/2 (rim.js assumption A1).
 * Common rim plane (lens-critic MINOR 9): lensZ = −mean_i(apex_i), so both rims share the mean-apex
 * plane z = 0; a real frame front is one rigid part, so the lens with the deeper bevel sits
 * further forward, not its rim. A blocked eye (s = null) has apex 0 and lensZ 0.
 */
function buildRim(eye, s, outline, D, rule, pos, nor) {
  outlineNormals(outline, NRM);
  const zc = ZC[eye];
  let sum = 0;
  for (let i = 0; i < SPOKES; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    zc[i] = s == null ? 0 : -frontSagAt(s, x, y) - bevelApexMm(thicknessAt(s, x, y), rule);
    sum += zc[i];
  }
  const lensZ = s == null ? 0 : -sum / SPOKES;
  for (let i = 0; i < SPOKES; i++) zc[i] += lensZ;
  const mid = (FRAME_FACE_MM - RIM_LIP_MM) / 2;
  for (let i = 0; i < SPOKES; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    const nx = NRM[2 * i];
    const ny = NRM[2 * i + 1];
    const xi = x - RIM_LIP_MM * nx;
    const yi = y - RIM_LIP_MM * ny;
    const xo = x + FRAME_FACE_MM * nx;
    const yo = y + FRAME_FACE_MM * ny;
    const zf = zc[i] + D / 2;
    const zb = zc[i] - D / 2;
    const v = 8 * i;
    put(pos, v, xi, yi, zf);
    put(pos, v + 1, xo, yo, zf);
    put(pos, v + 2, xo, yo, zf);
    put(pos, v + 3, xo, yo, zb);
    put(pos, v + 4, xo, yo, zb);
    put(pos, v + 5, xi, yi, zb);
    put(pos, v + 6, xi, yi, zb);
    put(pos, v + 7, xi, yi, zf);
    // Face normal: radial × along-outline tangent of the face midline (central difference).
    const h = (i + SPOKES - 1) % SPOKES;
    const j = (i + 1) % SPOKES;
    const tx = outline[2 * j] + mid * NRM[2 * j] - outline[2 * h] - mid * NRM[2 * h];
    const ty = outline[2 * j + 1] + mid * NRM[2 * j + 1] - outline[2 * h + 1] - mid * NRM[2 * h + 1];
    const tz = zc[j] - zc[h];
    let fx = ny * tz;
    let fy = -nx * tz;
    let fz = nx * ty - ny * tx;
    const L = Math.sign(fz) * Math.hypot(fx, fy, fz); // orient +z
    fx /= L;
    fy /= L;
    fz /= L;
    put(nor, v, fx, fy, fz);
    put(nor, v + 1, fx, fy, fz);
    put(nor, v + 2, nx, ny, 0);
    put(nor, v + 3, nx, ny, 0);
    put(nor, v + 4, -fx, -fy, -fz);
    put(nor, v + 5, -fx, -fy, -fz);
    put(nor, v + 6, -nx, -ny, 0);
    put(nor, v + 7, -nx, -ny, 0);
  }
  return lensZ;
}

/**
 * Tube ring k: rectangular section about centre c, swept along the unit tangent T.
 * U = ŷ made perpendicular to T (section "up"), W = T × U; half sizes hu along U, hw along W.
 * Corners C0 = +U +W, C1 = +U −W, C2 = −U −W, C3 = −U +W; faces (C0 C1) +U, (C1 C2) −W,
 * (C2 C3) −U, (C3 C0) +W.
 */
function writeRing(pos, nor, k, c, T, hu, hw) {
  const d = T[1];
  let ux = -d * T[0];
  let uy = 1 - d * T[1];
  let uz = -d * T[2];
  const L = Math.hypot(ux, uy, uz);
  ux /= L;
  uy /= L;
  uz /= L;
  const wx = T[1] * uz - T[2] * uy;
  const wy = T[2] * ux - T[0] * uz;
  const wz = T[0] * uy - T[1] * ux;
  const corner = (su, sw) => [c[0] + su * hu * ux + sw * hw * wx, c[1] + su * hu * uy + sw * hw * wy, c[2] + su * hu * uz + sw * hw * wz];
  const C = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
  const N = [
    [ux, uy, uz],
    [-wx, -wy, -wz],
    [-ux, -uy, -uz],
    [wx, wy, wz],
  ];
  for (let f = 0; f < 4; f++) {
    const v = RING * k + 2 * f;
    put(pos, v, ...C[f]);
    put(pos, v + 1, ...C[(f + 1) % 4]);
    put(nor, v, ...N[f]);
    put(nor, v + 1, ...N[f]);
  }
}

/** Axis-aligned box about c with half sizes h = [hx, hy, hz], 4 vertices per face. */
function writeBox(pos, nor, c, h) {
  let v = 0;
  for (let a = 0; a < 3; a++) {
    for (const sgn of [1, -1]) {
      // u × v = sgn · e_a, so the corner order below is CCW seen from outside
      let ua = (a + 1) % 3;
      let va = (a + 2) % 3;
      if (sgn < 0) [ua, va] = [va, ua];
      for (const [su, sv] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const p = [c[0], c[1], c[2]];
        p[a] += sgn * h[a];
        p[ua] += su * h[ua];
        p[va] += sv * h[va];
        const n = [0, 0, 0];
        n[a] = sgn;
        put(pos, v, ...p);
        put(nor, v, ...n);
        v++;
      }
    }
  }
}

/** Axis-aligned box accumulator over world points. */
const emptyBox = () => ({ min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } });
function addPoint(b, x, y, z) {
  b.min.x = Math.min(b.min.x, x);
  b.min.y = Math.min(b.min.y, y);
  b.min.z = Math.min(b.min.z, z);
  b.max.x = Math.max(b.max.x, x);
  b.max.y = Math.max(b.max.y, y);
  b.max.z = Math.max(b.max.z, z);
}
function addArray(b, a, dx) {
  for (let q = 0; q < a.length; q += 3) addPoint(b, a[q] + dx, a[q + 1], a[q + 2]);
}

/** World AABB of the parts [array, dx], from the stored values. */
function boxOf(parts) {
  const b = emptyBox();
  for (const [a, dx] of parts) addArray(b, a, dx);
  return b;
}

/** Sphere about the centre of the AABB of the parts [array, dx], from the stored values. */
function sphereOf(parts) {
  const b = boxOf(parts);
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  let r2 = 0;
  for (const [a, dx] of parts) {
    for (let q = 0; q < a.length; q += 3) {
      const ex = a[q] + dx - cx;
      const ey = a[q + 1] - cy;
      const ez = a[q + 2] - cz;
      r2 = Math.max(r2, ex * ex + ey * ey + ez * ez);
    }
  }
  return { x: cx, y: cy, z: cz, r: Math.sqrt(r2) };
}

/**
 * Build the frame into the fixed-length buffers `out` (from allocFrameBuffers; any typed array of
 * the right length works, the tests use Float64Array).
 * @param {{ frame: { shape: string, A: number, B: number, DBL: number },
 *   eyes: { OD: object|null, OS: object|null }, rimDepthMm: number, templeMm?: number,
 *   rule?: string }} p eyes = LensResult.surfaces per eye, null = blocked eye (flat rim)
 * @param {ReturnType<typeof allocFrameBuffers>} out
 * @returns {{ finite: boolean, boundingSphere: {x:number,y:number,z:number,r:number},
 *   frontBoundingSphere: {x:number,y:number,z:number,r:number},
 *   boundingBox: { min: {x:number,y:number,z:number}, max: {x:number,y:number,z:number} },
 *   sideTarget: { OD: {x:number,y:number,z:number}, OS: {x:number,y:number,z:number} },
 *   eyeBox: { OD: { min: {x:number,y:number,z:number}, max: {x:number,y:number,z:number} }, OS: object },
 *   lensZ: { OD: number, OS: number }, templeMm: number }}
 *   finite = false when any value is non-finite (the view must not upload the mesh);
 *   frontBoundingSphere covers the rims and the bridge; boundingBox = the world AABB of every frame
 *   vertex (03-09 A1: the default camera fits its projected corners); templeMm = the drawn
 *   (clamped) length.
 */
export function buildFrameMesh({ frame, eyes, rimDepthMm: D, templeMm, rule = BEVEL_RULE }, out) {
  for (const [k, len] of Object.entries(FRAME_LENGTHS)) {
    if (out[k]?.length !== len) throw new Error(`buildFrameMesh: out.${k} must have length ${len}`);
  }
  const { shape, A, B, DBL } = frame;
  const temple = templeDrawnMm(templeMm);
  const lensZ = {};
  const outline = {};
  const bx = {};
  const sideTarget = {};
  const eyeBox = {};
  const ends = {};
  for (const eye of ['OD', 'OS']) {
    const o = frameOutline(shape, A, B, eye);
    outline[eye] = o;
    bx[eye] = boxingCentreX(eye, A, DBL);
    lensZ[eye] = buildRim(eye, eyes[eye], o, D, rule, out[`rim${eye}`], out[`rim${eye}N`]);
    const zc = ZC[eye];
    // NRM still holds this eye's outline normals (buildRim).
    const ext = extremeIndices(o, eye);
    const iT = ext.temporal;
    sideTarget[eye] = {
      x: bx[eye] + o[2 * iT] + FRAME_FACE_MM * NRM[2 * iT],
      y: o[2 * iT + 1] + FRAME_FACE_MM * NRM[2 * iT + 1],
      z: zc[iT],
    };
    const iN = ext.nasal;
    ends[eye] = [bx[eye] + o[2 * iN], o[2 * iN + 1], zc[iN]];

    // Hinge and temple at the end piece (the outline vertex with φ closest to END_PIECE_DEG).
    const ns = nasalSign(eye);
    let iE = 0;
    let best = Infinity;
    for (let i = 0; i < SPOKES; i++) {
      const phi = Math.atan2(o[2 * i + 1], ns * o[2 * i]) / DEG;
      const d = Math.abs(phi - END_PIECE_DEG);
      if (d < best) (best = d), (iE = i);
    }
    const ts = -ns; // temporal direction in world x
    const H = [
      bx[eye] + o[2 * iE] + FRAME_FACE_MM * NRM[2 * iE] + ts * HINGE_OFFSET_MM,
      o[2 * iE + 1] + FRAME_FACE_MM * NRM[2 * iE + 1],
      zc[iE],
    ];
    writeBox(out[`hinge${eye}`], out[`hinge${eye}N`], H, [HINGE_MM / 2, HINGE_MM / 2, D / 2]);
    const sp = TEMPLE_SPLAY_DEG * DEG;
    const bd = EARPIECE_BEND_DEG * DEG;
    const d1 = [ts * Math.sin(sp), 0, -Math.cos(sp)];
    const d2 = [Math.cos(bd) * d1[0], -Math.sin(bd), Math.cos(bd) * d1[2]];
    const Ls = temple - EARPIECE_MM;
    const K = [H[0] + Ls * d1[0], H[1], H[2] + Ls * d1[2]];
    const bis = [d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]];
    const bl = Math.hypot(...bis);
    const tp = out[`temple${eye}`];
    const tn = out[`temple${eye}N`];
    for (let k = 0; k < TEMPLE_RINGS; k++) {
      if (k <= TEMPLE_STRAIGHT_SEGS) {
        const u = (Ls * k) / TEMPLE_STRAIGHT_SEGS;
        const c = [H[0] + u * d1[0], H[1], H[2] + u * d1[2]];
        if (k < TEMPLE_STRAIGHT_SEGS) writeRing(tp, tn, k, c, d1, TEMPLE_HEIGHT_MM / 2, TEMPLE_WIDTH_MM / 2);
        // the kink ring: bisector tangent, height scaled by the miter factor 1/cos(bend/2)
        else writeRing(tp, tn, k, c, bis.map((v) => v / bl), TEMPLE_HEIGHT_MM / 2 / Math.cos(bd / 2), TEMPLE_WIDTH_MM / 2);
      } else {
        const u = (EARPIECE_MM * (k - TEMPLE_STRAIGHT_SEGS)) / TEMPLE_BEND_SEGS;
        writeRing(tp, tn, k, [K[0] + u * d2[0], K[1] + u * d2[1], K[2] + u * d2[2]], d2, TEMPLE_HEIGHT_MM / 2, TEMPLE_WIDTH_MM / 2);
      }
    }

    // eyeBox (lens-critic MAJOR 2): the eye's rim plus its lens front/back at the outline and the OC.
    const box = emptyBox();
    addArray(box, out[`rim${eye}`], bx[eye]);
    const s = eyes[eye];
    if (s != null) {
      const lz = lensZ[eye];
      const lensPoint = (x, y) => {
        addPoint(box, x + bx[eye], y, -frontSagAt(s, x, y) + lz);
        addPoint(box, x + bx[eye], y, -s.ct - backSagAt(s, x, y) + lz);
      };
      for (let i = 0; i < SPOKES; i++) lensPoint(o[2 * i], o[2 * i + 1]);
      lensPoint(s.oc.x, s.oc.y);
    }
    eyeBox[eye] = box;
  }

  // Bridge (world): from the OD nasal extreme (x = −DBL/2) to the OS one (x = +DBL/2), arched up
  // by BRIDGE_ARCH_MM; z runs linearly between the rim apex z at the two extremes.
  const [P0, P1] = [ends.OD, ends.OS];
  const last = BRIDGE_RINGS - 1;
  for (let k = 0; k <= last; k++) {
    const u = k / last;
    const c = [
      P0[0] + u * (P1[0] - P0[0]),
      P0[1] + u * (P1[1] - P0[1]) + BRIDGE_ARCH_MM * 4 * u * (1 - u),
      P0[2] + u * (P1[2] - P0[2]),
    ];
    const T = [P1[0] - P0[0], P1[1] - P0[1] + BRIDGE_ARCH_MM * 4 * (1 - 2 * u), P1[2] - P0[2]];
    const L = Math.hypot(...T);
    writeRing(out.bridge, out.bridgeN, k, c, T.map((v) => v / L), BRIDGE_HEIGHT_MM / 2, D / 2);
  }

  const front = [
    [out.rimOD, bx.OD],
    [out.rimOS, bx.OS],
    [out.bridge, 0],
  ];
  const all = [...front, ...['templeOD', 'templeOS', 'hingeOD', 'hingeOS'].map((k) => [out[k], 0])];
  let finite = Number.isFinite(lensZ.OD + lensZ.OS + temple);
  for (const k of Object.keys(FRAME_LENGTHS)) {
    if (finite) finite = out[k].every(Number.isFinite);
  }
  return {
    finite,
    boundingSphere: sphereOf(all),
    frontBoundingSphere: sphereOf(front),
    boundingBox: boxOf(all),
    sideTarget,
    eyeBox,
    lensZ,
    templeMm: temple,
  };
}
