---
phase: 03-3d-lenses-frame
plan: 13
subsystem: ui/view (Dickenkarte on-lens callouts, iso labels, eye picker)
tags: [VIZ-05, UX-02, D-22, lens-critic MAJOR 4, round 2 MINOR 5, round 2 MINOR 6, T-03-34, T-03-35, T-03-36]
requires: [engine/mesh/heat.js heatCallouts + isoLabelPoints (03-03), engine/design.js frontSagAt, view.js heat state + pickedEye (03-12), legend.js table cells data-row/data-col (03-12), controls.js goTo('heat', eye) (03-12)]
provides: [src/ui/view/label-layout.js layoutLabels + LABEL_GAP_PX, labels.js initHeatLabels / setHeatLabels / clearHeatLabels / layoutHeatLabels / setLabelAvoid / settleNote / calloutsFit, controls onSettle, camera-math HEAT_FIT_MARGIN, #view-heat-eye picker, #view-callout-note, ?calloutsoff, debug handle labelsInfo()]
affects: [03-14 (A/B heat: the picker is hidden in A/B and the callout eye is the compared eye), 03-15 (thumbnail settle signal = controls onSettle), 03-16 (axe matrix uses ?calloutsoff)]
tech-stack:
  added: []
  patterns: [pure all-or-nothing label layout with priorities, per-render projection with text-change-only measuring, live-region text written only at settle points]
key-files:
  created:
    - src/ui/view/label-layout.js
    - src/ui/view/label-layout.test.js
  modified:
    - src/ui/view/labels.js
    - src/ui/view/view.js
    - src/ui/view/controls.js
    - src/ui/view/camera-math.js
    - src/ui/view/camera-math.test.js
    - index.html
    - src/ui/style.css
    - src/i18n/de-AT.js
    - e2e/view-heat.spec.js
decisions:
  - "03-13: Dickenkarte fit margin HEAT_FIT_MARGIN = 1,3 (was the shared 1,08): design value, no optical meaning. With 1,08 the rim touched the stage edges and 412 px fell back to table-only; 1,3 fits all callouts at 360 and 412 px. 320 px stays table-only (1,4 did not help: the OD thickest point sits under the badge corner), so the larger map (3,61 px/mm) was kept"
  - "03-13: labels avoid the badge and, while #view-stage has :focus-visible, the keyboard hint. The hint covers the lower quarter of the stage, so with keyboard focus the rule gives table-only at every width (see Read first)"
  - "03-13: #view-callout-note stays in the DOM as role=status and is shown by text ('' while the callouts fit, :empty hides it) instead of toggling [hidden]: a live region must exist before its text changes to be announced"
  - "03-13: callout order Mitte, innen, außen, oben, unten, dickste; the marker dots of all callouts are reserved before any pill, so no pill covers a marker"
metrics:
  duration: ~45 min
  completed: 2026-11-08
  tasks: 2
  files: 11
---

# Phase 3 Plan 13: On-lens callouts, iso labels and eye picker Summary

In Dickenkarte the selected eye now carries the engine thicknesses on the lens itself: Mitte, innen, außen, oben, unten and, when it is more than 10° away from those, a separate "dickste" pill. The iso lines carry their value where they cross the temporal half-chord, when there is room. "Zahlen am Glas für: Rechtes Glas | Linkes Glas" moves the numbers and the camera to that eye. Labels never overlap and are never shrunk. When not every callout fits, none is shown and a note points to the table.

## Read first (lens-critic)

- **Keyboard focus gives table-only.** Labels must not cover the keyboard hint (orchestrator rule). The hint overlays the lower ≈ 70 px of the stage while it has `:focus-visible`, and the inferior callout sits there. So during keyboard use the all-or-nothing rule hides every callout at 412 px **and** at 1280 px, and the note shows. Mouse and touch users are not affected (a mouse focus shows no hint). The table always holds the numbers. A design change (for example a hint that fades after a few seconds, or a hint placed below the stage in Dickenkarte) would fix it; that is out of this plan's scope. Measured: `h13-keys-412.png` and the e2e annotation "after orbit: table-only" at 1280.
- **320×640: table-only (pass by the plan's rule).** Both eyes: 0 callouts, the note is visible, 2 iso labels ("2,0", "3,0") and the eye label are shown. At 360×780 (mobile project), 412×915 and 1280×800 all 6 callouts show for both eyes, with no overlap.
- **Iso labels are sparse on phones.** They sit on the temporal half-chord (engine `isoLabelPoints`, UI-SPEC), where the temporal callout and the iso lines crowd. By the priority rule most of them are dropped (their values stay on the legend ticks): 2 of 6 at 1280 (OD: "2,0", "3,0"), 1 at 360 ("2,0"), 1 at 412, 2 at 320 (no callouts there). If lens-critic reads "labelled iso-lines" as "every line labelled", trying the other half-chords for a dropped label would need an engine change to `isoLabelPoints`.
- **Fit margin deviation.** The heat pose moved from 1,08 to 1,3 (see decisions). Scale now: 4,16 px/mm at 1280 (400 px stage), 4,77 at 412, 4,11 at 360 and 3,61 at 320 (03-12: 4,35 at 320; the ≥ 3 px/mm e2e floor still holds).
- **VIZ-05 and UX-02 are marked Complete** (orchestrator note): mm legend (03-12), labelled iso lines (above), numeric callouts at nasal/temporal/superior/inferior and centre on the lens, equal to the table and the engine (e2e). The two caveats above are flagged, not hidden. Re-open if you read them as a miss.

## What was built

- **`label-layout.js`** (pure, no imports, `grep -cE "document|window|from "` = 0). `layoutLabels(items, bounds)` → `{ placed, calloutsFit }`.
  - Callouts first, in order. All their 8 px marker dots are reserved first; a dot outside the stage or on an avoid box means no fit.
  - Each pill tries five boxes: outward (along OC → anchor), below, above, left, right of the anchor, 8 px gap. The first box inside the stage that overlaps nothing placed wins.
  - Any callout without a box → `calloutsFit` false and no callout at all (MAJOR 4).
  - Eye labels (priority 1), then iso labels (priority 2): clamped inside the stage, dropped if they overlap anything placed or an avoid box.
  - Tests (9): candidate order, the six-callout fit at the 320 framing (288×216, lens 226×165) and the no-fit at the old 73×53 lens, later callouts avoiding earlier ones and dots, drop by priority, clamping, non-finite anchors, no callouts, and a fast-check property (300 runs, seed 1303): deterministic, no two visible boxes overlap, all inside, avoid box free, all-or-nothing.
  - Cost: 3,3 µs per call in Node for 6 callouts + 2 eye labels + 8 iso labels (scratch `lbench.mjs`).
- **`labels.js`.**
  - One fixed pool made once: 6 pills + 6 dots + 8 iso labels (plus the 2 eye labels = 22 nodes in `#view-labels`, flat across switches).
  - `setHeatLabels` (text-change path): texts are `fmtMm(heatCallouts value)`, the merge target gets `{mm} · dickste`, a separate `dickste {mm}` only when `merge === null && where === 'edge'`. Iso texts are `fmtIsoValue(level)`, positions from `isoLabelPoints(...)`. Anchors are lens-local engine points with `z = −frontSagAt` (position only).
  - `layoutHeatLabels` (every render): projects the anchors through the lens group's position (DBL and the frame's z), builds the outward offset from the projected OC (Mitte below-right), runs `layoutLabels` with the eye labels, writes CSSOM transforms and `hidden` only where they change.
  - Sizes are measured with `offsetWidth/offsetHeight` in `sizeOf()` only when the text differs from the cached text (or the cached width is 0 because the element was not laid out yet). Never per frame for an unchanged text.
  - `settleNote()` is the only writer of the note. Quoted (`grep -n "view-callout-note\|heat.note" src/ui/view/labels.js`): line 122 is the JSDoc of `initHeatLabels(container, note)`, line 272 the `settleNote` comment, and the one write is line 280 inside `settleNote`: `if (heat.note.textContent !== text) heat.note.textContent = text;`.
  - `?calloutsoff` (line 84, read once): the callouts are left out of the layout and `calloutsFit` is false. Presentation only.
- **`controls.js` `onSettle(inRender)`.** Called at the OrbitControls 'end' (with damping: on the first `update()` after 'end' that reports no motion, with one render requested after 'end' so that check runs), at the tween's last step, at a cut (`goTo` under reduced motion), after a keyboard step, and when '3D drehen' turns off mid-gesture. **Key path:** the r187 OrbitControls key listener is not used (`listenToKeyEvents` is never called; the stage has its own keydown handler, 03-09). That handler applies the step at once (`flush()`, then `place()`), so no damping follows and it calls `onSettle` itself. r187 dispatches 'start'/'end' only from pointer and wheel handlers (`OrbitControls.js` lines 1628, 1745, 1789, 1793, 1893); `onKeyDown` (line 1797) dispatches neither.
- **`view.js`.**
  - `requestSettle(inRender)` sets a flag that the next afterRender runs after the layout. Callers: `onSettle`, picker change, entering and leaving Dickenkarte, a new heat paint (text change), resize, and a change of the avoid boxes.
  - Avoid boxes = the badge (offset box) and the keyboard hint while `#view-stage:focus-visible`. Measured on badge text change, stage focus/blur/keydown and resize, and applied only if they changed (a mouse focus during a drag is no settle point).
  - Picker: `#view-heat-eye` radios with the check icon; the default is the 03-12 heat eye; a change sets `pickedEye`, re-labels and calls `goTo('heat', eye)`. A not-drawn eye's radio is disabled. Leaving Dickenkarte clears the heat labels, hides the picker and settles the note to ''.
  - Debug: `labelsInfo()` → `{ labels: [{ kind, key, text, rect }], calloutsFit }`.
- **`index.html` / `style.css` / `de-AT.js`.** `fieldset#view-heat-eye.segmented hidden` and `p#view-callout-note.small role="status"` after `#view-legend`; `.view-dot` (8 px, 2 px white ring, 4 px `--fg` fill), `.view-label--iso` weight 400, `[hidden]` override for the picker, `#view-callout-note:empty { display: none }`. Strings `view.callout.thickest`, `view.callout.thickestSuffix`, `view.callout.tableOnly`.

## Verification (run one after the other)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 46 files, **1778 tests passed** (03-12: 1769, +9). All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines (engine scope, unchanged) |
| `npm run build` | `✓ built in 411ms`. View chunk 622,59 kB (gzip 162,33 kB), up from 615,43 kB |
| port 4173 before e2e | `000` |
| `npm run test:e2e` | **502 passed, 12 skipped (10.4 m), exit 0**, no flaky tests (03-12: 486 passed / 10 skipped; +16 passed, +2 project skips) |

Targeted run before the full gate (`e2e/view-heat.spec.js` + `e2e/view-controls.spec.js`): 65 passed, 11 skipped (project-specific skips), 0 failed, 0 flaky.

New e2e tests (`e2e/view-heat.spec.js`, reduced motion):

- **Callouts equal table** (both projects): `calloutsFit` true, 6 callouts in the order Mitte, innen, außen, oben, unten (+ dickste), each number equal to its `#view-heat-table` cell of the heat eye, "dickste" equal to the thickest row, one dot per callout, the picker on the heat eye, no note.
- **Eye picker:** Linkes Glas → `heatScale().eye` OS, camera target within 0,5 mm of the OS eyeBox centre, callouts equal the OS column, the table text unchanged.
- **Callouts fit on phones (MAJOR 4)** (mobile 360×780): all 6, no overlap, all inside the stage, none on the badge.
- **No overlap or table-only** at 1280×800 and 320×640, both projects: no two label rects intersect, all inside `#view-stage`, none on the badge or the shown keyboard hint, `scrollWidth <= clientWidth`, note shown iff `!calloutsFit`. After focus + ArrowRight ×2 the rects changed and the same rule holds. Annotations: 1280 "all 6 callouts; 2 iso labels | after orbit: table-only" (keyboard hint, see Read first); 320 "table-only note, 0 callouts; 2 iso labels | after orbit: table-only".
- **Iso labels:** every visible iso text is a legend tick; desktop shows ≥ 1 (OD: "2,0 3,0"; mobile "2,0").
- **Note only at settle (MINOR 5)** (desktop project at 320×640): MutationObserver on the note; a 30-step mouse drag over ≈ 1 s plus a hold → **0 mutations** while the button is down; after mouse up ≤ 1 (measured 0, the value did not change) and `noteVisible === !calloutsFit`.
- **?calloutsoff (MINOR 6)** at 1280×800: `calloutsFit` false, 0 callouts and 0 dots, the note visible with the MAJOR 4 text and `role=status`, every table cell still a number.
- **No leak over Glas ↔ Dickenkarte and eye switches:** warm-up, then 3 × (Dickenkarte, Linkes Glas, Rechtes Glas, Glas): `{ geometries 16, textures 6, programs 11 }, 22 label nodes` → identical. Glas shows only eye labels afterwards.

### Layout and screenshots (Playwright against `vite preview` on port 4191, looked at)

| Viewport | Stage | Callouts (OD / OS) | Iso labels (OD) | scrollWidth / innerWidth | Picker segments |
|---|---|---|---|---|---|
| 1280×800 | 400×251 | 6 / 6, no overlap | 2,0 · 3,0 | 1280 / 1280 | 201×48, 199×48 |
| 412×915 | 382×287 | 6 / 6, no overlap | 2,0 | 412 / 412 | 191×48, 189×48 |
| 360×780 | 330×248 | 6 / 6, no overlap | none | 360 / 360 | – |
| 320×640 | 290×218 | 0 / 0, note shown | 2,0 · 3,0 | 320 / 320 | 145×52, 143×52 ("Rechtes Glas" wraps to 2 lines) |

- **Contrast** (computed in the page): every callout and iso pill `#1a1a1a` on `#fff` = 17,40:1, 14 px (600 callouts, 400 iso). The note `rgb(26,26,26)` on `rgb(255,255,255)` = 17,4:1, 14 px.
- **Orbit 30° (mouse drag, azimuth 0 → −30,4° at 1280, −30,3° at 412):** all 6 callouts stay on, follow the lens, and the iso labels "2,0", "3,0" both show. `h13-orbit30-412.png` shows the pills at the projected points, no overlap.
- **Console:** no app messages (only the whitelisted GL driver notes are filtered out).
- **Frame times, 4× CPU throttle, 3 s mouse orbit at 1280×800 (SwiftShader software GL):** Dickenkarte median 149,9 ms, p95 183,3 ms (27 frames); Glas median 833,4 ms, p95 900,0 ms; unthrottled Dickenkarte median 116,8 ms. These are GPU-emulation bound and say nothing about the 16,7 ms budget on a real phone. The label work itself is ≈ 3 µs of layout plus ≤ 22 transform writes per frame. A real-device trace is still owed.
- **chrome-devtools MCP was not available in this executor session.** The D-30 checks were done with Playwright scripts. The MCP pass (memory: test-with-chrome-devtools-mcp) is still owed.
- **Screenshots** (session scratch, not published):
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-1280x800-OD-stage.png`, `…-OS-stage.png`, `…-OD-page.png`, `…-OS-page.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-412x915-OD-stage.png`, `…-OS-stage.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-360x780-OD-stage.png`, `…-OS-stage.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-320x640-OD-page.png`, `…-OS-page.png`, `h13-picker-320.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-orbit30-1280.png`, `h13-orbit30-412.png`
  - `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots13/h13-keys-1280.png`, `h13-keys-412.png`

## Deviations from Plan

1. **[Rule 3 - Blocking] Heat-pose fit margin 1,08 → 1,3** (`HEAT_FIT_MARGIN` in camera-math.js, `fitBoxDistance` gained an optional `margin`; camera-math.test.js asserts the new heat distance). Without it 412×915 and 360×780 were table-only (the plan's MAJOR 4 pass/fail needs all callouts at 360). In scope per the orchestrator note. Commit 6c78eb3.
2. **[Rule 2 - a11y] `#view-callout-note` is not toggled with `[hidden]`.** It is a permanent `role=status` region whose text is '' or the MAJOR 4 sentence; CSS `:empty` hides it. A live region that appears through `[hidden]` is not reliably announced. The e2e checks visibility (`isVisible`) instead of `.hidden`, and `settleNote` still writes only on a change. Commit 6c78eb3.
3. **[Rule 2] Avoid boxes.** `layoutLabels` takes `bounds.avoid` (the badge, and the keyboard hint while shown), per the orchestrator rule that callouts must not collide with them. Not in the plan's signature. Consequence: keyboard focus gives table-only (Read first).
4. **[Rule 2] Marker dots are reserved before the pills** and must lie inside the stage, so no pill covers another callout's marker and no marker is clipped.
5. **`setHeatLabels` takes the lens `group`** instead of `groupX`: the group's position is read each render, so a DBL change or the frame's z (lens-critic MINOR 9) moves the labels with the mesh.
6. **e2e:** the `?calloutsoff` test settles the first page before navigating (otherwise the aborted engine-worker load fails `guardPage`), as `?failframe` / `?cmpdelay` do. An extra leak test covers the label node count over Glas ↔ Dickenkarte and eye switches.

## Open items

- Keyboard-focus table-only (Read first): needs a UI-SPEC decision on the hint placement in Dickenkarte.
- Sparse iso labels on phones (Read first): possible engine follow-up (`isoLabelPoints` alternatives per value).
- Leaving Dickenkarte keeps the camera on the single-lens pose (03-12 open item, unchanged).
- The live chrome-devtools MCP pass and a real-device 4× orbit trace in Dickenkarte.
- VIZ-06 stays Pending.

## Known Stubs

None.

## Threat Flags

None. No new network, storage or markup sinks: texts via `textContent`, positions via CSSOM `style.transform`, `data-key` via `dataset` (T-03-35). The test flag `?calloutsoff` changes presentation only.

## Self-Check

## Self-Check: PASSED

- Files exist: src/ui/view/label-layout.js, src/ui/view/label-layout.test.js.
- Commits exist: eb9f349 (test RED), 8a71d12 (feat GREEN), 6c78eb3 (feat Task 2).

## TDD Gate Compliance

Task 1 RED `test(03-13)` eb9f349 failed first (module missing, no tests ran). GREEN `feat(03-13)` 8a71d12 passed 9 tests. No refactor commit.
