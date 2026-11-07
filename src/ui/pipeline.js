// Worker pipeline (moved out of main.js in 02-05, no behaviour change): the compute client, the
// worker with its sync fallback, the settled signal and painting of delivered results.
import { createComputeClient } from '../state/compute-client.js';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { renderResult, renderFailed, renderLrCallout, setStale } from './results.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

// Timing hooks, injected by initPipeline (the ENG-09 readouts own them; no import cycle).
let onBench, onPainted, onCompute;

/** Wire the timing hooks; call once before startWorker(). */
export function initPipeline(hooks) {
  ({ onBench, onPainted, onCompute } = hooks);
}

// Settled signal (01-15): #result[data-pending] is a space-separated token set, '' when nothing
// is pending. 'input' = an input frame is scheduled; OD/OS = the eye is open in the client or
// delivered but not yet painted. e2e/helpers.js settled() waits for ''.
export const pending = { input: false, open: new Set(), delivered: new Set() };

export function writePending() {
  const tokens = pending.input ? ['input'] : [];
  for (const eye of EYES) if (pending.open.has(eye) || pending.delivered.has(eye)) tokens.push(eye);
  const value = tokens.join(' ');
  const el = $('result');
  if (el.dataset.pending !== value) el.dataset.pending = value;
}

/** @type {'worker' | 'sync'} */
export let computeMode = 'worker';
/** @type {Worker | null} */
let worker = null;
const busyEyes = new Set();
// "rechnet …" displays since load (ENG-09 (d), observable on a phone).
export let busyCount = 0;

function onBusy(eye, on) {
  if (on) {
    busyEyes.add(eye);
    busyCount++;
    setText(`result-${eye.toLowerCase()}-status`, t('result.computing'));
    setStale(eye, true);
    $('result').setAttribute('aria-busy', 'true');
    setText('calc-status', t('result.computingNote'));
    return;
  }
  // Marks only; renderResult / renderEmpty / onFailed own the status cell (MINOR-2).
  busyEyes.delete(eye);
  setStale(eye, false);
  // The note explains the dotted cells, so it stays while the other eye is still busy.
  if (busyEyes.size === 0) {
    $('result').removeAttribute('aria-busy');
    setText('calc-status', '');
  }
}

function onFailed(eyes) {
  for (const eye of eyes) renderFailed(eye);
}

// Deliveries are painted in the next frame; an eye is painted only if its seq is still current
// there (an input may arrive between the message and the frame, MINOR-1).
/** @type {Record<string, { seq: number, result: object }>} */
const deliveries = {};
let deliveryFrame = null;
/** Earliest open input of the deliveries waiting for the frame, when they complete the page. */
let deliveryOpenTs = null;

function paintDeliveries() {
  deliveryFrame = null;
  const frameStart = performance.now();
  const openTs = deliveryOpenTs;
  deliveryOpenTs = null;
  let painted = 0;
  for (const eye of EYES) {
    const d = deliveries[eye];
    if (!d) continue;
    delete deliveries[eye];
    // Skipped eyes leave the delivered set too: they are open again (or cancelled), so the
    // settled signal cannot hang on them.
    pending.delivered.delete(eye);
    if (client.isCurrent(eye, d.seq)) {
      // isCurrent: the result belongs to the latest request, so requested[eye] is its spec.
      renderResult(eye, d.result, requested[eye]);
      painted++;
    }
  }
  writePending();
  if (painted === 0) return;
  // After renderResult: reads the values just painted (T-02-02). Cache-restored deliveries come
  // through this path too.
  renderLrCallout();
  onPainted(frameStart, openTs, pending.open.size);
}

function onResults({ results, openTs, computeMs, current }) {
  for (const [eye, d] of Object.entries(results)) {
    deliveries[eye] = d;
    pending.delivered.add(eye);
  }
  if (Number.isFinite(computeMs)) onCompute(computeMs);
  deliveryOpenTs = current && openTs !== null ? Math.min(deliveryOpenTs ?? Infinity, openTs) : null;
  writePending();
  if (deliveryFrame === null) deliveryFrame = requestAnimationFrame(paintDeliveries);
}

export function setComputeMode(mode, key) {
  computeMode = mode;
  const el = $('compute-mode');
  el.dataset.mode = mode;
  setText('compute-mode', t(key));
}

/** The worker cannot start or does not answer: terminate it and compute on the page. */
function onFallback(reason) {
  worker?.terminate();
  worker = null;
  setComputeMode('sync', reason === 'timeout' ? 'tech.mode.syncTimeout' : 'tech.mode.sync');
  import('../state/compute-protocol.js').then(
    ({ createHandler }) => {
      const handle = createHandler();
      // One job per macrotask, so input events can run between jobs.
      client.useTransport((msg) => setTimeout(() => client.receive(handle(msg)), 0));
    },
    (err) => console.warn('compute fallback could not load', err),
  );
}

export const client = createComputeClient({
  send: (msg) => /** @type {Worker} */ (worker).postMessage(msg),
  onResults,
  onBusy,
  onBench: (caseId, r) => onBench(caseId, r),
  onFailed,
  onFallback,
  onOpenChange: (eyes) => {
    pending.open = new Set(eyes);
    writePending();
  },
  isHidden: () => document.hidden,
});

export function startWorker() {
  try {
    worker = new Worker(new URL('../worker/engine.worker.js', import.meta.url), { type: 'module' });
  } catch {
    client.workerError();
    return;
  }
  // Test-only probe (?msgprobe): duration of the message task for result deliveries (MINOR-13).
  const probe = location.search.includes('msgprobe') ? (window.__msgMs = []) : null;
  worker.onmessage = (e) => {
    // Engine error text is English and for developers only (T-01-41).
    if (e.data?.type === 'error') console.warn('compute worker:', e.data.message);
    const t0 = performance.now();
    client.receive(e.data);
    if (probe && e.data?.type === 'result') probe.push(performance.now() - t0);
  };
  worker.addEventListener('error', () => client.workerError());
  worker.addEventListener('messageerror', () => client.workerError());
}

/** Specs of the latest request per eye (the spec of any result that passes isCurrent). */
export let requested = { OD: null, OS: null };

/** Request the main result: remember the specs (for isCurrent deliveries), then send them. */
export function requestMain(specs, inputTs) {
  requested = specs;
  client.request(specs, inputTs);
}
