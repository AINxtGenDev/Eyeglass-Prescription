---
phase: 04-refraction-view-offline
plan: 01
subsystem: engine
tags: [optics, ray-trace, spectacle-magnification, i18n, de-AT, vitest, fast-check]

requires:
  - phase: 01-engine
    provides: trace.js ENG-08 oracle (intersect/refract), design.js sag/gradient functions, evaluateLens
  - phase: 03-3d-view
    provides: src/ui/view/text.js pure string-builder pattern, format.js Intl formatters
provides:
  - "trace.js traceFromEye(s, h, ex, ey) + TRACE_STATUS (non-throwing reverse trace, back first)"
  - "magnification.js HSA_ASSUMED_MM, ENTRANCE_PUPIL_MM, EYE_POINT_MM, spectacleMagnification"
  - "LensResult.magnification { hMm, shape, meridians: [{ deg, wearerDeg, F, power, sm }] } (null on failure)"
  - "format.js fmtPercent"
  - "text.js refDirWords, refSizeBlock, refAria, WEAK_NOTE_MAX_PCT"
  - "de-AT view.ref.* and view.aria.ref.* strings"
affects: [04-03 warp grid, 04-08 Durchblick view, 04-09 no-WebGL fallback, 04-11 A/B compare]

tech-stack:
  added: []
  patterns:
    - "Null-returning numeric cores with thin throwing wrappers: the oracle keeps its loud failure path, the production path returns a status"
    - "Closed-form engine number checked against an independent trace Jacobian (oracle within 0,05 pp)"

key-files:
  created:
    - src/engine/magnification.js
    - src/engine/magnification.test.js
  modified:
    - src/engine/trace.js
    - src/engine/trace.test.js
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/i18n/format.js
    - src/i18n/format.test.js
    - src/ui/view/text.js
    - src/ui/view/text.test.js
    - src/i18n/de-AT.js

key-decisions:
  - "Orchestrator decision 1: eye point h = 15 mm = HSA 12 mm [ASSUMED] + entrance pupil 3,0 mm [CITED, Le Grand & El Hage 3,04 mm via Greivenkamp OPTI-502, rounded]; the test reproduces 3,0376 mm from the six table values"
  - "Orchestrator decision 3: no textbook claim; the source line says the study sources use the VERTEX distance, the entrance-pupil reference rests on the ABCD derivation and US 8,805,612 B2, Bennett & Rabbetts stays an open human item"
  - "Each meridian carries a power field (power factor) in addition to deg, wearerDeg, F and sm, because the 04-08 interface block lists it"
  - "view.aria.ref.layout.one uses {side} from two new keys view.aria.ref.side.od/os ('rechte'/'linke'); layout.compare uses {who} from view.ref.who.*"

patterns-established:
  - "Size words follow the engine sign of SM − 1; 'praktisch gleich groß' is decided on the formatted string '0,0 %'"
  - "Direction words: 15° band = END_LABEL_TOL_DEG (imported), oblique path from the on-screen angle φ = 180° − θ, same words for OD and OS"

requirements-completed: [REF-01]

duration: ~75min
completed: 2026-11-13
---

# Phase 4 Plan 01: Engine magnification, reverse trace and size sentences Summary

**Every computed lens now carries its spectacle magnification per principal meridian (closed form, h = 15 mm). A non-throwing reverse trace from the eye matches it to within 1,3e-7 percentage points. Node-tested builders turn the numbers into the de-AT size sentences, such as "Rechtes Glas: Bild etwa 6 % kleiner".**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-13, about 10:55 UTC
- **Completed:** 2026-11-13
- **Tasks:** 3 of 3 (each done as a RED test commit followed by a GREEN feat commit)
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- **trace.js:** the Newton intersection and the vector-Snell step now have null-returning cores (`intersectOrNull`, `refractOrNull`). `intersect` and `refract` wrap them and keep their messages unchanged. `traceRay` and `traceBVP` were not edited. The 16 ENG-08 tests ran unchanged and pass (the diff of trace.test.js adds 135 lines and removes none). `grep -c throw` = 2.
- **traceFromEye:** starts at the eye point (oc.x, oc.y, −CT − h) and travels toward +z, back surface first, then the front. It never throws. Statuses: ok, missBack, tirBack, missFront, tirFront. The property test (300 runs, seed 44) gave `{"ok":297}` and 3 engine-rejected specs.
- **magnification.js:** closed form M = 1/(1 − (t/n)·D1) × 1/(1 − h·F). The header carries the ABCD derivation and the M5 source line, worded exactly as the plan asks. Constants are tagged [ASSUMED] / [CITED].
- **LensResult.magnification** is computed in evaluateLens and guarded by the existing allFinite / NON_FINITE_RESULT path. It is `null` in `fail()`. `src/state/compute-protocol.js` does not whitelist fields, so the new field **passes through** to the worker unchanged and needed no edit.
- **fmtPercent** plus the pure builders `refDirWords`, `refSizeBlock` and `refAria`, with the approved UI-SPEC copy in de-AT.js.

## Measured values (pinned to 1e-9 in magnification.test.js)

Setup: h = 15 mm, rechteckig 52×38/18, PD 32, CR-39, automatic base curve unless noted. Values are SM − 1. Every value is within 1e-5 of the plan's reference value.

| Case | Measured | Plan reference |
|------|----------|----------------|
| plano | +0,0006003602 | +0,000600 |
| plano, manual base curve 6 | +0,007252216 | +0,00725 |
| −0,25 on manual base curve 6 | +0,0034891317 | +0,00349 |
| −1,00 | −0,0141868372 | −0,01419 |
| −4,00 | −0,056037396 | −0,056037 |
| +4,00 | +0,0776692836 | +0,077669 |
| −2,00/−2,00×30: 30° / 120° | −0,0285433396 / −0,056037396 | −0,028543 / −0,056037 |
| 0,00/−1,00×90: 90° / 180° | +0,0006003602 / −0,0141868372 | +0,000600 / −0,014187 |
| −6,00 in 1,67 | −0,0822378835 | −0,08224 |
| −10,00 | −0,1299127302 | −0,12991 |
| 62×55/24 +5,00/−6,00×90: −1,00 meridian (180°) | +0,0009677162 | +0,00097 |

**Trace oracle (D-12 c/e).** Method: J = ∂objTan/∂eyeTan by central differences (e = 1e-4), M = J⁻¹. The largest |eigenvalue − formula| was: −4,00: 9,27e-8 pp; +4,00: 1,26e-7 pp; −2/−2×30 OD and OS: 8,32e-8 pp; 0/−1×90: 2,51e-8 pp; −6,00 in 1,67: 1,34e-7 pp; +4,00 with conic front k = −2: 1,24e-7 pp. The tolerance is 0,0005 (0,05 pp). For −2/−2×30 the less-minified eigenvector lies at engine 30,00° ± 0,05° for both OD and OS.

**E3 sign property.** Six materials, 300 runs per side. Minus side (seed 45): 299 lenses checked, 1 engine-rejected spec skipped. Plus side (seed 46): 300 checked, 0 skipped. No violations.

**Entrance pupil.** The test reproduces 3,0376 mm (target 3,04 ± 0,005 mm) from the Greivenkamp OPTI-502 table: PDF page 4, slide 22-9 "More Complete Eye Model". Values used: R 7,8 / 6,5 mm, t 0,55 mm, n 1,3771 / 1,3374, and the stop at 0,55 + 3,05 = 3,60 mm. I downloaded the PDF on 2026-11-13 and read the six values from it, not from memory.

## Task Commits

1. **Task 1: reverse trace:** `4fc2a96` (test, RED), `26180d0` (feat, GREEN)
2. **Task 2: spectacle magnification:** `487a32b` (test, RED), `1f251a1` (feat, GREEN)
3. **Task 3: fmtPercent and the size block:** `e8c77c6` (test, RED), `e906468` (feat, GREEN)

## Decisions Made

- Orchestrator decision 1: 3,0 mm entrance pupil. The constant cites the 3,04 mm Le Grand computation and states the rounding.
- Orchestrator decision 3: no textbook claim. The M5 source line is used verbatim.
- I added a `power` field (the power factor) to each meridian. The plan's behaviour list does not ask for it, but the 04-08 interface block expects it.

## New dictionary keys NOT in the approved UI-SPEC copy table (for lens-critic)

- `view.ref.rimNote` = "Der dunkle Streifen im Bild ist der Rand Ihrer Fassung." (N3, MINOR 8; the plan prescribed it)
- `view.ref.rimPastNote` = "Außerhalb des Rands sehen Sie am Glas vorbei." (MINOR 8; shown only when rimInField AND pastRimInField; the plan prescribed it)
- `view.ref.cylSameNote` = "Mit Ihrem Zylinder ist die Bildgröße in beiden Richtungen fast gleich, darum steht hier nur ein Wert." (N7 / NEW-9; the plan prescribed it)
- `view.aria.ref.side.od` = "rechte", `view.aria.ref.side.os` = "linke". **Not prescribed by the plan.** The UI-SPEC writes `view.aria.ref.layout.one` as "Nur das {rechte/linke} Glas.", which needs the inflected adjective. I made layout.one "Nur das {side} Glas." and fed {side} from these two keys, following the same pattern as the existing `view.side.od/os`. `view.aria.ref.layout.compare` = "{who}, links Vorher (A), rechts Nachher (B)." reuses `view.ref.who.od/os`, so it needs no new key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base reset**
- **Found during:** startup branch check
- **Issue:** the worktree HEAD was at 47bb4e2, behind the expected base e256740, and the working tree was clean.
- **Fix:** `git reset --hard e256740`, as the worktree_branch_check step prescribes.

**2. [Interface alignment] `power` field per meridian**
- **Found during:** Task 3, while reading the 04-08 plan interface
- **Fix:** each meridian now carries `power`, and the JSDoc in magnification.js and evaluate.js is updated. Commit `1f251a1`.

### Acceptance-criterion note

- `grep -c "toFixed" src/i18n/format.js` returns 1, not 0. The match is the pre-existing header comment "No toFixed: Intl handles rounding and -0." (line 2, unchanged). The code has no toFixed call, and I left the comment alone (surgical-change rule).
- The acceptance list asks for the comments in trace.js to avoid the word "throw", so that `grep -c throw` = 2. I wrote them with "no exception" instead.

## D-30 MCP protocol

Not run. This plan adds no DOM wiring: text.js builders and de-AT strings are not rendered anywhere until 04-08. Nothing visible changed, so there is nothing to screenshot, and no server was started (ground rule 15 does not apply).

## Verification

**Not verified: the full `npm run test:coverage` gate did not pass on this machine.** It exits 1 because two `src/engine/diagnostics.test.js` tests time out at their own 120 s limit: "ENG-07 extremes grid (2,304 specs)" and "MAT-02 optimality fast-check sample". All other tests pass (1884 of 1886, 46 of 47 files). Running the file alone under coverage still timed out (5 min 24 s for the file). Load average was 14 to 26 on 8 cores, because the parallel 04-02 worktree was running.

Why I think this is machine load and not this plan:
- Without coverage the same two tests pass in 15,0 s and 11,2 s (21/21 tests in that file).
- The only change on that path is one `spectacleMagnification` call per `evaluateLens`. Measured cost: 1,98e-4 ms against 1,18 ms per evaluateLens, a 0,017 % share.
- I could not re-run on an idle machine. **The orchestrator or CI should re-run `npm run test:coverage`** to confirm the gate passes.

Other checks:
- **Engine coverage without that file** (`npx vitest run --coverage --project unit src/engine --exclude src/engine/diagnostics.test.js`): 526/526 tests pass, 99,83 % lines and 97,2 % branches overall (gate: 95 / 90). magnification.js does not appear in the uncovered table. trace.js: 100 % lines, 95,65 % branches. Its one uncovered branch, line 78 (the TIR throw in `refract`), was already uncovered before this plan.
- `npx vitest run src/engine/trace.test.js src/engine/magnification.test.js src/engine/evaluate.test.js`: 182/182 pass.
- `npx vitest run src/i18n src/ui/view/text.test.js`: 243/243 pass, including dictionary.test.js (the "Stärke" ban).
- `npm run lint`: exit 0.
- `GITHUB_SHA=$(git rev-parse HEAD) npm run build`: built in 846 ms. The view chunk >500 kB warning was there before this plan.
- `npm run build:e2e && npm run test:dist`: not run, because 04-02 is not merged in this worktree (ground rule 8).

## Known Stubs

None. The builders are complete; 04-08 and 04-09 wire them into the view.

## Threat Flags

None. No new network, storage or DOM surface.

## TDD Gate Compliance

Each task has a `test(04-01)` RED commit followed by a `feat(04-01)` GREEN commit. RED was checked by running the new tests against the unchanged implementation: task 1 had 8 failing, task 2 had 2 failing plus a missing module, task 3 had 50 failing. No refactor commits were needed.

## Self-Check: PASSED

- All six files listed under key-files/created were checked on disk.
- All six commits (4fc2a96, 26180d0, 487a32b, 1f251a1, e8c77c6, e906468) are in `git log`.
- One open item carries over: the full coverage gate timed out under machine load (see Verification).

## Next Phase Readiness

- 04-03 (warp) can call `traceFromEye(lens.surfaces, EYE_POINT_MM, ex, ey)` and do the wearer mirror (wx = −x) once. A tirFront case with a real lens and a back hit inside the outline is pinned: −4,00 CR-39 OD, temporal tan 1,97.
- 04-08 and 04-09 call `refSizeBlock(entries, { picture, compare, rimInField, pastRimInField })` and `refAria(...)`.
