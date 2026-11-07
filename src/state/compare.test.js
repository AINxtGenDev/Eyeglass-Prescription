// Display rules, thickest point and the L/R difference rule (02-01, RES-01, RES-04).
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  thickest,
  roundMm,
  roundG,
  uniformEdge,
  LR_DIFF_MM,
  LR_DIFF_G,
  LR_PD_CAUSE_MM,
  lrCause,
  lrDifference,
  materialRows,
  thickerEye,
} from './compare.js';
import { specFor } from './bench-cases.js';
import { evaluateLens } from '../engine/evaluate.js';
import { MATERIALS } from '../engine/materials.js';
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

describe('uniformEdge(m): displayed thickest edge = thinnest edge', () => {
  const m = (max, min) => ({ etMax: { value: max }, etMin: { value: min } });
  test('rund 50/50/18, PD 34, −3,00: 3,692 / 3,692 → uniform', () => expect(uniformEdge(m(3.692, 3.692))).toBe(true));
  test('same display step → uniform (3,66 / 3,74 both show 3,7 mm)', () => expect(uniformEdge(m(3.74, 3.66))).toBe(true));
  test('example OD 4,597 / 2,980 → not uniform', () => expect(uniformEdge(m(4.597, 2.98))).toBe(false));
  test('agrees with the fmtMm strings', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 60, noNaN: true }), fc.double({ min: 0, max: 60, noNaN: true }), (a, b) => {
        const hi = Math.max(a, b);
        const lo = Math.min(a, b);
        expect(uniformEdge(m(hi, lo))).toBe(fmtMm(hi) === fmtMm(lo));
      }),
      { seed: 23, numRuns: 500 },
    );
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

// Material rows (02-06, RES-02, D-15/D-16). The fixtures are real engine results for every
// material, so the expected rows are pinned against the engine, not typed by hand.
describe('thickerEye: displayed thickest values, tie → OD', () => {
  test('tie → OD', () => expect(thickerEye({ OD: 4.6, OS: 4.6 })).toBe('OD'));
  test('OS thicker → OS', () => expect(thickerEye({ OD: 3.7, OS: 3.9 })).toBe('OS'));
  test('a missing eye → the other', () => {
    expect(thickerEye({ OD: null, OS: 2 })).toBe('OS');
    expect(thickerEye({ OD: 2, OS: null })).toBe('OD');
  });
});

describe('materialRows (02-06)', () => {
  const FRAME = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
  /** Engine results for all six materials, both eyes: { [id]: { OD, OS } }. */
  function byMaterial(od, os) {
    return Object.fromEntries(
      Object.keys(MATERIALS).map((id) => [
        id,
        { OD: evaluateLens(specFor('OD', od.rx, od.pd, id, FRAME)), OS: evaluateLens(specFor('OS', os.rx, os.pd, id, FRAME)) },
      ]),
    );
  }
  const split = (all, selectedId) => ({
    selectedId,
    selected: all[selectedId],
    others: Object.fromEntries(Object.entries(all).filter(([id]) => id !== selectedId)),
  });
  const pick = (rows, keys) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));

  // Page example (main.js EXAMPLE): R −2,75 −0,50 × 180 PD 32, L −2,50 −0,75 × 170 PD 31,5.
  // Engine 2026-11-07, thickest = etMax (temporal-superior) for every material, OD 4,597 / OS
  // 4,597 mm for CR-39 → tie → OD. Weights per eye 6,86 + 6,75 → 7 + 7 = 14 g; 1,74: 4,84 + 4,76 →
  // 5 + 5 = 10 g. 1,74 saving 4,6 − 3,0 = 1,6 mm, 1,6 / 4,6 = 34,8 % → 35.
  const MINUS = byMaterial({ rx: { sph: -2.75, cyl: -0.5, axisDeg: 180 }, pd: 32 }, { rx: { sph: -2.5, cyl: -0.75, axisDeg: 170 }, pd: 31.5 });
  // Plus case: R +3,00 PD 32, L +2,75 PD 31,5; CR-39 OD 3,902 / OS 3,737 → OD; thickest = centre.
  const PLUS = byMaterial({ rx: { sph: 3, cyl: 0, axisDeg: 0 }, pd: 32 }, { rx: { sph: 2.75, cyl: 0, axisDeg: 0 }, pd: 31.5 });

  test('example (minus): rows in MATERIALS order equal the 02-06 interfaces table', () => {
    const rows = materialRows(split(MINUS, 'cr39'));
    expect(rows.map((r) => r.id)).toEqual(Object.keys(MATERIALS));
    expect(pick(rows, ['id', 'eye', 'thickMm', 'ctMm', 'weightG', 'diffMm', 'diffG', 'selected'])).toEqual([
      { id: 'cr39', eye: 'OD', thickMm: 4.6, ctMm: 1.8, weightG: 14, diffMm: null, diffG: null, selected: true },
      { id: 'trivex', eye: 'OD', thickMm: 4.1, ctMm: 1.5, weightG: 10, diffMm: 0.5, diffG: 4, selected: false },
      { id: 'pc', eye: 'OD', thickMm: 3.9, ctMm: 1.5, weightG: 10, diffMm: 0.7, diffG: 4, selected: false },
      { id: 'idx160', eye: 'OD', thickMm: 3.5, ctMm: 1.2, weightG: 10, diffMm: 1.1, diffG: 4, selected: false },
      { id: 'idx167', eye: 'OD', thickMm: 3.3, ctMm: 1.2, weightG: 10, diffMm: 1.3, diffG: 4, selected: false },
      { id: 'idx174', eye: 'OD', thickMm: 3.0, ctMm: 1.1, weightG: 10, diffMm: 1.6, diffG: 4, selected: false },
    ]);
    expect(rows[0].pct).toBeNull();
    expect(rows[5].pct).toBe(35);
    for (const r of rows) expect(r.thickWhere).toBe('temporal-superior');
  });

  test('plus case: thickest point is the centre for every row; 1,74 saves 0,9 mm, not 0,6 mm', () => {
    const rows = materialRows(split(PLUS, 'cr39'));
    expect(pick(rows, ['id', 'eye', 'thickWhere', 'thickMm', 'ctMm', 'weightG', 'diffMm', 'diffG'])).toEqual([
      { id: 'cr39', eye: 'OD', thickWhere: 'centre', thickMm: 3.9, ctMm: 3.9, weightG: 14, diffMm: null, diffG: null },
      { id: 'trivex', eye: 'OD', thickWhere: 'centre', thickMm: 3.7, ctMm: 3.7, weightG: 12, diffMm: 0.2, diffG: 2 },
      // a higher index is not always much thinner: per-material minimum thicknesses (PITFALLS 8)
      { id: 'pc', eye: 'OD', thickWhere: 'centre', thickMm: 3.8, ctMm: 3.8, weightG: 13, diffMm: 0.1, diffG: 1 },
      { id: 'idx160', eye: 'OD', thickWhere: 'centre', thickMm: 3.5, ctMm: 3.5, weightG: 13, diffMm: 0.4, diffG: 1 },
      { id: 'idx167', eye: 'OD', thickWhere: 'centre', thickMm: 3.2, ctMm: 3.2, weightG: 12, diffMm: 0.7, diffG: 2 },
      { id: 'idx174', eye: 'OD', thickWhere: 'centre', thickMm: 3.0, ctMm: 3.0, weightG: 12, diffMm: 0.9, diffG: 2 },
    ]);
    expect(rows[5].pct).toBe(23);
  });

  test('every row is derived from the displayed thickest(m) of the one eye', () => {
    for (const all of [MINUS, PLUS]) {
      const rows = materialRows(split(all, 'idx160'));
      const sel = rows.find((r) => r.selected);
      expect(sel.id).toBe('idx160');
      for (const r of rows) {
        const m = all[r.id][r.eye].metrics;
        expect(r.thickMm).toBe(roundMm(thickest(m).value));
        expect(r.thickWhere).toBe(thickest(m).where);
        expect(r.ctMm).toBe(roundMm(m.ct));
        expect(r.weightG).toBe(roundG(all[r.id].OD.metrics.weightG) + roundG(all[r.id].OS.metrics.weightG));
        if (r.selected) continue;
        expect(r.diffMm).toBe(roundMm(sel.thickMm - r.thickMm));
        expect(r.diffG).toBe(sel.weightG - r.weightG);
        expect(r.pct).toBe(r.diffMm === 0 ? null : Math.round((r.diffMm / sel.thickMm) * 100));
      }
    }
  });

  test('with a thinner material selected the differences are negative (row thicker)', () => {
    const rows = materialRows(split(MINUS, 'idx174'));
    expect(rows[0]).toMatchObject({ id: 'cr39', diffMm: -1.6, diffG: -4, pct: -53 });
  });

  // Synthetic metrics: only the fields materialRows reads.
  const lens = (ct, et, w) => ({ ok: true, metrics: { ct, etMax: { value: et, location: 'nasal' }, weightG: w } });

  test('fixed eye: the selected material decides the eye for every row (no R-vs-L row)', () => {
    const rows = materialRows({
      selectedId: 'cr39',
      selected: { OD: lens(1.8, 5.0, 7), OS: lens(1.8, 4.0, 6) },
      others: {
        trivex: { OD: lens(1.5, 3.0, 5), OS: lens(1.5, 3.6, 5) }, // OS thicker in this row
        pc: { OD: lens(1.5, 4.0, 5), OS: lens(1.5, 3.0, 5) },
        idx160: { OD: lens(1.2, 3.5, 5), OS: lens(1.2, 3.0, 5) },
        idx167: { OD: lens(1.2, 3.3, 5), OS: lens(1.2, 3.0, 5) },
        idx174: { OD: lens(1.1, 3.0, 5), OS: lens(1.1, 2.8, 5) },
      },
    });
    expect(rows.every((r) => r.eye === 'OD')).toBe(true);
    expect(rows[1]).toMatchObject({ id: 'trivex', thickMm: 3.0, diffMm: 2.0, diffG: 3 });
  });

  test('tie on the displayed value → OD, even when OS is thicker before rounding', () => {
    const rows = materialRows({
      selectedId: 'cr39',
      selected: { OD: lens(1.8, 4.61, 7), OS: lens(1.8, 4.64, 7) },
      others: {},
    });
    expect(rows[0].eye).toBe('OD');
  });

  test('a failed row eye → { id, failed: true }; a missing material → { id, pending: true }', () => {
    const { others, ...rest } = split(MINUS, 'cr39');
    const rows = materialRows({
      ...rest,
      others: { ...others, pc: { OD: others.pc.OD, OS: { ok: false } }, idx174: undefined },
    });
    expect(rows[2]).toEqual({ id: 'pc', failed: true });
    expect(rows[5]).toEqual({ id: 'idx174', pending: true });
  });

  test('a failed selected eye: the other eye is used, weight counts the computed eye only', () => {
    const rows = materialRows({
      selectedId: 'cr39',
      selected: { OD: { ok: false }, OS: lens(1.8, 4.0, 6.4) },
      others: { trivex: { OD: { ok: false }, OS: lens(1.5, 3.6, 4.6) } },
    });
    expect(rows[0]).toMatchObject({ id: 'cr39', eye: 'OS', thickMm: 4.0, weightG: 6 });
    expect(rows[1]).toMatchObject({ id: 'trivex', eye: 'OS', thickMm: 3.6, weightG: 5, diffMm: 0.4, diffG: 1 });
  });

  test('no computed selected eye → no rows', () => {
    expect(materialRows({ selectedId: 'cr39', selected: { OD: { ok: false }, OS: null }, others: {} })).toEqual([]);
  });
});
