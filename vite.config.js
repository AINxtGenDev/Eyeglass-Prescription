import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_VERSION } from './version.js';
import { swKillEffective } from './sw-kill-switch.js';

// NEW-1: the one effective kill flag; the plugin and the app read this same value; the
// rehearsal variable (named only in sw-kill-switch.js) is set only for the local dist-kill test
// build and the 04-14 kill-gate check, never in CI.
const SW_KILL = swKillEffective(process.env);

// Short commit hash shown in the footer (#app-commit). CI sets GITHUB_SHA.
const commit = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7);
// Build date (ISO 8601, UTC) shown next to the version in the footer.
const buildDate = new Date().toISOString().slice(0, 10);

// 04-14: only the test build B (`npm run build:b`) sets this override, so the update e2e
// sees a second version label; e2e/smoke.spec.js asserts the real label on every normal build.
const appVersion = process.env.APP_VERSION_OVERRIDE ?? APP_VERSION;

// The commit must be in index.html itself (verify-live greps the HTML),
// so it is injected into the page, not only defined in the JS bundle.
const appMeta = {
  name: 'app-meta',
  transformIndexHtml(html) {
    return html
      .replaceAll('%APP_COMMIT%', commit)
      .replaceAll('%APP_DATE%', buildDate)
      .replaceAll('%APP_VERSION%', appVersion);
  },
};

// CSP on build output only, so the Vite dev client (inline/HMR) keeps working.
// 01-15: no worker-src directive. MDN worker-src: when it is absent the fallback is child-src,
// then script-src, then default-src, so script-src 'self' allows the same-origin worker file
// and blocks blob:/data: workers. Keep this string unchanged (worker.spec.js checks it exactly).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'";
const cspMeta = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      /(<meta charset[^>]*>)/i,
      `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    );
  },
};

export default defineConfig({
  base: '/Eyeglass-Prescription/',
  define: { __SW_KILL__: JSON.stringify(SW_KILL) },
  plugins: [
    appMeta,
    cspMeta,
    // D-18 / D-23 / D-25: options verified against the vite-plugin-pwa 2.0.0 tarball
    // (04-RESEARCH Pattern 7). scope and start_url are omitted on purpose: the plugin derives
    // them from base ('/Eyeglass-Prescription/'); test/dist/pwa-build.test.js asserts both.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      // registration is bundled code via virtual:pwa-register (04-06); 'inline' or 'script'
      // would need an inline/extra script and break the CSP (D-23)
      injectRegister: false,
      manifest: {
        name: 'Brillenglas-Simulator – Dicke und Gewicht',
        short_name: 'Brillenglas',
        lang: 'de-AT',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // manifest icons are auto-included (includeManifestIcons default true); the plugin adds
      // manifest.webmanifest to the precache itself, so webmanifest is not in globPatterns.
      includeAssets: ['favicon.svg'],
      workbox: {
        // workers are assets/*.js, so js covers the engine, mesh and (later) warp workers
        globPatterns: ['**/*.{js,css,html}'],
        cacheId: 'eyeglass-rx',
        // N12 / RESEARCH Pitfall 7: without it a first visit stays uncontrolled and lazy chunks
        // would still come from the network; on the first install there is no previous
        // controller, and on updates activation only follows the user's SKIP_WAITING
        clientsClaim: true,
        // prompt mode: the waiting worker activates only on 'Aktualisieren' (D-20)
        skipWaiting: false,
        // cleanupOutdatedCaches: true and navigateFallback: 'index.html' are plugin defaults
      },
      // KILL SWITCH. Flag: SW_SELF_DESTROY in sw-kill-switch.js, nowhere else. Steps: (1) set
      // SW_SELF_DESTROY = true; (2) bump APP_VERSION in version.js; (3) run the full gate
      // locally, i.e. the 04-VALIDATION full-suite command plus `npx playwright test
      // --project=pwa` (rehearsed in exactly that form in 04-14 Task 3 step 6a with the constant
      // flipped): test/dist/pwa-build.test.js asserts the destroyer shape; in e2e/pwa.spec.js
      // every worker-dependent test skips with the reason 'kill switch on' (offline item 17 and
      // N12, the scope assertion, item 18 'registers within 5 s', 'CSP unchanged with the worker
      // active', and the whole 'switch server only' describe: update items 19–24 and 20b, the
      // rehearsal and the banner axe states), while 'kill switch active @live' runs; (4) push
      // (outward-facing, explicit approval) and let the Pages deploy run; (5) verify on the live
      // URL in a browser profile that has the old worker installed: load, reload, then
      // caches.keys() has no 'eyeglass-rx' entry and navigator.serviceWorker.getRegistrations()
      // resolves to [] and stays [] after one more reload. This converges after one load: the
      // first reload after the deploy is still served from the old build's precache, whose
      // update.js calls registerSW, so one more destroyer cycle can happen; from the second load
      // on the page comes from the network, and while the flag is on src/ui/update.js (reading
      // __SW_KILL__, the same value the plugin got) does not call registerSW (04-14), so nothing
      // registers again; the existing registration still fetches the new sw.js on navigation
      // and the destroyer removes itself (rehearsed in 04-14 with a navigation bound of ≤ 4 up
      // to the second reload).
      // DURATION: keep the destroyer deployed until the cause is fixed; a visitor who did not
      // come back in that window still holds the old worker and is moved to the fixed build by
      // the normal update (the re-enabled sw.js is a new version, which waits and activates at
      // 'Aktualisieren' or when all their tabs are closed).
      // RE-ENABLE: set SW_SELF_DESTROY = false, bump APP_VERSION, gate, approved push; the next
      // visit registers a fresh worker (no previous controller, so no prompt) and precaches
      // again. Both directions are rehearsed on the switch server (e2e/pwa.spec.js 'kill switch
      // rehearsal', 04-14).
      // BLAST RADIUS: the plugin's self-destroying worker calls caches.keys() and deletes EVERY
      // Cache Storage cache on the origin ainxtgendev.github.io. Planning listed five Pages
      // projects there; the 04-14 check below found three on this origin (Eyeglass-Prescription,
      // simplify_llm, testing), one served from its own custom domain and one that does not exist.
      // A sibling's cached data on this origin could be cleared.
      // Siblings checked 2026-11-13 (read-only GET of the published files, 04-14; grep for
      // serviceWorker, sw.js, manifest, workbox, caches.open/keys, CacheStorage):
      //   simplify_llm: https://ainxtgendev.github.io/simplify_llm/ (200), index.html and its one
      //     script assets/index-DHSxdNom.js: no match; sw.js 404, manifest 404 → no worker, no
      //     Cache Storage use found.
      //   testing: https://ainxtgendev.github.io/testing/ (200), index.html (incl. its inline
      //     script) and power_calc.js: no match; sw.js 404 → no worker, no Cache Storage use found.
      //   interior-design: https://ainxtgendev.github.io/interior-design/ → 301 to its custom
      //     domain (Pages cname), a different origin: outside the blast
      //     radius (it has a manifest.webmanifest, but sw.js 404 and no match in its HTML or its
      //     10 referenced chunks).
      //   workflow: no repo and no Pages site (gh api repos/AINxtGenDev/workflow 404,
      //     https://ainxtgendev.github.io/workflow/ 404).
      // So today a kill deploy clears only our own caches on this origin; re-check before a real
      // kill deploy, because a sibling can add a worker at any time.
      selfDestroying: SW_KILL,
    }),
  ],
  // 01-15: the engine worker is a module worker ({ type: 'module' }); worker.format defaults
  // to 'iife', so it is set to 'es' to match (https://vite.dev/config/worker-options).
  worker: { format: 'es' },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.js'],
      exclude: ['**/*.test.js'],
      thresholds: { lines: 95, branches: 90 },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          // 01-12: the +14 search costs more per lens; several CPU-bound property tests and the
          // Grenzfall bench exceed the 5 s default under v8 coverage (CI runs test:coverage).
          testTimeout: 30_000,
          include: ['src/**/*.test.js', 'test/**/*.test.js'],
          exclude: ['test/dist/**', 'node_modules/**'],
        },
      },
      // Reads build output; runs after `npm run build` and `npm run build:e2e` (`npm run test:dist`).
      {
        test: {
          name: 'dist',
          environment: 'node',
          include: ['test/dist/**/*.test.js'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
