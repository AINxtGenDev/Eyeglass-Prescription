---
phase: 04-refraction-view-offline
plan: 09
subsystem: ui/view (Durchblick)
tags: [REF-01, REF-02, durchblick, rim, leaves, ticks, one-panel, states, M4, e2e]
requires: [04-03 warp leaves + REF_CLASS, 04-07 handover/update, 04-08 Durchblick first slice + M3 gate]
provides: [leaf-drawn rim and edge band, reference ticks, one-panel picker + default eye, blocked/empty/failed/no-WebGL states, stage-visibility rule (M4), ref-size.js no-chunk size block]
affects: [04-10 degradation (excluded off->on sample, lastJobExcluded), 04-11 A/B in Durchblick, 04-12 fullscreen (redraw without re-trace), 04-13 result review]
tech-stack:
  added: []
  patterns: [one leaf geometry per panel with three material groups, SVG ticks with presentation attributes only, IntersectionObserver-gated warp lane, thumbnail with its own render pass]
key-files:
  created: [src/ui/view/ref-size.js]
  modified: [index.html, src/ui/style.css, src/ui/pipeline.js, src/ui/summary-bar.js, src/ui/view/ref-layout.js, src/ui/view/ref-layout.test.js, src/ui/view/ref-mode.js, src/ui/view/refraction.js, src/ui/view/scene.js, src/ui/view/view.js, e2e/view-ref.spec.js]
decisions:
  - "Mixed grid cells are drawn only from the engine leaves (one flat quad per leaf, class and uv of its centre ray); the grid interpolant is used only for cells whose four corners share a class"
  - "N11 wins over the older 'ticks drawn over the rim' sentence: a tick whose 14 px sample point is on rim face or edge band is hidden (so on the rim side of the item-12 case the right-edge ticks are hidden)"
  - "N4: the white tick under-stroke is 6 px (not 4) after the DPR 1 / 2,6 check"
  - "M4 mesh deferral: while the Durchblick stage is on screen the re-mesh is skipped (meshDeferred); it runs when the stage leaves the screen or on leaving the Durchblick, which then shows 'view.badge.updating' until the mesh attaches"
  - "The no-WebGL / no-chunk size block lives in a new three-free module ref-size.js (shared by ref-mode.js, view.js and pipeline.js)"
metrics:
  duration: ~95 min
  completed: 2026-11-13
  tasks: 2
---

# Phase 4 Plan 09: Durchblick at its edges and in every state Summary

The rim and edge band are now drawn from the engine quadtree leaves, so they sit exactly where the warp classes put them. Every panel has the fixed reference ticks. Below 360 px the Durchblick shows one lens with the "Durchblick für" picker and the default-eye rule. Blocked eyes, no computable eye, warp failure, no WebGL, a failed 3D chunk and context loss each show what they are. An IntersectionObserver keeps the warp lane quiet while the stage is off screen and defers the re-mesh while it is on screen. The M3 hard gate stays green with its literals unchanged.

## What was built

### Task 1 (6c519a2): one-panel mode, states, stage visibility

- `ref-layout.js` `defaultRefEye(mags)`: the eye with the larger max |SM − 1| over its meridians. Ties within 0,05 percentage points (plus 1e-12 for float noise) go to OD. A null eye never wins, and both null gives OD.
- `#view-ref-eye` (index.html) is shown below a 360 px stage. The default-eye rule is applied once on each switch to one panel, including entry. The picker re-lays out the panel at the same pxPerTan, and the side sentence reads "Sie schauen selbst durch Ihr linkes Glas."
- Blocked eye: no warp item is posted for it (T-04-37). Its panel is the `#f3f4f6` fill with the centred pill "Linkes Glas – nicht berechnet" (`refraction.setBlocked`, created lazily) and no ticks. The size line reads "Linkes Glas: nicht berechnet".
- No computable eye: plain fill, no pills, caption `view.empty`, and `#view-ref-size` hidden.
- Failure: an `items: null` reply or any `ok: false` item shows the 03-06 Fehler-tier box in `#view-status` with `view.ref.failed` and "Erneut versuchen". The button re-posts the job and focuses the Durchblick radio. The size block stays.
- Context restore: `refraction.reupload()` (04-08) plus `refMode.restoreStatus()`, so the restore no longer blanks a loading or failure status. The picture is redrawn from the last warp without a new trace (`drawnGen` unchanged, test).
- M4: an IntersectionObserver on `#view-stage` (threshold 0).
  - Off screen: no warp job. The re-mesh and the bar thumbnail run as in Glas, and the thumbnail gets its own 3D pass (`scene.js` `thumb.pass`).
  - On screen: the re-mesh is deferred (`meshDeferred`), and `holdBarThumb()` gives the `.thumb-off` text bar in the overlap.
  - Off → on: one job for the latest input (`lastJobExcluded` for 04-10).
  - Leaving with a deferred re-mesh: it runs, and the badge reads "3D wird aktualisiert …" until it attaches.
- No WebGL (`?nowebgl`) and a failed 3D chunk: `#view-ref` shows only the size block (no edge, weak or rim notes) and `view.ref.scope.noPicture`. This comes from `ref-size.js`, which imports no three.js. `pipeline.js` calls it in the import-failure branch, in the mount-error branch and on every later input while the view has failed.
- Test handle `ref()`: `jobs`, `lastJobExcluded`, `onScreen`, `failed`, `meshSent`, `meshDeferred`.

### Task 2 (26885d7): leaves, no-view zones, ticks

- `refraction.js`:
  - Every grid cell whose corners differ is skipped in the grid index lists. Its leaves are written into one leaf geometry per panel with three material groups (chart / rim / fill). Each leaf is a flat quad with the uv of its own centre ray, and Ohne Glas uses the leaf centre's eye tan. So no chart is ever interpolated across a class boundary (T-04-36).
  - The leaf buffers grow by doubling, and the old geometry is disposed (the leak test passes).
  - Leaf arrays are length-checked before any write (T-04-31).
- Class-3 zones (4-connected grid points) of at least 48 × 24 px get the `view.ref.noView` pill (pooled).
- `svg#view-ref-ticks` is the first child of `#view-labels`, with one `<g data-panel>` per panel and one `<g class="ref-tick" data-edge data-n>` per tick. Each tick is two `<line>`s with presentation attributes only (`grep -c "style=" refraction.js` = 0):
  - 12 px long, a 6 px `#ffffff` under-stroke, a 2 px `#1a1a1a` core, butt caps.
  - Built on a layout change only, and shown while the panel shows a picture.
  - Hidden for the blocked fill, the first-picture status and the error box.
  - N11 per tick from the drawn warp (`ref-layout.js` `classAt` / `tickVisible`).
  - In Durchblick the badge gets `z-index: 1`, so it sits above the ticks.
- `ref-layout.js` `tickPositions(panel)`: from the panel centre and pxPerTan only. There are no left/right ticks for n = +1 … +3 (N1), and ticks lie strictly inside each edge.
- `view.js` `labelsInfo` skips the SVG (not an HTMLElement).

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/ui/view/ref-layout.test.js` | 28 / 28. RED for `defaultRefEye` before the code: 3 failed. |
| `npm run lint` | clean |
| `npm run build && npm run build:e2e && npm run test:dist` | ok; 17 passed, 1 skipped; precache 0,991 MB (limit 2 MB) |
| `npx playwright test e2e/view-ref.spec.js e2e/view-memory.spec.js e2e/view-fullscreen.spec.js e2e/ref-live.spec.js` | 52 passed, 12 skipped (by design: two-panel gate on mobile, desktop-only viewport cases), 0 failed |
| `npx playwright test e2e/view.spec.js e2e/view-heat.spec.js e2e/view-compare.spec.js e2e/a11y.spec.js e2e/layout.spec.js` | 176 passed, 24 skipped, **2 failed**: `a11y.spec.js` "D-29 keyboard path" at 320 × 640 on both projects. This is a pre-existing 04-08 effect: the visible `#view-mode` radios now sit between `#result` and the stage, and 04-09 adds no focusable there. Logged in deferred-items.md, not fixed (out of scope). |
| `npm run test:coverage` | 59 files, 2130 / 2130 passed (the diagnostics.test.js timeouts did not occur this run) |

Acceptance greps:
- `IntersectionObserver` in ref-mode.js: 2
- `from 'three'` in pipeline.js / text.js / ref-size.js: 0 / 0 / 0
- `style=` in refraction.js: 0
- The M3 literals are untouched (`M3A_*`, `M3C_*` unchanged), and M3 (a) / (b) / (c) pass.

### Measured on screen (SwiftShader, Playwright Chromium)

**Item 12** (320 × 640, one panel 288 × 216 at 249,42 px/tan, A 40 / B 28 / DBL 14 / PD 40, rechteckig, CR-39). Sample x = centre ± tan × pxPerTan (N9). The rim samples are on the centre row; the chart sample is the nearest row where Node says class 1, ≥ 2 px from every checker edge:

| Rx / eye | chart (0,401 / 0,361) | edge band (0,453 / 0,421) | rim face (0,521) | Ohne Glas |
|---|---|---|---|---|
| −4,00 OD (screen right) | 255,255,255 | 34,30,28 | 34,30,28 | chart 26,26,26; band and face 34,30,28 |
| −4,00 OS (screen left) | 26,26,26 | 34,30,28 | 34,30,28 | same mask |
| +4,00 OD | 26,26,26 | 34,30,28 | 34,30,28 | same mask |
| +4,00 OS | 255,255,255 | 34,30,28 | 34,30,28 | same mask |

- **Mixed-cell check:** a class-1 point and a class-2 point inside grid cells whose corners differ.
  - −4,00 OD: x 246,5 → 26,26,26 (chart), x 253,5 → rim.
  - +4,00 OD: x 234,5 → chart, x 258,5 → rim. OS is mirrored.
  - Both hold in Mit and in Ohne Glas.
  - This is the check the 04-08 conservative rule would fail: it drew the whole mixed cell as rim.
- The 6 px lattice has no `#f3f4f6` pixel and there is no noView pill.
- N11: every tick is shown exactly when its 14 px sample point is not on the rim (Node oracle).
- `view.ref.rimNote` is shown. `view.ref.rimPastNote` is hidden, because the handle reports `pastRim: false` (see deviation 2).

**Item 25** (412 × 915, two panels 189 × 285 at 246,82). Offsets in CSS px from the tick to the chart edge, on the line 14 px inside the edge:
- (a) Ohne Glas, load Rx: every drawn tick is within ± 1 px. No tick exists at n = 1 … 3 on the left/right edges.
- (b) −1,00 Mit: left/right outermost bottom ticks −3,21 / −3,21 (P0: 3,19); Ohne −0,21.
- (c) 0,00 / −1,00 × 180: left/right −3,21 (P0: 2,94); bottom ticks +0,32 / −0,32 (P0: 0,32).
- (d) −0,75 shows the weak note; −1,00 does not.
- 320 one panel, 0,00 / −1,00 × 90: bottom ticks ±3,07 (P0: 3,03), left/right −0,86 / +0,14.

**Item 5:** −6,00 (1,67) and −10,00 (CR-39) have no `#f3f4f6` pixel in either panel, `noView: false`, and no pill.

## D-30 visual pass: Playwright Chromium (the chrome-devtools MCP pass is owed; the orchestrator does it after the merge)

Screenshots are in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-09-shots/`, taken against dist-e2e from this branch. The script is `04-09-shots.mjs`, the log `04-09-shots-log.md`.

- **412 × 915, DPR 1 and DPR 2,6, −1,00** (`04-09-412-dpr*-m100-mit/ohne.png`):
  - Two panels with the ticks on all four edges. Ohne Glas: every tick sits on a square edge. Mit Glas: the horizontal square edges near the left/right borders sit about 3 px toward the centre of the ticks.
  - **N4 tick check:** with the 4 px under-stroke, the ticks were clear at DPR 2,6. At DPR 1 the 1 px white halo on the black squares was hard to see. Widened to 6 px: at DPR 1 the ticks now read as white-outlined marks on the black squares and as black marks on white.
  - The top ticks run under the badge and the fullscreen button (N5 expected).
  - **N5:** the bottom outermost ticks (bottom edge n = ±3, left/right n = −5) are clear of the badge, the fullscreen button and the pills in every layout shot. This was measured from the bounding rects: "clear" for 412, 320, 1164 and 1280.
- **412, 0,00 / −1,00 × 180:** the left/right border edges are moved, and the bottom ticks sit on the square edges.
- **412, −0,75:** `#view` with the weak note.
- **320 × 640:**
  - One panel with the picker shown, default "Linkes Glas" for OD −2 / OS −5. scrollWidth is 320.
  - Item-12 rim case −4,00 and +4,00, OD and OS: a dark rim band from about 108 px (−4) / 95 px (+4) right of the centre to the panel edge (OD), mirrored for OS. The right-edge ticks are hidden (N11), and the rim note is in the size block.
- **1164 × 593 (tablet), item-12 case:** two panels 198 × 248,75. The rim is on the temporal side of each panel (left in L/OS, right in R/OD), for −4,00 and +4,00.
- **1280 × 800:**
  - −1,00 with ticks.
  - OS blocked: the left panel is the fill with the centred "Linkes Glas – nicht berechnet" pill and no ticks; the right panel renders with the "Rechtes Glas" pill.
  - Error box: the red Fehler-tier box with the message and "Erneut versuchen".
  - `?nowebgl`: the WebGL note, no "Darstellung" switch, the size block with the cylinder lines and the no-picture scope sentence, and no edge or weak note.
- **Console:** only "Service Worker registration blocked by Playwright" and Chromium's "GPU stall due to ReadPixels" driver notes (DPR 1, from the pixel reads). There were no THREE or WebGL errors.

## Deviations from Plan

1. **[Rule 3] Files outside `files_modified`:**
   - `src/ui/view/ref-size.js` (new): the size-block writer shared by ref-mode.js, view.js (no-WebGL) and pipeline.js (no chunk). It has no three.js.
   - `src/ui/view/scene.js`: an optional `thumb.pass`, so the M4 thumbnail draws the glasses while the main pass is the Durchblick.
   - `src/ui/summary-bar.js`: `holdBarThumb(on)`, the `.thumb-off` text bar while a deferred re-mesh leaves no current thumbnail. Without it `fitThumb` removes `thumb-off` on every layout.
2. **[Plan claim corrected by the engine] rimPastNote at 320 px.** The plan says the 0,802 class-5 sample is on screen for item 12 at 320 px. It is not: the panel half-width is tan 0,577, and the engine (`warpGrid` fein) reports `pastRimInField: false` for that case at 320, 412, 1164 and 1280.
   - A Node scan found **no** rim case with class 5 on screen for valid inputs in any of these layouts. Cases scanned: rechteckig / pilot / rund small frames, PD 38–40, Sph −12 … +12. The past-rim face edge is at tan ≈ 0,73 or more, beyond the 30° field's long half-side.
   - So the e2e asserts "rimPastNote shown iff `pastRim`" and covers the hidden branch on screen with the item-12 case. The shown branch stays covered by the text.js unit tests.
   - Named rim case without class 5: item 12 itself.
3. **[Spec conflict, N11 applied] "ticks are drawn over the rim" vs N11.** N11 (the later final review) hides ticks whose sample point is on the rim. Item 12 therefore asserts the N11 rule per tick instead of visible ticks on the rim side.
4. **[Rule 1] Existing 04-08 e2e on the phone project.** Items 5 and 9 and "numbers never wait" typed with `fill()`, which scrolls the stage off screen on the 360 px project, where the warp is now (correctly) not posted. They now type with `fillInPlace` (an input event without scrolling) and wait for a new drawn generation (`refRedrawn`). Item 14 runs on desktop only: on a phone the edited field and the stage are never both on screen. The M3 tests are unchanged.
5. **TDD order:** the unit RED for `defaultRefEye` ran (3 failed) before the code. The Task 1 e2e were written before the implementation but first run after it. The tick unit tests were written against the finished functions (no RED run). The mixed-cell leaf assertion in item 12 is the regression check against the 04-08 rule.
6. **Leaf geometry:** one geometry per panel with three material groups, not three separate leaf meshes (fewer draw-state objects; same result).

## Known limits (later plans, not stubs of this plan's goal)

- A resize or the picker still re-traces (the grid is in panel px). "Redraw from the last grid" belongs to 04-12.
- `lastJobExcluded` is recorded but not yet consumed (04-10 guard).
- The class-3 pill cannot be reached on screen for valid inputs (P0: no class 3 in the field), so it has no e2e. Its zone code runs on every warp.

## Flagged for lens-critic

- Deviation 2: the plan's claim about a class-5 sample on screen at 320 px. No valid case shows class 5 on screen, so `view.ref.rimPastNote` is practically unreachable on screen at the current field.
- Deviation 3: the N11 vs "ticks over the rim" conflict, resolved in favour of N11.
- N4: under-stroke widened to 6 px.

## Threat Flags

None. There are no new endpoints or storage. The leaf arrays are length-checked before the GPU write (T-04-31), the SVG uses presentation attributes only (CSP), the text is textContent only, and the new handle fields sit inside the MODE gate.

## Commits

- 6c519a2 feat(04-09): one-panel picker, blocked/empty/failed/no-WebGL states, stage visibility (REF-01, REF-02)
- 26885d7 feat(04-09): rim and edge band from the quadtree leaves, reference ticks, item 12 / 25 / 5 (REF-01)

## Self-Check: PASSED

Files exist (ref-size.js, refraction.js, ref-layout.js, view-ref.spec.js, this SUMMARY); commits 6c519a2 and 26885d7 are in the branch log; no preview server of this run is left running (both started PIDs stopped).
