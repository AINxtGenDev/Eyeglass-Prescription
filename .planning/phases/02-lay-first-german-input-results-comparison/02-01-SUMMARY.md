---
phase: 02-lay-first-german-input-results-comparison
plan: 01
subsystem: engine-metrics, results-ui
tags: [tie-rule, result-cards, lr-callout, example, de-AT]
requires: []
provides:
  - "TIE_TOL_MM tolerant etMax/etMin location rule (values bitwise unchanged)"
  - "src/state/compare.js: thickest, roundMm, roundG, LR_DIFF_MM, LR_DIFF_G, LR_PD_CAUSE_MM, lrCause, lrDifference"
  - "src/ui/dom.js ($, setText no-op on unchanged, para, applyDictionary + data-i18n-aria-label)"
  - "src/ui/results.js (renderResult, renderEmpty, renderFailed, renderLrCallout, setStale, CELLS)"
  - "Per-eye result cards #result-{od,os}-card, #lr-callout, #example-banner / #example-clear"
  - "e2e helpers plain, guardPage, thickOf, sphOnly"
affects: [02-02 (moves .result-table rows behind Experten-Ansicht), every later UI plan (dom.js/results.js)]
tech-stack:
  added: []
  patterns: [display values computed from rounded numbers, sig-guarded live text, spec recorded at paint time]
key-files:
  created:
    - src/state/compare.js
    - src/state/compare.test.js
    - src/ui/dom.js
    - src/ui/results.js
    - e2e/results.spec.js
  modified:
    - src/engine/metrics.js
    - src/engine/metrics.test.js
    - src/engine/properties.test.js
    - src/i18n/format.js
    - src/i18n/format.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - src/ui/main.js
    - src/ui/style.css
    - index.html
    - e2e/helpers.js
    - e2e/smoke.spec.js
    - e2e/worker.spec.js
    - e2e/perf-throttled.spec.js
decisions:
  - "[02-01]: etMax/etMin location ties within TIE_TOL_MM = 1e-9 mm go to the larger y; reported values stay the exact running max/min (bitwise)"
  - "[02-01]: lrCause compares the axis only with cyl ≠ 0 and treats Achse 0 ≡ 180; a null vs numeric fitting height counts as a difference (≥ 2 mm for rx-pd)"
  - "[02-01]: the L/R callout uses the spec recorded with each painted result (renderResult(eye, res, spec) under isCurrent), not the spec of the newest input"
  - "[02-01]: RES-05 stays Pending: the example is done, but the Rx/frame presets and the confirm before overwriting come in a later plan. RES-01, RES-04 and UX-05 are marked complete"
  - "[02-01]: 'unter 1 g' has no e2e: the lightest lens inside the RX-04/FRAME-02 ranges weighs 1,35 g (rund 40×28, +0,25, 1,60); covered by the fmtGramWhole unit test"
metrics:
  duration: 25min
  completed: 2026-11-07
  tasks: 3
  files: 19
---

# Phase 2 Plan 01: Result cards, example and tie rule Summary

The engine now picks the etMax/etMin location with a 1e-9 mm tie tolerance, so Achse 0 and 180 and mirrored OD/OS prescriptions get the same lay label. On load the page shows a labelled example with one plain-German card per eye: thickest point = max(CT, edge), lay location words, whole grams. A cited L/R sentence appears only above 1,0 mm or 3 g on the displayed values.

## Formatting accident, fixed forward

I ran a bare `npx prettier --write` while writing the Task 1 and Task 2 tests. The repo has no Prettier config, so it re-quoted and re-wrapped whole files in commits `b72ed4a`, `e8fa78a` and `f340f38` (double quotes, 80 columns, including untouched phase-1 code in `metrics.js` and `properties.test.js`). No logic changed. Commit `0543c0d` restores those files to the pre-plan text plus only the 02-01 changes. The commits were not rewritten, because history rewriting is a destructive git operation. `format.test.js` was restored inside the Task 3 commit, since its named `fmtGramWhole` import needs `format.js`. Net diff `38dc549..HEAD` contains only intended changes.

## Task 1: tie rule (commits b72ed4a RED, e8fa78a GREEN)

- Measured mirror gap, OD −0,50 / −2,00 × 180, rechteckig 52×38/18, PD 32, CR-39: the superior corner is 4,44e-16 mm thinner than the inferior corner (2.8683195576338183 vs …187). At × 0 the gap is 0. The old exact rule therefore said 'temporal-inferior' at × 180 and 'temporal-superior' at × 0. Both now say 'temporal-superior'.
- Property runs: 'Achse 0 and 180 are the same lens' (300 runs, seed 21, ≥ 200 ok cases asserted) and 'mirrored Rx gives the same lay label' (300 runs, seed 22, ≥ 200 ok cases asserted). Both failed RED with the exact rule ('temporal-superior' vs 'temporal-inferior', 'inferior' vs 'superior') and pass GREEN.
- Changed existing assertions: **none**. `test/fixtures/` is untouched. The 144 bitwise pins, the evaluate.test.js mirror assertions and smoke/worker e2e (68 tests) passed without edits at e8fa78a.
- Coverage: All files 98,47 % stmts / 96,42 % branch; metrics.js 98,33 / 95,55.

## Task 2: re-verified pins (node, src/engine/evaluate.js after Task 1, CR-39, rechteckig 52×38/18)

| Case | CT | etMax (location) | etMin (location) | thickest(m) | weight |
|------|----|------------------|------------------|-------------|--------|
| Example OD −2,75/−0,50×180, PD 32 | 1,800 | 4,597 temporal-superior | 2,980 superior | 4,597 edge | 6,86 g |
| Example OS −2,50/−0,75×170, PD 31,5 | 1,800 | 4,597 temporal-superior | 2,969 superior | 4,597 edge | 6,75 g |
| R −4,00 PD 32 | 1,800 | 5,755 | 3,256 | 5,755 | 7,76 g |
| L −5,25 PD 31,5 | 1,800 | 7,223 | 3,721 | 7,223 | 8,87 g |
| L −4,50 PD 31,5 | 1,800 | 6,406 | 3,441 | 6,406 | 8,22 g |
| R −2,00 PD 32 | 1,800 | 3,748 | 2,524 | 3,748 | 6,10 g |
| L −1,00 PD 31,5 | 1,800 | 2,798 | 2,162 | 2,798 | 5,29 g |
| R −4,00 PD 29 / L −4,00 PD 34 | 1,800 | 6,494 / 5,310 | 3,256 / 3,256 | 6,494 / 5,310 | 8,04 / 7,68 g |
| R −10,00 PD 32 / L −10,00 PD 30,5 | 1,800 | 12,866 / 14,028 | 5,574 | 12,866 / 14,028 | 13,15 / 13,49 g |
| R +3,00 PD 32 | 3,902 | 2,824 superior | 1,000 temporal-superior | 3,902 centre | 7,23 g |
| L +2,75 PD 31,5 | 3,737 | 2,748 superior | 1,000 | 3,737 centre | 7,00 g |
| R +2,00/−3,00×90 PD 32 | 1,800 | 2,659 temporal | 1,079 superior | 2,659 edge | 4,45 g |
| rund 50/50/18, PD 34, −3,00 (both) | 1,800 | 3,692 | 3,692 | 3,692 (uniform) | 7,11 g |

All values match the planner's interfaces block. L/R cases on displayed values: 5,8 / 7,2 → fires; 5,8 / 6,4 → silent; 3,7 / 2,8 → silent; 6,5 / 5,3 → fires, cause pd; 12,9 / 14,0 → fires, cause pd.

## Task 3: re-derived e2e pins (commit 0fc4eca)

- smoke 'both eyes show…': card ids `-ct`, `-thick`; weight `/^\d+\sg$/` (whole grams). The base-curve assertion is unchanged.
- smoke 'frame shape and PD change the edge': −6,00 with the example cylinder −0,50 × 180 kept (thickest 7,991 → 9,583 mm at PD 28), location on `#result-od-thick-loc` 'außen'. `#result-od-dec` 3,0 / 7,0 mm is unchanged.
- smoke PLUS_CYL_VALUES (+3,00 −2,00 × 180, PD 32): CT 3,589, etMax 3,234, etMin 1,000, 7,01 g → `-ct` 3,6, `-thick` 3,6 'in der Mitte', `-etmin` 1,0, `-weight` 7 g. The test starts from `sphOnly` (−2,00 start values 1,8 / 3,7 / 2,5 mm, 6 g). Otherwise the example's 7 g would equal the pinned 7 g and the "default must not match" check would fail.
- smoke 'oversized lens warns': weight regex changed to whole grams; CT 38,3 mm is unchanged.
- smoke 'bench re-entry' and worker 'falls back…': start with `sphOnly`, so −3 gives the pinned 4,7 mm (engine 4,741).
- worker 'rechnet … nothing moves': starts with `sphOnly`, which removes the banner before the baseline boxes. It now types −2,5 instead of −3. Against L −2,00, −3 (4,7 vs 3,7 mm) would correctly bring up the L/R sentence and move `.result-table` by 96 px. −2,5 (4,242 mm, 6,51 g) stays below both thresholds.
- worker.spec: every `#result-*-etmax` now reads `#result-*-thick` and `etmaxOf` is now `thickOf`. All cases there are minus lenses, so the values are identical.
- perf-throttled: `OD_CELLS` = ct, thick, etmin, weight, dec, etmax, basecurve, status. `discriminator()` stays on `etmaxOf` (the edge row) on purpose; a comment in helpers.js says so. `PERF=1 npx playwright test --project=perf --list` lists 1 test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Undid the default-prettier reformatting.** See the section above. Commit `0543c0d`.

**2. [Rule 1 - Bug] The card status line reserves one line.** At first the status `<p>` was empty, so "rechnet …" grew the card and moved `.result-table`, which the worker layout test checks. `.result-status` now has `min-height: 1.5em`.

**3. [Rule 1 - Bug] Valid definition-list markup.** The plan put the `-loc` span next to the `<dd>` inside the `<div>`, which is invalid `<dl>` content. Value and location are now `<span>`s inside one `<dd>`. That keeps exactly four `dd`, and the value ids hold only the number.

**4. [Rule 2 - Correctness] The spec is recorded at paint time.** `renderLrCallout()` takes no arguments. It reads the rounded values and the spec stored by `renderResult(eye, res, spec)`, which main.js calls only under `client.isCurrent` (T-02-02). The sentence therefore always describes the numbers that are actually shown. The plan's `renderLrCallout(displayed, specs)` signature changed accordingly.

**5. [Rule 2] Added the side-word keys `result.side.od` 'rechte' and `.os` 'linke'.** The copy "Noch kein Ergebnis für das {rechte/linke} Glas" and "Das {linke} Glas … als das {rechte}" needs adjectives, not 'Rechtes Glas'. The empty body lives in its own `#result-{eye}-empty` paragraph (`data-i18n="result.empty.body"`).

**6. Worker failure moved too.** `renderFailed(eye)` moved into results.js (same text and sig rule as phase-1 `onFailed`), so a failed eye also clears its L/R values.

**7. 'unter 1 g' e2e replaced by the unit test**, as the plan allowed. A node search over all shapes, A 40–42, B 28–30, DBL 14, sph −1…+0,5 and all six materials found a minimum of 1,35 g.

## Known Stubs

None. The empty-state body and the blocked-eye jump button ("Zum markierten Feld") are not in this plan. Blocked eyes show the phase-1 status text ('Bitte zuerst die markierten Felder korrigieren.') with the grid hidden. Field validation UX comes in later phase-2 plans.

## Threat Flags

None. No new network, storage or auth surface. All new text goes through `textContent`; there are no style attributes, and the CSP is unchanged.

## Verification (plan end, real output)

- `npm run lint`: clean.
- `npm run test:coverage`: 27 files, 1116 tests passed; All files 98,47 % statements, 96,42 % branches, 100 % functions, 99,18 % lines.
- `npm run build`: built in 97 ms.
- `npm run test:e2e`: 90 passed (47,0 s), desktop and mobile.

## Self-Check: PASSED
