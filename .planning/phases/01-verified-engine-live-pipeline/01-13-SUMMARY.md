---
phase: 01-verified-engine-live-pipeline
plan: 13
subsystem: engine-intermediates, page-text, requirement-docs
tags: [gap-closure, gap-3, eng-06, mat-01, mat-02, minor-1, minor-3, minor-5]
requires:
  - 01-12 (D-A +14 ceiling, non-convex back, D-C tie-break, E2E reference cases)
provides:
  - "intermediates.sags: { x, y, front, back } at nasal, temporal, superior, inferior, etMax, etMin, rhoMax"
  - "intermediates.abbe = MATERIALS[id].ve"
  - "metrics.js exports extremeIndices(outline, eye) and farthestIndexFromOC(outline, oc)"
  - "PARSE_AXIS_INVALID + German message"
  - "Material line shows 'Abbe-Zahl {abbe} (je höher, desto weniger Farbsäume)'"
  - "Base-curve cell shows the raw Vogel value plus ', begrenzt auf {clamped}' when clamped"
  - "REQUIREMENTS MAT-01/MAT-02/UX-02 amended; ENG-06, MAT-01, MAT-02 complete"
affects: [01-11 (lens-critic result review, requirement-text manifest), phase 2 UX-02 / MAT-03]
tech-stack:
  added: []
  patterns:
    - "One index definition for the named outline points, shared by metrics and sags"
    - "Display constants read from the catalogue, not the result, so they render on failed lenses"
key-files:
  created:
    - .planning/phases/01-verified-engine-live-pipeline/01-13-SUMMARY.md
  modified:
    - src/engine/metrics.js
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/engine/materials.test.js
    - src/engine/diagnostics.test.js
    - src/state/parse.js
    - src/state/parse.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - src/ui/main.js
    - e2e/smoke.spec.js
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/research/PITFALLS.md
    - .planning/phases/01-verified-engine-live-pipeline/01-VALIDATION.md
decisions:
  - "[01-13]: MAT-01 reworded to 'uses ne and density, exposes νe'; νe is carried (intermediates.abbe) and shown, never used in a computation; chromatic effects stay out of v1"
  - "[01-13]: MAT-02 text = automatic +0,50…+14,00 (D-A, US4185897) capped per lens by FRONT_RADIUS_MARGIN_MM, flattest within τ = 0,10 mm of the thinnest (D-C, unsourced cosmetic choice, τ anchored to the Zeiss ±0,30 mm CT tolerance), every back principal power ≤ 0, Vogel only as a reference; manual 0…+10 stays MAT-03; Expert-view clause moved to UX-02"
  - "[01-13]: The base-curve cell shows the raw Vogel value and names the clamp; any thickness in the sentence refers to the clamped lens"
  - "[01-13]: Axis input that is not whole unsigned degrees gets PARSE_AXIS_INVALID; PARSE_NOT_A_NUMBER stays for diopter and mm fields"
metrics:
  duration: 10min
  completed: 2026-11-06
  tasks: 3
  files: 15
---

# Phase 1 Plan 13: ENG-06 sags, MAT-01 Abbe number, MAT-02 wording Summary

Every LensResult now carries front and back surface sags at seven named outline points, plus the sourced νe of its material. The page shows the Abbe number, the raw Vogel value with a clamp note, and a specific German axis message. MAT-01, MAT-02 and UX-02 now describe what 01-12 and 01-13 actually ship. ENG-06, MAT-01 and MAT-02 are complete.

## Engine (Task 1)

- `metrics.js`:
  - `extremeIndices(outline, eye)` uses exactly the strict comparisons computeMetrics used inline. computeMetrics now calls it, so metrics and sags share one definition.
  - `farthestIndexFromOC(outline, oc)` returns the index with the largest |p − oc|, first index on ties.
- `evaluate.js`: `intermediates.sags` and `intermediates.abbe = m.ve` are properties of the intermediates literal. They are built before the `allFinite` check, so NON_FINITE_RESULT covers them (lens-critic MINOR-4). The typedef documents both fields.
- `diagnostics.test.js` checkRule walks `intermediates.sags` and `intermediates.abbe`, so the extremes grid (2304 specs) and the fuzz (2000 eyes) now prove that every ok result has finite sags.
- No metric value changed. The full `npx vitest run src/engine` stayed green (309/309), including the 01-12 pins.

Example `intermediates.sags`, −2,00 OD rund 50×50/18, PD 32, CR-39 (OC x = +2), in mm:

| point | x | y | front | back |
|---|---|---|---|---|
| nasal / etMin | 25 | 0 | 0,264535 | 1,327062 |
| temporal / etMax / rhoMax | −25 | 0 | 0,364566 | 1,831102 |
| superior | −6e-13 | 25 | 0,314549 | 1,578922 |
| inferior | −6e-13 | −25 | 0,314549 | 1,578922 |

The nasal front and back match R − √(R² − 23²) (computed in the cancellation-free form) within 1e-9 mm.

### RED evidence (commit 5311eac, engine at 94d8955)

- `TypeError: Cannot read properties of undefined (reading 'nasal')` (closed form, consistency, symmetry; 'rhoMax' for the distance test)
- `AssertionError: expected undefined to be 56 // Object.is equality` (and 45, 29, 40, 32 for the other materials)
- diagnostics.test.js: `AssertionError: metrics field intermediates.sags is undefined` (4 failed / 16 passed)
- The materials.test.js νe plausibility test passed at RED. It is a range check on existing catalogue data, and the plan defines it as plausibility only.

GREEN: `-t 'ENG-06 intermediates sags'` JSON numPassedTests 20, numFailedTests 0.

## Page (Task 2)

RED (commit 5d9f5cb): the parse tests gave `"45,5" -> undefined` for all 5 new cases, because the code did not exist yet. E2E:
- the axis error text was "Das ist keine gültige Zahl. …" and did not contain 'ganze';
- the material line was "R – rechtes Auge: Kunststoff CR-39 (1,50), Dichte 1,32 g/cm³" and did not contain 'Abbe-Zahl 56';
- the base-curve cell said "… nach Vogel +14,00 dpt; …" and did not contain '+18,00'.

GREEN page text, read with Playwright from `vite preview` on the oversized E2E reference case of 01-12-SUMMARY: +12 CR-39, rechteckig 62×55/24, PD 25, vogelD1 18, vogelClampedD1 14.

- `#result-od-basecurve`: "+9,19 dpt – so gewählt, dass das Glas nahezu so dünn wie möglich wird (höchstens 0,1 mm mehr als das dünnste), mit der flachsten Vorderfläche unter diesen (zum Vergleich: übliche Faustregel nach Vogel +18,00 dpt, begrenzt auf +14,00 dpt; damit ließe sich das Glas in diesem Modell nicht berechnen)"
- `#result-od-material`: "R – rechtes Auge: Kunststoff CR-39 (1,50), Dichte 1,32 g/cm³, Abbe-Zahl 56 (je höher, desto weniger Farbsäume)"
- `#rx-od-axis-err` for '90,5': "Die Achse ist eine ganze Gradzahl ohne Vorzeichen und ohne Komma, von 0° bis 180°, z. B. 90."

All three new e2e tests pass on desktop and mobile (6/6). Acceptance greps:
- PARSE_AXIS_INVALID in parse.js: 2
- 'parse.PARSE_AXIS_INVALID' in de-AT.js: 1
- vogelClampedD1 in main.js: 2
- fmtDiopter(im.vogelD1) in main.js: 1
- innerHTML in src/ui: 0

## Requirement-text diff (Task 3)

- **MAT-01**:
  - before: "the engine uses the sourced true refractive index (ne), density and Abbe number for each"
  - after: "the engine uses the sourced true refractive index (ne) and density and exposes the sourced Abbe number (νe) for each", with the note "(wording 2026-11-06, gap plan 01-13: chromatic effects are not modelled in v1)".
- **MAT-02**:
  - "+0,50…+10,00 dpt that makes the lens thinnest (smallest maximum thickness)" became "+0,50…+14,00 dpt (automatic range; per lens also limited so the front radius exceeds the outline by 2 mm, … FRONT_RADIUS_MARGIN_MM) as the flattest value whose maximum thickness is within 0,10 mm of the thinnest possible lens (the thinnest within 0,10 mm, flattest front among those)".
  - The back rule now reads "never produces a flat/concave front or a convex back surface (every back principal power ≤ 0, plano allowed), and an error appears only if no value in that range gives a computable lens with such a back".
  - The clause "the auto value and the rule used are shown in Expert view" was removed. "The sourced Vogel rule is shown as a reference value" stays.
  - Three dated notes were added:
    - D-A: US4185897; the +10 came from idea.md:48; manual 0…+10 stays MAT-03.
    - D-C: τ = 0,10 mm, one third of the Zeiss ±0,30 mm CT tolerance; choosing the flattest front is an unsourced cosmetic choice.
    - The Expert-view clause moved to UX-02 ('Gap plan, then push'), and 01-12 added the back rule.
- **UX-02**: appended "The Expert-view base curve includes the automatic value and the rule used (moved from MAT-02 on 2026-11-06)."
- **ROADMAP**: Phase 1 SC-4 now reads "+0,50…+14,00 dpt". Phase 2 SC-4 now reads "manual base curve (and the automatic base curve with its rule, moved from MAT-02)".
  - The SC-4 demo is unchanged and still holds: diagnostics.test.js 'SC-4 / ENG-07 demo' (BACK_SAG_UNDEFINED, cross, searched) and e2e 'SC-4 impossible lens is explained' (computes with 1,74) both pass.
- **Completion**: ENG-06, MAT-01 and MAT-02 are [x] and Complete. ENG-09, DEPL-01 and DEPL-02 stay Pending.
- **PITFALLS Pitfall 5**: one annotation line was added below the table (barrel − meridional; tyre ≤ 0.086 mm; tyre vs barrel 0.464 mm). The git diff shows added lines only.

## Trace check (01-VALIDATION.md map, `--reporter=json`)

| Row | Command | numPassedTests | numFailedTests |
|---|---|---|---|
| ENG-06 | `npx vitest run src/engine -t 'ENG-06'` | 28 | 0 |
| ENG-07 | `npx vitest run src/engine/diagnostics.test.js` | 20 | 0 |
| ENG-08 | `npx vitest run test/fixtures/zeiss.test.js` | 570 | 0 |
| MAT-01 | `npx vitest run src/engine -t 'MAT-01'` | 30 | 0 |
| MAT-02 | `npx vitest run src/engine test/fixtures -t 'MAT-02\|tier 2 \(d\)'` | 186 | 0 |

The MAT-02 command gained `test/fixtures` and the `tier 2 (d)` filter, so it runs the Zeiss tier 2 (d) guard it now names.

## Deviations from Plan

**1. [Rule 3 - Blocking] dictionary.test.js placeholder allow-list extended with `clamped`.**
- Found during: Task 2 GREEN.
- Issue: the test 'every {param} in basecurve.* is vogel or thickness' rejected the plan-specified key `basecurve.vogelClamped` with `{clamped}`.
- Fix: the allow-list is now vogel, thickness, clamped, with a comment that main.js baseCurveText passes it. The test was renamed to match.
- File: src/i18n/dictionary.test.js. Commit 7f1aff9.

**2. MAT-02 map command widened.** The plan asked for "Zeiss tier 2 (d)" in the MAT-02 behaviour. The old command `src/engine -t 'MAT-02'` does not run test/fixtures, so the command now includes it, to keep to the honesty rule.

**3. Clamp case.** As the plan expected, 01-12 records vogelD1 18 ≠ vogelClampedD1 14 for the oversized case, so no substitute case was needed.

### CLAUDE.md adjustments
None. The engine stays free of DOM and Three.js (grep count 0), and all new text is in de-AT.js.

## Known Stubs
None.

## Threat Flags
None. T-01-32 is mitigated by the closed-form and consistency tests. T-01-33 is mitigated: the text gives only the definitional meaning of the Abbe number, and no chromatic value is computed. T-01-34 is mitigated: only textContent is used, and the innerHTML count is 0.

## Open questions (for lens-critic and the user)

- The MAT-01 and MAT-02 wording changes are requirement-text changes. They belong in the 01-11 Task 2 manifest for the user to see.
- The Abbe meaning "je höher, desto weniger Farbsäume" is textbook knowledge (νe = (ne − 1)/(nF′ − nC′)), not a fetched source. The νe values themselves are the cited Zeiss rows.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 5311eac | test(01-13): failing tests for ENG-06 sags and MAT-01 Abbe |
| 1 GREEN | a1aa301 | feat(01-13): ENG-06 surface sags and MAT-01 Abbe number in the engine result |
| 2 RED | 5d9f5cb | test(01-13): failing tests for axis message, Abbe line and raw Vogel value |
| 2 GREEN | 7f1aff9 | feat(01-13): Abbe number on the page, raw Vogel value with clamp note, specific axis message |
| 3 | fe11383 | docs(01-13): MAT-02 non-convex back and Expert clause to UX-02; ENG-06/MAT-01/MAT-02 complete; PITFALLS note |

## Verification

- `npm run lint`: exit 0.
- `npm run test:coverage`: exit 0, 1010/1010 passed (973 after 01-12, plus 37 new). Engine coverage: 98,45 % statements, 96,38 % branches, 99,17 % lines; metrics.js 100 % lines, evaluate.js 98,61 % lines.
- `npm run build`: exit 0.
- `npm run test:e2e`: 36/36 passed (desktop + mobile, the 30 from 01-12 plus 3 new × 2), against the existing `vite preview` on port 4173 after a rebuild.
- `grep -rlE "document\.|window\.|from 'three" src/engine --include=*.js | grep -v test | wc -l` → 0.

## Self-Check: PASSED

All five commits (5311eac, a1aa301, 5d9f5cb, 7f1aff9, fe11383) and this SUMMARY were verified present.
