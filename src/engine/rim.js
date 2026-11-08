// FRAME-02 rim depth (02-11, RESEARCH D-13 as changed): helpers, not LensSpec fields, because
// the rim depth changes neither thickness, weight nor power. Pure: imports only engine modules.
// 03-01 (VIZ-03, D-05): the front/back split of the edge beyond the rim is modelled here
// (bevelSplit) and the lead of the front surface over the rim (frontLeadMm); the 3D rim placement
// uses bevelApexMm (03-03).
import { frontSagAt } from './design.js';
import { thicknessAt } from './metrics.js';

// [ASSUMED, RESEARCH A2] design constant, no citable value; shown as 'angenommener Wert'.
export const RIM_DEPTH_DEFAULT_MM = 3.0;

// Bevel apex distance from the lens front as a fraction of the edge thickness t. The three
// criteria are the ones named in Essilor US 8 388 133 B2 (patents.google.com/patent/US8388133):
// "front curve tracing" (apex on the front edge: 'front' = 0), "1:1" (apex midway: 1/2) and
// "1:2" (apex-to-front = ½ apex-to-rear: 1/3).
export const BEVEL_RULES = Object.freeze({ '1:2': 1 / 3, '1:1': 1 / 2, front: 0 });

// [ASSUMED, 03-RESEARCH A2: which criterion a lab uses is the lab's choice; one rule for all
// lenses per user decision 2026-11-08]
export const BEVEL_RULE = '1:2';

/**
 * Bevel apex distance from the lens front edge, mm.
 * @param {number} t edge thickness at the point, mm
 * @param {string} [rule] key of BEVEL_RULES
 * @returns {number}
 */
export function bevelApexMm(t, rule = BEVEL_RULE) {
  if (!Object.hasOwn(BEVEL_RULES, rule)) throw new Error(`bevelApexMm: unknown bevel rule ${rule}`);
  return t * BEVEL_RULES[rule];
}

/**
 * How far an edge of thickness t stands out of the rim at the front and at the back, mm.
 * Assumption A1 (03-RESEARCH): the eyewire groove is centred in the rim depth, so the rim spans
 * the bevel apex ± D/2.
 * @param {number} t edge thickness, mm (the UI passes metrics.etMax.value)
 * @param {number} rimDepthMm D
 * @param {string} [rule] key of BEVEL_RULES
 * @returns {{ front: number, back: number }} each ≥ 0; 0 = flush on that side
 */
export function bevelSplit(t, rimDepthMm, rule = BEVEL_RULE) {
  const b = bevelApexMm(t, rule);
  const h = rimDepthMm / 2;
  return { front: Math.max(0, b - h), back: Math.max(0, t - b - h) };
}

/**
 * How far the lens front vertex (z = 0, conventions.js) stands ahead of the rim's front face,
 * measured at the outline point where the rim sits furthest back (rim front face
 * z_i = −sF_i − bevelApexMm(t_i) + D/2, assumption A1). Negative = the vertex stays behind the rim
 * front face everywhere. This is not metrics.frontProtrusion, which is the plain front sag over
 * the outline and ignores the bevel and the rim depth.
 * @param {object|null} s LensResult.surfaces
 * @param {ArrayLike<number>} outline x,y pairs (frameOutline)
 * @param {number} rimDepthMm D
 * @param {string} [rule] key of BEVEL_RULES
 * @returns {{ value: number, index: number }} index = outline vertex of the max (ties → lower)
 */
export function frontLeadMm(s, outline, rimDepthMm, rule = BEVEL_RULE) {
  if (s == null) return { value: NaN, index: -1 };
  if (outline.length % 2 !== 0) throw new Error('frontLeadMm: outline must hold x,y pairs');
  let kMax = -Infinity;
  let index = -1;
  for (let i = 0; i < outline.length / 2; i++) {
    const x = outline[2 * i];
    const y = outline[2 * i + 1];
    const k = frontSagAt(s, x, y) + bevelApexMm(thicknessAt(s, x, y), rule);
    if (k > kMax) {
      kMax = k;
      index = i;
    }
  }
  return { value: kMax - rimDepthMm / 2, index };
}
