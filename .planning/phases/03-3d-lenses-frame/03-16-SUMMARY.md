---
phase: 03-3d-lenses-frame
plan: 16
subsystem: e2e (accessibility matrix, keyboard path), ui/view (A4 bar thumbnail background)
tags: [UX-02, UX-03, D-29, D-13, D-30, UX-04 carry, lens-critic MAJOR 5, round 2 MINOR 6, T-03-53, A4]
requires: [a11y.spec.js axe loop (02-14), view-place.js (03-06), labels.js ?calloutsoff and labelsInfo() (03-13), compare3d (03-14), bar thumbnail + thumbInfo() (03-15)]
provides: [eight '3D …' axe states at 320×640 and 1280×800, 'D-29 keyboard path through the view', A4 thumb.hide (thumbnail pass without chart and contact shadow), thumbnail pixel check in view.spec.js]
affects: [03-17 (real-phone look at the calmer thumbnail; the D-30 MCP pass is still owed)]
tech-stack:
  added: []
  patterns: [state table entries with setup / wait / check / teardown around the shared axe loop, chunk request held by page.route until both axe runs end, pass-local .visible toggle restored before the main pass]
key-files:
  created: []
  modified:
    - e2e/a11y.spec.js
    - e2e/view.spec.js
    - src/ui/view/scene.js
    - src/ui/view/view.js
    - .planning/phases/03-3d-lenses-frame/03-CONTEXT.md
    - .planning/phases/03-3d-lenses-frame/03-UI-SPEC.md
key-decisions:
  - "03-16 A4 (orchestrator amendment): the bar thumbnail pass hides the eye chart and the contact shadow (.visible, restored before pass 2) and shows the glasses on the plain #f3f4f6 scene background; still 2 passes, no new GPU resources, the main view keeps the chart"
  - "03-16: axe found no violation in any 3D state at 320×640 or 1280×800, so no app change was needed for accessibility (the role=img canvas inside the role=group stage passes as is)"
requirements-completed: [UX-02, UX-03]
metrics:
  duration: ~35 min
  completed: 2026-11-08
  tasks: 1 (+ orchestrator amendment A4)
  files: 6
---

# Phase 3 Plan 16: 3D accessibility matrix, keyboard path, A4 plain thumbnail Summary

Every 3D state (Simple/Expert Glas, Dickenkarte with callouts and forced table-only, comparison Glas and Dickenkarte, no WebGL, loading) passes axe WCAG 2.2 AA with zero violations at 320×640 and 1280×800 and has no horizontal scroll, in both Playwright projects. A keyboard test proves the tab order through the view matches the layout at both widths. Orchestrator amendment A4 removes the eye chart and the contact shadow from the bar thumbnail pass, so the 48×36 px picture shows recognisable glasses on a plain background.

## Read first (lens-critic)

- **A4 also hides the contact shadow, not only the chart (my addition to the orchestrator's decision).** With only the chart hidden, the corner check found 83 % background (412 px) and 82 % (320 px). In the front pose the camera sits slightly above the shadow plane, so the shadow showed as a grey strip along the bottom edge (screenshot looked at). With chart and shadow hidden, all four corners are 100 % background. The shadow is also a backdrop.js object, adds no resources, and is restored the same way.
- **Natural Dickenkarte callout state differs by width** (D-30 script, mobile emulation, DSF 2): 412×915 `calloutsFit` true (6 callouts); 320×640 `calloutsFit` false (table-only note visible). The forced `?calloutsoff` entry therefore matters at 1280. The axe test records `calloutsFit` per viewport in its annotations.
- **The chrome-devtools MCP was not available in this executor session** (as in 03-15). The D-30 keyboard walk, focus-ring screenshots, Dickenkarte screenshots and console check were done with a Playwright script. The MCP pass is still owed.

## A4: plain thumbnail background

- `scene.js`: `setThumb({ …, hide })`. `thumbFrame` sets `.visible = false` on each `hide` object right before the thumbnail pass and restores the previous values right after it, before `copyThumb` and pass 2. The beforeRender hook (chart off-angle rule) has already run, so the restored value is the frame's own.
- `view.js`: `hide: [chart.mesh, shadow.mesh]`.
- The scene clear colour is already `scene.background = #f3f4f6` (= `--surface`, UI-SPEC Color row "Scene background"), so no clear-colour change was needed.
- Recorded as A4 in 03-CONTEXT.md (D-14) and in the 03-UI-SPEC amendments list. The R1-8 thumbnail row now points to A4.

**Evidence (Playwright, `vite preview`, DSF 2, screenshots looked at):**

| Viewport | State | cornerBg (4 × 8×8 blocks, ±6 of #f3f4f6) | darkest luminance (bg 243,9) | nonBackgroundRatio | passesPerThumbFrame |
|---|---|---|---|---|---|
| 412×915 | single | 1,00 | 66 | 0,37 (03-15: 0,97) | 2 |
| 412×915 | A/B split, Vorher / Nachher | 1,00 / 1,00 | 75 / 76 | 0,81 | 2 |
| 320×640 | single | 1,00 | 67 | 0,37 | 2 |
| 320×640 | A/B toggle, Vorher / Nachher | 1,00 / 1,00 | 56 / 57 | 0,76 / 0,75 | 2 |
| 1280×800 | – | no bar, copies 0 | – | – | – |

- Before A4, the same corner measure on the 03-15 screenshot `t15-412x915-thumb.png` was 0,05 (checker), and 0,86 on the A4 screenshot (element screenshot includes the 1 px border and the radius).
- In A/B the thumbnail shows one lens with its rim (the compare box, as in 03-15). It reads as a lens.
- e2e (`view.spec.js`, new `expectPlainThumb`), in 'UX-03 lens view stays visible while editing' (360×780) and 'UX-03 split crop keeps the layout' (412×915): cornerBg ≥ 0,98 and background luminance − darkest > 100. Measured in the test: cornerBg 1, minL 66,6 (single) and 76,4 (split). `passesPerThumbFrame` = 2 and the split test's `memory()` equality (geometries, textures, programs unchanged across thumbnail frames) still pass.
- D-27 `view-memory.spec.js` passes unchanged (21 geometries, 6 textures, 11 programs). It runs at 1280×800, where no thumbnail is made, so the phone-side proof is the split test's `memory()` check.
- Screenshots (session scratch, not published):
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-412x915-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-412x915-thumb.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-412x915-ab-a-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-412x915-ab-b-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-320x640-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-320x640-ab-a-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/t16-320x640-ab-b-bar.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16/montage16.png` (all six bars)

## Accessibility matrix (`e2e/a11y.spec.js`)

Eight new entries in the shared loop, each at 320×640 and 1280×800, in both projects (16 tests): axe tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, plus `scrollWidth ≤ clientWidth` with hyphenation off. Each entry checks its state before axe runs.

| State | Precondition checked before axe | axe 320×640 | axe 1280×800 | Overflow |
|---|---|---|---|---|
| 3D Simple/Glas | `mode()` glass | 0 | 0 | none |
| 3D Expert/Glas | `mode()` glass | 0 | 0 | none |
| 3D Expert/Dickenkarte | `mode()` heat; `calloutsFit` recorded per viewport | 0 | 0 | none |
| 3D Expert/Dickenkarte nur Tabelle (?calloutsoff) | `calloutsFit` false, no callout/dot, `#view-callout-note` visible with the table-only text | 0 | 0 | none |
| 3D Vergleich Glas | glass, `compareInfo().active`, A lens attached | 0 | 0 | none |
| 3D Vergleich Dickenkarte | heat, comparison active | 0 | 0 | none |
| 3D ohne WebGL (?nowebgl) | stage contains 'WebGL 2 fehlt' | 0 | 0 | none |
| 3D wird aufgebaut | view chunk held by `page.route` until both axe runs end: `#view[data-pending=load]`, `#view-slot` visible, status '3D-Ansicht wird aufgebaut …'; released and settled in teardown | 0 | 0 | none |

No axe violation in any state, so no app fix was needed. The focusable `role=group` stage containing the `role=img` canvas passes as is; nothing was moved and `role="application"` was not used.

## Keyboard path ('D-29 keyboard path through the view')

Start: `.col-results` focused, then Tab. Observed order (test annotations; same in the D-30 script):

- **1280×800, desktop project:** `#view-stage → Vorne → Seite → Oben → Ansicht zurücksetzen → tip:tip-et` (the first focusable of `#result-od-card`). D-13: the stage comes before the cards and nothing of section#result comes before the stage.
- **1280×800, mobile project (touch, `any-pointer: coarse`):** `… → Ansicht zurücksetzen → #view-rotate → tip:tip-et`.
- **320×640, desktop project:** `tip:tip-et → tip:tip-ct → #disclaimer-jump → #view-stage → Vorne → Seite → Oben → Ansicht zurücksetzen → summary`. 03-06/MAJOR 5: the stage comes right after the last focusable of section#result (`#disclaimer-jump`).
- **320×640, mobile project:** the same, with `#view-rotate` after 'Ansicht zurücksetzen'.
- On a fine pointer the test asserts that `#view-rotate` is not the next stop.
- Every stop from the stage on matches `:focus-visible`, and its computed outline width is ≥ 3 px (stage 3 px accent inset, buttons 3 px `--focus`).
- D-30 screenshots of the focus ring on the stage and on each preset (looked at: a visible ring on each):
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16kb/kb-1280-00-view-stage.png` … `kb-1280-04-preset-reset.png` (same folder)
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16kb/kb-320-03-view-stage.png` … `kb-320-07-preset-reset.png` (same folder)
- Dickenkarte (D-30): `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16kb/heat-412x915.png` (6 callouts, no overlap, scrollWidth 412) and `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots16kb/heat-320x640.png` (table-only note, scrollWidth 320).
- Console at 1280, 320 and 412 (Playwright `console` events, GL driver performance notes filtered as in helpers.js): empty.

## Verification

### Gates (one after the other, final code 0cc4b00)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 46 files, **1786 tests passed** (unchanged, no engine change). All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 417ms`, view chunk 637,84 kB (gzip 167,97 kB), was 637,72 kB |
| port 4173 before e2e | `000` |
| `npm run test:e2e` | **544 passed, 30 skipped, 0 failed, 0 flaky (15.3 m), exit 0** (03-15: 526 passed / 30 skipped in 14.0 m; +16 axe states, +2 keyboard tests). `layout.spec.js:302` passed in this run |

`npx playwright test e2e/a11y.spec.js` alone: 32 passed (3.0 m).

### Acceptance greps

- `grep -c "'3D " e2e/a11y.spec.js`: 12 (≥ 8; the 8 state keys plus the mode/compare checks and the timeout line).
- `grep -c "calloutsoff" e2e/a11y.spec.js`: 3 (≥ 1).

## Requirements

- **UX-02: stays Complete.** The Expert Dickenkarte states (with callouts, forced table-only, in comparison) pass axe at both widths.
- **UX-03: stays Complete.** The 03-15 UX-03 tests pass with the added A4 pixel check, and the thumbnail is now clearly recognisable (A4).
- **VIZ-06:** unchanged, Pending until 03-17.

## Deviations from Plan

1. **[Orchestrator amendment A4] Plain thumbnail background.** This is not in the plan's `files_modified` (scene.js, view.js, view.spec.js, 03-CONTEXT.md, 03-UI-SPEC.md). It was done as its own commit before the a11y work (d0cb0b6).
2. **[Rule 2, within A4] The contact shadow is hidden too**, not only the chart. Reason: the corner check failed (0,83) because the shadow strip was visible (see Read first).
3. **The axe loop gained per-state `wait` / `check` / `teardown` hooks.** The existing four states are wrapped unchanged. The 3D states wait for `settledView` after each viewport change, and the 3D tests have a 120 s timeout (SwiftShader).
4. **`calloutsFit` is recorded at both widths**, not only at 320.

No axe fix was needed, and index.html is unchanged.

## Open items (lens-critic, 03-17)

- The chrome-devtools MCP pass is still owed (console, keyboard walk, heap). Playwright stood in for it here.
- A real-phone look at the calmer thumbnail (iPhone and Pixel). The GPU-sync cost per thumbnail frame from 03-15 is unchanged by A4 (same 2 passes).
- In A/B the bar label shows the 'Vorher (A):' prefix for A but no prefix for B (03-15 behaviour, seen in the A4 screenshots). This is not changed here. It is a UI-SPEC question whether 'Nachher (B):' should appear.
- `layout.spec.js:302` is still known to be timing-flaky (it passed this run).

## Known Stubs

None.

## Threat Flags

None. A4 only toggles `.visible` on existing scene objects during one pass. The a11y work changes tests only.

## Commits

- d0cb0b6 feat(03-16): A4 bar thumbnail on the plain background, without chart and shadow
- 0cc4b00 test(03-16): axe matrix for every 3D state at 320 and 1280, keyboard path through the view

## Self-Check: PASSED

- Files exist: e2e/a11y.spec.js, e2e/view.spec.js, src/ui/view/scene.js, src/ui/view/view.js.
- Commits exist: d0cb0b6, 0cc4b00.
