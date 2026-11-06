---
phase: 01-verified-engine-live-pipeline
plan: 07
subsystem: engine-frame
tags: [frame-outlines, decentration, fitting-height, pd, frame-01, eng-05]
requires:
  - 01-02 engine (evaluateLens, mirrorOutlineX, maxRadiusFromOC, computeMetrics)
  - 01-06 material select and page structure
provides:
  - "SHAPES (rund, rechteckig, panto, pilot): radius(phi, eyeSign), defaults {A, B, DBL}, xSymmetric"
  - "frameOutline(shape, A, B, eye, n = 720): arc-length resampled, bbox exactly A x B, CCW, OS = mirrorOutlineX(OD), memoised"
  - "evaluateLens(spec, { outlinePoints }) on real outlines; INVALID_SPEC unknown-shape"
  - "Page: #frame-shape, #frame-a/b/dbl, #rx-od-pd, #rx-os-pd, #result-{od,os}-dec"
affects: [01-08, 01-09, 01-10, 01-11]
tech-stack:
  added: []
  patterns:
    - "x-symmetric shapes are resampled over the upper half and mirrored, so they are bitwise symmetric about the x axis"
    - "Exact etMax/etMin ties go to the larger y (eye-independent location label)"
key-files:
  created:
    - src/engine/frame/shapes.js
    - src/engine/frame/outline.test.js
  modified:
    - src/engine/frame/outline.js
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/engine/metrics.js
    - index.html
    - src/ui/main.js
    - src/ui/style.css
    - src/i18n/de-AT.js
    - e2e/smoke.spec.js
decisions:
  - "[01-07]: Pilot weight is max(0, −sin φ)² instead of max(0, −sin φ). The RESEARCH form has a slope kink (a corner) at 3 and 9 o'clock that breaks the 1 % arc-length spacing at 62×28. Lower half still widened temporally, tapered nasally. Orientation unverified: references/ has no pilot image."
  - "[01-07]: computeMetrics breaks exact etMax/etMin ties toward the larger y. Before this, identical Rx on rechteckig reported 'oben, schläfenseitig' for OD and 'unten, schläfenseitig' for OS."
  - "[01-07]: frameOutline memoises OD outlines (16 entries, copies returned). Per-lens evaluate fell from about 1.8 ms to 0.2 ms on desktop. Building the outline cost more than the solve."
  - "[01-07]: Only FRAME-01 and ENG-05 are marked complete. ENG-04 needs mixed-sign meridians (cyl, 01-08). ENG-06 stays pending as decided in 01-02."
metrics:
  duration: 9min
  completed: 2026-11-06
  tasks: 3
  files: 11
---

# Phase 01 Plan 07: Frame Shapes and Per-Eye Decentration Summary

The engine now computes each lens on a real parametric outline: Rund, Rechteckig, Panto or Pilot, scaled exactly to A × B. Nasal decentration (A + DBL)/2 − mono PD is applied per eye, and fitting height is supported in the engine. The page lets the user pick the shape, A/B/DBL and PD per eye, and shows the decentration.

## Recorded values

−6,00, rechteckig 52×40, DBL 18, PD 32, CR-39 (decentration 3 mm nasal):

| Eye | ET nasal | ET temporal | CT | ET max |
|-----|----------|-------------|----|--------|
| OD | 5.0546 mm | 7.0556 mm | 1.8 mm | 8.0250 mm, temporal-superior (corner) |
| OS | 5.0546 mm | 7.0556 mm | 1.8 mm | 8.0250 mm, temporal-superior |

- **Convergence (ENG-04 tier 4):** pilot 58×50/14, PD 30, n = 720 vs 5760. At +6, ΔCT = 1.1e-5 mm and ΔetMax = 3.2e-5 mm. At −6, ΔCT = 0 and ΔetMax = 1.2e-5 mm. The limit is 0.005 mm.
- **MAT-02 on the real outline:** +12,00, rechteckig 62×55/24, PD 25 gives ρmax = 51.661 mm. That makes maxD1 = 9.318 (it matches the planning prototype 51.66 / 9.32). The chosen D1 is 6.687, CT 33.34 mm, and vogelMaxThickness is null.

## Pilot orientation (open question)

- **Evidence:** I viewed every image in `references/`: `000.png` (slider UI), `00_brillengroesse.png` (size guide, rectangular line drawings) and `01-brille.png` (rounded-rectangle acetate frame). None of them shows a pilot frame, so there is no reference image.
- **Chosen side:** the lower half is widened on the temporal side and tapered on the nasal side, following the RESEARCH form. This is marked `[ASSUMED, unverified — no pilot image in references/]` in `shapes.js` and tested in `outline.test.js`.
- **Open question for the user and for the lens-critic review in 01-11:** classic teardrop aviators may be deepest on the lower nasal side. That note is unverified and from memory, so I did not switch on it.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | ff6e50e | test(01-07): add failing tests for parametric frame outlines |
| 1 GREEN | 5a2a36d | feat(01-07): implement parametric frame outlines |
| 2 RED | a58a4f7 | test(01-07): add failing tests for evaluate on frame outlines |
| 2 GREEN | 6aee67e | feat(01-07): evaluate lenses on real frame outlines with per-eye decentration |
| 3 | 2f86cab | feat(01-07): add frame shape, A/B/DBL and per-eye PD controls |

## Verification

- `npm run lint`: exit 0.
- `npm run test:coverage`: 699 tests pass. All files are at 98.26 % lines and 97.45 % branches, above the thresholds of 95 % and 90 %.
- `npx vitest run src/engine/evaluate.test.js -t decentration`: 18 tests pass.
- `npm run build && npm run test:e2e`: 18/18 pass on desktop and mobile, including "frame shape and PD change the edge" and the axe check.
- In `index.html`, the 6 new control ids are present (`grep -cE 'id="(frame-shape|frame-a|frame-b|frame-dbl|rx-od-pd|rx-os-pd)"'` = 6). It has no fitting-height field (count 0).
- Mobile screenshot (Pixel 7, 412 px): no horizontal overflow (scrollWidth 412).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pilot outline corner broke even arc-length spacing**
- **Found during:** Task 1
- **Issue:** The RESEARCH weight `max(0, −sin φ)` has a slope kink at φ = 0 and π. At pilot 62×28 the segment lengths deviated by 1.21 % (the limit is 1 %).
- **Fix:** I squared the weight, which makes the curve smooth (C¹). The orientation and the asymmetry (> 0.5 mm, tested) are unchanged.
- **Files:** src/engine/frame/shapes.js
- **Commit:** 5a2a36d

**2. [Rule 1 - Bug] Eye-dependent location label on exact thickness ties**
- **Found during:** Task 2
- **Issue:** On x-symmetric shapes, mirrored points (x, ±y) have bitwise-equal thickness. With the first-index tie-break, OD picked the upper point and OS picked the lower one, because the OS index order is mirrored. So the same Rx was reported as "oben" in one eye and "unten" in the other.
- **Fix:** In `computeMetrics`, exact ties now go to the larger y. The sphere mirror test asserts that the labels are equal for all four shapes.
- **Files:** src/engine/metrics.js
- **Commit:** 6aee67e

**3. [Rule 2 - Performance] Outline memo**
- **Issue:** Building the outline (5760 dense samples) took about 1.6 ms, versus about 0.2 ms for the solve. It runs on every keystroke and on the phone budget (ENG-09).
- **Fix:** I added a 16-entry memo of OD outlines that returns copies. A test checks that copies are independent and that eviction works.
- **Files:** src/engine/frame/outline.js, src/engine/frame/outline.test.js
- **Commit:** 6aee67e

**4. Minor:** the plan said to catch the throw for an unknown shape. Instead, `invalidReason` checks `Object.hasOwn(SHAPES, shape)` up front and returns the same `INVALID_SPEC {reason: 'unknown-shape'}` result. I added `fieldset`/`legend` styling to `src/ui/style.css`, which is not in the plan's file list. The worst-case timing bench keeps its fixed round 50/18 frame, so the `tech.timingWorst` label stays accurate. The old `frame.note` key was removed because nothing used it any more.

## Known Stubs

None. Range validation of A/B/DBL/PD is phase 2 (FRAME-02, RX-04), as the plan specifies: phase 1 shows parse errors only, and engine rejections appear as `result.notComputable`.

## Notes for later plans

- BLANK_EXCEEDS_STOCK and OC_OUTSIDE_OUTLINE are still never emitted. This plan did not cover them; they belong to 01-10.
- 01-08's point-reflection tests can rely on the bitwise x-axis symmetry of rund/rechteckig and on OS = mirrorOutlineX(OD) for every shape.

## Self-Check: PASSED
