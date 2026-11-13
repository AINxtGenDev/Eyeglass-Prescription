---
phase: 04-refraction-view-offline
plan: 08
subsystem: ui/view (Durchblick)
tags: [REF-01, durchblick, warp, webgl, e2e, M3]
requires: [04-01 refSizeBlock/refAria + magnification, 04-03 warp.js + P0 values, 04-05 warp worker + warp-client, 04-06 service worker]
provides: [Durchblick mode, refraction draw pass, ref-mode warp lane, ref-layout panel geometry, M3 on-screen gate, hook-free live smoke]
affects: [04-09 rim leaves/ticks/one-panel picker, 04-10 degradation/failure UI, 04-11 A/B in Durchblick, 04-12 fullscreen, 04-13 result review]
tech-stack:
  added: []
  patterns: [own Scene + OrthographicCamera through scene.setPass, uv-as-traced-object-tan grid mesh, Node oracle over a shared clean point set]
key-files:
  created: [src/ui/view/ref-layout.js, src/ui/view/ref-layout.test.js, src/ui/view/refraction.js, src/ui/view/ref-mode.js, e2e/view-ref.spec.js, e2e/ref-live.spec.js]
  modified: [index.html, src/i18n/de-AT.js, src/ui/style.css, src/ui/view/view.js, src/ui/view/backdrop.js, src/ui/view/controls.js, e2e/helpers.js, e2e/pwa.spec.js, e2e/support/live-specs.js, test/ci/live-subset.test.js, e2e/view.spec.js, e2e/view-heat.spec.js]
decisions:
  - "M3 (c) samples the vertical line 3,5 squares temporal of the panel centre, not 0,5: with valid inputs (B ≥ 28) no frame puts the rim in the 1280×800 field on the 0,5-square line"
  - "The warp sync handler is imported statically into the view chunk (warp.js is already there); the dynamic import created an unlisted hash-cascade chunk frame-*.js"
  - "controls.js gets suspend()/resume() so OrbitControls, keys and '3D drehen' are off in Durchblick (D-10)"
  - "One full-stage render of the ref scene instead of per-panel scissor passes (the grids exactly tile their panels)"
metrics:
  duration: ~55 min
  completed: 2026-11-13
  tasks: 3
---

# Phase 4 Plan 08: Durchblick (first visible slice) Summary

The Durchblick is live: "Glas | Durchblick" (plus Dickenkarte in Expert), two wearer-view panels drawn from the engine warp grid through the one renderer, "Mit Glas | Ohne Glas" with the same class mask, the engine size block, and the lens-critic M3 gate passing on screen for OD and OS.

## What was built

- `ref-layout.js` (pure): `panelLayout` (two panels from 360 px, `floor((W − 2)/2)` wide, L = OS left, R = OD right, flush right), `pxPerTanFor`, `CHART_SQUARE_TAN = tan 6°`, `REF_SPLIT_MIN_PX = 360` (asserted equal to compare3d `SPLIT_MIN_PX`), `gridTriangles` from `CELL_DIAGONAL` (throws at load for an unknown name), and the shared chart definition `checkerInk` / `inLetterBand` that the texture and the Node oracle both use.
- `refraction.js`: own `Scene` and `OrthographicCamera` in stage CSS px, drawn by `scene.setPass`, so there is one WebGL context. There is one grid mesh per panel, allocated in `setLayout`. The `uv` attribute is the traced object tan, written in place. The chart is a `CanvasTexture` (R = 1,6, side min(4096, max), mipmaps, sRGB), drawn with backdrop's `drawLetterBand`. Cells with all-1 or all-5 corners are chart, all-3 is the `#f3f4f6` fill, everything else (including mixed cells) is `#221e1c`. Ohne Glas uses the identity uv and keeps the mask. Eye pills sit bottom-centre, 8 px above the panel bottom. It also has `dispose` and `reupload`.
- `ref-mode.js`: the warp worker is created lazily on the first entry. It uses the warp-client (latest wins, `cancel()` on leave). A job is posted only when items or layout change. A reply is drawn in its own rAF after an `isWarpCurrent` re-check and the grid-length check (T-04-31). The stage shows "Durchblick wird berechnet …" and no chart pixel before the first picture. After 100 ms the stale badge is "Durchblick wird berechnet …". `#view[data-pending] = 'warp'` until the warp is drawn. The size block uses `refSizeBlock` (textContent only), the scope sentence has h = 15,0 mm, the canvas name comes from `refAria`, and `tech.ref.eye` is filled.
- `view.js`: the `'ref'` mode. On entry it saves the preset, eye and "3D drehen", suspends the controls, hides the tools, removes the tab stop and description, adds the touch-action class, and switches title, stage and fullscreen labels and the blocks. On leave it cuts back to the saved preset and restores everything. The mesh lane no longer writes the badge or status inside Durchblick. `data-pending` carries both lanes. The test handle gains `ref()` (inside the MODE gate).
- DOM and copy: `#view-mode` is visible in Simple view, and only the Dickenkarte label has `data-expert`. `.segmented--stack` applies below a 400 px `#view` when three options show. `#view-ref` has the Bild toggle, side, size and scope. The `tech-ref-*` lines and all the UI-SPEC keys are in.

## M3 hard gate: measured on screen (SwiftShader, desktop project, 1280 × 800, dpr 1)

The real panel size at 1280 × 800 is **270 × 338,75 at 293,37 px/tan** for both panels (handle `ref()`; equals `M3A_PANEL` from 04-P0-RESULTS.md). The stage border box is 544 × 340,75.

**M3 (a)**, 0,00 / −4,00 × 45 both eyes, M3A_WIN = 40 (no fallback needed), 2 px lattice, M3A_EDGE_PX 1,5:

| panel | clean LL / LR | LL_o / LR_o (oracle) | LL_s / LR_s (screen) | bound LL_s ≥ 0,6·LL_o | bound LR_s ≤ LR_o + 0,2·LL_o |
|---|---|---|---|---|---|
| L (OS) | 229 / 263 | 103 / 0 | **106 / 0** | 61,8 ✓ | 20,6 ✓ |
| R (OD) | 229 / 263 | 103 / 0 | **106 / 0** | 61,8 ✓ | 20,6 ✓ |

The oracle test (Node only) gives y-flipped 0 / 125 and x-mirrored 0 / 125 for both panels. Both fail condition (3), because 0 < 61,8. The correct mapping passes condition (2): 103 ≥ 20 and 0 ≤ 25,75.

**M3 (b)**, OD −4,00 / OS +4,00. The third edge right of the centre, on the row half a square below the centre:
- R (OD): Ohne 500,0 → Mit 494,0 (inward, 6 px).
- L (OS): Ohne 228,0 → Mit 236,0 (outward, 8 px).

**M3 (c)**, pilot A 40 / B 30 / DBL 14 / PD 40, CR-39, −4,00 both eyes, column 3,5 squares temporal:
- R (OD): x 514,5. The rim point at y 0,5 reads `34,30,28` (#221e1c). The lens point at y 190,5 reads `26,26,26` (chart ink).
- L (OS): x 27,5. The rim point at y 0,5 reads `34,30,28`. The lens point at y 190,5 reads `255,255,255`.

## Verification run

| Command | Result |
|---|---|
| `npm run lint` | clean |
| `npx vitest run src/ui/view/ref-layout.test.js test/ci/live-subset.test.js` | 30 / 30 |
| `npx vitest run src/i18n` | 194 / 194 |
| `npm run build && npm run build:e2e` | ok |
| `npm run test:dist` | 17 passed, 1 skipped. The PARITY_ALLOW list is unchanged; see the deviation on the static import. |
| `npx playwright test e2e/view-ref.spec.js e2e/ref-live.spec.js` | 25 passed, 5 skipped. The skipped ones are the two-panel gate on mobile, by design. |
| `npm run test:e2e:live` | 323 passed, 1 skipped. ref-live passes on desktop and mobile against dist. |
| `npx playwright test --project=pwa` | 5 / 5. The offline test now enters the Durchblick and asserts the badge and that the warp worker came from the service worker. |
| `npx playwright test e2e/view.spec.js e2e/view-heat.spec.js e2e/view-controls.spec.js` | Full run at load average 21–33: 124 passed, 23 skipped, 7 failed (desktop only, 30 s timeouts: VIZ-02 ×3, VIZ-03 mouse drag, A2 1280, VIZ-05 ×2). Those 7 rerun alone at load ≈ 10: **7 / 7 passed**. The earlier run (Task 2 build) had 4 real failures (320 px overflow), now fixed. |
| `npm run test:coverage` | 2064 / 2066. The 2 failures are the known `src/engine/diagnostics.test.js` 120 s timeouts under load (ENG-07 extremes grid, MAT-02 optimality sample). That file is not touched by this plan. |

RED (Task 1, before Task 2): `item 3` and the ref-live smoke failed with `locator.click: Test timeout … waiting for locator('#view-mode label').filter({ hasText: 'Durchblick' })`. The `M3 (a) oracle` test already passed in Task 1.

Acceptance greps:
- `ShaderMaterial|RawShaderMaterial|onBeforeCompile` in refraction.js: 0
- `new WebGLRenderer` in refraction.js and ref-mode.js: 0 / 0
- `warp.worker.js` in ref-mode.js: 1
- `gridTriangles(` in refraction.js: 1
- `M3A_MIN`: 0
- the five literal lines: present
- `__eyeglassView|backgroundProbe(` in ref-live: 0
- `Produktform` and `HSA + 3,05` in de-AT.js: 0

## D-30 visual pass: Playwright Chromium (the chrome-devtools MCP pass is still owed; the orchestrator does it after the merge)

The screenshots are in the scratchpad, named `04-08-<size>-<case>-<mit|ohne>.png`. They were taken against dist-e2e from this branch. The served app-commit is "dev" because there was no GITHUB_SHA. The tree is identical to 955d363.

- **1280 × 800** (two panels, 270 × 338,75), cases −4,00 / −1,00 / +4,00 / −2,00 −2,00 × 30 / 0,00 −4,00 × 45 / −10,00:
  - −4,00 Mit: the squares shrink toward the panel edges, and the edges bow.
  - −4,00 Ohne: a regular grid, with the checker corner at each panel centre and the letter band just above it.
  - −2,00 / −2,00 × 30 and 0,00 / −4,00 × 45: sheared squares. In the × 45 case the stretch runs along one screen diagonal and the squares along the other stay square. The size text gives the 135° meridian as "von links unten nach rechts oben", which is the LL–UR diagonal, where the M3 (a) counts change.
  - Pills "Linkes Glas" left and "Rechtes Glas" right. They do not overlap the badge or the fullscreen button (measured), there is no horizontal scroll, and no text is clipped.
- **1164 × 593** (in the 400 px column, panels 198 × 248,75 at 215,42): the same picture at a smaller scale. Pills are clear.
- **412 × 915** at dpr 2,6 and at dpr 1 (panels 189 × 285 at 246,82): the letter band and the pills are legible at both ratios (prepared for N4). The view block shows the switch "Glas | Durchblick", the stage, the hint, the caption, the Bild toggle, the side note, the size block and the scope sentence.
- **320 × 640**: one panel (288 × 216 at 249,42), OD only, pill "Rechtes Glas". Today there is no picker, no default-eye rule and no side wording for one-panel mode beyond `view.ref.side.one`; 04-09 adds them.
- Console: only Playwright's "Service Worker registration blocked" and Chromium's "GPU stall due to ReadPixels" driver notes (the latter at dpr 2,6). There were no THREE or WebGL errors.
- The white band reported for 04-06 at 320 × 640 was not seen in these element screenshots. It is not re-checked at page level here.

## Deviations from Plan

1. **[Rule 4-adjacent, needs lens-critic acceptance] M3 (c) sample column.** The plan puts the sample line half a square right of the centre. Inside the input ranges (FRAME-02 A 40–62, B 28–55, DBL 14–24; PD 25–40) **no** frame puts the rim in the 1280 × 800 field on that line. The vertical half-field is tan 30°, which is 8,7 mm at the back surface, and the pilot outline there is at least 12 mm. Scratch scan: A 40–46, B 28–30, DBL 14–18, PD 34–40, both panels, gave 0 one-sided cases; with B < 28 (invalid input) the largest one-sided band was 10 px. The test therefore uses the column 3,5 squares temporal of the centre (still half a square off a checker edge): OD right, OS left, pilot 40 / 30 / 14, PD 40. There the top rim is in the field and the bottom is not. Every other condition is kept or tightened:
   - the colour group must hold for cellPx + 2 px both along the line and along the row;
   - the class-1 point must be ≥ ¼ square from the checker edges and outside the band;
   - the line must have no rim below the centre.
2. **[Rule 3] Parity: dynamic → static sync-handler import.** `npm run test:dist` first reported an unlisted differing chunk `frame-aVEKmhRV.js` / `frame-BZt-LvCA.js` (7 339 B each). After hash normalisation it was byte-identical: a pure hash cascade, since it imports the entry by hashed name. It appeared because the dynamic `warp-protocol` chunk made Rolldown split the engine modules shared with the view and mesh-protocol chunks. The allow list was **not** widened. ref-mode.js imports `createWarpHandler` statically instead (warp.js is already in the view chunk through ref-layout.js), which keeps the fallback contract: `loadSyncHandler: () => Promise.resolve({ createWarpHandler })`. Parity now passes with no warp-protocol chunk at all. That chunk's allow-list entry stays unused. A `magnification-*.js` chunk exists and is byte-identical in both builds.
3. **[Rule 3] `controls.js` (not in files_modified): `suspend()` / `resume()`.** D-10 needs OrbitControls, keys and "3D drehen" off in Durchblick. Without this, `paintMesh`'s `controls.enable()` would also re-enable input mid-Durchblick.
4. **[Rule 1] Phase-3 specs follow the plan's own D-09 / D-11 changes.**
   - `e2e/view-heat.spec.js` "UX-02 switch only in Expert" now asserts the switch is visible and only the Dickenkarte option is hidden.
   - `e2e/view.spec.js` asserts the new `view.caption.glass`.
5. **[Rule 1] Stack overflow at 320 px.** The first `.segmented--stack` used `width: 100%` on content-box labels, which made the 320 px page 340 px wide (view-heat 320 axe / overlap tests, 4 failures). Fixed by using the column-flex stretch; the 4 tests then passed. The fix is in the Task 2 commit.
6. **Item 7** waits for `mode() === 'ref'` instead of `settledRef`, so it tests the mode plumbing in Task 2 without a drawn warp, as the plan's Task 2 verify requires.
7. **TDD order:** `ref-layout.test.js` and `ref-layout.js` were written and committed together in the Task 1 commit (no separate RED commit for the pure module). The e2e RED was run and is recorded above.
8. **Render pass:** one full-stage render of the ref scene, not per-panel scissor and viewport. The grid meshes exactly tile their panels, so the result is the same with less state to restore.

## Known limits (for later plans, not stubs of this plan's goal)

- **Stage resize:** a resize re-traces, because the grid is in panel px. The UI-SPEC "redraw from the last grid without a new trace" belongs to 04-12 (fullscreen).
- **Single-panel mode:** no picker and no default-eye rule; it always shows OD (04-09).
- **Rim drawing:** mixed cells are drawn in the rim colour; there are no quadtree leaves, ticks, blocked-eye pill or `noView` pill yet (04-09).
- **Failure state:** a failed warp shows `view.ref.failed` as plain status text, with no retry button and no Fehler box (04-10).
- **Bar thumbnail:** it is off while in Durchblick (`thumbSpec` returns null). The IntersectionObserver rule from M4 is 04-09 / 04-10.
- **A/B in Durchblick (04-11):** compare captions, the divider and the compare caption are not handled yet.
- **Chart texture size:** 4096², as the plan says, which is about 89 MB of GPU memory with mipmaps. On phones this is worth revisiting in 04-10 degradation (2048² would still give lod ≈ 0–1 at phone scales).
- **Durchblick status on first draw:** while the mesh lane is still pending on a first draw, `#view-status` keeps the Durchblick text; mesh-failure text is suppressed in Durchblick.

## Flagged for lens-critic

- New keys outside the approved copy table:
  - `tech.ref.formulaSource` (M5, NEW-9 wording, verbatim from the plan);
  - `tech.ref.source.cite` (holds the Le Grand citation string used for `{cite}`);
  - `view.ref.side.one` / `.compare` use the parameter `{side}` (from `view.viewName.od` / `.os`).
- The M3 (c) geometry change (deviation 1).

## Threat Flags

None. There are no new endpoints or storage. The warp reply is length-checked before the GPU write (T-04-31), the text uses textContent only (T-04-34), and `ref()` is inside the MODE gate (T-04-35; the dist hook test passes).

## Commits

- 007e710 test(04-08): Durchblick e2e RED and pure panel layout
- fd85570 feat(04-08): mode switch, enter/leave, DOM and copy (includes the stack fix)
- 955d363 feat(04-08): draw pass, warp lane and size block (M3 gate green)

## Self-Check: PASSED

All created files exist (ref-layout.js, refraction.js, ref-mode.js, view-ref.spec.js, ref-live.spec.js); commits 007e710, fd85570, 955d363 are in the branch log.
