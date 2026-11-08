---
phase: 03-3d-lenses-frame
plan: 06
subsystem: ui/view (states, eye labels, phone placement)
tags: [VIZ-01, UX-03, D-14, D-16, D-17, lens-critic MAJOR 5]
requires: [mountView, createScene, refreshView, settledView, noThreeWarnings, guardPage]
provides: [createLabels, place, placeViewSlot, guardPage().allowFailed, view.eye.*, view.empty, view.loadFailed, view.retry, view.noWebgl]
affects: [03-07 frame (empty rim under the blocked label), 03-13 callouts (label pool), 03-15 thumbnail (UX-03)]
tech-stack:
  added: []
  patterns: [projected HTML labels via CSSOM transform, DOM move by matchMedia instead of CSS order]
key-files:
  created:
    - src/ui/view/labels.js
    - src/ui/view-place.js
  modified:
    - src/ui/view/view.js
    - src/ui/pipeline.js
    - src/i18n/de-AT.js
    - src/ui/style.css
    - e2e/view.spec.js
    - e2e/layout.spec.js
    - e2e/helpers.js
decisions:
  - "03-06 (D-14 revised, MAJOR 5): below 900 px #view-slot is moved in the DOM directly after section#result (view-place.js, same query as summary-bar NARROW); >= 900 px it stays first in .col-results (D-13)"
  - "03-06: view.loadFailed drops 'darunter' ('Die berechneten Werte gelten unverändert.'), because on phones the values now sit above the view"
  - "03-06: eye-label anchor = (boxingCentreX, −B/2 − 6 mm, 0); a blocked eye without its own spec uses the last frame seen on any eye"
metrics:
  duration: ~45 min
  completed: 2026-11-08
  tasks: 2
  files: 9
---

# Phase 3 Plan 06: View states and numbers-first placement Summary

The 3D view now has a plain-German message or label for every state that is not the normal one: no WebGL2, a failed chunk load with 'Erneut versuchen', a blocked eye and no computable eye. Below 900 px the view moves under the result section, so the numbers come first on phones.

## Most likely to bite

1. **On phones the 3D view is now far down the page.** I measured it at the mobile project (dpr 2.625) with the results region scrolled to the viewport top:

   | Viewport | `#result-od-thick` top / bottom | `#view-slot` top |
   |---|---|---|
   | 320 × 640 | 285,3 / 318,9 px | 1 431,6 px |
   | 360 × 780 | 260,7 / 294,3 px | 1 250,0 px |
   | 412 × 915 | 261,1 / 294,7 px | 1 250,5 px |

   The view sits after the whole `section#result` (cards, notes, diagnostics, material lines), so it is about 1 000–1 150 px below the first value. That is what MAJOR 5 asked for. The lens view while editing (UX-03) now depends entirely on the summary-bar thumbnail (03-15). Until 03-15 lands, a phone user sees the 3D view only by scrolling past all results.
2. **Copy deviation from UI-SPEC:** `view.loadFailed` says "Die berechneten Werte gelten unverändert." instead of "… Werte darunter …". After the move, "darunter" (below) is false on phones. UI-SPEC line 367/387 should be amended to match. lens-critic should confirm.
3. **Retry works in Chromium only as tested.** After an aborted chunk fetch, a second `import()` re-fetched and mounted the view (the e2e test passes on desktop and mobile Chromium projects). Whether Safari/Firefox re-fetch a failed dynamic import instead of returning the cached failure has not been checked.

## What was built

- `src/ui/view/labels.js`: `createLabels(container, count)` keeps a fixed pool of `.view-label` spans (createElement + textContent). `place(el, world, camera, size)` projects with `Vector3.project` and writes `el.style.transform` (CSSOM, CSP-safe). A label is hidden outside the view volume or when it has no text.
- `src/ui/view/view.js`:
  - No WebGL2 (`?nowebgl` or a failed context): `#view-status` shows the info icon plus `view.noWebgl`, `#view` data-pending ''.
  - Labels 'R' / 'L' sit 6 mm below each lens's boxing bottom (y = −B/2). They are re-projected in an `afterRender` hook. A blocked eye reads 'R – nicht berechnet' / 'L – nicht berechnet'. A mesh that comes back not drawable gets the same label.
  - No ok eye: caption `view.empty`, both slots hidden, no labels, data-pending ''.
- `src/ui/pipeline.js`:
  - `loadView()` and `showLoadFailed()`: a Fehler-tier box in the stage holds the message and a secondary 'Erneut versuchen' button (textContent). The click moves focus to `#view-stage`, shows 'wird aufgebaut …' and re-runs the import.
  - [Rule 1] While the failure is shown, a later `refreshView()` no longer leaves `#view[data-pending]` stuck at 'queued'. Before this plan it would have stayed there for good after a failed load.
  - `placeViewSlot()` is called once, right before `#view-slot` is first shown.
- `src/ui/view-place.js`: `placeViewSlot()` uses matchMedia `(max-width: 899.98px)`. It does `result.after(slot)` or `col.prepend(slot)`, but only when the slot is not already in place. It is idempotent (one listener).
- `e2e/helpers.js`: `guardPage()` now returns `{ allowFailed(re) }`, which exempts matching failed requests for the current test only. The load-failure test uses it for its aborted view chunk.

## Verification (real output, this machine, 2026-11-08)

- `npm run lint`: `eslint .`, no findings.
- `npm run test:coverage`: `Test Files 41 passed (41)`, `Tests 1722 passed (1722)`, `All files | 98.91 | 96.87 | 100 | 99.48`, EXIT=0.
- `npm run build`: OK. Entry `index-CJJgyRRc.js` 135,13 kB (gzip 46,78). `view-jobwZxcE.js` 554,16 kB (gzip 139,32), still with Vite's > 500 kB warning (carried from 03-05). `grep -l WebGLRenderer dist/assets/index-*.js` finds nothing.
- Port check before e2e: `curl … http://localhost:4173/Eyeglass-Prescription/` printed `000`.
- `npm run test:e2e`: **`411 passed`, `1 skipped` (3.7m), EXIT=0.**
- Task 1: `npx playwright test e2e/view.spec.js e2e/smoke.spec.js` gave 66 passed. The first run had 2 failed: my D-17 check compared `#result-od-ct`, which stays at the minimum CT for a minus lens. The fix compares `#result-od-thick`.
- Task 2: `npx playwright test e2e/layout.spec.js` gave 38 passed. `e2e/a11y.spec.js e2e/view.spec.js` gave 28 passed.
- Acceptance greps:
  - `'view.noWebgl'` 1, `'view.retry'` 1.
  - `createElement` in labels.js: 2. `innerHTML|setAttribute('style'` in labels/view/pipeline: 0 each.
  - `export function placeViewSlot` 1, `max-width: 899.98px` 1, `from 'three'|view/` in view-place.js 0.
  - `^\+.*\border:` in the style.css diff: 0.
- Breakpoint test (1280 → 360 → 1280): after each move the OD mesh equals the card, the corner pixel is #f3f4f6 ± 2, there were 0 `webglcontextlost` events and no Three.js warnings.
- MCP (D-30 screenshots at 412×915 / 320×640 / 1280×800, console): **not done here.** The orchestrator does it after this plan returns, as agreed.

## Task commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 9634f68 | feat(03-06): eye labels and the no-WebGL, load-failure, blocked and empty view states |
| 2 | e42edf0 | feat(03-06): numbers first on phones, the 3D view moves below the results under 900 px |

## Deviations from Plan

**1. [Rule 1 - Bug] `#view[data-pending]` stuck at 'queued' after a failed chunk load.** `refreshView()` set 'queued' and then returned while `viewLoading` stayed true. It now clears the flag while the failure is shown. The load-failure test covers this with an input before the retry. Commit 9634f68.

**2. [Rule 1 - Copy] `view.loadFailed` without "darunter"** (see "Most likely to bite" 2). Commit 9634f68.

**3. [Rule 3] `guardPage().allowFailed(re)`.** The plan expected this ("scope the guard for this one test"). It is per test and per URL pattern; every other failed request still fails the test. Commit 9634f68.

**4. Test details beyond the plan**
- The no-WebGL test exempts and asserts the one deliberate `3D view: no WebGL2` warning.
- The blocked-eye test checks that the labels lie inside the stage, with R left of L.
- The empty test checks that typing a Sph brings the lens back.
- In `layout.spec`, `noThreeWarnings` is registered file-wide but asserted only in the breakpoint test.

**5. Label anchor.** It is at the boxing box bottom, centred on the boxing centre x, not under the exact x of the lowest outline point. It is still 6 mm below the lowest point, and it reads better centred under the lens.

## Known Stubs

- No frame is drawn yet (03-07), so in the blocked and empty states no "empty rim" is visible. Only the label or the caption shows the state.
- The toolbar, hints and heatmap controls do not exist yet. The no-WebGL rule "not rendered" holds trivially, and later plans must keep it.

## Threat Flags

None beyond the register:
- T-03-47: covered by the four new view tests.
- T-03-48: covered by the MAJOR 5 tests at 320 and 360.
- T-03-49: covered by textContent, the CSSOM transform and the greps above.

## Self-Check: PASSED

src/ui/view/labels.js and src/ui/view-place.js exist. Commits 9634f68 and e42edf0 are in `git log`.
