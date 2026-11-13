---
phase: 04-refraction-view-offline
plan: 02
subsystem: build-ci
tags: [F-04, AR-03-04, M4, NEW-5, NEW-8, NEW-12, ci, playwright, vite]
requires: []
provides:
  - "MODE-gated window.__eyeglassView (absent from dist/)"
  - "npm run build:e2e / preview:e2e (dist-e2e on 4174), test:e2e:live (LIVE_SPECS on dist 4173), test:dist (vitest project 'dist')"
  - "e2e/support/live-specs.js LIVE_SPECS"
  - "test/dist/hooks.test.js (HOOK_STRINGS), test/dist/parity.test.js (PARITY_ALLOW), test/ci/env-gates.test.js (ALLOW_ENV)"
affects: [04-04 pwa-build test joins test:dist, 04-05/04-08 warp-protocol chunk, 04-06 pwa project, 04-08 Durchblick live smoke, 04-10 refdegraded hook]
tech-stack:
  added: []
  patterns:
    - "static build-time gate: if (import.meta.env.MODE !== 'production') { ... }"
    - "two builds of one commit; parity enforced by hashed-name diff + normalised comparison"
key-files:
  created:
    - e2e/support/live-specs.js
    - test/dist/hooks.test.js
    - test/dist/parity.test.js
    - test/ci/env-gates.test.js
    - test/ci/live-subset.test.js
  modified:
    - src/ui/view/view.js
    - package.json
    - vite.config.js
    - playwright.config.js
    - eslint.config.js
    - .gitignore
    - .github/workflows/deploy.yml
    - test/ci/workflow-structure.test.js
decisions:
  - "Default e2e server is dist-e2e on 4174; E2E_LIVE=1 serves the production dist on 4173 and restricts desktop/mobile to LIVE_SPECS"
  - "Every webServer uses reuseExistingServer: false (NEW-5): a port clash fails loudly"
  - ".gitignore anchors /dist/ and /dist-e2e/ to the repo root so test/dist/ is tracked"
metrics:
  duration: "~30 min"
  completed: 2026-11-13
  tasks: 2
  files: 13
---

# Phase 4 Plan 02: Gated test handle, e2e build and parity gates Summary

The production bundle no longer ships `window.__eyeglassView`. CI now builds `dist/` (deployed) and `dist-e2e/` (`vite build --mode e2e`) from the same commit. The full e2e suite runs against `dist-e2e`, a hook-free live subset runs against `dist` and the live URL, and two enforcing tests limit the difference between the builds to the gated hook.

## What was built

- **F-04 gate** (`src/ui/view/view.js`): only the `window.__eyeglassView = Object.freeze({...})` assignment is wrapped in `if (import.meta.env.MODE !== 'production')`. The block was re-indented, and `git diff -w` shows 4 added lines and nothing else. The query flags are unchanged.
- **Scripts:** `test:coverage` now runs only the unit project. New scripts: `build:e2e`, `preview:e2e` (port 4174), `test:e2e:live` (`E2E_LIVE=1`) and `test:dist`.
- **Vitest projects:** `unit` excludes `test/dist/**`. The new `dist` project reads the build output.
- **Playwright:** the default server is `preview:e2e` on 4174. With `E2E_LIVE=1` the server is `preview` on 4173, and `testMatch` is a RegExp built from LIVE_SPECS. BASE_URL still disables the server. Every webServer uses `reuseExistingServer: false`.
- **Live subset** (`e2e/support/live-specs.js`): smoke, rx, results, frame, presets, compare, expert, xsec. All 8 stayed in the list; none had to be removed.
- **Tests:**
  - `hooks.test.js`: `dist/` has no hook string, and `dist-e2e/assets/` has one as a positive control. If a build directory is missing, the test fails and never skips.
  - `parity.test.js`: worker names and bytes are equal. Every differing name must match a whole-name PARITY_ALLOW pattern, and every shared name is byte-identical. The `normalisedEqual` entries must be identical after normalising hashed names. It also checks the entry-kind rule (exactly one non-normalised entry, `view-*`), a positive control, and the synthetic cases the plan requires.
  - `env-gates.test.js`: the ALLOW_ENV allow-list, a positive control and two synthetic failure cases.
  - `live-subset.test.js`: every listed spec exists and uses no hook.
- **CI** (`deploy.yml`): the build job order is npm ci, lint, test:coverage, build, build:e2e, playwright install, test:e2e, test:e2e:live, test:dist, then configure-pages and upload `./dist`. verify-live runs `test:e2e:live` against the live URL. `workflow-structure.test.js` asserts this order and the verify-live change.

## Measured dist vs dist-e2e difference (2026-11-13)

```
dist/assets:      compute-protocol-DQNrNUt6.js engine.worker-D73Rly2A.js index-BJ3rYsJ-.js index-CfbMlrQS.css mesh-protocol-BkPkhGg7.js mesh.worker-BNH_sLFV.js view-D9AmIX5D.js
dist-e2e/assets:  compute-protocol-BUATIwap.js engine.worker-D73Rly2A.js index-C_FTMivu.js index-CfbMlrQS.css mesh-protocol-DiK7vcv8.js mesh.worker-BNH_sLFV.js view-Cv3_G2jJ.js
```

- The names of 4 chunks differ: `view-*`, `index-*.js`, `compute-protocol-*` and `mesh-protocol-*`. This matches the lens-critic round-4 NEW-12 expectation exactly.
- Both workers and the CSS have identical names and identical bytes.
- After normalising hashed names, index, compute-protocol and mesh-protocol are byte-identical.
- `warp-protocol` is logged as `not built yet`.
- The measured hash form is 8 characters of `[A-Za-z0-9_-]` (for example `index-BJ3rYsJ-.js`), so HASH was left unchanged.
- `dist/` contains no `__eyeglassView`; `dist-e2e/assets/view-Cv3_G2jJ.js` does.

## Verification

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npx vitest run --project unit` | 48 files, 1813 passed (test/dist not collected) |
| `npm run build && npm run build:e2e` | both built |
| `npm run test:dist` | 2 files, 13 passed |
| `npx vitest run test/ci` | 4 files, 32 passed |
| `npm run test:e2e:live` (dist, 4173) | 321 passed, 1 skipped; includes smoke.spec.js |
| `npm run test:e2e` (dist-e2e, 4174) | 570 passed, 38 skipped, 8 failed (23.9 min, load average about 15 with the parallel 04-01 worktree) |
| rerun of the 8 failed tests (desktop) | 6 of 8 passed; the remaining 2 (layout.spec.js:205 setViewportSize timeout, view-fullscreen.spec.js:63 Fullscreen API) also passed with `--workers=1` (2 passed, 18.5 s, load 2.6) |

The 8 full-run failures were timing failures under host load: axe at 320 px, layout breakpoint and disclaimer, view-controls chart cover, fullscreen, two view-heat notes, and worker "rechnet". All 8 passed on rerun. None of them touches what this plan changed: the dist-e2e build contains the handle exactly as before, and `git diff -w` on view.js shows only the gate. No single clean full-suite run exists for this plan yet. CI on main will be the first. The carried flaky-test work is 04-15.

Acceptance greps: the MODE gate expression appears once in view.js. `reuseExistingServer: false` is present, and `!process.env.CI` is no longer in the config. `test:e2e:live` appears 2 times in deploy.yml and `build:e2e` once. Bypass constructs: 0. The `test:coverage` script line matches the plan exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.gitignore` `dist/` also ignored `test/dist/`**
- **Found during:** Task 1 commit (`git add` refused `test/dist`)
- **Fix:** anchored the build directories: `/dist/` and `/dist-e2e/`
- **Files modified:** .gitignore
- **Commit:** 9c381fd

**2. [Rule 3 - Blocking] ESLint would lint the new build output**
- **Issue:** `eslint .` ignored only `dist/**`, so the minified bundle in `dist-e2e/` would be linted after `build:e2e`.
- **Fix:** added `'dist-e2e/**'` to the ignores, next to `'scripts/**/*.mjs'` (which the plan asked for).
- **Files modified:** eslint.config.js
- **Commit:** 9c381fd

**3. [Rule 2 - Correctness] Shared asset names are also checked for byte equality**
- **Issue:** the plan treats an equal content-hashed name as proof of equal bytes.
- **Fix:** parity.test.js also compares the bytes of every shared name and every worker, so the gate does not rely on the hashing alone.
- **Commit:** 9c381fd

## Known Stubs

None.

## Threat Flags

None. The change removes surface: T-04-06 is mitigated by the MODE gate plus hooks.test.js, T-04-07 by parity.test.js and env-gates.test.js, and T-04-09 by the structure test.

## Notes for later plans

- `index.html` is outside the parity check, which only covers `dist/assets/`. It differs only in the hashed entry name it references. A later plan could add a normalised comparison of it.
- 04-08 adds the `guardPage(test, { view: true })` assertion in live-subset.test.js. 04-10 extends HOOK_STRINGS and ALLOW_ENV.

## Commits

- 9c381fd feat(04-02): gate the test handle, add the e2e build, live subset and parity gates
- 598e343 ci(04-02): build dist and dist-e2e, run full e2e, live subset and dist tests before upload

## Self-Check: PASSED

All 5 created files exist. Commits 9c381fd and 598e343 are present in `git log`.
