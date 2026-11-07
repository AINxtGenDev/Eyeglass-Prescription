// The only DOM tier: raw field text → parse → transpose (minus cyl) → compute in a Web Worker
// (01-15) → German render. Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { createFrameScheduler } from '../state/frame-scheduler.js';
import { TAIL_PCT } from '../state/compute-client.js';
import { specFor, NORMAL_PAIR, GRENZFALL_PAIR, RESCAN_PAIR } from '../state/bench-cases.js';
import { MATERIALS } from '../engine/materials.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtMs } from '../i18n/format.js';
import { $, setText, applyDictionary } from './dom.js';
import {
  renderEmpty,
  renderBlocked,
  initResultJumps,
  renderPdNote,
  renderBNote,
  repaintFromLast,
} from './results.js';
import { initRxInput, readRx, eyeStatus, fmtForm } from './rx-input.js';
import { initFrameInput, readFrame, frameStatus } from './frame-input.js';
import { initToggletips } from './toggletip.js';
import { initExpert } from './expert.js';
import { initSummaryBar } from './summary-bar.js';
import {
  pending,
  writePending,
  computeMode,
  busyCount,
  setComputeMode,
  client,
  startWorker,
  requested,
  initPipeline,
  requestMain,
} from './pipeline.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material select since
// 01-06; frame shape/size and PD per eye since 01-07 (frame section and smart PD since 02-04, in
// frame-input.js and rx-input.js). Fitting height is supported by the engine but omitted here (D-04).
const DEFAULT_MATERIAL = 'cr39';
// Example at load (UI-SPEC "Preset data", D-26): a moderate myope with a small cylinder.
const EXAMPLE = {
  od: { sph: '-2,75', cyl: '-0,50', axis: '180', pd: '32' },
  os: { sph: '-2,50', cyl: '-0,75', axis: '170', pd: '31,5' },
};
const RX_FIELDS = ['sph', 'cyl', 'axis', 'pd'];
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });
// Abbe number νe = (ne − 1)/(nF′ − nC′): higher means less dispersion, hence fewer colour fringes.
// That meaning is textbook knowledge, not from a fetched document; the νe values are the cited
// Zeiss rows in materials.js, which list νe next to ne.
const abbeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

// Ring-buffer length for the input timing medians (ENG-09, lens-critic MAJOR-2).
const TIMING_WINDOW = 10;

const materialSelect = () => /** @type {HTMLSelectElement} */ ($('material'));

/** Options from MATERIALS ids only (T-01-21); labels from the dictionary. */
function buildMaterialOptions() {
  const select = materialSelect();
  for (const id of Object.keys(MATERIALS)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = t('material.' + id);
    select.append(opt);
  }
  select.value = DEFAULT_MATERIAL;
}

/** Selected id, guarded to a MATERIALS key. */
function currentMaterialId() {
  const id = materialSelect().value;
  return Object.hasOwn(MATERIALS, id) ? id : DEFAULT_MATERIAL;
}

function renderMaterialLine(eye, materialId) {
  const m = MATERIALS[materialId];
  setText(
    `result-${eye.toLowerCase()}-material`,
    t('result.materialLine', {
      eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
      label: t('material.' + materialId),
      density: densityNf.format(m.density) + '\u00A0g/cm³',
      // From the catalogue, not the result: the line renders even when the lens fails (MAT-01).
      abbe: abbeNf.format(m.ve),
    }),
  );
}

const where = () => t(computeMode === 'sync' ? 'tech.where.sync' : 'tech.where.worker');

/** Readout label from the case's OD spec values (the case definition is in bench-cases.js). */
function caseLabel(pair) {
  const s = pair.OD;
  const label = t('tech.case', {
    rx: fmtForm(s),
    material: t('material.' + s.materialId),
    shape: t('frame.shape.' + s.frame.shape),
    A: fmtMm(s.frame.A),
    B: fmtMm(s.frame.B),
    dbl: fmtMm(s.frame.DBL),
    pd: fmtMm(s.monoPD),
  });
  return s.fittingHeight === null ? label : label + t('tech.caseFh', { fh: fmtMm(s.fittingHeight) });
}

// Worker bench readouts in run order (one run per worker job, 01-15).
const READOUTS = {
  normal: { id: 'timing', key: 'tech.timing', pair: NORMAL_PAIR },
  frameMiss: { id: 'timing-frame', key: 'tech.timingFrame', pair: null },
  grenzfall: { id: 'timing-worst', key: 'tech.timingWorst', pair: GRENZFALL_PAIR },
  rescan: { id: 'timing-rescan', key: 'tech.timingRescan', pair: RESCAN_PAIR },
};
const BENCH_CASES = Object.keys(READOUTS);
let benchRuns = 0;

function finishBench() {
  benchRuns++;
  const tech = $('tech');
  tech.dataset.benchRuns = String(benchRuns);
  tech.removeAttribute('aria-busy');
  $('timing-rerun').removeAttribute('aria-disabled');
}

function onBench(caseId, r) {
  if ('error' in r) {
    for (const id of BENCH_CASES.slice(BENCH_CASES.indexOf(caseId))) setText(READOUTS[id].id, t('tech.benchFailed'));
    finishBench();
    return;
  }
  const ro = READOUTS[caseId];
  const params = { where: where(), median: fmtMs(r.median), tail: fmtMs(r.tail), pct: TAIL_PCT, runs: r.runs };
  if (ro.pair) params.case = caseLabel(ro.pair);
  setText(ro.id, t(ro.key, params));
  if (caseId === BENCH_CASES.at(-1)) finishBench();
}

/** Start the four worker readouts; ignored while a bench is running (re-entry guard, MINOR-5). */
function runBench() {
  if (client.isBenchRunning()) return;
  for (const id of BENCH_CASES) setText(READOUTS[id].id, t('tech.measuring'));
  $('tech').setAttribute('aria-busy', 'true');
  // aria-disabled, not disabled, so keyboard focus stays on the button.
  $('timing-rerun').setAttribute('aria-disabled', 'true');
  client.bench(BENCH_CASES);
}

/** The last Rx read per eye, for repainting a not-ready card when its field message appears. */
const lastRead = { OD: null, OS: null };
/** The last frame read (blocked state of the frame fields, which block both eyes). */
let lastFrame = null;

/**
 * Not-ready status of an eye: its own Rx/PD fields first; when they do not block, a blocking
 * frame field blocks it (both cards point to the frame field).
 */
function notReadyStatus(eye) {
  const read = { ...lastRead[eye], ...eyeStatus(eye) };
  if (read.blocked || !lastFrame?.blocked) return read;
  return { ...read, blocked: true, ...frameStatus() };
}

/**
 * Card of an eye that is not computed: empty state (no Sph), "Eingabe unvollständig …" while the
 * blocking field message is not due yet (RESEARCH Pitfall 5), the blocked sentence once it is,
 * or the phase-1 sentence when only a frame field is invalid.
 */
function paintNotReady(eye, read) {
  if (read.sphEmpty) renderEmpty(eye, t('result.inputMissing'), true);
  else if (!read.blocked || read.firstBlockedFieldId === null) renderEmpty(eye, t('result.inputInvalid'));
  else if (read.pendingMessage) renderEmpty(eye, t('result.incomplete'));
  else renderBlocked(eye, read.firstBlockedFieldId);
}

/** A field message appeared after the pause or on blur: repaint that eye's card if it is not computed. */
function onMessageShown(eye) {
  if (requested[eye] !== null || lastRead[eye] === null) return;
  paintNotReady(eye, notReadyStatus(eye));
}

function update(inputTs) {
  const read = readRx();
  const fr = readFrame();
  lastFrame = fr;
  const materialId = currentMaterialId();
  for (const eye of EYES) renderMaterialLine(eye, materialId);
  const ready = (eye) => fr.frame !== null && read[eye].rx !== null && read[eye].pd !== null;
  const specs = { OD: null, OS: null };
  for (const eye of EYES) {
    lastRead[eye] = read[eye];
    if (ready(eye)) {
      specs[eye] = specFor(eye, read[eye].rx, read[eye].pd, materialId, fr.frame);
      continue;
    }
    paintNotReady(eye, notReadyStatus(eye));
  }
  // Assumed inputs are stated next to the result (D-06, lens-critic MINOR-6): only for eyes that
  // are computed with them.
  renderPdNote(EYES.filter((eye) => specs[eye] !== null && read[eye].pdSource === 'default'));
  renderBNote(fr.frame !== null && fr.bEstimated && EYES.some((eye) => specs[eye] !== null) ? fr.B : null);
  requestMain(specs, inputTs);
}

/** Timing of a painted result frame (pipeline.js calls it after renderLrCallout). */
function timeResultFrame(frameStart, openTs, openCount) {
  // 'result' is recorded only when no eye is still open; the start-up result is not an input.
  const complete = openTs !== null && openTs > initInputTs && openCount === 0;
  setTimeout(() => {
    const end = performance.now();
    pushTiming(timings.resultFrame, end - frameStart);
    if (complete) {
      pushTiming(timings.result, end - openTs);
      longestResult = Math.max(longestResult, end - openTs);
    }
    writeResultTiming();
  }, 0);
}

const median = (sorted) => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

// Main-thread timing (ENG-09 (a)–(c), 01-15). Method (Nolan Lawson, "Accurately measuring layout
// on the web", 2018-09-25, https://nolanlawson.com/2018/09/25/accurately-measuring-layout-on-the-web/):
// rAF callbacks run just before the browser's rendering step, so a setTimeout queued from inside
// one runs after style, layout and paint. Rings of the last TIMING_WINDOW values:
// - inputFrame  = input frame (read inputs, echo, send the job) incl. paint: rAF start → after paint;
// - reaction    = input event timeStamp → after paint of that frame (input to next paint);
// - resultFrame = result frame (render the delivered result) incl. paint: rAF start → after paint;
// - result      = earliest open input → result painted, only when no eye is still open;
// - compute     = the worker's computeMs (information only).
// event.timeStamp and performance.now() share the same time origin.
const timings = { inputFrame: [], reaction: [], resultFrame: [], result: [], compute: [] };
let longestResult = 0;
let skipTiming = true; // the init() frame is not an input
let initInputTs = Infinity;

const pushTiming = (buf, v) => {
  buf.push(v);
  if (buf.length > TIMING_WINDOW) buf.shift();
};
const medOf = (buf) => fmtMs(median([...buf].sort((a, b) => a - b)));
const maxOf = (buf) => fmtMs(Math.max(...buf));
const countNf = new Intl.NumberFormat('de-AT');

function writeResultTiming() {
  const r = timings.result;
  if (r.length > 0) {
    setText(
      'timing-result',
      t('tech.result', {
        n: r.length,
        med: medOf(r),
        max: maxOf(r),
        renderMax: maxOf(timings.resultFrame),
        compute: timings.compute.length > 0 ? medOf(timings.compute) : DASH,
      }),
    );
  }
  writeBusyTiming();
}

function writeBusyTiming() {
  setText(
    'timing-busy',
    t('tech.busy', { count: countNf.format(busyCount), longest: timings.result.length > 0 ? fmtMs(longestResult) : DASH }),
  );
}

function runFrame({ inputTs, frameStart }) {
  const timed = !skipTiming;
  skipTiming = false;
  try {
    update(inputTs);
  } finally {
    pending.input = false;
    writePending();
  }
  if (!timed) return;
  setTimeout(() => {
    const end = performance.now();
    pushTiming(timings.inputFrame, end - frameStart);
    pushTiming(timings.reaction, end - inputTs);
    setText(
      'timing-input',
      t('tech.inputRender', {
        n: timings.inputFrame.length,
        reactMed: medOf(timings.reaction),
        reactMax: maxOf(timings.reaction),
        mainMed: medOf(timings.inputFrame),
        mainMax: maxOf(timings.inputFrame),
      }),
    );
    writeBusyTiming();
  }, 0);
}

// Browser cross-check (Event Timing; MDN PerformanceEventTiming: minimum durationThreshold 16 ms,
// durations rounded to 8 ms): the longest interaction of the last TIMING_WINDOW interactions.
function startEventTiming() {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('event')) {
    setText('timing-event', t('tech.eventTimingNone'));
    return;
  }
  setText('timing-event', t('tech.eventTimingEmpty', { threshold: fmtMs(16) }));
  /** @type {Map<number, number>} interactionId → longest entry duration */
  const longest = new Map();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const id = /** @type {any} */ (e).interactionId;
      if (!(id > 0)) continue;
      longest.set(id, Math.max(longest.get(id) ?? 0, e.duration));
      while (longest.size > TIMING_WINDOW) longest.delete(longest.keys().next().value);
    }
    if (longest.size > 0) {
      setText('timing-event', t('tech.eventTiming', { n: longest.size, max: fmtMs(Math.max(...longest.values())) }));
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
}

const scheduleFrame = createFrameScheduler((cb) => requestAnimationFrame(cb), runFrame, () => performance.now());

/** Schedule one input frame; 'input' is pending from now until that frame has run. */
function schedule(timeStamp) {
  if (!pending.input) {
    pending.input = true;
    writePending();
  }
  scheduleFrame(timeStamp);
}

/**
 * Example at load (D-26, UI-SPEC "Example banner"): fill the eight Rx fields. While untouched,
 * focusing an Rx field selects its content; the first input removes the banner.
 */
function initExample(onInput) {
  let untouched = true;
  const fields = [];
  for (const eye of EYES) {
    const e = eye.toLowerCase();
    for (const f of RX_FIELDS) {
      const input = /** @type {HTMLInputElement} */ ($(`rx-${e}-${f}`));
      input.value = EXAMPLE[e][f];
      fields.push(input);
    }
  }
  const leave = () => {
    untouched = false;
    $('example-banner')?.remove();
  };
  for (const input of fields) {
    input.addEventListener('focus', () => {
      if (untouched) input.select();
    });
    input.addEventListener('input', (e) => {
      if (untouched) leave();
      onInput(e);
    });
  }
  $('example-clear').addEventListener('click', () => {
    for (const input of fields) input.value = '';
    leave();
    $('rx-od-sph').focus();
    schedule(performance.now());
  });
}

function init() {
  applyDictionary();
  initToggletips();
  initResultJumps();
  // Toggling only rewrites the location suffixes; it never goes through schedule()/the compute
  // client, which would skip the identical spec and paint nothing (lens-critic round 3 MAJOR-A).
  initExpert(repaintFromLast);
  initSummaryBar();
  // Short disclaimer under the cards → the full Hinweis below (UI-SPEC "Disclaimer link").
  $('disclaimer-jump').addEventListener('click', () => $('disclaimer').focus());
  initPipeline({ onBench, onPainted: timeResultFrame, onCompute: (ms) => pushTiming(timings.compute, ms) });
  setComputeMode('worker', 'tech.mode.worker');
  buildMaterialOptions();
  materialSelect().addEventListener('change', (e) => schedule(e.timeStamp));
  initFrameInput({ schedule, onMessageShown: () => EYES.forEach(onMessageShown) });
  const onInput = (e) => schedule(e.timeStamp);
  initExample(onInput);
  initRxInput({ onInput, onMessageShown });
  const tech = /** @type {HTMLDetailsElement} */ ($('tech'));
  // Sync fallback: the bench would block the page, so only the button starts it (MINOR-6).
  tech.addEventListener('toggle', () => {
    if (tech.open && computeMode === 'worker') runBench();
  });
  $('timing-rerun').addEventListener('click', runBench);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) client.resume();
  });
  setText('ua', t('tech.ua', { ua: navigator.userAgent }));
  const meta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="app-commit"]'));
  setText('app-commit', meta?.content ?? 'dev');
  startEventTiming();
  writeBusyTiming();
  startWorker();
  initInputTs = performance.now();
  schedule(initInputTs);
}

init();
