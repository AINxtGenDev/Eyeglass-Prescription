---
phase: 04-refraction-view-offline
plan: 16
subsystem: ui-view
tags: [gap-closure, lens-critic-MAJOR-2, lens-critic-m1, lens-critic-m2, lens-critic-m3, durchblick, dickenkarte, copy]
requires: ["04-13"]
provides:
  - "tiers.js refChartPx(startTier, maxTextureSize): Durchblick chart 4096² on fein, 2048² on the phone start tier"
  - "ref-layout.js rimBandPx + RIM_NOTE_MIN_PX 12: the rim notes only where the drawn rim band is ≥ 12 px wide"
  - "view.callout.tableOnly.fs: the fullscreen Dickenkarte note points out of the fullscreen"
  - "view.caption.ref reworded (size and shape, not 'so sehen Sie')"
affects: [04-13 push gate]
tech-stack:
  added: []
  patterns:
    - "device-class choices read the grid start tier (ref-mode deviceStartTier), not the current quality tier"
key-files:
  created:
    - .planning/phases/04-refraction-view-offline/04-16-SUMMARY.md
  modified:
    - src/ui/view/tiers.js
    - src/ui/view/refraction.js
    - src/ui/view/ref-mode.js
    - src/ui/view/ref-layout.js
    - src/ui/view/view.js
    - src/ui/view/labels.js
    - src/ui/view/text.js
    - src/i18n/de-AT.js
    - e2e/view-ref.spec.js
    - e2e/view-fullscreen.spec.js
    - .planning/phases/04-refraction-view-offline/04-UI-SPEC.md
decisions:
  - "Chart size keys on the device's Durchblick start tier (fein → 4096, else 2048), so a desktop that steps down at runtime keeps its texture and a phone never allocates 4096²"
  - "The chart source canvas is kept: three r187 re-uploads every texture from texture.image after webglcontextrestored"
  - "m1: rim note gated on the drawn band width (≥ 12 px), not an outline on the rim"
  - "m2: new fullscreen wording; the table is not moved into the fullscreen panel"
metrics:
  completed: 2026-11-14
---

# Phase 4 Plan 16: 04-16 pre-push fixes Summary

Gap closure from the 04-13 lens-critic result review. The user chose "Quick fixes, then push". Four fixes, one atomic commit each, each with a test that failed before the fix and passes after it. Nothing was pushed. STATE.md, ROADMAP.md, session.md, README.md, version.js (still dev-1.8) and sw-kill-switch.js were not touched.

## Commits

| Item | Commit | What |
|---|---|---|
| MAJOR 2 chart texture | 75d94d3 | `refChartPx`: 2048² on the phone start tier, 4096² (capped by maxTextureSize) on desktop |
| m2 fullscreen note | e831094 | `view.callout.tableOnly.fs` while the note sits in `#view-fs-info` |
| m1 rim note | bd5bfdc | the rim notes only for a drawn rim band ≥ 12 CSS px |
| m3 caption | b3e1006 | `view.caption.ref` names size and shape |

## MAJOR 2: chart texture

- **Signal.** `ref-mode.js` `deviceStartTier()` (exported; `refStartTier(pickTier(coarse pointer, screen))`) is the existing "phone" signal of the Durchblick. It is fixed for the session, unlike `view.tier()`, which can step down at runtime. `createRefraction({ …, startTier })` sizes the chart with `refChartPx(startTier, maxTextureSize)`: fein → 4096, mittel → 2048, both capped by the device limit.
- **Measured** (view-ref "MAJOR 2 (04-16)" annotations, SwiftShader): desktop **4096 × 4096** (maxTextureSize 8192); mobile project **2048 × 2048** (maxTextureSize 8192, start tier mittel). On the phone tier the canvas goes from 64 MiB to 16 MiB (RGBA), and the GPU copy with mipmaps from about 89 MiB to about 22 MiB. These are computed from the size; GPU memory was not measured on a device.
- **Releasing the source canvas: not done, on purpose.** three r187 keeps the only CPU copy in `texture.image` (`Texture.image` → `source.data`). After `webglcontextrestored`, `initGLContext()` builds new `WebGLProperties`, so every texture is uploaded again from `texture.image` (`WebGLTextures.setTexture2D`, which warns "Texture marked for update but no image data found" and skips the upload when the image is null). `refraction.reupload()` relies on the same image. **Checked by experiment:** a scratch build that nulled the image in `onUpdate` failed "webglcontextlost in Durchblick: redrawn from the last warp on restore". The pixels after the restore differed, and three logged that warning 10 times. The patch was reverted with `git checkout -- src/ui/view/refraction.js`; it was never committed.
- **TDD.** RED: `tiers.test.js` failed (no `refChartPx`). GREEN: 9 / 9. The new e2e test reads the size from `chartInfo()` (via `__eyeglassView.ref().chart`, e2e build only), so it could not run before the handle existed.
- Phone size: view-ref (including the M3 on-screen gates) and view-memory passed on desktop and mobile after the change: 57 passed, 17 skipped by design.

## m2: fullscreen Dickenkarte note

- New key `view.callout.tableOnly.fs`: „Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle unter der Ansicht. Beenden Sie dazu das Vollbild.“ `labels.js` `settleNote()` uses it while `#view-callout-note` is inside `#view-fs-info`, the F-02 DOM move, which is the single source of truth. `view.js` calls `settleNote()` on every fullscreen change.
- **Why not move the table.** The UI-SPEC fullscreen panel is capped at `max-height: 40%`. The table would push the legend and the note into its scroll, and the spec's move list would change. A wording change keeps F-02 as specified. The UI-SPEC Fullscreen section now names the key.
- TDD: view-fullscreen "Dickenkarte fullscreen at 320×640 (04-16 m2)" failed on both projects before the fix (received the old wording) and passes after it. The test also checks the normal wording after exit.

## m1: rim note (choice and why)

- **Choice: show the note only when the drawn band is ≥ 12 CSS px**, not a contrasting outline. Reasons:
  1. The user's own Task 2 selection reads "m1 rim note only when the rim is visible".
  2. An outline would repaint about 1–1.5 px on one side of every chart/rim boundary. The M3 and item-12 hard gates assert chart pixels at ≥ 1 px from the class change, and rim pixels where the engine says class 2 / 4 ("exactly where the engine classes put them"). An outline would put those gates at risk just before a push.
- **Measure.** `rimBandPx(rects, w, h)` (ref-layout.js, pure) rasterises the drawn rim cells and rim leaves at 1 px by pixel centre. A 3-4 chamfer distance transform then gives each rim pixel its distance to the nearest non-rim pixel; outside the panel counts as non-rim. The result is 2 · the largest distance: W or W + 1 for an axis-parallel band of W px, within 10 % for a 45° band (unit tests). It runs only when the engine reports `rimInField`. The engine flag itself, the ticks (N11), `info().rim` and the drawing are unchanged. `text.js` is unchanged except for a JSDoc line, and text.test.js stays as it is (it tests the flag → note mapping).
- **Measured:** at 1164×593 with the 04-13 rim case (rechteckig 40/28/14, PD 40, −4,00), panel L has a 10,0 px band and panel R 10,7 px, so there is no note. The engine still reports the rim. At 320×640 (item 12) the bands are 36 px (−4,00) and 50 px (+4,00), so the note is shown. The widest point (10–11 px) is wider than the 5–6 px that 04-13 probed on the centre row; the measure takes the widest point on purpose.
- TDD: `ref-layout.test.js` failed 7 / 38 before (no export) and passed 38 / 38 after. The view-ref "04-16 m1" e2e test failed before. Its first assertion is `rimBandPx < 12`, so before the fix it failed on the missing handle; the note itself was documented as shown in 04-13. Item 12 now also asserts band ≥ 12.

## m3: caption

- `view.caption.ref`: „So verändert diese Brille Größe und Form dessen, was Sie geradeaus in der Ferne sehen – berechnet durch die Vorder- und Rückfläche Ihrer Gläser. Gezeigt ist der mittlere Teil des Blickfelds.“ It matches `view.ref.scope` („… zeigt Größe und Verzerrung, nicht die Schärfe“). The UI-SPEC copy row is updated.
- TDD: a new `dictionary.test.js` block failed and then passed. The view-ref item 7 string is updated; grep finds no other test or spec that asserts the old caption.
- **Not changed, flagged:** `view.aria.ref` (canvas accessible name) still says „so sehen Sie mit dieser Brille geradeaus in die Ferne …“, the same overclaim. It was outside the four items. Changing it touches three text.test.js expectations and UI-SPEC line 640.

## Deviations from Plan

None beyond the choices the task left open (m1 option, m2 option, canvas release). `view-compare.spec.js` was added to the affected e2e set because it asserts the table-only string.

## Gate at HEAD b3e1006

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 59 files, 2148 passed. All files 99,25 / 97,73 / 100 / 99,63 %; engine 98,84 / 97,43 / 100 / 99,37; engine/mesh 99,8 / 98,48 / 100 / 100 |
| `GITHUB_SHA=$(git rev-parse HEAD) npm run build` | exit 0, precache 16 entries (965,07 KiB); `dist/index.html` content="b3e1006", dev-1.8 |
| `npm run build:e2e` | exit 0 |
| `npm run test:dist` | 21 passed, 1 skipped (kill flag off); precache size 1 007 883 bytes (limit 2 000 000) |
| affected e2e (view-ref, view-heat, view-fullscreen, view-memory, a11y, layout, view-compare), desktop + mobile | 220 passed, 33 skipped, **1 failed** (17,1 min, load up to 24,6): view-ref item 10 (mobile), `.ref-pill--blocked:visible` not found within 5 s |
| item 10 alone, mobile, `--repeat-each=3 --workers=1` (load 9,7) | 3 / 3 passed. Item 10 also passed in the earlier full view-ref run on both projects. No 04-16 change touches the blocked pill; treated as the known load flake (deferred-items 04-10/04-14) |
| `npx playwright test --project=pwa --workers=1` | 20 passed, 1 skipped (kill flag off) |
| `npm run test:e2e:live` | 323 passed, 1 skipped |

Every Playwright run was wrapped in `flock …/scratchpad/e2e.lock`.

## Screenshots (Playwright, production preview 4173, served b3e1006)

Saved in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-16-shots/`. Script: `04-16-shots.mjs` in the same scratchpad. The preview was stopped by its PID; port 4173 then returned 000.

- `04-16-412x915-durchblick.png` (DPR 2,6, mobile): two panels, "Linkes Glas" left and "Rechtes Glas" right, badge "Durchblick · berechnet", letter band „P E D E“, ticks at the edges. The new caption shows in full under the tip, then the Bild toggle, the size block (R 90° 5 % / 180° 4 %, L 80° 5 % / 170° 4 %), the edge and cylinder notes and the scope. No overflow.
- `04-16-1164x593-durchblick.png` (load example): two panels with the letter band „L P E D E F“ and the pills. The new caption is under the tip, cut off at the bottom of the `#view` crop because the size block sits below it.
- `04-16-1164x593-durchblick-rim.png` (rim case −4,00, 40/28/14, PD 40): a thin dark band along the outer left edge of panel L and the outer right edge of panel R. It is hard to tell from the black squares, which is the m1 case. The size block reads "Bild etwa 6 % kleiner" for both eyes with only the edge note. **No rim note** (DOM facts).
- `04-16-320x640-fs-dickenkarte.png` (DPR 2, fullscreen): the heat map of both lenses with the R / L labels and one "2,0" label on the right lens. Below it is the info panel with "Dicke in mm", the cividis legend 1,5–5,0 and "Linien alle 0,5 mm", then the new note „… stehen in der Tabelle unter der Ansicht. Beenden Sie dazu das Vollbild.“ The panel does not cover the picture.

Console: "Service Worker registration blocked by Playwright" (expected with `serviceWorkers: 'block'`) on every page. The 412 page also logged the known "GPU stall due to ReadPixels" warning (04-13 m5, unchanged).

## Self-Check: PASSED

Commits 75d94d3, e831094, bd5bfdc, b3e1006 exist; all listed source files are modified in them; no background process left (preview stopped, port 4173 → 000).
