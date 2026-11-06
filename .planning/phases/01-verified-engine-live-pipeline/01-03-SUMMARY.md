---
phase: 01-verified-engine-live-pipeline
plan: 03
subsystem: ui, i18n
tags: [walking-skeleton, de-AT, dom, timing, eng-09, smoke, axe]
requires:
  - 01-01 toolchain, parser, formatter, t(), smoke contract
  - 01-02 frozen evaluatePair / LensResult contract
provides:
  - index.html (lang de-AT shell, app-commit meta, Rx form, per-eye result table, adjacent disclaimer, tech details)
  - src/ui/main.js (only DOM tier; parse → evaluatePair → textContent render; timing readouts; WORST_CASE_BENCH_SPECS)
  - src/ui/style.css
  - page keys in src/i18n/de-AT.js (rx.*, frame.note, result.*, loc.*, basecurve.*, tech.*, footer.version)
  - test/bench/recompute.test.js (informational ENG-09 desktop bench, no timing assertion)
affects: [01-06, 01-07, 01-08, 01-09, 01-10, 01-11]
tech-stack:
  added: []
  patterns:
    - data-i18n / data-i18n-title attributes filled by t() at startup
    - textContent-only rendering (lint-enforced)
    - single WORST_CASE_BENCH_SPECS constant, copied once into the node bench
key-files:
  created: [index.html, src/ui/main.js, src/ui/style.css, test/bench/recompute.test.js]
  modified: [src/i18n/de-AT.js]
decisions:
  - "Smoke 'Vogel' vs D-01: the base-curve cell shows the chosen D1 with 'so gewählt, dass das Glas möglichst dünn wird' and then '(zum Vergleich: übliche Faustregel nach Vogel {vogelClampedD1})'. Vogel appears only as the reference value, never as the rule used; the disclaimer still never says 'Vogel-Regel'"
  - "%APP_COMMIT% appears once in index.html (the app-commit meta, per plan acceptance); #app-commit is filled from the meta by main.js, not by a second placeholder"
  - "If one Sph field is invalid, the other eye is still computed via evaluateLens; the recompute bench then falls back to −2,00 both eyes"
  - "Only RES-06 marked complete: RX-02 needs the axis field (° on axis), L10N-01 needs German diagnostic texts (raw codes still visible in result.notComputable until 01-10), ENG-09 needs the real-phone measurement, DEPL-01 needs the live site"
metrics:
  duration: 5min
  completed: 2026-11-06
  tasks: 2
  files: 5
---

# Phase 1 Plan 03: Minimal German Page Wired to the Engine Summary

A user types a paper-style Sph per eye and immediately sees the German echo and a real thick-lens result per eye (Mittendicke, dickste/dünnste Randdicke with location, Gewicht, Basiskurve with the D-01 rule plus the Vogel reference). The disclaimer sits next to the numbers, and "Technische Angaben" shows 50-run median/p95 for the current input and the fixed worst-case pair, the last input-to-render time, the user agent and the build commit. The 01-01 smoke contract is GREEN on desktop and 360 px mobile.

## Watch first

- **Raw diagnostic codes are visible when a lens is not computable** (`Dieses Glas lässt sich so nicht berechnen (Code FRONT_SAG_UNDEFINED).`). This is the plan's interim text; 01-10 replaces it with German explanations. Until then L10N-01 ("all visible text German") is not fully met.
- **Browser timings have 0.1 ms resolution** (Chromium coarsens `performance.now()` without cross-origin isolation), so the on-page medians are quantised. The node bench is finer but slower than the 01-02 per-lens figures (only 10 warm-up calls; see below). Neither is the ENG-09 phone measurement.
- `BLANK_EXCEEDS_STOCK` / `OC_OUTSIDE_OUTLINE` are still not emitted (carried over from 01-02); nothing in this plan needed them.

## Tasks

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Page shell, German dictionary keys, styles | ea654a9 | index.html, src/ui/style.css, src/i18n/de-AT.js |
| 2 | Wire parser → engine → render, timing readouts, desktop bench; smoke GREEN | 7ac6578 | src/ui/main.js, test/bench/recompute.test.js |

## Verification evidence

- `npm run lint`: exit 0.
- `npx vitest run --project unit`: 14 files, **156 tests passed**. `npx vitest run --coverage`: 156 passed, engine lines 97.75 %, branches 96.93 %.
- `npm run build && npm run test:e2e`: **14 passed** (7 smoke tests × `desktop` and `mobile`): no ≥400 responses, no failed or foreign requests, no CSP console errors, no serious/critical axe violations.
- Extra axe run (scratch spec, not committed) with `#tech` open and the OD field in the error state (`1.000,25`): no violations of any impact.
- Grep gates: `lang="de-AT"` 1, `%APP_COMMIT%` 1, `style=` 0, `<script>` 0 in index.html; `basecurve.rule.thinnest` 1, `basecurve.vogelRef` 1 (contains "Faustregel nach Vogel"), old rule names 0, `Stärke` 0 in de-AT.js; `innerHTML|outerHTML|insertAdjacentHTML` in src/ui 0; `tech.inputRender` 1 and `tech.timingWorst` 2 in main.js; no timing `expect` in the bench.
- `dist/index.html`: `lang="de-AT"`, `name="app-commit" content="dev"` and the CSP meta each present once; `find dist -path '*references*' -o -path '*.planning*'` prints nothing (T-01-06).

### Example result: −2,00 dpt per eye (rund 50/18, PD 32, CR-39), as rendered on the page (desktop Chromium)

| | R – rechtes Auge | L – linkes Auge |
|---|---|---|
| Echo | −2,00 dpt | −2,00 dpt |
| Mittendicke | 1,8 mm | 1,8 mm |
| Dickste Randdicke | 3,3 mm – schläfenseitig (außen) | 3,3 mm – schläfenseitig (außen) |
| Dünnste Randdicke | 2,9 mm – nasal (zur Nase) | 2,9 mm – nasal (zur Nase) |
| Gewicht (pro Glas) | 6,3 g | 6,3 g |
| Basiskurve | +0,50 dpt – so gewählt, dass das Glas möglichst dünn wird (zum Vergleich: übliche Faustregel nach Vogel +5,00 dpt) | same |

These match the 01-02 engine example (CT 1.8, etMax 3.2665 temporal, etMin 2.8625 nasal, 6.3115 g, D1 0.50, vogelClampedD1 5).

### Desktop timing readings (this machine, Chromium via Playwright, `vite preview` build)

- `#timing` (current input −2,00 both eyes, search included): **Median 0,80 ms**, p95 2,00 ms (50 runs).
- `#timing-worst` (+12,00, PD 10, both eyes): **Median 1,80 ms**, p95 3,70 ms (50 runs).
- `#timing-input`: 10,70 ms for the first (cold) update at page load; **4,10 ms** after typing `-2,00` into the OD field.

### `npx vitest run test/bench/recompute.test.js` (node 22, informational)

```
normal pair (−2,00 rund 50/18/32): median 2.316 ms, p95 3.171 ms (50 runs)
  OD: evaluations 29, iterations 0
  OS: evaluations 29, iterations 0
worst-case pair (+12,00 rund 50/18/PD 10): median 6.700 ms, p95 7.098 ms (50 runs)
  OD: evaluations 31, iterations 118
  OS: evaluations 31, iterations 118
```

The node figures are higher than both the browser readings and the 01-02 per-lens figures (0.35 / 0.93 ms). The likeliest reason is the short warm-up (10 calls, as planned) under the Vitest worker, but I did not verify that. Search cost matches 01-02 (29 / 31 evaluations, 0 / 118 iterations).

## Smoke test 3 vs D-01 (open item from 01-01)

Resolved as the plan specifies (lens-critic iteration-3 MINOR-7): `#result-od-basecurve` contains "Vogel" only inside `basecurve.vogelRef`, "(zum Vergleich: übliche Faustregel nach Vogel +5,00 dpt)". The rule actually used is always shown first as "so gewählt, dass das Glas möglichst dünn wird". The page never claims Vogel is the chosen curve, and the disclaimer still contains no "Vogel-Regel" (dictionary test green). The smoke test was not changed.

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 2 - Accessibility] Extra dictionary keys for labels.** `rx.eye`, `rx.sph.title`, `rx.sph.unit`, `rx.od.sph.label`, `rx.os.sph.label` and `result.status` were added. Each input has a visually hidden `<label for>` ("Sph rechtes Auge in Dioptrien"), so the accessible name includes the eye and the unit; `rx.sph.label` is the visible help line under the form. `data-i18n-title` fills the `<abbr title>` from the dictionary. Commit ea654a9.

**2. [Rule 1 - Consistency] Single `%APP_COMMIT%`.** The 01-01 note suggested the placeholder also sit inside `#app-commit`, but the plan acceptance requires exactly one occurrence and says the footer is read from the meta. The meta holds the placeholder; main.js copies it into `#app-commit`. The built HTML still contains the commit (in the meta) for verify-live. Commit ea654a9.

**3. [Rule 2 - Robustness] One invalid field does not blank the other eye.** The valid eye is computed with `evaluateLens` (what `evaluatePair` calls per eye); the invalid eye shows "–" and `result.inputMissing`. The bench uses −2,00 both eyes while any field is invalid. Commit 7ac6578.

## Requirements

| Requirement | Status | Why |
|---|---|---|
| RES-06 | **complete** | Persistent disclaimer adjacent to the result, says Lernhilfe / not a substitute for the optician, names the simplifications |
| L10N-02 | already complete (01-01) | all new strings come from de-AT.js |
| RX-02 | pending | parser covers the full text, but there is no axis field on the page yet (01-08) |
| L10N-01 | pending | raw diagnostic codes still visible in the not-computable text (01-10) |
| ENG-09 | pending | readouts exist; real-phone measurement on the live site still needed (01-11) |
| DEPL-01 | pending | site not deployed yet |

## Known Stubs

- Fixed skeleton inputs (rund 50/18, PD 32, CR-39, sphere only, automatic base curve), stated on the page in `frame.note`. Lifted by 01-06 … 01-09.
- `result.notComputable` shows the raw diagnostic code; 01-10 replaces it.
- `WORST_CASE_BENCH_SPECS` / `tech.timingWorst` are the skeleton-domain case; 01-10 Task 2 swaps them for the fuzz-domain worst case.

## Threat Flags

None. No fetch, storage or analytics; T-01-04 (no foreign requests, smoke afterEach), T-01-05 (textContent only, CSP meta in dist), T-01-06 (no references in dist) and T-01-13 (adjacent disclaimer, "Vorschau" frame note) are mitigated as planned.

## Self-Check: PASSED

- index.html, src/ui/main.js, src/ui/style.css, test/bench/recompute.test.js exist; src/i18n/de-AT.js modified.
- Commits ea654a9 and 7ac6578 are present in `git log`.
