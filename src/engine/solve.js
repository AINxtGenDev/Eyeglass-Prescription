// ENG-04 CT fixed point over the outline (thick lens, ENG-02).
// Thickness is affine in CT: t = CT − d, d = sF − sB, so for fixed surfaces
// CT = max(minCT, minET + max_i d(p_i)). D2 depends on CT through D1v, hence the iteration.
// Iterate on the outline only, never on an interior grid (RESEARCH anti-pattern).

import { design, frontSagAt, backSagAt } from './design.js';
import { K } from './conventions.js';
import { maxRadiusFromOC } from './metrics.js';
import { BASE_CURVE_LIMITS } from './power.js';

function backSagError(axisDeg, cross, iterations) {
  return {
    ok: false,
    code: 'BACK_SAG_UNDEFINED',
    data: { meridian: cross ? 'cross' : 'base', axisDeg },
    iterations,
  };
}

// cb²·v² > 1: the cross-curve circle itself is undefined at this point.
function crossViolated(s, x, y) {
  const v = -(x - s.oc.x) * Math.sin(s.axisRad) + (y - s.oc.y) * Math.cos(s.axisRad);
  return s.cb * s.cb * v * v > 1;
}

/**
 * iterations = outline passes run (MINOR-12, 01-12): ≥ 1 on convergence and on a failure found
 * inside a pass; maxIter when it does not converge; VERTEX_TERM_INVALID is detected before the
 * pass and does not count it.
 * earlyExit: stop at the first undefined back sag (feasibility only; used on the decimated
 * search outlines). Otherwise the whole outline of that iteration is scanned for the label.
 * @returns {{ ok: true, ct: number, surfaces: object, binding: 'minCT'|'minET', iterations: number,
 *             maxThickness: number }
 *          | { ok: false, code: string, data: object, iterations: number }}
 */
export function solveCT({
  sph,
  cyl,
  axisDeg,
  n,
  D1,
  k1 = 0,
  minCT,
  minET,
  outline,
  oc,
  maxIter = 50,
  ct0,
  earlyExit = false,
}) {
  let ct = Math.max(minCT, ct0 ?? minCT);
  const np = outline.length / 2;
  for (let it = 0; it < maxIter; it++) {
    if (!(1 - (ct / 1000 / n) * D1 > 0)) {
      return { ok: false, code: 'VERTEX_TERM_INVALID', data: { ct, D1 }, iterations: it };
    }
    const s = design({ sph, cyl, axisDeg, n, D1, k1, ct, oc });
    let dMax = -Infinity;
    let eMax = -Infinity;
    let backFailed = false;
    let crossFailed = false;
    for (let i = 0; i < np; i++) {
      const x = outline[2 * i];
      const y = outline[2 * i + 1];
      const sF = frontSagAt(s, x, y);
      if (Number.isNaN(sF)) {
        return {
          ok: false,
          code: 'FRONT_SAG_UNDEFINED',
          data: { R1: K(n) / D1, rhoMax: maxRadiusFromOC(outline, oc) },
          iterations: it + 1,
        };
      }
      const sB = backSagAt(s, x, y);
      if (Number.isNaN(sB)) {
        if (earlyExit) return backSagError(axisDeg, true, it + 1);
        // Scan the rest of this iteration: the label is 'cross' if any failing point violates
        // the cross-curve circle itself (cb²·v² > 1), else 'base'.
        backFailed = true;
        if (crossViolated(s, x, y)) crossFailed = true;
        continue;
      }
      const d = sF - sB;
      if (d > dMax) dMax = d;
      if (-d > eMax) eMax = -d;
    }
    if (backFailed) return backSagError(axisDeg, crossFailed, it + 1);
    const next = Math.max(minCT, minET + dMax);
    if (Math.abs(next - ct) < 1e-4) {
      return {
        ok: true,
        ct: next,
        surfaces: design({ sph, cyl, axisDeg, n, D1, k1, ct: next, oc }),
        binding: next === minCT ? 'minCT' : 'minET',
        iterations: it + 1,
        maxThickness: Math.max(next, next + eMax),
      };
    }
    ct = next;
  }
  return {
    ok: false,
    code: 'THICK_LENS_NOT_CONVERGED',
    data: { iterations: maxIter },
    iterations: maxIter,
  };
}

// One source for the automatic range (D-A, 01-12): power.js BASE_CURVE_LIMITS.
const D1_MIN = BASE_CURVE_LIMITS.min;
const D1_MAX = BASE_CURVE_LIMITS.max;

// GAP-1 (01-12): an automatic lens never has a convex back surface. 0 dpt is the definitional
// boundary of "not convex" (a plano back gives the plano-convex form); a margin would be an
// unsourced design constant (D-01 final). Applied to the designed principal powers D2a, D2b.
export const BACK_CONVEX_MAX_DPT = 0;

// D-C flat-front tie-break (D-01 amendment, 2026-11-06). DESIGN CONSTANT, not a measured value.
// Anchor: the manufacturer centre-thickness tolerance ±0.30 mm (Zeiss Finished SV sheets,
// fixture provenance ctTolerance; the disclaimer's ±0,3 mm is the same number); τ is one third of
// it, a thickness difference the user cannot act on. Choosing the FLATTEST front within τ is an
// unsourced cosmetic design choice (no deep-bowl fronts), not an optical one. Evidence
// (lens-critic critic2/q8, 52 962 lenses): without it, 100 weak-plus lenses got fronts > m + 2
// and > +8 (68 at exactly +14) to save a median 0.008 mm, at most 0.049 mm.
export const FLAT_FRONT_TOLERANCE_MM = 0.10;
const BRACKET_DPT = 0.05;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * D-01 as amended by D-C (flat-front tie-break, τ = FLAT_FRONT_TOLERANCE_MM): the search finds
 * J_min, the smallest J(D1) = maxThickness = max(CT, largest outline edge thickness) for D1 in
 * [0.50, 14.00], then step (5) picks the flattest front with J ≤ J_min + τ. Only fronts whose back surface
 * is not convex (every back principal power ≤ BACK_CONVEX_MAX_DPT = 0, GAP-1). A result with
 * max(D2a, D2b) > 0 counts as infeasible (code BACK_SURFACE_CONVEX). Lenses with
 * max(sph, sph + cyl) ≤ 0 are never affected: D2max = m − D1v < 0 for every D1 > 0.
 * Deterministic and bounded:
 *   (0) seed: full-outline solve at seedD1 (Vogel-clamped), always; a candidate when it computes,
 *       so the result is never thicker than the Vogel lens by more than τ (the D-C tie-break
 *       below may trade up to τ for a flatter front);
 *   (1) coarse scan 0.50, 1.00, … < hi plus hi (hi = maxD1) on a decimated outline (every 4th
 *       point; a subset can only under-report violations), warm-started;
 *   (2) nothing computes → rescan [0.50, 14.00] in 0.10 steps on the decimated outline, ignoring
 *       the numerical margin, so an impossibility claim covers the whole allowed range;
 *   (3) coarse best re-evaluated on the full outline (candidate), then golden-section refinement
 *       on the full outline in [cb − 0.5, cb + 0.5] ∩ [0.5, bound] to a bracket ≤ 0.05 dpt,
 *       infeasible points = +∞, shrinking toward cb when both interior points are infeasible;
 *       if nothing there computes (decimation hid a violation), repeat the scan on the full
 *       outline and refine again;
 *   (4) still nothing and m = max(sph, sph + cyl) > 0 → boundary bisection on the full outline
 *       over [0.50, 14.00] (≤ 30 solves); the first computable point is refined (≤ 10 solves);
 *   (5) D-C flat-front tie-break: among fronts with a non-convex back, the flattest whose
 *       J ≤ J_min + τ (FLAT_FRONT_TOLERANCE_MM); in practice the front lo = max(0.50, m, 0),
 *       one full-outline solve, only when the thinnest front is steeper than lo + 0.05.
 * Cost per eye: 1 seed + ≤ 28 coarse + 1 re-evaluation + ≤ 10 refinement = 40 for lenses that
 * compute in the coarse pass, + ≤ 1 tie-break solve (D-C lenses only). Failing lenses add
 * ≤ 136 rescan + ≤ 30 bisection (+ ≤ 10 refinement when it finds a window) + 1 error solve.
 * When decimation hid a violation, the full-outline repeat adds one more grid pass (≤ 28, or
 * ≤ 136 after a rescan) + ≤ 10 refinement.
 * Each solve is capped by maxIter. It runs on every automatic recompute (ENG-09 cost).
 * Returns minMaxThickness = J_min (the thinnest found) next to maxThickness = J of the chosen D1.
 */
export function optimiseBaseCurve({ sph, cyl, axisDeg, n, k1 = 0, minCT, minET, outline, oc, maxD1, seedD1 }) {
  const np = outline.length / 2;
  const dec = new Float64Array(2 * Math.ceil(np / 4));
  for (let i = 0, j = 0; i < np; i += 4, j++) {
    dec[2 * j] = outline[2 * i];
    dec[2 * j + 1] = outline[2 * i + 1];
  }
  let evaluations = 0;
  let searchIterations = 0;
  const solve = (D1, ol, ct0) => {
    evaluations++;
    const earlyExit = ol !== outline;
    const r = solveCT({ sph, cyl, axisDeg, n, D1, k1, minCT, minET, outline: ol, oc, ct0, earlyExit });
    searchIterations += r.iterations;
    if (r.ok) {
      const D2max = Math.max(r.surfaces.D2a, r.surfaces.D2b);
      if (D2max > BACK_CONVEX_MAX_DPT) {
        return { ok: false, code: 'BACK_SURFACE_CONVEX', data: { D2max }, iterations: r.iterations };
      }
    }
    return r;
  };
  let best = null; // full-outline feasible candidate with the smallest J (first one on ties)
  const consider = (D1, r) => {
    if (r.ok && (best === null || r.maxThickness < best.r.maxThickness)) best = { D1, r };
  };

  // (0) Vogel seed
  const seed = solve(seedD1, outline);
  const seedMaxThickness = seed.ok ? seed.maxThickness : null;
  consider(seedD1, seed);

  // Scan a grid; on the full outline every feasible point is also a candidate.
  const scan = (grid, ol) => {
    let cb = null;
    let ct0;
    for (const D1 of grid) {
      const r = solve(D1, ol, ct0);
      if (!r.ok) continue;
      ct0 = r.ct;
      if (ol === outline) consider(D1, r);
      if (cb === null || r.maxThickness < cb.J) cb = { D1, J: r.maxThickness, ct: r.ct };
    }
    return cb;
  };

  // Refine around cb on the full outline; returns the full-outline J of cb (null if infeasible)
  // and whether any full-outline point of this step computed.
  const refine = (cb, bound, cbIsFull) => {
    let found = cbIsFull;
    let cbFullJ = cb.J;
    if (!cbIsFull) {
      const rc = solve(cb.D1, outline, cb.ct);
      consider(cb.D1, rc);
      cbFullJ = rc.ok ? rc.maxThickness : null;
      found = rc.ok;
    }
    const J = (x) => {
      const r = solve(x, outline, cb.ct);
      consider(x, r);
      if (r.ok) found = true;
      return r.ok ? r.maxThickness : Infinity;
    };
    let a = Math.max(D1_MIN, cb.D1 - 0.5);
    let b = Math.min(bound, cb.D1 + 0.5);
    if (b - a > BRACKET_DPT) {
      let x1 = b - GOLDEN * (b - a);
      let x2 = a + GOLDEN * (b - a);
      let f1 = J(x1);
      let f2 = J(x2);
      while (b - a > BRACKET_DPT) {
        const bothInfeasible = f1 === Infinity && f2 === Infinity;
        const left = bothInfeasible ? cb.D1 <= x1 : f1 <= f2;
        const right = bothInfeasible ? cb.D1 >= x2 : !left;
        if (left) {
          b = x2;
          x2 = x1;
          f2 = f1;
          x1 = b - GOLDEN * (b - a);
          f1 = J(x1);
        } else if (right) {
          a = x1;
          x1 = x2;
          f1 = f2;
          x2 = a + GOLDEN * (b - a);
          f2 = J(x2);
        } else {
          // both infeasible, cb strictly between them: shrink toward cb from both sides
          a = x1;
          b = x2;
          x1 = b - GOLDEN * (b - a);
          x2 = a + GOLDEN * (b - a);
          f1 = J(x1);
          f2 = J(x2);
        }
      }
    }
    return { cbFullJ, found };
  };

  const hi = Math.max(D1_MIN, maxD1);
  let grid = [];
  for (let k = 1; k / 2 < hi; k++) grid.push(k / 2);
  grid.push(hi);
  let bound = hi;

  // (1) coarse scan, (2) impossibility rescan
  let cb = scan(grid, dec);
  if (cb === null) {
    grid = [];
    for (let k = 5; k <= 10 * D1_MAX; k++) grid.push(k / 10);
    bound = D1_MAX;
    cb = scan(grid, dec);
  }

  let coarseD1 = null;
  let coarseMaxThickness = null;
  if (cb !== null) {
    // (3) full-outline re-evaluation of cb + golden refinement
    coarseD1 = cb.D1;
    const first = refine(cb, bound, false);
    coarseMaxThickness = first.cbFullJ;
    if (!first.found) {
      const cbFull = scan(grid, outline);
      if (cbFull !== null) refine(cbFull, bound, true);
    }
  }

  // (4) boundary bisection (lens-critic MINOR-1, MAJOR-B), failing lenses with a positive
  // meridian only, on the full outline over the same margin-free domain as the rescan. For a
  // positive meridian m, fronts flatter than about m give a convex back (convex, or a convex back
  // too steep to reach the edge), and much steeper fronts give a concave back too steep to reach
  // the edge, so feasibility is an interval the 0.10 dpt rescan can step over. Rule at mid:
  // computes → stop and refine around it (≤ 10 solves); BACK_SURFACE_CONVEX, or
  // BACK_SAG_UNDEFINED with m − mid > 0 → the window lies above (lo = mid); otherwise hi = mid.
  const m = Math.max(sph, sph + cyl);
  if (best === null && m > 0) {
    let lo = D1_MIN;
    let hiB = D1_MAX;
    for (let k = 0; k < 30 && hiB - lo >= 1e-4; k++) {
      const mid = (lo + hiB) / 2;
      const r = solve(mid, outline);
      if (r.ok) {
        consider(mid, r);
        refine({ D1: mid, J: r.maxThickness, ct: r.ct }, D1_MAX, true);
        break;
      }
      if (r.code === 'BACK_SURFACE_CONVEX' || (r.code === 'BACK_SAG_UNDEFINED' && m - mid > 0)) lo = mid;
      else hiB = mid;
    }
  }

  if (best === null) {
    // Error code = the full-outline solve at the flattest allowed front (covers any real frame,
    // so the binding failure is the back surface).
    const r0 = solve(D1_MIN, outline);
    consider(D1_MIN, r0); // defensive: a computable floor lens is never reported as an error
    if (!r0.ok) {
      return {
        ok: false,
        code: r0.code,
        data: { ...r0.data, searched: true },
        evaluations,
        searchIterations,
      };
    }
  }
  // (5) D-C flat-front tie-break: lo = max(D1_MIN, m⁺) is the flattest front with a non-convex
  // back (D1v > D1 ≥ m). When the thinnest front is steeper than lo by more than the refinement
  // bracket, take lo if its full-outline J ≤ J_min + τ, otherwise keep best (one extra solve).
  // Strong plus lenses (thinnest at D2 ≈ 0, D1 < m) and minus lenses at the floor never run it.
  // No bisection between lo and best: across 650 tie-breaks (lens-critic critic3) lo was always
  // within the threshold, so a bisection branch would be dead code.
  const minMaxThickness = best.r.maxThickness;
  const lo = Math.max(D1_MIN, m, 0);
  if (best.D1 > lo + BRACKET_DPT) {
    const rf = solve(lo, outline);
    if (rf.ok && rf.maxThickness <= minMaxThickness + FLAT_FRONT_TOLERANCE_MM) best = { D1: lo, r: rf };
  }
  const r = best.r;
  return {
    ok: true,
    D1: best.D1,
    ct: r.ct,
    surfaces: r.surfaces,
    binding: r.binding,
    iterations: r.iterations,
    maxThickness: r.maxThickness,
    minMaxThickness,
    evaluations,
    searchIterations,
    seedMaxThickness,
    coarseD1,
    coarseMaxThickness,
  };
}
