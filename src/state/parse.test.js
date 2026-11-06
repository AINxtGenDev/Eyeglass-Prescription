import { describe, test, expect } from 'vitest';
import { parseDiopter, parseAxis, parseMm, PARSE_CODES } from './parse.js';

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
