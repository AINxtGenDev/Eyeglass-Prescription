// Preset data (02-09, RES-05, D-26, D-27, UI-SPEC "Preset data"): one definition for the example
// at load and the chip rows. Values are field text in paper form, so applying a preset runs the
// same parse → validate → transpose → compute path as typing (T-02-25). Labels are dictionary
// keys (preset.rx.<id>, preset.frame.<id>); this module holds no German text.
// Engine values (CR-39, Rechteckig 52×38/18, PD 32 / 31,5) are pinned in e2e/presets.spec.js.

const eye = (sph, cyl = '', axis = '') => Object.freeze({ sph, cyl, axis });

// Example at load: a moderate myope with a small cylinder (Rechteckig, stamp 52□18 140, CR-39).
export const EXAMPLE = Object.freeze({
  od: Object.freeze({ sph: '-2,75', cyl: '-0,50', axis: '180', pd: '32' }),
  os: Object.freeze({ sph: '-2,50', cyl: '-0,75', axis: '170', pd: '31,5' }),
});

/** Rx chips in display order; PD is never part of a preset (it is kept). */
export const RX_PRESETS = Object.freeze([
  // Leicht kurzsichtig: weak minus.
  Object.freeze({ id: 'leicht', od: eye('-1,25'), os: eye('-1,00') }),
  // Stark kurzsichtig: thick edges; the material comparison shows a clear gain.
  Object.freeze({ id: 'stark', od: eye('-6,50', '-0,75', '10'), os: eye('-6,00', '-0,50', '170') }),
  // Weitsichtig: plus, thick centre.
  Object.freeze({ id: 'weit', od: eye('+3,00'), os: eye('+2,75') }),
  // Hornhautverkrümmung: the cylinder dominates; principal meridians in the Experten-Ansicht.
  Object.freeze({ id: 'hhv', od: eye('-0,50', '-2,00', '180'), os: eye('-0,75', '-1,75', '10') }),
]);

/** Frame chips: A and DBL only; the shape is kept and B follows it (estimateB). */
export const FRAME_PRESETS = Object.freeze([
  // Klein: a small frame, 48□18.
  Object.freeze({ id: 'klein', A: '48', DBL: '18' }),
  // Mittel: the example size, 52□18.
  Object.freeze({ id: 'mittel', A: '52', DBL: '18' }),
  // Groß: a large frame, 56□18.
  Object.freeze({ id: 'gross', A: '56', DBL: '18' }),
]);
