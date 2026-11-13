---
phase: 04-refraction-view-offline
plan: 10
subsystem: ui/view (Durchblick degradation)
tags: [REF-02, D-15, D-16, D-17, F-06, guard, degraded-note, tech-angaben, e2e, perf]
requires: [04-05 nextGuard, 04-08 Durchblick lane, 04-09 stage visibility + lastJobExcluded]
provides: [grid start tier + refStepDown (tiers.js), measured step-down in ref-mode.js, #view-ref-degraded + #view-ref-live, tech.ref.grid/time/compute, gated ?refdegraded hook, thumbnail guard on nextGuard]
affects: [04-11 A/B in Durchblick, 04-12 fullscreen (redraws without a trace stay unsampled), 04-13 result review + real-phone check]
tech-stack:
  added: []
  patterns: [one sample per input t0, t1 in the first rAF after the drawing render (afterRender hook), grid re-allocated only when the lower-tier reply is drawn]
key-files:
  created: []
  modified: [src/ui/view/tiers.js, src/ui/view/tiers.test.js, src/ui/view/view.js, src/ui/view/ref-mode.js, src/ui/pipeline.js, index.html, src/i18n/de-AT.js, src/ui/style.css, test/dist/hooks.test.js, test/ci/env-gates.test.js, e2e/view-ref.spec.js, e2e/perf-throttled.spec.js]
decisions:
  - "Counted sample = a job posted from update() for a NEW input t0 with inputs.current true, after a warm (drawn) job; enter, off→on, relayout, retry and the step re-trace are clocked from their post for Technische Angaben only"
  - "Interrupt exclusion by time: any visibilitychange / pageshow persisted / resume at or after t0 voids the sample"
  - "tech.ref.grid uses {nx} × {ny} (UI-SPEC wrote {n} × {n}; panels are not square); each step is logged as the tier path 'fein → mittel' in the same line"
  - "RIM_FRAME = the item-12 frame itself (rechteckig): the mobile project shows ONE 328 × 246 panel, where the rim is in the field at mittel and grob"
metrics:
  duration: ~55 min
  completed: 2026-11-13
  tasks: 2
---

# Phase 4 Plan 10: Durchblick degrades on measured evidence Summary

The Durchblick now starts on the grid tier of the device class (fein on desktops, mittel on phones). It measures each input-to-picture time with the UI-SPEC clock and steps one grid tier down after two counted samples over 200 ms. A step changes both the cell and the leaf size. The step is shown by a plain-German note, a one-time live announcement and the badge "Durchblick · vereinfacht", and it is logged in Technische Angaben. The percentages are engine text and do not change. The phase-3 thumbnail guard now runs on the same pure `nextGuard`.

## Most likely to bite: SwiftShader samples near the budget under load

The guard is live in the e2e build. Natural SwiftShader samples (no hold, 1280 × 800, fein) were:
- 100 / 73 ms on a quiet host
- 176 / 122 ms during the 216-test batch (load ~7)

In my runs no ordinary test stepped down. On a slower CI runner, though, two consecutive counted edits above 200 ms would degrade a normal session. Tests that assert the badge "Durchblick · berechnet" after edits would then fail: the `lens()` helper and the retry test, for example. If this shows up as CI flakiness, add a MODE-gated guard-off init flag for the non-guard specs. That flag would work like `?thumbguardoff` does for the thumbnail. I did not add it, because it is not in the plan and I could not reproduce the failure.

## What was built

**Task 1 (bc48d2a RED, fa3e599 GREEN)**
- `tiers.js` adds three exports, kept separate from the quality tiers (PATTERNS bite 10): `REF_TIER_ORDER` (frozen), `refStartTier` (hoch → fein, else mittel) and `refStepDown` (fein → mittel → grob, then stays at grob).
- RED: 4 tests failed before the code.
- `view.js` `onCopy`: the inline slow-run counter is replaced by `nextGuard(…, { budgetMs: 50, need: 2, last: 'off', down: () => 'off' })`. `?thumbguardoff` resets the run, so the guard never trips.
- The handle `guard` keys are unchanged: `tripped`, `lastMs`, `frames`, `thresholdMs`, `run`, `off`. The `slowRun` field is gone; no e2e test read it.
- Greps: `slowRun` = 0, `nextGuard(` = 1.

**Task 2 (3925e58, 3b6c4db)**
- `pipeline.js`: `viewInputs()` always carries `inputTs`. It is the input event time of the latest `requestMain`, or null before the first request. Before this change it was set only with `?perfmarks`.
- `ref-mode.js`:
  - Start tier: `refStartTier(pickTier(...))`, from the same `(pointer: coarse)` and `min(screen)` inputs that scene.js uses.
  - Clock: t0 is the input event timestamp. t1 is `performance.now()` in the first rAF after the render that drew the job. It is taken through a new `refMode.afterRender()`, which `view.js` `refAfterRender` calls.
  - Exclusions, as in the must-haves:
    - superseded and cancelled jobs: only the current generation is ever drawn, and `leave()` drops the job
    - the first drawn job after entering and after the stage comes back on screen (`warm`)
    - jobs without a new input
    - samples whose span contains a visibilitychange, a `pageshow` with persisted, or a `resume`
  - Each input counts once: a second job for the same t0 is not counted.
  - `nextGuard(g, ms, { budgetMs: 200, need: 2, last: 'grob', down: refStepDown })` is called once in `sample()`. A step is detected as a change of tier, because `stepped` stays true in later guard states.
  - On a step:
    - The current input is re-traced at the lower tier.
    - The old picture stays, with the stale badge, until the new reply arrives. Only then are the grids re-allocated at the new cell size.
    - The guard never steps back up.
- Note and announcement: `#view-ref-degraded` (`.msg.msg-out`, `info` icon, 14 px) shows the note. Its text is written once per session into `#view-ref-live`.
- Badge: `view.badge.refDegraded` with Mit Glas; Ohne Glas keeps "Durchblick · ohne Glas".
- Technische Angaben, three lines:
  - `tech.ref.grid`: the tier path, the points of the shown panel (nx+1 × ny+1) and `tech.ref.degraded` (+ `tech.ref.stillSlow`)
  - `tech.ref.time`: the last sample, counted or not
  - `tech.ref.compute`: the worker `computeMs` of the last drawn job
- Gated hook: `if (import.meta.env.MODE !== 'production') { const FORCE_DEGRADED_FLAG = 'refdegraded'; … }` starts one tier down with the note shown.
- Test handle `ref()` gains: `tier`, `startTier`, `degraded`, `guard`, `samples`, `lastSampleMs`, `sampleN`, `lastSampleCounted`, `computeMs`, `replies [{panel, eye, tier, rays, nx, ny, rimInField}]` and `replyLog`. These contain no Rx values. `ref()` is reachable only through the gated `__eyeglassView`.
- Markup and copy: index.html adds `p#view-ref-degraded` and `p#view-ref-live` after `#view-ref-scope`, plus `p#tech-ref-grid`, `p#tech-ref-time` and `p#tech-ref-compute`. de-AT has the UI-SPEC copy.
- Build gates: `'refdegraded'` is added to HOOK_STRINGS and `src/ui/view/ref-mode.js` to ALLOW_ENV in the same commit (M4).
- Greps: `nextGuard(` in ref-mode.js = 1, `refStepDown` = 3. In the builds, `refdegraded` appears only in `dist-e2e/assets/view-*.js`, not in `dist/`.

## Measured values

### Guard integration (Playwright, SwiftShader, held worker 250 ms per slow sample)

| Case | Panel | Step | Rays before → after (same input) | Counted samples |
|---|---|---|---|---|
| desktop 1280 × 800, default Rx, −4,50 OD | 2 × 270 × 338,75 | fein → mittel | 5336 → 3080 | 297, 289 (held), 100, 73 (free); a second run under load 374, 403, 176, 122 |
| **rim case from mittel**, mobile 360 × 780 | **1 × 328 × 246 at 284,06 px/tan** (OD) | mittel → grob | **2336 → 1684** | held 2 × > 250 ms |

For the rim case:
- RIM_FRAME is `{ shape: 'rechteckig', A: 40, B: 28, DBL: 14, PD: 40 }`, −4,00 both eyes, CR-39.
- `validateFrame` returns all null, PD 40 is inside `RX_RANGES.pd`, and the shape is in `SHAPES`.
- rimInField, Node at the reported panel: true at mittel (2336 rays) and true at grob (1684 rays).
- rimInField, browser reply before the first slow sample: true. After the step: true.
- The rays are strictly fewer after the step, so `≤` was not needed.

After the step, two free edits kept the tier at or below the stepped tier, and the live region got 0 more writes. The size block (percentages) for the same Rx is identical before and after.

### D-17: 4× CPU-throttled proxy (`npm run test:perf -- -g "Durchblick"`, perf project, 1280 × 800, 10 quiet Sph edits)

| Layout | Input → picture median | p95 | Tier reached | Worker compute median / p95 (unthrottled) | Rays per job |
|---|---|---|---|---|---|
| default Rx, two panels | 88,8 ms | 106,0 ms | fein (no step) | 7,85 / 12,4 ms | 5336 |
| item-12 box with **rund**, PD 40, rim in both panels | 122,2 ms | 258,0 ms | fein → **mittel** after edits 1 and 2 (258, 236 ms) | 35,5 / 153,7 ms | 25304 (fein) → 6856 (mittel) |

- Host load average was 1,6–2,4 during the second run.
- The worker is not throttled (ROADMAP; 01-15 measurement), and the picture is software-rendered, so these are not phone GPU numbers.
- **Data point for lens-critic (M2 and the 04-05 budgets):** in the 1280 rim case the fein trace alone costs about 144–154 ms in an unthrottled worker. A real phone worker would be slower. The step to mittel cuts the rays by 73 % and the compute time to about 35 ms. On a phone, which starts at mittel, the 04-05 Grenzfall budget question applies to mittel and grob only.
- **No GPU-memory measurement** for the 89 MB chart texture (04-08). This plan did not touch the texture, and SwiftShader gives no meaningful phone memory figure.

### D-30 visual pass: Playwright (the chrome-devtools MCP pass is the orchestrator's after the merge)

Screenshots are in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-10-shots/`. The script is `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-10-shots.mjs`. The run used dist-e2e with `?refdegraded`, isMobile, DPR 2. The production preview has no hook by design.

- **320 × 640:**
  - One panel 288 × 216, tier mittel → grob.
  - The note box (grey, black left border, info icon) sits after the scope sentence and wraps without clipping.
  - The badge reads "Durchblick · vereinfacht".
  - Technische Angaben: "Durchblick-Raster: Stufe mittel → grob, 30 × 23 Punkte je Glas (automatisch vereinfacht, weil die Berechnung zu lange dauerte)", "Durchblick bis zum Bild zuletzt: 1 024,40 ms" (the uncounted entry job, including warm-up) and "davon Rechenzeit im Hintergrund: 8,60 ms".
  - scrollWidth is 320.
- **412 × 915:** two panels 189 × 285, the same note and badge, a 20 × 30 grid. scrollWidth is 412.
- **axe** (wcag2a/aa, 21a/aa, 22aa) in the degraded state: **0 violations** at both sizes.
- **Console:** only the Playwright service-worker block notice and Chromium's "GPU stall due to ReadPixels" driver notes.

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/ui/view/tiers.test.js src/state/guard.test.js` | 19/19 (RED before GREEN: 4 failed) |
| `npm run lint` | clean |
| `npm run test:coverage` | 59 files, 2134/2134; all files 99,25 % lines |
| `npm run build && npm run build:e2e` | ok; precache 952,23 / 955,29 KiB |
| `npm run test:dist` | 19 passed, 1 skipped (hooks: `refdegraded` absent from dist/, present in dist-e2e/) |
| `npx vitest run test/ci/env-gates.test.js src/ui/view src/i18n` | 319/319 |
| `npx playwright test e2e/view-controls.spec.js` (Task 1) | 40 passed, 12 skipped |
| `npx playwright test e2e/view-controls.spec.js e2e/view.spec.js -g thumb` | 9 passed, 9 skipped (the thumbnail guard test passes unchanged) |
| `npx playwright test e2e/view-ref.spec.js e2e/view-controls.spec.js e2e/a11y.spec.js e2e/view.spec.js e2e/layout.spec.js` | **216 passed, 34 skipped, 0 failed** (14,4 min) |
| `npx playwright test e2e/view-ref.spec.js --project=mobile -g "rim case from mittel"` | passed (in the batch above and separately) |
| `npx playwright test e2e/view-memory.spec.js e2e/view-fullscreen.spec.js e2e/ref-live.spec.js` (extra) | 11 passed, 1 skipped |
| `npm run test:perf -- -g "Durchblick"` | 1 passed (table above) |
| `npm run test:e2e:live` | not run: no `@live` test added or changed |

The M3 literals and tests are unchanged, and M3 (a)/(b)/(c) pass in the batch.

## Deviations from Plan

1. **[Rule 3] Worktree base reset.** HEAD was 47bb4e2. I ran `git reset --hard e1d27eb` before any commit of mine, as instructed. node_modules was symlinked.
2. **[Plan premise corrected] Mobile panel size.** The plan assumed two portrait panels of about 179 × 270 at 360 × 780. The mobile project actually shows one 328 × 246 panel, because the stage is below 360 px wide (04-09). There the item-12 rechteckig frame has the rim in the field, so the shape lever (rund, panto) was not needed. The test asserts this in Node at the reported panel.
3. **[Copy placeholder] `tech.ref.grid`** uses `{nx} × {ny}` instead of `{n} × {n}`, because the panels are not square. The wording is otherwise the UI-SPEC copy. **Flag for lens-critic.**
4. **[Interpretation] "each automatic step is logged"** is shown as a tier path ("Stufe fein → mittel → grob") in the one grid line, plus the single `tech.ref.degraded` suffix. Repeating the suffix once per step would duplicate the parenthetical sentence.
5. **[Interpretation] Programmatic paints.** `main.js` calls `update(performance.now())` for the handover and the start, so those requests carry a real timestamp rather than null. They cannot reach the guard as counted samples: the job after entering is a warm-up exclusion, and a repeated t0 is never counted twice. `main.js` was not changed (not in files_modified).
6. **[Rule 2] Interrupt handling** is timestamp-based (`lastInterruptAt ≥ t0`), so a hide before the job is even posted also voids the sample.
7. **view-controls.spec.js was not edited.** No test read the removed `slowRun` internal. The thumbnail-guard e2e lives in view.spec.js and passes unchanged.
8. **Extra test-handle fields** (`replyLog`, `samples`, `sampleN`, `lastSampleCounted`) were added for the integration test and the proxy. The proxy fix (3b6c4db) reads each edit's own counted sample. A first version read `lastSampleMs`, which the uncounted step re-trace had overwritten.

## Known Stubs

None.

## Threat Flags

None beyond the register:
- T-04-40: two counted samples in a row; the exclusions are implemented and tested; one-way stepping.
- T-04-41: the hook is behind the MODE gate; an E8 grep test and the ALLOW_ENV entry cover it.
- T-04-42: accepted; `stillSlow` is logged.

## For lens-critic (result review)

- Deviation 3: the copy placeholder.
- Deviation 4: the step log as a tier path.
- The rim proxy data point: fein costs about 150 ms of worker time at 1280 × 800 for the item-12 box with rund.
- The CI-load risk at the top of this summary.

## Commits

- bc48d2a test(04-10): failing tests for the Durchblick grid start tier and step-down (D-15)
- fa3e599 feat(04-10): Durchblick grid start tier, refStepDown, thumbnail guard on nextGuard (D-15, F-06)
- 3925e58 feat(04-10): measured Durchblick degradation, degraded note and Technische Angaben (D-16, D-17, REF-02)
- 3b6c4db test(04-10): 4x proxy reads each edit's own counted sample and job (not the step re-trace)

## TDD Gate Compliance

Task 1 has a `test(04-10)` RED commit (4 failing) followed by a `feat(04-10)` GREEN commit. Task 2 is `tdd="false"`; its e2e tests were written after the code.

## Self-Check: PASSED

All modified files exist. Commits bc48d2a, fa3e599, 3925e58 and 3b6c4db are in `git log`. The preview server I started (PID 529158) is stopped, and no background process of this run is left.
