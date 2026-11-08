import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RIM_DEPTH_DEFAULT_MM, BEVEL_RULES, BEVEL_RULE, bevelApexMm, bevelSplit, frontLeadMm } from './rim.js';
import { evaluateLens } from './evaluate.js';
import { frameOutline } from './frame/outline.js';
import { frontSagAt } from './design.js';
import { thicknessAt } from './metrics.js';

describe('FRAME-02 rim depth helper (02-11)', () => {
  it('default rim depth is the assumed 3 mm', () => expect(RIM_DEPTH_DEFAULT_MM).toBe(3));
});

const FRAME = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
const spec = (o) => ({
  eye: 'OD',
  sph: -2.75,
  cyl: -0.5,
  axisDeg: 180,
  materialId: 'cr39',
  frame: FRAME,
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const OD = spec({});
const OS = spec({ eye: 'OS', sph: -2.5, cyl: -0.75, axisDeg: 170, monoPD: 31.5 });
const PLUS6 = spec({ sph: 6, cyl: 0, axisDeg: null });
const lensOf = (s) => {
  const r = evaluateLens(s);
  expect(r.ok).toBe(true);
  return { r, outline: frameOutline(s.frame.shape, s.frame.A, s.frame.B, s.eye) };
};

describe('VIZ-03 bevel split (D-05)', () => {
  it('bevel rules: 1:2 = 1/3, 1:1 = 1/2, front = 0; default 1:2', () => {
    expect(BEVEL_RULES['1:2']).toBe(1 / 3);
    expect(BEVEL_RULES['1:1']).toBe(1 / 2);
    expect(BEVEL_RULES.front).toBe(0);
    expect(BEVEL_RULE).toBe('1:2');
    expect(Object.isFrozen(BEVEL_RULES)).toBe(true);
  });

  it('bevelApexMm per rule; unknown rule throws naming it', () => {
    expect(bevelApexMm(4.5)).toBeCloseTo(1.5, 12);
    expect(bevelApexMm(4.5, '1:1')).toBeCloseTo(2.25, 12);
    expect(bevelApexMm(4.5, 'front')).toBe(0);
    expect(() => bevelApexMm(4.5, '2:1')).toThrow(/unknown bevel rule 2:1/);
    expect(() => bevelApexMm(4.5, 'toString')).toThrow(/unknown bevel rule/);
  });

  it('example etMax 4,597 mm in a 3 mm rim: front ≈ 0,032, back ≈ 1,565', () => {
    const { front, back } = bevelSplit(4.597, 3);
    expect(front).toBeCloseTo(4.597 / 3 - 1.5, 12);
    expect(back).toBeCloseTo((4.597 * 2) / 3 - 1.5, 12);
  });

  it('bevelSplit(3, 3) → back D/6 = 0,5 (documented phase-2 change)', () => {
    const r = bevelSplit(3, 3);
    expect(r.front).toBe(0);
    expect(r.back).toBeCloseTo(0.5, 12);
  });

  it('bevelSplit(1, 3) → flush on both sides', () => {
    expect(bevelSplit(1, 3)).toEqual({ front: 0, back: 0 });
  });

  it('other rules: 1:1 symmetric, front = all at the back', () => {
    const a = bevelSplit(4.6, 3, '1:1');
    expect(a.front).toBeCloseTo(0.8, 12);
    expect(a.back).toBeCloseTo(0.8, 12);
    const f = bevelSplit(4.6, 3, 'front');
    expect(f.front).toBe(0);
    expect(f.back).toBeCloseTo(3.1, 12);
  });

  it('property: ≥ 0, sum = t − D when both sides stand out, monotone in t (≥ 200 cases per rule)', () => {
    for (const rule of Object.keys(BEVEL_RULES)) {
      fc.assert(
        fc.property(
          fc.double({ min: 0.5, max: 50, noNaN: true }),
          fc.double({ min: 0.5, max: 10, noNaN: true }),
          fc.double({ min: 0, max: 5, noNaN: true }),
          (t, D, dt) => {
            const s = bevelSplit(t, D, rule);
            expect(s.front).toBeGreaterThanOrEqual(0);
            expect(s.back).toBeGreaterThanOrEqual(0);
            if (s.front > 0 && s.back > 0) expect(Math.abs(s.front + s.back - (t - D))).toBeLessThan(1e-12);
            const u = bevelSplit(t + dt, D, rule);
            expect(u.front).toBeGreaterThanOrEqual(s.front);
            expect(u.back).toBeGreaterThanOrEqual(s.back);
          },
        ),
        { numRuns: 250, seed: 3001 },
      );
    }
  });
});

describe('VIZ-03 front-surface lead over the rim (lens-critic MAJOR 1)', () => {
  // Values measured by the 03-01 executor (pinned to 1e-9; the planner's check run gave 0,5151).
  const OD_LEAD = 0.5151338298;
  const OS_LEAD = 0.528;
  const PLUS6_LEAD = 4.685;

  it('example OD ≈ 0,515 mm, OS ≈ 0,528 mm, +6,00 ≈ 4,685 mm (D = 3)', () => {
    const od = lensOf(OD);
    const os = lensOf(OS);
    const p6 = lensOf(PLUS6);
    const lOd = frontLeadMm(od.r.surfaces, od.outline, 3);
    const lOs = frontLeadMm(os.r.surfaces, os.outline, 3);
    const lP6 = frontLeadMm(p6.r.surfaces, p6.outline, 3);
    expect(lOd.value).toBeCloseTo(0.515, 3);
    expect(lOs.value).toBeCloseTo(0.528, 3);
    expect(lP6.value).toBeCloseTo(4.685, 3);
    expect(Math.abs(lOd.value - OD_LEAD)).toBeLessThan(1e-9);
    expect(Math.abs(lOs.value - OS_LEAD)).toBeLessThan(1e-9);
    expect(Math.abs(lP6.value - PLUS6_LEAD)).toBeLessThan(1e-9);
  });

  it('index is the outline vertex with the largest frontSag + apex (ties → lower index)', () => {
    const { r, outline } = lensOf(OD);
    const { value, index } = frontLeadMm(r.surfaces, outline, 3);
    let best = -Infinity;
    let at = -1;
    for (let i = 0; i < outline.length / 2; i++) {
      const x = outline[2 * i];
      const y = outline[2 * i + 1];
      const k = frontSagAt(r.surfaces, x, y) + bevelApexMm(thicknessAt(r.surfaces, x, y));
      if (k > best) {
        best = k;
        at = i;
      }
    }
    expect(index).toBe(at);
    expect(value).toBe(best - 1.5);
  });

  it('ties go to the lower index', () => {
    const { r } = lensOf(PLUS6);
    // Same point twice: both vertices tie exactly; the first one wins.
    const pt = [10, 5, 10, 5];
    expect(frontLeadMm(r.surfaces, pt, 3).index).toBe(0);
  });

  it('only the −D/2 term depends on D', () => {
    const { r, outline } = lensOf(OD);
    const a = frontLeadMm(r.surfaces, outline, 3);
    const b = frontLeadMm(r.surfaces, outline, 5);
    expect(Math.abs(b.value - (a.value - 1))).toBeLessThan(1e-12);
    expect(b.index).toBe(a.index);
  });

  it("rule '1:1' moves the apex back, so the lead is at least the '1:2' value", () => {
    const { r, outline } = lensOf(OD);
    expect(frontLeadMm(r.surfaces, outline, 3, '1:1').value).toBeGreaterThanOrEqual(
      frontLeadMm(r.surfaces, outline, 3).value,
    );
  });

  it('null surfaces → NaN and index −1, no throw; odd outline throws', () => {
    expect(frontLeadMm(null, [0, 0], 3)).toEqual({ value: NaN, index: -1 });
    const { r } = lensOf(OD);
    expect(() => frontLeadMm(r.surfaces, [0, 0, 1], 3)).toThrow('frontLeadMm: outline must hold x,y pairs');
  });
});
