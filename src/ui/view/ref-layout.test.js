// 04-08 (REF-01, D-06, D-08): pure Durchblick panel layout, scale, chart phase and the triangle split.
import { describe, test, expect } from 'vitest';
import { SPLIT_MIN_PX } from './compare3d.js';
import { FIELD_HALF_ANGLE_DEG, CELL_DIAGONAL } from '../../engine/warp.js';
import {
  CHART_SQUARE_TAN,
  REF_SPLIT_MIN_PX,
  REF_DIVIDER_PX,
  panelLayout,
  pxPerTanFor,
  gridTriangles,
  cellSplit,
  checkerInk,
  inLetterBand,
} from './ref-layout.js';

const close = (a, b, tol = 0.1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('REF-01 panel layout (D-06, UI-SPEC "Layout of the picture")', () => {
  test('field and square are the P0 values (30°, tan 6°)', () => {
    expect(FIELD_HALF_ANGLE_DEG).toBe(30);
    expect(CHART_SQUARE_TAN).toBeCloseTo(Math.tan((6 * Math.PI) / 180), 12);
    expect(REF_DIVIDER_PX).toBe(2);
  });

  test('REF_SPLIT_MIN_PX equals the compare3d split rule (360)', () => {
    expect(REF_SPLIT_MIN_PX).toBe(360);
    expect(REF_SPLIT_MIN_PX).toBe(SPLIT_MIN_PX);
  });

  test('412 px phone stage 380 × 285: two panels 189 × 285, 2 px divider, 246,8 px/tan', () => {
    const { panels, split } = panelLayout({ stageW: 380, stageH: 285, compare: false });
    expect(split).toBe(true);
    expect(panels.map((p) => [p.id, p.eye, p.x, p.w, p.h])).toEqual([
      ['L', 'OS', 0, 189, 285],
      ['R', 'OD', 191, 189, 285],
    ]);
    expect(panels[1].x - (panels[0].x + panels[0].w)).toBe(2);
    for (const p of panels) close(p.pxPerTan, 246.8);
    close(panels[0].squarePx, 25.94, 0.01);
  });

  test.each([
    [199, 250, 216.5],
    [288, 216, 249.4],
    [179, 270, 233.8],
    [189, 285, 246.8],
  ])('pxPerTanFor(%d, %d) = %d', (w, h, want) => close(pxPerTanFor(w, h), want));

  test('one panel below 360 px: 288 × 216 → 249,4 px/tan, OD by default', () => {
    const { panels, split } = panelLayout({ stageW: 288, stageH: 216 });
    expect(split).toBe(false);
    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ id: 'R', eye: 'OD', x: 0, w: 288, h: 216 });
    close(panels[0].pxPerTan, 249.4);
    expect(panelLayout({ stageW: 288, stageH: 216, shownEye: 'OS' }).panels[0]).toMatchObject({ id: 'L', eye: 'OS' });
  });

  test('360 px stage (4:3) → 179 × 270 at 233,8; 359 px → one panel', () => {
    const two = panelLayout({ stageW: 360, stageH: 270 });
    expect(two.split).toBe(true);
    expect(two.panels.map((p) => p.w)).toEqual([179, 179]);
    close(two.panels[0].pxPerTan, 233.8);
    expect(panelLayout({ stageW: 359, stageH: 269.25 }).panels).toHaveLength(1);
  });

  test('measured stages (04-P0-RESULTS.md section 0) give the recorded panels', () => {
    const cases = [
      [380, 285, 189, 285, 246.82],
      [288, 216, 288, 216, 249.42],
      [398, 248.75, 198, 248.75, 215.42],
      [542, 338.75, 270, 338.75, 293.37],
      [1280, 800, 639, 800, 692.82],
      [1164, 593, 581, 593, 513.55],
      [412, 915, 205, 915, 792.41],
    ];
    for (const [W, H, w, h, P] of cases) {
      const { panels } = panelLayout({ stageW: W, stageH: H });
      for (const p of panels) {
        expect([p.w, p.h]).toEqual([w, h]);
        close(p.pxPerTan, P, 0.01);
      }
    }
  });

  test('wearer view: the right lens is in the right panel (D-06)', () => {
    const { panels } = panelLayout({ stageW: 542, stageH: 338.75 });
    const od = panels.find((p) => p.eye === 'OD');
    const os = panels.find((p) => p.eye === 'OS');
    expect(od.x).toBeGreaterThan(os.x);
    expect(od.x + od.w).toBe(542);
  });

  test('compare: A left, B right, both the shown eye', () => {
    const { panels } = panelLayout({ stageW: 542, stageH: 338.75, compare: true, shownEye: 'OS' });
    expect(panels.map((p) => [p.id, p.eye])).toEqual([
      ['A', 'OS'],
      ['B', 'OS'],
    ]);
  });

  test('empty stage → no panel', () => expect(panelLayout({ stageW: 0, stageH: 0 }).panels).toEqual([]));
});

describe('REF-01 grid triangles (lens-critic MINOR 1)', () => {
  test("CELL_DIAGONAL is 'sw-ne'", () => expect(CELL_DIAGONAL).toBe('sw-ne'));

  test('gridTriangles(2, 1): each cell split from lower-left to upper-right', () => {
    // vertices row-major from the bottom row: 0 1 2 / 3 4 5
    expect(gridTriangles(2, 1)).toEqual(new Uint32Array([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]));
  });

  test('both triangles of every cell share the sw-ne edge', () => {
    const nx = 3;
    const t = gridTriangles(nx, 2);
    expect(t.length).toBe(6 * 3 * 2);
    for (let c = 0; c < t.length / 6; c++) {
      const i = c % nx;
      const j = Math.floor(c / nx);
      const sw = j * (nx + 1) + i;
      const ne = sw + nx + 2;
      const a = [...t.slice(6 * c, 6 * c + 3)];
      const b = [...t.slice(6 * c + 3, 6 * c + 6)];
      for (const tri of [a, b]) expect(tri).toEqual(expect.arrayContaining([sw, ne]));
    }
  });

  test('an unknown diagonal name throws', () => {
    expect(() => cellSplit('sw-nw')).toThrow(/unknown CELL_DIAGONAL/);
  });
});

describe('REF-01 chart definition (D-08)', () => {
  const S = CHART_SQUARE_TAN;
  test('a square corner at object tan (0, 0): the four squares around it alternate', () => {
    const e = S / 2;
    expect([checkerInk(e, e), checkerInk(-e, e), checkerInk(-e, -e), checkerInk(e, -e)]).toEqual([true, false, true, false]);
  });
  test('letter band from +1 to +3 squares above the line of sight', () => {
    expect(inLetterBand(0.99 * S)).toBe(false);
    expect(inLetterBand(S)).toBe(true);
    expect(inLetterBand(2.99 * S)).toBe(true);
    expect(inLetterBand(3 * S)).toBe(false);
    expect(inLetterBand(-2 * S)).toBe(false);
  });
});
