---
phase: 02-lay-first-german-input-results-comparison
plan: 02
subsystem: results-ui, layout
tags: [expert-view, zwischenwerte, responsive, summary-bar, sticky, hyphenation, de-AT]
requires: ["02-01"]
provides:
  - "src/ui/expert.js: initExpert, isExpert, renderZwischenwerte, clearZwischenwerte, EXPERT_CELLS (baseCurveText moved here)"
  - "src/ui/results.js repaintFromLast(): rewrites only the location spans on an Expert toggle"
  - "src/state/compare.js uniformEdge(m)"
  - "src/ui/summary-bar.js: initSummaryBar, updateSummaryBar"
  - "Page skeleton .layout / .col-inputs / .col-results / .col-full, #view-slot and #bar-view-slot (empty, hidden), #compare (empty)"
  - "e2e/expert.spec.js, e2e/layout.spec.js"
affects: [02-03 (Rx table reflow at 320 px), 02-04 (frame section), 02-07 (material section after frame, fills #compare), 02-10 (more Expert blocks, extends expert.hint), phase 3 (#view-slot, #bar-view-slot)]
tech-stack:
  added: []
  patterns: [Expert blocks hidden not removed, toggle without recompute, bar repeats painted strings, overflow-wrap anywhere as the overflow guarantee]
key-files:
  created:
    - src/ui/expert.js
    - src/ui/summary-bar.js
    - e2e/expert.spec.js
    - e2e/layout.spec.js
  modified:
    - index.html
    - src/ui/style.css
    - src/ui/results.js
    - src/ui/main.js
    - src/state/compare.js
    - src/state/compare.test.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/smoke.spec.js
    - e2e/worker.spec.js
    - e2e/results.spec.js
decisions:
  - "[02-02]: Toggling Experten-Ansicht rewrites only the three location spans from the painted codes (repaintFromLast); it never calls schedule() or the compute client"
  - "[02-02]: The summary bar's accessible name is a visually hidden 'Zum Ergebnis:' plus the visible text. The UI-SPEC aria-label sentence failed axe label-content-name-mismatch (WCAG 2.5.3), so it was dropped"
  - "[02-02]: The uniform-edge rule moved to compare.js uniformEdge(m) (roundMm comparison, equivalent to the fmtMm string comparison by the existing sweep and a new property test)"
  - "[02-02]: expert.hint names only what the switch shows today (the Zwischenwerte); later plans extend it with their Expert blocks"
  - "[02-02]: Only ANA-02 is marked complete. UX-02 still lacks thickness overrides, asphere, cross-section and heatmap. UX-03 still lacks the phase-3 lens view and the real-iPhone check"
metrics:
  duration: 25min
  completed: 2026-11-07
  tasks: 3
  files: 15
---

# Phase 2 Plan 02: Experten-Ansicht and responsive layout Summary

The Simple view now shows only the lay cards. The Experten-Ansicht switch (`role="switch"`, off on every load, nothing persisted) reveals the Zwischenwerte per eye: Dezentration, Dickster Rand, Basiskurve with rule and Vogel, D2, radii, sags, binding constraint and weight in 0,1 g. The page has no horizontal scroll from 320 px up. On desktop it has two columns with a sticky result column. Below 900 px a dark bar at the bottom reads "R 4,6 mm · 7 g | L 4,6 mm · 7 g".

## Things to know first

- **The Rx table at 320 px now breaks words mid-word** ("Aug|e", "PD (mm, je Auge)" over four lines). Before this plan the page overflowed instead (layout.spec was RED on load at 320 px). `overflow-wrap: anywhere` is the guarantee D-21 asks for, and the old `th { overflow-wrap: break-word }` override was removed because it allowed the overflow. The proper fix is the 02-03 card reflow below 560 px (D-03). Screenshot: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/shot-320.png`.
- **Reading order is only partly D-18.** Header switch → banner → Rezept → **Material → Fassung** → Ergebnis → Vergleich slot → Experten-Analyse → Hinweis → Technische Angaben. Material and frame keep their phase-1 order: 02-07 places `#material-section` after `#frame-section` (02-07-PLAN step 3).
- **Sags are shown at 0,1 mm** (fmtMm), e.g. "vorne 0,2 mm". That is coarse for experts. A finer format would be a new formatter and was not requested.

## Task 1: Experten-Ansicht (commit febaeee)

- `#expert-analysis` has `data-expert hidden`. It is never created or removed by script. With the switch off, `#result-od-dec` reads '3,0 mm', `-etmax` '4,6 mm' and `-basecurve` contains 'Vogel' (expert.spec, via `getElementById().textContent`).
- Example values: dec OD 3,0 / OS 3,5 mm. Binding: 'Die Mittendicke ist durch den Mindestwert festgelegt.'. Weight 6,9 g, while the card shows 7 g. R +3,00: thick-loc 'in der Mitte (optischer Mittelpunkt)', Dickster Rand '2,8 mm', 'oben (superior)'. The uniform-edge setup reads 'am ganzen Rand (rundum gleich)'.
- No compute on toggle: an init script wraps `Worker.prototype.postMessage`. After the first settle, `#compute-mode[data-mode="worker"]` and `__computeMsgs > 0`. The count is unchanged across on → off.
- An empty OS stays empty across the toggle. The stale mark survives the toggle: `slowWorker(2000)`, `data-stale` stays on `-thick` and `-dec`, and the status stays 'rechnet …'.
- Axe: `role="switch"` passes. Zero serious/critical on `#expert-analysis` and on the whole page with the switch on, desktop and mobile. The A8 fallback was not needed.
- smoke.spec: the four base-curve tests and the dec test now check `#expert` and assert visibility first. The phase-1 assertions are unchanged (Vogel; dec 3,0 → 7,0 mm).
- worker.spec 'nothing moves': `SELECTORS = ['#result-od-card', '#result-os-card', '#calc-status', '#disclaimer']`, with a comment explaining why.
- `PERF=1 npx playwright test --project=perf --list` lists 1 test. OD_CELLS is unchanged.

## Task 2: RED (commit 38b2ca8)

16 of 18 failed: no `#summary-bar`, no `.col-results`, no viewport hint, and 320 px overflowed on load. The 360 px "never scrolls" case already passed.

## Task 3: GREEN (commit ce3a220)

- Layout per UI-SPEC: `minmax(0,1fr) 400px`, 32 px gap, max 1152 px (header and footer use the same width). Sticky only under `(min-width: 900px) and (min-height: 600px)`. Page padding is 16/24/32 px.
- The bar repeats the card strings stored in `displayed[eye].thickText/weightText`. It shows "rechnet …" and the dotted stale mark while any eye is stale. It hides via IntersectionObserver while `#result` intersects, and is off at ≥ 900 px. A tap scrolls to the result (smooth unless reduced motion) and focuses `#result-title` (tabindex -1). It is not a live region.
- R +3,00 / L +2,75 → 'R 3,9 mm · 7 g | L 3,7 mm · 7 g'.
- A focused `#rx-os-pd` at the bottom edge ends at or above the bar's top (scroll-padding-bottom 72 px).

## Deviations from Plan

1. **[Rule 1 - a11y bug] Bar accessible name.** The UI-SPEC `aria-label` sentence ("Zum Ergebnis: rechts dickste Stelle …") failed axe `label-content-name-mismatch` on mobile (WCAG 2.5.3). The bar now starts with a visually hidden `bar.jump` 'Zum Ergebnis:' and has no aria-label. layout.spec asserts the accessible name is `Zum Ergebnis: Dickste Stelle · Gewicht R 4,6 mm · 7 g | L 4,6 mm · 7 g`. The key `bar.aria` was not added.
2. **[Rule 3] Hyphens-off test without addStyleTag.** The app CSP (`style-src 'self'`) blocks `page.addStyleTag`, and the guard records a CSP console error. The test sets `document.body.style.hyphens = 'manual'` (single style properties are allowed, RESEARCH Pitfall 7). It asserts that computed `hyphens` is 'manual' and `overflowWrap` is 'anywhere', then checks scrollWidth.
3. **[Rule 3] `uniformEdge(m)` in compare.js.** results.js still needed `etMax.value` for the uniform rule, which conflicts with the acceptance grep and the compare.js "no card code reads etMax.value" rule. The rule moved to compare.js, with 4 unit tests (fast-check seed 23, 500 runs against the fmtMm strings).
4. **[Rule 1] expert.hint is accurate for today.** The UI-SPEC hint lists Mindestdicken, asphere and cross-section, none of which exist yet.
5. **[Rule 3] results.spec.js changed** (not in files_modified). With the soft hyphen in 'Pupillen\u00ADdistanz', `toContainText('Pupillendistanz')` fails. Those two assertions now compare `plain()` text.
6. **Removed orphan keys** created by this change: `result.dec`, `result.etmax`, `result.basecurve`. `result.ct`, `result.etmin` and `result.weight` were already unused after 02-01 and are left as they are (mention only).
7. **Soft hyphens:** Pupillen·distanz (two keys) and Dezen·tration. Experten·ansicht does not occur as one word: the copy is the hyphenated "Experten-Ansicht", so nothing was added.
8. **expert.spec was written together with the implementation**, so Task 1 has no separate RED run. The plan specifies one feat commit for Task 1.
9. `e2e/worker.spec.js` needed no Task 3 change. The disclaimer move did not alter the measured boxes.

## Known Stubs

- `#view-slot`, `#bar-view-slot`: empty and hidden by design (phase 3).
- `#compare`: empty by design (02-07 fills it).

## Threat Flags

None. No storage (the grep on src/ for localStorage, sessionStorage, indexedDB and document.cookie is empty), textContent only, no style attributes, CSP unchanged, no new network surface.

## Verification (plan end, real output)

- `npm run lint`: clean.
- `npm run test:coverage`: 27 files, 1124 tests passed; All files 98,47 % stmts, 96,42 % branch, 100 % funcs, 99,18 % lines.
- `npm run build`: built in 106 ms.
- `npm run test:e2e`: 126 passed (1,0 m), desktop and mobile.
- Acceptance greps: interactive-widget 1, view-slot 1, bar-view-slot 1, `role="switch" id="expert"` 1, `class="result-table"` 0, `id="result-od-dec"` 1, break-word 0, aria-live in summary-bar.js 0, raw U+00AD in de-AT.js 0, `baseCurveText|etMax.value` in results.js (code lines) 0.

## Self-Check: PASSED
