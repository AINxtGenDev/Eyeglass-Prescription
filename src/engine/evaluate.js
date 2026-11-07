// Engine entry point: frozen LensSpec → LensResult contract (01-SKELETON.md "Frozen Contract").
// Later plans may add values/branches, never rename or remove fields.

/**
 * @typedef {Object} LensSpec
 * @property {'OD'|'OS'} eye
 * @property {number} sph dpt
 * @property {number} cyl dpt (minus-cyl form)
 * @property {number} axisDeg TABO, [0, 180)
 * @property {string} materialId key of MATERIALS
 * @property {{ shape: string, A: number, B: number, DBL: number }} frame mm
 * @property {number} monoPD mm
 * @property {number|null} fittingHeight mm from the bottom of the box (D-04), null = box centre
 * @property {number|null} baseCurve manual front power D1 (dpt), ≥ 0 (MAT-03), null = automatic (id 'thinnest': D-01 + D-C,
 *   flattest front within τ of the thinnest)
 * @property {number|null} minCT mm, null = material default
 * @property {number|null} minET mm, null = material default
 */

/**
 * @typedef {Object} LensResult
 * @property {boolean} ok
 * @property {'OD'|'OS'} eye
 * @property {Array<{ code: string, severity: 'error'|'warn'|'info', data: object }>} diagnostics
 * @property {null|{ ct: number,
 *   etMax: { value: number, index: number, location: string, x: number, y: number },
 *   etMin: { value: number, index: number, location: string, x: number, y: number },
 *   etAt: { nasal: number, temporal: number, superior: number, inferior: number },
 *   volumeMm3: number, weightG: number, frontProtrusion: { max: number, min: number },
 *   mbsMm: number, decentration: { x: number, y: number } }} metrics
 * @property {null|{ n: number, D1: number, D1v: number, D2a: number, D2b: number,
 *   R1: number|null, Ra: number|null, Rb: number|null, rhoMax: number,
 *   vogelD1: number, vogelClampedD1: number, vogelMaxThickness: number|null,
 *   baseCurveRule: 'thinnest'|'manual',
 *   baseCurveSearch: null|{ evaluations: number, iterations: number, maxThickness: number,
 *     minMaxThickness: number },
 *   bindingConstraint: 'minCT'|'minET', iterations: number,
 *   sags: Record<'nasal'|'temporal'|'superior'|'inferior'|'etMax'|'etMin'|'rhoMax',
 *     { x: number, y: number, front: number, back: number }>,
 *   abbe: number }} intermediates
 *   Radii in mm, null for a plano surface (never Infinity). vogel* are reference values only
 *   ("übliche Faustregel nach Vogel"), not the chosen curve.
 *   sags (01-13, ENG-06): lens-local (x, y) of each named outline point and the front/back sag
 *   there, mm along +z toward the eye from each surface's vertex plane; thickness = CT − front + back.
 *   abbe (01-13, MAT-01): νe of the material (same line as ne), exposed for display; chromatic
 *   effects are not modelled in v1.
 * @property {null|{ n: number, ct: number, c1: number, k1: number, ca: number, cb: number,
 *   axisRad: number, oc: { x: number, y: number } }} surfaces
 */

import { nasalSign } from './conventions.js';
import { MATERIALS } from './materials.js';
import { diag, STOCK_BLANK_MAX_MM } from './diagnostics.js';
import { sphericalEquivalent, baseCurveAuto } from './power.js';
import { solveCT, optimiseBaseCurve, BACK_CONVEX_MAX_DPT } from './solve.js';
import { computeMetrics, maxRadiusFromOC, extremeIndices, farthestIndexFromOC } from './metrics.js';
import { frontSagAt, backSagAt } from './design.js';
import { frameOutline } from './frame/outline.js';
import { SHAPES } from './frame/shapes.js';

const fin = Number.isFinite;
const optPositive = (v) => v == null || (fin(v) && v > 0);
// Manual base curve (MAT-03 range 0,00…+10,00, the UI validates the range): 0 is a plano front,
// which the engine handles (sphereSag(0, r²) = 0, radius(0) = null).
const optNonNeg = (v) => v == null || (fin(v) && v >= 0);

function fail(eye, diagnostics) {
  return { ok: false, eye, diagnostics, metrics: null, intermediates: null, surfaces: null };
}

function invalidReason(spec) {
  if (spec == null || typeof spec !== 'object') return 'spec';
  if (spec.eye !== 'OD' && spec.eye !== 'OS') return 'eye';
  const f = spec.frame;
  if (f == null || typeof f !== 'object') return 'frame';
  for (const v of [spec.sph, spec.cyl, spec.axisDeg, spec.monoPD, f.A, f.B, f.DBL]) {
    if (!fin(v)) return 'non-finite';
  }
  if (!(f.A > 0 && f.B > 0)) return 'frame-size';
  if (!Object.hasOwn(SHAPES, f.shape)) return 'unknown-shape';
  if (!Object.hasOwn(MATERIALS, spec.materialId)) return 'material';
  if (!(spec.fittingHeight == null || fin(spec.fittingHeight))) return 'fitting-height';
  if (!optNonNeg(spec.baseCurve)) return 'base-curve';
  if (!optPositive(spec.minCT) || !optPositive(spec.minET)) return 'min-thickness';
  // Minus-cylinder form only; the UI transposes plus-cylinder input (src/state/transpose.js, 01-09).
  if (spec.cyl > 0) return 'plus-cyl-must-be-transposed';
  return null;
}

function allFinite(value) {
  if (typeof value === 'number') return fin(value);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
}

const radius = (c) => (c === 0 ? null : 1 / c);

/** Even-odd ray test: is (px, py) inside the closed outline polygon? */
function insideOutline(outline, px, py) {
  let inside = false;
  const n = outline.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[2 * i];
    const yi = outline[2 * i + 1];
    const xj = outline[2 * j];
    const yj = outline[2 * j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * @param {LensSpec} spec
 * @param {{ outlinePoints?: number }} [options] outlinePoints (multiple of 4, default 720) exists
 *   for the ENG-04 sampling-convergence test only; not part of the LensSpec contract.
 * @returns {LensResult}
 */
export function evaluateLens(spec, { outlinePoints = 720 } = {}) {
  const eye = spec?.eye;
  const reason = invalidReason(spec);
  if (reason) return fail(eye, [diag('INVALID_SPEC', { reason })]);

  const { sph, cyl, axisDeg, frame, monoPD, fittingHeight } = spec;
  const m = MATERIALS[spec.materialId];
  const n = m.ne;
  const minCT = spec.minCT ?? m.minCT;
  const minET = spec.minET ?? m.minET;

  // ENG-05: OC relative to the boxing centre, positive x = nasal for OD.
  const oc = {
    x: nasalSign(eye) * ((frame.A + frame.DBL) / 2 - monoPD),
    y: fittingHeight == null ? 0 : fittingHeight - frame.B / 2,
  };
  // Only the frame shape is mirrored for OS (inside frameOutline), never the Rx.
  const outline = frameOutline(frame.shape, frame.A, frame.B, eye, outlinePoints);
  const rhoMax = maxRadiusFromOC(outline, oc);

  const bc = baseCurveAuto(sphericalEquivalent(sph, cyl), { n, rhoMax, k1: 0 });
  const common = { sph, cyl, axisDeg, n, k1: 0, minCT, minET, outline, oc };
  let r;
  let D1;
  let baseCurveRule;
  let baseCurveSearch = null;
  let vogelMaxThickness = null;
  if (spec.baseCurve != null) {
    D1 = spec.baseCurve;
    baseCurveRule = 'manual';
    r = solveCT({ ...common, D1 });
  } else {
    baseCurveRule = 'thinnest';
    r = optimiseBaseCurve({ ...common, maxD1: bc.maxD1, seedD1: bc.vogelClampedD1 });
    D1 = r.D1;
    if (r.ok) {
      baseCurveSearch = {
        evaluations: r.evaluations,
        iterations: r.searchIterations,
        maxThickness: r.maxThickness,
        minMaxThickness: r.minMaxThickness,
      };
      vogelMaxThickness = r.seedMaxThickness;
    }
  }
  if (!r.ok) return fail(eye, [diag(r.code, r.data)]);

  const s = r.surfaces;
  const metrics = computeMetrics({ surfaces: s, outline, density: m.density, eye });
  // ENG-06: surface sags at the named outline points (same index rules as the metrics).
  const sagPoint = (i) => {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    return { x, y, front: frontSagAt(s, x, y), back: backSagAt(s, x, y) };
  };
  const ext = extremeIndices(outline, eye);
  const sags = {
    nasal: sagPoint(ext.nasal),
    temporal: sagPoint(ext.temporal),
    superior: sagPoint(ext.superior),
    inferior: sagPoint(ext.inferior),
    etMax: sagPoint(metrics.etMax.index),
    etMin: sagPoint(metrics.etMin.index),
    rhoMax: sagPoint(farthestIndexFromOC(outline, oc)),
  };
  const intermediates = {
    n,
    D1,
    D1v: s.D1v,
    D2a: s.D2a,
    D2b: s.D2b,
    R1: radius(s.c1),
    Ra: radius(s.ca),
    Rb: radius(s.cb),
    rhoMax,
    vogelD1: bc.vogelD1,
    vogelClampedD1: bc.vogelClampedD1,
    vogelMaxThickness,
    baseCurveRule,
    baseCurveSearch,
    bindingConstraint: r.binding,
    iterations: r.iterations,
    sags,
    abbe: m.ve,
  };
  if (!allFinite(metrics) || !allFinite(intermediates)) {
    return fail(eye, [diag('NON_FINITE_RESULT', {})]);
  }
  const diagnostics = [diag(r.binding === 'minCT' ? 'CT_SET_BY_MIN_CT' : 'CT_SET_BY_MIN_ET', {})];
  // Warnings keep the numbers (D-01: computable but oversized is never an error).
  // Manual base curve only (MAT-03): solveCT does not reject a convex back, the automatic search
  // never returns one (RESEARCH Pitfall 2). D2 = Sph − D1v, so only a higher D1 clears it.
  const D2max = Math.max(s.D2a, s.D2b);
  if (baseCurveRule === 'manual' && D2max > BACK_CONVEX_MAX_DPT) diagnostics.push(diag('MANUAL_BACK_CONVEX', { D2max }));
  if (!insideOutline(outline, oc.x, oc.y)) diagnostics.push(diag('OC_OUTSIDE_OUTLINE', { x: oc.x, y: oc.y }));
  if (metrics.mbsMm > STOCK_BLANK_MAX_MM) {
    diagnostics.push(diag('BLANK_EXCEEDS_STOCK', { mbsMm: metrics.mbsMm, stockMm: STOCK_BLANK_MAX_MM }));
  }
  return {
    ok: true,
    eye,
    diagnostics,
    metrics,
    intermediates,
    surfaces: {
      n: s.n,
      ct: s.ct,
      c1: s.c1,
      k1: s.k1,
      ca: s.ca,
      cb: s.cb,
      axisRad: s.axisRad,
      oc: s.oc,
    },
  };
}

/** @param {{ OD: LensSpec, OS: LensSpec }} pair */
export function evaluatePair({ OD, OS }) {
  return { OD: evaluateLens(OD), OS: evaluateLens(OS) };
}
