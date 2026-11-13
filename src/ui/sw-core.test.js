// 04-06 (D-22, D-25): the service-worker registration logic without the plugin's virtual module.
// Node environment, plain objects stand in for navigator, the registration and the timers.
import { describe, it, expect } from 'vitest';
import { offlineLine, createRegistrationGate, wireRegistration } from './sw-core.js';

describe('offlineLine (UI-SPEC "Offline status line", priority order)', () => {
  it('unsupported wins over everything', () => {
    expect(offlineLine({ supported: false, registerError: true, offlineReady: true })).toBe('tech.offline.unsupported');
  });
  it('a registration error wins over ready and waiting', () => {
    expect(offlineLine({ supported: true, registerError: true, needRefresh: true, offlineReady: true })).toBe(
      'tech.offline.failed',
    );
    expect(offlineLine({ supported: true, registerError: true, active: true, controller: true })).toBe('tech.offline.failed');
  });
  it('a waiting worker wins over ready', () => {
    expect(offlineLine({ supported: true, needRefresh: true, offlineReady: true })).toBe('tech.offline.waiting');
  });
  it('ready from onOfflineReady or from an active registration with a controller', () => {
    expect(offlineLine({ supported: true, offlineReady: true })).toBe('tech.offline.ready');
    expect(offlineLine({ supported: true, active: true, controller: true })).toBe('tech.offline.ready');
  });
  it('pending otherwise (active without controller, controller without active, nothing yet)', () => {
    expect(offlineLine({ supported: true })).toBe('tech.offline.pending');
    expect(offlineLine({ supported: true, active: true, controller: false })).toBe('tech.offline.pending');
    expect(offlineLine({ supported: true, active: false, controller: true })).toBe('tech.offline.pending');
  });
});

/** Timer stubs that only record the scheduled callbacks. */
function fakeTimers() {
  const idle = [];
  const timeouts = [];
  return {
    idle,
    timeouts,
    requestIdle: (cb, opts) => idle.push({ cb, opts }),
    setTimeoutFn: (cb, ms) => timeouts.push({ cb, ms }),
  };
}

describe('createRegistrationGate (D-22)', () => {
  it('firstPaint starts once; a second paint and a late idle callback do nothing', () => {
    const timers = fakeTimers();
    let starts = 0;
    const gate = createRegistrationGate({ onStart: () => starts++, ...timers });
    gate.firstPaint();
    expect(starts).toBe(1);
    gate.firstPaint();
    gate.loaded();
    for (const { cb } of timers.idle) cb();
    expect(starts).toBe(1);
  });

  it('loaded schedules requestIdleCallback with timeout 3000, which starts once', () => {
    const timers = fakeTimers();
    let starts = 0;
    const gate = createRegistrationGate({ onStart: () => starts++, ...timers });
    gate.loaded();
    expect(starts).toBe(0);
    expect(timers.idle).toHaveLength(1);
    expect(timers.idle[0].opts).toEqual({ timeout: 3000 });
    expect(timers.timeouts).toHaveLength(0);
    timers.idle[0].cb();
    expect(starts).toBe(1);
    gate.firstPaint();
    timers.idle[0].cb();
    expect(starts).toBe(1);
  });

  it('falls back to setTimeout 3000 when requestIdleCallback is missing', () => {
    const timers = fakeTimers();
    let starts = 0;
    const gate = createRegistrationGate({ onStart: () => starts++, setTimeoutFn: timers.setTimeoutFn, requestIdle: null });
    gate.loaded();
    expect(timers.timeouts).toHaveLength(1);
    expect(timers.timeouts[0].ms).toBe(3000);
    timers.timeouts[0].cb();
    expect(starts).toBe(1);
  });

  it('loaded twice schedules only one fallback', () => {
    const timers = fakeTimers();
    const gate = createRegistrationGate({ onStart: () => {}, ...timers });
    gate.loaded();
    gate.loaded();
    expect(timers.idle).toHaveLength(1);
  });
});

/** A registerSW stub that keeps the options it was called with. */
function fakeRegisterSW() {
  const calls = [];
  const updateSW = () => {};
  const registerSW = (opts) => {
    calls.push(opts);
    return updateSW;
  };
  return { calls, registerSW, updateSW };
}

describe('wireRegistration (D-18, D-25)', () => {
  it('without serviceWorker in navigator it does not register and reports unsupported', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const out = wireRegistration({ registerSW: reg.registerSW, nav: {}, onState: (k) => states.push(k) });
    expect(reg.calls).toHaveLength(0);
    expect(out).toBeNull();
    expect(states).toEqual(['tech.offline.unsupported']);
  });

  it('passes the four callbacks, returns updateSW and starts pending', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const nav = { serviceWorker: { controller: null } };
    const out = wireRegistration({ registerSW: reg.registerSW, nav, onState: (k) => states.push(k) });
    expect(out).toBe(reg.updateSW);
    expect(reg.calls).toHaveLength(1);
    const opts = reg.calls[0];
    for (const name of ['onOfflineReady', 'onNeedRefresh', 'onRegisterError', 'onRegisteredSW']) {
      expect(typeof opts[name]).toBe('function');
    }
    expect(states).toEqual(['tech.offline.pending']);
  });

  it('first install: registered without controller stays pending, onOfflineReady makes it ready', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const nav = { serviceWorker: { controller: null } };
    wireRegistration({ registerSW: reg.registerSW, nav, onState: (k) => states.push(k) });
    reg.calls[0].onRegisteredSW('/Eyeglass-Prescription/sw.js', { active: null });
    expect(states.at(-1)).toBe('tech.offline.pending');
    reg.calls[0].onOfflineReady();
    expect(states.at(-1)).toBe('tech.offline.ready');
  });

  it('later visit: an active registration with a controller is ready (controller read at callback time)', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const nav = { serviceWorker: { controller: null } };
    wireRegistration({ registerSW: reg.registerSW, nav, onState: (k) => states.push(k) });
    nav.serviceWorker.controller = {};
    reg.calls[0].onRegisteredSW('/Eyeglass-Prescription/sw.js', { active: {} });
    expect(states.at(-1)).toBe('tech.offline.ready');
  });

  it('onNeedRefresh reports waiting; onRegisterError reports failed even after ready', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const nav = { serviceWorker: { controller: {} } };
    wireRegistration({ registerSW: reg.registerSW, nav, onState: (k) => states.push(k) });
    reg.calls[0].onRegisteredSW('/sw.js', { active: {} });
    expect(states.at(-1)).toBe('tech.offline.ready');
    reg.calls[0].onNeedRefresh();
    expect(states.at(-1)).toBe('tech.offline.waiting');
    reg.calls[0].onRegisterError(new Error('x'));
    expect(states.at(-1)).toBe('tech.offline.failed');
  });

  it('a missing registration object in onRegisteredSW is not ready', () => {
    const reg = fakeRegisterSW();
    const states = [];
    const nav = { serviceWorker: { controller: {} } };
    wireRegistration({ registerSW: reg.registerSW, nav, onState: (k) => states.push(k) });
    reg.calls[0].onRegisteredSW('/sw.js', undefined);
    expect(states.at(-1)).toBe('tech.offline.pending');
  });
});
