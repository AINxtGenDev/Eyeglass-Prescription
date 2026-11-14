// D-12 quality tiers (03-08; UI-SPEC "Quality tiers", thresholds are [BP] design values). Pure:
// no globals and no dependencies; the caller passes `coarse` (primary pointer) and `minScreen`
// (min of the screen width and height, CSS px), so the logic runs in Node.
//
// Geometry resolution is identical in every tier: the one tessellation (topology.js) is never
// reduced, and its vertices are exact. Its sag error between vertices is measured, not proven for
// every input (mesh/tessellation.test.js, 03-LC M1, full grid scan): ≤ 0,01 mm (≤ 0,025 mm for
// custom nₑ < 1,49) for every scanned lens up to etMax 31 mm; above that up to 0,0174 mm below
// etMax 35 mm and ≥ 0,117 mm above (etMax 58,6 mm). A tier only changes the pixel ratio, the
// transmission render target scale, dispersion and the chart texture size; realism degrades,
// correctness never does.

/** Phones: a coarse primary pointer and a screen whose shorter side is below this (CSS px). */
const PHONE_MAX_SIDE = 768;

const freeze = (s) => Object.freeze({ ...s, chart: Object.freeze(s.chart) });

/** Per tier: pixel ratio cap, transmissionResolutionScale, dispersion on/off, chart texture size. */
export const TIER_SETTINGS = Object.freeze({
  hoch: freeze({ pixelRatioMax: 2, transmissionScale: 1, dispersion: true, chart: [2048, 1366] }),
  mittel: freeze({ pixelRatioMax: 1.5, transmissionScale: 0.5, dispersion: false, chart: [1024, 683] }),
  sparsam: freeze({ pixelRatioMax: 1, transmissionScale: 0.35, dispersion: false, chart: [1024, 683] }),
});

/**
 * Start tier: 'mittel' on phones (coarse primary pointer AND shorter screen side < 768), else 'hoch'.
 * @param {{ coarse: boolean, minScreen: number }} o
 * @returns {'hoch' | 'mittel'}
 */
export function pickTier({ coarse, minScreen }) {
  return coarse && minScreen < PHONE_MAX_SIDE ? 'mittel' : 'hoch';
}

/**
 * One step down at runtime (hoch → mittel → sparsam); sparsam stays sparsam.
 * @param {'hoch' | 'mittel' | 'sparsam'} tier
 */
export function stepDown(tier) {
  return tier === 'hoch' ? 'mittel' : 'sparsam';
}

/**
 * MeshPhysicalMaterial.dispersion for a tier and an Abbe number. KHR_materials_dispersion defines
 * dispersion = 20 / V_d. The project stores νe (e-line, 01-13), not νd, so 20 / νe is an
 * approximation, labelled so in Technische Angaben (RESEARCH A10). Only the hoch tier shows it; a
 * material without an Abbe number (custom material, νe null) gets 0.
 * @param {string} tier
 * @param {number | null | undefined} abbe νe
 */
export function dispersionFor(tier, abbe) {
  if (!TIER_SETTINGS[tier]?.dispersion || typeof abbe !== 'number' || !(abbe > 0)) return 0;
  return 20 / abbe;
}

// 04-10 (D-15, REF-02): the Durchblick grid tiers (cell and leaf sizes: REF_GRID_TIERS in
// engine/warp.js, fixed by P0). They share the word 'mittel' with the quality tiers above but are a
// separate table (PATTERNS bite 10): a grid tier is never passed to stepDown, a quality tier never
// to refStepDown.

/** Grid tiers from fine to coarse. */
export const REF_TIER_ORDER = Object.freeze(/** @type {const} */ (['fein', 'mittel', 'grob']));

/**
 * The grid start tier from the device class: 'fein' on 'hoch', else 'mittel' (phones start one step
 * down; 04-05: the Grenzfall Rx on fein costs about 56 ms in Node, about 4 × that on a mid phone).
 * @param {'hoch' | 'mittel' | 'sparsam'} qualityTier
 * @returns {'fein' | 'mittel'}
 */
export function refStartTier(qualityTier) {
  return qualityTier === 'hoch' ? 'fein' : 'mittel';
}

/**
 * 04-16 (lens-critic MAJOR 2): the Durchblick chart texture side (px) for the grid start tier, capped
 * by the device limit. The phone start tier (mittel) gets 2048² (16 MB canvas, about 22 MB GPU with
 * mipmaps) instead of 4096² (64 MB, about 89 MB); fein (the hoch device class) keeps 4096².
 * @param {'fein' | 'mittel' | 'grob'} startTier
 * @param {number} maxTextureSize renderer.capabilities.maxTextureSize
 */
export function refChartPx(startTier, maxTextureSize) {
  return Math.min(startTier === 'fein' ? 4096 : 2048, maxTextureSize);
}

/**
 * One grid tier down (fein → mittel → grob); grob stays grob.
 * @param {'fein' | 'mittel' | 'grob'} tier
 */
export function refStepDown(tier) {
  return tier === 'fein' ? 'mittel' : 'grob';
}
