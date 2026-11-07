---
phase: 02-lay-first-german-input-results-comparison
plan: 11
subsystem: engine + expert-ui
tags: [MAT-05, FRAME-02, UX-01, aspheric, conic, rim-depth, expert-view]
requires: [02-10]
provides:
  - "engine: optional LensSpec.frontConic (k ≤ 0; null/0 = sphere), INVALID_SPEC reason 'front-conic'"
  - "automatic base curve searched at k = 0, k applied at that D1 (warm-started solveCT), convex-back guard with minimal D1 raise"
  - "src/engine/rim.js: RIM_DEPTH_DEFAULT_MM = 3.0 [ASSUMED], edgeBeyondRim(metrics, rimDepthMm)"
  - "specFor appends frontConic as the last key only when non-zero (cache keys unchanged)"
  - "validateConic (−5…−1, empty = default −1), validateRimDepth (0,5…10 mm), fmtConic"
  - "Vorderfläche radios + k field in #glass-settings; [Expert] Randtiefe #frame-rim with per-eye lines"
affects: [src/engine/evaluate.js, src/state/bench-cases.js, src/ui/expert.js, src/ui/frame-input.js, src/ui/pipeline.js, src/ui/main.js]
tech-stack:
  added: []
  patterns:
    - "Display-only Expert values (rim depth) are painted from the painted main metrics and never enter a spec, so they start no compute job"
    - "Optional spec keys are appended only when they differ from the default, keeping earlier JSON cache keys byte-identical"
key-files:
  created:
    - src/engine/rim.js
    - src/engine/rim.test.js
  modified:
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/engine/properties.test.js
    - src/engine/sag.test.js
    - src/state/bench-cases.js
    - src/state/bench-cases.test.js
    - src/state/validate.js
    - src/state/validate.test.js
    - src/i18n/format.js
    - src/i18n/format.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - src/ui/expert.js
    - src/ui/frame-input.js
    - src/ui/pipeline.js
    - src/ui/main.js
    - src/ui/rx-input.js
    - src/ui/style.css
    - index.html
    - e2e/expert.spec.js
    - e2e/rx.spec.js
    - e2e/frame.spec.js
decisions:
  - "An empty k field means the default k = −1 (the label says 'Standard −1'), not the sphere; the sphere is the 'sphärisch' radio."
  - "An invalid or out-of-range rim depth shows its message and no rim line; only an empty field falls back to the 3,0 mm default. It never blocks an eye."
  - "The '(für sphärische Vorderfläche bestimmt)' label is shown only for the automatic rule. A manual curve is not chosen by the rule, and its Vogel sentence has no thickness."
  - "The rim line says 'dicker' only when the excess is ≥ 0,05 mm, so it never shows '0,0 mm dicker'."
  - "The 10-pass limit of the convex-back guard returns BACK_SURFACE_CONVEX (the existing automatic-search code). The sweep never reached it, so it is the only uncovered branch of evaluate.js, line 189."
metrics:
  duration: 35min
  completed: 2026-11-07
  tasks: 2
  files: 24
---

# Phase 2 Plan 11: Aspheric front and rim depth Summary

Experts can switch the front surface to a generic conic, "asphärisch (allgemeines Modell, kein bestimmtes Herstellerdesign)", with k from −5,0 to −1,0. The base curve is still chosen on the sphere. The only change to it is a minimal raise that keeps the back from turning convex. They can also enter a frame rim depth (default 3,0 mm, labelled as an assumed value) and see whether the thickest edge point fits.

## Commits

| Task | Gate | Commit | Message |
|------|------|--------|---------|
| 1 | RED | 4793b76 | test(02-11): failing conic front and rim tests |
| 1 | GREEN | ddb9f21 | feat(02-11): generic conic front (D1 at k = 0) and rim-depth helper |
| 2 | — | 420bb94 | feat(02-11): aspheric front and rim depth in the Experten-Ansicht |

## What was built

**Engine (additive, pure)**
- `frontConic` passes `invalidReason` when it is null, or finite and ≤ 0. Values 0,5, NaN, Infinity and the string '−1' give `INVALID_SPEC { reason: 'front-conic' }`.
- **Manual branch:** `solveCT({ ...common, k1: k, D1 })`.
- **Automatic branch:**
  - The search runs unchanged with `common.k1 = 0`.
  - Then `solveCT({ ...common, k1: k, D1, ct0: r.ct })` runs, with the warm start inside the single object argument.
  - The convex-back guard follows. While `max(D2a, D2b) > BACK_CONVEX_MAX_DPT`, it sets `D1 = max(D1, m / (1 + (ct/1000)/n · m))` and solves again.
  - `baseCurveSearch` and `vogelMaxThickness` stay the k = 0 values.
- A comment block covers the p = 1 + k derivation, the US4289387 citation and its plus-lens-only scope, the D1min derivation, and the warning sign.
- `rim.js` imports nothing.
- `specFor` appends `frontConic` only for a non-zero finite k. With null, 0 or undefined, the JSON is byte-identical to the 02-10 `NORMAL_PAIR.OD` string.

**Measured values (engine, `--silent=false` logs of the new tests)**

+4,00 CR-39, rechteckig 52×38/18, PD 32:

| k | CT (mm) | D1 (dpt) |
|---|---------|----------|
| 0 | 4,876 | 3,9508 |
| −1 | 4,8169 | 3,9508 |
| −2 | 4,7615 | 3,9508 |
| −5 | 4,6127 | 3,9514 (guard, +0,0006) |

+6,00 / −1,00 × 90, same frame:

| k | CT (mm) | D1 (dpt) |
|---|---------|----------|
| 0 | 6,1029 | 5,8607 |
| −1 | 5,9067 | 5,8615 |
| −2 | 5,7344 | 5,8655 |
| −5 | 5,3177 | 5,8750 |

- **Property** 'automatic D1 is the k = 0 D1 unless the back would turn convex': 120 runs, seed 1105, plus Rx in the canonical frame, CR-39 and 1,67, k ∈ [−5, −1].
  - The guard fired in 35 of the 120 cases.
  - The largest D1(k) − D1min(ct(k)) was **8,196e-8 dpt**, against a bound of 1e-6.
  - max(D2a, D2b) ≤ 0 in every case, and CT(k) ≤ CT(0) + 1e-9.
- **Minus lens:** the example R −2,75 −0,50 × 180 barely changes. etMax is 4,597 mm at k 0 and −1, and 4,598 mm at −5. CT stays 1,8 mm at the minimum.
- **Paraxial power:** `traceBVP` on conic lenses (+4, +6/−1×90, −4/−2×30 at k −1 and −5) reproduces the Rx within the existing 0,01 dpt oracle tolerance.
- **Conic sag identity:** r² − 2z/c + (1 + k)z² = 0 holds to 1e-9 relative over 500 random (c, r, k). At k = −1 the sag equals c·r²/2.

**UI**
- **Vorderfläche** (`#expert-front`): a segmented control in `#glass-settings` with check icons (state not shown by colour alone).
  - Choosing 'asphärisch' reveals `#expert-k-wrap`. It holds the ± button, `#expert-k` (default '−1'), the `tip-k` toggletip, an echo 'k = −1,0' and the plus-lens note.
  - A k message blocks both eyes, but only while 'asphärisch' is chosen.
- **Spherical-basis label:** while k ≠ 0, "(für sphärische Vorderfläche bestimmt)" follows the rule text and the Vogel thickness sentence. It appears in `#result-*-basecurve` and in `#expert-bc-auto-*`.
- **Randtiefe** (`#frame-rim-wrap`, `data-expert`): `#frame-rim` (default '3,0'), with the note "Standard 3,0 mm (angenommener Wert, keine Herstellerangabe). Die Randtiefe ändert Dicke und Gewicht nicht.", the `tip-rim` toggletip, and one line per eye.
  - For the example both lines read 1,6 mm (etMax 4,597 mm for both eyes).
  - `renderRim` is called from `paintDeliveries` (main lane only), `onFailed` and `requestMain` (empty eyes). The switch toggle repaints the lines.
  - Typing in `#frame-rim` calls `paintRim` only, never `schedule`.
- **Comparison:** `frontConic` is shared by the material rows, config A and autoBc, because they all spread the main spec. `#cmp-footnote` also shows for `frontConic`.
- **Disclaimer:** "Das Modell rechnet ohne Experten-Einstellung mit einer sphärischen Vorderfläche, nicht mit asphärischen Herstellerdesigns, …". All existing disclaimer substring tests pass.
- **Switch hint:** now names the asphärische Vorderfläche and the Randtiefe.

## Verification (real output, plan end, after the last commit)

`npm run lint && npm run test:coverage && npm run build && npm run test:e2e` exited 0:
- lint: clean
- test:coverage: 33 files and 1433/1433 tests passed. Coverage on all files is 98,37 % statements, 96,66 % branches, 100 % functions and 99,04 % lines. `evaluate.js` is at 98,18 / 97,93 / 100 / 97,64, with lines 189 and 237 uncovered: 189 is the guard's 10-pass failure, 237 the existing NON_FINITE_RESULT return. `rim.js` is at 100 %.
- build: `✓ built in 123ms`
- test:e2e: **282 passed (1.8m)**. This includes the 8 new expert cases on desktop and mobile.

The first plan-end run (before the e2e fixes below) had 6 failures, all in `rx.spec.js:105` and `frame.spec.js:184`. They are described under deviation 1.

**ENG-09 (4× proxy, case A), `npm run test:perf` three times:**

| Metric | 02-10 baseline | run 1 | run 2 | run 3 |
|---|---|---|---|---|
| input frame median (max) | 14,65–16,55 (20,5–21,9) ms | 15,5 (19,2) ms | 16,9 (32,8) ms | 15,15 (16,1) ms |
| result | 34,9–38,25 ms | 35,4 ms | 37,15 ms | 36,1 ms |
| compare paint | 6,9–7,85 ms | 7,45 ms | 8,95 ms | 7,5 ms |

- Runs 1 and 3 are inside the 02-10 band.
- Run 2 has one input max of 32,8 ms and a compare median of 8,95 ms. The other medians in that run are in band, and run 3 straight after it is back in band, so I read this as run-to-run noise.
- With the switch off, the input frame adds one radio lookup and nothing for the rim. The k = 0 spec is the same as before.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 1 - Bug] Two existing e2e tests counted every sign button or tip button on the page.**
   - `rx.spec.js:105` expected `button.sign` to have count 4 and got 5, because of the new k sign button.
   - `frame.spec.js:184` clicked every `#frame-section button.tip-btn`, including the hidden `tip-rim`, and timed out after 30 s.
   - Fix: scoped them to the lay elements, `.rx-table button.sign` and `button.tip-btn:visible`. The asserted counts (4 and 4) are unchanged. Commit 420bb94.
2. **[Rule 3 - Blocking] k messages need unit-less number formatting.** I added kind `'k'` (fmtConic) to `messageText` in `src/ui/rx-input.js`, which is not in `files_modified`. Commit 420bb94.

### Plan adjustments

- **e2e aspheric cases are in the Task 2 commit, not the Task 1 RED commit.** The UI they drive did not exist in Task 1, and Task 1's verify step does not run Playwright.
- **No `attachSignButtons` export.** `initRxInput` already wires every `button.sign[data-for]` in the document, so the k button works without a change to rx-input.js.
- **The fixed label 'allgemeines Modell, kein bestimmtes Herstellerdesign' lives in the always-visible 'asphärisch' radio label.** It is not repeated a second time inside `#expert-k-wrap`.
- **Rim depth fallback:** see decisions. An invalid value shows no line instead of silently using 3,0 mm.
- **RED gate:** the sag identity, k = −1 and traceBVP tests passed in RED. They check existing `sphereSag`/trace behaviour and guard against regressions. The new engine tests failed as required: frontConic CT and D1 values, the guard, INVALID_SPEC, rim and specFor.

## Known limitations

- **Front/back split of the rim excess:** the rim line gives the total front + back excess at etMax. The split needs a bevel model (phase 3, VIZ-03), as the plan states.
- **iPhone check still open:** the ± button on the iPhone decimal keypad was not checked on a real device. This is carried from RESEARCH and unchanged.

## Known Stubs

None.

## Threat Flags

None. The k field and the rim depth are the boundaries already listed in the plan's register:
- T-02-29: D1 chosen at k = 0, the property test, the labels, the disclaimer.
- T-02-30: the engine enforces finite and ≤ 0; the UI range is −5…−1.
- T-02-31: RIM_DEPTH_DEFAULT_MM is [ASSUMED] in code and 'angenommener Wert' in the UI.

## TDD Gate Compliance

Task 1: RED `4793b76` (test), then GREEN `ddb9f21` (feat). Task 2: one feat commit with its e2e cases.

## Self-Check: PASSED

- FOUND: src/engine/rim.js, src/engine/rim.test.js, .planning/phases/02-lay-first-german-input-results-comparison/02-11-SUMMARY.md
- FOUND: 4793b76, ddb9f21, 420bb94
