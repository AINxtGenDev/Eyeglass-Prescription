// Worker pipeline (moved out of main.js in 02-05, no behaviour change): the compute client, the
// worker with its sync fallback, the settled signal and painting of delivered results.
// 02-07: the material comparison on the 02-06 compare lane (D-15, D-16): jobs are queued only
// when the main request changed, answers are buffered and painted in their own frame after a
// second isCompareCurrent check (T-02-49), and #compare[data-pending] signals compare work
// (#result[data-pending] stays main-only).
// 02-08: the configuration comparison (D-28): 'Variante vergleichen' freezes frame + material as
// Vorher (A); A is one more job on the same lane, queued first, with the current (shared) Rx. The
// Vorher | Nachher toggle chooses which configuration the result cards show.
// 02-10: with Expert overrides the material rows keep the manual base curve but use each
// material's own minimum thicknesses (RESEARCH Pitfall 11, footnote #cmp-footnote); a manual base
// curve adds one more job with the automatic curve for the Glas-Einstellungen line.
import { createComputeClient, BUSY_AFTER_MS } from '../state/compute-client.js';
import { MATERIALS } from '../engine/materials.js';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { renderResult, renderFailed, renderLrCallout, setStale } from './results.js';
import {
  renderMaterialTable,
  markOutdated,
  setCompareStale,
  renderConfigCompare,
  setConfigActive,
} from './compare-view.js';
import { renderMaterialLine } from './material-input.js';
import { renderGlassSettings } from './expert.js';
import { renderRim } from './frame-input.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

const MATERIAL_IDS = Object.keys(MATERIALS);

// Timing hooks, injected by initPipeline (the ENG-09 readouts own them; no import cycle).
// currentConfig (02-08): the frame and material of the last input frame, from main.js.
let onBench, onPainted, onCompute, onComparePainted, currentConfig;

/** Wire the timing hooks; call once before startWorker(). */
export function initPipeline(hooks) {
  ({ onBench, onPainted, onCompute, onComparePainted, currentConfig } = hooks);
  setText('cmp-footnote', t('cmp.footnote'));
  $('cmp-run').addEventListener('click', runCompareFromButton);
  $('cmp-start').addEventListener('click', startConfigCompare);
  $('cmp-end').addEventListener('click', endConfigCompare);
  $('cmp-show').addEventListener('change', (e) => {
    showA = /** @type {HTMLInputElement} */ (e.target).value === 'a';
    paintCards();
  });
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
    renderRim(eye, null);
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
      // 02-08: while Vorher (A) is shown, the card keeps A's values, marked until the A job for
      // this input is painted (paintCompare → paintCards).
      if (showA) setStale(eye, true);
      else renderResult(eye, d.result, requested[eye]);
      // 02-11: rim lines from the painted main result (never the Vorher card values).
      renderRim(eye, d.result?.ok ? d.result.metrics : null);
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
  for (const eye of EYES) if (specs[eye] === null) renderRim(eye, null);
  $('cmp-footnote').hidden = !hasOverrides(specs);
  // A changed main request starts a new compare generation in the client (and drops its queue);
  // an identical one keeps it, so the comparison is only requested when a main key changed.
  if (!client.isCompareCurrent(compareGen)) startCompare(specs);
}

/**
 * A main spec carries an Expert override (02-10; overrides are null while the switch is off).
 * 02-11: frontConic is only present when non-zero (specFor), and it is shared by every row.
 */
const hasOverrides = (specs) =>
  EYES.some(
    (eye) =>
      specs[eye] &&
      (specs[eye].baseCurve !== null || specs[eye].minCT !== null || specs[eye].minET !== null || specs[eye].frontConic != null),
  );
/** A main spec has a manual base curve: the automatic one needs its own job (02-10). */
const hasManualBaseCurve = (specs) => EYES.some((eye) => specs[eye] && specs[eye].baseCurve !== null);

// ---- Material comparison (02-07) ----

/** Generation of the compare jobs on the page (-1: none yet). */
let compareGen = -1;
/** @type {{ key: string, specs: object }[]} jobs of the current main request */
let compareJobs = [];
/** Job key → material id of the current jobs. */
const jobMaterial = new Map();
/** Compare results of the current jobs by material id (null = failed). */
let others = {};
/** Pseudo id of the configuration-A job in jobMaterial / comparePending (02-08). */
const CONFIG_A = 'configA';
/** Pseudo id of the automatic-base-curve job (02-10, only with a manual base curve). */
const AUTO_BC = 'autoBc';
/** The automatic-curve results for the current input: pair, null = failed, undefined = computing / no job. */
let resultAuto;
/** @type {{ frame: object|null, materialId: string } | null} the frozen Vorher (A) */
let configA = null;
/** A's results for the current input: pair, null = failed, undefined = computing / no job. */
let resultA;
/** Specs of the current A job per eye (for lrCause when A is painted into the cards). */
let specA = { OD: null, OS: null };
/** The cards and the summary bar show A (toggle 'Vorher'). */
let showA = false;
/** Material ids (and CONFIG_A) whose job is open, or delivered but not painted yet. */
const comparePending = new Set();
/** Delivered ids waiting for a painted table. */
const compareDelivered = new Set();
/** @type {{ gen: number, key: string, results: object|null, error?: true }[]} */
const compareDeliveries = [];
let compareFrame = null;
let compareBusyTimer = null;
/** Sync mode: the jobs wait for 'Vergleich berechnen', so the old rows stay marked. */
let compareHeld = false;

/** #compare[data-pending]: configA, autoBc, then the open material ids in MATERIALS order; '' = nothing open. */
function writeComparePending() {
  const value = [CONFIG_A, AUTO_BC, ...MATERIAL_IDS].filter((id) => comparePending.has(id)).join(' ');
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
    // Same Rx, frame and base curve; the material's own sourced minimums (RESEARCH Pitfall 11).
    for (const eye of EYES) if (specs[eye]) job[eye] = { ...specs[eye], materialId: id, minCT: null, minET: null };
    // The job key is the job's own spec pair: switching the selected material back and forth
    // finds the other rows in the client's compare cache.
    const key = JSON.stringify(job);
    jobMaterial.set(key, id);
    jobs.push({ key, specs: job });
  }
  // 02-10: the automatic base curve for the Glas-Einstellungen line (same specs, curve null).
  if (hasManualBaseCurve(specs)) {
    const job = {};
    for (const eye of EYES) if (specs[eye]) job[eye] = { ...specs[eye], baseCurve: null };
    const key = AUTO_BC + ':' + JSON.stringify(job);
    jobMaterial.set(key, AUTO_BC);
    jobs.unshift({ key, specs: job });
  }
  // 02-08: Vorher (A) = the current Rx with A's frame and material, queued first (T-02-22). Own
  // key prefix, so it never shares a delivery with a material row of the same specs.
  specA = { OD: null, OS: null };
  if (configA?.frame) {
    const job = {};
    for (const eye of EYES) if (specs[eye]) job[eye] = { ...specs[eye], materialId: configA.materialId, frame: configA.frame };
    const key = CONFIG_A + ':' + JSON.stringify(job);
    jobMaterial.set(key, CONFIG_A);
    jobs.unshift({ key, specs: job });
    specA = { OD: job.OD ?? null, OS: job.OS ?? null };
  }
  return jobs;
}

function startCompare(specs) {
  markOutdated();
  others = {};
  resultA = undefined;
  resultAuto = undefined;
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
    if (id === CONFIG_A) resultA = d.error ? null : d.results;
    else if (id === AUTO_BC) resultAuto = d.error ? null : d.results;
    else others[id] = d.error ? null : d.results;
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
  // Without a manual base curve the main results are the automatic ones.
  const auto = hasManualBaseCurve(requested) ? (resultAuto === null ? { OD: null, OS: null } : resultAuto) : selected;
  renderGlassSettings({ specs: requested, main: selected, auto });
  if (configA) {
    renderConfigCompare({ config: configA, A: resultA === null ? { OD: null, OS: null } : resultA, B: selected, same: sameConfig() });
    if (showA) paintCards();
  }
  for (const id of compareDelivered) comparePending.delete(id);
  compareDelivered.clear();
  writeComparePending();
  onComparePainted(frameStart);
}

// ---- Configuration comparison (02-08) ----

/** The current input's frame and material equal A's (nothing changed yet). */
function sameConfig() {
  const s = requested.OD ?? requested.OS;
  return !!s && !!configA && s.materialId === configA.materialId && JSON.stringify(s.frame) === JSON.stringify(configA.frame);
}

/** Material named under the cards: A's while Vorher is shown (main.js update uses this too). */
export function cardMaterialId(currentId) {
  return showA && configA ? configA.materialId : currentId;
}

/**
 * Paint the result cards from the configuration the toggle shows. B = the painted main results;
 * A = the A job's results for the current input (while still computing, the card's values are
 * marked stale until A is painted). An eye without a main spec keeps main.js's not-ready card.
 */
function paintCards() {
  for (const eye of EYES) {
    if (requested[eye] === null) continue;
    if (showA) {
      // A still computing: the values on the card are not A's yet, so they are marked (T-02-21).
      if (resultA === undefined) {
        setStale(eye, true);
        continue;
      }
      const r = resultA?.[eye];
      if (r) renderResult(eye, r, specA[eye]);
      else renderFailed(eye);
    } else {
      const s = shown[eye];
      if (s?.key !== requestedKeys[eye]) continue;
      if (s.result) renderResult(eye, s.result, requested[eye]);
      else renderFailed(eye);
    }
  }
  renderLrCallout();
  const materialId = cardMaterialId(currentConfig().materialId);
  for (const eye of EYES) {
    setText(`result-${eye.toLowerCase()}-suffix`, showA ? t('cmp.show.suffix.a') : '');
    renderMaterialLine(eye, materialId);
  }
}

/** 'Variante vergleichen': freeze frame + material as A; the status is written before the focus. */
function startConfigCompare() {
  configA = currentConfig();
  setConfigActive(true);
  renderConfigCompare({ config: configA, A: undefined, B: {}, same: sameConfig() });
  $('cmp-diff').focus();
  startCompare(requested);
}

/** 'Vergleich beenden': back to one configuration (B stays current), focus on the CTA. */
function endConfigCompare() {
  configA = null;
  showA = false;
  resultA = undefined;
  setConfigActive(false);
  paintCards();
  $('cmp-start').focus();
}
