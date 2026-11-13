// Durchblick size block #view-ref-size (04-08 / 04-09, D-05; UI-SPEC "Size block", States "No
// WebGL 2 / 3D chunk failed"). Engine text only (LensResult.magnification through text.js
// refSizeBlock), written with textContent (T-04-34). No three.js and no warp: pipeline.js imports
// this for the no-chunk fallback, so the size block is shown even when the 3D chunk never loads
// (T-04-39).
import { t } from '../../i18n/t.js';
import { fmtMm } from '../../i18n/format.js';
import { EYE_POINT_MM } from '../../engine/magnification.js';
import { refSizeBlock } from './text.js';

const EYES = /** @type {const} */ (['OD', 'OS']);

/**
 * The size block for the painted results, or null when no eye is computed (the block is hidden).
 * @param {{ OD?: any, OS?: any } | null | undefined} eyes view inputs' eyes ({ result, frame } | null)
 * @param {{ picture?: boolean, compare?: boolean, rimInField?: boolean, pastRimInField?: boolean }} opts
 */
export function refBlockFor(eyes, opts) {
  const entries = EYES.map((eye) => {
    const r = eyes?.[eye]?.result;
    const mag = r?.ok ? r.magnification : null;
    // refSizeBlock only asks whether there is a cylinder: two meridians exist exactly then.
    return { who: /** @type {'od'|'os'} */ (eye.toLowerCase()), mag, cyl: mag ? mag.meridians.length - 1 : 0 };
  });
  return entries.some((e) => e.mag) ? refSizeBlock(entries, opts) : null;
}

/** Write a block from refBlockFor into #view-ref-size (null hides it). */
export function writeRefSize(el, b) {
  el.hidden = b === null;
  if (b === null) {
    el.replaceChildren();
    return;
  }
  const p = (cls, text) => {
    const n = document.createElement('p');
    n.className = cls;
    n.textContent = text;
    return n;
  };
  const nodes = [p('ref-title', b.title)];
  for (const e of b.entries) {
    nodes.push(p('ref-line', e.head));
    if (e.kind === 'cyl') {
      const ul = document.createElement('ul');
      ul.className = 'ref-dirs';
      for (const d of e.dirs) {
        const li = document.createElement('li');
        li.textContent = d;
        ul.append(li);
      }
      nodes.push(ul);
    }
  }
  for (const n of b.notes) nodes.push(p('ref-note small', n));
  el.replaceChildren(...nodes);
}

let noPictureKey = '';

/**
 * No picture possible (no WebGL 2, or the 3D chunk failed): #view-ref shows only the size block and
 * the no-picture scope sentence; no edge, weak or rim note (they talk about the picture).
 * @param {{ OD?: any, OS?: any } | null | undefined} eyes
 */
export function showRefNoPicture(eyes) {
  const ref = /** @type {HTMLElement} */ (document.getElementById('view-ref'));
  ref.hidden = false;
  ref.classList.add('view-ref--nopicture');
  for (const id of ['view-ref-lens', 'view-ref-eye', 'view-ref-side']) /** @type {HTMLElement} */ (document.getElementById(id)).hidden = true;
  const scope = /** @type {HTMLElement} */ (document.getElementById('view-ref-scope'));
  const text = t('view.ref.scope.noPicture', { h: fmtMm(EYE_POINT_MM) });
  if (scope.textContent !== text) scope.textContent = text;
  const b = refBlockFor(eyes, { picture: false });
  const key = JSON.stringify(b);
  if (key === noPictureKey) return;
  noPictureKey = key;
  writeRefSize(/** @type {HTMLElement} */ (document.getElementById('view-ref-size')), b);
}

/** The 3D view came up after all (a successful retry): back to the normal Durchblick block, hidden. */
export function hideRefNoPicture() {
  const ref = /** @type {HTMLElement} */ (document.getElementById('view-ref'));
  if (!ref.classList.contains('view-ref--nopicture')) return;
  ref.classList.remove('view-ref--nopicture');
  ref.hidden = true;
  noPictureKey = '';
  for (const id of ['view-ref-lens', 'view-ref-side']) /** @type {HTMLElement} */ (document.getElementById(id)).hidden = false;
}
