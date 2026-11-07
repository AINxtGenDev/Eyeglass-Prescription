import { describe, test, expect, vi } from 'vitest';
import { createDebouncer, MESSAGE_PAUSE_MS } from './debounce.js';

// Fake timers, injected (no vi.useFakeTimers), as in compute-client.test.js.
function fakeTimers() {
  let clock = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(t) {
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        clock = due[1].at;
        due[1].fn();
      }
      clock = t;
    },
    timers,
  };
}

describe('createDebouncer', () => {
  test('MESSAGE_PAUSE_MS is 600', () => expect(MESSAGE_PAUSE_MS).toBe(600));

  test('calls within 600 ms coalesce; the last fn runs once after the pause', () => {
    const ft = fakeTimers();
    const d = createDebouncer(ft.setTimer, ft.clearTimer);
    const a = vi.fn();
    const b = vi.fn();
    d.call(a);
    ft.advance(300);
    d.call(b);
    expect(d.isPending()).toBe(true);
    ft.advance(899);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    ft.advance(900);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(d.isPending()).toBe(false);
    expect(ft.timers.size).toBe(0);
  });

  test('flush() runs the pending fn immediately (blur), once', () => {
    const ft = fakeTimers();
    const d = createDebouncer(ft.setTimer, ft.clearTimer);
    const a = vi.fn();
    d.call(a);
    d.flush();
    expect(a).toHaveBeenCalledTimes(1);
    ft.advance(10_000);
    expect(a).toHaveBeenCalledTimes(1);
    d.flush();
    expect(a).toHaveBeenCalledTimes(1);
  });

  test('cancel() drops the pending fn', () => {
    const ft = fakeTimers();
    const d = createDebouncer(ft.setTimer, ft.clearTimer);
    const a = vi.fn();
    d.call(a);
    d.cancel();
    ft.advance(10_000);
    expect(a).not.toHaveBeenCalled();
    expect(d.isPending()).toBe(false);
    expect(ft.timers.size).toBe(0);
  });

  test('custom pause', () => {
    const ft = fakeTimers();
    const d = createDebouncer(ft.setTimer, ft.clearTimer, 100);
    const a = vi.fn();
    d.call(a);
    ft.advance(99);
    expect(a).not.toHaveBeenCalled();
    ft.advance(100);
    expect(a).toHaveBeenCalledTimes(1);
  });
});
