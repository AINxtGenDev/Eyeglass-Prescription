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
import { initFrameInput, readFrame, frameStatus } from './frame-input.js';
import { initMaterialInput, currentMaterialId, renderMaterialLine } from './material-input.js';
import { initCompareView } from './compare-view.js';
import { initToggletips } from './toggletip.js';
import { initExpert } from './expert.js';
import { initSummaryBar } from './summary-bar.js';
import {
  computeMode,
  setComputeMode,
  client,
  startWorker,
  requested,
  initPipeline,
  requestMain,
  cardMaterialId,
} from './pipeline.js';
import {
  initTiming,
  onBench,
  runBench,
  timeResultFrame,
  timeCompareFrame,
  timings,
  pushTiming,
  writeBusyTiming,
  startEventTiming,
  schedule,
  scheduleFirst,
} from './timing.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

// Phase-1 inputs: Sph/Zyl/Achse (cyl since 01-09, transposed to minus form). Material since 01-06
// (radio cards since 02-07, in material-input.js); frame shape/size and PD per eye since 01-07
// (frame section and smart PD since 02-04, in frame-input.js and rx-input.js). Fitting height is
// supported by the engine but omitted here (D-04).
// Example at load (UI-SPEC "Preset data", D-26): a moderate myope with a small cylinder.
const EXAMPLE = {
  od: { sph: '-2,75', cyl: '-0,50', axis: '180', pd: '32' },
  os: { sph: '-2,50', cyl: '-0,75', axis: '170', pd: '31,5' },
};
const RX_FIELDS = ['sph', 'cyl', 'axis', 'pd'];
/** The last Rx read per eye, for repainting a not-ready card when its field message appears. */
const lastRead = { OD: null, OS: null };
/** The last frame read (blocked state of the frame fields, which block both eyes). */
let lastFrame = null;

/**
 * Not-ready status of an eye: its own Rx/PD fields first; when they do not block, a blocking
 * frame field blocks it (both cards point to the frame field).
 */
function notReadyStatus(eye) {
  const read = { ...lastRead[eye], ...eyeStatus(eye) };
  if (read.blocked || !lastFrame?.blocked) return read;
  return { ...read, blocked: true, ...frameStatus() };
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
  const read = readRx();
  const fr = readFrame();
  lastFrame = fr;
  const materialId = currentMaterialId();
  // 02-08: while Vorher (A) is shown, the cards name A's material.
  for (const eye of EYES) renderMaterialLine(eye, cardMaterialId(materialId));
  const ready = (eye) => fr.frame !== null && read[eye].rx !== null && read[eye].pd !== null;
  const specs = { OD: null, OS: null };
  for (const eye of EYES) {
    lastRead[eye] = read[eye];
    if (ready(eye)) {
      specs[eye] = specFor(eye, read[eye].rx, read[eye].pd, materialId, fr.frame);
      continue;
    }
    paintNotReady(eye, notReadyStatus(eye));
  }
  // Assumed inputs are stated next to the result (D-06, lens-critic MINOR-6): only for eyes that
  // are computed with them.
  renderPdNote(EYES.filter((eye) => specs[eye] !== null && read[eye].pdSource === 'default'));
  renderBNote(fr.frame !== null && fr.bEstimated && EYES.some((eye) => specs[eye] !== null) ? fr.B : null);
  requestMain(specs, inputTs);
}

/**
 * Example at load (D-26, UI-SPEC "Example banner"): fill the eight Rx fields. While untouched,
 * focusing an Rx field selects its content; the first input removes the banner.
 */
function initExample(onInput) {
  let untouched = true;
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
}

function init() {
  applyDictionary();
  initToggletips();
  initResultJumps();
  // Toggling only rewrites the location suffixes; it never goes through schedule()/the compute
  // client, which would skip the identical spec and paint nothing (lens-critic round 3 MAJOR-A).
  initExpert(repaintFromLast);
  initSummaryBar();
  // Short disclaimer under the cards → the full Hinweis below (UI-SPEC "Disclaimer link").
  $('disclaimer-jump').addEventListener('click', () => $('disclaimer').focus());
  initTiming({ update });
  initCompareView();
  initPipeline({
    onBench,
    onPainted: timeResultFrame,
    onCompute: (ms) => pushTiming(timings.compute, ms),
    onComparePainted: timeCompareFrame,
    currentConfig: () => ({ frame: lastFrame?.frame ?? null, materialId: currentMaterialId() }),
  });
  setComputeMode('worker', 'tech.mode.worker');
  initMaterialInput({ schedule });
  initFrameInput({ schedule, onMessageShown: () => EYES.forEach(onMessageShown) });
  const onInput = (e) => schedule(e.timeStamp);
  initExample(onInput);
  initRxInput({ onInput, onMessageShown });
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
  scheduleFirst();
}

init();
