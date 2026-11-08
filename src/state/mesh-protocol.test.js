// VIZ-06 (03-04): the dedicated mesh worker's handler. Pure, runs in Node.
import { describe, test, expect } from 'vitest';
import { evaluateLens } from '../engine/evaluate.js';
import { frameOutline } from '../engine/frame/outline.js';
import { LENS_LENGTHS, allocLensBuffers, buildLensMesh } from '../engine/mesh/lens.js';
import { createMeshHandler, READY, MESH_SLOTS } from './mesh-protocol.js';

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
    expect(MESH_SLOTS).toEqual(['OD', 'OS', 'A']);
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
