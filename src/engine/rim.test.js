import { describe, it, expect } from 'vitest';
import { RIM_DEPTH_DEFAULT_MM, edgeBeyondRim } from './rim.js';

describe('FRAME-02 rim depth helper (02-11)', () => {
  it('default rim depth is the assumed 3 mm', () => expect(RIM_DEPTH_DEFAULT_MM).toBe(3));
  it('excess of the thickest edge point over the rim depth', () => {
    expect(edgeBeyondRim({ etMax: { value: 4.6 } }, 3.0)).toBeCloseTo(1.6, 12);
  });
  it('0 when the edge fits', () => {
    expect(edgeBeyondRim({ etMax: { value: 4.6 } }, 5)).toBe(0);
    expect(edgeBeyondRim({ etMax: { value: 3 } }, 3)).toBe(0);
  });
});
