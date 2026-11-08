// Main-side mesh client (03-04, VIZ-06). Pure state: no DOM and no Worker construction; the
// caller (the lazy view chunk, 03-05) injects `send` and `loadSyncHandler`.
//
// lens-critic MAJOR 3: meshes run in a dedicated worker (mesh.worker.js), so the numbers'
// compute client never waits behind a mesh build. This client has one lane:
// - Latest wins: requestMesh() bumps the mesh generation and replaces a queued job; the replaced
//   job's items come back as `dropped` so the page reclaims their buffers. At most one job is in
//   flight. A reply of an older generation is delivered as current: false (the page only reclaims
//   its buffers); the page re-checks isMeshCurrent() in its paint frame (T-03-10).
// - No buffer is lost silently: a job whose buffers went to a worker that errored or went silent
//   is reported as { items: null, error: true } so the page re-allocates.
// - Watchdog: no READY, or no reply to a job, within MESH_WATCHDOG_MS → onFallback('timeout');
//   workerError() → onFallback('error'). Either switches to sync mode for good.
// - Sync mode: the handler (loadSyncHandler(), a dynamic import) runs on the main thread ONE ITEM
//   PER MACROTASK, so an input waits for at most one lens build (lens-critic MINOR 7; Open
//   Question 4). The job's generation is re-checked before each item; a stale job stops early and
//   returns its unbuilt items with their original buffers.

/** Same value and reason as compute-client WATCHDOG_MS. */
export const MESH_WATCHDOG_MS = 10_000;

/**
 * @param {object} o
 * @param {(msg: object) => void} o.send post to the mesh worker (with transferOf(msg))
 * @param {(d: { gen: number, items: object[] | null, current: boolean, error?: true }) => void} o.onMesh
 * @param {(reason: 'timeout'|'error') => void} o.onFallback
 * @param {() => Promise<{ createMeshHandler: () => (msg: object) => any }>} o.loadSyncHandler
 * @param {(fn: () => void, ms: number) => any} [o.setTimeoutFn]
 * @param {(h: any) => void} [o.clearTimeoutFn]
 * @param {number} [o.watchdogMs]
 */
export function createMeshClient({
  send,
  onMesh,
  onFallback,
  loadSyncHandler,
  setTimeoutFn = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeoutFn = (h) => globalThis.clearTimeout(h),
  watchdogMs = MESH_WATCHDOG_MS,
}) {
  /** @type {'worker' | 'sync'} */
  let mode = 'worker';
  let ready = false;
  let meshGen = 0;
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
    watch = setTimeoutFn(() => {
      watch = null;
      fallback('timeout');
    }, watchdogMs);
  }

  function deliver(job, items, extra = {}) {
    onMesh({ gen: job.gen, items, ...extra, current: job.gen === meshGen });
  }

  function fallback(reason) {
    if (mode !== 'worker') return;
    mode = 'sync';
    ready = false;
    disarm();
    // Its buffers were transferred to the worker: report the job so the page re-allocates.
    const lost = inFlight;
    inFlight = null;
    if (lost) deliver(lost, null, { error: true });
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
      send({ type: 'mesh', id: job.id, items: job.items });
    } else {
      runSync(job);
    }
  }

  function finishSync(job, items, extra) {
    if (inFlight !== job) return;
    inFlight = null;
    deliver(job, items, extra);
    pump();
  }

  /** One item per setTimeout(0); stops early when a newer request made the job stale. */
  async function runSync(job) {
    let handle;
    try {
      syncHandler ??= loadSyncHandler().then((m) => m.createMeshHandler());
      handle = await syncHandler;
    } catch {
      syncHandler = null; // the next job retries the import
      finishSync(job, null, { error: true });
      return;
    }
    const results = [];
    const step = () => {
      if (job.gen !== meshGen) {
        const unbuilt = job.items.slice(results.length).map((it) => ({
          slot: it?.slot ?? null,
          ok: false,
          finite: false,
          buffers: it?.buffers,
          boundingSphere: null,
        }));
        finishSync(job, [...results, ...unbuilt]);
        return;
      }
      const item = job.items[results.length];
      results.push(handle({ type: 'mesh', id: job.id, items: [item] }).items[0]);
      if (results.length < job.items.length) setTimeoutFn(step, 0);
      else finishSync(job, results);
    };
    if (job.items.length === 0) finishSync(job, []);
    else setTimeoutFn(step, 0);
  }

  arm(); // waiting for READY

  return {
    /**
     * @param {object[]} items mesh items (mesh-protocol.js)
     * @returns {{ gen: number, dropped: object[] | null }} dropped = the replaced queued job's items
     */
    requestMesh(items) {
      meshGen++;
      const dropped = queued?.items ?? null;
      queued = { gen: meshGen, items };
      pump();
      return { gen: meshGen, dropped };
    },
    isMeshCurrent: (gen) => gen === meshGen,
    receive(msg) {
      if (mode !== 'worker') return;
      if (msg?.type === 'ready') {
        ready = true;
        disarm();
        pump();
        return;
      }
      if ((msg?.type !== 'mesh' && msg?.type !== 'error') || !inFlight || msg.id !== inFlight.id) return;
      const job = inFlight;
      inFlight = null;
      disarm();
      if (msg.type === 'mesh') deliver(job, msg.items);
      else deliver(job, null, { error: true });
      pump();
    },
    /** Worker 'error'/'messageerror' or a throwing constructor. */
    workerError() {
      fallback('error');
    },
    mode: () => mode,
  };
}
