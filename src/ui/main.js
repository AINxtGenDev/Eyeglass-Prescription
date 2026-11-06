// The only DOM tier: raw field text → parseDiopter → evaluatePair → German render.
// Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { parseDiopter, parseMm } from '../state/parse.js';
import { evaluatePair, evaluateLens } from '../engine/evaluate.js';
import { MATERIALS } from '../engine/materials.js';
import { SHAPES } from '../engine/frame/shapes.js';
import { nasalSign } from '../engine/conventions.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtMm, fmtGram, fmtMs } from '../i18n/format.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';
const BENCH_RUNS = 50;

// Phase-1 limits: sphere only (cyl in 01-08). Material select since 01-06; frame shape/size and
// PD per eye since 01-07. Fitting height is supported by the engine but omitted here (D-04).
const DEFAULT_SHAPE = 'rechteckig';
const DEFAULT_PD = '32';
// The worst-case bench keeps its own fixed frame (label tech.timingWorst names its numbers).
const BENCH_FRAME = Object.freeze({ shape: 'rund', A: 50, B: 50, DBL: 18 });
const DEFAULT_MATERIAL = 'cr39';
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });

/**
 * @param {'OD'|'OS'} eye @param {number} sph @param {number} monoPD @param {string} materialId
 * @param {{ shape: string, A: number, B: number, DBL: number }} frame
 */
function specFor(eye, sph, monoPD = 32, materialId = DEFAULT_MATERIAL, frame = BENCH_FRAME) {
  return {
    eye,
    sph,
    cyl: 0,
    axisDeg: 0,
    materialId,
    frame,
    monoPD,
    fittingHeight: null,
    baseCurve: null,
    minCT: null,
    minET: null,
  };
}

// Costliest search inside the skeleton domain (sphere, rund, CR-39). NOT the overall worst case:
// 01-10 Task 2 replaces these specs (and the bench copy and the tech.timingWorst label) in one edit.
const WORST_CASE_BENCH_SPECS = Object.freeze({
  OD: specFor('OD', 12, 10),
  OS: specFor('OS', 12, 10),
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

/** Parse one field, show echo or error; returns the value or null. */
function readField(id, parse, format) {
  const input = /** @type {HTMLInputElement} */ ($(id));
  const err = $(`${id}-err`);
  const r = parse(input.value);
  if (r.ok) {
    setText(`${id}-echo`, format(r.value));
    err.textContent = '';
    err.hidden = true;
    input.removeAttribute('aria-invalid');
    return r.value;
  }
  setText(`${id}-echo`, '');
  err.textContent = t('parse.' + r.code);
  err.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  return null;
}

const readSph = (eye) => readField(`rx-${eye.toLowerCase()}-sph`, parseDiopter, fmtDiopter);
const readMm = (id) => readField(id, parseMm, fmtMm);

const CELLS = ['ct', 'etmax', 'etmin', 'dec', 'weight', 'basecurve'];

function renderEmpty(eye, statusText) {
  const p = `result-${eye.toLowerCase()}`;
  for (const c of CELLS) setText(`${p}-${c}`, DASH);
  setText(`${p}-status`, statusText);
}

function renderResult(eye, res) {
  const p = `result-${eye.toLowerCase()}`;
  if (!res.ok) {
    renderEmpty(eye, t('result.notComputable', { code: res.diagnostics[0]?.code ?? '?' }));
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
  let bc = fmtDiopter(im.D1) + ' – ' + t('basecurve.rule.' + im.baseCurveRule);
  if (im.baseCurveRule === 'thinnest') {
    bc += ' ' + t('basecurve.vogelRef', { vogel: fmtDiopter(im.vogelClampedD1) });
  }
  setText(`${p}-basecurve`, bc);
  setText(`${p}-status`, '');
}

function update() {
  const start = performance.now();
  const sph = { OD: readSph('OD'), OS: readSph('OS') };
  const pd = { OD: readMm('rx-od-pd'), OS: readMm('rx-os-pd') };
  const dims = { A: readMm('frame-a'), B: readMm('frame-b'), DBL: readMm('frame-dbl') };
  const frameOk = dims.A !== null && dims.B !== null && dims.DBL !== null;
  const frame = frameOk ? { shape: currentShape(), A: dims.A, B: dims.B, DBL: dims.DBL } : null;
  const materialId = currentMaterialId();
  for (const eye of EYES) renderMaterialLine(eye, materialId);
  const spec = (eye) => specFor(eye, sph[eye], pd[eye], materialId, frame);
  const ready = (eye) => frameOk && sph[eye] !== null && pd[eye] !== null;
  if (ready('OD') && ready('OS')) {
    currentSpecs = { OD: spec('OD'), OS: spec('OS') };
    const pair = evaluatePair(currentSpecs);
    for (const eye of EYES) renderResult(eye, pair[eye]);
  } else {
    // A field is invalid: compute only the eye that is complete; the bench falls back to −2,00.
    currentSpecs = null;
    for (const eye of EYES) {
      if (ready(eye)) renderResult(eye, evaluateLens(spec(eye)));
      else if (sph[eye] === null) renderEmpty(eye, t('result.inputMissing'));
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
  const specs = currentSpecs ?? { OD: specFor('OD', -2), OS: specFor('OS', -2) };
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
