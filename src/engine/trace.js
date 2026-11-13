// ENG-08 tier 3: Snell ray-trace oracle through the generated lens surfaces. Production module:
// reused by the phase-4 warp grid (CLAUDE.md: CPU ray-traced warp grid reusing engine surfaces).
//
// Oracle scope: the trace independently checks vector-Snell refraction at both surfaces, the
// CT/vertex-distance effect and the composition of the surface powers into the back-vertex power
// matrix. It SHARES with the engine the sag and gradient functions (sag.js, via frontSagAt/
// backSagAt and the gradient helpers in design.js), the axis rotation in design.js and the
// rxToMatrix convention it is compared against. It therefore cannot detect an error common to
// the surfaces and the oracle, e.g. a wrong torus orientation (paraxially invisible, RESEARCH
// Pitfall D) or a TABO convention error shared by design.js and rxToMatrix. Those are covered by
// the implicit-torus check, the tyre golden value and the TABO golden tests instead.
//
// Frame (conventions.js): light travels −z; front z = −sF(x, y), back z = −CT − sB(x, y).
// traceRay/traceBVP coordinates are relative to the OC (s.oc is the origin).
//
// Reverse trace (REF-01, D-12): traceFromEye starts at the eye point (oc.x, oc.y, −CT − h), h mm
// behind the back vertex, and travels +z toward the object: back surface first (η = 1/n, air →
// glass), then the front (η = n, glass → air). It uses the SAME Newton intersection and vector
// Snell code as traceRay (seed = vertex plane, normal oriented against the ray, so the direction
// of travel does not matter); only the null-returning cores are called, so it raises no exception and
// reports a TRACE_STATUS instead. Directions are tangents in the ENGINE frame (examiner view);
// the wearer-frame mirror (wx = −x) is done once in the warp grid, not here.

import { frontSagAt, backSagAt, frontSagGradAt, backSagGradAt } from './design.js';

const MAX_NEWTON = 20;
const NEWTON_TOL = 1e-13;

// Newton on h(t) = z(t) + zOff + sag(x(t), y(t)) = 0 along p + t·d (surface z = −zOff − sag).
// Returns null when it does not converge (sag NaN outside its domain ends as a non-finite step).
function intersectOrNull(p, d, zOff, sag, grad, s) {
  let t = (-zOff - p[2]) / d[2]; // seed: the vertex plane
  for (let i = 1; i <= MAX_NEWTON; i++) {
    const x = p[0] + t * d[0];
    const y = p[1] + t * d[1];
    const h = p[2] + t * d[2] + zOff + sag(s, x, y);
    const [gx, gy] = grad(s, x, y);
    const dh = d[2] + gx * d[0] + gy * d[1];
    const dt = h / dh;
    if (!Number.isFinite(dt)) break;
    t -= dt;
    if (Math.abs(dt) < NEWTON_TOL) {
      const q = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]];
      return { q, normal: [gx, gy, 1], iterations: i };
    }
  }
  return null;
}

function intersect(p, d, zOff, sag, grad, s) {
  const r = intersectOrNull(p, d, zOff, sag, grad, s);
  if (r === null) throw new Error('traceRay: surface intersection did not converge');
  return r;
}

// Vector Snell, eta = n_in / n_out; the normal is oriented against the ray. null on total
// internal reflection (k < 0).
function refractOrNull(d, normal, eta) {
  const len = Math.hypot(normal[0], normal[1], normal[2]);
  let nx = normal[0] / len;
  let ny = normal[1] / len;
  let nz = normal[2] / len;
  let cosi = -(nx * d[0] + ny * d[1] + nz * d[2]);
  if (cosi < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    cosi = -cosi;
  }
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  return [eta * d[0] + f * nx, eta * d[1] + f * ny, eta * d[2] + f * nz];
}

function refract(d, normal, eta) {
  const r = refractOrNull(d, normal, eta);
  if (r === null) throw new Error('traceRay: total internal reflection');
  return r;
}

/**
 * One ray parallel to −z at (x0, y0) relative to the OC, traced through front and back.
 * @returns {{ P: [number, number], slope: [number, number], iterations: [number, number] }}
 *   P relative to the OC at the back-vertex plane z = −CT; slope σ = (d_x, d_y)/(−d_z)
 */
export function traceRay(s, x0, y0) {
  const p0 = [s.oc.x + x0, s.oc.y + y0, 10];
  const d0 = [0, 0, -1];
  const f = intersect(p0, d0, 0, frontSagAt, frontSagGradAt, s);
  const d1 = refract(d0, f.normal, 1 / s.n);
  const b = intersect(f.q, d1, s.ct, backSagAt, backSagGradAt, s);
  const d2 = refract(d1, b.normal, s.n);
  const t = (-s.ct - b.q[2]) / d2[2];
  return {
    P: [b.q[0] + t * d2[0] - s.oc.x, b.q[1] + t * d2[1] - s.oc.y],
    slope: [d2[0] / -d2[2], d2[1] / -d2[2]],
    iterations: [f.iterations, b.iterations],
  };
}

/**
 * Back-vertex dioptric power matrix from a ring of parallel rays about the OC:
 * least-squares fit σ = M·P, F = −1000·M (1/mm → dpt), symmetrised.
 * @param {object} s surfaces (design() or LensResult.surfaces)
 * @param {{ h?: number, rays?: number }} [opts] ring radius mm, ray count
 * @returns {number[][]} 2×2 symmetric matrix in dpt
 */
export function traceBVP(s, { h = 0.25, rays = 16 } = {}) {
  let pxx = 0;
  let pxy = 0;
  let pyy = 0;
  let sxx = 0;
  let sxy = 0;
  let syx = 0;
  let syy = 0;
  for (let k = 0; k < rays; k++) {
    const a = (2 * Math.PI * k) / rays;
    const { P, slope } = traceRay(s, h * Math.cos(a), h * Math.sin(a));
    pxx += P[0] * P[0];
    pxy += P[0] * P[1];
    pyy += P[1] * P[1];
    sxx += slope[0] * P[0];
    sxy += slope[0] * P[1];
    syx += slope[1] * P[0];
    syy += slope[1] * P[1];
  }
  // M = S·G⁻¹ with S = Σ σ Pᵀ, G = Σ P Pᵀ
  const det = pxx * pyy - pxy * pxy;
  const i11 = pyy / det;
  const i12 = -pxy / det;
  const i22 = pxx / det;
  const m11 = sxx * i11 + sxy * i12;
  const m12 = sxx * i12 + sxy * i22;
  const m21 = syx * i11 + syy * i12;
  const m22 = syx * i12 + syy * i22;
  const off = (-1000 * (m12 + m21)) / 2;
  return [
    [-1000 * m11, off],
    [off, -1000 * m22],
  ];
}

export const TRACE_STATUS = Object.freeze({
  OK: 'ok',
  MISS_BACK: 'missBack',
  TIR_BACK: 'tirBack',
  MISS_FRONT: 'missFront',
  TIR_FRONT: 'tirFront',
});

/**
 * Reverse trace from the eye point toward the object (no exception on any input).
 * @param {object} s surfaces (design() or LensResult.surfaces)
 * @param {number} h mm from the back vertex to the eye point (EYE_POINT_MM in magnification.js)
 * @param {number} ex eye-side direction tangent d_x/d_z, engine frame
 * @param {number} ey eye-side direction tangent d_y/d_z, engine frame
 * @returns {{ status: string, back?: number[], front?: number[], objTan?: [number, number] }}
 *   back/front = lens-local hit points found so far; objTan = object-side tangents (status 'ok')
 */
export function traceFromEye(s, h, ex, ey) {
  const p = [s.oc.x, s.oc.y, -s.ct - h];
  const L = Math.hypot(ex, ey, 1);
  const d0 = [ex / L, ey / L, 1 / L];
  const b = intersectOrNull(p, d0, s.ct, backSagAt, backSagGradAt, s);
  if (b === null) return { status: TRACE_STATUS.MISS_BACK };
  const d1 = refractOrNull(d0, b.normal, 1 / s.n);
  if (d1 === null) return { status: TRACE_STATUS.TIR_BACK, back: b.q };
  const f = intersectOrNull(b.q, d1, 0, frontSagAt, frontSagGradAt, s);
  if (f === null) return { status: TRACE_STATUS.MISS_FRONT, back: b.q };
  const d2 = refractOrNull(d1, f.normal, s.n);
  if (d2 === null) return { status: TRACE_STATUS.TIR_FRONT, back: b.q, front: f.q };
  return { status: TRACE_STATUS.OK, back: b.q, front: f.q, objTan: [d2[0] / d2[2], d2[1] / d2[2]] };
}
