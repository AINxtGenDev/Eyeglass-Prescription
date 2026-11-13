# Phase 4: Refraction View & Offline - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

**How decided:** The user ran `/gsd-discuss-phase 4`. No gray area was put to them as a choice: their standing instruction (memory `best-practice-default`, 2026-11-08: "i always trust your recommendation do not ask anymore") says to take the best-practice recommendation and report it. In phases 2 and 3 they were offered gray areas and picked none both times. Every decision below is therefore Claude's choice, reported to the user for veto. The governing priorities are unchanged from phase 3, in this order:

1. **Correct:** what the view shows is traced through the engine's own surfaces, and every number is the engine's.
2. **Easy for a lay user.**
3. **No visible lag on a mid-range phone;** the numbers (ENG-09) are never delayed by this phase.

Each decision may be revised in `/gsd-ui-phase 4` or in plan review without asking again, as long as the change keeps or improves correctness or lay usability. D-01 is the one most worth a user veto (see `<specifics>`).

<domain>
## Phase Boundary

Phase 4 adds two things to the finished phase-3 product:

- **Durchblick** (REF-01, REF-02): a view that shows a chart as seen through the user's lenses, computed by tracing rays through the engine's actual front and back surfaces. Minus lenses minify, plus lenses magnify, a cylinder distorts along the correct axis. On a mid-range phone it runs acceptably or drops to a lower resolution with a visible note.
- **Offline** (OFF-01): after one visit the site loads and computes offline. A new deployed version is offered with an "Aktualisieren" prompt instead of switching mid-session. The service worker is scoped to `/Eyeglass-Prescription/`.

It also folds in the phase-3 carry-over items (see "Folded carry-overs").

Requirements: REF-01, REF-02, OFF-01. Gate: `lens-critic` on the plan and on the result (ROADMAP success criterion 4).

Not in this phase: blur or sharpness simulation, chromatic aberration in the Durchblick, ADD and prism (out of v1), a face or head model, persisting inputs across sessions, an install promotion ("Zum Startbildschirm"), sharing and print (v2).

</domain>

<decisions>
## Implementation Decisions

### What the Durchblick shows (REF-01)
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

### Where it lives and how it behaves
- **D-09:** **Durchblick is a third mode of the existing view-mode switch** (`#view-mode` in `index.html`): "Glas | Durchblick" in Simple view, "Glas | Dickenkarte | Durchblick" in Expert view. Today the whole switch is Expert-only (`data-expert`); it becomes visible in Simple view because the Durchblick is a lay feature. It reuses the stage, the fullscreen button and the phone placement from phase 3. No new page section.
- **D-10:** **The camera is fixed in Durchblick.** The warp is valid for one eye point only, so orbit, zoom, "3D drehen" and the presets Vorne / Seite / Oben are disabled or hidden in this mode, with their state restored on leaving it. Nothing may suggest the picture can be rotated.
- **D-11:** **The phase-3 caption on the Glas view is updated.** `view.caption.glass` says the refraction is only approximate; it now points to the Durchblick mode as the exact one. The Durchblick gets its own badge (not "Visueller Eindruck").
- **D-11a:** **A/B comparison:** the Durchblick follows the existing A/B model (phase-2 D-28/D-29, phase-3 D-24): split on wide screens, "Vorher | Nachher" toggle on phones, same Rx in both. The planner may reduce this to "shows the currently shown configuration" if the split does not fit; that is a planning decision, not a user question.

### Correctness and architecture (REF-01, engine first)
- **D-12:** **CPU warp grid in the engine, pure JS, Node-tested** (project `CLAUDE.md` rule; `.planning/research/SUMMARY.md` Resolved Conflicts). No GLSL copy of the optics. `src/engine/trace.js` is extended for rays from the eye point at field angles (today `traceRay` handles only rays parallel to −z from the front) without weakening the existing ENG-08 oracle. Three.js or canvas only draws the grid. Correctness is proven by tests, not by eye:
  - (a) plano lens → identity warp within a stated tolerance;
  - (b) sign: minus minifies, plus magnifies, for every material;
  - (c) the paraxial magnification of the grid equals the thick-lens spectacle magnification (power factor × shape factor from the engine's own D1, CT, n and the D-04 distance) within a stated, justified tolerance, with a cited formula source;
  - (d) cylinder: the two principal magnifications lie along the correct on-screen directions in the **wearer's** view for OD and OS, including an oblique axis (golden test, D-07);
  - (e) the D-05 percentages equal the grid's paraxial values;
  - (f) rays that miss the lens, fall outside the outline or hit total internal reflection give a defined result (undistorted outside the outline, never NaN, never a crash).
- **D-13:** **The warp is computed off the main thread, latest-wins, after the result paint** (same scheduling idea as phase-2 D-16 and phase-3 D-16/D-26). It must not delay the numbers: ENG-09 (c) input → result paint ≤ 100 ms stays intact. Whether it rides on the mesh worker or gets its own is the planner's call. It is computed only while the Durchblick mode is shown.
- **D-14:** **One WebGL context stays the rule** (phase-3 D-14/D-24). The Durchblick is drawn by the existing renderer or as a 2D canvas, never by a second WebGL context. The D-27 leak test is extended to mode switches into and out of Durchblick.

### Phone performance and degradation (REF-02)
- **D-15:** **Budget:** input → Durchblick paint ≤ 200 ms (INP "good" threshold, web.dev/inp, the phase-3 D-28 value). The grid resolution has tiers on top of the existing quality tiers (`src/ui/view/tiers.js`).
- **D-16:** **Degradation is automatic and visible.** If the budget is missed twice in a row (same two-in-a-row idea as the phase-3 A5 thumbnail guard), the view steps down to a coarser grid and shows a plain-German note ("Vereinfachte Darstellung …"; wording for the UI spec). The note appears only when degraded. The active resolution is listed in "Technische Angaben". Correctness tests (D-12) must hold at every tier within that tier's stated tolerance.
- **D-17:** **Measured, not assumed:** the 4× CPU-throttled proxy and the chrome-devtools MCP at 412×915 and 320 px (phase-3 D-30 stays mandatory for every UI plan). A real Pixel trace is still owed from phase 3 (see Folded carry-overs); it needs the user and the live site.

### Offline (OFF-01)
- **D-18:** **`vite-plugin-pwa@2.0.0`, `generateSW`, `registerType: 'prompt'`,** registered through `virtual:pwa-register`, never a hand-written `register('/sw.js')` (project `CLAUDE.md`). Exact-pinned, after the package-legitimacy check used in 01-01. Scope and `start_url` come from Vite's `base` and are asserted to be `/Eyeglass-Prescription/` in the built manifest and at runtime in an e2e test.
- **D-19:** **Precache the whole app:** HTML, CSS, every JS chunk including the lazy 3D chunk and both workers, so "loads and computes offline" includes 3D and Durchblick. Target < 2 MB (today's `dist/` is 908 KB before this phase). An e2e test goes offline after one visit, reloads, edits a value and checks a computed result and the 3D view.
- **D-20:** **Update prompt:** a non-modal banner, "Neue Version verfügbar" with buttons **"Aktualisieren"** and **"Später"**. It uses `role="status"`, never steals focus, never covers a focused input or the phone summary bar, and is keyboard reachable. No `autoUpdate`, no mid-session engine swap. "Später" hides it for the session; the new version then applies on the next full start.
- **D-21:** **"Aktualisieren" keeps what the user typed.** Inputs are not persisted (phase-2 deferred decision), so a plain reload would wipe a typed prescription. The update reload therefore hands the current inputs over once through `sessionStorage` (namespaced key `eyeglass-rx:v1:…`, read and deleted on the next start, same tab only, written only on the user's click). This is not persistence across sessions and does not reopen the phase-2 privacy decision. If the researcher or lens-critic finds this unsafe or disproportionate, the fallback is that the prompt states plainly that the inputs will be reset.
- **D-22:** **Registration must not cost the first result:** the service worker registers after the first result paint. ENG-09 measurements are re-run with the service worker active.
- **D-23:** **CSP stays as strict as it is.** The registration code is bundled (no inline script). `vite.config.js` notes that `worker.spec.js` checks the CSP string exactly; if the manifest or service worker needs a directive, the change is deliberate, minimal and tested, never a loosening to `unsafe-inline`.
- **D-24:** **Shared-origin safety** (`ainxtgendev.github.io` hosts other projects): the scope is asserted (D-18), cache and storage names are namespaced, and `selfDestroying: true` is documented as the kill switch with the exact steps to use it. The plan states the rollback path before the first service-worker deploy.
- **D-25:** **Manifest:** minimal and correct (name, `lang` de-AT, scope, start_url, theme colours, our own drawn icon). No install promotion in the UI. A quiet "offline verfügbar" line goes into "Technische Angaben" or the footer, not into a toast.
- **D-26:** **Version label:** the first deployed change of this phase bumps `version.js` to dev-1.8 (memory `bump-version-label`); the footer version is how the user and lens-critic confirm which build the update prompt delivered.

### Folded carry-overs from phase 3
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § "Phase 4: Refraction View & Offline" — goal and the 4 success criteria
- `.planning/REQUIREMENTS.md` — REF-01, REF-02, OFF-01 (exact wording, locked)
- `.planning/PROJECT.md` — core value, constraints (phones, accuracy, a11y, offline)
- `CLAUDE.md` (repo root) — project rules (CPU warp grid, engine first, lens-critic gate, de-AT only) and § "Caching and offline (service worker) under the sub-path", § "Sub-path pitfalls"

### Research
- `.planning/research/SUMMARY.md` § "Resolved Conflicts" — CPU warp grid instead of a GLSL shader
- `.planning/research/ARCHITECTURE.md` — lines 15, 173–174, 305, 342, 423–429, 463: `warpGrid`, `traceRay` contract, viewpoint options, throttling
- `.planning/research/STACK.md` — `vite-plugin-pwa`, Workbox, version compatibility
- `.planning/research/PITFALLS.md` — service-worker and shared-origin pitfalls, toric model notes

### Prior phase decisions that bind this phase
- `.planning/phases/03-3d-lenses-frame/03-CONTEXT.md` — D-10 (chart, "Visueller Eindruck" label), D-12 (quality tiers), D-14 A5 (two-in-a-row guard), D-16 (lazy load, scheduling), D-21 (view-mode switch), D-24 (one renderer, A/B), D-27/D-28 (leak test, phone budgets), D-29 (aria), D-30 (chrome-devtools MCP checks)
- `.planning/phases/03-3d-lenses-frame/03-UI-SPEC.md` — stage, mode switch, badge and caption design, incl. the dev-1.7 amendment (Dickenkarte with both lenses)
- `.planning/phases/03-3d-lenses-frame/deferred-items.md` — source of F-01..F-06
- `.planning/phases/03-3d-lenses-frame/03-SECURITY.md` — AR-03-04 (`window.__eyeglassView`)
- `.planning/phases/03-3d-lenses-frame/03-VERIFICATION.md` — VIZ-06 accepted without a device trace
- `.planning/phases/02-lay-first-german-input-results-comparison/02-CONTEXT.md` — D-09 (HSA, distance lens), D-25 (vocabulary), D-28/D-29 (A/B), D-32 and Deferred (no persistence, shared origin)
- `.planning/phases/01-verified-engine-live-pipeline/01-15-SUMMARY.md` — worker protocol, latest-wins, ENG-09 (a)–(d) measurement that must not regress
- `session.md` — "Next step" block: carry-overs, local testing rule, CI font and mirror notes

### Engine sources to reuse (no copies)
- `src/engine/conventions.js` — frames and signs; examiner view, TABO (D-07)
- `src/engine/trace.js` — `traceRay`, `traceBVP`, Snell refraction, Newton intersection
- `src/engine/design.js` — `frontSagAt`, `backSagAt` and their gradients
- `src/engine/boundary.test.js` — the lint boundary the warp code must satisfy

### Agent gate
- `.claude/agents/lens-critic.md` — reviews the phase plan and the phase result

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/trace.js`: vector-Snell trace through both real surfaces, already written as a production module for the phase-4 warp grid (its header says so). It needs oblique rays from an eye point.
- `src/ui/view/view.js` + `scene.js` + `tiers.js`: stage, mode switch handling, quality tiers, render on demand. Durchblick is a new mode here.
- `src/ui/view/backdrop.js` (`createChart`): the procedural checkerboard and letter band.
- `src/state/mesh-client.js` + `src/worker/mesh.worker.js` + `mesh-protocol.js`: latest-wins worker pipeline with a watchdog; the model for the warp job.
- `src/ui/view/fullscreen.js`, `legend.js`, `labels.js`: stage overlays (F-02 touches these).
- `src/i18n/de-AT.js` (`view.*` keys), `format.js`: all new strings and percent formatting.
- `version.js` + the `app-meta` plugin in `vite.config.js`: version, commit and date in the footer.

### Established Patterns
- Engine is pure JS, no DOM or Three.js, enforced by ESLint and `boundary.test.js`.
- npm dependencies exact-pinned, Actions SHA-pinned (CI pin tests); `test/ci/workflow-structure.test.js` forbids bypass constructs in the workflow.
- Every visible state uses text or an icon as well as colour; axe runs in CI at 320 px and desktop.
- Unsourced design constants are marked `[ASSUMED]` and shown as "angenommener Wert".
- Nothing is stored in the browser today (no `localStorage`, no service worker anywhere in `src/`).
- CSP is injected at build time by the `csp-meta` plugin; `worker.spec.js` checks the string exactly.

### Integration Points
- `index.html` `#view-mode` (line 395, `data-expert hidden`, two radios): gains the Durchblick radio and loses the Expert-only gate.
- `vite.config.js`: the PWA plugin joins `appMeta` and `cspMeta`; `base` is already `/Eyeglass-Prescription/`.
- `index.html` line 7 `<link rel="icon" href="data:,">`: replaced or complemented by the manifest icon.
- `.github/workflows/deploy.yml` and the verify-live step: must keep passing with a service worker in front of the site.
- `src/ui/main.js` / `pipeline.js`: after-first-paint hook for service-worker registration (D-22).

</code_context>

<specifics>
## Specific Ideas

- **For the user's veto, D-01:** the Durchblick shows what the wearer sees, at true scale. For weak prescriptions the visible effect is small (about 1 % per dioptre of minus). The alternative would be an observer's view of the chart through a lens held away from it, which looks more dramatic but is not a defined physical quantity. Correctness was the user's first priority in phase 3 ("as correct as possible result"), so the wearer's view was chosen.
- The user asked for both lenses in the Dickenkarte (dev-1.7) because the two eyes often differ; D-06 applies the same wish here.
- The user's tablet in landscape is about 1164 × 593 px (dev-1.6); the Durchblick and the update banner must be checked at that size as well as on the phone.

</specifics>

<deferred>
## Deferred Ideas

- Observer view ("wie andere meine Augen hinter dem Glas sehen", eyes look smaller or larger): needs a face or eye model; v2 together with the phase-3 deferred head model.
- Blur or sharpness simulation, colour fringes from the Abbe number in the Durchblick: v2.
- An HSA (vertex distance) input that drives the Durchblick: v2; v1 uses one documented value.
- Looking through off-centre points of the lens (rotating eye, prismatic effect at the edge): v2.
- Install promotion ("Zum Startbildschirm hinzufügen") and an offline indicator beyond one quiet line: backlog.
- Persisting inputs across sessions (opt-in): v2 with SHARE-01, unchanged from phase 2.
- 03-CI item: at 320 px with the root font at 150 % and −12 dpt on both eyes the page is 345 px wide (WCAG 1.4.10). Not caused by this phase; backlog unless a phase-4 plan touches that layout.

</deferred>

---

*Phase: 04-refraction-view-offline*
*Context gathered: 2026-11-13*
