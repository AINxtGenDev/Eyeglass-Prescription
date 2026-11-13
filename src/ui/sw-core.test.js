// 04-06 (D-22, D-25): the service-worker registration logic without the plugin's virtual module.
// Node environment, plain objects stand in for navigator, the registration and the timers.
import { describe, it, expect, vi } from 'vitest';
import {
  offlineLine,
  createRegistrationGate,
  wireRegistration,
  createUpdateController,
  installControllerChange,
} from './sw-core.js';

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

// 04-07 (D-20 logic, D-21, UI-SPEC "Update banner #app-update", MINOR 9): the update state machine.
// Timers are injected and fired by hand (as mesh-client.test.js); `ui` records every call.

/** setTimeout/clearTimeout stand-ins with a manual clock. */
function manualTimers() {
  const timers = new Map();
  let next = 1;
  return {
    timers,
    setTimeoutFn: (fn, ms) => {
      const id = next++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    fireAll() {
      for (const [id, v] of [...timers.entries()]) {
        timers.delete(id);
        v.fn();
      }
    },
  };
}

/** The controller with recording stubs; probeResults is consumed one per probe() call. */
function setupController({ probeResults = [true, true, true, true] } = {}) {
  const tm = manualTimers();
  const log = [];
  const written = [];
  const probes = [...probeResults];
  const ui = {
    show: (body) => log.push(['show', body]),
    hide: () => log.push(['hide']),
    body: (key, opts) => log.push(['body', key, !!opts?.announce]),
    button: (label, enabled) => log.push(['button', label, enabled]),
  };
  const deps = {
    updateSW: vi.fn(),
    probe: vi.fn(() => probes.shift() ?? true),
    write: vi.fn((s) => {
      written.push(s);
      log.push(['write', s.origin]);
      return true;
    }),
    snapshot: vi.fn(() => ({ v: 1, text: { 'rx-od-sph': '-2' } })),
    reload: vi.fn(() => log.push(['reload'])),
    setTimeoutFn: tm.setTimeoutFn,
    clearTimeoutFn: tm.clearTimeoutFn,
    ui,
  };
  return { ctrl: createUpdateController(deps), deps, tm, log, written };
}

describe('createUpdateController (D-20, MINOR 9)', () => {
  it('show() probes first: ok → update.body, failure → update.body.reset', () => {
    const a = setupController();
    a.ctrl.show();
    expect(a.deps.probe).toHaveBeenCalledTimes(1);
    expect(a.log).toEqual([['show', 'update.body']]);
    const b = setupController({ probeResults: [false] });
    b.ctrl.show();
    expect(b.log).toEqual([['show', 'update.body.reset']]);
  });

  it('later() hides for this page and writes nothing', () => {
    const { ctrl, deps, log } = setupController();
    ctrl.show();
    ctrl.later();
    expect(log.at(-1)).toEqual(['hide']);
    expect(deps.write).not.toHaveBeenCalled();
    expect(deps.updateSW).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('apply(): probe ok → button disabled with update.applying, updateSW called, nothing written yet', () => {
    const { ctrl, deps, log } = setupController();
    ctrl.show();
    ctrl.apply();
    expect(deps.probe).toHaveBeenCalledTimes(2);
    expect(log).toContainEqual(['button', 'update.applying', false]);
    expect(deps.updateSW).toHaveBeenCalledTimes(1);
    expect(deps.write).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('a probe failing only at apply(): no updateSW, body update.body.reset announced, button stays enabled; the next apply() proceeds', () => {
    const { ctrl, deps, log } = setupController({ probeResults: [true, false, false] });
    ctrl.show();
    ctrl.apply();
    expect(deps.updateSW).not.toHaveBeenCalled();
    expect(log.at(-1)).toEqual(['body', 'update.body.reset', true]);
    expect(log.some((c) => c[0] === 'button' && c[2] === false)).toBe(false);
    ctrl.apply();
    expect(deps.updateSW).toHaveBeenCalledTimes(1);
    expect(log).toContainEqual(['button', 'update.applying', false]);
  });

  it('a probe that already failed at show(): the click applies knowingly', () => {
    const { ctrl, deps } = setupController({ probeResults: [false, false] });
    ctrl.show();
    ctrl.apply();
    expect(deps.updateSW).toHaveBeenCalledTimes(1);
  });

  it('a second click while applying does nothing', () => {
    const { ctrl, deps, tm } = setupController();
    ctrl.show();
    ctrl.apply();
    ctrl.apply();
    expect(deps.updateSW).toHaveBeenCalledTimes(1);
    expect(tm.timers.size).toBe(1);
  });

  it('no reload 10 s after the click → button enabled again, update.failed announced, nothing written', () => {
    const { ctrl, deps, tm, log } = setupController();
    ctrl.show();
    ctrl.apply();
    expect([...tm.timers.values()].map((t) => t.ms)).toEqual([10000]);
    tm.fireAll();
    expect(log.slice(-2)).toEqual([
      ['button', 'update.apply', true],
      ['body', 'update.failed', true],
    ]);
    expect(deps.write).not.toHaveBeenCalled();
    // applyClicked was reset: a later reload by another tab's update is 'other'.
    ctrl.reloadWithHandover();
    expect(deps.write.mock.calls[0][0].origin).toBe('other');
  });

  it('reloadWithHandover writes the snapshot with its origin, then reloads in the same task; a second call is a no-op', () => {
    const { ctrl, deps, log, written } = setupController();
    ctrl.reloadWithHandover();
    ctrl.reloadWithHandover('other');
    expect(log).toEqual([['write', 'other'], ['reload']]);
    expect(written[0]).toEqual({ v: 1, text: { 'rx-od-sph': '-2' }, origin: 'other' });
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('a write that fails or throws still reloads (the user was warned by the probe)', () => {
    const s = setupController();
    s.deps.write.mockImplementation(() => false);
    s.ctrl.reloadWithHandover();
    expect(s.deps.reload).toHaveBeenCalledTimes(1);
    const t = setupController();
    t.deps.write.mockImplementation(() => {
      throw new Error('x');
    });
    t.ctrl.reloadWithHandover();
    expect(t.deps.reload).toHaveBeenCalledTimes(1);
  });

  it('a reload clears the failure timer', () => {
    const { ctrl, tm } = setupController();
    ctrl.show();
    ctrl.apply();
    ctrl.onNeedReload();
    expect(tm.timers.size).toBe(0);
  });
});

/** A navigator stand-in whose serviceWorker dispatches controllerchange by hand. */
function fakeNav(controlled) {
  const listeners = [];
  const sw = {
    controller: controlled ? {} : null,
    addEventListener: (type, fn) => {
      if (type === 'controllerchange') listeners.push(fn);
    },
    change() {
      sw.controller = {};
      for (const fn of listeners) fn(new Event('controllerchange'));
    },
  };
  return { serviceWorker: sw };
}

describe('installControllerChange and the reload rule (N8, MINOR 5)', () => {
  it('(a) controlled at start, only controllerchange fires → one reload with origin other', () => {
    const { ctrl, deps, written } = setupController();
    const nav = fakeNav(true);
    installControllerChange(nav, ctrl.reloadWithHandover);
    nav.serviceWorker.change();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(written[0].origin).toBe('other');
  });

  it('(b) not controlled at start, first controllerchange (first install + clientsClaim) → no reload', () => {
    const { ctrl, deps } = setupController();
    const nav = fakeNav(false);
    installControllerChange(nav, ctrl.reloadWithHandover);
    nav.serviceWorker.change();
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.write).not.toHaveBeenCalled();
  });

  it('(c) onNeedReload then controllerchange → exactly one reload', () => {
    const { ctrl, deps } = setupController();
    const nav = fakeNav(true);
    installControllerChange(nav, ctrl.reloadWithHandover);
    ctrl.onNeedReload();
    nav.serviceWorker.change();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(deps.write).toHaveBeenCalledTimes(1);
  });

  it('(d) apply then onNeedReload → origin self (also when controllerchange comes first)', () => {
    const a = setupController();
    a.ctrl.show();
    a.ctrl.apply();
    a.ctrl.onNeedReload();
    expect(a.written[0].origin).toBe('self');
    const b = setupController();
    const nav = fakeNav(true);
    installControllerChange(nav, b.ctrl.reloadWithHandover);
    b.ctrl.show();
    b.ctrl.apply();
    nav.serviceWorker.change();
    b.ctrl.onNeedReload();
    expect(b.written).toHaveLength(1);
    expect(b.written[0].origin).toBe('self');
  });

  it('(e) MINOR 5: not controlled at start, the claim does not reload, a later controllerchange from another tab does (origin other)', () => {
    const { ctrl, deps, written } = setupController();
    const nav = fakeNav(false);
    installControllerChange(nav, ctrl.reloadWithHandover);
    nav.serviceWorker.change();
    expect(deps.reload).not.toHaveBeenCalled();
    nav.serviceWorker.change();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(written[0].origin).toBe('other');
  });

  it('without service workers it installs nothing and does not throw', () => {
    expect(() => installControllerChange({}, () => {})).not.toThrow();
  });
});
