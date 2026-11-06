// Paper-style prescription parsing (RX-02). Pure and DOM-free.
// Never use parseFloat or Number() on user text: parseFloat('-2,25') === -2.
// Range checks (Sph ±12 etc.) are not done here (RX-04, phase 2).

export const PARSE_CODES = Object.freeze({
  PARSE_EMPTY: 'PARSE_EMPTY',
  PARSE_NOT_A_NUMBER: 'PARSE_NOT_A_NUMBER',
  PARSE_MIXED_SEPARATORS: 'PARSE_MIXED_SEPARATORS',
  PARSE_TOO_MANY_DECIMALS: 'PARSE_TOO_MANY_DECIMALS',
  PARSE_AXIS_OUT_OF_RANGE: 'PARSE_AXIS_OUT_OF_RANGE',
  PARSE_AXIS_INVALID: 'PARSE_AXIS_INVALID',
});

/** U+2212, U+2012, U+2013, U+2010, U+FE63, U+FF0D → ASCII hyphen-minus. */
const MINUS_FORMS = /[−‒–‐﹣－]/g;

const fail = (code) => ({ ok: false, code });
const okValue = (value) => ({ ok: true, value: value + 0 }); // + 0 turns -0 into +0

/** trim, lower-case, unify minus forms. */
function normalise(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(MINUS_FORMS, '-');
}

/**
 * Build a number from regex parts without parsing the raw text.
 * @param {string} sign '' | '+' | '-'
 * @param {string} int
 * @param {string | undefined} frac
 */
function compose(sign, int, frac) {
  return Number((sign === '-' ? '-' : '') + int + '.' + (frac ?? '0'));
}

/**
 * Parse a diopter value: "-2,25", "−2.25", "+1", "1,5 dpt", "plan".
 * @param {unknown} raw
 * @returns {{ok: true, value: number} | {ok: false, code: string}}
 */
export function parseDiopter(raw) {
  let s = normalise(raw);
  if (s === '') return fail(PARSE_CODES.PARSE_EMPTY);
  s = s.replace(/\s*(dpt\.?|dioptrien|d)$/, '');
  if (/^(plan|pl|plano|±0|\+-0)$/.test(s)) return okValue(0);
  if (s.includes('.') && s.includes(',')) return fail(PARSE_CODES.PARSE_MIXED_SEPARATORS);
  if (/^[+-]?\d{1,2}[.,]\d{3,}$/.test(s)) return fail(PARSE_CODES.PARSE_TOO_MANY_DECIMALS);
  const m = /^([+-]?)(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return fail(PARSE_CODES.PARSE_NOT_A_NUMBER);
  return okValue(compose(m[1], m[2], m[3]));
}

/**
 * Parse a cylinder axis: "90", "x180", "×45", "@10", "180°".
 * Integer 0…180; 180 is returned as 0 (TABO engine range [0, 180)).
 * @param {unknown} raw
 * @returns {{ok: true, value: number} | {ok: false, code: string}}
 */
export function parseAxis(raw) {
  const s = normalise(raw);
  if (s === '') return fail(PARSE_CODES.PARSE_EMPTY);
  const digits = s.replace(/^[x×@]\s*/, '').replace(/\s*°$/, '');
  // Not whole degrees without sign (e.g. 90,5 or −90): own message (01-13, MINOR-5)
  if (!/^\d{1,3}$/.test(digits)) return fail(PARSE_CODES.PARSE_AXIS_INVALID);
  const deg = Number(digits);
  if (deg > 180) return fail(PARSE_CODES.PARSE_AXIS_OUT_OF_RANGE);
  return okValue(deg === 180 ? 0 : deg);
}

/**
 * Parse a length in mm (PD, A, B, DBL): "32", "32,5", "32.5 mm".
 * @param {unknown} raw
 * @returns {{ok: true, value: number} | {ok: false, code: string}}
 */
export function parseMm(raw) {
  let s = normalise(raw);
  if (s === '') return fail(PARSE_CODES.PARSE_EMPTY);
  s = s.replace(/\s*mm$/, '');
  if (s.includes('.') && s.includes(',')) return fail(PARSE_CODES.PARSE_MIXED_SEPARATORS);
  if (/^\d{1,3}[.,]\d{2,}$/.test(s)) return fail(PARSE_CODES.PARSE_TOO_MANY_DECIMALS);
  const m = /^(\d{1,3})(?:[.,](\d))?$/.exec(s);
  if (!m) return fail(PARSE_CODES.PARSE_NOT_A_NUMBER);
  return okValue(compose('', m[1], m[2]));
}
