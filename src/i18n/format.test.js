import { describe, test, expect } from 'vitest';
import { fmtDiopter, fmtAxis, fmtMm, fmtGram, fmtGramWhole, fmtMs, fmtConic, fmtIsoValue, fmtIsoStep, fmtPercent } from './format.js';

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

describe('fmtGramWhole (RES-01, whole grams)', () => {
  test.each([
    [6.86, `7${NBSP}g`],
    [0.5, `1${NBSP}g`],
    [12.5, `13${NBSP}g`],
    [7.23, `7${NBSP}g`],
  ])('fmtGramWhole(%d) -> %j', (v, s) => {
    expect(fmtGramWhole(v)).toBe(s);
  });
  test('below 0,5 g: null (caller shows "unter 1 g")', () => {
    expect(fmtGramWhole(0.49)).toBeNull();
    expect(fmtGramWhole(0)).toBeNull();
  });
});

describe('fmtConic (MAT-05, no unit)', () => {
  test.each([
    [-1, '−1,0'],
    [-5, '−5,0'],
    [-2.25, '−2,3'],
    [0, '0,0'],
    [-0, '0,0'],
  ])('fmtConic(%d) -> %j', (v, s) => expect(fmtConic(v)).toBe(s));
});

describe('fmtIsoValue / fmtIsoStep (03-12, VIZ-05 iso lines: 1–2 decimals)', () => {
  test.each([
    [2.5, '2,5'],
    [2.25, '2,25'],
    [3, '3,0'],
    [0.1, '0,1'],
  ])('fmtIsoValue(%d) -> %j', (v, s) => {
    expect(fmtIsoValue(v)).toBe(s);
  });
  test.each([
    [0.25, `0,25${NBSP}mm`],
    [1, `1,0${NBSP}mm`],
    [0.5, `0,5${NBSP}mm`],
  ])('fmtIsoStep(%d) -> %j', (v, s) => {
    expect(fmtIsoStep(v)).toBe(s);
  });
});

describe('fmtPercent (04-01, UI-SPEC MINOR 5: one decimal below 3 %, whole percent from 3 %)', () => {
  test.each([
    [0.02949, `2,9${NBSP}%`],
    [0.0296, `3${NBSP}%`],
    [0.056037, `6${NBSP}%`],
    [0.12991, `13${NBSP}%`],
    [0.0006, `0,1${NBSP}%`],
    [0.00004, `0,0${NBSP}%`],
    [0, `0,0${NBSP}%`],
    [0.014187, `1,4${NBSP}%`],
    [0.077669, `8${NBSP}%`],
  ])('fmtPercent(%d) -> %j', (v, s) => {
    expect(fmtPercent(v)).toBe(s);
  });
});
