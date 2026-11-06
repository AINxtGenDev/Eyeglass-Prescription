// src/engine/conventions.js — the ONLY place signs and frames are defined.
//
// Units: mm, dioptres (1/m). K(n) = 1000·(n − 1)  [mm·D]
//
// Lens-local frame (examiner facing the wearer): origin = boxing centre of that lens,
//   +x = examiner's right (= wearer's LEFT), +y = up, +z = toward examiner / object side.
//   Light travels −z (object → eye). Right-handed; CCW is seen from +z (the examiner).
//
// TABO (ISO 8429): axis angle CCW from +x, IDENTICAL for OD and OS, engine range [0, 180).
//   Input 180 ≡ 0; display 0 as 180 (prescription convention).
//   [CITED: GB/T 40177-2021 = ISO 8429:1986]
//
// Nasal direction: OD nasal = +x, OS nasal = −x  → nasalSign = eye === 'OD' ? +1 : −1
//
// Optical centre (OC), lens-local:
//   oc = { x: nasalSign · ((A + DBL)/2 − monoPD), y: fittingHeight == null ? 0 : fittingHeight − B/2 }
//
// Surfaces (sags positive toward the eye; ρ measured from oc):
//   zFront(x,y) = −sF(ρ)            sF uses c1 = +D1/K          (convex front ⇒ c1 > 0)
//   zBack(x,y)  = −CT − sB(x,y)     sB uses c = −D2/K per principal meridian
//                                   (Cartesian: D2 = (1 − n)/R2; a concave meniscus back has
//                                    D2 < 0 ⇒ c > 0)
//   thickness t(x,y) = CT − sF + sB
//
// Only the frame SHAPE is mirrored for OS (src/engine/frame/outline.js mirrorOutlineX);
// the Rx is never mirrored.

/** @param {number} n refractive index  @returns {number} mm·D */
export const K = (n) => 1000 * (n - 1);

/** @param {'OD'|'OS'} eye  @returns {1|-1} */
export const nasalSign = (eye) => (eye === 'OD' ? 1 : -1);

const OCTANTS = [
  'temporal', // −180
  'temporal-inferior', // −135
  'inferior', // −90
  'nasal-inferior', // −45
  'nasal', // 0
  'nasal-superior', // 45
  'superior', // 90
  'temporal-superior', // 135
  'temporal', // 180
];

/**
 * Anatomical label of a lens-local point (relative to the boxing centre).
 * φ = atan2(y, nasalSign·x); octants of 45° centred on 0 (nasal), ±180 (temporal),
 * 90 (superior), −90 (inferior) and the four diagonals.
 * @param {number} x @param {number} y @param {'OD'|'OS'} eye
 */
export function locationLabel(x, y, eye) {
  const phi = (Math.atan2(y, nasalSign(eye) * x) * 180) / Math.PI;
  return OCTANTS[Math.round(phi / 45) + 4];
}
