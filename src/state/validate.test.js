import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { validateRxEye, VAL_CODES, TIERS, RX_RANGES, STEP_DPT } from './validate.js';
import { PARSE_CODES } from './parse.js';
import { RX_CODES } from './transpose.js';

const eye = (sph, cyl = '', axis = '', pd = '32') => validateRxEye({ sph, cyl, axis, pd });

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

describe('PD per eye', () => {
  test.each(['24,5', '40,5'])('%s → out of model', (pd) => {
    const r = eye('-1', '', '', pd);
    expect(r.fields.pd).toMatchObject({ tier: 'out-of-model', code: 'VAL_PD_OUT_OF_MODEL', data: { min: 25, max: 40 } });
    expect(r.blocked.pd).toBe(true);
    expect(r.pd).toBeNull();
    expect(r.blocked.rx).toBe(false);
  });
  test.each([['25', 25], ['40', 40], ['31,5', 31.5]])('%s inside', (pd, v) => {
    const r = eye('-1', '', '', pd);
    expect(r.fields.pd).toBeNull();
    expect(r.pd).toBe(v);
  });
  test('blank PD → PARSE_EMPTY error', () => {
    expect(eye('-1', '', '', '').fields.pd).toMatchObject({ tier: 'error', code: 'PARSE_EMPTY' });
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
        fc.string({ maxLength: 64 }),
        (sph, cyl, axis, pd) => {
          const r = validateRxEye({ sph, cyl, axis, pd });
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
