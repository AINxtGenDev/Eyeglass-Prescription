// 03-11 view text (D-19, D-29; UI-SPEC "Protrusion #view-protrusion" and "Canvas accessible name",
// Revision 1 R1-7). Pure: imports only the engine rim helpers, t() and format.js, so every string
// is tested in Node. It formats and decides; it computes no geometry: the caller passes etMax
// (LensResult.metrics.etMax.value) and lead (frontLeadMm(...).value from the same engine helper
// and rim depth as the Expert rim lines in frame-input.js paintRim).
import { bevelSplit } from '../../engine/rim.js';
import { t } from '../../i18n/t.js';
import { fmtMm } from '../../i18n/format.js';

/**
 * A protrusion or lead counts only from 0,05 mm on, so a shown '0,0 mm' never appears (UI-SPEC:
 * 'bündig' = ≤ 0,05 mm, half the 0,1 mm display resolution). Same rule as frame-input paintRim
 * (RIM_FLUSH_MM there; text.test.js asserts that they agree).
 */
export const PROTRUSION_FLUSH_MM = 0.05;

const EYES = /** @type {const} */ (['OD', 'OS']);
const PROTRUSION_EYE = { OD: 'view.protrusion.eye.od', OS: 'view.protrusion.eye.os' };
const ARIA_EYE = { OD: 'view.aria.eye.od', OS: 'view.aria.eye.os' };
const DASH = '–';
/** Frame sizes as on the compare status line (compare-view.js sizeNf): up to 1 decimal, de-AT. */
const sizeNf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

/**
 * Which protrusion sentence an edge gets (the paintRim rule): 'both' | 'front' | 'back' | 'none'.
 * @param {number} etMax thickest edge, mm @param {number} rimDepthMm
 */
export function protrusionKind(etMax, rimDepthMm) {
  const { front, back } = bevelSplit(etMax, rimDepthMm);
  const f = front >= PROTRUSION_FLUSH_MM;
  const b = back >= PROTRUSION_FLUSH_MM;
  return { kind: f && b ? 'both' : f ? 'front' : b ? 'back' : 'none', front, back };
}

/**
 * The protrusion block: one edge line and one lead line per computed eye.
 * @param {{ OD: { etMax: number, lead: number } | null, OS: { etMax: number, lead: number } | null }} eyes
 *   null = the eye is blocked or not computed (no lines)
 * @param {{ rimDepthMm: number, rimAssumed: boolean }} display
 * @returns {{ title: string, lines: string[], leads: string[], assumed: string | null, bevel: string }}
 *   lines / leads in eye order (OD first); assumed null when the rim depth is the user's own value
 */
export function protrusionLines(eyes, { rimDepthMm, rimAssumed }) {
  const lines = [];
  const leads = [];
  for (const e of EYES) {
    const v = eyes[e];
    if (!v) continue;
    const eye = t(PROTRUSION_EYE[e]);
    const { kind, front, back } = protrusionKind(v.etMax, rimDepthMm);
    lines.push(t(`view.protrusion.${kind}`, { eye, front: fmtMm(front), back: fmtMm(back) }));
    leads.push(
      v.lead >= PROTRUSION_FLUSH_MM ? t('view.protrusion.lead', { eye, lead: fmtMm(v.lead) }) : t('view.protrusion.leadNone', { eye }),
    );
  }
  return {
    title: t('view.protrusion.title'),
    lines,
    leads,
    assumed: rimAssumed ? t('view.protrusion.assumed', { rim: fmtMm(rimDepthMm) }) : null,
    // D-05 found no citable bevel rule for all labs (rim.js BEVEL_RULE is [ASSUMED]).
    bevel: t('view.protrusion.bevelAssumed'),
  };
}

/**
 * The accessible name of #view-canvas (D-29). Every number and location word is a string already
 * painted on the result card (results.js cardStrings); nothing is formatted again here except the
 * frame sizes, which come from the inputs.
 * @param {{ viewName: string, OD: { thick: string, thickLoc: string, ct: string } | null,
 *   OS: { thick: string, thickLoc: string, ct: string } | null,
 *   frame: { shape: string, A: number, DBL: number } | null, material: string }} o
 *   viewName = the translated view name (view.viewName.*); shape = the shape label (frame.shape.*)
 */
export function ariaGlass({ viewName, OD, OS, frame, material }) {
  const part = (e, c) =>
    c
      ? t('view.aria.eyeGlass', { eye: t(ARIA_EYE[e]), thick: c.thick, loc: c.thickLoc, ct: c.ct })
      : t('view.aria.eyeBlocked', { eye: t(ARIA_EYE[e]) });
  return t('view.aria.glass', {
    viewName,
    od: part('OD', OD),
    os: part('OS', OS),
    shape: frame ? frame.shape : DASH,
    A: frame ? sizeNf.format(frame.A) : DASH,
    DBL: frame ? sizeNf.format(frame.DBL) : DASH,
    material,
  });
}
