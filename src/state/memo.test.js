import { describe, test, expect, vi } from 'vitest';
import { memoLast } from './memo.js';

const spec = (A = 52) => ({ eye: 'OD', sph: -4, frame: { shape: 'rechteckig', A, B: 38, DBL: 18 } });

describe('memoLast (01-14, per-eye reuse)', () => {
  test('deep-equal spec (distinct object) → fn called once, same result object', () => {
    const fn = vi.fn((s) => ({ value: s.sph }));
    const m = memoLast(fn);
    const a = m(spec());
    const b = m(spec());
    expect(fn).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  test('a nested change (frame.A) recomputes', () => {
    const fn = vi.fn((s) => ({ A: s.frame.A }));
    const m = memoLast(fn);
    const a = m(spec(52));
    const b = m(spec(53));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(b).not.toBe(a);
    expect(b.A).toBe(53);
  });

  test('two instances are independent', () => {
    const fn = vi.fn((s) => ({ A: s.frame.A }));
    const m1 = memoLast(fn);
    const m2 = memoLast(fn);
    const a = m1(spec());
    const b = m2(spec());
    expect(fn).toHaveBeenCalledTimes(2);
    expect(b).not.toBe(a);
    expect(m1(spec())).toBe(a);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
