---
phase: 03-3d-lenses-frame
plan: 08
subsystem: ui/view (studio backdrop, quality tiers, context loss)
tags: [VIZ-04, VIZ-06, D-10, D-11, D-12, Pitfall 7, Pitfall 11, Pitfall 12, lens-critic MINOR 8, lens-critic MINOR 12]
requires: [CHART_DISTANCE_MM, intermediates.abbe, createScene, createLensSlots, createFrame, mountView, fmtMs]
provides: [tiers.js (TIER_SETTINGS, pickTier, stepDown, dispersionFor), backdrop.js (createChart, createShadow), scene.applyTier/onTier/onContext/tier/project, lenses.setDispersion/dispersion, __eyeglassView.tier/dispersion/project/sceneInfo, e2e helpers backgroundProbe/isChart, tech.view.tier.*/dispersion.*/exact/remesh/unavailable/reason.*, view.contextLost/contextGone]
affects: [03-09 (runtime step-down via applyTier(stepDown(tier)), chart grazing fade on chart.mesh via sceneInfo, project()), 03-10 (any-pointer touch path, distinct from the tier's primary pointer)]
tech-stack:
  added: []
  patterns: [pure tier logic tested in Node, onTier/onContext hook lists on the scene, canvas textures re-uploaded on context restore, PMREM regenerated on restore, background probe outside the projected chart quad]
key-files:
  created:
    - src/ui/view/tiers.js
    - src/ui/view/tiers.test.js
    - src/ui/view/backdrop.js
  modified:
    - src/ui/view/scene.js
    - src/ui/view/lenses.js
    - src/ui/view/view.js
    - src/ui/pipeline.js
    - index.html
    - src/i18n/de-AT.js
    - e2e/view.spec.js
    - e2e/helpers.js
    - e2e/layout.spec.js
    - playwright.config.js
decisions:
  - "03-08: tech.view.dispersion.on reads ', mit Farbsäumen aus der Abbe-Zahl νₑ (angenähert)', a refinement of the UI-SPEC string ', mit Farbsäumen aus der Abbe-Zahl' (RESEARCH A10: 20/νe stands in for the KHR 20/νd)"
  - "03-08: the tier line says 'mit Farbsäumen' only when at least one slot really gets dispersion > 0 (hoch AND a sourced νe); a custom material without νe on hoch reads 'ohne Farbsäume'"
  - "03-08: the Playwright mobile project sets screen 360 × 780; with the Desktop Chrome descriptor window.screen was 1920 × 1080 and the phone tier never ran. hasTouch already makes '(pointer: coarse)' match, so no media emulation is used"
  - "03-08: the 'VIZ-04 chart through the glasses' pixel probe uses the square centre (255, 95, −200) mm, not (250, 150): (250, 150) is a checker corner where texture filtering mixes ink and paper, and it projects to the top canvas edge"
  - "03-08: scene.js reports context states through onContext hooks; view.js owns the status text, the chart/shadow re-upload and the 'Grafik vom Browser angehalten' reason; a mesh attach during a loss does not clear the status"
metrics:
  duration: ~35 min
  completed: 2026-11-08
  tasks: 2
  files: 14
---

# Phase 3 Plan 08: Studio backdrop, quality tiers and context loss Summary

The view now stands in a studio: an eye chart drawn on our own canvas sits 200 mm behind the frame front and is visible through the lenses. A static contact shadow lies under the frame. Phones start on the 'mittel' tier and desktops on 'hoch', and only the photo look changes between tiers, never the geometry. The view survives a WebGL context loss, and Technische Angaben show the tier, the exactness note and the last 3D re-mesh time.

## What was built

- **`src/ui/view/tiers.js`** (pure, no dependencies or globals). `pickTier({ coarse, minScreen })` returns 'mittel' only for a coarse primary pointer with the shorter screen side < 768, and 'hoch' otherwise. `TIER_SETTINGS` is deep-frozen with the UI-SPEC values. `stepDown` goes hoch → mittel → sparsam. `dispersionFor(tier, νe)` returns 20/νe on hoch, and 0 on the other tiers or without νe. Four Node tests cover these.
- **`src/ui/view/backdrop.js`.**
  - `createChart` draws a 600 × 400 mm plane at z = −`CHART_DISTANCE_MM`: a 10 mm checker in #1a1a1a / #ffffff, plus a 24 mm band with the letter row 'E F P T O Z L P E D'. The cap height is measured to 12 mm. It uses `MeshBasicMaterial({ toneMapped: false })`, an sRGB `CanvasTexture` with mipmaps, and anisotropy `min(8, max)`. `setSize` redraws only when the tier's texture size changes, and it disposes the old texture.
  - `createShadow` draws a 256 × 128 radial gradient once (peak alpha 0,25) on a horizontal plane at y = −(B/2 + 25). `fit` only moves and scales it.
- **`scene.js`.**
  - The start tier is chosen from `(pointer: coarse)` (primary pointer) and `min(screen.width, screen.height)`. The comment explains why 03-10 uses `any-pointer` instead (MINOR 8).
  - `applyTier` sets the pixel ratio and `transmissionResolutionScale`, runs the `onTier` hooks, and then resizes and renders.
  - `webglcontextlost` reports 'lost' and arms a 5 s timer that reports 'gone'.
  - `webglcontextrestored` runs after three.js's own listener. It regenerates the PMREM environment (and disposes the old one), reports 'restored', and renders.
  - `project(x, y, z)` returns canvas CSS px.
- **`lenses.js`.** `setDispersion(tier, abbeBySlot)` writes `glass.dispersion` only when the value changes, and it never touches `transmission` (Pitfall 11).
- **`view.js`.**
  - Creates the chart and the shadow. The shadow is fitted on each drawable frame attach and hidden when there is no frame.
  - Dispersion follows the input's `intermediates.abbe` (it changes on a material change without a re-mesh).
  - Writes to `#tech-view-tier` and `#tech-view-remesh`. The re-mesh time runs from `requestMesh` to the render that shows the attached mesh, and it is kept apart from the ENG-09 timings (Pitfall 12).
  - Context-state text goes to `#view-status`. `#tech-view-unavailable` shows the reasons noWebgl and paused.
  - Debug handle: `tier()`, `dispersion(slot)`, `project()`, `sceneInfo()`.
- **`pipeline.js`.** The load-failure path also fills `#tech-view-unavailable` with 'Laden fehlgeschlagen', and hides it on retry.
- **`index.html` / `de-AT.js`.** Added four `#tech` paragraphs and the UI-SPEC keys (tier ×3, dispersion on/off, exact, remesh, unavailable plus 3 reasons, contextLost, contextGone).

## Verification (run by this executor, sequentially)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run test:coverage` | 42 files, 1734 tests passed; engine coverage All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 330ms` |
| port 4173 before e2e | `000` |
| `npm run test:e2e` (full) | **437 passed, 1 skipped (5.6 m)**, exit 0 |
| `npx vitest run src/ui/view/tiers.test.js` | 4 tests passed (RED commit 0a04514 failed first: no module) |

Acceptance greps:
- `references/` in backdrop.js = 0
- `createElement('canvas')` = 2
- `shadowMap` in src/ui/view/*.js = 0
- `webglcontextrestored` in scene.js = 1
- `PMREMGenerator` in scene.js = 2
- `'tech.view.exact'` = 1

The four new view.spec tests ('VIZ-04 chart through the glasses', 'D-12 tier', 'context loss', '#tech-view-remesh …') pass on both the desktop and the mobile project. Mobile reports `pointer: coarse` true, tier 'mittel', dispersion 0 and chart 1024x683. Desktop reports 'hoch', 20/56 for CR-39 and 20/32 after switching to 1.74.

An earlier, partial rerun (layout + view specs only) had one failure: 'the arriving cross-section does not move the disclaimer' [mobile] timed out in `settled()`, with the result pending for 10 s. It passed 12/12 with `--repeat-each=3` in isolation and passed in both full runs. I count it as load-dependent flakiness, not a regression from this plan. The orchestrator should watch for it.

Probe values seen in a scratch run (default 3/4 view):
- Chart pixels are exactly 255,255,255 and 26,26,26, untone-mapped.
- The left canvas corners lie inside the projected chart quad (pixel 71,71,71 is a mip-filtered checker), and the right corners are outside it. That is why the fixed `pixel(2, 2)` probes had to go.
- The first `tech-view-remesh` on desktop read '3 416,20 ms' (it includes the first program compile under SwiftShader). After that it reads a few hundred ms in headless SwiftShader.

**Not done here (orchestrator):** the D-30 chrome-devtools MCP protocol (screenshots at 1280×800, 412×915 and 320×640; `tier()` with touch emulation; the context-loss screenshots; and the 4× CPU-throttled trace from input to 3D paint, target ≤ 200 ms = INP 'good', web.dev/articles/inp, not a RAIL number). Note for that trace: CDP CPU throttling does not reach workers (01-15), so the mesh build in it is unthrottled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The mobile Playwright project never reached the phone tier**
- **Found during:** Task 2 (scratch probe)
- **Issue:** The Desktop Chrome descriptor reports `window.screen` 1920 × 1080. `(pointer: coarse)` matched, but `minScreen` was 1080, so the mobile project picked 'hoch'.
- **Fix:** Set `screen: { width: 360, height: 780 }` in the mobile project (playwright.config.js), with a comment. No media emulation was needed.
- **Files modified:** playwright.config.js
- **Commit:** 4fb064a

**2. [Rule 1 - Bug] layout.spec 'breakpoint change keeps the view' used a fixed corner pixel probe**
- **Found during:** full e2e run
- **Issue:** The chart covers the top-left canvas corner (it read 71,71,71), so the #f3f4f6 check failed on both projects. This is the same MINOR 12 situation the plan fixed in view.spec.
- **Fix:** Moved `backgroundProbe` and `isChart` into e2e/helpers.js and used them in layout.spec and view.spec.
- **Files modified:** e2e/helpers.js, e2e/layout.spec.js, e2e/view.spec.js
- **Commit:** 4fb064a

**3. [Rule 2 - Missing] The 'Laden fehlgeschlagen' reason was not wired**
- **Issue:** The plan adds `tech.view.unavailable` with three reasons, but only view.js was in scope. The load-failure state lives in pipeline.js.
- **Fix:** pipeline.js `showLoadFailed` fills and shows `#tech-view-unavailable`, and hides it on retry. This avoids a dead dictionary key.
- **Files modified:** src/ui/pipeline.js
- **Commit:** 4fb064a

**4. Chart probe point:** (255, 95, −200) instead of (250, 150, −200). See decisions: (250, 150) is a checker corner and projects to the canvas top edge.

**5. Dispersion label:** the 'νₑ (angenähert)' refinement of the UI-SPEC string, as the plan asked. It is recorded in decisions.

## Known Stubs

None. `tech.view.tier.sparsam` and `applyTier`/`stepDown` exist but are reached only by the 03-09 runtime step-down, as planned.

## Notes for 03-09

- The UI-SPEC chart **grazing fade** (hide the chart beyond 70° from the plane normal) is not implemented here. 03-09 step 5 owns it (`chart.mesh.visible` in afterRender; `sceneInfo().chartVisible` already reports it).
- Call `view.applyTier(stepDown(view.tier()))`. The `onTier` hook already redraws the chart size, updates dispersion and rewrites `#tech-view-tier`.
- The `backgroundProbe` fallback, used when the chart covers all 4 corners, asserts a chart colour at (2, 2). At a distance, mipmapping can give grey there (71,71,71 was seen), so a close-up preset that fills the canvas with chart may need a different fallback.

## TDD Gate Compliance

RED `0a04514` test(03-08) → GREEN `14a5652` feat(03-08). No refactor commit.

## Threat Flags

None. No new network, auth or storage surface. The debug handle adds only the tier name, dispersion values, projections and booleans (T-03-24 accepted).

## Self-Check: PASSED
