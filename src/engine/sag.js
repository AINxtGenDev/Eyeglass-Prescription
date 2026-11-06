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
