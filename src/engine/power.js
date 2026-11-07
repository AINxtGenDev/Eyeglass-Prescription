// MAT-02 base curve: Vogel reference value and the search bound for the automatic curve.
//
// D-01 (user, 2026-11-06) as amended by D-C: the automatic base curve is the flattest computable
// D1 in [BASE_CURVE_LIMITS.min, BASE_CURVE_LIMITS.max] whose maximum lens thickness is within
// τ = 0,10 mm of the thinnest (search in solve.js optimiseBaseCurve). Vogel's rule is NOT the chosen curve:
// it is the sourced reference value ("übliche Faustregel nach Vogel") and the search seed.
//
// Vogel's rule (form agreed across secondary sources): SE = S + C/2;
//   SE > 0: D1 = SE + 6.00;  SE ≤ 0: D1 = SE/2 + 6.00  (continuous at 0).
//   [CITED, MEDIUM: open-exam-prep.com ABO optics II; optiboard thread; slideshare base-curve
//    deck. No primary textbook accessed.]
//
// Range rationale (this is the AUTOMATIC range; the manual range 0…+10 is MAT-03, phase 2, and
// is not enforced by the engine in phase 1):
//   ceiling +14.00 = user decision D-A (2026-11-06). Source: US4185897 (Frieder, 1980,
//     "Prosthetic aspheric spectacle lens for aphakia"): each base-curve lens series "presently
//     used in the optical industry has a central zone … ranging from 12 to 16 diopters"
//     (verified 2026-11-06 at https://patents.google.com/patent/US4185897A). The old +10 was the
//     manual range from idea.md:48, written from memory. Still capped per lens by
//     FRONT_RADIUS_MARGIN_MM (maxD1 = min(14, K/(ρmax + 2))). The Vogel clamp uses the same range.
//   floor +0.50 = a project design choice, NOT a manufacturing limit. It was informed by
//     Zeiss 1.74 −12.00 front ≈ 0.60 D true and Zeiss CR-39 −8.00 front 1.50 D @1.530, but it is
//     contradicted as a hard limit by ZEISS Finished SV SPH 1.53 (Trivex, doc Z00981.FS1,
//     fsv2023.pdf p.79), whose −7.00 and −8.00 rows use a 0.15 D front @1.530 (planner check with
//     pdftotext, 2026-11-06). Under D-01 final the thinnest computable curve wins, so this floor
//     decides most minus lenses; that is why its status as a design choice must be stated.

import { K } from './conventions.js';

export const BASE_CURVE_LIMITS = Object.freeze({ min: 0.5, max: 14 });

// Numerical guard, not a physical or manufacturing limit. It bounds the search
// (D1 ≤ K/((ρmax + margin)·√(1 + k1))) so that q = 1 − ρ²/R1² stays away from 0, where the sag
// slope ρ/(R1·√q) diverges and the CT fixed point becomes ill-conditioned. A-priori value,
// not cited; never tune it to make a test pass.
export const FRONT_RADIUS_MARGIN_MM = 2;

/** @param {number} sph @param {number} cyl */
export const sphericalEquivalent = (sph, cyl) => sph + cyl / 2;

/** Vogel's rule (raw, unclamped). @param {number} se */
export const vogelBaseCurve = (se) => (se > 0 ? se + 6 : se / 2 + 6);

/**
 * Pure and cheap (no solver call).
 * @param {number} se spherical equivalent
 * @param {{ n: number, rhoMax: number, k1?: number }} opts
 * @returns {{ vogelD1: number, vogelClampedD1: number, maxD1: number }}
 *   vogelD1 raw reference; vogelClampedD1 search seed; maxD1 search upper bound
 */
export function baseCurveAuto(se, { n, rhoMax, k1 = 0 }) {
  const vogelD1 = vogelBaseCurve(se);
  const vogelClampedD1 = Math.min(Math.max(vogelD1, BASE_CURVE_LIMITS.min), BASE_CURVE_LIMITS.max);
  const frontCap =
    1 + k1 > 0 ? K(n) / ((rhoMax + FRONT_RADIUS_MARGIN_MM) * Math.sqrt(1 + k1)) : Infinity;
  const maxD1 = Math.min(BASE_CURVE_LIMITS.max, frontCap);
  return { vogelD1, vogelClampedD1, maxD1 };
}

// ENG-01 meridian power and the dioptric power matrix.
// Matrix name "dioptric power matrix (Harris/Keating)" is an [ASSUMED attribution, RESEARCH A1];
// its consistency with ENG-01 (eᵀ·F·e = S + C·sin²(θ − α)) is proven in power.test.js.

const DEG = Math.PI / 180;

/** D(θ) = S + C·sin²(θ − α): S in the axis meridian, S + C at α + 90° (TABO degrees). */
export function meridianPower(sph, cyl, axisDeg, thetaDeg) {
  const s = Math.sin((thetaDeg - axisDeg) * DEG);
  return sph + cyl * s * s;
}

/**
 * @param {{ sph: number, cyl: number, axisDeg: number }} rx
 * @returns {number[][]} [[S + C sin²α, −C sinα cosα], [−C sinα cosα, S + C cos²α]]
 */
export function rxToMatrix({ sph, cyl, axisDeg }) {
  const s = Math.sin(axisDeg * DEG);
  const c = Math.cos(axisDeg * DEG);
  const f12 = -cyl * s * c;
  return [
    [sph + cyl * s * s, f12],
    [f12, sph + cyl * c * c],
  ];
}

/**
 * Inverse of rxToMatrix in minus-cylinder form.
 * @param {number[][]} F symmetric 2×2 (F[0][1] is used for the off-diagonal)
 * @returns {{ sph: number, cyl: number, axisDeg: number }} cyl ≤ 0, axisDeg ∈ [0, 180)
 */
export function matrixToRx(F) {
  const m = (F[0][0] + F[1][1]) / 2;
  const h = (F[0][0] - F[1][1]) / 2;
  const r = Math.hypot(h, F[0][1]);
  if (r === 0) return { sph: m, cyl: 0, axisDeg: 0 };
  let axisDeg = (0.5 * Math.atan2(2 * F[0][1], 2 * h)) / DEG;
  axisDeg = ((axisDeg % 180) + 180) % 180;
  if (axisDeg >= 180) axisDeg = 0;
  return { sph: m + r, cyl: -2 * r, axisDeg };
}
