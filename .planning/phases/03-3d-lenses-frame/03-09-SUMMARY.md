---
phase: 03-3d-lenses-frame
plan: 09
subsystem: ui/view (camera controls, presets, default fit, chart cover)
tags: [VIZ-03, VIZ-06, D-15, D-18, D-19, D-20, lens-critic MAJOR 2, lens-critic MINOR 8, lens-critic MINOR 13, R1-3, R1-4, A1, A2]
requires: [buildFrameMesh camera data (03-03), frame.cameraData (03-07), scene.applyTier/project (03-08), stepDown (03-08), backdrop chart (03-08), bevelSplit (03-01)]
provides: [camera-math.js (fitDistance, fitBoxDistance, fitPointsDistance, pxPerMm, cameraContext, presetPose, presetPoses, controlLimits, sideEye, keyStep, easeInOutCubic, chartHidden, chartRect, createFrameMonitor, basisOf), controls.js createControls (goTo incl. ('heat', eye), refresh, viewName, limits, state, pointer), scene.beforeRender/onResize/setInteracting, chart.setRect/rect, buildFrameMesh boundingBox, __eyeglassView.camera/limits/sideEye/pixels, sceneInfo.chartRect, e2e helper isChartish]
affects: [03-10 (touch path: controls.pointer false under any-pointer coarse; '3D drehen' connects), 03-11 (near-temple fade in Seite), 03-12 (goTo('heat', eye)), 03-13 (labels: place() now clamps into the stage), canvas aria viewName keys]
tech-stack:
  added: []
  patterns: [pure camera math tested in Node with engine-built frames, tween inside the scene's beforeRender (render on demand), limits derived from preset poses, repeated one-period checker tile for an arbitrarily sized chart, overlay hint at its static position (no layout shift)]
key-files:
  created:
    - src/ui/view/camera-math.js
    - src/ui/view/camera-math.test.js
    - src/ui/view/controls.js
    - e2e/view-controls.spec.js
  modified:
    - src/engine/mesh/frame.js
    - src/engine/mesh/frame.test.js
    - src/state/mesh-protocol.js
    - src/state/mesh-protocol.test.js
    - src/ui/view/scene.js
    - src/ui/view/view.js
    - src/ui/view/frame.js
    - src/ui/view/backdrop.js
    - src/ui/view/labels.js
    - index.html
    - src/ui/style.css
    - src/i18n/de-AT.js
    - e2e/view.spec.js
    - e2e/helpers.js
    - .planning/phases/03-3d-lenses-frame/03-CONTEXT.md
    - .planning/phases/03-3d-lenses-frame/03-UI-SPEC.md
decisions:
  - "03-09 A1: the default and Oben presets fit the projected frame silhouette (frame world AABB + both eye boxes), perspective-exact per corner for the stage aspect, + 8 %, with the target at the silhouette centre in the plane through the bridge centre normal to the view. A bridge-centred box fit reached only 76,7 px R–L at 412×915 (< 77 px acceptance); centred gives 103,6 px (2,4 × the old 42,6 px)"
  - "03-09 A1 also applied to Oben (frame front + temples, the same sphere-fit defect); Vorne keeps the planned sphere fit of the frame front"
  - "03-09 A2: chart rectangle from chartRect over default, Vorne and both heat poses at [minDistance, maxDistance] and the current stage aspect, recomputed on frame attach and resize; 20 mm pad, snapped to the 20 mm checker period; the checker is a RepeatWrapping one-period tile and the letter band a separate plane 0,5 mm in front"
  - "03-09: buildFrameMesh returns boundingBox (world AABB of every frame vertex); the mesh protocol passes it through"
  - "03-09: a frame attach or resize while a preset is shown re-cuts to that preset's new pose; a running tween is retargeted; a freely turned view ('free') stays where it is"
  - "03-09: the view becomes 'free' only when a drag actually moved the camera (start → end), so a click that focuses the stage keeps the preset"
  - "03-09: frame-time monitor counts render-to-render intervals while dragging or while damping moves after a drag; gaps ≥ 250 ms are idle time, not frame time"
  - "03-09: the keyboard hint (#view-keys) shows as an overlay on the stage's bottom edge (absolute at its static position, pointer-events none), so focus changes never move the toolbar"
  - "03-09: eye labels are clamped inside the stage (labels.js place); the A1 close-up pushed 'L – nicht berechnet' past a 328 px phone stage"
metrics:
  duration: ~60 min
  completed: 2026-11-08
  tasks: 2
  files: 20
---

# Phase 3 Plan 09: Mouse and keyboard camera controls, presets, A1 default fit and A2 chart cover Summary

Mouse and keyboard now control the one camera: drag rotates, Shift- or right-drag pans, and the wheel zooms only while the stage has focus. The keys are arrows, Shift+arrows, + / = / − and Pos1. Vorne / Seite / Oben / Ansicht zurücksetzen are real buttons with 450 ms tweens, or an instant cut under reduced motion. Seite is fitted to the side eye's lens + rim (4,35 px/mm on a 288×216 stage). The orchestrator amendments are in: the default view is now fitted to the frame's projected silhouette (A1, 2,4× larger lenses on a phone), and the eye chart fills the whole stage at every allowed zoom (A2).

## What was built

- **`camera-math.js`** (pure, no three/DOM; 13 Node tests). It covers:
  - the sphere, box and perspective point fits, and `pxPerMm`;
  - `cameraContext` from the frame item's camera data, falling back to the lens sphere;
  - `presetPose` / `presetPoses` (default, front, side, top, heat);
  - `controlLimits` (R1-4) and `sideEye` (MINOR 13);
  - `keyStep`, `easeInOutCubic` and `chartHidden` (70°);
  - `chartRect` (A2) and `createFrameMonitor` (median of 30 > 20 ms).

  The test frames come from `buildFrameMesh` (52□18 and 62□24, temple 140).
- **`controls.js`.**
  - `new OrbitControls(camera)` is connected only when `!matchMedia('(any-pointer: coarse)')` (MINOR 8).
  - Damping is 0.08 and turns off under reduced motion. Polar limits are 0,05…π−0,05.
  - Zoom works only while the stage has focus; a pointerdown focuses the stage (preventScroll).
  - The keyboard uses its own keydown handler on the stage and works on every device.
  - Preset tweens run as target lerp plus spherical (shortest azimuth) interpolation inside `scene.beforeRender`, so rendering stays on demand.
  - `refresh()` derives the limits from the presets on every frame attach and resize. `goTo('heat', eye)` is ready for 03-12.
- **`scene.js`.**
  - New `beforeRender` / `onResize` hooks and `setInteracting`.
  - The render-interval monitor steps the tier down once via `applyTier(stepDown(tier))` (hoch → mittel → sparsam) and never back up.
  - The old `fit()` and its constants are gone; camera-math owns them.
- **`view.js`.**
  - Builds the camera context and computes the side eye from `bevelSplit(etMax, rim).front + .back`.
  - Hides the chart beyond 70°, enables the preset buttons after the first attach, and fills `#view-hint` (pointer path) and `#view-side-note` (Seite).
  - New debug handle entries: `camera()`, `limits()`, `sideEye()`, `pixels()`, and `sceneInfo().chartRect`.
- **`backdrop.js` (A2).** The checker plane is sized by `setRect()` from a repeated 20 mm tile (squares stay 10 mm and sharp, in the 03-08 phase). The letter band is its own 600 × 24 mm plane.
- **Engine.** `buildFrameMesh` returns `boundingBox` (world AABB), and the protocol passes it through. Its tests were extended.
- **Markup / CSS / strings.**
  - Markup: `#view-keys` (described-by of the stage), `#view-tools` with the "Blickrichtung" group of 4 buttons (disabled until the first frame), `#view-hint` and `#view-side-note`.
  - CSS: 44 px targets, flex wrap with an 8 px gap, a 3 px accent focus ring, and the keyboard hint as a stage-bottom overlay.
  - Strings: the UI-SPEC keys plus `view.viewName.*` and `view.side.*`.

## A1 / A2 numbers (example frame Rechteckig 52×38/18, temple 140, Sph −2,75 Zyl −0,50)

| | Before | After |
|---|---|---|
| Default distance at 382×287 | 1081 mm (sphere about origin) | 450 mm (target −29,5 / 13,8 / −25,2 mm) |
| R–L lens centres at 412×915 | 42,6 px (orchestrator screenshot; unit test reproduces 42–44) | 103,6 px (unit); e2e asserts ≥ 77 px |
| Seite px/mm at 288×216 | — | 4,35 (≥ 3, also B = 55) |
| Limits (4:3) | fixed 60 mm target radius | min 70,4 / max 900,9 mm, target radius 87,1 mm (62□24: 98,0) |
| Chart plane at 16:10 | 600 × 400 mm | x −380…640, y −420…220 mm (aspect 3,6: x −760…1880) |

## Verification (run by this executor, sequentially)

| Check | Result |
|---|---|
| `npm run lint` | exit 0, clean |
| `npm run test:coverage` | 43 files, **1747 tests passed**; engine coverage All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 411ms` |
| port 4173 before e2e | `000` |
| `npm run test:e2e` (full) | **457 passed, 3 skipped (8.2 m)**, exit 0 |
| RED `0c4d85d` | camera-math.test.js failed (no module) before GREEN `c20d486` |

Acceptance greps (Task 2), all as required:
- `listenToKeyEvents` in src/ui/view/*.js = 0.
- `new PerspectiveCamera` = 1 (scene.js).
- `any-pointer: coarse` in controls.js = 2, and `'(pointer: coarse)'` = 0.
- `controlLimits(` in controls.js = 1, and `maxTargetRadius = 60` = 0.
- `data-preset="side"` = 1, and `setAnimationLoop` = 0.

Task 1 greps: three/window/document = 0, `export function controlLimits` = 1, `export function fitBoxDistance` = 1.

**Orbit trace (project note, Playwright + CDP).** 1280×800, `Emulation.setCPUThrottlingRate` 4, rAF frame times during a 3 s scripted mouse drag:
- **Throttled ×4:** median **866,6 ms**, p95 **883,3 ms**, 9 frames.
- **Unthrottled:** median 833,3 ms, p95 850,0 ms.
- Renderer: `ANGLE (… SwiftShader Device (Subzero) …)`. This is **software-rendered headless SwiftShader**, so the GPU work is CPU-bound in the GPU process, which CDP throttling does not reach.

This number says nothing about a real phone. The 16,7 ms target was not measurable here. The 03-08 build measures the same, about 950 ms per frame (checked by building commit 3843794), so this is not a regression. The tier stayed 'hoch', because the monitor needs 30 frames and the trace had only 9.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The frame world AABB was not available for A1**
- **Issue:** A1 projects the frame's AABB corners, but the frame item carried only spheres and eye boxes.
- **Fix:** `buildFrameMesh` returns `boundingBox`, and the protocol passes it through, with tests.
- **Files:** src/engine/mesh/frame.js(+test), src/state/mesh-protocol.js(+test)
- **Commit:** 2f940a1

**2. [Rule 1 - Bug] A focus change moved the toolbar under the pointer**
- **Found during:** A2 e2e.
- **Issue:** A visible `#view-keys` between the stage and the toolbar disappeared on mousedown (stage blur), so the preset button moved before mouseup and the click was lost.
- **Fix:** The hint is an overlay on the stage's bottom edge (absolute at its static position, pointer-events none), so the layout never shifts.
- **Commit:** 8393c68

**3. [Rule 1 - Bug, caused by A1] A wide eye label left the phone stage**
- **Issue:** 'L – nicht berechnet' stuck out of the 328 px stage (view.spec 'blocked eye' on mobile).
- **Fix:** `labels.place` clamps the span inside the stage.
- **Commit:** 8393c68

**4. [Rule 1] 03-08 e2e probes assumed the fixed 600×400 chart and the old default pose**
- **Fix:** `backgroundProbe` reads `sceneInfo().chartRect`. When the chart covers every corner (now the default), it accepts a neutral chart grey (`isChartish`), since mipmapping mixes ink and paper at distance.
- The chart-through-the-glasses probe now searches the 20 mm square-centre grid for the centre nearest the canvas top-left.
- **Files:** e2e/helpers.js, e2e/view.spec.js
- **Commit:** 8393c68

**5. e2e timing.** The plan expects "≤ 600 ms after the tween". In headless SwiftShader one frame of this scene takes about 0,9–1,2 s alone and several seconds with 4 workers (measured; the same on 03-08).
- So only 'VIZ-03 presets' runs the animated tween, with a 30 s wait.
- 'VIZ-03 reduced motion' tests the instant cut.
- The Seite, keyboard, chart-fade and A2 tests use reduced motion, so they do not wait for frames.

**6. Executor refinements of A1 (recorded in CONTEXT/UI-SPEC):**
- The target is centred on the silhouette (required to reach the 77 px acceptance).
- The fit is perspective-exact; it reduces to `fitBoxDistance(halfV, halfH, aspect)` in the target plane, which is unit-tested.
- Oben uses the same fit.

**7. Additions beyond the plan's strings:**
- `view.side.note` with `view.side.od/os`, because `#view-side-note` exists in the markup and needs text.
- `view.viewName.od/os` for the `{eye}` of `view.viewName.side`.
- `controlLimits` gets the heat pose for both eyes (6 poses, a superset of the "five").

**8. [Rule 1] Orphans removed:** `frame.radius()` and the frame `sphere` field (only the removed refit used them), and `scene.fit()` with its constants.

## For lens-critic

- **Phone tier 'mittel' (orchestrator note, not changed here):** the checker seen through the lenses looks blurred rather than minified. This is probably the reduced `transmissionResolutionScale` (0,5). The tiers were not touched in this plan.
- **Step-down sensitivity:** the monitor needs 30 interaction frames. On a device as slow as SwiftShader (≈ 1 frame/s) that is about 30 s of dragging before the first step down. Consider a time-based window if real devices show this.
- **Default target moved off the bridge centre (A1).** The orbit pivot is now the silhouette centre, about 41 mm from the origin and behind the bridge. Pos1 / Ansicht zurücksetzen return there.
- The D-30 visual phone check (screenshots at 1280×800 / 412×915 / 320×640, Seite protrusion pixels) is left to the orchestrator, as agreed. Automated e2e checks: Seite 10 mm ≥ 30 px at 320×640; A1 R–L ≥ 77 px with all frame AABB corners inside the stage; A2 four corners are chart pixels in default and Vorne, also at maxDistance, at 1280×800, 412×915 and 880×400.

- **Requirements:** `requirements mark-complete VIZ-03 VIZ-06` ticked both. I reverted that, so REQUIREMENTS.md still shows them Pending:
  - VIZ-03 also needs touch (03-10).
  - VIZ-06 "no visible lag on a mid-range phone" cannot be shown in headless SwiftShader.

## Known Stubs

None that block the goal. Two things exist but are not used yet:
- `view.viewName.*` keys: the canvas aria name that uses them is a later plan (UI-SPEC "Canvas accessible name").
- `goTo('heat', eye)`: 03-12.

`#view-hint` stays empty on the touch path until 03-10 adds the '3D drehen' hint.

## TDD Gate Compliance

RED `0c4d85d` test(03-09) → GREEN `c20d486` feat(03-09). No refactor commit.

## Threat Flags

None. There is no new network, storage or auth surface. Input events drive only the camera (T-03-25…27 and T-03-50 mitigated as planned: focus-gated wheel, one camera with the e2e texture/program equality check, one-way step-down, and the Seite ≥ 3 px/mm check).

## Self-Check: PASSED
