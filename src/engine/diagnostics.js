// ENG-07 diagnostic catalogue. Codes only; German text lives in src/i18n/de-AT.js
// (diag.<CODE>.title|explain|suggest).

const entry = (severity) => Object.freeze({ severity });

export const DIAGNOSTICS = Object.freeze({
  FRONT_SAG_UNDEFINED: entry('error'),
  BACK_SAG_UNDEFINED: entry('error'),
  VERTEX_TERM_INVALID: entry('error'),
  THICK_LENS_NOT_CONVERGED: entry('error'),
  NON_FINITE_RESULT: entry('error'),
  INVALID_SPEC: entry('error'),
  OC_OUTSIDE_OUTLINE: entry('warn'),
  BLANK_EXCEEDS_STOCK: entry('warn'), // computable but oversized is a warning, never an error (D-01)
  CT_SET_BY_MIN_CT: entry('info'),
  CT_SET_BY_MIN_ET: entry('info'),
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
