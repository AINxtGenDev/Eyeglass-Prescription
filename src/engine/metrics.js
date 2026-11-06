// ENG-06 metrics. Lens-local (boxing-centre) coordinates; surfaces are OC-relative internally.

import { frontSagAt, backSagAt } from './design.js';
import { locationLabel, nasalSign } from './conventions.js';
import { GL24 } from './quadrature.js';

const N_ANGLES = 128;

/** t = ct − sF + sB at lens-local (x, y). */
export function thicknessAt(s, x, y) {
  return s.ct - frontSagAt(s, x, y) + backSagAt(s, x, y);
}

/** ρmax = max |p − oc| over the outline points. */
export function maxRadiusFromOC(outline, oc) {
  let m2 = 0;
  for (let i = 0; i < outline.length; i += 2) {
    const dx = outline[i] - oc.x;
    const dy = outline[i + 1] - oc.y;
    const r2 = dx * dx + dy * dy;
    if (r2 > m2) m2 = r2;
  }
  return Math.sqrt(m2);
}

// Distance t > 0 from the origin along (c, s) to edge i of the outline, or −1 if the ray misses it.
// Small tolerance on u: a ray through a vertex must hit one of its two edges despite rounding.
function hitEdge(outline, n, i, c, s) {
  const k = i + 1 === n ? 0 : i + 1;
  const px = outline[2 * i];
  const py = outline[2 * i + 1];
  const ex = outline[2 * k] - px;
  const ey = outline[2 * k + 1] - py;
  const den = c * ey - s * ex;
  if (den === 0) return -1;
  const t = (px * ey - py * ex) / den;
  const u = (px * s - py * c) / den;
  return t > 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : -1;
}

// Radii R_j of the outline along increasing ray angles. The outline is CCW and star-shaped about
// the boxing centre (required by the polar quadrature), so the hit edge advances monotonically:
// march the edge pointer instead of testing every edge for every ray (O(n + angles)).
function outlineRadii(outline, cosA, sinA) {
  const n = outline.length / 2;
  const R = new Float64Array(cosA.length);
  let i = 0;
  for (let j = 0; j < cosA.length; j++) {
    let t = -1;
    for (let step = 0; step < n && t < 0; step++) {
      t = hitEdge(outline, n, i, cosA[j], sinA[j]);
      if (t < 0) i = i + 1 === n ? 0 : i + 1;
    }
    R[j] = Math.max(t, 0);
  }
  return R;
}

const COS = new Float64Array(N_ANGLES);
const SIN = new Float64Array(N_ANGLES);
for (let j = 0; j < N_ANGLES; j++) {
  COS[j] = Math.cos((2 * Math.PI * j) / N_ANGLES);
  SIN[j] = Math.sin((2 * Math.PI * j) / N_ANGLES);
}

function point(outline, i, value, eye) {
  const x = outline[2 * i];
  const y = outline[2 * i + 1];
  return { value, index: i, location: locationLabel(x, y, eye), x, y };
}

/**
 * @param {{ surfaces: object, outline: Float64Array, density: number, eye: 'OD'|'OS' }} p
 * @returns LensResult.metrics
 */
export function computeMetrics({ surfaces, outline, density, eye }) {
  const s = surfaces;
  const n = outline.length / 2;
  const sign = nasalSign(eye);
  let iMax = 0;
  let iMin = 0;
  let tMax = -Infinity;
  let tMin = Infinity;
  let fMax = -Infinity;
  let fMin = Infinity;
  let iN = 0;
  let iT = 0;
  let iS = 0;
  let iI = 0;
  for (let i = 0; i < n; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    const sF = frontSagAt(s, x, y);
    const t = s.ct - sF + backSagAt(s, x, y);
    if (t > tMax) (tMax = t), (iMax = i);
    if (t < tMin) (tMin = t), (iMin = i);
    if (sF > fMax) fMax = sF;
    if (sF < fMin) fMin = sF;
    if (sign * x > sign * outline[2 * iN]) iN = i;
    if (sign * x < sign * outline[2 * iT]) iT = i;
    if (y > outline[2 * iS + 1]) iS = i;
    if (y < outline[2 * iI + 1]) iI = i;
  }
  const at = (i) => thicknessAt(s, outline[2 * i], outline[2 * i + 1]);

  // Polar quadrature about the boxing centre: 128 uniform angles × GL24 radial nodes.
  const dPhi = (2 * Math.PI) / N_ANGLES;
  const radii = outlineRadii(outline, COS, SIN);
  let volume = 0;
  for (let j = 0; j < N_ANGLES; j++) {
    const c = COS[j];
    const sn = SIN[j];
    const R = radii[j];
    let acc = 0;
    for (let k = 0; k < GL24.x.length; k++) {
      const r = (R * (GL24.x[k] + 1)) / 2;
      acc += GL24.w[k] * thicknessAt(s, r * c, r * sn) * r;
    }
    volume += acc * (R / 2) * dPhi;
  }

  return {
    ct: s.ct,
    etMax: point(outline, iMax, tMax, eye),
    etMin: point(outline, iMin, tMin, eye),
    etAt: { nasal: at(iN), temporal: at(iT), superior: at(iS), inferior: at(iI) },
    volumeMm3: volume,
    weightG: (volume / 1000) * density,
    frontProtrusion: { max: fMax, min: fMin },
    mbsMm: 2 * maxRadiusFromOC(outline, s.oc) + 2,
    decentration: { x: s.oc.x, y: s.oc.y },
  };
}
