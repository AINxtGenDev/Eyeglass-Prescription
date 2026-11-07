// Display rules, thickest point and the L/R difference rule (02-01, RES-01, RES-04).
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { thickest, roundMm, roundG, LR_DIFF_MM, LR_DIFF_G, LR_PD_CAUSE_MM, lrCause, lrDifference } from './compare.js';
import { fmtMm } from '../i18n/format.js';

const intNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });

describe('thickest(m) = max(CT, thickest edge) (lens-critic B1)', () => {
  test('minus lens: the edge', () => {
    expect(
      thickest({
        ct: 1.8,
        etMax: { value: 4.597, location: 'temporal-superior' },
      }),
    ).toEqual({
      value: 4.597,
      where: 'temporal-superior',
    });
  });
  test('plus lens: the centre', () => {
    expect(thickest({ ct: 3.902, etMax: { value: 2.824, location: 'superior' } })).toEqual({
      value: 3.902,
      where: 'centre',
    });
  });
  test('tie CT = edge: the centre', () => {
    expect(thickest({ ct: 2.5, etMax: { value: 2.5, location: 'nasal' } }).where).toBe('centre');
  });
});

describe('display rounding agrees with the displayed text (Pitfall 10)', () => {
  test('roundMm: fmtMm(roundMm(v)) === fmtMm(v) for 0…60 mm, step 0,005', () => {
    for (let k = 0; k <= 12000; k++) {
      const v = k * 0.005;
      expect(fmtMm(roundMm(v))).toBe(fmtMm(v));
    }
  });
  test('roundG formats like intNf for 0…200 g, step 0,05', () => {
    for (let k = 0; k <= 4000; k++) {
      const v = k * 0.05;
      expect(intNf.format(roundG(v))).toBe(intNf.format(v));
    }
  });
});

describe('constants', () => {
  test('values', () => {
    expect(LR_DIFF_MM).toBe(1.0);
    expect(LR_DIFF_G).toBe(3);
    expect(LR_PD_CAUSE_MM).toBe(2);
  });
});

describe('lrDifference (RES-04)', () => {
  test('equal eyes: null', () => {
    expect(lrDifference({ thick: 4.6, weight: 7 }, { thick: 4.6, weight: 7 }, 'rx')).toBeNull();
  });
  test('1,0 mm thicker left glass', () => {
    expect(lrDifference({ thick: 3.4, weight: 6 }, { thick: 4.4, weight: 7 }, 'rx')).toEqual({
      kind: 'thickness',
      thicker: 'OS',
      diffMm: 1.0,
      cause: 'rx',
    });
  });
  test('3 g heavier left glass, thickness below the threshold', () => {
    expect(lrDifference({ thick: 3.0, weight: 9 }, { thick: 3.5, weight: 12 }, 'rx')).toEqual({
      kind: 'weight',
      heavier: 'OS',
      diffG: 3,
      cause: 'rx',
    });
  });
  test('thickness wins when both fire', () => {
    const r = lrDifference({ thick: 6.5, weight: 12 }, { thick: 5.0, weight: 8 }, 'pd');
    expect(r).toEqual({
      kind: 'thickness',
      thicker: 'OD',
      diffMm: 1.5,
      cause: 'pd',
    });
  });
  test('0,9 mm / 2 g: null', () => {
    expect(lrDifference({ thick: 3.0, weight: 6 }, { thick: 3.9, weight: 8 }, 'rx')).toBeNull();
  });
  test('R −2,00 / L −1,00 (displayed 3,7 / 2,8 mm, 6 / 5 g): null', () => {
    expect(lrDifference({ thick: 3.7, weight: 6 }, { thick: 2.8, weight: 5 }, 'rx')).toBeNull();
  });
  test('cause null: null', () => {
    expect(lrDifference({ thick: 3.0, weight: 6 }, { thick: 6.0, weight: 12 }, null)).toBeNull();
  });
  test('rounded difference: 2,8 − 1,8 fires (raw 0.9999999999999998, round 3 MINOR-2)', () => {
    expect(2.8 - 1.8).toBeLessThan(1);
    expect(lrDifference({ thick: 1.8, weight: 5 }, { thick: 2.8, weight: 5 }, 'rx')).toEqual({
      kind: 'thickness',
      thicker: 'OS',
      diffMm: 1.0,
      cause: 'rx',
    });
  });
  test('same Rx −10,00, PD 32 / 30,5: displayed 12,9 / 14,0 mm fires with cause pd', () => {
    const cause = lrCause(spec({ sph: -10, monoPD: 32 }), spec({ sph: -10, monoPD: 30.5 }));
    expect(cause).toBe('pd');
    expect(lrDifference({ thick: 12.9, weight: 13 }, { thick: 14.0, weight: 13 }, cause)).toEqual({
      kind: 'thickness',
      thicker: 'OS',
      diffMm: 1.1,
      cause: 'pd',
    });
  });
});

function spec(o) {
  return { sph: -2, cyl: 0, axisDeg: 0, monoPD: 32, fittingHeight: null, ...o };
}

describe('lrCause (lens-critic round 3 MAJOR-B)', () => {
  test.each([
    ['same Rx, PD 32 / 30,5', spec({ sph: -10 }), spec({ sph: -10, monoPD: 30.5 }), 'pd'],
    ['same Rx, PD 32 / 31,5', spec(), spec({ monoPD: 31.5 }), 'pd'],
    ['same Rx, fitting height 20 / 21', spec({ fittingHeight: 20 }), spec({ fittingHeight: 21 }), 'pd'],
    ['same Rx, fitting height null / 20', spec(), spec({ fittingHeight: 20 }), 'pd'],
    ['−2,00 / −3,00 with PD 32 / 31,5', spec(), spec({ sph: -3, monoPD: 31.5 }), 'rx'],
    ['−4,00 / −5,25 with PD 29 / 34', spec({ sph: -4, monoPD: 29 }), spec({ sph: -5.25, monoPD: 34 }), 'rx-pd'],
    ['Rx differs, |ΔPD| exactly 2', spec({ monoPD: 32 }), spec({ sph: -3, monoPD: 30 }), 'rx-pd'],
    ['Rx differs, fitting height 18 / 20', spec({ fittingHeight: 18 }), spec({ sph: -3, fittingHeight: 20 }), 'rx-pd'],
    ['Rx differs, fitting height null / 20', spec(), spec({ sph: -3, fittingHeight: 20 }), 'rx-pd'],
    ['Rx differs, fitting height 18 / 19', spec({ fittingHeight: 18 }), spec({ sph: -3, fittingHeight: 19 }), 'rx'],
    ['cyl differs', spec({ cyl: -0.5, axisDeg: 90 }), spec({ cyl: -0.75, axisDeg: 90 }), 'rx'],
    ['axis differs with cyl', spec({ cyl: -0.5, axisDeg: 90 }), spec({ cyl: -0.5, axisDeg: 80 }), 'rx'],
    ['axis ignored without cyl', spec({ axisDeg: 90 }), spec({ axisDeg: 10 }), null],
    ['axis 0 = 180 with cyl', spec({ cyl: -0.5, axisDeg: 0 }), spec({ cyl: -0.5, axisDeg: 180 }), null],
    ['nothing differs', spec(), spec(), null],
  ])('%s → %s', (_name, a, b, cause) => {
    expect(lrCause(a, b)).toBe(cause);
  });

  test("property: 'pd' exactly when the Rx is equal and PD or fitting height differ", () => {
    const side = fc.record({
      sph: fc.constantFrom(-4, -2),
      cyl: fc.constantFrom(0, -0.5),
      axisDeg: fc.constantFrom(0, 90, 180),
      monoPD: fc.constantFrom(30, 31.5, 32),
      fittingHeight: fc.constantFrom(null, 20, 21),
    });
    fc.assert(
      fc.property(side, side, (a, b) => {
        const axis = (s) => (s.cyl === 0 ? 0 : s.axisDeg % 180);
        const sameRx = a.sph === b.sph && a.cyl === b.cyl && axis(a) === axis(b);
        const placeDiffers = a.monoPD !== b.monoPD || a.fittingHeight !== b.fittingHeight;
        expect(lrCause(a, b) === 'pd').toBe(sameRx && placeDiffers);
      }),
      { numRuns: 500, seed: 31 },
    );
  });
});
