// Result rendering (02-01, RES-01, RES-04): one plain-German card per eye, diagnostics, stale
// marks and the L/R callout. The technical values live in the Zwischenwerte (expert.js, 02-02).
// Every number comes from the engine result or from src/state/compare.js.
import { $, setText, para } from './dom.js';
import { thickest, roundMm, roundG, uniformEdge, lrCause, lrDifference } from '../state/compare.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtGramWhole } from '../i18n/format.js';
import { renderZwischenwerte, clearZwischenwerte, isExpert, EXPERT_CELLS } from './expert.js';
import { updateSummaryBar } from './summary-bar.js';

const DASH = '–';

/** The four card value ids per eye. */
export const CELLS = ['ct', 'thick', 'etmin', 'weight'];
// Location spans per eye, keyed as in lastLoc (etmax = the 'Dickster Rand' Zwischenwert).
const LOCS = { thick: 'thick-loc', etmin: 'etmin-loc', etmax: 'etmax-loc' };

const glass = (eye) => t(eye === 'OD' ? 'result.glass.od' : 'result.glass.os');
const side = (eye) => t(eye === 'OD' ? 'result.side.od' : 'result.side.os');

/**
 * Displayed (rounded) values, the painted card strings and the spec of the painted result per
 * eye, for the L/R callout and the summary bar; null = no result shown. Written only by
 * renderResult, which main.js calls under the client.isCurrent re-check (T-02-02).
 */
const displayed = { OD: null, OS: null };
/** Eyes whose values are marked stale ("rechnet …", set by main.js onBusy via setStale). */
const staleEyes = new Set();

/** Summary bar from the strings the cards were painted with (no second formatting pass, T-02-05). */
function paintBar() {
  const bar = (d) => (d ? { thick: d.thickText, weight: d.weightText } : null);
  updateSummaryBar({ OD: bar(displayed.OD), OS: bar(displayed.OS), busy: staleEyes.size > 0, stale: staleEyes.size > 0 });
}

/**
 * Location codes painted per eye ({ thick, etmin, etmax }: 'centre', 'temporal-superior', …, and
 * 'uniform' wherever the uniform-edge rule painted loc.uniform); null = no result shown. Lets
 * repaintFromLast() switch the Expert suffix without a recompute.
 */
const lastLoc = { OD: null, OS: null };

/** Lay location word, plus the technical term in parentheses in the Experten-Ansicht. */
const locText = (code) => t('loc.' + code) + (isExpert() ? ' (' + t('loc.tech.' + code) + ')' : '');

function writeLocs(eye) {
  const p = `result-${eye.toLowerCase()}`;
  const codes = lastLoc[eye];
  for (const [k, id] of Object.entries(LOCS)) setText(`${p}-${id}`, codes ? locText(codes[k]) : '');
}

function noResult(eye) {
  const p = `result-${eye.toLowerCase()}`;
  displayed[eye] = null;
  lastLoc[eye] = null;
  for (const c of CELLS) setText(`${p}-${c}`, DASH);
  clearZwischenwerte(eye);
  writeLocs(eye);
  $(`${p}-grid`).hidden = true;
  renderLrCallout();
  paintBar();
}

/**
 * Expert switch toggled: rewrite only the location spans from the codes painted last (lens-critic
 * round 4 finding 1). No number, headline, Zwischenwert, stale mark or compute is touched, so it
 * can neither repaint old values nor clear a "rechnet …" mark. The compute client would skip an
 * identical spec anyway (compute-client.js `wanted[eye]?.key === key`).
 */
export function repaintFromLast() {
  for (const eye of ['OD', 'OS']) if (lastLoc[eye]) writeLocs(eye);
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

/** Dotted underline on an eye's value cells while its values belong to the previous input. */
export function setStale(eye, on) {
  for (const c of [...CELLS, ...EXPERT_CELLS]) {
    const el = $(`result-${eye.toLowerCase()}-${c}`);
    if (on) el.dataset.stale = 'true';
    else delete el.dataset.stale;
  }
  const before = staleEyes.size;
  if (on) staleEyes.add(eye);
  else staleEyes.delete(eye);
  if (staleEyes.size !== before) paintBar();
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
  const th = thickest(m);
  const thick = fmtMm(th.value);
  const ct = fmtMm(m.ct);
  const etmin = fmtMm(m.etMin.value);
  const weight = fmtGramWhole(m.weightG) ?? t('result.weightUnder1');
  // Uniform edge: the displayed thickest and thinnest edge are equal, so no edge location is named.
  const uniform = uniformEdge(m);
  lastLoc[eye] = {
    thick: uniform && th.where !== 'centre' ? 'uniform' : th.where,
    etmin: uniform ? 'uniform' : m.etMin.location,
    etmax: m.etMax.location,
  };
  // The headline keeps the lay words only; the spans get the Expert suffix (writeLocs).
  const thickLoc = t('loc.' + lastLoc[eye].thick);
  const etminLoc = t('loc.' + lastLoc[eye].etmin);
  $(`${p}-grid`).hidden = false;
  $(`${p}-empty`).hidden = true;
  setText(`${p}-thick`, thick);
  setText(`${p}-etmin`, etmin);
  writeLocs(eye);
  setText(`${p}-ct`, ct);
  setText(`${p}-weight`, weight);
  setText(
    `${p}-headline`,
    uniform
      ? t('result.headline.uniformEdge', { glass: glass(eye), etmin, ct, weight })
      : t('result.headline', { glass: glass(eye), thick, thickLoc, etmin, etminLoc, ct, weight }),
  );
  renderZwischenwerte(eye, res);
  setText(`${p}-status`, statusLabel(res.diagnostics));
  renderDiagnostics(eye, res.diagnostics);
  displayed[eye] = { thick: roundMm(th.value), weight: roundG(m.weightG), spec, thickText: thick, weightText: weight };
  paintBar();
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
