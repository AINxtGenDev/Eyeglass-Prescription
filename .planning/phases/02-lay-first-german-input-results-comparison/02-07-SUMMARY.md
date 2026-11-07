---
phase: 02-lay-first-german-input-results-comparison
plan: 07
subsystem: ui-material, ui-compare, pipeline, timing
tags: [materials, comparison, compare-lane, RES-02, UX-01, ENG-09, e2e]
requires: ["02-06", "02-05", "02-04", "02-01"]
provides:
  - "material-input.js: initMaterialInput({ schedule }), currentMaterialId(), renderMaterialLine(eye, id); six input[name=material] radio cards in MATERIALS order"
  - "compare-view.js: initCompareView(), renderMaterialTable({ selectedId, selected, others }), markOutdated(), setCompareStale(on)"
  - "pipeline.js: compare jobs per changed main request, onCompare buffered and painted in its own rAF after isCompareCurrent, #compare[data-pending], #cmp-run in the sync fallback"
  - "timing.js: timings.compareFrame + timeCompareFrame(frameStart) -> #timing-compare"
  - "e2e/helpers.js: settledCompare(page), slowWorker(page, ms, { types })"
affects: [02-08 (#cmp-config inside #compare), 02-10 (#cmp-footnote, Expert overrides on compare jobs), 02-14/02-15 (ENG-09 judged with the comparison active)]
tech-stack:
  added: []
  patterns: [second paint frame for low-priority results, rows built once and updated in place, compare paint gated on the painted main result]
key-files:
  created:
    - src/ui/material-input.js
    - src/ui/compare-view.js
    - e2e/compare.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-07-SUMMARY.md
  modified:
    - src/ui/main.js
    - src/ui/pipeline.js
    - src/ui/timing.js
    - src/ui/style.css
    - index.html
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/helpers.js
    - e2e/smoke.spec.js
    - e2e/worker.spec.js
    - e2e/perf-throttled.spec.js
    - e2e/frame.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "[02-07]: The compare table is painted only after the main result for the current input is painted (shown[eye].key === requestedKeys[eye]); until then compare deliveries stay pending. The selected row is always the main result (D-15), never a mix of old main and new comparison values (compare cache hits answer during the input frame)."
  - "[02-07]: The compare job key is the job's own spec pair (JSON with materialId replaced). Switching the selected material reuses the other rows from the client's 64-entry compare cache."
  - "[02-07]: The page asks for a comparison when !client.isCompareCurrent(compareGen) after client.request(), not by its own key diff. That covers every generation bump, including the retry after a failed main eye."
  - "[02-07]: The compare toggletips (tip-ct, tip-et) are only in the right-eye card. There are no extra buttons in the table headers: below 480 px the header row is hidden, and focusable hidden buttons would fail WCAG 2.4.7."
  - "[02-07]: The difference sentence has 9 keys (4 mixed, 1 equal, 2 equal-thickness, 2 equal-weight). Each uses only {mm} and/or {g}; the 4 mixed ones use exactly {mm, g}."
metrics:
  duration: ~45 min
  completed: 2026-11-07
  tasks: 3 (orchestrator deflake + 2 plan tasks)
  files: 16
---

# Phase 2 Plan 07: Material cards and "Was bringt ein anderes Material?" Summary

Six material cards now replace the select, ordered by index with a neutral name and the Abbe number. Under the result, the always-visible table answers "does a higher index help me?" for all six sourced materials. It shows the thickest point, the centre, the weight of both glasses and the difference in words. It runs on the 02-06 compare lane and is painted in its own frame, so the main result never waits for it.

## Deflake (orchestrator task, `df624e4`)

`e2e/frame.spec.js:117` ("64" binocular PD) was a test race, not an app bug. I proved this with a probe instead of reading the code. The probe filled OD '64', waited one rAF + setTimeout, and read `OD "64,0 mm Gesamt-PD → je 32,0 mm" | OS "31,5 mm"` while the OS field still held '31,5'. If the input frame runs between the two `fill()` calls, `toContainText('Gesamt-PD')` passes and the one-shot OS read sees the example's 31,5. The fix uses retrying `toHaveText` for both echoes. Proof: `--repeat-each=20 --workers=8` while a full suite ran at the same time gave **520/520** passed.

## What was built

- **Task 1 (`e86baa4`):** `material-input.js` with six radio cards ('1,50 · Standard' … '1,74 · Höchstbrechend'). Each card's second line reads "… · Abbe-Zahl 56" etc. from `MATERIALS[id].ve`. `section#material-section` has two toggletips: `tip-index` in the legend 'Material nach Brechungs·index' and `tip-abbe` ('Was bedeutet die Abbe-Zahl?'). The cards use the shape cards' `.radio-card` rules and switch to 2 columns from a 360 px container. The smoke and perf specs now use the radios.
- **Task 2 RED (`066ae02`) / GREEN (`a7f8d80`):**
  - `#cmp-material` contains the intro, `#cmp-status` (one reserved line), `#cmp-run`, the 5-column table, the `<details>` per-eye table with 'Dickster Rand', `#cmp-assumed-note` and `#cmp-footnote` (hidden, for 02-10).
  - `compare-view.js` builds the rows once and only formats `materialRows` output.
  - `pipeline.js` sends compare jobs only after a changed main request. Deliveries are buffered and painted in a separate rAF after `isCompareCurrent`. `#compare[data-pending]` lists the open material ids. After 50 ms, 'Vergleich rechnet …' appears and the old rows get `data-cmp-stale`.
  - In sync mode nothing runs automatically: the old rows stay marked and 'Vergleich berechnen' runs the jobs.
  - `#timing-compare` reports the compare paint frame.

Page values, checked by e2e:

| Case | Check | Result |
|---|---|---|
| Example | 6 rows; 1,50 = Ihre Auswahl 4,6 / 1,8 mm / 14 g; 1,74 '1,6 mm dünner, 4 g leichter' '(≈ 35 % dünner)' | pass |
| Example → 1,74 checked | 1,74 'Ihre Auswahl'; 1,50 '1,6 mm dicker, 4 g schwerer' | pass |
| Plus R +3,00 / L +2,75 | intro 'das rechte Glas'; 1,50 3,9 mm 'in der Mitte'; 1,74 '0,9 mm dünner, 2 g leichter'; 1,59 '0,1 mm dünner, 1 g leichter' | pass |
| Plus per-eye | 1,50 R Dickster Rand 2,8 mm, L 2,7 mm | pass |
| Footnote | names 1,67 and 1,74, not 1,50/1,53/1,59/1,60 | pass |

## ENG-09 (informational, `npm run test:perf`, CPU-throttled proxy, case A)

Output: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/perf-0207.json` (baseline `perf-0206.json`, same machine).

| Rate | Input frame median / max (02-06 → 02-07) | Result median / max (02-06 → 02-07) | compareFrame median / max (new) |
|---|---|---|---|
| 1× | 1,40 / 2,0 → 1,50 / 4,8 ms | 28,5 / 29,5 → 27,05 / 27,3 ms | 1,85 / 2,0 ms |
| 2× | 2,75 / 7,7 → 6,95 / 9,3 ms | 27,75 / 29,0 → 26,1 / 30,7 ms | 3,15 / 5,8 ms |
| **4×** | **13,35 / 16,40 → 15,35 / 16,50 ms** | **30,5 / 34,1 → 32,45 / 37,5 ms** | **6,55 / 7,5 ms** |
| 6× | 22,4 / 25,2 → 23,4 / 26,6 ms | 41,0 / 51,7 → 44,9 / 56,1 ms | 10,8 / 12,5 ms |

Next to 01-15 (16,30 ms / –): 4× input frame max 16,50 ms, compareFrame max 7,5 ms.

What this shows, and what it does not:
- The input frame median went up by about 2 ms at 4×. At 4× the max (16,50 ms) is 0,2 ms below the 16,7 ms frame budget. The input frame now also builds 5 compare jobs (5 small `JSON.stringify`) and calls `requestCompare`. One run per plan, so I cannot separate this from noise. It is a candidate for 02-14.
- Result latency went up by 2–4 ms at 4×/6×. This matches the design: a main request can wait behind one compare job already in flight (T-02-17). `worker.spec` 'main result is not delayed by the comparison' proves the main result is painted while compare work is still open.
- The verdict (a) worst value comes from the extreme key-by-key run (4×: 66,7 → 63,6 ms; 6×: 83,4 → 130,2 ms). It already failed in 02-06. The jump at 6× comes from one run and is not explained. Judge it in 02-14 / on the phone in 02-15.

## Verification (real output)

- Task 1: `npm run lint` clean; `npm test` 1318/1318; build ok; smoke+worker+results e2e 94/94; also layout/expert/frame/rx 92/92.
- Task 2: `npm run lint && npm test && npm run build && npx playwright test` → 1323/1323 unit, **204/204** e2e.
- Plan end, `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`:
  - First run: lint passed; `test:coverage` **failed 1 test**: `test/bench/compare.test.js` GRENZFALL "Test timed out in 30000ms" (the 02-06 informational bench). Because of `&&`, build and e2e did not run.
  - Run alone under coverage, that test took 15 956 ms.
  - Rerun: `test:coverage` 31/31 files, **1323/1323**, All files 98,47 % stmts (engine 98,1 %); `build` ok; `test:e2e` **204/204**.
  - Logged in deferred-items.md as load margin: no engine or bench file changed in this plan.
- Acceptance greps:
  - `<select id="material"` = 0; `name = 'material'` in material-input.js = 1; tip-index/tip-abbe aria-controls = 2.
  - `isCompareCurrent(` in pipeline.js = 3.
  - `data-stale|dataset.stale` in compare-view.js = 0; `materialRows(` = 1; mm/g arithmetic pattern = 0; `assumed` = 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Compare cache hits could pair new rows with an old selected row.**
- **Found during:** Task 2 design. `requestCompare` answers cached keys synchronously inside the input frame, before the main result for that input is painted.
- **Fix:** `paintCompare` paints only when every computed eye's painted main key equals the requested key. Until then the deliveries stay in `#compare[data-pending]`.
- **Files modified:** src/ui/pipeline.js
- **Commit:** a7f8d80

**2. [Rule 1 - Bug] A hidden 'Ihre Auswahl' tag still counted in the row text.**
- **Found during:** Task 2 GREEN (compare.spec failed on `not.toContain('Ihre Auswahl')`).
- **Fix:** The tag text is written only on the selected row.
- **Commit:** a7f8d80

**3. [Rule 3 - Blocking] worker.spec's layout-shift baseline.**
- **Issue:** The '"rechnet …" marks old values' test took its baseline boxes right after `settled()`. That is now before the material table under the result has filled in.
- **Fix:** The test waits for `settledCompare` before the baseline.
- **Commit:** 066ae02

### Adjusted to the codebase / spec

- **Legend text:** The legend reads 'Material nach Brechungs·index', and the h2 is 'Glasmaterial' (`material.title`). The plan gave 'Glasmaterial' for both. A radio-group legend repeating the h2 adds nothing, and the `tip-index` button sits next to the term it explains.
- **Removed key:** `material.label` was dropped (no users after the select was removed). `material.hint` now uses the UI-SPEC wording.
- **Toggletips:** tip-ct/tip-et are only in the right-eye card, with no table-header buttons (see decisions). This is a reduction from the plan's "and the matching table column headers".
- **Key names:** The plan named `cmp.diff.equalThick` / `.equalWeight`. They are split by direction: `equalThickLighter/Heavier`, `equalWeightThinner/Thicker`. `cmp.pctThicker` is the thicker variant of `cmp.pct`.
- **Per-eye weight column:** Uses its own key `cmp.eyes.col.weight` ('Gewicht', per glass). It is not 'Gewicht (beide)'.

## Known Stubs

- `#cmp-footnote` (index.html) is hidden and empty on purpose. 02-10 fills it when Expert overrides are active (`cmp.footnote` exists).

## Threat Flags

None. No new endpoint, storage or trust boundary. All compare strings are written with textContent (T-02-20). T-02-18, T-02-49, T-02-50 and T-02-51 are mitigated as planned.

## Deferred Issues

- `test/bench/compare.test.js` GRENZFALL can exceed its 30 s timeout under a full parallel `test:coverage` run (deferred-items.md).
- `e2e/worker.spec.js:176` failed once under deliberate double load (deferred-items.md).

## Requirements

- RES-02 marked complete (table + per-eye max edge, absolute differences in words, percentages secondary).
- UX-01 **not** marked: this plan adds Brechungsindex, Abbe-Zahl, Mittendicke and Randdicke tips, but Basiskurve and Dezentration still have none (02-10).

## Self-Check: PASSED

- Files exist: src/ui/material-input.js, src/ui/compare-view.js, e2e/compare.spec.js.
- Commits exist: df624e4, e86baa4, 066ae02, a7f8d80.
