// 04-06 (D-18, D-22, D-25): the only place that registers the service worker, through the
// plugin's virtual module (never a hand-written serviceWorker registration call: wrong path and
// wrong scope on the shared origin). main.js loads this module with a dynamic import after the
// first result paint or on idle, so workbox-window stays out of the entry chunk. The logic lives
// in sw-core.js (unit-tested); this file only binds it to the page.
// The update banner and the handover follow in 04-07 (logic) and 04-14 (wiring, banner); until
// then no SKIP_WAITING is sent, so a waiting version starts only after all tabs are closed.
// registerSW is called with the plugin's default immediate: false, so workbox-window registers
// on the load event at the earliest; that never delays the first result paint.
import { registerSW } from 'virtual:pwa-register';
import { t } from '../i18n/t.js';
import { setText } from './dom.js';
import { wireRegistration } from './sw-core.js';

export function start() {
  wireRegistration({ registerSW, nav: navigator, onState: (key) => setText('tech-offline', t(key)) });
}
