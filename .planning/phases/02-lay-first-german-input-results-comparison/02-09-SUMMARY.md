---
phase: 02-lay-first-german-input-results-comparison
plan: 09
subsystem: ui-presets, state-presets, layout, engine-tests
tags: [presets, inline-confirm, RES-05, RES-06, D-26, D-27, sticky-layout, property-tests, tdd]
requires: ["02-08", "02-04", "02-02", "02-01"]
provides:
  - "src/state/presets.js: frozen EXAMPLE, RX_PRESETS (leicht, stark, weit, hhv), FRAME_PRESETS (klein, mittel, gross) as paper field text"
  - "src/ui/presets.js: initPresets({ hasOwnRx, onRxApplied, hasOwnFrame, applyFrame }) — chip rows + inline non-modal confirm"
  - "frame-input.js: frameSizesTyped(), applyFrameSizes(A, DBL)"
  - "index.html: .layout-cols grid wrapper around .col-inputs/.col-results; .col-full below it"
affects: [02-10 (Expert inputs sit after the chips in the keyboard order), 02-14 (a11y/keyboard path now includes the chips; phone fold note), phase 3 (sticky column containing block is .layout-cols)]
tech-stack:
  added: []
  patterns: [presets as field text through the normal input event, "own values" = differs from what the page wrote last, sticky column in its own grid wrapper, per-case property tests with per-case sample floors]
key-files:
  created:
    - src/state/presets.js
    - src/state/presets.test.js
    - src/ui/presets.js
    - e2e/presets.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-09-SUMMARY.md
  modified:
    - index.html
    - src/ui/style.css
    - src/ui/main.js
    - src/ui/frame-input.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - src/engine/properties.test.js
    - e2e/layout.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "[02-09]: The two-column grid moved from main.layout to a new .layout-cols wrapper. A sticky box is held inside its parent box, so .col-full must not share the sticky column's parent (RES-06 disclaimer overlap)."
  - "[02-09]: 'Own values' (confirm needed) means non-empty Sph/Zyl/Achse texts that differ from what the page last wrote (the example or the last preset). For the frame it means A, B or DBL typed and not set by a preset. Trying presets one after another never asks."
  - "[02-09]: A frame chip writes B = estimateB(shape, A) into the field directly, so B follows the shape even when the user had emptied B. A typed B counts as an own value (the plan named only A/DBL), so it is never dropped without asking."
  - "[02-09]: MAT-02 monotonicity is 12 tests (frame × material) with per-case observed sample floors summing to the former 3188 gate. Same sweeps and assertion; only the timeout budget is per case."
metrics:
  duration: "~40 min"
  completed: 2026-11-07
  tasks: 4
  files: 14
---

# Phase 2 Plan 9: Preset chips with inline confirm, plus the disclaimer and MAT-02 fixes — Summary

**Main points.** A lay user can try the four typical prescriptions and three frame sizes with one tap. The chips go through the same field → input-event → parse → validate → compute path as typing, and typed values are only replaced after an explicit "Ersetzen". Two extra orchestrator tasks: the sticky results column no longer covers the "Wichtiger Hinweis" box (RES-06), and the MAT-02 property test no longer runs near its timeout under coverage load.

**Most likely to bite.** On a 360 × 780 phone the new chip row (180 px, 3 rows) pushes R Sph below the first screen; it starts at 834 px. This follows the UI-SPEC page structure and keyboard order, and I did not change it. It is logged in deferred-items.md for 02-14 / lens-critic.

## Tasks

| # | Task | Commit |
|---|------|--------|
| X1 | fix: sticky results column covered the disclaimer (RES-06) | `fb13c05` |
| X2 | fix: MAT-02 monotonicity robust under coverage load | `73781df` |
| 1 | RED preset tests, then preset data | `18ac5bf` (test), `ec772ac` (feat) |
| 2 | Chip rows + inline non-modal confirm | `3b71c20` |

### X1: disclaimer overlap (RES-06)

- **Cause, measured** at 1280 × 800 with the page at the bottom. `main` spans top −1613 to bottom 715 px. `.col-inputs` ends at 270 px, but `.col-results` spans −53…715 and `#disclaimer` spans 350…655. The sticky column's bottom limit was its parent's bottom (the whole `main` grid), not its grid row. `.col-full` shared that parent, so the column slid over it. The overlap was 150 800 px² at 900 px.
- **Fix:** `<div class="layout-cols">` wraps `.col-inputs` and `.col-results`. The grid CSS moved from `.layout` to `.layout-cols`, and `.col-full` is a plain block below it. The diff with whitespace ignored is 2 lines of HTML; the rest is re-indentation. After the fix, at the page bottom, `.col-results` ends at 286 px and `.col-full` starts at 350 px. The UI-SPEC page-structure block is updated to match.
- **e2e** (`layout.spec.js`): at 1280 and 900 px, with and without Experten-Ansicht, scrolled to the bottom. It checks that the disclaimer is fully in the viewport, that `elementFromPoint` at its centre hits the disclaimer or a descendant, and that the overlap area with `.col-results` is 0. Before the fix all 4 desktop cases failed on the overlap area. After it, 8/8 pass (desktop + mobile projects).

### X2: MAT-02 under load

| Run (full coverage suite, 8 cores, i7-8809G) | MAT-02 | Suite |
|---|---|---|
| Before, unloaded | 1 test, **45 928 ms of 60 000 ms** | 1337/1337 passed, wall 180,5 s |
| 02-08 record, 4 CPU burners | failed at 72,0 s | — |
| After, 4 CPU burners | 12 tests, sum **73 945 ms**, slowest **8 170 ms of 60 000 ms** | 1348/1348 passed, wall 258,4 s |
| After, unloaded (plan-end run) | 12 tests, sum 44 991 ms, slowest **4 881 ms of 60 000 ms** | 1375/1375 passed |

How the property is kept: the same 6 frames × 2 materials × cyl {0, −2, −4} × the two away-from-zero sphere sweeps (0,25 dpt steps), and the same `drop ≤ 0,005 mm` assertion at every step. The old total gate `samples ≥ 3188` is now one floor per case: the observed ok counts 270/270, 223/269, 270/270, 270/270, 270/270, 266/270, which sum to 3188. That is stricter than the total. The 4-burner run shows a single 60 s test would still have failed under load (74 s of work), so splitting was needed, not cosmetic.

### Task 1: preset data

Engine re-verification (scratch `presets-verify.mjs`, `evaluateLens`, CR-39, Rechteckig 52×38/18, PD 32 / 31,5). It matches the plan table:

| Preset | R thickest / where / CT / g | L thickest / where / CT / g |
|---|---|---|
| Leicht kurzsichtig | 3,013 außen oben / 1,8 / 5,48 → 3,0 · 5 g | 2,798 außen oben / 1,8 / 5,29 → 2,8 · 5 g |
| Stark kurzsichtig | 8,743 außen oben / 1,8 / 10,14 → 8,7 · 10 g | 8,263 außen oben / 1,8 / 9,67 → 8,3 · 10 g |
| Weitsichtig | CT 3,902 in der Mitte, etMax 2,824 oben, 7,23 g | CT 3,737 in der Mitte, etMax 2,748 oben → 2,7, 7,00 g |
| Hornhautverkrümmung | 2,868 außen oben / 1,8 / 5,42 → 2,9 · 5 g | 3,294 außen unten / 1,8 / 5,58 → 3,3 · 6 g |

- **Hornhautverkrümmung R pin:** '2,9 mm außen oben', with the TIE_TOL_MM comment in the spec. One new observation: `validateRxEye` already normalises Achse 180 to `axisDeg: 0`, so Achse 180 and 0 send the same spec to the engine. The e2e check "typing Achse 0 leaves `#result-od-thick-loc` unchanged" passes, but at the UI level it is now trivially true.
- **Weitsichtig R headline** is pinned in full: 'Rechtes Glas: am dicksten 3,9 mm in der Mitte, am dünnsten 1,0 mm außen oben. Mitte 3,9 mm, Gewicht 7 g.' With the Experten-Ansicht on, the edge rows read 2,8 mm (R) and 2,7 mm (L).
- **Frame:** estimateB('rechteckig', 48/52/56) = 35/38/41, and estimateB('rund', 48) = 44 (pinned in the Rund + Klein test).

### Task 2: chips and confirm

- **Placement:** `#rx-presets` + `#rx-preset-confirm-slot` sit inside `form#rx` before the table. The built page has no `#rx-section`; the Rx block is `form#rx`, so axe runs on `#rx`. `#frame-presets` + `#frame-preset-confirm-slot` sit directly after the shape fieldset. Both rows are `role="group"` + `aria-labelledby`.
- **Confirm:** `role="group" aria-labelledby="preset-confirm-q"`. It has the question, the body naming the preset, "Ersetzen" (`.btn-danger`, filled `--error`) and "Eingaben behalten". Focus moves to "Eingaben behalten", and Esc anywhere in the group keeps the inputs. After either choice the group is removed and focus returns to the chip. Only one confirm is open at a time. There is no browser dialog and no extra live region (the focus move announces it).
- **Rx apply:** if "Gleich für beide Augen" is checked, it is switched off first (through its own `change` handler). Then the six Sph/Zyl/Achse texts are written (PD kept) and one `input` event is dispatched on `#rx-od-sph`. That event runs the example's listener, which removes the banner on the first change, and schedules one input frame.
- **Frame apply:** `applyFrameSizes` writes the parsed A and DBL, sets B to estimateB(shape, A) with B marked untyped, and dispatches `input` on `#frame-a`. The A field's own handler then rewrites the stamp to `A□DBL 140` and schedules.
- **e2e** (`presets.spec.js`, 17 tests × 2 projects = 34) covers:
  - immediate apply on the untouched example, and the pinned values;
  - the confirm paths: Esc, click "Eingaben behalten", "Ersetzen";
  - one confirm at a time;
  - presets in a row do not ask;
  - "Eigene Werte eingeben" does not ask;
  - the `rx-same` interaction;
  - axe on `#rx` with the confirm open: 0 WCAG violations;
  - keyboard only: Tab from the switch to the first chip, Enter, Esc, focus back on the chip;
  - frame chips: Groß gives 56/41/18 'geschätzt' with the shape kept; Rund + Klein; a typed A asks; chip after chip does not ask.

## ENG-09 (4× CPU proxy, case A, `npm run test:perf`)

| | 02-08 (brief) | 02-08 scratch `perf-0208.json` | 02-09 `perf-0209.json` |
|---|---|---|---|
| input frame median (max) | 15,55 (17,5) ms | 17,55 (28,3) ms | **15,55 (20,8) ms** |
| result median | 36,15 ms | 41,2 ms | **36,5 ms** |
| compare paint median | 7,7 ms | 10,6 ms | **7,5 ms** |

The brief's baseline does not match the numbers in the scratchpad `perf-0208.json` (rate 4). I report both. 02-09 is within noise of the brief's baseline and below the file. The benchmarkIndex at rate 4 was 498,5 in this run against 330 in the file, so machine state differs between runs. The verdict pattern is the same as in 02-08 at every rate: `a` fails as before and `b`/`c`/`d` pass. 02-09 adds no per-input work: the chips are built once, and a preset is one input event.

## Deviations from Plan

### Auto-fixed / adapted

1. **[Rule 1 - Bug] "Own values" definition.** The plan defines Rx own values as "any Rx field text differs from EXAMPLE while touched" and frame own values as `userTyped.A || userTyped.DBL`. With that rule, the second preset tapped would always ask, because the first preset's values differ from EXAMPLE and set userTyped. Emptied fields ("Eigene Werte eingeben") would also ask. Implemented instead: compare against what the page wrote last, ignore empty fields, and for the frame exclude sizes set by a preset. This is covered by two e2e tests. (`3b71c20`)
2. **[Rule 2 - Missing critical] A typed B counts as an own frame value.** A frame preset resets B to the estimate. Without this rule, a typed B would be lost without asking (T-02-24). (`3b71c20`)
3. **[Rule 3 - Blocking] Target ids as built.** There is no `#rx-section`, so the chips sit in `form#rx` and axe includes `#rx`. The `initPresets` hooks are `{ hasOwnRx, onRxApplied, hasOwnFrame, applyFrame }`: `isUntouched` folds into `hasOwnRx`, and the frame write lives in frame-input.js, which owns `userTyped`.
4. **[Rule 1 - Test precondition] `layout.spec.js` 360 × 780 "summary bar" test.** It asserted `#rx-od-sph` in the viewport at scroll 0. The UI-SPEC chip row pushes R Sph to 834 px. The precondition now anchors on `#rx-presets`; the test's actual claim, that the bar shows while the result is out of view, is unchanged. (`3b71c20`)
5. **Comment wording.** The presets.js header said "No window.confirm", which tripped the plan's own `grep "window.confirm\|confirm("` acceptance check. It now says "No browser dialog".

### Orchestrator extra tasks

These are X1 and X2 above, each committed as `fix(02-09)`. deferred-items.md is updated: both items are marked resolved with numbers, the remaining near-timeout engine tests are listed with their 4-burner timings, and the new phone-fold note is added.

## Requirements

- **RES-05** (example + presets, confirm before overwrite): delivered. The example comes from presets.js and the chips plus inline confirm are in place; this plan completes RES-05, so it is marked complete.
- **RES-06** (disclaimer always readable): the regression is fixed, but RES-06 is not this plan's requirement and its other parts belong elsewhere, so it is not marked from here.

## Plan-end verification

Run in this order, unloaded, `npm run lint && npx vitest run --coverage` (the same command as `npm run test:coverage`, with a JSON reporter added for the timings) `&& npm run build && npm run test:e2e`. Exit 0.

- lint: `eslint .` clean
- test:coverage: **32 files, 1375/1375 tests passed**. Engine coverage: statements 98,47 %, branches 96,42 %, lines 99,18 % (thresholds 95/90)
- build: `✓ built in 124ms`
- test:e2e: **262 passed (1.8m)**, desktop + mobile, 0 failed, 0 flaky

## Known Stubs

None. Chips and confirm are wired to real fields and the real compute path.

## Threat Flags

None. No new network, storage or trust-boundary surface. Preset data is static and goes through the normal validation (T-02-25); overwrite protection follows T-02-24.

## Self-Check

PASSED. All files exist: src/state/presets.js, src/state/presets.test.js, src/ui/presets.js and e2e/presets.spec.js. All commits are in git: fb13c05, 73781df, 18ac5bf, ec772ac and 3b71c20.

## TDD Gate Compliance

RED `18ac5bf` test(02-09) came before GREEN `ec772ac` (data) and `3b71c20` (UI). In RED, the unit file failed on the missing module and the e2e spec failed against the build without chips.
