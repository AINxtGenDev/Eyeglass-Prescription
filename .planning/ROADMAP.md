# Roadmap: Eyeglass Prescription — 3D Lens & Frame Simulator

## Overview

The journey runs from numbers to pictures. Phase 1 builds and validates the pure-JS optics engine and ships it behind a minimal German page on GitHub Pages through a gated Actions pipeline, so the site is live and testable on a real phone from day one. Phase 2 delivers the core value: a lay user types in the paper prescription in German, picks frame and material, and sees understandable thickness and weight with mm/g comparisons, plus the Expert view with the 2D cross-section. Phase 3 adds the 3D lenses and frame on top of the already-verified numbers, including the thickness heatmap. Phase 4 finishes with the ray-traced "Durchblick" refraction view and offline support.

Every phase is gated by the project-local `lens-critic` agent (`.claude/agents/lens-critic.md`): it reviews the phase plan before execution and the phase result after execution. A phase is complete only with verdict PASS (zero BLOCKER/MAJOR) or with remaining findings explicitly accepted by the user.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Verified Engine & Live Pipeline** - Pure-JS optics engine with tiered validation, gated GitHub Actions deploy to Pages, minimal live German result page
- [ ] **Phase 2: Lay-First German Input, Results & Comparison** - Paper-shaped Rx entry, frame and material choice, plain-German results, mm/g comparison, Expert view with 2D cross-section, accessibility
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
  4. An impossible lens (e.g. −12,00 / −6,00 × 10 in a 62×55 frame, CR-39 — no base curve in +0,50…+10,00 dpt computes it) yields a coded diagnostic with a plain-German explanation and suggestion instead of numbers, and all visible text and messages come from the `de-AT` dictionary.
  5. Recompute time for both lenses is measured on a real mid-range phone via the live site and recorded, within one animation frame.
  6. Explicit phase step: GitHub Pages is enabled on `AINxtGenDev/Eyeglass-Prescription` with Source "GitHub Actions" once the pipeline is ready (pre-authorized by the user 2026-11-06), and the first deploy is verified by loading the live URL.
  7. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: 11 plans (11 sequential waves; walking skeleton = 01-01..01-05, see `01-SKELETON.md`; revised 2026-11-06 per plan-checker + lens-critic; under final D-01 (thinnest feasible base curve) the SC-4 acceptance demo is −12/−6×10 in 62×55, CR-39; SC-4 text updated to match)

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

- [ ] 01-06-PLAN.md — Six cited materials (incl. Trivex 1,53), Zeiss CR-39 143-row tier-2 validation, material select

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 01-07-PLAN.md — Frame shapes Rund/Rechteckig/Panto/Pilot, per-eye decentration + fitting height, frame/PD inputs

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 01-08-PLAN.md — True-torus back surface (D-03, tyre golden), Snell ray-trace oracle incl. evaluateLens pipeline property, PITFALLS Pitfall 5 correction

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 01-09-PLAN.md — Zyl/Achse input with plus-cylinder transposition, both forms shown

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 01-10-PLAN.md — Impossible-lens diagnostics in German (D-01 amended pins), dictionary completeness, never-NaN fuzz, tier-4 properties

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 01-11-PLAN.md — Phase gate + lens-critic result review, D-02 checkpoint 2 final push, live + real-phone timing (ENG-09)

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
  4. The "Experten-Ansicht" switch reveals manual base curve, per-material min centre/edge thickness with the binding constraint shown, spherical/aspheric front (labelled as a generic model), decentration, intermediate values, and an SVG cross-section of a selectable meridian (horizontal plus principal meridians when Zyl ≠ 0) that overlays the two compared configurations.
  5. The page works from 320 px width to desktop without overflowing German compound words, every technical term opens a German explanation by tap and by keyboard, the whole flow is keyboard operable, no information relies on colour alone, and automated axe checks pass in CI.
  6. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: TBD
**UI hint**: yes

### Phase 3: 3D Lenses & Frame

**Goal**: Users see their glasses in 3D: both lenses rendered from the engine's verified geometry inside a parametric frame, rotatable on phone and desktop, with an Expert thickness heatmap — without lag or memory leaks on a mid-range phone.
**Mode:** mvp
**Depends on**: Phase 2 (engine validated in Phase 1 before any mesh work)
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06
**Success Criteria** (what must be TRUE):

  1. Both lenses appear as 3D meshes inside a parametric frame (rim, bridge, temples) whose local edge thickness matches the engine numbers shown in the results, with a transparent glass look over a checkerboard / eye-chart background labelled as a visual impression.
  2. User can rotate, pan and zoom by mouse and touch and jump to Vorne / Seite / Oben; the side view visibly shows front-surface protrusion beyond the rim.
  3. In Expert view the lens shows a thickness heatmap with a mm legend, labelled iso-lines and numeric callouts at nasal, temporal, superior, inferior and centre, readable without relying on colour.
  4. Changing any input re-meshes with no visible lag on a real mid-range phone (measured and recorded), and repeated changes do not grow GPU memory.
  5. `lens-critic` reviewed the phase plan and the phase result with verdict PASS (no open BLOCKER/MAJOR), or the user explicitly accepted the remaining findings.

**Plans**: TBD
**UI hint**: yes

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
| 1. Verified Engine & Live Pipeline | 5/11 | In Progress|  |
| 2. Lay-First German Input, Results & Comparison | 0/TBD | Not started | - |
| 3. 3D Lenses & Frame | 0/TBD | Not started | - |
| 4. Refraction View & Offline | 0/TBD | Not started | - |
