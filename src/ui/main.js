// The only DOM tier: raw field text → parse → transpose (minus cyl) → evaluatePair → German render.
// Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { parseDiopter, parseAxis, parseMm } from '../state/parse.js';
import { transpose, RX_CODES } from '../state/transpose.js';
import { memoLast } from '../state/memo.js';
import { createFrameScheduler } from '../state/frame-scheduler.js';
import { specFor, NORMAL_PAIR, GRENZFALL_PAIR, frameMissPair, BENCH_RUNS } from '../state/bench-cases.js';
import { evaluatePair, evaluateLens } from '../engine/evaluate.js';
import { MATERIALS } from '../engine/materials.js';
import { SHAPES } from '../engine/frame/shapes.js';
import { nasalSign } from '../engine/conventions.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtAxis, fmtMm, fmtGram, fmtMs } from '../i18n/format.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material select since
// 01-06; frame shape/size and PD per eye since 01-07. Fitting height is supported by the engine but omitted here (D-04).
const DEFAULT_SHAPE = 'rechteckig';
const DEFAULT_PD = '32';
const DEFAULT_MATERIAL = 'cr39';
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });
// Abbe number νe = (ne − 1)/(nF′ − nC′): higher means less dispersion, hence fewer colour fringes.
// That meaning is textbook knowledge, not from a fetched document; the νe values are the cited
// Zeiss rows in materials.js, which list νe next to ne.
const abbeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

// Percentile reported next to the median in the bench readouts (p95 = the 48th of 50 sorted runs).
const TAIL_PCT = 95;
// Ring-buffer length for the input timing medians (ENG-09, lens-critic MAJOR-2).
const TIMING_WINDOW = 10;

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const setText = (id, text) => {
  $(id).textContent = text;
};

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

function applyDictionary() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  }
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

const CELLS = ['ct', 'etmax', 'etmin', 'dec', 'weight', 'basecurve'];

function renderEmpty(eye, statusText) {
  const p = `result-${eye.toLowerCase()}`;
  for (const c of CELLS) setText(`${p}-${c}`, DASH);
  setText(`${p}-status`, statusText);
  // Clear only when not already empty, so the role=status box is not touched (MINOR-11).
  const box = $(`diag-${eye.toLowerCase()}`);
  if (box.childElementCount > 0 || box.dataset.sig) {
    box.replaceChildren();
    box.dataset.sig = '';
  }
}

// Diagnostic data fields that are lengths in mm; every other field is never shown.
const MM_PARAMS = ['R1', 'rhoMax', 'mbsMm', 'stockMm'];
// Codes that mean "this lens cannot exist in the model" (others are internal limits).
const IMPOSSIBLE = ['FRONT_SAG_UNDEFINED', 'BACK_SAG_UNDEFINED'];

/** Engine numbers → German mm text for the {param} placeholders of diag.* texts. */
function diagParams(data) {
  const params = {};
  for (const k of MM_PARAMS) if (Number.isFinite(data[k])) params[k] = fmtMm(data[k]);
  return params;
}

const para = (text) => {
  const el = document.createElement('p');
  el.textContent = text;
  return el;
};

/** Error: title, explanation, suggestion. Warnings: title and explanation. Info is not shown. */
function renderDiagnostics(eye, diagnostics) {
  const box = $(`diag-${eye.toLowerCase()}`);
  const items = [];
  for (const d of diagnostics) {
    if (d.severity === 'info') continue;
    const params = diagParams(d.data);
    const head = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = t(eye === 'OD' ? 'rx.od' : 'rx.os') + ': ' + t(`diag.${d.code}.title`);
    head.append(strong);
    const block = document.createElement('div');
    block.className = d.severity === 'error' ? 'diag-error' : 'diag-warn';
    block.append(head, para(t(`diag.${d.code}.explain`, params)));
    if (d.severity === 'error') block.append(para(t(`diag.${d.code}.suggest`, params)));
    items.push(block);
  }
  // Rewrite the role=status box only when its content changes, so an eye that recomputes with
  // the same diagnostic text is not announced again (MINOR-11).
  const sig = items.map((el) => el.className + '|' + el.textContent).join('\n');
  if (sig === (box.dataset.sig ?? '')) return;
  box.replaceChildren(...items);
  box.dataset.sig = sig;
}

/** Text label for the status cell (never colour alone). */
function statusLabel(diagnostics) {
  const err = diagnostics.find((d) => d.severity === 'error');
  if (err) return t(IMPOSSIBLE.includes(err.code) ? 'result.diagLabel.impossible' : 'result.diagLabel.failed');
  return diagnostics.some((d) => d.severity === 'warn') ? t('result.diagLabel.warn') : '';
}

/** Base-curve cell: thinnest rule plus the Vogel reference (D-01 final, lens-critic MAJOR-2). */
function baseCurveText(m, im) {
  const bc = fmtDiopter(im.D1) + ' – ' + t('basecurve.rule.' + im.baseCurveRule);
  if (im.baseCurveRule !== 'thinnest') return bc;
  // Raw Vogel value; when the rule leaves +0,50…+14,00 (D-A) the clamp is named, and any
  // thickness in the sentence refers to the clamped lens (01-13, MINOR-1).
  let vogel = fmtDiopter(im.vogelD1);
  if (im.vogelD1 !== im.vogelClampedD1) {
    vogel += t('basecurve.vogelClamped', { clamped: fmtDiopter(im.vogelClampedD1) });
  }
  const v = im.vogelMaxThickness;
  const j = Math.max(m.ct, m.etMax.value);
  if (v === null) return bc + ' ' + t('basecurve.vogelRefImpossible', { vogel });
  if (v - j >= 0.05) return bc + ' ' + t('basecurve.vogelRefThicker', { vogel, thickness: fmtMm(v) });
  return bc + ' ' + t('basecurve.vogelRef', { vogel });
}

function renderResult(eye, res) {
  const p = `result-${eye.toLowerCase()}`;
  if (!res.ok) {
    renderEmpty(eye, statusLabel(res.diagnostics));
    renderDiagnostics(eye, res.diagnostics);
    return;
  }
  const m = res.metrics;
  const im = res.intermediates;
  setText(`${p}-ct`, fmtMm(m.ct));
  setText(`${p}-etmax`, fmtMm(m.etMax.value) + ' – ' + t('loc.' + m.etMax.location));
  setText(`${p}-etmin`, fmtMm(m.etMin.value) + ' – ' + t('loc.' + m.etMin.location));
  // display only: the engine's signed x offset turned into "toward the nose" for this eye
  setText(`${p}-dec`, fmtMm(nasalSign(eye) * m.decentration.x));
  setText(`${p}-weight`, fmtGram(m.weightG));
  setText(`${p}-basecurve`, baseCurveText(m, im));
  setText(`${p}-status`, statusLabel(res.diagnostics));
  renderDiagnostics(eye, res.diagnostics);
}

// Per-eye reuse (01-14): an eye whose spec is unchanged keeps its LensResult object and is not
// re-rendered. lastRendered is reset when the eye renders empty for an input reason.
const evalEye = {
  OD: memoLast(evaluateLens),
  OS: memoLast(evaluateLens),
};
/** @type {{ OD: object | null, OS: object | null }} */
const lastRendered = { OD: null, OS: null };

function showResult(eye, res) {
  if (res === lastRendered[eye]) return;
  lastRendered[eye] = res;
  renderResult(eye, res);
}

function update() {
  const read = { OD: readRx('OD'), OS: readRx('OS') };
  const pd = { OD: readMm('rx-od-pd'), OS: readMm('rx-os-pd') };
  const dims = { A: readMm('frame-a'), B: readMm('frame-b'), DBL: readMm('frame-dbl') };
  const frameOk = dims.A !== null && dims.B !== null && dims.DBL !== null;
  const frame = frameOk ? { shape: currentShape(), A: dims.A, B: dims.B, DBL: dims.DBL } : null;
  const materialId = currentMaterialId();
  for (const eye of EYES) renderMaterialLine(eye, materialId);
  const ready = (eye) => frameOk && read[eye].rx !== null && pd[eye] !== null;
  for (const eye of EYES) {
    if (ready(eye)) {
      showResult(eye, evalEye[eye](specFor(eye, read[eye].rx, pd[eye], materialId, frame)));
      continue;
    }
    lastRendered[eye] = null;
    renderEmpty(eye, t(read[eye].sph === null ? 'result.inputMissing' : 'result.inputInvalid'));
  }
}

const median = (sorted) => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

// Input timing (ENG-09, lens-critic MAJOR-2). Method (Nolan Lawson, "Accurately measuring layout
// on the web", 2018-09-25, https://nolanlawson.com/2018/09/25/accurately-measuring-layout-on-the-web/):
// rAF callbacks run just before the browser's rendering step, so a setTimeout queued from inside
// one runs after style, layout and paint.
// - work = recompute plus render: from the start of the rAF callback to that task;
// - latency = work plus the wait for the next frame that coalescing introduces (up to about one
//   frame): from the input event's timeStamp to the same task.
// event.timeStamp and performance.now() share the same time origin.
const timings = { work: [], latency: [] };
let skipTiming = true; // the init() frame is not an input

const pushTiming = (buf, v) => {
  buf.push(v);
  if (buf.length > TIMING_WINDOW) buf.shift();
};

function runFrame({ inputTs, frameStart }) {
  const timed = !skipTiming;
  skipTiming = false;
  update();
  if (!timed) return;
  setTimeout(() => {
    const end = performance.now();
    pushTiming(timings.work, end - frameStart);
    pushTiming(timings.latency, end - inputTs);
    const med = (buf) => fmtMs(median([...buf].sort((a, b) => a - b)));
    setText(
      'timing-input',
      t('tech.inputRender', { work: med(timings.work), latency: med(timings.latency), n: timings.work.length }),
    );
  }, 0);
}

const schedule = createFrameScheduler((cb) => requestAnimationFrame(cb), runFrame, () => performance.now());

/** BENCH_RUNS timed raw evaluatePair runs (no memo: ENG-09 is about recomputing both lenses). */
function measure(pairFor) {
  const times = [];
  for (let i = 0; i < BENCH_RUNS; i++) {
    const pair = pairFor();
    const t0 = performance.now();
    evaluatePair(pair);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { median: median(times), tail: times[Math.ceil((TAIL_PCT / 100) * times.length) - 1] };
}

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

// Never reused, so every frame-miss run builds a new outline.
let frameMissK = 0;

function runBench() {
  const fmt = (r) => ({ median: fmtMs(r.median), tail: fmtMs(r.tail), pct: TAIL_PCT, runs: BENCH_RUNS });
  setText('timing', t('tech.timing', { case: caseLabel(NORMAL_PAIR), ...fmt(measure(() => NORMAL_PAIR)) }));
  setText('timing-frame', t('tech.timingFrame', fmt(measure(() => frameMissPair(frameMissK++)))));
  setText('timing-worst', t('tech.timingWorst', { case: caseLabel(GRENZFALL_PAIR), ...fmt(measure(() => GRENZFALL_PAIR)) }));
}

function init() {
  applyDictionary();
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
  for (const eye of EYES) {
    const e = eye.toLowerCase();
    const input = /** @type {HTMLInputElement} */ ($(`rx-${e}-sph`));
    input.value = '-2,00';
    input.addEventListener('input', onInput);
    // Zyl and Achse start empty (sphere-only until the user types a cylinder).
    for (const f of ['cyl', 'axis']) $(`rx-${e}-${f}`).addEventListener('input', onInput);
    const pdInput = /** @type {HTMLInputElement} */ ($(`rx-${e}-pd`));
    pdInput.value = DEFAULT_PD;
    pdInput.addEventListener('input', onInput);
  }
  const tech = /** @type {HTMLDetailsElement} */ ($('tech'));
  tech.addEventListener('toggle', () => {
    if (tech.open) runBench();
  });
  $('timing-rerun').addEventListener('click', runBench);
  setText('ua', t('tech.ua', { ua: navigator.userAgent }));
  const meta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="app-commit"]'));
  setText('app-commit', meta?.content ?? 'dev');
  schedule(performance.now());
}

init();
