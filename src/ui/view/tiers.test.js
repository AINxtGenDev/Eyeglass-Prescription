import { describe, it, expect } from 'vitest';
import { TIER_SETTINGS, pickTier, stepDown, dispersionFor } from './tiers.js';

describe('D-12 quality tiers (03-08)', () => {
  it('pickTier: only a coarse primary pointer on a small screen is a phone (mittel)', () => {
    expect(pickTier({ coarse: false, minScreen: 1080 })).toBe('hoch');
    expect(pickTier({ coarse: true, minScreen: 412 })).toBe('mittel');
    expect(pickTier({ coarse: true, minScreen: 800 })).toBe('hoch'); // tablet
    expect(pickTier({ coarse: false, minScreen: 360 })).toBe('hoch');
    expect(pickTier({ coarse: true, minScreen: 767 })).toBe('mittel');
    expect(pickTier({ coarse: true, minScreen: 768 })).toBe('hoch');
  });

  it('TIER_SETTINGS match the UI-SPEC table and are frozen', () => {
    expect(TIER_SETTINGS.hoch).toEqual({ pixelRatioMax: 2, transmissionScale: 1, dispersion: true, chart: [2048, 1366] });
    expect(TIER_SETTINGS.mittel).toEqual({ pixelRatioMax: 1.5, transmissionScale: 0.5, dispersion: false, chart: [1024, 683] });
    expect(TIER_SETTINGS.sparsam).toEqual({ pixelRatioMax: 1, transmissionScale: 0.35, dispersion: false, chart: [1024, 683] });
    expect(Object.isFrozen(TIER_SETTINGS)).toBe(true);
    for (const s of Object.values(TIER_SETTINGS)) {
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.chart)).toBe(true);
    }
  });

  it('stepDown goes one tier at a time and never below sparsam', () => {
    expect(stepDown('hoch')).toBe('mittel');
    expect(stepDown('mittel')).toBe('sparsam');
    expect(stepDown('sparsam')).toBe('sparsam');
  });

  it('dispersionFor: 20/ν on hoch only, 0 without an Abbe number', () => {
    expect(dispersionFor('hoch', 56)).toBe(20 / 56);
    expect(dispersionFor('hoch', null)).toBe(0);
    expect(dispersionFor('hoch', undefined)).toBe(0);
    expect(dispersionFor('mittel', 56)).toBe(0);
    expect(dispersionFor('sparsam', 56)).toBe(0);
  });
});
