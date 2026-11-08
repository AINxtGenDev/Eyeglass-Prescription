// 03-12 (D-22, VIZ-05): the cividis LUT shared by the heat shader and the legend.
import { describe, test, expect } from 'vitest';
import { CIVIDIS_HEX, CIVIDIS_UNIFORM, cividisRGB, isoLineColour } from './cividis.js';

const UI_SPEC = ['#00224e', '#083370', '#35456c', '#4f576c', '#666970', '#7d7c78', '#948e77', '#aea371', '#c8b866', '#e5cf52', '#fee838'];

/** WCAG 2.x relative luminance of an sRGB triple 0…255. */
function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

describe('cividis LUT (UI-SPEC Heatmap colours)', () => {
  test('11 stops in the UI-SPEC order', () => {
    expect([...CIVIDIS_HEX]).toEqual(UI_SPEC);
  });

  test('ends and the first midpoint', () => {
    expect(cividisRGB(0)).toEqual([0x00, 0x22, 0x4e]);
    expect(cividisRGB(1)).toEqual([0xfe, 0xe8, 0x38]);
    const mid = cividisRGB(0.05);
    const want = [(0x00 + 0x08) / 2, (0x22 + 0x33) / 2, (0x4e + 0x70) / 2];
    for (let i = 0; i < 3; i++) expect(Math.abs(mid[i] - want[i])).toBeLessThanOrEqual(0.5);
  });

  test('clamps outside 0…1', () => {
    expect(cividisRGB(-1)).toEqual(cividisRGB(0));
    expect(cividisRGB(2)).toEqual(cividisRGB(1));
  });

  test('luminance strictly increasing over 101 samples (greyscale-readable)', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const L = luminance(cividisRGB(i / 100));
      expect(L).toBeGreaterThan(prev);
      prev = L;
    }
  });

  test('CIVIDIS_UNIFORM: 33 raw sRGB floats in 0…1, no linearisation', () => {
    expect(CIVIDIS_UNIFORM).toBeInstanceOf(Float32Array);
    expect(CIVIDIS_UNIFORM.length).toBe(33);
    for (const v of CIVIDIS_UNIFORM) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // stop 1 = #083370: raw 0x33 / 255, not its linear value (≈ 0,033)
    expect(CIVIDIS_UNIFORM[4]).toBeCloseTo(0x33 / 255, 6);
    expect(CIVIDIS_UNIFORM[30]).toBeCloseTo(0xfe / 255, 6);
  });

  test('iso-line colour: white below 0,5, #1a1a1a from 0,5', () => {
    expect(isoLineColour(0)).toBe('#ffffff');
    expect(isoLineColour(0.49)).toBe('#ffffff');
    expect(isoLineColour(0.5)).toBe('#1a1a1a');
    expect(isoLineColour(1)).toBe('#1a1a1a');
  });
});
