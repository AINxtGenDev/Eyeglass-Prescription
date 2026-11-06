// The only DOM tier: raw field text → parse → transpose (minus cyl) → evaluatePair → German render.
// Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { parseDiopter, parseAxis, parseMm } from '../state/parse.js';
import { transpose, RX_CODES } from '../state/transpose.js';
import { evaluatePair, evaluateLens } from '../engine/evaluate.js';
import { MATERIALS } from '../engine/materials.js';
import { SHAPES } from '../engine/frame/shapes.js';
import { nasalSign } from '../engine/conventions.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtAxis, fmtMm, fmtGram, fmtMs } from '../i18n/format.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';
const BENCH_RUNS = 50;

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material select since
// 01-06; frame shape/size and PD per eye since 01-07. Fitting height is supported by the engine but omitted here (D-04).
const DEFAULT_SHAPE = 'rechteckig';
const DEFAULT_PD = '32';
// Fallback frame for the current-input bench when a field is invalid.
const BENCH_FRAME = Object.freeze({ shape: 'rund', A: 50, B: 50, DBL: 18 });
const DEFAULT_MATERIAL = 'cr39';
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });

/** @param {number} sph sphere-only Rx */
const sphOnly = (sph) => ({ sph, cyl: 0, axisDeg: 0 });

/**
 * @param {'OD'|'OS'} eye
 * @param {{ sph: number, cyl: number, axisDeg: number }} rx minus-cylinder form only (cyl ≤ 0)
 * @param {number} monoPD @param {string} materialId
 * @param {{ shape: string, A: number, B: number, DBL: number }} frame
 * @param {number|null} [fittingHeight] mm from the bottom of the box; the page sends null (D-04)
 */
function specFor(eye, rx, monoPD = 32, materialId = DEFAULT_MATERIAL, frame = BENCH_FRAME, fittingHeight = null) {
  return {
    eye,
    sph: rx.sph,
    cyl: rx.cyl,
    axisDeg: rx.axisDeg,
    materialId,
    frame,
    monoPD,
    fittingHeight,
    baseCurve: null,
    minCT: null,
    minET: null,
  };
}

// Grenzfall (01-10 Task 1, ENG-09 worst case): the spec with the most CT iterations OD + OS over
// the 1000-run fuzz domain plus the known candidate. Copy in test/bench/recompute.test.js;
// the tech.timingWorst label names these values. Change all three together.
const GRENZFALL_FRAME = Object.freeze({ shape: 'panto', A: 58, B: 54, DBL: 15 });
const GRENZFALL_RX = Object.freeze({ sph: 0.5, cyl: -0.5, axisDeg: 81 });
const WORST_CASE_BENCH_SPECS = Object.freeze({
  OD: specFor('OD', GRENZFALL_RX, 26, 'idx160', GRENZFALL_FRAME, 0),
  OS: specFor('OS', GRENZFALL_RX, 26, 'idx160', GRENZFALL_FRAME, 0),
});

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const setText = (id, text) => {
  $(id).textContent = text;
};

/** @type {{ OD: object, OS: object } | null} */
let currentSpecs = null;

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
  $(`diag-${eye.toLowerCase()}`).replaceChildren();
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
  box.replaceChildren(...items);
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
  const vogel = fmtDiopter(im.vogelClampedD1);
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

function update() {
  const start = performance.now();
  const read = { OD: readRx('OD'), OS: readRx('OS') };
  const pd = { OD: readMm('rx-od-pd'), OS: readMm('rx-os-pd') };
  const dims = { A: readMm('frame-a'), B: readMm('frame-b'), DBL: readMm('frame-dbl') };
  const frameOk = dims.A !== null && dims.B !== null && dims.DBL !== null;
  const frame = frameOk ? { shape: currentShape(), A: dims.A, B: dims.B, DBL: dims.DBL } : null;
  const materialId = currentMaterialId();
  for (const eye of EYES) renderMaterialLine(eye, materialId);
  const spec = (eye) => specFor(eye, read[eye].rx, pd[eye], materialId, frame);
  const ready = (eye) => frameOk && read[eye].rx !== null && pd[eye] !== null;
  if (ready('OD') && ready('OS')) {
    currentSpecs = { OD: spec('OD'), OS: spec('OS') };
    const pair = evaluatePair(currentSpecs);
    for (const eye of EYES) renderResult(eye, pair[eye]);
  } else {
    // A field is invalid: compute only the eye that is complete; the bench falls back to −2,00.
    currentSpecs = null;
    for (const eye of EYES) {
      if (ready(eye)) renderResult(eye, evaluateLens(spec(eye)));
      else if (read[eye].sph === null) renderEmpty(eye, t('result.inputMissing'));
      else renderEmpty(eye, t('result.inputInvalid'));
    }
  }
  const ms = performance.now() - start;
  setText('timing-input', t('tech.inputRender', { ms: fmtMs(ms) }));
}

/** 50 timed evaluatePair runs → { median, p95 } in ms. */
function measure(specs) {
  const times = [];
  for (let i = 0; i < BENCH_RUNS; i++) {
    const t0 = performance.now();
    evaluatePair(specs);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const n = times.length;
  const median = n % 2 ? times[(n - 1) / 2] : (times[n / 2 - 1] + times[n / 2]) / 2;
  const p95 = times[Math.ceil(0.95 * n) - 1];
  return { median, p95 };
}

function runBench() {
  const specs = currentSpecs ?? { OD: specFor('OD', sphOnly(-2)), OS: specFor('OS', sphOnly(-2)) };
  const cur = measure(specs);
  setText('timing', t('tech.timing', { median: fmtMs(cur.median), p95: fmtMs(cur.p95) }));
  const worst = measure(WORST_CASE_BENCH_SPECS);
  setText('timing-worst', t('tech.timingWorst', { median: fmtMs(worst.median), p95: fmtMs(worst.p95) }));
}

function init() {
  applyDictionary();
  buildMaterialOptions();
  materialSelect().addEventListener('change', update);
  buildShapeOptions();
  prefillFrame(DEFAULT_SHAPE);
  shapeSelect().addEventListener('change', () => {
    prefillFrame(currentShape());
    update();
  });
  for (const k of ['a', 'b', 'dbl']) $(`frame-${k}`).addEventListener('input', update);
  for (const eye of EYES) {
    const e = eye.toLowerCase();
    const input = /** @type {HTMLInputElement} */ ($(`rx-${e}-sph`));
    input.value = '-2,00';
    input.addEventListener('input', update);
    // Zyl and Achse start empty (sphere-only until the user types a cylinder).
    for (const f of ['cyl', 'axis']) $(`rx-${e}-${f}`).addEventListener('input', update);
    const pdInput = /** @type {HTMLInputElement} */ ($(`rx-${e}-pd`));
    pdInput.value = DEFAULT_PD;
    pdInput.addEventListener('input', update);
  }
  const tech = /** @type {HTMLDetailsElement} */ ($('tech'));
  tech.addEventListener('toggle', () => {
    if (tech.open) runBench();
  });
  $('timing-rerun').addEventListener('click', runBench);
  setText('ua', t('tech.ua', { ua: navigator.userAgent }));
  const meta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="app-commit"]'));
  setText('app-commit', meta?.content ?? 'dev');
  update();
}

init();
