# Roadmap: Eyeglass Prescription — 3D Lens & Frame Simulator

## Overview

The journey runs from numbers to pictures. Phase 1 builds and validates the pure-JS optics engine and ships it behind a minimal German page on GitHub Pages through a gated Actions pipeline, so the site is live and testable on a real phone from day one. Phase 2 delivers the core value: a lay user types in the paper prescription in German, picks frame and material, and sees understandable thickness and weight with mm/g comparisons, plus the Expert view with the 2D cross-section. Phase 3 adds the 3D lenses and frame on top of the already-verified numbers, including the thickness heatmap. Phase 4 finishes with the ray-traced "Durchblick" refraction view and offline support.

Every phase is gated by the project-local `lens-critic` agent (`.claude/agents/lens-critic.md`): it reviews the phase plan before execution and the phase result after execution. A phase is complete only with verdict PASS (zero BLOCKER/MAJOR) or with remaining findings explicitly accepted by the user.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Verified Engine & Live Pipeline** - Pure-JS optics engine with tiered validation, gated GitHub Actions deploy to Pages, minimal live German result page (completed 2026-11-07)
- [x] **Phase 2: Lay-First German Input, Results & Comparison** - Paper-shaped Rx entry, frame and material choice, plain-German results, mm/g comparison, Expert view with 2D cross-section, accessibility
- [ ] **Phase 3: 3D Lenses & Frame** - Procedural lens meshes and parametric frame from engine data, camera presets, glass impression, thickness heatmap, smooth re-meshing on phones
- [ ] **Phase 4: Refraction View & Offline** - Ray-traced "Durchblick" view through the real lens surfaces, graceful mobile degradation, offline service worker with update prompt

## Phase Details

### Phase 1: Verified Engine & Live Pipeline

**Goal**: Correct, sourced lens numbers exist and are publicly reachable: the optics engine computes both lenses per eye and is proven by tiered tests, and every push to `main` that passes lint, tests, build and smoke test deploys a German page to https://ainxtgendev.github.io/Eyeglass-Prescription/.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, ENG-09, MAT-01, MAT-02, RX-02, RX-03, FRAME-01, L10N-01, L10N-02, RES-06
**Success Criteria** (what must be TRUE):

  1. Opening https://ainxtgendev.github.io/Eyeglass-Prescription/ on desktop and on a phone shows a German (`lang="de-AT"`) page with no missing assets, the persistent disclaimer, and a numeric per-eye result (centre thickness, max/min edge thickness with location, weight, base curve and the rule used) for a Rx typed in with comma decimals or plus-cylinder (both cylinder forms shown), a chosen material and a chosen frame shape (Rund, Rechteckig, Panto, Pilot).
  2. A push to `main` with a failing lint rule, unit test, build or browser smoke test does not deploy; a passing push updates the live site. Actions are SHA-pinned, npm deps exact-pinned, and an engine file importing `three` or DOM APIs fails CI.
  3. The engine test suite passes and demonstrates: back-vertex-power round trip within 0,01 dpt across the input range, true-torus back surface, ray-trace oracle reproducing Sph/Zyl/Achse, spherical manufacturer-chart rows within ±0,20 mm after tool-index conversion, asymmetric nasal/temporal edges from decentration, per-eye (not mirrored) left lens, and property tests for symmetry/monotonicity. Material index, density and Abbe values carry source citations in code.
  4. An impossible lens (e.g. −12,00 / −6,00 × 10 in a 62×55 frame, CR-39 — no base curve in +0,50…+14,00 dpt computes it) yields a coded diagnostic with a plain-German explanation and suggestion instead of numbers, and all visible text and messages come from the `de-AT` dictionary.
  5. Typing never freezes: both lenses are computed in a Web Worker (direct computation as a stated fallback), and ENG-09 as restated 2026-11-06 (user decision "Worker + RAIL target"; RAIL https://web.dev/articles/rail, INP https://web.dev/articles/inp) is measured and recorded:
     - (a) every main-thread task per input, including style, layout and paint, < 16,7 ms;
     - (b) input to next paint ≤ 200 ms for every edit;
     - (c) canonical normal result painted within 100 ms for every edit;
     - (d) "rechnet …" with outdated-value marking for any result slower than 50 ms, and the latest result arrives.

     (a) and (b) are measured on the 4× CPU-throttled proxy and on a real mid-range phone via the live site. (c) and (d) are decided on the real phone. The proxy only estimates them, because CPU throttling does not reach the worker.

  6. Explicit phase step: GitHub Pages is enabled on `AINxtGenDev/Eyeglass-Prescription` with Source "GitHub Actions" once the pipeline is ready (pre-authorized by the user 2026-11-06), and the first deploy is verified by loading the live URL.
  7. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: 15 plans (15 sequential waves; gap-closure plans 01-12..01-14 added 2026-11-06, 01-15 added 2026-11-06 after the 01-14 proxy FAIL after the lens-critic NEEDS WORK result review and run before 01-11; walking skeleton = 01-01..01-05, see `01-SKELETON.md`; revised 2026-11-06 per plan-checker + lens-critic; under final D-01 (thinnest feasible base curve) the SC-4 acceptance demo is −12/−6×10 in 62×55, CR-39; SC-4 text updated to match)

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Package legitimacy gate, exact-pinned scaffold, RED smoke test, paper-style parser + de-AT formatter + dictionary

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Engine core: conventions, sag, feasibility-aware Vogel base curve (D-01), CR-39, diagnostics catalogue, thick-lens CT solve, metrics, frozen LensResult

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Minimal German page wired to the engine, disclaimer, timing readouts; smoke GREEN

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — CI gate tests (engine boundary, pins, workflow structure) + SHA-pinned build → deploy → verify-live workflow

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — D-02 checkpoint 1: approved first push, Pages enable (Source: GitHub Actions), live verification

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-06-PLAN.md — Six cited materials (incl. Trivex 1,53), Zeiss CR-39 143-row tier-2 validation, material select

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-07-PLAN.md — Frame shapes Rund/Rechteckig/Panto/Pilot, per-eye decentration + fitting height, frame/PD inputs

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 01-08-PLAN.md — True-torus back surface (D-03, tyre golden), Snell ray-trace oracle incl. evaluateLens pipeline property, PITFALLS Pitfall 5 correction

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 01-09-PLAN.md — Zyl/Achse input with plus-cylinder transposition, both forms shown

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 01-10-PLAN.md — Impossible-lens diagnostics in German (D-01 amended pins), dictionary completeness, never-NaN fuzz, tier-4 properties

**Wave 12** *(gap closure; blocked on Wave 10 completion)*

- [x] 01-12-PLAN.md — GAP-1 + D-A: automatic front ceiling +14 dpt (US4185897), never a convex back, boundary bisection, flat-front tie-break (D-C, τ 0,10 mm), BACK_SURFACE_CONVEX, re-derived pins, Zeiss tier 2 (d) regression pins, Grenzfall by measured time, pass count (MINOR-12)

**Wave 13** *(gap closure; blocked on Wave 12 completion)*

- [x] 01-13-PLAN.md — GAP-3: ENG-06 sags, MAT-01 Abbe number used and shown, MAT-02 Expert clause to UX-02; raw Vogel value, PITFALLS note, axis message (MINOR-1/3/5)

**Wave 14** *(gap closure; blocked on Wave 13 completion)*

- [x] 01-14-PLAN.md — GAP-2 + D-B: work/latency timing medians, per-eye memo, one recompute per frame, canonical and outline-miss bench cases, quiet diagnostics (MINOR-11), CPU-throttled phone proxy 2×/4×/6× before the push (host class measured: Lighthouse BenchmarkIndex 2221, so 4× is the mid-tier-mobile proxy, not a conservative one; result 4× FAIL, user decision "Worker + RAIL target") plus a blocking decision gate (stop for a user decision if 4× fails)

**Wave 15** *(gap closure; blocked on Wave 14 completion)*

- [x] 01-15-PLAN.md — ENG-09 follow-up (user decision "Worker + RAIL target"): engine in a module Web Worker with latest-wins and per-eye memo, "rechnet …" state with aria-busy after 50 ms, synchronous fallback, ENG-09 restated to RAIL/INP (cited), settled signal (#result[data-pending]) for every test, discriminating etmax values (CT is 1,8 mm for all minus lenses), no layout shift at 360 px, main-thread timing including paint, worker bench one run per job (compute first) incl. the rescan pair, busy counter, suspension-aware watchdog, throttled proxy 2×/4×/6× (a,b measured; c,d estimated) plus a decision gate on 4× FAIL

**Wave 16** *(blocked on Wave 15 completion)*

- [x] 01-11-PLAN.md — Phase gate + lens-critic result review (Task 1 re-run after the gap plans), D-02 checkpoint 2 final push, live + real-phone timing (ENG-09)

**UI hint**: yes

### Phase 2: Lay-First German Input, Results & Comparison

**Goal**: A non-expert can type in their paper prescription in German, choose frame and material, and within minutes understand how thick and heavy their lenses will be and how material or frame choice changes it; experts can open the Expert view for base curve, thickness constraints, asphericity, decentration and a 2D cross-section.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RX-01, RX-04, RX-05, RX-06, RX-07, RX-08, FRAME-02, FRAME-03, MAT-03, MAT-04, MAT-05, MAT-06, RES-01, RES-02, RES-03, RES-04, RES-05, UX-01, UX-02, UX-03, UX-04, UX-05, ANA-01, ANA-02
**Success Criteria** (what must be TRUE):

  1. A lay user can copy their paper Rx into an R/L × Sph/Zyl/Achse/PD table (with "gleich für beide Augen", mono or binocular PD, missing-PD default clearly stated, frame stamp like `52□18 140`), and gets plain-German, field-linked messages for invalid, unusual ("Meinten Sie …?") and out-of-model values — never a silent clamp. Values on the paper that are not modelled (Add, Prisma, HSA) are explained, not ignored.
  2. Simple view shows per eye the thickest and thinnest point (with location), centre thickness and weight, rounded to 0,1 mm / 1 g, starting from a labelled "Beispiel" with Rx and frame presets; a large left/right difference is called out in words.
  3. User can compare materials (absolute mm and g savings, e.g. "1,67 spart 1,7 mm und 2 g") and compare two configurations side by side, or as a before/after toggle on phones.
  4. The "Experten-Ansicht" switch reveals manual base curve (and the automatic base curve with its rule, moved from MAT-02), per-material min centre/edge thickness with the binding constraint shown, spherical/aspheric front (labelled as a generic model), decentration, intermediate values, and an SVG cross-section of a selectable meridian (horizontal plus principal meridians when Zyl ≠ 0) that overlays the two compared configurations.
  5. The page works from 320 px width to desktop without overflowing German compound words, every technical term opens a German explanation by tap and by keyboard, the whole flow is keyboard operable, no information relies on colour alone, and automated axe checks pass in CI.
  6. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: 22 plans (22 sequential waves: every slice touches index.html, de-AT.js and style.css; MVP vertical slices, each usable on the page; old 02-05 split into 02-05/02-06/02-07 after the lens-critic plan review (M4); push only in 02-15 after lens-critic and explicit approval; gap-closure plans 02-16..02-21 added 2026-11-07 (02-22 added 2026-11-07 after the user decision "Fix the measurement") after the lens-critic NEEDS WORK result review, run after 02-15 Task 1 and before 02-15 Tasks 2–3, followed by a lens-critic re-review)

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Engine tie tolerance for edge locations (Achse 0 ≡ 180), plain-German result cards per eye, example banner, L/R callout (RES-01, RES-04, RES-05, UX-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Experten-Ansicht switch with Zwischenwerte; layout 320 px → desktop: two columns with sticky results, phone summary bar, no overflow (UX-02, UX-03, ANA-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Paper-shaped Rx table: three message tiers, "Meinten Sie …?", ± sign, mirror, RX-08 details, toggletips (RX-01, RX-04, RX-05, RX-07, RX-08)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Smart PD, temple stamp with own SVG help, shape cards, frame ranges (RX-06, FRAME-02, FRAME-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Verbatim move of the worker pipeline and ENG-09 timing out of main.js (no behaviour change; enables RES-02)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06-PLAN.md — Low-priority latest-wins compare lane and material rows on max(CT, edge), one fixed eye (RES-02, unit tests only)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-07-PLAN.md — Material cards and always-visible material comparison table with compare-frame readout and e2e (RES-02, UX-01)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 02-08-PLAN.md — Two-configuration comparison with Vorher/Nachher toggle (RES-03)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 02-09-PLAN.md — Rx and frame presets with inline confirm (RES-05)

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 02-10-PLAN.md — Expert: manual base curve (0,00…+10,00), minimum thicknesses, binding constraint, Vogel follow-ups (MAT-03, MAT-04)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 02-11-PLAN.md — Expert: generic aspheric front (D1 chosen at k = 0) and rim depth (MAT-05, FRAME-02)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 02-12-PLAN.md — Expert: user-supplied material, labelled, excluded from comparison rows (MAT-06)

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 02-13-PLAN.md — Cross-section SVG of selectable meridians with A/B overlay (ANA-01)

**Wave 14** *(blocked on Wave 13 completion)*

- [x] 02-14-PLAN.md — Whole-page WCAG 2.2 AA matrix, keyboard flow, ENG-09 proxy record with the comparison lane (UX-01, UX-03, UX-04)

**Wave 15** *(blocked on Wave 14 completion)*

- [x] 02-15-PLAN.md — Phase gate: trace, lens-critic result review, approved push, live and real-phone checks *(done 2026-11-08; Pixel 7 Pro; ENG-09 (a) accepted by the user)*

**Wave 16** *(gap closure; after 02-15 Task 1)*

- [x] 02-16-PLAN.md — B1: thinnest point = min(CT, thinnest edge) incl. 'in der Mitte'; 'Dünnster Rand' as Zwischenwert; e2e re-pinned (RES-01)

**Wave 17** *(blocked on Wave 16 completion)*

- [x] 02-17-PLAN.md — M1: oblique 0° meridian shows its own power, 'Hauptschnitt' only for principal meridians; M2: summary bar 'Vorher (A):' marker (ANA-01, RES-03)

**Wave 18** *(blocked on Wave 17 completion)*

- [x] 02-18-PLAN.md — M3: no empty-field error on untouched fields; field messages wait for the current tap/click (RX-04, RX-05, UX-03)

**Wave 19** *(blocked on Wave 18 completion)*

- [x] 02-19-PLAN.md — m2 split property tests; m3/m4 material-intro wording; m8 Simple-view hidden test; m1 traceability (RES-03, UX-02, UX-03 → Phase 2 + 3); m5–m7 accepted for later (RES-02, RES-03, UX-02, UX-03)

**Wave 20** *(blocked on Wave 19 completion)*

- [x] 02-20-PLAN.md — M4: profile the 4× input frame, move compare-job building out of it, re-measure ≥ 3 runs; ENG-09 Pending if (a) is not met (ENG-09)

**Wave 21** *(blocked on Wave 20 completion)*

- [x] 02-21-PLAN.md — Post-gap gate, 24-row trace with value-asserting tests, finding crosswalk, hand-off to lens-critic re-review and 02-15 Tasks 2–3

**Wave 22** *(gap closure; blocked on Wave 21 completion)*

- [x] 02-22-PLAN.md — Quiet ENG-09 proxy measurement (user decision "Fix the measurement"): no DevTools command inside a measured frame, trace proof, re-measure ≥ 3 runs (ENG-09)

**UI hint**: yes

### Phase 3: 3D Lenses & Frame

**Goal**: Users see their glasses in 3D: both lenses rendered from the engine's verified geometry inside a parametric frame, rotatable on phone and desktop, with an Expert thickness heatmap — without lag or memory leaks on a mid-range phone.
**Mode:** mvp
**Depends on**: Phase 2 (engine validated in Phase 1 before any mesh work)
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06; completes RES-03 (3D view of both configurations), UX-02 (heatmap in the Experten-Ansicht), UX-03 (lens view stays visible while editing on phones)
**Success Criteria** (what must be TRUE):

  1. Both lenses appear as 3D meshes inside a parametric frame (rim, bridge, temples) whose local edge thickness matches the engine numbers shown in the results, with a transparent glass look over a checkerboard / eye-chart background labelled as a visual impression.
  2. User can rotate, pan and zoom by mouse and touch and jump to Vorne / Seite / Oben; the side view visibly shows front-surface protrusion beyond the rim.
  3. In Expert view the lens shows a thickness heatmap with a mm legend, labelled iso-lines and numeric callouts at nasal, temporal, superior, inferior and centre, readable without relying on colour.
  4. Changing any input re-meshes with no visible lag on a real mid-range phone (measured and recorded), and repeated changes do not grow GPU memory.
  5. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: 17 plans in 15 waves (planned 2026-11-08; engine-first 03-02/03-03 per CLAUDE.md, then vertical slices; D-04(c) split tolerance and the '1:2' bevel change per user decisions 2026-11-08; revision 1 the same day after the lens-critic plan review: dedicated mesh worker, numbers first on phones, eye-fitted Seite/Dickenkarte, front-surface lead; 03-05, 03-09 and 03-15 split into 03-05/03-06, 03-09/03-10 and 03-15/03-16)
**UI hint**: yes

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Bevel split (D-05) and front-surface lead in the engine; Expert rim lines show front/back protrusion and the lead (deliberate phase-2 change)
- [x] 03-02-PLAN.md — Three.js lint boundary; fixed-topology lens mesh builder with D-04 (a)–(d) and the tessellation bound (10-point probe)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — Engine frame builder (rims on the bevel curve, common rim plane, bridge = DBL, temples, eye boxes) and heat values (scale, iso levels, callouts)
- [x] 03-04-PLAN.md — Dedicated mesh worker: import-free transferOf, validated mesh protocol, latest-wins mesh client with one-item-per-macrotask sync fallback

**Wave 3**

- [x] 03-05-PLAN.md — First 3D view: both lenses as glass at engine thickness, lazy three.js, numbers never wait for the mesh worker

**Wave 4**

- [x] 03-06-PLAN.md — View states (no WebGL, load failure/retry, blocked, empty) and numbers first on phones (view below the result section)

**Wave 5**

- [x] 03-07-PLAN.md — Parametric acetate frame in 3D from the same inputs (rim depth, temple), common rim plane, Technische Angaben design values

**Wave 6**

- [x] 03-08-PLAN.md — Studio look: eye chart, contact shadow, quality tiers, dispersion, context-loss recovery

**Wave 7**

- [x] 03-09-PLAN.md — Mouse/keyboard orbit, pan, zoom; presets Vorne/Seite/Oben with eye-fitted Seite and derived limits

**Wave 8**

- [x] 03-10-PLAN.md — Touch toggle '3D drehen' (any coarse pointer) with scroll safety and auto-off

**Wave 9**

- [x] 03-11-PLAN.md — Seite protrusion and front-surface lead as text, side note, near-temple fade, dynamic aria summary

**Wave 10**

- [x] 03-12-PLAN.md — Expert Dickenkarte: cividis map, shared scale, heat-eye framing, iso-lines, legend and value table

**Wave 11**

- [ ] 03-13-PLAN.md — Projected callouts (all-or-nothing rule) and iso labels, eye picker

**Wave 12**

- [ ] 03-14-PLAN.md — A/B in 3D: side-by-side scissor viewports, phone toggle, shared heat scale

**Wave 13**

- [ ] 03-15-PLAN.md — Phone bar thumbnail framed on the lenses (UX-03), D-27 leak test, 4× proxy 3D and ENG-09 (c) timings, sync modes

**Wave 14**

- [ ] 03-16-PLAN.md — Accessibility matrix for every 3D state and the keyboard path at both widths

**Wave 15**

- [ ] 03-17-PLAN.md — Phase gate: trace, lens-critic result review, approved push, live check, Pixel 7 Pro measurement incl. ENG-09 (c) with 3D

### Phase 4: Refraction View & Offline

**Goal**: Users can look "through" their lens and see a physically traced impression of minification, magnification and cylinder distortion, and the site keeps working offline after the first visit.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: REF-01, REF-02, OFF-01
**Success Criteria** (what must be TRUE):

  1. The "Durchblick" view shows the eye chart / checkerboard through the lens, traced through the engine's actual front and back surfaces: minus lenses minify, plus lenses magnify, and a cylinder visibly distorts along the correct axis.
  2. On a mid-range phone the Durchblick view runs acceptably or drops to lower resolution with a visible note.
  3. After one visit the site loads and computes offline; when a new version is deployed the user sees an "Aktualisieren" prompt instead of a mid-session switch, and the service worker is scoped to `/Eyeglass-Prescription/`.
  4. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verified Engine & Live Pipeline | 15/15 | Complete    | 2026-11-07 |
| 2. Lay-First German Input, Results & Comparison | 22/22 | Complete | 2026-11-08 |
| 3. 3D Lenses & Frame | 12/17 | In Progress|  |
| 4. Refraction View & Offline | 0/TBD | Not started | - |
