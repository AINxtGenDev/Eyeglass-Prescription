// VIZ-02 (03-03, D-06): the frame is built from the same inputs as the numbers. Exact checks run
// on Float64 buffers (buildFrameMesh writes any typed array of the right length), so they test
// the formulas, not the Float32 storage; one Float32 run per lens bounds the storage error.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateLens } from '../evaluate.js';
import { thicknessAt, extremeIndices } from '../metrics.js';
import { frontSagAt, backSagAt } from '../design.js';
import { frameOutline } from '../frame/outline.js';
import { MATERIALS } from '../materials.js';
import { bevelSplit, bevelApexMm, frontLeadMm } from '../rim.js';
import { outlineNormals } from './lens.js';
import { SPOKES } from './topology.js';
import {
  FRAME_FACE_MM,
  RIM_LIP_MM,
  TEMPLE_DEFAULT_MM,
  TEMPLE_RANGE_MM,
  CHART_DISTANCE_MM,
  EARPIECE_MM,
  EARPIECE_BEND_DEG,
  TEMPLE_SPLAY_DEG,
  BRIDGE_RINGS,
  TEMPLE_RINGS,
  TEMPLE_STRAIGHT_SEGS,
  boxingCentreX,
  templeDrawnMm,
  FRAME_LENGTHS,
  allocFrameBuffers,
  buildFrameMesh,
  RIM_INDEX,
  BRIDGE_INDEX,
  TEMPLE_INDEX,
  HINGE_INDEX,
} from './frame.js';

// lens(o) copied from lens.test.js
const lens = (o = {}) => ({
  eye: 'OD',
  sph: -2.75,
  cyl: -0.5,
  axisDeg: 0,
  materialId: 'cr39',
  frame: { shape: 'rechteckig', A: 52, B: 38, DBL: 18 },
  monoPD: 32,
  fittingHeight: null,
  baseCurve: null,
  minCT: null,
  minET: null,
  ...o,
});
const SHAPES4 = ['rund', 'rechteckig', 'panto', 'pilot'];
const EYES = ['OD', 'OS'];

// signedArea and rayCrossings copied from outline.test.js
function signedArea(o) {
  const n = o.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += o[2 * i] * o[2 * j + 1] - o[2 * j] * o[2 * i + 1];
  }
  return a / 2;
}

/** Number of polygon edges a half-line from the origin at angle th crosses (half-open rule). */
function rayCrossings(o, th) {
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const n = o.length / 2;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const px = o[2 * i];
    const py = o[2 * i + 1];
    const qx = o[2 * j];
    const qy = o[2 * j + 1];
    const cp = dx * py - dy * px;
    const cq = dx * qy - dy * qx;
    if (cp > 0 === cq > 0) continue;
    const ex = qx - px;
    const ey = qy - py;
    const t = (px * ey - py * ex) / (dx * ey - dy * ex);
    if (t > 0) count++;
  }
  return count;
}

const alloc64 = () => {
  const out = {};
  for (const [k, len] of Object.entries(FRAME_LENGTHS)) out[k] = new Float64Array(len);
  return out;
};

/** Evaluate both eyes with the same frame; spec overrides per eye. */
function pairOf(frame, od = {}, os = {}) {
  const rOD = evaluateLens(lens({ ...od, eye: 'OD', frame }));
  const rOS = evaluateLens(lens({ ...os, eye: 'OS', frame }));
  return {
    frame,
    r: { OD: rOD, OS: rOS },
    eyes: { OD: rOD.ok ? rOD.surfaces : null, OS: rOS.ok ? rOS.surfaces : null },
  };
}

function build(p, { D = 3, temple = TEMPLE_DEFAULT_MM, f32 = false } = {}) {
  const out = f32 ? allocFrameBuffers() : alloc64();
  const res = buildFrameMesh({ frame: p.frame, eyes: p.eyes, rimDepthMm: D, templeMm: temple }, out);
  return { out, res };
}

const v3 = (a, k) => [a[3 * k], a[3 * k + 1], a[3 * k + 2]];
/** Centre of tube ring k (mean of its 8 vertices). */
function ringCentre(a, k) {
  const c = [0, 0, 0];
  for (let q = 0; q < 8; q++) for (let d = 0; d < 3; d++) c[d] += a[3 * (8 * k + q) + d] / 8;
  return c;
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const RIM_INNER_FRONT = 7;
const RIM_INNER_BACK = 6;
const rimZ = (rim, i, k) => rim[3 * (8 * i + k) + 2];

const FRAME_EX = { shape: 'rechteckig', A: 52, B: 38, DBL: 18 };
const FRAME_M10 = { shape: 'rechteckig', A: 62, B: 55, DBL: 14 };
// Example Rx (03-01 SUMMARY): OD −2,75 −0,50 × 180, OS −2,50 −0,75 × 170, PD 32/31,5.
const EXAMPLE = () => pairOf(FRAME_EX, { axisDeg: 180 }, { sph: -2.5, cyl: -0.75, axisDeg: 170, monoPD: 31.5 });
// −10 CR-39 rechteckig 62×55/14 PD 25 (lens-critic MINOR 3: DBL 14, the larger DBL are not computable).
const MINUS10 = () => pairOf(FRAME_M10, { sph: -10, cyl: 0, monoPD: 25 }, { sph: -10, cyl: 0, monoPD: 25 });

describe('VIZ-02 frame mesh (D-06)', () => {
  it('boxingCentreX: OD at −(A + DBL)/2, OS at +(A + DBL)/2', () => {
    expect(boxingCentreX('OD', 52, 18)).toBe(-35);
    expect(boxingCentreX('OS', 52, 18)).toBe(35);
    for (const shape of SHAPES4) {
      const od = frameOutline(shape, 52, 38, 'OD');
      const os = frameOutline(shape, 52, 38, 'OS');
      const iOD = extremeIndices(od, 'OD').nasal;
      const iOS = extremeIndices(os, 'OS').nasal;
      expect(boxingCentreX('OD', 52, 18) + od[2 * iOD]).toBeCloseTo(-9, 9);
      expect(boxingCentreX('OS', 52, 18) + os[2 * iOS]).toBeCloseTo(9, 9);
    }
  });

  it('bridge spans exactly DBL: centreline endpoints at x = ∓DBL/2 for every shape, DBL 14…24', () => {
    let n = 0;
    for (const shape of SHAPES4) {
      for (let DBL = 14; DBL <= 24; DBL++) {
        const { out, res } = build({ frame: { shape, A: 52, B: 38, DBL }, eyes: { OD: null, OS: null } });
        expect(res.finite).toBe(true);
        expect(Math.abs(ringCentre(out.bridge, 0)[0] + DBL / 2)).toBeLessThan(1e-9);
        expect(Math.abs(ringCentre(out.bridge, BRIDGE_RINGS - 1)[0] - DBL / 2)).toBeLessThan(1e-9);
        n++;
      }
    }
    expect(n).toBe(44);
    // and with real lenses (the rim z differs, the span does not)
    const { out } = build(EXAMPLE());
    expect(Math.abs(ringCentre(out.bridge, 0)[0] + 9)).toBeLessThan(1e-9);
    expect(Math.abs(ringCentre(out.bridge, BRIDGE_RINGS - 1)[0] - 9)).toBeLessThan(1e-9);
  });

  it('MINOR 9 common rim plane: anisometropic OD −2 / OS −8, mean rim apex z = 0 per eye', () => {
    const p = pairOf(FRAME_EX, { sph: -2, cyl: 0 }, { sph: -8, cyl: 0 });
    expect(p.r.OD.ok && p.r.OS.ok).toBe(true);
    const D = 3;
    const { out, res } = build(p, { D });
    expect(res.lensZ.OD).not.toBeCloseTo(res.lensZ.OS, 3);
    const apexZ = {};
    for (const eye of EYES) {
      const s = p.eyes[eye];
      const o = frameOutline(FRAME_EX.shape, FRAME_EX.A, FRAME_EX.B, eye);
      const rim = out[`rim${eye}`];
      let sumBuf = 0;
      let sumLocal = 0;
      apexZ[eye] = new Float64Array(SPOKES);
      for (let i = 0; i < SPOKES; i++) {
        const zFace = rim[3 * (8 * i) + 2]; // front face, inner vertex
        apexZ[eye][i] = zFace - D / 2;
        sumBuf += apexZ[eye][i];
        const x = o[2 * i];
        const y = o[2 * i + 1];
        sumLocal += -frontSagAt(s, x, y) - bevelApexMm(thicknessAt(s, x, y));
      }
      expect(Math.abs(sumBuf / SPOKES)).toBeLessThan(1e-9);
      expect(Math.abs(res.lensZ[eye] + sumLocal / SPOKES)).toBeLessThan(1e-9);
    }
    // the bridge endpoint z equal the rim apex z at the two nasal extremes
    const iOD = extremeIndices(frameOutline('rechteckig', 52, 38, 'OD'), 'OD').nasal;
    const iOS = extremeIndices(frameOutline('rechteckig', 52, 38, 'OS'), 'OS').nasal;
    expect(Math.abs(ringCentre(out.bridge, 0)[2] - apexZ.OD[iOD])).toBeLessThan(1e-9);
    expect(Math.abs(ringCentre(out.bridge, BRIDGE_RINGS - 1)[2] - apexZ.OS[iOS])).toBeLessThan(1e-9);
  });

  describe('D-05 consistency: lens protrusion beyond the rim = bevelSplit at every outline vertex', () => {
    for (const [name, mk] of [
      ['example', EXAMPLE],
      ['−10 CR-39 rechteckig 62×55/14 PD 25', MINUS10],
    ]) {
      for (const D of [3, 10]) {
        it(`${name}, rim depth ${D}`, () => {
          const p = mk();
          expect(p.r.OD.ok && p.r.OS.ok).toBe(true);
          const exact = build(p, { D });
          const f32 = build(p, { D, f32: true });
          let worst32 = 0;
          for (const eye of EYES) {
            const s = p.eyes[eye];
            const o = frameOutline(p.frame.shape, p.frame.A, p.frame.B, eye);
            const lz = exact.res.lensZ[eye];
            expect(f32.res.lensZ[eye]).toBe(lz);
            for (let i = 0; i < SPOKES; i++) {
              const x = o[2 * i];
              const y = o[2 * i + 1];
              const zFront = -frontSagAt(s, x, y) + lz;
              const zBack = -s.ct - backSagAt(s, x, y) + lz;
              const want = bevelSplit(thicknessAt(s, x, y), D);
              for (const [rim, tol] of [
                [exact.out[`rim${eye}`], 1e-6],
                [f32.out[`rim${eye}`], Infinity],
              ]) {
                const front = Math.max(0, zFront - rimZ(rim, i, RIM_INNER_FRONT));
                const back = Math.max(0, rimZ(rim, i, RIM_INNER_BACK) - zBack);
                const err = Math.max(Math.abs(front - want.front), Math.abs(back - want.back));
                if (tol === Infinity) worst32 = Math.max(worst32, err);
                else if (err >= tol) expect({ eye, i, err }).toEqual({ eye, i, err: 0 });
              }
            }
          }
          // Float32 storage: |z| < 16 mm, half an ulp ≤ 9,6e-7 mm
          expect(worst32).toBeLessThan(2e-6);
        });
      }
    }
  });

  describe('lens-critic MAJOR 1: front lead on the geometry = frontLeadMm', () => {
    for (const [name, mk] of [
      ['example', EXAMPLE],
      ['−10 CR-39 rechteckig 62×55/14 PD 25', MINUS10],
    ]) {
      for (const D of [3, 10]) {
        it(`${name}, rim depth ${D}`, () => {
          const p = mk();
          const { out, res } = build(p, { D });
          for (const eye of EYES) {
            const o = frameOutline(p.frame.shape, p.frame.A, p.frame.B, eye);
            const rim = out[`rim${eye}`];
            let best = -Infinity;
            let idx = -1;
            const lead = (i) => res.lensZ[eye] - rimZ(rim, i, RIM_INNER_FRONT);
            for (let i = 0; i < SPOKES; i++) {
              if (lead(i) > best) (best = lead(i)), (idx = i);
            }
            const want = frontLeadMm(p.eyes[eye], o, D);
            expect(Math.abs(best - want.value)).toBeLessThan(1e-6);
            if (idx !== want.index) expect(Math.abs(lead(idx) - lead(want.index))).toBeLessThan(1e-9);
          }
        });
      }
    }
  });

  it('lens-critic MAJOR 2: eyeBox contains the eye’s rim and lens; y half-extent = B/2 + face', () => {
    const p = EXAMPLE();
    const { out, res } = build(p, { f32: true });
    for (const eye of EYES) {
      const box = res.eyeBox[eye];
      const bx = boxingCentreX(eye, 52, 18);
      const inside = (x, y, z) =>
        x >= box.min.x - 1e-9 &&
        x <= box.max.x + 1e-9 &&
        y >= box.min.y - 1e-9 &&
        y <= box.max.y + 1e-9 &&
        z >= box.min.z - 1e-9 &&
        z <= box.max.z + 1e-9;
      const rim = out[`rim${eye}`];
      for (let k = 0; k < rim.length / 3; k++) {
        const [x, y, z] = v3(rim, k);
        if (!inside(x + bx, y, z)) expect({ eye, k }).toBe('inside');
      }
      const s = p.eyes[eye];
      const lz = res.lensZ[eye];
      const o = frameOutline('rechteckig', 52, 38, eye);
      const pts = [];
      for (let i = 0; i < SPOKES; i++) pts.push([o[2 * i], o[2 * i + 1]]);
      pts.push([s.oc.x, s.oc.y]);
      for (const [x, y] of pts) {
        expect(inside(x + bx, y, -frontSagAt(s, x, y) + lz)).toBe(true);
        expect(inside(x + bx, y, -s.ct - backSagAt(s, x, y) + lz)).toBe(true);
      }
      expect(Math.abs((box.max.y - box.min.y) / 2 - (38 / 2 + FRAME_FACE_MM))).toBeLessThan(0.01);
      // the box is on its own eye's side
      expect(Math.sign((box.min.x + box.max.x) / 2)).toBe(Math.sign(bx));
      // Seite target: the temporal outer rim point
      const iT = extremeIndices(o, eye).temporal;
      const nrm = outlineNormals(o, new Float64Array(o.length));
      const t = res.sideTarget[eye];
      expect(t.x).toBeCloseTo(bx + o[2 * iT] + FRAME_FACE_MM * nrm[2 * iT], 9);
      expect(t.y).toBeCloseTo(o[2 * iT + 1] + FRAME_FACE_MM * nrm[2 * iT + 1], 9);
      expect(inside(t.x, t.y, t.z)).toBe(true);
    }
  });

  it('blocked eye (surfaces null): flat rim centred on z = 0, lensZ 0, all finite', () => {
    const p = pairOf(FRAME_EX, { axisDeg: 180 }, {});
    p.eyes.OS = null;
    const D = 3;
    const { out, res } = build(p, { D, f32: true });
    expect(res.finite).toBe(true);
    expect(res.lensZ.OS).toBe(0);
    expect(res.lensZ.OD).not.toBe(0);
    const rim = out.rimOS;
    for (let k = 0; k < rim.length / 3; k++) {
      expect(Math.abs(rim[3 * k + 2])).toBe(D / 2);
    }
    for (const a of Object.values(out)) for (const v of a) if (!Number.isFinite(v)) expect(v).toBe('finite');
    const box = res.eyeBox.OS;
    expect(box.min.z).toBe(-D / 2);
    expect(box.max.z).toBe(D / 2);
    // both null: still a frame
    const both = build({ frame: FRAME_EX, eyes: { OD: null, OS: null } });
    expect(both.res.finite).toBe(true);
    expect(both.res.lensZ).toEqual({ OD: 0, OS: 0 });
  });

  it('Pitfall 9: outer (+4 mm) and inner (−0,5 mm) offset polygons are simple, CCW and star-shaped', () => {
    let checked = 0;
    let rejected = 0;
    for (const shape of SHAPES4) {
      for (const [A, B] of [
        [40, 28],
        [62, 28],
        [40, 55],
        [62, 55],
      ]) {
        let o;
        try {
          o = frameOutline(shape, A, B, 'OD');
        } catch {
          rejected++;
          continue;
        }
        const nrm = outlineNormals(o, new Float64Array(o.length));
        for (const d of [FRAME_FACE_MM, -RIM_LIP_MM]) {
          const q = new Float64Array(o.length);
          for (let k = 0; k < o.length; k++) q[k] = o[k] + d * nrm[k];
          expect(signedArea(q)).toBeGreaterThan(0);
          for (let k = 0; k < 3600; k++) {
            const c = rayCrossings(q, (2 * Math.PI * (k + 0.5)) / 3600);
            if (c !== 1) expect({ shape, A, B, d, k, c }).toEqual({ shape, A, B, d, k, c: 1 });
          }
        }
        checked++;
      }
    }
    console.info('[03-03] Pitfall 9 checked', checked, 'rejected by frameOutline', rejected);
    expect(checked + rejected).toBe(16);
    expect(checked).toBeGreaterThan(0);
  });

  it('templeMm: centreline length, 30° earpiece bend over the last 35 mm, 5° splay', () => {
    const [tMin, tMax] = TEMPLE_RANGE_MM;
    // The stamp regex accepts 2–3 digits (00…999, parse.js STAMP); the drawn temple is clamped.
    expect(templeDrawnMm(0)).toBe(tMin);
    expect(templeDrawnMm(999)).toBe(tMax);
    expect(templeDrawnMm(145)).toBe(145);
    expect(templeDrawnMm(undefined)).toBe(TEMPLE_DEFAULT_MM);
    for (const [temple, drawn] of [
      [TEMPLE_DEFAULT_MM, TEMPLE_DEFAULT_MM],
      [tMin, tMin],
      [tMax, tMax],
      [0, tMin],
      [999, tMax],
    ]) {
      const { out, res } = build(EXAMPLE(), { temple });
      expect(res.templeMm).toBe(drawn);
      for (const eye of EYES) {
        const a = out[`temple${eye}`];
        const c = [];
        for (let k = 0; k < TEMPLE_RINGS; k++) c.push(ringCentre(a, k));
        let len = 0;
        for (let k = 1; k < TEMPLE_RINGS; k++) len += dist(c[k], c[k - 1]);
        expect(Math.abs(len - drawn)).toBeLessThan(0.01);
        const K = TEMPLE_STRAIGHT_SEGS;
        const d1 = c[K].map((v, i) => v - c[0][i]);
        const d2 = c[TEMPLE_RINGS - 1].map((v, i) => v - c[K][i]);
        expect(Math.hypot(...d2)).toBeCloseTo(EARPIECE_MM, 9);
        const cos = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (Math.hypot(...d1) * Math.hypot(...d2));
        expect(Math.abs((Math.acos(cos) * 180) / Math.PI - EARPIECE_BEND_DEG)).toBeLessThan(0.01);
        expect(d2[1]).toBeLessThan(0); // downward
        // splay: the straight part turns 5° temporally from −z (temporal = −nasalSign in world x)
        const tSign = eye === 'OD' ? -1 : 1;
        expect(d1[1]).toBeCloseTo(0, 12);
        expect(d1[2]).toBeLessThan(0);
        const splay = (Math.atan2(tSign * d1[0], -d1[2]) * 180) / Math.PI;
        expect(Math.abs(splay - TEMPLE_SPLAY_DEG)).toBeLessThan(0.01);
      }
    }
  });

  it('the longest drawn temple stays in front of the chart plane', () => {
    const { out } = build(EXAMPLE(), { temple: 999 });
    for (const eye of EYES) {
      const a = out[`temple${eye}`];
      for (let k = 0; k < a.length / 3; k++) expect(a[3 * k + 2]).toBeGreaterThan(-CHART_DISTANCE_MM + 10);
    }
    expect(CHART_DISTANCE_MM).toBe(200);
  });

  it('every triangle faces the way its stored normals point (winding)', () => {
    const { out } = build(EXAMPLE());
    const parts = [
      ['rimOD', 'rimODN', RIM_INDEX],
      ['rimOS', 'rimOSN', RIM_INDEX],
      ['bridge', 'bridgeN', BRIDGE_INDEX],
      ['templeOD', 'templeODN', TEMPLE_INDEX],
      ['templeOS', 'templeOSN', TEMPLE_INDEX],
      ['hingeOD', 'hingeODN', HINGE_INDEX],
      ['hingeOS', 'hingeOSN', HINGE_INDEX],
    ];
    for (const [pk, nk, idx] of parts) {
      const P = out[pk];
      const N = out[nk];
      let bad = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [v3(P, idx[t]), v3(P, idx[t + 1]), v3(P, idx[t + 2])];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        let dot = 0;
        for (const v of [idx[t], idx[t + 1], idx[t + 2]]) {
          const n = v3(N, v);
          dot += f[0] * n[0] + f[1] * n[1] + f[2] * n[2];
        }
        if (!(dot > 0)) bad++;
      }
      expect({ pk, bad }).toEqual({ pk, bad: 0 });
      // every index addresses a vertex of the part
      expect(idx.reduce((m, v) => Math.max(m, v), 0)).toBe(P.length / 3 - 1);
    }
  });

  it('bounding spheres contain every world-space vertex (rims shifted by boxingCentreX)', () => {
    const p = MINUS10();
    const { out, res } = build(p, { f32: true });
    const world = (key, dx) => {
      const a = out[key];
      const pts = [];
      for (let k = 0; k < a.length / 3; k++) pts.push([a[3 * k] + dx, a[3 * k + 1], a[3 * k + 2]]);
      return pts;
    };
    const rims = [...world('rimOD', boxingCentreX('OD', 62, 14)), ...world('rimOS', boxingCentreX('OS', 62, 14))];
    const front = [...rims, ...world('bridge', 0)];
    const all = [...front, ...['templeOD', 'templeOS', 'hingeOD', 'hingeOS'].flatMap((k) => world(k, 0))];
    const within = (sph, pts) => pts.every((q) => dist(q, [sph.x, sph.y, sph.z]) <= sph.r * (1 + 1e-12));
    expect(within(res.boundingSphere, all)).toBe(true);
    expect(within(res.frontBoundingSphere, front)).toBe(true);
    expect(res.frontBoundingSphere.r).toBeLessThan(res.boundingSphere.r);
    // 03-09 A1: the world AABB of every frame vertex (the default camera fit projects its corners).
    const b = res.boundingBox;
    for (const [i, k] of [[0, 'x'], [1, 'y'], [2, 'z']]) {
      expect(b.min[k]).toBe(Math.min(...all.map((q) => q[i])));
      expect(b.max[k]).toBe(Math.max(...all.map((q) => q[i])));
    }
  });

  it('wrong buffer length throws; non-finite surfaces → finite false', () => {
    const out = allocFrameBuffers();
    out.bridge = new Float32Array(3);
    expect(() =>
      buildFrameMesh({ frame: FRAME_EX, eyes: { OD: null, OS: null }, rimDepthMm: 3, templeMm: 140 }, out),
    ).toThrow(/bridge/);
    const p = EXAMPLE();
    p.eyes.OD = { ...p.eyes.OD, ct: Number.NaN };
    expect(build(p).res.finite).toBe(false);
  });

  // Fixed topology and finiteness over fuzz frames; chunks of 10 keep each test well under the
  // 30 s timeout under coverage (03-02 deviation 6).
  const fuzz = fc.sample(
    fc.record({
      shape: fc.constantFrom(...SHAPES4),
      A: fc.integer({ min: 40, max: 62 }),
      B: fc.integer({ min: 28, max: 55 }),
      DBL: fc.integer({ min: 14, max: 24 }),
      sph: fc.integer({ min: -40, max: 40 }).map((k) => k / 4),
      cyl: fc.integer({ min: -16, max: 0 }).map((k) => k / 4 + 0),
      axisDeg: fc.integer({ min: 0, max: 179 }),
      materialId: fc.constantFrom(...Object.keys(MATERIALS)),
      monoPD: fc.integer({ min: 25, max: 40 }),
      D: fc.integer({ min: 2, max: 10 }),
      temple: fc.integer({ min: 100, max: 170 }),
    }),
    { numRuns: 50, seed: 30303 },
  );
  const fz = { lenses: 0 };
  for (let c = 0; c < 5; c++) {
    it(`fixed lengths, finite values, unit normals: fuzz frames ${10 * c + 1}–${10 * c + 10}`, () => {
      for (const f of fuzz.slice(10 * c, 10 * c + 10)) {
        const { shape, A, B, DBL, D, temple, ...rx } = f;
        const p = pairOf({ shape, A, B, DBL }, rx, rx);
        fz.lenses += (p.eyes.OD ? 1 : 0) + (p.eyes.OS ? 1 : 0);
        const { out, res } = build(p, { D, temple, f32: true });
        expect(res.finite).toBe(true);
        for (const [k, len] of Object.entries(FRAME_LENGTHS)) {
          expect(out[k]).toBeInstanceOf(Float32Array);
          expect(out[k].length).toBe(len);
          for (const v of out[k]) if (!Number.isFinite(v)) expect({ k, v }).toBe('finite');
          if (k.endsWith('N')) {
            for (let q = 0; q < len; q += 3) {
              const L = Math.hypot(out[k][q], out[k][q + 1], out[k][q + 2]);
              if (Math.abs(L - 1) >= 1e-5) expect({ k, q, L }).toBe('unit');
            }
          }
        }
        for (const s of [res.boundingSphere, res.frontBoundingSphere]) {
          expect(Number.isFinite(s.x + s.y + s.z + s.r)).toBe(true);
        }
      }
      if (c === 4) {
        console.info('[03-03] fuzz frames 50, computable lenses', fz.lenses, 'of 100');
        expect(fz.lenses).toBeGreaterThanOrEqual(50);
      }
    });
  }
});
