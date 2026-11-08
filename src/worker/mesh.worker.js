// Module Web Worker glue for lens (and later frame) meshes (03-04, VIZ-06). A second worker next
// to engine.worker.js, so a numbers result never waits behind a mesh build (lens-critic MAJOR 3).
// Created by the lazy view chunk (03-05) with
//   new Worker(new URL('../../worker/mesh.worker.js', import.meta.url), { type: 'module' })
// The reply transfers its Float32Arrays back to the page (transfer.js).
import { createMeshHandler, READY } from '../state/mesh-protocol.js';
import { transferOf } from '../state/transfer.js';

const handle = createMeshHandler();
self.onmessage = (e) => {
  const r = handle(e.data);
  self.postMessage(r, transferOf(r));
};
self.postMessage(READY);
