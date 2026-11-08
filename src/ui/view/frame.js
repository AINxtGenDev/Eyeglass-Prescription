// Frame in the 3D view (03-07, VIZ-02, D-06, D-09). The mesh worker builds the frame with the pure
// engine builder (src/engine/mesh/frame.js, 03-03); this module only shows it. Geometries are
// created ONCE from allocFrameBuffers() and the static index arrays; a re-mesh swaps the attribute
// arrays (same lengths, as lenses.js), and the previous arrays go to the frame's buffer pool.
//
// Buffer frames (engine): rimOD/rimOS hold lens-local x, y and world z (lensZ included), so each
// rim sits in its own Group at boxingCentreX(eye, A, DBL); bridge, hinges and temples are world.
//
// Materials (UI-SPEC Materials, D-09): opaque polished acetate #221e1c (never see-through: a
// see-through frame would disappear behind the lenses) and metal hinges #9a9a9a.
//
// lens-critic MINOR 9: both lens groups get position.z = item.lensZ[eye], so the two lenses are
// referenced to one common rim plane (mean bevel apex at z = 0) and rims, bridge and lenses form
// one rigid frame. The z is set here, in the same paint frame as the lens attach, so lens and rim
// never disagree for a rendered frame.
//
// lens-critic round 2 MINOR 7: a frame item with ok false (or not drawable) hides the frame meshes,
// keeps the lenses, and leaves each lens group's z at lastLensZ, the lensZ of the last drawable
// frame item ({ OD: 0, OS: 0 } before the first). Reason: keeping the value means the lenses do
// not jump while the frame is missing; with the rims hidden no lens/rim disagreement can be seen;
// the next ok frame item sets the common plane again. Resetting to 0 would move anisometropic
// lenses for a state that has no rim to align with.
//
// 03-11 (UI-SPEC "Seite near-temple fade"): setFade(eye) swaps the temple and hinge of that eye to
// pre-built faded clones (TEMPLE_FADE_OPACITY, transparent, depthWrite false) by assigning
// mesh.material; no material flag is ever toggled (that would force a program rebuild). The faded
// clones sit on hidden one-triangle carrier meshes from the start, so the renderer's compile()
// (r187 walks scene.traverse, hidden meshes included) prepares their programs before first use.
//
// 03-14 (RES-03): view.js creates a second instance for configuration A ('frameA') with no lens
// groups (compare3d.js sets the A lens z from lensZ()). compareParts(eye) hands compare3d the rim
// group of one eye and every other part, so its render pass can show one rim, recentred, and
// restore everything afterwards. No mesh, geometry or material is created or disposed for that.
import { BufferGeometry, BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Sphere, Vector3 } from 'three';
import {
  allocFrameBuffers,
  boxingCentreX,
  FRAME_LENGTHS,
  RIM_INDEX,
  BRIDGE_INDEX,
  TEMPLE_INDEX,
  HINGE_INDEX,
  BRIDGE_RINGS,
  TEMPLE_RINGS,
} from '../../engine/mesh/frame.js';
import { createBufferPool } from './lenses.js';
import { TEMPLE_FADE_OPACITY } from './camera-math.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

/** Mesh part → [position key, normal key, index, material, rim eye or null (world)]. */
const PARTS = /** @type {const} */ ({
  rimOD: ['rimOD', 'rimODN', RIM_INDEX, 'acetate', 'OD'],
  rimOS: ['rimOS', 'rimOSN', RIM_INDEX, 'acetate', 'OS'],
  bridge: ['bridge', 'bridgeN', BRIDGE_INDEX, 'acetate', null],
  templeOD: ['templeOD', 'templeODN', TEMPLE_INDEX, 'acetate', null],
  templeOS: ['templeOS', 'templeOSN', TEMPLE_INDEX, 'acetate', null],
  hingeOD: ['hingeOD', 'hingeODN', HINGE_INDEX, 'hinge', null],
  hingeOS: ['hingeOS', 'hingeOSN', HINGE_INDEX, 'hinge', null],
});

/** Centre of tube ring k (the mean of its vertices; the ring is symmetric about its centre). */
function ringCentre(pos, rings, k) {
  const per = pos.length / 3 / rings;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let v = k * per; v < (k + 1) * per; v++) {
    x += pos[3 * v];
    y += pos[3 * v + 1];
    z += pos[3 * v + 2];
  }
  return [x / per, y / per, z / per];
}

/**
 * @param {import('three').Scene} scene
 * @param {{ OD?: import('three').Group, OS?: import('three').Group }} lensGroups the lens slot groups
 *   (none for the compare frame 'frameA', 03-14)
 */
export function createFrame(scene, lensGroups) {
  const materials = {
    acetate: new MeshPhysicalMaterial({ color: '#221e1c', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 }),
    hinge: new MeshStandardMaterial({ color: '#9a9a9a', metalness: 1, roughness: 0.3 }),
  };
  // Set once at creation; never toggled afterwards.
  const fadedOf = (m) => {
    const f = m.clone();
    f.setValues({ transparent: true, opacity: TEMPLE_FADE_OPACITY, depthWrite: false });
    return f;
  };
  const faded = { acetate: fadedOf(materials.acetate), hinge: fadedOf(materials.hinge) };
  const pool = createBufferPool(allocFrameBuffers, FRAME_LENGTHS);
  const initial = pool.take();
  pool.giveBack(pool.take()); // one spare set from the start

  const root = new Group();
  root.name = 'frame';
  root.visible = false;
  const rimGroups = {};
  for (const eye of EYES) {
    rimGroups[eye] = new Group();
    rimGroups[eye].name = `rim${eye}`;
    root.add(rimGroups[eye]);
  }
  /** @type {Record<string, BufferGeometry>} */
  const geo = {};
  /** @type {Record<string, Mesh>} */
  const meshes = {};
  for (const [part, [pos, nrm, index, mat, rimEye]] of Object.entries(PARTS)) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(initial[pos], 3));
    g.setAttribute('normal', new BufferAttribute(initial[nrm], 3));
    g.setIndex(new BufferAttribute(index, 1));
    g.boundingSphere = new Sphere(new Vector3(), 0);
    geo[part] = g;
    meshes[part] = new Mesh(g, materials[mat]);
    (rimEye ? rimGroups[rimEye] : root).add(meshes[part]);
  }
  scene.add(root);
  // Hidden carriers of the faded materials (same attribute set as the temple: position + normal).
  const fadeCarrier = new Group();
  fadeCarrier.name = 'frameFadeCarrier';
  fadeCarrier.visible = false;
  for (const m of Object.values(faded)) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    fadeCarrier.add(new Mesh(g, m));
  }
  scene.add(fadeCarrier);
  /** Eye whose temple and hinge are faded (null = none). */
  let fadedSide = null;

  /** lensZ of the last drawable frame item (MINOR 7: kept while the frame is missing). */
  let lastLensZ = { OD: 0, OS: 0 };
  /** The last attached item and its request data, for the camera presets and frameInfo(). */
  let last = null;

  const applyLensZ = () => {
    for (const eye of EYES) if (lensGroups[eye]) lensGroups[eye].position.z = lastLensZ[eye];
  };

  /** Hide the frame (no frame inputs, or a frame that is not drawable); lens z stays. */
  function hide() {
    root.visible = false;
    applyLensZ();
  }

  return {
    /** A set to send with a frame mesh request. */
    take: () => pool.take(),
    giveBack: (set) => pool.giveBack(set),
    lose: () => pool.lose(),
    allocCount: () => pool.allocCount(),
    hide,
    /** The hidden carrier group of the faded materials (view.js compiles it without the extension). */
    fadeCarrier,
    /**
     * Fade the temple and hinge of one eye (the camera side), or none; swaps mesh.material only.
     * @param {'OD' | 'OS' | null} eye
     */
    setFade(eye) {
      if (eye === fadedSide) return;
      fadedSide = eye;
      for (const e of EYES) {
        const on = e === eye;
        meshes[`temple${e}`].material = on ? faded.acetate : materials.acetate;
        meshes[`hinge${e}`].material = on ? faded.hinge : materials.hinge;
      }
    },
    /**
     * Swap a built frame item's arrays in; the previous arrays go to the pool.
     * @param {any} item the worker's frame item
     * @param {{ A: number, DBL: number, rimDepthMm: number }} meta the request's frame data
     * @returns {boolean} drawn
     */
    attach(item, meta) {
      last = { item, meta };
      const lz = item.lensZ;
      const drawable = item.ok && item.finite && item.boundingSphere && lz && Number.isFinite(lz.OD + lz.OS) && pool.usable(item.buffers);
      if (!drawable) {
        pool.giveBack(item.buffers);
        hide();
        return false;
      }
      const old = {};
      const b = item.boundingSphere;
      const bx = { OD: boxingCentreX('OD', meta.A, meta.DBL), OS: boxingCentreX('OS', meta.A, meta.DBL) };
      for (const [part, [pos, nrm, , , rimEye]] of Object.entries(PARTS)) {
        const g = geo[part];
        for (const [attr, key] of [['position', pos], ['normal', nrm]]) {
          const a = /** @type {BufferAttribute} */ (g.getAttribute(attr));
          old[key] = a.array;
          a.array = item.buffers[key];
          a.needsUpdate = true;
        }
        // The world sphere of the whole frame; a rim group is offset by its boxing centre.
        g.boundingSphere.center.set(b.x - (rimEye ? bx[rimEye] : 0), b.y, b.z);
        g.boundingSphere.radius = b.r;
      }
      pool.giveBack(old);
      for (const eye of EYES) rimGroups[eye].position.x = bx[eye];
      lastLensZ = { OD: lz.OD, OS: lz.OS };
      applyLensZ();
      root.visible = true;
      return true;
    },
    visible: () => root.visible,
    /** 03-14: the common-rim-plane z of each lens of the last drawable item. */
    lensZ: () => ({ ...lastLensZ }),
    /**
     * 03-14: the parts compare3d.js toggles in its render pass: the root, the rim group of `eye`
     * and every mesh that is not that eye's rim (bridge, temples, hinges, the other rim).
     * @param {'OD' | 'OS'} eye
     */
    compareParts: (eye) => ({
      root,
      rim: rimGroups[eye],
      others: Object.entries(meshes)
        .filter(([part]) => part !== `rim${eye}`)
        .map(([, m]) => m),
      rimGroups: Object.values(rimGroups),
      /** bridge, temples and hinges (never shown in a comparison) */
      nonRim: Object.entries(meshes)
        .filter(([part]) => !part.startsWith('rim'))
        .map(([, m]) => m),
    }),
    /**
     * 03-14: the eye's lens + rim box and temporal rim point of the last drawable item in
     * lens-local coordinates (the boxing centre subtracted from x), or null.
     * @param {'OD' | 'OS'} eye
     */
    localEye(eye) {
      if (!root.visible || !last?.item.eyeBox || !last.item.sideTarget) return null;
      const bx = boxingCentreX(eye, last.meta.A, last.meta.DBL);
      const b = last.item.eyeBox[eye];
      const st = last.item.sideTarget[eye];
      return {
        box: { min: { ...b.min, x: b.min.x - bx }, max: { ...b.max, x: b.max.x - bx } },
        sideTarget: { ...st, x: st.x - bx },
      };
    },
    /** Camera data of the last drawable item (03-09, 03-12), or null. */
    cameraData: () =>
      root.visible && last
        ? {
            boundingSphere: last.item.boundingSphere,
            frontBoundingSphere: last.item.frontBoundingSphere,
            boundingBox: last.item.boundingBox,
            sideTarget: last.item.sideTarget,
            eyeBox: last.item.eyeBox,
          }
        : null,
    /** Test-only: measured from the attached buffers (ring centres) and the last item. */
    info() {
      const shown = root.visible;
      const pos = (part) => /** @type {Float32Array} */ (geo[part].getAttribute('position').array);
      let bridgeSpanX = null;
      let templeLen = null;
      if (shown) {
        const bridge = pos('bridge');
        bridgeSpanX = ringCentre(bridge, BRIDGE_RINGS, BRIDGE_RINGS - 1)[0] - ringCentre(bridge, BRIDGE_RINGS, 0)[0];
        templeLen = {};
        for (const eye of EYES) {
          const p = pos(`temple${eye}`);
          let len = 0;
          let prev = ringCentre(p, TEMPLE_RINGS, 0);
          for (let k = 1; k < TEMPLE_RINGS; k++) {
            const c = ringCentre(p, TEMPLE_RINGS, k);
            len += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]);
            prev = c;
          }
          templeLen[eye] = len;
        }
      }
      return {
        bridgeSpanX,
        templeLen,
        rimDepth: last?.meta.rimDepthMm ?? null,
        rimVisible: { OD: shown && rimGroups.OD.visible, OS: shown && rimGroups.OS.visible },
        lensZ: last?.item.lensZ ?? null,
        lensGroupZ: { OD: lensGroups.OD?.position.z ?? null, OS: lensGroups.OS?.position.z ?? null },
        sideTarget: last?.item.sideTarget ?? null,
        eyeBox: last?.item.eyeBox ?? null,
        boundingBox: last?.item.boundingBox ?? null,
        fadedSide,
      };
    },
  };
}
