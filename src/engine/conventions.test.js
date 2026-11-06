import { describe, it, expect } from 'vitest';
import { K, nasalSign, locationLabel } from './conventions.js';

describe('ENG-05 conventions', () => {
  it('K(n) = 1000·(n − 1)', () => {
    expect(K(1.5)).toBeCloseTo(500, 12);
  });
  it('nasalSign: OD +1, OS −1', () => {
    expect(nasalSign('OD')).toBe(1);
    expect(nasalSign('OS')).toBe(-1);
  });
  it('locationLabel uses the nasal sign of the eye', () => {
    expect(locationLabel(10, 0, 'OD')).toBe('nasal');
    expect(locationLabel(10, 0, 'OS')).toBe('temporal');
    expect(locationLabel(0, 10, 'OD')).toBe('superior');
    expect(locationLabel(0, -10, 'OS')).toBe('inferior');
    expect(locationLabel(-7, -7, 'OD')).toBe('temporal-inferior');
    expect(locationLabel(7, 7, 'OD')).toBe('nasal-superior');
    expect(locationLabel(7, -7, 'OD')).toBe('nasal-inferior');
    expect(locationLabel(-7, 7, 'OD')).toBe('temporal-superior');
    expect(locationLabel(-10, 0, 'OD')).toBe('temporal');
  });
});
