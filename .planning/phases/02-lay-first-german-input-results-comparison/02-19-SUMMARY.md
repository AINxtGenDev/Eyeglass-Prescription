---
phase: 02-lay-first-german-input-results-comparison
plan: 19
subsystem: engine property tests, material comparison intro, requirement traceability
tags: [RES-02, RES-03, UX-02, UX-03, lens-critic-m1, lens-critic-m2, lens-critic-m3, lens-critic-m4, lens-critic-m8, gap-closure]
requires: [02-18]
provides:
  - "evaluate.test optimality split into 7 tests (one per sph) and solve.test affected-region property split into 10 chunks of 20 fc.sample inputs, each with its own 60 s timeout"
  - "shownEye(selected) → { eye, tie } | null in src/state/compare.js, used by materialRows and the material intro"
  - "Material intro names each material's own minimum thickness and says 'beide Gläser gleich dick – gezeigt: …' on a displayed tie"
  - "e2e 'UX-02 Simple view hides every Expert-only element (m8)' with 13 explicit locators"
  - "RES-03, UX-02, UX-03 traceability 'Phase 2 + 3', Pending; ROADMAP phase 3 completes them"
affects: [src/engine/evaluate.test.js, src/engine/solve.test.js, src/state/compare.js, src/ui/compare-view.js, src/i18n/de-AT.js, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, deferred-items.md]
tech-stack:
  added: []
  patterns:
    - "Long property tests: deterministic fc.sample(arb, { numRuns, seed }) split into chunks with per-chunk ok floors; the failing spec goes into the assertion message because fc.sample does not shrink"
key-files:
  created: []
  modified:
    - src/engine/evaluate.test.js
    - src/engine/solve.test.js
    - src/state/compare.js
    - src/state/compare.test.js
    - src/ui/compare-view.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/compare.spec.js
    - e2e/expert.spec.js
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "m2: split per case (02-09 MAT-02 pattern), not larger timeouts; fc.sample reproduces the 200 fc.assert inputs position for position, so the sample set is unchanged"
  - "m3: a tie is detected on the displayed (roundMm) thickest values of the selected material, both eyes computed; the shown eye stays OD on a tie"
  - "m1: RES-03 is not re-worded or split; it, UX-02 and UX-03 stay Pending as 'Phase 2 + 3' (user decision 2026-11-07)"
metrics:
  duration: "~70 min"
  completed: 2026-11-07
  tasks: 3
---

# Phase 02 Plan 19: Cheap lens-critic minors (m1, m2, m3, m4, m8) Summary

Closes the cheap minors from the 02-15 result review. The two engine tests that came closest to their timeouts now run as smaller tests, each with its own timeout. They use the same inputs and assertions as before. Under 4 CPU burners the slowest piece uses 46,7 % of its timeout; before the split, the affected-region test used 87 %. The material intro is now correct for the example page, where both glasses are 4,6 mm thick, and it always names each material's own minimum thickness. The Simple view is proven to hide every Expert-only element. Requirement status no longer claims more than phase 2 delivered.

## Tasks

| Task | Commit | What |
|------|--------|------|
| 3 (docs, committed first, no CPU) | aaeac57 | REQUIREMENTS RES-03 unchecked + dated notes on RES-03/UX-02/UX-03, traceability "Phase 2 + 3"/Pending; ROADMAP phase 3 "completes RES-03 …"; deferred-items m5–m7 |
| 1 | d19accc | optimality → 7 tests; affected region → 10 × 20 fc.sample chunks |
| 2 RED | ab7a5f0 | shownEye unit cases, dictionary placeholders, intro e2e (tie + Stark kurzsichtig), m8 e2e |
| 2 GREEN | 26f4b36 | shownEye, new intro wording, cmp.eye.thicker / cmp.eye.tie |

Task 3 was committed before Task 1 because it is doc-only and could be done while the CPU-sensitive baseline measurement was running. No commit depends on another.

## m2 measurements (vitest JSON reporter, `--coverage.enabled`, both files alone)

The method is the same as in 02-09: 4 × `node -e "for(;;){}"` in the background, killed afterwards. Script: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/measure.sh`.

| Run | Optimality | Affected region |
|-----|------------|-----------------|
| Before, unloaded | 24 743 ms of 60 000 (41 %) | 208 624 ms of 300 000 (70 %) |
| Before, 4 burners | 37 163 ms of 60 000 (62 %) | 262 126 ms of 300 000 (87 %) |
| After, unloaded | 7 tests, total 24 178 ms, slowest 5 231 ms of 60 000 (8,7 %) | 10 tests, total 185 294 ms, slowest 19 187 ms of 60 000 (32,0 %) |
| After, 4 burners | total 36 454 ms, slowest 7 804 ms of 60 000 (**13,0 %**) | total 236 300 ms, slowest 28 017 ms of 60 000 (**46,7 %**) |
| After, final full `vitest run --coverage` (unloaded) | slowest 7 274 ms (12,1 %) | slowest 25 798 ms (43,0 %) |

The target was a slowest piece at or below 50 % under 4 burners. It is met, but the affected-region chunk is at 46,7 %, so the margin is small. If CI still flakes, the next step is to use 20 chunks of 10 samples.

Counts: optimality before was 40 ok specs; after, the per-sph floors are 4 (sph −12) + 6 × 6 = 40, the observed counts. Affected region before was ok 200 of 200; after, the floors are 20 in each of the 10 chunks, 200 in total. A scratch run (`m2-counts.mjs`) checked that `fc.sample(arb, { numRuns: 200, seed: 12 })` returns the same 200 inputs, in the same order, that `fc.assert` visits with the same seed. All 200 positions were equal, so the sample set is unchanged, not just of the same size. fc.sample does not shrink, so every assertion message now prints the spec under test (`JSON.stringify(s)`).

## Task 2 notes

- **Tie (m3):** the example page is R 4,6 / L 4,6 mm. Its intro now reads "… Dickste Stelle (Mitte oder Rand): beide Gläser gleich dick – gezeigt: das rechte Glas. …". With "Stark kurzsichtig" (8,7 / 8,3 mm) it reads "das rechte Glas (das dickere Glas)". `materialRows` gets its eye from `shownEye`, and its output is unchanged: all existing materialRows tests pass unmodified.
- **Own minimum (m4) against `cmp.footnote`:** they do not contradict each other. The compared rows always use their material's sourced minCT/minET; with Expert overrides they keep the manual base curve (pipeline.js 02-10). The footnote says the same and adds that the base curve and front surface apply to all. One nuance: with an Expert minimum override, the selected row ("Ihre Auswahl") uses the user's minimum, which is that material's minimum as the user set it.
- **m8:** no Expert-only element was visible in the Simple view, so no markup change was needed. The test checks 13 explicit locators. Each must exist exactly once and be hidden at load and again after the switch goes on and off: `#frame-rim-wrap`, `#material-custom-card`, `#custom-material`, `#custom-ne`, `#glass-settings`, `#expert-basecurve`, `#expert-min-ct`, `#expert-min-et`, `#expert-analysis`, `#result-od-dec`, `#result-os-basecurve`, `#xsec`, `#cmp-footnote`. It also checks that the technical location suffix "(temporal-superior)" is gone. To make the test meaningful, Expert mode first shows the footnote (base curve 4) and the custom fields ('Eigenes Material'). Switching off hides both, and the custom radio is no longer checked.
- RED was proven: 8 unit tests failed (shownEye not exported, dictionary placeholders) and the 2 intro e2e tests failed on both projects. As expected, the m8 test passed on the current build.

## Deviations from Plan

1. **[Orchestrator instruction] Status wording for m5–m7.** The plan asked for "Status: accepted for later, needs user confirmation at the 02-15 checkpoint". The user already gave that confirmation on 2026-11-07 ("i approve"; recorded in deferred-items.md). The entries therefore say "accepted for later (user confirmed 2026-11-07)", and the section header explains this. As a result, the plan's literal grep for "needs user confirmation" now matches only that explanation text.
2. **[Rule 2] dictionary.test.js** got placeholder checks for the two new keys. This file was not in the plan's files list.
3. **Task order:** Task 3 was committed first (see above).
4. The final coverage run used `npx vitest run --coverage --reporter=default --reporter=json`, which is what `npm run test:coverage` runs plus a JSON reporter, so the timings could be recorded.

## Verification (real output, 2026-11-07)

`npm run lint && vitest run --coverage && npm run build && npm run test:e2e` → exit 0:
- lint: clean
- unit + coverage: Test Files 34 passed (34), Tests 1595 passed (1595); Statements 98,34 %, Branches 96,52 %, Functions 100 %, Lines 99,15 %
- build: built in 146 ms
- e2e: 383 passed, 1 skipped (2.3m)

Plan acceptance greps: `numRuns: 200, seed: 12` 2, `fc.sample(` 1, `export function shownEye` 1, `shownEye(` in compare-view 1, "das dickere Glas" in de-AT 1, "gleich dick – gezeigt" 1, "eigenen Mindestdicke" 2 (intro + footnote's "Mindestdicken"), `| RES-03 | Phase 2 + 3 | Pending |` 1, likewise UX-02 and UX-03, "completes RES-03" in ROADMAP 1, `- [ ] **RES-03**` 1. `git diff` of RES-03 shows only the checkbox and the appended note.

## For 02-15

RES-03, UX-02 and UX-03 stay Pending (their phase-3 parts). 02-15 Task 3 must not set them Complete. Nothing was pushed.

## Known Stubs

None.

## Self-Check: PASSED

All files and commits listed above were checked to exist: aaeac57, d19accc, ab7a5f0 and 26f4b36.
