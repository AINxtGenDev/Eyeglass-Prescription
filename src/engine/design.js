// Thick-lens design (ENG-02). Surfaces are OC-relative: x' = x − oc.x, y' = y − oc.y.
// Signs per conventions.js: c1 = +D1/K (convex front), c = −D2/K per back principal meridian.

import { K } from './conventions.js';
import { sphereSag } from './sag.js';

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

/**
 * Back sag at lens-local (x, y). Sphere only in 01-02 (the torus arrives in 01-08);
 * evaluate rejects cyl ≠ 0 before this point.
 */
export function backSagAt(s, x, y) {
  if (s.ca !== s.cb) throw new Error('backSagAt: toric back surface not supported yet (01-08)');
  const dx = x - s.oc.x;
  const dy = y - s.oc.y;
  return sphereSag(s.ca, dx * dx + dy * dy);
}
