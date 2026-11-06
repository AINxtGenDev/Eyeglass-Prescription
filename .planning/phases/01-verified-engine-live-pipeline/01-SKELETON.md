# Walking Skeleton — Eyeglass Prescription (3D Lens & Frame Simulator)

**Phase:** 1
**Generated:** 2026-11-06
**Plans that build it:** 01-01 (scaffold, parser, i18n), 01-02 (engine core), 01-03 (German page, smoke GREEN), 01-04 (CI gates + workflow), 01-05 (first approved push, Pages enable, live check). Revised 2026-11-06: the former 01-02 was split into engine core (01-02) and page (01-03) per plan-checker; all later plans shifted by one, and the former 01-07 was split into engine (01-08) and Zyl/Achse page (01-09). Plans run in 11 sequential waves (shared working tree and shared UI files).

## Capability Proven End-to-End

A visitor opens https://ainxtgendev.github.io/Eyeglass-Prescription/ (desktop or phone), types a sphere value for each eye in paper style (`-2,25`, `−2.25`, `+1 dpt`, `plan`), sees the value echoed in de-AT format (`−2,25 dpt`), and gets, from one real engine compute, the per-eye centre thickness, max/min edge thickness with location, weight, and base curve with the rule used, for a CR-39 lens in a fixed round 50 mm frame (DBL 18 mm, PD 32 mm per eye, both stated on the page), next to a persistent German disclaimer. The site was published by a gated GitHub Actions run (lint → unit tests with coverage → build → browser smoke), and a `verify-live` job re-ran the smoke test against the live URL.

There is no database in this project. The skeleton's "one real read/write" maps to one real engine computation: user input → `src/state` parser → `src/engine` `evaluatePair()` → `LensResult` → German DOM output.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | None. Vanilla ES modules, light-DOM native HTML controls; Vite 8.3.6 for dev/build | STACK.md: no framework needed for ~200 strings and one form; native controls keep `label for` / `aria-describedby` working (no Shadow DOM) |
| Language / types | Plain JavaScript (ES2022 modules) with JSDoc typedefs on the engine API | Spec says JS; JSDoc gives editor help without a compile step |
| Data layer | None (static site, no backend, no storage in phase 1). State lives in memory in `src/ui/main.js` | PROJECT.md: no backend by design; Rx is health data (GDPR Art. 9), so nothing leaves the browser |
| Engine | `src/engine/` pure JS, no Three.js, no DOM, no `performance`/`fetch` (ESLint-enforced, DEPL-03). Public API `evaluateLens(spec)` / `evaluatePair({OD, OS})` → plain-data `LensResult` | CLAUDE.md "Engine first": single source of truth for every number; plain data keeps a later Web Worker move mechanical |
| Layering | `src/engine` (bottom) ← `src/state` (pure parsing/transposition, codes not text) ← `src/i18n` (`de-AT.js`, `t()`, `format.js`) ← `src/ui` (only tier with browser globals) | RESEARCH Architectural Responsibility Map; flat-config globals scoped to `src/ui/**` only (Pitfall B) |
| Sign conventions | One module `src/engine/conventions.js`: Cartesian, examiner-facing lens-local frame, TABO axis identical for OD/OS, `nasalSign = OD ? +1 : −1`, back curvature `c = −D2/K` | RESEARCH Pattern 1; the back-sign is the #1 bug class (Pitfall A) |
| Optics model | Thick-lens back-vertex design with CT fixed point; stable rationalised sag; true "tyre" torus back surface (added in 01-08, MEDIUM confidence per D-03); automatic base curve = the D1 in [+0.50, +10.00] that minimises the maximum lens thickness max(CT, etMax), found by a bounded search for every lens (rule `thinnest`); Vogel (clamped) is computed only as the sourced reference value ("Vogel-Richtwert") and seeds the search; error only if no D1 in range computes (D-01 final 2026-11-06, "always pick the thinnest") | RESEARCH Patterns 2–3; verified against Snell trace and 143 Zeiss rows |
| i18n | German only (`de-AT`). Flat frozen dictionary `src/i18n/de-AT.js` keyed by message codes; `t(key, params)` throws on a missing key outside production; numbers formatted with `Intl.NumberFormat('de-AT')`, never inside strings | CLAUDE.md project rule; L10N-01/02 |
| Auth | None | Static public site, no accounts |
| Deployment target | GitHub Pages, Source "GitHub Actions", base path `/Eyeglass-Prescription/`; one workflow `.github/workflows/deploy.yml` with jobs `build` (all gates) → `deploy` → `verify-live` | DEPL-01..04; pushes to `main` only after explicit user approval (D-02) |
| Build identity | `<meta name="app-commit" content="…">` injected into `index.html` at build time (7-char `GITHUB_SHA`, `dev` locally); the footer reads it | `verify-live` can grep the HTML for the commit; lens-critic and bug reports can identify the build |
| Testing | Vitest 5.1.0 project `unit` (node env) with v8 coverage gate on `src/engine/**` (lines 95 %, branches 90 %); fast-check 4.10.2 for properties; Playwright 1.65.0 smoke (desktop + 360 px mobile viewport, chromium) with @axe-core/playwright 4.14.0 | RESEARCH Validation Architecture |
| Supply chain | Exact npm pins (`.npmrc save-exact=true`, lockfile, `npm ci`), 40-char SHA-pinned actions, no CDN scripts, no third-party requests | DEPL-04; ASVS V10/V14 |
| Directory layout | `index.html`, `src/{engine,engine/frame,state,i18n,ui}/`, co-located `*.test.js`, `test/ci/`, `test/fixtures/`, `e2e/` | RESEARCH Recommended Project Structure (e2e path per 01-VALIDATION.md) |

## Frozen Contract (later plans extend values, never rename fields)

`LensSpec` → `evaluateLens` → `LensResult`, defined by JSDoc in `src/engine/evaluate.js` (plan 01-02; consumed by the page from 01-03):

- `LensSpec`: `{ eye: 'OD'|'OS', sph, cyl, axisDeg, materialId, frame: { shape, A, B, DBL }, monoPD, fittingHeight: number|null, baseCurve: number|null, minCT: number|null, minET: number|null }`
- `LensResult`: `{ ok, eye, diagnostics: [{ code, severity: 'error'|'warn'|'info', data }], metrics: null | { ct, etMax: { value, index, location, x, y }, etMin: {…}, etAt: { nasal, temporal, superior, inferior }, volumeMm3, weightG, frontProtrusion: { max, min }, mbsMm, decentration: { x, y } }, intermediates: null | { n, D1, D1v, D2a, D2b, R1, Ra, Rb (radii in mm, null for a plano surface), rhoMax, vogelD1, baseCurveRule: 'thinnest'|'manual', baseCurveSearch: null (manual) | { evaluations, maxThickness }, vogelClampedD1, vogelMaxThickness: number|null (reference only), bindingConstraint: 'minCT'|'minET', iterations }, surfaces: null | { n, ct, c1, k1, ca, cb, axisRad, oc: { x, y } } }`
- Diagnostic codes are the frozen object `DIAGNOSTICS` in `src/engine/diagnostics.js`; German text lives only in `src/i18n/de-AT.js` under `diag.<CODE>.title|explain|suggest`.
- No base-curve diagnostic: `BASE_CURVE_CLAMPED` was removed by D-01 final (the earlier `range` / `frame-size` / `frame-optimised` reasons and the `vogel` / `vogel-clamped` / `frame-optimised` / `vogel-frame-limited` rules no longer exist); the difference from Vogel is information in `intermediates`. With `baseCurve: null` an error appears only when no D1 in [+0.50, +10.00] computes (`data.searched = true`), and the engine never returns `FRONT_SAG_UNDEFINED` for a real frame; that code is reachable only with a manual base curve.
- Engine helpers added to the contract: `baseCurveAuto(se, { n, rhoMax, k1 = 0 })` → `{ vogelD1, vogelClampedD1, maxD1 }` (conic-aware search bound, so the phase-2 asphere keeps the guarantee); `optimiseBaseCurve({ …, maxD1, seedD1 })` in `src/engine/solve.js` (runs for every automatic lens; ≈ 28–30 solves per eye); `solveCT(..., ct0)` warm start and `maxThickness`.

## Stack Touched in Phase 1

- [ ] Project scaffold (Vite, ESLint flat config with engine boundary, Vitest projects + coverage gate, Playwright) — 01-01
- [ ] Routing — single page at `/Eyeglass-Prescription/` (no client routes by design; future shareable state goes in `#hash`, v2) — 01-03
- [ ] Data — no database; one real engine compute per input event — engine 01-02, wiring 01-03
- [ ] UI — Sph text inputs per eye wired to parser → engine → German result table — 01-03
- [ ] Deployment — gated Actions workflow, Pages enabled (Source: GitHub Actions), live URL verified by `verify-live` — 01-04, 01-05

## Out of Scope (Deferred to Later Slices)

Within phase 1 (added by plans 01-06 … 01-11 on top of the skeleton, no architectural change):
- Material choice beyond CR-39 (Trivex 1,53, PC 1,59, 1,60, 1,67, 1,74) and the Zeiss manufacturer-chart proof (01-06)
- Frame shapes Rund/Rechteckig/Panto/Pilot, editable A/B/DBL/PD, per-eye decentration (01-07)
- True torus, ray-trace oracle (01-08)
- Zyl/Achse input, plus-cylinder transposition, both forms shown (01-09)
- Impossible-lens diagnostics with German explanation and suggestion, property tests (01-10)
- Phase gate, lens-critic result review, final approved push, real-phone timing (01-11)

Later phases (not in phase 1 at all):
- Range/plausibility validation with "Meinten Sie …?" (RX-04/05), PD forms `32/33` and binocular (RX-06), "gleich für beide Augen" (RX-07), Add/Prisma explanation (RX-08) — phase 2
- Frame stamp parsing, rim depth, frame ranges (FRAME-02/03); manual base curve, min-thickness and aspheric controls (MAT-03..05); Simple/Expert views, comparison, cross-section, full a11y (RES-01..05, UX-*, ANA-*) — phase 2
- Any Three.js code, 3D meshes, heatmap — phase 3 (`three` is not installed in phase 1)
- Durchblick warp-grid refraction (reuses `src/engine/trace.js`), service worker / offline — phase 4
- Shareable links, printing, English UI — v2

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: a lay user enters the full paper Rx in a German R/L table with validation, picks frame and material, reads plain-German results and compares materials/frames in mm and g; Expert view with 2D SVG cross-section.
- Phase 3: the same verified engine data rendered as 3D lenses in a parametric frame (Three.js r187, `WebGLRenderer`), camera presets, heatmap in Expert view.
- Phase 4: Durchblick view via a CPU warp grid traced through the engine's real surfaces (`src/engine/trace.js`), plus an offline service worker scoped to `/Eyeglass-Prescription/` with an "Aktualisieren" prompt.
