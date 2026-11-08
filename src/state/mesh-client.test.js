// VIZ-06 (03-04): the main-side mesh client. Transport, timers and the sync handler are
// injected; the handler here is a fake that tags each item, so the client is tested alone.
import { describe, test, expect, vi } from 'vitest';
import { createMeshClient, MESH_WATCHDOG_MS } from './mesh-client.js';

// Fake timers, injected (no vi.useFakeTimers); the fakeTimers() shape of compute-client.test.js.
function fakeTimers() {
  let clock = 0;
  let nextId = 1;
  /** @type {Map<number, { at: number, ms: number, fn: () => void }>} */
  const timers = new Map();
  return {
    setTimeoutFn: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, ms, fn });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    /** Move the clock to t, firing due timers in time order. */
    advance(t) {
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        clock = due[1].at;
        due[1].fn();
      }
      clock = t;
    },
    /** Fire the oldest pending 0-ms timer (one macrotask); false when none. */
    runOneZero() {
      const z = [...timers.entries()].find(([, v]) => v.ms === 0);
      if (!z) return false;
      timers.delete(z[0]);
      z[1].fn();
      return true;
    },
    zeroCount: () => [...timers.values()].filter((v) => v.ms === 0).length,
    /** Fire every pending timer with the clock set to t (a late, suspended-tab firing). */
    fireLateAt(t) {
      clock = t;
      for (const [id, v] of [...timers.entries()]) {
        timers.delete(id);
        v.fn();
      }
    },
    now: () => clock,
    timers,
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const it3 = (tag) => ['OD', 'OS', 'A'].map((slot) => ({ slot, tag, buffers: { front: new Float32Array(3) } }));

function setup({ ready = true, loadSyncHandler } = {}) {
  const ft = fakeTimers();
  const state = { hidden: false };
  const sent = [];
  const handled = [];
  const syncHandler = {
    createMeshHandler: vi.fn(() => (msg) => {
      handled.push(...msg.items.map((i) => i.tag + ':' + i.slot));
      return { type: 'mesh', id: msg.id, items: msg.items.map((i) => ({ slot: i.slot, ok: true, built: i.tag, buffers: i.buffers })) };
    }),
  };
  const load = vi.fn(loadSyncHandler ?? (async () => syncHandler));
  const cb = { onMesh: vi.fn(), onFallback: vi.fn() };
  const client = createMeshClient({
    send: (m) => sent.push(m),
    ...cb,
    loadSyncHandler: load,
    setTimeoutFn: ft.setTimeoutFn,
    clearTimeoutFn: ft.clearTimeoutFn,
    now: ft.now,
    isHidden: () => state.hidden,
  });
  if (ready) client.receive({ type: 'ready' });
  const reply = (m, extra = {}) =>
    client.receive({ type: 'mesh', id: m.id, items: m.items.map((i) => ({ slot: i.slot, ok: true, built: i.tag })), computeMs: 1, ...extra });
  return { ft, sent, handled, syncHandler, load, cb, client, reply, state };
}

describe('mesh client (03-04, VIZ-06, MAJOR 3 / MINOR 7)', () => {
  test('watchdog constant = 10 s (same as the compute client)', () => {
    expect(MESH_WATCHDOG_MS).toBe(10_000);
  });

  test('nothing is sent before READY; the queued job goes out on READY', () => {
    const { sent, client } = setup({ ready: false });
    const items = it3('a');
    const { gen, dropped } = client.requestMesh(items);
    expect(dropped).toBeNull();
    expect(sent).toHaveLength(0);
    client.receive({ type: 'ready' });
    expect(sent).toEqual([{ type: 'mesh', id: expect.any(Number), items }]);
    expect(client.isMeshCurrent(gen)).toBe(true);
    expect(client.mode()).toBe('worker');
  });

  test('latest wins: a replaced queued job hands its items back; one job in flight', () => {
    const { sent, client, reply, cb } = setup();
    const a = it3('a');
    const b = it3('b');
    const c = it3('c');
    const ra = client.requestMesh(a); // sent at once
    expect(sent).toHaveLength(1);
    const rb = client.requestMesh(b); // queued
    expect(rb).toEqual({ gen: ra.gen + 1, dropped: null });
    const rc = client.requestMesh(c); // replaces b
    expect(rc).toEqual({ gen: ra.gen + 2, dropped: b });
    expect(sent).toHaveLength(1); // still one in flight
    reply(sent[0]);
    expect(cb.onMesh).toHaveBeenLastCalledWith({ gen: ra.gen, items: expect.any(Array), current: false });
    expect(sent).toHaveLength(2);
    expect(sent[1].items).toBe(c);
    reply(sent[1]);
    expect(cb.onMesh).toHaveBeenLastCalledWith({ gen: rc.gen, items: expect.any(Array), current: true });
    expect(client.isMeshCurrent(rc.gen)).toBe(true);
    expect(client.isMeshCurrent(ra.gen)).toBe(false);
  });

  test('stale reply → current false; unknown id ignored', () => {
    const { sent, client, reply, cb } = setup();
    const g1 = client.requestMesh(it3('a')).gen;
    const g2 = client.requestMesh(it3('b')).gen;
    client.receive({ type: 'mesh', id: 999, items: [] });
    expect(cb.onMesh).not.toHaveBeenCalled();
    reply(sent[0]);
    expect(cb.onMesh.mock.calls[0][0]).toMatchObject({ gen: g1, current: false });
    expect(cb.onMesh.mock.calls[0][0].items.map((i) => i.built)).toEqual(['a', 'a', 'a']);
    reply(sent[1]);
    expect(cb.onMesh.mock.calls[1][0]).toMatchObject({ gen: g2, current: true });
  });

  test('an error reply to the in-flight job → items null, error true', () => {
    const { sent, client, cb } = setup();
    const { gen } = client.requestMesh(it3('a'));
    client.receive({ type: 'error', id: sent[0].id, message: 'x' });
    expect(cb.onMesh).toHaveBeenCalledWith({ gen, items: null, error: true, current: true });
  });

  test('watchdog: no READY within 10 s → sync mode, onFallback("timeout") once', async () => {
    const { ft, sent, client, cb, load } = setup({ ready: false });
    const { gen } = client.requestMesh(it3('a'));
    ft.advance(MESH_WATCHDOG_MS - 1);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(MESH_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    expect(client.mode()).toBe('sync');
    await flush();
    while (ft.runOneZero()) await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(0);
    expect(cb.onMesh).toHaveBeenCalledWith({ gen, items: expect.any(Array), current: true });
    client.workerError();
    ft.advance(5 * MESH_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('watchdog: no reply to an in-flight job → that job reported lost, queue runs in sync', async () => {
    const { ft, sent, client, cb } = setup();
    const g1 = client.requestMesh(it3('a')).gen;
    const g2 = client.requestMesh(it3('b')).gen;
    ft.advance(MESH_WATCHDOG_MS);
    expect(cb.onMesh).toHaveBeenCalledWith({ gen: g1, items: null, error: true, current: false });
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    // a late worker reply is ignored after the fallback
    client.receive({ type: 'mesh', id: sent[0].id, items: [] });
    expect(cb.onMesh).toHaveBeenCalledTimes(1);
    await flush();
    while (ft.runOneZero()) await flush();
    expect(cb.onMesh).toHaveBeenLastCalledWith({ gen: g2, items: expect.any(Array), current: true });
    expect(sent).toHaveLength(1);
  });

  // 03-05 (carried from 03-04): the compute-client rule. A backgrounded (frozen) tab must not
  // push the mesh client into permanent sync mode.
  test('watchdog: firing while hidden re-arms instead of falling back', () => {
    const { ft, client, cb, state } = setup();
    client.requestMesh(it3('a'));
    state.hidden = true;
    ft.advance(MESH_WATCHDOG_MS);
    expect(cb.onFallback).not.toHaveBeenCalled();
    state.hidden = false;
    ft.advance(2 * MESH_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('watchdog: a late firing (suspended timers) re-arms instead of falling back', () => {
    const { ft, client, cb } = setup();
    client.requestMesh(it3('a'));
    ft.fireLateAt(MESH_WATCHDOG_MS + 5000);
    expect(cb.onFallback).not.toHaveBeenCalled();
    expect(client.mode()).toBe('worker');
    expect([...ft.timers.values()].some((v) => v.ms === MESH_WATCHDOG_MS)).toBe(true);
  });

  test('watchdog: resume() re-arms with a fresh MESH_WATCHDOG_MS', () => {
    const { ft, client, cb } = setup();
    client.requestMesh(it3('a'));
    ft.advance(MESH_WATCHDOG_MS - 100);
    client.resume();
    ft.advance(MESH_WATCHDOG_MS + 100);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(2 * MESH_WATCHDOG_MS - 100);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('resume() with nothing to watch arms nothing', () => {
    const { ft, client } = setup();
    client.resume();
    expect(ft.timers.size).toBe(0);
  });

  test('a reply in time disarms the watchdog', () => {
    const { ft, sent, client, reply, cb } = setup();
    client.requestMesh(it3('a'));
    ft.advance(MESH_WATCHDOG_MS - 1);
    reply(sent[0]);
    ft.advance(3 * MESH_WATCHDOG_MS);
    expect(cb.onFallback).not.toHaveBeenCalled();
    expect(client.mode()).toBe('worker');
  });

  test('workerError → the in-flight job is reported, onFallback("error"), sync mode', async () => {
    const { ft, client, cb } = setup();
    const { gen } = client.requestMesh(it3('a'));
    client.workerError();
    expect(cb.onMesh).toHaveBeenCalledWith({ gen, items: null, error: true, current: true });
    expect(cb.onFallback).toHaveBeenCalledWith('error');
    expect(client.mode()).toBe('sync');
    client.workerError();
    ft.advance(MESH_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('sync mode: one item per macrotask, handler loaded once, one reply in order', async () => {
    const { ft, client, cb, handled, load, syncHandler } = setup({ ready: false });
    client.workerError(); // before READY: worker never started
    expect(client.mode()).toBe('sync');
    const items = it3('a');
    const { gen } = client.requestMesh(items);
    expect(handled).toHaveLength(0); // nothing runs synchronously in requestMesh
    await flush();
    const perCallback = [];
    while (ft.zeroCount() > 0) {
      const before = handled.length;
      ft.runOneZero();
      perCallback.push(handled.length - before);
      await flush();
    }
    expect(perCallback).toEqual([1, 1, 1]);
    expect(cb.onMesh).toHaveBeenCalledTimes(1);
    const d = cb.onMesh.mock.calls[0][0];
    expect(d).toMatchObject({ gen, current: true });
    expect(d.items.map((i) => i.slot)).toEqual(['OD', 'OS', 'A']);
    expect(d.items.map((i) => i.buffers)).toEqual(items.map((i) => i.buffers));
    // a second job reuses the loaded handler
    client.requestMesh(it3('b'));
    await flush();
    while (ft.runOneZero()) await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(syncHandler.createMeshHandler).toHaveBeenCalledTimes(1);
    expect(handled).toEqual(['a:OD', 'a:OS', 'a:A', 'b:OD', 'b:OS', 'b:A']);
  });

  test('sync stale stop (MINOR 7): a newer request stops the old job before its next item', async () => {
    const { ft, client, cb, handled } = setup({ ready: false });
    client.workerError();
    const job1 = it3('a');
    const g1 = client.requestMesh(job1).gen;
    await flush();
    ft.runOneZero(); // item 1 of job1
    await flush();
    const r2 = client.requestMesh(it3('b'));
    expect(r2.dropped).toBeNull(); // job1 is in flight, not queued
    ft.runOneZero(); // stale check → job1 stops
    await flush();
    expect(cb.onMesh).toHaveBeenCalledTimes(1);
    const d = cb.onMesh.mock.calls[0][0];
    expect(d.gen).toBe(g1);
    expect(d.current).toBe(false);
    expect(d.items[0]).toMatchObject({ slot: 'OD', ok: true, built: 'a' });
    expect(d.items[1]).toEqual({ slot: 'OS', ok: false, finite: false, buffers: job1[1].buffers, boundingSphere: null });
    expect(d.items[2]).toEqual({ slot: 'A', ok: false, finite: false, buffers: job1[2].buffers, boundingSphere: null });
    expect(handled).toEqual(['a:OD']);
    while (ft.runOneZero()) await flush();
    expect(handled).toEqual(['a:OD', 'b:OD', 'b:OS', 'b:A']);
    expect(cb.onMesh).toHaveBeenLastCalledWith({ gen: r2.gen, items: expect.any(Array), current: true });
  });

  test('loadSyncHandler rejecting → items null, error true; no throw; a later job retries', async () => {
    let fail = true;
    const handler = { createMeshHandler: () => (m) => ({ type: 'mesh', id: m.id, items: m.items.map((i) => ({ slot: i.slot, ok: true })) }) };
    const { ft, client, cb } = setup({
      ready: false,
      loadSyncHandler: async () => {
        if (fail) throw new Error('chunk load failed');
        return handler;
      },
    });
    client.workerError();
    const { gen } = client.requestMesh(it3('a'));
    await flush();
    expect(cb.onMesh).toHaveBeenCalledWith({ gen, items: null, error: true, current: true });
    fail = false;
    const g2 = client.requestMesh(it3('b')).gen;
    await flush();
    while (ft.runOneZero()) await flush();
    expect(cb.onMesh).toHaveBeenLastCalledWith({ gen: g2, items: expect.any(Array), current: true });
  });
});
