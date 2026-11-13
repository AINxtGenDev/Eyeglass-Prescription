// Main-side warp client (04-05, REF-02, D-13). Pure state: no DOM and no Worker construction; the
// caller (the Durchblick view, 04-08) injects `send` and `loadSyncHandler`. A copy of the
// mesh-client.js contract for the warp lane (not a generalisation of it), plus cancel().
//
// The warp runs in its own worker (warp.worker.js), so neither a numbers result nor a mesh
// build waits behind it. One lane:
// - Latest wins: requestWarp() bumps the warp generation and replaces a queued job (returned as
//   `dropped`). At most one job is in flight. A warp request carries no buffers, and the reply's
//   typed arrays are fresh per job, so a stale reply is simply IGNORED: onWarp only ever receives
//   the current generation (T-04-19). The page still re-checks isWarpCurrent() in its paint frame.
// - cancel() (leaving Durchblick): drops the queued job and makes the in-flight one stale, so its
//   reply is ignored and its arrays are never attached.
// - A current job that is lost (worker error, silent worker, rejected sync import) is reported as
//   { items: null, error: true }.
// - Watchdog: no READY, or no reply to a job, within WARP_WATCHDOG_MS → onFallback('timeout');
//   workerError() or a throwing send (DataCloneError) → onFallback('error'). Either switches to
//   sync mode for good. A firing while the tab is hidden, or one more than LATE_MS late
//   (suspended timers), re-arms instead; resume() re-arms on visibilitychange.
// - Sync mode: the handler (loadSyncHandler(), a dynamic import) runs on the main thread ONE ITEM
//   (one panel) PER MACROTASK (T-04-20). The job's generation is re-checked before each item; a
//   stale job stops early and is not delivered.

/** Same value and reason as mesh-client MESH_WATCHDOG_MS and compute-client WATCHDOG_MS. */
export const WARP_WATCHDOG_MS = 10_000;
// A watchdog that fires this much later than asked was suspended, not timed out (compute-client).
const LATE_MS = 1000;

/**
 * @param {object} o
 * @param {(msg: object) => void} o.send post to the warp worker
 * @param {(d: { gen: number, items: object[] | null, computeMs?: number, error?: true }) => void} o.onWarp
 *   called for the current generation only
 * @param {(reason: 'timeout'|'error') => void} o.onFallback
 * @param {() => Promise<{ createWarpHandler: () => (msg: object) => any }>} o.loadSyncHandler
 * @param {(fn: () => void, ms: number) => any} [o.setTimeoutFn]
 * @param {(h: any) => void} [o.clearTimeoutFn]
 * @param {number} [o.watchdogMs]
 * @param {() => number} [o.now]
 * @param {() => boolean} [o.isHidden]
 */
export function createWarpClient({
  send,
  onWarp,
  onFallback,
  loadSyncHandler,
  setTimeoutFn = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeoutFn = (h) => globalThis.clearTimeout(h),
  watchdogMs = WARP_WATCHDOG_MS,
  now = () => globalThis.performance.now(),
  isHidden = () => false,
}) {
  /** @type {'worker' | 'sync'} */
  let mode = 'worker';
  let ready = false;
  let warpGen = 0;
  let nextId = 1;
  /** @type {{ gen: number, items: object[] } | null} */
  let queued = null;
  /** @type {{ id: number, gen: number, items: object[] } | null} */
  let inFlight = null;
  let watch = null;
  /** @type {Promise<(msg: object) => any> | null} */
  let syncHandler = null;

  function disarm() {
    if (watch !== null) clearTimeoutFn(watch);
    watch = null;
  }

  function arm() {
    disarm();
    const start = now();
    watch = setTimeoutFn(() => {
      watch = null;
      if (isHidden() || now() - start > watchdogMs + LATE_MS) {
        arm();
        return;
      }
      fallback('timeout');
    }, watchdogMs);
  }

  /** Only the current generation reaches the page. */
  function deliver(job, d) {
    if (job.gen === warpGen) onWarp({ gen: job.gen, ...d });
  }

  function fallback(reason) {
    if (mode !== 'worker') return;
    mode = 'sync';
    ready = false;
    disarm();
    const lost = inFlight;
    inFlight = null;
    if (lost) deliver(lost, { items: null, error: true });
    onFallback(reason);
    pump();
  }

  function pump() {
    if (inFlight || !queued) return;
    if (mode === 'worker' && !ready) return;
    const job = { id: nextId++, ...queued };
    queued = null;
    inFlight = job;
    if (mode === 'worker') {
      arm();
      try {
        send({ type: 'warp', id: job.id, items: job.items });
      } catch {
        // postMessage threw (e.g. DataCloneError), so no reply will come: a worker error in a
        // following task (not re-entrant into requestWarp), as mesh-client A-WR-01.
        setTimeoutFn(() => fallback('error'), 0);
      }
    } else {
      runSync(job);
    }
  }

  function finishSync(job, d) {
    if (inFlight !== job) return;
    inFlight = null;
    if (d) deliver(job, d);
    pump();
  }

  /** One item per setTimeout(0); stops early (undelivered) when the job became stale. */
  async function runSync(job) {
    let handle;
    try {
      syncHandler ??= loadSyncHandler().then((m) => m.createWarpHandler());
      handle = await syncHandler;
    } catch {
      syncHandler = null; // the next job retries the import
      finishSync(job, { items: null, error: true });
      return;
    }
    const results = [];
    let computeMs = 0;
    const step = () => {
      if (job.gen !== warpGen) {
        finishSync(job, null);
        return;
      }
      const r = handle({ type: 'warp', id: job.id, items: [job.items[results.length]] });
      results.push(r.items[0]);
      computeMs += r.computeMs;
      if (results.length < job.items.length) setTimeoutFn(step, 0);
      else finishSync(job, { items: results, computeMs });
    };
    if (job.items.length === 0) finishSync(job, { items: [], computeMs: 0 });
    else setTimeoutFn(step, 0);
  }

  arm(); // waiting for READY

  return {
    /**
     * @param {object[]} items warp items (warp-protocol.js)
     * @returns {{ gen: number, dropped: object[] | null }} dropped = the replaced queued job's items
     */
    requestWarp(items) {
      warpGen++;
      const dropped = queued?.items ?? null;
      queued = { gen: warpGen, items };
      pump();
      return { gen: warpGen, dropped };
    },
    /** Leaving Durchblick: drop the queued job; the in-flight one becomes stale (reply ignored). */
    cancel() {
      warpGen++;
      queued = null;
    },
    isWarpCurrent: (gen) => gen === warpGen,
    receive(msg) {
      if (mode !== 'worker') return;
      if (msg?.type === 'ready') {
        ready = true;
        disarm();
        pump();
        return;
      }
      if ((msg?.type !== 'warp' && msg?.type !== 'error') || !inFlight || msg.id !== inFlight.id) return;
      const job = inFlight;
      inFlight = null;
      disarm();
      if (msg.type === 'warp') deliver(job, { items: msg.items, computeMs: msg.computeMs });
      else deliver(job, { items: null, error: true });
      pump();
    },
    /** visibilitychange back to visible: a running watchdog restarts with a fresh watchdogMs. */
    resume() {
      if (watch !== null) arm();
    },
    /** Worker 'error'/'messageerror' or a throwing constructor. */
    workerError() {
      fallback('error');
    },
    mode: () => mode,
  };
}
