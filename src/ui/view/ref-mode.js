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
// 04-10 (REF-02, D-15, D-16; UI-SPEC "Degradation"):
// - Grid tier: refStartTier(pickTier(...)) from the same device inputs as the quality tier
//   (scene.js), so 'fein' on the hoch class and 'mittel' on phones. Grid tiers never pass through
//   the quality-tier stepDown (tiers.js, PATTERNS bite 10).
// - The clock: sample = t1 − t0, t0 = the input event timestamp of the request whose results the job
//   traces (pipeline.js viewInputs().inputTs, the ENG-09 (c) t0), t1 = performance.now() in the first
//   requestAnimationFrame after the render that drew the job (afterRender). Counted: only completed
//   and drawn jobs for a new input (inputs current, a t0 not counted before). Excluded: superseded or
//   cancelled jobs (only the current generation is ever drawn), the first drawn job after entering
//   and after the stage comes back on screen, jobs without a new input (resize, picker, retry,
//   step-down; Mit/Ohne and context restore do not trace), and any sample whose span [t0, t1]
//   contains a visibilitychange, a pageshow with persisted or a resume event.
// - nextGuard (04-05) with 200 ms and two in a row → one grid tier down (cell AND leaf size, so it
//   also cuts rays in rim cases, lens-critic M2); never back up; at grob only stillSlow. A step shows
//   #view-ref-degraded, writes its text once into #view-ref-live and the badge reads
//   view.badge.refDegraded. The percentages are engine values and never change.
// 04-11 (D-11a, UI-SPEC "A/B comparison (D-11a)", items 26 and NEW-7): while inputs.compare is set
// the Durchblick shows the compared eye only (camera-math compareEye: the larger thickest point
// across A and B, ties → OD) as panels 'A' (left) and 'B' (right) on a stage ≥ 360 px, the same
// scale; below 360 px one panel for the variant #cmp-show shows. Panel A is traced from
// configuration A's own surfaces and frame (inputs.compare.A[eye], specA[eye].frame), B from the
// current result; the Rx is shared. While A is computing (compare.A null) panel A keeps its last
// drawn picture, or shows the first-picture status as its centred pill when it has none, and the
// size block omits A's line (the phase-2 A-pending rule). The size block lists A then B with
// view.ref.abNote; #view-ref-eye is hidden. Starting, ending and #cmp-show re-run the layout.
import { createWarpClient } from '../../state/warp-client.js';
// Static, not import(): warp.js is in this chunk already (ref-layout.js), so the sync fallback adds
// only the small handler, and no extra chunk (a dynamic one made Rolldown split the shared engine
// modules into a new hash-cascade chunk, 'frame-*', that test/dist/parity.test.js does not list).
import { createWarpHandler } from '../../state/warp-protocol.js';
import { t } from '../../i18n/t.js';
import { $, setText } from '../dom.js';
import { icon } from '../icons.js';
import { fmtMm, fmtAxis, fmtMs } from '../../i18n/format.js';
import { EYE_POINT_MM, HSA_ASSUMED_MM, ENTRANCE_PUPIL_MM } from '../../engine/magnification.js';
import { FIELD_HALF_ANGLE_DEG, REF_GRID_TIERS } from '../../engine/warp.js';
import { panelLayout, defaultRefEye, REF_SPLIT_MIN_PX } from './ref-layout.js';
import { refAria } from './text.js';
import { refBlockFor, writeRefSize } from './ref-size.js';
import { initGuard, nextGuard } from '../../state/guard.js';
import { pickTier, refStartTier, refStepDown } from './tiers.js';
import { compareEye } from './camera-math.js';
import { thickest } from '../../state/compare.js';
import { refSizeBlock } from './text.js';

/** UI-SPEC States "Stale": the badge changes when the new picture is not drawn 100 ms after the result paint. */
const BADGE_AFTER_MS = 100;
/** UI-SPEC "Degradation": the input → Durchblick budget (INP "good", web.dev/articles/inp) and the run. */
const REF_BUDGET_MS = 200;
const REF_SLOW_RUN = 2;
/** Counted samples kept for the test handle. */
const SAMPLE_LOG = 20;

/** The grid start tier from the device class (the same primary-pointer inputs as scene.js pickTier). */
export const deviceStartTier = () =>
  refStartTier(
    pickTier({
      coarse: window.matchMedia('(pointer: coarse)').matches,
      minScreen: Math.min(window.screen.width, window.screen.height),
    }),
  );

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
 * 04-11: the comparison as the Durchblick needs it, or null outside one. eye = the compared eye
 * (the 3D rule, view.js update); A = configuration A's result of that eye (null while computing).
 * @param {any} inputs
 * @returns {{ eye: 'OD' | 'OS', pending: boolean, A: any, frameA: any, showA: boolean } | null}
 */
function compareOf(inputs) {
  const c = inputs?.compare;
  if (!c) return null;
  const th = (r) => (r?.ok ? thickest(r.metrics).value : null);
  const eye = compareEye({
    A: c.A ? { OD: th(c.A.OD), OS: th(c.A.OS) } : null,
    B: { OD: th(inputs.eyes?.OD?.result), OS: th(inputs.eyes?.OS?.result) },
  });
  return { eye, pending: !c.A, A: c.A?.[eye] ?? null, frameA: c.specA?.[eye]?.frame ?? null, showA: c.showA === true };
}

/**
 * The warp source of a panel: { surfaces, frame } when it can be traced, 'pending' (A computing)
 * or null (not computable: the "nicht berechnet" fill).
 * @param {any} inputs @param {ReturnType<typeof compareOf>} cmp @param {{ id: string, eye: 'OD'|'OS' }} p
 */
function sourceOf(inputs, cmp, p) {
  if (cmp && p.id === 'A') {
    if (cmp.pending) return 'pending';
    return cmp.A?.ok && cmp.frameA ? { surfaces: cmp.A.surfaces, frame: cmp.frameA } : null;
  }
  return computable(inputs, p.eye) ? { surfaces: inputs.eyes[p.eye].result.surfaces, frame: inputs.eyes[p.eye].frame } : null;
}

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
  /** 04-11: the comparison of the last inputs (compareOf) and the layout signature it was measured for. */
  /** @type {ReturnType<typeof compareOf>} */
  let cmp = null;
  let cmpSig = '';
  const sigOf = (c) => (c ? `${c.eye}:${c.showA ? 'A' : 'B'}` : '');
  /** 04-09 (M4): #view-stage intersects the viewport (assumed until the observer's first report). */
  let onScreen = true;
  /** Warp jobs posted since mount (test handle), and whether the last one is a warm-up sample (04-10). */
  let jobs = 0;
  let lastJobExcluded = false;
  let failed = false;
  // 04-10: grid tier, guard and clock.
  const startTier = deviceStartTier();
  let tier = startTier;
  /** The tier the allocated panel grids are sized for (a step re-allocates when its reply is drawn). */
  let gridTier = tier;
  let guard = initGuard(tier);
  /** Grid tiers of the session, start first (one entry per step). */
  const tierPath = [tier];
  let degraded = false;
  let announced = false;
  /** A drawn job since entering / since the stage came back on screen (the warm-up exclusion). */
  let warm = false;
  /** The posted job: { gen, t0, counted }. */
  let job = null;
  /** The drawn job waiting for its t1. */
  let clockRec = null;
  /** The input t0 of the last counted-candidate job (one sample per input). */
  let lastInputT0 = null;
  /** performance.now() of the last visibilitychange / pageshow persisted / resume. */
  let lastInterruptAt = -Infinity;
  let lastSampleMs = null;
  /** Samples taken (counted or not), for the test handle. */
  let sampleN = 0;
  let lastSampleCounted = false;
  let lastComputeMs = null;
  /** The last drawn reply per panel (test handle; rays and rim flags, no Rx). */
  let lastReplies = [];
  /** The last drawn jobs (test handle: the job before and after a step for the same input). */
  const replyLog = [];
  const samples = [];
  /** The stage content box of the current layout (a step re-allocates the grids at this size). */
  let stageSize = { W: 0, H: 0 };
  /** Test-only (?refguardoff, read once like ?thumbguardoff): the guard measures but never trips. */
  let guardOff = false;
  // UI-SPEC test hooks (E8, M4). The flag strings exist only in non-production builds
  // (test/dist/hooks.test.js):
  // - refdegraded: start one step down with the note shown, for axe and screenshots;
  // - refguardoff (04-11): counted samples still run through nextGuard, but its run is reset instead
  //   of stepping, so ordinary Durchblick e2e tests cannot step down on a slow CI runner (the
  //   guard and step-down tests load the page without it).
  if (import.meta.env.MODE !== 'production') {
    const FORCE_DEGRADED_FLAG = 'refdegraded';
    const GUARD_OFF_FLAG = 'refguardoff';
    if (location.search.includes(FORCE_DEGRADED_FLAG)) {
      tier = refStepDown(tier);
      gridTier = tier;
      guard = initGuard(tier);
      tierPath.push(tier);
      degraded = true;
    }
    guardOff = location.search.includes(GUARD_OFF_FLAG);
  }
  const interrupt = () => {
    lastInterruptAt = performance.now();
  };
  document.addEventListener('visibilitychange', interrupt);
  document.addEventListener('resume', interrupt);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) interrupt();
  });

  const lensRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('#view-ref-lens input[name=view-ref-lens]')]);
  for (const r of lensRadios) {
    r.after(icon('check'));
    r.addEventListener('change', () => {
      if (r.checked) setLens(/** @type {'on' | 'off'} */ (r.value));
    });
  }
  // 04-12 (F-02): a new layout (fullscreen on/off, a resize) disables the toggle until its first
  // picture, and disabling the focused radio drops keyboard focus to <body>. Focus comes back to the
  // checked radio when the toggle is enabled again, unless the user has moved it meanwhile.
  let refocusLens = false;
  const setRadiosEnabled = (en) => {
    if (!en && lensRadios.some((r) => r === document.activeElement)) refocusLens = true;
    for (const r of lensRadios) r.disabled = !en;
    if (en && refocusLens) {
      refocusLens = false;
      const a = document.activeElement;
      if (a === null || a === document.body) lensRadios.find((r) => r.checked)?.focus({ preventScroll: true });
    }
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
      if (on && now) {
        warm = false;
        post('onscreen');
      }
    },
    { threshold: 0 },
  ).observe(stageEl);

  const badgeKey = () => (lens === 'off' ? 'view.badge.refOff' : degraded ? 'view.badge.refDegraded' : 'view.badge.ref');
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
    if (!split && wasSplit !== false && !cmp) {
      // The default-eye rule, once on each switch to one panel (UI-SPEC Interaction Contract).
      shownEye = defaultRefEye(mags());
      setPicker(shownEye);
    }
    wasSplit = split;
    // 04-11 (D-11a): no picker in a comparison (the compared eye is fixed; #cmp-show picks A or B).
    pickerEl.hidden = split || cmp !== null;
    cmpSig = sigOf(cmp);
    const next = cmp
      ? panelLayout({ stageW: r.width, stageH: r.height, compare: true, shownEye: cmp.eye, shown: cmp.showA ? 'A' : 'B' })
      : panelLayout({ stageW: r.width, stageH: r.height, shownEye });
    const key = JSON.stringify(next);
    if (key === layoutKey) return false;
    layoutKey = key;
    layout = next;
    stageSize = { W: r.width, H: r.height };
    gridTier = tier;
    getRefraction().setLayout(layout, stageSize, REF_GRID_TIERS[tier].cellPx);
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
      const src = sourceOf(inputs, cmp, p);
      if (src === null || src === 'pending') continue;
      const { shape, A, B } = src.frame;
      out.push({
        panel: p.id,
        eye: p.eye,
        surfaces: src.surfaces,
        frame: { shape, A, B },
        hMm: EYE_POINT_MM,
        layout: { wPx: p.w, hPx: p.h, pxPerTan: p.pxPerTan },
        tier,
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
    const b = cmp ? compareBlock() : refBlockFor(lastInputs?.eyes, { picture: true, ...rimFlags() });
    const key = JSON.stringify(b);
    if (key === blockKey) return;
    blockKey = key;
    block = b;
    writeRefSize($('view-ref-size'), b);
    scheduleAria();
  }

  /**
   * 04-11: the A/B size block for the compared eye: 'Vorher (A)' then 'Nachher (B)', abNote always;
   * A's line is left out while A computes; an eye not computed in a variant reads "nicht berechnet".
   */
  function compareBlock() {
    const c = /** @type {NonNullable<typeof cmp>} */ (cmp);
    const entry = (who, r) => {
      const mag = r?.ok ? r.magnification : null;
      return { who, mag, cyl: mag ? mag.meridians.length - 1 : 0 };
    };
    const entries = [];
    if (!c.pending) entries.push(entry('a', c.A));
    entries.push(entry('b', lastInputs?.eyes?.[c.eye]?.result));
    return entries.some((e) => e.mag) ? refSizeBlock(entries, { picture: true, compare: true, ...rimFlags() }) : null;
  }

  function writeStatic() {
    setText('view-ref-scope', t('view.ref.scope', { h: fmtMm(EYE_POINT_MM) }));
    const shown = layout.panels[0]?.eye ?? 'OD';
    const side = t(`view.viewName.${shown.toLowerCase()}`);
    // 04-11: view.ref.side.compare names "links Vorher (A), rechts Nachher (B)", so it is used for
    // the two A/B panels; the single A/B panel below 360 px keeps the one-panel sentence (its pill
    // and #cmp-show name the variant).
    setText(
      'view-ref-side',
      cmp && layout.split ? t('view.ref.side.compare', { side }) : layout.split ? t('view.ref.side.two') : t('view.ref.side.one', { side }),
    );
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
      post('retry');
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
    const anyEye = layout.panels.some((p) => sourceOf(lastInputs, cmp, p) !== null) || ['OD', 'OS'].some((e) => computable(lastInputs, e));
    const refraction = getRefraction();
    for (const p of layout.panels) {
      const src = sourceOf(lastInputs, cmp, p);
      // 04-11: configuration A computing: its last picture stays; without one, the first-picture status.
      if (src === 'pending') refraction.setBlocked(p.id, anyEye && !refraction.hasPicture(p.id), t('view.ref.loading'));
      else refraction.setBlocked(p.id, anyEye && src === null);
    }
  }

  /**
   * Post the job for the latest inputs when it differs from the last one posted; nothing while the
   * stage is off screen (M4).
   * @param {'input' | 'enter' | 'onscreen' | 'relayout' | 'retry' | 'step'} reason only 'input' jobs
   *   can be counted guard samples (UI-SPEC "Degradation")
   */
  function post(reason) {
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
    const { gen } = /** @type {ReturnType<typeof createWarpClient>} */ (client).requestWarp(list);
    jobs++;
    const t0 = lastInputs?.inputTs;
    // One sample per input: a later job for the same input (a second eye painted, a compare result)
    // has no new t0. A job without a new input is clocked from its post, for Technische Angaben only.
    // 04-11: every posted job consumes its input's t0 (not only 'input' jobs), so configuration A
    // arriving after an entry, relayout or comparison start is never counted from an old t0.
    const fresh = reason === 'input' && typeof t0 === 'number' && lastInputs.current === true && t0 !== lastInputT0;
    if (typeof t0 === 'number') lastInputT0 = t0;
    const counted = fresh && warm;
    job = { gen, t0: fresh ? t0 : performance.now(), counted };
    lastJobExcluded = !counted;
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
    if (d.items.length > 0 && d.items[0].tier !== gridTier && Object.hasOwn(REF_GRID_TIERS, d.items[0].tier)) {
      // A step-down reply: the grids are re-allocated at the new cell size only now, so the old
      // picture stayed until this one (stale badge meanwhile).
      gridTier = d.items[0].tier;
      refraction.setLayout(layout, stageSize, REF_GRID_TIERS[gridTier].cellPx);
    }
    const drawn = new Set();
    const prevRim = rimByPanel;
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
    for (const p of layout.panels) {
      if (drawn.has(p.id)) continue;
      // 04-11: a panel whose configuration A is computing keeps its last picture (and rim flags).
      if (sourceOf(lastInputs, cmp, p) === 'pending' && refraction.hasPicture(p.id)) {
        if (prevRim[p.id]) rimByPanel[p.id] = prevRim[p.id];
        continue;
      }
      refraction.clearPanel(p.id);
    }
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
    // 04-10: the clock waits for the render that draws this job (afterRender, then the next frame).
    if (job && job.gen === d.gen) {
      clockRec = { ...job, counted: job.counted && warm };
      job = null;
    }
    warm = true;
    lastComputeMs = typeof d.computeMs === 'number' ? d.computeMs : null;
    lastReplies = d.items.map((it) => ({ panel: it.panel, eye: it.eye, tier: it.tier, rays: it.rays, nx: it.nx, ny: it.ny, rimInField: it.rimInField }));
    replyLog.push({ gen: d.gen, computeMs: lastComputeMs, replies: lastReplies });
    if (replyLog.length > SAMPLE_LOG) replyLog.shift();
    writeGridTech();
    writeTimeTech();
    requestRender();
    scheduleAria();
  }

  /** One sample (UI-SPEC clock); only counted samples reach the guard. */
  function sample(rec, t1) {
    const ms = t1 - rec.t0;
    lastSampleMs = ms;
    sampleN++;
    const interrupted = lastInterruptAt >= rec.t0 || document.visibilityState !== 'visible';
    lastSampleCounted = rec.counted && !interrupted;
    if (lastSampleCounted) {
      samples.push(ms);
      if (samples.length > SAMPLE_LOG) samples.shift();
      const was = guard.tier;
      const next = nextGuard(guard, ms, { budgetMs: REF_BUDGET_MS, need: REF_SLOW_RUN, last: 'grob', down: refStepDown });
      // ?refguardoff: the guard measures but never trips (the run is reset instead).
      guard = guardOff ? { ...guard, run: 0 } : next;
      if (guard.tier !== was) stepTo(guard.tier);
    }
    writeGridTech();
    writeTimeTech();
  }

  /** An automatic step (never up): the note, the live text once, the badge; re-trace the current input. */
  function stepTo(next) {
    tier = next;
    tierPath.push(next);
    degraded = true;
    showDegraded();
    sentKey = null;
    post('step');
  }

  function showDegraded() {
    if (!degraded || !on) return;
    const note = $('view-ref-degraded');
    if (note.hidden) {
      note.replaceChildren(icon('info'), document.createTextNode(t('view.ref.degraded')));
      note.hidden = false;
    }
    if (!announced) {
      // Announced once per session (UI-SPEC Accessibility "Live regions"), after the note is visible.
      announced = true;
      $('view-ref-live').textContent = t('view.ref.degraded');
    }
  }

  /** Technische Angaben: the grid line (tier path, points of the shown panel, step suffix). */
  function writeGridTech() {
    const r = lastReplies[0];
    if (!r) return;
    const suffix = degraded ? t('tech.ref.degraded') + (guard.stillSlow ? t('tech.ref.stillSlow') : '') : '';
    setText(
      'tech-ref-grid',
      t('tech.ref.grid', {
        tier: tierPath.map((x) => t(`tech.ref.tier.${x}`)).join(' → '),
        nx: r.nx + 1,
        ny: r.ny + 1,
        degraded: suffix,
      }),
    );
  }
  function writeTimeTech() {
    if (lastSampleMs !== null) setText('tech-ref-time', t('tech.ref.time', { ms: fmtMs(lastSampleMs) }));
    if (lastComputeMs !== null) setText('tech-ref-compute', t('tech.ref.compute', { ms: fmtMs(lastComputeMs) }));
  }

  /** A new layout (resize, picker, two ↔ one panel): a new grid, so a new trace (fullscreen is 04-12). */
  function relayout() {
    if (!on) return false;
    if (!measure()) {
      writeStatic();
      return false;
    }
    writeStatic();
    clearFailed();
    setText('view-status', t('view.ref.loading'));
    setBadge(null);
    setRadiosEnabled(false);
    sentKey = null;
    renderText();
    post('relayout');
    return true;
  }

  return {
    /** Entering the Durchblick (view.js setMode('ref')) with the latest view inputs. */
    enter(inputs) {
      on = true;
      lastInputs = inputs;
      cmp = compareOf(inputs);
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
      warm = false;
      showDegraded();
      post('enter');
    },
    /** Every view update while on: the size block now, then the warp job (after the result paint). */
    update(inputs) {
      lastInputs = inputs;
      cmp = compareOf(inputs);
      if (!on) return;
      // 04-11: comparison start / end, a new compared eye or #cmp-show: a new panel layout.
      if (sigOf(cmp) !== cmpSig && relayout()) return;
      renderText();
      post('input');
    },
    resize: () => void relayout(),
    /** Leaving: cancel the lane (latest wins; nothing more is drawn) and drop the picture. */
    leave() {
      on = false;
      refocusLens = false;
      client?.cancel();
      sentKey = null;
      stash = null;
      job = null;
      clockRec = null;
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
    /** view.js afterRender in Durchblick: t1 is taken in the next frame after the drawing render. */
    afterRender() {
      const rec = clockRec;
      if (!rec || rec.armed) return;
      rec.armed = true;
      requestAnimationFrame(() => {
        if (clockRec !== rec) return;
        clockRec = null;
        sample(rec, performance.now());
      });
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
      const kind = cmp && layout.split ? 'compare' : layout.split ? 'two' : 'one';
      return refAria({ lens, layout: kind, eye, entries: block.entries });
    },
    /** Test handle data (no Rx values). */
    info: () => ({
      lens,
      panels: layout.panels.map(({ id, eye, pxPerTan, squarePx, x, y, w, h }) => ({ id, eye, pxPerTan, squarePx, x, y, w, h, rim: Boolean(rimByPanel[id]?.rimInField), pastRim: Boolean(rimByPanel[id]?.pastRimInField), noView: Boolean(rimByPanel[id]?.noViewInField) })),
      compare: cmp ? { eye: cmp.eye, pending: cmp.pending, showA: cmp.showA } : null,
      tier,
      startTier,
      degraded,
      guard: { ...guard },
      guardOff,
      samples: [...samples],
      lastSampleMs,
      sampleN,
      lastSampleCounted,
      computeMs: lastComputeMs,
      replies: lastReplies.map((r) => ({ ...r })),
      replyLog: replyLog.map((j) => ({ gen: j.gen, computeMs: j.computeMs, replies: j.replies.map((r) => ({ ...r })) })),
      drawnGen,
      jobs,
      lastJobExcluded,
      onScreen,
      failed,
    }),
  };
}
