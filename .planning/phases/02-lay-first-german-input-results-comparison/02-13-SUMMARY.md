---
phase: 02-lay-first-german-input-results-comparison
plan: 13
subsystem: engine + state + expert-ui
tags: [ANA-01, RES-03, D-30, D-37, cross-section, svg, compare-lane, tdd]
requires: [02-12]
provides:
  - "src/engine/profile.js: meridianProfile({ surfaces, frame, eye }, thetaDeg, samples = 96) → { ok, thetaDeg, s, zFront, zBack, t, ends: [{ s, t, x, y, location }×2], ct } | { ok: false, code: 'NO_CHORD' }; principalMeridians({ cyl, axisDeg }); meridianEndLabels(eye, thetaDeg); END_LABEL_TOL_DEG = 15"
  - "protocol: { type: 'profile', id, items } ↔ { type: 'profile', id, items, computeMs }, injected profileFn"
  - "client: requestProfiles(items) → generation; onProfile({ gen, key, items|null, error? }); one profile job last in the compare lane, LRU cache by key"
  - "UI: #xsec in #expert-analysis (eye picker, #xsec-meridian, #xsec-figure SVG, #xsec-legend, #xsec-nochord, #xsec-table) with #xsec[data-pending]; e2e helper settledXsec"
affects: [src/state/compute-protocol.js, src/state/compute-client.js, src/ui/pipeline.js, src/ui/main.js, index.html, src/ui/style.css, src/i18n/de-AT.js]
tech-stack:
  added: []
  patterns:
    - "A drawing's numbers come from the same engine function as the result (thicknessAt); e2e compares the SVG label with the result card"
    - "Low-priority view work goes last on the compare lane and is requested from the compare paint, so it can never run before the main result"
    - "SVG at 1:1 mm: one user unit = 1 mm; stroke widths, dashes and font size are converted from px with the render-time scale (no vector-effect, no style attributes)"
key-files:
  created:
    - src/engine/profile.js
    - src/engine/profile.test.js
    - src/ui/cross-section.js
    - e2e/xsec.spec.js
  modified:
    - src/state/compute-protocol.js
    - src/state/compute-protocol.test.js
    - src/state/compute-client.js
    - src/state/compute-client.test.js
    - src/ui/pipeline.js
    - src/ui/main.js
    - src/ui/style.css
    - index.html
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/helpers.js
    - e2e/worker.spec.js
    - e2e/layout.spec.js
decisions:
  - "meridianProfile returns NO_CHORD whenever the OC is outside the outline (even-odd test), not only when one side has no hit: a chord through an OC outside the lens would draw lens that does not exist"
  - "Profile jobs live in their own queue behind the compare queue (requestCompare does not clear them, a generation change does); one job per request holding A and B"
  - "With Zyl ≠ 0 the 0° option is labelled 'waagrecht (0°), Hauptschnitt ({power})' when 0° is a principal meridian (axis 0 or 90), so the power is not lost"
  - "Only the current (B, or single) profile is dimensioned in the SVG; A's numbers are in the table column 'Vorher (A)' and in the <desc>"
  - "RES-03 marked complete: the phase-2 views are the result cards (Vorher/Nachher toggle, 02-08) and the cross-section overlay (here). No phase-3 VIZ requirement asks for an A/B 3D comparison, so the 3D view is not part of RES-03"
metrics:
  duration: 27min
  completed: 2026-11-07
  tasks: 2
  files: 17
---

# Phase 02 Plan 13: Querschnitt (cross-section) with principal meridians and A/B overlay Summary

The engine now has a pure `meridianProfile` that cuts the lens along a meridian through the optical centre. It uses `thicknessAt`, the formula behind the result numbers. The worker computes it as the last job on the compare lane, and only while the Experten-Ansicht is on. The page draws it as a 1:1 SVG with the centre and both end thicknesses dimensioned, a text table beside it, and, during a configuration comparison, A solid and B dashed with a text legend.

## Tasks

| Task | Commit | What |
|---|---|---|
| 1 RED | `0d5e287` | profile.test.js (properties and named cases), protocol and client profile tests, e2e/xsec.spec.js, settledXsec. All failed: profile.js was missing, and the e2e failed 4/4 (no #xsec) |
| 1 GREEN | `fea6eea` | src/engine/profile.js, 'profile' protocol branch, client requestProfiles |
| 2 | `b04e46a` | #xsec markup, cross-section.js, pipeline wiring, CSS, de-AT xs.* keys and whitelist test, full e2e |
| cleanup | `4f6721f` | removed the unused `xs.empty` key this plan had added; reworded a profile.js comment (no code change) |

## Engine facts (measured)

- **Property tests** (fast-check, 120 runs each, seeds 13 and 31): Rx in quarter steps, Sph −8…+6, Zyl −4…0, Achse 0…179, all four shapes at their default sizes, PD 30–34, both eyes. Each checked lens is tested on all its principal meridians. Checks: t(0) equals CT within 1e-9, the ends equal `thicknessAt` at the hit points within 1e-9, the ends lie on the outline (distance < 1e-6 mm), t = zFront − zBack, and θ / θ + 180° give the same chord reversed within 1e-9. The `checked ≥ 100` guards pass.
- **Ends vs. minET.** The lens is solved against minET at the 720 outline vertices, and a chord end can fall between two vertices. On a grid of 4 shapes × Sph {−8, −4, −1, 0, 2, 6} × Zyl {0, −1, −4} × Achse {0, 30, 90, 150} × both eyes, over the principal meridians plus 90°, the **worst end t − minET was −1,661e-5 mm**. The stated tolerance is −0,01 mm.
- `nasalSign('OD') = +1` (conventions.js), so OD 0° gives ['nasal', 'temporal']. The end-label cases for 0°, 10°, 30°, 80°, 90°, 120° and 170° (OD) and 0°, 10°, 30°, 90° and 120° (OS) pass, and so does the θ + 180° swap.
- **NO_CHORD** is covered by an engine unit test only. With monoPD 70 the OC is outside the outline and the result carries OC_OUTSIDE_OUTLINE; θ = 0 and θ = 90 both return NO_CHORD. Non-finite surfaces also return NO_CHORD and never throw. The page's `#xsec-nochord` branch is a defensive fallback with no e2e test, as the plan says.
- **Coverage of profile.js:** 97,87 % statements, 93,61 % branches, 100 % functions, 100 % lines. The uncovered branches are 31, 90 and 94: `den === 0`, a non-finite OC and a missing hit on one side while the OC is inside.

## Acceptance greps

- `thicknessAt(` in profile.js: 3. `outlineRadii`: 0. It was 1 after `fea6eea` because a comment named it; `4f6721f` reworded that comment.
- No import from ui/i18n/state in profile.js, and boundary.test.js passes.
- `export function meridianEndLabels`: 1.
- `failCurrent` in compute-client.js: 3 before and 3 after, so no new call site. An interim header comment had raised the count to 4; it was reworded.
- cross-section.js: `createElementNS(` 1 (inside the shared `svgEl` helper, which builds every SVG node). There is no style attribute, `cssText`, innerHTML or `<style` (0), and `stroke-dasharray` appears 1.
- `requestProfiles(` in pipeline.js: 2. One is in `updateXsec`, which returns early unless `isExpert()` is true and `#expert-analysis` is shown; the other is in the sync-mode button path.

## Plan-end verification (real output)

- `npm run lint`: clean.
- `npm run test:coverage` (plan-end run, after `b04e46a`): **34 files, 1537/1537 passed**. All files 98,34 % statements, 96,52 % branches, 100 % functions, 99,15 % lines; profile.js as above. The gate passed.
- `npm test` after Task 2: 34 files, 1537/1537.
- `npm run build`: `✓ built in 135ms`.
- `npx playwright test` (after `b04e46a`): **320 passed (1.9m)**, up from 296 in 02-12. That adds 11 xsec cases and 1 worker.spec sync case, each on desktop and mobile. worker.spec "main result is not delayed by the comparison" passed on desktop (7.8s) and mobile (8.7s).

**ENG-09 (4× proxy, case A), `npm run test:perf` twice.** The Experten-Ansicht is off in the proxy, so the only new main-thread work is one early return in `updateXsec` per compare paint.

| Metric | 02-12 baseline | run 1 | run 2 |
|---|---|---|---|
| input frame median (max) | 16,15 (20,1–20,5) ms | 15,4 (20,8) ms | 15,85 (18,7) ms |
| result | 35,75–35,95 ms | 35,8 ms | 36,55 ms |
| compare paint | 7,25–7,35 ms | 7,65 ms | 7,9 ms |

- The input frame is at or below the baseline.
- Result run 2 is 0,6 ms above the 02-12 band and inside the 02-11 band (35,4–37,15).
- Compare paint is 0,3–0,6 ms above the 02-12 band and inside the 02-11 band (7,45–8,95). One `isExpert()` check and one attribute comparison cannot plausibly cost 0,5 ms, but this was not isolated. It is reported, not explained.
- Verdict (a) `pass: false` is the extreme rescan case. It was the same in 02-09 (worstMs 20,7 at 1×), so it is not new.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] layout.spec 'sticky results column never covers the disclaimer (Experten-Ansicht)' at 1280 px failed in the first full e2e run (2 failed, 318 passed)**
- Found during: Task 2, full e2e.
- Cause: the test turns the switch on and scrolls to the bottom at once. The Querschnitt is drawn one worker job later, so the page grows after the scroll and the disclaimer is no longer in view. The 900 px case passed.
- Fix: the test waits for `settledXsec` before scrolling, so it checks the finished page. The second full run passed 320/320.
- Files: e2e/layout.spec.js. Commit: `b04e46a`.

**2. [Rule 2 - Missing coverage] Sync-fallback e2e for the Querschnitt.**
- The plan says the profile must never run automatically in sync mode, but no test covered it.
- Fix: added a worker.spec case. It aborts the worker, turns the switch on, and checks that no SVG is drawn, that `#xsec[data-pending]` is '' and that 'Vergleich berechnen' is shown. After the click, the SVG and the table (CT 1,8 mm) appear.
- worker.spec was not in files_modified. guardPage fails on an aborted worker request, so this case cannot live in xsec.spec. Commit: `b04e46a`.

**3. [Rule 1 - Visibility] Lens fill.**
- UI-SPEC says the lens fill is `--surface`, but `#expert-analysis` already has a `--surface` background, so the lens would not show against it.
- Fix: `.xs-lens` uses `--bg` (white) with a `--fg` outline; B is `--accent`, dashed, with no fill. Commit: `b04e46a`.

**4. [Rule 1 - Correctness] Stroke widths and dashes in user units, not `vector-effect="non-scaling-stroke"`.**
- The plan suggested non-scaling-stroke with `stroke-width="2"`. Whether dash lengths are then in screen or user units is not something I verified.
- Fix: the code converts 2 px, 1 px, the 6 4 dash and the 14 px text with the render-time px/mm scale, which gives the same on-screen result.

### Notes

- The meridian select has one extra option label, `xs.meridian.hPrincipal`, for "0° is also a principal meridian".
- Also added: `xs.descA` / `xs.descB` (the A sentence in the comparison), `xs.mid` ('Mitte'), `xs.col.*` and `xs.eye.legend` ('Glas'). All are in the placeholder whitelist test.
- An eye without a result clears the section; no text is shown there.
- After `4f6721f` (an unused dictionary key and a comment only) these were re-run: lint, profile/i18n/boundary unit tests (185/185), build, and xsec.spec (22/22). The full e2e and coverage runs above are from `b04e46a`.

## Known limitations / for lens-critic

- **Layout shift when the switch turns on.** `#xsec-figure` reserves no height, so the page below it moves once when the first drawing arrives. The plan sets no budget for this; deviation 1 is its test-side effect. A min-height could be reserved, but the drawing's height depends on the chord and the width.
- **Font size and px/mm** are computed once per render from the figure width. After a window resize the SVG scales as a whole, labels included, until the next input; there is no re-render on resize.
- **NO_CHORD** is stricter than in RESEARCH: any OC outside the outline returns it (see decisions).
- In the A/B overlay only B is dimensioned in the drawing. A's values are in the table and the `<desc>`.

## Requirements

- **ANA-01: complete.** Selectable meridian (0° plus the principal meridians, duplicates dropped), meniscus profile at 1:1, dimensioned CT and both ends, A/B overlay with a text legend. The numbers equal the engine's (unit properties, and e2e against the result card).
- **RES-03: marked complete** (judgement call, flagged). The requirement says "in numbers and in the views". The numbers part was done in 02-08: sentence, table and Vorher/Nachher card toggle. The phase-2 view is now the A/B overlay in the cross-section. The phase-3 3D view has its own requirements, VIZ-01…06, and none of them asks for an A/B comparison, so a 3D comparison is not a v1 requirement. If the user wants the 3D view to show A/B as well, that needs a new VIZ requirement, and RES-03 would go back to open.

## Threat model check

- T-02-35: no `[style]` or `<style>` inside `#xsec` (e2e), and guardPage watches for CSP violations.
- T-02-36: `thicknessAt` is reused; the properties pass, and e2e compares the CT label with `#result-od-ct`.
- T-02-37: generation and key are checked in `onProfile` and again in the paint frame.
- T-02-38: the profile job runs last, is Expert-only, and is requested only from the compare paint.
- No new network, auth or storage surface.

## TDD Gate Compliance

`test(02-13)` `0d5e287` (RED: unit and e2e failed) → `feat(02-13)` `fea6eea` (GREEN) → `feat(02-13)` `b04e46a`. No refactor commit.

## Self-Check: PASSED

- Files: src/engine/profile.js, src/engine/profile.test.js, src/ui/cross-section.js, e2e/xsec.spec.js: FOUND.
- Commits: 0d5e287, fea6eea, b04e46a, 4f6721f: FOUND.
