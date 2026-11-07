// Message debouncer (RX-05, RESEARCH Pitfall 5). Pure: timers are injected, so it runs under Node.
// Only the display of field messages is debounced; the compute request still goes out every
// input frame (ENG-09).

// [ASSUMED, RESEARCH A4] design constant; no cited source.
export const MESSAGE_PAUSE_MS = 600;

/**
 * @param {(fn: () => void, ms: number) => unknown} setTimer
 * @param {(id: unknown) => void} clearTimer
 * @param {number} [ms]
 */
export function createDebouncer(setTimer, clearTimer, ms = MESSAGE_PAUSE_MS) {
  let id = null;
  /** @type {null | (() => void)} */
  let fn = null;
  const run = () => {
    const f = fn;
    id = null;
    fn = null;
    f?.();
  };
  return {
    /** Replace the pending fn and restart the pause. */
    call(next) {
      if (id !== null) clearTimer(id);
      fn = next;
      id = setTimer(run, ms);
    },
    /** Run the pending fn now (blur); no-op when nothing is pending. */
    flush() {
      if (id === null) return;
      clearTimer(id);
      run();
    },
    cancel() {
      if (id !== null) clearTimer(id);
      id = null;
      fn = null;
    },
    isPending: () => id !== null,
  };
}
