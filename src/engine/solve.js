// ENG-04 CT fixed point over the outline (thick lens, ENG-02).
// Thickness is affine in CT: t = CT − d, d = sF − sB, so for fixed surfaces
// CT = max(minCT, minET + max_i d(p_i)). D2 depends on CT through D1v, hence the iteration.
// Iterate on the outline only, never on an interior grid (RESEARCH anti-pattern).

import { design, frontSagAt, backSagAt } from './design.js';
import { K } from './conventions.js';
import { maxRadiusFromOC } from './metrics.js';

/**
 * @returns {{ ok: true, ct: number, surfaces: object, binding: 'minCT'|'minET', iterations: number,
 *             maxThickness: number }
 *          | { ok: false, code: string, data: object, iterations: number }}
 */
export function solveCT({ sph, cyl, axisDeg, n, D1, k1 = 0, minCT, minET, outline, oc, maxIter = 50, ct0 }) {
  let ct = Math.max(minCT, ct0 ?? minCT);
  const np = outline.length / 2;
  for (let it = 0; it < maxIter; it++) {
    if (!(1 - (ct / 1000 / n) * D1 > 0)) {
      return { ok: false, code: 'VERTEX_TERM_INVALID', data: { ct, D1 }, iterations: it };
    }
    const s = design({ sph, cyl, axisDeg, n, D1, k1, ct, oc });
    let dMax = -Infinity;
    let eMax = -Infinity;
    for (let i = 0; i < np; i++) {
      const x = outline[2 * i];
      const y = outline[2 * i + 1];
      const sF = frontSagAt(s, x, y);
      if (Number.isNaN(sF)) {
        return {
          ok: false,
          code: 'FRONT_SAG_UNDEFINED',
          data: { R1: K(n) / D1, rhoMax: maxRadiusFromOC(outline, oc) },
          iterations: it,
        };
      }
      const sB = backSagAt(s, x, y);
      if (Number.isNaN(sB)) {
        return { ok: false, code: 'BACK_SAG_UNDEFINED', data: { meridian: 'cross' }, iterations: it };
      }
      const d = sF - sB;
      if (d > dMax) dMax = d;
      if (-d > eMax) eMax = -d;
    }
    const next = Math.max(minCT, minET + dMax);
    if (Math.abs(next - ct) < 1e-4) {
      return {
        ok: true,
        ct: next,
        surfaces: design({ sph, cyl, axisDeg, n, D1, k1, ct: next, oc }),
        binding: next === minCT ? 'minCT' : 'minET',
        iterations: it,
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

const D1_MIN = 0.5;
const D1_MAX = 10;
const BRACKET_DPT = 0.05;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * D-01 final ("always pick the thinnest"): the D1 in [0.50, 10.00] with the smallest
 * J(D1) = maxThickness = max(CT, largest outline edge thickness). Deterministic and bounded:
 *   (0) seed: full-outline solve at seedD1 (Vogel-clamped), always; a candidate when it computes,
 *       so the result is never thicker than the Vogel lens;
 *   (1) coarse scan 0.50, 1.00, … < hi plus hi (hi = maxD1) on a decimated outline (every 4th
 *       point; a subset can only under-report violations), warm-started;
 *   (2) nothing computes → rescan [0.50, 10.00] in 0.10 steps on the decimated outline, ignoring
 *       the numerical margin, so an impossibility claim covers the whole allowed range;
 *   (3) coarse best re-evaluated on the full outline (candidate), then golden-section refinement
 *       on the full outline in [cb − 0.5, cb + 0.5] ∩ [0.5, bound] to a bracket ≤ 0.05 dpt,
 *       infeasible points = +∞, shrinking toward cb when both interior points are infeasible;
 *       if nothing there computes (decimation hid a violation), repeat the scan on the full
 *       outline and refine again.
 * Cost per eye: 1 seed + ≤ 21 coarse + ≤ 96 rescan (failing lenses only) + ≤ 10 refinement
 * solves, each capped by maxIter. It runs on every automatic recompute (ENG-09 cost).
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
    const r = solveCT({ sph, cyl, axisDeg, n, D1, k1, minCT, minET, outline: ol, oc, ct0 });
    searchIterations += r.iterations;
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
    for (let k = 5; k <= 100; k++) grid.push(k / 10);
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
  const r = best.r;
  return {
    ok: true,
    D1: best.D1,
    ct: r.ct,
    surfaces: r.surfaces,
    binding: r.binding,
    iterations: r.iterations,
    maxThickness: r.maxThickness,
    evaluations,
    searchIterations,
    seedMaxThickness,
    coarseD1,
    coarseMaxThickness,
  };
}
