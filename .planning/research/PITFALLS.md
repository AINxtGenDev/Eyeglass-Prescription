# Pitfalls Research

**Domain:** Browser-based 3D eyeglass lens & frame simulator (thickness/weight engine plus Three.js visualisation), German (de-AT) UI for lay users
**Researched:** 2026-11-06
**Confidence:** MEDIUM overall. Material data and manufacturer thickness charts are HIGH (primary Zeiss datasheets were downloaded and read). Optics quantifications are HIGH: they were computed by a script and are reproducible (see "Computation provenance"). Textbook page references are LOW (not accessible online). German UX items are MEDIUM.

**Phase names used below** (suggested; the roadmapper may rename them):
- **P-Engine**: pure-JS optics core (conventions, surfaces, CT solver, metrics)
- **P-Validate**: fixtures, tolerances, regression tests
- **P-Mesh**: BufferGeometry lens and frame, heatmap, cross-section
- **P-UI**: German Rx entry, parsing, labels, Simple/Expert, comparison
- **P-Refract**: MeshPhysicalMaterial baseline plus optional ray-traced shader
- **P-Perf/A11y**: mobile performance, memory, accessibility polish

**Computation provenance.** Numbers marked [CALC] come from `.planning/research/scripts/calc.py` and `w.py` (Python/numpy, run 2026-11-06). The scratchpad is session-local, so P-Engine should re-derive these numbers as unit tests rather than trust this file.

---

## Critical Pitfalls

### Pitfall 1: Vogel's rule used blindly across the whole input range and for every material

**What goes wrong:**
- The commonly cited form is **plus: D1 = SE + 6; minus: D1 = SE/2 + 6, with SE = SPH + CYL/2**. Several teaching sources agree on it, including the worked example −4.00 −2.00 → SE −5 → 3.50 D (MEDIUM; secondary sources only, see Sources). It is an approximation to the Tscherning ellipse for low-index best-form lenses, and opticians state that "lens designers don't use Vogel's formula".
- **At the extremes of the specified input range it breaks** [CALC]:
  - SE −12 gives D1 = 0. That means R1 = ∞, so any code using `R = 1000(n−1)/D` divides by zero.
  - SE −14 or −15 (SPH −12 with CYL −6 is in range) gives D1 = −1.0 or −1.5 D. That is a concave front, so the lens is no longer a meniscus and the "convex front" convention in idea.md §5.1 is violated.
  - SE +12 gives D1 = +18 D. That means R1 = 27.8 mm (n 1.50) or 41.1 mm (n 1.74). A 62 × 55 frame has a half-diagonal of about 41.4 mm before decentration, so the front sphere is *smaller than the lens*. The sag is undefined, and this happens inside the advertised input range.
- **Real high-index aspheric lenses are far flatter than Vogel:**
  - Zeiss 1.74 at −6.00: the front curve is 0.86 D in 1.53 tool index, which is ≈1.20 D true. Vogel gives +3.00 D.
  - Zeiss 1.67 at +6.00: the front is 6.33 D (1.53), which is ≈7.93 D true. Vogel gives +12 D.
  - (Zeiss FSV fact sheets, 6/23; conversion D_true = D_1.53·(n−1)/0.53.)
  - So a Vogel-based simulator overstates plus-lens thickness and protrusion for high-index materials. It also misattributes savings between "index" and "design".

**Why it happens:** Vogel is the only base-curve rule that is easy to find online. It looks authoritative and is index-independent.

**How to avoid:**
- Implement Vogel exactly as above, but **clamp D1 to a documented range**, for example [+0.50, +10.00] D to match the manual range in idea.md. The clamp floor is a design choice, not a sourced constant.
- Work with **curvature c = D/(1000(n−1))** everywhere, never with radius, so D = 0 is just c = 0.
- Detect and explain the "front sphere smaller than the lens" case: "Bei dieser Stärke und Fassungsgröße ist ein Glas mit dieser Basiskurve nicht herstellbar."
- Label the auto base curve in Expert view as "möglichst dünn (in diesem Modell)" and show Vogel only as a reference ("übliche Faustregel nach Vogel"). Do not claim it matches any manufacturer. (Superseded 2026-11-06, lens-critic iteration-3 MAJOR-1: the former label "Näherung (Vogel-Regel)" is wrong since phase-1 D-01 final picks the thinnest feasible front, not Vogel's; the disclaimer says real lenses, especially minus lenses, can be somewhat thicker.)
- Optionally offer a "flat aspheric (manufacturer-like)" base-curve table derived from the Zeiss sheets, with the source cited.

**Warning signs:** NaN or Infinity in R1. CT for +10 D or more exceeding 12 mm in CR-39. 1.74 plus lenses looking thicker than manufacturer charts by 1 mm or more.

**Phase to address:** P-Engine (clamp, curvature representation, impossibility detection); P-Validate (Zeiss base-curve comparison).

---

### Pitfall 2: Thin-lens relation D2 = F − D1 at high plus powers

**What goes wrong:**
- The Rx value is a **back vertex power** (ISO 13666 term). The thin-lens relation ignores the CT term: BVP = D1/(1 − (t/n)·D1) + D2.
- With a Vogel base, a 50 mm uncut lens, min ET 1.0 mm, and CT solved from it, a lens designed with D2 = F − D1 actually has this power error [CALC]:

| Rx | n = 1.50 (CT) | error | n = 1.67 (CT) | error |
|---|---|---|---|---|
| +2.00 | 2.38 mm | **+0.10 D** | 1.98 mm | +0.08 D |
| +4.00 | 3.86 mm | **+0.26 D** | 3.00 mm | +0.18 D |
| +6.00 | 5.49 mm | **+0.55 D** | 4.08 mm | +0.36 D |
| +8.00 | 7.37 mm | **+1.03 D** | 5.21 mm | +0.64 D |
| +12.00 | 12.83 mm | **+3.28 D** | 7.81 mm | +1.66 D |
| −4 … −12 (CT 1.5) | — | ≤ 0.016 D | — | ≤ 0.014 D |

- The ISO 8980-1 power tolerance is on the order of ±0.12 D at low powers. That figure is **UNVERIFIED** because the standard is paywalled; read Table 1 before setting it. The error therefore exceeds normal tolerance above about +2 D.
- The correct D2 is more negative (for example −6.55 D instead of −6.00 D at +6, n 1.50). That changes the back sag and hence CT and ET.
- **Circular dependency:** CT depends on D2 (through the edge constraint), and D2 depends on CT (through the vertex term). A one-pass computation is inconsistent.

**Why it happens:** idea.md §5.1 states the thin-lens relation, and most online calculators use it.

**How to avoid:**
- Use the thick-lens form D2 = F − D1/(1 − (t/n)·D1), meridian by meridian.
- Solve CT by fixed-point iteration: start from the thin estimate, then repeat solve CT → recompute D2 → solve CT. Stop at |ΔCT| < 1 µm; expect convergence in a few iterations (UNVERIFIED count; assert a maximum of 20 and test it).
- Minus lenses can still use the same code path; the correction is just tiny.
- Record the decision in the Key Decisions table.

**Warning signs:** a "power check" test that recomputes BVP from the generated surfaces and gets anything other than the input Rx. Add that test; it is the cheapest end-to-end guard.

**Phase to address:** P-Engine (formula plus iteration); P-Validate (round-trip BVP test, |error| < 0.005 D).

---

### Pitfall 3: Tool-index (1.530) curves and nominal indices taken as true values

**What goes wrong:**
- Every Zeiss FSV geometry table states: "All curves are in 1.530 Index". Lab base curves and lens-clock readings are nominal 1.53 values.
- If you plug such a curve into R = 1000(n−1)/D with n = 1.738, you get the wrong radius. For the Zeiss 1.74 −6.00 row (75 mm), the computed edge thickness becomes 5.34 mm instead of the published 7.1 mm [CALC].
- Material "1.67" is ne = 1.664 (nd 1.659). "1.74" is ne 1.738 (nd 1.731). Using the nominal value shifts (n−1) by +0.90 % for 1.67 [CALC]. That is small, but it is a systematic bias against fixtures.
- Europe (DIN/ISO, and so DACH) quotes ne at 546.07 nm, while US sheets often quote nd. Zeiss sheets give both.

**How to avoid:**
- Store per material: nominal label, ne, nd, νe, νd, density, and source URL.
- Compute with **ne** (DACH convention). Show the nominal label in the UI.
- Any manual base-curve input must declare its reference index. Recommendation: true front-surface power in Expert view, with an optional "1,53-Werkzeugindex" toggle.
- Fixture importers convert with D_true = D_1.53·(n−1)/0.53.

**Warning signs:** fixture mismatches that scale with (n − 1.53).

**Phase to address:** P-Engine (material table schema); P-Validate (fixture import).

---

### Pitfall 4: Sign-convention drift (surface power, sag, back-curve sign, eye side)

**What goes wrong:**
- Manufacturer data is itself inconsistent. In the *same* Zeiss PDF, the 1.74 sheet lists back curves as positive magnitudes (3.16, 3.70 …) and the 1.67 sheet lists them negative (−3.16, −3.56 …). A fixture importer that copies numbers verbatim flips concave to convex.
- Typical engine bugs:
  - t = CT − s1 + s2 with s2 signed in a different convention, so a minus lens comes out thinner at the edge.
  - Using |R|.
  - `R − sign(R)·√(R² − r²)` evaluated with D2 < 0, but sag sign then treated as positive.

**How to avoid:**
- Choose one convention and write it at the top of the engine:
  - The z axis points from the eye toward the object.
  - Surface sag z(x, y) is signed.
  - Curvature c > 0 means centre of curvature on +z for the front surface.
  - Back surface concave toward the eye has D2 < 0.
- Thickness at a point is t = CT + z_back(x, y) − z_front(x, y) with z measured from each vertex, or the equivalent form written out once.
- Add **invariant tests**:
  - A minus lens has ET > CT.
  - A plus lens has ET < CT.
  - A plano lens with D1 = −D2 has ET ≈ CT (the thick-lens offset makes it slightly non-zero).
  - Swapping eyes mirrors nasal and temporal.
- Fixture importer: normalise back-curve sign by asserting front − |back| ≈ F (within thick-lens error).

**Warning signs:** a minus lens heatmap that is red in the centre; "plano" lenses with 2 mm or more of wedge.

**Phase to address:** P-Engine (convention doc plus invariants); P-Validate (importer normalisation).

---

### Pitfall 5: Toric back surface modelled with meridional radius, and the error never quantified

**What goes wrong:** There are three candidate models for a sphero-cylindrical back surface:
- (a) Meridional approximation: spherical sag with c(θ) = c_axis·cos²φ + c_perp·sin²φ (Euler curvature).
- (b) Biconic.
- (c) True torus, which is what toric generators cut. There are two torus orientations, and each is a different surface.

At the 45° diagonal they disagree [CALC; n 1.50, Vogel base, r = 30 mm]:

| Rx | max sag difference between models |
|---|---|
| pl / −2.00 | 0.03 mm |
| pl / −6.00 | 0.16 mm |
| +4.00 / −6.00 | 0.10 mm |
| −6.00 / −6.00 | **0.39 mm** |
| −6.00 / −6.00 at r = 35 mm (near R) | **1.12 mm** |

> Annotated 2026-11-06 (01-08 SUMMARY, lens-critic MINOR-3): these values are the barrel torus minus the meridional model (01-08 reproduced 0.027/0.152/0.094/0.378 mm). The tyre torus the engine uses differs from the meridional model by ≤ 0.086 mm (0.014/0.013/0.021/0.086 mm); tyre vs barrel at −6/−6, r 30 is 0.464 mm.

- The model choice therefore matters at the 0.1–0.4 mm level for CYL −6, the specified maximum. Close to the sag singularity it can reach 1 mm or more.
- Also, the "torus" orientation (which principal radius is the sweep and which is the rotation) changes the result. Don't hard-code one without saying which.

**How to avoid:**
- Implement the **true torus** as the reference model: the generating circle is always the meridian perpendicular to the cylinder axis (the cross curve; the steeper one only for a concave minus-cylinder back), swept along the axis direction at the base-curve radius — the tyre form used for mass-produced toric lenses; the barrel form swaps the roles.
- Corrected 2026-11-06 per lens-critic m2 and D-03; the previous text described the barrel form.
- Keep the meridional model only as a cross-check.
- Document the chosen orientation.
- Unit test: along both principal meridians, all models must agree *exactly* with the circle sag. Off-axis, assert the documented difference.
- The error table above should become a test fixture (regenerate it in JS).

**Warning signs:** heatmap discontinuities at 45° to the axis; ET at the diagonal that changes when you swap the torus orientation.

**Phase to address:** P-Engine; P-Validate.

---

### Pitfall 6: Cylinder power put in the axis meridian, and TABO or eye mirroring wrong

**What goes wrong:**
- D(θ) = SPH + CYL·sin²(θ − Axis) puts **SPH in the axis meridian** and SPH + CYL at Axis + 90°.
- For −2.00 −1.00 × 180, the horizontal meridian is −2.00 and the vertical is −3.00, so the *top and bottom* edges are thicker. Lay intuition (and many bugs) put the cylinder "along the axis".
- TABO (ISO 8429, sometimes called the TABO system):
  - 0° is on the horizontal, to the *observer's* right when facing the wearer, and angles increase counter-clockwise.
  - This is the same for both eyes, not mirrored. For the right eye 0° points nasally; for the left eye it points temporally.
  - The wearer's right eye is drawn on the observer's left.
  - (Sources: ISO 8429 adoption GB/T 40177-2021 and OQLF "schéma TABO". MEDIUM, because the ISO body text was not readable.)
- In Three.js the wearer looks along −z or +z depending on your scene. One flipped axis mirrors every astigmatic lens in one eye.
- Decentration direction is also eye-dependent: nasal is toward the wearer's nose, which is ±x depending on the eye.

**How to avoid:**
- Define the engine frame as seen by the observer facing the wearer: +x is the observer's right, which is the wearer's left.
- Then TABO θ maps to (cos θ, sin θ) directly for both eyes.
- Nasal is +x for OD and −x for OS.
- Golden tests:
  - OD −2/−2 × 90: the horizontal edges are thicker.
  - OD × 45 vs OS × 45: both thickness maxima lie along the same screen direction (135°), not mirrored.
- In the 3D view, label "R" and "L" on the lenses from the observer's perspective, and say so.

**Warning signs:** OD and OS heatmaps that are mirror images for identical Rx with an oblique axis.

**Phase to address:** P-Engine (frame plus tests); P-Mesh (labels); P-UI (axis tooltip with a TABO diagram).

---

### Pitfall 7: Sag singularity and numeric cancellation (CPU and especially GPU)

**What goes wrong:**
- `R − √(R² − r²)` goes NaN once r > |R|. As shown under Pitfall 1, this happens within the specified range, and the toric diagonal hits it first.
- The conic form `c·r²/(1 + √(1 − (1+k)c²r²))` goes NaN whenever (1+k)c²r² > 1, which happens for k > −1 at large r.
- In float32 (GPU highp, typed arrays), the naive form is catastrophically wrong near plano [CALC, r = 30 mm]:
  - R = 1e5 mm: exact 0.0045 mm, naive float32 0.0078 mm (+73 %).
  - R = 1e6 mm: naive gives 0.
  - The stable form is exact in float32.
  - In fp16 (mediump), R² overflows above about 255 mm.

**How to avoid:**
- Only the curvature-based stable form is allowed, on both CPU and GPU.
- Guard the domain explicitly and return a typed "impossible" result, never NaN.
- Before meshing, compute the largest radius actually needed (outline points relative to the decentred optical centre). Check it against 1/|c| and the conic domain.
- Report *which* constraint failed (front, back, or which meridian).

**Warning signs:** NaN positions (Three.js renders nothing or a black lens); `computeBoundingSphere` warnings in the console.

**Phase to address:** P-Engine (domain checks); P-Refract (shader uses the stable form plus `precision highp float`).

---

### Pitfall 8: Same minimum CT for all materials, so the material comparison is wrong

**What goes wrong:**
- Real minus-lens CTs differ by material (Zeiss FSV 6/23):
  - CR-39 spherical: **1.8 mm**
  - PC: **1.3–1.5 mm**
  - 1.67: **1.2 mm**
  - 1.74: **1.1 mm**
  - Zeiss also states for 1.67: "No lens to be sold with a CT under 1.0mm".
- idea.md defaults to 1.5 mm for all materials. That favours CR-39 and penalises high index, and the comparison is exactly the "key insight" feature.
- Weight is counter-intuitive. At **equal** CT 1.5 mm, a 52 mm-class lens at −0.50 or −1.00 weighs [CALC]:

| Material | Weight (−0.50 / −1.00) |
|---|---|
| CR-39 | 4.7 / 5.2 g |
| 1.74 | 5.05 / 5.4 g |
| PC | 4.2 / 4.6 g |

- So 1.74 is **heavier** than CR-39 at low minus powers, because its density is 1.47 vs 1.32 g/cm³. With material-specific CTs (1.8 vs 1.1 mm), 1.74 becomes lighter. The comparison result hinges on a default nobody sourced.

**How to avoid:**
- Ship per-material default min CT and min ET with their source (the Zeiss sheets above). Keep a user override in Expert view.
- In comparisons, show both thickness *and* weight. Don't write "thinner = lighter" text.
- Generate summary sentences from the computed numbers, not templates.

**Warning signs:** "1.74 saves weight" shown for a −0.50 Rx without checking.

**Phase to address:** P-Engine (material table); P-UI (comparison copy).

---

### Pitfall 9: Validating against manufacturer charts without understanding what they measure

**What goes wrong:** The charts give CT and ET **at the uncut blank diameter** (65, 70 or 75 mm), centred, with no frame and no decentration. Many products are aspheric, while the tables list "Sphere Geometry" nominal curves ("indicative values calculated using the Lens Back Curve"). Reproducing them with spherical math [CALC]:

| Row | Published ET | Computed ET | Δ | Note |
|---|---|---|---|---|
| CR-39 1.50 spherical, 70 mm, −4.00 (F 3.24 / B 7.50, CT 1.8) | 7.3 | 7.22 | −0.08 | good fixture |
| CR-39 1.50 spherical, 70 mm, −0.50 | 2.5 | 2.46 | −0.04 | good fixture |
| 1.74 AS, 75 mm, −3.00 | 4.1 | 4.07 | −0.03 | |
| 1.74 AS, 75 mm, −6.00 | 7.1 | 7.14 | +0.04 | |
| 1.74 AS, 70 mm, −12.00 | 14.3 | 12.16 | **−2.14** | unexplained (diameter or asphere); exclude |
| 1.67 AS, 75 mm, −4.00 / −10.00 | 5.1 / 10.8 | 5.53 / 11.20 | +0.43 / +0.40 | aspheric |
| 1.67 AS, 65 mm, +6.00 / +4.00 | 1.05 / 1.05 | 0.41 / 0.62 | −0.64 / −0.43 | aspheric front |

- Zeiss states the CT/ET tolerance as **±0.20 mm** on these sheets.

**How to avoid:**
- Fixture tiers:
  1. **Analytic** fixtures (closed-form sphere and torus sags) at 1e-9 mm.
  2. **Spherical manufacturer rows** (CR-39 spherical, PC spherical) at ±0.20 mm, the manufacturer tolerance.
  3. **Aspheric rows** only as loose sanity checks (±0.7 mm) or excluded.
  4. Textbook worked examples (Jalie, *Principles of Ophthalmic Lenses*, ABDO; Brooks & Borish, *System for Ophthalmic Dispensing*). These were not accessible online, so transcribe from a physical copy with page numbers. LOW until done.
- Store the fixture with its source URL, document version ("Version 6/23"), row, and tool-index conversion.
- Never tune engine constants to make an aspheric row pass.

**Warning signs:** tolerances widened until tests pass; fixtures without page or row references.

**Phase to address:** P-Validate (ideally its own phase before P-Mesh).

---

### Pitfall 10: CT solver only checks principal meridians or sparse outline samples

**What goes wrong:**
- For plus and mixed lenses (for example +2.00 −4.00), the thinnest edge point is wherever the *combination* of outline radius (from the decentred OC), meridian power, and torus shape is minimal. That is often not at 0°, 90°, or the boxing corners.
- Sampling 36 outline points can miss the minimum on a rectangular or panto corner. The error grows roughly with the square of the angular step (UNVERIFIED rate, so measure it).
- Mixed lenses need both constraints: CT ≥ min CT and min over the outline of t ≥ min ET. Take the larger CT.
- Decentration moves the farthest point temporally, and the frame outline is not a circle.

**How to avoid:**
- Evaluate t over a dense outline, for example 720 samples. Refine around the discrete minimum with golden-section search on the parametric outline.
- Then verify by a coarse interior grid that no interior point violates min CT/ET. This guards against non-monotonic profiles near the singularity.
- Test: a rotating axis 0…180° in 1° steps must produce a continuous CT curve with no jumps.

**Phase to address:** P-Engine.

---

### Pitfall 11: Decentration formula right, but direction, units and blank size wrong

**What goes wrong:**
- The formula dec = (A + DBL)/2 − mono PD is correct; it is equivalent to ((A + DBL) − binocular PD)/2 (secondary teaching sources, MEDIUM). Positive means **inward (nasal)**, negative means outward. Common bugs:
  - Using binocular PD in the monocular formula (64 instead of 32 gives a −28 mm decentration).
  - Applying the same sign of x to both eyes.
  - Forgetting vertical decentration when a fitting height is given.
- The **minimum blank size** MBS = ED + 2·dec + about 2 mm (teaching sources) can exceed the available blank (Zeiss sheets: 65/70/75 mm). A large frame with a small PD is not orderable as a stock lens, and the user is never told.

**How to avoid:**
- Validate that the PD is monocular. If the value is above 40, assume binocular, ask "Meinten Sie Gesamt-PD?", and offer to halve it.
- Compute MBS from the actual outline (max distance from OC × 2) and warn above 75 mm (the "Mehr als Rohglasdurchmesser" warning). The 75 mm threshold comes from the Zeiss sheets; other suppliers differ.
- Write the eye-specific sign in one helper with tests.

**Phase to address:** P-Engine; P-UI (PD parsing).

---

### Pitfall 12: Aspheric conic constant presented as a real-lens parameter

**What goes wrong:**
- Manufacturers do not publish k. Real ophthalmic aspherics are proprietary polynomial or atoric surfaces, often on the front for plus and on the back for minus. I found **no citable k values** (gap).
- Most of the real thinness of aspheric lenses comes from the **flatter base curve** that the asphere makes optically acceptable (see the Zeiss front curves in Pitfall 1), not from the conic term itself.
- Another bug: putting the conic on the wrong surface, or using a sign of k that steepens instead of flattens toward the periphery. A convex front flattens for k < 0.

**How to avoid:**
- Expose k only in Expert view, labelled "Modellparameter – keine Herstellerangabe".
- The default k = 0 means spherical, unless a sourced value is found.
- Model "aspheric" in Simple view as "flatter base curve" plus conic, and say so.
- Guard the domain of the conic sag (Pitfall 7).

**Phase to address:** P-Engine; P-UI copy.

---

### Pitfall 13: MeshPhysicalMaterial transmission treated as optics

**What goes wrong (three.js r187 docs and maintainers):**
- Transmission samples a **screen-space render target of the opaque scene**. Other transmissive or transparent objects are not visible through it (donmccurdy on discourse.threejs.org: supporting this would be "expensive" and is "not currently implemented"). In side or top views, the second lens is missing behind the first.
- `thickness` is a **single scalar** "in the coordinate space of the mesh" (an optional `thicknessMap` in the green channel scales it). It does not read the actual geometric thickness. A −8 lens edge and its centre refract identically unless you bake a thicknessMap.
- If the scene is modelled in mm, thickness = 3 means 3 mm. If it is in metres, the value must change too, which is a units trap.
- Docs: when transmission is non-zero, opacity "should be set to 1". MeshPhysicalMaterial "has a higher performance cost, per pixel".
- Transmission costs an extra render pass. `renderer.transmissionResolutionScale` (default 1) is the documented performance lever.
- DoubleSide transmission: an open bug reports back-side rendering failing with `WEBGL_multisampled_render_to_texture` (three.js #28131, observed in Oculus Browser). Forum reports describe transmission failing on some Android devices.

**How to avoid:**
- Label the baseline in the UI as "Darstellung angenähert".
- Never derive a number from it.
- Bake a per-vertex thickness into a thicknessMap only if it visibly helps.
- Put the checkerboard or eye chart (opaque) behind the lens.
- On mobile, set `transmissionResolutionScale` to about 0.5. Feature-detect, and fall back to a plain transparent material if FPS drops.
- The accurate mode is a separate ray-trace shader over the analytic sag (Pitfall 7 applies).

**Phase to address:** P-Refract.

---

### Pitfall 14: Triangulating the outline with earcut, so the lens surface is flat

**What goes wrong:**
- `ShapeUtils.triangulateShape` and `ShapeGeometry` use Earcut (three.js source, `src/extras/ShapeUtils.js`). Earcut only uses the outline vertices, so there are **no interior vertices** to carry the sag. The result is long sliver triangles spanning the lens, faceted lighting, and a heatmap that interpolates linearly across the whole lens.
- `computeVertexNormals()` on a shared-vertex mesh averages normals across the 90° crease between the faces and the edge band. The result is smeared, dark edges.
- Back-face winding errors make the concave back surface render inside-out under transmission.

**How to avoid:**
- Use parametric star-shaped outlines r(φ) about the boxing centre. Build a **polar grid**: rings at fractions of r(φ), and identical angular sampling on front, back and edge band.
- Evaluate sag at each vertex relative to the *decentred optical centre*.
- Front-ring vertices and back-ring vertices are shared with the edge band only by position: duplicate the vertices so each side has its own normals.
- Use **analytic normals** from the sag gradient on the faces, and the outline normal on the band.
- If an outline is not star-shaped about the boxing centre (some aviators may not be; check), use constrained Delaunay with Steiner points instead.
- Test that the outline is star-shaped for every preset at its min and max A and B.

**Warning signs:** visible facets at grazing light; a heatmap with straight colour bands; normals inspected with `VertexNormalsHelper` pointing inward.

**Phase to address:** P-Mesh.

---

### Pitfall 15: Re-mesh leaks and allocation churn

**What goes wrong:** three.js manual: GPU resources "are not released automatically". Removing a mesh from the scene does not dispose its geometry or material, and buffers "cannot be resized". Creating a new BufferGeometry on every slider tick leaks GPU memory and stutters on phones.

**How to avoid:**
- Keep a fixed topology: the same ring and angle counts regardless of Rx or frame.
- Update `position`, `normal` and `color` in place, then set `needsUpdate = true`.
- Only `dispose()` and recreate the geometry when the quality level changes.
- Dispose materials, textures and render targets on view teardown.
- Assert in a dev overlay that `renderer.info.memory.geometries` stays constant over 100 Rx changes.
- Throttle recomputation with `requestAnimationFrame` coalescing. Run the engine in a Worker only if profiling shows more than about 8 ms per update; that threshold is UNVERIFIED and should be set in requirements.

**Phase to address:** P-Mesh; P-Perf/A11y (leak test).

---

### Pitfall 16: Lay-user Rx misreading, especially in German

The usability pitfalls are as critical as the optics ones. See **UX Pitfalls** and **German (de-AT) Pitfalls** below.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Thin-lens D2 = F − D1 | Simpler solver | Power error over 0.25 D above +4 D (n 1.5); thickness inconsistent | Never in shipped engine; ok as initial guess |
| Meridional toric | Reuses sphere sag | 0.1–0.4 mm error at CYL −6 | Only as cross-check |
| Nominal index (1.67) instead of ne 1.664 | Matches label | 0.9 % bias vs fixtures | Never; store both |
| One global min CT | One slider | Wrong material comparison | Never as default |
| Rebuild geometry per input | Easy code | GPU leaks, jank | Prototype only |
| Earcut on outline | One line of code | Flat lens, wrong heatmap | Never for faces; ok for 2D frame rim fill |
| `parseFloat` on user input | Trivial | "-2,25" → −2 silently (verified in Node 22) | Never |
| Hard-coded German strings in components | Faster | Blocks later English; inconsistent terms | Never; one dictionary from day one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Manufacturer PDFs as fixtures | Copy curves as true-index; copy back-curve sign verbatim | Convert from 1.530; normalise sign; record doc version |
| Three.js version | Floating `three@latest`; WebGL1 assumptions | Pin exact version (latest is r187, released 2026-10-30 per GitHub API); WebGL1 unsupported since r163 |
| OrbitControls on phones | Canvas eats vertical swipes, so the page can't scroll to the controls | `touch-action` policy plus a layout where controls never require scrolling the canvas |
| `Intl.NumberFormat` output | Re-parsing formatted strings (de-AT grouping is U+00A0, de-DE is ".") | Keep numbers numeric; format only at render |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Transmission pass at full res | Under 30 fps on mid-range phones | `transmissionResolutionScale` 0.5, fallback material | Mobile GPUs (threshold UNVERIFIED; measure) |
| Two physical materials × two lenses + shadows | Fill-rate bound | One env map, no shadows on lenses | Phones, high-DPR screens |
| Volume integration on fine grid every keystroke | Input lag | Coarse grid while dragging, fine on release; Simpson over polar grid | More than ~10⁵ samples per update (UNVERIFIED) |
| `devicePixelRatio` 3 on phones | Hot device, low fps | Cap pixel ratio at 2 | iPhones/flagship Android |
| mediump fallback in custom shader | Wobbly or NaN distortion | Declare `highp`; normalise coordinates; stable sag | GPUs without fragment highp |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rx stored in URL/share links or analytics | Health data leaks (GDPR Art. 9 special category: data concerning health) | Keep Rx in memory/localStorage only; no third-party analytics on input |
| Third-party CDN for three.js | Supply chain, offline breakage | Bundle pinned copy; SRI if CDN |
| Presenting output as fitting advice | Liability; users order wrong lenses | Visible German disclaimer next to numbers, not only in footer |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| OD/OS vs screen left/right | Values entered in the wrong eye, or confusion when the 3D right lens appears on the screen's left | Rows "R (rechtes Auge)" / "L (linkes Auge)"; in 3D label lenses and state "Ansicht von vorne"; front-view preset as default |
| Plus vs minus cylinder | Plus-cyl Rx entered into minus-cyl fields → wrong lens | Accept sign as written, transpose internally (S' = S+C, C' = −C, axis ±90 wrapped to 1…180); show "umgerechnet" note; check range *after* transposition |
| Missing cylinder sign on paper ("1,00" under Zyl) | Ambiguous | Ask, don't assume |
| ADD entered into SPH | Distance lens computed with near power | Separate optional "Add" field explained as "nur für Lesen/Gleitsicht"; optionally compute reading-glasses lens = SPH + ADD (still single vision) |
| PD "64/61" (distance/near) read as R/L | Wrong decentration | Detect two values differing by ~3 mm with sum over 100 → ask; values over 40 → binocular |
| PD absent on ophthalmologist's Rx (common, since opticians measure it; UNVERIFIED frequency) | User blocked | Default 32/32 labelled "Schätzwert", explain impact |
| Contact-lens Rx entered (has BC/DIA, different powers) | Wrong results | Tooltip: "Kontaktlinsenwerte sind nicht gleich Brillenwerten" |
| Visus column (e.g. "1,0", "0,8") mistaken for SPH | Nonsense lens | Explain Visus is visual acuity, not needed |
| Values with vertex distance (HSA) differing from fit | Small power shift above ±4 D | Explain HSA in Expert tooltip; out of scope to recompute (v1) |
| Misleading precision ("6,13 mm", "7,594 g") | False trust; differs from optician's lens by tenths | Simple view: ET/CT to 0,1 mm with "ca."; weight to 0,5 g or 1 g; Expert view may show 0,01 mm, labelled "Modellwert" |
| Heatmap by colour alone | Inaccessible | Numeric callouts plus legend; colour-blind-safe map (e.g. viridis) |
| Axis "0" vs "180" | Users think 0 is invalid | Accept both, display 180 (convention: 1…180) |

## German (de-AT) Pitfalls

### Terminology lay users see on Austrian/German Rx and Brillenpass

| Term on paper | Meaning | Pitfall | Guidance |
|---|---|---|---|
| **R / L** (sometimes RA/LA, OD/OS) | right/left eye of the *wearer* | Confused with screen left/right | Always "rechtes Auge (R)" |
| **Sph** | sphere | Read as the only "Stärke" | Tooltip: "kurzsichtig (−) / weitsichtig (+)" |
| **Zyl** (also "Cyl") | cylinder | Unknown term; sign may be missing | Tooltip: "Ausgleich einer Hornhautverkrümmung (Astigmatismus)" |
| **Achse** (A) | cylinder axis in degrees (TABO) | Thought to be a quantity of strength | "Richtung in Grad (0–180), nur zusammen mit Zyl" |
| **Add** | reading addition | Added to Sph by users | Separate field, explained |
| **Prisma / Basis** | prism and base direction | Out of scope in v1, but appears on paper | Accept-and-ignore with an explicit note "Prismen werden nicht berechnet". Never silently drop |
| **PD** | pupillary distance | binocular vs monocular; distance/near | See UX table |
| **HSA** (Hornhautscheitelabstand) | vertex distance | Entered into PD | Recognise "HSA" label in help text |
| **dpt** | dioptre unit | Users type "dpt" or "D" after the number | Parser strips the unit |
| **plan / pl / ±0,00 / 0** | zero power | "plan" not accepted as a number | Parser maps to 0 |
| **"kurzsichtig/weitsichtig"** | myopia/hyperopia | Lay German often says "weitsichtig" for **Alterssichtigkeit** (presbyopia). MEDIUM, common usage | Preset names: "Kurzsichtig (Minusglas)", "Weitsichtig (Plusglas)", plus a "Lesebrille" hint |

### Misleading translations

- **"Stärke"** is ambiguous in German. "Glasstärke" and "Sehstärke" colloquially mean dioptric power, but "Stärke" also means material thickness ("Wandstärke", "Materialstärke"). A sentence like "geringere Stärke mit 1,67" can be read as "lower power". **Never use "Stärke" for thickness.** Use "Wirkung/Dioptrien (dpt)" for power and "Dicke" for thickness.
- **"Glasdicke"** is underspecified. Always say **"Mittendicke"** (CT) or **"Randdicke"** (ET, with location: "nasal / schläfenseitig / oben / unten"). "Temporal" is jargon, so prefer "schläfenseitig (außen)" and "nasal (zur Nase)".
- **"Linse"** suggests contact lens or lentil. The trade and lay term is **"Brillenglas"**, also for plastic ("Kunststoffglas"). "Mineralglas" means real glass.
- **"Index"** → "Brechungsindex" (Expert) or "dünneres Material (1,67)" (Simple). Avoid suggesting that "1,74 is always better" (see Pitfall 8).
- **"Basiskurve"**: German trade usage includes "Basiskurve" and "Durchbiegung". Pick one and give the other in the tooltip (LOW; confirm with an Austrian optician).
- **Frame data** on the temple reads like "52□18 140". Map them as Scheibenbreite (A) □ Stegbreite/Brückenbreite (DBL), Bügellänge. Show that the user can read A and DBL off the frame.

### Number parsing and formatting (verified in Node v22.17.0 on this machine)

- `parseFloat("-2,25")` returns **−2**: silent truncation. `Number("-2,25")` is NaN. `parseFloat("2.25-")` returns 2.25 (sign lost). `Number("−2.25")` with U+2212 is NaN. You need a dedicated parser that:
  - Normalises U+2212, U+2013 and U+2010 to "-".
  - Accepts "," or "." as the decimal separator.
  - Handles trailing signs, "dpt", "D", "°", a leading "x" for the axis, "plan" and "pl".
  - Rejects mixed separators like "1.000,25".
  - Never clamps silently; it reports in German ("Bitte in 0,25-Schritten eingeben – meinten Sie −2,25?").
- `new Intl.NumberFormat("de-AT")` uses **U+00A0 as grouping** ("12 345,6"); de-DE uses "." ("12.345,6"). Never re-parse formatted output.
- Intl rounding disagrees with `toFixed`: `Intl…format(1.005)` gives "1,01" while `(1.005).toFixed(2)` gives "1.00". One formatting helper only.
- With `maximumFractionDigits:1`, −0.04 formats as **"-0"**. Use `signDisplay: "exceptZero"` (verified: 0 → "0,00") for powers, and treat thickness or weight deltas near zero explicitly.
- Powers should always show a sign and two decimals ("+1,00 dpt", "−2,25 dpt"), as on Rx. Intl outputs hyphen-minus "-" for de-AT (verified code point 0x2d). Decide whether to display U+2212 typographically. Screen readers may read U+2212 differently, so test with NVDA/VoiceOver (UNVERIFIED).
- `Intl.DateTimeFormat("de-AT",{month:"long"})` yields **"Jänner"** (verified). Use Intl and don't hand-roll month names.
- `<input type="number">` parsing depends on the browser and locale. Use `type="text" inputmode="decimal"`. **Risk:** the iOS decimal keypad may have no minus key (UNVERIFIED; test on device). Provide an explicit ± toggle or stepper next to Sph/Zyl.

### Layout

- Long compounds break narrow screens: "Hornhautscheitelabstand", "Mindestmittendicke", "Mindestranddicke", "Pupillendistanz", "Brechungsindexvergleich".
  - `hyphens: auto` needs `lang="de-AT"` on `<html>`, and browser support for German hyphenation varies (UNVERIFIED per browser; check caniuse).
  - Add soft hyphens (`&shy;`) to known long words in the dictionary, plus `overflow-wrap: anywhere` on table headers.
  - Use abbreviations with `<abbr title>` (Sph, Zyl, PD, HSA) in the Rx table, matching the paper.
- German UI text typically runs longer than English. Design the phone Rx table at 320 px width with the German strings from the start.

## "Looks Done But Isn't" Checklist

- [ ] **Base curve auto:** check SE −12, −15 and +12 at A62/B55. No NaN, and an explained impossibility.
- [ ] **Thick-lens:** round-trip BVP from the generated surfaces equals the Rx within 0.005 D for +12, −12 and mixed.
- [ ] **Materials:** every row has ne, nd, νe, density and a source URL; computation uses ne.
- [ ] **Per-material min CT** defaults sourced; comparison at −0.50 shows honest weight.
- [ ] **Toric:** principal meridians match the circle sag exactly; the 45° error documented; axis sweep is continuous.
- [ ] **TABO/eyes:** the OD/OS × 45 golden test passes; nasal decentration has the correct x sign per eye.
- [ ] **Blank size:** warning when MBS > 75 mm.
- [ ] **Fixtures:** spherical CR-39/PC rows within ±0.20 mm; aspheric rows marked as sanity only.
- [ ] **Mesh:** no interior earcut; analytic normals; `renderer.info.memory.geometries` constant over 100 edits.
- [ ] **Shader:** `highp` declared; stable sag; NaN-free at R → ∞.
- [ ] **Parser:** "-2,25", "−2,25", "2,25-", "plan", "+1", "x180", "180°", "-2.25 dpt" all handled; "64" in a mono-PD field triggers a question.
- [ ] **German copy:** no "Stärke" for thickness; "Mittendicke"/"Randdicke" with location; disclaimer next to the numbers.
- [ ] **Layout:** Rx table at 320 px with German strings, no horizontal overflow.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Radius-based engine (NaN at plano) | MEDIUM | Refactor to curvature; stable sag; rerun all fixtures |
| Thin-lens solver shipped | MEDIUM | Add vertex term plus iteration; regenerate snapshots; note change in UI changelog |
| Wrong toric model | LOW–MEDIUM | Swap sag function behind interface; analytic tests catch regressions |
| Mirrored axis/eye | LOW | Fix frame helper; golden tests |
| Earcut mesh | MEDIUM | Replace with polar grid; heatmap/cross-section consumers unchanged if mesh API stable |
| Hard-coded strings | MEDIUM | Extract to dictionary; lint rule against literal JSX/HTML text |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Vogel extremes | P-Engine | Range sweep test SE −15…+12 × all frames |
| 2 Thin vs thick | P-Engine | BVP round-trip test |
| 3 Tool index / ne | P-Engine, P-Validate | Fixture conversion test |
| 4 Sign drift | P-Engine | Invariant tests (minus ET > CT etc.) |
| 5 Toric model | P-Engine, P-Validate | Principal-meridian exactness + documented 45° delta |
| 6 Cyl meridian / TABO / eye | P-Engine, P-Mesh | OD/OS golden tests, visual check |
| 7 Singularity / precision | P-Engine, P-Refract | NaN fuzz test over input grid; float32 test |
| 8 Per-material CT / weight | P-Engine, P-UI | Comparison snapshot at −0.50, −4, −8 |
| 9 Fixture semantics | P-Validate | Tiered fixtures with source refs |
| 10 CT search | P-Engine | Axis sweep continuity; dense-vs-refined agreement |
| 11 Decentration / blank | P-Engine, P-UI | Per-eye sign test; MBS warning test |
| 12 Conic claims | P-Engine, P-UI | Copy review by lens-critic |
| 13 Transmission | P-Refract | Mobile fps test; side-view second-lens check |
| 14 Triangulation / normals | P-Mesh | Normals helper; heatmap vs engine at random points |
| 15 Leaks | P-Mesh, P-Perf | renderer.info memory test |
| 16 German UX / parsing | P-UI | Parser unit tests; 320 px screenshots; lay-user test |

**Ordering implication:** P-Engine and P-Validate come before P-Mesh. Pitfalls 1–12 are all engine-level, and the mesh and UI only display engine output, so fixing them later forces snapshot churn everywhere. P-Refract (accurate mode) should be last and optional.

## Sources

**Primary (HIGH, downloaded and read 2026-11-06):**
- ZEISS Finished Single Vision Fact Sheets, Version 6/23. Materials ne/nd/Abbe/density for 1.50 ADC, PC, Trivex, 1.67 and 1.74; CT/ET tables; "All curves are in 1.530 Index"; ±0.20 mm tolerance; min-CT notes. https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf
- ZEISS ClearView FSV Fact Sheets, Version 6/23. 1.60 MR-8: nd 1.595, ne 1.598, νd 41, νe 40, density 1.30–1.31; 1.67 MR-7 density 1.36. https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/clearview-lensspec.pdf
- Mitsui Chemicals MR™ brochure and physical properties tables (ne, νe; no density published): https://jp.mitsuichemicals.com/en/special/visioncare/assets/pdf/1-1/mr_brochure_en.pdf, https://jp.mitsuichemicals.com/jp/special/visioncare/assets/pdf/2-2/mr_en_3.pdf, https://jp.mitsuichemicals.com/en/special/mr/lineup/
- Essilor Airwear ECP sales aid (1.59, Abbe 31, 1.20 g/cm³): https://info.icarelabs.com/hubfs/Airwear%20-%20ECP%20Sales%20Aid.pdf
- three.js docs: MeshPhysicalMaterial https://threejs.org/docs/pages/MeshPhysicalMaterial.html; WebGLRenderer (precision, transmissionResolutionScale, info.memory) https://threejs.org/docs/pages/WebGLRenderer.html
- three.js manual source: how-to-dispose-of-objects and how-to-update-things (`manual/pages/` in mrdoob/three.js dev); `src/extras/ShapeUtils.js` (Earcut). Latest release r187 (GitHub API).

**Verified material summary (for STACK/engine):**

| Material | nd | ne | νd / νe | Density g/cm³ | Source |
|---|---|---|---|---|---|
| CR-39 / ADC 1.50 | 1.500 | 1.502 | 58 / 56 (one sheet 58/58; Mitsui 57–58) | 1.32 | Zeiss FSV 6/23 |
| Polycarbonate 1.59 | 1.586 | 1.590 | 30 / 29–30 (Essilor 31; Mitsui 28–30) | 1.20 | Zeiss FSV, Essilor |
| 1.60 (MR-8) | 1.595 | 1.598 | 41 / 40 (Mitsui νe 41) | 1.30–1.31 | Zeiss ClearView |
| 1.67 (MR-7) | 1.659–1.660 | 1.664–1.665 | 31–32 | 1.35–1.36 | Zeiss FSV, ClearView |
| 1.74 (MR-174) | 1.731–1.734 | 1.738–1.739 | 32.6 / 32 | 1.47 | Zeiss FSV, ClearView |

The idea.md densities (1.32 / 1.20 / 1.30 / 1.35 / 1.47) are **confirmed**.

**Secondary (MEDIUM/LOW):**
- Vogel's rule form and worked examples: https://open-exam-prep.com/study-guides/abo-advanced/optics-ii/thickness-magnification-effective-power ; https://www.optiboard.com/forums/forum/optical-forums/general-optics-and-eyecare-discussion-forum/13435-vogel-s-rule
- Decentration and MBS: https://open-exam-prep.com/study-guides/national-opticianry/prism-lens-math-and-troubleshooting/minimum-blank-size-and-effective-diameter ; https://www.slideshare.net/slideshow/reference-point-placementppt-version-1ppt/258336899
- TABO / ISO 8429: https://www.chinesestandard.net/PDF.aspx/GBT40177-2021 ; https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8894115/schema-tabo ; https://cdn.standards.iteh.ai/samples/15607/3ed26be5657c47f3ad578588aa89e0db/ISO-8429-1986.pdf
- ISO 8980-1:2017 tolerance band structure (values not readable): https://standards.iteh.ai/catalog/standards/iso/de21671c-d072-41b0-8f50-f69eb42438dd/iso-8980-1-2017
- Transmission limitations: https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113 ; https://github.com/mrdoob/three.js/issues/28131 ; https://discourse.threejs.org/t/transmission-of-meshphysicalmaterial-doesnt-work-on-some-android-devices/28836
- Toric worked example (forum, needs textbook confirmation): https://www.optiboard.com/forums/forum/optical-forums/ophthalmic-optics/39267-sag-formulae
- Textbooks to transcribe fixtures from (not accessed, LOW): M. Jalie, *Principles of Ophthalmic Lenses* (ABDO); Brooks & Borish, *System for Ophthalmic Dispensing* (3rd ed.).

**Gaps:** real conic constants (none found); ISO 8980-1 tolerance values (paywalled); textbook worked examples (offline); iOS decimal keypad minus key; browser support for German `hyphens:auto`; Austrian optician terminology preference (Basiskurve vs Durchbiegung). These should be confirmed with an optician.

---
*Pitfalls research for: browser-based 3D eyeglass lens & frame simulator (de-AT)*
*Researched: 2026-11-06*
