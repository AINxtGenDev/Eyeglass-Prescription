import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateRxEye,
  resolvePd,
  validateFrame,
  validateBaseCurve,
  validateMinThickness,
  validateConic,
  validateRimDepth,
  validateCustomMaterial,
  nearestListedMaterial,
  CUSTOM_BANDS,
  CONIC_RANGE,
  CONIC_DEFAULT,
  RIM_DEPTH_RANGE,
  BASE_CURVE_MANUAL,
  MIN_THICKNESS_RANGE,
  VAL_CODES,
  TIERS,
  RX_RANGES,
  STEP_DPT,
} from './validate.js';
import { PARSE_CODES } from './parse.js';
import { RX_CODES } from './transpose.js';
import { MATERIALS as MATERIALS_FOR_TEST } from '../engine/materials.js';

const eye = (sph, cyl = '', axis = '') => validateRxEye({ sph, cyl, axis });

describe('constants (RX-04 verbatim)', () => {
  test('ranges and step', () => {
    expect(RX_RANGES).toEqual({ sph: [-12, 12], cyl: [-6, 0], pd: [25, 40] });
    expect(STEP_DPT).toBe(0.25);
    expect(Object.isFrozen(RX_RANGES)).toBe(true);
  });
  test('codes equal their keys', () => {
    for (const [k, v] of Object.entries(VAL_CODES)) expect(v).toBe(k);
    expect(TIERS).toEqual({ ERROR: 'error', HINT: 'hint', OUT: 'out-of-model' });
  });
});

describe('Hinweis: off the 0,25 step (D-07), never rounded', () => {
  test('-2,3 → suggestion −2,25, computes with the entered value', () => {
    const r = eye('-2,3');
    expect(r.fields.sph).toEqual({ tier: 'hint', code: 'VAL_OFF_STEP', data: { suggestion: -2.25 } });
    expect(r.blocked.rx).toBe(false);
    expect(r.rx).toEqual({ sph: -2.3, cyl: 0, axisDeg: 0 });
  });
  test.each([
    ['-2,37', -2.25],
    ['-2,38', -2.5],
    ['+0,10', 0],
    ['-0,10', 0],
    ['2,13', 2.25],
    ['2,12', 2],
  ])('%s → nearest 0,25 = %d', (sph, suggestion) => {
    const f = eye(sph).fields.sph;
    expect(f.code).toBe('VAL_OFF_STEP');
    expect(Object.is(f.data.suggestion, suggestion)).toBe(true); // no −0
  });
  test('on-step values have no message', () => {
    for (const s of ['-2,25', '+1', '0', 'plan', '-12', '+12']) expect(eye(s).fields.sph, s).toBeNull();
  });
  test('Zyl off-step is a Hinweis too', () => {
    const r = eye('-1', '-0,3', '90');
    expect(r.fields.cyl).toEqual({ tier: 'hint', code: 'VAL_OFF_STEP', data: { suggestion: -0.25 } });
    expect(r.rx).toEqual({ sph: -1, cyl: -0.3, axisDeg: 90 });
  });
});

describe('Außerhalb des Modells (RX-04), checked on the minus-cylinder form (Pitfall 8)', () => {
  test('sph -12,25 blocks the eye', () => {
    const r = eye('-12,25');
    expect(r.fields.sph).toMatchObject({
      tier: 'out-of-model',
      code: 'VAL_SPH_OUT_OF_MODEL',
      data: { value: -12.25, min: -12, max: 12 },
    });
    expect(r.blocked.rx).toBe(true);
    expect(r.rx).toBeNull();
  });
  test('+11,00 / +2,00 × 90 is +13,00 in minus form → out of model', () => {
    const r = eye('+11,00', '+2,00', '90');
    expect(r.fields.sph.code).toBe('VAL_SPH_OUT_OF_MODEL');
    expect(r.fields.sph.data.value).toBe(13);
    expect(r.fields.sph.data.typed).toEqual({ sph: 11, cyl: 2, axisDeg: 90 });
    expect(r.fields.sph.data.minusForm).toEqual({ sph: 13, cyl: -2, axisDeg: 0 });
    expect(r.fields.cyl).toBeNull();
    expect(r.blocked.rx).toBe(true);
  });
  test('+12 / -2 × 90 stays inside (typed form is the minus form)', () => {
    expect(eye('+12', '-2', '90').fields.sph).toBeNull();
  });
  test('cyl -6,25 → VAL_CYL_OUT_OF_MODEL', () => {
    const f = eye('-1', '-6,25', '10').fields.cyl;
    expect(f).toMatchObject({ tier: 'out-of-model', code: 'VAL_CYL_OUT_OF_MODEL', data: { value: -6.25, min: -6, max: 0 } });
  });
  test('cyl +6,50 → minus form −6,50 → out of model, typed +6,50', () => {
    const f = eye('-1', '+6,50', '10').fields.cyl;
    expect(f.code).toBe('VAL_CYL_OUT_OF_MODEL');
    expect(f.data.value).toBe(-6.5);
    expect(f.data.typed).toBe(6.5);
  });
  test('cyl -6 and sph ±12 are inside', () => {
    const r = eye('-12', '-6', '10');
    expect(r.fields).toMatchObject({ sph: null, cyl: null, axis: null });
    expect(r.rx).toEqual({ sph: -12, cyl: -6, axisDeg: 10 });
  });
  test('values are never clamped: typed keeps the entered value', () => {
    const r = eye('-13');
    expect(r.typed).toEqual({ sph: -13, cyl: 0, axisDeg: 0 });
    expect(r.fields.sph.data.value).toBe(-13);
  });
});

describe('Fehler (blocks the eye)', () => {
  test('Zyl without Achse reuses RX_CODES.AXIS_MISSING_FOR_CYL', () => {
    const r = eye('-1', '-1,00', '');
    expect(r.fields.axis).toEqual({ tier: 'error', code: RX_CODES.AXIS_MISSING_FOR_CYL, data: {} });
    expect(r.blocked.rx).toBe(true);
  });
  test('axis 200 → PARSE_AXIS_OUT_OF_RANGE', () => {
    expect(eye('-1', '-1', '200').fields.axis).toMatchObject({ tier: 'error', code: PARSE_CODES.PARSE_AXIS_OUT_OF_RANGE });
  });
  test('axis 180 is accepted as 0', () => {
    const r = eye('-1', '-1', '180');
    expect(r.fields.axis).toBeNull();
    expect(r.rx.axisDeg).toBe(0);
  });
  test('a non-blank invalid Achse blocks the eye even with Zyl 0 (01-09)', () => {
    const r = eye('-1', '', 'abc');
    expect(r.fields.axis.tier).toBe('error');
    expect(r.blocked.rx).toBe(true);
  });
  test('blank Achse with blank Zyl is fine', () => {
    expect(eye('-1').fields.axis).toBeNull();
  });
  test('sph abc → PARSE_NOT_A_NUMBER', () => {
    expect(eye('abc').fields.sph).toEqual({ tier: 'error', code: 'PARSE_NOT_A_NUMBER', data: {} });
  });
  test('blank sph → PARSE_EMPTY, blocked', () => {
    const r = eye('');
    expect(r.fields.sph.code).toBe('PARSE_EMPTY');
    expect(r.blocked.rx).toBe(true);
  });
});

describe('contact-lens look-alikes (D-08)', () => {
  test.each(['BC 8,6', 'bc8,6', 'DIA 14,2', 'dia: 14'])('%s → Fehler VAL_CONTACT_LENS', (s) => {
    const r = eye(s);
    expect(r.fields.sph).toEqual({ tier: 'error', code: 'VAL_CONTACT_LENS', data: {} });
    expect(r.blocked.rx).toBe(true);
  });
  test('8,6 (one decimal, BC band, off-step) → Hinweis VAL_CONTACT_LENS, still computes', () => {
    const r = eye('8,6');
    expect(r.fields.sph).toEqual({ tier: 'hint', code: 'VAL_CONTACT_LENS', data: { suggestion: 8.5 } });
    expect(r.blocked.rx).toBe(false);
    expect(r.rx.sph).toBe(8.6);
  });
  test('8,60 (two decimals) is an ordinary off-step hint', () => {
    expect(eye('8,60').fields.sph.code).toBe('VAL_OFF_STEP');
  });
  test('-8,6 is a myope, not a BC value', () => {
    expect(eye('-8,6').fields.sph.code).toBe('VAL_OFF_STEP');
  });
  test('14,2 → out of model with contactLens = true', () => {
    const f = eye('14,2').fields.sph;
    expect(f).toMatchObject({ tier: 'out-of-model', code: 'VAL_SPH_OUT_OF_MODEL', data: { contactLens: true } });
  });
  test('-14,2 has no contact-lens flag', () => {
    expect(eye('-14,2').fields.sph.data.contactLens).toBeUndefined();
  });
});

describe('resolvePd (RX-06, D-05, D-06): both PD fields together', () => {
  const pd = (od, os) => resolvePd({ od, os });
  test('both empty → 32 mm assumed for both eyes', () => {
    const r = pd('', '');
    expect(r.OD).toEqual({ value: 32, source: 'default' });
    expect(r.OS).toEqual({ value: 32, source: 'default' });
    expect(r.messages).toEqual({ od: null, os: null });
    expect(r.blocked).toEqual({ OD: false, OS: false });
  });
  test('one mono value, the other empty → default for the empty eye only', () => {
    const r = pd('32', '');
    expect(r.OD).toEqual({ value: 32, source: 'typed' });
    expect(r.OS).toEqual({ value: 32, source: 'default' });
  });
  test('"64" in one field, other empty → 32/32 binocular', () => {
    const r = pd('64', '');
    expect(r.OD).toEqual({ value: 32, source: 'binocular' });
    expect(r.OS).toEqual({ value: 32, source: 'binocular' });
    expect(r.messages).toEqual({ od: null, os: null });
  });
  test('"32/33" in the left field fills R 32 and L 33', () => {
    const r = pd('', '32/33');
    expect(r.OD).toEqual({ value: 32, source: 'pair' });
    expect(r.OS).toEqual({ value: 33, source: 'pair' });
    expect(r.parsed.os).toMatchObject({ ok: true, kind: 'mono-pair' });
  });
  test('the same value in both fields is no conflict', () => {
    expect(pd('64', '64').blocked).toEqual({ OD: false, OS: false });
    expect(pd('64', '32').OS).toEqual({ value: 32, source: 'typed' });
    expect(pd('32/33', '33').messages.os).toBeNull();
  });
  test('a different value next to a pair is a conflict hint and blocks that eye', () => {
    const r = pd('64', '31,5');
    expect(r.OD).toEqual({ value: 32, source: 'binocular' });
    expect(r.messages.os).toEqual({ tier: 'hint', code: 'VAL_PD_CONFLICT', data: { value: 32 } });
    expect(r.blocked).toEqual({ OD: false, OS: true });
    expect(r.blockedBy.OS).toBe('os');
    expect(r.OS.value).toBeNull();
  });
  test.each([
    ['45', 'PD_AMBIGUOUS', { value: 45 }],
    ['64/61', 'PD_DISTANCE_NEAR', { value: 64 }],
    ['12', 'PD_LOOKS_LIKE_HSA', { value: 12 }],
  ])('question %j is a blocking Hinweis, the other eye keeps its value', (raw, question, data) => {
    const r = pd(raw, '31,5');
    expect(r.messages.od).toEqual({ tier: 'hint', code: 'VAL_PD_QUESTION', data: { question, ...data } });
    expect(r.blocked).toEqual({ OD: true, OS: false });
    expect(r.blockedBy.OD).toBe('od');
    expect(r.OD.value).toBeNull();
    expect(r.OS).toEqual({ value: 31.5, source: 'typed' });
  });
  test('not a number is a Fehler', () => {
    const r = pd('abc', '');
    expect(r.messages.od).toEqual({ tier: 'error', code: 'PARSE_NOT_A_NUMBER', data: {} });
    expect(r.blocked.OD).toBe(true);
    expect(r.OS.source).toBe('default');
  });
  test.each(['24,5', '5', '22/40,5'])('%s: outside 25–40 mm per eye blocks, never clamped', (raw) => {
    const r = pd(raw, '32');
    expect(r.messages.od).toMatchObject({ tier: 'out-of-model', code: 'VAL_PD_OUT_OF_MODEL', data: { min: 25, max: 40 } });
    expect(r.blocked.OD).toBe(true);
  });
  test('25 and 40 are inside', () => {
    expect(pd('25', '40').blocked).toEqual({ OD: false, OS: false });
  });
  test('a pair out of range for the other eye: the message sits on the field that holds it', () => {
    const r = pd('', '20/33');
    expect(r.messages.os).toMatchObject({ code: 'VAL_PD_OUT_OF_MODEL', data: { value: 20 } });
    expect(r.blocked).toEqual({ OD: true, OS: false });
    expect(r.blockedBy.OD).toBe('os');
    expect(r.OS).toEqual({ value: 33, source: 'pair' });
  });
  test('"90" (45 per eye) blocks both eyes from one field', () => {
    const r = pd('90', '');
    expect(r.messages.od).toMatchObject({ code: 'VAL_PD_OUT_OF_MODEL', data: { value: 45 } });
    expect(r.blocked).toEqual({ OD: true, OS: true });
    expect(r.blockedBy).toEqual({ OD: 'od', OS: 'od' });
  });
  test('random strings never throw', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 64 }), fc.string({ maxLength: 64 }), (od, os) => {
        const r = resolvePd({ od, os });
        for (const e of ['OD', 'OS']) expect(r[e].value === null).toBe(r.blocked[e]);
      }),
      { numRuns: 300 },
    );
  });
});

describe('validateFrame (FRAME-02): out of model, never clamped', () => {
  test.each([
    ['A', 39, 40, 62],
    ['A', 63, 40, 62],
    ['B', 56, 28, 55],
    ['B', 27, 28, 55],
    ['DBL', 13, 14, 24],
    ['DBL', 25, 14, 24],
  ])('%s %d', (field, value, min, max) => {
    const dims = { A: 52, B: 38, DBL: 18, [field]: value };
    const r = validateFrame(dims);
    expect(r[field]).toEqual({ tier: 'out-of-model', code: 'VAL_FRAME_OUT_OF_MODEL', data: { field, value, min, max } });
  });
  test('52 / 38 / 18 and the range ends are inside', () => {
    expect(validateFrame({ A: 52, B: 38, DBL: 18 })).toEqual({ A: null, B: null, DBL: null });
    expect(validateFrame({ A: 40, B: 55, DBL: 24 })).toEqual({ A: null, B: null, DBL: null });
  });
  test('a missing value has no range message', () => {
    expect(validateFrame({ A: null, B: 38, DBL: 18 }).A).toBeNull();
  });
});

describe('one message per field, error > out-of-model > hint', () => {
  test('-13,3 is out of model, not off-step', () => {
    expect(eye('-13,3').fields.sph.code).toBe('VAL_SPH_OUT_OF_MODEL');
  });
  test('cyl -6,3 is out of model, not off-step', () => {
    expect(eye('-1', '-6,3', '10').fields.cyl.code).toBe('VAL_CYL_OUT_OF_MODEL');
  });
});

describe('robustness (T-02-08)', () => {
  const TIER_VALUES = Object.values(TIERS);
  test('random strings never throw and give a tier or null', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 64 }),
        fc.string({ maxLength: 64 }),
        fc.string({ maxLength: 64 }),
        (sph, cyl, axis) => {
          const r = validateRxEye({ sph, cyl, axis });
          for (const f of Object.values(r.fields)) {
            if (f !== null) expect(TIER_VALUES).toContain(f.tier);
          }
          expect(r.rx === null).toBe(r.blocked.rx);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('Expert fields (02-10, MAT-03, MAT-04)', () => {
  test('ranges: base curve 0…10 dpt (MAT-03), minimum thickness 0,5…5 mm', () => {
    expect(BASE_CURVE_MANUAL).toEqual([0, 10]);
    expect(MIN_THICKNESS_RANGE).toEqual([0.5, 5]);
  });
  test('base curve: empty is automatic, 0 and 10 accepted', () => {
    expect(validateBaseCurve('')).toEqual({ value: null, msg: null });
    expect(validateBaseCurve('  ')).toEqual({ value: null, msg: null });
    expect(validateBaseCurve('0')).toEqual({ value: 0, msg: null });
    expect(validateBaseCurve('4,5')).toEqual({ value: 4.5, msg: null });
    expect(validateBaseCurve('10')).toEqual({ value: 10, msg: null });
  });
  test.each([
    ['10,25', 10.25],
    ['-1', -1],
    ['12', 12],
  ])('base curve %s is out of model, never clamped', (raw, value) => {
    expect(validateBaseCurve(raw)).toEqual({
      value: null,
      msg: { tier: TIERS.OUT, code: VAL_CODES.VAL_BASECURVE_OUT_OF_MODEL, data: { value, min: 0, max: 10 } },
    });
  });
  test('base curve: not a number is a Fehler', () => {
    const r = validateBaseCurve('abc');
    expect(r.value).toBe(null);
    expect(r.msg.tier).toBe(TIERS.ERROR);
    expect(r.msg.code).toBe(PARSE_CODES.PARSE_NOT_A_NUMBER);
  });
  test('minimum thickness: 1,8 accepted, empty is the default, 0,4 out of model', () => {
    expect(validateMinThickness('1,8')).toEqual({ value: 1.8, msg: null });
    expect(validateMinThickness('')).toEqual({ value: null, msg: null });
    expect(validateMinThickness('0,4')).toEqual({
      value: null,
      msg: { tier: TIERS.OUT, code: VAL_CODES.VAL_MINTHICKNESS_OUT_OF_MODEL, data: { value: 0.4, min: 0.5, max: 5 } },
    });
    expect(validateMinThickness('5,1').msg.code).toBe(VAL_CODES.VAL_MINTHICKNESS_OUT_OF_MODEL);
    expect(validateMinThickness('x').msg.tier).toBe(TIERS.ERROR);
  });
});


describe('Expert fields (02-11, MAT-05 k, FRAME-02 rim depth)', () => {
  test('ranges: k −5…−1 (US4289387 p 0…−4, p = 1 + k), default −1; rim depth 0,5…10 mm', () => {
    expect(CONIC_RANGE).toEqual([-5, -1]);
    expect(CONIC_DEFAULT).toBe(-1);
    expect(RIM_DEPTH_RANGE).toEqual([0.5, 10]);
  });
  test('k: −1, −5 and −2,5 accepted, empty means the default', () => {
    expect(validateConic('−1')).toEqual({ value: -1, msg: null });
    expect(validateConic('-5')).toEqual({ value: -5, msg: null });
    expect(validateConic('−2,5')).toEqual({ value: -2.5, msg: null });
    expect(validateConic('')).toEqual({ value: null, msg: null });
  });
  test.each([
    ['0', 0],
    ['−0,5', -0.5],
    ['−6', -6],
    ['1', 1],
  ])('k %s is out of model, never clamped', (raw, value) => {
    expect(validateConic(raw)).toEqual({
      value: null,
      msg: { tier: TIERS.OUT, code: VAL_CODES.VAL_CONIC_OUT_OF_MODEL, data: { value, min: -5, max: -1 } },
    });
  });
  test('k: not a number is a Fehler', () => {
    expect(validateConic('abc').msg.tier).toBe(TIERS.ERROR);
  });
  test('rim depth: 3 and 5 accepted, empty is the default, 0,4 and 12 out of model', () => {
    expect(validateRimDepth('3,0')).toEqual({ value: 3, msg: null });
    expect(validateRimDepth('5')).toEqual({ value: 5, msg: null });
    expect(validateRimDepth('')).toEqual({ value: null, msg: null });
    for (const [raw, value] of [
      ['0,4', 0.4],
      ['12', 12],
    ]) {
      expect(validateRimDepth(raw).msg).toEqual({
        tier: TIERS.OUT,
        code: VAL_CODES.VAL_RIMDEPTH_OUT_OF_MODEL,
        data: { value, min: 0.5, max: 10 },
      });
    }
  });
});

describe('custom material (02-12, MAT-06, RESEARCH Open Q3 bands)', () => {
  const v = (o) => validateCustomMaterial({ ne: '1,5', density: '1,32', abbe: '56', minCT: '1,8', minET: '1,0', ...o });

  test('bands are the RESEARCH Open Q3 design constants', () => {
    expect(CUSTOM_BANDS).toEqual({
      ne: { error: [1.4, 2], hint: [1.49, 1.9] },
      density: { error: [0.8, 5], hint: [1, 4] },
      abbe: { error: [15, 80], hint: [25, 65] },
    });
    expect(Object.isFrozen(CUSTOM_BANDS)).toBe(true);
  });

  test('CR-39 constants: no message, customMaterial and min values for the engine', () => {
    const r = v({});
    expect(r.blocked).toBe(false);
    expect(r.fields).toEqual({ ne: null, density: null, abbe: null, minCT: null, minET: null });
    expect(r.customMaterial).toEqual({ ne: 1.5, density: 1.32, ve: 56 });
    expect(r.minCT).toBe(1.8);
    expect(r.minET).toBe(1);
  });

  test('ne 1,95 is a Hinweis and computes', () => {
    const r = v({ ne: '1,95', abbe: '' });
    expect(r.fields.ne).toEqual({ tier: TIERS.HINT, code: VAL_CODES.VAL_CUSTOM_IMPLAUSIBLE, data: { field: 'ne', value: 1.95, min: 1.49, max: 1.9 } });
    expect(r.blocked).toBe(false);
    expect(r.customMaterial).toEqual({ ne: 1.95, density: 1.32, ve: null });
  });

  test.each([
    ['ne', '2,1', 2.1, [1.4, 2]],
    ['ne', '1,39', 1.39, [1.4, 2]],
    ['density', '0,7', 0.7, [0.8, 5]],
    ['density', '5,01', 5.01, [0.8, 5]],
    ['abbe', '12', 12, [15, 80]],
    ['abbe', '81', 81, [15, 80]],
  ])('%s %s is a Fehler that blocks', (field, raw, value, [min, max]) => {
    const r = v({ [field]: raw });
    expect(r.fields[field]).toEqual({ tier: TIERS.ERROR, code: VAL_CODES.VAL_CUSTOM_OUT_OF_RANGE, data: { field, value, min, max } });
    expect(r.blocked).toBe(true);
    expect(r.customMaterial).toBeNull();
  });

  test.each([
    ['ne', '1,45'],
    ['ne', '1,91'],
    ['density', '0,9'],
    ['density', '4,2'],
    ['abbe', '20'],
    ['abbe', '70'],
  ])('%s %s is a Hinweis that computes', (field, raw) => {
    const r = v({ [field]: raw });
    expect(r.fields[field]).toMatchObject({ tier: TIERS.HINT, code: VAL_CODES.VAL_CUSTOM_IMPLAUSIBLE, data: { field } });
    expect(r.blocked).toBe(false);
  });

  test('band edges are inside (2,00 is a Hinweis, 1,49 and 1,90 are fine)', () => {
    expect(v({ ne: '2' }).fields.ne.tier).toBe(TIERS.HINT);
    expect(v({ ne: '1,49' }).fields.ne).toBeNull();
    expect(v({ ne: '1,9' }).fields.ne).toBeNull();
    expect(v({ density: '0,8' }).fields.density.tier).toBe(TIERS.HINT);
    expect(v({ abbe: '15' }).fields.abbe.tier).toBe(TIERS.HINT);
  });

  test('empty ne or density is a Fehler (required); empty Abbe is ve null', () => {
    expect(v({ ne: '' }).fields.ne).toEqual({ tier: TIERS.ERROR, code: PARSE_CODES.PARSE_EMPTY, data: {} });
    expect(v({ ne: '' }).blocked).toBe(true);
    expect(v({ density: ' ' }).fields.density.code).toBe(PARSE_CODES.PARSE_EMPTY);
    const r = v({ abbe: '' });
    expect(r.fields.abbe).toBeNull();
    expect(r.customMaterial.ve).toBeNull();
  });

  test('parse errors block', () => {
    expect(v({ ne: '1,5234' }).fields.ne.code).toBe(PARSE_CODES.PARSE_TOO_MANY_DECIMALS);
    expect(v({ density: 'abc' }).fields.density.code).toBe(PARSE_CODES.PARSE_NOT_A_NUMBER);
    expect(v({ abbe: '58,55' }).blocked).toBe(true);
  });

  test('empty minimum thicknesses use the nearest listed material (prefill rule); bad ones block', () => {
    const r = v({ ne: '1,62', minCT: '', minET: '' });
    expect(r.minCT).toBe(MATERIALS_FOR_TEST.idx160.minCT);
    expect(r.minET).toBe(MATERIALS_FOR_TEST.idx160.minET);
    expect(r.blocked).toBe(false);
    const bad = v({ minCT: '9' });
    expect(bad.fields.minCT.code).toBe(VAL_CODES.VAL_MINTHICKNESS_OUT_OF_MODEL);
    expect(bad.blocked).toBe(true);
    expect(v({ minET: 'x' }).blocked).toBe(true);
  });

  test('nearestListedMaterial: nearest ne, tie → lower index', () => {
    expect(nearestListedMaterial(1.62)).toBe('idx160');
    expect(nearestListedMaterial(1.5)).toBe('cr39');
    expect(nearestListedMaterial(1.523)).toBe('trivex');
    expect(nearestListedMaterial(1.515)).toBe('cr39'); // |1,515−1,5| = |1,515−1,53|: lower index
    expect(nearestListedMaterial(1.95)).toBe('idx174');
    expect(nearestListedMaterial(1.2)).toBe('cr39');
  });

  test('never throws on arbitrary text (property)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (a, b, c) => {
        const r = validateCustomMaterial({ ne: a, density: b, abbe: c, minCT: '', minET: '' });
        expect(typeof r.blocked).toBe('boolean');
      }),
      { numRuns: 300, seed: 1201 },
    );
  });
});
