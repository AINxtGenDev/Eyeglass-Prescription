---
phase: 01-verified-engine-live-pipeline
plan: 10
subsystem: engine-diagnostics-l10n
tags: [eng-07, eng-08, l10n, diagnostics, d-01, fuzz, properties]
requires:
  - 01-02 optimiseBaseCurve (D-01 always-thinnest search), DIAGNOSTICS catalogue
  - 01-07 frame outlines, bitwise OD/OS mirror
  - 01-08 toric back surface
  - 01-09 Zyl/Achse input
provides:
  - "evaluateLens raises OC_OUTSIDE_OUTLINE {x, y} and BLANK_EXCEEDS_STOCK {mbsMm, stockMm} as warnings (numbers stay)"
  - "diag.<CODE>.title|explain|suggest for every DIAGNOSTICS code; basecurve.vogelRefThicker / vogelRefImpossible"
  - "#diag-od / #diag-os (role=status) with German title, explanation, suggestion; status cell text label"
  - "src/engine/properties.test.js: ENG-08 tier 4"
affects: [01-11 lens-critic review, phase-2 Expert view (info texts CT_SET_BY_*), ENG-09 Grenzfall bench]
tech-stack:
  added: []
  patterns:
    - "UI maps codes to t('diag.' + code + '.title|explain|suggest'); mm params via fmtMm, built with createElement + textContent"
    - "Dictionary test proves code ↔ key completeness both ways and checks each {param} against the documented data fields"
key-files:
  created:
    - src/engine/properties.test.js
  modified:
    - src/engine/evaluate.js
    - src/engine/diagnostics.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - index.html
    - src/ui/main.js
    - src/ui/style.css
    - e2e/smoke.spec.js
    - test/bench/recompute.test.js
decisions:
  - "[01-10]: Status cell label: 'Nicht herstellbar' only for FRONT/BACK_SAG_UNDEFINED, 'Nicht berechenbar' for internal-limit errors, 'Hinweis' for warnings; info diagnostics are not shown in phase 1"
  - "[01-10]: Grenzfall = fuzz argmax by pair CT iterations: +0,50 −0,50 × 81, 1.60, panto 58×54/15, PD 26, FH 0 (283 iterations). Desktop wall time is not the maximum (the +7,50 −5,75 × 148 candidate is slightly slower); ENG-09 phone check should time both"
  - "[01-10]: ENG-07, ENG-08 and L10N-01 marked complete; MAT-02 (Expert view) and ENG-06 (sags in intermediates) stay pending"
metrics:
  duration: 14min
  completed: 2026-11-06
  tasks: 3
  files: 10
---

# Phase 01 Plan 10: Diagnostics in Plain German, D-01 Pins, Fuzz and Tier-4 Properties Summary

A lens that cannot be made now shows a German title, an explanation and a tested suggestion in place of numbers. Oversized lenses that can be computed keep their numbers and show a warning. A 1000-run fuzz plus a 2,304-spec grid show that no NaN or Infinity escapes and that no failing lens is rescuable by any manual front curve (rescue count 0). The ENG-08 tier-4 property suite is complete.

**Both open items are closed:**
- **Warnings raised and tested.** `BLANK_EXCEEDS_STOCK` and `OC_OUTSIDE_OUTLINE` are emitted by `evaluateLens` and covered by tests in `diagnostics.test.js`.
- **No raw codes on the page.** `result.notComputable` ("Code …") is gone, and every code is rendered through `diag.*` texts. The e2e test asserts that the SC-4 page does not contain "BACK_SAG" or "Code ".

## Pinned cases (engine, 720-point outline)

| Case | Result |
|---|---|
| SC-4 demo −12 −6 × 10, rechteckig 62×55/18, PD 32, CR-39 | ok:false, the only diagnostic is `BACK_SAG_UNDEFINED`, meridian **cross**, axis 10, searched. No D1 out of 191 manual values (0,50…10,00) computes |
| Suggestions for SC-4 | 1,74 → ok (CT 1,1, J 25,14 mm). rechteckig 50×40 → ok (J 19,84). rund 48×44/20 → ok (J 13,80). **rund 62×55/18 → still BACK_SAG_UNDEFINED** (negative control, so the text never says "runder") |
| Pin (a) +12, rechteckig 62×55/24, PD 25, CR-39 | ok, D1 6,6869, CT 33,341 mm, MBS 105,3 mm, ρmax 51,66, 30 evaluations. `BLANK_EXCEEDS_STOCK` {mbsMm 105,3, stockMm 75}. vogelMaxThickness null |
| +12, 62×55/18, PD 32 | D1 7,0147, J 23,042 mm. Vogel (clamped 10) J 25,038 mm, shown only as reference |
| Rescue case 0 −6 × 90, 62×55/24/25 | ok, D1 0,50, CT 1,80, etMax 18,23 mm. vogelClampedD1 4,5 with vogelMaxThickness null |
| Manual D1 10, +4, 62×55/24/25 | `FRONT_SAG_UNDEFINED` with R1 50 and ρmax > 50. 1,74 (R1 73,8), A 50 / B 40, and D1 6 each compute |
| OC_OUTSIDE_OUTLINE | −2 in rechteckig 52×30/18, PD 32, FH 40 → warn {x 3, y 25}, still ok. FH 20 → no warning |

**Optimality against the 191-value brute force** (gap = J_auto − brute minimum; a negative gap means the refinement beats the 0,05 dpt grid):

| Lens | D1 | CT | J | gap |
|---|---|---|---|---|
| +12 62×55/24/25 | 6,6869 | 33,341 | 33,3408 | −1,25e-4 |
| +4 62×55/24/25 | 2,5967 | 11,680 | 11,6796 | −3,3e-6 |
| +6 62×55/24/25 | 3,7705 | 17,041 | 17,0405 | −3,3e-5 |
| +6 −2 × 30 62×55/24/25 | 3,7574 | 16,977 | 16,9765 | −8,0e-6 |
| +12 rund 50×50/18/10 | 6,7837 | 30,058 | 30,0579 | −1,07e-4 (Vogel J 37,76) |
| +12 62×55/18/32 | 7,0147 | 23,042 | 23,0415 | −2,6e-5 (Vogel J 25,04) |
| Rescue 0 −6 × 90 | 0,5000 | 1,800 | 18,2257 | 0 |

- **Fast-check sample** (numRuns 60, seed 19): 60 of 60 ok, worst gap 1,2e-6 mm. J ≤ vogelMaxThickness held everywhere.
- **Refinement vs coarse grid:** for +12 rund 50×50/18/10, refinement beats the coarse grid (J_auto < coarseMaxThickness).

## Rescue count and fuzz

- **Extremes grid** (2,304 specs): 207 failing, all `BACK_SAG_UNDEFINED`. **Rescuable 0.**
- **Fuzz** (fast-check numRuns 1000, seed 7, both eyes = 2,000 lenses): 79 failing eyes. **Rescuable 0.** Every result passed the rule:
  - an ok result has finite metrics with no null field;
  - an error has exactly one error diagnostic, never `FRONT_SAG_UNDEFINED`;
  - `JSON.stringify` never contains NaN or Infinity.
- **Fuzz domain:** quarter steps for Sph [−12, 12] and Zyl [−6, 0]; axis 0–179; all 6 materials and all 4 shapes; A 40–62, B 28–55, DBL 14–24, PD 25–40; fitting height null or 0…B.
- **Runtime:** `diagnostics.test.js` takes about 21 s.

## Grenzfall (ENG-09 worst case)

Top 5 by CT iterations (OD + OS), over the 1000 fuzz specs plus the candidate:

| Pair iterations | Evaluations | Spec |
|---|---|---|
| **283** | 58 | **+0,50 −0,50 × 81, idx160, panto 58×54/15, PD 26, FH 0** |
| 226 | 62 | +12 / 0 × 88, idx167, rechteckig 40×55/23, PD 28, FH 0 |
| 205 | 62 | +7,50 −3,25 × 177, idx160, rechteckig 58×49/24, PD 26, FH 4 |
| 202 | 54 | +0,50 −0,25 × 174, cr39, pilot 60×51/17, PD 34, FH 51 |
| 196 | 62 | +9,75 −0,50 × 179, idx174, rechteckig 61×51/22, PD 27, FH 51 |

- **The candidate** (+7,50 −5,75 × 148, Trivex, 62×55/23/31) needs 168 iterations and 62 evaluations.
- **Argmax per eye:** OD 136 iterations / 29 evaluations, OS 147 / 29. The argmax also raises `OC_OUTSIDE_OUTLINE` (FH 0 puts the OC on the bottom edge) and `BLANK_EXCEEDS_STOCK`.
- **Desktop pair medians:**

  | Spec | Scratch node script | Vitest bench |
  |---|---|---|
  | Argmax | 7,4 ms (p95 8,1) | 10,9 ms (p95 11,4) |
  | Candidate | 8,0 ms (p95 9,2) | — |
  | Old +12 PD 10 | 5,1 ms | — |

- **Wall time:** the iteration argmax is not the slowest case on desktop. The ENG-09 phone check should time the candidate as well.
- **Where it is swapped:** `WORST_CASE_BENCH_SPECS` (main.js), the bench copy, and `tech.timingWorst` now name the argmax.

## Thinnest vs Vogel (CR-39, cyl 0; J and Vogel J in mm)

| Frame | Sph | D1 | J | Vogel D1 (clamped) | Vogel J |
|---|---|---|---|---|---|
| 62×55/24/25 | −12 … −10 | – | BACK_SAG_UNDEFINED | | |
| 62×55/24/25 | −9 | 0,50 | 43,04 | 1,50 | null |
| 62×55/24/25 | −8 | 0,50 | 31,16 | 2,00 | null |
| 62×55/24/25 | −7 | 0,50 | 25,00 | 2,50 | 37,76 |
| 62×55/24/25 | −6 | 0,50 | 20,40 | 3,00 | 28,83 |
| 62×55/24/25 | −4 | 0,50 | 13,21 | 4,00 | 18,07 |
| 62×55/24/25 | −2 | 0,50 | 7,25 | 5,00 | 9,66 |
| 62×55/24/25 | 0 | 0,50 | 1,80 | 6,00 | 1,97 |
| 62×55/24/25 | +2 | 1,35 | 6,34 | 8,00 | 8,82 |
| 62×55/24/25 | +3 | 1,98 | 9,01 | 9,00 | 14,63 |
| 62×55/24/25 | +4 … +12 | 2,60 … 6,69 | 11,68 … 33,34 | 10,00 | null |
| 52×38/18/32 | −12 | 0,50 | 16,15 | 0,50 | 16,15 |
| 52×38/18/32 | −6 | 0,50 | 7,88 | 3,00 | 8,40 |
| 52×38/18/32 | −2 | 0,50 | 3,75 | 5,00 | 4,00 |
| 52×38/18/32 | 0 | 0,50 | 1,80 | 6,00 | 1,85 |
| 52×38/18/32 | +2 | 1,51 | 2,93 | 8,00 | 3,12 |
| 52×38/18/32 | +6 | 3,99 | 6,80 | 10,00 | 7,38 |
| 52×38/18/32 | +12 | 7,44 | 12,61 | 10,00 | 12,87 |

The full 1-dpt table is printed by the test "thinnest vs Vogel table". J ≤ Vogel J in every row where Vogel computes.

## Tier-4 properties (`src/engine/properties.test.js`, 21 tests)

**Results:**
- **Monotonicity of the thinnest lens:** 3,188 ok samples. The worst drop is **8,0e-4 mm**, at rechteckig 62×55 CR-39 cyl 0, 0 → +0,25. This matches the planner prototype exactly.
- **Axis sweep:** the worst step between neighbouring degrees is 0,037 mm for −4 −2 and 0,043 mm for +4 −2, against a limit of 0,05.

**Invariants that also hold:**
- sphere sign (fast-check seed 3);
- rund OC-centred constant edge;
- bitwise OD/OS mirror (`toBe` for D1 and CT);
- ENG-05 point reflection (seed 13, `toBe` D1/CT, 1e-9 grid);
- oblique pair check (seed 17, both eyes, every outline point with |x·y| ≥ 1, no counterexample);
- material monotonicity at a fixed D1 of 4;
- ENG-04 convergence 720 vs 5760 on all 4 shapes × {+6, −6, −4 −2 × 30};
- weight and volume > 0 (seed 11).

**Mutation sanity check (scratch copy, deleted):** with the pair-check side flipped or the point reflection replaced by a mirror, both tests fail, so neither test is vacuous.

**Unit project runtime:** `time npx vitest run --project unit` reports 820 tests in **23,4 s real**.

## Page (built, checked with a scratch Playwright script)

- **SC-4:** the status cell reads "Nicht herstellbar". `#diag-od` reads "R – rechtes Auge: Dieses Glas ist so nicht herstellbar", followed by the model-honest explanation ("In diesem Rechenmodell (Vorderfläche zwischen +0,50 und +10,00 dpt) …") and the suggestion. axe reports 0 violations in this state.
- **+12 62×55/24/25:** CT reads 33,3 mm. The base-curve cell reads "+6,69 dpt – so gewählt, dass das Glas möglichst dünn wird (zum Vergleich: übliche Faustregel nach Vogel +10,00 dpt; damit wäre das Glas in diesem Modell nicht herstellbar)". The diag box reads "Großes Rohglas nötig … mindestens etwa 105,3 mm … höchstens 75,0 mm".
- **+12 62×55/18/32:** the base-curve cell reads "… Vogel +10,00 dpt; damit wäre das Glas an der dicksten Stelle 25,0 mm dick".

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/engine/diagnostics.test.js` | 20 pass |
| `-t 'MAT-02'` / `-t 'ENG-07'` | 8 / 12 pass |
| `npx vitest run src/i18n/dictionary.test.js` | 43 pass |
| `npx vitest run src/engine/properties.test.js` | 21 pass |
| `-t 'ENG-05'` | 1 pass |
| `npm run test:coverage` | 820 pass; All files 98,04 % lines, 96,05 % branches |
| `npm run lint` | exit 0 |
| `npm run build && npm run test:e2e` | 28/28 pass (desktop + mobile), including "SC-4 impossible lens is explained", "oversized lens warns" and "normal lens shows Vogel reference" |

**Acceptance greps:**
- `numRuns: 1000` = 1
- `SC-4` = 4
- `'thinnest'` = 5
- `vogelMaxThickness` = 10
- `expect(rescue…).toBe(0)` = 2
- `result.notComputable` = 0
- `Stärke` = 0
- "runder" in the BACK_SAG suggest = 0
- `tech.timingWorst` = 1, with no "PD 10 mm"
- `diag.BASE_CURVE_CLAMPED` = 0
- `basecurve.vogelRefImpossible` = 1
- "dicker" in the thinnest rule = 0
- `seed: 13` = 1, `seed: 17` = 1

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | ef81ce0 | test(01-10): add failing tests for remaining diagnostics, D-01 pins and fuzz |
| 1 GREEN | f102452 | feat(01-10): raise OC_OUTSIDE_OUTLINE and BLANK_EXCEEDS_STOCK warnings |
| 2 | fffda5b | feat(01-10): German diagnostic texts on the page, no raw codes |
| 3 | d40469e | test(01-10): ENG-08 tier-4 property and invariant suite |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – test arithmetic] OC_OUTSIDE_OUTLINE expected x.** My first test expected x = 1. The engine correctly gives (52 + 18)/2 − 32 = 3, so the test was fixed before the GREEN commit.

**2. [Rule 1 – test assumption] SC-4 e2e after switching to 1,74.** The plan expected the numbers to return. They do, but the 62×55 frame still needs a blank larger than 75 mm, so `#diag-od` correctly shows the `BLANK_EXCEEDS_STOCK` warning instead of being empty. The e2e test now asserts "no 'nicht herstellbar'" and "'Großes Rohglas nötig' present".

### Additions (Rule 2)

- **Status-cell text labels:** `result.diagLabel.impossible` / `failed` / `warn`. Internal-limit errors (VERTEX_TERM_INVALID, THICK_LENS_NOT_CONVERGED, NON_FINITE_RESULT, INVALID_SPEC) are labelled "Nicht berechenbar" rather than "Nicht herstellbar", because that would be untrue for them. Each diag title is prefixed with the eye name so screen-reader users know which lens it refers to.
- **Bench Grenzfall fitting height:** `specFor` in main.js gained an optional `fittingHeight` parameter, because the argmax has FH 0 and the page itself still sends null (D-04).
- **NON_FINITE_RESULT guard:** `allFinite` already walked `metrics` and `intermediates` recursively (01-02), so no code change was needed. Its return line remains uncovered because no input reaches it, which the fuzz supports.

### TDD gate note

- **Task 1:** RED (ef81ce0) failed on the three missing triggers, and GREEN followed.
- **Task 3:** this is a characterisation suite for invariants the engine already had, so it passed on its first run; no engine defect was found. The mutation check above shows the key properties can fail.

## Requirements

- **Marked complete:**
  - **ENG-07:** coded diagnostic + plain German + tested suggestion.
  - **ENG-08:** all four tiers now exist.
  - **L10N-01:** no raw code text reaches the page any more, every diagnostic is German, `lang="de-AT"` is set and numbers use Intl de-AT.
- **Pending:**
  - **MAT-02:** "shown in Expert view" is phase 2.
  - **ENG-06:** the full text lists sags among the intermediates. `frontProtrusion` exists, but there is no explicit sag field, so this is left for the phase-2 Expert view or the 01-11 review to decide.
- **Already complete:** ENG-04 and L10N-02.

## Known Stubs

None. The CT_SET_BY_* texts exist but are only shown in the phase-2 Expert view, as planned.

## Self-Check: PASSED

- **Files exist:** src/engine/properties.test.js, src/engine/diagnostics.test.js, src/i18n/de-AT.js, e2e/smoke.spec.js.
- **Commits exist:** ef81ce0, f102452, fffda5b, d40469e (`git log --oneline -6`).
