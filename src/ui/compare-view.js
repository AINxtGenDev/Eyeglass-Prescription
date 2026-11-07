// Material comparison table (02-07, RES-02, D-15, D-16, UI-SPEC "#cmp-material"): every other
// sourced material for the same Rx and frame, under the result. All arithmetic is in
// src/state/compare.js materialRows; this module only formats. Rows are built once and updated
// in place (text only when it changed). Rows whose values belong to the previous input are marked
// with data-cmp-stale, never with the main result's stale attribute, which keeps its main-only
// meaning (PATTERNS risk 4). Every string is written with textContent (T-02-20).
import { MATERIALS } from '../engine/materials.js';
import { materialRows, thickest, roundMm, configDiff, displayedValues } from '../state/compare.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtGramWhole } from '../i18n/format.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';

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
/** The configuration table's values belong to the previous input (02-08). */
let cfgOutdated = false;

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
  // 02-08: the check icon in both Vorher | Nachher segments (state is the native radio's checked).
  for (const input of document.querySelectorAll('#cmp-show input')) input.after(icon('check'));
}

/** The input changed: every row's values now belong to the previous input. */
export function markOutdated() {
  for (const r of [...rows.values(), ...eyeRows.values()]) {
    r.outdated = true;
    if (staleOn) markRow(r, true);
  }
  cfgOutdated = true;
  if (staleOn) markConfig(true);
}

/** Dotted underline on the outdated rows while the comparison is computing (or not run, sync). */
export function setCompareStale(on) {
  staleOn = on;
  for (const r of [...rows.values(), ...eyeRows.values()]) markRow(r, on && r.outdated);
  markConfig(on && cfgOutdated);
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

// ---- Configuration comparison (02-08, RES-03, D-28, UI-SPEC "#cmp-config") ----
// All arithmetic is in src/state/compare.js configDiff; this part only formats.

const sizeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

/** Value spans of the configuration table, for the stale mark. */
const cfgVals = () => [...document.querySelectorAll('#cmp-config-table .cmp-val, #cmp-config-table .cmp-rowdiff, #cmp-diff')];

function markConfig(on) {
  for (const v of cfgVals()) {
    if (on) /** @type {HTMLElement} */ (v).dataset.cmpStale = 'true';
    else delete (/** @type {HTMLElement} */ (v).dataset.cmpStale);
  }
}

/** A displayed value of a row ('weightBoth' in grams, the others in mm). */
const fmtVal = (id, v) => (id === 'weightBoth' ? (fmtGramWhole(v) ?? t('result.weightUnder1')) : fmtMm(v));

/** Signed difference B − A in words: "1,6 mm dünner", "4 g leichter", "gleich". */
function rowDiffText(id, diff) {
  if (diff === 0) return t('cmp.cfg.diff.same');
  if (id === 'weightBoth') return t(diff < 0 ? 'cmp.cfg.diff.lighter' : 'cmp.cfg.diff.heavier', { g: fmtVal(id, Math.abs(diff)) });
  return t(diff < 0 ? 'cmp.cfg.diff.thinner' : 'cmp.cfg.diff.thicker', { mm: fmtMm(Math.abs(diff)) });
}

/** The difference sentence from the summary (B − A; negative = B thinner or lighter). */
function configSentence(s) {
  const mm = fmtMm(Math.abs(s.thickDiffMm));
  const g = fmtGramWhole(Math.abs(s.weightDiffG)) ?? t('result.weightUnder1');
  const thinnerThicker = t(s.thickDiffMm < 0 ? 'cmp.config.word.thinner' : 'cmp.config.word.thicker');
  const lighterHeavier = t(s.weightDiffG < 0 ? 'cmp.config.word.lighter' : 'cmp.config.word.heavier');
  let text;
  if (s.thickDiffMm === 0 && s.weightDiffG === 0) text = t('cmp.config.equal');
  else if (s.thickDiffMm === 0) text = t('cmp.config.diffEqualThick', { g, lighterHeavier });
  else if (s.weightDiffG === 0) text = t('cmp.config.diffEqualWeight', { mm, thinnerThicker });
  else text = t('cmp.config.diff', { mm, thinnerThicker, g, lighterHeavier });
  if (s.partial) text += ' ' + t('cmp.config.partial', { eye: t(s.eye === 'OD' ? 'cmp.eye.od' : 'cmp.eye.os') });
  return text;
}

/**
 * Status line naming the frozen configuration A: shape, A□DBL and material from the dictionary,
 * sizes through Intl (T-02-23: textContent only).
 * @param {{ frame: { shape: string, A: number, DBL: number } | null, materialId: string }} config
 */
function statusText(config) {
  const f = config.frame;
  return t('cmp.config.status', {
    shape: f ? t('frame.shape.' + f.shape) : DASH,
    A: f ? sizeNf.format(f.A) : DASH,
    DBL: f ? sizeNf.format(f.DBL) : DASH,
    material: t('material.' + config.materialId),
  });
}

/** Show or hide the active block, with empty values; the toggle is back on Nachher afterwards. */
export function setConfigActive(on) {
  $('cmp-active').hidden = !on;
  cfgOutdated = false;
  markConfig(false);
  for (const v of document.querySelectorAll('#cmp-config-table .cmp-val')) write(/** @type {HTMLElement} */ (v), on ? DASH : '');
  for (const v of document.querySelectorAll('#cmp-config-table .cmp-rowdiff')) write(/** @type {HTMLElement} */ (v), '');
  setText('cmp-diff', '');
  setText('cmp-a-status', '');
  if (!on) /** @type {HTMLInputElement} */ (document.querySelector('#cmp-show input[value=b]')).checked = true;
}

/**
 * Paint the configuration comparison. A and B are LensResult pairs ({ OD, OS }, an eye null when
 * not computed); A undefined = still computing (old values stay, marked). `same` = the current
 * frame and material equal A's (then the "noch gleich" sentence is shown).
 * @param {{ config: { frame: object|null, materialId: string }, A: { OD?: object|null, OS?: object|null } | undefined,
 *   B: { OD?: object|null, OS?: object|null }, same: boolean }} o
 */
export function renderConfigCompare({ config, A, B, same }) {
  setText('cmp-a-status', statusText(config));
  if (A === undefined) {
    if (same) setText('cmp-diff', t('cmp.config.same'));
    return; // pending: old values stay, marked while the comparison computes
  }
  const shownOf = (pair) => ({ OD: displayedValues(pair?.OD), OS: displayedValues(pair?.OS) });
  const { rows: list, summary } = configDiff(shownOf(A), shownOf(B));
  for (const row of list) {
    const tr = /** @type {HTMLElement} */ ($('cmp-row-' + row.id));
    const [a, b, d] = ['a', 'b', 'diff'].map((c) => /** @type {HTMLElement} */ (tr.querySelector(`td[data-col=${c}] .cmp-val`)));
    const under = /** @type {HTMLElement} */ (tr.querySelector('.cmp-rowdiff'));
    if (row.failed) {
      for (const el of [a, b, d]) write(el, DASH);
      write(under, '');
      continue;
    }
    write(a, fmtVal(row.id, row.a));
    write(b, fmtVal(row.id, row.b));
    const diff = rowDiffText(row.id, row.diff);
    write(d, diff);
    write(under, diff);
  }
  setText('cmp-diff', same ? t('cmp.config.same') : summary === null ? '' : configSentence(summary));
  cfgOutdated = false;
  markConfig(false);
}
