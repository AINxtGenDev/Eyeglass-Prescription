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
