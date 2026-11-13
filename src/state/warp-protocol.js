// Warp-worker message handler (04-05, REF-01 / REF-02, D-13). Pure: no DOM and no `self`; the
// worker glue (src/worker/warp.worker.js) and the warp client's sync fallback both call it.
//
// Messages
//   main → worker  { type: 'warp', id, items: [{ panel, eye: 'OD'|'OS', surfaces, frame: { shape, A, B },
//                    hMm?, layout: { wPx, hPx, pxPerTan }, tier: 'fein'|'mittel'|'grob' }] }
//   worker → main  { type: 'ready' }   once
//   worker → main  { type: 'warp', id, items: [item], computeMs }
//                  item ok:     { panel, eye, ok: true, tier, nx, ny, cellX, cellY, uv, cls, leaves,
//                                 leafCount, rays, rimInField, pastRimInField, noViewInField, maxObjTan }
//                  item failed: { panel, ok: false, code: 'INVALID_ITEM', field }
//                               { panel, ok: false, code: 'WARP_FAILED' } (an exception)
//                               { panel, ok: false, code } (an engine failure object, passed on)
//   worker → main  { type: 'error', id, message }
//
// The reply's typed arrays (uv, cls, leaves) are transferred to the page (transfer.js transferOf).
// Every item is validated and computed in its own try/catch; the handler never throws (T-04-18).
// computeMs is measured here with an injected clock, so the engine stays free of `performance`.
// The warp runs in its own worker, not in the engine or mesh worker, so a numbers result never
// waits behind a warp job (D-13).
import { prepareWarp, warpGrid, REF_GRID_TIERS } from '../engine/warp.js';
import { SHAPES } from '../engine/frame/shapes.js';

export const READY = Object.freeze({ type: 'ready' });

const EYES = ['OD', 'OS'];
// Same list and checks as mesh-protocol.js; a shared module is a later clean-up.
const SURFACE_KEYS = ['n', 'ct', 'c1', 'k1', 'ca', 'cb', 'axisRad'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPos = (v) => isNum(v) && v > 0;

function invalidSurfaces(s) {
  if (!s || typeof s !== 'object') return 'surfaces';
  for (const k of SURFACE_KEYS) if (!isNum(s[k])) return `surfaces.${k}`;
  if (!s.oc || !isNum(s.oc.x) || !isNum(s.oc.y)) return 'surfaces.oc';
  return null;
}

/** @returns {string|null} the first invalid field of the item, or null */
function invalid(item) {
  if (!item || typeof item !== 'object') return 'item';
  if (!EYES.includes(item.eye)) return 'eye';
  const f = item.frame;
  if (!f || typeof f.shape !== 'string' || !Object.hasOwn(SHAPES, f.shape)) return 'shape';
  if (!isPos(f.A) || !isPos(f.B)) return 'frame size';
  const bad = invalidSurfaces(item.surfaces);
  if (bad !== null) return bad;
  if (item.hMm !== undefined && !isPos(item.hMm)) return 'hMm';
  const l = item.layout;
  if (!l || typeof l !== 'object' || !isPos(l.wPx) || !isPos(l.hPx) || !isPos(l.pxPerTan)) return 'layout';
  if (typeof item.tier !== 'string' || !Object.hasOwn(REF_GRID_TIERS, item.tier)) return 'tier';
  return null;
}

/**
 * @param {{ warpFn?: typeof warpGrid, prepareFn?: typeof prepareWarp, now?: () => number }} [deps]
 * @returns {(msg: any) => object}
 */
export function createWarpHandler({ warpFn = warpGrid, prepareFn = prepareWarp, now = () => globalThis.performance.now() } = {}) {
  const computeItem = (item) => {
    const field = invalid(item);
    if (field !== null) return { panel: item?.panel ?? null, ok: false, code: 'INVALID_ITEM', field };
    const { panel, eye, tier } = item;
    try {
      const { shape, A, B } = item.frame;
      const ctx = prepareFn({ surfaces: item.surfaces, frame: { shape, A, B }, eye, hMm: item.hMm });
      if (!ctx?.ok) return { panel, ok: false, code: ctx?.code ?? 'WARP_FAILED' };
      const { wPx, hPx, pxPerTan } = item.layout;
      const { cellPx, leafPx } = REF_GRID_TIERS[tier];
      const r = warpFn(ctx, { wPx, hPx, pxPerTan }, cellPx, { leafPx });
      if (!r?.ok) return { panel, ok: false, code: r?.code ?? 'WARP_FAILED' };
      return {
        panel,
        eye,
        ok: true,
        tier,
        nx: r.nx,
        ny: r.ny,
        cellX: r.cellX,
        cellY: r.cellY,
        uv: r.uv,
        cls: r.cls,
        leaves: r.leaves,
        leafCount: r.leafCount,
        rays: r.rays,
        rimInField: r.rimInField,
        pastRimInField: r.pastRimInField,
        noViewInField: r.noViewInField,
        maxObjTan: r.maxObjTan,
      };
    } catch {
      return { panel, ok: false, code: 'WARP_FAILED' };
    }
  };

  return (msg) => {
    const id = msg?.id ?? null;
    try {
      if (msg?.type === 'warp' && Array.isArray(msg.items)) {
        const t0 = now();
        const items = msg.items.map(computeItem);
        return { type: 'warp', id, items, computeMs: now() - t0 };
      }
    } catch {
      // defensive: computeItem catches per item; fall through to the error reply
    }
    return { type: 'error', id, message: 'warp worker: unknown message' };
  };
}
