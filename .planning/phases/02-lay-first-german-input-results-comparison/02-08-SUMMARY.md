---
phase: 02-lay-first-german-input-results-comparison
plan: 08
subsystem: ui-compare, pipeline, compare-rows, e2e-harness
tags: [configuration-comparison, compare-lane, RES-03, D-28, D-29, deflake, e2e, tdd]
requires: ["02-07", "02-06", "02-02"]
provides:
  - "compare.js: displayedValues(res) -> { thick, ct, weight } | null; configDiff(A, B) -> { rows: [thickOD, thickOS, ctOD, ctOS, weightBoth], summary: { eye, thickDiffMm, weightDiffG, same, partial } | null }"
  - "compare-view.js: renderConfigCompare({ config, A, B, same }), setConfigActive(on); config cells take part in setCompareStale/markOutdated"
  - "pipeline.js: configA job ('configA:' + JSON key) queued first on the compare lane; #compare[data-pending] token configA; cardMaterialId(id); #cmp-show toggle paints the cards from A or B"
  - "e2e/helpers.js: holdWorker(page) -> { hold(), release() } (test-controlled busy window)"
affects: [02-10 (Expert overrides on the A job), 02-13 (cross-section A/B overlay uses configA), 02-14/02-15 (ENG-09 with the comparison active), phase 3 (3D view follows #cmp-show)]
tech-stack:
  added: []
  patterns: [frozen configuration as one more compare-lane job, cards repainted from the selected configuration, test-held worker messages instead of timers]
key-files:
  created:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-08-SUMMARY.md
  modified:
    - src/state/compare.js
    - src/state/compare.test.js
    - src/ui/compare-view.js
    - src/ui/pipeline.js
    - src/ui/main.js
    - src/ui/style.css
    - index.html
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/compare.spec.js
    - e2e/helpers.js
    - e2e/worker.spec.js
    - test/bench/compare.test.js
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "[02-08]: A and B are both converted from LensResults with displayedValues (the card rounding), not from results.js `displayed`: while 'Vorher' is shown the cards hold A, so `displayed` cannot be B's source."
  - "[02-08]: The A job has its own key prefix 'configA:'. It never shares a delivery with a material row of the same specs (e.g. A = same frame in 1,50 while B is 1,74)."
  - "[02-08]: While 'Vorher' is shown, main deliveries update `shown` but do not repaint the cards. The cards are marked stale until A for the same input is painted (T-02-21)."
  - "[02-08]: The 'noch gleich' sentence is decided by configuration equality (frame + material of the current request equal A's), not by equal numbers. Equal numbers with a changed configuration get 'gleich dick und gleich schwer wie' sentences."
  - "[02-08]: #cmp-config-table stays a real table on every width (UI-SPEC: a two-value table fits 288 px). Below a 480 px container only the Unterschied column is dropped, and the difference shows as a 14 px line under B. So the plan's .cell-label spans are not used."
  - "[02-08]: Test busy windows are held by the test (holdWorker), not by timers, whenever the test does unbounded work (axe) inside the window."
metrics:
  duration: ~80 min
  completed: 2026-11-07
  tasks: 3 (orchestrator deflake + 2 plan tasks)
  files: 14
---

# Phase 2 Plan 08: Two-configuration comparison (Vorher / Nachher) Summary

"Variante vergleichen" freezes the current frame and material as Vorher (A). The user then changes frame or material, and that becomes Nachher (B). A sentence and a side-by-side table show the difference in mm and g on every width. A segmented "Vorher | Nachher" toggle switches the full result cards and the phone bar. A runs on the 02-06 compare lane, queued first, with the current (shared) Rx, so the main result keeps its priority.

## What to watch first

- **Desktop: the sticky results column covers the disclaimer box ('Wichtiger Hinweis') when the page is scrolled to the bottom.** At 1280 × 800, `.col-results` spans y −52,7…715,3 px and `#disclaimer` starts at 350,3 px. The 02-07 build shows the identical overlap, so this plan did not cause it. It is not fixed because it belongs to the 02-02 layout. The disclaimer is RES-06 content, so fix it in 02-14 or put it to lens-critic. Logged in deferred-items.md.
- **A third load-sensitive test.** `properties.test.js` MAT-02 monotonicity takes 44,6 s of its own 60 s timeout in an unloaded `test:coverage` run. It failed at 72,0 s with 4 CPU burners. CI runs `test:coverage`, so this is the next likely deploy-blocking flake. Not fixed (engine test, out of scope). Logged.
- **ENG-09 medians a little higher.** See the A/B below. On an idle comparison, the 4× input-frame median is 15,55 / 17,5 ms against 15,0 / 15,0 ms for the 02-07 build in the same session. n = 2, so this is not separable from noise, but the 16,7 ms budget is at stake. Candidate for 02-14.

## Deflake (orchestrator task, `367fd78`)

| Test | Cause (measured) | Fix | Proof |
|---|---|---|---|
| `test/bench/compare.test.js` GRENZFALL | Under v8 coverage one run (6 materials × 2 eyes) takes ~530 ms; 5 + 50 fixed runs = **29 224 ms** of the 30 000 ms timeout in an unloaded full `test:coverage` (JSON reporter) | Measured loop capped by `BENCH_RUNS` **or** a 6 s wall-time budget (≥ 5 runs), run count printed; without coverage still 50/50 runs (median 88,4 ms) | Full `test:coverage`: unloaded **8 915 / 8 760 ms**, 4 burners **10 536 ms**, 8 burners + parallel Playwright **11 241 ms**. The bench always passed |
| `e2e/worker.spec.js` '"rechnet …" marks old values' | The busy window was a 2000 ms `slowWorker` timer; under load the axe scan inside it outlasted the timer | `holdWorker(page)`: the worker queues `result` messages while held; the test releases them after axe. Same assertions and quick timeouts | Same load (coverage + 8 burners, `--repeat-each=15 --workers=8`): before **29/30 failed**, after **30/30 passed** |

Benches stay in the coverage run, so CI keeps their correctness assertions. That was the established pattern (`vite.config.js` has one `unit` project, and `test:coverage` runs it).

## What was built

- **Task 1 RED (`96690bb`) / GREEN (`b83d311`):** `displayedValues` and `configDiff` in `src/state/compare.js`. Codes and numbers only; diff = b − a on display-rounded values.
  - The summary eye is B's thicker eye (tie → OD), compared with the same eye in A.
  - An eye missing in A or B fails its rows and makes the weight and summary partial.
  - 11 unit tests failed at RED; 58/58 pass.
- **Task 2 (`d10733f`):**
  - `#cmp-config` contains: the idle h2, the help text and `#cmp-start` (the only `.btn-primary`); then `#cmp-a-status`, `#cmp-diff` (tabindex −1, focused on start; its text is written before the focus), `#cmp-config-table`, the `#cmp-show` segmented radios with check icons, and `#cmp-end`.
  - The A job is rebuilt on every changed main request and on start, which covers Rx edits (D-28).
  - The toggle repaints the cards and the summary bar from A's or B's LensResults through `renderResult`. Each card h3 gets ' – Vorher (A)' and the material line names A's material.
  - 'Vergleich beenden' keeps B, resets the toggle to Nachher and focuses `#cmp-start`.

Page values, checked by e2e on desktop and mobile (engine 2026-11-07):

| Case | Vorher (A) | Nachher (B) | Sentence / check |
|---|---|---|---|
| Example, A 1,50 → B 1,74 | R/L 4,6 mm, Mitte 1,8 mm, 14 g | 3,0 mm, 1,1 mm, 10 g | 'Nachher (B) ist an der dicksten Stelle 1,6 mm dünner und insgesamt 4 g leichter als Vorher (A).' |
| Plus R +3,00 / L +2,75 | R 3,9 / L 3,7 mm, 14 g | R 3,0 / L 2,9 mm, 12 g | '0,9 mm dünner', '2 g leichter' (centre; edge-only would be 0,6) |
| Example, then R −4,00 | R 5,9 mm | R 3,8 mm | '2,1 mm dünner'; with 'Vorher' shown the cards follow the Rx (5,9 → 4,6 mm on −2,75) |
| Toggle | 'Vorher': #result-od-thick 4,6 mm, bar '4,6 mm · 7 g', material CR-39 | 'Nachher': 3,0 mm, bar '3,0 mm · 5 g', 1,74 | both ways |
| Start without a change | – | – | 'Nachher ist noch gleich wie Vorher. Ändern Sie Fassung oder Material.' |

## ENG-09 (informational, `npm run test:perf`, 4× CPU proxy, case A, comparison idle)

The machine was busier than in 02-07 (load average about 5; the 02-07 build itself measured worse than its own baseline). So I ran an interleaved A/B in the same session: the 02-07 build was served from an archived copy on port 4174, and runs alternated old/new/old/new.

| Run | Input frame median / max | Result median / max | compareFrame median / max |
|---|---|---|---|
| 02-07 baseline (perf-0207.json) | 15,35 / 16,50 ms | 32,45 / 37,5 ms | 6,55 / 7,5 ms |
| 02-07 build, run 1 / 2 | 15,0 / 24,7 · 15,0 / 16,6 ms | 34,3 / 50,9 · 34,8 / 37,8 ms | 7,35 / 14,6 · 7,3 / 8,6 ms |
| 02-08 build, run 1 / 2 | 15,55 / 18,9 · 17,5 / 30,7 ms | 36,15 / 44,1 · 37,65 / 51,8 ms | 7,7 / 9,0 · 8,1 / 13,1 ms |
| 02-08 first single run (perf-0208.json) | 17,55 / 28,3 ms | 41,2 / 65,6 ms | 10,6 / 16,4 ms |

- Medians, new − old, paired: input +0,55 / +2,5 ms, result +1,85 / +2,85 ms, compare +0,35 / +0,8 ms. The maxima scatter both ways: the old build's run 1 input max of 24,7 ms is higher than the new build's 18,9 ms.
- The perf spec never starts the configuration comparison. The new per-frame code on that path is constant work: specA reset, one extra Set token check, and markConfig querying about 16 nodes when the stale state changes. The larger DOM and the new `:has()` rules are other candidates. None of this is proven.
- Raw files: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/perf-0208.json` and `.../scratchpad/perfab-{old,new}-{1,2}.json`.

## Verification (real output)

- Task 1: `npx vitest run src/state/compare.test.js`: 58/58. The new e2e cases failed before the UI existed (desktop: 7 failed).
- Task 2: `npm run lint` clean; `npm test` **1337/1337**; build ok; full `npx playwright test` **218/218**. After the stale-mark addition: compare + worker + results + layout **92/92**.
- Plan end, `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` → **chain rc=0**:
  - lint clean;
  - **31/31 files, 1337/1337 tests**, All files 98,47 % stmts / 96,42 % branch / 100 % funcs / 99,18 % lines;
  - `✓ built in 126ms`;
  - **220 passed** e2e.
- Acceptance greps: `export function configDiff` = 1; `id="cmp-start"` = 1; `btn-primary` in index.html = 1; `configDiff(` in compare-view.js = 1; `dataset.pending` in compare-view.js = 0; `configA` in pipeline.js present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cards labelled 'Vorher (A)' could show B's values while A was still computing (T-02-21).**
- **Found during:** Task 2 review.
- **Fix:** in that state the card values are marked `data-stale` until A for the current input is painted. New e2e test with a slow compare lane.
- **Files modified:** src/ui/pipeline.js, e2e/compare.spec.js
- **Commit:** d10733f

**2. [Rule 1 - Bug, test] Navigation race in compare.spec 'comparison lane'.**
- **Found during:** Task 2 e2e runs: 1/20 failed with `net::ERR_ABORTED …engine.worker-….js`. The unchanged 02-07 build failed 2/40, so the race is pre-existing.
- **Fix:** `settled()` before the second `goto`, as expert.spec already does. Result: 40/40.
- **Commit:** 8ca5820

**3. [Rule 1 - Bug] Numbers broke inside ('4,6 m m') in the 320 px config table.**
- **Found during:** a screenshot check.
- **Fix:** `.cmp-config-table .cmp-val { white-space: nowrap }`.
- **Commit:** d10733f

**4. [Rule 2] The A job key has its own prefix (see decisions).**
- Without it, A and the 1,50 material row deliver under one key and only one of them is applied.

### Adjusted to the codebase / spec

- **No changes to results.js, summary-bar.js, frame-input.js, material-input.js.** `renderResult` / `renderFailed` already paint a card and the bar from any LensResult. The frozen config comes from main.js's last `readFrame()` (`lastFrame`) through a `currentConfig` hook, because calling `readFrame()` again rewrites fields.
- **Partial result.** It gets an extra sentence `cmp.config.partial` ('Verglichen wird nur das rechte Glas; …'), not the card's failure wording. A missing eye can mean "not entered", and then 'Berechnung abgebrochen' would be false.
- **Sentence keys.** UI-SPEC gives one sentence. German needs 'als' for comparatives and 'wie' for equality, so there are four sentences: `cmp.config.diff`, `.diffEqualThick`, `.diffEqualWeight` and `.equal`. Their words come from `cmp.config.word.*`, and the table cells use `cmp.cfg.diff.*`.

## Known Stubs

None. Every new element is fed. In sync fallback mode A waits for 'Vergleich berechnen', as the material rows do; its cells stay marked until then.

## Threat Flags

None. No new endpoint, storage or trust boundary.
- T-02-21: the card title suffix, values in both directions (e2e) and stale marks while A is computing.
- T-02-22: A is one pair per job on the same lane. The main lane is untouched, and worker.spec 'main result is not delayed' passes.
- T-02-23: shape and material names come from the dictionary, numbers from Intl/format.js, and all text is written with textContent.

## Deferred Issues

See deferred-items.md "From 02-08":
- the MAT-02 property-test timeout margin, plus the other engine property tests under heavy load;
- the sticky-column overlap of the disclaimer at desktop width.

## Requirements

- RES-03 **not** marked complete. The requirement says "in numbers and in the views". The numbers part (sentence, table and card toggle on every width) is done, but the A/B cross-section overlay (02-13) and the 3D view (phase 3) are not built yet.

## Self-Check: PASSED

- FOUND: src/state/compare.js (configDiff, displayedValues), src/ui/compare-view.js (renderConfigCompare), index.html #cmp-config, e2e/helpers.js holdWorker, deferred-items.md "From 02-08".
- FOUND commits: 367fd78, 96690bb, b83d311, 8ca5820, d10733f.
