import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { parseDiopter, parseAxis, parseMm, parsePd, parseStamp, parseIndex, parseDensity, parseAbbe, PARSE_CODES, PD_CODES, STAMP_CODES } from './parse.js';

const ok = (value) => ({ ok: true, value });
const err = (code) => ({ ok: false, code });

describe('parseDiopter (RX-02)', () => {
  test.each([
    ['-2,25', -2.25],
    ['−2.25', -2.25], // U+2212 minus sign
    ['+1', 1],
    ['1,5 dpt', 1.5],
    ['-2.25 D', -2.25],
    ['plan', 0],
    ['pl', 0],
    ['Plano', 0],
    ['±0', 0], // ±0
    ['–2,25', -2.25], // U+2013 en dash
    ['‒2,25', -2.25], // U+2012 figure dash
    ['‐2,25', -2.25], // U+2010 hyphen
    ['﹣2,25', -2.25], // U+FE63 small hyphen-minus
    ['－2,25', -2.25], // U+FF0D fullwidth hyphen-minus
  ])('%j -> %d', (raw, value) => {
    expect(parseDiopter(raw)).toEqual(ok(value));
  });

  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['   ', PARSE_CODES.PARSE_EMPTY],
    ['abc', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['1.000,25', PARSE_CODES.PARSE_MIXED_SEPARATORS],
    ['-2,255', PARSE_CODES.PARSE_TOO_MANY_DECIMALS],
    ['2,25-', PARSE_CODES.PARSE_NOT_A_NUMBER],
  ])('%j -> %s', (raw, code) => {
    expect(parseDiopter(raw)).toEqual(err(code));
  });

  test('-0,00 parses to +0, never -0', () => {
    expect(parseDiopter('-0,00')).toEqual(ok(0)); // toEqual distinguishes -0 from +0
  });
});

describe('parseAxis', () => {
  test.each([
    ['90', 90],
    ['x180', 0],
    ['×45', 45], // ×45
    ['@10', 10],
    ['180°', 0], // 180°
    ['0', 0],
  ])('%j -> %d', (raw, value) => {
    expect(parseAxis(raw)).toEqual(ok(value));
  });

  test.each([
    ['181', PARSE_CODES.PARSE_AXIS_OUT_OF_RANGE],
    // 01-13 MINOR-5: an axis that is not whole degrees 0–180 gets its own message
    ['45,5', PARSE_CODES.PARSE_AXIS_INVALID],
    ['90,5', PARSE_CODES.PARSE_AXIS_INVALID],
    ['-90', PARSE_CODES.PARSE_AXIS_INVALID],
    ['−90', PARSE_CODES.PARSE_AXIS_INVALID],
    ['abc', PARSE_CODES.PARSE_AXIS_INVALID],
    ['', PARSE_CODES.PARSE_EMPTY],
  ])('%j -> %s', (raw, code) => {
    expect(parseAxis(raw)).toEqual(err(code));
  });
});

describe('parseMm', () => {
  test.each([
    ['32', 32],
    ['32,5', 32.5],
    ['32.5 mm', 32.5],
  ])('%j -> %d', (raw, value) => {
    expect(parseMm(raw)).toEqual(ok(value));
  });

  test.each([
    ['1.000,5', PARSE_CODES.PARSE_MIXED_SEPARATORS],
    ['abc', PARSE_CODES.PARSE_NOT_A_NUMBER],
  ])('%j -> %s', (raw, code) => {
    expect(parseMm(raw)).toEqual(err(code));
  });
});

test('PARSE_CODES is frozen and keys equal values', () => {
  expect(Object.isFrozen(PARSE_CODES)).toBe(true);
  for (const [k, v] of Object.entries(PARSE_CODES)) expect(v).toBe(k);
});

describe('parsePd (RX-06, D-05): never guesses', () => {
  test.each([
    ['32/33', { ok: true, kind: 'mono-pair', OD: 32, OS: 33 }],
    ['32,5/33', { ok: true, kind: 'mono-pair', OD: 32.5, OS: 33 }],
    [' 31,5 / 32 ', { ok: true, kind: 'mono-pair', OD: 31.5, OS: 32 }],
    ['64', { ok: true, kind: 'binocular', total: 64, OD: 32, OS: 32 }],
    ['63', { ok: true, kind: 'binocular', total: 63, OD: 31.5, OS: 31.5 }],
    ['64,5', { ok: true, kind: 'binocular', total: 64.5, OD: 32.5, OS: 32.5 }], // halves on 0,5 mm
    ['50', { ok: true, kind: 'binocular', total: 50, OD: 25, OS: 25 }],
    ['32,5', { ok: true, kind: 'mono', value: 32.5 }],
    ['40', { ok: true, kind: 'mono', value: 40 }],
    ['21', { ok: true, kind: 'mono', value: 21 }],
    ['5', { ok: true, kind: 'mono', value: 5 }], // out of model, validate's job
    ['32 mm', { ok: true, kind: 'mono', value: 32 }],
  ])('%j', (raw, want) => {
    expect(parsePd(raw)).toEqual(want);
  });

  test.each([
    ['45', PD_CODES.PD_AMBIGUOUS, { value: 45 }],
    ['40,5', PD_CODES.PD_AMBIGUOUS, { value: 40.5 }],
    ['49,5', PD_CODES.PD_AMBIGUOUS, { value: 49.5 }],
    ['64/61', PD_CODES.PD_DISTANCE_NEAR, { value: 64 }],
    ['61/64', PD_CODES.PD_DISTANCE_NEAR, { value: 64 }],
    ['64/32', PD_CODES.PD_AMBIGUOUS, { value: 64 }], // one value of each kind: ask
    ['12', PD_CODES.PD_LOOKS_LIKE_HSA, { value: 12 }],
    ['8', PD_CODES.PD_LOOKS_LIKE_HSA, { value: 8 }],
    ['20', PD_CODES.PD_LOOKS_LIKE_HSA, { value: 20 }],
  ])('%j -> %s', (raw, code, data) => {
    expect(parsePd(raw)).toEqual({ ok: false, code, data });
  });

  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['   ', PARSE_CODES.PARSE_EMPTY],
    ['abc', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['32/', PARSE_CODES.PARSE_NOT_A_NUMBER], // a pair half that is empty is not an empty field
    ['/33', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['32/33/34', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['32,55', PARSE_CODES.PARSE_TOO_MANY_DECIMALS],
    ['3'.repeat(33), PARSE_CODES.PARSE_NOT_A_NUMBER], // length cap before any regex (T-02-12)
  ])('%j -> %s', (raw, code) => {
    expect(parsePd(raw)).toEqual(err(code));
  });
});

describe('parseStamp (FRAME-03, D-11)', () => {
  test.each([
    ['52□18 140', 140],
    ['52-18-140', 140],
    ['52 18 140', 140],
    ['52/18 145', 145],
    ['52 [] 18', null],
    ['52[]18', null],
    ['52x18', null],
    ['52X18', null],
    ['52 □ 18', null],
    ['52▢18', null],
    ['52◻18', null],
    ['52☐18', null],
    ['52–18–140', 140], // en dash
    [' 52□18  140 ', 140],
  ])('%j -> A 52, DBL 18, temple %s', (raw, temple) => {
    expect(parseStamp(raw)).toEqual({ ok: true, A: 52, DBL: 18, temple });
  });

  test('swapped numbers give the corrected values, never applied silently', () => {
    expect(parseStamp('18□52')).toEqual({ ok: false, code: STAMP_CODES.STAMP_SWAPPED, data: { A: 52, DBL: 18, temple: null } });
    expect(parseStamp('16□56 145')).toEqual({ ok: false, code: STAMP_CODES.STAMP_SWAPPED, data: { A: 56, DBL: 16, temple: 145 } });
  });

  test('numbers outside the model ranges still parse (the range check is validate\'s job)', () => {
    expect(parseStamp('70□10')).toEqual({ ok: true, A: 70, DBL: 10, temple: null });
  });

  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['52', STAMP_CODES.STAMP_INVALID],
    ['52□', STAMP_CODES.STAMP_INVALID],
    ['52,5□18', STAMP_CODES.STAMP_INVALID],
    ['520□18', STAMP_CODES.STAMP_INVALID],
    ['52□18 1400', STAMP_CODES.STAMP_INVALID],
    ['abc', STAMP_CODES.STAMP_INVALID],
    ['52 18 140 5', STAMP_CODES.STAMP_INVALID],
    ['5'.repeat(33), STAMP_CODES.STAMP_INVALID], // length cap (T-02-12)
  ])('%j -> %s', (raw, code) => {
    expect(parseStamp(raw)).toEqual(err(code));
  });
});

test('PD_CODES and STAMP_CODES are frozen and keys equal values', () => {
  for (const codes of [PD_CODES, STAMP_CODES]) {
    expect(Object.isFrozen(codes)).toBe(true);
    for (const [k, v] of Object.entries(codes)) expect(v).toBe(k);
  }
});

test('parsePd and parseStamp never throw on random strings (T-02-12)', () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 64 }), (s) => {
      for (const r of [parsePd(s), parseStamp(s)]) expect(typeof r.ok).toBe('boolean');
    }),
    { numRuns: 500 },
  );
});

describe('custom material parsers (02-12, MAT-06)', () => {
  test.each([
    ['1,523', 1.523],
    ['1.6', 1.6],
    ['1', 1],
    [' 1,50 ', 1.5],
  ])('parseIndex(%j) -> %s', (raw, v) => expect(parseIndex(raw)).toEqual(ok(v)));
  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['1,5234', PARSE_CODES.PARSE_TOO_MANY_DECIMALS],
    ['1.5,2', PARSE_CODES.PARSE_MIXED_SEPARATORS],
    ['15', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['-1,5', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['1,'.padEnd(33, '5'), PARSE_CODES.PARSE_NOT_A_NUMBER],
  ])('parseIndex(%j) -> %s', (raw, code) => expect(parseIndex(raw)).toEqual(err(code)));

  test.each([
    ['2,54', 2.54],
    ['1.32', 1.32],
    ['2,5 g/cm³', 2.5],
    ['1,2g/cm3', 1.2],
    ['3', 3],
  ])('parseDensity(%j) -> %s', (raw, v) => expect(parseDensity(raw)).toEqual(ok(v)));
  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['2,545', PARSE_CODES.PARSE_TOO_MANY_DECIMALS],
    ['12', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['x', PARSE_CODES.PARSE_NOT_A_NUMBER],
  ])('parseDensity(%j) -> %s', (raw, code) => expect(parseDensity(raw)).toEqual(err(code)));

  test.each([
    ['58', 58],
    ['58,5', 58.5],
    ['5', 5],
  ])('parseAbbe(%j) -> %s', (raw, v) => expect(parseAbbe(raw)).toEqual(ok(v)));
  test.each([
    ['', PARSE_CODES.PARSE_EMPTY],
    ['58,55', PARSE_CODES.PARSE_TOO_MANY_DECIMALS],
    ['158', PARSE_CODES.PARSE_NOT_A_NUMBER],
    ['-5', PARSE_CODES.PARSE_NOT_A_NUMBER],
  ])('parseAbbe(%j) -> %s', (raw, code) => expect(parseAbbe(raw)).toEqual(err(code)));

  test('never throw and return ok/code shapes on any string, including long ones (T-02-34)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        for (const f of [parseIndex, parseDensity, parseAbbe]) {
          const r = f(s);
          expect(r.ok ? Number.isFinite(r.value) : typeof r.code === 'string').toBe(true);
        }
      }),
      { numRuns: 500, seed: 1202 },
    );
    for (const f of [parseIndex, parseDensity, parseAbbe]) expect(f('1'.repeat(10000))).toEqual(err(PARSE_CODES.PARSE_NOT_A_NUMBER));
  });
});
