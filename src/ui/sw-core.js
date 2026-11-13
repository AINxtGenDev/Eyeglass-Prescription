// 04-06 (D-18, D-22, D-25): the testable part of the service-worker registration. No DOM and no
// globals: the caller injects registerSW (from the plugin's virtual module, which Vitest cannot
// resolve), a navigator-like object and the timer functions. src/ui/update.js is the thin entry.

/**
 * The #tech-offline dictionary key (UI-SPEC "Offline status line", first match wins):
 * unsupported → failed → waiting → ready → pending.
 * @param {{ supported: boolean, registerError?: boolean, needRefresh?: boolean,
 *   offlineReady?: boolean, active?: boolean, controller?: boolean }} s
 */
export function offlineLine(s) {
  if (!s.supported) return 'tech.offline.unsupported';
  if (s.registerError) return 'tech.offline.failed';
  if (s.needRefresh) return 'tech.offline.waiting';
  // onOfflineReady fires only on the first install; a later visit (also an offline reload) is
  // recognised by an active registration that controls this page.
  if (s.offlineReady || (s.active && s.controller)) return 'tech.offline.ready';
  return 'tech.offline.pending';
}

/**
 * D-22: start the registration once, after the first result paint or, when nothing is painted,
 * in an idle callback after load (timeout 3000 ms; setTimeout 3000 without requestIdleCallback).
 * The first paint never waits for it: onStart only kicks off a dynamic import.
 * @param {{ onStart: () => void, setTimeoutFn: (cb: () => void, ms: number) => unknown,
 *   requestIdle: ((cb: () => void, opts: { timeout: number }) => unknown) | null }} o
 */
export function createRegistrationGate({ onStart, setTimeoutFn, requestIdle }) {
  let started = false;
  let scheduled = false;
  const start = () => {
    if (started) return;
    started = true;
    onStart();
  };
  return {
    firstPaint: start,
    loaded() {
      if (started || scheduled) return;
      scheduled = true;
      if (requestIdle) requestIdle(start, { timeout: 3000 });
      else setTimeoutFn(start, 3000);
    },
  };
}

/**
 * Wire the plugin callbacks to the offline line. Reports every state change through onState
 * (a dictionary key) and returns the plugin's updateSW, or null when service workers are not
 * supported (then registerSW is not called).
 * @param {{ registerSW: (opts: object) => unknown, nav: object,
 *   onState: (key: string) => void }} o
 */
export function wireRegistration({ registerSW, nav, onState }) {
  if (!('serviceWorker' in nav)) {
    onState(offlineLine({ supported: false }));
    return null;
  }
  const state = { supported: true, registerError: false, needRefresh: false, offlineReady: false, active: false, controller: false };
  const emit = () => onState(offlineLine(state));
  emit();
  return registerSW({
    onOfflineReady() {
      state.offlineReady = true;
      emit();
    },
    onNeedRefresh() {
      state.needRefresh = true;
      emit();
    },
    onRegisterError() {
      state.registerError = true;
      emit();
    },
    onRegisteredSW(_swUrl, registration) {
      state.active = registration?.active != null;
      state.controller = nav.serviceWorker.controller != null;
      emit();
    },
  });
}

/** No reload this long after "Aktualisieren" → the click failed (UI-SPEC failure path, MINOR 1). */
const APPLY_TIMEOUT_MS = 10000;

/**
 * 04-07 (D-20, D-21, UI-SPEC "Update banner #app-update", MINOR 9): the update state machine. The
 * handover is injected (probe, snapshot, write from handover.js, wired in update.js), so this file
 * names no storage API. `ui` draws the banner (04-14): show(bodyKey), hide(), body(key, { announce }),
 * button(labelKey, enabled).
 * @param {{ updateSW: () => unknown, probe: () => boolean, snapshot: () => object,
 *   write: (handover: object) => boolean, reload: () => void,
 *   setTimeoutFn: (cb: () => void, ms: number) => unknown, clearTimeoutFn: (id: unknown) => void,
 *   ui: { show: (body: string) => void, hide: () => void,
 *     body: (key: string, o?: { announce: boolean }) => void,
 *     button: (label: string, enabled: boolean) => void } }} d
 */
export function createUpdateController({ updateSW, probe, snapshot, write, reload, setTimeoutFn, clearTimeoutFn, ui }) {
  /** "Aktualisieren" was clicked and is in flight (memory only, never stored). */
  let applyClicked = false;
  /** The user has seen update.body.reset, so the next click applies knowingly. */
  let warned = false;
  let reloading = false;
  let timer = null;

  /**
   * The single reload path, idempotent per page: write this tab's inputs, then reload in the same
   * task. The click in this tab wins over the origin a caller passes ('self' over 'other').
   * @param {'self' | 'other'} [origin]
   */
  function reloadWithHandover(origin = 'other') {
    if (reloading) return;
    reloading = true;
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
    try {
      write({ ...snapshot(), origin: applyClicked ? 'self' : origin });
    } catch {
      // Nothing written: the next start is a normal load (the probe warned before the click).
    }
    reload();
  }

  return {
    show() {
      warned = !probe();
      ui.show(warned ? 'update.body.reset' : 'update.body');
    },
    /** "Später": hidden for the life of this page; nothing is stored. */
    later() {
      ui.hide();
    },
    apply() {
      if (applyClicked || reloading) return;
      if (!warned && !probe()) {
        warned = true;
        ui.body('update.body.reset', { announce: true });
        return;
      }
      applyClicked = true;
      ui.button('update.applying', false);
      timer = setTimeoutFn(() => {
        timer = null;
        if (reloading) return;
        applyClicked = false;
        ui.button('update.apply', true);
        ui.body('update.failed', { announce: true });
      }, APPLY_TIMEOUT_MS);
      updateSW();
    },
    reloadWithHandover,
    /** The plugin's onNeedReload (the new worker controls this page). */
    onNeedReload: () => reloadWithHandover(),
  };
}

/**
 * 04-07 (N8, lens-critic MINOR 5): reload with this tab's handover when its controller changes
 * because of an update. `had` starts as "controlled at call time": the first install's
 * clientsClaim also fires controllerchange, and that one must not reload. After the first change
 * `had` is true, so a first-visit tab claimed that way still reloads when another tab later
 * activates a new version; otherwise its lazy chunks (the warp worker, the 3D view) would be
 * requested against the new precache, which may no longer hold them.
 * @param {{ serviceWorker?: { controller: unknown,
 *   addEventListener: (type: string, fn: () => void) => void } }} nav
 * @param {(origin: 'other') => void} reloadFn
 */
export function installControllerChange(nav, reloadFn) {
  const sw = nav.serviceWorker;
  if (!sw) return;
  let had = sw.controller != null;
  sw.addEventListener('controllerchange', () => {
    if (had) reloadFn('other');
    had = true;
  });
}
