// 03-12 (D-22, VIZ-05; UI-SPEC "Heatmap colours"): the cividis colour LUT, shared by the heat
// shader (heat.js) and the legend (legend.js), so the map and its legend cannot disagree (T-03-30).
// Pure, no imports.
//
// Source: Nuñez J. R., Anderton C. R., Renslow R. S. (2018), "Optimizing colormaps with
// consideration for color vision deficiency to enable accurate interpretation of scientific data",
// PLOS ONE 13(7): e0199239. The 11 stops were read from matplotlib 3.11.2 `colormaps['cividis']`
// at t = 0,0 … 1,0 on 2026-11-08 (UI-SPEC). The LUT is interpolated linearly in sRGB between stops.
// Its luminance rises monotonically (cividis.test.js), so the map reads in greyscale too.

/** The 11 cividis stops (t = 0 … 1), sRGB hex. */
export const CIVIDIS_HEX = Object.freeze([
  '#00224e',
  '#083370',
  '#35456c',
  '#4f576c',
  '#666970',
  '#7d7c78',
  '#948e77',
  '#aea371',
  '#c8b866',
  '#e5cf52',
  '#fee838',
]);

const STOPS = CIVIDIS_HEX.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

/**
 * Raw sRGB 0…1 floats, 11 × rgb (33 values) for the shader uniform. NOT linearised: three.js
 * Color would convert hex to linear under ColorManagement, and the heat shader writes these values
 * unchanged to the sRGB canvas (no colorspace / tone-mapping step), so pixel = legend colour.
 */
export const CIVIDIS_UNIFORM = new Float32Array(STOPS.flat().map((c) => c / 255));

/**
 * cividis at u ∈ [0, 1] (clamped), linear interpolation in sRGB between the stops.
 * @param {number} u @returns {[number, number, number]} channels 0…255 (not rounded)
 */
export function cividisRGB(u) {
  const x = Math.min(1, Math.max(0, u)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return /** @type {[number, number, number]} */ ([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f));
}

/** UI-SPEC: iso lines are white where the LUT position u < 0,5, else #1a1a1a (min 4,17:1). */
export const ISO_SWITCH_U = 0.5;

/** @param {number} u LUT position @returns {'#ffffff' | '#1a1a1a'} */
export function isoLineColour(u) {
  return u < ISO_SWITCH_U ? '#ffffff' : '#1a1a1a';
}
