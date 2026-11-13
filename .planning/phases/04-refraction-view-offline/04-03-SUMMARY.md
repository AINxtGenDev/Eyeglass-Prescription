---
phase: 04-refraction-view-offline
plan: 03
subsystem: engine
tags: [optics, warp-grid, ray-trace, aperture, quadtree, P0, vitest, fast-check, playwright]

requires:
  - phase: 04-01
    provides: trace.js traceFromEye + TRACE_STATUS, magnification.js EYE_POINT_MM, LensResult.magnification
  - phase: 04-02
    provides: production build / preview scripts used by measure-stages.mjs
provides:
  - "outline-geom.js: insideOutline, signedDistanceToOutline, outlineRadii"
  - "warp.js: REF_CLASS, OBJ_TAN_MAX, FIELD_HALF_ANGLE_DEG (30, P0), REF_GRID_TIERS (6/1, 8/2, 10/3, P0), effectiveLeafPx, CELL_DIAGONAL 'sw-ne', prepareWarp, classifyDirection, warpGrid"
  - "scripts/measure-stages.mjs (real #view-stage sizes), scripts/p0-feasibility.mjs (P0 sweep)"
  - "04-P0-RESULTS.md: measured stages, G1/G2 criteria, k, tiers, timing/rays, visibility, rim widths, CI literals"
  - "warp.test.js CI gates: 'REF-01 P0 CI subset' (7 cases), 'REF-02 ray-count gate (M2)', N10 edge ≤ 0,45 px"
affects: [04-05 warp worker glue and bench, 04-08 Durchblick view (field, CELL_DIAGONAL, texture extent R = 1,6), 04-09 leaves and rim drawing, 04-13 user confirmation]

tech-stack:
  added: []
  patterns:
    - "One wearer-frame mirror (wearer x = −engine x) inside classifyDirection; all outputs named in the wearer frame"
    - "Uniform-depth quadtree in mixed cells only; rays = classifyDirection calls as the host-independent cost gate"
    - "P0 numbers pinned in tests with toBeCloseTo(measured, 2) plus the UI-SPEC thresholds as bounds"

key-files:
  created:
    - src/engine/outline-geom.js
    - src/engine/outline-geom.test.js
    - src/engine/warp.js
    - src/engine/warp.test.js
    - scripts/measure-stages.mjs
    - scripts/p0-feasibility.mjs
    - .planning/phases/04-refraction-view-offline/04-P0-RESULTS.md
  modified:
    - .planning/phases/04-refraction-view-offline/04-UI-SPEC.md

key-decisions:
  - "Field half-angle stays 30°: G1 (20 960 accepted) and G2 (80 572 accepted) pass criteria 1, 2 and 4 with no step-down"
  - "Tiers fixed by P0: fein 6/1, mittel 8/2, grob 10/3 (real leaves 0,75 / 2,0 / 2,5 px); cell 11 rejected at 0,5195 px > 0,45 px"
  - "N10 is asserted at the smallest MEASURED scale, 215,42 px/tan (400 px column, 198 × 248,75), not the assumed 216,5"
  - "Largest measured panel for the ray gate is 639 × 800 (1280 × 800 fullscreen), not the 581 × 593 scratch value"
  - "A front point outside the outline is class 2 even when the extended front surface would give TIR (the ray meets the edge wall first)"
  - "Leaf layout keeps the 6-float contract [x0, y0, size, cls, u, v]; size = leaf width, leaf height = size · cellY / cellX"

requirements-completed: [REF-01, REF-02]

duration: ~2h 45min
completed: 2026-11-13
---

# Phase 4 Plan 03: Warp grid, aperture classes and P0 Summary

**The engine now maps every eye direction of a Durchblick panel to a traced object direction and one of five aperture classes. The mapping goes through the production `traceFromEye`, with the wearer mirror applied exactly once. P0 ran 51 million production rays on the measured stage sizes and kept the 30° field. It fixed the grid tiers at 6/1, 8/2 and 10/3 px with ≤ 0,45 px drawn edge error, and turned every provisional UI-SPEC number into a measured one.**

## Finding for lens-critic first

**−1,00 CR-39 shows 2,99 px (not ≥ 3,0 px) on the 400 px desktop column, and the weak note does not appear.** The measured column panel is 198 × 248,75. The UI-SPEC assumed 199 × 250. −1,00 needs a panel long side of at least 250 px to reach a 3,0 px edge-midpoint shift. This affects the in-page tablet (1164 × 593) and the 900–1199 px desktop band. The test pins the value (`toBeLessThan(3.0)`) and nothing was loosened. Whether to accept this or change the layout is for lens-critic or the user.

## Decision recorded (orchestrator decision 6, D-02 / ROADMAP SC1)

The field angle fixed here makes a cylinder's distortion along a panel's short side small (about 1,7 px for 1 dpt). ROADMAP SC1 ("a cylinder visibly distorts along the correct axis") is therefore judged by the Mit/Ohne Glas blink, the reference ticks and the size text, which names the direction. This reinterpretation is accepted explicitly by the user on 2026-11-13; the orchestrator reported it to the user that day and recorded the report and the acceptance in session.md (round-2 NEW-10; 04-13 Task 1 checks the record, this plan does not write session.md). Its hard gate is the on-screen pixel test in 04-08 Task 1/3 (lens-critic M3: a mirrored cylinder or swapped eyes must fail on screen, not only in the warp array). 04-13 asks the user to confirm, it does not decide. The docs commit `82aa844` changed the UI-SPEC "Open for the user" line to this wording.

## Accomplishments

- **classifyDirection** applies the UI-SPEC order 1 → 5. It does point-in-polygon tests on the back hit and the front exit, falls back to the plane z = −CT when the back surface is missed, and uses the 4 mm `FRAME_FACE_MM` band (imported, not redefined). It has no copy of the intersection or Snell code (`grep -cE "function (intersect|refract)"` = 0).
- **Test results:**
  - E9 (tan units, N9) passes for OD and OS: −4,00 gives classes 1/2/4/5 at 0,401/0,453/0,521/0,802, and +4,00 gives 1/2/4 at 0,361/0,421/0,521.
  - The plate identity holds to 1e-12.
  - D-07 golden: the less-minified direction lies at φ = 150° for −2/−2×30 OD and OS, and at φ = 180° − θ for θ = 30, 120, 5, 85 and 175. The eigenvalues equal `LensResult.magnification` within 0,05 pp.
  - Property test: 300 runs (≥ 200 accepted), no NaN and no exception.
  - Pinned class 3: the tirFront case at tan 1,97, and |objTan| = 10,2 at tan 1,90.
- **warpGrid** writes `uv` (Float32Array), `cls` (Uint8Array) and `leaves` (Float32Array, 6 floats per leaf; the buffer doubles as it grows), plus `rays`, `rimInField`, `pastRimInField`, `noViewInField` and `maxObjTan`. It contains no timing code (`grep -c performance` = 0).
- **E10 at the measured geometries** (production trace, also in `04-P0-RESULTS.md` section 5). All values are pinned to ±0,005 px:

  | Panel | Case | Edge-midpoint shift (long side) | Tick offset |
  |---|---|---|---|
  | 412 (189 × 285) | −1,00 | 3,4230 | 3,1852 |
  | 412 (189 × 285) | 0/−1×180 | 3,4230 | 2,9445 long / 0,3221 short |
  | 412 (189 × 285) | −0,75 | 2,5353 | — |
  | 320 (288 × 216) | 0/−1×90 | 3,4591 | 3,0314 long / 0,4498 crossing |
  | 400 column (198 × 248,75) | −1,00 | 2,9876 | 2,9520 |
  | 400 column (198 × 248,75) | 0/−1×180 | 2,9876 | 2,6366 |

## P0 results (04-P0-RESULTS.md)

- **Measured stages** (production preview of commit 4dd2dfd):
  - 412 phone: 380 × 285 stage, panels 189 × 285, 246,82 px/tan
  - 320 phone: one panel 288 × 216, 249,42 px/tan
  - 400 px column (1024 × 768 and 1164 × 593 in page): panels 198 × 248,75, 215,42 px/tan (UI-SPEC assumed 199 × 250 at 216,5)
  - 1280 in page: panels 270 × 338,75
  - Fullscreen: 205 × 915, 320 × 640, 581 × 593, 639 × 800, 511 × 768
- **Server checks:** curl printed `000` before start. The served `app-commit` was `4dd2dfd`, equal to HEAD at that point, and the script's EXPECT_COMMIT check passed. I stopped the server I started.
- **G1:** 22 500 cases, 20 960 accepted, 1 540 rejected (BACK_SAG_UNDEFINED).
- **G2:** 90 720 cases, 80 572 accepted, 10 148 rejected.
- **Criteria 1, 2 and 4:** PASS in both grids. The largest paraxial deviation is below 0,00001 pp.
- **Criterion 3:** the −4,00 CR-39 reference reproduced exactly: −5,60 % at the centre, −15,7 % radial and −9,0 % tangential at 30°.
- **Criterion 5:** 21 011 G2 rim cases, with the item-12 case listed for OD and OS. The default frame (G1) has no rim cases.
- **Chart texture extent:** R = 1,6, from a maximum class-1 |objTan| of 1,5526.
- **Interpolation constant:** k = 1,051. Worst drawn edge error at P 215,42 is 0,1669 / 0,2810 / 0,4373 px for cells 6 / 8 / 10, and 0,5195 px for cell 11.
- **Ray counts** (fein / mittel / grob):

  | Case | fein | mittel | grob |
  |---|---|---|---|
  | item-12 −4,00, 320 panel | 6 549 | 1 900 | 1 394 |
  | item-12 +4,00, 320 panel | 6 421 | 1 900 | 1 426 |
  | item-12 −4,00, 639 × 800 | 23 540 | 9 845 | 6 609 |
  | item-12 +4,00, 639 × 800 | 26 356 | 10 421 | 7 025 |

  grob/fein is 0,21–0,28 and grob/mittel is 0,67–0,75. Boundary error is ≤ 1,22 px. The re-run reproduced every count exactly.
- **Timing** (i7-8809G, load average 12,9 / 12,6 / 11,7 during the run; informational only). Medians for one panel at fein / mittel / grob:

  | Case | fein | mittel | grob |
  |---|---|---|---|
  | NORMAL_PAIR, 412 panel | 1,6 ms | 0,9 ms | 0,6 ms |
  | GRENZFALL_PAIR, 412 panel | 57,6 ms | 16,9 ms | 12,5 ms |
  | item-12, 639 × 800 | 264–306 ms | 103–120 ms | 66 ms |

  The two item-12 values per tier are −4,00 and +4,00.
- **Item-12 rim widths at 320** (OS mirrored, same numbers):
  - −4,00: lens ends at 108,0 px, back outline at 118,1 px, rim face edge at 189,8 px
  - +4,00: 94,6 / 116,4 / 182,9 px
- **Run:** 315,6 s, 51 107 340 rays.

## UI-SPEC values replaced (docs commit 82aa844)

1. MINOR 3 table: retitled as "formerly provisional". Field: P0 keeps 30°. h: fixed by 04-01 (orchestrator decision 1, 3,0 mm from the 3,04 mm Le Grand computation, HSA 12 mm still an assumed value).
2. h bullet, the reference-values sentence, the copy examples, the verification-contract sentence and the D-04 row: "vorläufig until D-12 (c)" became "fixed by 04-01, orchestrator decision 1".
3. Field bullet: "(vorläufig until P0) 30°" became "30° … fixed by P0". The same change was made in the D-02 row, and "tan 6° per square (vorläufig)" became "fixed with the 30° field" (D-08 row and chart layout).
4. Chart layout, 400 px column: 199 × 250 at 216,5 px/tan with 22,76 px squares became the measured 198 × 248,75 at 215,4 px/tan with 22,64 px squares. The 412 and 320 values were unchanged.
5. "How visible the effect is": the heading and source now name the production trace. The −4,00 row "14,0 / 7,1 (critic) … —" became "14,05 / 7,13 … 14,20 / 8,67". The 400 sentence "3,00 / 2,97; 3,00 / 2,65" became "2,99 / 2,95; 2,99 / 2,64", with the < 3 px finding stated. Every other table cell matched the production values to 2 decimals and was kept.
6. Weak note: "≤ 1,2 %" became "≤ 1,3 %" (N6, `WEAK_NOTE_MAX_PCT`). The exception sentence was corrected with production values: plano on base curve 10 gives 1,2 % / 2,27 px, and +0,25 on base curve 10 gives 1,6 % / 2,99 px. The range is now "about 1,4–1,6 %" (was 1,3–1,6).
7. Item-12 width table: the −4,00 back outline moved from 118,2 to 118,1 px, and the rim face edge from 189,9 to 189,8 px.
8. P0 output sentence: "every (vorläufig until P0)" became "every provisional 'until P0' mark … (done 2026-11-13)".
9. "Open for the user (accept or veto)" was replaced by the decision-6 text given in the plan.

Greps: `vorläufig` = 0, `Open for the user (accept or veto)` = 0.

## Task Commits

1. Task 1: `5225f27` (test, RED), `b80c7ce` (feat, GREEN)
2. Task 2: `609dd0c` (test, RED), `4dd2dfd` (feat, GREEN)
3. Task 3: `cebd643` (feat: scripts, results, CI subset and ray gate), `82aa844` (docs: UI-SPEC)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base reset.** HEAD was at 47bb4e2. I ran `git reset --hard d4f1551` as the branch check prescribes.

**2. [Interface] Leaf height for non-square cells.** The plan's leaf layout has one `size` field, but cellX ≠ cellY in general. I kept the 6-float contract that 04-09 reads. `size` is the leaf width, and the leaf height is size · cellY / cellX. This is documented in the warpGrid JSDoc, and the tests use it.

**3. [Measured geometry] N10 and E10 use the smallest measured scale.** The plan names 216,5 px/tan and 199 × 250. The real 400 px column is 198 × 248,75 at 215,42 px/tan, so N10 asserts ≤ 0,45 px there. That is stricter than the plan and still passes: 0,4373 px.

**4. [Measured geometry] Largest panel.** It is 639 × 800 (1280 fullscreen), not the scratch value 581 × 593. The plan text names 581 × 593 only as an example.

**5. [Scope] P0 helpers duplicated.** The drawn-interpolant, boundary, edge-midpoint and tick helpers exist in both warp.test.js (as the plan requires) and the one-off P0 script. The CI tests are what enforce the numbers.

**6. [Measurement] Fullscreen stages added.** measure-stages.mjs also measures each viewport in fullscreen, because the largest panel only exists there.

**7. [Process] Scratchpad naming after the orchestrator warning.** Two scratchpad files I had relied on were the weak-note probe (my own script) and a coverage log. I re-ran both under `04-03-` prefixed names, and the results were identical. The P0 results file is written inside the worktree, and the re-run reproduced every ray count.

### Acceptance-criterion notes

- `grep -c "toBeLessThanOrEqual(0.5)"` still matches the tick-offset bounds. For the edge interpolation, Task 3 raised the bound to 0,45 as the plan requires, and the 0,5 px N10 limit stays in the test name.
- `warp.js` lines 208–210 are not covered. They are the folded finite check in `warpGrid`, which classifyDirection already makes unreachable. I kept it as the defensive write-loop check the plan asks for.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/engine/outline-geom.test.js src/engine/warp.test.js` | 54/54 pass |
| `-t "P0 CI subset"` | 7 pass |
| `-t "ray-count gate"` | 5 pass |
| `node scripts/p0-feasibility.mjs > /dev/null` | exit 0, results file contains PASS |
| `npm run lint` (`eslint .`) | exit 0 |
| engine coverage (`--coverage --project unit src/engine`, diagnostics.test.js excluded, `--testTimeout=900000`) | 601/601 pass; 99,25 % lines, 97,57 % branches; warp.js 97,88 / 98,03; outline-geom.js 100 / 93,75 |
| `src/engine/diagnostics.test.js` alone, no coverage | 21/21 pass |

**Not verified: the full `npm run test:coverage` run as one command.** Under coverage and a load average of 9–14, `diagnostics.test.js` "ENG-07 extremes grid" hits its own hard-coded 120 s limit. This is the same failure 04-01 reported, in a file this plan did not change. CI or the orchestrator should re-run `npm run test:coverage` on an idle machine.

D-30 MCP protocol: not run. This plan has no DOM wiring. The only browser use was measure-stages.mjs, which reads the stage size.

## Known Stubs

None.

## Later clean-up (not done, surgical rule)

`evaluate.js` (lines 123–135) and `profile.js` (lines 49–60) keep their private `insideOutline` copies. `outline-geom.js` now exports the same function.

## Threat Flags

None. The plan adds no network, storage or DOM surface. T-04-10…T-04-13b are mitigated as planned: one mirror plus the golden tests; classes 2–4 carry no uv; no exception and a frozen failure object; measured stages, P0 and pinned values; the ray-count gate in CI.

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(04-03)` RED commit followed by a `feat(04-03)` GREEN commit. In Task 2's RED run, 15 of 38 failed. The E10 tests passed already in RED because they are built on classifyDirection, which Task 1 had added. Task 3 is `type="auto"`, not TDD.

## Self-Check: PASSED

- All 7 created files are on disk.
- Commits 5225f27, b80c7ce, 609dd0c, 4dd2dfd, cebd643 and 82aa844 are in `git log`.
