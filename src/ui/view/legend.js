// Dickenkarte legend and table (03-12, VIZ-05, D-22, D-23, D-04(e); UI-SPEC "Heatmap"). This is the
// colour-free reading of the map: the legend says the direction in words (dünner / dicker) and the
// mm values at the ticks; the table '#view-heat-table' holds every key value for both eyes. Every
// number is an engine value (heatScale / isoLevels / heatCallouts in src/engine/mesh/heat.js,
// computed by view.js once per delivery) formatted by format.js; nothing is read from the mesh.
//
// CSP style-src 'self' (as cross-section.js, T-03-31): no style attribute and no style element;
// colours via presentation attributes (stop-color) or classes. Elements are made with
// createElementNS / createElement and filled with textContent only.
import { $ } from '../dom.js';
import { t } from '../../i18n/t.js';
import { fmtMm, fmtIsoValue, fmtIsoStep } from '../../i18n/format.js';
import { CIVIDIS_HEX } from './cividis.js';

const NS = 'http://www.w3.org/2000/svg';
/** UI-SPEC: legend max 400 px, a 16 px bar, 14 px labels. */
const MAX_W_PX = 400;
const FALLBACK_W_PX = 288;
const BAR_PX = 16;
const TICK_PX = 6;
const FONT_PX = 14;
const ROW_PX = 18;
/** Label width estimate per character (tabular digits ≈ 0,55 em; kept conservative). */
const CHAR_EM = 0.62;
const LABEL_GAP_PX = 6;
const EYES = /** @type {const} */ (['OD', 'OS']);
const ROWS = /** @type {const} */ (['centre', 'nasal', 'temporal', 'superior', 'inferior', 'thickest']);
const EDGE_ROWS = new Set(['nasal', 'temporal', 'superior', 'inferior']);
const DASH = '–';

const num = (v) => String(Math.round(v * 100) / 100);

function svgEl(name, attrs = {}, text) {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

function htmlEl(name, attrs = {}, text) {
  const el = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Tick positions and label rows: one row when no two neighbouring labels would touch, else two
 * alternating rows (labels never shrink below 14 px, UI-SPEC Typography).
 * @param {number[]} ticks values @param {(v: number) => number} xOf @param {number[]} w label widths, px
 */
function tickRows(ticks, xOf, w) {
  const span = (i) => {
    const x = xOf(ticks[i]);
    // End labels are anchored inside the box (start / end), the others centred.
    if (i === 0) return [x, x + w[i]];
    if (i === ticks.length - 1) return [x - w[i], x];
    return [x - w[i] / 2, x + w[i] / 2];
  };
  const fitsOneRow = ticks.every((_, i) => i === 0 || span(i - 1)[1] + LABEL_GAP_PX <= span(i)[0]);
  return ticks.map((_, i) => (fitsOneRow ? 0 : i % 2));
}

let lastLegend = null;
let observed = false;

/**
 * Paint #view-legend: title, end words, SVG gradient bar with ticks, step line (or the flat-range
 * sentence). min / max = the engine scale (heatScale: thinnest / thickest point); levels = isoLevels.
 * @param {{ min: number, max: number, levels: { step: number, values: number[], scaleMin: number, scaleMax: number, flat: boolean } }} p
 */
export function renderLegend(p) {
  lastLegend = p;
  const root = $('view-legend');
  if (!observed) {
    observed = true;
    let width = 0;
    new ResizeObserver(() => {
      const w = root.clientWidth;
      if (w > 0 && w !== width && lastLegend) {
        width = w;
        paintLegend(root, lastLegend);
      }
    }).observe(root);
  }
  paintLegend(root, p);
}

function paintLegend(root, { min, max, levels }) {
  const width = Math.min(MAX_W_PX, root.clientWidth || FALLBACK_W_PX);
  const { scaleMin, scaleMax, values, step, flat } = levels;
  const ticks = [scaleMin, ...values, scaleMax];
  const labels = ticks.map(fmtIsoValue);
  const pad = 1;
  const xOf = (v) => pad + ((v - scaleMin) / (scaleMax - scaleMin)) * (width - 2 * pad);
  // Width estimate first; replaced by the measured text widths below once the SVG is laid out.
  let rows = tickRows(
    ticks,
    xOf,
    labels.map((s) => s.length * CHAR_EM * FONT_PX),
  );
  const heightFor = (r) => BAR_PX + TICK_PX + (Math.max(...r) + 1) * ROW_PX + 4;
  const height = heightFor(rows);

  const minT = fmtMm(min);
  const maxT = fmtMm(max);
  const stepT = fmtIsoStep(step);
  const svg = svgEl('svg', {
    viewBox: `0 0 ${num(width)} ${num(height)}`,
    width: num(width),
    height: num(height),
    role: 'img',
    'aria-labelledby': 'view-legend-svg-title view-legend-svg-desc',
    'font-size': FONT_PX,
    class: 'view-legend-svg',
  });
  svg.append(svgEl('title', { id: 'view-legend-svg-title' }, t('view.legend.svgTitle')));
  svg.append(svgEl('desc', { id: 'view-legend-svg-desc' }, t('view.legend.svgDesc', { min: minT, max: maxT, step: stepT })));
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: 'view-legend-grad', x1: 0, y1: 0, x2: 1, y2: 0 });
  // Left = thin = cividis(1), right = thick = cividis(0): colour = cividis(1 − t) as on the map.
  const n = CIVIDIS_HEX.length;
  for (let i = 0; i < n; i++) {
    grad.append(svgEl('stop', { offset: num(i / (n - 1)), 'stop-color': CIVIDIS_HEX[n - 1 - i] }));
  }
  defs.append(grad);
  svg.append(defs);
  svg.append(
    svgEl('rect', {
      x: pad,
      y: 0.5,
      width: num(width - 2 * pad),
      height: BAR_PX,
      fill: 'url(#view-legend-grad)',
      class: 'view-legend-bar',
      'stroke-width': 1,
    }),
  );
  ticks.forEach((v, i) => {
    const x = num(xOf(v));
    svg.append(svgEl('line', { x1: x, x2: x, y1: 0.5, y2: BAR_PX + TICK_PX, class: 'view-legend-tick', 'stroke-width': 1 }));
    const anchor = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle';
    const y = BAR_PX + TICK_PX + (rows[i] + 1) * ROW_PX - 4;
    svg.append(svgEl('text', { x, y: num(y), 'text-anchor': anchor, class: 'view-legend-label', 'data-tick': i }, labels[i]));
  });

  const title = htmlEl('p', { class: 'view-legend-title' }, t('view.legend.title'));
  const ends = htmlEl('p', { class: 'view-legend-ends' });
  ends.append(htmlEl('span', {}, t('view.legend.thin')), htmlEl('span', {}, t('view.legend.thick')));
  const stepLine = htmlEl(
    'p',
    { class: 'view-legend-step', id: 'view-legend-step' },
    flat ? t('view.legend.flat', { min: minT, max: maxT }) : t('view.legend.step', { step: stepT }),
  );
  root.replaceChildren(title, ends, svg, stepLine);
  // Measured widths (getBBox needs a rendered SVG; a hidden legend keeps the estimate and is
  // repainted by the ResizeObserver when it appears).
  const texts = /** @type {SVGTextElement[]} */ ([...svg.querySelectorAll('text')]);
  const measured = texts.map((el) => el.getBBox().width);
  if (measured.every((x) => x > 0)) {
    rows = tickRows(ticks, xOf, measured);
    texts.forEach((el, i) => el.setAttribute('y', num(BAR_PX + TICK_PX + (rows[i] + 1) * ROW_PX - 4)));
    const h = heightFor(rows);
    svg.setAttribute('height', num(h));
    svg.setAttribute('viewBox', `0 0 ${num(width)} ${num(h)}`);
  }
}

/**
 * Paint #view-heat-table (the text equivalent of the map) and #view-heat-nochord.
 * 03-14 (D-25, UI-SPEC Heatmap table): in a comparison the columns are Stelle · Vorher (A) ·
 * Nachher (B) for the compared eye, and the caption names the eye.
 * @param {{ OD?: { callouts: any, metrics: any } | null, OS?: { callouts: any, metrics: any } | null,
 *   compare?: { eye: 'OD' | 'OS', A: { callouts: any, metrics: any } | null, B: { callouts: any, metrics: any } | null } }} eyes
 *   callouts = heatCallouts(…) of the lens (engine), metrics = its LensResult.metrics; null = blocked
 */
export function renderHeatTable(eyes) {
  const table = /** @type {HTMLTableElement} */ ($('view-heat-table'));
  const cmp = eyes.compare ?? null;
  /** Column id → [header text, column data] */
  const cols = cmp
    ? [
        ['A', t('view.table.col.a'), cmp.A],
        ['B', t('view.table.col.b'), cmp.B],
      ]
    : EYES.map((e) => [e, t(e === 'OD' ? 'view.heatEye.od' : 'view.heatEye.os'), eyes[e] ?? null]);
  const caption = cmp ? t('view.table.caption.compare', { eye: t(cmp.eye === 'OS' ? 'view.viewName.os' : 'view.viewName.od') }) : t('view.table.caption');
  if (table.caption && table.caption.textContent !== caption) table.caption.textContent = caption;
  const head = htmlEl('tr');
  head.append(htmlEl('th', { scope: 'col' }, t('view.table.col.where')));
  for (const [, title] of cols) head.append(htmlEl('th', { scope: 'col' }, title));
  table.tHead?.replaceChildren(head);
  let noChord = false;
  const body = ROWS.map((row) => {
    const tr = htmlEl('tr');
    tr.append(htmlEl('th', { scope: 'row' }, t(`view.table.row.${row}`)));
    for (const [col, title, v] of cols) {
      let text = DASH;
      if (v) {
        const c = v.callouts;
        if (row === 'centre') text = fmtMm(c.centre.t);
        else if (row === 'thickest') {
          const loc = c.thickest.where === 'centre' ? 'centre' : v.metrics.etMax.location;
          text = t('view.table.thickestCell', { mm: fmtMm(c.thickest.t), loc: t('loc.' + loc) });
        } else if (c.ok) text = fmtMm(c[row].t);
        else if (EDGE_ROWS.has(row)) noChord = true;
      }
      const td = htmlEl('td', { 'data-row': row, 'data-col': col, class: 'num' });
      td.append(htmlEl('span', { class: 'cell-label', 'aria-hidden': 'true' }, title), htmlEl('span', { class: 'cell-val' }, text));
      tr.append(td);
    }
    return tr;
  });
  table.tBodies[0].replaceChildren(...body);
  const nc = $('view-heat-nochord');
  nc.textContent = noChord ? t('view.table.noChord') : '';
  nc.hidden = !noChord;
}
