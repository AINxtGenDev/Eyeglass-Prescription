// D-12 quality tiers (03-08; UI-SPEC "Quality tiers", thresholds are [BP] design values). Pure:
// no globals and no dependencies; the caller passes `coarse` (primary pointer) and `minScreen`
// (min of the screen width and height, CSS px), so the logic runs in Node.
//
// Geometry resolution is identical in every tier: the tessellation that meets the D-04(c) 0,01 mm
// bound is never reduced. A tier only changes the pixel ratio, the transmission render target
// scale, dispersion and the chart texture size; realism degrades, correctness never does.

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
