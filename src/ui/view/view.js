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
import { createMeshClient } from '../../state/mesh-client.js';
import { transferOf } from '../../state/transfer.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { createScene } from './scene.js';
import { createLensSlots } from './lenses.js';

const SLOTS = /** @type {const} */ (['OD', 'OS']);
/** Stale-geometry badge delay (UI-SPEC States: "not yet done for > 100 ms"). */
const BADGE_AFTER_MS = 100;

/**
 * @typedef {{ result: any, frame: { shape: string, A: number, B: number, DBL: number } | null } | null} ViewEye
 * @typedef {{ eyes: { OD: ViewEye, OS: ViewEye }, current: boolean }} ViewInputs
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
    // 03-06 shows the no-WebGL note; the numbers are unaffected.
    setPending('');
    return { update: () => setPending('') };
  }
  setText('view-caption', t('view.caption.glass'));
  const lenses = createLensSlots(view.scene, [...SLOTS]);
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
  let lastKey = null;
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
    for (const it of items ?? []) if (it) lenses.giveBack(it.slot, it.buffers);
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
      metaByGen.delete(d.gen);
      if (d.current && last && retryLeft) {
        retryLeft = false;
        lastKey = null;
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
    const drawn = new Set();
    for (const it of d.items) {
      const m = meta[it?.slot];
      if (!m) {
        giveBackAll([it]);
        continue;
      }
      const p = placement[m.eye];
      lenses.attach(it.slot, it, { surfaces: m.surfaces, eye: m.eye, A: m.frame.A, DBL: p?.DBL ?? m.DBL });
      if (it.ok && it.finite) drawn.add(it.slot);
    }
    for (const s of SLOTS) if (!drawn.has(s)) lenses.hide(s);
    refit();
    attachedOnce = true;
    retryLeft = true;
    clearBadgeTimer();
    setText('view-status', '');
    setBadge(last?.current === false ? 'view.badge.updating' : 'view.badge.glass');
    setPending('');
    view.render();
  }

  /** Default view refit when the frame (or the set of drawn lenses) changes. */
  function refit() {
    const key = JSON.stringify(SLOTS.map((s) => (lenses.edgeMax(s) === null ? null : placement[s])));
    if (key === fitKey) return;
    fitKey = key;
    const r = lenses.unionRadius();
    if (r > 0) view.fit(r);
  }

  /** @param {ViewInputs} inputs */
  function update(inputs) {
    last = inputs;
    const want = [];
    for (const eye of SLOTS) {
      const e = inputs.eyes[eye];
      placement[eye] = e?.frame ?? null;
      if (e?.result?.ok && e.frame) {
        const { shape, A, B } = e.frame;
        want.push({ slot: eye, eye, surfaces: e.result.surfaces, frame: { shape, A, B } });
      } else {
        lenses.hide(eye);
      }
    }
    const key = JSON.stringify(want);
    if (key === lastKey) {
      // Same meshes: only the placement can differ (DBL).
      for (const w of want) {
        const p = placement[w.eye];
        if (p) lenses.place(w.slot, w.eye, w.frame.A, p.DBL);
      }
      refit();
      view.requestRender();
      // A job for this key may still be in flight ('mesh'); otherwise refreshView's 'queued' ends.
      if (viewEl.dataset.pending !== 'mesh') {
        if (attachedOnce) setBadge(inputs.current ? 'view.badge.glass' : 'view.badge.updating');
        setPending('');
      }
      return;
    }
    lastKey = key;
    const items = want.map((w) => ({ ...w, buffers: lenses.takeSpare(w.slot) }));
    const { gen, dropped } = client.requestMesh(items);
    giveBackAll(dropped);
    metaByGen.set(gen, Object.fromEntries(want.map((w) => [w.slot, { ...w, DBL: placement[w.eye]?.DBL ?? 0 }])));
    if (items.length === 0) {
      // Nothing to draw (03-06 shows the state); the request only makes older jobs stale.
      clearBadgeTimer();
      setText('view-status', '');
      setPending('');
      view.requestRender();
      return;
    }
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
    allocs: () => ({ page: lenses.allocCount(), worker: workerReallocs }),
    meshMode: () => client.mode(),
    viewName: () => 'default',
    ior: (s) => lenses.ior(s),
    edgeMax: (s) => lenses.edgeMax(s),
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
