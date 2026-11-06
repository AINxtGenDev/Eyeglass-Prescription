# Requirements: Eyeglass Prescription — 3D Lens & Frame Simulator

**Defined:** 2026-11-06
**Core Value:** A non-expert can type in their paper prescription and, within a few minutes, see correctly computed lens thickness and weight for their frame — and how material or frame choice changes it. Correct numbers presented understandably; everything else is secondary.

**Sources:** `idea.md` (corrected spec), `.planning/PROJECT.md`, `.planning/research/SUMMARY.md` and the four research files.
**Language rule:** every user-visible string is German (de-AT). Requirement texts below are English for the team; the shipped UI is German.

## v1 Requirements

### Deployment & Quality Pipeline (DEPL)

- [ ] **DEPL-01**: The site is publicly reachable at https://ainxtgendev.github.io/Eyeglass-Prescription/ and loads without missing assets (all paths resolve under the `/Eyeglass-Prescription/` sub-path).
- [ ] **DEPL-02**: Every push to `main` runs lint → unit tests → build → browser smoke test against the built site; any failure blocks deployment.
- [x] **DEPL-03**: The optics engine cannot import Three.js or DOM APIs (enforced by a lint rule in CI).
- [x] **DEPL-04**: All third-party GitHub Actions are pinned to commit SHAs; npm dependencies are pinned to exact versions.

### Prescription Input (RX)

- [ ] **RX-01**: User enters the prescription in a table laid out like the paper Rx: rows R (rechtes Auge / OD) and L (linkes Auge / OS); columns Sph, Zyl, Achse, PD.
- [x] **RX-02**: Number fields accept comma or point decimals, Unicode minus, leading `+`, trailing `dpt`/`D`, `°` on axis, and `plan`/`pl`/`plano` as 0; the parsed value is echoed back in de-AT format (e.g. `−2,25 dpt`).
- [x] **RX-03**: Plus-cylinder input is accepted and automatically transposed to minus-cylinder form, and the user is shown both forms.
- [ ] **RX-04**: Ranges enforced with plain-German messages next to the field: Sph −12,00…+12,00 dpt, Zyl −6,00…0,00 dpt (after transposition), Achse 0…180° (0 ≡ 180), PD 25,0…40,0 mm per eye. Values are never silently clamped.
- [ ] **RX-05**: Validation distinguishes invalid (e.g. Zyl without Achse, Achse 200°), unusual-but-computed (e.g. off a 0,25 step → "Meinten Sie …?"), and outside-the-model; messages are linked to the field for screen readers.
- [ ] **RX-06**: PD can be entered as monocular per eye (`32/33`, `32,5`) or binocular (`64`, split evenly with a note); if PD is missing, a default is used and the result states clearly that PD was assumed.
- [ ] **RX-07**: A "same for both eyes" option keeps L in sync with R.
- [ ] **RX-08**: A collapsible section explains other values that may be on the paper (Add, Prisma/Basis, HSA, F/N); it states they are not modelled and that the single-vision distance lens is shown. Nothing on the paper is silently ignored.

### Frame (FRAME)

- [x] **FRAME-01**: User picks a frame shape — Rund, Rechteckig, Panto, Pilot (Aviator) — each a parametric outline scaled to the boxing dimensions.
- [ ] **FRAME-02**: User sets A (Glasbreite) 40–62 mm, B (Glashöhe) 28–55 mm, DBL (Stegbreite) 14–24 mm and rim depth; each shape preset has typical defaults.
- [ ] **FRAME-03**: User can type or paste the frame stamp from the temple (`52□18 140`, `52-18-140`, `52 18 140`) to set A and DBL, with a "Wo finde ich das?" illustration; B defaults from the shape.

### Materials & Lens Design (MAT)

- [ ] **MAT-01**: User chooses a material — CR-39 1,50, Trivex 1,53, Polycarbonat 1,59, 1,60, 1,67, 1,74 — and the engine uses the sourced true refractive index (ne), density and Abbe number for each, with sources recorded in code.
- [ ] **MAT-02**: Base curve (front surface power) is chosen automatically as the value in +0,50…+10,00 dpt that makes the lens thinnest (smallest maximum thickness) for the given Rx, frame and material; it never produces a flat/concave front, and an impossible-lens error appears only if no value in that range computes. The sourced Vogel rule is shown as a reference value; the auto value and the rule used are shown in Expert view.
- [ ] **MAT-03**: Expert user can override base curve manually (0,00…+10,00 dpt).
- [ ] **MAT-04**: Minimum centre and edge thickness default to sourced per-material values and are adjustable in Expert view; the result shows which constraint is binding.
- [ ] **MAT-05**: Expert user can switch the front surface between spherical and aspheric (conic constant k, with a documented default); aspheric is labelled as a generic model, not a specific manufacturer design.
- [ ] **MAT-06**: Expert user can enter a custom material (refractive index plus density, optionally Abbe number) instead of a listed one; the result is labelled as based on user-supplied values, not a sourced material.

### Optics Engine (ENG)

- [x] **ENG-01**: Engine computes meridian power D(θ) = Sph + Zyl·sin²(θ − Achse) in the TABO convention, with one documented sign/axis convention module used everywhere.
- [x] **ENG-02**: Front and back surfaces each use their own power (signed curvature form); the back surface is designed with the thick-lens relation so that the computed back-vertex power matches the prescription within 0,01 dpt across the full input range (verified by a round-trip test).
- [x] **ENG-03**: The back surface for a cylinder prescription is a true toric surface evaluated per point (x, y), with the torus oriented to the axis; its sag is numerically stable near plano and near the sag singularity.
- [x] **ENG-04**: Centre thickness is solved from the min-centre and min-edge constraints over the actual frame outline, including prescriptions with mixed-sign meridians.
- [x] **ENG-05**: Horizontal decentration = (A + DBL)/2 − mono PD, applied nasally; optional fitting height for vertical position; edge thickness at nasal, temporal, superior and inferior positions is correctly asymmetric. Left and right lenses are computed per eye, not mirrored.
- [ ] **ENG-06**: Engine outputs centre thickness, max/min edge thickness with location, thickness at any point, volume (numerical integration over the outline), weight (g), front-surface protrusion, decentration, and intermediate values (radii, sags, binding constraint).
- [ ] **ENG-07**: A lens that cannot be made (sag beyond radius, negative edge) is detected and returned as a coded diagnostic with a plain-German explanation and a suggestion (smaller frame, higher index).
- [ ] **ENG-08**: Engine results are validated by tiered tests: analytic cases; spherical manufacturer-chart rows within ±0,20 mm (after tool-index conversion); a ray-trace oracle confirming the generated lens reproduces the entered Sph/Zyl/Achse; property tests for symmetry and monotonicity.
- [ ] **ENG-09**: Recomputing both lenses after an input change completes within one animation frame on a mid-range phone (target measured on a real device and recorded).

### Results & Comparison — Simple View (RES)

- [ ] **RES-01**: Simple view shows a plain-German headline per eye: thickest point (mm, with location), thinnest point, centre thickness and weight (g), rounded to 0,1 mm and 1 g.
- [ ] **RES-02**: User can compare materials: a table/bars of max edge, centre thickness and weight per material with absolute differences ("1,67 spart 1,7 mm und 2 g"); percentages only as a secondary hint.
- [ ] **RES-03**: User can compare two configurations (material and/or frame size/shape) side by side or as a before/after toggle on phones, in numbers and in the views.
- [ ] **RES-04**: A large difference between left and right lens is pointed out in plain words.
- [ ] **RES-05**: The site starts with a realistic example (clearly labelled "Beispiel — ersetzen Sie die Werte durch Ihre eigenen") and offers Rx presets (leicht kurzsichtig, stark kurzsichtig, weitsichtig, Hornhautverkrümmung) and frame presets; applying a preset over typed values asks first.
- [x] **RES-06**: A persistent disclaimer states this is an educational visualization, not a substitute for an optician, and names the main simplifications.

### Explanations & Usability (UX)

- [ ] **UX-01**: Every technical term (Sph, Zyl, Achse, PD, Brechungsindex, Basiskurve, Mittendicke, Randdicke, A, B, DBL, Dezentration) has a one- or two-sentence German explanation that opens by tap (not hover-only) and by keyboard.
- [ ] **UX-02**: Simple view shows only prescription, frame, material, the views and the plain summary; an "Experten-Ansicht" switch reveals base curve, thickness constraints, asphericity, cross-section, heatmap, decentration and intermediate values.
- [ ] **UX-03**: Layout works on phone (from 320 px width), tablet and desktop; on phones the lens view stays visible while editing inputs; long German compound words never overflow.
- [ ] **UX-04**: Fully keyboard operable; all inputs labelled; WCAG AA contrast; no information conveyed by colour alone; automated accessibility checks pass in CI.
- [ ] **UX-05**: Terminology avoids ambiguous words (e.g. "Stärke" for both power and thickness): power is "Dioptrien (dpt)", thickness is "Mittendicke"/"Randdicke".

### Localization (L10N)

- [ ] **L10N-01**: All visible text is German (Austrian conventions), served with `lang="de-AT"`; numbers formatted via `Intl.NumberFormat("de-AT")` with correct handling of minus sign and "-0".
- [x] **L10N-02**: All strings and diagnostic messages come from one dictionary keyed by message codes, so another language can be added without code changes.

### 2D Analytics (ANA)

- [ ] **ANA-01**: A 2D cross-section of a selectable meridian (default horizontal, plus the two principal meridians when Zyl ≠ 0) shows the meniscus profile with dimensioned centre and edge thickness; it can overlay the two compared configurations.
- [ ] **ANA-02**: Expert view shows decentration and which minimum-thickness constraint sets the centre thickness.

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
| DEPL-01 | Phase 1 | Pending |
| DEPL-02 | Phase 1 | Pending |
| DEPL-03 | Phase 1 | Complete |
| DEPL-04 | Phase 1 | Complete |
| RX-01 | Phase 2 | Pending |
| RX-02 | Phase 1 | Complete |
| RX-03 | Phase 1 | Complete |
| RX-04 | Phase 2 | Pending |
| RX-05 | Phase 2 | Pending |
| RX-06 | Phase 2 | Pending |
| RX-07 | Phase 2 | Pending |
| RX-08 | Phase 2 | Pending |
| FRAME-01 | Phase 1 | Complete |
| FRAME-02 | Phase 2 | Pending |
| FRAME-03 | Phase 2 | Pending |
| MAT-01 | Phase 1 | Pending |
| MAT-02 | Phase 1 | Pending |
| MAT-03 | Phase 2 | Pending |
| MAT-04 | Phase 2 | Pending |
| MAT-05 | Phase 2 | Pending |
| MAT-06 | Phase 2 | Pending |
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Complete |
| ENG-04 | Phase 1 | Complete |
| ENG-05 | Phase 1 | Complete |
| ENG-06 | Phase 1 | Pending |
| ENG-07 | Phase 1 | Pending |
| ENG-08 | Phase 1 | Pending |
| ENG-09 | Phase 1 | Pending |
| RES-01 | Phase 2 | Pending |
| RES-02 | Phase 2 | Pending |
| RES-03 | Phase 2 | Pending |
| RES-04 | Phase 2 | Pending |
| RES-05 | Phase 2 | Pending |
| RES-06 | Phase 1 | Complete |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 2 | Pending |
| UX-04 | Phase 2 | Pending |
| UX-05 | Phase 2 | Pending |
| L10N-01 | Phase 1 | Pending |
| L10N-02 | Phase 1 | Complete |
| ANA-01 | Phase 2 | Pending |
| ANA-02 | Phase 2 | Pending |
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
*Last updated: 2026-11-06 after roadmap creation*
