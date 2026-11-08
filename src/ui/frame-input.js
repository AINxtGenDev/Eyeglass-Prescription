// Frame section (02-04, FRAME-02, FRAME-03, D-10, D-11, D-12): the temple stamp is the first input
// and fills A and DBL; the shape is picked from radio cards; B follows the shape ratio until typed.
// Values outside the FRAME-02 ranges are Außerhalb des Modells and block both eyes, never clamped.
// Only parsed numbers are written back into fields (T-02-13); every visible string comes from t().
// 02-11 (FRAME-02): [Expert] Randtiefe. Display only: the rim depth is not part of the LensSpec
// (RESEARCH D-13 change), so changing it repaints the rim lines and never starts a compute job.
import { SHAPES } from '../engine/frame/shapes.js';
import { frameOutline } from '../engine/frame/outline.js';
import { parseMm, parseStamp, PARSE_CODES, STAMP_CODES } from '../state/parse.js';
import { estimateB } from '../state/frame.js';
import { validateFrame, validateRimDepth, TIERS } from '../state/validate.js';
import { RIM_DEPTH_DEFAULT_MM, bevelSplit, frontLeadMm } from '../engine/rim.js';
import { t } from '../i18n/t.js';
import { fmtMm } from '../i18n/format.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';
import { showFieldMessage, messageStatus, flushOnBlur } from './rx-input.js';
import { isExpert } from './expert.js';

const NS = 'http://www.w3.org/2000/svg';
const DEFAULT_SHAPE = 'rechteckig';
// The example stamp at load is "52□18 140" (UI-SPEC "Preset data"); the temple length is shown,
// never used in the computation.
const EXAMPLE_TEMPLE_MM = 140;
// Thumbnail outline points: frameOutline needs a multiple of 4; 72 is smooth at 64 × 40 px.
const THUMB_POINTS = 72;
const FIELDS = /** @type {const} */ (['A', 'B', 'DBL']);
const ID = { A: 'frame-a', B: 'frame-b', DBL: 'frame-dbl' };
const STAMP_ID = 'frame-stamp';
const SQUARE = '□';

const input = (id) => /** @type {HTMLInputElement} */ ($(id));
const isBlank = (id) => input(id).value.trim() === '';
const numNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1, useGrouping: false });

/** Sizes the user typed (or set through the stamp); the shape defaults never count. */
const userTyped = { A: false, B: false, DBL: false };
/** The sizes on screen come from a frame preset chip (02-09): they are not the user's own. */
let fromPreset = false;
/** The stamp text was typed by the user (false after we rewrote it from A and DBL). */
let stampTyped = false;
/** Bügellänge from the last valid stamp (shown in the echo only). */
let temple = EXAMPLE_TEMPLE_MM;
/** @type {(timeStamp: number) => void} */
let schedule = () => {};
/** @type {() => void} */
let onShown = () => {};
/** 03-07: the display-only inputs (rim depth, temple) changed; main.js wires refreshView. */
let onDisplayChange = () => {};
/** Last valid Expert rim depth (display only, 03-07). */
let rimDepthShown = RIM_DEPTH_DEFAULT_MM;
/** The last valid rim depth came from an empty field (the assumed default), 03-11. */
let rimAssumedShown = true;
/**
 * A protrusion or lead counts only when its shown 0,1 mm value is not 0,0 (fmtMm rounds 0,05 up),
 * else 'bündig'. Same rule as view/text.js PROTRUSION_FLUSH_MM (03-11; text.test.js asserts they
 * agree; not imported, so this module stays free of view imports).
 */
const RIM_FLUSH_MM = 0.05;

const stampText = (A, DBL, len) => `${numNf.format(A)}${SQUARE}${numNf.format(DBL)}${len === null ? '' : ' ' + len}`;

const RIM_ID = 'frame-rim';
const RIM_GLASS = { OD: 'result.glass.od', OS: 'result.glass.os' };
/** The painted main result per eye: { metrics, surfaces, frame } (null = no result). */
const rimPainted = { OD: null, OS: null };

/**
 * Rim lines from the painted result (pipeline.js, main lane, after renderResult). Nothing is
 * written while the switch is off; turning it on calls paintRim.
 * @param {'OD'|'OS'} eye
 * @param {{ metrics: object, surfaces: object, frame: { shape: string, A: number, B: number } }|null} painted
 *   LensResult.metrics and .surfaces of the painted result plus the frame of its spec
 */
export function renderRim(eye, painted) {
  rimPainted[eye] = painted;
  if (isExpert()) paintRim();
}

/** Paint both rim lines: empty field = the assumed default; an invalid field shows no line. */
export function paintRim() {
  const r = validateRimDepth(input(RIM_ID).value);
  showFieldMessage(RIM_ID, r.msg, { kind: 'mm', blocks: false, apply: null });
  const depth = r.msg ? null : (r.value ?? RIM_DEPTH_DEFAULT_MM);
  setText(`${RIM_ID}-echo`, depth === null ? '' : fmtMm(depth));
  let any = false;
  for (const eye of /** @type {const} */ (['OD', 'OS'])) {
    const p = rimPainted[eye];
    let text = '';
    let leadText = '';
    if (p && depth !== null) {
      const glass = t(RIM_GLASS[eye]);
      // D-05: front/back split of the thickest edge point by the assumed bevel rule. A side
      // counts only when the shown 0,1 mm value is not 0,0 (fmtMm rounds 0,05 up), else 'bündig'.
      const { front, back } = bevelSplit(p.metrics.etMax.value, depth);
      const f = front >= RIM_FLUSH_MM;
      const b = back >= RIM_FLUSH_MM;
      const key = f && b ? 'frame.rim.both' : f ? 'frame.rim.front' : b ? 'frame.rim.back' : 'frame.rim.fits';
      text = t(key, { glass, front: fmtMm(front), back: fmtMm(back) });
      // lens-critic MAJOR 1: the front surface can bulge ahead of the rim even when the edge is
      // flush at the front; same 0,05 mm threshold.
      const { shape, A, B } = p.frame;
      const lead = frontLeadMm(p.surfaces, frameOutline(shape, A, B, eye), depth).value;
      leadText = lead >= RIM_FLUSH_MM ? t('frame.rim.lead', { glass, lead: fmtMm(lead) }) : t('frame.rim.leadNone', { glass });
      any = true;
    }
    setText(`${RIM_ID}-result-${eye.toLowerCase()}`, text);
    setText(`${RIM_ID}-lead-${eye.toLowerCase()}`, leadText);
  }
  $(`${RIM_ID}-bevel`).hidden = !any;
}

/**
 * Display-only frame inputs for the 3D view (03-07, VIZ-02, D-06). They never enter a LensSpec.
 * - rimDepthMm: while the Experten-Ansicht is on, the valid field value (empty = the assumed
 *   default, as paintRim), else the last valid value; with the switch off the assumed default,
 *   like every other Expert field (readExpertOverrides is all null while off).
 * - templeMm: `temple` is set from every VALID stamp, including its null when that stamp has no
 *   temple; an invalid stamp being typed keeps the last valid one, and rewriteStamp() (A or DBL
 *   typed) keeps it in the text. So the rule is: the last valid stamp's temple → 'stamp'; a last
 *   valid stamp without one → templeMm null, 'assumed'; the lazy view chunk substitutes the
 *   engine's TEMPLE_DEFAULT_MM (importing engine/mesh/frame.js here would put the mesh builder
 *   into the entry bundle, +8 kB). The example stamp "52□18 140" at load counts as 'stamp'. The
 *   drawing may clamp it (engine TEMPLE_RANGE_MM); the view states that.
 * - rimAssumed (03-11): the rim depth is the assumed default (switch off, or the valid field value
 *   was empty), so the view states 'angenommener Wert'.
 * @returns {{ rimDepthMm: number, rimAssumed: boolean, templeMm: number | null, templeSource: 'stamp' | 'assumed' }}
 */
export function displayFrame() {
  let rimDepthMm = RIM_DEPTH_DEFAULT_MM;
  let rimAssumed = true;
  if (isExpert()) {
    const r = validateRimDepth(input(RIM_ID).value);
    if (!r.msg) {
      rimDepthShown = r.value ?? RIM_DEPTH_DEFAULT_MM;
      rimAssumedShown = r.value == null;
    }
    rimDepthMm = rimDepthShown;
    rimAssumed = rimAssumedShown;
  }
  return temple === null
    ? { rimDepthMm, rimAssumed, templeMm: null, templeSource: 'assumed' }
    : { rimDepthMm, rimAssumed, templeMm: temple, templeSource: 'stamp' };
}

/** Selected id, guarded to a SHAPES key (T-01-21). */
export function currentShape() {
  const el = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name=frame-shape]:checked'));
  const id = el?.value ?? '';
  return Object.hasOwn(SHAPES, id) ? id : DEFAULT_SHAPE;
}

/** Keep the stamp in step with A and DBL (UI-SPEC "Stamp entry"); only parsed numbers. */
function rewriteStamp() {
  const a = parseMm(input(ID.A).value);
  const d = parseMm(input(ID.DBL).value);
  if (!a.ok || !d.ok) return;
  const text = stampText(a.value, d.value, temple);
  if (input(STAMP_ID).value !== text) input(STAMP_ID).value = text;
  stampTyped = false;
}

/** Fill A/B/DBL with the shape's typical values; they count as not typed. */
function prefillFrame(shape) {
  const d = SHAPES[shape].defaults;
  for (const f of FIELDS) {
    input(ID[f]).value = String(d[f]);
    userTyped[f] = false;
  }
  rewriteStamp();
}

/** One SVG thumbnail of the outline at the shape's default size, OD, y up. */
function thumbnail(shape) {
  const d = SHAPES[shape].defaults;
  const pts = frameOutline(shape, d.A, d.B, 'OD', THUMB_POINTS);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const parts = [];
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i];
    const y = -pts[i + 1]; // SVG y points down
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const pad = 2;
  const svg = document.createElementNS(NS, 'svg');
  const attrs = {
    class: 'shape-thumb',
    width: 64,
    height: 40,
    viewBox: `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${(maxX - minX + 2 * pad).toFixed(2)} ${(maxY - minY + 2 * pad).toFixed(2)}`,
    'aria-hidden': 'true',
    focusable: 'false',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  const path = document.createElementNS(NS, 'path');
  // vector-effect keeps the stroke 2 px whatever the mm-sized viewBox scale is.
  const pathAttrs = { d: parts.join('') + 'Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' };
  for (const [k, v] of Object.entries(pathAttrs)) path.setAttribute(k, String(v));
  svg.append(path);
  return svg;
}

/** Four radio cards, built once at init: outlines are never recomputed per keystroke. */
function buildShapeCards() {
  const box = /** @type {HTMLElement} */ (document.querySelector('#frame-shape .shape-cards'));
  for (const id of Object.keys(SHAPES)) {
    const label = document.createElement('label');
    label.className = 'radio-card';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'frame-shape';
    radio.value = id;
    radio.checked = id === DEFAULT_SHAPE;
    const name = document.createElement('span');
    name.className = 'radio-card-name';
    name.textContent = t('frame.shape.' + id);
    label.append(radio, thumbnail(id), icon('check'), name);
    box.append(label);
  }
}

/** Our own drawing of a temple with the stamp in a magnifier (D-12); never a third-party image. */
function buildStampFigure() {
  const el = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = el('svg', {
    viewBox: '0 0 320 120',
    width: '100%',
    role: 'img',
    'aria-labelledby': 'frame-stamp-svg-title frame-stamp-svg-desc',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
  });
  const label = { fill: 'currentColor', stroke: 'none', 'font-size': 12 };
  svg.append(
    el('title', { id: 'frame-stamp-svg-title' }, t('stamp.svg.title')),
    el('desc', { id: 'frame-stamp-svg-desc' }, t('stamp.svg.desc')),
    // The temple: a straight bar with the bent end piece behind the ear.
    el('rect', { x: 8, y: 14, width: 262, height: 14, rx: 7 }),
    el('path', { d: 'M270 21 C292 21 304 30 310 48', 'stroke-linecap': 'round' }),
    el('text', { x: 160, y: 24, 'text-anchor': 'middle', 'font-size': 7, fill: 'currentColor', stroke: 'none' }, '52□18 140'),
    // The magnifier over the stamp, with the enlarged numbers.
    el('circle', { cx: 160, cy: 70, r: 44, 'stroke-width': 3 }),
    el('path', { d: 'M129 103 L112 118', 'stroke-width': 6, 'stroke-linecap': 'round' }),
    el('text', { x: 134, y: 75, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: 'currentColor', stroke: 'none' }, '52'),
    el('text', { x: 149, y: 75, 'text-anchor': 'middle', 'font-size': 14, fill: 'currentColor', stroke: 'none' }, SQUARE),
    el('text', { x: 163, y: 75, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: 'currentColor', stroke: 'none' }, '18'),
    el('text', { x: 190, y: 75, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: 'currentColor', stroke: 'none' }, '140'),
    // Three callouts.
    el('path', { d: 'M131 80 L96 104', 'stroke-width': 1.5 }),
    el('text', { ...label, x: 94, y: 114, 'text-anchor': 'end' }, t('stamp.svg.a')),
    el('path', { d: 'M164 80 L222 104', 'stroke-width': 1.5 }),
    el('text', { ...label, x: 224, y: 114 }, t('stamp.svg.dbl')),
    el('path', { d: 'M192 62 L222 46', 'stroke-width': 1.5 }),
    el('text', { ...label, x: 224, y: 46 }, t('stamp.svg.temple')),
  );
  $('frame-stamp-svg').replaceChildren(svg);
}

/** "Wo finde ich das?" (APG disclosure): the figure is built on first open. */
function initStampHelp() {
  const btn = $('frame-stamp-help');
  const figure = $('frame-stamp-figure');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (open && $('frame-stamp-svg').childElementCount === 0) buildStampFigure();
    btn.setAttribute('aria-expanded', String(open));
    figure.hidden = !open;
  });
}

/** The stamp was typed: a valid one writes A and DBL (once, no synthetic input events). */
function onStampInput(e) {
  stampTyped = true;
  fromPreset = false;
  const r = parseStamp(input(STAMP_ID).value);
  if (r.ok) {
    input(ID.A).value = String(r.A);
    input(ID.DBL).value = String(r.DBL);
    userTyped.A = true;
    userTyped.DBL = true;
    temple = r.temple;
  }
  schedule(e.timeStamp);
  onDisplayChange();
}

/** The stamp message: a Fehler, or the swapped-numbers Hinweis with its apply text. Both block. */
function stampMessage() {
  if (!stampTyped) return { m: null, apply: null };
  const r = parseStamp(input(STAMP_ID).value);
  if (r.ok || r.code === PARSE_CODES.PARSE_EMPTY) return { m: null, apply: null };
  if (r.code === STAMP_CODES.STAMP_SWAPPED) {
    return { m: { tier: TIERS.HINT, code: r.code, data: r.data }, apply: stampText(r.data.A, r.data.DBL, r.data.temple) };
  }
  return { m: { tier: TIERS.ERROR, code: STAMP_CODES.STAMP_INVALID, data: {} }, apply: null };
}

function stampEcho() {
  const r = parseStamp(input(STAMP_ID).value);
  if (!r.ok) return '';
  const params = { A: fmtMm(r.A), DBL: fmtMm(r.DBL) };
  return r.temple === null ? t('stamp.echo', params) : t('stamp.echoTemple', { ...params, temple: fmtMm(r.temple) });
}

/**
 * The first frame field whose message blocks both eyes, and whether a blocking message is not on
 * screen yet. Read fresh from the message states, so a message that appeared after the pause counts.
 */
export function frameStatus() {
  let firstBlockedFieldId = null;
  let pendingMessage = false;
  for (const id of [STAMP_ID, ID.A, ID.B, ID.DBL]) {
    const st = messageStatus(id);
    if (!st.blocks) continue;
    firstBlockedFieldId ??= id;
    if (st.pending) pendingMessage = true;
  }
  return { firstBlockedFieldId, pendingMessage };
}

/**
 * Read the frame: echo now, messages after the pause (shared debounce with the Rx fields).
 * B follows estimateB(shape, A) while the user has not typed it; the estimate is written into the
 * field unless the user emptied it or the field has focus.
 * @returns {{
 *   frame: null | { shape: string, A: number, B: number, DBL: number },
 *   bEstimated: boolean, B: number | null,
 *   blocked: boolean, firstBlockedFieldId: string | null, pendingMessage: boolean,
 * }}
 */
export function readFrame() {
  const shape = currentShape();
  const msgs = {};
  const values = {};
  for (const f of ['A', 'DBL']) {
    const r = parseMm(input(ID[f]).value);
    values[f] = r.ok ? r.value : null;
    msgs[f] = r.ok ? null : { tier: TIERS.ERROR, code: r.code, data: {} };
  }
  const bEstimated = !userTyped.B;
  msgs.B = null;
  if (bEstimated) {
    values.B = values.A === null ? null : estimateB(shape, values.A);
    const b = input(ID.B);
    // Never rewrite the field while it has focus: the user may be about to type into it, and a
    // write between select-all and typing would merge the texts ("45" + "55" → "4555").
    const write = values.B !== null && !isBlank(ID.B) && b.value !== String(values.B) && document.activeElement !== b;
    if (write) b.value = String(values.B);
  } else {
    const r = parseMm(input(ID.B).value);
    values.B = r.ok ? r.value : null;
    if (!r.ok) msgs.B = { tier: TIERS.ERROR, code: r.code, data: {} };
  }
  const ranges = validateFrame(values);
  for (const f of FIELDS) msgs[f] ??= ranges[f];

  setText('frame-stamp-echo', stampEcho());
  setText('frame-a-echo', values.A === null ? '' : fmtMm(values.A));
  setText('frame-dbl-echo', values.DBL === null ? '' : fmtMm(values.DBL));
  setText('frame-b-echo', values.B === null ? '' : bEstimated ? t('frame.bEstimated', { B: fmtMm(values.B) }) : fmtMm(values.B));

  const stamp = stampMessage();
  showFieldMessage(STAMP_ID, stamp.m, { kind: 'mm', blocks: stamp.m !== null, apply: stamp.apply, shown: onShown });
  for (const f of FIELDS) showFieldMessage(ID[f], msgs[f], { kind: 'mm', apply: null, shown: onShown });

  // "Standardmaße übernehmen": only when typed sizes differ from the shape's defaults (D-10).
  const d = SHAPES[shape].defaults;
  const typed = FIELDS.some((f) => userTyped[f]);
  const differs = FIELDS.some((f) => values[f] !== d[f]);
  const btn = $('frame-defaults');
  btn.hidden = !(typed && differs);
  setText('frame-defaults', t('frame.defaults', { A: String(d.A), B: String(d.B), DBL: String(d.DBL) }));

  const { firstBlockedFieldId, pendingMessage } = frameStatus();
  const complete = FIELDS.every((f) => values[f] !== null);
  const blocked = firstBlockedFieldId !== null || !complete;
  return {
    frame: blocked ? null : { shape, A: values.A, B: values.B, DBL: values.DBL },
    bEstimated,
    B: values.B,
    blocked,
    firstBlockedFieldId,
    pendingMessage,
  };
}

/** The user's own sizes are on screen: A, B or DBL typed (or set by the stamp), not by a preset. */
export function frameSizesTyped() {
  return !fromPreset && FIELDS.some((f) => userTyped[f]);
}

/**
 * A frame preset (02-09): write A and DBL, keep the shape, let B follow the shape again
 * ("geschätzt aus der Form"), then run one input frame through the A field's own handler, which
 * also rewrites the stamp. Only parsed numbers are written (T-02-13).
 * @param {string} A @param {string} DBL field text of the preset
 */
export function applyFrameSizes(A, DBL) {
  const a = parseMm(A);
  const d = parseMm(DBL);
  if (!a.ok || !d.ok) return;
  input(ID.DBL).value = String(d.value);
  userTyped.DBL = true;
  userTyped.B = false;
  input(ID.B).value = String(estimateB(currentShape(), a.value));
  input(ID.A).value = String(a.value);
  input(ID.A).dispatchEvent(new Event('input', { bubbles: true }));
  fromPreset = true;
}

/**
 * Build the cards, fill the example frame and wire the inputs.
 * @param {{ schedule: (timeStamp: number) => void, onMessageShown: () => void, onDisplayChange?: () => void }} hooks
 */
export function initFrameInput(hooks) {
  schedule = hooks.schedule;
  onShown = hooks.onMessageShown;
  onDisplayChange = hooks.onDisplayChange ?? (() => {});
  buildShapeCards();
  prefillFrame(DEFAULT_SHAPE);
  initStampHelp();
  input(STAMP_ID).addEventListener('input', onStampInput);
  for (const f of FIELDS) {
    input(ID[f]).addEventListener('input', (e) => {
      // An emptied B goes back to the estimate; A and DBL stay typed.
      userTyped[f] = f === 'B' ? !isBlank(ID.B) : true;
      fromPreset = false;
      if (f !== 'B') rewriteStamp();
      schedule(e.timeStamp);
    });
  }
  for (const id of [STAMP_ID, ID.A, ID.B, ID.DBL, RIM_ID]) flushOnBlur(id);
  setText('frame-rim-note', t('frame.rim.note', { value: fmtMm(RIM_DEPTH_DEFAULT_MM) }));
  // No schedule: the rim depth changes no spec (no compute job, no 'rechnet …').
  input(RIM_ID).addEventListener('input', () => {
    paintRim();
    onDisplayChange(); // 03-07: the 3D frame follows the rim depth (display only)
  });
  document.querySelector('#frame-shape').addEventListener('change', (e) => {
    if (!FIELDS.some((f) => userTyped[f])) prefillFrame(currentShape());
    schedule(e.timeStamp);
  });
  $('frame-defaults').addEventListener('click', (e) => {
    prefillFrame(currentShape());
    input(ID.A).focus();
    schedule(e.timeStamp);
  });
}
