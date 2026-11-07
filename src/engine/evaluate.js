// Engine entry point: frozen LensSpec → LensResult contract (01-SKELETON.md "Frozen Contract").
// Later plans may add values/branches, never rename or remove fields.

/**
 * @typedef {Object} LensSpec
 * @property {'OD'|'OS'} eye
 * @property {number} sph dpt
 * @property {number} cyl dpt (minus-cyl form)
 * @property {number} axisDeg TABO, [0, 180)
 * @property {string} materialId key of MATERIALS, or 'custom' with customMaterial (02-12)
 * @property {{ shape: string, A: number, B: number, DBL: number }} frame mm
 * @property {number} monoPD mm
 * @property {number|null} fittingHeight mm from the bottom of the box (D-04), null = box centre
 * @property {number|null} baseCurve manual front power D1 (dpt), ≥ 0 (MAT-03), null = automatic (id 'thinnest': D-01 + D-C,
 *   flattest front within τ of the thinnest)
 * @property {number|null} minCT mm, null = material default
 * @property {number|null} minET mm, null = material default
 * @property {number|null} [frontConic] conic constant k of the front (MAT-05, 02-11); null or 0 =
 *   sphere. The automatic base curve is always chosen at k = 0, then k is applied at that D1
 *   (RESEARCH Pitfall 1), see the conic block in evaluateLens.
 * @property {{ ne: number, density: number, ve: number|null }|null} [customMaterial] user-supplied
 *   material (MAT-06, 02-12): ne, density g/cm³, νe or null. Required exactly when materialId is
 *   'custom', together with non-null minCT and minET; present with any other materialId it is
 *   INVALID_SPEC (one source of truth). The engine invents no defaults for user materials.
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
 *   effects are not modelled in v1. null for a customMaterial without νe (02-12).
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
  if (spec.materialId === 'custom') {
    const cm = spec.customMaterial;
    const veOk = cm?.ve === null || (fin(cm?.ve) && cm.ve > 0);
    if (cm == null || typeof cm !== 'object' || !(fin(cm.ne) && cm.ne > 1) || !(fin(cm.density) && cm.density > 0) || !veOk) {
      return 'custom-material';
    }
    if (spec.minCT == null || spec.minET == null) return 'custom-material';
  } else if (spec.customMaterial != null) {
    return 'custom-material';
  } else if (!Object.hasOwn(MATERIALS, spec.materialId)) return 'material';
  if (!(spec.fittingHeight == null || fin(spec.fittingHeight))) return 'fitting-height';
  if (!optNonNeg(spec.baseCurve)) return 'base-curve';
  if (!optPositive(spec.minCT) || !optPositive(spec.minET)) return 'min-thickness';
  // Any k ≤ 0 (k = 0 sphere); the UI offers only the cited −5…−1 (src/state/validate.js).
  if (!(spec.frontConic == null || (fin(spec.frontConic) && spec.frontConic <= 0))) return 'front-conic';
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
  // MAT-06: a user material carries no minimum thicknesses; minCT/minET are required for it
  // (invalidReason), so the NaN defaults are unreachable.
  const cm = spec.customMaterial;
  const m =
    spec.materialId === 'custom'
      ? { ne: cm.ne, density: cm.density, ve: cm.ve, minCT: NaN, minET: NaN }
      : MATERIALS[spec.materialId];
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
  // MAT-05 generic conic front. The conic sag z(r) with vertex radius R = 1/c satisfies
  // r² = 2Rz − (1 + k)z² (sag.test.js proves it for sphereSag). Jalie, US4289387, writes the
  // front as y² = 2000(n′ − n)x/F₀ − p·x², so p = 1 + k: his p 0…−4 is k −1…−5 (the UI range).
  // The patent applies the hyperboloid to the FRONT of plus lenses only (minus lenses get it on
  // the back); this model applies k to the front for any Rx as a generic surface, which is why
  // the UI says it mainly changes plus lenses. Paraxial power is set by the vertex curvature, so
  // D1v/D2 and the Rx do not depend on k.
  const k = spec.frontConic ?? 0;
  if (spec.baseCurve != null) {
    D1 = spec.baseCurve;
    baseCurveRule = 'manual';
    r = solveCT({ ...common, k1: k, D1 });
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
    // The search ran at k1: 0 (common): the base curve is chosen on the spherical design, never
    // re-optimised with k (that gives bowl-shaped fronts, RESEARCH Pitfall 1). baseCurveSearch
    // and vogelMaxThickness stay the k = 0 values (the UI labels them as such).
    if (k !== 0 && r.ok) {
      r = solveCT({ ...common, k1: k, D1, ct0: r.ct });
      // Convex-back guard (lens-critic M2, GAP-1: an automatic lens never has a convex back). The
      // thinner CT lowers D1v = D1/(1 − (ct/1000)/n·D1), so D2 = sph − D1v can turn positive.
      // max(D2a, D2b) ≤ 0 ⇔ D1v ≥ m, m = max(sph, sph + cyl); D1v increases in D1 and ct, so the
      // flattest non-convex front at a given ct is D1min(ct) = m / (1 + (ct/1000)/n · m). D1 only
      // rises, and only to that value at the previous pass's CT. Warning sign: an aspheric D1
      // above the spherical D1 by more than this minimal raise means the rule was broken.
      const mm = Math.max(sph, sph + cyl);
      for (let pass = 0; r.ok && Math.max(r.surfaces.D2a, r.surfaces.D2b) > BACK_CONVEX_MAX_DPT; pass++) {
        if (pass === 10) {
          return fail(eye, [diag('BACK_SURFACE_CONVEX', { D2max: Math.max(r.surfaces.D2a, r.surfaces.D2b) })]);
        }
        D1 = Math.max(D1, mm / (1 + (r.ct / 1000 / n) * mm));
        r = solveCT({ ...common, k1: k, D1, ct0: r.ct });
      }
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
    abbe: m.ve ?? null,
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
