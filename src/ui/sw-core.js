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
