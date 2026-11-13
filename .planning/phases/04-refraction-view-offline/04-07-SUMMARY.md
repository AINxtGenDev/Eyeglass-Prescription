---
phase: 04-refraction-view-offline
plan: 07
subsystem: offline-runtime
tags: [OFF-01, D-20, D-21, T-02-39, N8, MINOR 5, MINOR 9, handover, service-worker]
requires:
  - "04-06: sw-core.js (offlineLine, createRegistrationGate, wireRegistration), update.js, main.js gate"
provides:
  - "src/ui/handover.js: HANDOVER_KEY, MAX_CHARS, TEXT_IDS, probe, writeHandover, takeHandover, snapshotForm, applySnapshot"
  - "src/ui/sw-core.js: + createUpdateController, installControllerChange"
  - "src/ui/pipeline.js: currentCompareConfig()"
  - "main.js restoreHandover() before scheduleFirst(); module-level handoverKind for 04-14"
  - "boundary.test.js: storageHits helper, ALLOW = ['src/ui/handover.js']"
affects: [04-14 banner wiring, update.js, update e2e]
tech-stack:
  added: []
  patterns:
    - "storage default resolved inside the one allow-listed module; callers never name a storage API"
    - "handover applied through the same input/change events typing dispatches, only for changed values"
    - "update state machine with injected probe/snapshot/write/reload/timers/ui"
key-files:
  created:
    - src/ui/handover.js
    - src/ui/handover.test.js
  modified:
    - src/engine/boundary.test.js
    - src/ui/main.js
    - src/ui/pipeline.js
    - src/ui/sw-core.js
    - src/ui/sw-core.test.js
decisions:
  - "createUpdateController takes probe/write callbacks instead of a storage object, so sw-core.js stays free of storage words; update.js (04-14) passes handover.probe/writeHandover"
  - "writeHandover(snapshot, storage?) puts the optional storage last (the plan sketch had it first)"
  - "The snapshot carries a valid flag; applySnapshot reports 'lost' only if the form was valid at snapshot time and is not after the restore, or a field/radio value no longer exists"
  - "The click in this tab wins: reloadWithHandover writes origin 'self' whenever applyClicked is set, even when called with 'other' (controllerchange before onNeedReload)"
  - "Restore runs after startWorker(), immediately before scheduleFirst(); with a configuration A it runs one update() and then clicks #cmp-start, so currentConfig() holds A's values"
metrics:
  duration: "~13 min"
  completed: 2026-11-13
  tasks: 2
  files: 7
---

# Phase 4 Plan 07: Input handover and update state machine Summary

This plan adds the logic that will keep the user's typed inputs across an update reload. It has three parts: one allow-listed sessionStorage module (`handover.js`), the restore at start in `main.js`, and the update controller plus the `controllerchange` rule in `sw-core.js`. Nothing is visible yet, and no SKIP_WAITING is sent anywhere. The banner and the plugin wiring come in 04-14.

## Worth knowing first

- **04-14 needs `formValid()` for the snapshot's `valid` flag.** It lives in `main.js`, which exports nothing. If the snapshot is taken with the default `valid: true`, a user who was mid-typing an invalid value when the update happened will see `update.done.lost` after the reload. 04-14 should pass `snapshotForm(document, { compareA: currentCompareConfig(), valid: formValid() })`, for example through a hook that `main.js` hands to `update.js`.
- **Restoring a comparison moves focus to `#cmp-diff` at load.** `startConfigCompare` focuses it, as it does on a real click. Decide in 04-14 whether that is wanted after an update reload.
- **B can lose its "geschätzt" note.** A restored B text that differs from the field at that moment gets an `input` event, so B then counts as typed. The numbers are the same; only the estimate note goes away. Values that are already equal get no event.
- **There is no fitting-height field** in the form (D-04), so "height" in the plan maps to `frame-b`. The Expert fields (base curve, minimum thicknesses, Vorderfläche, k) are stored too, because they are form inputs. View mode, camera and the Bild toggle are not stored.
- **Order in `applySnapshot`:** Experten-Ansicht → configuration A + `startCompare` → "gleich für beide Augen" → Rx → shape → A/DBL/B → stamp (last, so a typed partial stamp survives the stamp rewrite that an A write triggers) → rim → material → custom fields → Vorderfläche → Expert fields.

## Task 1: handover.js, allow-list, restore at start

- RED `f9b1e12`, GREEN `b069763`.
- `takeHandover`: getItem, then removeItem, then the size cap, `JSON.parse` in try and the shape check. A test spies on `JSON.parse` and records the call order (`getItem`, `removeItem`) to prove that the removal happens before parsing and before the return. A read that throws, or a missing storage, counts as a normal load (`null`). The shape check also rejects unknown keys at every level, including `__proto__`, non-finite numbers in A, and over-long text.
- In `boundary.test.js`, `storageHits(entries, allow)` checks every file outside the allow-list against the full STORAGE regex. It checks `handover.js` against localStorage/indexedDB/cookie only. Added tests: a positive control (handover.js is scanned and matches), exactly one `eyeglass-rx:v1:` string, synthetic hits with fake content, and the real scan of `src/`, which is empty.
- Acceptance greps:
  - the storage grep over `src` prints only `src/ui/handover.js`
  - `grep -c "eyeglass-rx:v1:" src/ui/handover.js` = 1
  - `removeItem` = 3

### Browser probe (throwaway, scratchpad `04-07-probe.mjs`, not committed)

Production `dist/` was served on scratch port 4196: it printed `000` before start, the server was stopped afterwards by its own PID, and the port printed `000` again. The probe used Chromium with workers blocked at 412×915.

| Seeded key | Result |
|---|---|
| plain snapshot (R −4,5, L −4, A 48, stamp `48□18 145`, panto, idx160) | all fields restored, key gone, example banner removed, no console errors |
| same + configuration A (rechteckig 52/32/18, cr39) | comparison active, status "Vorher (A) ist gemerkt: Rechteckig 52□18, Kunststoff CR-39 (1,50) …", B fields = 48 / panto / idx160, key gone |
| `{x` (invalid JSON) | normal example load, key gone |
| no key | normal example load |

## Task 2: update controller and controllerchange rule

- RED `13c06f6`, GREEN `7c08eee`.
- The named tests (a)–(e) pass, plus these: the probe at show and at click, a click that was already warned, a double click, the 10 s failure path (nothing written, then origin `other`), the idempotent reload, a write that fails or throws still reloads, and the reload clears the timer.
- Acceptance greps on `sw-core.js`: `controllerchange` = 2, storage words = 0, `virtual:pwa-register` = 0.

## Verification (real output)

| Command | Result |
|---|---|
| `npx vitest run src/ui/sw-core.test.js src/ui/handover.test.js src/engine/boundary.test.js` | 99 passed |
| `npm run lint` | clean |
| `npm run test:coverage` | 58 files, 2100 passed; all files lines 99.63 %, branches 97.73 %. The diagnostics test did not time out |
| `npm run build` | precache 15 entries (899.52 KiB) |
| `npm run build:e2e && npm run test:dist` | 17 passed, 1 skipped |
| `npx playwright test --project=pwa` (ports 4173–4175 printed `000` first) | 5 passed |

No MCP step was run, because nothing visible changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Interface] probe/write callbacks instead of `storage` in createUpdateController**
- The plan forbids storage words in `sw-core.js` and puts the handover import in update.js, so the controller gets `probe()` and `write(handover)` injected rather than a storage object.
- Commit: 7c08eee

**2. [Rule 2 - Correctness] `valid` flag in the snapshot**
- Without it, an input that was already invalid before the update would be reported as `update.done.lost`. `snapshotForm(doc, { compareA, valid })` stores it, and `applySnapshot` reports lost only when the form went from valid to invalid, or when a field or radio value no longer exists.
- Commit: b069763

**3. [Rule 1 - Bug] fresh config before #cmp-start**
- `currentConfig()` reads `lastFrame`/`lastCustom`, which only `update()` refreshes, so clicking `#cmp-start` right after writing A's fields would have frozen the example. The restore's `startCompare` hook runs one `update()` first. The browser probe confirms that A = 52□18 CR-39 was frozen.
- Commit: b069763

**4. [Rule 2 - Security] unknown top-level keys rejected** in the shape check (T-04-26).
- Commit: b069763

## Known Stubs

- `handoverKind` in `main.js` is set but not read yet. It carries an eslint-disable whose reason is that 04-14 shows the confirmation. This is intentional and per the plan.

## Threat Flags

None beyond the register:
- T-04-26: size cap, parse in try, strict shape check, and writes through the normal input path.
- T-04-27: one key, read once and deleted first, and the boundary test bans every other storage use.
- T-04-28: no SKIP_WAITING anywhere yet; `updateSW` is only called from `apply()`.
- T-04-29: the 10 s timer, nothing written before the reload, and the probe before the click.

## Commits

- f9b1e12 test(04-07): add failing tests for the input handover and the storage allow-list
- b069763 feat(04-07): input handover module, storage allow-list and restore at start (D-21)
- 13c06f6 test(04-07): add failing tests for the update controller and the controllerchange rule
- 7c08eee feat(04-07): update controller and the controllerchange reload rule (D-20 logic, N8, MINOR 5)

## TDD Gate Compliance

Both tasks have a `test(...)` commit followed by a `feat(...)` commit.

STATE.md and ROADMAP.md were not touched (they are orchestrator-owned). Nothing was pushed.

## Self-Check: PASSED

`src/ui/handover.js` and `src/ui/handover.test.js` exist. Commits f9b1e12, b069763, 13c06f6 and 7c08eee are in `git log`.
