# Phase 3: 3D Lenses & Frame - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

**How decided:** Four gray areas were offered (3D view placement on phones, scene and default camera, heatmap presentation, A/B comparison in 3D). The user picked none. Their answer: "use best practice and focus is photorealistic 3D and as correct as possible result". Every decision below is therefore Claude's best-practice choice, and two priorities govern it, in this order:

1. **Correct:** every rendered dimension is the engine's number.
2. **Photorealistic:** physically based look.

Both stay under the standing rules "as easy as possible for a lay user" and "no visible lag on a mid-range phone" (VIZ-06). If photorealism and correctness or phone performance conflict, correctness wins first and phone performance second. Photorealism then degrades by quality tier and is never dropped silently. Each decision may be revised in `/gsd:ui-phase 3` or in plan review without asking again, as long as the change keeps or improves correctness, realism or lay usability (memory `best-practice-default`).

<domain>
## Phase Boundary

Phase 3 puts the glasses in 3D on top of the already-verified numbers. It includes:

- Both lenses as procedural meshes built from the engine's surfaces: front, back and edge band at exact local thickness, inside the frame outline.
- A parametric frame: rim, bridge and temples.
- Orbit, pan and zoom by mouse and touch, plus the presets Vorne / Seite / Oben. The side view shows front-surface protrusion beyond the rim.
- A photorealistic transparent glass look over a checkerboard / eye-chart background, labelled as a visual impression.
- An Expert thickness heatmap with a mm legend, iso-lines and numeric callouts.
- The 3D part of the A/B comparison (RES-03).
- A lens view that stays visible while editing on phones (UX-03).
- Re-meshing without visible lag or GPU-memory growth on a real mid-range phone.

Requirements: VIZ-01..06; completes RES-03, UX-02 (heatmap), UX-03 (lens view visible while editing on phones).

Not in this phase: physically traced refraction through the real surfaces ("Durchblick", phase 4, CPU warp grid), the offline service worker (phase 4), and modelling ADD or prism (out of v1).

</domain>

<decisions>
## Implementation Decisions

### Correctness of the geometry (VIZ-01, governs everything else)
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

### Photorealistic look (VIZ-04)
- **D-07:** **Physically based rendering.** `WebGLRenderer` with physically correct lighting, sRGB output and a filmic tone mapping (AgX or ACES; the researcher picks for glass and acetate). Image-based lighting comes from `RoomEnvironment` through `PMREMGenerator`: a procedural studio environment with no downloaded HDRI, so there is no third-party asset or licence issue and no extra MB on phones. A CC0 HDRI is allowed only if the researcher shows a clear visual gain with a licence citation and a size under 1 MB.
- **D-08:** **Lens material:** `MeshPhysicalMaterial` with `transmission: 1`, `ior` = the selected material's index (custom material included), `thickness` from the engine, `roughness: 0` and specular reflections from the environment. Dispersion may be driven from the material's Abbe number when it is available and affordable on the quality tier. The **edge band** gets a slightly frosted/polished-edge look, so the user sees the edge thickness the way it looks on real glasses. A faint AR-coating tint is allowed, at most cosmetic.
- **D-09:** **Frame material:** a PBR acetate look: dark, slightly translucent-looking, with a clearcoat. It is one neutral default. A frame colour picker is out of scope (see Deferred). The temples have a simple hinge block and an earpiece bend.
- **D-10:** **Background (VIZ-04):** a high-contrast checkerboard / eye-chart plane behind the glasses at a fixed, documented distance. It is generated procedurally at runtime (canvas texture, own drawing). No `references/` image, no third-party chart. The visible label "Visueller Eindruck — die Lichtbrechung ist angenähert; die genaue Durchsicht folgt in der Durchblick-Ansicht" (final wording for the UI spec) sits on the view. This matters because `transmission` is a screen-space approximation and must not be read as the exact optics. Phase 4 delivers those.
- **D-11:** **Grounding:** a soft contact shadow under the glasses, baked or cheap, with no real-time shadow maps on phones. MSAA is on where it is affordable.
- **D-12:** **Quality tiers,** decided once at start-up from capability and device class and adjustable if frame time is exceeded:
  - High (desktop): full pixel ratio up to 2, transmission at full resolution, dispersion.
  - Phone: pixel ratio ≤ 1,5–2, `transmissionResolutionScale` ≈ 0,5, no dispersion.

  The researcher sets the thresholds. The active tier is shown in "Technische Angaben". Realism degrades by tier. Correctness never does.

### Placement and layout (UX-03, builds on phase-2 D-19/D-20)
- **D-13:** **Desktop/tablet:** the 3D view fills `#view-slot` at the top of the sticky results column (reserved in phase 2), in roughly 4:3 or 16:10.
- **D-14:** **Phone:** the 3D view is inline at the top of the results section. The `#bar-view-slot` in the sticky bottom bar shows a **small still thumbnail** copied from the one main renderer after each re-mesh. It is not a second WebGL context: one renderer, one GPU context, half the memory risk. This keeps "the lens view stays visible while editing" (UX-03). Tapping the bar jumps to the full view as it does today.
- **D-15:** **Scroll safety on touch:** the canvas must not trap one-finger page scrolling. Default on touch devices: the view is static, and the presets plus a clear "3D drehen" activation (button or first tap) enable orbit. After that, one finger rotates and two fingers pinch/pan. `touch-action: none` applies only while active. The researcher may replace this with an equivalent, better-sourced pattern. Desktop: drag rotates, wheel zooms only with focus/hover (no scroll hijack), right-drag or Shift pans.
- **D-16:** **Lazy-load Three.js** (dynamic `import()` after the first result paint), so ENG-09 for the numbers is unaffected. Re-meshing runs after the result paint, latest-wins, using the same scheduling idea as phase-2 D-16. The view shows a short "wird aufgebaut …" state.
- **D-17:** **No WebGL2:** a plain-German note in the view slot. Numbers, cross-section and comparison keep working. No crash, no blank box.

### Camera and controls (VIZ-03)
- **D-18:** **The default camera is a 3/4 front view** (slightly from above and from the side). It shows lens thickness and frame at once, so a lay user sees "dick oder dünn" immediately. The presets **Vorne / Seite / Oben** are real `<button>`s with an accessible name and keyboard support, and they animate smoothly (reduced to a cut under `prefers-reduced-motion`). An extra "Zurücksetzen" returns to the default view.
- **D-19:** **Seite** is a true orthographic-like side view (or a long-focal perspective) of one lens edge, so front-surface protrusion beyond the rim is visibly measurable. The protrusion value from D-05 is shown as text next to it, never only as a picture.
- **D-20:** `OrbitControls` with damping, zoom and polar limits so the glasses can't be lost, and `listenToKeyEvents` for keyboard orbit when the canvas has focus. **Render on demand:** frames render only on change, interaction or damping, never in a continuous loop. This saves battery and heat on phones.

### Heatmap (VIZ-05, UX-02 Expert)
- **D-21:** **The heatmap is painted on the 3D lens itself,** as vertex colours or a shader on the front-surface mesh, colouring local thickness `thicknessAt(x,y)`. In Expert view a view-mode switch reads "Glas | Dickenkarte". Switching to Dickenkarte moves the camera to Vorne, so the map reads like a flat chart.
- **D-22:** **Palette:** colour-blind-safe cividis or viridis LUT (stack decision), always with:
  - a **mm legend** in HTML with tick values;
  - **labelled iso-lines** at a "nice" step (0,5 / 1 / 2 mm) chosen so 4–8 lines appear;
  - **numeric callouts** at nasal, temporal, superior, inferior and centre, using lay plus Expert location words (phase-2 D-23).

  Callouts are HTML labels projected onto the view and are also listed as text, so screen readers and colour-blind users get every number without the colour.
- **D-23:** **Both eyes** show the heatmap with one **shared scale**, so left and right can be compared honestly. The same rule applies in A/B mode (D-25).

### A/B comparison in 3D (RES-03)
- **D-24:** **One renderer.** Wide screens show A ("Vorher") and B ("Nachher") as **two scissor viewports side by side with one synchronised camera**, so the same angle compares the same thing. Phones follow the existing "Vorher | Nachher" toggle (phase-2 D-29): the one scene swaps between A and B with the camera kept.
- **D-25:** In heatmap mode A and B share one thickness scale and legend. The difference line from phase 2 stays the numeric source of truth.

### Performance and memory (VIZ-06)
- **D-26:** Re-meshing reuses `BufferGeometry` and typed arrays at a fixed resolution per quality tier. It writes in place, sets `needsUpdate` and does not allocate per input. Geometry is computed in the existing worker if the main-thread cost would break the RAIL budget; the researcher measures this, and the arrays are transferred. Anything replaced (materials, textures, render targets on tier change or A/B) is explicitly disposed.
- **D-27:** **Leak check:** an automated Playwright test applies at least 50 input changes and asserts that `renderer.info.memory` geometries and textures stay constant. A heap snapshot comparison is done manually.
- **D-28:** **Real-phone measurement:** re-mesh-to-paint latency and frame time during orbit are measured on the Pixel 7 Pro used in phase 2 (02-15) via the live site, plus the 4× CPU-throttled proxy, and recorded in the phase verification. The thresholds come from RAIL (input→paint ≤ 200 ms, interaction frames ≤ 16,7 ms target), which matches ENG-09. They are checked in the chrome-devtools MCP at phone size as well as in Playwright (memory `test-with-chrome-devtools-mcp`).

### Accessibility
- **D-29:** The canvas has `role="img"` and a dynamic German `aria-label` summary, for example "3D-Ansicht: rechtes Glas, dickste Stelle 4,1 mm außen …". All information in the view also exists as text: callouts, protrusion, legend. axe runs on Simple, Expert, heatmap and compare modes at 320 px and desktop. Every new string goes into `de-AT.js`, and "Stärke" stays banned.

### Claude's Discretion
- Exact tessellation counts within the D-04(c) error bound.
- The tone-mapping operator, exposure, light rig and contact-shadow technique.
- The exact canvas aspect ratio, button placement and icon design (for `/gsd:ui-phase 3`).
- Whether the geometry builder lives in `src/engine/` or a sibling `src/geometry/` with the same lint boundary.
- Whether the thumbnail is copied with `drawImage` from the WebGL canvas right after render or via `preserveDrawingBuffer` (prefer the cheaper one).
- The iso-line rendering technique (shader `fwidth` lines vs. line geometry).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 3 — goal and the 5 success criteria
- `.planning/REQUIREMENTS.md` — VIZ-01..06, RES-03, UX-02, UX-03 (with their 2026-11-07 "Phase 2 + 3" notes)
- `.planning/PROJECT.md` — core value, constraints (phones, accuracy, a11y)
- `CLAUDE.md` (project) — stack decisions (Three.js r187 `three@0.187.0`, WebGLRenderer, MeshPhysicalMaterial, analytic normals, buffer reuse, Worker option, heatmap LUT, what NOT to use), lens-critic gate, engine-first rule

### Research
- `.planning/research/SUMMARY.md` — Resolved Conflicts (CPU warp grid for phase 4: no optics copy in GLSL)
- `.planning/research/STACK.md` — Three.js API usage, mobile levers (`transmissionResolutionScale`, pixel-ratio cap)
- `.planning/research/ARCHITECTURE.md` — engine/view split, `compute(params) → typed arrays`
- `.planning/research/PITFALLS.md` — mesh/normal/seam pitfalls, phone performance

### Prior phase decisions
- `.planning/phases/02-lay-first-german-input-results-comparison/02-CONTEXT.md` — D-13 (rim depth), D-16 (latest-wins scheduling), D-19/D-20 (view slots), D-23 (location words), D-28..D-30 (A/B model)
- `.planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md` — existing visual language and tokens the 3D view must match
- `.planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md` — m6 (thick-result note, "revisit with the phase-3 3D view")
- `.planning/phases/01-verified-engine-live-pipeline/01-VERIFICATION.md` and `.planning/phases/02-lay-first-german-input-results-comparison/02-15-SUMMARY.md` — ENG-09 measurement method (quiet proxy + Pixel 7 Pro) to reuse for D-28

### Engine sources the mesh must reuse (no copies)
- `src/engine/design.js` — `frontSagAt`, `backSagAt`, `frontSagGradAt`, `backSagGradAt`
- `src/engine/metrics.js` — `thicknessAt`, `computeMetrics` (etMax/etMin/CT)
- `src/engine/frame/outline.js` — `frameOutline`, per-eye outlines
- `src/engine/evaluate.js` — `evaluateLens` / `evaluatePair` (LensResult shape)
- `src/engine/rim.js` — `RIM_DEPTH_DEFAULT_MM`, `edgeBeyondRim`; the bevel model (D-05) extends it
- `src/engine/boundary.test.js` — lint/boundary rule the geometry builder must satisfy

### Agent gate
- `.claude/agents/lens-critic.md` — reviews the phase plan and the phase result

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design.js` sag + gradient functions: give exact surface points and analytic normals for the meshes.
- `metrics.thicknessAt` / `computeMetrics`: the heatmap values and callout numbers.
- `frame/outline.js` (memoised, 720 points): the lens boundary ring and the frame rim path.
- `rim.js`: rim depth default and protrusion; it extends with the bevel split.
- `src/state/compute-client.js` + `src/worker/`: worker pipeline with latest-wins; the geometry arrays can ride on it.
- `src/state/frame-scheduler.js`, `debounce.js`: re-mesh scheduling after the result paint.
- `src/state/compare.js` + `src/ui/compare-view.js`: A/B state and the Vorher/Nachher toggle that the 3D view follows.
- `src/ui/cross-section.js`: a pattern for engine-output → view with text equivalents.
- `src/i18n/de-AT.js` + `t()` + `format.js`: all new strings and mm formatting.

### Established Patterns
- Engine is pure JS with no DOM/Three.js, enforced by a lint rule and `boundary.test.js`.
- npm dependencies exact-pinned and Actions SHA-pinned (CI pin tests). `three@0.187.0` must be added exact-pinned, after the package-legitimacy check used in 01-01.
- Every visible state uses text or an icon as well as colour, and axe runs in CI.
- Design constants without a source are marked `[ASSUMED]` and shown as "angenommener Wert".

### Integration Points
- `index.html` `#view-slot` (results column, hidden): the 3D view mounts here.
- `index.html` `#bar-view-slot` (summary bar, hidden): the phone thumbnail.
- `src/ui/main.js` / `pipeline.js`: where results are painted. Hook the lazy 3D load and re-mesh after the paint.
- `src/ui/expert.js`: the Expert toggle reveals the "Glas | Dickenkarte" switch.
- `src/ui/frame-input.js`: rim depth and protrusion message, which must use the same bevel rule as the 3D view.

</code_context>

<specifics>
## Specific Ideas

- The user wants the result **photorealistic and as correct as possible**, which governs every visual choice. "Photorealistic" means a PBR studio look (IBL reflections, real IOR, polished/frosted edge, acetate frame, contact shadow). It does **not** mean exact refraction: the transmission refraction is approximate and labelled so, and phase 4 delivers exact refraction.
- Design input: `references/01-brille.png`, `references/00_brillengroesse.png` (local only, git-ignored, never published or copied).

</specifics>

<deferred>
## Deferred Ideas

- Frame colour/material picker (several acetate colours, metal frame), cosmetic only; v2 backlog.
- A face/head model wearing the glasses: realism gain, but large asset, uncanny-valley risk and licence questions; v2 at most.
- Lens tints, photochromic and mirror coatings as visual options; v2.
- Exact refraction "Durchblick": phase 4 (REF-01/02).
- m6 lay note for very thick results (phase-2 deferred item): reconsider now that thickness is visible in 3D. The planner checks whether it is still needed. If so, it needs a sourced threshold, otherwise it stays deferred.

</deferred>

---

*Phase: 03-3d-lenses-frame*
*Context gathered: 2026-11-08*
