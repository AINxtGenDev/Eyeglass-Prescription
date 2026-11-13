---
phase: 04-refraction-view-offline
plan: 04
subsystem: offline-build
tags: [OFF-01, D-18, D-19, D-23, D-24, D-25, M1, NEW-1, N12, pwa, service-worker]
requires:
  - "04-02: test:dist project, dist / dist-e2e builds"
provides:
  - "vite-plugin-pwa 2.0.0 generateSW worker + manifest in every build (not registered yet)"
  - "sw-kill-switch.js: SW_SELF_DESTROY, swKillEffective(env)"
  - "build-time constant __SW_KILL__ (for src/ui/update.js, 04-14)"
  - "test/dist/sw-shape.js: checkNormalSw, checkDestroyerSw, precacheUrls, precacheBytes"
  - "test/dist/pwa-build.test.js"
  - "public/favicon.svg + three PNG icons, scripts/make-icons.mjs"
affects: [04-06 registration via virtual:pwa-register, 04-14 kill-switch rehearsal and sibling check]
tech-stack:
  added: ["vite-plugin-pwa 2.0.0 (dev)", "workbox-build 7.4.1 (dev)", "workbox-window 7.4.1 (dev)"]
  patterns:
    - "one kill flag + one effective expression shared by the build config and the tests"
    - "worker shape checks return failure lists; the test picks the branch from swKillEffective(process.env)"
key-files:
  created:
    - sw-kill-switch.js
    - public/favicon.svg
    - public/icon-192.png
    - public/icon-512.png
    - public/icon-512-maskable.png
    - scripts/make-icons.mjs
    - test/dist/sw-shape.js
    - test/dist/pwa-build.test.js
  modified:
    - package.json
    - package-lock.json
    - test/ci/pins.test.js
    - vite.config.js
    - index.html
decisions:
  - "The precache size is written with process.stdout.write, because Vitest 5 hides console output of passing tests"
  - "sw-shape.js also exports precacheUrls/precacheBytes; the check functions return plain failure arrays, so the 04-14 one-liner `f.length` works"
  - "Comments in vite.config.js and sw-kill-switch.js were reworded so the acceptance greps (SW_KILL_REHEARSAL = 0 in vite.config.js, process = 0 in sw-kill-switch.js) hold"
metrics:
  duration: "~35 min"
  completed: 2026-11-13
  tasks: 2
  files: 13
---

# Phase 4 Plan 04: PWA plugin, manifest, icons and the flag-aware build test Summary

Every build now has a scoped, namespaced Workbox service worker (prompt mode, clientsClaim, cacheId `eyeglass-rx`). It precaches the whole app at 928 218 bytes, under the 2 MB limit. There is also a de-AT manifest with our own icons. One kill-switch flag drives both the plugin and `__SW_KILL__`, and `test/dist/pwa-build.test.js` asserts the normal worker or the destroyer depending on that same flag. Nothing registers the worker yet (04-06 does that).

## Worth knowing first

- **The `workbox-778a14ff.js` runtime is not in the precache list.** This is the plugin's default `globIgnores`: `sw.js` loads the runtime through `importScripts`, and the browser keeps it with the worker script. The generic "every file in assets/" rule does not apply because the runtime lives at the dist root, not in `assets/`.
- **`slopcheck install name@version` reports `[SLOP] does not exist`** for all three packages. It treats the version as part of the package name. With bare names it reports `[OK]`, and the scratch install resolved exactly 2.0.0 / 7.4.1 / 7.4.1. This is a usage pitfall for future legitimacy checks.
- **The plan's prescribed header for `sw-kill-switch.js` contradicts its own acceptance criterion.** The header text says `swKillEffective(process.env)`, but the criterion requires `grep -c process = 0`. The header now says `swKillEffective(<Node env>)`. Likewise, the `SW_KILL_REHEARSAL` name was removed from the vite.config.js comment (criterion = 0).
- **The npm install bumped three transitive Babel packages** to satisfy the new tree: `@babel/parser` and `@babel/helper-string-parser` 7.29.13 → 7.29.14, and `@babel/types` 7.29.11 → 7.29.14. No existing lockfile entry was removed, 325 entries were added, and the `hasInstallScript` count is unchanged at 1 (same as before).
- **The D-30 check used Playwright's Chromium, not the chrome-devtools MCP.** The MCP tools are not available in this executor's toolset. The orchestrator may want to repeat the phone-size MCP check.

## Task 1: legitimacy gate, pins, VitePWA config

Scratch directory (empty when created, outside the repo):
`/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/slopcheck-0404`

```
$ slopcheck install -e npm vite-plugin-pwa@2.0.0 workbox-build@7.4.1 workbox-window@7.4.1
  [SLOP] vite-plugin-pwa@2.0.0 (npm)  > Package 'vite-plugin-pwa@2.0.0' does not exist on npm.
  [SLOP] workbox-build@7.4.1 (npm)    > Package 'workbox-build@7.4.1' does not exist on npm.
  [SLOP] workbox-window@7.4.1 (npm)   > Package 'workbox-window@7.4.1' does not exist on npm.
  (refused to install; name@version is read as a package name)

$ slopcheck install -e npm vite-plugin-pwa workbox-build workbox-window
  [OK] vite-plugin-pwa (npm)
  [OK] workbox-build (npm)
  [OK] workbox-window (npm)
  scanned 3 packages, 3 OK
  added 394 packages in 11s
installed in scratch: vite-plugin-pwa@2.0.0 workbox-build@7.4.1 workbox-window@7.4.1

$ npm view <pkg>@<ver> version scripts.postinstall scripts.install scripts.preinstall repository.url
vite-plugin-pwa@2.0.0  version = '2.0.0'  repository.url = 'git+https://github.com/vite-pwa/vite-plugin-pwa.git'
workbox-build@7.4.1    version = '7.4.1'  repository.url = 'git+https://github.com/googlechrome/workbox.git'
workbox-window@7.4.1   version = '7.4.1'  repository.url = 'git+https://github.com/googlechrome/workbox.git'
(no postinstall / install / preinstall fields printed: none exist)

$ npm view vite-plugin-pwa@2.0.0 peerDependencies
{ vite: '^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0',
  'workbox-build': '^7.4.1', 'workbox-window': '^7.4.1',
  '@vite-pwa/assets-generator': '^1.0.0 || ^2.0.0' }   (assets-generator is optional, not installed)
```

`git status --porcelain` in the worktree was empty before the install. The install ran as `npm install --save-dev --save-exact vite-plugin-pwa@2.0.0 workbox-build@7.4.1 workbox-window@7.4.1`. `git diff package.json` showed only the three new devDependencies.

Audits:

```
$ npm audit --omit=dev
found 0 vulnerabilities

$ npm audit   (dev tree, build-time only)
before this plan: 4 moderate (eslint, @eslint/js, @eslint/config-array, minimatch)
after:            9 vulnerabilities (2 low, 7 moderate)
  moderate  @eslint/config-array >=0.23.0       (pre-existing)
  moderate  @eslint/js >=10.0.1                 (pre-existing)
  moderate  eslint >=10.0.0-alpha.0             (pre-existing)
  moderate  minimatch 7.0.0 - 11.0.0            (pre-existing chain; also pulled by workbox-build)
  moderate  glob 9.0.0 - 14.0.1                 (new, via workbox-build)
  moderate  workbox-build >=6.0.0-alpha.0       (new)
  moderate  vite-plugin-pwa >=1.2.0             (new, via workbox-build)
  low       @rollup/plugin-node-resolve >=8.0.0 (new, via workbox-build)
  low       deepmerge >=4.2.0                   (new, via workbox-build)
```

This matches the RESEARCH figure (9: 2 low, 7 moderate). All of these are build-time only. The browser receives only the inlined Workbox runtime and, from 04-06 on, workbox-window.

Config: `VitePWA({...})` in `vite.config.js` uses exactly the Pattern 7 options, except `selfDestroying: SW_KILL`. `define: { __SW_KILL__: JSON.stringify(SW_KILL) }` comes from the same `const SW_KILL = swKillEffective(process.env)`. The KILL SWITCH comment (steps, DURATION, RE-ENABLE, BLAST RADIUS) sits next to the option. A trailing line `Sibling Cache Storage use: not checked yet (04-14 Task 3).` holds the place 04-14 fills in. The CSP comment and string are unchanged.

Acceptance greps on vite.config.js: `injectRegister: false`, `clientsClaim: true`, `skipWaiting: false`, `cacheId: 'eyeglass-rx'`, `selfDestroying: SW_KILL`, `__SW_KILL__: JSON.stringify(SW_KILL)`, `BLAST RADIUS`, `DURATION` and `RE-ENABLE` each match once. `SW_KILL_REHEARSAL` and `registerType: 'autoUpdate'` match 0 times. In sw-kill-switch.js, `export const SW_SELF_DESTROY = false` and `export function swKillEffective` each match once, and `process` matches 0 times. `selfDestroying:` appears only in vite.config.js.

## Task 2: icons, favicon, build test

- `public/favicon.svg`: viewBox 0 0 64 64, a `#f3f4f6` square, and two `rx=6` rims joined by a curved bridge. Stroke `#1a1a1a`, width 4 (1/16). Presentation attributes only (`grep -c style=` = 0).
- `scripts/make-icons.mjs` renders the PNGs with Playwright's Chromium. `file` reports: icon-192.png 192 x 192, icon-512.png 512 x 512, icon-512-maskable.png 512 x 512 (drawing 410 px = 80 %, centred).
- `index.html` now has `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`. In `dist/index.html` Vite rewrites it to `/Eyeglass-Prescription/favicon.svg`, and the plugin injects `<link rel="manifest" href="/Eyeglass-Prescription/manifest.webmanifest">`.
- `test/dist/pwa-build.test.js` covers:
  - every manifest field, scope and start_url `/Eyeglass-Prescription/`, and the icons array;
  - PNG IHDR sizes for every icon;
  - in index.html: the manifest link, the favicon href, the exact CSP meta, no `registerSW.js`, and no inline `<script>`;
  - the worker shape, chosen by `swKillEffective(process.env)`.
- Negative control (on a tampered copy of dist, then deleted): after removing clientsClaim and the view chunk and adding an unconditional `skipWaiting()`, `checkNormalSw` reported all three failures. `checkDestroyerSw` on the normal dist reported 4 failures. So neither check passes vacuously.

```
$ npm run test:dist
precache size: 928218 bytes (0.928 MB, limit 2000000)
      Tests  17 passed | 1 skipped (18)      (the skipped one is the destroyer branch, flag off)
```

Precache (13 entries): index.html, every file in assets/ (`view-*`, `index-*.js`, `index-*.css`, `engine.worker-*`, `mesh.worker-*`, `compute-protocol-*`, `mesh-protocol-*`), favicon.svg, the three icons, and manifest.webmanifest once.

Destroyer dry run (step 6, nothing committed, `dist-kill-dry` deleted afterwards):

```
$ SW_KILL_REHEARSAL=1 npx vite build --outDir dist-kill-dry   -> built
$ node -e "import('./test/dist/sw-shape.js').then(m => { const f = m.checkDestroyerSw('dist-kill-dry'); console.log(f); process.exit(f.length ? 1 : 0); })"
[]
exit=0
$ wc -c dist-kill-dry/sw.js  -> 608
```

First lines of the 2.0.0 plugin's destroyer (`node_modules/vite-plugin-pwa/dist/index.js` line 173 onwards, the same text as the generated file):

```js
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => { clients.forEach((client) => { if (client instanceof WindowClient) client.navigate(client.url); }); ... })
    .then(() => { self.caches.keys().then((cacheNames) => { Promise.all(cacheNames.map((cacheName) => self.caches.delete(cacheName))); }) });
});
```

This confirms the blast radius in the comment: it deletes every cache name on the origin, not only `eyeglass-rx-*`.

As a cross-check, `SW_KILL_REHEARSAL=1 npx vitest run --project dist test/dist/pwa-build.test.js` against the *normal* `dist/` fails in the destroyer test. That is the expected result for a mismatched build and flag, and it shows that the flag switches the branch.

### D-30 visual check (step 7)

Ground rule 15 for the manually started preview on 4173:
- (a) before starting: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/` printed `000`.
- (b) the build used `GITHUB_SHA=$(git rev-parse HEAD)`.
- (c) after starting: `name="app-commit" content="8d90bdf"`, which equals `git rev-parse --short=7 HEAD` = `8d90bdf` (Task 1 commit; the check ran before Task 2 was committed, on the same working tree).

The preview was stopped afterwards (PID verified as this worktree's `vite preview`), and the port is back to `000`.

The tool was a Playwright Chromium script with a 390 × 844 viewport, because the chrome-devtools MCP is not available here. Headless screenshots contain no browser chrome, so the script loaded the asset URLs directly:
- **shot 1, `/Eyeglass-Prescription/favicon.svg`:** the 64 px glasses drawing (two dark rounded rims and a bridge on the light grey square), top-left on a white page.
- **shot 2, `/Eyeglass-Prescription/icon-512-maskable.png`:** the grey square with the glasses drawing centred and smaller, with clear margins on all sides (the 80 % safe zone), letterboxed by Chromium's black image viewer.
- From the app page, the link hrefs fetched `200 image/svg+xml .../favicon.svg` and `200 application/manifest+json .../manifest.webmanifest`. No response had a status >= 400, and the console showed only 4 WebGL "GPU stall due to ReadPixels" driver warnings (headless GL, unrelated). There were no 404s.

### Runtime unchanged

`npm run test:e2e:live` (dist on 4173): 321 passed, 1 skipped, which equals the 04-02 baseline. `grep -rc "virtual:pwa-register" src/` totals 0, so no worker registers yet.

## Verification

| Command | Result |
|---|---|
| `npx vitest run test/ci/pins.test.js` | 7 passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run lint` | exit 0 |
| `npx vitest run --project unit` (after Task 1) | 49 files, 1901 passed |
| `npm run build && npm run build:e2e && npm run test:dist` | 17 passed, 1 skipped (kill branch); precache 928 218 B |
| `npm run test:e2e:live` | 321 passed, 1 skipped |
| `npm run test:coverage` (final HEAD 8cfb8e1), 1st run | 2 failed / 1899 passed. The failures came at load average ~12 with three parallel executors. The output was piped, so the failing names were not captured. |
| `npm run test:coverage` (final HEAD), rerun | 49 files, 1901 passed. Statements 99.29 %, branches 97.4 %, lines 99.83 % (log header confirms this worktree) |
| `npm run build && npm run build:e2e` (final HEAD) | both exit 0 |

The first coverage failure is treated as load-related, under the brief's "re-run once" rule, and nothing was loosened. This plan changes no file under `src/`, and the unit project excludes `test/dist/`. A parallel worktree's coverage log in the shared scratchpad (`agent-af6c1d86…`) showed the same pattern at that time: 7 failures, all `Test timed out` in the engine property and grid tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] slopcheck argument form**
- **Found during:** Task 1 step 1
- **Issue:** `slopcheck install pkg@ver` treats the version as part of the name and blocks the package as non-existent.
- **Fix:** ran it with bare names in the same empty scratch directory, then confirmed the resolved versions (2.0.0/7.4.1/7.4.1) and the absence of install scripts with `npm view <pkg>@<ver>`.
- **Commit:** none (no repo change)

**2. [Rule 1 - Bug] Plan text vs. its acceptance greps**
- **Found during:** Task 1 acceptance check
- **Issue:** the prescribed comments put `process.env` into sw-kill-switch.js and `SW_KILL_REHEARSAL` into vite.config.js. Both must grep 0.
- **Fix:** reworded both comments without changing their meaning.
- **Commit:** 8d90bdf

**3. [Rule 1 - Bug] Precache size not visible in `npm run test:dist`**
- **Issue:** Vitest 5 hides `console.log` from passing tests, so the acceptance criterion "prints the precache size" failed.
- **Fix:** `process.stdout.write` in the test.
- **Commit:** 8cfb8e1

**4. [Rule 3 - Tooling] D-30 via Playwright, not the chrome-devtools MCP**
- The MCP is not in this executor's toolset, so the same checks (screenshots, console, 404s) ran with Playwright Chromium. See "Worth knowing first".

## Known Stubs

The line `Sibling Cache Storage use: not checked yet (04-14 Task 3).` in the vite.config.js KILL SWITCH comment is intentional. The plan defines it as "result recorded on the next line" by 04-14.

## Threat Flags

None beyond the plan's register. T-04-SC: slopcheck [OK], no install scripts, exact pins, pins.test.js, and `audit --omit=dev` = 0. T-04-14: scope is asserted in the built manifest. T-04-15: documented next to the option. T-04-16: `injectRegister: false`, and the test asserts the CSP and the absence of inline scripts. T-04-17: `cacheId: 'eyeglass-rx'`, prompt mode.

## Commits

- 8d90bdf feat(04-04): pin vite-plugin-pwa and Workbox, configure the service worker with the documented kill switch
- 8cfb8e1 feat(04-04): own app icon, favicon link and the flag-aware PWA build test

## Self-Check: PASSED

All 8 created files exist. Commits 8d90bdf and 8cfb8e1 are in `git log`. STATE.md and ROADMAP.md were not touched (orchestrator-owned).
