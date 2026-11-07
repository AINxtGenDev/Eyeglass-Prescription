---
phase: 02-lay-first-german-input-results-comparison
plan: 05
subsystem: ui-pipeline, eng-09-timing
tags: [refactor, worker, compute-client, timing, no-behaviour-change]
requires: ["02-04"]
provides:
  - "src/ui/pipeline.js: initPipeline({ onBench, onPainted, onCompute }), pending, writePending, computeMode, busyCount, setComputeMode, client, startWorker, requested, requestMain(specs, inputTs)"
  - "src/ui/timing.js: initTiming({ update }), onBench, runBench, timeResultFrame, timings, pushTiming, writeBusyTiming, startEventTiming, schedule, scheduleFirst"
affects: [02-06 (comparison lane goes into pipeline.js next to requestMain), 02-07 (material UI composes in main.js)]
tech-stack:
  added: []
  patterns: [module dependency order main -> timing -> pipeline; callbacks injected upward (initPipeline / initTiming) so no import cycle; ES live bindings for computeMode / busyCount / requested]
key-files:
  created:
    - src/ui/pipeline.js
    - src/ui/timing.js
  modified:
    - src/ui/main.js
decisions:
  - "[02-05]: Dependency direction is main -> timing -> pipeline (pipeline.js imports neither). The plan text had pipeline.js import the timing writers from timing.js; that would need pending/client/computeMode/busyCount injected into timing.js instead, i.e. a cycle or more injection. Timing hooks are injected into pipeline.js by main.js instead."
  - "[02-05]: requestMain(specs, inputTs) also sets `requested` (it moved with the pipeline), so it is two lines, not a one-line wrapper of client.request."
metrics:
  duration: ~25 min
  completed: 2026-11-07
  tasks: 2
  files: 3
---

# Phase 2 Plan 05: Pipeline and timing out of main.js Summary

The worker pipeline (settled signal, busy/failed handlers, delivery painting, compute mode, sync fallback, compute client, startWorker, `requested`) moved verbatim to `src/ui/pipeline.js`, and the ENG-09 readouts (caseLabel, bench readouts, timing rings, runFrame, result/busy writers, Event Timing, frame scheduler) to `src/ui/timing.js`. `main.js` is down from 546 to 224 lines. Nothing visible changed.

## Baseline (before the move, HEAD 6053fc5)

- Build chunks: `engine.worker-BJjl2dvT.js` (16.44 kB), `compute-protocol-NhyfIr8r.js` (10.75 kB), `index-CUHNL7fN.js` (71.30 kB), `index-DkmmWLo8.css`.
- `npx playwright test e2e/worker.spec.js e2e/smoke.spec.js e2e/results.spec.js e2e/expert.spec.js`: 108 passed.

## Chunk comparison

| | Worker chunk | Fallback chunk | Entry chunk |
|---|---|---|---|
| Before | engine.worker-BJjl2dvT.js 16.44 kB | compute-protocol-NhyfIr8r.js 10.75 kB | index-CUHNL7fN.js 71.30 kB |
| After Task 1 | engine.worker-BJjl2dvT.js (identical hash) | compute-protocol-CFbqvxq8.js 10.75 kB | index-BQA8VQ0t.js 71.50 kB |
| After Task 2 | engine.worker-BJjl2dvT.js (identical hash) | compute-protocol-DyagG-Hq.js 10.75 kB | index-CiVVEt9r.js 71.56 kB |

The fallback chunk hash changes only because its first statement imports shared engine bindings from the entry chunk by file name. A diff of the baseline chunk against the new one (baseline rebuilt from `git archive HEAD` in the scratchpad) shows exactly one changed line: `from"./index-CUHNL7fN.js"` became `from"./index-CiVVEt9r.js"`. Same chunk set, same worker chunk byte for byte.

## Non-verbatim lines (git diff --color-moved=plain)

Everything else in both commits shows as moved. The lines that do not:

**Task 1 (bf12c91)**
- Imports and exports: `export` added to `pending`, `writePending`, `computeMode`, `busyCount`, `setComputeMode`, `client`, `startWorker`, `requested`. pipeline.js has its own import block and its own `const EYES` (a duplicate of the one-line constant, as rx-input.js already has). main.js has a new pipeline import and lost `createComputeClient`, `renderResult`, `renderFailed`, `renderLrCallout`, `setStale`.
- Injected hooks: `let onBench, onPainted, onCompute;` plus `initPipeline(hooks)`. Client construction `onBench,` became `onBench: (caseId, r) => onBench(caseId, r),`, because the hook is assigned after the client is constructed. `pushTiming(timings.compute, computeMs)` became `onCompute(computeMs)`.
- paintDeliveries: the post-paint timing block (the `complete` line and the setTimeout) became `onPainted(frameStart, openTs, pending.open.size);`. The block itself moved unchanged into `timeResultFrame(frameStart, openTs, openCount)`. Its only edit is `pending.open.size === 0` to `openCount === 0`, and the value is read synchronously at the same point as before.
- update(): `requested = specs; client.request(specs, inputTs);` became `requestMain(specs, inputTs);`, which runs the same two statements in pipeline.js.
- init(): `initPipeline({ onBench, onPainted: timeResultFrame, onCompute: (ms) => pushTiming(timings.compute, ms) });` comes before `setComputeMode`.

**Task 2 (1ba5d83)**
- Imports and exports: `export` added to `onBench`, `runBench`, `timeResultFrame`, `timings`, `pushTiming`, `writeBusyTiming`, `startEventTiming`, `schedule`. timing.js has its own import block and imports from `./pipeline.js` only (not `./main.js`). main.js dropped the now-unused imports and imports from `./timing.js`.
- Injected `update`: `let update;` plus `initTiming(deps)`. main.js calls `initTiming({ update })` in init(), before initPipeline.
- init(): the two closing lines `initInputTs = performance.now(); schedule(initInputTs);` moved unchanged into `scheduleFirst()`. init() calls it at the same place, after `startWorker()`.

Import cycle check: `grep -c "from './main.js'" src/ui/timing.js src/ui/pipeline.js` gives 0 and 0. pipeline.js imports neither main.js nor timing.js.

## Perf proxy (informational, `npm run test:perf`, 4x CPU throttle, case A)

| Run | Input frame median / max (mainMed / mainMax) | Reaction median / max | Result median / max |
|---|---|---|---|
| 01-15 reference | 14,50 / 16,30 ms | - | - |
| Before 02-05 (HEAD 6053fc5) | 14,45 / 16,90 ms | 24,50 / 27,40 ms | 31,45 / 35,10 ms |
| After 02-05 (1ba5d83) | 14,75 / 17,20 ms | 25,15 / 30,50 ms | 33,75 / 45,00 ms |

The input frame changed by +0,3 ms (median and max), well under the 2 ms reporting threshold. The case A result max went up by 9,9 ms in one 10-sample window, while the median moved by +2,3 ms. The result path has no code change: paintDeliveries does the same work and calls the same setTimeout block one function level deeper. I read the 9,9 ms as run-to-run noise under throttling. Not tuned, as the plan requires. If 02-06 sees a result-max regression, re-run the proxy on 1ba5d83 to separate it from this move.

Raw outputs are in the session scratchpad (`perf-before.json`, `perf-after.json`).

## Verification

- Task 1 gate: `npm run lint` clean; `npm test` 1279 passed (30 files); `npm run build` OK; `npx playwright test e2e/worker.spec.js e2e/smoke.spec.js e2e/results.spec.js`: 90 passed.
- Task 1 greps: worker URL in pipeline.js 1, in main.js 0; `import('../state/compute-protocol.js')` in pipeline.js 1; paintDeliveries/onBusy/onFailed/startWorker in main.js 0.
- Task 2 gate: `npm run lint` clean; `npm test` 1279 passed; `npm run build` OK; `npx playwright test e2e/worker.spec.js e2e/smoke.spec.js e2e/results.spec.js e2e/expert.spec.js`: 108 passed (desktop and mobile).
- Task 2 greps: runFrame/runBench/writeResultTiming/caseLabel in main.js 0; `function runFrame` in timing.js 1; `wc -l < src/ui/main.js` = 224 (< 250).
- Plan end: `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` exit 0: lint clean; 30 files / 1279 tests passed, coverage All files 98.47 % stmts / 96.42 % branch / 100 % funcs / 99.18 % lines; build OK; Playwright 182 passed (1.3 min), none failed, flaky or skipped.

## Deviations from Plan

**1. [Rule 3 - Blocking] Dependency direction reversed against the plan text**
- **Found during:** Task 1 design.
- **Issue:** The plan has pipeline.js import the timing writers from timing.js. But timing.js reads `pending`, `writePending`, `client`, `computeMode` and `busyCount`, which all live in pipeline.js. That would make a pipeline <-> timing cycle, or require injecting five values into timing.js.
- **Fix:** timing.js imports pipeline.js through ES live bindings. pipeline.js gets its three timing hooks injected by main.js through `initPipeline`. The plan's own `initPipeline({ ... })` injection shape is kept, with the hooks it actually needs (`onBench`, `onPainted`, `onCompute`). `schedule` is not needed by pipeline.js.
- **Files:** src/ui/pipeline.js, src/ui/timing.js, src/ui/main.js. **Commits:** bf12c91, 1ba5d83.

**2. [Rule 3 - Blocking] `scheduleFirst()` export**
- `initInputTs` is module state of timing.js, and main.js cannot assign an imported binding. So the two closing lines of init() moved verbatim into `scheduleFirst()`.

**3. `requested` moved with the pipeline.** paintDeliveries reads it and update() writes it. `requestMain` therefore sets it and then calls `client.request`. main.js's `onMessageShown` reads it through the live import.

## Known Stubs

None.

## Self-Check: PASSED

FOUND: src/ui/pipeline.js, src/ui/timing.js, 02-05-SUMMARY.md; FOUND commits bf12c91, 1ba5d83.
