// Rx table (02-03, RX-01, RX-04, RX-05, RX-07): raw field text → validateRxEye → echo, cylinder
// forms and tiered field messages. Only the message display is debounced (600 ms pause or blur);
// the caller sends the compute request every input frame (RESEARCH Pitfall 5).
// Every visible string comes from t() and is written as text, never as markup (T-02-09).
import { parseDiopter, parseAxis, parseMm } from '../state/parse.js';
import { transpose, RX_CODES } from '../state/transpose.js';
import { validateRxEye, resolvePd, TIERS, VAL_CODES } from '../state/validate.js';
import { createDebouncer } from '../state/debounce.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtAxis, fmtMm } from '../i18n/format.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const FIELDS = /** @type {const} */ (['sph', 'cyl', 'axis', 'pd']);
// "Gleich für beide Augen" mirrors Sph, Zyl and Achse only; PD stays per eye (RESEARCH Pitfall 9).
const MIRRORED = ['sph', 'cyl', 'axis'];
const MIRROR_NOTE = 'rx-mirror-note';
const TIER_ICON = { [TIERS.ERROR]: 'error', [TIERS.HINT]: 'hint', [TIERS.OUT]: 'outside' };
const TIER_CLASS = { [TIERS.ERROR]: 'msg-error', [TIERS.HINT]: 'msg-hint', [TIERS.OUT]: 'msg-out' };
// Every minus form parseDiopter accepts (U+2212, U+2012, U+2013, U+2010, U+FE63, U+FF0D, '-').
const LEADING_MINUS = /^\s*[-−‒–‐﹣－]\s*/;

const input = (id) => /** @type {HTMLInputElement} */ ($(id));
const fieldId = (eye, f) => `rx-${eye.toLowerCase()}-${f}`;
const isBlank = (id) => input(id).value.trim() === '';
const blocking = (m) => m !== null && m.tier !== TIERS.HINT;
/** "−2,25" (no unit): what the sign and apply buttons write into a field. */
const bare = (v) => fmtDiopter(v).replace(/\u00A0dpt$/, '');

/** "Sph / Zyl × Achse" for one cylinder form. */
export const fmtForm = (f) => `${fmtDiopter(f.sph)} / ${fmtDiopter(f.cyl)} × ${fmtAxis(f.axisDeg)}`;

/** Mark a field valid and show its echo (may be empty). Used by the frame fields. */
function showFieldOk(id, echo) {
  setText(`${id}-echo`, echo);
  const err = $(`${id}-err`);
  err.replaceChildren();
  err.hidden = true;
  $(id).removeAttribute('aria-invalid');
}

/** Mark a field invalid with a German message; the icon replaces the old CSS '⚠' glyph. */
function showFieldError(id, message) {
  setText(`${id}-echo`, '');
  const err = $(`${id}-err`);
  if (err.textContent !== message) err.replaceChildren(icon('error'), message);
  err.hidden = false;
  $(id).setAttribute('aria-invalid', 'true');
}

/** Parse one field, show echo or error at once; returns the value or null. Frame fields only. */
function readField(id, parse, format) {
  const r = parse(input(id).value);
  if (r.ok) {
    showFieldOk(id, format(r.value));
    return r.value;
  }
  showFieldError(id, t('parse.' + r.code));
  return null;
}

/** A/B/DBL in mm (frame fields keep the immediate phase-1 messages until 02-04). */
export const readMmField = (id) => readField(id, parseMm, fmtMm);

/** German text of a field message; params are formatted numbers only (T-02-09). */
function messageText(m, field) {
  const d = m.data;
  if (Object.hasOwn(VAL_CODES, m.code)) {
    const fmt = field === 'pd' ? fmtMm : fmtDiopter;
    const params = {};
    if (Number.isFinite(d.suggestion)) params.suggestion = fmtDiopter(d.suggestion);
    for (const k of ['value', 'min', 'max']) if (Number.isFinite(d[k])) params[k] = fmt(d[k]);
    if (Number.isFinite(d.typed)) params.typed = fmtDiopter(d.typed);
    let text = t('val.' + m.code, params);
    // Plus cylinder: the Sph range was checked on the minus form, so name what was typed.
    if (m.code === VAL_CODES.VAL_SPH_OUT_OF_MODEL && d.typed && d.typed.cyl > 0) {
      text += ' ' + t('val.transposedSuffix', { typed: fmtForm(d.typed) });
    }
    if (d.contactLens) text += ' ' + t('val.contactLensSuffix');
    return text;
  }
  if (Object.hasOwn(RX_CODES, m.code)) return t('rx.' + m.code);
  return t('parse.' + m.code);
}

/** Write one field's message slot: tier label + icon, text, and the "übernehmen" button. */
function paintMessage(id, m, field) {
  const err = $(`${id}-err`);
  const el = input(id);
  if (m === null) {
    err.replaceChildren();
    err.className = 'msg';
    err.hidden = true;
    el.removeAttribute('aria-invalid');
    return;
  }
  const label = document.createElement('strong');
  label.className = 'msg-label';
  label.append(icon(TIER_ICON[m.tier]), t('val.tier.' + m.tier));
  const text = document.createElement('span');
  text.textContent = ' ' + messageText(m, field);
  const parts = [label, text];
  // "Meinten Sie …?": writes the suggestion only after a click (T-02-10); not into a mirrored field.
  if (m.tier === TIERS.HINT && Number.isFinite(m.data.suggestion) && !el.readOnly) {
    const value = bare(m.data.suggestion);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'apply';
    apply.textContent = t('val.apply', { suggestion: value });
    apply.addEventListener('click', () => {
      el.value = value;
      el.focus();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    parts.push(apply);
  }
  err.className = 'msg ' + TIER_CLASS[m.tier];
  err.replaceChildren(...parts);
  err.hidden = false;
  if (blocking(m)) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

/**
 * Per Rx field: the message wanted now (want/wantSig), the one on screen (shownSig, '' = none)
 * and the pause timer. key = sig + raw text, so a keystroke restarts the pause but an unrelated
 * input frame (material, frame) does not.
 */
const state = new Map();
/** @type {(eye: 'OD' | 'OS') => void} */
let onShown = () => {};

function stateOf(id) {
  let s = state.get(id);
  if (!s) {
    s = { want: null, wantSig: '', key: '', shownSig: '', deb: createDebouncer((fn, ms) => setTimeout(fn, ms), clearTimeout) };
    state.set(id, s);
  }
  return s;
}

function wantMessage(eye, field, m) {
  const id = fieldId(eye, field);
  const s = stateOf(id);
  const sig = m ? `${m.tier}|${m.code}|${JSON.stringify(m.data)}` : '';
  const key = sig + '\u0000' + input(id).value;
  s.want = m;
  s.wantSig = sig;
  if (sig === s.shownSig) {
    // Already on screen: no rewrite, so the live region is not announced again.
    s.deb.cancel();
    s.key = key;
    return;
  }
  // The message on screen no longer fits the value: remove it at once, never show a stale one.
  if (s.shownSig !== '') {
    paintMessage(id, null, field);
    s.shownSig = '';
  }
  if (m === null) {
    s.deb.cancel();
    s.key = key;
    return;
  }
  if (key === s.key && s.deb.isPending()) return;
  s.key = key;
  s.deb.call(() => {
    paintMessage(id, m, field);
    s.shownSig = sig;
    onShown(eye);
  });
}

/**
 * Blocked-eye status from the field states: the first field that blocks, and whether a blocking
 * message is not on screen yet (then the card says "Eingabe unvollständig …").
 * @param {'OD'|'OS'} eye
 */
export function eyeStatus(eye) {
  let firstBlockedFieldId = null;
  let pendingMessage = false;
  for (const f of FIELDS) {
    const s = stateOf(fieldId(eye, f));
    if (!blocking(s.want)) continue;
    firstBlockedFieldId ??= fieldId(eye, f);
    if (s.shownSig !== s.wantSig) pendingMessage = true;
  }
  return { firstBlockedFieldId, pendingMessage };
}

const sameBox = () => /** @type {HTMLInputElement} */ ($('rx-same'));

/** Copy R Sph/Zyl/Achse into L while "gleich wie rechts" is on. */
function syncMirror() {
  if (!sameBox().checked) return;
  for (const f of MIRRORED) {
    const l = input(fieldId('OS', f));
    const v = input(fieldId('OD', f)).value;
    if (l.value !== v) l.value = v;
  }
}

/** readonly (not disabled): still focusable and read by screen readers with the note. */
function setMirror(on) {
  for (const f of MIRRORED) {
    const l = input(fieldId('OS', f));
    l.readOnly = on;
    l.classList.toggle('mirrored', on);
    const ids = (l.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== MIRROR_NOTE);
    if (on) ids.push(MIRROR_NOTE);
    l.setAttribute('aria-describedby', ids.join(' '));
  }
  for (const b of document.querySelectorAll('button.sign[data-for^="rx-os-"]')) {
    if (on) b.setAttribute('aria-disabled', 'true');
    else b.removeAttribute('aria-disabled');
  }
  $(MIRROR_NOTE).hidden = !on;
  syncMirror();
}

/** "±": flip the sign of the parsed value, or insert "−" into an empty field (RESEARCH Pitfall 3). */
function flipSign(el) {
  if (el.readOnly) return;
  const raw = el.value;
  if (raw.trim() === '') el.value = '−';
  else {
    const r = parseDiopter(raw);
    if (r.ok && r.value !== 0) el.value = bare(-r.value);
    else if (LEADING_MINUS.test(raw)) el.value = raw.replace(LEADING_MINUS, '');
    else el.value = '−' + raw.replace(/^\s*\+\s*/, '');
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

/** Echo of the parsed value (never clamped: exactly what was typed), empty when blank or invalid. */
function echo(id, parse, format) {
  if (isBlank(id)) return setText(`${id}-echo`, '');
  const r = parse(input(id).value);
  setText(`${id}-echo`, r.ok ? format(r.value) : '');
}

/** Both cylinder forms under the table (RX-03), from the typed values. */
function showForms(eye, typed) {
  const formsId = `rx-${eye.toLowerCase()}-forms`;
  const r = typed ? transpose(typed) : null;
  if (!r || r.plus === null) {
    setText(formsId, '');
    $(formsId).hidden = true;
    return;
  }
  const forms = t('rx.forms', {
    eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
    minus: fmtForm(r.minus),
    plus: fmtForm(r.plus),
  });
  setText(formsId, r.transposed ? t('rx.' + RX_CODES.CYL_TRANSPOSED) + ' ' + forms : forms);
  $(formsId).hidden = false;
}

/**
 * Read one eye: echo now, messages after the pause. rx is the minus-cylinder form for the engine
 * (T-01-25), null when the eye is blocked; pd null when the PD blocks.
 * @param {'OD'|'OS'} eye
 */
export function readRxEye(eye) {
  if (eye === 'OS') syncMirror();
  const raw = {};
  for (const f of FIELDS) raw[f] = input(fieldId(eye, f)).value;
  const v = validateRxEye(raw);
  // Bridge until the smart PD UI (02-04 Task 2): PD resolved over both fields.
  const pd = resolvePd({ od: input('rx-od-pd').value, os: input('rx-os-pd').value });
  v.fields.pd = pd.messages[eye.toLowerCase()];
  v.pd = pd[eye].value;
  v.blocked.pd = pd.blocked[eye];
  echo(fieldId(eye, 'sph'), parseDiopter, fmtDiopter);
  echo(fieldId(eye, 'cyl'), parseDiopter, fmtDiopter);
  echo(fieldId(eye, 'axis'), parseAxis, fmtAxis);
  echo(fieldId(eye, 'pd'), parseMm, fmtMm);
  showForms(eye, v.typed);
  for (const f of FIELDS) wantMessage(eye, f, v.fields[f]);
  return {
    rx: v.rx,
    pd: v.pd,
    blocked: v.blocked.rx || v.blocked.pd,
    sphEmpty: raw.sph.trim() === '',
    ...eyeStatus(eye),
  };
}

/**
 * Wire blur (shows a due message at once), the "±" buttons and "gleich wie rechts". Input events
 * of the eight fields are wired by the example (main.js initExample), which calls onInput.
 * @param {{ onInput: (e: Event) => void, onMessageShown: (eye: 'OD'|'OS') => void }} hooks
 */
export function initRxInput({ onInput, onMessageShown }) {
  onShown = onMessageShown;
  for (const eye of EYES) {
    for (const f of FIELDS) {
      const id = fieldId(eye, f);
      input(id).addEventListener('blur', () => stateOf(id).deb.flush());
    }
  }
  for (const b of document.querySelectorAll('button.sign[data-for]')) {
    b.addEventListener('click', () => flipSign(input(b.dataset.for)));
  }
  sameBox().addEventListener('change', (e) => {
    setMirror(sameBox().checked);
    onInput(e);
  });
}
