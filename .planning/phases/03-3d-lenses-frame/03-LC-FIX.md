# Phase 3: lens-critic result review, fix report (03-LC)

**Date:** 2026-11-09 · **Base:** edf2dc9 · **Head after the fixes:** 35dd6b9 · **Findings:** 03-LENS-CRITIC-RESULT.md

**Watch first:**
- **M1: the D-04(c) bound is wrong in two places, and lens-critic's restatement is also wrong.**
  - The full grid scan (58 552 computable lenses) finds **10 lenses with nₑ ≥ 1,49 that exceed 0,01 mm below etMax 35 mm**. The first is at etMax 31,1 mm; the worst is 0,0174 mm. So "≤ 0,01 mm where etMax ≤ 35 mm" does not hold either.
  - The worst error as a fraction of local thickness is **0,56 %**. That is over the proposed "0,25 % of local thickness".
  - The test therefore asserts 0,01 mm only up to etMax 31 mm, where it holds over the whole scan. Above that it asserts regression guards, which are not accepted bounds.
  - The tolerance in REQUIREMENTS and CONTEXT is unchanged. **The restated bound needs the user's re-acceptance.**
- **e2e gate: 2 failures in the full run.** Neither is in a file this work changed. Both passed when re-run alone, but `layout.spec.js:302` (360 × 800) is flaky:
  - My build: 2 of 3 runs failed, then 5 of 5 passed.
  - The baseline build edf2dc9: 3 of 8 runs failed.
  - So the flake already existed before this work. It is not fixed here.

## Per finding

| ID | Outcome | Commit | Test |
|---|---|---|---|
| M1 | Code side fixed. The bound itself is open for the user | 35dd6b9 | src/engine/mesh/tessellation.test.js (12 tests) |
| M2 | Fixed | 45781a1 | text.test.js 'comparison: Vorher (A) and Nachher (B) lines'; view-compare.spec.js 'M2 protrusion block' |
| MINOR 2 (A-IN-06) | Fixed | bc3509b | view.spec.js 'A-IN-06 second chunk failure …' |
| MINOR 3 | Fixed (amendment A5) | 69d56e3 | view.spec.js 'MINOR 3 thumbnail guard …'; UX-03 specs now load with ?thumbguardoff |
| MINOR 4 (B-WR-07) | Fixed | cf3242e | view-controls.spec.js 'B-WR-07 MINOR 4 …' (reduced motion), 'MINOR 4 … smooth scroll' |
| MINOR 5 (A-IN-03) | Test added | c3cfc43 | dictionary.test.js 'bevel wording follows BEVEL_RULES[BEVEL_RULE]' |
| MINOR 6 | Fixed | 228ecff | compare.spec.js (360, 320); view.spec.js 'MINOR 6 the prefixed bar label never wraps …' |
| MINOR 8 | Test added | 233ef77 | view-controls.spec.js 'Sph +6: the front-lead text exceeds 4 mm …' |
| MINOR 9 | No change needed | – | – |

### M2: `#view-protrusion` during a comparison

- `paintProtrusion` now runs after the compare state is set.
- While comparing, it shows only the compared eye:
  - a "Vorher (A): …" edge line and lead line, taken from A's result and frame in the compare input;
  - a "Nachher (B): …" edge line and lead line.
- The labels reuse `cmp.cfg.col.a` / `cmp.cfg.col.b`, so no new key was added.
- While A is still computing, only the B pair is shown.
- Outside a comparison, nothing changed: one pair per eye, and a blocked eye leaves its own paragraphs empty.
- Same rule as before: `protrusionCompareLines` shares `bevelSplit`, `frontLeadMm` and the 0,05 mm threshold with `protrusionLines`.
- **Measured** at 1280, comparing CR-39 (A) with 1,74 (B), compared eye OD:

| Line | Protrusion block | Expert rim line |
|---|---|---|
| A edge | Vorher (A): Glasrand hinten 1,6 mm, vorne bündig | Rechtes Glas: hinten 1,6 mm (read before the start) |
| A lead | Vorher (A): Vorderfläche bis zu 0,5 mm | bis zu 0,5 mm |
| B edge | Nachher (B): hinten 0,5 mm, vorne bündig | hinten 0,5 mm |
| B lead | Nachher (B): Vorderfläche nicht vor der Fassung | nicht vor die Fassung |

- **Not added:** the eye name inside the block. The view caption names it ("Rechtes Glas im Vergleich …"). The ordered format was "Vorher (A): …" / "Nachher (B): …", so I kept it.

### MINOR 6: 'Nachher (B):' bar prefix

- New key `bar.prefix.b`. The card config is now 'a', 'b' or null. It is 'b' from 'Variante vergleichen' until 'Vergleich beenden'.
- `fitThumb` now also hides the thumbnail when the label would wrap. This follows the 03-15 rule: hide the thumbnail, never clip numbers. It is a guard only; the label did not wrap at 320 px.
- **Measured** at 320 × 640 with the thumbnail:
  - The label "Nachher (B): Dickste Stelle · Gewicht" and the 'Vorher (A):' label each fit on one line.
  - The values need 205 px of the 240 px available.
  - The bar is 56,6 px tall, `scrollWidth` is 320, and the thumbnail stayed visible.
- Without 3D at 320 px, the prefixed bar is the same height as the plain bar (within 1 px).

### MINOR 3: thumbnail self-timing guard (A5 in 03-CONTEXT.md)

- `scene.js` times each thumbnail frame (pass plus `drawImage`) and hands the time to `onCopy`.
- Rule: if a frame takes more than 50 ms twice in a row, the thumbnail is off for the session. The slot is hidden, `has-thumb` is removed, and the bar keeps its text.
- The 50 ms comes from the W3C Long Tasks API (https://www.w3.org/TR/longtasks-1/, fetched 2026-11-09): "Long task refers to any of the following occurrences whose duration exceeds 50ms".
- The debug hook `thumbInfo().guard` exposes `{ slowRun, tripped, lastMs, frames, thresholdMs, run, off }`.
- **Measured** in headless (SwiftShader): the guard trips at the 2nd thumbnail frame, with lastMs = 631 ms. After that, edits and `requestThumb()` copy nothing.
- **Existing thumbnail specs:** six thumbnail specs (lens view while editing, B-WR-03, the orbit spec, split, 320, MINOR 6) load `./?thumbguardoff`. That flag keeps measuring but never trips, so the specs still prove the thumbnail works. All of them pass.
- **Not changed:** `perf-throttled.spec.js`. Its 412 run now measures the guarded behaviour, which is what users get.

### MINOR 4: B-WR-07

- Tapping '3D drehen' while less than 50 % of the stage is visible now:
  - scrolls the stage into view (`scrollIntoView({ block: 'nearest' })`; `'auto'` under reduced motion, `'smooth'` otherwise);
  - switches on at the observer's next 0,5 crossing, if that comes within 2 s. The 2 s is a [BP] value: longer than a smooth scroll, short enough that a later manual scroll does not switch it on by surprise.
- It still never switches on below 50 %.
- **Measured:** after the tap the stage ratio is ≥ 0,99, `aria-pressed` is true and `touch-action` is none. Scrolling the stage out again switches it off. The smooth-scroll variant passes as well.

### MINOR 2: A-IN-06

- After a second failed chunk import (following 'Erneut versuchen'), the button reads 'Seite neu laden' (new key `view.reload`) and calls `location.reload()`.
- The e2e test aborts the chunk on every request. It checks:
  - the request was aborted ≥ 2 times;
  - the retry button is gone and 'Seite neu laden' is shown;
  - the click reloads the page: a window marker is gone afterwards, and the fresh page offers 'Erneut versuchen' again.
- **Still UNVERIFIED:** Safari's actual caching of failed module imports. The fallback no longer depends on it.

### MINOR 5: A-IN-03

The unit test checks:
- the de-AT wording for each `BEVEL_RULES` fraction exists;
- the current rule is 1/3;
- `frame.rim.bevel` and `disclaimer.body` contain "einem Drittel der Randdicke von vorne";
- no de-AT string names another rule's wording, and every "Drittel" is the current phrase.

`view.protrusion.*` names no fraction today ("Die Aufteilung nach vorne und hinten ist angenommen."). The test covers it through the all-strings rule.

### MINOR 8: plus lens in Seite

With Sph +6 on both eyes and the Seite preset, in both projects:
- `#view-protrusion` lead: R 4,7 mm, L 4,9 mm.
- Expert lead lines: R 4,7 mm, L 4,9 mm.
- The edge lines match too.

### MINOR 9: assumed values

- The chart distance (200 mm) and the earpiece (30°/35 mm) **are not shown in Technische Angaben**. The de-AT dictionary has no string for them, and `CHART_DISTANCE_MM` / `EARPIECE_*` are used only for geometry. Left as is.
- The temple range 110–160 mm stays marked as assumed in both places:
  - UI: `tech.view.templeSource.clamped` "… – angenommener Bereich";
  - code: `frame.js` "[ASSUMED, from memory, unverified …]".
- No citation was invented.

### M1: D-04(c) tessellation, code side

**Full grid scan.** Script: /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/m1/scan.mjs
- Same probe as the test (10 barycentric points per triangle).
- Grid: 4 shapes × sizes 62×55 / 58×50 / 62×40 × DBL 14/18/24 × PD 25/32/40 × Sph −12/−9/−6/−3/+3/+6 × (Cyl 0, or Cyl −3/−6 × axes 0/30/45/60/90/135/170).
- Materials: the 6 listed materials, plus custom nₑ 1,40 (minCT 2 / minET 1,2, as in the test's `custom()`).
- Eye OD only. 58 552 lenses were computable.

**Measured values:**

| Region | Lenses | Worst error | Inputs | etMax |
|---|---|---|---|---|
| nₑ ≥ 1,49, etMax ≤ 31 mm | – | ≤ 0,01 mm (no exceedance) | – | – |
| nₑ ≥ 1,49, etMax ≤ 35 mm | 51 397 (10 over 0,01) | **0,01736 mm** | CR-39 panto 62×40/18 PD 40, −12 −6 × 30 | 34,92 |
| nₑ ≥ 1,49, first exceedance | – | 0,01109 mm | PC panto 62×55/24 PD 40, −12 −6 × 135 | 31,1 |
| nₑ ≥ 1,49, etMax > 35 mm | 879 | **0,10618 mm** | 1,74 rechteckig 58×50/24 PD 25, −12 −6 × 30 | 58,6 |
| custom nₑ 1,40, etMax ≤ 35 mm | 6 171 | 0,01618 mm (all ≤ 0,025) | panto 62×40/24 PD 40, −6 −6 × 45 | 34,25 |
| custom nₑ 1,40, etMax > 35 mm | 105 | **0,04262 mm** | rechteckig 62×55/18 PD 25, −6 −3 × 30 | 57,62 |
| Error / local thickness at the same point | all | **0,559 %** | 1,67 rechteckig 62×55/18 PD 40, −12 −6 × 60 | 34,62 |
| The same, etMax > 35 mm only | – | 0,497 % | 1,60 rechteckig 62×55/24 PD 40, −9 −6 × 60 | 35,62 |

- The two worst cases above 35 mm reproduce lens-critic's numbers (0,106 and 0,0426 mm).
- The exceedances between 31 and 35 mm contradict lens-critic's "below that, every scanned lens met 0,01 mm". The 0,56 % is over the proposed "≤ 0,25 % of the local thickness".

**The test** (`tessellation.test.js`):
- The seeded fuzz is replaced by:
  - a stride-557 sample of the grid per material (7 materials, 18 specs each, offset 41 per material). A separate test checks that the samples together cover every grid value;
  - the 10 full-scan exceedances at etMax ≤ 35 mm and each material's full-scan worst above 35 mm. Each is checked to reproduce its scan value within 1e-4 mm.
- Assertions by region:
  - etMax ≤ 31 mm: ≤ 0,01 mm (≤ 0,025 mm for nₑ < 1,49);
  - 31–35 mm: guard 0,02 mm (low index: 0,025 mm);
  - above 35 mm: guard 0,11 mm (low index: 0,045 mm);
  - everywhere: error / local thickness ≤ 0,6 %.
- The guards are the measured worst values, rounded up. They are **not** accepted bounds.
- The named Expert and low-index sets are unchanged.
- **Runtime:** grid part about 17 s, whole file 19,5 s in `vitest run`.

**Comments corrected:**
- `src/ui/view/tiers.js:5` now says the sag error is measured, not proven, and gives the per-region numbers.
- `src/engine/mesh/topology.js` has no line 220 (the file has 76 lines). The claim was at line 10 ("max sag error 0,0074–0,0078 mm"). It is now scoped to the research lenses and gives the grid numbers.

**Open for the user:** re-accepting a restated D-04(c). With the measured data, a statement that holds would be:
- ≤ 0,01 mm (≤ 0,025 mm for nₑ < 1,49) for etMax ≤ 31 mm;
- otherwise ≤ 0,11 mm absolute, or ≤ 0,6 % of the local thickness.

Lens-critic's 35 mm / 0,25 % version does not hold.

## Gates (one after the other, at 35dd6b9)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | exit 0 · 46 files, 1 799 tests passed · 197,3 s · engine coverage: statements 98,91 % (1367/1382), branches 96,87 %, functions 100 %, lines 99,48 % |
| `GITHUB_SHA=$(git rev-parse HEAD) npm run build` | exit 0 · `index-BxGlQ1YF.js` 143,51 kB (gzip 49,32) · `view-DdOY9def.js` 639,67 kB (gzip 168,64) · `engine.worker` 19,31 kB · `dist/index.html` 47,50 kB · the known > 500 kB warning for the lazy view chunk |
| port 4173 before e2e | `curl` printed `000` |
| `npm run test:e2e` | exit 1 · **563 passed, 2 failed, 37 skipped** (16,8 min) |

**The two e2e failures, re-run alone:**
- **`worker.spec.js:331` "no 'rechnet …' for a normal edit" (desktop).** The status showed 'rechnet …' once under full-suite load. Alone it passed. worker.spec.js is not changed by this work.
- **`layout.spec.js:302` "the arriving cross-section does not move the disclaimer".** It failed at 1280 in the full run.
  - Alone, 1280 passed. 360 × 800 failed 2 of 3 runs, then passed 5 of 5.
  - The baseline build edf2dc9, served on port 4192 with BASE_URL and running the same unchanged spec, failed 3 of 8 runs.
  - Cause: a timing race. The test delays the profile by 1 500 ms and expects it still pending after the Expert switch and an input frame, but SwiftShader frames of the loading 3D view (about 0,6–1 s) can use up that time.
  - It was flaky before this work and was not fixed here.

**D-27** (view-memory alone, desktop):
- After the warm-up: geometries 21, textures 6, programs 11, allocPage 10, allocWorker 0.
- After 56 changes: identical, so 21/6/11 is confirmed.

**Time to view ready at 412 × 915:**
- Method: goto → `#view[data-pending]=''`, fresh context per run, 1 warm-up run discarded, median of 5.
- Server: `vite preview` on port 4193, build 35dd6b9.
- Results: run 1 median **3,37 s** (3,35–3,43); run 2 median **3,36 s** (3,32–3,41). 03-REVIEW-FIX measured 3,33–3,35 s.

**Not done:**
- no push;
- STATE.md and ROADMAP.md not touched;
- port 4180 left running.
