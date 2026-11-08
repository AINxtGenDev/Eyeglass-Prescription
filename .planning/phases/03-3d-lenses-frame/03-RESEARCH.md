# Phase 3: 3D Lenses & Frame - Research

**Researched:** 2026-11-08
**Domain:** Procedural lens/frame meshes from a pure-JS optics engine, three.js r187 `WebGLRenderer` PBR look, touch/keyboard camera control, thickness heatmap, worker-built geometry and GPU-memory hygiene on phones
**Confidence:** HIGH for the three.js APIs (read in the r187 source), geometry error bounds and build cost (measured against the real engine here). MEDIUM for phone frame times (estimated, must be measured) and the bevel default (citable options exist, the choice between them does not).

## Summary

The engine already returns everything the mesh needs. `LensResult.surfaces` is `{ n, ct, c1, k1, ca, cb, axisRad, oc }`, which is exactly the `s` that `frontSagAt`, `backSagAt`, `frontSagGradAt`, `backSagGradAt` and `thicknessAt` take. `frameOutline(shape, A, B, eye)` gives the 720-point CCW outline, star-shaped about the boxing centre, and it is memoised. A pure-JS builder under `src/engine/` can therefore produce positions, analytic normals and per-vertex thickness without any optics copy. Use a polar grid about the **boxing centre**: 720 spokes (one per outline point, so the outer ring *is* the engine outline and `metrics.etMax.index` maps 1:1 onto a vertex) and **64 rings graded toward the rim** (ρₖ = 1 − (1 − k/64)^2.5). Measured against the real engine, this keeps the linear-interpolation sag error ≤ 0,0078 mm on 1 750 extreme and Expert-override lenses with nₑ ≥ 1,49. It does **not** reach 0,01 mm for custom materials with nₑ 1,40–1,43: about 0,02 mm there, on lenses with 43–45 mm edges. That is an open question for the user and lens-critic.

The build costs about 14–18 ms per lens on this desktop (median, Node 22), and the Pixel 7 Pro worker ran the engine bench at about 1,3× desktop time. So a pair costs roughly 35–50 ms, which is far over the 16,7 ms main-thread budget. **Geometry must be built in the existing worker** as a new latest-wins `mesh` job. The arrays are transferred and double-buffered, so the arrays attached to three.js are never detached (three.js re-uploads from them after a context restore). Two facts from the r187 source drive the design:

- `WebGLAttributes.update` **throws** when an attribute's array byte length changes ("Resizing buffer attributes is not supported"). The topology must be fixed: 46 081 vertices per surface, which also fits a `Uint16` index.
- `OrbitControls.connect()` sets `touchAction = 'none'` on its element, and `disconnect()` restores it. The "3D drehen" toggle is therefore exactly `connect()`/`disconnect()`.

Everything else in the UI-SPEC checks out against the source:

- `NeutralToneMapping` exists (constant 7).
- `RoomEnvironment` + `PMREMGenerator.fromScene(scene, sigma, near, far)` exist.
- `transmissionResolutionScale` exists.
- The transmission render target is cached **per `camera.id`**, so creating a new camera leaks render targets.
- The background clear colour is converted to the output colour space and is not tone-mapped.
- `ShaderMaterial` compiles as `#version 300 es`, so `fwidth` is available.
- The wheel handler calls `preventDefault` only when `enableZoom` is true.
- `drawImage(glCanvas)` works in the same task without `preserveDrawingBuffer`. Tested: same task `[255,0,0,255]`, next frame `[0,0,0,0]`.
- Playwright 1.65 passes `--enable-unsafe-swiftshader` by default, and headless Chromium 158 here gives WebGL2 on SwiftShader with MSAA 4. So CI can run real WebGL tests.

The D-05 bevel rule has a citable source. Essilor US 8 388 133 names three edger criteria: "front curve tracing", "1:1" (bevel apex midway) and "1:2" (apex one third of the edge thickness from the front). No source says which one a given lab uses, so the choice stays labelled "angenommen".

**Primary recommendation:** Build the meshes in a new pure module `src/engine/mesh/` (under the existing engine lint boundary and its 95 % coverage gate) and run it in the worker as a latest-wins `mesh` job with transferred, double-buffered `Float32Array`s. Use fixed 720 × 64 rim-graded polar topology. Render with one on-demand `WebGLRenderer` per the UI-SPEC, and prove D-04 (a)–(e) with Node tests before any pixel is drawn.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Surface sag, normals, thickness per vertex | Engine (`src/engine/mesh/`, pure JS) | — | D-02: single source of truth; Node-testable; lint boundary bans `three` and DOM |
| Bevel split (front/back protrusion) | Engine (`src/engine/rim.js`) | UI text (`frame-input.js`), 3D rim | D-05: one rule for the text and the picture |
| Rim/bridge/temple vertex arrays | Engine (`src/engine/mesh/frame.js`) | — | They depend on the outline and the lens bevel z, so they re-mesh with the lens; still pure |
| Callout values, iso-label positions, heat scale | Engine (`meridianProfile` ends at 0°/90°, `metrics`, `thicknessAt`) | View projects them to 2D | D-04(e): numbers never come from the mesh or pixels |
| Running the builder off the main thread | Worker (`compute-protocol.js` new `mesh` type) | Sync fallback on the main thread | Measured about 35–50 ms per pair on the phone > 16,7 ms (RAIL) |
| Latest-wins scheduling of mesh jobs | State (`compute-client.js`, pure) | `pipeline.js` triggers after result paint | Same pattern as the profile lane (generation drop, LRU optional) |
| Three.js scene, materials, camera, controls, render-on-demand | Browser view (`src/ui/view/`, lazy chunk) | — | Only place `three` is imported |
| Projected labels, legend SVG, heat table, aria-label | Browser DOM (`src/ui/view/`) | i18n `de-AT.js` | Text equivalents (D-22, D-29) |
| Phone thumbnail | Browser view (2D canvas `drawImage` in the render task) | — | One GL context (D-14) |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

#### Correctness of the geometry (VIZ-01, governs everything else)
- **D-01:** **1 scene unit = 1 mm.** Lens and frame are true to scale, so camera distances, protrusion and thickness are physically meaningful.
- **D-02:** **The mesh is built from the engine's surface functions:** `frontSagAt`, `backSagAt`, the `*SagGradAt` gradients for analytic normals, and the same frame outline as `evaluateLens`. The geometry builder that turns surfaces and outline into position/normal/index `Float32Array`s is **pure JS, has no Three.js and runs in Node**. It sits under the engine boundary lint rule, or in a sibling folder with the same rule (the planner decides). Three.js only wraps the arrays. There is no second copy of the optics.
- **D-03:** **The edge band uses the exact outline points.** It has duplicated seam vertices and no `computeVertexNormals()` across the rim seam. The boundary ring of the front and back surfaces is the outline itself, not a grid clipped near it.
- **D-04:** **Correctness is proven by Node tests, not by eye.** Planned checks:
  - (a) At every outline vertex, front z − back z equals `thicknessAt` within 0,001 mm.
  - (b) The mesh's max and min edge thickness and their locations equal `metrics.etMax`/`etMin`, and its centre thickness equals CT.
  - (c) The surface tessellation's maximum sag deviation from the analytic surface is bounded, at most 0,01 mm. The researcher derives the ring and spoke count from this.
  - (d) The left lens is built per eye, not mirrored (phase-1 rule).
  - (e) Heatmap callout numbers are the engine's metric values, not values re-sampled from the mesh.
- **D-05:** **Bevel and placement in the rim** decide the front/back split of the protrusion that `src/engine/rim.js` explicitly left for phase 3. The researcher picks a documented, sourced bevel-placement rule, for example a front-following bevel or a bevel at a fixed fraction of the edge thickness. The rule is implemented as a pure engine helper next to `edgeBeyondRim`, so the 3D frame and the existing text protrusion message use the same rule. If no citable rule exists, it is labelled "angenommener Wert" like `RIM_DEPTH_DEFAULT_MM`.
- **D-06:** **Frame geometry comes from the same inputs as the numbers:** shape, A, B and DBL, PD/decentration (lenses sit at their real optical centres), and rim depth (Expert field, default `RIM_DEPTH_DEFAULT_MM`). The temples use the temple length from the stamp when it is given and a documented default (140 mm) otherwise. Changing the temple length still changes no number, which matches D-11 in phase 2. The bridge spans exactly DBL.

#### Photorealistic look (VIZ-04)
- **D-07:** **Physically based rendering.** `WebGLRenderer` with physically correct lighting, sRGB output and a filmic tone mapping (AgX or ACES; the researcher picks for glass and acetate). Image-based lighting comes from `RoomEnvironment` through `PMREMGenerator`: a procedural studio environment with no downloaded HDRI, so there is no third-party asset or licence issue and no extra MB on phones. A CC0 HDRI is allowed only if the researcher shows a clear visual gain with a licence citation and a size under 1 MB.
- **D-08:** **Lens material:** `MeshPhysicalMaterial` with `transmission: 1`, `ior` = the selected material's index (custom material included), `thickness` from the engine, `roughness: 0` and specular reflections from the environment. Dispersion may be driven from the material's Abbe number when it is available and affordable on the quality tier. The **edge band** gets a slightly frosted/polished-edge look, so the user sees the edge thickness the way it looks on real glasses. A faint AR-coating tint is allowed, at most cosmetic.
- **D-09:** **Frame material:** a PBR acetate look: dark, slightly translucent-looking, with a clearcoat. It is one neutral default. A frame colour picker is out of scope (see Deferred). The temples have a simple hinge block and an earpiece bend.
- **D-10:** **Background (VIZ-04):** a high-contrast checkerboard / eye-chart plane behind the glasses at a fixed, documented distance. It is generated procedurally at runtime (canvas texture, own drawing). No `references/` image, no third-party chart. The visible label "Visueller Eindruck — die Lichtbrechung ist angenähert; die genaue Durchsicht folgt in der Durchblick-Ansicht" (final wording for the UI spec) sits on the view. This matters because `transmission` is a screen-space approximation and must not be read as the exact optics. Phase 4 delivers those.
- **D-11:** **Grounding:** a soft contact shadow under the glasses, baked or cheap, with no real-time shadow maps on phones. MSAA is on where it is affordable.
- **D-12:** **Quality tiers,** decided once at start-up from capability and device class and adjustable if frame time is exceeded:
  - High (desktop): full pixel ratio up to 2, transmission at full resolution, dispersion.
  - Phone: pixel ratio ≤ 1,5–2, `transmissionResolutionScale` ≈ 0,5, no dispersion.

  The researcher sets the thresholds. The active tier is shown in "Technische Angaben". Realism degrades by tier. Correctness never does.

#### Placement and layout (UX-03, builds on phase-2 D-19/D-20)
- **D-13:** **Desktop/tablet:** the 3D view fills `#view-slot` at the top of the sticky results column (reserved in phase 2), in roughly 4:3 or 16:10.
- **D-14:** **Phone:** the 3D view is inline at the top of the results section. The `#bar-view-slot` in the sticky bottom bar shows a **small still thumbnail** copied from the one main renderer after each re-mesh. It is not a second WebGL context: one renderer, one GPU context, half the memory risk. This keeps "the lens view stays visible while editing" (UX-03). Tapping the bar jumps to the full view as it does today.
- **D-15:** **Scroll safety on touch:** the canvas must not trap one-finger page scrolling. Default on touch devices: the view is static, and the presets plus a clear "3D drehen" activation (button or first tap) enable orbit. After that, one finger rotates and two fingers pinch/pan. `touch-action: none` applies only while active. The researcher may replace this with an equivalent, better-sourced pattern. Desktop: drag rotates, wheel zooms only with focus/hover (no scroll hijack), right-drag or Shift pans.
- **D-16:** **Lazy-load Three.js** (dynamic `import()` after the first result paint), so ENG-09 for the numbers is unaffected. Re-meshing runs after the result paint, latest-wins, using the same scheduling idea as phase-2 D-16. The view shows a short "wird aufgebaut …" state.
- **D-17:** **No WebGL2:** a plain-German note in the view slot. Numbers, cross-section and comparison keep working. No crash, no blank box.

#### Camera and controls (VIZ-03)
- **D-18:** **The default camera is a 3/4 front view** (slightly from above and from the side). It shows lens thickness and frame at once, so a lay user sees "dick oder dünn" immediately. The presets **Vorne / Seite / Oben** are real `<button>`s with an accessible name and keyboard support, and they animate smoothly (reduced to a cut under `prefers-reduced-motion`). An extra "Zurücksetzen" returns to the default view.
- **D-19:** **Seite** is a true orthographic-like side view (or a long-focal perspective) of one lens edge, so front-surface protrusion beyond the rim is visibly measurable. The protrusion value from D-05 is shown as text next to it, never only as a picture.
- **D-20:** `OrbitControls` with damping, zoom and polar limits so the glasses can't be lost, and `listenToKeyEvents` for keyboard orbit when the canvas has focus. **Render on demand:** frames render only on change, interaction or damping, never in a continuous loop. This saves battery and heat on phones.

#### Heatmap (VIZ-05, UX-02 Expert)
- **D-21:** **The heatmap is painted on the 3D lens itself,** as vertex colours or a shader on the front-surface mesh, colouring local thickness `thicknessAt(x,y)`. In Expert view a view-mode switch reads "Glas | Dickenkarte". Switching to Dickenkarte moves the camera to Vorne, so the map reads like a flat chart.
- **D-22:** **Palette:** colour-blind-safe cividis or viridis LUT (stack decision), always with:
  - a **mm legend** in HTML with tick values;
  - **labelled iso-lines** at a "nice" step (0,5 / 1 / 2 mm) chosen so 4–8 lines appear;
  - **numeric callouts** at nasal, temporal, superior, inferior and centre, using lay plus Expert location words (phase-2 D-23).

  Callouts are HTML labels projected onto the view and are also listed as text, so screen readers and colour-blind users get every number without the colour.
- **D-23:** **Both eyes** show the heatmap with one **shared scale**, so left and right can be compared honestly. The same rule applies in A/B mode (D-25).

#### A/B comparison in 3D (RES-03)
- **D-24:** **One renderer.** Wide screens show A ("Vorher") and B ("Nachher") as **two scissor viewports side by side with one synchronised camera**, so the same angle compares the same thing. Phones follow the existing "Vorher | Nachher" toggle (phase-2 D-29): the one scene swaps between A and B with the camera kept.
- **D-25:** In heatmap mode A and B share one thickness scale and legend. The difference line from phase 2 stays the numeric source of truth.

#### Performance and memory (VIZ-06)
- **D-26:** Re-meshing reuses `BufferGeometry` and typed arrays at a fixed resolution per quality tier. It writes in place, sets `needsUpdate` and does not allocate per input. Geometry is computed in the existing worker if the main-thread cost would break the RAIL budget; the researcher measures this, and the arrays are transferred. Anything replaced (materials, textures, render targets on tier change or A/B) is explicitly disposed.
- **D-27:** **Leak check:** an automated Playwright test applies at least 50 input changes and asserts that `renderer.info.memory` geometries and textures stay constant. A heap snapshot comparison is done manually.
- **D-28:** **Real-phone measurement:** re-mesh-to-paint latency and frame time during orbit are measured on the Pixel 7 Pro used in phase 2 (02-15) via the live site, plus the 4× CPU-throttled proxy, and recorded in the phase verification. The thresholds come from RAIL (input→paint ≤ 200 ms, interaction frames ≤ 16,7 ms target), which matches ENG-09. They are checked in the chrome-devtools MCP at phone size as well as in Playwright (memory `test-with-chrome-devtools-mcp`).

#### Accessibility
- **D-29:** The canvas has `role="img"` and a dynamic German `aria-label` summary, for example "3D-Ansicht: rechtes Glas, dickste Stelle 4,1 mm außen …". All information in the view also exists as text: callouts, protrusion, legend. axe runs on Simple, Expert, heatmap and compare modes at 320 px and desktop. Every new string goes into `de-AT.js`, and "Stärke" stays banned.

#### Live verification with the chrome-devtools MCP (user instruction 2026-11-08, mandatory)
- **D-30:** **Every plan that touches the UI or the 3D view is verified with the chrome-devtools MCP, in addition to Playwright/Vitest.** The executor and the verifier do this, and it belongs in each plan's `<verify>` steps.
  - **Setup:** open the built page with `vite preview` at `/Eyeglass-Prescription/` (or the live site after deploy). Emulate 412×915 (Pixel 7 Pro) and 320 px, plus one desktop width.
  - **Checks:**
    - a screenshot of the default view, each preset (Vorne / Seite / Oben), the heatmap and A/B mode;
    - `list_console_messages` with no WebGL errors or warnings;
    - `performance_start_trace` / `performance_stop_trace` with 4× CPU throttling during a re-mesh and an orbit;
    - `evaluate_script` reading `renderer.info.memory` before and after repeated input changes (backs D-27).
  - **Reporting:** report what the screenshots actually show. A task is not done on a passing test alone.

### Claude's Discretion
- Exact tessellation counts within the D-04(c) error bound.
- The tone-mapping operator, exposure, light rig and contact-shadow technique.
- The exact canvas aspect ratio, button placement and icon design (for `/gsd:ui-phase 3`).
- Whether the geometry builder lives in `src/engine/` or a sibling `src/geometry/` with the same lint boundary.
- Whether the thumbnail is copied with `drawImage` from the WebGL canvas right after render or via `preserveDrawingBuffer` (prefer the cheaper one).
- The iso-line rendering technique (shader `fwidth` lines vs. line geometry).

### Deferred Ideas (OUT OF SCOPE)
- Frame colour/material picker (several acetate colours, metal frame), cosmetic only; v2 backlog.
- A face/head model wearing the glasses: realism gain, but large asset, uncanny-valley risk and licence questions; v2 at most.
- Lens tints, photochromic and mirror coatings as visual options; v2.
- Exact refraction "Durchblick": phase 4 (REF-01/02).
- m6 lay note for very thick results (phase-2 deferred item): reconsider now that thickness is visible in 3D. The planner checks whether it is still needed. If so, it needs a sourced threshold, otherwise it stays deferred.

**UI-SPEC amendments already approved (03-UI-SPEC.md "Changes to Locked Decisions"; the planner treats these as the current contract):**
- D-10: the caption leaves out the Durchblick reference.
- D-15: an explicit "3D drehen" toggle only, auto-off via IntersectionObserver; wheel zoom only on focus.
- D-19: one perspective camera with a 20° vertical FOV.
- D-20: an own keyboard handler instead of `listenToKeyEvents`.
- D-21/22: in-view callouts on one selected eye.
- D-24: A/B shows the compared eye only, side by side when the stage is ≥ 360 px.
- D-08/D-09: the edge band and the frame are opaque; no AR tint.
- D-12: a third tier, "sparsam".
- Tone mapping is `NeutralToneMapping`, not AgX/ACES. This research confirms the constant exists in r187.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Both lenses as procedural meshes (front, back, edge band at exact local thickness) from engine points and normals inside the outline | Pattern 1 (720 × 64 rim-graded polar builder), measured error table, D-04 test designs, Pitfalls 1–4 |
| VIZ-02 | Parametric frame (rim, bridge, temples) | Pattern 3 (rim swept along the bevel curve, outward offset 4 mm, bridge = DBL), Pitfall 9 (offset self-intersection) |
| VIZ-03 | Orbit/pan/zoom by mouse and touch, presets Vorne/Seite/Oben, side view shows protrusion | Pattern 6 (connect/disconnect toggle, focus-gated wheel), Pattern 2 (bevel split), OrbitControls source facts |
| VIZ-04 | Transparent glass with the material's index over a checker/eye-chart, labelled impression | Pattern 5 (renderer/material facts verified in r187), dispersion = 20/V (KHR), transmission per camera.id |
| VIZ-05 | Expert heatmap with mm legend, labelled iso-lines, callouts N/T/S/I/centre | Pattern 7 (scalar `thickness` attribute + `ShaderMaterial` with cividis LUT and `fwidth` lines), callouts from `meridianProfile` 0°/90° ends |
| VIZ-06 | No visible lag on a mid-range phone, no GPU-memory growth | Pattern 4 (worker mesh lane, double-buffered transfer, fixed topology), leak-test warm-up rule, compileAsync |
| RES-03 (3D part) | 3D view of both configurations | Pattern 8 (scissor viewports, shared camera, one extra lens slot for A) |
| UX-02 (heatmap part) | Heatmap in the Experten-Ansicht | Pattern 7; `isExpert()` gating as in `updateXsec` |
| UX-03 (lens view while editing) | Lens view visible while editing on phones | Pattern 9 (thumbnail `drawImage` in the render task, verified) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- The UI is de-AT only. Every string lives in `src/i18n/de-AT.js` via `t()`, and "Stärke" is banned (`dictionary.test.js`).
- The engine (`src/engine/`) is pure JS with no Three.js and no DOM, and it is the single source of truth for every number. Lint and `boundary.test.js` enforce this.
- Stack: `three@0.187.0`, exact pin, `WebGLRenderer` only. No `WebGPURenderer`, no TSL, no `three/webgpu` imports, no CDN or import maps, no `three/examples/jsm` deep paths. Use `three/addons/...`.
- Analytic normals, duplicated seam vertices. Never `computeVertexNormals()` across seams.
- Reuse typed arrays, never recreate `BufferGeometry` per input, and use a worker if needed.
- Heatmap: a colour-blind-safe LUT (the UI-SPEC picked cividis), always with a legend and numeric callouts.
- Accurate refraction (phase 4) uses a CPU ray-traced warp grid, not a GLSL optics copy. Phase 3 shaders may colour engine scalars but must not compute optics.
- `lens-critic` gate: the plan and the result need PASS.
- `references/` is git-ignored, must never be published, and is design input only.
- No root-absolute URLs in JS, because of the base `/Eyeglass-Prescription/`.
- CSP unchanged: `script-src 'self'; style-src 'self'; img-src 'self' data:`. `worker.spec.js` checks the exact string.
- `gsd-sdk` is not installed. Use `node ~/.claude/get-shit-done/bin/gsd-tools.cjs <cmd>`.
- Global rules: verify before asserting, cite sources, report real output, atomic commits, ask before outward-facing actions. Enabling Pages is already done. The deploy after phase work is the usual push flow, and the push still needs approval.
- Memory: every UI or 3D change is checked in the chrome-devtools MCP at phone size in addition to Playwright. Update session.md and the README at wave boundaries in a separate docs commit.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | 0.187.0 (r187, `latest` dist-tag, modified 2026-10-30) | `WebGLRenderer`, `BufferGeometry`, `MeshPhysicalMaterial`, `ShaderMaterial`, `PMREMGenerator` | Project stack decision. [VERIFIED: npm registry `npm view three version` = 0.187.0; `REVISION = '187'` in src/constants.js] |
| three/addons/controls/OrbitControls.js | ships with 0.187.0 | orbit/pan/zoom with damping, `maxTargetRadius`, `connect()`/`disconnect()` | [VERIFIED: r187 source examples/jsm/controls/OrbitControls.js] |
| three/addons/environments/RoomEnvironment.js | ships with 0.187.0 | procedural studio IBL, has `dispose()` | [VERIFIED: r187 source] |

### Supporting (already in the repo, reused)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.1.0 | Node tests for D-04 (a)–(e), bevel helper, protocol, client | every engine/state task |
| fast-check | 4.10.2 | property tests: mesh thickness at outline = `thicknessAt`, finiteness, OS ≠ mirror(OD) | builder tasks |
| @playwright/test | 1.65.0 | WebGL smoke, leak test, presets, reduced motion, pixel corner check | UI tasks |
| @axe-core/playwright | 4.14.0 | axe matrix from the UI-SPEC | UI tasks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scalar `thickness` attribute + `ShaderMaterial` (LUT + `fwidth` iso-lines) | `MeshBasicMaterial({ vertexColors })` + line geometry for iso-lines | Vertex colours need a CPU LUT pass and 12 B/vertex. Iso-line geometry needs marching-triangles plus re-allocation per change, which violates fixed topology. The shader colours an engine scalar and computes no optics, so it complies with CLAUDE.md. |
| Polar grid about the boxing centre | Polar grid about the OC | The OC can lie outside the outline (`OC_OUTSIDE_OUTLINE` exists), and panto/pilot are "not convex everywhere" (profile.js comment). The boxing-centre star shape is already a tested invariant (outline.test.js "star-shaped"). |
| Worker-built geometry | Main-thread build | Measured 14–18 ms per lens on desktop, so the main thread cannot hold the 16,7 ms per task (ENG-09 (a)). |
| `drawImage` thumbnail | `preserveDrawingBuffer: true` | `preserveDrawingBuffer` costs a buffer copy every frame. The same-task copy was verified to work. |

**Installation:**
```bash
npm install three@0.187.0   # .npmrc has save-exact=true; goes into "dependencies" (runtime), not devDependencies
```
`@types/three` is not needed (plain JS).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| three@0.187.0 | npm | created 2012-12-07 (≈ 14 yrs) | 34 552 646 / week (2026-11-01…07, api.npmjs.org) | github.com/mrdoob/three.js (maintainers mrdoob, mugen87) | [OK] (`slopcheck install -e npm three`, run in an isolated scratch dir 2026-11-08) | Approved |

- `npm view three@0.187.0 dependencies` is empty, and `scripts` has no `postinstall`/`install`/`preinstall` entry (only dev scripts). [VERIFIED: npm registry]
- **Packages removed due to slopcheck [SLOP] verdict:** none
- **Packages flagged as suspicious [SUS]:** none
- No other new package. Do **not** add `@types/three`, `three-mesh-bvh`, `lil-gui` or any HDRI asset.

## Architecture Patterns

### System Architecture Diagram

```
 input event ──► main.js update() ──► requestMain(specs) ──► worker: evaluateLens ×2 ──► result
                                                                                        │
       ┌───────────────────── paintDeliveries (rAF, isCurrent) ◄────────────────────────┘
       │  result cards painted first (ENG-09 unchanged)
       ▼
 view.requestMesh({ OD, OS, [A-eye] } surfaces + frame + rimDepth + temple + bevel rule)
       │  latest-wins: generation bump drops older mesh answers
       ▼
 compute-client mesh lane ──postMessage(job, transfer:[spare buffers])──► worker
       │                                     buildLensMesh(surfaces, outline) ─► positions/normals/thickness (Float32)
       │                                     buildFrameMesh(outline, bevel z, A, DBL, temple) ─► rim/bridge/temples
       ◄──postMessage(result, transfer:[filled buffers])─────────────────────────┘
       ▼
 view (lazy chunk, three@0.187.0):
   swap attribute.array (same byteLength) → needsUpdate → set boundingSphere from builder
   ├─ Glas: MeshPhysicalMaterial (transmission, ior = nₑ, thickness = CT) + opaque edge band + acetate frame
   └─ Dickenkarte: ShaderMaterial(thickness attr, shared scale, cividis LUT, fwidth iso-lines)
       ▼
 render on demand (one WebGLRenderer; A/B = 2 scissor viewports, one camera)
   ├─ same task: drawImage(canvas) → #bar-view-slot thumbnail (phones)
   ├─ project engine points (callouts, iso labels, eye labels) → #view-labels HTML
   └─ aria-label, #view-protrusion text, legend SVG, heat table (engine numbers via format.js)
 OrbitControls 'change' ──► requestRenderIfNotRequested (damping keeps requesting until settled)
```

### Recommended Project Structure
```
src/engine/
├── rim.js                 # + bevelSplit(t, rimDepth, rule) and BEVEL_RULE (D-05)
└── mesh/                  # pure JS, inherits the engine lint block and the 95 % coverage gate
    ├── topology.js        # RINGS, SPOKES, ring fractions, static Uint16 index arrays (front CCW from +z, back reversed, band)
    ├── lens.js            # buildLensMesh(surfaces, outline, out?) → positions, normals, thickness, edge band, bounding sphere
    ├── frame.js           # buildFrameMesh(...) → rim (swept along the bevel curve), bridge, end pieces, temples
    ├── heat.js            # heatScale(results), isoStep(min,max), calloutPoints(result, frame, eye) via meridianProfile
    └── *.test.js          # D-04 (a)–(e), finiteness, OS-not-mirrored, bevel consistency
src/state/
├── compute-protocol.js    # + 'mesh' message (returns { msg, transfer })
└── compute-client.js      # + mesh lane (after main, before compare; generation drop; one queued)
src/worker/engine.worker.js # postMessage(msg, transfer)
src/ui/view/               # lazy chunk; only folder importing 'three' (inherits UI lint: browser globals, no innerHTML)
    ├── index.js           # mountView(slot) dynamic-import entry, WebGL2 check, error/no-WebGL states
    ├── scene.js           # renderer, env, chart, shadow, tiers, render-on-demand, context loss
    ├── lenses.js          # geometry slots (OD, OS, A), double buffers, material swap
    ├── controls.js        # OrbitControls connect/disconnect, own keyboard handler, presets tween
    ├── labels.js          # projected HTML labels with collision priority
    └── legend.js          # SVG legend + heat table (text equivalents)
```
Add a lint rule so `three` can be imported only from `src/ui/view/**`, by extending the existing `no-restricted-imports` pattern to the other `src/ui/**` files, plus a `boundary.test.js` probe. [ASSUMED best practice: it keeps the lazy chunk boundary mechanical.]

### Pattern 1: Fixed-topology rim-graded polar lens mesh (VIZ-01, D-02/D-03/D-04)
**What:**
- Vertex (k, i) = ρₖ · outline[i], with ρₖ = 1 − (1 − k/RINGS)^2.5, RINGS = 64, SPOKES = 720 = the engine `frameOutline` default. Ring 0 is the single centre vertex at the boxing centre.
- Front z = −`frontSagAt`. Back z = −CT − `backSagAt` (conventions.js).
- Front normal = normalize(∂sF/∂x, ∂sF/∂y, 1). Back normal = −normalize(∂sB/∂x, ∂sB/∂y, 1), so it faces the eye.
- thickness = `thicknessAt` (or `ct − sF + sB` from the same values, with a test asserting equality to `thicknessAt`).
- Edge band: 2 × 720 own vertices (front ring z, back ring z) with in-plane outward outline normals (average of the adjacent edge normals (dy, −dx) for a CCW outline).
- Counts per surface: 1 + 64·720 = 46 081 vertices (fits a `Uint16` index) and 720 + 2·720·63 = 91 440 triangles.

**Why these counts (measured 2026-11-08 against the real engine):**

Each probe samples linear-interpolation sag error at the 3 edge midpoints and the centroid of every triangle, for front and back. Scripts are in the session scratchpad (`tess/*.mjs`).

| Grid | Lens set | Max sag error (mm) |
|------|----------|--------------------|
| sin grading, 32 rings × 720 | 300 random computable lenses | 0,0159 |
| sin grading, 48 rings × 720 | extreme grid, every 9th (sph ±8…±12, cyl 0/−3/−6, 4 axes, 4 shapes, 4 sizes, cr39/1,74, PD 25/40) | 0,0259 |
| **rim-graded g = 2,5, 64 rings × 720** | **extreme grid incl. sph −4…+4, every 5th of 6 580 computable = 1 316 lenses** | **0,0074** (worst: −10 sph, CR-39, rechteckig 62×55, PD 25; etMax 41,5 mm) |
| rim-graded g = 2,5, 64 × 720 | Expert overrides: manual BC 0 and 10, k −1/−5, custom nₑ 1,49 and 1,9 (434 lenses) | **0,0078** |
| rim-graded g = 2,5, 64 / 96 / 128 × 720 | custom nₑ 1,40–1,43, sph −2…−12 (computable ones) | 0,0203 / 0,0144 / 0,0127, **bound not met** |

- No probe value was NaN over about 8 000 lenses, so the interior grid stays inside every surface domain. A distance argument backs this for the sphere: the boxing centre lies in the outline's convex hull, so every grid point is within ρmax of the OC. For the torus it is empirical only.
- Error is mainly radial. On the worst lens, doubling the spokes moved 0,0159 → 0,0136, while doubling the rings moved 0,0159 → 0,0065.
- Build cost at 64 × 720 (both surfaces + thickness, no edge band): median 13,9–18,0 ms, p95 17–23 ms per lens. This is Node 22.17, the i7-8809G desktop, two runs. Buffer size is 2,40 MB per lens (pos + normal for 2 surfaces + thickness).

**Example:**
```javascript
// src/engine/mesh/lens.js — sketch; names are recommendations. Pure: imports engine only.
import { frontSagAt, backSagAt, frontSagGradAt, backSagGradAt } from '../design.js';
import { thicknessAt } from '../metrics.js';
import { RINGS, SPOKES, RING_FRAC } from './topology.js';
export const VERTS = 1 + RINGS * SPOKES; // 46 081

export function buildLensMesh(s, outline, out) {
  if (outline.length !== 2 * SPOKES) throw new Error('outline must have SPOKES points');
  const { front, frontN, back, backN, thick } = out; // Float32Array, fixed length, reused (D-26)
  let p = 0;
  for (let k = 0; k <= RINGS; k++) {
    const f = RING_FRAC[k];
    for (let i = 0; i < (k === 0 ? 1 : SPOKES); i++, p++) {
      const x = f * outline[2 * i], y = f * outline[2 * i + 1];
      const sF = frontSagAt(s, x, y), sB = backSagAt(s, x, y);
      const [fx, fy] = frontSagGradAt(s, x, y), [bx, by] = backSagGradAt(s, x, y);
      // conventions.js: zFront = −sF, zBack = −CT − sB, +z toward the examiner
      front[3*p] = x; front[3*p+1] = y; front[3*p+2] = -sF;
      back[3*p]  = x; back[3*p+1]  = y; back[3*p+2]  = -s.ct - sB;
      let L = Math.hypot(fx, fy, 1); frontN[3*p] = fx/L; frontN[3*p+1] = fy/L; frontN[3*p+2] = 1/L;
      L = Math.hypot(bx, by, 1);     backN[3*p] = -bx/L; backN[3*p+1] = -by/L; backN[3*p+2] = -1/L;
      thick[p] = thicknessAt(s, x, y);
      // the caller rejects the mesh (lens not drawn) if any value is non-finite
    }
  }
  // edge band: outline vertices i at front/back z with outward in-plane normals (own vertices, D-03)
}
```

### Pattern 2: Bevel split as an engine helper (D-05)
**What:** `bevelSplit(t, rimDepth, rule = '1:2')` → `{ front, back }`, each ≥ 0 mm.
- Bevel apex distance from the lens front: b = t/3 for '1:2', t/2 for '1:1', 0 for 'front'.
- The eyewire of depth D is centred on the apex [ASSUMED]: front = max(0, b − D/2), back = max(0, t − b − D/2).
- When both are positive, front + back = t − D = `edgeBeyondRim`.

**Source:**
- Essilor US 8 388 133 B2 (priority 2007-12-28) lists three esthetic bevel criteria: "front curve tracing", "1:1" ("equidistance of the front and rear face") and "1:2" (bevel-to-front = ½ of bevel-to-rear). [CITED: patents.google.com/patent/US8388133]
- Trade and forum sources (LOW) say labs commonly bevel minus lenses toward the front and plus lenses at the centre, and that a 1/3–2/3 bevel "will push the lens out the front to lessen the amount showing out the back". [CITED: optiboard.com forum thread 33012; 20/20 Magazine, Dukes 2015]

**Recommendation:** default '1:2' for every lens. Keep `view.protrusion.bevelAssumed` visible, because which criterion the lab uses is the user's lab's choice. `paintRim()` in `frame-input.js` must switch from `edgeBeyondRim` to `bevelSplit`, or "passt" and "steht vor" will disagree with the 3D view.

**Consequence the planner must handle:**
- Under '1:2' a lens with t = D protrudes D/6 behind the rim, but `edgeBeyondRim` says "fits".
- The existing `frame.rim.over/fits` texts and `rim.test.js` expectations change.
- This is a deliberate correction of a phase-2 simplification. State it in the plan for lens-critic.

### Pattern 3: Frame from the same inputs (VIZ-02, D-06)
- Rim: sweep a rectangular, slightly rounded section along the outline.
  - Inner edge = outline, outer edge = outline offset outward by the 4 mm face width (UI-SPEC design value).
  - z-span = [z_bevel(i) − D/2, z_bevel(i) + D/2], with z_bevel(i) = zFront(outline_i) − b(i). So the eyewire follows the lens bevel curve. Real eyewires are shaped to the bevel curve; see the "bevel curve / bevel locus" patents US 6 887 134 and US 6 935 924. [CITED: title level only, from search results, not read]
- Bridge: from the OD nasal rim point to the OS nasal rim point. Length exactly DBL in x, because the boxing centres are at ±(A + DBL)/2.
- End pieces at the temporal-superior rim. Temples of length L (stamp or 140 mm), 30° earpiece bend over the last 35 mm, 95° opening (UI-SPEC design values).
- World placement:
  - Lens-local +x = examiner's right (conventions.js), so OD boxing centre x = −(A + DBL)/2 and OS = +(A + DBL)/2, with no mirroring. OD nasal (+x local) then points to the bridge.
  - OS uses its own `frameOutline(…, 'OS')` and its own surfaces (D-04(d)).
- Lenses are planar, with no pantoscopic tilt or face-form wrap, because the engine has none. Label this in Technische Angaben. [ASSUMED design choice]

### Pattern 4: Worker mesh lane with double-buffered transfer (VIZ-06, D-26)
- New message `{ type: 'mesh', id, items: [{ slot, surfaces, frame, eye, rimDepth, temple, rule }], buffers }`. The reply is `{ type: 'mesh', id, items: [{ slot, arrays…, boundingSphere, finite }] }`.
- The handler returns `{ msg, transfer }`, and the glue calls `self.postMessage(msg, transfer)`.
- Change the "No transferables" header comment and `compute-protocol.test.js`.
- **Double buffer per slot:** slot = { attached set, spare set }. Send the *spare* to the worker; on reply attach it (`attr.array = filled; attr.needsUpdate = true`) and make the old one the spare.
  - Never transfer the attached arrays. three.js re-uploads from `attribute.array` after `webglcontextrestored` (`initGLContext` resets caches, r187 `onContextRestore`), and a detached array has byteLength 0, which throws the resize error.
- Lane order in `compute-client`: main compute → **mesh (one job, latest only)** → compare → profile → bench.
  - The 3D view waits for at most one compare job. The compare table waits for at most one mesh job (about 40–50 ms phone estimate).
  - Generation bump on a changed main request drops stale mesh answers, as for profiles.
- Sync mode (no worker): build on the main thread only after the result paint, in its own task, and mark Technische Angaben. Or hold it like compare jobs (planner decides; it is a fallback).
- Set `geometry.boundingSphere` from the builder's value. Do not call `computeBoundingSphere()` on the main thread, which is an extra O(n) pass.

### Pattern 5: Renderer, look and on-demand rendering (VIZ-04, D-07…D-12, D-20)
- `new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })` inside try/catch.
  - The constructor **throws** "Error creating WebGL context." when `getContext('webgl2')` returns null (r187 WebGLRenderer.js lines 411–425). Catch it and show `view.noWebgl`.
  - Do not use `WebGL.isWebGL2Available()`: it creates a throwaway second context.
- `renderer.setSize(w, h, false)` with CSS sizing from classes. `updateStyle = true` would write `canvas.style.width`, which CSP allows (CSSOM property writes are not blocked, MDN style-src), but `false` keeps sizing in CSS.
- `toneMapping = NeutralToneMapping` (constant 7). The clear colour is converted to the output colour space (`WebGLBackground.setClear` → `getUnlitUniformColorSpace`), so the corner pixel = `#f3f4f6`.
- Environment: `const pmrem = new PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();`, then dispose the RoomEnvironment. Signature `fromScene(scene, sigma = 0, near = 0.1, far = 100, options = {})`.
  - Default near/far 0,1–100 are scene units = mm here. RoomEnvironment is authored around a room of about 10–30 units, so this is fine as is [ASSUMED: visual check in MCP screenshot].
- Lens material: `ior` accepts 1,0–2,333 (MeshPhysicalMaterial docs), so nₑ 1,40–2,0 custom is in range.
  - `thickness` is in mesh units, so CT in mm is correct with D-01.
  - `dispersion` is defined as 20/V_d (KHR_materials_dispersion, which three's GLTFLoader passes straight through). The project stores νₑ (`materials.js` `ve`), so use `dispersion = 20/νₑ` and label it "aus der Abbe-Zahl νₑ (angenähert als V_d)". A custom material with `ve: null` gets 0.
  - Dispersion triples the transmission samples (shader loops over 3 IORs). Use it on the hoch tier only.
- Transmission internals that matter:
  - The render target is created **per `camera.id`** (`transmissionRenderTarget[camera.id]`), with `samples = max(4, capabilities.samples)`, HalfFloat and mipmaps. **Use one camera for the life of the view.**
  - It renders only opaque objects, so lenses do not see each other, which is why the edge band and frame are opaque.
  - It is sized to the active viewport × `transmissionResolutionScale`.
- Render on demand per the official example (three.js `manual/examples/render-on-demand-w-damping.html`, tag r187): `controls.addEventListener('change', requestRenderIfNotRequested)`. `render()` clears the flag, then calls `controls.update()`, which dispatches `change` while damping continues, then `renderer.render`.
- Precompile: `renderer.compileAsync(scene, camera)` after the scene is built. Keep the Dickenkarte material on a hidden mesh in the scene, because `compile` collects materials with `scene.traverse`, invisible objects included (r187 source). The first "Dickenkarte" click then does not stall on shader compilation.

### Pattern 6: Scroll-safe controls (VIZ-03, D-15 as amended)
- Construct `new OrbitControls(camera)` with no element, then call `controls.connect(stageOrCanvas)` only when active (desktop: always; touch: on "3D drehen"). `controls.disconnect()` restores `touchAction = ''` and removes pointer, wheel and contextmenu listeners (r187 source lines 495–534).
- While touch is inactive, the stage class sets `touch-action: pan-y pinch-zoom`.
- Wheel: `onMouseWheel` returns before `preventDefault()` when `enableZoom === false` (r187 line 1785). Set `controls.enableZoom` true only while `#view-stage` has focus, and the page scrolls otherwise.
- Keyboard: the UI-SPEC's own handler drives the camera. The built-in `keys` default is the arrows → **pan** (`keys = { LEFT: 'ArrowLeft', … }`, `_pan(…, keyPanSpeed)`), confirming the UI-SPEC change.
- Limits: `minPolarAngle`, `maxPolarAngle`, `minDistance`, `maxDistance` and `maxTargetRadius` exist (target clamped with `clampLength(minTargetRadius, maxTargetRadius)`).
- `#view-labels` needs `pointer-events: none`, so labels never swallow drags.

### Pattern 7: Heatmap shader on an engine scalar (VIZ-05)
- One `ShaderMaterial` (GLSL 3.00 ES, so `fwidth` is core) reads the `thickness` attribute (Float32, 4 B/vertex).
  - Uniforms: `scaleMin`, `scaleMax`, `isoStep`, `lut[11]` (sRGB hex from the UI-SPEC).
  - Colour = cividis(1 − t). The iso-line mask is `abs(fract(th/step − 0.5) − 0.5) / fwidth(th/step) < 1.0` (2 px), and the line colour is white/black by LUT t.
  - Do **not** include `<colorspace_fragment>` or `<tonemapping_fragment>`. The raw sRGB LUT value is then written to the canvas and equals the legend colour.
- Scale (shared, D-23/D-25):
  - min = min over displayed lenses of `min(ct, etMin)`, max = max of `max(ct, etMax)`. Both are engine metrics.
  - A Node test asserts that every mesh vertex thickness lies in [min − 0,01, max + 0,01]. Interior extrema other than at the OC are not expected but are not proven [ASSUMED].
- Callouts:
  - The 4 edge callouts at the horizontal and vertical lines through the OC (UI-SPEC) are exactly `meridianProfile(lens, 0).ends` and `meridianProfile(lens, 90).ends`. These are engine values from `thicknessAt` at the polygon intersection, the same numbers the cross-section shows at 0°/90°. Reuse them; do not write a new intersection routine.
  - Mitte = `metrics.ct` at `surfaces.oc`; dickste = `metrics.etMax` (value, x, y).
  - `meridianProfile` returns `NO_CHORD` when the OC is outside the outline. Then show the table rows as "–" with a reason, and no projected labels (open question 3).
- Iso-label positions: bisection of `thicknessAt` along the 0° chord (engine helper). Projected with `Vector3.project(camera)`.

### Pattern 8: A/B scissor viewports (RES-03, D-24)
- `renderer.setScissorTest(true)`. For each half: `setViewport` and `setScissor`, toggle group visibility (A lens + A frame, or B), then `renderer.render(scene, camera)`.
- Use the same camera with each group positioned so its lens boxing centre is at the origin. The transmission target is resized to each half (active viewport) and reused, because the camera is the same.
- Slots: OD, OS (B = main) plus **one** A slot (the compared eye). Allocate and upload the A slot once (warm-up), then only toggle `visible`. Never dispose and recreate on compare start/end.

### Pattern 9: Thumbnail without `preserveDrawingBuffer` (UX-03)
- `renderer.render(…)`, then immediately in the **same task** `thumbCtx.drawImage(renderer.domElement, 0, 0, 96, 72)`.
- Verified 2026-11-08 in Playwright Chromium 158: same task → `[255,0,0,255]`, after rAF + 50 ms → `[0,0,0,0]` (the drawing buffer is cleared after compositing).
- Any `await` between render and copy breaks this.

### Anti-Patterns to Avoid
- **New `BufferGeometry` or new-length arrays per input.** It throws (resize unsupported) or leaks. Use fixed topology plus array swap.
- **A new `PerspectiveCamera` per preset or A/B.** That creates a new transmission render target per `camera.id`, which never gets freed, a texture leak.
- **Transferring the arrays currently attached to an attribute.** It breaks the context-restore re-upload.
- **`computeVertexNormals()`**, earcut/`ShapeGeometry` for lens faces (PITFALLS 14), a mesh-derived number in any label.
- **Mirroring the OD mesh for OS.** Only the outline shape is mirrored inside `frameOutline`.
- **`WebGL.isWebGL2Available()`** before creating the renderer (a second context). Use try/catch on the renderer.
- **Async gaps (`await`) between `render()` and the thumbnail `drawImage`.**
- **`listenToKeyEvents`.** Arrows pan, and no zoom keys (UI-SPEC change).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Surface sag/normal/thickness at vertices | a second sag implementation (JS or GLSL) | `design.js` + `metrics.thicknessAt` | D-02; the engine's sag is the cancellation-safe, tested form |
| Callout edge points through the OC | new ray–outline intersection | `profile.js meridianProfile(…, 0/90).ends` | Already engine-tested; equals the cross-section numbers |
| Orbit math, damping, polar limits | own spherical camera | `OrbitControls` (connect/disconnect) | Damping and limits verified in r187 |
| Studio reflections | HDRI download or own cube map | `RoomEnvironment` + `PMREMGenerator` | No asset, no licence (D-07) |
| Precompiling shaders | warm-up renders | `renderer.compileAsync` | Uses `KHR_parallel_shader_compile` when present |
| Web Worker latest-wins | new message plumbing | extend `compute-client` lanes (generation drop) | Tested patterns for compare/profile exist |
| mm formatting | template strings | `format.js` `fmtMm` | de-AT, narrow NBSP, one rounding rule |

**Key insight:** the risky parts are not the 3D API. They are silent divergence between picture and numbers, and resource lifetime. Both are solved by reusing engine functions and fixing topology, not by more code.

## Common Pitfalls

### Pitfall 1: Buffer resize throws
**What goes wrong:** `THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`
**Why:** r187 `WebGLAttributes.update` compares `data.size` with `attribute.array.byteLength`.
**How to avoid:** use constant `RINGS`/`SPOKES` for every shape, size, tier and eye. Geometry resolution is identical in every tier (UI-SPEC). The outline must always be 720 points (`evaluateLens` default; never pass `outlinePoints`).
**Warning signs:** a console error on the first frame-shape change.

### Pitfall 2: Float32 near-ties change the etMax location
**What goes wrong:** D-04(b) "locations equal" fails at axis 0/90/180, where mirrored points tie within 1e-15 mm in Float64 (`TIE_TOL_MM`), but Float32 z rounding (~1e-6 mm) picks the other corner.
**How to avoid:** test values within 0,001 mm. Assert the vertex at `metrics.etMax.index` has thickness within 0,001 mm of `etMax.value` and that no outline vertex exceeds `etMax.value + 0,001`. Do not compare argmax indices of Float32 data.

### Pitfall 3: Centre thickness without a centre vertex
**What goes wrong:** the polar centre is the boxing centre, not the OC, so no vertex sits at the OC.
**How to avoid:** for D-04(b) "centre = CT", assert that `thicknessAt(oc) === ct` (engine identity), and that the barycentric interpolation of mesh thickness at the OC (containing triangle) is within 0,02 mm (two surface bounds) of CT.

### Pitfall 4: The D-04(c) bound depends on the tested domain
**What goes wrong:** the 0,01 mm claim is tested on easy lenses only, or fails on custom nₑ < 1,49.
**How to avoid:**
- Test a fixed set: the named extremes from the table above (−10 CR-39 62×55 PD 25; −10/−6×45 40×28 PD 40; Grenzfall; rescan pair), plus a seeded fuzz of about 50 lenses over sourced materials and Expert overrides.
- Sample at least the 3 edge midpoints + centroid (better: 10 barycentric points) of every triangle.
- For nₑ 1,40–1,49, either accept a documented ≤ 0,025 mm (needs user or lens-critic acceptance) or raise RINGS. The measured 0,0127 at 128 rings still fails, so raising RINGS is not a fix.
- Runtime: about 0,1–0,2 s per lens in Node, so about 60 lenses fit the 30 s `testTimeout`.

### Pitfall 5: Leak test that measures the warm-up
**What goes wrong:** `info.memory.geometries` and `textures` grow on the first compare start, the first Dickenkarte, the first transmission frame (render target) or a tier change, and the D-27 test fails, or a real leak is excused as warm-up.
**How to avoid:**
- Snapshot after one full warm-up cycle (Glas → Dickenkarte → Glas, compare start → end, one shape change).
- Then run 50+ changes and assert equal counts.
- Separately assert that the post-warm-up counts equal a documented expected number (slots × geometries + env + chart + shadow + transmission RT).

### Pitfall 6: Transmission render target per camera
**What goes wrong:** a fresh camera per preset or per A/B half silently adds a multisampled HalfFloat render target each time.
**How to avoid:** one camera, presets tween its position and target. A test asserts that `textures` is unchanged after cycling all presets.

### Pitfall 7: Context loss after a transfer
**What goes wrong:** after `webglcontextrestored`, three.js re-uploads all attributes from their arrays. Detached arrays throw. The PMREM env texture is render-target content and is lost.
**How to avoid:**
- Double buffer (Pattern 4).
- On restore: regenerate `scene.environment` with PMREM and re-render. Canvas-sourced textures (chart, shadow) re-upload from their canvas, so keep the canvases [ASSUMED: verify with `renderer.forceContextLoss()` + `WEBGL_lose_context.restoreContext()` in Playwright].

### Pitfall 8: The canvas traps scrolling, or the wheel hijacks the sticky column
**How to avoid:** Pattern 6. A Playwright `hasTouch` test: a swipe over the inactive stage scrolls the page (scrollY changes), and the wheel without focus scrolls the column.

### Pitfall 9: Rim outward offset self-intersects on concave outline parts
**What goes wrong:** panto/pilot are "not convex everywhere" (profile.js), and a 4 mm outward offset can fold where the concave radius is < 4 mm.
**How to avoid:** a Node test over all shapes at min/max A, B (40/62, 28/55): the offset polygon is simple and CCW (no edge crossings). If it fails, reduce the face width locally and document it.

### Pitfall 10: NaN in a position buffer
**What goes wrong:** three logs "computed radius is NaN" and the mesh vanishes. The console check (D-30) flags it.
**How to avoid:** the builder returns `finite: false` when any value is non-finite. The view then draws that lens as blocked ("R – nicht berechnet") and never uploads NaN. A test covers all probe extremes; no NaN was seen in about 8 000 lenses.

### Pitfall 11: Shader compile stall and per-material recompiles
**What goes wrong:** a long first frame. `transmission` or `dispersion` crossing 0 bumps `material.version` (the r187 setters), which recompiles.
**How to avoid:** set dispersion once per tier (> 0 or 0), never toggle `transmission`, swap pre-created materials, and call `compileAsync` at mount.

### Pitfall 12: ENG-09 (a) gets worse
**What goes wrong:** the 3D render after a re-mesh is a new main-thread frame: attribute upload of about 4,8 MB per pair plus a transmission render. On a phone this can exceed 16,7 ms.
**How to avoid:**
- Render in its own rAF after the result paint, never in the same frame as the cards.
- Measure it as "3D-Neuaufbau" (`tech.view.remesh`).
- Use the `sparsam` tier as the step-down.
- ENG-09 (a) is already accepted as unmet for typing (02-15). Record the 3D frame separately, not as a regression of (a).

## Code Examples

### Render on demand with damping (official pattern, r187)
```javascript
// Source: github.com/mrdoob/three.js manual/examples/render-on-demand-w-damping.html @ r187
let renderRequested = false;
function render() {
  renderRequested = false;
  controls.update();          // dispatches 'change' while damping is still moving
  renderer.render(scene, camera);
  afterRender();              // same task: thumbnail drawImage, label projection
}
function requestRenderIfNotRequested() {
  if (!renderRequested) { renderRequested = true; requestAnimationFrame(render); }
}
controls.addEventListener('change', requestRenderIfNotRequested);
```

### In-place attribute swap (no allocation, no resize)
```javascript
// Source: r187 BufferAttribute (needsUpdate → version++), WebGLAttributes.update (size check)
function attach(geom, name, filled /* Float32Array, same length as before */) {
  const attr = geom.getAttribute(name);
  const old = attr.array;
  attr.array = filled;        // same byteLength → bufferSubData, else it throws
  attr.needsUpdate = true;
  return old;                 // becomes the spare for the next worker job (never transfer `filled`)
}
geom.boundingSphere ??= new Sphere();
geom.boundingSphere.set(center.set(bs.x, bs.y, bs.z), bs.r);   // from the builder, no O(n) pass
```

### Touch toggle = connect/disconnect
```javascript
// Source: r187 OrbitControls.connect() sets touchAction 'none'; disconnect() restores ''
const controls = new OrbitControls(camera);   // no element → not connected yet
function setActive(on) {
  if (on) controls.connect(stage); else controls.disconnect();
  rotateBtn.setAttribute('aria-pressed', String(on));
}
stage.addEventListener('focus', () => { controls.enableZoom = true; });
stage.addEventListener('blur',  () => { controls.enableZoom = false; }); // wheel then scrolls the page
```

### WebGL2 check without a second context
```javascript
// Source: r187 WebGLRenderer constructor throws 'Error creating WebGL context.' when webgl2 is null
let renderer;
try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
catch { showNoWebgl(); return; }   // D-17: numbers, compare and cross-section keep working
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebGL1 fallback, `isWebGL2` checks | WebGL2 only | three r163 (PITFALLS integration table) | No WebGL1 path to write |
| `listenToKeyEvents` / always-connected controls | `connect(element)` / `disconnect()` on the Controls base | present in r187 | Clean touch activation toggle |
| `attribute.updateRange` | `addUpdateRange(start, count)` / `clearUpdateRanges()` | present in r187 | Not needed here (full-array updates) |
| ACES Filmic for everything | `NeutralToneMapping` (Khronos PBR Neutral) for product shots | in r187 constants (7) | Faithful whites and base colours (UI-SPEC choice) |

**Deprecated/outdated:** `WebGL.isWebGL2Available()` is still present but creates a throwaway context. Prefer try/catch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The eyewire groove is centred in the rim depth, so the bevel apex is the rim's z centre | Pattern 2 | Front/back split shifts; total unchanged. Labelled "angenommen" |
| A2 | '1:2' is a sensible single default for all lenses (labs vary) | Pattern 2 | Protrusion text differs from a given lab's result. Mitigated by the assumption note |
| A3 | Lens thickness has no interior extremum other than the OC (heat scale from ct/etMin/etMax) | Pattern 7 | Scale clips. Covered by the vertex-range test |
| A4 | Pixel 7 Pro worker speed ≈ 1,3× Node desktop for the builder (from the engine bench ratio in 02-15) | Summary, Pattern 4 | Mesh latency higher. Must be measured (D-28) |
| A5 | Canvas-sourced textures re-upload after context restore; PMREM must be regenerated | Pitfall 7 | Blank env or chart after restore. Test with `forceContextLoss` |
| A6 | `RoomEnvironment` at default `fromScene` near/far works at mm scale | Pattern 5 | Odd reflections. MCP screenshot check |
| A7 | Torus domain covers the interior grid for every computable lens (empirical, about 8 000 lenses) | Pattern 1 | NaN mesh. Builder `finite` flag + blocked display |
| A8 | Lenses planar, no tilt or wrap | Pattern 3 | Less realistic. Numbers unaffected; label it |
| A9 | Restricting `three` imports to `src/ui/view/**` by lint is wanted | Structure | None functional |
| A10 | Dispersion from νₑ as an approximation of V_d (KHR defines V_d) | Pattern 5 | Cosmetic only, hoch tier |
| A11 | The lazy three chunk is about 130–170 KB gzip | Env | Slower first 3D on slow networks. Measure in build output |

## Open Questions

1. **D-04(c) for custom nₑ < 1,49**
   - What we know: 64 × 720 rim-graded meets ≤ 0,0078 mm for all sourced materials and Expert overrides with nₑ ≥ 1,49. Custom nₑ 1,40–1,43 gives 0,020 mm (0,0127 even at 128 rings), on lenses with 43–45 mm edges.
   - What's unclear: whether the user accepts the domain split, or wants adaptive refinement.
   - Recommendation: test-assert ≤ 0,01 mm for nₑ ≥ 1,49 (the UI's own hint floor, `validate.js` ne hint [1,49, 1,9]) and ≤ 0,025 mm below that. Put it to lens-critic and the user as an explicit acceptance item.
2. **Bevel default**
   - Question: '1:2' everywhere vs. minus → '1:2' and plus → '1:1' (forum practice, LOW).
   - Recommendation: one rule ('1:2', cited option) for simplicity. Plus edges rarely exceed 0,75·D anyway.
3. **Callouts when the OC lies outside the outline** (`meridianProfile` → `NO_CHORD`).
   - Recommendation: the table shows "–" with a sentence, and the heatmap still renders (the scale is still valid).
4. **Sync-mode (no worker) 3D**
   - Choice: build on the main thread after the result paint, or hold like compare jobs.
   - Recommendation: build after paint, in its own task, and accept the frame, because sync mode is a rare fallback already labelled in Technische Angaben.
5. **m6 thick-result note** (deferred): the probes show computable lenses with 41–45 mm edges (−10 in 62×55 CR-39). The 3D view will make that visible. Planner: keep it deferred unless a sourced threshold is found; no source was found in this research.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, tests, builder benchmarks | ✓ | v22.17.0 | — |
| npm registry access | `three@0.187.0` install | ✓ | 0.187.0 resolvable | — |
| Playwright Chromium (headless) with WebGL2 | e2e 3D tests, leak test, pixel checks | ✓ | Chromium 158.0.8127.18; renderer "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))", MAX_SAMPLES 4, EXT_color_buffer_(half_)float yes, WEBGL_multisampled_render_to_texture no | — |
| `--enable-unsafe-swiftshader` | WebGL in headless CI | ✓ default | Playwright 1.65 adds it (coreBundle.js default args) | — |
| GitHub Actions ubuntu-latest | CI WebGL | likely ✓ | same Playwright Chromium | [ASSUMED]; first CI run proves it |
| chrome-devtools MCP | D-30 live checks | not probed from this agent | — | Executor and verifier use it (memory rule); if missing, a blocking human check |
| Pixel 7 Pro (user's device) | D-28 real-phone numbers | human | Android 17, Chrome 156 (02-15) | 4× proxy only estimates; real phone required |

**Missing dependencies with no fallback:** none for building. The real-phone measurement needs the user.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (project `unit`, node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0; chrome-devtools MCP for live checks (D-30) |
| Config file | `vite.config.js` (`test.projects`, coverage on `src/engine/**` 95 % lines / 90 % branches, so it covers `src/engine/mesh/`), `playwright.config.js` (desktop 1280, mobile 360 hasTouch; perf only with PERF=1) |
| Quick run command | `npm test` |
| Full suite command | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | D-04(a) outline front z − back z = `thicknessAt` ± 0,001 mm, both eyes | unit (+ fast-check) | `npx vitest run src/engine/mesh/lens.test.js -t "VIZ-01"` | ❌ Wave 0 |
| VIZ-01 | D-04(b) edge max/min values within 0,001 of etMax/etMin at their indices; centre per Pitfall 3 | unit | same file | ❌ Wave 0 |
| VIZ-01 | D-04(c) sag error ≤ 0,01 mm (nₑ ≥ 1,49 set), ≤ 0,025 mm below (if accepted) | unit (slow, about 10 s) | `npx vitest run src/engine/mesh/tessellation.test.js` | ❌ Wave 0 |
| VIZ-01 | D-04(d) OS built from OS surfaces and outline; OS ≠ mirror(OD) for axis 30 | unit | lens.test.js | ❌ Wave 0 |
| VIZ-01 | all values finite over the extremes; fixed lengths (VERTS) for every shape and size | unit | lens.test.js | ❌ Wave 0 |
| VIZ-02 | bridge length = DBL; rim offset polygon simple for all shapes at size limits; temple length = stamp or 140 | unit | `npx vitest run src/engine/mesh/frame.test.js` | ❌ Wave 0 |
| VIZ-03 | `bevelSplit` sums to `edgeBeyondRim` when both > 0; rules 1:1/1:2/front; the UI text uses it | unit + e2e | `npx vitest run src/engine/rim.test.js`; `npx playwright test e2e/view.spec.js -g "Seite"` | rim.test ✅ (extend) / view.spec ❌ |
| VIZ-03 | presets change camera and aria viewName; reduced motion cuts; swipe on inactive stage scrolls page; wheel without focus scrolls | e2e | `npx playwright test e2e/view.spec.js` | ❌ Wave 0 |
| VIZ-04 | canvas renders; corner pixel `#f3f4f6` ± 2; badge and caption text present; lens ior = nₑ (debug read) | e2e | view.spec.js | ❌ Wave 0 |
| VIZ-05 | D-04(e) callouts = `meridianProfile` 0/90 ends, ct, etMax (unit); table text equals the formatted engine values; legend SVG has `<title>`/`<desc>`; iso step gives 4–8 lines | unit + e2e | `npx vitest run src/engine/mesh/heat.test.js`; `npx playwright test e2e/view-heat.spec.js` | ❌ Wave 0 |
| VIZ-06 | mesh lane latest-wins, generation drop, one queued, transfer list | unit | `npx vitest run src/state/compute-client.test.js src/state/compute-protocol.test.js` | ✅ (extend) |
| VIZ-06 | D-27 leak: after warm-up, 50+ changes leave `memory.geometries`/`.textures` equal; presets cycle leaves `textures` equal | e2e | `npx playwright test e2e/view-memory.spec.js` | ❌ Wave 0 |
| VIZ-06 | D-28 timings on the 4× proxy (main thread) | perf (informational) | `npm run test:perf` | ✅ (extend perf-throttled.spec.js) |
| RES-03 | A/B side by side at ≥ 360 px (two captions), toggle below; same scale; end returns to default | e2e | `npx playwright test e2e/view-compare.spec.js` | ❌ Wave 0 |
| UX-02 | Dickenkarte switch only in Expert; off → back to Glas | e2e | view-heat.spec.js | ❌ Wave 0 |
| UX-03 | thumbnail canvas non-blank after re-mesh (sample a pixel ≠ 0 alpha) at 360 px | e2e | view.spec.js (mobile project) | ❌ Wave 0 |
| UX-04 carry | axe zero violations in the UI-SPEC state matrix at 320 and 1280; no overflow | e2e | `npx playwright test e2e/a11y.spec.js` | ✅ (extend states) |
| D-17 | no-WebGL note via a test flag (e.g. `?nowebgl` forcing the catch path) | e2e | view.spec.js | ❌ Wave 0 |
| CSP | the CSP string is unchanged and no CSP console violations occur with 3D | e2e | `npx playwright test e2e/worker.spec.js` | ✅ (extend) |
| Lint | `three` is rejected in `src/engine/**`, `src/state/**`, `src/worker/**` and non-view `src/ui/**` | unit | `npx vitest run src/engine/boundary.test.js` | ✅ (extend) |

**Manual / MCP-only (each UI plan's `<verify>`, D-30):**
- chrome-devtools MCP at 412×915, 320×640 and 1280×800 on `vite preview /Eyeglass-Prescription/`.
- Screenshots of default, Vorne, Seite (protrusion visible, near temple faded), Oben, Dickenkarte (callouts, no overlap), A/B, the bar thumbnail and the no-WebGL state, with a written statement of what each shows.
- `list_console_messages`: no errors or warnings.
- `performance_start_trace`/`stop_trace` at 4× during one re-mesh (≤ 200 ms input → 3D paint) and a 3 s orbit (median/p95 frame ≤ 16,7 ms target).
- `evaluate_script` `window.__eyeglassView.memory()` before and after 20 changes.
- Real Pixel 7 Pro via the live site (human): re-mesh-to-paint and orbit frame times in VERIFICATION, 02-15 method.
- Heap-snapshot comparison (manual, D-27).

### Sampling Rate
- **Per task commit:** `npm test`. For view tasks also `npm run build && npx playwright test e2e/view*.spec.js` plus the MCP checks above.
- **Per wave merge:** the full suite command.
- **Phase gate:** full suite green, `npm run test:perf` recorded, the MCP matrix done, the Pixel 7 Pro numbers recorded, then the lens-critic result review before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/engine/mesh/lens.test.js`, `tessellation.test.js`, `frame.test.js`, `heat.test.js`: D-04 (a)–(e), finiteness, fixed lengths
- [ ] `src/engine/rim.test.js` extension: `bevelSplit`
- [ ] `src/state/compute-protocol.test.js` / `compute-client.test.js` extension: mesh lane + transfer
- [ ] `e2e/view.spec.js`, `e2e/view-heat.spec.js`, `e2e/view-compare.spec.js`, `e2e/view-memory.spec.js`
- [ ] `e2e/helpers.js`: `settledView(page)` (e.g. `#view[data-pending]`, like `settledXsec`) and a `?nowebgl` test flag
- [ ] Debug handle `window.__eyeglassView` (read-only, UI-SPEC) for memory, tier and camera/viewName reads
- [ ] No framework install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | static site, no accounts |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing `parse.js`/`validate.js`. The worker `mesh` handler validates item shape (finite numbers, 720-point outline, known slot), never throws, and returns `finite: false` instead of NaN buffers |
| V6 Cryptography | no | — |
| V10 Malicious code / supply chain (V14 config, L1) | yes | `three@0.187.0` exact pin, slopcheck [OK], no install scripts, pins.test.js covers dependencies; no CDN; CSP unchanged (`script-src 'self'`); three.js writes only CSSOM properties (`canvas.style.width/height`, `touchAction`, `cursor`), which CSP allows (MDN style-src) |
| V8 Data protection | yes | No storage (T-02-39 test stays). The debug handle exposes renderer counters and the tier name only, never Rx values |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTML injection via projected labels | Tampering | `textContent` only (lint bans innerHTML, outerHTML and insertAdjacentHTML in `src/ui/**`, which covers `src/ui/view/`) |
| Resource exhaustion from extreme inputs (huge meshes) | DoS | Fixed topology bounds memory (about 2,4 MB per lens, 3 slots, double-buffered); latest-wins drops stale jobs |
| Stale or forged worker messages applied to the scene | Tampering | Generation and slot checks on every mesh reply, as for compare/profile (T-02-16/T-02-37 patterns) |
| Supply-chain swap of three | Tampering | Exact pin + lockfile integrity + npm ci in CI; no runtime fetches |
| GPU fingerprinting via the debug handle | Information disclosure | The handle returns counters and the tier only, never `UNMASKED_RENDERER` |

## Sources

### Primary (HIGH confidence)
- three@0.187.0 npm tarball, read locally (`npm pack three@0.187.0`, isolated scratch dir):
  - `src/renderers/WebGLRenderer.js`: context creation and throw at lines 395–440, context loss/restore at 1117–1145, `transmissionResolutionScale` at 298, the transmission pass with its per-`camera.id` render target at 2030–2130, `compile`/`compileAsync` at 1400–1560, `setViewport`/`setScissor`/`setScissorTest` at 810–881.
  - `src/renderers/webgl/WebGLAttributes.js`: the resize throw.
  - `src/renderers/webgl/WebGLInfo.js`: `memory.geometries`/`textures`.
  - `src/renderers/webgl/WebGLBackground.js`: the clear colour space.
  - `src/renderers/webgl/WebGLProgram.js`: `#version 300 es`.
  - `src/materials/MeshPhysicalMaterial.js`: `ior` range, `thickness`, `dispersion`/`transmission` setters bump the version.
  - `src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js`: the dispersion loop.
  - `src/constants.js`: `NeutralToneMapping = 7`, `REVISION '187'`.
  - `src/extras/PMREMGenerator.js`: `fromScene` signature.
  - `examples/jsm/controls/OrbitControls.js`: connect/disconnect, touchAction, `keys`, wheel, `maxTargetRadius`.
  - `examples/jsm/environments/RoomEnvironment.js`, `examples/jsm/capabilities/WebGL.js`, `package.json` exports.
- three.js repo `manual/examples/render-on-demand-w-damping.html` at tag r187 (via `gh api`).
- Project source read 2026-11-08: `src/engine/{design,sag,metrics,rim,conventions,evaluate,profile}.js`, `frame/{outline,shapes}.js`, `state/{compute-protocol,compute-client,bench-cases,validate,frame}.js`, `worker/engine.worker.js`, `ui/{main,pipeline,frame-input}.js`, `eslint.config.js`, `vite.config.js`, `playwright.config.js`, `index.html`.
- Measurements, this session: tessellation error probes and build timing against the real engine (scratchpad `tess/`); Playwright Chromium WebGL2 probe and thumbnail same-task probe (scratchpad `webgl-probe.mjs`, `thumb-probe.mjs`); `node_modules/playwright-core/lib/coreBundle.js` default args.
- npm registry: `npm view three` (version, dist-tags, scripts, dependencies, repository, created); api.npmjs.org weekly downloads; slopcheck [OK].
- KHR_materials_dispersion README (github.com/KhronosGroup/glTF): dispersion = 20/V_d, ratified.
- MDN CSP `style-src`: CSSOM property writes are not blocked; `setAttribute('style')` and `cssText` are.

### Secondary (MEDIUM confidence)
- US 8 388 133 B2 (Essilor), Google Patents: bevel criteria "front curve tracing", "1:1", "1:2".
- 02-15-SUMMARY.md: Pixel 7 Pro worker bench (normal pair 2,15 ms) vs Node desktop 1,67 ms (02-RESEARCH), used for the phone estimate.

### Tertiary (LOW confidence)
- [optiboard.com forum: "Bevels"](https://www.optiboard.com/forums/forum/optical-forums/general-optics-and-eyecare-discussion-forum/33012-bevels) and [page 2](https://www.optiboard.com/forums/forum/optical-forums/general-optics-and-eyecare-discussion-forum/33012-bevels/page2): lab practice (minus toward front, plus centred; 1/3–2/3 pushes the lens forward).
- [20/20 Magazine, J. Dukes, "Bevel, Bevel, Where For Art Thou?" (2015)](https://www.2020mag.com/article/bevel-bevel-where-for-art-thou): front bevel leaves excess behind the eyewire.
- US 6 887 134 / US 6 935 924 titles ("Method for deciding a bevel curve …"): eyewire and bevel curve; titles only, not read.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Single package, verified in the registry and slopcheck; APIs read in source.
- Architecture: HIGH for the geometry topology, error bounds, buffer rules and worker need (measured). MEDIUM for A/B transmission in scissor viewports (source-consistent, needs a screenshot).
- Pitfalls: HIGH. Most come straight from r187 source behaviour or from probes run here.
- Bevel rule: MEDIUM. The options are citable; the default choice is an assumption.
- Phone performance: MEDIUM-LOW until measured on the Pixel 7 Pro.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08 (three is pinned; re-check only if the pin changes)
