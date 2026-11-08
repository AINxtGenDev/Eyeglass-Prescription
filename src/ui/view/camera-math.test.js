// VIZ-03 camera math (03-09). Pure: plain {x, y, z} objects, so every camera number the controls
// use is tested in Node. The frame data comes from the engine builder (buildFrameMesh, 03-03), not
// from hand-typed boxes.
import { describe, test, expect } from 'vitest';
import { evaluateLens } from '../../engine/evaluate.js';
import { allocFrameBuffers, buildFrameMesh, boxingCentreX, CHART_DISTANCE_MM, FRAME_FACE_MM } from '../../engine/mesh/frame.js';
import {
  fitDistance,
  fitBoxDistance,
  fitPointsDistance,
  pxPerMm,
  cameraContext,
  presetPose,
  presetPoses,
  controlLimits,
  sideEye,
  keyStep,
  easeInOutCubic,
  chartHidden,
  chartRect,
  createFrameMonitor,
  basisOf,
  FIT_MARGIN,
  FOV_DEG,
  POLAR_MIN,
  POLAR_MAX,
  CAMERA_FAR_MM,
  CHART_SNAP_MM,
} from './camera-math.js';

const RAD = Math.PI / 180;
const lens = (eye, frame, sph = -2.75) => ({
  eye,
  sph,
  cyl: -0.5,
  axisDeg: 0,
  materialId: 'cr39',
  frame,
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
});
const EXAMPLE = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };

/** Camera data of a built frame (what the frame item carries), plus the lens sphere radius. */
function frameData(frame, { temple = 140, sph = -2.75 } = {}) {
  const eyes = {};
  for (const eye of ['OD', 'OS']) {
    const r = evaluateLens(lens(eye, frame, sph));
    eyes[eye] = r.ok ? r.surfaces : null;
  }
  const res = buildFrameMesh({ frame, eyes, rimDepthMm: 3, templeMm: temple }, allocFrameBuffers());
  return res;
}
const ctxOf = (frame, aspect, opt = {}) => cameraContext({ frameData: frameData(frame, opt), lensRadius: 0, aspect, side: opt.side ?? 'OD' });
/** The sphere fit of the frame + temples about the origin before A1 (scene.js 03-05 … 03-08). */
const oldDefaultDistance = (res) => {
  const b = res.boundingSphere;
  return fitDistance(Math.hypot(b.x, b.y, b.z) + b.r);
};
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const corners = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push({ x, y, z });
  return out;
};
/** Pinhole projection of p for a pose: normalised screen coordinates (−1…1 inside). */
function ndc(pose, aspect, p) {
  const { right, up } = basisOf(pose.dir);
  const q = sub(p, pose.target);
  const depth = pose.distance - dot(q, pose.dir);
  const t = Math.tan((FOV_DEG / 2) * RAD);
  return { x: dot(q, right) / depth / (t * aspect), y: dot(q, up) / depth / t };
}
const closeVec = (a, b, eps = 1e-12) => {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(eps);
  expect(Math.abs(a.z - b.z)).toBeLessThanOrEqual(eps);
};

describe('VIZ-03 camera math (03-09)', () => {
  test('fitDistance and fitBoxDistance', () => {
    expect(fitDistance(100)).toBeCloseTo((1.08 * 100) / Math.sin(10 * RAD), 9);
    expect(fitDistance(100, 30)).toBeCloseTo((1.08 * 100) / Math.sin(15 * RAD), 9);
    // vertical bound
    expect(fitBoxDistance(23, 6, 4 / 3)).toBeCloseTo((1.08 * 23) / Math.tan(10 * RAD), 9);
    // horizontal bound: halfH / aspect > halfV
    expect(fitBoxDistance(10, 40, 4 / 3)).toBeCloseTo((1.08 * 30) / Math.tan(10 * RAD), 9);
    expect(FIT_MARGIN).toBe(1.08);
  });

  test('fitPointsDistance reduces to fitBoxDistance for points in the target plane', () => {
    const dir = { x: 0, y: 0, z: 1 };
    const pts = [
      { x: -40, y: -10, z: 0 },
      { x: 40, y: 10, z: 0 },
    ];
    const f = fitPointsDistance(pts, dir, 4 / 3);
    closeVec(f.target, { x: 0, y: 0, z: 0 });
    expect(f.distance).toBeCloseTo(fitBoxDistance(10, 40, 4 / 3), 9);
    // an off-centre silhouette is centred: the target moves to its middle
    const g = fitPointsDistance(pts.map((p) => ({ ...p, x: p.x + 30 })), dir, 4 / 3);
    closeVec(g.target, { x: 30, y: 0, z: 0 }, 1e-9);
    expect(g.distance).toBeCloseTo(f.distance, 9);
  });

  test('A1: default pose fits the projected frame + temples; closer than the old sphere fit, all corners inside', () => {
    const res = frameData(EXAMPLE);
    for (const aspect of [4 / 3, 16 / 10, 288 / 216, 3.6]) {
      const ctx = cameraContext({ frameData: res, lensRadius: 0, aspect, side: 'OD' });
      const p = presetPose('default', ctx);
      const dir = {
        x: -Math.sin(35 * RAD) * Math.cos(15 * RAD),
        y: Math.sin(15 * RAD),
        z: Math.cos(35 * RAD) * Math.cos(15 * RAD),
      };
      closeVec(p.dir, dir);
      expect(p.distance).toBeLessThan(oldDefaultDistance(res));
      // every corner of the frame AABB (and both eye boxes) projects inside the frame, with the margin
      for (const c of [...corners(res.boundingBox), ...corners(res.eyeBox.OD), ...corners(res.eyeBox.OS)]) {
        const n = ndc(p, aspect, c);
        expect(Math.abs(n.x)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-9);
        expect(Math.abs(n.y)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-9);
      }
    }
    // the 412 × 915 stage (382 × 287): the R–L centre distance at the target is ≥ 1,8 × the old one
    const aspect = 382 / 287;
    const ctx = cameraContext({ frameData: res, lensRadius: 0, aspect, side: 'OD' });
    const p = presetPose('default', ctx);
    const px = (pose, pt) => {
      const n = ndc(pose, aspect, pt);
      return [((n.x + 1) / 2) * 382, ((1 - n.y) / 2) * 287];
    };
    const lz = res.lensZ;
    const od = { x: boxingCentreX('OD', 52, 18), y: 0, z: lz.OD };
    const os = { x: boxingCentreX('OS', 52, 18), y: 0, z: lz.OS };
    const rl = (pose) => Math.hypot(px(pose, od)[0] - px(pose, os)[0], px(pose, od)[1] - px(pose, os)[1]);
    const old = { target: { x: 0, y: 0, z: 0 }, dir: p.dir, distance: oldDefaultDistance(res) };
    expect(rl(old)).toBeGreaterThan(42);
    expect(rl(old)).toBeLessThan(44);
    expect(rl(p)).toBeGreaterThanOrEqual(1.8 * 42.6);
  });

  test('front, top, side and heat poses', () => {
    const res = frameData(EXAMPLE);
    const ctx = cameraContext({ frameData: res, lensRadius: 0, aspect: 4 / 3, side: 'OD' });
    const f = presetPose('front', ctx);
    closeVec(f.dir, { x: 0, y: 0, z: 1 });
    closeVec(f.target, { x: 0, y: 0, z: 0 });
    const fb = res.frontBoundingSphere;
    expect(f.distance).toBeCloseTo(fitDistance(Math.hypot(fb.x, fb.y, fb.z) + fb.r), 9);
    const top = presetPose('top', ctx);
    closeVec(top.dir, { x: 0, y: Math.sin(85 * RAD), z: Math.cos(85 * RAD) });
    expect(top.distance).toBeLessThan(oldDefaultDistance(res));
    const s = presetPose('side', ctx);
    closeVec(s.target, res.sideTarget.OD);
    closeVec(s.dir, { x: -1, y: 0, z: 0 });
    const e = res.eyeBox.OD;
    expect(s.distance).toBeCloseTo(fitBoxDistance((e.max.y - e.min.y) / 2, (e.max.z - e.min.z) / 2, 4 / 3), 9);
    const sOS = presetPose('side', { ...ctx, side: 'OS' });
    closeVec(sOS.target, res.sideTarget.OS);
    closeVec(sOS.dir, { x: 1, y: 0, z: 0 });
    const h = presetPose('heat', ctx, 'OS');
    const eo = res.eyeBox.OS;
    closeVec(h.target, { x: (eo.min.x + eo.max.x) / 2, y: (eo.min.y + eo.max.y) / 2, z: (eo.min.z + eo.max.z) / 2 });
    closeVec(h.dir, { x: 0, y: 0, z: 1 });
    expect(h.distance).toBeCloseTo(fitBoxDistance((eo.max.y - eo.min.y) / 2, (eo.max.x - eo.min.x) / 2, 4 / 3), 9);
  });

  test('without frame data the poses fall back to the lens sphere about the origin', () => {
    const ctx = cameraContext({ frameData: null, lensRadius: 60, aspect: 4 / 3, side: 'OD' });
    for (const name of ['default', 'front', 'top', 'side']) {
      const p = presetPose(name, ctx);
      closeVec(p.target, { x: 0, y: 0, z: 0 });
      expect(p.distance).toBeCloseTo(fitDistance(60), 9);
    }
  });

  test('MAJOR 2: Seite gives ≥ 3 px/mm on a 288 × 216 stage (example and B = 55)', () => {
    const res = frameData(EXAMPLE);
    // y half-extent = B/2 + FRAME_FACE_MM, z half-extent ≤ 6 mm
    const e = res.eyeBox.OD;
    expect((e.max.y - e.min.y) / 2).toBeCloseTo(19 + FRAME_FACE_MM, 6);
    expect((e.max.z - e.min.z) / 2).toBeLessThanOrEqual(6);
    const s = presetPose('side', ctxOf(EXAMPLE, 4 / 3));
    expect(pxPerMm(s.distance, 216)).toBeGreaterThanOrEqual(3);
    expect(pxPerMm(s.distance, 216)).toBeCloseTo(4.3, 1);
    const tall = presetPose('side', ctxOf({ shape: 'rechteckig', A: 56, B: 55, DBL: 18 }, 4 / 3));
    expect(pxPerMm(tall.distance, 216)).toBeGreaterThanOrEqual(3);
  });

  test('controlLimits derived from the presets (62□24: target radius ≥ 98, close-up below Seite)', () => {
    const ctx = ctxOf({ shape: 'rechteckig', A: 62, B: 38, DBL: 24 }, 4 / 3);
    expect(Math.abs(ctx.sideTarget.OD.x)).toBe(78);
    const poses = presetPoses(ctx);
    const L = controlLimits(Object.values(poses));
    const d = Object.values(poses).map((p) => p.distance);
    expect(L.minDistance).toBeCloseTo(0.5 * Math.min(...d), 9);
    expect(L.maxDistance).toBeCloseTo(2 * Math.max(...d), 9);
    expect(L.maxTargetRadius).toBeGreaterThanOrEqual(98);
    expect(L.minDistance).toBeLessThan(poses.side.distance);
    for (const p of Object.values(poses)) {
      expect(Math.hypot(p.target.x, p.target.y, p.target.z)).toBeLessThanOrEqual(L.maxTargetRadius);
      expect(p.distance).toBeGreaterThanOrEqual(L.minDistance);
      expect(p.distance).toBeLessThanOrEqual(L.maxDistance);
    }
  });

  test('sideEye: larger total protrusion; ties within 0,05 mm → OD (MINOR 13)', () => {
    expect(sideEye({ OD: 1.6, OS: 1.9 })).toBe('OS');
    expect(sideEye({ OD: 1.6, OS: 1.63 })).toBe('OD');
    expect(sideEye({ OD: 1.9, OS: 1.6 })).toBe('OD');
    expect(sideEye({ OD: null, OS: 0.2 })).toBe('OS');
    expect(sideEye({ OD: 0.2, OS: null })).toBe('OD');
    expect(sideEye({ OD: null, OS: null })).toBe('OD');
  });

  test('keyStep: rotate, clamp, pan, zoom, reset', () => {
    const st = { azimuth: 0, polar: Math.PI / 2, distance: 400, minDistance: 100, maxDistance: 800 };
    expect(keyStep('ArrowRight', st).azimuth).toBeCloseTo(15 * RAD, 12);
    expect(keyStep('ArrowLeft', st).azimuth).toBeCloseTo(-15 * RAD, 12);
    // elevation + 10° = polar − 10°
    expect(keyStep('ArrowUp', st).polar).toBeCloseTo(Math.PI / 2 - 10 * RAD, 12);
    expect(keyStep('ArrowDown', st).polar).toBeCloseTo(Math.PI / 2 + 10 * RAD, 12);
    expect(keyStep('ArrowUp', { ...st, polar: 0.1 }).polar).toBe(POLAR_MIN);
    expect(keyStep('ArrowDown', { ...st, polar: Math.PI - 0.1 }).polar).toBe(POLAR_MAX);
    const pan = keyStep('ArrowLeft', st, { shift: true });
    expect(pan.pan).toEqual({ x: -5, y: 0 });
    expect(pan.azimuth).toBe(0);
    expect(keyStep('ArrowUp', st, { shift: true }).pan).toEqual({ x: 0, y: 5 });
    expect(keyStep('+', st).distance).toBeCloseTo(320, 9);
    expect(keyStep('=', st).distance).toBeCloseTo(320, 9);
    expect(keyStep('-', st).distance).toBeCloseTo(500, 9);
    expect(keyStep('+', { ...st, distance: 110 }).distance).toBe(100);
    expect(keyStep('-', { ...st, distance: 700 }).distance).toBe(800);
    expect(keyStep('Home', st)).toBe('reset');
    expect(keyStep('a', st)).toBeNull();
    expect(keyStep('Tab', st)).toBeNull();
  });

  test('easeInOutCubic', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  test('chartHidden beyond 70° from the chart normal', () => {
    const ctx = ctxOf(EXAMPLE, 4 / 3);
    expect(chartHidden(presetPose('default', ctx).dir)).toBe(false);
    expect(chartHidden(presetPose('front', ctx).dir)).toBe(false);
    expect(chartHidden(presetPose('heat', ctx, 'OD').dir)).toBe(false);
    expect(chartHidden(presetPose('side', ctx).dir)).toBe(true);
    expect(chartHidden(presetPose('top', ctx).dir)).toBe(true);
    expect(chartHidden({ x: Math.sin(69 * RAD), y: 0, z: Math.cos(69 * RAD) })).toBe(false);
    expect(chartHidden({ x: Math.sin(71 * RAD), y: 0, z: Math.cos(71 * RAD) })).toBe(true);
  });

  test('A2: chartRect covers the whole view in default, Vorne and heat over the zoom range', () => {
    for (const frame of [EXAMPLE, { shape: 'rechteckig', A: 62, B: 38, DBL: 24 }]) {
      for (const aspect of [16 / 10, 4 / 3, 3.6]) {
        const ctx = ctxOf(frame, aspect);
        const poses = presetPoses(ctx);
        const L = controlLimits(Object.values(poses));
        const r = chartRect([poses.default, poses.front, poses.heatOD, poses.heatOS], L, aspect);
        for (const v of [r.x0, r.x1, r.y0, r.y1]) expect(Math.abs(v % CHART_SNAP_MM)).toBe(0);
        const z = -CHART_DISTANCE_MM;
        const t = Math.tan((FOV_DEG / 2) * RAD);
        for (const pose of [poses.default, poses.front, poses.heatOD, poses.heatOS]) {
          for (const d of [L.minDistance, pose.distance, (L.minDistance + L.maxDistance) / 2, L.maxDistance]) {
            const { right, up } = basisOf(pose.dir);
            const eye = { x: pose.target.x + pose.dir.x * d, y: pose.target.y + pose.dir.y * d, z: pose.target.z + pose.dir.z * d };
            for (const sx of [-1, 1]) {
              for (const sy of [-1, 1]) {
                const w = {
                  x: -pose.dir.x + right.x * sx * t * aspect + up.x * sy * t,
                  y: -pose.dir.y + right.y * sx * t * aspect + up.y * sy * t,
                  z: -pose.dir.z + right.z * sx * t * aspect + up.z * sy * t,
                };
                expect(w.z).toBeLessThan(0);
                const k = (z - eye.z) / w.z;
                const hit = { x: eye.x + k * w.x, y: eye.y + k * w.y };
                expect(hit.x).toBeGreaterThan(r.x0);
                expect(hit.x).toBeLessThan(r.x1);
                expect(hit.y).toBeGreaterThan(r.y0);
                expect(hit.y).toBeLessThan(r.y1);
                // the chart corner seen is nearer than the far plane
                expect(k * Math.hypot(w.x, w.y, w.z)).toBeLessThan(CAMERA_FAR_MM);
              }
            }
          }
        }
      }
    }
  });

  test('frame monitor: median of the last 30 frames above 20 ms', () => {
    const m = createFrameMonitor();
    for (let i = 0; i < 29; i++) m.push(40);
    expect(m.shouldStepDown()).toBe(false);
    m.push(40);
    expect(m.shouldStepDown()).toBe(true);
    m.reset();
    expect(m.shouldStepDown()).toBe(false);
    for (let i = 0; i < 30; i++) m.push(i < 14 ? 5 : 21);
    expect(m.shouldStepDown()).toBe(true);
    m.reset();
    for (let i = 0; i < 30; i++) m.push(i < 16 ? 5 : 19);
    expect(m.shouldStepDown()).toBe(false);
    m.reset();
    for (let i = 0; i < 30; i++) m.push(19);
    expect(m.shouldStepDown()).toBe(false);
    // only the last 30 count
    for (let i = 0; i < 30; i++) m.push(21);
    expect(m.shouldStepDown()).toBe(true);
  });
});
