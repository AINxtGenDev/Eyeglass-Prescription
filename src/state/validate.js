// Tier classification of the Rx fields (RX-04, RX-05, D-07, D-08). Pure and DOM-free: codes and
// data only, the German text lives in the dictionary (val.*, parse.*, rx.*).
// Values are never clamped or rounded: the engine gets exactly what was typed (T-02-10).
import { parseDiopter, parseAxis, parsePd, PARSE_CODES, PD_CODES } from './parse.js';
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
