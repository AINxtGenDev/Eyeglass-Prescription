// Transfer list for postMessage (03-04, VIZ-06). Import-free on purpose: the worker glue and
// the page both import it without pulling the engine (lens-critic MINOR 2).
//
// A 'mesh' message (request or reply) moves its Float32Arrays instead of copying them
// (https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
// Generic over buffer keys, so new mesh kinds (the 03-07 frame) need no change here.
// 04-05: a 'warp' reply carries its typed arrays (uv, cls, leaves) directly on each item.

/**
 * @param {any} msg
 * @returns {ArrayBuffer[]} the unique ArrayBuffers of every view in msg.items[*].buffers ('mesh')
 *   or directly in msg.items[*] ('warp')
 */
export function transferOf(msg) {
  if ((msg?.type !== 'mesh' && msg?.type !== 'warp') || !Array.isArray(msg.items)) return [];
  const set = new Set();
  for (const item of msg.items) {
    const views = msg.type === 'mesh' ? item?.buffers : item;
    if (!views || typeof views !== 'object') continue;
    for (const v of Object.values(views)) {
      if (ArrayBuffer.isView(v)) set.add(v.buffer);
    }
  }
  return [...set];
}
