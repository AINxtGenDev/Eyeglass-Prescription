// Rx table (02-03, RX-01, RX-04, RX-05, RX-07): raw field text → validateRxEye → echo, cylinder
// forms and tiered field messages. Only the message display is debounced (600 ms pause or blur);
// the caller sends the compute request every input frame (RESEARCH Pitfall 5).
// 02-04: both PD fields are read together (resolvePd, RX-06): a pair or a binocular PD in one field
// gives both eyes a value, a question blocks the eye, an empty field uses the stated default.
// Every visible string comes from t() and is written as text, never as markup (T-02-09).
import { parseDiopter, parseAxis, STAMP_CODES, PARSE_CODES } from '../state/parse.js';
import { transpose, RX_CODES } from '../state/transpose.js';
import { validateRxEye, resolvePd, TIERS, VAL_CODES } from '../state/validate.js';
import { createDebouncer } from '../state/debounce.js';
import { t } from '../i18n/t.js';
import { fmtDiopter, fmtAxis, fmtMm, fmtConic } from '../i18n/format.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
const RX_FIELDS = /** @type {const} */ (['sph', 'cyl', 'axis']);
const FIELDS = /** @type {const} */ ([...RX_FIELDS, 'pd']);
// "Gleich für beide Augen" mirrors Sph, Zyl and Achse only; PD stays per eye (RESEARCH Pitfall 9).
const MIRRORED = ['sph', 'cyl', 'axis'];
const MIRROR_NOTE = 'rx-mirror-note';
const TIER_ICON = { [TIERS.ERROR]: 'error', [TIERS.HINT]: 'hint', [TIERS.OUT]: 'outside' };
const TIER_CLASS = { [TIERS.ERROR]: 'msg-error', [TIERS.HINT]: 'msg-hint', [TIERS.OUT]: 'msg-out' };
// Every minus form parseDiopter accepts (U+2212, U+2012, U+2013, U+2010, U+FE63, U+FF0D, '-').
const LEADING_MINUS = /^\s*[-−‒–‐﹣－]\s*/;
// The literal frame terms a VAL_FRAME_OUT_OF_MODEL message may name.
const FRAME_TERMS = ['A', 'B', 'DBL'];
// 02-12: the custom material constants a VAL_CUSTOM_* message names (material.custom.field.*).
const CUSTOM_TERMS = ['ne', 'density', 'abbe'];
// Unit-less custom material numbers: up to three decimals as typed (nₑ 1,523; Dichte 2,54).
const plainNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 3, useGrouping: false });

const input = (id) => /** @type {HTMLInputElement} */ ($(id));
const fieldId = (eye, f) => `rx-${eye.toLowerCase()}-${f}`;
const isBlank = (id) => input(id).value.trim() === '';
/** "−2,25" (no unit): what the sign and apply buttons write into a field. */
const bare = (v) => fmtDiopter(v).replace(/\u00A0dpt$/, '');

/** "Sph / Zyl × Achse" for one cylinder form. */
export const fmtForm = (f) => `${fmtDiopter(f.sph)} / ${fmtDiopter(f.cyl)} × ${fmtAxis(f.axisDeg)}`;

/**
 * German text of a field message; params are formatted numbers or fixed terms only (T-02-09).
 * @param {{ code: string, data: Record<string, any> }} m @param {'dpt'|'mm'|'k'|'num'} kind
 */
function messageText(m, kind) {
  const d = m.data;
  if (m.code === VAL_CODES.VAL_PD_QUESTION) {
    const params = Number.isFinite(d.value) ? { value: fmtMm(d.value) } : {};
    return t('pd.' + d.question, params) + ' ' + t('val.' + m.code);
  }
  if (Object.hasOwn(VAL_CODES, m.code)) {
    const fmt = kind === 'mm' ? fmtMm : kind === 'k' ? fmtConic : kind === 'num' ? (v) => plainNf.format(v) : fmtDiopter;
    const params = {};
    if (Number.isFinite(d.suggestion)) params.suggestion = fmtDiopter(d.suggestion);
    for (const k of ['value', 'min', 'max']) if (Number.isFinite(d[k])) params[k] = fmt(d[k]);
    if (Number.isFinite(d.typed)) params.typed = fmtDiopter(d.typed);
    if (FRAME_TERMS.includes(d.field)) params.field = d.field;
    if (CUSTOM_TERMS.includes(d.field)) params.field = t('material.custom.field.' + d.field);
    let text = t('val.' + m.code, params);
    // Plus cylinder: the Sph range was checked on the minus form, so name what was typed.
    if (m.code === VAL_CODES.VAL_SPH_OUT_OF_MODEL && d.typed && d.typed.cyl > 0) {
      text += ' ' + t('val.transposedSuffix', { typed: fmtForm(d.typed) });
    }
    if (d.contactLens) text += ' ' + t('val.contactLensSuffix');
    return text;
  }
  if (Object.hasOwn(RX_CODES, m.code)) return t('rx.' + m.code);
  if (Object.hasOwn(STAMP_CODES, m.code)) {
    return t('stamp.' + m.code, Number.isInteger(d?.A) ? { A: String(d.A), DBL: String(d.DBL) } : {});
  }
  return t('parse.' + m.code);
}

/**
 * Write one field's message slot: tier label + icon, text, and the "übernehmen" button.
 * @param {string} id @param {object|null} m @param {{ kind: 'dpt'|'mm'|'k', apply: string|null }} opts
 */
function paintMessage(id, m, { kind, apply }) {
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
  text.textContent = ' ' + messageText(m, kind);
  const parts = [label, text];
  // "Meinten Sie …?": writes the value only after a click (T-02-10); not into a mirrored field.
  if (apply !== null && !el.readOnly) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'apply';
    btn.textContent = t('val.apply', { suggestion: apply });
    btn.addEventListener('click', () => {
      dirty.add(id);
      el.value = apply;
      el.focus();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    parts.push(btn);
  }
  err.className = 'msg ' + TIER_CLASS[m.tier];
  err.replaceChildren(...parts);
  err.hidden = false;
  // A blocking question (Hinweis) is not marked invalid: the value is not wrong, only unclear.
  if (m.tier !== TIERS.HINT) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

/**
 * Per field: the message wanted now (want/wantSig), whether it blocks, the one on screen
 * (shownSig, '' = none) and the pause timer. key = sig + raw text, so a keystroke restarts the
 * pause but an unrelated input frame (material, frame) does not.
 */
const state = new Map();
/** @type {(eye: 'OD' | 'OS') => void} */
let onShown = () => {};

function stateOf(id) {
  let s = state.get(id);
  if (!s) {
    s = {
      want: null,
      wantSig: '',
      blocks: false,
      key: '',
      shownSig: '',
      deb: createDebouncer((fn, ms) => setTimeout(fn, ms), clearTimeout),
    };
    state.set(id, s);
  }
  return s;
}

/**
 * Want message m in field id (null = none). It is painted after the pause or on blur; a message
 * on screen that no longer fits is removed at once. Shared by the Rx and frame fields.
 * @param {string} id
 * @param {object|null} m FieldMsg
 * @param {{ kind?: 'dpt'|'mm'|'k'|'num', blocks?: boolean, apply?: string|null, shown?: () => void }} [opts]
 *   blocks defaults to "not a Hinweis"; apply = text the "übernehmen" button writes (default: the
 *   suggestion of a Hinweis, "Meinten Sie −2,25?").
 */
export function showFieldMessage(id, m, { kind = 'dpt', blocks, apply, shown = () => {} } = {}) {
  const s = stateOf(id);
  if (apply === undefined) apply = m?.tier === TIERS.HINT && Number.isFinite(m.data.suggestion) ? bare(m.data.suggestion) : null;
  const sig = m ? `${m.tier}|${m.code}|${JSON.stringify(m.data)}` : '';
  const key = sig + '\u0000' + input(id).value;
  s.want = m;
  s.wantSig = sig;
  s.blocks = m !== null && (blocks ?? m.tier !== TIERS.HINT);
  if (sig === s.shownSig) {
    // Already on screen: no rewrite, so the live region is not announced again.
    s.deb.cancel();
    s.key = key;
    return;
  }
  if (s.shownSig !== '') {
    paintMessage(id, null, { kind, apply });
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
    paintMessage(id, m, { kind, apply });
    s.shownSig = sig;
    shown();
  });
}

/** Whether field id's wanted message blocks, and whether it is not on screen yet. */
export function messageStatus(id) {
  const s = stateOf(id);
  return { blocks: s.blocks, pending: s.blocks && s.shownSig !== s.wantSig };
}

/** Show a due message at once when the field loses focus. */
export function flushOnBlur(id) {
  input(id).addEventListener('blur', () => stateOf(id).deb.flush());
}

/** PD fields whose message blocks each eye (resolvePd blockedBy), from the last read. */
let pdBlockedBy = { OD: null, OS: null };

/**
 * Blocked-eye status from the field states: the first field that blocks, and whether a blocking
 * message is not on screen yet (then the card says "Eingabe unvollständig …"). The PD field that
 * blocks an eye may be the other eye's field ("20/33" typed on the left).
 * @param {'OD'|'OS'} eye
 */
export function eyeStatus(eye) {
  let firstBlockedFieldId = null;
  let pendingMessage = false;
  const ids = RX_FIELDS.map((f) => fieldId(eye, f));
  if (pdBlockedBy[eye] !== null) ids.push(`rx-${pdBlockedBy[eye]}-pd`);
  for (const id of ids) {
    const st = messageStatus(id);
    if (!st.blocks) continue;
    firstBlockedFieldId ??= id;
    if (st.pending) pendingMessage = true;
  }
  return { firstBlockedFieldId, pendingMessage };
}

/**
 * 02-18 (lens-critic M3): Rx fields the user has edited. A typed or pasted input (trusted event),
 * "±" and "übernehmen" count; values the page writes (the example at load, "Eigene Werte
 * eingeben", a preset, which dispatches a synthetic input) do not. So no clearDirty is needed: a
 * page write never marks a field, and it never leaves an emptied Sph behind.
 */
const dirty = new Set();

/**
 * Whether the user has edited this eye's Sph, Zyl or Achse (eye rule, lens-critic m-e: with Zyl or
 * Achse typed, an empty Sph is a real omission). A mirrored L takes R's state, since it shows R.
 * @param {'OD'|'OS'} eye
 */
function eyeEdited(eye) {
  const src = eye === 'OS' && sameBox().checked ? 'OD' : eye;
  return RX_FIELDS.some((f) => dirty.has(fieldId(src, f)));
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
  dirty.add(el.id);
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

/**
 * PD echo: the per-eye value, the binocular note or the pair note. An empty field that gets its
 * value from the other field shows that value; the default is stated in #pd-note instead.
 */
function echoPd(eye, pd) {
  const f = eye.toLowerCase();
  const p = pd.parsed[f];
  let text = '';
  if (p.ok && p.kind === 'mono') text = fmtMm(p.value);
  else if (p.ok && p.kind === 'binocular') text = t('pd.binocularNote', { total: fmtMm(p.total), half: fmtMm(p.OD) });
  else if (p.ok) text = t('pd.pairNote', { od: fmtMm(p.OD), os: fmtMm(p.OS) });
  else if (isBlank(fieldId(eye, 'pd')) && pd[eye].value !== null && pd[eye].source !== 'default') text = fmtMm(pd[eye].value);
  setText(`${fieldId(eye, 'pd')}-echo`, text);
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
 * Read both eyes: echo now, messages after the pause. rx is the minus-cylinder form for the
 * engine (T-01-25), null when the eye is blocked; pd null when the PD blocks; pdSource 'typed',
 * 'pair', 'binocular' or 'default' (shown in #pd-note).
 */
export function readRx() {
  syncMirror();
  const pd = resolvePd({ od: input('rx-od-pd').value, os: input('rx-os-pd').value });
  pdBlockedBy = pd.blockedBy;
  const out = {};
  for (const eye of EYES) {
    const raw = {};
    for (const f of RX_FIELDS) raw[f] = input(fieldId(eye, f)).value;
    const v = validateRxEye(raw);
    echo(fieldId(eye, 'sph'), parseDiopter, fmtDiopter);
    echo(fieldId(eye, 'cyl'), parseDiopter, fmtDiopter);
    echo(fieldId(eye, 'axis'), parseAxis, fmtAxis);
    echoPd(eye, pd);
    showForms(eye, v.typed);
    const shown = () => onShown(eye);
    // M3: "Bitte einen Wert eingeben." only once the user has edited this eye. Only the message is
    // held back: v.blocked.rx and sphEmpty are computed from the text, so the eye is still not
    // computed and the card shows its empty state (paintNotReady checks sphEmpty first).
    const edited = eyeEdited(eye);
    for (const f of RX_FIELDS) {
      const m = v.fields[f];
      showFieldMessage(fieldId(eye, f), m?.code === PARSE_CODES.PARSE_EMPTY && !edited ? null : m, { shown });
    }
    out[eye] = { v, raw };
  }
  // PD messages after both eyes: a PD message may block either eye, so both cards repaint.
  for (const eye of EYES) {
    const blocks = pd.blockedBy.OD === eye.toLowerCase() || pd.blockedBy.OS === eye.toLowerCase();
    showFieldMessage(fieldId(eye, 'pd'), pd.messages[eye.toLowerCase()], {
      kind: 'mm',
      blocks,
      shown: () => EYES.forEach((e) => onShown(e)),
    });
  }
  const result = {};
  for (const eye of EYES) {
    const { v, raw } = out[eye];
    result[eye] = {
      rx: v.rx,
      pd: pd[eye].value,
      pdSource: pd[eye].source,
      blocked: v.blocked.rx || pd.blocked[eye],
      sphEmpty: raw.sph.trim() === '',
      ...eyeStatus(eye),
    };
  }
  return result;
}

/**
 * Wire blur (shows a due message at once), the "±" buttons and "gleich wie rechts". Input events
 * of the eight fields are wired by the example (main.js initExample), which calls onInput.
 * @param {{ onInput: (e: Event) => void, onMessageShown: (eye: 'OD'|'OS') => void }} hooks
 */
export function initRxInput({ onInput, onMessageShown }) {
  onShown = onMessageShown;
  for (const eye of EYES) for (const f of FIELDS) flushOnBlur(fieldId(eye, f));
  for (const eye of EYES) {
    for (const f of FIELDS) {
      const id = fieldId(eye, f);
      input(id).addEventListener('input', (e) => {
        if (e.isTrusted) dirty.add(id);
      });
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
