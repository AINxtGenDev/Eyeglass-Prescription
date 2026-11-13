// REF-02 (04-05, D-13): the main-side warp client. Transport, timers and the sync handler are
// injected; the handler here is a fake that tags each item, so the client is tested alone.
import { describe, test, expect, vi } from 'vitest';
import { createWarpClient, WARP_WATCHDOG_MS } from './warp-client.js';

// Fake timers, injected (no vi.useFakeTimers); the same shape as mesh-client.test.js (own copy).
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

const it2 = (tag) => ['R', 'L'].map((panel) => ({ panel, tag }));

function setup({ ready = true, loadSyncHandler, send } = {}) {
  const ft = fakeTimers();
  const state = { hidden: false };
  const sent = [];
  const handled = [];
  const syncHandler = {
    createWarpHandler: vi.fn(() => (msg) => {
      handled.push(...msg.items.map((i) => i.tag + ':' + i.panel));
      return { type: 'warp', id: msg.id, items: msg.items.map((i) => ({ panel: i.panel, ok: true, built: i.tag })), computeMs: 2 };
    }),
  };
  const load = vi.fn(loadSyncHandler ?? (async () => syncHandler));
  const cb = { onWarp: vi.fn(), onFallback: vi.fn() };
  const client = createWarpClient({
    send: send ?? ((m) => sent.push(m)),
    ...cb,
    loadSyncHandler: load,
    setTimeoutFn: ft.setTimeoutFn,
    clearTimeoutFn: ft.clearTimeoutFn,
    now: ft.now,
    isHidden: () => state.hidden,
  });
  if (ready) client.receive({ type: 'ready' });
  const reply = (m, extra = {}) =>
    client.receive({ type: 'warp', id: m.id, items: m.items.map((i) => ({ panel: i.panel, ok: true, built: i.tag })), computeMs: 3, ...extra });
  return { ft, sent, handled, syncHandler, load, cb, client, reply, state };
}

describe('warp client (04-05, D-13)', () => {
  test('watchdog constant = 10 s (same as the mesh and compute clients)', () => {
    expect(WARP_WATCHDOG_MS).toBe(10_000);
  });

  test('nothing is sent before READY; the queued job goes out on READY', () => {
    const { sent, client } = setup({ ready: false });
    const items = it2('a');
    const { gen } = client.requestWarp(items);
    expect(sent).toHaveLength(0);
    client.receive({ type: 'ready' });
    expect(sent).toEqual([{ type: 'warp', id: expect.any(Number), items }]);
    expect(client.isWarpCurrent(gen)).toBe(true);
    expect(client.mode()).toBe('worker');
  });

  test('latest wins: a newer request replaces the queued job; one job in flight; stale reply ignored', () => {
    const { sent, client, reply, cb } = setup();
    const a = it2('a');
    const b = it2('b');
    const c = it2('c');
    const ra = client.requestWarp(a); // sent at once
    expect(sent).toHaveLength(1);
    const rb = client.requestWarp(b); // queued
    expect(rb).toEqual({ gen: ra.gen + 1, dropped: null });
    const rc = client.requestWarp(c); // replaces b
    expect(rc).toEqual({ gen: ra.gen + 2, dropped: b });
    expect(sent).toHaveLength(1);
    reply(sent[0]); // stale: not delivered, the queue moves on
    expect(cb.onWarp).not.toHaveBeenCalled();
    expect(sent).toHaveLength(2);
    expect(sent[1].items).toBe(c);
    reply(sent[1]);
    expect(cb.onWarp).toHaveBeenCalledTimes(1);
    expect(cb.onWarp).toHaveBeenCalledWith({ gen: rc.gen, items: expect.any(Array), computeMs: 3 });
    expect(cb.onWarp.mock.calls[0][0].items.map((i) => i.built)).toEqual(['c', 'c']);
    expect(client.isWarpCurrent(rc.gen)).toBe(true);
    expect(client.isWarpCurrent(ra.gen)).toBe(false);
  });

  test('receive() ignores an unknown id and a wrong type', () => {
    const { sent, client, cb } = setup();
    client.requestWarp(it2('a'));
    client.receive({ type: 'warp', id: 999, items: [] });
    client.receive({ type: 'mesh', id: sent[0].id, items: [] });
    client.receive(null);
    expect(cb.onWarp).not.toHaveBeenCalled();
  });

  test('an error reply to the current in-flight job → items null, error true', () => {
    const { sent, client, cb } = setup();
    const { gen } = client.requestWarp(it2('a'));
    client.receive({ type: 'error', id: sent[0].id, message: 'x' });
    expect(cb.onWarp).toHaveBeenCalledWith({ gen, items: null, error: true });
  });

  test('T-04-19 cancel(): drops the queued job and makes the in-flight one stale (its reply is ignored)', () => {
    const { sent, client, reply, cb } = setup();
    const ra = client.requestWarp(it2('a'));
    client.requestWarp(it2('b')); // queued
    client.cancel();
    expect(client.isWarpCurrent(ra.gen)).toBe(false);
    reply(sent[0]);
    expect(cb.onWarp).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1); // the queued job was dropped, nothing else goes out
    const rd = client.requestWarp(it2('d'));
    expect(sent).toHaveLength(2);
    reply(sent[1]);
    expect(cb.onWarp).toHaveBeenCalledWith({ gen: rd.gen, items: expect.any(Array), computeMs: 3 });
  });

  test('cancel() with nothing pending is harmless; the watchdog still covers an in-flight job', () => {
    const { ft, client, cb } = setup();
    client.cancel();
    expect(client.mode()).toBe('worker');
    client.requestWarp(it2('a'));
    client.cancel();
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    expect(cb.onWarp).not.toHaveBeenCalled(); // the lost job was cancelled: nothing to report
  });

  test('cancel() in sync mode stops the running job before its next item', async () => {
    const { ft, client, cb, handled } = setup({ ready: false });
    client.workerError();
    client.requestWarp(it2('a'));
    await flush();
    ft.runOneZero(); // item 1
    await flush();
    client.cancel();
    while (ft.runOneZero()) await flush();
    expect(handled).toEqual(['a:R']);
    expect(cb.onWarp).not.toHaveBeenCalled();
  });

  test('watchdog: no READY within 10 s → sync mode, onFallback("timeout") once', async () => {
    const { ft, sent, client, cb, load } = setup({ ready: false });
    const { gen } = client.requestWarp(it2('a'));
    ft.advance(WARP_WATCHDOG_MS - 1);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    expect(client.mode()).toBe('sync');
    await flush();
    while (ft.runOneZero()) await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(0);
    expect(cb.onWarp).toHaveBeenCalledWith({ gen, items: expect.any(Array), computeMs: 4 });
    client.workerError();
    ft.advance(5 * WARP_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('watchdog: no reply to the current in-flight job → reported lost; a late reply is ignored', () => {
    const { ft, sent, client, cb } = setup();
    const g1 = client.requestWarp(it2('a')).gen;
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onWarp).toHaveBeenCalledWith({ gen: g1, items: null, error: true });
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    client.receive({ type: 'warp', id: sent[0].id, items: [] }); // late worker reply ignored
    expect(cb.onWarp).toHaveBeenCalledTimes(1);
  });

  test('watchdog: a stale lost job is not reported; the newer queued job runs in sync', async () => {
    const { ft, sent, client, cb } = setup();
    client.requestWarp(it2('a'));
    const g2 = client.requestWarp(it2('b')).gen;
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onWarp).not.toHaveBeenCalled();
    await flush();
    while (ft.runOneZero()) await flush();
    expect(cb.onWarp).toHaveBeenCalledTimes(1);
    expect(cb.onWarp).toHaveBeenLastCalledWith({ gen: g2, items: expect.any(Array), computeMs: 4 });
    expect(sent).toHaveLength(1);
  });

  test('watchdog: firing while hidden re-arms instead of falling back', () => {
    const { ft, client, cb, state } = setup();
    client.requestWarp(it2('a'));
    state.hidden = true;
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onFallback).not.toHaveBeenCalled();
    state.hidden = false;
    ft.advance(2 * WARP_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('watchdog: a late firing (suspended timers) re-arms instead of falling back', () => {
    const { ft, client, cb } = setup();
    client.requestWarp(it2('a'));
    ft.fireLateAt(WARP_WATCHDOG_MS + 5000);
    expect(cb.onFallback).not.toHaveBeenCalled();
    expect(client.mode()).toBe('worker');
    expect([...ft.timers.values()].some((v) => v.ms === WARP_WATCHDOG_MS)).toBe(true);
  });

  test('watchdog: resume() re-arms with a fresh WARP_WATCHDOG_MS', () => {
    const { ft, client, cb } = setup();
    client.requestWarp(it2('a'));
    ft.advance(WARP_WATCHDOG_MS - 100);
    client.resume();
    ft.advance(WARP_WATCHDOG_MS + 100);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(2 * WARP_WATCHDOG_MS - 100);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('resume() with nothing to watch arms nothing', () => {
    const { ft, client } = setup();
    client.resume();
    expect(ft.timers.size).toBe(0);
  });

  test('a reply in time disarms the watchdog', () => {
    const { ft, sent, client, reply, cb } = setup();
    client.requestWarp(it2('a'));
    ft.advance(WARP_WATCHDOG_MS - 1);
    reply(sent[0]);
    ft.advance(3 * WARP_WATCHDOG_MS);
    expect(cb.onFallback).not.toHaveBeenCalled();
    expect(client.mode()).toBe('worker');
  });

  test('workerError → the current in-flight job is reported, onFallback("error"), sync mode', () => {
    const { ft, client, cb } = setup();
    const { gen } = client.requestWarp(it2('a'));
    client.workerError();
    expect(cb.onWarp).toHaveBeenCalledWith({ gen, items: null, error: true });
    expect(cb.onFallback).toHaveBeenCalledWith('error');
    expect(client.mode()).toBe('sync');
    client.workerError();
    ft.advance(WARP_WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('DataCloneError: a throwing send → no throw; the job is reported lost in a later task, sync mode', async () => {
    const send = vi.fn(() => {
      throw new DOMException('Cannot clone.', 'DataCloneError');
    });
    const { ft, client, cb, handled } = setup({ send });
    let r;
    expect(() => {
      r = client.requestWarp(it2('a'));
    }).not.toThrow();
    expect(cb.onWarp).not.toHaveBeenCalled();
    expect(ft.runOneZero()).toBe(true);
    expect(cb.onWarp).toHaveBeenCalledWith({ gen: r.gen, items: null, error: true });
    expect(cb.onFallback).toHaveBeenCalledWith('error');
    expect(client.mode()).toBe('sync');
    const g2 = client.requestWarp(it2('b')).gen;
    await flush();
    while (ft.runOneZero()) await flush();
    expect(handled).toEqual(['b:R', 'b:L']);
    expect(cb.onWarp).toHaveBeenLastCalledWith({ gen: g2, items: expect.any(Array), computeMs: 4 });
    ft.advance(WARP_WATCHDOG_MS * 2);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('T-04-20 sync mode: one item per macrotask, handler loaded once, one reply in order', async () => {
    const { ft, client, cb, handled, load, syncHandler } = setup({ ready: false });
    client.workerError();
    const { gen } = client.requestWarp(it2('a'));
    expect(handled).toHaveLength(0);
    await flush();
    const perCallback = [];
    while (ft.zeroCount() > 0) {
      const before = handled.length;
      ft.runOneZero();
      perCallback.push(handled.length - before);
      await flush();
    }
    expect(perCallback).toEqual([1, 1]);
    expect(cb.onWarp).toHaveBeenCalledTimes(1);
    const d = cb.onWarp.mock.calls[0][0];
    expect(d).toMatchObject({ gen, computeMs: 4 }); // 2 ms per item, summed
    expect(d.items.map((i) => i.panel)).toEqual(['R', 'L']);
    client.requestWarp(it2('b'));
    await flush();
    while (ft.runOneZero()) await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(syncHandler.createWarpHandler).toHaveBeenCalledTimes(1);
    expect(handled).toEqual(['a:R', 'a:L', 'b:R', 'b:L']);
  });

  test('sync stale stop: a newer request stops the old job before its next item; only the newer one is delivered', async () => {
    const { ft, client, cb, handled } = setup({ ready: false });
    client.workerError();
    client.requestWarp(it2('a'));
    await flush();
    ft.runOneZero(); // item 1 of job a
    await flush();
    const r2 = client.requestWarp(it2('b'));
    ft.runOneZero(); // stale check → job a stops
    await flush();
    expect(cb.onWarp).not.toHaveBeenCalled();
    while (ft.runOneZero()) await flush();
    expect(handled).toEqual(['a:R', 'b:R', 'b:L']);
    expect(cb.onWarp).toHaveBeenCalledTimes(1);
    expect(cb.onWarp).toHaveBeenLastCalledWith({ gen: r2.gen, items: expect.any(Array), computeMs: 4 });
  });

  test('loadSyncHandler rejecting → items null, error true; no throw; a later job retries', async () => {
    let fail = true;
    const handler = {
      createWarpHandler: () => (m) => ({ type: 'warp', id: m.id, items: m.items.map((i) => ({ panel: i.panel, ok: true })), computeMs: 1 }),
    };
    const { ft, client, cb } = setup({
      ready: false,
      loadSyncHandler: async () => {
        if (fail) throw new Error('chunk load failed');
        return handler;
      },
    });
    client.workerError();
    const { gen } = client.requestWarp(it2('a'));
    await flush();
    expect(cb.onWarp).toHaveBeenCalledWith({ gen, items: null, error: true });
    fail = false;
    const g2 = client.requestWarp(it2('b')).gen;
    await flush();
    while (ft.runOneZero()) await flush();
    expect(cb.onWarp).toHaveBeenLastCalledWith({ gen: g2, items: expect.any(Array), computeMs: 2 });
  });
});
