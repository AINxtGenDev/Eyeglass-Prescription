---
phase: 02-lay-first-german-input-results-comparison
plan: 12
subsystem: engine + state + expert-ui
tags: [MAT-06, D-17, custom-material, expert-view, comparison]
requires: [02-11]
provides:
  - "engine: optional LensSpec.customMaterial { ne, density, ve|null } with materialId 'custom' and required minCT/minET; INVALID_SPEC reason 'custom-material'; intermediates.abbe number|null"
  - "src/state/parse.js: parseIndex, parseDensity, parseAbbe (length cap 32, anchored)"
  - "src/state/validate.js: CUSTOM_BANDS, validateCustomMaterial, nearestListedMaterial, VAL_CUSTOM_OUT_OF_RANGE (Fehler), VAL_CUSTOM_IMPLAUSIBLE (Hinweis)"
  - "specFor appends customMaterial last, only for materialId 'custom'"
  - "materialRows: selectedId 'custom' → custom row first, then all six sourced rows"
  - "UI: seventh card 'Eigenes Material' (data-expert), #custom-material fields, card + material-line label, #cmp-custom-note, switch-off fallback"
affects: [src/engine/evaluate.js, src/state/parse.js, src/state/validate.js, src/state/bench-cases.js, src/state/compare.js, src/ui/material-input.js, src/ui/expert.js, src/ui/main.js, src/ui/pipeline.js, src/ui/results.js, src/ui/compare-view.js, src/ui/rx-input.js]
tech-stack:
  added: []
  patterns:
    - "A user-supplied engine input needs every value explicit: the engine invents no default, and the state layer resolves any empty field to a visible prefill value"
    - "Rows that exist only in one mode (custom row) are built once and hidden. Page-wide e2e counts use :visible"
key-files:
  created: []
  modified:
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/state/parse.js
    - src/state/parse.test.js
    - src/state/validate.js
    - src/state/validate.test.js
    - src/state/bench-cases.js
    - src/state/bench-cases.test.js
    - src/state/compare.js
    - src/state/compare.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - src/ui/material-input.js
    - src/ui/expert.js
    - src/ui/main.js
    - src/ui/pipeline.js
    - src/ui/results.js
    - src/ui/compare-view.js
    - src/ui/rx-input.js
    - src/ui/style.css
    - index.html
    - e2e/expert.spec.js
    - e2e/compare.spec.js
    - e2e/smoke.spec.js
decisions:
  - "With 'Eigenes Material' selected, its own minimum fields replace the Glas-Einstellungen minimums. #expert-min and 'Standardwerte setzen' are hidden and send nothing, so a spec has one minimum and the fields never compete."
  - "An empty custom minimum field means the nearest-listed-material default. That is the value the field is pre-filled with, and the echo names it ('vorbelegt wie 1,60 · Höherbrechend'). The engine still always gets explicit numbers."
  - "Empty nₑ or Dichte is a Fehler (PARSE_EMPTY), because both are required. An empty Abbe is ve null, and the material line then says 'ohne Abbe-Zahl'."
  - "Turning the switch back on does not re-select 'Eigenes Material'. The switch never changes the material by itself, and the typed values are kept."
  - "Vorher (A) with a custom material freezes a copy of its constants and minimums. A listed A after a custom B uses that material's own sourced minimums."
  - "nearestListedMaterial treats gaps within 1e-12 as a tie and gives the tie to the lower index, so float noise (1,515) cannot pick the higher material."
metrics:
  duration: 50min
  completed: 2026-11-07
  tasks: 2
  files: 24
---

# Phase 2 Plan 12: Custom material (Eigenes Material) Summary

In the Experten-Ansicht, an expert can now enter their own material: nₑ, density, an optional Abbe number and the two minimum thicknesses. Every result computed with it carries the label "beruht auf Ihren Angaben, kein geprüftes Material". The material comparison puts it at the top as "Ihre Auswahl" and compares the six sourced materials against it. It is never one of the compared rows.

## Commits

| Task | Gate | Commit | Message |
|------|------|--------|---------|
| 1 | RED | 013e375 | test(02-12): failing custom material tests |
| 1 | GREEN | 4f4b8a2 | feat(02-12): user-supplied material in engine and state |
| 2 | — | c8d784a | feat(02-12): Eigenes Material in the Experten-Ansicht |

## What was built

**Engine (additive, pure)**
- `invalidReason` returns `'custom-material'` in these cases, when `materialId === 'custom'`:
  - customMaterial is not an object;
  - ne is not finite or not > 1;
  - density is not finite or not > 0;
  - ve is neither null nor a finite number > 0;
  - minCT or minET is null.
- It also returns `'custom-material'` for a non-null customMaterial with a listed materialId.
- The material lookup builds `{ ne, density, ve, minCT: NaN, minET: NaN }`. The NaN can never be reached, because both minimums are required, and a comment says so.
- `intermediates.abbe = m.ve ?? null`. The JSDoc type widens to `number|null`.
- **Equivalence:** `{ ne 1,5, density 1,32, ve 56 }` with minCT 1,8 and minET 1,0 gives `metrics`, `intermediates` and `surfaces` that `toEqual` those of `materialId 'cr39'`. This holds for the −2 sphere and for +4/−1,5×60.

**State**
- **Parsers:**
  - `parseIndex`: one integer digit, up to 3 decimals.
  - `parseDensity`: one digit, up to 2 decimals, optional `g/cm³` or `g/cm3`.
  - `parseAbbe`: up to 2 digits, up to 1 decimal.
  - All three use a shared `parseUnsigned` with the 32-character cap before any regex. A fast-check property (500 runs, seed 1202) plus a 10 000-character input show they never throw.
- **`CUSTOM_BANDS`:** the RESEARCH Open Q3 table, frozen. The glass upper bound 1,9 is marked [ASSUMED A3].
- **Message tiers:**
  - Outside the outer band: Fehler `VAL_CUSTOM_OUT_OF_RANGE`, which blocks.
  - Outside the inner band: Hinweis `VAL_CUSTOM_IMPLAUSIBLE`, which computes.
  - The data carries `{ field, value, min, max }` of the band that was crossed.
- **`nearestListedMaterial(1,62)`** returns `'idx160'`.
- **`materialRows`** with `selectedId 'custom'` returns 7 rows: `custom` (selected) first, then the six MATERIALS rows with differences against it. A `custom` entry in `others` is ignored.

**UI**
- **The card:** a static seventh card in `index.html` (`value="custom"`, `data-expert hidden`). `buildMaterialCards` moves it after the six sourced cards.
- **`currentMaterialId()`** returns `'custom'` only while its radio is checked and the switch is on.
- **The fields:** `#custom-material` is a fieldset with an Expert tag and five fields, each with an echo and a message slot. nₑ has the `tip-ne` toggletip.
  - The minimums are pre-filled from the nearest listed material. Typing nₑ re-fills them until a minimum is typed.
  - Messages appear after the usual pause, through `showFieldMessage`. A Fehler blocks both eyes, and their cards jump to the field.
- **Labels:** each card shows `#result-{eye}-custom` under the headline. It is hidden on every no-result path. The material line reads "R: Eigenes Material, nₑ 1,523, Dichte 2,54 g/cm³, Abbe-Zahl 58 – beruht auf Ihren Angaben, kein geprüftes Material".
- **Comparison:**
  - The custom row is built once and hidden unless it is the selection.
  - `#cmp-custom-note` shows `cmp.customExcluded`.
  - The compare jobs for the six listed materials drop `customMaterial` and use their own minimums (`listedSpec`).
- **Switching the Experten-Ansicht off while custom is selected:**
  - The last listed material is checked again.
  - `#material-err` shows "Hinweis: Eigenes Material gilt nur in der Experten-Ansicht. Es wird wieder 1,67 · Hochbrechend verwendet."
  - The fields and the labels disappear.

## Verification (real output, plan end, after the last commit)

`npm run lint && npm run test:coverage && npm run build && npm run test:e2e` exited 0 (`EXIT 0`):
- **lint:** clean.
- **test:coverage:** 33 files, 1505/1505 tests passed.
  - All files: 98,4 % statements, 96,91 % branches, 100 % functions, 99,05 % lines.
  - `evaluate.js`: 98,34 / 98,37 / 100 / 97,89. The two uncovered lines, 208 and 256, are the same as in 02-11 and have only shifted: the guard's 10-pass failure and NON_FINITE_RESULT. Every new custom-material branch is covered.
- **build:** `✓ built in 123ms`.
- **test:e2e:** **296 passed (1.9m)**. The earlier count was 282; this adds 7 new expert cases on desktop and mobile.

**ENG-09 (4× proxy, case A), `npm run test:perf` twice:**

| Metric | 02-11 baseline | run 1 | run 2 |
|---|---|---|---|
| input frame median (max) | 15,15–16,9 (16,1–32,8) ms | 16,15 (20,5) ms | 16,15 (20,1) ms |
| result | 35,4–37,15 ms | 35,75 ms | 35,95 ms |
| compare paint | 7,45–8,95 ms | 7,25 ms | 7,35 ms |

- Both runs are inside the 02-11 band. Compare paint is just under its lower bound.
- With the switch off, the input frame adds one `readCustomMaterial` call. It returns early after clearing five message slots, which are already empty.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 1 - Bug] Three existing e2e counts covered every row or card on the page.**
   - The affected tests were `compare.spec.js:30` (6 table rows), `compare.spec.js:66` (12 per-eye rows) and `smoke.spec.js:83` (6 material radios).
   - The hidden custom row and card would have made those counts 7, 14 and 7.
   - Fix: they now count `:visible` elements. The asserted counts are unchanged. Commit c8d784a.
2. **[Rule 3 - Blocking] Custom messages need unit-less numbers and translated field names.**
   - `messageText` in `src/ui/rx-input.js` (not in `files_modified`) gained the kind `'num'` (Intl, up to 3 decimals).
   - It also translates `{field}` for ne, density and abbe through `material.custom.field.*`. Commit c8d784a.
3. **[Rule 2 - Correctness] `expert.js` looked up `MATERIALS[materialId]` in `readExpertOverrides` and `onMaterialChange`.** With `'custom'` this would have thrown. Both now guard for it; see the decisions in the frontmatter.
4. **[Rule 2 - Correctness] Configuration comparison (02-08) with a custom material.**
   - Before the fix, an A job would have carried `materialId 'custom'` without constants, or a listed id together with `customMaterial`. Both are INVALID_SPEC.
   - `currentConfig()` now freezes the custom constants into A. The A job, `sameConfig` and the material line handle them through `cardMaterial()`, which renames `cardMaterialId`.
   - An extra e2e case covers this: "Eigenes Material as Vorher (A)".

### Plan adjustments

- **The e2e cases are in the Task 2 commit, not the RED commit.** The UI they drive did not exist in Task 1, and Task 1's verify step does not run Playwright. This is the same as in 02-11.
- **The custom card is in `index.html`, as the acceptance grep requires.** It is moved behind the six generated cards at init, so the order is still the six sourced materials, then custom.
- **`#custom-material` is a `<fieldset>` after the material fieldset, not inside it.** This keeps the radio group's fieldset to radios only, and gives the fields their own legend.

## Known limitations

- **ν_e vs ν_d:** the Abbe field takes whatever the user types and labels it "Abbe-Zahl". The ne tip explains ne against nd, but no tip explains νe against νd. Abbe is display only (chromatic effects are not modelled), so it changes no number.
- **The Abbe band (Hinweis below 25) is a design constant.** It flags polycarbonate-like values (νe 29 is inside the band). As stated in RESEARCH, the sources for crown glass differ.

## Known Stubs

None.

## Threat Flags

None. The surface is the one in the plan's register:
- **T-02-32:** the label is on every card and on the material line, and custom is never a compared row. The e2e tests assert both.
- **T-02-33:** the engine checks for finite values, ne > 1, density > 0, a valid ve and the required minimums. The UI's Fehler band blocks before the engine is called.
- **T-02-34:** the length cap, the anchored patterns and the never-throw property.

User text reaches the page only through `textContent` (the echoes are formatted numbers).

## TDD Gate Compliance

Task 1: RED `013e375` (test) failed 69 tests, then GREEN `4f4b8a2` (feat). Task 2: one feat commit with its e2e cases.

## Self-Check: PASSED

- FOUND: .planning/phases/02-lay-first-german-input-results-comparison/02-12-SUMMARY.md
- FOUND: 013e375, 4f4b8a2, c8d784a
