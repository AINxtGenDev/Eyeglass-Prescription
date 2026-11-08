---
phase: 03-3d-lenses-frame
plan: 11
subsystem: ui/view (Seite protrusion text, near-temple fade, canvas accessible name)
tags: [VIZ-03, D-19, D-29, lens-critic MAJOR 1, MINOR 1, MINOR 10, T-03-28, T-03-29]
requires: [engine/rim.js bevelSplit + frontLeadMm (03-01), frame-input paintRim + displayFrame (03-01/03-07), camera-math sideEye + controls viewName (03-09), results.js card paint]
provides: [src/ui/view/text.js (protrusionLines, protrusionKind, ariaGlass, PROTRUSION_FLUSH_MM), results.js cardStrings(eye), displayFrame().rimAssumed, camera-math nearTempleFade / TEMPLE_FADE_DEG / TEMPLE_FADE_OPACITY, frame.setFade + frameInfo().fadedSide, #view-protrusion block, dynamic #view-canvas aria-label]
affects: [03-12 (Dickenkarte aria: view.aria.heat), 03-13 (A/B aria: view.aria.compare, callout collision), 03-15/03-17 (real-device check)]
tech-stack:
  added: []
  patterns: [Node-tested string module between engine and DOM, card strings reused for the accessible name, material swap to precompiled faded clones on hidden carrier meshes]
key-files:
  created:
    - src/ui/view/text.js
    - src/ui/view/text.test.js
  modified:
    - src/ui/view/view.js
    - src/ui/view/frame.js
    - src/ui/view/camera-math.js
    - src/ui/view/camera-math.test.js
    - src/ui/results.js
    - src/ui/frame-input.js
    - src/i18n/de-AT.js
    - src/ui/style.css
    - index.html
    - e2e/view-controls.spec.js
decisions:
  - "03-11: view.aria.glass holds the two eye parts as {od} {os} (view.aria.eyeGlass / view.aria.eyeBlocked), so a blocked eye replaces its part; the composed sentence equals the UI-SPEC example exactly (unit test)"
  - "03-11: the flush rule is one constant per side of the view boundary: frame-input RIM_FLUSH_MM and text.js PROTRUSION_FLUSH_MM, both 0,05; text.test.js reads frame-input.js and asserts equality and that no literal 0.05 comparison remains"
  - "03-11: without KHR_parallel_shader_compile the hidden faded-material carriers are compiled with the synchronous renderer.compile(carrier, camera, scene); the e2e program-count check fails without it (8 → 10 programs, measured)"
  - "03-11: in the side-view cone (nearTempleFade) overlapping eye labels keep only the near eye's label; outside that cone both stay"
metrics:
  duration: ~35 min
  completed: 2026-11-08
  tasks: 2
  files: 12
---

# Phase 3 Plan 11: Seite protrusion in words, near-temple fade and the canvas accessible name Summary

The 3D view now says in plain German how far each lens's thickest edge stands out of the rim at the front and back. It also says how far the front surface stands ahead of the rim. Both use the same engine helpers, rim depth and 0,05 mm rule as the Expert rim lines. Seite fades the near temple and hinge to 25 %, and it names the eye whose edge is shown. `#view-canvas` carries a German description built from the strings painted on the result cards.

## Read first (lens-critic)

**The front-surface lead is not visible in the Seite picture for the example. It exists only as text.** Measured in Node with the engine helpers (example OD, D = 3 mm, lens-local z):
- The rim front face spans z = −0,515 … +0,326 mm over the outline.
- At y ≈ 0 it sits at +0,147 mm (x = +26) and −0,300 mm (x = −26).

The 0,5 mm lead is measured against the rim point that sits furthest back. In a pure side silhouette the rim at x = +26 is 0,147 mm *ahead* of the lens front vertex (z = 0), so it covers the vertex. The back protrusion (1,6 mm) is clearly visible as the grey-green edge band behind the black rim.

This is exactly why the `view.protrusion.lead` line exists (MAJOR 1 / SC-2). The UI-SPEC D-30 item "the front surface visibly ahead of the rim front face" cannot be met by this picture for this prescription. I did not change the geometry or the camera.

## What was built

- **`src/ui/view/text.js`** (Node-pure: imports only rim.js, t.js and format.js).
  - `protrusionKind(etMax, D)` returns the paintRim choice both|front|back|none.
  - `protrusionLines(eyes, { rimDepthMm, rimAssumed })` returns `{ title, lines, leads, assumed, bevel }`. A blocked eye gives no lines. `assumed` is null for the user's own rim depth.
  - `ariaGlass({ viewName, OD, OS, frame, material })`.
  - `PROTRUSION_FLUSH_MM = 0.05`.
- **`results.js` `cardStrings(eye)`.** It returns `{ thick, thickLoc, ct, materialId, config }`: the exact strings of the last card paint (lay location word, as in the card headline). `noResult` clears it.
- **`frame-input.js`.**
  - `RIM_FLUSH_MM` replaces the three `0.05` literals in paintRim.
  - `displayFrame()` gains `rimAssumed`: true with the switch off, or when the last valid field value was empty.
- **`camera-math.js`.** `nearTempleFade(dir)` returns 'OD' within 30° (full 3D angle) of −x, 'OS' within 30° of +x, else null. It also adds `TEMPLE_FADE_DEG = 30` and `TEMPLE_FADE_OPACITY = 0.25` (UI-SPEC [BP]).
- **`frame.js`.**
  - Faded clones of acetate and hinge are made with `setValues({ transparent, opacity 0.25, depthWrite false })` once at creation. They sit on a hidden group of one-triangle carrier meshes (position + normal).
  - `setFade(eye)` swaps `mesh.material` of `temple{eye}` / `hinge{eye}` and never toggles flags.
  - `frameInfo().fadedSide` reports the faded side.
- **`view.js`.**
  - `paintProtrusion()` runs in every `update()`. The lead is `frontLeadMm(result.surfaces, frameOutline(shape, A, B, eye), rim)`, memoised per eye by `[surfaces, shape, A, B, rim]`. The DOM is written only when the line state changes, and with textContent only.
  - `beforeRender` sets the fade from the camera direction.
  - Aria: `scheduleAria()` uses a 500 ms single timer (latest wins). It runs after each mesh attach, each `update()` and each view-name change. It calls `setAttribute('aria-label', …)` only when the text differs.
  - Without the extension, `renderer.compile(frame.fadeCarrier, camera, scene)` runs at mount.
- **`index.html` / `style.css`.** `div#view-protrusion` sits under `#view-caption` (UI-SPEC: "under the caption"). It holds the title (14 px, 600), two lines per eye, and the assumed and bevel notes in `--muted`. Empty paragraphs are not displayed.
- **`de-AT.js`.**
  - `view.protrusion.*` with the R1-7 wording, plus `.eye.od|os`.
  - `view.aria.glass|eyeGlass|eyeBlocked|eye.od|os`.

## Verification (run one after the other)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 44 files, **1756 tests passed** (03-10: 1747; +9). Engine coverage: All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 341ms`. The view chunk is 605,28 kB (gzip 155,64 kB) with Vite's > 500 kB note (it is the Three.js chunk) |
| port 4173 before e2e | `000` |
| `npm run test:e2e` | **470 passed, 10 skipped (8.6 m), exit 0**, no flaky tests (03-10: 464 passed; +6 = 3 new tests × 2 projects) |

Task verifies: text.test + camera-math.test + dictionary.test gave 170 passed. Acceptance greps:
- `bevelSplit(` in text.js = 1; `from 'three'|document.` = 0.
- `'view.protrusion.lead'` = 1; `änderbar` = 1; `export function cardStrings` = 1.
- `id="view-protrusion"` = 1; `id="view-protrusion-lead-od"` = 1.
- In view.js: `frontLeadMm(` = 1, `aria-label` = 2, `cardStrings(` = 2.
- `transparent = true|false` in frame.js = 0.

New e2e tests (both projects):
- **Protrusion as text.**
  - The example gives exactly "Rechts: Glasrand hinten 1,6 mm aus der Fassung, vorne bündig" and "Rechts: Vorderfläche bis zu 0,5 mm vor der Fassung" (both eyes). The note contains "in der Experten-Ansicht änderbar".
  - With Expert on, the mm numbers equal `#frame-rim-result-*` and `#frame-rim-lead-*`.
  - Rim 10 gives "passt ganz" / "nicht vor der Fassung", the assumed note disappears, and the Expert line says "passt". Rim 5 gives "hinten 0,6 mm" in both places.
- **Seite note and fade.**
  - The note contains "rechten", `fadedSide` is 'OD', and only the label 'R' is visible.
  - **`memory().programs` is unchanged by the first Seite.**
  - Vorne hides the note, `fadedSide` is null, and labels R and L are both shown.
  - Control run: with the carrier compile removed, the same test failed with programs 8 → 10. The check therefore discriminates.
- **D-29 aria.**
  - Default: "schräg von vorne" plus the card's `#result-od-thick` and `#result-od-ct` text, and "Fassung Rechteckig 52□18, Material 1,50 · Standard.".
  - Vorne gives "von vorne". Seite gives "von der Seite (rechtes Glas).".
  - A blocked left eye gives "Linkes Glas: nicht berechnet.", and `#view-protrusion-os` is hidden.

### Aria-label quoted from the running build (Playwright, 412×915)

- Default: "3D-Ansicht der Brille, schräg von vorne. Rechtes Glas: dickste Stelle 4,6 mm außen oben, Mitte 1,8 mm. Linkes Glas: dickste Stelle 4,6 mm außen oben, Mitte 1,8 mm. Fassung Rechteckig 52□18, Material 1,50 · Standard."
- Seite: "3D-Ansicht der Brille, von der Seite (rechtes Glas). Rechtes Glas: … (same) … Material 1,50 · Standard."

The same text appears at 1280×800 and 320×640. The console showed no messages besides the whitelisted GPU-stall notes.

### Layout check (Playwright screenshots, looked at)

- At 1280×800, 412×915 and 320×640, `scrollWidth == innerWidth` (1280/412/320).
- No `#view-protrusion` paragraph, side note or caption overflows or leaves the viewport. All toolbar buttons are ≥ 44 px.
- At 320 the protrusion lines wrap to two lines each and stay readable.
- Seite picture:
  - The grey-green edge band is visible behind the black rim (the 1,6 mm back protrusion).
  - The near (right) temple is a light translucent bar, and the far temple is opaque black.
  - The front-surface lead is not visible (see "Read first").
- Screenshots (session scratch, not published):
  - /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/side-1280.png
  - /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/side-412.png
  - /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/side-320.png
  - /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots/side-stage-412x2.png (stage only, 2×)
- The chrome-devtools MCP was not available to this executor, so the D-30 MCP protocol was done with Playwright instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Eye labels overlapped in Seite ('L' drawn over 'R')**
- **Found during:** Task 2 screenshot at 320×640. Both label anchors project onto almost one point from the side, so 'R' was partly covered (text in the view clipped).
- **Fix:** In `afterRender`, when the camera is in the side-view cone (`nearTempleFade` ≠ null) and the two label boxes intersect, only the nearer eye's label stays. A first version without the cone condition hid the wide "L – nicht berechnet" next to 'R' in the default view on the 360 px mobile project (`view.spec` blocked-eye test failed), so the rule is limited to the cone.
- **Files:** src/ui/view/view.js; e2e asserts `['R']` in Seite and `['R', 'L']` in Vorne.
- **Commit:** c84e679

**2. [Rule 3] Faded program would compile on first Seite in browsers without KHR_parallel_shader_compile**
- **Issue:** view.js only calls `compileAsync` when the extension exists. Otherwise the first render compiles, and a hidden carrier is never rendered. So the plan's "programs unchanged" check would fail on SwiftShader (and on any device without the extension), even though the MINOR 1 rebuttal holds for `compile()` itself.
- **Fix:** In the no-extension branch, a synchronous `renderer.compile(frame.fadeCarrier, camera, scene)` runs (r187 `compile` is synchronous and does not warn; the lights come from the target scene).
- **Commit:** c84e679

**3. Interface adjustments (no behaviour change against the UI-SPEC)**
- `view.aria.glass` is composed from `{od} {os}` parts (see decisions). The plan named only `view.aria.glass` / `eyeBlocked`, but a single fixed template cannot drop one eye's part.
- The side-note keys already existed from 03-09 as `view.side.od|os` ('rechten'/'linken'). They were reused instead of adding `view.side.eye.*` duplicates.
- `cardStrings` also returns `materialId` (the painted spec's material, for "Material 1,50 · Standard") and `config`.
- `nearTempleFade` tests live in camera-math.test.js, as the plan's file list says.
- The frame sizes in the aria sentence use the same `Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 })` as the compare status line (a local constant in text.js). format.js has no size formatter, and I did not add one.
- Files outside the plan list: `src/ui/frame-input.js` (rimAssumed, RIM_FLUSH_MM; the plan allowed adding rimAssumed) and `src/ui/style.css` (the protrusion block styles).

### Intermittent, not reproduced

In the targeted three-spec run (view-controls + view + expert, both projects in parallel), `[desktop] view.spec.js VIZ-02 every shape` failed once. It passed in isolation right after, and in the full e2e run. I did not capture its error. It may be load-related timing on SwiftShader. Nothing in this plan touches the shape path.

## For lens-critic

- **Front lead not visible in Seite** (see "Read first"). It is covered by text on every screen. A geometry or camera change would be a separate decision.
- **Compare mode.** In A/B mode the cards can show Vorher (A) while the 3D view draws the current input. `cardStrings` records `config` ('a' or null), but the aria label does not branch on it yet. `view.aria.compare` belongs to the A/B view plan (03-13).
- **No WebGL.** The protrusion block is filled by the view chunk, so without WebGL2 (D-17 note) it stays hidden. The Expert rim lines still carry the numbers, but only in the Experten-Ansicht. D-19's "always shown" therefore holds only where the 3D view exists.
- **Seite with a blocked near eye.** The side eye is always a drawn eye. The overlap rule can hide the far, blocked eye's "L – nicht berechnet" label while in Seite. The aria-label and the protrusion block (no lines for that eye) still state it.
- **'bündig' boundary.** The code counts ≥ 0,05 mm as protruding, and UI-SPEC defines 'bündig' as ≤ 0,05 mm. At exactly 0,05 the line says "0,1 mm" (fmtMm rounds up), consistently with paintRim since 03-01.

## Requirements

- **VIZ-03: complete.** Evidence:
  - Mouse and keyboard rotate, pan and zoom, plus the Vorne/Seite/Oben presets (03-09; e2e 'VIZ-03 presets', 'keyboard', 'wheel', 'mouse drag').
  - Touch through '3D drehen' (03-10; mobile e2e 'touch at rest scrolls', '3D drehen', 'auto-off').
  - **The side view shows the protrusion beyond the rim.** The edge band is visible behind the rim in the Seite screenshots, the near temple is faded so it does not hide the edge, and the amounts are stated in words with the Expert rule (e2e 'protrusion as text', 'Seite note and fade').
- **VIZ-06 stays Pending.** It needs a real-device measurement (03-15/03-17).

## Known Stubs

None.

## Threat Flags

None. T-03-28 is mitigated: one bevelSplit/frontLeadMm rule and one flush constant (asserted equal), the aria label built from the card strings, and e2e equality checks against the Expert lines. T-03-29 is mitigated: `textContent` and `setAttribute('aria-label', …)` only, and every value is a formatted engine number or a dictionary string.

## Self-Check: PASSED

Files text.js, text.test.js and this SUMMARY exist; commits b837af0 and c84e679 exist.
