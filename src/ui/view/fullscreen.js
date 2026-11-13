// Fullscreen toggle for the 3D view (user request 2026-11-10): the button in the stage's top-right
// corner shows the stage alone on the whole screen; the same button (or Esc) returns.
// The Fullscreen API is used where the browser offers it for elements. Where it does not (iPhone
// Safari only supports it for <video>) or refuses, the stage is pinned over the page with CSS
// (.view-stage--fs). The canvas follows either way through the scene's ResizeObserver.
// 04-12 (F-02): while fullscreen is on, the current mode's info blocks (blocks()) are MOVED into
// `info` (#view-fs-info, the stage's second grid row) and moved back on exit; never cloned, so IDs,
// labels and aria stay unique (view-place.js is the precedent). They are inside the stage, so the
// inert handling below leaves them operable; Tab goes fullscreen button → info-panel controls.
import { t } from '../../i18n/t.js';
import { icon } from '../icons.js';

/**
 * @param {{ stage: HTMLElement, button: HTMLButtonElement, info: HTMLElement, blocks: () => HTMLElement[],
 *   onChange: (on: boolean) => void }} o
 * @returns {{ isOn: () => boolean, refresh: () => void }}
 */
export function createFullscreen({ stage, button, info, blocks, onChange }) {
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
  /** @type {{ el: HTMLElement, parent: Node, next: Node | null }[]} */
  let moved = [];
  // A moved node loses focus when it leaves the document for its new place: keep it on the control.
  const keepFocus = (fn) => {
    const a = document.activeElement;
    fn();
    if (a instanceof HTMLElement && a !== document.activeElement && a.isConnected) a.focus({ preventScroll: true });
  };
  // The panel scrolls when its text is taller than 40 % of the screen. Text after the last control
  // (the size block) is then out of keyboard reach, and axe's scrollable-region-focusable fails a
  // panel with no control at all (Dickenkarte at a large font): while it overflows, the panel itself
  // is a Tab stop, so the arrow keys scroll it.
  const syncScroll = () => {
    const scrolls = !info.hidden && info.scrollHeight > info.clientHeight + 1;
    if (scrolls !== info.hasAttribute('tabindex')) {
      if (scrolls) info.setAttribute('tabindex', '0');
      else info.removeAttribute('tabindex');
    }
  };
  const sizes = new ResizeObserver(syncScroll);
  const moveIn = () => {
    const list = blocks();
    moved = list.map((el) => ({ el, parent: /** @type {Node} */ (el.parentNode), next: el.nextSibling }));
    for (const el of list) info.append(el);
    info.hidden = list.length === 0;
    for (const el of [info, ...list]) sizes.observe(el);
    syncScroll();
  };
  // Reverse order: each node goes back before its remembered next sibling, which is already home
  // again if it was moved too (or is still in place).
  const moveOut = () => {
    for (const { el, parent, next } of moved.reverse()) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    moved = [];
    info.hidden = true;
    sizes.disconnect();
    syncScroll();
  };
  const set = (next) => {
    if (next === state) return;
    const wasOn = state !== 'off';
    const wasCss = state === 'css';
    state = next;
    // In before the page behind goes inert, out after it is live again (focus can follow the node).
    if (!wasOn && next !== 'off') keepFocus(moveIn);
    stage.classList.toggle('view-stage--fs', state === 'css');
    document.documentElement.classList.toggle('view-fs-open', state === 'css');
    setInert(state === 'css');
    if (wasOn && next === 'off') keepFocus(moveOut);
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
  return {
    isOn: () => state !== 'off',
    /** A mode change while fullscreen: the old mode's blocks go home, the new mode's blocks come in. */
    refresh: () => {
      if (state === 'off') return;
      keepFocus(() => {
        moveOut();
        moveIn();
      });
    },
  };
}
