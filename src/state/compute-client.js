// Main-side compute client (01-15, ENG-09). Pure: transport, clock, timers and visibility are
// injected, so this module has no DOM and runs under Node in compute-client.test.js.
//
// - Latest wins: every request gets a per-eye seq; a response is applied per eye only when its
//   seq equals the wanted seq (T-01-38). The page re-checks isCurrent() before painting.
// - One job in flight; compute always goes before the next bench run, and a bench is one run per
//   job, so a compute request waits for at most one job (T-01-40).
// - Busy feedback per eye after BUSY_AFTER_MS, timed from the eye's earliest open input. RAIL:
//   "For actions that take longer than 50 ms to complete, always provide feedback"
//   (https://web.dev/articles/rail).
// - Watchdog: no READY, or no answer to a job, within WATCHDOG_MS → onFallback('timeout'). A
//   firing while the tab is hidden, or a late firing (timers were suspended), re-arms instead;
//   resume() re-arms on visibilitychange. The order of the visibilitychange event and the resumed
//   throttled timers is UNVERIFIED; the late-fire rule covers both orders (unit-tested).
import { BENCH_RUNS, medianOf, tailOf } from './bench-cases.js';

export const BUSY_AFTER_MS = 50;
export const WATCHDOG_MS = 10_000;
/** Percentile reported next to the bench median (p95 of 50 runs = the 48th value). */
export const TAIL_PCT = 95;
// A watchdog that fires this much later than asked was suspended, not timed out.
const LATE_MS = 1000;

const EYES = /** @type {const} */ (['OD', 'OS']);

/**
 * @param {object} o
 * @param {(msg: object) => void} o.send
 * @param {(d: { results: object, openTs: number|null, computeMs: number|null, current: boolean }) => void} o.onResults
 *   current = no eye is still open after this delivery
 * @param {(eye: string, on: boolean) => void} o.onBusy
 * @param {(caseId: string, r: { median: number, tail: number, runs: number } | { error: true }) => void} o.onBench
 * @param {(eyes: string[]) => void} o.onFailed
 * @param {(reason: 'start'|'timeout') => void} o.onFallback
 * @param {(openEyes: string[]) => void} o.onOpenChange fires synchronously whenever the open set changes
 * @param {() => number} [o.now] @param {(fn: () => void, ms: number) => any} [o.setTimer]
 * @param {(h: any) => void} [o.clearTimer] @param {() => boolean} [o.isHidden]
 * @param {number} [o.busyAfterMs] @param {number} [o.watchdogMs]
 */
export function createComputeClient({
  send,
  onResults,
  onBusy,
  onBench,
  onFailed,
  onFallback,
  onOpenChange,
  now = () => globalThis.performance.now(),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (h) => globalThis.clearTimeout(h),
  isHidden = () => false,
  busyAfterMs = BUSY_AFTER_MS,
  watchdogMs = WATCHDOG_MS,
}) {
  /** @type {((msg: object) => void) | null} */
  let transport = send;
  let ready = false;
  /** 'worker' → 'fallback' (waiting for useTransport) → 'sync' */
  let mode = 'worker';
  let nextId = 1;
  let frameMissK = 0;
  const seqs = { OD: 0, OS: 0 };
  /** @type {Record<string, { seq: number, key: string|null, spec: object, sent: boolean, done: boolean } | null>} */
  const wanted = { OD: null, OS: null };
  /** Last delivered result per eye. */
  const cache = { OD: null, OS: null };
  /** Earliest open input per eye; null = not open (delivered, failed, cancelled or never asked). */
  const openSince = { OD: null, OS: null };
  const busyTimer = { OD: null, OS: null };
  const busy = { OD: false, OS: false };
  let lastOpen = '';
  /** @type {{ id: number, kind: 'compute', eyes: Record<string, number> } | { id: number, kind: 'bench', caseId: string } | null} */
  let inFlight = null;
  /** @type {{ caseIds: string[], idx: number, times: number[] } | null} */
  let bench = null;
  let watch = null;

  const isOpen = (eye) => openSince[eye] !== null;
  const openEyes = () => EYES.filter(isOpen);
  const notifyOpen = () => {
    const eyes = openEyes();
    const key = eyes.join(' ');
    if (key === lastOpen) return;
    lastOpen = key;
    onOpenChange(eyes);
  };

  function open(eye, inputTs) {
    if (isOpen(eye)) return; // keeps the earliest open input
    openSince[eye] = inputTs;
    busyTimer[eye] = setTimer(
      () => {
        busyTimer[eye] = null;
        if (isOpen(eye) && !busy[eye]) {
          busy[eye] = true;
          onBusy(eye, true);
        }
      },
      Math.max(0, inputTs + busyAfterMs - now()),
    );
  }

  function close(eye) {
    openSince[eye] = null;
    if (busyTimer[eye] !== null) {
      clearTimer(busyTimer[eye]);
      busyTimer[eye] = null;
    }
    if (busy[eye]) {
      busy[eye] = false;
      onBusy(eye, false);
    }
  }

  function disarm() {
    if (watch !== null) clearTimer(watch);
    watch = null;
  }

  function arm() {
    disarm();
    if (mode !== 'worker') return;
    const start = now();
    watch = setTimer(() => {
      watch = null;
      if (isHidden() || now() - start > watchdogMs + LATE_MS) {
        arm();
        return;
      }
      fallback('timeout');
    }, watchdogMs);
  }

  function fallback(reason) {
    if (mode !== 'worker') return;
    mode = 'fallback';
    ready = false;
    transport = null;
    disarm();
    // The in-flight job is re-sent through the new transport.
    if (inFlight?.kind === 'compute') {
      for (const [eye, seq] of Object.entries(inFlight.eyes)) {
        const w = wanted[eye];
        if (w && w.seq === seq && !w.done) w.sent = false;
      }
    }
    inFlight = null;
    onFallback(reason);
  }

  function dispatch(msg) {
    arm();
    /** @type {(m: object) => void} */ (transport)(msg);
  }

  function pump() {
    if (!ready || !transport || inFlight) return;
    const eyes = {};
    for (const eye of EYES) {
      const w = wanted[eye];
      if (w && !w.done && !w.sent) eyes[eye] = { seq: w.seq, spec: w.spec };
    }
    const ids = Object.keys(eyes);
    if (ids.length > 0) {
      for (const eye of ids) wanted[eye].sent = true;
      inFlight = { id: nextId++, kind: 'compute', eyes: Object.fromEntries(ids.map((e) => [e, eyes[e].seq])) };
      dispatch({ type: 'compute', id: inFlight.id, eyes });
      return;
    }
    if (bench) {
      const caseId = bench.caseIds[bench.idx];
      const k = caseId === 'frameMiss' ? frameMissK++ : 0;
      inFlight = { id: nextId++, kind: 'bench', caseId };
      dispatch({ type: 'bench', id: inFlight.id, caseId, k });
    }
  }

  function failCurrent(job) {
    const failed = [];
    for (const [eye, seq] of Object.entries(job.eyes)) {
      const w = wanted[eye];
      if (!w || w.done || w.seq !== seq) continue;
      w.done = true;
      w.key = null; // the next request retries, even with the same spec
      close(eye);
      failed.push(eye);
    }
    if (failed.length > 0) onFailed(failed);
    notifyOpen();
  }

  function endBenchWithError(caseId) {
    if (bench === null) return;
    bench = null;
    onBench(caseId, { error: true });
  }

  function cancel(eye) {
    if (wanted[eye] === null) return;
    seqs[eye]++;
    wanted[eye] = null;
    close(eye);
  }

  function request(specs, inputTs) {
    const fromCache = {};
    let cacheTs = Infinity;
    for (const eye of EYES) {
      const spec = specs[eye] ?? null;
      if (spec === null) {
        cancel(eye);
        continue;
      }
      // The full spec is the key (T-01-35): any nested field change gives a different key.
      const key = JSON.stringify(spec);
      if (wanted[eye]?.key === key) continue;
      const seq = ++seqs[eye];
      if (cache[eye]?.key === key) {
        wanted[eye] = { seq, key, spec, sent: true, done: true };
        fromCache[eye] = { seq, result: cache[eye].result };
        cacheTs = Math.min(cacheTs, openSince[eye] ?? inputTs);
        close(eye);
        continue;
      }
      wanted[eye] = { seq, key, spec, sent: false, done: false };
      open(eye, inputTs);
    }
    if (Object.keys(fromCache).length > 0) {
      onResults({ results: fromCache, openTs: cacheTs, computeMs: null, current: openEyes().length === 0 });
    }
    notifyOpen();
    pump();
  }

  function onResultMsg(msg) {
    if (inFlight?.kind !== 'compute' || msg.id !== inFlight.id) return;
    const job = inFlight;
    inFlight = null;
    disarm();
    const results = {};
    let openTs = Infinity;
    for (const [eye, jobSeq] of Object.entries(job.eyes)) {
      const w = wanted[eye];
      if (!w || w.done) continue;
      const r = msg.eyes?.[eye];
      if (r && r.seq === w.seq) {
        w.done = true;
        cache[eye] = { key: w.key, result: r.result };
        results[eye] = { seq: w.seq, result: r.result };
        openTs = Math.min(openTs, openSince[eye] ?? Infinity);
        close(eye);
      } else if (!r && jobSeq === w.seq) {
        w.sent = false; // the answer missed a current eye: send it again
      }
    }
    if (Object.keys(results).length > 0) {
      onResults({
        results,
        openTs: Number.isFinite(openTs) ? openTs : null,
        computeMs: msg.computeMs ?? null,
        current: openEyes().length === 0,
      });
    }
    notifyOpen();
    pump();
  }

  function onBenchMsg(msg) {
    if (inFlight?.kind !== 'bench' || msg.id !== inFlight.id) return;
    inFlight = null;
    disarm();
    if (bench) {
      bench.times.push(msg.ms);
      if (bench.times.length >= BENCH_RUNS) {
        const sorted = [...bench.times].sort((a, b) => a - b);
        const caseId = bench.caseIds[bench.idx];
        bench.idx++;
        bench.times = [];
        if (bench.idx >= bench.caseIds.length) bench = null;
        onBench(caseId, { median: medianOf(sorted), tail: tailOf(sorted, TAIL_PCT), runs: sorted.length });
      }
    }
    pump();
  }

  function onErrorMsg(msg) {
    if (inFlight === null || msg.id !== inFlight.id) return;
    const job = inFlight;
    inFlight = null;
    disarm();
    if (job.kind === 'bench') endBenchWithError(job.caseId);
    else failCurrent(job);
    pump();
  }

  arm(); // waiting for READY

  return {
    request,
    /** Start a bench over caseIds; false while one is running (re-entry guard). */
    bench(caseIds) {
      if (bench !== null) return false;
      bench = { caseIds: [...caseIds], idx: 0, times: [] };
      pump();
      return true;
    },
    receive(msg) {
      switch (msg?.type) {
        case 'ready':
          if (mode !== 'worker') return;
          ready = true;
          disarm();
          pump();
          return;
        case 'result':
          onResultMsg(msg);
          return;
        case 'bench':
          onBenchMsg(msg);
          return;
        case 'error':
          onErrorMsg(msg);
          return;
      }
    },
    /** Worker 'error'/'messageerror' or a throwing constructor. */
    workerError() {
      if (mode !== 'worker') return;
      if (!ready) {
        fallback('start');
        return;
      }
      if (inFlight === null) return;
      const job = inFlight;
      inFlight = null;
      disarm();
      if (job.kind === 'bench') endBenchWithError(job.caseId);
      else failCurrent(job);
      pump();
    },
    /** Switch to another transport (the sync fallback); re-sends in-flight and pending work. */
    useTransport(fn) {
      transport = fn;
      mode = 'sync';
      ready = true;
      disarm();
      pump();
    },
    resume() {
      if (watch !== null) arm();
    },
    isCurrent: (eye, seq) => wanted[eye]?.seq === seq,
    isBenchRunning: () => bench !== null,
  };
}
