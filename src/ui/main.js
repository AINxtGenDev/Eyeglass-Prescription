// The only DOM tier: raw field text → parseDiopter → evaluatePair → German render.
// Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { parseDiopter } from '../state/parse.js';
import { evaluatePair, evaluateLens } from '../engine/evaluate.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtMm, fmtGram, fmtMs } from '../i18n/format.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';
const BENCH_RUNS = 50;

// Skeleton limits (01-03): sphere only, fixed round frame, CR-39. Lifted by 01-06 … 01-09.
const FRAME = Object.freeze({ shape: 'rund', A: 50, B: 50, DBL: 18 });
const MONO_PD = 32;

/** @param {'OD'|'OS'} eye @param {number} sph @param {number} monoPD */
function specFor(eye, sph, monoPD = MONO_PD) {
  return {
    eye,
    sph,
    cyl: 0,
    axisDeg: 0,
    materialId: 'cr39',
    frame: FRAME,
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

function applyDictionary() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  }
}

/** Parse one eye's field, show echo or error; returns the value or null. */
function readEye(eye) {
  const id = `rx-${eye.toLowerCase()}-sph`;
  const input = /** @type {HTMLInputElement} */ ($(id));
  const err = $(`${id}-err`);
  const r = parseDiopter(input.value);
  if (r.ok) {
    setText(`${id}-echo`, fmtDiopter(r.value));
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

const CELLS = ['ct', 'etmax', 'etmin', 'weight', 'basecurve'];

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
  const values = { OD: readEye('OD'), OS: readEye('OS') };
  if (values.OD !== null && values.OS !== null) {
    currentSpecs = { OD: specFor('OD', values.OD), OS: specFor('OS', values.OS) };
    const pair = evaluatePair(currentSpecs);
    for (const eye of EYES) renderResult(eye, pair[eye]);
  } else {
    // One field is invalid: compute only the other eye; the bench falls back to −2,00.
    currentSpecs = null;
    for (const eye of EYES) {
      if (values[eye] === null) renderEmpty(eye, t('result.inputMissing'));
      else renderResult(eye, evaluateLens(specFor(eye, values[eye])));
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
  for (const eye of EYES) {
    const input = /** @type {HTMLInputElement} */ ($(`rx-${eye.toLowerCase()}-sph`));
    input.value = '-2,00';
    input.addEventListener('input', update);
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
