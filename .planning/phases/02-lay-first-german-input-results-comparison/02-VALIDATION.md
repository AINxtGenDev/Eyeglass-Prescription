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

| Requirement | Task ID | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|---------|----------|-----------|-------------------|-------------|--------|
| RX-01 | 02-03 | Table ids, labels, R before L, reflow at 320 px | e2e | `npx playwright test e2e/rx.spec.js` | ✅ | ✅ green (02-15 trace) |
| RX-04 | 02-03, 02-18 | Ranges per field, never clamped; 02-18: empty-field Fehler only on an edited field (`e2e/rx.spec.js:222` 'RX-05 M3: empty-field message only after the field was edited') | unit + e2e | `npx vitest run src/state/validate.test.js` | ✅ | ✅ green (02-15 trace) |
| RX-05 | 02-03, 02-18 | Three tiers, "Meinten Sie" applies suggestion, aria-describedby linked; 02-18 (M3): untouched/edited/eye rule (`e2e/rx.spec.js:225–277`), click/tap lands after a blur message, MJ-2, Tab ≤ 200 ms, m-d caps (`e2e/rx.spec.js:292–375`) | unit + e2e | `npx vitest run src/state/validate.test.js`; `e2e/rx.spec.js` | ✅ | ✅ green (02-15 trace) |
| RX-06 | 02-04 | `32/33`, `64`, `32,5`, 40–50 question band, missing → default stated | unit + e2e | `npx vitest run src/state/parse.test.js` | ✅ | ✅ green (02-15 trace) |
| RX-07 | 02-03 | Mirror on/off keeps values, readonly, focusable | e2e | `e2e/rx.spec.js` | ✅ | ✅ green (02-15 trace) |
| RX-08 | 02-03 | `<details>` with Add/Prisma/HSA/F/N, "nicht berechnet" | e2e + dict unit | `e2e/rx.spec.js`; `src/i18n/dictionary.test.js` | ✅ | ✅ green (02-15 trace) |
| FRAME-02 | 02-04, 02-11 | A/B/DBL ranges, rim depth + edge beyond rim | unit + e2e | `npx vitest run src/engine/rim.test.js src/state/validate.test.js` | ✅ | ✅ green (02-15 trace) |
| FRAME-03 | 02-04, 02-18 | Stamp variants, B "geschätzt"; 02-18: 'FRAME-03 M3: invalid stamp, then at once "Wo finde ich das?": the drawing opens' (`e2e/frame.spec.js:205`) | unit (property) + e2e | `npx vitest run src/state/parse.test.js` | ✅ | ✅ green (02-15 trace) |
| MAT-03 | 02-10 | baseCurve 0 accepted; manual 0…10; convex-back warning; steeper base curve clears it | unit | `npx vitest run src/engine/evaluate.test.js` | ✅ | ✅ green (02-15 trace) |
| MAT-04 | 02-10 | Defaults from materials.js, re-fill unless edited, binding constraint text | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 trace) |
| MAT-05 | 02-11 | k = 0 unchanged (golden); auto D1 with k = spherical D1 unless raised minimally to keep max(D2a, D2b) ≤ 0; monotone CT; UI range −5…−1 | unit + property | `npx vitest run src/engine/evaluate.test.js src/engine/properties.test.js` | ✅ | ✅ green (02-15 trace) |
| MAT-06 | 02-12 | customMaterial = cr39 constants → equal metrics; INVALID_SPEC; label | unit + e2e | `evaluate.test.js` | ✅ | ✅ green (02-15 trace) |
| RES-01 | 02-01, 02-16 | Headline per eye, thickest = max(CT, edge) ('in der Mitte' for plus), 0,1 mm / 1 g, "unter 1 g"; 02-16 (B1): thinnest = min(CT, thinnest edge) (`src/state/compare.test.js:52–91`), example 'am dünnsten 1,8 mm in der Mitte' (`e2e/results.spec.js:27`), plus and plano cases (`e2e/results.spec.js:156`, `:166`) | unit + e2e | `npx vitest run src/i18n/format.test.js src/state/compare.test.js`; `e2e/results.spec.js` | ✅ | ✅ green (02-15 trace) |
| RES-02 | 02-06, 02-07, 02-19, 02-20 | 6 rows on max(CT, edge) of one fixed eye, selected = main, signed differences, per-eye 'Dickster Rand', custom excluded; 02-19 (m3, m4): shownEye tie (`src/state/compare.test.js:260`), intro e2e (`e2e/compare.spec.js:53`, `:60`); 02-20 (M4): deferred compare start (`e2e/compare.spec.js:359`, `:375`, `:396`) | unit + e2e | `npx vitest run src/state/compare.test.js src/state/compute-client.test.js` | ✅ | ✅ green (02-15 trace) |
| RES-03 | 02-08, 02-17 | Freeze A, change B, difference row; phone toggle; 02-17 (M2): bar prefix 'Vorher (A):' (`e2e/compare.spec.js:295`, `:337`) | e2e | `e2e/compare.spec.js` | ✅ | ✅ green (02-15 trace) |
| RES-04 | 02-01 | Callout at ≥ 1,0 mm or ≥ 3 g on max(CT, edge); cause Rx / PD / both | unit | `src/state/compare.test.js` | ✅ | ✅ green (02-15 trace) |
| RES-05 | 02-01, 02-09 | Example banner; preset → inline confirm, Esc | e2e | `e2e/presets.spec.js` | ✅ | ✅ green (02-15 trace) |
| UX-01 | 02-03, 02-04, 02-07, 02-10, 02-11, 02-14 | Every term has tip button + dict key; Enter/Space/Esc | unit + e2e | `dictionary.test.js`; `e2e/a11y.spec.js` | ✅ | ✅ green (02-15 trace) |
| UX-02 | 02-02, 02-10..02-13, 02-19 | Expert hidden by default, switch reveals, not persisted; 02-19 (m8): 'UX-02 Simple view hides every Expert-only element (m8)' (`e2e/expert.spec.js:637`) | e2e | `e2e/expert.spec.js` | ✅ | ✅ green (02-15 trace); requirement stays Pending: heatmap is phase 3 |
| UX-03 | 02-02, 02-14, 02-17, 02-18 | 320 px no horizontal overflow; sticky bar; scroll-padding; 02-17: prefixed bar one line, < 72 px (`e2e/compare.spec.js:337`); 02-18: tap lands after a blur message (`e2e/rx.spec.js:304`) | e2e | `e2e/layout.spec.js` | ✅ | ✅ green (02-15 trace); requirement stays Pending: lens view while editing is phase 3; phone check in 02-15 Task 3 |
| UX-04 | 02-14 | axe zero violations (simple/expert/compare/tips × 320/desktop); keyboard full flow | e2e | `e2e/a11y.spec.js` | ✅ | ✅ green (02-15 trace) |
| UX-05 | 02-01 | No "Stärke" | unit | `src/i18n/dictionary.test.js` | ✅ | ✅ green (02-15 trace) |
| ANA-01 | 02-13, 02-17 | meridianProfile invariants; SVG title/desc + text table; A/B dashed vs solid; 02-17 (M1): meridian labels from `meridianPower`, axes 170/45/180/90 and Zyl 0 (`e2e/xsec.spec.js:162–205`) | unit (property) + e2e | `npx vitest run src/engine/profile.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 trace) |
| ANA-02 | 02-02, 02-10 | Decentration sign per eye; binding constraint wording | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ✅ | ✅ green (02-15 trace) |
| ENG-09 (regression) | 02-06, 02-07, 02-14, 02-20 | Main before compare, latest-wins, ≤ 1 compare job ahead; proxy finding for any input/compare frame ≥ 16,7 ms (02-14); phone (a)/(c) fail → ENG-09 back to Pending (02-15); 02-20 (M4): compare start after the input-frame stamp (`e2e/compare.spec.js:359`, `:375`, `:396`), PERF_TRACE attribution in `e2e/perf-throttled.spec.js` (PERF=1 only) | unit + e2e | `compute-client.test.js`; `e2e/worker.spec.js` | ✅ | ✅ green (unit + e2e); ❌ proxy verdict FAIL in 02-20 (4× case A max 21,7 / 19,1 / 20,5 ms, case B 23,3 / 24,9 / 21,8 ms ≥ 16,7 ms): ENG-09 Pending in REQUIREMENTS.md, lens-critic M4 open MAJOR; ENG09-PROXY-1..4 open |

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

**Approval:** automated rows green 2026-11-07 (02-15 Task 1); lens-critic result review and manual-only rows pending (02-15 Tasks 1 step 4 and 3)
