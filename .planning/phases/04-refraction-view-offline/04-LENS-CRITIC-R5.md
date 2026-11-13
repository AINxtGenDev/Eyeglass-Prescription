# Phase 4 — lens-critic plan review (round 5)

**Date:** 2026-11-13
**Reviewed:** 04-01-PLAN.md … 04-15-PLAN.md after revision 4
**Verdict:** PASS — 0 BLOCKER, 0 MAJOR, 2 new MINOR (both applied by the orchestrator, see end)

## Status of round-4 findings

| ID | Status | Evidence |
|---|---|---|
| NEW-11b (M3 (a) on-screen bound) | closed | 04-08:139/:152 match the round-4 fix: 2 px lattice, `M3A_EDGE_PX = 1.5` at eye and object direction, class 1 only, one clean set for every oracle and `changedPixels(page, points)`, non-empty LL and LR, 40 → 60 → moved fallback, four literals frozen; 04-VALIDATION:62/:64 agree. |
| NEW-12 (parity hash cascade) | closed | 04-02:135: `compute-protocol-*`, `mesh-protocol-*`, `warp-protocol-*` as anchored whole-name entries with `normalisedEqual: true`; exactly one entry without it, matching `view-AAAAAAAA.js`; synthetic test that a blanket compute-protocol entry fails. Early warp-protocol registration does not weaken the gate (anchored, normalised-equal, skipped only when neither build has the chunk; one-build-only fails). |
| NEW-14 (frame fallback outside model range) | closed | 04-10:142, 04-11:86 change the shape (`rund`, then `panto`) at the minimum box; tests assert `validateFrame` all-null, PD in `RX_RANGES.pd`, `Object.hasOwn(SHAPES, shape)` — all exist and behave as assumed. |
| H (6a acceptance) | closed | 04-14:195/:206 match 04-06:35/:168 and 04-VALIDATION:74. |
| I (flipped texture) | closed | 04-08:141 item 1 checks a letter-band pixel above centre in Ohne Glas, colour differing at the mirrored tan; `drawBand` (backdrop.js:63–82) makes a paper point in the band margin findable from the chart definition. |

Nothing closed in rounds 1–4 reopened (spot-checked M3 (b)/(c), D-02 wording, KILL skips in 04-06/04-14, 04-12 step 3a full gate, 04-05 leaves `parity.test.js` untouched).

## NEW-11b re-run against the plan's exact rule (`r5-m3plan.mjs`, `r5-dbg2.mjs`)

- Wide sweep (240–640, 242 cases): 0 correct-picture failures, 0 wrong-mapping passes, 0 sizes without a usable window (230 at 40 px, 12 at 60 px).
- Near desktop (170–230 × 230–280, 462 cases): 0 correct failures, 0 wrong passes; 10 sizes without a usable window (170×240, 170×270, 176×245, 176×280, 179×265, each eye; LL_o 12–16 < 20; all narrower than 180 px → plan stops and reports).
- 199×250 (OD and OS), 40 px window: clean sets 203 / 271 points; LL_o 62, LR_o 0; bounds 37,2 and 12,4. Flipped and mirrored both give LL 0 / LR 92 → fail. Screen-model counts equal oracle counts.

**GPU code path (`r5-gpu.mjs`, SwiftShader WebGL2, headless Chromium from the repo's Playwright):** sRGB 4096² checker over |tan| ≤ 0,8, mipmaps, LINEAR_MIPMAP_LINEAR, anisotropy 8, sRGB output, traced uv on a 4 px sw-ne grid vs identity uv, `readPixels` at clean pixel centres.
- 199×250: LL_s = LL_o = 70, LR_s = LR_o = 0 for OD and OS; largest RGB difference on unchanged points 2.
- Varied anisotropy (0/8), texture (2048/4096), extent (0,8/1,2), cell (4/10 px), 10 panel sizes up to 640×480 and 360×600: all pass; worst false-change count 6 vs slack 22,8.
- Clean margin 1,0 / 0,75 / 0,5 px still pass; at 0,5 px 14 false changes in LR vs 30,4 slack, so 1,5 px leaves real margin.

## NEW-12 emulation (`parity2/`, `norm.mjs`)

Emulated 04-08's import graph in a scratch copy (engine `warp.js`, `warp-protocol.js`, `warp-client.js`, `warp.worker.js`, `ref-layout.js` importing `CELL_DIAGONAL`, `ref-mode.js` with the Worker and `loadSyncHandler`, the MODE-gated line); `vite build` and `vite build --mode e2e`:
- `warp-protocol-*` differs in name, imports `./view-*.js`, byte-identical after normalisation; `index`, `compute-protocol`, `mesh-protocol` normalised-equal.
- `warp.worker-*` and CSS same names; a new shared `design-*` chunk with the same name in both builds.
- Emulation, not the real 04-08 code.

## New findings (MINOR)

1. **Unexpected new chunk in 04-08 would stall with no route to fix** (04-05:160, 04-02:135, 04-08 `files_modified`). 04-08's own verification (04-08:272) already runs `test:dist`, but `parity.test.js` is not in its files. Low likelihood. Fix: in 04-08 T3, an unlisted differing chunk → stop and report (do not widen); correct 04-05:160 to "first checked by 04-08's verification".
2. **Wording:** 04-10:142, 04-11:86 say the item-12 box "sits at the lower limit of every model range"; PD 40 is the upper limit of [25, 40]. No number affected. Fix: "at a limit of every model range".

## Recommended improvements (non-blocking)

1. Finding 1's stop rule in 04-08 T3.
2. 04-08 T3 records the real 1280×800 panel size and the SwiftShader counts in its SUMMARY; runs at 240×320 and 360×600 show 3–8 false changes, so a real-hardware check during the D-30 MCP pass is worthwhile.
3. Finding 2's wording.

## Verified

**By running** (scratch only): `r5-m3plan.mjs`, `r5-dbg2.mjs`, `r5-gpu.mjs`, `parity2/` + `norm.mjs`, `r5-ab.mjs` (shape lever: at 199×250 `rechteckig` gives 7 usable A/B points < 8, `rund` 167, `panto` 84, frame B 0 rim points; at 179×270 `rund` 249, `panto` 128); `node` calls: `validateFrame({A:40,B:28,DBL:14})` all-null, 36/24 out-of-model; `RX_RANGES.pd` [25, 40]; `SHAPES` = rund, rechteckig, panto, pilot; `inside()` inclusive.

**By reading:** 04-08 in full; edited parts of 04-02, 04-05, 04-10, 04-11, 04-14, 04-VALIDATION; 04-03:116/131; 04-06:35/:168; `validate.js`, `frame.js`, `shapes.js`, `backdrop.js:20–110`.

**Not verified:** real phone/desktop GPU pixels (SwiftShader only); real panel size at 1280×800 (199×250 assumed from UI-SPEC:221); the real 04-08 chunk graph; Playwright `pixels(points)` at device pixel ratio ≠ 1.

## Orchestrator follow-up (2026-11-13)

All three recommendations applied before commit: stop-and-report parity rule plus SUMMARY record of the 1280×800 panel size and SwiftShader counts in 04-08 T3 step 5; 04-05:160 reworded to "the first `npm run test:dist` after that is 04-08's own verification"; "at a limit of every model range" in 04-10 and 04-11.
