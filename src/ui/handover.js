// 04-07 (D-21 as amended, UI-SPEC "Input handover", T-04-26, T-04-27): keep what the user typed
// across the reload that installs an update. This is the only module in src/ that may touch
// browser storage (boundary test T-02-39, amended by 04-UI-SPEC M8), and only sessionStorage
// (same tab), under exactly one key.
// What is stored: the RAW text of the form fields, the two checkboxes, the three radio groups, an
// active comparison's configuration A, whether the form was valid, and the origin of the reload
// ('self' = this tab clicked "Aktualisieren", 'other' = another tab did). Never parsed numbers for
// the form, never the view mode, the camera or the Bild toggle (display state).
// Lifetime: written only immediately before the reload, read once at the next start of the same
// tab and deleted before it is used. Applied through the normal parse/validate path (the same
// events typing dispatches), never trusted raw.
// Callers never name a storage API: every function takes an optional `storage` whose default is
// resolved here.

export const HANDOVER_KEY = 'eyeglass-rx:v1:handover';
/** Size cap for the stored text (characters), read and write. */
export const MAX_CHARS = 8192;
/** Longest accepted field text; any real entry is far shorter. */
const MAX_FIELD = 200;
const VERSION = 1;

/** Text fields in the order they are written back (sizes before the stamp: see applySnapshot). */
export const TEXT_IDS = Object.freeze([
  'rx-od-sph',
  'rx-od-cyl',
  'rx-od-axis',
  'rx-od-pd',
  'rx-os-sph',
  'rx-os-cyl',
  'rx-os-axis',
  'rx-os-pd',
  'frame-a',
  'frame-dbl',
  'frame-b',
  'frame-stamp',
  'frame-rim',
  'custom-ne',
  'custom-density',
  'custom-abbe',
  'custom-min-ct',
  'custom-min-et',
  'expert-basecurve',
  'expert-min-ct',
  'expert-min-et',
  'expert-k',
]);
const CHECK_IDS = Object.freeze(['expert', 'rx-same']);
const RADIO_NAMES = Object.freeze(['frame-shape', 'material', 'expert-front']);
const ORIGINS = Object.freeze(['self', 'other']);
const RX_IDS = TEXT_IDS.filter((id) => id.startsWith('rx-'));
const FRAME_IDS = ['frame-a', 'frame-dbl', 'frame-b', 'frame-stamp', 'frame-rim'];
const CUSTOM_IDS = TEXT_IDS.filter((id) => id.startsWith('custom-'));
const EXPERT_IDS = TEXT_IDS.filter((id) => id.startsWith('expert-'));

/** This tab's session storage, or null when the browser blocks access (then nothing is stored). */
function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the handover can be written: setItem then removeItem of the one key (UI-SPEC MINOR 9).
 * @param {Storage | null} [storage]
 */
export function probe(storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(HANDOVER_KEY, '{}');
    storage.removeItem(HANDOVER_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * One synchronous setItem of the snapshot (with its origin). Never throws; false when nothing
 * was written (no storage, setItem threw, over the cap).
 * @param {object} snapshot @param {Storage | null} [storage]
 */
export function writeHandover(snapshot, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    const text = JSON.stringify(snapshot);
    if (text.length > MAX_CHARS) return false;
    storage.setItem(HANDOVER_KEY, text);
    return true;
  } catch {
    return false;
  }
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v) => v === null || num(v);
const shortStr = (v, max = MAX_FIELD) => typeof v === 'string' && v.length <= max;
/** Every own key is allowed and every value passes. */
const mapOf = (o, keys, ok) => isObj(o) && Object.keys(o).every((k) => keys.includes(k) && ok(o[k]));

function validCompareA(a) {
  if (a === null) return true;
  if (!isObj(a) || !shortStr(a.materialId, 64)) return false;
  const f = a.frame;
  if (f !== null && !(isObj(f) && shortStr(f.shape, 64) && num(f.A) && num(f.B) && num(f.DBL))) return false;
  const c = a.custom;
  if (c === null) return true;
  return (
    isObj(c) &&
    isObj(c.customMaterial) &&
    num(c.customMaterial.ne) &&
    num(c.customMaterial.density) &&
    numOrNull(c.customMaterial.ve) &&
    numOrNull(c.minCT) &&
    numOrNull(c.minET)
  );
}

/** The shape written by snapshotForm plus an origin (T-04-26: anything else is lost). */
const TOP_KEYS = Object.freeze(['v', 'origin', 'valid', 'text', 'checks', 'radios', 'compareA']);
function validShape(s) {
  return (
    isObj(s) &&
    Object.keys(s).every((k) => TOP_KEYS.includes(k)) &&
    s.v === VERSION &&
    ORIGINS.includes(s.origin) &&
    typeof s.valid === 'boolean' &&
    mapOf(s.text, TEXT_IDS, (v) => shortStr(v)) &&
    mapOf(s.checks, CHECK_IDS, (v) => typeof v === 'boolean') &&
    mapOf(s.radios, RADIO_NAMES, (v) => shortStr(v, 64)) &&
    validCompareA(s.compareA)
  );
}

/**
 * Read the handover once. The key is removed BEFORE anything is parsed or returned.
 * @param {Storage | null} [storage]
 * @returns {null | { lost: true } | object} null: no handover (a normal load, no confirmation);
 *   { lost: true }: present but too large, not JSON or the wrong shape; else the snapshot
 */
export function takeHandover(storage = defaultStorage()) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(HANDOVER_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    storage.removeItem(HANDOVER_KEY);
  } catch {
    // Nothing more can be done; the key dies with the tab.
  }
  if (typeof raw !== 'string' || raw.length > MAX_CHARS) return { lost: true };
  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    return { lost: true };
  }
  return validShape(s) ? s : { lost: true };
}

/** The radios of one group (fixed names only, never data in the selector). */
const radiosOf = (doc, name) => Array.from(doc.querySelectorAll(`input[name="${name}"]`));

/**
 * The form as raw text (UI-SPEC "Input handover"). No origin: reloadWithHandover adds it.
 * @param {Document} doc
 * @param {{ compareA?: object | null, valid?: boolean }} [o] compareA: the comparison's frozen
 *   configuration A (pipeline currentCompareConfig()); valid: no input blocks at snapshot time,
 *   so an input that was already invalid is not reported as lost after the reload
 */
export function snapshotForm(doc, { compareA = null, valid = true } = {}) {
  const text = {};
  for (const id of TEXT_IDS) {
    const el = doc.getElementById(id);
    if (el) text[id] = String(el.value);
  }
  const checks = {};
  for (const id of CHECK_IDS) {
    const el = doc.getElementById(id);
    if (el) checks[id] = !!el.checked;
  }
  const radios = {};
  for (const name of RADIO_NAMES) {
    const el = radiosOf(doc, name).find((r) => r.checked);
    if (el) radios[name] = String(el.value);
  }
  return { v: VERSION, valid, text, checks, radios, compareA: compareA === null ? null : structuredClone(compareA) };
}

/** Field text for a number, as a user in de-AT types it ("52,5"). */
const fieldNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 3, useGrouping: false });
const fieldText = (v) => (v === null ? '' : fieldNf.format(v));

/**
 * Write the snapshot back through the events typing dispatches (as presets.applyRx does), so
 * parse → validate → compute runs as for typed input. Only changed values are written.
 * Order: the Experten-Ansicht switch first (a custom material needs it), then a comparison's A
 * (its values, then startCompare = #cmp-start), then the form (B): "gleich für beide Augen", the
 * Rx, the shape before its sizes, the sizes before the stamp (an A write rewrites the stamp; the
 * stamp text as typed wins), the material before its custom fields, Vorderfläche before k.
 * @param {object} snapshot a value from takeHandover (shape-checked)
 * @param {Document} doc
 * @param {{ startCompare: () => void, isValid: () => boolean }} hooks isValid: no input blocks now
 * @returns {'ok' | 'lost'} lost: a field or radio value no longer exists, or the inputs were
 *   valid at the snapshot and are not now
 */
export function applySnapshot(snapshot, doc, { startCompare, isValid }) {
  let missing = false;
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const setText = (id, v) => {
    if (v === undefined) return;
    const el = doc.getElementById(id);
    if (!el) {
      missing = true;
      return;
    }
    if (el.value === v) return;
    el.value = v;
    fire(el, 'input');
  };
  const setCheck = (id, v) => {
    if (v === undefined) return;
    const el = doc.getElementById(id);
    if (!el) {
      missing = true;
      return;
    }
    if (el.checked === v) return;
    el.checked = v;
    fire(el, 'change');
  };
  const setRadio = (name, v) => {
    if (v === undefined) return;
    const el = radiosOf(doc, name).find((r) => r.value === v);
    if (!el) {
      missing = true;
      return;
    }
    if (el.checked) return;
    el.checked = true;
    fire(el, 'change');
  };
  const { text, checks, radios, compareA } = snapshot;

  setCheck('expert', checks.expert);
  if (compareA) {
    if (compareA.frame) {
      setRadio('frame-shape', compareA.frame.shape);
      setText('frame-a', fieldText(compareA.frame.A));
      setText('frame-dbl', fieldText(compareA.frame.DBL));
      setText('frame-b', fieldText(compareA.frame.B));
    }
    setRadio('material', compareA.materialId);
    if (compareA.custom) {
      const c = compareA.custom;
      setText('custom-ne', fieldText(c.customMaterial.ne));
      setText('custom-density', fieldText(c.customMaterial.density));
      setText('custom-abbe', fieldText(c.customMaterial.ve));
      setText('custom-min-ct', fieldText(c.minCT));
      setText('custom-min-et', fieldText(c.minET));
    }
    startCompare();
  }
  setCheck('rx-same', checks['rx-same']);
  for (const id of RX_IDS) setText(id, text[id]);
  setRadio('frame-shape', radios['frame-shape']);
  for (const id of FRAME_IDS) setText(id, text[id]);
  setRadio('material', radios.material);
  for (const id of CUSTOM_IDS) setText(id, text[id]);
  setRadio('expert-front', radios['expert-front']);
  for (const id of EXPERT_IDS) setText(id, text[id]);

  if (missing) return 'lost';
  return snapshot.valid && !isValid() ? 'lost' : 'ok';
}
