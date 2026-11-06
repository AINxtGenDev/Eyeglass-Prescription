import { describe, it, expect } from 'vitest';
import { DIAGNOSTICS, diag, STOCK_BLANK_MAX_MM } from './diagnostics.js';

describe('ENG-07 catalogue', () => {
  it('diag() builds a coded diagnostic', () => {
    expect(diag('CT_SET_BY_MIN_ET', {})).toEqual({
      code: 'CT_SET_BY_MIN_ET',
      severity: 'info',
      data: {},
    });
    expect(diag('INVALID_SPEC')).toEqual({ code: 'INVALID_SPEC', severity: 'error', data: {} });
  });
  it('diag() throws on an unknown code', () => {
    expect(() => diag('NOPE')).toThrow();
  });
  it('BASE_CURVE_CLAMPED is removed (D-01 final)', () => {
    expect(Object.keys(DIAGNOSTICS)).not.toContain('BASE_CURVE_CLAMPED');
  });
  it('every entry is frozen with a valid severity', () => {
    expect(Object.isFrozen(DIAGNOSTICS)).toBe(true);
    for (const [code, entry] of Object.entries(DIAGNOSTICS)) {
      expect(Object.isFrozen(entry), code).toBe(true);
      expect(['error', 'warn', 'info']).toContain(entry.severity);
    }
  });
  it('severities match the catalogue', () => {
    expect(DIAGNOSTICS.BLANK_EXCEEDS_STOCK.severity).toBe('warn');
    expect(DIAGNOSTICS.OC_OUTSIDE_OUTLINE.severity).toBe('warn');
    expect(DIAGNOSTICS.FRONT_SAG_UNDEFINED.severity).toBe('error');
    expect(DIAGNOSTICS.NON_FINITE_RESULT.severity).toBe('error');
    expect(DIAGNOSTICS.CT_SET_BY_MIN_CT.severity).toBe('info');
    expect(STOCK_BLANK_MAX_MM).toBe(75);
  });
});
