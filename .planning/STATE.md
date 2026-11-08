---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-06-PLAN.md
last_updated: "2026-11-08T13:46:06.809Z"
last_activity: 2026-11-08
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 54
  completed_plans: 43
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-06)

**Core value:** A non-expert can type in their paper prescription and, within a few minutes, see correctly computed lens thickness and weight for their frame — and how material or frame choice changes it.
**Current focus:** Phase 03 — 3D lenses & frame

## Current Position

Phase: 03 (3D lenses & frame) — EXECUTING
Plan: 7 of 17
Status: Ready to execute
Last activity: 2026-11-08

Progress: [█████░░░░░] 50% (2 of 4 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 37 (phase 1: 15, phase 2: 22)
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 15 | - | - |

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
| Phase 01 P13 | 10min | 3 tasks | 15 files |
| Phase 01 P14 | 15min | 4 tasks | 15 files |
| Phase 01 P15 | 50min | 6 tasks | 21 files |
| Phase 02 P01 | 25min | 3 tasks | 19 files |
| Phase 02 P02 | 25min | 3 tasks | 15 files |
| Phase 02 P03 | 20min | 2 tasks | 19 files |
| Phase 02 P22 | 25min | 2 tasks | 3 files |
| Phase 02 P04 | 36min | 2 tasks | 20 files |
| Phase 02 P05 | 25min | 2 tasks | 3 files |
| Phase 02 P06 | 16min | 2 tasks | 7 files |
| Phase 02 P07 | 45min | 3 tasks | 16 files |
| Phase 02 P08 | 80 min | 3 tasks | 14 files |
| Phase 02 P09 | 40 min | 4 tasks | 14 files |
| Phase 02 P10 | 22min | 2 tasks | 18 files |
| Phase 02 P11 | 35min | 2 tasks | 24 files |
| Phase 02 P12 | 50min | 2 tasks | 24 files |
| Phase 02 P13 | 27min | 2 tasks | 17 files |
| Phase 02 P14 | 24min | 2 tasks | 11 files |
| Phase 02 P16 | 14min | 2 tasks | 12 files |
| Phase 02 P17 | 20min | 2 tasks | 9 files |
| Phase 02 P19 | ~70 min | 3 tasks | 12 files |
| Phase 02 P20 | 45 min | 3 tasks | 8 files |
| Phase 02 P21 | 15 min | 2 tasks | 2 files |
| Phase 03 P01 | 15min | 2 tasks | 8 files |
| Phase 03 P02 | 20min | 3 tasks | 6 files |
| Phase 03 P05 | 55 min | 2 tasks | 17 files |
| Phase 03 P06 | 45min | 2 tasks | 9 files |

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
- [Phase 01]: [01-13]: MAT-01 reworded to 'uses ne and density, exposes νe'; νe carried in intermediates.abbe and shown, not used in any computation
- [Phase 01]: [01-13]: MAT-02 text = +0,50…+14,00 (D-A, US4185897) capped by FRONT_RADIUS_MARGIN_MM, flattest within τ 0,10 mm (D-C), back principal powers ≤ 0; Expert-view clause moved to UX-02
- [Phase 01]: [01-13]: Base-curve cell shows the raw Vogel value plus a 'begrenzt auf' clamp note; axis input that is not whole unsigned degrees gets PARSE_AXIS_INVALID
- [Phase 01]: [01-14]: Proxy 4x FAIL (rescan pair 178 ms, Grenzfall 64 ms; host BenchmarkIndex 2221); user decision web-worker: Web Worker + RAIL-based ENG-09 restatement in gap plan 01-15
- [Phase 01]: [01-15]: Engine in a module Web Worker (per-eye seq latest-wins plus isCurrent re-check in the paint frame, one job in flight with compute first, sync fallback, 10 s suspension-aware watchdog); #result[data-pending] settled signal; ENG-09 restated to RAIL/INP (a)-(d), still Pending
- [Phase 01]: [01-15]: 4× proxy fails (a) as measured (54,8 ms extreme run); diagnostics: multi-task measurement artifact, no LoAF frame > 50 ms, real input frame 14,5/16,3 ms; Task 6 decision phone-decides, ENG-09 (a) open finding for 01-11
- [Phase 02]: [02-01]: etMax/etMin location ties within TIE_TOL_MM = 1e-9 mm go to the larger y; values stay the exact running max/min (bitwise)
- [Phase 02]: [02-01]: L/R callout reads the rounded values and the spec recorded with each painted result (under isCurrent); lrCause ignores the axis without cyl and treats 0 = 180
- [Phase 02]: [02-01]: RES-05 left Pending (example done; Rx/frame presets and the overwrite confirm come later); RES-01, RES-04, UX-05 marked complete
- [Phase 02]: [02-02]: Toggling Experten-Ansicht rewrites only the location spans (repaintFromLast); no compute, no stale-mark change
- [Phase 02]: [02-02]: Summary bar accessible name = hidden 'Zum Ergebnis:' + visible text; the UI-SPEC aria-label failed axe label-content-name-mismatch (WCAG 2.5.3)
- [Phase 02]: [02-02]: Only ANA-02 marked complete; UX-02 (more Expert blocks) and UX-03 (phase-3 lens view, iPhone check) stay Pending
- [Phase 02]: [02-03]: Card-mode Rx header stays visible as a term row (tip buttons must not be focusable-but-invisible); only the Auge cell is hidden
- [Phase 02]: [02-03]: Rx model range checked on the minus-cylinder form; out-of-model texts take {min}/{max} from RX_RANGES
- [Phase 02]: [02-03]: Only field-message display is debounced (600 ms / blur); compute stays per input frame; blocked card shows 'Eingabe unvollständig …' until the message is due
- [Phase 02]: [02-03]: UX-01 not complete yet: only Sph/Zyl/Achse/PD tips exist
- [Phase 02]: [02-04]: PD conflicts and questions never guess: a blocking Hinweis per field, resolvePd.blockedBy names the field that blocks each eye
- [Phase 02]: [02-04]: An invalid or swapped temple stamp blocks both eyes; the estimate for B is never written into a focused or emptied B field
- [Phase 02]: [02-04]: #pd-note and #b-note appear only for eyes computed with the assumed PD / estimated B
- [Phase 02]: [02-04]: UX-01 not complete: tips for A, B, DBL, Stempel added; Brechungsindex, Basiskurve, Mittendicke, Randdicke, Dezentration pending
- [Phase 02]: [02-05]: UI module dependency order is main -> timing -> pipeline; pipeline.js imports neither; timing hooks injected via initPipeline, update via initTiming (no import cycle)
- [Phase 02]: [02-06]: Compare lane in compute-client: pump order main -> one compare job -> bench; generation bumped only by a changed main request; a timed-out compare job is re-queued for the sync fallback (runCompareNow)
- [Phase 02]: [02-06]: materialRows uses one eye (thicker displayed thickest of the selected material, tie -> OD) and counts only computed selected eyes; no computed selected eye -> []
- [Phase 02]: [02-07]: Compare table paints only after the main result for the current input is painted; compare job key = the job's own spec pair (cache reuse when switching material)
- [Phase 02]: [02-07]: Page requests the comparison when !client.isCompareCurrent(compareGen) after client.request(); tip-ct/tip-et only in the right-eye card
- [Phase 02]: [02-08]: Configuration-A job on the compare lane under its own 'configA:' key, queued first, current shared Rx; rebuilt on every changed main request and on start
- [Phase 02]: [02-08]: While 'Vorher' is shown, main deliveries update shown[] but do not repaint the cards; cards stay stale-marked until A for the same input is painted (T-02-21)
- [Phase 02]: [02-08]: A and B both converted with displayedValues (card rounding) from LensResults; results.js displayed cannot be B's source while A is shown
- [Phase 02]: [02-08]: Test busy windows use holdWorker (test-held worker messages), not timers, when the test does unbounded work (axe) inside the window
- [Phase 02]: [02-09]: The two-column grid lives in .layout-cols; .col-full sits outside it so the sticky results column cannot cover the disclaimer (a sticky box is held inside its parent)
- [Phase 02]: [02-09]: Preset 'own values' = non-empty fields that differ from what the page wrote last (example or preset); for frame chips typed A/B/DBL not set by a preset. Presets in a row never ask
- [Phase 02]: [02-09]: MAT-02 monotonicity split into 12 per-case tests with per-case observed sample floors (sum 3188); same sweeps and assertion
- [Phase 02]: 02-10: the automatic base curve next to a manual one comes from one autoBc compare-lane job (same specs, baseCurve null)
- [Phase 02]: 02-10: MANUAL_BACK_CONVEX is the only warning that shows its suggestion (results.js WARN_SUGGEST)
- [Phase 02]: 02-11: automatic base curve stays chosen at k = 0; an aspheric front only raises D1 minimally (D1min(ct)) to keep the back non-convex
- [Phase 02]: 02-11: rim depth is display-only (edgeBeyondRim on painted metrics), never in the LensSpec; empty field = 3,0 mm assumed, invalid = no line
- [Phase 02]: 02-12: with Eigenes Material its own minimum fields replace the Glas-Einstellungen minimums (hidden); empty custom minimum = nearest listed material prefill; switch back on never re-selects custom
- [Phase 02]: 02-13: meridianProfile returns NO_CHORD whenever the OC is outside the outline; profile jobs run last on the compare lane, Expert-only, requested from the compare paint
- [Phase 02]: 02-13: RES-03 marked complete (numbers 02-08 + cross-section A/B overlay); no VIZ requirement asks for a 3D A/B view
- [Phase 02]: Rx preset chips moved below the Rx table (phone first screen); horizontal chip scroller rejected (WCAG 1.4.10 Note 2)
- [Phase 02]: Querschnitt figure is a reserved 5:2 box (120-240 px) plus pending table rows: no layout shift
- [Phase 02]: ENG-09 proxy findings ENG09-PROXY-1..4 (4x case A input max 19,5-19,9 ms vs 16,30 in 01-15) go to 02-15; UX-03 left Pending (lens view is phase 3)
- [Phase 02]: 02-16: lay 'Dünnste Stelle' = thinnest(m) = min(CT, etMin), tie → centre; thinnest edge kept as Zwischenwert 'Dünnster Rand' plus a 'Rand ab …' card line (lens-critic B1)
- [Phase 02]: 02-17 M2: summary bar shows a 'Vorher (A):' prefix instead of auto-switching the toggle (WCAG 3.2.2 spirit)
- [Phase 02]: 02-18 M3: empty-Sph message only after the user edited that eye (trusted input, '±', 'übernehmen'; no clearDirty); field-message paints wait for the click of the current pointer gesture (afterGesture), keyboard blur paints at once
- [Phase 02]: 02-19: long property tests split via deterministic fc.sample chunks (seed kept); material intro tie wording via shownEye; RES-03/UX-02/UX-03 Pending as Phase 2 + 3
- [Phase 02-20]: compare start deferred to a MessageChannel task posted after the input frame's end stamp (MJ-1); paintCompare waits while a start is queued (m-c)
- [Phase 02-20]: ENG-09 (a) 4x proxy FAIL in 3/3 runs after the move (case A max 21,7/19,1/20,5, case B 23,3/24,9/21,8 ms); ENG-09 Pending; lens-critic M4 stays an open MAJOR for explicit user acceptance at 02-15; trace: 10-16 ms of each 4x window is a Playwright DevTools-session task
- [Phase 02]: [02-21]: post-gap gate green at ac2aa94; 24/24 trace rows + ENG-09 row pass with a value-asserting test each; M4/ENG-09 stays an open MAJOR for the user at 02-15
- [Phase 02]: [02-22]: ENG-09 proxy uses the quiet method (user decision 'Fix the measurement'; no DevTools command inside a measured frame, trace-proven 0 DevToolsSession tasks); 4× proxy (a) PASS 3/3 (case A max 7,4/10,0/8,4, case B 9,1/8,4/7,6 ms), legacy re-run 19,9/19,6 ms FAIL; ENG-09 stays Pending for the 02-15 phone check
- [Phase 03]: [03-01]: bevel rule '1:2' (apex t/3 from the front, Essilor US 8 388 133 B2) for all lenses [ASSUMED]; rim spans apex ± D/2 (A1); 'bündig' ≤ 0,05 mm
- [Phase 03]: [03-01]: frontLeadMm (front vertex ahead of the rim front face) shown as its own Expert line; example OD 0,5152 / OS 0,5282 mm at D 3; edgeBeyondRim and frame.rim.over removed (deliberate Phase-2 change)
- [Phase 03]: [03-02]: lens mesh = 64 rim-graded rings (g 2,5) x 720 spokes about the boxing centre, outer ring = engine outline; 46 081 vertices/surface, Uint16 indices; D-04(a) worst 1,33e-6 mm, build 12,7 ms/lens (Node desktop)
- [Phase 03]: [03-02]: D-04(c) strict worst 0,0074 mm; low-index custom scan worst 0,0231 mm of the documented 0,025 (ne 1,43, -6 -3 x 45, rechteckig 62x55/14 PD 25); VIZ-01 stays Pending until 03-05 draws it
- [Phase 03]: 03-05: e2e specs not about the 3D view run without it (without3d); view/layout/a11y opt in — SwiftShader CPU rendering starved parallel timing tests
- [Phase 03]: 03-05: lens buffer pool cap 3 spare sets per slot (bounded 4 sets/slot), not refill-when-empty
- [Phase 03]: 03-05: mesh client watchdog gets the compute-client hidden/late re-arm rule plus resume()
- [Phase 03]: 03-06 (D-14 revised, MAJOR 5): below 900 px #view-slot moves after section#result (view-place.js); >= 900 px stays first in .col-results
- [Phase 03]: 03-06: view.loadFailed drops 'darunter' because on phones the values sit above the view (UI-SPEC copy to amend)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: ENG-09 (restated 01-15, still Pending): engine now in a Web Worker; 4× proxy (a) measured fail. The 54,8 ms extreme-run value is a multi-task artifact (no LoAF frame > 50 ms, Event Timing max 32 ms); the real 4× overshoot is the input frame (14,5 ms median / 16,3 ms max for plain edits, frame gaps 21–30 ms while typing unpaced). User decision phone-decides: the real phone on the live site (01-11) decides; if it also misses, a small optimisation plan follows.
- [Phase 1]: Textbook worked examples (Jalie; Brooks & Borish) and ISO 8980-1 tolerances not accessible — validation relies on analytic cases, Zeiss charts and ray-trace oracle.
- [Phase 2]: No citable conic constants for real aspheric lenses — aspheric (MAT-05) is a generic parametric model.
- [Phase 2]: Unverified: iOS decimal keypad minus key; German hyphenation support; Austrian terms (Basiskurve vs Durchbiegung).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-11-08T13:46:06.804Z
Stopped at: Completed 03-06-PLAN.md
Resume file: None
