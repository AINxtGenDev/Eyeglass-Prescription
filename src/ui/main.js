// The only DOM tier: raw field text → parse → transpose (minus cyl) → compute in a Web Worker
// (01-15) → German render. Every visible string comes from t(); everything is written with textContent.
import './style.css';
import { specFor } from '../state/bench-cases.js';
import { t } from '../i18n/t.js';
import { $, setText, applyDictionary } from './dom.js';
import {
  renderEmpty,
  renderBlocked,
  initResultJumps,
  renderPdNote,
  renderBNote,
  repaintFromLast,
} from './results.js';
import { initRxInput, readRx, eyeStatus } from './rx-input.js';
import { initFrameInput, readFrame, frameStatus, frameSizesTyped, applyFrameSizes, paintRim } from './frame-input.js';
import { initPresets } from './presets.js';
import { EXAMPLE } from '../state/presets.js';
import {
  initMaterialInput,
  currentMaterialId,
  renderMaterialLine,
  readCustomMaterial,
  customStatus,
  onExpertToggle,
} from './material-input.js';
import { initCompareView } from './compare-view.js';
import { initToggletips } from './toggletip.js';
import { initExpert, readExpertOverrides, expertStatus, onMaterialChange } from './expert.js';
import { initSummaryBar } from './summary-bar.js';
import {
  computeMode,
  setComputeMode,
  client,
  startWorker,
  requested,
  initPipeline,
  requestMain,
  cardMaterial,
  updateXsec,
  refreshView,
  currentCompareConfig,
} from './pipeline.js';
import {
  initTiming,
  onBench,
  runBench,
  timeResultFrame,
  timeCompareFrame,
  timeCompareStart,
  timings,
  pushTiming,
  writeBusyTiming,
  startEventTiming,
  schedule,
  scheduleFirst,
} from './timing.js';
import { createRegistrationGate } from './sw-core.js';
import { takeHandover, applySnapshot } from './handover.js';

const EYES = /** @type {const} */ (['OD', 'OS']);
// Test-only user timings (?perfmarks, 02-20): update() segments as 'u:*' measures for the perf
// spec's Chromium trace. Every mark is behind this constant, so nothing runs without the flag.
const PERF_MARKS = location.search.includes('perfmarks');
/** Measure name from start to now; returns now (the next segment's start). */
const lap = (name, start) => {
  const end = performance.now();
  performance.measure(name, { start, end });
  return end;
};

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material since 01-06
// (radio cards since 02-07, in material-input.js); frame shape/size and PD per eye since 01-07
// (frame section and smart PD since 02-04, in frame-input.js and rx-input.js). Fitting height is
// supported by the engine but omitted here (D-04).
// Example at load (UI-SPEC "Preset data", D-26): EXAMPLE in src/state/presets.js (02-09).
const RX_FIELDS = ['sph', 'cyl', 'axis', 'pd'];
/** The Sph/Zyl/Achse fields a preset writes (PD is kept). */
const PRESET_FIELDS = ['sph', 'cyl', 'axis'];
/** The last Rx read per eye, for repainting a not-ready card when its field message appears. */
const lastRead = { OD: null, OS: null };
/** The last frame read (blocked state of the frame fields, which block both eyes). */
let lastFrame = null;
/** The last Expert overrides read (02-10: a blocking Expert field blocks both eyes too). */
let lastExpert = null;
/** The last custom material read (02-12: a blocking custom field blocks both eyes too). */
let lastCustom = null;
/**
 * 04-07 (D-21): the confirmation after an update reload: 'done' (this tab clicked), 'done.other'
 * (another tab updated), 'lost' (the handover was invalid or did not apply), null (normal load).
 * 04-14 passes it to update.js, which shows it after the first result paint.
 */
let handoverKind = null;

/**
 * Not-ready status of an eye: its own Rx/PD fields first; when they do not block, a blocking
 * frame field blocks it, then a blocking Expert field (both cards point to that field).
 */
function notReadyStatus(eye) {
  const read = { ...lastRead[eye], ...eyeStatus(eye) };
  if (read.blocked) return read;
  if (lastFrame?.blocked) return { ...read, blocked: true, ...frameStatus() };
  if (lastExpert?.blocked) return { ...read, blocked: true, ...expertStatus() };
  if (lastCustom?.blocked) return { ...read, blocked: true, ...customStatus() };
  return read;
}

/**
 * Card of an eye that is not computed: empty state (no Sph), "Eingabe unvollständig …" while the
 * blocking field message is not due yet (RESEARCH Pitfall 5), the blocked sentence once it is,
 * or the phase-1 sentence when only a frame field is invalid.
 */
function paintNotReady(eye, read) {
  if (read.sphEmpty) renderEmpty(eye, t('result.inputMissing'), true);
  else if (!read.blocked || read.firstBlockedFieldId === null) renderEmpty(eye, t('result.inputInvalid'));
  else if (read.pendingMessage) renderEmpty(eye, t('result.incomplete'));
  else renderBlocked(eye, read.firstBlockedFieldId);
}

/** A field message appeared after the pause or on blur: repaint that eye's card if it is not computed. */
function onMessageShown(eye) {
  if (requested[eye] !== null || lastRead[eye] === null) return;
  paintNotReady(eye, notReadyStatus(eye));
}

function update(inputTs) {
  let t0 = PERF_MARKS ? performance.now() : 0;
  const tUpdate = t0;
  const read = readRx();
  if (PERF_MARKS) t0 = lap('u:readRx', t0);
  const fr = readFrame();
  lastFrame = fr;
  if (PERF_MARKS) t0 = lap('u:readFrame', t0);
  const materialId = currentMaterialId();
  // 02-10: Expert overrides (all null while the switch is off).
  const overrides = readExpertOverrides(materialId);
  lastExpert = overrides;
  // 02-12: 'Eigenes Material' (Expert only) brings its constants and its own minimum thicknesses.
  const custom = readCustomMaterial();
  lastCustom = custom;
  const specOverrides = custom.active
    ? { ...overrides, minCT: custom.minCT, minET: custom.minET, customMaterial: custom.customMaterial }
    : overrides;
  if (PERF_MARKS) t0 = lap('u:material', t0);
  // 02-08: while Vorher (A) is shown, the cards name A's material.
  for (const eye of EYES) renderMaterialLine(eye, ...cardMaterial(materialId));
  if (PERF_MARKS) t0 = lap('u:materialLine', t0);
  const ready = (eye) =>
    fr.frame !== null && !overrides.blocked && !custom.blocked && read[eye].rx !== null && read[eye].pd !== null;
  const specs = { OD: null, OS: null };
  for (const eye of EYES) {
    lastRead[eye] = read[eye];
    if (ready(eye)) {
      specs[eye] = specFor(eye, read[eye].rx, read[eye].pd, materialId, fr.frame, null, specOverrides);
      continue;
    }
    paintNotReady(eye, notReadyStatus(eye));
  }
  if (PERF_MARKS) t0 = lap('u:specs', t0);
  // Assumed inputs are stated next to the result (D-06, lens-critic MINOR-6): only for eyes that
  // are computed with them.
  renderPdNote(EYES.filter((eye) => specs[eye] !== null && read[eye].pdSource === 'default'));
  renderBNote(fr.frame !== null && fr.bEstimated && EYES.some((eye) => specs[eye] !== null) ? fr.B : null);
  if (PERF_MARKS) t0 = lap('u:notes', t0);
  requestMain(specs, inputTs);
  if (PERF_MARKS) {
    lap('u:requestMain', t0);
    lap('u:update', tUpdate);
  }
}

/** The six Sph/Zyl/Achse field texts, R then L. */
const presetFieldTexts = () =>
  EYES.flatMap((eye) => PRESET_FIELDS.map((f) => /** @type {HTMLInputElement} */ ($(`rx-${eye.toLowerCase()}-${f}`)).value));

/**
 * Example at load (D-26, UI-SPEC "Example banner"): fill the eight Rx fields. While untouched,
 * focusing an Rx field selects its content; the first input removes the banner.
 * Returns hasOwnRx for the preset chips (02-09): the user's own Sph/Zyl/Achse are on screen when
 * a field is not empty and the six texts differ from what the page wrote last (the example or a
 * preset). So the example, a preset and "Eigene Werte eingeben" (empty fields) never ask.
 * @returns {{ hasOwnRx: () => boolean, onRxApplied: (p: { od: object, os: object }) => void }}
 */
function initExample(onInput) {
  let untouched = true;
  let written = EYES.flatMap((eye) => PRESET_FIELDS.map((f) => EXAMPLE[eye.toLowerCase()][f]));
  const fields = [];
  for (const eye of EYES) {
    const e = eye.toLowerCase();
    for (const f of RX_FIELDS) {
      const input = /** @type {HTMLInputElement} */ ($(`rx-${e}-${f}`));
      input.value = EXAMPLE[e][f];
      fields.push(input);
    }
  }
  const leave = () => {
    untouched = false;
    $('example-banner')?.remove();
  };
  for (const input of fields) {
    input.addEventListener('focus', () => {
      if (untouched) input.select();
    });
    input.addEventListener('input', (e) => {
      if (untouched) leave();
      onInput(e);
    });
  }
  $('example-clear').addEventListener('click', () => {
    for (const input of fields) input.value = '';
    leave();
    $('rx-od-sph').focus();
    schedule(performance.now());
  });
  return {
    hasOwnRx: () => {
      const now = presetFieldTexts();
      return now.some((v) => v.trim() !== '') && now.join('|') !== written.join('|');
    },
    onRxApplied: (p) => {
      written = EYES.flatMap((eye) => PRESET_FIELDS.map((f) => p[eye.toLowerCase()][f]));
    },
  };
}

/** No input blocks right now (Rx, PD, frame, Expert and custom fields); read fresh from the fields. */
function formValid() {
  const read = readRx();
  const fr = readFrame();
  const materialId = currentMaterialId();
  return (
    EYES.every((eye) => read[eye].firstBlockedFieldId === null) &&
    fr.firstBlockedFieldId === null &&
    !readExpertOverrides(materialId).blocked &&
    !readCustomMaterial().blocked
  );
}

/**
 * 04-07 (D-21): a handover written just before an update reload, applied once through the normal
 * input path. With a comparison, A's values are run through one input frame (so currentConfig()
 * holds them) before 'Variante vergleichen' freezes them, as when the user clicks it.
 */
/**
 * 04-14 (D-21): the form as the handover needs it at reload time (update.js snapshots it). valid:
 * no input blocks (else a half-typed input would be reported as lost after the update); compareA:
 * the frozen Vorher (A); bEstimated: lens height B is the estimate, so it is not handed over.
 */
const formState = () => ({ valid: formValid(), compareA: currentCompareConfig(), bEstimated: readFrame().bEstimated });

function restoreHandover() {
  const ho = takeHandover();
  if (ho === null) return;
  if ('lost' in ho) {
    handoverKind = 'lost';
    return;
  }
  const res = applySnapshot(ho, document, {
    startCompare: () => {
      update(performance.now());
      $('cmp-start').click();
    },
    isValid: formValid,
  });
  handoverKind = res === 'lost' ? 'lost' : ho.origin === 'self' ? 'done' : 'done.other';
}

function init() {
  applyDictionary();
  initToggletips();
  initResultJumps();
  // Toggling rewrites the location suffixes directly: an identical spec is skipped by the compute
  // client and paints nothing (lens-critic round 3 MAJOR-A). 02-10: it also schedules an input
  // frame, because the Expert overrides start or stop applying (UI-SPEC "Expert switch off").
  initExpert(
    (ts) => {
      repaintFromLast();
      paintRim();
      // 02-12: off while 'Eigenes Material' is checked → back to the last listed material.
      onExpertToggle();
      // 02-13: the Querschnitt is requested only while the switch is on.
      updateXsec();
      // 03-07: the 3D frame's rim depth is the field value only while the switch is on.
      refreshView();
      schedule(ts);
    },
    { schedule, onMessageShown: () => EYES.forEach(onMessageShown), materialId: currentMaterialId() },
  );
  initSummaryBar();
  // Short disclaimer under the cards → the full Hinweis below (UI-SPEC "Disclaimer link").
  $('disclaimer-jump').addEventListener('click', () => $('disclaimer').focus());
  initTiming({ update });
  initCompareView();
  // 04-06 (D-22, D-25): the service worker registers after the first result paint or, on an empty
  // page, on idle after load; update.js (with workbox-window) is its own chunk.
  setText('tech-offline', t('serviceWorker' in navigator ? 'tech.offline.pending' : 'tech.offline.unsupported'));
  const swGate = createRegistrationGate({
    onStart: () =>
      import('./update.js').then(
        ({ start }) => start({ handoverKind, formState }),
        (err) => {
          console.warn('offline support could not load', err);
          setText('tech-offline', t('tech.offline.failed'));
        },
      ),
    setTimeoutFn: (cb, ms) => setTimeout(cb, ms),
    requestIdle: typeof requestIdleCallback === 'function' ? (cb, opts) => requestIdleCallback(cb, opts) : null,
  });
  if (document.readyState === 'complete') swGate.loaded();
  else window.addEventListener('load', () => swGate.loaded(), { once: true });
  initPipeline({
    onFirstPaint: swGate.firstPaint,
    onBench,
    onPainted: timeResultFrame,
    onCompute: (ms) => pushTiming(timings.compute, ms),
    onComparePainted: timeCompareFrame,
    onCompareStarted: timeCompareStart,
    // 02-12: a custom A keeps a copy of its constants and minimums (the fields may change later).
    currentConfig: () => ({
      frame: lastFrame?.frame ?? null,
      materialId: currentMaterialId(),
      custom: lastCustom?.active ? { customMaterial: lastCustom.customMaterial, minCT: lastCustom.minCT, minET: lastCustom.minET } : null,
    }),
  });
  setComputeMode('worker', 'tech.mode.worker');
  initMaterialInput({ schedule, onMaterialChange, onMessageShown: () => EYES.forEach(onMessageShown) });
  // 03-07: rim depth and temple re-mesh only the 3D frame (no compute job; no import cycle).
  initFrameInput({ schedule, onMessageShown: () => EYES.forEach(onMessageShown), onDisplayChange: refreshView });
  const onInput = (e) => schedule(e.timeStamp);
  const example = initExample(onInput);
  initRxInput({ onInput, onMessageShown });
  initPresets({ ...example, hasOwnFrame: frameSizesTyped, applyFrame: applyFrameSizes });
  const tech = /** @type {HTMLDetailsElement} */ ($('tech'));
  // Sync fallback: the bench would block the page, so only the button starts it (MINOR-6).
  tech.addEventListener('toggle', () => {
    if (tech.open && computeMode === 'worker') runBench();
  });
  $('timing-rerun').addEventListener('click', runBench);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) client.resume();
  });
  setText('ua', t('tech.ua', { ua: navigator.userAgent }));
  const meta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="app-commit"]'));
  setText('app-commit', meta?.content ?? 'dev');
  startEventTiming();
  writeBusyTiming();
  startWorker();
  // 04-07: after every input listener above is bound, before the first input frame.
  restoreHandover();
  scheduleFirst();
}

init();
