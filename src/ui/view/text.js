// 03-11 view text (D-19, D-29; UI-SPEC "Protrusion #view-protrusion" and "Canvas accessible name",
// Revision 1 R1-7). Pure: imports only the engine rim helpers, t() and format.js, so every string
// is tested in Node. It formats and decides; it computes no geometry: the caller passes etMax
// (LensResult.metrics.etMax.value) and lead (frontLeadMm(...).value from the same engine helper
// and rim depth as the Expert rim lines in frame-input.js paintRim).
import { bevelSplit } from '../../engine/rim.js';
import { END_LABEL_TOL_DEG } from '../../engine/profile.js';
import { t } from '../../i18n/t.js';
import { fmtMm, fmtAxis, fmtPercent } from '../../i18n/format.js';

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
export function protrusionLines(eyes, display) {
  return block(
    EYES.filter((e) => eyes[e]).map((e) => [t(PROTRUSION_EYE[e]), eyes[e]]),
    display,
  );
}

/**
 * lens-critic M2 (03-LC): the block during a comparison, for the compared eye only: a 'Vorher (A)'
 * pair and a 'Nachher (B)' pair (labels = the comparison table headings cmp.cfg.col.*), same rule.
 * @param {{ A: { etMax: number, lead: number } | null, B: { etMax: number, lead: number } | null }} cfg
 *   null = not computed (A while it is still computing: only the B pair)
 * @param {{ rimDepthMm: number, rimAssumed: boolean }} display
 */
export function protrusionCompareLines(cfg, display) {
  const rows = [];
  if (cfg.A) rows.push([t('cmp.cfg.col.a'), cfg.A]);
  if (cfg.B) rows.push([t('cmp.cfg.col.b'), cfg.B]);
  return block(rows, display);
}

/** @param {[string, { etMax: number, lead: number }][]} rows label + values, in display order */
function block(rows, { rimDepthMm, rimAssumed }) {
  const lines = [];
  const leads = [];
  for (const [eye, v] of rows) {
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

// ── 04-01 Durchblick size block (REF-01, D-05, D-07; UI-SPEC "Size block #view-ref-size", "Rules
// [BP]", "Canvas accessible name in Durchblick", N6, N7). Every value comes from
// LensResult.magnification (engine magnification.js); nothing here computes optics.

/** UI-SPEC weak-lens note, raised from 1,2 to 1,3 per lens-critic N6 (+0,75 CR-39 in 62×55 reads 1,3 % at under 3 px). */
export const WEAK_NOTE_MAX_PCT = 1.3;

const NBSP = '\u00a0';
const SAME_PCT = '0,0' + NBSP + '%';

/**
 * Direction words for a principal meridian θ (TABO 1…180; 0 ≡ 180), first match wins. The 15° band
 * equals END_LABEL_TOL_DEG in src/engine/profile.js (exactly 15° off counts as oblique, as there).
 * The oblique path uses the on-screen angle φ = 180° − θ: the wearer looks from behind, so x is
 * mirrored (D-07, RESEARCH Pitfall 1).
 * @param {number} deg
 */
export function refDirWords(deg) {
  const th = deg === 0 ? 180 : deg;
  const kind = dirKind(th);
  if (kind === 'v' || kind === 'h') return t(`view.ref.dir.${kind}`);
  const d = fmtAxis(th);
  if (kind !== 'obl') return t(`view.ref.dir.${kind}`, { deg: d });
  const phi = 180 - th;
  return t('view.ref.dir.obl', { deg: d, path: t(phi < 90 ? 'view.ref.path.rise' : 'view.ref.path.fall') });
}

/** @param {number} th TABO 1…180 @returns {'v'|'h'|'nearV'|'nearH'|'obl'} */
function dirKind(th) {
  if (th === 90) return 'v';
  if (th === 180) return 'h';
  const off = Math.abs(th - 90);
  if (off < END_LABEL_TOL_DEG) return 'nearV';
  if (th < END_LABEL_TOL_DEG || th > 180 - END_LABEL_TOL_DEG) return 'nearH';
  return 'obl';
}

/** The change words for one meridian; the word follows the engine sign of SM − 1, never F (M3). */
function change(sm) {
  const pct = fmtPercent(Math.abs(sm - 1));
  if (pct === SAME_PCT) return { text: t('view.ref.chg.same'), pct, larger: false };
  return { text: t(sm < 1 ? 'view.ref.chg.smaller' : 'view.ref.chg.larger', { pct }), pct, larger: sm > 1 };
}

/** fmtPercent string → number, or Infinity for a whole-percent value (≥ 3 %). */
const pctValue = (pct) => (pct.includes(',') ? Number(pct.slice(0, -2).replace(',', '.')) : Infinity);

/**
 * The size block #view-ref-size.
 * @param {Array<{ who: 'od'|'os'|'a'|'b', mag: { meridians: Array<{ deg: number|null, F: number, sm: number }> } | null,
 *   cyl: number }>} entries in display order (OD then OS, A then B); mag null = blocked / not computed
 * @param {{ picture?: boolean, compare?: boolean, rimInField?: boolean, pastRimInField?: boolean }} [opts]
 *   picture = the Durchblick picture is shown; rimInField / pastRimInField from the warp of the shown panels
 * @returns {{ title: string, entries: Array<{ who: string, blocked: boolean, kind: 'line'|'cyl', head: string,
 *   dirs: string[], joined: string }>, notes: string[] }}
 */
export function refSizeBlock(entries, { picture = false, compare = false, rimInField = false, pastRimInField = false } = {}) {
  const out = [];
  let computed = 0;
  let weak = true;
  let cylForm = false;
  let cylSame = false;
  let oblique = false;
  let shape = false;
  for (const { who, mag, cyl } of entries) {
    const whoText = t(`view.ref.who.${who}`);
    if (mag == null) {
      const head = t('view.ref.blocked', { who: whoText });
      out.push({ who, blocked: true, kind: 'line', head, dirs: [], joined: head });
      continue;
    }
    computed++;
    const ms = mag.meridians;
    const chgs = ms.map((m) => change(m.sm));
    ms.forEach((m, i) => {
      if (pctValue(chgs[i].pct) > WEAK_NOTE_MAX_PCT) weak = false;
      if (chgs[i].larger && m.F <= 0) shape = true;
    });
    if (ms.length === 1 || chgs[0].text === chgs[1].text) {
      if (ms.length === 2 && cyl !== 0) cylSame = true;
      const head = t('view.ref.line', { who: whoText, chg: chgs[0].text });
      out.push({ who, blocked: false, kind: 'line', head, dirs: [], joined: head });
      continue;
    }
    cylForm = true;
    const dirWords = ms.map((m) => refDirWords(m.deg));
    if (ms.some((m) => dirKind(m.deg === 0 ? 180 : m.deg) === 'obl')) oblique = true;
    out.push({
      who,
      blocked: false,
      kind: 'cyl',
      head: t('view.ref.lineCyl.head', { who: whoText }),
      dirs: ms.map((m, i) => t('view.ref.lineCyl.dir', { dir: dirWords[i], chg: chgs[i].text })),
      joined: t('view.ref.lineCyl', { who: whoText, dir1: dirWords[0], chg1: chgs[0].text, dir2: dirWords[1], chg2: chgs[1].text }),
    });
  }
  const notes = [];
  if (picture) notes.push(t('view.ref.edge'));
  if (picture && rimInField) notes.push(t('view.ref.rimNote'));
  if (picture && rimInField && pastRimInField) notes.push(t('view.ref.rimPastNote'));
  if (picture && computed > 0 && weak) notes.push(t('view.ref.weakNote'));
  if (cylForm) notes.push(t('view.ref.cylNote'));
  if (cylSame) notes.push(t('view.ref.cylSameNote'));
  if (oblique) notes.push(t('view.ref.axisNote'));
  if (shape) notes.push(t('view.ref.shapeNote'));
  if (compare) notes.push(t('view.ref.abNote'));
  return { title: t('view.ref.size.title'), entries: out, notes };
}

/**
 * The accessible name of #view-canvas in Durchblick, from the same joined size strings.
 * @param {{ lens: 'on'|'off', layout: 'two'|'one'|'compare', eye: 'od'|'os',
 *   entries: Array<{ joined: string }> }} o eye = the shown eye for 'one' and 'compare'
 */
export function refAria({ lens, layout, eye, entries }) {
  const layoutText =
    layout === 'two'
      ? t('view.aria.ref.layout.two')
      : layout === 'one'
        ? t('view.aria.ref.layout.one', { side: t(`view.aria.ref.side.${eye}`) })
        : t('view.aria.ref.layout.compare', { who: t(`view.ref.who.${eye}`) });
  const lines = entries.map((e) => e.joined + '.').join(' ');
  return t('view.aria.ref', { lens: t(`view.aria.ref.lens.${lens}`), layout: layoutText, lines }).trim();
}
