// ENG-08 tier 2: Zeiss CR-39 spherical stock-lens charts (143 rows) reproduced by the engine.
// Tolerances are fixed here and never tuned. ±0.20 mm is a stricter project choice, NOT the
// Zeiss tolerance (the sheets state CT ±0.30 mm plus, +0.30/−0.20 mm minus; see the fixture
// provenance `ctTolerance`).

import { describe, it, expect, afterAll } from 'vitest';
import { loadZeissFixture, toolToTrue, toolCurvature } from './zeiss.js';
import { solveCT } from '../../src/engine/solve.js';
import { sphereSag } from '../../src/engine/sag.js';
import { thicknessAt } from '../../src/engine/metrics.js';
import { circleOutline } from '../../src/engine/frame/outline.js';

const MM_TOL = 0.20; // mm, stricter than the Zeiss CT tolerance
const DPT_TOL = 0.05; // dpt, curves are rounded to 0.01 D @1.530
const N = 1.5; // fixture material ne
const SHEET_MIN_ET = { 65: 1.0, 70: 1.0, 75: 1.1 };

const fixture = loadZeissFixture();
const rows = fixture.rows;
const label = (r) => `d ${r.d}, F ${r.F >= 0 ? '+' : ''}${r.F.toFixed(2)}`;
const cases = rows.map((r) => [label(r), r]);

const outlines = new Map();
const outlineFor = (d) => {
  if (!outlines.has(d)) outlines.set(d, circleOutline(d));
  return outlines.get(d);
};

/** Tier (c) row constraint rule (RESEARCH "Tool-index conversion", Pitfall C). */
const isSheetMinET = (r) => r.F > 0 && r.ET === SHEET_MIN_ET[r.d];
const constraintFor = (r) =>
  isSheetMinET(r) ? { minCT: 1.6, minET: r.ET } : { minCT: r.CT, minET: 0 };

const worst = { a: 0, b: 0, cCT: 0, cET: 0, subCT: 0, subET: 0, subN: 0 };

describe('Zeiss fixture provenance and transcription', () => {
  it('has 143 rows split per diameter and range', () => {
    const count = (d, plus) => rows.filter((r) => r.d === d && (plus ? r.F > 0 : r.F <= 0)).length;
    expect(rows.length).toBe(143);
    expect([count(75, true), count(75, false)]).toEqual([16, 25]);
    expect([count(70, true), count(70, false)]).toEqual([20, 33]);
    expect([count(65, true), count(65, false)]).toEqual([24, 25]);
  });

  it('spot rows match the PDF by hand (Appendix A)', () => {
    const find = (d, F) => rows.find((r) => r.d === d && r.F === F);
    expect(find(75, -4)).toEqual({ d: 75, F: -4, front: 2.74, back: -7, CT: 1.8, ET: 8.1 });
    expect(find(70, 5)).toEqual({ d: 70, F: 5, front: 7.86, back: -2.85, CT: 7.5, ET: 1 });
  });

  it('records the 1.530 tool index and the fixture material', () => {
    expect(fixture.provenance.note).toContain('1.530');
    expect(fixture.provenance.material.ne).toBe(N);
  });
});

describe('ENG-08 tier 2 (a): ET from the published CT and curves', () => {
  it.each(cases)('%s: |ET_calc − ET| ≤ 0.20 mm', (_, r) => {
    const r2 = (r.d / 2) ** 2;
    const et = r.CT - sphereSag(toolCurvature(r.front), r2) + sphereSag(toolCurvature(r.back), r2);
    const res = Math.abs(et - r.ET);
    worst.a = Math.max(worst.a, res);
    expect(res).toBeLessThanOrEqual(MM_TOL);
  });
});

describe('ENG-08 tier 2 (b): back-vertex power from the curves', () => {
  it.each(cases)('%s: |BVP − F| ≤ 0.05 dpt', (_, r) => {
    const D1 = toolToTrue(r.front, N);
    const D2 = toolToTrue(r.back, N); // back printed negative = concave
    const bvp = D1 / (1 - (r.CT / 1000 / N) * D1) + D2;
    const res = Math.abs(bvp - r.F);
    worst.b = Math.max(worst.b, res);
    expect(res).toBeLessThanOrEqual(DPT_TOL);
  });
});

describe('ENG-08 tier 2 (c): end-to-end solveCT with the sheet front curve', () => {
  // Honesty note (lens-critic m7): rows with minCT = CT_row (all minus rows and the plus rows
  // not at the sheet-minimum ET) return CT = CT_row by construction (binding 'minCT'), so their
  // CT residual is 0 and their ET residual repeats check (a) through the solver's own surfaces.
  // They are checked here but are NOT solver evidence. The CT-solver-exercising subset is the
  // plus rows at sheet-minimum ET (binding 'minET'), reported separately below.
  it.each(cases)('%s: |ΔCT| ≤ 0.20 mm and |ΔET| ≤ 0.20 mm', (_, r) => {
    const res = solveCT({
      sph: r.F,
      cyl: 0,
      axisDeg: 0,
      n: N,
      D1: toolToTrue(r.front, N),
      ...constraintFor(r),
      outline: outlineFor(r.d),
      oc: { x: 0, y: 0 },
    });
    expect(res.ok).toBe(true);
    const et = thicknessAt(res.surfaces, r.d / 2, 0);
    const dCT = Math.abs(res.ct - r.CT);
    const dET = Math.abs(et - r.ET);
    worst.cCT = Math.max(worst.cCT, dCT);
    worst.cET = Math.max(worst.cET, dET);
    if (isSheetMinET(r)) {
      expect(res.binding).toBe('minET');
      worst.subN++;
      worst.subCT = Math.max(worst.subCT, dCT);
      worst.subET = Math.max(worst.subET, dET);
    } else {
      expect(res.binding).toBe('minCT');
    }
    expect(dCT).toBeLessThanOrEqual(MM_TOL);
    expect(dET).toBeLessThanOrEqual(MM_TOL);
  });

  it('the CT-solver-exercising subset (plus rows at sheet-minimum ET) is non-empty', () => {
    expect(rows.filter(isSheetMinET).length).toBeGreaterThan(0);
  });
});

/**
 * Deliberately WRONG reference: thin-lens split D2 = F − D1 with no vertex term, same outline
 * and constraint. It exists only to show that tier (c) discriminates thick from thin solving.
 */
function thinLensCT(r) {
  const { minCT, minET } = constraintFor(r);
  const K = 1000 * (N - 1);
  const D1 = toolToTrue(r.front, N);
  const cF = D1 / K;
  const cB = -(r.F - D1) / K;
  const r2 = (r.d / 2) ** 2;
  return Math.max(minCT, minET + sphereSag(cF, r2) - sphereSag(cB, r2));
}

describe('thin-lens discriminator', () => {
  it('a thin-lens solver misses row d 75, F +4.00 by more than 0.30 mm in CT', () => {
    const r = rows.find((x) => x.d === 75 && x.F === 4);
    const miss = Math.abs(thinLensCT(r) - r.CT);
    console.info(`[zeiss] thin-lens CT miss at d 75, F +4.00: ${miss.toFixed(3)} mm`);
    expect(miss).toBeGreaterThan(0.3);
  });
});

afterAll(() => {
  const f = (x) => x.toFixed(3);
  console.info(
    `[zeiss] worst residuals over ${rows.length} rows: (a) ET ${f(worst.a)} mm; ` +
      `(b) BVP ${f(worst.b)} dpt; (c) full set CT ${f(worst.cCT)} mm, ET ${f(worst.cET)} mm; ` +
      `(c) CT-solver subset n=${worst.subN}: CT ${f(worst.subCT)} mm, ET ${f(worst.subET)} mm`,
  );
});
