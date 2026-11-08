---
phase: 03-3d-lenses-frame
plan: 15
subsystem: ui/view (phone bar thumbnail), e2e (D-27 leak test, VIZ-06 proxy, sync modes, CSP)
tags: [UX-03, VIZ-06, D-14, D-27, D-28, R1-8, lens-critic MINOR 5, MINOR 6, MINOR 11, round 2 MINOR 1, round 2 MINOR 3, MAJOR 3, T-03-40, T-03-41, T-03-42, T-03-52]
requires: [scene.js setPass + afterRender (03-05, 03-14), compare3d.js split pass (03-14), camera-math fitBoxDistance (03-09), frame eyeBox (03-07), lens/frame buffer pools with allocCount (03-04, 03-05, 03-07), perf-throttled quiet method (02-22)]
provides: [scene.setThumb / requestThumb / thumbStats (2-pass thumbnail frame), compare3d shownRect() + lastViewports(), controls.busy(), summary-bar enableBarThumb() + fitThumb (thumb-off fallback), debug thumbInfo() / requestThumb(), ?perfmarks u:view-remesh + u:view-input-paint, e2e/view-memory.spec.js, perf view3d block, worker.spec @view tests]
affects: [03-16 (axe matrix: the bar now has a thumbnail; thumb-off state), 03-17 (real-phone: drawImage stall per thumbnail frame, VIZ-06 phone numbers, ENG-09 (c) with 3D)]
tech-stack:
  added: []
  patterns: [one-task 2-pass thumbnail frame (pose, pass, drawImage, restore, pass), wanted-flag deferred while the camera moves, thumbnail only while the bar is shown, text-fit fallback that hides the decoration instead of clipping numbers]
key-files:
  created:
    - e2e/view-memory.spec.js
  modified:
    - index.html
    - src/ui/summary-bar.js
    - src/ui/style.css
    - src/ui/view/scene.js
    - src/ui/view/compare3d.js
    - src/ui/view/controls.js
    - src/ui/view/view.js
    - src/ui/pipeline.js
    - e2e/view.spec.js
    - e2e/perf-throttled.spec.js
    - e2e/worker.spec.js
key-decisions:
  - "03-15: the bar thumbnail is made only while the bar is shown (narrow layout, result cards out of view, not thumb-off); with the 3D view on screen the bar is hidden, so a hidden bar costs no thumbnail pass. A request made meanwhile is re-asked when the bar shows"
  - "03-15: a thumbnail request waits while the camera moves (drag, preset tween, damping); a free-orbit settle requests none (the thumbnail pose does not follow the camera); a preset settle, re-mesh, mode, comparison, resize, tier and context restore do"
  - "03-15: the thumbnail is the largest 4:3 crop of the shown viewport (whole canvas, or the A/B half while split) with the pose fitted to that crop (k = viewport height / crop height), not the whole half letterboxed: a compared lens is ≈ 44 px wide in the 48 px thumbnail instead of ≈ 22 px"
  - "03-15 (Rule 1): below 400 px the bar uses 12 px side padding and 0,875rem values next to the thumbnail; if the values line still does not fit, the thumbnail steps aside (thumb-off) so the numbers are never clipped"
requirements-completed: [UX-03]
metrics:
  duration: ~3 h
  completed: 2026-11-08
  tasks: 2 (+ one Rule 1 fix)
  files: 13
---

# Phase 3 Plan 15: Phone bar thumbnail, D-27 leak test, 4× proxy 3D timings Summary

On phones the sticky summary bar now carries a 48×36 px picture of the lenses. It is copied from the one WebGL renderer with `drawImage` in the same task as the render, framed on the frame front (both lenses, rims, bridge; no temples), and in A/B it crops the shown half of the split layout. A leak test proves that 50+ changes leave geometries, textures, programs and buffer allocations at their warm-up values, and the values equal counts derived from three.js r187 source. The 4× proxy now records 3D re-mesh, orbit and ENG-09 (c) timings with the 3D view and a comparison active, all labelled as software-rendered and worker unthrottled.

## Read first (lens-critic)

- **The copy is a GPU sync point, and in SwiftShader it costs about 1,3 s per thumbnail frame.** `drawImage(renderer.domElement, …)` (and, measured as an alternative, `createImageBitmap`) has to wait until the GPU has finished pass 1. In headless Chromium the GPU is SwiftShader on the CPU.
  - Measured at 412×915, unthrottled, `?perfmarks` `u:view-input-paint`, 8 Sph edits per state:
    - bar shown (thumbnail on): 1 344–1 413 ms;
    - bar hidden (no thumbnail): 37–54 ms;
    - `createImageBitmap` variant (scratch build, not committed): 1 352–1 398 ms. No gain, so the plan's `drawImage` stays.
  - On a phone the stall is one GPU pass plus a small readback. It has not been measured. **03-17 must measure input → 3D paint on the Pixel 7 Pro with the bar shown**, because each re-mesh frame with a thumbnail blocks the main thread until the GPU is done.
  - Mitigations in place:
    - Thumbnail only while the bar is shown. With the 3D view on screen the bar is hidden, because `#result` sits right above the stage.
    - None during camera motion.
    - None after a free orbit.
    - A re-mesh attach carries none while a newer mesh job is already in flight (typing bursts). The last attach carries it.
- **Load and suite cost in SwiftShader.** Time to view ready (median of 5, Playwright, goto → `#view[data-pending]=''`):
  - 1280×800: 3,20 s (baseline 1d6abc4: 3,26 s), unchanged.
  - 412×915 phone: 3,32 s (baseline 2,78 s), **+0,54 s**. The first attach carries the first thumbnail, as the plan says.
  - The full e2e suite went from 11,5 min (03-14) to 14,0 min in the first full run.
  - `view-heat.spec.js:396` (320×640 desktop) went from 23,3 s to 28,0 s with 4 parallel runs, against a 30 s default timeout. Its timeout is now 60 s, with the reason in a comment (deviation 4).
- **Numbers were clipped at 320 px; fixed (Rule 1).** With the 56 px thumbnail column the values line had 232 px. The example needs 235 px and the longest realistic line ('R 16,3 mm · 15 g | L 17,2 mm · 16 g') needs 271 px, so the line ran off the screen edge (screenshot before the fix, superseded).
  - Below 400 px the bar now uses 12 px side padding and the values at 0,875rem: 237 px needed, 240 px available at 320.
  - If a line still does not fit (another font), `fitThumb` hides the thumbnail (`thumb-off`) instead of clipping.
  - Bar height: 56,6 px at ≤ 399 px, 59,6 px at 412 px. Before the change it was 59,6 px everywhere, so the bar is not taller anywhere.
- **The thumbnail is busy.** The eye chart behind the glasses shows as a 10 mm checker (≈ 3,5 thumbnail px). Both lenses and rims are recognisable (screenshots), but a plain background would read more calmly. That would be a pass-local `chart.visible = false`. I did not do it, because the plan's `nonBackgroundRatio > 0,15` check assumes the chart is visible. This is a UI-SPEC question.
- **`lensWidthPx` is the eye-box width (lens + rim), as the plan defines it:** 20,7 px for the example at 48 px (plan estimate ≈ 18 px for the lens alone). In A/B the shown configuration's compare box is 43,9 px (412) / 44,3 px (320).
- **Split crop is a 4:3 crop of the shown half, not the whole half letterboxed.** The plan says to crop the shown half with the source rectangle and letterbox. I take the largest 4:3 rect inside the shown half and fit the pose to it (k = half height / crop height). The source rectangle stays inside the shown half (e2e checks this). The lens is about 44 px wide instead of about 22 px.

## What was built

- **`scene.js`.** `setThumb({ canvas, source, onCopy })`, `requestThumb(inRender)` and `thumbStats()`.
  - When `source()` returns a spec, a frame runs `thumbFrame`: thumbnail pose → pass → `copyThumb` (`fillRect` #f3f4f6 and `drawImage(renderer.domElement, sx, sy, sw, sh, …)`, letterboxed) → restore position and quaternion → pass. All of it runs in one task with no await.
  - `source()` returning null keeps the request (camera moving, bar hidden).
  - A pass counter counts `runPass` calls (a split pass counts as one).
- **`compare3d.js`.**
  - `export function shownRect({ W, H, split, shown }, pixelRatio)` gives the device-px rect of the shown viewport. The object method applies it to the live state.
  - `lastViewports()` (test-only) gives the viewport sizes of the last pass.
- **`view.js`.**
  - `thumbSpec()` returns the front pose, with the target at the frame-front box centre (union of `eyeBox.OD`/`OS`, or the compare box) and the distance from `fitBoxDistance(k·halfV, k·halfH, 4/3)`. The source rectangle is the 4:3 crop of `shownRect()`.
  - Gates: narrow layout, bar shown, not `thumb-off`, context not lost, after the first attach, `!controls.busy()`.
  - Requests come from: re-mesh attach (carried), DBL-only placement, compare state change, mode change, resize (carried), tier change, context restore, and a preset settle (carried in the settle render).
  - A `MutationObserver` on the bar (`hidden`, `class`) and the breakpoint re-asks a pending thumbnail.
  - Debug: `thumbInfo()` and `requestThumb()`. `allocs().page` now includes the frameA pool (it was missing; deviation 3).
  - Behind `?perfmarks`: `u:view-remesh` and `u:view-input-paint`.
- **`controls.js`.** `busy()` is true for a drag, a preset tween, or damping after a drag.
- **`summary-bar.js`, `style.css`, `index.html`.**
  - `<canvas class="bar-thumb" width="96" height="72" aria-hidden="true">` sits in `#bar-view-slot`.
  - `enableBarThumb()` switches the bar to a grid: `48px 1fr`, 8 px gap, the thumbnail spanning both rows. The thumbnail is 48×36 px including its 1 px #d4d4d4 border, with a 4 px radius.
  - `fitThumb()` (see Read first).
  - The accessible name is unchanged: 'Zum Ergebnis: Dickste Stelle · Gewicht R …' (e2e).
- **`pipeline.js`.** Behind `?perfmarks` only, the input timestamp of the latest main request goes into `viewInputs().inputTs`.
- **e2e.**
  - `view.spec.js` UX-03 block (mobile project): editing, orbit, split crop, 320 px fit, no WebGL.
  - `view-memory.spec.js` (D-27).
  - `perf-throttled.spec.js` `view3d` block.
  - `worker.spec.js`: three `@view` tests.

## Verification

### Gates (one after the other, final code)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 46 files, **1786 tests passed** (unchanged; no engine change). All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 365ms`, view chunk 637,72 kB (gzip 167,92 kB), up from 634,03 kB |
| port 4173 before e2e | `000` |
| `npm run test:e2e` | **526 passed, 30 skipped, 0 failed, 0 flaky (14.0 m), exit 0** (03-14: 514 passed / 24 skipped in 11.5 m; +12 tests, +6 project skips) |
| `npm run test:perf` | 2 passed (7.4 m), see below (informational) |

**The first full run (code at 855acec) failed 3 tests, and why.**

- `view-memory.spec.js`: allocPage 10 → 12, from overlapping jobs (see D-27).
- `view-heat.spec.js:396`: 30 s timeout under load (see Read first).
- The known `layout.spec.js:302` flake.

The first two are fixed in 3bd933d. The run above is on 3bd933d, where `layout.spec.js:302` also passed.

### UX-03 e2e (mobile project; all pass)

- **'UX-03 lens view stays visible while editing'.**
  - The bar is shown and `#bar-view-slot` is visible; `.bar-thumb` is 48×36.
  - copies grow after the Sph edit; `passesPerThumbFrame` = 2.
  - `nonBackgroundRatio` 0,97 (> 0,15).
  - `lensWidthPx` OD/OS 20,7 (≥ 16).
  - The camera pose is byte-identical before and after a forced thumbnail frame.
  - The accessible name is unchanged.
- **'UX-03 no thumbnail copy during an orbit'.** A thumbnail is requested after `touchStart` with '3D drehen' on. copies stay equal over 6 drag frames, and +1 after `touchEnd` (reduced motion; with damping SwiftShader needs > 100 frames at ≈ 0,8 s to come to rest).
- **'UX-03 split crop keeps the layout (MINOR 5)'** (412×915).
  - The main pass has 2 viewports (190×285 each).
  - Every thumbnail viewport is one of them; `passesPerThumbFrame` = 2.
  - The source rect lies inside the B half.
  - `memory()` is unchanged.
- **'UX-03 the values are never clipped next to the thumbnail'** (320×640, Sph −12 on both eyes): the line fits, `scrollWidth` 320, bar ≤ 59,6 px.
- **'UX-03 no WebGL'**: the slot stays hidden and there is no `has-thumb`.

### Layout (Playwright against `vite preview`, DSF 2, screenshots looked at)

| Viewport | State | Bar (h) | Thumb box | Values column | scrollWidth / innerWidth | Lens width in thumb | Thumb viewports | Passes |
|---|---|---|---|---|---|---|---|---|
| 412×915 | single | 59,6 | 48×36 at x 16 | 324 px | 412 / 412 | 20,7 / 20,7 (eye box) | 380×285 | 2 |
| 412×915 | A/B split, Vorher | 59,6 | 48×36 | 324 | 412 / 412 | 43,9 (compare box) | 190×285, 190×285 | 2 |
| 412×915 | A/B split, Nachher | 59,6 | 48×36 | 324 | 412 / 412 | 43,9 | 190×285, 190×285 | 2 |
| 320×640 | single | 56,6 | 48×36 at x 12 | 240 px | 320 / 320 | 20,7 / 20,7 | 288×216 | 2 |
| 320×640 | A/B toggle, Vorher / Nachher | 56,6 | 48×36 | 240 | 320 / 320 | 44,3 | 288×216 | 2 |
| 1280×800 | – | no bar | slot hidden | – | – | copies 0 | – | – |

- The longest line at 320 / 360 / 375 / 412 fits: needed = available (240 / 280 / 295 / 324).
- The bar is the only target and stays ≥ 56 px high and full width. The focused Sph field (bottom 306–545 px) is never under the bar.
- In A/B the thumbnail shows the configuration that `#cmp-show` selects, and the bar label has the 'Vorher (A):' prefix.
- **Screenshots (session scratch, not published), absolute paths:**
  - 412×915:
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-412x915-bar.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-412x915-thumb.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-412x915-page.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-412x915-ab-a-bar.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-412x915-ab-b-bar.png`
  - 320×640:
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-320x640-bar.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-320x640-page.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-320x640-ab-a-bar.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-320x640-ab-b-bar.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots15/t15-320--12-bar.png` (longest line, after the fix)
- **The chrome-devtools MCP was not available in this executor session.** The D-30 checks were done with Playwright scripts, and the MCP pass (console list, traces, heap snapshot) is still owed. The heap comparison is marked for the 03-17 human check.

### D-27 leak test (`e2e/view-memory.spec.js`, desktop, reduced motion)

- **Warm-up:** Expert on, Glas → Dickenkarte → Glas, compare start → end, shape Rund, Vorne/Seite/Oben/Zurücksetzen.
- **Snapshot:** `{ geometries 21, textures 6, programs 11, allocPage 10, allocWorker 0 }`.
- **After the changes:** 56 changes (12 Sph, 4 Zyl + 4 Achse, 6 A/B/DBL, 4 shapes, 6 materials, 3 rim depths, 3 stamps with temple, 4 Glas ↔ Dickenkarte, 3 × compare start + end, 4 presets). All values are identical. There are no Three.js warnings.
- **EXPECTED = { geometries: 21, textures: 6 }** was derived before the run, from the resource list and r187 source re-checked in `node_modules/three` 0.187.0:
  - `WebGLGeometries.js` line 67: `info.memory.geometries ++` is in `get()`, which is reached only through `objects.update( object )` (`WebGLRenderer.js` lines 1912 and 1929, in the visible-object walk). `compile()` never counts a hidden mesh (round 2 MINOR 3).
  - G = lens OD/OS/A 3 × 3 + frame 7 + frameA rims 2 + chart checker and band 2 + shadow 1 = 21. The hidden carriers (2 + 2 fade, 1 heat) are not counted.
  - T = PMREM target 1 (`fromScene` keeps it, `dispose()` frees the source target) + chart tile and band 2 + shadow 1 + transmission render target 1 (`WebGLRenderer.js` line 2029) + DFG LUT DataTexture 1 (line 2756 `m_uniforms.dfgLUT.value = getDFGLUT()`) = 6. The counts are taken in `WebGLTextures.js` line 814 (`initTexture`) and line 2090 (`setupRenderTarget`).
  - The first run matched. The DFG LUT was the one entry I had to find in the source (my first list had 5).
- **allocPage 10 is not in EXPECTED.** It equals 5 pools × 2 sets made at mount (one attached plus one spare each), so no pool grew in the sequential run.
- **The first full e2e run failed with allocPage 10 → 12.** The cause was the test, not a leak. Zyl and Achse were typed without a settle in between, so two mesh jobs overlapped, and overlapping jobs need extra sets by design (the pools grow to the input rate, bounded by POOL_CAP).
  - Fix: every change now waits for all lanes (`settledXsec`), then the view, and Zyl and Achse are separate changes.
  - Then 3/3 passed with 4 parallel workers, and it passed in the final full run.

### 4× proxy (`npm run test:perf`, PERF=1, one session, 7,4 min; informational; JSON `test-results/perf-throttled.json`, copy `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/perf15-run2.json`)

Every 3D number is **software-rendered (SwiftShader) and worker unthrottled** (CDP CPU throttling reaches neither the workers, per 01-15, nor SwiftShader). These are not phone numbers.

| Block | Layout | Result | Target |
|---|---|---|---|
| 3D-Neuaufbau, input → 3D paint (10 Sph edits, quiet) | 1280×800 (no bar) | median 55,9 ms, p95/max 90,7 ms | ≤ 200 ms (INP good) |
| 3D-Neuaufbau | 412×915 (bar shown, thumbnail, 2 passes) | median 1 379 ms, p95/max 1 412 ms | ≤ 200 ms |
| Orbit, rAF frame interval (3 s mouse drag) | 1280×800 | median 866,6 ms, p95 900 ms (only 2 mouse moves landed in 3 s) | ≤ 16,7 ms |
| Orbit | 412×915 | median 858,4 ms, p95 900 ms | ≤ 16,7 ms |
| ENG-09 (c) with 3D + comparison (A CR-39, B 1,67; case A, quiet) | 1280×800 | input → result painted: median 29,1 ms, longest 40,6 ms; estimate (overhead 39,1 + 13,6) 52,7 ms | ≤ 100 ms (RAIL) |

The 1280 re-mesh time ends when `render()` returns, while the GPU work is still queued. That is why it is far below the orbit frame time.

**ENG-09 blocks, same session (unchanged measurement; the parser was fixed, deviation 2).** Rule A (case A / B input frames and compare start < 16,7 ms) passes at every rate:

| Rate | Case A frame max | Case B frame max | Compare start max | (c) estimate | Extreme run: frame max / reaction max | Final edge |
|---|---|---|---|---|---|---|
| 1× | 2,1 ms | 2,1 ms | 0,2 ms | 26,0 ms | 880,6 / 885,2 ms | 7,3 mm |
| 2× | 4,0 | 6,9 | 0,4 | 32,0 | 947,8 / 954,2 | 7,3 |
| 4× | 8,2 | 9,2 | 0,7 | 42,1 | 964,6 / 984,2 | 7,3 |
| 6× | 11,4 | 12,9 | 1,4 | 58,6 | 1 061,8 / 1 083,6 | 7,3 |

- 4× case A/B is within the 02-22 4× maximum of 10,0 ms.
- The extreme run (typed key by key while the bench runs) now has frames of about 0,9–1,1 s. This comes from the 3D re-mesh frames in SwiftShader (the 3D view loads in this spec since 03-05), not from 03-15: no 03-15 code runs at 1280×800 without `?perfmarks`.
- Verdicts (a)/(b) are therefore 'fail' in this proxy. They can only be judged on the phone (03-17).
- The ENG-09 test could not run at all before the parser fix, at baseline 1d6abc4 as well (checked).

### Sync modes and CSP (`worker.spec.js`, `@view`, both projects, pass)

- Mesh worker blocked: `#compute-mode` 'worker', `meshMode()` 'sync', `edgeMax('OD')` equals the card at load and after Sph −4.
- Both workers blocked: 'sync' / 'sync', `edgeMax('OD')` equals the card.
- CSP: `view-*.js` and `mesh.worker-*.js` are 200 from `/Eyeglass-Prescription/assets/`. Three.js is bundled into `view-*.js`; there is no separate three chunk. There is no `securitypolicyviolation` and no CSP console message, and the meta string is exactly unchanged.

## Requirements

- **UX-03: Complete.**
  - Phase-2 part: layout from 320 px, tablet and desktop, and German words that never overflow. Covered by `e2e/layout.spec.js`, all of which passes in the final run (including the flaky `:302` this time).
  - Phase-3 part: the lens view stays visible while editing on phones. Covered by the bar thumbnail tests above, at 412×915 and 320×640, single and A/B.
  - Still open for a human (UI-SPEC open items): a real-iPhone look at the thumbnail.
- **VIZ-06: stays Pending.**
  - The memory part is proven (D-27).
  - The 'no visible lag on a mid-range phone' part has only software-rendered proxy numbers. The Pixel 7 Pro measurement is 03-17, and it must include the bar-shown re-mesh (see Read first).

## Deviations from Plan

1. **[Rule 1 - Bug] Bar values clipped at 320 px** next to the thumbnail. Fixed with tighter padding and font below 400 px, plus the `thumb-off` fallback. Commit 855acec.
2. **[Rule 1 - Bug, test] The perf readout regexes** did not accept the de-AT digit-group space ('2 547,50 ms'), so the unchanged ENG-09 test stopped at `readResult` once a SwiftShader render held a result paint for more than 1 s. This was reproduced at baseline 1d6abc4. Only the number pattern changed. Commit 29a9227.
3. **[Rule 1 - Bug] `allocs().page` did not count the frameA pool.** Fixed. The expected mount value is 10 (5 pools × 2). Commit 29a9227.
4. **[Rule 3] `view-heat.spec.js:396` timeout 30 → 60 s** (the thumbnail frames at 320 px, measured above). It is not in `files_modified`. Commit 3bd933d.
5. **[Rule 3] `controls.js` gains `busy()`** (not in `files_modified`). It is needed for 'never during orbit frames' with damping and tweens.
6. **Thumbnail only while the bar is shown, and none while a newer mesh job is in flight.** These are extra gates beyond the plan's media query, for cost (Read first). The plan's 'after each re-mesh' becomes 'after each re-mesh that is the latest'.
7. **Split crop is 4:3 inside the shown half** (Read first), not the whole half letterboxed.
8. **Orbit e2e under reduced motion** (no damping). In SwiftShader damping needs > 100 frames to end. The test still requests the thumbnail mid-drag and proves it waits for the drag to end.
9. **'Camera equals the pose before the edit'** is asserted around a forced thumbnail frame, not around the edit. A re-mesh legitimately re-fits the preset pose (A1), so a pose comparison across the edit would test the refit, not the restore.
10. **Leak test:** 56 changes instead of 52 (Zyl and Achse split), and all lanes idle between changes (see D-27).
11. **3D-Neuaufbau is measured in two layouts** (1280×800 and 412×915) instead of one, so the thumbnail cost shows.

## Open items (for lens-critic and 03-17)

- The real-phone cost of the thumbnail copy (GPU sync) per re-mesh with the bar shown, and its effect on INP while typing on the Pixel 7 Pro.
- Whether the thumbnail should hide the eye chart for a calmer picture (UI-SPEC decision).
- The +0,54 s phone time-to-view-ready in SwiftShader, from the first attach carrying the thumbnail. Deferring the first copy to idle would cost one more pass. Not done.
- The chrome-devtools MCP pass (console at 412/320/1280, traces, heap snapshot before/after 20 changes) is still owed.
- `layout.spec.js:302` is still timing-flaky (pre-existing).
- ENG-09 extreme-run frames around 1 s with the 3D view in SwiftShader. They have to be judged on the phone.

## Known Stubs

None.

## Threat Flags

None. No new network, storage or markup sinks. The thumbnail is an aria-hidden same-page pixel copy (T-03-43 accept). The bar classes and the slot's `hidden` are set through `classList` and the `hidden` property. `?perfmarks` only adds user timings.

## Commits

- 9525d7c feat(03-15): phone bar thumbnail framed on the lenses, split crop keeps the layout
- 29a9227 test(03-15): D-27 leak test, 4x proxy 3D and ENG-09 (c) with 3D, sync modes and CSP
- 855acec fix(03-15): bar values never clipped next to the thumbnail at 320 px
- 3bd933d fix(03-15): no thumbnail in typing bursts; leak test without overlapping jobs
- afceecb refactor(03-15): scene.js header comment without the literal API strings (comment only, after the gates; lint and build re-run)

## Acceptance greps (final code)

- `grep -c "preserveDrawingBuffer" src/ui/view/*.js`: 0 in every file.
- `grep -c "drawImage(renderer.domElement" src/ui/view/scene.js`: 1.
- `grep -c "export function enableBarThumb" src/ui/summary-bar.js`: 1.
- `grep -c "export function shownRect" src/ui/view/compare3d.js`: 1.
- `e2e/perf-throttled.spec.js`: `view3d` 10, `eng09cWith3d` 3, `worker unthrottled` 1.

## Self-Check: PASSED

- Files exist: e2e/view-memory.spec.js, src/ui/summary-bar.js, src/ui/view/scene.js, src/ui/view/compare3d.js.
- Commits exist: 9525d7c, 29a9227, 855acec, 3bd933d, afceecb.
