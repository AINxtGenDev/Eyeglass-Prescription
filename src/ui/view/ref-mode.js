// Durchblick mode (04-08, REF-01, D-02, D-05, D-13; UI-SPEC "Scheduling and stale state", States
// "First entry", "Ready", "Stale", "Ohne Glas"). Keeps view.js small: the warp lane, the panel
// layout, the Bild toggle, the badge, the size block and the canvas accessible name.
//
// - Warp lane: its own module worker, created lazily on the first entry (04-05 warp-client:
//   latest wins, cancel on leave, watchdog → main-thread fallback one panel per macrotask). A job
//   is posted from update(), which view.js calls with every result paint, so the numbers never wait
//   for a warp (D-13, ENG-09 (c) path untouched). Only a changed job (items or layout) is posted.
// - A reply is drawn in its own animation frame after a second isWarpCurrent() check (T-04-31);
//   refraction.setWarp() also checks the grid size and the array lengths.
// - Never an unwarped "Mit Glas": until the first current warp the stage shows view.ref.loading and
//   no chart pixel; later a stale picture stays and the badge says view.badge.refUpdating once the
//   new one is not drawn 100 ms after the result paint. #view[data-pending] is 'warp' meanwhile.
// - Size block (D-05): engine text only (ref-size.js), written with textContent; it is ready with
//   the result paint, never waits for the warp.
// 04-09:
// - One panel below a 360 px stage (D-06 as amended) with the "Durchblick für" picker; the
//   default-eye rule (ref-layout.js defaultRefEye) applies once on each switch to one panel.
// - States: a blocked eye gets no warp item; its panel is the fill with the centred pill
//   view.ref.pill.blocked and no ticks (T-04-37). No computable eye: plain fill, no pills, the size
//   block hidden. A lost job or a failed item: the 03-06 Fehler-tier box with view.ref.failed and
//   "Erneut versuchen" (re-posts the job); the size block stays.
// - Stage visibility (M4): an IntersectionObserver on #view-stage (threshold 0). Off-screen no warp
//   job is posted (T-04-38); off → on posts one job for the latest input (marked as excluded from
//   the 04-10 degradation guard). view.js defers its re-mesh while the stage is on screen.
import { createWarpClient } from '../../state/warp-client.js';
// Static, not import(): warp.js is in this chunk already (ref-layout.js), so the sync fallback adds
// only the small handler, and no extra chunk (a dynamic one made Rolldown split the shared engine
// modules into a new hash-cascade chunk, 'frame-*', that test/dist/parity.test.js does not list).
import { createWarpHandler } from '../../state/warp-protocol.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtMm, fmtAxis } from '../../i18n/format.js';
import { EYE_POINT_MM, HSA_ASSUMED_MM, ENTRANCE_PUPIL_MM } from '../../engine/magnification.js';
import { FIELD_HALF_ANGLE_DEG, REF_GRID_TIERS } from '../../engine/warp.js';
import { panelLayout, defaultRefEye, REF_SPLIT_MIN_PX } from './ref-layout.js';
import { refAria } from './text.js';
import { refBlockFor, writeRefSize } from './ref-size.js';

/** UI-SPEC States "Stale": the badge changes when the new picture is not drawn 100 ms after the result paint. */
const BADGE_AFTER_MS = 100;
/** Grid tier of this plan (04-10 adds the device rule and the step-down). */
const TIER = 'fein';

/** Technische Angaben: eye point, its sources and the field (written once at mount, engine constants). */
export function writeRefTech() {
  setText(
    'tech-ref-eye',
    t('tech.ref.eye', {
      h: fmtMm(EYE_POINT_MM),
      hsa: fmtMm(HSA_ASSUMED_MM),
      pupil: fmtMm(ENTRANCE_PUPIL_MM),
      source: t('tech.ref.source.cited', { cite: t('tech.ref.source.cite') }),
      field: fmtAxis(FIELD_HALF_ANGLE_DEG),
    }),
  );
}

/** A computable eye: a computed lens and a frame (the warp needs both). */
const computable = (inputs, eye) => Boolean(inputs?.eyes?.[eye]?.result?.ok && inputs.eyes[eye].frame);

/**
 * @param {{ getRefraction: () => ReturnType<typeof import('./refraction.js').createRefraction>,
 *   canvasEl: HTMLElement, stageEl: HTMLElement, setBadge: (key: string | null) => void,
 *   setWarpPending: (on: boolean) => void, scheduleAria: () => void, requestRender: () => void,
 *   onVisibility?: (onScreen: boolean) => void }} o
 */
export function createRefMode({ getRefraction, canvasEl, stageEl, setBadge, setWarpPending, scheduleAria, requestRender, onVisibility }) {
  let on = false;
  /** @type {'on' | 'off'} */
  let lens = 'on';
  /** @type {ReturnType<typeof panelLayout>} */
  let layout = { panels: [], split: false };
  let layoutKey = '';
  /** @type {any} */
  let lastInputs = null;
  /** @type {ReturnType<typeof createWarpClient> | null} */
  let client = null;
  /** @type {Worker | null} */
  let worker = null;
  let sentKey = null;
  let drawnGen = 0;
  let hasPicture = false;
  let stale = false;
  let badgeTimer = null;
  let stash = null;
  let paintFrame = null;
  /** Per drawn panel id: { rimInField, pastRimInField } of its last drawn warp. */
  let rimByPanel = {};
  /** The last rendered size block (aria-label entries) and its memo key. */
  let block = null;
  let blockKey = '';
  /** 04-09: the eye of the one-panel layout and whether the last layout was split (null = none since entry). */
  /** @type {'OD' | 'OS'} */
  let shownEye = 'OD';
  /** @type {boolean | null} */
  let wasSplit = null;
  /** 04-09 (M4): #view-stage intersects the viewport (assumed until the observer's first report). */
  let onScreen = true;
  /** Warp jobs posted since mount (test handle), and whether the last one is a warm-up sample (04-10). */
  let jobs = 0;
  let lastJobExcluded = false;
  let failed = false;

  const lensRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('#view-ref-lens input[name=view-ref-lens]')]);
  for (const r of lensRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (r.checked) setLens(/** @type {'on' | 'off'} */ (r.value));
    });
  }
  const setRadiosEnabled = (en) => {
    for (const r of lensRadios) r.disabled = !en;
  };
  // 04-09: "Durchblick für" (one-panel mode only). The picker changes the picture, not the scale.
  const pickerEl = $('view-ref-eye');
  const eyeRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('#view-ref-eye input[name=view-ref-eye]')]);
  for (const r of eyeRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (!r.checked) return;
      shownEye = /** @type {'OD' | 'OS'} */ (r.value);
      relayout();
    });
  }
  const setPicker = (eye) => {
    for (const r of eyeRadios) r.checked = r.value === eye;
  };

  // 04-09 (M4): stage visibility.
  new IntersectionObserver(
    (entries) => {
      const now = entries[entries.length - 1].isIntersecting;
      if (now === onScreen) return;
      onScreen = now;
      onVisibility?.(now);
      if (on && now) post({ excluded: true });
    },
    { threshold: 0 },
  ).observe(stageEl);

  const badgeKey = () => (lens === 'off' ? 'view.badge.refOff' : 'view.badge.ref');
  const clearBadgeTimer = () => {
    if (badgeTimer !== null) clearTimeout(badgeTimer);
    badgeTimer = null;
  };

  function setLens(next) {
    lens = next;
    getRefraction().setLens(next);
    if (!stale && hasPicture) setBadge(badgeKey());
    requestRender();
    scheduleAria();
  }

  const mags = () => ({
    OD: lastInputs?.eyes?.OD?.result?.ok ? lastInputs.eyes.OD.result.magnification : null,
    OS: lastInputs?.eyes?.OS?.result?.ok ? lastInputs.eyes.OS.result.magnification : null,
  });

  /** The panel layout from the stage content box (the canvas fills it, inset 0). */
  function measure() {
    const r = canvasEl.getBoundingClientRect();
    const split = r.width >= REF_SPLIT_MIN_PX;
    if (!split && wasSplit !== false) {
      // The default-eye rule, once on each switch to one panel (UI-SPEC Interaction Contract).
      shownEye = defaultRefEye(mags());
      setPicker(shownEye);
    }
    wasSplit = split;
    pickerEl.hidden = split;
    const next = panelLayout({ stageW: r.width, stageH: r.height, shownEye });
    const key = JSON.stringify(next);
    if (key === layoutKey) return false;
    layoutKey = key;
    layout = next;
    getRefraction().setLayout(layout, { W: r.width, H: r.height }, REF_GRID_TIERS[TIER].cellPx);
    hasPicture = false;
    rimByPanel = {};
    return true;
  }

  function ensureClient() {
    if (client) return;
    client = createWarpClient({
      send: (msg) => /** @type {Worker} */ (worker).postMessage(msg),
      onWarp,
      onFallback: () => {
        worker?.terminate();
        worker = null;
      },
      loadSyncHandler: () => Promise.resolve({ createWarpHandler }),
      isHidden: () => document.hidden,
    });
    try {
      worker = new Worker(new URL('../../worker/warp.worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (e) => client?.receive(e.data));
      worker.addEventListener('error', () => client?.workerError());
      worker.addEventListener('messageerror', () => client?.workerError());
    } catch {
      client.workerError();
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) client?.resume();
    });
  }

  /** One warp item per panel whose eye is computable; a blocked eye gets none (T-04-37). */
  function items(inputs) {
    const out = [];
    for (const p of layout.panels) {
      if (!computable(inputs, p.eye)) continue;
      const e = inputs.eyes[p.eye];
      const { shape, A, B } = e.frame;
      out.push({
        panel: p.id,
        eye: p.eye,
        surfaces: e.result.surfaces,
        frame: { shape, A, B },
        hMm: EYE_POINT_MM,
        layout: { wPx: p.w, hPx: p.h, pxPerTan: p.pxPerTan },
        tier: TIER,
      });
    }
    return out;
  }

  /** Rim flags of the shown, drawn panels (N3, lens-critic MINOR 8). */
  const rimFlags = () => {
    const f = { rimInField: false, pastRimInField: false };
    for (const p of layout.panels) {
      const r = rimByPanel[p.id];
      if (!r) continue;
      f.rimInField ||= r.rimInField;
      f.pastRimInField ||= r.pastRimInField;
    }
    return f;
  };

  /** Size block, scope and side sentence; the block is engine text (textContent only, T-04-34). */
  function renderText() {
    const b = refBlockFor(lastInputs?.eyes, { picture: true, ...rimFlags() });
    const key = JSON.stringify(b);
    if (key === blockKey) return;
    blockKey = key;
    block = b;
    writeRefSize($('view-ref-size'), b);
    scheduleAria();
  }

  function writeStatic() {
    setText('view-ref-scope', t('view.ref.scope', { h: fmtMm(EYE_POINT_MM) }));
    const shown = layout.panels[0]?.eye ?? 'OD';
    setText('view-ref-side', layout.split ? t('view.ref.side.two') : t('view.ref.side.one', { side: t(`view.viewName.${shown.toLowerCase()}`) }));
  }

  /** The Fehler-tier box in the stage (03-06 pattern): view.ref.failed + "Erneut versuchen". */
  function showFailed() {
    failed = true;
    clearBadgeTimer();
    stale = false;
    hasPicture = false;
    rimByPanel = {};
    getRefraction().clear();
    const status = $('view-status');
    const msg = document.createElement('span');
    msg.textContent = t('view.ref.failed');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = t('view.retry');
    retry.addEventListener('click', () => {
      // The button goes away: keep keyboard focus in the view (the stage has no tab stop here).
      /** @type {HTMLElement | null} */ (document.querySelector('#view-mode input[value=ref]'))?.focus();
      clearFailed();
      sentKey = null;
      post();
    });
    status.classList.add('view-failed');
    status.replaceChildren(msg, retry);
    setBadge(null);
    setRadiosEnabled(false);
    setWarpPending(false);
    renderText();
    requestRender();
  }
  function clearFailed() {
    if (!failed) return;
    failed = false;
    const status = $('view-status');
    status.classList.remove('view-failed');
    status.replaceChildren();
  }

  /** The blocked-eye pills of the panels whose eye is not computable (none when no eye is). */
  function markBlocked() {
    const anyEye = layout.panels.some((p) => computable(lastInputs, p.eye)) || ['OD', 'OS'].some((e) => computable(lastInputs, e));
    const refraction = getRefraction();
    for (const p of layout.panels) refraction.setBlocked(p.id, anyEye && !computable(lastInputs, p.eye));
  }

  /**
   * Post the job for the latest inputs when it differs from the last one posted; nothing while the
   * stage is off screen (M4).
   * @param {{ excluded?: boolean }} [o] excluded: the off → on job (04-10 guard warm-up sample)
   */
  function post({ excluded = false } = {}) {
    if (!onScreen) return;
    const list = items(lastInputs);
    const key = JSON.stringify([layoutKey, list]);
    if (key === sentKey) return;
    sentKey = key;
    clearFailed();
    if (list.length === 0) {
      // No computable eye in the shown panels: nothing to trace; the panels stay the plain fill.
      client?.cancel();
      getRefraction().clear();
      markBlocked();
      hasPicture = false;
      stale = false;
      rimByPanel = {};
      clearBadgeTimer();
      setText('view-status', '');
      setBadge(null);
      setWarpPending(false);
      renderText();
      requestRender();
      return;
    }
    ensureClient();
    /** @type {ReturnType<typeof createWarpClient>} */ (client).requestWarp(list);
    jobs++;
    lastJobExcluded = excluded;
    setWarpPending(true);
    if (!hasPicture) {
      setText('view-status', t('view.ref.loading'));
      setBadge(null);
      setRadiosEnabled(false);
      return;
    }
    if (badgeTimer === null) {
      badgeTimer = setTimeout(() => {
        badgeTimer = null;
        if (on && sentKey !== null && stale) setBadge('view.badge.refUpdating');
      }, BADGE_AFTER_MS);
    }
    stale = true;
  }

  function onWarp(d) {
    if (!on) return;
    if (d.items === null) {
      // The job was lost (worker error or rejected sync import): the Fehler box; the size block stays.
      showFailed();
      return;
    }
    stash = d;
    if (paintFrame === null) paintFrame = requestAnimationFrame(paint);
  }

  function paint() {
    paintFrame = null;
    const d = stash;
    stash = null;
    // Second check in the paint frame: an input may have arrived after the reply (T-04-31).
    if (!d || !on || !client?.isWarpCurrent(d.gen)) return;
    const refraction = getRefraction();
    if (d.items.some((it) => !it?.ok)) {
      showFailed();
      return;
    }
    const drawn = new Set();
    rimByPanel = {};
    for (const it of d.items) {
      if (refraction.setWarp(it.panel, it)) {
        drawn.add(it.panel);
        rimByPanel[it.panel] = { rimInField: it.rimInField, pastRimInField: it.pastRimInField, noViewInField: it.noViewInField };
      }
    }
    if (drawn.size < d.items.length) {
      // A reply that does not fit the allocated grid (T-04-31) is no picture either.
      showFailed();
      return;
    }
    for (const p of layout.panels) if (!drawn.has(p.id)) refraction.clearPanel(p.id);
    markBlocked();
    refraction.setLens(lens);
    hasPicture = drawn.size > 0;
    drawnGen = d.gen;
    stale = false;
    clearBadgeTimer();
    setText('view-status', '');
    setRadiosEnabled(true);
    setBadge(hasPicture ? badgeKey() : null);
    setWarpPending(false);
    renderText();
    requestRender();
    scheduleAria();
  }

  /** A new layout (resize, picker, two ↔ one panel): a new grid, so a new trace (fullscreen is 04-12). */
  function relayout() {
    if (!on || !measure()) return;
    writeStatic();
    clearFailed();
    setText('view-status', t('view.ref.loading'));
    setBadge(null);
    setRadiosEnabled(false);
    sentKey = null;
    renderText();
    post();
  }

  return {
    /** Entering the Durchblick (view.js setMode('ref')) with the latest view inputs. */
    enter(inputs) {
      on = true;
      lastInputs = inputs;
      layoutKey = '';
      sentKey = null;
      hasPicture = false;
      stale = false;
      wasSplit = null;
      measure();
      writeStatic();
      renderText();
      setText('view-status', t('view.ref.loading'));
      setBadge(null);
      setRadiosEnabled(false);
      post();
    },
    /** Every view update while on: the size block now, then the warp job (after the result paint). */
    update(inputs) {
      lastInputs = inputs;
      if (!on) return;
      renderText();
      post();
    },
    resize: relayout,
    /** Leaving: cancel the lane (latest wins; nothing more is drawn) and drop the picture. */
    leave() {
      on = false;
      client?.cancel();
      sentKey = null;
      stash = null;
      hasPicture = false;
      stale = false;
      rimByPanel = {};
      clearBadgeTimer();
      clearFailed();
      setWarpPending(false);
      getRefraction().clear();
      getRefraction().hidePills();
      setText('view-status', '');
    },
    isOn: () => on,
    onScreen: () => onScreen,
    /** Context restored (Pitfall 7): the picture is redrawn from the last warp; the status stays. */
    restoreStatus() {
      if (!on || failed) return;
      setText('view-status', hasPicture || sentKey === null ? '' : t('view.ref.loading'));
    },
    /** The canvas accessible name (view.js writeAria, debounced 500 ms). */
    ariaLabel() {
      if (!block) return null;
      const eye = /** @type {'od'|'os'} */ ((layout.panels[0]?.eye ?? 'OD').toLowerCase());
      return refAria({ lens, layout: layout.split ? 'two' : 'one', eye, entries: block.entries });
    },
    /** Test handle data (no Rx values). */
    info: () => ({
      lens,
      panels: layout.panels.map(({ id, eye, pxPerTan, squarePx, x, y, w, h }) => ({ id, eye, pxPerTan, squarePx, x, y, w, h, rim: Boolean(rimByPanel[id]?.rimInField), pastRim: Boolean(rimByPanel[id]?.pastRimInField), noView: Boolean(rimByPanel[id]?.noViewInField) })),
      tier: TIER,
      drawnGen,
      jobs,
      lastJobExcluded,
      onScreen,
      failed,
    }),
  };
}
