// Mesh-worker message handler (03-04, VIZ-06). Pure: no DOM and no `self`; the worker glue
// (src/worker/mesh.worker.js) and the mesh client's sync fallback both call it.
//
// Messages
//   main → worker  { type: 'mesh', id, items: [{ slot: 'OD'|'OS'|'A', eye: 'OD'|'OS', surfaces,
//                    frame: { shape, A, B }, buffers: { front, frontN, back, backN, thick, band, bandN } }] }
//   worker → main  { type: 'ready' }   once
//                  plus at most one frame item (03-07, VIZ-02): { slot: 'frame', frame: { shape, A, B, DBL },
//                    eyes: { OD: surfaces|null, OS: surfaces|null }, rimDepthMm, templeMm, buffers: FRAME_LENGTHS keys }
//   worker → main  { type: 'mesh', id, items: [{ slot, ok, finite, reallocated, buffers, boundingSphere|null }], computeMs }
//                  a frame item also carries frontBoundingSphere, sideTarget, eyeBox, lensZ and templeMm
//                  (the drawn, clamped temple length), all null when ok is false
//   worker → main  { type: 'error', id, message }
//
// Mesh messages transfer their Float32Arrays both ways (transfer.js transferOf); the meshes are
// written in place into the sent arrays, so the same buffers go back. A missing, wrong-length or
// detached buffer is re-allocated and the item says reallocated: true (countable, 03-15).
// Every item is validated and built in its own try/catch; the handler never throws.
//
// lens-critic MAJOR 3: meshes run in this DEDICATED worker, not in the engine worker, so a
// numbers result never waits behind a mesh build (ENG-09 (c)).
import { buildLensMesh, allocLensBuffers, LENS_LENGTHS } from '../engine/mesh/lens.js';
import { frameOutline } from '../engine/frame/outline.js';
import { SHAPES } from '../engine/frame/shapes.js';
import { buildFrameMesh, allocFrameBuffers, FRAME_LENGTHS } from '../engine/mesh/frame.js';
import { BEVEL_RULE } from '../engine/rim.js';

export const READY = Object.freeze({ type: 'ready' });
/** OD, OS = the two main lenses; A = the compare lens (03-14); frame = the frame (03-07). */
export const MESH_SLOTS = Object.freeze(['OD', 'OS', 'A', 'frame']);

const EYES = ['OD', 'OS'];
const SURFACE_KEYS = ['n', 'ct', 'c1', 'k1', 'ca', 'cb', 'axisRad'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function invalidShapeSize(f) {
  if (!f || typeof f.shape !== 'string' || !Object.hasOwn(SHAPES, f.shape)) return 'shape';
  if (!isNum(f.A) || f.A <= 0 || !isNum(f.B) || f.B <= 0) return 'frame size';
  return null;
}

function invalidSurfaces(s) {
  if (!s || typeof s !== 'object') return 'surfaces';
  for (const k of SURFACE_KEYS) if (!isNum(s[k])) return `surfaces.${k}`;
  if (!s.oc || !isNum(s.oc.x) || !isNum(s.oc.y)) return 'surfaces.oc';
  return null;
}

/** @returns {string|null} why the lens item is invalid, or null */
function invalid(item) {
  if (!item || typeof item !== 'object') return 'item';
  if (!MESH_SLOTS.includes(item.slot) || item.slot === 'frame') return 'slot';
  if (!EYES.includes(item.eye)) return 'eye';
  return invalidShapeSize(item.frame) ?? invalidSurfaces(item.surfaces);
}

/** @returns {string|null} why the frame item is invalid, or null */
function invalidFrame(item) {
  const f = item.frame;
  const bad = invalidShapeSize(f);
  if (bad !== null) return bad;
  if (!isNum(f.DBL) || f.DBL < 0) return 'DBL';
  if (!isNum(item.rimDepthMm) || item.rimDepthMm <= 0) return 'rimDepthMm';
  if (!isNum(item.templeMm) || item.templeMm <= 0) return 'templeMm';
  const eyes = item.eyes;
  if (!eyes || typeof eyes !== 'object') return 'eyes';
  for (const eye of EYES) if (eyes[eye] != null && invalidSurfaces(eyes[eye]) !== null) return `eyes.${eye}`;
  return null;
}

/** Keep each right-length Float32Array, allocate the rest. */
function normalise(given, lengths, alloc) {
  const src = given && typeof given === 'object' ? given : {};
  const buffers = {};
  let reallocated = false;
  let fresh = null;
  for (const [k, len] of Object.entries(lengths)) {
    const b = src[k];
    if (b instanceof Float32Array && b.length === len) buffers[k] = b;
    else {
      fresh ??= alloc();
      buffers[k] = fresh[k];
      reallocated = true;
    }
  }
  return { buffers, reallocated };
}

/**
 * @param {{ meshFn?: typeof buildLensMesh, frameFn?: typeof buildFrameMesh, now?: () => number }} [deps]
 * @returns {(msg: any) => object}
 */
export function createMeshHandler({ meshFn = buildLensMesh, frameFn = buildFrameMesh, now = () => globalThis.performance.now() } = {}) {
  const fail = (item, buffers, reallocated) => ({
    slot: item?.slot ?? null,
    ok: false,
    finite: false,
    reallocated,
    buffers,
    boundingSphere: null,
  });

  const failFrame = (buffers, reallocated) => ({
    ...fail({ slot: 'frame' }, buffers, reallocated),
    frontBoundingSphere: null,
    sideTarget: null,
    eyeBox: null,
    lensZ: null,
    templeMm: null,
  });

  const buildFrame = (item) => {
    if (invalidFrame(item) !== null) return failFrame(item.buffers, false);
    const { buffers, reallocated } = normalise(item.buffers, FRAME_LENGTHS, allocFrameBuffers);
    try {
      const { shape, A, B, DBL } = item.frame;
      const eyes = { OD: item.eyes.OD ?? null, OS: item.eyes.OS ?? null };
      const { rimDepthMm, templeMm } = item;
      const r = frameFn({ frame: { shape, A, B, DBL }, eyes, rimDepthMm, templeMm, rule: BEVEL_RULE }, buffers);
      return {
        slot: 'frame',
        ok: true,
        finite: r.finite === true,
        reallocated,
        buffers,
        boundingSphere: r.boundingSphere ?? null,
        frontBoundingSphere: r.frontBoundingSphere ?? null,
        sideTarget: r.sideTarget ?? null,
        eyeBox: r.eyeBox ?? null,
        lensZ: r.lensZ ?? null,
        templeMm: r.templeMm ?? null,
      };
    } catch {
      return failFrame(buffers, reallocated);
    }
  };

  const buildItem = (item) => {
    if (item?.slot === 'frame') return buildFrame(item);
    if (invalid(item) !== null) return fail(item, item?.buffers, false);
    const { buffers, reallocated } = normalise(item.buffers, LENS_LENGTHS, allocLensBuffers);
    try {
      const { shape, A, B } = item.frame;
      const r = meshFn(item.surfaces, frameOutline(shape, A, B, item.eye), buffers);
      return { slot: item.slot, ok: true, finite: r.finite === true, reallocated, buffers, boundingSphere: r.boundingSphere ?? null };
    } catch {
      return fail(item, buffers, reallocated);
    }
  };

  return (msg) => {
    const id = msg?.id ?? null;
    try {
      if (msg?.type === 'mesh') {
        const t0 = now();
        const items = (msg.items ?? []).map(buildItem);
        return { type: 'mesh', id, items, computeMs: now() - t0 };
      }
    } catch {
      // a malformed items list (not an array): fall through to the error reply
    }
    return { type: 'error', id, message: 'mesh worker: unknown message' };
  };
}
