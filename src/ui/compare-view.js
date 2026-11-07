// Material comparison table (02-07, RES-02, D-15, D-16, UI-SPEC "#cmp-material"): every other
// sourced material for the same Rx and frame, under the result. All arithmetic is in
// src/state/compare.js materialRows; this module only formats. Rows are built once and updated
// in place (text only when it changed). Rows whose values belong to the previous input are marked
// with data-cmp-stale, never with the main result's stale attribute, which keeps its main-only
// meaning (PATTERNS risk 4). Every string is written with textContent (T-02-20).
import { MATERIALS } from '../engine/materials.js';
import { materialRows, thickest, roundMm } from '../state/compare.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtGramWhole } from '../i18n/format.js';
import { $, setText } from './dom.js';

const IDS = Object.keys(MATERIALS);
const EYES = /** @type {const} */ (['OD', 'OS']);
const DASH = '–';
const EM_DASH = '—';
const pctNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });

/** Write text only when it changed. */
const write = (el, text) => {
  if (el.textContent !== text) el.textContent = text;
};

const span = (cls, text = '') => {
  const el = document.createElement('span');
  if (cls) el.className = cls;
  el.textContent = text;
  return el;
};

/**
 * One table cell with a cell label (visible in stacked mode) and value spans.
 * @param {'th'|'td'} tag @param {string} col @param {string|null} labelKey @param {string[]} parts
 */
function cell(tag, col, labelKey, parts) {
  const el = document.createElement(tag);
  el.dataset.col = col;
  if (tag === 'th') el.scope = 'row';
  if (labelKey) el.append(span('cell-label', t(labelKey)));
  const out = { el };
  for (const p of parts) {
    out[p] = span('cmp-' + p);
    el.append(out[p]);
  }
  return out;
}

/** @type {Map<string, { tr: HTMLTableRowElement, outdated: boolean, vals: HTMLElement[], c: Record<string, any> }>} */
const rows = new Map();
/** @type {Map<string, { tr: HTMLTableRowElement, outdated: boolean, vals: HTMLElement[], c: Record<string, any> }>} */
const eyeRows = new Map();
let staleOn = false;

function buildRows() {
  const body = /** @type {HTMLElement} */ (document.querySelector('#cmp-material-table tbody'));
  const eyeBody = /** @type {HTMLElement} */ (document.querySelector('#cmp-material-eyes-table tbody'));
  for (const id of IDS) {
    const tr = document.createElement('tr');
    tr.dataset.material = id;
    const c = {
      material: cell('th', 'material', null, ['name', 'tag']),
      thick: cell('td', 'thick', 'cmp.col.thick', ['val', 'loc']),
      ct: cell('td', 'ct', 'cmp.col.ct', ['val']),
      weight: cell('td', 'weight', 'cmp.col.weight', ['val']),
      diff: cell('td', 'diff', 'cmp.col.diff', ['text', 'pct', 'sr']),
    };
    c.material.name.textContent = t('material.' + id + '.title');
    c.material.tag.hidden = true;
    c.diff.sr.className = 'visually-hidden';
    tr.append(...Object.values(c).map((x) => x.el));
    const vals = [c.thick.val, c.thick.loc, c.ct.val, c.weight.val, c.diff.text, c.diff.pct];
    for (const v of [c.thick.val, c.ct.val, c.weight.val, c.diff.text]) v.textContent = DASH;
    rows.set(id, { tr, outdated: false, vals, c });
    body.append(tr);

    for (const eye of EYES) {
      const etr = document.createElement('tr');
      etr.dataset.material = id;
      etr.dataset.eye = eye;
      const e = {
        material: cell('th', 'material', null, ['name']),
        eye: cell('td', 'eye', 'cmp.eyes.col.eye', ['val']),
        thick: cell('td', 'thick', 'cmp.col.thick', ['val', 'loc']),
        edge: cell('td', 'edge', 'cmp.eyes.col.edge', ['val', 'loc']),
        ct: cell('td', 'ct', 'cmp.col.ct', ['val']),
        weight: cell('td', 'weight', 'cmp.eyes.col.weight', ['val']),
      };
      e.material.name.textContent = t('material.' + id + '.title');
      e.eye.val.textContent = t(eye === 'OD' ? 'result.card.od' : 'result.card.os');
      etr.append(...Object.values(e).map((x) => x.el));
      const evals = [e.thick.val, e.thick.loc, e.edge.val, e.edge.loc, e.ct.val, e.weight.val];
      for (const v of [e.thick.val, e.edge.val, e.ct.val, e.weight.val]) v.textContent = DASH;
      eyeRows.set(`${id}-${eye}`, { tr: etr, outdated: false, vals: evals, c: e });
      eyeBody.append(etr);
    }
  }
}

function markRow(r, on) {
  for (const v of r.vals) {
    if (on) v.dataset.cmpStale = 'true';
    else delete v.dataset.cmpStale;
  }
}

/** A row got values for the current input: no longer outdated, no stale mark. */
function fresh(r) {
  r.outdated = false;
  markRow(r, false);
}

/** Static parts: the assumed-constant footnote from materials.js `assumed` (lens-critic MINOR-3). */
export function initCompareView() {
  buildRows();
  const assumed = IDS.filter((id) => MATERIALS[id].assumed?.includes('minET')).map((id) => t('material.' + id + '.title'));
  setText('cmp-assumed-note', assumed.length > 0 ? t('cmp.assumedNote', { materials: assumed.join(' und ') }) : '');
  $('cmp-assumed-note').hidden = assumed.length === 0;
}

/** The input changed: every row's values now belong to the previous input. */
export function markOutdated() {
  for (const r of [...rows.values(), ...eyeRows.values()]) {
    r.outdated = true;
    if (staleOn) markRow(r, true);
  }
}

/** Dotted underline on the outdated rows while the comparison is computing (or not run, sync). */
export function setCompareStale(on) {
  staleOn = on;
  for (const r of [...rows.values(), ...eyeRows.values()]) markRow(r, on && r.outdated);
}

/** Difference sentence key and params from the signed displayed differences (row thinner = +). */
function diffSentence(diffMm, diffG) {
  const mm = fmtMm(Math.abs(diffMm));
  const g = fmtGramWhole(Math.abs(diffG)) ?? t('result.weightUnder1');
  const sm = Math.sign(diffMm);
  const sg = Math.sign(diffG);
  let key;
  if (sm === 0 && sg === 0) key = 'equal';
  else if (sm === 0) key = sg > 0 ? 'equalThickLighter' : 'equalThickHeavier';
  else if (sg === 0) key = sm > 0 ? 'equalWeightThinner' : 'equalWeightThicker';
  else if (sm > 0) key = sg > 0 ? 'thinnerLighter' : 'thinnerHeavier';
  else key = sg > 0 ? 'thickerLighter' : 'thickerHeavier';
  return t('cmp.diff.' + key, { mm, g });
}

function clearRow(r) {
  const c = r.c;
  r.tr.removeAttribute('data-selected');
  c.material.tag.hidden = true;
  write(c.material.tag, '');
  for (const v of [c.thick.val, c.ct.val, c.weight.val, c.diff.text]) write(v, DASH);
  for (const v of [c.thick.loc, c.diff.pct, c.diff.sr]) write(v, '');
  c.diff.text.removeAttribute('aria-hidden');
  fresh(r);
}

function paintRow(r, row) {
  const c = r.c;
  if (row.pending) return; // old values stay, marked while the comparison computes
  if (row.failed) {
    clearRow(r);
    write(c.diff.text, t('result.diagLabel.failed'));
    return;
  }
  if (row.selected) r.tr.dataset.selected = 'true';
  else r.tr.removeAttribute('data-selected');
  c.material.tag.hidden = !row.selected;
  write(c.material.tag, row.selected ? t('cmp.selected') : '');
  write(c.thick.val, fmtMm(row.thickMm));
  write(c.thick.loc, t('loc.' + row.thickWhere));
  write(c.ct.val, fmtMm(row.ctMm));
  write(c.weight.val, fmtGramWhole(row.weightG) ?? t('result.weightUnder1'));
  if (row.selected) {
    write(c.diff.text, EM_DASH);
    c.diff.text.setAttribute('aria-hidden', 'true');
    write(c.diff.pct, '');
    write(c.diff.sr, t('cmp.selectedSr'));
  } else {
    c.diff.text.removeAttribute('aria-hidden');
    write(c.diff.text, diffSentence(row.diffMm, row.diffG));
    const pct = row.pct === null ? '' : t(row.pct > 0 ? 'cmp.pct' : 'cmp.pctThicker', { pct: pctNf.format(Math.abs(row.pct)) });
    write(c.diff.pct, pct);
    write(c.diff.sr, '');
  }
  fresh(r);
}

function paintEyeRow(r, res) {
  const c = r.c;
  if (res === undefined) return; // pending: old values stay
  if (!res?.ok) {
    for (const v of [c.thick.val, c.edge.val, c.ct.val, c.weight.val]) write(v, DASH);
    for (const v of [c.thick.loc, c.edge.loc]) write(v, '');
    fresh(r);
    return;
  }
  const m = res.metrics;
  const th = thickest(m);
  write(c.thick.val, fmtMm(roundMm(th.value)));
  write(c.thick.loc, t('loc.' + th.where));
  write(c.edge.val, fmtMm(roundMm(m.etMax.value)));
  write(c.edge.loc, t('loc.' + m.etMax.location));
  write(c.ct.val, fmtMm(roundMm(m.ct)));
  write(c.weight.val, fmtGramWhole(m.weightG) ?? t('result.weightUnder1'));
  fresh(r);
}

/**
 * Paint the comparison for the main result pair `selected` (never recomputed, D-15) and the
 * compare results `others` (material id → { OD, OS } pair; null = failed; missing = pending).
 * @param {{ selectedId: string|null, selected: { OD?: object|null, OS?: object|null }, others: Record<string, object|null> }} o
 */
export function renderMaterialTable({ selectedId, selected, others }) {
  const list = selectedId === null ? [] : materialRows({ selectedId, selected, others });
  if (list.length === 0) {
    setText('cmp-material-intro', '');
    for (const r of rows.values()) clearRow(r);
    for (const r of eyeRows.values()) paintEyeRow(r, null);
    return;
  }
  const eye = /** @type {{ eye: 'OD'|'OS' }} */ (list.find((row) => row.selected)).eye;
  setText('cmp-material-intro', t('cmp.material.intro', { eye: t(eye === 'OD' ? 'cmp.eye.od' : 'cmp.eye.os') }));
  for (const row of list) paintRow(/** @type {any} */ (rows.get(row.id)), row);
  for (const id of IDS) {
    const pair = id === selectedId ? selected : others[id];
    for (const e of EYES) {
      const r = /** @type {any} */ (eyeRows.get(`${id}-${e}`));
      // An eye that is not computed in the main result has no comparison either.
      if (!selected[e]) paintEyeRow(r, null);
      else paintEyeRow(r, pair === undefined ? undefined : (pair?.[e] ?? null));
    }
  }
}
