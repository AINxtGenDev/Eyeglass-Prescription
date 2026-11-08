---
phase: 03-3d-lenses-frame
plan: 12
subsystem: ui/view (Dickenkarte: heat material, legend, table, mode switch)
tags: [VIZ-05, UX-02, D-21, D-22, D-23, D-26, lens-critic MAJOR 4, MINOR 1 rebuttal, T-03-30, T-03-31, T-03-32, T-03-33]
requires: [engine/mesh/heat.js heatScale + isoLevels + heatCallouts (03-03), lens buffers `thick` (03-02/03-04), camera-math presetPose('heat', eye) (03-09), controls goTo/refresh (03-09), view.js aria debounce (03-11)]
provides: [src/ui/view/cividis.js (CIVIDIS_HEX, CIVIDIS_UNIFORM, cividisRGB, isoLineColour, ISO_SWITCH_U), format.js fmtIsoValue / fmtIsoStep, src/ui/view/heat.js createHeat (material + hidden carrier + setScale), src/ui/view/legend.js renderLegend / renderHeatTable, lenses.setMode / mode, controls.preset / presetEye, #view-mode, #view-heat (legend, table, no-chord note), debug handle mode() / heatScale() / ocWorld(eye)]
affects: [03-13 (projected callouts, iso labels, #view-heat-eye picker: set pickedEye in view.js), 03-14 (A/B heat: heatScale over all four lenses), 03-15 (leak test may add Glas ↔ Dickenkarte cycles)]
tech-stack:
  added: []
  patterns: [ShaderMaterial colouring an engine scalar attribute with raw-sRGB LUT uniforms, pre-created material swap + hidden carrier compile, SVG legend sized in CSS px with measured label widths]
key-files:
  created:
    - src/ui/view/cividis.js
    - src/ui/view/cividis.test.js
    - src/ui/view/heat.js
    - src/ui/view/legend.js
    - e2e/view-heat.spec.js
  modified:
    - src/i18n/format.js
    - src/i18n/format.test.js
    - src/ui/view/lenses.js
    - src/ui/view/view.js
    - src/ui/view/controls.js
    - index.html
    - src/ui/style.css
    - src/i18n/de-AT.js
decisions:
  - "03-12: heat-eye ties use the Seite rule: OS only when its max(ct, etMax) exceeds OD's by more than SIDE_TIE_MM (0,05 mm); the example (OS 4,597 mm slightly above OD, both '4,6 mm' on the cards) frames the right eye"
  - "03-12: the Dickenkarte pose keeps the internal preset name 'heat' (refresh re-fits the heat eye) but reports viewName 'front' (UI-SPEC: Dickenkarte = Vorne)"
  - "03-12: thickest-row location sits in the cell ('4,6 mm (außen oben)'), the row header is 'dickste Stelle', because the location differs per eye (refinement of the UI-SPEC row text)"
  - "03-12: the table stacks into one card per row below a 480 px container (#view-heat container 'viewheat'), so it is stacked in the 400 px desktop column too; cell labels are aria-hidden (the column headers carry the association)"
  - "03-12: leaving Dickenkarte keeps the camera where it is (no spec); it stays on the heat pose until a preset or drag"
metrics:
  duration: ~29 min
  completed: 2026-11-08
  tasks: 2
  files: 13
---

# Phase 3 Plan 12: Dickenkarte (thickness map) with legend and table Summary

In the Experten-Ansicht, "Darstellung: Glas | Dickenkarte" paints the engine thickness on both lenses with cividis (thicker = darker), on one shared engine scale. It frames the thicker eye from the front at about 4,35 px/mm on a 320 px phone. A mm legend and a table of the key values for both eyes come from the same engine numbers. The map can be read without colour.

## Read first (lens-critic)

- **VIZ-05 stays Pending.** The requirement asks for *labelled* iso-lines and numeric callouts *on the lens*. Iso-line labels and the projected callouts are 03-13. This plan gives the map, the iso lines, the legend and the table.
- **UX-02 is marked Complete.** The Experten-Ansicht switch now also reveals the heatmap (the last missing part; everything else was delivered in phase 2). Simple never shows `#view-mode`, and turning Expert off returns to Glas (e2e). If you read UX-02 as "needs the finished VIZ-05", re-open it. That is a judgement call I am flagging, not a proven fact.
- **Heat-eye tie rule (deviation 1).** The example eyes are not exactly equal: OS (4,597 mm, the scale max) is slightly thicker than OD while both cards read 4,6 mm (difference < 0,05 mm), so a strict ">" picked OS. Ties within 0,05 mm now go to OD, using the same rule and constant as Seite (MINOR 13).
- **Pixel = legend colour, measured.** The OD optical centre pixel is (233, 211, 78). The LUT value cividisRGB(1 − (1,8 − 1,5)/3,5) is (232,6; 210,6; 78,3). Both projects pass, tolerance ±6.
- **MINOR 1 rebuttal holds, with a control run.** `memory().programs` stays 10 across the first switch to Dickenkarte. With the synchronous carrier compile removed (headless SwiftShader has no `KHR_parallel_shader_compile`), the same test failed with 10 → 11. The check discriminates.

## What was built

- **`cividis.js`.** 11 UI-SPEC stops, with the source cited: Nuñez, Anderton & Renslow 2018, PLOS ONE 13(7): e0199239, and the matplotlib 3.11.2 read-out. It provides:
  - `cividisRGB(u)`, linear in sRGB;
  - `CIVIDIS_UNIFORM`, 33 raw sRGB floats with no linearisation;
  - `isoLineColour(u)`.
  - The tests check that luminance is strictly increasing over 101 samples.
- **`format.js`.** `fmtIsoValue` ("2,25", "3,0") and `fmtIsoStep` ("0,25 mm"): 1–2 decimals, NBSP before the unit.
- **`heat.js`.** A `ShaderMaterial` that reads the worker's `thickness` attribute only. It does no optics (grep `SagAt|refract(|ior` = 0).
  - Colour: cividis(1 − t) from the LUT uniform.
  - Unlit, `toneMapped: false`, with no colour-space or tone-mapping include.
  - Iso mask: `abs(fract(q − 0,5) − 0,5) / fwidth(q) < 1`. It draws only levels strictly inside (scaleMin, scaleMax). Lines are white where u < 0,5, else #1a1a1a.
  - Hidden one-triangle carrier mesh. `setScale(levels)`, where flat → no lines.
- **`lenses.js`.**
  - One shared `thickness` BufferAttribute per slot, used on both front and back and swapped in `attach`.
  - `setMode('glass'|'heat')` swaps the face materials; nothing is recreated.
- **`legend.js`.** CSP-safe: createElementNS and textContent only, presentation attributes only.
  - Legend parts: title "Dicke in mm", the end words dünner / dicker, then a role=img SVG. The SVG has the `<title>` "Farbskala der Dicke" and a `<desc>` with the engine min/max and the step. Its 11-stop gradient runs left = thin.
  - Ticks sit at scaleMin, every level and scaleMax, with 14 px labels. Label widths are measured with getBBox; the labels split into two alternating rows only if they would touch.
  - Below it: the step line, or the flat-range sentence.
  - The table has the rows Mitte, innen, außen, oben, unten and dickste Stelle × R/L. A NO_CHORD eye shows "–" plus `#view-heat-nochord`; a blocked eye shows "–".
- **`view.js`.**
  - Mode state, radios with the check icon, enabled after the first attach. A listener on Expert off.
  - `paintHeat()` runs once per delivery, guarded by a memo key on surfaces, metrics and frame. It computes heatScale → isoLevels → setScale, then heatCallouts per drawn eye → table.
  - It re-frames if the heat eye changes while the camera is on the heat pose.
  - Badge, caption and `view.aria.heat` follow the mode.
  - Without WebGL, `#view-mode` is removed.
- **`controls.js`.** `viewName()` maps 'heat' → 'front'. Adds `preset()` and `presetEye()`.
- **`index.html` / `style.css` / `de-AT.js`.** The `fieldset#view-mode.segmented data-expert hidden` uses the Expert tag. `#view-heat` holds the legend, the table and the no-chord note. The UI-SPEC keys are added, plus `view.table.thickestCell`, `view.table.noChord` and `view.heatEye.*` (03-13 reuses them).

## Verification (run one after the other)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 45 files, **1769 tests passed** (03-11: 1756, +13). All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 355ms`. View chunk 615,43 kB (gzip 159,61 kB), up from 605,28 kB |
| port 4173 before e2e | `000` (also confirmed after my own preview for the screenshots was stopped) |
| `npm run test:e2e` | **486 passed, 10 skipped (9.5 m), exit 0**, no flaky tests (03-11: 470; +16 = 8 new tests × 2 projects) |

New e2e tests in `e2e/view-heat.spec.js`, all with reduced motion and the view loaded:

- **Switch only in Expert.**
  - Hidden in Simple. Dickenkarte gives mode 'heat', viewName 'front', the badge "Dickenkarte", the caption, and a visible legend and table.
  - **programs unchanged.** The aria-label is "Dickenkarte, von vorne. Dünnste Stelle 1,8 mm, dickste Stelle 4,6 mm. …".
  - Expert off gives Glas, hides the legend and table, and restores the glass aria-label.
- **Frames the heat eye at 320×640.** heatEye = OD, the target is within 0,5 mm of the eyeBox centre, and the scale is **4,35 px/mm** (≥ 3 px/mm required).
- **Table = engine numbers.**
  - Mitte = the card centre thickness.
  - dickste = the card thickest value plus its lay location.
  - OD innen/außen = the `#xsec-table` 0° end values.
- **Legend.** The title and desc min/max equal the card thinnest/thickest. Ticks = levels + 2, with 6 levels (2,0…4,5), step 0,5 mm. Shader uniforms = the engine levels.
- **Pixel = legend colour.** See above.
- **No leak over Glas ↔ Dickenkarte**, 1 warm-up plus 5 cycles: `{geometries 16, textures 6, programs 11}` → `{16, 6, 11}`.
- **axe** at 320×640 and at each project viewport (1280×800, 360×780): zero violations. No horizontal scroll at 320, and the legend labels stay inside the legend box.

### Layout and screenshots (Playwright, looked at)

| Viewport | scrollWidth / innerWidth | Switch segment heights | Legend |
|---|---|---|---|
| 1280×800 | 1280 / 1280 | 48 px | 400 px, one tick row |
| 412×915 | 412 / 412 | 48 px | 380 px, one tick row |
| 320×640 | 320 / 320 | 52 px ("Dicken-karte" wraps to 2 lines) | 288 px, one tick row after the measured-width fix (labels 1,5 … 5,0 with ≥ 11 px gaps) |

- **Contrast.** Legend labels and ticks are `--fg` #1a1a1a on #fff, 17,4:1. Stacked cell labels are `--muted` #4a4a4a on #fff, 8,86:1 (computed in the page). The labels render at 14 px.
- **What the screenshots show.**
  - The OD lens fills the stage from the front: light yellow centre (1,8 mm), darkening to navy at the temporal edge. Concentric iso lines are black on the light part and white on the dark part.
  - Zooming out (keyboard −) shows both lenses coloured on the same scale.
  - In greyscale (CSSOM filter, test only) the map still reads light → dark from centre to edge, and the legend bar is a monotonic grey ramp.
- **Two layout bugs were found from the screenshots and fixed before committing:**
  - The thickest cell "4,6 mm (außen oben)" overflowed into the next column at 320 (`.num` nowrap). It now wraps.
  - The global td/th underlines showed inside the stacked cards. They are removed there.
- **Console.** Only the whitelisted "GPU stall due to ReadPixels" driver notes appeared.
- **Screenshots** (session scratch, not published):
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-320x640.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-412x915.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-412x915-zoomout.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-412x915-grey.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-1280-legend.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/heat-1280-grey.png`
- The chrome-devtools MCP was not available in this executor session. The D-30 screenshots, console and memory checks were done with Playwright scripts against `vite preview` instead. The MCP pass is still owed (memory: test-with-chrome-devtools-mcp).

## Deviations from Plan

1. **[Rule 1 - Bug] Heat-eye tie tolerance.** With a strict comparison the example framed OS (OS 4,597 mm marginally above OD; both shown as 4,6 mm). The fix reuses `sideEye` (SIDE_TIE_MM 0,05 mm, ties → OD). Files: view.js. Commit 8dc5244.
2. **[Rule 1 - Bug] `[hidden]` lost to author CSS.** `.segmented` (flex) and the stacked table (block) overrode the UA `hidden` rule, so Simple showed the switch. Added `#view-mode[hidden], #view-heat-table[hidden] { display: none !important }`. Commit 8dc5244.
3. **[Rule 2] Radios are disabled until the first mesh attach, and `#view-mode` is removed without WebGL.** UI-SPEC States: heatmap controls are not rendered without WebGL. If the chunk fails to load, the radios stay disabled.
4. **Wrapper `#view-heat`** (container `viewheat`) holds the legend, table and no-chord note. It is needed for the < 480 px stacked-table container query. DOM order is unchanged.
5. **Thickest row text** is in the cell (see decisions). The extra keys `view.heatEye.*` are used now as the table column headers.
6. **e2e pixel test.** It uses the heat eye (OD for the example) and the engine CT from the test handle `ocWorld(eye)[3]`, asserted equal to the card's Mitte text, instead of the 0,1-rounded card value.
7. **The plan's "1280" axe test** runs at each project viewport (desktop 1280×800, mobile 360×780). 320×640 is a separate test.

## Open items

- 03-13: the projected callouts, iso-line labels (`isoLabelPoints`) and the `#view-heat-eye` picker (set `pickedEye` in view.js and call `goTo('heat', eye)`). VIZ-05 completes there.
- 03-14: A/B heat scale over all four lenses (D-25).
- The live chrome-devtools MCP pass at 412×915 / 320×640 / 1280×800 for Dickenkarte (D-30), and a 4×-throttled trace of the switch.
- The view chunk grew by 10 kB (615 kB, the Three.js chunk). This is unchanged in kind.

## Known Stubs

None. `pickedEye` is always null until 03-13 adds the picker; the default rule applies, which is the intended behaviour.

## Self-Check: PASSED

- Files exist: cividis.js, cividis.test.js, heat.js, legend.js and e2e/view-heat.spec.js.
- Commits exist: 68313c5 (test RED), ec18ef7 (feat GREEN) and 8dc5244 (feat Task 2).

## TDD Gate Compliance

Task 1 RED `test(03-12)` 68313c5 failed first (7 failures: module missing / functions missing). GREEN `feat(03-12)` ec18ef7 passed 36 tests.
