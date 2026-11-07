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
// - Compare lane (02-06, RES-02, D-15/D-16): the other materials run in the same worker, one
//   material pair per job, only when no main eye is waiting to be sent; pump() order is main
//   compute → one compare job → bench. A changed main request bumps `generation` and clears the
//   queue; answers of an older generation are dropped (T-02-16). So the main result waits for at
//   most one compare job (T-02-17). Worst case measured on the phone: one rescan pair ≈ 25,4 ms
//   (Pixel worker bench, 01-11-SUMMARY Task 3 step 6, lines 119–126; normal pair 2,30 ms,
//   Grenzfall 9,95 ms). Node desktop numbers, not the phone: 3,66 / 17,4 ms (01-11 desktop bench,
//   i7-8809G) and 1,67 / 10,4 ms (02-RESEARCH Pattern 1). A compare error never fails a main eye
//   (T-02-19). In sync mode (no worker) compare jobs run only after runCompareNow(), because they
//   would run on the main thread.
// - Profile jobs (02-13, ANA-01): the cross-section's meridian profiles run last in the compare
//   lane (after every compare job, before bench), with the same generation drop, error branch
//   (a profile error never fails a main eye), sync-mode rule and an LRU cache by key.
import { BENCH_RUNS, medianOf, tailOf } from './bench-cases.js';

export const BUSY_AFTER_MS = 50;
export const WATCHDOG_MS = 10_000;
/** Percentile reported next to the bench median (p95 of 50 runs = the 48th value). */
export const TAIL_PCT = 95;
// A watchdog that fires this much later than asked was suspended, not timed out.
const LATE_MS = 1000;
/** Compare results kept by job key (LRU). */
export const COMPARE_CACHE_SIZE = 64;

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
 * @param {(d: { gen: number, key: string, results: { OD: object, OS: object } | null, error?: true }) => void} [o.onCompare]
 *   a compare job of the current generation finished (or failed: results null, error true)
 * @param {(d: { gen: number, key: string, items: object[] | null, error?: true }) => void} [o.onProfile]
 *   a profile job of the current generation finished (or failed: items null, error true)
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
  onCompare = () => {},
  onProfile = () => {},
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
  /**
   * @type {{ id: number, kind: 'compute', eyes: Record<string, number> }
   *   | { id: number, kind: 'compare', gen: number, key: string, specs: object }
   *   | { id: number, kind: 'profile', gen: number, key: string, items: object[] }
   *   | { id: number, kind: 'bench', caseId: string } | null}
   */
  let inFlight = null;
  /** @type {{ caseIds: string[], idx: number, times: number[] } | null} */
  let bench = null;
  let watch = null;
  /** Bumped by every changed main request; compare answers of an older generation are dropped. */
  let generation = 0;
  /** @type {{ key: string, specs: object }[]} */
  const compareQueue = [];
  /** @type {Map<string, object>} */
  const compareCache = new Map();
  /** Profile jobs (02-13): after the compare queue. @type {{ key: string, items: object[] }[]} */
  const profileQueue = [];
  /** @type {Map<string, object[]>} */
  const profileCache = new Map();
  /** Sync mode only: run compare and profile jobs on the main thread until both queues drain. */
  let allowCompareInSync = false;

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
    // A current compare job goes back to the queue (sync mode runs it after runCompareNow()).
    if (inFlight?.kind === 'compare' && inFlight.gen === generation) {
      compareQueue.unshift({ key: inFlight.key, specs: inFlight.specs });
    }
    if (inFlight?.kind === 'profile' && inFlight.gen === generation) {
      profileQueue.unshift({ key: inFlight.key, items: inFlight.items });
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
    if (compareQueue.length > 0 && (mode !== 'sync' || allowCompareInSync)) {
      const job = /** @type {{ key: string, specs: object }} */ (compareQueue.shift());
      if (compareQueue.length === 0 && profileQueue.length === 0) allowCompareInSync = false;
      inFlight = { id: nextId++, kind: 'compare', gen: generation, key: job.key, specs: job.specs };
      dispatch({ type: 'compare', id: inFlight.id, eyes: job.specs });
      return;
    }
    if (profileQueue.length > 0 && (mode !== 'sync' || allowCompareInSync)) {
      const job = /** @type {{ key: string, items: object[] }} */ (profileQueue.shift());
      if (profileQueue.length === 0) allowCompareInSync = false;
      inFlight = { id: nextId++, kind: 'profile', gen: generation, key: job.key, items: job.items };
      dispatch({ type: 'profile', id: inFlight.id, items: job.items });
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

  /** @returns {boolean} true when an eye was cancelled */
  function cancel(eye) {
    if (wanted[eye] === null) return false;
    seqs[eye]++;
    wanted[eye] = null;
    close(eye);
    return true;
  }

  function clearCompare() {
    compareQueue.length = 0;
    allowCompareInSync = false;
  }

  /** Drop a failed compare job; only the current generation hears about it. */
  function dropCompare(job) {
    if (job.gen === generation) onCompare({ gen: job.gen, key: job.key, results: null, error: true });
  }

  /** Drop a failed profile job, like dropCompare (02-13). */
  function dropProfile(job) {
    if (job.gen === generation) onProfile({ gen: job.gen, key: job.key, items: null, error: true });
  }

  function request(specs, inputTs) {
    const fromCache = {};
    let cacheTs = Infinity;
    let changed = false;
    for (const eye of EYES) {
      const spec = specs[eye] ?? null;
      if (spec === null) {
        if (cancel(eye)) changed = true;
        continue;
      }
      // The full spec is the key (T-01-35): any nested field change gives a different key.
      const key = JSON.stringify(spec);
      if (wanted[eye]?.key === key) continue;
      changed = true;
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
    // Only a change starts a new generation: an identical request keeps the compare queue.
    if (changed) {
      generation++;
      clearCompare();
      profileQueue.length = 0;
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

  function onCompareMsg(msg) {
    if (inFlight?.kind !== 'compare' || msg.id !== inFlight.id) return;
    const job = inFlight;
    inFlight = null;
    disarm();
    const results = msg.eyes;
    compareCache.delete(job.key);
    compareCache.set(job.key, results);
    if (compareCache.size > COMPARE_CACHE_SIZE) compareCache.delete(compareCache.keys().next().value);
    if (job.gen === generation) onCompare({ gen: job.gen, key: job.key, results });
    pump();
  }

  function onProfileMsg(msg) {
    if (inFlight?.kind !== 'profile' || msg.id !== inFlight.id) return;
    const job = inFlight;
    inFlight = null;
    disarm();
    profileCache.delete(job.key);
    profileCache.set(job.key, msg.items);
    if (profileCache.size > COMPARE_CACHE_SIZE) profileCache.delete(profileCache.keys().next().value);
    if (job.gen === generation) onProfile({ gen: job.gen, key: job.key, items: msg.items });
    pump();
  }

  function onErrorMsg(msg) {
    if (inFlight === null || msg.id !== inFlight.id) return;
    const job = inFlight;
    inFlight = null;
    disarm();
    if (job.kind === 'bench') endBenchWithError(job.caseId);
    else if (job.kind === 'compare') dropCompare(job);
    else if (job.kind === 'profile') dropProfile(job);
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
    /**
     * Replace the compare queue with jobs (one material pair each). Cached keys resolve through
     * onCompare inside this call; the rest run after any main work.
     * @param {{ key: string, specs: { OD?: object, OS?: object } }[]} jobs
     * @returns {number} the generation the answers will carry
     */
    requestCompare(jobs) {
      clearCompare();
      for (const job of jobs) {
        const hit = compareCache.get(job.key);
        if (hit === undefined) {
          compareQueue.push(job);
          continue;
        }
        compareCache.delete(job.key);
        compareCache.set(job.key, hit);
        onCompare({ gen: generation, key: job.key, results: hit });
      }
      pump();
      return generation;
    },
    /**
     * Replace the queued profile job (02-13) with one job for `items`, queued after the compare
     * jobs. A cached key resolves through onProfile inside this call.
     * @param {{ surfaces: object, frame: object, eye: string, thetaDeg: number }[]} items
     * @returns {number} the generation the answer will carry
     */
    requestProfiles(items) {
      profileQueue.length = 0;
      const key = JSON.stringify(items);
      const hit = profileCache.get(key);
      if (hit === undefined) profileQueue.push({ key, items });
      else {
        profileCache.delete(key);
        profileCache.set(key, hit);
        onProfile({ gen: generation, key, items: hit });
      }
      pump();
      return generation;
    },
    cancelCompare: clearCompare,
    isCompareCurrent: (gen) => gen === generation,
    /** Sync mode: run the queued compare jobs on the main thread (the page's 'Vergleich berechnen'). */
    runCompareNow() {
      if (compareQueue.length === 0 && profileQueue.length === 0) return;
      allowCompareInSync = true;
      pump();
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
        case 'compare':
          onCompareMsg(msg);
          return;
        case 'profile':
          onProfileMsg(msg);
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
      else if (job.kind === 'compare') dropCompare(job);
      else if (job.kind === 'profile') dropProfile(job);
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
