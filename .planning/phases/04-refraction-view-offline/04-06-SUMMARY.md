---
phase: 04-refraction-view-offline
plan: 06
subsystem: offline-runtime
tags: [OFF-01, D-18, D-19, D-22, D-23, D-25, N12, M4, NEW-1, NEW-5, pwa, service-worker, playwright]
requires:
  - "04-02: dist / dist-e2e builds, live subset, reuseExistingServer: false"
  - "04-04: vite-plugin-pwa generateSW worker + manifest, sw-kill-switch.js swKillEffective"
  - "04-15: flaky reporter in the Playwright config"
provides:
  - "src/ui/sw-core.js: offlineLine, createRegistrationGate, wireRegistration (unit-tested, injected deps)"
  - "src/ui/update.js: the only virtual:pwa-register import, start(); own chunk (update-*.js)"
  - "pipeline initPipeline({ onFirstPaint }) hook, called once after the first painted result"
  - "p#tech-offline with tech.offline.pending/ready/waiting/unsupported/failed"
  - "e2e/support/switch-server.js (SWITCH_PORT 4175, SWITCH_ROOT dist)"
  - "Playwright project 'pwa' (pwa.spec.js only, fullyParallel false, serviceWorkers allow); desktop/mobile block workers"
  - "npm run test:pwa:live; verify-live runs it with PWA_BASE_URL"
affects: [04-07 update logic, 04-13 ENG-09 re-measure and push, 04-14 'switch server only' describe, kill-switch rehearsal, banner wiring]
tech-stack:
  added: []
  patterns:
    - "testable core with injected registerSW / navigator / timers; thin entry imports the virtual module"
    - "registration behind a once-gate: first paint or idle-after-load, then a dynamic import"
    - "offline test = setOffline + context.route abort + fromServiceWorker() assertions, with negative controls"
key-files:
  created:
    - src/ui/sw-core.js
    - src/ui/sw-core.test.js
    - src/ui/update.js
    - e2e/support/switch-server.js
    - e2e/pwa.spec.js
  modified:
    - src/ui/pipeline.js
    - src/ui/main.js
    - index.html
    - src/i18n/de-AT.js
    - test/dist/parity.test.js
    - playwright.config.js
    - package.json
    - .github/workflows/deploy.yml
    - test/ci/workflow-structure.test.js
decisions:
  - "N12 on this app: the example Rx paints at load (D-26), so the page is never empty; the test aborts the page's own 3D-chunk request while online (the worker's precache request passes) and loads the chunk offline through 'Erneut versuchen'"
  - "With PWA_BASE_URL set, neither webServer starts (the default preview:e2e entry would otherwise need dist-e2e in verify-live)"
  - "update-*.js joins PARITY_ALLOW as normalisedEqual (it imports the entry chunk by hashed name)"
  - "registerSW keeps the plugin default immediate: false, so workbox-window registers at load at the earliest"
metrics:
  duration: "~30 min"
  completed: 2026-11-13
  tasks: 2
  files: 14
---

# Phase 4 Plan 06: Service-worker registration, offline line and the offline e2e Summary

The app now registers its Workbox service worker after the first result paint (or on idle after load), through `virtual:pwa-register` in its own chunk. Technische Angaben shows one quiet offline line. A new `pwa` Playwright project proves on the production `dist/` that after one visit, with the network cut both ways, the page, a fresh computation and the 3D view are all served by the worker.

## Worth knowing first

- **The page is never empty at load.** The example Rx paints immediately (D-26), so the plan's "empty page" wording does not happen in this app:
  - Item 18 ("registers without input within 5 s") exercises the first-paint path, measured at 180 ms after `loadEventEnd`. The idle fallback is covered only by the unit tests.
  - For N12, the test aborts the page's own request for `view-*.js` while online. The worker's precache request is let through (`route.request().serviceWorker()`). After ready plus controller (clientsClaim, no reload), the test goes offline, types the first Sph, then loads the 3D chunk through "Erneut versuchen". So a typed Sph does not trigger the load here; the retry button does. lens-critic may want to judge whether this is enough for N12.
- **With service workers blocked, the gate projects show `tech.offline.failed`.** In those projects `register()` rejects, so `onRegisterError` fires. A probe in desktop and mobile measured `controller: false`, `getRegistrations().length: 0`, and that line. This is correct for a browser that refuses workers. No existing spec checks the line, and smoke/worker/view and the whole live subset pass.
- **Not in the plan: the webServer rule for PWA_BASE_URL.** With `PWA_BASE_URL` set, the default `preview:e2e` entry is skipped too. Without that, `npm run test:pwa:live` in verify-live would try to start a server for `dist-e2e`, which verify-live never builds.
- **The chrome-devtools MCP is not in this executor's toolset.** The D-30 check ran with Playwright Chromium (see below). The orchestrator may want to repeat it in the MCP after the merge.

## Task 1: registration gate and offline line (TDD)

- RED `55031d4`: `sw-core.test.js` has 15 cases: the priority table, the gate (once, idle `{ timeout: 3000 }`, the setTimeout 3000 fallback, a late idle callback, a double `loaded()`) and the wiring (unsupported, the four callbacks, first install, later visit with the controller, waiting, failed, missing registration). It failed with "no tests", because the module did not exist yet.
- GREEN `e766071`: `sw-core.js` (pure, no DOM, no storage words) and `update.js`. `pipeline.js` calls `onFirstPaint` once after the first painted result in `paintDeliveries`. `main.js` creates the gate: the initial line is pending or unsupported, `loaded()` runs on `load` (or at once if the page is already complete), and onStart does a dynamic `import('./update.js')` with the failed line on error. `index.html` and `de-AT.js` get the five strings. A script compared them with the UI-SPEC table: all five match byte for byte.
- Build: `dist/assets/` now has `update-B8sx2n0U.js` and `workbox-window.prod.es5-Bd17z0YL.js`. `grep -c -i workbox dist/assets/index-*.js` = **0**. Precache: 15 entries, 937 175 B.
- `test/dist/parity.test.js` failed on the new chunk at first (`update-*` differs by name between dist and dist-e2e). The cause is the hash cascade: the chunk imports `index-*.js` by its hashed name, and the normalised contents are identical (diff empty). The entry was added as `normalisedEqual: true`, as the test's header prescribes.

## Task 2: pwa project, switch server, offline e2e, live check (`2e4423e`)

- `switch-server.js` was probed on a scratch port (4195; free before, stopped by PID after):
  - `/` and `/Eyeglass-Prescription` → 302; the base → 200 html; the manifest → `application/manifest+json`.
  - `../`, `%2e%2e/`, `..%2f` and `/package.json` → 404, and missing files → 404.
  - `Cache-Control: no-cache` is on every response.
- `playwright.config.js`:
  - desktop and mobile use `serviceWorkers: 'block'` and also ignore `pwa.spec.js`; perf uses `allow`.
  - The `pwa` project (one file, `fullyParallel: false`, the MINOR 9 comment) is not created with E2E_LIVE.
  - `webServer` is now an array; the switch server entry has `reuseExistingServer: false`.
- `pwa.spec.js`:
  - It defines `LIVE` (it carries an eslint-disable until 04-14 uses it) and `KILL = swKillEffective(process.env)`.
  - Four tests start with `test.skip(KILL, 'kill switch on')`. In "scope and manifest" the scope assertion is skipped under KILL, with an annotation.
  - The ready text is imported from `de-AT.js`. The file uses no hook.
- `test:pwa:live` is in package.json. verify-live has a new step after `test:e2e:live` with `PWA_BASE_URL` set to the same live URL. A new structure test asserts the order and the URL.

### Negative controls (each one fails as it should)

| Control | Result |
|---|---|
| dist copy with `view-*.js` removed from the sw.js precache list | item 17 and N12 **fail** (the route abort really cuts the network). In item 17 only the response check caught it, because the canvas stays visible in the load-failure state, so an explicit "no `view.loadFailed` text" assertion was added. Re-run: it fails at that line. |
| dist copy with `e.clientsClaim()` removed | N12 **fails**: the page never becomes controlled on the first visit |
| `SW_KILL_REHEARSAL=1` | 1 passed (manifest), 4 skipped: the KILL skips work |
| `PWA_BASE_URL` → `https://example.invalid/` in deploy.yml (reverted) | the new structure test **fails** |

### Verification (real output)

| Command | Result |
|---|---|
| `npx vitest run src/ui/sw-core.test.js src/engine/boundary.test.js` | 44 passed |
| `npm run lint` | clean |
| `npm run build && npm run build:e2e && npm run test:dist` | 17 passed, 1 skipped (kill branch) |
| `npx playwright test --project=pwa` | **5 passed** (45 s) |
| `npm run test:pwa:live` (local switch server) | **3 passed**: exactly the three @live tests |
| `npx playwright test --project=desktop e2e/smoke.spec.js e2e/worker.spec.js e2e/view.spec.js` | 64 passed, 9 skipped (existing conditional skips) |
| temporary probe (deleted, not committed), desktop + mobile | controller false, 0 registrations |
| `npm run test:e2e:live` (dist, 4173) | 321 passed, 1 skipped (= the 04-02/04-04 baseline) |
| `npx vitest run test/ci` | 5 files, 40 passed |
| `npm run test:coverage` | 53 files, **1977 passed**; lines 99.63 %, branches 97.57 %. The diagnostics test did not time out (load ~2–5) |

Before each run, the ports printed `000`. `npm run test:e2e` (the full suite) was not run locally (memory `targeted-e2e-before-push`); CI runs it.

### D-30 visual check (Playwright Chromium, not the MCP)

Ground rule 15 for the preview on 4173:
- (a) before starting it, `curl … http://localhost:4173/` printed `000`.
- The build used `GITHUB_SHA=2e4423e7…`.
- (c) after starting it, `name="app-commit" content="2e4423e"` equals `git rev-parse HEAD | cut -c1-7`.

The preview (npm exec, sh and vite PIDs, all checked as mine) was stopped afterwards, and the port is back to `000`. The script held `sw.js` to capture the pending state.

- **412×915 pending** (`04-06-412x915-pending.png` in the scratchpad): the Technische Angaben list is open. Below "3D-Neuaufbau zuletzt: 2 847,70 ms" is the line "Offline-Speicherung wird vorbereitet …" in the same plain body style as its neighbours, followed by the Browser line, the footer "Version dev-1.7 · 2026-11-13 (2e4423e)" and the summary bar at the bottom. There is no toast.
- **320×640 ready** (`04-06-320x640-ready.png`): "Offline verfügbar: Diese Version ist auf dem Gerät gespeichert und rechnet auch ohne Internet." wraps to three lines (box 288 × 72 px) with hyphenation ("rech-net"), and nothing is cut off. The top of this shot shows a white band over the "Erneut messen" button. That band is outside the area this plan changed and was not investigated.
- 412×915 ready and 320×640 pending were also captured, and their texts are equal to the ones above.
- `getRegistrations()` → exactly one, with scope path `/Eyeglass-Prescription/`, at both sizes.
- Console: at 412 px only the 8 known headless "GL Driver Message … GPU stall due to ReadPixels" warnings (e2e/helpers.js documents them as not app messages); at 320 px nothing. No errors and no service-worker warnings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parity allow-list for the new chunk**
- **Found during:** Task 1 (`npm run test:dist`)
- **Issue:** `update-*.js` is named differently in dist and dist-e2e because it imports the entry by hash.
- **Fix:** a PARITY_ALLOW entry with `normalisedEqual: true` (whole-name pattern, the reason, measured). The file is outside the plan's `files_modified`; the test's own header says to make this change in the same commit.
- **Files modified:** test/dist/parity.test.js
- **Commit:** e766071

**2. [Rule 1 - Bug] verify-live would start a server for an unbuilt dist-e2e**
- **Issue:** the plan only skips the switch server when PWA_BASE_URL is set. The existing `preview:e2e` entry would still start in verify-live.
- **Fix:** both entries are skipped when PWA_BASE_URL is set.
- **Files modified:** playwright.config.js
- **Commit:** 2e4423e

**3. [Rule 1 - Bug] weak 3D assertion in item 17**
- Found by the negative control: in the load-failure state the canvas is visible too. The test now also asserts the absence of the `view.loadFailed` text.
- **Commit:** 2e4423e

**4. [Rule 3 - Adaptation] N12 and item 18 without an empty page**
- See "Worth knowing first". The example at load makes the plan's "empty page" impossible without a test hook (the spec must stay hook-free), so the test uses the abort-then-retry route.
- **Commit:** 2e4423e

**5. [Rule 3 - Tooling] D-30 via Playwright Chromium** (the MCP is not available here).

## Known Stubs

None. `LIVE` in `e2e/pwa.spec.js` is defined but not used yet (the 04-14 describe uses it). It carries an eslint-disable with that reason.

## Threat Flags

None beyond the register:
- T-04-21: the runtime scope is asserted, and `serviceWorker.register(` does not occur in `src/` (grep 0).
- T-04-22: dynamic import with no inline script; the CSP meta is equal to the literal and there are no violations with the worker active.
- T-04-23: the entry chunk has 0 workbox strings, and registration starts after the paint.
- T-04-24: setOffline plus route abort plus fromServiceWorker, with negative controls.
- T-04-24b: verify-live step plus structure test.
- T-04-25: the traversal probe returned 404 in every case.

## Commits

- 55031d4 test(04-06): add failing tests for the offline line, the registration gate and the registerSW wiring
- e766071 feat(04-06): register the service worker after the first paint or on idle, offline line in Technische Angaben
- 2e4423e test(04-06): pwa Playwright project on the switch server, offline e2e, live pwa check in verify-live

STATE.md and ROADMAP.md were not touched (orchestrator-owned). Nothing was pushed.

## Self-Check: PASSED

All 5 created files exist; commits 55031d4, e766071 and 2e4423e are in `git log`.
