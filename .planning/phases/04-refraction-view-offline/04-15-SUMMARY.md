---
phase: 04-refraction-view-offline
plan: 15
subsystem: build-ci
tags: [F-01, F-03, lens-critic-m1, ci, playwright, flaky]
requires: ["04-02"]
provides:
  - "e2e/support/flaky-reporter.js: Playwright reporter listing tests with outcome 'flaky' in $GITHUB_STEP_SUMMARY"
  - "playwright.config.js reporter: CI [['dot'], flaky-reporter], local 'list'"
  - "never-happens race test (worker.spec.js) at retries 0"
  - "a11y 'everything open' state at test.setTimeout(90_000)"
affects: [04-13 push/CI run (first CI run with the reporter)]
tech-stack:
  added: []
  patterns:
    - "reporter inside the test step: no always()/|| true step, onEnd returns nothing, I/O errors only to stderr"
    - "test.describe.configure({ retries: 0 }) for assertions that must never happen"
key-files:
  created:
    - e2e/support/flaky-reporter.js
    - test/ci/flaky-reporter.test.js
  modified:
    - playwright.config.js
    - e2e/worker.spec.js
    - e2e/a11y.spec.js
    - .planning/phases/04-refraction-view-offline/deferred-items.md
decisions:
  - "Flaky line format: `project › file:line › describe › title`, file relative to config.rootDir; empty parts are skipped"
  - "printsToStdio() returns false so the dot reporter keeps the console"
  - "The 'everything open' state is matched by name prefix ('everything open'), next to the existing '3D ' rule"
metrics:
  duration: "~60 min (mostly test runs under load 8–19)"
  completed: 2026-11-13
---

# Phase 4 Plan 15: Flaky reporter, race test at retries 0, a11y timeout Summary

CI now lists every Playwright test that passed only on its retry in the GitHub job summary, from inside the existing `npm run test:e2e` / `test:e2e:live` steps and without touching the exit code. The never-happens race test runs without retries, and the a11y "everything open" state has a 90 s timeout.

## What was built

- **Task 1 (F-01):** `e2e/support/flaky-reporter.js` stores the root suite in `onBegin`. In `onEnd` it appends a `### Flaky tests (passed only on retry)` section to `$GITHUB_STEP_SUMMARY`: one line per flaky test, or `No flaky tests.`. If the env var is not set it does nothing. A write error goes to `console.error` and does not throw. `onEnd` returns `undefined`, so the run status is untouched. `playwright.config.js`: `reporter: process.env.CI ? [['dot'], ['./e2e/support/flaky-reporter.js']] : 'list'`. `deploy.yml` is unchanged.
- **Task 2 (F-01, F-03):** `worker.spec.js` wraps `no "rechnet …" for a normal edit` in `test.describe('never-happens race (F-01)')` with `test.describe.configure({ retries: 0 })`; the test body is unchanged. `a11y.spec.js` adds `if (name.startsWith('everything open')) test.setTimeout(90_000);` next to the 3D rule.

## Verification (real output, load average next to each run)

All scratchpad evidence below comes from files named `04-15-*`, re-run after the orchestrator's shared-scratchpad warning. Earlier runs through generic file names are not used.

| Check | Result | Load (1-min) |
|---|---|---|
| `npx vitest run test/ci` | 5 files, 38 tests passed (6 reporter cases) | – |
| `npm run lint` | clean | ~11 |
| `npm run build`, `npm run build:e2e` | built | ~11 |
| `npm run test:dist` | 2 files, 13 tests passed | ~11 |
| `npx vitest run --project unit` (no coverage) | 50 files, 1906/1906 passed | 11.0 → 14.3 |
| `npm run test:coverage` (`04-15-coverage.log`) | **1905/1906**: `diagnostics.test.js:206` timed out (147 s against 120 s). See Deferred Issues | 8.0 → 4.6 |
| Real-Playwright probe, `CI=1`, retries 1, named project `mobile` (`04-15-pwprobe`) | A test that passes only on the retry is reported "1 flaky" and the summary file gets `- mobile › probe-flaky.spec.mjs:2 › 04-15 passes only on retry`. A test inside `describe.configure({ retries: 0 })` that fails on its first attempt gives "1 failed", exit 1, and is not shown as flaky | 5.5 |
| `CI=1 … e2e/worker.spec.js -g "never-happens" --repeat-each=10` | 20/20 passed in 20.4 s, summary "No flaky tests." | ~9 → 9.0 |
| `e2e/a11y.spec.js --workers=4 -g "everything open" --repeat-each=3` | 6/6 passed; per test 34.9 s, 44.5 s, 46.8 s, 53.6 s (desktop/mobile) and 22.5 s, 17.8 s. **Four of six ran past the old 30 s default**, all under 90 s | 8.9 → 18.7 |
| Full `e2e/worker.spec.js e2e/a11y.spec.js`, CI mode, 4 workers (`04-15-full.log`) | 62/62 passed in 3.7 min, exit 0, summary "No flaky tests." | 16.4 → 11.3 |

Acceptance greps: `grep -c "flaky-reporter" playwright.config.js` = 1; `grep -cE "continue-on-error|always\(\)|\|\| true" .github/workflows/deploy.yml` = 0; `grep -c "retries: 0" e2e/worker.spec.js` = 1; `grep -c "90_000" e2e/a11y.spec.js` = 2 (≥ 1).

Ports: before each Playwright run, `curl -s -o /dev/null -w '%{http_code}' http://localhost:4174/` printed `000`. No server was started by hand (no D-30 MCP protocol: this plan touches no UI).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty project title gave a malformed summary line**
- **Found during:** Task 2, a real-Playwright probe of the reporter
- **Issue:** with a config that has no named projects, `titlePath()[1]` is `''` and the line read `-  › probe-flaky.spec.mjs:2 › …`
- **Fix:** join `[project, where, ...titles].filter(Boolean)`; added a unit case for it
- **Files modified:** e2e/support/flaky-reporter.js, test/ci/flaky-reporter.test.js
- **Commit:** 8b9b7ea

**2. [Rule 2] `printsToStdio()` returns false** (not in the plan) so Playwright treats the dot reporter as the console reporter. Unit-tested.

## Deferred Issues

- `npm run test:coverage` is not green on this machine at load 8–11: `src/engine/diagnostics.test.js:206` (ENG-07 extremes grid) times out (147 s against 120 s). Without coverage the same suite passes 1906/1906. 04-15 changes nothing under `src/`. The timeout was not raised (rule of this plan). Logged in `deferred-items.md`; re-run on an idle machine before the 04-13 push.
- I could not reproduce the original F-03 failure as a failure, because the new timeout is already in place. The evidence that the fix is needed is the four runs above 30 s at load 9–19.

## TDD Gate Compliance

RED `56e1279` (`test(04-15)`, failed with "Cannot find module"), then GREEN `62fe495` (`feat(04-15)`). Present.

## Threat mitigations

T-04-08: flaky tests are written to the job summary, and the race test runs at retries 0 (proved with the probe). T-04-08b: `onEnd` returns nothing, and `deploy.yml` gets no new step, so `workflow-structure.test.js` still passes.

## Commits

- 56e1279 test(04-15): add failing test for the flaky reporter (F-01)
- 62fe495 feat(04-15): flaky reporter writes retried passes to the job summary (F-01)
- 8b9b7ea fix(04-15): flaky reporter skips an empty project title
- d9442b7 test(04-15): race test at retries 0 (F-01) and a11y 'everything open' at 90 s (F-03)

## Self-Check: PASSED

Files found: e2e/support/flaky-reporter.js, test/ci/flaky-reporter.test.js, 04-15-SUMMARY.md. Commits found in `git log`: 56e1279, 62fe495, 8b9b7ea, d9442b7. STATE.md and ROADMAP.md are not touched (the orchestrator owns them).
