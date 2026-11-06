// Last-call memo (01-14, per-eye reuse): an eye whose spec did not change keeps its LensResult
// object, so the page skips both the solve and the re-render. Pure: no DOM.

/**
 * @template S, R
 * @param {(spec: S) => R} fn
 * @returns {(spec: S) => R} returns the stored result when JSON.stringify(spec) equals the last key
 */
export function memoLast(fn) {
  let lastKey;
  let lastResult;
  let has = false;
  return (spec) => {
    // The full spec is the key (T-01-35): any nested field change gives a different key.
    const key = JSON.stringify(spec);
    if (has && key === lastKey) return lastResult;
    lastResult = fn(spec);
    lastKey = key;
    has = true;
    return lastResult;
  };
}
