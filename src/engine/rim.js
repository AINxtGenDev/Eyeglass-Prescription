// FRAME-02 rim depth (02-11, RESEARCH D-13 as changed): a helper, not a LensSpec field, because
// the rim depth changes neither thickness, weight nor power. Pure, imports nothing.

// [ASSUMED, RESEARCH A2] design constant, no citable value; shown as 'angenommener Wert'.
export const RIM_DEPTH_DEFAULT_MM = 3.0;

/**
 * How far the thickest edge point (etMax, never the centre) exceeds the rim depth, mm: the total
 * front + back excess at the etMax location. The front/back split needs a bevel model (phase 3,
 * VIZ-03).
 * @param {{ etMax: { value: number } }} metrics LensResult.metrics
 * @param {number} rimDepthMm
 * @returns {number} ≥ 0; 0 = the edge fits
 */
export function edgeBeyondRim(metrics, rimDepthMm) {
  return Math.max(0, metrics.etMax.value - rimDepthMm);
}
