// Result rendering (02-01, RES-01, RES-04): one plain-German card per eye, the technical rows
// (Dezentration, Dickster Rand, Basiskurve), diagnostics, stale marks and the L/R callout.
// Every number comes from the engine result or from src/state/compare.js.
import { $, setText, para } from './dom.js';
import { thickest, roundMm, roundG, lrCause, lrDifference } from '../state/compare.js';
import { nasalSign } from '../engine/conventions.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtMm, fmtGramWhole } from '../i18n/format.js';

const DASH = '–';

/** Every value id per eye: the four card values plus the three technical rows. */
export const CELLS = ['ct', 'thick', 'etmin', 'weight', 'dec', 'etmax', 'basecurve'];
const LOCS = ['thick-loc', 'etmin-loc', 'etmax-loc'];

const glass = (eye) => t(eye === 'OD' ? 'result.glass.od' : 'result.glass.os');
const side = (eye) => t(eye === 'OD' ? 'result.side.od' : 'result.side.os');

/**
 * Displayed (rounded) values and the spec of the painted result per eye, for the L/R callout;
 * null = no result shown. Written only by renderResult, which main.js calls under the
 * client.isCurrent re-check (T-02-02).
 */
const displayed = { OD: null, OS: null };

function noResult(eye) {
  const p = `result-${eye.toLowerCase()}`;
  displayed[eye] = null;
  for (const c of CELLS) setText(`${p}-${c}`, DASH);
  for (const c of LOCS) setText(`${p}-${c}`, '');
  $(`${p}-grid`).hidden = true;
  renderLrCallout();
}

/**
 * No result for this eye: dashes in every value id, the card grid hidden. `empty` (no Sph typed)
 * shows the empty-state heading and body instead of a headline.
 */
export function renderEmpty(eye, statusText, empty = false) {
  const p = `result-${eye.toLowerCase()}`;
  noResult(eye);
  setText(`${p}-headline`, empty ? t('result.empty.heading', { glass: side(eye) }) : '');
  $(`${p}-empty`).hidden = !empty;
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

/** Text label for the status line (never colour alone). */
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
  const j = thickest(m).value;
  if (v === null) return bc + ' ' + t('basecurve.vogelRefImpossible', { vogel });
  if (v - j >= 0.05) return bc + ' ' + t('basecurve.vogelRefThicker', { vogel, thickness: fmtMm(v) });
  return bc + ' ' + t('basecurve.vogelRef', { vogel });
}

/** Dotted underline on an eye's value cells while its values belong to the previous input. */
export function setStale(eye, on) {
  for (const c of CELLS) {
    const el = $(`result-${eye.toLowerCase()}-${c}`);
    if (on) el.dataset.stale = 'true';
    else delete el.dataset.stale;
  }
}

/** The compute itself failed (worker error): dashes, German message (01-15 onFailed). */
export function renderFailed(eye) {
  const e = eye.toLowerCase();
  noResult(eye);
  setText(`result-${e}-headline`, '');
  $(`result-${e}-empty`).hidden = true;
  setStale(eye, false);
  setText(`result-${e}-status`, t('compute.failed.title'));
  const box = $(`diag-${e}`);
  const text = t('compute.failed.explain');
  if (box.dataset.sig !== text) {
    box.replaceChildren(para(text));
    box.dataset.sig = text;
  }
}

/**
 * Paint one eye's LensResult. `spec` is the spec this result was computed for (for lrCause).
 * @param {'OD'|'OS'} eye @param {object} res LensResult @param {object|null} spec
 */
export function renderResult(eye, res, spec) {
  const p = `result-${eye.toLowerCase()}`;
  setStale(eye, false);
  if (!res.ok) {
    renderEmpty(eye, statusLabel(res.diagnostics));
    renderDiagnostics(eye, res.diagnostics);
    return;
  }
  const m = res.metrics;
  const im = res.intermediates;
  const th = thickest(m);
  const thick = fmtMm(th.value);
  const ct = fmtMm(m.ct);
  const etmin = fmtMm(m.etMin.value);
  const etmax = fmtMm(m.etMax.value);
  const weight = fmtGramWhole(m.weightG) ?? t('result.weightUnder1');
  // Uniform edge: the displayed thickest and thinnest edge are equal, so no edge location is named.
  const uniform = etmax === etmin;
  const thickLoc = t(uniform && th.where !== 'centre' ? 'loc.uniform' : 'loc.' + th.where);
  const etminLoc = t(uniform ? 'loc.uniform' : 'loc.' + m.etMin.location);
  $(`${p}-grid`).hidden = false;
  $(`${p}-empty`).hidden = true;
  setText(`${p}-thick`, thick);
  setText(`${p}-thick-loc`, thickLoc);
  setText(`${p}-etmin`, etmin);
  setText(`${p}-etmin-loc`, etminLoc);
  setText(`${p}-ct`, ct);
  setText(`${p}-weight`, weight);
  setText(
    `${p}-headline`,
    uniform
      ? t('result.headline.uniformEdge', { glass: glass(eye), etmin, ct, weight })
      : t('result.headline', { glass: glass(eye), thick, thickLoc, etmin, etminLoc, ct, weight }),
  );
  // Technical rows. The 'Dickster Rand' row is the edge value, number first (e2e etmaxOf).
  // display only: the engine's signed x offset turned into "toward the nose" for this eye
  setText(`${p}-dec`, fmtMm(nasalSign(eye) * m.decentration.x));
  setText(`${p}-etmax`, etmax);
  setText(`${p}-etmax-loc`, t('loc.' + m.etMax.location));
  setText(`${p}-basecurve`, baseCurveText(m, im));
  setText(`${p}-status`, statusLabel(res.diagnostics));
  renderDiagnostics(eye, res.diagnostics);
  displayed[eye] = { thick: roundMm(th.value), weight: roundG(m.weightG), spec };
}

/**
 * L/R sentence from the values just painted for both eyes and their specs (no recompute).
 * Hidden when either eye has no result.
 */
export function renderLrCallout() {
  const el = $('lr-callout');
  const od = displayed.OD;
  const os = displayed.OS;
  const d = od?.spec && os?.spec ? lrDifference(od, os, lrCause(od.spec, os.spec)) : null;
  let text = '';
  if (d) {
    const big = d.kind === 'thickness' ? d.thicker : d.heavier;
    const params = {
      glass: side(big),
      other: side(big === 'OD' ? 'OS' : 'OD'),
      diff: d.kind === 'thickness' ? fmtMm(d.diffMm) : fmtGramWhole(d.diffG),
    };
    text = t(d.kind === 'thickness' ? 'result.lr.thicker' : 'result.lr.heavier', params) + ' ' + t('result.lr.cause.' + d.cause);
  }
  // Rewrite only on change, so an unchanged sentence is not announced again (MINOR-11 rule).
  if ((el.dataset.sig ?? '') === text) return;
  el.dataset.sig = text;
  el.textContent = text;
  el.hidden = text === '';
}
