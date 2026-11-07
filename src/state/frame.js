// Frame rules for the lay input (02-04, FRAME-02, D-06). Pure and DOM-free.
import { SHAPES } from '../engine/frame/shapes.js';

// Design default, always labelled "angenommen" in the UI (D-06, RESEARCH Open Q1): 32 mm per eye
// = 64 mm binocular = the ANSUR 2012 male mean 64,0 mm, about 0,6 SD above the female mean
// 61,7 mm (via Wikipedia "Pupillary distance"). US Army sample, not DACH.
export const PD_DEFAULT_MM = 32;

// FRAME-02 (REQUIREMENTS.md verbatim): A 40–62, B 28–55, DBL 14–24 mm.
export const FRAME_RANGES = Object.freeze({
  A: Object.freeze([40, 62]),
  B: Object.freeze([28, 55]),
  DBL: Object.freeze([14, 24]),
});

/**
 * Glashöhe B from the shape's default aspect ratio, in whole mm. Design rule: B is rarely on the
 * temple (UI-SPEC tip B), so it follows A until the user types it.
 * @param {string} shape SHAPES id @param {number} A
 */
export function estimateB(shape, A) {
  if (!Object.hasOwn(SHAPES, shape)) throw new Error(`estimateB: unknown shape ${shape}`);
  const d = SHAPES[shape].defaults;
  return Math.round((A * d.B) / d.A);
}
