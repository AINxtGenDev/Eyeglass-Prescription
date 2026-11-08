// Projected HTML labels over the 3D stage (03-06, VIZ-01; UI-SPEC States). A fixed pool of
// .view-label spans in #view-labels (aria-hidden: the cards carry the same facts as text).
// CSP / T-03-49: spans are made with createElement and filled with textContent; the position is a
// CSSOM transform write (element.style.transform), never a style attribute or markup.
// This slice uses the pool for the eye labels R / L (or '{eye} – nicht berechnet'); 03-13 adds the
// callouts with collision priority.
import { Vector3 } from 'three';

/**
 * @param {HTMLElement} container
 * @param {number} count pool size
 */
export function createLabels(container, count) {
  /** @type {HTMLSpanElement[]} */
  const pool = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'view-label';
    el.hidden = true;
    container.append(el);
    pool.push(el);
  }
  return {
    pool,
    /** Set a label's text (no write when unchanged); '' hides it, place() shows it. */
    setText(i, text) {
      const el = pool[i];
      if (el.textContent !== text) el.textContent = text;
      if (text === '') el.hidden = true;
    },
  };
}

const v = new Vector3();

/**
 * Project a world point to the stage and move the span there: the span's top edge is centred on
 * the point. Hidden when the point is outside the view volume or the span has no text.
 * 03-09: the span is kept inside the stage (shifted, never clipped). With the closer A1 default
 * fit a wide label such as 'L – nicht berechnet' under an outer lens would otherwise stick out of
 * a 328 px phone stage, which clips it (overflow: hidden).
 * @param {HTMLElement} el
 * @param {{ x: number, y: number, z: number }} world
 * @param {import('three').Camera} camera
 * @param {{ width: number, height: number }} size stage size in CSS px
 * @returns {boolean} whether the label is shown
 */
export function place(el, world, camera, size) {
  v.set(world.x, world.y, world.z).project(camera);
  const inside = Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && Math.abs(v.z) <= 1;
  el.hidden = !inside || el.textContent === '';
  if (el.hidden) return false;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = Math.min(Math.max(((v.x + 1) / 2) * size.width - w / 2, 0), Math.max(0, size.width - w));
  const y = Math.min(((1 - v.y) / 2) * size.height, Math.max(0, size.height - h));
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  return true;
}
