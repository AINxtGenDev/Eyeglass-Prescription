// Fullscreen toggle for the 3D view (user request 2026-11-10): the button in the stage's top-right
// corner shows the stage alone on the whole screen; the same button (or Esc) returns.
// The Fullscreen API is used where the browser offers it for elements. Where it does not (iPhone
// Safari only supports it for <video>) or refuses, the stage is pinned over the page with CSS
// (.view-stage--fs). The canvas follows either way through the scene's ResizeObserver.
import { t } from '../../i18n/t.js';
import { icon } from '../icons.js';

/**
 * @param {{ stage: HTMLElement, button: HTMLButtonElement, onChange: (on: boolean) => void }} o
 * @returns {{ isOn: () => boolean }}
 */
export function createFullscreen({ stage, button, onChange }) {
  const api = document.fullscreenEnabled === true && typeof stage.requestFullscreen === 'function';
  /** 'off' | 'api' | 'css' */
  let state = 'off';

  const paint = () => {
    const on = state !== 'off';
    button.querySelector('svg')?.remove();
    button.prepend(icon(on ? 'collapse' : 'expand'));
    const label = t(on ? 'view.fullscreen.exit' : 'view.fullscreen.enter');
    // title alone: the tooltip and the accessible name (an equal aria-label made it the description too).
    button.setAttribute('title', label);
  };
  // CSS fallback: the page behind the overlay is still in the DOM, so Tab and a screen reader
  // would reach controls nobody can see (WCAG 2.4.11). Every sibling on the path from the stage
  // to <body> is made inert while the overlay is up (the Fullscreen API does this by itself).
  // Ancestors stay live, so a focusable one (the desktop results column is a tabindex="0" scroll
  // region) is taken out of the Tab order too and restored on exit.
  /** @type {HTMLElement[]} */
  let inerted = [];
  /** @type {[HTMLElement, string][]} */
  let untabbed = [];
  const setInert = (on) => {
    if (!on) {
      for (const el of inerted) el.inert = false;
      for (const [el, v] of untabbed) el.setAttribute('tabindex', v);
      inerted = [];
      untabbed = [];
      return;
    }
    for (let node = stage; node && node !== document.body; node = node.parentElement) {
      const up = node.parentElement;
      if (up && up !== document.body && up.hasAttribute('tabindex')) {
        untabbed.push([up, /** @type {string} */ (up.getAttribute('tabindex'))]);
        up.setAttribute('tabindex', '-1');
      }
      for (const sib of up?.children ?? []) {
        if (sib !== node && sib instanceof HTMLElement && !sib.inert) {
          sib.inert = true;
          inerted.push(sib);
        }
      }
    }
  };
  const set = (next) => {
    if (next === state) return;
    const wasOn = state !== 'off';
    const wasCss = state === 'css';
    state = next;
    stage.classList.toggle('view-stage--fs', state === 'css');
    document.documentElement.classList.toggle('view-fs-open', state === 'css');
    setInert(state === 'css');
    if (wasCss && state === 'off' && (document.activeElement === document.body || stage.contains(document.activeElement))) {
      button.focus({ preventScroll: true });
    }
    paint();
    if (wasOn !== (state !== 'off')) onChange(state !== 'off');
  };

  if (api) {
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement === stage) set('api');
      else if (state === 'api') set('off');
    });
  }
  document.addEventListener('keydown', (e) => {
    if (state === 'css' && e.key === 'Escape') set('off');
  });
  // The stage starts a camera drag (OrbitControls, pointer capture) on pointerdown: a press on the
  // button must stay a button press.
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', () => {
    if (state === 'api') document.exitFullscreen().catch(() => set('off'));
    else if (state === 'css') set('off');
    else if (api) stage.requestFullscreen().catch(() => set('css'));
    else set('css');
  });

  paint();
  button.hidden = false;
  return { isOn: () => state !== 'off' };
}
