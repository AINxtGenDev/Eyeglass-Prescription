# Phase 04 deferred items

## From the lens-critic plan review, round 1 (2026-11-13, 04-LENS-CRITIC-R1.md MINOR 11)

- **Older test query switches ship in production (out of scope for phase 4).** Seven test-only
  switches from phases 2–3 are read from `location.search` in the production bundle. Anyone can turn
  them on by adding the query string to the live URL. Evidence: `grep -rnE` over `src/` (non-test
  `.js`) at commit f9c55f8:
  - `thumbguardoff`: `src/ui/view/view.js:154`
  - `failframe`: `src/ui/view/view.js:163–167` (`new URLSearchParams(location.search).get('failframe')`)
  - `perfmarks`: `src/ui/view/view.js:161`, `src/ui/pipeline.js:51`, `src/ui/main.js:61`, `src/ui/timing.js:24`
  - `nowebgl`: `src/ui/view/scene.js:97`
  - `cmpdelay`: `src/ui/pipeline.js:497`
  - `msgprobe`: `src/ui/pipeline.js:396`
  - `calloutsoff`: `src/ui/view/labels.js:84`

  Related (not a query switch, same kind of gap): `window.__eyeglassNo3d` is read in production at
  `src/ui/pipeline.js:230`; it is set only by an e2e init script.

  Why it is deferred: phase 4 gates only the new hooks (`__eyeglassView` F-04, `refdegraded`). The
  gate it creates can cover these: `import.meta.env.MODE !== 'production'` around each read,
  `test/dist/hooks.test.js` `HOOK_STRINGS` extended with the seven names, and
  `test/ci/env-gates.test.js` `ALLOW_ENV` extended with the files (04-02). Caveat for the later
  plan: the live subset and the `perf` project may depend on some of them (`perfmarks` in the perf
  project, `nowebgl` in the no-WebGL specs), so each switch needs a check of which build its specs
  run against before it is gated.

## From 04-15 (2026-11-13, out of scope: files not touched by 04-15)

- **Engine grid test times out under `--coverage` at load average 8–11.** `npm run test:coverage` in the
  04-15 worktree (three parallel executors on 8 cores, start 13:13:52) gave 1905/1906. The one failure:
  `src/engine/diagnostics.test.js:206` (ENG-07 extremes grid) `Test timed out in 120000ms`, after 147 s.
  An earlier 04-15 run reported 2 failures, but its log was in a scratchpad file shared with other
  worktrees, so it is not used as evidence. The same suite without coverage passed 1906/1906 at load
  11–14 (`npx vitest run --project unit`). 04-15 changes no file under `src/`. This looks like CPU
  contention, not a logic failure. It was not "fixed" by raising the timeout (04-15 rule). Re-run
  `npm run test:coverage` on an idle machine before the push in 04-13.
