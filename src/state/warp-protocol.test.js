// REF-01 / REF-02 (04-05, D-13): the warp worker's handler. Pure, runs in Node.
import { describe, test, expect, vi } from 'vitest';
import { evaluateLens } from '../engine/evaluate.js';
import { prepareWarp, warpGrid, REF_GRID_TIERS, FIELD_HALF_ANGLE_DEG } from '../engine/warp.js';
import { NORMAL_PAIR } from './bench-cases.js';
import { createWarpHandler, READY } from './warp-protocol.js';
import { transferOf } from './transfer.js';

const surf = (eye) => {
  const r = evaluateLens(NORMAL_PAIR[eye]);
  expect(r.ok).toBe(true);
  return r.surfaces;
};
// The measured 412 px two-panel layout (04-P0-RESULTS.md section 0): 189 × 285 px.
const layout = { wPx: 189, hPx: 285, pxPerTan: 285 / (2 * Math.tan((FIELD_HALF_ANGLE_DEG * Math.PI) / 180)) };
const item = (panel, eye, tier = 'fein') => ({
  panel,
  eye,
  surfaces: surf(eye),
  frame: { shape: 'rechteckig', A: 52, B: 38 },
  hMm: 15,
  layout: { ...layout },
  tier,
});

const clock = () => {
  let t = 100;
  return vi.fn(() => (t += 7));
};

describe('warp protocol (04-05, D-13)', () => {
  test('READY is a frozen ready message', () => {
    expect(READY).toEqual({ type: 'ready' });
    expect(Object.isFrozen(READY)).toBe(true);
  });

  test('a valid two-panel job → one ok item per panel, computeMs from the injected clock', () => {
    const now = clock();
    const handle = createWarpHandler({ now });
    const r = handle({ type: 'warp', id: 7, items: [item('R', 'OD'), item('L', 'OS')] });
    expect(r.type).toBe('warp');
    expect(r.id).toBe(7);
    expect(r.computeMs).toBe(7);
    expect(now).toHaveBeenCalledTimes(2);
    expect(r.items).toHaveLength(2);
    for (const [i, [panel, eye]] of [['R', 'OD'], ['L', 'OS']].entries()) {
      const it = r.items[i];
      expect(it).toMatchObject({ panel, eye, ok: true, tier: 'fein' });
      expect(it.uv).toBeInstanceOf(Float32Array);
      expect(it.cls).toBeInstanceOf(Uint8Array);
      expect(it.leaves).toBeInstanceOf(Float32Array);
      expect(it.uv.length).toBe(2 * (it.nx + 1) * (it.ny + 1));
      expect(it.cls.length).toBe((it.nx + 1) * (it.ny + 1));
      for (const k of ['nx', 'ny', 'cellX', 'cellY', 'leafCount', 'rays', 'maxObjTan']) expect(Number.isFinite(it[k]), k).toBe(true);
      for (const k of ['rimInField', 'pastRimInField', 'noViewInField']) expect(typeof it[k], k).toBe('boolean');
      expect(it.uv.every(Number.isFinite)).toBe(true);
    }
  });

  test('the reply equals a direct prepareWarp + warpGrid call', () => {
    const it = item('R', 'OD', 'mittel');
    const r = createWarpHandler()({ type: 'warp', id: 1, items: [it] }).items[0];
    const ctx = prepareWarp({ surfaces: it.surfaces, frame: it.frame, eye: 'OD', hMm: 15 });
    const d = warpGrid(ctx, layout, REF_GRID_TIERS.mittel.cellPx, { leafPx: REF_GRID_TIERS.mittel.leafPx });
    expect(r.rays).toBe(d.rays);
    expect(Array.from(r.uv)).toEqual(Array.from(d.uv));
    expect(Array.from(r.cls)).toEqual(Array.from(d.cls));
  });

  test.each(Object.keys(REF_GRID_TIERS))('M2: tier %s passes its cellPx and { leafPx } to warpFn', (tier) => {
    const warpFn = vi.fn(warpGrid);
    createWarpHandler({ warpFn })({ type: 'warp', id: 1, items: [item('R', 'OD', tier)] });
    expect(warpFn).toHaveBeenCalledTimes(1);
    const [, panel, cellPx, opts] = warpFn.mock.calls[0];
    expect(panel).toEqual(layout);
    expect(cellPx).toBe(REF_GRID_TIERS[tier].cellPx);
    expect(opts).toEqual({ leafPx: REF_GRID_TIERS[tier].leafPx });
  });

  const bad = [
    ['item null', () => null, 'item'],
    ['eye', (i) => ({ ...i, eye: 'XX' }), 'eye'],
    ['unknown shape', (i) => ({ ...i, frame: { ...i.frame, shape: 'stern' } }), 'shape'],
    ['A ≤ 0', (i) => ({ ...i, frame: { ...i.frame, A: 0 } }), 'frame size'],
    ['B non-finite', (i) => ({ ...i, frame: { ...i.frame, B: NaN } }), 'frame size'],
    ['surfaces missing', (i) => ({ ...i, surfaces: undefined }), 'surfaces'],
    ['surfaces key missing', (i) => ({ ...i, surfaces: { ...i.surfaces, ct: undefined } }), 'surfaces.ct'],
    ['surfaces non-finite', (i) => ({ ...i, surfaces: { ...i.surfaces, c1: Infinity } }), 'surfaces.c1'],
    ['surfaces.oc', (i) => ({ ...i, surfaces: { ...i.surfaces, oc: null } }), 'surfaces.oc'],
    ['hMm ≤ 0', (i) => ({ ...i, hMm: -1 }), 'hMm'],
    ['layout missing', (i) => ({ ...i, layout: null }), 'layout'],
    ['layout wPx ≤ 0', (i) => ({ ...i, layout: { ...i.layout, wPx: 0 } }), 'layout'],
    ['layout pxPerTan non-finite', (i) => ({ ...i, layout: { ...i.layout, pxPerTan: NaN } }), 'layout'],
    ['unknown tier', (i) => ({ ...i, tier: 'ultra' }), 'tier'],
    ['inherited tier name', (i) => ({ ...i, tier: 'toString' }), 'tier'],
  ];
  test.each(bad)('T-04-18 invalid %s → INVALID_ITEM for that item only; the other item computes', (_, mutate, field) => {
    const r = createWarpHandler()({ type: 'warp', id: 3, items: [mutate(item('R', 'OD')), item('L', 'OS')] });
    expect(r.type).toBe('warp');
    expect(r.items[0]).toEqual({ panel: field === 'item' ? null : 'R', ok: false, code: 'INVALID_ITEM', field });
    expect(r.items[1]).toMatchObject({ panel: 'L', ok: true });
  });

  test('a throwing warpFn → WARP_FAILED for that item; the handler never throws', () => {
    let n = 0;
    const warpFn = vi.fn((...a) => {
      if (n++ === 0) throw new Error('boom');
      return warpGrid(...a);
    });
    const r = createWarpHandler({ warpFn })({ type: 'warp', id: 4, items: [item('R', 'OD'), item('L', 'OS')] });
    expect(r.items[0]).toEqual({ panel: 'R', ok: false, code: 'WARP_FAILED' });
    expect(r.items[1]).toMatchObject({ panel: 'L', ok: true });
  });

  test('a throwing prepareFn → WARP_FAILED', () => {
    const prepareFn = () => {
      throw new Error('boom');
    };
    const r = createWarpHandler({ prepareFn })({ type: 'warp', id: 4, items: [item('R', 'OD')] });
    expect(r.items[0]).toEqual({ panel: 'R', ok: false, code: 'WARP_FAILED' });
  });

  test('an engine failure object is passed on with its code', () => {
    const r1 = createWarpHandler({ prepareFn: () => ({ ok: false, code: 'INVALID_SURFACES' }) })({ type: 'warp', id: 5, items: [item('R', 'OD')] });
    expect(r1.items[0]).toEqual({ panel: 'R', ok: false, code: 'INVALID_SURFACES' });
    const r2 = createWarpHandler({ warpFn: () => ({ ok: false, code: 'INVALID_PANEL' }) })({ type: 'warp', id: 5, items: [item('R', 'OD')] });
    expect(r2.items[0]).toEqual({ panel: 'R', ok: false, code: 'INVALID_PANEL' });
  });

  test.each([
    ['null', null, null],
    ['unknown type', { type: 'mesh', id: 9, items: [] }, 9],
    ['items missing', { type: 'warp', id: 10 }, 10],
    ['items not an array', { type: 'warp', id: 11, items: 'x' }, 11],
  ])('malformed message (%s) → error reply, no throw', (_, msg, id) => {
    const handle = createWarpHandler();
    expect(() => handle(msg)).not.toThrow();
    expect(handle(msg)).toEqual({ type: 'error', id, message: 'warp worker: unknown message' });
  });

  test('transferOf(reply) lists the uv, cls and leaves buffers', () => {
    const r = createWarpHandler()({ type: 'warp', id: 1, items: [item('R', 'OD'), item('L', 'OS'), null] });
    const list = transferOf(r);
    const expected = r.items.filter((i) => i.ok).flatMap((i) => [i.uv.buffer, i.cls.buffer, i.leaves.buffer]);
    expect(list).toHaveLength(6);
    expect(new Set(list)).toEqual(new Set(expected));
  });
});
