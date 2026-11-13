---
phase: 04-refraction-view-offline
plan: 05
subsystem: state
tags: [warp, worker, latest-wins, degradation-guard, bench, vitest]

requires:
  - phase: 04-03
    provides: "warp.js prepareWarp, warpGrid, REF_GRID_TIERS (6/1, 8/2, 10/3), FIELD_HALF_ANGLE_DEG 30; 04-P0-RESULTS.md measured panels"
provides:
  - "src/state/guard.js: initGuard, nextGuard (pure step-down rule, E5)"
  - "src/state/warp-protocol.js: READY, createWarpHandler (validates, never throws, computeMs)"
  - "src/state/warp-client.js: WARP_WATCHDOG_MS, createWarpClient (requestWarp, cancel, receive, resume, workerError, mode, isWarpCurrent)"
  - "src/worker/warp.worker.js: worker glue, the mesh.worker.js pattern"
  - "test/bench/warp-tiers.test.js: tier bench, normal cases and the item-12 rim case"
affects: [04-08 Durchblick view wiring, 04-10 guard wiring, 04-13 acceptance, lens-critic]

tech-stack:
  added: []
  patterns:
    - "Warp lane = copy of the mesh-lane contract; stale replies are ignored (onWarp sees the current generation only)"
    - "transferOf also covers 'warp' replies (typed arrays directly on each item)"

key-files:
  created:
    - src/state/guard.js
    - src/state/guard.test.js
    - src/state/warp-protocol.js
    - src/state/warp-protocol.test.js
    - src/state/warp-client.js
    - src/state/warp-client.test.js
    - src/worker/warp.worker.js
    - test/bench/warp-tiers.test.js
  modified:
    - src/state/transfer.js

key-decisions:
  - "warp-client delivers only current-generation results (stale replies and cancelled jobs are dropped silently); a warp request carries no buffers, so there is nothing to reclaim"
  - "transferOf extended to type 'warp' (Rule 3): without it the worker would copy, not transfer, uv/cls/leaves"
  - "UI-SPEC Node budgets kept unchanged in the BENCH_GATE assertions; they fail on this host because of GRENZFALL_PAIR, replacement values proposed for lens-critic"

requirements-completed: [REF-01, REF-02]

duration: ~25 min
completed: 2026-11-13
---

# Phase 4 Plan 05: Warp worker lane, degradation guard and tier bench Summary

**The Durchblick warp now has its own latest-wins worker lane with the mesh-lane guarantees plus `cancel()`, and the step-down rule is one pure, tested function. The tier bench measures the production engine: the host-independent ray rule passes everywhere, but the UI-SPEC Node time budgets (30 / 15 / 8 ms) fail on this host for all three tiers because of the Grenzfall Rx.**

## Finding for lens-critic first: UI-SPEC Node budgets fail (BENCH_GATE=1)

The normal Rx is far inside budget. The Grenzfall Rx (+10,75 −1,00 × 89, 1,67, 43 × 43) costs about 9,5 µs per ray, against about 1,2 µs for the normal Rx. That makes the combined median exceed the budget at every tier. I did not loosen anything: the test still asserts 30 / 15 / 8 ms under `BENCH_GATE=1`, so a local gated run exits 1 today. CI does not set BENCH_GATE, so CI stays green.

**Proposed replacement budgets, with the measurement as the reason** (UI-SPEC: "The planner may change the three values with a stated measurement"). Lens-critic or the user decides:

| tier | UI-SPEC | measured combined median (two runs) | proposed | 4 × proposed (mid-phone proxy) |
|---|---|---|---|---|
| fein | 30 ms | 56,43 / 56,79 ms | 60 ms | 240 ms: over the 200 ms. A phone on fein would step down for Grenzfall-like Rx. Phones start on mittel anyway. |
| mittel | 15 ms | 17,05 / 17,34 ms | 20 ms | 80 ms: leaves 120 ms for transfer and draw |
| grob | 8 ms | 12,65 / 13,26 ms | 15 ms | 60 ms |

A second option is to keep the budgets and gate them on the normal Rx alone, reporting the Grenzfall separately. That is a change to the UI-SPEC rule ("median of the default and the Grenzfall Rx"), so it is also not mine to make. The cost per ray of the Grenzfall trace is also a possible engine optimisation target. That is out of scope here.

## Bench tables (BENCH_GATE=1)

Host: Intel(R) Core(TM) i7-8809G CPU @ 3.10GHz, 8 logical CPUs, Node v22.17.0. The machine was close to idle: load average 0,37–2,13 during the runs, and plan 04-06 was running in parallel. Method: `createWarpHandler()` (validation, then prepareWarp, then warpGrid), 10 warm-up runs, 30 timed runs, node:perf_hooks.

### Normal cases: one two-panel job, 412 px layout (189 × 285, 246,82 px/tan)

| tier | Rx | rays (R + L) | median | p95 | combined median | budget | assertion |
|---|---|---|---|---|---|---|---|
| fein | NORMAL_PAIR | 1617 + 1617 | 3,93 ms | 4,10 ms | **56,43 ms** | ≤ 30 ms | **FAIL** |
| fein | GRENZFALL_PAIR | 5777 + 5777 | 108,94 ms | 116,31 ms | | | |
| mittel | NORMAL_PAIR | 925 + 925 | 2,25 ms | 2,42 ms | **17,05 ms** | ≤ 15 ms | **FAIL** |
| mittel | GRENZFALL_PAIR | 1693 + 1693 | 31,85 ms | 32,49 ms | | | |
| grob | NORMAL_PAIR | 600 + 600 | 1,53 ms | 1,70 ms | **12,65 ms** | ≤ 8 ms | **FAIL** |
| grob | GRENZFALL_PAIR | 1208 + 1208 | 23,76 ms | 24,32 ms | | | |

The ray counts equal the per-panel P0 counts in 04-P0-RESULTS.md section 4. Re-run without the gate: 4,03 / 109,54, 2,23 / 32,45 and 1,59 / 24,92 ms.

### Rim case: item-12 frame (A 40 / B 28 / DBL 14 / PD 40, rechteckig, CR-39, OD), one panel

| case | tier | rays | median | p95 | above normal-case budget |
|---|---|---|---|---|---|
| −4,00, 320 one-panel 288 × 216 | fein | 6549 | 40,78 ms | 43,88 ms | yes (> 30) |
| | mittel | 1900 | 10,10 ms | 10,41 ms | no |
| | grob | 1394 | 8,17 ms | 9,16 ms | yes (> 8) |
| +4,00, 320 one-panel 288 × 216 | fein | 6421 | 42,41 ms | 45,29 ms | yes (> 30) |
| | mittel | 1900 | 11,10 ms | 11,96 ms | no |
| | grob | 1426 | 9,18 ms | 10,48 ms | yes (> 8) |
| −4,00, largest 639 × 800 | fein | 23540 | 196,06 ms | 219,04 ms | yes (> 30) |
| | mittel | 9845 | 74,84 ms | 82,56 ms | yes (> 15) |
| | grob | 6609 | 49,61 ms | 69,56 ms | yes (> 8) |
| +4,00, largest 639 × 800 | fein | 26356 | 242,26 ms | 288,12 ms | yes (> 30) |
| | mittel | 10421 | 49,45 ms | 56,05 ms | yes (> 15) |
| | grob | 7025 | 32,92 ms | 33,92 ms | yes (> 8) |

| assertion (all four cases) | result |
|---|---|
| rays(grob) ≤ rays(mittel) ≤ rays(fein) (always on, NEW-2) | PASS ×4 |
| grob median ≤ mittel median ≤ fein median (BENCH_GATE) | PASS ×4 |
| grob median ≤ 0,6 × fein median (BENCH_GATE) | PASS ×4 (0,200 / 0,217 / 0,253 / 0,136) |

The ray counts match 04-P0-RESULTS.md section 8 exactly.

**M2 findings for lens-critic and the 04-13 acceptance** (rim values above the normal-case budget of their tier):
- 320 one-panel: fein for both Rx (about 41–42 ms), and grob for both Rx (8,17 and 9,18 ms, just above 8). mittel is within budget.
- Largest 639 × 800 panel: every tier for both Rx. grob is 49,61 / 32,92 ms. This panel exists only in fullscreen on a 1280 × 800 desktop.

## Accomplishments

- **guard.js** has `initGuard` and `nextGuard(g, ms, { budgetMs = 200, need = 2, last = 'grob', down })`, as in RESEARCH Pattern 6. The default `down` is fein → mittel → grob. It is pure (grep for window/document/performance = 0), returns new objects and never steps up. Tests: the 4 E5 sequences as named tests, equality at the budget, step-by-step down to stillSlow, and the thumbnail equivalence (50 ms, on → off, [60, 40, 60] stays, [60, 60] trips, 50 is not slow). 11 tests.
- **warp-protocol.js** validates each item. The checks are, in order: eye, shape, frame size, surfaces keys and oc, optional hMm, layout, and tier (`Object.hasOwn`, so `'toString'` is rejected). A failing item returns `INVALID_ITEM` with its `field`, and the other items still compute. A throwing prepare or warp returns `WARP_FAILED`. An engine failure object passes on with its code. A malformed message returns `{ type: 'error', id, message: 'warp worker: unknown message' }`. A spy test checks that `warpFn` gets `REF_GRID_TIERS[tier].cellPx` and `{ leafPx }` for each tier. The reply is bit-equal to a direct prepareWarp + warpGrid call.
- **warp-client.js** copies the mesh-client contract:
  - generation counter, one job in flight, a replaced queued job comes back as `dropped`
  - 10 s watchdog that re-arms when the tab is hidden or the timer fired late
  - DataCloneError or workerError → sync fallback through `loadSyncHandler`, one item per macrotask, with a stale stop
  - `resume()`
  - in addition, `cancel()`. Three cancel tests: queued and in-flight; nothing pending, plus the watchdog; sync mode.
- **warp.worker.js** is the 14-line glue.
- **mesh-client.js, mesh-protocol.js and mesh.worker.js are unchanged.** `git diff --stat` against base 0e4444e is empty for them.

## Task Commits

1. Task 1: `8a592ea` (test, RED), `3d2bcd8` (feat, GREEN)
2. Task 2: `190a699` (test, RED), `e10140e` (feat, GREEN)
3. Task 3: `898c6f2` (test: bench)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base reset.** HEAD was at 47bb4e2. I ran `git reset --hard 0e4444e` as the branch check prescribes.

**2. [Rule 3 - Blocking] `src/state/transfer.js` extended (not in files_modified).**
- **Issue:** `transferOf` returned `[]` for anything other than `type: 'mesh'`, and it only read `item.buffers`. The behaviour "transferOf(reply) lists the uv, cls and leaves buffers" was therefore impossible without a change.
- **Fix:** `type: 'warp'` is accepted, and its typed arrays are read directly from each item. The mesh path is unchanged, and the existing transfer.test.js still passes.
- **Conflict check:** plan 04-06 (running in parallel) does not touch transfer.js.
- **Commit:** `e10140e`

**3. [Interface] Stale warp replies are not delivered.** mesh-client delivers stale replies with `current: false` so the page can reclaim buffers. A warp request carries no buffers, and the plan says a cancelled job's "reply is ignored, its buffers are not attached". So `onWarp` only ever gets the current generation, as `{ gen, items, computeMs }` or `{ gen, items: null, error: true }`. 04-08 should still re-check `isWarpCurrent(gen)` in its paint frame.

**4. [Interface] Extra reply fields.** Each ok item also carries `cellX`/`cellY`, because 04-09 needs them for the leaf height (size · cellY / cellX, 04-03 decision). In sync mode, computeMs is the sum of the per-item computeMs.

### Acceptance-criterion notes

- NEW-12 parity grep: the plan's literal `grep -c "'^warp-protocol-'"` prints 0, because grep reads `^` as an anchor. `grep -cF` prints 1. The entry (`test/dist/parity.test.js` line 39) has `normalisedEqual: true`. I did not edit parity.test.js.
- `BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` exits 1 (3 normal-case budget failures, see the finding above). This is the honest result; the budgets were not loosened. The ungated run exits 0 (7/7).
- With the Claude Code agent reporter, Vitest hides the stdout of passing tests. Under the default reporter (`env -u CLAUDECODE -u AI_AGENT`) the median and p95 lines print, as they do for recompute.test.js.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/state/guard.test.js` | 11/11 pass |
| `npx vitest run src/state/warp-protocol.test.js src/state/warp-client.test.js` | 50/50 pass |
| `npx vitest run src/state` | 17 files, 524/524 pass |
| `npm run lint` | exit 0 |
| `grep -c performance src/engine/warp.js` | 0 |
| `npx vitest run test/bench/warp-tiers.test.js` | 7/7 pass |
| `BENCH_GATE=1 …warp-tiers.test.js` | 4 rim pass, 3 normal-case budgets FAIL (above) |
| `npm run test:coverage` | exit 0: 56 files, 2029/2029 pass (diagnostics.test.js included); engine 99,25 % lines, 97,73 % branches; load average 1,2 at start, 9,8 at the end |

D-30 MCP protocol: not run. This plan has no DOM wiring.

## Known Stubs

None. The lane is wired into the view by 04-08, and the guard by 04-10, as planned.

## Threat Flags

None beyond the plan's register:
- T-04-18: per-item validation, never throws
- T-04-19: generation + id filter, isWarpCurrent, cancel
- T-04-20: dedicated worker, watchdog, and a sync fallback that runs one item per macrotask

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(04-05)` RED commit followed by a `feat(04-05)` GREEN commit. RED failed because the module was missing. Task 3 is `type="auto"`.

## Self-Check: PASSED

- All 8 created files are on disk; transfer.js modified.
- Commits 8a592ea, 3d2bcd8, 190a699, e10140e and 898c6f2 are in `git log`.
