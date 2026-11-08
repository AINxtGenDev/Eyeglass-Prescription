// VIZ-03 camera math (03-09; UI-SPEC "Camera and Controls" with the Revision 1 amendments R1-3,
// R1-4 and the 03-09 execution amendments A1, A2). Pure: plain {x, y, z} objects and no three.js,
// DOM or globals, so it runs in Node. controls.js turns these poses into camera moves.
//
// Directions point from the target to the camera (unit vectors). The camera basis matches
// three.js lookAt with up = +y: right = normalise(up × dir), up' = dir × right.
//
// Fits (all + FIT_MARGIN, vertical FOV FOV_DEG):
// - Default 3/4 and Oben (A1, 2026-11-08): the projected silhouette of the frame + temples (the
//   corners of the frame's world AABB and both eye boxes) as seen from the preset direction. The
//   target moves to the centre of that silhouette (in the plane through the bridge centre normal to
//   the view) and the distance is the perspective-exact fit of every corner for the stage aspect.
//   For points in the target plane this is fitBoxDistance(halfV, halfH, aspect). The old sphere fit
//   of the whole frame about the origin left each lens ≈ 35 px wide on a 412 px phone.
// - Vorne: the sphere of the frame front about the origin (fitDistance), as planned.
// - Seite (R1-3): from the side the screen's vertical axis is world y and its horizontal axis is
//   world z, so the box fit uses the side eye's eyeBox y and z half-extents. The temples run out of
//   the picture on purpose (the near one fades in 03-11).
// - Dickenkarte (R1-5, 03-12): Vorne direction, box fit of the heat eye's eyeBox x and y extents.
// - A/B compare (03-14, RES-03, D-24 as amended): one camera for both halves, each lens recentred
//   on its own boxing centre (lens-local coordinates). compareContext unions the A and B lens + rim
//   boxes, so every pose fits both halves at ONE scale (the larger configuration decides). Default,
//   Vorne and Oben target the origin (the common boxing centre) with a perspective-exact,
//   aspect-aware fit of that union about the origin; Seite and Dickenkarte use the union box.
import { CHART_DISTANCE_MM } from '../../engine/mesh/frame.js';

/** Vertical field of view (UI-SPEC Camera: 20° in every view) [BP]. */
export const FOV_DEG = 20;
/** Camera near and far planes (mm) [BP]; chartRect checks that the chart stays inside far. */
export const CAMERA_NEAR_MM = 10;
export const CAMERA_FAR_MM = 6000;
/** Margin around every fit (UI-SPEC Camera: + 8 %) [BP]. */
export const FIT_MARGIN = 1.08;
/**
 * Dickenkarte fit margin (03-13 deviation, design value [BP], no optical meaning): with 1,08 the
 * heat eye's rim touched the stage edges, so the on-lens callouts (8 px gap + a 31 px pill) and
 * the 'Dickenkarte' badge had no room and a 412 px phone fell back to the table-only note.
 */
export const HEAT_FIT_MARGIN = 1.3;
/** Default 3/4 view: azimuth toward the wearer's right (−x) and elevation (UI-SPEC Camera table) [BP]. */
export const DEFAULT_AZ_DEG = 35;
export const DEFAULT_EL_DEG = 15;
/** Oben: 85° from above (UI-SPEC Camera table) [BP]. */
export const TOP_EL_DEG = 85;
/** Preset transition (UI-SPEC Camera: 450 ms ease-in-out cubic) [BP]. */
export const TWEEN_MS = 450;
/** Keyboard steps (UI-SPEC Keyboard, D-20) [BP]. */
export const KEY_AZ_DEG = 15;
export const KEY_EL_DEG = 10;
export const KEY_PAN_MM = 5;
export const KEY_ZOOM = 1.25;
/** Runtime tier step-down: median frame time over the last frames (UI-SPEC Quality tiers, sparsam row) [BP]. */
export const STEP_DOWN_MS = 20;
export const STEP_DOWN_FRAMES = 30;
/** Chart grazing fade: hidden beyond this angle from its normal (UI-SPEC Background chart) [BP]. */
export const CHART_FADE_DEG = 70;
/** OrbitControls limits from the presets (lens-critic MAJOR 2, revision 1; UI-SPEC R1-4) [BP]. */
export const MIN_DIST_FACTOR = 0.5;
export const MAX_DIST_FACTOR = 2;
export const TARGET_MARGIN_MM = 20;
/** Side eye tie band (lens-critic MINOR 13, revision 1; UI-SPEC R1-3) [BP]. */
export const SIDE_TIE_MM = 0.05;
/** Polar angle limits (UI-SPEC OrbitControls limits) [BP]. */
export const POLAR_MIN = 0.05;
export const POLAR_MAX = Math.PI - 0.05;
/** A2: chart extent padding and snap (one checker period, so the 10 mm squares keep their phase) [BP]. */
export const CHART_PAD_MM = 20;
export const CHART_SNAP_MM = 20;
/** Seite near-temple fade: within this angle of a pure side view, at this opacity (UI-SPEC Lighting, 03-11) [BP]. */
export const TEMPLE_FADE_DEG = 30;
export const TEMPLE_FADE_OPACITY = 0.25;
/** Chart plane z (mm): CHART_DISTANCE_MM behind the frame front (03-08). */
const CHART_Z_MM = -CHART_DISTANCE_MM;

const RAD = Math.PI / 180;
const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 });
const v3 = (x, y, z) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a) => scale(a, 1 / len(a));

/** Unit direction from azimuth (toward −x is the wearer's right) and elevation, degrees. */
const dirOf = (azDeg, elDeg) =>
  v3(-Math.sin(azDeg * RAD) * Math.cos(elDeg * RAD), Math.sin(elDeg * RAD), Math.cos(azDeg * RAD) * Math.cos(elDeg * RAD));
const DEFAULT_DIR = Object.freeze(dirOf(DEFAULT_AZ_DEG, DEFAULT_EL_DEG));
const FRONT_DIR = Object.freeze(v3(0, 0, 1));
const TOP_DIR = Object.freeze(v3(0, Math.sin(TOP_EL_DEG * RAD), Math.cos(TOP_EL_DEG * RAD)));

/**
 * Camera basis for a direction (three.js lookAt with up = +y).
 * @param {{x:number,y:number,z:number}} dir unit, target → camera
 */
export function basisOf(dir) {
  const right = norm(cross(v3(0, 1, 0), dir));
  return { right, up: cross(dir, right) };
}

/** Sphere fit: distance = 1,08 · r / sin(fov/2). */
export function fitDistance(r, fovDeg = FOV_DEG) {
  return (FIT_MARGIN * r) / Math.sin((fovDeg / 2) * RAD);
}

/** Box fit in the target plane: distance = margin (1,08) · max(halfV, halfH / aspect) / tan(fov/2). */
export function fitBoxDistance(halfV, halfH, aspect, fovDeg = FOV_DEG, margin = FIT_MARGIN) {
  return (margin * Math.max(halfV, halfH / aspect)) / Math.tan((fovDeg / 2) * RAD);
}

/**
 * A1: centred perspective fit of points seen from `dir`. The target is the centre of the points'
 * projected extent on the camera right/up axes (in the plane through the origin normal to dir);
 * the distance is the smallest one for which every point p satisfies
 * |h| / (d − s) ≤ tan(hfov/2) / 1,08 and |v| / (d − s) ≤ tan(fov/2) / 1,08
 * (h, v = right/up offsets from the target, s = p · dir, the depth toward the camera).
 * @param {{x:number,y:number,z:number}[]} points world mm
 * @param {{x:number,y:number,z:number}} dir unit
 * @param {number} aspect stage width / height
 */
export function fitPointsDistance(points, dir, aspect, fovDeg = FOV_DEG, { centred = true } = {}) {
  const { right, up } = basisOf(dir);
  let h0 = Infinity;
  let h1 = -Infinity;
  let w0 = Infinity;
  let w1 = -Infinity;
  for (const p of points) {
    const h = dot(p, right);
    const v = dot(p, up);
    h0 = Math.min(h0, h);
    h1 = Math.max(h1, h);
    w0 = Math.min(w0, v);
    w1 = Math.max(w1, v);
  }
  // centred false (03-14 compare): the target stays at the origin (the boxing centre).
  const cH = centred ? (h0 + h1) / 2 : 0;
  const cV = centred ? (w0 + w1) / 2 : 0;
  const tanV = Math.tan((fovDeg / 2) * RAD);
  const tanH = tanV * aspect;
  let distance = 0;
  for (const p of points) {
    const s = dot(p, dir);
    const h = Math.abs(dot(p, right) - cH);
    const v = Math.abs(dot(p, up) - cV);
    distance = Math.max(distance, s + (FIT_MARGIN * h) / tanH, s + (FIT_MARGIN * v) / tanV);
  }
  return { target: add(scale(right, cH), scale(up, cV)), distance };
}

/** CSS px per mm at the target for a stage of the given height (D-19 scale check). */
export function pxPerMm(distance, stageHeightPx, fovDeg = FOV_DEG) {
  return stageHeightPx / (2 * distance * Math.tan((fovDeg / 2) * RAD));
}

/** Union AABB of boxes ({ min, max } with x, y, z). */
function unionBox(boxes) {
  const b = { min: v3(Infinity, Infinity, Infinity), max: v3(-Infinity, -Infinity, -Infinity) };
  for (const q of boxes) {
    for (const k of ['x', 'y', 'z']) {
      b.min[k] = Math.min(b.min[k], q.min[k]);
      b.max[k] = Math.max(b.max[k], q.max[k]);
    }
  }
  return b;
}
const boxCorners = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(v3(x, y, z));
  return out;
};
const boxCentre = (b) => v3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
const half = (b, k) => (b.max[k] - b.min[k]) / 2;
const sphereReach = (s) => len(s) + s.r;

/**
 * Everything the poses need, from the frame item's camera data (03-03/03-07) or, without a drawn
 * frame, from the lens spheres alone.
 * @param {{ frameData: null | { boundingSphere: any, frontBoundingSphere: any, boundingBox: any,
 *   sideTarget: any, eyeBox: any }, lensRadius: number, aspect: number, side: 'OD' | 'OS' }} o
 *   lensRadius = radius about the origin of the drawn lenses' spheres (0 = none)
 */
export function cameraContext({ frameData: f, lensRadius, aspect, side }) {
  const ok = f && f.boundingSphere && f.frontBoundingSphere && f.boundingBox && f.sideTarget && f.eyeBox;
  if (!ok) return { aspect, side, full: { r: lensRadius }, front: { r: lensRadius }, box: null, sideTarget: null, eyeBox: null };
  return {
    aspect,
    side,
    full: { r: Math.max(lensRadius, sphereReach(f.boundingSphere)) },
    front: { r: Math.max(lensRadius, sphereReach(f.frontBoundingSphere)) },
    box: unionBox([f.boundingBox, f.eyeBox.OD, f.eyeBox.OS]),
    sideTarget: f.sideTarget,
    eyeBox: f.eyeBox,
  };
}

/**
 * A preset pose: { target, dir (unit, target → camera), distance }.
 * @param {'default' | 'front' | 'side' | 'top' | 'heat'} name
 * @param {ReturnType<typeof cameraContext>} ctx
 * @param {'OD' | 'OS'} [eye] heat eye (03-12)
 */
export function presetPose(name, ctx, eye = 'OD') {
  const sphere = (dir, r) => ({ target: { ...ORIGIN }, dir: { ...dir }, distance: fitDistance(r) });
  /** 03-14 compare: aspect-aware fit of the A ∪ B box about the origin. */
  const aboutOrigin = (dir) => ({
    target: { ...ORIGIN },
    dir: { ...dir },
    distance: fitPointsDistance(boxCorners(ctx.box), dir, ctx.aspect, FOV_DEG, { centred: false }).distance,
  });
  switch (name) {
    case 'default':
    case 'top': {
      const dir = name === 'top' ? TOP_DIR : DEFAULT_DIR;
      if (!ctx.box) return sphere(dir, ctx.full.r);
      if (ctx.compare) return aboutOrigin(dir);
      const f = fitPointsDistance(boxCorners(ctx.box), dir, ctx.aspect);
      return { target: f.target, dir: { ...dir }, distance: f.distance };
    }
    case 'front':
      if (ctx.compare && ctx.box) return aboutOrigin(FRONT_DIR);
      return sphere(FRONT_DIR, ctx.front.r);
    case 'side': {
      const s = ctx.side === 'OS' ? 'OS' : 'OD';
      // OD's temporal side is −x (the wearer's right), OS's is +x.
      const dir = v3(s === 'OD' ? -1 : 1, 0, 0);
      if (!ctx.eyeBox) return sphere(dir, ctx.full.r);
      const b = ctx.eyeBox[s];
      return { target: { ...ctx.sideTarget[s] }, dir, distance: fitBoxDistance(half(b, 'y'), half(b, 'z'), ctx.aspect) };
    }
    case 'heat': {
      if (!ctx.eyeBox) return sphere(FRONT_DIR, ctx.front.r);
      const b = ctx.eyeBox[eye];
      return { target: boxCentre(b), dir: { ...FRONT_DIR }, distance: fitBoxDistance(half(b, 'y'), half(b, 'x'), ctx.aspect, FOV_DEG, HEAT_FIT_MARGIN) };
    }
    default:
      throw new Error(`presetPose: unknown preset ${name}`);
  }
}

/**
 * 03-14 (RES-03): the compared eye, the one with the larger thickest point across A and B
 * (thickest(m).value per configuration and eye, null = not computed). Ties within SIDE_TIE_MM go
 * to the right eye, the rule of the heat eye and Seite (MINOR 13).
 * @param {{ A: { OD: number | null, OS: number | null } | null, B: { OD: number | null, OS: number | null } | null }} th mm
 * @returns {'OD' | 'OS'}
 */
export function compareEye({ A, B }) {
  const max = (eye) => {
    const v = [A?.[eye], B?.[eye]].filter((x) => x != null);
    return v.length ? Math.max(...v) : null;
  };
  return sideEye({ OD: max('OD'), OS: max('OS') });
}

/**
 * 03-14 (RES-03, D-24 as amended): camera context of the A/B comparison. Every input is
 * lens-local (recentred on its own boxing centre), null for a configuration that is not drawn.
 * full.r = front.r = the larger sphere reach about the origin, so both halves share one scale;
 * box = eyeBox[eye] = the union of the A and B lens + rim boxes; sideTarget = B's temporal rim
 * point (A's when B has none). presetPose treats `compare: true` as "target the origin".
 * @param {{ aspect: number, eye: 'OD' | 'OS',
 *   lensSpheres: [ { x: number, y: number, z: number, r: number } | null, { x: number, y: number, z: number, r: number } | null ],
 *   sideTargets: { A: {x:number,y:number,z:number} | null, B: {x:number,y:number,z:number} | null },
 *   eyeBoxes: { A: any, B: any } }} o
 */
export function compareContext({ aspect, eye, lensSpheres, sideTargets, eyeBoxes }) {
  const r = Math.max(0, ...lensSpheres.filter(Boolean).map(sphereReach));
  const boxes = [eyeBoxes.A, eyeBoxes.B].filter(Boolean);
  const box = boxes.length ? unionBox(boxes) : null;
  const st = sideTargets.B ?? sideTargets.A;
  return {
    aspect,
    side: eye,
    compare: true,
    full: { r },
    front: { r },
    box,
    sideTarget: box && st ? { OD: { ...st }, OS: { ...st } } : null,
    eyeBox: box && st ? { OD: box, OS: box } : null,
  };
}

/** All preset poses for a context (the heat pose for both eyes). */
export function presetPoses(ctx) {
  return {
    default: presetPose('default', ctx),
    front: presetPose('front', ctx),
    side: presetPose('side', ctx),
    top: presetPose('top', ctx),
    heatOD: presetPose('heat', ctx, 'OD'),
    heatOS: presetPose('heat', ctx, 'OS'),
  };
}

/**
 * OrbitControls limits derived from the presets (R1-4): minDistance = 0,5 × the smallest preset
 * distance, maxDistance = 2 × the largest, maxTargetRadius = the largest |target| + 20 mm
 * (OrbitControls r187 clamps target − cursor, cursor = origin).
 * @param {{ target: {x:number,y:number,z:number}, distance: number }[]} poses
 */
export function controlLimits(poses) {
  const d = poses.map((p) => p.distance);
  return {
    minDistance: MIN_DIST_FACTOR * Math.min(...d),
    maxDistance: MAX_DIST_FACTOR * Math.max(...d),
    maxTargetRadius: Math.max(...poses.map((p) => len(p.target))) + TARGET_MARGIN_MM,
  };
}

/**
 * Side eye (MINOR 13): the eye with the larger total edge protrusion (bevelSplit front + back at
 * etMax and the current rim depth); within 0,05 mm, or with no values, the right eye.
 * @param {{ OD: number | null, OS: number | null }} p mm, null = eye not drawn
 * @returns {'OD' | 'OS'}
 */
export function sideEye({ OD, OS }) {
  if (OS == null) return 'OD';
  if (OD == null) return 'OS';
  return OS > OD + SIDE_TIE_MM ? 'OS' : 'OD';
}

/**
 * Keyboard step on the focused stage (D-20 as amended): ←/→ azimuth ±15°, ↑/↓ elevation ±10°
 * (polar ∓10°, clamped), Shift + arrows pan 5 mm along the camera right/up, + / = zoom in and
 * − zoom out by 1,25 (clamped), Pos1 'reset'; anything else null.
 * @param {string} key KeyboardEvent.key
 * @param {{ azimuth: number, polar: number, distance: number, minDistance: number, maxDistance: number }} st radians, mm
 * @param {{ shift?: boolean }} [mods]
 * @returns {null | 'reset' | { azimuth: number, polar: number, distance: number, pan: { x: number, y: number } }}
 */
export function keyStep(key, st, { shift = false } = {}) {
  const out = (o) => ({ azimuth: st.azimuth, polar: st.polar, distance: st.distance, pan: { x: 0, y: 0 }, ...o });
  const clampPolar = (p) => Math.min(POLAR_MAX, Math.max(POLAR_MIN, p));
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (key in arrows) {
    const [h, v] = arrows[key];
    if (shift) return out({ pan: { x: h * KEY_PAN_MM, y: v * KEY_PAN_MM } });
    return out({ azimuth: st.azimuth + h * KEY_AZ_DEG * RAD, polar: clampPolar(st.polar - v * KEY_EL_DEG * RAD) });
  }
  if (key === '+' || key === '=') return out({ distance: Math.max(st.minDistance, st.distance / KEY_ZOOM) });
  if (key === '-') return out({ distance: Math.min(st.maxDistance, st.distance * KEY_ZOOM) });
  if (key === 'Home') return 'reset';
  return null;
}

/**
 * Near-temple fade (03-11, UI-SPEC "Seite near-temple fade"): the temple and hinge on the camera
 * side render faded when the camera direction is within TEMPLE_FADE_DEG of a pure side view. The
 * angle is the full 3D angle to the ±x axis, so a steep view from above or below does not fade.
 * OD's temple is on −x (the wearer's right), OS's on +x (conventions as presetPose 'side').
 * @param {{ x: number, y: number, z: number }} dir target → camera (any length)
 * @returns {'OD' | 'OS' | null}
 */
export function nearTempleFade(dir) {
  const l = len(dir);
  if (!(l > 0)) return null;
  const c = Math.cos(TEMPLE_FADE_DEG * RAD);
  if (-dir.x / l >= c) return 'OD';
  if (dir.x / l >= c) return 'OS';
  return null;
}

/** Ease-in-out cubic on [0, 1]. */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** The chart is hidden when the camera direction is more than 70° from its normal (+z). */
export function chartHidden(dir) {
  return dir.z / len(dir) < Math.cos(CHART_FADE_DEG * RAD);
}

/**
 * A2: the chart plane rectangle (z = −200 mm) that covers the whole view for each pose over the
 * allowed zoom range [minDistance, maxDistance] along the pose direction. A corner ray's hit point
 * is affine in the distance, so the hits at the two ends bound every distance in between. Padded
 * by CHART_PAD_MM and snapped outward to CHART_SNAP_MM (one checker period).
 * @param {{ target: any, dir: any }[]} poses
 * @param {{ minDistance: number, maxDistance: number }} limits
 * @param {number} aspect
 * @returns {{ x0: number, x1: number, y0: number, y1: number }}
 */
export function chartRect(poses, { minDistance, maxDistance }, aspect, fovDeg = FOV_DEG) {
  const t = Math.tan((fovDeg / 2) * RAD);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of poses) {
    const { right, up } = basisOf(p.dir);
    for (const d of [minDistance, maxDistance]) {
      const eye = add(p.target, scale(p.dir, d));
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const w = add(add(scale(p.dir, -1), scale(right, sx * t * aspect)), scale(up, sy * t));
          if (!(w.z < 0)) throw new Error('chartRect: a view corner does not reach the chart plane');
          const k = (CHART_Z_MM - eye.z) / w.z;
          const x = eye.x + k * w.x;
          const y = eye.y + k * w.y;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
  }
  const lo = (v) => Math.floor((v - CHART_PAD_MM) / CHART_SNAP_MM) * CHART_SNAP_MM;
  const hi = (v) => Math.ceil((v + CHART_PAD_MM) / CHART_SNAP_MM) * CHART_SNAP_MM;
  return { x0: lo(x0), x1: hi(x1), y0: lo(y0), y1: hi(y1) };
}

/**
 * Runtime step-down monitor: interaction frame times (ms); shouldStepDown when the median of the
 * last 30 exceeds 20 ms. Fewer than 30 samples: false.
 */
export function createFrameMonitor(frames = STEP_DOWN_FRAMES, limitMs = STEP_DOWN_MS) {
  let buf = [];
  return {
    push(ms) {
      buf.push(ms);
      if (buf.length > frames) buf.shift();
    },
    shouldStepDown() {
      if (buf.length < frames) return false;
      const s = [...buf].sort((a, b) => a - b);
      const m = frames % 2 ? s[(frames - 1) / 2] : (s[frames / 2 - 1] + s[frames / 2]) / 2;
      return m > limitMs;
    },
    reset() {
      buf = [];
    },
  };
}
