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

// Smart PD (RX-06, D-05). Raw text is capped before any regex (T-02-12, ReDoS).
const MAX_RAW = 32;

export const PD_CODES = Object.freeze({
  PD_AMBIGUOUS: 'PD_AMBIGUOUS',
  PD_DISTANCE_NEAR: 'PD_DISTANCE_NEAR',
  PD_LOOKS_LIKE_HSA: 'PD_LOOKS_LIKE_HSA',
});

// ANSUR 2012 (via Wikipedia "Pupillary distance"): binocular PD minimum 51,0 mm, maximum 77,0 mm;
// female mean 61,7 mm (SD 3,6), male mean 64,0 mm (SD 3,4). Monocular 25–35 mm (Wutscher,
// wutscher.com/ratgeber/pupillendistanz-was-ist-das/). So a single value ≥ 50 cannot be monocular.
const PD_BINOCULAR_MIN = 50;
// Between monocular (≤ 40) and binocular (≥ 50): ask, never guess (D-05).
const PD_AMBIGUOUS_BAND = [40, 50];
// [ASSUMED, RESEARCH A5] a typical HSA (Hornhautscheitelabstand) is 8–20 mm; a PD there is
// probably the HSA typed into the PD field.
const PD_HSA_BAND = [8, 20];

const failWith = (code, data) => ({ ok: false, code, data });

/**
 * Parse a PD field: "32", "32,5" (one eye), "32/33" (R/L pair), "64" (both eyes together).
 * A value that could mean two things is a question (PD_CODES), never a guess.
 * @param {unknown} raw
 * @returns {{ok: true, kind: 'mono', value: number}
 *   | {ok: true, kind: 'mono-pair', OD: number, OS: number}
 *   | {ok: true, kind: 'binocular', total: number, OD: number, OS: number}
 *   | {ok: false, code: string, data?: {value: number}}}
 */
export function parsePd(raw) {
  const s = String(raw ?? '');
  if (s.length > MAX_RAW) return fail(PARSE_CODES.PARSE_NOT_A_NUMBER);
  if (s.trim() === '') return fail(PARSE_CODES.PARSE_EMPTY);
  const parts = s.split('/');
  if (parts.length > 2) return fail(PARSE_CODES.PARSE_NOT_A_NUMBER);
  const values = [];
  for (const part of parts) {
    const r = parseMm(part);
    // An empty half ("32/") is not an empty field.
    if (!r.ok) return fail(r.code === PARSE_CODES.PARSE_EMPTY ? PARSE_CODES.PARSE_NOT_A_NUMBER : r.code);
    values.push(r.value);
  }
  if (values.length === 2) {
    const [od, os] = values;
    const big = Math.max(od, os);
    if (od < PD_BINOCULAR_MIN && os < PD_BINOCULAR_MIN) return { ok: true, kind: 'mono-pair', OD: od, OS: os };
    // Two binocular values are distance and near PD; one of each kind is unclear.
    if (od >= PD_BINOCULAR_MIN && os >= PD_BINOCULAR_MIN) return failWith(PD_CODES.PD_DISTANCE_NEAR, { value: big });
    return failWith(PD_CODES.PD_AMBIGUOUS, { value: big });
  }
  const v = values[0];
  if (v >= PD_BINOCULAR_MIN) {
    // Halves on 0,5 mm steps (63 → 31,5 / 31,5).
    const half = Math.round(v) / 2;
    return { ok: true, kind: 'binocular', total: v, OD: half, OS: half };
  }
  if (v > PD_AMBIGUOUS_BAND[0] && v < PD_AMBIGUOUS_BAND[1]) return failWith(PD_CODES.PD_AMBIGUOUS, { value: v });
  if (v >= PD_HSA_BAND[0] && v <= PD_HSA_BAND[1]) return failWith(PD_CODES.PD_LOOKS_LIKE_HSA, { value: v });
  return { ok: true, kind: 'mono', value: v };
}

// Temple stamp (FRAME-03, D-11): "Glasbreite – Stegbreite – Bügellänge" (allaboutvision.com/de,
// RESEARCH Open Q9). Separators per RESEARCH Pattern 3: □ U+25A1, ▢ U+25A2, ◻ U+25FB, ☐ U+2610,
// "[]", "-", "/", "x", whitespace. normalise() has already turned dashes into '-' and 'X' into 'x'.
export const STAMP_CODES = Object.freeze({
  STAMP_INVALID: 'STAMP_INVALID',
  STAMP_SWAPPED: 'STAMP_SWAPPED',
});

const STAMP_SEPARATORS = /\s*(?:[□▢◻☐]|\[\s*\]|[-/x])\s*|\s+/g;
// Anchored, no nested quantifiers (T-02-12).
const STAMP = /^(\d{2}) (\d{2})(?: (\d{2,3}))?$/;
// Ranges used only to spot swapped numbers (FRAME-02); the model range check is in validate.js.
const STAMP_A = [40, 62];
const STAMP_DBL = [14, 24];
const within = (v, [min, max]) => v >= min && v <= max;

/**
 * Parse the temple stamp: "52□18 140", "52-18-140", "52 18 140", "52/18 145", "52 [] 18", "52x18".
 * @param {unknown} raw
 * @returns {{ok: true, A: number, DBL: number, temple: number | null}
 *   | {ok: false, code: string, data?: {A: number, DBL: number, temple: number | null}}}
 */
export function parseStamp(raw) {
  const str = String(raw ?? '');
  if (str.length > MAX_RAW) return fail(STAMP_CODES.STAMP_INVALID);
  const s = normalise(str);
  if (s === '') return fail(PARSE_CODES.PARSE_EMPTY);
  const m = STAMP.exec(s.replace(STAMP_SEPARATORS, ' '));
  if (!m) return fail(STAMP_CODES.STAMP_INVALID);
  const first = Number(m[1]);
  const second = Number(m[2]);
  const temple = m[3] === undefined ? null : Number(m[3]);
  if (within(first, STAMP_DBL) && within(second, STAMP_A)) {
    return failWith(STAMP_CODES.STAMP_SWAPPED, { A: second, DBL: first, temple });
  }
  return { ok: true, A: first, DBL: second, temple };
}
