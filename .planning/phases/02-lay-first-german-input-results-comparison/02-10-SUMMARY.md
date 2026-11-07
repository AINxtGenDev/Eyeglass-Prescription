---
phase: 02-lay-first-german-input-results-comparison
plan: 10
subsystem: engine + expert-ui
tags: [MAT-03, MAT-04, UX-01, ANA-02, base-curve, min-thickness, expert-view]
requires: [02-09]
provides:
  - "engine: manual baseCurve >= 0 (0 = plano front), MANUAL_BACK_CONVEX warn diagnostic { D2max }"
  - "specFor(..., fittingHeight, overrides) with an unchanged key order"
  - "validateBaseCurve (0..10 dpt), validateMinThickness (0,5..5 mm), two VAL codes"
  - "Glas-Einstellungen block (#glass-settings) with readExpertOverrides / expertStatus / renderGlassSettings"
  - "compare lane: autoBc job (automatic curve while a manual one is set), material rows with their own minimums, #cmp-footnote"
affects: [src/engine/evaluate.js, src/engine/diagnostics.js, src/ui/pipeline.js, src/ui/main.js, src/ui/results.js]
tech-stack:
  added: []
  patterns:
    - "Expert overrides are read in the input frame and only while #expert is checked; a minimum equal to the material default is sent as null, so the spec key matches the no-override key"
    - "Expert field messages reuse showFieldMessage/messageStatus; a blocking Expert field blocks both eyes like a frame field"
key-files:
  created: []
  modified:
    - src/engine/evaluate.js
    - src/engine/diagnostics.js
    - src/state/bench-cases.js
    - src/state/validate.js
    - src/ui/expert.js
    - src/ui/pipeline.js
    - src/ui/main.js
    - src/ui/material-input.js
    - src/ui/results.js
    - src/ui/style.css
    - index.html
    - src/i18n/de-AT.js
    - src/engine/evaluate.test.js
    - src/engine/diagnostics.test.js
    - src/state/bench-cases.test.js
    - src/state/validate.test.js
    - src/i18n/dictionary.test.js
    - e2e/expert.spec.js
decisions:
  - "The automatic value next to a manual base curve comes from one extra compare-lane job (autoBc: same specs, baseCurve null). The engine skips the search for a manual curve, so the main result cannot supply it."
  - "MANUAL_BACK_CONVEX is the only warning whose suggestion is shown (results.js WARN_SUGGEST). The fix is the user's own input. Other warnings are unchanged."
  - "The Vogel lens thickness is always shown when it computes (MINOR-2) through the existing basecurve.vogelRefThicker. basecurve.vogelRef now serves manual results."
  - "The rounded Vogel value is a separate sentence ('Zum Übernehmen gerundet: {rounded}.'), shown only in the Glas-Einstellungen line, to avoid nested parentheses."
metrics:
  duration: 22min
  completed: 2026-11-07
  tasks: 2
  files: 18
---

# Phase 2 Plan 10: Expert base curve and minimum thicknesses Summary

Experts can now set a manual base curve from 0,00 to +10,00 dpt, or leave it empty for automatic. The engine accepts 0 and warns with `MANUAL_BACK_CONVEX` when the back would be convex. They can also set the minimum centre and edge thickness, pre-filled per material with their source. The automatic value, the rule, the Vogel lens thickness, the rounded Vogel value and the binding constraint stay in view.

## Commits

| Task | Gate | Commit | Message |
|------|------|--------|---------|
| 1 | RED | ba24268 | test(02-10): failing manual base curve and min-thickness tests |
| 1 | GREEN | e9922cc | feat(02-10): base curve 0 allowed, MANUAL_BACK_CONVEX warning, spec overrides |
| 2 | — | 1ff783a | feat(02-10): manual base curve and minimum thicknesses in the Experten-Ansicht |

## What was built

**Engine (additive, pure; no DOM or Three)**
- `optNonNeg(spec.baseCurve)` is used for the base curve only. `minCT`/`minET` still go through `optPositive`, so 0 stays INVALID_SPEC.
- `MANUAL_BACK_CONVEX` (warn, `{ D2max }`) is pushed when `baseCurveRule === 'manual'` and `max(D2a, D2b) > BACK_CONVEX_MAX_DPT`. The comment derives D2 = Sph − D1v: only a higher D1 clears the warning.
- Pinned case: +2,00, CR-39, rechteckig 52×38/18, PD 32.
  - Manual 0,50 gives D2max +1,4995 and the warning.
  - Manual 3 gives D2max −1,0177 and no warning. Test name: 'steeper base curve clears the convex back'.
  - Manual 0 gives D2max +2,00 and the warning.
  - With base curve 0 the warning appears exactly when max(sph, sph+cyl) > 0, checked over 5 Rx.
- Existing golden tests pass with no edits: `git diff` of the existing expectations in `evaluate.test.js` shows insertions only. The `[2, -0.5]` case is my own RED test, corrected in the GREEN commit; see deviations.

**specFor overrides.** `JSON.stringify(NORMAL_PAIR.OD)` is the same before and after the change, and a test now pins that string:
`{"eye":"OD","sph":-4,"cyl":-2,"axisDeg":30,"materialId":"cr39","frame":{"shape":"rechteckig","A":52,"B":38,"DBL":18},"monoPD":32,"fittingHeight":null,"baseCurve":null,"minCT":null,"minET":null}`

**UI**
- **Base curve field:** `#expert-basecurve`, with its echo, an error slot and the `tip-basecurve` toggletip.
- **Automatic line per eye (`#expert-bc-auto-od/-os`):** "Rechtes Glas – automatisch: +0,50 dpt – dünnstes Glas, flachste Vorderfläche innerhalb 0,1 mm." It is followed by the Vogel sentence with the thickness and "Zum Übernehmen gerundet: +4,50 dpt."
- **Minus-lens note:** `#expert-bc-minus-note` shows when SE < 0 and the automatic D1 sits at the +0,50 floor.
- **Vogel button:** `#expert-bc-vogel` writes '4,50' for the example (R −2,75 −0,50 × 180: SE −3, Vogel +4,50).
- **Minimum fields:** `#expert-min-ct` and `#expert-min-et` are re-filled on a material change unless edited. "Standardwerte setzen" resets them. The echo reads "Herstellerangabe (Zeiss-Datenblatt)", "angenommen (keine Herstellerangabe)" (taken from `MATERIALS[id].assumed`) or "von Ihnen vorgegeben".
- **Binding note:** per eye, in `#expert-binding-od/-os`.
- **Tips:** `tip-dec` sits on the Dezentration row of the Zwischenwerte. With Basiskurve, all 12 UX-01 terms now have a tap/keyboard toggletip.
- **Switch:** turning it on or off schedules an input frame and still repaints the suffixes directly. When it is off, `readExpertOverrides` returns all null. Typed values are kept.
- **Comparison:** material rows use `{ ...spec, materialId, minCT: null, minET: null }`, so the base curve is shared and each material keeps its own sourced minimums. Config A spreads B's spec, so it uses the same overrides. `#cmp-footnote` shows while any override is non-null.

## Verification (real output, plan end)

`npm run lint && npm run test:coverage && npm run build && npm run test:e2e` exited 0:
- lint: clean
- test:coverage: 32 files and 1398/1398 tests passed. Coverage on all files is 98,48 % statements, 96,82 % branches, 100 % functions and 99,18 % lines. `evaluate.js` is at 98,97 / 98,78 / 100 / 98,66, so the engine gate (lines ≥ 95, branches ≥ 90) holds.
- build: `✓ built in 121ms`
- test:e2e: 274 passed (1.6m). This includes `worker.spec` 'main result is not delayed by the comparison' and the 12 new expert cases on desktop and mobile.

ENG-09 (4× proxy, case A), `npm run test:perf` run twice against the 02-09 baseline:

| Metric | 02-09 | 02-10 run 1 | 02-10 run 2 |
|---|---|---|---|
| input frame median (max) | 15,55 (20,8) ms | 16,55 (21,9) ms | 14,65 (20,5) ms |
| result | 36,5 ms | 38,25 ms | 34,9 ms |
| compare paint | 7,5 ms | 7,85 ms | 6,9 ms |

The two runs fall on both sides of the baseline, so I read the difference as run-to-run noise, not a regression. With the switch off, the input frame only adds `readExpertOverrides` returning a frozen constant.

The `evaluate.test.js` optimality test was not touched. The new MAT-03 tests are single evaluations, a few ms each.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 1 - Bug] RED test used a plus cylinder.** The case `[-1, 2]` gave INVALID_SPEC, because the engine takes the minus-cylinder form only. In minus form max(sph, sph+cyl) = sph, so I replaced it with `[2, -0.5]`, and a comment says so. Fixed in e9922cc.
2. **[Rule 3 - Blocking] Warnings never showed their suggestion** (`results.js`). The must-have requires the "stärker gewölbte (höhere) Basiskurve" advice on screen. I added `WARN_SUGGEST = ['MANUAL_BACK_CONVEX']`; OC_OUTSIDE_OUTLINE and BLANK_EXCEEDS_STOCK display is unchanged. `results.js` was not in `files_modified`. Commit 1ff783a.
3. **[Rule 2 - Missing] No source for the automatic value while a manual curve is set.** The plan says it is "always shown", but the engine does not run the search for a manual curve. I added one compare-lane job, `autoBc`, with the same specs and `baseCurve: null`. It appears in `#compare[data-pending]` as `autoBc`. Commit 1ff783a.

### Wording and structure adjustments

- `basecurve.vogelRounded` is 'Zum Übernehmen gerundet: {rounded}.' rather than '(gerundet {rounded})'. It is a separate sentence after the Vogel parenthesis, which avoids nested parentheses and makes clear it is the value the button writes.
- `basecurve.vogelThickness` was not added. Showing the thickness always uses the existing `basecurve.vogelRefThicker`, now for every computable Vogel lens; the old rule showed it only when the Vogel lens was ≥ 0,05 mm thicker. `basecurve.vogelRef` is reused for manual results, so no key is orphaned.
- `#expert-bc-auto` and `#expert-binding-note` are containers with per-eye `-od`/`-os` children, so the ids are unique per eye.
- The minimum fields have their own tips (`tip-minct`, `tip-minet`) under new keys, because reusing `tip-ct`/`tip-et` would mean two buttons for one panel.
- `expert.hint` now names the Glas-Einstellungen.
- **Acceptance check `grep -c "flachere Basiskurve" de-AT.js` returns 1, not 0.** The hit is the phase-1 `diag.FRONT_SAG_UNDEFINED.suggest`. There the front is too steep for the frame, so "flacher" is the correct advice. The new text contains no "flacher", and `dictionary.test.js` asserts that. I left it unchanged.

## Known limitations

- **Sync fallback (worker unavailable):** with a manual curve, the automatic line shows "automatisch: –" until "Vergleich berechnen" runs the compare jobs. This is the same rule as the material rows (T-02-18).

## Known Stubs

None.

## Threat Flags

None. The Expert fields cross the trust boundary already in the plan's register:
- T-02-26: validated, never clamped; the engine guards ≥ 0 / > 0.
- T-02-27: warning plus "von Ihnen vorgegeben", with the automatic value next to it.
- T-02-28: an e2e test checks that switching off makes the overrides stop applying.

## TDD Gate Compliance

Task 1: RED `ba24268` (test) then GREEN `e9922cc` (feat). Task 2: one feat commit with its e2e cases.

## Self-Check: PASSED

- FOUND: .planning/phases/02-lay-first-german-input-results-comparison/02-10-SUMMARY.md
- FOUND: ba24268, e9922cc, 1ff783a
