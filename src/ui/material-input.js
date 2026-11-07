// Material section (02-07, MAT-01, D-14): six radio cards in MATERIALS order (ascending index),
// index first and a neutral descriptor (never "dünner": a higher index is not always thinner,
// PITFALLS Pitfall 8). Each card's second line names the Abbe number νe from materials.js.
// Moved from main.js: currentMaterialId and the material line under the result cards.
// 02-12 (MAT-06, D-17): the seventh card 'Eigenes Material' (static in index.html, data-expert) and
// its fields #custom-material. It applies only while the Experten-Ansicht is on; turning the switch
// off while it is selected falls back to the previously selected listed material with a Hinweis.
// Turning the switch back on does not re-select it (least surprise: the switch never changes the
// material by itself); the typed values are kept.
import { MATERIALS } from '../engine/materials.js';
import { parseIndex } from '../state/parse.js';
import { validateCustomMaterial, nearestListedMaterial } from '../state/validate.js';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';
import { isExpert } from './expert.js';
import { showFieldMessage, messageStatus, flushOnBlur } from './rx-input.js';

const DEFAULT_MATERIAL = 'cr39';
const DASH = '–';
const densityNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 });
// Abbe number νe = (ne − 1)/(nF′ − nC′): higher means less dispersion, hence fewer colour fringes.
// That meaning is textbook knowledge, not from a fetched document; the νe values are the cited
// Zeiss rows in materials.js, which list νe next to ne.
const abbeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

const CUSTOM = 'custom';
const checkedRadio = () => /** @type {HTMLInputElement | null} */ (document.querySelector('input[name=material]:checked'));
/** The last listed material the user selected (the fallback when the switch goes off). */
let lastListedId = DEFAULT_MATERIAL;

/**
 * Selected id, guarded to a MATERIALS key (T-01-21), or 'custom' only while its radio is checked
 * and the Experten-Ansicht is on (02-12).
 */
export function currentMaterialId() {
  const id = checkedRadio()?.value ?? '';
  if (id === CUSTOM) return isExpert() ? CUSTOM : lastListedId;
  return Object.hasOwn(MATERIALS, id) ? id : DEFAULT_MATERIAL;
}

/** Six radio cards from MATERIALS ids only; labels from the dictionary. Built once at init. */
function buildMaterialCards() {
  const box = /** @type {HTMLElement} */ (document.querySelector('#material .material-cards'));
  for (const id of Object.keys(MATERIALS)) {
    const label = document.createElement('label');
    label.className = 'radio-card material-card';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'material';
    radio.value = id;
    radio.checked = id === DEFAULT_MATERIAL;
    const title = document.createElement('span');
    title.className = 'radio-card-name';
    title.textContent = t('material.' + id + '.title');
    const sub = document.createElement('span');
    sub.className = 'radio-card-sub';
    sub.textContent = t('material.' + id + '.sub', { abbe: abbeNf.format(MATERIALS[id].ve) });
    label.append(radio, icon('check'), title, sub);
    box.append(label);
  }
  // The static custom card (index.html) goes last, after the six sourced cards.
  const custom = $('material-custom-card');
  custom.querySelector('input')?.after(icon('check'));
  box.append(custom);
}

/**
 * @param {{ schedule: (timeStamp: number) => void, onMaterialChange: (materialId: string) => void,
 *   onMessageShown: () => void }} deps
 *   onMaterialChange (02-10): re-fills the Expert minimum thicknesses before the input frame.
 *   onMessageShown (02-12): a custom field message appeared (repaint the not-ready cards).
 */
export function initMaterialInput({ schedule, onMaterialChange, onMessageShown }) {
  buildMaterialCards();
  onShown = onMessageShown;
  for (const id of Object.values(CUSTOM_IDS)) field(id).value = '';
  $('material').addEventListener('change', (e) => {
    const id = checkedRadio()?.value ?? '';
    if (Object.hasOwn(MATERIALS, id)) lastListedId = id;
    showOnlyExpertHint(null);
    if (id === CUSTOM) prefillMin();
    showCustomFields();
    onMaterialChange(currentMaterialId());
    schedule(e.timeStamp);
  });
  for (const [k, id] of Object.entries(CUSTOM_IDS)) {
    field(id).addEventListener('input', (e) => {
      if (k === 'minCT' || k === 'minET') minEdited[k] = field(id).value.trim() !== '';
      if (k === 'ne') prefillMin();
      schedule(e.timeStamp);
    });
    flushOnBlur(id);
  }
}

// ---- Eigenes Material (02-12, MAT-06) ----

const CUSTOM_IDS = /** @type {const} */ ({
  ne: 'custom-ne',
  density: 'custom-density',
  abbe: 'custom-abbe',
  minCT: 'custom-min-ct',
  minET: 'custom-min-et',
});
const field = (id) => /** @type {HTMLInputElement} */ ($(id));
/** Message kind per field: unit-less constants, mm for the minimum thicknesses. */
const KIND = { ne: 'num', density: 'num', abbe: 'num', minCT: 'mm', minET: 'mm' };
// Field text as typed: "1,8" (parseMm takes one decimal).
const mmField = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const neNf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/** A minimum field holds a typed value rather than the prefill. */
const minEdited = { minCT: false, minET: false };
/** @type {() => void} */
let onShown = () => {};

/** Listed material with the nearest ne to the ne field (1,500 while it does not parse). */
function nearestId() {
  const r = parseIndex(field(CUSTOM_IDS.ne).value);
  return nearestListedMaterial(r.ok ? r.value : MATERIALS[DEFAULT_MATERIAL].ne);
}

/** Pre-fill the minimum fields that were not typed from the nearest listed material. */
function prefillMin() {
  const m = MATERIALS[nearestId()];
  for (const k of /** @type {const} */ (['minCT', 'minET'])) {
    if (minEdited[k]) continue;
    const v = mmField.format(m[k]);
    if (field(CUSTOM_IDS[k]).value !== v) field(CUSTOM_IDS[k]).value = v;
  }
}

/** #custom-material only while 'Eigenes Material' applies. */
function showCustomFields() {
  $('custom-material').hidden = currentMaterialId() !== CUSTOM;
}

/** 'Eigenes Material gilt nur in der Experten-Ansicht …' under the cards; null hides it. */
function showOnlyExpertHint(materialId) {
  const el = $('material-err');
  if (materialId === null) {
    if (!el.hidden) {
      el.replaceChildren();
      el.hidden = true;
    }
    return;
  }
  const label = document.createElement('strong');
  label.className = 'msg-label';
  label.append(icon('hint'), t('val.tier.hint'));
  const text = document.createElement('span');
  text.textContent = ' ' + t('material.custom.onlyExpert', { material: t('material.' + materialId + '.title') });
  el.replaceChildren(label, text);
  el.hidden = false;
}

/**
 * The Experten-Ansicht switch changed (main.js, before the input frame). Off while 'Eigenes
 * Material' is checked: the previously selected listed material is checked again with the Hinweis.
 * On: the Hinweis goes.
 */
export function onExpertToggle() {
  const radio = checkedRadio();
  if (!isExpert() && radio?.value === CUSTOM) {
    const back = /** @type {HTMLInputElement} */ (document.querySelector(`input[name=material][value=${lastListedId}]`));
    back.checked = true;
    showOnlyExpertHint(lastListedId);
  } else if (isExpert()) {
    showOnlyExpertHint(null);
  }
  showCustomFields();
}

const NO_CUSTOM = Object.freeze({
  active: false,
  customMaterial: null,
  minCT: null,
  minET: null,
  blocked: false,
  firstBlockedFieldId: null,
  pendingMessage: false,
});

/** The last valid custom constants read (material line under the cards). */
let lastCustom = null;

/**
 * The custom material for the specs while 'Eigenes Material' applies (currentMaterialId 'custom'),
 * else NO_CUSTOM. Validates the five fields every input frame (messages after the pause, like the
 * Rx fields). A Fehler blocks both eyes; a Hinweis computes.
 * @returns {{ active: boolean, customMaterial: { ne: number, density: number, ve: number|null } | null,
 *   minCT: number|null, minET: number|null, blocked: boolean, firstBlockedFieldId: string|null,
 *   pendingMessage: boolean }}
 */
export function readCustomMaterial() {
  if (currentMaterialId() !== CUSTOM) {
    for (const id of Object.values(CUSTOM_IDS)) showFieldMessage(id, null, { kind: 'num', apply: null });
    return NO_CUSTOM;
  }
  const raw = Object.fromEntries(Object.entries(CUSTOM_IDS).map(([k, id]) => [k, field(id).value]));
  const v = validateCustomMaterial(raw);
  for (const [k, id] of Object.entries(CUSTOM_IDS)) {
    showFieldMessage(id, v.fields[k], { kind: KIND[k], apply: null, shown: onShown });
  }
  const cm = v.customMaterial;
  lastCustom = cm;
  setText('custom-ne-echo', cm ? 'nₑ = ' + neNf.format(cm.ne) : '');
  setText('custom-density-echo', cm ? densityNf.format(cm.density) + ' g/cm³' : '');
  setText('custom-abbe-echo', cm ? (cm.ve === null ? t('material.custom.noAbbe') : abbeNf.format(cm.ve)) : '');
  const prefill = t('material.custom.minPrefill', { material: t('material.' + v.nearest + '.title') });
  for (const k of /** @type {const} */ (['minCT', 'minET'])) {
    const shown = v.fields[k] === null && v[k] !== null;
    setText(`${CUSTOM_IDS[k]}-echo`, shown ? (minEdited[k] ? t('expert.min.typed') : prefill) : '');
  }
  const st = customStatus();
  return {
    active: true,
    customMaterial: cm,
    minCT: v.minCT,
    minET: v.minET,
    blocked: v.blocked || st.firstBlockedFieldId !== null,
    ...st,
  };
}

/** The first custom field whose message blocks both eyes, and whether it is not on screen yet. */
export function customStatus() {
  let firstBlockedFieldId = null;
  let pendingMessage = false;
  for (const id of Object.values(CUSTOM_IDS)) {
    const st = messageStatus(id);
    if (!st.blocks) continue;
    firstBlockedFieldId ??= id;
    if (st.pending) pendingMessage = true;
  }
  return { firstBlockedFieldId, pendingMessage };
}

/**
 * The material line under a result card (MAT-01). 'custom' (02-12) names the user's constants
 * (`custom`, default the last valid ones read) and 'beruht auf Ihren Angaben, kein geprüftes
 * Material'.
 * @param {'OD'|'OS'} eye @param {string} materialId
 * @param {{ ne: number, density: number, ve: number|null } | null} [custom]
 */
export function renderMaterialLine(eye, materialId, custom = lastCustom) {
  if (materialId === CUSTOM) {
    setText(
      `result-${eye.toLowerCase()}-material`,
      t('result.materialLineCustom', {
        eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
        ne: custom ? neNf.format(custom.ne) : DASH,
        density: custom ? densityNf.format(custom.density) + ' g/cm³' : DASH,
        abbe:
          custom?.ve == null
            ? t('material.custom.noAbbe')
            : t('result.materialLineCustom.abbe', { abbe: abbeNf.format(custom.ve) }),
        label: t('material.custom.label'),
      }),
    );
    return;
  }
  const m = MATERIALS[materialId];
  setText(
    `result-${eye.toLowerCase()}-material`,
    t('result.materialLine', {
      eye: t(eye === 'OD' ? 'rx.od' : 'rx.os'),
      label: t('material.' + materialId),
      density: densityNf.format(m.density) + ' g/cm³',
      // From the catalogue, not the result: the line renders even when the lens fails (MAT-01).
      abbe: abbeNf.format(m.ve),
    }),
  );
}
