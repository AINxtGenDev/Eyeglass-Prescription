// REF-01 spectacle magnification per principal meridian (D-04, D-05, D-12 b/c/e).
//
// M = 1/(1 − (t/n)·D1)  ×  1/(1 − h·F)
//     └─ shape factor ─┘     └ power factor ┘
// t = centre thickness (m), n = refractive index, D1 = front surface power at the vertex (dpt),
// F = back-vertex power of the meridian (dpt), h = back vertex → eye point (m).
//
// Derivation (ray-transfer matrices, 04-RESEARCH Pattern 2): reduced thickness τ = t/n. The lens
// matrix from front to back is L = R(F2)·T(τ)·R(F1) = [[A, τ], [−Fe, D]] with A = 1 − τF1,
// Fe = F1 + F2 − τF1F2, det L = 1. Add the transfer h to the eye point, S = T(h)·L, and require the
// chief ray to cross the axis there: u_E/u_0 = 1/(A − h·Fe). With Fv = Fe/A this is
// M = 1/[(1 − τF1)(1 − h·Fv)]. The front is spherical (or a conic with vertex curvature c1, the
// same paraxially) and the back a tyre torus, so the system separates into the two principal
// meridians of the back: F = Sph along the cylinder axis and F = Sph + Cyl perpendicular to it
// (design.js: D2a = Sph − D1v along the axis, D2b = Sph + Cyl − D1v perpendicular). The reverse
// trace (trace.js traceFromEye) checks this closed form numerically (magnification.test.js).
//
// [CITED, MEDIUM. Product form (shape factor × power factor):
//  https://open-exam-prep.com/study-guides/abo-advanced/optics-ii/thickness-magnification-effective-power
//  and https://www.opticiansfriend.com/equations/ — both use the VERTEX distance as d
//  (open-exam-prep worked example: +8,00 at 12 mm → 1,106; opticiansfriend does not define d).
//  Reference point = entrance pupil, h = HSA + 3 mm: derived here by ray-transfer matrices
//  (04-RESEARCH Pattern 2) and US 8,805,612 B2 (HSA + 3,05 mm; listed in 04-RESEARCH Sources).
//  NOT supported by any fetched source: a textbook statement of the entrance-pupil reference
//  (Bennett & Rabbetts, Clinical Visual Optics: page not verified, open human item;
//  opticianonline.net returned 403 and is not cited). Consequence of the choice: with d = 12 mm
//  instead of h = 15 mm, −4,00 CR-39 reads about −4,5 % instead of −5,6 %.]
//
// Scope: paraxial, at the lens centre, for the straight-ahead line of sight of a resting eye.

/** [ASSUMED: usual default vertex distance; v1 has no HSA field (D-04, Deferred); shown as angenommener Wert] */
export const HSA_ASSUMED_MM = 12;

/**
 * Corneal vertex → entrance pupil, mm.
 * [CITED: Le Grand & El Hage schematic eye, entrance pupil 3,04 mm behind the corneal vertex,
 *  computed from the surface table in Greivenkamp, OPTI-502 "The Eye" (Univ. of Arizona 2019),
 *  https://wp.optics.arizona.edu/jgreivenkamp/wp-content/uploads/sites/11/2019/08/502-22-The-Eye.pdf;
 *  rounded to 3,0 mm (orchestrator decision 1), which moves −4,00 CR-39 by about 0,015 percentage
 *  points, far below the HSA uncertainty. magnification.test.js reproduces the 3,04 mm.]
 */
export const ENTRANCE_PUPIL_MM = 3.0;

/** Back vertex → eye point (entrance pupil), mm: 12 + 3 = 15. */
export const EYE_POINT_MM = HSA_ASSUMED_MM + ENTRANCE_PUPIL_MM;

/** TABO degree in 1…180 (0 ≡ 180). */
const tabo = (deg) => {
  const a = ((deg % 180) + 180) % 180;
  return a === 0 ? 180 : a;
};

/**
 * Spectacle magnification per principal meridian.
 * @param {{ n: number, ctMm: number, D1: number, sph: number, cyl: number, axisDeg: number }} p
 *   cyl in the minus-cylinder form (evaluateLens rejects plus cylinder), axisDeg TABO
 * @param {number} [hMm] back vertex → eye point, mm
 * @returns {{ hMm: number, shape: number,
 *   meridians: Array<{ deg: number|null, wearerDeg: number|null, F: number, power: number, sm: number }> }}
 *   power = power factor, sm = shape · power, both dimensionless (1 = no change). deg = TABO meridian 1…180, ascending (180 last); wearerDeg =
 *   180 − deg (0…179), the direction as the wearer sees it (x mirrored). Without cylinder one
 *   meridian with deg and wearerDeg null.
 */
export function spectacleMagnification({ n, ctMm, D1, sph, cyl, axisDeg }, hMm = EYE_POINT_MM) {
  const shape = 1 / (1 - (ctMm / 1000 / n) * D1);
  const meridian = (deg, F) => {
    const power = 1 / (1 - (hMm / 1000) * F);
    return { deg, wearerDeg: deg === null ? null : 180 - deg, F, power, sm: shape * power };
  };
  if (cyl === 0) return { hMm, shape, meridians: [meridian(null, sph)] };
  const axis = tabo(axisDeg);
  const perp = tabo(axis + 90);
  const meridians = [meridian(axis, sph), meridian(perp, sph + cyl)].sort((a, b) => a.deg - b.deg);
  return { hMm, shape, meridians };
}
