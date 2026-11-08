---
phase: 03-3d-lenses-frame
plan: 04
subsystem: state/mesh worker
tags: [VIZ-06, D-26, mesh, worker, transferables, latest-wins]
requires: [buildLensMesh, allocLensBuffers, LENS_LENGTHS, frameOutline, SHAPES]
provides: [transferOf, createMeshHandler, READY, MESH_SLOTS, createMeshClient, MESH_WATCHDOG_MS, mesh.worker.js, MESH_WORKER_URL]
affects: [03-05 lazy view chunk (creates the mesh worker and client), 03-07 frame slot, 03-14 frameA slot, 03-15 leak/re-allocation counting]
tech-stack:
  added: []
  patterns: [dedicated worker per workload, transferables both ways, generation-based latest wins, one-item-per-macrotask sync fallback]
key-files:
  created:
    - src/state/transfer.js
    - src/state/transfer.test.js
    - src/state/mesh-protocol.js
    - src/state/mesh-protocol.test.js
    - src/state/mesh-client.js
    - src/state/mesh-client.test.js
    - src/worker/mesh.worker.js
  modified:
    - e2e/helpers.js
    - e2e/worker.spec.js
decisions:
  - "03-04 (lens-critic MAJOR 3): lens/frame meshes run in a dedicated mesh worker (src/worker/mesh.worker.js), not in the engine worker; D-26 'the existing worker' is revised so a numbers result never waits behind a mesh build"
  - "03-04: a worker error reply to the in-flight mesh job is reported like a dead worker (items null, error true) without switching to sync mode"
  - "03-04: a failed loadSyncHandler import is not cached; the next sync job retries the import"
metrics:
  duration: ~10 min
  completed: 2026-11-08
  tasks: 2
  files: 9
---

# Phase 3 Plan 04: Dedicated mesh worker with latest-wins client Summary

PLAN_START_SHA: `5f796e253faae80159fe88696fc0003da82342b3`

Lens meshes now have their own module worker. `mesh-protocol.js` validates each item and builds it in place into the sent Float32Arrays, which go back as transferables via the import-free `transferOf`. `mesh-client.js` is a one-lane, latest-wins state machine with a 10 s watchdog. Its sync fallback builds one item per macrotask and stops a stale job early. The numbers path (compute-protocol.js, compute-client.js, engine.worker.js, pipeline.js) is byte-unchanged.

## Thing most likely to bite

- **No bundle yet.** Nothing imports `mesh.worker.js` before 03-05, so Vite has not bundled it. `npm run build` emits only `engine.worker-D73Rly2A.js`. 03-05 must record the mesh worker bundle size and check that it works under the CSP in a real browser.
- **The watchdog does not handle hidden tabs.** compute-client re-arms its watchdog when the tab is hidden or the timer fires late. The mesh client does not, because the plan's interface has no `now`/`isHidden`. A backgrounded tab with a mesh job in flight could therefore drop to sync mode for good after 10 s. If 03-05/03-15 see this, add the same late-fire/hidden re-arm as compute-client.

## MAJOR 3 decision (recorded as planned)

Two options: (a) one mesh item per message in the shared engine worker, (b) a dedicated worker. **(b) was chosen.** With (a), an input could still wait for one lens build (14–18 ms desktop, several times that on a phone) on top of the 56,2 ms input → result on the Pixel 7 Pro, which risks ENG-09 (c) ≤ 100 ms. Costs: one more thread, and the mesh bundle duplicates the engine modules it imports. The CSP `script-src 'self'` already admits same-origin module workers.

## Verification (real output, this worktree, 2026-11-08)

- `npx vitest run src/state/mesh-client.test.js src/state/mesh-protocol.test.js src/state/transfer.test.js` → `Test Files 3 passed (3)`, `Tests 25 passed (25)`
- `npm run lint` → no findings
- `npm test` → `Test Files 39 passed (39)`, `Tests 1678 passed (1678)`, 52,40 s
- `npm run build` → OK (port 4173 checked first: `000`)
- `npx playwright test e2e/worker.spec.js e2e/smoke.spec.js` → `76 passed (37.9s)` (desktop + mobile)
- `git diff --stat 5f796e2..HEAD` and `git diff --stat HEAD` over compute-protocol.js, compute-client.js, engine.worker.js, pipeline.js, vite.config.js → empty
- Acceptance greps: `^import` in transfer.js = 0; `evaluate|profile|bench` in mesh-protocol.js = 0; `transferOf(r)` in mesh.worker.js = 1; `document|window|new Worker` in mesh-client.js = 0; `loadSyncHandler` in mesh-client.js = 5; `MESH_WORKER_URL` and `engine\.worker` in helpers.js = 1 each

## Task commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 1ec24c0 | test(03-04): add failing tests for transferOf and the mesh protocol |
| 1 GREEN | d88fc6a | feat(03-04): dedicated mesh worker with validated in-place lens builds |
| 2 RED | eedb857 | test(03-04): add failing tests for the latest-wins mesh client |
| 2 GREEN | f53e438 | feat(03-04): latest-wins mesh client with watchdog and per-item sync fallback |

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Worker 'error' reply to an in-flight mesh job**
- **Found during:** Task 2
- **Issue:** The plan's `receive` only handled 'ready' and 'mesh'. A `{ type: 'error', id }` reply (a malformed items list) would have left the job in flight until the watchdog fired, and its buffers would have been lost.
- **Fix:** That reply is now delivered as `{ items: null, error: true }`, the same as a lost job. The client stays in worker mode. A unit test covers it.
- **Files:** src/state/mesh-client.js, src/state/mesh-client.test.js. **Commit:** f53e438

**2. [Rule 2] A failed sync-handler import is retried**
- A rejected `loadSyncHandler()` is not cached, so a temporary chunk-load failure does not disable meshes for the rest of the session. A unit test covers it. **Commit:** f53e438

The worktree started at bac1c38, behind the required base. It was reset to 5f796e2 according to the branch-check instruction before any work.

## TDD Gate Compliance

RED (`test(03-04)`) commits come before both GREEN (`feat(03-04)`) commits: 1ec24c0 → d88fc6a and eedb857 → f53e438. Both RED runs failed because the module was missing, as expected.

## Known Stubs

None.

## Threat Flags

None. The page ↔ mesh-worker boundary is covered by T-03-10..13. T-03-11 is mitigated by per-item validation and the forced LENS_LENGTHS buffer lengths. T-03-12 is mitigated by the dedicated worker and the per-item sync steps.

## Self-Check: PASSED

All 7 created files exist; commits 1ec24c0, d88fc6a, eedb857, f53e438 are in `git log`.
