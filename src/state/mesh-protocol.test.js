// VIZ-06 (03-04): the dedicated mesh worker's handler. Pure, runs in Node.
import { describe, test, expect } from 'vitest';
import { evaluateLens } from '../engine/evaluate.js';
import { frameOutline } from '../engine/frame/outline.js';
import { LENS_LENGTHS, allocLensBuffers, buildLensMesh } from '../engine/mesh/lens.js';
import { FRAME_LENGTHS, allocFrameBuffers, buildFrameMesh } from '../engine/mesh/frame.js';
import { BEVEL_RULE } from '../engine/rim.js';
import { createMeshHandler, READY, MESH_SLOTS } from './mesh-protocol.js';
import { transferOf } from './transfer.js';

const frame = { shape: 'rechteckig', A: 52, B: 38 };
const spec = (eye, sph = -2.75) => ({
  eye,
  sph,
  cyl: -0.5,
  axisDeg: eye === 'OD' ? 10 : 170,
  materialId: 'cr39',
  frame: { ...frame, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
});
const surf = (eye) => {
  const r = evaluateLens(spec(eye));
  expect(r.ok).toBe(true);
  return r.surfaces;
};
const item = (slot, eye = slot) => ({ slot, eye, surfaces: surf(eye), frame: { ...frame }, buffers: allocLensBuffers() });

const direct = (eye) => {
  const out = allocLensBuffers();
  const res = buildLensMesh(surf(eye), frameOutline(frame.shape, frame.A, frame.B, eye), out);
  return { out, res };
};

const bitwiseEqual = (a, b) => {
  expect(a.length).toBe(b.length);
  expect(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))).toBe(true);
};

describe('mesh (03-04, VIZ-06)', () => {
  test('READY and MESH_SLOTS are frozen constants', () => {
    expect(READY).toEqual({ type: 'ready' });
    expect(Object.isFrozen(READY)).toBe(true);
    expect(MESH_SLOTS).toEqual(['OD', 'OS', 'A', 'frame', 'frameA']);
    expect(Object.isFrozen(MESH_SLOTS)).toBe(true);
  });

  test('OD and OS items → built in place, equal to a direct buildLensMesh (bitwise)', () => {
    let t = 0;
    const handle = createMeshHandler({ now: () => (t += 5) });
    const items = [item('OD'), item('OS')];
    const sent = items.map((i) => i.buffers);
    const r = handle({ type: 'mesh', id: 7, items });
    expect(r.type).toBe('mesh');
    expect(r.id).toBe(7);
    expect(r.computeMs).toBe(5);
    expect(r.items.map((i) => i.slot)).toEqual(['OD', 'OS']);
    r.items.forEach((ri, k) => {
      const eye = ['OD', 'OS'][k];
      expect(ri.ok).toBe(true);
      expect(ri.finite).toBe(true);
      expect(ri.reallocated).toBe(false);
      const d = direct(eye);
      expect(ri.boundingSphere).toEqual(d.res.boundingSphere);
      for (const key of Object.keys(LENS_LENGTHS)) {
        // the same Float32Array objects come back (written in place, transferred back)
        expect(ri.buffers[key]).toBe(sent[k][key]);
        bitwiseEqual(ri.buffers[key], d.out[key]);
      }
    });
  });

  test('slot A (compare lens) builds with its own eye', () => {
    const r = createMeshHandler()({ type: 'mesh', id: 1, items: [item('A', 'OS')] });
    expect(r.items[0]).toMatchObject({ slot: 'A', ok: true, finite: true });
    bitwiseEqual(r.items[0].buffers.back, direct('OS').out.back);
  });

  test('missing, wrong-length or detached buffers are re-allocated and flagged', () => {
    const handle = createMeshHandler();
    const a = item('OD');
    delete a.buffers.front;
    const b = item('OS');
    b.buffers.thick = new Float32Array(3);
    const c = item('OD');
    const detached = structuredClone(c.buffers.band, { transfer: [c.buffers.band.buffer] });
    expect(c.buffers.band.length).toBe(0);
    expect(detached.length).toBe(LENS_LENGTHS.band);
    const d = item('OS');
    d.buffers.frontN = new Float64Array(LENS_LENGTHS.frontN); // wrong type
    const r = handle({ type: 'mesh', id: 3, items: [a, b, c, d] });
    for (const ri of r.items) {
      expect(ri.ok).toBe(true);
      expect(ri.reallocated).toBe(true);
      for (const [k, len] of Object.entries(LENS_LENGTHS)) {
        expect(ri.buffers[k]).toBeInstanceOf(Float32Array);
        expect(ri.buffers[k].length).toBe(len);
      }
    }
    bitwiseEqual(r.items[0].buffers.front, direct('OD').out.front);
  });

  test('invalid items fail alone (ok false, buffers returned), the others still build', () => {
    const handle = createMeshHandler();
    const bad = [
      { ...item('OD'), slot: 'X' },
      { ...item('OD'), eye: 'OU' },
      { ...item('OD'), frame: { shape: 'stern', A: 52, B: 38 } },
      { ...item('OD'), frame: { shape: 'toString', A: 52, B: 38 } },
      { ...item('OD'), frame: { shape: 'rund', A: 0, B: 38 } },
      { ...item('OD'), frame: { shape: 'rund', A: 52, B: Number.NaN } },
      { ...item('OD'), surfaces: { ...surf('OD'), ct: Number.NaN } },
      { ...item('OD'), surfaces: { ...surf('OD'), oc: { x: 0, y: Infinity } } },
      { ...item('OD'), surfaces: { ...surf('OD'), c1: '0.01' } },
      { ...item('OD'), surfaces: null },
      { ...item('OD'), frame: null },
      null,
    ];
    const good = item('OS');
    const r = handle({ type: 'mesh', id: 4, items: [...bad, good] });
    expect(r.items).toHaveLength(bad.length + 1);
    bad.forEach((b, k) => {
      const ri = r.items[k];
      expect(ri).toMatchObject({ ok: false, finite: false, boundingSphere: null });
      expect(ri.slot).toBe(b?.slot ?? null);
      if (b) for (const key of Object.keys(LENS_LENGTHS)) expect(ri.buffers[key]).toBe(b.buffers[key]);
    });
    expect(r.items.at(-1)).toMatchObject({ slot: 'OS', ok: true, finite: true });
  });

  test('a throwing meshFn fails only that item; the handler never throws', () => {
    let calls = 0;
    const handle = createMeshHandler({
      meshFn: (s, o, out) => {
        if (calls++ === 0) throw new Error('boom');
        return buildLensMesh(s, o, out);
      },
    });
    const items = [item('OD'), item('OS')];
    const r = handle({ type: 'mesh', id: 5, items });
    expect(r.items[0]).toMatchObject({ slot: 'OD', ok: false, finite: false, reallocated: false, boundingSphere: null });
    expect(r.items[0].buffers.front).toBe(items[0].buffers.front);
    expect(r.items[1]).toMatchObject({ slot: 'OS', ok: true, finite: true });
  });

  test('a non-finite mesh comes back ok with finite false', () => {
    const handle = createMeshHandler({ meshFn: () => ({ finite: false, boundingSphere: { x: 0, y: 0, z: 0, r: 1 } }) });
    const r = handle({ type: 'mesh', id: 6, items: [item('OD')] });
    expect(r.items[0]).toMatchObject({ ok: true, finite: false });
  });

  test('empty items → empty reply; non-mesh or garbage → error, never throws', () => {
    const handle = createMeshHandler();
    expect(handle({ type: 'mesh', id: 8, items: [] })).toMatchObject({ type: 'mesh', id: 8, items: [] });
    expect(handle({ type: 'mesh', id: 9 })).toMatchObject({ type: 'mesh', id: 9, items: [] });
    expect(handle({ type: 'compute', id: 10 })).toEqual({ type: 'error', id: 10, message: 'mesh worker: unknown message' });
    expect(handle(null)).toEqual({ type: 'error', id: null, message: 'mesh worker: unknown message' });
    expect(() => handle({ type: 'mesh', id: 11, items: 'nope' })).not.toThrow();
    expect(handle({ type: 'mesh', id: 11, items: 'nope' }).type).toBe('error');
  });
});

describe('frame item (03-07, VIZ-02)', () => {
  const fullFrame = { ...frame, DBL: 18 };
  const frameItem = (over = {}) => ({
    slot: 'frame',
    frame: { ...fullFrame },
    eyes: { OD: surf('OD'), OS: surf('OS') },
    rimDepthMm: 3,
    templeMm: 140,
    buffers: allocFrameBuffers(),
    ...over,
  });
  const directFrame = (it) => {
    const out = allocFrameBuffers();
    const res = buildFrameMesh(
      { frame: it.frame, eyes: it.eyes, rimDepthMm: it.rimDepthMm, templeMm: it.templeMm, rule: BEVEL_RULE },
      out,
    );
    return { out, res };
  };

  test('built in place, equal to a direct buildFrameMesh (bitwise), with the camera data', () => {
    const it = frameItem();
    const sent = it.buffers;
    const r = createMeshHandler()({ type: 'mesh', id: 1, items: [it] });
    const ri = r.items[0];
    expect(ri).toMatchObject({ slot: 'frame', ok: true, finite: true, reallocated: false });
    const d = directFrame(it);
    expect(ri.boundingSphere).toEqual(d.res.boundingSphere);
    expect(ri.frontBoundingSphere).toEqual(d.res.frontBoundingSphere);
    expect(ri.sideTarget).toEqual(d.res.sideTarget);
    expect(ri.eyeBox).toEqual(d.res.eyeBox);
    expect(ri.boundingBox).toEqual(d.res.boundingBox);
    expect(ri.lensZ).toEqual(d.res.lensZ);
    expect(ri.templeMm).toBe(140);
    for (const k of Object.keys(FRAME_LENGTHS)) {
      expect(ri.buffers[k]).toBe(sent[k]);
      bitwiseEqual(ri.buffers[k], d.out[k]);
    }
  });

  test('a clamped stamp temple comes back as the drawn length', () => {
    const r = createMeshHandler()({ type: 'mesh', id: 1, items: [frameItem({ templeMm: 999 })] });
    expect(r.items[0]).toMatchObject({ ok: true, templeMm: 160 });
  });

  test('blocked eye (eyes.OS null) → ok, the OS rim is flat', () => {
    const it = frameItem({ eyes: { OD: surf('OD'), OS: null } });
    const ri = createMeshHandler()({ type: 'mesh', id: 2, items: [it] }).items[0];
    expect(ri).toMatchObject({ slot: 'frame', ok: true, finite: true });
    const rim = ri.buffers.rimOS;
    const z0 = rim[2];
    let maxDz = 0;
    for (let i = 2; i < rim.length; i += 3) maxDz = Math.max(maxDz, Math.abs(rim[i] - z0));
    // flat: every rim vertex lies on one of the two face planes, front or back (rim depth apart)
    const zs = new Set();
    for (let i = 2; i < rim.length; i += 3) zs.add(Math.round(rim[i] * 1e4) / 1e4);
    expect(zs.size).toBeLessThanOrEqual(2);
    expect(maxDz).toBeLessThanOrEqual(3 + 1e-5);
    bitwiseEqual(rim, directFrame(it).out.rimOS);
  });

  test('invalid frame items fail alone (ok false, buffers returned)', () => {
    const bad = [
      frameItem({ frame: { ...fullFrame, DBL: Number.NaN } }),
      frameItem({ frame: { ...fullFrame, DBL: undefined } }),
      frameItem({ frame: { ...fullFrame, shape: 'stern' } }),
      frameItem({ frame: { ...fullFrame, A: -1 } }),
      frameItem({ rimDepthMm: 0 }),
      frameItem({ rimDepthMm: -1 }),
      frameItem({ rimDepthMm: Infinity }),
      frameItem({ templeMm: 0 }),
      frameItem({ templeMm: Number.NaN }),
      frameItem({ eyes: { OD: { ...surf('OD'), c1: Number.NaN }, OS: null } }),
      frameItem({ eyes: { OD: surf('OD'), OS: { ...surf('OS'), oc: null } } }),
      frameItem({ eyes: null }),
      frameItem({ frame: null }),
    ];
    const good = item('OD');
    const r = createMeshHandler()({ type: 'mesh', id: 3, items: [...bad, good] });
    bad.forEach((b, k) => {
      const ri = r.items[k];
      expect(ri).toMatchObject({ slot: 'frame', ok: false, finite: false, boundingSphere: null });
      for (const key of Object.keys(FRAME_LENGTHS)) expect(ri.buffers[key]).toBe(b.buffers[key]);
    });
    expect(r.items.at(-1)).toMatchObject({ slot: 'OD', ok: true });
  });

  test('missing or detached frame buffers are re-allocated to FRAME_LENGTHS', () => {
    const a = frameItem();
    delete a.buffers.bridge;
    const b = frameItem();
    structuredClone(b.buffers.rimOD, { transfer: [b.buffers.rimOD.buffer] });
    const c = frameItem({ buffers: undefined });
    const r = createMeshHandler()({ type: 'mesh', id: 4, items: [a, b, c] });
    for (const ri of r.items) {
      expect(ri).toMatchObject({ ok: true, reallocated: true });
      for (const [k, len] of Object.entries(FRAME_LENGTHS)) {
        expect(ri.buffers[k]).toBeInstanceOf(Float32Array);
        expect(ri.buffers[k].length).toBe(len);
      }
    }
    expect(r.items[0].buffers.rimOD).toBe(a.buffers.rimOD);
  });

  test('a throwing frameFn fails only the frame item; the lens items still build', () => {
    const handle = createMeshHandler({
      frameFn: () => {
        throw new Error('boom');
      },
    });
    const it = frameItem();
    const r = handle({ type: 'mesh', id: 5, items: [item('OD'), it, item('OS')] });
    expect(r.items.map((i) => [i.slot, i.ok])).toEqual([
      ['OD', true],
      ['frame', false],
      ['OS', true],
    ]);
    expect(r.items[1].buffers.rimOD).toBe(it.buffers.rimOD);
  });

  test('a non-finite frame comes back ok with finite false', () => {
    const handle = createMeshHandler({ frameFn: (p, out) => ({ ...buildFrameMesh(p, out), finite: false }) });
    const r = handle({ type: 'mesh', id: 6, items: [frameItem()] });
    expect(r.items[0]).toMatchObject({ ok: true, finite: false });
  });

  test('transferOf(reply) includes the frame buffers', () => {
    const r = createMeshHandler()({ type: 'mesh', id: 7, items: [item('OD'), frameItem()] });
    const list = transferOf(r);
    for (const k of Object.keys(FRAME_LENGTHS)) expect(list).toContain(r.items[1].buffers[k].buffer);
    for (const k of Object.keys(LENS_LENGTHS)) expect(list).toContain(r.items[0].buffers[k].buffer);
  });
});

describe("frameA item (03-14, RES-03): the compare rim, routed exactly like 'frame'", () => {
  const fullFrame = { ...frame, DBL: 18 };
  const frameItem = (slot, over = {}) => ({
    slot,
    frame: { ...fullFrame },
    eyes: { OD: surf('OD'), OS: null },
    rimDepthMm: 3,
    templeMm: 140,
    buffers: allocFrameBuffers(),
    ...over,
  });

  test('frameA equals the frame item for the same input (bitwise), slot kept', () => {
    const handle = createMeshHandler();
    const a = handle({ type: 'mesh', id: 1, items: [frameItem('frameA')] }).items[0];
    const f = handle({ type: 'mesh', id: 2, items: [frameItem('frame')] }).items[0];
    expect(a).toMatchObject({ slot: 'frameA', ok: true, finite: true, reallocated: false });
    for (const k of ['boundingSphere', 'frontBoundingSphere', 'boundingBox', 'sideTarget', 'eyeBox', 'lensZ', 'templeMm']) expect(a[k]).toEqual(f[k]);
    for (const k of Object.keys(FRAME_LENGTHS)) bitwiseEqual(a.buffers[k], f.buffers[k]);
  });

  test('frameA uses the frame validation and FRAME_LENGTHS buffers', () => {
    const bad = frameItem('frameA', { frame: { ...fullFrame, DBL: Number.NaN } });
    const missing = frameItem('frameA', { buffers: undefined });
    const r = createMeshHandler()({ type: 'mesh', id: 3, items: [bad, missing] });
    expect(r.items[0]).toMatchObject({ slot: 'frameA', ok: false, finite: false, boundingSphere: null, lensZ: null, eyeBox: null });
    for (const k of Object.keys(FRAME_LENGTHS)) expect(r.items[0].buffers[k]).toBe(bad.buffers[k]);
    expect(r.items[1]).toMatchObject({ slot: 'frameA', ok: true, reallocated: true });
    for (const [k, len] of Object.entries(FRAME_LENGTHS)) expect(r.items[1].buffers[k].length).toBe(len);
  });

  test('a compare job OD, OS, frame, A, frameA returns 5 items in order; an unknown slot stays ok false', () => {
    const items = [item('OD'), item('OS'), frameItem('frame', { eyes: { OD: surf('OD'), OS: surf('OS') } }), item('A', 'OD'), frameItem('frameA')];
    const r = createMeshHandler()({ type: 'mesh', id: 4, items });
    expect(r.items.map((i) => [i.slot, i.ok])).toEqual([
      ['OD', true],
      ['OS', true],
      ['frame', true],
      ['A', true],
      ['frameA', true],
    ]);
    const unknown = createMeshHandler()({ type: 'mesh', id: 5, items: [{ ...item('OD'), slot: 'frameB' }] });
    expect(unknown.items[0]).toMatchObject({ slot: 'frameB', ok: false });
    // a lens item may not use a frame slot name
    const asLens = createMeshHandler()({ type: 'mesh', id: 6, items: [{ ...item('OD'), slot: 'frameA', eyes: undefined }] });
    expect(asLens.items[0]).toMatchObject({ slot: 'frameA', ok: false });
  });
});
