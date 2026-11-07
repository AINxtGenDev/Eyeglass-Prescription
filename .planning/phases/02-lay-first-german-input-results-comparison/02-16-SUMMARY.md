---
phase: 02-lay-first-german-input-results-comparison
plan: 16
subsystem: results (lay card + headline) + compare module
tags: [RES-01, lens-critic-B1, gap-closure, thinnest-point]
requires: [02-14]
provides:
  - "src/state/compare.js thinnest(m) = min(CT, etMin) (tie → centre) and evenThickness(m)"
  - "Card cell 'Dünnste Stelle' (#result-{eye}-thin, -thin-loc) and headline {thin}/{thinLoc} from thinnest(m)"
  - "Secondary card line #result-{eye}-thin-edge 'Rand ab {etmin}' under a centre thinnest point"
  - "Zwischenwert 'Dünnster Rand' (#result-{eye}-etmin, -etmin-loc) after 'Dickster Rand'"
  - "Uniform edge: both Zwischenwert edge rows read 'am ganzen Rand' (amendment m-b); even thickness: both card locations 'überall gleich'"
affects: [src/ui/results.js, src/ui/expert.js, index.html, src/i18n/de-AT.js, src/i18n/dictionary.test.js, e2e/results.spec.js, e2e/smoke.spec.js, e2e/expert.spec.js, e2e/perf-throttled.spec.js, 02-UI-SPEC.md]
tech-stack:
  added: []
  patterns:
    - "Every lay 'thinnest/thickest point' derived only in src/state/compare.js; the UI never reads etMin.value for the thinnest point"
key-files:
  created: []
  modified:
    - src/state/compare.js
    - src/state/compare.test.js
    - src/ui/results.js
    - src/ui/expert.js
    - index.html
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/results.spec.js
    - e2e/smoke.spec.js
    - e2e/expert.spec.js
    - e2e/perf-throttled.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md
decisions:
  - "Card keeps four lay values (Dickste Stelle, Dünnste Stelle, Mitte, Gewicht); the thinnest edge is the Zwischenwert 'Dünnster Rand' plus a short 'Rand ab …' line under a centre thinnest point, not a fifth card value (phone page length, lens-critic m7)"
  - "thinnest(m) tie CT = etMin → 'centre', mirroring thickest(m)"
  - "Card id etmin renamed to thin so every id keeps one meaning; #result-{eye}-etmin now always means the thinnest EDGE (Zwischenwert)"
metrics:
  duration: "~14 min"
  completed: 2026-11-07
  tasks: 2
  files: 12
---

# Phase 2 Plan 16: Thinnest point = min(CT, thinnest edge) (lens-critic B1) Summary

The lay "Dünnste Stelle" and the headline "am dünnsten" now come from `thinnest(m) = min(CT, etMin)`. On the example page it reads "am dünnsten 1,8 mm in der Mitte" instead of the wrong "3,0 mm oben". The thinnest edge is still shown: as "Rand ab 3,0 mm" on the card and as the "Dünnster Rand" Zwischenwert.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 RED | failing tests for thinnest point | 8d10871 |
| 1 GREEN | thinnest(m), evenThickness(m) | d6a946a |
| 2 | card, headline, Zwischenwert, e2e re-pins, UI-SPEC | 3d19083 |

## Choice for lens-critic to weigh

The card keeps the four RES-01 lay values. The thinnest edge does not become a fifth card cell. It appears (a) as a secondary line "Rand ab {etmin}", shown only when the thinnest point is the centre and the displayed edge value differs, and (b) as the Zwischenwert "Dünnster Rand", right after "Dickster Rand". Why: the centre is already on the card, and lens-critic m7 already calls the phone page long.

## Page values (read from the built page with a temporary probe spec that was then deleted)

| Case | Dickste Stelle | Dünnste Stelle | Rand ab | Dünnster Rand (ZW) | Dickster Rand (ZW) | Headline |
|---|---|---|---|---|---|---|
| Example OD | 4,6 mm außen oben | 1,8 mm in der Mitte | 3,0 mm | 3,0 mm oben | 4,6 mm außen oben | Rechtes Glas: am dicksten 4,6 mm außen oben, am dünnsten 1,8 mm in der Mitte. Mitte 1,8 mm, Gewicht 7 g. |
| Example OS | 4,6 mm außen oben | 1,8 mm in der Mitte | 3,0 mm | 3,0 mm oben | 4,6 mm außen oben | Linkes Glas: … am dünnsten 1,8 mm in der Mitte. Mitte 1,8 mm, Gewicht 7 g. |
| +3,00 / +2,75 | 3,9 / 3,7 mm in der Mitte | 1,0 mm außen oben | hidden | 1,0 mm außen oben | 2,8 / 2,7 mm oben | Rechtes Glas: am dicksten 3,9 mm in der Mitte, am dünnsten 1,0 mm außen oben. Mitte 3,9 mm, Gewicht 7 g. (unchanged) |
| Plano 0,00 (Rechteckig) | 1,8 mm überall gleich | 1,8 mm überall gleich | hidden | 1,8 mm am ganzen Rand | 1,8 mm am ganzen Rand | Rechtes Glas: Rand ringsum 1,8 mm dick, Mitte 1,8 mm. Gewicht 4 g. |
| rund 50/50 PD 34 −3,00 | 3,7 mm am ganzen Rand | 1,8 mm in der Mitte | 3,7 mm | 3,7 mm am ganzen Rand | 3,7 mm am ganzen Rand | Rechtes Glas: Rand ringsum 3,7 mm dick, Mitte 1,8 mm. Gewicht 7 g. (unchanged) |

## e2e pins old → new

- results.spec.js example: `#result-{eye}-etmin` 3,0 mm / 'oben' (card) → `#result-{eye}-thin` 1,8 mm / 'in der Mitte' + `-thin-edge` 'Rand ab 3,0 mm'. `#result-{eye}-etmin` 3,0 mm / 'oben' is kept, now as the Zwischenwert.
- results.spec.js headlines: "…am dünnsten 3,0 mm oben…" → "…am dünnsten 1,8 mm in der Mitte…" (both eyes).
- results.spec.js uniform-edge test: kept "Rand ringsum 3,7 mm". Added `#result-od-thin` 1,8 mm 'in der Mitte', 'Rand ab 3,7 mm' and `-etmax-loc` 'am ganzen Rand' (m-a, m-b).
- results.spec.js new tests: a plus lens keeps the edge (1,0 mm außen oben, no 'Rand ab'); plano gives 'überall gleich' in both cells, with no location word carrying two values.
- presets.spec.js Weitsichtig headline: unchanged, passes as is.
- smoke.spec.js PLUS_CYL_VALUES / CELLS: `#result-od-etmin` 1,0 mm → `#result-od-thin` 1,0 mm (the edge is the thinnest point here). Comment updated: the −2,00 start now shows thin 1,8 mm.
- expert.spec.js uniform edge: added `-etmax-loc` 'am ganzen Rand (rundum gleich)' and `-thin-loc` 'in der Mitte (optischer Mittelpunkt)'. cardValues: etmin → thin.
- perf-throttled.spec.js OD_CELLS: added 'thin' (etmin is kept as the Zwischenwert).

## Consumer check (grep evidence)

`grep -rn "etMin" src/ui src/state --include=*.js | grep -v "\.test\.js"`:
```
src/ui/results.js:241:  const etmin = fmtMm(m.etMin.value);          (uniform-edge headline + 'Rand ab' line: the EDGE, by design, m-a)
src/ui/results.js:250:    thin: … edgeLoc(m.etMin.location),          (location code only)
src/ui/results.js:251:    etmin: edgeLoc(m.etMin.location),            (Zwischenwert location)
src/ui/expert.js:310:  setText(`${p}-etmin`, fmtMm(m.etMin.value));   ('Dünnster Rand' Zwischenwert)
src/state/compare.js:31-32 thinnest, :50 uniformEdge (+ doc comments)
```
After amendment m-a, the single `m.etMin.value` read in results.js feeds only the uniform-edge headline ("Rand ringsum {etmin}") and the "Rand ab {etmin}" line. The card cell and the headline thinnest value come from `thinnest(m)` (`grep -c "thinnest(m)" src/ui/results.js` = 1).

L/R callout, summary bar, material rows, configDiff and compare-view are unaffected. `displayed[eye]` (results.js:277) holds `roundMm(th.value)` from thickest. `lrDifference` (results.js:289) reads `displayed`. The bar reads `thickText`. `materialRows`, `displayedValues` and `compare-view.js:215` call `thickest(...)` only. None of them reads etMin.

Other acceptance greps: `export function thinnest` 1, `export const evenThickness` 1, "am dünnsten 1,8 mm in der Mitte" in results.spec 2, "am dünnsten 3,0 mm oben" 0, `'expert.zw.etmin'` 1, `result-od-etmin"` 1, `result-od-thin"` 1, innerHTML/outerHTML/insertAdjacentHTML in src/ui 0 (T-02-53).

## Verification (real output)

- `npx vitest run src/state/compare.test.js -t "RES-01"`: 8 passed, 59 skipped. RED before GREEN: 8 failed (`thinnest is not a function`) at 8d10871.
- Full gate `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`: exit 0. Output: Test Files 34 passed, Tests 1573 passed; coverage All files 98.34 % stmts / 96.52 % branch / 100 % funcs / 99.15 % lines, engine 98.01 / 96.07 / 100 / 98.98; `✓ built in 160ms`; e2e `340 passed (2.1m)` (desktop + mobile).
- perf-throttled.spec.js runs only with `PERF=1` (`npm run test:perf`), so its one-word OD_CELLS change was not executed in this gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dictionary.test.js placeholder pin**
- **Found during:** Task 2
- **Issue:** `result.headline placeholders` pinned `etmin`/`etminLoc`. The plan renames them to `thin`/`thinLoc`.
- **Fix:** Re-pinned the placeholders. Added a test for `result.label.thin`, `expert.zw.etmin`, `result.thinEdge`, `loc.even` and `loc.tech.even`.
- **Files modified:** src/i18n/dictionary.test.js (not in the plan's files list)
- **Commit:** 3d19083

**2. [Amendment] 'Rand ab {etmin}' line implemented**
- The plan amendment asked for it. It needed a new key `result.thinEdge` and the span `#result-{eye}-thin-edge` (hidden when empty). The span is also stale-marked by setStale.

### Notes
- `'result.etmin': 'Dünnste Randdicke'` was already unused before this plan (no reader in src). This plan did not orphan it, so it was left in place as instructed.
- presets.spec.js needed no change (its plus headline still passes).

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/state/compare.js thinnest/evenThickness; 02-16-SUMMARY.md
- FOUND commits: 8d10871, d6a946a, 3d19083
