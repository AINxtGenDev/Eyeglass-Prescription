---
phase: 04-refraction-view-offline
plan: 11
subsystem: ui/view (Durchblick A/B comparison, leak test)
tags: [REF-01, D-11a, D-14, D-27, item-16, item-26, NEW-7, e2e, test-hook]
requires: [04-08 Durchblick lane, 04-09 panels/states/stage visibility, 04-10 guard + gated hook, 03-14 compareEye + inputs.compare]
provides: [A/B Durchblick (compared eye, panels A|B, #cmp-show below 360 px), A/B size block with abNote, per-panel pills, gated ?refguardoff, guardPage search option, Durchblick leak test with one-context check]
affects: [04-12 fullscreen (pills now keyed by panel id), 04-13 result review (a11y A/B state, buffer-pool note)]
tech-stack:
  added: []
  patterns: [panel source per id (sourceOf) with a 'pending' state that keeps the last picture, every posted warp job consumes its input t0]
key-files:
  created: []
  modified: [src/ui/view/ref-mode.js, src/ui/view/ref-layout.js, src/ui/view/ref-layout.test.js, src/ui/view/refraction.js, e2e/view-ref.spec.js, e2e/view-memory.spec.js, e2e/helpers.js, test/dist/hooks.test.js, test/ci/env-gates.test.js]
decisions:
  - "PD is shared Rx (pipeline.js builds A from the current spec with A's frame and material), so NEW-7 runs A = item-12 rechteckig box and B = default frame both at PD 40; PD 32 gives 0 qualifying points for every shape"
  - "Single A/B panel below 360 px keeps view.ref.side.one and aria layout 'one'; the compare strings name 'links … rechts', which only fits two panels (flag for lens-critic)"
  - "Configuration A computing: panel A keeps its last picture; without one it shows view.ref.loading as its centred pill; A's size line is omitted"
  - "Every posted warp job consumes its input t0 (not only 'input' jobs): A arriving after a comparison start must not become a counted guard sample from an old t0"
  - "?refguardoff lives inside the existing ref-mode.js MODE gate, so ALLOW_ENV needs no new expression"
metrics:
  duration: ~60 min
  completed: 2026-11-13
  tasks: 2
---

# Phase 4 Plan 11: A/B Durchblick and the mode-switch leak test Summary

During a comparison ("Variante vergleichen"), the Durchblick now shows only the compared eye. On a stage of 360 px or more it shows two panels, Vorher (A) on the left and Nachher (B) on the right, at the same scale. Below 360 px it shows one panel, which follows `#cmp-show`. Each panel is traced from its own configuration. The size block lists A, then B, and always shows `view.ref.abNote`. A leak test with 57 changes shows that the Durchblick adds no GPU resources and never opens a second WebGL context.

## Most likely to bite

1. **The A/B labels were doubled; found only in the screenshots, now fixed (236cfe8).** Suppose a comparison is started in Glas and the user then switches to the Durchblick. compare3d's 3D captions "Vorher (A)" / "Nachher (B)" stayed laid out over the stage, so every panel showed its label twice. At 320 px with Vorher shown, a stale "Nachher (B)" caption was left over.
   - Cause: view.js afterRender in Durchblick hid the 3D eye labels but not the compare captions or their divider div.
   - Fix: `compare3d.hideOverlay()` in that branch.
   - Test: the NEW-7 test now asserts 0 visible captions, 0 visible 3D dividers and exactly the pills `['Vorher (A)', 'Nachher (B)']`. Before the fix it failed with 2 visible captions.
   - item 26 alone could not catch this, because it starts the comparison inside the Durchblick.
   - compare3d.js is not in the plan's file list. The change is 7 lines.
2. **PD is part of the shared Rx.** `pipeline.js` builds A from the current spec and replaces only the frame and material. So NEW-7 cannot give A PD 40 and B PD 32, as the plan text implied. Both run at PD 40. In Node, PD 32 gives 0 qualifying points for every shape, so the item-12 box only works with PD 40.
3. **Buffer-pool counter.** In the leak test the page mesh buffer pool went from 10 to 12 allocations (CPU, not GPU; not asserted). Details are in deferred-items.md and should be checked in 04-13.

## What was built

**Orchestrator fix (4fc19c5): `?refguardoff`**
- Placed inside the existing `import.meta.env.MODE !== 'production'` block in ref-mode.js, next to `refdegraded`.
- Counted samples still go through `nextGuard`, but the run is reset instead of stepping, as `?thumbguardoff` does.
- The handle `ref().guardOff` reports the flag.
- `guardPage` gains `search` (a string, or a function of TestInfo).
- view-ref.spec.js loads every test with `?refguardoff`, except the `REF-02 degradation (04-10)` describe, which keeps the real guard. That describe asserts `guardOff` false, and a new test asserts true elsewhere. The item-13 and item-14 tests that call `page.goto` themselves also got the flag.
- `test/dist/hooks.test.js`: `refguardoff` is absent from dist/ and present in `dist-e2e/assets/view-*.js`.
- ALLOW_ENV needs no new expression (same gate line); a comment explains this.

**Task 1 (cb1053f): A/B Durchblick**
- ref-mode.js, compared eye: `compareOf(inputs)` computes the eye with `compareEye` over `thickest(metrics)` of A and B, exactly as view.js does.
- ref-mode.js, panel sources: `sourceOf(panel)` gives A's own `surfaces` plus `specA[eye].frame`, B's current result, `'pending'` while A computes, or `null` (the "nicht berechnet" fill).
- ref-mode.js, A pending: panel A keeps its last picture and rim flags. Without a picture it shows `view.ref.loading` as its centred pill, and A's size line is left out.
- ref-mode.js, layout signature: starting or ending the comparison, a new compared eye or `#cmp-show` (eye + shown variant) re-runs the layout. `#view-ref-eye` is hidden in comparison mode.
- ref-mode.js, text: the side text is `view.ref.side.compare` and the aria layout is `'compare'`, both for two A/B panels only.
- ref-mode.js, guard (Rule 1): every posted warp job now consumes its input t0. Before, a job posted on entry, relayout or comparison start did not record its t0. A delivery of A arriving later for the same input would then have been counted as a guard sample measured from an old t0, which risks a false step-down.
- ref-layout.js: `panelLayout({ compare, shown })`. Below 360 px the single panel is 'A' or 'B'. Above that, both panels have the same width, so the same pxPerTan. 3 new unit tests.
- refraction.js: pills are created per panel id ('L', 'R', 'A', 'B'; A/B read `view.ref.who.a`/`.b`). Each centred pill gets its text per panel. New `hasPicture(id)`.
- view.js: no wiring was needed for the A/B data (`refMode.update` already receives `inputs.compare`). The only view.js change is the caption fix above.

**Task 2 (9a71cdd): leak test.** `e2e/view-memory.spec.js` 'Durchblick mode switches do not leak (D-14, item 16)', desktop project.
- An init script wraps `HTMLCanvasElement.prototype.getContext` and collects distinct WebGL contexts.
- Warm-up: the 03-15 warm-up plus one pass through every Durchblick state.
- The 57-change sequence:
  - Glas → Durchblick → Dickenkarte → Glas
  - Mit ↔ Ohne Glas
  - 1280 ↔ 340 px, i.e. two ↔ one panel
  - comparison start and end, material and `#cmp-show` inside the Durchblick
  - Rx edits in every mode
- `EXPECTED_REF` is derived in the 03-15 style rather than copied from a run:
  - G = 21 + 4 meshes per drawn panel × 2 + divider = 30
  - T = 6 + chart texture = 7
- No dispose fix was needed in refraction.js.

## Measured values

| Measurement | Value |
|---|---|
| NEW-7 panel (handle, 1280 × 800, desktop) | A and B 270 × 338,75 at 293,37 px/tan, tier fein |
| NEW-7 qualifying points (Node, 4 px lattice, class 2/4 for A and 1 for B, ≥ cellPx + 2 from a boundary) | 12 (scratch run with a slightly different pixel mapping: 10); B rim lattice points 0; replies `{A: rimInField true, B: false}` |
| NEW-7 on screen | qualifying points in rim colour: **left 12 / 12, right 0 / 12**; whole-panel 4 px lattice (5695 points each): **left 151, right 0** rim pixels |
| Shape lever (Node, PD 40) | rechteckig 10, rund 571, panto 331 points; PD 32: 0 for all three |
| Leak test (item 16) | 57 changes; geometries 30 → 30, textures 7 → 7, programs 14 → 14; **1 WebGL context**; page buffer allocations 10 → 12, worker 0 → 0 |
| A/B size lines, −4,00 both eyes, A CR-39, B 1,74 | both "Bild etwa 6 % kleiner" (UI-SPEC MINOR 7: −5,604 % vs −5,631 %), so abNote carries the message |
| 04-10 guard test under load (same batch) | counted samples 363, 337 (held), 149, 79 ms (free) → fein → mittel only, as designed |

## Visual pass (Playwright, dist-e2e, `?refguardoff`; the chrome-devtools MCP pass is the orchestrator's after the merge)

Screenshots: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-11-shots/`. Script: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-11-shots.mjs`. Setup: −4,00 both eyes, PD 32, B = 1,74.

- **1280 × 800:**
  - Two panels, each 270 × 338,75, with a 2 px divider.
  - The pills "Vorher (A)" and "Nachher (B)" sit at the bottom centre. The squares look the same in both panels (same scale, nearly the same picture, as MINOR 7 predicts).
  - Side text: "Sie schauen selbst durch Ihr rechtes Glas: links Vorher (A), rechts Nachher (B), gleicher Maßstab."
  - The size block shows both lines and then abNote.
  - axe: 0 violations. scrollWidth is 1280.
- **412 × 915 (DPR 2):** two panels 189 × 285, the same texts, axe 0 violations, scrollWidth 412.
- **320 × 640 (DPR 2):**
  - One panel 288 × 216, pill "Nachher (B)". With `#cmp-show` = Vorher it switches to panel A, pill "Vorher (A)", same size and pxPerTan.
  - No picker. Side text is the one-panel sentence.
  - axe 0 violations. scrollWidth is 320.
- **Before the caption fix**, all three sizes showed duplicate top captions (see "Most likely to bite"). After the fix, the re-shot images show only the bottom Durchblick pills. The full-page 320 px images show the fixed summary bar over "Bild". This is the known capture artifact of the fixed `#summary-bar` in full-page screenshots, not an overlap on the device.
- Console: only the Playwright service-worker block notice and Chromium "GPU stall due to ReadPixels" driver notes.

## Verification

| Command | Result |
|---|---|
| `npm run lint` | clean |
| `npm run test:coverage` | 59 files, 2137/2137; all files 99,25 % lines |
| `npm run build && npm run build:e2e` | ok; precache 953,79 / 956,88 KiB |
| `npm run test:dist` | 21 passed, 1 skipped (`refguardoff` absent from dist/, present in dist-e2e) |
| `npx vitest run src/ui/view/ref-layout.test.js` | 31/31 |
| `npx playwright test e2e/view-ref.spec.js e2e/view-compare.spec.js e2e/view.spec.js e2e/a11y.spec.js` (before the caption fix) | **153 passed, 37 skipped, 0 failed** (11,1 min) |
| `npx playwright test e2e/view-memory.spec.js` | 2 passed, 2 skipped (D-27 unchanged + the new leak test) |
| NEW-7 against the pre-fix build with the new caption assertion | failed (Received: 2): RED confirmed |
| after the fix: `-g "NEW-7\|item 26\|RES-03\|caption\|A/B"` over view-ref + view-compare | 11 passed, 7 skipped |
| after the fix: `npx playwright test e2e/view-compare.spec.js e2e/view-memory.spec.js` | 15 passed, 15 skipped (leak test again 57 changes, 30/7/14 equal, 1 context) |
| after the fix: re-shot at 320 / 412 / 1280 | visible pills exactly `['Nachher (B)']` → `['Vorher (A)']` (320), `['Vorher (A)', 'Nachher (B)']` (412, 1280); no 3D caption; axe 0 at all three; no horizontal overflow |
| `npm run test:e2e:live` (guardPage changed; live specs use it) | 323 passed, 1 skipped |

The M3 literals and tests are unchanged and pass in the batch. `grep -c "uv arrays differ" e2e/view-ref.spec.js` = 0. `grep -c "compareEye(" src/ui/view/ref-mode.js` = 1.

## Deviations from Plan

1. **[Rule 3] Worktree base reset.** HEAD was 47bb4e2. I ran `git reset --hard b6f311e` before any commit of mine. node_modules is a symlink and is not committed.
2. **[Orchestrator task] `?refguardoff`** was committed separately (4fc19c5). `e2e/helpers.js` (`guardPage` search) was touched for it.
3. **[Plan premise corrected] PD is shared.** NEW-7 runs A and B at PD 40. B is the default frame 52 × 38 / 18 with CR-39, but not PD 32 (see above).
4. **[Interpretation, flag for lens-critic] One A/B panel below 360 px** uses `view.ref.side.one` and aria `'one'`. The compare strings say "links … rechts". The pill and `#cmp-show` name the variant. The must-have's literal reading ("in comparison mode … side.compare") is applied to the two-panel form only.
5. **[Interpretation] A computing:** panel A keeps its last picture; without one it shows `view.ref.loading` as its centred pill (no new copy key). The plan says "first-picture status (no chart)".
6. **[Rule 1] Guard t0 consumption** for non-input jobs (see Task 1).
7. **[Rule 1] Duplicate 3D captions over the A/B Durchblick:** fixed in compare3d.js and view.js (236cfe8).
8. **Item 26** runs on both projects (desktop: two panels; mobile 360 × 780: one panel and the toggle), plus a 320 × 640 desktop-project variant.
9. **Leak snapshot timing:** the snapshot is taken after a documented warm-up that enters the Durchblick, not "after the first settled view". The refraction pass and its chart texture are created on the first entry and kept for the session by design (04-08). Its derivation is asserted as `EXPECTED_REF`, which plan step 2 allows.
10. **MCP pass** was not done here (Playwright screenshots only). Per the orchestrator, the chrome-devtools MCP pass follows the merge.

## Known Stubs

None.

## Threat Flags

None beyond the register:
- T-04-43: A and B are traced from their own sources; the NEW-7 pixel test catches swapped or copied panels.
- T-04-44: the leak test plus the one-context assertion.
- The new test hook is behind the same MODE gate and is covered by hooks.test.js.

## Commits

- 4fc19c5 fix(04-11): test-only ?refguardoff so ordinary Durchblick e2e cannot step down on slow runners
- cb1053f feat(04-11): A/B Durchblick for the compared eye (D-11a, item 26, NEW-7)
- 9a71cdd test(04-11): Durchblick mode-switch leak test, one WebGL context (D-14, D-27, item 16)
- 236cfe8 fix(04-11): hide the 3D A/B captions and divider over the Durchblick

## Self-Check: PASSED

All modified files exist. Commits 4fc19c5, cb1053f, 9a71cdd and 236cfe8 are in `git log`. Both preview servers I started were killed and confirmed stopped (the script prints "preview stopped"). No background process of this run is left.
