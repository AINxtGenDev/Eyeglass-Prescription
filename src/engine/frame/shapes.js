// Parametric frame shapes (FRAME-01).
//
// [ASSUMED, RESEARCH A6] Design choice, no citable standard: each shape is a unit polar
// function r(φ) built on the superellipse r(φ) = (|cos φ|^p + |sin φ|^p)^(−1/p); the
// outline is later scaled separately in x and y to exactly A × B (src/engine/frame/outline.js).
// Default A × B / DBL per shape are typical values, also [ASSUMED, RESEARCH A6].
//
// Shapes are defined for OD (eyeSign = +1, nasal = +x); OS is the bitwise x-mirror of OD.
//
// Pilot orientation [ASSUMED, unverified — no pilot image in references/]: checked
// 2026-11-06 against every image in references/ (000.png slider UI, 00_brillengroesse.png
// size guide with rectangular line drawings, 01-brille.png rounded-rectangle acetate frame);
// none shows a pilot/aviator frame. The RESEARCH form is kept: the LOWER half is widened on
// the TEMPORAL side and tapered on the nasal side. Open question for the user / lens-critic:
// classic teardrop aviators may be deepest lower-nasally (unverified recollection).
// Deviation from the RESEARCH formula: the weight max(0, −sin φ) is squared, so r(φ) has no
// slope kink at φ = 0 and π (the kink is a corner that breaks the 1 % arc-length spacing).

const superellipse = (phi, p) =>
  (Math.abs(Math.cos(phi)) ** p + Math.abs(Math.sin(phi)) ** p) ** (-1 / p);

const shape = (radius, defaults, xSymmetric) =>
  Object.freeze({ radius, defaults: Object.freeze(defaults), xSymmetric });

export const SHAPES = Object.freeze({
  rund: shape((phi) => superellipse(phi, 2), { A: 48, B: 44, DBL: 20 }, true),
  rechteckig: shape((phi) => superellipse(phi, 5), { A: 52, B: 38, DBL: 18 }, true),
  panto: shape(
    (phi) => superellipse(phi, Math.sin(phi) >= 0 ? 3.5 : 2),
    { A: 49, B: 42, DBL: 20 },
    false,
  ),
  pilot: shape(
    (phi, eyeSign = 1) =>
      superellipse(phi, 3) *
      (1 + 0.15 * Math.max(0, -Math.sin(phi)) ** 2 * (-Math.cos(phi) * eyeSign)),
    { A: 58, B: 50, DBL: 14 },
    false,
  ),
});
