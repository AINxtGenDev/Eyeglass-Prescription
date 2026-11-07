---
phase: 2
slug: lay-first-german-input-results-comparison
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (project `unit`, node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0 |
| **Config file** | `vite.config.js` (`test.projects`), `playwright.config.js` (desktop 1280, mobile 360; perf only with PERF=1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` |
| **Estimated runtime** | about 90 seconds (unit about 20 s, e2e about 70 s) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`. For UI tasks, also run `npm run build && npx playwright test <touched spec>`.
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** The full suite must be green. Also record `npm run test:perf`, do a real-phone check (Pixel; iPhone if available), and get the lens-critic result review.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs = the phase-2 plans that delivered each row, plus the gap-closure plans 02-16..02-20 (lens-critic 02-15 findings). Status from the 02-15 trace at HEAD 68c4e63 (2026-11-07), re-run in 02-21 at the post-gap HEAD ac2aa94: every row ≥ 1 passing and 0 failing tests; counts in 02-15-SUMMARY.md and 02-21-SUMMARY.md.

| Requirement | Task ID | Behavior | Test Type | Automated Command | File Exists | Status | Value-asserting test (02-21 trace) |
|-------------|---------|----------|-----------|-------------------|-------------|--------|------|
| RX-01 | 02-03 | Table ids, labels, R before L, reflow at 320 px | e2e | `npx playwright test e2e/rx.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/rx.spec.js:18` 'row headers: R before L, in the paper wording' (row headers = ['Rechtes Auge (R / OD)', 'Linkes Auge (L / OS)']) |
| RX-04 | 02-03, 02-18 | Ranges per field, never clamped; 02-18: empty-field Fehler only on an edited field (`e2e/rx.spec.js:222` 'RX-05 M3: empty-field message only after the field was edited') | unit + e2e | `npx vitest run src/state/validate.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/rx.spec.js:55` 'Außerhalb des Modells: never clamped, card blocked, jump to the field' (field keeps '-13', echo '−13,00 dpt', card CT '–') |
| RX-05 | 02-03, 02-18 | Three tiers, "Meinten Sie" applies suggestion, aria-describedby linked; 02-18 (M3): untouched/edited/eye rule (`e2e/rx.spec.js:225–277`), click/tap lands after a blur message, MJ-2, Tab ≤ 200 ms, m-d caps (`e2e/rx.spec.js:292–375`) | unit + e2e | `npx vitest run src/state/validate.test.js`; `e2e/rx.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/rx.spec.js:225` 'untouched: "Eigene Werte eingeben", Tab out of the empty R Sph shows no Fehler' + `e2e/rx.spec.js:238` 'edited: type "1", clear it, Tab: the empty-field Fehler appears on blur' (02-18) |
| RX-06 | 02-04 | `32/33`, `64`, `32,5`, 40–50 question band, missing → default stated | unit + e2e | `npx vitest run src/state/parse.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/frame.spec.js:117` '"64" is the binocular PD: 32 mm per eye' (echo '64,0 mm Gesamt-PD → je 32,0 mm', dec '3,0 mm' both eyes) |
| RX-07 | 02-03 | Mirror on/off keeps values, readonly, focusable | e2e | `e2e/rx.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/rx.spec.js:122` '"Linkes Auge gleich wie rechtes" mirrors Sph, Zyl, Achse read-only; PD stays' (L values = R values, readonly, L PD unchanged) |
| RX-08 | 02-03 | `<details>` with Add/Prisma/HSA/F/N, "nicht berechnet" | e2e + dict unit | `e2e/rx.spec.js`; `src/i18n/dictionary.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/rx.spec.js:159` 'other values on the paper (RX-08) are explained in a closed <details>' (closed; text has Add, Prisma, HSA, 'nicht berechnet') |
| FRAME-02 | 02-04, 02-11 | A/B/DBL ranges, rim depth + edge beyond rim | unit + e2e | `npx vitest run src/engine/rim.test.js src/state/validate.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/frame.spec.js:102` 'A outside 40–62 mm: Außerhalb des Modells, both eyes blocked, never clamped' + `e2e/expert.spec.js:375` 'Randtiefe: default 3,0 mm, the example edge is 1,6 mm deeper, 5 fits, no recompute' |
| FRAME-03 | 02-04, 02-18 | Stamp variants, B "geschätzt"; 02-18: 'FRAME-03 M3: invalid stamp, then at once "Wo finde ich das?": the drawing opens' (`e2e/frame.spec.js:205`) | unit (property) + e2e | `npx vitest run src/state/parse.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/frame.spec.js:16` 'the temple stamp sets A and DBL; B is estimated from the shape and disclosed' (56□16 145 → A 56, DBL 16, B 41 'geschätzt') |
| MAT-03 | 02-10 | baseCurve 0 accepted; manual 0…10; convex-back warning; steeper base curve clears it | unit | `npx vitest run src/engine/evaluate.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/expert.spec.js:172` 'manual base curve: 6 is used, 0 computes, 12 is Außerhalb des Modells' (+6,00 / 0,00 shown; 12 → both CT '–') |
| MAT-04 | 02-10 | Defaults from materials.js, re-fill unless edited, binding constraint text | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/expert.spec.js:196` 'minimum thicknesses: pre-filled per material, typed value kept, Standardwerte setzen, switch off' (auto CT '1,8 mm') |
| MAT-05 | 02-11 | k = 0 unchanged (golden); auto D1 with k = spherical D1 unless raised minimally to keep max(D2a, D2b) ≤ 0; monotone CT; UI range −5…−1 | unit + property | `npx vitest run src/engine/evaluate.test.js src/engine/properties.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/expert.spec.js:318` 'aspheric front: k field and note only for asphärisch, thinner plus centre, same base curve' |
| MAT-06 | 02-12 | customMaterial = cr39 constants → equal metrics; INVALID_SPEC; label | unit + e2e | `evaluate.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/expert.spec.js:453` 'Eigenes Material: card only in the Experten-Ansicht; CR-39 constants give the 1,50 numbers, labelled' |
| RES-01 | 02-01, 02-16 | Headline per eye, thickest = max(CT, edge) ('in der Mitte' for plus), 0,1 mm / 1 g, "unter 1 g"; 02-16 (B1): thinnest = min(CT, thinnest edge) (`src/state/compare.test.js:52–91`), example 'am dünnsten 1,8 mm in der Mitte' (`e2e/results.spec.js:27`), plus and plano cases (`e2e/results.spec.js:156`, `:166`) | unit + e2e | `npx vitest run src/i18n/format.test.js src/state/compare.test.js`; `e2e/results.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/results.spec.js:27` 'example at load: banner, both cards with the pinned values, no L/R sentence' (headline '… am dünnsten 1,8 mm in der Mitte …', line 51/54; 02-16) + `src/state/compare.test.js:53` 'RES-01 minus lens: the centre' |
| RES-02 | 02-06, 02-07, 02-19, 02-20 | 6 rows on max(CT, edge) of one fixed eye, selected = main, signed differences, per-eye 'Dickster Rand', custom excluded; 02-19 (m3, m4): shownEye tie (`src/state/compare.test.js:260`), intro e2e (`e2e/compare.spec.js:53`, `:60`); 02-20 (M4): deferred compare start (`e2e/compare.spec.js:359`, `:375`, `:396`) | unit + e2e | `npx vitest run src/state/compare.test.js src/state/compute-client.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/compare.spec.js:28` 'example: six rows, 1,74 saves 1,6 mm and 4 g; switching moves "Ihre Auswahl"' |
| RES-03 | 02-08, 02-17 | Freeze A, change B, difference row; phone toggle; 02-17 (M2): bar prefix 'Vorher (A):' (`e2e/compare.spec.js:295`, `:337`) | e2e | `e2e/compare.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/compare.spec.js:295` 'RES-03 summary bar: Vorher (A) prefix through toggle, frame edit and end' (02-17; bar values = card strings) |
| RES-04 | 02-01 | Callout at ≥ 1,0 mm or ≥ 3 g on max(CT, edge); cause Rx / PD / both | unit | `src/state/compare.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/results.spec.js:75` 'R −4,00 / L −5,25: the left glass is thicker (5,8 / 7,2 mm)' |
| RES-05 | 02-01, 02-09 | Example banner; preset → inline confirm, Esc | e2e | `e2e/presets.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/presets.spec.js:51` "'Stark kurzsichtig' removes the banner, keeps PD and shows the pinned values" |
| UX-01 | 02-03, 02-04, 02-07, 02-10, 02-11, 02-14 | Every term has tip button + dict key; Enter/Space/Esc | unit + e2e | `dictionary.test.js`; `e2e/a11y.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/a11y.spec.js:217` 'UX-01: every term has a tip that opens by click, Enter and Space and closes by Esc' |
| UX-02 | 02-02, 02-10..02-13, 02-19 | Expert hidden by default, switch reveals, not persisted; 02-19 (m8): 'UX-02 Simple view hides every Expert-only element (m8)' (`e2e/expert.spec.js:637`) | e2e | `e2e/expert.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace); requirement stays Pending: heatmap is phase 3 | `e2e/expert.spec.js:637` 'UX-02 Simple view hides every Expert-only element (m8)' (02-19; 13 locators hidden) |
| UX-03 | 02-02, 02-14, 02-17, 02-18 | 320 px no horizontal overflow; sticky bar; scroll-padding; 02-17: prefixed bar one line, < 72 px (`e2e/compare.spec.js:337`); 02-18: tap lands after a blur message (`e2e/rx.spec.js:304`) | e2e | `e2e/layout.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace); requirement stays Pending: lens view while editing is phase 3; phone check in 02-15 Task 3 | `e2e/layout.spec.js:32` 'never scrolls horizontally, also with a long value and without hyphenation' (320 × 640; scrollWidth state, hyphens: manual) |
| UX-04 | 02-14 | axe zero violations (simple/expert/compare/tips × 320/desktop); keyboard full flow | e2e | `e2e/a11y.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/a11y.spec.js:75` 'axe WCAG 2.2 AA zero violations and no overflow at 320 px: ${name}' (violations = [], 4 states) |
| UX-05 | 02-01 | No "Stärke" | unit | `src/i18n/dictionary.test.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `src/i18n/dictionary.test.js:52` 'never uses "Stärke" (thickness is Mittendicke/Randdicke)' (every de-AT value) |
| ANA-01 | 02-13, 02-17 | meridianProfile invariants; SVG title/desc + text table; A/B dashed vs solid; 02-17 (M1): meridian labels from `meridianPower`, axes 170/45/180/90 and Zyl 0 (`e2e/xsec.spec.js:162–205`) | unit (property) + e2e | `npx vitest run src/engine/profile.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/xsec.spec.js:162` 'ANA-01 axis 170 (example L −2,50 / −0,75 × 170): 0° is kein Hauptschnitt, −2,52 dpt' (02-17) |
| ANA-02 | 02-02, 02-10 | Decentration sign per eye; binding constraint wording | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 + 02-21 trace) | `e2e/expert.spec.js:46` 'Zwischenwerte for the example (A 52, DBL 18, PD 32 / 31,5)' (dec '3,0 mm' / '3,5 mm', binding 'Mindestwert') |
| ENG-09 (regression) | 02-06, 02-07, 02-14, 02-20, 02-22 | Main before compare, latest-wins, ≤ 1 compare job ahead; proxy finding for any input/compare frame ≥ 16,7 ms (02-14); phone (a)/(c) fail → ENG-09 back to Pending (02-15); 02-20 (M4): compare start after the input-frame stamp (`e2e/compare.spec.js:359`, `:375`, `:396`), PERF_TRACE attribution in `e2e/perf-throttled.spec.js` (PERF=1 only); 02-22 (user decision 'Fix the measurement'): quiet proxy method, no DevTools command inside a measured frame, default `PERF_METHOD=quiet`, `PERF_METHOD=legacy` = old method. Commands: `npm run build && PERF=1 PERF_TRACE=<file>.json npx playwright test e2e/perf-throttled.spec.js` (trace proof: the spec asserts 0 DevToolsSession tasks in every traced 4× case A / B frame) and `npm run test:perf` (×3; verdict `results[].verdict.ruleA`) | unit + e2e | `compute-client.test.js`; `e2e/worker.spec.js` | ✅ | ✅ green (unit + e2e); ❌ proxy verdict FAIL in 02-20 (4× case A max 21,7 / 19,1 / 20,5 ms, case B 23,3 / 24,9 / 21,8 ms ≥ 16,7 ms, old method). ✅ 02-22 quiet method: 4× proxy (a) PASS in 3 of 3 runs (case A max 7,4 / 10,0 / 8,4 ms, case B 9,1 / 8,4 / 7,6 ms, compare start ≤ 1,0 ms); legacy re-run 19,9 / 19,6 ms FAIL. ENG-09 stays Pending in REQUIREMENTS.md until the 02-15 Task 3 phone check; lens-critic M4 to be re-reviewed at 02-15 | `e2e/compare.spec.js:359` 'ENG-09 RES-02: five quick R Sph values, the comparison converges to the last one (latest-wins)' (02-20; table = fresh page with the last value) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/state/validate.js` + `validate.test.js`: RX-04/05, FRAME-02, MAT-06 tiers
- [x] `src/state/compare.js` + `compare.test.js`: RES-02/04 arithmetic
- [x] `src/engine/profile.js` + `profile.test.js`; `src/engine/rim.js` + `rim.test.js` (coverage ≥ 95/90)
- [x] e2e specs: `rx`, `presets`, `compare`, `expert`, `layout`, `a11y` (desktop + mobile; 320 px via `test.use`)
- [x] `e2e/helpers.js`: `settledCompare(page)` on `#compare[data-pending]`; text normaliser stripping U+00AD
- [x] `test/bench/compare.test.js` (informational timings)

Gap-plan note (02-19, lens-critic m2): the phase-1 property tests `evaluate.test.js` optimality and `solve.test.js` affected region are split per case (7 and 10 tests, each with its own 60 s timeout; same inputs).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ± button and sticky bar above on-screen keyboard on a real phone | UX-03, RX-01 | iOS keypad and Android keyboard resize cannot be emulated by Playwright | Live site on Pixel (and iPhone if available): type a minus Sph via ±; focus the L PD field and check that the bar does not cover it |
| German hyphenation of long compounds | UX-03 | Engine-specific hyphenation dictionaries | Live site at 320 px on a phone: no overflow, check hyphenation quality |
| ENG-09 with the compare lane on a phone | ENG-09 regression | Worker timing is not throttled in the proxy | Read the Technische Angaben timings on the Pixel after 10 edits |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120 s (`npm test` 46,9 s wall, 02-15)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated rows green 2026-11-07 (02-15 Task 1 at 68c4e63; re-run 02-21 at ac2aa94, every value-asserting test passed on desktop and mobile); lens-critic re-review of 12219a5..HEAD and manual-only rows pending (02-15 Task 3). ENG-09 Pending per 02-20 (proxy FAIL, lens-critic M4 open MAJOR)
