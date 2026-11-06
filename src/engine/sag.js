// Stable (rationalised) conic sag. Never R − √(R² − r²) (cancellation for small c),
// never a clamp inside the root: a domain violation returns NaN and the caller emits a code.

/**
 * @param {number} c curvature 1/mm (sign per conventions.js)
 * @param {number} r2 squared radial distance mm²
 * @param {number} [k=0] conic constant (0 sphere, −1 paraboloid)
 * @returns {number} sag in mm, NaN when 1 − (1 + k)·c²·r2 < 0
 */
export function sphereSag(c, r2, k = 0) {
  const q = 1 - (1 + k) * c * c * r2;
  if (q < 0) return NaN;
  return (c * r2) / (1 + Math.sqrt(q));
}

/**
 * Gradient of sphereSag(c, x² + y², k) with respect to (x, y).
 * @returns {[number, number]} [∂s/∂x, ∂s/∂y]; NaN outside the domain
 */
export function sphereSagGrad(c, x, y, k = 0) {
  const q = 1 - (1 + k) * c * c * (x * x + y * y);
  if (q < 0) return [NaN, NaN];
  const f = c / Math.sqrt(q);
  return [f * x, f * y];
}

// True torus, "tyre" formation (ENG-03, decision D-03) [MEDIUM].
// The generating circle is always the meridian perpendicular to the cylinder axis (cross curve,
// curvature cv = cb) in the v–z plane, swept along u (the cylinder axis direction) at the
// base-curve radius 1/cu = 1/ca. This holds for concave, convex and mixed backs (the cross curve
// is the steeper one only for a concave minus-cylinder back).
// Secondary sources: rajukaiti slideshare "Spherical, cylindrical and toric lenses"; brainscape
// terminology cards; base curve = flatter meridian per US 3960442. No primary textbook accessed.
// The alternative orientation (barrel: profile circle in the axis meridian rotated about an axis
// parallel to it at the cross-curve radius, PITFALLS Pitfall 5 / "Zemax toroidal") has the same
// vertex curvatures, so the paraxial oracle cannot distinguish them; off-axis sag differs up to
// 0.46 mm at −6/−6, r 30 mm, n 1.50 (sag.test.js Pitfall-5 rows). Pinned by the golden value.
//
// Closed form z = R_u − √((R_u − z_v)² − u²), z_v = sphereSag(cv, v²). Rationalised here, so it
// is stable for cu → 0 (cu = 0 is the exact circular cylinder).

/**
 * @param {number} cu curvature along the cylinder axis (base curve ca), 1/mm
 * @param {number} cv curvature perpendicular to the axis (cross curve cb), 1/mm
 * @param {number} u coordinate along the axis, mm
 * @param {number} v coordinate perpendicular to the axis, mm
 * @returns {number} sag in mm; NaN on a domain violation
 */
export function torusSag(cu, cv, u, v) {
  const zv = sphereSag(cv, v * v);
  if (Number.isNaN(zv)) return NaN;
  const den = 1 - cu * zv;
  if (den <= 0) return NaN;
  return zv + sphereSag(cu / den, u * u);
}

/**
 * Gradient of torusSag: q = cu/(1 − cu·zv), a = √(1 − q²u²), zv′ = cv·v/√(1 − cv²v²);
 * ∂z/∂u = u·q/a, ∂z/∂v = zv′/a.
 * @returns {[number, number]} [∂s/∂u, ∂s/∂v]; NaN outside the domain
 */
export function torusSagGrad(cu, cv, u, v) {
  const w = 1 - cv * cv * v * v;
  const zv = sphereSag(cv, v * v);
  const den = 1 - cu * zv;
  if (!(w >= 0) || !(den > 0)) return [NaN, NaN];
  const q = cu / den;
  const a2 = 1 - q * q * u * u;
  if (a2 < 0) return [NaN, NaN];
  const a = Math.sqrt(a2);
  return [(u * q) / a, (cv * v) / Math.sqrt(w) / a];
}
