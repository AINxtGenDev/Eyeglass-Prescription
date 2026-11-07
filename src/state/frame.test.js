import { describe, test, expect } from 'vitest';
import { estimateB, PD_DEFAULT_MM, FRAME_RANGES } from './frame.js';
import { SHAPES } from '../engine/frame/shapes.js';

describe('estimateB (UI-SPEC tip B: B is rarely on the temple)', () => {
  test.each([
    ['rechteckig', 52, 38],
    ['rechteckig', 48, 35],
    ['rechteckig', 56, 41],
    ['rund', 48, 44],
    ['pilot', 50, 43],
  ])('%s, A %d → B %d (whole mm)', (shape, A, B) => {
    expect(estimateB(shape, A)).toBe(B);
  });
  test('each shape gives its own default B at its default A', () => {
    for (const [id, s] of Object.entries(SHAPES)) expect(estimateB(id, s.defaults.A), id).toBe(s.defaults.B);
  });
  test('unknown shape throws', () => {
    expect(() => estimateB('oval', 50)).toThrow(/oval/);
    expect(() => estimateB('__proto__', 50)).toThrow();
  });
});

describe('constants', () => {
  test('PD default is 32 mm per eye (D-06)', () => expect(PD_DEFAULT_MM).toBe(32));
  test('FRAME-02 ranges verbatim', () => {
    expect(FRAME_RANGES).toEqual({ A: [40, 62], B: [28, 55], DBL: [14, 24] });
    expect(Object.isFrozen(FRAME_RANGES)).toBe(true);
  });
});
