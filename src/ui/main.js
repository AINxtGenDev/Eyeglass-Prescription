// The only DOM tier: raw field text → parse → transpose (minus cyl) → compute in a Web Worker
// (01-15) → German render. Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { parseDiopter, parseAxis, parseMm } from '../state/parse.js';
import { transpose, RX_CODES } from '../state/transpose.js';
import { createFrameScheduler } from '../state/frame-scheduler.js';
import { createComputeClient, TAIL_PCT } from '../state/compute-client.js';
import { specFor, NORMAL_PAIR, GRENZFALL_PAIR, RESCAN_PAIR } from '../state/bench-cases.js';
import { MATERIALS } from '../engine/materials.js';
import { SHAPES } from '../engine/frame/shapes.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtAxis, fmtMm, fmtMs } from '../i18n/format.js';
import { $, setText, applyDictionary } from './dom.js';
import { renderEmpty, renderResult, renderFailed, renderLrCallout, setStale } from './results.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material select since
// 01-06; frame shape/size and PD per eye since 01-07. Fitting height is supported by the engine but omitted here (D-04).
const DEFAULT_SHAPE = 'rechteckig';
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

const shapeSelect = () => /** @type {HTMLSelectElement} */ ($('frame-shape'));

/** Options from SHAPES ids only; labels from the dictionary. */
function buildShapeOptions() {
  const select = shapeSelect();
  for (const id of Object.keys(SHAPES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = t('frame.shape.' + id);
    select.append(opt);
  }
  select.value = DEFAULT_SHAPE;
}

/** Selected id, guarded to a SHAPES key. */
function currentShape() {
  const id = shapeSelect().value;
  return Object.hasOwn(SHAPES, id) ? id : DEFAULT_SHAPE;
}

/** Pre-fill A/B/DBL with the shape's typical values (editable afterwards). */
function prefillFrame(shape) {
  const d = SHAPES[shape].defaults;
  for (const [k, v] of [['a', d.A], ['b', d.B], ['dbl', d.DBL]]) {
    /** @type {HTMLInputElement} */ ($(`frame-${k}`)).value = String(v);
  }
}

/** Mark a field valid and show its echo (may be empty). */
function showFieldOk(id, echo) {
  setText(`${id}-echo`, echo);
  const err = $(`${id}-err`);
  err.textContent = '';
  err.hidden = true;
  $(id).removeAttribute('aria-invalid');
}

/** Mark a field invalid with a German message. */
function showFieldError(id, message) {
  setText(`${id}-echo`, '');
  const err = $(`${id}-err`);
  err.textContent = message;
  err.hidden = false;
  $(id).setAttribute('aria-invalid', 'true');
}

const isBlank = (id) => /** @type {HTMLInputElement} */ ($(id)).value.trim() === '';

/** Parse one field, show echo or error; returns the value or null. */
function readField(id, parse, format) {
  const r = parse(/** @type {HTMLInputElement} */ ($(id)).value);
  if (r.ok) {
    showFieldOk(id, format(r.value));
    return r.value;
  }
  showFieldError(id, t('parse.' + r.code));
  return null;
}

const readSph = (eye) => readField(`rx-${eye.toLowerCase()}-sph`, parseDiopter, fmtDiopter);
const readMm = (id) => readField(id, parseMm, fmtMm);

/** Zyl: blank means 0 (common on paper). */
function readCyl(eye) {
  const id = `rx-${eye.toLowerCase()}-cyl`;
  if (isBlank(id)) {
    showFieldOk(id, '');
    return 0;
  }
  return readField(id, parseDiopter, fmtDiopter);
}

/** Achse: required when Zyl ≠ 0, never defaulted (T-01-10); blank without Zyl is fine. */
function readAxis(eye, cyl) {
  const id = `rx-${eye.toLowerCase()}-axis`;
  if (isBlank(id)) {
    if (cyl !== null && cyl !== 0) {
      showFieldError(id, t('rx.' + RX_CODES.AXIS_MISSING_FOR_CYL));
      return null;
    }
    showFieldOk(id, '');
    return 0;
  }
  return readField(id, parseAxis, fmtAxis);
}

/** "Sph / Zyl × Achse" for one cylinder form. */
const fmtForm = (f) => `${fmtDiopter(f.sph)} / ${fmtDiopter(f.cyl)} × ${fmtAxis(f.axisDeg)}`;

/**
 * Read Sph/Zyl/Achse for one eye, show both cylinder forms, and return the minus-cylinder Rx
 * for the engine (T-01-25), or null when a field is invalid.
 */
function readRx(eye) {
  const sph = readSph(eye);
  const cyl = readCyl(eye);
  const axisDeg = readAxis(eye, cyl);
  const formsId = `rx-${eye.toLowerCase()}-forms`;
  if (sph === null || cyl === null || axisDeg === null) {
    setText(formsId, '');
    $(formsId).hidden = true;
    return { sph, rx: null };
  }
  const r = transpose({ sph, cyl, axisDeg });
  if (r.plus === null) {
    setText(formsId, '');
    $(formsId).hidden = true;
  } else {
    const forms = t('rx.forms', {
      eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
      minus: fmtForm(r.minus),
      plus: fmtForm(r.plus),
    });
    setText(formsId, r.transposed ? t('rx.' + RX_CODES.CYL_TRANSPOSED) + ' ' + forms : forms);
    $(formsId).hidden = false;
  }
  return { sph, rx: r.minus };
}

// Settled signal (01-15): #result[data-pending] is a space-separated token set, '' when nothing
// is pending. 'input' = an input frame is scheduled; OD/OS = the eye is open in the client or
// delivered but not yet painted. e2e/helpers.js settled() waits for ''.
const pending = { input: false, open: new Set(), delivered: new Set() };

function writePending() {
  const tokens = pending.input ? ['input'] : [];
  for (const eye of EYES) if (pending.open.has(eye) || pending.delivered.has(eye)) tokens.push(eye);
  const value = tokens.join(' ');
  const el = $('result');
  if (el.dataset.pending !== value) el.dataset.pending = value;
}

/** @type {'worker' | 'sync'} */
let computeMode = 'worker';
/** @type {Worker | null} */
let worker = null;
const busyEyes = new Set();
// "rechnet …" displays since load (ENG-09 (d), observable on a phone).
let busyCount = 0;

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
  // 'result' is recorded only when no eye is still open; the start-up result is not an input.
  const complete = openTs !== null && openTs > initInputTs && pending.open.size === 0;
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

function onResults({ results, openTs, computeMs, current }) {
  for (const [eye, d] of Object.entries(results)) {
    deliveries[eye] = d;
    pending.delivered.add(eye);
  }
  if (Number.isFinite(computeMs)) pushTiming(timings.compute, computeMs);
  deliveryOpenTs = current && openTs !== null ? Math.min(deliveryOpenTs ?? Infinity, openTs) : null;
  writePending();
  if (deliveryFrame === null) deliveryFrame = requestAnimationFrame(paintDeliveries);
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

function setComputeMode(mode, key) {
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

const client = createComputeClient({
  send: (msg) => /** @type {Worker} */ (worker).postMessage(msg),
  onResults,
  onBusy,
  onBench,
  onFailed,
  onFallback,
  onOpenChange: (eyes) => {
    pending.open = new Set(eyes);
    writePending();
  },
  isHidden: () => document.hidden,
});

function startWorker() {
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
let requested = { OD: null, OS: null };

function update(inputTs) {
  const read = { OD: readRx('OD'), OS: readRx('OS') };
  const pd = { OD: readMm('rx-od-pd'), OS: readMm('rx-os-pd') };
  const dims = { A: readMm('frame-a'), B: readMm('frame-b'), DBL: readMm('frame-dbl') };
  const frameOk = dims.A !== null && dims.B !== null && dims.DBL !== null;
  const frame = frameOk ? { shape: currentShape(), A: dims.A, B: dims.B, DBL: dims.DBL } : null;
  const materialId = currentMaterialId();
  for (const eye of EYES) renderMaterialLine(eye, materialId);
  const ready = (eye) => frameOk && read[eye].rx !== null && pd[eye] !== null;
  const specs = { OD: null, OS: null };
  for (const eye of EYES) {
    if (ready(eye)) {
      specs[eye] = specFor(eye, read[eye].rx, pd[eye], materialId, frame);
      continue;
    }
    const empty = isBlank(`rx-${eye.toLowerCase()}-sph`);
    renderEmpty(eye, t(read[eye].sph === null ? 'result.inputMissing' : 'result.inputInvalid'), empty);
  }
  requested = specs;
  client.request(specs, inputTs);
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
  setComputeMode('worker', 'tech.mode.worker');
  buildMaterialOptions();
  materialSelect().addEventListener('change', (e) => schedule(e.timeStamp));
  buildShapeOptions();
  prefillFrame(DEFAULT_SHAPE);
  shapeSelect().addEventListener('change', (e) => {
    prefillFrame(currentShape());
    schedule(e.timeStamp);
  });
  const onInput = (e) => schedule(e.timeStamp);
  for (const k of ['a', 'b', 'dbl']) $(`frame-${k}`).addEventListener('input', onInput);
  initExample(onInput);
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
