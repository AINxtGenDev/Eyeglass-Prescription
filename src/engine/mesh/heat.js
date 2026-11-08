// VIZ-05 (03-03, D-04(e), D-23/D-25): numbers for the thickness heatmap. Pure JS. Every callout
// is an engine number (metrics, meridianProfile ends), never a value re-sampled from the mesh.

import { meridianProfile, meridianEndLabels } from '../profile.js';
import { thicknessAt } from '../metrics.js';

/**
 * One shared colour scale over all displayed lenses: min of the thinnest point, max of the
 * thickest point. These are the state/compare.js thinnest/thickest definitions (min/max of ct and
 * the edge extreme; asserted equal in heat.test.js). Written inline because the engine may not
 * import from src/state (lint boundary).
 * @param {Array<{ ct: number, etMin: { value: number }, etMax: { value: number } }>} list metrics
 * @returns {{ min: number, max: number } | null} null for an empty list
 */
export function heatScale(list) {
  if (list.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const m of list) {
    min = Math.min(min, m.ct <= m.etMin.value ? m.ct : m.etMin.value);
    max = Math.max(max, m.ct >= m.etMax.value ? m.ct : m.etMax.value);
  }
  return { min, max };
}

/**
 * Iso-line steps, mm. 0,1…2 are the UI-SPEC set; 5 and 10 extend it (planner refinement) so that
 * computable lenses with 40 mm+ edges still get at most 8 lines.
 */
export const ISO_STEPS = Object.freeze([0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]);
const MAX_LINES = 8;
const r9 = (v) => Math.round(v * 1e9) / 1e9;
// x/step, snapped to the nearest integer when within 1e-9 (3/0.1 = 29.999999999999996)
const steps = (x, step) => {
  const q = x / step;
  const k = Math.round(q);
  return Math.abs(q - k) < 1e-9 ? k : q;
};

/**
 * Iso levels for a scale: the smallest step of ISO_STEPS with at most 8 multiples strictly
 * inside (min, max); the largest step if none qualifies. scaleMin/scaleMax = the scale ends
 * rounded out to the step (one step apart at least). flat = fewer than 2 lines.
 * @param {number} min @param {number} max
 * @returns {{ step: number, values: number[], scaleMin: number, scaleMax: number, flat: boolean }}
 */
export function isoLevels(min, max) {
  let step = ISO_STEPS[ISO_STEPS.length - 1];
  for (const s of ISO_STEPS) {
    const n = Math.ceil(steps(max, s)) - Math.floor(steps(min, s)) - 1;
    if (n <= MAX_LINES) {
      step = s;
      break;
    }
  }
  const kLo = Math.floor(steps(min, step));
  let kHi = Math.ceil(steps(max, step));
  const values = [];
  for (let k = kLo + 1; k < kHi; k++) values.push(r9(k * step));
  if (kHi === kLo) kHi++;
  return { step, values, scaleMin: r9(kLo * step), scaleMax: r9(kHi * step), flat: values.length < 2 };
}

/** The thickest-point callout merges with an edge callout within this polar angle about the OC.
 * UI-SPEC design value, no optical meaning. */
export const THICKEST_MERGE_DEG = 10;
const EDGE_KEYS = /** @type {const} */ (['nasal', 'temporal', 'superior', 'inferior']);

const angleDeg = (dx, dy) => (Math.atan2(dy, dx) * 180) / Math.PI;
const angleDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/**
 * Heatmap callouts (Mitte, innen, außen, oben, unten, dickste) from engine values only.
 * Edge callouts are the ends of meridianProfile at 0° and 90° (labelled by meridianEndLabels);
 * centre = metrics.ct at the OC; thickest = the centre when ct ≥ etMax, else the etMax point,
 * with merge = the edge key within THICKEST_MERGE_DEG of it (polar angle about the OC), else null.
 * @param {{ surfaces: object, frame: { shape: string, A: number, B: number }, eye: 'OD'|'OS' }} lens
 * @param {object} metrics LensResult.metrics of the same lens
 */
export function heatCallouts(lens, metrics) {
  const { oc } = lens.surfaces;
  const centre = { t: metrics.ct, x: oc.x, y: oc.y };
  const atCentre = metrics.ct >= metrics.etMax.value;
  const thickest = atCentre
    ? { t: metrics.ct, where: 'centre', x: oc.x, y: oc.y, merge: 'centre' }
    : { t: metrics.etMax.value, where: 'edge', x: metrics.etMax.x, y: metrics.etMax.y, merge: null };
  const p0 = meridianProfile(lens, 0);
  const p90 = meridianProfile(lens, 90);
  if (!p0.ok || !p90.ok) return { ok: false, code: 'NO_CHORD', centre, thickest };
  const res = { ok: true, centre, thickest };
  for (const [p, theta] of [
    [p0, 0],
    [p90, 90],
  ]) {
    const labels = meridianEndLabels(lens.eye, theta);
    for (let e = 0; e < 2; e++) res[labels[e]] = { t: p.ends[e].t, x: p.ends[e].x, y: p.ends[e].y };
  }
  if (!atCentre) {
    const a = angleDeg(thickest.x - oc.x, thickest.y - oc.y);
    let best = THICKEST_MERGE_DEG;
    for (const k of EDGE_KEYS) {
      const d = angleDiff(a, angleDeg(res[k].x - oc.x, res[k].y - oc.y));
      if (d <= best) (best = d), (thickest.merge = k);
    }
  }
  return res;
}

const SCAN = 64;
const BISECT = 50;
const LABEL_ORDER = /** @type {const} */ (['temporal', 'superior', 'nasal', 'inferior']);

/**
 * Label positions for the iso lines: for each value v, the first point on the half-chords from
 * the OC to the temporal, superior, nasal and inferior callouts (in that order) where
 * thicknessAt = v (64 uniform samples for the first sign change, then 50 bisections).
 * null when v is outside [thinnest, thickest] of this lens, no half-chord reaches it, or the
 * callouts are NO_CHORD.
 * @param {{ surfaces: object }} lens @param {object} metrics
 * @param {number[]} values @param {ReturnType<typeof heatCallouts>} callouts
 * @returns {Array<{ x: number, y: number } | null>} aligned with values
 */
export function isoLabelPoints(lens, metrics, values, callouts) {
  if (!callouts.ok) return values.map(() => null);
  const s = lens.surfaces;
  const { min, max } = heatScale([metrics]);
  const o = callouts.centre;
  return values.map((v) => {
    if (!(v >= min && v <= max)) return null;
    for (const k of LABEL_ORDER) {
      const e = callouts[k];
      const at = (u) => ({ x: o.x + u * (e.x - o.x), y: o.y + u * (e.y - o.y) });
      const f = (u) => {
        const p = at(u);
        return thicknessAt(s, p.x, p.y) - v;
      };
      let u0 = 0;
      let f0 = f(0);
      if (f0 === 0) return at(0);
      for (let q = 1; q < SCAN; q++) {
        const u1 = q / (SCAN - 1);
        const f1 = f(u1);
        if (f1 === 0) return at(u1);
        if (f0 < 0 !== f1 < 0) {
          let lo = u0;
          let hi = u1;
          for (let b = 0; b < BISECT; b++) {
            const mid = (lo + hi) / 2;
            if (f(mid) < 0 === f0 < 0) lo = mid;
            else hi = mid;
          }
          return at((lo + hi) / 2);
        }
        u0 = u1;
        f0 = f1;
      }
    }
    return null;
  });
}
