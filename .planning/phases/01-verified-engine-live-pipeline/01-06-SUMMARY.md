---
phase: 01-verified-engine-live-pipeline
plan: 06
subsystem: engine-materials
tags: [materials, zeiss-fixture, eng-08-tier-2, material-select, trivex]
requires:
  - 01-02 engine (solveCT, sphereSag, thicknessAt, circleOutline, MATERIALS.cr39)
  - 01-03 German page and smoke contract
  - 01-05 live Pages pipeline
provides:
  - MATERIALS with six cited rows (cr39, trivex, pc, idx160, idx167, idx174)
  - test/fixtures/zeiss-fsv-6-23-cr39-spherical.json (143 rows, provenance, ctTolerance)
  - test/fixtures/zeiss.js (loader, toolToTrue, toolCurvature)
  - ENG-08 tier-2 tests (a)(b)(c) plus a thin-lens discriminator
  - "#material select and #result-{od,os}-material lines on the page"
affects: [01-07, 01-08, 01-09, 01-10, 01-11]
tech-stack:
  added: []
  patterns:
    - "Material constants are frozen rows with source {doc, url, page} and optional assumed[]"
    - "Fixture rows are machine-compared with pdftotext output before they are frozen"
key-files:
  created:
    - test/fixtures/zeiss-fsv-6-23-cr39-spherical.json
    - test/fixtures/zeiss.js
    - test/fixtures/zeiss.test.js
  modified:
    - src/engine/materials.js
    - src/engine/materials.test.js
    - index.html
    - src/ui/main.js
    - src/ui/style.css
    - src/i18n/de-AT.js
    - e2e/smoke.spec.js
decisions:
  - "[01-06]: Trivex Abbe 45/45 from Z00981.FS1 (pdf p.77). The 00617.FS1 value 58/56 (pdf p.84) equals CR-39 and is treated as a copy error; it is recorded in a comment."
  - "[01-06]: No requirement marked complete. MAT-01's full text says the engine uses the Abbe number, but Abbe is only recorded, not consumed. MAT-02 needs the Expert view, ENG-02/04 need cyl and mixed-sign meridians, and ENG-08 needs tiers 3 and 4."
  - "[01-06]: All 143 Zeiss rows (in Appendix A) match the pdftotext output of fsv2023.pdf pdf p.129–130/137–138/145–146 exactly (0 mismatches). The fixture records this in provenance.verified."
metrics:
  duration: 7min
  completed: 2026-11-06
  tasks: 3
  files: 10
---

# Phase 1 Plan 06: Materials and Zeiss Manufacturer Validation Summary

The six Zeiss materials are now in the engine with cited e-line indices (CR-39 1,50, Trivex 1,53, PC 1,59, 1,60, 1,67, 1,74). Each has its own density and minimum thicknesses. The thick-lens engine reproduces all 143 Zeiss CR-39 spherical chart rows within ±0,20 mm and ±0,05 dpt, while a thin-lens solver misses by 0,375 mm. Users pick the material from a German select on the page.

## Results

**ENG-08 tier 2 worst residuals (143 rows, from the test's `console.info`):**

| Tier | Worst residual | Tolerance |
|---|---|---|
| (a) ET from published CT and curves | 0.069 mm | ±0.20 mm |
| (b) BVP from curves (1.530 → ne 1.500) | 0.023 dpt | ±0.05 dpt |
| (c) full set, solveCT | CT 0.072 mm, ET 0.081 mm | ±0.20 mm |
| (c) CT-solver subset (plus rows at sheet-minimum ET, binding minET), n = 51 | CT 0.072 mm, ET 0.000 mm | ±0.20 mm |
| Thin-lens discriminator, d 75, F +4.00 | CT miss 0.375 mm | must be > 0.30 mm |

Honesty note: in the subset the ET residual is 0 by construction, because minET = ET_row binds. The solver evidence in the subset is the CT residual (0.072 mm). In the other 92 rows CT equals CT_row by construction (binding minCT), so those rows only repeat check (a) through the solver's own surfaces. ±0.20 mm is a project choice. It is stricter than the Zeiss CT tolerance (±0.30 mm plus, +0.30/−0.20 mm minus), which is recorded in `provenance.ctTolerance`.

**Material effect, same −4,00, round 50 mm, PD 32 (computed with evaluateLens):**

| id | CT mm | ET max mm | weight g |
|---|---|---|---|
| cr39 | 1.80 | 4.77 | 7.98 |
| trivex | 1.50 | 4.29 | 5.90 |
| pc | 1.50 | 4.00 | 6.08 |
| idx160 | 1.20 | 3.67 | 5.83 |
| idx167 | 1.20 | 3.42 | 5.72 |
| idx174 | 1.10 | 3.09 | 5.66 |

## Source re-verification (2026-11-06)

Both PDFs downloaded to the session scratchpad with a browser User-Agent (HTTP 200: fsv2023.pdf 6,295,405 B, clearview-lensspec.pdf 3,570,432 B) and read with `pdftotext -layout`. They are not committed and not fetched at test time.

- Trivex: matches the planner's pre-read exactly. Z00981.FS1 pdf p.77: nd 1.527, ne 1.530, νd 45, νe 45, 1.11 g/cm³. Z00982.FS1 pdf p.80 gives the same values. pdf p.79 has "70 mm Minus Range … Minimum CT 1.5 mm", and the 65 mm plus rows have ET 1.0. The 00617.FS1 conflict (Abbe 58/56) is confirmed on pdf p.84.
- pc (pdf p.66/69), idx160 (clearview pdf p.31, 33–34; 1.30 alternative on p.47), idx167 (pdf p.7, 10) and idx174 (pdf p.4, 6) all match the RESEARCH table.
- Extra observation, recorded in a comment: the 1.67 sheet's 65 mm plus rows show ET 1.05 (pdf p.9). The code keeps the planned assumed minET of 1.0 (A5).
- Zeiss CT tolerances on pdf p.129/137/145 match the plan text.

## Deviations from Plan

### Orchestrator-requested

**1. Suppress the root favicon 404 on Pages (unblocks DEPL-01)**
- **Issue:** On the live site, the browser's automatic request to `https://ainxtgendev.github.io/favicon.ico` returns 404 and logs a console error (01-05 check).
- **Fix:** Added `<link rel="icon" href="data:,">` to the `<head>` of index.html. The existing CSP allows it (`img-src 'self' data:`). `npm run build` keeps it in `dist/index.html` (line 8), and all 16 e2e tests pass.
- **Not verified locally:** headless Chromium in the local e2e run does not request a favicon, so the effect needs the live check after the next deploy. DEPL-01 is left for the orchestrator.
- **Commit:** 39882ef

### Auto-fixed / adjusted

**2. [Rule 2 - Accessibility] Touch-sized select styling**
- `src/ui/style.css` is not in files_modified. I added a `select` rule (44 px minimum height, same border and colours as the inputs) and a block label, so the new control meets the existing touch-target and contrast conventions. The material hint and lines use the muted colour (8.9:1).
- **Commit:** 39e8088

**3. Material hint text (`material.hint`)**
- I added one sentence under the select: a higher index makes minus lenses thinner at the edge, and whether that is worth it depends on the values and the frame. This follows PITFALLS "Index" ("never imply 1,74 is always better"). It contains no "Stärke".

**4. Fixture provenance names all three Zeiss docs**
- The plan names doc 00523.FS1 only. The PDF shows 00523.FS1 (75 mm), 00525.FS1 (70 mm) and 00564.FS1 (65 mm), so the `source` lists all three. The pages give both the doc and the pdf page numbers. I also added `provenance.verified`.

**5. Acceptance grep `'"Trivex 1,53"'` prints 0**
- The dictionary uses single-quoted JS strings throughout (`'material.trivex': 'Trivex 1,53'`). `grep -c "'Trivex 1,53'" src/i18n/de-AT.js` prints 1. I kept the file's style. The e2e test asserts the "Trivex 1,53" option text, so the intent of the check is met.

**6. Material line carries the eye name**
- `result.materialLine` is `'{eye}: {label}, Dichte {density}'`. The `{eye}` param tells the two per-eye lines apart for screen readers. Density is formatted with `Intl.NumberFormat('de-AT', { minimumFractionDigits: 2 })` plus " g/cm³" as a param.

## TDD Gate Compliance

- Task 1: RED b211c7a (10 of 13 tests failing) → GREEN c486a63.
- Task 2: RED fb5aa25 (suite fails, because the loader is missing) → GREEN 7416566. This tier validates engine code that already exists (01-02), so the GREEN step adds the fixture and loader, not engine code. No engine constant or tolerance was changed to make rows pass.

## Verification

- `npm run lint`: exit 0
- `npx vitest run --coverage`: exit 0, 639 unit tests, engine lines 97.91 %, branches 96.93 %
- `npm run build && npm run test:e2e`: 16 passed (desktop + mobile), including "material choice changes thickness"
- Acceptance greps: `zeiss.com` 6, `Z00981.FS1` 3, `assumed` 3, `Z01539.FS1` 2 in materials.js; fixture rows 143, `ctTolerance` 1, `−0.25…−6.00 (pdf p.145)` 1; `id="material"` 1, `for="material"` 1, `Stärke` 0.

## Known Stubs

None. The frame (round 50 mm, DBL 18, PD 32) is still the documented skeleton limit, lifted in 01-08/01-09.

## Self-Check: PASSED
