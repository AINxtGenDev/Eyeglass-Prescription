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
import { createMeshClient } from '../../state/mesh-client.js';
import { transferOf } from '../../state/transfer.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtMm } from '../../i18n/format.js';
import { boxingCentreX, FRAME_FACE_MM, TEMPLE_DEFAULT_MM, TEMPLE_RANGE_MM } from '../../engine/mesh/frame.js';
import { createScene } from './scene.js';
import { createLensSlots } from './lenses.js';
import { createFrame } from './frame.js';
import { createLabels, place } from './labels.js';

const SLOTS = /** @type {const} */ (['OD', 'OS']);
/** Stale-geometry badge delay (UI-SPEC States: "not yet done for > 100 ms"). */
const BADGE_AFTER_MS = 100;
/** Eye label gap below the lowest outline point (mm). */
const LABEL_GAP_MM = 6;
const EYE_KEY = { OD: 'view.eye.od', OS: 'view.eye.os' };
/** Mesh jobs kept for the test handle meshJobs(). */
const JOB_LOG = 10;

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
}

/**
 * @typedef {{ shape: string, A: number, B: number, DBL: number }} ViewFrame
 * @typedef {{ result: any, frame: ViewFrame | null } | null} ViewEye
 * @typedef {{ rimDepthMm: number, templeMm: number | null, templeSource: 'stamp' | 'assumed' }} ViewDisplay
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
    if (badge.textContent !== text) badge.textContent = text;
  };

  const view = createScene(/** @type {HTMLCanvasElement} */ ($('view-canvas')), $('view-stage'));
  if (view === null) {
    // D-17: the note replaces the view; numbers, comparison and cross-section are unaffected.
    showNoWebgl();
    setPending('');
    return { update: () => setPending('') };
  }
  setText('view-caption', t('view.caption.glass'));
  const lenses = createLensSlots(view.scene, [...SLOTS]);
  const frame = createFrame(view.scene, { OD: lenses.group('OD'), OS: lenses.group('OS') });
  const labelsEl = $('view-labels');
  const labels = createLabels(labelsEl, SLOTS.length);
  /** Per eye: label anchor (world mm) or null. */
  const anchors = { OD: null, OS: null };
  let labelKey = null;
  /** Last frame seen on any eye: a blocked eye (no input spec) has none of its own. */
  let knownFrame = null;
  view.afterRender(() => {
    const size = { width: labelsEl.clientWidth, height: labelsEl.clientHeight };
    SLOTS.forEach((eye, i) => {
      if (anchors[eye]) place(labels.pool[i], anchors[eye], view.camera, size);
    });
  });
  // Compile the glass and edge programs while the mesh worker builds the first lenses.
  // compileAsync prepares every mesh's material, visible or not (WebGLRenderer r187 scene.traverse).
  // Without KHR_parallel_shader_compile it compiles synchronously and warns, so the first render
  // compiles instead (SwiftShader in headless Chromium has no such extension).
  if (view.renderer.extensions.has('KHR_parallel_shader_compile')) {
    view.renderer.compileAsync(view.scene, view.camera).then(view.requestRender, (err) => console.warn('3D view: compile', err));
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
  let fitKey = null;
  let attachedOnce = false;
  let retryLeft = true;
  /** Request data per mesh generation (the reply carries slot and buffers only). */
  const metaByGen = new Map();
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
    refit();
    attachedOnce = true;
    retryLeft = true;
    clearBadgeTimer();
    setText('view-status', '');
    setBadge(last?.current === false ? 'view.badge.updating' : 'view.badge.glass');
    setPending('');
    view.render();
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

  /**
   * Default view refit when the frame (or the set of drawn lenses) changes. UI-SPEC Camera: the
   * fit covers the frame bounding sphere (front + temples) and the lenses.
   */
  function refit() {
    const fm = frame.visible() ? frame.info() : null;
    const key = JSON.stringify([SLOTS.map((s) => (lenses.edgeMax(s) === null ? null : placement[s])), fm && fm.templeLen]);
    if (key === fitKey) return;
    fitKey = key;
    const r = Math.max(lenses.unionRadius(), frame.radius());
    if (r > 0) view.fit(r);
  }

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
    setText('view-caption', t(any ? 'view.caption.glass' : 'view.empty'));
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
        meta: { key, A, DBL, rimDepthMm, templeMm, templeSource },
      };
    } else {
      frame.hide();
      writeTech(null);
      attachedKey.frame = null;
    }
    updateLabels(new Set(SLOTS.filter((s) => want[s])));

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
      refit();
      view.requestRender();
      if (attachedOnce) setBadge(inputs.current ? 'view.badge.glass' : 'view.badge.updating');
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
    viewName: () => 'default',
    ior: (s) => lenses.ior(s),
    edgeMax: (s) => lenses.edgeMax(s),
    /** Test-only (03-07): frame measured from its attached buffers; lens group z (MINOR 9). */
    frameInfo: () => frame.info(),
    /** Test-only (03-07, round 2 MINOR 7): slot lists of the last 10 mesh jobs sent. */
    meshJobs: () => jobLog.map((j) => [...j]),
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
