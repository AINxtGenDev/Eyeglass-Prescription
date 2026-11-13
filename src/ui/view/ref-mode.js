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
// - Size block (D-05): engine text only (LensResult.magnification through text.js refSizeBlock),
//   written with textContent; it is ready with the result paint, never waits for the warp.
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
import { panelLayout } from './ref-layout.js';
import { refSizeBlock, refAria } from './text.js';

/** UI-SPEC States "Stale": the badge changes when the new picture is not drawn 100 ms after the result paint. */
const BADGE_AFTER_MS = 100;
/** Grid tier of this plan (04-10 adds the device rule and the step-down). */
const TIER = 'fein';
const EYES = /** @type {const} */ (['OD', 'OS']);

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

/**
 * @param {{ getRefraction: () => ReturnType<typeof import('./refraction.js').createRefraction>,
 *   canvasEl: HTMLElement, setBadge: (key: string | null) => void, setWarpPending: (on: boolean) => void,
 *   scheduleAria: () => void, requestRender: () => void }} o
 */
export function createRefMode({ getRefraction, canvasEl, setBadge, setWarpPending, scheduleAria, requestRender }) {
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
  let rim = { rimInField: false, pastRimInField: false };
  /** The last rendered size block (aria-label entries) and its memo key. */
  let block = null;
  let blockKey = '';

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

  /** The panel layout from the stage content box (the canvas fills it, inset 0). */
  function measure() {
    const r = canvasEl.getBoundingClientRect();
    const next = panelLayout({ stageW: r.width, stageH: r.height });
    const key = JSON.stringify(next);
    if (key === layoutKey) return false;
    layoutKey = key;
    layout = next;
    getRefraction().setLayout(layout, { W: r.width, H: r.height }, REF_GRID_TIERS[TIER].cellPx);
    hasPicture = false;
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

  /** One warp item per panel whose eye has a computed lens and a frame. */
  function items(inputs) {
    const out = [];
    for (const p of layout.panels) {
      const e = inputs?.eyes?.[p.eye];
      if (!e?.result?.ok || !e.frame) continue;
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

  /** Size block, scope and side sentence; the block is engine text (textContent only, T-04-34). */
  function renderText() {
    const entries = EYES.map((eye) => {
      const mag = lastInputs?.eyes?.[eye]?.result?.ok ? lastInputs.eyes[eye].result.magnification : null;
      // refSizeBlock only asks whether there is a cylinder: two meridians exist exactly then.
      return { who: /** @type {'od'|'os'} */ (eye.toLowerCase()), mag, cyl: mag ? mag.meridians.length - 1 : 0 };
    });
    const anyEye = EYES.some((eye) => lastInputs?.eyes?.[eye]);
    const b = refSizeBlock(entries, { picture: true, ...rim });
    const key = JSON.stringify([anyEye, b]);
    if (key === blockKey) return;
    blockKey = key;
    block = anyEye ? b : null;
    const sizeEl = $('view-ref-size');
    sizeEl.hidden = !anyEye;
    if (!anyEye) {
      sizeEl.replaceChildren();
      return;
    }
    const nodes = [];
    const p = (cls, text) => {
      const el = document.createElement('p');
      el.className = cls;
      el.textContent = text;
      return el;
    };
    nodes.push(p('ref-title', b.title));
    for (const e of b.entries) {
      nodes.push(p('ref-line', e.head));
      if (e.kind === 'cyl') {
        const ul = document.createElement('ul');
        ul.className = 'ref-dirs';
        for (const d of e.dirs) {
          const li = document.createElement('li');
          li.textContent = d;
          ul.append(li);
        }
        nodes.push(ul);
      }
    }
    for (const n of b.notes) nodes.push(p('ref-note small', n));
    sizeEl.replaceChildren(...nodes);
    scheduleAria();
  }

  function writeStatic() {
    setText('view-ref-scope', t('view.ref.scope', { h: fmtMm(EYE_POINT_MM) }));
    const shown = layout.panels[0]?.eye ?? 'OD';
    setText('view-ref-side', layout.split ? t('view.ref.side.two') : t('view.ref.side.one', { side: t(`view.viewName.${shown.toLowerCase()}`) }));
  }

  /** Post the job for the latest inputs when it differs from the last one posted. */
  function post() {
    const list = items(lastInputs);
    const key = JSON.stringify([layoutKey, list]);
    if (key === sentKey) return;
    sentKey = key;
    if (list.length === 0) {
      // No computable eye: nothing to trace; the panels stay the plain fill (UI-SPEC States).
      client?.cancel();
      getRefraction().clear();
      stale = false;
      clearBadgeTimer();
      setText('view-status', '');
      setBadge(null);
      setWarpPending(false);
      requestRender();
      return;
    }
    ensureClient();
    /** @type {ReturnType<typeof createWarpClient>} */ (client).requestWarp(list);
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
      // The job was lost (worker error or rejected sync import): the failure text (04-10 adds the
      // retry button and the Fehler-tier box); the size block stays (engine values).
      clearBadgeTimer();
      stale = false;
      setWarpPending(false);
      if (!hasPicture) setText('view-status', t('view.ref.failed'));
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
    const drawn = new Set();
    rim = { rimInField: false, pastRimInField: false };
    for (const it of d.items) {
      if (it?.ok && refraction.setWarp(it.panel, it)) {
        drawn.add(it.panel);
        rim.rimInField ||= it.rimInField;
        rim.pastRimInField ||= it.pastRimInField;
      }
    }
    for (const p of layout.panels) if (!drawn.has(p.id)) refraction.clearPanel(p.id);
    refraction.setLens(lens);
    hasPicture = drawn.size > 0;
    drawnGen = d.gen;
    stale = false;
    clearBadgeTimer();
    setText('view-status', hasPicture ? '' : t('view.ref.failed'));
    setRadiosEnabled(true);
    setBadge(hasPicture ? badgeKey() : null);
    setWarpPending(false);
    renderText();
    requestRender();
    scheduleAria();
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
    /** Stage resize: a new layout means a new grid, so a new trace (fullscreen is 04-12). */
    resize() {
      if (!on || !measure()) return;
      writeStatic();
      setText('view-status', t('view.ref.loading'));
      setBadge(null);
      setRadiosEnabled(false);
      post();
    },
    /** Leaving: cancel the lane (latest wins; nothing more is drawn) and drop the picture. */
    leave() {
      on = false;
      client?.cancel();
      sentKey = null;
      stash = null;
      hasPicture = false;
      stale = false;
      clearBadgeTimer();
      setWarpPending(false);
      getRefraction().clear();
      getRefraction().hidePills();
      setText('view-status', '');
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
      panels: layout.panels.map(({ id, eye, pxPerTan, squarePx, x, y, w, h }) => ({ id, eye, pxPerTan, squarePx, x, y, w, h })),
      tier: TIER,
      drawnGen,
    }),
  };
}
