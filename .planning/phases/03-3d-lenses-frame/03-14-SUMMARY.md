---
phase: 03-3d-lenses-frame
plan: 14
subsystem: ui/view (A/B comparison in 3D, keyboard hint fade)
tags: [RES-03, D-24, D-25, lens-critic round 2 MINOR 4, A3, T-03-37, T-03-38, T-03-39]
requires: [mesh-protocol MESH_SLOTS 'A' (03-04), frame.js / lenses.js slots (03-05, 03-07), camera-math presetPose + controlLimits (03-09), heat.js / legend.js (03-12), labels.js + label-layout.js all-or-nothing callouts (03-13), pipeline configA / resultA / specA / showA (02-08)]
provides: [mesh slot 'frameA', camera-math compareEye + compareContext (+ fitPointsDistance centred option), src/ui/view/compare3d.js (scissor pass, captions, divider, warm-up), scene.setPass, lenses.sphere / unionRadius(names), frame.lensZ / compareParts / localEye, labels.js sets A/B with prepareHeatLabels + commitHeatLabels, legend renderHeatTable compare form, pipeline viewInputs.compare, debug compareInfo() / keysHint(), A3 keyboard hint fade]
affects: [03-15 (thumbnail in split A/B crops the shown half, R1-8; leak test can add compare cycles), 03-16 (axe matrix: compare states)]
tech-stack:
  added: []
  patterns: [render pass that sets and restores visibility/position on existing objects only, two-phase label layout (prepare per half with that half's projection, decide once, commit), warm-up upload with drawRange count 0]
key-files:
  created:
    - src/ui/view/compare3d.js
    - e2e/view-compare.spec.js
  modified:
    - src/state/mesh-protocol.js
    - src/state/mesh-protocol.test.js
    - src/ui/view/camera-math.js
    - src/ui/view/camera-math.test.js
    - src/ui/view/view.js
    - src/ui/view/scene.js
    - src/ui/view/lenses.js
    - src/ui/view/frame.js
    - src/ui/view/labels.js
    - src/ui/view/legend.js
    - src/ui/pipeline.js
    - src/i18n/de-AT.js
    - src/ui/style.css
    - .planning/phases/03-3d-lenses-frame/03-CONTEXT.md
    - .planning/phases/03-3d-lenses-frame/03-UI-SPEC.md
key-decisions:
  - "03-14: compare camera targets the origin (common boxing centre) for default/Vorne/Oben with an aspect-aware perspective fit of the A ∪ B lens+rim box (fitPointsDistance centred: false); the plan's sphere fit would clip a 52 mm lens horizontally in a 191 px half (aspect 0,665)"
  - "03-14: compared-eye ties use SIDE_TIE_MM (0,05 mm) like the heat eye and Seite"
  - "03-14: the compare render pass toggles visible/position and restores them, so lenses.visible() keeps meaning 'drawn'; no geometry, material or texture is created or released on compare start/end"
  - "03-14: A-slot warm-up at the first attach draws with drawRange count 0 (uploads, draws nothing); a full degenerate draw cost +3,3 s at load in headless SwiftShader"
  - "03-14: A/B captions sit top-centre of each half and move below the badge when they would touch it (both at the same height)"
  - "03-14: while A is recomputed inside a running comparison the last A stays shown (UI-SPEC States policy for old meshes); a new comparison shows A only once its own A lens is attached"
  - "03-14: leaving the comparison in Dickenkarte returns to the heat pose of the heat eye; in Glas to the default pose (UI-SPEC)"
  - "A3 (orchestrator): keyboard hint fades after 4 s (300 ms; no transition under reduced motion), shows again on the next focus; hidden hint is no label obstacle"
requirements-completed: [RES-03]
metrics:
  duration: ~3 h (incl. three full e2e runs and a baseline comparison)
  completed: 2026-11-08
  tasks: 2 (+ amendment A3, + one perf fix)
  files: 17
---

# Phase 3 Plan 14: A/B comparison in 3D Summary

While "Variante vergleichen" is active, the 3D view shows the compared eye as Vorher (A) and Nachher (B) side by side. Both halves use one renderer, one camera, the same angle and the same mm-per-pixel scale whenever the stage is at least 360 px wide. Below that, a single viewport follows the Vorher | Nachher toggle and keeps the camera. In Dickenkarte, A and B share one thickness scale over all four lenses, the table becomes Vorher (A) · Nachher (B), and the callout rule is decided once for both halves. Starting and ending a comparison creates no GPU resource (measured over 5 cycles). Amendment A3 makes the keyboard hint fade, so keyboard users get the on-lens numbers back.

## Read first (lens-critic)

- **Split Dickenkarte is table-only at 1280 and 412 px.** Each half is 200×251 px (1280) or 191×287 px (412), and the lens is about 128–134 px wide in it. Six callouts do not fit next to that. The all-or-nothing rule, decided across both halves (round 2 MINOR 4), then shows no callouts and one note. This is allowed by the plan's pass/fail ("both or neither"), and e2e records it: annotation `callouts 1280×800: neither half (table-only note)`, same at 412×915.
  - I checked whether the captions cause it: a temporary build without caption obstacles was still table-only at 1280.
  - Below 360 px (toggle mode, a single viewport) the callouts fit: at 360×780 all 6 show next to the "Nachher (B)" caption (screenshot `h360-stage.png`).
  - So the numbers on the lens are not available in the split view on phones or on desktop. The table and `#cmp-diff` carry them.
- **Captions can cover the top of the rim.** When the A caption would touch the "Visueller Eindruck"/"Dickenkarte" badge, both captions move below the badge (y = badge bottom + 4 px). At 412/320/360 px that places them over the upper rim edge (`l14-412x915-b-stage.png`, `l14-320x640-a-stage.png`). They are readable, overlap no other label and stay inside the stage. A larger fit margin would shrink the lenses further, so I left it.
- **The default fit differs from the plan text.** The plan says `ctx.full.r = max of the two radii` with a sphere fit. With the vertical-FOV sphere fit, a 52 mm lens is clipped horizontally in a 191 px half (half-width visible ≈ 23 mm < 26 mm). Default, Vorne and Oben therefore use an aspect-aware, perspective-exact fit of the A ∪ B box *about the origin*. The target is still the origin, as the plan asks, and `full.r` is still the max radius (used by the sphere fallback). Unit test: the extreme corner lands at exactly 1/1,08 of the half viewport.
- **The protrusion block (`#view-protrusion`) still describes B for both eyes** while the comparison shows one eye. This was not in scope and is listed as an open item.
- **The transmission render target is resized** from full width to half width when the split starts. three.js r187 (`WebGLRenderer.js` lines 2054–2057: `transmissionRenderTarget.setSize(activeViewport…)`) re-creates its texture at the new size. The count stays equal (`textures 6` before, during and after), and both halves have the same width, so it is not resized per half. A strict reading of "never creates or disposes GPU resources" would count this one internal resize per start/end.

## What was built

- **Task 1 (TDD).**
  - `MESH_SLOTS` gains `'frameA'`. It goes through the frame path, so it has the same validation and FRAME_LENGTHS buffers, and keeps its slot name in success and failure.
  - `compareEye` returns the larger `thickest` across A and B. Ties within 0,05 mm go to OD, and null values are ignored.
  - `compareContext` takes lens-local spheres, side targets and boxes. It returns a context with `compare: true`, the union box as `eyeBox[eye]`, and B's temporal rim point.
  - 8 new tests: 3 protocol, 5 camera.
- **`compare3d.js`** (`setScissorTest(true)` ×1, `dispose()` ×0).
  - Render pass, active: hides the other eye, the bridge, temples, hinges and the shadow. It recentres the B lens and rim and the A lens and rim to x = 0, with the A lens z taken from `frameA.lensZ()`.
  - Split: clears, then per half sets `setViewport` and `setScissor` (equal widths), sets visibility, and renders with the half aspect.
  - Toggle: renders the shown configuration only.
  - Every changed value is restored before the pass returns.
  - The A half is drawn only when the attached A lens and rim were built for the compared eye (T-03-38).
  - Captions are `.view-label--caption` pills with `data-half`. The 2 px `.view-divider` shows only while split.
  - Test-only: `widthPx(half, outline, z)`.
- **`view.js`.**
  - Adds the A slot and a second `createFrame` (`frameA`, with no lens groups).
  - The compare items are added to the same latest-wins job, each with its own key, and are sent only when changed.
  - `syncCompare` handles enter and leave: a camera cut to default (or to the heat pose in Dickenkarte), then refresh.
  - In a comparison: the compare caption and canvas name, the side eye = the compared eye, the eye picker hidden, `paintHeatCompare` (four-lens `heatScale` + `isoLevels`, compare table), and per-half callout layout through `prepareHeatLabels`/`commitHeatLabels`.
  - Debug handles: `compareInfo()` and `keysHint()`. `labelsInfo()` entries now carry `half`, and captions report kind `caption`.
- **`labels.js`.** Label sets B (main) and A (Vorher), each a fixed pool made once. The layout is two-phase: each half is projected with its own aspect, then the callouts are decided once, and the layout runs again without callouts if any half fails. `layoutHeatLabels` keeps its 03-13 behaviour outside a comparison.
- **`legend.js`.** `renderHeatTable({ compare: { eye, A, B } })` gives caption "Dicke an markanten Stellen – rechtes Glas", columns Stelle · Vorher (A) · Nachher (B), and `data-col` A/B.
- **`pipeline.js`.** `viewInputs().compare = { A, specA, showA }`. `refreshView()` runs on start, end, the `#cmp-show` change, and when the A result is painted (only then).
- **i18n.** Added `view.caption.compare`, `view.ab.a`/`.b`, `view.aria.compare`, `view.table.caption.compare` and `view.table.col.a`/`.b`, using the UI-SPEC wording.
- **A3.** The hint state is shown → fading (300 ms) → hidden, with no fading step under reduced motion. The next keyboard focus shows it again. `updateAvoid` treats a hidden hint as no obstacle, so the next settle writes an empty note and the callouts come back. `aria-describedby="view-keys"` is unchanged. Recorded in 03-CONTEXT.md and 03-UI-SPEC.md (A3, plus the `#view-keys` DOM row marker).

## Verification (run one after the other, final code 11a5ef7)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 46 files, **1786 tests passed** (03-13: 1778, +8). All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 348ms`, view chunk 634,03 kB (gzip 166,37 kB), up from 622,59 kB |
| port 4173 before e2e | `000` |
| `npm run test:e2e` | **514 passed, 24 skipped, 0 failed, 0 flaky (11.5 m), exit 0** (03-13: 502 passed / 12 skipped; +12 new tests, +12 project skips) |

**Earlier full runs failed, and why.**

- Two earlier full runs each had 2 failures. They were 30 s timeouts in `a11y.spec.js:148` and `view.spec.js:284`, and the `layout.spec.js:302` "arriving cross-section" race.
- I compared them against a baseline build of c70ae5f in a scratch worktree, on its own port:
  - The a11y keyboard test took 9 s at baseline and 15 s on my build (serial).
  - Load-to-view went from 3,35 s to 6,86 s. The cause was the A-slot warm-up, which drew the full index list of degenerate triangles.
- Fixes (commit 11a5ef7):
  - The warm-up now uses `drawRange` count 0, which brings load back to 3,47 s with geometries still 21.
  - `paintCompare` no longer refreshes the view for every material row.
- After the fixes, `layout.spec.js:302` ×16 failed 1/16 on my build and 2/16 at baseline. It is a pre-existing timing race, not caused by this plan.

**New e2e (`e2e/view-compare.spec.js`, 12 tests, reduced motion unless stated):**

- **Side by side** (1280): active and split, both captions, the divider, and the caption text.
  - `edgeMax('A')` = 4,6 equals the Vorher card's Dickster Rand, and `edgeMax('OD')` = 3,0 equals the Nachher card.
  - The canvas name contains "Vorher (A): dickste Stelle 4,6 mm. Nachher (B): dickste Stelle 3,0 mm."
  - `memory()` is the same before and during the first comparison.
- **Same scale:** A = 52 mm, B's A = 46 mm.
  - Vorne: 159,5 / 140,7 px → 0,8820.
  - Default 3/4: 136,3 / 120,2 px → 0,8819.
  - 46/52 = 0,8846, a difference of −0,3 % (limit ±2 %).
- **Phone toggle** (mobile, 320×640): split false. Vorher gives shown 'A' with the camera position and target exactly unchanged; Nachher gives 'B'. No horizontal scroll.
- **D-25:** `heatScale` min/max are within 0,05 mm of the min thinnest / max thickest of the 8 card values (A and B, R and L). The table header has Vorher (A) and Nachher (B). Mitte A/B equal `#cmp-row-ctOD` a/b. The picker is hidden. Ending the comparison restores the R/L table.
- **MINOR 4** at 1280×800 and 412×915: "neither" in both cases (see Read first). No label crosses its half or another label.
- **End:** from Seite, "Vergleich beenden" gives viewName `default`, both `edgeMax` values non-null, 2 eye labels, and no captions.
- **No GPU churn, 5 cycles** (B alternates 1,74 / CR-39, so A is re-meshed in place):
  - before `{geometries 21, textures 6, programs 11}`;
  - during ×5 and after ×5: all identical.
  - 16 → 21 geometries happens once at the first attach (warm-up: A lens 3, frameA rims 2), before any comparison.
- **A3** at 412×915, `reduce` and `no-preference`:
  1. Tab to the stage: `:focus-visible`, hint 'shown' and visible.
  2. The note shows and there are 0 callouts.
  3. Then 'hidden'; the note clears; `calloutsFit` is true; 5–6 callouts, each equal to its table cell.
  4. `aria-describedby="view-keys"` and the text are kept.
  5. Shift+Tab then Tab shows the hint again.
- **axe** at 320×640 and 1280×800, in compare Glas and compare Dickenkarte: 0 violations. No horizontal scroll at 320.

Targeted runs before the gates: `compare.spec.js`, `view-heat.spec.js` (unchanged), `view-controls.spec.js` and `view.spec.js` all passed after the label-order fix (deviation 3).

### Layout and screenshots (Playwright against `vite preview` on ports 4192/4193, looked at)

| Viewport | Stage | Mode | Lens width (px) | Captions | scrollWidth / innerWidth | Labels inside / overlaps | Targets < 44 px |
|---|---|---|---|---|---|---|---|
| 1280×800 | 400×251 | split | A 136,3 / B 136,2 | both | 1280 / 1280 | yes / 0 | – |
| 412×915 | 382×287 | split | A 131,7 / B 131,6 | both | 412 / 412 | yes / 0 | none |
| 360×780 | 330×248 | toggle | 170,1 (B), 170,3 (A) | the shown one | 360 / 360 | yes / 0 | none |
| 320×640 | 290×218 | toggle | 149,3 (B), 149,5 (A) | the shown one | 320 / 320 | yes / 0 | none |

- Console: only the whitelisted GL driver notes.
- What the screenshots show:
  - Split: two single lenses in their rims, the same angle and size. The 2 px divider is visible.
  - In Dickenkarte, A is visibly darker than B on the same scale (A 4,6 mm at the temporal edge, B centre 1,1 mm), the iso labels fit, and the note is below the legend.
  - The chart fills both halves.
- **Screenshots (session scratch, not published), absolute paths:**
  - Comparison, Glas and Dickenkarte:
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/d1280-view.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/d1280-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/h1280-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/h412-view.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/h360-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/g320-stage.png`
  - Layout pass, Vorher (`a`) and Nachher (`b`) per viewport:
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-412x915-a-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-412x915-b-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-412x915-page.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-360x780-a-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-360x780-b-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-360x780-page.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-320x640-a-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-320x640-b-stage.png`
    - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots14/l14-320x640-page.png`
- The chrome-devtools MCP was not available in this executor session either. The D-30 checks were done with Playwright scripts, and the MCP pass is still owed.

## RES-03: Complete (evidence)

- **Phase-2 part** (numbers, Vorher | Nachher toggle on cards and bar, 2D overlay): `e2e/compare.spec.js` configuration-comparison tests ("freeze A, change the material, read the difference": 4,6 → 3,0 mm, 14 → 10 g; "Vorher | Nachher toggle switches the result cards and the summary bar both ways") pass in this final e2e run, together with the xsec specs.
- **Phase-3 part** (in the 3D view): side by side at the same scale (width ratio within 0,3 % of 46/52), the toggle below 360 px with the camera kept, and the shared heat scale. All in `e2e/view-compare.spec.js`, passing above.

VIZ-06 stays Pending.

## Deviations from Plan

1. **[Rule 1 - Bug] Compare default/Vorne/Oben fit** is aspect-aware about the origin instead of a sphere fit. Otherwise the lens is clipped in a narrow half. See Read first. Commit 802ed44.
2. **[Rule 3] `scene.js` gains `setPass`** (not in `files_modified`). It is needed to replace the single `renderer.render` with the scissor pass. Commit dfaf7fa.
3. **[Rule 1 - Bug] Label node order.** The caption spans were first created before the eye labels, which broke `view.spec.js`'s `#view-labels .view-label` order (3 tests). compare3d is now created after the label pools. Commit dfaf7fa.
4. **[Rule 1 - Perf bug] Warm-up cost and redundant renders.** See Verification. Commit 11a5ef7.
5. **[Rule 2] T-03-38, stricter:** the A half draws only when the attached A lens and rim keys equal the current A input's keys and were built for the compared eye. While A is recomputed in a running comparison, the last A stays (old-mesh policy).
6. **Labels design:** `setHeatLabels`/`clearHeatLabels` take a set name, and new `prepareHeatLabels`/`commitHeatLabels` handle both halves. These replace the plan's "calloutsFit = fitA && fitB" one-liner with an equivalent two-phase decision. Captions are fixed screen positions, not layout items, and they are avoid boxes for the halves.
7. **`frame.js`:** `createFrame` accepts no lens groups (`frameA`). Adds `lensZ()`, `compareParts(eye)` and `localEye(eye)`. **`lenses.js`:** adds `sphere(name)` and `unionRadius(names)`, so the A slot never inflates the normal fit.
8. **Leaving the comparison in Dickenkarte** returns to the heat pose rather than default (Dickenkarte's own framing rule). In Glas it returns to default, as specified.
9. **A3** is its own commit (b60b84a), as the orchestrator asked. The Task 2 commit was produced from the full working tree minus the A3 hunks by a script, then the full files were restored. Both commits were lint- and build-checked.

## Open items

- Split Dickenkarte callouts are table-only on 1280 and 412 (Read first). Needs a UI-SPEC decision if on-lens numbers in the split matter, for example a larger stage in A/B, or callouts on B only.
- Captions over the upper rim on phones (Read first).
- `#view-protrusion` describes B's two eyes during a comparison.
- `layout.spec.js:302` is timing-flaky at 1280 under 4 workers (pre-existing: 2/16 at c70ae5f).
- The live chrome-devtools MCP pass, and a real-device check of split rendering cost. It is two transmission passes per frame, measured at ≈ 2× per frame in SwiftShader.
- 03-15: the thumbnail in split mode must crop the shown half (R1-8).

## Known Stubs

None.

## Threat Flags

None. No new network, storage or markup sinks. Captions and table text go through `textContent`/`createElement`, positions through the CSSOM `style.transform`, and `data-half` through `dataset`.

## TDD Gate Compliance

Task 1: RED `test(03-14)` cf749d1 failed first (9 failures: `compareEye`/`compareContext` missing, `MESH_SLOTS` without frameA). GREEN `feat(03-14)` 802ed44: 39/39 in both files. No refactor commit.

## Self-Check: PASSED

- Files exist: src/ui/view/compare3d.js, e2e/view-compare.spec.js.
- Commits exist: cf749d1, 802ed44, dfaf7fa, b60b84a, 11a5ef7.
