---
phase: 01-verified-engine-live-pipeline
verified: 2026-11-06T13:55:00Z
status: passed
score: 21/21 requirements verified (final, 2026-11-07)
source: 01-11 Task 1. Orchestrator gate, requirement trace (gsd-executor) and lens-critic phase-result review
---

# Phase 1: Verified Engine & Live Pipeline: Verification Report

**Status:** gaps_found. lens-critic verdict **NEEDS WORK** (3 MAJOR, 0 BLOCKER, 12 MINOR).
**User decision (2026-11-06):** "Gap plan, then push". Fix the 3 MAJORs and the cheap MINORs in a gap-closure plan. lens-critic reviews that plan before execution and the result after it. Push only on PASS. The final push of 01-11 is **held** until then.

## Gate (orchestrator, HEAD e291946)

`npm ci`, lint, `test:coverage` (820/820; 97,44 % lines / 96,05 % branches), `GITHUB_SHA=… build`, `test:e2e` (28/28): all exit 0.
Hygiene: `git ls-files references` = 0; dist contains no references/.planning; `Stärke` = 0; `innerHTML` in src/ui = 0; non-test `from 'three'` in src/engine = 0.
Desktop bench (Node, i7-8809G): normal pair (−2,00 rund 50/18/32) median 3,18 ms. Grenzfall pair (+0,50 −0,50×81, 1.60, panto 58×54/15, PD 26, FH 0) median 11,07 ms; lens-critic measured 6,5–10,9 ms across runs.

## Requirement trace (all 21 rows ran ≥ 1 passing test, 0 failing)

Full table: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/beae44f8-9eba-48b3-b7a2-b56ed3dee3bf/scratchpad/01-11-trace.md`.
No trace FAILs and no marking mismatches. Pending: DEPL-01 (favicon fix 39882ef not deployed), DEPL-02 (structural proof only), ENG-06, ENG-09 (phone), MAT-01, MAT-02.

## Gaps (for `/gsd-plan-phase 1 --gaps`)

### GAP-1 (lens-critic MAJOR-1): the automatic base curve makes plus lenses convex on both sides
- `src/engine/solve.js:127-279`: the objective J = max(CT, ET_max) has no back-surface constraint.
- Orchestrator reproduced this (CR-39, rechteckig 52×38/18, PD 32):

  | Sph | D1 | D2a = D2b |
  |---|---|---|
  | +2 | +1,51 | **+0,49** |
  | +4 | +2,75 | **+1,23** |
  | +6 | +3,99 | **+1,94** |

  lens-critic also found +12 in 62×55 → D1 +7,02 / D2 +4,14.
- The automatic CT comes out 0,09–0,48 mm thinner than the Zeiss stock rows at the sheet's minimum ET. Examples: 75 mm +4: 6,72 vs 7,2; 65 mm +6: 7,34 vs 7,7. The tier-2 Zeiss test uses the sheets' own front curves, so the automatic path users see is never compared with real lenses.
- The user's earlier acceptance covered only minus lenses at the +0,50 floor (MAT-03, phase 2); the disclaimer (`src/i18n/de-AT.js:164`) names only "starke Minusgläser".
- **Fix:** constrain the search to a back surface that is not convex (D2a, D2b ≤ 0; every back principal power ≤ 0). Re-derive and re-pin the D-01 values, and the 01-02/01-07/01-10 pins that change. Add a test comparing the automatic result with Zeiss rows and recording the expected difference. Update the disclaimer if the model still differs from real lenses.

### GAP-2 (lens-critic MAJOR-2): ENG-09 instrumentation measures the wrong thing; the phone budget is at risk
- "Letzte Eingabe bis Anzeige" (`src/ui/main.js:317-341`) times only the synchronous `update()`, with no layout or paint.
- "Erneut messen" (`src/ui/main.js:345-357`) runs 50 times on identical inputs: warm JIT and cached outline. It never includes the outline rebuild, which takes about 1,6 ms on desktop for panto/pilot (`src/engine/frame/outline.js:211-223`).
- Three different "normal" cases are in use (Node bench rund 50×50, page readout on the current inputs, 01-11 case A −4/−2×30 rechteckig).
- Every keystroke recomputes both eyes, with no coalescing.
- **Fix:**
  - Measure from the input event to the next paint (double rAF or PerformanceEventTiming).
  - Add a measured case with an outline-cache miss (frame size changes per run).
  - Use one canonical normal case everywhere (bench, page, 01-11 case A).
  - Memoise the per-eye result, so editing one eye recomputes only that eye.
  - Recompute at most once per animation frame.
  - The phone measurement itself stays in 01-11 Task 3.

### GAP-3 (lens-critic MAJOR-3): requirements owned by phase 1 have no closing plan
- **ENG-06:** `intermediates` (`src/engine/evaluate.js:432-449`) has no surface sags. Add front and back sags at the outline extremes (nasal, temporal, superior, inferior and the ET max/min points) and the maximum radius.
- **MAT-01:** the Abbe number is stored in `src/engine/materials.js` but neither used nor shown. Show νe on the material line, and expose it in the result/intermediates so the requirement's "the engine uses …" is met; read the exact requirement text.
- **MAT-02:** only the "shown in the Expert view" clause is open. Move that clause to phase 2 (Expert view). The user signed this off with "Gap plan, then push" (2026-11-06). Update REQUIREMENTS.md and ROADMAP traceability accordingly.

### Cheap MINORs to include
- **MINOR-1:** `src/ui/main.js:288` shows `vogelClampedD1` as "Faustregel nach Vogel". Show the raw Vogel value, with "(begrenzt auf +10,00 dpt)" when it was clamped.
- **MINOR-3:** annotate `.planning/research/PITFALLS.md:139-149`: the 0,39/1,12 mm values are barrel minus meridional; the tyre torus the engine uses differs by ≤ 0,086 mm (01-08 SUMMARY).
- **MINOR-5:** `src/state/parse.js:92` reuses `PARSE_NOT_A_NUMBER` for the axis, so `90,5` and `-90` get a wrong German text. Give the axis its own message.
- **MINOR-11:** `#diag-od`/`#diag-os` are `role="status"` and get rebuilt on every keystroke (`index.html:191-192`, `src/ui/main.js:274`), which repeats screen-reader announcements. Update only when the content changes.
- **MINOR-12:** `solveCT` reports `iterations: it`, so convergence on the first pass counts as 0. Fix the count (it is the Grenzfall proxy).

### MINORs accepted or deferred (no work in the gap plan)
- **MINOR-2:** pilot orientation stays an assumption, with weak supporting evidence (retail fit guide). Low impact.
- **MINOR-4:** DEPL-02 failure-blocks-deploy rests on documentary/structural evidence. A real demo needs a failing push, which is an outward-facing action that hasn't been requested.
- **MINOR-6:** range checks (+11 +3 → Sph +14), deferred to RX-04 (phase 2).
- **MINOR-7:** untested branch `src/engine/solve.js:207-215`. The gap plan may cover it if the search changes anyway.
- **MINOR-8:** volume is tested only on a centred circle. lens-critic's independent grid check agrees within 0,03 %; optional regression test.
- **MINOR-9:** CT at a virtual point when the OC is outside the outline (warning only).
- **MINOR-10:** phone layout length, phase 2 (UX-03).

## lens-critic result review (verbatim verdict)

```
VERDICT: NEEDS WORK
```

Confirmed correct by lens-critic: optics conventions (TABO axis, nasal decentration, surface signs, thick-lens back-vertex correction), tyre-torus orientation, SC-4 demo (−12/−6×10 62×55 CR-39 → BACK_SAG_UNDEFINED; computable with 1,74), and the 360 px table fix (3193223).

## Final status (2026-11-07)

**passed.**
- GAP-1 to GAP-3 were closed by 01-12 … 01-15. The lens-critic result review at e8139c4 returned `VERDICT: PASS`. The requirement trace showed 21/21 rows passing with no mismatch.
- The final push was 02bf4ff, verified live: CI passed, the live Playwright run passed 68/68, and the chrome-devtools check showed 0 errors.
- ENG-09 passed on a real Pixel.
- DEPL-02 was proven by the CI gate demo (run 42350539302).

Details: 01-11-SUMMARY.md.
