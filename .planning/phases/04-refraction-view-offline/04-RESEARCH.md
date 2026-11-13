# Phase 4: Refraction View & Offline - Research

**Researched:** 2026-11-13
**Domain:** CPU reverse ray trace → warp grid (pure-JS engine), Three.js 2D draw pass, PWA (vite-plugin-pwa 2.0.0 / Workbox 7.4.1), Playwright service-worker testing
**Confidence:** HIGH for the optics, the engine gap and the plugin behaviour, all read from source or measured. MEDIUM for phone performance, which is extrapolated from desktop Node. MEDIUM for Playwright offline semantics.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### What the Durchblick shows (REF-01)
- **D-01:** **The Durchblick is the wearer's view:** a fixed eye point behind the lens looking at a distant chart. It is not an observer looking at the glasses from the front. Reason: the wearer's view is the only viewpoint with a physically defined result (spectacle magnification, power factor × shape factor). An observer view depends on two arbitrary distances and would let us exaggerate the effect. `.planning/research/ARCHITECTURE.md` line 305 left this open ("wearer's eye at vertex distance, or an observer at 40 cm"); this decision closes it.
- **D-02:** **The effect is shown honestly, including when it is small.** A −1,00 dpt lens changes image size by about 1 %; the view must not scale that up. So that a small effect is still readable:
  - the chart **outside the lens outline is drawn undistorted**, so the jump at the lens edge is the built-in reference (this is also what a wearer really sees at the rim);
  - a **"Mit Glas | Ohne Glas"** comparison control shows the same chart without the lens;
  - the **size change is stated as text per eye** (D-05).
- **D-03:** **Geometry only.** The Durchblick shows size and distortion. It does not show sharpness, blur or colour fringes, and it says so in one plain sentence on the view ("zeigt Größe und Verzerrung, nicht die Schärfe"; final wording for the UI spec).
- **D-04:** **One fixed eye point per eye, on the optical axis through the OC, at a documented distance behind the back vertex,** with a distant chart (distance vision, matching "the distance lens is shown", phase-2 D-09). The researcher picks and cites the distance and the reference point (entrance pupil vs centre of rotation). If no citable value exists it is labelled "angenommener Wert" like `RIM_DEPTH_DEFAULT_MM`. No HSA input field in v1 (see Deferred).
- **D-05:** **Text equivalent, from the engine:** per eye, the size change in percent, and with a cylinder the two principal directions with their own percentages (for example "Rechtes Glas: Bild etwa 5 % kleiner; in Richtung 90° etwa 7 %, in Richtung 180° etwa 5 %"). These are new engine outputs (pure JS, unit-tested), not values read back from the picture. They feed the visible text and the canvas `aria-label`, as in phase-3 D-29. "Stärke" stays banned (phase-2 D-25).
- **D-06:** **Both lenses are shown together, each traced for its own eye** (never mirrored, phase-1 rule). Reason: the user asked for exactly this in the Dickenkarte (dev-1.7, "the two eyes often differ"). The picture is drawn **as the wearer sees it: right lens on the right.** This is the opposite of the Glas and Dickenkarte views (examiner view, right lens on the left), so R and L are labelled on the view and the switch of side is stated in text. On stages too narrow for two lenses the UI spec decides the fallback (one eye with the existing "für" picker pattern); the text equivalent always lists both eyes.
- **D-07:** **Axis orientation is a named risk.** The engine frame is the examiner's view (`src/engine/conventions.js`: +x = wearer's left, TABO CCW seen from the examiner). The wearer's view mirrors x, so an axis of 30° appears at 150° on screen. This needs a golden test of its own (see D-12 (d)); a silently mirrored cylinder is the most likely wrong-but-plausible bug in this phase.
- **D-08:** **The chart is our own procedural drawing** (checkerboard plus letter band, the phase-3 D-10 idea), sized in visual angle. No `references/` image, no third-party chart.

#### Where it lives and how it behaves
- **D-09:** **Durchblick is a third mode of the existing view-mode switch** (`#view-mode` in `index.html`): "Glas | Durchblick" in Simple view, "Glas | Dickenkarte | Durchblick" in Expert view. Today the whole switch is Expert-only (`data-expert`); it becomes visible in Simple view because the Durchblick is a lay feature. It reuses the stage, the fullscreen button and the phone placement from phase 3. No new page section.
- **D-10:** **The camera is fixed in Durchblick.** The warp is valid for one eye point only, so orbit, zoom, "3D drehen" and the presets Vorne / Seite / Oben are disabled or hidden in this mode, with their state restored on leaving it. Nothing may suggest the picture can be rotated.
- **D-11:** **The phase-3 caption on the Glas view is updated.** `view.caption.glass` says the refraction is only approximate; it now points to the Durchblick mode as the exact one. The Durchblick gets its own badge (not "Visueller Eindruck").
- **D-11a:** **A/B comparison:** the Durchblick follows the existing A/B model (phase-2 D-28/D-29, phase-3 D-24): split on wide screens, "Vorher | Nachher" toggle on phones, same Rx in both. The planner may reduce this to "shows the currently shown configuration" if the split does not fit; that is a planning decision, not a user question.

#### Correctness and architecture (REF-01, engine first)
- **D-12:** **CPU warp grid in the engine, pure JS, Node-tested** (project `CLAUDE.md` rule; `.planning/research/SUMMARY.md` Resolved Conflicts). No GLSL copy of the optics. `src/engine/trace.js` is extended for rays from the eye point at field angles (today `traceRay` handles only rays parallel to −z from the front) without weakening the existing ENG-08 oracle. Three.js or canvas only draws the grid. Correctness is proven by tests, not by eye:
  - (a) plano lens → identity warp within a stated tolerance;
  - (b) sign: minus minifies, plus magnifies, for every material;
  - (c) the paraxial magnification of the grid equals the thick-lens spectacle magnification (power factor × shape factor from the engine's own D1, CT, n and the D-04 distance) within a stated, justified tolerance, with a cited formula source;
  - (d) cylinder: the two principal magnifications lie along the correct on-screen directions in the **wearer's** view for OD and OS, including an oblique axis (golden test, D-07);
  - (e) the D-05 percentages equal the grid's paraxial values;
  - (f) rays that miss the lens, fall outside the outline or hit total internal reflection give a defined result (undistorted outside the outline, never NaN, never a crash).
- **D-13:** **The warp is computed off the main thread, latest-wins, after the result paint** (same scheduling idea as phase-2 D-16 and phase-3 D-16/D-26). It must not delay the numbers: ENG-09 (c) input → result paint ≤ 100 ms stays intact. Whether it rides on the mesh worker or gets its own is the planner's call. It is computed only while the Durchblick mode is shown.
- **D-14:** **One WebGL context stays the rule** (phase-3 D-14/D-24). The Durchblick is drawn by the existing renderer or as a 2D canvas, never by a second WebGL context. The D-27 leak test is extended to mode switches into and out of Durchblick.

#### Phone performance and degradation (REF-02)
- **D-15:** **Budget:** input → Durchblick paint ≤ 200 ms (INP "good" threshold, web.dev/inp, the phase-3 D-28 value). The grid resolution has tiers on top of the existing quality tiers (`src/ui/view/tiers.js`).
- **D-16:** **Degradation is automatic and visible.** If the budget is missed twice in a row (same two-in-a-row idea as the phase-3 A5 thumbnail guard), the view steps down to a coarser grid and shows a plain-German note ("Vereinfachte Darstellung …"; wording for the UI spec). The note appears only when degraded. The active resolution is listed in "Technische Angaben". Correctness tests (D-12) must hold at every tier within that tier's stated tolerance.
- **D-17:** **Measured, not assumed:** the 4× CPU-throttled proxy and the chrome-devtools MCP at 412×915 and 320 px (phase-3 D-30 stays mandatory for every UI plan). A real Pixel trace is still owed from phase 3 (see Folded carry-overs); it needs the user and the live site.

#### Offline (OFF-01)
- **D-18:** **`vite-plugin-pwa@2.0.0`, `generateSW`, `registerType: 'prompt'`,** registered through `virtual:pwa-register`, never a hand-written `register('/sw.js')` (project `CLAUDE.md`). Exact-pinned, after the package-legitimacy check used in 01-01. Scope and `start_url` come from Vite's `base` and are asserted to be `/Eyeglass-Prescription/` in the built manifest and at runtime in an e2e test.
- **D-19:** **Precache the whole app:** HTML, CSS, every JS chunk including the lazy 3D chunk and both workers, so "loads and computes offline" includes 3D and Durchblick. Target < 2 MB (today's `dist/` is 908 KB before this phase). An e2e test goes offline after one visit, reloads, edits a value and checks a computed result and the 3D view.
- **D-20:** **Update prompt:** a non-modal banner, "Neue Version verfügbar" with buttons **"Aktualisieren"** and **"Später"**. It uses `role="status"`, never steals focus, never covers a focused input or the phone summary bar, and is keyboard reachable. No `autoUpdate`, no mid-session engine swap. "Später" hides it for the session; the new version then applies on the next full start.
- **D-21:** **"Aktualisieren" keeps what the user typed.** Inputs are not persisted (phase-2 deferred decision), so a plain reload would wipe a typed prescription. The update reload therefore hands the current inputs over once through `sessionStorage` (namespaced key `eyeglass-rx:v1:…`, read and deleted on the next start, same tab only, written only on the user's click). This is not persistence across sessions and does not reopen the phase-2 privacy decision. If the researcher or lens-critic finds this unsafe or disproportionate, the fallback is that the prompt states plainly that the inputs will be reset.
- **D-22:** **Registration must not cost the first result:** the service worker registers after the first result paint. ENG-09 measurements are re-run with the service worker active.
- **D-23:** **CSP stays as strict as it is.** The registration code is bundled (no inline script). `vite.config.js` notes that `worker.spec.js` checks the CSP string exactly; if the manifest or service worker needs a directive, the change is deliberate, minimal and tested, never a loosening to `unsafe-inline`.
- **D-24:** **Shared-origin safety** (`ainxtgendev.github.io` hosts other projects): the scope is asserted (D-18), cache and storage names are namespaced, and `selfDestroying: true` is documented as the kill switch with the exact steps to use it. The plan states the rollback path before the first service-worker deploy.
- **D-25:** **Manifest:** minimal and correct (name, `lang` de-AT, scope, start_url, theme colours, our own drawn icon). No install promotion in the UI. A quiet "offline verfügbar" line goes into "Technische Angaben" or the footer, not into a toast.
- **D-26:** **Version label:** the first deployed change of this phase bumps `version.js` to dev-1.8 (memory `bump-version-label`); the footer version is how the user and lens-critic confirm which build the update prompt delivered.

#### Folded carry-overs from phase 3
Listed in `session.md` ("Carry into phase 4") and `.planning/phases/03-3d-lenses-frame/deferred-items.md`. They are small and belong to code this phase touches anyway. The planner groups them into one housekeeping plan.
- **F-01:** CI flaky reporting (m1): write flaky tests to `$GITHUB_STEP_SUMMARY`; `retries: 0` on never-happens tests (`e2e/worker.spec.js:331`).
- **F-02:** Fullscreen: the Dickenkarte legend and the table-only note are outside the stage (m2). Fix it together with the Durchblick note and text, which have the same problem in fullscreen.
- **F-03:** `e2e/a11y.spec.js:215` hits the 30 s timeout under 4 workers: raise its timeout or split it.
- **F-04:** `window.__eyeglassView` ships in production (AR-03-04, `.planning/phases/03-3d-lenses-frame/03-SECURITY.md`): gate it behind `import.meta.env.DEV` or a test flag, and keep the e2e specs working.
- **F-05:** A real Pixel performance trace (VIZ-06 was accepted without a device trace, `03-VERIFICATION.md`; ROADMAP criterion 2 of this phase needs the same measurement). Needs the user's phone and the live site.
- **F-06:** m4 (assertion for the fullscreen button's low position) and m5 (pure `nextGuard(state, ms)` with a slow-fast-slow unit test). The Durchblick degradation guard (D-16) should reuse that pure guard.

### Claude's Discretion
- Grid resolution per tier, interpolation, and whether the warp is drawn as a displaced mesh, a texture lookup or 2D canvas.
- Angular field of view of the chart and the chart layout.
- Whether the warp runs in the mesh worker or its own.
- Exact German wording, the banner's position and look, the icon: for `/gsd-ui-phase 4`.
- Tolerances in D-12, as long as each is stated and justified.
- The D-11a reduction, and the narrow-stage fallback in D-06.

### Deferred Ideas (OUT OF SCOPE)
- Observer view ("wie andere meine Augen hinter dem Glas sehen", eyes look smaller or larger): needs a face or eye model; v2 together with the phase-3 deferred head model.
- Blur or sharpness simulation, colour fringes from the Abbe number in the Durchblick: v2.
- An HSA (vertex distance) input that drives the Durchblick: v2; v1 uses one documented value.
- Looking through off-centre points of the lens (rotating eye, prismatic effect at the edge): v2.
- Install promotion ("Zum Startbildschirm hinzufügen") and an offline indicator beyond one quiet line: backlog.
- Persisting inputs across sessions (opt-in): v2 with SHARE-01, unchanged from phase 2.
- 03-CI item: at 320 px with the root font at 150 % and −12 dpt on both eyes the page is 345 px wide (WCAG 1.4.10). Not caused by this phase; backlog unless a phase-4 plan touches that layout.

### Binding amendments from the approved 04-UI-SPEC.md (revision 2, lens-critic PASS)
The UI-SPEC's "Changes to Locked Decisions" table amends D-02, D-04, D-05, D-06, D-08, D-09, D-11a, D-12 (b), D-12 (f), D-20, D-21, D-22, D-25 and T-02-39. The planner treats those rows as locked. The ones that matter most for planning:
- a central field with a 30° half-angle (provisional until P0), not the whole aperture;
- the reference ticks;
- h = 15 mm at the entrance pupil;
- the two-surface aperture rule (classes 1–5);
- the sign test restricted to lenses whose two meridians are both ≤ −1 or both ≥ +1 dpt;
- `role="region"` plus a separate `#app-update-live`;
- the `src/ui/handover.js` allow-list.

The "Carried to the Planner" items N3–N12 are open MINOR items that the planner must turn into tasks or acceptance checks.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REF-01 | "Durchblick" view shows the chart through the lens, traced through the engine's actual front and back surfaces; minus minifies, plus magnifies, cylinder effects shown | §Pattern 1: the reverse trace reuses `intersect`/`refract` and the `design.js` sag/gradient functions. Measured: it equals the SM formula to < 0,0001 pp. §Pattern 2: SM is closed form and derived here from ABCD matrices. §Pattern 3: warp grid plus quadtree class refinement. §Pattern 4: draw via `scene.setPass()` with an ortho scene. §Pitfall 1: axis mirror. The measured cylinder direction is engine 30°, which is 150° on screen. |
| REF-02 | Acceptable on a mid-range phone or degrades (lower resolution) with a note | §Performance: about 1 µs per ray in Node on the desktop. A 412 px two-panel layout needs about 425–925 rays per panel. The interpolation error is about 0,84·c²/P px (c = cell in px, P = px per tan). Tiers are defined by cell size in CSS px. The `nextGuard` reuse is in §Pattern 6. |
| OFF-01 | Works offline after first visit; "Aktualisieren" prompt, no mid-session switch; SW scoped to `/Eyeglass-Prescription/` | §Pattern 7: plugin config verified against the 2.0.0 tarball. §Pattern 8: update flow read from `register.js` and workbox-window 7.4.1. §Pitfalls 5–10. §Validation: a switchable static server, because Playwright cannot route an updated SW script. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **German (de-AT) UI only**; all strings go in `src/i18n/de-AT.js` via `t()`. Numbers are formatted by `format.js` and never embedded in strings. "Stärke" is banned (`dictionary.test.js`).
- **Accurate refraction = CPU ray-traced warp grid reusing the engine's tested surfaces, NOT a GLSL copy of the optics.** A shader that only samples a texture is allowed. One that intersects surfaces is not.
- **Engine first:** `src/engine/` is pure JS (no Three.js, no DOM, no `performance`, no storage) and is the single source of truth for every number. ESLint and `boundary.test.js` enforce this. Engine coverage thresholds are 95 % lines and 90 % branches (`vite.config.js`).
- **Every formula and constant traceable to a cited source**; unsourced design constants are marked `[ASSUMED]` and shown as "angenommener Wert".
- **`lens-critic` gate** on the phase plan and the result.
- **Pinned versions**: npm exact pins (`test/ci/pins.test.js`), Actions SHA-pinned. `test/ci/workflow-structure.test.js` forbids bypass constructs.
- **Pages deploy is pre-authorized; other outward-facing actions need approval.** The first SW deploy is outward-facing and hard to roll back (D-24), so the plan states the rollback path first.
- **Service worker**: register only through `virtual:pwa-register`, with scope `/Eyeglass-Prescription/`, `registerType: 'prompt'` and `selfDestroying` documented as the kill switch. Storage keys are namespaced `eyeglass-rx:v1:…`.
- **CSP must not be loosened** (no `unsafe-inline`; no `style` attributes; `worker.spec.js` checks the string exactly).
- **No root-absolute URLs in JS**: use imports, `import.meta.url` or `BASE_URL`.
- `references/` is never published or used as chart input.
- `gsd-sdk` is not installed: use `node ~/.claude/get-shit-done/bin/gsd-tools.cjs`.
- User memory: chrome-devtools MCP check at phone size for every UI change. Run targeted e2e locally, with the full suite in CI. One version-label bump per release (dev-1.8). Parallel waves only with disjoint files.

## Summary

The engine already has everything the Durchblick needs except one function. `src/engine/trace.js` has a Newton surface intersection and a vector-Snell refraction, both private. Both are direction-agnostic: the Newton seed is the vertex plane `t = (−zOff − p_z)/d_z`, and `refract` orients the normal against the ray. They work unchanged for a **reverse trace**: from the eye point at `(oc.x, oc.y, −CT − h)` along `(ex, ey, 1)`, first the back surface (`zOff = ct`, η = 1/n), then the front surface (`zOff = 0`, η = n). I proved this with a scratch copy of the two private functions plus the production `design.js` sag/gradient functions and `evaluateLens` surfaces. At h = 15 mm the Jacobian of the reverse map reproduces the spectacle-magnification formula to better than 0,0001 percentage points:

- −4,00 CR-39: −5,6037 % (trace and formula);
- +4,00: +7,7669 %;
- −2,00/−2,00×30: −2,8543 % / −5,6037 %;
- 0,00/−1,00×90: +0,0600 % / −1,4187 %.

These are exactly the UI-SPEC numbers. The less-minified eigen-direction of −2/−2×30 lies at **engine 30° for both OD and OS**, which maps to **150° on the wearer's screen** (x mirrored). That is the D-07 golden value.

The SM formula is a paraxial **identity** for this system, not just a textbook claim. Derived with ray-transfer matrices: M = 1/(A − h·Fe) = 1/[(1 − (t/n)·F1)·(1 − h·Fv)]. So test (c) compares two exact quantities, and a tolerance of 0,05 pp is generous. For the D-04 reference point, the entrance pupil of the Le Grand & El Hage schematic eye computes to **3,04 mm** behind the corneal vertex. I computed this from the surface table in Greivenkamp's OPTI-502 notes, which is better than the study-guide citations in the UI-SPEC. The 12 mm HSA remains "angenommener Wert".

Performance is not the hard part. A reverse ray costs about 1 µs in Node on this desktop (i7-8809G). The 412 px two-panel layout needs about 425–925 grid rays per panel, so the trace is a few ms on the desktop and an estimated 10–40 ms on a phone. The hard parts are:

1. the **aperture classification**, which needs a point-in-polygon test and a signed distance against the 720-point outline, plus quadtree refinement of mixed cells (UI-SPEC classes 1–5, N10);
2. the **draw**, done through the existing renderer's `setPass()` hook with an ortho scene, one context;
3. the **offline/update choreography**.

For offline, the actual `vite-plugin-pwa@2.0.0` and `workbox-window@7.4.1` code shows the following:

- `updateSW()` only posts `SKIP_WAITING`.
- The reload happens in a `controlling` listener that calls `onNeedReload` when provided, otherwise `window.location.reload()`.
- An "external" waiting worker also triggers `onNeedRefresh`, so N8 is right: page D *does* see the banner.
- In prompt mode the plugin sets neither `skipWaiting` nor `clientsClaim`.
- The plugin's `selfDestroying` SW deletes **every cache on the origin**. That origin hosts 5 Pages projects (verified with `gh api`).

**Primary recommendation:** Add `traceFromEye` (non-throwing, reusing the private `intersect`/`refract`) and `warpGrid` and `spectacleMagnification` modules to the engine. Run the warp in a dedicated warp worker with its own latest-wins client. Draw it with the existing WebGLRenderer through `setPass()` as UV-mapped grid meshes over a chart texture. Configure the PWA with `injectRegister: false`, `clientsClaim: true`, `skipWaiting: false` and `onNeedReload: reloadWithHandover`. Test updates with a small switchable static server in a dedicated Playwright project, with service workers blocked in every other project.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spectacle magnification per meridian (D-05 numbers) | Engine (pure JS, inside `evaluateLens` path, engine worker) | UI (format and wording only) | The numbers must arrive with the result paint (UI-SPEC) and never come from the picture |
| Reverse ray trace + warp grid + aperture classes | Engine (`src/engine/warp.js`, extends `trace.js`) | Warp worker (glue, timing) | Single source of truth; Node-testable; no DOM |
| Job scheduling (latest-wins, watchdog, sync fallback) | State layer (`src/state/warp-client.js`, `warp-protocol.js`) | Worker glue | Same pattern as `mesh-client.js` / `mesh-protocol.js` |
| Drawing the warped chart, ticks, pills | Browser / lazy view chunk (`src/ui/view/refraction.js`) | — | Only `src/ui/view/**` may import Three.js (eslint) |
| Degradation guard `nextGuard` | State layer (pure) | View (clock t0/t1) | Pure function, unit-tested (F-06) |
| Service worker + precache | CDN/Static (build-time Workbox `generateSW`) | Browser (`virtual:pwa-register`) | Static Pages hosting, no backend |
| Update banner + handover | Browser (`src/ui/update.js`, `src/ui/handover.js`) | — | DOM + sessionStorage; `handover.js` is the only storage user (T-02-39 allow-list) |
| Manifest/icons | CDN/Static (`public/`, plugin-generated manifest) | — | — |

## Standard Stack

### Core (already installed, verified `package.json` + `node_modules` 2026-11-13)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | 0.187.0 | Draw the warp (ortho scene through existing renderer) | Already the one renderer; `OrthographicCamera`, `BufferGeometry.setDrawRange`, `CanvasTexture` present in installed source [VERIFIED: node_modules/three/src] |
| vite | 8.3.6 | Build, `base`, worker bundling, `import.meta.env.MODE` replacement | Installed [VERIFIED: node_modules] |
| vitest | 5.1.0 | Engine tests, `bench` | Installed |
| @playwright/test | 1.65.0 | e2e incl. service workers (Chromium only) | Installed; SW support documented [CITED: playwright.dev/docs/service-workers] |
| fast-check | 4.10.2 | Property tests (sign, identity, classes) | Installed |

### New for this phase
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-pwa | 2.0.0 (latest, published 2026-10-03) | `generateSW`, manifest, `virtual:pwa-register` | D-18. Put it in **devDependencies** (build-time); the client code it emits is bundled [VERIFIED: npm registry + tarball read] |
| workbox-build | 7.4.1 | SW generation (dependency **and** peer of the plugin) | Pin explicitly in devDependencies so `pins.test.js` and the lockfile show an exact version [VERIFIED: `npm view vite-plugin-pwa@2.0.0 peerDependencies dependencies`] |
| workbox-window | 7.4.1 | Client registration (dynamically imported by `virtual:pwa-register`) | Pin explicitly in devDependencies (bundled into the app at build) |

`@vite-pwa/assets-generator` is an **optional** peer (`peerDependenciesMeta.optional: true`, verified). Do not install it; draw the icons by hand (UI-SPEC).

**Installation (in the plan task, from the repo root, exact pins):**
```bash
npm install --save-dev --save-exact vite-plugin-pwa@2.0.0 workbox-build@7.4.1 workbox-window@7.4.1
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Three.js ortho pass via `setPass` | 2D canvas per-pixel warp (in a worker, ImageData transfer) | Allowed by D-14. It costs about 0,5 M px × interpolation per draw on the CPU. You lose GPU mip filtering and anti-aliasing, and get a second draw path to test. Use it only if WebGL is unavailable, and then the UI-SPEC says Durchblick is not offered. **Not recommended.** |
| Dedicated `warp.worker.js` | New message type in `mesh.worker.js` | It saves one worker. But `createMeshClient` hard-codes `type: 'mesh'` and one lane, and touching it risks phase-3 tests. Mesh and warp rarely compete (re-mesh is deferred while Durchblick is on-screen), so either works. **Recommend dedicated**: surgical, no change to tested code. |
| `clientsClaim: true` | default `false` in prompt mode | Without it, a first-visit page stays uncontrolled. "Offline verfügbar" would then be shown while lazy chunks of *this* page still come from the network (N12). See Pitfall 7. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| vite-plugin-pwa | npm | created 2020-08-20; 2.0.0 on 2026-10-03 | not measured | github.com/vite-pwa/vite-plugin-pwa | [OK] | Approved |
| workbox-build | npm | 7.4.1 current | not measured | (GoogleChrome/workbox) [ASSUMED repo URL, not queried] | [OK] | Approved |
| workbox-window | npm | 7.4.1 current | not measured | (GoogleChrome/workbox) [ASSUMED repo URL, not queried] | [OK] | Approved |

- `npm view <pkg>@<ver> scripts.postinstall` returned empty for all three. No install scripts.
- `workbox-build@7.4.1` pulls about 480 transitive build-time packages (Babel, Rollup, terser, `glob@11` with a deprecation warning). A test install reported "9 vulnerabilities (2 low, 7 moderate)". These are **build-time only**, and none ship to the browser except `workbox-window` and the Workbox runtime modules inlined into `sw.js`. The plan should run `npm audit --omit=dev` (expect 0) and record the dev-audit result. [VERIFIED: npm output 2026-11-13]
- **Packages removed:** none. **Flagged [SUS]:** none.

**⚠ Incident to carry into the plan:** `slopcheck install <pkgs>` really runs `npm install` in the current directory. Running it from the repo root during this research changed `package.json` and `package-lock.json` and replaced `node_modules`. I reverted it immediately (`git checkout -- package.json package-lock.json && npm ci`). `git status` is clean, and `trace.test.js` passes 16/16 afterwards. The plan's legitimacy task must run slopcheck from an empty scratch directory, or use it as the install step itself with `--save-exact` afterwards.

## Architecture Patterns

### System Architecture Diagram

```
input event (t0 = event.timeStamp)
   │
   ▼
engine worker: evaluateLens ──► LensResult (+ NEW spectacleMag per meridian, closed form)
   │                                   │
   ▼                                   ▼
result paint (ENG-09 ≤100 ms) ──► size block text + canvas aria-label (engine numbers)
   │
   │ Durchblick mode AND stage on-screen (IntersectionObserver)?
   ├── no ──► (normal 3D re-mesh / thumbnail path, unchanged)
   ▼ yes
warp-client.requestWarp(items)  [latest-wins, generation, watchdog, sync fallback]
   │  postMessage {surfaces, outline params, eye, h, layout(pxPerTan, panel W×H), tier cellPx}
   ▼
warp worker → engine/warp.js
   ├─ regular grid over panel in wearer tan (cell = tier cellPx / pxPerTan)
   ├─ per point: back hit (trace from eye) → inside back outline? → refract → front hit
   │     → inside outline? → refract → object tan     ⇒ class 1..5 + objTan + signed dists
   ├─ mixed-class cells → quadtree refine to leaf ≤ 1–2 px (extra rays)
   └─ out: Float32Array uv (objTan, wearer frame), Uint8Array class, leaf list; computeMs
   │  transfer buffers back
   ▼
view (lazy chunk): refraction.js
   ├─ write uv into panel grid BufferGeometry (positions fixed per layout), needsUpdate
   ├─ rim / no-view triangles from leaves (flat MeshBasicMaterial)
   ├─ scene.setPass(refPass): renderer.render(refScene, orthoCam) per panel scissor
   └─ rAF after draw: t1 → sample = t1 − t0 → nextGuard(state, sample) → maybe tier down + note
```

### Recommended Project Structure (new files only)
```
src/engine/
├── trace.js            # + export traceFromEye(s, h, ex, ey) (non-throwing status), traceRay unchanged
├── magnification.js    # spectacleMagnification(surfaces, rx, h) → per-meridian SM, closed form
├── warp.js             # warpGrid(...) + classify + quadtree refine; pure, typed arrays
├── outline-geom.js     # pointInOutline / signedDistance with OC-radius fast paths (or inside warp.js)
└── *.test.js           # D-12 (a)–(f), P0 CI subset, E2–E4, E9, E10
src/state/
├── warp-protocol.js    # createWarpHandler (pure), validation, never throws
├── warp-client.js      # latest-wins + watchdog + sync fallback (mesh-client pattern)
└── guard.js            # nextGuard(state, ms) (F-06), reused by thumbnail + Durchblick
src/worker/warp.worker.js
src/ui/view/refraction.js   # ortho scene, chart texture, panels, ticks, pills
src/ui/update.js            # registerSW wiring, banner, offline line
src/ui/handover.js          # the ONLY sessionStorage user
public/                     # favicon.svg, icon-192.png, icon-512.png, icon-512-maskable.png
scripts/p0-feasibility.mjs  # one-off P0 sweep (output table committed)
e2e/support/switch-server.mjs  # serves build A or B under /Eyeglass-Prescription/
e2e/pwa.spec.js             # offline, update, four tabs, probe, Später
```

### Pattern 1: Reverse trace from the eye point (extends trace.js, no copy)
**What:** Reuse the private `intersect` and `refract` from `trace.js`. Add non-throwing variants that return `null` (or a status code) instead of throwing, and keep `traceRay` and `traceBVP` byte-for-byte on the throwing path, so the ENG-08 property test (300 runs, seed 42) and "throws when the ray misses" stay green.
**Coordinates (verified against `conventions.js`, `design.js`):** The eye point is `E = (oc.x, oc.y, −ct − h)`, with lens-local coordinates and the back vertex at `z = −ct` on the OC. The direction toward the object is `(ex, ey, 1)/|…|` in **engine** x/y. Back surface: `intersect(E, d0, s.ct, backSagAt, backSagGradAt, s)`, `refract(d0, n, 1/s.n)`. Front: `intersect(q, d1, 0, frontSagAt, frontSagGradAt, s)`, `refract(d1, n, s.n)`. Object tan = `(d2x/d2z, d2y/d2z)`.
**Wearer frame (D-07):** convert at the engine boundary once: `wx = −x`, `wy = y`. Export the warp in wearer coordinates and name the fields accordingly (`wTanX`), so the view never mirrors anything.
```javascript
// Source: scratch verification 2026-11-13 (scratchpad rt/bench.mjs) using production design.js
// and evaluateLens surfaces; intersect/refract are trace.js lines 22–58 unchanged except null-returns.
export function traceFromEye(s, h, ex, ey) {          // ex, ey: eye tan, ENGINE frame
  const p = [s.oc.x, s.oc.y, -s.ct - h];
  const L = Math.hypot(ex, ey, 1);
  const d0 = [ex / L, ey / L, 1 / L];
  const b = intersectOrNull(p, d0, s.ct, backSagAt, backSagGradAt, s);
  if (!b) return { status: MISS_BACK };
  const d1 = refractOrNull(d0, b.normal, 1 / s.n);
  if (!d1) return { status: TIR_BACK, back: b.q };
  const f = intersectOrNull(b.q, d1, 0, frontSagAt, frontSagGradAt, s);
  if (!f) return { status: MISS_FRONT, back: b.q };
  const d2 = refractOrNull(d1, f.normal, s.n);
  if (!d2) return { status: TIR_FRONT, back: b.q, front: f.q };
  return { status: OK, back: b.q, front: f.q, objTan: [d2[0] / d2[2], d2[1] / d2[2]] };
}
```
Note that `sag` returns NaN outside its domain. `intersect` then sees `!isFinite(dt)` and breaks, so the null variant returns null and nothing throws. The hot path allocates small arrays per ray. At about 1 µs per ray this is fine. Do not micro-optimise before P0.

### Pattern 2: Spectacle magnification, closed form (engine, with the result)
**Derivation (put it in the module header):** reduced thickness `τ = t/n`. The lens matrix from the front to the back surface is L = R(F2)·T(τ)·R(F1) = [[A, τ],[−Fe, D]] with A = 1 − τF1, Fe = F1 + F2 − τF1F2 and det = 1. Add the transfer h to the entrance pupil, S = T(h)·L, and require the ray to cross the axis at E. That gives u_E/u_0 = 1/(A − h·Fe). Since Fv = Fe/A, M = 1/[(1 − τF1)(1 − h·Fv)]. The system is separable in the toric principal meridians because the front is spherical, so per meridian F = Sph along the axis and Sph + Cyl perpendicular to it (`design.js` line 9). [VERIFIED: derivation in this session; numerical agreement with trace < 1e-4 pp]
**Inputs:** use the engine's own `surfaces.n`, `surfaces.ct` (mm → m) and `D1 = 1000·(n − 1)·c1`. With a conic front `k1`, c1 is still the vertex curvature, so the paraxial value holds. Include the conic case in the trace-vs-formula test.
**Constants:** `HSA_ASSUMED_MM = 12` [ASSUMED] and `ENTRANCE_PUPIL_MM = 3.0` [CITED]. The cited value is the Le Grand & El Hage eye entrance pupil, 3,04 mm, computed from the surface table in Greivenkamp OPTI-502, rounded to 3,0. The rounding changes −4,00 by about 0,015 pp, far below the HSA uncertainty. So h = 15 mm keeps every UI-SPEC string. Alternatively use 3,04 and re-run the string tests. **Recommend 3,0 with the 3,04 derivation in the comment.**

### Pattern 3: Warp grid with aperture classes and quadtree refinement
- **Grid** is uniform in wearer eye-tan = uniform in panel CSS px (rectilinear projection), with cell size `cellPx / pxPerTan`. Define tiers by **cell size in CSS px**, not by point count. The measured interpolation error (bilinear at cell centres vs. direct trace) scales as `err_px ≈ k·c²/P`, with k ≈ 0,84 per tan for the worst measured case (−10/−4×30 CR-39, at the corner of the 39° field) and P = px per tan. N10 requires ≤ 0,5 px at the smallest P (216 px/tan, 400 px desktop column), so **c ≤ 11 px**. Suggested tiers: **fein 6 px, mittel 8 px, grob 11 px**. P0 measures k over G1/G2 and fixes them. [VERIFIED: scratch interp.mjs; k estimated, confirm in P0]

  | Case | N=17 | N=25 | N=33 | N=49 | N=65 (over 2·0,577 tan) |
  |------|------|------|------|------|------|
  | −12 CR-39 (tan err) | 3,2e-3 | 1,5e-3 | 8,8e-4 | 4,1e-4 | 2,3e-4 |
  | −10/−4×30 CR-39 | 3,9e-3 | 1,9e-3 | 1,1e-3 | 5,1e-4 | 2,9e-4 |
  | +12 CR-39 | 5,5e-4 | 2,4e-4 | 1,4e-4 | 6,1e-5 | 3,4e-5 |
  | +8/−6×135 1,74 | 5,2e-4 | 2,3e-4 | 1,3e-4 | 5,9e-5 | 3,3e-5 |
- **Classification per point**, in the UI-SPEC order 1→5, done in the engine:
  - point-in-polygon on `frameOutline(shape, A, B, eye)` (720 points, lens-local) for the back hit and the front exit;
  - a signed distance for class 4/5 (≤ `FRAME_FACE_MM` = 4) and for N10 reporting.
  - **Fast paths:** precompute r_min and r_max of the outline about the OC. `ρ < r_min` means inside with no polygon test. `ρ > r_max + 4` means class 5. Only the annulus pays the 720-segment test. This keeps the default frame (no rim in the field) at trace cost only.
  - Class 4/5 back hit: if the extended back surface is missed, use the plane `z = −CT` (UI-SPEC).
- **Mixed cells** (corners of different classes): subdivide recursively, tracing new rays, until a leaf is ≤ 1 px. Each leaf gets the class of its centre ray. The class-boundary error is then ≤ the leaf diagonal (≤ 1,5 px < N10's 2 px). Never interpolate uv across a class boundary.
- **Output** (typed arrays, transferable): per grid point `uv` (object tan in the wearer frame; identity for class 5; unused for classes 2–4) and `cls`. Plus a leaf list `[x0, y0, size, cls, u, v]` for refined cells, a `rimInField` flag per eye (N3) and `computeMs` (measured in the worker glue, not in the engine).

### Pattern 4: Draw through the existing renderer (one context)
- `scene.js` already exposes `setPass(fn)` (03-14), which replaces `renderer.render(scene, camera)`. In Durchblick the view sets a pass that renders a dedicated `refScene` with an `OrthographicCamera` in CSS-px units, per panel via scissor/viewport as `compare3d.js` does. On leaving, it restores the previous pass.
- Each panel is a fixed-topology grid `BufferGeometry`: positions per layout, `uv` per job (write in place, `attr.needsUpdate = true`). Use a `MeshBasicMaterial({ map: chartTex, toneMapped: false })`. Class 2–4 cells and leaves go into per-panel flat-colour meshes with a capacity buffer and `setDrawRange`. Allocate on layout change only, and dispose on leave. The leak test (D-27) counts `renderer.info.memory`.
- **Chart texture:** a `CanvasTexture` drawn in object-tan space covering |tan| ≤ R, where R is the max class-1 |object tan| from P0 (expected about 1,6–1,8; the hard cap is 3). Pick the size from `renderer.capabilities.maxTextureSize`: 4096 if available, else 2048. WebGL2 guarantees only 2048 [ASSUMED: WebGL2 minimum from memory]. Use mipmaps and `colorSpace = SRGBColorSpace` as in `backdrop.js`. The checker phase is a square corner at object tan (0,0). The letter band is drawn into the same canvas so it warps with the checker.
- **Pixel tests** reuse the existing `__eyeglassView.pixels()`, which does render + `readPixels` in the same task (`view.js` 1528–1548). That only works with the test hook build (F-04, Pitfall 9).

### Pattern 5: Warp worker lane (mesh-client pattern)
Copy the contract of `src/state/mesh-client.js`, don't generalise it:
- `requestWarp(items)` bumps the generation and replaces any queued job;
- at most one job is in flight;
- a 10 s watchdog with a hidden-tab re-arm;
- transferred buffers come back or are reported lost;
- sync fallback via dynamic import, one item per macrotask.

`createWarpHandler` validates surfaces with the same `SURFACE_KEYS` check as `mesh-protocol.js` and never throws. The worker glue measures `computeMs` with `performance.now()`, which keeps the engine pure.

### Pattern 6: Degradation guard (F-06, pure)
```javascript
// src/state/guard.js — pure; the caller decides "counted" (UI-SPEC "The clock", exclusions)
export const initGuard = (tier) => ({ tier, run: 0, stillSlow: false, stepped: false });
export function nextGuard(g, ms, { budgetMs = 200, need = 2, last = 'grob', down } = {}) {
  if (ms <= budgetMs) return { ...g, run: 0 };
  const run = g.run + 1;
  if (run < need) return { ...g, run };
  if (g.tier === last) return { ...g, run: 0, stillSlow: true };
  return { tier: down(g.tier), run: 0, stillSlow: false, stepped: true };
}
```
Excluded samples are simply not passed in. That gives the UI-SPEC "slow-(excluded)-slow → step" without extra state. The thumbnail guard (`THUMB_SLOW_MS = 50`, run 2) reuses it with `budgetMs: 50`.

### Pattern 7: vite-plugin-pwa 2.0.0 configuration (verified against the tarball)
```javascript
// vite.config.js — options verified in vite-plugin-pwa-2.0.0/dist/index.d.ts and index.js (resolve options)
import { VitePWA } from 'vite-plugin-pwa';
VitePWA({
  strategies: 'generateSW',          // default
  registerType: 'prompt',            // default 'prompt'; never 'autoUpdate'
  injectRegister: false,             // we import virtual:pwa-register; 'inline' would violate the CSP
  // scope/start_url: omit → plugin uses Vite base ('/Eyeglass-Prescription/'); assert in build test
  manifest: {
    name: 'Brillenglas-Rechner – Dicke und Gewicht', short_name: 'Brillenglas', lang: 'de-AT',
    display: 'standalone', theme_color: '#ffffff', background_color: '#ffffff',
    icons: [ { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
             { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
             { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' } ],
  },                                  // plugin defaults (theme '#42b883', lang 'en') are overridden
  includeAssets: ['favicon.svg'],     // manifest icons are auto-included (includeManifestIcons: true)
  workbox: {
    globPatterns: ['**/*.{js,css,html}'],   // workbox default is '**/*.{js,wasm,css,html}' — workers are assets/*.js
    cacheId: 'eyeglass-rx',           // namespaced cache names (D-24)
    clientsClaim: true,               // N12: first visit becomes controlled (see Pitfall 7)
    skipWaiting: false,               // prompt: SW waits for SKIP_WAITING message
    // cleanupOutdatedCaches: true and navigateFallback: 'index.html' are plugin defaults
  },
  selfDestroying: false,              // kill switch — see Pitfall 6 before ever setting true
})
```
- The plugin adds `manifest.webmanifest` to the precache itself with an MD5 revision. **Do not** add `webmanifest` to `globPatterns`: that creates a duplicate precache URL [ASSUMED: Workbox conflicting-entries error; verify with the build test].
- The plugin injects `<link rel="manifest" href="${buildBase}${manifestFilename}">` into `index.html` (`chunk-I2Z7IWCN.js` line 150). The CSP needs nothing new: `manifest-src` and `worker-src` fall back to `default-src`/`script-src 'self'`, and the favicon is covered by `img-src 'self'`. Keep the exact CSP string and extend `worker.spec.js` to assert it with the SW active.
- Today all chunks are < 2 MiB (the largest is `view-*.js` at 642 KB), so the `maximumFileSizeToCacheInBytes` default (2 MiB) is not hit. The plugin **throws** on that warning by default (`throwMaximumFileSizeToCacheInBytes`). Good: it fails loudly.

### Pattern 8: Update flow, as the pinned code actually behaves
From `vite-plugin-pwa-2.0.0/dist/client/build/register.js`, read in full:
- `registerSW({ onNeedRefresh, onOfflineReady, onNeedReload, onRegisteredSW, onRegisterError, immediate })` returns `updateSW(reload?)`. `updateSW` awaits registration, then calls `wb.messageSkipWaiting()`, which posts `SKIP_WAITING` to `registration.waiting` if one exists. **It never reloads by itself.** The `reloadPage` argument is unused, as the `.d.ts` says.
- Prompt mode: on `waiting`, or on `installed` with `isExternal`, `showSkipWaitingPrompt()` adds a `controlling` listener and calls `onNeedRefresh`. That listener calls **`onNeedReload()` if provided, else `window.location.reload()`**, when `event.isUpdate`. So pass `onNeedReload: reloadWithHandover`. This is the documented hook and replaces the plugin reload.
- `onOfflineReady` fires on the first `installed` with no update. It does **not** fire on later visits. Hence the UI-SPEC "ready = onOfflineReady OR (registration.active && controller)".
- In workbox-window 7.4.1 (`workbox-window.prod.es5.mjs`, read):
  - an `updatefound` more than 60 s after `register()`, or a second one, is marked **external**;
  - `controlling` carries `isUpdate = Boolean(controller at register time)`;
  - a worker already waiting at register time dispatches `waiting` (`wasWaitingBeforeRegister`), so after "Später" plus a reload the banner returns, as the UI-SPEC wants.
- **Consequence (N8):** page D, opened before build B, gets `updatefound` on its own registration object and treats it as external. It calls `onNeedRefresh` (banner shown) and installs the `controlling` → `onNeedReload` listener. So D reloads through the plugin path as well. The separate `controllerchange` listener (hadController) is a backstop, so `reloadWithHandover` must be idempotent, as the UI-SPEC already requires. That `updatefound` reaches every client's registration object is per the SW spec install algorithm [ASSUMED from memory of the W3C SW spec; the four-tab e2e settles it]. Do **not** assert "no banner in D".
- The update is detected only on navigation, on `registration.update()`, or by the browser's periodic check. A long-open tab sees a new version only after one of these. Calling `registration.update()` on `visibilitychange → visible` is optional; the UI-SPEC does not require it.

### Anti-Patterns to Avoid
- **Copying intersect/refract into warp.js.** That creates two sources of truth. Export a non-throwing variant from `trace.js` instead.
- **Mirroring in the view.** The engine emits wearer-frame tan, and the view only maps tan to px.
- **Interpolating uv across class boundaries.** It paints chart pixels where no ray passes (UI-SPEC class 2 rationale).
- **Reading percentages off the grid.** D-05 numbers come from `magnification.js` with the result. The grid paraxial value is only a test oracle.
- **`navigator.serviceWorker.register('/sw.js')`** or `injectRegister: 'inline'`. The first gives the wrong scope; the second needs an inline script and breaks the CSP.
- **`autoUpdate`.** It swaps the engine mid-session (D-20).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Surface intersection / Snell | New ray code in warp.js | `trace.js` `intersect`/`refract` (exported null-returning variant) | ENG-08-tested; same Newton/normal conventions |
| Service worker, precache manifest, revisioning, cleanup | Hand-written `sw.js` | vite-plugin-pwa `generateSW` (Workbox 7.4.1) | Cache versioning on a shared origin is the classic failure (CLAUDE.md) |
| SW registration / waiting detection | Own `updatefound`/statechange logic | `virtual:pwa-register` (`registerSW`) | workbox-window already handles external/updated/waiting-before-register |
| Update test HTTP interception | `page.route` for a new `sw.js` | Real switchable static server | Playwright: "Requests for an updated Service Worker main script cannot currently be routed" (#14711) |
| Texture filtering / AA of the warped chart | Per-pixel CPU resampler | GPU texture mapping (mipmaps) on the grid mesh | Correct minification filtering for free |
| Job scheduling | New ad-hoc promise chain | `mesh-client.js` contract (latest-wins, watchdog, sync fallback) | Tested edge cases (hidden tab, lost buffers) |

**Key insight:** every hard thing in this phase already has a tested implementation in the repo or in the pinned plugin. The new code is classification, layout and wiring.

## Common Pitfalls

### Pitfall 1: Silently mirrored cylinder (D-07)
**What goes wrong:** the picture shows an oblique axis at θ instead of 180° − θ (or vice versa), and the result looks plausible.
**Why it happens:** the engine frame is the examiner's view (+x = wearer's left). The wearer looks the other way.
**How to avoid:** convert to the wearer frame once, inside `warp.js` (`wx = −x`). Golden test: for −2/−2×30 the Jacobian's less-minified eigenvector is at engine 30° (measured, both OD and OS) and therefore at **screen 150°**. Assert the screen angle φ = 180° − θ for θ ∈ {30°, 120°, 5°, 85°, 175°}, for OD and OS. Also assert that the chart letters read left-to-right in "Ohne Glas" (identity), so the chart texture is not mirrored either.
**Warning signs:** "Ohne Glas" letters are mirrored, or the OD and OS eigen-directions differ (they must be identical for the same Rx).

### Pitfall 2: Breaking the ENG-08 oracle while refactoring trace.js
**How to avoid:** keep `traceRay`/`traceBVP` on the throwing functions, or have them call the null variant and throw on null. Re-run `trace.test.js` (16 tests, property seed 42) unchanged. Add the new function's tests to the same file or to `warp.test.js`.

### Pitfall 3: Newton seed / NaN domain at large field angles
**What goes wrong:** steep minus backs or high-index lenses at 30–39°, where the vertex-plane seed lands outside the sag domain. `sag` returns NaN, which reads as a "miss".
**How to avoid:** this is exactly the P0 sweep (UI-SPEC). Classify the miss as class 3 (no NaN, no throw). If P0 finds misses inside the outline, step the field down 30° → 25° → 20°, as the UI-SPEC specifies. The scratch 97×97 grid at ±0,6 tan for −4/−2×30 found 0 failures.

### Pitfall 4: Grid error claimed in "points per lens" instead of px
The error depends on px per tan (it varies 216 → ~1000 between layouts). A fixed N that is fine on a phone is too coarse in fullscreen on a tablet. Define tiers by cell size in CSS px, and assert the error in px at the layout's actual P (N10).

### Pitfall 5: Service workers leaking into every existing e2e test
**What goes wrong:** with the SW registered after the first paint, every Playwright context precaches about 0,9 MB. That changes network counts, timing (the `worker.spec.js:331` race), the memory baseline and the perf numbers.
**How to avoid:** set `serviceWorkers: 'block'` in the existing `desktop`/`mobile` projects [CITED: playwright.dev/docs/service-workers]. Add a dedicated `pwa` project with `'allow'` and its own webServer (switch server, different port). Let `perf` allow SWs (D-22: re-measure ENG-09 with the SW active).

### Pitfall 6: `selfDestroying` wipes sibling projects' caches
**What goes wrong:** the plugin's self-destroying SW does `caches.keys()` then deletes **every** cache on the origin and navigates every window client in scope. `ainxtgendev.github.io` hosts Eyeglass-Prescription, interior-design, simplify_llm, testing and workflow [VERIFIED: `gh api users/AINxtGenDev/repos` has_pages]. Deletion is per origin, not per path.
**How to avoid:** document the kill switch with this blast radius. Preferred kill procedure:
1. set `selfDestroying: true`;
2. bump the version;
3. deploy;
4. verify in a browser that `navigator.serviceWorker.getRegistrations()` is empty after one reload.

State in the plan that sibling caches could be cleared. A narrower alternative is a custom kill SW that deletes only caches whose name contains `eyeglass-rx`, which requires `injectManifest` or a static `public/sw.js` override, so it is not plugin-native. This is a decision for the planner/lens-critic. I recommend documenting the plugin switch (CLAUDE.md asks for it) plus the risk note. A sibling SW cannot control our path unless it sits at the origin root; there is no user-site repo (`AINxtGenDev.github.io`) among them.

### Pitfall 7: First visit uncontrolled → "Offline verfügbar" is half true (N12)
**What goes wrong:** prompt mode does not set `clientsClaim` (plugin code: only for autoUpdate). On a first visit the SW installs and `onOfflineReady` fires, but the page stays uncontrolled. If the user goes offline and then opens 3D/Durchblick for the first time in that same page, the lazy `view-*.js` and `mesh.worker` fetches bypass the SW and fail.
**How to avoid:** `workbox.clientsClaim: true`. On the first install there is no previous controller, so the claim only adds control. The UI listener ignores that `controllerchange` (hadController false), and the plugin `controlling` handler only reloads on `isUpdate`. On updates, activation happens only after the user's SKIP_WAITING, so claim adds nothing unwanted. Add the N12 e2e variant: first visit → wait for ready → offline → open Durchblick → it renders.

### Pitfall 8: Old tabs run old code against a new SW
After activation, `cleanupOutdatedCaches` and the precache cleanup remove the old hashed chunks, and GitHub Pages no longer serves them. A tab that is not reloaded and lazily imports an old chunk gets a 404. This is why every controlled tab must reload on `controllerchange` (UI-SPEC wiring), with an idempotent `reloadWithHandover`.

### Pitfall 9: F-04 gating breaks the live smoke run
**What goes wrong:**
- 144 references to `window.__eyeglassView` in `e2e/`.
- `verify-live` runs the **full** `npm run test:e2e` against the live site (`deploy.yml`).
- `pixels()` (readPixels) is the only canvas-pixel path.

If the hook is removed from production, the live run fails.
**How to avoid:**
- Build twice in CI: `vite build --mode e2e --outDir dist-e2e`, with the hook gated by `import.meta.env.MODE === 'e2e'` (Vite replaces it statically, and Rolldown drops the dead branch), and a production build into `dist`.
- Run the e2e suite against `vite preview --outDir dist-e2e`.
- Run a hook-free smoke subset (tag `@live`) plus the dist grep test (E8) against `dist`.
- `verify-live` runs only `@live`.
- Update `test/ci/workflow-structure.test.js` accordingly.

The tested artifact then differs from the deployed one only by the gated branch. State that openly for lens-critic.

### Pitfall 10: Offline test that passes because the network is still there
**What goes wrong:** the Playwright docs say nothing about whether `context.setOffline(true)` blocks SW-initiated fetches (MEDIUM). A cache miss could be served from the live preview server, and the test would pass falsely.
**How to avoid:**
1. `setOffline(true)`;
2. also `context.route('**/*', r => r.abort())`, which intercepts worker-owned requests [CITED: playwright.dev/docs/service-workers];
3. assert `response.fromServiceWorker()` is true for the navigation and the view chunk.

With all three, a cache miss fails the test.

### Pitfall 11: Handover security
**What goes wrong:** a crafted or stale `sessionStorage` value would be applied as the user's input.
**How to avoid:**
- `JSON.parse` inside a `try`;
- a size cap (for example 8 KB);
- run it through the normal `parse.js`/`validate.js` path, never trusted raw;
- delete it before applying;
- one key only.

It is same-tab and same-origin, but sibling projects can read our sessionStorage keys only in the same tab, which needs a navigation to a sibling. The risk is low. Recorded in the Security domain.

## Code Examples

### Engine test oracle for D-12 (c)/(e): paraxial Jacobian vs. formula
```javascript
// Source: scratchpad rt/bench.mjs (2026-11-13), measured against production evaluateLens surfaces.
// J = ∂(objTan)/∂(eyeTan) by central differences (e = 1e-4); M = J⁻¹; eigenvalues = SM per meridian.
// Measured at h = 15 mm, frame 52×38/18, PD 32, CR-39, automatic base curve:
//   −4,00:        trace −5,6037 %  formula −5,6037 %
//   +4,00:        trace +7,7669 %  formula +7,7669 %
//   −2/−2×30 OD/OS: trace −2,8543 / −5,6037 %, less-minified eigvec at engine 30,00°
//   0/−1×90:      trace +0,0600 / −1,4187 %, eigvec 90°
// → tolerance 0,05 pp (UI-SPEC E2) has > 500× margin; keep it, it covers the coarse tiers' fit noise.
```

### Registration (bundled, after first result paint)
```javascript
// Source: vite-plugin-pwa 2.0.0 register.js + vanillajs.d.ts (read 2026-11-13)
import { registerSW } from 'virtual:pwa-register';
const hadController = navigator.serviceWorker?.controller != null;      // at module evaluation
navigator.serviceWorker?.addEventListener('controllerchange', () => { if (hadController) reloadWithHandover('other'); });
export function startSW() {
  const updateSW = registerSW({
    onNeedRefresh: showBanner,
    onOfflineReady: () => setOffline('ready'),
    onNeedReload: () => reloadWithHandover(),            // replaces the plugin's window.location.reload()
    onRegisteredSW: (_url, r) => { if (r?.active && navigator.serviceWorker.controller) setOffline('ready'); },
    onRegisterError: () => setOffline('failed'),
  });
  return updateSW;                                       // updateSW() only posts SKIP_WAITING
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `updateSW(true)` reloads the page | `reloadPage` unused; the reload comes from the `controlling` event → `onNeedReload` | plugin 0.13.2+ (`.d.ts` comment) | The handover hook is `onNeedReload` |
| `injectRegister: null` | `false` (`null` deprecated) | per 2.0.0 `.d.ts` | Use `false` |
| Throw-free `maximumFileSizeToCacheInBytes` warning | Build throws by default | plugin 0.20.2+ (`.d.ts`) | Oversized chunks fail the build |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HSA 12 mm as the default vertex distance | Pattern 2 | Percentages shift about 11–13 % relative (UI-SPEC sensitivity). Already labelled "angenommener Wert". |
| A2 | Phone ray cost ≈ 4–8× the desktop Node cost (about 5–10 µs/ray) | Performance | Tier start or budget wrong. The 4× proxy cannot reach the worker (ROADMAP), so the real Pixel trace (F-05) decides. |
| A3 | `updatefound` reaches every client's registration object (spec install algorithm) | Pattern 8 | The four-tab behaviour differs. The e2e test item 20 settles it. |
| A4 | Adding `webmanifest` to `globPatterns` would create a conflicting duplicate precache entry | Pattern 7 | A build error or a double entry. The build test catches it. |
| A5 | WebGL2 guarantees `MAX_TEXTURE_SIZE` ≥ 2048 only | Pattern 4 | Texture too large on a weak GPU. Read `capabilities.maxTextureSize` at runtime. |
| A6 | Dedicated module workers' fetches go through the page's SW (Chromium) | Offline | The worker could fail offline. Offline e2e item 17 edits a value, so the engine worker must compute. |
| A7 | k ≈ 0,84 per tan is the worst-case interpolation constant | Pattern 3 | The tier cell sizes are too large. P0 measures it over G1/G2. |
| A8 | `setOffline` may not block SW network fetches | Pitfall 10 | False-pass offline test; mitigated by route-abort + `fromServiceWorker()` |
| A9 | Workbox repo URL for workbox-build/window | Audit | None functionally |

## Open Questions

1. **Kill-switch scope (Pitfall 6).** Plugin `selfDestroying` (all origin caches) or a custom scoped kill SW? Recommendation: document the plugin switch plus the risk, and let lens-critic decide. Do not build the custom one unless asked.
2. **3,0 vs 3,04 mm pupil offset.** I recommend 3,0 (keeps the UI-SPEC strings; 0,04 mm is negligible). If 3,04 is chosen, re-run the string tests before the docs commit (UI-SPEC "vorläufig" note).
3. **Primary textbook citation** (Bennett & Rabbetts) is not accessible. Neither source here is the textbook: the SM formula is proven by the derivation in this session (and corroborated by the study guides), and the 3,04 mm comes from the Le Grand eye data. Good enough for "cited", but the UI-SPEC's request for a textbook page stays open for a human.
4. **F-05 real Pixel trace** needs the user's phone on the live site. It is a human checkpoint at the end of the phase.
5. **Test-build split (Pitfall 9)** changes the CI structure tests. lens-critic should accept that "tested artifact = deployed artifact + gated hook".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | `.nvmrc` 22 (local v22.x per CLAUDE.md) | — |
| npm registry | plugin install | ✓ | — | — |
| Chromium (Playwright) | SW e2e | ✓ (CI installs; local used by phase 3) | 1.65 bundle | — (SW tests are Chromium-only) |
| `gh` CLI | Pages/origin checks | ✓ | — | — |
| slopcheck | legitimacy gate | ✓ `~/.local/bin/slopcheck` | — | Run from scratch dir (it installs!) |
| `pdftotext` | (research only) | ✓ | — | — |
| ctx7 / Context7 | docs | ✗ | — | Read tarballs + official docs (done) |
| Real Pixel phone | F-05 | needs the user | — | 4× throttled proxy + chrome-devtools MCP (main thread only) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (Node, project `unit`), Playwright 1.65.0 (+ axe-core 4.14.0) |
| Config file | `vite.config.js` (`test.projects`), `playwright.config.js` |
| Quick run command | `npx vitest run --project unit src/engine/warp.test.js src/engine/magnification.test.js src/engine/trace.test.js` |
| Full suite command | `npm run test:coverage && npm run build && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REF-01 | Plano → identity warp within the tier tolerance (D-12 a) | unit/property | `npx vitest run src/engine/warp.test.js -t identity` | ❌ Wave 0 |
| REF-01 | Sign: both meridians ≤ −1 minify, ≥ +1 magnify, all materials (D-12 b, E3) | property | `… -t sign` | ❌ |
| REF-01 | Grid paraxial = SM formula ≤ 0,05 pp, both meridians (D-12 c/e, E2) | unit + P0 CI subset | `… src/engine/magnification.test.js` | ❌ |
| REF-01 | Wearer-view axis golden: φ = 180° − θ, OD and OS, 30/120/5/85/175 (D-12 d, E4) | unit | `… -t golden` | ❌ |
| REF-01 | Classes 1–5, no NaN, TIR/miss defined, item-12 case in tan units (D-12 f, E9, N9) | unit | `… -t aperture` | ❌ |
| REF-01 | Interpolation ≤ 0,5 px at the panel edge and class boundary ≤ 2 px per tier (N10) | unit | `… -t tolerance` | ❌ |
| REF-01 | ENG-08 oracle unchanged | unit | `npx vitest run src/engine/trace.test.js` | ✅ |
| REF-01 | Picture/pixels: Ohne Glas square edges, rim pixels, mode switch, stale badge (UI-SPEC e2e 1–16, 25, 26) | e2e | `npx playwright test e2e/view-ref.spec.js` | ❌ |
| REF-02 | `nextGuard` slow-fast-slow etc. (E5) | unit | `npx vitest run src/state/guard.test.js` | ❌ |
| REF-02 | Per-tier worker bench (E6) | bench | `npx vitest bench src/engine/warp.bench.js` | ❌ |
| REF-02 | 4× throttled input → Durchblick paint, median/p95 | perf (informational) | `npm run test:perf` | ✅ (extend) |
| OFF-01 | Manifest scope/start_url = `/Eyeglass-Prescription/`, precache contains view chunk + both/three workers, size < 2 MB, no hook strings in `dist/` (E8) | build test (Node, reads `dist/`) | `npx vitest run test/ci/pwa-build.test.js` | ❌ |
| OFF-01 | Offline reload computes + 3D + Durchblick; `fromServiceWorker`; scope at runtime (item 17, N12 variant) | e2e (`pwa` project) | `npx playwright test --project=pwa e2e/pwa.spec.js -g offline` | ❌ |
| OFF-01 | Update prompt, handover, four tabs, Später, failure, probe (items 19–24) | e2e (`pwa`) | `… -g update` | ❌ |
| OFF-01 | controllerchange-only reload path with stubbed plugin (N8) | unit (jsdom-free: inject `navigator`-like stubs) | `npx vitest run src/ui/update.test.js` | ❌ |
| OFF-01 | T-02-39 allow-list: only `handover.js`, one key (E7) | unit | `npx vitest run src/engine/boundary.test.js` | ✅ (amend) |
| OFF-01 | CSP string unchanged with SW active | e2e | `npx playwright test e2e/worker.spec.js -g CSP` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the quick engine command above, plus the one affected spec file (memory `targeted-e2e-before-push`).
- **Per wave merge:** `npm run test:coverage` + `npm run build` + the affected Playwright projects.
- **Phase gate:** full suite green in CI (with the e2e build split), chrome-devtools MCP screenshots (UI-SPEC list), lens-critic PASS.

### Wave 0 Gaps
- [ ] `scripts/p0-feasibility.mjs` + committed output table (UI-SPEC P0), which fixes the field half-angle, k and the tier cell sizes
- [ ] `src/engine/warp.test.js`, `src/engine/magnification.test.js` (fixtures: default frame, item-12 frame)
- [ ] `src/state/guard.test.js`
- [ ] `e2e/support/switch-server.mjs` + `pwa` Playwright project (separate port, `serviceWorkers: 'allow'`), and `serviceWorkers: 'block'` on `desktop`/`mobile`
- [ ] Build B for update tests: an env override of `APP_VERSION` in `vite.config.js` (e.g. `APP_VERSION_OVERRIDE`), so build B differs in `index.html` and hence in the precache revisions
- [ ] `test/ci/pwa-build.test.js` (reads `dist/manifest.webmanifest`, `dist/sw.js`)
- [ ] CI: e2e build mode + `@live` tag split (Pitfall 9); update `workflow-structure.test.js`

## Security Domain

### Applicable ASVS Categories (L1)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | partly | SW scope `/Eyeglass-Prescription/` asserted at build and at runtime |
| V5 Input Validation | yes | Handover JSON → `parse.js`/`validate.js`; size cap; warp-protocol validates surfaces (never throws) |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | Rx (health-adjacent) in sessionStorage only at the update click, one key, read-and-delete; nothing else stored (T-02-39 allow-list test) |
| V14 Configuration | yes | CSP unchanged (no inline register, `injectRegister: false`); test hooks absent from `dist/` (F-04, E8); exact pins; `npm audit --omit=dev` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale/poisoned SW cache serving an old engine | Tampering | prompt mode, version label, `cleanupOutdatedCaches`, kill-switch procedure documented before the first deploy |
| SW intercepting sibling projects | Elevation | Scope = base path; Pages cannot send `Service-Worker-Allowed` to widen it [ASSUMED] |
| Kill switch deleting sibling caches | Denial of service (others) | Pitfall 6; document the blast radius |
| Handover injection | Tampering | Validate through the normal parse path; never trusted raw |
| Debug handle in production (`__eyeglassView`) | Information disclosure | Build-mode gate + dist grep test |
| Supply chain (workbox-build about 480 dev deps) | Tampering | Exact pins, lockfile, slopcheck [OK], no postinstall scripts |

## Sources

### Primary (HIGH confidence)
- Repo code read on 2026-11-13: `src/engine/trace.js`, `design.js`, `conventions.js`, `evaluate.js` (contract), `src/state/mesh-client.js`, `mesh-protocol.js`, `src/ui/view/tiers.js`, `backdrop.js`, `scene.js` (`setPass`), `view.js` (test handle, `pixels()`), `vite.config.js`, `playwright.config.js`, `.github/workflows/deploy.yml`, `src/engine/boundary.test.js`, `test/ci/pins.test.js`, `package.json`, `dist/assets` sizes.
- Measurements (scratch, not production): `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/rt/bench.mjs` (trace vs. formula, throughput) and `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/rt/interp.mjs` (interpolation error).
- `vite-plugin-pwa@2.0.0` tarball (npm pack): `dist/client/build/register.js`, `dist/index.d.ts`, `dist/index.js` (option resolution, selfDestroying SW, manifest entries), `vanillajs.d.ts`.
- `workbox-build@7.4.1` `templates/sw-template.js` (SKIP_WAITING listener when `skipWaiting` is false); `schema/GenerateSWOptions.json` (globPatterns default); `workbox-window@7.4.1` `build/workbox-window.prod.es5.mjs` (external/isUpdate/controlling logic).
- npm registry: `npm view vite-plugin-pwa@2.0.0 peerDependencies dependencies engines time peerDependenciesMeta`, `npm view workbox-build version` (7.4.1), `workbox-window` (7.4.1).
- `gh api users/AINxtGenDev/repos` (Pages projects on the shared origin); `gh api repos/AINxtGenDev/Eyeglass-Prescription/pages`.
- https://playwright.dev/docs/service-workers: Chromium only, `serviceWorkers: 'block'`, context.route sees worker requests, `fromServiceWorker()`, updated SW script not routable (#14711).

### Secondary (MEDIUM confidence)
- Greivenkamp, OPTI-502 "The Eye" (Univ. of Arizona, 2019), the Le Grand & El Hage schematic eye table, from which the entrance pupil (3,04 mm) was computed: https://wp.optics.arizona.edu/jgreivenkamp/wp-content/uploads/sites/11/2019/08/502-22-The-Eye.pdf
- Shape × power factor formula (study sources; the formula is independently derived above): https://open-exam-prep.com/study-guides/abo-advanced/optics-ii/thickness-magnification-effective-power, https://www.opticiansfriend.com/equations/
- Entrance pupil ~3 mm convention: https://www.opticianonline.net/cpd-archive/4728 (403 on fetch; search snippet only), US 8,805,612 B2 https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8805612

### Tertiary (LOW confidence)
- Searches about `setOffline` and SW fetches returned no authoritative answer (https://github.com/microsoft/playwright/issues/23781, https://qaskills.sh/blog/playwright-offline-mode-cache-testing), hence the belt-and-braces test in Pitfall 10.
- https://2020mag.com/article/design-of-iseikonic-lenses-part-two (formula only in images; not used).

## Metadata

**Confidence breakdown:**
- Optics/engine gap: HIGH. Read the code, derived the formula, and measured agreement.
- PWA behaviour: HIGH for the pinned plugin and workbox-window code paths; MEDIUM for browser-spec claims (A3, A6).
- Performance: MEDIUM. Desktop measured; the phone factor is assumed until F-05.
- Playwright SW testing: MEDIUM (offline semantics; mitigated).

**Research date:** 2026-11-13
**Valid until:** 2026-12-13 (stable pins; re-check if `vite-plugin-pwa` publishes 2.0.x)
