import { describe, it, expect } from 'vitest';
import { TIER_SETTINGS, pickTier, stepDown, dispersionFor, REF_TIER_ORDER, refStartTier, refStepDown, refChartPx } from './tiers.js';
import { REF_GRID_TIERS } from '../../engine/warp.js';

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

// 04-10 (D-15, PATTERNS bite 10): the Durchblick grid tiers share the word 'mittel' with the quality
// tiers but are a separate table; a grid tier never passes through stepDown.
describe('D-15 Durchblick grid tiers (04-10)', () => {
  it('REF_TIER_ORDER is fein → mittel → grob and names exactly the REF_GRID_TIERS keys', () => {
    expect(REF_TIER_ORDER).toEqual(['fein', 'mittel', 'grob']);
    expect(Object.isFrozen(REF_TIER_ORDER)).toBe(true);
    expect([...REF_TIER_ORDER].sort()).toEqual(Object.keys(REF_GRID_TIERS).sort());
  });

  it('refStartTier: fein on the hoch device class, mittel on phones', () => {
    expect(refStartTier('hoch')).toBe('fein');
    expect(refStartTier('mittel')).toBe('mittel');
    expect(refStartTier('sparsam')).toBe('mittel');
    expect(refStartTier(pickTier({ coarse: true, minScreen: 360 }))).toBe('mittel');
    expect(refStartTier(pickTier({ coarse: false, minScreen: 1080 }))).toBe('fein');
  });

  it('refChartPx (04-16, MAJOR 2): 2048 on the phone start tier, 4096 on fein, capped by the device', () => {
    expect(refChartPx('fein', 16384)).toBe(4096);
    expect(refChartPx('fein', 4096)).toBe(4096);
    expect(refChartPx('fein', 2048)).toBe(2048);
    expect(refChartPx('mittel', 16384)).toBe(2048);
    expect(refChartPx('mittel', 1024)).toBe(1024);
    expect(refChartPx(refStartTier(pickTier({ coarse: true, minScreen: 360 })), 16384)).toBe(2048);
    expect(refChartPx(refStartTier(pickTier({ coarse: false, minScreen: 1080 })), 16384)).toBe(4096);
  });

  it('refStepDown goes one grid tier at a time and stays at grob', () => {
    expect(refStepDown('fein')).toBe('mittel');
    expect(refStepDown('mittel')).toBe('grob');
    expect(refStepDown('grob')).toBe('grob');
  });

  it('grid and quality tiers never mix: separate functions, refStartTier never returns a quality tier', () => {
    expect(refStepDown).not.toBe(stepDown);
    for (const q of Object.keys(TIER_SETTINGS)) {
      const g = refStartTier(q);
      expect(['hoch', 'sparsam']).not.toContain(g);
      expect(REF_TIER_ORDER).toContain(g);
    }
    for (const g of REF_TIER_ORDER) expect(REF_TIER_ORDER).toContain(refStepDown(g));
  });
});
