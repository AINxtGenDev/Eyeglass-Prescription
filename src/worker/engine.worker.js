// Module Web Worker glue (01-15, ENG-09): the engine runs here, off the main thread.
// Created in main.js with new Worker(new URL(…, import.meta.url), { type: 'module' }), the form
// Vite detects and bundles (https://vite.dev/guide/features#web-workers).
import { createHandler, READY } from '../state/compute-protocol.js';

const handle = createHandler();
self.onmessage = (e) => self.postMessage(handle(e.data));
self.postMessage(READY);
