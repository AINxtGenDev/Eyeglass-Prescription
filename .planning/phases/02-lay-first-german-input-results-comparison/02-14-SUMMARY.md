---
phase: 02-lay-first-german-input-results-comparison
plan: 14
subsystem: accessibility + layout + perf record
tags: [UX-01, UX-03, UX-04, ENG-09, axe, keyboard, layout-shift, phone-first-screen]
requires: [02-13]
provides:
  - "e2e/a11y.spec.js: axe WCAG 2.2 AA (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa), zero violations of any impact, in 4 states × 320×640 and 1280×800; no horizontal overflow with hyphens off; D-39 keyboard path; UX-01 tip behaviour"
  - "src/engine/boundary.test.js: no localStorage/sessionStorage/indexedDB/document.cookie anywhere in src/ (T-02-39)"
  - "src/i18n/dictionary.test.js: tip.<id>.name/.text and markup for the 12 UX-01 terms"
  - "#xsec-figure reserved 5:2 box (120–240 px) + renderCrossSectionPending(): no layout shift when the drawing arrives"
  - "Rx preset chips after the Rx table (R Sph on the phone's first screen)"
affects: [src/ui/cross-section.js, src/ui/pipeline.js, src/ui/style.css, index.html, e2e/layout.spec.js, e2e/presets.spec.js, e2e/smoke.spec.js, 02-UI-SPEC.md]
tech-stack:
  added: []
  patterns:
    - "Reserve space for late, worker-delivered content (box + table rows) instead of waiting for it in tests"
    - "Assert layout stability by delaying the worker message (slowWorker types ['profile']) and comparing page offsets before and after"
key-files:
  created:
    - e2e/a11y.spec.js
  modified:
    - src/ui/cross-section.js
    - src/ui/pipeline.js
    - src/ui/style.css
    - index.html
    - e2e/layout.spec.js
    - e2e/presets.spec.js
    - e2e/smoke.spec.js
    - src/i18n/dictionary.test.js
    - src/engine/boundary.test.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "Rx preset chips moved below the Rx table (all viewports, DOM order = tab order). A horizontally scrolling chip row was rejected: WCAG 1.4.10 Note 2 lists no exception for it, and it would only have moved R Sph from 897 to about 761 px"
  - "Querschnitt figure is a 5:2 box clamped to 120–240 px, full width; the drawing scales into the box height (pxPerMm reads it), so its arrival moves nothing"
  - "UX-04 marked complete; UX-03 left Pending: the phone layout and overflow parts are verified, but 'the lens view stays visible while editing' needs the phase-3 view in #bar-view-slot"
  - "No accessibility fix was needed: the assembled page had zero axe violations and a complete keyboard path on the first run"
metrics:
  duration: 24min
  completed: 2026-11-07
  tasks: 2
  files: 11
---

# Phase 02 Plan 14: Whole-page accessibility, layout-shift and phone first-screen fixes, ENG-09 proxy record Summary

The assembled page now has a strict whole-page accessibility gate. It runs axe with the WCAG 2.2 AA tag list and allows zero violations of any impact, in four states at 320 × 640 and 1280 × 800. It also walks the D-39 keyboard path and checks the UX-01 toggletips. The page passed all of this on the first run, so no accessibility fix was needed. Two layout problems were fixed. The Querschnitt drawing no longer shifts the page when it arrives. On a phone, R Sph now starts on the first screen. The ENG-09 proxy re-run gives four absolute findings for 02-15.

**Watch first:** the 4× proxy input frame is 19,5–19,9 ms for case A in all three runs, up from 16,30 ms in 01-15 and above the 16,7 ms limit. This is ENG09-PROXY-1 and -4. The phone check in 02-15 decides; no tuning was done in this plan.

## Tasks

| Item | Commit | What |
|---|---|---|
| Extra 1 (layout shift) | `5bc2219` | `#xsec-figure` is a reserved box and the table rows appear when the profile job is sent. layout.spec drops the 02-13 wait-for-drawing and asserts that the disclaimer stays put |
| Extra 2 (phone first screen) | `b9655df` | Rx chips moved after the table. UI-SPEC page structure and keyboard order updated. layout.spec checks R Sph above the bar; presets.spec adjusted |
| Task 1 | `3f6500d` | a11y.spec (matrix, keyboard, UX-01), dictionary UX-01 test, no-storage scan; the smoke.spec axe test is replaced by a pointer |
| Task 2 | (no commit) | perf-throttled.spec needed no change: cases A and B and the extreme run work on the phase-2 page, and `caseA.compareFrame` is already recorded per rate (02-07). Three runs recorded below |
| Extra 3 (deferred items) | in the docs commit | deferred-items.md: two items resolved, one carried forward, one new finding (see below) |

## Extra 1: Querschnitt layout shift (02-13 known limitation)

- **Measured before the fix:** after the switch turned on, the drawing's arrival moved `#disclaimer` by **258 px at 360 px** and **373 px at 1280 px**. The figure grew from 0 to 89/156 px and the table from 32 to 193 px.
- **Fix:**
  - `#xsec-figure` is a `width: 100%; aspect-ratio: 5 / 2; min-height: 120px; max-height: 240px` box, and the SVG fills it.
  - The explicit width is needed. Without it, max-height transfers through the ratio to a 600 px max width (measured: figW 600 instead of 1120 at 1280 px).
  - `pxPerMm` uses the box height, capped at 240, instead of a fixed 240.
  - `renderCrossSectionPending()` writes the table rows with empty value cells when the profile job is sent, unless a drawing is already shown.
- **Measured after the fix:** with the profile message delayed 1,5 s, the disclaimer's page offset was identical before and after the drawing at 320, 360, 900 and 1280 px.
- **Test:**
  - The new layout.spec test runs at 360 and 1280 px. It uses `slowWorker(…, { types: ['profile'] })` and asserts that `#xsec` is pending with no SVG, then the same `#disclaimer` offset after `settledXsec` with the SVG and the CT cell present.
  - The 02-13 `settledXsec` wait in the disclaimer test is removed.
  - Result: 150/150 with `--repeat-each=5 --workers=8`.
- Trade-off: on wide screens a flat lens leaves white space in the 240 px box. The drawing is centred (`xMidYMid meet`).

## Extra 2: phone first screen (02-09 deferred item)

- **Before:** at 360 × 780 the chip row was 180 px (3 rows), and R Sph started at **897 px**. The bar top is 720 px.
- **After:** the chips follow the table, after `#rx-same` and the form notes and before `#rx-other`. R Sph starts at **693 px**, above the bar, and the table caption is in view. This is screenshot-checked. layout.spec now asserts the caption is in view and the R Sph top is below the bar top. It used to check only that `#rx-presets` was in view.
- **Why not a horizontal chip scroller:** WCAG 2.2 Understanding 1.4.10 (https://www.w3.org/WAI/WCAG22/Understanding/reflow.html, Note 2) limits the two-dimensional exception to maps, diagrams, video, games, presentations, data tables and toolbars. A chip scroller is not one of them. It would also only have saved about 136 px (R Sph at about 761 px, still under the bar).
- The keyboard order changed (UI-SPEC updated): … Rx fields → "Gleich für beide Augen" → Rx chips → RX-08 details …. presets.spec's keyboard test now starts at `#rx-same`.
- **New finding, not fixed (deferred-items.md):** a field message that appears on blur can move a control below the field between mousedown and mouseup, so the click is lost.
  - Reproduced 6/6 on desktop: "Eigene Werte eingeben", then an immediate click on an Rx chip. The blur shows "Fehler: Bitte einen Wert eingeben." (58 px) above the chip.
  - The hazard is general. It already applied to the frame chips, `#rx-same` and "Wo finde ich das?".
  - The test now waits for the due message, as a person's slower click would. This is for lens-critic and 02-15.

## Task 1: accessibility matrix, keyboard flow, UX-01, no storage

**axe matrix.** Tags: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`. Every violation counts, whatever its impact. All four states had **zero violations** at 320 × 640 and at 1280 × 800, on both projects:
- simple;
- Experten-Ansicht;
- comparison active with B = 1,74;
- everything open: Expert + comparison + every visible tip + every `<details>` (the test asserts that 0 stay closed) + the stamp figure.

`scrollWidth <= clientWidth` with `hyphens: manual` in every state. A negative control in a scratch probe (not committed) injected a nameless button and low-contrast text, and axe reported `button-name` and `color-contrast`, so the scan is live.

**Keyboard.** Starting at the top, 23 checkpoints are reached by Tab in the D-39 order (with the chips after the table):
- `#expert`: Space, stays focused;
- example button;
- Sph tip: Enter, then Esc, focus back on the tip;
- R Sph … L PD, then `#rx-same`;
- Rx chips, RX-08 summary;
- stamp tip, stamp field, "Wo finde ich das?";
- shape radios: ArrowRight changes the shape, ArrowLeft restores it;
- frame chips, then A, B and DBL;
- material radios (arrows);
- Expert base curve;
- the results region;
- `#cmp-start`: Enter moves focus to `#cmp-diff`;
- Vorher/Nachher radios (arrows);
- the Querschnitt meridian select;
- `#tech` summary.

At every stop the test also checks:
- `:focus-visible` matches;
- an outline of at least 2 px is drawn on the element or its label or card;
- on the mobile project, the element is not hidden by the summary bar.

Each radio group (shape, material, cmp-show, xsec-eye) is exactly one tab stop, and there is no positive tabindex. The disclaimer is `tabindex="-1"`, not a tab stop. It is reached via "Zum Hinweis unten", which moves focus to it (separate test).

**UX-01.** All 12 terms (sph, cyl, axis, pd, index, basecurve, ct, et, a, b, dbl, dec) have a `button.tip-btn[aria-controls="tip-<id>"]` named "Erklärung: …". Each opens by click, Enter and Space, closes by Esc, and keeps focus on the button. The Expert view is on, for basecurve and dec.

**Fixes found by the matrix:** none. No rule ID was hit, so there is no `fix(02-14)` accessibility commit.

**TDD note:** the dictionary and boundary tests passed on their first run (164/164). They are regression guards over behaviour delivered in 02-02…02-13, not new behaviour. The no-storage scan has a positive control: main.js and the worker are in the scanned list, and the regex matches sample lines.

## Task 2: ENG-09 proxy with the comparison lane (formal measurement)

**Method:**
- Command: `npm run build`, then 3 × `PERF_OUT=<scratchpad>/perf-02-14-run{1,2,3}.json npm run test:perf`. All 3 exited 0, each "1 passed (1.2m)".
- Raw JSON: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/perf-02-14-run1.json` (and run2, run3). Not committed.
- Same host as 01-15 (i7-8809G).
- The spec is unchanged:
  - Case A: −4,25 / −4,00 typed with Zyl −2 × 30, PD 32 filled explicitly, Rechteckig 52×38/18, CR-39. The discriminator was etmax 7,5 / 7,3 mm in every run and rate.
  - Case B: the Grenzfall.
  - The material comparison runs behind every edit; `compareFrame` n = 10 at every rate.

**Table:** 01-15 in brackets; each value is the min–max over the 3 runs; values in ms.

| Row | 1× | 2× | 4× | 6× |
|---|---|---|---|---|
| BenchmarkIndex | 2012–2172,5 (2213,5) | 892,5–1005,5 (927,5) | 442,5–508 (520,5) | 327–343 (344,5) |
| Case A input frame median / **max** | 1,55–1,60 / 1,70–4,20 (1,60 / 1,90) | 8,00–8,60 / 10,00–11,60 (2,80 / 7,80) | 15,60–16,10 / **19,50–19,90** (14,50 / 16,30) | 23,65–24,60 / 26,40–43,70 (21,55 / 29,50) |
| Case A reaction max | 10,10–10,40 (12,40) | 18,10–22,50 (16,40) | 29,40–36,10 (28,80) | 46,30–56,70 (44,40) |
| Case A result frame max | 1,80–2,10 (2,20) | 3,30–3,80 (2,10) | 9,40–10,90 (4,00) | 14,20–17,90 (8,70) |
| Case A **compare paint frame** median / max | 2,00 / 2,20–2,30 (–) | 3,85–4,15 / 6,00–6,70 (–) | 7,40–8,10 / 8,50–15,10 (–) | 11,90–12,35 / 13,80–30,10 (–) |
| Case A input → result painted median / max | 26,35–26,75 / 26,90–27,70 (28,30 / 30,10) | 26,75–27,10 / 28,70–29,50 (27,25 / 28,80) | 32,25–36,60 / 37,80–44,40 (31,40 / 34,70) | 44,65–53,00 / 64,50–72,60 (46,05 / 57,30) |
| Case B input frame median / **max** | 1,55–1,90 / 3,80–4,20 (1,60 / 1,70) | 5,65–8,25 / 9,80–10,60 (3,15 / 8,80) | 15,20–17,45 / **16,00–21,00** (13,80 / 16,10) | 24,25–28,00 / 25,90–41,70 (19,80 / 23,00) |
| Case B reaction max | 10,10–12,80 (13,40) | 17,90–18,40 (15,40) | 28,90–34,70 (27,50) | 30,50–50,60 (46,00) |
| Case B result frame max | 1,70–2,30 (1,70) | 3,10–3,80 (2,70) | 9,60–10,90 (4,40) | 16,70–24,80 (9,10) |
| Case B input → result painted median / max | 26,45–27,00 / 27,10–28,20 (28,65 / 30,20) | 26,10–27,25 / 28,40–30,00 (27,75 / 29,30) | 34,00–35,90 / 37,00–63,80 (32,20 / 33,30) | 45,55–50,85 / 51,10–77,90 (41,45 / 54,70) |
| Extreme run input frame max | 19,60–20,70 (20,30) | 38,40–43,50 (23,40) | 58,00–87,70 (54,80) | 89,30–130,80 (83,20) |
| Extreme run reaction max = (b) worst (≤ 200) | 26,20–28,10 pass (27,30) | 38,90–44,50 pass (30,70) | 67,70–97,90 pass (57,10) | 98,20–147,50 pass (86,70) |
| Extreme run final OD etmax | 7,3 ×3 | 7,3 ×3 | 7,3 ×3 | 7,3 ×3 |
| (c) estimate (≤ 100) | 28,10–29,00 pass | 33,90–34,65 pass | 50,10–56,60 pass | 82,55–90,55 pass |

Per-run 4× values:
- Case A input frame max: 19,90 / 19,50 / 19,80.
- Case B input frame max: 21,00 / 19,30 / 16,00.
- Compare frame max: 8,60 / 8,50 / 15,10.
- (b) worst: 97,90 / 67,70 / 82,20.

Proxy (ENG-09 regression, phase 2): 4× (a) case A max 19,90 ms (runs 19,90 / 19,50 / 19,80) vs 16,30 ms in 01-15; (b) worst 97,90 ms (runs 97,90 / 67,70 / 82,20) vs 57,10 ms in 01-15, pass (≤ 200 ms)

Proxy findings (ENG-09): ENG09-PROXY-1, ENG09-PROXY-2, ENG09-PROXY-3, ENG09-PROXY-4

| ID | Rule (absolute) | Measured |
|---|---|---|
| ENG09-PROXY-1 | 4× case A input frame (main thread incl. rendering) ≥ 16,7 ms | max 19,90 / 19,50 / 19,80 ms in all 3 runs (median 15,65 / 15,60 / 16,10) |
| ENG09-PROXY-2 | 4× case B input frame ≥ 16,7 ms | max 21,00 / 19,30 ms in runs 1 and 2; run 3 16,00 ms (below) |
| ENG09-PROXY-3 | any 1× input frame ≥ 16,7 ms | case A and B at 1× stay ≤ 4,20 ms, but the 1× **extreme run** (keystrokes while the rescan bench runs) reaches 19,80 / 19,60 / 20,70 ms (01-15: 20,30). In 01-15 this extreme-run value was diagnosed as a multi-task measurement artefact (no LoAF frame > 50 ms); that was not re-diagnosed here, so it is listed under the absolute rule |
| ENG09-PROXY-4 | trend: 4× case A input frame max more than 2 ms above 16,30 ms | +3,20 / +3,20 / +3,50 ms (19,50–19,90 vs 16,30) |

- 1× compare paint frame max is 2,20–2,30 ms, so it gives **no finding**.
- Context for 02-15, no rule attached:
  - At 6× the compare frame max reaches 30,10 ms (run 2).
  - The 4× result frame max more than doubled vs 01-15 (9,4–10,9 vs 4,0 ms), because the phase-2 result cards, bar and callouts are rendered.
  - The 2× case A input median rose from 2,80 to 8,00–8,60 ms.
  - Against the phase-2 history: the 4× case A input median of 15,6–16,1 ms matches 02-13 (15,4 / 15,85 ms) and the 4× compare median of 7,40–8,10 ms matches 02-13 (7,65 / 7,9 ms). This plan's changes did not move them; the regression against 01-15 built up across 02-01…02-13.
- No optimisation was done in this plan. The findings go to the 02-15 phone check and lens-critic.

`npx playwright test e2e/worker.spec.js` ran inside the full e2e run below, desktop and mobile, and passed.

## Extra 3: deferred-items.md review

| Item | Status |
|---|---|
| 02-06 frame.spec PD echo race | resolved in 02-07 (unchanged) |
| 02-07 worker.spec busy window under overload | resolved in 02-08 |
| 02-07 compare bench timeout under coverage | resolved in 02-08 |
| 02-08 MAT-02 property test timeout | resolved in 02-09 |
| 02-08 evaluate / solve / diagnostics property tests near timeouts | **carried forward** (not touched; split-per-case is the known fix) |
| 02-08 compare.spec aborted worker fetch | resolved in 02-08 |
| 02-08 sticky column covers the disclaimer | resolved in 02-09 |
| 02-09 phone chips push R Sph off the first screen | **resolved here** (`b9655df`) |
| 02-13 Querschnitt layout shift (02-13 SUMMARY) | **resolved here** (`5bc2219`), recorded in deferred-items |
| new: a message on blur moves the control below the field mid-click | **open finding**, recorded for lens-critic / 02-15 |
| 02-13: no re-render of the Querschnitt on window resize | carried forward (02-13 SUMMARY; the reserved box makes it less visible, but labels still scale with the SVG) |

## Plan-end verification (real output)

`npm run lint && npm run test:coverage && npm run build && npm run test:e2e` exited 0:
- lint: clean.
- coverage: **34 files, 1564/1564 passed**; all files 98,34 % statements, 96,52 % branches, 100 % functions, 99,15 % lines.
- build: `✓ built in 130ms`.
- e2e: **336 passed (2.3m)**. That is up from 320: +14 a11y.spec, +4 layout.spec layout-shift tests, −2 for the removed smoke axe test.

Also run:
- a11y.spec `--repeat-each=3 --workers=8`: 42/42.
- layout.spec `--repeat-each=5 --workers=8`: 150/150.
- presets, xsec and rx specs `--repeat-each=2`: 172/172.

Acceptance greps:
- `withTags(` in a11y.spec: 1.
- `impact === 'serious'` in a11y.spec: 0.
- `grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie" src/ --include=*.js | grep -v test`: no output.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Querschnitt layout shift (orchestrator extra 1).** See Extra 1. Files: cross-section.js, pipeline.js, style.css, layout.spec.js. Commit `5bc2219`.

**2. [Rule 1 - Usability] Rx entry below the phone's first screen (orchestrator extra 2).** See Extra 2. Files: index.html, layout.spec.js, presets.spec.js, 02-UI-SPEC.md. Commit `b9655df`. The UI-SPEC keyboard order and page structure changed; lens-critic should confirm.

**3. [Rule 3 - Blocking] presets.spec "Eigene Werte eingeben (empty fields)" failed 6/6 on desktop after the chip move.** Cause measured: a click race with the blur message (Extra 2 finding). The test now blurs and waits for the message before clicking. The underlying hazard is recorded, not fixed. Commit `b9655df`.

### Notes

- smoke.spec lost its `AxeBuilder` import together with the replaced test; there was no other user.
- Task 2 made no commit, because the spec needed no change. The plan's commit was "spec changes only".

## Requirements

- **UX-04: complete.**
  - Automated WCAG 2.2 AA checks run in CI, because `npm run test:e2e` is in the deploy workflow, with zero violations in all states.
  - The full keyboard path works with visible focus; labels are checked by axe.
  - The manual screen-reader pass (TalkBack/VoiceOver) belongs to the 02-15 VERIFICATION per the UI-SPEC.
- **UX-01:** was already complete; it is now covered by e2e (all 12 terms, click/Enter/Space/Esc) and by the dictionary and markup test.
- **UX-03: left Pending (judgement, flagged).**
  - Delivered: 320 px to desktop with no overflow in any state and with hyphens off; phone first screen fixed.
  - Not delivered: "on phones the lens view stays visible while editing inputs". The phase-2 summary bar keeps the numbers visible, but the lens view is the phase-3 view in the reserved `#bar-view-slot`.

## Threat model check

- T-02-39: the boundary.test no-storage scan is in CI and passes.
- T-02-40: a11y.spec uses guardPage, so every state also fails on CSP console messages, 4xx/5xx responses or requests to other origins. It passed.
- T-02-41: the proxy was re-run and the findings ENG09-PROXY-1…4 are recorded with numbers for 02-15.
- No new network, auth, storage or trust-boundary surface.

## TDD Gate Compliance

Task 1 committed as `test(02-14)` `3f6500d`. The new tests pass against the existing code: no fix was needed, so there is no `feat`/`fix` GREEN commit for Task 1. The plan says "fix only what a failing check shows", and the checks were live (negative control above). The two `fix(02-14)` commits come from the orchestrator extras, and each carries its own test.

## Self-Check: PASSED

- Files: e2e/a11y.spec.js, this SUMMARY: FOUND.
- Commits: 5bc2219, b9655df, 3f6500d: FOUND.
