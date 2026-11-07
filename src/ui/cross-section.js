// Querschnitt (02-13, ANA-01, D-30, D-37): SVG of the lens profile along a meridian, built from
// the engine's meridianProfile (computed in the worker). Every number shown comes from the profile:
// t(0) = CT of the result, ends = thicknessAt at the outline hits. True 1:1 mm aspect (one user
// unit = 1 mm in x and y). CSP style-src 'self' (RESEARCH Pitfall 7): no style attribute and no
// style element; colours via classes (style.css) or presentation attributes. Elements are made
// with createElementNS / createElement and filled with textContent only.
import { $ } from './dom.js';
import { t } from '../i18n/t.js';
import { fmtMm, fmtDiopter } from '../i18n/format.js';
import { principalMeridians, meridianEndLabels } from '../engine/profile.js';

const NS = 'http://www.w3.org/2000/svg';
/** Label text size and row height in CSS px (UI-SPEC: 14 px labels). */
const FONT_PX = 14;
const ROW_PX = 18;
/** Stroke widths in CSS px (outline 2 px, dimension lines 1 px) and the B dash pattern (6 4). */
const LINE_PX = 2;
const DIM_PX = 1;
const DASH_PX = [6, 4];
/** UI-SPEC: max height 240 px. style.css reserves the figure box (02-14), the drawing fits into it. */
const MAX_H_PX = 240;
/** Fallback width when the figure is not laid out (hidden). */
const FALLBACK_W_PX = 320;
const MARGIN_X_MM = 2;

const intNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
const angleText = (deg) => intNf.format(deg);
const num = (v) => String(Math.round(v * 1000) / 1000);

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

const normAxis = (a) => ((a % 180) + 180) % 180;

/**
 * Fill #xsec-meridian from the Rx (minus-cylinder engine form): 'waagrecht (0°)' plus the principal
 * meridians (axis α: Sph, α + 90°: Sph + Zyl). Keeps the selection when it is still offered.
 * @param {{ sph: number, cyl: number, axisDeg: number } | null} rx
 * @returns {number} the selected meridian in degrees
 */
export function renderMeridianOptions(rx) {
  const sel = /** @type {HTMLSelectElement} */ ($('xsec-meridian'));
  const prev = Number(sel.value);
  const list = rx ? principalMeridians(rx) : [0];
  const a = rx ? normAxis(rx.axisDeg) : 0;
  const power = (th) => fmtDiopter(th === a ? rx.sph : rx.sph + rx.cyl);
  const labels = list.map((th) => {
    if (th !== 0) return t('xs.meridian.principal', { axis: angleText(th), power: power(th) });
    return rx && rx.cyl !== 0 ? t('xs.meridian.hPrincipal', { power: power(0) }) : t('xs.meridian.h');
  });
  const sig = list.map((th, i) => th + ':' + labels[i]).join('|');
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    sel.replaceChildren(...list.map((th, i) => htmlEl('option', { value: th }, labels[i])));
  }
  sel.value = String(list.includes(prev) ? prev : 0);
  return Number(sel.value);
}

/** Closed lens outline: front polyline, then the back polyline reversed. SVG y = −z. */
function lensPath(p) {
  const n = p.s.length;
  let d = `M${num(p.s[0])} ${num(-p.zFront[0])}`;
  for (let i = 1; i < n; i++) d += `L${num(p.s[i])} ${num(-p.zFront[i])}`;
  for (let i = n - 1; i >= 0; i--) d += `L${num(p.s[i])} ${num(-p.zBack[i])}`;
  return d + 'Z';
}

/** The values a profile shows: CT, the end in direction θ (end0) and the opposite end (end1). */
function values(p, codes) {
  return {
    ct: fmtMm(p.ct),
    endA: fmtMm(p.ends[0].t),
    locA: t('xs.end.' + codes[0]),
    endB: fmtMm(p.ends[1].t),
    locB: t('xs.end.' + codes[1]),
  };
}

/** Scale in px per mm for the 1:1 drawing: the whole chord fits the width, at most heightPx high. */
function pxPerMm(widthPx, heightPx, chord, depth) {
  let S = 5;
  for (let i = 0; i < 8; i++) {
    const row = ROW_PX / S;
    const vbW = chord + 2 * MARGIN_X_MM;
    const vbH = depth + 3 * row + 0.6 * row;
    S = Math.min(widthPx / vbW, heightPx / vbH);
  }
  return S;
}

function clearFigure() {
  $('xsec-figure').replaceChildren();
  $('xsec-legend').hidden = true;
  $('xsec-table').tBodies[0].replaceChildren();
  /** @type {HTMLTableElement} */ ($('xsec-table')).tHead?.replaceChildren();
}

/**
 * A profile job is on its way and nothing is drawn yet (02-14): show the text table with its rows
 * and empty values, so the drawing's arrival does not move the page below (the figure box is
 * reserved in style.css). An existing drawing stays until the new one is painted.
 * @param {{ eye: 'OD'|'OS', thetaDeg: number, overlay: boolean }} p
 */
export function renderCrossSectionPending({ eye, thetaDeg, overlay }) {
  if ($('xsec-figure').firstChild) return;
  $('xsec-nochord').hidden = true;
  $('xsec-table').hidden = false;
  renderTable(overlay ? ['a', 'b'] : ['b'], meridianEndLabels(eye, thetaDeg), overlay, { a: null, b: null });
}

/** No result for the selected eye yet (or it failed): an empty section, no stale drawing. */
export function renderCrossSectionEmpty() {
  clearFigure();
  $('xsec-nochord').hidden = true;
  $('xsec-table').hidden = true;
}

/**
 * Draw the profile(s) and fill the text table. profiles: one entry (label null) or A then B
 * (label 'A' / 'B'); B (or the single one) is dimensioned, A is drawn solid and B dashed.
 * @param {{ profiles: { label: 'A'|'B'|null, profile: any }[], eye: 'OD'|'OS', thetaDeg: number }} p
 */
export function renderCrossSection({ profiles, eye, thetaDeg }) {
  clearFigure();
  const main = profiles[profiles.length - 1];
  const nochord = $('xsec-nochord');
  if (!main?.profile?.ok) {
    // Defensive (NO_CHORD): the UI's PD and frame ranges keep the OC inside the outline.
    nochord.textContent = t('xs.noChord');
    nochord.hidden = false;
    $('xsec-table').hidden = true;
    return;
  }
  nochord.hidden = true;
  $('xsec-table').hidden = false;
  const drawn = profiles.filter((x) => x.profile?.ok);
  const overlay = drawn.length > 1;
  const codes = meridianEndLabels(eye, thetaDeg);
  const mp = main.profile;

  // Extents over every drawn profile: aligned at the OC (s = 0) and the front vertex (z = 0).
  let sMin = Infinity;
  let sMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const { profile: p } of drawn) {
    sMin = Math.min(sMin, p.s[0]);
    sMax = Math.max(sMax, p.s[p.s.length - 1]);
    for (let i = 0; i < p.s.length; i++) {
      yMin = Math.min(yMin, -p.zFront[i]);
      yMax = Math.max(yMax, -p.zBack[i]);
    }
  }
  const fig = $('xsec-figure');
  const S = pxPerMm(fig.clientWidth || FALLBACK_W_PX, Math.min(fig.clientHeight || MAX_H_PX, MAX_H_PX), sMax - sMin, yMax - yMin);
  const row = ROW_PX / S;
  const pad = 0.3 * row;
  const vb = { x: sMin - MARGIN_X_MM, y: yMin - 2 * row - pad, w: sMax - sMin + 2 * MARGIN_X_MM, h: 0 };
  vb.h = yMax + row + pad - vb.y;

  const eyeName = t(eye === 'OD' ? 'xs.eye.od' : 'xs.eye.os');
  const angle = angleText(thetaDeg);
  const v = values(mp, codes);
  const svg = svgEl('svg', {
    viewBox: [vb.x, vb.y, vb.w, vb.h].map(num).join(' '),
    preserveAspectRatio: 'xMidYMid meet',
    width: '100%',
    role: 'img',
    'aria-labelledby': 'xsec-svg-title xsec-svg-desc',
    'font-size': num(FONT_PX / S),
    class: 'xs-svg',
  });
  svg.append(svgEl('title', { id: 'xsec-svg-title' }, t('xs.svgTitle', { eye: eyeName, angle })));
  let desc = overlay ? t('xs.descB', v) : t('xs.desc', v);
  if (overlay) desc += ' ' + t('xs.descA', values(drawn[0].profile, codes));
  svg.append(svgEl('desc', { id: 'xsec-svg-desc' }, desc));

  for (const { label, profile: p } of drawn) {
    const isB = overlay && label === 'B';
    const attrs = {
      d: lensPath(p),
      class: isB ? 'xs-lens xs-b' : 'xs-lens',
      stroke: 'currentColor',
      'stroke-width': num(LINE_PX / S),
      'stroke-linejoin': 'round',
    };
    if (isB) Object.assign(attrs, { fill: 'none', 'stroke-dasharray': DASH_PX.map((x) => num(x / S)).join(' ') });
    svg.append(svgEl('path', attrs));
  }

  // Dimension lines of the dimensioned profile at s = 0 and both ends (front to back).
  const i0 = mp.s.indexOf(0);
  const last = mp.s.length - 1;
  const dims = [
    { key: 'ct', s: 0, i: i0, anchor: 'middle', word: t('xs.mid'), text: v.ct },
    { key: 'end1', s: mp.s[0], i: 0, anchor: 'start', word: v.locB, text: v.endB },
    { key: 'end0', s: mp.s[last], i: last, anchor: 'end', word: v.locA, text: v.endA },
  ];
  const yWords = vb.y + pad + 1.75 * row;
  const yValues = vb.y + vb.h - pad - 0.25 * row;
  for (const d of dims) {
    const x = num(d.s);
    svg.append(
      svgEl('line', {
        x1: x,
        x2: x,
        y1: num(-mp.zFront[d.i]),
        y2: num(-mp.zBack[d.i]),
        class: 'xs-dim',
        stroke: 'currentColor',
        'stroke-width': num(DIM_PX / S),
      }),
    );
    svg.append(svgEl('text', { x, y: num(yWords), 'text-anchor': d.anchor, class: 'xs-text' }, d.word));
    svg.append(svgEl('text', { x, y: num(yValues), 'text-anchor': d.anchor, class: 'xs-text', 'data-val': d.key }, d.text));
  }
  // Meridian angle in the top-left corner.
  svg.append(
    svgEl('text', { x: num(vb.x + 0.2 * row), y: num(vb.y + pad + 0.75 * row), class: 'xs-text xs-angle' }, `${t('xs.meridian.label')} ${angle}°`),
  );
  fig.replaceChildren(svg);

  const legend = $('xsec-legend');
  legend.textContent = t('xs.legend');
  legend.hidden = !overlay;
  const cols = overlay ? ['a', 'b'] : ['b'];
  renderTable(cols, codes, overlay, { b: profiles[profiles.length - 1].profile, a: overlay ? drawn[0].profile : null });
}

/** Text table; a column whose profile is null gets empty value cells (pending, 02-14). */
function renderTable(cols, codes, overlay, byCol) {
  const table = /** @type {HTMLTableElement} */ ($('xsec-table'));
  const head = htmlEl('tr');
  head.append(htmlEl('td'));
  for (const c of cols) head.append(htmlEl('th', { scope: 'col' }, t(overlay ? `xs.col.${c}` : 'xs.col.value')));
  table.tHead?.replaceChildren(head);
  const rows = [
    { key: 'ct', label: t('xs.row.ct'), val: (p) => p.ct },
    { key: 'end0', label: t('xs.row.end', { loc: t('xs.end.' + codes[0]) }), val: (p) => p.ends[0].t },
    { key: 'end1', label: t('xs.row.end', { loc: t('xs.end.' + codes[1]) }), val: (p) => p.ends[1].t },
  ];
  const body = rows.map((r) => {
    const tr = htmlEl('tr');
    tr.append(htmlEl('th', { scope: 'row' }, r.label));
    for (const c of cols) {
      tr.append(htmlEl('td', { 'data-row': r.key, 'data-col': c, class: 'num' }, byCol[c] ? fmtMm(r.val(byCol[c])) : ''));
    }
    return tr;
  });
  table.tBodies[0].replaceChildren(...body);
}
