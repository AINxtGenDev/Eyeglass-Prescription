// MAT-02 base curve: Vogel reference value and the search bound for the automatic curve.
//
// D-01 final (user, 2026-11-06, "always pick the thinnest"): the automatic base curve is the
// computable D1 in [BASE_CURVE_LIMITS.min, BASE_CURVE_LIMITS.max] with the smallest maximum
// lens thickness (search in solve.js optimiseBaseCurve). Vogel's rule is NOT the chosen curve:
// it is the sourced reference value ("übliche Faustregel nach Vogel") and the search seed.
//
// Vogel's rule (form agreed across secondary sources): SE = S + C/2;
//   SE > 0: D1 = SE + 6.00;  SE ≤ 0: D1 = SE/2 + 6.00  (continuous at 0).
//   [CITED, MEDIUM: open-exam-prep.com ABO optics II; optiboard thread; slideshare base-curve
//    deck. No primary textbook accessed.]
//
// Range rationale:
//   ceiling +10.00 = the manual base-curve range (REQUIREMENTS MAT-03, idea.md).
//   floor +0.50 = a project design choice, NOT a manufacturing limit. It was informed by
//     Zeiss 1.74 −12.00 front ≈ 0.60 D true and Zeiss CR-39 −8.00 front 1.50 D @1.530, but it is
//     contradicted as a hard limit by ZEISS Finished SV SPH 1.53 (Trivex, doc Z00981.FS1,
//     fsv2023.pdf p.79), whose −7.00 and −8.00 rows use a 0.15 D front @1.530 (planner check with
//     pdftotext, 2026-11-06). Under D-01 final the thinnest computable curve wins, so this floor
//     decides most minus lenses; that is why its status as a design choice must be stated.

import { K } from './conventions.js';

export const BASE_CURVE_LIMITS = Object.freeze({ min: 0.5, max: 10 });

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
