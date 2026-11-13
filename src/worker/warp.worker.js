// Module Web Worker glue for the Durchblick warp grid (04-05, REF-02, D-13). A third worker next
// to engine.worker.js and mesh.worker.js, so neither the numbers nor the meshes wait behind a warp.
// Created by the Durchblick view (04-08) with
//   new Worker(new URL('../../worker/warp.worker.js', import.meta.url), { type: 'module' })
// The reply transfers its typed arrays (uv, cls, leaves) to the page (transfer.js).
import { createWarpHandler, READY } from '../state/warp-protocol.js';
import { transferOf } from '../state/transfer.js';

const handle = createWarpHandler();
self.onmessage = (e) => {
  const r = handle(e.data);
  self.postMessage(r, transferOf(r));
};
self.postMessage(READY);
