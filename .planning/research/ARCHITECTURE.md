# Architecture Research

**Domain:** Browser-based, physically computed 3D eyeglass lens & frame simulator (static site, Three.js)
**Researched:** 2026-11-06
**Confidence:** MEDIUM-HIGH. Component boundaries and data flow are HIGH (they follow from the spec's constraints plus verified Three.js behaviour). Performance budgets are MEDIUM: they come from a desktop Node benchmark, and the phone figures are extrapolated. The optics sign conventions are HIGH as a requirement, but the exact formulas are for the optics/stack researchers to verify.

---

## TL;DR (opinionated)

1. **Five layers, one direction of data flow:** `state → (parse/validate) → engine → {mesh builder, analytics} → renderer/DOM`. Nothing downstream writes back upstream except through UI actions on the store.
2. **The engine owns every number, including the 2D sampling of the lens area.** The mesh builder never evaluates optics. It only turns the engine's sampled point/thickness arrays into GPU buffers. Volume, weight, heatmap colours, callouts and the cross-section all come from the same `LensResult`.
3. **Use a structured "ring mesh" that conforms to the outline, not Earcut.** Concentric copies of the outline, scaled toward the boxing centre, give a fixed topology for a given resolution tier. Every re-mesh then rewrites existing `Float32Array`s in place: no reallocation, no new index buffer, no dispose churn. This needs star-shaped outlines, which all four parametric shapes are, and a unit test enforces it.
4. **Stay on the main thread synchronously for v1.** Benchmark below: about 0.5 ms per lens at 12k samples on a desktop i7, so roughly 2–5 ms per lens on a mid-range phone (estimate). Keep the engine contract serializable (plain objects + typed arrays) so moving it into a module Worker is mechanical if profiling ever calls for it.
5. **"Accurate refraction" should be a CPU ray-traced warp grid computed by the engine's own JS ray tracer, not a GLSL re-implementation of the sag functions.** It reuses the exact tested JS surfaces, works on every phone, and doubles as a verification oracle: tracing paraxial rays through the generated lens must reproduce the entered SPH/CYL.
6. **Pin one coordinate frame for everything (engine = Three.js local frame = examiner's front view).** TABO axis, nasal direction and decentration sign then need no per-eye mirroring in the mesh layer. This removes the single most likely class of bugs.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UI LAYER (DOM, i18n, a11y)                                               │
│  ┌───────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ Rx table  │ │ Frame/Mat. │ │ Simple /   │ │ Comparison │ │ Summary │ │
│  │ (OD/OS)   │ │ controls   │ │ Expert tgl │ │ A vs B     │ │ text    │ │
│  └─────┬─────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────▲────┘ │
│        │ actions     │              │              │             │      │
├────────▼─────────────▼──────────────▼──────────────▼─────────────┼──────┤
│ STATE LAYER (pure JS)                                            │      │
│  ┌──────────────────────┐   ┌──────────────────────────────┐     │      │
│  │ Store (raw inputs,   │──►│ parse + validate + normalize │     │      │
│  │ view prefs, scenarios│   │ (comma decimals, +cyl→−cyl,  │     │      │
│  │ URL-hash sync)       │   │ issue codes, never clamps)   │     │      │
│  └──────────────────────┘   └──────────────┬───────────────┘     │      │
│                                            │ LensSpec ×2 (×N)    │      │
├────────────────────────────────────────────▼─────────────────────┼──────┤
│ DOMAIN LAYER (pure JS, no DOM, no Three.js, unit-tested in Node) │      │
│  ┌──────────────┐   ┌───────────────────────────────────────┐    │      │
│  │ frame-outline│──►│ optics engine                         │    │      │
│  │ (A×B boxing, │   │ power → radii → sag → CT solve (thick-│    │      │
│  │ shapes, rim) │   │ lens fixed point) → field → metrics → │    │      │
│  └──────────────┘   │ diagnostics; ray tracer (oracle+warp) │────┘      │
│                     └───────────────────┬───────────────────┘ LensResult│
├─────────────────────────────────────────▼────────────────────────────────┤
│ PRESENTATION LAYER                                                        │
│  ┌──────────────────┐ ┌───────────────┐ ┌──────────────────────────────┐ │
│  │ mesh builder     │ │ analytics     │ │ renderer (Three.js)          │ │
│  │ (BufferGeometry, │ │ (heatmap LUT, │ │ scene, materials, cameras,   │ │
│  │ in-place update) │ │ SVG x-section,│ │ OrbitControls, render-on-    │ │
│  └────────┬─────────┘ │ callouts)     │ │ demand, transmission / warp  │ │
│           └──────────►└───────┬───────┘ └──────────────────────────────┘ │
│                               └──────────────► (geometry, colours, DOM)  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Must NOT | Implementation |
|-----------|------|----------|----------------|
| **Store** (`state/`) | Raw user input strings, view mode (Simple/Expert), selected scenario(s), camera preset, heatmap toggle, locale | Compute optics; hold derived numbers as source of truth | Plain object + `subscribe()` (~50 lines), URL-hash serializer for shareable static links |
| **Parse/validate** (`state/parse.js`, `state/validate.js`) | `"-2,25"` → `-2.25`; plus-cyl → minus-cyl transposition; axis 0≡180 normalisation; range checks; cross-field checks (CYL without AXIS); issue **codes**, not strings | Silently clamp; produce UI text | Pure functions, table-driven tests |
| **Frame-outline** (`domain/frame/`) | Parametric shapes normalised to exact A×B bounding box; boxing centre; per-eye mirroring of the shape; tagged extreme points (N/T/S/I); rim/bridge/temple parameters | Know about optics or Three.js | Pure functions returning `Float64Array` polygons |
| **Optics engine** (`domain/optics/`) | Conventions, meridian power, surface curvatures, sag (sphere, conic, toric), thick-lens D2 correction, CT solve, decentration, thickness field over the sampled area, metrics, volume, weight, protrusion, diagnostics, ray tracer | Touch DOM/Three; format numbers for display; know about colours | Pure ES modules, JSDoc types + `// @ts-check`, Vitest |
| **Mesh builder** (`render/mesh/`) | Converting `LensResult` arrays into position/normal/color/index buffers for front, back and edge band; frame rim/bridge/temple geometry | Evaluate sag or thickness itself | Three.js `BufferGeometry`, allocate-once per resolution tier |
| **Renderer** (`render/`) | Scene, lights, environment/chart backdrop, materials (transmission baseline, heatmap mode, warp view), camera presets, OrbitControls, render-on-demand loop, resize/DPR policy, disposal | Hold app state beyond Three objects | `WebGLRenderer`, `MeshPhysicalMaterial`, `OrbitControls` |
| **Analytics** (`analytics/`) | Heatmap colour LUT + legend ticks, callout anchor positions, 2D cross-section SVG, A/B delta table | Recompute thickness (reads `LensResult` / `engine.profile()`) | Pure data prep + small DOM/SVG renderers |
| **UI** (`ui/`) | DOM controls, tooltips, Simple/Expert disclosure, comparison layout, responsive layout, a11y labels, i18n lookup + `Intl.NumberFormat` | Any optics math | Vanilla ES modules + `<template>`s (or a tiny reactive lib if the stack researcher picks one) |

---

## Data Contracts

All contracts are **plain, structured-clone-safe data** (objects, numbers, strings, typed arrays). That keeps them testable in Node and lets the engine move behind a Worker boundary without API changes.

### Coordinate & sign convention (single source: `domain/optics/conventions.js`)

| Item | Convention | Why |
|------|-----------|-----|
| Units | mm, dioptres; Three.js scene unit = 1 mm | No unit conversion at the engine/mesh boundary; `MeshPhysicalMaterial.thickness` is "in the coordinate space of the mesh" (three.js docs), so mm works directly |
| Lens-local frame | Origin = **boxing centre** of that lens. +x = **examiner's right** (= wearer's left), +y = up, +z = out of the face toward the examiner/camera | Equals the Three.js local frame of each lens mesh when the Front camera sits at +z, so the mesh layer never mirrors |
| TABO axis | Angle measured counter-clockwise from +x in this frame, **identical for OD and OS** | TABO is defined from the examiner's view, both eyes alike. Mirroring the frame per eye would silently flip the axis on one eye |
| Nasal direction | OD: nasal = +x. OS: nasal = −x. `nasalSign = eye === 'OD' ? +1 : -1` | OD sits at scene x = −(A+DBL)/2, OS at +(A+DBL)/2 |
| Optical centre | `oc = { x: nasalSign · dec, y: fittingHeightOffset }`, with `dec = (A+DBL)/2 − monoPD` | Per spec 5.7 |
| Surfaces | Front vertex at z = 0; `zFront(x,y) = −sagFront(r)`; `zBack(x,y) = −CT − sagBack(x,y)`; `t = zFront − zBack = CT − sagFront + sagBack` | Matches spec 5.6 with sags as signed values measured toward the eye |
| Back radius sign | Pick **one** signed convention (recommended: Cartesian, light travelling −z, `D2 = (1−n)/R2`) and derive `c2` from it. The spec's `R2 = 1000(n−1)/D2` is the magnitude form; used naively it gives the wrong sign for concave backs | Sign errors here invert thickness trends. `lens-critic` should check this first |

### `LensSpec` (state layer → engine), one per eye per scenario

```js
/** @typedef {{
 *   eye: 'OD'|'OS',
 *   rx: { sph: number, cyl: number /* ≤ 0, canonical minus-cyl */, axisDeg: number /* [0,180) TABO */ },
 *   monoPD: number,                                   // mm
 *   fittingHeight?: number,                           // mm above boxing-bottom, Expert only
 *   material: { id: string, n: number, density: number /* g/cm³ */, abbe?: number },
 *   design: {
 *     baseCurve: { mode: 'auto' } | { mode: 'manual', D1: number },
 *     frontConic: number,                             // k, 0 = sphere
 *     minCT: number, minET: number,                   // mm
 *     thickLensCorrection: boolean                    // default true (decision documented)
 *   },
 *   frame: FrameSpec                                  // shared by both eyes
 * }} LensSpec */
```

Every numeric field is already parsed, normalised and validated. **The engine never sees strings.**

### `FrameSpec` → `Outline` (frame module)

```js
/** @typedef {{ shape: 'round'|'rect'|'panto'|'aviator', A: number, B: number, DBL: number,
 *              rimDepth: number, rimWidth: number, shapeParams?: object }} FrameSpec */

/** @typedef {{
 *   eye: 'OD'|'OS',
 *   pts: Float64Array,        // [x0,y0,x1,y1,…], CCW, closed implicitly, N points, lens-local frame
 *   N: number,                // fixed per resolution tier (e.g. 128 / 256 / 360)
 *   bbox: { minX, maxX, minY, maxY },   // == ±A/2, ±B/2 exactly (boxing definition)
 *   extremes: { nasal: i, temporal: i, superior: i, inferior: i },  // indices into pts
 *   starShaped: true          // asserted in tests: every ray from (0,0) hits the outline once
 * }} Outline */
```

- Sample by **arc length**, not uniform angle, so rectangle and panto corners get vertices. Then normalise so the bbox equals A×B. The boxing centre is the bbox centre, **not** the centroid.
- The outline is pure geometry: identical for any Rx, so it is cached by `FrameSpec` hash.

### `LensResult` (engine → mesh builder, analytics, UI)

```js
/** @typedef {{
 *   ok: boolean,
 *   diagnostics: Array<{ code: string, severity: 'info'|'warn'|'error', data?: object }>,
 *        // e.g. SAG_UNDEFINED_AT_EDGE, LENS_IMPOSSIBLE_IN_FRAME, OC_OUTSIDE_OUTLINE,
 *        //      CT_RAISED_BY_EDGE_CONSTRAINT, THICK_LENS_NOT_CONVERGED
 *   surfaces: { D1, n, c1, k1, back: { model: 'meridional'|'biconic'|'torus', cA, cB, axisRad } },
 *        // the exact parameter set, reused by the ray tracer and any future shader
 *   oc: { x, y },
 *   metrics: {
 *     ct, etMax: { value, idx, location }, etMin: { value, idx, location },
 *     etAt: { nasal, temporal, superior, inferior },
 *     volumeMm3, weightG, frontProtrusion, backSagAtRim
 *   },
 *   grid: {                       // the sampled lens area, ring mesh conforming to the outline
 *     rings: number, N: number,   // NR rings × N outline points + 1 centre vertex
 *     xy: Float32Array,           // 2·V
 *     zFront: Float32Array,       // V
 *     zBack: Float32Array,        // V
 *     t: Float32Array,            // V  (zFront − zBack)
 *     nFront: Float32Array,       // 3·V analytic normals from the sag gradient
 *     nBack: Float32Array         // 3·V
 *   },
 *   edge: { zFront: Float32Array, zBack: Float32Array, t: Float32Array }  // N, = last ring
 * }} LensResult */
```

Decisions baked into this contract:

- **Analytic normals** (sag gradient) are computed in the engine. `computeVertexNormals()` gives seams on the ring/centre fan and averages across the sharp front-to-edge crease.
- `grid` and `edge` are views into one reusable pool per lens and resolution tier. The engine accepts an optional `out` buffer so repeated evaluations allocate nothing.
- `metrics` is computed from the **same** sampled field that is rendered, so a number shown in a callout can never disagree with the geometry. Volume uses area-weighted triangle quadrature over the ring mesh (exact for the piecewise-linear surface). A convergence test across tiers sets the default tier.

### Other engine entry points

| Function | Returns | Used by |
|----------|---------|---------|
| `evaluateLens(spec, outline, tier, out?)` | `LensResult` | everything |
| `evaluateMetricsOnly(spec, outline)` | `LensResult` without `grid` normals (coarse tier) | comparison table, "choosing 1.67 would make it 4.4 mm" summary sentences |
| `profile(result, meridianDeg, samples)` | `{ s: Float32Array, zFront, zBack, clip: [sMin, sMax] }` along a line through the OC, clipped to the outline | 2D cross-section |
| `traceRay(surfaces, ct, origin, dir)` | exit point/dir or `null` (miss/TIR) | verification tests, warp grid |
| `warpGrid(result, viewpoint, res)` | `Float32Array` UV offsets | accurate refraction view |

---

## Recommended Project Structure

```
src/
├── domain/                    # NO imports from three, DOM, or ui/ (enforced by ESLint no-restricted-imports)
│   ├── optics/
│   │   ├── conventions.js     # frame, signs, units: one place, heavily commented
│   │   ├── power.js           # meridianPower, transpose, sphericalEquivalent, baseCurve (Vogel, cited)
│   │   ├── sag.js             # sphere, conic, toric models + domain guards; gradient for normals
│   │   ├── solve.js           # CT solve over outline + thick-lens fixed-point for D2
│   │   ├── field.js           # ring-grid evaluation into typed arrays
│   │   ├── metrics.js         # ET extremes/locations, volume quadrature, weight, protrusion
│   │   ├── trace.js           # ray–surface intersection (Newton on sag) + Snell
│   │   ├── evaluate.js        # public API: evaluateLens / evaluateMetricsOnly / profile
│   │   └── diagnostics.js     # code catalogue
│   ├── frame/
│   │   ├── shapes.js          # round, rect, panto, aviator parametric definitions
│   │   ├── outline.js         # arc-length sampling, A×B normalisation, mirroring, extremes
│   │   └── rim.js             # rim/bridge/temple dimensions (still pure numbers)
│   └── materials.js           # n, density, Abbe, with source citations per row
├── state/
│   ├── store.js               # observable store, URL-hash sync
│   ├── parse.js               # locale-tolerant number parsing
│   ├── validate.js            # ranges, cross-field rules → issue codes
│   ├── presets.js             # Rx + frame presets
│   └── derive.js              # raw inputs → LensSpec[] (+ scenario B overrides)
├── render/
│   ├── mesh/lensGeometry.js   # allocate-once ring/edge BufferGeometry, update(result)
│   ├── mesh/frameGeometry.js  # rim tube from offset outline, bridge, temples
│   ├── materials.js           # transmission, heatmap, edge (frosted), frame
│   ├── scene.js               # renderer, lights, backdrop chart, render-on-demand
│   ├── cameras.js             # Front / Side / Top presets + OrbitControls
│   └── warpView.js            # accurate-mode chart quad driven by warpGrid
├── analytics/
│   ├── colormap.js            # perceptual LUT (viridis/cividis), legend ticks
│   ├── crossSection.js        # SVG profile with dimension lines, A/B overlay
│   └── callouts.js            # projected 3D anchor → DOM label positions
├── ui/
│   ├── i18n/{index.js,en.js}  # key → string; diagnostics & issue codes map here
│   ├── format.js              # Intl.NumberFormat per locale (de-AT comma output later)
│   ├── rxTable.js, frameControls.js, materialPicker.js, expertPanel.js,
│   ├── comparison.js, summary.js, tooltips.js, layout.js
│   └── app.js                 # wires store ↔ engine ↔ render ↔ analytics
└── main.js
test/
├── domain/                    # textbook + manufacturer-chart golden tests, property tests
├── contract/                  # engine ↔ mesh: edge vertex Δz == metrics ET, etc. (Node, no WebGL)
└── e2e/                       # optional Playwright smoke + mobile-viewport perf check
```

### Structure Rationale

- **`domain/` is the trust boundary.** Anything a user may act on (thickness, weight) is produced only here and tested in Node. A lint rule rather than discipline keeps Three.js and the DOM out of it.
- **`state/` sits between UI and domain** so that parsing, transposition and validation are pure and testable, and the engine's preconditions are guaranteed by construction.
- **`render/` and `analytics/` are leaves.** They can be rewritten (for example a WebGPU renderer later) without touching numbers.

---

## Architectural Patterns

### Pattern 1: Functional core, imperative shell

**What:** `derive(state) → LensSpec[] → evaluateLens() → LensResult[]` is pure. Side effects (DOM writes, GPU uploads) happen only in `app.js` subscribers.
**When:** Always here, because the core value is "correct numbers" and the core has to be testable.
**Trade-offs:** A little plumbing in `app.js`. In return there are no hidden couplings and snapshot-testable outputs.

```js
store.subscribe(scheduleRecompute);            // coalesce bursts of input
function recompute() {                          // runs at most once per animation frame
  const { specs, issues } = derive(store.get());
  ui.showIssues(issues);
  if (!specs) return;
  const results = specs.map(s => evaluateLens(s, outlineFor(s), tier, pool[s.eye]));
  lensMeshes.forEach((m, i) => m.update(results[i]));   // in-place buffer writes
  analytics.update(results); ui.summary.update(results);
  requestRender();                              // render-on-demand
}
```

### Pattern 2: Outline-conforming ring mesh with fixed topology

**What:** For outline points `p_i` (i < N) and ring fractions `f_j` (j = 1..NR, `f_NR = 1`), the vertices are `f_j · p_i`, plus one centre vertex at the boxing centre. Triangles are quads between consecutive rings plus a fan at the centre. The front and back faces share `xy` but get different z. The edge band is a separate strip between `edge.zFront[i]` and `edge.zBack[i]` with its **own** vertices, so normals stay sharp.
**When:** All v1 shapes, which are star-shaped about the boxing centre (a unit test asserts this for every preset and the A/B extremes).
**Why over Earcut / `ShapeUtils.triangulateShape`** (three.js uses Earcut internally, verified in `src/extras/ShapeUtils.js`):
- The vertex and index count is constant across every Rx/material/frame-size change, so updates are `array.set` + `needsUpdate`. The three.js manual states buffers cannot be resized after first render without the cost of creating a new geometry.
- Outer-ring vertices are exactly the outline samples, so the edge band, the ET metric and the mesh rim coincide.
- Earcut on a point cloud creates slivers and gives no control over interior density.
- Ring spacing can be non-uniform (denser near the rim, where minus-lens thickness gradients are steepest).

**Trade-offs:** Not valid for non-star outlines, so custom drawn shapes would need constrained Delaunay later. Spacing is non-uniform near the centre, which does no harm because the thickness field is smooth there.

```js
// lensGeometry.js (sketch)
export function createLensGeometry(NR, N) {           // once per tier
  const V = NR * N + 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3 * 2 + N * 2 * 3), 3)
                               .setUsage(THREE.DynamicDrawUsage));
  // normal, color likewise; index built once from (NR, N); groups: front, back, edge
  return g;
}
export function updateLensGeometry(g, r /* LensResult */) {
  writeFace(g, r.grid.xy, r.grid.zFront, r.grid.nFront, 0);
  writeFace(g, r.grid.xy, r.grid.zBack,  r.grid.nBack,  FACE_OFFSET, /*flipWinding via index*/);
  writeEdge(g, r.grid.xy, r.edge);
  for (const a of ['position','normal','color']) g.attributes[a].needsUpdate = true;
  g.computeBoundingSphere();
}
```

### Pattern 3: CT solve without a general optimiser

**What:** Thickness is affine in CT: `t(x,y) = CT − d(x,y)` with `d = sagFront − sagBack`. Therefore:
`CT = max(minCT, minET + max_{i∈outline} d(p_i − oc))`.
This is closed-form for fixed surfaces. With thick-lens correction, D2 depends on CT (back-vertex power), so wrap it in a **fixed-point loop**: compute D2(CT) → recompute CT on the **outline only** (N points) → repeat until |ΔCT| < 1e-4 mm (2–4 iterations typical; cap and emit `THICK_LENS_NOT_CONVERGED`). Only then evaluate the full interior grid **once**.
**Why it matters:** The benchmark below shows that iterating on the full grid, or recomputing the outline inside the loop, costs about 30× more. This is the single most important performance decision.
**Edge cases the solver must own:** the OC outside the outline (large decentration on small frames) makes the thinnest point of a minus lens lie on the outline, not at the centre; mixed-sign meridians (plus sphere, strong minus cyl); a sag domain violation at the outline (`1 − (1+k)c²r² < 0`), which is reported as `LENS_IMPOSSIBLE_IN_FRAME` and never NaN-propagated.

### Pattern 4: Pluggable back-surface model behind one function

**What:** `sagBack(x, y)` and its gradient are implemented by a model selected in `surfaces.back.model` (`meridional` = R2(θ) in the sag formula, `biconic`, true `torus`). Tests run all models side by side and report the max difference vs CYL. That table is the "documented error" the spec asks for (5.5).
**Trade-off:** A tiny indirection, but it lets research swap the model without touching mesh/analytics.

### Pattern 5: Engine ray tracer as oracle and as accurate-refraction source

**What:** `trace.js` intersects rays with the same `sag` functions (Newton iteration on `z − zSurface(x,y)`, seeded by the paraxial plane) and applies vector Snell's law at both surfaces.
- **Verification:** trace a paraxial bundle from the back vertex and fit the vergence per meridian. Back-vertex power must equal the entered SPH/CYL/AXIS within tolerance. This independently validates the thick-lens D2 correction, the axis convention and the toric model, all of which are high-risk.
- **Accurate mode:** `warpGrid()` traces a coarse grid (for example 48×48, about 2.3k rays) from a fixed viewpoint (wearer's eye at vertex distance, or an observer at 40 cm) and outputs UV displacements. A plain textured quad or `ShaderMaterial` shows the eye chart warped with exact barrel/pincushion distortion.
**Why not a fragment-shader ray tracer:** it would duplicate the sag math in GLSL (two sources of truth, hard to test), run per pixel per frame on phones, and need float-texture or precision features that are uneven on mobile WebGL. The CPU grid runs only when inputs or the viewpoint change.
**Trade-off:** Exact only from the chosen viewpoint. Free-orbit views keep the transmission baseline, and the UI labels it as approximate.

### Pattern 6: Codes, not strings, across boundaries

Validation issues and engine diagnostics are `{ code, data }`. The `ui/i18n` layer maps them to plain-language text. This keeps the engine locale-free and makes German a catalogue addition, not a refactor.

---

## Data Flow

### Input-change flow (hot path)

```
keystroke / slider / preset
   ↓  action (raw string kept verbatim, e.g. "-2,25")
Store ──notify──► scheduleRecompute()  (rAF-coalesced; sliders fire many times per frame)
   ↓
derive(): parse → normalise (+cyl→−cyl, axis 180→0) → validate → LensSpec[OD, OS] (+ scenario B)
   ↓                                     └─ issues → UI (inline, aria-live), never clamped
frame-outline (cached by FrameSpec hash) → Outline[OD, OS]
   ↓
engine.evaluateLens()  ×2   (CT fixed-point on outline → single grid pass → metrics)
   ↓ LensResult[OD, OS]
   ├─► mesh builder: in-place attribute writes → needsUpdate
   ├─► analytics: heatmap colours (written into the same geometry's color attribute),
   │              callout anchors, SVG cross-section (engine.profile)
   ├─► UI summary + comparison deltas (from metrics only)
   └─► requestRender()  → one frame
```

### Camera/interaction flow

```
OrbitControls 'change' ─► requestRender()   (no recompute)
camera preset click     ─► tween camera ─► requestRender() per tween frame
accurate-mode viewpoint change ─► engine.warpGrid() (throttled) ─► texture/attribute update ─► render
```

### Comparison flow

```
state.scenarios = { A: base, B: { overrides: { materialId: '1.67' } | { frame: {A: 50} } } }
derive() → specs for A and B (B = A ⊕ overrides, so they cannot drift apart)
A: evaluateLens (full grid, rendered)    B: evaluateMetricsOnly (coarse) unless user toggles 3D to B
→ delta table (CT, ET max/min, weight; absolute + %), summary sentence, SVG overlay of both profiles
```

The SVG overlay of A and B cross-sections is the cheapest and clearest "aha" visual for lay users. Recommend it as the primary comparison view, with the 3D A/B toggle second.

### State Management

```
Store { inputs (raw strings), ui: {mode, eyeSync, camera, heatmap, locale}, scenarios }
   ↓ subscribe
app.js ──► derive (pure) ──► engine (pure) ──► sinks (mesh, analytics, DOM)
   ▲
UI actions (set field, apply preset, toggle) ───┘
URL hash ⇄ store (debounced write; read once on load) → shareable, offline, no backend
```

Derived data (`LensResult`) is **never** stored. It is recomputed and kept in a memo keyed by the spec hash, so the comparison toggles are instant.

---

## Where heavy computation runs

**Evidence (measured 2026-11-06, Node 22.17, Intel i7-8809G, prototype in scratchpad, not shipped code):**

| Approach | Grid (rings × outline pts) | Time per lens |
|---|---|---|
| Naive: CT iterations over full grid, outline recomputed, `atan2`/`pow` per point | 48 × 256 (12k) | 14.3 ms |
| Optimised: cached outline, CT fixed-point on outline only, one full-grid pass, `sin²(θ−axis)` from x,y without `atan2` | 24 × 128 (3k) | 0.12 ms |
| same | 48 × 256 (12k) | 0.49 ms |
| same | 64 × 360 (23k) | 0.91 ms |

Normals, colours and volume quadrature add roughly 1–2× on top of this (estimate, not measured). Mid-range phones run single-threaded JS about 3–6× slower than this desktop (LOW-confidence rule of thumb, **must be measured on a real device in the mesh phase**). The expected cost for both lenses at 48×256 is ≈ 3–10 ms on a phone, inside a 16 ms frame.

**Decision:**
- **v1: main thread, synchronous, rAF-coalesced.** No Worker. Simpler debugging, no async races between eyes or scenarios, and the evidence says it fits.
- **Resolution tiers** (`low 24×128`, `med 48×256`, `high 64×360`). Use `low` while a slider is being dragged and settle to `med`/`high` 150 ms after the last input ("progressive refinement"). Changing tier is the only time geometry is reallocated and the old one disposed.
- **Worker-ready by construction:** engine inputs and outputs are structured-clone-safe and typed arrays are transferable. If profiling shows more than about 8 ms per recompute on the target phone, move `evaluateLens` into a module Worker using Vite's documented pattern `new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })`. Vite only detects the worker when `new URL()` is written directly inside `new Worker()` with static options.
- **Not recommended:** OffscreenCanvas rendering in a worker (OrbitControls needs DOM events, and the transmission/render-on-demand setup gets complicated for no gain at this scene size); WASM (unnecessary at these sample counts).
- **GPU side:** the transmission pass renders opaque objects into an extra multisampled render target every frame (verified in `WebGLRenderer.js` `renderTransmissionPass`). On phones set `renderer.transmissionResolutionScale` (exists in current source, default 1.0) to about 0.5, cap `devicePixelRatio` at 2, and **render on demand only**. A static scene should draw zero frames.

---

## Rendering Layer Notes

- **Baseline refraction:** `MeshPhysicalMaterial({ transmission: 1, opacity: 1, ior: n, thickness, roughness: 0 })`. The documented `ior` range is 1.0–2.333, which covers 1.50–1.74. Verified in the shader chunk `transmission_pars_fragment`: it refracts **once** at the entry surface (`refract(-v, n, 1/ior)`), offsets the exit point by `thickness` along that ray and samples the **screen** buffer. It ignores the back surface and real thickness variation, which confirms the spec's "screen-space approximation" (HIGH confidence, from source).
  - Optional improvement: bake the engine's `t` field into a `DataTexture` used as `thicknessMap` (green channel, multiplied by `thickness`) with planar UVs, so the approximation at least follows real thickness. This is cheap and should be labelled "approximate" in the UI.
  - A high-contrast backdrop (checkerboard / eye chart plane) must be an **opaque** object behind the lenses, or transmission has nothing to sample.
- **Heatmap mode:** swap the lens material to an unlit/Lambert material with `vertexColors: true`. Colours are written into the same geometry's `color` attribute from `t` via a perceptual, colour-blind-safe LUT. The legend and numeric callouts carry the values, so information never relies on colour alone.
- **Edge band material:** a separate group/material (frosted, slightly milky, as real lens edges are). It also makes edge thickness visually legible.
- **Frame:** the rim is a swept profile along the outline offset outward by the groove/bevel depth. It is built once per FrameSpec (Rx changes do not touch it). The rim must use the lens's `edge.zFront`/`zBack` midline so the lens visibly sits in the rim at the correct protrusion.

---

## Analytics Views

| View | Source | Implementation |
|------|--------|----------------|
| Heatmap | `grid.t` | vertex colours, legend from `min/max(t)` with rounded ticks |
| Callouts | `metrics.et*.idx` → outer-ring vertex → `Vector3.project(camera)` | absolutely positioned DOM labels (screen-reader readable, `aria-describedby` on canvas); also listed in a plain table |
| Cross-section | `engine.profile(result, meridianDeg)` | **SVG** (crisp text, dimension lines, accessible, overlay for A/B); meridian selector defaults to the axis and the power meridian (axis+90) |
| Summary sentence | `metrics` of A and of "what-if" variants (e.g. each higher index) via `evaluateMetricsOnly` | i18n template with formatted numbers |

---

## Scaling Considerations

The scale here is computational load per device, not users. It is a static site, so server scaling is irrelevant (GitHub Pages CDN).

| Load | Adjustment |
|------|-----------|
| Single scenario, 2 lenses | main thread, `med` tier |
| Comparison + "what-if" table (5 materials × 2 eyes) | metrics-only coarse tier for non-displayed variants (~0.1 ms each on desktop) |
| Accurate-refraction view open | warp grid recomputed only on input/viewpoint change, throttled; Worker is the first move if this lags |
| Low-end phone | low tier + transmissionResolutionScale 0.5 + DPR cap; fall back to non-transmissive glass if FPS stays below threshold |

### Scaling Priorities

1. **First bottleneck: GPU transmission pass at high DPR on phones**, not the JS engine. Fix with resolution scale, DPR cap and render-on-demand.
2. **Second: JS recompute during slider drags with comparison and warp active.** Fix with tiering, then a Worker.

---

## Anti-Patterns

### Anti-Pattern 1: Mesh builder computing optics
**What people do:** call `sag()` inside the geometry code "because it's convenient".
**Why it's wrong:** the numbers shown and the geometry drawn can diverge, and the geometry is untestable without WebGL.
**Do this instead:** the mesh builder consumes `LensResult` only. A contract test in Node checks `positions(edge front) − positions(edge back) == metrics ET` at every outline index.

### Anti-Pattern 2: Per-eye mirroring in the render layer
**What people do:** build the right lens and `scale.x = -1` it for the left.
**Why it's wrong:** it flips the TABO axis and nasal/temporal labels on one eye and inverts triangle winding (lighting/culling bugs). Real OD/OS Rx differ anyway.
**Do this instead:** mirror only the frame **shape** in `frame/outline.js`. Evaluate each eye in the shared front-view frame.

### Anti-Pattern 3: Rebuilding geometry on every input
**What people do:** `new BufferGeometry()` per change and forget `dispose()`.
**Why it's wrong:** GPU memory leaks and GC pauses on phones. The three.js manual notes that resizing buffers is equivalent to creating new geometry.
**Do this instead:** allocate once per tier, rewrite in place, and dispose only on tier change or teardown.

### Anti-Pattern 4: Clamping or NaN-tolerant math
**What people do:** `Math.sqrt(Math.max(0, R*R - r*r))` to "fix" impossible lenses.
**Why it's wrong:** it produces a plausible-looking, wrong lens. The spec requires flagging.
**Do this instead:** domain guard → diagnostic code → UI explanation. The engine returns `ok: false` with a partial result for display.

### Anti-Pattern 5: Continuous render loop
**What people do:** `renderer.setAnimationLoop(render)` always on.
**Why it's wrong:** battery drain and heat on phones, plus a transmission pass every frame.
**Do this instead:** `requestRender()` on store change, controls `change` and tween frames only.

### Anti-Pattern 6: GLSL copy of the optics
**What people do:** reimplement the sag/toric math in a fragment shader for "accurate" refraction.
**Why it's wrong:** it creates a second, untested source of truth and is the heaviest possible mobile path.
**Do this instead:** use the CPU `warpGrid()` from the tested engine (Pattern 5).

---

## Integration Points

### External Services

None by design (static, offline). Only build-time dependencies: three.js (npm `three` 0.187.0 current at research time, pin exactly), Vite (8.3.6), Vitest (5.1.0). Earcut is **not** needed with the ring mesh. Versions are from `npm view` on 2026-11-06; the stack researcher owns final pinning.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI → Store | action functions (`setField(eye, key, raw)`, `applyPreset(id)`) | raw strings stored. Formatting is UI-only |
| Store → derive | pure function call | returns `{ specs, issues }` |
| derive → frame / engine | pure function calls with `LensSpec`, `Outline` | memoised by stable hash |
| engine → mesh / analytics / UI | `LensResult` (read-only by convention; `Object.freeze` in dev) | typed arrays reused from pool. Consumers must not retain them across recomputes |
| engine ↔ (future) Worker | `postMessage` with transferables | API identical: wrap in a promise-returning facade from day one only if needed |
| renderer ↔ analytics | callouts need the camera. Analytics exposes `layout(camera)` called after each render | keeps analytics free of a scene graph |

---

## Suggested Build Order (dependency-driven)

```
[1] conventions + materials(cited) + parse/validate ─┐
[1] frame-outline (shapes, A×B, mirroring, star test) ┼─► [1] optics engine + metrics + golden tests + ray-trace oracle
                                                      │
                                                      └─► [2] mesh builder + basic scene/cameras (contract tests)
                                                                │
                              [3] UI Simple view + store + i18n ┤ (can start once LensResult contract is frozen)
                                                                ▼
                                     [4] analytics + Expert view (heatmap, callouts, cross-section)
                                                                ▼
                                     [5] comparison mode (needs metrics-only path + SVG overlay)
                                                                ▼
                                     [6] refraction: transmission polish + accurate warp view
                                                                ▼
                                     [7] responsive/perf on real phone, a11y audit, offline, Pages deploy
```

With coarse granularity, phases can merge: **(A)** = 1, **(B)** = 2+3, **(C)** = 4+5, **(D)** = 6+7.

Ordering rationale:
1. **Engine first, with outline.** Everything consumes `LensResult`, and the core value is correct numbers. The outline must exist in phase 1 because CT and ET are defined on the outline, though engine tests can start with a circular polygon. Freezing the `LensResult` contract at the end of phase 1 unblocks UI and mesh work in parallel.
2. **Mesh before UI polish** proves the contract and the phone performance budget early (measure on a real device here, not in phase 7).
3. **Analytics after mesh**, since heatmap colours live in the mesh's colour attribute and callouts need the scene.
4. **Comparison after analytics**, since it reuses cross-section and metrics.
5. **Accurate refraction last.** It is the highest-risk and lowest-core-value item, and it depends on the engine's ray tracer, which already exists as a test oracle from phase 1.

### Research flags per phase
- **Phase 1:** deep research. Thick-lens D2 correction form, toric model choice and error table, Vogel's rule form, densities/Abbe with citations, and citable textbook/manufacturer charts for golden tests. Also the sign convention for R2 (`lens-critic` focus).
- **Phase 2:** light. Real-device benchmark, tier defaults, analytic normals at the centre fan.
- **Phase 4/5:** standard patterns. Colour-blind-safe LUT choice, SVG a11y.
- **Phase 6:** moderate. Viewpoint definition for the "what the wearer sees" view (vertex distance, entrance pupil), and how to present approximate vs exact modes honestly.

---

## Sources

- three.js `MeshPhysicalMaterial` docs: `transmission`, `thickness` (mesh coordinate space), `thicknessMap` (green channel), `ior` range 1.0–2.333. https://threejs.org/docs/pages/MeshPhysicalMaterial.html (HIGH)
- three.js source, transmission is a screen-space single-refraction approximation: `src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js` (`getVolumeTransmissionRay`, `refract`, `transmissionSamplerMap`) and `src/renderers/WebGLRenderer.js` (`renderTransmissionPass`, `transmissionResolutionScale`). https://github.com/mrdoob/three.js/tree/dev/src (HIGH, read 2026-11-06)
- three.js manual "How to update things": buffers cannot be resized after first render; `setDrawRange`; `needsUpdate`. https://github.com/mrdoob/three.js/blob/dev/manual/pages/how-to-update-things.html (HIGH)
- three.js `ShapeUtils.triangulateShape` uses Earcut: `src/extras/ShapeUtils.js` (HIGH)
- Vite Web Workers: `new Worker(new URL(..., import.meta.url), { type: 'module' })` recommended; detection requires a literal `new URL()` inside `new Worker()`. https://vite.dev/guide/features.html#web-workers (HIGH)
- npm registry versions via `npm view` on 2026-11-06: three 0.187.0, vite 8.3.6, vitest 5.1.0, earcut 3.2.4, comlink 4.4.2 (HIGH for "current at that date")
- Engine cost benchmark: own prototype (scratchpad `bench.mjs`, `bench2.mjs`), desktop numbers measured. Phone figures extrapolated (LOW until measured on device)
- TABO axis convention (examiner's view, CCW from examiner's right, both eyes alike): from training knowledge, standard in DACH optometry. **MEDIUM: verify with a cited optometry source in phase-1 research**
- Back-surface sign convention (`D2 = (1−n)/R2`, Cartesian) and the thick-lens back-vertex power relation: standard ophthalmic optics, from training knowledge. **MEDIUM: optics researcher must cite** (e.g. Jalie, *Principles of Ophthalmic Lenses*)

---
*Architecture research for: browser-based 3D eyeglass lens & frame simulator*
*Researched: 2026-11-06*
