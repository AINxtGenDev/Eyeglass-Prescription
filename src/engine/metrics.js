// ENG-06 metrics. Lens-local (boxing-centre) coordinates; surfaces are OC-relative internally.

import { frontSagAt, backSagAt } from "./design.js";
import { locationLabel, nasalSign } from "./conventions.js";
import { GL24 } from "./quadrature.js";

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

/** Index of the outline point farthest from the OC (first index on ties); same measure as maxRadiusFromOC. */
export function farthestIndexFromOC(outline, oc) {
  let m2 = -1;
  let iMax = 0;
  for (let i = 0; i < outline.length; i += 2) {
    const dx = outline[i] - oc.x;
    const dy = outline[i + 1] - oc.y;
    const r2 = dx * dx + dy * dy;
    if (r2 > m2) ((m2 = r2), (iMax = i / 2));
  }
  return iMax;
}

/**
 * Indices of the nasal (max nasalSign·x), temporal (min), superior (max y) and inferior (min y)
 * outline extremes; strict comparisons, so the first index wins on ties. Shared by metrics and sags.
 */
export function extremeIndices(outline, eye) {
  const n = outline.length / 2;
  const sign = nasalSign(eye);
  let iN = 0;
  let iT = 0;
  let iS = 0;
  let iI = 0;
  for (let i = 0; i < n; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    if (sign * x > sign * outline[2 * iN]) iN = i;
    if (sign * x < sign * outline[2 * iT]) iT = i;
    if (y > outline[2 * iS + 1]) iS = i;
    if (y < outline[2 * iI + 1]) iI = i;
  }
  return { nasal: iN, temporal: iT, superior: iS, inferior: iI };
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

/**
 * Tie tolerance for the reported etMax/etMin location (02-01, lens-critic round 2 MAJOR-1).
 * Thicknesses at mirrored outline points (x, ±y) are equal in exact arithmetic whenever the OC
 * lies on the box's horizontal mid-line and the cylinder axis is 0, 90 or 180 (or cyl = 0). In
 * floating point they differ by about 1e-16…1e-15 mm (measured 4,4e-16 mm at Achse 180; Achse 0
 * and 180 values differ by up to 7,1e-15 mm), so exact equality picked the reported corner by
 * noise, and Achse 0 and 180 (the same TABO axis) or the two eyes of a mirrored Rx got different
 * lay words. 1e-9 mm is six orders above that noise, eight orders below the 0,1 mm display step
 * and far below any real thickness difference between neighbouring outline samples.
 * Design constant, no optical meaning.
 */
export const TIE_TOL_MM = 1e-9;

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
  let iMax = 0;
  let iMin = 0;
  let tMax = -Infinity;
  let tMin = Infinity;
  let tSelMax = -Infinity;
  let tSelMin = Infinity;
  let fMax = -Infinity;
  let fMin = Infinity;
  for (let i = 0; i < n; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    const sF = frontSagAt(s, x, y);
    const t = s.ct - sF + backSagAt(s, x, y);
    // Reported values are the exact running max/min (bitwise as in phase 1).
    if (t > tMax) tMax = t;
    if (t < tMin) tMin = t;
    // The reported index is chosen separately: ties within TIE_TOL_MM (mirrored points (x, ±y))
    // go to the larger y, so OD and OS pick the same location label although the OS outline runs
    // through the points in mirrored order, and Achse 0 and 180 pick the same corner.
    if (
      t > tSelMax + TIE_TOL_MM ||
      (Math.abs(t - tSelMax) <= TIE_TOL_MM && y > outline[2 * iMax + 1])
    )
      ((tSelMax = t), (iMax = i));
    if (
      t < tSelMin - TIE_TOL_MM ||
      (Math.abs(t - tSelMin) <= TIE_TOL_MM && y > outline[2 * iMin + 1])
    )
      ((tSelMin = t), (iMin = i));
    if (sF > fMax) fMax = sF;
    if (sF < fMin) fMin = sF;
  }
  const {
    nasal: iN,
    temporal: iT,
    superior: iS,
    inferior: iI,
  } = extremeIndices(outline, eye);
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
    // value = exact max/min; the selected point's own thickness differs by at most TIE_TOL_MM.
    etMax: point(outline, iMax, tMax, eye),
    etMin: point(outline, iMin, tMin, eye),
    etAt: {
      nasal: at(iN),
      temporal: at(iT),
      superior: at(iS),
      inferior: at(iI),
    },
    volumeMm3: volume,
    weightG: (volume / 1000) * density,
    frontProtrusion: { max: fMax, min: fMin },
    mbsMm: 2 * maxRadiusFromOC(outline, s.oc) + 2,
    decentration: { x: s.oc.x, y: s.oc.y },
  };
}
