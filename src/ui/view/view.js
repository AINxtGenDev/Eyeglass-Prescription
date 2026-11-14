// Lazy 3D view entry (03-05, VIZ-01, VIZ-04, VIZ-06). pipeline.js imports this chunk after the
// first painted result (D-16), so the entry bundle carries no Three.js and the numbers path is
// unchanged. CSP: text via textContent only, no style attributes (T-03-15).
//
// lens-critic MAJOR 3: the lens meshes are built in a DEDICATED mesh worker (03-04) owned by this
// chunk, never in the engine worker, so a numbers result never waits behind a mesh build.
// - Latest wins: each update() whose items differ from the last request is one requestMesh();
//   the replaced queued job hands its buffers back. A reply is attached only after a second
//   isMeshCurrent() check in its paint frame (T-03-14); stale replies only refill the pool.
// - While a newer mesh is pending, the old mesh stays visible; after 100 ms the badge says
//   'view.badge.updating' (UI-SPEC States). #view[data-pending] is 'mesh' until the current mesh
//   is attached (e2e settledView).
// - window.__eyeglassView: frozen, read-only test handle (T-03-16). It returns counters, the
//   glass ior, test-only geometry maxima and pixels; never Rx values or renderer strings.
// 03-06 (D-17, UI-SPEC States): without WebGL2 the stage shows the plain-German note and the
// numbers path is untouched. Eye labels R / L sit 6 mm below each lens's lowest outline point
// (boxing box bottom, y = −B/2); a blocked eye is not drawn and reads '{eye} – nicht berechnet';
// with no computable eye the caption reads view.empty and no label is shown.
// 03-07 (VIZ-02, D-06): the frame is one more mesh item ('frame', frame.js). Per-item keys
// (lens-critic round 2 MINOR 7): update() sends only the items whose key differs from the key of
// the item last attached in that slot from a current reply (not the last sent key, so the items
// of a dropped or stale job are sent again with the next job). A rim-depth or temple change sends
// only the frame item; an Rx change of one eye sends that lens and the frame. When nothing changed
// but a job is still outstanding, requestMesh([]) makes it stale (a quick −2 → −3 → −2 must not
// attach the −3 mesh). Technische Angaben: temple length (drawn value and its source) and the
// assumed rim face width, filled after each frame attach (textContent only, fmtMm values).
// 03-08 (D-10…D-12): eye chart and contact shadow (backdrop.js); the tier line with dispersion
// (on only on hoch and only with a sourced νe), the exactness note and the last re-mesh time in
// Technische Angaben. The re-mesh time runs from requestMesh to the render that shows the attached
// mesh; it is a 3D number of its own and never mixed into the ENG-09 timings (Pitfall 12). Context
// loss and restore (scene.js) drive #view-status and the 'Grafik vom Browser angehalten' reason.
// 03-09 (VIZ-03, D-15, D-18…D-20): camera controls (controls.js) on the one camera; preset buttons
// in #view-tools are enabled after the first mesh attach. Every frame attach and stage resize
// refreshes the derived limits (R1-4), the chart rectangle (A2) and, unless the user turned the
// view freely, the current preset pose (A1 default fit). The side eye is the eye with the larger
// total edge protrusion bevelSplit(etMax).front + .back at the current rim depth (MINOR 13). The
// chart is hidden when the camera is more than 70° from its normal (Seite, Oben).
// 03-11 (D-19, D-29): #view-protrusion states per computed eye how far the thickest edge stands
// out of the rim (bevelSplit) and how far the front surface leads the rim (frontLeadMm with the
// eye's frameOutline), the same helpers and rim depth as the Expert rim lines, computed once per
// delivery or display change (memo key), never per frame. Within 30° of a side view the near temple
// and hinge are faded (frame.setFade, chosen before each render). #view-canvas gets a German
// aria-label from the strings painted on the result cards (results.js cardStrings), the view
// name, the frame and the material, debounced to 500 ms (one timer, latest wins).
// 03-12 (VIZ-05, UX-02, D-21…D-23, lens-critic MAJOR 4): Expert-only 'Darstellung: Glas |
// Dickenkarte' (#view-mode). Dickenkarte swaps the lens faces to the heat material (heat.js; both
// materials pre-created, D-26) and moves the camera to the 'heat' pose of ONE lens, the heat eye
// (larger max(ct, etMax.value) of the drawn eyes, ties → OD), so the map has about 4 px/mm on a
// 320 px phone. Both lenses are coloured on one shared scale: heatScale over the drawn eyes'
// metrics, isoLevels for the step (engine, D-23). Legend and table (legend.js) come from the same
// engine values (heatCallouts), computed once per delivery (memo key), never per orbit frame.
// Expert off returns to Glas. Without WebGL the switch is removed (UI-SPEC States).
// 03-13 (VIZ-05, D-22 as amended, lens-critic MAJOR 4, round 2 MINOR 5): in Dickenkarte the
// selected eye ('Zahlen am Glas für', #view-heat-eye; default the heat eye) carries the engine
// callouts and iso labels (labels.js), laid out on every render with the eye labels by one
// priority rule (label-layout.js) around the badge and the keyboard hint. Picking an eye frames it
// (goTo('heat', eye)); the table is unchanged. #view-callout-note (all callouts or none) is written
// only at settle points (requestSettle: controls onSettle, eye / mode / text / size changes).
// dev-1.7 (user 2026-11-12, amends 03-12 / 03-13): the 'heat' pose frames BOTH lenses, because the
// two eyes often differ. The heat eye and the picker now only choose which lens carries the
// numbers; neither moves the camera. On a phone-width stage the callouts do not fit next to two
// lenses, so the all-or-nothing rule shows the table-only note there.
// 03-14 (RES-03, D-24 as amended, D-25, lens-critic round 2 MINOR 4): inputs.compare (pipeline)
// switches to the A/B layout (compare3d.js): the compared eye (compareEye over thickest(m) of A
// and B) as Vorher (A) | Nachher (B) side by side in two scissor halves of the one renderer with
// the one camera (stage ≥ 360 px), else one viewport following #cmp-show. The A lens ('A') and
// its rim ('frameA', a second createFrame) are one more pair of items in the same latest-wins mesh
// job, each with its own key (T-03-38). In Dickenkarte A and B share one heatScale over all four
// lenses, the table shows Vorher (A) · Nachher (B) for the compared eye and the callout rule is
// decided once across both halves. Starting or ending a comparison creates no GPU resource: the A
// slot is uploaded by a warm-up render after the first attach and afterwards only made visible.
// 03-14 A3 (orchestrator amendment): the keyboard hint shows on keyboard focus and fades out after
// KEYS_SHOW_MS (no transition under reduced motion); once hidden it is no longer an obstacle for
// the labels, so the callouts return. The text stays the stage's aria-describedby description.
import { createMeshClient } from '../../state/mesh-client.js';
import { transferOf } from '../../state/transfer.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtMm, fmtMs } from '../../i18n/format.js';
import { boxingCentreX, FRAME_FACE_MM, TEMPLE_DEFAULT_MM, TEMPLE_RANGE_MM } from '../../engine/mesh/frame.js';
import { bevelSplit, frontLeadMm } from '../../engine/rim.js';
import { frameOutline } from '../../engine/frame/outline.js';
import { cardStrings } from '../results.js';
import { protrusionLines, protrusionCompareLines, ariaGlass } from './text.js';
import { createScene } from './scene.js';
import { createLensSlots } from './lenses.js';
import { createHeat } from './heat.js';
import { renderLegend, renderHeatTable } from './legend.js';
import { heatScale, isoLevels, heatCallouts } from '../../engine/mesh/heat.js';
import { createFrame } from './frame.js';
import { createChart, createShadow } from './backdrop.js';
import { TIER_SETTINGS } from './tiers.js';
import {
  createLabels,
  place,
  initHeatLabels,
  setHeatLabels,
  clearHeatLabels,
  layoutHeatLabels,
  prepareHeatLabels,
  commitHeatLabels,
  setLabelAvoid,
  settleNote,
  calloutsFit,
  cornerLow,
} from './labels.js';
import { createControls } from './controls.js';
import { createFullscreen } from './fullscreen.js';
import {
  cameraContext,
  compareContext,
  compareEye,
  presetPoses,
  chartRect,
  chartHidden,
  sideEye,
  nearTempleFade,
  fitBoxDistance,
  FOV_DEG,
} from './camera-math.js';
import { enableBarThumb, disableBarThumb, holdBarThumb } from '../summary-bar.js';
import { createCompare3d } from './compare3d.js';
import { thickest } from '../../state/compare.js';
import { createRefraction } from './refraction.js';
import { createRefMode, writeRefTech, deviceStartTier } from './ref-mode.js';
import { showRefNoPicture, hideRefNoPicture } from './ref-size.js';
import { initGuard, nextGuard } from '../../state/guard.js';

const SLOTS = /** @type {const} */ (['OD', 'OS']);
/** Stale-geometry badge delay (UI-SPEC States: "not yet done for > 100 ms"). */
const BADGE_AFTER_MS = 100;
/** Eye label gap below the lowest outline point (mm). */
const LABEL_GAP_MM = 6;
const EYE_KEY = { OD: 'view.eye.od', OS: 'view.eye.os' };
/** Mesh jobs kept for the test handle meshJobs(). */
const JOB_LOG = 10;
/** Canvas accessible-name debounce (UI-SPEC Canvas accessible name: 500 ms). */
const ARIA_DEBOUNCE_MS = 500;
/** A3 (03-14): the keyboard hint shows this long after a keyboard focus, then fades [BP]. */
const KEYS_SHOW_MS = 4000;
/** A3: fade-out duration (style.css .view-keys--fading uses the same 300 ms) [BP]. */
const KEYS_FADE_MS = 300;
/** 03-15: the bar thumbnail is shown at 48 × 36 CSS px, a 4:3 crop (UI-SPEC Phone section). */
const THUMB_CSS_W = 48;
const THUMB_ASPECT = 4 / 3;
/**
 * 03-LC (lens-critic MINOR 3, amendment A5): self-timing guard. A thumbnail frame (pass + copy)
 * longer than the long-task threshold, 50 ms (W3C Long Tasks API, https://www.w3.org/TR/longtasks-1/:
 * "Long task refers to any of the following occurrences whose duration exceeds 50ms"), THUMB_SLOW_RUN
 * times in a row turns the thumbnail off for the session; the bar keeps its text. Two in a row, so
 * a single slow first frame (shader warm-up) does not count.
 */
const THUMB_SLOW_MS = 50;
const THUMB_SLOW_RUN = 2;
// Test-only (?thumbguardoff, read once like ?calloutsoff): the guard measures but never trips, so
// the UX-03 thumbnail specs can still prove the thumbnail under SwiftShader (≈ 1 s per frame).
const THUMB_GUARD_OFF = location.search.includes('thumbguardoff');
/** Below the desktop breakpoint, the query of summary-bar.js NARROW (the bar exists only there). */
const NARROW = '(max-width: 899.98px)';
const RAD = Math.PI / 180;
// 03-15 test-only user timings (?perfmarks, as pipeline.js since 02-20): 'u:view-remesh' =
// requestMesh → the render that shows the attached mesh, 'u:view-input-paint' = the input event of
// the request → that render (once per input). Not emitted without the flag.
const PERF_MARKS = location.search.includes('perfmarks');

// Test-only (?failframe=<mm>, read once like ?perfmarks): a frame item whose rim depth equals this
// value is sent with rimDepthMm −1, so the worker's own validation returns ok: false through the
// real path. It changes no number (the rim depth is display only).
const FAIL_FRAME = (() => {
  const v = Number(new URLSearchParams(location.search).get('failframe'));
  return Number.isFinite(v) && v > 0 ? v : null;
})();

/** Lens key: the eye, every surfaces field, the shape, A and B (not DBL: a DBL change only moves; the A slot is recentred). */
const lensKey = (eye, surfaces, f) => JSON.stringify([eye, surfaces, f.shape, f.A, f.B]);

/** The no-WebGL note in the stage (D-17): info icon + text, textContent only. */
function showNoWebgl() {
  const status = $('view-status');
  const text = document.createElement('span');
  text.textContent = t('view.noWebgl');
  status.classList.add('view-note');
  status.replaceChildren(icon('info'), text);
  showUnavailable('tech.view.reason.noWebgl');
  // A-IN-05 for the no-WebGL state (03-17 finding): there is nothing to turn or zoom, so the
  // preset buttons, the keyboard hint and the stage's tab stop go away, and the empty canvas
  // leaves the accessibility tree. The note in #view-status stays.
  $('view-tools').hidden = true;
  $('view-keys').hidden = true;
  $('view-canvas').setAttribute('aria-hidden', 'true');
  const stage = $('view-stage');
  stage.removeAttribute('tabindex');
  stage.removeAttribute('aria-describedby');
}

/** Technische Angaben: why the 3D view is not available (reason key), or hidden for null. */
function showUnavailable(reasonKey) {
  const el = $('tech-view-unavailable');
  el.textContent = reasonKey ? t('tech.view.unavailable', { reason: t(reasonKey) }) : '';
  el.hidden = !reasonKey;
}

/**
 * @typedef {{ shape: string, A: number, B: number, DBL: number }} ViewFrame
 * @typedef {{ result: any, frame: ViewFrame | null } | null} ViewEye
 * @typedef {{ rimDepthMm: number, rimAssumed?: boolean, templeMm: number | null, templeSource: 'stamp' | 'assumed' }} ViewDisplay
 *   templeMm null = no temple on the stamp (TEMPLE_DEFAULT_MM, 'angenommener Wert')
 * @typedef {{ A: { OD: any, OS: any } | null, specA: { OD: { frame: ViewFrame } | null, OS: { frame: ViewFrame } | null },
 *   showA: boolean }} ViewCompare
 *   03-14: A = the LensResults of configuration A (null while computing or on error), specA its specs
 * @typedef {{ eyes: { OD: ViewEye, OS: ViewEye }, frame?: ViewFrame | null, display?: ViewDisplay,
 *   current: boolean, compare?: ViewCompare | null, inputTs?: number | null }} ViewInputs
 *   inputTs = the input event time of the latest main request (03-15 user timing, 04-10 guard t0)
 *   frame = the frame of the last input (drawn alone when no eye has a shown result)
 */

/** B-WR-09 (code review): the view of the first successful mount; it has no teardown. */
let mounted = null;

/**
 * Mount once: a second call returns the first view instead of creating a second renderer state,
 * mesh worker and set of listeners on the same nodes (pipeline.js no longer retries a mount).
 * @param {{ slot: HTMLElement }} o
 * @returns {{ update: (inputs: ViewInputs) => void }}
 */
export function mountView(o) {
  mounted ??= mount(o);
  return mounted;
}

/**
 * @param {{ slot: HTMLElement }} o
 * @returns {{ update: (inputs: ViewInputs) => void }}
 */
function mount({ slot }) {
  const viewEl = /** @type {HTMLElement} */ (slot.querySelector('#view'));
  // 04-08: #view[data-pending] carries the mesh lane ('load' | 'mesh' | '') and, in Durchblick,
  // the warp lane: 'warp' until the current warp is drawn wins over the mesh state.
  let pendingMesh = viewEl.dataset.pending ?? '';
  let pendingWarp = false;
  const writePending = () => {
    const v = pendingWarp ? 'warp' : pendingMesh;
    if (viewEl.dataset.pending !== v) viewEl.dataset.pending = v;
  };
  const setPending = (v) => {
    pendingMesh = v;
    writePending();
  };
  const setWarpPending = (/** @type {boolean} */ on) => {
    pendingWarp = on;
    writePending();
  };
  // 04-08: Technische Angaben names the Durchblick eye point and its sources (engine constants).
  writeRefTech();
  const badge = /** @type {HTMLElement} */ (slot.querySelector('.view-badge'));
  const setBadge = (key) => {
    const text = key ? t(key) : '';
    if (badge.textContent !== text) {
      badge.textContent = text;
      if (avoidReady) updateAvoid();
    }
  };
  let avoidReady = false;
  let avoidKey = '';
  /** 03-14: the badge box (stage px) of the last measure, for the A/B captions. */
  let badgeBox = null;
  /** The fullscreen button's box (stage px), kept clear like the badge. */
  let fsBox = null;
  const fsButton = /** @type {HTMLButtonElement} */ (slot.querySelector('#view-fullscreen'));
  /** A3: keyboard hint 'off' (no keyboard focus) | 'shown' | 'fading' | 'hidden'. */
  let keysState = 'off';
  const keysEl = /** @type {HTMLElement} */ (slot.querySelector('#view-keys'));
  /**
   * 03-13: stage boxes no label may cover: the badge, and the keyboard hint while it is shown
   * (#view-stage:focus-visible). Measured on badge text, focus and size changes, never per frame.
   */
  let fsOn = false;
  function updateAvoid(inRender = false) {
    const stageEl = $('view-stage');
    const boxes = [];
    badgeBox = badge.offsetWidth > 0 ? { x: badge.offsetLeft, y: badge.offsetTop, w: badge.offsetWidth, h: badge.offsetHeight } : null;
    if (badgeBox) boxes.push(badgeBox);
    // The button's two places from its right inset (equal to its top inset, CSS), whichever it is in now.
    let corner = null;
    fsBox = null;
    if (fsButton.offsetWidth > 0) {
      // 04-12 (F-02): the picture area (#view-labels, row 1 of the fullscreen grid), not the whole
      // stage: in fullscreen the info panel below it is no place for the button.
      const area = $('view-labels');
      const w = fsButton.offsetWidth;
      const h = fsButton.offsetHeight;
      const inset = area.clientWidth - fsButton.offsetLeft - w;
      fsBox = { x: fsButton.offsetLeft, y: inset, w, h };
      corner = { top: fsBox, low: { x: fsButton.offsetLeft, y: area.clientHeight - inset - h, w, h } };
    }
    // In fullscreen the hint (outside the stage) is covered: its box would only cost callouts.
    if (!fsOn && stageEl.matches(':focus-visible') && keysState !== 'hidden') {
      // 03-CI: in #view-labels coordinates (the stage's padding box, like the badge's offsetTop),
      // not the border box: the 1 px stage border otherwise lets a label overlap the hint by 1 px.
      const b = stageEl.getBoundingClientRect();
      const s = { left: b.left + stageEl.clientLeft, top: b.top + stageEl.clientTop, right: b.right - stageEl.clientLeft, bottom: b.bottom - stageEl.clientTop };
      const k = keysEl.getBoundingClientRect();
      const top = Math.max(k.top, s.top) - s.top;
      const bottom = Math.min(k.bottom, s.bottom) - s.top;
      if (bottom > top) boxes.push({ x: Math.max(k.left, s.left) - s.left, y: top, w: Math.min(k.right, s.right) - Math.max(k.left, s.left), h: bottom - top });
    }
    const key = JSON.stringify([boxes, corner]);
    if (key === avoidKey) return; // a mouse focus shows no hint: nothing to settle mid-drag
    avoidKey = key;
    setLabelAvoid(boxes, corner);
    if (mode === 'heat') requestSettle(inRender);
  }

  const view = createScene(/** @type {HTMLCanvasElement} */ ($('view-canvas')));
  if (view === null) {
    // D-17: the note replaces the view; numbers, comparison and cross-section are unaffected.
    showNoWebgl();
    $('view-mode').remove();
    setPending('');
    // 04-09 (UI-SPEC States, T-04-39): the engine size block is still shown, without the picture notes.
    return {
      update: (inputs) => {
        showRefNoPicture(inputs?.eyes);
        setPending('');
      },
    };
  }
  hideRefNoPicture(); // a successful retry after a failed chunk (pipeline.js painted it)
  setText('view-caption', t('view.caption.glass'));
  // ---- 03-15 (UX-03, D-14, R1-8): the phone bar thumbnail ----
  const thumbCanvas = /** @type {HTMLCanvasElement | null} */ (document.querySelector('#bar-view-slot canvas.bar-thumb'));
  const narrowMq = window.matchMedia(NARROW);
  const barEl = $('summary-bar');
  /** A thumbnail was asked for and not copied yet (re-asked when the bar or the breakpoint shows it). */
  let thumbDirty = false;
  /** Test-only thumbInfo() data of the last copy. */
  let thumbLast = null;
  /** MINOR 3: tripped = off for the session, the last frame's ms, frames copied. */
  const thumbGuard = { tripped: false, lastMs: null, frames: 0 };
  /** F-06 (m5, 04-10): the slow run lives in the pure guard (04-05), a two-state order on → off. */
  let thumbRun = initGuard('on');
  /** @param {boolean} [inRender] called right before a render that will carry it */
  function requestThumb(inRender = false) {
    if (!thumbCanvas || thumbGuard.tripped) return;
    thumbDirty = true;
    view.requestThumb(inRender);
  }
  const heat = createHeat(view.scene);
  const lenses = createLensSlots(view.scene, [...SLOTS, 'A'], heat.material);
  /** 03-12: 'glass' | 'heat'; 04-08: | 'ref' (Durchblick). Not persisted; Glas is the default. */
  let mode = 'glass';
  const modeBadge = () => (mode === 'heat' ? 'view.badge.heat' : mode === 'ref' ? 'view.badge.ref' : 'view.badge.glass');
  /** 04-08: the mesh lane writes the badge only outside the Durchblick (ref-mode owns it there). */
  const setMeshBadge = (key) => {
    if (mode !== 'ref') setBadge(key);
  };
  const frame = createFrame(view.scene, { OD: lenses.group('OD'), OS: lenses.group('OS') });
  const chart = createChart(view.scene, view.renderer, TIER_SETTINGS[view.tier()].chart);
  const shadow = createShadow(view.scene);
  // 03-14: the compare frame (configuration A); its lens z is set by compare3d from lensZ().
  const frameA = createFrame(view.scene, {});
  const labelsEl = $('view-labels');
  /** 03-14: the comparison of the last input (null: none): { eye, A, specA, showA }. */
  let cmp = null;
  /** νe per slot of the last input (null: none, e.g. a custom material without νe). */
  let abbe = { OD: null, OS: null, A: null };
  /** Technische Angaben tier line; dispersion 'on' only when a slot actually gets dispersion. */
  const writeTier = () => {
    const tier = view.tier();
    const on = SLOTS.some((s) => lenses.dispersion(s) > 0);
    const dispersion = t(on ? 'tech.view.dispersion.on' : 'tech.view.dispersion.off');
    setText('tech-view-tier', t(`tech.view.tier.${tier}`, { dispersion }));
  };
  const setDispersion = () => {
    lenses.setDispersion(view.tier(), abbe);
    writeTier();
  };
  view.onTier((_tier, s) => {
    chart.setSize(s.chart);
    setDispersion();
    requestThumb();
  });
  setDispersion();
  /** While the GL context is lost, a mesh attach must not clear the status message. */
  let contextLost = false;
  view.onContext((state) => {
    contextLost = state !== 'restored';
    if (state === 'lost') setText('view-status', t('view.contextLost'));
    else if (state === 'gone') {
      setText('view-status', t('view.contextGone'));
      showUnavailable('tech.view.reason.paused');
    } else {
      chart.reupload();
      shadow.reupload();
      refraction?.reupload(); // 04-08: redrawn from the last warp
      if (mode === 'ref') refMode.restoreStatus();
      else setText('view-status', '');
      showUnavailable(null);
      requestThumb();
    }
  });
  const labels = createLabels(labelsEl, SLOTS.length);
  initHeatLabels(labelsEl, $('view-callout-note'));
  // 03-14: after the label pools, so the eye labels stay the first .view-label nodes (e2e order).
  const compare3d = createCompare3d({
    renderer: view.renderer,
    scene: view.scene,
    camera: view.camera,
    lenses,
    frame,
    frameA,
    shadow,
    labelsEl,
    stageEl: $('view-stage'),
  });
  view.setPass(compare3d.renderPass);
  /** 03-13 (MINOR 5): write #view-callout-note after the next layout (a settle point). */
  let settlePending = false;
  /** @param {boolean} [inRender] called inside a render: its afterRender runs the settle */
  const requestSettle = (inRender = false) => {
    settlePending = true;
    if (!inRender) view.requestRender();
  };
  /** Per eye: label anchor (world mm) or null. */
  const anchors = { OD: null, OS: null };
  let labelKey = null;
  /** Last frame seen on any eye: a blocked eye (no input spec) has none of its own. */
  let knownFrame = null;
  view.afterRender(() => {
    if (mode === 'ref') {
      // 04-08: no 3D labels over the Durchblick; its own eye pills are laid out by refAfterRender.
      for (const el of labels.pool) if (!el.hidden) el.hidden = true;
      compare3d.hideOverlay(); // 04-11: no 3D "Vorher (A)" / "Nachher (B)" captions over the A/B Durchblick
      refAfterRender();
      return;
    }
    const size = { width: labelsEl.clientWidth, height: labelsEl.clientHeight };
    const cs = compare3d.state();
    const caps = compare3d.layoutCaptions([badgeBox, fsBox].filter(Boolean));
    if (cs.active) {
      // 03-14: no eye labels in the A/B layout (one eye, two configurations; the captions say which).
      for (const el of labels.pool) if (!el.hidden) el.hidden = true;
      if (mode === 'heat') {
        // Round 2 MINOR 4: both halves are laid out first, then the callouts are decided once.
        const halves = cs.split ? ['A', 'B'] : [cs.shown];
        commitHeatLabels(
          halves.map((half) => {
            const b = compare3d.halfBox(half);
            const prep = compare3d.withHalf(half, () => prepareHeatLabels(half, view.camera, { width: b.w, height: b.h }, []));
            return { prep, offsetX: b.x, half: cs.split ? half : null, avoid: caps };
          }),
        );
      }
      if (settlePending) {
        settlePending = false;
        settleNote();
      }
      return;
    }
    if (mode === 'heat') {
      // 03-13: one layout for callouts > eye labels > iso labels (labels.js, label-layout.js).
      layoutHeatLabels(view.camera, size, SLOTS.map((eye, i) => ({ el: labels.pool[i], world: anchors[eye] })));
    }
    if (settlePending) {
      settlePending = false;
      settleNote();
    }
    if (mode === 'heat') return;
    const shown = SLOTS.map((eye, i) => anchors[eye] !== null && place(labels.pool[i], anchors[eye], view.camera, size));
    // 03-11: from the side both labels project onto almost one point and the farther one covered
    // the nearer one ('L' over 'R' in Seite). Within the side-view cone (nearTempleFade) and only
    // when the two overlap, the label of the eye nearer to the camera is shown; that eye's lens is
    // the one in front. Outside that cone both stay (a wide 'L – nicht berechnet' may touch 'R'
    // on a phone in the default view; hiding it there would lose the blocked-eye text).
    const c = view.camera.position;
    const sideCone = () => {
      const tg = controls.state().target;
      return nearTempleFade({ x: c.x - tg.x, y: c.y - tg.y, z: c.z - tg.z }) !== null;
    };
    if (shown[0] && shown[1] && sideCone()) {
      const [a, b] = labels.pool.map((el) => el.getBoundingClientRect());
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        const d = (eye) => Math.hypot(anchors[eye].x - c.x, anchors[eye].y - c.y, anchors[eye].z - c.z);
        labels.pool[d('OD') <= d('OS') ? 1 : 0].hidden = true;
      }
    }
  });
  // After the label layout (hooks run in order): the fullscreen button yields the top-right corner
  // to the Dickenkarte callouts when only that makes them fit (labels.js commitHeatLabels).
  view.afterRender(() => {
    const low = mode === 'heat' && cornerLow();
    if (fsButton.classList.contains('view-fs--low') !== low) fsButton.classList.toggle('view-fs--low', low);
  });
  // Compile the glass and edge programs while the mesh worker builds the first lenses.
  // compileAsync prepares every mesh's material, visible or not (WebGLRenderer r187 scene.traverse).
  // Without KHR_parallel_shader_compile it compiles synchronously and warns, so the first render
  // compiles instead (SwiftShader in headless Chromium has no such extension).
  if (view.renderer.extensions.has('KHR_parallel_shader_compile')) {
    view.renderer.compileAsync(view.scene, view.camera).then(view.requestRender, (err) => console.warn('3D view: compile', err));
  } else {
    // 03-11: the faded temple materials are only rendered after a side view; compile their hidden
    // carriers now (synchronous compile(), no warning), so the first Seite builds no program.
    view.renderer.compile(frame.fadeCarrier, view.camera, view.scene);
    // 03-12: the same for the heat material's hidden carrier (MINOR 1 rebuttal).
    view.renderer.compile(heat.carrier, view.camera, view.scene);
  }

  let workerReallocs = 0;
  /** @type {ViewInputs | null} */
  let last = null;
  /** Key of the item last attached per slot from a current reply (null = nothing attached). */
  const attachedKey = { OD: null, OS: null, A: null, frame: null, frameA: null };
  /** 03-14: the eye the attached A lens / frameA rim were built for. */
  const attachedEyeA = { A: null, frameA: null };
  /** 03-14: the keys the current comparison wants in the A slots (null: none). */
  const wantKey = { A: null, frameA: null };
  /** The last requestMesh without its reply yet: { gen, sig } (sig = the sent slots and keys). */
  let outstanding = null;
  /** Slot lists of the last JOB_LOG jobs sent (test handle meshJobs). */
  const jobLog = [];
  let attachedOnce = false;
  let retryLeft = true;
  /** B-WR-06: the last mesh job was lost twice and #view-status shows the failure. */
  let meshFailed = false;
  /** Request data per mesh generation (the reply carries slot and buffers only). */
  const metaByGen = new Map();
  /** performance.now() of each requestMesh, for the re-mesh time (Pitfall 12: 3D only). */
  const sentAtByGen = new Map();
  /** ?perfmarks: input event time per mesh generation, and the last input already measured. */
  const inputAtByGen = new Map();
  let measuredInput = null;
  /** Latest boxing placement per eye (a DBL change moves the lens without a re-mesh). */
  const placement = { OD: null, OS: null };
  let badgeTimer = null;
  let stash = null;
  let paintFrame = null;
  /** 04-09 (M4): a re-mesh deferred while the Durchblick stage is on screen; mesh jobs sent (test handle). */
  let meshDeferred = false;
  let meshSent = 0;

  const giveBackAll = (items) => {
    for (const it of items ?? []) {
      if (!it) continue;
      if (it.slot === 'frame') frame.giveBack(it.buffers);
      else if (it.slot === 'frameA') frameA.giveBack(it.buffers);
      else lenses.giveBack(it.slot, it.buffers);
    }
  };
  const clearBadgeTimer = () => {
    if (badgeTimer !== null) clearTimeout(badgeTimer);
    badgeTimer = null;
  };

  /** @type {Worker | null} */
  let worker = null;
  const client = createMeshClient({
    send: (msg) => /** @type {Worker} */ (worker).postMessage(msg, transferOf(msg)),
    onMesh,
    onFallback: () => {
      worker?.terminate();
      worker = null;
    },
    loadSyncHandler: () => import('../../state/mesh-protocol.js'),
    isHidden: () => document.hidden,
  });
  try {
    worker = new Worker(new URL('../../worker/mesh.worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e) => client.receive(e.data));
    worker.addEventListener('error', () => client.workerError());
    worker.addEventListener('messageerror', () => client.workerError());
  } catch {
    client.workerError();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) client.resume();
  });

  function onMesh(d) {
    if (d.items) for (const it of d.items) if (it?.reallocated) workerReallocs++;
    if (d.items === null) {
      // The job's buffers are lost (dead worker / error reply): the next take allocates. Rebuild
      // the current request once, so the view does not keep an old mesh until the next input.
      for (const slotName of Object.keys(metaByGen.get(d.gen) ?? {})) {
        if (slotName === 'frame') frame.lose();
        else if (slotName === 'frameA') frameA.lose();
        else lenses.lose(slotName);
      }
      metaByGen.delete(d.gen);
      if (outstanding?.gen === d.gen) outstanding = null;
      if (d.current && last && retryLeft) {
        retryLeft = false;
        update(last);
      } else if (d.current) {
        // B-WR-06: lost twice. Say so (the UI-SPEC load-failure text, Fehler tier) instead of
        // 'wird aufgebaut' or a stale 'wird aktualisiert' forever; an old mesh stays drawn. The next
        // input builds again, and its attach clears the message (paintMesh).
        clearBadgeTimer();
        setPending('');
        if (attachedOnce) setMeshBadge(modeBadge());
        // 04-08: the Durchblick does not show the 3D mesh, so its stage keeps its own status.
        if (!contextLost && mode !== 'ref') {
          meshFailed = true;
          $('view-status').classList.add('view-failed');
          setText('view-status', t('view.loadFailed'));
          showUnavailable('tech.view.reason.error');
        }
      }
      return;
    }
    if (!d.current) {
      giveBackAll(d.items);
      return;
    }
    if (stash) giveBackAll(stash.items);
    stash = d;
    if (paintFrame === null) paintFrame = requestAnimationFrame(paintMesh);
  }

  function paintMesh() {
    paintFrame = null;
    const d = stash;
    stash = null;
    if (!d) return;
    // Second check in the paint frame: an input may have arrived after the reply (T-03-14).
    if (!client.isMeshCurrent(d.gen)) {
      giveBackAll(d.items);
      return;
    }
    const meta = metaByGen.get(d.gen) ?? {};
    for (const g of metaByGen.keys()) if (g <= d.gen) metaByGen.delete(g);
    const sentAt = sentAtByGen.get(d.gen);
    for (const g of sentAtByGen.keys()) if (g <= d.gen) sentAtByGen.delete(g);
    const inputAt = inputAtByGen.get(d.gen);
    for (const g of inputAtByGen.keys()) if (g <= d.gen) inputAtByGen.delete(g);
    if (outstanding?.gen === d.gen) outstanding = null;
    // Lenses first, then the frame: the frame sets both lens groups' z in this same paint frame.
    const isFrame = (it) => it?.slot === 'frame' || it?.slot === 'frameA';
    const items = [...d.items].sort((a, b) => isFrame(a) - isFrame(b));
    for (const it of items) {
      const m = meta[it?.slot];
      if (!m) {
        giveBackAll([it]);
        continue;
      }
      if (it.slot === 'frame') {
        frame.attach(it, m);
        writeTech(frame.visible() ? it : null, m);
        if (frame.visible()) shadow.fit(it.boundingSphere, m.B);
        else shadow.hide();
      } else if (it.slot === 'frameA') {
        frameA.attach(it, m);
        attachedEyeA.frameA = m.eye;
      } else if (it.slot === 'A') {
        lenses.attach('A', it, { surfaces: m.surfaces, eye: m.eye, A: m.frame.A, DBL: m.DBL });
        attachedEyeA.A = m.eye;
      } else {
        const p = placement[m.eye];
        lenses.attach(it.slot, it, { surfaces: m.surfaces, eye: m.eye, A: m.frame.A, DBL: p?.DBL ?? m.DBL });
      }
      attachedKey[it.slot] = m.key;
    }
    // This reply is current, so `placement` is the placement it was requested with.
    for (const s of SLOTS) {
      const p = placement[s];
      if (p) lenses.place(s, s, p.A, p.DBL);
    }
    updateLabels(drawnLenses()); // a mesh that came back not drawable reads 'nicht berechnet' too
    if (!attachedOnce) compare3d.warmUp();
    attachedOnce = true;
    syncCompare();
    refresh();
    for (const b of presetButtons) b.disabled = false;
    controls.enable();
    for (const r of modeRadios) r.disabled = false;
    paintHeat();
    retryLeft = true;
    clearBadgeTimer();
    if (!contextLost && mode !== 'ref') setText('view-status', '');
    if (meshFailed && !contextLost) {
      meshFailed = false;
      $('view-status').classList.remove('view-failed');
      showUnavailable(null);
    }
    setMeshBadge(last?.current === false ? 'view.badge.updating' : modeBadge());
    setPending('');
    // Carried by the render below (2 passes, scene.js). B-WR-03: a reply is attached only when it is
    // current, so no newer mesh job is in flight here; while one is, thumbSpec() says 'not now'.
    requestThumb(true);
    view.render();
    if (PERF_MARKS) {
      const end = performance.now();
      if (sentAt !== undefined) performance.measure('u:view-remesh', { start: sentAt, end });
      if (typeof inputAt === 'number' && inputAt !== measuredInput) {
        measuredInput = inputAt;
        performance.measure('u:view-input-paint', { start: inputAt, end });
      }
    }
    if (sentAt !== undefined) setText('tech-view-remesh', t('tech.view.remesh', { ms: fmtMs(performance.now() - sentAt) }));
    scheduleAria();
  }

  const drawnLenses = () => new Set(SLOTS.filter((s) => lenses.visible(s)));

  /** Technische Angaben: the drawn temple length with its source, and the rim face width. */
  function writeTech(item, m) {
    if (!item) {
      setText('tech-view-temple', '');
      setText('tech-view-rimface', '');
      return;
    }
    let source;
    if (m.templeSource !== 'stamp') source = t('tech.view.templeSource.assumed');
    else if (item.templeMm === m.templeMm) source = t('tech.view.templeSource.stamp');
    else {
      // 03-03 clamp (TEMPLE_RANGE_MM, assumed): never print the stamp value next to another drawing.
      const [min, max] = TEMPLE_RANGE_MM.map(fmtMm);
      source = t('tech.view.templeSource.clamped', { stamp: fmtMm(m.templeMm), min, max });
    }
    setText('tech-view-temple', t('tech.view.temple', { len: fmtMm(item.templeMm), source }));
    setText('tech-view-rimface', t('tech.view.rimFace', { w: fmtMm(FRAME_FACE_MM) }));
  }

  /** Side eye (MINOR 13): larger total edge protrusion at the current rim depth; ties → OD. In A/B the compared eye. */
  function currentSideEye() {
    if (cmp) return cmp.eye;
    const rim = last?.display?.rimDepthMm;
    const total = (eye) => {
      const r = last?.eyes[eye]?.result;
      if (!r?.ok || !lenses.visible(eye) || !(rim > 0)) return null;
      const s = bevelSplit(r.metrics.etMax.value, rim);
      return s.front + s.back;
    };
    return sideEye({ OD: total('OD'), OS: total('OS') });
  }

  /** 03-14: lens-local camera data of the A (Vorher) and B (Nachher) lens of the compared eye. */
  function compareCtx() {
    const eye = cmp.eye;
    const aReady = attachedEyeA.A === eye && attachedEyeA.frameA === eye;
    const local = (sphere, z) => (sphere ? { ...sphere, z: sphere.z + z } : null);
    const fa = aReady ? frameA.localEye(eye) : null;
    const fb = frame.localEye(eye);
    return compareContext({
      aspect: compare3d.aspect(),
      eye,
      lensSpheres: [aReady ? local(lenses.sphere('A'), frameA.lensZ()[eye]) : null, local(lenses.sphere(eye), lenses.group(eye).position.z)],
      sideTargets: { A: fa?.sideTarget ?? null, B: fb?.sideTarget ?? null },
      eyeBoxes: { A: fa?.box ?? null, B: fb?.box ?? null },
    });
  }

  const cameraCtx = () =>
    compare3d.state().active
      ? compareCtx()
      : cameraContext({ frameData: frame.cameraData(), lensRadius: lenses.unionRadius(SLOTS), aspect: view.camera.aspect, side: currentSideEye() });

  /** New limits (R1-4), chart rectangle (A2) and, unless turned freely, the current preset pose. */
  function refresh() {
    const ctx = cameraCtx();
    if (!(ctx.full.r > 0)) return;
    controls.refresh();
    const p = presetPoses(ctx);
    chart.setRect(chartRect([p.default, p.front, p.heatOD, p.heatOS], controls.limits(), ctx.aspect));
    view.requestRender();
  }

  /** Protrusion block (D-19): memo key of the last painted state. */
  let protrusionKey = null;
  const leadMemo = { OD: { key: null, value: NaN }, OS: { key: null, value: NaN }, A: { key: null, value: NaN } };
  /** etMax and the front-surface lead (frontLeadMm, memoised per slot) of one result, or null. */
  function protrusionOf(slot, eye, result, frameSpec, rim) {
    if (!result?.ok || !frameSpec) return null;
    const { shape, A, B } = frameSpec;
    const key = JSON.stringify([result.surfaces, shape, A, B, eye, rim]);
    if (leadMemo[slot].key !== key) {
      leadMemo[slot] = { key, value: frontLeadMm(result.surfaces, frameOutline(shape, A, B, eye), rim).value };
    }
    return { etMax: result.metrics.etMax.value, lead: leadMemo[slot].value };
  }
  /**
   * lens-critic M2 (03-LC): while comparing, only the compared eye, as a 'Vorher (A)' pair (A's
   * result and frame from the compare input; left out while A computes) and a 'Nachher (B)' pair,
   * in the OD and OS paragraphs in that order. Outside a comparison one pair per computed eye.
   */
  function paintProtrusion() {
    const disp = last?.display;
    const rim = disp?.rimDepthMm;
    const has = rim > 0;
    /** @type {[string, { etMax: number, lead: number } | null][]} */
    let rows;
    if (cmp) {
      const eye = cmp.eye;
      const a = has ? protrusionOf('A', eye, cmp.A?.[eye], cmp.specA?.[eye]?.frame, rim) : null;
      const b = has ? protrusionOf(eye, eye, last.eyes[eye]?.result, last.eyes[eye]?.frame, rim) : null;
      rows = [['A', a], ['B', b]];
    } else {
      rows = SLOTS.map((eye) => [eye, has ? protrusionOf(eye, eye, last?.eyes[eye]?.result, last?.eyes[eye]?.frame, rim) : null]);
    }
    const key = JSON.stringify([rows, rim, disp?.rimAssumed]);
    if (key === protrusionKey) return;
    protrusionKey = key;
    const shown = rows.filter(([, v]) => v !== null);
    $('view-protrusion').hidden = shown.length === 0 || mode === 'ref'; // 04-08: hidden in Durchblick
    if (shown.length === 0) return;
    const display = { rimDepthMm: rim, rimAssumed: disp.rimAssumed !== false };
    const p = cmp
      ? protrusionCompareLines({ A: rows[0][1], B: rows[1][1] }, display)
      : protrusionLines({ OD: rows[0][1], OS: rows[1][1] }, display);
    // The lines come in row order without the empty rows: outside a comparison each eye keeps its
    // own paragraphs (a blocked OD leaves the OD pair empty); while comparing they fill from the top.
    let i = 0;
    SLOTS.forEach((eye, slot) => {
      const fill = cmp ? slot < p.lines.length : rows[slot][1] !== null;
      setText(`view-protrusion-${eye.toLowerCase()}`, fill ? p.lines[i] : '');
      setText(`view-protrusion-lead-${eye.toLowerCase()}`, fill ? p.leads[i] : '');
      if (fill) i++;
    });
    setText('view-protrusion-assumed', p.assumed ?? '');
    setText('view-protrusion-bevel', p.bevel);
  }

  /** The view name in words (view.viewName.*); Seite names the side eye. */
  function viewNameText() {
    const name = controls.viewName();
    if (name !== 'side') return t(`view.viewName.${name}`);
    return t('view.viewName.side', { eye: t(currentSideEye() === 'OS' ? 'view.viewName.os' : 'view.viewName.od') });
  }

  /** #view-canvas accessible name (D-29) from the painted card strings; setAttribute only (T-03-29). */
  const canvasEl = $('view-canvas');
  let ariaTimer = null;
  function writeAria() {
    ariaTimer = null;
    if (mode === 'ref') {
      // 04-08 (D-05): the Durchblick name from the same engine size strings (ref-mode.js refAria).
      const label = refAriaLabel();
      if (label && canvasEl.getAttribute('aria-label') !== label) canvasEl.setAttribute('aria-label', label);
      return;
    }
    if (cmp) {
      // 03-14: thickest(m) of the compared eye per configuration, the card rule (fmtMm).
      const th = (r) => (r?.ok ? fmtMm(thickest(r.metrics).value) : '–');
      const label = t('view.aria.compare', {
        eye: t(cmp.eye === 'OS' ? 'view.viewName.os' : 'view.viewName.od'),
        viewName: viewNameText(),
        a: th(cmp.A?.[cmp.eye]),
        b: th(last?.eyes[cmp.eye]?.result),
      });
      if (canvasEl.getAttribute('aria-label') !== label) canvasEl.setAttribute('aria-label', label);
      return;
    }
    // B-CR-01: no drawable eye → no scale; the Glas name below says both eyes are not computed.
    if (mode === 'heat' && heatState?.scale) {
      const label = t('view.aria.heat', { viewName: viewNameText(), min: fmtMm(heatState.scale.min), max: fmtMm(heatState.scale.max) });
      if (canvasEl.getAttribute('aria-label') !== label) canvasEl.setAttribute('aria-label', label);
      return;
    }
    const OD = cardStrings('OD');
    const OS = cardStrings('OS');
    const f = last ? frameFor(last) : null;
    const materialId = (OD ?? OS)?.materialId;
    const label = ariaGlass({
      viewName: viewNameText(),
      OD,
      OS,
      frame: f ? { shape: t(`frame.shape.${f.shape}`), A: f.A, DBL: f.DBL } : null,
      material: materialId ? t(`material.${materialId}.title`) : '–',
    });
    if (canvasEl.getAttribute('aria-label') !== label) canvasEl.setAttribute('aria-label', label);
  }
  function scheduleAria() {
    if (ariaTimer !== null) clearTimeout(ariaTimer);
    ariaTimer = setTimeout(writeAria, ARIA_DEBOUNCE_MS);
  }

  const sideNote = $('view-side-note');
  const controls = createControls({
    camera: view.camera,
    stage: $('view-stage'),
    scene: view,
    getContext: cameraCtx,
    onSettle: (inRender) => {
      // 03-15: a preset settled (never a free orbit: the thumbnail pose does not follow the camera).
      if (controls.preset() !== 'free') requestThumb(inRender);
      requestSettle(inRender);
    },
    onPose: (name) => {
      sideNote.hidden = name !== 'side';
      if (name === 'side') {
        setText('view-side-note', t('view.side.note', { eye: t(currentSideEye() === 'OS' ? 'view.side.os' : 'view.side.od') }));
      }
      if (attachedOnce) scheduleAria();
    },
  });
  if (controls.pointer) setText('view-hint', t('view.hint.pointer'));
  /** 04-08 (D-10): the fullscreen button's enter label names the Durchblick there (title = name). */
  const applyFsLabel = () => {
    if (!fsOn) fsButton.setAttribute('title', t(mode === 'ref' ? 'view.fullscreen.enter.ref' : 'view.fullscreen.enter'));
  };
  // 04-12 (F-02, UI-SPEC "Fullscreen"): the blocks each mode moves into #view-fs-info while fullscreen
  // is on, in DOM order. Hidden ones move too (the picker and the degraded note can appear while
  // fullscreen is on); they stay hidden in the panel. Glas has none, so the panel stays hidden.
  const FS_BLOCKS = {
    glass: [],
    heat: ['view-legend', 'view-callout-note'],
    ref: ['view-hint', 'view-ref-lens', 'view-ref-eye', 'view-ref-size', 'view-ref-scope', 'view-ref-degraded'],
  };
  const fullscreen = createFullscreen({
    stage: $('view-stage'),
    button: fsButton,
    info: $('view-fs-info'),
    blocks: () => FS_BLOCKS[mode].map((id) => $(id)),
    onChange: (on) => {
      fsOn = on;
      applyFsLabel();
      controls.setFullscreen(on);
      updateAvoid();
      settleNote(); // 04-16 (m2): the table-only note names the way out of fullscreen
    },
  });

  /**
   * 03-15 (lens-critic MINOR 11): the thumbnail pose, or null for 'not now'. Front direction,
   * target = the centre of the frame-front box (both eye boxes: lens + rim, the bridge lies between
   * them; no temples), or in A/B the compare box of the shown configuration's eye (lens-local, as
   * compare3d draws it). The crop is the largest 4:3 rect centred in the shown viewport
   * (compare3d.shownRect: the whole canvas, or the A / B half while split, MINOR 5); the vertical
   * FOV spans that viewport's height, so the box is fitted with its half-extents scaled by
   * k = viewport height / crop height: fitBoxDistance(k·halfV, k·halfH, 4:3) (1,08 margin).
   * Only below 900 px with the bar shown, never while the camera moves (controls.busy()), and
   * never while a mesh job is in flight (B-WR-03: the copy would show the old mesh and cost a
   * keystroke frame; the wanted thumbnail waits in scene.js and the attach of that job carries it).
   */
  function thumbSpec() {
    if (thumbGuard.tripped) return null;
    // 04-09 (M4): in Durchblick the thumbnail runs as in Glas while the stage is off screen (its own
    // 3D pass, scene.js thumb.pass); on screen the re-mesh is deferred, so there is no current mesh.
    if (mode === 'ref' && (refMode.onScreen() || meshDeferred)) return null;
    if (!narrowMq.matches || barEl.hidden || barEl.classList.contains('thumb-off') || contextLost || !attachedOnce || controls.busy()) return null;
    if (outstanding !== null) return null;
    const ctx = cameraCtx();
    const e = ctx.eyeBox;
    const box = ctx.compare ? ctx.box : e ? { min: minOf(e.OD.min, e.OS.min, Math.min), max: minOf(e.OD.max, e.OS.max, Math.max) } : null;
    if (!box) return null;
    const r = compare3d.shownRect();
    if (!(r.w > 0 && r.h > 0)) return null;
    const cw = Math.min(r.w, r.h * THUMB_ASPECT);
    const ch = cw / THUMB_ASPECT;
    const k = r.h / ch;
    const distance = fitBoxDistance((k * (box.max.y - box.min.y)) / 2, (k * (box.max.x - box.min.x)) / 2, THUMB_ASPECT);
    const target = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    return {
      target,
      position: { x: target.x, y: target.y, z: target.z + distance },
      distance,
      viewportH: r.h,
      src: { x: r.x + (r.w - cw) / 2, y: r.y + (r.h - ch) / 2, w: cw, h: ch },
      boxes: ctx.compare ? { [ctx.side]: box } : { OD: e.OD, OS: e.OS },
    };
  }
  const minOf = (a, b, f) => ({ x: f(a.x, b.x), y: f(a.y, b.y), z: f(a.z, b.z) });
  /** Projected x width of a box under the thumbnail pose, in thumbnail CSS px (test-only). */
  function thumbWidthPx(spec, b) {
    const tanV = Math.tan((FOV_DEG / 2) * RAD);
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [b.min.x, b.max.x]) {
      for (const z of [b.min.z, b.max.z]) {
        const px = ((x - spec.target.x) / ((spec.distance - (z - spec.target.z)) * tanV)) * (spec.viewportH / 2);
        lo = Math.min(lo, px);
        hi = Math.max(hi, px);
      }
    }
    return ((hi - lo) / spec.src.w) * THUMB_CSS_W;
  }
  if (thumbCanvas) {
    view.setThumb({
      canvas: thumbCanvas,
      source: thumbSpec,
      // 04-09: the glasses, also while the main pass draws the Durchblick.
      pass: () => compare3d.renderPass(),
      // A4 (03-16): no backdrop in the thumbnail pass (eye chart, and the contact shadow, which the
      // front pose sees as a grey strip along the bottom edge): the glasses on the plain background.
      hide: [chart.mesh, shadow.mesh],
      onCopy(spec, ms) {
        thumbDirty = false;
        thumbGuard.frames++;
        thumbGuard.lastMs = ms;
        thumbRun = nextGuard(thumbRun, ms, { budgetMs: THUMB_SLOW_MS, need: THUMB_SLOW_RUN, last: 'off', down: () => 'off' });
        // ?thumbguardoff: the guard measures but never trips (the run is reset instead).
        if (THUMB_GUARD_OFF) thumbRun = initGuard('on');
        else if (thumbRun.tier === 'off') {
          thumbGuard.tripped = true;
          disableBarThumb();
          return;
        }
        if (!thumbLast) enableBarThumb();
        const lensWidthPx = { OD: null, OS: null };
        for (const [eye, b] of Object.entries(spec.boxes)) lensWidthPx[eye] = thumbWidthPx(spec, b);
        thumbLast = { lensWidthPx, renderViewports: compare3d.lastViewports(), src: { ...spec.src } };
      },
    });
    // A thumbnail asked for while the bar was hidden (or on a wide screen) is made when it shows.
    const reask = () => {
      if (thumbDirty && !thumbGuard.tripped && narrowMq.matches && !barEl.hidden && !barEl.classList.contains('thumb-off')) view.requestThumb();
    };
    new MutationObserver(reask).observe(barEl, { attributes: true, attributeFilter: ['hidden', 'class'] });
    narrowMq.addEventListener('change', reask);
  }
  const presetButtons = [...document.querySelectorAll('#view-tools [data-preset]')];
  for (const b of presetButtons) {
    b.addEventListener('click', () => controls.goTo(b.dataset.preset === 'reset' ? 'default' : b.dataset.preset));
  }

  // ---- 03-12 Dickenkarte ----
  const modeRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('#view-mode input[name=view-mode]')]);
  for (const r of modeRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (r.checked) setMode(/** @type {'glass' | 'heat' | 'ref'} */ (r.value));
    });
  }
  // 04-08 (D-09): three options stack one per row below a 400 px #view (Expert shows Dickenkarte).
  const modeEl = $('view-mode');
  const expertEl = /** @type {HTMLInputElement} */ ($('expert'));
  const syncStack = () => modeEl.classList.toggle('segmented--stack', expertEl.checked && viewEl.clientWidth < 400);
  expertEl.addEventListener('change', syncStack);
  new ResizeObserver(syncStack).observe(viewEl);
  syncStack();
  // Expert off while Dickenkarte is on → Glas (UI-SPEC Heatmap: Simple never shows the map).
  $('expert').addEventListener('change', (e) => {
    if (!(/** @type {HTMLInputElement} */ (e.target).checked) && mode === 'heat') {
      for (const r of modeRadios) r.checked = r.value === 'glass';
      setMode('glass');
    }
  });
  /** null until the first heat paint: { key, scale, levels, eye } of the last painted state. */
  let heatState = null;
  /** The eye picked in #view-heat-eye (null: the default rule applies on each delivery). */
  let pickedEye = null;
  const heatEyeEl = $('view-heat-eye');
  const heatEyeRadios = /** @type {HTMLInputElement[]} */ ([...heatEyeEl.querySelectorAll('input[name=view-heat-eye]')]);
  for (const r of heatEyeRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (r.checked) pickHeatEye(/** @type {'OD' | 'OS'} */ (r.value));
    });
  }
  /** 03-13: the picker moves the callouts and iso labels; the camera and the table stay (dev-1.7). */
  function pickHeatEye(eye) {
    pickedEye = eye;
    if (cmp || mode !== 'heat' || !heatState?.table?.[eye] || heatState.eye === eye) return;
    heatState.eye = eye;
    applyHeatLabels();
    scheduleAria();
  }
  /** 03-14: a lens group's position as drawn in the A/B pass (recentred, x = 0). */
  const centred = (get) => ({
    get position() {
      const p = get();
      return { x: 0, y: p.y, z: p.z };
    },
  });
  const centredB = centred(() => lenses.group(cmp?.eye ?? 'OD').position);
  const centredA = centred(() => ({ y: 0, z: frameA.lensZ()[cmp?.eye ?? 'OD'] }));

  /** Callouts and iso labels for heatState.eye (text-change path), picker state, then a settle. */
  function applyHeatLabels() {
    if (heatState?.compare) {
      // 03-14: Vorher (A) and Nachher (B) of the compared eye; only the shown one below 360 px.
      const c = heatState.compare;
      const cs = compare3d.state();
      heatEyeEl.hidden = true;
      for (const half of /** @type {const} */ (['A', 'B'])) {
        const v = c[half];
        if (v && (half === 'B' || c.aDrawn) && (cs.split || cs.shown === half)) {
          setHeatLabels({ eye: c.eye, lens: v.lens, metrics: v.metrics, callouts: v.callouts, levels: heatState.levels, group: half === 'A' ? centredA : centredB }, half);
        } else clearHeatLabels(half);
      }
      requestSettle();
      return;
    }
    const eye = heatState?.eye;
    const v = eye ? heatState.table?.[eye] : null;
    if (!v) {
      clearHeatLabels();
      heatEyeEl.hidden = true;
    } else {
      clearHeatLabels('A');
      setHeatLabels({ eye, lens: v.lens, metrics: v.metrics, callouts: v.callouts, levels: heatState.levels, group: lenses.group(eye) });
      heatEyeEl.hidden = false;
      for (const r of heatEyeRadios) {
        r.checked = r.value === eye;
        r.disabled = !heatState.table[r.value];
      }
    }
    requestSettle();
  }

  /** Drawn eyes with an ok result: { eye: { result, frame } }. */
  const heatEyes = () => SLOTS.filter((e) => last?.eyes[e]?.result?.ok && last.eyes[e].frame && lenses.visible(e));

  /**
   * MAJOR 4: the eye with the larger thickest point max(ct, etMax.value). Ties go to OD within
   * SIDE_TIE_MM (0,05 mm, half the 0,1 mm display step; the Seite rule, MINOR 13), so two eyes that
   * read the same on the cards (example: 4,6 / 4,6 mm) frame the right eye.
   */
  function defaultHeatEye(eyes) {
    const th = (e) => {
      if (!eyes.includes(e)) return null;
      const m = last.eyes[e].result.metrics;
      return Math.max(m.ct, m.etMax.value);
    };
    return sideEye({ OD: th('OD'), OS: th('OS') });
  }

  /** Scale, levels, legend and table from the engine for the drawn eyes (memo key per delivery). */
  function paintHeat() {
    if (mode !== 'heat') return;
    if (cmp) {
      paintHeatCompare();
      return;
    }
    const eyes = heatEyes();
    const key = JSON.stringify(eyes.map((e) => [e, last.eyes[e].result.surfaces, last.eyes[e].result.metrics, last.eyes[e].frame]));
    if (heatState?.key === key) return;
    const eye = pickedEye && eyes.includes(pickedEye) ? pickedEye : defaultHeatEye(eyes);
    if (eyes.length === 0) {
      heatState = { key, scale: null, levels: null, eye, table: null };
      $('view-legend').hidden = true;
      $('view-heat-table').hidden = true;
      $('view-heat-nochord').hidden = true;
      applyHeatLabels();
      return;
    }
    const scale = heatScale(eyes.map((e) => last.eyes[e].result.metrics));
    const levels = isoLevels(scale.min, scale.max);
    heat.setScale(levels);
    const table = { OD: null, OS: null };
    for (const e of eyes) {
      const { result, frame: f } = last.eyes[e];
      const lens = { surfaces: result.surfaces, frame: { shape: f.shape, A: f.A, B: f.B }, eye: e };
      table[e] = { callouts: heatCallouts(lens, result.metrics), metrics: result.metrics, lens };
    }
    heatState = { key, scale, levels, eye, table };
    $('view-legend').hidden = false;
    $('view-heat-table').hidden = false;
    renderLegend({ min: scale.min, max: scale.max, levels });
    renderHeatTable(table);
    applyHeatLabels();
    view.requestRender();
    scheduleAria();
  }

  /**
   * 03-14 (D-25): A/B Dickenkarte. One heatScale over all four lenses (A OD/OS when computed, the
   * drawn B eyes), isoLevels for the step; the table and the callouts for the compared eye.
   */
  function paintHeatCompare() {
    const eye = cmp.eye;
    const cs = compare3d.state();
    const bEyes = heatEyes();
    const aEyes = SLOTS.filter((e) => cmp.A?.[e]?.ok && cmp.specA[e]?.frame);
    const aDrawn = attachedEyeA.A === eye && lenses.visible('A');
    const entry = (result, f) => {
      const lens = { surfaces: result.surfaces, frame: { shape: f.shape, A: f.A, B: f.B }, eye };
      return { callouts: heatCallouts(lens, result.metrics), metrics: result.metrics, lens };
    };
    const key = JSON.stringify([
      'cmp',
      eye,
      cs.split,
      cs.shown,
      aDrawn,
      aEyes.map((e) => [e, cmp.A[e].surfaces, cmp.A[e].metrics, cmp.specA[e].frame]),
      bEyes.map((e) => [e, last.eyes[e].result.surfaces, last.eyes[e].result.metrics, last.eyes[e].frame]),
    ]);
    if (heatState?.key === key) return;
    const metrics = [...aEyes.map((e) => cmp.A[e].metrics), ...bEyes.map((e) => last.eyes[e].result.metrics)];
    if (metrics.length === 0) {
      heatState = { key, scale: null, levels: null, eye, table: null, compare: null };
      $('view-legend').hidden = true;
      $('view-heat-table').hidden = true;
      $('view-heat-nochord').hidden = true;
      clearHeatLabels();
      heatEyeEl.hidden = true;
      requestSettle();
      return;
    }
    const scale = heatScale(metrics);
    const levels = isoLevels(scale.min, scale.max);
    heat.setScale(levels);
    const compare = {
      eye,
      A: aEyes.includes(eye) ? entry(cmp.A[eye], cmp.specA[eye].frame) : null,
      B: bEyes.includes(eye) ? entry(last.eyes[eye].result, last.eyes[eye].frame) : null,
      aDrawn,
    };
    heatState = { key, scale, levels, eye, table: null, compare };
    $('view-legend').hidden = false;
    $('view-heat-table').hidden = false;
    renderLegend({ min: scale.min, max: scale.max, levels });
    renderHeatTable({ compare });
    applyHeatLabels();
    view.requestRender();
    scheduleAria();
  }

  /** @param {'glass' | 'heat' | 'ref'} next */
  function setMode(next) {
    if (next === mode) return;
    const from = mode;
    if (from === 'ref') leaveRef();
    mode = next;
    fullscreen.refresh(); // 04-12 (F-02): the info panel follows the mode while fullscreen is on
    lenses.setMode(next === 'heat' ? 'heat' : 'glass');
    requestThumb();
    const isHeat = next === 'heat';
    if (!isHeat) {
      heatState = null;
      clearHeatLabels();
      heatEyeEl.hidden = true;
      requestSettle();
      $('view-legend').hidden = true;
      $('view-heat-table').hidden = true;
      $('view-heat-nochord').hidden = true;
    }
    if (next === 'ref') {
      enterRef();
      return;
    }
    applyFsLabel();
    if (from === 'ref') setBadge(outstanding !== null ? 'view.badge.updating' : modeBadge());
    else if (badge.textContent !== t('view.badge.updating')) setBadge(modeBadge());
    updateLabels(drawnLenses());
    if (isHeat) {
      paintHeat();
      controls.goTo('heat', heatState?.eye ?? cmp?.eye ?? 'OD');
    } else if (from !== 'ref') {
      // B-WR-04: leaving Dickenkarte (Glas, or Expert off) returns to the default pose with the
      // default fit, as 'Vergleich beenden' does; the one-lens heat close-up is not kept.
      // 04-08: leaving the Durchblick restores the saved pose instead (leaveRef).
      controls.goTo('default', 'OD');
    }
    view.requestRender();
    scheduleAria();
  }

  // ---- 04-08 (REF-01, D-10): entering and leaving the Durchblick ----
  /** Saved on entry: the camera preset ('free' keeps the untouched camera), its eye, '3D drehen', the hint text. */
  let refSaved = null;
  function enterRef() {
    refSaved = { ...controls.suspend(), hint: $('view-hint').textContent ?? '' };
    $('view-tools').hidden = true;
    stageEl.removeAttribute('tabindex');
    stageEl.removeAttribute('aria-describedby');
    stageEl.classList.add('view-stage--ref');
    setText('view-title', t('view.title.ref'));
    stageEl.setAttribute('aria-label', t('view.stage.label.ref'));
    applyFsLabel();
    $('view-protrusion').hidden = true;
    sideNote.hidden = true;
    $('view-heat').hidden = true;
    $('view-ref').hidden = false;
    setText('view-hint', t('view.hint.ref'));
    clearBadgeTimer();
    updateLabels(drawnLenses());
    enterRefPass();
    view.requestRender();
    scheduleAria();
  }
  function leaveRef() {
    leaveRefPass();
    const saved = refSaved;
    refSaved = null;
    controls.resume(saved);
    // Instant cut back to the saved preset; a freely turned camera was never moved (input suspended).
    if (saved.preset !== 'free') controls.goTo(saved.preset, saved.eye, { cut: true });
    $('view-tools').hidden = false;
    stageEl.setAttribute('tabindex', '0');
    stageEl.setAttribute('aria-describedby', 'view-keys');
    stageEl.classList.remove('view-stage--ref');
    setText('view-title', t('view.title'));
    stageEl.setAttribute('aria-label', t('view.stage.label'));
    $('view-heat').hidden = false;
    $('view-ref').hidden = true;
    if (!saved.rotate) setText('view-hint', saved.hint); // resume() wrote the touchOn hint otherwise
    sideNote.hidden = controls.viewName() !== 'side';
    protrusionKey = null;
    paintProtrusion();
  }
  // The Durchblick pass (refraction.js, created on the first entry: its chart texture costs nothing
  // for users who never open it) and its lane (ref-mode.js). One renderer, one WebGL context.
  let refraction = null;
  const getRefraction = () => (refraction ??= createRefraction({ renderer: view.renderer, labelsEl, startTier: deviceStartTier() }));
  const refMode = createRefMode({
    getRefraction,
    canvasEl,
    stageEl: $('view-stage'),
    onVisibility: (onScreen) => {
      // M4: off screen the deferred re-mesh runs (and with it the bar thumbnail), as in Glas.
      if (!onScreen && meshDeferred) runDeferredMesh();
      syncBarHold();
    },
    setBadge,
    setWarpPending,
    scheduleAria: () => scheduleAria(),
    requestRender: () => view.requestRender(),
  });
  function enterRefPass() {
    refMode.enter(last);
    view.setPass(() => getRefraction().renderPass());
  }
  function leaveRefPass() {
    refMode.leave();
    view.setPass(compare3d.renderPass);
    // UI-SPEC D-10: a deferred re-mesh runs now; the badge reads 'view.badge.updating' until it attaches.
    if (meshDeferred) runDeferredMesh();
    syncBarHold();
  }
  function runDeferredMesh() {
    meshDeferred = false;
    if (last) update(last);
  }
  /** M4: the bar is the .thumb-off text bar while a deferred re-mesh leaves no current thumbnail. */
  function syncBarHold() {
    holdBarThumb(meshDeferred && refMode.isOn());
  }
  function refAfterRender() {
    refraction?.layoutPills();
    refMode.afterRender(); // 04-10: the guard clock's t1
  }
  const refAriaLabel = () => refMode.ariaLabel();
  const refInfo = () => ({ mode, ...refMode.info(), meshSent, meshDeferred, chart: refraction?.chartInfo() ?? null });

  view.beforeRender(() => {
    const p = view.camera.position;
    const tg = controls.state().target;
    const dir = { x: p.x - tg.x, y: p.y - tg.y, z: p.z - tg.z };
    chart.mesh.visible = !chartHidden(dir);
    frame.setFade(nearTempleFade(dir));
  });
  view.onResize(() => {
    if (mode === 'ref') refMode.resize();
    syncCompare(true); // the split depends on the stage width
    if (attachedOnce) refresh();
    updateAvoid(true);
    requestSettle(true);
    requestThumb(true);
  });

  // A3 (03-14): the keyboard hint shows on a keyboard focus, then fades after KEYS_SHOW_MS (a plain
  // hide under reduced motion) and shows again on the next focus. aria-describedby keeps the text.
  const stageEl = $('view-stage');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let keysTimer = null;
  const setKeys = (next) => {
    keysState = next;
    keysEl.classList.toggle('view-keys--fading', next === 'fading');
    keysEl.classList.toggle('view-keys--hidden', next === 'hidden');
    updateAvoid();
  };
  const clearKeysTimer = () => {
    if (keysTimer !== null) clearTimeout(keysTimer);
    keysTimer = null;
  };
  stageEl.addEventListener('focus', () => {
    clearKeysTimer();
    if (!stageEl.matches(':focus-visible')) {
      setKeys('off');
      return;
    }
    setKeys('shown');
    keysTimer = setTimeout(() => {
      if (reducedMotion.matches) {
        keysTimer = null;
        setKeys('hidden');
        return;
      }
      setKeys('fading');
      keysTimer = setTimeout(() => {
        keysTimer = null;
        setKeys('hidden');
      }, KEYS_FADE_MS);
    }, KEYS_SHOW_MS);
  });
  stageEl.addEventListener('blur', () => {
    clearKeysTimer();
    setKeys('off');
  });
  stageEl.addEventListener('keydown', () => updateAvoid());
  avoidReady = true;
  updateAvoid();

  /** Eye labels and caption for the eyes drawn (ok) and not drawn (blocked). */
  function updateLabels(drawnEyes) {
    const any = drawnEyes.size > 0;
    const parts = [];
    SLOTS.forEach((eye, i) => {
      const f = placement[eye] ?? knownFrame;
      const eyeText = t(EYE_KEY[eye]);
      const text = !any || !f ? '' : drawnEyes.has(eye) ? eyeText : t('view.eye.blocked', { eye: eyeText });
      anchors[eye] = text && f ? { x: boxingCentreX(eye, f.A, f.DBL), y: -f.B / 2 - LABEL_GAP_MM, z: 0 } : null;
      labels.setText(i, text);
      parts.push(text, anchors[eye] && [anchors[eye].x, anchors[eye].y]);
    });
    const caption = !any
      ? t('view.empty')
      : cmp
        ? t('view.caption.compare', { eye: t(cmp.eye === 'OS' ? 'view.aria.eye.os' : 'view.aria.eye.od') })
        : t(mode === 'heat' ? 'view.caption.heat' : mode === 'ref' ? 'view.caption.ref' : 'view.caption.glass');
    setText('view-caption', caption);
    const key = JSON.stringify(parts);
    if (key !== labelKey) {
      labelKey = key;
      view.requestRender();
    }
  }

  /**
   * 03-14: push the comparison state to compare3d. Entering or leaving the comparison resets the
   * camera (default, or the Dickenkarte pose of the compared / heat eye); "Vergleich beenden"
   * therefore returns to the full-glasses default view. The A half is drawn only once the A lens
   * and rim of the current A input are attached (no stale A mesh, T-03-38).
   * @param {boolean} [fromResize] the caller (onResize) refreshes the camera itself
   */
  function syncCompare(fromResize = false) {
    const was = compare3d.state();
    const aOk = cmp !== null && wantKey.A !== null && attachedKey.A === wantKey.A && (wantKey.frameA === null || attachedKey.frameA === wantKey.frameA);
    const changed = compare3d.setState({
      active: cmp !== null,
      eye: cmp?.eye,
      stageWidth: $('view-stage').clientWidth,
      shown: cmp?.showA ? 'A' : 'B',
      aEye: aOk ? attachedEyeA.A : null, // the eye the attached A was built for (compare3d draws it only for cmp.eye)
    });
    if (!changed) return;
    requestThumb(); // the shown configuration or the layout changed
    const now = compare3d.state();
    if (now.active) heatEyeEl.hidden = true;
    if (!attachedOnce) {
      view.requestRender();
      return;
    }
    if (was.active !== now.active) {
      updateLabels(drawnLenses());
      heatState = null; // repaint the map, table and callouts in the new layout
      if (mode === 'heat') {
        clearHeatLabels();
        paintHeat();
      }
      refresh();
      if (mode === 'heat') controls.goTo('heat', heatState?.eye ?? now.eye, { cut: true });
      else controls.goTo('default', 'OD', { cut: true });
    } else {
      if (was.eye !== now.eye) updateLabels(drawnLenses());
      if (!fromResize && (was.eye !== now.eye || was.split !== now.split || was.aEye !== now.aEye)) refresh();
      if (mode === 'heat') paintHeat();
    }
    view.requestRender();
    scheduleAria();
  }

  /** The frame the view draws: the shown eyes' frame, else the frame of the last input. */
  const frameFor = (inputs) => inputs.eyes.OD?.frame ?? inputs.eyes.OS?.frame ?? inputs.frame ?? null;

  /** @param {ViewInputs} inputs */
  function update(inputs) {
    last = inputs;
    if (attachedOnce) scheduleAria();
    // 04-08 (D-13): the size block with this result paint, then the warp job (latest wins).
    if (mode === 'ref') refMode.update(inputs);
    /** slot → { item (without buffers), meta (with key) } */
    const want = {};
    for (const eye of SLOTS) {
      const e = inputs.eyes[eye];
      placement[eye] = e?.frame ?? null;
      if (e?.frame) knownFrame = e.frame;
      if (e?.result?.ok && e.frame) {
        const { shape, A, B } = e.frame;
        const item = { slot: eye, eye, surfaces: e.result.surfaces, frame: { shape, A, B } };
        want[eye] = { item, meta: { ...item, key: lensKey(eye, e.result.surfaces, e.frame), DBL: e.frame.DBL } };
      } else {
        lenses.hide(eye);
        attachedKey[eye] = null;
      }
    }
    // 03-14 (RES-03): the A lens and its rim for the compared eye, in the same latest-wins job.
    const wasCmp = cmp !== null;
    cmp = null;
    const c = inputs.compare ?? null;
    // While A is recomputed (c.A null) inside a running comparison, the last A stays shown, as an old
    // main mesh stays visible while a newer one is pending (UI-SPEC States); a new comparison starts
    // with no A until its own A lens is attached.
    if (!(c && c.A === null && wasCmp)) {
      wantKey.A = null;
      wantKey.frameA = null;
    }
    let rA = null;
    if (c) {
      const th = (r) => (r?.ok ? thickest(r.metrics).value : null);
      const eye = compareEye({
        A: c.A ? { OD: th(c.A.OD), OS: th(c.A.OS) } : null,
        B: { OD: th(inputs.eyes.OD?.result), OS: th(inputs.eyes.OS?.result) },
      });
      cmp = { eye, A: c.A, specA: c.specA, showA: c.showA };
      rA = c.A?.[eye] ?? null;
      const fA = c.specA?.[eye]?.frame ?? null;
      const dispA = inputs.display;
      if (rA?.ok && fA) {
        const { shape, A, B, DBL } = fA;
        const item = { slot: 'A', eye, surfaces: rA.surfaces, frame: { shape, A, B } };
        want.A = { item, meta: { ...item, key: lensKey(eye, rA.surfaces, fA), DBL } };
        wantKey.A = want.A.meta.key;
        if (dispA) {
          const other = eye === 'OD' ? 'OS' : 'OD';
          const eyes = /** @type {{ OD: any, OS: any }} */ ({ [eye]: rA.surfaces, [other]: null });
          const { rimDepthMm } = dispA;
          const templeMm = dispA.templeMm ?? TEMPLE_DEFAULT_MM;
          const key = JSON.stringify(['A', shape, A, B, DBL, eye, rA.surfaces, rimDepthMm, templeMm]);
          want.frameA = {
            item: { slot: 'frameA', frame: { shape, A, B, DBL }, eyes, rimDepthMm, templeMm },
            meta: { key, eye, A, B, DBL, rimDepthMm, templeMm },
          };
          wantKey.frameA = key;
        }
      }
    }
    // After cmp (M2: the compared eye and A's result); before any mesh work, as before.
    paintProtrusion();
    const f = frameFor(inputs);
    const disp = inputs.display;
    if (f && disp) {
      const { shape, A, B, DBL } = f;
      const eyes = { OD: want.OD?.item.surfaces ?? null, OS: want.OS?.item.surfaces ?? null };
      const { rimDepthMm, templeSource } = disp;
      const templeMm = disp.templeMm ?? TEMPLE_DEFAULT_MM;
      const key = JSON.stringify([shape, A, B, DBL, eyes.OD, eyes.OS, rimDepthMm, templeMm]);
      const sentRim = FAIL_FRAME !== null && rimDepthMm === FAIL_FRAME ? -1 : rimDepthMm;
      want.frame = {
        item: { slot: 'frame', frame: { shape, A, B, DBL }, eyes, rimDepthMm: sentRim, templeMm },
        meta: { key, A, B, DBL, rimDepthMm, templeMm, templeSource },
      };
    } else {
      frame.hide();
      shadow.hide();
      writeTech(null);
      attachedKey.frame = null;
    }
    updateLabels(new Set(SLOTS.filter((s) => want[s])));
    const nextAbbe = { OD: inputs.eyes.OD?.result?.intermediates?.abbe ?? null, OS: inputs.eyes.OS?.result?.intermediates?.abbe ?? null, A: null };
    // 03-14: outside a comparison the A glass mirrors OD, so the warm-up compiles no extra program.
    nextAbbe.A = rA?.ok ? (rA.intermediates?.abbe ?? null) : nextAbbe.OD;
    if (nextAbbe.OD !== abbe.OD || nextAbbe.OS !== abbe.OS || nextAbbe.A !== abbe.A) {
      abbe = nextAbbe;
      setDispersion();
    }

    syncCompare();
    // 04-09 (M4): in Durchblick with the stage on screen the re-mesh is deferred (the stage shows the
    // warp); it runs when the stage leaves the screen or the Durchblick is left (runDeferredMesh).
    if (refMode.isOn() && refMode.onScreen()) {
      meshDeferred = true;
      syncBarHold();
      clearBadgeTimer();
      setPending('');
      return;
    }
    const send = Object.entries(want).filter(([slotName, w]) => w.meta.key !== attachedKey[slotName]);
    const sig = JSON.stringify(send.map(([slotName, w]) => [slotName, w.meta.key]));
    if (outstanding !== null && outstanding.sig === sig) {
      // The outstanding job already carries exactly these items; it stays pending ('mesh').
      view.requestRender();
      return;
    }
    if (send.length === 0 && outstanding === null) {
      // Same meshes as attached: only a lens placement could differ (DBL is in the frame key).
      for (const s of SLOTS) if (want[s]) lenses.place(s, s, want[s].item.frame.A, placement[s].DBL);
      if (attachedOnce) refresh();
      if (attachedOnce) requestThumb();
      view.requestRender();
      if (attachedOnce) setMeshBadge(inputs.current ? modeBadge() : 'view.badge.updating');
      if (attachedOnce) paintHeat();
      clearBadgeTimer();
      setPending('');
      return;
    }
    // Changed items, or nothing changed but a job is outstanding: requestMesh([]) makes it stale.
    const take = (slotName) => (slotName === 'frame' ? frame.take() : slotName === 'frameA' ? frameA.take() : lenses.takeSpare(slotName));
    const items = send.map(([slotName, w]) => ({ ...w.item, buffers: take(slotName) }));
    const { gen, dropped } = client.requestMesh(items);
    meshSent++;
    giveBackAll(dropped);
    outstanding = { gen, sig };
    jobLog.push(send.map(([slotName]) => slotName));
    if (jobLog.length > JOB_LOG) jobLog.shift();
    metaByGen.set(gen, Object.fromEntries(send.map(([slotName, w]) => [slotName, w.meta])));
    sentAtByGen.set(gen, performance.now());
    if (PERF_MARKS) inputAtByGen.set(gen, inputs.inputTs);
    setPending('mesh');
    if (attachedOnce && badgeTimer === null) {
      badgeTimer = setTimeout(() => {
        badgeTimer = null;
        if (pendingMesh === 'mesh') setMeshBadge('view.badge.updating');
      }, BADGE_AFTER_MS);
    }
  }

  // F-04 / AR-03-04: test handle only in non-production builds (dev and `vite build --mode e2e`); Vite
  // replaces MODE statically, so the production bundle drops this branch (test/dist/hooks.test.js).
  if (import.meta.env.MODE !== 'production') {
    window.__eyeglassView = Object.freeze({
      memory: () => ({ ...view.renderer.info.memory, programs: view.renderer.info.programs?.length ?? 0 }),
      /** 03-15: buffer-set allocations of every page pool (lens slots incl. A, frame, frameA) and worker re-allocations. */
      allocs: () => ({ page: lenses.allocCount() + frame.allocCount() + frameA.allocCount(), worker: workerReallocs }),
      meshMode: () => client.mode(),
      viewName: () => controls.viewName(),
      /** 03-12: 'glass' | 'heat' (04-08: | 'ref'), and the engine scale / levels / heat eye of the painted map (null in Glas). */
      mode: () => mode,
      /** 04-08 test-only: the Durchblick state (no Rx values): mode, Bild toggle, panels, grid tier, drawn warp generation. */
      ref: () => refInfo(),
      heatScale: () =>
        heatState?.scale
          ? { ...heatState.scale, ...heatState.levels, values: [...heatState.levels.values], eye: heatState.eye, uniforms: heat.uniforms() }
          : null,
      /** 03-12 test-only: [x, y, z] world mm of an eye's optical centre on the rim plane and its engine CT, or null. */
      ocWorld: (e) => {
        const r = last?.eyes[e]?.result;
        if (!r?.ok || !lenses.visible(e)) return null;
        const g = lenses.group(e).position;
        return [g.x + r.surfaces.oc.x, g.y + r.surfaces.oc.y, g.z, r.metrics.ct];
      },
      /** 03-13 test-only: the visible projected labels (kind, callout key, text, viewport rect) and calloutsFit. */
      labelsInfo: () => ({
        labels: [...labelsEl.children]
          // 04-09: svg#view-ref-ticks (Durchblick) is no label
          .filter((el) => el instanceof HTMLElement && !el.hidden)
          .map((el) => {
            const c = el.classList;
            const r = el.getBoundingClientRect();
            const kind = c.contains('view-dot')
              ? 'dot'
              : c.contains('view-label--callout')
                ? 'callout'
                : c.contains('view-label--iso')
                  ? 'iso'
                  : c.contains('view-label--caption')
                    ? 'caption'
                    : 'eye';
            const d = /** @type {HTMLElement} */ (el).dataset;
            return { kind, key: d.key ?? null, half: d.half ?? null, text: el.textContent, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
          }),
        calloutsFit: calloutsFit(),
      }),
      /** 03-14 test-only: the A/B state and the projected outline width (CSS px) of each half's lens. */
      compareInfo: () => {
        const cs = compare3d.state();
        const widthPx = { A: null, B: null };
        if (cmp) {
          const eye = cmp.eye;
          const fa = cmp.specA?.[eye]?.frame;
          const fb = last?.eyes[eye]?.frame;
          const halves = cs.split ? ['A', 'B'] : [cs.shown];
          if (halves.includes('A') && fa && cs.aEye === eye && lenses.visible('A')) {
            widthPx.A = compare3d.widthPx('A', frameOutline(fa.shape, fa.A, fa.B, eye), frameA.lensZ()[eye]);
          }
          if (halves.includes('B') && fb && lenses.visible(eye)) {
            widthPx.B = compare3d.widthPx('B', frameOutline(fb.shape, fb.A, fb.B, eye), lenses.group(eye).position.z);
          }
        }
        return { active: cs.active, split: cs.split, eye: cs.eye, shown: cs.shown, aReady: cs.aEye === cs.eye, widthPx };
      },
      /**
       * 03-15 test-only: thumbnail copies, the share of thumbnail pixels that are not the #f3f4f6
       * background, each eye's projected box width in thumbnail px, the viewport sizes of the last
       * thumbnail pass and of the last main pass, the passes of the last thumbnail frame.
       */
      thumbInfo: () => {
        const st = view.thumbStats();
        let nonBackgroundRatio = 0;
        if (thumbCanvas && st.copies > 0) {
          const d = /** @type {CanvasRenderingContext2D} */ (thumbCanvas.getContext('2d')).getImageData(0, 0, thumbCanvas.width, thumbCanvas.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 243) > 6 || Math.abs(d[i + 1] - 244) > 6 || Math.abs(d[i + 2] - 246) > 6) n++;
          nonBackgroundRatio = n / (d.length / 4);
        }
        return {
          copies: st.copies,
          passes: st.passes,
          passesPerThumbFrame: st.passesPerThumbFrame,
          nonBackgroundRatio,
          lensWidthPx: thumbLast ? { ...thumbLast.lensWidthPx } : { OD: null, OS: null },
          renderViewports: thumbLast ? thumbLast.renderViewports.map((v) => ({ ...v })) : [],
          mainViewports: compare3d.lastViewports(),
          src: thumbLast ? { ...thumbLast.src } : null,
          // MINOR 3: the self-timing guard (off = ?thumbguardoff).
          guard: { ...thumbGuard, thresholdMs: THUMB_SLOW_MS, run: THUMB_SLOW_RUN, off: THUMB_GUARD_OFF },
        };
      },
      /** 03-15 test-only: copy a thumbnail with the next render that allows it. */
      requestThumb: () => requestThumb(),
      /** 03-14 A3 test-only: keyboard hint 'off' | 'shown' | 'fading' | 'hidden'. */
      keysHint: () => keysState,
      /** 03-10: '3D drehen' state on the touch path (false on the pointer path). */
      rotateActive: () => controls.rotateActive(),
      /** 03-09: camera state, derived limits and the side eye. */
      camera: () => controls.state(),
      limits: () => controls.limits(),
      sideEye: () => currentSideEye(),
      ior: (s) => lenses.ior(s),
      edgeMax: (s) => lenses.edgeMax(s),
      /** Test-only (03-07): frame measured from its attached buffers; lens group z (MINOR 9). */
      frameInfo: () => frame.info(),
      /** Test-only (03-07, round 2 MINOR 7): slot lists of the last 10 mesh jobs sent. */
      meshJobs: () => jobLog.map((j) => [...j]),
      /** 03-08 (D-12): the active quality tier, and a slot's glass dispersion. */
      tier: () => view.tier(),
      dispersion: (s) => lenses.dispersion(s),
      /** World point (mm) → canvas CSS px [x, y] in the current view. */
      project: (x, y, z) => view.project(x, y, z),
      /** Test-only (03-08): chart and contact shadow state. */
      sceneInfo: () => ({
        chartVisible: chart.mesh.visible,
        chartZ: chart.mesh.position.z,
        chartSize: chart.size(),
        chartRect: chart.rect(),
        shadowVisible: shadow.mesh.visible,
      }),
      /** 03-09: RGBA at several CSS pixels [[x, y], …] after ONE fresh render. */
      pixels: (points) => {
        view.render();
        const gl = view.renderer.getContext();
        const c = view.renderer.domElement;
        const k = c.width / c.clientWidth;
        return points.map(([x, y]) => {
          const out = new Uint8Array(4);
          gl.readPixels(Math.floor(x * k), c.height - 1 - Math.floor(y * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
          return [...out];
        });
      },
      /** RGBA at CSS pixel (x, y) of the canvas, read in the same task as a fresh render. */
      pixel: (x, y) => {
        view.render();
        const gl = view.renderer.getContext();
        const c = view.renderer.domElement;
        const k = c.width / c.clientWidth;
        const out = new Uint8Array(4);
        gl.readPixels(Math.floor(x * k), c.height - 1 - Math.floor(y * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return [...out];
      },
    });
  }

  return { update };
}
