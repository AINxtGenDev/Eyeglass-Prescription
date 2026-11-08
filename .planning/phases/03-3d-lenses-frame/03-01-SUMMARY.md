---
phase: 03-3d-lenses-frame
plan: 01
subsystem: engine/rim + ui/frame-input
tags: [VIZ-03, D-05, bevel, rim, expert-view]
requires: [evaluateLens surfaces, frameOutline, frontSagAt, thicknessAt]
provides: [BEVEL_RULES, BEVEL_RULE, bevelApexMm, bevelSplit, frontLeadMm]
affects: [03-03 3D rim placement, 03-07, 03-11 Seite view text]
tech-stack:
  added: []
  patterns: [pure engine helper reused by text and 3D, 0,05 mm 'bündig' threshold]
key-files:
  created: []
  modified:
    - src/engine/rim.js
    - src/engine/rim.test.js
    - src/ui/frame-input.js
    - src/ui/pipeline.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - index.html
    - e2e/expert.spec.js
decisions:
  - "03-01: bevel rule '1:2' (apex at t/3 from the front, Essilor US 8 388 133 B2) for all lenses, [ASSUMED]; rim spans apex ± D/2 (A1)"
  - "03-01: frontLeadMm = max_i(frontSag_i + apex_i) − D/2 is shown as its own Expert line so 'vorne bündig' (edge) never reads as 'lens flush at the front'"
  - "03-01: edgeBeyondRim and frame.rim.over removed (deliberate Phase-2 behaviour change, user decision 2026-11-08)"
metrics:
  duration: ~15 min
  completed: 2026-11-08
  tasks: 2
  files: 8
---

# Phase 3 Plan 01: Bevel split and front-surface lead Summary

One bevel model in the engine: `bevelSplit` ('1:2' rule from Essilor US 8 388 133 B2, assumed choice) gives front and back edge protrusion beyond the rim. `frontLeadMm` gives how far the front vertex stands ahead of the rim. The Expert Randtiefe block now shows both per eye, plus a note that the bevel position is assumed.

## Old and new example strings (for lens-critic, T-03-03)

Example Rx (OD −2,75 −0,50 × 180, OS −2,50 −0,75 × 170, CR-39, rechteckig 52×38/18, PD 32/31,5), etMax OD 4,597073 mm, OS 4,597344 mm.

| Randtiefe | Phase 2 (old) | 03-01 (new) |
|---|---|---|
| 3,0 (OD edge) | Rechtes Glas: Der Glasrand ist an seiner dicksten Stelle 1,6 mm dicker als die Fassung tief ist (vorne und hinten zusammen). | Rechtes Glas: Der Glasrand steht an seiner dicksten Stelle hinten 1,6 mm aus der Fassung, vorne ist er bündig. |
| 3,0 (OD lead) | (none) | Rechtes Glas: Die Vorderfläche wölbt sich bis zu 0,5 mm vor die Fassung. |
| 5 (OD edge) | Rechtes Glas: Der Glasrand passt in die Tiefe der Fassung. | … hinten 0,6 mm aus der Fassung, vorne ist er bündig. (3,065 − 2,5 = 0,565) |
| 5 / 10 (lead) | (none) | … Die Vorderfläche wölbt sich nicht vor die Fassung. |
| 10 (OD edge) | passt | Rechtes Glas: Der Glasrand passt in die Tiefe der Fassung. |
| any | — | note: "Die Aufteilung nach vorne und hinten ist angenommen: Facette bei einem Drittel der Randdicke von vorne." |

Behaviour change: with t = D the back now stands out D/6 (`bevelSplit(3, 3)` → back 0,5), where Phase 2 said "passt". Depth 5 for the example changed from "passt" to "hinten 0,6 mm" for the same reason.

## Measured values (pinned to 1e-9 in rim.test.js)

From `node` on the executor machine, 2026-11-08, `evaluateLens` + `frameOutline(…, 720)`, D = 3:

| Case | frontLeadMm.value | index | bevelSplit(etMax, 3) |
|---|---|---|---|
| OD example | 0.5152099491529434 | 425 | front 0.03236, back 1.56472 |
| OS example | 0.5281867047901017 | 427 | front 0.03245, back 1.56490 |
| +6,00 sph, cyl 0 × 0, same frame, PD 32 | 4.68512658961894 | 297 | front 0.06979, back 1.63958 |

The planner's check run gave 0,5151 for OD; my measurement gives 0,51521. Both round to 0,515 and display as "0,5 mm".

## Tasks

| Task | Commit | Notes |
|---|---|---|
| 1 RED | acb8885 | 13 of 14 rim tests failed before the implementation |
| 1 GREEN | 143a039 | rim.js 100 % lines/branches/functions (json-summary of the single-file run) |
| 2 | 4e3067c | UI, dictionary, index.html, e2e |

## Verification (real output)

- `npx vitest run src/engine/rim.test.js`: 14 passed.
- `npm run lint`: clean (no output from eslint).
- `npm test`: 34 files, 1606 tests passed.
- `npm run test:coverage`: 1606 passed; engine 99,01 % lines, 96,19 % branches; no threshold error.
- `npm run build`: built.
- `npx playwright test e2e/expert.spec.js e2e/frame.spec.js`: 82 passed (desktop + mobile).
- `npm run test:e2e` (full): 389 passed, 1 skipped (2,2 min), exit 0. The skip is the existing `test.skip(isMobile, …)` in e2e/rx.spec.js:319; this plan did not touch it.

## Deviations from Plan

**1. [Rule 3 - Blocking] +6,00 test spec uses `axisDeg: 0`, not null**
- `evaluateLens` rejects `axisDeg: null` with `INVALID_SPEC {reason: 'non-finite'}`; cyl is 0, so the axis has no effect.

**2. [Rule 1 - Test] `src/i18n/dictionary.test.js` updated (not in files_modified)**
- It asserted the placeholders of `frame.rim.over`. It now asserts that the key is gone and checks the placeholders of the new keys plus 'angenommen' in `frame.rim.bevel`.

**3. Single-file coverage command**
- `npx vitest run --coverage --project unit src/engine/rim.test.js` exits non-zero on the *global* threshold, because one test file exercises only part of the engine (65,2 % lines). rim.js itself is 100 %. The full `npm run test:coverage` meets the gate.

**4. Intermediate commit 143a039 does not build**
- Task 1 removes `edgeBeyondRim` as the plan says, while `frame-input.js` still imported it until 4e3067c. Unit tests were green at 143a039; only the Vite build and the page are broken at that commit.

Prettier was not run as a fixer: lint is ESLint only, and these files were already not Prettier-formatted before this plan.

## MCP check (D-30)

Not done by this executor. Per the orchestrator's instruction, the orchestrator runs the chrome-devtools MCP check at 412×915, 320×640 and 1280×800 after this plan returns. Expected: depth 3,0 shows the "hinten 1,6 mm … vorne ist er bündig" and "Vorderfläche … bis zu 0,5 mm" lines for both eyes plus the 'angenommen' note; depth 10 shows "passt" and "wölbt sich nicht".

## Requirements

VIZ-03 stays Pending. This plan provides only the protrusion numbers. Rotate/pan/zoom, the camera presets and the Seite view come in later phase-3 plans.

## Known Stubs

None.

## Threat Flags

None. All text goes through `setText` (textContent). Params are `fmtMm` output.

## Self-Check: PASSED

- Files: src/engine/rim.js, src/engine/rim.test.js, src/ui/frame-input.js, src/ui/pipeline.js, src/i18n/de-AT.js, index.html, e2e/expert.spec.js all exist and are modified.
- Commits acb8885, 143a039, 4e3067c are found in git log.
- TDD gates: test(03-01) acb8885 comes before feat(03-01) 143a039.
