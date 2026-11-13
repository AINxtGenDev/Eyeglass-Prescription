# Phase 4 — lens-critic plan review (round 4)

**Date:** 2026-11-13
**Reviewed:** 04-01-PLAN.md … 04-15-PLAN.md after revision 3
**Verdict:** FAIL (NEEDS WORK) — 0 BLOCKER, 2 MAJOR (NEW-11b, NEW-12), 3 MINOR (NEW-14, H, I)

## Status of round-3 findings

| ID | Status | Evidence |
|---|---|---|
| NEW-11 (M3 (a) threshold) | partly — MAJOR NEW-11b left | New rule (04-08:32, :152) has no division, is defined at every panel size, and a flipped or mirrored picture always fails it. The on-screen bound does not hold (below). |
| A (rehearsal navigation cap) | closed | 04-14:190 step 2(b): ≤ 4 navigations counted up to the second reload, with reason. 04-04:31/117: "converges after one load". |
| B (6a only a subset) | closed | 04-14:195 step 6a and 04-12 step 3a run the 04-VALIDATION:25 full-suite command plus `--project=pwa`. Wording slip: MINOR H. |
| C (manual servers on fixed ports) | closed | Ground rule 15 (04-01:103): curl prints `000`; build with `GITHUB_SHA=$(git rev-parse HEAD)`; served `app-commit` meta equals 7-char HEAD. `vite.config.js:5` falls back to `'dev'`, so a build without the variable fails loudly. `index.html:6` attribute order matches the grep; `main.js:274` fills `#app-commit` from the meta. Same-HEAD worktrees remain indistinguishable; named and covered by the port check. |
| D (`RIM_FRAME`) | partly — MINOR NEW-14 | Node choice and loud `rimInField` checks are right (04-10:142); the prescribed fallback cannot be entered in the app. |
| E (`AB_FRAME_A`) | partly — MINOR NEW-14 | Same design and defect (04-11:86). |
| F (session.md marker) | closed | `grep -cF -- "- SC1/D-02 reported to user 2026-11-13:" session.md` prints 1 (line 57, "accepted explicitly"). Old "Open … veto" text at lines 53/54 belongs to other items. D-02 wording consistent across 04-01:100, 04-03:31/:67, 04-08:73, 04-13:20/:79/:111. |
| G (parity allow-list) | patterns closed; gate reopened by NEW-12 | Whole-name anchored patterns, normalised entry comparison, synthetic cases (04-02:135). |
| Grob note | closed | 04-03:129: provisional grob `{ cellPx: 10, leafPx: 3 }`. |

Nothing from earlier rounds reopened (spot-checked NEW-1 flag path, NEW-6 reset, M3 (b)/(c), M4 live smoke, NEW-5 `reuseExistingServer: false`, `test:coverage --project unit` at 04-02:119).

## Oracle sweep against the new rule (`r4-m3.mjs`)

Wrong mappings computed directly; 40 → 60 → moved-window fallback.

- Wide sweep (240–640 × 240–640, 40 px steps, OD+OS, 242 cases): 238 sizes meet condition (2) (188 at 40 px, 46 at 60 px, 4 with moved 60 px windows); 4 cannot (240×640, 640×240, both eyes) → plan stops before Task 2 and reports (acceptable). Wrong mappings pass condition (3) in 0 cases.
- Near the likely real panel (170–230 × 230–280, 462 cases): 22 sizes cannot meet condition (2). UI-SPEC:221 assumes two 199×250 panels in the 400 px desktop column at 1280×800.

## MAJOR

### NEW-11b. A correct picture can fail the on-screen bound `LR_s ≤ LR_o + 0,2·LL_o`

- **Where:** 04-08-PLAN.md:32, :139 (`changedPixels`, threshold > 8 RGB), :152.
- **What is wrong:** the oracle samples one point per lattice position and counts a change only when the point moves into another checker square. The screen uses filtered textures, so a lattice pixel within about 1 px of a checker edge changes by > 8 RGB once the picture shifts by ~0,04 px. LR_s picks up edge pixels the oracle never counts. With LL_o ≈ 20–50, the slack of 4–10 points is less than one lattice column (10 points).
- **Evidence (scratch screen model, 4×4 supersampled coverage, exact trace):** correct pictures fail at 30 of 242 wide-sweep sizes and 114 of 462 near-desktop sizes. E.g. 199×247: LL_o 38, LR_o 0, LR_s 18 vs bound 7,6; 440×480: LR_s 19 vs 10. Same at a change threshold of 32 RGB. Real trilinear filtering and the warp interpolation error (≤ 0,45 px) can only add edge changes. Model, not a GPU run (UNVERIFIED on screen).
- **Why it matters:** `M3A_PANEL` fixes the size, so the result is deterministic; at an unlucky size the hard gate fails on a correct picture, and the literals may not change, so 04-08 T3 stalls.
- **Fix (simulated in `r4-m3fix2.mjs`):** count only clean lattice points, on screen and in the oracle alike — at least 1,5 px from every checker edge both at the eye direction and at the traced object direction; the Node oracle marks them and passes the same set to `changedPixels`. Use a 2 px lattice. Keep the four literals and the flip/mirror oracle test. Assert the clean set is non-empty.
  - Result: on-screen counts equal oracle counts exactly in every case; 0 screen-model failures and 0 wrong-mapping passes in 242 + 462 cases; sizes with no usable window drop to 0/242 and 10/462 (all at 170 px width).

### NEW-12. The 04-02 parity test fails on its first run: chunk hashes cascade into the protocol chunks

- **Where:** 04-02-PLAN.md:135, step 9a (ii).
- **Evidence (run):** scratch copy of the repo, a `MODE`-gated line added in `view.js`, `vite build` and `vite build --mode e2e`.
  - Names differ: `view-*`, `index-*`, `compute-protocol-*`, `mesh-protocol-*`. Identical: both worker chunks and the CSS.
  - `mesh-protocol` imports `./index-C_FTMivu.js` and `view-*`; `compute-protocol` imports `index-*`.
  - After replacing hashed names, `index`, `compute-protocol`, `mesh-protocol` are byte-identical between builds (`norm.mjs`).
- **Why it matters:** the protocol chunks match no `PARITY_ALLOW` entry, so the gate fails in wave 1. The likely repair under pressure is a blanket entry for `compute-protocol` (the engine's main-thread fallback), which hides exactly the drift the gate exists to catch. The 04-05 warp protocol chunk will cascade the same way. Missed in rounds 2 and 3.
- **Fix:** add the two protocol chunks as whole-name entries with `normalisedEqual: true`; require `normalisedEqual` for every future entry except `view-*` (carries the gated hook); update the plan's "measured difference" note to name all four chunks.

## MINOR

- **NEW-14. Prescribed frame fallback is outside the app's model range.** 04-10:142 and 04-11:86 shrink to "A 36 / B 24, then A 32 / B 22, then DBL/PD", but `FRAME_RANGES` is A [40, 62], B [28, 55], DBL [14, 24] (`src/state/frame.js:10–14`) and PD [25, 40] (`validate.js:35`). The item-12 frame (40/28/14, PD 40) is already at every limit; an out-of-range value blocks both eyes. Scratch `r4-rimlever.mjs` at 179×270 and 189×285, item-12 box: rim points 0 for `rechteckig` at −4, −8, −12, but 240 for `rund`, 127 for `panto`, 20 for `pilot`. Fix: make the shape the lever (`rund`, then `panto`, at the minimum box) and assert in Node that `validateFrame` accepts the chosen frame.
- **H. 6a acceptance says too much.** 04-14:206 says "every other pwa test was skipped with 'kill switch on'", but 'scope and manifest @live' still runs its manifest assertion with the flag on (04-06:168; 04-04:117 says so). Fix: "every worker-dependent test is skipped; scope-and-manifest runs its manifest part".
- **I. A vertically flipped chart texture passes M3 (a).** Flipping v flips Mit and Ohne alike, so change counts stay the same; only the letter band lands below the line of sight. Fix: in item 1, check that a letter-band pixel sits above the panel centre in Ohne Glas.

## Verified

**By running** (scratch tracer; production `warp.js` does not exist yet): `r4-m3.mjs`, `r4-m3r.mjs`, `r4-m3thr.mjs`, `r4-m3fix.mjs`, `r4-m3fixr.mjs`, `r4-m3fix2.mjs`, re-run of `r3-ab.mjs`, `r4-rimlever.mjs`; the parity build experiment in `scratchpad/lc/parity/` (scratch copy, `node_modules` symlinked, nothing written to the repo) plus `norm.mjs`; the `grep -cF` session.md marker check.

**By reading:** 04-08 in full; relevant parts of 04-01, 02, 03, 04, 10, 11, 12, 13, 14, 04-VALIDATION; `vite.config.js`, `index.html`, `main.js:274`, `src/state/frame.js`, `validate.js`, `shapes.js`, `session.md`.

**Not verified:** real GPU pixels (NEW-11b is a coverage model); real panel size at 1280×800 and stage at 360×780; Playwright/SW/kill behaviour by execution; whether Rolldown cascades hashes the same way into the future warp-protocol chunk (inferred).
