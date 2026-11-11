# Phase 03 deferred items

- **03-CI (2026-11-09), out of scope:** at 320 px with DejaVu Sans and the root font size at 150 %,
  the default page with a −12 Rx on both eyes is 345 px wide (horizontal scroll). The summary bar itself
  stays inside 320 px (03-CI fix). Something else on the page does not reflow at a larger text
  size (WCAG 1.4.10). Not investigated: it was found by the new 03-CI bar test, which checks only
  the bar.
- **03-CI (2026-11-09), out of scope:** `e2e/worker.spec.js:331` "no 'rechnet …' for a normal edit"
  fails when heavy SwiftShader specs run in parallel on a loaded machine. It fails on the
  pre-03-CI build c16a39f too, and passes 12 / 12 when run alone. The busy text 'rechnet …' appears
  once the main thread is slow enough. It passed in CI run 42573586930. Watch it in CI; if it
  flakes there, its timing threshold needs a look.

## From the lens-critic re-review (2026-11-11, 03-LENS-CRITIC-RERUN.md)
- m1: CI retry hides flaky results. Write flaky tests to `$GITHUB_STEP_SUMMARY`, `retries: 0` on never-happens/race tests (`worker.spec.js:331`), `failOnFlakyTests` once `layout.spec.js:302` gates the profile reply on a test-controlled promise.
- m2: in fullscreen the Dickenkarte legend and the table-only note are outside the stage; show a compact legend and the note inside it.
- m4: no assertion for the fullscreen button moving to the bottom corner (`view-fs--low`); unit test of `commitHeatLabels` with a forced corner box.
- m5: extract the thumbnail guard into a pure `nextGuard(state, ms)` and unit-test slow-fast-slow.
- VIZ-06: a real Pixel trace in phase 4 (Durchblick SC-2 needs the same measurement).
- e2e: `a11y.spec.js:215` "everything open" at 320 px hits the 30 s test timeout under 4 parallel workers (axe analyze or the settle wait). The baseline build 0776c4a fails the same way (4/4), so it is not caused by the 2026-11-11 changes; CI (fewer workers) passed. Give that case `test.setTimeout(90_000)` or split it.
