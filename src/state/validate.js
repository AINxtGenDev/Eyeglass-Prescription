// Tier classification of the Rx fields (RX-04, RX-05, D-07, D-08). Pure and DOM-free: codes and
// data only, the German text lives in the dictionary (val.*, parse.*, rx.*).
// Values are never clamped or rounded: the engine gets exactly what was typed (T-02-10).
import { parseDiopter, parseAxis, parsePd, parseMm, parseIndex, parseDensity, parseAbbe, PARSE_CODES, PD_CODES } from './parse.js';
import { MATERIALS } from '../engine/materials.js';
import { transpose, RX_CODES } from './transpose.js';
import { FRAME_RANGES, PD_DEFAULT_MM } from './frame.js';

export const TIERS = Object.freeze({ ERROR: 'error', HINT: 'hint', OUT: 'out-of-model' });

export const VAL_CODES = Object.freeze({
  VAL_OFF_STEP: 'VAL_OFF_STEP',
  VAL_CONTACT_LENS: 'VAL_CONTACT_LENS',
  VAL_SPH_OUT_OF_MODEL: 'VAL_SPH_OUT_OF_MODEL',
  VAL_CYL_OUT_OF_MODEL: 'VAL_CYL_OUT_OF_MODEL',
  VAL_PD_OUT_OF_MODEL: 'VAL_PD_OUT_OF_MODEL',
  // 02-04: a PD question (PD_CODES in data.question) is a Hinweis that blocks the eye (D-05).
  VAL_PD_QUESTION: 'VAL_PD_QUESTION',
  VAL_PD_CONFLICT: 'VAL_PD_CONFLICT',
  VAL_FRAME_OUT_OF_MODEL: 'VAL_FRAME_OUT_OF_MODEL',
  // 02-10 Expert fields (MAT-03, MAT-04)
  VAL_BASECURVE_OUT_OF_MODEL: 'VAL_BASECURVE_OUT_OF_MODEL',
  VAL_MINTHICKNESS_OUT_OF_MODEL: 'VAL_MINTHICKNESS_OUT_OF_MODEL',
  // 02-11 Expert fields (MAT-05, FRAME-02 rim depth)
  VAL_CONIC_OUT_OF_MODEL: 'VAL_CONIC_OUT_OF_MODEL',
  VAL_RIMDEPTH_OUT_OF_MODEL: 'VAL_RIMDEPTH_OUT_OF_MODEL',
  // 02-12 custom material (MAT-06, D-17 "validated plausible ranges"): outside the outer band is a
  // Fehler (blocks), outside the inner band a Hinweis (computes).
  VAL_CUSTOM_OUT_OF_RANGE: 'VAL_CUSTOM_OUT_OF_RANGE',
  VAL_CUSTOM_IMPLAUSIBLE: 'VAL_CUSTOM_IMPLAUSIBLE',
});

// RX-04, REQUIREMENTS.md verbatim: Sph −12,00…+12,00 dpt, Zyl −6,00…0,00 dpt (minus form),
// PD 25,0…40,0 mm per eye. Achse 0…180° is enforced by parseAxis.
export const RX_RANGES = Object.freeze({ sph: [-12, 12], cyl: [-6, 0], pd: [25, 40] });

// Paper values come in 0,25 dpt steps (FEATURES §1); hint only.
export const STEP_DPT = 0.25;

// [ASSUMED, design constant] typical soft/RGP BC 8,0–9,0 mm and DIA 13,8–14,5 mm (from memory,
// unverified); only changes the message wording, never the computation.
const CL_BC_RANGE = [7.5, 9.5];
const CL_DIA_RANGE = [13, 15];
// "BC 8,6", "bc8,6", "DIA: 14": word start, no letter after. No nested quantifiers (T-02-08).
const CL_TEXT = /\b(?:bc|dia)(?![a-z])/i;

/** @typedef {{ tier: string, code: string, data: Record<string, unknown> }} FieldMsg */

const msg = (tier, code, data = {}) => ({ tier, code, data });
const blocks = (f) => f !== null && (f.tier === TIERS.ERROR || f.tier === TIERS.OUT);
const inside = (v, [min, max]) => v >= min && v <= max;
const isBlank = (raw) => String(raw ?? '').trim() === '';

const offStep = (v) => Math.abs(v * 4 - Math.round(v * 4)) > 1e-9;
// Nearest 0,25 step. A tie (exact ,125) would round away from zero; with at most two typed
// decimals parseDiopter cannot produce one, so the rule is stated, not reachable. + 0: no −0.
const nearestStep = (v) => Math.sign(v) * (Math.round(Math.abs(v) / STEP_DPT) * STEP_DPT) + 0;

/** "8,6": exactly one typed decimal, no minus sign (BC is never signed). */
const oneDecimalUnsigned = (raw) => /^\+?\d{1,2}[.,]\d$/.test(String(raw).trim());

/**
 * Classify one eye's Sph/Zyl/Achse text. PD is classified for both eyes at once (resolvePd).
 * @param {{ sph?: string, cyl?: string, axis?: string }} raw
 * @returns {{
 *   fields: { sph: FieldMsg|null, cyl: FieldMsg|null, axis: FieldMsg|null },
 *   blocked: { rx: boolean },
 *   rx: null | { sph: number, cyl: number, axisDeg: number },
 *   typed: null | { sph: number, cyl: number, axisDeg: number },
 * }}
 */
export function validateRxEye({ sph = '', cyl = '', axis = '' } = {}) {
  const fields = { sph: null, cyl: null, axis: null };

  // Sph: contact-lens text first (a value that cannot be computed cannot be a Hinweis, so the
  // non-numeric D-08 case is a Fehler; the numeric look-alike below stays a Hinweis).
  let sphV = null;
  if (CL_TEXT.test(String(sph))) {
    fields.sph = msg(TIERS.ERROR, VAL_CODES.VAL_CONTACT_LENS);
  } else {
    const r = parseDiopter(sph);
    if (r.ok) sphV = r.value;
    else fields.sph = msg(TIERS.ERROR, r.code);
  }

  // Zyl: blank means 0 (common on paper).
  let cylV = 0;
  if (!isBlank(cyl)) {
    const r = parseDiopter(cyl);
    if (r.ok) cylV = r.value;
    else {
      cylV = null;
      fields.cyl = msg(TIERS.ERROR, r.code);
    }
  }

  // Achse: required only when Zyl ≠ 0, never defaulted (T-01-10). A non-blank invalid Achse
  // blocks the eye even with Zyl 0 (01-09).
  let axisV = 0;
  if (isBlank(axis)) {
    if (cylV !== null && cylV !== 0) {
      axisV = null;
      fields.axis = msg(TIERS.ERROR, RX_CODES.AXIS_MISSING_FOR_CYL);
    }
  } else {
    const r = parseAxis(axis);
    if (r.ok) axisV = r.value;
    else {
      axisV = null;
      fields.axis = msg(TIERS.ERROR, r.code);
    }
  }

  const typed = sphV !== null && cylV !== null && axisV !== null ? { sph: sphV, cyl: cylV, axisDeg: axisV } : null;
  const forms = typed ? transpose(typed) : null;

  // Model range on the engine (minus-cylinder) form (RESEARCH Pitfall 8).
  if (sphV !== null) {
    const value = forms ? forms.minus.sph : sphV;
    if (!inside(value, RX_RANGES.sph)) {
      const data = { value, min: RX_RANGES.sph[0], max: RX_RANGES.sph[1], typed, minusForm: forms?.minus ?? null };
      if (inside(sphV, CL_DIA_RANGE)) data.contactLens = true;
      fields.sph = msg(TIERS.OUT, VAL_CODES.VAL_SPH_OUT_OF_MODEL, data);
    } else if (offStep(sphV)) {
      const suggestion = nearestStep(sphV);
      const cl = oneDecimalUnsigned(sph) && inside(sphV, CL_BC_RANGE);
      fields.sph = msg(TIERS.HINT, cl ? VAL_CODES.VAL_CONTACT_LENS : VAL_CODES.VAL_OFF_STEP, { suggestion });
    }
  }
  if (cylV !== null && cylV !== 0) {
    const value = -Math.abs(cylV); // the minus form of any cylinder
    if (!inside(value, RX_RANGES.cyl)) {
      fields.cyl = msg(TIERS.OUT, VAL_CODES.VAL_CYL_OUT_OF_MODEL, {
        value,
        min: RX_RANGES.cyl[0],
        max: RX_RANGES.cyl[1],
        typed: cylV,
      });
    } else if (offStep(cylV)) {
      fields.cyl = msg(TIERS.HINT, VAL_CODES.VAL_OFF_STEP, { suggestion: nearestStep(cylV) });
    }
  }

  const rxBlocked = blocks(fields.sph) || blocks(fields.cyl) || blocks(fields.axis) || forms === null;
  return { fields, blocked: { rx: rxBlocked }, rx: rxBlocked ? null : forms.minus, typed };
}

const EYES = /** @type {const} */ (['OD', 'OS']);
const FIELD_OF = { OD: 'od', OS: 'os' };
const OTHER = { OD: 'OS', OS: 'OD' };
const SOURCE_OF = { mono: 'typed', 'mono-pair': 'pair', binocular: 'binocular' };

/**
 * Both PD fields together (RX-06, D-05, D-06): a pair ("32/33") or a binocular PD ("64") typed
 * in one field also gives the other eye its value. A question never guesses: that eye is blocked
 * until it is answered. An empty field without a value from the other field gets the stated
 * default PD_DEFAULT_MM. blockedBy names the field whose message blocks the eye.
 * @param {{ od?: string, os?: string }} raw
 * @returns {{
 *   OD: { value: number|null, source: string|null }, OS: { value: number|null, source: string|null },
 *   messages: { od: FieldMsg|null, os: FieldMsg|null },
 *   blocked: { OD: boolean, OS: boolean },
 *   blockedBy: { OD: 'od'|'os'|null, OS: 'od'|'os'|null },
 *   parsed: { od: ReturnType<typeof parsePd>, os: ReturnType<typeof parsePd> },
 * }}
 */
export function resolvePd({ od = '', os = '' } = {}) {
  const parsed = { od: parsePd(od), os: parsePd(os) };
  const messages = { od: null, os: null };
  const out = { OD: { value: null, source: null }, OS: { value: null, source: null } };
  const blockedBy = { OD: null, OS: null };
  // First message per field wins (one message per field).
  const block = (eye, field, m) => {
    messages[field] ??= m;
    blockedBy[eye] = field;
  };
  for (const eye of EYES) {
    const own = FIELD_OF[eye];
    const other = FIELD_OF[OTHER[eye]];
    const p = parsed[own];
    const q = parsed[other];
    // The other field's value for this eye: only a pair or a binocular PD carries one.
    const cross = q.ok && q.kind !== 'mono' ? q[eye] : undefined;
    let value;
    let source;
    let from = own;
    if (!p.ok && p.code !== PARSE_CODES.PARSE_EMPTY) {
      if (Object.hasOwn(PD_CODES, p.code)) block(eye, own, msg(TIERS.HINT, VAL_CODES.VAL_PD_QUESTION, { question: p.code, ...p.data }));
      else block(eye, own, msg(TIERS.ERROR, p.code));
      continue;
    }
    if (p.ok) {
      value = p.kind === 'mono' ? p.value : p[eye];
      source = SOURCE_OF[p.kind];
      if (cross !== undefined && cross !== value) {
        block(eye, own, msg(TIERS.HINT, VAL_CODES.VAL_PD_CONFLICT, { value: cross }));
        continue;
      }
    } else if (cross !== undefined) {
      value = cross;
      source = SOURCE_OF[q.kind];
      from = other;
    } else {
      out[eye] = { value: PD_DEFAULT_MM, source: 'default' };
      continue;
    }
    if (!inside(value, RX_RANGES.pd)) {
      block(eye, from, msg(TIERS.OUT, VAL_CODES.VAL_PD_OUT_OF_MODEL, { value, min: RX_RANGES.pd[0], max: RX_RANGES.pd[1] }));
      continue;
    }
    out[eye] = { value, source };
  }
  return {
    ...out,
    messages,
    blocked: { OD: blockedBy.OD !== null, OS: blockedBy.OS !== null },
    blockedBy,
    parsed,
  };
}

/**
 * FRAME-02 model ranges: a value outside is Außerhalb des Modells and blocks both eyes; never
 * clamped. A null value (not parsed) has no range message.
 * @param {{ A: number|null, B: number|null, DBL: number|null }} dims
 * @returns {{ A: FieldMsg|null, B: FieldMsg|null, DBL: FieldMsg|null }}
 */
export function validateFrame(dims) {
  const out = { A: null, B: null, DBL: null };
  for (const field of /** @type {const} */ (['A', 'B', 'DBL'])) {
    const value = dims[field];
    const range = FRAME_RANGES[field];
    if (Number.isFinite(value) && !inside(value, range)) {
      out[field] = msg(TIERS.OUT, VAL_CODES.VAL_FRAME_OUT_OF_MODEL, { field, value, min: range[0], max: range[1] });
    }
  }
  return out;
}

// MAT-03, REQUIREMENTS.md verbatim: manual base curve 0,00…+10,00 dpt.
export const BASE_CURVE_MANUAL = Object.freeze([0, 10]);
// [ASSUMED, design constant] the sourced defaults are 1,0–1,8 mm (materials.js); these bounds only
// stop typos. The engine itself only requires > 0.
export const MIN_THICKNESS_RANGE = Object.freeze([0.5, 5]);

/** Empty = no override; a parse error is a Fehler; outside the range is Außerhalb des Modells. */
function expertField(raw, parse, range, code) {
  if (isBlank(raw)) return { value: null, msg: null };
  const r = parse(raw);
  if (!r.ok) return { value: null, msg: msg(TIERS.ERROR, r.code) };
  if (!inside(r.value, range)) return { value: null, msg: msg(TIERS.OUT, code, { value: r.value, min: range[0], max: range[1] }) };
  return { value: r.value, msg: null };
}

/**
 * Expert base curve (02-10, MAT-03): empty = automatic. Never clamped (T-02-26).
 * @param {string} raw @returns {{ value: number|null, msg: FieldMsg|null }}
 */
export const validateBaseCurve = (raw) =>
  expertField(raw, parseDiopter, BASE_CURVE_MANUAL, VAL_CODES.VAL_BASECURVE_OUT_OF_MODEL);

/**
 * Expert minimum centre or edge thickness (02-10, MAT-04): empty = material default.
 * @param {string} raw @returns {{ value: number|null, msg: FieldMsg|null }}
 */
export const validateMinThickness = (raw) =>
  expertField(raw, parseMm, MIN_THICKNESS_RANGE, VAL_CODES.VAL_MINTHICKNESS_OUT_OF_MODEL);

// MAT-05: Jalie US4289387 uses p 0…−4 for the hyperboloidal front, p = 1 + k ⇒ k −1…−5. Only the
// cited range is offered (lens-critic MINOR-2, RESEARCH A1): k = 0 is the 'sphärisch' radio, and
// −1 < k < 0 has no source and is out of model. The engine itself accepts any k ≤ 0.
export const CONIC_RANGE = Object.freeze([-5, -1]);
// Default k when the field is empty: the mildest cited end (p = 0, paraboloid).
export const CONIC_DEFAULT = -1;
// [ASSUMED, design constant] rim depth bounds that only stop typos (no citable range).
export const RIM_DEPTH_RANGE = Object.freeze([0.5, 10]);

/**
 * Expert conic constant k of the front (02-11, MAT-05): empty = default. Never clamped.
 * @param {string} raw @returns {{ value: number|null, msg: FieldMsg|null }}
 */
export const validateConic = (raw) => expertField(raw, parseDiopter, CONIC_RANGE, VAL_CODES.VAL_CONIC_OUT_OF_MODEL);

/**
 * Expert rim depth of the frame (02-11, FRAME-02): empty = RIM_DEPTH_DEFAULT_MM. Display only, it
 * never blocks an eye (the rim depth is not part of the LensSpec).
 * @param {string} raw @returns {{ value: number|null, msg: FieldMsg|null }}
 */
export const validateRimDepth = (raw) => expertField(raw, parseMm, RIM_DEPTH_RANGE, VAL_CODES.VAL_RIMDEPTH_OUT_OF_MODEL);

// MAT-06 custom material bands (02-12). Design constants, anchors per RESEARCH Open Q3: the listed
// materials span ne 1,500–1,738 and 1,11–1,47 g/cm³ (materials.js); crown glass nd ≈ 1,523,
// 2,54 g/cm³, Abbe ≈ 56–59; PC νe 29. The glass upper bound ne 1,9 of the Hinweis band is
// [ASSUMED A3]. error = outside is a Fehler (blocks), hint = outside is a Hinweis (computes).
export const CUSTOM_BANDS = Object.freeze({
  ne: Object.freeze({ error: Object.freeze([1.4, 2]), hint: Object.freeze([1.49, 1.9]) }),
  density: Object.freeze({ error: Object.freeze([0.8, 5]), hint: Object.freeze([1, 4]) }),
  abbe: Object.freeze({ error: Object.freeze([15, 80]), hint: Object.freeze([25, 65]) }),
});

/**
 * The listed material with the nearest ne (prefill of the custom minimum thicknesses). A tie goes
 * to the lower index (MATERIALS is in ascending ne order; a gap within 1e-12 counts as a tie, so
 * float noise such as 1,515 between 1,500 and 1,530 cannot pick the higher one).
 * @param {number} ne @returns {string} MATERIALS id
 */
export function nearestListedMaterial(ne) {
  let best = 'cr39';
  let gapBest = Infinity;
  for (const [id, m] of Object.entries(MATERIALS)) {
    const g = Math.abs(ne - m.ne);
    if (g < gapBest - 1e-12) {
      best = id;
      gapBest = g;
    }
  }
  return best;
}

/** One custom constant: parse, then the two bands. Empty abbe = no νe. */
function customField(field, raw, parse) {
  if (field === 'abbe' && isBlank(raw)) return { value: null, msg: null };
  const r = parse(raw);
  if (!r.ok) return { value: null, msg: msg(TIERS.ERROR, r.code) };
  const band = CUSTOM_BANDS[field];
  const data = (range) => ({ field, value: r.value, min: range[0], max: range[1] });
  if (!inside(r.value, band.error)) return { value: null, msg: msg(TIERS.ERROR, VAL_CODES.VAL_CUSTOM_OUT_OF_RANGE, data(band.error)) };
  if (!inside(r.value, band.hint)) return { value: r.value, msg: msg(TIERS.HINT, VAL_CODES.VAL_CUSTOM_IMPLAUSIBLE, data(band.hint)) };
  return { value: r.value, msg: null };
}

/**
 * Custom material fields (02-12, MAT-06). ne and density are required, Abbe is optional. An empty
 * minimum thickness takes the default of the listed material with the nearest ne (the value the
 * field is pre-filled with), so the engine always gets explicit numbers. A Fehler or Außerhalb
 * des Modells blocks both eyes; a Hinweis computes. Never clamped.
 * @param {{ ne?: string, density?: string, abbe?: string, minCT?: string, minET?: string }} raw
 * @returns {{ fields: { ne: FieldMsg|null, density: FieldMsg|null, abbe: FieldMsg|null,
 *   minCT: FieldMsg|null, minET: FieldMsg|null }, blocked: boolean,
 *   customMaterial: { ne: number, density: number, ve: number|null } | null,
 *   minCT: number|null, minET: number|null, nearest: string }}
 */
export function validateCustomMaterial({ ne = '', density = '', abbe = '', minCT = '', minET = '' } = {}) {
  const n = customField('ne', ne, parseIndex);
  const d = customField('density', density, parseDensity);
  const a = customField('abbe', abbe, parseAbbe);
  const nearest = MATERIALS[nearestListedMaterial(n.value ?? MATERIALS.cr39.ne)];
  const ct = validateMinThickness(minCT);
  const et = validateMinThickness(minET);
  const fields = { ne: n.msg, density: d.msg, abbe: a.msg, minCT: ct.msg, minET: et.msg };
  const blocked = Object.values(fields).some(blocks) || n.value === null || d.value === null;
  return {
    fields,
    blocked,
    customMaterial: blocked ? null : { ne: n.value, density: d.value, ve: a.value },
    minCT: ct.msg ? null : (ct.value ?? nearest.minCT),
    minET: et.msg ? null : (et.value ?? nearest.minET),
    nearest: nearest.id,
  };
}
