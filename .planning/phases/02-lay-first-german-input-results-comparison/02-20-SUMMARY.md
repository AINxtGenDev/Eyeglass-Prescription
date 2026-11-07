---
phase: 02-lay-first-german-input-results-comparison
plan: 20
subsystem: ENG-09 timing, compare lane start, perf proxy harness
tags: [ENG-09, RES-02, lens-critic-M4, ENG09-PROXY-1, ENG09-PROXY-2, ENG09-PROXY-3, ENG09-PROXY-4, gap-closure, perf]
requires: [02-19]
provides:
  - "?perfmarks opt-in user timings (u:* segments of update / requestMain / startCompare, u:inputFrame = the ring's frame window)"
  - "PERF_TRACE attribution mode in e2e/perf-throttled.spec.js (Chromium trace, per-frame buckets incl. DevTools-session tasks, raw .trace.json files)"
  - "Deferred, coalesced compare start: scheduleCompareStart in requestMain, posted by onInputFrameEnd after the input frame's end stamp (MessageChannel), 'queued' token in #compare[data-pending]"
  - "compareStart ring + #timing-compare-start readout with data-min-gap; counted in verdict (a)"
  - "ENG-09 set to Pending in REQUIREMENTS.md (FAIL path), M4 stays an open MAJOR"
affects: [src/ui/pipeline.js, src/ui/timing.js, src/ui/main.js, src/i18n/de-AT.js, index.html, e2e/perf-throttled.spec.js, e2e/compare.spec.js, .planning/REQUIREMENTS.md]
tech-stack:
  added: []
  patterns:
    - "Work after an input frame is posted from the frame's after-paint timeout, after the end stamp; a following task that finds a newer unstamped frame skips and is re-posted by that frame's end"
    - "Opt-in perf instrumentation behind a module constant read from location.search (?perfmarks, ?cmpdelay), zero work without the flag"
key-files:
  created: []
  modified:
    - src/ui/pipeline.js
    - src/ui/timing.js
    - src/ui/main.js
    - src/i18n/de-AT.js
    - index.html
    - e2e/perf-throttled.spec.js
    - e2e/compare.spec.js
    - .planning/REQUIREMENTS.md
decisions:
  - "MJ-1 order: runFrame's after-paint setTimeout stamps the input frame first, then calls onInputFrameEnd(end), which posts the compare start through a MessageChannel; the task returns early while a newer input frame is unstamped (that frame's end re-posts)"
  - "m-c: paintCompare returns early while a start is queued (no rows cleared or marked in the input frame); the deferred task schedules the paint"
  - "Verdict FAIL per the fixed rule; ENG-09 Pending; M4 open MAJOR for explicit user acceptance at 02-15; the harness question (a DevTools-session task inside the measured window) goes to the user and lens-critic, not tuned here"
metrics:
  duration: "~45 min"
  completed: 2026-11-07
  tasks: 3
---

# Phase 02 Plan 20: ENG-09 (a) proxy regression, lens-critic M4 Summary

The compare-lane start now runs in a task after the input frame's end stamp. The trace shows that this was not what pushed the 4× input frame over the limit. The 4× proxy still fails ENG-09 (a) in 3 of 3 runs, so ENG-09 is Pending again and lens-critic M4 stays an open MAJOR.

**Watch first:** at 4×, the measured input-frame window contains a **DevTools-session mojo task from the Playwright harness** in every traced frame (29 of 30 before, 20 of 20 after). It takes 10–16 ms. It runs after the frame's Commit and before the after-paint timeout that stamps the frame. The app's own work in the window is at most 9,7–11,8 ms: the frame minus that task. The fixed pass rule counts the whole window, so the verdict is FAIL. Two options are open, and choosing between them is a user/lens-critic decision, not something this plan may tune: change the harness so it does not land a CDP command inside the measured window, or accept the gap.

## Task 1: Attribution (profile first)

**Method**
- User timings sit behind `?perfmarks`, a module constant in main.js, pipeline.js and timing.js.
  - `u:readRx`, `u:readFrame`, `u:material`, `u:materialLine`, `u:specs`, `u:notes` and `u:requestMain` wrap the `update()` segments, and `u:update` wraps the whole function.
  - `u:rm.keys`, `u:rm.request`, `u:rm.rimFootnote` and `u:rm.startCompare` wrap the `requestMain` segments.
  - `u:sc.markOutdated`, `u:sc.buildJobs`, `u:sc.sendCompare` and `u:sc.schedulePaint` wrap the `startCompare` segments.
  - `u:inputFrame` is emitted with exactly the ring's start and end values (rAF start to the after-paint timeout).
  - **Frame boundaries come from the `u:inputFrame` measure**, not from the AnimationFrame events. So the trace window is the same window as the ENG-09 number.
- `PERF_TRACE=<file>` wraps three runs in `browser.startTracing(page, { categories })` / `stopTracing()`: the 4× case A edit run, the 4× case B edit run and the 1× extreme run. Both calls were verified in `node_modules/playwright-core/types/types.d.ts` 1.65.0.
  - Categories: `devtools.timeline`, `disabled-by-default-devtools.timeline`, `blink.user_timing`, `toplevel`, `v8`.
  - A trial trace confirmed where each event lives. `RunTask` is in disabled-by-default-devtools.timeline. Style, layout and paint events are in devtools.timeline. `MinorGC` is in devtools.timeline,v8. Measures appear as nestable async b/e pairs, or as `n` when they have zero length.
- Buckets per frame (ms):
  - The u:* leaves.
  - style (`UpdateLayoutTree`), layout (`Layout`) and paint (`PrePaint`/`Paint`/`Layerize`/`Commit`), counted outside `u:update`. GC (`MinorGC`/`MajorGC`) is counted the same way.
  - `forcedInJs`: style, layout or GC inside JS.
  - `devtoolsInFrame`: the `Receive mojo message` events with `mojo_interface_tag = blink.mojom.DevToolsSession`.
  - `other` = RunTask coverage − JS − rendering − GC. `idle` = window − RunTask coverage.
  - `otherTop`: self time by event name.
  - Every main-thread task over 4 ms within 100 ms after the frame start.
- The page was opened with `?perfmarks` and traced, so these runs are inflated by tracing overhead. Traced 4× case A median was 18,9–21,3 ms; untraced after-runs were 17,3–18,0 ms. Use the traced runs for the attribution only, never for the verdict.
- `uptime` load before the three runs: 1,19 / 2,00 / 2,84 on 8 cores.

**Raw files** (scratchpad, not committed). Paths are under `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/`:
- `trace-02-20-before-run{1,2,3}.json`: the attribution.
- `trace-02-20-before-run{1,2,3}.{4x-caseA,4x-caseB,1x-extreme}.trace.json`: raw traces that can be loaded in the DevTools Performance panel.
- `perf-02-20-before-run{1,2,3}.json`.

**Attribution: median / max per run (ms, traced)**

| Bucket | 4× case A run1 | run2 | run3 | 4× case B run1 | run2 | run3 |
|---|---|---|---|---|---|---|
| frame (window) | 21,3 / 22,8 | 18,9 / 21,6 | 19,95 / 27,0 | 20,85 / 23,3 | 18,9 / 22,5 | 19,9 / 23,0 |
| **DevTools-session task in window** | 11,4 / 12,72 | 10,05 / 13,16 | 10,99 / 15,64 | 11,07 / 13,28 | 10,43 / 13,95 | 10,63 / 14,24 |
| paint (PrePaint+Paint+Layerize+Commit) | 5,27 / 7,12 | 4,73 / 5,76 | 5,19 / 6,17 | 6,84 / 7,61 | 5,82 / 7,11 | 5,27 / 6,30 |
| u:update (all JS of the frame) | 2,7 / 3,5 | 2,45 / 3,0 | 2,9 / 3,5 | 2,75 / 3,3 | 2,4 / 3,0 | 2,4 / 3,3 |
| – u:readRx | 0,8 / 1,4 | 0,85 / 1,3 | 1,0 / 1,3 | 1,0 / 2,1 | 0,9 / 1,2 | 0,95 / 1,6 |
| – u:rm.startCompare (compare start) | 0,35 / 0,9 | 0,45 / 0,8 | 0,25 / **1,1** | 0,3 / **1,0** | 0,35 / 0,9 | 0,25 / 0,9 |
| – u:sc.buildJobs | 0 / 0,2 | 0 / 0,6 | 0 / 0,6 | 0 / 0,7 | 0,05 / 0,3 | 0,2 / 0,8 |
| – u:sc.markOutdated | 0 / 0,1 | 0 / 0,4 | 0 / 0 | 0 / 0,1 | 0 / 0 | 0 / 0 |
| layout | 1,1 / 1,68 | 1,21 / 1,58 | 0,99 / 1,69 | 1,51 / 1,67 | 1,15 / 1,86 | 1,06 / 1,34 |
| style | 0,04 / 0,7 | 0,05 / 0,78 | 0,05 / 3,19 | 0,02 / 0,26 | 0,05 / 0,72 | 0,04 / 0,77 |
| GC | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| other (incl. the DevTools task) | 11,63 / 15,75 | 10,79 / 11,9 | 11,42 / 16,34 | 11,08 / 12,01 | 10,0 / 12,25 | 10,7 / 14,52 |
| frame minus DevTools task, median / max | 9,98 / 10,81 | 8,72 / 9,95 | 9,49 / 11,76 | 10,16 / 11,04 | 8,68 / 9,66 | 9,23 / 10,60 |

User-timing values are quantised to 0,1 ms (`performance.now()` resolution on this page).

**Top three buckets of the max frames (4×).** In all six runs they are: (1) the DevTools-session task, 12,2–16,2 ms; (2) paint, 5,0–7,1 ms; (3) JS (u:update) or layout, 1,5–2,1 ms. Example: the run-1 case A trace, first frame. Commit ends at +10,5 ms. Then a `Receive mojo message` task (`blink.mojom.DevToolsSession`, 3,3 KB payload) runs for 20,9 ms. Only after it does the measuring timeout fire, at +31,6 ms. A phone without DevTools does not have this task.

**Compare start in the input frame:** max 0,8–1,1 ms at 4×. It is ≥ 1 ms in 2 of 6 traced runs, so the default change applies (plan rule "≥ 1 ms at 4× max"). It is not one of the top three buckets.

**1× extreme run (ENG09-PROXY-3).**
- Traced max 33,4 / 18,5 / 35,1 ms.
- The longest frames contain **41, 14 and 43 main-thread tasks**. The longest single task is 4,5 / 6,7 / 6,6 ms. 8,9–15,6 ms of the window is idle.
- So the trace confirms the 01-15 diagnosis: the value is several tasks inside one measured window (keystrokes while the bench runs), not one long frame.

## Task 2: Compare start in a following task

- **Order (MJ-1).**
  1. `runFrame` calls `onInputFrameStart()` and then `update()`.
  2. `requestMain` calls `scheduleCompareStart()`. This only sets `compareStartQueued` and writes 'queued' to `#compare[data-pending]`.
  3. The after-paint `setTimeout` in `runFrame` first stamps `timings.inputFrame` / `reaction`, then calls `onInputFrameEnd(end)`. That call posts one MessageChannel message. `?cmpdelay=<ms>` (test only) uses `setTimeout(ms)` instead.
  4. `runCompareStart` returns early if nothing is queued, or if a newer input frame has run and is not stamped yet. That frame's end re-posts it, so the task never runs inside a measured frame.
  5. Otherwise it clears the token. If `client.isCompareCurrent(compareGen)` is false, it runs `startCompare(requested)` with the latest specs. Several input frames before the task still give one build.
- **Why MessageChannel:** it gives a macrotask without setTimeout's clamping. The first, untimed start-up frame goes through the same after-paint hook, and so does a frame where `update` throws, so the compare start is never lost.
- **Stale-delivery evidence.** `client.request` bumps `generation` on a changed main request: compute-client.js:306–308, "Only a change starts a new generation". `isCompareCurrent(gen)` is `gen === generation` (line 459). So a compare answer that arrives between the input frame and the task carries the old gen and is dropped. `onCompare` checks first, and `paintCompare` checks again (T-02-49).
- **m-c:** `paintCompare` returns while a start is queued, and the task schedules the paint. A button `startCompare` (`startConfigCompare`) that runs meanwhile leaves the generation current. The task then only clears the token and schedules the paint.
- **Readout.** The `compareStart` ring holds the duration of the task body. `#timing-compare-start` shows "Vergleich-Start nach dem Eingabe-Frame (letzte n): Median …, längste …" (new de-AT key `tech.timingCompareStart`). `data-min-gap` holds the smallest value of start − input-frame end.
- **Tests (e2e/compare.spec.js).**
  - ENG-09 RES-02 latest-wins: five quick R Sph values. The table equals a fresh page that only ever saw the last value. This test passed before the change too; it is a guard.
  - 'queued' inside the input frame, the readout, and `data-min-gap ≥ 0`.
  - m-c with `?cmpdelay=1200`: the table is unchanged after the main result is painted, also two frames later, and it is correct after `settledCompare`.
  - RED commit 9431ce0: 4 failing, 2 passing (the latest-wins guard).
  - Vorher/Nachher after an edit and the sync fallback hold are covered by the existing tests: compare.spec 'an Rx change recomputes A and B…', 'Vorher shown before A is computed…', and worker.spec 'sync fallback: the comparison runs only after "Vergleich berechnen"'. All pass.
- **Verification output:**
  - `npm run lint`: clean.
  - `npm test`: 1595 passed.
  - `npx playwright test`: 389 passed, 1 skipped.
  - `npx playwright test e2e/compare.spec.js e2e/worker.spec.js --repeat-each=5 --workers=4`: 340 passed.

## Task 3: Re-measurement and verdict

**Method.**
- `npm run build`, then 3 × `PERF_OUT=<scratchpad>/perf-02-20-after-run{1,2,3}.json npm run test:perf`. Each run printed "1 passed (1.4m)".
- `uptime` load before each run: 1,78 / 2,78 / 3,26 on 8 cores.
- One extra traced run: `trace-02-20-after-run1.json` with its `.trace.json` files, and `perf-02-20-after-traced.json`.
- Verdict (a) now also counts the case A and case B compareStart max, and asserts `data-min-gap ≥ 0`. Case B now ends with `settledCompare` so its compareStart ring can be read.

**Table.** Each cell is the min–max over 3 runs. Rows: 02-14 untraced → Task 1 traced → after (untraced). Values in ms.

| Row | 1× | 2× | 4× | 6× |
|---|---|---|---|---|
| BenchmarkIndex | 2012–2172,5 → 1843,5–2029,5 → 1867–2012 | 892,5–1005,5 → 892–930,5 → 847,5–948 | 442,5–508 → 405,5–448,5 → 367–466,5 | 327–343 → 291–315 → 259,5–309 |
| Case A input frame median | 1,55–1,60 → 1,65–2,05 → 1,8–2,25 | 8,00–8,60 → 8,65–9,75 → 7,9–8,85 | 15,60–16,10 → 18,9–21,3 → 17,3–18,0 | 23,65–24,60 → 28,75–29,9 → 28,7–30,2 |
| **Case A input frame max** | 1,70–4,20 → 2,3–17,9 → 2,0–14,1 | 10,00–11,60 → 11,1–16,3 → 8,8–10,9 | **19,50–19,90 → 21,6–27,0 → 19,1–21,7** | 26,40–43,70 → 32,6–36,0 → 31,5–46,1 |
| Case B input frame median | 1,55–1,90 → 1,6–1,85 → 1,45–1,7 | 5,65–8,25 → 7,7–9,75 → 5,95–8,55 | 15,20–17,45 → 18,9–20,85 → 17,4–19,6 | 24,25–28,00 → 28,4–30,2 → 27,15–28,35 |
| **Case B input frame max** | 3,80–4,20 → 4,2–6,3 → 2,0–4,8 | 9,80–10,60 → 9,9–13,0 → 9,8–10,4 | **16,00–21,00 → 22,5–23,3 → 21,8–24,9** | 25,90–41,70 → 30,6–37,1 → 30,4–41,3 |
| **compareStart max (A, B)** | – → – → 0,1–0,3 | – → – → 0,4–1,0 | – → – → **0,8–1,0** | – → – → 1,6 |
| compareStart min gap (start − input-frame end) | → 0–0,1 | → 0–0,1 | → 0,1–0,3 | → 0,1–0,7 |
| Compare paint frame max | 2,20–2,30 → 2,2–3,6 → 2,4–4,5 | 6,00–6,70 → 7,8–8,1 → 5,6–7,3 | 8,50–15,10 → 13,4–13,7 → 11,1–13,8 | 13,80–30,10 → 21,8–24,7 → 20,3–23,3 |
| Result frame max (A, B) | 1,70–2,30 → 1,7–2,7 → 2,6–5,5 | 3,10–3,80 → 4,8–5,9 → 6,0–7,5 | 9,40–10,90 → 12,1–15,2 → 14,3–15,8 | 14,20–24,80 → 20–21,9 → 18,8–24,6 |
| Extreme run input frame max | 19,60–20,70 → 18,5–35,1 → 7,7–19,2 | 38,40–43,50 → 35–41,1 → 23,5–40,6 | 58,00–87,70 → 62,7–95,6 → 75,7–94,1 | 89,30–130,80 → 117,3–119,3 → 105,3–120,3 |
| (b) worst (≤ 200) | 26,20–28,10 → 30,6–36 → 24,1–29,6 pass | 38,90–44,50 → 35,8–42 → 26,8–41,4 pass | 67,70–97,90 → 68,7–98,4 → 78,4–98,9 pass | 98,20–147,50 → 121,4–127,9 → 112,2–127,7 pass |
| (c) estimate (≤ 100) | 28,10–29,00 → 27,7–31,6 → 29,8–36 pass | 33,90–34,65 → 35,7–41,1 → 36,4–41,05 pass | 50,10–56,60 → 53,6–59,6 → 62,65–67,25 pass | 82,55–90,55 → 82,45–92,9 → 94–100,9 (run 1 and 3 > 100) |

Per-run values at 4× (after):
- Case A input frame max: 21,7 / 19,1 / 20,5.
- Case B input frame max: 23,3 / 24,9 / 21,8.
- compareStart max (A / B): 0,7 / 0,9 ; 0,7 / 1,0 ; 0,8 / 0,8.
- (b) worst: 97,5 / 98,9 / 78,4.

The 1× extreme run gave 19,2 / 7,7 / 18,0.

The host was slower and noisier during the after-runs: 4× BenchmarkIndex 367–466,5 against 442,5–508 in 02-14. The median rise from 15,6–16,1 to 17,3–18,0 is therefore not attributed to the change. Within one run, the change took 0,25–1,1 ms of JS out of the frame (u:rm.startCompare max 1,1 → 0,4 / 0,1 in the after-trace).

**After-trace (4×, 1 run).**
- Case A: frame 23,0 / 27,3, DevTools task 13,02 / 16,24, frame minus DevTools task 9,90 / 11,57, paint 5,57 / 7,33, u:update 2,5 / 3,5, u:rm.startCompare 0 / 0,4.
- Case B: frame 19,35 / 21,0, DevTools task 10,15 / 11,16, frame minus DevTools task 9,69 / 10,40.
- 1× extreme: max 18,7 with 13 tasks in the window, longest task 5,87, idle 8,47.

**Verdict (rule applied word for word): FAIL.** 4× case A input frame max is ≥ 16,7 ms in 3 of 3 runs (21,7 / 19,1 / 20,5), and so is 4× case B (23,3 / 24,9 / 21,8). 4× compareStart max is < 16,7 ms in every run (≤ 1,0 ms). No further tuning was done in this plan.
- ENG-09 in `.planning/REQUIREMENTS.md` is now `[ ]`, with traceability "Pending" and the dated note "(2026-11-07, 02-20: phase-2 regression, 4× proxy (a) case A max 21,7 ms (runs 21,7 / 19,1 / 20,5) / case B max 24,9 ms (runs 23,3 / 24,9 / 21,8) ≥ 16,7 ms in 3 of 3 runs; the phone check alone cannot close it. …)".
- ENG09-PROXY-1, -2 and -4 stay open, with the numbers above. ENG09-PROXY-4: +2,8 to +5,4 ms over 16,30.
- ENG09-PROXY-3 stays open under the rule (it closes only on the PASS path). The trace evidence for it is in Task 1 and in the after-trace: a multi-task window, with no single task over 6,7 ms.
- **m-f:** lens-critic **M4 remains an open MAJOR. It needs explicit user acceptance at the 02-15 checkpoint.** Carry it into the 02-21 hand-off: the finding crosswalk, plus "ENG-09 Pending".
- Open question for the user / lens-critic (not decided here): about 10–16 ms of every measured 4× window is a Playwright DevTools-session task. Options:
  - (i) Change the proxy harness so it does not issue a CDP command while an input frame's timeout is pending. Example: wait in-page before polling. This changes the measurement method, so it needs approval.
  - (ii) Accept the proxy gap with the trace evidence.
  - (iii) Look for app-side paint cost. Paint is 5–7 ms and is the largest app bucket.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] DevTools-session bucket and `otherTop` self-time breakdown in the attribution**
- **Found during:** Task 1, first traced run.
- **Issue:** "other" was the largest bucket (10–16 ms), and the planned buckets could not explain it.
- **Fix:** added `devtoolsInFrame` (by `mojo_interface_tag`), `otherTop` (self time by event name), `u:requestMain` / `u:rm.startCompare` aggregates, and the raw `.trace.json` files next to PERF_TRACE.
- **Files modified:** e2e/perf-throttled.spec.js.
- **Commit:** c014962.

**2. [Rule 3 - Blocking] runFrame always queues the after-paint timeout**
- **Found during:** Task 2.
- **Issue:** the untimed start-up frame had no timeout, so `onInputFrameEnd` would never post its compare start, and the start-up comparison would never run. A throwing `update` had the same gap.
- **Fix:** the timeout is queued in `finally`. The stamp is still taken only for timed frames whose `update` returned.
- **Files modified:** src/ui/timing.js.
- **Commit:** 96e5338.

**3. [Rule 2 - Missing critical functionality] Case B ends with settledCompare in the perf spec**
- **Found during:** Task 3.
- **Issue:** the case B compareStart ring could not be read without it, and verdict (a) must count the deferred task for both cases.
- **Fix:** added `settledCompare` at the end of case B. This slightly changes the perf run flow before the extreme run.
- **Files modified:** e2e/perf-throttled.spec.js.
- **Commit:** b80a4f5.

**4. [Rule 2 - Missing critical functionality] The compare busy timer includes the 'queued' state**
- **Found during:** Task 2.
- **Issue:** without it, a queued start would not count as compare work for "Vergleich rechnet …".
- **Fix:** the busy timer now checks `compareStartQueued || comparePending.size > 0`.
- **Files modified:** src/ui/pipeline.js.
- **Commit:** 96e5338.

## Known limitations

- While a start is queued, the rows are not dotted (`markOutdated` stays in the deferred `startCompare`). In normal use the task runs right after the input frame. Only the test-only `?cmpdelay` holds it longer than BUSY_AFTER_MS. There, "Vergleich rechnet …" appears while the previous rows are still undotted, and the table is not repainted.
- `data-min-gap` has 0,1 ms resolution, so 0 means "same 0,1 ms tick". The order itself is fixed by construction: the task is posted from the timeout after the stamp.

## Plan-end suite

- `npm run lint`: clean, no output from eslint.
- `npm run test:coverage`: Test Files 34 passed, Tests 1595 passed; All files 98,34 % statements, 96,52 % branches, 100 % functions, 99,15 % lines.
- `npm run build`: built.
- `npm run test:e2e`: 389 passed, 1 skipped (2.4m).

## Self-Check: PASSED

- Files: src/ui/pipeline.js, src/ui/timing.js, src/ui/main.js, src/i18n/de-AT.js, index.html, e2e/perf-throttled.spec.js, e2e/compare.spec.js and .planning/REQUIREMENTS.md are all modified and committed.
- Commits:
  - c014962, 9431ce0, 96e5338, b80a4f5 and 4c76f6d are present in `git log`.
  - Acceptance greps:
    - `PERF_TRACE` and `startTracing` are in the perf spec.
    - `perfmarks` is in main.js and pipeline.js.
    - `scheduleCompareStart(` appears twice in pipeline.js, and no `startCompare(specs)` call remains in requestMain.
    - `compareStart` is in timing.js.
    - `- [ ] **ENG-09**` occurs once in REQUIREMENTS.md, and its traceability row says Pending.
