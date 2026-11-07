// ENG-07 diagnostic catalogue. Codes only; German text lives in src/i18n/de-AT.js
// (diag.<CODE>.title|explain|suggest).

const entry = (severity) => Object.freeze({ severity });

export const DIAGNOSTICS = Object.freeze({
  FRONT_SAG_UNDEFINED: entry('error'),
  BACK_SAG_UNDEFINED: entry('error'),
  BACK_SURFACE_CONVEX: entry('error'), // automatic search only (01-12): no front ≤ ceiling gives a non-convex back
  VERTEX_TERM_INVALID: entry('error'),
  THICK_LENS_NOT_CONVERGED: entry('error'),
  NON_FINITE_RESULT: entry('error'),
  INVALID_SPEC: entry('error'),
  OC_OUTSIDE_OUTLINE: entry('warn'),
  BLANK_EXCEEDS_STOCK: entry('warn'), // computable but oversized is a warning, never an error (D-01)
  CT_SET_BY_MIN_CT: entry('info'),
  CT_SET_BY_MIN_ET: entry('info'),
  // Manual base curve only (MAT-03): the automatic search never gives a convex back. The back
  // principal powers are D2 = Sph − D1v (and Sph + Cyl − D1v), so a convex back (D2 > 0) means
  // the front D1v is too small for the plus power; only a steeper (higher) D1 clears it.
  MANUAL_BACK_CONVEX: entry('warn'),
});

// Largest Zeiss stock blank diameter on the sheets read (RESEARCH A9), mm.
export const STOCK_BLANK_MAX_MM = 75;

/**
 * @param {string} code key of DIAGNOSTICS
 * @param {object} [data]
 * @returns {{ code: string, severity: 'error'|'warn'|'info', data: object }}
 */
export function diag(code, data = {}) {
  const e = DIAGNOSTICS[code];
  if (!e) throw new Error(`Unknown diagnostic code: ${code}`);
  return { code, severity: e.severity, data };
}
