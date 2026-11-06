# Eyeglass Prescription — 3D Lens & Frame Simulator

## 1. Core Objective

An interactive, physically accurate 3D web application (HTML, CSS, JavaScript, Three.js) that models a pair of eyeglasses and computes and renders real lens geometry — center thickness, edge-thickness profile around the full perimeter, surface curvature — plus a visual impression of refraction, all driven by a user-entered prescription and frame dimensions.

**Equal-priority goal: ease of use for non-experts.** A person holding a paper prescription from their optician, with no optics or technical knowledge, must be able to enter it and understand the result within a few minutes. Expert depth (formulas, cross-sections, manual base curve) is available but never in the way.

## 2. Target Users

1. **Lay users (primary):** want to know "how thick and heavy will my lenses be, and does a higher index or a smaller frame help?"
2. **Opticians / optometry students (secondary):** want exact numbers, profile views, and to compare materials and frames.

## 3. Usability Requirements (non-expert first)

- **Prescription entry mirrors the paper Rx:** a table with rows R (OD) / L (OS) and columns SPH, CYL, AXIS, PD — the same layout opticians print. Accept typed values like `-2.25`, `-2,25` (comma decimal, common in Austria/Germany) and `+1`.
- **Plain-language labels with tooltips:** e.g. "SPH — Sphere: strength of nearsightedness (−) or farsightedness (+)". Each technical term has a short explanation one tap away.
- **Validation with friendly messages:** out-of-range or implausible values (e.g. CYL entered without AXIS) are flagged in plain words, never silently clamped.
- **Sensible defaults and presets:** start with a realistic example prescription and frame; presets like "mild nearsighted", "strong nearsighted", "farsighted", "astigmatism"; frame presets (Round, Rectangular, Panto, Aviator) with typical dimensions.
- **Progressive disclosure:** "Simple" view shows the prescription, frame shape/size, material choice, the 3D glasses, and a short summary ("Edge thickness: 6.1 mm — choosing 1.67 would make it 4.4 mm"). "Expert" view reveals base curve, minimum-thickness constraints, asphericity parameters, cross-section, and heatmap.
- **Comparison is the key insight for lay users:** easy side-by-side or before/after comparison of materials (index) and frame size, showing thickness and weight savings.
- **Responsive:** usable on desktop, tablet, and phone; touch gestures for 3D rotation; controls reachable without scrolling the 3D view away on phones.
- **Accessibility:** keyboard operable, sufficient contrast, labels for screen readers on all inputs, numbers not conveyed by color alone (heatmap has a legend and numeric callouts).
- **UI language:** English; structure strings so a German translation can be added later.
- **Disclaimer:** visualization/education tool, not a substitute for an optician's measurement.

## 4. Input Parameters

Separate controls for Right Eye (OD) and Left Eye (OS), with a "same for both eyes" sync option.

### A. Prescription
- **Sphere (SPH):** −12.00 D to +12.00 D, 0.25 D steps.
- **Cylinder (CYL):** −6.00 D to 0.00 D, 0.25 D steps (minus-cylinder convention). Optionally accept plus-cylinder input and transpose it.
- **Axis (AX):** 0° to 180°, 1° steps (TABO convention).
- **Monocular PD:** 25.0 mm to 40.0 mm per eye.

### B. Lens Material & Design
| Material | n | Density (g/cm³)* |
|---|---|---|
| CR-39 | 1.50 | ~1.32 |
| Polycarbonate | 1.59 | ~1.20 |
| High-index 1.60 | 1.60 | ~1.30 |
| High-index 1.67 | 1.67 | ~1.35 |
| High-index 1.74 | 1.74 | ~1.47 |

\* Approximate values from memory — **research phase must verify against manufacturer data sheets** and record sources. Abbe number per material is a nice-to-have display.

- **Base curve (front surface power D1):** auto (Vogel's rule — research must confirm the exact form; commonly cited: plus lenses D1 ≈ SE + 6, minus lenses D1 ≈ SE/2 + 6, SE = SPH + CYL/2) or manual 0.00 D to +10.00 D.
- **Minimum thickness constraints:** minimum center thickness (default 1.5 mm, governs minus lenses) and minimum edge thickness (default 1.2 mm, governs plus lenses). Both user-adjustable in Expert view.
- **Surface profile:** spherical or aspheric. Aspheric uses a conic sag with conic constant **k** (and optionally higher-order terms); expose k in Expert view with a sensible default per lens type.

### C. Frame (Boxing System)
- **A (lens width):** 40–62 mm.
- **B (lens height):** 28–55 mm.
- **DBL (bridge):** 14–24 mm.
- **Rim thickness / depth** and **shape:** Round, Rectangular, Panto, Aviator — each defined as a parametric 2D outline scaled to A × B.

## 5. Physical & Mathematical Engine

The lens is **not** faked by scaling. Mesh vertices come from real geometric optics. The engine is a pure, framework-independent JavaScript module with unit tests; the 3D view only consumes its output.

### 5.1 Conventions
- Units: dioptres (D), millimetres (mm). Surface power D = 1000·(n − 1) / R, R in mm.
- Meniscus lens: convex front surface (D1 > 0), back surface D2 (usually concave, < 0).
- Thin-lens relation for the required back power: **D2(θ) = D(θ) − D1** (research should decide whether to apply the thick-lens / vertex correction for accuracy at high powers, and document the choice).

### 5.2 Meridian power (sphero-cylinder)
For meridian angle θ (measured in the TABO convention):

  **D(θ) = SPH + CYL · sin²(θ − Axis)**

### 5.3 Surface radii — *corrected*
Each surface uses **its own** power, not the total lens power:
- Front radius: **R1 = 1000·(n − 1) / D1** (constant; front surface is spherical or aspheric-rotationally-symmetric).
- Back radius per meridian: **R2(θ) = 1000·(n − 1) / D2(θ)**.

> Correction vs. the original brief: the brief used R(θ) = 1000·(n − 1)/D(θ) for "the" radius. Using the total power for both surfaces would make them identical and yield wrong thickness.

### 5.4 Sagitta
- Spherical: **s(r) = R − sign(R) · √(R² − r²)**, with clamping/guarding when r → |R| (extreme prescriptions or large frames); flag to the user when a lens is physically impossible in that frame.
- Aspheric (conic): **s(r) = c·r² / (1 + √(1 − (1 + k)·c²·r²))**, c = 1/R.
- Plano (D = 0): s = 0.

### 5.5 Toric back surface — *corrected*
A lens with cylinder is **not rotationally symmetric**. The back-surface sag must be evaluated per point (x, y), not from a single radius. Approach to be confirmed in research:
- Practical model: for a point at polar coordinates (r, θ) around the optical center, use the meridional radius R2(θ) in the sag formula — document it as an approximation; or
- Exact model: true toroidal surface sag with the two principal radii aligned to the axis.
The chosen model and its error at high CYL must be documented.

### 5.6 Thickness
- Thickness at a point: **t(x, y) = CT − s_front(r) + s_back(x, y)** (signs per the convention in 5.1; concave back sag reduces thickness toward the edge for plus lenses, increases it for minus lenses).
- **Center thickness CT** is solved from the constraints:
  - Minus lenses: CT = min center thickness.
  - Plus lenses: CT chosen so the **thinnest point on the frame outline** equals the min edge thickness.
  - Mixed (e.g. plus sphere with strong minus cylinder): satisfy both constraints, take the larger CT.

### 5.7 Decentration — *corrected*
- Frame half-distance between geometric lens centers: **(A + DBL) / 2**.
- Horizontal decentration per eye: **dec = (A + DBL) / 2 − monocular PD**, applied **nasally** when positive.
- Vertical decentration: optical center at the boxing center by default; optional fitting height input in Expert view.
- Radial distance r for every edge/outline point is measured from the decentered optical center, so nasal/temporal (and superior/inferior) edge thicknesses are correctly asymmetric.

### 5.8 Derived metrics
- Center thickness, max/min edge thickness with location (nasal, temporal, superior, inferior).
- Volume by numerical integration over the frame outline → **weight = volume × density**.
- Lens protrusion (sag depth of front surface at the rim) for the profile view.

### 5.9 Validation
Unit tests compare engine output against worked textbook examples and published manufacturer thickness charts (research must find citable references). Tolerance targets are set in the requirements phase.

## 6. 3D Visualization (Three.js)

- **Procedural lens mesh:** custom BufferGeometry per lens — front surface, back surface, and an edge band following the frame outline at its exact local thickness; vertex normals computed correctly for lighting.
- **Frame:** parametric rim around each lens shape, bridge, temples (simple geometry is fine).
- **Refraction rendering — *corrected expectation*:** Three.js `MeshPhysicalMaterial` transmission (`ior = n`, `thickness`) is a **screen-space approximation**; it gives a plausible look but not optically exact minification/magnification. Two-tier approach:
  1. Baseline: MeshPhysicalMaterial transmission over a high-contrast checkerboard / eye chart.
  2. Accurate mode: custom shader that ray-traces through the two lens surfaces (front + back sag functions, Snell's law at each) to show correct barrel distortion (minus) and pincushion distortion (plus).
  Research decides feasibility and performance on mobile; baseline must work everywhere.
- **Interaction:** OrbitControls (rotate, pan, zoom, touch); one-click camera presets — Front, Side profile, Top (to inspect protrusion beyond the rim).
- **Analytics:**
  - Thickness heatmap on the lens surface with legend.
  - Numeric callouts: CT, max/min edge thickness with location, weight.
  - Cross-section 2D slice view (selectable meridian) showing the meniscus profile with dimensions.
- **Performance:** re-mesh on input change without visible lag on a mid-range phone (target set in requirements).

## 7. Tech Constraints

- Static site: HTML, CSS, JavaScript (ES modules), Three.js. No backend; runs offline once loaded.
- Minimal build tooling (Vite acceptable); pinned dependency versions.
- Engine has no DOM/Three.js dependency → testable with a standard JS test runner.
- Deployable to GitHub Pages from repo `AINxtGenDev/Eyeglass-Prescription`.

## 8. Development Process & Agents

- Use GSD's subagents (researchers, planner, plan-checker, executor, verifier, code-reviewer, UI researcher/auditor) throughout.
- **A dedicated critical reviewer agent (`lens-critic`, defined in `.claude/agents/lens-critic.md`) must review every phase** — plan before execution and result after execution. It is never satisfied by "works"; it hunts for wrong formulas, unverified numbers, sign-convention errors, untested edge cases, usability friction for lay users, and performance problems, and it demands concrete improvements. A phase is complete only when its blocking findings are resolved or explicitly accepted by the user.
- Research findings that support formulas or material data must cite sources.

## 9. Out of Scope (v1)

- Progressive / bifocal lenses, prism, lens coatings and tints.
- Real face try-on (camera / AR).
- User accounts, saving to a server, ordering.
