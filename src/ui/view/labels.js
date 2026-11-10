// Projected HTML labels over the 3D stage (03-06, VIZ-01; UI-SPEC States). A fixed pool of
// .view-label spans in #view-labels (aria-hidden: the cards carry the same facts as text).
// CSP / T-03-49: spans are made with createElement and filled with textContent; the position is a
// CSSOM transform write (element.style.transform), never a style attribute or markup.
// The pool holds the eye labels R / L (or '{eye} – nicht berechnet'); 03-13 adds the Dickenkarte
// callouts and iso labels with collision priority (below).
import { Vector3 } from 'three';
import { t } from '../../i18n/t.js';
import { fmtMm, fmtIsoValue } from '../../i18n/format.js';
import { isoLabelPoints } from '../../engine/mesh/heat.js';
import { frontSagAt } from '../../engine/design.js';
import { layoutLabels, LABEL_GAP_PX } from './label-layout.js';

/**
 * @param {HTMLElement} container
 * @param {number} count pool size
 */
export function createLabels(container, count) {
  /** @type {HTMLSpanElement[]} */
  const pool = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'view-label';
    el.hidden = true;
    container.append(el);
    pool.push(el);
  }
  return {
    pool,
    /** Set a label's text (no write when unchanged); '' hides it, place() shows it. */
    setText(i, text) {
      const el = pool[i];
      if (el.textContent !== text) el.textContent = text;
      if (text === '') el.hidden = true;
    },
  };
}

const v = new Vector3();

/**
 * Project a world point to the stage and move the span there: the span's top edge is centred on
 * the point. Hidden when the point is outside the view volume or the span has no text.
 * 03-09: the span is kept inside the stage (shifted, never clipped). With the closer A1 default
 * fit a wide label such as 'L – nicht berechnet' under an outer lens would otherwise stick out of
 * a 328 px phone stage, which clips it (overflow: hidden).
 * @param {HTMLElement} el
 * @param {{ x: number, y: number, z: number }} world
 * @param {import('three').Camera} camera
 * @param {{ width: number, height: number }} size stage size in CSS px
 * @returns {boolean} whether the label is shown
 */
export function place(el, world, camera, size) {
  v.set(world.x, world.y, world.z).project(camera);
  const inside = Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && Math.abs(v.z) <= 1;
  el.hidden = !inside || el.textContent === '';
  if (el.hidden) return false;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = Math.min(Math.max(((v.x + 1) / 2) * size.width - w / 2, 0), Math.max(0, size.width - w));
  const y = Math.min(((1 - v.y) / 2) * size.height, Math.max(0, size.height - h));
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  return true;
}

// ---- 03-13 (VIZ-05, D-22 as amended, lens-critic MAJOR 4, round 2 MINOR 5/6): Dickenkarte labels.
// One fixed pool (CALLOUT_KEYS.length callouts with a marker dot each, ISO_MAX iso labels), made
// once, so repeated Glas ↔ Dickenkarte switches and eye changes never add DOM nodes.
// - Texts: every callout is fmtMm of a heatCallouts value (the same engine values as the table,
//   D-04e); every iso label is fmtIsoValue of an isoLevels value. Nothing is re-sampled here.
// - Anchors: lens-local engine points on the front surface (z = −frontSagAt, position only),
//   moved by the lens group's position and projected with Vector3.project on every render.
// - Sizes: measured (offsetWidth / offsetHeight) only when a text changes, never per frame.
// - Per frame: layoutLabels (label-layout.js) and CSSOM transform writes. The per-frame path never
//   writes #view-callout-note; settleNote() does, at settle points only (MINOR 5).
// - ?calloutsoff (test only, read once like ?perfmarks): calloutsFit is forced false, so the
//   table-only state shows at any width (MINOR 6). Presentation only, never a number.

const CALLOUT_KEYS = /** @type {const} */ (['centre', 'nasal', 'temporal', 'superior', 'inferior', 'thickest']);
/** isoLevels gives at most 8 lines (engine MAX_LINES). */
const ISO_MAX = 8;
/** Callout marker diameter (UI-SPEC: 8 px outer) [BP]. */
const DOT_PX = 8;
const CALLOUTS_OFF = location.search.includes('calloutsoff');

/** @type {Map<HTMLElement, { text: string, w: number, h: number }>} */
const sizes = new Map();
/** The element's box size, measured again only after its text changed (or while it was 0). */
function sizeOf(el) {
  const c = sizes.get(el);
  if (c && c.text === el.textContent && c.w > 0) return c;
  const wasHidden = el.hidden;
  el.hidden = false;
  const s = { text: el.textContent ?? '', w: el.offsetWidth, h: el.offsetHeight };
  el.hidden = wasHidden;
  sizes.set(el, s);
  return s;
}

/** Move an element (no write when unchanged). */
function moveTo(el, x, y) {
  const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  if (el.style.transform !== tf) el.style.transform = tf;
  if (el.hidden) el.hidden = false;
}
const hide = (el) => {
  if (!el.hidden) el.hidden = true;
};

// 03-14 (RES-03, D-25, lens-critic round 2 MINOR 4): two label sets with the same fixed pool, 'B'
// (the main lenses, used outside a comparison too) and 'A' (Vorher, compare Dickenkarte only).
// In a split comparison each half is laid out inside its own half bounds, and the all-or-nothing
// rule is decided ONCE across both halves: if either half cannot fit all its callouts, neither
// half shows a callout (one #view-callout-note). Set A's nodes carry data-half="A"; set B's carry
// data-half="B" only while split.

/**
 * @typedef {{ callouts: Array<{ pill: HTMLSpanElement, dot: HTMLSpanElement }>, isos: HTMLSpanElement[],
 *   active: boolean, group: { position: { x: number, y: number, z: number } } | null,
 *   points: { callouts: Array<{ key: string, local: { x: number, y: number, z: number } } | null>,
 *     isos: Array<{ local: { x: number, y: number, z: number } } | null> } }} HeatSet
 * @type {null | { note: HTMLElement, sets: { A: HeatSet, B: HeatSet }, calloutsFit: boolean,
 *   avoid: Array<{ x: number, y: number, w: number, h: number }> }}
 */
let heat = null;

/**
 * Create the Dickenkarte label pools (sets B and A) in #view-labels.
 * @param {HTMLElement} container #view-labels
 * @param {HTMLElement} note #view-callout-note (role=status)
 */
export function initHeatLabels(container, note) {
  const makeSet = (half) => {
    const span = (cls) => {
      const el = document.createElement('span');
      el.className = cls;
      el.hidden = true;
      if (half) el.dataset.half = half;
      container.append(el);
      return el;
    };
    const callouts = CALLOUT_KEYS.map((key) => {
      const dot = span('view-dot');
      const pill = span('view-label view-label--callout');
      pill.dataset.key = key;
      return { pill, dot };
    });
    const isos = Array.from({ length: ISO_MAX }, () => span('view-label view-label--iso'));
    return { callouts, isos, active: false, group: null, points: { callouts: [], isos: [] } };
  };
  heat = { note, sets: { B: makeSet(null), A: makeSet('A') }, calloutsFit: true, avoid: [], corner: null, cornerLow: false };
}

/**
 * Set the callouts and iso labels of one lens (text-change path: once per delivery, eye or mode
 * change, never per frame).
 * @param {{ eye: 'OD' | 'OS', lens: { surfaces: object, frame: object, eye: 'OD' | 'OS' }, metrics: object,
 *   callouts: ReturnType<typeof import('../../engine/mesh/heat.js').heatCallouts>,
 *   levels: { values: number[] }, group: { position: { x: number, y: number, z: number } } }} o
 *   group = the eye's lens group (its position is read on every render: DBL and the frame's z), or
 *   in a comparison an object whose position is the recentred lens position (compare3d.js)
 * @param {'A' | 'B'} [which] the label set (03-14; default B, the main lenses)
 */
export function setHeatLabels({ lens, metrics, callouts, levels, group }, which = 'B') {
  if (!heat) return;
  const set = heat.sets[which];
  const s = lens.surfaces;
  const at = (p) => ({ x: p.x, y: p.y, z: -frontSagAt(s, p.x, p.y) });
  const th = callouts.thickest;
  set.points.callouts = CALLOUT_KEYS.map((key, i) => {
    const { pill } = set.callouts[i];
    let text = '';
    let p = null;
    if (key === 'thickest') {
      if (th.merge === null && th.where === 'edge') {
        text = t('view.callout.thickest', { mm: fmtMm(th.t) });
        p = th;
      }
    } else if (key === 'centre' || callouts.ok) {
      const c = callouts[key];
      text = th.merge === key ? t('view.callout.thickestSuffix', { mm: fmtMm(c.t) }) : fmtMm(c.t);
      p = c;
    }
    if (pill.textContent !== text) pill.textContent = text;
    return p ? { key, local: at(p) } : null;
  });
  const pts = isoLabelPoints(lens, metrics, levels.values, callouts);
  set.points.isos = set.isos.map((el, i) => {
    const p = i < pts.length ? pts[i] : null;
    const text = p ? fmtIsoValue(levels.values[i]) : '';
    if (el.textContent !== text) el.textContent = text;
    return p ? { local: at(p) } : null;
  });
  set.group = group;
  set.active = true;
}

/**
 * Hide every heat label of one set, or of both (leave Dickenkarte, no drawable heat eye).
 * @param {'A' | 'B'} [which] default both
 */
export function clearHeatLabels(which) {
  if (!heat) return;
  for (const name of which ? [which] : ['A', 'B']) {
    const set = heat.sets[name];
    set.active = false;
    set.points = { callouts: [], isos: [] };
    for (const c of set.callouts) hide(c.pill), hide(c.dot);
    for (const el of set.isos) hide(el);
  }
}

/**
 * Boxes in stage px that no label may cover (the badge, the keyboard hint while shown), and the
 * fullscreen button's two places (2026-11-10): top-right by default, bottom-right only when the
 * callouts fit there and not with the button at the top (a narrow phone stage, a wide font).
 * @param {Array<{ x: number, y: number, w: number, h: number }>} boxes
 * @param {{ top: { x: number, y: number, w: number, h: number }, low: { x: number, y: number, w: number, h: number } } | null} [corner]
 */
export function setLabelAvoid(boxes, corner = null) {
  if (heat) {
    heat.avoid = boxes;
    heat.corner = corner;
  }
}

const pv = new Vector3();
/** Project a world point to stage px; NaN when outside the view volume (behind the camera). */
function toStage(x, y, z, camera, size) {
  pv.set(x, y, z).project(camera);
  if (!(Math.abs(pv.x) <= 1 && Math.abs(pv.y) <= 1 && Math.abs(pv.z) <= 1)) return { x: NaN, y: NaN };
  return { x: ((pv.x + 1) / 2) * size.width, y: ((1 - pv.y) / 2) * size.height };
}

/**
 * Project one set's anchors with the camera as it is now (03-14: compare3d sets the half aspect
 * first) into layout items. Returns null when the set is not active.
 * @param {'A' | 'B'} which
 * @param {import('three').Camera} camera
 * @param {{ width: number, height: number }} size the (half) stage size in CSS px
 * @param {Array<{ el: HTMLElement, world: { x: number, y: number, z: number } | null }>} eyes eye labels
 */
export function prepareHeatLabels(which, camera, size, eyes) {
  const set = heat?.sets[which];
  if (!set?.active || !set.group) return null;
  const g = set.group.position;
  const proj = (l) => toStage(g.x + l.x, g.y + l.y, g.z + l.z, camera, size);
  /** @type {import('./label-layout.js').LabelItem[]} */
  const items = [];
  const els = new Map();
  const centre = set.points.callouts[0] ? proj(set.points.callouts[0].local) : { x: NaN, y: NaN };
  set.points.callouts.forEach((p, i) => {
    if (!p) return;
    const { pill } = set.callouts[i];
    const a = proj(p.local);
    const { w, h } = sizeOf(pill);
    let dx = a.x - centre.x;
    let dy = a.y - centre.y;
    const len = Math.hypot(dx, dy);
    let offset;
    if (p.key === 'centre' || !(len > 1)) offset = { dx: LABEL_GAP_PX + w / 2, dy: LABEL_GAP_PX + h / 2 }; // Mitte: below-right
    else {
      dx /= len;
      dy /= len;
      const d = LABEL_GAP_PX + (Math.abs(dx) * w) / 2 + (Math.abs(dy) * h) / 2;
      offset = { dx: dx * d, dy: dy * d };
    }
    const id = `c${i}`;
    items.push({ id, priority: 0, order: i, anchor: a, size: { w, h }, offset, dot: DOT_PX });
    els.set(id, { el: pill, dot: set.callouts[i].dot, anchor: a });
  });
  eyes.forEach((e, i) => {
    if (!e.world || e.el.textContent === '') return;
    const { w, h } = sizeOf(e.el);
    const id = `e${i}`;
    // The eye label's top edge is centred on its anchor (as in place()).
    items.push({ id, priority: 1, order: i, anchor: toStage(e.world.x, e.world.y, e.world.z, camera, size), size: { w, h }, offset: { dx: 0, dy: h / 2 } });
    els.set(id, { el: e.el });
  });
  set.points.isos.forEach((p, i) => {
    if (!p) return;
    const el = set.isos[i];
    const { w, h } = sizeOf(el);
    const id = `i${i}`;
    items.push({ id, priority: 2, order: i, anchor: proj(p.local), size: { w, h }, offset: { dx: 0, dy: 0 } });
    els.set(id, { el });
  });
  return { which, set, items, els, size, eyes };
}

/**
 * Lay out prepared sets and write the transforms (03-14: one call for both halves). The callout
 * decision is made once across all parts: if any part cannot fit its callouts, every part is
 * laid out again without callouts (round 2 MINOR 4). Never writes the note.
 * @param {Array<{ prep: ReturnType<typeof prepareHeatLabels>, offsetX?: number, half?: 'A' | 'B' | null,
 *   avoid?: Array<{ x: number, y: number, w: number, h: number }> }>} parts
 *   offsetX = the part's left edge in the stage; avoid = extra stage boxes (the A/B captions)
 */
export function commitHeatLabels(parts) {
  if (!heat) return;
  const live = parts.filter((p) => p.prep);
  const run = (part, withCallouts, corner) => {
    const { items, size } = part.prep;
    const ox = part.offsetX ?? 0;
    // Stage boxes in this part's own coordinates; boxes outside it never collide.
    const avoid = [...heat.avoid, ...(corner ? [corner] : []), ...(part.avoid ?? [])].map((b) => ({ ...b, x: b.x - ox }));
    // ?calloutsoff: the callouts are left out as if they did not fit (MINOR 6).
    const use = withCallouts && !CALLOUTS_OFF ? items : items.filter((it) => it.priority !== 0);
    return layoutLabels(use, { w: size.width, h: size.height, avoid });
  };
  const top = heat.corner?.top ?? null;
  let laid = live.map((p) => run(p, true, top));
  let fit = !CALLOUTS_OFF && laid.every((l) => l.calloutsFit);
  let low = false;
  if (!fit && !CALLOUTS_OFF && heat.corner) {
    // The button yields its corner to the callouts if they fit with it at the bottom instead.
    const alt = live.map((p) => run(p, true, heat.corner.low));
    if (alt.every((l) => l.calloutsFit)) [laid, fit, low] = [alt, true, true];
  }
  if (!fit && live.length > 1) laid = live.map((p) => run(p, false, top));
  heat.calloutsFit = fit;
  heat.cornerLow = low;
  const shown = new Set();
  live.forEach((part, k) => {
    const ox = part.offsetX ?? 0;
    const half = part.half ?? null;
    for (const [id, q] of part.prep.els) {
      const p = laid[k].placed.get(id);
      if (!p) continue;
      moveTo(q.el, p.x + ox, p.y);
      setHalf(q.el, half);
      shown.add(q.el);
      if (q.dot) moveTo(q.dot, q.anchor.x + ox - DOT_PX / 2, q.anchor.y - DOT_PX / 2), setHalf(q.dot, half), shown.add(q.dot);
    }
  });
  for (const set of Object.values(heat.sets)) {
    for (const c of set.callouts) for (const el of [c.pill, c.dot]) if (!shown.has(el)) hide(el);
    for (const el of set.isos) if (!shown.has(el)) hide(el);
  }
  for (const part of live) for (const e of part.prep.eyes) if (!shown.has(e.el)) hide(e.el);
}

/** data-half on a placed node: set A always carries 'A'; set B carries 'B' only while split. */
function setHalf(el, half) {
  if (el.dataset.half === 'A') return;
  if (half === 'B') {
    if (el.dataset.half !== 'B') el.dataset.half = 'B';
  } else if (el.dataset.half !== undefined) delete el.dataset.half;
}

/**
 * Per-render layout in Dickenkarte (afterRender) outside a comparison: set B over the whole stage
 * with the given eye labels. Never writes the note.
 * @param {import('three').Camera} camera
 * @param {{ width: number, height: number }} size stage size in CSS px
 * @param {Array<{ el: HTMLElement, world: { x: number, y: number, z: number } | null }>} eyes eye labels
 */
export function layoutHeatLabels(camera, size, eyes) {
  const prep = prepareHeatLabels('B', camera, size, eyes);
  if (!prep) return;
  commitHeatLabels([{ prep }]);
}

/**
 * Settle point (MINOR 5): write #view-callout-note from the latest layout, only when it changes.
 * view.js calls this after OrbitControls 'end' (and damping settled), a preset tween end, a
 * keyboard step, and eye, mode, text or size changes, never per frame. The note is a role=status
 * region that stays in the DOM; its text is '' while the callouts fit (CSS :empty hides it).
 */
export function settleNote() {
  if (!heat) return;
  const active = heat.sets.A.active || heat.sets.B.active;
  const text = active && !heat.calloutsFit ? t('view.callout.tableOnly') : '';
  if (heat.note.textContent !== text) heat.note.textContent = text;
}

/** Whether the last Dickenkarte layout moved the fullscreen button to the bottom-right corner. */
export const cornerLow = () => heat !== null && heat.cornerLow && (heat.sets.A.active || heat.sets.B.active);

/** Test handle: whether the callouts fit in the last layout (false under ?calloutsoff). */
export const calloutsFit = () => heat?.calloutsFit ?? true;
