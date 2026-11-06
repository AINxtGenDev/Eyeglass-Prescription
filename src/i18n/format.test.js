import { describe, test, expect } from 'vitest';
import { fmtDiopter, fmtAxis, fmtMm, fmtGram, fmtMs } from './format.js';

const NBSP = ' ';
const MINUS = '−';

describe('fmtDiopter (L10N-01)', () => {
  test.each([
    [-2.25, `${MINUS}2,25${NBSP}dpt`],
    [2.25, `+2,25${NBSP}dpt`],
    [0, `0,00${NBSP}dpt`],
    [-0, `0,00${NBSP}dpt`],
    [-0.001, `0,00${NBSP}dpt`],
    [-0.005, `${MINUS}0,01${NBSP}dpt`],
  ])('%d -> %j', (v, s) => {
    expect(fmtDiopter(v)).toBe(s);
  });
});

describe('fmtMm / fmtAxis / fmtGram / fmtMs', () => {
  test.each([
    [1.84, `1,8${NBSP}mm`],
    [-0.04, `0,0${NBSP}mm`],
    [12345.6, `12${NBSP}345,6${NBSP}mm`],
  ])('fmtMm(%d) -> %j', (v, s) => {
    expect(fmtMm(v)).toBe(s);
  });

  test.each([
    [0, '180°'],
    [90, '90°'],
  ])('fmtAxis(%d) -> %j', (v, s) => {
    expect(fmtAxis(v)).toBe(s);
  });

  test('fmtGram(12.34)', () => expect(fmtGram(12.34)).toBe(`12,3${NBSP}g`));
  test('fmtMs(1.234)', () => expect(fmtMs(1.234)).toBe(`1,23${NBSP}ms`));
});
