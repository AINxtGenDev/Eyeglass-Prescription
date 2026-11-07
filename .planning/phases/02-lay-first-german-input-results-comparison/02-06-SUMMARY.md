---
phase: 02-lay-first-german-input-results-comparison
plan: 06
subsystem: compute-client, compare-rows
tags: [compare-lane, worker, latest-wins, materials, RES-02, tdd]
requires: ["02-05", "02-01"]
provides:
  - "compute-client compare lane: requestCompare(jobs) -> gen, cancelCompare(), isCompareCurrent(gen), runCompareNow(), onCompare({ gen, key, results | null, error? }), LRU cache COMPARE_CACHE_SIZE = 64"
  - "compute-protocol: { type: 'compare', id, eyes: { OD?, OS? } } -> { type: 'compare', id, eyes: { OD?: LensResult, OS?: LensResult }, computeMs }"
  - "compare.js: thickerEye({ OD, OS }) and materialRows({ selectedId, selected, others }) -> rows in MATERIALS order (codes only)"
  - "test/bench/compare.test.js: informational 6 materials x 2 eyes bench"
affects: [02-07 (wires requestCompare + materialRows into pipeline.js / main.js, paints #timing-compare), 02-08 (configuration A), 02-13 (cross-section)]
tech-stack:
  added: []
  patterns: [generation tag for a low-priority lane, pump order main -> one compare job -> bench, display-rounded arithmetic for comparison rows]
key-files:
  created:
    - src/state/compare.js (materialRows, thickerEye added; file existed from 02-01)
    - test/bench/compare.test.js
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
  modified:
    - src/state/compute-client.js
    - src/state/compute-client.test.js
    - src/state/compute-protocol.js
    - src/state/compute-protocol.test.js
    - src/state/compare.test.js
decisions:
  - "[02-06]: A compare job in flight when the timeout fallback fires goes back to the front of the queue (if its generation is current), so the sync fallback's runCompareNow() still computes it. The plan only specified the workerError() path."
  - "[02-06]: materialRows counts only the computed selected eyes. If one selected eye failed, the other eye is the row eye and the weight is that eye's grams only. A row is failed only if one of those eyes failed. No computed selected eye gives []."
  - "[02-06]: requestCompare does not bump the generation. Only a changed main request does. A compare answer from an earlier requestCompare call of the same generation is still delivered (and cached); it is valid for the current main input."
metrics:
  duration: ~16 min
  completed: 2026-11-07
  tasks: 2
  files: 7
---

# Phase 2 Plan 06: Compare lane and material rows Summary

The compute client has a low-priority, latest-wins compare lane: one material pair per job, sent only after main work, and dropped on any changed main input. `materialRows` builds the material table from the displayed `thickest(m)` values of one fixed eye. Both are pure and unit-tested. No page change; 02-07 wires them in.

## What to watch first

- **One flaky e2e run (unrelated to this plan's code, logged in deferred-items.md):** the plan-end full suite had one failure, `e2e/frame.spec.js:117` [desktop], `Expected "32,0 mm" / Received "31,5 mm"`. The test passed 20/20 with `--repeat-each=10`, and the next full `npm run test:e2e` passed 182/182. My guess at the cause, read from the spec and not proven: a non-retrying `text()` read of `#rx-os-pd-echo`. 02-06 changed no page code, and the compare lane is not wired to the page yet.
- **Planner's grep miscount:** the acceptance check `grep -v '^\s*//' src/state/compare.js | grep -c "etMax.value"` returns 5, not 1. The planner miscounted. Before this plan the file already gave 5: two JSDoc lines, which start with ` *` and not `//`, the two lines in `thickest`, and the `uniformEdge` line from 02-02. 02-06 adds 0 (`git diff | grep '^+' | grep -c etMax.value` → 0). So the intent holds: materialRows reads thickness only through `thickest()`.

## Compare lane (Task 1)

- Order inside `pump()`: main compute (unchanged code path) → one compare job → bench.
- A main `request()` that changes an eye's key or cancels an eye bumps `generation` and clears the queue. An identical request changes nothing.
- A compare answer of an older generation is cached but not delivered. Unit test 'main before compare, at most one compare job ahead' asserts the dispatch order compute → compare → compute and that the stale answer is dropped.
- Error handling: `onErrorMsg` and `workerError()` have an explicit compare branch. It calls `onCompare({ …, results: null, error: true })` only for the current generation and never calls `failCurrent` or `onFailed` (T-02-19). Errors are not cached.
- Sync mode: compare jobs wait for `runCompareNow()`. That flag clears when the queue drains or is cleared.
- The header cites the phone budget: one rescan pair ≈ 25,4 ms (01-11-SUMMARY lines 119–126). Desktop numbers are labelled as desktop.

## Material rows (Task 2), re-verified against the engine 2026-11-07

Example (CR-39 selected, R −2,75 −0,50 × 180 PD 32, L −2,50 −0,75 × 170 PD 31,5, Rechteckig 52×38/18). CR-39 OD 4,597 = OS 4,597 mm, a tie, so the row eye is OD. Thickest point is temporal-superior for every row.

| Material | thickMm | ctMm | weightG | diffMm | diffG | pct |
|---|---|---|---|---|---|---|
| cr39 (selected) | 4,6 | 1,8 | 14 | – | – | – |
| trivex | 4,1 | 1,5 | 10 | 0,5 | 4 | 11 |
| pc | 3,9 | 1,5 | 10 | 0,7 | 4 | 15 |
| idx160 | 3,5 | 1,2 | 10 | 1,1 | 4 | 24 |
| idx167 | 3,3 | 1,2 | 10 | 1,3 | 4 | 28 |
| idx174 | 3,0 | 1,1 | 10 | 1,6 | 4 | 35 |

Plus case (R +3,00 PD 32, L +2,75 PD 31,5, same frame). CR-39 OD 3,902 / OS 3,737, so the row eye is OD. Thickest point is the centre for every row.

| Material | thickMm | ctMm | weightG | diffMm | diffG |
|---|---|---|---|---|---|
| cr39 (selected) | 3,9 | 3,9 | 14 | – | – |
| trivex | 3,7 | 3,7 | 12 | 0,2 | 2 |
| pc | 3,8 | 3,8 | 13 | 0,1 | 1 |
| idx160 | 3,5 | 3,5 | 13 | 0,4 | 1 |
| idx167 | 3,2 | 3,2 | 12 | 0,7 | 2 |
| idx174 | 3,0 | 3,0 | 12 | 0,9 | 2 (pct 23) |

Both tables equal the plan's interfaces tables. The tests build the fixtures with `evaluateLens` for all 6 materials × 2 eyes and pin these values. Further tests cover: the fixed eye (synthetic metrics where a row's own thicker eye differs from the selected eye), a tie on the displayed value, failed and pending rows, a failed selected eye, and the negative differences when a thinner material is selected (cr39 vs idx174: −1,6 mm, −4 g, −53 %).

## Bench (informational, Node, this machine i7-8809G)

| Case | Median | p95 | RESEARCH (planning desktop) |
|---|---|---|---|
| NORMAL 6 materials × 2 eyes | 18,4 ms (18,31–18,59 over 3 runs) | 19,4–21,2 ms | 9,9 ms |
| GRENZFALL 6 materials × 2 eyes | 86,2 ms (86,19–86,31) | 89,5–91,2 ms | 54,5 ms |

On the same machine, `test/bench/recompute.test.js` gives 3,02 ms per normal pair and 16,4 ms per Grenzfall pair. 6 × those (18,1 / 98,6) brackets the measurements, so the gap to RESEARCH comes from the machine, not the lane. In the worker these are 5 jobs, one per material; the selected material is never recomputed. They run behind main jobs, so they add latency to the table, not to the main result.

## ENG-09 perf proxy (`npm run test:perf`, 4× CPU, case A) against the 02-05 baseline

| Run | Input frame median / max | Result median / max |
|---|---|---|
| 02-05 baseline (perf-after.json) | 14,75 / 17,20 ms | 33,75 / 45,0 ms |
| After 02-06 (perf-0206.json) | 13,35 / 16,40 ms | 30,5 / 34,1 ms |

No regression. Expected, since the lane is not wired to the page yet. The 45,0 ms result max from 02-05 did not recur (34,1 ms), which supports reading it as noise. The lane's real cost is measured once 02-07 sends compare jobs. Raw: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/perf-0206.json`.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 0a14aa5 | test(02-06): failing compare-lane tests |
| 1 GREEN | 6f42701 | feat(02-06): low-priority latest-wins compare lane |
| 2 RED | b95d33f | test(02-06): failing materialRows tests on the thickest point |
| 2 GREEN | bb907a1 | feat(02-06): material rows from displayed thickest values, one fixed eye |

## TDD Gate Compliance

Each task has a `test(...)` commit with failing tests followed by a `feat(...)` commit. Task 1 RED: 15 of the new tests failed (one protocol clone test passed on the error response). Task 2 RED: 12 failed. No refactor commits were needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A timed-out compare job is re-queued**
- **Found during:** Task 1
- **Issue:** `fallback('timeout')` sets `inFlight = null`. Without this fix, a compare job in flight at that moment would be lost, and the page would show that material as pending forever, even after 'Vergleich berechnen'.
- **Fix:** if its generation is current, the job goes back to the front of the queue. Unit test 'timeout fallback with a compare job in flight'.
- **Files modified:** src/state/compute-client.js
- **Commit:** 6f42701

**2. [Rule 2] materialRows with a failed selected eye**
- **Found during:** Task 2
- **Issue:** the plan says to use the other eye but does not define the weight or row failure in that case.
- **Fix:** weight and failure use the computed selected eyes only. No computed selected eye gives `[]`. Unit-tested.
- **Commit:** bb907a1

**3. Acceptance grep miscount (no code change):** see "What to watch first".

Adapted file targets: none were needed. The plan's files are all in `src/state/`. The 02-05 move (pipeline.js/timing.js) affects 02-07, which wires the lane into `src/ui/pipeline.js`.

## Verification (plan end, real output)

- `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`:
  - Lint: clean.
  - Unit: 31 files / 1309 tests passed. Coverage All files 98,47 % stmts / 96,42 % branch / 100 % funcs / 99,18 % lines.
  - Build: OK (`engine.worker-D2Gntp59.js` 16.58 kB, `compute-protocol-Ca0xOrQ8.js` 10.89 kB, `index-33dq__72.js` 72.55 kB).
  - Playwright: **181 passed, 1 failed** (the flaky frame.spec.js:117 above). The chain exited 1.
- Re-run: `npx playwright test e2e/frame.spec.js -g "binocular PD" --repeat-each=10` gave 20 passed. Full `npx playwright test` gave **182 passed**, exit 0.

## Known Stubs

None. No UI was added; `onCompare` defaults to a no-op until 02-07 passes its painter.

## Threat Flags

None. The new message pair is in the plan's threat model (T-02-16, T-02-17, T-02-19, T-02-48 mitigated and unit-tested).

## Self-Check: PASSED

- FOUND: src/state/compute-client.js, src/state/compute-protocol.js, src/state/compare.js, test/bench/compare.test.js, deferred-items.md
- FOUND commits: 0a14aa5, 6f42701, b95d33f, bb907a1
