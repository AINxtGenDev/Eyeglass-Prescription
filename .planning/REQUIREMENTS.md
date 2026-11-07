# Requirements: Eyeglass Prescription — 3D Lens & Frame Simulator

**Defined:** 2026-11-06
**Core Value:** A non-expert can type in their paper prescription and, within a few minutes, see correctly computed lens thickness and weight for their frame — and how material or frame choice changes it. Correct numbers presented understandably; everything else is secondary.

**Sources:** `idea.md` (corrected spec), `.planning/PROJECT.md`, `.planning/research/SUMMARY.md` and the four research files.
**Language rule:** every user-visible string is German (de-AT). Requirement texts below are English for the team; the shipped UI is German.

## v1 Requirements

### Deployment & Quality Pipeline (DEPL)

- [x] **DEPL-01**: The site is publicly reachable at https://ainxtgendev.github.io/Eyeglass-Prescription/ and loads without missing assets (all paths resolve under the `/Eyeglass-Prescription/` sub-path).
- [x] **DEPL-02**: Every push to `main` runs lint → unit tests → build → browser smoke test against the built site; any failure blocks deployment.
- [x] **DEPL-03**: The optics engine cannot import Three.js or DOM APIs (enforced by a lint rule in CI).
- [x] **DEPL-04**: All third-party GitHub Actions are pinned to commit SHAs; npm dependencies are pinned to exact versions.

### Prescription Input (RX)

- [x] **RX-01**: User enters the prescription in a table laid out like the paper Rx: rows R (rechtes Auge / OD) and L (linkes Auge / OS); columns Sph, Zyl, Achse, PD.
- [x] **RX-02**: Number fields accept comma or point decimals, Unicode minus, leading `+`, trailing `dpt`/`D`, `°` on axis, and `plan`/`pl`/`plano` as 0; the parsed value is echoed back in de-AT format (e.g. `−2,25 dpt`).
- [x] **RX-03**: Plus-cylinder input is accepted and automatically transposed to minus-cylinder form, and the user is shown both forms.
- [x] **RX-04**: Ranges enforced with plain-German messages next to the field: Sph −12,00…+12,00 dpt, Zyl −6,00…0,00 dpt (after transposition), Achse 0…180° (0 ≡ 180), PD 25,0…40,0 mm per eye. Values are never silently clamped.
- [x] **RX-05**: Validation distinguishes invalid (e.g. Zyl without Achse, Achse 200°), unusual-but-computed (e.g. off a 0,25 step → "Meinten Sie …?"), and outside-the-model; messages are linked to the field for screen readers.
- [x] **RX-06**: PD can be entered as monocular per eye (`32/33`, `32,5`) or binocular (`64`, split evenly with a note); if PD is missing, a default is used and the result states clearly that PD was assumed.
- [x] **RX-07**: A "same for both eyes" option keeps L in sync with R.
- [x] **RX-08**: A collapsible section explains other values that may be on the paper (Add, Prisma/Basis, HSA, F/N); it states they are not modelled and that the single-vision distance lens is shown. Nothing on the paper is silently ignored.

### Frame (FRAME)

- [x] **FRAME-01**: User picks a frame shape — Rund, Rechteckig, Panto, Pilot (Aviator) — each a parametric outline scaled to the boxing dimensions.
- [x] **FRAME-02**: User sets A (Glasbreite) 40–62 mm, B (Glashöhe) 28–55 mm, DBL (Stegbreite) 14–24 mm and rim depth; each shape preset has typical defaults.
- [x] **FRAME-03**: User can type or paste the frame stamp from the temple (`52□18 140`, `52-18-140`, `52 18 140`) to set A and DBL, with a "Wo finde ich das?" illustration; B defaults from the shape.

### Materials & Lens Design (MAT)

- [x] **MAT-01**: User chooses a material — CR-39 1,50, Trivex 1,53, Polycarbonat 1,59, 1,60, 1,67, 1,74 — and the engine uses the sourced true refractive index (ne) and density and exposes the sourced Abbe number (νe) for each, with sources recorded in code. (wording 2026-11-06, gap plan 01-13: chromatic effects are not modelled in v1)
- [x] **MAT-02**: Base curve (front surface power) is chosen automatically in +0,50…+14,00 dpt (automatic range; per lens also limited so the front radius exceeds the outline by 2 mm, i.e. at least 2 mm more than the largest outline distance from the optical centre, FRONT_RADIUS_MARGIN_MM) as the flattest value whose maximum thickness is within 0,10 mm of the thinnest possible lens (the thinnest within 0,10 mm, flattest front among those) for the given Rx, frame and material; it never produces a flat/concave front or a convex back surface (every back principal power ≤ 0, plano allowed), and an error appears only if no value in that range gives a computable lens with such a back. The sourced Vogel rule is shown as a reference value. (2026-11-06, user decision D-A: industry high-plus base-curve series of 12–16 D per US4185897; the earlier +10 came from idea.md:48, the manual range; manual override stays 0,00…+10,00, MAT-03.) (2026-11-06, D-01 amendment D-C, orchestrator per the user's best-practice instruction; τ = 0,10 mm design constant, one third of the ±0,3 mm accuracy and the Zeiss ±0,30 mm CT tolerance; preferring the flattest front among those is an unsourced cosmetic design choice, not an optical one.) (2026-11-06: Expert-view display moved to UX-02, phase 2, user-approved 'Gap plan, then push'; back-surface rule added by gap plan 01-12.)
- [x] **MAT-03**: Expert user can override base curve manually (0,00…+10,00 dpt).
- [x] **MAT-04**: Minimum centre and edge thickness default to sourced per-material values and are adjustable in Expert view; the result shows which constraint is binding.
- [x] **MAT-05**: Expert user can switch the front surface between spherical and aspheric (conic constant k, with a documented default); aspheric is labelled as a generic model, not a specific manufacturer design.
- [x] **MAT-06**: Expert user can enter a custom material (refractive index plus density, optionally Abbe number) instead of a listed one; the result is labelled as based on user-supplied values, not a sourced material.

### Optics Engine (ENG)

- [x] **ENG-01**: Engine computes meridian power D(θ) = Sph + Zyl·sin²(θ − Achse) in the TABO convention, with one documented sign/axis convention module used everywhere.
- [x] **ENG-02**: Front and back surfaces each use their own power (signed curvature form); the back surface is designed with the thick-lens relation so that the computed back-vertex power matches the prescription within 0,01 dpt across the full input range (verified by a round-trip test).
- [x] **ENG-03**: The back surface for a cylinder prescription is a true toric surface evaluated per point (x, y), with the torus oriented to the axis; its sag is numerically stable near plano and near the sag singularity.
- [x] **ENG-04**: Centre thickness is solved from the min-centre and min-edge constraints over the actual frame outline, including prescriptions with mixed-sign meridians.
- [x] **ENG-05**: Horizontal decentration = (A + DBL)/2 − mono PD, applied nasally; optional fitting height for vertical position; edge thickness at nasal, temporal, superior and inferior positions is correctly asymmetric. Left and right lenses are computed per eye, not mirrored.
- [x] **ENG-06**: Engine outputs centre thickness, max/min edge thickness with location, thickness at any point, volume (numerical integration over the outline), weight (g), front-surface protrusion, decentration, and intermediate values (radii, sags, binding constraint).
- [x] **ENG-07**: A lens that cannot be made (sag beyond radius, negative edge) is detected and returned as a coded diagnostic with a plain-German explanation and a suggestion (smaller frame, higher index).
- [x] **ENG-08**: Engine results are validated by tiered tests: analytic cases; spherical manufacturer-chart rows within ±0,20 mm (after tool-index conversion); a ray-trace oracle confirming the generated lens reproduces the entered Sph/Zyl/Achse; property tests for symmetry and monotonicity.
- [ ] **ENG-09**: Typing never freezes the page. Both lenses are computed off the main thread in a Web Worker. If the browser cannot start it, the page computes directly and says so under "Technische Angaben". (2026-11-07, 02-20: phase-2 regression, 4× proxy (a) case A max 21,7 ms (runs 21,7 / 19,1 / 20,5) / case B max 24,9 ms (runs 23,3 / 24,9 / 21,8) ≥ 16,7 ms in 3 of 3 runs; the phone check alone cannot close it. lens-critic M4 stays an open MAJOR that needs explicit user acceptance at the 02-15 checkpoint.) (2026-11-07, 02-22, user decision 'Fix the measurement': the proxy harness sends no DevTools command during a measured frame; trace shows Playwright's DevToolsSession task was 10–16 ms of each measured 4× frame under the old method. Quiet method (`PERF_METHOD=quiet`, default): selectText, one flushing round trip, 50 ms quiet, one `Input.insertText`, then 500 ms with no browser command before the reads; app code and the frame window unchanged, nothing subtracted. Trace proof (4× case A and B, 10 + 10 frames): 0 DevToolsSession tasks inside a measured frame. 4× proxy (a), unchanged rule, 3 quiet runs: case A max 7,4 / 10,0 / 8,4 ms, case B max 9,1 / 8,4 / 7,6 ms, compare start max 0,8 / 0,9 / 1,0 ms, all < 16,7 ms → proxy part of (a) PASS. Legacy method, same build: case A 19,9 ms, case B 19,6 ms → FAIL, the old result reproduced. ENG-09 stays Pending until the real-phone check in 02-15 Task 3 also passes.) Measured and recorded: (2026-11-07, lens-critic result re-review: the 02-22 quiet-method PASS covers **whole-value edits only**; key-by-key typing with the same quiet technique at 4× gave input-frame max 13,2–22,2 ms, 3 of 14 runs ≥ 16,7 ms; the frame window also starts at the input's own rAF callback, so earlier rAF callbacks in the same frame are not counted, and ruleA omits the result and compare-paint frames. ENG-09 (a) is therefore NOT met on the proxy for typing; lens-critic M4 remains an open MAJOR.)
  - (a) Every main-thread frame an input causes stays under one frame (< 16,7 ms), including style, layout and paint. This covers the frame that reads the inputs and sends the job, and the frame that renders the result. It is the user's "under one frame" target (2026-11-06). RAIL's 50 ms input budget is the cited outer bound.
  - (b) Input to next paint is ≤ 200 ms for every measured edit (INP "good", https://web.dev/articles/inp; the source's 75th-percentile field threshold, applied here per edit).
  - (c) In the canonical normal case (−4,00/−2,00 × 30°, Rechteckig 52×38/18, PD 32, CR-39), input to result painted is ≤ 100 ms for every measured edit (RAIL, https://web.dev/articles/rail: "Complete a transition initiated by user input within 100 ms").
  - (d) A result that is not painted 50 ms after the input shows "rechnet …" and marks the old values as outdated until it arrives (RAIL: "For actions that take longer than 50 ms to complete, always provide feedback"), and the result for the latest input arrives. On the page, the count of "rechnet …" displays and the longest wait since load are shown for this.

  (a) and (b) are measured on the 4× CPU-throttled proxy and on a real mid-range phone via the live site. (c) and (d) are decided on the real phone. The proxy only estimates them, because CPU throttling does not slow the worker. Worker compute times are reported for information. (Restated 2026-11-06, user decision "Worker + RAIL target"; replaces the earlier one-frame recompute target. Quotes re-checked against both web.dev pages on 2026-11-06.)

### Results & Comparison — Simple View (RES)

- [x] **RES-01**: Simple view shows a plain-German headline per eye: thickest point (mm, with location), thinnest point, centre thickness and weight (g), rounded to 0,1 mm and 1 g.
- [x] **RES-02**: User can compare materials: a table/bars of max edge, centre thickness and weight per material with absolute differences ("1,67 spart 1,7 mm und 2 g"); percentages only as a secondary hint.
- [ ] **RES-03**: User can compare two configurations (material and/or frame size/shape) side by side or as a before/after toggle on phones, in numbers and in the views. (2026-11-07, lens-critic m1: numbers, Vorher/Nachher toggle and 2D cross-section overlay delivered in phase 2; the 3D-view part follows in phase 3. Pending until then.)
- [x] **RES-04**: A large difference between left and right lens is pointed out in plain words.
- [x] **RES-05**: The site starts with a realistic example (clearly labelled "Beispiel — ersetzen Sie die Werte durch Ihre eigenen") and offers Rx presets (leicht kurzsichtig, stark kurzsichtig, weitsichtig, Hornhautverkrümmung) and frame presets; applying a preset over typed values asks first.
- [x] **RES-06**: A persistent disclaimer states this is an educational visualization, not a substitute for an optician, and names the main simplifications.

### Explanations & Usability (UX)

- [x] **UX-01**: Every technical term (Sph, Zyl, Achse, PD, Brechungsindex, Basiskurve, Mittendicke, Randdicke, A, B, DBL, Dezentration) has a one- or two-sentence German explanation that opens by tap (not hover-only) and by keyboard.
- [ ] **UX-02**: Simple view shows only prescription, frame, material, the views and the plain summary; an "Experten-Ansicht" switch reveals base curve, thickness constraints, asphericity, cross-section, heatmap, decentration and intermediate values. The Expert-view base curve includes the automatic value and the rule used (moved from MAT-02 on 2026-11-06). (2026-11-07, lens-critic m1: everything except the heatmap is delivered in phase 2; the heatmap follows in phase 3 with the 3D view. Pending until then.)
- [ ] **UX-03**: Layout works on phone (from 320 px width), tablet and desktop; on phones the lens view stays visible while editing inputs; long German compound words never overflow. (2026-11-07, lens-critic m1: phone/tablet/desktop layout and German word wrapping are delivered in phase 2; the lens view that stays visible while editing on phones needs the phase-3 3D view (#bar-view-slot). Pending until then.)
- [x] **UX-04**: Fully keyboard operable; all inputs labelled; WCAG AA contrast; no information conveyed by colour alone; automated accessibility checks pass in CI.
- [x] **UX-05**: Terminology avoids ambiguous words (e.g. "Stärke" for both power and thickness): power is "Dioptrien (dpt)", thickness is "Mittendicke"/"Randdicke".

### Localization (L10N)

- [x] **L10N-01**: All visible text is German (Austrian conventions), served with `lang="de-AT"`; numbers formatted via `Intl.NumberFormat("de-AT")` with correct handling of minus sign and "-0".
- [x] **L10N-02**: All strings and diagnostic messages come from one dictionary keyed by message codes, so another language can be added without code changes.

### 2D Analytics (ANA)

- [x] **ANA-01**: A 2D cross-section of a selectable meridian (default horizontal, plus the two principal meridians when Zyl ≠ 0) shows the meniscus profile with dimensioned centre and edge thickness; it can overlay the two compared configurations.
- [x] **ANA-02**: Expert view shows decentration and which minimum-thickness constraint sets the centre thickness.

### 3D Visualization (VIZ)

- [ ] **VIZ-01**: Both lenses are rendered as procedural 3D meshes (front surface, back surface, edge band at exact local thickness) built from the engine's points and normals inside the frame outline.
- [ ] **VIZ-02**: A parametric frame (rim, bridge, simple temples) is rendered around the lenses.
- [ ] **VIZ-03**: User can rotate, pan and zoom (mouse and touch) and jump to Vorne / Seite / Oben camera presets; the side view shows protrusion beyond the rim.
- [ ] **VIZ-04**: Lenses use a transparent glass material with the material's index, over a high-contrast checkerboard / eye-chart background, labelled as a visual impression.
- [ ] **VIZ-05**: Expert view shows a thickness heatmap on the lens with a mm legend and labelled iso-lines, plus numeric callouts at nasal/temporal/superior/inferior and centre.
- [ ] **VIZ-06**: Re-meshing after input changes shows no visible lag on a mid-range phone and does not leak GPU memory over repeated changes.

### Refraction Impression (REF)

- [ ] **REF-01**: An "Durchblick" view shows the eye chart/checkerboard as seen through the lens, computed by tracing rays through the engine's actual front and back surfaces, showing minification for minus and magnification for plus lenses, including cylinder effects.
- [ ] **REF-02**: The refraction view runs acceptably on a mid-range phone or degrades gracefully (lower resolution) with a note.

### Offline (OFF)

- [ ] **OFF-01**: After the first visit the site works offline; a new version is offered with an "Aktualisieren" prompt instead of switching mid-session; the service worker is scoped to `/Eyeglass-Prescription/`.

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Sharing & Output

- **SHARE-01**: Opt-in shareable link with the configuration in the URL hash (never sent to a server), with a privacy note.
- **SHARE-02**: Printable one-page summary ("Für den Optiker") via print CSS.

### Deeper Insight

- **INS-01**: "Was würde helfen?" ranked levers (smaller frame, higher index, rounder shape) by mm saved.
- **INS-02**: Tap/keyboard point inspector for thickness at any point.
- **INS-03**: 360° unrolled edge-thickness chart.
- **INS-04**: "Rechenweg anzeigen" panel with formulas, intermediate values and sources.
- **INS-05**: Tangible size references (e.g. "etwa so dick wie ein Bleistift") and illustrated "Warum?" cards.

### Languages

- **LANG-01**: English UI.

### Data

- **DATA-01**: Import of frame tracer data (OMA).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Progressive / bifocal lenses, prism, coatings, tints | v1 focuses on single-vision geometry correctness; modelling them badly is worse than not at all |
| Camera / AR face try-on | Large separate problem, does not serve the core value |
| Photo/OCR of the paper prescription | Misreads of handwritten DACH prescriptions would put wrong numbers in front of users; health-data privacy |
| Webcam PD measurement | Self-measurement accuracy is poor; camera permission and privacy |
| "Best index for you" verdict, brand/product suggestions | Published recommendations contradict each other; implies medical/commercial advice — show facts in mm/g instead |
| Price estimates | Vary by country/optician/brand; unmaintainable; makes the tool look commercial |
| Accounts, server-side saving, analytics on entered Rx | No backend by design; GDPR/health-data obligations |
| Free-form frame drawing | High complexity; parametric shapes cover v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPL-01 | Phase 1 | Complete |
| DEPL-02 | Phase 1 | Complete |
| DEPL-03 | Phase 1 | Complete |
| DEPL-04 | Phase 1 | Complete |
| RX-01 | Phase 2 | Complete |
| RX-02 | Phase 1 | Complete |
| RX-03 | Phase 1 | Complete |
| RX-04 | Phase 2 | Complete |
| RX-05 | Phase 2 | Complete |
| RX-06 | Phase 2 | Complete |
| RX-07 | Phase 2 | Complete |
| RX-08 | Phase 2 | Complete |
| FRAME-01 | Phase 1 | Complete |
| FRAME-02 | Phase 2 | Complete |
| FRAME-03 | Phase 2 | Complete |
| MAT-01 | Phase 1 | Complete |
| MAT-02 | Phase 1 | Complete |
| MAT-03 | Phase 2 | Complete |
| MAT-04 | Phase 2 | Complete |
| MAT-05 | Phase 2 | Complete |
| MAT-06 | Phase 2 | Complete |
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Complete |
| ENG-04 | Phase 1 | Complete |
| ENG-05 | Phase 1 | Complete |
| ENG-06 | Phase 1 | Complete |
| ENG-07 | Phase 1 | Complete |
| ENG-08 | Phase 1 | Complete |
| ENG-09 | Phase 1 | Pending |
| RES-01 | Phase 2 | Complete |
| RES-02 | Phase 2 | Complete |
| RES-03 | Phase 2 + 3 | Pending |
| RES-04 | Phase 2 | Complete |
| RES-05 | Phase 2 | Complete |
| RES-06 | Phase 1 | Complete |
| UX-01 | Phase 2 | Complete |
| UX-02 | Phase 2 + 3 | Pending |
| UX-03 | Phase 2 + 3 | Pending |
| UX-04 | Phase 2 | Complete |
| UX-05 | Phase 2 | Complete |
| L10N-01 | Phase 1 | Complete |
| L10N-02 | Phase 1 | Complete |
| ANA-01 | Phase 2 | Complete |
| ANA-02 | Phase 2 | Complete |
| VIZ-01 | Phase 3 | Pending |
| VIZ-02 | Phase 3 | Pending |
| VIZ-03 | Phase 3 | Pending |
| VIZ-04 | Phase 3 | Pending |
| VIZ-05 | Phase 3 | Pending |
| VIZ-06 | Phase 3 | Pending |
| REF-01 | Phase 4 | Pending |
| REF-02 | Phase 4 | Pending |
| OFF-01 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-06*
*Last updated: 2026-11-07 (02-22, lens-critic M4, user decision 'Fix the measurement'): ENG-09 note: quiet proxy method, 4× proxy (a) passes in 3 of 3 runs for whole-value edits only (max 10,0 ms); key-by-key typing still fails (lens-critic re-review); ENG-09 stays Pending for the 02-15 real-phone check. Before: (02-20, lens-critic M4): ENG-09 back to Pending, the 4× proxy input frame stays ≥ 16,7 ms after the compare-start move (02-20-SUMMARY). Before: (02-19, lens-critic m1) RES-03, UX-02 and UX-03 mapped to "Phase 2 + 3" and Pending, because each has a part that needs the phase-3 3D view (user decision 2026-11-07, deferred-items.md).*
