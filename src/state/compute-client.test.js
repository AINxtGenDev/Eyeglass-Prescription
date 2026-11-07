import { describe, test, expect, vi } from 'vitest';
import { createComputeClient, BUSY_AFTER_MS, WATCHDOG_MS } from './compute-client.js';
import { BENCH_RUNS } from './bench-cases.js';

// Fake clock and timers, injected (no vi.useFakeTimers).
function fakeTimers() {
  let clock = 0;
  let nextId = 1;
  /** @type {Map<number, { at: number, ms: number, fn: () => void }>} */
  const timers = new Map();
  return {
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, ms, fn });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
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
    /** Fire every pending timer with the clock set to t (a late, suspended-tab firing). */
    fireLateAt(t) {
      clock = t;
      const all = [...timers.entries()];
      for (const [id, v] of all) {
        timers.delete(id);
        v.fn();
      }
    },
    set clock(t) {
      clock = t;
    },
    timers,
  };
}

const spec = (eye, sph) => ({ eye, sph, cyl: 0, axisDeg: 0 });
const res = (tag) => ({ ok: true, tag });

function setup({ ready = true, hidden = false } = {}) {
  const ft = fakeTimers();
  const sent = [];
  const cb = {
    onResults: vi.fn(),
    onBusy: vi.fn(),
    onBench: vi.fn(),
    onFailed: vi.fn(),
    onFallback: vi.fn(),
    onOpenChange: vi.fn(),
    onCompare: vi.fn(),
  };
  const state = { hidden };
  const client = createComputeClient({
    send: (m) => sent.push(m),
    ...cb,
    now: ft.now,
    setTimer: ft.setTimer,
    clearTimer: ft.clearTimer,
    isHidden: () => state.hidden,
  });
  if (ready) client.receive({ type: 'ready' });
  /** Answer a compute job: every eye gets res(spec.sph). */
  const answer = (job, extra = {}) =>
    client.receive({
      type: 'result',
      id: job.id,
      eyes: Object.fromEntries(Object.entries(job.eyes).map(([e, v]) => [e, { seq: v.seq, result: res(v.spec.sph) }])),
      computeMs: 1,
      ...extra,
    });
  const delivered = () => cb.onResults.mock.calls.map(([d]) => Object.fromEntries(Object.entries(d.results).map(([e, v]) => [e, v.result.tag])));
  return { ft, sent, cb, client, state, answer, delivered };
}

describe('compute client (01-15, ENG-09 main side)', () => {
  test('constants: busy after 50 ms (RAIL), watchdog 10 s', () => {
    expect(BUSY_AFTER_MS).toBe(50);
    expect(WATCHDOG_MS).toBe(10_000);
  });

  test('first request sends one job with both eyes, seqs 1/1; the same specs again send nothing', () => {
    const { client, sent } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('compute');
    expect(sent[0].eyes.OD.seq).toBe(1);
    expect(sent[0].eyes.OS.seq).toBe(1);
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 1);
    expect(sent).toHaveLength(1);
  });

  test('nothing is sent before READY; READY sends the pending job', () => {
    const { client, sent } = setup({ ready: false });
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    expect(sent).toHaveLength(0);
    client.receive({ type: 'ready' });
    expect(sent).toHaveLength(1);
  });

  test('latest wins: stale OD from job 1 is dropped, OS delivered, one job 2 with the latest OD only', () => {
    const { client, sent, answer, delivered } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    client.request({ OD: spec('OD', -1), OS: spec('OS', -2) }, 1);
    client.request({ OD: spec('OD', -3), OS: spec('OS', -2) }, 2);
    client.request({ OD: spec('OD', -4), OS: spec('OS', -2) }, 3);
    expect(sent).toHaveLength(1);
    answer(sent[0]);
    expect(delivered()).toEqual([{ OS: -2 }]);
    expect(sent).toHaveLength(2);
    expect(Object.keys(sent[1].eyes)).toEqual(['OD']);
    expect(sent[1].eyes.OD.spec.sph).toBe(-4);
    expect(client.isCurrent('OD', 1)).toBe(false);
    expect(client.isCurrent('OS', 1)).toBe(true);
    answer(sent[1]);
    expect(delivered()).toEqual([{ OS: -2 }, { OD: -4 }]);
    expect(client.isCurrent('OD', sent[1].eyes.OD.seq)).toBe(true);
  });

  test('a response with an unknown id is ignored', () => {
    const { client, sent, cb } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    client.receive({ type: 'result', id: 999, eyes: { OD: { seq: 1, result: res(-2) } }, computeMs: 1 });
    expect(cb.onResults).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  test('cancel while in flight: the late result is not delivered and busy clears', () => {
    const { client, sent, cb, ft, answer } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    ft.advance(60);
    expect(cb.onBusy).toHaveBeenCalledWith('OD', true);
    client.request({ OD: null, OS: spec('OS', -2) }, 60);
    expect(cb.onBusy).toHaveBeenCalledWith('OD', false);
    answer(sent[0]);
    expect(cb.onResults).toHaveBeenCalledTimes(1);
    expect(Object.keys(cb.onResults.mock.calls[0][0].results)).toEqual(['OS']);
    expect(client.isCurrent('OD', 1)).toBe(false);
  });

  test('cache: cancel, then re-request a received spec → delivered from the cache, nothing sent', () => {
    const { client, sent, answer, delivered } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    answer(sent[0]);
    client.request({ OD: null }, 10);
    client.request({ OD: spec('OD', -2) }, 20);
    expect(sent).toHaveLength(1);
    expect(delivered()).toEqual([{ OD: -2 }, { OD: -2 }]);
  });

  test('cache: busy on T, retype S → S from the cache, busy off, T late result dropped', () => {
    const { client, sent, cb, ft, answer, delivered } = setup();
    client.request({ OD: spec('OD', -2) }, 0); // S
    answer(sent[0]);
    ft.advance(100);
    client.request({ OD: spec('OD', -3) }, 100); // T
    ft.advance(160);
    expect(cb.onBusy).toHaveBeenLastCalledWith('OD', true);
    client.request({ OD: spec('OD', -2) }, 160); // S again
    expect(cb.onBusy).toHaveBeenLastCalledWith('OD', false);
    expect(delivered()).toEqual([{ OD: -2 }, { OD: -2 }]);
    answer(sent[1]);
    expect(delivered()).toEqual([{ OD: -2 }, { OD: -2 }]);
    expect(sent).toHaveLength(2);
  });

  test('error: only the eyes whose in-flight seq is still current fail; OD seq 2 is sent next', () => {
    const { client, sent, cb } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    client.request({ OD: spec('OD', -3), OS: spec('OS', -2) }, 1);
    client.receive({ type: 'error', id: sent[0].id, eyes: ['OD', 'OS'], message: 'x' });
    expect(cb.onFailed).toHaveBeenCalledTimes(1);
    expect(cb.onFailed).toHaveBeenCalledWith(['OS']);
    expect(sent).toHaveLength(2);
    expect(Object.keys(sent[1].eyes)).toEqual(['OD']);
    expect(sent[1].eyes.OD.seq).toBe(2);
  });

  test('a failed eye is retried on the next request even with the same spec', () => {
    const { client, sent } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    client.receive({ type: 'error', id: sent[0].id, eyes: ['OD'], message: 'x' });
    client.request({ OD: spec('OD', -2) }, 1);
    expect(sent).toHaveLength(2);
  });

  test('workerError() after READY: current eyes fail, in-flight job and watchdog cleared, pending sent', () => {
    const { client, sent, cb, ft } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    client.request({ OD: spec('OD', -3), OS: spec('OS', -2) }, 1);
    client.workerError();
    expect(cb.onFailed).toHaveBeenCalledWith(['OS']);
    expect(sent).toHaveLength(2);
    expect(sent[1].eyes.OD.spec.sph).toBe(-3);
    // job 2 has its own watchdog; answer it, then no stale watchdog may fire
    client.receive({ type: 'result', id: sent[1].id, eyes: { OD: { seq: 2, result: res(-3) } }, computeMs: 1 });
    ft.advance(WATCHDOG_MS * 3);
    expect(cb.onFallback).not.toHaveBeenCalled();
  });

  test('bench error: onBench(caseId, { error: true }), not running, a new bench() is accepted', () => {
    const { client, sent, cb } = setup();
    expect(client.bench(['grenzfall'])).toBe(true);
    expect(client.isBenchRunning()).toBe(true);
    client.receive({ type: 'error', id: sent[0].id, eyes: [], message: 'x' });
    expect(cb.onBench).toHaveBeenCalledWith('grenzfall', { error: true });
    expect(client.isBenchRunning()).toBe(false);
    expect(client.bench(['grenzfall'])).toBe(true);
  });

  test('busy timing: answered at t=30 → never busy', () => {
    const { client, sent, cb, ft, answer } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    ft.advance(30);
    answer(sent[0]);
    ft.advance(500);
    expect(cb.onBusy).not.toHaveBeenCalledWith(expect.anything(), true);
  });

  test('busy timing per eye: OD open at 50 → busy once, OS not; OD answered at 80 → busy off once', () => {
    const { client, sent, cb, ft, answer } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    answer(sent[0]);
    ft.advance(10);
    client.request({ OD: spec('OD', -3), OS: spec('OS', -2) }, 10);
    ft.advance(59);
    expect(cb.onBusy).not.toHaveBeenCalled();
    ft.advance(60);
    expect(cb.onBusy.mock.calls).toEqual([['OD', true]]);
    ft.advance(80);
    answer(sent[1]);
    expect(cb.onBusy.mock.calls).toEqual([['OD', true], ['OD', false]]);
  });

  test('busy timer is timed from the input: inputTs 20 ms in the past → delay 30 ms', () => {
    const { client, ft } = setup();
    ft.clock = 100;
    client.request({ OD: spec('OD', -2) }, 80);
    const delays = [...ft.timers.values()].map((v) => v.ms);
    expect(delays).toContain(30);
  });

  test('a later input to an open eye keeps the earliest open time', () => {
    const { client, cb, ft } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    ft.advance(40);
    client.request({ OD: spec('OD', -3) }, 40);
    ft.advance(50);
    expect(cb.onBusy).toHaveBeenCalledWith('OD', true);
  });

  describe('onOpenChange', () => {
    test('[OD, OS] on the first request, [OS] after OD, [] after all', () => {
      const { client, sent, cb } = setup();
      client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
      expect(cb.onOpenChange).toHaveBeenLastCalledWith(['OD', 'OS']);
      client.receive({ type: 'result', id: sent[0].id, eyes: { OD: { seq: 1, result: res(-2) } }, computeMs: 1 });
      expect(cb.onOpenChange).toHaveBeenLastCalledWith(['OS']);
      // job 1 is answered; OS was in it but missing from the answer, so it is sent again
      expect(sent).toHaveLength(2);
      client.receive({ type: 'result', id: sent[1].id, eyes: { OS: { seq: 1, result: res(-2) } }, computeMs: 1 });
      expect(cb.onOpenChange).toHaveBeenLastCalledWith([]);
    });

    test('fires synchronously inside request(), and queued-but-unsent eyes count as open', () => {
      const { client, cb } = setup({ ready: false });
      client.request({ OD: spec('OD', -2) }, 0);
      expect(cb.onOpenChange).toHaveBeenCalledTimes(1);
      expect(cb.onOpenChange).toHaveBeenLastCalledWith(['OD']);
    });

    test('fires on cancel', () => {
      const { client, cb } = setup();
      client.request({ OD: spec('OD', -2) }, 0);
      client.request({ OD: null }, 1);
      expect(cb.onOpenChange).toHaveBeenLastCalledWith([]);
    });

    test('fires on onFailed, right after onFailed', () => {
      const { client, sent, cb } = setup();
      client.request({ OD: spec('OD', -2) }, 0);
      const order = [];
      cb.onOpenChange.mockImplementation((e) => order.push(['open', e]));
      cb.onFailed.mockImplementation((e) => order.push(['failed', e]));
      client.receive({ type: 'error', id: sent[0].id, eyes: ['OD'], message: 'x' });
      expect(order).toEqual([['failed', ['OD']], ['open', []]]);
    });

    test('a cache delivery reports the eye as no longer open', () => {
      const { client, sent, cb, answer } = setup();
      client.request({ OD: spec('OD', -2) }, 0);
      answer(sent[0]);
      client.request({ OD: spec('OD', -3) }, 1);
      expect(cb.onOpenChange).toHaveBeenLastCalledWith(['OD']);
      client.request({ OD: spec('OD', -2) }, 2);
      expect(cb.onOpenChange).toHaveBeenLastCalledWith([]);
    });

    test('an unchanged request does not fire it', () => {
      const { client, cb } = setup();
      client.request({ OD: spec('OD', -2) }, 0);
      const n = cb.onOpenChange.mock.calls.length;
      client.request({ OD: spec('OD', -2) }, 1);
      expect(cb.onOpenChange.mock.calls.length).toBe(n);
    });
  });

  test('onResults carries openTs, computeMs and current (no eye still open)', () => {
    const { client, sent, cb } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 5);
    client.receive({ type: 'result', id: sent[0].id, eyes: { OD: { seq: 1, result: res(-2) } }, computeMs: 7 });
    expect(cb.onResults.mock.calls[0][0]).toMatchObject({ openTs: 5, computeMs: 7, current: false });
  });

  test('bench interleaving: one run per job, compute goes first, onBench once after BENCH_RUNS', () => {
    const { client, sent, cb, answer } = setup();
    expect(client.bench(['grenzfall'])).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'bench', caseId: 'grenzfall' });
    expect(client.bench(['normal'])).toBe(false);
    expect(sent).toHaveLength(1);
    client.request({ OD: spec('OD', -3) }, 0);
    expect(sent).toHaveLength(1);
    client.receive({ type: 'bench', id: sent[0].id, caseId: 'grenzfall', ms: 1, ok: true });
    expect(sent[1].type).toBe('compute');
    answer(sent[1]);
    expect(sent[2].type).toBe('bench');
    for (let i = 2; i <= BENCH_RUNS; i++) {
      const job = sent.at(-1);
      expect(job.type).toBe('bench');
      client.receive({ type: 'bench', id: job.id, caseId: 'grenzfall', ms: i, ok: true });
    }
    expect(cb.onBench).toHaveBeenCalledTimes(1);
    const [caseId, r] = cb.onBench.mock.calls[0];
    expect(caseId).toBe('grenzfall');
    expect(r.runs).toBe(BENCH_RUNS);
    expect(r.median).toBe(25.5);
    expect(r.tail).toBe(48);
    expect(client.isBenchRunning()).toBe(false);
    expect(sent).toHaveLength(1 + BENCH_RUNS);
  });

  test('bench frameMiss: the client supplies a new k for every run', () => {
    const { client, sent } = setup();
    client.bench(['frameMiss']);
    for (let i = 0; i < 3; i++) client.receive({ type: 'bench', id: sent.at(-1).id, caseId: 'frameMiss', ms: 1, ok: true });
    const ks = sent.map((m) => m.k);
    expect(new Set(ks).size).toBe(ks.length);
  });

  test('bench over several cases reports each case in order', () => {
    const { client, sent, cb } = setup();
    client.bench(['normal', 'rescan']);
    while (client.isBenchRunning()) {
      const job = sent.at(-1);
      client.receive({ type: 'bench', id: job.id, caseId: job.caseId, ms: 1, ok: true });
    }
    expect(cb.onBench.mock.calls.map((c) => c[0])).toEqual(['normal', 'rescan']);
  });

  test('fallback: workerError() before READY → onFallback(start); useTransport re-sends pending work', () => {
    const { client, sent, cb } = setup({ ready: false });
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    client.workerError();
    expect(cb.onFallback).toHaveBeenCalledWith('start');
    const sync = [];
    client.useTransport((m) => sync.push(m));
    expect(sent).toHaveLength(0);
    expect(sync).toHaveLength(1);
    expect(Object.keys(sync[0].eyes)).toEqual(['OD', 'OS']);
  });

  test('watchdog: no READY within watchdogMs → onFallback(timeout)', () => {
    const { cb, ft } = setup({ ready: false });
    ft.advance(WATCHDOG_MS - 1);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('watchdog: a job with no answer within watchdogMs → timeout; useTransport re-sends the in-flight job', () => {
    const { client, cb, ft } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    ft.advance(WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    const sync = [];
    client.useTransport((m) => sync.push(m));
    expect(sync).toHaveLength(1);
    expect(sync[0].eyes.OD.spec.sph).toBe(-2);
    ft.advance(WATCHDOG_MS * 5);
    expect(cb.onFallback).toHaveBeenCalledTimes(1);
  });

  test('watchdog: firing while hidden re-arms instead of falling back', () => {
    const { client, cb, ft, state } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    state.hidden = true;
    ft.advance(WATCHDOG_MS);
    expect(cb.onFallback).not.toHaveBeenCalled();
    state.hidden = false;
    ft.advance(2 * WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('watchdog: a late firing (suspended timers) re-arms instead of falling back', () => {
    const { client, cb, ft } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    ft.fireLateAt(WATCHDOG_MS + 5000);
    expect(cb.onFallback).not.toHaveBeenCalled();
    expect([...ft.timers.values()].some((v) => v.ms === WATCHDOG_MS)).toBe(true);
  });

  test('watchdog: resume() re-arms with a fresh watchdogMs', () => {
    const { client, cb, ft } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    ft.advance(WATCHDOG_MS - 100);
    client.resume();
    ft.advance(WATCHDOG_MS + 100);
    expect(cb.onFallback).not.toHaveBeenCalled();
    ft.advance(2 * WATCHDOG_MS - 100);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
  });

  test('visibilitychange before the late timer and after it: no fallback either way', () => {
    // order 1: resume() first, then the throttled timer fires late
    const a = setup();
    a.client.request({ OD: spec('OD', -2) }, 0);
    a.ft.clock = WATCHDOG_MS + 5000;
    a.client.resume();
    a.ft.advance(WATCHDOG_MS + 5001);
    expect(a.cb.onFallback).not.toHaveBeenCalled();
    // order 2: the late timer fires first, then resume()
    const b = setup();
    b.client.request({ OD: spec('OD', -2) }, 0);
    b.ft.fireLateAt(WATCHDOG_MS + 5000);
    b.client.resume();
    expect(b.cb.onFallback).not.toHaveBeenCalled();
  });
});

// Compare lane (02-06, RES-02): low priority, latest wins, one material pair per job.
describe('compare lane (02-06)', () => {
  const pairJob = (key) => ({ key, specs: { OD: spec('OD', -2), OS: spec('OS', -2) } });
  const answerCompare = (client, job, tag) =>
    client.receive({ type: 'compare', id: job.id, eyes: { OD: res(tag), OS: res(tag) }, computeMs: 1 });

  test('an idle client sends one compare job at a time, in queue order', () => {
    const { client, sent, cb } = setup();
    const gen = client.requestCompare([pairJob('a'), pairJob('b')]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'compare', eyes: { OD: spec('OD', -2), OS: spec('OS', -2) } });
    answerCompare(client, sent[0], 'a');
    expect(cb.onCompare).toHaveBeenCalledWith({ gen, key: 'a', results: { OD: res('a'), OS: res('a') } });
    expect(sent).toHaveLength(2);
    expect(sent[1].type).toBe('compare');
    answerCompare(client, sent[1], 'b');
    expect(cb.onCompare).toHaveBeenCalledTimes(2);
    expect(sent).toHaveLength(2);
  });

  test('main before compare, at most one compare job ahead (dispatch order compute → compare → compute)', () => {
    const { client, sent, cb, answer } = setup();
    client.request({ OD: spec('OD', -2), OS: spec('OS', -2) }, 0);
    client.requestCompare([pairJob('a'), pairJob('b')]);
    expect(sent.map((m) => m.type)).toEqual(['compute']);
    answer(sent[0]);
    expect(sent.map((m) => m.type)).toEqual(['compute', 'compare']);
    // a changed main request while the compare job is in flight waits for that one job only
    client.request({ OD: spec('OD', -3), OS: spec('OS', -2) }, 1);
    expect(sent).toHaveLength(2);
    answerCompare(client, sent[1], 'a');
    expect(sent.map((m) => m.type)).toEqual(['compute', 'compare', 'compute']);
    // the answer belonged to the old generation: dropped; the queue was cleared ('b' never sent)
    expect(cb.onCompare).not.toHaveBeenCalled();
    answer(sent[2]);
    expect(sent).toHaveLength(3);
  });

  test('a changed request bumps the generation; isCompareCurrent follows it', () => {
    const { client } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    const g1 = client.requestCompare([pairJob('a')]);
    expect(client.isCompareCurrent(g1)).toBe(true);
    client.request({ OD: spec('OD', -3) }, 1);
    expect(client.isCompareCurrent(g1)).toBe(false);
    const g2 = client.requestCompare([]);
    expect(g2).toBe(g1 + 1);
    client.request({ OD: null }, 2); // a cancel is a change too
    expect(client.isCompareCurrent(g2)).toBe(false);
  });

  test('identical request keeps the compare queue and the generation', () => {
    const { client, sent, cb } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    const gen = client.requestCompare([pairJob('a'), pairJob('b')]);
    client.request({ OD: spec('OD', -2) }, 1);
    expect(client.isCompareCurrent(gen)).toBe(true);
    client.receive({ type: 'result', id: sent[0].id, eyes: { OD: { seq: 1, result: res(-2) } }, computeMs: 1 });
    answerCompare(client, sent[1], 'a');
    answerCompare(client, sent[2], 'b');
    expect(cb.onCompare.mock.calls.map(([d]) => d.key)).toEqual(['a', 'b']);
  });

  test('cached compare keys resolve synchronously without dispatch', () => {
    const { client, sent, cb } = setup();
    client.requestCompare([pairJob('a')]);
    answerCompare(client, sent[0], 'a');
    client.request({ OD: spec('OD', -5) }, 0); // new generation
    client.receive({ type: 'result', id: sent[1].id, eyes: { OD: { seq: 1, result: res(-5) } }, computeMs: 1 });
    const gen = client.requestCompare([pairJob('a')]);
    expect(sent).toHaveLength(2);
    expect(cb.onCompare).toHaveBeenLastCalledWith({ gen, key: 'a', results: { OD: res('a'), OS: res('a') } });
  });

  test('the compare cache keeps the 64 most recent keys (LRU)', () => {
    const { client, sent } = setup();
    for (let i = 0; i < 65; i++) {
      client.requestCompare([pairJob('k' + i)]);
      answerCompare(client, sent.at(-1), i);
    }
    const n = sent.length;
    client.requestCompare([pairJob('k64'), pairJob('k1')]);
    expect(sent).toHaveLength(n);
    client.requestCompare([pairJob('k0')]); // evicted
    expect(sent).toHaveLength(n + 1);
  });

  test('compare error never calls onFailed and never touches main eyes', () => {
    const { client, sent, cb, answer } = setup();
    client.request({ OD: spec('OD', -2) }, 0);
    answer(sent[0]);
    const gen = client.requestCompare([pairJob('a'), pairJob('b')]);
    client.receive({ type: 'error', id: sent[1].id, eyes: [], message: 'x' });
    expect(cb.onFailed).not.toHaveBeenCalled();
    expect(cb.onCompare).toHaveBeenCalledWith({ gen, key: 'a', results: null, error: true });
    expect(client.isCurrent('OD', 1)).toBe(true);
    expect(sent[2]).toMatchObject({ type: 'compare' }); // 'b' goes on
    // an error is not cached: the same key is sent again
    answerCompare(client, sent[2], 'b');
    client.requestCompare([pairJob('a')]);
    expect(sent).toHaveLength(4);
  });

  test('a compare error of an old generation is not reported', () => {
    const { client, sent, cb } = setup();
    client.requestCompare([pairJob('a')]);
    client.request({ OD: spec('OD', -2) }, 0);
    client.receive({ type: 'error', id: sent[0].id, eyes: [], message: 'x' });
    expect(cb.onCompare).not.toHaveBeenCalled();
    expect(sent[1].type).toBe('compute');
  });

  test('workerError with a compare job in flight: main is sent, onFailed not called, compare queue kept', () => {
    const { client, sent, cb, answer } = setup();
    const gen = client.requestCompare([pairJob('a'), pairJob('b')]);
    client.request({ OD: spec('OD', -2) }, 0); // changed: clears the queue
    client.requestCompare([pairJob('c'), pairJob('d')]);
    client.workerError();
    expect(cb.onFailed).not.toHaveBeenCalled();
    expect(cb.onCompare).not.toHaveBeenCalledWith(expect.objectContaining({ gen }));
    expect(sent.map((m) => m.type)).toEqual(['compare', 'compute']);
    answer(sent[1]);
    expect(sent[2]).toMatchObject({ type: 'compare' });
    answerCompare(client, sent[2], 'c');
    answerCompare(client, sent[3], 'd');
    expect(cb.onCompare.mock.calls.map(([d]) => d.key)).toEqual(['c', 'd']);
  });

  test('bench runs only after the compare queue is empty', () => {
    const { client, sent } = setup();
    client.requestCompare([pairJob('a')]);
    client.bench(['normal']);
    expect(sent.map((m) => m.type)).toEqual(['compare']);
    answerCompare(client, sent[0], 'a');
    expect(sent.map((m) => m.type)).toEqual(['compare', 'bench']);
  });

  test('cancelCompare empties the queue; the job in flight still answers', () => {
    const { client, sent, cb } = setup();
    client.requestCompare([pairJob('a'), pairJob('b')]);
    client.cancelCompare();
    answerCompare(client, sent[0], 'a');
    expect(sent).toHaveLength(1);
    expect(cb.onCompare).toHaveBeenCalledTimes(1);
  });

  test('timeout fallback with a compare job in flight: the job goes back to the queue', () => {
    const { client, sent, cb, ft } = setup();
    client.requestCompare([pairJob('a')]);
    ft.advance(WATCHDOG_MS);
    expect(cb.onFallback).toHaveBeenCalledWith('timeout');
    const sync = [];
    client.useTransport((m) => sync.push(m));
    expect(sync).toHaveLength(0);
    client.runCompareNow();
    expect(sync).toEqual([{ type: 'compare', id: expect.any(Number), eyes: pairJob('a').specs }]);
    expect(sent).toHaveLength(1);
  });

  test('sync mode: compare waits for runCompareNow(), main does not; runCompareNow lasts until the queue drains', () => {
    const { client, cb } = setup({ ready: false });
    client.workerError();
    const sync = [];
    client.useTransport((m) => sync.push(m));
    client.requestCompare([pairJob('a'), pairJob('b')]);
    expect(sync).toHaveLength(0);
    client.request({ OD: spec('OD', -2) }, 0);
    client.requestCompare([pairJob('a'), pairJob('b')]);
    expect(sync.map((m) => m.type)).toEqual(['compute']);
    client.receive({ type: 'result', id: sync[0].id, eyes: { OD: { seq: 1, result: res(-2) } }, computeMs: 1 });
    expect(sync).toHaveLength(1);
    client.runCompareNow();
    expect(sync.map((m) => m.type)).toEqual(['compute', 'compare']);
    answerCompare(client, sync[1], 'a');
    answerCompare(client, sync[2], 'b');
    expect(cb.onCompare).toHaveBeenCalledTimes(2);
    // drained: a new compare request waits again
    client.request({ OD: spec('OD', -3) }, 1);
    client.receive({ type: 'result', id: sync[3].id, eyes: { OD: { seq: 2, result: res(-3) } }, computeMs: 1 });
    client.requestCompare([pairJob('c')]);
    expect(sync).toHaveLength(4);
  });
});
