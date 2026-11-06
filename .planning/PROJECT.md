# Eyeglass Prescription — 3D Lens & Frame Simulator

## What This Is

A static, browser-based 3D simulator (HTML, CSS, JavaScript, Three.js) that turns an eyeglass prescription plus a frame choice into physically computed lens geometry — center thickness, the full 360° edge-thickness profile, surface curvature, weight — and shows the glasses in 3D with a visual impression of refraction. It is built first for lay people holding a paper prescription who want to know "how thick and heavy will my lenses be, and does a higher index or a smaller frame help?", and second for opticians and optometry students who want exact numbers and profile views.

## Core Value

A non-expert can type in their paper prescription and, within a few minutes, see correctly computed lens thickness and weight for their frame — and how material or frame choice changes it. Correct numbers presented understandably; everything else is secondary.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Usability (equal priority to accuracy)**
- [ ] Prescription entry mirrors the paper Rx: R (OD) / L (OS) rows × SPH, CYL, AXIS, PD columns; accepts `-2.25`, `-2,25`, `+1`
- [ ] Plain-language labels with one-tap explanations for every technical term
- [ ] Friendly validation messages; out-of-range or implausible input flagged, never silently clamped
- [ ] Realistic defaults; prescription presets (mild/strong nearsighted, farsighted, astigmatism) and frame presets (Round, Rectangular, Panto, Aviator)
- [ ] Simple view (Rx, frame, material, 3D, plain summary) vs Expert view (base curve, thickness constraints, asphericity, cross-section, heatmap)
- [ ] Side-by-side / before-after comparison of material and frame size with thickness and weight savings
- [ ] Responsive desktop/tablet/phone with touch rotation; controls reachable on phone without losing the 3D view
- [ ] Accessible: keyboard operable, contrast, screen-reader labels, information never by color alone
- [ ] **German UI (required)** — all text in German with Austrian conventions (de-AT number formatting, comma decimals, `lang="de-AT"`, optician terms as used in Austria); strings in one dictionary so English can be added later
- [ ] Disclaimer: educational visualization, not a substitute for an optician

**Inputs**
- [ ] Per-eye SPH −12.00…+12.00 D (0.25), CYL −6.00…0.00 D (0.25, minus-cyl; optional plus-cyl transposition), AXIS 0…180° (TABO), monocular PD 25.0…40.0 mm; "same for both eyes" sync
- [ ] Materials CR-39 1.50, PC 1.59, 1.60, 1.67, 1.74 with verified densities (and Abbe as nice-to-have)
- [ ] Base curve auto (Vogel's rule, verified form) or manual 0…+10 D
- [ ] Min center and min edge thickness with sourced per-material defaults (research: Zeiss uses 1.8 mm CR-39, 1.2 mm 1.67, 1.1 mm 1.74 for minus CT — a single global default distorts the material comparison), adjustable in Expert view
- [ ] Spherical vs aspheric (conic constant k) surface profile
- [ ] Frame: A 40–62 mm, B 28–55 mm, DBL 14–24 mm, rim depth, parametric shapes

**Optics engine (pure JS, no DOM/Three.js, unit-tested)**
- [ ] Meridian power D(θ) = SPH + CYL·sin²(θ − Axis)
- [ ] Each surface uses its own power: R1 = 1000(n−1)/D1, R2(θ) = 1000(n−1)/D2(θ), D2(θ) = D(θ) − D1 (thick-lens correction decided in research)
- [ ] Spherical and conic sag with guard as r → |R|; physically impossible lens detected and explained
- [ ] Toric back surface evaluated per (x, y), model choice and its error documented
- [ ] Thickness t(x,y) = CT − s_front + s_back; CT solved from min-CT / min-ET constraints incl. mixed-sign meridians
- [ ] Decentration dec = (A + DBL)/2 − monocular PD, nasal; optional fitting height; asymmetric nasal/temporal/superior/inferior edges
- [ ] Metrics: CT, max/min ET with location, volume by numerical integration, weight, front-surface protrusion
- [ ] Validated against citable textbook examples and manufacturer thickness charts within defined tolerances

**3D visualization**
- [ ] Procedural BufferGeometry lenses (front, back, edge band at exact local thickness) with correct normals
- [ ] Parametric frame (rim, bridge, simple temples)
- [ ] Baseline refraction via MeshPhysicalMaterial transmission over checkerboard / eye chart; accurate ray-traced distortion mode if feasible on target devices
- [ ] OrbitControls plus Front / Side / Top camera presets
- [ ] Thickness heatmap with legend, numeric callouts, 2D cross-section of a selectable meridian
- [ ] Re-mesh on input change without visible lag on a mid-range phone

**Deployment**
- [ ] Live public website on GitHub Pages at https://ainxtgendev.github.io/Eyeglass-Prescription/, deployed automatically by a GitHub Actions workflow on every push to `main` (build → test → deploy; failing tests block the deploy). Asset paths must work under the `/Eyeglass-Prescription/` sub-path. Live from the first phase onward so every phase is usable in the browser.

### Out of Scope

- Progressive / bifocal lenses, prism, coatings, tints — v1 focuses on single-vision geometry correctness
- Camera / AR face try-on — large separate problem, not needed for the core value
- Accounts, server-side saving, ordering — static site with no backend by design

## Context

- Original brief was pasted by the user; `idea.md` in the repo root is the corrected, authoritative spec. Corrections versus the brief: each surface uses its own power for its radius; decentration is (A+DBL)/2 − mono PD; MeshPhysicalMaterial transmission is a screen-space approximation, not exact optics; aspheric needs a conic constant; weight needs per-material densities; cylinder makes the back surface toric, not rotationally symmetric.
- Material densities and Vogel's rule in `idea.md` are from memory and must be verified with cited sources during research.
- Developer is in Austria (DACH): the website must be in German (Austrian conventions); comma decimals must be accepted. English is a possible later addition only.
- Repo: `AINxtGenDev/Eyeglass-Prescription` (public, GitHub). Target hosting: GitHub Pages.
- Process: a project-local critical reviewer agent `lens-critic` (`.claude/agents/lens-critic.md`) reviews every phase plan before execution and every phase result after execution; a phase completes only when its BLOCKER/MAJOR findings are resolved or explicitly accepted by the user.

## Constraints

- **Tech stack**: HTML, CSS, JavaScript ES modules, Three.js; minimal build tooling (Vite acceptable); pinned versions — simple static deploy, long-lived maintainability
- **Hosting**: static site, no backend, works offline once loaded — GitHub Pages target
- **Architecture**: optics engine independent of DOM and Three.js — must be unit-testable and the single source of truth for numbers
- **Accuracy**: every formula and material constant traceable to a cited source — users may act on the numbers
- **Performance**: interactive re-meshing on a mid-range phone — lay users are mostly on phones
- **Accessibility**: WCAG-oriented basics (keyboard, contrast, labels, no color-only info)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pure-JS optics engine separate from rendering | Testability; 3D only displays already-verified numbers | — Pending |
| Two-tier refraction (MeshPhysicalMaterial baseline + optional ray-traced shader) | Transmission is only approximate; exact mode may be too heavy for mobile | — Pending |
| Simple vs Expert progressive disclosure | Lay users first without losing expert depth | — Pending |
| Minus-cylinder, TABO axis conventions | Standard in DACH prescriptions | — Pending |
| `lens-critic` review gate on every phase | User wants a reviewer that always pushes for better results | — Pending |
| Publish via GitHub Pages (Actions-based deploy) from phase 1 | User wants to use the website on GitHub Pages; early deploy gives real-phone testing each phase. User pre-authorized (2026-11-06) enabling Pages (Source: GitHub Actions) once phase 1 is ready | — Pending |
| German (de-AT) as the only v1 UI language | User requirement: website must be in German; audience is Austrian/DACH lay users | — Pending |
| Coarse granularity, YOLO/auto, research + plan-check + verifier on, quality model profile | Chosen by user at init | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-06 after initialization*
