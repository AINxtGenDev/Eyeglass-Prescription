// 04-08 (REF-01, D-06, D-08): pure Durchblick panel layout, scale, chart phase and the triangle split.
import { describe, test, expect } from 'vitest';
import { SPLIT_MIN_PX } from './compare3d.js';
import { FIELD_HALF_ANGLE_DEG, CELL_DIAGONAL } from '../../engine/warp.js';
import {
  CHART_SQUARE_TAN,
  REF_SPLIT_MIN_PX,
  REF_DIVIDER_PX,
  RIM_NOTE_MIN_PX,
  rimBandPx,
  panelLayout,
  pxPerTanFor,
  gridTriangles,
  cellSplit,
  checkerInk,
  inLetterBand,
  defaultRefEye,
  tickPositions,
  tickVisible,
  classAt,
  TICK_SAMPLE_PX,
} from './ref-layout.js';
import { REF_CLASS } from '../../engine/warp.js';

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

  test('compare at ≥ 360 px: A and B the same size, so the same scale (D-11a)', () => {
    const { panels, split } = panelLayout({ stageW: 1216, stageH: 684, compare: true, shownEye: 'OD' });
    expect(split).toBe(true);
    const [a, b] = panels;
    expect([a.id, b.id]).toEqual(['A', 'B']);
    expect(a.x).toBe(0);
    expect(b.x).toBeGreaterThan(a.x + a.w);
    expect(b.x + b.w).toBe(1216);
    expect(a.w).toBe(b.w);
    expect(a.pxPerTan).toBe(b.pxPerTan);
    expect(a.squarePx).toBe(b.squarePx);
  });

  test('compare below 360 px: one panel for the variant #cmp-show shows (Nachher by default)', () => {
    const at = (shown) => panelLayout({ stageW: 288, stageH: 216, compare: true, shownEye: 'OS', shown });
    expect(at(undefined).panels.map((p) => [p.id, p.eye, p.w])).toEqual([['B', 'OS', 288]]);
    expect(at('B').panels.map((p) => p.id)).toEqual(['B']);
    expect(at('A').panels.map((p) => [p.id, p.eye, p.x, p.w])).toEqual([['A', 'OS', 0, 288]]);
    expect(at('A').split).toBe(false);
    expect(at('A').panels[0].pxPerTan).toBe(at('B').panels[0].pxPerTan);
  });

  test('compare at ≥ 360 px ignores shown (both panels)', () => {
    const { panels } = panelLayout({ stageW: 400, stageH: 300, compare: true, shownEye: 'OD', shown: 'A' });
    expect(panels.map((p) => p.id)).toEqual(['A', 'B']);
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

// 04-09 (D-06 as amended, UI-SPEC "Narrow stage fallback"): one panel below 360 px and its default eye.
describe('REF-01 one-panel mode (04-09)', () => {
  const mag = (...sms) => ({ meridians: sms.map((sm) => ({ sm })) });
  test('defaultRefEye: the larger max |SM − 1| over the meridians', () => {
    expect(defaultRefEye({ OD: mag(0.97), OS: mag(0.93) })).toBe('OS');
    expect(defaultRefEye({ OD: mag(1.08), OS: mag(0.95) })).toBe('OD');
    // a cylinder: the larger meridian counts
    expect(defaultRefEye({ OD: mag(0.99, 0.94), OS: mag(0.95) })).toBe('OD');
    expect(defaultRefEye({ OD: mag(0.97), OS: mag(1.01, 0.96) })).toBe('OS');
  });
  test('defaultRefEye: ties within 0,05 percentage points → OD', () => {
    expect(defaultRefEye({ OD: mag(0.95), OS: mag(0.9496) })).toBe('OD');
    expect(defaultRefEye({ OD: mag(0.95), OS: mag(0.9495) })).toBe('OD');
    expect(defaultRefEye({ OD: mag(0.95), OS: mag(0.9493) })).toBe('OS');
    expect(defaultRefEye({ OD: mag(1.0), OS: mag(1.0) })).toBe('OD');
  });
  test('defaultRefEye: one eye null → the other; both null → OD', () => {
    expect(defaultRefEye({ OD: null, OS: mag(0.99) })).toBe('OS');
    expect(defaultRefEye({ OD: mag(0.99), OS: null })).toBe('OD');
    expect(defaultRefEye({ OD: null, OS: null })).toBe('OD');
    expect(defaultRefEye({})).toBe('OD');
  });
  test('below 360 px: one panel for the shown eye, full width; switching the eye keeps pxPerTan', () => {
    const od = panelLayout({ stageW: 288, stageH: 216, shownEye: 'OD' });
    const os = panelLayout({ stageW: 288, stageH: 216, shownEye: 'OS' });
    expect(od.split).toBe(false);
    expect(od.panels.map((p) => [p.id, p.eye, p.x, p.y, p.w, p.h])).toEqual([['R', 'OD', 0, 0, 288, 216]]);
    expect(os.panels.map((p) => [p.id, p.eye, p.x, p.w])).toEqual([['L', 'OS', 0, 288]]);
    expect(os.panels[0].pxPerTan).toBe(od.panels[0].pxPerTan);
    close(od.panels[0].pxPerTan, 249.4);
    expect(panelLayout({ stageW: 359, stageH: 270 }).split).toBe(false);
    expect(panelLayout({ stageW: 360, stageH: 270 }).split).toBe(true);
  });
});

// 04-09 (UI-SPEC "Reference ticks", N1, N11).
describe('REF-01 reference ticks (04-09)', () => {
  const S = CHART_SQUARE_TAN;
  const [L, R] = panelLayout({ stageW: 380, stageH: 285 }).panels; // 412 px phone, 189 × 285
  test('ticks sit at centre ± n · square on every edge, from the panel geometry only', () => {
    for (const p of [L, R]) {
      const ticks = tickPositions(p);
      const k = S * p.pxPerTan;
      for (const t of ticks) {
        if (t.edge === 'top' || t.edge === 'bottom') {
          close(t.x, p.x + p.w / 2 + t.n * k, 1e-9);
          expect(t.y).toBe(t.edge === 'top' ? p.y : p.y + p.h);
          expect(t.x > p.x && t.x < p.x + p.w).toBe(true);
        } else {
          close(t.y, p.y + p.h / 2 - t.n * k, 1e-9);
          expect(t.x).toBe(t.edge === 'left' ? p.x : p.x + p.w);
          expect(t.y > p.y && t.y < p.y + p.h).toBe(true);
        }
      }
      // 189 px wide, 25,94 px squares: n = −3 … +3 on top and bottom; 285 px high: n = −5 … +5 less the band
      const ns = (edge) => ticks.filter((t) => t.edge === edge).map((t) => t.n);
      expect(ns('top')).toEqual([-3, -2, -1, 0, 1, 2, 3]);
      expect(ns('bottom')).toEqual(ns('top'));
      expect(ns('left')).toEqual([-5, -4, -3, -2, -1, 0, 4, 5]);
      expect(ns('right')).toEqual(ns('left'));
    }
  });
  test('N1: no left/right tick for n = +1 … +3 (letter band); the same ticks for both panels of equal size', () => {
    for (const t of tickPositions(R)) if (t.edge === 'left' || t.edge === 'right') expect([1, 2, 3]).not.toContain(t.n);
    expect(tickPositions(L).map((t) => [t.edge, t.n])).toEqual(tickPositions(R).map((t) => [t.edge, t.n]));
  });
  test('the scale is the only input: the ticks do not move when the eye changes in one-panel mode', () => {
    const a = panelLayout({ stageW: 288, stageH: 216, shownEye: 'OD' }).panels[0];
    const b = panelLayout({ stageW: 288, stageH: 216, shownEye: 'OS' }).panels[0];
    expect(tickPositions(a).map(({ edge, n, x, y }) => [edge, n, x, y])).toEqual(tickPositions(b).map(({ edge, n, x, y }) => [edge, n, x, y]));
  });

  /** A 2 × 2 cell warp, 10 px cells; the right column of cells is mixed with one rim leaf. */
  const warp = () => {
    const nx = 2;
    const ny = 2;
    const cls = new Uint8Array((nx + 1) * (ny + 1)).fill(REF_CLASS.LENS);
    // grid points of the right column (i = 2) are rim face
    for (let j = 0; j <= ny; j++) cls[j * (nx + 1) + 2] = REF_CLASS.RIM_FACE;
    const leaves = new Float32Array([
      // cell (1, 0): left half lens, right half rim face (two 5 × 10 leaves as 5-wide squares)
      10, 0, 5, REF_CLASS.LENS, 0.1, 0.1,
      15, 0, 5, REF_CLASS.RIM_FACE, 0, 0,
      10, 5, 5, REF_CLASS.LENS, 0.1, 0.1,
      15, 5, 5, REF_CLASS.EDGE_BAND, 0, 0,
    ]);
    return { nx, ny, cellX: 10, cellY: 10, cls, leaves, leafCount: 4 };
  };
  test('classAt: a uniform cell gives its class, a mixed cell the class of the leaf holding the point', () => {
    const w = warp();
    expect(classAt(w, 4, 4)).toBe(REF_CLASS.LENS);
    expect(classAt(w, 12, 2)).toBe(REF_CLASS.LENS);
    expect(classAt(w, 17, 2)).toBe(REF_CLASS.RIM_FACE);
    expect(classAt(w, 17, 7)).toBe(REF_CLASS.EDGE_BAND);
  });
  test('N11 tickVisible: hidden when the 14 px sample point lies on rim face or edge band; visible without a warp', () => {
    expect(TICK_SAMPLE_PX).toBe(14);
    const w = warp();
    const p20 = { x: 0, y: 0, w: 20, h: 20 };
    const p18 = { x: 0, y: 0, w: 20, h: 18 };
    // top edge, h 20: sample (17, 6) → leaf (15, 5) edge band; (12, 6) → leaf (10, 5) lens
    expect(tickVisible(w, p20, { edge: 'top', x: 17, y: 0 })).toBe(false);
    expect(tickVisible(w, p20, { edge: 'top', x: 12, y: 0 })).toBe(true);
    // top edge, h 18: sample (17, 4) → leaf (15, 0) rim face
    expect(tickVisible(w, p18, { edge: 'top', x: 17, y: 0 })).toBe(false);
    // right edge: sample x = 20 − 14 = 6, a lens cell; left edge, y 17 → sample (14, 3) → leaf (10, 0) lens
    expect(tickVisible(w, p20, { edge: 'right', x: 20, y: 16 })).toBe(true);
    expect(tickVisible(w, p20, { edge: 'left', x: 0, y: 17 })).toBe(true);
    expect(tickVisible(null, p20, { edge: 'top', x: 17, y: 0 })).toBe(true);
  });
});

describe('rimBandPx (04-16, lens-critic m1: the rim note only where the rim is visible)', () => {
  test('the threshold is 12 CSS px', () => expect(RIM_NOTE_MIN_PX).toBe(12));
  test('no rim: 0', () => expect(rimBandPx([], 100, 80)).toBe(0));
  test('a vertical band of W px measures W or W + 1', () => {
    for (const W of [5, 6, 11, 12, 13, 30]) {
      const v = rimBandPx([40, 0, W, 80], 100, 80);
      expect(v, `W ${W}`).toBeGreaterThanOrEqual(W);
      expect(v, `W ${W}`).toBeLessThanOrEqual(W + 1);
    }
  });
  test('the 1164 case: a 5–6 px band at the panel edge is below the threshold, a 31 px band above', () => {
    expect(rimBandPx([192, 0, 6, 248], 198, 248)).toBeLessThan(RIM_NOTE_MIN_PX);
    expect(rimBandPx([257, 0, 31, 216], 288, 216)).toBeGreaterThanOrEqual(RIM_NOTE_MIN_PX);
  });
  test('a band cut by the panel edge is measured as drawn (5 px inside)', () => {
    expect(rimBandPx([95, 0, 40, 80], 100, 80)).toBeLessThan(RIM_NOTE_MIN_PX);
  });
  test('many small rects (cells and leaves) of one band add up', () => {
    const r = [];
    for (let y = 0; y < 80; y += 8) for (let x = 40; x < 60; x += 2) r.push(x, y, 2, 8);
    const v = rimBandPx(r, 100, 80);
    expect(v).toBeGreaterThanOrEqual(20);
    expect(v).toBeLessThanOrEqual(21);
  });
  test('a 45° band of 14 px (Euclidean) measures 14 within 10 %', () => {
    const r = [];
    const half = 7 * Math.SQRT2; // horizontal half-width of a 14 px band at 45°
    for (let y = 0; y < 100; y++) r.push(y + 50 - half, y, 2 * half, 1);
    const v = rimBandPx(r, 200, 100);
    expect(Math.abs(v - 14) / 14).toBeLessThanOrEqual(0.1);
  });
});
