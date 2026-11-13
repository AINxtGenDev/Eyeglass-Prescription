/* global __SW_KILL__ -- build-time constant, injected by vite.config.js `define` */
// 04-06 (D-18, D-22, D-25): the only place that registers the service worker, through the
// plugin's virtual module (never a hand-written serviceWorker registration call: wrong path and
// wrong scope on the shared origin). main.js loads this module with a dynamic import after the
// first result paint or on idle, so workbox-window stays out of the entry chunk. The logic lives
// in sw-core.js and handover.js (unit-tested); this file only binds it to the page.
// 04-14 (D-20, D-21, UI-SPEC "Update banner #app-update", "Input handover"): the banner, the
// confirmation after an update reload, and the plugin wiring. reloadWithHandover() of the 04-07
// controller is the only reload path: onNeedReload replaces the plugin's window.location.reload,
// and the controllerchange rule is installed when this module is evaluated (UI-SPEC "Order at
// module start"), before registerSW is called. Prompt mode, no mid-session engine swap: the
// waiting worker activates only after a click on "Aktualisieren" (SKIP_WAITING via updateSW).
// registerSW is called with the plugin's default immediate: false, so workbox-window registers
// on the load event at the earliest; that never delays the first result paint.
import { registerSW } from 'virtual:pwa-register';
import { t } from '../i18n/t.js';
import { $, setText } from './dom.js';
import { icon } from './icons.js';
import { wireRegistration, createUpdateController, installControllerChange } from './sw-core.js';
import { probe, writeHandover, snapshotForm } from './handover.js';

/** Below the desktop breakpoint (same query as summary-bar.js). */
const NARROW = '(max-width: 899.98px)';
/** Fields that open the on-screen keyboard on a phone (the banner hides while one has focus). */
const FIELD = 'input[type="text"], select, textarea';
const DONE_KEYS = { done: 'update.done', 'done.other': 'update.done.other', lost: 'update.done.lost' };

/** @type {ReturnType<typeof createUpdateController> | null} */
let controller = null;

// Order at module start (MINOR 9): capture hadController and install the listener now, so no
// controllerchange can fire before it exists. Another tab's "Aktualisieren" reloads this tab
// through the same handover path ('other').
installControllerChange(navigator, (origin) => (controller ? controller.reloadWithHandover(origin) : location.reload()));

/** 'update' (a version waits), 'confirm' (after an update reload) or null (hidden). */
let mode = null;
/** "Später" on this page: memory only, nothing stored (M8). */
let laterChosen = false;

const box = () => $('app-update');
const isShown = () => !box().hidden && box().getClientRects().length > 0;

/** Write the text into the empty-at-load live line on the next frame, so it is announced once. */
function announce(text) {
  const live = $('app-update-live');
  live.textContent = '';
  requestAnimationFrame(() => {
    live.textContent = text;
  });
}

/** Unhide the box with this body; the title only in update mode. */
function open(next, bodyText) {
  mode = next;
  const update = next === 'update';
  $('app-update-title').hidden = !update;
  setText('app-update-body', bodyText);
  $('app-update-apply').hidden = !update;
  $('app-update-later').hidden = !update;
  $('app-update-close').hidden = update;
  if (update) document.removeEventListener('input', closeOnEdit, true);
  else document.addEventListener('input', closeOnEdit, true);
  box().hidden = false;
  document.documentElement.classList.add('app-update-open');
  announce(update ? `${t('update.title')} ${bodyText}` : bodyText);
}

/**
 * Hide the box. Focus is never lost to <body>: if it was on one of the box's buttons, it moves to
 * the first heading of <main> (without scrolling the page).
 */
function close() {
  const hadFocus = box().contains(document.activeElement);
  box().hidden = true;
  mode = null;
  document.documentElement.classList.remove('app-update-open');
  document.removeEventListener('input', closeOnEdit, true);
  if (hadFocus) {
    const h = /** @type {HTMLElement | null} */ (document.querySelector('main h2, main h3'));
    if (h) {
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }
}

/** The confirmation hides on the first input edit. */
function closeOnEdit() {
  if (mode === 'confirm') close();
}

/** The controller's view (04-07 `ui`). */
const ui = {
  show(bodyKey) {
    if (laterChosen) return;
    $('app-update-apply').textContent = t('update.apply');
    $('app-update-apply').removeAttribute('aria-disabled');
    open('update', t(bodyKey));
  },
  hide() {
    laterChosen = true;
    close();
  },
  body(key, { announce: say = false } = {}) {
    setText('app-update-body', t(key));
    if (say) announce(t(key));
  },
  // aria-disabled, not disabled: a disabled button would drop the keyboard focus to <body>;
  // the controller ignores a second click while the first is in flight.
  button(labelKey, enabled) {
    const b = $('app-update-apply');
    b.textContent = t(labelKey);
    if (enabled) b.removeAttribute('aria-disabled');
    else b.setAttribute('aria-disabled', 'true');
  },
};

/** Pixel height of an element as a CSS custom property on <html> (CSSOM: CSP-safe). */
function trackHeight(el, prop) {
  const write = () => document.documentElement.style.setProperty(prop, `${Math.ceil(el.getBoundingClientRect().height)}px`);
  new ResizeObserver(write).observe(el);
  write();
}

function initBanner() {
  $('app-update-title').prepend(icon('info'));
  $('app-update-apply').addEventListener('click', () => controller?.apply());
  $('app-update-later').addEventListener('click', () => (controller ? controller.later() : ui.hide()));
  $('app-update-close').addEventListener('click', close);
  // The banner sits above the summary bar (--bar-h) and raises the scroll padding by its own
  // height (--update-h), so it never covers the bar or a field scrolled into view.
  trackHeight($('summary-bar'), '--bar-h');
  trackHeight(box(), '--update-h');
  const narrow = matchMedia(NARROW);
  // Phones: hidden while a text field or select has focus (the on-screen keyboard would put the
  // banner on top of the field); back on focusout unless focus moves to another field.
  document.addEventListener('focusin', (e) => {
    const el = /** @type {Element} */ (e.target);
    const field = el instanceof Element && el.matches(FIELD);
    box().classList.toggle('app-update--field', field && narrow.matches);
    if (!isShown() || !(el instanceof Element) || box().contains(el)) return;
    const a = el.getBoundingClientRect();
    const b = box().getBoundingClientRect();
    if (a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right) el.scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('focusout', (e) => {
    const next = e.relatedTarget;
    if (!(next instanceof Element && next.matches(FIELD))) box().classList.remove('app-update--field');
  });
}

/**
 * Start the registration and the banner.
 * @param {{ handoverKind?: 'done' | 'done.other' | 'lost' | null,
 *   formState?: () => { valid: boolean, compareA: object | null, bEstimated: boolean } }} [o]
 *   handoverKind: the confirmation to show (main.js restored a handover at start); formState:
 *   main.js's view of the form at reload time (valid: no input blocks, compareA: the frozen
 *   Vorher (A), bEstimated: lens height B is the estimate, not typed)
 */
export function start({ handoverKind = null, formState = () => ({ valid: true, compareA: null, bEstimated: false }) } = {}) {
  initBanner();
  if (handoverKind !== null) open('confirm', t(DONE_KEYS[handoverKind], { version: $('app-version').textContent ?? '' }));
  let updateSW = null;
  controller = createUpdateController({
    updateSW: () => updateSW?.(),
    probe: () => probe(),
    snapshot: () => {
      const { valid, compareA, bEstimated } = formState();
      const s = snapshotForm(document, { compareA, valid });
      // An estimated B is not the user's value: left out, the restored A gives the same estimate
      // and B keeps its "geschätzt" note (an input event would mark it as typed).
      if (bEstimated) delete s.text['frame-b'];
      return s;
    },
    write: (h) => writeHandover(h),
    reload: () => location.reload(),
    setTimeoutFn: (cb, ms) => setTimeout(cb, ms),
    clearTimeoutFn: (id) => clearTimeout(/** @type {number} */ (id)),
    ui,
  });
  // KILL SWITCH (M1, round-2 NEW-1): __SW_KILL__ is the same value vite.config.js passed to
  // selfDestroying, so app and worker never disagree; an existing registration still updates to
  // the destroyer on navigation; not registering makes the live check deterministic.
  if (__SW_KILL__) {
    setText('tech-offline', t('tech.offline.failed'));
    return;
  }
  const c = controller;
  updateSW = wireRegistration({
    registerSW: (opts) =>
      registerSW({
        ...opts,
        onNeedRefresh() {
          opts.onNeedRefresh();
          c.show();
        },
        onNeedReload: c.onNeedReload,
      }),
    nav: navigator,
    onState: (key) => setText('tech-offline', t(key)),
  });
}
