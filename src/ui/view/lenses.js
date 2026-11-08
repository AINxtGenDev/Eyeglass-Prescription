// Lens slots (03-05, VIZ-01, VIZ-04, D-26). One Group per slot ('OD', 'OS'; 03-14 adds 'A') with
// front, back and edge-band meshes. Geometries are created ONCE with the fixed lens topology
// (topology.js) and the fixed LENS_LENGTHS arrays; a re-mesh only swaps the attribute arrays
// (same byteLength, so three.js updates the GPU buffer in place; RESEARCH Pitfall 1). The
// attached arrays are never transferred to the worker (Pitfall 7): attach() puts the previous
// arrays into the slot's pool, and the next request sends a pool set.
//
// Pool (createBufferPool, shared with the frame in frame.js since 03-07): per slot at most
// POOL_CAP spare sets. The page holds the attached set and the sets of the in-flight and the
// queued mesh job; a new request takes a set before the replaced queued job hands its set back,
// so up to 4 sets per slot exist during fast typing. allocCount counts every alloc() call (03-15
// leak test, lens-critic MINOR 6): it stops growing once the sets needed by the input rate exist,
// and grows again only after a lost reply.
import { BufferGeometry, BufferAttribute, Group, Mesh, MeshPhysicalMaterial, Sphere, Vector3, FrontSide } from 'three';
import { allocLensBuffers, LENS_LENGTHS } from '../../engine/mesh/lens.js';
import { FRONT_INDEX, BACK_INDEX, BAND_INDEX } from '../../engine/mesh/topology.js';
import { boxingCentreX } from '../../engine/mesh/frame.js';
import { dispersionFor } from './tiers.js';

const POOL_CAP = 3;

/** Mesh part → [position key, normal key] in the lens buffers. */
const PARTS = /** @type {const} */ ({ front: ['front', 'frontN'], back: ['back', 'backN'], band: ['band', 'bandN'] });

// One index attribute per part, shared by every slot (one GPU index buffer each).
const INDEX = { front: new BufferAttribute(FRONT_INDEX, 1), back: new BufferAttribute(BACK_INDEX, 1), band: new BufferAttribute(BAND_INDEX, 1) };

/** Shared opaque edge band (UI-SPEC Materials). */
const edgeMaterial = () => new MeshPhysicalMaterial({ color: '#6f8a84', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 });

/** A full, right-length, not detached set (a detached Float32Array has length 0). */
const usableFor = (lengths) => (b) =>
  !!b && Object.entries(lengths).every(([k, len]) => b[k] instanceof Float32Array && b[k].length === len);
const usable = usableFor(LENS_LENGTHS);

/**
 * Bounded pool of buffer sets for one mesh slot (03-07: lens slots and the frame).
 * @param {() => Record<string, Float32Array>} alloc
 * @param {Record<string, number>} lengths the slot's buffer lengths (a set is taken back only if it matches)
 * @returns {{ take: () => Record<string, Float32Array>, giveBack: (set: any) => void, lose: () => void,
 *   usable: (set: any) => boolean, allocCount: () => number, lostCount: () => number }}
 */
export function createBufferPool(alloc, lengths) {
  const ok = usableFor(lengths);
  const spare = [];
  let allocCount = 0;
  let lostCount = 0;
  return {
    /** A spare set, or a new one when the pool is empty. */
    take: () => spare.pop() ?? (allocCount++, alloc()),
    /** Return a set that came back from the worker or was never sent. */
    giveBack(set) {
      if (ok(set) && spare.length < POOL_CAP && !spare.includes(set)) spare.push(set);
    },
    /** A sent set did not come back (dead worker, error reply); the next take allocates. */
    lose: () => void lostCount++,
    usable: ok,
    allocCount: () => allocCount,
    lostCount: () => lostCount,
  };
}

/**
 * @param {import('three').Scene} scene
 * @param {string[]} slotNames
 */
export function createLensSlots(scene, slotNames) {
  const edge = edgeMaterial();
  /** @type {Record<string, { group: Group, glass: MeshPhysicalMaterial, geo: Record<string, BufferGeometry>, thick: Float32Array, pool: ReturnType<typeof createBufferPool>, sphere: Sphere | null }>} */
  const slots = {};

  for (const name of slotNames) {
    const glass = new MeshPhysicalMaterial({
      transmission: 1,
      ior: 1.5,
      thickness: 2,
      roughness: 0,
      metalness: 0,
      specularIntensity: 1,
      side: FrontSide,
    });
    const pool = createBufferPool(allocLensBuffers, LENS_LENGTHS);
    const initial = pool.take();
    pool.giveBack(pool.take()); // one spare set from the start
    const group = new Group();
    group.name = name;
    group.visible = false;
    const geo = {};
    for (const [part, [pos, nrm]] of Object.entries(PARTS)) {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(initial[pos], 3));
      g.setAttribute('normal', new BufferAttribute(initial[nrm], 3));
      g.setIndex(INDEX[part]);
      g.boundingSphere = new Sphere(new Vector3(), 0);
      geo[part] = g;
      group.add(new Mesh(g, part === 'band' ? edge : glass));
    }
    scene.add(group);
    slots[name] = { group, glass, geo, thick: initial.thick, pool, sphere: null };
  }

  /** Return a set that came back from the worker or was never sent. */
  function giveBack(name, buffers) {
    slots[name]?.pool.giveBack(buffers);
  }
  function hide(name) {
    slots[name].group.visible = false;
  }

  return {
    allocCount: () => Object.values(slots).reduce((n, s) => n + s.pool.allocCount(), 0),
    /** A set to send with a mesh request (the pool, or a new one when the pool is empty). */
    takeSpare: (name) => slots[name].pool.take(),
    /** A sent set of this slot was lost with its job. */
    lose: (name) => slots[name]?.pool.lose(),
    /** The slot's Group (the frame sets its z to the common rim plane, 03-07 MINOR 9). */
    group: (name) => slots[name].group,
    visible: (name) => slots[name].group.visible,
    giveBack,
    hide,
    /**
     * Swap a built item's arrays into the slot's geometries; the previous arrays go to the pool.
     * @param {string} name
     * @param {{ ok: boolean, finite: boolean, buffers: object, boundingSphere: { x: number, y: number, z: number, r: number } | null }} item
     * @param {{ surfaces: { n: number, ct: number }, eye: 'OD'|'OS', A: number, DBL: number }} meta
     */
    attach(name, item, meta) {
      const s = slots[name];
      if (!item.ok || !item.finite || !item.boundingSphere || !usable(item.buffers)) {
        giveBack(name, item.buffers);
        hide(name);
        return;
      }
      const old = { thick: s.thick };
      for (const [part, keys] of Object.entries(PARTS)) {
        const g = s.geo[part];
        for (const [attr, key] of [['position', keys[0]], ['normal', keys[1]]]) {
          const a = /** @type {BufferAttribute} */ (g.getAttribute(attr));
          old[key] = a.array;
          a.array = item.buffers[key];
          a.needsUpdate = true;
        }
        const b = item.boundingSphere;
        g.boundingSphere.center.set(b.x, b.y, b.z);
        g.boundingSphere.radius = b.r;
      }
      s.thick = item.buffers.thick;
      giveBack(name, old);
      s.glass.ior = meta.surfaces.n;
      s.glass.thickness = meta.surfaces.ct;
      s.group.position.x = boxingCentreX(meta.eye, meta.A, meta.DBL);
      s.sphere = new Sphere(new Vector3(item.boundingSphere.x, item.boundingSphere.y, item.boundingSphere.z), item.boundingSphere.r);
      s.group.visible = true;
    },
    /** Move a slot to its boxing centre (a DBL change needs no re-mesh). */
    place(name, eye, A, DBL) {
      slots[name].group.position.x = boxingCentreX(eye, A, DBL);
    },
    /** Radius about the origin of the union of the visible slots' spheres (world, mm); 0 if none. */
    unionRadius() {
      let r = 0;
      for (const s of Object.values(slots)) {
        if (!s.group.visible || !s.sphere) continue;
        const c = s.sphere.center;
        r = Math.max(r, Math.hypot(c.x + s.group.position.x, c.y, c.z + s.group.position.z) + s.sphere.radius);
      }
      return r;
    },
    /** Test-only: max over the attached band of front z − back z, or null when hidden. */
    edgeMax(name) {
      const s = slots[name];
      if (!s?.group.visible) return null;
      const band = /** @type {Float32Array} */ (s.geo.band.getAttribute('position').array);
      const n = band.length / 6;
      let max = -Infinity;
      for (let i = 0; i < n; i++) max = Math.max(max, band[3 * i + 2] - band[3 * (n + i) + 2]);
      return max;
    },
    ior: (name) => slots[name].glass.ior,
    /**
     * 03-08 (D-12, RESEARCH Pattern 5): glass dispersion = dispersionFor(tier, νe) per slot. Set on
     * a tier or material change only; transmission is never toggled (Pitfall 11: crossing 0
     * recompiles the glass program, so the value is written only when it changes).
     * @param {string} tier
     * @param {Record<string, number | null>} abbeBySlot νe per slot (null: no Abbe number)
     */
    setDispersion(tier, abbeBySlot) {
      for (const [name, s] of Object.entries(slots)) {
        const d = dispersionFor(tier, abbeBySlot[name] ?? null);
        if (s.glass.dispersion !== d) s.glass.dispersion = d;
      }
    },
    dispersion: (name) => slots[name].glass.dispersion,
  };
}
