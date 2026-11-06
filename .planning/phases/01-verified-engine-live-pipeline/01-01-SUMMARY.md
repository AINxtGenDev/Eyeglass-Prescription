---
phase: 01-verified-engine-live-pipeline
plan: 01
subsystem: toolchain, state/parse, i18n
tags: [scaffold, vite, vitest, eslint, playwright, parser, i18n, de-AT]
requires: []
provides:
  - exact-pinned toolchain (package.json + package-lock.json, .npmrc save-exact)
  - vite.config.js (base /Eyeglass-Prescription/, app-meta %APP_COMMIT%, build-only CSP, coverage gate, vitest project unit)
  - eslint.config.js (engine / state / i18n boundaries, browser globals only in src/ui, innerHTML ban)
  - playwright.config.js + e2e/smoke.spec.js (skeleton contract, RED)
  - src/state/parse.js (parseDiopter, parseAxis, parseMm, PARSE_CODES)
  - src/i18n/format.js (fmtDiopter, fmtAxis, fmtMm, fmtGram, fmtMs)
  - src/i18n/t.js + src/i18n/de-AT.js
affects: [01-02, 01-03, 01-10]
tech-stack:
  added: [vite@8.3.6, vitest@5.1.0, "@vitest/coverage-v8@5.1.0", fast-check@4.10.2, eslint@10.14.0, "@eslint/js@10.0.1", globals@17.14.0, "@playwright/test@1.65.0", "@axe-core/playwright@4.14.0"]
  patterns: [codes-not-strings parse results, Intl de-AT formatting, frozen flat dictionary, lint-enforced layer boundaries]
key-files:
  created: [package.json, package-lock.json, .nvmrc, .npmrc, vite.config.js, eslint.config.js, playwright.config.js, e2e/smoke.spec.js, src/state/parse.js, src/state/parse.test.js, src/i18n/format.js, src/i18n/format.test.js, src/i18n/t.js, src/i18n/t.test.js, src/i18n/de-AT.js, src/i18n/dictionary.test.js]
  modified: [.gitignore]
decisions:
  - "Parsers return +0, never -0 (`-0,00` → 0), so toEqual/Object.is consumers never see a signed zero"
  - "t() leaves an unknown {placeholder} visible instead of printing 'undefined'"
  - "t() interpolation is tested in src/i18n/t.test.js against a vi.mock dictionary, so no test-only key ships in de-AT.js"
metrics:
  duration: 6min
  completed: 2026-11-06
  tasks: 3
  files: 17
---

# Phase 1 Plan 01: Toolchain, Parser and de-AT Dictionary Summary

This plan adds the exact-pinned Vite/Vitest/ESLint/Playwright toolchain and the lint-enforced layer boundaries. It also adds a regex Rx parser that never uses `parseFloat` and returns error codes. Display formatting is Intl de-AT with U+2212 minus and NBSP units, and every string comes from one frozen German dictionary looked up by `t()`. The browser smoke contract is written and RED, as planned.

## Package legitimacy gate (Task 1)

The user answered **"approved"** on 2026-11-06 for exactly these packages: vite@8.3.6, vitest@5.1.0, @vitest/coverage-v8@5.1.0, fast-check@4.10.2, eslint@10.14.0, @eslint/js@10.0.1, globals@17.14.0, @playwright/test@1.65.0 and @axe-core/playwright@4.14.0. At approval time `node_modules` had 0 entries (re-checked by the executor before install: `ls node_modules | wc -l` gave 0). The orchestrator verified each package with `npm view <pkg> version repository.url`. Every version exists, and the repos are vitejs/vite, vitest-dev/vitest (both vitest packages), dubzzz/fast-check, eslint/eslint (eslint and @eslint/js), sindresorhus/globals, microsoft/playwright and dequelabs/axe-core-npm. No other package was installed.

`npm install` reported 157 packages added and 4 moderate advisories, all from the same chain: minimatch → @eslint/config-array → eslint → @eslint/js (GHSA-g3hv-75wg-m249). This is dev-only and matches the accepted threat T-01-12. No fix was applied, because `npm audit fix --force` would downgrade eslint to 9.

## Tasks

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Package legitimacy gate | (no commit; user approval) | none |
| 2 | Scaffold, configs, RED smoke | 29a016f | package.json, vite.config.js, eslint.config.js, playwright.config.js, e2e/smoke.spec.js |
| 3 RED | Failing tests | 2a4f3bd | src/state/parse.test.js, src/i18n/{format,dictionary,t}.test.js |
| 3 GREEN | Parser, formatter, t(), dictionary | cab03f0 | src/state/parse.js, src/i18n/{format,t,de-AT}.js |

## Verification evidence

- `npm run lint`: exit 0.
- `npx vitest run --project unit`: 4 files, **70 tests passed**. RED was observed first: all 4 files failed on missing modules before the implementation.
- Exact pins: all 9 devDependencies match `^\d+\.\d+\.\d+$`; `package-lock.json` is committed.
- `fmtDiopter(-2.25)` prints `"−2,25 dpt"`, code points `2212 32 2c 32 35 a0 64 70 74` (U+2212 and U+00A0 confirmed).
- Grep gates: `parseFloat|Number(raw` in parse.js = 0. `Stärke` in de-AT.js = 0. `±0,2 mm` = 0. `±0,3 mm` = 1. `disclaimer.body` line: `Vogel-Regel` = 0, `dicker` = 1. `globals.browser` = 1 (inside the `src/ui/**` block). `.gitignore` still has `references/`.
- ESLint boundary probe (`ESLint.lintText`, no file written):
  - `three` import in the engine → `no-restricted-imports`
  - `document` in the engine → `no-restricted-globals` and `no-undef`
  - `HTMLElement` in the engine → `no-undef`
  - `../ui/` import from state → `no-restricted-imports`
  - `innerHTML` in the UI → `no-restricted-syntax`
  - `document` in the UI → clean

### RED smoke output (expected)

`npx playwright test --project=desktop` exits **1** with `Error: Timed out waiting 60000ms from config.webServer.` The cause was checked: `vite preview` starts but answers **404** at `http://localhost:4173/Eyeglass-Prescription/`, because no `index.html` or `dist/` exists yet. Playwright therefore never sees the server ready. No preview process was left listening on port 4173 afterwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Signed zero from the parser**
- **Found during:** Task 3 (test design)
- **Issue:** Following the plan's step 6 literally, `-0,00` produces `Number('-0.00')`, which is `-0`. That can leak a signed zero into the engine and into `Object.is` comparisons.
- **Fix:** Results are normalised with `value + 0`. A test asserts `parseDiopter('-0,00')` equals `{ ok: true, value: 0 }`.
- **Commit:** 2a4f3bd / cab03f0

**2. [Rule 3 - Blocking] Grep gates tripped by comments**
- **Found during:** Task 3 verification
- **Issue:** Explanatory comments contained the literal words `Stärke` (in de-AT.js) and `globals.browser` (in eslint.config.js). That broke the `grep -c` acceptance gates, which count comments too.
- **Fix:** Reworded both comments. The eslint.config.js wording fix landed in the Task 3 commit cab03f0, not in the Task 2 commit.

**3. [Scope addition] `src/i18n/t.test.js`**
- This file is not in `files_modified`. Interpolation needs a key with `{params}`, and no such key exists in 01-01. The test mocks the dictionary instead of shipping a test-only key in production. The missing-key throw is covered there as well as in dictionary.test.js.

**4. [Minor] Robustness choices beyond the spec**
- `t()` keeps an unmatched `{name}` placeholder visible instead of printing `undefined`.
- `import.meta.env?.PROD` uses optional chaining so `t.js` also loads in plain Node, outside Vite.
- `parseMm` returns `PARSE_TOO_MANY_DECIMALS` for 2+ decimals, and `PARSE_NOT_A_NUMBER` for negative values.
- `parseAxis` tolerates whitespace after `x`/`×`/`@`.

## Notes for downstream plans

- **01-03:** the smoke test runs against `vite preview`, which serves `dist/`. Run `npm run build` before `npm run test:e2e` locally; the CI workflow must do the same. `index.html` must contain the literal `%APP_COMMIT%` placeholder inside `#app-commit`, and `<meta charset ...>` so the CSP plugin has an anchor.
- **01-03:** smoke test 3 expects `#result-od-basecurve` to contain `Vogel`. The disclaimer deliberately avoids "Vogel-Regel" (D-01 final). lens-critic should check that this base-curve readout wording is still consistent with the D-01 decision.
- The mobile Playwright project uses Desktop Chrome with a 360×780 viewport and `isMobile`/`hasTouch`. It is not a real device profile (ENG-09 still needs real-device measurement).

## Known Stubs

None. The dictionary holds only the keys this plan owns; 01-03 and 01-10 add theirs, as planned.

## Threat Flags

None. No network, auth or storage surface was added. The build-only CSP and the innerHTML ban implement T-01-05 as planned.

## Self-Check: PASSED

- All 16 created files and the modified .gitignore exist on disk.
- Commits 29a016f, 2a4f3bd and cab03f0 are present in `git log`.
