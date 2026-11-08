import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { transferOf } from './transfer.js';

const meshMsg = () => {
  const shared = new Float32Array(6);
  return {
    type: 'mesh',
    id: 1,
    items: [
      { slot: 'OD', buffers: { front: new Float32Array(3), back: new Float32Array(3) } },
      // two keys on one ArrayBuffer: transferred once
      { slot: 'OS', buffers: { front: shared, frontN: new Float32Array(shared.buffer, 0, 3), n: 7 } },
    ],
  };
};

describe('transferOf (03-04, MINOR 2)', () => {
  test('a mesh message → the unique ArrayBuffers of every buffer view', () => {
    const m = meshMsg();
    const t = transferOf(m);
    expect(t).toHaveLength(3);
    expect(new Set(t).size).toBe(3);
    expect(t).toContain(m.items[0].buffers.front.buffer);
    expect(t).toContain(m.items[0].buffers.back.buffer);
    expect(t).toContain(m.items[1].buffers.front.buffer);
    for (const b of t) expect(b).toBeInstanceOf(ArrayBuffer);
  });

  test('items without buffers (an unbuilt reply) are skipped', () => {
    expect(transferOf({ type: 'mesh', id: 2, items: [{ slot: 'OD' }, null] })).toEqual([]);
    expect(transferOf({ type: 'mesh', id: 2 })).toEqual([]);
  });

  test('every other message and null/undefined → []', () => {
    for (const type of ['result', 'compare', 'profile', 'bench', 'error', 'ready']) {
      expect(transferOf({ type, id: 1, items: [{ buffers: { a: new Float32Array(2) } }] })).toEqual([]);
    }
    expect(transferOf(null)).toEqual([]);
    expect(transferOf(undefined)).toEqual([]);
  });

  test('structuredClone with the transfer list detaches the source arrays', () => {
    const m = meshMsg();
    m.items[0].buffers.front[1] = 4.5;
    const src = m.items[0].buffers.front;
    const copy = structuredClone(m, { transfer: transferOf(m) });
    expect(src.byteLength).toBe(0);
    expect(m.items[1].buffers.front.byteLength).toBe(0);
    expect(copy.items[0].buffers.front[1]).toBe(4.5);
    // the shared view stays shared in the copy
    expect(copy.items[1].buffers.frontN.buffer).toBe(copy.items[1].buffers.front.buffer);
  });

  test('transfer.js has no import statement', () => {
    const text = readFileSync(new URL('./transfer.js', import.meta.url), 'utf8');
    expect(text).not.toMatch(/^\s*import\b/m);
  });
});
