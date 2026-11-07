---
phase: 2
slug: lay-first-german-input-results-comparison
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Task IDs are filled in by the planner. The requirement → test mapping is fixed:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| RX-01 | Table ids, labels, R before L, reflow at 320 px | e2e | `npx playwright test e2e/rx.spec.js` | ❌ W0 | ⬜ pending |
| RX-04 | Ranges per field, never clamped | unit + e2e | `npx vitest run src/state/validate.test.js` | ❌ W0 | ⬜ pending |
| RX-05 | Three tiers, "Meinten Sie" applies suggestion, aria-describedby linked | unit + e2e | `npx vitest run src/state/validate.test.js`; `e2e/rx.spec.js` | ❌ W0 | ⬜ pending |
| RX-06 | `32/33`, `64`, `32,5`, 40–50 question band, missing → default stated | unit + e2e | `npx vitest run src/state/parse.test.js` | ✅ extend | ⬜ pending |
| RX-07 | Mirror on/off keeps values, readonly, focusable | e2e | `e2e/rx.spec.js` | ❌ W0 | ⬜ pending |
| RX-08 | `<details>` with Add/Prisma/HSA/F/N, "nicht berechnet" | e2e + dict unit | `e2e/rx.spec.js`; `src/i18n/dictionary.test.js` | ✅ extend | ⬜ pending |
| FRAME-02 | A/B/DBL ranges, rim depth + edge beyond rim | unit + e2e | `npx vitest run src/engine/rim.test.js src/state/validate.test.js` | ❌ W0 | ⬜ pending |
| FRAME-03 | Stamp variants, B "geschätzt" | unit (property) + e2e | `npx vitest run src/state/parse.test.js` | ✅ extend | ⬜ pending |
| MAT-03 | baseCurve 0 accepted; manual 0…10; convex-back warning; steeper base curve clears it | unit | `npx vitest run src/engine/evaluate.test.js` | ✅ extend | ⬜ pending |
| MAT-04 | Defaults from materials.js, re-fill unless edited, binding constraint text | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ❌ W0 (e2e) | ⬜ pending |
| MAT-05 | k = 0 unchanged (golden); auto D1 with k = spherical D1 unless raised minimally to keep max(D2a, D2b) ≤ 0; monotone CT; UI range −5…−1 | unit + property | `npx vitest run src/engine/evaluate.test.js src/engine/properties.test.js` | ✅ extend | ⬜ pending |
| MAT-06 | customMaterial = cr39 constants → equal metrics; INVALID_SPEC; label | unit + e2e | `evaluate.test.js` | ✅ extend | ⬜ pending |
| RES-01 | Headline per eye, thickest = max(CT, edge) ('in der Mitte' for plus), 0,1 mm / 1 g, "unter 1 g" | unit + e2e | `npx vitest run src/i18n/format.test.js src/state/compare.test.js`; `e2e/results.spec.js` | ✅ extend | ⬜ pending |
| RES-02 | 6 rows on max(CT, edge) of one fixed eye, selected = main, signed differences, per-eye 'Dickster Rand', custom excluded | unit + e2e | `npx vitest run src/state/compare.test.js src/state/compute-client.test.js` | ❌ W0 | ⬜ pending |
| RES-03 | Freeze A, change B, difference row; phone toggle | e2e | `e2e/compare.spec.js` | ❌ W0 | ⬜ pending |
| RES-04 | Callout at ≥ 1,0 mm or ≥ 3 g on max(CT, edge); cause Rx / PD / both | unit | `src/state/compare.test.js` | ❌ W0 | ⬜ pending |
| RES-05 | Example banner; preset → inline confirm, Esc | e2e | `e2e/presets.spec.js` | ❌ W0 | ⬜ pending |
| UX-01 | Every term has tip button + dict key; Enter/Space/Esc | unit + e2e | `dictionary.test.js`; `e2e/a11y.spec.js` | ❌ W0 | ⬜ pending |
| UX-02 | Expert hidden by default, switch reveals, not persisted | e2e | `e2e/expert.spec.js` | ❌ W0 | ⬜ pending |
| UX-03 | 320 px no horizontal overflow; sticky bar; scroll-padding | e2e | `e2e/layout.spec.js` | ❌ W0 | ⬜ pending |
| UX-04 | axe zero violations (simple/expert/compare/tips × 320/desktop); keyboard full flow | e2e | `e2e/a11y.spec.js` | ❌ W0 | ⬜ pending |
| UX-05 | No "Stärke" | unit | `src/i18n/dictionary.test.js` | ✅ | ⬜ pending |
| ANA-01 | meridianProfile invariants; SVG title/desc + text table; A/B dashed vs solid | unit (property) + e2e | `npx vitest run src/engine/profile.test.js`; `e2e/expert.spec.js` | ❌ W0 | ⬜ pending |
| ANA-02 | Decentration sign per eye; binding constraint wording | unit + e2e | `evaluate.test.js`; `e2e/expert.spec.js` | ✅ / ❌ | ⬜ pending |
| ENG-09 (regression) | Main before compare, latest-wins, ≤ 1 compare job ahead; proxy finding for any input/compare frame ≥ 16,7 ms (02-14); phone (a)/(c) fail → ENG-09 back to Pending (02-15) | unit + e2e | `compute-client.test.js`; `e2e/worker.spec.js` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/state/validate.js` + `validate.test.js`: RX-04/05, FRAME-02, MAT-06 tiers
- [ ] `src/state/compare.js` + `compare.test.js`: RES-02/04 arithmetic
- [ ] `src/engine/profile.js` + `profile.test.js`; `src/engine/rim.js` + `rim.test.js` (coverage ≥ 95/90)
- [ ] e2e specs: `rx`, `presets`, `compare`, `expert`, `layout`, `a11y` (desktop + mobile; 320 px via `test.use`)
- [ ] `e2e/helpers.js`: `settledCompare(page)` on `#compare[data-pending]`; text normaliser stripping U+00AD
- [ ] `test/bench/compare.test.js` (informational timings)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ± button and sticky bar above on-screen keyboard on a real phone | UX-03, RX-01 | iOS keypad and Android keyboard resize cannot be emulated by Playwright | Live site on Pixel (and iPhone if available): type a minus Sph via ±; focus the L PD field and check that the bar does not cover it |
| German hyphenation of long compounds | UX-03 | Engine-specific hyphenation dictionaries | Live site at 320 px on a phone: no overflow, check hyphenation quality |
| ENG-09 with the compare lane on a phone | ENG-09 regression | Worker timing is not throttled in the proxy | Read the Technische Angaben timings on the Pixel after 10 edits |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
