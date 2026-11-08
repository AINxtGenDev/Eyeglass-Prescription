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
import { protrusionLines, ariaGlass } from './text.js';
import { createScene } from './scene.js';
import { createLensSlots } from './lenses.js';
import { createHeat } from './heat.js';
import { renderLegend, renderHeatTable } from './legend.js';
import { heatScale, isoLevels, heatCallouts } from '../../engine/mesh/heat.js';
import { createFrame } from './frame.js';
import { createChart, createShadow } from './backdrop.js';
import { TIER_SETTINGS } from './tiers.js';
import { createLabels, place, initHeatLabels, setHeatLabels, clearHeatLabels, layoutHeatLabels, setLabelAvoid, settleNote, calloutsFit } from './labels.js';
import { createControls } from './controls.js';
import { cameraContext, presetPoses, chartRect, chartHidden, sideEye, nearTempleFade } from './camera-math.js';

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

// Test-only (?failframe=<mm>, read once like ?perfmarks): a frame item whose rim depth equals this
// value is sent with rimDepthMm −1, so the worker's own validation returns ok: false through the
// real path. It changes no number (the rim depth is display only).
const FAIL_FRAME = (() => {
  const v = Number(new URLSearchParams(location.search).get('failframe'));
  return Number.isFinite(v) && v > 0 ? v : null;
})();

/** Lens key: the eye, every surfaces field, the shape, A and B (not DBL: a DBL change only moves). */
const lensKey = (eye, surfaces, f) => JSON.stringify([eye, surfaces, f.shape, f.A, f.B]);

/** The no-WebGL note in the stage (D-17): info icon + text, textContent only. */
function showNoWebgl() {
  const status = $('view-status');
  const text = document.createElement('span');
  text.textContent = t('view.noWebgl');
  status.classList.add('view-note');
  status.replaceChildren(icon('info'), text);
  showUnavailable('tech.view.reason.noWebgl');
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
 * @typedef {{ eyes: { OD: ViewEye, OS: ViewEye }, frame?: ViewFrame | null, display?: ViewDisplay,
 *   current: boolean }} ViewInputs
 *   frame = the frame of the last input (drawn alone when no eye has a shown result)
 */

/**
 * @param {{ slot: HTMLElement }} o
 * @returns {{ update: (inputs: ViewInputs) => void }}
 */
export function mountView({ slot }) {
  const viewEl = /** @type {HTMLElement} */ (slot.querySelector('#view'));
  const setPending = (v) => {
    if (viewEl.dataset.pending !== v) viewEl.dataset.pending = v;
  };
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
  const keysEl = /** @type {HTMLElement} */ (slot.querySelector('#view-keys'));
  /**
   * 03-13: stage boxes no label may cover: the badge, and the keyboard hint while it is shown
   * (#view-stage:focus-visible). Measured on badge text, focus and size changes, never per frame.
   */
  function updateAvoid(inRender = false) {
    const stageEl = $('view-stage');
    const boxes = [];
    if (badge.offsetWidth > 0) boxes.push({ x: badge.offsetLeft, y: badge.offsetTop, w: badge.offsetWidth, h: badge.offsetHeight });
    if (stageEl.matches(':focus-visible')) {
      const s = stageEl.getBoundingClientRect();
      const k = keysEl.getBoundingClientRect();
      const top = Math.max(k.top, s.top) - s.top;
      const bottom = Math.min(k.bottom, s.bottom) - s.top;
      if (bottom > top) boxes.push({ x: Math.max(k.left, s.left) - s.left, y: top, w: Math.min(k.right, s.right) - Math.max(k.left, s.left), h: bottom - top });
    }
    const key = JSON.stringify(boxes);
    if (key === avoidKey) return; // a mouse focus shows no hint: nothing to settle mid-drag
    avoidKey = key;
    setLabelAvoid(boxes);
    if (mode === 'heat') requestSettle(inRender);
  }

  const view = createScene(/** @type {HTMLCanvasElement} */ ($('view-canvas')), $('view-stage'));
  if (view === null) {
    // D-17: the note replaces the view; numbers, comparison and cross-section are unaffected.
    showNoWebgl();
    $('view-mode').remove();
    setPending('');
    return { update: () => setPending('') };
  }
  setText('view-caption', t('view.caption.glass'));
  const heat = createHeat(view.scene);
  const lenses = createLensSlots(view.scene, [...SLOTS], heat.material);
  /** 03-12: 'glass' | 'heat' (not persisted; Glas is the default). */
  let mode = 'glass';
  const modeBadge = () => (mode === 'heat' ? 'view.badge.heat' : 'view.badge.glass');
  const frame = createFrame(view.scene, { OD: lenses.group('OD'), OS: lenses.group('OS') });
  const chart = createChart(view.scene, view.renderer, TIER_SETTINGS[view.tier()].chart);
  const shadow = createShadow(view.scene);
  /** νe per slot of the last input (null: none, e.g. a custom material without νe). */
  let abbe = { OD: null, OS: null };
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
      setText('view-status', '');
      showUnavailable(null);
    }
  });
  const labelsEl = $('view-labels');
  const labels = createLabels(labelsEl, SLOTS.length);
  initHeatLabels(labelsEl, $('view-callout-note'));
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
    const size = { width: labelsEl.clientWidth, height: labelsEl.clientHeight };
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
  const attachedKey = { OD: null, OS: null, frame: null };
  /** The last requestMesh without its reply yet: { gen, sig } (sig = the sent slots and keys). */
  let outstanding = null;
  /** Slot lists of the last JOB_LOG jobs sent (test handle meshJobs). */
  const jobLog = [];
  let attachedOnce = false;
  let retryLeft = true;
  /** Request data per mesh generation (the reply carries slot and buffers only). */
  const metaByGen = new Map();
  /** performance.now() of each requestMesh, for the re-mesh time (Pitfall 12: 3D only). */
  const sentAtByGen = new Map();
  /** Latest boxing placement per eye (a DBL change moves the lens without a re-mesh). */
  const placement = { OD: null, OS: null };
  let badgeTimer = null;
  let stash = null;
  let paintFrame = null;

  const giveBackAll = (items) => {
    for (const it of items ?? []) {
      if (!it) continue;
      if (it.slot === 'frame') frame.giveBack(it.buffers);
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
        else lenses.lose(slotName);
      }
      metaByGen.delete(d.gen);
      if (outstanding?.gen === d.gen) outstanding = null;
      if (d.current && last && retryLeft) {
        retryLeft = false;
        update(last);
      } else if (d.current) {
        clearBadgeTimer();
        setPending('');
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
    if (outstanding?.gen === d.gen) outstanding = null;
    // Lenses first, then the frame: the frame sets both lens groups' z in this same paint frame.
    const items = [...d.items].sort((a, b) => (a?.slot === 'frame') - (b?.slot === 'frame'));
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
    attachedOnce = true;
    refresh();
    for (const b of presetButtons) b.disabled = false;
    for (const r of modeRadios) r.disabled = false;
    paintHeat();
    retryLeft = true;
    clearBadgeTimer();
    if (!contextLost) setText('view-status', '');
    setBadge(last?.current === false ? 'view.badge.updating' : modeBadge());
    setPending('');
    view.render();
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

  /** Side eye (MINOR 13): larger total edge protrusion at the current rim depth; ties → OD. */
  function currentSideEye() {
    const rim = last?.display?.rimDepthMm;
    const total = (eye) => {
      const r = last?.eyes[eye]?.result;
      if (!r?.ok || !lenses.visible(eye) || !(rim > 0)) return null;
      const s = bevelSplit(r.metrics.etMax.value, rim);
      return s.front + s.back;
    };
    return sideEye({ OD: total('OD'), OS: total('OS') });
  }

  const cameraCtx = () =>
    cameraContext({ frameData: frame.cameraData(), lensRadius: lenses.unionRadius(), aspect: view.camera.aspect, side: currentSideEye() });

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
  const leadMemo = { OD: { key: null, value: NaN }, OS: { key: null, value: NaN } };
  function paintProtrusion() {
    const disp = last?.display;
    const rim = disp?.rimDepthMm;
    const eyes = { OD: null, OS: null };
    if (rim > 0) {
      for (const eye of SLOTS) {
        const e = last.eyes[eye];
        if (!e?.result?.ok || !e.frame) continue;
        const { shape, A, B } = e.frame;
        const key = JSON.stringify([e.result.surfaces, shape, A, B, rim]);
        if (leadMemo[eye].key !== key) {
          leadMemo[eye] = { key, value: frontLeadMm(e.result.surfaces, frameOutline(shape, A, B, eye), rim).value };
        }
        eyes[eye] = { etMax: e.result.metrics.etMax.value, lead: leadMemo[eye].value };
      }
    }
    const key = JSON.stringify([eyes, rim, disp?.rimAssumed]);
    if (key === protrusionKey) return;
    protrusionKey = key;
    const any = eyes.OD !== null || eyes.OS !== null;
    $('view-protrusion').hidden = !any;
    if (!any) return;
    const p = protrusionLines(eyes, { rimDepthMm: rim, rimAssumed: disp.rimAssumed !== false });
    let i = 0;
    for (const eye of SLOTS) {
      const has = eyes[eye] !== null;
      setText(`view-protrusion-${eye.toLowerCase()}`, has ? p.lines[i] : '');
      setText(`view-protrusion-lead-${eye.toLowerCase()}`, has ? p.leads[i] : '');
      if (has) i++;
    }
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
    if (mode === 'heat' && heatState) {
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
    onSettle: requestSettle,
    onPose: (name) => {
      sideNote.hidden = name !== 'side';
      if (name === 'side') {
        setText('view-side-note', t('view.side.note', { eye: t(currentSideEye() === 'OS' ? 'view.side.os' : 'view.side.od') }));
      }
      if (attachedOnce) scheduleAria();
    },
  });
  if (controls.pointer) setText('view-hint', t('view.hint.pointer'));
  const presetButtons = [...document.querySelectorAll('#view-tools [data-preset]')];
  for (const b of presetButtons) {
    b.addEventListener('click', () => controls.goTo(b.dataset.preset === 'reset' ? 'default' : b.dataset.preset));
  }

  // ---- 03-12 Dickenkarte ----
  const modeRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('#view-mode input[name=view-mode]')]);
  for (const r of modeRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (r.checked) setMode(/** @type {'glass' | 'heat'} */ (r.value));
    });
  }
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
  /** 03-13: the picker moves the callouts, iso labels and the camera framing; the table stays. */
  function pickHeatEye(eye) {
    pickedEye = eye;
    if (mode !== 'heat' || !heatState?.table?.[eye] || heatState.eye === eye) return;
    heatState.eye = eye;
    applyHeatLabels();
    controls.goTo('heat', eye);
    scheduleAria();
  }
  /** Callouts and iso labels for heatState.eye (text-change path), picker state, then a settle. */
  function applyHeatLabels() {
    const eye = heatState?.eye;
    const v = eye ? heatState.table?.[eye] : null;
    if (!v) {
      clearHeatLabels();
      heatEyeEl.hidden = true;
    } else {
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
    const eyes = heatEyes();
    const key = JSON.stringify(eyes.map((e) => [e, last.eyes[e].result.surfaces, last.eyes[e].result.metrics, last.eyes[e].frame]));
    if (heatState?.key === key) return;
    const eye = pickedEye && eyes.includes(pickedEye) ? pickedEye : defaultHeatEye(eyes);
    const prevEye = heatState?.eye;
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
    // A new heat eye while the camera is still on the heat pose: frame it (no tween on re-mesh).
    if (prevEye !== undefined && prevEye !== eye && controls.preset() === 'heat') controls.goTo('heat', eye, { cut: true });
    view.requestRender();
    scheduleAria();
  }

  /** @param {'glass' | 'heat'} next */
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    lenses.setMode(next);
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
    if (badge.textContent !== t('view.badge.updating')) setBadge(modeBadge());
    updateLabels(drawnLenses());
    if (isHeat) {
      paintHeat();
      controls.goTo('heat', heatState?.eye ?? 'OD');
    }
    view.requestRender();
    scheduleAria();
  }

  view.beforeRender(() => {
    const p = view.camera.position;
    const tg = controls.state().target;
    const dir = { x: p.x - tg.x, y: p.y - tg.y, z: p.z - tg.z };
    chart.mesh.visible = !chartHidden(dir);
    frame.setFade(nearTempleFade(dir));
  });
  view.onResize(() => {
    if (attachedOnce) refresh();
    updateAvoid(true);
    requestSettle(true);
  });
  for (const type of ['focus', 'blur', 'keydown']) $('view-stage').addEventListener(type, () => updateAvoid());
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
    setText('view-caption', t(!any ? 'view.empty' : mode === 'heat' ? 'view.caption.heat' : 'view.caption.glass'));
    const key = JSON.stringify(parts);
    if (key !== labelKey) {
      labelKey = key;
      view.requestRender();
    }
  }

  /** The frame the view draws: the shown eyes' frame, else the frame of the last input. */
  const frameFor = (inputs) => inputs.eyes.OD?.frame ?? inputs.eyes.OS?.frame ?? inputs.frame ?? null;

  /** @param {ViewInputs} inputs */
  function update(inputs) {
    last = inputs;
    paintProtrusion();
    if (attachedOnce) scheduleAria();
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
    const nextAbbe = { OD: inputs.eyes.OD?.result?.intermediates?.abbe ?? null, OS: inputs.eyes.OS?.result?.intermediates?.abbe ?? null };
    if (nextAbbe.OD !== abbe.OD || nextAbbe.OS !== abbe.OS) {
      abbe = nextAbbe;
      setDispersion();
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
      view.requestRender();
      if (attachedOnce) setBadge(inputs.current ? modeBadge() : 'view.badge.updating');
      if (attachedOnce) paintHeat();
      clearBadgeTimer();
      setPending('');
      return;
    }
    // Changed items, or nothing changed but a job is outstanding: requestMesh([]) makes it stale.
    const items = send.map(([slotName, w]) => ({ ...w.item, buffers: slotName === 'frame' ? frame.take() : lenses.takeSpare(slotName) }));
    const { gen, dropped } = client.requestMesh(items);
    giveBackAll(dropped);
    outstanding = { gen, sig };
    jobLog.push(send.map(([slotName]) => slotName));
    if (jobLog.length > JOB_LOG) jobLog.shift();
    metaByGen.set(gen, Object.fromEntries(send.map(([slotName, w]) => [slotName, w.meta])));
    sentAtByGen.set(gen, performance.now());
    setPending('mesh');
    if (attachedOnce && badgeTimer === null) {
      badgeTimer = setTimeout(() => {
        badgeTimer = null;
        if (viewEl.dataset.pending === 'mesh') setBadge('view.badge.updating');
      }, BADGE_AFTER_MS);
    }
  }

  window.__eyeglassView = Object.freeze({
    memory: () => ({ ...view.renderer.info.memory, programs: view.renderer.info.programs?.length ?? 0 }),
    allocs: () => ({ page: lenses.allocCount() + frame.allocCount(), worker: workerReallocs }),
    meshMode: () => client.mode(),
    viewName: () => controls.viewName(),
    /** 03-12: 'glass' | 'heat', and the engine scale / levels / heat eye of the painted map (null in Glas). */
    mode: () => mode,
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
        .filter((el) => !(/** @type {HTMLElement} */ (el).hidden))
        .map((el) => {
          const c = el.classList;
          const r = el.getBoundingClientRect();
          const kind = c.contains('view-dot') ? 'dot' : c.contains('view-label--callout') ? 'callout' : c.contains('view-label--iso') ? 'iso' : 'eye';
          return { kind, key: /** @type {HTMLElement} */ (el).dataset.key ?? null, text: el.textContent, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
        }),
      calloutsFit: calloutsFit(),
    }),
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

  return { update };
}
