import { describe, it, expect } from 'vitest';
import { sphereSag } from './sag.js';

describe('ENG-02 sphere sag', () => {
  it('matches the closed form c = 0.01, r² = 100', () => {
    expect(Math.abs(sphereSag(0.01, 100) - 0.5012562893)).toBeLessThan(1e-9);
  });
  it('plano surface gives exactly 0', () => {
    expect(sphereSag(0, 400)).toBe(0);
  });
  it('is continuous for tiny curvature (no NaN)', () => {
    const s = sphereSag(1e-12, 400);
    expect(Number.isNaN(s)).toBe(false);
    expect(s).toBeCloseTo(2e-10, 20);
  });
  it('returns NaN on domain violation (q < 0)', () => {
    expect(Number.isNaN(sphereSag(0.05, 500))).toBe(true);
  });
  it('paraboloid (k = −1) gives c·r²/2', () => {
    expect(sphereSag(0.02, 900, -1)).toBeCloseTo((0.02 * 900) / 2, 12);
  });
});
