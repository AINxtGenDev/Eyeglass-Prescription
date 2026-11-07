// Worker pipeline (moved out of main.js in 02-05, no behaviour change): the compute client, the
// worker with its sync fallback, the settled signal and painting of delivered results.
// 02-07: the material comparison on the 02-06 compare lane (D-15, D-16): jobs are queued only
// when the main request changed, answers are buffered and painted in their own frame after a
// second isCompareCurrent check (T-02-49), and #compare[data-pending] signals compare work
// (#result[data-pending] stays main-only).
import { createComputeClient, BUSY_AFTER_MS } from '../state/compute-client.js';
import { MATERIALS } from '../engine/materials.js';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { renderResult, renderFailed, renderLrCallout, setStale } from './results.js';
import { renderMaterialTable, markOutdated, setCompareStale } from './compare-view.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

const MATERIAL_IDS = Object.keys(MATERIALS);

// Timing hooks, injected by initPipeline (the ENG-09 readouts own them; no import cycle).
let onBench, onPainted, onCompute, onComparePainted;

/** Wire the timing hooks; call once before startWorker(). */
export function initPipeline(hooks) {
  ({ onBench, onPainted, onCompute, onComparePainted } = hooks);
  $('cmp-run').addEventListener('click', runCompareFromButton);
  writeComparePending();
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
  for (const eye of eyes) {
    renderFailed(eye);
    shown[eye] = { key: requestedKeys[eye], result: null };
  }
  scheduleComparePaint();
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
      shown[eye] = { key: requestedKeys[eye], result: d.result };
      painted++;
    }
  }
  writePending();
  if (painted === 0) return;
  // After renderResult: reads the values just painted (T-02-02). Cache-restored deliveries come
  // through this path too.
  renderLrCallout();
  onPainted(frameStart, openTs, pending.open.size);
  // The selected row is the main result; it is painted in the next frame, not in this one.
  scheduleComparePaint();
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
  // Open compare jobs stay queued in the client; on the page they now wait for the button.
  if (comparePending.size > 0) holdCompareForButton();
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
  onCompare,
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
/** JSON keys of `requested` (the compute client's keys). */
let requestedKeys = { OD: null, OS: null };
/** The main result painted per eye with the key it was computed for (null result = failed). */
const shown = { OD: null, OS: null };

/** Request the main result: remember the specs (for isCurrent deliveries), then send them. */
export function requestMain(specs, inputTs) {
  requested = specs;
  requestedKeys = { OD: specs.OD ? JSON.stringify(specs.OD) : null, OS: specs.OS ? JSON.stringify(specs.OS) : null };
  client.request(specs, inputTs);
  // A changed main request starts a new compare generation in the client (and drops its queue);
  // an identical one keeps it, so the comparison is only requested when a main key changed.
  if (!client.isCompareCurrent(compareGen)) startCompare(specs);
}

// ---- Material comparison (02-07) ----

/** Generation of the compare jobs on the page (-1: none yet). */
let compareGen = -1;
/** @type {{ key: string, specs: object }[]} jobs of the current main request */
let compareJobs = [];
/** Job key → material id of the current jobs. */
const jobMaterial = new Map();
/** Compare results of the current jobs by material id (null = failed). */
let others = {};
/** Material ids whose job is open, or delivered but not painted yet. */
const comparePending = new Set();
/** Delivered ids waiting for a painted table. */
const compareDelivered = new Set();
/** @type {{ gen: number, key: string, results: object|null, error?: true }[]} */
const compareDeliveries = [];
let compareFrame = null;
let compareBusyTimer = null;
/** Sync mode: the jobs wait for 'Vergleich berechnen', so the old rows stay marked. */
let compareHeld = false;

/** #compare[data-pending]: the open material ids in MATERIALS order, '' when nothing is open. */
function writeComparePending() {
  const value = MATERIAL_IDS.filter((id) => comparePending.has(id)).join(' ');
  const el = $('compare');
  if (el.dataset.pending !== value) el.dataset.pending = value;
  if (comparePending.size > 0) {
    // "Vergleich rechnet …" only when the comparison takes longer than BUSY_AFTER_MS (RAIL).
    compareBusyTimer ??= setTimeout(() => {
      compareBusyTimer = null;
      if (comparePending.size === 0) return;
      setText('cmp-status', t('cmp.pending'));
      setCompareStale(true);
    }, BUSY_AFTER_MS);
    return;
  }
  clearTimeout(compareBusyTimer);
  compareBusyTimer = null;
  setText('cmp-status', '');
  setCompareStale(compareHeld);
}

/** One job per other sourced material; an eye without a main spec has no job (D-15). */
function buildCompareJobs(specs) {
  jobMaterial.clear();
  const selectedId = (specs.OD ?? specs.OS)?.materialId;
  if (selectedId === undefined) return [];
  const jobs = [];
  for (const id of MATERIAL_IDS) {
    if (id === selectedId) continue;
    const job = {};
    for (const eye of EYES) if (specs[eye]) job[eye] = { ...specs[eye], materialId: id };
    // The job key is the job's own spec pair: switching the selected material back and forth
    // finds the other rows in the client's compare cache.
    const key = JSON.stringify(job);
    jobMaterial.set(key, id);
    jobs.push({ key, specs: job });
  }
  return jobs;
}

function startCompare(specs) {
  markOutdated();
  others = {};
  compareDelivered.clear();
  compareJobs = buildCompareJobs(specs);
  $('cmp-run').hidden = true;
  if (computeMode === 'sync') {
    // Sync fallback (T-02-18): the jobs would run on the main thread, so only the button runs them.
    compareGen = client.requestCompare([]);
    holdCompareForButton();
  } else {
    sendCompare();
  }
  scheduleComparePaint();
}

function sendCompare() {
  compareHeld = false;
  comparePending.clear();
  for (const job of compareJobs) comparePending.add(/** @type {string} */ (jobMaterial.get(job.key)));
  writeComparePending();
  // Cached jobs answer through onCompare inside this call.
  compareGen = client.requestCompare(compareJobs);
}

/** Sync mode: nothing runs; old rows stay marked and 'Vergleich berechnen' is offered. */
function holdCompareForButton() {
  compareHeld = compareJobs.length > 0;
  comparePending.clear();
  writeComparePending();
  $('cmp-run').hidden = !compareHeld;
}

function runCompareFromButton() {
  $('cmp-run').hidden = true;
  sendCompare();
  client.runCompareNow();
}

function onCompare(d) {
  if (!client.isCompareCurrent(d.gen)) return;
  compareDeliveries.push(d);
  scheduleComparePaint();
}

function scheduleComparePaint() {
  if (compareFrame === null) compareFrame = requestAnimationFrame(paintCompare);
}

/**
 * Compare frame: apply the deliveries that are still current (second check, T-02-49), then paint
 * the table, but only once the main result for the current input is painted (the selected row
 * is the main result, D-15). Until then the deliveries stay pending.
 */
function paintCompare() {
  compareFrame = null;
  const frameStart = performance.now();
  for (const d of compareDeliveries.splice(0)) {
    if (!client.isCompareCurrent(d.gen)) continue;
    const id = jobMaterial.get(d.key);
    if (id === undefined) continue;
    others[id] = d.error ? null : d.results;
    compareDelivered.add(id);
  }
  const selected = {};
  for (const eye of EYES) {
    if (requested[eye] === null) selected[eye] = null;
    else if (shown[eye]?.key !== requestedKeys[eye]) return; // main not painted yet
    else selected[eye] = shown[eye].result;
  }
  const selectedId = (requested.OD ?? requested.OS)?.materialId ?? null;
  renderMaterialTable({ selectedId, selected, others });
  for (const id of compareDelivered) comparePending.delete(id);
  compareDelivered.clear();
  writeComparePending();
  onComparePainted(frameStart);
}
