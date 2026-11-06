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
