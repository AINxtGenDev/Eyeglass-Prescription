// Thick-lens design (ENG-02). Surfaces are OC-relative: x' = x − oc.x, y' = y − oc.y.
// Signs per conventions.js: c1 = +D1/K (convex front), c = −D2/K per back principal meridian.

import { K } from './conventions.js';
import { sphereSag, torusSag, sphereSagGrad, torusSagGrad } from './sag.js';

/**
 * The Rx is a back-vertex power. The front is spherical, so
 * D1v = D1/(1 − (ct/1000)/n·D1); D2a = sph − D1v (along the axis), D2b = sph + cyl − D1v (⟂ axis).
 * @param {{ sph: number, cyl: number, axisDeg: number, n: number, D1: number, k1?: number,
 *           ct: number, oc: { x: number, y: number } }} p
 */
export function design({ sph, cyl, axisDeg, n, D1, k1 = 0, ct, oc }) {
  const k = K(n);
  const t = ct / 1000;
  const D1v = D1 / (1 - (t / n) * D1);
  const D2a = sph - D1v;
  const D2b = sph + cyl - D1v;
  return {
    n,
    ct,
    c1: D1 / k,
    k1,
    ca: -D2a / k,
    cb: -D2b / k,
    axisRad: (axisDeg * Math.PI) / 180,
    oc,
    D1,
    D1v,
    D2a,
    D2b,
  };
}

/** Front sag at lens-local (x, y); NaN outside the front's domain. */
export function frontSagAt(s, x, y) {
  const dx = x - s.oc.x;
  const dy = y - s.oc.y;
  return sphereSag(s.c1, dx * dx + dy * dy, s.k1);
}

// Axis coordinates relative to the OC (TABO angle α, CCW from +x, same for both eyes):
// u = x′cosα + y′sinα (along the cylinder axis), v = −x′sinα + y′cosα.
function axisUV(s, x, y) {
  const dx = x - s.oc.x;
  const dy = y - s.oc.y;
  const c = Math.cos(s.axisRad);
  const sn = Math.sin(s.axisRad);
  return [dx * c + dy * sn, -dx * sn + dy * c];
}

/**
 * Back sag at lens-local (x, y): tyre torus (sag.js, D-03) with the base curve ca along the
 * cylinder axis and the cross curve cb perpendicular to it. NaN outside the domain.
 */
export function backSagAt(s, x, y) {
  const [u, v] = axisUV(s, x, y);
  return torusSag(s.ca, s.cb, u, v);
}

/** Front sag gradient [∂sF/∂x, ∂sF/∂y] at lens-local (x, y). */
export function frontSagGradAt(s, x, y) {
  return sphereSagGrad(s.c1, x - s.oc.x, y - s.oc.y, s.k1);
}

/** Back sag gradient [∂sB/∂x, ∂sB/∂y] at lens-local (x, y) (rotated back from u/v by α). */
export function backSagGradAt(s, x, y) {
  const [u, v] = axisUV(s, x, y);
  const [gu, gv] = torusSagGrad(s.ca, s.cb, u, v);
  const c = Math.cos(s.axisRad);
  const sn = Math.sin(s.axisRad);
  return [gu * c - gv * sn, gu * sn + gv * c];
}
