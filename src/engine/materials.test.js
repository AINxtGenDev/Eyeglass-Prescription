import { describe, it, expect } from 'vitest';
import { MATERIALS } from './materials.js';

describe('MAT-01 materials', () => {
  it('cr39 has the cited Zeiss values', () => {
    const m = MATERIALS.cr39;
    expect(m.id).toBe('cr39');
    expect(m.ne).toBe(1.5);
    expect(m.nd).toBe(1.499);
    expect(m.ve).toBe(56);
    expect(m.vd).toBe(58);
    expect(m.density).toBe(1.32);
    expect(m.minCT).toBe(1.8);
    expect(m.minET).toBe(1.0);
    expect(typeof m.source.doc).toBe('string');
    expect(m.source.url).toMatch(/fsv2023\.pdf$/);
    expect(typeof m.source.page).toBe('string');
  });
  it('MATERIALS and its rows are frozen', () => {
    expect(Object.isFrozen(MATERIALS)).toBe(true);
    expect(Object.isFrozen(MATERIALS.cr39)).toBe(true);
    expect(Object.isFrozen(MATERIALS.cr39.source)).toBe(true);
  });
});
