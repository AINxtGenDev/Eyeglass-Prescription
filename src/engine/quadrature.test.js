import { describe, it, expect } from 'vitest';
import { GL24 } from './quadrature.js';

describe('ENG-06 quadrature', () => {
  it('has 24 frozen nodes in (−1, 1)', () => {
    expect(GL24.x).toHaveLength(24);
    expect(GL24.w).toHaveLength(24);
    expect(Object.isFrozen(GL24)).toBe(true);
    for (const x of GL24.x) expect(Math.abs(x)).toBeLessThan(1);
  });
  it('weights sum to 2', () => {
    const s = GL24.w.reduce((a, b) => a + b, 0);
    expect(Math.abs(s - 2)).toBeLessThan(1e-14);
  });
  it('integrates x^46 on [−1, 1] exactly', () => {
    let s = 0;
    for (let i = 0; i < 24; i++) s += GL24.w[i] * GL24.x[i] ** 46;
    expect(Math.abs(s - 2 / 47)).toBeLessThan(1e-13);
  });
});
