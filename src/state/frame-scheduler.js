// One recompute per frame (01-14, T-01-36). requestFrame and now are injected, so this module
// has no DOM; the page passes requestAnimationFrame and performance.now.

/**
 * @param {(cb: () => void) => unknown} requestFrame the page passes the browser frame callback
 * @param {(t: { inputTs: number, frameStart: number }) => void} run
 * @param {() => number} now e.g. () => performance.now()
 * @returns {(timeStamp: number) => void} schedule; inputTs is the earliest timestamp of the batch
 */
export function createFrameScheduler(requestFrame, run, now) {
  /** @type {number | null} */
  let pending = null;
  const onFrame = () => {
    const frameStart = now();
    const inputTs = /** @type {number} */ (pending);
    // Cleared before run, so a throwing run cannot block later frames.
    pending = null;
    run({ inputTs, frameStart });
  };
  return (timeStamp) => {
    if (pending === null) {
      pending = timeStamp;
      requestFrame(onFrame);
    } else if (timeStamp < pending) {
      pending = timeStamp;
    }
  };
}
