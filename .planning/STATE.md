---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-12-PLAN.md
last_updated: "2026-11-06T16:14:03.449Z"
last_activity: 2026-11-06
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 14
  completed_plans: 11
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-06)

**Core value:** A non-expert can type in their paper prescription and, within a few minutes, see correctly computed lens thickness and weight for their frame — and how material or frame choice changes it.
**Current focus:** Phase 01 — verified-engine-live-pipeline

## Current Position

Phase: 01 (verified-engine-live-pipeline) — EXECUTING
Plan: 12 of 14 (gap closure; 01-11, 01-13, 01-14 remain)
Status: Ready to execute
Last activity: 2026-11-06

Progress: [████████░░] 79%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 6min | 3 tasks | 17 files |
| Phase 01 P02 | 14min | 3 tasks | 20 files |
| Phase 01 P03 | 5min | 2 tasks | 5 files |
| Phase 01 P04 | 3min | 2 tasks | 4 files |
| Phase 01 P06 | 7min | 3 tasks | 10 files |
| Phase 01 P07 | 9min | 3 tasks | 11 files |
| Phase 01 P08 | 8min | 2 tasks | 12 files |
| Phase 01 P09 | 4min | 2 tasks | 8 files |
| Phase 01 P10 | 14min | 3 tasks | 10 files |
| Phase 01 P12 | 45min | 3 tasks | 17 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: GitHub Pages deploy (Actions, SHA-pinned) and minimal German page in Phase 1; enabling Pages (Source: GitHub Actions) pre-authorized by user 2026-11-06 — explicit Phase 1 step.
- [Roadmap]: German-only UI (de-AT) from Phase 1; all strings from one dictionary.
- [Roadmap]: Engine (ENG-*) built and validated in Phase 1, before any 3D mesh work (Phase 3).
- [Roadmap]: Expert view (UX-02) and 2D cross-section (ANA-01) land in Phase 2; Phase 3 adds the heatmap into the existing Expert view.
- [Roadmap]: Every phase gated by `lens-critic` (plan + result): PASS or user-accepted findings.
- [Phase 01]: [01-01]: Parsers normalise -0 to +0; t() interpolation tested via vi.mock dictionary (no test-only keys ship)
- [Phase 01]: [01-01]: e2e smoke runs against vite preview (dist/); build before test:e2e locally and in CI
- [Phase 01]: [01-01]: Only L10N-02 marked complete; RX-02, L10N-01, DEPL-01/03/04 stay pending until page, CI and live deploy exist
- [Phase 01]: [01-02]: Volume quadrature marches a monotone outline edge pointer (CCW, star-shaped about boxing centre); ~0.14 ms/lens metrics on desktop
- [Phase 01]: [01-02]: No requirement marked complete; ENG-02/04/05/06/07, MAT-01/02 full text needs cyl, all materials, German text or Expert view
- [Phase 01]: [01-02]: BLANK_EXCEEDS_STOCK / OC_OUTSIDE_OUTLINE are catalogued but not yet emitted; emitter belongs to 01-03/01-10
- [Phase 01]: [01-03]: Base-curve cell shows the thinnest rule first and Vogel only as '(zum Vergleich: übliche Faustregel nach Vogel …)'; smoke test 3 unchanged, disclaimer still has no Vogel-Regel
- [Phase 01]: [01-03]: Only RES-06 marked complete; RX-02 (axis field), L10N-01 (German diagnostic texts, 01-10), ENG-09 (phone) and DEPL-01 (live) stay pending
- [Phase 01]: [01-04]: Only DEPL-04 marked complete; DEPL-02/03 need the first real CI run (01-05), DEPL-01 the live site
- [Phase 01]: [01-04]: Bypass strings (continue-on-error, always(), failure(), cancelled(), || true) banned file-wide; pipe ban only on build run lines (verify-live wait loop needs curl | grep)
- [Phase 01]: [01-06]: Trivex Abbe 45/45 from Z00981.FS1; 00617.FS1 58/56 treated as copy error (comment)
- [Phase 01]: [01-06]: No requirement marked complete: MAT-01 Abbe recorded but not consumed; MAT-02 needs Expert view; ENG-02/04 need cyl; ENG-08 needs tiers 3/4
- [Phase 01]: [01-06]: All 143 Zeiss fixture rows machine-matched to pdftotext output (0 mismatches); favicon data: icon added for DEPL-01, orchestrator closes it after the next deploy
- [Phase 01]: [01-07]: Pilot weight squared (no corner at 3/9 o'clock); lower half widened temporally, orientation unverified (no pilot image in references/), open for 01-11
- [Phase 01]: [01-07]: computeMetrics breaks exact etMax/etMin ties toward larger y so OD/OS labels agree; frameOutline memoised (about 1.8 -> 0.2 ms/lens desktop)
- [Phase 01]: [01-07]: Only FRAME-01 and ENG-05 marked complete; ENG-04 needs cyl (01-08), ENG-06 stays pending
- [Phase 01]: [01-08]: Pitfall-5 table in PITFALLS.md reproduces barrel−meridional (0.03/0.16/0.10/0.39); implemented tyre−meridional is 0.014/0.013/0.021/0.086 mm max; table left unchanged, values in 01-08-SUMMARY
- [Phase 01]: [01-08]: ENG-01/02/03/04 marked complete; ENG-08 pending tier 4 (01-10); ENG-05 now also proven for oblique cylinders on both eyes (point reflection + oblique pair)
- [Phase 01]: [01-08]: Oracle worst element error 1.0e-3 dpt (design, 300 runs) and 8.6e-4 dpt (evaluateLens, 100 runs); thin-lens design rejected at 0.56 dpt
- [Phase 01]: [01-09]: Blank Zyl = 0; Achse required only when Zyl ≠ 0 and never defaulted; a non-blank invalid Achse blocks the eye even with Zyl 0
- [Phase 01]: [01-09]: RX-02 and RX-03 marked complete (axis field now on the page); L10N-01 pending until 01-10 diagnostic texts
- [Phase 01]: [01-10]: Status cell label: 'Nicht herstellbar' only for FRONT/BACK_SAG_UNDEFINED, 'Nicht berechenbar' for internal-limit errors, 'Hinweis' for warnings; info diagnostics not shown in phase 1
- [Phase 01]: [01-10]: Grenzfall = fuzz argmax by pair CT iterations (+0,50 −0,50 × 81, 1.60, panto 58×54/15, PD 26, FH 0, 283 it.); the +7,50 −5,75 × 148 candidate is slightly slower on desktop, ENG-09 phone check should time both
- [Phase 01]: [01-10]: ENG-07, ENG-08, L10N-01 marked complete; MAT-02 (Expert view) and ENG-06 (sags) stay pending
- [Phase 01]: [01-12]: Automatic back never convex (max(D2a, D2b) <= 0), automatic range +0,50 ... +14,00 dpt (D-A, US4185897), boundary bisection for failing plus lenses
- [Phase 01]: [01-12]: D-C tie-break: flattest front lo = max(0,5, m, 0) if J(lo) <= J_min + 0,10 mm; trigger widened to best.D1 > lo + 0,05 so the flattest-within-tau truth holds
- [Phase 01]: [01-12]: Grenzfall = +10,75 -1,00 x 89, 1,67, rechteckig 43x43/21, PD 36, FH 0 (slowest of fuzz top 5, 12,5 ms node desktop); rescan-path lenses (~0,07 % of eyes, ~20,6 ms/pair, ~170 evaluations/eye) raised as ENG-09 finding

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Phone performance (ENG-09) is extrapolated from desktop (0.49 ms/lens); needs real-device measurement on the live site.
- [Phase 1]: Textbook worked examples (Jalie; Brooks & Borish) and ISO 8980-1 tolerances not accessible — validation relies on analytic cases, Zeiss charts and ray-trace oracle.
- [Phase 2]: No citable conic constants for real aspheric lenses — aspheric (MAT-05) is a generic parametric model.
- [Phase 2]: Unverified: iOS decimal keypad minus key; German hyphenation support; Austrian terms (Basiskurve vs Durchbiegung).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-11-06T16:13:55.176Z
Stopped at: Completed 01-12-PLAN.md
Resume file: None
